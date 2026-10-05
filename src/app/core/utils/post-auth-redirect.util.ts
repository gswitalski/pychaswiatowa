import type {
    SubscriptionPaymentMethod,
    SubscriptionPlanId,
} from '../../../../shared/contracts/types';

export const POST_AUTH_ALLOWED_PATHS = ['/checkout'] as const;

const ALLOWED_PLAN_IDS: readonly SubscriptionPlanId[] = ['premium_monthly', 'premium_yearly'];
const ALLOWED_PAYMENT_METHODS: readonly SubscriptionPaymentMethod[] = ['card', 'blik'];

export function sanitizeNextUrl(raw: string | null | undefined): string | null {
    if (
        !raw ||
        !raw.startsWith('/') ||
        raw.startsWith('//') ||
        raw.includes('://') ||
        raw.includes('\\')
    ) {
        return null;
    }

    try {
        const parsed = new URL(raw, 'http://localhost');
        if (
            !POST_AUTH_ALLOWED_PATHS.includes(
                parsed.pathname as (typeof POST_AUTH_ALLOWED_PATHS)[number],
            )
        ) {
            return null;
        }

        const safeQuery = new URLSearchParams();
        const plan = parsed.searchParams.get('plan');
        const method = parsed.searchParams.get('method');

        if (ALLOWED_PLAN_IDS.includes(plan as SubscriptionPlanId)) {
            safeQuery.set('plan', plan as SubscriptionPlanId);
        }

        if (ALLOWED_PAYMENT_METHODS.includes(method as SubscriptionPaymentMethod)) {
            safeQuery.set('method', method as SubscriptionPaymentMethod);
        }

        const query = safeQuery.toString();
        return query ? `${parsed.pathname}?${query}` : parsed.pathname;
    } catch {
        return null;
    }
}
