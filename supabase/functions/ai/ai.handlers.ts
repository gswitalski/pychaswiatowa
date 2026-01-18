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
import { generateRecipeDraft, generateRecipeImage, generateNormalizedIngredients } from './ai.service.ts';
import {
    AiNormalizedIngredientsRequestSchema,
    AiNormalizedIngredientsResponseDto,
    AiRecipeDraftRequestSchema,
    AiRecipeDraftResponseDto,
    AiRecipeDraftUnprocessableEntityDto,
    AiRecipeImageRequestSchema,
    AiRecipeImageResponseDto,
    AiRecipeImageUnprocessableEntityDto,
    AiRecipeImageMode,
    ReferenceImageData,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_REQUEST_PAYLOAD_SIZE,
    MAX_REFERENCE_IMAGE_SIZE_BYTES,
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

        // Step 6: Resolve mode (auto -> recipe_only or with_reference)
        const requestMode = requestData.mode || 'auto';
        const hasReferenceImage = !!requestData.reference_image;
        
        let resolvedMode: Exclude<AiRecipeImageMode, 'auto'>;
        if (requestMode === 'auto') {
            resolvedMode = hasReferenceImage ? 'with_reference' : 'recipe_only';
            logger.info('Mode auto-resolved', {
                userId: user.id,
                recipeId: requestData.recipe.id,
                hasReferenceImage,
                resolvedMode,
            });
        } else {
            resolvedMode = requestMode as Exclude<AiRecipeImageMode, 'auto'>;
            logger.info('Mode explicitly set', {
                userId: user.id,
                recipeId: requestData.recipe.id,
                resolvedMode,
            });
        }

        // Step 7: Handle reference image (if present)
        let referenceImageData: ReferenceImageData | undefined;
        const warnings: string[] = [];

        if (requestData.reference_image) {
            try {
                if (requestData.reference_image.source === 'storage_path') {
                    // Download from Supabase Storage
                    const imagePath = requestData.reference_image.image_path;
                    
                    logger.info('Downloading reference image from storage', {
                        userId: user.id,
                        recipeId: requestData.recipe.id,
                        imagePath: imagePath.substring(0, 50) + '...', // log prefix only for security
                    });

                    // Bucket name is fixed (image_path contains only the file path within the bucket)
                    const bucket = 'recipe-images';
                    const filePath = imagePath;

                    const { data: imageBlob, error: downloadError } = await supabase
                        .storage
                        .from(bucket)
                        .download(filePath);

                    if (downloadError || !imageBlob) {
                        logger.warn('Failed to download reference image from storage', {
                            userId: user.id,
                            recipeId: requestData.recipe.id,
                            bucket,
                            filePath,
                            error: downloadError,
                        });
                        
                        // Fallback: if mode=auto, switch to recipe_only
                        if (requestMode === 'auto') {
                            resolvedMode = 'recipe_only';
                            warnings.push('Reference image could not be loaded, using recipe_only mode');
                            logger.info('Falling back to recipe_only mode', {
                                userId: user.id,
                                recipeId: requestData.recipe.id,
                            });
                        } else {
                            return createNotFoundResponse(
                                'Reference image not found or you do not have access to it'
                            );
                        }
                    } else {
                        // Convert Blob to Uint8Array
                        const arrayBuffer = await imageBlob.arrayBuffer();
                        const bytes = new Uint8Array(arrayBuffer);

                        // Validate size
                        if (bytes.length > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
                            const maxSizeMB = MAX_REFERENCE_IMAGE_SIZE_BYTES / (1024 * 1024);
                            logger.warn('Reference image from storage exceeds size limit', {
                                userId: user.id,
                                recipeId: requestData.recipe.id,
                                imageSize: bytes.length,
                                maxSize: MAX_REFERENCE_IMAGE_SIZE_BYTES,
                            });
                            return createPayloadTooLargeResponse(
                                `Reference image size exceeds maximum allowed size of ${maxSizeMB} MB`
                            );
                        }

                        referenceImageData = {
                            bytes,
                            mimeType: imageBlob.type || 'image/jpeg', // default fallback
                            source: 'storage_path',
                        };

                        logger.info('Reference image loaded from storage', {
                            userId: user.id,
                            recipeId: requestData.recipe.id,
                            imageSize: bytes.length,
                            mimeType: referenceImageData.mimeType,
                        });
                    }
                } else if (requestData.reference_image.source === 'base64') {
                    // Decode base64
                    logger.info('Decoding reference image from base64', {
                        userId: user.id,
                        recipeId: requestData.recipe.id,
                    });

                    const bytes = decodeBase64(requestData.reference_image.data_base64);

                    // Validate size
                    if (bytes.length > MAX_REFERENCE_IMAGE_SIZE_BYTES) {
                        const maxSizeMB = MAX_REFERENCE_IMAGE_SIZE_BYTES / (1024 * 1024);
                        logger.warn('Reference image from base64 exceeds size limit', {
                            userId: user.id,
                            recipeId: requestData.recipe.id,
                            imageSize: bytes.length,
                            maxSize: MAX_REFERENCE_IMAGE_SIZE_BYTES,
                        });
                        return createPayloadTooLargeResponse(
                            `Reference image size exceeds maximum allowed size of ${maxSizeMB} MB`
                        );
                    }

                    referenceImageData = {
                        bytes,
                        mimeType: requestData.reference_image.mime_type,
                        source: 'base64',
                    };

                    logger.info('Reference image decoded from base64', {
                        userId: user.id,
                        recipeId: requestData.recipe.id,
                        imageSize: bytes.length,
                        mimeType: referenceImageData.mimeType,
                    });
                }
            } catch (error) {
                logger.error('Error processing reference image', {
                    userId: user.id,
                    recipeId: requestData.recipe.id,
                    error: error instanceof Error ? error.message : 'Unknown error',
                });

                // Fallback: if mode=auto, switch to recipe_only
                if (requestMode === 'auto') {
                    resolvedMode = 'recipe_only';
                    warnings.push('Reference image processing failed, using recipe_only mode');
                    referenceImageData = undefined;
                } else {
                    throw error;
                }
            }
        }

        // Step 8: Call service to generate recipe image
        const result = await generateRecipeImage({
            userId: user.id,
            recipe: requestData.recipe,
            language: requestData.language,
            resolvedMode,
            referenceImage: referenceImageData,
        });

        const duration = Date.now() - startTime;

        // Step 9: Handle service result
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

        // Merge handler warnings with service warnings
        if (warnings.length > 0) {
            result.data.meta.warnings = [...warnings, ...result.data.meta.warnings];
        }

        logger.info('Recipe image generated successfully', {
            userId: user.id,
            recipeId: requestData.recipe.id,
            mode: result.data.meta.mode,
            hasWarnings: result.data.meta.warnings.length > 0,
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

/**
 * Handles POST /ai/recipes/normalized-ingredients request.
 * Normalizes recipe ingredients to structured format for shopping lists.
 *
 * @param req - The incoming HTTP request
 * @returns Response with normalized ingredients or error
 */
async function handlePostAiRecipesNormalizedIngredients(req: Request): Promise<Response> {
    const startTime = Date.now();

    try {
        logger.info('Handling POST /ai/recipes/normalized-ingredients request');

        // Step 1: Authenticate user
        const { user } = await getAuthenticatedContext(req);

        logger.info('User authenticated for AI normalized ingredients', {
            userId: user.id,
        });

        // Step 2: Parse request body
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

        // Step 3: Validate request body with Zod schema
        const validationResult = AiNormalizedIngredientsRequestSchema.safeParse(body);

        if (!validationResult.success) {
            logger.warn('Request validation failed', {
                userId: user.id,
                errors: validationResult.error.errors,
            });
            return createValidationErrorResponse(validationResult.error);
        }

        const requestData = validationResult.data;

        // Step 4: Verify recipe access (RLS + anti-leak check)
        const token = extractAuthToken(req);
        const supabase = getSupabaseClientWithAuth(token);
        
        const { data: recipeExists, error: recipeError } = await supabase
            .from('recipes')
            .select('id')
            .eq('id', requestData.recipe_id)
            .is('deleted_at', null)
            .single();

        if (recipeError || !recipeExists) {
            logger.warn('Recipe not found or not owned by user', {
                userId: user.id,
                recipeId: requestData.recipe_id,
                error: recipeError?.message,
            });
            return createNotFoundResponse(
                'Recipe not found or you do not have access to it'
            );
        }

        logger.info('Recipe access verified', {
            userId: user.id,
            recipeId: requestData.recipe_id,
        });

        // Step 5: Pre-processing - filter only type='item'
        const ingredientItems = requestData.ingredients.filter(item => item.type === 'item');

        if (ingredientItems.length === 0) {
            logger.warn('No ingredient items to normalize', {
                userId: user.id,
                recipeId: requestData.recipe_id,
                totalItems: requestData.ingredients.length,
            });
            return new Response(
                JSON.stringify({
                    code: 'VALIDATION_ERROR',
                    message: 'No ingredient items to normalize (only headers or empty list)',
                }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        logger.info('Pre-processing completed', {
            userId: user.id,
            recipeId: requestData.recipe_id,
            originalCount: requestData.ingredients.length,
            itemsCount: ingredientItems.length,
        });

        // Step 6: Call service to generate normalized ingredients
        const result = await generateNormalizedIngredients({
            userId: user.id,
            recipeId: requestData.recipe_id,
            ingredientItems,
            allowedUnits: requestData.allowed_units,
            language: requestData.language,
        });

        const duration = Date.now() - startTime;

        // Step 7: Handle service result
        if (!result.success) {
            logger.warn('Normalized ingredients generation failed', {
                userId: user.id,
                recipeId: requestData.recipe_id,
                reasons: result.reasons,
                duration,
            });
            return new Response(
                JSON.stringify({
                    message: 'Failed to normalize ingredients',
                    reasons: result.reasons,
                }),
                {
                    status: 422,
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        logger.info('Normalized ingredients generated successfully', {
            userId: user.id,
            recipeId: requestData.recipe_id,
            normalizedCount: result.data.normalized_ingredients.length,
            confidence: result.data.meta.confidence,
            duration,
        });

        return createSuccessResponse<AiNormalizedIngredientsResponseDto>(result.data);
    } catch (error) {
        const duration = Date.now() - startTime;

        // Handle rate limiting errors
        if (error instanceof ApplicationError && error.code === 'TOO_MANY_REQUESTS') {
            logger.warn('Rate limit exceeded for normalized ingredients', { duration });
            return createTooManyRequestsResponse(error.message, 60);
        }

        logger.error('Error in handlePostAiRecipesNormalizedIngredients', {
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
 * - POST /ai/recipes/normalized-ingredients - Normalize ingredients for shopping lists
 */
export async function aiRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = getPathFromUrl(req.url);

    logger.debug('Routing AI request', { method, path });

    // Route: POST /ai/recipes/normalized-ingredients (check first - most specific path)
    if (path === '/recipes/normalized-ingredients' || path === '/recipes/normalized-ingredients/') {
        if (method === 'POST') {
            return handlePostAiRecipesNormalizedIngredients(req);
        }
        return createMethodNotAllowedResponse(['POST']);
    }

    // Route: POST /ai/recipes/image
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

