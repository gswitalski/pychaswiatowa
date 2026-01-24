/**
 * Authentication utilities for Edge Functions.
 * Provides functions for JWT token verification and custom claims extraction.
 */

import { z } from 'npm:zod@3.22.4';
import { ApplicationError } from './errors.ts';
import { logger } from './logger.ts';

/**
 * Application role enum - must match shared/contracts/types.ts
 */
export const AppRole = z.enum(['user', 'premium', 'admin']);
export type AppRole = z.infer<typeof AppRole>;

/**
 * JWT payload schema with custom app_role claim.
 * Used for validation of decoded JWT tokens.
 *
 * NOTE: Supabase stores raw_app_meta_data as 'app_metadata' in JWT.
 * app_role can be either directly in payload (custom token hooks)
 * or nested in app_metadata (default Supabase behavior).
 */
const JwtPayloadBaseSchema = z.object({
    sub: z.string().uuid(), // user ID
    role: z.string(), // Supabase role (authenticated, anon, etc.)
});

/**
 * Validated JWT payload with extracted app_role.
 */
interface JwtPayload {
    sub: string;
    role: string;
    app_role: AppRole;
}

/**
 * Decodes a JWT token without verification to extract the payload.
 * This is safe for reading public claims, but should not be used for authorization
 * without proper verification (which Supabase client handles via getUser()).
 *
 * @param token - The JWT token string (with or without "Bearer " prefix)
 * @returns Decoded payload or null if decoding fails
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        // Remove "Bearer " prefix if present
        const cleanToken = token.replace(/^Bearer\s+/i, '').trim();

        const parts = cleanToken.split('.');
        if (parts.length !== 3) {
            return null;
        }

        // Decode base64url payload (middle part)
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = atob(base64);
        const payload = JSON.parse(jsonPayload);

        return payload;
    } catch (error) {
        logger.warn('Failed to decode JWT payload', {
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        return null;
    }
}

/**
 * Extracts app_role from JWT payload, checking both direct claim and app_metadata.
 *
 * Supabase stores raw_app_meta_data as 'app_metadata' in JWT payload.
 * app_role can be:
 * - Directly in payload (if using custom token hooks)
 * - Nested in app_metadata.app_role (default Supabase behavior)
 *
 * @param payload - Decoded JWT payload object
 * @returns Extracted app_role or undefined if not found
 */
function extractAppRoleFromPayload(payload: Record<string, unknown>): string | undefined {
    // Sprawdź najpierw bezpośrednio w payload
    if (typeof payload.app_role === 'string') {
        return payload.app_role;
    }

    // Sprawdź w app_metadata (gdzie Supabase umieszcza raw_app_meta_data)
    if (payload.app_metadata && typeof payload.app_metadata === 'object') {
        const appMetadata = payload.app_metadata as Record<string, unknown>;
        if (typeof appMetadata.app_role === 'string') {
            return appMetadata.app_role;
        }
    }

    return undefined;
}

/**
 * Extracts and validates the app_role claim from a JWT token.
 *
 * This function:
 * 1. Decodes the JWT token
 * 2. Validates the presence of required claims (sub, role)
 * 3. Extracts app_role from payload or app_metadata
 * 4. Validates that app_role is one of: user, premium, admin
 *
 * Note: This function does NOT verify the JWT signature. It assumes the token
 * has already been verified by Supabase client (via getUser()).
 *
 * @param token - The JWT token string (from Authorization header)
 * @returns Validated JWT payload with app_role
 * @throws ApplicationError with UNAUTHORIZED code if token is invalid or claims are missing/invalid
 */
export function extractAndValidateAppRole(token: string): JwtPayload {
    // Decode the token
    const payload = decodeJwtPayload(token);

    if (!payload) {
        logger.warn('Failed to decode JWT token');
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Invalid token format'
        );
    }

    // Validate base payload schema (sub, role)
    const baseValidation = JwtPayloadBaseSchema.safeParse(payload);

    if (!baseValidation.success) {
        logger.warn('JWT token missing required base claims', {
            errors: baseValidation.error.errors,
        });
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Invalid token claims. Please sign in again.'
        );
    }

    // Extract app_role (from payload or app_metadata)
    const rawAppRole = extractAppRoleFromPayload(payload);

    if (!rawAppRole) {
        logger.warn('JWT token missing app_role claim', {
            hasDirectAppRole: 'app_role' in payload,
            hasAppMetadata: 'app_metadata' in payload,
            appMetadataContent: payload.app_metadata,
        });
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Token missing app_role claim. Please sign in again.'
        );
    }

    // Validate app_role value
    const appRoleValidation = AppRole.safeParse(rawAppRole);

    if (!appRoleValidation.success) {
        logger.warn('JWT token has invalid app_role value', {
            rawAppRole,
            validRoles: ['user', 'premium', 'admin'],
        });
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Invalid app_role value. Please sign in again.'
        );
    }

    logger.debug('Successfully extracted and validated app_role', {
        userId: baseValidation.data.sub,
        appRole: appRoleValidation.data,
        source: 'app_role' in payload ? 'direct' : 'app_metadata',
    });

    return {
        sub: baseValidation.data.sub,
        role: baseValidation.data.role,
        app_role: appRoleValidation.data,
    };
}

/**
 * Extracts the Authorization token from a request.
 *
 * @param req - The incoming HTTP request
 * @returns The token string (without "Bearer " prefix)
 * @throws ApplicationError with UNAUTHORIZED code if header is missing or malformed
 */
export function extractAuthToken(req: Request): string {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
        throw new ApplicationError('UNAUTHORIZED', 'Missing Authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
        throw new ApplicationError(
            'UNAUTHORIZED',
            'Invalid Authorization header format. Expected "Bearer <token>"'
        );
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token || token.trim().length === 0) {
        throw new ApplicationError('UNAUTHORIZED', 'Empty authorization token');
    }

    return token;
}

