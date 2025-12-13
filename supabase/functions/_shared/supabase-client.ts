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
