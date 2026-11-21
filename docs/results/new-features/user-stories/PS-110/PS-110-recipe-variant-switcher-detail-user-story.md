# PS-110: Przełącznik wariantów na szczegółach przepisu (`/recipes/{id}`, `/explore/recipes/{id}`)

## Opis

Jako **użytkownik oglądający przepis, który ma kilka wariantów**,
chcę **widzieć, który wariant oglądam, i przełączać się między wariantami bez powrotu do list**,
aby **szybko porównać wersje (np. klasyczną i wegetariańską) i wykonywać akcje na właściwym wariancie**.

Źródło: `docs/variants-conception.md`, „Historyjka 3 — Przełącznik wariantów na szczegółach” (sekcje 4, 5, 6
i 8, po korekcie z tej historyjki). Historyjki 4–5 są poza zakresem.

---

## Kontekst (stan obecny, sprawdzony w kodzie)

- PS-108/PS-109: grupa `recipe_families`, kolumny wariantu w `recipes`, `recipe_details` z `variant_name` i
  `active_variant_count`, flaga `recipe_variants` w `/me`, `RecipeVariantSummaryDto` (surowe `chips`) z
  `GET /recipes/{id}/variants` (tylko właściciel).
- `GET /recipes/{id}` (`getRecipeById`): właściciel — zawsze 200; cudzy `PUBLIC` — 200; cudzy nie-`PUBLIC` — 403;
  brak/usunięty — 404. `GET /explore/recipes/{id}`: `PUBLIC` dla wszystkich, inne tylko autor; w pozostałych
  przypadkach 404; klient serwisowy z kontrolą w kodzie.
- Frontend: `recipe-detail-page` (`/recipes/{id}-{slug}`) i `explore-recipe-detail-page`
  (`/explore/recipes/{id}-{slug}`) normalizują slug przez `replaceUrl`, zachowując query params; gość z
  `/recipes/:id` jest przekierowywany na `/explore/recipes/:id` **bez** query params. Wspólny widok:
  `recipe-detail-view`; notatka: `recipe-note`.
- Przełącznika nie ma; szczegóły pokazują dokładnie wariant z `{id}`. `SHARED` widzi dziś wyłącznie właściciel.

---

## Zakres

### W zakresie

1. **Backend (dodatkowo w istniejących endpointach, bez zmiany znaczenia):** `GET /recipes/{id}` i
   `GET /explore/recipes/{id}` przyjmują opcjonalny parametr `variant` (`recipe_id` wariantu tej samej grupy) i
   zwracają dodatkowe pola: listę wariantów (id, nazwa, `is_default`, `sort_order`, chipy różnicujące) oraz
   informację o ewentualnym „ratunku” (powód: parametr błędny/nieaktualny albo wariant usunięty). Odpowiedź
   opisuje wariant faktycznie otwarty (jego `id`, treść, oceny, flagi, notatka, kolekcje, plan).
2. **Rozstrzyganie, który wariant otworzyć** (reguły R1–R4 poniżej), filtrowanie rodzeństwa według uprawnień
   pytającego **w kodzie funkcji**, flaga `recipe_variants` jak w PS-109.
3. **Frontend:** przełącznik wariantów (2–3: segmentowy/zakładki; ≥4: lista rozwijana z nazwą i chipami),
   aktualizacja URL, komunikaty „ratunku”, tytuł „Nazwa · wariant”, tekst „Zapisujesz wariant: X”, akcje na
   wyświetlanym wariancie, dialog niezapisanej notatki, usuwanie całego przepisu z informacją o liczbie wariantów.
4. **Zachowanie `variant` przy przekierowaniu gościa** `/recipes/:id` → `/explore/recipes/:id`.
5. Kontrakty (`shared/contracts/types.ts`) addytywnie; testy jednostkowe (Vitest, `deno test`).

### Poza zakresem

- Grupowanie list i wyszukiwania, reprezentant wyniku, `search_vector`, `total` po grupach (H4); kontekst powrotu
  do wyszukiwania i filtrów oraz oznaczenie „wariant spełnił filtr” (H4); linki z kart z parametrem reprezentanta.
- Panel admina, plan/kolekcje/lista zakupów ponad dzisiejsze zachowanie, limit planu Free, import/AI (H5).
- **RLS na `recipes`** i `security_invoker` na `recipe_details` (sekcja 8 koncepcji, pkt 2).
- **`SHARED` po linku:** przełącznik dla właściciela przy `SHARED` i dla wszystkich przy `PUBLIC`; dostęp
  niewłaściciela do `SHARED` to osobna przyszła historyjka, **blokująca flagę w trybie `all`**.
- Flaga `all`, panel flag, zmiany endpointów wariantów PS-109, zarządzanie wariantami (PS-109), E2E.

### Zależności

**PS-108**, **PS-109** (flaga, `RecipeVariantSummaryDto`, model) — wymagane. Do czasu H4–H5 i historyjki `SHARED`
flaga pozostaje `disabled`/`admin`.

---

## Reguły

- **R1. `{id}` jest wariantem otwieranym.** `/recipes/{id}` i `/explore/recipes/{id}` bez `variant` otwierają
  dokładnie wariant `{id}`, **nie** wariant domyślny.
- **R2. `?variant={recipeId}`** wskazuje inny wariant **tej samej grupy**; równy `{id}` jest dopuszczalny i bez
  skutku. Wariant domyślny jest wyłącznie „ratunkiem”: gdy `variant` nie jest liczbą dodatnią, nie należy do
  grupy `{id}`, jest usunięty albo niedostępny dla pytającego — odpowiedź otwiera wariant domyślny z komunikatem.
- **R3. `{id}` usuniętego wariantu** przy grupie aktywnej i dostępnej dla pytającego: otwórz wariant domyślny z
  komunikatem „Ten wariant został usunięty”. Grupa usunięta albo niedostępna dla pytającego: **404** (w obu
  endpointach, bez ujawniania istnienia; `PRIVATE`/`SHARED` cudzej grupy w `GET /recipes` pozostaje 403 dla
  aktywnego `{id}`, jak dziś).
- **R4. Lista wariantów** obejmuje tylko aktywne warianty dostępne pytającemu: właściciel — wszystkie aktywne
  (także przy `PRIVATE`/`SHARED`); pozostali — wszystkie aktywne tylko przy `PUBLIC`. Filtrowanie w kodzie funkcji
  (klient serwisowy), nie przez RLS. Porządek: `sort_order`.
- **R5. Flaga `recipe_variants`** jak w PS-109 (stan wyliczany dla pytającego; gość tylko przy `all`). Przy fladze
  wyłączonej parametr `variant` jest ignorowany, brak listy wariantów, zachowanie identyczne jak przed PS-110.
- **R6. Chipy różnicujące:** dla wariantu pokazuj tylko cechy (`diet_type`, `is_termorobot`, `is_grill`,
  `difficulty`, `servings`), których wartość różni się od co najmniej jednego innego wariantu grupy; flagi
  logiczne tylko gdy `true`. Wyliczane w backendzie.
- **R7. Akcje dotyczą wariantu wyświetlanego** (id z odpowiedzi, nie z trasy).

---

## Kryteria akceptacji (Given-When-Then)

### Rozstrzyganie wariantu (backend, oba endpointy)

1. **Domyślne otwarcie `{id}`.** *Given* flaga włączona dla pytającego i grupa z wariantami A (domyślny) i B,
   *When* pytający otwiera `GET …/recipes/{B}` bez `variant`, *Then* odpowiedź opisuje wariant B (jego treść i
   `id`), a lista zawiera A i B z oznaczeniem domyślnego.
2. **Parametr wskazuje rodzeństwo.** *Given* jw., *When* `GET …/{A}?variant={B}`, *Then* odpowiedź opisuje wariant
   B (treść, oceny, flagi, notatka, kolekcje i plan **wariantu B**), bez komunikatu „ratunku”.
3. **Parametr równy `{id}`.** *When* `GET …/{A}?variant={A}`, *Then* wynik jak w (1) dla A.
4. **Parametr błędny.** *Given* jw., *When* `variant` jest nieliczbowy, ujemny, nie istnieje, należy do innej
   grupy albo do innego użytkownika, *Then* odpowiedź 200 opisuje wariant domyślny grupy `{id}` i zawiera powód
   „parametr nieaktualny”; **żadnych danych cudzej grupy** nie zwraca się, a status i treść nie zdradzają
   istnienia przepisu spoza grupy.
5. **Parametr wskazuje usunięty wariant.** *Given* wariant C usunięty, *When* `…/{A}?variant={C}`, *Then* jak (4)
   (wariant domyślny + komunikat „wariant usunięty/nieaktualny”).
6. **`{id}` usuniętego wariantu, grupa aktywna i dostępna.** *Given* wariant C usunięty, grupa aktywna, pytający
   to właściciel lub grupa jest `PUBLIC`, *When* `GET …/{C}` (z `variant` lub bez), *Then* 200 z wariantem
   domyślnym, powodem „wariant usunięty” i `id` wariantu domyślnego (frontend może poprawić adres).
7. **`{id}` usuniętego wariantu, grupa niedostępna.** *Given* wariant C usunięty, a grupa usunięta albo
   `PRIVATE`/`SHARED` cudzego właściciela (albo gość), *When* `GET …/{C}`, *Then* 404 (bez ujawnienia, że grupa
   istnieje).
8. **Filtrowanie rodzeństwa wg widoczności.** *Given* grupa `SHARED` lub `PRIVATE`, *When* otwiera ją właściciel,
   *Then* lista zawiera wszystkie aktywne warianty; *When* cudzy użytkownik prosi o aktywny `{id}` w `GET /recipes`,
   *Then* 403, a w `GET /explore` 404 — lista wariantów nigdy nie trafia do niewłaściciela. Przy `PUBLIC`
   każdy pytający (także gość w `explore`) dostaje wszystkie aktywne warianty.
9. **Flaga wyłączona.** *Given* flaga `disabled` dla pytającego (lub `admin` dla zwykłego użytkownika), *When*
   `GET …/{id}?variant={X}`, *Then* `variant` ignorowany, odpowiedź opisuje `{id}`, brak listy wariantów i
   powodu „ratunku”; kształt pozostałych pól bez zmian (zgodność wsteczna).
10. **Jeden wariant.** *Given* grupa z jednym aktywnym wariantem i flaga włączona, *When* `GET …/{id}`, *Then*
    lista ma 1 element (lub jest pominięta wg planu API), a błędny `variant` daje jedynie powód „ratunku”.
11. **Chipy różnicujące.** *Given* wariant „Klasyczna” (dieta: mięsna, termorobot: nie) i „Wegetariańska” (dieta:
    wegetariańska, termorobot: nie), *When* pobrana lista, *Then* chip diety występuje przy obu, a `termorobot` w
    żadnym; cecha identyczna we wszystkich wariantach nie występuje.
12. **Bez przecieku treści.** Lista rodzeństwa zawiera tylko pola podsumowania (bez składników, kroków, notatek).

### Przełącznik (frontend)

13. **Liczba wariantów a widżet.** *Given* otwarty wariant, *When* grupa ma 1 wariant, *Then* brak przełącznika,
    tekstu „Zapisujesz wariant” i sufiksu w tytule; *When* 2–3 warianty, *Then* segmentowy przełącznik/zakładki;
    *When* ≥4, *Then* lista rozwijana z nazwą i chipami każdego wariantu. Przełącznik jest tuż pod nazwą
    przepisu, a aktywny wariant wyróżniony.
14. **Tytuł.** *Given* grupa z ≥2 wariantami, *Then* nagłówek i tytuł karty przeglądarki to „Nazwa · wariant”,
    a przy jednym wariancie — dotychczasowa „Nazwa”.
15. **Przełączenie.** *Given* otwarty wariant A i przełącznik, *When* użytkownik wybiera B, *Then* zmienia się
    cała treść (składniki, kroki, zdjęcie, czasy, oceny, notatka, stany ulubione/plan/kolekcje), adres dostaje
    `?variant={B}` przez `replaceUrl` (bez nowego wpisu w historii), pozostałe query params zostają, a poprzednia
    treść pozostaje widoczna (przyciemniona, bez białego ekranu) do czasu odpowiedzi.
16. **Błąd przełączenia.** *Given* przełączenie na B kończy się błędem (sieć, 404 po zmianie widoczności), *Then*
    użytkownik zostaje na wariancie A z komunikatem błędu, adres i zaznaczenie przełącznika wracają do A.
17. **Odświeżenie i link.** *Given* adres z `?variant={B}`, *When* otwarty na nowo (inna karta, inny użytkownik w
    przypadku `PUBLIC`), *Then* wyświetla dokładnie wariant B, a przełącznik zaznacza B.
18. **Komunikat „ratunku”.** *Given* odpowiedź z powodem „parametr nieaktualny” lub „wariant usunięty”, *Then* nad
    przełącznikiem pojawia się odrzucalny komunikat informacyjny („Wskazany wariant jest niedostępny — pokazujemy
    wariant domyślny” / „Ten wariant został usunięty”), adres jest poprawiony przez `replaceUrl` (bez błędnego
    `variant`; przy usuniętym `{id}` ścieżka z `id` wariantu domyślnego), a po przełączeniu komunikat znika.
19. **Gość.** *Given* gość otwiera `/recipes/{id}?variant={B}`, *Then* przekierowanie na `/explore/recipes/{id}`
    zachowuje `variant`, a przy `PUBLIC` pokazuje wariant B (reszta jak w 17).
20. **Właściciel `SHARED`/`PRIVATE`.** *Given* właściciel grupy `SHARED`/`PRIVATE` z ≥2 wariantami, *Then*
    przełącznik działa jak przy `PUBLIC` (niewłaściciel nie ma dostępu — GWT 8).
21. **Flaga wyłączona w UI.** *Given* odpowiedź bez listy wariantów, *Then* widok wygląda jak przed PS-110.
22. **Zmiana widoczności w trakcie.** *Given* właściciel zmienia otwartą grupę z `PUBLIC` na `PRIVATE`, *When*
    inny użytkownik przełącza wariant lub odświeża, *Then* obowiązuje GWT 16 lub 404/403 jak dziś.
23. **Dostępność i mobile.** *Given* przełącznik, *Then* działa klawiaturą (strzałki/Enter/Spacja), ma nazwę dla
    czytnika ekranu („Wariant przepisu”) i ogłasza wybór; na telefonie (<600 px) zajmuje najwyżej jedną linię albo
    listę rozwijaną, a główna akcja „Dodaj do planu” nie jest przesunięta poza kontekst przepisu.

### Akcje na wariancie

24. **Etykieta zapisu.** *Given* grupa z ≥2 wariantami, *Then* przy akcjach (kolekcja, plan, ulubione, „chcę
    wypróbować”, ocena, notatka) widoczny jest tekst „Zapisujesz wariant: {nazwa}”, aktualizowany po przełączeniu;
    przy jednym wariancie brak tekstu.
25. **Akcja na wyświetlanym wariancie.** *Given* wyświetlany wariant B (adres `/recipes/{A}?variant={B}`), *When*
    użytkownik dodaje do planu/kolekcji, ocenia, oznacza ulubione lub zapisuje notatkę, *Then* operacja używa
    `id` wariantu B (nie `{A}`), a po przełączeniu na A stany odzwierciedlają wyłącznie A. Właściciel edytuje
    wyświetlany wariant (`/recipes/{B}/edit`).
26. **Niezapisana notatka.** *Given* w polu notatki wariantu A są niezapisane zmiany, *When* użytkownik przełącza
    wariant, *Then* dialog Material **Zapisz** / **Odrzuć** / **Anuluj**: Zapisz — zapisuje notatkę A i przełącza;
    Odrzuć — przełącza bez zapisu; Anuluj — zostaje na A (zaznaczenie przełącznika bez zmian).
27. **Usuń przepis.** *Given* właściciel na szczegółach grupy z N≥2 wariantami, *When* wybiera „Usuń przepis”,
    *Then* dialog potwierdzenia informuje, że usunięty zostanie cały przepis wraz z **N wariantami** (przy N=1
    dotychczasowy tekst), a po potwierdzeniu grupa i wszystkie warianty są usunięte, użytkownik wraca jak dziś.

---

## Przypadki brzegowe (poza GWT wprost)

- Długa nazwa wariantu: przełącznik skraca z wielokropkiem, pełna nazwa w `title`/`aria-label`.
- Slug wynika z nazwy grupy (taki sam dla wszystkich wariantów); zmiana wariantu domyślnego nie zmienia adresów
  `{id}` (R1), tylko cel „ratunku”.

## Decyzje i założenia

**Decyzje użytkownika (runda 1):**
1. `{id}` jest otwierany dokładnie; wariant domyślny wyłącznie jako ratunek przy błędnym/nieaktualnym parametrze
   (z komunikatem). Koncepcja (sekcje 4 i 5) skorygowana.
2. `SHARED` po linku **poza** PS-110 (osobna historyjka blokująca flagę `all`); notatka dopisana w sekcjach 6 i 8.
3. `{id}` usuniętego wariantu: aktywna dostępna grupa → wariant domyślny z komunikatem „Ten wariant został
   usunięty”; grupa usunięta/niedostępna → 404.

**Założenia (rozstrzygnięte wariantem rekomendowanym):**
- A1. Flaga `recipe_variants` wyliczana jak w PS-109; przy fladze wyłączonej brak zmian (R5).
- A2. Lista wariantów to dodatkowe pole w `GET /recipes/{id}` i `GET /explore/recipes/{id}` (bez nowego
  endpointu); `variant` w obu; sibling-filtering w kodzie funkcji, nie w RLS/widoku.
- A3. Progi UI i chipy różnicujące (liczone w backendzie) jak w GWT 11, 13–14.
- A5. Przełączenie zawsze ustawia `?variant={recipeId}` (także gdy równy `{id}`), `replaceUrl`, query params
  merge; ścieżka z `{id}` pozostaje, poza przypadkiem usuniętego `{id}` (wtedy id wariantu domyślnego).
- A6. Komunikat „ratunku” to odrzucalny baner nad przełącznikiem, nie `snackbar`; ładowanie z `opacity: 0.5`.
- A7. „Usuń przepis” na szczegółach usuwa całą grupę (`soft_delete_recipe`); zmienia się tylko tekst dialogu.
- A8. Admin bez nowych reguł (jak dziś); kontrakty tylko addytywnie, bez migracji, jeśli `recipe_details` ma
  potrzebne kolumny (otwarta kwestia 2).

## Otwarte kwestie dla planisty

1. **`deno check supabase/functions/explore/index.ts`** zgłasza istniejący dług typów — naprawić addytywnie tylko
   w zakresie pól użytych przez PS-110, bez niezwiązanego refaktoru generatora.
2. **Metadane rodziny w `getRecipeById`** — rozszerzyć addytywnie widok `recipe_details` o metadane aktywnego
   wariantu, a stan usuniętego `{id}` i rodziny sprawdzać kontrolowanym odczytem `recipes`/`recipe_families`.
3. **`public/recipes/{id}`** — pozostaje poza PS-110; historyjka obejmuje wyłącznie endpointy `recipes` i `explore`.
4. **`recipe-note`** — wpiąć dialog GWT 26 przez interfejs przygotowania komponentu notatki przed zmianą wariantu;
   wynik `Zapisz`/`Odrzuć`/`Anuluj` steruje przełączeniem, a `replaceUrl` nie może usuwać lokalnego draftu.
5. **Przekierowanie gościa** — przenieść wszystkie query params do `/explore/recipes/:id` i zachować je przy
   normalizacji sluga, bez pętli.
6. **Pole ratunku i filtrowanie** — użyć addytywnego `variant_resolution` z powodami `INVALID_PARAMETER` /
   `VARIANT_DELETED`; rodzeństwo pobierać i filtrować w kodzie funkcji, nie przez RPC właściciela ani RLS.

### Rozstrzygnięcia planisty

- Nie ma blokera wymagającego pytania użytkownika; powyższe kwestie rozstrzygnięto założeniami planów API i
  widoków.
- Lista jednego wariantu jest zwracana przy aktywnej fladze, ale przełącznik, sufiks tytułu i etykieta zapisu są
  ukrywane w UI.
- Przy dowolnym nieaktualnym parametrze `variant` otwierany jest wariant domyślny; usunięty wariant ma osobny
  powód komunikatu, a błędny/nieliczbowy/obcy parametr powód `INVALID_PARAMETER`.
- Usunięcie z widoku szczegółów zachowuje istniejącą operację grupową; UI jedynie pokazuje liczbę aktywnych
  wariantów.

## Definition of Done

- GWT 1–27 pokryte testami jednostkowymi: `deno test` (rozstrzyganie wariantu, filtrowanie rodzeństwa, chipy,
  flaga, 404/403) i Vitest (przełącznik, URL, komunikat „ratunku”, akcje, dialog notatki, usuwanie, gość).
- Kontrakty addytywne w `shared/contracts/types.ts`; brak regresji dla klientów bez listy wariantów (GWT 9, 21).
- `ng lint` i `ng build` przechodzą; `deno lint`/`deno check` dla `recipes` i `explore` bez nowych błędów.
- Test ręczny w przeglądarce (admin z flagą `admin`): mobile, klawiatura, czytnik ekranu — wynik w weryfikacji.
- Aktualizacja `docs/variants-conception.md` (sekcja 8: stan PS-110) po implementacji.

## Historia zmian

| Data | Etap | Zmiana | Powód |
|---|---|---|---|
| 2026-11-21 | plany implementacji | Rozstrzygnięto kwestie API, widoku, notatki, redirectu gościa i metadanych usuniętych wariantów | Planowanie PS-110 |
| | | | |
