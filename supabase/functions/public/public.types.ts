/**
 * Public API Types
 * Type definitions specific to public (anonymous) endpoints.
 */

/**
 * Recipe diet type enum (public API).
 */
export type RecipeDietType = 'MEAT' | 'VEGETARIAN' | 'VEGAN';

/**
 * Recipe cuisine enum (public API).
 */
export type RecipeCuisine = 'POLISH' | 'ASIAN' | 'MEXICAN' | 'MIDDLE_EASTERN';

/**
 * Recipe difficulty enum (public API).
 */
export type RecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Query parameters for fetching public recipes.
 */
export interface GetPublicRecipesQuery {
    page: number;
    limit: number;
    sortField: 'created_at' | 'name';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
}

/**
 * Parameters for fetching a single public recipe by ID.
 */
export interface GetPublicRecipeByIdParams {
    id: number;
}

/**
 * Query parameters for fetching public recipes feed (cursor-based pagination).
 */
export interface GetPublicRecipesFeedQuery {
    cursor?: string;
    limit: number;
    sortField: 'created_at' | 'name';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
}
