/**
 * Admin Handlers
 * HTTP handlers and router for admin-only endpoints.
 */

import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { requireAdminContext } from './admin-auth.ts';
import { handlePatchAdminUserAiCredits } from './admin-ai-credits.handlers.ts';
import {
    getAdminSummary,
    getAdminHealth,
    getAdminUsers,
    updateUserRole,
    type AdminSummaryDto,
    type AdminHealthDto,
} from './admin.service.ts';
import {
    validateAdminUsersQuery,
    validateAdminUserRoleParams,
    parseAndValidateAdminUserRoleBody,
    type GetAdminUsersResponseDto,
    type UpdateAdminUserRoleResponseDto,
} from './admin.types.ts';

function createSuccessResponse<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function createMethodNotAllowedResponse(method: string, allowedMethods: string): Response {
    logger.warn('[admin] Method not allowed', { method, allowedMethods });
    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed`,
        }),
        {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                Allow: allowedMethods,
            },
        }
    );
}

function createNotFoundResponse(): Response {
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

export async function handleGetAdminSummary(req: Request): Promise<Response> {
    try {
        const { userId } = await requireAdminContext(req);
        const response: AdminSummaryDto = await getAdminSummary();

        logger.info('[admin] GET /admin/summary completed', { userId });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

export async function handleGetAdminHealth(req: Request): Promise<Response> {
    try {
        const { userId } = await requireAdminContext(req);
        const response: AdminHealthDto = await getAdminHealth();

        logger.info('[admin] GET /admin/health completed', { userId });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

export async function handleGetAdminUsers(req: Request): Promise<Response> {
    try {
        const { userId } = await requireAdminContext(req);
        const query = validateAdminUsersQuery(new URL(req.url).searchParams);
        const response: GetAdminUsersResponseDto = await getAdminUsers({ query });

        logger.info('[admin] GET /admin/users completed', { userId, query });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

export async function handlePatchAdminUserRole(
    req: Request,
    targetUserId: string
): Promise<Response> {
    try {
        const { userId: adminUserId } = await requireAdminContext(req);
        const validatedTargetUserId = validateAdminUserRoleParams(targetUserId);
        const command = await parseAndValidateAdminUserRoleBody(req);
        const response: UpdateAdminUserRoleResponseDto = await updateUserRole({
            adminUserId,
            targetUserId: validatedTargetUserId,
            appRole: command.app_role,
        });

        logger.info('[admin] PATCH /admin/users/:userId/role completed', {
            adminUserId,
            targetUserId: validatedTargetUserId,
            appRole: command.app_role,
        });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

export async function adminRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = new URL(req.url).pathname;

    const match = path.match(/\/admin(\/.*)?$/);
    if (!match) {
        logger.warn('[admin] Path does not match /admin/*', { path });
        return createNotFoundResponse();
    }

    const subPath = match[1] || '/';

    if (subPath === '/summary') {
        if (method === 'GET') {
            return handleGetAdminSummary(req);
        }
        return createMethodNotAllowedResponse(method, 'GET, OPTIONS');
    }

    if (subPath === '/health') {
        if (method === 'GET') {
            return handleGetAdminHealth(req);
        }
        return createMethodNotAllowedResponse(method, 'GET, OPTIONS');
    }

    const userAiCreditsMatch = subPath.match(/^\/users\/([^/]+)\/ai-credits$/);
    if (userAiCreditsMatch) {
        if (method === 'PATCH') {
            return handlePatchAdminUserAiCredits(req, userAiCreditsMatch[1]);
        }
        return createMethodNotAllowedResponse(method, 'PATCH, OPTIONS');
    }

    const userRoleMatch = subPath.match(/^\/users\/([^/]+)\/role$/);
    if (userRoleMatch) {
        if (method === 'PATCH') {
            return handlePatchAdminUserRole(req, userRoleMatch[1]);
        }
        return createMethodNotAllowedResponse(method, 'PATCH, OPTIONS');
    }

    if (subPath === '/users') {
        if (method === 'GET') {
            return handleGetAdminUsers(req);
        }
        return createMethodNotAllowedResponse(method, 'GET, OPTIONS');
    }

    logger.warn('[admin] Unknown admin endpoint', { method, subPath });
    return createNotFoundResponse();
}
