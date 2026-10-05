import type { SubscriptionPlanId } from '../../../../../shared/contracts/types';

export function calculatePeriodEnd(planId: SubscriptionPlanId, startDate: Date): Date {
    const periodEnd = new Date(startDate);
    if (Number.isNaN(periodEnd.getTime())) {
        return periodEnd;
    }

    const monthsToAdd = planId === 'premium_yearly' ? 12 : 1;
    const originalDay = periodEnd.getDate();

    periodEnd.setDate(1);
    periodEnd.setMonth(periodEnd.getMonth() + monthsToAdd);

    const lastDayOfTargetMonth = new Date(
        periodEnd.getFullYear(),
        periodEnd.getMonth() + 1,
        0,
    ).getDate();
    periodEnd.setDate(Math.min(originalDay, lastDayOfTargetMonth));

    return periodEnd;
}
