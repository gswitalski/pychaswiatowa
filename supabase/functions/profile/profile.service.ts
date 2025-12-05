/**
 * Profile Service
 * Contains business logic for profile-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';

/**
 * Profile DTO type for API responses.
 * Matches the ProfileDto defined in shared/contracts/types.ts
 */
export interface ProfileDto {
    id: string;
    username: string;
}

/** Columns to select for profile queries. */
const PROFILE_SELECT_COLUMNS = 'id, username';

/**
 * Retrieves a user's profile by their user ID.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The user's unique identifier
 * @returns The user's profile data as ProfileDto
 * @throws ApplicationError with NOT_FOUND code if profile doesn't exist
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getProfileByUserId(
    client: TypedSupabaseClient,
    userId: string
): Promise<ProfileDto> {
    logger.info('Fetching profile', { userId });

    const { data, error } = await client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', userId)
        .single();

    if (error) {
        // Handle case where no profile was found (PGRST116 = "Row not found")
        if (error.code === 'PGRST116') {
            logger.warn('Profile not found', { userId });
            throw new ApplicationError('NOT_FOUND', 'Profile not found');
        }

        logger.error('Database error while fetching profile', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch profile');
    }

    if (!data) {
        logger.warn('Profile not found - empty data', { userId });
        throw new ApplicationError('NOT_FOUND', 'Profile not found');
    }

    logger.info('Profile fetched successfully', { userId });

    return {
        id: data.id,
        username: data.username ?? '',
    };
}
