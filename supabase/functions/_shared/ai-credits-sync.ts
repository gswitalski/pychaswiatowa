import type { AppRole } from './auth.ts';
import {
    getFreeDraftCredits,
    getPremiumDraftCredits,
    getPremiumImageCredits,
} from './ai-credits.ts';
import { ApplicationError } from './errors.ts';
import { logger } from './logger.ts';
import {
    createServiceRoleClient,
    type TypedSupabaseClient,
} from './supabase-client.ts';

export type AiCreditsUsageMode = 'reset' | 'keep';

export interface SyncAiCreditsForRoleParams {
    userId: string;
    newRole: AppRole;
    /** Reset usage or preserve it, capped at the new credit pool. */
    usageMode?: AiCreditsUsageMode;
    /** Premium reset date. Defaults to 30 days after `now`. */
    resetAt?: Date;
    /** Injectable clock used by deterministic callers and tests. */
    now?: Date;
}

interface CurrentAiCreditUsage {
    draft_credits_used: number;
    image_credits_used: number;
}

function capUsage(used: number, total: number): number {
    return Math.min(Math.max(0, used), total);
}

async function loadCurrentUsage(
    client: TypedSupabaseClient,
    userId: string,
): Promise<CurrentAiCreditUsage | null> {
    const { data, error } = await client
        .from('user_ai_credits')
        .select('draft_credits_used, image_credits_used')
        .eq('user_id', userId)
        .maybeSingle();

    if (error) {
        logger.error('[ai-credits-sync] Failed to read current AI credit usage', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Nie udało się odczytać bieżącego stanu kredytów AI.',
        );
    }

    return data;
}

/**
 * Synchronizes the AI credit pool after an application role change.
 * Admins bypass credit accounting and therefore require no persisted balance.
 */
export async function syncAiCreditsForRole(
    params: SyncAiCreditsForRoleParams,
    client?: TypedSupabaseClient,
): Promise<void> {
    if (params.newRole === 'admin') {
        return;
    }

    const supabaseAdmin = client ?? createServiceRoleClient();
    const now = params.now ?? new Date();
    const usageMode = params.usageMode ?? 'reset';
    const draftCreditsTotal = params.newRole === 'premium'
        ? getPremiumDraftCredits()
        : getFreeDraftCredits();
    const imageCreditsTotal = params.newRole === 'premium'
        ? getPremiumImageCredits()
        : 0;
    const currentUsage = usageMode === 'keep'
        ? await loadCurrentUsage(supabaseAdmin, params.userId)
        : null;

    const upsertPayload = {
        user_id: params.userId,
        draft_credits_total: draftCreditsTotal,
        draft_credits_used: currentUsage
            ? capUsage(currentUsage.draft_credits_used, draftCreditsTotal)
            : 0,
        image_credits_total: imageCreditsTotal,
        image_credits_used: currentUsage
            ? capUsage(currentUsage.image_credits_used, imageCreditsTotal)
            : 0,
        limit_type: params.newRole === 'premium' ? 'monthly' as const : 'lifetime' as const,
        next_reset_at: params.newRole === 'premium'
            ? (params.resetAt ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)).toISOString()
            : null,
        credits_activated_at: now.toISOString(),
    };

    const { error } = await supabaseAdmin
        .from('user_ai_credits')
        .upsert(upsertPayload, { onConflict: 'user_id' });

    if (error) {
        logger.error('[ai-credits-sync] Failed to sync AI credits after role change', {
            userId: params.userId,
            newRole: params.newRole,
            usageMode,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Rola użytkownika została zmieniona, ale synchronizacja kredytów AI nie powiodła się.',
        );
    }

    logger.info('[ai-credits-sync] AI credits synced after role change', {
        userId: params.userId,
        newRole: params.newRole,
        usageMode,
    });
}
