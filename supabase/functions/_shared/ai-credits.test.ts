import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';
import {
    AiCreditsExhaustedError,
    checkAndDeductCredits,
    refundCreditAfterFailure,
} from './ai-credits.ts';

function createRpcClient(params: {
    reservation?: Record<string, unknown>;
    refunded?: boolean;
    onRpc?: (name: string) => void;
}): TypedSupabaseClient {
    return {
        rpc: (name: string) => {
            params.onRpc?.(name);

            if (name === 'reserve_ai_credit') {
                return Promise.resolve({
                    data: params.reservation ?? null,
                    error: null,
                });
            }

            return Promise.resolve({
                data: params.refunded ?? true,
                error: null,
            });
        },
    } as unknown as TypedSupabaseClient;
}

Deno.test('checkAndDeductCredits: admin omija rezerwację', async () => {
    let rpcCalled = false;
    const result = await checkAndDeductCredits({
        supabaseAdmin: createRpcClient({
            onRpc: () => {
                rpcCalled = true;
            },
        }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        creditType: 'draft',
        appRole: 'admin',
    });

    assertEquals(result, { reserved: false, remaining: null });
    assertEquals(rpcCalled, false);
});

Deno.test('checkAndDeductCredits: zwraca saldo po atomowej rezerwacji', async () => {
    const result = await checkAndDeductCredits({
        supabaseAdmin: createRpcClient({
            reservation: {
                allowed: true,
                credits_used: 1,
                credits_total: 3,
                limit_type: 'lifetime',
                next_reset_at: null,
            },
        }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        creditType: 'draft',
        appRole: 'user',
    });

    assertEquals(result, { reserved: true, remaining: 2 });
});

Deno.test('checkAndDeductCredits: zgłasza wyczerpanie kredytów', async () => {
    const error = await assertRejects(
        () => checkAndDeductCredits({
            supabaseAdmin: createRpcClient({
                reservation: {
                    allowed: false,
                    credits_used: 3,
                    credits_total: 3,
                    limit_type: 'lifetime',
                    next_reset_at: null,
                },
            }),
            userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
            creditType: 'draft',
            appRole: 'user',
        }),
        AiCreditsExhaustedError,
    );

    assertEquals(error.statusCode, 402);
    assertEquals(error.details.credits_used, 3);
});

Deno.test('refundCreditAfterFailure: wywołuje RPC zwrotu', async () => {
    let calledRpc = '';
    await refundCreditAfterFailure({
        supabaseAdmin: createRpcClient({
            refunded: true,
            onRpc: (name) => {
                calledRpc = name;
            },
        }),
        userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
        creditType: 'image',
        appRole: 'premium',
    });

    assertEquals(calledRpc, 'refund_ai_credit');
});
