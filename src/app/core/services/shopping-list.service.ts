import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, from, map, catchError, throwError, tap, finalize } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    GetShoppingListResponseDto,
    ShoppingListItemDto,
    ShoppingListItemRecipeDto,
    ShoppingListItemManualDto,
    AddManualShoppingListItemCommand,
    UpdateShoppingListItemCommand,
    ApiError,
} from '../../../../shared/contracts/types';

/**
 * Stan danych listy zakupów.
 */
export interface ShoppingListState {
    data: ShoppingListItemDto[];
    meta: GetShoppingListResponseDto['meta'];
    isLoading: boolean;
    isRefreshing: boolean;
    error: ApiError | null;
    lastLoadedAt: number | null;
}

/**
 * Stan mutacji listy zakupów.
 */
export interface ShoppingListMutationState {
    isAddingManual: boolean;
    togglingItemIds: Set<number>;
    deletingItemIds: Set<number>;
}

/**
 * ViewModel dla pojedynczej pozycji listy zakupów.
 */
export interface ShoppingListItemVm {
    id: number;
    kind: 'RECIPE' | 'MANUAL';
    isOwned: boolean;
    primaryText: string;
    secondaryText: string | null;
    canDelete: boolean;
    raw: ShoppingListItemDto;
}

const INITIAL_STATE: ShoppingListState = {
    data: [],
    meta: { total: 0, recipe_items: 0, manual_items: 0 },
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastLoadedAt: null,
};

const INITIAL_MUTATION_STATE: ShoppingListMutationState = {
    isAddingManual: false,
    togglingItemIds: new Set(),
    deletingItemIds: new Set(),
};

/** TTL dla cache'u listy zakupów (60 sekund) */
const CACHE_TTL_MS = 60_000;

/**
 * Serwis zarządzający listą zakupów użytkownika.
 * Odpowiada za komunikację z API listy zakupów oraz zarządzanie stanem.
 *
 * Jest jedynym źródłem prawdy dla:
 * - danych listy zakupów (pozycje z przepisów + ręczne)
 * - stanów ładowania/odświeżania
 * - stanów mutacji (dodawanie, toggle, usuwanie)
 *
 * Zgodnie z architekturą: używa TYLKO supabase.functions.invoke(),
 * NIGDY bezpośrednio supabase.from().
 */
@Injectable({
    providedIn: 'root',
})
export class ShoppingListService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Stan danych listy zakupów
     */
    readonly state = signal<ShoppingListState>(INITIAL_STATE);

    /**
     * Stan mutacji
     */
    readonly mutationState = signal<ShoppingListMutationState>(INITIAL_MUTATION_STATE);

    /**
     * Computed: lista elementów zmapowana na ViewModel
     */
    readonly itemsVm = computed<ShoppingListItemVm[]>(() => {
        return this.state().data.map(item => this.mapToViewModel(item));
    });

    /**
     * Computed: lista posortowana wg reguł MVP
     * - is_owned=false na górze
     * - is_owned=true na dole
     * - stabilnie wewnątrz grup po primaryText (localeCompare, 'pl')
     */
    readonly itemsSorted = computed<ShoppingListItemVm[]>(() => {
        const items = [...this.itemsVm()];
        
        return items.sort((a, b) => {
            // Najpierw sortuj po is_owned (false przed true)
            if (a.isOwned !== b.isOwned) {
                return a.isOwned ? 1 : -1;
            }
            
            // Potem alfabetycznie po primaryText
            return a.primaryText.localeCompare(b.primaryText, 'pl');
        });
    });

    /**
     * Computed: czy lista jest pusta (po załadowaniu)
     */
    readonly isEmpty = computed(() => {
        return this.itemsSorted().length === 0 && !this.state().isLoading;
    });

    /**
     * Computed: liczba elementów
     */
    readonly total = computed(() => this.state().meta.total);

    /**
     * Computed: liczba elementów z przepisów
     */
    readonly recipeItemsCount = computed(() => this.state().meta.recipe_items);

    /**
     * Computed: liczba elementów ręcznych
     */
    readonly manualItemsCount = computed(() => this.state().meta.manual_items);

    /**
     * Computed: czy trwa ładowanie początkowe
     */
    readonly isLoading = computed(() => this.state().isLoading);

    /**
     * Computed: czy trwa odświeżanie
     */
    readonly isRefreshing = computed(() => this.state().isRefreshing);

    /**
     * Computed: błąd
     */
    readonly error = computed(() => this.state().error);

    /**
     * Computed: czy trwa dodawanie ręcznej pozycji
     */
    readonly isAddingManual = computed(() => this.mutationState().isAddingManual);

    /**
     * Sprawdza czy dany element jest w trakcie toggle
     */
    isTogglingItem(itemId: number): boolean {
        return this.mutationState().togglingItemIds.has(itemId);
    }

    /**
     * Sprawdza czy dany element jest w trakcie usuwania
     */
    isDeletingItem(itemId: number): boolean {
        return this.mutationState().deletingItemIds.has(itemId);
    }

    /**
     * Pobiera listę zakupów z API
     * GET /shopping-list
     */
    getShoppingList(): Observable<GetShoppingListResponseDto> {
        return from(
            this.supabase.functions.invoke<GetShoppingListResponseDto>('shopping-list', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, 500);
                }
                if (!response.data) {
                    // Pusta lista to poprawny stan
                    const emptyList: GetShoppingListResponseDto = {
                        data: [],
                        meta: { total: 0, recipe_items: 0, manual_items: 0 }
                    };
                    return emptyList;
                }
                return response.data;
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Ładuje listę zakupów (z cache lub odświeżeniem)
     */
    loadShoppingList(force = false): void {
        const currentState = this.state();

        // Nie ładuj jeśli już trwa ładowanie
        if (currentState.isLoading || currentState.isRefreshing) {
            return;
        }

        // Sprawdź TTL
        const isStale = currentState.lastLoadedAt === null ||
            Date.now() - currentState.lastLoadedAt > CACHE_TTL_MS;

        if (!force && !isStale) {
            return;
        }

        const hasData = currentState.lastLoadedAt !== null;

        this.state.update(s => ({
            ...s,
            isLoading: !hasData,
            isRefreshing: hasData,
            error: null,
        }));

        this.getShoppingList().subscribe({
            next: (response) => {
                this.state.set({
                    data: response.data,
                    meta: response.meta,
                    isLoading: false,
                    isRefreshing: false,
                    error: null,
                    lastLoadedAt: Date.now(),
                });
            },
            error: (err: ApiError) => {
                this.state.update(s => ({
                    ...s,
                    isLoading: false,
                    isRefreshing: false,
                    error: err,
                }));
            },
        });
    }

    /**
     * Wymusza pełne odświeżenie listy
     */
    refreshShoppingList(): void {
        this.loadShoppingList(true);
    }

    /**
     * Dodaje ręczną pozycję do listy zakupów
     * POST /shopping-list/items
     */
    addManualItem(command: AddManualShoppingListItemCommand): Observable<ShoppingListItemManualDto> {
        // Guard clause - walidacja
        if (!command.text || command.text.trim().length === 0) {
            return throwError(() => ({
                message: 'Wpisz nazwę pozycji.',
                status: 400,
            } as ApiError));
        }

        // Ustaw stan dodawania
        this.mutationState.update(s => ({ ...s, isAddingManual: true }));

        return from(
            this.supabase.functions.invoke<ShoppingListItemManualDto>('shopping-list/items', {
                method: 'POST',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status || 500);
                }
                if (!response.data) {
                    throw this.mapError({ message: 'Brak danych w odpowiedzi' }, 500);
                }
                return response.data;
            }),
            tap((newItem) => {
                // Po sukcesie dodaj element lokalnie
                this.state.update(s => ({
                    ...s,
                    data: [...s.data, newItem],
                    meta: {
                        ...s.meta,
                        total: s.meta.total + 1,
                        manual_items: s.meta.manual_items + 1,
                    },
                }));
            }),
            finalize(() => {
                // Zawsze resetuj stan dodawania
                this.mutationState.update(s => ({ ...s, isAddingManual: false }));
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Aktualizuje stan "posiadane" pozycji
     * PATCH /shopping-list/items/{id}
     */
    updateItemOwned(itemId: number, isOwned: boolean): Observable<ShoppingListItemDto> {
        // Guard clause
        if (!itemId || itemId <= 0) {
            return throwError(() => ({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            } as ApiError));
        }

        // Dodaj do togglingItemIds
        this.mutationState.update(s => ({
            ...s,
            togglingItemIds: new Set([...s.togglingItemIds, itemId]),
        }));

        // Optymistycznie zaktualizuj lokalnie
        const previousItem = this.state().data.find(item => item.id === itemId);
        this.state.update(s => ({
            ...s,
            data: s.data.map(item => 
                item.id === itemId ? { ...item, is_owned: isOwned } : item
            ),
        }));

        const command: UpdateShoppingListItemCommand = { is_owned: isOwned };

        return from(
            this.supabase.functions.invoke<ShoppingListItemDto>(`shopping-list/items/${itemId}`, {
                method: 'PATCH',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status || 500);
                }
                if (!response.data) {
                    throw this.mapError({ message: 'Brak danych w odpowiedzi' }, 500);
                }
                return response.data;
            }),
            tap((updatedItem) => {
                // Zaktualizuj danymi z API (na wypadek różnic)
                this.state.update(s => ({
                    ...s,
                    data: s.data.map(item => 
                        item.id === itemId ? updatedItem : item
                    ),
                }));
            }),
            finalize(() => {
                // Zawsze usuń z togglingItemIds
                this.mutationState.update(s => {
                    const newSet = new Set(s.togglingItemIds);
                    newSet.delete(itemId);
                    return { ...s, togglingItemIds: newSet };
                });
            }),
            catchError((err) => {
                // Rollback optymistycznej zmiany
                if (previousItem) {
                    this.state.update(s => ({
                        ...s,
                        data: s.data.map(item => 
                            item.id === itemId ? previousItem : item
                        ),
                    }));
                }
                return this.handleError(err);
            })
        );
    }

    /**
     * Usuwa ręczną pozycję z listy zakupów
     * DELETE /shopping-list/items/{id}
     */
    deleteManualItem(itemId: number): Observable<void> {
        // Guard clause
        if (!itemId || itemId <= 0) {
            return throwError(() => ({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            } as ApiError));
        }

        // Dodaj do deletingItemIds
        this.mutationState.update(s => ({
            ...s,
            deletingItemIds: new Set([...s.deletingItemIds, itemId]),
        }));

        return from(
            this.supabase.functions.invoke(`shopping-list/items/${itemId}`, {
                method: 'DELETE',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status || 500);
                }
                return;
            }),
            tap(() => {
                // Po sukcesie usuń element lokalnie
                this.state.update(s => {
                    const removedItem = s.data.find(item => item.id === itemId);
                    const isManual = removedItem?.kind === 'MANUAL';
                    
                    return {
                        ...s,
                        data: s.data.filter(item => item.id !== itemId),
                        meta: {
                            ...s.meta,
                            total: Math.max(0, s.meta.total - 1),
                            manual_items: isManual ? Math.max(0, s.meta.manual_items - 1) : s.meta.manual_items,
                        },
                    };
                });
            }),
            finalize(() => {
                // Zawsze usuń z deletingItemIds
                this.mutationState.update(s => {
                    const newSet = new Set(s.deletingItemIds);
                    newSet.delete(itemId);
                    return { ...s, deletingItemIds: newSet };
                });
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Resetuje cały stan (np. przy wylogowaniu)
     */
    resetState(): void {
        this.state.set(INITIAL_STATE);
        this.mutationState.set(INITIAL_MUTATION_STATE);
    }

    /**
     * Mapuje DTO na ViewModel
     */
    private mapToViewModel(item: ShoppingListItemDto): ShoppingListItemVm {
        if (item.kind === 'RECIPE') {
            const recipeItem = item as ShoppingListItemRecipeDto;
            return {
                id: recipeItem.id,
                kind: 'RECIPE',
                isOwned: recipeItem.is_owned,
                primaryText: recipeItem.name,
                secondaryText: this.formatRecipeItemSecondary(recipeItem),
                canDelete: false,
                raw: item,
            };
        } else {
            const manualItem = item as ShoppingListItemManualDto;
            return {
                id: manualItem.id,
                kind: 'MANUAL',
                isOwned: manualItem.is_owned,
                primaryText: manualItem.text,
                secondaryText: null,
                canDelete: true,
                raw: item,
            };
        }
    }

    /**
     * Formatuje secondary text dla pozycji z przepisu
     */
    private formatRecipeItemSecondary(item: ShoppingListItemRecipeDto): string | null {
        if (item.amount !== null && item.unit !== null) {
            return `${item.amount} ${item.unit}`;
        }
        if (item.amount !== null) {
            return `${item.amount}`;
        }
        if (item.unit !== null) {
            return item.unit;
        }
        return null;
    }

    /**
     * Mapuje błędy API na czytelne komunikaty dla UI
     */
    private mapError(error: unknown, statusCode?: number): ApiError {
        const normalizedError =
            typeof error === 'object' && error !== null
                ? (error as Partial<ApiError>)
                : {};
        const status = statusCode || normalizedError.status || 500;
        let message = normalizedError.message || 'Wystąpił nieoczekiwany błąd';

        switch (status) {
            case 401:
                message = 'Sesja wygasła. Zaloguj się ponownie.';
                break;
            case 400:
                message = message || 'Wpisz nazwę pozycji.';
                break;
            case 403:
                message = 'Nie można usuwać pozycji pochodzących z przepisów.';
                break;
            case 404:
                message = 'Nie znaleziono pozycji listy (mogła zostać już usunięta).';
                break;
            case 500:
            default:
                message = 'Wystąpił błąd. Spróbuj ponownie.';
                break;
        }

        return { message, status };
    }

    /**
     * Obsługuje błędy z Observable
     */
    private handleError(err: unknown): Observable<never> {
        console.error('[ShoppingListService] Error:', err);

        // Jeśli już jest ApiError, przepuść dalej
        if (this.isApiError(err)) {
            return throwError(() => err);
        }

        // W przeciwnym razie stwórz generyczny błąd
        const apiError: ApiError = {
            message: err instanceof Error ? err.message : 'Nieoczekiwany błąd',
            status: 500,
        };

        return throwError(() => apiError);
    }

    private isApiError(value: unknown): value is ApiError {
        if (typeof value !== 'object' || value === null) {
            return false;
        }

        const maybeError = value as Partial<ApiError>;
        return typeof maybeError.message === 'string' && typeof maybeError.status === 'number';
    }
}
