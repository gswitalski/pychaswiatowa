/**
 * Business logic for Plan operations
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { TypedSupabaseClient, createServiceRoleClient } from '../_shared/supabase-client.ts';
import type { RecipeAccessInfo } from './plan.types.ts';

/**
 * Adds a recipe to user's plan.
 * 
 * Business rules:
 * - User can add own recipes (any visibility)
 * - User can add public recipes from other users
 * - Recipe must exist and not be soft-deleted
 * - Recipe cannot already be in plan (enforced by DB unique constraint)
 * - Plan cannot exceed 50 items (enforced by DB trigger)
 * 
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param recipeId - The ID of the recipe to add
 * @throws ApplicationError
 * - FORBIDDEN: User doesn't have access to recipe
 * - NOT_FOUND: Recipe doesn't exist or is deleted
 * - CONFLICT: Recipe already in plan
 * - UNPROCESSABLE_ENTITY: Plan limit reached
 */
export async function addRecipeToPlan(
    client: TypedSupabaseClient,
    userId: string,
    recipeId: number
): Promise<void> {

    // 1. Verify recipe access (use service role to bypass RLS for read)
    await verifyRecipeAccess(userId, recipeId);

    // 2. Insert into plan_recipes (use user context to enforce RLS)
    await insertRecipeToPlan(client, recipeId);

    logger.info(
        `[addRecipeToPlan] Recipe ${recipeId} added to plan for user ${userId}`
    );
}

/**
 * Verifies that user has access to the recipe.
 * Returns minimal recipe info if access is granted.
 * 
 * @throws ApplicationError
 * - NOT_FOUND: Recipe doesn't exist or is deleted
 * - FORBIDDEN: User doesn't have access to recipe
 */
async function verifyRecipeAccess(
    userId: string,
    recipeId: number
): Promise<RecipeAccessInfo> {
    const supabase = createServiceRoleClient();

    // Fetch minimal recipe data
    const { data: recipe, error } = await supabase
        .from('recipes')
        .select('id, user_id, visibility, deleted_at')
        .eq('id', recipeId)
        .single();

    if (error || !recipe) {
        logger.warn(
            `[verifyRecipeAccess] Recipe ${recipeId} not found: ${error?.message}`
        );
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    // Check if recipe is soft-deleted
    if (recipe.deleted_at !== null) {
        logger.warn(
            `[verifyRecipeAccess] Recipe ${recipeId} is soft-deleted`
        );
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    // Check access rules:
    // - Own recipe: always allowed
    // - Other's recipe: only if PUBLIC
    const isOwner = recipe.user_id === userId;
    const isPublic = recipe.visibility === 'PUBLIC';

    if (!isOwner && !isPublic) {
        logger.warn(
            `[verifyRecipeAccess] User ${userId} doesn't have access to recipe ${recipeId}`
        );
        throw new ApplicationError(
            'FORBIDDEN',
            'You do not have access to this recipe'
        );
    }

    return recipe as RecipeAccessInfo;
}

/**
 * Inserts recipe into plan_recipes table.
 * Uses user context client to enforce RLS.
 * 
 * @param client - The authenticated Supabase client (user context)
 * @param recipeId - The ID of the recipe to add
 * @throws ApplicationError
 * - CONFLICT: Recipe already in plan (unique constraint violation)
 * - UNPROCESSABLE_ENTITY: Plan limit reached (trigger exception)
 */
async function insertRecipeToPlan(
    client: TypedSupabaseClient,
    recipeId: number
): Promise<void> {
    const { error } = await client.from('plan_recipes').insert({
        recipe_id: recipeId,
        // user_id is auto-filled by default auth.uid()
    });

    if (error) {
        // Handle unique constraint violation (duplicate)
        if (error.code === '23505') {
            logger.warn(
                `[insertRecipeToPlan] Recipe ${recipeId} already in plan (duplicate)`
            );
            throw new ApplicationError(
                'CONFLICT',
                'Recipe is already in plan'
            );
        }

        // Handle limit trigger exception
        if (
            error.message.includes('PLAN_LIMIT_EXCEEDED') ||
            error.message.includes('Plan limit reached')
        ) {
            logger.warn(
                `[insertRecipeToPlan] Plan limit reached (50 recipes)`
            );
            throw new ApplicationError(
                'UNPROCESSABLE_ENTITY',
                'Plan limit reached (50 recipes)'
            );
        }

        // Other database errors
        logger.error(
            `[insertRecipeToPlan] Failed to insert recipe ${recipeId} to plan`,
            error
        );
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to add recipe to plan'
        );
    }
}

