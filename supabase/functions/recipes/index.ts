/**
 * Recipes Edge Function
 * Main entry point for the /recipes endpoint.
 *
 * Endpoints:
 *
 * GET /functions/v1/recipes
 * Returns a paginated list of recipes for the authenticated user.
 * Query Parameters:
 * - page (integer, default: 1) - Page number
 * - limit (integer, default: 20, max: 100) - Items per page
 * - sort (string, e.g., 'name.asc', 'created_at.desc') - Sort field and direction
 * - filter[category_id] (integer) - Filter by category ID
 * - filter[tags] (string) - Comma-separated list of tag names
 * - search (string) - Full-text search query
 *
 * GET /functions/v1/recipes/{id}
 * Returns detailed information about a single recipe.
 *
 * POST /functions/v1/recipes
 * Creates a new recipe for the authenticated user.
 * Request Body (JSON):
 * - name (string, required, 1-150 chars) - Recipe name
 * - description (string, optional) - Recipe description
 * - category_id (number, optional) - Category ID
 * - ingredients_raw (string, required) - Raw ingredients text
 * - steps_raw (string, required) - Raw steps text
 * - tags (string[], optional) - Array of tag names
 * - visibility (string, required) - Recipe visibility: PRIVATE, SHARED, or PUBLIC
 *
 * POST /functions/v1/recipes/import
 * Creates a new recipe from a raw text block for the authenticated user.
 * The server parses the text to extract the recipe name, ingredients, and steps.
 * Imported recipes are always set to PRIVATE visibility.
 * Expected format:
 * - Title: Line starting with `#` (required)
 * - Main sections: Lines starting with `##` (e.g., "## Składniki", "## Kroki")
 * - Subsections: Lines starting with `###` (headers within sections)
 * - Items: Lines starting with `-` (ingredients or steps)
 * Request Body (JSON):
 * - raw_text (string, required) - Raw text block containing the recipe
 *
 * PUT /functions/v1/recipes/{id}
 * Updates an existing recipe for the authenticated user.
 * Request Body (JSON) - all fields optional, at least one required:
 * - name (string, 1-150 chars) - Recipe name
 * - description (string, nullable) - Recipe description
 * - category_id (number, nullable) - Category ID
 * - ingredients_raw (string) - Raw ingredients text
 * - steps_raw (string) - Raw steps text
 * - tags (string[]) - Array of tag names (replaces all existing tags)
 * - visibility (string) - Recipe visibility: PRIVATE, SHARED, or PUBLIC
 *
 * DELETE /functions/v1/recipes/{id}
 * Soft-deletes an existing recipe for the authenticated user.
 * Sets the deleted_at timestamp; the recipe remains in the database but is no longer accessible.
 */

import { recipesRouter } from './recipes.handlers.ts';
import { logger } from '../_shared/logger.ts';

/**
 * CORS headers for all responses.
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Adds CORS headers to the response.
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
 * Main request handler for the recipes function.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /recipes', {
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
        // Route the request to the recipes router
        const response = await recipesRouter(req);

        // Add CORS headers to the response
        return addCorsHeaders(response);
    } catch (error) {
        logger.error('Unhandled error in recipes function', {
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

