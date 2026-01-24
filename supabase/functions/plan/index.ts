/**
 * Edge Function: plan
 * Main router for "My Plan" resource endpoints
 * 
 * Routes:
 * - GET / - Get user's plan
 * - POST /recipes - Add recipe to plan
 * - DELETE / - Clear entire plan
 * - DELETE /recipes/{id} - Remove recipe from plan
 */

import { logger } from '../_shared/logger.ts';
import { handleError } from '../_shared/errors.ts';
import { planRouter } from './plan.handlers.ts';
import { handleCorsPreflightRequest } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
    const startTime = Date.now();
    const { method, url } = req;
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    logger.info(`[plan] ${method} ${path}`);

    try {
        // Handle CORS preflight
        // CRITICAL: Must be at the top and return status 200
        if (method === 'OPTIONS') {
            return handleCorsPreflightRequest();
        }

        // Route to handlers
        const response = await planRouter(req);

        // Add CORS headers to response
        response.headers.set('Access-Control-Allow-Origin', '*');

        const duration = Date.now() - startTime;
        logger.info(
            `[plan] ${method} ${path} - ${response.status} (${duration}ms)`
        );

        return response;
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(
            `[plan] ${method} ${path} - Error (${duration}ms)`,
            error
        );
        return handleError(error);
    }
});

