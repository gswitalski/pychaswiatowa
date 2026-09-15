import type { AppRole } from '../_shared/auth.ts';
import { getFreeDraftCredits } from '../_shared/ai-credits.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';

type AiCreditLimitType = 'lifetime' | 'monthly' | 'unlimited';

interface AiCreditBalanceDto {
    total: number | null;
    used: number | null;
    remaining: number | null;
}

export interface AiCreditsResponseDto {
    limit_type: AiCreditLimitType;
    draft: AiCreditBalanceDto;
    image: AiCreditBalanceDto;
    next_reset_at: string | null;
}

interface GetAiCreditsParams {
    client: TypedSupabaseClient;
    userId: string;
    appRole: AppRole;
}

const AI_CREDITS_SELECT_COLUMNS = [
    'draft_credits_total',
    'draft_credits_used',
    'image_credits_total',
    'image_credits_used',
    'limit_type',
    'next_reset_at',
].join(', ');

function createUnlimitedResponse(): AiCreditsResponseDto {
    const unlimitedBalance: AiCreditBalanceDto = {
        total: null,
        used: null,
        remaining: null,
    };

    return {
        limit_type: 'unlimited',
        draft: { ...unlimitedBalance },
        image: { ...unlimitedBalance },
        next_reset_at: null,
    };
}

function createDefaultFreeResponse(): AiCreditsResponseDto {
    const draftTotal = getFreeDraftCredits();

    return {
        limit_type: 'lifetime',
        draft: {
            total: draftTotal,
            used: 0,
            remaining: draftTotal,
        },
        image: {
            total: 0,
            used: 0,
            remaining: 0,
        },
        next_reset_at: null,
    };
}

/**
 * Returns the current AI credit balance for one authenticated user.
 */
export async function getAiCredits(
    params: GetAiCreditsParams,
): Promise<AiCreditsResponseDto> {
    if (params.appRole === 'admin') {
        return createUnlimitedResponse();
    }

    const { data, error } = await params.client
        .from('user_ai_credits')
        .select(AI_CREDITS_SELECT_COLUMNS)
        .eq('user_id', params.userId)
        .maybeSingle();

    if (error) {
        logger.error('Failed to fetch AI credits', {
            userId: params.userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch AI credits');
    }

    if (!data) {
        return createDefaultFreeResponse();
    }

    return {
        limit_type: data.limit_type,
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
        next_reset_at: data.limit_type === 'monthly' ? data.next_reset_at : null,
    };
}
