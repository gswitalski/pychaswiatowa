/**
 * Collections Handlers
 * HTTP request handlers for collection-related endpoints.
 * Includes routing, validation with Zod schemas, and response formatting.
 */

import { z } from 'npm:zod@3.22.4';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { handleError, ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import {
    getCollections,
    getCollectionById,
    getCollectionRecipes,
    createCollection,
    updateCollection,
    deleteCollection,
    addRecipeToCollection,
    removeRecipeFromCollection,
} from './collections.service.ts';
import {
    CollectionListItemDto,
    CollectionDetailDto,
    GetCollectionRecipesResponseDto,
    CreateCollectionCommand,
    UpdateCollectionCommand,
} from './collections.types.ts';

// #region --- Zod Validation Schemas ---

/** Schema for collection ID path parameter */
const collectionIdSchema = z.coerce.number().int().positive('Collection ID must be a positive integer');

/** Schema for recipe ID path parameter */
const recipeIdSchema = z.coerce.number().int().positive('Recipe ID must be a positive integer');

/** Schema for pagination query parameters */
const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** Schema for collection batch query parameters (GET /collections/{id}) */
const collectionBatchQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(500),
    sort: z.string().regex(/^(created_at|name)\.(asc|desc)$/).default('created_at.desc'),
});

/** Schema for collection recipes query parameters (GET /collections/{id}/recipes) */
const collectionRecipesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(500).default(500),
    sort: z.string().regex(/^(created_at|name)\.(asc|desc)$/).default('name.asc'),
});

/** Schema for creating a new collection */
const createCollectionSchema = z.object({
    name: z
        .string()
        .min(1, 'Collection name is required')
        .max(100, 'Collection name must not exceed 100 characters')
        .trim(),
    description: z
        .string()
        .max(500, 'Description must not exceed 500 characters')
        .trim()
        .nullable()
        .optional(),
});

/** Schema for updating a collection */
const updateCollectionSchema = z.object({
    name: z
        .string()
        .min(1, 'Collection name cannot be empty')
        .max(100, 'Collection name must not exceed 100 characters')
        .trim()
        .optional(),
    description: z
        .string()
        .max(500, 'Description must not exceed 500 characters')
        .trim()
        .nullable()
        .optional(),
});

/** Schema for adding a recipe to a collection */
const addRecipeSchema = z.object({
    recipe_id: z.number().int().positive('Recipe ID must be a positive integer'),
});

// #endregion

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
 * Creates a 204 No Content response.
 */
function createNoContentResponse(): Response {
    return new Response(null, { status: 204 });
}

/**
 * Creates a validation error response.
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

// #endregion

// #region --- URL Parsing Helpers ---

/**
 * Extracts the path after /functions/v1/collections from the URL.
 */
function getPathFromUrl(url: string): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Match patterns like /functions/v1/collections or /collections
    const match = pathname.match(/(?:\/functions\/v1)?\/collections(.*)/);
    return match ? match[1] : '';
}

/**
 * Parses query parameters from URL.
 */
function getQueryParams(url: string): URLSearchParams {
    const urlObj = new URL(url);
    return urlObj.searchParams;
}

// #endregion

// #region --- Handlers ---

/**
 * Handles GET /collections request.
 * Returns all collections belonging to the authenticated user.
 */
async function handleGetCollections(req: Request): Promise<Response> {
    try {
        logger.info('Handling GET /collections request');

        const { client, user } = await getAuthenticatedContext(req);
        const collections: CollectionListItemDto[] = await getCollections(client, user.id);

        logger.info('GET /collections completed successfully', {
            userId: user.id,
            collectionsCount: collections.length,
        });

        return createSuccessResponse(collections);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles POST /collections request.
 * Creates a new collection for the authenticated user.
 */
async function handleCreateCollection(req: Request): Promise<Response> {
    try {
        logger.info('Handling POST /collections request');

        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const validationResult = createCollectionSchema.safeParse(body);
        if (!validationResult.success) {
            return createValidationErrorResponse(validationResult.error);
        }

        const command: CreateCollectionCommand = validationResult.data;
        const collection = await createCollection(client, user.id, command);

        logger.info('POST /collections completed successfully', {
            userId: user.id,
            collectionId: collection.id,
        });

        return createSuccessResponse(collection, 201);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /collections/{id} request.
 * Returns details of a single collection with batch of recipes (no UI pagination).
 */
async function handleGetCollectionById(req: Request, collectionId: number): Promise<Response> {
    try {
        logger.info('Handling GET /collections/:id request', { collectionId });

        const { client, user } = await getAuthenticatedContext(req);

        // Parse batch query parameters
        const queryParams = getQueryParams(req.url);
        const queryResult = collectionBatchQuerySchema.safeParse({
            limit: queryParams.get('limit') ?? 500,
            sort: queryParams.get('sort') ?? 'created_at.desc',
        });

        if (!queryResult.success) {
            return createValidationErrorResponse(queryResult.error);
        }

        const { limit, sort } = queryResult.data;
        
        // Parse sort into field and direction
        const [sortField, sortDirection] = sort.split('.') as [string, 'asc' | 'desc'];

        const collection: CollectionDetailDto = await getCollectionById(
            client,
            user.id,
            collectionId,
            limit,
            sortField,
            sortDirection
        );

        logger.info('GET /collections/:id completed successfully', {
            userId: user.id,
            collectionId,
            limit,
            sort,
            truncated: collection.recipes.pageInfo.truncated,
        });

        return createSuccessResponse(collection);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles PUT /collections/{id} request.
 * Updates an existing collection.
 */
async function handleUpdateCollection(req: Request, collectionId: number): Promise<Response> {
    try {
        logger.info('Handling PUT /collections/:id request', { collectionId });

        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const validationResult = updateCollectionSchema.safeParse(body);
        if (!validationResult.success) {
            return createValidationErrorResponse(validationResult.error);
        }

        const command: UpdateCollectionCommand = validationResult.data;
        const collection = await updateCollection(client, user.id, collectionId, command);

        logger.info('PUT /collections/:id completed successfully', {
            userId: user.id,
            collectionId,
        });

        return createSuccessResponse(collection);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles DELETE /collections/{id} request.
 * Deletes a collection (but not the recipes in it).
 */
async function handleDeleteCollection(req: Request, collectionId: number): Promise<Response> {
    try {
        logger.info('Handling DELETE /collections/:id request', { collectionId });

        const { client, user } = await getAuthenticatedContext(req);
        await deleteCollection(client, user.id, collectionId);

        logger.info('DELETE /collections/:id completed successfully', {
            userId: user.id,
            collectionId,
        });

        return createNoContentResponse();
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles POST /collections/{id}/recipes request.
 * Adds a recipe to a collection.
 */
async function handleAddRecipeToCollection(req: Request, collectionId: number): Promise<Response> {
    try {
        logger.info('Handling POST /collections/:id/recipes request', { collectionId });

        const { client, user } = await getAuthenticatedContext(req);

        // Parse and validate request body
        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const validationResult = addRecipeSchema.safeParse(body);
        if (!validationResult.success) {
            return createValidationErrorResponse(validationResult.error);
        }

        const { recipe_id } = validationResult.data;
        await addRecipeToCollection(client, user.id, collectionId, recipe_id);

        logger.info('POST /collections/:id/recipes completed successfully', {
            userId: user.id,
            collectionId,
            recipeId: recipe_id,
        });

        return createSuccessResponse({ message: 'Recipe added to collection successfully.' }, 201);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles GET /collections/{id}/recipes request.
 * Returns a minimal list of recipes for sidebar tree.
 */
async function handleGetCollectionRecipes(req: Request, collectionId: number): Promise<Response> {
    try {
        logger.info('Handling GET /collections/:id/recipes request', { collectionId });

        const { client, user } = await getAuthenticatedContext(req);

        const queryParams = getQueryParams(req.url);
        const queryResult = collectionRecipesQuerySchema.safeParse({
            limit: queryParams.get('limit') ?? 500,
            sort: queryParams.get('sort') ?? 'name.asc',
        });

        if (!queryResult.success) {
            return createValidationErrorResponse(queryResult.error);
        }

        const { limit, sort } = queryResult.data;
        const [sortField, sortDirection] = sort.split('.') as [string, 'asc' | 'desc'];

        const response: GetCollectionRecipesResponseDto = await getCollectionRecipes(
            client,
            user.id,
            collectionId,
            limit,
            sortField,
            sortDirection
        );

        logger.info('GET /collections/:id/recipes completed successfully', {
            userId: user.id,
            collectionId,
            limit,
            sort,
            returned: response.pageInfo.returned,
            truncated: response.pageInfo.truncated,
        });

        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}

/**
 * Handles DELETE /collections/{collectionId}/recipes/{recipeId} request.
 * Removes a recipe from a collection.
 */
async function handleRemoveRecipeFromCollection(
    req: Request,
    collectionId: number,
    recipeId: number
): Promise<Response> {
    try {
        logger.info('Handling DELETE /collections/:collectionId/recipes/:recipeId request', {
            collectionId,
            recipeId,
        });

        const { client, user } = await getAuthenticatedContext(req);
        await removeRecipeFromCollection(client, user.id, collectionId, recipeId);

        logger.info('DELETE /collections/:collectionId/recipes/:recipeId completed successfully', {
            userId: user.id,
            collectionId,
            recipeId,
        });

        return createNoContentResponse();
    } catch (error) {
        return handleError(error);
    }
}

// #endregion

// #region --- Router ---

/**
 * Collections router - routes HTTP requests to appropriate handlers.
 * Handles all collection-related endpoints with URL pattern matching.
 *
 * Supported routes:
 * - GET    /collections                           - List all collections
 * - POST   /collections                           - Create a collection
 * - GET    /collections/{id}                      - Get collection details
 * - PUT    /collections/{id}                      - Update a collection
 * - DELETE /collections/{id}                      - Delete a collection
 * - POST   /collections/{id}/recipes              - Add recipe to collection
 * - DELETE /collections/{collectionId}/recipes/{recipeId} - Remove recipe from collection
 */
export async function collectionsRouter(req: Request): Promise<Response> {
    const method = req.method.toUpperCase();
    const path = getPathFromUrl(req.url);

    logger.debug('Routing request', { method, path });

    // Route: DELETE /collections/{collectionId}/recipes/{recipeId}
    const removeRecipeMatch = path.match(/^\/(\d+)\/recipes\/(\d+)$/);
    if (removeRecipeMatch) {
        const collectionIdResult = collectionIdSchema.safeParse(removeRecipeMatch[1]);
        const recipeIdResult = recipeIdSchema.safeParse(removeRecipeMatch[2]);

        if (!collectionIdResult.success) {
            return createValidationErrorResponse(collectionIdResult.error);
        }
        if (!recipeIdResult.success) {
            return createValidationErrorResponse(recipeIdResult.error);
        }

        if (method === 'DELETE') {
            return handleRemoveRecipeFromCollection(
                req,
                collectionIdResult.data,
                recipeIdResult.data
            );
        }

        return createMethodNotAllowedResponse(['DELETE']);
    }

    // Route: POST /collections/{id}/recipes
    const addRecipeMatch = path.match(/^\/(\d+)\/recipes$/);
    if (addRecipeMatch) {
        const collectionIdResult = collectionIdSchema.safeParse(addRecipeMatch[1]);

        if (!collectionIdResult.success) {
            return createValidationErrorResponse(collectionIdResult.error);
        }

        if (method === 'GET') {
            return handleGetCollectionRecipes(req, collectionIdResult.data);
        }

        if (method === 'POST') {
            return handleAddRecipeToCollection(req, collectionIdResult.data);
        }

        return createMethodNotAllowedResponse(['GET', 'POST']);
    }

    // Route: /collections/{id} - GET, PUT, DELETE
    const collectionIdMatch = path.match(/^\/(\d+)$/);
    if (collectionIdMatch) {
        const collectionIdResult = collectionIdSchema.safeParse(collectionIdMatch[1]);

        if (!collectionIdResult.success) {
            return createValidationErrorResponse(collectionIdResult.error);
        }

        const collectionId = collectionIdResult.data;

        switch (method) {
            case 'GET':
                return handleGetCollectionById(req, collectionId);
            case 'PUT':
                return handleUpdateCollection(req, collectionId);
            case 'DELETE':
                return handleDeleteCollection(req, collectionId);
            default:
                return createMethodNotAllowedResponse(['GET', 'PUT', 'DELETE']);
        }
    }

    // Route: /collections - GET, POST (root path or empty)
    if (path === '' || path === '/') {
        switch (method) {
            case 'GET':
                return handleGetCollections(req);
            case 'POST':
                return handleCreateCollection(req);
            default:
                return createMethodNotAllowedResponse(['GET', 'POST']);
        }
    }

    // No matching route found
    logger.warn('Route not found', { method, path });
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
                'Allow': allowedMethods.join(', '),
            },
        }
    );
}

// #endregion
