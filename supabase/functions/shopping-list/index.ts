/**
 * Main router for Shopping List endpoints
 * 
 * Handles:
 * - GET /shopping-list - Get all shopping list items
 * - POST /shopping-list/items - Add manual item to shopping list
 * - Future: PATCH /shopping-list/items/{id} - Update item (toggle is_owned)
 * - Future: DELETE /shopping-list/items/{id} - Remove item
 */

import { logger } from '../_shared/logger.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { shoppingListRouter } from './shopping-list.handlers.ts';

// CORS headers for all responses
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
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
