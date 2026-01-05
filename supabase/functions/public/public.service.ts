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
import { getCollectionIdsForRecipe } from '../recipes/recipes.service.ts';

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
 * Recipe diet type enum (public API).
 */
export type RecipeDietType = 'MEAT' | 'VEGETARIAN' | 'VEGAN';

/**
 * Recipe cuisine enum (public API).
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
 * Recipe difficulty enum (public API).
 */
export type RecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Match source for search relevance.
 * Indicates which field provided the best match.
 */
export type SearchMatchSource = 'name' | 'ingredients' | 'tags';

/**
 * Search metadata for relevance scoring.
 * Included in recipe list items when search query is provided.
 */
export interface RecipeSearchMeta {
    /** Relevance score (higher = better match) */
    relevance_score: number;
    /** Field that provided the best match */
    match: SearchMatchSource;
}

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
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: RecipeDietType | null;
    cuisine: RecipeCuisine | null;
    difficulty: RecipeDifficulty | null;
    is_grill: boolean;
    /** Search relevance metadata. Present when q parameter is provided and valid, null otherwise. */
    search: RecipeSearchMeta | null;
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
    /** Array of collection IDs (owned by authenticated user) that contain this recipe. Empty array for anonymous users. */
    collection_ids: number[];
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
    ingredients: RecipeContent | null;
    created_at: string;
    servings: number | null;
    is_termorobot: boolean;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: string | null;
    cuisine: string | null;
    difficulty: string | null;
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
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: string | null;
    cuisine: string | null;
    difficulty: string | null;
}

/**
 * Raw database record from profiles table.
 */
interface ProfileRow {
    id: string;
    username: string;
}

/** Columns to select from recipe_details view. */
const RECIPE_SELECT_COLUMNS = 'id, user_id, name, description, image_path, visibility, category_id, category_name, tags, created_at, servings, is_termorobot, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty, is_grill, ingredients';

/** Columns to select from recipe_details view for single recipe (includes JSONB and user_id). */
const RECIPE_DETAIL_SELECT_COLUMNS = 'id, user_id, name, description, image_path, visibility, category_id, category_name, ingredients, steps, tags, created_at, deleted_at, servings, is_termorobot, prep_time_minutes, total_time_minutes, diet_type, cuisine, difficulty';

/** Columns to select from profiles table. */
const PROFILE_SELECT_COLUMNS = 'id, username';

/** Relevance weights for different match sources */
const RELEVANCE_WEIGHTS = {
    name: 3,
    ingredients: 2,
    tags: 1,
} as const;

/** Maximum number of search tokens allowed (DoS protection) */
const MAX_SEARCH_TOKENS = 10;

/**
 * Tokenizes a search query into individual words.
 * Normalizes to lowercase and removes empty tokens.
 * Limits number of tokens for DoS protection.
 *
 * @param query - The search query string
 * @returns Array of normalized tokens
 */
function tokenizeSearchQuery(query: string): string[] {
    const tokens = query
        .toLowerCase()
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

    // Limit tokens to prevent DoS
    return tokens.slice(0, MAX_SEARCH_TOKENS);
}

/**
 * Checks if text contains all search tokens (AND semantics).
 *
 * @param text - The text to search in (normalized to lowercase)
 * @param tokens - Array of search tokens
 * @returns True if all tokens are found in the text
 */
function textContainsAllTokens(text: string, tokens: string[]): boolean {
    const lowerText = text.toLowerCase();
    return tokens.every((token) => lowerText.includes(token));
}

/**
 * Checks if any tag matches all search tokens.
 * Supports exact match or prefix match for each token.
 *
 * @param tags - Array of tag names
 * @param tokens - Array of search tokens
 * @returns True if at least one tag matches (exact or prefix) all tokens
 */
function tagsMatchTokens(tags: string[], tokens: string[]): boolean {
    if (tags.length === 0 || tokens.length === 0) {
        return false;
    }

    const lowerTags = tags.map((t) => t.toLowerCase());

    // Check if all tokens match at least one tag (exact or prefix)
    return tokens.every((token) =>
        lowerTags.some((tag) => tag === token || tag.startsWith(token))
    );
}

/**
 * Extracts text content from recipe ingredients JSONB.
 *
 * @param ingredients - Recipe ingredients in JSONB format
 * @returns Concatenated text of all ingredient items
 */
function extractIngredientsText(ingredients: RecipeContent | null): string {
    if (!ingredients || !Array.isArray(ingredients)) {
        return '';
    }

    return ingredients
        .filter((item) => item.type === 'item')
        .map((item) => item.content)
        .join(' ');
}

/**
 * Result of relevance calculation for a recipe.
 */
interface RelevanceResult {
    /** Total relevance score */
    score: number;
    /** Primary match source (highest weight) */
    match: SearchMatchSource;
    /** Whether the recipe matches all search tokens (AND semantics) */
    matches: boolean;
}

/**
 * Calculates relevance score for a recipe based on search tokens.
 * Implements AND semantics: recipe must match ALL tokens in at least one field.
 *
 * Weights:
 * - name: 3
 * - ingredients: 2
 * - tags: 1
 *
 * @param recipe - The recipe to score
 * @param tokens - Search tokens (normalized)
 * @returns Relevance result with score, match source, and match status
 */
function calculateRelevance(
    recipe: RecipeDetailsRow,
    tokens: string[]
): RelevanceResult {
    if (tokens.length === 0) {
        return { score: 0, match: 'name', matches: true };
    }

    let totalScore = 0;
    let bestMatch: SearchMatchSource = 'name';
    let bestWeight = 0;
    let hasAnyMatch = false;

    // Check name match (weight: 3)
    const nameMatches = textContainsAllTokens(recipe.name, tokens);
    if (nameMatches) {
        totalScore += RELEVANCE_WEIGHTS.name;
        hasAnyMatch = true;
        if (RELEVANCE_WEIGHTS.name > bestWeight) {
            bestWeight = RELEVANCE_WEIGHTS.name;
            bestMatch = 'name';
        }
    }

    // Check ingredients match (weight: 2)
    const ingredientsText = extractIngredientsText(recipe.ingredients);
    const ingredientsMatch = textContainsAllTokens(ingredientsText, tokens);
    if (ingredientsMatch) {
        totalScore += RELEVANCE_WEIGHTS.ingredients;
        hasAnyMatch = true;
        if (RELEVANCE_WEIGHTS.ingredients > bestWeight) {
            bestWeight = RELEVANCE_WEIGHTS.ingredients;
            bestMatch = 'ingredients';
        }
    }

    // Check tags match (weight: 1)
    const tagNames = recipe.tags ? recipe.tags.map((t) => t.name) : [];
    const tagsMatch = tagsMatchTokens(tagNames, tokens);
    if (tagsMatch) {
        totalScore += RELEVANCE_WEIGHTS.tags;
        hasAnyMatch = true;
        if (RELEVANCE_WEIGHTS.tags > bestWeight) {
            bestWeight = RELEVANCE_WEIGHTS.tags;
            bestMatch = 'tags';
        }
    }

    return {
        score: totalScore,
        match: bestMatch,
        matches: hasAnyMatch,
    };
}

/**
 * Compares two recipes for sorting by relevance (descending), then by created_at (descending), then by id (descending).
 *
 * @param a - First recipe with relevance data
 * @param b - Second recipe with relevance data
 * @returns Comparison result for sort
 */
function compareByRelevance(
    a: { relevance: RelevanceResult; recipe: RecipeDetailsRow },
    b: { relevance: RelevanceResult; recipe: RecipeDetailsRow }
): number {
    // Primary: relevance score descending
    if (b.relevance.score !== a.relevance.score) {
        return b.relevance.score - a.relevance.score;
    }

    // Secondary: created_at descending
    const aDate = new Date(a.recipe.created_at).getTime();
    const bDate = new Date(b.recipe.created_at).getTime();
    if (bDate !== aDate) {
        return bDate - aDate;
    }

    // Tertiary: id descending (stable tie-breaker)
    return b.recipe.id - a.recipe.id;
}

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
 * Search behavior:
 * - When q is provided: uses AND semantics (all tokens must match in at least one field)
 * - Relevance scoring: name=3, ingredients=2, tags=1
 * - Default sort with q: relevance.desc with created_at.desc and id.desc tie-breakers
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
    const hasSearch = !!query.q;
    const tokens = query.q ? tokenizeSearchQuery(query.q) : [];

    // Determine effective sort: when searching, default to relevance
    const effectiveSortField = hasSearch && query.sortField === 'created_at' ? 'relevance' : query.sortField;
    const useRelevanceSort = effectiveSortField === 'relevance';

    logger.info('Fetching public recipes', {
        page: query.page,
        limit: query.limit,
        sort: `${effectiveSortField}.${query.sortDirection}`,
        hasSearch,
        tokenCount: tokens.length,
        useRelevanceSort,
        isAuthenticated: userId !== null,
        userId: userId ?? 'anonymous',
    });

    // Build base query - when searching with relevance, we need to fetch all matching and filter in app
    let dbQuery = client
        .from('recipe_details')
        .select(RECIPE_SELECT_COLUMNS, { count: hasSearch ? 'estimated' : 'exact' })
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

    // Apply termorobot filter if provided
    if (query.termorobot !== undefined) {
        dbQuery = dbQuery.eq('is_termorobot', query.termorobot);
    }

    // Apply diet type filter if provided
    if (query.dietType !== undefined) {
        dbQuery = dbQuery.eq('diet_type', query.dietType);
    }

    // Apply cuisine filter if provided
    if (query.cuisine !== undefined) {
        dbQuery = dbQuery.eq('cuisine', query.cuisine);
    }

    // Apply difficulty filter if provided
    if (query.difficulty !== undefined) {
        dbQuery = dbQuery.eq('difficulty', query.difficulty);
    }

    // Apply grill filter if provided
    if (query.grill !== undefined) {
        dbQuery = dbQuery.eq('is_grill', query.grill);
    }

    // For search queries: fetch all results to filter and sort by relevance in app
    // For non-search queries: use DB-level pagination
    if (hasSearch) {
        // Fetch more records to filter in app - use a reasonable limit
        // We'll apply pagination after filtering
        dbQuery = dbQuery.order('created_at', { ascending: false }).limit(1000);
    } else {
        // No search - use DB-level sorting and pagination
        const ascending = query.sortDirection === 'asc';
        const sortField = query.sortField === 'relevance' ? 'created_at' : query.sortField;
        dbQuery = dbQuery.order(sortField, { ascending });

        const offset = (query.page - 1) * query.limit;
        dbQuery = dbQuery.range(offset, offset + query.limit - 1);
    }

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

    if (!data || data.length === 0) {
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

    let recipeRows = data as RecipeDetailsRow[];

    // For search queries: apply relevance filtering and sorting
    let relevanceMap = new Map<number, RelevanceResult>();

    if (hasSearch && tokens.length > 0) {
        // Calculate relevance for each recipe
        const recipesWithRelevance = recipeRows.map((recipe) => ({
            recipe,
            relevance: calculateRelevance(recipe, tokens),
        }));

        // Filter to only recipes that match ALL tokens (AND semantics)
        const matchingRecipes = recipesWithRelevance.filter((r) => r.relevance.matches);

        logger.info('Filtered recipes by search relevance', {
            beforeFilter: recipeRows.length,
            afterFilter: matchingRecipes.length,
            tokens,
        });

        // Sort by relevance (or by specified field)
        if (useRelevanceSort) {
            matchingRecipes.sort(compareByRelevance);
        } else {
            // Sort by specified field with tie-breakers
            matchingRecipes.sort((a, b) => {
                const ascending = query.sortDirection === 'asc';
                const sortField = query.sortField === 'relevance' ? 'created_at' : query.sortField;

                let comparison = 0;
                if (sortField === 'name') {
                    comparison = a.recipe.name.localeCompare(b.recipe.name);
                } else {
                    // created_at
                    comparison = new Date(a.recipe.created_at).getTime() - new Date(b.recipe.created_at).getTime();
                }

                if (!ascending) {
                    comparison = -comparison;
                }

                // Tie-breaker: id
                if (comparison === 0) {
                    comparison = b.recipe.id - a.recipe.id;
                }

                return comparison;
            });
        }

        // Build relevance map for later use
        matchingRecipes.forEach((r) => {
            relevanceMap.set(r.recipe.id, r.relevance);
        });

        // Apply pagination
        const offset = (query.page - 1) * query.limit;
        const paginatedRecipes = matchingRecipes.slice(offset, offset + query.limit);

        recipeRows = paginatedRecipes.map((r) => r.recipe);

        // Update count for pagination
        const totalItems = matchingRecipes.length;
        const totalPages = Math.ceil(totalItems / query.limit);

        logger.info('Search pagination applied', {
            totalMatching: matchingRecipes.length,
            page: query.page,
            returning: recipeRows.length,
        });

        // Continue with remaining logic using updated recipeRows
        // We need to return early here with proper pagination
        return await buildRecipeListResponse(
            client,
            recipeRows,
            relevanceMap,
            hasSearch,
            userId,
            {
                currentPage: query.page,
                totalPages,
                totalItems,
            }
        );
    }

    // Non-search path: use DB-level count
    const totalItems = count ?? 0;
    const totalPages = Math.ceil(totalItems / query.limit);

    return await buildRecipeListResponse(
        client,
        recipeRows,
        relevanceMap,
        hasSearch,
        userId,
        {
            currentPage: query.page,
            totalPages,
            totalItems,
        }
    );
}

/**
 * Helper function to build recipe list response with profiles, collections, and plan data.
 * Extracted to avoid code duplication between search and non-search paths.
 */
async function buildRecipeListResponse(
    client: TypedSupabaseClient,
    recipeRows: RecipeDetailsRow[],
    relevanceMap: Map<number, RelevanceResult>,
    hasSearch: boolean,
    userId: string | null,
    pagination: PaginationDetails
): Promise<{
    data: PublicRecipeListItemDto[];
    pagination: PaginationDetails;
}> {
    if (recipeRows.length === 0) {
        return {
            data: [],
            pagination,
        };
    }

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

        // Get relevance data if available
        const relevance = relevanceMap.get(recipe.id);
        const searchMeta: RecipeSearchMeta | null = hasSearch && relevance
            ? { relevance_score: relevance.score, match: relevance.match }
            : null;

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
            prep_time_minutes: recipe.prep_time_minutes,
            total_time_minutes: recipe.total_time_minutes,
            diet_type: (recipe.diet_type as RecipeDietType) ?? null,
            cuisine: (recipe.cuisine as RecipeCuisine) ?? null,
            difficulty: (recipe.difficulty as RecipeDifficulty) ?? null,
            is_grill: Boolean(recipe.is_grill),
            search: searchMeta,
        };
    });

    logger.info('Public recipes list built successfully', {
        count: recipes.length,
        totalItems: pagination.totalItems,
        totalPages: pagination.totalPages,
        currentPage: pagination.currentPage,
    });

    return {
        data: recipes,
        pagination,
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

    // Calculate is_owner, in_my_plan, and collection_ids for authenticated users
    const isOwner = userId !== null && recipe.user_id === userId;
    let inMyPlan = false;
    let collectionIds: number[] = [];

    if (userId !== null) {
        // Check if recipe is in user's plan
        const recipeIdsInPlan = await getRecipeIdsInPlan(client, [params.id], userId);
        inMyPlan = recipeIdsInPlan.has(params.id);

        // Get collection IDs that contain this recipe (owned by user)
        collectionIds = await getCollectionIdsForRecipe(client, params.id, userId);
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
        collection_ids: collectionIds,
        servings: recipe.servings,
        is_termorobot: recipe.is_termorobot,
        prep_time_minutes: recipe.prep_time_minutes,
        total_time_minutes: recipe.total_time_minutes,
        diet_type: (recipe.diet_type as RecipeDietType) ?? null,
        cuisine: (recipe.cuisine as RecipeCuisine) ?? null,
        difficulty: (recipe.difficulty as RecipeDifficulty) ?? null,
        is_grill: Boolean(recipe.is_grill),
    };

    logger.info('Public recipe fetched successfully', {
        recipeId: recipeDto.id,
        recipeName: recipeDto.name,
        authorId: recipeDto.author.id,
        isOwner,
        inMyPlan,
        collectionCount: collectionIds.length,
    });

    return recipeDto;
}

/**
 * Retrieves public recipes with cursor-based pagination, sorting, and optional search.
 * Supports optional authentication - when user is authenticated, includes collection information
 * and returns user's own recipes regardless of visibility.
 *
 * Search behavior:
 * - When q is provided: uses AND semantics (all tokens must match in at least one field)
 * - Relevance scoring: name=3, ingredients=2, tags=1
 * - Default sort with q: relevance.desc with created_at.desc and id.desc tie-breakers
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
    const hasSearch = !!query.q;
    const tokens = query.q ? tokenizeSearchQuery(query.q) : [];

    // Determine effective sort: when searching, default to relevance
    const effectiveSortField = hasSearch && query.sortField === 'created_at' ? 'relevance' : query.sortField;
    const useRelevanceSort = effectiveSortField === 'relevance';

    logger.info('Fetching public recipes feed', {
        limit: query.limit,
        sort: `${effectiveSortField}.${query.sortDirection}`,
        hasSearch,
        tokenCount: tokens.length,
        useRelevanceSort,
        hasCursor: !!query.cursor,
        isAuthenticated: userId !== null,
        userId: userId ?? 'anonymous',
    });

    // Build filters hash for cursor validation (include userId to distinguish anonymous vs authenticated)
    const sortString = `${effectiveSortField}.${query.sortDirection}`;
    const filtersHash = await buildFiltersHash({
        sort: sortString,
        q: query.q,
        termorobot: query.termorobot,
        dietType: query.dietType,
        cuisine: query.cuisine,
        difficulty: query.difficulty,
        grill: query.grill,
        userId: userId ?? undefined,
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

    // Apply termorobot filter if provided
    if (query.termorobot !== undefined) {
        dbQuery = dbQuery.eq('is_termorobot', query.termorobot);
    }

    // Apply diet type filter if provided
    if (query.dietType !== undefined) {
        dbQuery = dbQuery.eq('diet_type', query.dietType);
    }

    // Apply cuisine filter if provided
    if (query.cuisine !== undefined) {
        dbQuery = dbQuery.eq('cuisine', query.cuisine);
    }

    // Apply difficulty filter if provided
    if (query.difficulty !== undefined) {
        dbQuery = dbQuery.eq('difficulty', query.difficulty);
    }

    // Apply grill filter if provided
    if (query.grill !== undefined) {
        dbQuery = dbQuery.eq('is_grill', query.grill);
    }

    // For search queries: fetch all results to filter and sort by relevance in app
    // For non-search queries: use DB-level pagination
    if (hasSearch) {
        // Fetch more records to filter in app - use a reasonable limit
        dbQuery = dbQuery.order('created_at', { ascending: false }).limit(1000);
    } else {
        // No search - use DB-level sorting and pagination
        const ascending = query.sortDirection === 'asc';
        const sortField = query.sortField === 'relevance' ? 'created_at' : query.sortField;
        dbQuery = dbQuery
            .order(sortField, { ascending })
            .order('id', { ascending }); // Stable sort tie-breaker

        // Fetch limit+1 to determine if there are more results
        const fetchLimit = query.limit + 1;
        dbQuery = dbQuery.range(offset, offset + fetchLimit - 1);
    }

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

    let recipeRows = data as RecipeDetailsRow[];
    let relevanceMap = new Map<number, RelevanceResult>();
    let hasMore = false;
    let recipesToReturn: RecipeDetailsRow[];

    if (hasSearch && tokens.length > 0) {
        // Calculate relevance for each recipe
        const recipesWithRelevance = recipeRows.map((recipe) => ({
            recipe,
            relevance: calculateRelevance(recipe, tokens),
        }));

        // Filter to only recipes that match ALL tokens (AND semantics)
        const matchingRecipes = recipesWithRelevance.filter((r) => r.relevance.matches);

        logger.info('Filtered recipes by search relevance', {
            beforeFilter: recipeRows.length,
            afterFilter: matchingRecipes.length,
            tokens,
        });

        // Sort by relevance (or by specified field)
        if (useRelevanceSort) {
            matchingRecipes.sort(compareByRelevance);
        } else {
            // Sort by specified field with tie-breakers
            matchingRecipes.sort((a, b) => {
                const ascending = query.sortDirection === 'asc';
                const sortField = query.sortField === 'relevance' ? 'created_at' : query.sortField;

                let comparison = 0;
                if (sortField === 'name') {
                    comparison = a.recipe.name.localeCompare(b.recipe.name);
                } else {
                    // created_at
                    comparison = new Date(a.recipe.created_at).getTime() - new Date(b.recipe.created_at).getTime();
                }

                if (!ascending) {
                    comparison = -comparison;
                }

                // Tie-breaker: id
                if (comparison === 0) {
                    comparison = b.recipe.id - a.recipe.id;
                }

                return comparison;
            });
        }

        // Build relevance map for later use
        matchingRecipes.forEach((r) => {
            relevanceMap.set(r.recipe.id, r.relevance);
        });

        // Apply cursor-based pagination
        const allMatchingRecipes = matchingRecipes.map((r) => r.recipe);

        // Determine if there are more results (fetch limit+1)
        const startIndex = offset;
        const endIndex = offset + query.limit + 1;
        const paginatedSlice = allMatchingRecipes.slice(startIndex, endIndex);

        hasMore = paginatedSlice.length > query.limit;
        recipesToReturn = hasMore ? paginatedSlice.slice(0, query.limit) : paginatedSlice;

        logger.info('Search cursor pagination applied', {
            totalMatching: matchingRecipes.length,
            offset,
            returning: recipesToReturn.length,
            hasMore,
        });
    } else {
        // Non-search path: use DB-level pagination (already applied)
        hasMore = recipeRows.length > query.limit;
        recipesToReturn = hasMore ? recipeRows.slice(0, query.limit) : recipeRows;

        logger.info('Recipes fetched from database', {
            fetchedCount: recipeRows.length,
            returningCount: recipesToReturn.length,
            hasMore,
        });
    }

    if (recipesToReturn.length === 0) {
        return {
            data: [],
            pageInfo: {
                hasMore: false,
                nextCursor: null,
            },
        };
    }

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

        // Get relevance data if available
        const relevance = relevanceMap.get(recipe.id);
        const searchMeta: RecipeSearchMeta | null = hasSearch && relevance
            ? { relevance_score: relevance.score, match: relevance.match }
            : null;

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
            prep_time_minutes: recipe.prep_time_minutes,
            total_time_minutes: recipe.total_time_minutes,
            diet_type: (recipe.diet_type as RecipeDietType) ?? null,
            cuisine: (recipe.cuisine as RecipeCuisine) ?? null,
            difficulty: (recipe.difficulty as RecipeDifficulty) ?? null,
            is_grill: Boolean(recipe.is_grill),
            search: searchMeta,
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
