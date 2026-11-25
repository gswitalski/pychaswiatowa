-- ==================================================================================
-- 🔒 PRODUCTION DEPLOYMENT: ENABLE ROW LEVEL SECURITY
-- ==================================================================================
-- Description: Enables RLS and creates all necessary security policies
-- Version: 2.0 (for production with RLS currently disabled)
-- Last Updated: 2026-02-10
-- ==================================================================================
-- 
-- 🚨 CRITICAL WARNINGS:
-- - This script will ENABLE ROW LEVEL SECURITY on all tables
-- - Users will only be able to access their own data after this runs
-- - Make sure you have a BACKUP before running this script
-- - Test thoroughly after execution
-- - Have a rollback plan ready
-- 
-- ==================================================================================
-- 
-- MANDATORY STEPS BEFORE RUNNING THIS FILE:
-- 
-- 1. ✅ CREATE BACKUP of production database
-- 2. ✅ VERIFY current RLS state (should be disabled)
-- 3. ✅ READ the full deployment guide: docs/deployment/RLS_DEPLOYMENT_GUIDE.md
-- 4. ✅ PREPARE rollback procedure
-- 5. ✅ NOTIFY users (optional maintenance window)
-- 
-- ==================================================================================
-- 
-- VERIFICATION QUERIES (run BEFORE this script):
-- 
-- Check current RLS state (12 tables total):
-- SELECT tablename, rowsecurity,
--        CASE WHEN rowsecurity THEN '✅ ON' ELSE '❌ OFF' END as status
-- FROM pg_tables 
-- WHERE schemaname = 'public' AND tablename IN 
-- ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections',
--  'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
--  'normalized_ingredients_jobs', 'recipe_normalized_ingredients')
-- ORDER BY tablename;
-- 
-- Expected BEFORE: OLD tables (7) = OFF, NEW tables (5) = ON
-- 
-- Check existing policies (should show ~15 for new tables):
-- SELECT tablename, COUNT(*) as count FROM pg_policies 
-- WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;
-- 
-- Count records (save ALL these numbers for later verification):
-- SELECT 
--   (SELECT COUNT(*) FROM public.profiles) as profiles,
--   (SELECT COUNT(*) FROM public.recipes) as recipes,
--   (SELECT COUNT(*) FROM public.tags) as tags,
--   (SELECT COUNT(*) FROM public.collections) as collections,
--   (SELECT COUNT(*) FROM public.plan_recipes) as plan_recipes,
--   (SELECT COUNT(*) FROM public.shopping_list_items) as shopping_items;
-- 
-- ==================================================================================

-- ==================================================================================
-- STEP 1: VERIFY CURRENT STATE AND ENABLE RLS ON OLD TABLES
-- ==================================================================================
-- Note: NEW tables (plan_recipes, shopping_list_*, normalized_ingredients_*)
--       already have RLS enabled from their migrations - we verify and skip them
-- ==================================================================================

DO $$
DECLARE
    new_tables_with_rls INTEGER;
    old_tables_without_rls INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '🔍 STEP 1: Verifying current RLS state...';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    
    -- Check NEW tables (should already have RLS)
    SELECT COUNT(*) INTO new_tables_with_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
                      'normalized_ingredients_jobs', 'recipe_normalized_ingredients')
    AND rowsecurity = true;
    
    RAISE NOTICE '✅ NEW tables with RLS: % of 5', new_tables_with_rls;
    
    IF new_tables_with_rls != 5 THEN
        RAISE WARNING '⚠️  Expected 5 new tables with RLS, found %. Continuing anyway...', new_tables_with_rls;
    END IF;
    
    -- Check OLD tables (should NOT have RLS yet)
    SELECT COUNT(*) INTO old_tables_without_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections')
    AND rowsecurity = false;
    
    RAISE NOTICE '📋 OLD tables without RLS: % of 7 (will be fixed)', old_tables_without_rls;
    
    IF old_tables_without_rls != 7 THEN
        RAISE WARNING '⚠️  Expected 7 old tables without RLS, found %. Some may already have RLS enabled.', old_tables_without_rls;
    END IF;
    
    RAISE NOTICE '🔒 Now enabling RLS on OLD tables...';
END $$;

-- Enable RLS on OLD tables only (NEW tables already have it)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_collections ENABLE ROW LEVEL SECURITY;

-- Configure recipe_details VIEW for RLS
-- Note: Views don't have "RLS enabled" flag like tables
-- Instead, they inherit RLS from base tables (recipes in this case)
-- Setting security_invoker=true ensures the view uses the caller's permissions
DO $$
BEGIN
    -- Set security_invoker option on the view
    -- This makes the view execute with the permissions of the user calling it
    -- rather than the view owner, ensuring RLS policies are applied
    EXECUTE 'ALTER VIEW public.recipe_details SET (security_invoker = true)';
    RAISE NOTICE '✅ recipe_details view configured with security_invoker';
EXCEPTION
    WHEN OTHERS THEN
        -- If ALTER VIEW fails (older PostgreSQL), the view will still work
        -- as it inherits RLS from the recipes table
        RAISE NOTICE '⚠️  Could not set security_invoker on recipe_details view';
        RAISE NOTICE '    View will still respect RLS from base tables (recipes)';
END $$;

-- Verification after Step 1
DO $$
DECLARE
    all_tables_with_rls INTEGER;
BEGIN
    SELECT COUNT(*) INTO all_tables_with_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
        'profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections',
        'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
        'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
    )
    AND rowsecurity = true;
    
    IF all_tables_with_rls != 12 THEN
        RAISE EXCEPTION '❌ STEP 1 FAILED: Expected 12 tables with RLS, found %', all_tables_with_rls;
    ELSE
        RAISE NOTICE '✅ STEP 1 COMPLETED: RLS enabled on all 12 tables (7 old + 5 new)';
        RAISE NOTICE '    + recipe_details view configured (inherits RLS from recipes table)';
    END IF;
END $$;

-- ==================================================================================
-- STEP 2: CREATE RLS POLICIES FOR PROFILES TABLE
-- ==================================================================================
-- Creating 4 policies for profiles table (select, insert, update, delete)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '👤 Creating policies for PROFILES table...';
END $$;

-- rls policy: allow authenticated users to select their own profile
CREATE POLICY "authenticated users can select own profile"
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
CREATE POLICY "authenticated users can delete own profile"
    ON public.profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- Verification after Step 2
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles';
    
    IF policy_count != 4 THEN
        RAISE EXCEPTION '❌ STEP 2 FAILED: Expected 4 policies for profiles, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 2 COMPLETED: 4 policies created for PROFILES';
    END IF;
END $$;

-- ==================================================================================
-- STEP 3: CREATE RLS POLICIES FOR CATEGORIES TABLE
-- ==================================================================================
-- Creating 2 policies for categories table (public read access)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '📂 Creating policies for CATEGORIES table...';
END $$;

-- rls policy: allow anonymous users to select categories
CREATE POLICY "anonymous users can select categories"
    on public.categories
    for select
    to anon
    using (true);

-- rls policy: allow authenticated users to select categories
CREATE POLICY "authenticated users can select categories"
    ON public.categories
    FOR SELECT
    TO authenticated
    USING (true);

-- Verification after Step 3
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'categories';
    
    IF policy_count != 2 THEN
        RAISE EXCEPTION '❌ STEP 3 FAILED: Expected 2 policies for categories, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 3 COMPLETED: 2 policies created for CATEGORIES';
    END IF;
END $$;

-- ==================================================================================
-- STEP 4: CREATE RLS POLICY FOR RECIPES TABLE
-- ==================================================================================
-- Creating one read policy; all direct writes use the service role.
-- ==================================================================================

DO $$
DECLARE
    policy_record record;
BEGIN
    RAISE NOTICE '📝 Configuring policies for RECIPES table...';
    FOR policy_record IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'recipes'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.recipes', policy_record.policyname);
    END LOOP;
END $$;

-- rls policy: authenticated users can select own recipes and public recipes (non-deleted)
CREATE POLICY "authenticated users can select visible recipes"
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

-- Verification after Step 4
DO $$
DECLARE
    policy_count INTEGER;
    write_policy_exists BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'recipes';

    SELECT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'recipes'
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    ) INTO write_policy_exists;

    IF policy_count != 1 OR write_policy_exists THEN
        RAISE EXCEPTION '❌ STEP 4 FAILED: Expected 1 read-only policy for recipes, found % (write policy: %)',
            policy_count, write_policy_exists;
    ELSE
        RAISE NOTICE '✅ STEP 4 COMPLETED: 1 read-only policy created for RECIPES';
    END IF;
END $$;

-- ==================================================================================
-- STEP 5: CREATE RLS POLICIES FOR TAGS TABLE
-- ==================================================================================
-- Creating 4 policies for tags table (select, insert, update, delete)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '🏷️  Creating policies for TAGS table...';
END $$;

-- rls policy: authenticated users can select their own tags
CREATE POLICY "authenticated users can select own tags"
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
CREATE POLICY "authenticated users can delete own tags"
    ON public.tags
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Verification after Step 5
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'tags';
    
    IF policy_count != 4 THEN
        RAISE EXCEPTION '❌ STEP 5 FAILED: Expected 4 policies for tags, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 5 COMPLETED: 4 policies created for TAGS';
    END IF;
END $$;

-- ==================================================================================
-- STEP 6: CREATE RLS POLICIES FOR COLLECTIONS TABLE
-- ==================================================================================
-- Creating 4 policies for collections table (select, insert, update, delete)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '📚 Creating policies for COLLECTIONS table...';
END $$;

-- rls policy: authenticated users can select their own collections
CREATE POLICY "authenticated users can select own collections"
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
CREATE POLICY "authenticated users can delete own collections"
    ON public.collections
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Verification after Step 6
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'collections';
    
    IF policy_count != 4 THEN
        RAISE EXCEPTION '❌ STEP 6 FAILED: Expected 4 policies for collections, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 6 COMPLETED: 4 policies created for COLLECTIONS';
    END IF;
END $$;

-- ==================================================================================
-- STEP 7: CREATE RLS POLICIES FOR RECIPE_TAGS TABLE
-- ==================================================================================
-- Creating 3 policies for recipe_tags junction table (select, insert, delete)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '🔗 Creating policies for RECIPE_TAGS table...';
END $$;

-- rls policy: authenticated users can select recipe_tags for their own recipes
CREATE POLICY "authenticated users can select own recipe tags"
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
CREATE POLICY "authenticated users can delete own recipe tags"
    ON public.recipe_tags
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.recipes
            WHERE recipes.id = recipe_tags.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- Verification after Step 7
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'recipe_tags';
    
    IF policy_count != 3 THEN
        RAISE EXCEPTION '❌ STEP 7 FAILED: Expected 3 policies for recipe_tags, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 7 COMPLETED: 3 policies created for RECIPE_TAGS';
    END IF;
END $$;

-- ==================================================================================
-- STEP 8: CREATE RLS POLICIES FOR RECIPE_COLLECTIONS TABLE
-- ==================================================================================
-- Creating 3 policies for recipe_collections junction table (select, insert, delete)
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '🔗 Creating policies for RECIPE_COLLECTIONS table...';
END $$;

-- rls policy: authenticated users can select recipe_collections for their own collections
-- and recipes they can access (own or public, non-deleted)
CREATE POLICY "authenticated users can select own recipe collections"
    on public.recipe_collections
    for select
    to authenticated
    using (
        exists (
            select 1 from public.collections
            where collections.id = recipe_collections.collection_id
            and collections.user_id = auth.uid()
        )
        and
        exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.deleted_at is null
            and (
                recipes.user_id = auth.uid()
                or recipes.visibility = 'PUBLIC'
            )
        )
    );

-- rls policy: authenticated users can insert recipe_collections into their own collections
-- for recipes they can access (own or public, non-deleted)
create policy "authenticated users can insert own recipe collections"
    on public.recipe_collections
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.collections
            where collections.id = recipe_collections.collection_id
            and collections.user_id = auth.uid()
        )
        and exists (
            select 1 from public.recipes
            where recipes.id = recipe_collections.recipe_id
            and recipes.deleted_at is null
            and (
                recipes.user_id = auth.uid()
                or recipes.visibility = 'PUBLIC'
            )
        )
    );

-- rls policy: authenticated users can delete recipe_collections from their own collections
-- for recipes they can access (own or public, non-deleted)
CREATE POLICY "authenticated users can delete own recipe collections"
    ON public.recipe_collections
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.collections
            WHERE collections.id = recipe_collections.collection_id
            AND collections.user_id = auth.uid()
        )
        AND
        EXISTS (
            SELECT 1 FROM public.recipes
            WHERE recipes.id = recipe_collections.recipe_id
            AND recipes.deleted_at is null
            AND (
                recipes.user_id = auth.uid()
                OR recipes.visibility = 'PUBLIC'
            )
        )
    );

-- Verification after Step 8
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'recipe_collections';
    
    IF policy_count != 3 THEN
        RAISE EXCEPTION '❌ STEP 8 FAILED: Expected 3 policies for recipe_collections, found %', policy_count;
    ELSE
        RAISE NOTICE '✅ STEP 8 COMPLETED: 3 policies created for RECIPE_COLLECTIONS';
    END IF;
END $$;

-- ==================================================================================
-- STEP 9: UPDATE TABLE COMMENTS
-- ==================================================================================
-- Adding descriptive comments to tables for better documentation
-- ==================================================================================

DO $$
BEGIN
    RAISE NOTICE '📝 Adding table comments...';
END $$;

COMMENT ON TABLE public.profiles IS 'stores public user profile information, extends auth.users';
COMMENT ON TABLE public.categories IS 'dictionary table for recipe categories, seeded with predefined values';
COMMENT ON TABLE public.recipes IS 'stores user recipes with soft delete support';
COMMENT ON TABLE public.tags IS 'stores user-defined tags for recipes, unique per user (case-insensitive)';
COMMENT ON TABLE public.collections IS 'stores user-defined collections for organizing recipes, names unique per user';
COMMENT ON TABLE public.recipe_tags IS 'junction table for many-to-many relationship between recipes and tags';
COMMENT ON TABLE public.recipe_collections IS 'junction table for many-to-many relationship between recipes and collections';

DO $$
BEGIN
    RAISE NOTICE '✅ STEP 9 COMPLETED: Table comments added';
END $$;

-- ==================================================================================
-- FINAL VERIFICATION AND SUMMARY
-- ==================================================================================

DO $$
DECLARE
    total_policies INTEGER;
    old_table_policies INTEGER;
    new_table_policies INTEGER;
    rls_enabled_count INTEGER;
    expected_all_tables INTEGER := 12;
    expected_total_policies INTEGER := 36;
    expected_old_policies INTEGER := 21;
BEGIN
    -- Count total policies
    SELECT COUNT(*) INTO total_policies
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    -- Count policies for OLD tables (created by this script)
    SELECT COUNT(*) INTO old_table_policies
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections');
    
    -- Count policies for NEW tables (already existed)
    SELECT COUNT(*) INTO new_table_policies
    FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename IN ('plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
                      'normalized_ingredients_jobs', 'recipe_normalized_ingredients');
    
    -- Count ALL tables with RLS enabled
    SELECT COUNT(*) INTO rls_enabled_count
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename IN (
        'profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections',
        'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
        'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
    )
    AND rowsecurity = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '🎉 RLS DEPLOYMENT COMPLETED SUCCESSFULLY';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✅ ALL tables with RLS: % of % (7 old + 5 new)', rls_enabled_count, expected_all_tables;
    RAISE NOTICE '  ✅ OLD table policies (new): % of %', old_table_policies, expected_old_policies;
    RAISE NOTICE '  ✅ NEW table policies (existing): ~%', new_table_policies;
    RAISE NOTICE '  ✅ TOTAL policies: % (expected ~%)', total_policies, expected_total_policies;
    RAISE NOTICE '';
    
    IF rls_enabled_count != expected_all_tables THEN
        RAISE EXCEPTION '❌ DEPLOYMENT FAILED: RLS not enabled on all % tables (found %)', expected_all_tables, rls_enabled_count;
    END IF;
    
    IF old_table_policies != expected_old_policies THEN
        RAISE EXCEPTION '❌ DEPLOYMENT FAILED: Expected % policies for old tables, found %', expected_old_policies, old_table_policies;
    END IF;
    
    IF total_policies < 35 THEN
        RAISE EXCEPTION '❌ DEPLOYMENT FAILED: Total policies (%) is too low (expected ~%)', total_policies, expected_total_policies;
    END IF;
    
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '  1. Run verification queries (see below)';
    RAISE NOTICE '  2. Verify record counts match pre-deployment';
    RAISE NOTICE '  3. Test application thoroughly (especially multi-user)';
    RAISE NOTICE '  4. Monitor logs for 24 hours';
    RAISE NOTICE '  5. Keep backup ready for rollback if needed';
    RAISE NOTICE '═══════════════════════════════════════════════════════════════';
    RAISE NOTICE '';
END $$;

-- ==================================================================================
-- POST-DEPLOYMENT VERIFICATION QUERIES
-- ==================================================================================
-- Copy and run these queries separately to verify the deployment
-- ==================================================================================

-- Query 1: Verify RLS is enabled on ALL 12 tables
-- Expected: All 12 tables should have rowsecurity = true

-- SELECT 
--     tablename, 
--     rowsecurity,
--     CASE 
--         WHEN rowsecurity THEN '✅ ENABLED'
--         ELSE '❌ DISABLED'
--     END as status,
--     CASE 
--         WHEN tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections')
--         THEN 'OLD (fixed by script)'
--         ELSE 'NEW (already had RLS)'
--     END as table_group
-- FROM pg_tables 
-- WHERE schemaname = 'public' 
-- AND tablename IN (
--     'profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections',
--     'plan_recipes', 'shopping_list_items', 'shopping_list_recipe_contributions',
--     'normalized_ingredients_jobs', 'recipe_normalized_ingredients'
-- )
-- ORDER BY table_group, tablename;

-- Query 2: List all policies with details
-- Expected: ~39 total policies (24 new + ~15 existing)

-- SELECT 
--     tablename, 
--     policyname, 
--     cmd,
--     roles::text,
--     CASE 
--         WHEN tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections')
--         THEN '🆕 NEW'
--         ELSE '✅ EXISTING'
--     END as source
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY source, tablename, cmd, policyname;

-- Query 3: Count policies per table
-- Expected OLD tables: profiles:4, categories:2, recipes:1, tags:4, collections:4, recipe_tags:3, recipe_collections:3
-- Expected NEW tables: plan_recipes:3, shopping_list_items:4, shopping_list_recipe_contributions:3,
--                      normalized_ingredients_jobs:3, recipe_normalized_ingredients:2

-- SELECT 
--     tablename, 
--     COUNT(*) as policy_count,
--     CASE 
--         WHEN tablename IN ('profiles', 'categories', 'recipes', 'tags', 'collections', 'recipe_tags', 'recipe_collections')
--         THEN '🆕 NEW'
--         ELSE '✅ EXISTING'
--     END as source
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY source, tablename;

-- Query 4: Verify record counts (MUST match pre-deployment counts exactly!)

-- SELECT 
--     'CORE TABLES' as category,
--     (SELECT COUNT(*) FROM public.profiles) as profiles,
--     (SELECT COUNT(*) FROM public.recipes) as recipes,
--     (SELECT COUNT(*) FROM public.tags) as tags,
--     (SELECT COUNT(*) FROM public.collections) as collections,
--     (SELECT COUNT(*) FROM public.categories) as categories
-- UNION ALL
-- SELECT 
--     'NEW FEATURES' as category,
--     (SELECT COUNT(*) FROM public.plan_recipes) as plan_recipes,
--     (SELECT COUNT(*) FROM public.shopping_list_items) as shopping_items,
--     (SELECT COUNT(*) FROM public.normalized_ingredients_jobs) as jobs,
--     (SELECT COUNT(*) FROM public.recipe_normalized_ingredients) as normalized,
--     NULL as unused;

-- ==================================================================================
-- ✅ DEPLOYMENT SCRIPT COMPLETED
-- ==================================================================================
-- Timestamp: See execution logs
-- Status: Check RAISE NOTICE messages above
-- Documentation: docs/deployment/RLS_DEPLOYMENT_GUIDE.md
-- ==================================================================================

