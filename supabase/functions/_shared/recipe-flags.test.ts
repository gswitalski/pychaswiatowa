import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';
import { getRecipeFlagsMap } from './recipe-flags.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

Deno.test('getRecipeFlagsMap: pomija zapytanie dla gościa i pustej listy', async () => {
    let queryCalled = false;
    const client = {
        from: () => {
            queryCalled = true;
            throw new Error('Query should not be called');
        },
    } as unknown as TypedSupabaseClient;

    assertEquals((await getRecipeFlagsMap(client, [1], null)).size, 0);
    assertEquals((await getRecipeFlagsMap(client, [], USER_ID)).size, 0);
    assertEquals(queryCalled, false);
});

Deno.test('getRecipeFlagsMap: filtruje po użytkowniku i mapuje rekordy', async () => {
    const calls: unknown[] = [];
    const client = {
        from: (table: string) => {
            calls.push(table);
            const query = {
                select: () => query,
                eq: (column: string, value: unknown) => {
                    calls.push([column, value]);
                    return query;
                },
                in: (column: string, values: number[]) => {
                    calls.push([column, values]);
                    return Promise.resolve({
                        data: [{
                            recipe_id: 12,
                            is_favorite: true,
                            is_want_to_try: false,
                        }],
                        error: null,
                    });
                },
            };
            return query;
        },
    } as unknown as TypedSupabaseClient;

    const result = await getRecipeFlagsMap(client, [12], USER_ID);

    assertEquals(result.get(12), {
        is_favorite: true,
        is_want_to_try: false,
    });
    assertEquals(calls, [
        'user_recipe_flags',
        ['user_id', USER_ID],
        ['recipe_id', [12]],
    ]);
});
