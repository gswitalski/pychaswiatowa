import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { RecipeDetailDto } from '../../../../shared/contracts/types';

/**
 * Serwis do komunikacji z API explore dla przepisów.
 * Endpoint /explore/recipes obsługuje opcjonalne uwierzytelnienie:
 * - dla PUBLIC: dostęp dla wszystkich (także gości)
 * - dla nie-PUBLIC: dostęp tylko dla autora (zalogowanego)
 *
 * UWAGA: Ten serwis działa WYŁĄCZNIE przez Edge Functions (supabase.functions.invoke).
 * NIE używa bezpośrednich zapytań do bazy danych (supabase.from).
 */
@Injectable({
    providedIn: 'root',
})
export class ExploreRecipesService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Pobiera szczegóły pojedynczego przepisu z endpointu explore.
     * Endpoint obsługuje opcjonalne uwierzytelnienie:
     * - visibility=PUBLIC → 200 dla wszystkich (także bez tokenu)
     * - visibility!=PUBLIC → 200 tylko dla zalogowanego autora
     * - pozostałe przypadki → 404
     *
     * @param id ID przepisu
     * @returns Observable ze szczegółami przepisu
     * @throws Error z właściwością status (404, 400, 401, 500)
     */
    getExploreRecipeById(id: number): Observable<RecipeDetailDto> {
        return from(
            this.supabase.functions.invoke<RecipeDetailDto>(
                `explore/recipes/${id}`,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    // Propagacja błędu z odpowiednim statusem HTTP
                    const error = new Error(response.error.message) as Error & { status: number };
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
        if (message.includes('unauthorized') || message.includes('nieautoryzowany')) {
            return 401;
        }
        if (message.includes('forbidden') || message.includes('zabroniony')) {
            return 403;
        }

        return null;
    }
}
