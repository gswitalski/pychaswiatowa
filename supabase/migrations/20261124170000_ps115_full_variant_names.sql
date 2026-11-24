-- PS-115: return the complete matching variant name list.
-- Keep the existing get_recipes_list signature and service-role-only access.

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
    p_difficulty recipe_difficulty default null,
    p_grill boolean default null,
    p_group_variants boolean default false
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
    is_grill boolean,
    variant_name text,
    active_variant_count integer,
    matching_variant_count integer,
    matching_variant_names text[],
    matching_variant_overflow integer,
    total_count bigint
)
language sql
security definer
set search_path = public
as $$
    with accessible as (
        select
            r.*,
            case when p_group_variants
                then coalesce(r.recipe_family_id::text, 'recipe:' || r.id::text)
                else 'recipe:' || r.id::text
            end as family_key
        from public.recipes r
        where r.deleted_at is null
          and (
              (p_view = 'owned' and r.user_id = p_user_id)
              or (
                  p_view = 'my_recipes'
                  and (
                      r.user_id = p_user_id
                      or (
                          r.visibility = 'PUBLIC'
                          and exists (
                              select 1
                              from public.recipe_collections rc
                              join public.collections c on c.id = rc.collection_id
                              where rc.recipe_id = r.id and c.user_id = p_user_id
                          )
                      )
                  )
              )
          )
    ),
    matching as (
        select
            a.*,
            count(*) over (partition by a.family_key)::integer as matching_count,
            row_number() over (
                partition by a.family_key
                order by a.is_default desc, a.sort_order asc, a.id asc
            ) as representative_rank
        from accessible a
        where (p_category_id is null or a.category_id = p_category_id)
          and (
              p_tag_ids is null
              or array(
                  select rt.tag_id from public.recipe_tags rt
                  where rt.recipe_id = a.id
              ) @> p_tag_ids
          )
          and (
              p_search is null
              or a.name ilike '%' || p_search || '%'
              or (
                  lower(trim(a.variant_name)) not in ('wariant podstawowy', 'podstawowa')
                  and a.variant_name ilike '%' || p_search || '%'
              )
          )
          and (p_termorobot is null or a.is_termorobot = p_termorobot)
          and (p_diet_type is null or a.diet_type = p_diet_type)
          and (p_cuisine is null or a.cuisine = p_cuisine)
          and (p_difficulty is null or a.difficulty = p_difficulty)
          and (p_grill is null or a.is_grill = p_grill)
    ),
    counts as (
        select family_key, count(*)::integer as active_count
        from accessible
        group by family_key
    ),
    groups as (
        select
            m.*,
            c.active_count,
            count(*) over () as total_count
        from matching m
        join counts c using (family_key)
        where m.representative_rank = 1
    )
    select
        g.id,
        g.name,
        g.image_path,
        g.created_at,
        g.visibility,
        g.user_id = p_user_id,
        exists (
            select 1
            from public.recipe_collections rc
            join public.collections c on c.id = rc.collection_id
            where rc.recipe_id = g.id and c.user_id = p_user_id
        ),
        exists (
            select 1
            from public.plan_recipes pr
            where pr.recipe_id = g.id and pr.user_id = p_user_id
        ),
        g.user_id,
        p.username,
        g.category_id,
        cat.name,
        g.servings,
        g.is_termorobot,
        g.prep_time_minutes,
        g.total_time_minutes,
        g.diet_type,
        g.cuisine,
        g.difficulty,
        g.is_grill,
        g.variant_name,
        g.active_count,
        g.matching_count,
        (
            select array_agg(x.variant_name order by x.sort_order, x.id)
            from (
                select trim(m2.variant_name) as variant_name, m2.sort_order, m2.id
                from matching m2
                where m2.family_key = g.family_key
                  and nullif(trim(m2.variant_name), '') is not null
                order by m2.sort_order, m2.id
                limit 10
            ) x
        ),
        0,
        g.total_count
    from groups g
    left join public.profiles p on p.id = g.user_id
    left join public.categories cat on cat.id = g.category_id
    order by
        case when lower(p_sort_direction) = 'asc' and p_sort_field = 'name' then g.name end asc,
        case when lower(p_sort_direction) <> 'asc' and p_sort_field = 'name' then g.name end desc,
        case when lower(p_sort_direction) = 'asc' and p_sort_field <> 'name' then g.created_at end asc,
        case when lower(p_sort_direction) <> 'asc' and p_sort_field <> 'name' then g.created_at end desc,
        g.id desc
    limit greatest(p_limit, 0)
    offset greatest((p_page - 1) * p_limit, 0);
$$;

revoke all on function public.get_recipes_list(
    uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean,
    recipe_diet_type, recipe_cuisine, recipe_difficulty, boolean, boolean
) from public, anon, authenticated;

grant execute on function public.get_recipes_list(
    uuid, text, integer, integer, text, text, bigint, bigint[], text, boolean,
    recipe_diet_type, recipe_cuisine, recipe_difficulty, boolean, boolean
) to service_role;

do $$
declare
    signature text := 'public.get_recipes_list(uuid,text,integer,integer,text,text,bigint,bigint[],text,boolean,recipe_diet_type,recipe_cuisine,recipe_difficulty,boolean,boolean)';
begin
    if has_function_privilege('anon', signature, 'execute')
       or has_function_privilege('authenticated', signature, 'execute') then
        raise exception 'PS-115 get_recipes_list must not be executable by anon/authenticated';
    end if;
    if not has_function_privilege('service_role', signature, 'execute') then
        raise exception 'PS-115 get_recipes_list must be executable by service_role';
    end if;
end;
$$;
