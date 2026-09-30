import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { getBillingPayments } from './billing.service.ts';
import { GetBillingPaymentsQuerySchema } from './billing.types.ts';

export async function handleGetBillingPayments(req: Request): Promise<Response> {
    const { client, user } = await getAuthenticatedContext(req);
    const url = new URL(req.url);
    const validationResult = GetBillingPaymentsQuerySchema.safeParse({
        limit: url.searchParams.get('limit') ?? undefined,
    });

    if (!validationResult.success) {
        const issue = validationResult.error.issues[0];
        throw new ApplicationError('VALIDATION_ERROR', `limit: ${issue.message}`);
    }

    const payments = await getBillingPayments({
        client,
        userId: user.id,
        limit: validationResult.data.limit,
    });

    logger.info('[billing] Payment history fetched', {
        userId: user.id,
        count: payments.length,
    });

    return new Response(JSON.stringify({ data: payments }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function billingRouter(req: Request): Promise<Response> {
    const pathname = new URL(req.url).pathname;
    const pathMatch = pathname.match(/^\/billing(.*)$/);
    const path = pathMatch ? pathMatch[1] : pathname;

    if (/^\/payments\/?$/.test(path)) {
        if (req.method !== 'GET') {
            throw new ApplicationError('METHOD_NOT_ALLOWED', 'Method not allowed');
        }
        return await handleGetBillingPayments(req);
    }

    throw new ApplicationError('NOT_FOUND', 'Endpoint not found');
}
