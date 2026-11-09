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
