/**
 * Recipes Service
 * Contains business logic for recipe-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { Json } from '../_shared/database.types.ts';
import {
    decodeCursor,
    buildFiltersHash,
    createNextCursor,
    validateCursorConsistency,
} from '../_shared/cursor.ts';

/**
 * Recipe visibility enum type.
 */
export type RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

/**
 * Recipe diet type enum.
 */
export type RecipeDietType = 'MEAT' | 'VEGETARIAN' | 'VEGAN';

/**
 * Recipe cuisine enum.
 */
export type RecipeCuisine = 
    | 'AFRICAN'
    | 'AMERICAN'
    | 'ASIAN'
    | 'BALKAN'
    | 'BRAZILIAN'
    | 'BRITISH'
    | 'CARIBBEAN'
    | 'CHINESE'
    | 'FRENCH'
    | 'GERMAN'
    | 'GREEK'
    | 'INDIAN'
    | 'ITALIAN'
    | 'JAPANESE'
    | 'KOREAN'
    | 'MEDITERRANEAN'
    | 'MEXICAN'
    | 'MIDDLE_EASTERN'
    | 'POLISH'
    | 'RUSSIAN'
    | 'SCANDINAVIAN'
    | 'SPANISH'
    | 'THAI'
    | 'TURKISH'
    | 'VIETNAMESE';

/**
 * Recipe difficulty enum.
 */
export type RecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * DTO for an item on the recipe list.
 * Contains a minimal set of fields for display.
 */
export interface RecipeListItemDto {
    id: number;
    name: string;
    image_path: string | null;
    created_at: string;
    visibility: RecipeVisibility;
    is_owner: boolean;
    in_my_collections: boolean;
    /** True if recipe is in authenticated user's plan */
    in_my_plan: boolean;
    author: {
        id: string;
        username: string;
    };
    category_id: number | null;
    category_name: string | null;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: RecipeDietType | null;
    cuisine: RecipeCuisine | null;
    difficulty: RecipeDifficulty | null;
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
 * Cursor-based pagination metadata.
 */
export interface CursorPageInfo {
    hasMore: boolean;
    nextCursor: string | null;
}

/**
 * Cursor-based paginated response wrapper.
 */
export interface CursorPaginatedResponseDto<T> {
    data: T[];
    pageInfo: CursorPageInfo;
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
 * Response DTO for uploading a recipe image.
 */
export interface UploadRecipeImageResponseDto {
    id: number;
    image_path: string;
    image_url?: string;
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
    visibility: RecipeVisibility;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: TagDto[];
    servings: number | null;
    is_termorobot: boolean;
    /** True if recipe is in authenticated user's plan */
    in_my_plan: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: RecipeDietType | null;
    cuisine: RecipeCuisine | null;
    difficulty: RecipeDifficulty | null;
    is_grill: boolean;
}

/**
 * Recipe view type for filtering recipes.
 */
export type RecipesView = 'owned' | 'my_recipes';

/**
 * Options for querying recipes.
 */
export interface GetRecipesOptions {
    page: number;
    limit: number;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    view: RecipesView;
    requesterUserId: string;
    categoryId?: number;
    tags?: string[];
    search?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
}

/**
 * Options for querying recipes feed (cursor-based pagination).
 */
export interface GetRecipesFeedOptions {
    cursor?: string;
    limit: number;
    sortField: string;
    sortDirection: 'asc' | 'desc';
    view: RecipesView;
    requesterUserId: string;
    categoryId?: number;
    tags?: string[];
    search?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
}

/** Columns to select for recipe list queries. */
const RECIPE_LIST_SELECT_COLUMNS = 'id, name, image_path, created_at, visibility, servings, is_termorobot, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty, is_grill';

/** Columns to select for recipe detail queries. */
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, category_id, name, description, image_path, created_at, updated_at, category_name, visibility, ingredients, steps, tags, servings, is_termorobot, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty, is_grill';

/** Allowed sort fields to prevent SQL injection. */
const ALLOWED_SORT_FIELDS = ['name', 'created_at', 'updated_at'];

/** Default sort field. */
const DEFAULT_SORT_FIELD = 'created_at';

/**
 * Checks which recipes from the given list are in the authenticated user's plan.
 * Returns a Set of recipe IDs that are in the plan.
 * If query fails, logs error and returns empty Set (non-blocking, defensive approach).
 *
 * @param client - Authenticated Supabase client
 * @param recipeIds - Array of recipe IDs to check
 * @param userId - Authenticated user ID
 * @returns Set of recipe IDs that are in user's plan
 */
async function getRecipeIdsInPlan(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string
): Promise<Set<number>> {
    if (recipeIds.length === 0) {
        return new Set<number>();
    }

    logger.info('Checking if recipes are in user plan', {
        userId,
        recipeIdsCount: recipeIds.length,
    });

    try {
        const { data, error } = await client
            .from('plan_recipes')
            .select('recipe_id')
            .eq('user_id', userId)
            .in('recipe_id', recipeIds);

        if (error) {
            logger.error('Error checking recipe plan', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeIdsCount: recipeIds.length,
            });
            // Non-blocking: return empty set
            return new Set<number>();
        }

        const recipeIdsInPlan = new Set<number>(
            (data ?? []).map((pr: { recipe_id: number }) => pr.recipe_id)
        );

        logger.info('Found recipes in user plan', {
            count: recipeIdsInPlan.size,
        });

        return recipeIdsInPlan;
    } catch (err) {
        logger.error('Unexpected error checking recipe plan', {
            error: err,
            userId,
        });
        // Non-blocking: return empty set
        return new Set<number>();
    }
}

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
 * Uses the get_recipes_list RPC function for efficient querying with proper deduplication.
 *
 * @param client - The authenticated Supabase client
 * @param options - Query options including pagination, sorting, filters, view, and requester ID
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
        view,
        requesterUserId,
        categoryId,
        tags,
        search,
        termorobot,
        dietType,
        cuisine,
        difficulty,
        grill,
    } = options;

    logger.info('Fetching recipes', {
        page,
        limit,
        sortField,
        sortDirection,
        view,
        requesterUserId,
        categoryId,
        tagsCount: tags?.length ?? 0,
        hasSearch: !!search,
        termorobot,
    });

    // Validate sort field to prevent injection
    const validSortField = ALLOWED_SORT_FIELDS.includes(sortField)
        ? sortField
        : DEFAULT_SORT_FIELD;

    // Resolve tag names to IDs if tags filter is provided
    let tagIds: number[] | null = null;
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

    // Call the RPC function to get recipes
    const { data, error } = await client.rpc('get_recipes_list', {
        p_user_id: requesterUserId,
        p_view: view,
        p_page: page,
        p_limit: limit,
        p_sort_field: validSortField,
        p_sort_direction: sortDirection,
        p_category_id: categoryId ?? undefined,
        p_tag_ids: tagIds ?? undefined,
        p_search: search ?? undefined,
        p_termorobot: termorobot ?? undefined,
        p_diet_type: dietType ?? undefined,
        p_cuisine: cuisine ?? undefined,
        p_difficulty: difficulty ?? undefined,
        p_grill: grill ?? undefined,
    });

    if (error) {
        logger.error('RPC error while fetching recipes', {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipes');
    }

    // Extract total count from first row (all rows have the same total_count)
    const totalItems = data && data.length > 0 ? Number(data[0].total_count) : 0;
    const totalPages = Math.ceil(totalItems / limit);

    logger.info('Recipes fetched successfully', {
        totalItems,
        returnedItems: data?.length ?? 0,
        page,
        totalPages,
        view,
    });

    // If no data, return empty result
    if (!data || data.length === 0) {
        return {
            data: [],
            pagination: {
                currentPage: page,
                totalPages: 0,
                totalItems: 0,
            },
        };
    }

    // Bulk check which recipes are in user's plan
    const recipeIds = data.map((recipe) => Number(recipe.id));
    const recipeIdsInPlan = await getRecipeIdsInPlan(client, recipeIds, requesterUserId);

    // Map the data to DTOs
    const recipes: RecipeListItemDto[] = data.map((recipe) => ({
        id: Number(recipe.id),
        name: recipe.name,
        image_path: recipe.image_path,
        created_at: recipe.created_at,
        visibility: recipe.visibility as RecipeVisibility,
        is_owner: Boolean(recipe.is_owner),
        in_my_collections: Boolean(recipe.in_my_collections),
        in_my_plan: recipeIdsInPlan.has(Number(recipe.id)),
        author: {
            id: recipe.author_id,
            username: recipe.author_username,
        },
        category_id: recipe.category_id ? Number(recipe.category_id) : null,
        category_name: recipe.category_name ?? null,
        servings: recipe.servings ? Number(recipe.servings) : null,
        is_termorobot: Boolean(recipe.is_termorobot),
        prep_time_minutes: recipe.prep_time_minutes ? Number(recipe.prep_time_minutes) : null,
        total_time_minutes: recipe.total_time_minutes ? Number(recipe.total_time_minutes) : null,
        diet_type: (recipe.diet_type as RecipeDietType) ?? null,
        cuisine: (recipe.cuisine as RecipeCuisine) ?? null,
        difficulty: (recipe.difficulty as RecipeDifficulty) ?? null,
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
 * Fetches recipes with cursor-based pagination for the authenticated user.
 * Supports all filters and views from getRecipes, but uses cursor instead of page number.
 *
 * MVP Implementation: Uses offset-based cursor that maps to RPC page parameter.
 * Validates that offset is aligned with limit (offset % limit == 0).
 *
 * @param client - The authenticated Supabase client
 * @param options - Options including cursor, limit, filters, and view
 * @returns Cursor-based paginated response with recipe list items
 * @throws ApplicationError with VALIDATION_ERROR for invalid cursor or offset alignment
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function getRecipesFeed(
    client: TypedSupabaseClient,
    options: GetRecipesFeedOptions
): Promise<CursorPaginatedResponseDto<RecipeListItemDto>> {
    const {
        cursor,
        limit,
        sortField,
        sortDirection,
        view,
        requesterUserId,
        categoryId,
        tags,
        search,
        termorobot,
        dietType,
        cuisine,
        difficulty,
        grill,
    } = options;

    logger.info('Fetching recipes feed', {
        limit,
        sortField,
        sortDirection,
        view,
        requesterUserId,
        hasCursor: !!cursor,
        categoryId,
        tagsCount: tags?.length ?? 0,
        hasSearch: !!search,
        termorobot,
        dietType,
        cuisine,
        difficulty,
        grill,
    });

    // Validate sort field to prevent injection
    const validSortField = ALLOWED_SORT_FIELDS.includes(sortField)
        ? sortField
        : DEFAULT_SORT_FIELD;

    // Build filters hash for cursor validation
    const sortString = `${validSortField}.${sortDirection}`;
    const filtersHash = await buildFiltersHash({
        sort: sortString,
        view,
        search,
        categoryId,
        tags: tags?.sort(), // Sort for deterministic hash
        termorobot,
        dietType,
        cuisine,
        difficulty,
        grill,
    });

    // Decode cursor and validate consistency
    let offset = 0;
    let page = 1;

    if (cursor) {
        const cursorData = decodeCursor(cursor);

        // Validate that cursor matches current query parameters
        validateCursorConsistency(
            cursorData,
            limit,
            sortString,
            filtersHash
        );

        offset = cursorData.offset;

        // MVP: RPC uses page-based pagination, so offset must be aligned with limit
        if (offset % limit !== 0) {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Cursor is invalid: offset (${offset}) is not aligned with limit (${limit})`
            );
        }

        // Calculate page from offset
        page = Math.floor(offset / limit) + 1;

        logger.info('Cursor decoded successfully', {
            offset,
            page,
            cursorLimit: cursorData.limit,
            cursorSort: cursorData.sort,
        });
    }

    // Resolve tag names to IDs if tags filter is provided
    let tagIds: number[] | null = null;
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
                pageInfo: {
                    hasMore: false,
                    nextCursor: null,
                },
            };
        }
    }

    // Call the RPC function to get recipes
    const { data, error } = await client.rpc('get_recipes_list', {
        p_user_id: requesterUserId,
        p_view: view,
        p_page: page,
        p_limit: limit,
        p_sort_field: validSortField,
        p_sort_direction: sortDirection,
        p_category_id: categoryId ?? undefined,
        p_tag_ids: tagIds ?? undefined,
        p_search: search ?? undefined,
        p_termorobot: termorobot ?? undefined,
        p_diet_type: dietType ?? undefined,
        p_cuisine: cuisine ?? undefined,
        p_difficulty: difficulty ?? undefined,
        p_grill: grill ?? undefined,
    });

    if (error) {
        logger.error('RPC error while fetching recipes feed', {
            errorCode: error.code,
            errorMessage: error.message,
            errorDetails: error.details,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipes feed');
    }

    // Handle empty results
    if (!data || data.length === 0) {
        logger.info('No recipes found in feed - returning empty array');
        return {
            data: [],
            pageInfo: {
                hasMore: false,
                nextCursor: null,
            },
        };
    }

    // Extract total count from first row (all rows have the same total_count)
    const totalItems = Number(data[0].total_count);
    const returnedItems = data.length;

    // Determine if there are more results
    const hasMore = offset + returnedItems < totalItems;

    logger.info('Recipes feed fetched successfully', {
        totalItems,
        returnedItems,
        offset,
        page,
        hasMore,
        view,
    });

    // Bulk check which recipes are in user's plan
    const recipeIds = data.map((recipe) => Number(recipe.id));
    const recipeIdsInPlan = await getRecipeIdsInPlan(client, recipeIds, requesterUserId);

    // Map the data to DTOs
    const recipes: RecipeListItemDto[] = data.map((recipe) => ({
        id: Number(recipe.id),
        name: recipe.name,
        image_path: recipe.image_path,
        created_at: recipe.created_at,
        visibility: recipe.visibility as RecipeVisibility,
        is_owner: Boolean(recipe.is_owner),
        in_my_collections: Boolean(recipe.in_my_collections),
        in_my_plan: recipeIdsInPlan.has(Number(recipe.id)),
        author: {
            id: recipe.author_id,
            username: recipe.author_username,
        },
        category_id: recipe.category_id ? Number(recipe.category_id) : null,
        category_name: recipe.category_name ?? null,
        servings: recipe.servings ? Number(recipe.servings) : null,
        is_termorobot: Boolean(recipe.is_termorobot),
        prep_time_minutes: recipe.prep_time_minutes ? Number(recipe.prep_time_minutes) : null,
        total_time_minutes: recipe.total_time_minutes ? Number(recipe.total_time_minutes) : null,
        diet_type: (recipe.diet_type as RecipeDietType) ?? null,
        cuisine: (recipe.cuisine as RecipeCuisine) ?? null,
        difficulty: (recipe.difficulty as RecipeDifficulty) ?? null,
    }));

    // Create next cursor if there are more results
    const nextCursor = hasMore
        ? createNextCursor(offset, returnedItems, limit, sortString, filtersHash)
        : null;

    return {
        data: recipes,
        pageInfo: {
            hasMore,
            nextCursor,
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
/**
 * Retrieves a single recipe by ID with proper access control.
 *
 * Access rules:
 * - Returns 200 if user is the owner (regardless of visibility)
 * - Returns 200 if recipe is PUBLIC (regardless of ownership)
 * - Returns 403 if recipe exists, is not PUBLIC, and user is not the owner
 * - Returns 404 if recipe does not exist or is soft-deleted
 *
 * @param client - Authenticated Supabase client
 * @param id - Recipe ID
 * @param requesterUserId - ID of the user making the request
 * @returns RecipeDetailDto with full recipe details
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or is deleted
 * @throws ApplicationError with FORBIDDEN if user doesn't have access to private/shared recipe
 * @throws ApplicationError with INTERNAL_ERROR on database errors
 */
export async function getRecipeById(
    client: TypedSupabaseClient,
    id: number,
    requesterUserId: string
): Promise<RecipeDetailDto> {
    logger.info('Fetching recipe by ID', { recipeId: id, requesterUserId });

    // Step A: Try to fetch with authenticated client (respects RLS)
    const { data, error } = await client
        .from('recipe_details')
        .select(RECIPE_DETAIL_SELECT_COLUMNS)
        .eq('id', id)
        .single();

    // Happy path: RLS allowed access
    if (data && !error) {
        logger.info('Recipe fetched successfully via authenticated client', {
            recipeId: id,
            recipeName: data.name,
        });

        // Check if recipe is in user's plan
        const recipeIdsInPlan = await getRecipeIdsInPlan(client, [id], requesterUserId);
        const inMyPlan = recipeIdsInPlan.has(id);

        return mapToRecipeDetailDto(data, inMyPlan);
    }

    // Step B: If PGRST116 (not found by RLS), distinguish between 403 and 404
    if (error && error.code === 'PGRST116') {
        logger.info('Recipe not found via RLS, checking visibility with service role', {
            recipeId: id,
        });

        // Import service role client at the top of the function call
        const { createServiceRoleClient } = await import('../_shared/supabase-client.ts');
        const serviceClient = createServiceRoleClient();

        // Check if recipe exists and get its visibility/ownership status
        const { data: recipeCheck, error: checkError } = await serviceClient
            .from('recipes')
            .select('id, user_id, visibility, deleted_at')
            .eq('id', id)
            .maybeSingle();

        if (checkError) {
            logger.error('Database error while checking recipe existence', {
                recipeId: id,
                errorCode: checkError.code,
                errorMessage: checkError.message,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
        }

        // Recipe doesn't exist or is soft-deleted → 404
        if (!recipeCheck || recipeCheck.deleted_at !== null) {
            logger.warn('Recipe not found or deleted', {
                recipeId: id,
                exists: !!recipeCheck,
                deleted: recipeCheck?.deleted_at !== null,
            });
            throw new ApplicationError(
                'NOT_FOUND',
                `Recipe with ID ${id} not found`
            );
        }

        // Recipe exists but is not PUBLIC and user is not owner → 403
        if (recipeCheck.visibility !== 'PUBLIC' && recipeCheck.user_id !== requesterUserId) {
            logger.warn('Access denied to private/shared recipe', {
                recipeId: id,
                visibility: recipeCheck.visibility,
                ownerId: recipeCheck.user_id,
                requesterId: requesterUserId,
            });
            throw new ApplicationError(
                'FORBIDDEN',
                'You do not have permission to access this recipe'
            );
        }

        // Recipe is PUBLIC → fetch full details with service role
        logger.info('Fetching PUBLIC recipe with service role', {
            recipeId: id,
        });

        const { data: publicRecipe, error: publicError } = await serviceClient
            .from('recipe_details')
            .select(RECIPE_DETAIL_SELECT_COLUMNS)
            .eq('id', id)
            .single();

        if (publicError || !publicRecipe) {
            logger.error('Failed to fetch PUBLIC recipe details', {
                recipeId: id,
                errorCode: publicError?.code,
                errorMessage: publicError?.message,
            });
            throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
        }

        logger.info('PUBLIC recipe fetched successfully', {
            recipeId: id,
            recipeName: publicRecipe.name,
        });

        // Check if recipe is in user's plan
        const recipeIdsInPlan = await getRecipeIdsInPlan(client, [id], requesterUserId);
        const inMyPlan = recipeIdsInPlan.has(id);

        return mapToRecipeDetailDto(publicRecipe, inMyPlan);
    }

    // Other database errors
    logger.error('Database error while fetching recipe', {
        recipeId: id,
        errorCode: error?.code,
        errorMessage: error?.message,
    });
    throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe');
}

/**
 * Maps raw recipe_details view data to RecipeDetailDto.
 * Helper function to avoid code duplication.
 */
function mapToRecipeDetailDto(data: any, inMyPlan: boolean): RecipeDetailDto {
    return {
        id: data.id!,
        user_id: data.user_id!,
        category_id: data.category_id,
        name: data.name!,
        description: data.description,
        image_path: data.image_path,
        created_at: data.created_at!,
        updated_at: data.updated_at!,
        category_name: data.category_name,
        visibility: data.visibility as RecipeVisibility,
        ingredients: parseRecipeContent(data.ingredients),
        steps: parseRecipeContent(data.steps),
        tags: parseTagsContent(data.tags),
        servings: data.servings ? Number(data.servings) : null,
        is_termorobot: Boolean(data.is_termorobot),
        in_my_plan: inMyPlan,
        prep_time_minutes: data.prep_time_minutes ? Number(data.prep_time_minutes) : null,
        total_time_minutes: data.total_time_minutes ? Number(data.total_time_minutes) : null,
        diet_type: (data.diet_type as RecipeDietType) ?? null,
        cuisine: (data.cuisine as RecipeCuisine) ?? null,
        difficulty: (data.difficulty as RecipeDifficulty) ?? null,
    };
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
    visibility: RecipeVisibility;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: RecipeDietType | null;
    cuisine: RecipeCuisine | null;
    difficulty: RecipeDifficulty | null;
    is_grill: boolean;
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
    visibility?: RecipeVisibility;
    image_path?: string | null;
    servings?: number | null;
    is_termorobot?: boolean;
    prep_time_minutes?: number | null;
    total_time_minutes?: number | null;
    diet_type?: RecipeDietType | null;
    cuisine?: RecipeCuisine | null;
    difficulty?: RecipeDifficulty | null;
    is_grill?: boolean;
}

/**
 * Input data for uploading a recipe image.
 */
export interface UploadRecipeImageInput {
    recipeId: number;
    userId: string;
    file: File;
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
        servings: input.servings,
        is_termorobot: input.is_termorobot,
        prep_time_minutes: input.prep_time_minutes,
        total_time_minutes: input.total_time_minutes,
        diet_type: input.diet_type,
        cuisine: input.cuisine,
        difficulty: input.difficulty,
        is_grill: input.is_grill,
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
            p_visibility: input.visibility,
            p_servings: input.servings,
            p_is_termorobot: input.is_termorobot,
            p_prep_time_minutes: input.prep_time_minutes,
            p_total_time_minutes: input.total_time_minutes,
            p_diet_type: input.diet_type,
            p_cuisine: input.cuisine,
            p_difficulty: input.difficulty,
            p_is_grill: input.is_grill,
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
    const recipeDetail = await getRecipeById(client, recipeId, userId);

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
        updatingImagePath: input.image_path !== undefined,
        updatingServings: input.servings !== undefined,
        updatingIsTermorobot: input.is_termorobot !== undefined,
        updatingPrepTime: input.prep_time_minutes !== undefined,
        updatingTotalTime: input.total_time_minutes !== undefined,
        updatingDietType: input.diet_type !== undefined,
        updatingCuisine: input.cuisine !== undefined,
        updatingDifficulty: input.difficulty !== undefined,
        updatingIsGrill: input.is_grill !== undefined,
    });

    // Determine if tags should be updated
    const updateTags = input.tags !== undefined;

    // Determine if category should be updated
    const updateCategory = input.category_id !== undefined;

    // Determine if servings should be updated
    const updateServings = input.servings !== undefined;

    // Determine if termorobot flag should be updated
    const updateIsTermorobot = input.is_termorobot !== undefined;

    // Determine if prep time should be updated
    const updatePrepTime = input.prep_time_minutes !== undefined;

    // Determine if total time should be updated
    const updateTotalTime = input.total_time_minutes !== undefined;

    // Determine if diet type should be updated
    const updateDietType = input.diet_type !== undefined;

    // Determine if cuisine should be updated
    const updateCuisine = input.cuisine !== undefined;

    // Determine if difficulty should be updated
    const updateDifficulty = input.difficulty !== undefined;

    // Determine if grill flag should be updated
    const updateIsGrill = input.is_grill !== undefined;

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
            p_visibility: input.visibility ?? null,
            p_image_path: input.image_path ?? null,
            p_update_category: updateCategory,
            p_servings: input.servings ?? null,
            p_update_servings: updateServings,
            p_is_termorobot: input.is_termorobot ?? null,
            p_update_is_termorobot: updateIsTermorobot,
            p_prep_time_minutes: input.prep_time_minutes ?? null,
            p_update_prep_time: updatePrepTime,
            p_total_time_minutes: input.total_time_minutes ?? null,
            p_update_total_time: updateTotalTime,
            p_diet_type: input.diet_type ?? null,
            p_update_diet_type: updateDietType,
            p_cuisine: input.cuisine ?? null,
            p_update_cuisine: updateCuisine,
            p_difficulty: input.difficulty ?? null,
            p_update_difficulty: updateDifficulty,
            p_is_grill: input.is_grill ?? null,
            p_update_is_grill: updateIsGrill,
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
    const recipeDetail = await getRecipeById(client, updatedRecipeId, userId);

    logger.info('Recipe update completed', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
        tagsCount: recipeDetail.tags.length,
    });

    return recipeDetail;
}

/**
 * Parses raw text to extract recipe name, description, ingredients, and steps.
 * Expected format:
 * - Title: Line starting with `#` (required)
 * - Main sections: Lines starting with `##` (e.g., "## Opis", "## Składniki", "## Kroki")
 * - Subsections: Lines starting with `###` (headers within sections)
 * - Items: Lines starting with `-` (ingredients or steps)
 *
 * @param rawText - The raw text block containing the recipe
 * @returns Parsed recipe components
 * @throws ApplicationError with VALIDATION_ERROR if title is missing
 */
function parseRecipeText(rawText: string): {
    name: string;
    description: string | null;
    ingredientsRaw: string;
    stepsRaw: string;
} {
    logger.info('Parsing recipe text', { textLength: rawText.length });

    const lines = rawText.split('\n').map((line) => line.trim());

    let name = '';
    let description = '';
    let ingredientsRaw = '';
    let stepsRaw = '';
    let currentSection: 'none' | 'description' | 'ingredients' | 'steps' = 'none';

    for (const line of lines) {
        // Skip empty lines
        if (line.length === 0) {
            continue;
        }

        // Extract title (# Title)
        if (line.startsWith('# ')) {
            name = line.substring(2).trim();
            logger.debug('Found recipe title', { name });
            continue;
        }

        // Detect main sections (## Section Name)
        if (line.startsWith('## ')) {
            const sectionName = line.substring(3).trim().toLowerCase();

            // Detect "Opis" section (description)
            if (sectionName.includes('opis') || sectionName.includes('description')) {
                currentSection = 'description';
                logger.debug('Entering description section');
            }
            // Detect "Składniki" section (ingredients)
            else if (sectionName.includes('składnik') || sectionName.includes('ingredient')) {
                currentSection = 'ingredients';
                logger.debug('Entering ingredients section');
            }
            // Detect "Kroki" or "Przygotowanie" section (steps)
            else if (
                sectionName.includes('krok') ||
                sectionName.includes('przygotowanie') ||
                sectionName.includes('step') ||
                sectionName.includes('instruction')
            ) {
                currentSection = 'steps';
                logger.debug('Entering steps section');
            } else {
                // Unknown section, skip
                currentSection = 'none';
            }
            continue;
        }

        // Add content to the appropriate section
        if (currentSection === 'description') {
            // For description, collect all lines as plain text
            description += line + '\n';
        }
        // Transform ### to # for subsection headers (as per ingredients_raw/steps_raw format)
        else if (currentSection === 'ingredients' || currentSection === 'steps') {
            let transformedLine = line;

            // Convert ### subsection headers to # format expected by parse_text_to_jsonb
            if (line.startsWith('###')) {
                transformedLine = line.replace(/^###\s*/, '# ');
            }

            if (currentSection === 'ingredients') {
                ingredientsRaw += transformedLine + '\n';
            } else {
                stepsRaw += transformedLine + '\n';
            }
        }
    }

    // Validate that we have a title
    if (!name || name.length === 0) {
        logger.warn('Recipe import failed: missing title');
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Invalid recipe format. A title (#) is required.'
        );
    }

    // Trim the collected raw text
    description = description.trim();
    ingredientsRaw = ingredientsRaw.trim();
    stepsRaw = stepsRaw.trim();

    logger.info('Recipe text parsed successfully', {
        name,
        hasDescription: !!description,
        descriptionLength: description.length,
        ingredientsLength: ingredientsRaw.length,
        stepsLength: stepsRaw.length,
    });

    return {
        name,
        description: description.length > 0 ? description : null,
        ingredientsRaw,
        stepsRaw,
    };
}

/**
 * Creates a new recipe from a raw text block for the authenticated user.
 * Parses the text to extract the recipe name, ingredients, and steps,
 * then delegates to the createRecipe function.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param rawText - The raw text block containing the recipe
 * @returns RecipeDetailDto with full details of the newly created recipe
 * @throws ApplicationError with VALIDATION_ERROR if text is empty or missing required fields
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function importRecipeFromText(
    client: TypedSupabaseClient,
    userId: string,
    rawText: string
): Promise<RecipeDetailDto> {
    logger.info('Importing recipe from text', {
        userId,
        textLength: rawText.length,
    });

    // Validate that raw text is not empty
    if (!rawText || rawText.trim().length === 0) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Raw text cannot be empty'
        );
    }

    // Parse the raw text to extract recipe components
    const { name, description, ingredientsRaw, stepsRaw } = parseRecipeText(rawText);

    // Prepare input for createRecipe
    const createRecipeInput: CreateRecipeInput = {
        name,
        description, // Use parsed description from text
        category_id: null,
        ingredients_raw: ingredientsRaw || '- (empty)', // Provide fallback if empty
        steps_raw: stepsRaw || '- (empty)', // Provide fallback if empty
        tags: [],
        visibility: 'PRIVATE', // Import always creates private recipes
        servings: null, // No servings information from import
        is_termorobot: false, // Import nie ustawia flagi termorobot
        prep_time_minutes: null, // No time information from import
        total_time_minutes: null, // No time information from import
        diet_type: null, // No classification from import
        cuisine: null, // No classification from import
        difficulty: null, // No classification from import
    };

    logger.info('Creating recipe from parsed text', { name });

    // Delegate to the existing createRecipe function
    const recipeDetail = await createRecipe(client, userId, createRecipeInput);

    logger.info('Recipe imported successfully', {
        recipeId: recipeDetail.id,
        recipeName: recipeDetail.name,
    });

    return recipeDetail;
}

/**
 * Soft-deletes a recipe by setting its deleted_at timestamp.
 * Uses the recipes table directly with RLS ensuring user ownership.
 *
 * @param client - The authenticated Supabase client
 * @param recipeId - The ID of the recipe to delete
 * @param userId - The ID of the authenticated user (must be the owner)
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist, is already deleted, or user has no access
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function deleteRecipe(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string
): Promise<void> {
    logger.info('Soft-deleting recipe', {
        recipeId,
        userId,
    });

    // Perform soft delete by setting deleted_at timestamp
    // RLS policies ensure user can only delete their own recipes
    // WHERE clause ensures recipe exists, belongs to user, and isn't already deleted
    const { error, count } = await client
        .from('recipes')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .select('*', { count: 'exact', head: true });

    if (error) {
        logger.error('Database error while deleting recipe', {
            recipeId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to delete recipe');
    }

    // If no rows were updated, recipe doesn't exist or user has no access
    if (count === 0) {
        logger.warn('Recipe not found for deletion', {
            recipeId,
            userId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            `Recipe with ID ${recipeId} not found`
        );
    }

    logger.info('Recipe soft-deleted successfully', {
        recipeId,
    });
}

/**
 * Input parameters for deleting a recipe image.
 */
export interface DeleteRecipeImageParams {
    recipeId: number;
    userId: string;
}

/**
 * Maps MIME type to file extension for image uploads.
 *
 * @param mimeType - The MIME type of the file
 * @returns File extension without dot (e.g., 'png', 'jpg', 'webp')
 */
function getFileExtensionFromMimeType(mimeType: string): string {
    const mimeToExtMap: Record<string, string> = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
    };

    return mimeToExtMap[mimeType] || 'jpg'; // Default to jpg if unknown
}

/**
 * Uploads or replaces a recipe image in Supabase Storage.
 *
 * Process:
 * 1. Verifies recipe exists and user is the owner (using authenticated client with RLS)
 * 2. Uploads the new image to Storage bucket 'recipe-images' under path: /{userId}/{recipeId}/cover_{timestamp}.{ext}
 * 3. Updates the recipes.image_path column in the database
 * 4. If database update fails, performs rollback by removing the newly uploaded file
 * 5. Best-effort deletion of the old image file (if it existed)
 *
 * @param client - The authenticated Supabase client (RLS enforces ownership)
 * @param input - Upload input containing recipeId, userId, and file
 * @returns UploadRecipeImageResponseDto with id, image_path, and optional image_url
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist or user doesn't own it
 * @throws ApplicationError with INTERNAL_ERROR for storage or database errors
 */
export async function uploadRecipeImage(
    client: TypedSupabaseClient,
    input: UploadRecipeImageInput
): Promise<UploadRecipeImageResponseDto> {
    const { recipeId, userId, file } = input;

    logger.info('Starting recipe image upload', {
        recipeId,
        userId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
    });

    // Step 1: Verify recipe exists, user owns it, and it's not deleted
    // Fetch current image_path to enable cleanup of old file
    const { data: recipe, error: fetchError } = await client
        .from('recipes')
        .select('id, image_path')
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

    if (fetchError) {
        logger.error('Database error while fetching recipe for image upload', {
            recipeId,
            userId,
            errorCode: fetchError.code,
            errorMessage: fetchError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to verify recipe ownership');
    }

    if (!recipe) {
        logger.warn('Recipe not found or access denied for image upload', {
            recipeId,
            userId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            `Recipe with ID ${recipeId} not found`
        );
    }

    const oldImagePath = recipe.image_path;

    logger.info('Recipe verified, proceeding with upload', {
        recipeId,
        hasOldImage: !!oldImagePath,
        oldImagePath,
    });

    // Step 2: Generate storage path for the new image
    const timestamp = Date.now();
    const fileExtension = getFileExtensionFromMimeType(file.type);
    const storagePath = `${userId}/${recipeId}/cover_${timestamp}.${fileExtension}`;

    logger.info('Generated storage path', {
        storagePath,
        fileExtension,
    });

    // Step 3: Upload file to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await client.storage
        .from('recipe-images')
        .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false, // Never overwrite - use unique timestamp in filename
        });

    if (uploadError) {
        logger.error('Storage upload error', {
            recipeId,
            storagePath,
            errorCode: uploadError.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to upload image to storage'
        );
    }

    logger.info('File uploaded to storage successfully', {
        storagePath: uploadData.path,
    });

    // Step 4: Update recipes.image_path in database
    const { error: updateError } = await client
        .from('recipes')
        .update({ image_path: storagePath })
        .eq('id', recipeId)
        .eq('user_id', userId);

    if (updateError) {
        logger.error('Database update error after upload, performing rollback', {
            recipeId,
            storagePath,
            errorCode: updateError.code,
            errorMessage: updateError.message,
        });

        // Rollback: Remove the newly uploaded file
        const { error: rollbackError } = await client.storage
            .from('recipe-images')
            .remove([storagePath]);

        if (rollbackError) {
            logger.error('Rollback failed - orphaned file in storage', {
                storagePath,
                rollbackError: rollbackError.message,
            });
        } else {
            logger.info('Rollback successful - removed uploaded file', {
                storagePath,
            });
        }

        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to update recipe with new image path'
        );
    }

    logger.info('Database updated with new image path', {
        recipeId,
        newImagePath: storagePath,
    });

    // Step 5: Best-effort deletion of old image (if it existed)
    if (oldImagePath) {
        logger.info('Attempting to delete old image', {
            oldImagePath,
        });

        const { error: deleteOldError } = await client.storage
            .from('recipe-images')
            .remove([oldImagePath]);

        if (deleteOldError) {
            logger.warn('Failed to delete old image (non-critical)', {
                oldImagePath,
                errorMessage: deleteOldError.message,
            });
        } else {
            logger.info('Old image deleted successfully', {
                oldImagePath,
            });
        }
    }

    // Step 6: Generate public URL for the image (optional)
    // Note: This assumes bucket is configured as public.
    // For private buckets, use createSignedUrl() instead.
    const { data: publicUrlData } = client.storage
        .from('recipe-images')
        .getPublicUrl(storagePath);

    const imageUrl = publicUrlData?.publicUrl || undefined;

    logger.info('Recipe image upload completed successfully', {
        recipeId,
        imagePath: storagePath,
        hasPublicUrl: !!imageUrl,
    });

    return {
        id: recipeId,
        image_path: storagePath,
        image_url: imageUrl,
    };
}

/**
 * Deletes a recipe image by setting image_path to NULL in the database.
 * Also performs best-effort deletion of the image file from Supabase Storage.
 *
 * Process:
 * 1. Fetches the current image_path for the recipe (verifies ownership and existence)
 * 2. If image_path is already NULL, returns success (idempotent operation)
 * 3. Updates the recipes.image_path column to NULL in the database
 * 4. Best-effort: Attempts to delete the image file from Storage (non-blocking)
 *
 * @param client - The authenticated Supabase client (RLS enforces ownership)
 * @param params - Delete parameters containing recipeId and userId
 * @throws ApplicationError with NOT_FOUND if recipe doesn't exist, is soft-deleted, or user doesn't own it
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function deleteRecipeImage(
    client: TypedSupabaseClient,
    params: DeleteRecipeImageParams
): Promise<void> {
    const { recipeId, userId } = params;

    logger.info('Starting recipe image deletion', {
        recipeId,
        userId,
    });

    // Step 1: Fetch current image_path to verify recipe exists and get path for cleanup
    const { data: recipe, error: fetchError } = await client
        .from('recipes')
        .select('id, image_path')
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .maybeSingle();

    if (fetchError) {
        logger.error('Database error while fetching recipe for image deletion', {
            recipeId,
            userId,
            errorCode: fetchError.code,
            errorMessage: fetchError.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to verify recipe ownership');
    }

    if (!recipe) {
        logger.warn('Recipe not found or access denied for image deletion', {
            recipeId,
            userId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            `Recipe with ID ${recipeId} not found`
        );
    }

    const oldImagePath = recipe.image_path;

    // Step 2: If image_path is already NULL, operation is idempotent - return success
    if (!oldImagePath) {
        logger.info('Recipe image_path already NULL, operation is idempotent', {
            recipeId,
        });
        return;
    }

    logger.info('Current image path found, proceeding with deletion', {
        recipeId,
        oldImagePath,
    });

    // Step 3: Update recipes.image_path to NULL in database
    const { error: updateError } = await client
        .from('recipes')
        .update({ image_path: null })
        .eq('id', recipeId)
        .eq('user_id', userId)
        .is('deleted_at', null);

    if (updateError) {
        logger.error('Database error while updating recipe to remove image', {
            recipeId,
            errorCode: updateError.code,
            errorMessage: updateError.message,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to remove image from recipe'
        );
    }

    logger.info('Database updated - image_path set to NULL', {
        recipeId,
    });

    // Step 4: Best-effort deletion of image file from Storage
    // This is non-critical and should not block the response
    logger.info('Attempting best-effort deletion of image file from Storage', {
        oldImagePath,
    });

    const { error: deleteStorageError } = await client.storage
        .from('recipe-images')
        .remove([oldImagePath]);

    if (deleteStorageError) {
        logger.warn('Failed to delete image file from Storage (non-critical)', {
            oldImagePath,
            errorMessage: deleteStorageError.message,
        });
    } else {
        logger.info('Image file deleted from Storage successfully', {
            oldImagePath,
        });
    }

    logger.info('Recipe image deletion completed successfully', {
        recipeId,
    });
}

