-- migration: update_recipe_with_tags function
-- description: creates a postgresql function to update a recipe with tags in a single transaction
-- function created: update_recipe_with_tags
-- dependencies: recipes, tags, recipe_tags, parse_text_to_jsonb
-- note: this function ensures atomicity when updating a recipe with its associated tags

/**
 * Updates an existing recipe with associated tags in a single atomic transaction.
 * 
 * This function:
 * 1. Verifies the recipe exists and belongs to the user (soft-delete aware)
 * 2. Validates that the category exists (if provided)
 * 3. Updates only the fields that are not NULL
 * 4. Parses raw ingredients and steps text to JSONB format (if provided)
 * 5. Manages tags: removes old associations and creates/links new ones (if provided)
 * 6. Returns the updated recipe ID
 *
 * @param p_recipe_id - The ID of the recipe to update
 * @param p_user_id - The UUID of the authenticated user (must be the owner)
 * @param p_name - Optional new name of the recipe (1-150 characters)
 * @param p_description - Optional new description (pass empty string to clear)
 * @param p_category_id - Optional new category ID (pass 0 to clear, must exist if > 0)
 * @param p_ingredients_raw - Optional new raw text of ingredients (will be parsed to JSONB)
 * @param p_steps_raw - Optional new raw text of steps (will be parsed to JSONB)
 * @param p_tag_names - Optional array of tag names to associate (replaces all existing tags)
 * @param p_update_tags - Boolean flag indicating whether to update tags (allows distinguishing between "no tags provided" and "clear all tags")
 * 
 * @returns The ID of the updated recipe
 * @throws exception if recipe not found or not owned by user
 * @throws exception if category_id is invalid
 * @throws exception if ingredients/steps are empty after parsing
 */
create or replace function public.update_recipe_with_tags(
    p_recipe_id bigint,
    p_user_id uuid,
    p_name text default null,
    p_description text default null,
    p_category_id bigint default null,
    p_ingredients_raw text default null,
    p_steps_raw text default null,
    p_tag_names text[] default null,
    p_update_tags boolean default false
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
begin
    -- verify recipe exists, belongs to the user, and is not deleted
    select id into v_existing_recipe_id
    from public.recipes
    where id = p_recipe_id
      and user_id = p_user_id
      and deleted_at is null;

    if v_existing_recipe_id is null then
        raise exception 'Recipe with ID % not found or access denied', p_recipe_id
            using errcode = 'P0002'; -- no_data_found
    end if;

    -- validate category_id if provided and greater than 0
    if p_category_id is not null and p_category_id > 0 then
        if not exists (select 1 from public.categories where id = p_category_id) then
            raise exception 'Category with ID % does not exist', p_category_id
                using errcode = 'P0002'; -- no_data_found
        end if;
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

    -- update the recipe with only non-null fields
    update public.recipes
    set
        name = coalesce(p_name, name),
        description = case
            when p_description is not null then nullif(p_description, '')
            else description
        end,
        category_id = case
            when p_category_id is not null then nullif(p_category_id, 0)
            else category_id
        end,
        ingredients = coalesce(v_parsed_ingredients, ingredients),
        steps = coalesce(v_parsed_steps, steps),
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
comment on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean) is 
    'Updates an existing recipe with associated tags in a single atomic transaction. Returns the updated recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean) to authenticated;


