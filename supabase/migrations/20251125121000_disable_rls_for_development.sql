-- migration: disable rls for development
-- description: temporarily disables row level security and drops all policies for easier development
-- tables affected: profiles, categories, recipes, tags, collections, recipe_tags, recipe_collections
-- dependencies: all previous migrations
-- ⚠️ WARNING: THIS IS FOR DEVELOPMENT ONLY - DO NOT USE IN PRODUCTION ⚠️
-- note: see docs/deployment/enable_rls_for_production.sql for re-enabling RLS

-- ⚠️⚠️⚠️ DEVELOPMENT ONLY - REMOVE THIS MIGRATION BEFORE PRODUCTION DEPLOYMENT ⚠️⚠️⚠️

-- drop all rls policies from profiles table
drop policy if exists "authenticated users can select own profile" on public.profiles;
drop policy if exists "authenticated users can insert own profile" on public.profiles;
drop policy if exists "authenticated users can update own profile" on public.profiles;
drop policy if exists "authenticated users can delete own profile" on public.profiles;

-- drop all rls policies from categories table
drop policy if exists "anonymous users can select categories" on public.categories;
drop policy if exists "authenticated users can select categories" on public.categories;

-- drop all rls policies from recipes table
drop policy if exists "authenticated users can select own recipes" on public.recipes;
drop policy if exists "authenticated users can insert own recipes" on public.recipes;
drop policy if exists "authenticated users can update own recipes" on public.recipes;
drop policy if exists "authenticated users can delete own recipes" on public.recipes;

-- drop all rls policies from tags table
drop policy if exists "authenticated users can select own tags" on public.tags;
drop policy if exists "authenticated users can insert own tags" on public.tags;
drop policy if exists "authenticated users can update own tags" on public.tags;
drop policy if exists "authenticated users can delete own tags" on public.tags;

-- drop all rls policies from collections table
drop policy if exists "authenticated users can select own collections" on public.collections;
drop policy if exists "authenticated users can insert own collections" on public.collections;
drop policy if exists "authenticated users can update own collections" on public.collections;
drop policy if exists "authenticated users can delete own collections" on public.collections;

-- drop all rls policies from recipe_tags table
drop policy if exists "authenticated users can select own recipe tags" on public.recipe_tags;
drop policy if exists "authenticated users can insert own recipe tags" on public.recipe_tags;
drop policy if exists "authenticated users can delete own recipe tags" on public.recipe_tags;

-- drop all rls policies from recipe_collections table
drop policy if exists "authenticated users can select own recipe collections" on public.recipe_collections;
drop policy if exists "authenticated users can insert own recipe collections" on public.recipe_collections;
drop policy if exists "authenticated users can delete own recipe collections" on public.recipe_collections;

-- disable row level security on all tables
alter table public.profiles disable row level security;
alter table public.categories disable row level security;
alter table public.recipes disable row level security;
alter table public.tags disable row level security;
alter table public.collections disable row level security;
alter table public.recipe_tags disable row level security;
alter table public.recipe_collections disable row level security;

-- add comment
comment on table public.profiles is '⚠️ RLS DISABLED FOR DEVELOPMENT - profiles table';
comment on table public.categories is '⚠️ RLS DISABLED FOR DEVELOPMENT - categories table';
comment on table public.recipes is '⚠️ RLS DISABLED FOR DEVELOPMENT - recipes table';
comment on table public.tags is '⚠️ RLS DISABLED FOR DEVELOPMENT - tags table';
comment on table public.collections is '⚠️ RLS DISABLED FOR DEVELOPMENT - collections table';
comment on table public.recipe_tags is '⚠️ RLS DISABLED FOR DEVELOPMENT - recipe_tags table';
comment on table public.recipe_collections is '⚠️ RLS DISABLED FOR DEVELOPMENT - recipe_collections table';

