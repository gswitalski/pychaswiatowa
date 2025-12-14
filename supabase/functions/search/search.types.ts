/**
 * Search Types
 * Data Transfer Objects (DTOs) and validation schemas for global search endpoints.
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// #region --- Validation Schemas ---

/**
 * Zod Schema for validating search query parameter.
 * Query must be at least 2 characters long.
 */
export const SearchQuerySchema = z.object({
    q: z.string().min(2, 'Search query must be at least 2 characters long'),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;

// #endregion

// #region --- DTOs ---

/**
 * DTO for a single recipe search result.
 * Contains minimal fields for display in search dropdown.
 */
export interface SearchRecipeDto {
    id: number;
    name: string;
    category: string | null;
}

/**
 * DTO for a single collection search result.
 * Contains minimal fields for display in search dropdown.
 */
export interface SearchCollectionDto {
    id: number;
    name: string;
}

/**
 * Main response DTO for global search endpoint.
 * Aggregates search results from recipes and collections.
 */
export interface GlobalSearchResponseDto {
    recipes: SearchRecipeDto[];
    collections: SearchCollectionDto[];
}

// #endregion





