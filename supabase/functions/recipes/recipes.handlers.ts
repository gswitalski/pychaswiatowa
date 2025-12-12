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
    PaginatedResponseDto,
    RecipeListItemDto,
    RecipeDetailDto,
    CreateRecipeInput,
    UpdateRecipeInput,
} from './recipes.service.ts';

/** Maximum allowed limit for pagination. */
const MAX_LIMIT = 100;

/** Default limit for pagination. */
const DEFAULT_LIMIT = 20;

/** Default page number. */
const DEFAULT_PAGE = 1;

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
});

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
    })
    .refine(
        (data) => {
            // At least one field must be provided
            return Object.values(data).some((value) => value !== undefined);
        },
        {
            message: 'At least one field must be provided for update',
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
    search: z
        .string()
        .optional()
        .transform((val) => val?.trim() || undefined),
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
                categoryId: params['filter[category_id]'],
                tags: params['filter[tags]'],
                search: params.search,
            }
        );

        logger.info('GET /recipes completed successfully', {
            userId: user.id,
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

        // Call the service to get recipe details
        const result: RecipeDetailDto = await getRecipeById(client, recipeId);

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
 * - GET /recipes/{id} - Get single recipe by ID
 * - POST /recipes - Create a new recipe
 * - POST /recipes/import - Import a recipe from raw text
 * - PUT /recipes/{id} - Update an existing recipe
 *
 * @param req - The incoming HTTP request
 * @returns Response from the appropriate handler, or 405 Method Not Allowed
 */
export async function recipesRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const url = new URL(req.url);

    // Check for /recipes/import path first (before checking for recipe ID)
    const isImport = isImportPath(url);

    // Extract recipe ID from path (if present and not import path)
    const recipeId = isImport ? null : extractRecipeIdFromPath(url);

    // Handle CORS preflight request
    if (method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            },
        });
    }

    // Route GET requests
    if (method === 'GET') {
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

    // Route DELETE requests (only for /recipes/{id} path)
    if (method === 'DELETE') {
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

