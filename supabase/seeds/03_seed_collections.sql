-- seed: collections with recipe associations
-- description: creates sample collections and assigns recipes to them
-- tables affected: collections, recipe_collections
-- dependencies: collections table, recipe_collections table, seeded recipes
-- note: seeds collections for user with id c553b8d1-3dbb-488f-b610-97eb6f95d357
--       checks if collections already exist before inserting to make seed idempotent

do $$
declare
    target_user_id uuid := 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
    collection_polskie_id bigint;
    collection_szybkie_id bigint;

    -- recipe ids (will be populated from database)
    recipe_bigos_id bigint;
    recipe_szarlotka_id bigint;
    recipe_rosol_id bigint;
    recipe_jajecznica_id bigint;
    recipe_pierogi_id bigint;
    recipe_zurek_id bigint;
    recipe_nalesniki_id bigint;
    recipe_kotlet_id bigint;
    recipe_golabki_id bigint;
    recipe_sernik_id bigint;
    recipe_leniwe_id bigint;
    recipe_chlodnik_id bigint;
    recipe_placki_id bigint;
    recipe_shakshuka_id bigint;
    recipe_smoothie_id bigint;
begin
    -- verify that user exists
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User with id % does not exist', target_user_id;
    end if;

    -- get recipe IDs for the target user
    select id into recipe_bigos_id from public.recipes where user_id = target_user_id and name = 'Bigos' limit 1;
    select id into recipe_szarlotka_id from public.recipes where user_id = target_user_id and name = 'Szarlotka' limit 1;
    select id into recipe_rosol_id from public.recipes where user_id = target_user_id and name = 'Rosół' limit 1;
    select id into recipe_jajecznica_id from public.recipes where user_id = target_user_id and name = 'Jajecznica' limit 1;
    select id into recipe_pierogi_id from public.recipes where user_id = target_user_id and name = 'Pierogi ruskie' limit 1;
    select id into recipe_zurek_id from public.recipes where user_id = target_user_id and name = 'Żurek' limit 1;
    select id into recipe_nalesniki_id from public.recipes where user_id = target_user_id and name = 'Naleśniki' limit 1;
    select id into recipe_kotlet_id from public.recipes where user_id = target_user_id and name = 'Kotlet schabowy' limit 1;
    select id into recipe_golabki_id from public.recipes where user_id = target_user_id and name = 'Gołąbki' limit 1;
    select id into recipe_sernik_id from public.recipes where user_id = target_user_id and name = 'Sernik na zimno' limit 1;
    select id into recipe_leniwe_id from public.recipes where user_id = target_user_id and name = 'Leniwe pierogi' limit 1;
    select id into recipe_chlodnik_id from public.recipes where user_id = target_user_id and name = 'Chłodnik litewski' limit 1;
    select id into recipe_placki_id from public.recipes where user_id = target_user_id and name = 'Placki ziemniaczane' limit 1;
    select id into recipe_shakshuka_id from public.recipes where user_id = target_user_id and name = 'Shakshuka' limit 1;
    select id into recipe_smoothie_id from public.recipes where user_id = target_user_id and name = 'Smoothie bowl truskawkowe' limit 1;

    -- collection 1: Klasyki polskiej kuchni
    if not exists (
        select 1 from public.collections
        where user_id = target_user_id and name = 'Klasyki polskiej kuchni'
    ) then
        insert into public.collections (
            user_id,
            name,
            description
        ) values (
            target_user_id,
            'Klasyki polskiej kuchni',
            'Zbiór najpopularniejszych tradycyjnych przepisów polskich, które każdy powinien znać. Od bigosów po pierogi - pełna gama klasyki.'
        )
        returning id into collection_polskie_id;

        -- add recipes to the collection
        -- only add if recipe exists
        if recipe_bigos_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_bigos_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_rosol_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_rosol_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_pierogi_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_pierogi_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_zurek_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_zurek_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_kotlet_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_kotlet_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_golabki_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_golabki_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_chlodnik_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_chlodnik_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_placki_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_placki_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_szarlotka_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_szarlotka_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_nalesniki_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_nalesniki_id, collection_polskie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        raise notice 'Collection "Klasyki polskiej kuchni" created with recipes';
    else
        select id into collection_polskie_id
        from public.collections
        where user_id = target_user_id and name = 'Klasyki polskiej kuchni';
        raise notice 'Collection "Klasyki polskiej kuchni" already exists';
    end if;

    -- collection 2: Szybkie śniadania
    if not exists (
        select 1 from public.collections
        where user_id = target_user_id and name = 'Szybkie śniadania'
    ) then
        insert into public.collections (
            user_id,
            name,
            description
        ) values (
            target_user_id,
            'Szybkie śniadania',
            'Przepisy na pyszne i zdrowe śniadania, które przygotujesz w mniej niż 15 minut. Idealne na zabiegany poranek!'
        )
        returning id into collection_szybkie_id;

        -- add recipes to the collection
        -- only add if recipe exists
        if recipe_jajecznica_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_jajecznica_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_nalesniki_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_nalesniki_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_leniwe_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_leniwe_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_shakshuka_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_shakshuka_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_smoothie_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_smoothie_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        raise notice 'Collection "Szybkie śniadania" created with recipes';
    else
        select id into collection_szybkie_id
        from public.collections
        where user_id = target_user_id and name = 'Szybkie śniadania';
        raise notice 'Collection "Szybkie śniadania" already exists';
    end if;

end $$;

-- ============================================================================
-- SEEDING COLLECTIONS FOR test2@pychaswiatowa.pl
-- ============================================================================

do $$
declare
    target_user_id uuid := '6e2596af-e62a-4be6-93fc-680f8b83dc06';
    other_user_id uuid := 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
    collection_azjatycka_id bigint;
    collection_szybkie_id bigint;

    -- test2's recipe ids
    recipe_tomyum_id bigint;
    recipe_padthai_id bigint;
    recipe_ramen_id bigint;
    recipe_quesadilla_id bigint;
    recipe_lasagne_id bigint;
    recipe_pancakes_id bigint;

    -- test's PUBLIC recipe ids (to add to test2's collections)
    recipe_kurczak_curry_id bigint;
    recipe_risotto_id bigint;
    recipe_spaghetti_carbonara_id bigint;
    recipe_kotlet_id bigint;
    recipe_placki_id bigint;
    recipe_shakshuka_id bigint;
begin
    -- verify that users exist
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User test2 with id % does not exist', target_user_id;
    end if;

    if not exists (select 1 from auth.users where id = other_user_id) then
        raise exception 'User test with id % does not exist', other_user_id;
    end if;

    -- get test2's recipe IDs
    select id into recipe_tomyum_id from public.recipes where user_id = target_user_id and name = 'Tom Yum' limit 1;
    select id into recipe_padthai_id from public.recipes where user_id = target_user_id and name = 'Pad Thai' limit 1;
    select id into recipe_ramen_id from public.recipes where user_id = target_user_id and name = 'Ramen domowy' limit 1;
    select id into recipe_quesadilla_id from public.recipes where user_id = target_user_id and name = 'Quesadilla z kurczakiem' limit 1;
    select id into recipe_lasagne_id from public.recipes where user_id = target_user_id and name = 'Lasagne' limit 1;
    select id into recipe_pancakes_id from public.recipes where user_id = target_user_id and name = 'Pancakes amerykańskie' limit 1;

    -- get test's PUBLIC recipe IDs
    select id into recipe_kurczak_curry_id from public.recipes where user_id = other_user_id and name = 'Kurczak curry' and visibility = 'PUBLIC' limit 1;
    select id into recipe_risotto_id from public.recipes where user_id = other_user_id and name = 'Risotto z grzybami' and visibility = 'PUBLIC' limit 1;
    select id into recipe_spaghetti_carbonara_id from public.recipes where user_id = other_user_id and name = 'Spaghetti carbonara' and visibility = 'PUBLIC' limit 1;
    select id into recipe_kotlet_id from public.recipes where user_id = other_user_id and name = 'Kotlet schabowy' and visibility = 'PUBLIC' limit 1;
    select id into recipe_placki_id from public.recipes where user_id = other_user_id and name = 'Placki ziemniaczane' and visibility = 'PUBLIC' limit 1;
    select id into recipe_shakshuka_id from public.recipes where user_id = other_user_id and name = 'Shakshuka' and visibility = 'PUBLIC' limit 1;

    -- collection 1: Kuchnia azjatycka
    if not exists (
        select 1 from public.collections
        where user_id = target_user_id and name = 'Kuchnia azjatycka'
    ) then
        insert into public.collections (
            user_id,
            name,
            description
        ) values (
            target_user_id,
            'Kuchnia azjatycka',
            'Moja kolekcja ulubionych przepisów z Azji - od tajskich zup po japońskie ramen.'
        )
        returning id into collection_azjatycka_id;

        -- add test2's asian recipes
        if recipe_tomyum_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_tomyum_id, collection_azjatycka_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_padthai_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_padthai_id, collection_azjatycka_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_ramen_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_ramen_id, collection_azjatycka_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        -- add test's curry recipe (public)
        if recipe_kurczak_curry_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_kurczak_curry_id, collection_azjatycka_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        raise notice 'Collection "Kuchnia azjatycka" created with recipes';
    else
        select id into collection_azjatycka_id
        from public.collections
        where user_id = target_user_id and name = 'Kuchnia azjatycka';
        raise notice 'Collection "Kuchnia azjatycka" already exists';
    end if;

    -- collection 2: Szybkie obiady
    if not exists (
        select 1 from public.collections
        where user_id = target_user_id and name = 'Szybkie obiady'
    ) then
        insert into public.collections (
            user_id,
            name,
            description
        ) values (
            target_user_id,
            'Szybkie obiady',
            'Sprawdzone przepisy na szybkie i pyszne obiady, gdy brakuje czasu na gotowanie.'
        )
        returning id into collection_szybkie_id;

        -- add test2's quick meal recipes
        if recipe_quesadilla_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_quesadilla_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_lasagne_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_lasagne_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        -- add test's public recipes
        if recipe_kotlet_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_kotlet_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_placki_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_placki_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        if recipe_shakshuka_id is not null then
            insert into public.recipe_collections (recipe_id, collection_id)
            values (recipe_shakshuka_id, collection_szybkie_id)
            on conflict (recipe_id, collection_id) do nothing;
        end if;

        raise notice 'Collection "Szybkie obiady" created with recipes';
    else
        select id into collection_szybkie_id
        from public.collections
        where user_id = target_user_id and name = 'Szybkie obiady';
        raise notice 'Collection "Szybkie obiady" already exists';
    end if;

end $$;
