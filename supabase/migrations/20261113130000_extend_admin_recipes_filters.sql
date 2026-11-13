-- PS-107: filters for the existing admin recipes page RPC.
-- The old 4-argument signature (20261111120000) must be dropped: otherwise the new
-- function becomes an overload and a 4-argument call fails with "function is not unique".
drop function if exists public.admin_get_recipes_page(bigint, integer, text, text);

create or replace function public.admin_get_recipes_page(
    p_page_number bigint default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc',
    p_recipe_id bigint default null,
    p_name text default null,
    p_author text default null,
    p_category_ids bigint[] default null,
    p_include_uncategorized boolean default false,
    p_created_from date default null,
    p_created_to date default null,
    p_rating_min numeric default null,
    p_rating_max numeric default null,
    p_ratings_count_min bigint default null,
    p_ratings_count_max bigint default null,
    p_is_grill boolean default false,
    p_is_termorobot boolean default false
)
returns table (
    id bigint, name text, author_id uuid, author_username text, author_email text,
    category_name text, created_at timestamptz, average_rating numeric,
    ratings_count bigint, is_grill boolean, is_termorobot boolean, total_items bigint
)
language plpgsql security definer
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
        select rr.recipe_id, count(*)::bigint as ratings_count,
            round(avg(rr.rating)::numeric, 1) as average_rating
        from public.recipe_ratings rr
        group by rr.recipe_id
    ),
    source_rows as (
        select r.id, r.name::text as name, r.user_id as author_id,
            nullif(btrim(p.username), '')::text as author_username,
            c.name::text as category_name, r.created_at, ra.average_rating,
            coalesce(ra.ratings_count, 0)::bigint as ratings_count,
            r.is_grill, r.is_termorobot
        from public.recipes r
        left join public.categories c on c.id = r.category_id
        left join public.profiles p on p.id = r.user_id
        left join auth.users au_filter
            on p_author is not null and au_filter.id = r.user_id
        left join ratings_agg ra on ra.recipe_id = r.id
        where r.visibility = 'PUBLIC'
          and r.deleted_at is null
          and (p_recipe_id is null or r.id = p_recipe_id)
          and (p_name is null or r.name collate "pl-x-icu" ilike
              '%' || replace(replace(replace(p_name, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%'
              escape '\')
          and (p_author is null or
              coalesce(p.username, '') collate "pl-x-icu" ilike
                  '%' || replace(replace(replace(p_author, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape '\'
              or coalesce(au_filter.email, '') collate "pl-x-icu" ilike
                  '%' || replace(replace(replace(p_author, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%' escape '\')
          and (p_category_ids is null and not p_include_uncategorized
              or r.category_id = any(p_category_ids)
              or (p_include_uncategorized and r.category_id is null))
          and (p_created_from is null or r.created_at >=
              (p_created_from::timestamp at time zone 'Europe/Warsaw'))
          and (p_created_to is null or r.created_at <
              ((p_created_to + 1)::timestamp at time zone 'Europe/Warsaw'))
          and (p_rating_min is null or ra.average_rating is not null and ra.average_rating >= p_rating_min)
          and (p_rating_max is null or ra.average_rating is not null and ra.average_rating <= p_rating_max)
          and (p_ratings_count_min is null or coalesce(ra.ratings_count, 0) >= p_ratings_count_min)
          and (p_ratings_count_max is null or coalesce(ra.ratings_count, 0) <= p_ratings_count_max)
          and (not p_is_grill or r.is_grill)
          and (not p_is_termorobot or r.is_termorobot)
    ),
    total as (select count(*)::bigint as total_items from source_rows),
    ranked as (
        select sr.*, row_number() over (
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
        ) as rn from source_rows sr
    ),
    page_rows as (
        select rk.* from ranked rk
        where rk.rn > v_offset and rk.rn <= v_offset + v_page_size
    )
    select pr.id, pr.name, pr.author_id, pr.author_username, au.email::text,
        pr.category_name, pr.created_at, pr.average_rating, pr.ratings_count,
        pr.is_grill, pr.is_termorobot, t.total_items
    from total t
    left join page_rows pr on true
    left join auth.users au on au.id = pr.author_id
    order by pr.rn nulls last;
end;
$$;

revoke all on function public.admin_get_recipes_page(
    bigint, integer, text, text, bigint, text, text, bigint[], boolean, date, date,
    numeric, numeric, bigint, bigint, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.admin_get_recipes_page(
    bigint, integer, text, text, bigint, text, text, bigint[], boolean, date, date,
    numeric, numeric, bigint, bigint, boolean, boolean
) to service_role;

comment on function public.admin_get_recipes_page(
    bigint, integer, text, text, bigint, text, text, bigint[], boolean, date, date,
    numeric, numeric, bigint, bigint, boolean, boolean
) is 'Filtered PUBLIC, non-deleted recipes for the admin panel; executable by service_role only.';

do $$
declare
    v_signature text := 'public.admin_get_recipes_page(bigint,integer,text,text,bigint,text,text,bigint[],boolean,date,date,numeric,numeric,bigint,bigint,boolean,boolean)';
begin
    if has_function_privilege('anon', v_signature, 'execute')
        or has_function_privilege('authenticated', v_signature, 'execute')
        or not has_function_privilege('service_role', v_signature, 'execute') then
        raise exception 'PS-107: unexpected EXECUTE privileges on admin recipes RPC';
    end if;
end;
$$;
