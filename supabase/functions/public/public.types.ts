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
export type RecipeCuisine = 
    | 'AFRICAN'
    | 'AMERICAN'
    | 'ASIAN'
    | 'BALKAN'
    | 'BRAZILIAN'
    | 'BRITISH'
    | 'CARIBBEAN'
    | 'CHINESE'
    | 'FRENCH'
    | 'GERMAN'
    | 'GREEK'
    | 'INDIAN'
    | 'ITALIAN'
    | 'JAPANESE'
    | 'KOREAN'
    | 'MEDITERRANEAN'
    | 'MEXICAN'
    | 'MIDDLE_EASTERN'
    | 'POLISH'
    | 'RUSSIAN'
    | 'SCANDINAVIAN'
    | 'SPANISH'
    | 'THAI'
    | 'TURKISH'
    | 'VIETNAMESE';

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
    sortField: 'created_at' | 'name' | 'relevance';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
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
    sortField: 'created_at' | 'name' | 'relevance';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
}

/**
 * Match source for search relevance.
 * Indicates which field provided the best match.
 */
export type SearchMatchSource = 'name' | 'ingredients' | 'tags';

/**
 * Search metadata for relevance scoring.
 * Included in recipe list items when search query is provided.
 */
export interface RecipeSearchMeta {
    /** Relevance score (higher = better match) */
    relevance_score: number;
    /** Field that provided the best match */
    match: SearchMatchSource;
}
