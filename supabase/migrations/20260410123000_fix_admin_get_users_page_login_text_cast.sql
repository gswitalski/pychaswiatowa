-- Migration: Fix admin_get_users_page return type mismatch for login column
-- Description: Cast auth.users.email (varchar) to text to match function return signature

create or replace function public.admin_get_users_page(
    p_page_number integer default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc'
)
returns table (
    id uuid,
    login text,
    username text,
    role text,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    recipes_count bigint,
    total_items bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
    v_page_number integer := greatest(coalesce(p_page_number, 1), 1);
    v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
    v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
    v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
    v_offset integer;
begin
    if v_sort_by not in ('created_at', 'login', 'last_sign_in_at', 'recipes_count') then
        v_sort_by := 'created_at';
    end if;

    if v_sort_dir not in ('asc', 'desc') then
        v_sort_dir := 'desc';
    end if;

    v_offset := (v_page_number - 1) * v_page_size;

    return query
    with recipes_agg as (
        select
            r.user_id,
            count(*)::bigint as recipes_count
        from public.recipes r
        where r.deleted_at is null
        group by r.user_id
    ),
    source_rows as (
        select
            au.id,
            au.email::text as login,
            p.username,
            coalesce(au.raw_app_meta_data ->> 'app_role', 'user') as role,
            au.created_at,
            au.last_sign_in_at,
            coalesce(ra.recipes_count, 0)::bigint as recipes_count
        from auth.users au
        left join public.profiles p on p.id = au.id
        left join recipes_agg ra on ra.user_id = au.id
    ),
    counted_rows as (
        select
            sr.*,
            count(*) over()::bigint as total_items
        from source_rows sr
    )
    select
        cr.id,
        cr.login,
        cr.username,
        cr.role,
        cr.created_at,
        cr.last_sign_in_at,
        cr.recipes_count,
        cr.total_items
    from counted_rows cr
    order by
        case when v_sort_by = 'created_at' and v_sort_dir = 'asc' then cr.created_at end asc,
        case when v_sort_by = 'created_at' and v_sort_dir = 'desc' then cr.created_at end desc,
        case when v_sort_by = 'login' and v_sort_dir = 'asc' then lower(coalesce(cr.login, '')) end asc,
        case when v_sort_by = 'login' and v_sort_dir = 'desc' then lower(coalesce(cr.login, '')) end desc,
        case when v_sort_by = 'last_sign_in_at' then (cr.last_sign_in_at is null)::int end asc,
        case when v_sort_by = 'last_sign_in_at' and v_sort_dir = 'asc' then cr.last_sign_in_at end asc,
        case when v_sort_by = 'last_sign_in_at' and v_sort_dir = 'desc' then cr.last_sign_in_at end desc,
        case when v_sort_by = 'recipes_count' and v_sort_dir = 'asc' then cr.recipes_count end asc,
        case when v_sort_by = 'recipes_count' and v_sort_dir = 'desc' then cr.recipes_count end desc,
        cr.created_at desc,
        cr.id asc
    limit v_page_size
    offset v_offset;
end;
$$;

grant execute on function public.admin_get_users_page(integer, integer, text, text) to service_role;

comment on function public.admin_get_users_page(integer, integer, text, text) is
'Returns paginated admin users list with profile data and active recipes count. Sorting is allowlisted and deterministic.';
