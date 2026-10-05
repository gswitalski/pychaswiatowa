import { CHECKOUT_DEFAULT_RETRY_AFTER_SECONDS } from '../checkout.constants';
import type { CheckoutErrorCode, CheckoutErrorViewModel } from '../models/checkout.model';

interface ApiErrorBody {
    error: string;
    message?: string;
    details?: unknown;
}

interface HttpErrorContext {
    status: number;
    headers: {
        get(name: string): string | null;
    };
    json(): Promise<unknown>;
}

const ERROR_CODE_BY_STATUS: Readonly<Record<number, CheckoutErrorCode>> = {
    400: 'VALIDATION_ERROR',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN_ROLE',
    409: 'SUBSCRIPTION_ALREADY_ACTIVE',
    429: 'RATE_LIMITED',
    502: 'PAYMENT_PROVIDER_ERROR',
};

const KNOWN_ERROR_CODES: readonly CheckoutErrorCode[] = [
    'VALIDATION_ERROR',
    'SUBSCRIPTION_ALREADY_ACTIVE',
    'FORBIDDEN_ROLE',
    'RATE_LIMITED',
    'PAYMENT_PROVIDER_ERROR',
    'UNAUTHORIZED',
];

export async function mapCheckoutError(error: unknown): Promise<CheckoutErrorViewModel> {
    const context = getHttpContext(error);
    if (!context) {
        return createCheckoutError('NETWORK_ERROR', 0);
    }

    const body = await readErrorBody(context);
    const bodyCode = body?.error;
    const code = isKnownErrorCode(bodyCode)
        ? bodyCode
        : context.status >= 500
          ? 'PAYMENT_PROVIDER_ERROR'
          : (ERROR_CODE_BY_STATUS[context.status] ?? 'UNKNOWN');

    if (code === 'RATE_LIMITED') {
        return {
            ...createCheckoutError(code, context.status),
            retryAfterSeconds: parseRetryAfter(context.headers.get('Retry-After')),
        };
    }

    return createCheckoutError(code, context.status);
}

export function createUnknownCheckoutError(): CheckoutErrorViewModel {
    return createCheckoutError('UNKNOWN', 500);
}

export function createPaymentProviderError(): CheckoutErrorViewModel {
    return createCheckoutError('PAYMENT_PROVIDER_ERROR', 502);
}

function createCheckoutError(code: CheckoutErrorCode, status: number): CheckoutErrorViewModel {
    const messages: Readonly<Record<CheckoutErrorCode, string>> = {
        VALIDATION_ERROR: 'Sprawdź wybrane opcje i zgody.',
        SUBSCRIPTION_ALREADY_ACTIVE: 'Masz już aktywne konto Premium.',
        FORBIDDEN_ROLE: 'To konto nie może kupić subskrypcji Premium.',
        RATE_LIMITED: 'Zbyt wiele prób. Spróbuj ponownie za minutę.',
        PAYMENT_PROVIDER_ERROR:
            'Nie udało się rozpocząć płatności. Nic nie zostało pobrane. Spróbuj ponownie.',
        UNAUTHORIZED: 'Sesja wygasła. Zaloguj się ponownie.',
        NETWORK_ERROR: 'Nie udało się rozpocząć płatności. Sprawdź połączenie i spróbuj ponownie.',
        UNKNOWN: 'Nie udało się rozpocząć płatności. Nic nie zostało pobrane. Spróbuj ponownie.',
    };

    return {
        code,
        message: messages[code],
        status,
    };
}

function getHttpContext(error: unknown): HttpErrorContext | null {
    if (!error || typeof error !== 'object') {
        return null;
    }

    const context = (error as { context?: unknown }).context;
    if (!context || typeof context !== 'object') {
        return null;
    }

    const candidate = context as Partial<HttpErrorContext>;
    if (
        typeof candidate.status !== 'number' ||
        typeof candidate.json !== 'function' ||
        !candidate.headers ||
        typeof candidate.headers.get !== 'function'
    ) {
        return null;
    }

    return candidate as HttpErrorContext;
}

async function readErrorBody(context: HttpErrorContext): Promise<ApiErrorBody | null> {
    try {
        const body = await context.json();
        if (!body || typeof body !== 'object') {
            return null;
        }

        const errorCode = (body as Partial<ApiErrorBody>).error;
        return typeof errorCode === 'string' ? (body as ApiErrorBody) : null;
    } catch {
        return null;
    }
}

function isKnownErrorCode(value: unknown): value is CheckoutErrorCode {
    return typeof value === 'string' && KNOWN_ERROR_CODES.includes(value as CheckoutErrorCode);
}

function parseRetryAfter(value: string | null): number {
    if (!value) {
        return CHECKOUT_DEFAULT_RETRY_AFTER_SECONDS;
    }

    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : CHECKOUT_DEFAULT_RETRY_AFTER_SECONDS;
}
