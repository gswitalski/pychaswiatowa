/**
 * Recipes Handlers
 * HTTP request handlers for recipe-related endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    getRecipes,
    getRecipeById,
    PaginatedResponseDto,
    RecipeListItemDto,
    RecipeDetailDto,
} from './recipes.service.ts';

/** Maximum allowed limit for pagination. */
const MAX_LIMIT = 100;

/** Default limit for pagination. */
const DEFAULT_LIMIT = 20;

/** Default page number. */
const DEFAULT_PAGE = 1;

/**
 * Schema for validating GET /recipes query parameters.
 */
const getRecipesQuerySchema = z.object({
    page: z
        .string()
        .optional()
        .transform((val) => {
            const parsed = parseInt(val ?? '', 10);
            return isNaN(parsed) || parsed < 1 ? DEFAULT_PAGE : parsed;
        }),
    limit: z
        .string()
        .optional()
        .transform((val) => {
            const parsed = parseInt(val ?? '', 10);
            if (isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
            return Math.min(parsed, MAX_LIMIT);
        }),
    sort: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return { field: 'created_at', direction: 'desc' as const };

            const parts = val.split('.');
            const field = parts[0] || 'created_at';
            const direction = parts[1] === 'asc' ? 'asc' as const : 'desc' as const;

            return { field, direction };
        }),
    'filter[category_id]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? undefined : parsed;
        }),
    'filter[tags]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val || val.trim().length === 0) return undefined;
            return val.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
        }),
    search: z
        .string()
        .optional()
        .transform((val) => val?.trim() || undefined),
});

/**
 * Parses query parameters from URL.
 */
function parseQueryParams(url: URL): Record<string, string> {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

/**
 * Creates a successful JSON response with the given data.
 */
function createSuccessResponse<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles GET /recipes request.
 * Returns a paginated list of recipes for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @returns Response with PaginatedResponseDto<RecipeListItemDto> on success, or error response
 */
export async function handleGetRecipes(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /recipes request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = parseQueryParams(url);

        const validationResult = getRecipesQuerySchema.safeParse(rawParams);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid query parameters', {
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const params = validationResult.data;

        // Call the service to get recipes
        const result: PaginatedResponseDto<RecipeListItemDto> = await getRecipes(
            client,
            {
                page: params.page,
                limit: params.limit,
                sortField: params.sort.field,
                sortDirection: params.sort.direction,
                categoryId: params['filter[category_id]'],
                tags: params['filter[tags]'],
                search: params.search,
            }
        );

        logger.info('GET /recipes completed successfully', {
            userId: user.id,
            totalItems: result.pagination.totalItems,
            page: result.pagination.currentPage,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Validates and parses a recipe ID from URL path segment.
 *
 * @param recipeIdParam - The raw ID string from URL path
 * @returns The parsed recipe ID as a positive integer
 * @throws ApplicationError with VALIDATION_ERROR if ID is not a valid positive integer
 */
function parseAndValidateRecipeId(recipeIdParam: string): number {
    const recipeId = parseInt(recipeIdParam, 10);

    if (isNaN(recipeId) || recipeId <= 0 || !Number.isInteger(recipeId)) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            `Invalid recipe ID: '${recipeIdParam}'. ID must be a positive integer.`
        );
    }

    return recipeId;
}

/**
 * Handles GET /recipes/{id} request.
 * Returns detailed information about a single recipe for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with RecipeDetailDto on success, or error response
 */
export async function handleGetRecipeById(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling GET /recipes/{id} request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Call the service to get recipe details
        const result: RecipeDetailDto = await getRecipeById(client, recipeId);

        logger.info('GET /recipes/{id} completed successfully', {
            userId: user.id,
            recipeId: result.id,
            recipeName: result.name,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Extracts the recipe ID from a URL path if it matches /recipes/{id} pattern.
 * Returns null if the path doesn't match the pattern or is the base /recipes path.
 *
 * @param url - The URL object to extract path from
 * @returns The recipe ID string if present, null otherwise
 */
function extractRecipeIdFromPath(url: URL): string | null {
    // Get the pathname and extract the part after /recipes/
    // Expected format: /functions/v1/recipes or /functions/v1/recipes/{id}
    const pathname = url.pathname;

    // Match pattern: /recipes/{id} where id is captured
    // This handles both local (/recipes/123) and deployed (/functions/v1/recipes/123) paths
    const recipeIdMatch = pathname.match(/\/recipes\/([^/]+)$/);

    if (recipeIdMatch && recipeIdMatch[1]) {
        return recipeIdMatch[1];
    }

    return null;
}

/**
 * Recipes router - routes HTTP methods to appropriate handlers.
 * Supports:
 * - GET /recipes - List all recipes (paginated)
 * - GET /recipes/{id} - Get single recipe by ID
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function recipesRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const url = new URL(req.url);

    // Extract recipe ID from path (if present)
    const recipeId = extractRecipeIdFromPath(url);

    // Handle CORS preflight request
    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            },
        });
    }

    // Route GET requests
    if (method === 'GET') {
        // If recipe ID is present, get single recipe
        if (recipeId) {
            return handleGetRecipeById(req, recipeId);
        }

        // Otherwise, list all recipes
        return handleGetRecipes(req);
    }

    // Method not allowed
    logger.warn('Method not allowed', { method, path: url.pathname });
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

