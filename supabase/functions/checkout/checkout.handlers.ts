import { ApplicationError, RateLimitedError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { createCheckoutSession } from './checkout.service.ts';
import { CreateCheckoutSessionSchema } from './checkout.types.ts';

export async function handlePostCheckoutSession(req: Request): Promise<Response> {
    const { client, user } = await getAuthenticatedContext(req);

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        throw new ApplicationError('VALIDATION_ERROR', 'Niepoprawny JSON żądania.');
    }

    const validationResult = CreateCheckoutSessionSchema.safeParse(body);
    if (!validationResult.success) {
        const issue = validationResult.error.issues[0];
        throw new ApplicationError(
            'VALIDATION_ERROR',
            `${issue.path.join('.') || 'body'}: ${issue.message}`,
        );
    }

    try {
        const { data, error } = await client.rpc('ai_rate_limit_hit', {
            p_key: 'checkout_session',
            p_window_seconds: 60,
            p_limit: 5,
            p_now: new Date().toISOString(),
        });
        if (error) {
            throw error;
        }

        const rateLimit = data?.[0];
        if (rateLimit && !rateLimit.allowed) {
            throw new RateLimitedError(rateLimit.retry_after_seconds);
        }
    } catch (error) {
        if (error instanceof RateLimitedError) {
            throw error;
        }

        logger.warn('[checkout] Rate limit RPC failed, failing open', {
            userId: user.id,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
    }

    if (!user.email) {
        throw new ApplicationError('INTERNAL_ERROR', 'Authenticated user has no email address');
    }

    const result = await createCheckoutSession({
        userId: user.id,
        email: user.email,
        command: validationResult.data,
    });

    return new Response(JSON.stringify(result), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function checkoutRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const pathMatch = url.pathname.match(/^\/checkout(.*)$/);
    const path = pathMatch ? pathMatch[1] : url.pathname;

    if (path === '/sessions') {
        if (req.method !== 'POST') {
            throw new ApplicationError('METHOD_NOT_ALLOWED', 'Method not allowed');
        }

        return await handlePostCheckoutSession(req);
    }

    throw new ApplicationError('NOT_FOUND', 'Endpoint not found');
}
