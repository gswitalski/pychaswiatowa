/**
 * Search Handlers
 * HTTP request handlers for global search endpoint.
 * Includes routing, validation with Zod schemas, and response formatting.
 */

import { z } from 'npm:zod@3.22.4';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { searchRecipes, searchCollections } from './search.service.ts';
import {
    SearchQuerySchema,
    GlobalSearchResponseDto,
} from './search.types.ts';

// #region --- Response Helpers ---

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
 * Creates a validation error response.
 */
function createValidationErrorResponse(errors: z.ZodError): Response {
    const errorMessages = errors.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
    }));

    return new Response(
        JSON.stringify({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            errors: errorMessages,
        }),
        {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * Creates a 405 Method Not Allowed response.
 */
function createMethodNotAllowedResponse(allowedMethods: string[]): Response {
    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
        }),
        {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                Allow: allowedMethods.join(', '),
            },
        }
    );
}

// #endregion

// #region --- URL Parsing Helpers ---

/**
 * Extracts the path after /functions/v1/search from the URL.
 */
function getPathFromUrl(url: string): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match patterns like /functions/v1/search or /search
    const match = pathname.match(/(?:\/functions\/v1)?\/search(.*)/);
    return match ? match[1] : '';
}

/**
 * Parses query parameters from URL.
 */
function getQueryParams(url: string): URLSearchParams {
    const urlObj = new URL(url);
    return urlObj.searchParams;
}

// #endregion

// #region --- Handlers ---

/**
 * Handles GET /search/global request.
 * Performs parallel search across recipes and collections.
 *
 * @param req - The incoming HTTP request
 * @returns Response with aggregated search results
 */
async function handleGlobalSearch(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /search/global request');

        // Authenticate user
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate query parameter
        const queryParams = getQueryParams(req.url);
        const validationResult = SearchQuerySchema.safeParse({
            q: queryParams.get('q'),
        });

        if (!validationResult.success) {
            logger.warn('Invalid search query', {
                userId: user.id,
                errors: validationResult.error.errors,
            });
            return createValidationErrorResponse(validationResult.error);
        }

        const { q: searchQuery } = validationResult.data;

        logger.info('Executing global search', {
            userId: user.id,
            query: searchQuery,
        });

        // Execute searches in parallel for better performance
        const [recipes, collections] = await Promise.all([
            searchRecipes(client, user.id, searchQuery),
            searchCollections(client, user.id, searchQuery),
        ]);

        const response: GlobalSearchResponseDto = {
            recipes,
            collections,
        };

        logger.info('Global search completed successfully', {
            userId: user.id,
            query: searchQuery,
            recipesCount: recipes.length,
            collectionsCount: collections.length,
        });

        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

// #endregion

// #region --- Router ---

/**
 * Search router - routes HTTP requests to appropriate handlers.
 * Handles all search-related endpoints with URL pattern matching.
 *
 * Supported routes:
 * - GET /search/global - Global search across recipes and collections
 */
export async function searchRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = getPathFromUrl(req.url);

    logger.debug('Routing search request', { method, path });

    // Route: GET /search/global
    if (path === '/global' || path === '/global/') {
        if (method === 'GET') {
            return handleGlobalSearch(req);
        }
        return createMethodNotAllowedResponse(['GET']);
    }

    // No matching route found
    logger.warn('Search route not found', { method, path });
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

// #endregion



