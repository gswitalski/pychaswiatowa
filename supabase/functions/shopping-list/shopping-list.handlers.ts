/**
 * Handlers for Shopping List endpoints
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { getAuthenticatedContext } from '../_shared/supabase-client.ts';
import { createManualShoppingListItem, getShoppingList } from './shopping-list.service.ts';

/**
 * Zod schema for AddManualShoppingListItemCommand.
 * Matches shared/contracts/types.ts
 */
const AddManualShoppingListItemSchema = z.object({
    text: z
        .string()
        .min(1, 'Text cannot be empty')
        .max(200, 'Text cannot exceed 200 characters')
        .transform((val) => val.trim()), // Normalize: trim whitespace
});

/**
 * Main router for /shopping-list endpoints
 */
export async function shoppingListRouter(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const { method } = req;

    // Extract path after /shopping-list
    const pathMatch = url.pathname.match(/^\/shopping-list(.*)$/);
    const path = pathMatch ? pathMatch[1] : url.pathname;

    // Route: GET /shopping-list (root endpoint)
    if ((path === '' || path === '/') && method === 'GET') {
        return await handleGetShoppingList(req);
    }

    // Route: POST /items
    if (path === '/items' && method === 'POST') {
        return await handlePostShoppingListItems(req);
    }

    // No matching route
    throw new ApplicationError('NOT_FOUND', 'Endpoint not found');
}

/**
 * Handler for POST /shopping-list/items
 * Adds a new manual item to the shopping list
 * 
 * Request:
 * - Body: { text: string }
 * - Headers: Authorization: Bearer <JWT>
 * 
 * Response:
 * - 201 Created with ShoppingListItemManualDto
 * 
 * Errors:
 * - 400 Bad Request: Invalid JSON or validation error
 * - 401 Unauthorized: Missing or invalid JWT
 * - 500 Internal Server Error: Database error
 */
export async function handlePostShoppingListItems(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    logger.info('[handlePostShoppingListItems] Adding manual item to shopping list', {
        userId: user.id,
    });

    // 2. Parse and validate request body
    let body: unknown;
    try {
        body = await req.json();
    } catch (_error) {
        logger.warn('[handlePostShoppingListItems] Invalid JSON', {
            userId: user.id,
        });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Invalid JSON in request body'
        );
    }

    const validationResult = AddManualShoppingListItemSchema.safeParse(body);
    if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        logger.warn('[handlePostShoppingListItems] Validation error', {
            userId: user.id,
            field: firstError.path.join('.'),
            message: firstError.message,
        });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            `text: ${firstError.message}`
        );
    }

    const { text } = validationResult.data;

    // 3. Additional validation: ensure text is not empty after trim
    if (text.length === 0) {
        logger.warn('[handlePostShoppingListItems] Empty text after trim', {
            userId: user.id,
        });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'text: Text cannot be empty or contain only whitespace'
        );
    }

    // 4. Call service to create item
    const createdItem = await createManualShoppingListItem(client, user.id, text);

    logger.info('[handlePostShoppingListItems] Item created successfully', {
        userId: user.id,
        itemId: createdItem.id,
    });

    // 5. Return 201 Created with created item
    return new Response(JSON.stringify(createdItem), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
    });
}

/**
 * Handler for GET /shopping-list
 * Retrieves the complete shopping list for the authenticated user
 * 
 * Request:
 * - Headers: Authorization: Bearer <JWT>
 * - No query parameters (MVP)
 * 
 * Response:
 * - 200 OK with GetShoppingListResponseDto
 * - Contains data array with ShoppingListItemDto items (RECIPE and MANUAL)
 * - Contains meta object with total, recipe_items, and manual_items counts
 * 
 * Errors:
 * - 401 Unauthorized: Missing or invalid JWT
 * - 500 Internal Server Error: Database error
 */
export async function handleGetShoppingList(req: Request): Promise<Response> {
    // 1. Authenticate user
    const { client, user } = await getAuthenticatedContext(req);

    logger.info('[handleGetShoppingList] Fetching shopping list', {
        userId: user.id,
    });

    // 2. Call service to get shopping list items
    const result = await getShoppingList(client, user.id);

    logger.info('[handleGetShoppingList] Shopping list retrieved successfully', {
        userId: user.id,
        total: result.meta.total,
        recipeItems: result.meta.recipe_items,
        manualItems: result.meta.manual_items,
    });

    // 3. Return 200 OK with GetShoppingListResponseDto
    return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
