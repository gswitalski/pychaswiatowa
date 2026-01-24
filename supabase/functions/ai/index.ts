/**
 * AI Edge Function
 * Main entry point for the /ai endpoint.
 *
 * Supported endpoints:
 * - POST /functions/v1/ai/recipes/draft - Generate recipe draft from text or image using AI
 * - POST /functions/v1/ai/recipes/image - Generate preview image of a recipe dish (premium feature)
 * - POST /functions/v1/ai/recipes/normalized-ingredients - Normalize ingredients for shopping lists
 */

import { aiRouter } from './ai.handlers.ts';
import { logger } from '../_shared/logger.ts';
import { handleCorsPreflightRequest, addCorsHeaders } from '../_shared/cors.ts';

/**
 * Main request handler for the AI function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /ai', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }

    try {
        // Route the request to the AI router
        const response = await aiRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in AI function', {
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

