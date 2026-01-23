import { Injectable, inject, signal, computed } from '@angular/core';
import {
    Observable,
    from,
    map,
    catchError,
    throwError,
    tap,
    finalize,
    concatMap,
    toArray,
} from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    GetShoppingListResponseDto,
    ShoppingListItemDto,
    ShoppingListItemRecipeDto,
    ShoppingListItemManualDto,
    AddManualShoppingListItemCommand,
    UpdateShoppingListItemCommand,
    ApiError,
    NormalizedIngredientUnit,
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
    togglingRowIds: Set<number>;
    deletingItemIds: Set<number>;
}

/**
 * ViewModel dla zgrupowanej pozycji listy zakupów.
 */
export interface ShoppingListGroupedItemBaseVm {
    groupKey: string;
    kind: 'RECIPE' | 'MANUAL';
    isOwned: boolean;
    primaryText: string;
    secondaryText: string | null;
    canDelete: boolean;
    rowIds: number[];
}

export interface ShoppingListGroupedRecipeItemVm extends ShoppingListGroupedItemBaseVm {
    kind: 'RECIPE';
    rowCount: number;
    sumAmount: number | null;
    unit: NormalizedIngredientUnit | null;
}

export interface ShoppingListGroupedManualItemVm extends ShoppingListGroupedItemBaseVm {
    kind: 'MANUAL';
    id: number;
}

export type ShoppingListGroupedItemVm =
    | ShoppingListGroupedRecipeItemVm
    | ShoppingListGroupedManualItemVm;

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
    togglingRowIds: new Set(),
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
     * Computed: lista zgrupowana wg reguł MVP
     * - grupuje tylko RECIPE po name/unit/is_owned
     * - MANUAL bez grupowania
     */
    readonly groupedItems = computed<ShoppingListGroupedItemVm[]>(() => {
        const items = this.state().data;
        const manualItems: ShoppingListGroupedItemVm[] = [];
        const recipeGroups = new Map<string, ShoppingListGroupedRecipeItemVm>();

        for (const item of items) {
            if (item.kind === 'MANUAL') {
                const manual = item as ShoppingListItemManualDto;
                manualItems.push({
                    groupKey: this.buildManualGroupKey(manual.id),
                    kind: 'MANUAL',
                    id: manual.id,
                    isOwned: manual.is_owned,
                    primaryText: manual.text,
                    secondaryText: null,
                    canDelete: true,
                    rowIds: [manual.id],
                });
                continue;
            }

            const recipe = item as ShoppingListItemRecipeDto;
            const groupKey = this.buildRecipeGroupKey(recipe);
            const existing = recipeGroups.get(groupKey);

            if (!existing) {
                recipeGroups.set(groupKey, {
                    groupKey,
                    kind: 'RECIPE',
                    isOwned: recipe.is_owned,
                    primaryText: recipe.name,
                    secondaryText: null,
                    canDelete: false,
                    rowIds: [recipe.id],
                    rowCount: 1,
                    sumAmount:
                        recipe.amount !== null && recipe.unit !== null ? recipe.amount : null,
                    unit: recipe.unit ?? null,
                });
                continue;
            }

            existing.rowIds.push(recipe.id);
            existing.rowCount += 1;

            if (existing.sumAmount !== null && recipe.amount !== null && recipe.unit !== null) {
                existing.sumAmount += recipe.amount;
            } else {
                existing.sumAmount = null;
            }
        }

        const groupedRecipes = Array.from(recipeGroups.values()).map(group => {
            if (group.sumAmount !== null && group.unit !== null) {
                return {
                    ...group,
                    secondaryText: `${group.sumAmount} ${group.unit}`,
                };
            }

            return {
                ...group,
                secondaryText: null,
                sumAmount: null,
            };
        });

        return [...manualItems, ...groupedRecipes];
    });

    /**
     * Computed: lista posortowana wg reguł MVP
     * - is_owned=false na górze
     * - is_owned=true na dole
     * - stabilnie wewnątrz grup po primaryText (localeCompare, 'pl')
     */
    readonly groupedItemsSorted = computed<ShoppingListGroupedItemVm[]>(() => {
        const items = [...this.groupedItems()];

        return items.sort((a, b) => {
            if (a.isOwned !== b.isOwned) {
                return a.isOwned ? 1 : -1;
            }

            return a.primaryText.localeCompare(b.primaryText, 'pl');
        });
    });

    /**
     * Computed: czy lista jest pusta (po załadowaniu)
     */
    readonly isEmpty = computed(() => {
        return this.groupedItemsSorted().length === 0 && !this.state().isLoading;
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
     * Sprawdza czy dany wiersz jest w trakcie toggle
     */
    isTogglingRow(itemId: number): boolean {
        return this.mutationState().togglingRowIds.has(itemId);
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
                this.state.update(s => ({
                    ...s,
                    data: response.data,
                    meta: response.meta,
                    isLoading: false,
                    isRefreshing: false,
                    error: null,
                    lastLoadedAt: Date.now(),
                }));
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
    toggleOwnedGroup(groupKey: string, isOwned: boolean): Observable<ShoppingListItemDto[]> {
        // Guard clause
        if (!groupKey) {
            return throwError(() => ({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            } as ApiError));
        }

        const group = this.groupedItems().find(item => item.groupKey === groupKey);

        if (!group) {
            return throwError(() => ({
                message: 'Nieprawidłowa pozycja listy.',
                status: 400,
            } as ApiError));
        }

        // Dodaj do togglingRowIds
        this.mutationState.update(s => ({
            ...s,
            togglingRowIds: new Set([...s.togglingRowIds, ...group.rowIds]),
        }));

        // Optymistycznie zaktualizuj lokalnie
        const previousData = [...this.state().data];
        const rowIds = new Set(group.rowIds);
        this.state.update(s => ({
            ...s,
            data: s.data.map(item =>
                rowIds.has(item.id) ? { ...item, is_owned: isOwned } : item
            ),
        }));

        const command: UpdateShoppingListItemCommand = { is_owned: isOwned };

        return from(group.rowIds).pipe(
            concatMap(itemId =>
                from(
                    this.supabase.functions.invoke<ShoppingListItemDto>(
                        `shopping-list/items/${itemId}`,
                        {
                            method: 'PATCH',
                            body: command,
                        }
                    )
                ).pipe(
                    map((response) => {
                        if (response.error) {
                            throw this.mapError(response.error, response.error.status || 500);
                        }
                        if (!response.data) {
                            throw this.mapError({ message: 'Brak danych w odpowiedzi' }, 500);
                        }
                        return response.data;
                    })
                )
            ),
            toArray(),
            tap((updatedItems) => {
                this.state.update(s => ({
                    ...s,
                    data: s.data.map(item => {
                        const updated = updatedItems.find(updatedItem => updatedItem.id === item.id);
                        return updated ?? item;
                    }),
                }));
            }),
            finalize(() => {
                // Zawsze usuń z togglingRowIds
                this.mutationState.update(s => {
                    const newSet = new Set(s.togglingRowIds);
                    for (const rowId of group.rowIds) {
                        newSet.delete(rowId);
                    }
                    return { ...s, togglingRowIds: newSet };
                });
            }),
            catchError((err) => {
                // Rollback optymistycznej zmiany
                this.state.update(s => ({
                    ...s,
                    data: previousData,
                }));
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
     * Buduje klucz grupy dla pozycji RECIPE
     */
    private buildRecipeGroupKey(item: ShoppingListItemRecipeDto): string {
        const unit = item.unit ?? 'null';
        const ownedFlag = item.is_owned ? '1' : '0';
        return `${item.name}||${unit}||${ownedFlag}`;
    }

    /**
     * Buduje klucz grupy dla pozycji MANUAL
     */
    private buildManualGroupKey(itemId: number): string {
        return `manual:${itemId}`;
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
