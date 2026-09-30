import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { buildCheckoutSessionParams } from './checkout.service.ts';

const baseInput = {
    userId: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
    customerId: 'cus_test',
    priceId: 'price_test',
    appBaseUrl: 'https://pychaswiatowa.pl',
    termsVersion: 'subscription-terms-pl-v1',
};

Deno.test('checkout params: karta tworzy subskrypcję', () => {
    const result = buildCheckoutSessionParams({
        ...baseInput,
        command: {
            plan_id: 'premium_monthly',
            payment_method: 'card',
            accepted_terms: true,
            accepted_digital_content_waiver: true,
        },
        now: new Date('2026-09-30T20:00:59.999Z'),
    });

    assertEquals(result.params.mode, 'subscription');
    assertEquals(result.params.payment_method_types, ['card']);
    assertEquals(result.params.subscription_data?.metadata?.plan_id, 'premium_monthly');
    assertEquals(result.params.invoice_creation, undefined);
});

Deno.test('checkout params: BLIK tworzy płatność jednorazową z fakturą', () => {
    const result = buildCheckoutSessionParams({
        ...baseInput,
        command: {
            plan_id: 'premium_yearly',
            payment_method: 'blik',
            accepted_terms: true,
            accepted_digital_content_waiver: true,
        },
        now: new Date('2026-09-30T20:00:00.000Z'),
    });

    assertEquals(result.params.mode, 'payment');
    assertEquals(result.params.payment_method_types, ['blik']);
    assertEquals(result.params.invoice_creation?.enabled, true);
    assertEquals(result.params.payment_intent_data?.metadata?.plan_id, 'premium_yearly');
});

Deno.test('checkout params: są identyczne w obrębie tej samej minuty', () => {
    const command = {
        plan_id: 'premium_yearly',
        payment_method: 'card',
        accepted_terms: true,
        accepted_digital_content_waiver: true,
    } as const;
    const first = buildCheckoutSessionParams({
        ...baseInput,
        command,
        now: new Date('2026-09-30T20:00:00.000Z'),
    });
    const second = buildCheckoutSessionParams({
        ...baseInput,
        command,
        now: new Date('2026-09-30T20:00:59.999Z'),
    });

    assertEquals(first, second);
    assertEquals(
        first.params.expires_at! - Math.floor(new Date('2026-09-30T20:00:59.999Z').getTime() / 1000),
        2041,
    );
    assertEquals(
        first.params.success_url,
        'https://pychaswiatowa.pl/checkout/success?session_id={CHECKOUT_SESSION_ID}',
    );
});
