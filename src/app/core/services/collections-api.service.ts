import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    CollectionListItemDto,
    CollectionDetailDto,
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
     * Tworzy nową kolekcję
     * POST /collections
     */
    createCollection(
        command: CreateCollectionCommand
    ): Observable<CollectionListItemDto> {
        return from(
            this.supabase.functions.invoke<CollectionListItemDto>('collections', {
                method: 'POST',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Nie udało się utworzyć kolekcji');
                }
                return response.data;
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
        return from(
            this.supabase.functions.invoke<CollectionListItemDto>(`collections/${id}`, {
                method: 'PUT',
                body: command,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Nie udało się zaktualizować kolekcji');
                }
                return response.data;
            })
        );
    }

    /**
     * Usuwa kolekcję
     * DELETE /collections/{id}
     */
    deleteCollection(id: number): Observable<void> {
        return from(
            this.supabase.functions.invoke(`collections/${id}`, {
                method: 'DELETE',
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
            })
        );
    }

    /**
     * Pobiera szczegóły kolekcji wraz z pełną listą przepisów (batch, bez paginacji UI)
     * GET /collections/{id}
     * @param id - ID kolekcji
     * @param limit - Limit techniczny (domyślnie 500)
     * @param sort - Pole sortowania (domyślnie 'created_at.desc')
     */
    getCollectionDetails(
        id: number,
        limit = 500,
        sort = 'created_at.desc'
    ): Observable<CollectionDetailDto> {
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());
        queryParams.append('sort', sort);

        return from(
            this.supabase.functions.invoke<CollectionDetailDto>(
                `collections/${id}?${queryParams.toString()}`,
                {
                    method: 'GET',
                }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw new Error(response.error.message);
                }
                if (!response.data) {
                    throw new Error('Nie znaleziono kolekcji');
                }
                return response.data;
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
        return from(
            this.supabase.functions.invoke(
                `collections/${collectionId}/recipes/${recipeId}`,
                {
                    method: 'DELETE',
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
}
