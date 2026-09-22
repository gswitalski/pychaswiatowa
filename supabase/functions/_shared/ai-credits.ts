import type { Json } from './database.types.ts';
import type { AppRole } from './auth.ts';
import { ApplicationError } from './errors.ts';
import { logger } from './logger.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';

export type AiCreditType = 'draft' | 'image';
export type AiCreditLimitType = 'lifetime' | 'monthly';

export interface AiCreditsExhaustedDetails {
    credit_type: AiCreditType;
    credits_used: number;
    credits_total: number;
    limit_type: AiCreditLimitType;
    next_reset_at?: string | null;
    upgrade_url: string;
}

export class AiCreditsExhaustedError extends ApplicationError {
    public readonly details: AiCreditsExhaustedDetails;

    constructor(details: AiCreditsExhaustedDetails) {
        const message = details.credit_type === 'image'
            ? 'Wyczerpano pulę kredytów AI na generowanie zdjęć. Dokup pakiet kredytów lub poczekaj na reset miesięczny.'
            : 'Wyczerpano pulę kredytów AI. Przejdź na Premium lub dokup pakiet kredytów.';

        super('AI_CREDITS_EXHAUSTED', message);
        this.name = 'AiCreditsExhaustedError';
        this.details = details;
    }

    override toJSON(): Record<string, unknown> {
        return {
            error: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

interface CreditReservationRpcResult {
    allowed: boolean;
    credits_used: number;
    credits_total: number;
    limit_type: AiCreditLimitType;
    next_reset_at: string | null;
}

export interface CreditReservation {
    reserved: boolean;
    remaining: number | null;
}

interface CheckAndDeductCreditsParams {
    supabaseAdmin: TypedSupabaseClient;
    userId: string;
    creditType: AiCreditType;
    appRole: AppRole;
}

interface CreditMutationParams {
    supabaseAdmin: TypedSupabaseClient;
    userId: string;
    creditType: AiCreditType;
    appRole: AppRole;
}

export function getFreeDraftCredits(): number {
    const configuredValue = Deno.env.get('AI_DRAFT_CREDITS_FREE');
    if (!configuredValue) {
        return 3;
    }

    const parsedValue = Number(configuredValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 32767) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI_DRAFT_CREDITS_FREE must be an integer between 0 and 32767',
        );
    }

    return parsedValue;
}

export function getPremiumDraftCredits(): number {
    const configuredValue = Deno.env.get('AI_DRAFT_CREDITS_PREMIUM');
    if (!configuredValue) {
        return 20;
    }

    const parsedValue = Number(configuredValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 32767) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI_DRAFT_CREDITS_PREMIUM must be an integer between 0 and 32767',
        );
    }

    return parsedValue;
}

export function getPremiumImageCredits(): number {
    const configuredValue = Deno.env.get('AI_IMAGE_CREDITS_PREMIUM');
    if (!configuredValue) {
        return 5;
    }

    const parsedValue = Number(configuredValue);
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 32767) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'AI_IMAGE_CREDITS_PREMIUM must be an integer between 0 and 32767',
        );
    }

    return parsedValue;
}

function parseReservationResult(data: Json): CreditReservationRpcResult {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Invalid response from reserve_ai_credit',
        );
    }

    const allowed = data.allowed;
    const creditsUsed = data.credits_used;
    const creditsTotal = data.credits_total;
    const limitType = data.limit_type;
    const nextResetAt = data.next_reset_at;

    const hasValidResetDate = nextResetAt === null || typeof nextResetAt === 'string';
    const hasValidLimitType = limitType === 'lifetime' || limitType === 'monthly';

    if (
        typeof allowed !== 'boolean'
        || typeof creditsUsed !== 'number'
        || typeof creditsTotal !== 'number'
        || !hasValidLimitType
        || !hasValidResetDate
    ) {
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Invalid response fields from reserve_ai_credit',
        );
    }

    return {
        allowed,
        credits_used: creditsUsed,
        credits_total: creditsTotal,
        limit_type: limitType,
        next_reset_at: nextResetAt,
    };
}

/**
 * Atomically reserves one credit before an AI provider call.
 * Admin users bypass credit accounting.
 */
export async function checkAndDeductCredits(
    params: CheckAndDeductCreditsParams,
): Promise<CreditReservation> {
    if (params.appRole === 'admin') {
        return {
            reserved: false,
            remaining: null,
        };
    }

    const { data, error } = await params.supabaseAdmin.rpc('reserve_ai_credit', {
        p_user_id: params.userId,
        p_credit_type: params.creditType,
        p_free_draft_credits: getFreeDraftCredits(),
    });

    if (error) {
        logger.error('Failed to reserve AI credit', {
            userId: params.userId,
            creditType: params.creditType,
            error: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to reserve AI credit');
    }

    const result = parseReservationResult(data);
    if (!result.allowed) {
        logger.warn('AI credits exhausted', {
            userId: params.userId,
            creditType: params.creditType,
            creditsUsed: result.credits_used,
            creditsTotal: result.credits_total,
        });

        throw new AiCreditsExhaustedError({
            credit_type: params.creditType,
            credits_used: result.credits_used,
            credits_total: result.credits_total,
            limit_type: result.limit_type,
            next_reset_at: result.next_reset_at,
            upgrade_url: '/pricing',
        });
    }

    return {
        reserved: true,
        remaining: result.credits_total - result.credits_used,
    };
}

/**
 * Confirms a credit already reserved by checkAndDeductCredits.
 */
export function deductCreditAfterSuccess(params: Omit<CreditMutationParams, 'supabaseAdmin'>): void {
    if (params.appRole === 'admin') {
        return;
    }

    logger.info('AI credit deducted', {
        userId: params.userId,
        creditType: params.creditType,
    });
}

/**
 * Returns a reserved credit when the AI provider call fails.
 */
export async function refundCreditAfterFailure(params: CreditMutationParams): Promise<void> {
    if (params.appRole === 'admin') {
        return;
    }

    const { data: refunded, error } = await params.supabaseAdmin.rpc('refund_ai_credit', {
        p_user_id: params.userId,
        p_credit_type: params.creditType,
    });

    if (error || !refunded) {
        logger.error('Failed to refund reserved AI credit', {
            userId: params.userId,
            creditType: params.creditType,
            error: error?.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to refund reserved AI credit');
    }

    logger.info('Reserved AI credit refunded', {
        userId: params.userId,
        creditType: params.creditType,
    });
}
