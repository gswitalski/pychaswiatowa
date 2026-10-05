import type { SubscriptionPlanId, SubscriptionStatus } from '../../../../shared/contracts/types';

/** Migawka subskrypcji z GET /me. */
export interface SubscriptionSnapshot {
    status: SubscriptionStatus | null;
    planId: SubscriptionPlanId | null;
    currentPeriodEnd: Date | null;
    autoRenew: boolean | null;
    trialEndsAt: Date | null;
}
