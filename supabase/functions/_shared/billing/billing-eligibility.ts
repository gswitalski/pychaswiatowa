import type { AppRole } from '../auth.ts';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';

export type CheckoutEligibility = 'allowed' | 'forbidden_admin' | 'already_active';

export interface BillingStateSnapshot {
    appRole: AppRole;
    subscription: {
        status: SubscriptionStatus;
        current_period_end: string;
        auto_renew: boolean;
    } | null;
}

export function evaluateCheckoutEligibility(
    state: BillingStateSnapshot,
    now: Date,
): CheckoutEligibility {
    if (state.appRole === 'admin') {
        return 'forbidden_admin';
    }

    if (state.subscription?.status === 'trialing') {
        return 'allowed';
    }

    const hasCurrentPaidPeriod = state.subscription
        && ['active', 'past_due', 'canceled'].includes(state.subscription.status)
        && new Date(state.subscription.current_period_end).getTime() > now.getTime();
    if (hasCurrentPaidPeriod) {
        return 'already_active';
    }

    if (state.appRole === 'premium' && !state.subscription) {
        return 'already_active';
    }

    if (
        state.appRole === 'premium'
        && state.subscription?.status === 'active'
        && state.subscription.auto_renew
    ) {
        return 'already_active';
    }

    return 'allowed';
}
