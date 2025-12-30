/**
 * Types and validation schemas for Plan endpoints
 */

import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// #region --- Zod Schemas ---

/**
 * Schema for POST /plan/recipes request body
 */
export const AddRecipeToPlanSchema = z.object({
    recipe_id: z
        .number()
        .int()
        .positive('Recipe ID must be a positive integer'),
});

// #endregion

// #region --- Service Types ---

/**
 * Recipe access check result (minimal recipe data)
 */
export interface RecipeAccessInfo {
    id: number;
    user_id: string;
    visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
    deleted_at: string | null;
}

// #endregion

