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

/**
 * CORS headers for all responses.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
 * Main request handler for the collections function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /collections', {
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
