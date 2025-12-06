/**
 * Categories Service
 * Contains business logic for category-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

/**
 * Category DTO type for API responses.
 * Matches the CategoryDto defined in shared/contracts/types.ts
 */
export interface CategoryDto {
    id: number;
    name: string;
}

/** Columns to select for category queries. */
const CATEGORY_SELECT_COLUMNS = 'id, name';

/**
 * Retrieves all categories from the database.
 * Categories are predefined system entries (e.g., "Obiad", "Deser", "Zupa").
 *
 * @param client - The authenticated Supabase client
 * @returns Array of CategoryDto objects sorted by name
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getAllCategories(
    client: TypedSupabaseClient
): Promise<CategoryDto[]> {
    logger.info('Fetching all categories');

    const { data, error } = await client
        .from('categories')
        .select(CATEGORY_SELECT_COLUMNS)
        .order('name', { ascending: true });

    if (error) {
        logger.error('Database error while fetching categories', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch categories');
    }

    if (!data) {
        logger.warn('No categories found - returning empty array');
        return [];
    }

    logger.info('Categories fetched successfully', { count: data.length });

    return data.map((category) => ({
        id: category.id,
        name: category.name,
    }));
}

