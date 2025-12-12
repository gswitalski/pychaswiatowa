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
                    throw new Error(response.error.message);
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
                    throw new Error(response.error.message);
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
                            throw new Error(addResponse.error.message);
                        }
                    })
                )
            )
        );
    }
}

