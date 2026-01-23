-- Migration: Update remove_recipe_from_plan_and_update_shopping_list RPC for raw rows
-- Description: Deletes raw shopping_list_items by recipe_id (no aggregation)

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
    v_items_deleted integer := 0;
    v_contributions_removed integer := 0;
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

    if v_deleted_recipe_id is null then
        raise exception 'NOT_FOUND: Recipe not found in plan';
    end if;

    -- 3. Remove raw RECIPE items for this recipe
    delete from public.shopping_list_items
    where user_id = v_user_id
      and kind = 'RECIPE'
      and recipe_id = p_recipe_id;

    get diagnostics v_items_deleted = row_count;

    -- 4. Cleanup legacy contributions (if any exist)
    delete from public.shopping_list_recipe_contributions
    where user_id = v_user_id
      and recipe_id = p_recipe_id;

    get diagnostics v_contributions_removed = row_count;

    return jsonb_build_object(
        'success', true,
        'recipe_id', p_recipe_id,
        'contributions_removed', v_contributions_removed,
        'items_updated', 0,
        'items_deleted', v_items_deleted
    );

exception
    when others then
        if sqlerrm like 'UNAUTHORIZED:%' or sqlerrm like 'NOT_FOUND:%' then
            raise;
        end if;

        raise exception 'INTERNAL_ERROR: %', sqlerrm;
end;
$$;

grant execute on function public.remove_recipe_from_plan_and_update_shopping_list(bigint) to authenticated;
