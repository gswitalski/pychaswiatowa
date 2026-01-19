import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { processNormalizedIngredientsJobs } from './normalized-ingredients-worker.service.ts';

// #region --- Configuration ---

/** Default batch size for worker (overridable via env) */
const DEFAULT_WORKER_BATCH_SIZE = 10;

/** Get batch size from environment or use default */
function getWorkerBatchSize(): number {
    const envValue = Deno.env.get('NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE');
    if (!envValue) {
        return DEFAULT_WORKER_BATCH_SIZE;
    }
    
    const parsed = parseInt(envValue, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        logger.warn('Invalid NORMALIZED_INGREDIENTS_WORKER_BATCH_SIZE, using default', {
            envValue,
            default: DEFAULT_WORKER_BATCH_SIZE,
        });
        return DEFAULT_WORKER_BATCH_SIZE;
    }
    
    return parsed;
}

// #endregion

// #region --- Authentication ---

/**
 * Verifies internal worker secret from request header.
 * 
 * @param req - The incoming HTTP request
 * @throws ApplicationError with UNAUTHORIZED if secret is missing or invalid
 */
function verifyInternalSecret(req: Request): void {
    const providedSecret = req.headers.get('x-internal-worker-secret');
    const expectedSecret = Deno.env.get('INTERNAL_WORKER_SECRET');

    if (!expectedSecret) {
        logger.error('INTERNAL_WORKER_SECRET not configured in environment');
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Internal worker authentication not configured'
        );
    }

    if (!providedSecret || providedSecret !== expectedSecret) {
        logger.warn('Invalid or missing internal worker secret', {
            hasSecret: !!providedSecret,
        });
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Authentication required'
        );
    }
}

// #endregion

// #region --- Handlers ---

/**
 * Handles POST /workers/normalized-ingredients/run request.
 * Processes queued normalization jobs with retry/backoff logic.
 * 
 * @param req - The incoming HTTP request
 * @returns Response with processing summary
 */
async function handlePostWorkersNormalizedIngredientsRun(
    req: Request
): Promise<Response> {
    const startTime = Date.now();
    
    logger.info('Handling POST /workers/normalized-ingredients/run');

    try {
        // Step 1: Verify internal-only authentication
        verifyInternalSecret(req);

        logger.info('Internal worker authenticated successfully');

        // Step 2: Get batch size configuration
        const batchSize = getWorkerBatchSize();

        logger.info('Starting worker processing', { batchSize });

        // Step 3: Process jobs
        const summary = await processNormalizedIngredientsJobs(batchSize);

        const durationMs = Date.now() - startTime;

        logger.info('Worker run completed', {
            ...summary,
            durationMs,
        });

        // Step 4: Return summary
        return new Response(
            JSON.stringify(summary),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }
        );

    } catch (error) {
        const durationMs = Date.now() - startTime;

        // Handle ApplicationError
        if (error instanceof ApplicationError) {
            logger.error('Worker handler error', {
                code: error.code,
                message: error.message,
                durationMs,
            });

            const statusCode = error.code === 'UNAUTHORIZED' ? 401 : 500;

            return new Response(
                JSON.stringify({
                    code: error.code,
                    message: error.message,
                }),
                {
                    status: statusCode,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Handle unexpected errors
        logger.error('Unexpected worker handler error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            durationMs,
        });

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
}

// #endregion

/**
 * Router for internal endpoints.
 * Routes requests to appropriate handlers based on path.
 * 
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler or 404
 */
export async function internalRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    logger.info('Routing internal request', { path, method: req.method });

    // Match POST /internal/workers/normalized-ingredients/run
    const normalizedIngredientsWorkerMatch = path.match(
        /^\/internal\/workers\/normalized-ingredients\/run\/?$/
    );

    if (normalizedIngredientsWorkerMatch && req.method === 'POST') {
        return await handlePostWorkersNormalizedIngredientsRun(req);
    }

    // No matching route
    logger.warn('No route matched for internal request', { path, method: req.method });
    return new Response(
        JSON.stringify({
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        }),
        {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}
