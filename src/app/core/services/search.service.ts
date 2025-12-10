import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    GlobalSearchResponseDto,
    SearchRecipeDto,
    SearchCollectionDto,
} from '../../../../shared/contracts/types';

/**
 * Service for global search functionality.
 * Searches across recipes and collections.
 */
@Injectable({
    providedIn: 'root',
})
export class SearchService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Performs global search across recipes and collections.
     * GET /search/global?q={query}
     *
     * @param query - Search query string (minimum 2 characters)
     * @returns Observable with search results grouped by type
     */
    searchGlobal(query: string): Observable<GlobalSearchResponseDto> {
        return from(this.fetchSearchResults(query)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data;
            })
        );
    }

    private async fetchSearchResults(query: string): Promise<{
        data: GlobalSearchResponseDto;
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return {
                data: { recipes: [], collections: [] },
                error: new Error('Użytkownik niezalogowany'),
            };
        }

        const searchTerm = `%${query.trim()}%`;

        // Search recipes
        const recipesPromise = this.supabase
            .from('recipes')
            .select(
                `
                id,
                name,
                category_id,
                categories!inner (name)
            `
            )
            .eq('user_id', user.id)
            .ilike('name', searchTerm)
            .limit(5);

        // Search collections
        const collectionsPromise = this.supabase
            .from('collections')
            .select('id, name')
            .eq('user_id', user.id)
            .ilike('name', searchTerm)
            .limit(5);

        const [recipesResult, collectionsResult] = await Promise.all([
            recipesPromise,
            collectionsPromise,
        ]);

        if (recipesResult.error || collectionsResult.error) {
            return {
                data: { recipes: [], collections: [] },
                error: recipesResult.error || collectionsResult.error,
            };
        }

        // Transform recipes to DTO format
        const recipes: SearchRecipeDto[] = (recipesResult.data ?? []).map(
            (recipe: {
                id: number;
                name: string;
                category_id: number | null;
                categories: { name: string } | null;
            }) => ({
                id: recipe.id,
                name: recipe.name,
                category: recipe.categories?.name ?? null,
            })
        );

        // Transform collections to DTO format
        const collections: SearchCollectionDto[] = (
            collectionsResult.data ?? []
        ).map((collection: { id: number; name: string }) => ({
            id: collection.id,
            name: collection.name,
        }));

        return {
            data: { recipes, collections },
            error: null,
        };
    }
}

