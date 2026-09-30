/**
 * Custom error types for application-level error handling.
 * These errors are used throughout the Edge Functions for consistent error handling.
 */

export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'FORBIDDEN_ROLE'
    | 'CONFLICT'
    | 'SUBSCRIPTION_ALREADY_ACTIVE'
    | 'AI_CREDITS_EXHAUSTED'
    | 'PLAN_LIMIT_EXCEEDED_FREE'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNPROCESSABLE_ENTITY'
    | 'TOO_MANY_REQUESTS'
    | 'RATE_LIMITED'
    | 'PAYMENT_PROVIDER_ERROR'
    | 'INVALID_SIGNATURE'
    | 'METHOD_NOT_ALLOWED'
    | 'INTERNAL_ERROR';

/**
 * Custom application error that can be thrown throughout the application.
 * Contains an error code for programmatic handling and a message for users.
 */
export class ApplicationError extends Error {
    public readonly code: ErrorCode;
    public readonly statusCode: number;

    constructor(code: ErrorCode, message: string) {
        super(message);
        this.name = 'ApplicationError';
        this.code = code;
        this.statusCode = ApplicationError.getStatusCode(code);
    }

    /**
     * Maps error codes to HTTP status codes.
     */
    private static getStatusCode(code: ErrorCode): number {
        const statusMap: Record<ErrorCode, number> = {
            VALIDATION_ERROR: 400,
            NOT_FOUND: 404,
            UNAUTHORIZED: 401,
            FORBIDDEN: 403,
            FORBIDDEN_ROLE: 403,
            CONFLICT: 409,
            SUBSCRIPTION_ALREADY_ACTIVE: 409,
            AI_CREDITS_EXHAUSTED: 402,
            PLAN_LIMIT_EXCEEDED_FREE: 422,
            PAYLOAD_TOO_LARGE: 413,
            UNPROCESSABLE_ENTITY: 422,
            TOO_MANY_REQUESTS: 429,
            RATE_LIMITED: 429,
            PAYMENT_PROVIDER_ERROR: 502,
            INVALID_SIGNATURE: 400,
            METHOD_NOT_ALLOWED: 405,
            INTERNAL_ERROR: 500,
        };
        return statusMap[code];
    }

    /**
     * Creates a JSON-serializable error response object.
     */
    toJSON(): Record<string, unknown> {
        return {
            code: this.code,
            message: this.message,
        };
    }
}

/**
 * Rate limit error carrying the Retry-After hint in seconds.
 */
export class RateLimitedError extends ApplicationError {
    public readonly retryAfterSeconds: number;

    constructor(retryAfterSeconds: number) {
        super('RATE_LIMITED', 'Zbyt wiele prób. Spróbuj ponownie za chwilę.');
        this.name = 'RateLimitedError';
        this.retryAfterSeconds = Math.max(0, Math.ceil(retryAfterSeconds));
    }
}

/**
 * Error returned when a Free user reaches the plan item limit.
 */
export class PlanLimitExceededFreeError extends ApplicationError {
    public readonly details: {
        free_limit: number;
        premium_limit: 50;
        upgrade_url: '/pricing';
    };

    constructor(freeLimit: number) {
        super(
            'PLAN_LIMIT_EXCEEDED_FREE',
            'Osiągnięto limit pozycji w Moim planie dla konta Free.'
        );
        this.details = {
            free_limit: freeLimit,
            premium_limit: 50,
            upgrade_url: '/pricing',
        };
    }

    override toJSON(): Record<string, unknown> {
        return {
            error: this.code,
            message: this.message,
            details: this.details,
        };
    }
}

/**
 * Creates an HTTP Response object from an ApplicationError.
 */
export function createErrorResponse(error: ApplicationError): Response {
    const headers = new Headers({ 'Content-Type': 'application/json' });
    if (error instanceof RateLimitedError) {
        headers.set('Retry-After', String(error.retryAfterSeconds));
    }

    return new Response(JSON.stringify(error.toJSON()), {
        status: error.statusCode,
        headers,
    });
}

/**
 * Handles any error and returns an appropriate HTTP Response.
 * ApplicationErrors are handled gracefully, while unknown errors result in 500.
 */
export function handleError(error: unknown): Response {
    if (error instanceof ApplicationError) {
        return createErrorResponse(error);
    }

    console.error('Unexpected error:', error);

    return new Response(
        JSON.stringify({
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        }),
        {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
