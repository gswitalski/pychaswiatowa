# PS-99: Ocenianie przepisu w skali 1–5 — Plan wdrożenia

> **User Story:** PS-99 — Ocenianie przepisu w skali 1–5
> **Data:** październik 2026
> **Środowisko docelowe:** Supabase Cloud (baza + Edge Functions) + Firebase Hosting (frontend)

---

## 1. Podsumowanie

PS-99 wymaga **zmiany schematu bazy danych** (nowa tabela `recipe_ratings`, RPC `set_recipe_rating`, rozszerzenie widoku `recipe_details`), ale wszystkie kroki wdrożeniowe wykonują się **automatycznie** w workflow `.github/workflows/main-deploy.yml` (push do `main`), w tej kolejności:

1. `test` — testy jednostkowe (`npm run test:run`),
2. `deploy-backend` — `supabase db push` (migracja) → `supabase secrets set` → `supabase functions deploy …` (w tym istniejące `recipes`, `public`, `explore`),
3. `deploy-frontend` — build i Firebase Hosting.

Kolejność gwarantuje, że tabela, widok i RPC istnieją, zanim zacznie działać nowy kod funkcji, a nowy frontend trafia na hosting dopiero po backendzie. Zmiana API jest **wstecznie zgodna**: nowe pola są addytywne, a nowy endpoint nie wpływa na istniejące. Stare funkcje wybierają jawne listy kolumn z widoku, więc dodatkowe kolumny widoku niczego im nie psują. Krótkie okno, w którym działa jeszcze stary frontend lub stare funkcje, jest bezpieczne.

Poniżej wyłącznie kroki **ręczne** — przed merge'em, po wdrożeniu oraz na wypadek wycofania.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Nowa usługa zewnętrzna, konto, klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** (funkcjonalność nie używa zmiennych) |
| GitHub Secrets | **Brak** |
| Migracja SQL | Automatyczna (`supabase db push`); ręcznie tylko **weryfikacja przed merge'em** (krok 1) i **po wdrożeniu** (krok 3) |
| Nowa Edge Function / zmiana workflow | **Brak** — endpoint jest w istniejącej funkcji `recipes`; lista `functions deploy` w workflow się nie zmienia |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / konfiguracja domeny | **Brak** |
| Clickio / Google Analytics / OAuth | **Brak** |
| Testy E2E (Playwright) | **Ręcznie** — workflow wdrożeniowy uruchamia tylko testy jednostkowe |

---

## 2. Krok 1 — Przed merge'em do `main` (weryfikacja migracji)

**Cel:** uniknąć sytuacji, w której `supabase db push` w CI zakończy się błędem po merge'u i zablokuje deploy backendu oraz frontendu. Migracja jest bardziej wrażliwa niż w PS-95, bo **przebudowuje widok `recipe_details`**, z którego korzystają listy, wyszukiwanie i szczegóły.

1. **Znacznik czasu migracji.** Plik `supabase/migrations/20261027120000_create_recipe_ratings.sql` musi mieć znacznik **większy** niż najnowsza migracja zastosowana na produkcji. Sprawdzić lokalnie z projektem połączonym z produkcją:

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

    Jeśli kolumny *Local* i *Remote* się rozjeżdżają albo na produkcji jest migracja o większym znaczniku (np. wprowadzona ręcznie w SQL Editorze), naprawić przed merge'em (`supabase migration repair --status applied <znacznik>` lub zmiana znacznika nowej migracji). Inaczej `db push` odrzuci migrację jako „out of order".

2. **Definicja widoku zgodna z produkcją.** `create or replace view` wymaga, aby dotychczasowe kolumny widoku były **identyczne** (nazwy, typy, kolejność). Porównać definicję produkcyjną z kopią w migracji:

    ```sql
    select pg_get_viewdef('public.recipe_details'::regclass, true);
    ```

    Wynik (bez dwóch nowych kolumn na końcu) ma odpowiadać `20260118120300_update_recipe_details_view_for_normalized_ingredients.sql`. Jeśli produkcja zawiera zmiany wprowadzone poza migracjami, najpierw je wprowadzić do repozytorium. Inaczej migracja zakończy się błędem `cannot change name/data type of view column`.

3. **Suchy przebieg migracji na produkcyjnej bazie:**

    ```bash
    supabase db push --dry-run
    ```

    Oczekiwane: na liście do zastosowania **wyłącznie** `20261027120000_create_recipe_ratings.sql`.

4. **Lokalny test na czystej bazie** (Docker + Supabase CLI): `supabase db reset`, a następnie sprawdzenie, że migracja przechodzi bez błędów, tabela `recipe_ratings`, funkcja `set_recipe_rating` i nowe kolumny widoku (`ratings_count`, `average_rating`) istnieją.

5. **Test RLS i RPC lokalnie na dwóch kontach** (A — autor, B — czytelnik), z jednym przepisem `PUBLIC` i jednym `PRIVATE` autora A:

    | Wywołanie | Oczekiwany wynik |
    |---|---|
    | B: `PUT /recipes/{publiczny}/rating` `{ "rating": 4 }` | `200`, `my_rating: 4`, `ratings_count: 1`, `average_rating: 4` |
    | B: to samo żądanie ponownie | `200`, ten sam wynik (idempotencja) |
    | B: `{ "rating": 2 }` | `200`, `my_rating: 2`, `ratings_count: 1` |
    | B: `{ "rating": null }` | `200`, `my_rating: null`, `average_rating: null`, `ratings_count: 0` |
    | A: `PUT /recipes/{własny publiczny}/rating` | `403` |
    | B: `PUT /recipes/{prywatny A}/rating` | `404` |
    | B: `{ "rating": 0 }`, `6`, `4.5`, `"4"`, brak pola | `400` |
    | B: `PUT` bez JWT | `401` |
    | B: `GET /recipes/{id}/rating` | `405` |
    | A i B: `select * from recipe_ratings` (SQL jako dany użytkownik) | każdy widzi tylko własne wiersze |
    | A: zmiana przepisu na `PRIVATE`, następnie `GET /recipes/{id}` | `average_rating`, `ratings_count`, `my_rating` = `null`; po powrocie do `PUBLIC` wartości wracają |

6. **Regresja widoku i wydajność.** Zapytania list nie powinny płacić za agregaty. Na lokalnej bazie z kilkuset przepisami porównać plan przed i po migracji:

    ```sql
    explain (analyze, buffers)
    select id, name, user_id, visibility from public.recipe_details limit 12;
    ```

    Oczekiwane: w planie **brak** odwołań do `recipe_ratings` (podzapytania są przycinane, gdy kolumny nie są wybierane). Dla szczegółów (`select … ratings_count, average_rating … where id = …`) oczekiwany jest `Index Only Scan` / `Index Scan` po `idx_recipe_ratings_recipe_id`. Jeśli lista odwołuje się do `recipe_ratings`, **nie wdrażać** — zgłosić problem i przejść na wariant z osobnym zapytaniem o agregaty.

7. **Typy bazy** (`supabase/functions/_shared/database.types.ts`, `shared/types/database.types.ts`) wygenerowane po migracji i zacommitowane w tym samym PR — CI ich nie generuje. Sprawdzić, że `npm run build` i `tsc` przechodzą po nadpisaniu kolumn widoku w `RecipeDetailDto`.

8. **Testy E2E (Playwright)** — workflow wdrożeniowy ich nie uruchamia. Wykonać lokalnie lub na środowisku dev/staging **przed merge'em** (scenariusze z planu UI, pkt 4).

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. W GitHub Actions obserwować job **Deploy Backend (Supabase)** — krok **Push database migrations** musi zakończyć się sukcesem **przed** krokiem **Deploy Edge Functions**.
2. W razie błędu migracji **nie** ponawiać deployu na ślepo: poprawić przyczynę (zwykle konflikt znaczników z kroku 1 lub rozbieżna definicja widoku) i uruchomić pipeline ponownie. Nie edytować migracji, która została już zastosowana na produkcji — poprawki robić nową migracją.
3. Po zakończeniu **Deploy Frontend (Firebase)** odczekać na propagację hostingu, następnie wykonać krok 3.

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (checklista manualna)

### 4.1 Baza danych (panel Supabase)

- [ ] `Table Editor`: tabela `recipe_ratings` istnieje, **RLS włączony**.
- [ ] `Authentication → Policies`: 4 polityki na `recipe_ratings` (`select`, `insert`, `update`, `delete`), wszystkie dla roli `authenticated`.
- [ ] `Database → Functions`: `set_recipe_rating(bigint, smallint)` istnieje, **`security definer`**, `search_path` ustawiony na pusty; uprawnienie `EXECUTE` tylko dla `authenticated` (brak dla `anon` i `public`).
- [ ] `Database → Views`: `recipe_details` zawiera kolumny `ratings_count` i `average_rating`, uprawnienie `select` dla `authenticated` zachowane.
- [ ] `Database → Advisors` (Security / Performance): brak nowych ostrzeżeń dla `recipe_ratings` (np. „RLS disabled", brak indeksu na kluczu obcym). Ostrzeżenie o `security definer` dla `set_recipe_rating` jest oczekiwane i uzasadnione (agregaty ponad RLS); upewnić się, że `search_path` jest ustawiony.
- [ ] `Database → Migrations`: migracja `20261027120000` widoczna jako zastosowana.

### 4.2 API (produkcja, dwa konta testowe: A — autor, B — czytelnik, jeden przepis `PUBLIC` autora A)

- [ ] `PUT /recipes/{id}/rating` jako B: `{ "rating": 4 }` → `200` z `my_rating: 4`, `ratings_count` +1; `{ "rating": 5 }` → zmiana, `ratings_count` bez zmian; `{ "rating": null }` → wycofanie, `ratings_count` −1.
- [ ] Powtórzone to samo `PUT` → ten sam wynik; w `Table Editor` brak zmiany `updated_at` wiersza.
- [ ] `GET /explore/recipes/{id}` jako B: zawiera `average_rating`, `ratings_count`, `my_rating`; jako A: `my_rating: null`; **bez JWT: `average_rating` i `ratings_count` obecne, `my_rating` nieobecne**.
- [ ] `GET /public/recipes/{id}` i `GET /recipes/{id}`: te same pola; `Cache-Control: no-store` z JWT, `public, max-age=60` bez JWT.
- [ ] `PUT` jako A na własnym przepisie → `403`; jako B na `PRIVATE` autora A → `404`.
- [ ] Przepis `PRIVATE`/`SHARED` w `GET /recipes/{id}` (jako autor): `average_rating`, `ratings_count`, `my_rating` = `null`.
- [ ] Ocena nie zmienia `recipes.updated_at` przepisu.
- [ ] Regresja list: `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, wyszukiwanie — odpowiedzi bez zmian i bez spadku czasu odpowiedzi.

### 4.3 Frontend (produkcja `pychaswiatowa.web.app`)

- [ ] Szczegóły cudzego publicznego przepisu (`/explore/recipes/:id-:slug`) jako zalogowany — gwiazdki pod tytułem, ocenianie, zmiana, wycofanie (toggle i „Usuń ocenę"), poprawne snackbary, stan po odświeżeniu.
- [ ] Zalogowany: szczegóły własnego publicznego przepisu (`/recipes/:id-:slug`) — średnia widoczna, komunikat „Nie możesz oceniać własnych przepisów", brak interaktywnych gwiazdek.
- [ ] Zalogowany: własny przepis `PRIVATE`/`SHARED` — brak komponentu ocen.
- [ ] Gość: średnia i liczba ocen widoczne, gwiazdki read-only, link „Zaloguj się, aby ocenić" prowadzi do logowania.
- [ ] Przepis bez ocen: „Brak ocen" (bez „0,0"), zachęta dla zalogowanego.
- [ ] Odmiana „1 ocena", „2 oceny", „5 ocen" i przecinek dziesiętny („4,3").
- [ ] Błąd zapisu (wyłączona sieć w DevTools): rollback gwiazdek + snackbar „Nie udało się zapisać oceny. Spróbuj ponownie."
- [ ] Mobile (telefon / emulacja 360 px): układ bloku ocen pod tytułem bez uszkodzenia nagłówka.
- [ ] Klawiatura: `Tab` wchodzi do grupy gwiazdek, strzałki przesuwają fokus, `Enter`/`Spacja` zapisują; fokus widoczny; czytnik ekranu ogłasza nową średnią.
- [ ] Regresja: przełączniki flag PS-95, „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", chipy i tagi, CTA gościa, kafelki list (bez zmian).

### 4.4 Testy E2E (Playwright)

Wykonać ręcznie lokalnie lub na dev/staging **przed merge'em**, a po wdrożeniu wyrywkowo na produkcji:

- [ ] Ocenianie, zmiana, wycofanie, widok gościa, blokada autora (zgodnie z Definition of Done).

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | W konsoli Firebase Hosting przywrócić poprzednią wersję (Rollback do poprzedniego release'u). |
| Edge Functions | Wdrożyć ponownie poprzedni commit (revert PR + pipeline) lub ręcznie `supabase functions deploy recipes public explore` z poprzedniego commita. Stara wersja funkcji ignoruje tabelę ocen i nowe kolumny widoku. |
| Baza danych | **Zwykle niepotrzebny.** Zmiana jest addytywna (nowa tabela, nowe kolumny na końcu widoku, nowa funkcja) i nie wpływa na starą wersję aplikacji. Jeśli konieczne wycofanie, **nowa migracja**: `drop function public.set_recipe_rating(bigint, smallint); drop table public.recipe_ratings cascade;` — **traci wszystkie oceny użytkowników**. Usunięcie kolumn widoku wymaga `drop view` i ponownego `create view` ze starą definicją (`20260118120300`) wraz z `grant select … to authenticated`. Zwykle lepiej zostawić nieużywane kolumny. Nie edytować zastosowanej migracji. |

> **Ważne:** nie wycofywać samego backendu, zostawiając nowy frontend. Nowy frontend wywołuje `PUT /recipes/{id}/rating`, którego stara funkcja nie ma — użytkownik widziałby wyłącznie snackbary błędów przy próbie oceny, a pola ocen w szczegółach byłyby puste (`undefined`). Wycofywać backend i frontend razem.

---

## 6. Dokumentacja produktowa po wdrożeniu

- [ ] `docs/results/project-summary.md`:
    - sekcja „Stan realizacji" (PS-99) wraz z datą aktualizacji,
    - tabela `recipe_ratings` w „Strukturze bazy danych", relacja `auth.users 1:N recipe_ratings` i `recipes 1:N recipe_ratings`, wzmianka o kolumnach `ratings_count`/`average_rating` widoku `recipe_details`, opis RLS,
    - endpoint `PUT /recipes/{id}/rating` oraz nowe pola w `GET /recipes/{id}`, `GET /public/recipes/{id}`, `GET /explore/recipes/{id}`,
    - komponent ocen w „Widokach UI" (szczegóły przepisu prywatne i publiczne) i w „Komponentach globalnych",
    - nowa historyjka w tabeli User Stories i scenariusz w „Kluczowych scenariuszach E2E / manualnych",
    - **przeniesienie „oceny" z sekcji „Granice (poza zakresem)"** (punkt „Funkcje społecznościowe (znajomi, komentarze, oceny)" — pozostają znajomi i komentarze),
    - ryzyko „review bombing / brak rate limitu ocen" w „Głównych ryzykach".
- [ ] Zamknięcie checklisty Definition of Done w `PS-99-recipe-rating-user-story.md`.
- [ ] Uwaga w backlogu: osobne historyjki na średnią ocen na kafelkach oraz sortowanie i filtr po ocenie w `/explore` (rozszerzenie PS-96; do rozważenia denormalizacja agregatów).

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `recipes`, funkcja `handle_updated_at()` | ✅ Istniejące | Klucz obcy i trigger nowej tabeli |
| Widok `recipe_details` | ✅ Istniejący, **modyfikowany** | `create or replace view`; wymaga zgodności definicji produkcyjnej z repozytorium (krok 1, pkt 2) |
| Edge Functions `recipes`, `public`, `explore` | ✅ Istniejące, wdrażane w workflow | Zmiana kodu; brak nowego kroku w workflow. Zmiana `_shared/` obejmuje wszystkie funkcje wdrażane razem |
| `supabase db push` w workflow | ✅ Automatyczne | Wymaga poprawnej kolejności znaczników migracji (krok 1) |
| Wzorzec PS-95 (`RecipeFlagsService`, `_shared/recipe-flags.ts`, nagłówki `Cache-Control`) | ✅ Wdrożone | Reużywane; cache `no-store` dla odpowiedzi z JWT już obowiązuje |
| Zmienne środowiskowe / sekrety | ✅ Nie dotyczy | Brak nowych |
| Publiczny cache (Firebase / przeglądarka) | ✅ Bez zmian po stronie hostingu | Cache anonimowych odpowiedzi API (`public, max-age=60`) nie zawiera `my_rating`; gość może widzieć agregat opóźniony do 60 s — akceptowalne |

---

## 8. Czego NIE robi PS-99

| Element | Uwaga |
|---|---|
| Średnia ocen na kafelkach i listach | Osobna historyjka |
| Sortowanie i filtr po ocenie w `/explore` | Osobna historyjka (rozszerzenie PS-96) |
| Rate limit i wykrywanie nadużyć (review bombing) | Poza zakresem; monitorować i dodać przy pierwszych sygnałach |
| Komentarze, recenzje tekstowe, histogram ocen | Poza zakresem |
| Powiadomienia dla autora o ocenach | Poza zakresem |
| Limity i różnice między rolami | Brak |
