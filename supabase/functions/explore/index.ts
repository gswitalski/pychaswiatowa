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
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

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
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
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
