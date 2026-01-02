/**
 * Custom error types for application-level error handling.
 * These errors are used throughout the Edge Functions for consistent error handling.
 */

export type ErrorCode =
    | 'VALIDATION_ERROR'
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'CONFLICT'
    | 'PAYLOAD_TOO_LARGE'
    | 'UNPROCESSABLE_ENTITY'
    | 'TOO_MANY_REQUESTS'
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
            CONFLICT: 409,
            PAYLOAD_TOO_LARGE: 413,
            UNPROCESSABLE_ENTITY: 422,
            TOO_MANY_REQUESTS: 429,
            METHOD_NOT_ALLOWED: 405,
            INTERNAL_ERROR: 500,
        };
        return statusMap[code];
    }

    /**
     * Creates a JSON-serializable error response object.
     */
    toJSON(): { code: ErrorCode; message: string } {
        return {
            code: this.code,
            message: this.message,
        };
    }
}

/**
 * Creates an HTTP Response object from an ApplicationError.
 */
export function createErrorResponse(error: ApplicationError): Response {
    return new Response(JSON.stringify(error.toJSON()), {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' },
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
