// Vitest (nie Deno): czysta logika odczytu notatki - rozróżnienie "brak notatki" od "błąd odczytu".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    buildNoteFields,
    getRecipeNoteForUser,
    type RecipeNoteLookup,
} from './recipe-notes';
import type { TypedSupabaseClient } from './supabase-client';

interface QueryResult {
    data: { note: string } | null;
    error: { code?: string; message: string } | null;
}

function createClient(result: QueryResult | Error) {
    const maybeSingle = vi.fn(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
    );
    const eqRecipe = vi.fn(() => ({ maybeSingle }));
    const eqUser = vi.fn(() => ({ eq: eqRecipe }));
    const select = vi.fn(() => ({ eq: eqUser }));
    const from = vi.fn(() => ({ select }));
    return {
        client: { from } as unknown as TypedSupabaseClient,
        from,
        select,
        eqUser,
        eqRecipe,
    };
}

describe('getRecipeNoteForUser', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('zwraca ok z treścią, gdy notatka istnieje, i filtruje po user_id oraz recipe_id', async () => {
        const { client, from, select, eqUser, eqRecipe } = createClient({
            data: { note: 'Mniej soli' },
            error: null,
        });

        const result = await getRecipeNoteForUser(client, 7, 'user-1');

        expect(result).toEqual({ status: 'ok', note: 'Mniej soli' });
        expect(from).toHaveBeenCalledWith('user_recipe_notes');
        expect(select).toHaveBeenCalledWith('note');
        expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
        expect(eqRecipe).toHaveBeenCalledWith('recipe_id', 7);
    });

    it('zwraca ok z null, gdy użytkownik nie ma notatki (brak wiersza)', async () => {
        const { client } = createClient({ data: null, error: null });

        await expect(getRecipeNoteForUser(client, 7, 'user-1')).resolves.toEqual({
            status: 'ok',
            note: null,
        });
    });

    it('zwraca unavailable (NIE null), gdy zapytanie zwróci błąd', async () => {
        const { client } = createClient({
            data: null,
            error: { code: '42501', message: 'permission denied' },
        });

        await expect(getRecipeNoteForUser(client, 7, 'user-1')).resolves.toEqual({
            status: 'unavailable',
        });
    });

    it('zwraca unavailable (NIE null), gdy zapytanie rzuci wyjątek', async () => {
        const { client } = createClient(new Error('network down'));

        await expect(getRecipeNoteForUser(client, 7, 'user-1')).resolves.toEqual({
            status: 'unavailable',
        });
    });

    it('dla gościa nie odpytuje bazy i zwraca ok z null', async () => {
        const { client, from } = createClient({ data: null, error: null });

        await expect(getRecipeNoteForUser(client, 7, null)).resolves.toEqual({
            status: 'ok',
            note: null,
        });
        expect(from).not.toHaveBeenCalled();
    });
});

describe('buildNoteFields', () => {
    it('gość: brak jakichkolwiek pól notatki', () => {
        expect(buildNoteFields({ status: 'ok', note: 'x' }, false)).toEqual({});
        expect(buildNoteFields({ status: 'unavailable' }, false)).toEqual({});
        expect(buildNoteFields(undefined, false)).toEqual({});
    });

    it('zalogowany z notatką: my_note z treścią, bez my_note_unavailable', () => {
        const fields = buildNoteFields({ status: 'ok', note: 'Treść' }, true);

        expect(fields).toEqual({ my_note: 'Treść' });
        expect('my_note_unavailable' in fields).toBe(false);
    });

    it('zalogowany bez notatki: my_note = null (brak notatki), bez my_note_unavailable', () => {
        const fields = buildNoteFields({ status: 'ok', note: null }, true);

        expect(fields).toEqual({ my_note: null });
        expect('my_note_unavailable' in fields).toBe(false);
    });

    it('zalogowany, błąd odczytu: my_note_unavailable = true i BRAK klucza my_note', () => {
        const fields = buildNoteFields({ status: 'unavailable' }, true);

        expect(fields).toEqual({ my_note_unavailable: true });
        expect('my_note' in fields).toBe(false);
    });

    it('zalogowany, nieznany wynik (undefined): niedostępna, nigdy "brak notatki"', () => {
        const lookup: RecipeNoteLookup | undefined = undefined;
        const fields = buildNoteFields(lookup, true);

        expect(fields).toEqual({ my_note_unavailable: true });
        expect('my_note' in fields).toBe(false);
    });
});
