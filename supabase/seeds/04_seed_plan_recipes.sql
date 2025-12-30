-- migration: seed plan_recipes
-- description: populates the plan_recipes table with sample recipes for test user's plan
-- tables affected: plan_recipes
-- dependencies: plan_recipes table, recipes table, auth.users table
-- note: seeds plan for user test@pychaswiatowa.pl (c553b8d1-3dbb-488f-b610-97eb6f95d357)
--       adds a diverse set of ~7-10 recipes to demonstrate the "My Plan" feature
--       includes mix of PUBLIC, SHARED, and PRIVATE recipes from various categories

-- Add recipes to user's plan
do $$
declare
    target_user_id uuid := 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
    recipe_count int;
begin
    -- verify that user exists
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User with id % does not exist', target_user_id;
    end if;

    -- verify that plan_recipes table exists
    if not exists (
        select 1 from information_schema.tables
        where table_schema = 'public'
        and table_name = 'plan_recipes'
    ) then
        raise exception 'Table plan_recipes does not exist';
    end if;

    -- clear existing plan items for this user (for idempotent seeding)
    delete from public.plan_recipes where user_id = target_user_id;

    -- Add recipes to plan
    -- We're adding a mix of different recipe types to showcase the feature

    -- Recipe 1: Bigos (PUBLIC, Danie główne)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Bigos') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Bigos'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 2: Żurek (PUBLIC, Zupa)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Żurek') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Żurek'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 3: Kotlet schabowy (SHARED, Danie główne)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kotlet schabowy') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Kotlet schabowy'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 4: Pierogi ruskie (SHARED, Danie główne)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Pierogi ruskie') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Pierogi ruskie'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 5: Szarlotka (SHARED, Deser)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Szarlotka') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Szarlotka'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 6: Sernik na zimno (PRIVATE, Deser)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Sernik na zimno') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Sernik na zimno'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 7: Gołąbki (PUBLIC, Danie główne)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Gołąbki') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Gołąbki'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 8: Jajecznica (PUBLIC, Śniadanie)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Jajecznica') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Jajecznica'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 9: Rosół (PRIVATE, Zupa)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Rosół') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Rosół'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Recipe 10: Kurczak curry (PUBLIC/SHARED, Danie główne)
    if exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kurczak curry') then
        insert into public.plan_recipes (user_id, recipe_id)
        select target_user_id, id
        from public.recipes
        where user_id = target_user_id and name = 'Kurczak curry'
        on conflict (user_id, recipe_id) do nothing;
    end if;

    -- Count and report
    select count(*) into recipe_count
    from public.plan_recipes
    where user_id = target_user_id;

    raise notice 'Plan seeded successfully for user % with % recipes',
        target_user_id, recipe_count;
end;
$$;

