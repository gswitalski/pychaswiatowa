/**
 * Public Service
 * Contains business logic for public (anonymous) API endpoints.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { GetPublicRecipesQuery } from './public.types.ts';

/**
 * DTO for a category (minimal subset).
 */
export interface CategoryDto {
    id: number;
    name: string;
}

/**
 * DTO for a user profile (minimal subset).
 */
export interface ProfileDto {
    id: string;
    username: string;
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
 * DTO for a public recipe list item.
 */
export interface PublicRecipeListItemDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    category: CategoryDto | null;
    tags: string[];
    created_at: string;
}

/**
 * DTO for detailed view of a single public recipe.
 */
export interface PublicRecipeDetailDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: 'PUBLIC';
    category: CategoryDto | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: string[];
    author: ProfileDto;
    created_at: string;
}

/**
 * Pagination details for the response.
 */
export interface PaginationDetails {
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Raw database record from recipe_details view.
 */
interface RecipeDetailsRow {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    category_id: number | null;
    category_name: string | null;
    tags: Array<{ id: number; name: string }> | null;
    created_at: string;
}

/**
 * Raw database record from recipe_details view for single recipe (includes JSONB fields).
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
    deleted_at: string | null;
}

/**
 * Raw database record from profiles table.
 */
interface ProfileRow {
    id: string;
    username: string;
}

/** Columns to select from recipe_details view. */
const RECIPE_SELECT_COLUMNS = 'id, name, description, image_path, category_id, category_name, tags, created_at';

/** Columns to select from recipe_details view for single recipe (includes JSONB and user_id). */
const RECIPE_DETAIL_SELECT_COLUMNS = 'id, user_id, name, description, image_path, visibility, category_id, category_name, ingredients, steps, tags, created_at, deleted_at';

/** Columns to select from profiles table. */
const PROFILE_SELECT_COLUMNS = 'id, username';

/**
 * Retrieves public recipes with pagination, sorting, and optional search.
 * This function is intended for anonymous access using service role key.
 *
 * Security: Always filters for visibility='PUBLIC' and deleted_at IS NULL.
 *
 * @param client - Service role Supabase client
 * @param query - Query parameters for filtering, sorting, and pagination
 * @returns Object containing recipe data and pagination details
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getPublicRecipes(
    client: TypedSupabaseClient,
    query: GetPublicRecipesQuery
): Promise<{
    data: PublicRecipeListItemDto[];
    pagination: PaginationDetails;
}> {
    logger.info('Fetching public recipes', {
        page: query.page,
        limit: query.limit,
        sort: `${query.sortField}.${query.sortDirection}`,
        hasSearch: !!query.q,
    });

    // Calculate offset for pagination
    const offset = (query.page - 1) * query.limit;

    // Build base query
    let dbQuery = client
        .from('recipe_details')
        .select(RECIPE_SELECT_COLUMNS, { count: 'exact' })
        .eq('visibility', 'PUBLIC')
        .is('deleted_at', null);

    // Apply search filter if provided
    if (query.q) {
        // MVP: Search by name using ILIKE
        // TODO: Implement full-text search with search_vector for better performance
        dbQuery = dbQuery.ilike('name', `%${query.q}%`);
    }

    // Apply sorting
    const ascending = query.sortDirection === 'asc';
    dbQuery = dbQuery.order(query.sortField, { ascending });

    // Apply pagination
    dbQuery = dbQuery.range(offset, offset + query.limit - 1);

    // Execute query
    const { data, error, count } = await dbQuery;

    if (error) {
        logger.error('Database error while fetching public recipes', {
            errorCode: error.code,
            errorMessage: error.message,
            query,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch public recipes');
    }

    if (!data) {
        logger.info('No public recipes found - returning empty array');
        return {
            data: [],
            pagination: {
                currentPage: query.page,
                totalPages: 0,
                totalItems: 0,
            },
        };
    }

    // Map database records to DTOs
    const recipes: PublicRecipeListItemDto[] = (data as RecipeDetailsRow[]).map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        image_path: recipe.image_path,
        category: recipe.category_id && recipe.category_name
            ? { id: recipe.category_id, name: recipe.category_name }
            : null,
        tags: recipe.tags ? recipe.tags.map((tag) => tag.name) : [],
        created_at: recipe.created_at,
    }));

    // Calculate pagination
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / query.limit);

    logger.info('Public recipes fetched successfully', {
        count: recipes.length,
        totalItems,
        totalPages,
        currentPage: query.page,
    });

    return {
        data: recipes,
        pagination: {
            currentPage: query.page,
            totalPages,
            totalItems,
        },
    };
}

/**
 * Retrieves a single public recipe by ID with full details.
 * This function is intended for anonymous access using service role key.
 *
 * Security: Always filters for visibility='PUBLIC' and deleted_at IS NULL.
 * Returns 404 if recipe doesn't exist, is not public, or is soft-deleted.
 *
 * @param client - Service role Supabase client
 * @param params - Parameters containing recipe ID
 * @returns Public recipe detail DTO
 * @throws ApplicationError with NOT_FOUND code if recipe not found or not public
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getPublicRecipeById(
    client: TypedSupabaseClient,
    params: { id: number }
): Promise<PublicRecipeDetailDto> {
    logger.info('Fetching public recipe by ID', { recipeId: params.id });

    // Fetch recipe from recipe_details view
    const { data: recipeData, error: recipeError } = await client
        .from('recipe_details')
        .select(RECIPE_DETAIL_SELECT_COLUMNS)
        .eq('id', params.id)
        .eq('visibility', 'PUBLIC')
        .is('deleted_at', null)
        .single();

    // Handle database errors
    if (recipeError) {
        // PGRST116 means no rows returned (not found)
        if (recipeError.code === 'PGRST116') {
            logger.info('Public recipe not found or not accessible', {
                recipeId: params.id,
            });
            throw new ApplicationError(
                'NOT_FOUND',
                'Recipe not found or is not publicly accessible'
            );
        }

        logger.error('Database error while fetching public recipe', {
            errorCode: recipeError.code,
            errorMessage: recipeError.message,
            recipeId: params.id,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe details');
    }

    if (!recipeData) {
        logger.info('Public recipe not found', { recipeId: params.id });
        throw new ApplicationError(
            'NOT_FOUND',
            'Recipe not found or is not publicly accessible'
        );
    }

    const recipe = recipeData as RecipeDetailFullRow;

    // Fetch author profile
    const { data: profileData, error: profileError } = await client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', recipe.user_id)
        .single();

    if (profileError || !profileData) {
        logger.error('Failed to fetch recipe author profile', {
            userId: recipe.user_id,
            recipeId: params.id,
            errorCode: profileError?.code,
            errorMessage: profileError?.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to fetch recipe author information'
        );
    }

    const profile = profileData as ProfileRow;

    // Map to DTO
    const recipeDto: PublicRecipeDetailDto = {
        id: recipe.id,
        name: recipe.name,
        description: recipe.description,
        image_path: recipe.image_path,
        visibility: 'PUBLIC',
        category: recipe.category_id && recipe.category_name
            ? { id: recipe.category_id, name: recipe.category_name }
            : null,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tags: recipe.tags ? recipe.tags.map((tag) => tag.name) : [],
        author: {
            id: profile.id,
            username: profile.username,
        },
        created_at: recipe.created_at,
    };

    logger.info('Public recipe fetched successfully', {
        recipeId: recipeDto.id,
        recipeName: recipeDto.name,
        authorId: recipeDto.author.id,
    });

    return recipeDto;
}
