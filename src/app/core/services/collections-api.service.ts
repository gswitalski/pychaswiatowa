import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    CollectionListItemDto,
    CollectionDetailDto,
    RecipeListItemDto,
    PaginatedResponseDto,
    CreateCollectionCommand,
    UpdateCollectionCommand,
} from '../../../../shared/contracts/types';

@Injectable({
    providedIn: 'root',
})
export class CollectionsApiService {
    private readonly supabase = inject(SupabaseService);

    /**
     * Pobiera listę kolekcji użytkownika
     * GET /collections
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
     * Tworzy nową kolekcję
     * POST /collections
     */
    createCollection(
        command: CreateCollectionCommand
    ): Observable<CollectionListItemDto> {
        return from(this.performCreateCollection(command)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                if (!result.data) {
                    throw new Error('Nie udało się utworzyć kolekcji');
                }
                return result.data;
            })
        );
    }

    /**
     * Aktualizuje istniejącą kolekcję
     * PUT /collections/{id}
     */
    updateCollection(
        id: number,
        command: UpdateCollectionCommand
    ): Observable<CollectionListItemDto> {
        return from(this.performUpdateCollection(id, command)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                if (!result.data) {
                    throw new Error('Nie udało się zaktualizować kolekcji');
                }
                return result.data;
            })
        );
    }

    /**
     * Usuwa kolekcję
     * DELETE /collections/{id}
     */
    deleteCollection(id: number): Observable<void> {
        return from(this.performDeleteCollection(id)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
            })
        );
    }

    /**
     * Pobiera szczegóły kolekcji wraz z listą przepisów
     * GET /collections/{id}
     */
    getCollectionDetails(
        id: number,
        page: number = 1,
        limit: number = 12
    ): Observable<CollectionDetailDto> {
        return from(this.fetchCollectionDetails(id, page, limit)).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                if (!result.data) {
                    throw new Error('Nie znaleziono kolekcji');
                }
                return result.data;
            })
        );
    }

    /**
     * Usuwa przepis z kolekcji
     * DELETE /collections/{collectionId}/recipes/{recipeId}
     */
    removeRecipeFromCollection(
        collectionId: number,
        recipeId: number
    ): Observable<void> {
        return from(this.performRemoveRecipeFromCollection(collectionId, recipeId)).pipe(
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

    private async performCreateCollection(
        command: CreateCollectionCommand
    ): Promise<{
        data: CollectionListItemDto | null;
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
            .insert({
                name: command.name,
                description: command.description,
                user_id: user.id,
            })
            .select('id, name, description')
            .single();

        if (error) {
            return { data: null, error };
        }

        return { data, error: null };
    }

    private async performUpdateCollection(
        id: number,
        command: UpdateCollectionCommand
    ): Promise<{
        data: CollectionListItemDto | null;
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        const updateData: Record<string, unknown> = {};
        if (command.name !== undefined) {
            updateData['name'] = command.name;
        }
        if (command.description !== undefined) {
            updateData['description'] = command.description;
        }

        const { data, error } = await this.supabase
            .from('collections')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', user.id)
            .select('id, name, description')
            .single();

        if (error) {
            return { data: null, error };
        }

        return { data, error: null };
    }

    private async performDeleteCollection(id: number): Promise<{
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        const { error } = await this.supabase
            .from('collections')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) {
            return { error };
        }

        return { error: null };
    }

    private async fetchCollectionDetails(
        id: number,
        page: number,
        limit: number
    ): Promise<{
        data: CollectionDetailDto | null;
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: null, error: new Error('Użytkownik niezalogowany') };
        }

        // Pobierz dane kolekcji
        const { data: collection, error: collectionError } = await this.supabase
            .from('collections')
            .select('id, name, description')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (collectionError) {
            return { data: null, error: collectionError };
        }

        if (!collection) {
            return { data: null, error: new Error('Nie znaleziono kolekcji') };
        }

        // Oblicz offset dla paginacji
        const offset = (page - 1) * limit;

        // Pobierz przepisy z kolekcji wraz z całkowitą liczbą
        const { data: recipeRelations, error: recipesError, count } = await this.supabase
            .from('recipe_collections')
            .select('recipe_id, recipes(id, name, image_path, created_at)', { count: 'exact' })
            .eq('collection_id', id)
            .range(offset, offset + limit - 1);

        if (recipesError) {
            return { data: null, error: recipesError };
        }

        // Mapuj przepisy
        const recipes: RecipeListItemDto[] = (recipeRelations ?? [])
            .map((rel) => rel.recipes as unknown as RecipeListItemDto)
            .filter((recipe): recipe is RecipeListItemDto => recipe !== null);

        const totalItems = count ?? 0;
        const totalPages = Math.ceil(totalItems / limit);

        const collectionDetail: CollectionDetailDto = {
            id: collection.id,
            name: collection.name,
            description: collection.description,
            recipes: {
                data: recipes,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems,
                },
            },
        };

        return { data: collectionDetail, error: null };
    }

    private async performRemoveRecipeFromCollection(
        collectionId: number,
        recipeId: number
    ): Promise<{
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { error: new Error('Użytkownik niezalogowany') };
        }

        // Sprawdź czy kolekcja należy do użytkownika
        const { data: collection, error: collectionError } = await this.supabase
            .from('collections')
            .select('id')
            .eq('id', collectionId)
            .eq('user_id', user.id)
            .single();

        if (collectionError || !collection) {
            return { error: new Error('Nie znaleziono kolekcji lub brak dostępu') };
        }

        // Usuń relację przepis-kolekcja
        const { error } = await this.supabase
            .from('recipe_collections')
            .delete()
            .eq('collection_id', collectionId)
            .eq('recipe_id', recipeId);

        if (error) {
            return { error };
        }

        return { error: null };
    }
}
