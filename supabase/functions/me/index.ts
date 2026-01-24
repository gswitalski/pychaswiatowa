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
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

/**
 * Main request handler for the me function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /me', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
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
