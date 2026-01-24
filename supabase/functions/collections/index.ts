/**
 * Collections Edge Function
 * Main entry point for the /collections endpoint.
 *
 * Supported endpoints:
 * - GET    /functions/v1/collections                           - List all collections
 * - POST   /functions/v1/collections                           - Create a collection
 * - GET    /functions/v1/collections/{id}                      - Get collection details
 * - PUT    /functions/v1/collections/{id}                      - Update a collection
 * - DELETE /functions/v1/collections/{id}                      - Delete a collection
 * - POST   /functions/v1/collections/{id}/recipes              - Add recipe to collection
 * - DELETE /functions/v1/collections/{collectionId}/recipes/{recipeId} - Remove recipe
 */

import { collectionsRouter } from './collections.handlers.ts';
import { logger } from '../_shared/logger.ts';
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

/**
 * Main request handler for the collections function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /collections', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }

    try {
        // Route the request to the collections router
        const response = await collectionsRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in collections function', {
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
