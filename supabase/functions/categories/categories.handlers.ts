/**
 * Categories Handlers
 * HTTP request handlers for category-related endpoints.
 */

import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getAllCategories, CategoryDto } from './categories.service.ts';

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
 * Handles GET /categories request.
 * Returns all predefined recipe categories.
 *
 * @param req - The incoming HTTP request
 * @returns Response with CategoryDto[] on success, or error response
 */
export async function handleGetCategories(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /categories request');

        // Get authenticated context (client + user)
        // User is validated to ensure the request is authenticated
        const { client, user } = await getAuthenticatedContext(req);

        // Fetch categories from service layer
        const categories: CategoryDto[] = await getAllCategories(client);

        logger.info('GET /categories completed successfully', {
            userId: user.id,
            categoriesCount: categories.length,
        });

        return createSuccessResponse(categories);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Categories router - routes HTTP methods to appropriate handlers.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function categoriesRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();

    switch (method) {
        case 'GET':
            return handleGetCategories(req);

        case 'OPTIONS':
            // Handle CORS preflight request
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
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


