-- seed: recipe variants
-- description: adds extra variants to four public recipes.
--       Lasagne belongs to premium@; Gołąbki, Bigos and Brownie to simple@.
-- tables affected: recipes
-- dependencies: 02_seed_recipes.sql, recipe families (PS-108)
-- note: idempotent. Does not change collections, plan, or the recipe_variants flag.
--       Lasagne +1, Gołąbki +2, Bigos +3, Brownie czekoladowe +4.
--       Base variant is renamed only while it still has the technical name.
--       Classification on the base variant is set only when diet_type is null.

create or replace function pg_temp.seed_recipe_base(
    p_recipe_name text,
    p_base_variant_name text,
    p_diet public.recipe_diet_type,
    p_cuisine public.recipe_cuisine,
    p_difficulty public.recipe_difficulty,
    p_servings integer,
    p_prep integer,
    p_total integer
) returns void
language plpgsql
set search_path = public
as $func$
declare
    v_id bigint;
    v_family_id uuid;
    v_variant_name text;
begin
    select id, recipe_family_id, variant_name
    into v_id, v_family_id, v_variant_name
    from public.recipes
    where name = p_recipe_name
      and is_default
      and deleted_at is null
    order by id
    limit 1;

    if v_id is null then
        raise exception 'Brak bazowego przepisu %', p_recipe_name;
    end if;

    if (
        select count(*)
        from public.recipes
        where name = p_recipe_name
          and is_default
          and deleted_at is null
    ) > 1 then
        raise exception 'Więcej niż jeden bazowy przepis o nazwie %', p_recipe_name;
    end if;

    if v_variant_name in ('Wariant podstawowy', 'Podstawowa') then
        if exists (
            select 1
            from public.recipes
            where recipe_family_id = v_family_id
              and deleted_at is null
              and id <> v_id
              and lower(variant_name) = lower(p_base_variant_name)
        ) then
            raise exception 'Nazwa wariantu bazowego % jest już zajęta w grupie %',
                p_base_variant_name, p_recipe_name;
        end if;

        update public.recipes
        set variant_name = p_base_variant_name
        where id = v_id;
    end if;

    update public.recipes
    set diet_type = p_diet,
        cuisine = p_cuisine,
        difficulty = p_difficulty,
        servings = p_servings::smallint,
        prep_time_minutes = p_prep::smallint,
        total_time_minutes = p_total::smallint,
        is_termorobot = false,
        is_grill = false
    where id = v_id
      and diet_type is null;
end;
$func$;

create or replace function pg_temp.seed_recipe_variant(
    p_recipe_name text,
    p_variant_name text,
    p_sort_order integer,
    p_description text,
    p_ingredients text,
    p_steps text,
    p_diet public.recipe_diet_type,
    p_cuisine public.recipe_cuisine,
    p_difficulty public.recipe_difficulty,
    p_servings integer,
    p_prep integer,
    p_total integer,
    p_termorobot boolean,
    p_grill boolean
) returns void
language plpgsql
set search_path = public
as $func$
declare
    v_user_id uuid;
    v_family_id uuid;
    v_category_id bigint;
    v_visibility public.recipe_visibility;
    v_name text;
begin
    select r.user_id, r.recipe_family_id, r.category_id, f.visibility, f.name
    into v_user_id, v_family_id, v_category_id, v_visibility, v_name
    from public.recipes r
    join public.recipe_families f on f.id = r.recipe_family_id
    where r.name = p_recipe_name
      and r.is_default
      and r.deleted_at is null
    order by r.id
    limit 1;

    if v_family_id is null then
        raise exception 'Brak bazowego przepisu %', p_recipe_name;
    end if;

    if (
        select count(*)
        from public.recipes
        where name = p_recipe_name
          and is_default
          and deleted_at is null
    ) > 1 then
        raise exception 'Więcej niż jeden bazowy przepis o nazwie %', p_recipe_name;
    end if;

    if exists (
        select 1
        from public.recipes
        where recipe_family_id = v_family_id
          and deleted_at is null
          and lower(variant_name) = lower(btrim(p_variant_name))
    ) then
        raise notice 'Wariant „%” przepisu % już istnieje, pomijam', p_variant_name, p_recipe_name;
        return;
    end if;

    if (
        select count(*)
        from public.recipes
        where recipe_family_id = v_family_id
          and deleted_at is null
    ) >= 10 then
        raise exception 'Grupa % ma już 10 aktywnych wariantów', p_recipe_name;
    end if;

    insert into public.recipes (
        user_id,
        category_id,
        name,
        description,
        ingredients,
        steps,
        visibility,
        recipe_family_id,
        variant_name,
        is_default,
        sort_order,
        diet_type,
        cuisine,
        difficulty,
        servings,
        prep_time_minutes,
        total_time_minutes,
        is_termorobot,
        is_grill
    ) values (
        v_user_id,
        v_category_id,
        v_name,
        p_description,
        public.parse_text_to_jsonb(p_ingredients),
        public.parse_text_to_jsonb(p_steps),
        v_visibility,
        v_family_id,
        btrim(p_variant_name),
        false,
        p_sort_order,
        p_diet,
        p_cuisine,
        p_difficulty,
        p_servings::smallint,
        p_prep::smallint,
        p_total::smallint,
        p_termorobot,
        p_grill
    );
end;
$func$;

do $seed$
declare
    target_user_id uuid := 'c553b8d1-3dbb-488f-b610-97eb6f95d357';
begin
    if not exists (select 1 from auth.users where id = target_user_id) then
        raise exception 'User with id % does not exist', target_user_id;
    end if;

    if not exists (
        select 1 from auth.users where id = '6e2596af-e62a-4be6-93fc-680f8b83dc06'
    ) then
        raise exception 'User premium@pychaswiatowa.pl does not exist';
    end if;

    if to_regclass('public.recipe_families') is null then
        raise exception 'Table recipe_families does not exist';
    end if;
end;
$seed$;

-- Lasagne: baza + 1 wariant. Różnica chipa: dieta.
select pg_temp.seed_recipe_base(
    'Lasagne',
    'Klasyczna',
    'MEAT',
    'ITALIAN',
    'MEDIUM',
    6, 45, 100
);

select pg_temp.seed_recipe_variant(
    'Lasagne',
    'Wegetariańska',
    1,
    'Lasagne z soczewicą i cukinią, bez mięsa. Beszamel i sery zostają.',
    $ing$
# Sos warzywny
- 200g suchej soczewicy zielonej
- 1 cukinia
- 800g pomidorów krojonych z puszki
- 1 cebula
- 2 ząbki czosnku
- 1 marchewka
- 2 łyżki koncentratu pomidorowego
- oliwa, sól, pieprz, bazylia
# Sos beszamelowy
- 50g masła
- 50g mąki pszennej
- 500ml mleka
- gałka muszkatołowa, sól
# Pozostałe
- 12 płatów lasagne
- 200g sera mozzarella
- 80g sera parmezan
$ing$,
    $steps$
# Sos warzywny
- Soczewicę opłucz i ugotuj do miękkości, około 20 minut.
- Cebulę, czosnek, marchewkę i cukinię pokrój w drobną kostkę.
- Zeszklij warzywa na oliwie, dodaj soczewicę.
- Wlej pomidory i koncentrat, duś 25 minut. Dopraw bazylią.
# Beszamel i pieczenie
- Z masła, mąki i mleka ugotuj beszamel, dopraw gałką.
- Układaj warstwy sosu, płatów i beszamelu.
- Posyp serami i piecz w 180°C przez 35 minut.
$steps$,
    'VEGETARIAN',
    'ITALIAN',
    'MEDIUM',
    6, 40, 90,
    false,
    false
);

-- Gołąbki: baza + 2 warianty. Różnice: dieta, termorobot, trudność, porcje.
select pg_temp.seed_recipe_base(
    'Gołąbki',
    'Mięsne',
    'MEAT',
    'POLISH',
    'MEDIUM',
    6, 40, 150
);

select pg_temp.seed_recipe_variant(
    'Gołąbki',
    'Wegetariańskie',
    1,
    'Gołąbki z kaszą gryczaną i pieczarkami, duszone w sosie pomidorowym.',
    $ing$
# Farsz
- 150g kaszy gryczanej
- 100g ryżu
- 400g pieczarek
- 1 cebula
- 2 ząbki czosnku
- 2 łyżki oleju
- sól, pieprz, majeranek, słodka papryka
# Kapusta
- 1 duża główka kapusty (ok. 1,5 kg)
# Sos
- 500ml bulionu warzywnego
- 3 łyżki koncentratu pomidorowego
- 1 łyżka mąki ziemniaczanej
- sól, pieprz, szczypta cukru
$ing$,
    $steps$
# Kapusta
- Kapustę ugotuj w całości 10 minut, obierz liście i wytnij twarde ogonki.
# Farsz
- Kaszę i ryż ugotuj do półmiękkości.
- Pieczarki i cebulę posiekaj, zeszklij na oleju z czosnkiem.
- Wymieszaj z kaszą, ryżem i przyprawami.
# Duszenie
- Zawijaj farsz w liście i ułóż w garnku.
- Zalej bulionem z koncentratem.
- Duś pod przykryciem 50 minut, sos zagęść mąką ziemniaczaną.
$steps$,
    'VEGETARIAN',
    'POLISH',
    'MEDIUM',
    6, 40, 120,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Gołąbki',
    'Z termorobota',
    2,
    'Mniejsza porcja gołąbków mielonych w termorobocie i duszonych w jednym naczyniu.',
    $ing$
# Farsz
- 300g mięsa mielonego wieprzowo-wołowego
- 80g ryżu
- 1 cebula
- 1 jajko
- sól, pieprz, majeranek
# Kapusta i sos
- 800g kapusty włoskiej
- 400ml bulionu
- 2 łyżki koncentratu pomidorowego
- 1 łyżka mąki pszennej
$ing$,
    $steps$
# Termorobot
- Cebulę posiekaj 5 sekund na prędkości 5.
- Dodaj mięso i majeranek, mieszaj 20 sekund na prędkości 4.
- Ryż ugotuj osobno do półmiękkości i wmieszaj z jajkiem.
# Kapusta
- Kapustę pokrój w szerokie pasy i zwiń z farszem.
- Do naczynia wlej bulion z koncentratem i mąką.
- Duś 45 minut w 100°C, prędkość 1, obrót w lewo.
$steps$,
    'MEAT',
    'POLISH',
    'EASY',
    4, 20, 70,
    true,
    false
);

-- Bigos: baza + 3 warianty. Różnice: dieta, trudność, porcje, termorobot.
select pg_temp.seed_recipe_base(
    'Bigos',
    'Klasyczny',
    'MEAT',
    'POLISH',
    'HARD',
    8, 40, 180
);

select pg_temp.seed_recipe_variant(
    'Bigos',
    'Wegetariański',
    1,
    'Bigos z kapusty kiszonej i świeżej, z soczewicą i wędzoną papryką zamiast mięsa.',
    $ing$
# Baza
- 700g kapusty kiszonej
- 400g kapusty świeżej
- 150g suchej soczewicy zielonej
- 2 cebule
- 2 łyżki koncentratu pomidorowego
- 4 suszone śliwki
# Przyprawy
- 1 łyżka wędzonej papryki
- 2 liście laurowe
- 4 ziarna ziela angielskiego
- 1 łyżka majeranku
- sól, pieprz, kminek
$ing$,
    $steps$
# Przygotowanie
- Soczewicę opłucz i ugotuj 15 minut.
- Cebulę zeszklij, dodaj obie kapusty i koncentrat.
- Dodaj soczewicę, śliwki i przyprawy.
- Duś pod przykryciem 45 minut, aż kapusta zmięknie.
- Dopraw wędzoną papryką i majerankiem.
$steps$,
    'VEGETARIAN',
    'POLISH',
    'MEDIUM',
    6, 30, 90,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Bigos',
    'Z grzybami',
    2,
    'Klasyczny bigos wzbogacony borowikami i podgrzybkami.',
    $ing$
# Mięso
- 400g wieprzowiny
- 150g kiełbasy
# Kapusta i grzyby
- 800g kapusty kiszonej
- 400g kapusty świeżej
- 30g suszonych borowików
- 250g świeżych podgrzybków
- 2 cebule
- 2 łyżki koncentratu pomidorowego
# Przyprawy
- 2 liście laurowe
- 5 ziaren ziela angielskiego
- sól, pieprz, majeranek
$ing$,
    $steps$
# Grzyby
- Borowiki namocz 20 minut, wodę zachowaj.
- Podgrzybki oczyść i pokrój.
# Duszenie
- Mięso podsmaż, cebulę zeszklij.
- Dodaj kapustę, grzyby, wodę z moczenia i koncentrat.
- Duś 90 minut na małym ogniu.
- Pod koniec wrzuć kiełbasę i dopraw majerankiem.
$steps$,
    'MEAT',
    'POLISH',
    'MEDIUM',
    8, 40, 150,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Bigos',
    'Z termorobota',
    3,
    'Bigos na cztery porcje gotowany w termorobocie, z krótszym duszeniem.',
    $ing$
# Składniki
- 300g wieprzowiny
- 100g kiełbasy
- 500g kapusty kiszonej
- 250g kapusty świeżej
- 1 cebula
- 1 łyżka koncentratu pomidorowego
- 1 liść laurowy
- 3 ziarna ziela angielskiego
- sól, pieprz, majeranek
$ing$,
    $steps$
# Termorobot
- Cebulę posiekaj 5 sekund na prędkości 5.
- Mięso pokrój w kostkę, podsmaż 5 minut w 120°C, obrót w lewo.
- Dodaj kapustę, koncentrat i przyprawy.
- Duś 40 minut w 100°C, prędkość 1, obrót w lewo.
- Kiełbasę dodaj na ostatnie 10 minut.
$steps$,
    'MEAT',
    'POLISH',
    'EASY',
    4, 25, 80,
    true,
    false
);

-- Brownie czekoladowe: baza + 4 warianty.
-- Różnice: dieta, trudność, porcje, termorobot. Bezglutenowe jest nazwą i składem.
select pg_temp.seed_recipe_base(
    'Brownie czekoladowe',
    'Klasyczne',
    'VEGETARIAN',
    'AMERICAN',
    'MEDIUM',
    12, 20, 50
);

select pg_temp.seed_recipe_variant(
    'Brownie czekoladowe',
    'Bezglutenowe',
    1,
    'Wilgotne brownie na mące migdałowej i ziemniaczanej, bez mąki pszennej.',
    $ing$
- 200g gorzkiej czekolady (min. 70%)
- 180g masła
- 3 jajka
- 160g cukru
- 80g mąki migdałowej
- 40g mąki ziemniaczanej
- 2 łyżki kakao
- szczypta soli
$ing$,
    $steps$
- Czekoladę rozpuść z masłem i lekko ostudź.
- Jajka ubij z cukrem.
- Wmieszaj czekoladę, potem mąkę migdałową, mąkę ziemniaczaną, kakao i sól.
- Przełóż do formy 20×20 cm.
- Piecz w 170°C przez 22–25 minut. Środek ma zostać wilgotny.
$steps$,
    'VEGETARIAN',
    'AMERICAN',
    'EASY',
    12, 20, 45,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Brownie czekoladowe',
    'Wegańskie',
    2,
    'Brownie bez jajek i masła: na mleku owsianym, oleju i siemieniu lnianym.',
    $ing$
- 180g gorzkiej czekolady
- 120ml oleju rzepakowego
- 200ml mleka owsianego
- 2 łyżki mielonego siemienia lnianego
- 6 łyżek wody
- 180g cukru
- 120g mąki pszennej
- 3 łyżki kakao
- 1 łyżeczka proszku do pieczenia
- szczypta soli
$ing$,
    $steps$
- Siemię wymieszaj z wodą i odstaw na 5 minut.
- Czekoladę rozpuść z olejem i mlekiem owsianym.
- Dodaj siemię, cukier, mąkę, kakao, proszek i sól.
- Piecz w formie 20×20 cm w 180°C przez 25 minut.
$steps$,
    'VEGAN',
    'AMERICAN',
    'MEDIUM',
    12, 20, 50,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Brownie czekoladowe',
    'Z orzechami',
    3,
    'Większa blacha brownie z pekanami i orzechami laskowymi.',
    $ing$
- 250g gorzkiej czekolady
- 220g masła
- 4 jajka
- 220g cukru
- 130g mąki pszennej
- 3 łyżki kakao
- 80g orzechów pekan
- 80g orzechów laskowych
- szczypta soli
$ing$,
    $steps$
- Orzechy posiekaj i podpraż na suchej patelni.
- Czekoladę rozpuść z masłem.
- Jajka ubij z cukrem, wmieszaj czekoladę, mąkę, kakao i sól.
- Wmieszaj orzechy, przełóż do formy 24×24 cm.
- Piecz w 180°C przez 28–32 minuty.
$steps$,
    'VEGETARIAN',
    'AMERICAN',
    'MEDIUM',
    16, 25, 55,
    false,
    false
);

select pg_temp.seed_recipe_variant(
    'Brownie czekoladowe',
    'Z termorobota',
    4,
    'Małe brownie mieszane w termorobocie, dla ośmiu osób.',
    $ing$
- 150g gorzkiej czekolady
- 120g masła
- 2 jajka
- 120g cukru
- 70g mąki pszennej
- 2 łyżki kakao
- szczypta soli
$ing$,
    $steps$
# Termorobot
- Czekoladę i masło topią 3 minuty w 60°C, prędkość 2.
- Dodaj cukier, jajka, kakao i sól, mieszaj 20 sekund na prędkości 4.
- Dodaj mąkę i wmieszaj 10 sekund na prędkości 3.
- Przełóż do formy 18×18 cm.
- Piecz w piekarniku w 180°C przez 18–20 minut.
$steps$,
    'VEGETARIAN',
    'AMERICAN',
    'EASY',
    8, 10, 35,
    true,
    false
);

do $check$
declare
    v_missing text;
begin
    select string_agg(expected.recipe_name || ' / ' || expected.variant_name, ', ')
    into v_missing
    from (
        values
            ('Lasagne', 'Klasyczna'),
            ('Lasagne', 'Wegetariańska'),
            ('Gołąbki', 'Mięsne'),
            ('Gołąbki', 'Wegetariańskie'),
            ('Gołąbki', 'Z termorobota'),
            ('Bigos', 'Klasyczny'),
            ('Bigos', 'Wegetariański'),
            ('Bigos', 'Z grzybami'),
            ('Bigos', 'Z termorobota'),
            ('Brownie czekoladowe', 'Klasyczne'),
            ('Brownie czekoladowe', 'Bezglutenowe'),
            ('Brownie czekoladowe', 'Wegańskie'),
            ('Brownie czekoladowe', 'Z orzechami'),
            ('Brownie czekoladowe', 'Z termorobota')
    ) as expected(recipe_name, variant_name)
    where not exists (
        select 1
        from public.recipes r
        where r.deleted_at is null
          and r.name = expected.recipe_name
          and lower(r.variant_name) = lower(expected.variant_name)
    );

    if v_missing is not null then
        raise exception 'Brakuje wariantów: %', v_missing;
    end if;

    raise notice 'Warianty seedowe są kompletne (14 nazw w 4 grupach).';
end;
$check$;
