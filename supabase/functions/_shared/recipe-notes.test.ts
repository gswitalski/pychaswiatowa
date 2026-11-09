import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import {
    countRecipeNoteCharacters,
    getMyRecipeNote,
    normalizeRecipeNote,
} from './recipe-notes.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';

Deno.test('normalizes line endings and surrounding whitespace', () => {
    assertEquals(
        normalizeRecipeNote('  Mniej soli\r\n\r\nWięcej pieprzu  '),
        'Mniej soli\n\nWięcej pieprzu',
    );
});

Deno.test('normalizes empty notes to null', () => {
    assertEquals(normalizeRecipeNote(' \n\r\n '), null);
    assertEquals(normalizeRecipeNote(null), null);
});

Deno.test('counts Unicode code points instead of UTF-16 units', () => {
    assertEquals(countRecipeNoteCharacters('😀'.repeat(2000)), 2000);
    assertEquals(countRecipeNoteCharacters('😀'.repeat(2001)), 2001);
});

Deno.test('preserves note content literally', () => {
    const note = '<script>alert(1)</script> **bold** <b>x</b>';
    assertEquals(normalizeRecipeNote(note), note);
});

function createNoteReadClient(params: {
    data?: { note: string } | null;
    error?: { code: string; message: string } | null;
    onQuery?: (table: string, operation: string, value: unknown) => void;
}): TypedSupabaseClient {
    const query = {
        select: (value: string) => {
            params.onQuery?.('user_recipe_notes', 'select', value);
            return query;
        },
        eq: (column: string, value: unknown) => {
            params.onQuery?.('user_recipe_notes', column, value);
            return query;
        },
        maybeSingle: () => Promise.resolve({
            data: params.data ?? null,
            error: params.error ?? null,
        }),
    };

    return {
        from: () => query,
    } as unknown as TypedSupabaseClient;
}

Deno.test('getMyRecipeNote: gość zwraca undefined bez zapytania', async () => {
    let queryCount = 0;
    const result = await getMyRecipeNote(
        createNoteReadClient({ onQuery: () => queryCount++ }),
        348,
        null
    );

    assertEquals(result, undefined);
    assertEquals(queryCount, 0);
});

Deno.test('getMyRecipeNote: mapuje brak wiersza na null i filtruje użytkownika oraz przepis', async () => {
    const calls: unknown[] = [];
    const result = await getMyRecipeNote(
        createNoteReadClient({ onQuery: (_table, operation, value) => calls.push([operation, value]) }),
        348,
        'user-1'
    );

    assertEquals(result, null);
    assertEquals(calls, [
        ['select', 'note'],
        ['user_id', 'user-1'],
        ['recipe_id', 348],
    ]);
});

Deno.test('getMyRecipeNote: błąd bazy zwraca undefined', async () => {
    const result = await getMyRecipeNote(
        createNoteReadClient({
            error: { code: '42501', message: 'permission denied' },
        }),
        348,
        'user-1'
    );

    assertEquals(result, undefined);
});
