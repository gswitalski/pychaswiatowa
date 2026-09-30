import {
    addMonthsUtc,
    PLAN_DEFINITIONS,
    resolvePlanFromPriceId,
} from '../_shared/billing/billing-plans.ts';
import type { Stripe } from '../_shared/billing/stripe-client.ts';
import {
    type ResolvedPurchase,
    WebhookPermanentError,
} from './payments-webhook.types.ts';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' ? value as UnknownRecord : null;
}

function extractObjectId(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }

    const record = asRecord(value);
    return typeof record?.id === 'string' ? record.id : null;
}

export function extractSubscriptionPeriod(
    subscription: unknown,
): { start: Date; end: Date } {
    const record = asRecord(subscription);
    const items = asRecord(record?.items);
    const itemData = Array.isArray(items?.data) ? items.data : [];
    const firstItem = asRecord(itemData[0]);
    const start = record?.current_period_start ?? firstItem?.current_period_start;
    const end = record?.current_period_end ?? firstItem?.current_period_end;

    if (typeof start !== 'number' || typeof end !== 'number') {
        throw new WebhookPermanentError('INVALID_SUBSCRIPTION_PERIOD');
    }

    return {
        start: new Date(start * 1000),
        end: new Date(end * 1000),
    };
}

export function extractPaymentIntentId(invoice: unknown): string | null {
    const record = asRecord(invoice);
    const directId = extractObjectId(record?.payment_intent);
    if (directId) {
        return directId;
    }

    const payments = asRecord(record?.payments);
    const paymentRows = Array.isArray(payments?.data) ? payments.data : [];
    for (const row of paymentRows) {
        const payment = asRecord(asRecord(row)?.payment);
        const paymentIntentId = extractObjectId(payment?.payment_intent);
        if (paymentIntentId) {
            return paymentIntentId;
        }
    }

    return null;
}

export function extractInvoiceDocument(invoice: unknown): {
    id: string | null;
    number: string | null;
    url: string | null;
    pdfUrl: string | null;
} {
    const record = asRecord(invoice);
    return {
        id: extractObjectId(invoice),
        number: typeof record?.number === 'string' ? record.number : null,
        url: typeof record?.hosted_invoice_url === 'string' ? record.hosted_invoice_url : null,
        pdfUrl: typeof record?.invoice_pdf === 'string' ? record.invoice_pdf : null,
    };
}

export function resolvePurchase(
    session: Stripe.Checkout.Session,
    event: Stripe.Event,
): ResolvedPurchase {
    const lineItems = asRecord(session.line_items);
    const rows = Array.isArray(lineItems?.data) ? lineItems.data : [];
    const firstRow = asRecord(rows[0]);
    const price = asRecord(firstRow?.price);
    const priceId = extractObjectId(firstRow?.price);
    const plan = priceId ? resolvePlanFromPriceId(priceId) : null;
    if (!plan) {
        throw new WebhookPermanentError('UNKNOWN_PRICE');
    }

    const userId = session.metadata?.user_id;
    if (!userId) {
        throw new WebhookPermanentError('MISSING_USER_ID');
    }

    const invoice = asRecord(session.invoice);
    const document = extractInvoiceDocument(invoice);
    const paidAt = new Date(event.created * 1000);
    let periodStart = paidAt;
    let periodEnd = addMonthsUtc(paidAt, PLAN_DEFINITIONS[plan.planId].months);
    let providerSubscriptionId: string | null = null;
    let providerPaymentIntentId = extractObjectId(session.payment_intent);

    if (plan.method === 'card') {
        const period = extractSubscriptionPeriod(session.subscription);
        periodStart = period.start;
        periodEnd = period.end;
        providerSubscriptionId = extractObjectId(session.subscription);
        providerPaymentIntentId = extractPaymentIntentId(invoice);
    }

    const amount = session.amount_total ?? price?.unit_amount;
    if (typeof amount !== 'number') {
        throw new WebhookPermanentError('MISSING_PAYMENT_AMOUNT');
    }

    return {
        userId,
        planId: plan.planId,
        paymentMethod: plan.method,
        autoRenew: plan.method === 'card',
        periodStart,
        periodEnd,
        providerSubscriptionId,
        payment: {
            amount_gross: amount,
            currency: 'PLN',
            provider_session_id: session.id,
            provider_payment_intent_id: providerPaymentIntentId,
            provider_invoice_id: document.id,
            document_number: document.number,
            document_url: document.url,
            document_pdf_url: document.pdfUrl,
            terms_version: session.metadata?.terms_version ?? null,
            terms_accepted_at: session.metadata?.terms_accepted_at ?? null,
            paid_at: paidAt.toISOString(),
        },
    };
}
