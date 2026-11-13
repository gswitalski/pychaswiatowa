# PS-107: Filtrowanie tabeli przepisów publicznych w panelu administracyjnym

## Opis

Jako **administrator** (rola `admin`),
chcę **filtrować tabelę przepisów publicznych w panelu administracyjnym po polach widocznych w jej kolumnach**,
aby **szybko znaleźć konkretne przepisy (np. słabo oceniane, bez kategorii, danego autora) zamiast przeglądać
wszystkie strony**.

Treść zgłoszenia: „filtrowanie tabeli widoku przepisów w panelu administracyjnym po tych polach, które są
widoczne w kolumnach tabeli".

---

## Kontekst

### Stan obecny (zweryfikowany w kodzie)

- Tabela `/admin/recipes` (`src/app/pages/admin/admin-recipes/`, PS-204) pokazuje przepisy `PUBLIC` bez usuniętych
  (`deleted_at IS NULL`) z paginacją (25/50/100) i sortowaniem po: nazwie, autorze, kategorii, dacie utworzenia,
  średniej ocenie i liczbie ocen. Kolumny bez sortowania: ID, Znaczniki (Grill, Termorobot), Akcja.
- Dane zwraca `GET /admin/recipes` (Edge Function `admin`) przez funkcję bazy `admin_get_recipes_page(page, size,
  sort_by, sort_dir)` (`security definer`, `set row_security = off`, `execute` tylko dla `service_role`).
  Query przyjmuje dziś wyłącznie `page`, `page_size`, `sort_by`, `sort_dir` (Zod, `admin-recipes.types.ts`);
  kontrakty w `shared/contracts/types.ts` (`GetAdminRecipesQueryDto`).
- Funkcja wylicza średnią ocen jako `round(avg(rating), 1)` (`NULL` bez ocen; oceny to 1–5) i liczbę ocen
  (0 gdy brak). Autor: `profiles.username` (może być `NULL`) oraz e-mail z `auth.users` — e-mail jest dziś
  dołączany tylko dla wierszy bieżącej strony.
- Przepis ma jedną, opcjonalną kategorię (`category_id`). Lista kategorii jest dostępna przez istniejące
  `GET /categories` (wymaga zalogowanego użytkownika; admin jest nim także).
- Stany tabeli: ładowanie początkowe, odświeżanie (stare dane widoczne, `opacity`), błąd z „Spróbuj ponownie”,
  pusta lista („Brak przepisów publicznych do wyświetlenia.”), „Brak wyników na tej stronie.”.
- Frontend komunikuje się z bazą wyłącznie przez Edge Functions (`AdminApiService`); filtrowanie ma więc być
  realizowane w bazie i endpointcie, nie w przeglądarce.

---

## Zakres

### W zakresie

- Panel filtrów **nad tabelą** z przyciskami **„Zastosuj”** i **„Wyczyść”**, obejmujący filtry:
  - **ID** — dokładne dopasowanie liczby całkowitej dodatniej,
  - **Nazwa** — tekst, dopasowanie „zawiera”, bez rozróżniania wielkości liter (w tym polskich znaków),
  - **Autor** — jedno pole tekstowe; dopasowanie „zawiera” do nazwy użytkownika **lub** e-maila autora,
  - **Kategoria** — wielokrotny wybór (alternatywa „lub”) z listy kategorii plus pozycja **„Bez kategorii”**,
  - **Data utworzenia** — zakres „od–do” (daty, włącznie z obiema granicami),
  - **Średnia ocena** — zakres „od–do”,
  - **Liczba ocen** — zakres „od–do” (liczby całkowite ≥ 0),
  - **Znaczniki** — pola wyboru „Grill” i „Termorobot”.
- Rozszerzenie `GET /admin/recipes` o parametry filtrów (wszystkie opcjonalne), walidację Zod po stronie serwera,
  rozszerzenie funkcji bazy oraz kontraktów DTO; filtrowanie i `total_items` wykonywane w bazie, przed paginacją.
- Rozszerzenie `AdminApiService`, modeli widoku i komponentów strony/tabeli; stany: ładowanie, błąd, brak wyników
  dla aktywnych filtrów.
- Testy jednostkowe (Vitest, `deno test`).

### Poza zakresem

- Filtr dla kolumny „Akcja”; filtr po polach niewidocznych w tabeli (treść przepisu, składniki, tagi, widoczność).
- Przepisy nie-`PUBLIC` i usunięte (bez zmian względem PS-204).
- Zapis filtrów w URL / `localStorage`, zapisane zestawy filtrów, eksport wyników (CSV).
- Zmiana kolumn, sortowania ani akcji na wierszach; filtrowanie w przeglądarce.
- Wyszukiwanie pełnotekstowe, rozmyte lub po fragmentach słów (tylko „zawiera”).

### Zależności

- Rozszerza PS-204 (tabela, endpoint, funkcja bazy). Wymaga nowej migracji przebudowującej
  `admin_get_recipes_page` (z powtórzonym `revoke`/`grant` i kontrolą `has_function_privilege`, zgodnie z regułą
  backendu); nie zmienia RLS ani modelu danych. Zgodność wsteczna: wywołanie bez filtrów zwraca to samo co dziś.

---

## Reguły filtrowania

- **R1.** Filtry łączą się operatorem **AND**; wewnątrz filtra Kategoria wybrane pozycje łączą się operatorem
  **OR** (w tym „Bez kategorii” = przepisy bez kategorii).
- **R2.** Puste pole = brak filtra; tekst jest przycinany (`trim`) przed użyciem, pusty po przycięciu = brak filtra.
  Znaki specjalne wzorców (`%`, `_`, `\`) są traktowane dosłownie.
- **R3.** **Średnia ocena** jest porównywana z wartością zaokrągloną do 0,1 — tą widoczną w tabeli. Przy
  ustawionym dowolnym końcu zakresu średniej przepisy **bez ocen** (średnia `NULL`) są wykluczone.
  Dozwolone wartości 1,0–5,0, krok 0,1.
- **R4.** **Nieocenione przepisy** wyszukuje się filtrem Liczba ocen **0–0**.
- **R5.** **Znaczniki:** zaznaczony „Grill” = tylko przepisy z flagą Grill; zaznaczony „Termorobot” = tylko z flagą
  Termorobot; oba = przepisy z obiema flagami; niezaznaczone = brak filtra (nie „bez znacznika”).
- **R6.** **Data:** granice to dni kalendarzowe w strefie `Europe/Warsaw`; „do” obejmuje cały wskazany dzień.
- **R7.** **Autor:** autor bez nazwy użytkownika jest znajdowany po e-mailu; dopasowanie jest bez rozróżniania
  wielkości liter. E-mail nie jest nigdzie logowany ani zwracany ponad to, co tabela pokazuje dziś.
- **R8.** Filtry nie zmieniają zakresu bazowego (`PUBLIC`, `deleted_at IS NULL`); `total_items` i paginacja
  dotyczą wyniku po filtrach; sortowanie działa na przefiltrowanym zbiorze.
- **R9.** Walidacja (klient i serwer): tekst ≤ 100 znaków; ID liczba całkowita ≥ 1 (≤ `Number.MAX_SAFE_INTEGER`);
  „od” ≤ „do” w każdym zakresie; liczba ocen całkowita ≥ 0; średnia 1,0–5,0; daty poprawne; identyfikatory
  kategorii liczby całkowite dodatnie (nieistniejąca kategoria nie jest błędem — daje brak wyników).
  Naruszenie po stronie serwera = `400 VALIDATION_ERROR` w formacie `{ code, message, details }`.

---

## Kryteria akceptacji (Given-When-Then)

1. **Panel filtrów.** *Given* administrator na `/admin/recipes`, *When* strona się załaduje, *Then* nad tabelą widzi
   panel z polami ID, Nazwa, Autor, Kategoria, Data od/do, Średnia ocena od/do, Liczba ocen od/do, Znaczniki oraz
   przyciskami „Zastosuj” i „Wyczyść”; bez zastosowanych filtrów tabela pokazuje wszystkie przepisy publiczne jak dziś.
2. **Zastosowanie filtrów.** *Given* wpisane lub wybrane wartości, *When* kliknie „Zastosuj” (lub naciśnie Enter w polu
   tekstowym/liczbowym), *Then* wysyłane jest jedno zapytanie z filtrami, tabela pokazuje pasujące przepisy,
   paginator pokazuje liczbę po filtrach, a widok wraca na **stronę 1**. Sama zmiana wartości w polach nie wywołuje zapytania.
3. **Nazwa.** *Given* przepis „Żurek śląski”, *When* admin zastosuje Nazwa = „ŻUR”, *Then* przepis jest na liście;
   dla „zur” bez polskich znaków nie jest wymagane dopasowanie (ten sam standard `pl-x-icu` co sortowanie).
4. **Autor.** *Given* autor o nazwie „anna_k” i e-mailu `anna@example.com`, *When* admin wpisze „anna_k”,
   „ANNA@EXA” lub „na_k”, *Then* przepisy tego autora są wyświetlone; autor bez nazwy jest znajdowany po e-mailu.
5. **Kategoria — wielokrotny wybór.** *Given* wybrane kategorie „Zupy” i „Desery”, *When* admin zastosuje filtr,
   *Then* widać przepisy z którejkolwiek z nich; po dodaniu „Bez kategorii” także przepisy bez kategorii.
6. **Data.** *Given* zakres od 2026-11-01 do 2026-11-03, *When* zostanie zastosowany, *Then* widać przepisy
   utworzone w tych dniach włącznie (R6); samo „od” lub samo „do” działa jako zakres otwarty.
7. **Średnia ocena.** *Given* zakres średniej 4,0–5,0, *When* zostanie zastosowany, *Then* widać tylko przepisy
   z widoczną w tabeli średnią w tym przedziale, a przepisy bez ocen są wykluczone (R3).
8. **Liczba ocen.** *Given* Liczba ocen 0–0, *When* zostanie zastosowana, *Then* widać tylko przepisy bez ocen;
   dla zakresu 5–10 tylko przepisy z 5 do 10 ocenami.
9. **Znaczniki.** *Given* zaznaczony „Grill”, *When* admin zastosuje filtr, *Then* widać tylko przepisy z flagą Grill;
   po zaznaczeniu także „Termorobot” tylko te z obiema flagami (R5).
10. **ID.** *Given* ID = 42, *When* admin zastosuje filtr, *Then* widać co najwyżej jeden przepis o tym ID
    (lub stan braku wyników, gdy przepis nie jest publiczny/nie istnieje).
11. **Łączenie filtrów.** *Given* kilka wypełnionych filtrów, *When* zostaną zastosowane, *Then* wynik spełnia
    **wszystkie** jednocześnie (R1).
12. **Wyczyść.** *Given* zastosowane filtry, *When* admin kliknie „Wyczyść”, *Then* wszystkie pola wracają do stanu
    pustego, zapytanie jest wysyłane bez filtrów, a widok wraca na stronę 1; sortowanie i rozmiar strony pozostają.
13. **Zachowanie filtrów przy nawigacji w tabeli.** *Given* zastosowane filtry, *When* admin zmieni stronę, rozmiar
    strony lub sortowanie, *Then* zapytanie zawiera **zastosowane** filtry (nie niezatwierdzone zmiany w polach);
    zmiana rozmiaru strony lub sortowania wraca na stronę 1 jak dotychczas.
14. **Brak wyników.** *Given* filtry bez pasujących przepisów, *When* zostaną zastosowane, *Then* panel filtrów
    pozostaje widoczny, a zamiast tabeli pojawia się komunikat „Brak przepisów spełniających wybrane kryteria.”
    z akcją „Wyczyść filtry”; komunikat „Brak przepisów publicznych do wyświetlenia.” pojawia się tylko, gdy
    filtry nie są zastosowane, a baza nie ma żadnych przepisów publicznych.
15. **Walidacja formularza.** *Given* „od” większe niż „do”, tekst dłuższy niż 100 znaków, ID nie będące liczbą
    całkowitą ≥ 1 lub liczba ocen ujemna/ułamkowa, *When* admin kliknie „Zastosuj”, *Then* przy polu pojawia się
    komunikat błędu po polsku, zapytanie nie jest wysyłane, a poprzedni wynik pozostaje widoczny.
16. **Serwer — walidacja.** *Given* ręcznie wywołane `GET /admin/recipes` z niepoprawnym filtrem (np. `ratings_count_min=-1`,
    `rating_min=6`, odwrócony zakres), *When* żądanie dotrze do serwera, *Then* odpowiedź to `400 VALIDATION_ERROR`.
17. **Uprawnienia.** *Given* użytkownik bez roli `admin` lub gość, *When* wywoła `GET /admin/recipes` z filtrami,
    *Then* dostaje `403`/`401` jak dziś; funkcja bazy pozostaje wykonywalna wyłącznie dla `service_role`.
18. **Błąd serwera.** *Given* błąd podczas filtrowania, *When* żądanie się nie powiedzie, *Then* panel filtrów i
    wpisane wartości zostają, a tabela pokazuje błąd z „Spróbuj ponownie” (z zachowaniem zastosowanych filtrów);
    przy odświeżaniu poprzednie dane pozostają widoczne (`opacity`, bez białej nakładki).
19. **Zgodność wsteczna.** *Given* wywołanie `GET /admin/recipes` bez parametrów filtrów, *When* zostanie wykonane,
    *Then* odpowiedź jest identyczna jak przed zmianą (sortowanie domyślne, paginacja, kontrakt odpowiedzi).
20. **Responsywność i dostępność.** *Given* ekran < 960 px, *When* admin otworzy stronę, *Then* panel filtrów jest
    zwijany/rozwijany (domyślnie zwinięty) i pokazuje liczbę aktywnych filtrów; wszystkie pola mają etykiety i
    `aria-label`, są obsługiwane klawiaturą, błędy walidacji są powiązane z polami (`aria-describedby`), a zmiana
    liczby wyników jest ogłaszana czytnikom ekranu (`aria-live`).

---

## Przypadki brzegowe

- Autor bez nazwy użytkownika i bez e-maila (usunięte konto): znajdowany tylko przy braku filtra Autor; filtr
  Autor go wyklucza.
- Kategoria usunięta/nieistniejąca w zapisanym wyborze: ignorowana przy renderze listy; zapytanie z nieistniejącym
  identyfikatorem zwraca 0 wyników, nie błąd.
- Zakres średniej `4,0–4,0`: wartości zaokrąglone do 0,1 równe 4,0 (np. surowa 3,96 → 4,0 pasuje, jak w tabeli).
- Szybkie wielokrotne kliknięcia „Zastosuj”: obowiązuje wynik ostatniego żądania.

---

## Decyzje i założenia

### Decyzje użytkownika (runda 1)

1. **Autor:** jedno pole, nazwa użytkownika lub e-mail, dopasowanie „zawiera”.
2. **Średnia ocena i liczba ocen:** zakresy „od–do” dla obu; przy filtrze średniej przepisy bez ocen są wykluczone;
   nieocenione = liczba ocen 0–0.
3. **Kategoria:** wielokrotny wybór (alternatywa „lub”) plus „Bez kategorii”.
4. **Układ:** panel filtrów nad tabelą z przyciskami „Zastosuj” i „Wyczyść”.

### Założenia (rekomendacje przyjęte bez pytania — do potwierdzenia przy przeglądzie)

- **Zakres filtrów:** kolumny ID, Nazwa, Data utworzenia i Znaczniki także są filtrowane (ID dokładnie; Nazwa
  „zawiera”; Data zakres; Znaczniki wg R5); kolumna Akcja — nie.
- **Logika:** AND między filtrami, OR wewnątrz Kategorii. Zastosowanie/wyczyszczenie filtra wraca na stronę 1.
- **Filtrowanie po stronie bazy**, w funkcji `admin_get_recipes_page` (przed paginacją); nowa migracja przebudowuje
  funkcję, dopisuje parametry filtrów i powtarza `revoke`/`grant` + kontrolę uprawnień. Nazwy parametrów query są
  ustalane w planie API (kategorie jako lista identyfikatorów z tokenem dla „Bez kategorii”).
- **Maks. długość tekstu:** 100 znaków (Nazwa, Autor) — spójnie po stronie klienta i serwera.
- **Średnia:** porównanie na wartości zaokrąglonej do 0,1 (spójnie z kolumną); zakres 1,0–5,0.
- **Strefa dat:** `Europe/Warsaw`. Tabela formatuje daty w strefie przeglądarki; przy użytkownikach spoza Polski
  mogą wystąpić różnice na granicy dnia — akceptowane (otwarta kwestia 3).
- **Stan filtrów** żyje tylko w stanie komponentu (bez URL i storage); odświeżenie strony czyści filtry.
- **Stan pusty:** odróżnienie „brak przepisów” od „brak wyników dla filtrów” (kryterium 14).
- **Lista kategorii** pobierana istniejącym `GET /categories` (bez nowego endpointu); błąd pobrania kategorii
  nie blokuje pozostałych filtrów (pole Kategoria pokazuje komunikat o niedostępności z możliwością ponowienia).

### Otwarte kwestie (rozstrzygnięte rekomendacją, do weryfikacji w planie/implementacji)

1. **Wydajność:** dotychczas e-mail jest dołączany tylko dla wierszy strony; filtr Autor wymaga dołączenia
   `auth.users` do całego zbioru, więc join wykonywać warunkowo (tylko przy aktywnym filtrze Autor). Skala to
   przepisy publiczne (rząd tysięcy); osobne indeksy (np. `pg_trgm`) **nie** są wymagane w tej historyjce —
   do rewizji po pomiarze (smoke na danych produkcyjnych).
2. **Odporność na wzorce:** wyszukiwanie „zawiera” realizować przez `strpos`/`ILIKE` z escapowaniem znaków
   specjalnych (R2), bez dynamicznego SQL budowanego z danych wejściowych.
3. **Strefa czasowa:** do rewizji, gdyby admini pracowali poza strefą `Europe/Warsaw`.
4. **Dostępność:** komunikat `aria-live` o liczbie wyników tylko po „Zastosuj”/„Wyczyść”, nie przy zmianie strony.

---

## Definition of Done

- Panel filtrów i wszystkie filtry z kryteriów 1–20 działają na `/admin/recipes` na desktopie i < 960 px.
- Migracja przebudowuje `admin_get_recipes_page` zgodnie z regułą `security definer` (`revoke`, `grant` tylko dla
  `service_role`, kontrola `has_function_privilege`); `GET /admin/recipes` waliduje filtry (Zod) i zachowuje
  zgodność wsteczną; kontrakty w `shared/contracts/types.ts` zaktualizowane; typy bazy odświeżone.
- Testy jednostkowe: Vitest (`AdminApiService`, modele/walidacja formularza, komponent panelu filtrów, strona i
  tabela — stany: brak wyników, błąd, reset strony, zachowanie zastosowanych filtrów przy paginacji/sortowaniu) oraz
  `deno test` (walidacja query, handler, serwis). Bez E2E.
- `ng lint`, `ng build` oraz `deno lint`/`deno check` dla `supabase/functions/admin` przechodzą bez błędów.
- Weryfikacja ręczna: filtry (w tym polskie znaki, e-mail autora, „Bez kategorii”, 0–0 ocen) na lokalnej bazie;
  status weryfikacji zapisany jako `PASS`/`FAIL`/`NIE_WYKONANO`/`WYMAGA_WERYFIKACJI`.
- `project-summary.md` zaktualizowany (jeden wiersz PS-107) na etapie summary.

---

## Historia zmian

| Data | Etap | Zmiana | Powód |
|------|------|--------|-------|
