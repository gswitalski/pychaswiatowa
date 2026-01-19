import { logger } from '../_shared/logger.ts';
import { internalRouter } from './internal.handlers.ts';

/**
 * Main request handler for the internal function.
 * Handles internal-only endpoints (workers, maintenance tasks).
 * 
 * NO CORS: Internal endpoints should NOT be accessible from browsers.
 */
Deno.serve(async (req: Request): Promise<Response> => {
    logger.info('Incoming request to /internal', {
        method: req.method,
        url: req.url,
    });

    try {
        // Route the request to the internal router
        const response = await internalRouter(req);
        return response;
    } catch (error) {
        logger.error('Unhandled error in internal function', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
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
});
