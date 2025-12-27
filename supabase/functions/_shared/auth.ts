/**
 * Authentication utilities for Edge Functions.
 * Provides functions for JWT token verification and custom claims extraction.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
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
 */
const JwtPayloadSchema = z.object({
    sub: z.string().uuid(), // user ID
    role: z.string(), // Supabase role (authenticated, anon, etc.)
    app_role: AppRole, // custom application role
});

type JwtPayload = z.infer<typeof JwtPayloadSchema>;

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
 * Extracts and validates the app_role claim from a JWT token.
 * 
 * This function:
 * 1. Decodes the JWT token
 * 2. Validates the presence of required claims (sub, role, app_role)
 * 3. Validates that app_role is one of: user, premium, admin
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

    // Validate the payload schema
    const validationResult = JwtPayloadSchema.safeParse(payload);

    if (!validationResult.success) {
        logger.warn('JWT token missing required claims', {
            errors: validationResult.error.errors,
            hasAppRole: 'app_role' in payload,
            appRoleValue: payload.app_role,
        });

        // Provide specific error message if app_role is missing or invalid
        if (!('app_role' in payload)) {
            throw new ApplicationError(
                'UNAUTHORIZED',
                'Token missing app_role claim. Please sign in again.'
            );
        }

        throw new ApplicationError(
            'UNAUTHORIZED',
            'Invalid token claims. Please sign in again.'
        );
    }

    logger.debug('Successfully extracted and validated app_role', {
        userId: validationResult.data.sub,
        appRole: validationResult.data.app_role,
    });

    return validationResult.data;
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

