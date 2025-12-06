/**
 * Tags Service
 * Contains business logic for tag-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

/**
 * Tag DTO type for API responses.
 * Matches the TagDto defined in shared/contracts/types.ts
 */
export interface TagDto {
    id: number;
    name: string;
}

/** Columns to select for tag queries. */
const TAG_SELECT_COLUMNS = 'id, name';

/**
 * Retrieves all tags belonging to a specific user from the database.
 * Tags are user-defined labels that can be assigned to recipes.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The ID of the authenticated user
 * @returns Array of TagDto objects sorted by name
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getTags(
    client: TypedSupabaseClient,
    userId: string
): Promise<TagDto[]> {
    logger.info('Fetching tags for user', { userId });

    const { data, error } = await client
        .from('tags')
        .select(TAG_SELECT_COLUMNS)
        .eq('user_id', userId)
        .order('name', { ascending: true });

    if (error) {
        logger.error('Database error while fetching tags', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch tags');
    }

    if (!data) {
        logger.warn('No tags found for user - returning empty array', { userId });
        return [];
    }

    logger.info('Tags fetched successfully', { userId, count: data.length });

    return data.map((tag) => ({
        id: tag.id,
        name: tag.name,
    }));
}

