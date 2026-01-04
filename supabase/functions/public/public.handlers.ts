/**
 * Public Handlers
 * HTTP request handlers for public (anonymous) endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { createServiceRoleClient, getOptionalAuthenticatedUser } from '../_shared/supabase-client.ts';
import { ApplicationError, handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getPublicRecipes, getPublicRecipeById, getPublicRecipesFeed } from './public.service.ts';
import { GetPublicRecipesQuery, GetPublicRecipeByIdParams, GetPublicRecipesFeedQuery } from './public.types.ts';

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
    'filter[termorobot]': z.string().optional().transform((val) => {
        if (val === undefined) return undefined;
        const lowerVal = val.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === '1') {
            return true;
        }
        if (lowerVal === 'false' || lowerVal === '0') {
            return false;
        }
        throw new Error('filter[termorobot] must be true, false, 1, or 0');
    }),
    'filter[diet_type]': z.enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
        invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
    }).optional(),
    'filter[cuisine]': z.enum([
        'AFRICAN',
        'AMERICAN',
        'ASIAN',
        'BALKAN',
        'BRAZILIAN',
        'BRITISH',
        'CARIBBEAN',
        'CHINESE',
        'FRENCH',
        'GERMAN',
        'GREEK',
        'INDIAN',
        'ITALIAN',
        'JAPANESE',
        'KOREAN',
        'MEDITERRANEAN',
        'MEXICAN',
        'MIDDLE_EASTERN',
        'POLISH',
        'RUSSIAN',
        'SCANDINAVIAN',
        'SPANISH',
        'THAI',
        'TURKISH',
        'VIETNAMESE',
    ], {
        invalid_type_error: 'Cuisine must be one of: AFRICAN, AMERICAN, ASIAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, MEXICAN, MIDDLE_EASTERN, POLISH, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE',
    }).optional(),
    'filter[difficulty]': z.enum(['EASY', 'MEDIUM', 'HARD'], {
        invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
    }).optional(),
    'filter[grill]': z.string().optional().transform((val) => {
        if (val === undefined) return undefined;
        const lowerVal = val.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === '1') {
            return true;
        }
        if (lowerVal === 'false' || lowerVal === '0') {
            return false;
        }
        throw new Error('filter[grill] must be true, false, 1, or 0');
    }),
});

/**
 * Zod schema for validating query parameters for GET /public/recipes/feed.
 * Uses cursor-based pagination instead of page numbers.
 */
const GetPublicRecipesFeedQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z.string().optional().default('12').transform((val) => {
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
    'filter[termorobot]': z.string().optional().transform((val) => {
        if (val === undefined) return undefined;
        const lowerVal = val.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === '1') {
            return true;
        }
        if (lowerVal === 'false' || lowerVal === '0') {
            return false;
        }
        throw new Error('filter[termorobot] must be true, false, 1, or 0');
    }),
    'filter[diet_type]': z.enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
        invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
    }).optional(),
    'filter[cuisine]': z.enum([
        'AFRICAN',
        'AMERICAN',
        'ASIAN',
        'BALKAN',
        'BRAZILIAN',
        'BRITISH',
        'CARIBBEAN',
        'CHINESE',
        'FRENCH',
        'GERMAN',
        'GREEK',
        'INDIAN',
        'ITALIAN',
        'JAPANESE',
        'KOREAN',
        'MEDITERRANEAN',
        'MEXICAN',
        'MIDDLE_EASTERN',
        'POLISH',
        'RUSSIAN',
        'SCANDINAVIAN',
        'SPANISH',
        'THAI',
        'TURKISH',
        'VIETNAMESE',
    ], {
        invalid_type_error: 'Cuisine must be one of: AFRICAN, AMERICAN, ASIAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, MEXICAN, MIDDLE_EASTERN, POLISH, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE',
    }).optional(),
    'filter[difficulty]': z.enum(['EASY', 'MEDIUM', 'HARD'], {
        invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
    }).optional(),
    'filter[grill]': z.string().optional().transform((val) => {
        if (val === undefined) return undefined;
        const lowerVal = val.toLowerCase().trim();
        if (lowerVal === 'true' || lowerVal === '1') {
            return true;
        }
        if (lowerVal === 'false' || lowerVal === '0') {
            return false;
        }
        throw new Error('filter[grill] must be true, false, 1, or 0');
    }),
});

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
 * Creates a successful JSON response with cache control headers.
 *
 * @param data - The data to include in the response body
 * @param isAuthenticated - Whether the request is authenticated
 * @param status - HTTP status code (default: 200)
 * @returns Response object with JSON body and cache control headers
 */
function createCachedResponse<T>(data: T, isAuthenticated: boolean, status = 200): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // For anonymous requests, allow public caching
    // For authenticated requests, disable caching
    if (!isAuthenticated) {
        headers['Cache-Control'] = 'public, max-age=60';
    } else {
        headers['Cache-Control'] = 'no-store';
    }

    return new Response(JSON.stringify(data), {
        status,
        headers,
    });
}

/**
 * Handles GET /public/recipes request.
 * Returns paginated list of public recipes with optional search and sorting.
 * Supports optional authentication - when authenticated, includes collection information
 * and returns user's own recipes regardless of visibility.
 *
 * Response includes:
 * - visibility: recipe visibility setting (PUBLIC/SHARED/PRIVATE)
 * - is_owner: true if authenticated user owns the recipe, false otherwise (always false for anonymous)
 * - in_my_collections: true if recipe is in authenticated user's collections (always false for anonymous)
 *
 * @param req - The incoming HTTP request
 * @returns Response with PaginatedResponseDto<PublicRecipeListItemDto> on success, or error response
 */
export async function handleGetPublicRecipes(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /public/recipes request');

        // Extract optional user (null for anonymous, throws on invalid token)
        const user = await getOptionalAuthenticatedUser(req);
        const userId = user?.id ?? null;

        logger.info('Request context determined', {
            isAuthenticated: userId !== null,
            userId: userId ?? 'anonymous',
        });

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = {
            page: url.searchParams.get('page') || undefined,
            limit: url.searchParams.get('limit') || undefined,
            sort: url.searchParams.get('sort') || undefined,
            q: url.searchParams.get('q') || undefined,
            'filter[termorobot]': url.searchParams.get('filter[termorobot]') || undefined,
            'filter[diet_type]': url.searchParams.get('filter[diet_type]') || undefined,
            'filter[cuisine]': url.searchParams.get('filter[cuisine]') || undefined,
            'filter[difficulty]': url.searchParams.get('filter[difficulty]') || undefined,
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
            termorobot: validatedParams['filter[termorobot]'],
            dietType: validatedParams['filter[diet_type]'],
            cuisine: validatedParams['filter[cuisine]'],
            difficulty: validatedParams['filter[difficulty]'],
            grill: validatedParams['filter[grill]'],
        };

        // Create service role client for public access
        const client = createServiceRoleClient();

        // Fetch public recipes (with optional user context for collections)
        const result = await getPublicRecipes(client, query, userId);

        logger.info('GET /public/recipes completed successfully', {
            recipesCount: result.data.length,
            totalItems: result.pagination.totalItems,
            page: query.page,
            isAuthenticated: userId !== null,
        });

        return createCachedResponse(result, userId !== null);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /public/recipes/{id} request.
 * Returns full details of a single public recipe.
 * This endpoint is accessible without authentication, but supports optional authentication
 * for additional metadata (is_owner, in_my_plan).
 *
 * IMPORTANT: API uses numeric ID only (no slug).
 * - Frontend UI route: /explore/recipes/{id}-{slug} (for SEO)
 * - Backend API route: /public/recipes/{id} (numeric ID only)
 * - Frontend must parse ID from URL before calling this endpoint
 * - Slug is not part of the API contract
 *
 * @param req - The incoming HTTP request (used to extract optional JWT)
 * @param recipeId - Recipe ID extracted from URL path (numeric string)
 * @returns Response with PublicRecipeDetailDto on success, or error response
 */
export async function handleGetPublicRecipeById(req: Request, recipeId: string): Promise<Response> {
    try {
        logger.info('Handling GET /public/recipes/:id request', { recipeId });

        // Extract optional user (null for anonymous, throws on invalid token)
        const user = await getOptionalAuthenticatedUser(req);
        const userId = user?.id ?? null;

        logger.info('Request context determined', {
            isAuthenticated: userId !== null,
            userId: userId ?? 'anonymous',
        });

        // Validate recipe ID parameter
        let validatedParams: GetPublicRecipeByIdParams;
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

        // Create service role client for public access
        const client = createServiceRoleClient();

        // Fetch public recipe by ID (with optional user context for metadata)
        const recipe = await getPublicRecipeById(client, validatedParams, userId);

        logger.info('GET /public/recipes/:id completed successfully', {
            recipeId: recipe.id,
            recipeName: recipe.name,
            isAuthenticated: userId !== null,
        });

        return createSuccessResponse(recipe);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /public/recipes/feed request.
 * Returns cursor-based paginated list of public recipes with optional search and sorting.
 * Supports optional authentication - when authenticated, includes collection information
 * and returns user's own recipes regardless of visibility.
 *
 * Response includes:
 * - visibility: recipe visibility setting (PUBLIC/SHARED/PRIVATE)
 * - is_owner: true if authenticated user owns the recipe, false otherwise (always false for anonymous)
 * - in_my_collections: true if recipe is in authenticated user's collections (always false for anonymous)
 *
 * @param req - The incoming HTTP request
 * @returns Response with CursorPaginatedResponseDto<PublicRecipeListItemDto> on success, or error response
 */
export async function handleGetPublicRecipesFeed(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /public/recipes/feed request');

        // Extract optional user (null for anonymous, throws on invalid token)
        const user = await getOptionalAuthenticatedUser(req);
        const userId = user?.id ?? null;

        logger.info('Request context determined', {
            isAuthenticated: userId !== null,
            userId: userId ?? 'anonymous',
        });

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = {
            cursor: url.searchParams.get('cursor') || undefined,
            limit: url.searchParams.get('limit') || undefined,
            sort: url.searchParams.get('sort') || undefined,
            q: url.searchParams.get('q') || undefined,
            'filter[termorobot]': url.searchParams.get('filter[termorobot]') || undefined,
            'filter[diet_type]': url.searchParams.get('filter[diet_type]') || undefined,
            'filter[cuisine]': url.searchParams.get('filter[cuisine]') || undefined,
            'filter[difficulty]': url.searchParams.get('filter[difficulty]') || undefined,
        };

        let validatedParams;
        try {
            validatedParams = GetPublicRecipesFeedQuerySchema.parse(rawParams);
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

        logger.info('Query parameters validated', {
            hasQuery: validatedParams.q !== undefined,
            limit: validatedParams.limit,
            sort: `${validatedParams.sort.field}.${validatedParams.sort.direction}`,
            hasCursor: validatedParams.cursor !== undefined,
        });

        // Build query object for service (flatten sort structure)
        const query: GetPublicRecipesFeedQuery = {
            cursor: validatedParams.cursor,
            limit: validatedParams.limit,
            sortField: validatedParams.sort.field,
            sortDirection: validatedParams.sort.direction,
            q: validatedParams.q,
            termorobot: validatedParams['filter[termorobot]'],
            dietType: validatedParams['filter[diet_type]'],
            cuisine: validatedParams['filter[cuisine]'],
            difficulty: validatedParams['filter[difficulty]'],
            grill: validatedParams['filter[grill]'],
        };

        // Create service role client for public access
        const client = createServiceRoleClient();

        // Fetch public recipes feed (with optional user context for collections)
        const result = await getPublicRecipesFeed(client, query, userId);

        logger.info('GET /public/recipes/feed completed successfully', {
            recipesCount: result.data.length,
            hasMore: result.pageInfo.hasMore,
            isAuthenticated: userId !== null,
        });

        return createCachedResponse(result, userId !== null);
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

    // Route: GET /public/recipes/feed
    // CRITICAL: Check this BEFORE /public/recipes/{id} to avoid matching "feed" as an ID
    if (subPath === '/recipes/feed' && method === 'GET') {
        return handleGetPublicRecipesFeed(req);
    }

    // Route: GET /public/recipes/{id}
    // Check this BEFORE /public/recipes to match more specific pattern first
    const recipeByIdMatch = subPath.match(/^\/recipes\/([^/]+)$/);
    if (recipeByIdMatch && method === 'GET') {
        const recipeId = recipeByIdMatch[1];
        return handleGetPublicRecipeById(req, recipeId);
    }

    // Route: GET /public/recipes
    if (subPath === '/recipes' && method === 'GET') {
        return handleGetPublicRecipes(req);
    }

    // Handle unsupported paths
    if (subPath === '/recipes' || subPath.startsWith('/recipes/')) {
        logger.warn('Method not allowed for /public/recipes', { method, subPath });
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
