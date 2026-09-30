import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { getMeProfile } from './me.service.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function createMeClient(params: {
    subscription?: Record<string, unknown> | null;
    subscriptionError?: { code: string; message: string } | null;
    onTable?: (table: string) => void;
} = {}): TypedSupabaseClient {
    return {
        from: (table: string) => {
            params.onTable?.(table);
            const result = table === 'profiles'
                ? {
                    data: { id: USER_ID, username: 'jan' },
                    error: null,
                }
                : table === 'user_ai_credits'
                ? {
                    data: {
                        draft_credits_total: 20,
                        draft_credits_used: 2,
                        image_credits_total: 5,
                        image_credits_used: 1,
                        limit_type: 'monthly',
                        next_reset_at: '2026-10-30T20:00:00.000Z',
                    },
                    error: null,
                }
                : {
                    data: params.subscription ?? null,
                    error: params.subscriptionError ?? null,
                };

            return {
                select: () => ({
                    eq: () => ({
                        single: () => Promise.resolve(result),
                        maybeSingle: () => Promise.resolve(result),
                    }),
                }),
            };
        },
    } as unknown as TypedSupabaseClient;
}

Deno.test('getMeProfile: mapuje aktywną subskrypcję', async () => {
    const result = await getMeProfile(createMeClient({
        subscription: {
            status: 'active',
            plan_id: 'premium_yearly',
            current_period_end: '2027-09-30T20:00:00.000Z',
            auto_renew: true,
            trial_ends_at: null,
        },
    }), USER_ID, 'premium');

    assertEquals(result.subscription_status, 'active');
    assertEquals(result.subscription_plan_id, 'premium_yearly');
    assertEquals(result.auto_renew, true);
});

Deno.test('getMeProfile: brak subskrypcji mapuje pola na null', async () => {
    const result = await getMeProfile(createMeClient(), USER_ID, 'user');

    assertEquals(result.subscription_status, null);
    assertEquals(result.subscription_plan_id, null);
    assertEquals(result.current_period_end, null);
    assertEquals(result.auto_renew, null);
    assertEquals(result.trial_ends_at, null);
});

Deno.test('getMeProfile: admin pomija odczyt subskrypcji', async () => {
    const queriedTables: string[] = [];
    const result = await getMeProfile(createMeClient({
        onTable: (table) => queriedTables.push(table),
    }), USER_ID, 'admin');

    assertEquals(queriedTables.includes('subscriptions'), false);
    assertEquals(result.subscription_status, null);
});

Deno.test('getMeProfile: błąd subskrypcji mapuje na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => getMeProfile(createMeClient({
            subscriptionError: {
                code: 'XX000',
                message: 'database unavailable',
            },
        }), USER_ID, 'user'),
        ApplicationError,
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});
