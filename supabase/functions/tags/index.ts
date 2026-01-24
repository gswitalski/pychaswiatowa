/**
 * Tags Edge Function
 * Main entry point for the /tags endpoint.
 *
 * Endpoint: GET /functions/v1/tags
 * Returns all tags belonging to the authenticated user.
 */

import { tagsRouter } from './tags.handlers.ts';
import { logger } from '../_shared/logger.ts';
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

/**
 * Main request handler for the tags function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /tags', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
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


