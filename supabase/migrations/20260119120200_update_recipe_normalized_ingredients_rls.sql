-- Migration: Update RLS policy for recipe_normalized_ingredients
-- Description: Allow reading normalized ingredients for PUBLIC recipes (required for shopping list feature)

-- Drop old policy
DROP POLICY IF EXISTS "Users can read their own recipe normalized ingredients" ON recipe_normalized_ingredients;

-- Create new policy: users can read normalized ingredients for:
-- 1. Their own recipes (any visibility)
-- 2. Public recipes from other users
CREATE POLICY "Users can read normalized ingredients for accessible recipes"
ON recipe_normalized_ingredients
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM recipes r
        WHERE r.id = recipe_normalized_ingredients.recipe_id
        AND r.deleted_at IS NULL
        AND (
            -- Own recipes (any visibility)
            r.user_id = auth.uid()
            -- OR public recipes from others
            OR r.visibility = 'PUBLIC'
        )
    )
);

-- Add comment to explain the policy
COMMENT ON POLICY "Users can read normalized ingredients for accessible recipes" ON recipe_normalized_ingredients IS
    'Allows users to read normalized ingredients for their own recipes (any visibility) or public recipes from other users. Required for shopping list feature when adding public recipes to plan.';
