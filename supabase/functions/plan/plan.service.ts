/**
 * Business logic for Plan operations
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { TypedSupabaseClient, createServiceRoleClient } from '../_shared/supabase-client.ts';
import type { RecipeAccessInfo, GetPlanResponseDto, PlanRecipeRow } from './plan.types.ts';

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

/**
 * Retrieves user's plan list with recipe details.
 *
 * Business rules:
 * - Returns only recipes that are:
 *   - Not soft-deleted (deleted_at IS NULL)
 *   - Either owned by user OR public
 * - Sorted by added_at DESC (newest first)
 * - Limited to 50 items
 *
 * @param userId - The ID of the authenticated user
 * @returns GetPlanResponseDto with data and meta
 * @throws ApplicationError on database errors
 */
export async function getPlan(userId: string): Promise<GetPlanResponseDto> {
    const supabase = createServiceRoleClient();

    // Query plan_recipes with join to recipes
    // Filter: user's plan + not deleted + (owner OR public)
    // Note: używamy recipes!fk_plan_recipes_recipe aby jawnie wskazać foreign key
    const { data, error } = await supabase
        .from('plan_recipes')
        .select(
            `
            recipe_id,
            added_at,
            recipes!fk_plan_recipes_recipe (
                id,
                name,
                image_path,
                user_id,
                visibility,
                deleted_at
            )
        `
        )
        .eq('user_id', userId)
        .order('added_at', { ascending: false })
        .limit(50);

    if (error) {
        logger.error(`[getPlan] Failed to fetch plan for user ${userId}`, error);
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to fetch plan'
        );
    }

    // Type assertion for the joined data
    const planRows = data as unknown as PlanRecipeRow[];

    // Filter out inaccessible recipes (soft-deleted or non-public non-owned)
    const accessibleItems = planRows.filter((row) => {
        const recipe = row.recipes;

        // Recipe must exist (shouldn't happen with foreign key, but defensive)
        if (!recipe) {
            logger.warn(
                `[getPlan] Plan item recipe_id=${row.recipe_id} has no recipe data (orphaned?)`
            );
            return false;
        }

        // Filter out soft-deleted recipes
        if (recipe.deleted_at !== null) {
            logger.info(
                `[getPlan] Hiding soft-deleted recipe ${recipe.id} from plan`
            );
            return false;
        }

        // Filter out recipes user doesn't have access to
        const isOwner = recipe.user_id === userId;
        const isPublic = recipe.visibility === 'PUBLIC';

        if (!isOwner && !isPublic) {
            logger.info(
                `[getPlan] Hiding non-accessible recipe ${recipe.id} from plan (not owner, not public)`
            );
            return false;
        }

        return true;
    });

    // Map to DTO format
    const planItems = accessibleItems.map((row) => ({
        recipe_id: row.recipe_id,
        added_at: row.added_at,
        recipe: {
            id: row.recipes.id,
            name: row.recipes.name,
            image_path: row.recipes.image_path,
        },
    }));

    const total = planItems.length;

    logger.info(
        `[getPlan] User ${userId} plan: ${total} accessible items (filtered from ${planRows.length} total)`
    );

    return {
        data: planItems,
        meta: {
            total,
            limit: 50,
        },
    };
}

/**
 * Clears the entire plan for a user (removes all recipes).
 *
 * Business rules:
 * - Removes ALL recipes from user's plan
 * - Idempotent: clearing an empty plan is considered success
 * - Uses user-context client to enforce RLS (user can only clear their own plan)
 *
 * @param params - Object containing client and userId
 * @param params.client - The authenticated Supabase client (user context)
 * @param params.userId - The ID of the authenticated user (for logging)
 * @returns The number of items deleted (0-50)
 * @throws ApplicationError
 * - INTERNAL_ERROR: Database operation failed
 */
export async function clearPlan(params: {
    client: TypedSupabaseClient;
    userId: string;
}): Promise<number> {
    const { client, userId } = params;

    // Execute DELETE with RETURNING to count deleted rows
    // RLS ensures user can only delete from their own plan (user_id = auth.uid())
    // No .eq() filter needed - we want to delete ALL rows for this user
    const { data, error } = await client
        .from('plan_recipes')
        .delete()
        .select('recipe_id');

    if (error) {
        logger.error(
            `[clearPlan] Failed to clear plan for user ${userId}`,
            error
        );
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to clear plan'
        );
    }

    // Count deleted rows (0 if plan was already empty - this is OK, idempotent)
    const deletedCount = data?.length || 0;

    logger.info(
        `[clearPlan] Plan cleared for user ${userId}: ${deletedCount} items deleted`
    );

    return deletedCount;
}

/**
 * Removes a recipe from user's plan.
 *
 * Business rules:
 * - Recipe must be in user's plan to be removed
 * - Uses user-context client to enforce RLS (user can only remove from their own plan)
 *
 * @param client - The authenticated Supabase client (user context)
 * @param userId - The ID of the authenticated user (for logging)
 * @param recipeId - The ID of the recipe to remove
 * @throws ApplicationError
 * - NOT_FOUND: Recipe is not in user's plan
 * - INTERNAL_ERROR: Database operation failed
 */
export async function removeRecipeFromPlan(
    client: TypedSupabaseClient,
    userId: string,
    recipeId: number
): Promise<void> {
    // Execute DELETE with RETURNING to check if row was deleted
    // RLS ensures user can only delete from their own plan (user_id = auth.uid())
    const { data, error } = await client
        .from('plan_recipes')
        .delete()
        .eq('recipe_id', recipeId)
        .select('recipe_id');

    if (error) {
        logger.error(
            `[removeRecipeFromPlan] Failed to remove recipe ${recipeId} from plan for user ${userId}`,
            error
        );
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to remove recipe from plan'
        );
    }

    // Check if any rows were deleted
    // If 0 rows deleted, recipe was not in user's plan
    if (!data || data.length === 0) {
        logger.warn(
            `[removeRecipeFromPlan] Recipe ${recipeId} not found in plan for user ${userId}`
        );
        throw new ApplicationError(
            'NOT_FOUND',
            'Recipe not found in plan'
        );
    }

    logger.info(
        `[removeRecipeFromPlan] Recipe ${recipeId} removed from plan for user ${userId}`
    );
}

