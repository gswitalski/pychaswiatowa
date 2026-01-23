-- Migration: Update add_recipe_to_plan_and_update_shopping_list RPC for raw rows
-- Description: Inserts one shopping_list_items row per normalized ingredient

create or replace function public.add_recipe_to_plan_and_update_shopping_list(
    p_recipe_id bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid;
    v_recipe_user_id uuid;
    v_recipe_visibility text;
    v_recipe_deleted_at timestamptz;
    v_normalized_status text;
    v_recipe_name text;
    v_normalized_items jsonb;
    v_item jsonb;
    v_name text;
    v_unit text;
    v_amount numeric;
    v_items_added int := 0;
    v_shopping_list_updated boolean := false;
begin
    -- Get authenticated user ID
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'UNAUTHORIZED: Authentication required'
            using hint = 'Valid JWT token required';
    end if;

    -- Check if recipe exists and get its properties (with row lock to prevent race conditions)
    select r.user_id, r.visibility, r.deleted_at, r.normalized_ingredients_status, r.name
    into v_recipe_user_id, v_recipe_visibility, v_recipe_deleted_at, v_normalized_status, v_recipe_name
    from public.recipes r
    where r.id = p_recipe_id
    for update;

    if not found then
        raise exception 'NOT_FOUND: Recipe not found'
            using hint = 'Recipe with given ID does not exist';
    end if;

    -- Check if recipe is soft-deleted
    if v_recipe_deleted_at is not null then
        raise exception 'NOT_FOUND: Recipe not found'
            using hint = 'Recipe has been deleted';
    end if;

    -- Check access permissions (owner or PUBLIC recipe)
    if v_recipe_user_id != v_user_id and v_recipe_visibility != 'PUBLIC' then
        raise exception 'FORBIDDEN: Access denied'
            using hint = 'You can only add your own recipes or public recipes to your plan';
    end if;

    -- Try to insert recipe into plan (will fail if already exists or limit exceeded)
    begin
        insert into public.plan_recipes (user_id, recipe_id)
        values (v_user_id, p_recipe_id);
    exception
        when unique_violation then
            raise exception 'CONFLICT: Recipe already in plan'
                using hint = 'This recipe is already in your plan';
        when others then
            raise;
    end;

    -- Side-effect: Insert raw shopping list rows if normalized ingredients are ready
    if v_normalized_status = 'READY' then
        select rni.items
        into v_normalized_items
        from public.recipe_normalized_ingredients rni
        where rni.recipe_id = p_recipe_id;

        if v_normalized_items is not null
            and jsonb_typeof(v_normalized_items) = 'array'
            and jsonb_array_length(v_normalized_items) > 0 then

            v_shopping_list_updated := true;

            for v_item in select * from jsonb_array_elements(v_normalized_items)
            loop
                v_name := nullif(btrim(v_item->>'name'), '');
                v_unit := nullif(btrim(v_item->>'unit'), '');
                v_amount := nullif(v_item->>'amount', '')::numeric;

                -- Skip items without name (defensive)
                continue when v_name is null;

                insert into public.shopping_list_items (
                    user_id,
                    kind,
                    recipe_id,
                    recipe_name,
                    name,
                    amount,
                    unit,
                    is_owned
                )
                values (
                    v_user_id,
                    'RECIPE',
                    p_recipe_id,
                    v_recipe_name,
                    v_name,
                    v_amount,
                    v_unit,
                    false
                );

                v_items_added := v_items_added + 1;
            end loop;
        end if;
    end if;

    return jsonb_build_object(
        'success', true,
        'recipe_id', p_recipe_id,
        'shopping_list_updated', v_shopping_list_updated,
        'items_added', v_items_added
    );
end;
$$;

grant execute on function public.add_recipe_to_plan_and_update_shopping_list(bigint) to authenticated;
