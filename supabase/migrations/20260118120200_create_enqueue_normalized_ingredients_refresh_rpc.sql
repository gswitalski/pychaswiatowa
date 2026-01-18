-- =====================================================
-- Migration: Create RPC for Enqueuing Normalized Ingredients Refresh
-- Description: Atomic operation to reset recipe status and upsert job queue entry
-- =====================================================

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
        created_at,
        updated_at
    ) VALUES (
        p_recipe_id,
        v_user_id,
        'PENDING',
        0,
        NULL,
        now(),
        now()
    )
    ON CONFLICT (recipe_id) 
    DO UPDATE SET
        status = 'PENDING',
        attempts = 0,
        last_error = NULL,
        updated_at = now();
    
    -- Return result
    RETURN json_build_object(
        'recipe_id', p_recipe_id,
        'status', 'PENDING'
    );
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION enqueue_normalized_ingredients_refresh(bigint) IS 
'Atomically resets recipe normalization status to PENDING and enqueues/refreshes a normalization job. Returns {recipe_id, status}. Throws AUTHZ1 if not authenticated, NOTFD if recipe not found or access denied.';
