-- migration: update normalized_ingredients_status for recipes with normalized data
-- description: sets status to 'READY' for recipes that have normalized ingredients
-- tables affected: recipes
-- dependencies: recipes table, recipe_normalized_ingredients table
-- note: this seed ensures consistency between recipes table and recipe_normalized_ingredients

-- Update status for all recipes that have normalized ingredients
UPDATE recipes r
SET 
    normalized_ingredients_status = 'READY',
    normalized_ingredients_updated_at = rni.updated_at
FROM recipe_normalized_ingredients rni
WHERE r.id = rni.recipe_id
  AND r.normalized_ingredients_status != 'READY';

-- Report results
DO $$
DECLARE
    updated_count int;
BEGIN
    SELECT COUNT(*) INTO updated_count
    FROM recipes r
    INNER JOIN recipe_normalized_ingredients rni ON r.id = rni.recipe_id
    WHERE r.normalized_ingredients_status = 'READY';
    
    RAISE NOTICE 'Normalized ingredients status updated: % recipes now have status READY', updated_count;
END;
$$;
