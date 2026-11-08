# API Endpoints Implementation Plan: PS-31 — Prywatna notatka użytkownika przy przepisie

> **Wejścia:** `user-story.md`, `api-plan.md`, `manual-deployment-plan.md`  
> **Wzorzec:** PS-95 (`set_recipe_flags`, `user_recipe_flags`), PS-99 (mapowanie szczegółów)  
> **Workflow:** `LOCAL-recipe-private-note`  
> **Reguła dostępu:** właściciel **lub** `visibility = 'PUBLIC'` (jak PS-95). **Bez** rozszerzenia API kolekcji / cudzego `SHARED` w kolekcji (osobna przyszła story).

---

## 1. Przegląd punktów końcowych

| # | Endpoint | Funkcja | Zmiana |
|---|---|---|---|
| A | `PUT /recipes/{id}/note` | `recipes` | **Nowy** |
| B1 | `GET /recipes/{id}` | `recipes` | `my_note?` (bez zmiany reguł dostępu szczegółów) |
| B2 | `GET /explore/recipes/{id}` | `explore` | `my_note?` (tylko PUBLIC — bez zmiany explore) |
| B3 | `GET /public/recipes/{id}` | `public` | `my_note?` |

**Baza:** tabela `user_recipe_notes`, RPC `set_recipe_note` (`security invoker`), migracja `20261108120000_create_user_recipe_notes.sql`.

**Współdzielone moduły (nowe):**

- `supabase/functions/_shared/recipe-notes.ts` — `getRecipeNoteForUser(client, recipeId, userId)`.

**Kontrakt:** `shared/contracts/types.ts` — `RecipeNoteDto`, `UpdateRecipeNoteCommand`, `my_note?` na `RecipeDetailDto`.

**Poza zakresem PS-31:** funkcja `user_can_access_recipe`, `recipe-access.ts`, zmiany `getRecipeById` pod kolekcje / cudzy `SHARED`.

---

## 2. Szczegóły żądania — `PUT /recipes/{id}/note`

- **Auth:** JWT wymagany
- **Path:** `id` — liczba całkowita > 0 (`parseAndValidateRecipeId`)
- **Body (strict Zod):** pole `note` — `string | null`, max 2000 znaków
- Po trim pusty string → usunięcie notatki (`null`)

**Odpowiedź 200:** `RecipeNoteDto` (`recipe_id`, `my_note: string | null`).

**Błędy:** 400, 401, 404 (brak przepisu lub brak dostępu — jak PS-95), 422 (`NOTE_TOO_LONG`), 500.

---

## 3. Reguła dostępu

Identyczna jak polityki RLS i RPC `set_recipe_note` / `set_recipe_flags`:

1. Właściciel, `deleted_at IS NULL`
2. `visibility = 'PUBLIC'`

Cudzy `PRIVATE` / `SHARED` → brak zapisu i brak sensownego odczytu szczegółów w istniejących trasach → `404` na `PUT`.

**Bezpieczeństwo:**

- RLS na `user_recipe_notes`: `auth.uid() = user_id`; `WITH CHECK` przez istniejący warunek dostępu do `recipes`.
- RPC `set_recipe_note`: `security invoker`, `user_id` wyłącznie z `auth.uid()` w SQL.
- Odczyt `my_note`: filtr `user_id` z JWT; brak wiersza → `null`.

---

## 4. Przepływ danych

```text
PUT /recipes/{id}/note
  → recipes.handlers (router /note, przed /flags)
  → setRecipeNoteSchema
  → recipes.service.setRecipeNote → rpc('set_recipe_note')

GET */{id}
  → istniejący fetch szczegółów
  → jeśli userId: getRecipeNoteForUser → my_note
  → mapToRecipeDetailDto (recipes / explore / public)
```

**Listy:** bez `my_note`.

---

## 5. Kroki implementacji (kolejność)

1. Migracja SQL (tabela, RLS, `set_recipe_note`).
2. Typy DB + `shared/contracts/types.ts`.
3. `_shared/recipe-notes.ts`.
4. `recipes.service.ts` — `setRecipeNote`, dołączenie notatki w szczegółach.
5. `recipes.handlers.ts` — schema, handler, router.
6. `explore.service.ts` / `public.service.ts`.
7. Testy Deno `recipes.service.test.ts`; Angular `recipe-note.service.spec.ts`.

---

## 6. Testy (Deno / Vitest)

| Test | Oczekiwanie |
|---|---|
| PUT happy path | 200, `my_note` zgodne |
| PUT null / pusty po trim | wiersz usunięty |
| 2001 znaków | 422 / kod `22023` |
| Cudzy PRIVATE / SHARED | 404 |
| PUBLIC + JWT | 200 |
| GET bez JWT | brak klucza `my_note` |
| Router `PUT /recipes/5/note` | poprawna gałąź (nie myli z GET) |

---

## 7. Wydajność

- Jedno dodatkowe zapytanie na GET szczegółów (PK lookup).
- Indeks `idx_user_recipe_notes_recipe_id`.
