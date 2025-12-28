/**
 * AI Edge Function
 * Main entry point for the /ai endpoint.
 *
 * Supported endpoints:
 * - POST /functions/v1/ai/recipes/draft - Generate recipe draft from text or image using AI
 * - POST /functions/v1/ai/recipes/image - Generate preview image of a recipe dish (premium feature)
 */

import { aiRouter } from './ai.handlers.ts';
import { logger } from '../_shared/logger.ts';
import { createCorsPreflightResponse } from '../_shared/cors.ts';

/**
 * Main request handler for the AI function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /ai', {
        method: req.method,
        url: req.url,
    });

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return createCorsPreflightResponse();
    }

    try {
        // Route the request to the AI router
        // All responses from aiRouter already include CORS headers
        return await aiRouter(req);
    } catch (error) {
        logger.error('Unhandled error in AI function', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
        });

        // This should never happen as aiRouter handles all errors
        // But if it does, ensure we return CORS headers
        const { corsHeaders } = await import('../_shared/cors.ts');
        return new Response(
            JSON.stringify({
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred',
            }),
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders,
                },
            }
        );
    }
});

