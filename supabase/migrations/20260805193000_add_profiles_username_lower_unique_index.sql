-- Enforce case-insensitive username uniqueness and speed up availability checks.
create unique index if not exists idx_profiles_username_lower
    on public.profiles (lower(username));
