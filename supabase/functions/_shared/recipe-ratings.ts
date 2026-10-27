import { logger } from './logger.ts';
import { TypedSupabaseClient } from './supabase-client.ts';

/** Complete rating state returned after setting a personal recipe rating. */
export interface RecipeRatingDto {
    recipe_id: number;
    my_rating: number | null;
    average_rating: number | null;
    ratings_count: number;
}

/** Rating fields included in recipe detail responses. */
export interface RecipeRatingFields {
    average_rating: number | null;
    ratings_count: number | null;
    my_rating?: number | null;
}

/**
 * Fetches the authenticated user's ratings for a batch of recipes.
 * This read is intentionally non-blocking for recipe detail endpoints.
 */
export async function getMyRatingsMap(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null
): Promise<Map<number, number>> {
    const ratings = new Map<number, number>();

    if (userId === null || recipeIds.length === 0) {
        return ratings;
    }

    try {
        const { data, error } = await client
            .from('recipe_ratings')
            .select('recipe_id, rating')
            .eq('user_id', userId)
            .in('recipe_id', recipeIds);

        if (error) {
            logger.error('Error fetching own recipe ratings', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeIdsCount: recipeIds.length,
            });
            return ratings;
        }

        for (const row of data ?? []) {
            ratings.set(Number(row.recipe_id), Number(row.rating));
        }
    } catch (error) {
        logger.error('Unexpected error fetching own recipe ratings', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            recipeIdsCount: recipeIds.length,
        });
    }

    return ratings;
}

/** Masks ratings for non-public recipes and omits personal state for guests. */
export function buildRatingFields(
    row: {
        visibility: string;
        average_rating: number | string | null;
        ratings_count: number | string | null;
    },
    myRating: number | undefined,
    isAuthenticated: boolean
): RecipeRatingFields {
    if (row.visibility !== 'PUBLIC') {
        return {
            average_rating: null,
            ratings_count: null,
            ...(isAuthenticated && { my_rating: null }),
        };
    }

    const ratingsCount = Number(row.ratings_count ?? 0);
    return {
        average_rating:
            ratingsCount === 0 || row.average_rating === null
                ? null
                : Number(row.average_rating),
        ratings_count: ratingsCount,
        ...(isAuthenticated && { my_rating: myRating ?? null }),
    };
}
