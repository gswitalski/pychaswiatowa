-- Migration: Create admin recipes page RPC and lock down admin page RPCs.

do $$
declare
    v_actual text[];
begin
    if not exists (
        select 1
        from pg_catalog.pg_collation
        where collname = 'pl-x-icu'
          and collprovider = 'i'
    ) then
        raise exception
            'PS-204: collation "pl-x-icu" is not available in this database';
    end if;

    execute $q$
        select array_agg(x order by lower(x collate "pl-x-icu"), x)
        from unnest(array['Żurek','zupa','Łosoś','lody','Śledź','sałatka','ćma','Czosnek']) as x
    $q$ into v_actual;

    if v_actual is distinct from
        array['Czosnek','ćma','lody','Łosoś','sałatka','Śledź','zupa','Żurek'] then
        raise exception 'PS-204: unexpected Polish collation order: %', v_actual;
    end if;

    if lower('ŁÓDŹ ŚŻ' collate "pl-x-icu") is distinct from 'łódź śż' then
        raise exception 'PS-204: pl-x-icu lower() does not fold Polish capitals';
    end if;
end;
$$;

create or replace function public.admin_get_recipes_page(
    p_page_number bigint default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc'
)
returns table (
    id bigint,
    name text,
    author_id uuid,
    author_username text,
    author_email text,
    category_name text,
    created_at timestamptz,
    average_rating numeric,
    ratings_count bigint,
    is_grill boolean,
    is_termorobot boolean,
    total_items bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
    c_max_page constant bigint := 9007199254740991;
    v_page_number bigint := least(greatest(coalesce(p_page_number, 1), 1), c_max_page);
    v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
    v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
    v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
    v_offset bigint;
begin
    if v_sort_by not in ('name', 'author', 'category', 'created_at', 'average_rating', 'ratings_count') then
        v_sort_by := 'created_at';
    end if;

    if v_sort_dir not in ('asc', 'desc') then
        v_sort_dir := 'desc';
    end if;

    v_offset := (v_page_number - 1) * v_page_size::bigint;

    return query
    with ratings_agg as (
        select
            rr.recipe_id,
            count(*)::bigint as ratings_count,
            round(avg(rr.rating)::numeric, 1) as average_rating
        from public.recipe_ratings rr
        group by rr.recipe_id
    ),
    source_rows as (
        select
            r.id,
            r.name::text as name,
            r.user_id as author_id,
            nullif(btrim(p.username), '')::text as author_username,
            c.name::text as category_name,
            r.created_at,
            ra.average_rating,
            coalesce(ra.ratings_count, 0)::bigint as ratings_count,
            r.is_grill,
            r.is_termorobot
        from public.recipes r
        left join public.categories c on c.id = r.category_id
        left join public.profiles p on p.id = r.user_id
        left join ratings_agg ra on ra.recipe_id = r.id
        where r.visibility = 'PUBLIC'
          and r.deleted_at is null
    ),
    total as (
        select count(*)::bigint as total_items from source_rows
    ),
    ranked as (
        select
            sr.*,
            row_number() over (
                order by
                    case when v_sort_by = 'name' and v_sort_dir = 'asc' then lower(sr.name collate "pl-x-icu") end asc,
                    case when v_sort_by = 'name' and v_sort_dir = 'desc' then lower(sr.name collate "pl-x-icu") end desc,
                    case when v_sort_by = 'author' then (sr.author_username is null)::int end asc,
                    case when v_sort_by = 'author' and v_sort_dir = 'asc' then lower(sr.author_username collate "pl-x-icu") end asc,
                    case when v_sort_by = 'author' and v_sort_dir = 'desc' then lower(sr.author_username collate "pl-x-icu") end desc,
                    case when v_sort_by = 'category' then (sr.category_name is null)::int end asc,
                    case when v_sort_by = 'category' and v_sort_dir = 'asc' then lower(sr.category_name collate "pl-x-icu") end asc,
                    case when v_sort_by = 'category' and v_sort_dir = 'desc' then lower(sr.category_name collate "pl-x-icu") end desc,
                    case when v_sort_by = 'created_at' and v_sort_dir = 'asc' then sr.created_at end asc,
                    case when v_sort_by = 'created_at' and v_sort_dir = 'desc' then sr.created_at end desc,
                    case when v_sort_by = 'average_rating' then (sr.average_rating is null)::int end asc,
                    case when v_sort_by = 'average_rating' and v_sort_dir = 'asc' then sr.average_rating end asc,
                    case when v_sort_by = 'average_rating' and v_sort_dir = 'desc' then sr.average_rating end desc,
                    case when v_sort_by = 'ratings_count' and v_sort_dir = 'asc' then sr.ratings_count end asc,
                    case when v_sort_by = 'ratings_count' and v_sort_dir = 'desc' then sr.ratings_count end desc,
                    sr.id asc
            ) as rn
        from source_rows sr
    ),
    page_rows as (
        select rk.*
        from ranked rk
        where rk.rn > v_offset
          and rk.rn <= v_offset + v_page_size
    )
    select
        pr.id,
        pr.name,
        pr.author_id,
        pr.author_username,
        au.email::text,
        pr.category_name,
        pr.created_at,
        pr.average_rating,
        pr.ratings_count,
        pr.is_grill,
        pr.is_termorobot,
        t.total_items
    from total t
    left join page_rows pr on true
    left join auth.users au on au.id = pr.author_id
    order by pr.rn nulls last;
end;
$$;

revoke all on function public.admin_get_recipes_page(bigint, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_recipes_page(bigint, integer, text, text)
    to service_role;

comment on function public.admin_get_recipes_page(bigint, integer, text, text) is
'Returns one page of PUBLIC, non-deleted recipes for the admin panel. total_items is returned even for out-of-range pages via a sentinel row with id = NULL. Executable by service_role only.';

revoke all on function public.admin_get_users_page(integer, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_users_page(integer, integer, text, text)
    to service_role;

revoke all on function public.admin_update_user_role(uuid, text, uuid)
    from public, anon, authenticated;
grant execute on function public.admin_update_user_role(uuid, text, uuid)
    to service_role;

do $$
declare
    v_recipes text := 'public.admin_get_recipes_page(bigint,integer,text,text)';
    v_users text := 'public.admin_get_users_page(integer,integer,text,text)';
    v_role text := 'public.admin_update_user_role(uuid,text,uuid)';
begin
    if has_function_privilege('anon', v_recipes, 'execute')
        or has_function_privilege('authenticated', v_recipes, 'execute')
        or has_function_privilege('anon', v_users, 'execute')
        or has_function_privilege('authenticated', v_users, 'execute')
        or has_function_privilege('anon', v_role, 'execute')
        or has_function_privilege('authenticated', v_role, 'execute')
        or not has_function_privilege('service_role', v_recipes, 'execute')
        or not has_function_privilege('service_role', v_users, 'execute')
        or not has_function_privilege('service_role', v_role, 'execute') then
        raise exception 'PS-204: unexpected EXECUTE privileges on admin page RPCs or role update RPC';
    end if;
end;
$$;
