/**
 * Me Edge Function
 * Main entry point for the /me endpoint.
 *
 * Endpoint: GET /functions/v1/me
 * Returns the authenticated user's minimal profile data (id and username).
 * This endpoint is used for App Shell initialization on public routes.
 */

import { meRouter } from './me.handlers.ts';
import { logger } from '../_shared/logger.ts';

/**
 * CORS headers for all responses.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Adds CORS headers to the response.
 */
function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * Main request handler for the me function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /me', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        // Route the request to the me router
        const response = await meRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in me function', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        return addCorsHeaders(
            new Response(
                JSON.stringify({
                    code: 'INTERNAL_ERROR',
                    message: 'An unexpected error occurred',
                }),
                {
                    status: 500,
                    headers: { 'Content-Type': 'application/json' },
                }
            )
        );
    }
});
