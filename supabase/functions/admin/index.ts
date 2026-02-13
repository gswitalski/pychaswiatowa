/**
 * Edge Function: admin
 * Main entry point for admin-only endpoints.
 */

import { adminRouter } from './admin.handlers.ts';
import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function addCorsHeaders(response: Response): Response {
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        headers.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
    });
}

Deno.serve(async (req: Request): Promise<Response> => {
    const { method, url } = req;
    const pathname = new URL(url).pathname;

    logger.info('[admin] Incoming request', { method, pathname });

    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        const response = await adminRouter(req);
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('[admin] Unhandled error', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return addCorsHeaders(handleError(error));
    }
});
