-- migration: update update_recipe_with_tags for tips parameter
-- description: adds p_tips_raw parameter to update_recipe_with_tags function
-- functions affected: update_recipe_with_tags
-- note: uses update flag to distinguish between "not provided" and "set to value"

-- update update_recipe_with_tags function to include tips parameter
create or replace function public.update_recipe_with_tags(
    p_recipe_id bigint,
    p_user_id uuid,
    p_name text default null,
    p_description text default null,
    p_category_id bigint default null,
    p_ingredients_raw text default null,
    p_steps_raw text default null,
    p_tag_names text[] default null,
    p_update_tags boolean default false,
    p_visibility public.recipe_visibility default null,
    p_image_path text default null,
    p_update_category boolean default false,
    p_servings smallint default null,
    p_update_servings boolean default false,
    p_is_termorobot boolean default null,
    p_update_is_termorobot boolean default false,
    p_prep_time_minutes smallint default null,
    p_update_prep_time boolean default false,
    p_total_time_minutes smallint default null,
    p_update_total_time boolean default false,
    p_diet_type public.recipe_diet_type default null,
    p_update_diet_type boolean default false,
    p_cuisine public.recipe_cuisine default null,
    p_update_cuisine boolean default false,
    p_difficulty public.recipe_difficulty default null,
    p_update_difficulty boolean default false,
    p_is_grill boolean default null,
    p_update_is_grill boolean default false,
    p_tips_raw text default null,                        -- NEW: tips raw text parameter
    p_update_tips boolean default false                  -- NEW: update tips flag
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_existing_recipe_id bigint;
    v_tag_name text;
    v_tag_id bigint;
    v_parsed_ingredients jsonb;
    v_parsed_steps jsonb;
    v_parsed_tips jsonb;                                  -- NEW: parsed tips variable
    v_current_prep_time smallint;
    v_current_total_time smallint;
    v_new_prep_time smallint;
    v_new_total_time smallint;
begin
    -- verify recipe exists, belongs to the user, and is not deleted
    select id, prep_time_minutes, total_time_minutes 
    into v_existing_recipe_id, v_current_prep_time, v_current_total_time
    from public.recipes
    where id = p_recipe_id
      and user_id = p_user_id
      and deleted_at is null;

    if v_existing_recipe_id is null then
        raise exception 'Recipe with ID % not found or access denied', p_recipe_id
            using errcode = 'P0002'; -- no_data_found
    end if;

    -- validate category_id if update flag is set and value is not null
    if p_update_category and p_category_id is not null then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
    end if;

    -- validate servings if update flag is set
    if p_update_servings and p_servings is not null and (p_servings < 1 or p_servings > 99) then
        raise exception 'Servings must be between 1 and 99 or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- validate prep_time_minutes if update flag is set
    if p_update_prep_time and p_prep_time_minutes is not null 
        and (p_prep_time_minutes < 0 or p_prep_time_minutes > 999) then
        raise exception 'Preparation time must be between 0 and 999 minutes or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- validate total_time_minutes if update flag is set
    if p_update_total_time and p_total_time_minutes is not null 
        and (p_total_time_minutes < 0 or p_total_time_minutes > 999) then
        raise exception 'Total time must be between 0 and 999 minutes or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- determine final values for time fields (combining current and new values)
    v_new_prep_time := case
        when p_update_prep_time then p_prep_time_minutes
        else v_current_prep_time
    end;
    
    v_new_total_time := case
        when p_update_total_time then p_total_time_minutes
        else v_current_total_time
    end;

    -- validate cross-field constraint: total_time_minutes >= prep_time_minutes (when both are set)
    if v_new_prep_time is not null 
        and v_new_total_time is not null 
        and v_new_total_time < v_new_prep_time then
        raise exception 'Total time must be greater than or equal to preparation time'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- parse and validate ingredients if provided
    if p_ingredients_raw is not null then
        v_parsed_ingredients := public.parse_text_to_jsonb(p_ingredients_raw);

        if jsonb_array_length(v_parsed_ingredients) = 0 then
            raise exception 'Ingredients must contain at least one item'
                using errcode = 'P0001'; -- raise_exception
        end if;
    end if;

    -- parse and validate steps if provided
    if p_steps_raw is not null then
        v_parsed_steps := public.parse_text_to_jsonb(p_steps_raw);

        if jsonb_array_length(v_parsed_steps) = 0 then
            raise exception 'Steps must contain at least one item'
                using errcode = 'P0001'; -- raise_exception
        end if;
    end if;

    -- NEW: parse tips if update flag is set
    if p_update_tips then
        if p_tips_raw is not null and trim(p_tips_raw) != '' then
            v_parsed_tips := public.parse_text_to_jsonb(p_tips_raw);
        else
            v_parsed_tips := '[]'::jsonb;
        end if;
    end if;

    -- update the recipe with only non-null fields (or based on update flags)
    update public.recipes
    set
        name = coalesce(p_name, name),
        description = case
            when p_description is not null then nullif(p_description, '')
            else description
        end,
        category_id = case
            when p_update_category then p_category_id
            else category_id
        end,
        ingredients = coalesce(v_parsed_ingredients, ingredients),
        steps = coalesce(v_parsed_steps, steps),
        tips = case                                      -- NEW: conditional tips update
            when p_update_tips then v_parsed_tips
            else tips
        end,
        visibility = coalesce(p_visibility, visibility),
        image_path = coalesce(p_image_path, image_path),
        servings = case
            when p_update_servings then p_servings
            else servings
        end,
        is_termorobot = case
            when p_update_is_termorobot then p_is_termorobot
            else is_termorobot
        end,
        prep_time_minutes = case
            when p_update_prep_time then p_prep_time_minutes
            else prep_time_minutes
        end,
        total_time_minutes = case
            when p_update_total_time then p_total_time_minutes
            else total_time_minutes
        end,
        diet_type = case
            when p_update_diet_type then p_diet_type
            else diet_type
        end,
        cuisine = case
            when p_update_cuisine then p_cuisine
            else cuisine
        end,
        difficulty = case
            when p_update_difficulty then p_difficulty
            else difficulty
        end,
        is_grill = case
            when p_update_is_grill then p_is_grill
            else is_grill
        end,
        updated_at = now()
    where id = p_recipe_id
      and user_id = p_user_id
      and deleted_at is null;

    -- process tags if update_tags flag is set
    if p_update_tags then
        -- remove all existing tag associations for this recipe
        delete from public.recipe_tags
        where recipe_id = p_recipe_id;

        -- add new tags if provided
        if p_tag_names is not null and array_length(p_tag_names, 1) > 0 then
            foreach v_tag_name in array p_tag_names loop
                -- skip empty tag names
                if trim(v_tag_name) = '' then
                    continue;
                end if;

                -- try to find existing tag (case-insensitive) for this user
                select id into v_tag_id
                from public.tags
                where user_id = p_user_id
                  and lower(name) = lower(trim(v_tag_name));

                -- if tag doesn't exist, create it
                if v_tag_id is null then
                    insert into public.tags (user_id, name)
                    values (p_user_id, lower(trim(v_tag_name)))
                    returning id into v_tag_id;
                end if;

                -- link tag to recipe (ignore if already linked)
                insert into public.recipe_tags (recipe_id, tag_id)
                values (p_recipe_id, v_tag_id)
                on conflict (recipe_id, tag_id) do nothing;
            end loop;
        end if;
    end if;

    return p_recipe_id;
end;
$$;

-- add comment for documentation
comment on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean, smallint, boolean, boolean, boolean, smallint, boolean, smallint, boolean, recipe_diet_type, boolean, recipe_cuisine, boolean, recipe_difficulty, boolean, boolean, boolean, text, boolean) is
    'Updates an existing recipe with associated tags, visibility, image path, category, servings, termorobot flag, time fields, classification fields (diet_type, cuisine, difficulty, is_grill), and tips in a single atomic transaction. Returns the updated recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, text, boolean, smallint, boolean, boolean, boolean, smallint, boolean, smallint, boolean, recipe_diet_type, boolean, recipe_cuisine, boolean, recipe_difficulty, boolean, boolean, boolean, text, boolean) to authenticated;
