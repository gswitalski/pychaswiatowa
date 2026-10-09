import { TypedSupabaseClient } from './supabase-client.ts';
import { logger } from './logger.ts';

export interface RecipeFlagsState {
    is_favorite: boolean;
    is_want_to_try: boolean;
}

export interface RecipeFlagsDto extends RecipeFlagsState {
    recipe_id: number;
}

/**
 * Fetches the authenticated user's flags for a batch of recipes.
 * Flag lookup is intentionally non-blocking for read endpoints.
 */
export async function getRecipeFlagsMap(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null
): Promise<Map<number, RecipeFlagsState>> {
    if (userId === null || recipeIds.length === 0) {
        return new Map<number, RecipeFlagsState>();
    }

    try {
        const { data, error } = await client
            .from('user_recipe_flags')
            .select('recipe_id, is_favorite, is_want_to_try')
            .eq('user_id', userId)
            .in('recipe_id', recipeIds);

        if (error) {
            logger.error('Error fetching recipe flags', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeIdsCount: recipeIds.length,
            });
            return new Map<number, RecipeFlagsState>();
        }

        return new Map<number, RecipeFlagsState>(
            (data ?? []).map((row) => [
                row.recipe_id,
                {
                    is_favorite: row.is_favorite,
                    is_want_to_try: row.is_want_to_try,
                },
            ])
        );
    } catch (error) {
        logger.error('Unexpected error fetching recipe flags', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            recipeIdsCount: recipeIds.length,
        });
        return new Map<number, RecipeFlagsState>();
    }
}
