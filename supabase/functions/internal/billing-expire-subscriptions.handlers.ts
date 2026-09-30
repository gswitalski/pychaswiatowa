import { handleError } from '../_shared/errors.ts';
import { verifyInternalSecret } from '../_shared/internal-auth.ts';
import { logger } from '../_shared/logger.ts';
import { runBillingExpiry } from './billing-expire-subscriptions.service.ts';

const DEFAULT_BILLING_EXPIRY_GRACE_DAYS = 3;

export function parseBillingExpiryGraceDays(rawValue: string | undefined): number {
    if (!rawValue) {
        return DEFAULT_BILLING_EXPIRY_GRACE_DAYS;
    }

    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
        logger.warn('[billing-expiry] Invalid grace period, using default', {
            rawValue,
            defaultValue: DEFAULT_BILLING_EXPIRY_GRACE_DAYS,
        });
        return DEFAULT_BILLING_EXPIRY_GRACE_DAYS;
    }

    return parsed;
}

export async function handlePostBillingExpiry(req: Request): Promise<Response> {
    try {
        verifyInternalSecret(req);
        const graceDays = parseBillingExpiryGraceDays(
            Deno.env.get('BILLING_EXPIRY_GRACE_DAYS'),
        );
        const result = await runBillingExpiry({ graceDays });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return handleError(error);
    }
}
