import {
    getStripeClient,
    isLiveStripeKey,
    stripeCryptoProvider,
} from '../_shared/billing/stripe-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    claimWebhookEvent,
    markWebhookEvent,
    processStripeEvent,
} from './payments-webhook.service.ts';
import { WebhookPermanentError } from './payments-webhook.types.ts';

const MAX_WEBHOOK_BYTES = 512 * 1024;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function handlePostWebhook(req: Request): Promise<Response> {
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_WEBHOOK_BYTES) {
        throw new ApplicationError('PAYLOAD_TOO_LARGE', 'Webhook payload is too large');
    }

    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_WEBHOOK_BYTES) {
        throw new ApplicationError('PAYLOAD_TOO_LARGE', 'Webhook payload is too large');
    }

    const signature = req.headers.get('stripe-signature');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim();
    if (!signature) {
        throw new ApplicationError('INVALID_SIGNATURE', 'Invalid webhook signature');
    }
    if (!webhookSecret) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Stripe webhook configuration');
    }

    const stripe = getStripeClient();
    let event;
    try {
        event = await stripe.webhooks.constructEventAsync(
            rawBody,
            signature,
            webhookSecret,
            undefined,
            stripeCryptoProvider,
        );
    } catch {
        throw new ApplicationError('INVALID_SIGNATURE', 'Invalid webhook signature');
    }

    if (event.livemode !== isLiveStripeKey()) {
        throw new ApplicationError('INVALID_SIGNATURE', 'Invalid webhook mode');
    }

    const claim = await claimWebhookEvent(event);
    if (claim === 'duplicate_processed') {
        return jsonResponse({ received: true, status: 'duplicate' });
    }
    if (claim === 'in_progress') {
        throw new ApplicationError('CONFLICT', 'Webhook event is already being processed');
    }

    logger.info('[payments-webhook] Event claimed', {
        eventId: event.id,
        type: event.type,
    });

    try {
        const status = await processStripeEvent({ event });
        await markWebhookEvent({
            eventId: event.id,
            status,
        });
        return jsonResponse({ received: true, status });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await markWebhookEvent({
            eventId: event.id,
            status: 'failed',
            errorMessage,
        });

        if (error instanceof WebhookPermanentError) {
            logger.error('[billing][CRITICAL] Permanent webhook failure', {
                eventId: event.id,
                type: event.type,
                reason: error.reason,
            });
            return jsonResponse({ received: true, status: 'processed' });
        }

        throw error;
    }
}

export async function paymentsWebhookRouter(req: Request): Promise<Response> {
    const pathname = new URL(req.url).pathname;
    const isWebhookPath = /^\/payments-webhook\/?$/.test(pathname);
    if (!isWebhookPath) {
        throw new ApplicationError('NOT_FOUND', 'Endpoint not found');
    }
    if (req.method !== 'POST') {
        throw new ApplicationError('METHOD_NOT_ALLOWED', 'Method not allowed');
    }

    return await handlePostWebhook(req);
}
