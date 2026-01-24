/**
 * Categories Edge Function
 * Main entry point for the /categories endpoint.
 *
 * Endpoint: GET /functions/v1/categories
 * Returns all predefined recipe categories.
 */

import { categoriesRouter } from './categories.handlers.ts';
import { logger } from '../_shared/logger.ts';
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

/**
 * Main request handler for the categories function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /categories', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }

    try {
        // Route the request to the categories router
        const response = await categoriesRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in categories function', {
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


