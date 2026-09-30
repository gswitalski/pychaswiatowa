/**
 * Me Service
 * Contains business logic for the /me endpoint.
 * Provides minimal user profile data for App Shell initialization.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { type AppRole } from '../_shared/auth.ts';
import { getFreeDraftCredits } from '../_shared/ai-credits.ts';

export interface MeAiCreditsDto {
    draft_remaining: number | null;
    image_remaining: number | null;
    limit_type: 'lifetime' | 'monthly' | 'unlimited';
    next_reset_at: string | null;
}

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type SubscriptionPlanId = 'premium_monthly' | 'premium_yearly';

/**
 * Me DTO type for API responses.
 * Matches the MeDto defined in shared/contracts/types.ts
 */
export interface MeDto {
    id: string;
    username: string;
    app_role: AppRole;
    ai_credits: MeAiCreditsDto | null;
    subscription_status: SubscriptionStatus | null;
    subscription_plan_id: SubscriptionPlanId | null;
    current_period_end: string | null;
    auto_renew: boolean | null;
    trial_ends_at: string | null;
}

/** Columns to select for minimal profile queries. */
const PROFILE_SELECT_COLUMNS = 'id, username';
const AI_CREDITS_SELECT_COLUMNS =
    'draft_credits_total, draft_credits_used, image_credits_total, image_credits_used, limit_type, next_reset_at';
const SUBSCRIPTION_SELECT_COLUMNS =
    'status, plan_id, current_period_end, auto_renew, trial_ends_at';

function createAdminAiCredits(): MeAiCreditsDto {
    return {
        draft_remaining: null,
        image_remaining: null,
        limit_type: 'unlimited',
        next_reset_at: null,
    };
}

function createDefaultAiCredits(): MeAiCreditsDto {
    return {
        draft_remaining: getFreeDraftCredits(),
        image_remaining: 0,
        limit_type: 'lifetime',
        next_reset_at: null,
    };
}

/**
 * Retrieves the minimal user profile data for the authenticated user.
 * This function is specifically designed for the /me endpoint to provide
 * only the essential user information needed for UI initialization.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The user's unique identifier (from JWT)
 * @param appRole - The user's application role (from JWT custom claim)
 * @returns The user's minimal profile data as MeDto
 * @throws ApplicationError with NOT_FOUND code if profile doesn't exist
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getMeProfile(
    client: TypedSupabaseClient,
    userId: string,
    appRole: AppRole
): Promise<MeDto> {
    logger.info('Fetching minimal profile for /me', { userId, appRole });

    const profilePromise = client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', userId)
        .single();

    const creditsPromise = appRole === 'admin'
        ? Promise.resolve({ data: null, error: null })
        : client
            .from('user_ai_credits')
            .select(AI_CREDITS_SELECT_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();

    const subscriptionPromise = appRole === 'admin'
        ? Promise.resolve({ data: null, error: null })
        : client
            .from('subscriptions')
            .select(SUBSCRIPTION_SELECT_COLUMNS)
            .eq('user_id', userId)
            .maybeSingle();

    const [
        { data: profileData, error: profileError },
        { data: creditsData, error: creditsError },
        { data: subscriptionData, error: subscriptionError },
    ] = await Promise.all([profilePromise, creditsPromise, subscriptionPromise]);

    if (profileError) {
        // Handle case where no profile was found (PGRST116 = "Row not found")
        if (profileError.code === 'PGRST116') {
            logger.warn('Profile not found for authenticated user', {
                userId,
                errorCode: profileError.code,
            });
            throw new ApplicationError('NOT_FOUND', 'Profile not found');
        }

        // Log database errors without exposing sensitive details
        logger.error('Database error while fetching profile', {
            userId,
            errorCode: profileError.code,
            errorMessage: profileError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch profile');
    }

    if (creditsError) {
        logger.error('Database error while fetching AI credits for /me', {
            userId,
            errorCode: creditsError.code,
            errorMessage: creditsError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch AI credits');
    }

    if (subscriptionError) {
        logger.error('Database error while fetching subscription for /me', {
            userId,
            errorCode: subscriptionError.code,
            errorMessage: subscriptionError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch subscription');
    }

    // Additional check for empty data (defensive programming)
    if (!profileData) {
        logger.warn('Profile not found - empty data returned', { userId });
        throw new ApplicationError('NOT_FOUND', 'Profile not found');
    }

    const aiCredits: MeAiCreditsDto = appRole === 'admin'
        ? createAdminAiCredits()
        : creditsData
            ? {
                draft_remaining: Math.max(
                    creditsData.draft_credits_total - creditsData.draft_credits_used,
                    0,
                ),
                image_remaining: Math.max(
                    creditsData.image_credits_total - creditsData.image_credits_used,
                    0,
                ),
                limit_type: creditsData.limit_type,
                next_reset_at: creditsData.limit_type === 'monthly'
                    ? creditsData.next_reset_at
                    : null,
            }
            : createDefaultAiCredits();

    logger.info('Profile fetched successfully for /me', {
        userId,
        username: profileData.username,
        appRole,
    });

    return {
        id: profileData.id,
        username: profileData.username ?? '',
        app_role: appRole,
        ai_credits: aiCredits,
        subscription_status: subscriptionData
            ? subscriptionData.status as SubscriptionStatus
            : null,
        subscription_plan_id: subscriptionData
            ? subscriptionData.plan_id as SubscriptionPlanId
            : null,
        current_period_end: subscriptionData?.current_period_end ?? null,
        auto_renew: subscriptionData?.auto_renew ?? null,
        trial_ends_at: subscriptionData?.trial_ends_at ?? null,
    };
}
