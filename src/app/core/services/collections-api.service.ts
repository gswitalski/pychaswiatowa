import { Injectable, inject } from '@angular/core';
import { Observable, from, map } from 'rxjs';
import { SupabaseService } from './supabase.service';
import {
    CollectionListItemDto,
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
}
