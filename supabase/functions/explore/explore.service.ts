/**
 * Explore Service
 * Contains business logic for explore API endpoints with optional authentication.
 */

import { createServiceRoleClient, TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

/**
 * DTO for a category (minimal subset).
 */
export interface CategoryDto {
    id: number;
    name: string;
}

/**
 * DTO for a tag.
 */
export interface TagDto {
    id: number;
    name: string;
}

/**
 * Represents a single content item within a recipe's ingredients or steps.
 */
export type RecipeContentItem =
    | { type: 'header'; content: string }
    | { type: 'item'; content: string };

/**
 * Represents the structured content for a recipe's ingredients or steps.
 */
export type RecipeContent = RecipeContentItem[];

/**
 * DTO for detailed view of a single recipe (from /explore endpoint).
 * This matches RecipeDetailDto from shared/contracts/types.ts.
 */
export interface RecipeDetailDto {
    id: number;
    user_id: string;
    category_id: number | null;
    category_name: string | null;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE';
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: TagDto[];
    created_at: string;
    updated_at: string;
}

/**
 * Raw database record from recipe_details view.
 */
interface RecipeDetailFullRow {
    id: number;
    user_id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: string;
    category_id: number | null;
    category_name: string | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: Array<{ id: number; name: string }> | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

/**
 * Columns to select from recipe_details view for single recipe.
 * CRITICAL: Always includes deleted_at for filtering.
 */
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, name, description, image_path, visibility, category_id, category_name, ' +
    'ingredients, steps, tags, created_at, updated_at, deleted_at';

/**
 * Retrieves a single recipe by ID with optional authentication.
 *
 * Access rules:
 * - If visibility='PUBLIC': accessible to everyone (anonymous or authenticated)
 * - If visibility!='PUBLIC': accessible only if requester is the author
 * - Always returns 404 (not 403) to avoid leaking resource existence
 *
 * Security:
 * - Uses service role client to bypass RLS
 * - Enforces application-level access control
 * - Always filters deleted_at IS NULL
 *
 * @param params - Object containing recipeId and optional requesterUserId
 * @returns Recipe detail DTO
 * @throws ApplicationError with NOT_FOUND code if recipe not found or not accessible
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getExploreRecipeById(params: {
    recipeId: number;
    requesterUserId: string | null;
}): Promise<RecipeDetailDto> {
    const { recipeId, requesterUserId } = params;

    logger.info('Fetching explore recipe by ID', {
        recipeId,
        requesterUserId: requesterUserId ?? 'anonymous',
    });

    // Create service role client (bypasses RLS)
    const client = createServiceRoleClient();

    // Fetch recipe from recipe_details view
    // CRITICAL: Filter deleted_at IS NULL
    const { data: recipeData, error: recipeError } = await client
        .from('recipe_details')
        .select(RECIPE_DETAIL_SELECT_COLUMNS)
        .eq('id', recipeId)
        .is('deleted_at', null)
        .single();

    // Handle database errors
    if (recipeError) {
        // PGRST116 means no rows returned (not found or soft-deleted)
        if (recipeError.code === 'PGRST116') {
            logger.info('Recipe not found or soft-deleted', { recipeId });
            throw new ApplicationError(
                'NOT_FOUND',
                'Recipe not found'
            );
        }

        logger.error('Database error while fetching recipe', {
            errorCode: recipeError.code,
            errorMessage: recipeError.message,
            recipeId,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe details');
    }

    if (!recipeData) {
        logger.info('Recipe not found', { recipeId });
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    const recipe = recipeData as unknown as RecipeDetailFullRow;

    logger.info('Recipe fetched from database', {
        recipeId: recipe.id,
        visibility: recipe.visibility,
        authorId: recipe.user_id,
    });

    // APPLICATION-LEVEL ACCESS CONTROL
    // Rule 1: If PUBLIC, allow everyone
    if (recipe.visibility === 'PUBLIC') {
        logger.info('Recipe is PUBLIC - access granted', { recipeId });
        return mapToDto(recipe);
    }

    // Rule 2: If not PUBLIC, require authentication and author match
    if (requesterUserId === null) {
        logger.info('Recipe is not PUBLIC and request is anonymous - access denied', {
            recipeId,
            visibility: recipe.visibility,
        });
        // Return 404 (not 403) to avoid leaking resource existence
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    if (requesterUserId !== recipe.user_id) {
        logger.info('Recipe is not PUBLIC and requester is not the author - access denied', {
            recipeId,
            visibility: recipe.visibility,
            authorId: recipe.user_id,
            requesterId: requesterUserId,
        });
        // Return 404 (not 403) to avoid leaking resource existence
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }

    // Rule 3: Requester is the author - access granted
    logger.info('Recipe is not PUBLIC but requester is the author - access granted', {
        recipeId,
        visibility: recipe.visibility,
        authorId: recipe.user_id,
    });

    return mapToDto(recipe);
}

/**
 * Maps raw database record to RecipeDetailDto.
 * Excludes deleted_at from response.
 *
 * @param recipe - Raw database record
 * @returns RecipeDetailDto
 */
function mapToDto(recipe: RecipeDetailFullRow): RecipeDetailDto {
    return {
        id: recipe.id,
        user_id: recipe.user_id,
        category_id: recipe.category_id,
        category_name: recipe.category_name,
        name: recipe.name,
        description: recipe.description,
        image_path: recipe.image_path,
        visibility: recipe.visibility as 'PUBLIC' | 'SHARED' | 'PRIVATE',
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tags: recipe.tags
            ? recipe.tags.map((tag) => ({ id: tag.id, name: tag.name }))
            : [],
        created_at: recipe.created_at,
        updated_at: recipe.updated_at,
    };
}
