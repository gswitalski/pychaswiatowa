-- migration: add app_role to JWT claims
-- description: adds custom app_role claim to JWT tokens for RBAC
-- tables affected: auth.users
-- dependencies: auth.users (supabase managed), profiles

-- NOTE: Supabase automatically includes raw_app_meta_data in JWT payload
-- We store app_role in raw_app_meta_data and Supabase exposes it as a claim

-- Function to set default app_role for new users
-- This function is called by a trigger after user creation
create or replace function public.set_default_app_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- Set default app_role to 'user' in raw_app_meta_data
    -- raw_app_meta_data is automatically included in JWT by Supabase
    new.raw_app_meta_data = jsonb_set(
        coalesce(new.raw_app_meta_data, '{}'::jsonb),
        '{app_role}',
        '"user"'::jsonb
    );

    return new;
exception
    when others then
        -- Log error but don't prevent user creation
        raise warning 'Could not set app_role for user %: %', new.id, sqlerrm;
        return new;
end;
$$;

comment on function public.set_default_app_role() is
    'Sets default app_role=user in raw_app_meta_data for new users. This claim is automatically included in JWT by Supabase.';

-- Trigger to set default app_role for new users
-- This runs BEFORE the user is created, so we can modify metadata
drop trigger if exists on_auth_user_created_set_role on auth.users;
create trigger on_auth_user_created_set_role
    before insert on auth.users
    for each row
    execute function public.set_default_app_role();

-- Update existing users to have default app_role
-- This is safe to run multiple times (idempotent)
update auth.users
set raw_app_meta_data = jsonb_set(
    coalesce(raw_app_meta_data, '{}'::jsonb),
    '{app_role}',
    '"user"'::jsonb
)
where (raw_app_meta_data is null or raw_app_meta_data->>'app_role' is null);

