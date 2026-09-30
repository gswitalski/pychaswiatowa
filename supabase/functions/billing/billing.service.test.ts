import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { assertRejects } from 'https://deno.land/std@0.224.0/assert/assert_rejects.ts';
import { ApplicationError } from '../_shared/errors.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { getBillingPayments } from './billing.service.ts';
import { GetBillingPaymentsQuerySchema } from './billing.types.ts';

const USER_ID = '5fb3646f-8980-4afb-aeb1-8a4e5fa58212';

function createBillingClient(params: {
    data?: Record<string, unknown>[];
    error?: { code: string; message: string } | null;
}): {
    client: TypedSupabaseClient;
    getUserFilter: () => string | null;
    getLimit: () => number | null;
} {
    let userFilter: string | null = null;
    let appliedLimit: number | null = null;
    const query = {
        eq: (_column: string, value: string) => {
            userFilter = value;
            return query;
        },
        order: () => query,
        limit: (value: number) => {
            appliedLimit = value;
            return Promise.resolve({
                data: params.data ?? [],
                error: params.error ?? null,
            });
        },
    };

    return {
        client: {
            from: () => ({
                select: () => query,
            }),
        } as unknown as TypedSupabaseClient,
        getUserFilter: () => userFilter,
        getLimit: () => appliedLimit,
    };
}

Deno.test('billing service: filtruje właściciela, limituje i mapuje DTO', async () => {
    const fake = createBillingClient({
        data: [{
            id: 12,
            plan_id: 'premium_yearly',
            payment_method_type: 'card',
            amount_gross: 16900,
            currency: 'PLN',
            status: 'paid',
            paid_at: '2026-09-30T19:41:12.000Z',
            document_number: 'PYCH-12',
            document_url: 'https://invoice.example/12',
            document_pdf_url: null,
        }],
    });

    const result = await getBillingPayments({
        client: fake.client,
        userId: USER_ID,
        limit: 20,
    });

    assertEquals(result.length, 1);
    assertEquals(result[0].currency, 'PLN');
    assertEquals(fake.getUserFilter(), USER_ID);
    assertEquals(fake.getLimit(), 20);
});

Deno.test('billing service: błąd bazy mapuje na INTERNAL_ERROR', async () => {
    const fake = createBillingClient({
        error: { code: 'XX000', message: 'database unavailable' },
    });
    const error = await assertRejects(
        () => getBillingPayments({
            client: fake.client,
            userId: USER_ID,
            limit: 20,
        }),
        ApplicationError,
    );

    assertEquals(error.code, 'INTERNAL_ERROR');
});

Deno.test('billing query: domyślny i maksymalny limit', () => {
    assertEquals(GetBillingPaymentsQuerySchema.parse({}).limit, 20);
    assertEquals(GetBillingPaymentsQuerySchema.parse({ limit: '50' }).limit, 50);
});

for (const limit of ['0', '51', 'abc']) {
    Deno.test(`billing query: odrzuca limit ${limit}`, () => {
        assertEquals(GetBillingPaymentsQuerySchema.safeParse({ limit }).success, false);
    });
}
