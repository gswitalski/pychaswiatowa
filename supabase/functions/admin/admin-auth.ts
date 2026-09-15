import { extractAndValidateAppRole, extractAuthToken } from '../_shared/auth.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';

export async function requireAdminContext(req: Request): Promise<{ userId: string }> {
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
