/**
 * Recipes Handlers
 * HTTP request handlers for recipe-related endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    getRecipes,
    getRecipeById,
    createRecipe,
    updateRecipe,
    importRecipeFromText,
    deleteRecipe,
    uploadRecipeImage,
    deleteRecipeImage,
    getRecipesFeed,
    setRecipeCollections,
    PaginatedResponseDto,
    RecipeListItemDto,
    RecipeDetailDto,
    CreateRecipeInput,
    UpdateRecipeInput,
    UploadRecipeImageResponseDto,
    SetRecipeCollectionsInput,
    SetRecipeCollectionsResult,
} from './recipes.service.ts';

/** Maximum allowed limit for pagination. */
const MAX_LIMIT = 100;

/** Default limit for pagination. */
const DEFAULT_LIMIT = 20;

/** Default page number. */
const DEFAULT_PAGE = 1;

/** Maximum allowed file size for recipe images (10 MB in bytes). */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types for recipe images. */
const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Schema for validating POST /recipes request body.
 * Validates the CreateRecipeCommand model.
 */
const createRecipeSchema = z.object({
    name: z
        .string({
            required_error: 'Recipe name is required',
            invalid_type_error: 'Recipe name must be a string',
        })
        .min(1, 'Recipe name cannot be empty')
        .max(150, 'Recipe name cannot exceed 150 characters')
        .transform((val) => val.trim()),
    description: z
        .string()
        .nullable()
        .optional()
        .transform((val) => val?.trim() || null),
    category_id: z
        .number({
            invalid_type_error: 'Category ID must be a number',
        })
        .int('Category ID must be an integer')
        .positive('Category ID must be a positive integer')
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    ingredients_raw: z
        .string({
            required_error: 'Ingredients are required',
            invalid_type_error: 'Ingredients must be a string',
        })
        .min(1, 'Ingredients cannot be empty'),
    steps_raw: z
        .string({
            required_error: 'Steps are required',
            invalid_type_error: 'Steps must be a string',
        })
        .min(1, 'Steps cannot be empty'),
    tags: z
        .array(
            z
                .string()
                .min(1, 'Tag name cannot be empty')
                .max(50, 'Tag name cannot exceed 50 characters')
                .transform((val) => val.trim())
        )
        .optional()
        .default([]),
    visibility: z.enum(['PRIVATE', 'SHARED', 'PUBLIC'], {
        required_error: 'Visibility is required',
        invalid_type_error: 'Visibility must be one of: PRIVATE, SHARED, PUBLIC',
    }),
    servings: z
        .number({
            invalid_type_error: 'Servings must be a number',
        })
        .int('Servings must be an integer')
        .min(1, 'Servings must be at least 1')
        .max(99, 'Servings cannot exceed 99')
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    is_termorobot: z
        .boolean({
            invalid_type_error: 'is_termorobot must be a boolean',
        })
        .optional()
        .default(false),
    prep_time_minutes: z
        .number({
            invalid_type_error: 'Preparation time must be a number',
        })
        .int('Preparation time must be an integer')
        .min(0, 'Preparation time must be at least 0')
        .max(999, 'Preparation time cannot exceed 999')
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    total_time_minutes: z
        .number({
            invalid_type_error: 'Total time must be a number',
        })
        .int('Total time must be an integer')
        .min(0, 'Total time must be at least 0')
        .max(999, 'Total time cannot exceed 999')
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    diet_type: z
        .enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
            invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
        })
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    cuisine: z
        .enum([
            'AFRICAN',
            'AMERICAN',
            'ASIAN',
            'BALKAN',
            'BRAZILIAN',
            'BRITISH',
            'CARIBBEAN',
            'CHINESE',
            'FRENCH',
            'GERMAN',
            'GREEK',
            'INDIAN',
            'ITALIAN',
            'JAPANESE',
            'KOREAN',
            'MEDITERRANEAN',
            'MEXICAN',
            'MIDDLE_EASTERN',
            'POLISH',
            'RUSSIAN',
            'SCANDINAVIAN',
            'SPANISH',
            'THAI',
            'TURKISH',
            'VIETNAMESE',
        ], {
            invalid_type_error: 'Cuisine must be one of: AFRICAN, AMERICAN, ASIAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, MEXICAN, MIDDLE_EASTERN, POLISH, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE',
        })
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    difficulty: z
        .enum(['EASY', 'MEDIUM', 'HARD'], {
            invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
        })
        .nullable()
        .optional()
        .transform((val) => val ?? null),
    is_grill: z
        .boolean({
            invalid_type_error: 'is_grill must be a boolean',
        })
        .optional()
        .default(false),
}).refine(
    (data) => {
        // Cross-field validation: total_time_minutes >= prep_time_minutes (when both are set)
        if (data.prep_time_minutes !== null && data.total_time_minutes !== null) {
            return data.total_time_minutes >= data.prep_time_minutes;
        }
        return true;
    },
    {
        message: 'Total time must be greater than or equal to preparation time',
        path: ['total_time_minutes'],
    }
);

/**
 * Schema for validating PUT /recipes/{id} request body.
 * All fields are optional, but at least one field must be provided.
 * Validates the UpdateRecipeCommand model.
 */
const updateRecipeSchema = z
    .object({
        name: z
            .string({
                invalid_type_error: 'Recipe name must be a string',
            })
            .min(1, 'Recipe name cannot be empty')
            .max(150, 'Recipe name cannot exceed 150 characters')
            .transform((val) => val.trim())
            .optional(),
        description: z
            .string()
            .nullable()
            .transform((val) => val?.trim() || null)
            .optional(),
        category_id: z
            .number({
                invalid_type_error: 'Category ID must be a number',
            })
            .int('Category ID must be an integer')
            .positive('Category ID must be a positive integer')
            .nullable()
            .optional(),
        ingredients_raw: z
            .string({
                invalid_type_error: 'Ingredients must be a string',
            })
            .min(1, 'Ingredients cannot be empty')
            .optional(),
        steps_raw: z
            .string({
                invalid_type_error: 'Steps must be a string',
            })
            .min(1, 'Steps cannot be empty')
            .optional(),
        tags: z
            .array(
                z
                    .string()
                    .min(1, 'Tag name cannot be empty')
                    .max(50, 'Tag name cannot exceed 50 characters')
                    .transform((val) => val.trim())
            )
            .optional(),
        visibility: z
            .enum(['PRIVATE', 'SHARED', 'PUBLIC'], {
                invalid_type_error: 'Visibility must be one of: PRIVATE, SHARED, PUBLIC',
            })
            .optional(),
        servings: z
            .number({
                invalid_type_error: 'Servings must be a number',
            })
            .int('Servings must be an integer')
            .min(1, 'Servings must be at least 1')
            .max(99, 'Servings cannot exceed 99')
            .nullable()
            .optional(),
        image_path: z
            .string({
                invalid_type_error: 'Image path must be a string',
            })
            .nullable()
            .optional(),
        is_termorobot: z
            .boolean({
                invalid_type_error: 'is_termorobot must be a boolean',
            })
            .optional(),
        prep_time_minutes: z
            .number({
                invalid_type_error: 'Preparation time must be a number',
            })
            .int('Preparation time must be an integer')
            .min(0, 'Preparation time must be at least 0')
            .max(999, 'Preparation time cannot exceed 999')
            .nullable()
            .optional(),
        total_time_minutes: z
            .number({
                invalid_type_error: 'Total time must be a number',
            })
            .int('Total time must be an integer')
            .min(0, 'Total time must be at least 0')
            .max(999, 'Total time cannot exceed 999')
            .nullable()
            .optional(),
        diet_type: z
            .enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
                invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
            })
            .nullable()
            .optional(),
        cuisine: z
            .enum([
                'AFRICAN',
                'AMERICAN',
                'ASIAN',
                'BALKAN',
                'BRAZILIAN',
                'BRITISH',
                'CARIBBEAN',
                'CHINESE',
                'FRENCH',
                'GERMAN',
                'GREEK',
                'INDIAN',
                'ITALIAN',
                'JAPANESE',
                'KOREAN',
                'MEDITERRANEAN',
                'MEXICAN',
                'MIDDLE_EASTERN',
                'POLISH',
                'RUSSIAN',
                'SCANDINAVIAN',
                'SPANISH',
                'THAI',
                'TURKISH',
                'VIETNAMESE',
            ], {
                invalid_type_error: 'Cuisine must be one of: AFRICAN, AMERICAN, ASIAN, BALKAN, BRAZILIAN, BRITISH, CARIBBEAN, CHINESE, FRENCH, GERMAN, GREEK, INDIAN, ITALIAN, JAPANESE, KOREAN, MEDITERRANEAN, MEXICAN, MIDDLE_EASTERN, POLISH, RUSSIAN, SCANDINAVIAN, SPANISH, THAI, TURKISH, VIETNAMESE',
            })
            .nullable()
            .optional(),
        difficulty: z
            .enum(['EASY', 'MEDIUM', 'HARD'], {
                invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
            })
            .nullable()
            .optional(),
        is_grill: z
            .boolean({
                invalid_type_error: 'is_grill must be a boolean',
            })
            .optional(),
    })
    .refine(
        (data) => {
            // At least one field must be provided
            return Object.values(data).some((value) => value !== undefined);
        },
        {
            message: 'At least one field must be provided for update',
        }
    )
    .refine(
        (data) => {
            // Cross-field validation: total_time_minutes >= prep_time_minutes (when both are set)
            if (data.prep_time_minutes !== null && data.prep_time_minutes !== undefined
                && data.total_time_minutes !== null && data.total_time_minutes !== undefined) {
                return data.total_time_minutes >= data.prep_time_minutes;
            }
            return true;
        },
        {
            message: 'Total time must be greater than or equal to preparation time',
            path: ['total_time_minutes'],
        }
    );

/**
 * Schema for validating POST /recipes/import request body.
 * Validates the ImportRecipeCommand model.
 */
const importRecipeSchema = z.object({
    raw_text: z
        .string({
            required_error: 'Raw text is required',
            invalid_type_error: 'Raw text must be a string',
        })
        .min(1, 'Raw text cannot be empty')
        .transform((val) => val.trim()),
});

/**
 * Maximum number of collections that can be set in a single request.
 * Prevents abuse and DoS attacks.
 */
const MAX_COLLECTIONS_PER_REQUEST = 200;

/**
 * Schema for validating PUT /recipes/{id}/collections request body.
 * Validates the SetRecipeCollectionsCommand model.
 */
const setRecipeCollectionsSchema = z.object({
    collection_ids: z
        .array(
            z
                .number({
                    invalid_type_error: 'Collection IDs must be numbers',
                })
                .int('Collection IDs must be integers')
                .positive('Collection IDs must be positive integers'),
            {
                required_error: 'collection_ids is required',
                invalid_type_error: 'collection_ids must be an array',
            }
        )
        .max(
            MAX_COLLECTIONS_PER_REQUEST,
            `Cannot set more than ${MAX_COLLECTIONS_PER_REQUEST} collections at once`
        )
        .refine(
            (ids) => {
                // Check for duplicates
                const uniqueIds = new Set(ids);
                return uniqueIds.size === ids.length;
            },
            {
                message: 'collection_ids must not contain duplicates',
            }
        ),
});

/**
 * Schema for validating GET /recipes query parameters.
 */
const getRecipesQuerySchema = z.object({
    page: z
        .string()
        .optional()
        .transform((val) => {
            const parsed = parseInt(val ?? '', 10);
            return isNaN(parsed) || parsed < 1 ? DEFAULT_PAGE : parsed;
        }),
    limit: z
        .string()
        .optional()
        .transform((val) => {
            const parsed = parseInt(val ?? '', 10);
            if (isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
            return Math.min(parsed, MAX_LIMIT);
        }),
    sort: z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return { field: 'created_at', direction: 'desc' as const };

            const parts = val.split('.');
            const field = parts[0] || 'created_at';
            const direction = parts[1] === 'asc' ? 'asc' as const : 'desc' as const;

            return { field, direction };
        }),
    view: z
        .enum(['owned', 'my_recipes'], {
            invalid_type_error: 'View must be one of: owned, my_recipes',
        })
        .optional()
        .default('owned'),
    'filter[category_id]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const parsed = parseInt(val, 10);
            return isNaN(parsed) ? undefined : parsed;
        }),
    'filter[tags]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val || val.trim().length === 0) return undefined;
            return val.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
        }),
    'filter[termorobot]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const lowerVal = val.toLowerCase().trim();
            if (lowerVal === 'true' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === '0') return false;
            throw new Error('filter[termorobot] must be true, false, 1, or 0');
        }),
    search: z
        .string()
        .optional()
        .transform((val) => val?.trim() || undefined),
    'filter[diet_type]': z
        .enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
            invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
        })
        .optional(),
    'filter[cuisine]': z
        .enum(['POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN'], {
            invalid_type_error: 'Cuisine must be one of: POLISH, ASIAN, MEXICAN, MIDDLE_EASTERN',
        })
        .optional(),
    'filter[difficulty]': z
        .enum(['EASY', 'MEDIUM', 'HARD'], {
            invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
        })
        .optional(),
    'filter[grill]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const lowerVal = val.toLowerCase().trim();
            if (lowerVal === 'true' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === '0') return false;
            throw new Error('filter[grill] must be true, false, 1, or 0');
        }),
});

/**
 * Schema for validating GET /recipes/feed query parameters.
 * Uses cursor-based pagination and supports all filters from GET /recipes.
 */
const getRecipesFeedQuerySchema = z.object({
    cursor: z.string().optional(),
    limit: z
        .string()
        .optional()
        .default('12')
        .transform((val) => {
            const parsed = parseInt(val, 10);
            if (isNaN(parsed) || parsed < 1) {
                throw new Error('Limit must be a positive integer');
            }
            if (parsed > MAX_LIMIT) {
                throw new Error(`Limit cannot exceed ${MAX_LIMIT}`);
            }
            return parsed;
        }),
    sort: z
        .string()
        .optional()
        .default('created_at.desc')
        .transform((val) => {
            const parts = val.split('.');
            if (parts.length !== 2) {
                throw new Error('Sort must be in format: {field}.{direction}');
            }
            const [field, direction] = parts;

            // For recipes feed, allowed fields: name, created_at, updated_at
            if (!['name', 'created_at', 'updated_at'].includes(field)) {
                throw new Error('Sort field must be one of: name, created_at, updated_at');
            }
            if (!['asc', 'desc'].includes(direction)) {
                throw new Error('Sort direction must be one of: asc, desc');
            }

            return {
                field: field as 'name' | 'created_at' | 'updated_at',
                direction: direction as 'asc' | 'desc',
            };
        }),
    view: z
        .enum(['owned', 'my_recipes'], {
            invalid_type_error: 'View must be one of: owned, my_recipes',
        })
        .optional()
        .default('owned'),
    'filter[category_id]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const parsed = parseInt(val, 10);
            if (isNaN(parsed) || parsed < 1) {
                throw new Error('Category ID must be a positive integer');
            }
            return parsed;
        }),
    'filter[tags]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val || val.trim().length === 0) return undefined;
            const tags = val.split(',').map((tag) => tag.trim()).filter((tag) => tag.length > 0);
            return tags.length > 0 ? tags : undefined;
        }),
    'filter[termorobot]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const lowerVal = val.toLowerCase().trim();
            if (lowerVal === 'true' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === '0') return false;
            throw new Error('filter[termorobot] must be true, false, 1, or 0');
        }),
    search: z
        .string()
        .optional()
        .transform((val) => val?.trim() || undefined),
    'filter[diet_type]': z
        .enum(['MEAT', 'VEGETARIAN', 'VEGAN'], {
            invalid_type_error: 'Diet type must be one of: MEAT, VEGETARIAN, VEGAN',
        })
        .optional(),
    'filter[cuisine]': z
        .enum(['POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN'], {
            invalid_type_error: 'Cuisine must be one of: POLISH, ASIAN, MEXICAN, MIDDLE_EASTERN',
        })
        .optional(),
    'filter[difficulty]': z
        .enum(['EASY', 'MEDIUM', 'HARD'], {
            invalid_type_error: 'Difficulty must be one of: EASY, MEDIUM, HARD',
        })
        .optional(),
    'filter[grill]': z
        .string()
        .optional()
        .transform((val) => {
            if (!val) return undefined;
            const lowerVal = val.toLowerCase().trim();
            if (lowerVal === 'true' || lowerVal === '1') return true;
            if (lowerVal === 'false' || lowerVal === '0') return false;
            throw new Error('filter[grill] must be true, false, 1, or 0');
        }),
});

/**
 * Parses query parameters from URL.
 */
function parseQueryParams(url: URL): Record<string, string> {
    const params: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
        params[key] = value;
    });
    return params;
}

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
 * Handles GET /recipes request.
 * Returns a paginated list of recipes for the authenticated user.
 * Supports 'owned' and 'my_recipes' views.
 *
 * @param req - The incoming HTTP request
 * @returns Response with PaginatedResponseDto<RecipeListItemDto> on success, or error response
 */
export async function handleGetRecipes(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /recipes request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = parseQueryParams(url);

        const validationResult = getRecipesQuerySchema.safeParse(rawParams);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid query parameters', {
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const params = validationResult.data;

        // Call the service to get recipes
        const result: PaginatedResponseDto<RecipeListItemDto> = await getRecipes(
            client,
            {
                page: params.page,
                limit: params.limit,
                sortField: params.sort.field,
                sortDirection: params.sort.direction,
                view: params.view,
                requesterUserId: user.id,
                categoryId: params['filter[category_id]'],
                tags: params['filter[tags]'],
                search: params.search,
                termorobot: params['filter[termorobot]'],
                dietType: params['filter[diet_type]'],
                cuisine: params['filter[cuisine]'],
                difficulty: params['filter[difficulty]'],
                grill: params['filter[grill]'],
            }
        );

        logger.info('GET /recipes completed successfully', {
            userId: user.id,
            view: params.view,
            totalItems: result.pagination.totalItems,
            page: result.pagination.currentPage,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Validates and parses a recipe ID from URL path segment.
 *
 * @param recipeIdParam - The raw ID string from URL path
 * @returns The parsed recipe ID as a positive integer
 * @throws ApplicationError with VALIDATION_ERROR if ID is not a valid positive integer
 */
function parseAndValidateRecipeId(recipeIdParam: string): number {
    const recipeId = parseInt(recipeIdParam, 10);

    if (isNaN(recipeId) || recipeId <= 0 || !Number.isInteger(recipeId)) {
        throw new ApplicationError(
            'VALIDATION_ERROR',
            `Invalid recipe ID: '${recipeIdParam}'. ID must be a positive integer.`
        );
    }

    return recipeId;
}

/**
 * Handles GET /recipes/{id} request.
 * Returns detailed information about a single recipe for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with RecipeDetailDto on success, or error response
 */
/**
 * Handler for GET /recipes/{id}
 * Returns detailed information about a single recipe with proper access control.
 *
 * Access rules:
 * - User can access their own recipes regardless of visibility
 * - User can access PUBLIC recipes from other users
 * - Returns 403 if recipe is not PUBLIC and user is not the owner
 * - Returns 404 if recipe doesn't exist or is soft-deleted
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - Recipe ID from URL path
 * @returns Response with RecipeDetailDto on success, or error response
 */
export async function handleGetRecipeById(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling GET /recipes/{id} request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Call the service to get recipe details with access control
        const result: RecipeDetailDto = await getRecipeById(
            client,
            recipeId,
            user.id
        );

        logger.info('GET /recipes/{id} completed successfully', {
            userId: user.id,
            recipeId: result.id,
            recipeName: result.name,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Creates a successful JSON response with 201 Created status.
 */
function createCreatedResponse<T>(data: T): Response {
    return new Response(JSON.stringify(data), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handles POST /recipes request.
 * Creates a new recipe for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @returns Response with RecipeDetailDto on success (201), or error response
 */
export async function handleCreateRecipe(req: Request): Promise<Response> {
    try {
        logger.info('Handling POST /recipes request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let requestBody: unknown;
        try {
            requestBody = await req.json();
        } catch {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Invalid JSON in request body'
            );
        }

        const validationResult = createRecipeSchema.safeParse(requestBody);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid request body for POST /recipes', {
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const validatedData = validationResult.data;

        // Prepare input for the service
        const createRecipeInput: CreateRecipeInput = {
            name: validatedData.name,
            description: validatedData.description,
            category_id: validatedData.category_id,
            ingredients_raw: validatedData.ingredients_raw,
            steps_raw: validatedData.steps_raw,
            tags: validatedData.tags,
            visibility: validatedData.visibility,
            servings: validatedData.servings,
            is_termorobot: validatedData.is_termorobot,
            prep_time_minutes: validatedData.prep_time_minutes,
            total_time_minutes: validatedData.total_time_minutes,
            diet_type: validatedData.diet_type,
            cuisine: validatedData.cuisine,
            difficulty: validatedData.difficulty,
            is_grill: validatedData.is_grill,
        };

        // Call the service to create the recipe
        const result: RecipeDetailDto = await createRecipe(
            client,
            user.id,
            createRecipeInput
        );

        logger.info('POST /recipes completed successfully', {
            userId: user.id,
            recipeId: result.id,
            recipeName: result.name,
            tagsCount: result.tags.length,
        });

        return createCreatedResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles PUT /recipes/{id} request.
 * Updates an existing recipe for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with RecipeDetailDto on success (200), or error response
 */
export async function handleUpdateRecipe(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling PUT /recipes/{id} request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let requestBody: unknown;
        try {
            requestBody = await req.json();
        } catch {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Invalid JSON in request body'
            );
        }

        const validationResult = updateRecipeSchema.safeParse(requestBody);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid request body for PUT /recipes/{id}', {
                recipeId,
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const validatedData = validationResult.data;

        // Prepare input for the service
        const updateRecipeInput: UpdateRecipeInput = {
            name: validatedData.name,
            description: validatedData.description,
            category_id: validatedData.category_id,
            ingredients_raw: validatedData.ingredients_raw,
            steps_raw: validatedData.steps_raw,
            tags: validatedData.tags,
            visibility: validatedData.visibility,
            image_path: validatedData.image_path,
            servings: validatedData.servings,
            is_termorobot: validatedData.is_termorobot,
            prep_time_minutes: validatedData.prep_time_minutes,
            total_time_minutes: validatedData.total_time_minutes,
            diet_type: validatedData.diet_type,
            cuisine: validatedData.cuisine,
            difficulty: validatedData.difficulty,
            is_grill: validatedData.is_grill,
        };

        // Call the service to update the recipe
        const result: RecipeDetailDto = await updateRecipe(
            client,
            recipeId,
            user.id,
            updateRecipeInput
        );

        logger.info('PUT /recipes/{id} completed successfully', {
            userId: user.id,
            recipeId: result.id,
            recipeName: result.name,
            tagsCount: result.tags.length,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles POST /recipes/import request.
 * Creates a new recipe from a raw text block for the authenticated user.
 * The server parses the text to extract the recipe name, ingredients, and steps.
 *
 * @param req - The incoming HTTP request
 * @returns Response with RecipeDetailDto on success (201), or error response
 */
export async function handleImportRecipe(req: Request): Promise<Response> {
    try {
        logger.info('Handling POST /recipes/import request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let requestBody: unknown;
        try {
            requestBody = await req.json();
        } catch {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Invalid JSON in request body'
            );
        }

        const validationResult = importRecipeSchema.safeParse(requestBody);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid request body for POST /recipes/import', {
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const validatedData = validationResult.data;

        // Call the service to import the recipe
        const result: RecipeDetailDto = await importRecipeFromText(
            client,
            user.id,
            validatedData.raw_text
        );

        logger.info('POST /recipes/import completed successfully', {
            userId: user.id,
            recipeId: result.id,
            recipeName: result.name,
        });

        return createCreatedResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles DELETE /recipes/{id} request.
 * Soft-deletes an existing recipe for the authenticated user.
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with 204 No Content on success, or error response
 */
export async function handleDeleteRecipe(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling DELETE /recipes/{id} request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Call the service to delete the recipe (soft delete)
        await deleteRecipe(client, recipeId, user.id);

        logger.info('DELETE /recipes/{id} completed successfully', {
            userId: user.id,
            recipeId,
        });

        // Return 204 No Content for successful deletion
        return new Response(null, {
            status: 204,
        });
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles PUT /recipes/{id}/collections request.
 * Atomically sets the target list of collections for a recipe.
 * 
 * This is an idempotent operation that:
 * - Accepts an array of collection IDs (can be empty)
 * - Validates all collections exist and belong to the authenticated user
 * - Computes the diff (added/removed) from the current state
 * - Updates the recipe_collections junction table atomically
 * - Returns the final state with diff information
 *
 * Validation:
 * - Recipe ID must be a positive integer
 * - collection_ids must be an array of unique positive integers
 * - Maximum 200 collections per request
 * - Recipe must exist, not be soft-deleted, and be accessible by user
 * - All collection IDs must exist and belong to the authenticated user
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with SetRecipeCollectionsResponseDto on success (200), or error response
 */
export async function handleSetRecipeCollections(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling PUT /recipes/{id}/collections request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let requestBody: unknown;
        try {
            requestBody = await req.json();
        } catch {
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Invalid JSON in request body'
            );
        }

        const validationResult = setRecipeCollectionsSchema.safeParse(requestBody);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid request body for PUT /recipes/{id}/collections', {
                recipeId,
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const { collection_ids } = validationResult.data;

        // Call the service to set recipe collections
        const result: SetRecipeCollectionsResult = await setRecipeCollections(client, {
            recipeId,
            collectionIds: collection_ids,
            requesterUserId: user.id,
        });

        logger.info('PUT /recipes/{id}/collections completed successfully', {
            userId: user.id,
            recipeId,
            collectionCount: result.collection_ids.length,
            addedCount: result.added_ids.length,
            removedCount: result.removed_ids.length,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles POST /recipes/{id}/image request.
 * Uploads or replaces a recipe image for the authenticated user.
 * Accepts multipart/form-data with a 'file' field containing the image.
 *
 * Validation:
 * - Recipe ID must be a positive integer
 * - Content-Type must be multipart/form-data
 * - File field must be present
 * - File MIME type must be image/png, image/jpeg, or image/webp
 * - File size must not exceed 10 MB
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with UploadRecipeImageResponseDto on success (200), or error response
 */
export async function handleUploadRecipeImage(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling POST /recipes/{id}/image request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Check Content-Type header
        const contentType = req.headers.get('Content-Type');
        if (!contentType || !contentType.includes('multipart/form-data')) {
            logger.warn('Invalid Content-Type for image upload', {
                contentType,
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Content-Type must be multipart/form-data'
            );
        }

        // Parse FormData
        let formData: FormData;
        try {
            formData = await req.formData();
        } catch (error) {
            logger.warn('Failed to parse FormData', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Failed to parse multipart/form-data'
            );
        }

        // Extract file from FormData
        const file = formData.get('file');

        if (!file) {
            logger.warn('Missing file in FormData');
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'File field is required'
            );
        }

        if (!(file instanceof File)) {
            logger.warn('File field is not a File object', {
                fileType: typeof file,
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'File field must contain a valid file'
            );
        }

        // Validate file MIME type
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
            logger.warn('Invalid file MIME type', {
                mimeType: file.type,
                allowedTypes: ALLOWED_IMAGE_MIME_TYPES,
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid file type. Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`
            );
        }

        // Validate file size
        if (file.size > MAX_IMAGE_SIZE) {
            logger.warn('File size exceeds limit', {
                fileSize: file.size,
                maxSize: MAX_IMAGE_SIZE,
            });
            throw new ApplicationError(
                'VALIDATION_ERROR',
                `File size exceeds maximum allowed size of ${MAX_IMAGE_SIZE / 1024 / 1024} MB`
            );
        }

        logger.info('File validation passed', {
            fileName: file.name,
            fileSize: file.size,
            mimeType: file.type,
        });

        // Call the service to upload the image
        const result: UploadRecipeImageResponseDto = await uploadRecipeImage(
            client,
            {
                recipeId,
                userId: user.id,
                file,
            }
        );

        logger.info('POST /recipes/{id}/image completed successfully', {
            userId: user.id,
            recipeId: result.id,
            imagePath: result.image_path,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Checks if the URL path matches /recipes/import.
 *
 * @param url - The URL object to check
 * @returns True if the path is /recipes/import, false otherwise
 */
function isImportPath(url: URL): boolean {
    const pathname = url.pathname;
    return /\/recipes\/import\/?$/.test(pathname);
}

/**
 * Extracts the recipe ID from a URL path if it matches /recipes/{id}/image pattern.
 * Returns null if the path doesn't match the pattern.
 *
 * @param url - The URL object to extract path from
 * @returns The recipe ID string if present, null otherwise
 */
function extractRecipeIdFromImagePath(url: URL): string | null {
    // Match pattern: /recipes/{id}/image where id is captured
    // This handles both local (/recipes/123/image) and deployed (/functions/v1/recipes/123/image) paths
    const pathname = url.pathname;
    const imagePathMatch = pathname.match(/\/recipes\/([^/]+)\/image\/?$/);

    if (imagePathMatch && imagePathMatch[1]) {
        return imagePathMatch[1];
    }

    return null;
}

/**
 * Extracts the recipe ID from /recipes/{id}/collections path.
 * Used to route PUT /recipes/{id}/collections requests.
 */
function extractRecipeIdFromCollectionsPath(url: URL): string | null {
    // Match pattern: /recipes/{id}/collections where id is captured
    // This handles both local (/recipes/123/collections) and deployed (/functions/v1/recipes/123/collections) paths
    const pathname = url.pathname;
    const collectionsPathMatch = pathname.match(/\/recipes\/([^/]+)\/collections\/?$/);

    if (collectionsPathMatch && collectionsPathMatch[1]) {
        return collectionsPathMatch[1];
    }

    return null;
}

/**
 * Handles DELETE /recipes/{id}/image request.
 * Removes the image from a recipe by setting image_path to NULL.
 * Also performs best-effort deletion of the image file from Storage.
 *
 * @param req - The incoming HTTP request
 * @param recipeIdParam - The recipe ID extracted from the URL path
 * @returns Response with 204 No Content on success, or error response
 */
export async function handleDeleteRecipeImage(
    req: Request,
    recipeIdParam: string
): Promise<Response> {
    try {
        logger.info('Handling DELETE /recipes/{id}/image request', {
            recipeIdParam,
        });

        // Validate recipe ID parameter
        const recipeId = parseAndValidateRecipeId(recipeIdParam);

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Call the service to delete the recipe image
        await deleteRecipeImage(client, { recipeId, userId: user.id });

        logger.info('DELETE /recipes/{id}/image completed successfully', {
            userId: user.id,
            recipeId,
        });

        // Return 204 No Content for successful deletion
        return new Response(null, {
            status: 204,
        });
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /recipes/feed request.
 * Returns cursor-based paginated list of recipes for the authenticated user.
 * Supports all filters and views from GET /recipes, plus cursor-based pagination.
 *
 * @param req - The incoming HTTP request
 * @returns Response with CursorPaginatedResponseDto<RecipeListItemDto> on success, or error response
 */
export async function handleGetRecipesFeed(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /recipes/feed request');

        // Get authenticated context (client + user)
        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate query parameters
        const url = new URL(req.url);
        const rawParams = parseQueryParams(url);

        const validationResult = getRecipesFeedQuerySchema.safeParse(rawParams);

        if (!validationResult.success) {
            const errorDetails = validationResult.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');

            logger.warn('Invalid query parameters for GET /recipes/feed', {
                errors: errorDetails,
            });

            throw new ApplicationError(
                'VALIDATION_ERROR',
                `Invalid input: ${errorDetails}`
            );
        }

        const params = validationResult.data;

        logger.info('Query parameters validated', {
            userId: user.id,
            view: params.view,
            hasSearch: params.search !== undefined,
            hasCursor: params.cursor !== undefined,
            limit: params.limit,
            sort: `${params.sort.field}.${params.sort.direction}`,
        });

        // Call the service to get recipes feed
        const result = await getRecipesFeed(client, {
            cursor: params.cursor,
            limit: params.limit,
            sortField: params.sort.field,
            sortDirection: params.sort.direction,
            view: params.view,
            requesterUserId: user.id,
            categoryId: params['filter[category_id]'],
            tags: params['filter[tags]'],
            search: params.search,
            termorobot: params['filter[termorobot]'],
            dietType: params['filter[diet_type]'],
            cuisine: params['filter[cuisine]'],
            difficulty: params['filter[difficulty]'],
            grill: params['filter[grill]'],
        });

        logger.info('GET /recipes/feed completed successfully', {
            userId: user.id,
            view: params.view,
            recipesCount: result.data.length,
            hasMore: result.pageInfo.hasMore,
        });

        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Extracts the recipe ID from a URL path if it matches /recipes/{id} pattern.
 * Returns null if the path doesn't match the pattern or is the base /recipes path.
 *
 * @param url - The URL object to extract path from
 * @returns The recipe ID string if present, null otherwise
 */
function extractRecipeIdFromPath(url: URL): string | null {
    // Get the pathname and extract the part after /recipes/
    // Expected format: /functions/v1/recipes or /functions/v1/recipes/{id}
    const pathname = url.pathname;

    // Match pattern: /recipes/{id} where id is captured
    // This handles both local (/recipes/123) and deployed (/functions/v1/recipes/123) paths
    const recipeIdMatch = pathname.match(/\/recipes\/([^/]+)$/);

    if (recipeIdMatch && recipeIdMatch[1]) {
        return recipeIdMatch[1];
    }

    return null;
}

/**
 * Recipes router - routes HTTP methods to appropriate handlers.
 * Supports:
 * - GET /recipes - List all recipes (paginated)
 * - GET /recipes/feed - List recipes with cursor-based pagination
 * - GET /recipes/{id} - Get single recipe by ID
 * - POST /recipes - Create a new recipe
 * - POST /recipes/import - Import a recipe from raw text
 * - POST /recipes/{id}/image - Upload or replace recipe image
 * - PUT /recipes/{id} - Update an existing recipe
 * - PUT /recipes/{id}/collections - Set recipe collections (atomic)
 * - DELETE /recipes/{id} - Soft-delete a recipe
 * - DELETE /recipes/{id}/image - Remove recipe image
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function recipesRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const url = new URL(req.url);

    // Check for /recipes/feed path first (before checking for recipe ID)
    // CRITICAL: Must be checked before extracting recipe ID to avoid treating "feed" as an ID
    const isFeed = url.pathname.match(/\/recipes\/feed\/?$/);

    // Check for /recipes/import path first (before checking for recipe ID)
    const isImport = isImportPath(url);

    // Check for /recipes/{id}/collections path (must be checked before extracting simple recipe ID)
    const collectionsRecipeId = extractRecipeIdFromCollectionsPath(url);

    // Check for /recipes/{id}/image path (must be checked before extracting simple recipe ID)
    const imageRecipeId = extractRecipeIdFromImagePath(url);

    // Extract recipe ID from path (if present and not import/feed path)
    const recipeId = (isImport || isFeed) ? null : extractRecipeIdFromPath(url);

    // Handle CORS preflight request
    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
            },
        });
    }

    // Route GET requests
    if (method === 'GET') {
        // GET /recipes/feed - cursor-based pagination feed
        if (isFeed) {
            return handleGetRecipesFeed(req);
        }

        // GET /recipes/import is not allowed
        if (isImport) {
            logger.warn('GET /recipes/import not allowed');
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'GET method is not allowed for /recipes/import. Use POST.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'POST, OPTIONS',
                    },
                }
            );
        }

        // If recipe ID is present, get single recipe
        if (recipeId) {
            return handleGetRecipeById(req, recipeId);
        }

        // Otherwise, list all recipes
        return handleGetRecipes(req);
    }

    // Route POST requests
    if (method === 'POST') {
        // Handle POST /recipes/{id}/image (most specific path, check first)
        if (imageRecipeId) {
            return handleUploadRecipeImage(req, imageRecipeId);
        }

        // Handle POST /recipes/import
        if (isImport) {
            return handleImportRecipe(req);
        }

        // POST with recipe ID is not allowed (use PUT for updates)
        if (recipeId) {
            logger.warn('POST with recipe ID not allowed', { recipeId });
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'POST with recipe ID is not allowed. Use PUT to update a recipe.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'GET, PUT, DELETE, OPTIONS',
                    },
                }
            );
        }

        // Create new recipe
        return handleCreateRecipe(req);
    }

    // Route PUT requests (only for /recipes/{id} path)
    if (method === 'PUT') {
        // PUT /recipes/{id}/collections - set recipe collections (most specific, check first)
        if (collectionsRecipeId) {
            return handleSetRecipeCollections(req, collectionsRecipeId);
        }

        // PUT /recipes/import is not allowed
        if (isImport) {
            logger.warn('PUT /recipes/import not allowed');
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'PUT method is not allowed for /recipes/import. Use POST.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'POST, OPTIONS',
                    },
                }
            );
        }

        // PUT without recipe ID is not allowed
        if (!recipeId) {
            logger.warn('PUT without recipe ID not allowed');
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'PUT requires a recipe ID. Use POST to create a new recipe.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'GET, POST, OPTIONS',
                    },
                }
            );
        }

        // Update existing recipe
        return handleUpdateRecipe(req, recipeId);
    }

    // Route DELETE requests
    if (method === 'DELETE') {
        // Handle DELETE /recipes/{id}/image (most specific path, check first)
        if (imageRecipeId) {
            return handleDeleteRecipeImage(req, imageRecipeId);
        }

        // DELETE /recipes/import is not allowed
        if (isImport) {
            logger.warn('DELETE /recipes/import not allowed');
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'DELETE method is not allowed for /recipes/import. Use POST.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'POST, OPTIONS',
                    },
                }
            );
        }

        // DELETE without recipe ID is not allowed
        if (!recipeId) {
            logger.warn('DELETE without recipe ID not allowed');
            return new Response(
                JSON.stringify({
                    code: 'METHOD_NOT_ALLOWED',
                    message: 'DELETE requires a recipe ID.',
                }),
                {
                    status: 405,
                    headers: {
                        'Content-Type': 'application/json',
                        'Allow': 'GET, POST, OPTIONS',
                    },
                }
            );
        }

        // Delete existing recipe (soft delete)
        return handleDeleteRecipe(req, recipeId);
    }

    // Method not allowed - determine allowed methods based on path
    logger.warn('Method not allowed', { method, path: url.pathname });
    let allowedMethods = 'GET, POST, OPTIONS';

    if (isImport) {
        allowedMethods = 'POST, OPTIONS';
    } else if (recipeId) {
        allowedMethods = 'GET, PUT, DELETE, OPTIONS';
    }

    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed`,
        }),
        {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Allow': allowedMethods,
            },
        }
    );
}

