-- Zobacz aktywne joby
SELECT id, recipe_id, status, attempts, next_run_at, last_error
FROM normalized_ingredients_jobs
ORDER BY next_run_at ASC;

-- Zobacz statusy przepisów
SELECT id, name, normalized_ingredients_status, normalized_ingredients_updated_at
FROM recipes
WHERE normalized_ingredients_status != 'PENDING';
