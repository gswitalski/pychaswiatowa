import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';
import {
    getFreeDraftCredits,
    getPremiumDraftCredits,
    getPremiumImageCredits,
} from './ai-credits.ts';
import { syncAiCreditsForRole } from './ai-credits-sync.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';
const NOW = new Date('2026-09-30T20:00:00.000Z');

function createCreditsClient(params: {
    currentUsage?: {
        draft_credits_used: number;
        image_credits_used: number;
    } | null;
    readError?: { code: string; message: string } | null;
    upsertError?: { code: string; message: string } | null;
} = {}): {
    client: TypedSupabaseClient;
    getUpsertPayload: () => Record<string, unknown> | null;
    getFromCalls: () => number;
} {
    let upsertPayload: Record<string, unknown> | null = null;
    let fromCalls = 0;

    const client = {
        from: () => {
            fromCalls += 1;

            return {
                select: () => ({
                    eq: () => ({
                        maybeSingle: () => Promise.resolve({
                            data: params.currentUsage ?? null,
                            error: params.readError ?? null,
                        }),
                    }),
                }),
                upsert: (payload: Record<string, unknown>) => {
                    upsertPayload = payload;
                    return Promise.resolve({
                        data: null,
                        error: params.upsertError ?? null,
                    });
                },
            };
        },
    } as unknown as TypedSupabaseClient;

    return {
        client,
        getUpsertPayload: () => upsertPayload,
        getFromCalls: () => fromCalls,
    };
}

Deno.test('syncAiCreditsForRole: resetuje pulę Premium', async () => {
    const fake = createCreditsClient();
    const resetAt = new Date('2026-10-31T20:00:00.000Z');

    await syncAiCreditsForRole({
        userId: USER_ID,
        newRole: 'premium',
        resetAt,
        now: NOW,
    }, fake.client);

    assertEquals(fake.getUpsertPayload(), {
        user_id: USER_ID,
        draft_credits_total: getPremiumDraftCredits(),
        draft_credits_used: 0,
        image_credits_total: getPremiumImageCredits(),
        image_credits_used: 0,
        limit_type: 'monthly',
        next_reset_at: resetAt.toISOString(),
        credits_activated_at: NOW.toISOString(),
    });
});

Deno.test('syncAiCreditsForRole: resetuje pulę Free bez terminu odnowienia', async () => {
    const fake = createCreditsClient();

    await syncAiCreditsForRole({
        userId: USER_ID,
        newRole: 'user',
        now: NOW,
    }, fake.client);

    assertEquals(fake.getUpsertPayload(), {
        user_id: USER_ID,
        draft_credits_total: getFreeDraftCredits(),
        draft_credits_used: 0,
        image_credits_total: 0,
        image_credits_used: 0,
        limit_type: 'lifetime',
        next_reset_at: null,
        credits_activated_at: NOW.toISOString(),
    });
});

Deno.test('syncAiCreditsForRole: tryb keep zachowuje i ogranicza zużycie', async () => {
    const fake = createCreditsClient({
        currentUsage: {
            draft_credits_used: 100,
            image_credits_used: 4,
        },
    });

    await syncAiCreditsForRole({
        userId: USER_ID,
        newRole: 'user',
        usageMode: 'keep',
        now: NOW,
    }, fake.client);

    const payload = fake.getUpsertPayload();
    assertEquals(payload?.draft_credits_used, getFreeDraftCredits());
    assertEquals(payload?.image_credits_used, 0);
});

Deno.test('syncAiCreditsForRole: tryb keep bez wiersza zachowuje się jak reset', async () => {
    const fake = createCreditsClient({ currentUsage: null });

    await syncAiCreditsForRole({
        userId: USER_ID,
        newRole: 'premium',
        usageMode: 'keep',
        now: NOW,
    }, fake.client);

    const payload = fake.getUpsertPayload();
    assertEquals(payload?.draft_credits_used, 0);
    assertEquals(payload?.image_credits_used, 0);
});

Deno.test('syncAiCreditsForRole: admin nie odczytuje ani nie zapisuje puli', async () => {
    const fake = createCreditsClient();

    await syncAiCreditsForRole({
        userId: USER_ID,
        newRole: 'admin',
        now: NOW,
    }, fake.client);

    assertEquals(fake.getFromCalls(), 0);
    assertEquals(fake.getUpsertPayload(), null);
});
