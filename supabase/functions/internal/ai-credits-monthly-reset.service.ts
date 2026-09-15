import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { getSupabaseServiceClient } from '../_shared/supabase-client.ts';
import type { TypedSupabaseClient } from '../_shared/supabase-client.ts';

export interface AiCreditsMonthlyResetResponseDto {
    reset_count: number;
    processed_at: string;
}

/**
 * Resets every due monthly AI credit balance in one database operation.
 */
export async function runMonthlyAiCreditsReset(
    params: { supabaseAdmin?: TypedSupabaseClient } = {},
): Promise<AiCreditsMonthlyResetResponseDto> {
    const supabaseAdmin = params.supabaseAdmin ?? getSupabaseServiceClient();
    const { data, error } = await supabaseAdmin.rpc('run_ai_credits_monthly_reset');

    if (error) {
        logger.error('Monthly AI credits reset failed', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to reset monthly AI credits');
    }

    const resetCount = Number(data);
    if (!Number.isInteger(resetCount) || resetCount < 0) {
        logger.error('Monthly AI credits reset returned an invalid count', { data });
        throw new ApplicationError('INTERNAL_ERROR', 'Invalid monthly reset result');
    }

    const result: AiCreditsMonthlyResetResponseDto = {
        reset_count: resetCount,
        processed_at: new Date().toISOString(),
    };

    logger.info('Monthly AI credits reset completed', {
        resetCount: result.reset_count,
        processedAt: result.processed_at,
    });
    return result;
}
