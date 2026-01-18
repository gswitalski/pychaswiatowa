-- =====================================================
-- Migration: Create Normalized Ingredients Jobs Queue
-- Description: Creates queue table for managing async normalization jobs with deduplication
-- =====================================================

-- Create jobs queue table
CREATE TABLE normalized_ingredients_jobs (
    id bigserial PRIMARY KEY,
    recipe_id bigint NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'RUNNING', 'DONE', 'FAILED')),
    attempts int NOT NULL DEFAULT 0,
    last_error text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add unique constraint for deduplication (one job per recipe)
CREATE UNIQUE INDEX idx_normalized_ingredients_jobs_recipe_id 
ON normalized_ingredients_jobs(recipe_id);

-- Add index for efficient job polling
CREATE INDEX idx_normalized_ingredients_jobs_status_created 
ON normalized_ingredients_jobs(status, created_at) 
WHERE status IN ('PENDING', 'RUNNING');

-- Add comment for documentation
COMMENT ON TABLE normalized_ingredients_jobs IS 
'Queue for normalized ingredients generation jobs. Deduplication enforced via unique index on recipe_id. Workers poll PENDING jobs and update status.';

-- Enable RLS on the jobs table
ALTER TABLE normalized_ingredients_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can read jobs for their own recipes
CREATE POLICY "Users can read their own recipe normalization jobs"
ON normalized_ingredients_jobs
FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM recipes r
        WHERE r.id = normalized_ingredients_jobs.recipe_id
        AND r.user_id = auth.uid()
        AND r.deleted_at IS NULL
    )
);

-- RLS Policy: Users can insert jobs for their own recipes
CREATE POLICY "Users can create jobs for their own recipes"
ON normalized_ingredients_jobs
FOR INSERT
WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
        SELECT 1
        FROM recipes r
        WHERE r.id = recipe_id
        AND r.user_id = auth.uid()
        AND r.deleted_at IS NULL
    )
);

-- RLS Policy: Service role can manage all jobs (for worker processing)
CREATE POLICY "Service role can manage all jobs"
ON normalized_ingredients_jobs
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Add trigger for updated_at timestamp
CREATE TRIGGER set_normalized_ingredients_jobs_updated_at
BEFORE UPDATE ON normalized_ingredients_jobs
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();
