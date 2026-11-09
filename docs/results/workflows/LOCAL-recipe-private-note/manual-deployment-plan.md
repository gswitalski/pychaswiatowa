# PS-31: Prywatna notatka użytkownika przy przepisie — Plan wdrożenia

> **User Story:** `user-story.md` (workflow `LOCAL-recipe-private-note`)  
> **Data:** listopad 2026  
> **Środowisko docelowe:** Supabase Cloud (baza + Edge Functions) + Firebase Hosting (frontend)

---

## 1. Podsumowanie

PS-31 wymaga **zmiany schematu bazy** (tabela `user_recipe_notes`, RPC `set_recipe_note`) oraz **zmiany kodu** istniejących funkcji `recipes`, `public`, `explore` i frontendu. W `.github/workflows/main-deploy.yml` (push do `main`) kolejność pozostaje:

1. Testy jednostkowe (`npm run test:run`),
2. `supabase db push` → secrets → `supabase functions deploy` (w tym `recipes`, `public`, `explore`),
3. Build i deploy Firebase Hosting.

Zmiana jest **wstecznie zgodna**: nowe pole `my_note` jest opcjonalne; nowy endpoint nie wpływa na stare klienty. Okno „stary frontend + nowy backend" jest bezpieczne (brak wywołań `PUT /note`). Okno „nowy frontend + stary backend" skutkuje błędem zapisu notatki — **wdrażać backend przed lub razem z frontendem** (pipeline to gwarantuje).

Poniżej: wyłącznie kroki **ręczne** (poza automatycznym CI).

| Obszar | Działanie ręczne |
|---|---|
| Usługi zewnętrzne, klucze API | **Brak** |
| Supabase Secrets / GitHub Secrets | **Brak** |
| Migracja SQL | Automatyczna; **weryfikacja przed merge'em** i **checklista po produkcji** |
| Nowa Edge Function | **Brak** — endpoint w `recipes` |
| Cron / webhooki | **Brak** |
| Firebase / OAuth / Clickio | **Brak** |
| Playwright E2E | **Ręcznie** (CI nie uruchamia E2E) |

---

## 2. Krok 1 — Przed merge'em do `main`

**Cel:** uniknąć blokady `supabase db push` w CI.

1. **Znacznik migracji** — `20261108120000_create_user_recipe_notes.sql` (lub faktyczna data w PR) musi być **większy** niż ostatnia migracja na produkcji (`20261027120000` lub nowsza):

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

2. **Dry-run:**

    ```bash
    supabase db push --dry-run
    ```

    Oczekiwane: jedna nowa migracja `create_user_recipe_notes`.

3. **Lokalnie:** `supabase db reset` → tabela + RPC + polityki RLS istnieją.

4. **Test RLS (dwa konta A, B; przepis PUBLIC autora A):**

    | Akcja | Oczekiwany wynik |
    |---|---|
    | B: `PUT …/note` z treścią | `200`, `my_note` w GET |
    | B: `PUT` z `null` | usunięcie wiersza |
    | B: `PUT` na PRIVATE A | `404` |
    | B: `PUT` na SHARED A (bez dostępu szczegółów) | `404` |
    | A w SQL: `select * from user_recipe_notes` | tylko własne wiersze |
    | B: GET szczegółów | nie widzi notatki A |

5. **Typy TypeScript** — po `supabase gen types` zaktualizować oba pliki `database.types.ts` w PR (CI nie generuje typów).

6. **Testy jednostkowe** — `npm run test:run` lokalnie.

7. **Playwright (zalecane przed merge'em):** zapis / edycja / usunięcie notatki na `/recipes/...` i `/explore/recipes/...`.

---

## 3. Krok 2 — Po merge'u: obserwacja pipeline'u

1. Job **Deploy Backend** — sukces **Push database migrations** przed **Deploy Edge Functions**.
2. Przy błędzie migracji: naprawa w **nowej** migracji, nie edycja zastosowanej.
3. Po **Deploy Frontend** — propagacja hostingu (~kilka minut).

---

## 4. Krok 3 — Weryfikacja po wdrożeniu (manualna)

### 4.1 Supabase

- [ ] Tabela `user_recipe_notes`, RLS włączony, 4 polityki dla `authenticated`.
- [ ] Funkcja `set_recipe_note` — `security invoker`, `EXECUTE` tylko `authenticated`.
- [ ] Advisors: brak krytycznych alertów dla nowej tabeli.

### 4.2 API (produkcja)

- [ ] `PUT /recipes/{id}/note` — zapis, edycja, usunięcie, 422 przy > 2000 znaków.
- [ ] `GET /recipes/{id}`, `GET /explore/recipes/{id}`, `GET /public/recipes/{id}` z JWT — pole `my_note`.
- [ ] GET bez JWT — brak `my_note`.
- [ ] `Cache-Control`: z JWT `no-store` na public detail.

### 4.3 Frontend

- [ ] Zalogowany: sekcja „Moja notatka", zapis, odświeżenie strony zachowuje treść.
- [ ] Gość: brak sekcji.
- [ ] Cudzy publiczny przepis w explore — notatka prywatna dla czytelnika.
- [ ] Regresja: flagi, oceny, plan, kolekcje.

---

## 5. Rollback

| Warstwa | Procedura |
|---|---|
| Frontend | Rollback release w Firebase Hosting. |
| Edge Functions | Redeploy poprzedniego commita (`recipes`, `public`, `explore`). Stary kod ignoruje tabelę notatek. |
| Baza | Zwykle **nie wymagany**. Addytywna tabela + RPC. W razie potrzeby: nowa migracja `drop function …; drop table user_recipe_notes cascade;` — **utrata wszystkich notatek użytkowników**. |

Nie wdrażać samego frontendu bez backendu z endpointem `/note`.

---

## 6. Dokumentacja po wdrożeniu

- [ ] `docs/results/project-summary.md` — PS-31 w „Stan realizacji", tabela `user_recipe_notes`, endpoint `PUT /recipes/{id}/note`, pole `my_note`, komponent UI, usunięcie wpisu z backlogu / aktualizacja „Granice" (notatki przy widocznych cudzych przepisach — zgodnie z PS-95).
- [ ] Checklista DoD w `user-story.md`.
- [ ] Opcjonalnie: kopia planów w `docs/results/new-features/user-stories/PS-31/` (skrót linków do workflow).

---

## 7. Zależności

| Zależność | Status |
|---|---|
| `handle_updated_at()`, `recipes`, `auth.users` | Istniejące |
| Wzorzec PS-95 (widoczność przepisu, RLS) | Do skopiowania |
| `_shared/` wdrażane z funkcjami | Tak — redeploy `recipes`, `public`, `explore` |
| Sekrety / zmienne | Nie dotyczy |
