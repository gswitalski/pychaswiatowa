/**
 * Me Handlers
 * HTTP request handlers for the /me endpoint.
 */

import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getMeProfile, ProfileDto } from './me.service.ts';

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
 * Handles GET /me request.
 * Returns the authenticated user's minimal profile data (id and username).
 *
 * @param req - The incoming HTTP request
 * @returns Response with ProfileDto on success, or error response
 */
export async function handleGetMe(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /me request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Fetch profile from service layer
        const profile: ProfileDto = await getMeProfile(client, user.id);

        logger.info('GET /me completed successfully', { userId: user.id });

        return createSuccessResponse(profile);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Me router - routes HTTP methods to appropriate handlers.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function meRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();

    switch (method) {
        case 'GET':
            return handleGetMe(req);

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
