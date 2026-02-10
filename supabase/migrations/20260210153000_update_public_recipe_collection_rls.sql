-- Migration: Allow users to manage collections for accessible public recipes
-- Context:
-- - API/PRD allows adding public recipes (from other authors) to user's own collections.
-- - Existing RLS policies on recipes/recipe_collections were owner-only and blocked this flow.
--
-- This migration updates:
-- 1) recipes SELECT policy -> own recipes OR public recipes (excluding soft-deleted)
-- 2) recipe_collections SELECT/INSERT/DELETE policies ->
--    allowed only for user's own collections and accessible recipes (own OR public, not deleted)

-- ==================================================================================
-- RECIPES: SELECT policy
-- ==================================================================================

drop policy if exists "authenticated users can select own recipes" on public.recipes;

create policy "authenticated users can select own recipes"
    on public.recipes
    for select
    to authenticated
    using (
        deleted_at is null
        and (
            auth.uid() = user_id
            or visibility = 'PUBLIC'
        )
    );

-- ==================================================================================
-- RECIPE_COLLECTIONS: SELECT/INSERT/DELETE policies
-- ==================================================================================

drop policy if exists "authenticated users can select own recipe collections"
    on public.recipe_collections;

create policy "authenticated users can select own recipe collections"
    on public.recipe_collections
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.collections
            where collections.id = recipe_collections.collection_id
              and collections.user_id = auth.uid()
        )
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_collections.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

drop policy if exists "authenticated users can insert own recipe collections"
    on public.recipe_collections;

create policy "authenticated users can insert own recipe collections"
    on public.recipe_collections
    for insert
    to authenticated
    with check (
        exists (
            select 1
            from public.collections
            where collections.id = recipe_collections.collection_id
              and collections.user_id = auth.uid()
        )
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_collections.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

drop policy if exists "authenticated users can delete own recipe collections"
    on public.recipe_collections;

create policy "authenticated users can delete own recipe collections"
    on public.recipe_collections
    for delete
    to authenticated
    using (
        exists (
            select 1
            from public.collections
            where collections.id = recipe_collections.collection_id
              and collections.user_id = auth.uid()
        )
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_collections.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );
