/**
 * Public API Types
 * Type definitions specific to public (anonymous) endpoints.
 */

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
}
