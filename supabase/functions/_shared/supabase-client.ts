/**
 * Supabase client utilities for Edge Functions.
 * Provides functions to create authenticated Supabase clients.
 */

import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';
import { Database } from './database.types.ts';
import { ApplicationError } from './errors.ts';

export type TypedSupabaseClient = SupabaseClient<Database>;

/**
 * Creates an authenticated Supabase client using the JWT token from the request.
 *
 * @param req - The incoming HTTP request
 * @returns An authenticated Supabase client
 * @throws ApplicationError with UNAUTHORIZED code if no valid token is provided
 */
export function createAuthenticatedClient(req: Request): TypedSupabaseClient {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
        throw new ApplicationError('UNAUTHORIZED', 'Missing Authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Supabase configuration');
    }

    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: authHeader },
        },
    });
}

/**
 * Extracts and validates the authenticated user from the Supabase client.
 *
 * @param client - The authenticated Supabase client
 * @returns The authenticated user object
 * @throws ApplicationError with UNAUTHORIZED code if the user is not authenticated
 */
export async function getAuthenticatedUser(client: TypedSupabaseClient): Promise<User> {
    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
        throw new ApplicationError('UNAUTHORIZED', 'Invalid or expired token');
    }

    return user;
}

/**
 * Creates an authenticated Supabase client and extracts the user in one call.
 * Convenience function for endpoints that need both the client and user.
 *
 * @param req - The incoming HTTP request
 * @returns Object containing the authenticated client and user
 * @throws ApplicationError with UNAUTHORIZED code if authentication fails
 */
export async function getAuthenticatedContext(req: Request): Promise<{
    client: TypedSupabaseClient;
    user: User;
}> {
    const client = createAuthenticatedClient(req);
    const user = await getAuthenticatedUser(client);
    return { client, user };
}

/**
 * Creates an authenticated Supabase client using a JWT token directly.
 * Useful when the token has already been extracted from the request.
 *
 * @param token - The JWT token string (without "Bearer " prefix)
 * @returns An authenticated Supabase client
 * @throws ApplicationError with INTERNAL_ERROR code if configuration is missing
 */
export function getSupabaseClientWithAuth(token: string): TypedSupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Supabase configuration');
    }

    return createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` },
        },
    });
}

/**
 * Wydobywa token dostępu z nagłówka Authorization lub ciasteczek Supabase.
 * Obsługuje standardowe nagłówki Bearer oraz cookie `sb-access-token`
 * (Auth Helpers) i `supabase-auth-token` (wartość JSON z access_token).
 */
function extractAccessToken(req: Request): string | null {
    const authHeader = req.headers.get('Authorization');

    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice('bearer '.length).trim();
        if (token && token !== 'undefined' && token !== 'null') {
            return token;
        }
    }

    const cookieHeader = req.headers.get('Cookie');
    if (!cookieHeader) {
        return null;
    }

    const cookies = cookieHeader.split(';').map((c) => c.trim());
    const cookieMap = new Map<string, string>();
    for (const cookie of cookies) {
        const [name, ...rest] = cookie.split('=');
        if (!name || rest.length === 0) continue;
        cookieMap.set(name, rest.join('='));
    }

    const directToken =
        cookieMap.get('sb-access-token') ??
        cookieMap.get('sb_access_token') ??
        cookieMap.get('sb:token');

    if (directToken) {
        return decodeURIComponent(directToken);
    }

    const supabaseAuthToken = cookieMap.get('supabase-auth-token');
    if (supabaseAuthToken) {
        try {
            // supabase-auth-token przechowuje JSON: [access_token, refresh_token]
            const parsed = JSON.parse(decodeURIComponent(supabaseAuthToken));
            if (Array.isArray(parsed) && parsed[0]) {
                return parsed[0] as string;
            }
        } catch {
            // Ignoruj błędny format, traktuj jako brak tokena
        }
    }

    return null;
}

/**
 * Creates a Supabase client with service role key for bypassing RLS.
 * Use ONLY for public endpoints or admin operations where RLS needs to be bypassed.
 *
 * ⚠️ WARNING: This client has full access to the database. Always enforce
 * application-level security filters (e.g., visibility='PUBLIC').
 *
 * @returns Service role Supabase client
 * @throws ApplicationError with INTERNAL_ERROR code if configuration is missing
 */
export function createServiceRoleClient(): TypedSupabaseClient {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Supabase service role configuration');
    }

    return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * Decodes a JWT token without verification to extract the payload.
 * Used to check the 'role' claim to distinguish anon key from user token.
 *
 * @param token - The JWT token string
 * @returns Decoded payload or null if decoding fails
 */
function decodeJwtPayload(token: string): { role?: string; sub?: string } | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;

        // Decode base64url payload (middle part)
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        return payload;
    } catch {
        return null;
    }
}

/**
 * Extracts optional user ID from Authorization header or Supabase auth cookies.
 * Returns null if no valid user JWT is found (anon key, missing token, or malformed).
 * Throws ApplicationError with UNAUTHORIZED code if a real JWT token is invalid.
 *
 * Use this for endpoints that support both authenticated and anonymous access.
 *
 * Detection logic:
 * 1. Szukaj Bearer tokena w Authorization; jeśli brak, spróbuj cookies (sb-access-token / supabase-auth-token)
 * 2. Brak tokena lub token nie wygląda na JWT → anonymous
 * 3. JWT z role='anon' → anonymous (anon key)
 * 4. JWT z role='authenticated' → verify and return user
 * 5. Invalid/expired JWT → UNAUTHORIZED error
 *
 * @param req - The incoming HTTP request
 * @returns User object or null for anonymous request
 * @throws ApplicationError with UNAUTHORIZED code if JWT token is present but invalid
 * @throws ApplicationError with INTERNAL_ERROR code if configuration is missing
 */
export async function getOptionalAuthenticatedUser(req: Request): Promise<User | null> {
    const token = extractAccessToken(req);

    // Token doesn't look like JWT = anonymous request
    if (!token || !token.startsWith('eyJ')) {
        return null;
    }

    // Decode JWT to check role claim
    const payload = decodeJwtPayload(token);

    // If we can't decode or role is 'anon', treat as anonymous
    // Supabase anon key is a JWT with role='anon'
    // User tokens have role='authenticated'
    if (!payload || payload.role === 'anon') {
        return null;
    }

    // Token has role='authenticated' or other role - must be valid user token
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Supabase configuration');
    }

    // Verify token
    const client = createClient<Database>(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` },
        },
    });

    const { data: { user }, error } = await client.auth.getUser();

    if (error || !user) {
        throw new ApplicationError('UNAUTHORIZED', 'Invalid or expired token');
    }

    return user;
}
