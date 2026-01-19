-- =====================================================
-- Migration: Add Retry/Backoff Support to Normalized Ingredients Jobs
-- Description: Adds next_run_at field and RETRY status for exponential backoff
-- =====================================================

-- Add next_run_at column for scheduling retry attempts
ALTER TABLE normalized_ingredients_jobs
ADD COLUMN next_run_at timestamptz NOT NULL DEFAULT now();

-- Update status constraint to include RETRY
ALTER TABLE normalized_ingredients_jobs
DROP CONSTRAINT IF EXISTS normalized_ingredients_jobs_status_check;

ALTER TABLE normalized_ingredients_jobs
ADD CONSTRAINT normalized_ingredients_jobs_status_check
CHECK (status IN ('PENDING', 'RUNNING', 'RETRY', 'DONE', 'FAILED'));

-- Update index for efficient job polling (include RETRY status)
DROP INDEX IF EXISTS idx_normalized_ingredients_jobs_status_created;

CREATE INDEX idx_normalized_ingredients_jobs_status_next_run 
ON normalized_ingredients_jobs(status, next_run_at) 
WHERE status IN ('PENDING', 'RETRY');

-- Add comment for documentation
COMMENT ON COLUMN normalized_ingredients_jobs.next_run_at IS 
'Timestamp when job should be processed next. Used for scheduling retries with exponential backoff.';

-- Update RPC function to set next_run_at on job creation
CREATE OR REPLACE FUNCTION enqueue_normalized_ingredients_refresh(
    p_recipe_id bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_recipe_exists boolean;
BEGIN
    -- Get current user ID from auth context
    v_user_id := auth.uid();
    
    -- Guard: User must be authenticated
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Authentication required'
            USING ERRCODE = 'AUTHZ1';
    END IF;
    
    -- Guard: Check if recipe exists, is not deleted, and user has access
    SELECT EXISTS (
        SELECT 1
        FROM recipes
        WHERE id = p_recipe_id
        AND user_id = v_user_id
        AND deleted_at IS NULL
    ) INTO v_recipe_exists;
    
    IF NOT v_recipe_exists THEN
        RAISE EXCEPTION 'Recipe not found or access denied'
            USING ERRCODE = 'NOTFD';
    END IF;
    
    -- Step 1: Reset recipe normalization status to PENDING
    UPDATE recipes
    SET 
        normalized_ingredients_status = 'PENDING',
        normalized_ingredients_updated_at = NULL
    WHERE id = p_recipe_id;
    
    -- Step 2: Upsert job in queue (deduplicate by recipe_id)
    INSERT INTO normalized_ingredients_jobs (
        recipe_id,
        user_id,
        status,
        attempts,
        last_error,
        next_run_at,
        created_at,
        updated_at
    ) VALUES (
        p_recipe_id,
        v_user_id,
        'PENDING',
        0,
        NULL,
        now(),
        now(),
        now()
    )
    ON CONFLICT (recipe_id) 
    DO UPDATE SET
        status = 'PENDING',
        attempts = 0,
        last_error = NULL,
        next_run_at = now(),
        updated_at = now();
    
    -- Return result
    RETURN json_build_object(
        'recipe_id', p_recipe_id,
        'status', 'PENDING'
    );
END;
$$;
