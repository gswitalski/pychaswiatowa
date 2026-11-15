import { ApplicationError } from './errors.ts';

export type PostgrestErrorLike = {
    code?: string | null;
    message?: string | null;
    details?: string | null;
};

type MapPostgrestErrorParams = {
    fallbackMessage: string;
    categoryNotFoundMessage?: string;
};

/**
 * Maps Supabase/PostgREST RPC errors to ApplicationError with actionable messages.
 */
export function mapPostgrestErrorToApplicationError(
    rpcError: PostgrestErrorLike,
    params: MapPostgrestErrorParams,
): ApplicationError {
    const pgCode = rpcError.code ?? 'UNKNOWN';
    const pgMessage = rpcError.message ?? 'Unknown database error';
    const details = { pgCode, pgMessage, pgDetails: rpcError.details ?? null };

    if (pgCode === 'P0002' || pgMessage.includes('does not exist')) {
        return new ApplicationError(
            'NOT_FOUND',
            params.categoryNotFoundMessage ?? 'The specified category does not exist',
            details,
        );
    }

    if (pgCode === 'P0001') {
        return new ApplicationError('VALIDATION_ERROR', pgMessage, details);
    }

    if (
        pgCode === '22P02'
        || pgCode === '23514'
        || pgCode === '23505'
        || pgMessage.includes('invalid input value for enum')
        || pgMessage.toLowerCase().includes('check constraint')
    ) {
        const enumMessage = pgMessage.includes('invalid input value for enum')
            ? 'Nieprawidłowa wartość klasyfikacji przepisu (kuchnia, dieta lub trudność).'
            : pgMessage;

        return new ApplicationError('VALIDATION_ERROR', enumMessage, details);
    }

    if (pgCode === 'PGRST202' || pgMessage.includes('Could not find the function')) {
        return new ApplicationError(
            'INTERNAL_ERROR',
            'Brak wymaganej funkcji w bazie — wdróż najnowsze migracje Supabase.',
            details,
        );
    }

    return new ApplicationError('INTERNAL_ERROR', params.fallbackMessage, details);
}