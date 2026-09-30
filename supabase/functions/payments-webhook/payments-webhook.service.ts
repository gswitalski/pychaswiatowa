import type { Json } from '../_shared/database.types.ts';
import { syncAiCreditsForRole } from '../_shared/ai-credits-sync.ts';
import {
    addMonthsUtc,
    PLAN_DEFINITIONS,
    resolvePlanFromPriceId,
    type PaymentMethod,
    type PlanId,
} from '../_shared/billing/billing-plans.ts';
import {
    getStripeClient,
    type Stripe,
} from '../_shared/billing/stripe-client.ts';
import { renderPurchaseConfirmation } from '../_shared/email/templates/purchase-confirmation.ts';
import { sendEmail } from '../_shared/email/send-email.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    createServiceRoleClient,
    type TypedSupabaseClient,
} from '../_shared/supabase-client.ts';
import {
    extractInvoiceDocument,
    extractPaymentIntentId,
    extractSubscriptionPeriod,
    resolvePurchase,
} from './stripe-mappers.ts';
import {
    type WebhookProcessingResult,
    WebhookPermanentError,
} from './payments-webhook.types.ts';

type WebhookClaimResult = 'claimed' | 'duplicate_processed' | 'in_progress';
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' ? value as UnknownRecord : null;
}

function objectId(value: unknown): string | null {
    if (typeof value === 'string') {
        return value;
    }
    const record = asRecord(value);
    return typeof record?.id === 'string' ? record.id : null;
}

function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(value);
}

function getAppBaseUrl(): string {
    const value = Deno.env.get('APP_BASE_URL')?.trim().replace(/\/+$/, '');
    if (!value) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing billing configuration: APP_BASE_URL');
    }
    return value;
}

export async function claimWebhookEvent(
    event: Stripe.Event,
    client: TypedSupabaseClient = createServiceRoleClient(),
): Promise<WebhookClaimResult> {
    const { data, error } = await client.rpc('billing_claim_webhook_event', {
        p_event_id: event.id,
        p_type: event.type,
        p_livemode: event.livemode,
    });
    if (error || !data) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to claim webhook event');
    }

    return data as WebhookClaimResult;
}

export async function markWebhookEvent(params: {
    eventId: string;
    status: 'processed' | 'ignored' | 'failed';
    errorMessage?: string | null;
    client?: TypedSupabaseClient;
}): Promise<void> {
    const client = params.client ?? createServiceRoleClient();
    const { error } = await client
        .from('payment_webhook_events')
        .update({
            status: params.status,
            error_message: params.errorMessage?.slice(0, 500) ?? null,
            processed_at: new Date().toISOString(),
        })
        .eq('event_id', params.eventId);

    if (error) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update webhook event');
    }
}

async function retrieveAndValidateSession(params: {
    sessionId: string;
    validatePrice: boolean;
    stripe: Stripe;
    client: TypedSupabaseClient;
}): Promise<Stripe.Checkout.Session> {
    const session = await params.stripe.checkout.sessions.retrieve(params.sessionId, {
        expand: ['line_items', 'payment_intent', 'subscription', 'invoice'],
    });
    const userId = session.metadata?.user_id;

    if (!userId || !isUuid(userId) || userId !== session.client_reference_id) {
        throw new WebhookPermanentError('INVALID_USER_REFERENCE');
    }

    const [authResult, customerResult] = await Promise.all([
        params.client.auth.admin.getUserById(userId),
        params.client
            .from('billing_customers')
            .select('provider_customer_id')
            .eq('user_id', userId)
            .maybeSingle(),
    ]);
    if (authResult.error) {
        throw authResult.error;
    }
    if (!authResult.data.user) {
        throw new WebhookPermanentError('USER_NOT_FOUND');
    }

    if (customerResult.error) {
        throw customerResult.error;
    }
    if (!customerResult.data || customerResult.data.provider_customer_id !== objectId(session.customer)) {
        throw new WebhookPermanentError('CUSTOMER_MISMATCH');
    }

    if (!params.validatePrice) {
        return session;
    }

    const lineItems = session.line_items?.data ?? [];
    const price = lineItems[0]?.price;
    const plan = price?.id ? resolvePlanFromPriceId(price.id) : null;
    if (lineItems.length !== 1 || !price || !plan) {
        throw new WebhookPermanentError('UNKNOWN_PRICE');
    }

    const expected = PLAN_DEFINITIONS[plan.planId].expectedAmountGross;
    if (
        session.currency !== 'pln'
        || session.amount_total !== expected
        || price.unit_amount !== expected
        || session.metadata?.plan_id !== plan.planId
        || session.metadata?.payment_method !== plan.method
    ) {
        logger.error('[billing][CRITICAL] Amount or purchase metadata mismatch', {
            userId,
            sessionId: session.id,
            expected,
            received: session.amount_total,
        });
        throw new WebhookPermanentError('PURCHASE_DETAILS_MISMATCH');
    }

    return session;
}

async function sendPurchaseConfirmationEmail(params: {
    paymentId: number;
    client: TypedSupabaseClient;
}): Promise<void> {
    try {
        const paymentResult = await params.client
            .from('subscription_payments')
            .select(
                'id, user_id, subscription_id, plan_id, payment_method_type, amount_gross, document_url, confirmation_email_sent_at',
            )
            .eq('id', params.paymentId)
            .single();
        if (paymentResult.error || !paymentResult.data) {
            throw new Error('Payment not found');
        }
        if (paymentResult.data.confirmation_email_sent_at) {
            return;
        }

        const [userResult, profileResult, subscriptionResult] = await Promise.all([
            params.client.auth.admin.getUserById(paymentResult.data.user_id),
            params.client
                .from('profiles')
                .select('username')
                .eq('id', paymentResult.data.user_id)
                .single(),
            params.client
                .from('subscriptions')
                .select('current_period_end')
                .eq('id', paymentResult.data.subscription_id ?? '')
                .single(),
        ]);
        const email = userResult.data.user?.email;
        if (!email || profileResult.error || subscriptionResult.error) {
            throw new Error('Purchase confirmation recipient data is incomplete');
        }

        const content = renderPurchaseConfirmation({
            username: profileResult.data.username ?? '',
            planId: paymentResult.data.plan_id as PlanId,
            paymentMethod: paymentResult.data.payment_method_type as PaymentMethod,
            amountGross: paymentResult.data.amount_gross,
            periodEnd: subscriptionResult.data.current_period_end,
            documentUrl: paymentResult.data.document_url,
            appBaseUrl: getAppBaseUrl(),
        });
        const result = await sendEmail({
            to: email,
            ...content,
            idempotencyKey: `purchase-confirmation/${params.paymentId}`,
        });
        if (!result.ok) {
            logger.error('[email] Purchase confirmation failed', {
                paymentId: params.paymentId,
                status: result.status,
            });
            return;
        }

        await params.client
            .from('subscription_payments')
            .update({ confirmation_email_sent_at: new Date().toISOString() })
            .eq('id', params.paymentId);
    } catch (error) {
        logger.error('[email] Purchase confirmation failed', {
            paymentId: params.paymentId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

async function handlePaidCheckoutSession(params: {
    sessionId: string;
    event: Stripe.Event;
    stripe: Stripe;
    client: TypedSupabaseClient;
}): Promise<WebhookProcessingResult> {
    const session = await retrieveAndValidateSession({
        ...params,
        validatePrice: true,
    });
    const purchase = resolvePurchase(session, params.event);
    const { data, error } = await params.client.rpc('billing_activate_premium', {
        p_user_id: purchase.userId,
        p_plan_id: purchase.planId,
        p_payment_method: purchase.paymentMethod,
        p_auto_renew: purchase.autoRenew,
        p_period_start: purchase.periodStart.toISOString(),
        p_period_end: purchase.periodEnd.toISOString(),
        p_provider_subscription_id: purchase.providerSubscriptionId,
        p_payment: purchase.payment as unknown as Json,
    });
    if (error) {
        if (error.message.includes('NOT_FOUND')) {
            throw new WebhookPermanentError('USER_NOT_FOUND');
        }
        throw error;
    }

    const result = asRecord(data);
    if (result?.result === 'duplicate_active_subscription') {
        logger.error('[billing][CRITICAL] Duplicate purchase needs refund', {
            eventId: params.event.id,
            userId: purchase.userId,
            sessionId: session.id,
        });
        throw new WebhookPermanentError('DUPLICATE_PURCHASE_NEEDS_REFUND');
    }

    if (result?.role_skipped_admin === true) {
        logger.warn('[payments-webhook] Admin purchase, role not changed', {
            userId: purchase.userId,
        });
    }
    if (result?.role_changed === true) {
        await syncAiCreditsForRole({
            userId: purchase.userId,
            newRole: 'premium',
            usageMode: 'reset',
            resetAt: addMonthsUtc(new Date(), 1),
        }, params.client);
    } else if (result?.was_trialing === true) {
        await syncAiCreditsForRole({
            userId: purchase.userId,
            newRole: 'premium',
            usageMode: 'keep',
            resetAt: addMonthsUtc(new Date(), 1),
        }, params.client);
    }

    if (typeof result?.payment_id === 'number') {
        await sendPurchaseConfirmationEmail({
            paymentId: result.payment_id,
            client: params.client,
        });
    }

    return 'processed';
}

async function handleFailedCheckoutSession(params: {
    sessionId: string;
    stripe: Stripe;
    client: TypedSupabaseClient;
}): Promise<WebhookProcessingResult> {
    const session = await retrieveAndValidateSession({
        ...params,
        validatePrice: false,
    });
    const planId = session.metadata?.plan_id as PlanId | undefined;
    const method = session.metadata?.payment_method as PaymentMethod | undefined;
    if (!planId || !PLAN_DEFINITIONS[planId] || !method || !['card', 'blik'].includes(method)) {
        throw new WebhookPermanentError('INVALID_FAILED_PAYMENT_METADATA');
    }

    const { error } = await params.client.rpc('billing_record_failed_payment', {
        p_user_id: session.metadata!.user_id!,
        p_payment: {
            plan_id: planId,
            payment_method_type: method,
            amount_gross: session.amount_total ?? 0,
            currency: 'PLN',
            provider_session_id: session.id,
            provider_payment_intent_id: objectId(session.payment_intent),
            provider_invoice_id: objectId(session.invoice),
            terms_version: session.metadata?.terms_version ?? null,
            terms_accepted_at: session.metadata?.terms_accepted_at ?? null,
        },
    });
    if (error) {
        throw error;
    }

    return 'processed';
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const record = asRecord(invoice);
    const direct = objectId(record?.subscription);
    if (direct) {
        return direct;
    }

    const parent = asRecord(record?.parent);
    const details = asRecord(parent?.subscription_details);
    return objectId(details?.subscription);
}

async function handleSubscriptionRenewal(params: {
    invoice: Stripe.Invoice;
    stripe: Stripe;
    client: TypedSupabaseClient;
}): Promise<WebhookProcessingResult> {
    const providerSubscriptionId = getInvoiceSubscriptionId(params.invoice);
    if (!providerSubscriptionId) {
        throw new WebhookPermanentError('MISSING_SUBSCRIPTION_ID');
    }

    const subscription = await params.stripe.subscriptions.retrieve(providerSubscriptionId);
    const period = extractSubscriptionPeriod(subscription);
    const document = extractInvoiceDocument(params.invoice);
    const { data, error } = await params.client.rpc('billing_renew_subscription', {
        p_provider_subscription_id: providerSubscriptionId,
        p_period_start: period.start.toISOString(),
        p_period_end: period.end.toISOString(),
        p_payment: {
            amount_gross: params.invoice.amount_paid,
            currency: (params.invoice.currency ?? 'pln').toUpperCase(),
            provider_session_id: `invoice:${params.invoice.id}`,
            provider_payment_intent_id: extractPaymentIntentId(params.invoice),
            provider_invoice_id: params.invoice.id,
            document_number: document.number,
            document_url: document.url,
            document_pdf_url: document.pdfUrl,
            paid_at: new Date(
                (params.invoice.status_transitions.paid_at ?? params.invoice.created) * 1000,
            )
                .toISOString(),
        },
    });
    if (error) {
        throw error;
    }

    const result = asRecord(data);
    if (result?.role_changed === true && typeof result.user_id === 'string') {
        await syncAiCreditsForRole({
            userId: result.user_id,
            newRole: 'premium',
            usageMode: 'keep',
            resetAt: addMonthsUtc(new Date(), 1),
        }, params.client);
    }

    return 'processed';
}

async function handleInvoiceDocumentBackfill(
    invoice: Stripe.Invoice,
    client: TypedSupabaseClient,
): Promise<WebhookProcessingResult> {
    const document = extractInvoiceDocument(invoice);
    const { data, error } = await client.rpc('billing_attach_invoice_document', {
        p_provider_invoice_id: invoice.id,
        p_number: document.number,
        p_url: document.url,
        p_pdf_url: document.pdfUrl,
    });
    if (error) {
        throw error;
    }

    return data > 0 ? 'processed' : 'ignored';
}

export async function processStripeEvent(params: {
    event: Stripe.Event;
    stripe?: Stripe;
    client?: TypedSupabaseClient;
}): Promise<WebhookProcessingResult> {
    const stripe = params.stripe ?? getStripeClient();
    const client = params.client ?? createServiceRoleClient();
    const eventObject = params.event.data.object;

    switch (params.event.type) {
        case 'checkout.session.completed': {
            const session = eventObject as Stripe.Checkout.Session;
            if (session.payment_status === 'paid') {
                return await handlePaidCheckoutSession({
                    sessionId: session.id,
                    event: params.event,
                    stripe,
                    client,
                });
            }
            if (session.payment_status === 'no_payment_required') {
                logger.warn('[payments-webhook] Checkout required no payment', {
                    eventId: params.event.id,
                });
            }
            return 'ignored';
        }
        case 'checkout.session.async_payment_succeeded':
            return await handlePaidCheckoutSession({
                sessionId: (eventObject as Stripe.Checkout.Session).id,
                event: params.event,
                stripe,
                client,
            });
        case 'checkout.session.async_payment_failed':
            return await handleFailedCheckoutSession({
                sessionId: (eventObject as Stripe.Checkout.Session).id,
                stripe,
                client,
            });
        case 'checkout.session.expired':
            return 'ignored';
        case 'invoice.paid': {
            const invoice = eventObject as Stripe.Invoice;
            const billingReason = invoice.billing_reason;
            if (billingReason === 'subscription_cycle') {
                return await handleSubscriptionRenewal({ invoice, stripe, client });
            }
            return await handleInvoiceDocumentBackfill(invoice, client);
        }
        default:
            return 'ignored';
    }
}
