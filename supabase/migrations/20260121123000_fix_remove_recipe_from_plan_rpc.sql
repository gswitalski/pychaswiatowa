-- Migration: Fix RPC for removing recipe from plan with shopping list side-effect
-- Description: Ensure function can delete RECIPE items by bypassing RLS inside RPC
-- Related to: plan-recipes-recipeid-delete endpoint implementation

-- =====================================================
-- RPC: remove_recipe_from_plan_and_update_shopping_list
-- =====================================================
-- Purpose: Atomically remove recipe from plan and update shopping list
-- by subtracting the recipe's ingredient contributions.
--
-- Fix rationale:
-- - shopping_list_items has DELETE policy limited to MANUAL items
-- - RPC must be able to delete RECIPE items when their amount reaches 0
-- - We keep strict user_id filtering, but bypass RLS inside RPC
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
set row_security = off
as $$
declare
    v_user_id uuid;
    v_deleted_recipe_id bigint;
    v_contribution record;
    v_items_updated integer := 0;
    v_items_deleted integer := 0;
    v_contributions_removed integer := 0;
    v_other_contributions_exist boolean;
    v_owned_items_deleted integer := 0;
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

    -- 3b. Usuń odhaczone pozycje RECIPE bez pozostałych wkładów
    delete from public.shopping_list_items sli
    where sli.user_id = v_user_id
      and sli.kind = 'RECIPE'
      and sli.is_owned = true
      and not exists (
          select 1
          from public.shopping_list_recipe_contributions src
          where src.user_id = v_user_id
            and src.name = sli.name
            and coalesce(src.unit, '') = coalesce(sli.unit, '')
      );

    get diagnostics v_owned_items_deleted = row_count;
    v_items_deleted := v_items_deleted + v_owned_items_deleted;

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
'Atomically removes a recipe from user plan and updates shopping list by subtracting ingredient contributions. Uses auth.uid() for security. Bypasses RLS internally to allow deleting RECIPE items.';
