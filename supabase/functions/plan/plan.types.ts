/**
 * Types and validation schemas for Plan endpoints
 */

import { z } from 'npm:zod@3.22.4';

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

/**
 * Database row from plan_recipes query with joined recipe data
 */
export interface PlanRecipeRow {
    recipe_id: number;
    added_at: string;
    recipes: {
        id: number;
        name: string;
        image_path: string | null;
        user_id: string;
        visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC';
        deleted_at: string | null;
    };
}

// #endregion

// #region --- Response DTOs ---

/**
 * Response DTO for GET /plan endpoint
 * Re-exported from shared contracts for backend use
 */
export interface GetPlanResponseDto {
    data: PlanListItemDto[];
    meta: {
        total: number;
        limit: 50;
    };
}

/**
 * Single item in plan list
 */
export interface PlanListItemDto {
    recipe_id: number;
    added_at: string;
    recipe: {
        id: number;
        name: string;
        image_path: string | null;
    };
}

// #endregion

