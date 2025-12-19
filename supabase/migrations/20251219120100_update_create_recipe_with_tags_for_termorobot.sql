-- migration: update create_recipe_with_tags for termorobot flag
-- description: adds p_is_termorobot parameter to create_recipe_with_tags function
-- functions affected: create_recipe_with_tags
-- note: implements termorobot flag support in recipe creation

-- drop existing function first (signature is changing)
drop function if exists public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint);

/**
 * Creates a new recipe with associated tags, visibility, servings, and termorobot flag
 * in a single atomic transaction.
 *
 * This function:
 * 1. Validates that the category exists (if provided)
 * 2. Validates servings range (1-99 or null)
 * 3. Parses raw ingredients and steps text to JSONB format
 * 4. Validates that ingredients and steps are not empty after parsing
 * 5. Inserts the recipe with all metadata including termorobot flag
 * 6. Creates or links tags to the recipe
 * 7. Returns the new recipe ID
 *
 * @param p_user_id - The UUID of the authenticated user (recipe owner)
 * @param p_name - Name of the recipe (1-150 characters, required)
 * @param p_description - Description of the recipe (optional)
 * @param p_category_id - Category ID (must exist in categories table, optional)
 * @param p_ingredients_raw - Raw text of ingredients (will be parsed to JSONB, required)
 * @param p_steps_raw - Raw text of steps (will be parsed to JSONB, required)
 * @param p_tag_names - Array of tag names to associate (optional)
 * @param p_visibility - Recipe visibility setting (default: PRIVATE)
 * @param p_servings - Number of servings (1-99 or null, optional)
 * @param p_is_termorobot - Flag indicating recipe is for Thermomix/Lidlomix (default: false)
 *
 * @returns The ID of the newly created recipe
 * @throws exception if category_id is invalid
 * @throws exception if servings is out of range
 * @throws exception if ingredients or steps are empty after parsing
 */
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
    p_is_termorobot boolean default false  -- NEW: termorobot flag parameter
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
        is_termorobot  -- NEW: termorobot flag column
    ) values (
        p_user_id,
        p_name,
        p_description,
        p_category_id,
        v_parsed_ingredients,
        v_parsed_steps,
        p_visibility,
        p_servings,
        p_is_termorobot  -- NEW: termorobot flag value
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
comment on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint, boolean) is
    'Creates a new recipe with associated tags, visibility setting, servings, and termorobot flag in a single atomic transaction. Returns the new recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[], recipe_visibility, smallint, boolean) to authenticated;
