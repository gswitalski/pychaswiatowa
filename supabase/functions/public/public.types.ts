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
}
