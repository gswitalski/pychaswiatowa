# PS-115: Nazwy wariantów w jednym wierszu karty i krótszy stan na szczegółach

## Opis

Jako **użytkownik przeglądający listy przepisów**,
chcę **widzieć pod nazwą przepisu nazwy jego wariantów w jednym wierszu**,
aby **od razu rozpoznać wersje bez liczników i bez dodatkowego wiersza pod zdjęciem**.

Jako **użytkownik oglądający szczegóły przepisu**,
chcę **nie widzieć przy przełączniku napisów „w planie” i „ocena N”**,
aby **stan wariantu nie powtarzał informacji, które i tak są przy przycisku planu i w ocenie**.

Źródło: doprecyzowanie po PS-108–PS-112 i `docs/variants-conception.md` (karta grupy i znaczniki
przełącznika). Układ wiersza nazw rozstrzygnięto w rundzie pytań (opcja 1).

---

## Kontekst (stan obecny, sprawdzony w kodzie)

- Wspólna karta `pych-recipe-card` jest na listach: Moje przepisy, Eksploruj, kolekcje, pulpit
  (ostatnie przepisy) i wyniki publiczne. Przy co najmniej dwóch wariantach pokazuje osobno nazwę
  reprezentanta oraz skrót: „N wariantów”, przy filtrze „pasują M z N” (do trzech nazw i „+N”),
  a w kolekcji „zapisano X z Y”.
- Nazwy pasujących wariantów są obcinane do trzech: w `get_recipes_list` (`limit 3`) oraz w
  `groupRecipeListCandidates` (`.slice(0, 3)` plus `matching_variant_overflow`). Kolejność w SQL to
  `sort_order`, potem `id`; w grupowaniu w pamięci — kolejność kandydatów, nie kolejność rodziny.
- Zdjęcie, link i `?variant=` prowadzą do reprezentanta (PS-111). Jeden wariant nie ma wiersza wariantu.
- Na szczegółach (`recipe-detail-view`) `span.variant-state` jest przy zakładkach (2–3 warianty, przy
  każdym) i pod listą (4+, dla aktywnego). Teksty: ulubiony, chcę wypróbować, w planie, w kolekcji,
  notatka, ocena N. Widget oceny, przycisk planu i przełącznik są osobno.
- Poza kartą: pasek boczny pokazuje samą nazwę przepisu; omnibox — „Nazwa · wariant” reprezentanta;
  plan i lista zakupów — `formatRecipeVariantLabel`.

---

## Zakres

### W zakresie

1. **Karta (N ≥ 2):** jeden wiersz nazw pod nazwą przepisu, separator „ · ”, bez liczby wariantów,
   bez osobnej nazwy reprezentanta i bez „+N”.
2. **Listy zasilające kartę** zwracają pełne nazwy pasujących wariantów (nie trzy) w kolejności rodziny.
3. **Szczegóły:** z obu `span.variant-state` znikają „w planie” i „ocena N”; pusty span się nie renderuje.

Wymaga zmiany API list (`apiSkipped: false`). Sam widok szczegółów nie wymaga nowego pola ani endpointu.

### Poza zakresem

- Pasek boczny, omnibox, plan, lista zakupów, formularz edycji, tabela administratora, dialog
  „Usuń z kolekcji”.
- Wybór reprezentanta, link, `?variant=`, zdjęcie, chipy, serduszko ulubionego, widoczność, kategoria.
- Widget oceny, przycisk planu, przełącznik wariantów i dane `user_action_state` (pola zostają w odpowiedzi).
- Flaga `recipe_variants`, RLS, limit rodziny (10), wyszukiwanie i grupowanie poza listą nazw.

### Zależności

**PS-108–PS-112** — wymagane (model, przełącznik, grupowanie list, znaczniki stanu).

---

## Reguły

- **R1. Kiedy jest wiersz.** Tylko przy włączonej fladze i co najmniej dwóch wariantach dostępnych
  pytającemu. Przy jednym wariancie albo wyłączonej fladze karta jest jak dziś: sama nazwa przepisu,
  bez wiersza i bez liczby.
- **R2. Treść wiersza.** Nazwy wariantów, które spełniły bieżące wyszukiwanie lub filtr. Bez filtra są to
  warianty rodziny dostępne pytającemu. Kolejność: `sort_order`, potem `id` — nie trafność i nie
  „reprezentant pierwszy”. Separator: „ · ” (kropka środkowa ze spacjami). Nazwy techniczne
  („Wariant podstawowy”, „Podstawowa”), jeśli są zapisane, wchodzą do wiersza. Pusta nazwa po `trim`
  jest pomijana. Nie ma „N wariantów”, „pasują M z N”, „+N” ani „zapisano X z Y”.
- **R3. Ucięcie wizualne.** Wiersz jest jeden i ucina się wielokropkiem. Pełny tekst (te same nazwy
  i separator) jest w podpowiedzi (`title`) i w etykiecie czytnika ekranu linku karty, razem z nazwą
  przepisu. Nazwa reprezentanta w wierszu nie jest pogrubiona, nie jest chipem i nie zmienia kolejności.
- **R4. Wejście z karty.** Zdjęcie, link i `?variant=` nadal otwierają dotychczasowego reprezentanta
  (PS-111). Zdjęcie może przedstawiać inny wariant niż pierwsza nazwa w wierszu.
- **R5. Kolekcja.** Wiersz pokazuje nazwy wariantów zapisanych w tej kolekcji (te, które dziś wchodzą
  do grupy), w kolejności rodziny. Wariantów spoza kolekcji nie dociągamy.
- **R6. Stan na szczegółach.** W obu miejscach `span.variant-state` zostają wyłącznie: ulubiony,
  chcę wypróbować, w kolekcji, notatka — ta sama kolejność i brzmienie. „w planie” i „ocena N” znikają.
  Gdy żaden z czterech napisów nie dotyczy wariantu, span nie jest w drzewie. Gość i wyłączona flaga
  bez zmian (brak tych spanów). Widget oceny, przycisk planu i przełącznik zostają.
- **R7. Lista nazw.** `matching_variant_names` zawiera wszystkie nazwy z R2, do limitu rodziny (dziś 10).
  `matching_variant_overflow` nie służy już do chowania nazw: po zmianie wynosi 0. Dotyczy
  `get_recipes_list` i `groupRecipeListCandidates` (Eksploruj, wyniki publiczne, kolekcje). Pasek boczny
  i omnibox tych nazw nie rysują.

---

## Kryteria akceptacji (Given-When-Then)

### Karta

1. **Dwa i więcej, bez filtra.** *Given* flaga włączona i „Lasagne” z wariantami Klasyczna (`sort_order` 0),
   Wegańska (1), Bezglutenowa (2), *When* użytkownik otwiera listę bez wyszukiwania i filtrów,
   *Then* pod nazwą jest jeden wiersz „Klasyczna · Wegańska · Bezglutenowa”, bez liczby, bez osobnej
   nazwy reprezentanta i bez „+N”.
2. **Jeden wariant.** *Given* grupa z jednym wariantem, także „Wariant podstawowy”, *Then* karta nie ma
   wiersza wariantu ani liczby.
3. **Filtr.** *Given* N = 3 i filtr spełniony tylko przez Wegańską i Bezglutenową, *Then* wiersz to
   „Wegańska · Bezglutenowa” (kolejność rodziny), bez „pasują 2 z 3” i bez „+N”.
4. **Długi wiersz i nazwa techniczna.** *Given* nazwy nie mieszczą się w jednej linii, a wśród nich jest
   „Wariant podstawowy”, *Then* wiersz jest jeden, ucięty wielokropkiem, nazwa techniczna jest w tekście,
   a podpowiedź i etykieta czytnika zawierają pełną listę wraz z nazwą przepisu.
5. **Reprezentant bez wyróżnienia.** *Given* wyszukiwanie, którego reprezentant nie jest pierwszy w
   kolejności rodziny, *When* użytkownik klika kartę, zdjęcie albo link, *Then* otwiera się ten
   reprezentant (`?variant=`), a jego nazwa w wierszu wygląda jak pozostałe.
6. **Kolekcja.** *Given* w kolekcji są dwa z trzech wariantów grupy, *Then* wiersz ma nazwy tych dwóch,
   bez „zapisano X z Y” i bez nazwy wariantu, którego w kolekcji nie ma.
7. **Te same listy.** *Given* N ≥ 2, *Then* wiersz z R2–R4 jest na Moich przepisach, w Eksploruj,
   w kolekcji, na pulpicie i w wynikach publicznych. Pasek boczny, omnibox, plan, lista zakupów,
   formularz i tabela administratora wyglądają jak przed tą historyjką.
8. **Stany listy.** *Given* ładowanie, pusta lista albo błąd, *Then* komunikaty są jak dziś; karta
   bez danych wariantu (flaga wyłączona) nie pokazuje wiersza.

### Szczegóły

9. **Zakładki.** *Given* 2–3 warianty, przy jednym „ulubiony” i „w planie”, przy drugim tylko „ocena 4”,
   przy trzecim „notatka”, *Then* przy pierwszym zostaje „ulubiony”, przy drugim nie ma spanu,
   przy trzecim zostaje „notatka”.
10. **Lista 4+.** *Given* co najmniej cztery warianty i aktywny wariant tylko „w planie” oraz z oceną,
    *Then* span pod listą się nie pokazuje; po przełączeniu na wariant „w kolekcji” span pokazuje
    „w kolekcji”.
11. **Zostają akcje.** *Given* przepis publiczny z oceną i wpisem w planie, *Then* widget oceny,
    przycisk planu i przełącznik działają jak dotąd; znikają tylko napisy w `span.variant-state`.

### Lista nazw (API)

12. **Pełna lista.** *Given* cztery pasujące warianty, *When* lista (Moje przepisy albo grupowanie
    Eksploruj/publiczne/kolekcji) zwraca kartę, *Then* `matching_variant_names` ma cztery nazwy w
    kolejności `sort_order`, `id`, a `matching_variant_overflow` wynosi 0.

---

## Przypadki brzegowe

- Po odfiltrowaniu pustych nazw zostaje zero nazw przy N ≥ 2: wiersz się nie renderuje; link z
  `?variant=` zostaje.
- Limit rodziny (10) jest sufitem liczby nazw; „+N” nie wraca, nawet gdyby nazw było więcej.
- Wskaźniki karty (serduszko, „w planie” na danych reprezentanta, o ile lista je dziś zwraca) bez zmian.
- Span przy 2–3 dotyczy każdego wariantu z osobna; przy 4+ tylko aktywnego. Przełączenie odświeża span.
- Gość na szczegółach nie widzi `span.variant-state` (jak dziś).

## Znane ograniczenia

- Kolejność wiersza nie podąża za trafnością wyszukiwania, więc pierwsza nazwa może nie być wariantem
  ze zdjęcia. To świadoma decyzja rundy pytań.
- Na karcie kolekcji nie widać, ile wariantów rodziny jest poza kolekcją — znika „zapisano X z Y”.

## Decyzje i założenia

**Decyzja użytkownika (runda 1, układ nazw):** przy dwóch i więcej wariantach pod nazwą przepisu jest
jeden wiersz nazw połączonych kropką środkową, bez liczby i bez osobnej nazwy wariantu ze zdjęcia.
Karta jest krótsza; zdjęcie może przedstawiać inny wariant niż pierwsza nazwa.

**Założenia wcielone z rundy pytań:**

- A1. Jeden wariant: karta bez wiersza i bez liczby.
- A2. Separator to istniejące „ · ”, nie kropka kończąca zdanie.
- A3. Wiersz = nazwy spełniające bieżące wyszukiwanie lub filtr; bez filtra = warianty rodziny,
  kolejność rodziny, do limitu 10. Znikają „N wariantów”, „pasują M z N”, „+N” i „zapisano X z Y”.
- A4. Lista oddaje nazwy w całości (dziś obcina do trzech). Na karcie jeden wiersz z wielokropkiem;
  pełna treść w podpowiedzi i w etykiecie czytnika. Nazwy techniczne są widoczne.
- A5. Zdjęcie, link i `?variant=` otwierają dotychczasowego reprezentanta; jego nazwa w wierszu
  nie jest wyróżniona.
- A6. Zmiana karty: Moje przepisy, Eksploruj, kolekcje, pulpit, wyniki publiczne. Poza zakresem:
  pasek boczny, plan, lista zakupów, formularz, tabela administratora.
- A7. Na szczegółach, w obu `span.variant-state`, znikają „w planie” i „ocena N”. Zostają: ulubiony,
  chcę wypróbować, w kolekcji, notatka. Pusty span się nie pokazuje. Widget oceny, przycisk planu
  i przełącznik zostają.

**Założenie doprecyzowane przy zapisie (nie było osobnego pytania):**

- A8. W kolekcji „filtrem” jest zapisanie wariantu: wiersz ma nazwy zapisanych wariantów, nie całej
  rodziny. Omnibox zostaje przy „Nazwa · wariant” reprezentanta — to nie jest wspólna karta.

## Otwarte kwestie dla planisty

1. **Dwa miejsca obcięcia do trzech:** `limit 3` w `get_recipes_list` oraz `.slice(0, 3)` w
   `groupRecipeListCandidates`. Oba mają zwracać pełną listę w kolejności `sort_order`, `id`;
   overflow = 0. Bez nowego pola DTO.
2. **Szczegóły** tylko w szablonie `recipe-detail-view`: nie usuwać `in_plan` ani `my_rating` z DTO.

## Definition of Done

- GWT 1–12 pokryte testami jednostkowymi: Vitest (karta: wiersz, brak liczby, ucięcie i etykieta,
  jeden wariant, kolekcja bez „zapisano”) oraz `deno test` (pełne nazwy, kolejność rodziny, overflow 0).
  Vitest szczegółów: oba miejsca spanu, ukrycie pustego spanu, zostają cztery napisy. Bez E2E.
- `ng lint` i `ng build` przechodzą; `deno lint` / `deno check` dla zmienianych funkcji bez nowych błędów.
- Test ręczny karty (lista z filtrem i bez, kolekcja, wąski ekran, czytnik) i szczegółów (2–3 oraz 4+)
  — wynik w weryfikacji.

## Historia zmian

| Data | Etap | Zmiana | Powód |
|---|---|---|---|
| 2026-11-24 | Analiza | Utworzono historyjkę | Zapis po rundzie pytań (układ nazw na karcie) |
