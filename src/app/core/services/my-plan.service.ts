import { Injectable, inject, signal, computed } from '@angular/core';
import { EventEmitter } from '@angular/core';
import { Observable, from, map, catchError, throwError, tap, finalize } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    AddRecipeToPlanCommand,
    GetPlanResponseDto,
    PlanListItemDto,
    ApiError,
} from '../../../../shared/contracts/types';

/**
 * Stan danych planu (lista + meta + loading).
 */
export interface MyPlanState {
    items: PlanListItemDto[];
    meta: { total: number; limit: 50 };
    isLoading: boolean;
    isRefreshing: boolean;
    error: ApiError | null;
    lastLoadedAt: number | null;
}

/**
 * Stan mutacji (operacje destrukcyjne).
 */
export interface MyPlanMutationState {
    isClearing: boolean;
    deletingRecipeIds: Set<number>;
}

const INITIAL_PLAN_STATE: MyPlanState = {
    items: [],
    meta: { total: 0, limit: 50 },
    isLoading: false,
    isRefreshing: false,
    error: null,
    lastLoadedAt: null,
};

const INITIAL_MUTATION_STATE: MyPlanMutationState = {
    isClearing: false,
    deletingRecipeIds: new Set(),
};

/** TTL dla odświeżania danych planu (60 sekund) */
const PLAN_CACHE_TTL_MS = 60_000;

/**
 * Zdarzenia zmian w planie
 */
export interface PlanChangeEvent {
    type: 'added' | 'removed';
    recipeId: number;
}

/**
 * Serwis zarządzający "Moim planem" użytkownika.
 * Odpowiada za komunikację z API planu oraz stan drawer'a.
 *
 * Jest jedynym źródłem prawdy dla:
 * - otwarcia/zamknięcia drawer'a
 * - danych planu (lista + meta)
 * - stanów ładowania/odświeżania
 * - stanów mutacji (clear/remove)
 *
 * Zgodnie z architekturą: używa TYLKO supabase.functions.invoke(),
 * NIGDY bezpośrednio supabase.from().
 */
@Injectable({
    providedIn: 'root',
})
export class MyPlanService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Stan otwarcia drawer'a "Mój plan" (globalny)
     */
    readonly isDrawerOpen = signal<boolean>(false);

    /**
     * EventEmitter dla zmian w planie - informuje o dodaniu/usunięciu przepisów
     */
    readonly planChanges = new EventEmitter<PlanChangeEvent>();

    /**
     * Stan danych planu
     */
    readonly planState = signal<MyPlanState>(INITIAL_PLAN_STATE);

    /**
     * Stan mutacji (operacje destrukcyjne)
     */
    readonly mutationState = signal<MyPlanMutationState>(INITIAL_MUTATION_STATE);

    /**
     * Computed: liczba elementów w planie
     */
    readonly planTotal = computed(() => this.planState().meta.total);

    /**
     * Computed: czy plan ma elementy
     */
    readonly hasItems = computed(() => this.planTotal() > 0);

    /**
     * Computed: lista elementów (posortowana po added_at desc)
     */
    readonly items = computed(() => {
        const items = [...this.planState().items];
        return items.sort((a, b) =>
            new Date(b.added_at).getTime() - new Date(a.added_at).getTime()
        );
    });

    /**
     * Computed: czy ładowanie początkowe
     */
    readonly isLoading = computed(() => this.planState().isLoading);

    /**
     * Computed: czy odświeżanie
     */
    readonly isRefreshing = computed(() => this.planState().isRefreshing);

    /**
     * Computed: błąd
     */
    readonly error = computed(() => this.planState().error);

    /**
     * Computed: czy trwa czyszczenie planu
     */
    readonly isClearing = computed(() => this.mutationState().isClearing);

    /**
     * Sprawdza czy dany przepis jest w trakcie usuwania
     */
    isDeletingRecipe(recipeId: number): boolean {
        return this.mutationState().deletingRecipeIds.has(recipeId);
    }

    /**
     * Pobiera aktualny plan użytkownika
     * GET /plan
     */
    getPlan(): Observable<GetPlanResponseDto> {
        return from(
            this.supabase.functions.invoke<GetPlanResponseDto>('plan', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, 500);
                }
                if (!response.data) {
                    // Pusty plan to poprawny stan
                    const emptyPlan: GetPlanResponseDto = {
                        data: [],
                        meta: { total: 0, limit: 50 }
                    };
                    return emptyPlan;
                }
                return response.data;
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Prefetch planu - wywołanie w tle do FAB.
     * Używane przy starcie MainLayoutComponent.
     */
    prefetchPlan(): void {
        const state = this.planState();

        // Nie prefetch jeśli już ładujemy
        if (state.isLoading || state.isRefreshing) {
            return;
        }

        // Ustaw loading tylko jeśli nie mamy danych
        const hasData = state.lastLoadedAt !== null;

        this.planState.update(s => ({
            ...s,
            isLoading: !hasData,
            isRefreshing: hasData,
            error: null,
        }));

        this.getPlan().subscribe({
            next: (response) => {
                this.planState.set({
                    items: response.data,
                    meta: response.meta,
                    isLoading: false,
                    isRefreshing: false,
                    error: null,
                    lastLoadedAt: Date.now(),
                });
            },
            error: (err: ApiError) => {
                this.planState.update(s => ({
                    ...s,
                    isLoading: false,
                    isRefreshing: false,
                    error: err,
                }));
            },
        });
    }

    /**
     * Ładuje plan z odświeżeniem (jeśli stary lub wymuszony).
     * Używane przy otwieraniu drawer'a.
     */
    loadPlanIfNeeded(force = false): void {
        const state = this.planState();

        // Nie ładuj jeśli już ładujemy
        if (state.isLoading || state.isRefreshing) {
            return;
        }

        // Sprawdź TTL
        const isStale = state.lastLoadedAt === null ||
            Date.now() - state.lastLoadedAt > PLAN_CACHE_TTL_MS;

        if (!force && !isStale) {
            return;
        }

        const hasData = state.lastLoadedAt !== null;

        this.planState.update(s => ({
            ...s,
            isLoading: !hasData,
            isRefreshing: hasData,
            error: null,
        }));

        this.getPlan().subscribe({
            next: (response) => {
                this.planState.set({
                    items: response.data,
                    meta: response.meta,
                    isLoading: false,
                    isRefreshing: false,
                    error: null,
                    lastLoadedAt: Date.now(),
                });
            },
            error: (err: ApiError) => {
                this.planState.update(s => ({
                    ...s,
                    isLoading: false,
                    isRefreshing: false,
                    error: err,
                }));
            },
        });
    }

    /**
     * Wymusza pełne odświeżenie planu.
     */
    refreshPlan(): void {
        this.loadPlanIfNeeded(true);
    }

    /**
     * Dodaje przepis do planu użytkownika
     * POST /plan/recipes
     *
     * @param command - komenda z recipe_id
     * @throws Error z czytelnym komunikatem (status w ApiError)
     */
    addToPlan(command: AddRecipeToPlanCommand): Observable<void> {
        // Guard clauses - walidacja wejściowa
        if (!command.recipe_id || command.recipe_id <= 0) {
            return throwError(() => ({
                message: 'Nieprawidłowy identyfikator przepisu',
                status: 400,
            } as ApiError));
        }

        return from(
            this.supabase.functions.invoke('plan/recipes', {
                method: 'POST',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status);
                }
                // Sukces - brak wartości zwrotnej
                return;
            }),
            tap(() => {
                // Po sukcesie odśwież plan i emituj zdarzenie
                this.refreshPlan();
                this.planChanges.emit({ type: 'added', recipeId: command.recipe_id });
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Usuwa przepis z planu użytkownika
     * DELETE /plan/recipes/{recipeId}
     *
     * Aktualizuje stan mutacji (deletingRecipeIds) i lokalny stan planu po sukcesie.
     */
    removeFromPlan(recipeId: number): Observable<void> {
        // Guard clause
        if (!recipeId || recipeId <= 0) {
            return throwError(() => ({
                message: 'Nieprawidłowy identyfikator przepisu',
                status: 400,
            } as ApiError));
        }

        // Dodaj do deletingRecipeIds
        this.mutationState.update(s => ({
            ...s,
            deletingRecipeIds: new Set([...s.deletingRecipeIds, recipeId]),
        }));

        return from(
            this.supabase.functions.invoke(`plan/recipes/${recipeId}`, {
                method: 'DELETE',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status);
                }
                return;
            }),
            tap(() => {
                // Po sukcesie usuń z lokalnego stanu i emituj zdarzenie
                this.planState.update(s => ({
                    ...s,
                    items: s.items.filter(item => item.recipe_id !== recipeId),
                    meta: { ...s.meta, total: Math.max(0, s.meta.total - 1) },
                }));
                this.planChanges.emit({ type: 'removed', recipeId });
            }),
            finalize(() => {
                // Zawsze usuń z deletingRecipeIds
                this.mutationState.update(s => {
                    const newSet = new Set(s.deletingRecipeIds);
                    newSet.delete(recipeId);
                    return { ...s, deletingRecipeIds: newSet };
                });
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Usuwa wszystkie przepisy z planu użytkownika
     * DELETE /plan
     *
     * Aktualizuje stan mutacji (isClearing) i lokalny stan planu po sukcesie.
     */
    clearPlan(): Observable<void> {
        // Ustaw isClearing
        this.mutationState.update(s => ({ ...s, isClearing: true }));

        return from(
            this.supabase.functions.invoke('plan', {
                method: 'DELETE',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw this.mapError(response.error, response.error.status);
                }
                return;
            }),
            tap(() => {
                // Po sukcesie wyczyść lokalny stan
                this.planState.update(s => ({
                    ...s,
                    items: [],
                    meta: { ...s.meta, total: 0 },
                }));
            }),
            finalize(() => {
                // Zawsze resetuj isClearing
                this.mutationState.update(s => ({ ...s, isClearing: false }));
            }),
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Resetuje cały stan planu (np. przy wylogowaniu).
     */
    resetPlanState(): void {
        this.planState.set(INITIAL_PLAN_STATE);
        this.mutationState.set(INITIAL_MUTATION_STATE);
        this.isDrawerOpen.set(false);
    }

    /**
     * Otwiera drawer "Mój plan"
     */
    openDrawer(): void {
        this.isDrawerOpen.set(true);
    }

    /**
     * Zamyka drawer "Mój plan"
     */
    closeDrawer(): void {
        this.isDrawerOpen.set(false);
    }

    /**
     * Mapuje błędy API na czytelne komunikaty dla UI
     * zgodnie z planem implementacji (sekcja 5)
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
            case 403:
                message = 'Nie masz dostępu do tego przepisu.';
                break;
            case 404:
                message = 'Przepis nie istnieje.';
                break;
            case 409:
                message = 'Ten przepis jest już w Twoim planie.';
                break;
            case 422:
                message = 'Plan ma już 50 przepisów. Usuń coś z planu i spróbuj ponownie.';
                break;
            case 500:
            default:
                message = 'Nie udało się dodać do planu. Spróbuj ponownie.';
                break;
        }

        return { message, status };
    }

    /**
     * Obsługuje błędy z Observable
     */
    private handleError(err: unknown): Observable<never> {
        console.error('[MyPlanService] Error:', err);

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

