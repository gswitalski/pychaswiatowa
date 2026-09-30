import { ApplicationError } from './errors.ts';
import { logger } from './logger.ts';

function secretsMatch(received: string | null, expected: string): boolean {
    if (!received || received.length !== expected.length) {
        return false;
    }

    let difference = 0;
    for (let index = 0; index < received.length; index++) {
        difference |= received.charCodeAt(index) ^ expected.charCodeAt(index);
    }

    return difference === 0;
}

export function verifyInternalSecret(req: Request): void {
    const expectedSecret = Deno.env.get('INTERNAL_WORKER_SECRET')?.trim();
    if (!expectedSecret) {
        logger.error('[internal-auth] Internal worker authentication is not configured');
        throw new ApplicationError('INTERNAL_ERROR', 'Internal authentication not configured');
    }

    const authorization = req.headers.get('authorization');
    const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
    const headerSecret = req.headers.get('x-internal-worker-secret');

    if (
        secretsMatch(headerSecret, expectedSecret)
        || secretsMatch(bearerToken, expectedSecret)
    ) {
        return;
    }

    throw new ApplicationError('UNAUTHORIZED', 'Authentication required');
}
