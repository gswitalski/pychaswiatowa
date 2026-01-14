/**
 * AI Handlers
 * HTTP request handlers for AI-powered recipe draft generation endpoint.
 * Includes routing, validation with Zod schemas, and response formatting.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getAuthenticatedContext, getSupabaseClientWithAuth } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { extractAuthToken, extractAndValidateAppRole } from '../_shared/auth.ts';
import { generateRecipeDraft, generateRecipeImage } from './ai.service.ts';
import {
    AiRecipeDraftRequestSchema,
    AiRecipeDraftResponseDto,
    AiRecipeDraftUnprocessableEntityDto,
    AiRecipeImageRequestSchema,
    AiRecipeImageResponseDto,
    AiRecipeImageUnprocessableEntityDto,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_REQUEST_PAYLOAD_SIZE,
} from './ai.types.ts';

// #region --- Response Helpers ---

/**
 * Creates a successful JSON response with the given data.
 */
function createSuccessResponse<T>(data: T, status = 200): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Creates a validation error response (400 Bad Request).
 */
function createValidationErrorResponse(errors: z.ZodError): Response {
    const errorMessages = errors.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
    }));

    return new Response(
        JSON.stringify({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            errors: errorMessages,
        }),
        {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * Creates a 405 Method Not Allowed response.
 */
function createMethodNotAllowedResponse(allowedMethods: string[]): Response {
    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method not allowed. Allowed methods: ${allowedMethods.join(', ')}`,
        }),
        {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                Allow: allowedMethods.join(', '),
            },
        }
    );
}

/**
 * Creates a 413 Payload Too Large response.
 */
function createPayloadTooLargeResponse(message: string): Response {
    return new Response(
        JSON.stringify({
            code: 'PAYLOAD_TOO_LARGE',
            message,
        }),
        {
            status: 413,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * Creates a 422 Unprocessable Entity response for recipe draft.
 */
function createUnprocessableEntityResponse(data: AiRecipeDraftUnprocessableEntityDto): Response {
    return new Response(JSON.stringify(data), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Creates a 422 Unprocessable Entity response for recipe image.
 */
function createImageUnprocessableEntityResponse(data: AiRecipeImageUnprocessableEntityDto): Response {
    return new Response(JSON.stringify(data), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Creates a 403 Forbidden response for premium gating.
 */
function createForbiddenPremiumResponse(): Response {
    return new Response(
        JSON.stringify({
            code: 'FORBIDDEN',
            message: 'Premium feature. Upgrade required.',
        }),
        {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * Creates a 404 Not Found response.
 */
function createNotFoundResponse(message: string): Response {
    return new Response(
        JSON.stringify({
            code: 'NOT_FOUND',
            message,
        }),
        {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

/**
 * Creates a 429 Too Many Requests response.
 */
function createTooManyRequestsResponse(message: string, retryAfterSeconds?: number): Response {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (retryAfterSeconds) {
        headers['Retry-After'] = String(retryAfterSeconds);
    }

    return new Response(
        JSON.stringify({
            code: 'TOO_MANY_REQUESTS',
            message,
        }),
        {
            status: 429,
            headers,
        }
    );
}

// #endregion

// #region --- URL Parsing Helpers ---

/**
 * Extracts the path after /functions/v1/ai from the URL.
 */
function getPathFromUrl(url: string): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match patterns like /functions/v1/ai or /ai
    const match = pathname.match(/(?:\/functions\/v1)?\/ai(.*)/);
    return match ? match[1] : '';
}

// #endregion

// #region --- Helpers ---

/**
 * Decodes base64 string to Uint8Array.
 * Throws ApplicationError if decoding fails.
 */
function decodeBase64(base64String: string): Uint8Array {
    try {
        // Handle both standard base64 and base64url
        const normalized = base64String
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        const binaryString = atob(normalized);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    } catch {
        throw new ApplicationError('VALIDATION_ERROR', 'Invalid base64 encoding in image data');
    }
}

// #endregion

// #region --- Handlers ---

/**
 * Handles POST /ai/recipes/draft request.
 * Generates a recipe draft from text or image using AI.
 *
 * @param req - The incoming HTTP request
 * @returns Response with generated recipe draft or error
 */
async function handlePostAiRecipesDraft(req: Request): Promise<Response> {
    const startTime = Date.now();
    
    try {
        logger.info('Handling POST /ai/recipes/draft request');

        // Authenticate user
        const { user } = await getAuthenticatedContext(req);

        logger.info('User authenticated for AI recipe draft', {
            userId: user.id,
        });

        // Parse request body
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            logger.warn('Invalid JSON in request body', { userId: user.id });
            return new Response(
                JSON.stringify({
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid JSON in request body',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Validate request body with Zod schema
        const validationResult = AiRecipeDraftRequestSchema.safeParse(body);

        if (!validationResult.success) {
            logger.warn('Request validation failed', {
                userId: user.id,
                errors: validationResult.error.errors,
            });
            return createValidationErrorResponse(validationResult.error);
        }

        const requestData = validationResult.data;

        // Process based on source type
        let inputText: string | undefined;
        let imageBytes: Uint8Array | undefined;
        let imageMimeType: string | undefined;

        if (requestData.source === 'text') {
            inputText = requestData.text.trim();
            
            logger.info('Processing text source', {
                userId: user.id,
                textLength: inputText.length,
            });
        } else if (requestData.source === 'image') {
            // Decode base64 image
            imageBytes = decodeBase64(requestData.image.data_base64);
            imageMimeType = requestData.image.mime_type;

            // Validate image size
            if (imageBytes.length > MAX_IMAGE_SIZE_BYTES) {
                const maxSizeMB = MAX_IMAGE_SIZE_BYTES / (1024 * 1024);
                logger.warn('Image size exceeds limit', {
                    userId: user.id,
                    imageSize: imageBytes.length,
                    maxSize: MAX_IMAGE_SIZE_BYTES,
                });
                return createPayloadTooLargeResponse(
                    `Image size exceeds maximum allowed size of ${maxSizeMB} MB`
                );
            }

            logger.info('Processing image source', {
                userId: user.id,
                imageSize: imageBytes.length,
                mimeType: imageMimeType,
            });
        }

        // Call service to generate recipe draft
        const result = await generateRecipeDraft({
            userId: user.id,
            source: requestData.source,
            text: inputText,
            imageBytes,
            imageMimeType,
            language: requestData.language,
        });

        const duration = Date.now() - startTime;

        // Handle service result
        if (!result.success) {
            logger.warn('Recipe draft generation failed - not a valid single recipe', {
                userId: user.id,
                reasons: result.reasons,
                duration,
            });
            return createUnprocessableEntityResponse({
                message: 'The provided content does not describe a valid single recipe',
                reasons: result.reasons,
            });
        }

        logger.info('Recipe draft generated successfully', {
            userId: user.id,
            recipeName: result.data.draft.name,
            tagsCount: result.data.draft.tags.length,
            hasTips: !!result.data.draft.tips_raw,
            confidence: result.data.meta.confidence,
            duration,
        });

        return createSuccessResponse<AiRecipeDraftResponseDto>(result.data);
    } catch (error) {
        const duration = Date.now() - startTime;
        
        // Handle rate limiting errors
        if (error instanceof ApplicationError && error.code === 'TOO_MANY_REQUESTS') {
            logger.warn('Rate limit exceeded', { duration });
            return createTooManyRequestsResponse(error.message, 60);
        }

        logger.error('Error in handlePostAiRecipesDraft', {
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
        });

        return handleError(error);
    }
}

/**
 * Handles POST /ai/recipes/image request.
 * Generates a preview image of a recipe dish using AI.
 * 
 * Premium feature - requires app_role of 'premium' or 'admin'.
 *
 * @param req - The incoming HTTP request
 * @returns Response with generated image (base64) or error
 */
async function handlePostAiRecipesImage(req: Request): Promise<Response> {
    const startTime = Date.now();

    try {
        logger.info('Handling POST /ai/recipes/image request');

        // Step 1: Authenticate user (JWT verification)
        const { user } = await getAuthenticatedContext(req);

        logger.info('User authenticated for AI recipe image', {
            userId: user.id,
        });

        // Step 2: Premium gating - verify app_role
        const token = extractAuthToken(req);
        const jwtPayload = extractAndValidateAppRole(token);

        if (jwtPayload.app_role === 'user') {
            logger.warn('Non-premium user attempted to access recipe image generation', {
                userId: user.id,
                appRole: jwtPayload.app_role,
            });
            return createForbiddenPremiumResponse();
        }

        logger.info('Premium access verified', {
            userId: user.id,
            appRole: jwtPayload.app_role,
        });

        // Step 3: Parse request body
        let body: unknown;
        let rawBodyString: string;
        try {
            rawBodyString = await req.text();
            
            // Check payload size limit (DoS protection)
            if (rawBodyString.length > MAX_IMAGE_REQUEST_PAYLOAD_SIZE) {
                logger.warn('Request payload too large', {
                    userId: user.id,
                    size: rawBodyString.length,
                    maxSize: MAX_IMAGE_REQUEST_PAYLOAD_SIZE,
                });
                return createPayloadTooLargeResponse(
                    `Request payload exceeds maximum allowed size of ${MAX_IMAGE_REQUEST_PAYLOAD_SIZE} characters`
                );
            }
            
            body = JSON.parse(rawBodyString);
        } catch {
            logger.warn('Invalid JSON in request body', { userId: user.id });
            return new Response(
                JSON.stringify({
                    code: 'VALIDATION_ERROR',
                    message: 'Invalid JSON in request body',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        // Step 4: Validate request body with Zod schema
        const validationResult = AiRecipeImageRequestSchema.safeParse(body);

        if (!validationResult.success) {
            logger.warn('Request validation failed', {
                userId: user.id,
                errors: validationResult.error.errors,
            });
            return createValidationErrorResponse(validationResult.error);
        }

        const requestData = validationResult.data;

        // Step 5: Ownership check - verify recipe belongs to user (via RLS)
        const supabase = getSupabaseClientWithAuth(token);
        const { data: recipeExists, error: recipeError } = await supabase
            .from('recipes')
            .select('id')
            .eq('id', requestData.recipe.id)
            .is('deleted_at', null)
            .single();

        if (recipeError || !recipeExists) {
            logger.warn('Recipe not found or not owned by user', {
                userId: user.id,
                recipeId: requestData.recipe.id,
                error: recipeError?.message,
            });
            return createNotFoundResponse(
                'Recipe not found or you do not have access to it'
            );
        }

        logger.info('Recipe ownership verified', {
            userId: user.id,
            recipeId: requestData.recipe.id,
        });

        // Step 6: Call service to generate recipe image
        const result = await generateRecipeImage({
            userId: user.id,
            recipe: requestData.recipe,
            language: requestData.language,
        });

        const duration = Date.now() - startTime;

        // Step 7: Handle service result
        if (!result.success) {
            logger.warn('Recipe image generation failed - insufficient information', {
                userId: user.id,
                recipeId: requestData.recipe.id,
                reasons: result.reasons,
                duration,
            });
            return createImageUnprocessableEntityResponse({
                message: 'Insufficient information to generate a sensible dish image',
                reasons: result.reasons,
            });
        }

        logger.info('Recipe image generated successfully', {
            userId: user.id,
            recipeId: requestData.recipe.id,
            duration,
        });

        return createSuccessResponse<AiRecipeImageResponseDto>(result.data);
    } catch (error) {
        const duration = Date.now() - startTime;

        // Handle rate limiting errors
        if (error instanceof ApplicationError && error.code === 'TOO_MANY_REQUESTS') {
            logger.warn('Rate limit exceeded for image generation', { duration });
            return createTooManyRequestsResponse(error.message, 60);
        }

        logger.error('Error in handlePostAiRecipesImage', {
            error: error instanceof Error ? error.message : 'Unknown error',
            duration,
        });

        return handleError(error);
    }
}

// #endregion

// #region --- Router ---

/**
 * AI router - routes HTTP requests to appropriate handlers.
 * Handles all AI-related endpoints with URL pattern matching.
 *
 * Supported routes:
 * - POST /ai/recipes/draft - Generate recipe draft from text or image
 * - POST /ai/recipes/image - Generate preview image of a recipe dish (premium)
 */
export async function aiRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = getPathFromUrl(req.url);

    logger.debug('Routing AI request', { method, path });

    // Route: POST /ai/recipes/image (check first - more specific path)
    if (path === '/recipes/image' || path === '/recipes/image/') {
        if (method === 'POST') {
            return handlePostAiRecipesImage(req);
        }
        return createMethodNotAllowedResponse(['POST']);
    }

    // Route: POST /ai/recipes/draft
    if (path === '/recipes/draft' || path === '/recipes/draft/') {
        if (method === 'POST') {
            return handlePostAiRecipesDraft(req);
        }
        return createMethodNotAllowedResponse(['POST']);
    }

    // No matching route found
    logger.warn('AI route not found', { method, path });
    return new Response(
        JSON.stringify({
            code: 'NOT_FOUND',
            message: 'Endpoint not found',
        }),
        {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        }
    );
}

// #endregion

