import { ApplicationError, handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { runMonthlyAiCreditsReset } from './ai-credits-monthly-reset.service.ts';

function secretsMatch(received: string | null, expected: string | undefined): boolean {
    if (!received || !expected || received.length !== expected.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < received.length; index++) {
        difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
    }

    return difference === 0;
}

function verifyMonthlyResetSecret(req: Request): void {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const cronSecret = Deno.env.get('AI_CREDITS_CRON_SECRET')
        ?? Deno.env.get('INTERNAL_WORKER_SECRET');

    if (!serviceRoleKey && !cronSecret) {
        logger.error('AI credits monthly reset authentication is not configured');
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Monthly reset authentication not configured',
        );
    }

    const authorization = req.headers.get('authorization');
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
    const receivedCronSecret = req.headers.get('x-cron-secret');

    if (
        secretsMatch(bearerToken, serviceRoleKey)
        || secretsMatch(receivedCronSecret, cronSecret)
    ) {
        return;
    }

    logger.warn('Invalid monthly AI credits reset credentials', {
        hasAuthorization: !!authorization,
        hasCronSecret: !!receivedCronSecret,
    });
    throw new ApplicationError('UNAUTHORIZED', 'Authentication required');
}

/**
 * Handles POST /internal/ai-credits/monthly-reset.
 */
export async function handlePostMonthlyAiCreditsReset(req: Request): Promise<Response> {
    try {
        verifyMonthlyResetSecret(req);
        const result = await runMonthlyAiCreditsReset();

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return handleError(error);
    }
}
