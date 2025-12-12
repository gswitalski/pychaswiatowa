/**
 * Tags Edge Function
 * Main entry point for the /tags endpoint.
 *
 * Endpoint: GET /functions/v1/tags
 * Returns all tags belonging to the authenticated user.
 */

import { tagsRouter } from './tags.handlers.ts';
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
 *
 * @param response - The original response
 * @returns New response with CORS headers added
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
 * Main request handler for the tags function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /tags', {
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
        // Route the request to the tags router
        const response = await tagsRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in tags function', {
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


