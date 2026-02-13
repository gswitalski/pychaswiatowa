-- migration: fix app_role override in auth trigger and repair test admin role
-- description:
-- 1) update set_default_app_role() so it sets default only when app_role is missing
-- 2) ensure local test user test@pychaswiatowa.pl has app_role = admin

create or replace function public.set_default_app_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Set default app_role only when it is missing.
    if coalesce(new.raw_app_meta_data, '{}'::jsonb)->>'app_role' is null then
        new.raw_app_meta_data = jsonb_set(
            coalesce(new.raw_app_meta_data, '{}'::jsonb),
            '{app_role}',
            '"user"'::jsonb,
            true
        );
    end if;

    return new;
exception
    when others then
        -- Log error but don't prevent user creation.
        raise warning 'Could not set app_role for user %: %', new.id, sqlerrm;
        return new;
end;
$$;

comment on function public.set_default_app_role() is
    'Sets default app_role=user in raw_app_meta_data only when app_role is missing.';

-- One-off repair for local/dev test admin account.
update auth.users
set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{app_role}',
    '"admin"'::jsonb,
    true
)
where lower(email) = 'test@pychaswiatowa.pl';
