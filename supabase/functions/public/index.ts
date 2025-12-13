/**
 * Public Edge Function
 * Main entry point for the /public endpoint.
 *
 * Endpoint: /functions/v1/public/*
 * Provides anonymous access to public resources (no authentication required).
 *
 * Routes:
 * - GET /public/recipes - Returns paginated list of public recipes
 * - GET /public/recipes/{id} - Returns full details of a single public recipe
 */

import { publicRouter } from './public.handlers.ts';
import { logger } from '../_shared/logger.ts';

/**
 * CORS headers for all responses.
 * Allows anonymous access from any origin.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

/**
 * Adds CORS headers to the response.
 *
 * @param response - The original response
 * @param addCacheHeaders - Whether to add cache-control headers for public content (default: false)
 * @returns New response with CORS headers added
 */
function addCorsHeaders(response: Response, addCacheHeaders = false): Response {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    // Add cache headers for successful responses on public endpoints
    if (addCacheHeaders && response.status === 200) {
        newHeaders.set('Cache-Control', 'public, max-age=60');
    }

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * Main request handler for the public function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    logger.info('Incoming request to /public', {
        method: req.method,
        url: req.url,
        pathname: url.pathname,
    });

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    try {
        // Route the request to the public router
        const response = await publicRouter(req);

        // Add CORS headers and cache headers to the response
        return addCorsHeaders(response, true);
    } catch (error) {
        logger.error('Unhandled error in public function', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
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
