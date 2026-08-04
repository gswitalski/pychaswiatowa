-- Migration: Atomic admin user role update with last-admin protection
-- Description: Updates app_role in auth.users.raw_app_meta_data and returns admin list row shape

create or replace function public.admin_update_user_role(
    p_target_user_id uuid,
    p_new_role text,
    p_actor_user_id uuid
)
returns table (
    id uuid,
    login text,
    username text,
    role text,
    created_at timestamptz,
    last_sign_in_at timestamptz,
    recipes_count bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
    v_current_role text;
    v_admin_count bigint;
begin
    if p_new_role not in ('user', 'premium', 'admin') then
        raise exception 'VALIDATION_ERROR: Invalid app_role value';
    end if;

    if p_target_user_id = p_actor_user_id then
        raise exception 'CONFLICT: Cannot change your own role';
    end if;

    perform pg_advisory_xact_lock(hashtext('admin_update_user_role'));

    select coalesce(au.raw_app_meta_data ->> 'app_role', 'user')
    into v_current_role
    from auth.users au
    where au.id = p_target_user_id
      and au.deleted_at is null;

    if not found then
        raise exception 'NOT_FOUND: User not found';
    end if;

    if v_current_role = 'admin' and p_new_role <> 'admin' then
        select count(*)::bigint
        into v_admin_count
        from auth.users au
        where au.deleted_at is null
          and coalesce(au.raw_app_meta_data ->> 'app_role', 'user') = 'admin';

        if v_admin_count <= 1 then
            raise exception 'CONFLICT: Cannot demote the last administrator';
        end if;
    end if;

    update auth.users
    set raw_app_meta_data = jsonb_set(
            coalesce(raw_app_meta_data, '{}'::jsonb),
            '{app_role}',
            to_jsonb(p_new_role)
        ),
        updated_at = now()
    where id = p_target_user_id
      and deleted_at is null;

    return query
    with recipes_agg as (
        select
            r.user_id,
            count(*)::bigint as recipes_count
        from public.recipes r
        where r.deleted_at is null
          and r.user_id = p_target_user_id
        group by r.user_id
    )
    select
        au.id,
        au.email::text as login,
        coalesce(p.username, '')::text as username,
        coalesce(au.raw_app_meta_data ->> 'app_role', 'user') as role,
        au.created_at,
        au.last_sign_in_at,
        coalesce(ra.recipes_count, 0)::bigint as recipes_count
    from auth.users au
    left join public.profiles p on p.id = au.id
    left join recipes_agg ra on ra.user_id = au.id
    where au.id = p_target_user_id;
end;
$$;

grant execute on function public.admin_update_user_role(uuid, text, uuid) to service_role;

comment on function public.admin_update_user_role(uuid, text, uuid) is
    'Updates a user app_role in auth.users with self-change and last-admin guards; service_role only.';
