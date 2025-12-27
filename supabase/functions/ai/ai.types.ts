/**
 * AI Types
 * Data Transfer Objects (DTOs) and validation schemas for AI-powered recipe draft endpoint.
 * 
 * Supported operations:
 * - POST /ai/recipes/draft - Generate recipe draft from text or image
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// #region --- Constants ---

/** Maximum text length for recipe input (characters) */
export const MAX_TEXT_LENGTH = 50_000;

/** Maximum image size after base64 decoding (bytes) - 10 MB */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum number of tags in response */
export const MAX_TAGS_COUNT = 20;

/** Maximum recipe name length (consistent with DB constraint) */
export const MAX_RECIPE_NAME_LENGTH = 150;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** Required output format */
export const REQUIRED_OUTPUT_FORMAT = 'pycha_recipe_draft_v1' as const;

// #endregion

// #region --- Validation Schemas ---

/**
 * Schema for image data in request.
 */
const AiRecipeDraftImageSchema = z.object({
    mime_type: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
        errorMap: () => ({ 
            message: `Unsupported image format. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}` 
        }),
    }),
    data_base64: z.string().min(1, 'Image data cannot be empty'),
});

/**
 * Base schema with common fields for both text and image variants.
 */
const BaseRequestSchema = z.object({
    output_format: z.literal(REQUIRED_OUTPUT_FORMAT, {
        errorMap: () => ({ 
            message: `output_format must be "${REQUIRED_OUTPUT_FORMAT}"` 
        }),
    }),
    language: z.string().default('pl'),
});

/**
 * Schema for text source variant.
 */
const TextSourceSchema = BaseRequestSchema.extend({
    source: z.literal('text'),
    text: z.string()
        .min(1, 'Text cannot be empty')
        .max(MAX_TEXT_LENGTH, `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters`),
    image: z.undefined().optional(),
});

/**
 * Schema for image source variant.
 */
const ImageSourceSchema = BaseRequestSchema.extend({
    source: z.literal('image'),
    image: AiRecipeDraftImageSchema,
    text: z.undefined().optional(),
});

/**
 * Main request schema - discriminated union of text and image sources.
 */
export const AiRecipeDraftRequestSchema = z.discriminatedUnion('source', [
    TextSourceSchema,
    ImageSourceSchema,
]);

/**
 * Schema for validating LLM output (draft).
 */
export const AiRecipeDraftOutputSchema = z.object({
    name: z.string().min(1, 'Recipe name is required'),
    description: z.string().nullable(),
    ingredients_raw: z.string().min(1, 'Ingredients are required'),
    steps_raw: z.string().min(1, 'Steps are required'),
    category_name: z.string().nullable(),
    tags: z.array(z.string()).default([]),
});

/**
 * Schema for meta information in response.
 */
export const AiRecipeDraftMetaSchema = z.object({
    confidence: z.number().min(0).max(1),
    warnings: z.array(z.string()).default([]),
});

/**
 * Schema for complete LLM response validation.
 */
export const AiRecipeDraftLlmResponseSchema = z.object({
    draft: AiRecipeDraftOutputSchema,
    meta: AiRecipeDraftMetaSchema,
});

/**
 * Schema for error response when content is not a valid single recipe.
 */
export const AiRecipeDraftErrorResponseSchema = z.object({
    is_valid_recipe: z.literal(false),
    reasons: z.array(z.string()),
});

// #endregion

// #region --- Inferred Types ---

/** Type for request body (text or image variant) */
export type AiRecipeDraftRequest = z.infer<typeof AiRecipeDraftRequestSchema>;

/** Type for text source request */
export type AiTextSourceRequest = z.infer<typeof TextSourceSchema>;

/** Type for image source request */
export type AiImageSourceRequest = z.infer<typeof ImageSourceSchema>;

/** Type for recipe draft (LLM output) */
export type AiRecipeDraftDto = z.infer<typeof AiRecipeDraftOutputSchema>;

/** Type for response meta information */
export type AiRecipeDraftMeta = z.infer<typeof AiRecipeDraftMetaSchema>;

/** Type for complete API response */
export interface AiRecipeDraftResponseDto {
    draft: AiRecipeDraftDto;
    meta: AiRecipeDraftMeta;
}

/** Type for 422 Unprocessable Entity response */
export interface AiRecipeDraftUnprocessableEntityDto {
    message: string;
    reasons: string[];
}

/** Type for LLM error response (invalid recipe) */
export type AiRecipeDraftLlmErrorResponse = z.infer<typeof AiRecipeDraftErrorResponseSchema>;

// #endregion

// #region --- Service Types ---

/**
 * Parameters for the generateRecipeDraft service function.
 */
export interface GenerateRecipeDraftParams {
    userId: string;
    source: 'text' | 'image';
    text?: string;
    imageBytes?: Uint8Array;
    imageMimeType?: string;
    language: string;
}

/**
 * Result from LLM generation - either success or validation failure.
 */
export type LlmGenerationResult = 
    | { success: true; data: AiRecipeDraftResponseDto }
    | { success: false; reasons: string[] };

// #endregion

