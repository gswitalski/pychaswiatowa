-- =====================================================
-- Migration: Create RPC for Claiming Normalized Ingredients Jobs
-- Description: Atomically claims jobs for worker processing with SKIP LOCKED
-- =====================================================

/**
 * Atomically claims a batch of jobs ready for processing.
 * Uses FOR UPDATE SKIP LOCKED to prevent race conditions between workers.
 *
 * @param p_limit Maximum number of jobs to claim (default 10)
 * @returns JSON array of claimed jobs with recipe details
 */
CREATE OR REPLACE FUNCTION claim_normalized_ingredients_jobs(
    p_limit int DEFAULT 10
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_claimed_jobs json;
BEGIN
    -- Validate limit
    IF p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION 'Invalid limit: must be between 1 and 100'
            USING ERRCODE = 'VALDT';
    END IF;
    
    -- Claim jobs atomically with SKIP LOCKED
    WITH claimed AS (
        UPDATE normalized_ingredients_jobs
        SET 
            status = 'RUNNING',
            attempts = attempts + 1,
            updated_at = now()
        WHERE id IN (
            SELECT id
            FROM normalized_ingredients_jobs
            WHERE status IN ('PENDING', 'RETRY')
            AND next_run_at <= now()
            ORDER BY next_run_at ASC
            LIMIT p_limit
            FOR UPDATE SKIP LOCKED
        )
        RETURNING 
            id,
            recipe_id,
            user_id,
            attempts,
            last_error
    )
    SELECT json_agg(
        json_build_object(
            'job_id', c.id,
            'recipe_id', c.recipe_id,
            'user_id', c.user_id,
            'attempts', c.attempts,
            'last_error', c.last_error,
            'ingredients', r.ingredients
        )
    )
    INTO v_claimed_jobs
    FROM claimed c
    INNER JOIN recipes r ON r.id = c.recipe_id
    WHERE r.deleted_at IS NULL;
    
    -- Return empty array if no jobs claimed
    RETURN COALESCE(v_claimed_jobs, '[]'::json);
END;
$$;

COMMENT ON FUNCTION claim_normalized_ingredients_jobs IS 
'Atomically claims jobs ready for processing. Uses FOR UPDATE SKIP LOCKED to prevent race conditions. Returns job details with recipe ingredients.';
