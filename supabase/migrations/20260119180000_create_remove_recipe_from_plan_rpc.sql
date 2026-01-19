-- Migration: Create RPC for removing recipe from plan with shopping list side-effect
-- Description: Atomically removes recipe from plan and updates shopping list by subtracting contributions
-- Related to: plan-recipes-recipeid-delete endpoint implementation

-- =====================================================
-- RPC: remove_recipe_from_plan_and_update_shopping_list
-- =====================================================
-- Purpose: Atomically remove recipe from plan and update shopping list
-- by subtracting the recipe's ingredient contributions.
--
-- Business rules:
-- - Recipe must be in user's plan (404 if not found)
-- - Uses auth.uid() as source of user_id (security)
-- - Removes contributions from shopping_list_recipe_contributions
-- - Updates/removes items from shopping_list_items based on contribution type:
--   a) Aggregable items (unit != null, amount != null): subtract amount, delete if amount <= 0
--   b) Name-only items (unit null or amount null): delete only if no other contributions exist
-- - Manual items (kind='MANUAL') are not affected
-- - Transaction ensures atomicity (rollback on any error)
--
-- Returns: JSONB with operation metadata
-- Raises: Custom exceptions for error handling (UNAUTHORIZED, NOT_FOUND)

create or replace function public.remove_recipe_from_plan_and_update_shopping_list(
    p_recipe_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_deleted_recipe_id bigint;
    v_contribution record;
    v_items_updated integer := 0;
    v_items_deleted integer := 0;
    v_contributions_removed integer := 0;
    v_other_contributions_exist boolean;
begin
    -- 1. Get authenticated user
    v_user_id := auth.uid();
    
    if v_user_id is null then
        raise exception 'UNAUTHORIZED: Authentication required';
    end if;

    -- 2. Remove recipe from plan (with RETURNING to check existence)
    delete from public.plan_recipes
    where user_id = v_user_id
      and recipe_id = p_recipe_id
    returning recipe_id into v_deleted_recipe_id;

    -- Check if recipe was in plan
    if v_deleted_recipe_id is null then
        raise exception 'NOT_FOUND: Recipe not found in plan';
    end if;

    -- 3. Process contributions and update shopping list
    -- Loop through each contribution to subtract from shopping list
    for v_contribution in
        delete from public.shopping_list_recipe_contributions
        where user_id = v_user_id
          and recipe_id = p_recipe_id
        returning name, unit, amount
    loop
        v_contributions_removed := v_contributions_removed + 1;

        -- Case A: Aggregable item (unit and amount are not null)
        if v_contribution.unit is not null and v_contribution.amount is not null then
            -- Subtract amount from shopping list item
            update public.shopping_list_items
            set 
                amount = coalesce(amount, 0) - v_contribution.amount,
                updated_at = now()
            where user_id = v_user_id
              and kind = 'RECIPE'
              and name = v_contribution.name
              and coalesce(unit, '') = coalesce(v_contribution.unit, '');

            if found then
                v_items_updated := v_items_updated + 1;
            end if;

            -- Delete items where amount is now <= 0
            delete from public.shopping_list_items
            where user_id = v_user_id
              and kind = 'RECIPE'
              and name = v_contribution.name
              and coalesce(unit, '') = coalesce(v_contribution.unit, '')
              and (amount is null or amount <= 0);

            if found then
                v_items_deleted := v_items_deleted + 1;
                v_items_updated := v_items_updated - 1; -- Don't double count
            end if;

        -- Case B: Name-only item (unit or amount is null)
        else
            -- Check if other contributions exist for this (name, unit) key
            select exists(
                select 1
                from public.shopping_list_recipe_contributions
                where user_id = v_user_id
                  and name = v_contribution.name
                  and coalesce(unit, '') = coalesce(v_contribution.unit, '')
                limit 1
            ) into v_other_contributions_exist;

            -- Delete shopping list item only if no other contributions exist
            if not v_other_contributions_exist then
                delete from public.shopping_list_items
                where user_id = v_user_id
                  and kind = 'RECIPE'
                  and name = v_contribution.name
                  and coalesce(unit, '') = coalesce(v_contribution.unit, '');

                if found then
                    v_items_deleted := v_items_deleted + 1;
                end if;
            else
                -- Other contributions exist, optionally touch updated_at
                update public.shopping_list_items
                set updated_at = now()
                where user_id = v_user_id
                  and kind = 'RECIPE'
                  and name = v_contribution.name
                  and coalesce(unit, '') = coalesce(v_contribution.unit, '');
            end if;
        end if;
    end loop;

    -- 4. Return operation metadata
    return jsonb_build_object(
        'success', true,
        'recipe_id', p_recipe_id,
        'contributions_removed', v_contributions_removed,
        'items_updated', v_items_updated,
        'items_deleted', v_items_deleted
    );

exception
    when others then
        -- Re-raise custom exceptions as-is
        if sqlerrm like 'UNAUTHORIZED:%' or sqlerrm like 'NOT_FOUND:%' then
            raise;
        end if;
        
        -- Log and re-raise unexpected errors
        raise exception 'INTERNAL_ERROR: %', sqlerrm;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.remove_recipe_from_plan_and_update_shopping_list(bigint) to authenticated;

-- Add comment for documentation
comment on function public.remove_recipe_from_plan_and_update_shopping_list(bigint) is
'Atomically removes a recipe from user plan and updates shopping list by subtracting ingredient contributions. Uses auth.uid() for security.';
