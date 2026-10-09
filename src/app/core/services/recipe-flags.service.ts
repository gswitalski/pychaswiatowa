import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
    RecipeFlagsDto,
    UpdateRecipeFlagsCommand,
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
export class RecipeFlagsService {
    private readonly supabase = inject(SupabaseService);

    setFlags(
        recipeId: number,
        patch: UpdateRecipeFlagsCommand
    ): Observable<RecipeFlagsDto> {
        return from(
            this.supabase.functions.invoke<RecipeFlagsDto>(
                `recipes/${recipeId}/flags`,
                {
                    method: 'PUT',
                    body: patch,
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
                        'Nie udało się zapisać flag przepisu'
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
