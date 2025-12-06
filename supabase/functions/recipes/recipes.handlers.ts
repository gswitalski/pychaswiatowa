/**
 * Recipes Handlers
 * HTTP request handlers for recipe-related endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getRecipes, PaginatedResponseDto, RecipeListItemDto } from './recipes.service.ts';

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
 * Recipes router - routes HTTP methods to appropriate handlers.
 * Currently supports only GET method for listing recipes.
 * Future endpoints (POST, GET/:id, PUT/:id, DELETE/:id) will be added here.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function recipesRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();

    switch (method) {
        case 'GET':
            return handleGetRecipes(req);

        case 'OPTIONS':
            // Handle CORS preflight request
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
                },
            });

        default:
            logger.warn('Method not allowed', { method });
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
}

