/**
 * Explore Handlers
 * HTTP request handlers for explore endpoints with optional authentication.
 */

import { z } from 'npm:zod@3.22.4';
import { ApplicationError, handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getOptionalAuthenticatedUser } from '../_shared/supabase-client.ts';
import { getExploreRecipeById } from './explore.service.ts';
import { GetExploreRecipeByIdParams } from './explore.types.ts';

/**
 * Zod schema for validating recipe ID from path parameter.
 */
const RecipeIdParamSchema = z.object({
    id: z.string().transform((val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1) {
            throw new Error('Recipe ID must be a positive integer');
        }
        return num;
    }),
});

/**
 * Creates a successful JSON response with the given data.
 *
 * @param data - The data to include in the response body
 * @param cacheControl - Optional cache-control header value
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON body
 */
function createSuccessResponse<T>(
    data: T,
    cacheControl?: string,
    status = 200
): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    if (cacheControl) {
        headers['Cache-Control'] = cacheControl;
    }

    return new Response(JSON.stringify(data), {
        status,
        headers,
    });
}


/**
 * Handles GET /explore/recipes/{id} request.
 * Returns full details of a single recipe (public or author-owned).
 * Authentication is optional: anonymous users can only access PUBLIC recipes.
 *
 * @param recipeId - Recipe ID extracted from URL path
 * @param req - The incoming HTTP request (for auth context)
 * @returns Response with RecipeDetailDto on success, or error response
 */
export async function handleGetExploreRecipeById(
    recipeId: string,
    req: Request
): Promise<Response> {
    try {
        logger.info('Handling GET /explore/recipes/:id request', { recipeId });

        // Validate recipe ID parameter
        let validatedParams: GetExploreRecipeByIdParams;
        try {
            validatedParams = RecipeIdParamSchema.parse({ id: recipeId });
        } catch (zodError) {
            if (zodError instanceof z.ZodError) {
                const firstError = zodError.errors[0];
                throw new ApplicationError('VALIDATION_ERROR', firstError.message);
            }
            // Handle custom transform errors (thrown as plain Error)
            if (zodError instanceof Error) {
                throw new ApplicationError('VALIDATION_ERROR', zodError.message);
            }
            throw zodError;
        }

        // Extract optional user (null for anonymous, throws on invalid token)
        const user = await getOptionalAuthenticatedUser(req);
        const requesterUserId = user?.id ?? null;

        logger.info('Request context determined', {
            recipeId: validatedParams.id,
            isAuthenticated: requesterUserId !== null,
            requesterUserId: requesterUserId ?? 'anonymous',
        });

        // Fetch recipe with access control logic in service
        const result = await getExploreRecipeById({
            recipeId: validatedParams.id,
            requesterUserId,
        });

        // Determine cache headers based on visibility and auth status
        let cacheControl: string;
        if (result.visibility === 'PUBLIC' && requesterUserId === null) {
            // Public recipe accessed anonymously - can be cached
            cacheControl = 'public, max-age=60';
        } else {
            // Non-public or authenticated request - no cache
            cacheControl = 'no-store';
        }

        logger.info('GET /explore/recipes/:id completed successfully', {
            recipeId: result.id,
            recipeName: result.name,
            visibility: result.visibility,
            cacheControl,
        });

        return createSuccessResponse(result, cacheControl);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Explore router - routes requests to appropriate handlers.
 * Handles routing for /explore/* endpoints.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 404 Not Found
 */
export async function exploreRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // Extract path after /explore
    const match = path.match(/\/explore(\/.*)?$/);
    if (!match) {
        logger.warn('Path does not match /explore/*', { path });
        return new Response(
            JSON.stringify({
                code: 'NOT_FOUND',
                message: 'Endpoint not found',
            }),
            {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }

    const subPath = match[1] || '/';

    // Route: GET /explore/recipes/{id}
    const recipeByIdMatch = subPath.match(/^\/recipes\/([^/]+)$/);
    if (recipeByIdMatch && method === 'GET') {
        const recipeId = recipeByIdMatch[1];
        return handleGetExploreRecipeById(recipeId, req);
    }

    // Handle unsupported paths
    if (subPath === '/recipes' || subPath.startsWith('/recipes/')) {
        logger.warn('Method not allowed for /explore/recipes', { method, subPath });
        return new Response(
            JSON.stringify({
                code: 'METHOD_NOT_ALLOWED',
                message: `Method ${method} not allowed`,
            }),
            {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Allow': 'GET, OPTIONS',
                },
            }
        );
    }

    // 404 for unknown paths
    logger.warn('Unknown path in explore router', { path: subPath, method });
    return new Response(
        JSON.stringify({
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        }),
        {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
