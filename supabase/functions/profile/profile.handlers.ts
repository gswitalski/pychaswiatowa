/**
 * Profile Handlers
 * HTTP request handlers for profile-related endpoints.
 */

import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { ApplicationError, handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    checkUsernameAvailable,
    changePassword,
    getProfileSettings,
    ProfileSettingsDto,
    updateProfileSettings,
    verifyCurrentPassword,
} from './profile.service.ts';
import { createEphemeralAnonClient } from '../_shared/supabase-client.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import {
    changePasswordSchema,
    updateProfileSettingsSchema,
    usernameAvailabilityQuerySchema,
} from './profile.types.ts';

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
 * Handles GET /profile/username-available request.
 * The endpoint is public and returns only the availability flag.
 */
export async function handleGetUsernameAvailable(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /profile/username-available request');

        const url = new URL(req.url);
        const parseResult = usernameAvailabilityQuerySchema.safeParse({
            username: url.searchParams.get('username'),
        });

        if (!parseResult.success) {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                "Parametr 'username' musi mieć od 3 do 50 znaków i nie może zawierać białych znaków."
            );
        }

        // This public lookup must bypass profile RLS, but exposes no owner data.
        const client = createServiceRoleClient();
        const result = await checkUsernameAvailable({
            client,
            username: parseResult.data.username,
        });

        logger.info('GET /profile/username-available completed successfully');
        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /profile request.
 * Returns the authenticated user's profile settings data.
 *
 * @param req - The incoming HTTP request
 * @returns Response with ProfileSettingsDto on success, or error response
 */
export async function handleGetProfile(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /profile request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Fetch profile from service layer
        const profile: ProfileSettingsDto = await getProfileSettings({
            client,
            userId: user.id,
            email: user.email ?? '',
        });

        logger.info('GET /profile completed successfully', { userId: user.id });

        return createSuccessResponse(profile);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles PUT /profile request.
 */
export async function handleUpdateProfile(_req: Request): Promise<Response> {
    try {
        logger.info('Handling PUT /profile request');
        const { client, user } = await getAuthenticatedContext(_req);

        let body: unknown;
        try {
            body = await _req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const parseResult = updateProfileSettingsSchema.safeParse(body);
        if (!parseResult.success) {
            const errorMessages = parseResult.error.errors.map((error) => ({
                field: error.path.join('.'),
                message: error.message,
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

        const payload = parseResult.data;
        const profile = await updateProfileSettings({
            client,
            userId: user.id,
            email: user.email ?? '',
            payload,
        });

        logger.info('PUT /profile completed successfully', { userId: user.id });
        return createSuccessResponse(profile);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles POST /profile/change-password request.
 */
export async function handleChangePassword(_req: Request): Promise<Response> {
    try {
        logger.info('Handling POST /profile/change-password request');
        const { user } = await getAuthenticatedContext(_req);

        let body: unknown;
        try {
            body = await _req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const parseResult = changePasswordSchema.safeParse(body);
        if (!parseResult.success) {
            const errorMessages = parseResult.error.errors.map((error) => ({
                field: error.path.join('.'),
                message: error.message,
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

        const payload = parseResult.data;

        if (!user.email) {
            throw new ApplicationError('INTERNAL_ERROR', 'Authenticated user email is missing');
        }

        const authClient = createEphemeralAnonClient();
        await verifyCurrentPassword({
            authClient,
            userId: user.id,
            email: user.email,
            currentPassword: payload.current_password,
        });

        const adminClient = createServiceRoleClient();
        await changePassword({
            adminClient,
            userId: user.id,
            newPassword: payload.new_password,
        });

        logger.info('POST /profile/change-password completed successfully', { userId: user.id });

        return createSuccessResponse({
            status: 'ok',
            message: 'Password updated successfully.',
        });
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Extracts path after /profile from URL.
 * Supports both local (/profile) and Supabase (/functions/v1/profile) paths.
 */
function getPathFromUrl(url: string): string {
    const pathname = new URL(url).pathname;
    const match = pathname.match(/(?:\/functions\/v1)?\/profile(.*)/);
    return match ? match[1] : '';
}

/**
 * Profile router - routes HTTP methods to appropriate handlers.
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function profileRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = getPathFromUrl(req.url);

    logger.debug('Routing profile request', { method, path });

    // More specific route must be checked first.
    if (path === '/username-available') {
        if (method === 'GET') {
            return handleGetUsernameAvailable(req);
        }

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

    if (path === '/change-password') {
        if (method === 'POST') {
            return handleChangePassword(req);
        }

        return new Response(
            JSON.stringify({
                code: 'METHOD_NOT_ALLOWED',
                message: `Method ${method} not allowed`,
            }),
            {
                status: 405,
                headers: {
                    'Content-Type': 'application/json',
                    'Allow': 'POST, OPTIONS',
                },
            }
        );
    }

    if (path === '' || path === '/') {
        switch (method) {
            case 'GET':
                return handleGetProfile(req);
            case 'PUT':
                return handleUpdateProfile(req);
            case 'OPTIONS':
                // Handle CORS preflight request
                return new Response(null, {
                    status: 204,
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
                    },
                });
            default:
                logger.warn('Method not allowed', { method, path });
                return new Response(
                    JSON.stringify({
                        code: 'METHOD_NOT_ALLOWED',
                        message: `Method ${method} not allowed`,
                    }),
                    {
                        status: 405,
                        headers: {
                            'Content-Type': 'application/json',
                            'Allow': 'GET, PUT, OPTIONS',
                        },
                    }
                );
        }
    }

    logger.warn('Route not found', { method, path });
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
