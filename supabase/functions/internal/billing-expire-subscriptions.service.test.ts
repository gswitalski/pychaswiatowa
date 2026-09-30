import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import type { SyncAiCreditsForRoleParams } from '../_shared/ai-credits-sync.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { parseBillingExpiryGraceDays } from './billing-expire-subscriptions.handlers.ts';
import { runBillingExpiry } from './billing-expire-subscriptions.service.ts';

function createExpiryClient(params: {
    userIds?: string[];
    error?: { code: string; message: string } | null;
}): TypedSupabaseClient {
    return {
        rpc: () => Promise.resolve({
            data: (params.userIds ?? []).map((user_id) => ({ user_id })),
            error: params.error ?? null,
        }),
    } as unknown as TypedSupabaseClient;
}

Deno.test('parseBillingExpiryGraceDays: akceptuje zero i używa wartości domyślnej', () => {
    assertEquals(parseBillingExpiryGraceDays('0'), 0);
    assertEquals(parseBillingExpiryGraceDays('7'), 7);
    assertEquals(parseBillingExpiryGraceDays('-1'), 3);
    assertEquals(parseBillingExpiryGraceDays('abc'), 3);
    assertEquals(parseBillingExpiryGraceDays(undefined), 3);
});

Deno.test('runBillingExpiry: obsługuje brak wygasłych subskrypcji', async () => {
    const result = await runBillingExpiry({
        graceDays: 3,
        supabaseAdmin: createExpiryClient({}),
        syncCredits: () => Promise.resolve(),
    });

    assertEquals(result.expired_count, 0);
    assertEquals(result.credits_synced, 0);
    assertEquals(result.credits_failed, 0);
});

Deno.test('runBillingExpiry: synchronizuje kredyty wszystkich użytkowników', async () => {
    const syncedUsers: string[] = [];
    const result = await runBillingExpiry({
        graceDays: 3,
        supabaseAdmin: createExpiryClient({
            userIds: [
                '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
                '722f7cc3-f5f0-47bc-bd75-994821480add',
            ],
        }),
        syncCredits: (params: SyncAiCreditsForRoleParams) => {
            syncedUsers.push(params.userId);
            assertEquals(params.usageMode, 'keep');
            return Promise.resolve();
        },
    });

    assertEquals(result.expired_count, 2);
    assertEquals(result.credits_synced, 2);
    assertEquals(syncedUsers.length, 2);
});

Deno.test('runBillingExpiry: błąd synchronizacji jednego użytkownika nie przerywa pętli', async () => {
    let calls = 0;
    const result = await runBillingExpiry({
        graceDays: 3,
        supabaseAdmin: createExpiryClient({
            userIds: [
                '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
                '722f7cc3-f5f0-47bc-bd75-994821480add',
            ],
        }),
        syncCredits: () => {
            calls += 1;
            if (calls === 1) {
                return Promise.reject(new Error('sync failed'));
            }
            return Promise.resolve();
        },
    });

    assertEquals(result.credits_synced, 1);
    assertEquals(result.credits_failed, 1);
    assertEquals(calls, 2);
});

Deno.test('runBillingExpiry: błąd RPC mapuje na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => runBillingExpiry({
            graceDays: 3,
            supabaseAdmin: createExpiryClient({
                error: { code: 'XX000', message: 'database unavailable' },
            }),
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});
