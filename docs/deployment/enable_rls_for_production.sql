-- ==================================================================================
-- PRODUCTION DEPLOYMENT: ENABLE ROW LEVEL SECURITY
-- ==================================================================================
-- description: re-enables row level security and creates all necessary policies
-- ⚠️ CRITICAL: RUN THIS BEFORE DEPLOYING TO PRODUCTION ⚠️
-- ==================================================================================

-- IMPORTANT STEPS BEFORE RUNNING THIS FILE:
-- 1. Delete the migration file: supabase/migrations/20251125121000_disable_rls_for_development.sql
-- 2. Run this SQL script in your production environment
-- 3. Test all RLS policies thoroughly before going live

-- ==================================================================================
-- STEP 1: ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ==================================================================================

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.recipes enable row level security;
alter table public.tags enable row level security;
alter table public.collections enable row level security;
alter table public.recipe_tags enable row level security;
alter table public.recipe_collections enable row level security;

-- ==================================================================================
-- STEP 2: CREATE RLS POLICIES FOR PROFILES TABLE
-- ==================================================================================

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

-- ==================================================================================
-- STEP 3: CREATE RLS POLICIES FOR CATEGORIES TABLE
-- ==================================================================================

-- rls policy: allow anonymous users to select categories
create policy "anonymous users can select categories"
    on public.categories
    for select
    to anon
    using (true);

-- rls policy: allow authenticated users to select categories
create policy "authenticated users can select categories"
    on public.categories
    for select
    to authenticated
    using (true);

-- ==================================================================================
-- STEP 4: CREATE RLS POLICIES FOR RECIPES TABLE
-- ==================================================================================

-- rls policy: authenticated users can select their own non-deleted recipes
create policy "authenticated users can select own recipes"
    on public.recipes
    for select
    to authenticated
    using (auth.uid() = user_id and deleted_at is null);

-- rls policy: authenticated users can insert their own recipes
create policy "authenticated users can insert own recipes"
    on public.recipes
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can update their own recipes
create policy "authenticated users can update own recipes"
    on public.recipes
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can delete their own recipes
create policy "authenticated users can delete own recipes"
    on public.recipes
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- ==================================================================================
-- STEP 5: CREATE RLS POLICIES FOR TAGS TABLE
-- ==================================================================================

-- rls policy: authenticated users can select their own tags
create policy "authenticated users can select own tags"
    on public.tags
    for select
    to authenticated
    using (auth.uid() = user_id);

-- rls policy: authenticated users can insert their own tags
create policy "authenticated users can insert own tags"
    on public.tags
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can update their own tags
create policy "authenticated users can update own tags"
    on public.tags
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can delete their own tags
create policy "authenticated users can delete own tags"
    on public.tags
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- ==================================================================================
-- STEP 6: CREATE RLS POLICIES FOR COLLECTIONS TABLE
-- ==================================================================================

-- rls policy: authenticated users can select their own collections
create policy "authenticated users can select own collections"
    on public.collections
    for select
    to authenticated
    using (auth.uid() = user_id);

-- rls policy: authenticated users can insert their own collections
create policy "authenticated users can insert own collections"
    on public.collections
    for insert
    to authenticated
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can update their own collections
create policy "authenticated users can update own collections"
    on public.collections
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- rls policy: authenticated users can delete their own collections
create policy "authenticated users can delete own collections"
    on public.collections
    for delete
    to authenticated
    using (auth.uid() = user_id);

-- ==================================================================================
-- STEP 7: CREATE RLS POLICIES FOR RECIPE_TAGS TABLE
-- ==================================================================================

-- rls policy: authenticated users can select recipe_tags for their own recipes
create policy "authenticated users can select own recipe tags"
    on public.recipe_tags
    for select
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can insert recipe_tags for their own recipes and tags
create policy "authenticated users can insert own recipe tags"
    on public.recipe_tags
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
        and exists (
            select 1 from public.tags
            where tags.id = recipe_tags.tag_id
            and tags.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can delete recipe_tags for their own recipes
create policy "authenticated users can delete own recipe tags"
    on public.recipe_tags
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_tags.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- ==================================================================================
-- STEP 8: CREATE RLS POLICIES FOR RECIPE_COLLECTIONS TABLE
-- ==================================================================================

-- rls policy: authenticated users can select recipe_collections for their own recipes
create policy "authenticated users can select own recipe collections"
    on public.recipe_collections
    for select
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can insert recipe_collections for their own recipes and collections
create policy "authenticated users can insert own recipe collections"
    on public.recipe_collections
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
        and exists (
            select 1 from public.collections
            where collections.id = recipe_collections.collection_id
            and collections.user_id = auth.uid()
        )
    );

-- rls policy: authenticated users can delete recipe_collections for their own recipes
create policy "authenticated users can delete own recipe collections"
    on public.recipe_collections
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.user_id = auth.uid()
        )
    );

-- ==================================================================================
-- STEP 9: UPDATE TABLE COMMENTS
-- ==================================================================================

comment on table public.profiles is 'stores public user profile information, extends auth.users';
comment on table public.categories is 'dictionary table for recipe categories, seeded with predefined values';
comment on table public.recipes is 'stores user recipes with soft delete support';
comment on table public.tags is 'stores user-defined tags for recipes, unique per user (case-insensitive)';
comment on table public.collections is 'stores user-defined collections for organizing recipes, names unique per user';
comment on table public.recipe_tags is 'junction table for many-to-many relationship between recipes and tags';
comment on table public.recipe_collections is 'junction table for many-to-many relationship between recipes and collections';

-- ==================================================================================
-- VERIFICATION QUERIES
-- ==================================================================================
-- Run these queries to verify RLS is properly enabled:

-- Check if RLS is enabled on all tables
-- SELECT tablename, rowsecurity 
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections');

-- List all policies
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ==================================================================================
-- ✅ RLS ENABLED SUCCESSFULLY
-- ==================================================================================

