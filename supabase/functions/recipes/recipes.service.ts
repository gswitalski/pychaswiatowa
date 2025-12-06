/**
 * Recipes Service
 * Contains business logic for recipe-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

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

