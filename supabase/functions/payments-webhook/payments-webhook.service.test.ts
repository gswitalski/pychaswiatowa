import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import type { Stripe } from '../_shared/billing/stripe-client.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { processStripeEvent } from './payments-webhook.service.ts';

const unusedStripe = {} as Stripe;
const unusedClient = {} as TypedSupabaseClient;

Deno.test('payments webhook service: ignoruje nieobsługiwane zdarzenie', async () => {
    const result = await processStripeEvent({
        event: {
            type: 'customer.updated',
            data: { object: {} },
        } as Stripe.Event,
        stripe: unusedStripe,
        client: unusedClient,
    });

    assertEquals(result, 'ignored');
});

Deno.test('payments webhook service: ignoruje wygaśniętą sesję', async () => {
    const result = await processStripeEvent({
        event: {
            type: 'checkout.session.expired',
            data: { object: { id: 'cs_expired' } },
        } as Stripe.Event,
        stripe: unusedStripe,
        client: unusedClient,
    });

    assertEquals(result, 'ignored');
});

Deno.test('payments webhook service: uzupełnia dokument pierwszej faktury', async () => {
    let calledFunction = '';
    const client = {
        rpc: (functionName: string) => {
            calledFunction = functionName;
            return Promise.resolve({ data: 1, error: null });
        },
    } as unknown as TypedSupabaseClient;
    const result = await processStripeEvent({
        event: {
            type: 'invoice.paid',
            data: {
                object: {
                    id: 'in_1',
                    billing_reason: 'subscription_create',
                    number: 'PYCH-1',
                    hosted_invoice_url: 'https://invoice.example/1',
                    invoice_pdf: 'https://invoice.example/1.pdf',
                },
            },
        } as Stripe.Event,
        stripe: unusedStripe,
        client,
    });

    assertEquals(result, 'processed');
    assertEquals(calledFunction, 'billing_attach_invoice_document');
});
