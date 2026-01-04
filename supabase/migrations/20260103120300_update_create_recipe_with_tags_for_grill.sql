-- migration: update create_recipe_with_tags for grill flag
-- description: adds is_grill parameter to create_recipe_with_tags function
-- functions affected: create_recipe_with_tags
-- note: is_grill defaults to false if not provided

-- update create_recipe_with_tags function to include is_grill parameter
create or replace function public.create_recipe_with_tags(
    p_user_id uuid,
    p_name text,
    p_description text,
    p_category_id bigint,
    p_ingredients_raw text,
    p_steps_raw text,
    p_tag_names text[],
    p_visibility public.recipe_visibility default 'PRIVATE',
    p_servings smallint default null,
    p_is_termorobot boolean default false,
    p_prep_time_minutes smallint default null,
    p_total_time_minutes smallint default null,
    p_diet_type public.recipe_diet_type default null,
    p_cuisine public.recipe_cuisine default null,
    p_difficulty public.recipe_difficulty default null,
    p_is_grill boolean default false                    -- NEW: grill flag parameter
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
    v_recipe_id bigint;
    v_tag_name text;
    v_tag_id bigint;
    v_parsed_ingredients jsonb;
    v_parsed_steps jsonb;
begin
    -- validate category_id if provided
    if p_category_id is not null then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
    end if;

    -- validate servings if provided (constraint will also check, but explicit validation provides better error message)
    if p_servings is not null and (p_servings < 1 or p_servings > 99) then
        raise exception 'Servings must be between 1 and 99 or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- validate prep_time_minutes if provided
    if p_prep_time_minutes is not null and (p_prep_time_minutes < 0 or p_prep_time_minutes > 999) then
        raise exception 'Preparation time must be between 0 and 999 minutes or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- validate total_time_minutes if provided
    if p_total_time_minutes is not null and (p_total_time_minutes < 0 or p_total_time_minutes > 999) then
        raise exception 'Total time must be between 0 and 999 minutes or null'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- validate cross-field constraint: total_time_minutes >= prep_time_minutes (when both are set)
    if p_prep_time_minutes is not null 
        and p_total_time_minutes is not null 
        and p_total_time_minutes < p_prep_time_minutes then
        raise exception 'Total time must be greater than or equal to preparation time'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- parse ingredients and steps to jsonb using existing helper function
    v_parsed_ingredients := public.parse_text_to_jsonb(p_ingredients_raw);
    v_parsed_steps := public.parse_text_to_jsonb(p_steps_raw);

    -- validate that ingredients and steps are not empty after parsing
    if jsonb_array_length(v_parsed_ingredients) = 0 then
        raise exception 'Ingredients must contain at least one item'
            using errcode = 'P0001'; -- raise_exception
    end if;

    if jsonb_array_length(v_parsed_steps) = 0 then
        raise exception 'Steps must contain at least one item'
            using errcode = 'P0001'; -- raise_exception
    end if;

    -- insert the recipe
    insert into public.recipes (
        user_id,
        name,
        description,
        category_id,
        ingredients,
        steps,
        visibility,
        servings,
        is_termorobot,
        prep_time_minutes,
        total_time_minutes,
        diet_type,
        cuisine,
        difficulty,
        is_grill                -- NEW: grill flag column
    ) values (
        p_user_id,
        p_name,
        p_description,
        p_category_id,
        v_parsed_ingredients,
        v_parsed_steps,
        p_visibility,
        p_servings,
        p_is_termorobot,
        p_prep_time_minutes,
        p_total_time_minutes,
        p_diet_type,
        p_cuisine,
        p_difficulty,
        p_is_grill              -- NEW: grill flag value
    )
    returning id into v_recipe_id;

    -- process tags if provided
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
            values (v_recipe_id, v_tag_id)
            on conflict (recipe_id, tag_id) do nothing;
        end loop;
    end if;

    return v_recipe_id;
end;
$$;

-- add comment for documentation
comment on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint, boolean, smallint, smallint, recipe_diet_type, recipe_cuisine, recipe_difficulty, boolean) is
    'Creates a new recipe with associated tags, visibility setting, servings, termorobot flag, time fields, classification fields (diet_type, cuisine, difficulty, is_grill) in a single atomic transaction. Returns the new recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint, boolean, smallint, smallint, recipe_diet_type, recipe_cuisine, recipe_difficulty, boolean) to authenticated;

