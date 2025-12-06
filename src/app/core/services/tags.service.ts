import { Injectable, inject, signal } from '@angular/core';
import { Observable, from, map, tap, of } from 'rxjs';
import { SupabaseService } from './supabase.service';
import { TagDto } from '../../../../shared/contracts/types';

/**
 * Serwis odpowiedzialny za pobieranie i cache'owanie tagów użytkownika.
 */
@Injectable({
    providedIn: 'root',
})
export class TagsService {
    private readonly supabase = inject(SupabaseService);

    /** Wewnętrzny sygnał przechowujący cache tagów */
    private readonly _tags = signal<TagDto[]>([]);

    /** Wewnętrzny sygnał informujący o stanie ładowania */
    private readonly _loading = signal<boolean>(false);

    /** Wewnętrzny sygnał informujący czy tagi zostały załadowane */
    private readonly _loaded = signal<boolean>(false);

    /** Wewnętrzny sygnał dla błędów */
    private readonly _error = signal<string | null>(null);

    /** Publiczny read-only sygnał z tagami */
    readonly tags = this._tags.asReadonly();

    /** Publiczny read-only sygnał stanu ładowania */
    readonly loading = this._loading.asReadonly();

    /** Publiczny read-only sygnał stanu załadowania */
    readonly loaded = this._loaded.asReadonly();

    /** Publiczny read-only sygnał błędów */
    readonly error = this._error.asReadonly();

    /**
     * Ładuje tagi użytkownika z API.
     * Jeśli tagi są już w cache, zwraca je natychmiast.
     */
    loadTags(): Observable<TagDto[]> {
        // Zwróć cache jeśli już załadowano
        if (this._loaded()) {
            return of(this._tags());
        }

        // Zapobiegaj wielokrotnym równoczesnym requestom
        if (this._loading()) {
            return of(this._tags());
        }

        this._loading.set(true);
        this._error.set(null);

        return from(this.fetchTags()).pipe(
            map((result) => {
                if (result.error) {
                    throw result.error;
                }
                return result.data;
            }),
            tap({
                next: (tags) => {
                    this._tags.set(tags);
                    this._loaded.set(true);
                    this._loading.set(false);
                },
                error: (err) => {
                    this._error.set(err.message || 'Nie udało się pobrać tagów');
                    this._loading.set(false);
                },
            })
        );
    }

    /**
     * Pobiera tagi z Supabase.
     */
    private async fetchTags(): Promise<{
        data: TagDto[];
        error: Error | null;
    }> {
        const {
            data: { user },
        } = await this.supabase.auth.getUser();

        if (!user) {
            return { data: [], error: new Error('Użytkownik niezalogowany') };
        }

        const { data, error } = await this.supabase
            .from('tags')
            .select('id, name')
            .eq('user_id', user.id)
            .order('name', { ascending: true });

        if (error) {
            return { data: [], error };
        }

        return {
            data: data ?? [],
            error: null,
        };
    }

    /**
     * Czyści cache tagów. Przydatne przy odświeżaniu danych.
     */
    clearCache(): void {
        this._tags.set([]);
        this._loaded.set(false);
        this._error.set(null);
    }
}

