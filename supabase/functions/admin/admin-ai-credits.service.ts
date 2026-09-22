import { ApplicationError } from '../_shared/errors.ts';
import { getFreeDraftCredits } from '../_shared/ai-credits.ts';
import { logger } from '../_shared/logger.ts';
import { createServiceRoleClient } from '../_shared/supabase-client.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import type {
    UpdateAdminUserAiCreditsCommand,
    UpdateAdminUserAiCreditsResponseDto,
} from './admin.types.ts';

interface UpdateUserAiCreditsParams {
    targetUserId: string;
    command: UpdateAdminUserAiCreditsCommand;
    supabaseAdmin?: TypedSupabaseClient;
}

interface GetUserAiCreditsParams {
    targetUserId: string;
    supabaseAdmin?: TypedSupabaseClient;
}

const AI_CREDITS_SELECT_COLUMNS =
    'user_id, draft_credits_total, draft_credits_used, image_credits_total, image_credits_used, limit_type, next_reset_at, updated_at';

/**
 * Returns one user's AI credit balance for the admin edit dialog.
 */
export async function getUserAiCredits(
    params: GetUserAiCreditsParams,
): Promise<UpdateAdminUserAiCreditsResponseDto> {
    const supabaseAdmin = params.supabaseAdmin ?? createServiceRoleClient();
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        params.targetUserId,
    );

    if (userError || !userData.user) {
        if (userError?.status === 404 || !userData.user) {
            throw new ApplicationError('NOT_FOUND', 'Użytkownik nie został znaleziony.');
        }

        throw new ApplicationError('INTERNAL_ERROR', 'Nie udało się zweryfikować użytkownika.');
    }

    if (userData.user.app_metadata?.app_role === 'admin') {
        return {
            user_id: params.targetUserId,
            draft: { total: null, used: null, remaining: null },
            image: { total: null, used: null, remaining: null },
            limit_type: 'unlimited',
            next_reset_at: null,
            updated_at: null,
        };
    }

    const { data, error } = await supabaseAdmin
        .from('user_ai_credits')
        .select(AI_CREDITS_SELECT_COLUMNS)
        .eq('user_id', params.targetUserId)
        .maybeSingle();

    if (error) {
        logger.error('[admin] Failed to fetch AI credits', {
            targetUserId: params.targetUserId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Nie udało się pobrać kredytów AI.');
    }

    if (!data) {
        const draftTotal = getFreeDraftCredits();
        return {
            user_id: params.targetUserId,
            draft: { total: draftTotal, used: 0, remaining: draftTotal },
            image: { total: 0, used: 0, remaining: 0 },
            limit_type: 'lifetime',
            next_reset_at: null,
            updated_at: null,
        };
    }

    return {
        user_id: data.user_id,
        draft: {
            total: data.draft_credits_total,
            used: data.draft_credits_used,
            remaining: Math.max(data.draft_credits_total - data.draft_credits_used, 0),
        },
        image: {
            total: data.image_credits_total,
            used: data.image_credits_used,
            remaining: Math.max(data.image_credits_total - data.image_credits_used, 0),
        },
        limit_type: data.limit_type,
        next_reset_at: data.limit_type === 'monthly' ? data.next_reset_at : null,
        updated_at: data.updated_at,
    };
}

/**
 * Applies an administrative partial update to one user's AI credit balance.
 */
export async function updateUserAiCredits(
    params: UpdateUserAiCreditsParams,
): Promise<UpdateAdminUserAiCreditsResponseDto> {
    const supabaseAdmin = params.supabaseAdmin ?? createServiceRoleClient();
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        params.targetUserId,
    );

    if (userError || !userData.user) {
        const userNotFound = userError?.status === 404
            || userError?.message.toLowerCase().includes('not found');

        if (userNotFound || !userData.user) {
            logger.warn('[admin] User not found for AI credits update', {
                targetUserId: params.targetUserId,
            });
            throw new ApplicationError('NOT_FOUND', 'Użytkownik nie został znaleziony.');
        }

        logger.error('[admin] Failed to verify user for AI credits update', {
            targetUserId: params.targetUserId,
            errorMessage: userError?.message ?? 'Unknown authentication error',
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Nie udało się zweryfikować użytkownika.');
    }

    const { data, error } = await supabaseAdmin
        .from('user_ai_credits')
        .upsert(
            {
                user_id: params.targetUserId,
                ...params.command,
            },
            { onConflict: 'user_id' },
        )
        .select(AI_CREDITS_SELECT_COLUMNS)
        .single();

    if (error) {
        if (error.code === '23514' || error.code === '22003') {
            logger.warn('[admin] AI credits update violates data constraints', {
                targetUserId: params.targetUserId,
                errorCode: error.code,
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Wykorzystane kredyty nie mogą przekraczać dostępnego limitu.',
            );
        }

        logger.error('[admin] Failed to update AI credits', {
            targetUserId: params.targetUserId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Nie udało się zaktualizować kredytów AI.');
    }

    return {
        user_id: data.user_id,
        draft: {
            total: data.draft_credits_total,
            used: data.draft_credits_used,
            remaining: Math.max(data.draft_credits_total - data.draft_credits_used, 0),
        },
        image: {
            total: data.image_credits_total,
            used: data.image_credits_used,
            remaining: Math.max(data.image_credits_total - data.image_credits_used, 0),
        },
        limit_type: data.limit_type,
        next_reset_at: data.limit_type === 'monthly' ? data.next_reset_at : null,
        updated_at: data.updated_at,
    };
}
