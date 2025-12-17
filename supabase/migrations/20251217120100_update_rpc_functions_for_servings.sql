-- migration: update RPC functions for servings
-- description: updates update_recipe_with_tags and get_recipes_list to support servings field
-- functions affected: update_recipe_with_tags, get_recipes_list
-- note: adds servings parameter with update flag and includes servings in list results

-- ============================================================================
-- PART 1: Update update_recipe_with_tags function
-- ============================================================================

-- drop existing function first (signature is changing)
drop function if exists public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility);

/**
 * Updates an existing recipe with associated tags in a single atomic transaction.
 *
 * This function:
 * 1. Verifies the recipe exists and belongs to the user (soft-delete aware)
 * 2. Validates that the category exists (if provided)
 * 3. Updates only the fields that are not NULL
 * 4. Parses raw ingredients and steps text to JSONB format (if provided)
 * 5. Manages tags: removes old associations and creates/links new ones (if provided)
 * 6. Updates servings if p_update_servings flag is set (allows distinguishing between "not provided" and "set to null")
 * 7. Returns the updated recipe ID
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
 * @param p_visibility - Optional new visibility setting
 * @param p_servings - Optional new servings value (1-99 or null to clear)
 * @param p_update_servings - Boolean flag indicating whether to update servings (allows distinguishing between "not provided" and "set to null")
 *
 * @returns The ID of the updated recipe
 * @throws exception if recipe not found or not owned by user
 * @throws exception if category_id is invalid
 * @throws exception if servings is out of range
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
    p_update_tags boolean default false,
    p_visibility public.recipe_visibility default null,
    p_servings smallint default null,  -- NEW: servings parameter
    p_update_servings boolean default false  -- NEW: update servings flag
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

    -- validate servings if update is requested (constraint will also check, but explicit validation provides better error message)
    if p_update_servings and p_servings is not null and (p_servings < 1 or p_servings > 99) then
        raise exception 'Servings must be between 1 and 99 or null'
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
        visibility = coalesce(p_visibility, visibility),
        servings = case  -- NEW: conditional servings update
            when p_update_servings then p_servings
            else servings
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
comment on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, smallint, boolean) is
    'Updates an existing recipe with associated tags, visibility, and servings in a single atomic transaction. Returns the updated recipe ID.';

-- grant execute permission to authenticated users
grant execute on function public.update_recipe_with_tags(bigint, uuid, text, text, bigint, text, text, text[], boolean, recipe_visibility, smallint, boolean) to authenticated;

-- ============================================================================
-- PART 2: Update get_recipes_list function
-- ============================================================================

-- drop existing function first (return type is changing)
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text);

/**
 * Retrieves a paginated list of recipes with filtering and sorting.
 *
 * This function supports two views:
 * 1. 'owned' - Returns only recipes owned by the requesting user
 * 2. 'my_recipes' - Returns owned recipes + PUBLIC recipes from other authors that are in at least one user's collection
 *
 * For each recipe, the function calculates:
 * - is_owner: boolean indicating if the requesting user owns the recipe
 * - in_my_collections: boolean indicating if the recipe is in any of user's collections
 * - author: object with author's id and username
 * - servings: number of servings (null if not specified)
 *
 * @param p_user_id - The UUID of the authenticated user making the request
 * @param p_view - The view type: 'owned' or 'my_recipes'
 * @param p_page - Page number (1-based)
 * @param p_limit - Number of items per page
 * @param p_sort_field - Field to sort by: 'name', 'created_at', or 'updated_at'
 * @param p_sort_direction - Sort direction: 'asc' or 'desc'
 * @param p_category_id - Optional category filter
 * @param p_tag_ids - Optional array of tag IDs (recipes must have ALL tags)
 * @param p_search - Optional search term for recipe name (case-insensitive ILIKE)
 *
 * @returns TABLE with columns:
 *   - id: recipe ID
 *   - name: recipe name
 *   - image_path: path to recipe image
 *   - created_at: creation timestamp
 *   - visibility: recipe visibility ('PRIVATE', 'SHARED', 'PUBLIC')
 *   - is_owner: true if user owns the recipe
 *   - in_my_collections: true if recipe is in user's collection
 *   - author_id: author's user ID
 *   - author_username: author's username
 *   - category_id: category ID (null if no category assigned)
 *   - category_name: category name (null if no category assigned)
 *   - servings: number of servings (null if not specified)
 *   - total_count: total number of items matching filters (for pagination)
 */
create or replace function public.get_recipes_list(
    p_user_id uuid,
    p_view text default 'owned',
    p_page integer default 1,
    p_limit integer default 20,
    p_sort_field text default 'created_at',
    p_sort_direction text default 'desc',
    p_category_id bigint default null,
    p_tag_ids bigint[] default null,
    p_search text default null
)
returns table (
    id bigint,
    name text,
    image_path text,
    created_at timestamptz,
    visibility recipe_visibility,
    is_owner boolean,
    in_my_collections boolean,
    author_id uuid,
    author_username text,
    category_id bigint,
    category_name text,
    servings smallint,  -- NEW: servings column
    total_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_offset integer;
    v_sort_clause text;
begin
    -- Calculate pagination offset
    v_offset := (p_page - 1) * p_limit;

    -- Validate and build sort clause (whitelist to prevent SQL injection)
    -- Note: 'cr' alias refers to 'counted_recipes' CTE in the main query
    case p_sort_field
        when 'name' then
            v_sort_clause := 'cr.name';
        when 'created_at' then
            v_sort_clause := 'cr.created_at';
        when 'updated_at' then
            v_sort_clause := 'cr.updated_at';
        else
            v_sort_clause := 'cr.created_at';
    end case;

    -- Add direction
    if lower(p_sort_direction) = 'asc' then
        v_sort_clause := v_sort_clause || ' ASC';
    else
        v_sort_clause := v_sort_clause || ' DESC';
    end if;

    -- Main query
    return query execute format('
        with filtered_recipes as (
            select distinct on (r.id)
                r.id,
                r.name,
                r.image_path,
                r.created_at,
                r.visibility,
                r.user_id,
                r.category_id,
                r.servings,  -- NEW: servings column
                -- Check if user is owner
                (r.user_id = $1) as is_owner,
                -- Check if recipe is in any of user''s collections
                exists(
                    select 1
                    from public.recipe_collections rc
                    inner join public.collections c on c.id = rc.collection_id
                    where rc.recipe_id = r.id
                      and c.user_id = $1
                ) as in_my_collections
            from public.recipes r
            where r.deleted_at is null
              -- View filter
              and (
                  -- owned view: only user''s recipes
                  ($2 = ''owned'' and r.user_id = $1)
                  or
                  -- my_recipes view: user''s recipes OR public recipes in user''s collections
                  (
                      $2 = ''my_recipes''
                      and (
                          r.user_id = $1
                          or (
                              r.visibility = ''PUBLIC''
                              and exists(
                                  select 1
                                  from public.recipe_collections rc
                                  inner join public.collections c on c.id = rc.collection_id
                                  where rc.recipe_id = r.id
                                    and c.user_id = $1
                              )
                          )
                      )
                  )
              )
              -- Category filter
              and ($3::bigint is null or r.category_id = $3)
              -- Tags filter (recipe must have ALL specified tags)
              and (
                  $4::bigint[] is null
                  or array(
                      select rt.tag_id
                      from public.recipe_tags rt
                      where rt.recipe_id = r.id
                  ) @> $4
              )
              -- Search filter (case-insensitive pattern matching on name)
              and (
                  $5::text is null
                  or r.name ilike ''%%'' || $5 || ''%%''
              )
        ),
        counted_recipes as (
            select
                fr.*,
                count(*) over() as total_count
            from filtered_recipes fr
        )
        select
            cr.id,
            cr.name,
            cr.image_path,
            cr.created_at,
            cr.visibility,
            cr.is_owner,
            cr.in_my_collections,
            cr.user_id as author_id,
            p.username as author_username,
            cr.category_id,
            c.name as category_name,
            cr.servings,  -- NEW: servings column
            cr.total_count
        from counted_recipes cr
        left join public.profiles p on p.id = cr.user_id
        left join public.categories c on c.id = cr.category_id
        order by %s
        limit $6
        offset $7
    ', v_sort_clause)
    using
        p_user_id,           -- $1
        p_view,              -- $2
        p_category_id,       -- $3
        p_tag_ids,           -- $4
        p_search,            -- $5
        p_limit,             -- $6
        v_offset;            -- $7
end;
$$;

-- Add comment for documentation
comment on function public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text) is
    'Retrieves a paginated list of recipes with support for owned and my_recipes views. Returns recipe details with ownership, collection status, and servings.';

-- Grant execute permission to authenticated users
grant execute on function public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text) to authenticated;
