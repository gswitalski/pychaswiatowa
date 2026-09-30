import { ApplicationError } from '../errors.ts';

export type PlanId = 'premium_monthly' | 'premium_yearly';
export type PaymentMethod = 'card' | 'blik';

export interface PlanDefinition {
    months: 1 | 12;
    /** Expected gross amount in grosze. Must stay consistent with pricing.config.ts. */
    expectedAmountGross: number;
}

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
    premium_monthly: { months: 1, expectedAmountGross: 2400 },
    premium_yearly: { months: 12, expectedAmountGross: 16900 },
};

export function getPriceEnvName(planId: PlanId, method: PaymentMethod): string {
    const period = planId === 'premium_monthly' ? 'MONTHLY' : 'YEARLY';
    const priceType = method === 'card' ? 'RECURRING' : 'ONETIME';
    return `STRIPE_PRICE_PREMIUM_${period}_${priceType}`;
}

export function getPriceId(planId: PlanId, method: PaymentMethod): string {
    const envName = getPriceEnvName(planId, method);
    const priceId = Deno.env.get(envName)?.trim();

    if (!priceId) {
        throw new ApplicationError('INTERNAL_ERROR', `Missing billing configuration: ${envName}`);
    }

    return priceId;
}

export function resolvePlanFromPriceId(
    priceId: string,
): { planId: PlanId; method: PaymentMethod } | null {
    const planIds = Object.keys(PLAN_DEFINITIONS) as PlanId[];
    const methods: PaymentMethod[] = ['card', 'blik'];

    for (const planId of planIds) {
        for (const method of methods) {
            const configuredPriceId = Deno.env.get(getPriceEnvName(planId, method))?.trim();
            if (configuredPriceId && configuredPriceId === priceId) {
                return { planId, method };
            }
        }
    }

    return null;
}

export function getSubscriptionTermsVersion(): string {
    const termsVersion = Deno.env.get('SUBSCRIPTION_TERMS_VERSION')?.trim();
    if (!termsVersion) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Missing billing configuration: SUBSCRIPTION_TERMS_VERSION',
        );
    }

    return termsVersion;
}

/** Adds calendar months in UTC, clamping the day to the target month's final day. */
export function addMonthsUtc(date: Date, months: number): Date {
    const result = new Date(date.getTime());
    const originalDay = result.getUTCDate();

    result.setUTCDate(1);
    result.setUTCMonth(result.getUTCMonth() + months);
    const targetMonthLastDay = new Date(Date.UTC(
        result.getUTCFullYear(),
        result.getUTCMonth() + 1,
        0,
    )).getUTCDate();
    result.setUTCDate(Math.min(originalDay, targetMonthLastDay));

    return result;
}
