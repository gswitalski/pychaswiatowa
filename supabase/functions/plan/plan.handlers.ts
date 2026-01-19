/**
 * Handlers for Plan endpoints
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { AddRecipeToPlanSchema } from './plan.types.ts';
import { addRecipeToPlan, getPlan, removeRecipeFromPlan, clearPlan } from './plan.service.ts';

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

    // Route: DELETE / or DELETE '' (clear entire plan)
    if ((path === '' || path === '/') && method === 'DELETE') {
        return await handleDeletePlan(req);
    }

    // Route: DELETE /recipes/{recipeId}
    const deleteRecipeMatch = path.match(/^\/recipes\/([^/]+)$/);
    if (deleteRecipeMatch && method === 'DELETE') {
        const recipeIdParam = deleteRecipeMatch[1];
        return await handleDeletePlanRecipe(req, recipeIdParam);
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

/**
 * Handler for DELETE /plan
 * Clears the entire plan (removes all recipes) for the authenticated user
 * 
 * This endpoint is idempotent: clearing an already-empty plan is considered a success.
 */
export async function handleDeletePlan(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    logger.info(`[handleDeletePlan] User ${user.id} clearing entire plan`);

    // 2. Call service to clear plan
    const deletedCount = await clearPlan({ client, userId: user.id });

    logger.info(
        `[handleDeletePlan] Plan cleared for user ${user.id} (${deletedCount} items removed)`
    );

    // 3. Return success response (204 No Content)
    return new Response(null, {
        status: 204,
    });
}

/**
 * Handler for DELETE /plan/recipes/{recipeId}
 * Removes a recipe from user's plan and updates shopping list.
 * 
 * Side-effect: Atomically subtracts recipe's ingredient contributions from shopping list.
 */
export async function handleDeletePlanRecipe(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    logger.info(
        `[handleDeletePlanRecipe] User ${user.id} attempting to remove recipe ${recipeIdParam} from plan`
    );

    // 2. Validate and parse recipeId from path parameter
    const recipeId = Number.parseInt(recipeIdParam, 10);

    // Guard clauses for validation
    if (!Number.isFinite(recipeId)) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'recipeId must be a valid number'
        );
    }

    if (!Number.isInteger(recipeId)) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'recipeId must be an integer'
        );
    }

    if (recipeId <= 0) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'recipeId must be a positive integer'
        );
    }

    // 3. Call service to remove recipe from plan
    await removeRecipeFromPlan(client, user.id, recipeId);

    logger.info(
        `[handleDeletePlanRecipe] Recipe ${recipeId} removed from plan for user ${user.id}`
    );

    // 4. Return success response (204 No Content)
    return new Response(null, {
        status: 204,
    });
}

