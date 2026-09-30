import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import type { Stripe } from '../_shared/billing/stripe-client.ts';
import {
    extractInvoiceDocument,
    extractPaymentIntentId,
    extractSubscriptionPeriod,
    resolvePurchase,
} from './stripe-mappers.ts';

Deno.test('stripe mappers: odczytuje okres z elementu subskrypcji', () => {
    const period = extractSubscriptionPeriod({
        items: {
            data: [{
                current_period_start: 1_780_272_000,
                current_period_end: 1_782_864_000,
            }],
        },
    });

    assertEquals(period.start.toISOString(), '2026-06-01T00:00:00.000Z');
    assertEquals(period.end.toISOString(), '2026-07-01T00:00:00.000Z');
});

Deno.test('stripe mappers: odczytuje PaymentIntent i dokument faktury', () => {
    const invoice = {
        id: 'in_1',
        payment_intent: { id: 'pi_1' },
        number: 'PYCH-1',
        hosted_invoice_url: 'https://invoice.example/1',
        invoice_pdf: 'https://invoice.example/1.pdf',
    };

    assertEquals(extractPaymentIntentId(invoice), 'pi_1');
    assertEquals(extractInvoiceDocument(invoice), {
        id: 'in_1',
        number: 'PYCH-1',
        url: 'https://invoice.example/1',
        pdfUrl: 'https://invoice.example/1.pdf',
    });
});

Deno.test('stripe mappers: mapuje opłaconą sesję BLIK', () => {
    const envName = 'STRIPE_PRICE_PREMIUM_MONTHLY_ONETIME';
    const previous = Deno.env.get(envName);
    try {
        Deno.env.set(envName, 'price_blik_monthly');
        const session = {
            id: 'cs_1',
            amount_total: 2400,
            payment_intent: 'pi_1',
            invoice: null,
            subscription: null,
            metadata: {
                user_id: '5fb3646f-8980-4afb-aeb1-8a4e5fa58212',
                terms_version: 'v1',
                terms_accepted_at: '2026-09-30T20:00:00.000Z',
            },
            line_items: {
                data: [{
                    price: {
                        id: 'price_blik_monthly',
                        unit_amount: 2400,
                    },
                }],
            },
        } as unknown as Stripe.Checkout.Session;
        const event = {
            created: 1_759_348_800,
        } as Stripe.Event;

        const purchase = resolvePurchase(session, event);

        assertEquals(purchase.paymentMethod, 'blik');
        assertEquals(purchase.autoRenew, false);
        assertEquals(purchase.periodStart.toISOString(), '2025-10-01T20:00:00.000Z');
        assertEquals(purchase.periodEnd.toISOString(), '2025-11-01T20:00:00.000Z');
        assertEquals(purchase.payment.provider_payment_intent_id, 'pi_1');
    } finally {
        if (previous === undefined) {
            Deno.env.delete(envName);
        } else {
            Deno.env.set(envName, previous);
        }
    }
});
