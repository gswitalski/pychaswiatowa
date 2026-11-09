import { inject, Injectable } from '@angular/core';
import { from, map, Observable } from 'rxjs';
import {
    RecipeNoteResponseDto,
    SetRecipeNoteRequestDto,
} from '../../../../shared/contracts/types';
import { SupabaseService } from './supabase.service';
import { toStatusError } from '../utils/function-error-status';

@Injectable({ providedIn: 'root' })
export class RecipeNoteService {
    private readonly supabase = inject(SupabaseService);

    setNote(recipeId: number, note: string | null): Observable<RecipeNoteResponseDto> {
        const body: SetRecipeNoteRequestDto = { note };
        return from(
            this.supabase.functions.invoke<RecipeNoteResponseDto>(`recipes/${recipeId}/note`, {
                method: 'PUT',
                body,
            }),
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw toStatusError(response.error, 'Nie udało się zapisać notatki');
                }
                if (!response.data) {
                    throw toStatusError(null, 'Nie udało się zapisać notatki');
                }
                return response.data;
            }),
        );
    }
}
