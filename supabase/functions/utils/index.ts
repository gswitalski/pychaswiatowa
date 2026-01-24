/**
 * Edge Function: utils
 * 
 * Provides utility endpoints for common operations:
 * - POST /slugify - Generate URL-safe slug from text
 * 
 * This is a public function (no authentication required).
 */

import { logger } from '../_shared/logger.ts';
import { handleError } from '../_shared/errors.ts';
import { slugifyRouter } from './utils.handlers.ts';
import { handleCorsPreflightRequest, corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // Handle CORS preflight
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }

    try {
        logger.info('Utils request received', {
            method: req.method,
            pathname,
        });

        // Route to appropriate handler
        const response = await slugifyRouter(req, pathname);

        if (response) {
            // Add CORS headers to successful response
            const headers = new Headers(response.headers);
            Object.entries(corsHeaders).forEach(([key, value]) => {
                headers.set(key, value);
            });

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers,
            });
        }

        // No handler matched - 404
        logger.warn('Endpoint not found', { pathname });
        return new Response(
            JSON.stringify({
                code: 'NOT_FOUND',
                message: `Endpoint ${pathname} not found.`,
            }),
            {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
        );
    } catch (error) {
        // Top-level error handling
        logger.error('Unhandled error in utils function', { error });
        const errorResponse = handleError(error);

        // Add CORS headers to error response
        const headers = new Headers(errorResponse.headers);
        Object.entries(corsHeaders).forEach(([key, value]) => {
            headers.set(key, value);
        });

        return new Response(errorResponse.body, {
            status: errorResponse.status,
            statusText: errorResponse.statusText,
            headers,
        });
    }
});

