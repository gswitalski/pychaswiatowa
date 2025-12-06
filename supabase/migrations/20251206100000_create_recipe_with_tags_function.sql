-- migration: create_recipe_with_tags function
-- description: creates a postgresql function to create a recipe with tags in a single transaction
-- function created: create_recipe_with_tags
-- dependencies: recipes, tags, recipe_tags, parse_text_to_jsonb
-- note: this function ensures atomicity when creating a recipe with its associated tags

/**
 * Creates a new recipe with associated tags in a single atomic transaction.
 * 
 * This function:
 * 1. Validates that the category exists (if provided)
 * 2. Parses raw ingredients and steps text to JSONB format
 * 3. Inserts the new recipe
 * 4. For each tag name:
 *    - Finds existing tag (case-insensitive) or creates a new one
 *    - Links the tag to the recipe
 * 5. Returns the new recipe ID
 *
 * @param p_user_id - The UUID of the authenticated user creating the recipe
 * @param p_name - The name of the recipe (1-150 characters)
 * @param p_description - Optional description of the recipe
 * @param p_category_id - Optional category ID (must exist if provided)
 * @param p_ingredients_raw - Raw text of ingredients (will be parsed to JSONB)
 * @param p_steps_raw - Raw text of steps (will be parsed to JSONB)
 * @param p_tag_names - Array of tag names to associate with the recipe
 * 
 * @returns The ID of the newly created recipe
 * @throws exception if category_id is invalid
 */
create or replace function public.create_recipe_with_tags(
    p_user_id uuid,
    p_name text,
    p_description text,
    p_category_id bigint,
    p_ingredients_raw text,
    p_steps_raw text,
    p_tag_names text[]
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
        steps
    ) values (
        p_user_id,
        p_name,
        p_description,
        p_category_id,
        v_parsed_ingredients,
        v_parsed_steps
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
comment on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[]) is 
    'Creates a new recipe with associated tags in a single atomic transaction. Returns the new recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.create_recipe_with_tags(uuid, text, text, bigint, text, text, text[]) to authenticated;

