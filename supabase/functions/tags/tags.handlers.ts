/**
 * Tags Handlers
 * HTTP request handlers for tag-related endpoints.
 */

import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getTags, TagDto } from './tags.service.ts';

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
 * Handles GET /tags request.
 * Returns all tags belonging to the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @returns Response with TagDto[] on success, or error response
 */
export async function handleGetTags(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /tags request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Fetch tags from service layer, filtered by user_id
        const tags: TagDto[] = await getTags(client, user.id);

        logger.info('GET /tags completed successfully', {
            userId: user.id,
            tagsCount: tags.length,
        });

        return createSuccessResponse(tags);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Tags router - routes HTTP methods to appropriate handlers.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function tagsRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();

    switch (method) {
        case 'GET':
            return handleGetTags(req);

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


