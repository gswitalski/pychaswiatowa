# PS-96: Filtry przepisów w katalogu Odkrywaj — Plan wdrożenia

> **User Story:** PS-96 — Filtry przepisów w katalogu Odkrywaj (`/explore`)
> **Data:** październik 2026
> **Środowisko docelowe:** Supabase Cloud (Edge Functions) + Firebase Hosting (frontend)

---

## 1. Podsumowanie

PS-96 **nie wymaga migracji bazy danych** — korzysta z istniejącej tabeli `user_recipe_flags` (stworzonej w PS-95) i jej indeksów. Zmiany dotyczą wyłącznie kodu:

- Edge Function `public` (rozszerzenie query params)
- Frontend Angular (nowe komponenty i modyfikacja strony `/explore`)

Wszystkie kroki wdrożeniowe **wykonują się automatycznie** w workflow `.github/workflows/main-deploy.yml` po pushu do `main`, w kolejności:

1. `test` — testy jednostkowe (`npm run test:run`)
2. `deploy-backend` — `supabase functions deploy public` (i pozostałe funkcje)
3. `deploy-frontend` — build Angular + Firebase Hosting

Zmiana API jest **wstecznie zgodna** (nowe query params opcjonalne, ignorowane gdy nieobecne). Stary frontend bez filtrów działa z nowym backendem bez żadnych problemów.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Migracja SQL | **Brak** — tabela `user_recipe_flags` i indeksy istnieją (PS-95) |
| Nowa usługa zewnętrzna, konto, klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** |
| GitHub Secrets | **Brak** |
| Nowa Edge Function / zmiana workflow | **Brak** — zmiany wyłącznie w istniejącej funkcji `public` |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / konfiguracja domeny | **Brak** |
| Testy E2E (Playwright) | **Ręcznie** — workflow uruchamia tylko Vitest |

---

## 2. Krok 1 — Przed merge'em do `main` (weryfikacja lokalna)

PS-96 nie ma migracji, więc weryfikacja skupia się na poprawności kodu i zgodności z istniejącą bazą.

1. **Sprawdzić, że tabela `user_recipe_flags` i indeksy istnieją na produkcji (wymagany PS-95):**

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

    Migracja `20261010120000_create_user_recipe_flags.sql` powinna być widoczna jako zastosowana (`Applied`). Jeśli PS-95 nie jest wdrożone — PS-96 nie może być mergowany.

2. **Lokalny smoke test filtrowania:**

    Uruchomić lokalny Supabase (`supabase start`) i wywołać manualnie:

    | Żądanie | Oczekiwany wynik |
    |---|---|
    | `GET /public/recipes?termorobot=true` | Tylko przepisy `is_termorobot=true` |
    | `GET /public/recipes?diet=vege_plus` | Tylko przepisy `diet_type IN ('VEGE','VEGAN')` |
    | `GET /public/recipes?diet=vegan` | Tylko `diet_type='VEGAN'` |
    | `GET /public/recipes?favorite=true` bez JWT | Brak błędu, wyniki bez filtrowania flag |
    | `GET /public/recipes?favorite=true` z JWT (użytkownik z ulubionym) | Tylko ulubione przepisy |
    | `GET /public/recipes?want_to_try=true` z JWT | Tylko przepisy z `is_want_to_try=true` |
    | `GET /public/recipes?diet=vege_plus&termorobot=true` | AND obu warunków |
    | `GET /public/recipes?diet=nieznane` | Brak błędu, brak filtrowania diety |

3. **Testy jednostkowe:**

    ```bash
    npm run test:run
    ```

    Nowe testy z `explore-recipe-filters.component.spec.ts` i `explore-filter-state.service.spec.ts` muszą przechodzić. Brak regresji w istniejących speców.

4. **Sprawdzić `Cache-Control` regresji (PS-95):**

    Odpowiedź `GET /public/recipes` bez JWT musi mieć `Cache-Control: public, max-age=60`. Z JWT: `no-store`. Nowe parametry nie mogą zmieniać nagłówków cache.

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. W GitHub Actions obserwować job **Deploy Backend (Supabase)** — krok **Deploy Edge Functions** musi zakończyć się sukcesem. Brak kroku `db push` (brak migracji).
2. Po zakończeniu **Deploy Frontend (Firebase)** odczekać na propagację (zwykle 1-2 min), następnie wykonać krok 3.

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (checklista manualna)

### 4.1 API (produkcja — dwa konta testowe: A z ulubionym przepisem, B bez)

- [ ] `GET /public/recipes?termorobot=true` — tylko przepisy Termorobot.
- [ ] `GET /public/recipes?grill=true` — tylko przepisy Grill.
- [ ] `GET /public/recipes?diet=vege_plus` — przepisy VEGE i VEGAN, brak MEAT.
- [ ] `GET /public/recipes?diet=vegan` — tylko VEGAN.
- [ ] `GET /public/recipes?favorite=true` z JWT konta A — tylko przepisy z `is_favorite=true` A.
- [ ] `GET /public/recipes?favorite=true` z JWT konta B (brak ulubionych) — pusta lista (`data: []`).
- [ ] `GET /public/recipes?favorite=true` **bez JWT** — brak błędu, wyniki jak bez filtra.
- [ ] `GET /public/recipes?want_to_try=true` z JWT konta A — tylko przepisy z `is_want_to_try=true` A.
- [ ] `GET /public/recipes?diet=vege_plus&termorobot=true` — AND, tylko VEGE/VEGAN i Termorobot.
- [ ] `GET /public/recipes?favorite=true&grill=true` z JWT A — AND, ulubione i grillowe.
- [ ] `GET /public/recipes?q=kurczak&diet=vegan` — wyniki z frazą „kurczak" i VEGAN.
- [ ] `GET /public/recipes/feed?diet=vege_plus&favorite=true` z JWT — cursor-based, jw.
- [ ] Cache headers niezmienione: z JWT `no-store`, bez JWT `public, max-age=60`.

### 4.2 Frontend (produkcja `pychaswiatowa.web.app`)

- [ ] Gość wchodzi na `/explore` — pasek chipów widoczny, brak chipów „Ulubione" i „Chcę wypróbować".
- [ ] Gość klika chip „Termorobot" — URL `?termorobot=true`, lista przefiltrowana.
- [ ] Gość klika chip „Wegetariańskie+" — URL `?diet=vege_plus`, lista przefiltrowana.
- [ ] Gość klika „Tylko wegańskie" gdy aktywne „Wegetariańskie+" — wymiana chipa, `?diet=vegan`.
- [ ] Gość klika „Wszystkie diety" → `diet` znika z URL.
- [ ] Zalogowany widzi chipy „Ulubione" i „Chcę wypróbować" jako pierwsze.
- [ ] Zalogowany klika „Ulubione" — URL `?favorite=true`, lista z ulubionymi.
- [ ] Kombinacja filtrów (np. „Ulubione" + „Grill") — URL `?favorite=true&grill=true`, AND.
- [ ] Wejście na `/explore?termorobot=true&diet=vegan` — chipy aktywne od razu, dane przefiltrowane.
- [ ] Brak wyników po filtracji → empty state z przyciskiem „Wyczyść filtry".
- [ ] Przycisk „Wyczyść filtry" usuwa filtry, zachowuje wartość pola `q`.
- [ ] Load more po aktywnym filtrze — kolejna strona z tymi samymi filtrami.
- [ ] Zmiana filtra przy załadowanych 2 stronach → powrót do strony 1.
- [ ] Regresja: wyszukiwanie `q` działa, serduszka na kafelkach (PS-95) widoczne, kafelek nawiguje do szczegółów.

### 4.3 Responsywność

- [ ] Telefon (360 px): pasek chipów scrolluje poziomo bez zawijania; brak poziomego scrollbara na całej stronie.
- [ ] Tablet (768 px): układ poprawny.
- [ ] Desktop (>960 px): pełny pasek bez scrollbara.

### 4.4 Testy E2E (Playwright)

Workflow wdrożeniowy nie uruchamia E2E — wykonać ręcznie lokalnie lub na środowisku dev/staging przed merge'em, a po wdrożeniu wyrywkowo na produkcji:

- [ ] Scenariusze 1-9 z Definition of Done (historyjka PS-96).

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | W konsoli Firebase Hosting przywrócić poprzednią wersję (Rollback release). Stary frontend nie wyświetla filtrów — strona `/explore` działa jak przed PS-96. |
| Edge Functions | Wdrożyć ponownie poprzedni commit (`revert PR + pipeline`) lub ręcznie `supabase functions deploy public` z poprzedniego commita. Stara funkcja ignoruje nowe query params. |
| Baza danych | **Nie dotyczy** — brak migracji w PS-96. Tabela `user_recipe_flags` (PS-95) pozostaje bez zmian. |

> **Ważne:** PS-96 nie zmienia formatu odpowiedzi API (tylko filtruje wyniki), więc rollback jednej warstwy (przy zachowaniu drugiej) nie psuje działania aplikacji — jest to bezpieczniejsze niż w historyjkach zmieniających schemat DTO.

---

## 6. Dokumentacja produktowa po wdrożeniu

- [ ] `docs/results/project-summary.md`:
    - Sekcja „Stan realizacji" — dodać PS-96.
    - Tabela endpointów `GET /public/recipes` i `GET /public/recipes/feed` — dodać parametry `favorite`, `want_to_try`, `diet` (z opisem `vege_plus`).
    - Sekcja „Widoki UI" — opis paska chipów na `/explore`, warunkowe renderowanie dla gościa/zalogowanego.
    - Tabela User Stories — nowa historyjka PS-96.
    - Scenariusz w „Kluczowych scenariuszach E2E / manualnych": filtrowanie na `/explore` (chipy, URL sync, kombinacja, empty state, gość bez flag).
    - Sekcja „Granice" — usunąć wzmiankę o tym, że filtrowanie po flagach nie jest zaimplementowane (zastąpić informacją o zakresie PS-96).
- [ ] Zamknięcie checklisty Definition of Done w `PS-96-explore-recipe-filters-user-story.md`.

---

## 7. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| Tabela `user_recipe_flags` + indeks `idx_user_recipe_flags_user_favorite` (PS-95) | ✅ Musi być wdrożone przed PS-96 | PS-96 nie może być mergowane bez wdrożonego PS-95 |
| Edge Function `public` | ✅ Istniejąca, wdrażana w workflow | Modyfikacja; brak nowego kroku w workflow |
| Pola `is_favorite` / `is_want_to_try` w odpowiedziach `GET /public/recipes` (PS-95) | ✅ Istniejące | PS-96 nie dodaje nowych pól — tylko filtruje |
| Zmienne środowiskowe / sekrety | ✅ Nie dotyczy | Brak nowych |

---

## 8. Czego NIE robi PS-96

| Element | Uwaga |
|---|---|
| Filtrowanie po flagach w `GET /recipes` (prywatne) | Osobna historyjka |
| Filtry na landingu (`/`) i „Moje przepisy" | Osobna historyjka |
| Filtry `cuisine` i `difficulty` w UI | Backend je obsługuje; UI w osobnej historyjce |
| Indeks DB dla `is_want_to_try` | Addytywna migracja gdy logi pokażą potrzebę |
| Zapamiętywanie filtrów między sesjami | Filtry resetują się po opuszczeniu strony (URL bez filtru) |
