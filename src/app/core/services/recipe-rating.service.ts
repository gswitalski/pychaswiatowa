import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
    RecipeRatingDto,
    UpdateRecipeRatingCommand,
} from '../../../../shared/contracts/types';
import { SupabaseService } from './supabase.service';

interface FunctionError {
    message?: string;
    status?: number;
    context?: {
        status?: number;
    };
}

@Injectable({
    providedIn: 'root',
})
export class RecipeRatingService {
    private readonly supabase = inject(SupabaseService);

    setRating(
        recipeId: number,
        rating: number | null
    ): Observable<RecipeRatingDto> {
        const body: UpdateRecipeRatingCommand = { rating };

        return from(
            this.supabase.functions.invoke<RecipeRatingDto>(
                `recipes/${recipeId}/rating`,
                {
                    method: 'PUT',
                    body,
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(response.error.message) as Error & {
                        status: number;
                    };
                    error.status =
                        this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    const error = new Error(
                        'Nie udało się zapisać oceny przepisu'
                    ) as Error & { status: number };
                    error.status = 500;
                    throw error;
                }

                return response.data;
            })
        );
    }

    private extractStatusFromError(error: FunctionError): number | null {
        if (error.status) {
            return error.status;
        }

        if (error.context?.status) {
            return error.context.status;
        }

        const message = error.message?.toLowerCase() ?? '';

        if (
            message.includes('unauthorized') ||
            message.includes('nieautoryzowany')
        ) {
            return 401;
        }

        if (
            message.includes('forbidden') ||
            message.includes('zabroniony')
        ) {
            return 403;
        }

        if (
            message.includes('not found') ||
            message.includes('nie znaleziono')
        ) {
            return 404;
        }

        if (
            message.includes('bad request') ||
            message.includes('nieprawidłow')
        ) {
            return 400;
        }

        return null;
    }
}
