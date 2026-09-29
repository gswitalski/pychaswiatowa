import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import {
    ApplicationError,
    PlanLimitExceededFreeError,
} from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import {
    PLAN_LIMIT_FREE,
    parsePlanLimitFree,
} from './plan.types.ts';
import {
    addRecipeToPlan,
    checkFreePlanLimit,
} from './plan.service.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function createPlanClient(params: {
    count?: number | null;
    countError?: { message: string } | null;
    onCount?: () => void;
    onRpc?: () => void;
}): TypedSupabaseClient {
    return {
        from: () => ({
            select: () => ({
                eq: () => {
                    params.onCount?.();
                    return Promise.resolve({
                        count: params.count ?? 0,
                        error: params.countError ?? null,
                    });
                },
            }),
        }),
        rpc: () => {
            params.onRpc?.();
            return Promise.resolve({
                data: null,
                error: null,
            });
        },
    } as unknown as TypedSupabaseClient;
}

Deno.test('parsePlanLimitFree: używa wartości dodatniej lub domyślnego limitu', () => {
    assertEquals(parsePlanLimitFree('10'), 10);
    assertEquals(parsePlanLimitFree('abc'), 3);
    assertEquals(parsePlanLimitFree('0'), 3);
    assertEquals(parsePlanLimitFree(undefined), 3);
});

Deno.test('PlanLimitExceededFreeError: zwraca kontrakt błędu 422', () => {
    const error = new PlanLimitExceededFreeError(PLAN_LIMIT_FREE);

    assertEquals(error.statusCode, 422);
    assertEquals(error.toJSON(), {
        error: 'PLAN_LIMIT_EXCEEDED_FREE',
        message: 'Osiągnięto limit pozycji w Moim planie dla konta Free.',
        details: {
            free_limit: PLAN_LIMIT_FREE,
            premium_limit: 50,
            upgrade_url: '/pricing',
        },
    });
});

Deno.test('checkFreePlanLimit: przepuszcza użytkownika poniżej limitu', async () => {
    await checkFreePlanLimit(
        USER_ID,
        createPlanClient({ count: PLAN_LIMIT_FREE - 1 })
    );
});

Deno.test('checkFreePlanLimit: blokuje użytkownika po osiągnięciu limitu', async () => {
    const error = await assertRejects(
        () => checkFreePlanLimit(
            USER_ID,
            createPlanClient({ count: PLAN_LIMIT_FREE })
        ),
        PlanLimitExceededFreeError
    );

    assertEquals(error.details.free_limit, PLAN_LIMIT_FREE);
});

Deno.test('checkFreePlanLimit: mapuje błąd bazy na INTERNAL_ERROR', async () => {
    const error = await assertRejects(
        () => checkFreePlanLimit(
            USER_ID,
            createPlanClient({
                countError: { message: 'Database unavailable' },
            })
        ),
        ApplicationError
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});

Deno.test('addRecipeToPlan: Free przy limicie nie wywołuje RPC', async () => {
    let rpcCalls = 0;
    const client = createPlanClient({
        count: PLAN_LIMIT_FREE,
        onRpc: () => {
            rpcCalls += 1;
        },
    });

    await assertRejects(
        () => addRecipeToPlan(client, USER_ID, 42, 'user', client),
        PlanLimitExceededFreeError
    );

    assertEquals(rpcCalls, 0);
});

for (const appRole of ['premium', 'admin'] as const) {
    Deno.test(`addRecipeToPlan: ${appRole} pomija limit Free`, async () => {
        let countCalls = 0;
        let rpcCalls = 0;
        const client = createPlanClient({
            onCount: () => {
                countCalls += 1;
            },
            onRpc: () => {
                rpcCalls += 1;
            },
        });

        await addRecipeToPlan(client, USER_ID, 42, appRole, client);

        assertEquals(countCalls, 0);
        assertEquals(rpcCalls, 1);
    });
}
