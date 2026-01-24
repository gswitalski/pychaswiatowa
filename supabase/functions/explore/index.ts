/**
 * Explore Edge Function
 * Main entry point for the /explore endpoint.
 *
 * Endpoint: /functions/v1/explore/*
 * Provides access to public and author-owned recipes with optional authentication.
 *
 * Routes:
 * - GET /explore/recipes/{id} - Returns full details of a single recipe (public or author-owned)
 */

import { exploreRouter } from './explore.handlers.ts';
import { logger } from '../_shared/logger.ts';

/**
 * CORS headers for all responses.
 * Allows access from any origin with optional authentication.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, apikey, x-client-info',
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
 * Main request handler for the explore function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    logger.info('Incoming request to /explore', {
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
        // Route the request to the explore router
        const response = await exploreRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in explore function', {
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
