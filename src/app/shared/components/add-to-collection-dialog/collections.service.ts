import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';
import { SupabaseService } from '../../../core/services/supabase.service';
import { CollectionListItemDto } from '../../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class CollectionsService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Fetches all collections for the current user
     */
    getCollections(): Observable<CollectionListItemDto[]> {
        return from(
            this.supabase.functions.invoke<CollectionListItemDto[]>('collections', {
                method: 'GET',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                return response.data ?? [];
            })
        );
    }

    /**
     * Adds a recipe to an existing collection
     */
    addRecipeToCollection(
        collectionId: number,
        recipeId: number
    ): Observable<void> {
        return from(
            this.supabase.functions.invoke(
                `collections/${collectionId}/recipes`,
                {
                    method: 'POST',
                    body: { recipe_id: recipeId },
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(response.error.message) as Error & { status: number };
                    error.status = this.extractStatusFromError(response.error) || 500;
                    throw error;
                }
            })
        );
    }

    /**
     * Creates a new collection and adds a recipe to it
     * This is a two-step operation: create collection, then add recipe
     */
    createCollectionAndAddRecipe(
        name: string,
        recipeId: number
    ): Observable<void> {
        return from(
            this.supabase.functions.invoke<{ id: number }>(
                'collections',
                {
                    method: 'POST',
                    body: { name },
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(response.error.message) as Error & { status: number };
                    error.status = this.extractStatusFromError(response.error) || 500;
                    throw error;
                }
                if (!response.data) {
                    throw new Error('Nie udało się utworzyć kolekcji');
                }
                return response.data;
            }),
            switchMap((collection) =>
                from(
                    this.supabase.functions.invoke(
                        `collections/${collection.id}/recipes`,
                        {
                            method: 'POST',
                            body: { recipe_id: recipeId },
                        }
                    )
                ).pipe(
                    map((addResponse) => {
                        if (addResponse.error) {
                            const error = new Error(addResponse.error.message) as Error & { status: number };
                            error.status = this.extractStatusFromError(addResponse.error) || 500;
                            throw error;
                        }
                    })
                )
            )
        );
    }

    /**
     * Wyciąga status HTTP z błędu zwróconego przez Supabase Functions
     * @private
     */
    private extractStatusFromError(error: { message?: string; status?: number; context?: { status?: number } }): number | null {
        if (error.status) return error.status;
        if (error.context?.status) return error.context.status;

        const message = error.message?.toLowerCase() || '';
        if (message.includes('already exists') || message.includes('już istnieje') || message.includes('conflict')) {
            return 409;
        }
        if (message.includes('not found') || message.includes('nie znaleziono')) {
            return 404;
        }
        if (message.includes('bad request') || message.includes('nieprawidłow')) {
            return 400;
        }
        if (message.includes('unauthorized') || message.includes('forbidden')) {
            return 403;
        }

        return null;
    }
}

