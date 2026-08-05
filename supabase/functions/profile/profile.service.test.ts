import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { checkUsernameAvailable } from './profile.service.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';

function createUsernameLookupClient(count: number | null): TypedSupabaseClient {
    return {
        from: () => ({
            select: () => ({
                ilike: () => Promise.resolve({ count, error: null }),
            }),
        }),
    } as unknown as TypedSupabaseClient;
}

Deno.test('checkUsernameAvailable: zwraca true dla wolnej nazwy', async () => {
    const result = await checkUsernameAvailable({
        client: createUsernameLookupClient(0),
        username: 'wolna-nazwa',
    });

    assertEquals(result, { available: true });
});

Deno.test('checkUsernameAvailable: zwraca false dla zajętej nazwy', async () => {
    const result = await checkUsernameAvailable({
        client: createUsernameLookupClient(1),
        username: 'zajeta-nazwa',
    });

    assertEquals(result, { available: false });
});
