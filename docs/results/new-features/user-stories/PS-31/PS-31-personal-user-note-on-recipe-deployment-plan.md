# PS-31: Osobista notatka użytkownika do przepisu — Plan wdrożenia

> **User Story:** PS-31 — Osobista notatka użytkownika do przepisu
> **Data:** listopad 2026
> **Środowisko docelowe:** Supabase Cloud (baza + Edge Functions) + Firebase Hosting (frontend)
> **Powiązane:** `PS-31-personal-user-note-on-recipe-api-plan.md`, `PS-31-personal-user-note-on-recipe-ui-plan.md`

---

## 1. Podsumowanie

PS-31 wymaga **zmiany schematu bazy danych** (nowa tabela `user_recipe_notes`, RLS, RPC `set_recipe_note`) i zmian w istniejących funkcjach `recipes`, `public`, `explore`. Wszystkie kroki wdrożeniowe wykonują się **automatycznie** w workflow `.github/workflows/main-deploy.yml` (push do `main`), w tej kolejności:

1. `test` — `npm run test:run` (Vitest, tylko `src/**`),
2. `deploy-backend` — `supabase db push --remote --yes` (migracja) → `supabase secrets set` → `supabase functions deploy …` (w tym istniejące `recipes`, `public`, `explore`),
3. `deploy-frontend` — build i Firebase Hosting.

Kolejność gwarantuje, że tabela i RPC istnieją, zanim zacznie działać nowy kod funkcji, a nowy frontend trafia na hosting dopiero po backendzie. Zmiana API jest **wstecznie zgodna**: `my_note` jest polem addytywnym, nowy endpoint nie wpływa na istniejące, **widok `recipe_details` nie jest modyfikowany** (w przeciwieństwie do PS-99), a istniejące zapytania nie dotykają nowej tabeli. Krótkie okno, w którym działa stary frontend lub stare funkcje, jest bezpieczne (stary frontend ignoruje `my_note`, stare funkcje nie znają endpointu — sekcja notatki po prostu się nie pojawia).

Poniżej wyłącznie kroki **ręczne** — przed merge'em, po wdrożeniu oraz na wypadek wycofania.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Nowa usługa zewnętrzna, konto, klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** |
| GitHub Secrets | **Brak** |
| Migracja SQL | Automatyczna (`supabase db push`); ręcznie tylko **weryfikacja przed merge'em** (krok 1) i **po wdrożeniu** (krok 3) |
| Nowa Edge Function / zmiana workflow | **Brak** — endpoint jest w istniejącej funkcji `recipes`; lista `functions deploy` w workflow się nie zmienia (`explore` i `public` z `--no-verify-jwt` zostają bez zmian) |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / konfiguracja domeny / reguły cache | **Brak** |
| Clickio / Google Analytics / OAuth | **Brak** |
| Testy Edge Functions (Deno) | **Ręcznie** — `main-deploy.yml` ich **nie** uruchamia |
| Testy E2E (Playwright) | **Ręcznie** — workflow wdrożeniowy uruchamia tylko testy jednostkowe Vitest |

---

## 2. Krok 1 — Przed merge'em do `main`

**Cel:** uniknąć sytuacji, w której `supabase db push` w CI zakończy się błędem po merge'u i zablokuje deploy backendu oraz frontendu, a także wychwycić błędy, których pipeline nie sprawdza (testy Deno, E2E, RLS).

1. **Znacznik czasu migracji.** Plik `supabase/migrations/20261109120000_create_user_recipe_notes.sql` musi mieć znacznik **większy** niż najnowsza migracja zastosowana na produkcji (obecnie ostatnia w repo: `20261027120000_create_recipe_ratings.sql`). Sprawdzić z projektem połączonym z produkcją:

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

    Jeśli kolumny *Local* i *Remote* się rozjeżdżają albo na produkcji jest migracja o większym znaczniku (np. wprowadzona ręcznie w SQL Editorze), naprawić przed merge'em (`supabase migration repair --status applied <znacznik>` lub zmiana znacznika nowej migracji). Jeśli do `main` trafi w międzyczasie inna migracja, **podbić znacznik** PS-31 powyżej niej. Inaczej `db push` odrzuci migrację jako „out of order".

2. **Suchy przebieg migracji na produkcyjnej bazie:**

    ```bash
    supabase db push --dry-run
    ```

    Oczekiwane: na liście do zastosowania **wyłącznie** `20261109120000_create_user_recipe_notes.sql`.

3. **Lokalny test na czystej bazie** (Docker + Supabase CLI): `supabase db reset`, następnie sprawdzenie, że migracja przechodzi bez błędów oraz że istnieją: tabela `user_recipe_notes` (RLS włączony), 4 polityki, indeks `idx_user_recipe_notes_recipe_id`, trigger `set_user_recipe_notes_updated_at` i funkcja `set_recipe_note(bigint, text)`.

4. **Test RLS i RPC lokalnie na dwóch kontach** (A — autor, B — czytelnik; jeden przepis `PUBLIC` i jeden `PRIVATE` autora A, jeden `SHARED` autora A):

    | Wywołanie | Oczekiwany wynik |
    |---|---|
    | B: `PUT /recipes/{publiczny A}/note` `{ "note": "  Mniej soli\r\n\r\nWięcej pieprzu  " }` | `200`, `note: "Mniej soli\n\nWięcej pieprzu"`, `updated_at` ustawione |
    | B: to samo żądanie ponownie | `200`, ten sam wynik, `updated_at` **bez zmiany** (idempotencja) |
    | B: `{ "note": "Nowa treść" }` | `200`, `created_at` w tabeli bez zmiany, `updated_at` nowsze |
    | B: `{ "note": null }`, `""`, `"   "` | `200`, `note: null`, `updated_at: null`, wiersz usunięty; powtórzenie → `200` |
    | A: `PUT /recipes/{własny PRIVATE}/note` | `200` |
    | B: `PUT /recipes/{PRIVATE A}/note` i `{SHARED A}` | `404`, brak wiersza |
    | B: `PUT /recipes/999999999/note` | `404` |
    | B: `PUT /recipes/abc/note` | `400` |
    | B: ciało puste, `{}`, `{ "note": 123 }`, `{ "note": "x", "user_id": "…" }`, `{ "note": "<2001 znaków>" }` | `400`, istniejąca notatka niezmieniona |
    | B: `{ "note": "<2000 znaków z emoji>" }` | `200` |
    | B: `PUT` bez JWT | `401` |
    | B: `GET /recipes/{id}/note` | `405` (nie lista, nie szczegóły) |
    | A i B: `select * from user_recipe_notes` (SQL jako dany użytkownik) | każdy widzi tylko własne wiersze |
    | B: bezpośredni `rpc/set_recipe_note` z `p_note` >2000 / z `"  x  "` | błąd `22023` / zapis `"x"` |
    | `anon`: `rpc/set_recipe_note` i `select` z tabeli | brak uprawnień |
    | B: `GET /recipes/{publiczny A}` i `GET /explore/recipes/{publiczny A}` | `my_note` obecne (tekst lub `null`); A widzi `null`/własną, **nigdy** notatki B |
    | A: `GET /explore/recipes/{własny PRIVATE}` | `my_note` obecne (gałąź „autor") |
    | Gość: `GET /explore/recipes/{publiczny}` i `GET /public/recipes/{publiczny}` | **brak klucza** `my_note` |
    | A: zmiana przepisu na `PRIVATE`; B: `PUT …/note` i `GET` | `404` / brak dostępu; wiersz B nadal w tabeli; po powrocie do `PUBLIC` `my_note` B wraca |
    | Hard delete przepisu / użytkownika B | notatki usunięte kaskadowo; soft delete nie kasuje wiersza |
    | `PUT …/note` | `recipes.updated_at`, `search_vector`, `normalized_ingredients_status` **bez zmian** |

5. **Typy bazy** (`supabase/functions/_shared/database.types.ts`, `shared/types/database.types.ts`) wygenerowane po migracji (`supabase gen types typescript --local > …`) i zacommitowane w tym samym PR — CI ich nie generuje. Sprawdzić, że `npm run build` i `tsc` przechodzą.

6. **Testy Edge Functions (Deno)** — nie są częścią pipeline'u:

    ```bash
    deno test --allow-all --unstable supabase/functions/_shared supabase/functions/recipes supabase/functions/explore supabase/functions/public
    ```

    Wszystkie muszą przejść (w tym nowe testy `recipe-notes`, `setRecipeNote`, router, serwisy szczegółów).

7. **Testy frontendu i jakość:** `npm run lint`, `npm run build`, `npm run test:run` — lokalnie, zanim to samo wykona job `test`.

8. **Testy E2E (Playwright)** — workflow wdrożeniowy ich nie uruchamia. Wykonać lokalnie lub na dev/staging **przed merge'em** (`e2e/recipe-note.spec.ts`, scenariusze z planu UI, pkt 8); wymagane `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` (opcjonalnie drugie konto `TEST_USER2_*` dla testu prywatności).

9. **Kolejność z PS-99:** PS-31 modyfikuje te same trzy serwisy szczegółów co PS-99 (`recipes`, `explore`, `public`). Jeśli PS-99 nie jest jeszcze na `main`, zsynchronizować gałąź (rebase/merge) przed merge'em, aby nie dublować/nie gubić zmian w `getRecipeById`, `getExploreRecipeById`, `getPublicRecipeById` i w `RecipeDetailViewComponent`.

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. W GitHub Actions obserwować job **Deploy Backend (Supabase)** — krok **Push database migrations** musi zakończyć się sukcesem **przed** krokiem **Deploy Edge Functions**.
2. W razie błędu migracji **nie** ponawiać deployu na ślepo: poprawić przyczynę (zwykle konflikt znaczników z kroku 1) i uruchomić pipeline ponownie. Nie edytować migracji, która została już zastosowana na produkcji — poprawki robić nową migracją.
3. Zmiana w `_shared/` (nowy `recipe-notes.ts`) trafia do funkcji wdrażanych razem w tym samym kroku; sprawdzić w logu, że `recipes`, `public` i `explore` wdrożyły się bez błędu bundlowania.
4. Po zakończeniu **Deploy Frontend (Firebase)** odczekać na propagację hostingu, następnie wykonać krok 3.

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (checklista manualna)

### 4.1 Baza danych (panel Supabase)

- [ ] `Table Editor`: tabela `user_recipe_notes` istnieje, **RLS włączony**.
- [ ] `Authentication → Policies`: 4 polityki na `user_recipe_notes` (`select`, `insert`, `update`, `delete`), wszystkie dla roli `authenticated`; brak polityk dla `anon` i brak wyjątku dla `admin`.
- [ ] `Database → Functions`: `set_recipe_note(bigint, text)` istnieje, **`security invoker`**, `search_path` ustawiony na pusty; uprawnienie `EXECUTE` tylko dla `authenticated` (brak dla `anon` i `public`).
- [ ] `Database → Indexes`: `idx_user_recipe_notes_recipe_id` i klucz główny `(user_id, recipe_id)`.
- [ ] `Database → Advisors` (Security / Performance): brak nowych ostrzeżeń dla `user_recipe_notes` (np. „RLS disabled", brak indeksu na kluczu obcym).
- [ ] `Database → Migrations`: migracja `20261109120000` widoczna jako zastosowana.
- [ ] Widok `recipe_details` **niezmieniony** (brak nowych kolumn).

### 4.2 API (produkcja, dwa konta testowe: A — autor, B — czytelnik; jeden przepis `PUBLIC` autora A i jeden `PRIVATE` autora A)

- [ ] `PUT /recipes/{id}/note` jako B na publicznym przepisie A: zapis → `200` z `note`; edycja; `null` → `note: null`; powtórzenie → ten sam wynik.
- [ ] Nagłówki odpowiedzi `PUT` i `GET /recipes/{id}`: `Cache-Control: no-store`.
- [ ] `GET /explore/recipes/{id}` jako B: `my_note` obecne; jako A: bez notatki B; **bez JWT: `my_note` nieobecne**; nagłówek z JWT `no-store`, dla gościa `public, max-age=60`.
- [ ] `GET /explore/recipes/{id}` jako A na własnym `PRIVATE`: `my_note` obecne (gałąź „autor").
- [ ] `GET /public/recipes/{id}` i `GET /recipes/{id}`: `my_note` tylko z JWT, `Cache-Control: no-store` przy JWT (`public`), gość bez pola.
- [ ] `PUT` jako B na `PRIVATE`/`SHARED` autora A → `404`; walidacja `400` (>2000 znaków po trim, zły typ); bez JWT `401`.
- [ ] `POST /recipes` i `PUT /recipes/{id}` (edycja przepisu) działają i zwracają `my_note`; edycja przepisu **nie** usuwa notatki.
- [ ] Notatka nie zmienia `recipes.updated_at` przepisu.
- [ ] Logi Edge Functions (Supabase → Logs → `recipes`): **brak treści notatek**, tylko `userId`/`recipeId`/długość.
- [ ] Regresja list: `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, `GET /collections/{id}`, wyszukiwanie — odpowiedzi bez `my_note`, bez zmian i bez spadku czasu odpowiedzi.

### 4.3 Frontend (produkcja `pychaswiatowa.web.app`)

- [ ] Szczegóły własnego przepisu (`/recipes/:id-:slug`): sekcja „Moja notatka" pod treścią, dodanie wielolinijkowej notatki, snackbar „Notatka została zapisana", stan po odświeżeniu.
- [ ] Szczegóły cudzego publicznego przepisu (`/explore/recipes/:id-:slug`) oraz cudzego przepisu otwartego z kolekcji/sidebaru: dodanie, edycja, usunięcie z potwierdzeniem.
- [ ] Licznik „X / 2000": stan błędu i zablokowany „Zapisz" po przekroczeniu; 2000 znaków z emoji akceptowane.
- [ ] Treść `<script>`/`**tekst**` wyświetlana dosłownie.
- [ ] „Anuluj" odrzuca zmiany; ostrzeżenie „Zostań / Opuść" przy nawigacji (w tym do innego przepisu) i przy zamknięciu/odświeżeniu karty z niezapisaną zmianą; brak ostrzeżenia bez zmian.
- [ ] Błąd zapisu (wyłączona sieć w DevTools): snackbar „Nie udało się zapisać notatki. Spróbuj ponownie.", tekst zachowany; błąd usunięcia: rollback.
- [ ] Gość: brak sekcji i CTA na `/explore/recipes/:id-:slug`.
- [ ] Druga osoba (konto B) nie widzi notatki konta A (także autor przepisu).
- [ ] Formularz przepisu (`/recipes/new`, `/recipes/:id/edit`): bez pola notatki; kafelki list: bez wskaźnika notatki.
- [ ] Mobile (telefon / emulacja 360 px): układ sekcji w trzech stanach, klawiatura ekranowa nie zasłania „Zapisz"/„Anuluj".
- [ ] Klawiatura i czytnik ekranu: `Tab` do sekcji, `Enter`/`Spacja` na przyciskach, etykieta pola „Moja notatka", ogłaszany licznik, fokus wraca po zapisie.
- [ ] Regresja: przełączniki flag PS-95, ocena PS-99, „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", chipy i tagi, CTA gościa.

### 4.4 Testy E2E (Playwright)

Wykonać ręcznie lokalnie lub na dev/staging **przed merge'em**, a po wdrożeniu wyrywkowo na produkcji:

- [ ] Dodanie, edycja i usunięcie notatki na własnym i cudzym publicznym przepisie; brak sekcji dla gościa; brak wycieku notatki innemu użytkownikowi (zgodnie z Definition of Done).

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | W konsoli Firebase Hosting przywrócić poprzednią wersję (Rollback do poprzedniego release'u). |
| Edge Functions | Wdrożyć ponownie poprzedni commit (revert PR + pipeline) lub ręcznie `supabase functions deploy recipes` oraz `supabase functions deploy public --no-verify-jwt` i `supabase functions deploy explore --no-verify-jwt` z poprzedniego commita. Stara wersja funkcji ignoruje tabelę notatek. **Uwaga:** `explore` i `public` wdrażać z `--no-verify-jwt`, jak w workflow. |
| Baza danych | **Zwykle niepotrzebny.** Zmiana jest addytywna (nowa tabela, nowa funkcja, brak zmian istniejących obiektów) i nie wpływa na starą wersję aplikacji. Jeśli konieczne wycofanie, **nowa migracja**: `drop function public.set_recipe_note(bigint, text); drop table public.user_recipe_notes;` — **traci wszystkie notatki użytkowników** (dane nieodwracalne, nie ma ich w kopii innej niż backup Supabase). Przed takim krokiem zrobić eksport/backup tabeli. Nie edytować zastosowanej migracji. Zwykle lepiej zostawić nieużywaną tabelę. |

> **Ważne:** nie wycofywać samego backendu, zostawiając nowy frontend. Nowy frontend wywołuje `PUT /recipes/{id}/note`, którego stara funkcja nie ma — użytkownik widziałby wyłącznie snackbary błędów, a pole `my_note` w szczegółach byłoby nieobecne (sekcja notatki jest wtedy ukryta, więc w praktyce funkcja po prostu znika, bez utraty danych). Wycofywać backend i frontend razem, a notatki zostają w bazie do ponownego wdrożenia.

---

## 6. Dokumentacja produktowa po wdrożeniu

- [ ] `docs/results/project-summary.md` (aktualizuje etap „summary" po akceptacji API i widoków):
    - sekcja 0 „Stan realizacji" (PS-31) wraz z datą aktualizacji; **usunięcie PS-31 z backlogu**,
    - sekcja 1 „Główne założenia produktu": punkt o osobistych notatkach (jedna na użytkownika i przepis, prywatna, tylko zalogowany, własne i cudze `PUBLIC`),
    - sekcja 1 „Granice": **usunięcie** wyłączenia „notatki użytkownika przy cudzym przepisie" z linii „Zaawansowane wartości odżywcze, historia zmian, …" i zastąpienie zapisem, że notatki są wdrożone wyłącznie jako **prywatne** (bez współdzielenia, komentarzy i tekstowych recenzji, które pozostają poza zakresem), poza wyszukiwaniem/AI/planem/zakupami/wydrukiem/eksportem,
    - sekcja 2 „User Stories": nowy wiersz PS-31,
    - sekcja 4: tabela `user_recipe_notes` (kolumny `user_id`, `recipe_id`, `note`, `created_at`, `updated_at`), relacje `auth.users 1:N user_recipe_notes` i `recipes 1:N user_recipe_notes`, opis RLS (tylko właściciel; zapis wymaga dostępnego, nieusuniętego przepisu: własny lub `PUBLIC`),
    - sekcja 5: `PUT /recipes/{id}/note` oraz `my_note` w `GET /recipes/{id}`, `GET /explore/recipes/{id}`, `GET /public/recipes/{id}`,
    - sekcja 6: sekcja „Moja notatka" na `/recipes/:id-:slug` i `/explore/recipes/:id-:slug`; w „Komponentach globalnych" — `RecipeNoteComponent` oraz mechanizm niezapisanych zmian (`UnsavedChangesService`, `unsavedChangesGuard`),
    - sekcja 7: scenariusz E2E notatki w „Kluczowych scenariuszach".
- [ ] Zamknięcie checklisty Definition of Done w `PS-31-personal-user-note-on-recipe-user-story.md`.
- [ ] Sekcja „Project Structure" w regułach — **bez zmian** (nowe pliki w istniejących katalogach).
- [ ] Notatka w backlogu: osobne historyjki na wskaźnik notatki na kafelkach / filtr „z notatką" oraz ewentualne rozszerzenie na cudze przepisy `SHARED` (wymaga wcześniejszej zmiany RLS przepisów).

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `recipes`, `auth.users`, funkcja `handle_updated_at()` | ✅ Istniejące | Klucze obce i trigger nowej tabeli |
| Polityki RLS `recipes` / `recipe_collections` | ✅ Istniejące, **bez zmian** | Predykat dostępności notatki odtwarza regułę „własny lub `PUBLIC`" — jeśli RLS przepisów zmieni się w przyszłości (np. udostępnianie `SHARED`), trzeba zaktualizować polityki i RPC notatek w tej samej historyjce |
| Edge Functions `recipes`, `public`, `explore` | ✅ Istniejące, wdrażane w workflow | Zmiana kodu; brak nowego kroku w workflow. Zmiana `_shared/` obejmuje wszystkie funkcje wdrażane razem |
| `supabase db push --remote --yes` w workflow | ✅ Automatyczne | Wymaga poprawnej kolejności znaczników migracji (krok 1) |
| PS-95 (`_shared/recipe-flags.ts`, nagłówki `Cache-Control`), PS-99 (`_shared/recipe-ratings.ts`, `RecipeRatingComponent`) | ✅ Wdrożone w repo | Wzorce i miejsca integracji; sprawdzić, że gałąź zawiera zmiany PS-99 (krok 1, pkt 9) |
| `ConfirmDialogComponent`, `MatSnackBar`, `MatDialog` | ✅ Istniejące | Reużywane dla potwierdzeń i komunikatów |
| Zmienne środowiskowe / sekrety | ✅ Nie dotyczy | Brak nowych |
| Publiczny cache (Firebase / przeglądarka / CDN) | ✅ Bez zmian po stronie hostingu | Odpowiedzi z `my_note` mają `no-store`; gość nie dostaje pola, więc cache anonimowych odpowiedzi nie zawiera danych prywatnych |
| Testy Deno Edge Functions | ⚠️ Poza pipeline'em | Uruchamiać ręcznie (krok 1, pkt 6); rozważyć dodanie osobnego kroku CI w innej historyjce |

---

## 8. Czego NIE robi PS-31

| Element | Uwaga |
|---|---|
| Wskaźnik notatki na kafelkach, filtr „z notatką" | Osobna historyjka |
| Wyszukiwanie po notatkach; notatka w AI, planie, liście zakupów, wydruku, eksporcie | Poza zakresem |
| Notatki do cudzych przepisów `SHARED` | Wymaga wcześniejszej zmiany RLS przepisów |
| Zmiana workflow / sekretów / konfiguracji hostingu | Brak |
| Historia wersji, współdzielenie, wykrywanie konfliktów między kartami | Poza zakresem (ostatni zapis wygrywa) |
| Limity i różnice między rolami | Brak |
