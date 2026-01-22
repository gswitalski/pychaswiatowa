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

/** Required output format for recipe draft */
export const REQUIRED_OUTPUT_FORMAT = 'pycha_recipe_draft_v1' as const;

/** Required output format for recipe image generation */
export const REQUIRED_IMAGE_OUTPUT_FORMAT = 'pycha_recipe_image_v1' as const;

/** Maximum description length for recipe image generation */
export const MAX_RECIPE_DESCRIPTION_LENGTH = 500;

/** Maximum category name length */
export const MAX_CATEGORY_NAME_LENGTH = 50;

/** Maximum tag name length */
export const MAX_TAG_NAME_LENGTH = 50;

/** Maximum number of ingredients/steps (protection against cost abuse) */
export const MAX_RECIPE_CONTENT_ITEMS = 200;

/** Maximum total payload size for recipe image request (characters) */
export const MAX_IMAGE_REQUEST_PAYLOAD_SIZE = 40_000;

/** Allowed output MIME types for recipe image (MVP: only webp via gpt-image-1) */
export const ALLOWED_IMAGE_OUTPUT_MIME_TYPES = ['image/webp'] as const;
export type AllowedImageOutputMimeType = typeof ALLOWED_IMAGE_OUTPUT_MIME_TYPES[number];

/** Fixed output dimensions for recipe image (MVP) */
export const IMAGE_OUTPUT_WIDTH = 1024;
export const IMAGE_OUTPUT_HEIGHT = 1024;

/** Maximum reference image size after base64 decoding (bytes) - 2 MB */
export const MAX_REFERENCE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

/** Required output format for normalized ingredients */
export const REQUIRED_NORMALIZED_INGREDIENTS_OUTPUT_FORMAT = 'pycha_normalized_ingredients_v1' as const;

/** Maximum number of ingredient items for normalization (protection against abuse) */
export const MAX_NORMALIZED_INGREDIENTS_ITEMS = 500;

/** Maximum length of single ingredient content line (characters) */
export const MAX_INGREDIENT_CONTENT_LENGTH = 500;

/** Maximum number of allowed units */
export const MAX_ALLOWED_UNITS_COUNT = 20;

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
    description: z.string().nullish().default(null),
    ingredients_raw: z.string().min(1, 'Ingredients are required'),
    steps_raw: z.string().min(1, 'Steps are required'),
    tips_raw: z.string().optional(),
    category_name: z.string().nullish().default(null),
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

// #region --- Recipe Image Generation Types ---

/**
 * AI recipe image generation mode enum.
 */
export const AI_RECIPE_IMAGE_MODES = ['auto', 'recipe_only', 'with_reference'] as const;
export type AiRecipeImageMode = typeof AI_RECIPE_IMAGE_MODES[number];

/**
 * Schema for recipe content item (ingredient or step).
 */
const RecipeContentItemSchema = z.object({
    type: z.enum(['header', 'item']),
    content: z.string().min(1, 'Content cannot be empty after trim').transform(s => s.trim()),
});

/**
 * Schema for recipe data in image generation request.
 */
const AiRecipeImageRecipeSchema = z.object({
    id: z.number().int().positive('Recipe ID must be a positive integer'),
    name: z.string()
        .min(1, 'Recipe name is required')
        .max(MAX_RECIPE_NAME_LENGTH, `Recipe name cannot exceed ${MAX_RECIPE_NAME_LENGTH} characters`)
        .transform(s => s.trim()),
    description: z.string()
        .max(MAX_RECIPE_DESCRIPTION_LENGTH, `Description cannot exceed ${MAX_RECIPE_DESCRIPTION_LENGTH} characters`)
        .nullable()
        .optional()
        .transform(s => s?.trim() || null),
    servings: z.number()
        .int()
        .min(1, 'Servings must be at least 1')
        .max(99, 'Servings cannot exceed 99')
        .nullable()
        .optional(),
    prep_time_minutes: z.number()
        .int()
        .min(0, 'Prep time must be at least 0')
        .max(999, 'Prep time cannot exceed 999')
        .nullable()
        .optional(),
    total_time_minutes: z.number()
        .int()
        .min(0, 'Total time must be at least 0')
        .max(999, 'Total time cannot exceed 999')
        .nullable()
        .optional(),
    is_termorobot: z.boolean().optional().default(false),
    is_grill: z.boolean().optional().default(false),
    category_name: z.string()
        .min(1)
        .max(MAX_CATEGORY_NAME_LENGTH, `Category name cannot exceed ${MAX_CATEGORY_NAME_LENGTH} characters`)
        .nullable()
        .optional()
        .transform(s => s?.trim() || null),
    ingredients: z.array(RecipeContentItemSchema)
        .min(1, 'Recipe must have at least one ingredient')
        .max(MAX_RECIPE_CONTENT_ITEMS, `Ingredients list cannot exceed ${MAX_RECIPE_CONTENT_ITEMS} items`),
    steps: z.array(RecipeContentItemSchema)
        .min(1, 'Recipe must have at least one step')
        .max(MAX_RECIPE_CONTENT_ITEMS, `Steps list cannot exceed ${MAX_RECIPE_CONTENT_ITEMS} items`),
    tags: z.array(z.string().transform(s => s.trim()))
        .max(MAX_TAGS_COUNT, `Tags list cannot exceed ${MAX_TAGS_COUNT} items`)
        .optional()
        .default([]),
});

/**
 * Schema for output configuration in image generation request.
 */
const AiRecipeImageOutputSchema = z.object({
    mime_type: z.enum(ALLOWED_IMAGE_OUTPUT_MIME_TYPES, {
        errorMap: () => ({ message: `Supported formats: ${ALLOWED_IMAGE_OUTPUT_MIME_TYPES.join(', ')}` }),
    }),
    width: z.literal(IMAGE_OUTPUT_WIDTH, {
        errorMap: () => ({ message: `Width must be ${IMAGE_OUTPUT_WIDTH} in MVP` }),
    }),
    height: z.literal(IMAGE_OUTPUT_HEIGHT, {
        errorMap: () => ({ message: `Height must be ${IMAGE_OUTPUT_HEIGHT} in MVP` }),
    }),
});

/**
 * Schema for reference image - discriminated union by source.
 */
const AiRecipeImageReferenceImageSchema = z.discriminatedUnion('source', [
    z.object({
        source: z.literal('storage_path'),
        image_path: z.string().min(1, 'Image path cannot be empty'),
    }),
    z.object({
        source: z.literal('base64'),
        mime_type: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
            errorMap: () => ({
                message: `Unsupported image format. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`
            }),
        }),
        data_base64: z.string().min(1, 'Image data cannot be empty'),
    }),
]);

/**
 * Main request schema for POST /ai/recipes/image endpoint.
 * Uses superRefine for cross-field validation of mode and reference_image.
 */
export const AiRecipeImageRequestSchema = z.object({
    recipe: AiRecipeImageRecipeSchema,
    output: AiRecipeImageOutputSchema,
    language: z.string().optional().default('pl'),
    output_format: z.literal(REQUIRED_IMAGE_OUTPUT_FORMAT, {
        errorMap: () => ({ message: `output_format must be "${REQUIRED_IMAGE_OUTPUT_FORMAT}"` }),
    }),
    mode: z.enum(AI_RECIPE_IMAGE_MODES, {
        errorMap: () => ({ message: `Mode must be one of: ${AI_RECIPE_IMAGE_MODES.join(', ')}` }),
    }).optional().default('auto'),
    reference_image: AiRecipeImageReferenceImageSchema.optional(),
}).superRefine((data, ctx) => {
    // Validation: mode='with_reference' requires reference_image
    if (data.mode === 'with_reference' && !data.reference_image) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'reference_image is required when mode is "with_reference"',
            path: ['reference_image'],
        });
    }
});

/** Type for recipe image generation request body */
export type AiRecipeImageRequest = z.infer<typeof AiRecipeImageRequestSchema>;

/** Type for recipe data in image generation request */
export type AiRecipeImageRecipeData = z.infer<typeof AiRecipeImageRecipeSchema>;

/**
 * Style contract metadata for generated image.
 * Confirms adherence to agreed visual style guidelines.
 */
export interface AiRecipeImageStyleContract {
    photorealistic: boolean;
    rustic_table: boolean;
    natural_light: boolean;
    no_people: boolean;
    no_text: boolean;
    no_watermark: boolean;
}

/**
 * Meta information for image generation response.
 * Includes resolved mode (never 'auto').
 */
export interface AiRecipeImageMeta {
    mode: Exclude<AiRecipeImageMode, 'auto'>;
    style_contract: AiRecipeImageStyleContract;
    warnings: string[];
}

/**
 * Response DTO for successful image generation.
 */
export interface AiRecipeImageResponseDto {
    image: {
        mime_type: AllowedImageOutputMimeType;
        data_base64: string;
    };
    meta: AiRecipeImageMeta;
}

/**
 * Response DTO for 422 Unprocessable Entity (insufficient info for image).
 */
export interface AiRecipeImageUnprocessableEntityDto {
    message: string;
    reasons: string[];
}

/**
 * Processed reference image data (post-validation).
 */
export interface ReferenceImageData {
    bytes: Uint8Array;
    mimeType: string;
    source: 'storage_path' | 'base64';
}

/**
 * Parameters for the generateRecipeImage service function.
 */
export interface GenerateRecipeImageParams {
    userId: string;
    recipe: AiRecipeImageRecipeData;
    language: string;
    resolvedMode: Exclude<AiRecipeImageMode, 'auto'>;
    referenceImage?: ReferenceImageData;
}

/**
 * Result from image generation - either success or validation failure.
 */
export type ImageGenerationResult =
    | { success: true; data: AiRecipeImageResponseDto }
    | { success: false; reasons: string[] };

// #endregion

// #region --- Normalized Ingredients Types ---

/**
 * Supported unit types for normalized ingredients (MVP controlled list).
 */
export const NORMALIZED_INGREDIENT_UNITS = [
    'g',
    'ml',
    'szt.',
    'ząbek',
    'łyżeczka',
    'łyżka',
    'szczypta',
    'pęczek',
] as const;

export type NormalizedIngredientUnit = typeof NORMALIZED_INGREDIENT_UNITS[number];

/**
 * Schema for normalized ingredient item in response.
 */
const NormalizedIngredientSchema = z.object({
    amount: z.number().nullable(),
    unit: z.enum(NORMALIZED_INGREDIENT_UNITS).nullable(),
    name: z.string().min(1, 'Ingredient name cannot be empty'),
});

/**
 * Schema for request body (POST /ai/recipes/normalized-ingredients).
 */
export const AiNormalizedIngredientsRequestSchema = z.object({
    recipe_id: z.number()
        .int('Recipe ID must be an integer')
        .positive('Recipe ID must be positive'),
    language: z.string().optional().default('pl'),
    output_format: z.literal(REQUIRED_NORMALIZED_INGREDIENTS_OUTPUT_FORMAT, {
        errorMap: () => ({
            message: `output_format must be "${REQUIRED_NORMALIZED_INGREDIENTS_OUTPUT_FORMAT}"`
        }),
    }),
    ingredients: z.array(RecipeContentItemSchema)
        .min(1, 'Ingredients list cannot be empty')
        .max(MAX_NORMALIZED_INGREDIENTS_ITEMS, `Ingredients list cannot exceed ${MAX_NORMALIZED_INGREDIENTS_ITEMS} items`),
    allowed_units: z.array(z.enum(NORMALIZED_INGREDIENT_UNITS))
        .min(1, 'Allowed units list cannot be empty')
        .max(MAX_ALLOWED_UNITS_COUNT, `Allowed units list cannot exceed ${MAX_ALLOWED_UNITS_COUNT} items`),
}).superRefine((data, ctx) => {
    // Validate ingredient content length
    for (let i = 0; i < data.ingredients.length; i++) {
        const item = data.ingredients[i];
        if (item.content.length > MAX_INGREDIENT_CONTENT_LENGTH) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `Ingredient content at index ${i} exceeds maximum length of ${MAX_INGREDIENT_CONTENT_LENGTH} characters`,
                path: ['ingredients', i, 'content'],
            });
        }
    }
});

/**
 * Schema for validating LLM output (normalized ingredients).
 */
export const AiNormalizedIngredientsLlmResponseSchema = z.object({
    normalized_ingredients: z.array(NormalizedIngredientSchema)
        .min(1, 'Normalized ingredients list cannot be empty'),
    meta: z.object({
        confidence: z.number().min(0).max(1),
        warnings: z.array(z.string()).default([]),
    }),
});

/** Type for request body */
export type AiNormalizedIngredientsRequest = z.infer<typeof AiNormalizedIngredientsRequestSchema>;

/** Type for normalized ingredient item */
export type NormalizedIngredientDto = z.infer<typeof NormalizedIngredientSchema>;

/** Type for complete API response */
export interface AiNormalizedIngredientsResponseDto {
    normalized_ingredients: NormalizedIngredientDto[];
    meta: {
        confidence: number;
        warnings: string[];
    };
}

/**
 * Parameters for the generateNormalizedIngredients service function.
 */
export interface GenerateNormalizedIngredientsParams {
    userId: string;
    recipeId: number;
    ingredientItems: Array<{ type: string; content: string }>;
    allowedUnits: NormalizedIngredientUnit[];
    language: string;
}

/**
 * Result from normalized ingredients generation - either success or validation failure.
 */
export type NormalizedIngredientsGenerationResult =
    | { success: true; data: AiNormalizedIngredientsResponseDto }
    | { success: false; reasons: string[] };

// #endregion
