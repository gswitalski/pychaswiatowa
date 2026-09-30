import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { billingRouter } from './billing.handlers.ts';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
    'Access-Control-Max-Age': '86400',
};

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
        const response = await billingRouter(req);
        for (const [name, value] of Object.entries(CORS_HEADERS)) {
            response.headers.set(name, value);
        }
        return response;
    } catch (error) {
        logger.error('[billing] Request failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        const response = handleError(error);
        for (const [name, value] of Object.entries(CORS_HEADERS)) {
            response.headers.set(name, value);
        }
        return response;
    }
});
