/**
 * Profile Service
 * Contains business logic for profile-related operations.
 */

import { TypedSupabaseClient } from '../_shared/supabase-client.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import type { ChangePasswordPayload, UpdateProfileSettingsPayload } from './profile.types.ts';

/**
 * Profile settings DTO type for API responses.
 * Matches the ProfileSettingsDto defined in shared/contracts/types.ts.
 */
export interface ProfileSettingsDto {
    id: string;
    email: string;
    username: string;
    marketing_consent: boolean;
    marketing_consent_updated_at: string | null;
    marketing_consent_text_version: string | null;
}

/** Columns to select for profile queries. */
const PROFILE_SETTINGS_SELECT_COLUMNS =
    'id, username, marketing_consent, marketing_consent_updated_at, marketing_consent_text_version';

/**
 * Response DTO for GET /profile/username-available.
 * Kept in sync with UsernameAvailableResponseDto in shared/contracts/types.ts.
 */
export interface UsernameAvailableResponseDto {
    available: boolean;
}

/**
 * Escapes PostgreSQL ILIKE wildcard characters to compare usernames literally.
 */
function escapeIlikePattern(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&');
}

/**
 * Checks whether a username is unused, with case-insensitive matching.
 *
 * @param params - Database client and username to check
 * @returns Whether no existing profile has the requested username
 * @throws ApplicationError with INTERNAL_ERROR code when the query fails
 */
export async function checkUsernameAvailable(params: {
    client: TypedSupabaseClient;
    username: string;
}): Promise<UsernameAvailableResponseDto> {
    const { client, username } = params;
    const usernamePattern = escapeIlikePattern(username);

    logger.info('Checking username availability');

    const { count, error } = await client
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .ilike('username', usernamePattern);

    if (error) {
        logger.error('Failed to check username availability', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to check username availability');
    }

    return { available: count === 0 };
}

/**
 * Reads marketing consent versions from backend SQL source of truth.
 */
async function getSupportedMarketingConsentTextVersions(
    client: TypedSupabaseClient
): Promise<string[]> {
    const { data, error } = await client.rpc('supported_marketing_consent_text_versions');

    if (error) {
        logger.error('Failed to fetch supported marketing consent text versions', {
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to validate marketing consent version');
    }

    if (!Array.isArray(data) || !data.every((item) => typeof item === 'string')) {
        logger.error('Invalid response shape for supported marketing consent text versions');
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to validate marketing consent version');
    }

    return data;
}

/**
 * Retrieves profile settings for an authenticated user.
 *
 * @param params - Aggregated request context for profile fetch
 * @returns The user's profile settings as ProfileSettingsDto
 * @throws ApplicationError with NOT_FOUND code if profile doesn't exist
 * @throws ApplicationError with INTERNAL_ERROR code for database errors
 */
export async function getProfileSettings(params: {
    client: TypedSupabaseClient;
    userId: string;
    email: string;
}): Promise<ProfileSettingsDto> {
    const { client, userId, email } = params;

    logger.info('Fetching profile', { userId });

    const { data, error } = await client
        .from('profiles')
        .select(PROFILE_SETTINGS_SELECT_COLUMNS)
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

    const profileRow = data as {
        id: string;
        username: string | null;
        marketing_consent?: boolean | null;
        marketing_consent_updated_at?: string | null;
        marketing_consent_text_version?: string | null;
    };

    return {
        id: profileRow.id,
        email,
        username: profileRow.username ?? '',
        marketing_consent: profileRow.marketing_consent ?? false,
        marketing_consent_updated_at: profileRow.marketing_consent_updated_at ?? null,
        marketing_consent_text_version: profileRow.marketing_consent_text_version ?? null,
    };
}

/**
 * Updates profile settings for an authenticated user.
 */
export async function updateProfileSettings(params: {
    client: TypedSupabaseClient;
    userId: string;
    email: string;
    payload: UpdateProfileSettingsPayload;
}): Promise<ProfileSettingsDto> {
    const { client, userId, email, payload } = params;
    const normalizedUsername = payload.username.trim();

    if (normalizedUsername.length < 3 || normalizedUsername.length > 50) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Username must contain between 3 and 50 characters'
        );
    }

    const supportedVersions = await getSupportedMarketingConsentTextVersions(client);
    if (!supportedVersions.includes(payload.marketing_consent_text_version)) {
        throw new ApplicationError(
            'UNPROCESSABLE_ENTITY',
            'Unsupported marketing consent text version'
        );
    }

    const updatePayload: Record<string, unknown> = {
        username: normalizedUsername,
        marketing_consent: payload.marketing_consent,
        marketing_consent_updated_at: new Date().toISOString(),
        marketing_consent_text_version: payload.marketing_consent_text_version,
    };

    const { data, error } = await client
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select(PROFILE_SETTINGS_SELECT_COLUMNS)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            logger.warn('Profile not found during update', { userId });
            throw new ApplicationError('NOT_FOUND', 'Profile not found');
        }

        if (error.code === '23505') {
            logger.warn('Username conflict during profile update', { userId });
            throw new ApplicationError('CONFLICT', 'Username is already taken');
        }

        logger.error('Failed to update profile settings', {
            userId,
            errorCode: error.code,
            errorMessage: error.message,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to update profile settings');
    }

    if (!data) {
        logger.warn('Profile update returned empty data', { userId });
        throw new ApplicationError('NOT_FOUND', 'Profile not found');
    }

    const profileRow = data as {
        id: string;
        username: string | null;
        marketing_consent?: boolean | null;
        marketing_consent_updated_at?: string | null;
        marketing_consent_text_version?: string | null;
    };

    return {
        id: profileRow.id,
        email,
        username: profileRow.username ?? '',
        marketing_consent: profileRow.marketing_consent ?? false,
        marketing_consent_updated_at: profileRow.marketing_consent_updated_at ?? null,
        marketing_consent_text_version: profileRow.marketing_consent_text_version ?? null,
    };
}

/**
 * Verifies whether current password is valid for the given user email.
 * Uses isolated auth client to avoid mutating the active user session.
 */
export async function verifyCurrentPassword(params: {
    authClient: TypedSupabaseClient;
    userId: string;
    email: string;
    currentPassword: string;
}): Promise<void> {
    const { authClient, userId, email, currentPassword } = params;

    const { error } = await authClient.auth.signInWithPassword({
        email,
        password: currentPassword,
    });

    if (error) {
        logger.warn('Current password verification failed', {
            userId,
            errorCode: error.name,
        });
        throw new ApplicationError('UNPROCESSABLE_ENTITY', 'Current password is invalid');
    }
}

/**
 * Changes password for currently authenticated user.
 */
export async function changePassword(params: {
    adminClient: TypedSupabaseClient;
    userId: string;
    newPassword: string;
}): Promise<void> {
    const { adminClient, userId, newPassword } = params;

    const { error } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
    });
    if (!error) {
        return;
    }

    const message = error.message.toLowerCase();
    if (message.includes('password') || message.includes('security')) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'New password does not meet security requirements'
        );
    }

    logger.error('Failed to change password', {
        errorCode: error.name,
        errorMessage: error.message,
    });
    throw new ApplicationError('INTERNAL_ERROR', 'Failed to change password');
}
