import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { checkoutRouter } from './checkout.handlers.ts';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req: Request) => {
    const startedAt = Date.now();
    const { method } = req;
    const path = new URL(req.url).pathname;

    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: CORS_HEADERS,
        });
    }

    try {
        const response = await checkoutRouter(req);
        for (const [name, value] of Object.entries(CORS_HEADERS)) {
            response.headers.set(name, value);
        }
        logger.info(`[checkout] ${method} ${path} - ${response.status}`, {
            durationMs: Date.now() - startedAt,
        });
        return response;
    } catch (error) {
        logger.error(`[checkout] ${method} ${path} - Error`, {
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        const response = handleError(error);
        for (const [name, value] of Object.entries(CORS_HEADERS)) {
            response.headers.set(name, value);
        }
        return response;
    }
});
