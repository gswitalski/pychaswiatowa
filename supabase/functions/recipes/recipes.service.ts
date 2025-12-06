/**
 * Recipes Service
 * Contains business logic for recipe-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { Json } from '../_shared/database.types.ts';

/**
 * DTO for an item on the recipe list.
 * Contains a minimal set of fields for display.
 */
export interface RecipeListItemDto {
    id: number;
    name: string;
    image_path: string | null;
    created_at: string;
}

/**
 * Pagination details for API responses.
 */
export interface PaginationDetails {
    currentPage: number;
    totalPages: number;
    totalItems: number;
}

/**
 * Paginated response wrapper.
 */
export interface PaginatedResponseDto<T> {
    data: T[];
    pagination: PaginationDetails;
}

/**
 * Represents a single content item within a recipe's ingredients or steps.
 * Can be either a header or a regular item.
 */
export type RecipeContentItem =
    | { type: 'header'; content: string }
    | { type: 'item'; content: string };

/**
 * Represents the structured content for a recipe's ingredients or steps.
 */
export type RecipeContent = RecipeContentItem[];

/**
 * DTO for a recipe tag.
 */
export interface TagDto {
    id: number;
    name: string;
}

/**
 * DTO for the detailed view of a single recipe.
 * Based on the `recipe_details` view, with strongly-typed JSONB fields.
 */
export interface RecipeDetailDto {
    id: number;
    user_id: string;
    category_id: number | null;
    name: string;
    description: string | null;
    image_path: string | null;
    created_at: string;
    updated_at: string;
    category_name: string | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: TagDto[];
}

/**
 * Options for querying recipes.
 */
export interface GetRecipesOptions {
    page: number;
    limit: number;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    categoryId?: number;
    tags?: string[];
    search?: string;
}

/** Columns to select for recipe list queries. */
const RECIPE_LIST_SELECT_COLUMNS = 'id, name, image_path, created_at';

/** Columns to select for recipe detail queries. */
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, category_id, name, description, image_path, created_at, updated_at, category_name, ingredients, steps, tags';

/** Allowed sort fields to prevent SQL injection. */
const ALLOWED_SORT_FIELDS = ['name', 'created_at', 'updated_at'];

/** Default sort field. */
const DEFAULT_SORT_FIELD = 'created_at';

/**
 * Resolves tag names to their IDs for the current user.
 * Only returns IDs for tags that exist.
 *
 * @param client - The authenticated Supabase client
 * @param tagNames - Array of tag names to resolve
 * @returns Array of tag IDs
 */
async function resolveTagNamesToIds(
    client: TypedSupabaseClient,
    tagNames: string[]
): Promise<number[]> {
    if (tagNames.length === 0) {
        return [];
    }

    // Normalize tag names to lowercase for case-insensitive matching
    const normalizedNames = tagNames.map((name) => name.toLowerCase());

    const { data, error } = await client
        .from('tags')
        .select('id, name')
        .in('name', normalizedNames);

    if (error) {
        logger.warn('Failed to resolve tag names', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        return [];
    }

    return (data ?? []).map((tag) => tag.id);
}

/**
 * Retrieves a paginated list of recipes for the authenticated user.
 *
 * @param client - The authenticated Supabase client
 * @param options - Query options including pagination, sorting, and filters
 * @returns Paginated response with recipe list items
 * @throws ApplicationError for database errors
 */
export async function getRecipes(
    client: TypedSupabaseClient,
    options: GetRecipesOptions
): Promise<PaginatedResponseDto<RecipeListItemDto>> {
    const {
        page,
        limit,
        sortField,
        sortDirection,
        categoryId,
        tags,
        search,
    } = options;

    logger.info('Fetching recipes', {
        page,
        limit,
        sortField,
        sortDirection,
        categoryId,
        tagsCount: tags?.length ?? 0,
        hasSearch: !!search,
    });

    // Validate sort field to prevent injection
    const validSortField = ALLOWED_SORT_FIELDS.includes(sortField)
        ? sortField
        : DEFAULT_SORT_FIELD;

    const validSortDirection = sortDirection === 'asc' ? true : false;

    // Calculate pagination offset
    const offset = (page - 1) * limit;

    // Resolve tag names to IDs if tags filter is provided
    let tagIds: number[] = [];
    if (tags && tags.length > 0) {
        tagIds = await resolveTagNamesToIds(client, tags);
        logger.debug('Resolved tag names to IDs', {
            tagNames: tags,
            tagIds,
        });

        // If user requested specific tags but none were found,
        // return empty result immediately (no recipes can match)
        if (tagIds.length === 0) {
            logger.info('No matching tags found, returning empty result');
            return {
                data: [],
                pagination: {
                    currentPage: page,
                    totalPages: 0,
                    totalItems: 0,
                },
            };
        }
    }

    // Build the base query using the recipe_details view
    // Note: The view already filters deleted_at IS NULL
    let query = client
        .from('recipe_details')
        .select(RECIPE_LIST_SELECT_COLUMNS, { count: 'exact' });

    // Apply category filter
    if (categoryId !== undefined) {
        query = query.eq('category_id', categoryId);
    }

    // Apply tags filter - recipes must contain ALL specified tags
    // Using the tag_ids array column with contains operator
    if (tagIds.length > 0) {
        query = query.contains('tag_ids', tagIds);
    }

    // Apply full-text search
    // We use OR condition to search in name (ilike) and description
    // For more advanced search with search_vector, use getRecipesWithFullTextSearch
    if (search && search.trim().length > 0) {
        const searchTerm = search.trim();
        // Escape special characters for LIKE pattern
        const escapedTerm = searchTerm.replace(/[%_]/g, '\\$&');
        // Search in name OR description using or() filter
        query = query.or(`name.ilike.%${escapedTerm}%,description.ilike.%${escapedTerm}%`);
    }

    // Apply sorting
    query = query.order(validSortField, { ascending: validSortDirection });

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute the query
    const { data, error, count } = await query;

    if (error) {
        logger.error('Database error while fetching recipes', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipes');
    }

    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / limit);

    logger.info('Recipes fetched successfully', {
        totalItems,
        returnedItems: data?.length ?? 0,
        page,
        totalPages,
    });

    // Map the data to DTOs
    const recipes: RecipeListItemDto[] = (data ?? []).map((recipe) => ({
        id: recipe.id!,
        name: recipe.name!,
        image_path: recipe.image_path,
        created_at: recipe.created_at!,
    }));

    return {
        data: recipes,
        pagination: {
            currentPage: page,
            totalPages,
            totalItems,
        },
    };
}

/**
 * Parses JSONB content (ingredients or steps) to strongly-typed RecipeContent array.
 *
 * @param jsonContent - Raw JSONB content from the database
 * @returns Parsed RecipeContent array
 */
function parseRecipeContent(jsonContent: Json | null): RecipeContent {
    if (!jsonContent || !Array.isArray(jsonContent)) {
        return [];
    }

    return jsonContent
        .filter(
            (item): item is { type: string; content: string } =>
                typeof item === 'object' &&
                item !== null &&
                'type' in item &&
                'content' in item
        )
        .map((item) => ({
            type: item.type === 'header' ? 'header' : 'item',
            content: String(item.content),
        })) as RecipeContent;
}

/**
 * Parses JSONB tags to strongly-typed TagDto array.
 *
 * @param jsonTags - Raw JSONB tags from the database
 * @returns Parsed TagDto array
 */
function parseTagsContent(jsonTags: Json | null): TagDto[] {
    if (!jsonTags || !Array.isArray(jsonTags)) {
        return [];
    }

    return jsonTags
        .filter(
            (item): item is { id: number; name: string } =>
                typeof item === 'object' &&
                item !== null &&
                'id' in item &&
                'name' in item
        )
        .map((item) => ({
            id: Number(item.id),
            name: String(item.name),
        }));
}

/**
 * Retrieves a single recipe by its ID for the authenticated user.
 * Uses the `recipe_details` view which includes joined data from categories and tags.
 * RLS policies automatically filter by user_id and deleted_at IS NULL.
 *
 * @param client - The authenticated Supabase client
 * @param id - The recipe ID to retrieve
 * @returns RecipeDetailDto with full recipe details
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or user has no access
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function getRecipeById(
    client: TypedSupabaseClient,
    id: number
): Promise<RecipeDetailDto> {
    logger.info('Fetching recipe by ID', { recipeId: id });

    const { data, error } = await client
        .from('recipe_details')
        .select(RECIPE_DETAIL_SELECT_COLUMNS)
        .eq('id', id)
        .single();

    if (error) {
        // PGRST116 means no rows returned (single() expects exactly one row)
        if (error.code === 'PGRST116') {
            logger.warn('Recipe not found', { recipeId: id });
            throw new ApplicationError(
                'NOT_FOUND',
                `Recipe with ID ${id} not found`
            );
        }

        logger.error('Database error while fetching recipe', {
            recipeId: id,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
    }

    // This should not happen due to single() and RLS, but handle defensively
    if (!data) {
        logger.warn('Recipe not found (null data)', { recipeId: id });
        throw new ApplicationError(
            'NOT_FOUND',
            `Recipe with ID ${id} not found`
        );
    }

    // Map the database row to RecipeDetailDto with proper type conversions
    const recipeDetail: RecipeDetailDto = {
        id: data.id!,
        user_id: data.user_id!,
        category_id: data.category_id,
        name: data.name!,
        description: data.description,
        image_path: data.image_path,
        created_at: data.created_at!,
        updated_at: data.updated_at!,
        category_name: data.category_name,
        ingredients: parseRecipeContent(data.ingredients),
        steps: parseRecipeContent(data.steps),
        tags: parseTagsContent(data.tags),
    };

    logger.info('Recipe fetched successfully', {
        recipeId: id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

/**
 * Input data for creating a new recipe.
 */
export interface CreateRecipeInput {
    name: string;
    description: string | null;
    category_id: number | null;
    ingredients_raw: string;
    steps_raw: string;
    tags: string[];
}

/**
 * Input data for updating an existing recipe.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateRecipeInput {
    name?: string;
    description?: string | null;
    category_id?: number | null;
    ingredients_raw?: string;
    steps_raw?: string;
    tags?: string[];
}

/**
 * Creates a new recipe with associated tags for the authenticated user.
 * Uses the `create_recipe_with_tags` RPC function to ensure atomicity.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param input - The recipe data to create
 * @returns RecipeDetailDto with full details of the newly created recipe
 * @throws ApplicationError with NOT_FOUND if category doesn't exist
 * @throws ApplicationError with VALIDATION_ERROR if ingredients or steps are empty after parsing
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function createRecipe(
    client: TypedSupabaseClient,
    userId: string,
    input: CreateRecipeInput
): Promise<RecipeDetailDto> {
    logger.info('Creating new recipe', {
        userId,
        name: input.name,
        hasDescription: !!input.description,
        categoryId: input.category_id,
        tagsCount: input.tags.length,
    });

    // Call the RPC function to create the recipe with tags atomically
    const { data: recipeId, error: rpcError } = await client.rpc(
        'create_recipe_with_tags',
        {
            p_user_id: userId,
            p_name: input.name,
            p_description: input.description,
            p_category_id: input.category_id,
            p_ingredients_raw: input.ingredients_raw,
            p_steps_raw: input.steps_raw,
            p_tag_names: input.tags,
        }
    );

    if (rpcError) {
        logger.error('RPC error while creating recipe', {
            errorCode: rpcError.code,
            errorMessage: rpcError.message,
            errorDetails: rpcError.details,
        });

        // Handle specific error cases based on PostgreSQL error codes/messages
        // P0002 = no_data_found (category not found)
        if (rpcError.code === 'P0002' || rpcError.message?.includes('does not exist')) {
            throw new ApplicationError(
                'NOT_FOUND',
                'The specified category does not exist'
            );
        }

        // P0001 = raise_exception (validation error from RPC)
        if (rpcError.code === 'P0001') {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                rpcError.message || 'Validation error occurred'
            );
        }

        throw new ApplicationError('INTERNAL_ERROR', 'Failed to create recipe');
    }

    if (!recipeId) {
        logger.error('RPC returned null recipe ID');
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to create recipe');
    }

    logger.info('Recipe created successfully, fetching details', {
        recipeId,
    });

    // Fetch the complete recipe details using the existing function
    const recipeDetail = await getRecipeById(client, recipeId);

    logger.info('Recipe creation completed', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

/**
 * Updates an existing recipe with associated tags for the authenticated user.
 * Uses the `update_recipe_with_tags` RPC function to ensure atomicity.
 *
 * @param client - The authenticated Supabase client
 * @param recipeId - The ID of the recipe to update
 * @param userId - The ID of the authenticated user (must be the owner)
 * @param input - The recipe data to update (only provided fields will be updated)
 * @returns RecipeDetailDto with full details of the updated recipe
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or user has no access
 * @throws ApplicationError with NOT_FOUND if category doesn't exist
 * @throws ApplicationError with VALIDATION_ERROR if ingredients or steps are empty after parsing
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function updateRecipe(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string,
    input: UpdateRecipeInput
): Promise<RecipeDetailDto> {
    logger.info('Updating recipe', {
        recipeId,
        userId,
        updatingName: input.name !== undefined,
        updatingDescription: input.description !== undefined,
        updatingCategory: input.category_id !== undefined,
        updatingIngredients: input.ingredients_raw !== undefined,
        updatingSteps: input.steps_raw !== undefined,
        updatingTags: input.tags !== undefined,
    });

    // Determine if tags should be updated
    const updateTags = input.tags !== undefined;

    // Call the RPC function to update the recipe with tags atomically
    const { data: updatedRecipeId, error: rpcError } = await client.rpc(
        'update_recipe_with_tags',
        {
            p_recipe_id: recipeId,
            p_user_id: userId,
            p_name: input.name ?? null,
            p_description: input.description ?? null,
            p_category_id: input.category_id ?? null,
            p_ingredients_raw: input.ingredients_raw ?? null,
            p_steps_raw: input.steps_raw ?? null,
            p_tag_names: input.tags ?? null,
            p_update_tags: updateTags,
        }
    );

    if (rpcError) {
        logger.error('RPC error while updating recipe', {
            recipeId,
            errorCode: rpcError.code,
            errorMessage: rpcError.message,
            errorDetails: rpcError.details,
        });

        // Handle specific error cases based on PostgreSQL error codes/messages
        // P0002 = no_data_found (recipe not found, access denied, or category not found)
        if (rpcError.code === 'P0002') {
            // Distinguish between recipe not found and category not found
            if (rpcError.message?.includes('Category')) {
                throw new ApplicationError(
                    'NOT_FOUND',
                    'The specified category does not exist'
                );
            }
            throw new ApplicationError(
                'NOT_FOUND',
                `Recipe with ID ${recipeId} not found`
            );
        }

        // P0001 = raise_exception (validation error from RPC)
        if (rpcError.code === 'P0001') {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                rpcError.message || 'Validation error occurred'
            );
        }

        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update recipe');
    }

    if (!updatedRecipeId) {
        logger.error('RPC returned null recipe ID', { recipeId });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update recipe');
    }

    logger.info('Recipe updated successfully, fetching details', {
        recipeId: updatedRecipeId,
    });

    // Fetch the complete recipe details using the existing function
    const recipeDetail = await getRecipeById(client, updatedRecipeId);

    logger.info('Recipe update completed', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

