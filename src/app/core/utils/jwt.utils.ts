import { AppRole } from '../../../../shared/contracts/types';

/**
 * Result of JWT app_role extraction with fallback information
 */
export interface JwtAppRoleExtractionResult {
    /** Extracted or fallback app role */
    appRole: AppRole;
    /** True if fallback was used (claim missing/invalid) */
    isFallback: boolean;
    /** Reason for fallback if applicable */
    reason?: 'missing' | 'invalid' | 'decode_failed';
    /** Raw value from JWT for diagnostics */
    rawAppRole?: unknown;
}

/**
 * Decodes the payload section of a JWT token (base64url encoded).
 * Does NOT verify signature - assumes token is already validated by Supabase.
 * 
 * @param token - JWT access token string
 * @returns Decoded payload object or null if decode fails
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        // JWT format: header.payload.signature
        const parts = token.split('.');
        
        if (parts.length !== 3) {
            console.warn('[JWT] Invalid JWT format: expected 3 parts');
            return null;
        }

        const payload = parts[1];
        
        // Base64url decode: replace chars and add padding if needed
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
        
        // Decode base64 to string, then parse JSON
        const jsonPayload = atob(padded);
        return JSON.parse(jsonPayload) as Record<string, unknown>;
    } catch (error) {
        console.warn('[JWT] Failed to decode JWT payload:', error);
        return null;
    }
}

/**
 * Extracts and validates app_role from JWT payload.
 * Applies safe fallback to 'user' if claim is missing or invalid.
 * 
 * @param token - JWT access token string
 * @returns Extraction result with app_role and fallback metadata
 */
export function extractAppRoleFromJwt(token: string): JwtAppRoleExtractionResult {
    const payload = decodeJwtPayload(token);
    
    // Fallback if decode failed
    if (!payload) {
        console.warn('[JWT] Cannot extract app_role: decode failed, using fallback "user"');
        return {
            appRole: 'user',
            isFallback: true,
            reason: 'decode_failed',
        };
    }

    // Supabase stores raw_app_meta_data as 'app_metadata' in JWT
    // app_role can be either directly in payload or nested in app_metadata
    let rawAppRole = payload['app_role'];
    
    // If not found directly, check app_metadata (Supabase's raw_app_meta_data)
    if (!rawAppRole && payload['app_metadata']) {
        const appMetadata = payload['app_metadata'] as Record<string, unknown>;
        rawAppRole = appMetadata['app_role'];
    }

    // Fallback if claim is missing
    if (!rawAppRole) {
        console.warn('[JWT] app_role claim missing in JWT, using fallback "user"');
        return {
            appRole: 'user',
            isFallback: true,
            reason: 'missing',
            rawAppRole,
        };
    }

    // Validate app_role value
    const validRoles: AppRole[] = ['user', 'premium', 'admin'];
    
    if (typeof rawAppRole === 'string' && validRoles.includes(rawAppRole as AppRole)) {
        // Valid role found
        return {
            appRole: rawAppRole as AppRole,
            isFallback: false,
        };
    }

    // Fallback if value is invalid
    console.warn(
        `[JWT] Invalid app_role value in JWT: "${rawAppRole}", using fallback "user"`,
        { rawAppRole }
    );
    return {
        appRole: 'user',
        isFallback: true,
        reason: 'invalid',
        rawAppRole,
    };
}

