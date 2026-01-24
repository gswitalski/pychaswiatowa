/**
 * Shared CORS configuration for all Supabase Edge Functions.
 * 
 * IMPORTANT:
 * - OPTIONS requests MUST return status 200 (not 204) for proper CORS preflight
 * - CORS headers MUST be added to ALL responses (success and errors)
 * - OPTIONS handler MUST be at the top of each function handler
 * 
 * References:
 * - https://supabase.com/docs/guides/functions/cors
 * - https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
 */

/**
 * CORS headers allowing cross-origin requests from any origin.
 * Adjust 'Access-Control-Allow-Origin' for production if needed.
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
};

/**
 * Adds CORS headers to the response.
 * Use this helper to ensure all responses include proper CORS headers.
 *
 * @param response - The original response
 * @returns New response with CORS headers added
 */
export function addCorsHeaders(response: Response): Response {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

/**
 * Returns a proper response for CORS preflight (OPTIONS) requests.
 * 
 * CRITICAL: This MUST return status 200 (not 204) to pass CORS preflight check.
 * Use this at the top of each function handler.
 * 
 * @returns Response with CORS headers and status 200
 */
export function handleCorsPreflightRequest(): Response {
    return new Response('ok', {
        status: 200,
        headers: corsHeaders,
    });
}
