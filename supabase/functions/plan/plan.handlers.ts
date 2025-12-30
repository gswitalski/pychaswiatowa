/**
 * Handlers for Plan endpoints
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { AddRecipeToPlanSchema } from './plan.types.ts';
import { addRecipeToPlan, getPlan } from './plan.service.ts';

/**
 * Main router for /plan endpoints
 */
export async function planRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { method } = req;
    
    // Extract path after /plan (Edge Runtime uses /plan, not /functions/v1/plan)
    const pathMatch = url.pathname.match(/^\/plan(.*)$/);
    const path = pathMatch ? pathMatch[1] : url.pathname;

    // Route: GET / or GET '' (root of /plan)
    if ((path === '' || path === '/') && method === 'GET') {
        return await handleGetPlan(req);
    }

    // Route: POST /recipes
    if (path === '/recipes' && method === 'POST') {
        return await handlePostPlanRecipes(req);
    }

    // No matching route
    throw new ApplicationError('NOT_FOUND', 'Endpoint not found');
}

/**
 * Handler for GET /plan
 * Returns user's plan list with recipe details
 */
export async function handleGetPlan(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { user } = await getAuthenticatedContext(req);

    logger.info(`[handleGetPlan] User ${user.id} fetching plan`);

    // 2. Call service to get plan
    const planResponse = await getPlan(user.id);

    logger.info(
        `[handleGetPlan] Returned ${planResponse.data.length} items for user ${user.id}`
    );

    // 3. Return success response
    return new Response(JSON.stringify(planResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handler for POST /plan/recipes
 * Adds a recipe to user's plan
 */
export async function handlePostPlanRecipes(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    logger.info(`[handlePostPlanRecipes] User ${user.id} adding recipe to plan`);

    // 2. Parse and validate request body
    let body: unknown;
    try {
        body = await req.json();
    } catch (_error) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Invalid JSON in request body'
        );
    }

    const validationResult = AddRecipeToPlanSchema.safeParse(body);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        throw new ApplicationError(
            'VALIDATION_ERROR',
            `recipe_id: ${firstError.message}`
        );
    }

    const { recipe_id } = validationResult.data;

    // 3. Call service to add recipe to plan
    await addRecipeToPlan(client, user.id, recipe_id);

    logger.info(
        `[handlePostPlanRecipes] Recipe ${recipe_id} added to plan for user ${user.id}`
    );

    // 4. Return success response
    return new Response(
        JSON.stringify({
            message: 'Recipe added to plan successfully.',
        }),
        {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

