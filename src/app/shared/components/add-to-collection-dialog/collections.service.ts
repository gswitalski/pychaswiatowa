import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
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
        return from(this.fetchCollections()).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data ?? [];
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
        return from(this.performAddRecipeToCollection(collectionId, recipeId)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
            })
        );
    }

    /**
     * Creates a new collection and adds a recipe to it
     */
    createCollectionAndAddRecipe(
        name: string,
        recipeId: number
    ): Observable<void> {
        return from(this.performCreateCollectionAndAddRecipe(name, recipeId)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
            })
        );
    }

    private async fetchCollections(): Promise<{
        data: CollectionListItemDto[] | null;
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        const { data, error } = await this.supabase
            .from('collections')
            .select('id, name, description')
            .eq('user_id', user.id)
            .order('name');

        if (error) {
            return { data: null, error };
        }

        return { data, error: null };
    }

    private async performAddRecipeToCollection(
        collectionId: number,
        recipeId: number
    ): Promise<{ error: Error | null }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        const { error } = await this.supabase
            .from('recipe_collections')
            .insert({ collection_id: collectionId, recipe_id: recipeId });

        if (error) {
            return { error };
        }

        return { error: null };
    }

    private async performCreateCollectionAndAddRecipe(
        name: string,
        recipeId: number
    ): Promise<{ error: Error | null }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        // Create collection
        const { data: collection, error: createError } = await this.supabase
            .from('collections')
            .insert({ name, user_id: user.id })
            .select('id')
            .single();

        if (createError || !collection) {
            return { error: createError ?? new Error('Nie udało się utworzyć kolekcji') };
        }

        // Add recipe to collection
        const { error: addError } = await this.supabase
            .from('recipe_collections')
            .insert({ collection_id: collection.id, recipe_id: recipeId });

        if (addError) {
            return { error: addError };
        }

        return { error: null };
    }
}

