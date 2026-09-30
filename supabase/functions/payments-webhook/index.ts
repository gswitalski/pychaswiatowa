import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { paymentsWebhookRouter } from './payments-webhook.handlers.ts';

Deno.serve(async (req: Request) => {
    const startedAt = Date.now();
    const { method } = req;
    const path = new URL(req.url).pathname;

    try {
        const response = await paymentsWebhookRouter(req);
        logger.info(`[payments-webhook] ${method} ${path} - ${response.status}`, {
            durationMs: Date.now() - startedAt,
        });
        return response;
    } catch (error) {
        logger.error(`[payments-webhook] ${method} ${path} - Error`, {
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return handleError(error);
    }
});
