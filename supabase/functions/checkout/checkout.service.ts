import { AppRole } from '../_shared/auth.ts';
import {
    evaluateCheckoutEligibility,
    type BillingStateSnapshot,
    type SubscriptionStatus,
} from '../_shared/billing/billing-eligibility.ts';
import {
    getPriceId,
    getSubscriptionTermsVersion,
} from '../_shared/billing/billing-plans.ts';
import {
    getStripeClient,
    type Stripe,
} from '../_shared/billing/stripe-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    createServiceRoleClient,
    type TypedSupabaseClient,
} from '../_shared/supabase-client.ts';
import type {
    CheckoutSessionResponseDto,
    CreateCheckoutSessionInput,
} from './checkout.types.ts';

const SUBSCRIPTION_STATE_COLUMNS = 'status, current_period_end, auto_renew';

interface CheckoutDependencies {
    supabaseAdmin?: TypedSupabaseClient;
    stripe?: Stripe;
    now?: Date;
}

export interface CheckoutSessionParamsResult {
    params: Stripe.Checkout.SessionCreateParams;
    idempotencyKey: string;
}

function getAppBaseUrl(): string {
    const configuredUrl = Deno.env.get('APP_BASE_URL')?.trim().replace(/\/+$/, '');
    if (!configuredUrl) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing billing configuration: APP_BASE_URL');
    }

    let url: URL;
    try {
        url = new URL(configuredUrl);
    } catch {
        throw new ApplicationError('INTERNAL_ERROR', 'Invalid billing configuration: APP_BASE_URL');
    }

    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) {
        throw new ApplicationError('INTERNAL_ERROR', 'APP_BASE_URL must use HTTPS');
    }

    return configuredUrl;
}

export function buildCheckoutSessionParams(params: {
    userId: string;
    customerId: string;
    command: CreateCheckoutSessionInput;
    priceId: string;
    appBaseUrl: string;
    termsVersion: string;
    now: Date;
}): CheckoutSessionParamsResult {
    const minuteBucket = Math.floor(params.now.getTime() / 60_000);
    const bucketStartMs = minuteBucket * 60_000;
    const expiresAt = Math.floor(bucketStartMs / 1000) + 35 * 60;
    const metadata = {
        user_id: params.userId,
        plan_id: params.command.plan_id,
        payment_method: params.command.payment_method,
        terms_version: params.termsVersion,
        terms_accepted_at: new Date(bucketStartMs).toISOString(),
    };
    const baseParams: Stripe.Checkout.SessionCreateParams = {
        mode: params.command.payment_method === 'card' ? 'subscription' : 'payment',
        payment_method_types: [params.command.payment_method],
        customer: params.customerId,
        client_reference_id: params.userId,
        line_items: [{ price: params.priceId, quantity: 1 }],
        locale: 'pl',
        expires_at: expiresAt,
        success_url: `${params.appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${params.appBaseUrl}/checkout/cancel`,
        metadata,
        ...(params.command.payment_method === 'card'
            ? { subscription_data: { metadata } }
            : {
                invoice_creation: {
                    enabled: true,
                    invoice_data: { metadata },
                },
                payment_intent_data: { metadata },
            }),
    };

    return {
        params: baseParams,
        idempotencyKey:
            `checkout:${params.userId}:${params.command.plan_id}:${params.command.payment_method}:${minuteBucket}`,
    };
}

async function loadBillingState(
    userId: string,
    client: TypedSupabaseClient,
): Promise<BillingStateSnapshot> {
    const [
        { data: userData, error: userError },
        { data: subscriptionData, error: subscriptionError },
    ] = await Promise.all([
        client.auth.admin.getUserById(userId),
        client
            .from('subscriptions')
            .select(SUBSCRIPTION_STATE_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle(),
    ]);

    if (userError || !userData.user) {
        logger.error('[checkout] Failed to load current user role', {
            userId,
            errorMessage: userError?.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to load billing state');
    }

    if (subscriptionError) {
        logger.error('[checkout] Failed to load subscription state', {
            userId,
            errorCode: subscriptionError.code,
            errorMessage: subscriptionError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to load billing state');
    }

    const roleResult = AppRole.safeParse(userData.user.app_metadata?.app_role);
    const subscription = subscriptionData
        ? {
            status: subscriptionData.status as SubscriptionStatus,
            current_period_end: subscriptionData.current_period_end,
            auto_renew: subscriptionData.auto_renew,
        }
        : null;

    return {
        appRole: roleResult.success ? roleResult.data : 'user',
        subscription,
    };
}

async function getOrCreateBillingCustomer(params: {
    userId: string;
    email: string;
    client: TypedSupabaseClient;
    stripe: Stripe;
}): Promise<string> {
    const existingResult = await params.client
        .from('billing_customers')
        .select('provider_customer_id')
        .eq('user_id', params.userId)
        .maybeSingle();

    if (existingResult.error) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to load billing customer');
    }
    if (existingResult.data) {
        return existingResult.data.provider_customer_id;
    }

    const customer = await params.stripe.customers.create({
        email: params.email,
        metadata: { user_id: params.userId },
    }, {
        idempotencyKey: `customer:${params.userId}`,
    });

    const upsertResult = await params.client
        .from('billing_customers')
        .upsert({
            user_id: params.userId,
            provider: 'stripe',
            provider_customer_id: customer.id,
        }, {
            onConflict: 'user_id',
            ignoreDuplicates: true,
        });
    if (upsertResult.error) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to save billing customer');
    }

    const finalResult = await params.client
        .from('billing_customers')
        .select('provider_customer_id')
        .eq('user_id', params.userId)
        .single();
    if (finalResult.error || !finalResult.data) {
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to load billing customer');
    }

    return finalResult.data.provider_customer_id;
}

export async function createCheckoutSession(params: {
    userId: string;
    email: string;
    command: CreateCheckoutSessionInput;
    dependencies?: CheckoutDependencies;
}): Promise<CheckoutSessionResponseDto> {
    const client = params.dependencies?.supabaseAdmin ?? createServiceRoleClient();
    const stripe = params.dependencies?.stripe ?? getStripeClient();
    const now = params.dependencies?.now ?? new Date();
    const state = await loadBillingState(params.userId, client);
    const eligibility = evaluateCheckoutEligibility(state, now);

    if (eligibility === 'forbidden_admin') {
        throw new ApplicationError('FORBIDDEN_ROLE', 'Administrator nie może kupić subskrypcji.');
    }
    if (eligibility === 'already_active') {
        throw new ApplicationError(
            'SUBSCRIPTION_ALREADY_ACTIVE',
            'Subskrypcja Premium jest już aktywna.',
        );
    }

    try {
        const customerId = await getOrCreateBillingCustomer({
            userId: params.userId,
            email: params.email,
            client,
            stripe,
        });
        const sessionInput = buildCheckoutSessionParams({
            userId: params.userId,
            customerId,
            command: params.command,
            priceId: getPriceId(params.command.plan_id, params.command.payment_method),
            appBaseUrl: getAppBaseUrl(),
            termsVersion: getSubscriptionTermsVersion(),
            now,
        });
        const session = await stripe.checkout.sessions.create(
            sessionInput.params,
            { idempotencyKey: sessionInput.idempotencyKey },
        );

        if (!session.url) {
            throw new ApplicationError(
                'PAYMENT_PROVIDER_ERROR',
                'Nie udało się rozpocząć płatności. Spróbuj ponownie.',
            );
        }

        logger.info('[checkout] Session created', {
            userId: params.userId,
            planId: params.command.plan_id,
            paymentMethod: params.command.payment_method,
            sessionId: session.id,
        });

        return {
            checkout_url: session.url,
            session_id: session.id,
            expires_at: new Date(session.expires_at * 1000).toISOString(),
        };
    } catch (error) {
        if (error instanceof ApplicationError) {
            throw error;
        }

        const stripeError = error as {
            type?: string;
            code?: string;
            requestId?: string;
            message?: string;
        };
        logger.error('[checkout] Stripe request failed', {
            userId: params.userId,
            type: stripeError.type,
            code: stripeError.code,
            requestId: stripeError.requestId,
        });
        throw new ApplicationError(
            'PAYMENT_PROVIDER_ERROR',
            'Nie udało się rozpocząć płatności. Spróbuj ponownie.',
        );
    }
}
