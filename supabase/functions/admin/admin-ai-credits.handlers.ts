import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { requireAdminContext } from './admin-auth.ts';
import {
    getUserAiCredits,
    updateUserAiCredits,
} from './admin-ai-credits.service.ts';
import {
    parseAndValidateAdminUserAiCreditsBody,
    validateAdminUserAiCreditsParams,
    type UpdateAdminUserAiCreditsResponseDto,
} from './admin.types.ts';

/**
 * Handles GET /admin/users/{userId}/ai-credits.
 */
export async function handleGetAdminUserAiCredits(
    req: Request,
    targetUserId: string,
): Promise<Response> {
    try {
        const { userId: adminUserId } = await requireAdminContext(req);
        const validatedTargetUserId = validateAdminUserAiCreditsParams(targetUserId);
        const result: UpdateAdminUserAiCreditsResponseDto = await getUserAiCredits({
            targetUserId: validatedTargetUserId,
        });

        logger.info('[admin] GET /admin/users/:userId/ai-credits completed', {
            adminUserId,
            targetUserId: validatedTargetUserId,
        });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles PATCH /admin/users/{userId}/ai-credits.
 */
export async function handlePatchAdminUserAiCredits(
    req: Request,
    targetUserId: string,
): Promise<Response> {
    try {
        const { userId: adminUserId } = await requireAdminContext(req);
        const validatedTargetUserId = validateAdminUserAiCreditsParams(targetUserId);
        const command = await parseAndValidateAdminUserAiCreditsBody(req);
        const result: UpdateAdminUserAiCreditsResponseDto = await updateUserAiCredits({
            targetUserId: validatedTargetUserId,
            command,
        });

        logger.info('[admin] PATCH /admin/users/:userId/ai-credits completed', {
            adminUserId,
            targetUserId: validatedTargetUserId,
            updatedFields: Object.keys(command),
        });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return handleError(error);
    }
}
