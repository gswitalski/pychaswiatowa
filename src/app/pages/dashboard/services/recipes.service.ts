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
        return from(this.fetchRecipes(params)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data;
            })
        );
    }

    private async fetchRecipes(params: GetRecipesParams): Promise<{
        data: PaginatedResponseDto<RecipeListItemDto>;
        error: Error | null;
    }> {
        const { sort = 'created_at.desc', limit = 10, page = 1 } = params;

        const [column, order] = sort.split('.');
        const ascending = order === 'asc';

        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const { data: { user } } = await this.supabase.auth.getUser();

        if (!user) {
            return {
                data: { data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } },
                error: new Error('User not authenticated'),
            };
        }

        const { data, error, count } = await this.supabase
            .from('recipes')
            .select('id, name, image_path, created_at', { count: 'exact' })
            .eq('user_id', user.id)
            .order(column, { ascending })
            .range(from, to);

        if (error) {
            return { data: { data: [], pagination: { currentPage: 1, totalPages: 0, totalItems: 0 } }, error };
        }

        const totalItems = count ?? 0;
        const totalPages = Math.ceil(totalItems / limit);

        return {
            data: {
                data: data ?? [],
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems,
                },
            },
            error: null,
        };
    }
}

