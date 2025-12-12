import { Injectable, inject } from '@angular/core';
import { Observable, from, map, catchError } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { GlobalSearchResponseDto } from '../../../../shared/contracts/types';

/**
 * Service for global search functionality.
 * Searches across recipes and collections via REST API.
 */
@Injectable({
    providedIn: 'root',
})
export class SearchService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Performs global search across recipes and collections.
     * Calls GET /functions/v1/search/global?q={query}
     *
     * @param query - Search query string (minimum 2 characters)
     * @returns Observable with search results grouped by type
     */
    searchGlobal(query: string): Observable<GlobalSearchResponseDto> {
        const encodedQuery = encodeURIComponent(query.trim());

        return from(
            this.supabase.functions.invoke<GlobalSearchResponseDto>(
                `search/global?q=${encodedQuery}`,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message || 'Błąd wyszukiwania');
                }
                return response.data ?? { recipes: [], collections: [] };
            }),
            catchError(() => {
                // Return empty results on error for better UX
                return from([{ recipes: [], collections: [] }]);
            })
        );
    }
}

