/**
 * Admin Handlers
 * HTTP handlers and router for admin-only endpoints.
 */

import { extractAuthToken, extractAndValidateAppRole } from '../_shared/auth.ts';
import { ApplicationError, handleError } from '../_shared/errors.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { logger } from '../_shared/logger.ts';
import {
    getAdminSummary,
    getAdminHealth,
    type AdminSummaryDto,
    type AdminHealthDto,
} from './admin.service.ts';

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

async function requireAdminContext(req: Request): Promise<{ userId: string }> {
    const token = extractAuthToken(req);
    const jwtPayload = extractAndValidateAppRole(token);
    const { user } = await getAuthenticatedContext(req);

    if (user.id !== jwtPayload.sub) {
        logger.warn('[admin] JWT subject mismatch', {
            jwtSub: jwtPayload.sub,
            authenticatedUserId: user.id,
        });
        throw new ApplicationError('UNAUTHORIZED', 'Invalid authentication context');
    }

    if (jwtPayload.app_role !== 'admin') {
        logger.warn('[admin] Forbidden access for non-admin user', {
            userId: user.id,
            appRole: jwtPayload.app_role,
        });
        throw new ApplicationError('FORBIDDEN', 'Admin role is required');
    }

    logger.info('[admin] Admin access granted', { userId: user.id });
    return { userId: user.id };
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

    logger.warn('[admin] Unknown admin endpoint', { method, subPath });
    return createNotFoundResponse();
}
