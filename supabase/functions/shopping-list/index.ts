/**
 * Main router for Shopping List endpoints
 * 
 * Handles:
 * - GET /shopping-list - Get all shopping list items
 * - POST /shopping-list/items - Add manual item to shopping list
 * - PATCH /shopping-list/items/{id} - Update item (toggle is_owned)
 * - DELETE /shopping-list/items/{id} - Remove manual item
 */

import { logger } from '../_shared/logger.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { shoppingListRouter } from './shopping-list.handlers.ts';
import { handleCorsPreflightRequest, corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    // CRITICAL: Must be at the top and return status 200
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest();
    }

    try {
        logger.info(`[shopping-list] ${req.method} ${new URL(req.url).pathname}`);

        // Route to handler
        const response = await shoppingListRouter(req);

        // Add CORS headers to response
        Object.entries(corsHeaders).forEach(([key, value]) => {
            response.headers.set(key, value);
        });

        return response;
    } catch (error) {
        // Global error handler
        logger.error('[shopping-list] Request failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });

        const errorResponse = handleError(error);

        // Add CORS headers to error response
        Object.entries(corsHeaders).forEach(([key, value]) => {
            errorResponse.headers.set(key, value);
        });

        return errorResponse;
    }
});
