-- =====================================================
-- Migration: Add Normalized Ingredients Support
-- Description: Adds status tracking and storage for AI-generated normalized ingredients
-- =====================================================

-- Add status and timestamp columns to recipes table
ALTER TABLE recipes
ADD COLUMN normalized_ingredients_status text NOT NULL DEFAULT 'PENDING'
    CHECK (normalized_ingredients_status IN ('PENDING', 'READY', 'FAILED')),
ADD COLUMN normalized_ingredients_updated_at timestamptz;

-- Create table for storing normalized ingredients results
CREATE TABLE recipe_normalized_ingredients (
    recipe_id bigint PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE,
    items jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for efficient lookups
CREATE INDEX idx_recipe_normalized_ingredients_recipe_id 
ON recipe_normalized_ingredients(recipe_id);

-- Add comment for documentation
COMMENT ON TABLE recipe_normalized_ingredients IS 
'Stores AI-generated normalized ingredients for recipes. Each recipe has at most one row. Items are stored as JSONB array of {amount, unit, name} objects.';

COMMENT ON COLUMN recipes.normalized_ingredients_status IS 
'Status of normalized ingredients generation: PENDING (not started/in progress), READY (completed), FAILED (error occurred)';

COMMENT ON COLUMN recipes.normalized_ingredients_updated_at IS 
'Timestamp of last successful normalization. NULL if never completed or status is PENDING/FAILED.';

-- Enable RLS on the new table
ALTER TABLE recipe_normalized_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read normalized ingredients for their own recipes
CREATE POLICY "Users can read their own recipe normalized ingredients"
ON recipe_normalized_ingredients
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM recipes r
        WHERE r.id = recipe_normalized_ingredients.recipe_id
        AND r.user_id = auth.uid()
        AND r.deleted_at IS NULL
    )
);

-- RLS Policy: System/workers can insert/update normalized ingredients
-- Note: This policy is for service_role access, regular users should not modify this table
CREATE POLICY "Service role can manage normalized ingredients"
ON recipe_normalized_ingredients
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
