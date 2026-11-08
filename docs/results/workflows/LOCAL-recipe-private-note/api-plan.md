# PS-31: Prywatna notatka użytkownika przy przepisie — Plan API

> **User Story:** `user-story.md` (workflow `LOCAL-recipe-private-note`)  
> **Data:** listopad 2026  
> **Dotyczy:** Supabase PostgreSQL (nowa tabela, RPC, RLS) oraz Edge Functions `recipes`, `public`, `explore`  
> **Powiązane:** `ui-plan.md`, `manual-deployment-plan.md`  
> **Wzorzec:** PS-95 (`user_recipe_flags`, `set_recipe_flags`, `PUT /recipes/{id}/flags`, `_shared/recipe-flags.ts`)

---

## 1. Wymagania funkcjonalne (zadania implementacyjne)

| ID | Zadanie |
|---|---|
| API-1 | Utworzyć tabelę `user_recipe_notes` z RLS (tylko właściciel wiersza). |
| API-2 | Dodać RPC `set_recipe_note(p_recipe_id, p_note)` — upsert, usuń wiersz gdy notatka pusta/`null`. |
| API-3 | Dodać endpoint `PUT /recipes/{id}/note` w funkcji `recipes` (walidacja Zod, limit 2000 znaków). |
| API-4 | Rozszerzyć odpowiedzi **szczegółów** o pole `my_note` tylko dla zalogowanego JWT. |
| API-5 | Zaktualizować typy w `shared/contracts/types.ts` (`RecipeNoteDto`, `UpdateRecipeNoteCommand`, `my_note?` w `RecipeDetailDto`). |
| API-6 | Dodać testy jednostkowe handlera/serwisu (happy path, pusta notatka, limit, 404, 401). |
| API-7 | Po migracji zregenerować `shared/types/database.types.ts` i `supabase/functions/_shared/database.types.ts`. |

**Poza zakresem:** notatka na listach, wyszukiwanie full-text po notatkach, rate limiting, autosave, Markdown.

---

## 2. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Tabela `user_recipe_notes` | **Nowa** | `user_id`, `recipe_id`, `note` (`text`, max 2000), znaczniki czasu, PK `(user_id, recipe_id)`, RLS |
| RPC `set_recipe_note` | **Nowa** | Zapis / edycja / usunięcie; reguła dostępu **jak PS-95** (patrz §3.1) |
| `PUT /recipes/{id}/note` | **Nowy endpoint** | Ciało `{ "note": string \| null }` — `null` lub po trim pusty string usuwa notatkę |
| `GET /recipes/{id}` | Modyfikacja | Pole opcjonalne `my_note` (zalogowany) |
| `GET /explore/recipes/{id}` | Modyfikacja | j.w. (widok `/explore/recipes/:id-:slug`) |
| `GET /public/recipes/{id}` | Modyfikacja | j.w. + utrzymanie reguł `Cache-Control` (jak PS-95/99) |
| `_shared/recipe-notes.ts` | **Nowy** | `getRecipeNoteForUser(client, recipeId, userId)` — pojedynczy odczyt dla szczegółów |
| Typy w `shared/contracts/types.ts` | Modyfikacja | Nowe DTO i pole `my_note?` na `RecipeDetailDto` |

**Bez zmian:**

- Listy: `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, `GET /collections/{id}`, wyszukiwanie — **brak** `my_note` (historyjka).
- Widok `recipe_details`, `search_vector`, joby normalizacji, workflow GitHub Actions (endpoint w istniejącej funkcji `recipes`).

---

## 3. Model danych — migracja

**Plik (propozycja):** `supabase/migrations/20261108120000_create_user_recipe_notes.sql`  
Znacznik musi być **większy** niż `20261027120000_create_recipe_ratings.sql`.

```sql
create table public.user_recipe_notes (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_recipe_notes_pkey primary key (user_id, recipe_id),
    constraint user_recipe_notes_note_length check (char_length(note) <= 2000),
    constraint user_recipe_notes_note_not_blank check (char_length(btrim(note)) > 0)
);

create index idx_user_recipe_notes_recipe_id
    on public.user_recipe_notes (recipe_id);

create trigger set_user_recipe_notes_updated_at
    before update on public.user_recipe_notes
    for each row
    execute function public.handle_updated_at();

alter table public.user_recipe_notes enable row level security;
revoke all on table public.user_recipe_notes from anon;

create policy "authenticated users can select own recipe notes"
    on public.user_recipe_notes for select to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe notes"
    on public.user_recipe_notes for insert to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
              and recipes.deleted_at is null
              and (recipes.user_id = auth.uid() or recipes.visibility = 'PUBLIC')
        )
    );

create policy "authenticated users can update own recipe notes"
    on public.user_recipe_notes for update to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1 from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
              and recipes.deleted_at is null
              and (recipes.user_id = auth.uid() or recipes.visibility = 'PUBLIC')
        )
    );

create policy "authenticated users can delete own recipe notes"
    on public.user_recipe_notes for delete to authenticated
    using (auth.uid() = user_id);
```

### 3.1 Reguła dostępu (zgodna z PS-95 / aktualnym przeglądaniem)

Zapis i odczyt `my_note` tylko gdy `deleted_at IS NULL` oraz:

- **właściciel** przepisu (dowolna `visibility`), **lub**
- **`visibility = 'PUBLIC'`**

**Poza PS-31:** cudzy `SHARED` w kolekcji — przyszła User Story (rozszerzenie API kolekcji). **Bez zmian** `getRecipeById` poza standardowym odczytem notatki dla już dostępnych szczegółów.

**RPC `set_recipe_note`:**

- `security invoker`, `search_path = ''`.
- Wejście: `p_recipe_id bigint`, `p_note text` (może być `null`).
- Jeśli `p_note` po `btrim` jest puste → `DELETE` wiersza; zwróć `my_note: null`.
- W przeciwnym razie walidacja długości ≤ 2000; `INSERT … ON CONFLICT DO UPDATE`.
- Brak widocznego przepisu → wyjątek mapowany na `404` (`Recipe not found`).
- Brak JWT → `401`.

```typescript
-- Zwracana struktura (przykład)
returns table (out_recipe_id bigint, out_my_note text)
```

**Uprawnienia:** `GRANT EXECUTE` tylko `authenticated`; `REVOKE` od `public` i `anon`.

---

## 4. Endpoint `PUT /recipes/{id}/note`

**Ścieżka:** `PUT /functions/v1/recipes/{id}/note`  
**Auth:** wymagany JWT (`user` \| `premium` \| `admin`).

**Request body (JSON):**

```json
{ "note": "Zamiast śmietany używam jogurtu greckiego." }
```

| Pole | Typ | Reguły |
|---|---|---|
| `note` | `string \| null` | Wymagane w body. `null` lub `""` (po trim) = usunięcie. Max 2000 znaków po trim. Tylko zwykły tekst (bez HTML); sanityzacja po stronie API: odrzucić znaki kontrolne poza `\n`, `\r`, `\t` lub je znormalizować. |

**Response `200 OK` — `RecipeNoteDto`:**

```json
{
    "recipe_id": 42,
    "my_note": "Zamiast śmietany używam jogurtu greckiego."
}
```

Po usunięciu: `"my_note": null`.

**Błędy:**

| Sytuacja | HTTP | Kod / komunikat |
|---|---|---|
| Brak JWT | 401 | Standardowa obsługa auth |
| Nieprawidłowe `id` | 400 | Walidacja path |
| Brak pola `note` | 400 | Walidacja body |
| Notatka > 2000 znaków | 422 | np. `NOTE_TOO_LONG` |
| Przepis niedostępny (reguła PS-95) | 404 | `Recipe not found` |
| Błąd bazy | 500 | `INTERNAL_ERROR` |

**Implementacja (pliki):**

- Routing w `recipes.handlers.ts` (regex `^/recipes/(\d+)/note$` przed krótszymi ścieżkami).
- Handler: walidacja Zod, wywołanie `setRecipeNote` w `recipes.service.ts`.
- Logowanie: `info` przy sukcesie, `warn` przy walidacji, bez logowania treści notatki na poziomie `info` (PII — tylko `recipe_id`, `user_id`).

**Idempotencja:** wielokrotny `PUT` z tą samą treścią aktualizuje `updated_at`, ale nie tworzy duplikatu.

---

## 5. Odczyt `my_note` w GET szczegółów

Pole **`my_note?: string | null`**:

- Obecne **tylko**, gdy żądanie ma ważny JWT i użytkownik jest zalogowany.
- **Nie** zwracane dla gościa (klucz nie występuje w JSON).
- Wartość `null` lub brak wiersza w DB — pole może być `null` lub pominięte (rekomendacja: **jawnie `null`** dla spójności z `my_rating`).

**Miejsca implementacji:**

| Endpoint | Funkcja / plik |
|---|---|
| `GET /recipes/{id}` | `recipes.service.ts` — po załadowaniu przepisu, jeśli `userId`, `getRecipeNoteForUser` |
| `GET /explore/recipes/{id}` | `explore.service.ts` |
| `GET /public/recipes/{id}` | `public.service.ts` |

**Cache-Control (public):**

- Z JWT: `no-store` (notatka osobista w odpowiedzi).
- Bez JWT: bez zmian (`public, max-age=60`) — odpowiedź i tak nie zawiera `my_note`.

**Listy:** celowo **bez** JOIN do `user_recipe_notes`.

---

## 6. Kontrakt TypeScript (`shared/contracts/types.ts`)

```typescript
/** Odpowiedź PUT /recipes/{id}/note */
export interface RecipeNoteDto {
    recipe_id: number;
    my_note: string | null;
}

/** PUT /recipes/{id}/note */
export interface UpdateRecipeNoteCommand {
    note: string | null;
}
```

Rozszerzenie `RecipeDetailDto` / `RecipeDetail`:

```typescript
/** Prywatna notatka zalogowanego użytkownika; pomijana dla gościa. */
my_note?: string | null;
```

---

## 7. Testy API (zakres planu)

| Scenariusz | Oczekiwanie |
|---|---|
| Zapis notatki na własnym przepisie | 200, GET zwraca tę samą treść |
| Edycja | 200, nowa treść |
| `{ "note": null }` i `""` | 200, `my_note: null`, brak wiersza w tabeli |
| 2001 znaków | 422 |
| Cudzy `PRIVATE` | 404 na PUT |
| Cudzy `PUBLIC` | 200 |
| Bez JWT | 401 |
| Użytkownik B nie widzi notatki A w GET | brak treści A / RLS |

Testy: `recipes.service.test.ts`, `recipes.handlers` (jeśli istnieją wzorce dla `/flags` i `/rating`).

---

## 8. Mapowanie na kryteria akceptacji historyjki

| Scenariusz US | Warstwa API |
|---|---|
| 1–4 Happy path / edycja / usunięcie / cudzy publiczny | `PUT` + `GET` `my_note` |
| 5 Gość | Brak pola w GET public/explore |
| 6 Limit | CHECK + walidacja Zod |
| 7 Niedostępny przepis | 404 |
| 8 Błąd serwera | 5xx, bez częściowego zapisu |
| 9 Prywatność | RLS + brak cross-user read |
