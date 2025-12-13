-- migration: seed recipes
-- description: populates the recipes table with sample recipes for existing user
-- tables affected: recipes
-- dependencies: recipes table, categories table, parse_text_to_jsonb function
-- note: seeds recipes for user with id 141ebb08-699c-431e-a99d-6ea244d5dbda
--       checks if recipes already exist before inserting to make migration idempotent

-- variable to store user_id
do $$
declare
    target_user_id uuid := 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
    category_obiad_id bigint;
    category_deser_id bigint;
    category_zupa_id bigint;
    category_sniadanie_id bigint;
    category_dodatek_id bigint;
    category_pieczywo_id bigint;
    category_napoj_id bigint;
    category_lody_id bigint;
    category_półprodukt_id bigint;
    category_inne_id bigint;
begin
    -- verify that user exists
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User with id % does not exist', target_user_id;
    end if;

    -- get category IDs
    select id into category_obiad_id from public.categories where name = 'Danie główne' limit 1;
    select id into category_deser_id from public.categories where name = 'Deser' limit 1;
    select id into category_zupa_id from public.categories where name = 'Zupa' limit 1;
    select id into category_sniadanie_id from public.categories where name = 'Śniadanie' limit 1;
    select id into category_dodatek_id from public.categories where name = 'Dodatek' limit 1;
    select id into category_pieczywo_id from public.categories where name = 'Pieczywo' limit 1;
    select id into category_napoj_id from public.categories where name = 'Napój' limit 1;
    select id into category_lody_id from public.categories where name = 'Lody' limit 1;
    select id into category_półprodukt_id from public.categories where name = 'Półprodukt' limit 1;
    select id into category_inne_id from public.categories where name = 'Inne' limit 1;

    -- insert sample recipes (only if they don't already exist)
    -- recipe 1: Bigos
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Bigos') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
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
            ),
            'PUBLIC'
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
            steps,
            visibility
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
            ),
            'SHARED'
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
            steps,
            visibility
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
            ),
            'PRIVATE'
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
            steps,
            visibility
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
            ),
            'PUBLIC'
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
            steps,
            visibility
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
            ),
            'SHARED'
        );
    end if;

    -- recipe 6: Żurek
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Żurek') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Żurek',
            'Tradycyjna polska zupa na zakwasie z białą kiełbasą i jajkiem, idealna na Wielkanoc.',
            public.parse_text_to_jsonb(
                '## Zupa
- 500ml zakwasu do żurku
- 1 litr bulionu warzywnego lub mięsnego
- 200g białej kiełbasy
- 2 ząbki czosnku
- 1 łyżka majeranku
## Warzywa
- 2 marchewki
- 1 pietruszka
- 1 seler
- 1 cebula
## Dodatki
- 4 jajka
- 100ml śmietany
- sól, pieprz
- świeży koper'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie
- Warzywa obierz i pokrój w kostkę, gotuj w bulionie przez 20 minut.
- Kiełbasę pokrój w plastry i podsmaż na patelni.
- Do bulionu dodaj zakwas, czosnek i majeranek.
- Gotuj na małym ogniu przez 15 minut.
- Jajka ugotuj na twardo, obierz i pokrój na połówki.
- Pod koniec dodaj śmietanę, dopraw solą i pieprzem.
- Podawaj z kiełbasą, jajkiem i posiekanym koperkiem.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 7: Naleśniki
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Naleśniki') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Naleśniki',
            'Cienkie, delikatne naleśniki z serem lub dżemem, klasyka polskiej kuchni.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 2 szklanki mąki pszennej
- 3 jajka
- 500ml mleka
- 200ml wody gazowanej
- 2 łyżki cukru
- szczypta soli
- 2 łyżki oleju
## Farsz serowy
- 500g sera białego
- 2 żółtka
- 3 łyżki cukru
- 1 łyżeczka cukru waniliowego'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Jajka ubij z cukrem i solą.
- Dodaj mleko i wodę, wymieszaj.
- Stopniowo dosypuj mąkę, mieszając na gładkie ciasto.
- Dodaj olej, odstaw na 30 minut.
## Smażenie
- Rozgrzej patelnię, posmaruj olejem.
- Nalewaj ciasto cienką warstwą i smaż z obu stron.
## Farsz
- Ser przepuść przez praskę.
- Dodaj żółtka, cukier i cukier waniliowy, wymieszaj.
- Każdy naleśnik nadziaj farszem i zwiń w rulony.
- Podawaj na ciepło, posypane cukrem pudrem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 8: Kotlet schabowy
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kotlet schabowy') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Kotlet schabowy',
            'Królowa polskich obiadów - chrupiący kotlet panierowany z łopatki wieprzowej.',
            public.parse_text_to_jsonb(
                '- 4 kotlety z łopatki wieprzowej (ok. 150g każdy)
- 2 jajka
- 1 szklanka bułki tartej
- 3 łyżki mąki pszennej
- sól, pieprz
- olej do smażenia
- 1 cytryna (do podania)'
            ),
            public.parse_text_to_jsonb(
                '- Mięso zbij tłuczkiem, natnij brzegi.
- Posolić i popieprzyć z obu stron.
- Przygotuj trzy głębokie talerze: mąka, rozbite jajka, bułka tarta.
- Każdy kotlet obtocz w mące, potem w jajku, na końcu w bułce.
- Smaż na złocisty kolor na gorącym oleju, ok. 4-5 minut z każdej strony.
- Odsącz na papierowym ręczniku.
- Podawaj z ziemniakami, surówką i cytryną.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 9: Gołąbki
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Gołąbki') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Gołąbki',
            'Liście kapusty nadziewane mięsem i ryżem, duszone w sosie pomidorowym.',
            public.parse_text_to_jsonb(
                '## Farsz
- 500g mięsa mielonego (wieprzowo-wołowe)
- 1 szklanka ryżu
- 1 cebula
- 1 jajko
- sól, pieprz, majeranek
## Kapusta
- 1 duża główka kapusty (ok. 1,5 kg)
## Sos
- 500ml bulionu
- 3 łyżki koncentratu pomidorowego
- 1 cebula
- 2 łyżki mąki
- sól, pieprz, cukier'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie kapusty
- Kapustę ugotuj w całości we wrzątku przez 10 minut.
- Obierz liście, wytnij twarde części.
## Farsz
- Ryż ugotuj do półmiękkości.
- Cebulę pokrój i zeszklij na patelni.
- Wymieszaj mięso, ryż, cebulę, jajko i przyprawy.
## Formowanie
- Na każdy liść nałóż porcję farszu, zwiń w rulony.
- Ułóż w garnku jeden na drugim.
## Sos i duszenie
- Zalej bulionem z koncentratem pomidorowym.
- Duś na małym ogniu przez 1,5 godziny.
- Pod koniec zagęść zasmażką z mąki i cebuli.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 10: Sernik na zimno
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Sernik na zimno') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Sernik na zimno',
            'Kremowy sernik bez pieczenia z galaretką, idealny na lato.',
            public.parse_text_to_jsonb(
                '## Spód
- 200g herbatników
- 100g masła
## Masa serowa
- 1 kg sera białego (twarogu)
- 200ml śmietany kremówki 36%
- 150g cukru pudru
- 1 łyżeczka cukru waniliowego
- 15g żelatyny
## Dodatki
- 400g owoców (truskawki, maliny, borówki)
- 1 opakowanie galaretki'
            ),
            public.parse_text_to_jsonb(
                '## Spód
- Herbatniki rozdrobnij, wymieszaj z roztopionym masłem.
- Wyłóż dno formy (średnica 24cm), ugnij, wstaw do lodówki.
## Masa
- Żelatynę namocz w zimnej wodzie.
- Ser przepuść przez sitko lub miksuj.
- Śmietanę ubij na sztywno.
- Ser wymieszaj z cukrem pudrem i waniliowym.
- Żelatynę rozpuść, dodaj do sera, delikatnie wymieszaj.
- Dodaj śmietanę, wymieszaj.
## Składanie
- Masę wyłóż na spód, wyrównaj.
- Wstaw do lodówki na 3 godziny.
- Owoce ułóż na wierzchu, zalej galaretką.
- Schładzaj kolejne 2 godziny.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 11: Kurczak curry
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kurczak curry') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Kurczak curry',
            'Aromatyczny kurczak w kremowym sosie curry z mlekiem kokosowym.',
            public.parse_text_to_jsonb(
                '## Mięso
- 600g piersi z kurczaka
- 1 cebula
- 2 ząbki czosnku
- 1 cm świeżego imbiru
## Sos
- 400ml mleka kokosowego
- 2 łyżki pasty curry
- 1 papryka czerwona
- 200g pomidorów w puszce
- 100g szpinaku baby
## Przyprawy
- sól, pieprz
- 1 łyżeczka kurkumy
- 1 łyżeczka garam masala
- sok z połowy limonki'
            ),
            public.parse_text_to_jsonb(
                '- Kurczaka pokrój w kostkę, podsmaż na patelni.
- Cebulę, czosnek i imbir posiekaj i zeszklij.
- Dodaj pastę curry, kurkumę, smaż przez minutę.
- Paprykę pokrój, dodaj wraz z pomidorami.
- Wlej mleko kokosowe, wymieszaj.
- Dodaj kurczaka, duś na małym ogniu 15 minut.
- Dodaj szpinak i garam masala, gotuj 2 minuty.
- Skrop sokiem z limonki.
- Podawaj z ryżem basmati.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 12: Leniwe pierogi
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Leniwe pierogi') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Leniwe pierogi',
            'Szybka i prosta alternatywa dla klasycznych pierogów, idealna na szybki obiad.',
            public.parse_text_to_jsonb(
                '- 500g sera białego (twarogu)
- 1 jajko
- 150g mąki pszennej
- 1 łyżka cukru
- szczypta soli
- masło do podania
- cukier lub bułka tarta do posypania'
            ),
            public.parse_text_to_jsonb(
                '- Ser przepuść przez praskę lub rozgnieć widelcem.
- Dodaj jajko, cukier, sól, wymieszaj.
- Stopniowo dodawaj mąkę, aż ciasto będzie miękkie i elastyczne.
- Na podsypanej mące formuj wałki grubości 2-3 cm.
- Pokrój na kawałki około 2 cm długości.
- Gotuj w osolonym wrzątku około 3-4 minuty od wypłynięcia.
- Odsącz, polej roztopionym masłem.
- Posyp cukrem lub bułką tartą z cukrem.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 13: Chłodnik litewski
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Chłodnik litewski') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Chłodnik litewski',
            'Orzeźwiająca różowa zupa na bazie buraków i kefiru, idealna na lato.',
            public.parse_text_to_jsonb(
                '- 1 kg młodych buraków z botwinką
- 1 litr kefiru
- 500ml wody
- 1 ogórek
- 4 jajka
- 200g rzodkiewek
- pęczek koperku
- sok z 1 cytryny
- sól, pieprz
- 200ml śmietany'
            ),
            public.parse_text_to_jsonb(
                '- Buraki obierz i ugotuj w lekko osolonej wodzie.
- Pozostaw do ostygnięcia, pokrój w kostkę.
- Botwinę oparz wrzątkiem, pokrój.
- Jajka ugotuj na twardo, obierz i pokrój.
- Ogórek i rzodkiewki pokrój w kostkę.
- Do dużej miski wlej kefir i wodę z gotowanych buraków.
- Dodaj buraki, botwinę, ogórek, rzodkiewki.
- Dopraw solą, pieprzem i sokiem z cytryny.
- Schłódź w lodówce minimum 2 godziny.
- Podawaj z jajkiem, śmietaną i koperkiem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 14: Placki ziemniaczane
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Placki ziemniaczane') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Placki ziemniaczane',
            'Chrupiące placki z ziemniaków, klasyka polskiej kuchni tradycyjnej.',
            public.parse_text_to_jsonb(
                '- 1 kg ziemniaków
- 1 cebula
- 2 jajka
- 3 łyżki mąki pszennej
- 1 ząbek czosnku
- sól, pieprz
- olej do smażenia
- śmietana do podania'
            ),
            public.parse_text_to_jsonb(
                '- Ziemniaki obierz i zetrzyj na tarce o drobnych oczkach.
- Odciśnij nadmiar wody (zachowaj osad skrobi).
- Cebulę i czosnek zetrzyj lub drobno posiekaj.
- Do ziemniaków dodaj cebulę, czosnek, jajka, mąkę i skrobię.
- Dopraw solą i pieprzem, dokładnie wymieszaj.
- Na gorącym oleju smaż łyżką, formując okrągłe placki.
- Smaż na złocisty kolor z obu stron, ok. 3-4 minuty.
- Odsącz na papierowym ręczniku.
- Podawaj ze śmietaną lub gulaszem.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 15: Brownie czekoladowe
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Brownie czekoladowe') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Brownie czekoladowe',
            'Gęste, wilgotne ciasto czekoladowe, które rozpływa się w ustach.',
            public.parse_text_to_jsonb(
                '- 200g gorzkiej czekolady (min. 70%)
- 200g masła
- 3 jajka
- 200g cukru
- 100g mąki pszennej
- 3 łyżki kakao
- szczypta soli
- 100g orzechów włoskich (opcjonalnie)'
            ),
            public.parse_text_to_jsonb(
                '- Czekoladę połam na kawałki, rozpuść z masłem w kąpieli wodnej.
- Jajka ubij z cukrem na puszystą masę.
- Dodaj przestudzoną czekoladę z masłem, wymieszaj.
- Mąkę przesiej z kakao i solą, delikatnie wmieszaj.
- Jeśli używasz, dodaj posiekane orzechy.
- Masę przełóż do formy (20x20cm) wyłożonej papierem.
- Piecz w 180°C przez 25-30 minut.
- Środek powinien być lekko wilgotny.
- Pozostaw do wystygnięcia, pokrój w kwadraty.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 16: Spaghetti carbonara
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Spaghetti carbonara') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Spaghetti carbonara',
            'Klasyczny włoski makaron w kremowym sosie z boczku i żółtek, bez śmietany!',
            public.parse_text_to_jsonb(
                '- 400g spaghetti
- 200g pancetty lub boczku
- 4 żółtka
- 100g sera pecorino lub parmezanu
- 2 ząbki czosnku
- sól, czarny pieprz
- 2 łyżki oliwy'
            ),
            public.parse_text_to_jsonb(
                '- Makaron gotuj w osolonej wodzie według instrukcji na opakowaniu.
- Boczek pokrój w kostkę i smaż na patelni do złocistości.
- Dodaj czosnek, smaż minutę, zdejmij z ognia.
- Żółtka wymieszaj z tartym serem i pieprzem.
- Odlej szklankę wody z makaronu.
- Makaron odsącz i dodaj do patelni z boczkiem.
- Zdejmij patelnię z ognia, dodaj masę jajeczną.
- Szybko mieszaj, dolewając wodę z makaronu do uzyskania kremowej konsystencji.
- Podawaj natychmiast, posypaną serem i pieprzem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 17: Ciasto marchewkowe
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Ciasto marchewkowe') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Ciasto marchewkowe',
            'Wilgotne ciasto z marchewką i orzechami, polane kremem serowym.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 3 marchewki (ok. 300g)
- 3 jajka
- 200g cukru
- 200ml oleju
- 250g mąki pszennej
- 2 łyżeczki proszku do pieczenia
- 1 łyżeczka cynamonu
- 100g orzechów włoskich
## Krem
- 200g sera mascarpone
- 100g masła
- 150g cukru pudru
- 1 łyżeczka ekstraktu waniliowego'
            ),
            public.parse_text_to_jsonb(
                '## Ciasto
- Marchew zetrzyj na drobnej tarce.
- Jajka ubij z cukrem na puszystą masę.
- Dodaj olej, wymieszaj.
- Mąkę przesiej z proszkiem i cynamonem.
- Dodaj do masy jajecznej wraz z marchewką.
- Dodaj posiekane orzechy, delikatnie wymieszaj.
- Przelej do formy (24 cm), piecz w 180°C przez 45 minut.
## Krem
- Masło ubij z cukrem pudrem.
- Dodaj mascarpone i ekstrakt waniliowy.
- Ubijaj do uzyskania gładkiego kremu.
- Wystudzony biszkopt przekrój wzdłuż.
- Posmaruj kremem, złóż i obsmaruj wierzch i boki.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 18: Shakshuka
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Shakshuka') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_sniadanie_id,
            'Shakshuka',
            'Bliskowschodni klasyk - jajka w pikantnym sosie pomidorowym z papryką.',
            public.parse_text_to_jsonb(
                '- 6 jajek
- 800g pomidorów w puszce
- 2 papryki (czerwona i żółta)
- 1 cebula
- 3 ząbki czosnku
- 1 łyżeczka kminu
- 1 łyżeczka papryki słodkiej
- 1/2 łyżeczki chili w płatkach
- pęczek kolendry
- 100g sera feta
- sól, pieprz
- oliwa'
            ),
            public.parse_text_to_jsonb(
                '- Cebulę pokrój w kostkę, czosnek posiekaj.
- Paprykę pokrój w kostkę.
- Na patelni rozgrzej oliwę, zeszklij cebulę.
- Dodaj czosnek, paprykę, smaż 5 minut.
- Dodaj pomidory, przyprawy, duś 15 minut.
- Sos dopraw solą i pieprzem.
- Zrób w sosie zagłębienia, wbij jajka.
- Przykryj i gotuj 8-10 minut, aż białka się zetną.
- Posyp pokruszoną fetą i kolendrą.
- Podawaj z chlebem pita.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 19: Smoothie bowl truskawkowe
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Smoothie bowl truskawkowe') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_sniadanie_id,
            'Smoothie bowl truskawkowe',
            'Zdrowe i pyszne śniadanie pełne witamin, idealne na letni poranek.',
            public.parse_text_to_jsonb(
                '## Smoothie
- 300g mrożonych truskawek
- 1 banan
- 200ml mleka roślinnego lub jogurtu
- 1 łyżka miodu
- 1 łyżka nasion chia
## Toppings
- świeże truskawki
- płatki kokosowe
- granola
- nasiona słonecznika
- świeża mięta'
            ),
            public.parse_text_to_jsonb(
                '- Wszystkie składniki smoothie włóż do blendera.
- Miksuj na gładką, gęstą masę.
- Jeśli jest za gęsta, dodaj trochę mleka.
- Przelej do miski.
- Ułóż toppings w estetyczny sposób.
- Podawaj natychmiast, zanim się nie roztopiło.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 20: Risotto z grzybami
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Risotto z grzybami') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Risotto z grzybami',
            'Kremowe włoskie danie z ryżu arborio i aromatycznych grzybów.',
            public.parse_text_to_jsonb(
                '- 300g ryżu arborio
- 400g świeżych grzybów (pieczarki, borowiki)
- 20g suszonych grzybów
- 1 cebula
- 2 ząbki czosnku
- 1 litr bulionu warzywnego
- 150ml białego wina
- 50g masła
- 100g parmezanu
- 2 łyżki oliwy
- świeża natka pietruszki
- sól, pieprz'
            ),
            public.parse_text_to_jsonb(
                '- Suszone grzyby namocz w 200ml gorącej wody.
- Bulion podgrzej i utrzymuj na małym ogniu.
- Świeże grzyby pokrój, podsmaż na patelni do złocistości.
- Cebulę i czosnek posiekaj, zeszklij na oliwie.
- Dodaj ryż, smaż 2 minuty, ciągle mieszając.
- Wlej wino, gotuj aż odparuje.
- Dodaj odcedzone grzyby suszone (zachowaj wodę).
- Po łyżce dodawaj bulion, czekając aż się wchłonie.
- Po 15 minutach dodaj wodę po grzybami.
- Po 20 minutach dodaj grzyby świeże.
- Gdy ryż jest al dente, zdejmij z ognia.
- Wmieszaj masło i parmezan.
- Posyp natką pietruszki.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 21: Zupa pomidorowa
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Zupa pomidorowa') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Zupa pomidorowa',
            'Klasyczna polska zupa pomidorowa z makaronem lub ryżem, ulubione danie dzieci.',
            public.parse_text_to_jsonb(
                '## Baza
- 1 litr bulionu drobiowego
- 500g pomidorów w puszce
- 2 łyżki koncentratu pomidorowego
- 1 cebula
- 2 ząbki czosnku
## Dodatki
- 200g makaronu lub ryżu
- 100ml śmietany 18%
- 1 łyżka masła
- 1 łyżeczka cukru
- sól, pieprz
- świeża bazylia'
            ),
            public.parse_text_to_jsonb(
                '- Cebulę pokrój i zeszklij na maśle.
- Dodaj czosnek, smaż minutę.
- Wlej pomidory i bulion.
- Dodaj koncentrat, cukier, sól i pieprz.
- Gotuj 20 minut na małym ogniu.
- Zblenduj na gładką masę.
- Dodaj śmietanę, wymieszaj.
- Makaron lub ryż ugotuj osobno.
- Podawaj zupę z makaronem i bazylią.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 22: Pierogi z mięsem
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Pierogi z mięsem') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Pierogi z mięsem',
            'Klasyczne pierogi z farszem mięsnym, podawane ze skwarkami i cebulką.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 500g mąki pszennej
- 1 szklanka ciepłej wody
- 1 jajko
- 1 łyżka oleju
- szczypta soli
## Farsz
- 400g mięsa wieprzowego gotowanego
- 200g mięsa drobiowego gotowanego
- 1 cebula
- 2 łyżki masła
- sól, pieprz, majeranek
## Do podania
- 100g boczku
- 1 cebula'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Z mąki, wody, jajka, oleju i soli zagnieć elastyczne ciasto.
- Zawiń w folię i odstaw na 30 minut.
## Przygotowanie farszu
- Mięso zmiel lub drobno posiekaj.
- Cebulę podsmaż na maśle.
- Wymieszaj mięso z cebulą, dopraw przyprawami.
## Formowanie pierogów
- Ciasto rozwałkuj cienko i wykrawaj kółka.
- Na każde kółko nałóż farsz i zlep brzegi.
- Gotuj w osolonym wrzątku około 3-4 minuty od wypłynięcia.
## Podanie
- Boczek pokrój w kostkę i usmaż na patelni.
- Dodaj pokrojoną cebulę i smaż razem.
- Polej pierogi skwarkami.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 23: Sałatka grecka
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Sałatka grecka') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_dodatek_id,
            'Sałatka grecka',
            'Orzeźwiająca sałatka śródziemnomorska z fetą i oliwkami, idealna na lato.',
            public.parse_text_to_jsonb(
                '- 4 pomidory
- 1 ogórek
- 1 czerwona cebula
- 200g sera feta
- 100g oliwek kalamata
- 1 zielona papryka
- 4 łyżki oliwy z oliwek
- 2 łyżki soku z cytryny
- 1 łyżeczka oregano
- sól, pieprz'
            ),
            public.parse_text_to_jsonb(
                '- Pomidory pokrój w ósemki.
- Ogórek przekrój wzdłuż i pokrój w półplasterki.
- Cebulę pokrój w cienkie piórka.
- Paprykę pokrój w paski.
- Wszystkie warzywa połącz w misce.
- Dodaj oliwki.
- Fetę pokrój w kostkę lub pokrusz ręką.
- Przygotuj dressing z oliwy, cytryny, oregano, soli i pieprzu.
- Polej sałatkę dressingiem, ułóż fetę na wierzchu.
- Podawaj natychmiast.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 24: Tiramisu
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Tiramisu') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Tiramisu',
            'Klasyczny włoski deser z mascarpone i kawą, bez pieczenia.',
            public.parse_text_to_jsonb(
                '## Krem
- 500g mascarpone
- 4 żółtka
- 100g cukru
- 200ml śmietany kremówki 36%
## Pozostałe
- 300g biszkopty podłużne (savoiardi)
- 300ml mocnej kawy (espresso)
- 3 łyżki amaretto lub rumu (opcjonalnie)
- kakao do posypania
- gorzka czekolada do dekoracji'
            ),
            public.parse_text_to_jsonb(
                '## Krem
- Żółtka ubij z cukrem na puszystą, jasną masę.
- Dodaj mascarpone, delikatnie wymieszaj.
- Śmietanę ubij na sztywno.
- Połącz obie masy, mieszając ruchami od dołu do góry.
## Składanie
- Kawę wystudź, dodaj alkohol (opcjonalnie).
- Biszkopty maczaj w kawie (krótko!) i układaj na dnie naczynia.
- Nałóż połowę kremu.
- Ułóż drugą warstwę biszkoptów.
- Nałóż resztę kremu, wyrównaj.
- Wstaw do lodówki na minimum 4 godziny.
- Przed podaniem posyp kakao i zetrzij czekoladę.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 25: Omlet francuski
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Omlet francuski') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_sniadanie_id,
            'Omlet francuski',
            'Delikatny, kremowy omlet w stylu francuskim - mistrzostwo prostoty.',
            public.parse_text_to_jsonb(
                '- 3 jajka
- 1 łyżka masła
- 1 łyżka szczypiorku
- sól, pieprz
- 1 łyżka sera (opcjonalnie)'
            ),
            public.parse_text_to_jsonb(
                '- Jajka rozbij do miski, dopraw solą i pieprzem.
- Delikatnie roztrzep widelcem (nie za mocno!).
- Rozgrzej patelnię na średnim ogniu, rozpuść masło.
- Wlej jajka, poczekaj kilka sekund.
- Drewnianą szpatułką ściągaj ścięte jajko od brzegów do środka.
- Pochyl patelnię, by surowe jajko spłynęło na brzeg.
- Gdy wierzch jest jeszcze kremowy, posyp serem.
- Złóż omlet na pół lub w trójkę.
- Przesuń na talerz, posyp szczypiorkiem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 26: Krupnik
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Krupnik') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Krupnik',
            'Tradycyjna polska zupa na bazie kaszy jęczmiennej, sycąca i rozgrzewająca.',
            public.parse_text_to_jsonb(
                '## Baza
- 1,5 litra bulionu mięsnego
- 150g kaszy jęczmiennej
- 300g ziemniaków
## Warzywa
- 2 marchewki
- 1 pietruszka
- 1 kawałek selera
- 1 cebula
- 2 ząbki czosnku
## Przyprawy
- liść laurowy
- ziele angielskie
- sól, pieprz
- świeży koper'
            ),
            public.parse_text_to_jsonb(
                '- Kaszę opłucz i namocz na 30 minut.
- Warzywa obierz i pokrój w kostkę.
- Bulion zagotuj, dodaj kaszę i warzywa.
- Dodaj przyprawy.
- Gotuj na małym ogniu około 40 minut.
- Ziemniaki pokrój w kostkę, dodaj po 20 minutach.
- Pod koniec dodaj przeciśnięty czosnek.
- Dopraw solą i pieprzem.
- Podawaj z posiekanym koperkiem.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 27: Paszteciki z mięsem
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Paszteciki z mięsem') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Paszteciki z mięsem',
            'Chrupiące paszteciki z ciasta francuskiego z mięsnym nadzieniem.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 500g ciasta francuskiego (gotowego)
- 1 jajko do smarowania
## Farsz
- 300g mięsa mielonego wieprzowo-wołowego
- 1 cebula
- 2 ząbki czosnku
- 1 jajko
- 2 łyżki bułki tartej
- sól, pieprz, majeranek
- 2 łyżki oleju'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie farszu
- Cebulę i czosnek drobno posiekaj, zeszklij na oleju.
- Mięso wymieszaj z cebulą, jajkiem i bułką tartą.
- Dopraw solą, pieprzem i majerankiem.
## Formowanie
- Ciasto rozwałkuj i pokrój na kwadraty (ok. 10x10 cm).
- Na środek każdego kwadratu nałóż porcję farszu.
- Złóż na trójkąty, zagnij brzegi widelcem.
- Posmaruj roztrzepanym jajkiem.
## Pieczenie
- Ułóż na blasze wyłożonej papierem.
- Piecz w 200°C przez 20-25 minut do złocistości.
- Podawaj gorące z sosem musztardowym.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 28: Sernik pieczony
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Sernik pieczony') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Sernik pieczony',
            'Klasyczny polski sernik na kruchym spodzie, gęsty i kremowy.',
            public.parse_text_to_jsonb(
                '## Spód
- 200g mąki pszennej
- 100g masła
- 50g cukru pudru
- 1 żółtko
## Masa serowa
- 1 kg sera białego (twarogu)
- 200g cukru
- 5 jajek
- 100g masła
- 2 łyżki mąki ziemniaczanej
- 1 łyżeczka ekstraktu waniliowego
- skórka z 1 cytryny'
            ),
            public.parse_text_to_jsonb(
                '## Spód
- Z mąki, masła, cukru i żółtka zagnieć ciasto.
- Wyłóż dno formy (26cm), nakłuj widelcem.
- Piecz 15 minut w 180°C.
## Masa
- Ser przepuść 2-3 razy przez maszynkę.
- Żółtka oddziel od białek.
- Masło utrzyj z cukrem na puszystą masę.
- Dodawaj żółtka po jednym.
- Dodaj ser, mąkę ziemniaczaną, wanilię i skórkę.
- Białka ubij na sztywno, delikatnie wmieszaj.
## Pieczenie
- Masę wyłóż na podpieczony spód.
- Piecz 60 minut w 160°C.
- Wyłącz piekarnik, zostaw sernik na 30 minut.
- Wyjmij i całkowicie wystudź.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 29: Racuchy z jabłkami
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Racuchy z jabłkami') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Racuchy z jabłkami',
            'Puszyste drożdżowe placuszki z jabłkami, idealne na słodkie śniadanie.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 300g mąki pszennej
- 200ml mleka
- 15g świeżych drożdży
- 2 jajka
- 2 łyżki cukru
- szczypta soli
## Dodatki
- 2 jabłka
- olej do smażenia
- cukier puder do posypania
- cynamon'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Drożdże rozkrusz w ciepłym mleku z łyżką cukru.
- Odstaw na 10 minut aż zaczną pienić.
- Mąkę wsyp do miski, dodaj jajka, resztę cukru i sól.
- Wlej mleko z drożdżami, wymieszaj na gładkie ciasto.
- Przykryj, odstaw w ciepłe miejsce na 45 minut.
## Jabłka
- Jabłka obierz i pokrój w plastry lub kostkę.
- Wmieszaj do wyrośniętego ciasta.
## Smażenie
- Na patelni rozgrzej olej.
- Nakładaj łyżką porcje ciasta.
- Smaż z obu stron na złocisty kolor.
- Odsącz na papierowym ręczniku.
- Posyp cukrem pudrem zmieszanym z cynamonem.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 30: Pasta jajeczna
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Pasta jajeczna') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_sniadanie_id,
            'Pasta jajeczna',
            'Prosta i pyszna pasta kanapkowa z jajek i majonezu.',
            public.parse_text_to_jsonb(
                '- 6 jajek
- 3 łyżki majonezu
- 1 łyżka musztardy
- 2 łyżki szczypiorku
- sól, pieprz
- 1 łyżka ogórka konserwowego (opcjonalnie)'
            ),
            public.parse_text_to_jsonb(
                '- Jajka ugotuj na twardo (10 minut).
- Ostudź w zimnej wodzie, obierz.
- Rozgnieć widelcem lub przetrzyj przez sitkę.
- Dodaj majonez i musztardę, wymieszaj.
- Posiekaj szczypiorek, dodaj do jajek.
- Jeśli używasz, dodaj pokrojony ogorek.
- Dopraw solą i pieprzem.
- Podawaj na pieczywie lub krakerach.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 31: Gulasz węgierski
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Gulasz węgierski') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Gulasz węgierski',
            'Aromatyczny gulasz wołowy z papryką, sycące danie jednogarnkowe.',
            public.parse_text_to_jsonb(
                '## Mięso
- 800g wołowiny (łopatka lub antrykot)
- 2 łyżki smalcu lub oleju
## Warzywa
- 3 cebule
- 2 papryki czerwone
- 2 pomidory
- 3 ząbki czosnku
- 500ml bulionu wołowego
## Przyprawy
- 3 łyżki papryki słodkiej
- 1 łyżeczka papryki ostrej
- 1 łyżeczka kminku
- liść laurowy
- sól, pieprz'
            ),
            public.parse_text_to_jsonb(
                '- Mięso pokrój w kostkę, osusz.
- Na smalcu podsmaż na silnym ogniu do zbrązowienia.
- Wyjmij mięso, dodaj pokrojoną cebulę.
- Smaż aż będzie złocista.
- Dodaj czosnek i paprykę, smaż 2 minuty.
- Dodaj pomidory pokrojone w kostkę.
- Wsyp przyprawy, wymieszaj.
- Wrzuć mięso z powrotem, zalej bulionem.
- Duś pod przykryciem 1,5-2 godziny.
- Dopraw solą i pieprzem.
- Podawaj z kluskami lub chlebem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 32: Kapuśniak
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kapuśniak') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Kapuśniak',
            'Tradycyjna polska zupa z kapusty kiszonej, idealna na zimowe dni.',
            public.parse_text_to_jsonb(
                '## Baza
- 500g kapusty kiszonej
- 300g żeberek wieprzowych
- 1,5 litra wody
## Warzywa
- 3 ziemniaki
- 1 marchewka
- 1 pietruszka
- 1 cebula
## Przyprawy
- 2 liście laurowe
- 4 ziarna ziela angielskiego
- sól, pieprz
- 1 łyżeczka majeranku'
            ),
            public.parse_text_to_jsonb(
                '- Żeberka zalej zimną wodą, zagotuj.
- Zbieraj szumowiny, gotuj 45 minut.
- Kapustę przepłucz, jeśli jest za kwaśna.
- Posiekaj kapustę i warzywa.
- Do bulionu dodaj kapustę i marchewkę.
- Gotuj 20 minut.
- Dodaj ziemniaki pokrojone w kostkę.
- Dodaj pietruszką i przyprawy.
- Gotuj kolejne 20 minut.
- Dopraw solą i pieprzem.
- Posyp majerankiem przed podaniem.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 33: Knedle ze śliwkami
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Knedle ze śliwkami') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Knedle ze śliwkami',
            'Klasyczne polskie knedle z nadzieniem ze śliwek, posypane bułką tartą.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 500g ziemniaków
- 150g mąki pszennej
- 1 jajko
- szczypta soli
## Nadzienie
- 15 śliwek (węgierek)
- 15 kostek cukru
## Do podania
- 100g masła
- 100g bułki tartej
- 3 łyżki cukru
- cynamon'
            ),
            public.parse_text_to_jsonb(
                '## Przygotowanie ciasta
- Ziemniaki ugotuj w mundurkach, ostudź, obierz.
- Przepuść przez praskę, dodaj mąkę, jajko i sól.
- Zagnieć elastyczne ciasto.
## Śliwki
- Ze śliwek wyjmij pestki.
- W miejsce pestki włóż kostkę cukru.
## Formowanie
- Ciasto podziel na porcje.
- Każdą rozgnij na placek, w środek włóż śliwkę.
- Zamknij ciasto, formuj kulę.
- Gotuj we wrzątku 5 minut od wypłynięcia.
## Podanie
- Masło rozpuść, dodaj bułkę tartą.
- Smaż aż będzie złocista.
- Dodaj cukier i cynamon.
- Knedle polej prażoną bułką.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 34: Tatar wołowy
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Tatar wołowy') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Tatar wołowy',
            'Elegancka przystawka z surowego mięsa wołowego z klasycznymi dodatkami.',
            public.parse_text_to_jsonb(
                '## Mięso
- 400g polędwicy wołowej
## Dodatki
- 4 żółtka
- 4 łyżki drobno posiekanej cebuli
- 4 łyżki ogórków konserwowych
- 4 łyżki marynowanych grzybków
- 4 łyżki kaparów
## Przyprawy
- 2 łyżki musztardy Dijon
- 2 łyżki oliwy
- sól, pieprz
- kilka kropli Worcestershire'
            ),
            public.parse_text_to_jsonb(
                '- Mięso oczyść z błon i tłuszczu.
- Posiekaj bardzo drobno ostrym nożem (nie miel!).
- Mięso dopraw solą, pieprzem i sosem Worcestershire.
- Wymieszaj z musztardą i oliwą.
- Uformuj porcje na talerzach.
- W środku zrób zagłębienie na żółtko.
- Wokół ułóż osobno wszystkie dodatki.
- Surowe żółtko wbij na wierzch.
- Podawaj z grzankami lub pieczywem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 35: Kopytka
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Kopytka') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_dodatek_id,
            'Kopytka',
            'Polskie kluseczki ziemniaczane, idealne do mięs z sosem lub jako samodzielne danie.',
            public.parse_text_to_jsonb(
                '- 1 kg ziemniaków
- 200g mąki pszennej
- 1 jajko
- szczypta soli
- masło do podania
- opcjonalnie: bułka tarta'
            ),
            public.parse_text_to_jsonb(
                '- Ziemniaki ugotuj w mundurkach.
- Ostudź, obierz i przepuść przez praskę.
- Dodaj mąkę, jajko i sól.
- Zagnieć jednolite ciasto.
- Z ciasta formuj wałki grubości 2 cm.
- Pokrój na ukos, tworząc „kopytka".
- Gotuj we wrzątku około 3-4 minuty od wypłynięcia.
- Wyjmij łyżką cedzakową.
- Polej roztopionym masłem lub oprósz bułką tartą.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 36: Tort czekoladowy
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Tort czekoladowy') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_deser_id,
            'Tort czekoladowy',
            'Dekadencki, wilgotny tort czekoladowy z ganache, na każdą okazję.',
            public.parse_text_to_jsonb(
                '## Biszkopt
- 200g mąki pszennej
- 200g cukru
- 50g kakao
- 2 łyżeczki proszku do pieczenia
- 3 jajka
- 200ml mleka
- 100ml oleju
- 1 łyżeczka ekstraktu waniliowego
## Ganache
- 400g gorzkiej czekolady
- 400ml śmietany 36%
- 50g masła'
            ),
            public.parse_text_to_jsonb(
                '## Biszkopt
- Suche składniki przesiej do miski.
- Dodaj jajka, mleko, olej i wanilię.
- Miksuj na gładkie ciasto.
- Przełóż do dwóch form (20cm).
- Piecz w 180°C przez 30-35 minut.
- Przestudź i przekrój każdy na pół.
## Ganache
- Czekoladę połam, wrzuć do miski.
- Śmietanę zagotuj, zalej czekoladę.
- Mieszaj aż czekolada się rozpuści.
- Dodaj masło, wymieszaj.
- Schłódź do konsystencji do smarowania.
## Składanie
- Każdy blat posmaruj ganache.
- Ułóż warstwy, obsmaruj wierzch i boki.
- Schłódź przed podaniem.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 37: Spaghetti bolognese
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Spaghetti bolognese') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_obiad_id,
            'Spaghetti bolognese',
            'Klasyczny włoski makaron z mięsnym sosem pomidorowym, ulubieniec wszystkich.',
            public.parse_text_to_jsonb(
                '## Sos
- 500g mięsa mielonego wołowego
- 400g pomidorów w puszce
- 2 łyżki koncentratu pomidorowego
- 1 cebula
- 1 marchewka
- 1 seler naciowy
- 3 ząbki czosnku
- 100ml czerwonego wina
- 2 łyżki oliwy
## Makaron
- 400g spaghetti
- parmezan do podania'
            ),
            public.parse_text_to_jsonb(
                '- Warzywa (cebulę, marchewkę, seler) pokrój w drobną kostkę.
- Na oliwie zeszklij warzywa przez 10 minut.
- Dodaj mięso, smaż rozbijając grudki.
- Gdy mięso się zrumieni, wlej wino.
- Gotuj aż wino odparuje.
- Dodaj pomidory, koncentrat i czosnek.
- Dopraw solą i pieprzem.
- Duś na małym ogniu minimum 45 minut.
- Makaron ugotuj al dente.
- Podawaj sos na makaronie, posyp parmezanem.'
            ),
            'PRIVATE'
        );
    end if;

    -- recipe 38: Grochówka
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Grochówka') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Grochówka',
            'Tradycyjna polska zupa z grochu, gęsta i sycąca, idealna na zimę.',
            public.parse_text_to_jsonb(
                '## Baza
- 500g grochu łuskanego
- 500g wędzonek (boczek, żeberka, golonka)
- 2 litry wody
## Warzywa
- 2 marchewki
- 1 pietruszka
- 1 seler
- 2 cebule
- 3 ząbki czosnku
## Przyprawy
- liść laurowy
- ziele angielskie
- sól, pieprz
- majeranek'
            ),
            public.parse_text_to_jsonb(
                '- Groch namocz na noc w zimnej wodzie.
- Wędzonki zalej wodą, gotuj 1 godzinę.
- Groch odsącz, dodaj do wywaru.
- Warzywa pokrój, dodaj do zupy.
- Gotuj na małym ogniu około 1,5 godziny.
- Groch powinien być miękki i rozpadać się.
- Wyjmij wędzonki, mięso pokrój w kostkę.
- Zupę możesz częściowo zblendować.
- Wrzuć mięso z powrotem.
- Dodaj przeciśnięty czosnek i majeranek.
- Dopraw solą i pieprzem.'
            ),
            'SHARED'
        );
    end if;

    -- recipe 39: Drożdżówki z serem
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Drożdżówki z serem') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_pieczywo_id,
            'Drożdżówki z serem',
            'Puszyste bułeczki drożdżowe z kremowym nadzieniem serowym.',
            public.parse_text_to_jsonb(
                '## Ciasto
- 500g mąki pszennej
- 250ml mleka
- 50g drożdży świeżych
- 80g cukru
- 80g masła
- 2 żółtka
- szczypta soli
## Nadzienie
- 500g sera białego
- 2 żółtka
- 4 łyżki cukru
- 1 łyżeczka cukru waniliowego
- 50g rodzynek
## Do posmarowania
- 1 jajko'
            ),
            public.parse_text_to_jsonb(
                '## Ciasto
- Drożdże rozpuść w ciepłym mleku z łyżką cukru.
- Mąkę wsyp do miski, dodaj resztę cukru i sól.
- Dodaj roztopione masło i żółtka.
- Wlej mleko z drożdżami.
- Zagnieć elastyczne ciasto, wyrabiaj 10 minut.
- Przykryj, odstaw w ciepłe miejsce na 1 godzinę.
## Nadzienie
- Ser przepuść przez praskę.
- Dodaj żółtka, cukier, wanilię i rodzynki.
## Formowanie
- Ciasto podziel na 12-16 części.
- Każdą rozwałkuj, nałóż nadzienie, zwiń.
- Układaj na blasze, odstaw na 20 minut.
- Posmaruj jajkiem.
- Piecz w 180°C przez 20-25 minut.'
            ),
            'PUBLIC'
        );
    end if;

    -- recipe 40: Zupa ogórkowa
    if not exists (select 1 from public.recipes where user_id = target_user_id and name = 'Zupa ogórkowa') then
        insert into public.recipes (
            user_id,
            category_id,
            name,
            description,
            ingredients,
            steps,
            visibility
        ) values (
            target_user_id,
            category_zupa_id,
            'Zupa ogórkowa',
            'Tradycyjna polska zupa z kiszonych ogórków, lekko kwaśna i aromatyczna.',
            public.parse_text_to_jsonb(
                '## Baza
- 1,5 litra bulionu mięsnego
- 500g ogórków kiszonych
- 300ml soku z ogórków
## Warzywa
- 3 ziemniaki
- 1 marchewka
- 1 pietruszka
- 1 cebula
## Dodatki
- 200ml śmietany 18%
- 2 łyżki masła
- 2 łyżki mąki
- koper świeży
- sól, pieprz'
            ),
            public.parse_text_to_jsonb(
                '- Warzywa obierz i pokrój w kostkę.
- Bulion zagotuj, dodaj marchewkę i pietruszką.
- Gotuj 15 minut.
- Dodaj ziemniaki, gotuj kolejne 15 minut.
- Ogórki zetrzyj na tarce o grubych oczkach.
- Dodaj ogórki i sok do zupy.
- Gotuj 10 minut.
- Zrób zasmażkę z masła i mąki, dodaj do zupy.
- Wlej śmietanę, wymieszaj.
- Dopraw solą i pieprzem.
- Posyp świeżym koperkiem przed podaniem.'
            ),
            'PRIVATE'
        );
    end if;

end $$;


