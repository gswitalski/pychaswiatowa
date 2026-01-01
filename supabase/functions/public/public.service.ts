/**
 * Public Service
 * Contains business logic for public (anonymous) API endpoints.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { GetPublicRecipesQuery, GetPublicRecipesFeedQuery } from './public.types.ts';
import {
    decodeCursor,
    buildFiltersHash,
    createNextCursor,
    validateCursorConsistency,
} from '../_shared/cursor.ts';

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
 * Recipe visibility enum.
 */
export type RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC';

/**
 * DTO for a public recipe list item.
 */
export interface PublicRecipeListItemDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: RecipeVisibility;
    is_owner: boolean;
    category: CategoryDto | null;
    tags: string[];
    author: ProfileDto;
    created_at: string;
    /** True if recipe is in authenticated user's collections (always false for anonymous) */
    in_my_collections: boolean;
    /** True if recipe is in authenticated user's plan (always false for anonymous) */
    in_my_plan: boolean;
    servings: number | null;
    is_termorobot: boolean;
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
    /** True if authenticated user owns the recipe (always false for anonymous) */
    is_owner: boolean;
    /** True if recipe is in authenticated user's plan (always false for anonymous) */
    in_my_plan: boolean;
    servings: number | null;
    is_termorobot: boolean;
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
 * Cursor-based pagination metadata.
 */
export interface CursorPageInfo {
    hasMore: boolean;
    nextCursor: string | null;
}

/**
 * Cursor-based paginated response wrapper.
 */
export interface CursorPaginatedResponse<T> {
    data: T[];
    pageInfo: CursorPageInfo;
}

/**
 * Raw database record from recipe_details view.
 */
interface RecipeDetailsRow {
    id: number;
    user_id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: string;
    category_id: number | null;
    category_name: string | null;
    tags: Array<{ id: number; name: string }> | null;
    created_at: string;
    servings: number | null;
    is_termorobot: boolean;
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
    servings: number | null;
    is_termorobot: boolean;
}

/**
 * Raw database record from profiles table.
 */
interface ProfileRow {
    id: string;
    username: string;
}

/** Columns to select from recipe_details view. */
const RECIPE_SELECT_COLUMNS = 'id, user_id, name, description, image_path, visibility, category_id, category_name, tags, created_at, servings, is_termorobot';

/** Columns to select from recipe_details view for single recipe (includes JSONB and user_id). */
const RECIPE_DETAIL_SELECT_COLUMNS = 'id, user_id, name, description, image_path, visibility, category_id, category_name, ingredients, steps, tags, created_at, deleted_at, servings, is_termorobot';

/** Columns to select from profiles table. */
const PROFILE_SELECT_COLUMNS = 'id, username';

/**
 * Checks which recipes from the given list are in the authenticated user's plan.
 * Returns a Set of recipe IDs that are in the plan.
 * If userId is null (anonymous), returns an empty Set.
 * If query fails, logs error and returns empty Set (non-blocking, defensive approach).
 *
 * @param client - Service role Supabase client
 * @param recipeIds - Array of recipe IDs to check
 * @param userId - Authenticated user ID (or null for anonymous)
 * @returns Set of recipe IDs that are in user's plan
 */
async function getRecipeIdsInPlan(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null
): Promise<Set<number>> {
    if (userId === null || recipeIds.length === 0) {
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
 * Retrieves public recipes with pagination, sorting, and optional search.
 * Supports optional authentication - when user is authenticated, includes collection information
 * and returns user's own recipes regardless of visibility.
 *
 * Security:
 * - For anonymous users: filters for visibility='PUBLIC' and deleted_at IS NULL
 * - For authenticated users: filters for (visibility='PUBLIC' OR user_id=userId) and deleted_at IS NULL
 *
 * @param client - Service role Supabase client
 * @param query - Query parameters for filtering, sorting, and pagination
 * @param userId - Optional authenticated user ID (null for anonymous)
 * @returns Object containing recipe data and pagination details
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getPublicRecipes(
    client: TypedSupabaseClient,
    query: GetPublicRecipesQuery,
    userId: string | null = null
): Promise<{
    data: PublicRecipeListItemDto[];
    pagination: PaginationDetails;
}> {
    logger.info('Fetching public recipes', {
        page: query.page,
        limit: query.limit,
        sort: `${query.sortField}.${query.sortDirection}`,
        hasSearch: !!query.q,
        isAuthenticated: userId !== null,
        userId: userId ?? 'anonymous',
    });

    // Calculate offset for pagination
    const offset = (query.page - 1) * query.limit;

    // Build base query
    let dbQuery = client
        .from('recipe_details')
        .select(RECIPE_SELECT_COLUMNS, { count: 'exact' })
        .is('deleted_at', null);

    // Apply visibility filter based on authentication status
    if (userId !== null) {
        // Authenticated user: show PUBLIC recipes OR user's own recipes (any visibility)
        dbQuery = dbQuery.or(`visibility.eq.PUBLIC,user_id.eq.${userId}`);
        logger.info('Applied authenticated user filter', {
            userId,
            filter: 'visibility=PUBLIC OR user_id=' + userId,
        });
    } else {
        // Anonymous user: show only PUBLIC recipes
        dbQuery = dbQuery.eq('visibility', 'PUBLIC');
        logger.info('Applied anonymous user filter', {
            filter: 'visibility=PUBLIC',
        });
    }

    // Apply search filter if provided
    if (query.q) {
        // MVP: Search by name using ILIKE
        // TODO: Implement full-text search with search_vector for better performance
        dbQuery = dbQuery.ilike('name', `%${query.q}%`);
    }

    // Apply termorobot filter if provided
    if (query.termorobot !== undefined) {
        dbQuery = dbQuery.eq('is_termorobot', query.termorobot);
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

    const recipeRows = data as RecipeDetailsRow[];

    // Extract unique user IDs from recipes
    const uniqueUserIds = [...new Set(recipeRows.map((recipe) => recipe.user_id))];

    logger.info('Fetching author profiles (bulk)', {
        uniqueUserIdsCount: uniqueUserIds.length,
    });

    // Bulk fetch all author profiles
    const { data: profilesData, error: profilesError } = await client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .in('id', uniqueUserIds);

    if (profilesError) {
        logger.error('Database error while fetching author profiles', {
            errorCode: profilesError.code,
            errorMessage: profilesError.message,
            userIds: uniqueUserIds,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe authors');
    }

    if (!profilesData) {
        logger.error('No profiles data returned for recipe authors', {
            userIds: uniqueUserIds,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe authors');
    }

    // Build a map of profiles by user ID for efficient lookup
    const profilesById = new Map<string, ProfileRow>(
        (profilesData as ProfileRow[]).map((profile) => [profile.id, profile])
    );

    logger.info('Author profiles fetched successfully', {
        profilesCount: profilesById.size,
        expectedCount: uniqueUserIds.length,
    });

    // Check if all profiles were found
    if (profilesById.size !== uniqueUserIds.length) {
        const missingUserIds = uniqueUserIds.filter((id) => !profilesById.has(id));
        logger.error('Some author profiles are missing', {
            missingUserIds,
            missingCount: missingUserIds.length,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Some recipe authors could not be found');
    }

    // If user is authenticated, fetch collection information and plan information for all recipes
    let recipeIdsInCollections = new Set<number>();
    let recipeIdsInPlan = new Set<number>();

    if (userId !== null) {
        const recipeIds = recipeRows.map(r => r.id);

        logger.info('Checking if recipes are in user collections', {
            userId,
            recipeIdsCount: recipeIds.length,
        });

        // Query recipe_collections to find which recipes are in user's collections
        const { data: collectionsData, error: collectionsError } = await client
            .from('recipe_collections')
            .select('recipe_id, collection_id, collections!inner(user_id)')
            .in('recipe_id', recipeIds)
            .eq('collections.user_id', userId);

        if (collectionsError) {
            logger.error('Error checking recipe collections', {
                errorCode: collectionsError.code,
                errorMessage: collectionsError.message,
                userId,
            });
            // Don't fail the entire request - just assume no recipes in collections
        } else if (collectionsData) {
            recipeIdsInCollections = new Set(collectionsData.map((rc: any) => rc.recipe_id));
            logger.info('Found recipes in user collections', {
                count: recipeIdsInCollections.size,
            });
        }

        // Check which recipes are in user's plan
        recipeIdsInPlan = await getRecipeIdsInPlan(client, recipeIds, userId);
    }

    // Map database records to DTOs
    const recipes: PublicRecipeListItemDto[] = recipeRows.map((recipe) => {
        const author = profilesById.get(recipe.user_id);

        // This should never happen due to the check above, but TypeScript needs assurance
        if (!author) {
            throw new ApplicationError('INTERNAL_ERROR', `Author profile not found for user_id: ${recipe.user_id}`);
        }

        return {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            image_path: recipe.image_path,
            visibility: recipe.visibility as RecipeVisibility,
            is_owner: userId !== null && recipe.user_id === userId,
            category: recipe.category_id && recipe.category_name
                ? { id: recipe.category_id, name: recipe.category_name }
                : null,
            tags: recipe.tags ? recipe.tags.map((tag) => tag.name) : [],
            author: {
                id: author.id,
                username: author.username,
            },
            created_at: recipe.created_at,
            in_my_collections: recipeIdsInCollections.has(recipe.id),
            in_my_plan: recipeIdsInPlan.has(recipe.id),
            servings: recipe.servings,
            is_termorobot: recipe.is_termorobot,
        };
    });

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
 * Supports optional authentication for additional metadata (is_owner, in_my_plan).
 *
 * Security: Always filters for visibility='PUBLIC' and deleted_at IS NULL.
 * Returns 404 if recipe doesn't exist, is not public, or is soft-deleted.
 *
 * @param client - Service role Supabase client
 * @param params - Parameters containing recipe ID
 * @param userId - Optional authenticated user ID (null for anonymous)
 * @returns Public recipe detail DTO
 * @throws ApplicationError with NOT_FOUND code if recipe not found or not public
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getPublicRecipeById(
    client: TypedSupabaseClient,
    params: { id: number },
    userId: string | null = null
): Promise<PublicRecipeDetailDto> {
    logger.info('Fetching public recipe by ID', { 
        recipeId: params.id,
        isAuthenticated: userId !== null,
        userId: userId ?? 'anonymous',
    });

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

    // Calculate is_owner and in_my_plan for authenticated users
    const isOwner = userId !== null && recipe.user_id === userId;
    let inMyPlan = false;

    if (userId !== null) {
        // Check if recipe is in user's plan
        const recipeIdsInPlan = await getRecipeIdsInPlan(client, [params.id], userId);
        inMyPlan = recipeIdsInPlan.has(params.id);
    }

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
        is_owner: isOwner,
        in_my_plan: inMyPlan,
        servings: recipe.servings,
        is_termorobot: recipe.is_termorobot,
    };

    logger.info('Public recipe fetched successfully', {
        recipeId: recipeDto.id,
        recipeName: recipeDto.name,
        authorId: recipeDto.author.id,
        isOwner,
        inMyPlan,
    });

    return recipeDto;
}

/**
 * Retrieves public recipes with cursor-based pagination, sorting, and optional search.
 * Supports optional authentication - when user is authenticated, includes collection information
 * and returns user's own recipes regardless of visibility.
 *
 * Security:
 * - For anonymous users: filters for visibility='PUBLIC' and deleted_at IS NULL
 * - For authenticated users: filters for (visibility='PUBLIC' OR user_id=userId) and deleted_at IS NULL
 *
 * @param client - Service role Supabase client
 * @param query - Query parameters for filtering, sorting, and cursor pagination
 * @param userId - Optional authenticated user ID (null for anonymous)
 * @returns Object containing recipe data and cursor-based pagination info
 * @throws ApplicationError with VALIDATION_ERROR for invalid cursor
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getPublicRecipesFeed(
    client: TypedSupabaseClient,
    query: GetPublicRecipesFeedQuery,
    userId: string | null = null
): Promise<CursorPaginatedResponse<PublicRecipeListItemDto>> {
    logger.info('Fetching public recipes feed', {
        limit: query.limit,
        sort: `${query.sortField}.${query.sortDirection}`,
        hasSearch: !!query.q,
        hasCursor: !!query.cursor,
        isAuthenticated: userId !== null,
        userId: userId ?? 'anonymous',
    });

    // Build filters hash for cursor validation (include userId to distinguish anonymous vs authenticated)
    const sortString = `${query.sortField}.${query.sortDirection}`;
    const filtersHash = await buildFiltersHash({
        sort: sortString,
        q: query.q,
        termorobot: query.termorobot,
        userId: userId ?? undefined, // Include userId in hash to separate anonymous/authenticated cursors
    });

    // Decode cursor and validate consistency
    let offset = 0;
    if (query.cursor) {
        const cursorData = decodeCursor(query.cursor);

        // Validate that cursor matches current query parameters
        validateCursorConsistency(
            cursorData,
            query.limit,
            sortString,
            filtersHash
        );

        offset = cursorData.offset;

        logger.info('Cursor decoded successfully', {
            offset,
            cursorLimit: cursorData.limit,
            cursorSort: cursorData.sort,
        });
    }

    // Build base query
    let dbQuery = client
        .from('recipe_details')
        .select(RECIPE_SELECT_COLUMNS, { count: 'estimated' })
        .is('deleted_at', null);

    // Apply visibility filter based on authentication status
    if (userId !== null) {
        // Authenticated user: show PUBLIC recipes OR user's own recipes (any visibility)
        dbQuery = dbQuery.or(`visibility.eq.PUBLIC,user_id.eq.${userId}`);
        logger.info('Applied authenticated user filter', {
            userId,
            filter: 'visibility=PUBLIC OR user_id=' + userId,
        });
    } else {
        // Anonymous user: show only PUBLIC recipes
        dbQuery = dbQuery.eq('visibility', 'PUBLIC');
        logger.info('Applied anonymous user filter', {
            filter: 'visibility=PUBLIC',
        });
    }

    // Apply search filter if provided
    if (query.q) {
        // MVP: Search by name using ILIKE
        // TODO: Implement full-text search with search_vector for better performance
        dbQuery = dbQuery.ilike('name', `%${query.q}%`);
    }

    // Apply termorobot filter if provided
    if (query.termorobot !== undefined) {
        dbQuery = dbQuery.eq('is_termorobot', query.termorobot);
    }

    // Apply stable sorting (includes id as tie-breaker)
    const ascending = query.sortDirection === 'asc';
    dbQuery = dbQuery
        .order(query.sortField, { ascending })
        .order('id', { ascending }); // Stable sort tie-breaker

    // Fetch limit+1 to determine if there are more results
    const fetchLimit = query.limit + 1;
    dbQuery = dbQuery.range(offset, offset + fetchLimit - 1);

    // Execute query
    const { data, error } = await dbQuery;

    if (error) {
        logger.error('Database error while fetching public recipes feed', {
            errorCode: error.code,
            errorMessage: error.message,
            query,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch public recipes feed');
    }

    if (!data || data.length === 0) {
        logger.info('No public recipes found in feed - returning empty array');
        return {
            data: [],
            pageInfo: {
                hasMore: false,
                nextCursor: null,
            },
        };
    }

    const recipeRows = data as RecipeDetailsRow[];

    // Determine if there are more results
    const hasMore = recipeRows.length > query.limit;

    // Trim to actual limit (remove the +1 item)
    const recipesToReturn = hasMore ? recipeRows.slice(0, query.limit) : recipeRows;

    logger.info('Recipes fetched from database', {
        fetchedCount: recipeRows.length,
        returningCount: recipesToReturn.length,
        hasMore,
    });

    // Extract unique user IDs from recipes
    const uniqueUserIds = [...new Set(recipesToReturn.map((recipe) => recipe.user_id))];

    logger.info('Fetching author profiles (bulk)', {
        uniqueUserIdsCount: uniqueUserIds.length,
    });

    // Bulk fetch all author profiles
    const { data: profilesData, error: profilesError } = await client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .in('id', uniqueUserIds);

    if (profilesError) {
        logger.error('Database error while fetching author profiles', {
            errorCode: profilesError.code,
            errorMessage: profilesError.message,
            userIds: uniqueUserIds,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe authors');
    }

    if (!profilesData) {
        logger.error('No profiles data returned for recipe authors', {
            userIds: uniqueUserIds,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch recipe authors');
    }

    // Build a map of profiles by user ID for efficient lookup
    const profilesById = new Map<string, ProfileRow>(
        (profilesData as ProfileRow[]).map((profile) => [profile.id, profile])
    );

    logger.info('Author profiles fetched successfully', {
        profilesCount: profilesById.size,
        expectedCount: uniqueUserIds.length,
    });

    // Check if all profiles were found
    if (profilesById.size !== uniqueUserIds.length) {
        const missingUserIds = uniqueUserIds.filter((id) => !profilesById.has(id));
        logger.error('Some author profiles are missing', {
            missingUserIds,
            missingCount: missingUserIds.length,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Some recipe authors could not be found');
    }

    // If user is authenticated, fetch collection information and plan information for all recipes
    let recipeIdsInCollections = new Set<number>();
    let recipeIdsInPlan = new Set<number>();

    if (userId !== null) {
        const recipeIds = recipesToReturn.map(r => r.id);

        logger.info('Checking if recipes are in user collections', {
            userId,
            recipeIdsCount: recipeIds.length,
        });

        // Query recipe_collections to find which recipes are in user's collections
        const { data: collectionsData, error: collectionsError } = await client
            .from('recipe_collections')
            .select('recipe_id, collection_id, collections!inner(user_id)')
            .in('recipe_id', recipeIds)
            .eq('collections.user_id', userId);

        if (collectionsError) {
            logger.error('Error checking recipe collections', {
                errorCode: collectionsError.code,
                errorMessage: collectionsError.message,
                userId,
            });
            // Don't fail the entire request - just assume no recipes in collections
        } else if (collectionsData) {
            recipeIdsInCollections = new Set(collectionsData.map((rc: any) => rc.recipe_id));
            logger.info('Found recipes in user collections', {
                count: recipeIdsInCollections.size,
            });
        }

        // Check which recipes are in user's plan
        recipeIdsInPlan = await getRecipeIdsInPlan(client, recipeIds, userId);
    }

    // Map database records to DTOs
    const recipes: PublicRecipeListItemDto[] = recipesToReturn.map((recipe) => {
        const author = profilesById.get(recipe.user_id);

        // This should never happen due to the check above, but TypeScript needs assurance
        if (!author) {
            throw new ApplicationError('INTERNAL_ERROR', `Author profile not found for user_id: ${recipe.user_id}`);
        }

        return {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            image_path: recipe.image_path,
            visibility: recipe.visibility as RecipeVisibility,
            is_owner: userId !== null && recipe.user_id === userId,
            category: recipe.category_id && recipe.category_name
                ? { id: recipe.category_id, name: recipe.category_name }
                : null,
            tags: recipe.tags ? recipe.tags.map((tag) => tag.name) : [],
            author: {
                id: author.id,
                username: author.username,
            },
            created_at: recipe.created_at,
            in_my_collections: recipeIdsInCollections.has(recipe.id),
            in_my_plan: recipeIdsInPlan.has(recipe.id),
            servings: recipe.servings,
            is_termorobot: recipe.is_termorobot,
        };
    });

    // Create next cursor if there are more results
    const nextCursor = hasMore
        ? createNextCursor(offset, recipesToReturn.length, query.limit, sortString, filtersHash)
        : null;

    logger.info('Public recipes feed fetched successfully', {
        count: recipes.length,
        hasMore,
        nextOffset: hasMore ? offset + recipesToReturn.length : null,
    });

    return {
        data: recipes,
        pageInfo: {
            hasMore,
            nextCursor,
        },
    };
}
