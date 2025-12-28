/**
 * CORS utilities for Edge Functions.
 * Provides consistent CORS header handling across all functions.
 */

/**
 * Standard CORS headers for all responses.
 * Allows all origins for public API access.
 */
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Adds CORS headers to a Response object.
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
 * Creates a CORS preflight response (for OPTIONS requests).
 *
 * @returns Response with 204 No Content and CORS headers
 */
export function createCorsPreflightResponse(): Response {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

