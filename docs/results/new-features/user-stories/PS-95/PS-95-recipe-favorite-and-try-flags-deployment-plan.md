# PS-95: Osobiste flagi przepisu „Ulubiony" i „Chcę wypróbować" — Plan wdrożenia

> **User Story:** PS-95 — Osobiste flagi przepisu „Ulubiony" (serduszko) i „Chcę wypróbować"
> **Data:** październik 2026
> **Środowisko docelowe:** Supabase Cloud (baza + Edge Functions) + Firebase Hosting (frontend)

---

## 1. Podsumowanie

PS-95 wymaga **zmiany schematu bazy danych**, ale wszystkie jej kroki wykonują się **automatycznie** w workflow `.github/workflows/main-deploy.yml` (push do `main`), w tej kolejności:

1. `test` — testy jednostkowe (`npm run test:run`),
2. `deploy-backend` — `supabase db push` (migracja) → `supabase secrets set` → `supabase functions deploy …` (w tym istniejące `recipes`, `public`, `explore`, `collections`),
3. `deploy-frontend` — build i Firebase Hosting.

Kolejność gwarantuje, że tabela i RPC istnieją, zanim zacznie działać nowy kod funkcji, a nowy frontend trafia na hosting dopiero po backendzie. Zmiana API jest **wstecznie zgodna** (nowe pola opcjonalne, nowy endpoint), więc krótkie okno, w którym działa jeszcze stary frontend, niczego nie psuje.

Poniżej wyłącznie kroki **ręczne** — przed merge'em, po wdrożeniu oraz na wypadek wycofania.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Nowa usługa zewnętrzna, konto, klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** (nowa funkcjonalność nie używa zmiennych) |
| GitHub Secrets | **Brak** |
| Migracja SQL | Automatyczna (`supabase db push`); ręcznie tylko **weryfikacja przed merge'em** (krok 1) i **po wdrożeniu** (krok 3) |
| Nowa Edge Function / zmiana workflow | **Brak** — endpoint jest w istniejącej funkcji `recipes`; lista `functions deploy` w workflow się nie zmienia |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / konfiguracja domeny | **Brak** |
| Clickio / Google Analytics / OAuth | **Brak** |
| Testy E2E (Playwright) | **Ręcznie** — workflow wdrożeniowy uruchamia tylko testy jednostkowe (krok 2) |

---

## 2. Krok 1 — Przed merge'em do `main` (weryfikacja migracji)

**Cel:** uniknąć sytuacji, w której `supabase db push` w CI zakończy się błędem po merge'u i zablokuje deploy backendu oraz frontendu.

1. **Znacznik czasu migracji.** Nazwa pliku `supabase/migrations/20261010120000_create_user_recipe_flags.sql` musi mieć znacznik **większy** niż najnowsza migracja zastosowana na produkcji. Sprawdzić lokalnie z projektem połączonym z produkcją:

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

    Jeśli na produkcji jest migracja o większym znaczniku niż lokalna (np. wprowadzona ręcznie w SQL Editorze), albo kolumny *Local* i *Remote* się rozjeżdżają — naprawić przed merge'em (`supabase migration repair --status applied <znacznik>` lub zmiana znacznika nowej migracji). Inaczej `db push` odrzuci migrację jako „out of order".

2. **Suchy przebieg migracji na produkcyjnej bazie:**

    ```bash
    supabase db push --dry-run
    ```

    Oczekiwane: na liście do zastosowania **wyłącznie** `20261010120000_create_user_recipe_flags.sql`.

3. **Lokalny test na czystej bazie** (Docker + Supabase CLI): `supabase db reset`, a następnie sprawdzenie, że migracja przechodzi bez błędów, a tabela `user_recipe_flags` i funkcja `set_recipe_flags` istnieją.

4. **Test RLS lokalnie na dwóch kontach** (A — autor, B — czytelnik) z jednym przepisem `PUBLIC` i jednym `PRIVATE` autora A:

    | Wywołanie | Oczekiwany wynik |
    |---|---|
    | B: `PUT /recipes/{publiczny}/flags` `{ "is_favorite": true }` | `200`, `is_favorite: true` |
    | B: `PUT /recipes/{prywatny A}/flags` | `404` |
    | A: odczyt flag B (SQL jako A / `GET` szczegółów) | brak flag B |
    | B: `PUT` z pustym ciałem / z `"is_favorite": "true"` | `400` |
    | B: `PUT` bez JWT | `401` |

5. **Typy bazy** (`supabase/functions/_shared/database.types.ts`, `shared/types/database.types.ts`) wygenerowane po migracji i zacommitowane w tym samym PR — CI ich nie generuje.

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. W GitHub Actions obserwować job **Deploy Backend (Supabase)** — krok **Push database migrations** musi zakończyć się sukcesem **przed** krokiem **Deploy Edge Functions**.
2. W razie błędu migracji **nie** ponawiać deployu na ślepo: poprawić przyczynę (zwykle konflikt znaczników z kroku 1) i uruchomić pipeline ponownie. Nie edytować migracji, która została już zastosowana na produkcji — poprawki robić nową migracją.
3. Po zakończeniu **Deploy Frontend (Firebase)** odczekać na propagację hostingu, następnie wykonać krok 3.

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (checklista manualna)

### 4.1 Baza danych (panel Supabase)

- [ ] `Table Editor`: tabela `user_recipe_flags` istnieje, **RLS włączony**.
- [ ] `Authentication → Policies`: 4 polityki na `user_recipe_flags` (`select`, `insert`, `update`, `delete`), wszystkie dla roli `authenticated`.
- [ ] `Database → Functions`: `set_recipe_flags(bigint, boolean, boolean)` istnieje, `security invoker`; uprawnienie `EXECUTE` tylko dla `authenticated` (brak dla `anon` i `public`).
- [ ] `Database → Advisors` (Security / Performance): brak nowych ostrzeżeń dla `user_recipe_flags` (np. „RLS disabled", brak indeksu na kluczu obcym).
- [ ] `Database → Migrations`: migracja `20261010120000` widoczna jako zastosowana.

### 4.2 API (produkcja, dwa konta testowe: A — autor, B — czytelnik, jeden przepis `PUBLIC` autora A)

- [ ] `PUT /recipes/{id}/flags` jako B: `{ "is_favorite": true }` → `200` z pełnym stanem; `{ "is_want_to_try": true }` → obie `true`.
- [ ] `GET /explore/recipes/{id}` jako B: zawiera `is_favorite` i `is_want_to_try`; jako A: oba `false`; **bez JWT: pól brak**.
- [ ] `GET /public/recipes/feed` jako B: element przepisu ma `is_favorite: true`; bez JWT: brak klucza `is_favorite`.
- [ ] Nagłówki: odpowiedź `GET /public/recipes/{id}` z JWT ma `Cache-Control: no-store`, bez JWT `public, max-age=60`.
- [ ] Ponowne to samo `PUT` → ten sam wynik (idempotencja); `PUT` z `false` dla obu flag → odpowiedź `false/false`, wiersz usunięty (sprawdzić w `Table Editor`).
- [ ] `PUT` na przepisie prywatnym autora A jako B → `404`.
- [ ] Aktualizacja flag nie zmienia `recipes.updated_at` przepisu.

### 4.3 Frontend (produkcja `pychaswiatowa.web.app`)

- [ ] Szczegóły własnego przepisu (`/recipes/:id-:slug`) — dwie ikonki w nagłówku akcji, zmiana stanu, zachowanie po odświeżeniu.
- [ ] Szczegóły cudzego publicznego przepisu (`/explore/recipes/:id-:slug`) jako zalogowany — ikonki działają; po powrocie do `/explore` serduszko na kafelku.
- [ ] Serduszko widoczne na kafelkach: `/my-recipies`, `/dashboard`, `/collections/:id`, `/explore`, `/` (zalogowany).
- [ ] Klik w serduszko na kafelku otwiera szczegóły i nie zmienia flagi.
- [ ] Gość: brak ikonek na szczegółach publicznych i brak serduszek na kafelkach.
- [ ] Błąd zapisu (wyłączona sieć w DevTools): cofnięcie ikonki + snackbar „Nie udało się zapisać. Spróbuj ponownie."
- [ ] Mobile (telefon / emulacja 360 px): pasek akcji w trybach „własny przepis" i „cudzy przepis" bez uszkodzonego układu.
- [ ] Klawiatura: `Tab` do ikonek, `Enter`/`Spacja` przełączają stan; fokus widoczny.
- [ ] Regresja: „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", badge „Mój przepis" / „W moich kolekcjach", ikona widoczności, menu „Usuń z kolekcji".

### 4.4 Testy E2E (Playwright)

Workflow wdrożeniowy ich nie uruchamia — wykonać ręcznie lokalnie lub na środowisku dev/staging **przed merge'em**, a po wdrożeniu wyrywkowo na produkcji:

- [ ] Ustawienie i zdjęcie flagi na szczegółach, serduszko na kafelku, brak flag dla gościa (zgodnie z Definition of Done).

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | W konsoli Firebase Hosting przywrócić poprzednią wersję (Rollback do poprzedniego release'u). |
| Edge Functions | Wdrożyć ponownie poprzedni commit (revert PR + pipeline) lub ręcznie `supabase functions deploy recipes public explore collections` z poprzedniego commita. Stara wersja funkcji ignoruje tabelę flag. |
| Baza danych | **Zwykle niepotrzebny.** Tabela jest addytywna, nie zmienia `recipes` ani istniejących RPC, więc może zostać bez wpływu na starą wersję aplikacji. Jeśli konieczne wycofanie, **nowa migracja** `drop function public.set_recipe_flags(bigint, boolean, boolean); drop table public.user_recipe_flags;` — **traci dane flag użytkowników**. Nie edytować zastosowanej migracji. |

> **Ważne:** nie wycofywać samego backendu, zostawiając nowy frontend. Nowy frontend wywołuje `PUT /recipes/{id}/flags`, którego stara funkcja nie ma — użytkownik widziałby wyłącznie snackbary błędów przy próbie ustawienia flag. Wycofywać backend i frontend razem.

---

## 6. Dokumentacja produktowa po wdrożeniu

- [ ] `docs/results/project-summary.md`: sekcja „Stan realizacji" (PS-95), tabela `user_recipe_flags` w „Strukturze bazy danych", endpoint `PUT /recipes/{id}/flags` oraz nowe pola w endpointach odczytu, opis przełączników na szczegółach i serduszka na kafelku w „Widokach UI", nowa historyjka w tabeli User Stories, scenariusz w „Kluczowych scenariuszach E2E / manualnych".
- [ ] Zamknięcie checklisty Definition of Done w `PS-95-recipe-favorite-and-try-flags-user-story.md`.
- [ ] Uwaga w backlogu: osobna historyjka na wyszukiwanie i filtrowanie po fladze „Ulubiony" / „Chcę wypróbować" (indeks częściowy `idx_user_recipe_flags_user_favorite` jest już w bazie).

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `recipes`, funkcja `handle_updated_at()` | ✅ Istniejące | Używane przez nową tabelę (klucz obcy, trigger) |
| Edge Functions `recipes`, `public`, `explore`, `collections` | ✅ Istniejące, wdrażane w workflow | Zmiana kodu; brak nowego kroku w workflow |
| `supabase db push` w workflow | ✅ Automatyczne | Wymaga poprawnej kolejności znaczników migracji (krok 1) |
| Zmienne środowiskowe / sekrety | ✅ Nie dotyczy | Brak nowych |
| Publiczne cache (Firebase / przeglądarka) | ✅ Bez zmian po stronie hostingu | Cache anonimowych odpowiedzi API (`public, max-age=60`) nie zawiera flag; odpowiedzi z JWT są `no-store` |

---

## 8. Czego NIE robi PS-95

| Element | Uwaga |
|---|---|
| Filtrowanie i wyszukiwanie po fladze | Osobna historyjka |
| Ikona „Chcę wypróbować" na kafelkach | Osobna historyjka |
| Powiadomienia dla autora przepisu / statystyki polubień | Poza zakresem (flagi są prywatne) |
| Limity i różnice między rolami | Brak |
