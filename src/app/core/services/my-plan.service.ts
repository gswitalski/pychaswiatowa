import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map, catchError, throwError } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    AddRecipeToPlanCommand,
    GetPlanResponseDto,
    ApiError,
} from '../../../../shared/contracts/types';

/**
 * Serwis zarządzający "Moim planem" użytkownika.
 * Odpowiada za komunikację z API planu oraz stan drawer'a.
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
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Usuwa przepis z planu użytkownika
     * DELETE /plan/recipes/{recipeId}
     */
    removeFromPlan(recipeId: number): Observable<void> {
        // Guard clause
        if (!recipeId || recipeId <= 0) {
            return throwError(() => ({
                message: 'Nieprawidłowy identyfikator przepisu',
                status: 400,
            } as ApiError));
        }

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
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Usuwa wszystkie przepisy z planu użytkownika
     * DELETE /plan
     */
    clearPlan(): Observable<void> {
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
            catchError((err) => this.handleError(err))
        );
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
    private mapError(error: any, statusCode?: number): ApiError {
        const status = statusCode || error.status || 500;
        let message = error.message || 'Wystąpił nieoczekiwany błąd';

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
    private handleError(err: any): Observable<never> {
        console.error('[MyPlanService] Error:', err);

        // Jeśli już jest ApiError, przepuść dalej
        if (err.status !== undefined) {
            return throwError(() => err as ApiError);
        }

        // W przeciwnym razie stwórz generyczny błąd
        const apiError: ApiError = {
            message: err.message || 'Nieoczekiwany błąd',
            status: err.status || 500,
        };

        return throwError(() => apiError);
    }
}

