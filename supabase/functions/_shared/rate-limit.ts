import { ApplicationError } from './errors.ts';
import type { TypedSupabaseClient } from './supabase-client.ts';

type FixedWindowCounter = {
    windowStartMs: number;
    count: number;
};

type InMemoryStore = Map<string, FixedWindowCounter>;

type CheckFixedWindowParams = {
    key: string;
    limit: number;
    windowSeconds: number;
    nowMs?: number;
};

type FixedWindowResult = {
    allowed: boolean;
    retryAfterSeconds: number;
    remaining: number;
};

type CheckAiImageRateLimitParams = {
    userId: string;
    nowMs?: number;
    supabaseClient?: TypedSupabaseClient;
};

type AiImageRateLimitResult = {
    allowed: boolean;
    retryAfterSeconds: number;
    violatedWindow: 'short' | 'daily' | null;
};

const RATE_LIMIT_STORE_KEY = '__pychaRateLimitStore';

function getStore(): InMemoryStore {
    const globalScope = globalThis as unknown as Record<string, unknown>;
    const existingStore = globalScope[RATE_LIMIT_STORE_KEY];
    if (existingStore instanceof Map) {
        return existingStore as InMemoryStore;
    }

    const store: InMemoryStore = new Map();
    globalScope[RATE_LIMIT_STORE_KEY] = store;
    return store;
}

function getEnvNumber(envName: string, fallback: number): number {
    const rawValue = Deno.env.get(envName);
    if (!rawValue) {
        return fallback;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return fallback;
    }

    return Math.floor(parsedValue);
}

function checkFixedWindowLimit(params: CheckFixedWindowParams): FixedWindowResult {
    const nowMs = params.nowMs ?? Date.now();
    const windowMs = params.windowSeconds * 1000;
    const store = getStore();
    const currentCounter = store.get(params.key);

    if (!currentCounter || nowMs - currentCounter.windowStartMs >= windowMs) {
        store.set(params.key, {
            windowStartMs: nowMs,
            count: 1,
        });

        return {
            allowed: true,
            retryAfterSeconds: 0,
            remaining: Math.max(params.limit - 1, 0),
        };
    }

    if (currentCounter.count >= params.limit) {
        const retryAfterMs = (currentCounter.windowStartMs + windowMs) - nowMs;
        return {
            allowed: false,
            retryAfterSeconds: Math.max(Math.ceil(retryAfterMs / 1000), 1),
            remaining: 0,
        };
    }

    currentCounter.count += 1;
    store.set(params.key, currentCounter);

    return {
        allowed: true,
        retryAfterSeconds: 0,
        remaining: Math.max(params.limit - currentCounter.count, 0),
    };
}

export function checkAiImageRateLimit(
    params: CheckAiImageRateLimitParams,
): AiImageRateLimitResult {
    const shortWindowLimit = getEnvNumber('AI_IMAGE_RATE_LIMIT_SHORT_LIMIT', 1);
    const shortWindowSeconds = getEnvNumber('AI_IMAGE_RATE_LIMIT_SHORT_WINDOW_SECONDS', 30);
    const dailyLimit = getEnvNumber('AI_IMAGE_RATE_LIMIT_DAILY_LIMIT', 40);
    const dailyWindowSeconds = getEnvNumber('AI_IMAGE_RATE_LIMIT_DAILY_WINDOW_SECONDS', 86400);
    const nowMs = params.nowMs ?? Date.now();

    const shortCheck = checkFixedWindowLimit({
        key: `ai-image:short:${params.userId}`,
        limit: shortWindowLimit,
        windowSeconds: shortWindowSeconds,
        nowMs,
    });

    if (!shortCheck.allowed) {
        return {
            allowed: false,
            retryAfterSeconds: shortCheck.retryAfterSeconds,
            violatedWindow: 'short',
        };
    }

    const dailyCheck = checkFixedWindowLimit({
        key: `ai-image:daily:${params.userId}`,
        limit: dailyLimit,
        windowSeconds: dailyWindowSeconds,
        nowMs,
    });

    if (!dailyCheck.allowed) {
        return {
            allowed: false,
            retryAfterSeconds: dailyCheck.retryAfterSeconds,
            violatedWindow: 'daily',
        };
    }

    return {
        allowed: true,
        retryAfterSeconds: 0,
        violatedWindow: null,
    };
}

type DbRateLimitRow = {
    allowed: boolean;
    retry_after_seconds: number;
    current_count: number;
    window_start: string;
};

async function checkDbFixedWindowLimit(params: {
    supabaseClient: TypedSupabaseClient;
    key: string;
    windowSeconds: number;
    limit: number;
    nowMs: number;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
    const { data, error } = await params.supabaseClient.rpc('ai_rate_limit_hit', {
        p_key: params.key,
        p_window_seconds: params.windowSeconds,
        p_limit: params.limit,
        p_now: new Date(params.nowMs).toISOString(),
    });

    if (error) {
        throw error;
    }

    const rows = (data ?? []) as DbRateLimitRow[];
    const firstRow = rows[0];

    if (!firstRow) {
        throw new Error('ai_rate_limit_hit returned no rows');
    }

    return {
        allowed: !!firstRow.allowed,
        retryAfterSeconds: Number(firstRow.retry_after_seconds) || 0,
    };
}

export async function checkAiImageRateLimitWithStorage(
    params: CheckAiImageRateLimitParams,
): Promise<AiImageRateLimitResult> {
    const shortWindowLimit = getEnvNumber('AI_IMAGE_RATE_LIMIT_SHORT_LIMIT', 1);
    const shortWindowSeconds = getEnvNumber('AI_IMAGE_RATE_LIMIT_SHORT_WINDOW_SECONDS', 30);
    const dailyLimit = getEnvNumber('AI_IMAGE_RATE_LIMIT_DAILY_LIMIT', 40);
    const dailyWindowSeconds = getEnvNumber('AI_IMAGE_RATE_LIMIT_DAILY_WINDOW_SECONDS', 86400);
    const nowMs = params.nowMs ?? Date.now();

    // Fallback to in-memory limiter when DB client is unavailable.
    if (!params.supabaseClient) {
        return checkAiImageRateLimit({ userId: params.userId, nowMs });
    }

    try {
        const shortResult = await checkDbFixedWindowLimit({
            supabaseClient: params.supabaseClient,
            key: 'ai_image_short',
            windowSeconds: shortWindowSeconds,
            limit: shortWindowLimit,
            nowMs,
        });

        if (!shortResult.allowed) {
            return {
                allowed: false,
                retryAfterSeconds: shortResult.retryAfterSeconds,
                violatedWindow: 'short',
            };
        }

        const dailyResult = await checkDbFixedWindowLimit({
            supabaseClient: params.supabaseClient,
            key: 'ai_image_daily',
            windowSeconds: dailyWindowSeconds,
            limit: dailyLimit,
            nowMs,
        });

        if (!dailyResult.allowed) {
            return {
                allowed: false,
                retryAfterSeconds: dailyResult.retryAfterSeconds,
                violatedWindow: 'daily',
            };
        }

        return {
            allowed: true,
            retryAfterSeconds: 0,
            violatedWindow: null,
        };
    } catch {
        // Fail open to in-memory limiter when DB/RPC is temporarily unavailable.
        return checkAiImageRateLimit({ userId: params.userId, nowMs });
    }
}

export function assertAiImageRateLimit(params: CheckAiImageRateLimitParams): void {
    const rateLimitResult = checkAiImageRateLimit(params);
    if (rateLimitResult.allowed) {
        return;
    }

    const windowLabel = rateLimitResult.violatedWindow === 'daily'
        ? 'daily'
        : 'short-term';

    throw new ApplicationError(
        'TOO_MANY_REQUESTS',
        `Rate limit exceeded for AI image generation (${windowLabel} window).`
    );
}
