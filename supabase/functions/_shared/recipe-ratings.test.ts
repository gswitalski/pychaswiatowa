import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';
import { buildRatingFields, getMyRatingsMap } from './recipe-ratings.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

Deno.test('getMyRatingsMap: pomija zapytanie dla gościa i pustej listy', async () => {
    let queryCalled = false;
    const client = {
        from: () => {
            queryCalled = true;
            throw new Error('Query should not be called');
        },
    } as unknown as TypedSupabaseClient;

    assertEquals((await getMyRatingsMap(client, [1], null)).size, 0);
    assertEquals((await getMyRatingsMap(client, [], USER_ID)).size, 0);
    assertEquals(queryCalled, false);
});

Deno.test('getMyRatingsMap: filtruje po użytkowniku i mapuje rekordy', async () => {
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
                        data: [{ recipe_id: 12, rating: 4 }],
                        error: null,
                    });
                },
            };
            return query;
        },
    } as unknown as TypedSupabaseClient;

    const result = await getMyRatingsMap(client, [12], USER_ID);

    assertEquals(result.get(12), 4);
    assertEquals(calls, [
        'recipe_ratings',
        ['user_id', USER_ID],
        ['recipe_id', [12]],
    ]);
});

Deno.test('buildRatingFields: maskuje niepubliczne dane i nie zwraca my_rating gościowi', () => {
    assertEquals(
        buildRatingFields(
            { visibility: 'PRIVATE', average_rating: 4.5, ratings_count: 2 },
            4,
            true
        ),
        { average_rating: null, ratings_count: null, my_rating: null }
    );
    assertEquals(
        buildRatingFields(
            { visibility: 'PUBLIC', average_rating: null, ratings_count: 0 },
            undefined,
            false
        ),
        { average_rating: null, ratings_count: 0 }
    );
});
