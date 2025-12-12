import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map, tap, of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { CategoryDto } from '../../../../shared/contracts/types';

/**
 * Service responsible for fetching and caching recipe categories.
 * Categories are loaded once and cached for the lifetime of the application.
 */
@Injectable({
    providedIn: 'root',
})
export class CategoriesService {
    private readonly supabase = inject(SupabaseService);

    /** Internal signal holding the cached categories */
    private readonly _categories = signal<CategoryDto[]>([]);

    /** Internal signal indicating loading state */
    private readonly _loading = signal<boolean>(false);

    /** Internal signal indicating if categories have been loaded */
    private readonly _loaded = signal<boolean>(false);

    /** Internal signal for error state */
    private readonly _error = signal<string | null>(null);

    /** Public read-only signal exposing categories */
    readonly categories = this._categories.asReadonly();

    /** Public read-only signal exposing loading state */
    readonly loading = this._loading.asReadonly();

    /** Public read-only signal exposing loaded state */
    readonly loaded = this._loaded.asReadonly();

    /** Public read-only signal exposing error state */
    readonly error = this._error.asReadonly();

    /**
     * Loads categories from the API.
     * If categories are already cached, returns them immediately.
     * Uses a signal-based caching mechanism to prevent multiple API calls.
     */
    loadCategories(): Observable<CategoryDto[]> {
        // Return cached categories if already loaded
        if (this._loaded()) {
            return of(this._categories());
        }

        // Prevent multiple simultaneous requests
        if (this._loading()) {
            return of(this._categories());
        }

        this._loading.set(true);
        this._error.set(null);

        return from(this.fetchCategories()).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data;
            }),
            tap({
                next: (categories) => {
                    this._categories.set(categories);
                    this._loaded.set(true);
                    this._loading.set(false);
                },
                error: (err) => {
                    this._error.set(err.message || 'Nie udało się pobrać kategorii');
                    this._loading.set(false);
                },
            })
        );
    }

    /**
     * Fetches categories from backend API.
     */
    private async fetchCategories(): Promise<{
        data: CategoryDto[];
        error: Error | null;
    }> {
        const response = await this.supabase.functions.invoke<CategoryDto[]>(
            'categories',
            {
                method: 'GET',
            }
        );

        if (response.error) {
            return { data: [], error: new Error(response.error.message) };
        }

        return {
            data: response.data ?? [],
            error: null,
        };
    }

    /**
     * Clears the cached categories. Useful for testing or when data refresh is needed.
     */
    clearCache(): void {
        this._categories.set([]);
        this._loaded.set(false);
        this._error.set(null);
    }
}

