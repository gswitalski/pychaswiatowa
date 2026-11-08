import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
    RecipeNoteDto,
    UpdateRecipeNoteCommand,
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
export class RecipeNoteService {
    private readonly supabase = inject(SupabaseService);

    updateNote(
        recipeId: number,
        note: string | null
    ): Observable<RecipeNoteDto> {
        const body: UpdateRecipeNoteCommand = { note };

        return from(
            this.supabase.functions.invoke<RecipeNoteDto>(
                `recipes/${recipeId}/note`,
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
                        'Nie udało się zapisać notatki'
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
