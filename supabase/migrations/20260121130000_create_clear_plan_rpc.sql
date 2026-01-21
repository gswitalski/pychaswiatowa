-- Migration: Create RPC for clearing plan with shopping list side-effect
-- Description: Atomically clears plan and removes all recipe-derived shopping list items
-- Related to: plan delete endpoint (DELETE /plan)

-- =====================================================
-- RPC: clear_plan_and_update_shopping_list
-- =====================================================
-- Purpose: Atomically remove all recipes from plan and remove all recipe-derived
-- shopping list data (contributions + RECIPE items). Manual items are preserved.
--
-- Business rules:
-- - Idempotent: clearing an empty plan is considered success
-- - Uses auth.uid() as source of user_id (security)
-- - Removes all rows from plan_recipes for the user
-- - Removes all rows from shopping_list_recipe_contributions for the user
-- - Removes all RECIPE items from shopping_list_items for the user
--
-- Returns: JSONB with operation metadata
-- Raises: Custom exceptions for error handling (UNAUTHORIZED)

create or replace function public.clear_plan_and_update_shopping_list()
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
    v_user_id uuid;
    v_plan_items_removed integer := 0;
    v_contributions_removed integer := 0;
    v_recipe_items_deleted integer := 0;
begin
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'UNAUTHORIZED: Authentication required';
    end if;

    -- 2. Remove all recipes from plan
    delete from public.plan_recipes
    where user_id = v_user_id;

    get diagnostics v_plan_items_removed = row_count;

    -- 3. Remove all recipe contributions
    delete from public.shopping_list_recipe_contributions
    where user_id = v_user_id;

    get diagnostics v_contributions_removed = row_count;

    -- 4. Remove all RECIPE items from shopping list
    delete from public.shopping_list_items
    where user_id = v_user_id
      and kind = 'RECIPE';

    get diagnostics v_recipe_items_deleted = row_count;

    -- 5. Return operation metadata
    return jsonb_build_object(
        'success', true,
        'plan_items_removed', v_plan_items_removed,
        'contributions_removed', v_contributions_removed,
        'recipe_items_deleted', v_recipe_items_deleted
    );

exception
    when others then
        if sqlerrm like 'UNAUTHORIZED:%' then
            raise;
        end if;
        
        raise exception 'INTERNAL_ERROR: %', sqlerrm;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.clear_plan_and_update_shopping_list() to authenticated;

-- Add comment for documentation
comment on function public.clear_plan_and_update_shopping_list() is
'Atomically clears user plan and removes all recipe-derived shopping list data. Uses auth.uid() for security. Bypasses RLS internally.';
