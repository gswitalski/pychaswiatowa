-- Migration: Update clear_plan_and_update_shopping_list RPC for raw rows
-- Description: Deletes all RECIPE rows from shopping_list_items (raw rows)

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

    -- 3. Cleanup legacy contributions (if any exist)
    delete from public.shopping_list_recipe_contributions
    where user_id = v_user_id;

    get diagnostics v_contributions_removed = row_count;

    -- 4. Remove all RECIPE items from shopping list
    delete from public.shopping_list_items
    where user_id = v_user_id
      and kind = 'RECIPE';

    get diagnostics v_recipe_items_deleted = row_count;

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

grant execute on function public.clear_plan_and_update_shopping_list() to authenticated;
