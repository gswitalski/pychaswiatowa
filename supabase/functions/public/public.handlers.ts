/**
 * Public Handlers
 * HTTP request handlers for public (anonymous) endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import { ApplicationError, handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getPublicRecipes } from './public.service.ts';
import { GetPublicRecipesQuery } from './public.types.ts';

/**
 * Zod schema for validating query parameters for GET /public/recipes.
 */
const GetPublicRecipesQuerySchema = z.object({
    page: z.string().optional().default('1').transform((val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1) {
            throw new Error('Page must be a positive integer');
        }
        return num;
    }),
    limit: z.string().optional().default('20').transform((val) => {
        const num = parseInt(val, 10);
        if (isNaN(num) || num < 1) {
            throw new Error('Limit must be a positive integer');
        }
        if (num > 100) {
            throw new Error('Limit cannot exceed 100');
        }
        return num;
    }),
    sort: z.string().optional().default('created_at.desc').transform((val) => {
        const parts = val.split('.');
        if (parts.length !== 2) {
            throw new Error('Sort must be in format: {field}.{direction}');
        }
        const [field, direction] = parts;

        if (!['created_at', 'name'].includes(field)) {
            throw new Error('Sort field must be one of: created_at, name');
        }
        if (!['asc', 'desc'].includes(direction)) {
            throw new Error('Sort direction must be one of: asc, desc');
        }

        return {
            field: field as 'created_at' | 'name',
            direction: direction as 'asc' | 'desc',
        };
    }),
    q: z.string().optional().transform((val) => {
        if (val === undefined) return undefined;
        const trimmed = val.trim();
        if (trimmed.length === 0) return undefined;
        if (trimmed.length < 2) {
            throw new Error('Search query must be at least 2 characters');
        }
        return trimmed;
    }),
});

/**
 * Creates a successful JSON response with the given data.
 *
 * @param data - The data to include in the response body
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON body
 */
function createSuccessResponse<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles GET /public/recipes request.
 * Returns paginated list of public recipes with optional search and sorting.
 * This endpoint is accessible without authentication.
 *
 * @param req - The incoming HTTP request
 * @returns Response with PaginatedResponseDto<PublicRecipeListItemDto> on success, or error response
 */
export async function handleGetPublicRecipes(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /public/recipes request');

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = {
            page: url.searchParams.get('page') || undefined,
            limit: url.searchParams.get('limit') || undefined,
            sort: url.searchParams.get('sort') || undefined,
            q: url.searchParams.get('q') || undefined,
        };

        let validatedParams;
        try {
            validatedParams = GetPublicRecipesQuerySchema.parse(rawParams);
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

        // Build query object
        const query: GetPublicRecipesQuery = {
            page: validatedParams.page,
            limit: validatedParams.limit,
            sortField: validatedParams.sort.field,
            sortDirection: validatedParams.sort.direction,
            q: validatedParams.q,
        };

        // Create service role client for public access
        const client = createServiceRoleClient();

        // Fetch public recipes
        const result = await getPublicRecipes(client, query);

        logger.info('GET /public/recipes completed successfully', {
            recipesCount: result.data.length,
            totalItems: result.pagination.totalItems,
            page: query.page,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Public router - routes requests to appropriate handlers.
 * Handles routing for /public/* endpoints.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 404 Not Found
 */
export async function publicRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method.toUpperCase();

    // Extract path after /public
    const match = path.match(/\/public(\/.*)?$/);
    if (!match) {
        logger.warn('Path does not match /public/*', { path });
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

    // Route: GET /public/recipes
    if (subPath === '/recipes' && method === 'GET') {
        return handleGetPublicRecipes(req);
    }

    // Handle unsupported paths
    if (subPath === '/recipes') {
        logger.warn('Method not allowed for /public/recipes', { method });
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
    logger.warn('Unknown path in public router', { path: subPath, method });
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
