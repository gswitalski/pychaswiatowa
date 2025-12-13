import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    PublicRecipeListItemDto,
    PaginatedResponseDto,
    PublicRecipeDetailDto,
} from '../../../../shared/contracts/types';

/**
 * Parametry zapytania do pobierania listy publicznych przepisów
 */
export interface GetPublicRecipesParams {
    /** Format: 'column.direction' np. 'created_at.desc' */
    sort?: string;
    /** Liczba elementów na stronie */
    limit?: number;
    /** Numer strony (zaczyna od 1) */
    page?: number;
    /** Fraza do wyszukiwania (min. 2 znaki) */
    q?: string;
}

/**
 * Serwis do komunikacji z publicznym API przepisów.
 * Używany dla gości (niezalogowanych użytkowników).
 *
 * UWAGA: Ten serwis działa WYŁĄCZNIE przez Edge Functions (supabase.functions.invoke).
 * NIE używa bezpośrednich zapytań do bazy danych (supabase.from).
 */
@Injectable({
    providedIn: 'root',
})
export class PublicRecipesService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Pobiera paginowaną listę publicznych przepisów z opcjonalnym filtrowaniem i sortowaniem.
     * Wywołuje GET /functions/v1/public/recipes z parametrami zapytania.
     *
     * @param params Parametry zapytania (sort, limit, page, q)
     * @returns Observable z paginowaną listą publicznych przepisów
     */
    getPublicRecipes(
        params: GetPublicRecipesParams = {}
    ): Observable<PaginatedResponseDto<PublicRecipeListItemDto>> {
        // Budowanie parametrów zapytania
        const queryParams = new URLSearchParams();

        if (params.page) {
            queryParams.append('page', params.page.toString());
        }

        if (params.limit) {
            queryParams.append('limit', params.limit.toString());
        }

        if (params.sort) {
            queryParams.append('sort', params.sort);
        }

        if (params.q) {
            queryParams.append('q', params.q);
        }

        const queryString = queryParams.toString();
        const endpoint = queryString
            ? `public/recipes?${queryString}`
            : 'public/recipes';

        return from(
            this.supabase.functions.invoke<
                PaginatedResponseDto<PublicRecipeListItemDto>
            >(endpoint, {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(
                        response.error.message || 'Błąd pobierania publicznych przepisów'
                    );
                }
                return response.data ?? {
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
                };
            })
        );
    }

    /**
     * Pobiera szczegóły pojedynczego publicznego przepisu.
     *
     * @param id ID przepisu
     * @returns Observable ze szczegółami publicznego przepisu
     * @throws ApiError z odpowiednim statusem HTTP (404, 400, 500)
     */
    getPublicRecipeById(id: number): Observable<PublicRecipeDetailDto> {
        return from(
            this.supabase.functions.invoke<PublicRecipeDetailDto>(
                `public/recipes/${id}`,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    // Propagacja błędu z odpowiednim statusem HTTP
                    const error = new Error(response.error.message) as Error & { status: number };
                    // Supabase Functions zwracają status w error.status lub możemy go wyciągnąć z context
                    error.status = this.extractStatusFromError(response.error) || 500;
                    throw error;
                }
                if (!response.data) {
                    // Brak danych prawdopodobnie oznacza 404
                    const error = new Error('Przepis nie został znaleziony') as Error & { status: number };
                    error.status = 404;
                    throw error;
                }
                return response.data;
            })
        );
    }

    /**
     * Wyciąga status HTTP z błędu zwróconego przez Supabase Functions
     * @private
     */
    private extractStatusFromError(error: { message?: string; status?: number; context?: { status?: number } }): number | null {
        // Supabase może zwracać status w różnych miejscach
        if (error.status) return error.status;
        if (error.context?.status) return error.context.status;

        // Analiza komunikatu błędu dla typowych przypadków
        const message = error.message?.toLowerCase() || '';
        if (message.includes('not found') || message.includes('nie znaleziono')) {
            return 404;
        }
        if (message.includes('bad request') || message.includes('nieprawidłow')) {
            return 400;
        }
        if (message.includes('unauthorized') || message.includes('forbidden')) {
            return 403;
        }

        return null;
    }
}
