export interface FunctionErrorLike {
    message?: string;
    status?: number;
    context?: { status?: number };
}

export type StatusError = Error & { status: number };

export function extractFunctionErrorStatus(
    error: FunctionErrorLike | null | undefined,
): number | null {
    if (error?.status) {
        return error.status;
    }

    if (error?.context?.status) {
        return error.context.status;
    }

    const message = error?.message?.toLowerCase() ?? '';
    if (message.includes('unauthorized') || message.includes('nieautoryzowany')) {
        return 401;
    }
    if (message.includes('forbidden') || message.includes('zabroniony')) {
        return 403;
    }
    if (message.includes('not found') || message.includes('nie znaleziono')) {
        return 404;
    }
    if (message.includes('bad request') || message.includes('nieprawidłow')) {
        return 400;
    }

    return null;
}

export function toStatusError(
    error: FunctionErrorLike | null | undefined,
    fallbackMessage: string,
    fallbackStatus = 500,
): StatusError {
    const result = new Error(error?.message || fallbackMessage) as StatusError;
    result.status = extractFunctionErrorStatus(error) ?? fallbackStatus;
    return result;
}

interface FunctionInvokeErrorBody {
    message?: string;
    code?: string;
    details?: {
        pgMessage?: string;
    };
}

/**
 * Reads JSON body from Supabase FunctionsHttpError (error.context).
 */
export async function readFunctionInvokeErrorBody(
    error: unknown,
): Promise<FunctionInvokeErrorBody | null> {
    if (!error || typeof error !== 'object') {
        return null;
    }

    const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (!context?.json) {
        return null;
    }

    try {
        const body = await context.json();
        if (!body || typeof body !== 'object') {
            return null;
        }
        return body as FunctionInvokeErrorBody;
    } catch {
        return null;
    }
}

/**
 * Prefer API error message from Edge Function response body over generic invoke wrapper text.
 */
export async function resolveFunctionInvokeErrorMessage(
    error: unknown,
    fallbackMessage: string,
): Promise<string> {
    const body = await readFunctionInvokeErrorBody(error);
    if (body?.message) {
        const pgMessage = body.details?.pgMessage;
        if (pgMessage && body.message === 'Failed to create recipe') {
            return `${body.message}: ${pgMessage}`;
        }
        return body.message;
    }

    if (error && typeof error === 'object' && 'message' in error) {
        const message = (error as { message?: string }).message;
        if (message) {
            return message;
        }
    }

    return fallbackMessage;
}
