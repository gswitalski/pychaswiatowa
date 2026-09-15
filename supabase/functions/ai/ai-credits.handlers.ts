import { extractAndValidateAppRole, extractAuthToken } from '../_shared/auth.ts';
import { handleError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { getAiCredits, type AiCreditsResponseDto } from './ai-credits.service.ts';

/**
 * Handles GET /ai/credits for the authenticated user.
 */
export async function handleGetAiCredits(req: Request): Promise<Response> {
    try {
        const token = extractAuthToken(req);
        const jwtPayload = extractAndValidateAppRole(token);
        const { client, user } = await getAuthenticatedContext(req);

        if (user.id !== jwtPayload.sub) {
            logger.warn('User ID mismatch while fetching AI credits', {
                jwtSub: jwtPayload.sub,
                authenticatedUserId: user.id,
            });
            return handleError(new Error('User ID mismatch'));
        }

        const credits = await getAiCredits({
            client,
            userId: user.id,
            appRole: jwtPayload.app_role,
        });

        logger.info('AI credits fetched successfully', {
            userId: user.id,
            appRole: jwtPayload.app_role,
            limitType: credits.limit_type,
        });

        return new Response(JSON.stringify(credits satisfies AiCreditsResponseDto), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return handleError(error);
    }
}
