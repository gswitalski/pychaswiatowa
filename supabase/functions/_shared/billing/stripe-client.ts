import Stripe from 'npm:stripe@22.6.2';
import { ApplicationError } from '../errors.ts';

export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
    if (cachedClient) {
        return cachedClient;
    }

    const apiKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim();
    if (!apiKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Stripe configuration');
    }

    cachedClient = new Stripe(apiKey, {
        apiVersion: STRIPE_API_VERSION,
        httpClient: Stripe.createFetchHttpClient(),
        maxNetworkRetries: 2,
        timeout: 10_000,
    });

    return cachedClient;
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();

export function isLiveStripeKey(): boolean {
    const apiKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim() ?? '';
    return apiKey.startsWith('sk_live_') || apiKey.startsWith('rk_live_');
}

export type { Stripe };
