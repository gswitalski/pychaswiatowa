import { syncAiCreditsForRole } from '../_shared/ai-credits-sync.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    getSupabaseServiceClient,
    type TypedSupabaseClient,
} from '../_shared/supabase-client.ts';

export interface BillingExpiryResponseDto {
    expired_count: number;
    credits_synced: number;
    credits_failed: number;
    processed_at: string;
}

export async function runBillingExpiry(params: {
    graceDays: number;
    supabaseAdmin?: TypedSupabaseClient;
    syncCredits?: typeof syncAiCreditsForRole;
}): Promise<BillingExpiryResponseDto> {
    const supabaseAdmin = params.supabaseAdmin ?? getSupabaseServiceClient();
    const syncCredits = params.syncCredits ?? syncAiCreditsForRole;
    const { data, error } = await supabaseAdmin.rpc('billing_expire_subscriptions', {
        p_grace_days: params.graceDays,
    });

    if (error) {
        logger.error('[billing-expiry] Subscription expiry RPC failed', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to expire subscriptions');
    }

    const expiredUsers = data ?? [];
    let creditsSynced = 0;
    let creditsFailed = 0;

    for (const row of expiredUsers) {
        if (!row.user_id) {
            throw new ApplicationError('INTERNAL_ERROR', 'Invalid billing expiry result');
        }

        try {
            await syncCredits({
                userId: row.user_id,
                newRole: 'user',
                usageMode: 'keep',
            }, supabaseAdmin);
            creditsSynced += 1;
        } catch (syncError) {
            creditsFailed += 1;
            logger.error('[billing-expiry] Failed to sync AI credits', {
                userId: row.user_id,
                error: syncError instanceof Error ? syncError.message : 'Unknown error',
            });
        }
    }

    return {
        expired_count: expiredUsers.length,
        credits_synced: creditsSynced,
        credits_failed: creditsFailed,
        processed_at: new Date().toISOString(),
    };
}
