/**
 * Me Service
 * Contains business logic for the /me endpoint.
 * Provides minimal user profile data for App Shell initialization.
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

/** Columns to select for minimal profile queries. */
const PROFILE_SELECT_COLUMNS = 'id, username';

/**
 * Retrieves the minimal user profile data for the authenticated user.
 * This function is specifically designed for the /me endpoint to provide
 * only the essential user information needed for UI initialization.
 *
 * @param client - The authenticated Supabase client
 * @param userId - The user's unique identifier (from JWT)
 * @returns The user's minimal profile data as ProfileDto
 * @throws ApplicationError with NOT_FOUND code if profile doesn't exist
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getMeProfile(
    client: TypedSupabaseClient,
    userId: string
): Promise<ProfileDto> {
    logger.info('Fetching minimal profile for /me', { userId });

    const { data, error } = await client
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', userId)
        .single();

    if (error) {
        // Handle case where no profile was found (PGRST116 = "Row not found")
        if (error.code === 'PGRST116') {
            logger.warn('Profile not found for authenticated user', {
                userId,
                errorCode: error.code,
            });
            throw new ApplicationError('NOT_FOUND', 'Profile not found');
        }

        // Log database errors without exposing sensitive details
        logger.error('Database error while fetching profile', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to fetch profile');
    }

    // Additional check for empty data (defensive programming)
    if (!data) {
        logger.warn('Profile not found - empty data returned', { userId });
        throw new ApplicationError('NOT_FOUND', 'Profile not found');
    }

    logger.info('Profile fetched successfully for /me', {
        userId,
        username: data.username,
    });

    return {
        id: data.id,
        username: data.username ?? '',
    };
}
