-- migration: create get_recipes_list function
-- description: creates a postgresql function to retrieve paginated recipes list with filtering
-- function created: get_recipes_list
-- dependencies: recipes, profiles, categories, tags, collections, recipe_tags, recipe_collections
-- note: supports 'owned' and 'my_recipes' views with proper deduplication and pagination

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
    visibility text,
    is_owner boolean,
    in_my_collections boolean,
    author_id uuid,
    author_username text,
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
    case p_sort_field
        when 'name' then
            v_sort_clause := 'r.name';
        when 'created_at' then
            v_sort_clause := 'r.created_at';
        when 'updated_at' then
            v_sort_clause := 'r.updated_at';
        else
            v_sort_clause := 'r.created_at';
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
            cr.total_count
        from counted_recipes cr
        left join public.profiles p on p.id = cr.user_id
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
    'Retrieves a paginated list of recipes with support for owned and my_recipes views. Returns recipe details with ownership and collection status.';

-- Grant execute permission to authenticated users
grant execute on function public.get_recipes_list(uuid, text, integer, integer, text, text, bigint, bigint[], text) to authenticated;
