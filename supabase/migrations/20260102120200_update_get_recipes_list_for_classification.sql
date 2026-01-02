-- migration: update get_recipes_list for classification fields
-- description: updates get_recipes_list RPC to support classification filters and return classification fields
-- functions affected: get_recipes_list
-- dependencies: recipes (with classification fields)

-- Najpierw usuń wszystkie istniejące wersje funkcji get_recipes_list
-- aby uniknąć konfliktów z różnymi sygnaturami
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text);
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean);
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], boolean, text);
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean, smallint, smallint);
drop function if exists public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean, recipe_diet_type, recipe_cuisine, recipe_difficulty);

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
 *
 * @param p_user_id - The UUID of the authenticated user making the request
 * @param p_view - The view type: 'owned' or 'my_recipes'
 * @param p_page - Page number (1-based)
 * @param p_limit - Number of items per page
 * @param p_sort_field - Field to sort by: 'name', 'created_at', or 'updated_at'
 * @param p_sort_direction - Sort direction: 'asc' or 'desc'
 * @param p_category_id - Optional category filter
 * @param p_tag_ids - Optional array of tag IDs (recipes must have ALL tags)
 * @param p_termorobot - Optional termorobot filter (true, false, or null for no filter)
 * @param p_search - Optional search term for recipe name (case-insensitive ILIKE)
 * @param p_diet_type - Optional diet type filter (MEAT, VEGETARIAN, VEGAN)
 * @param p_cuisine - Optional cuisine filter (POLISH, ASIAN, MEXICAN, MIDDLE_EASTERN)
 * @param p_difficulty - Optional difficulty filter (EASY, MEDIUM, HARD)
 *
 * @returns TABLE with columns:
 *   - id: recipe ID
 *   - name: recipe name
 *   - image_path: path to recipe image
 *   - created_at: creation timestamp
 *   - visibility: recipe visibility ('PRIVATE', 'SHARED', 'PUBLIC')
 *   - is_owner: true if user owns the recipe
 *   - in_my_collections: true if recipe is in user's collection
 *   - in_my_plan: true if recipe is in user's plan
 *   - author_id: author's user ID
 *   - author_username: author's username
 *   - category_id: category ID (null if no category assigned)
 *   - category_name: category name (null if no category assigned)
 *   - servings: number of servings (null if not specified)
 *   - is_termorobot: termorobot flag
 *   - prep_time_minutes: preparation time in minutes (null if not specified)
 *   - total_time_minutes: total time in minutes (null if not specified)
 *   - diet_type: diet classification (null if not specified)
 *   - cuisine: cuisine classification (null if not specified)
 *   - difficulty: difficulty level (null if not specified)
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
    p_search text default null,
    p_termorobot boolean default null,
    p_diet_type recipe_diet_type default null,
    p_cuisine recipe_cuisine default null,
    p_difficulty recipe_difficulty default null
)
returns table (
    id bigint,
    name text,
    image_path text,
    created_at timestamptz,
    visibility recipe_visibility,
    is_owner boolean,
    in_my_collections boolean,
    in_my_plan boolean,
    author_id uuid,
    author_username text,
    category_id bigint,
    category_name text,
    servings smallint,
    is_termorobot boolean,
    prep_time_minutes smallint,
    total_time_minutes smallint,
    diet_type recipe_diet_type,
    cuisine recipe_cuisine,
    difficulty recipe_difficulty,
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
                r.servings,
                r.is_termorobot,
                r.prep_time_minutes,
                r.total_time_minutes,
                r.diet_type,
                r.cuisine,
                r.difficulty,
                -- Check if user is owner
                (r.user_id = $1) as is_owner,
                -- Check if recipe is in any of user''s collections
                exists(
                    select 1
                    from public.recipe_collections rc
                    inner join public.collections c on c.id = rc.collection_id
                    where rc.recipe_id = r.id
                      and c.user_id = $1
                ) as in_my_collections,
                -- Check if recipe is in user''s plan
                exists(
                    select 1
                    from public.plan_recipes pr
                    where pr.recipe_id = r.id
                      and pr.user_id = $1
                ) as in_my_plan
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
              -- Termorobot filter
              and ($6::boolean is null or r.is_termorobot = $6)
              -- Diet type filter
              and ($7::recipe_diet_type is null or r.diet_type = $7)
              -- Cuisine filter
              and ($8::recipe_cuisine is null or r.cuisine = $8)
              -- Difficulty filter
              and ($9::recipe_difficulty is null or r.difficulty = $9)
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
            cr.in_my_plan,
            cr.user_id as author_id,
            p.username as author_username,
            cr.category_id,
            c.name as category_name,
            cr.servings,
            cr.is_termorobot,
            cr.prep_time_minutes,
            cr.total_time_minutes,
            cr.diet_type,
            cr.cuisine,
            cr.difficulty,
            cr.total_count
        from counted_recipes cr
        left join public.profiles p on p.id = cr.user_id
        left join public.categories c on c.id = cr.category_id
        order by %s
        limit $10
        offset $11
    ', v_sort_clause)
    using
        p_user_id,           -- $1
        p_view,              -- $2
        p_category_id,       -- $3
        p_tag_ids,           -- $4
        p_search,            -- $5
        p_termorobot,        -- $6
        p_diet_type,         -- $7
        p_cuisine,           -- $8
        p_difficulty,        -- $9
        p_limit,             -- $10
        v_offset;            -- $11
end;
$$;

-- Add comment for documentation
comment on function public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean, recipe_diet_type, recipe_cuisine, recipe_difficulty) is
    'Retrieves a paginated list of recipes with support for owned and my_recipes views. Returns recipe details with ownership, collection status, and classification fields (diet_type, cuisine, difficulty).';

-- Grant execute permission to authenticated users
grant execute on function public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean, recipe_diet_type, recipe_cuisine, recipe_difficulty) to authenticated;

