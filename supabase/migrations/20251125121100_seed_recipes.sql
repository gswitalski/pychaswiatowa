-- migration: seed recipes
-- description: populates the recipes table with sample recipes for existing user
-- tables affected: recipes
-- dependencies: recipes table, categories table, parse_text_to_jsonb function
-- note: seeds recipes for user with id 141ebb08-699c-431e-a99d-6ea244d5dbda
--       checks if recipes already exist before inserting to make migration idempotent

-- variable to store user_id
do $$
declare
    target_user_id uuid := '141ebb08-699c-431e-a99d-6ea244d5dbda';
    category_obiad_id bigint;
    category_deser_id bigint;
    category_zupa_id bigint;
    category_sniadanie_id bigint;
begin
    -- verify that user exists
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User with id % does not exist', target_user_id;
    end if;

    -- get category IDs
    select id into category_obiad_id from public.categories where name = 'Obiad' limit 1;
    select id into category_deser_id from public.categories where name = 'Deser' limit 1;
    select id into category_zupa_id from public.categories where name = 'Zupa' limit 1;
    select id into category_sniadanie_id from public.categories where name = 'Śniadanie' limit 1;

    -- insert sample recipes (only if they don't already exist)
    -- recipe 1: Bigos
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Bigos') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps
        ) values (
            target_user_id,
            category_obiad_id,
            'Bigos',
            'Tradycyjna polska potrawa z kapusty i mięsa, idealna na chłodne dni.',
            public.parse_text_to_jsonb(
                '## Mięso
- 500g wieprzowiny (karkówka lub szynka)
- 200g kiełbasy
- 100g boczku wędzonego
## Warzywa
- 1 kg kapusty kiszonej
- 500g kapusty świeżej
- 2 cebule
- 2 łyżki koncentratu pomidorowego
## Przyprawy
- 2 liście laurowe
- 5 ziaren ziela angielskiego
- sól, pieprz
- 1 łyżka majeranku'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie
- Mięso pokrój na kawałki i podsmaż na patelni.
- Cebulę pokrój w kostkę i zeszklij na tłuszczu z mięsa.
- Kapustę kiszoną przepłucz i odciśnij, świeżą poszatkuj.
- Wszystko połącz w dużym garnku, dodaj przyprawy.
- Gotuj na małym ogniu przez 2-3 godziny, często mieszając.
- Pod koniec dodaj pokrojoną kiełbasę i boczek.
- Dopraw do smaku solą, pieprzem i majerankiem.'
            )
        );
    end if;

    -- recipe 2: Szarlotka
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Szarlotka') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps
        ) values (
            target_user_id,
            category_deser_id,
            'Szarlotka',
            'Klasyczne polskie ciasto z jabłkami, idealne na każdą okazję.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 300g mąki pszennej
- 200g masła
- 100g cukru
- 1 jajko
- 1 łyżeczka proszku do pieczenia
## Nadzienie
- 1 kg jabłek (najlepiej kwaśnych)
- 3 łyżki cukru
- 1 łyżeczka cynamonu
- 2 łyżki bułki tartej'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Masło pokrój w kostki i połącz z mąką, cukrem i proszkiem do pieczenia.
- Dodaj jajko i zagnieć ciasto.
- Podziel na 2 części (2/3 i 1/3), schłódź w lodówce.
## Przygotowanie nadzienia
- Jabłka obierz, usuń gniazda nasienne i pokrój w plastry.
- Wymieszaj z cukrem i cynamonem.
## Pieczenie
- Większą część ciasta rozwałkuj i ułóż na dnie formy (średnica 26cm).
- Posyp bułką tartą, ułóż jabłka.
- Rozwałkuj mniejszą część ciasta i przykryj jabłka.
- Piecz w temperaturze 180°C przez około 45 minut.'
            )
        );
    end if;

    -- recipe 3: Rosół
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Rosół') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps
        ) values (
            target_user_id,
            category_zupa_id,
            'Rosół',
            'Tradycyjna polska zupa, podstawa wielu dań. Idealny na niedzielny obiad.',
            public.parse_text_to_jsonb(
                '## Mięso
- 1 kg mięsa wołowego (np. mostek)
- 500g mięsa drobiowego (skrzydełka, nóżki)
## Warzywa
- 2 marchewki
- 1 pietruszka
- 1 seler
- 1 cebula
- 1 por
- 2 ząbki czosnku
## Przyprawy
- liść laurowy
- ziele angielskie
- sól, pieprz
- natka pietruszki'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie
- Mięso umyj i wrzuć do dużego garnka z zimną wodą.
- Gotuj na małym ogniu, zbierając szumowiny.
- Warzywa umyj, obierz i pokrój na większe kawałki.
- Po około godzinie dodaj warzywa i przyprawy.
- Gotuj jeszcze przez 1,5-2 godziny na małym ogniu.
- Pod koniec dodaj sól i pieprz do smaku.
- Przecedź przez sito, mięso pokrój i dodaj z powrotem.
- Podawaj z makaronem i posiekaną natką pietruszki.'
            )
        );
    end if;

    -- recipe 4: Jajecznica
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Jajecznica') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps
        ) values (
            target_user_id,
            category_sniadanie_id,
            'Jajecznica',
            'Proste i szybkie śniadanie, które zawsze smakuje wybornie.',
            public.parse_text_to_jsonb(
                '- 4 jajka
- 2 łyżki masła
- sól, pieprz
- szczypiorek (opcjonalnie)
- 2 łyżki śmietany (opcjonalnie)'
            ),
            public.parse_text_to_jsonb(
                '- Rozgrzej patelnię na średnim ogniu.
- Rozpuść masło.
- Wbij jajka i delikatnie mieszaj drewnianą łyżką.
- Gdy jajka zaczną się ścinać, dodaj sól i pieprz.
- Gotuj przez 2-3 minuty, aż jajka będą lekko ścięte, ale jeszcze wilgotne.
- Jeśli używasz, dodaj śmietanę i szczypiorek na końcu.
- Podawaj od razu z pieczywem.'
            )
        );
    end if;

    -- recipe 5: Pierogi ruskie
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Pierogi ruskie') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps
        ) values (
            target_user_id,
            category_obiad_id,
            'Pierogi ruskie',
            'Klasyczne pierogi z farszem z ziemniaków i sera, podawane ze skwarkami.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 500g mąki pszennej
- 1 szklanka ciepłej wody
- 1 jajko
- 1 łyżka oleju
- szczypta soli
## Farsz
- 500g ziemniaków
- 200g sera białego (twarogu)
- 1 cebula
- sól, pieprz
## Do podania
- 100g boczku
- 1 cebula'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Z mąki, wody, jajka, oleju i soli zagnieć elastyczne ciasto.
- Zawiń w folię i odstaw na 30 minut.
## Przygotowanie farszu
- Ziemniaki ugotuj w mundurkach, obierz i rozgnieć.
- Ser przepuść przez praskę lub rozgnieć widelcem.
- Cebulę pokrój w kostkę i zeszklij na patelni.
- Wszystko wymieszaj, dopraw solą i pieprzem.
## Formowanie pierogów
- Ciasto rozwałkuj cienko i wykrawaj kółka.
- Na każde kółko nałóż farsz i zlep brzegi.
- Gotuj w osolonym wrzątku około 3-4 minuty od wypłynięcia.
## Podanie
- Boczek pokrój w kostkę i usmaż na patelni.
- Dodaj pokrojoną cebulę i smaż razem.
- Polej pierogi skwarkami i cebulą.'
            )
        );
    end if;

end $$;

