import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { getAiCredits } from './ai-credits.service.ts';

function createCreditsClient(params: {
    data?: Record<string, unknown> | null;
    error?: { code: string; message: string } | null;
    onFrom?: () => void;
}): TypedSupabaseClient {
    return {
        from: () => {
            params.onFrom?.();
            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: () => Promise.resolve({
                            data: params.data ?? null,
                            error: params.error ?? null,
                        }),
                    }),
                }),
            };
        },
    } as unknown as TypedSupabaseClient;
}

Deno.test('getAiCredits: admin otrzymuje unlimited bez zapytania do bazy', async () => {
    let queriedDatabase = false;
    const result = await getAiCredits({
        client: createCreditsClient({
            onFrom: () => {
                queriedDatabase = true;
            },
        }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        appRole: 'admin',
    });

    assertEquals(queriedDatabase, false);
    assertEquals(result.limit_type, 'unlimited');
    assertEquals(result.draft.remaining, null);
});

Deno.test('getAiCredits: brak rekordu zwraca domyślny limit Free', async () => {
    const result = await getAiCredits({
        client: createCreditsClient({ data: null }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        appRole: 'user',
    });

    assertEquals(result.limit_type, 'lifetime');
    assertEquals(result.draft, { total: 3, used: 0, remaining: 3 });
    assertEquals(result.image, { total: 0, used: 0, remaining: 0 });
});

Deno.test('getAiCredits: mapuje miesięczne saldo i reset', async () => {
    const nextResetAt = '2026-10-15T00:00:00.000Z';
    const result = await getAiCredits({
        client: createCreditsClient({
            data: {
                draft_credits_total: 20,
                draft_credits_used: 7,
                image_credits_total: 5,
                image_credits_used: 2,
                limit_type: 'monthly',
                next_reset_at: nextResetAt,
            },
        }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        appRole: 'premium',
    });

    assertEquals(result.draft.remaining, 13);
    assertEquals(result.image.remaining, 3);
    assertEquals(result.next_reset_at, nextResetAt);
});

Deno.test('getAiCredits: błąd bazy mapuje na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => getAiCredits({
            client: createCreditsClient({
                error: { code: 'XX000', message: 'database unavailable' },
            }),
            userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
            appRole: 'user',
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});
