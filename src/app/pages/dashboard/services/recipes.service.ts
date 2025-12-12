import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { PaginatedResponseDto, RecipeListItemDto } from '../../../../../shared/contracts/types';

export interface GetRecipesParams {
    sort?: string;
    limit?: number;
    page?: number;
}

@Injectable({
    providedIn: 'root',
})
export class RecipesService {
    private readonly supabase = inject(SupabaseService);

    getRecipes(params: GetRecipesParams = {}): Observable<PaginatedResponseDto<RecipeListItemDto>> {
        const { sort = 'created_at.desc', limit = 10, page = 1 } = params;

        // Build query parameters
        const queryParams = new URLSearchParams();
        queryParams.append('page', page.toString());
        queryParams.append('limit', limit.toString());
        queryParams.append('sort', sort);

        return from(
            this.supabase.functions.invoke<PaginatedResponseDto<RecipeListItemDto>>(
                `recipes?${queryParams.toString()}`,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                return response.data ?? {
                    data: [],
                    pagination: { currentPage: 1, totalPages: 0, totalItems: 0 },
                };
            })
        );
    }
}


