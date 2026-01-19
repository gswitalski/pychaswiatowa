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
