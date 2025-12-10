/**
 * Search Service
 * Contains business logic for global search operations.
 * Handles searching recipes and collections with full-text and pattern matching.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { SearchRecipeDto, SearchCollectionDto } from './search.types.ts';

/** Columns to select for recipe search results. */
const RECIPE_SEARCH_SELECT = 'id, name, category:categories(name)';

/** Columns to select for collection search results. */
const COLLECTION_SEARCH_SELECT = 'id, name';

/** Maximum number of results per resource type. */
const MAX_RESULTS_PER_TYPE = 10;

// #region --- Search Operations ---

/**
 * Searches recipes by name using case-insensitive pattern matching.
 * Only returns non-deleted recipes belonging to the authenticated user.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param query - The search query string
 * @returns Array of SearchRecipeDto objects matching the query
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function searchRecipes(
    client: TypedSupabaseClient,
    userId: string,
    query: string
): Promise<SearchRecipeDto[]> {
    logger.info('Searching recipes', { userId, query });

    const { data, error } = await client
        .from('recipes')
        .select(RECIPE_SEARCH_SELECT)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .ilike('name', `%${query}%`)
        .limit(MAX_RESULTS_PER_TYPE);

    if (error) {
        logger.error('Database error while searching recipes', {
            userId,
            query,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to search recipes');
    }

    logger.info('Recipes search completed', {
        userId,
        query,
        resultsCount: data?.length ?? 0,
    });

    return (data ?? []).map((recipe) => ({
        id: recipe.id,
        name: recipe.name,
        category: extractCategoryName(recipe.category),
    }));
}

/**
 * Searches collections by name using case-insensitive pattern matching.
 * Only returns collections belonging to the authenticated user.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @param query - The search query string
 * @returns Array of SearchCollectionDto objects matching the query
 * @throws ApplicationError with INTERNAL_ERROR for database errors
 */
export async function searchCollections(
    client: TypedSupabaseClient,
    userId: string,
    query: string
): Promise<SearchCollectionDto[]> {
    logger.info('Searching collections', { userId, query });

    const { data, error } = await client
        .from('collections')
        .select(COLLECTION_SEARCH_SELECT)
        .eq('user_id', userId)
        .ilike('name', `%${query}%`)
        .limit(MAX_RESULTS_PER_TYPE);

    if (error) {
        logger.error('Database error while searching collections', {
            userId,
            query,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to search collections');
    }

    logger.info('Collections search completed', {
        userId,
        query,
        resultsCount: data?.length ?? 0,
    });

    return (data ?? []).map((collection) => ({
        id: collection.id,
        name: collection.name,
    }));
}

// #endregion

// #region --- Helper Functions ---

/**
 * Extracts the category name from a Supabase join result.
 * Handles both single object and array formats returned by Supabase.
 *
 * @param category - The category relation data from Supabase
 * @returns The category name or null if not available
 */
function extractCategoryName(
    category: { name: string } | { name: string }[] | null
): string | null {
    if (!category) {
        return null;
    }

    // Handle array format (shouldn't happen with FK, but be defensive)
    if (Array.isArray(category)) {
        return category[0]?.name ?? null;
    }

    return category.name ?? null;
}

// #endregion

