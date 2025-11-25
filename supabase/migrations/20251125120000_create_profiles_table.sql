-- migration: create profiles table
-- description: creates the profiles table that extends auth.users with public user data
-- tables affected: profiles
-- dependencies: auth.users (supabase managed)

-- create profiles table to store public user information
-- this table has a 1:1 relationship with auth.users
create table if not exists public.profiles (
    -- primary key that references auth.users for automatic cascade deletion
    id uuid primary key references auth.users(id) on delete cascade,
    
    -- username with length validation (3-50 characters)
    username text check (char_length(username) >= 3 and char_length(username) <= 50),
    
    -- timestamp for record creation
    created_at timestamptz not null default now(),
    
    -- timestamp for last update (will be managed by trigger)
    updated_at timestamptz not null default now()
);

-- enable row level security on profiles table
-- this ensures users can only access their own profile data
alter table public.profiles enable row level security;

-- rls policy: allow authenticated users to select their own profile
create policy "authenticated users can select own profile"
    on public.profiles
    for select
    to authenticated
    using (auth.uid() = id);

-- rls policy: allow authenticated users to insert their own profile
create policy "authenticated users can insert own profile"
    on public.profiles
    for insert
    to authenticated
    with check (auth.uid() = id);

-- rls policy: allow authenticated users to update their own profile
create policy "authenticated users can update own profile"
    on public.profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);

-- rls policy: allow authenticated users to delete their own profile
create policy "authenticated users can delete own profile"
    on public.profiles
    for delete
    to authenticated
    using (auth.uid() = id);

-- create function to automatically update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
    -- set updated_at to current timestamp whenever row is modified
    new.updated_at = now();
    return new;
end;
$$;

-- create trigger to automatically update updated_at on profiles
create trigger set_updated_at
    before update on public.profiles
    for each row
    execute function public.handle_updated_at();

-- add comment to table for documentation
comment on table public.profiles is 'stores public user profile information, extends auth.users';
comment on column public.profiles.id is 'user id, references auth.users';
comment on column public.profiles.username is 'public username, 3-50 characters';
comment on column public.profiles.created_at is 'timestamp when profile was created';
comment on column public.profiles.updated_at is 'timestamp when profile was last updated';

