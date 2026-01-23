/**
 * Business logic for Shopping List operations
 */

import { logger } from '../_shared/logger.ts';
import { ApplicationError } from '../_shared/errors.ts';
import { TypedSupabaseClient } from '../_shared/supabase-client.ts';

/**
 * Columns to select for manual shopping list items.
 * Matches ShoppingListItemManualDto structure.
 */
const SHOPPING_LIST_ITEM_MANUAL_SELECT = `
    id,
    user_id,
    kind,
    text,
    is_owned,
    created_at,
    updated_at
` as const;

/**
 * Columns to select for all shopping list items (both RECIPE and MANUAL).
 * Covers both ShoppingListItemRecipeDto and ShoppingListItemManualDto.
 * Note: RECIPE items will have recipe_id/recipe_name/name/amount/unit (text is null).
 *       MANUAL items will have text (name/amount/unit/recipe fields are null).
 */
const SHOPPING_LIST_ITEM_ALL_SELECT = `
    id,
    user_id,
    kind,
    recipe_id,
    recipe_name,
    name,
    amount,
    unit,
    text,
    is_owned,
    created_at,
    updated_at
` as const;

/**
 * Response type for creating a manual shopping list item.
 * Matches ShoppingListItemManualDto from shared/contracts/types.ts
 */
export interface CreateManualShoppingListItemResponse {
    id: number;
    user_id: string;
    kind: 'MANUAL';
    text: string;
    is_owned: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Creates a new manual shopping list item for the authenticated user.
 * 
 * Business rules:
 * - kind is always 'MANUAL' (set by service, not from payload)
 * - user_id is set automatically by DB default (auth.uid())
 * - text must be non-empty after trim (validated by handler)
 * - is_owned defaults to false
 * - RLS ensures user can only insert to their own list
 * 
 * @param client - The authenticated Supabase client (user context)
 * @param userId - The ID of the authenticated user (for logging)
 * @param text - The normalized text for the shopping list item (already trimmed)
 * @returns Created shopping list item
 * @throws ApplicationError
 * - VALIDATION_ERROR: Text is empty or invalid
 * - INTERNAL_ERROR: Database operation failed
 */
export async function createManualShoppingListItem(
    client: TypedSupabaseClient,
    userId: string,
    text: string
): Promise<CreateManualShoppingListItemResponse> {
    
    logger.info('[createManualShoppingListItem] Creating manual item', {
        userId,
        textLength: text.length,
    });

    // Additional server-side validation (defense in depth)
    if (!text || text.trim().length === 0) {
        logger.warn('[createManualShoppingListItem] Empty text after trim', { userId });
        throw new ApplicationError(
            'VALIDATION_ERROR',
            'Item text cannot be empty'
        );
    }

    // Insert the item
    // Note: user_id is set by DB default (auth.uid()), kind is explicitly 'MANUAL'
    const { data, error } = await client
        .from('shopping_list_items')
        .insert({
            kind: 'MANUAL',
            text: text.trim(), // Ensure trimmed
            // user_id: set by DB default
            // is_owned: defaults to false in DB
        })
        .select(SHOPPING_LIST_ITEM_MANUAL_SELECT)
        .single();

    if (error) {
        logger.error('[createManualShoppingListItem] Database error', {
            userId,
            error: error.message,
            code: error.code,
        });

        // Map common DB errors
        if (error.code === '23514') { // Check constraint violation
            throw new ApplicationError(
                'VALIDATION_ERROR',
                'Item data violates database constraints'
            );
        }

        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to create shopping list item'
        );
    }

    if (!data) {
        logger.error('[createManualShoppingListItem] No data returned after insert', {
            userId,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to create shopping list item'
        );
    }

    logger.info('[createManualShoppingListItem] Item created successfully', {
        userId,
        itemId: data.id,
    });

    return data as CreateManualShoppingListItemResponse;
}

/**
 * Response type for getting shopping list.
 * Matches GetShoppingListResponseDto from shared/contracts/types.ts
 */
export interface GetShoppingListResponse {
    data: ShoppingListItemDto[];
    meta: {
        total: number;
        recipe_items: number;
        manual_items: number;
    };
}

/**
 * DTO type for shopping list items (discriminated union).
 * Matches ShoppingListItemDto from shared/contracts/types.ts
 */
type ShoppingListItemDto = ShoppingListItemRecipeDto | ShoppingListItemManualDto;

/**
 * DTO for recipe-based shopping list items.
 */
interface ShoppingListItemRecipeDto {
    id: number;
    user_id: string;
    kind: 'RECIPE';
    recipe_id: number;
    recipe_name: string;
    name: string;
    amount: number | null;
    unit: string | null;
    is_owned: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * DTO for manual shopping list items.
 */
interface ShoppingListItemManualDto {
    id: number;
    user_id: string;
    kind: 'MANUAL';
    text: string;
    is_owned: boolean;
    created_at: string;
    updated_at: string;
}

/**
 * Retrieves the complete shopping list for the authenticated user.
 * 
 * Business rules:
 * - Returns both RECIPE and MANUAL items
 * - Items are sorted by:
 *   1. is_owned ASC (false first, then true)
 *   2. alphabetically by name/text (case-insensitive)
 *   3. id ASC (stable sort tiebreaker)
 * - RLS ensures user sees only their own items
 * - Meta includes counts: total, recipe_items, manual_items
 * 
 * @param client - The authenticated Supabase client (user context)
 * @param userId - The ID of the authenticated user (for logging)
 * @returns Shopping list with items and metadata
 * @throws ApplicationError
 * - INTERNAL_ERROR: Database operation failed
 */
export async function getShoppingList(
    client: TypedSupabaseClient,
    userId: string
): Promise<GetShoppingListResponse> {
    
    logger.info('[getShoppingList] Fetching shopping list', { userId });

    // Fetch all shopping list items for the user
    // Note: Sorting is done in-memory (see below) as Supabase client doesn't support coalesce in order()
    const { data, error } = await client
        .from('shopping_list_items')
        .select(SHOPPING_LIST_ITEM_ALL_SELECT);

    if (error) {
        logger.error('[getShoppingList] Database error', {
            userId,
            error: error.message,
            code: error.code,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to fetch shopping list'
        );
    }

    // data can be null if no items (Supabase returns null for empty result)
    const items = data || [];

    // Sort items in-memory per spec:
    // 1. is_owned ASC (false first, then true)
    // 2. alphabetically by name (RECIPE) or text (MANUAL), case-insensitive
    // 3. id ASC (stable sort tiebreaker)
    const sortedItems = items.sort((a, b) => {
        // Primary sort: is_owned (false < true)
        if (a.is_owned !== b.is_owned) {
            return a.is_owned ? 1 : -1;
        }

        // Secondary sort: name/text (case-insensitive, alphabetically)
        const aText = (a.name || a.text || '').toLowerCase();
        const bText = (b.name || b.text || '').toLowerCase();
        if (aText !== bText) {
            return aText.localeCompare(bText);
        }

        // Tertiary sort: id (stable tiebreaker)
        return a.id - b.id;
    });

    // Calculate metadata
    const recipeItems = sortedItems.filter((item) => item.kind === 'RECIPE').length;
    const manualItems = sortedItems.filter((item) => item.kind === 'MANUAL').length;

    logger.info('[getShoppingList] Shopping list fetched successfully', {
        userId,
        total: sortedItems.length,
        recipeItems,
        manualItems,
    });

    // Cast items to proper DTO type (discriminated union)
    const itemsDto = sortedItems as ShoppingListItemDto[];

    return {
        data: itemsDto,
        meta: {
            total: sortedItems.length,
            recipe_items: recipeItems,
            manual_items: manualItems,
        },
    };
}

/**
 * Updates the is_owned flag for a shopping list item.
 *
 * Business rules:
 * - Only is_owned can be updated
 * - RLS ensures user can update only their own items
 * - Returns 404 if item does not exist or is not owned by user
 *
 * @param client - The authenticated Supabase client (user context)
 * @param userId - The ID of the authenticated user (for logging)
 * @param itemId - Shopping list item ID
 * @param isOwned - New ownership status
 * @returns Updated shopping list item (RECIPE or MANUAL)
 * @throws ApplicationError
 * - NOT_FOUND: Item not found or not owned by user
 * - INTERNAL_ERROR: Database operation failed
 */
export async function updateShoppingListItemIsOwned(
    client: TypedSupabaseClient,
    userId: string,
    itemId: number,
    isOwned: boolean
): Promise<ShoppingListItemDto> {
    logger.info('[updateShoppingListItemIsOwned] Updating item ownership', {
        userId,
        itemId,
        isOwned,
    });

    const { data, error } = await client
        .from('shopping_list_items')
        .update({ is_owned: isOwned })
        .eq('id', itemId)
        .select(SHOPPING_LIST_ITEM_ALL_SELECT)
        .maybeSingle();

    if (error) {
        logger.error('[updateShoppingListItemIsOwned] Database error', {
            userId,
            itemId,
            error: error.message,
            code: error.code,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to update shopping list item'
        );
    }

    if (!data) {
        logger.warn('[updateShoppingListItemIsOwned] Item not found', {
            userId,
            itemId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            'Shopping list item not found'
        );
    }

    logger.info('[updateShoppingListItemIsOwned] Item updated successfully', {
        userId,
        itemId,
        isOwned,
    });

    return data as ShoppingListItemDto;
}

/**
 * Deletes a manual shopping list item.
 *
 * Business rules:
 * - Only MANUAL items can be deleted
 * - RECIPE items are system-managed and return FORBIDDEN
 * - RLS ensures user can only delete their own items
 *
 * @param client - The authenticated Supabase client (user context)
 * @param userId - The ID of the authenticated user (for logging)
 * @param itemId - Shopping list item ID
 * @throws ApplicationError
 * - NOT_FOUND: Item not found or not owned by user
 * - FORBIDDEN: Item is recipe-derived
 * - INTERNAL_ERROR: Database operation failed
 */
export async function deleteManualShoppingListItem(
    client: TypedSupabaseClient,
    userId: string,
    itemId: number
): Promise<void> {
    logger.info('[deleteManualShoppingListItem] Deleting manual item', {
        userId,
        itemId,
    });

    const { data: existingItem, error: selectError } = await client
        .from('shopping_list_items')
        .select('id,kind')
        .eq('id', itemId)
        .maybeSingle();

    if (selectError) {
        logger.error('[deleteManualShoppingListItem] Database select error', {
            userId,
            itemId,
            error: selectError.message,
            code: selectError.code,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to delete shopping list item'
        );
    }

    if (!existingItem) {
        logger.warn('[deleteManualShoppingListItem] Item not found', {
            userId,
            itemId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            'Shopping list item not found'
        );
    }

    if (existingItem.kind !== 'MANUAL') {
        logger.warn('[deleteManualShoppingListItem] Forbidden item kind', {
            userId,
            itemId,
            kind: existingItem.kind,
        });
        throw new ApplicationError(
            'FORBIDDEN',
            'Cannot delete recipe-derived shopping list items'
        );
    }

    const { data: deletedItem, error: deleteError } = await client
        .from('shopping_list_items')
        .delete()
        .eq('id', itemId)
        .eq('kind', 'MANUAL')
        .select('id')
        .maybeSingle();

    if (deleteError) {
        logger.error('[deleteManualShoppingListItem] Database delete error', {
            userId,
            itemId,
            error: deleteError.message,
            code: deleteError.code,
        });
        throw new ApplicationError(
            'INTERNAL_ERROR',
            'Failed to delete shopping list item'
        );
    }

    if (!deletedItem) {
        logger.warn('[deleteManualShoppingListItem] Item not found after delete', {
            userId,
            itemId,
        });
        throw new ApplicationError(
            'NOT_FOUND',
            'Shopping list item not found'
        );
    }

    logger.info('[deleteManualShoppingListItem] Item deleted successfully', {
        userId,
        itemId,
    });
}
