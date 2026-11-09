# API Endpoints Implementation Plan: PS-31 — Osobista notatka użytkownika do przepisu

> **Historyjka:** PS-31 (`docs/results/new-features/user-stories/PS-31/PS-31-personal-user-note-on-recipe-user-story.md`)
> **Specyfikacja API:** `docs/results/new-features/user-stories/PS-31/PS-31-personal-user-note-on-recipe-api-plan.md`
> **Powiązane plany:** `PS-31-personal-user-note-on-recipe-ui-plan.md`, `PS-31-personal-user-note-on-recipe-deployment-plan.md`
> **Wzorce w kodzie:** PS-95 (`user_recipe_flags`, `set_recipe_flags`, `_shared/recipe-flags.ts`, `handleSetRecipeFlags`) oraz PS-99 (`my_rating`, `_shared/recipe-ratings.ts`, `handleSetRecipeRating`)
> **Stan kodu zweryfikowany:** 9 listopada 2026 (ostatnia migracja: `20261027120000_create_recipe_ratings.sql`)

---

## 1. Przegląd punktów końcowych

Zakres: **jeden nowy endpoint zapisu** oraz **rozszerzenie trzech istniejących endpointów szczegółów** o pole `my_note`. Wszystko działa w istniejących Edge Functions (`recipes`, `explore`, `public`) — nie dochodzi nowa funkcja ani krok w `.github/workflows/main-deploy.yml`.

| # | Endpoint | Funkcja Edge | Typ zmiany | Cel |
|---|---|---|---|---|
| A | `PUT /recipes/{id}/note` | `recipes` | **Nowy** | Idempotentny zapis / usunięcie prywatnej notatki (`null`, `""`, same białe znaki = usunięcie) |
| B1 | `GET /recipes/{id}` | `recipes` | Rozszerzenie | `my_note` (obie ścieżki: RLS oraz `PUBLIC` przez service role); skutkiem ubocznym także `POST /recipes` i `PUT /recipes/{id}` |
| B2 | `GET /explore/recipes/{id}` | `explore` | Rozszerzenie | `my_note` w **obu** gałęziach (`PUBLIC` i „autor") — z tego endpointu korzysta widok `/explore/recipes/:id-:slug` |
| B3 | `GET /public/recipes/{id}` | `public` | Rozszerzenie | `my_note` tylko dla żądań z ważnym JWT |

Dodatkowo:

- **Baza:** tabela `user_recipe_notes` (RLS) + RPC `set_recipe_note` (migracja `supabase/migrations/20261109120000_create_user_recipe_notes.sql`).
- **Współdzielony moduł:** `supabase/functions/_shared/recipe-notes.ts` (odczyt pojedynczej notatki, normalizacja, liczenie znaków, typ odpowiedzi).
- **Kontrakt:** `shared/contracts/types.ts` + nowy `shared/contracts/recipe-note.ts` (stała limitu dla frontendu).

**Bez zmian:** listy i kafelki (`GET /recipes`, `/recipes/feed`, `GET /public/recipes`, `/public/recipes/feed`, `GET /collections/{id}`), `GET /search/global`, `GET /plan`, `GET /shopping-list`, funkcje `ai`/`plan`/`shopping-list`, tabela `recipes`, widok `recipe_details`, RPC `get_recipes_list`, `search_vector`, joby normalizacji, polityki RLS `recipes` i `recipe_collections`.

### Ustalenia z weryfikacji kodu (korekty / doprecyzowania względem planu API)

| # | Ustalenie | Konsekwencja dla wdrożenia |
|---|---|---|
| 1 | `recipesRouter` dopasowuje `extractRecipeIdFromPath` wzorcem `/recipes/([^/]+)$`, więc `/recipes/123/note` **nie** daje `recipeId`. Bez dedykowanej gałęzi `GET /recipes/123/note` zwróciłby listę przepisów, a `POST` utworzył nowy przepis. | Gałąź `noteRecipeId` musi stać **przed** gałęziami metod i obsługiwać każdą metodę (`PUT` → handler, reszta → `405` z `Allow: PUT, OPTIONS`). Obowiązkowy test routera. |
| 2 | `getRecipeById` ma **dwa** bloki `Promise.all` (ścieżka RLS i ścieżka `PUBLIC` przez service role), a `getExploreRecipeById` — dwa (gałąź `PUBLIC` i gałąź autora). | `getMyRecipeNote` trzeba dodać w **czterech** miejscach (2× `recipes.service.ts`, 2× `explore.service.ts`) i w jednym w `public.service.ts`. |
| 3 | W `getRecipeById` odczyt notatki idzie zawsze klientem użytkownika (`client`), także w ścieżce service role (tam `serviceClient` służy wyłącznie do odczytu przepisu). | RLS dodatkowo zawęża `SELECT` do `auth.uid() = user_id`; jawny `.eq('user_id', …)` zostaje jako druga warstwa. |
| 4 | `explore` i `public` używają klienta **service role** (omija RLS). | Obowiązkowy `.eq('user_id', requesterUserId)`; `userId` wyłącznie z `getOptionalAuthenticatedUser`. Test jednostkowy asercją na wywołaniu `eq('user_id')`. |
| 5 | `RecipeDetailDto` w `shared/contracts/types.ts` to **alias** `Omit<RecipeDetail, …> & { … }`, a nie `interface`. | `my_note?: string \| null` dopisujemy do części intersekcji (obok `my_rating?`); `PublicRecipeDetailDto` jest `interface`. |
| 6 | Lokalny `createSuccessResponse(data, status)` w `recipes.handlers.ts` nie przyjmuje nagłówków; `handleGetRecipeById` nie ustawia `Cache-Control`. W `public.handlers.ts` istnieje już `createCachedResponse(data, isAuthenticated)` (z JWT → `no-store`), a `handleGetPublicRecipeById` z niego korzysta. `explore` ustawia `no-store` dla JWT. | Do zmiany tylko `recipes`: dodać opcjonalny argument nagłówków w `createSuccessResponse` i użyć `no-store` dla `GET /recipes/{id}` oraz `PUT …/note`. `public` i `explore` — bez zmian w cache. |
| 7 | `createRecipe` (wywołuje `getRecipeById`, `recipes.service.ts` ~l. 1369) i `updateRecipe` (~l. 1540) zwracają szczegóły przez `getRecipeById`. | Ich odpowiedzi zyskają `my_note` (po utworzeniu `null`) bez dodatkowego kodu; edycja przepisu nie dotyka notatki. |
| 8 | Backend ma **testy Deno** (`*.test.ts` obok kodu, `deno.land/std` asserts, ręczne mocki klienta, np. `_shared/recipe-flags.test.ts`, `recipes.service.test.ts`). CI (`main-deploy.yml`) uruchamia tylko Vitest z `src/**`. | Testy backendu piszemy w Deno wg istniejącego wzorca i uruchamiamy ręcznie przed merge'em. |
| 9 | Dwa pliki typów bazy: `supabase/functions/_shared/database.types.ts` i `shared/types/database.types.ts`. | Po migracji regenerujemy **oba** (jak w PS-99). |
| 10 | Różnica `trim`: JS `String.prototype.trim()` obcina także białe znaki Unicode (np. NBSP), a `btrim(..., E' \t\n')` w RPC tylko spację/tab/LF. | API jest główną ścieżką (normalizuje przed RPC), więc RPC nie zmienia już wyniku; dla bezpośredniego PostgREST zachowanie jest minimalnie węższe — akceptowalne, opisane w komentarzu migracji. Limit liczony zawsze po code points (`Array.from` / `char_length`). |

---

## 2. Szczegóły żądania

### A. `PUT /recipes/{id}/note` (nowy)

- **Metoda HTTP:** `PUT`
- **Struktura URL:** `/functions/v1/recipes/{id}/note`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), dowolna rola (`user`, `premium`, `admin`). Rola nie ma znaczenia; `user_id` wyłącznie z JWT (`auth.uid()` w RPC).
- **Parametry:**
    - Wymagane: `id` (path) — liczba całkowita > 0 (sam numer, bez sluga; `parseAndValidateRecipeId`)
    - Opcjonalne: brak
- **Request Body** (`Content-Type: application/json`):

```json
{
    "note": "Zmniejszyć ilość cukru o połowę"
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `note` | `string \| null` | **tak** | Treść notatki. `null`, `""` lub same białe znaki usuwają notatkę. Pominięcie pola jest błędem |

**Walidacja (Zod `.strict()` + normalizacja):**

1. pole `note` musi wystąpić; typ `string | null`; nieznane pola (np. `user_id`, `recipe_id`) → `400`,
2. techniczny limit surowego wejścia: `.max(20000)` (ochrona przed gigantycznym ciałem), przed normalizacją,
3. normalizacja: `\r\n` i `\r` → `\n`, `trim()`; pusty wynik → `null` (usunięcie),
4. długość po normalizacji w **code points** (`Array.from(note).length`, nie `.length`) ≤ `2000`, inaczej `400`,
5. niepoprawny JSON → `400`; niepoprawne `id` (nie-liczba, `0`, ujemne, ułamek) → `400`.

```typescript
// supabase/functions/recipes/recipes.handlers.ts
const setRecipeNoteSchema = z
    .object({
        note: z
            .string({
                required_error: 'note is required',
                invalid_type_error: 'note must be a string or null',
            })
            .max(20000, 'note is too long')
            .nullable(),
    })
    .strict()
    .transform((body, ctx) => {
        const note = normalizeRecipeNote(body.note);
        if (note !== null && countRecipeNoteCharacters(note) > RECIPE_NOTE_MAX_LENGTH) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['note'],
                message: `note must be at most ${RECIPE_NOTE_MAX_LENGTH} characters`,
            });
            return z.NEVER;
        }
        return { note };
    });
```

> `z.string({ required_error })` + `.nullable()`: brakujące pole daje błąd „required", a `null` jest dozwolone — zweryfikować w teście jednostkowym schematu (kluczowy przypadek: `{}` → `400`, `{ "note": null }` → OK).

### B. Rozszerzone endpointy odczytu

Żadnych nowych parametrów, nagłówków ani zmian w żądaniach. Zmiana dotyczy wyłącznie odpowiedzi szczegółów. Tożsamość tylko ze zweryfikowanego JWT (`getAuthenticatedContext` / `getOptionalAuthenticatedUser`).

---

## 3. Wykorzystywane typy

### Nowe — `shared/contracts/types.ts`

```typescript
/** Ciało PUT /recipes/{id}/note. null / "" / same białe znaki usuwają notatkę. */
export interface SetRecipeNoteRequestDto {
    note: string | null;
}

/** Odpowiedź PUT /recipes/{id}/note: zapisany, znormalizowany stan. */
export interface RecipeNoteResponseDto {
    recipe_id: number;
    /** Zapisana notatka po trim/normalizacji; null po usunięciu. */
    note: string | null;
    /** Czas ostatniego zapisu notatki; null po usunięciu. */
    updated_at: string | null;
}
```

### Nowy plik — `shared/contracts/recipe-note.ts`

```typescript
// Stała współdzielona z frontendem; zsynchronizowana z CHECK w bazie i _shared/recipe-notes.ts
export const RECIPE_NOTE_MAX_LENGTH = 2000;
```

### Rozszerzenia istniejących DTO (pole **opcjonalne**)

```typescript
/** Prywatna notatka zalogowanego użytkownika; pominięta dla gościa i gdy odczyt się nie powiódł. */
my_note?: string | null;
```

| DTO | Lokalizacja do zmiany |
|---|---|
| `RecipeDetailDto` (alias) | `shared/contracts/types.ts` (część `& { … }`, obok `my_rating?`) |
| `PublicRecipeDetailDto` | `shared/contracts/types.ts` |
| lokalne `RecipeDetailDto` | `supabase/functions/recipes/recipes.service.ts` (obok `my_rating?`, ~l. 208) |
| lokalne `RecipeDetailDto` | `supabase/functions/explore/explore.service.ts` (obok `my_rating?`, ~l. 115) |
| lokalne `PublicRecipeDetailDto` | `supabase/functions/public/public.service.ts` (obok `my_rating?`, ~l. 215) |

Funkcje Edge nie importują `shared/contracts`, więc `RecipeNoteResponseDto` (backendowa kopia) definiujemy w `_shared/recipe-notes.ts` (jak `RecipeFlagsDto` w `_shared/recipe-flags.ts`).

### Command model serwisu (`recipes.service.ts`)

```typescript
export interface SetRecipeNoteInput {
    recipeId: number;
    note: string | null; // już znormalizowana (null = usunięcie)
}
```

---

## 4. Szczegóły odpowiedzi

### `PUT /recipes/{id}/note` — `200 OK`

```json
{
    "recipe_id": 123,
    "note": "Zmniejszyć ilość cukru o połowę",
    "updated_at": "2026-11-09T20:15:00.123456+00:00"
}
```

Po usunięciu (także idempotentnym): `{ "recipe_id": 123, "note": null, "updated_at": null }`.

`note` to **zapisana, znormalizowana wartość** (scenariusz 8) — frontend wyświetla dokładnie ją. Nagłówek: `Cache-Control: no-store` (dane prywatne).

### Odczyt — pole `my_note`

| Sytuacja | `my_note` w JSON |
|---|---|
| Zalogowany, notatka istnieje | `"tekst"` |
| Zalogowany, brak notatki | `null` |
| Gość (`explore`, `public`) | **klucz nieobecny** |
| Zalogowany, błąd odczytu notatki | **klucz nieobecny** (patrz niżej) |

**Dlaczego błąd odczytu → pominięcie pola, a nie `null`:** helpery flag/ocen przy błędzie zwracają „brak danych", co jest nieszkodliwe. Dla notatki byłoby groźne — UI pokazałoby „Dodaj notatkę", a zapis nadpisałby istniejącą, niewidoczną notatkę (utrata danych). Frontend (plan UI) ukrywa sekcję, gdy dla zalogowanego `my_note === undefined`. Błąd odczytu nie blokuje reszty szczegółów przepisu.

Listy nie zawierają notatki.

### Kody statusu

| Kod HTTP | `code` | Endpoint | Sytuacja |
|---|---|---|---|
| `200 OK` | — | `PUT …/note` i `GET` szczegółów | Notatka zapisana / usunięta (lub stan już zgodny — idempotencja); odczyt poprawny |
| `201 Created` | — | — | **Nie dotyczy** (upsert zawsze `200`, także przy pierwszym zapisie — historyjka, sc. 1) |
| `204 No Content` | — | — | **Nie dotyczy** (usunięcie zwraca `200` z `note: null`); `204` tylko dla preflight `OPTIONS` |
| `400 Bad Request` | `VALIDATION_ERROR` | `PUT …/note` | Niepoprawne `id`, niepoprawny JSON, puste ciało, brak `note`, zły typ, nieznane pole, >2000 znaków po trim; RPC `22023` |
| `401 Unauthorized` | `UNAUTHORIZED` | `PUT …/note` | Brak lub nieważny JWT; RPC `42501` |
| `402 Payment Required` | — | — | **Nie dotyczy** (brak limitów, kredytów i różnic między planami) |
| `403 Forbidden` | — | `PUT …/note` | **Nie dotyczy** — świadomie `404` (nie ujawniamy istnienia cudzego przepisu). `GET /recipes/{id}` zachowuje dotychczasowe `403` dla cudzego nie-`PUBLIC` (bez zmian) |
| `404 Not Found` | `NOT_FOUND` | `PUT …/note` | Przepis nie istnieje, jest soft-deleted albo niedostępny (cudzy `PRIVATE`/`SHARED`); RPC `P0002` |
| `405 Method Not Allowed` | `METHOD_NOT_ALLOWED` | `/recipes/{id}/note` | Metoda inna niż `PUT`/`OPTIONS` (`Allow: PUT, OPTIONS`) |
| `409 Conflict` | — | — | **Nie dotyczy** (równoległe zapisy rozstrzyga `ON CONFLICT`; ostatni zapis wygrywa) |
| `422 Unprocessable Entity` | — | — | **Nie dotyczy** — błędy walidacji w tym API mapują się na `400` (spójnie z PS-95/PS-99) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | `PUT …/note` | Inny błąd bazy lub RPC bez wiersza wyniku |

Format błędu zawsze `{ code, message, details }` (istniejące `ApplicationError` + `handleError`). **Nie dodajemy nowych `ErrorCode`.**

---

## 5. Przepływ danych

### `PUT /recipes/{id}/note`

```
recipesRouter: noteRecipeId (przed gałęziami metod)
→ handleSetRecipeNote(req, noteRecipeId)
  → parseAndValidateRecipeId(id)                  → 400
  → getAuthenticatedContext(req)                  → 401
  → req.json()                                    → 400 (zły JSON)
  → setRecipeNoteSchema.safeParse(body)           → 400 (+ normalizacja, limit)
  → setRecipeNote(client, { recipeId, note })
      → client.rpc('set_recipe_note', { p_recipe_id, p_note })
          P0002 → NOT_FOUND (404)
          22023 → VALIDATION_ERROR (400)
          42501 → UNAUTHORIZED (401)
          inny / brak wiersza → INTERNAL_ERROR (500, log bez treści notatki)
  → 200 { recipe_id, note, updated_at }  + Cache-Control: no-store
```

Kolejność „id przed JWT" jak w `handleSetRecipeFlags`/`handleSetRecipeRating`: zły `id` bez JWT → `400`, poprawny `id` bez JWT → `401` (scenariusz 17).

### Odczyt szczegółów

```
kontrola dostępu do przepisu (404/403 bez zmian)  →  dopiero potem
getMyRecipeNote(client, recipeId, requesterUserId)  (w Promise.all z planem/flagami/ocenami)
→ mapowanie: ...(myNote !== undefined && { my_note: myNote })
```

Notatka jest czytana **po** przejściu kontroli dostępu, więc niedostępny przepis nigdy nie ujawnia notatki (scenariusz 19).

---

## 6. Względy bezpieczeństwa

### Uwierzytelnianie i role

- `PUT …/note`: wymagany JWT; dowolna rola (`user`, `premium`, `admin`); brak limitów liczby notatek.
- `GET` szczegółów: `recipes` — JWT wymagany (jak dziś); `explore`/`public` — JWT opcjonalny, `my_note` tylko dla zweryfikowanego JWT.
- `user_id` nigdy z ciała żądania (`.strict()` odrzuca nieznane pola); w RPC wyłącznie `auth.uid()`.

### Prywatność (RLS + aplikacja)

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt cudzych notatek (w tym autor przepisu i admin) | RLS `auth.uid() = user_id` na `SELECT/INSERT/UPDATE/DELETE`; brak polityk dla `admin`/`anon`; w funkcjach z service role (`public`, `explore`) obowiązkowy `.eq('user_id', userId)` |
| Zapis do niedostępnego przepisu | `exists` w RPC + `WITH CHECK` w RLS → `404` |
| Ujawnienie istnienia cudzego przepisu | `404` zamiast `403` |
| Obejście walidacji przez bezpośredni PostgREST (`/rest/v1/rpc/set_recipe_note`) | RPC sam normalizuje i waliduje (`22023`); `CHECK char_length(note) BETWEEN 1 AND 2000` w tabeli |
| XSS / Markdown | Treść przechowywana dosłownie; API jej nie interpretuje; frontend renderuje przez interpolację (nigdy `innerHTML`) |
| Wyciek przez cache | `PUT` i `GET /recipes/{id}` → `no-store`; `explore` z JWT → `no-store`; `public` z JWT → `no-store` (`createCachedResponse`); gość nigdy nie dostaje `my_note` |
| Wyciek przez logi | Logujemy `userId`, `recipeId`, **długość** notatki; **nigdy treści** |
| Gigantyczne ciało | Limit surowego wejścia 20 000 znaków przed normalizacją |
| Wpływ na przepis | Brak zapisu do `recipes` → `updated_at`, `search_vector`, joby normalizacji bez zmian |

### Zakres uprawnień RPC

`security invoker`, `set search_path = ''`, `revoke … from public, anon`, `grant execute … to authenticated`.

---

## 7. Obsługa błędów — mapowanie

| Źródło | Kod / sytuacja | `ApplicationError` | HTTP |
|---|---|---|---|
| `parseAndValidateRecipeId` | niepoprawne `id` | `VALIDATION_ERROR` | 400 |
| `req.json()` | niepoprawny JSON | `VALIDATION_ERROR` | 400 |
| `setRecipeNoteSchema` | brak/zły typ `note`, nieznane pole, >2000 | `VALIDATION_ERROR` (`Invalid input: <path>: <message>`) | 400 |
| `getAuthenticatedContext` | brak/nieważny JWT | `UNAUTHORIZED` | 401 |
| RPC `42501` | brak uwierzytelnienia w bazie | `UNAUTHORIZED` | 401 |
| RPC `P0002` | przepis nie istnieje / niedostępny | `NOT_FOUND` | 404 |
| RPC `22023` | notatka >2000 | `VALIDATION_ERROR` | 400 |
| RPC inny kod / `data[0]` puste | błąd bazy | `INTERNAL_ERROR` (log: `errorCode`, `errorMessage`, `recipeId`) | 500 |
| router | metoda ≠ `PUT` | `405` + `Allow: PUT, OPTIONS` | 405 |
| `getMyRecipeNote` | błąd bazy | brak wyjątku; log + pominięcie `my_note` | 200 |

---

## 8. Wydajność

- `PUT`: jedno wywołanie RPC (sprawdzenie przepisu po PK + upsert/delete po PK).
- Odczyt: jedno dodatkowe zapytanie po PK `(user_id, recipe_id)` w istniejącym `Promise.all` (równolegle z planem, flagami, ocenami) — bez wydłużania krytycznej ścieżki.
- Indeks `idx_user_recipe_notes_recipe_id` obsługuje kaskadę z `recipes`; PK obsługuje kaskadę z `auth.users` i odczyty.
- Ten sam tekst ponownie → `ON CONFLICT … WHERE note IS DISTINCT FROM` pomija zapis (brak zbędnych wersji wiersza i zmiany `updated_at`).
- Brak indeksu pełnotekstowego — notatka nie uczestniczy w wyszukiwaniu.

---

## 9. Etapy wdrożenia (kolejność)

### Krok 1. Migracja

**Plik:** `supabase/migrations/20261109120000_create_user_recipe_notes.sql` (znacznik czasu większy niż `20261027120000`, inaczej `supabase db push` odrzuci migrację jako „out of order").

Zawartość (SQL jak w planie API, pkt 2.1–2.3), w kolejności:

1. nagłówek (`Migration`, `Description`, `Dependencies: auth.users, public.recipes, public.handle_updated_at()`),
2. `create table public.user_recipe_notes` — kolumny: `user_id uuid not null` FK → `auth.users(id) on delete cascade`, `recipe_id bigint not null` FK → `public.recipes(id) on delete cascade`, `note text not null`, `created_at`/`updated_at timestamptz not null default now()`; `constraint user_recipe_notes_pkey primary key (user_id, recipe_id)`; `constraint user_recipe_notes_note_length check (char_length(note) between 1 and 2000)`,
3. `create index idx_user_recipe_notes_recipe_id on public.user_recipe_notes (recipe_id)`,
4. `create trigger set_user_recipe_notes_updated_at before update … execute function public.handle_updated_at()`,
5. `alter table … enable row level security`; `revoke all on table … from anon`,
6. cztery polityki (`to authenticated`):
    - `select` — `using (auth.uid() = user_id)`,
    - `insert` — `with check (auth.uid() = user_id and exists (select 1 from public.recipes where recipes.id = user_recipe_notes.recipe_id and recipes.deleted_at is null and (recipes.user_id = auth.uid() or recipes.visibility = 'PUBLIC')))`,
    - `update` — `using (auth.uid() = user_id)` + ten sam `with check` co insert,
    - `delete` — `using (auth.uid() = user_id)` (bez warunku widoczności przepisu),
7. `comment on table/column`,
8. `create or replace function public.set_recipe_note(p_recipe_id bigint, p_note text default null)` — `returns table (out_recipe_id bigint, out_note text, out_updated_at timestamptz)`, `language plpgsql`, `security invoker`, `set search_path = ''`:
    - `auth.uid() is null` → `42501`,
    - normalizacja: `replace(replace(coalesce(p_note,''), E'\r\n', E'\n'), E'\r', E'\n')`, `btrim(…, E' \t\n')`, `nullif(…, '')`,
    - `char_length(v_note) > 2000` → `22023`,
    - `not exists (recipes: id = p_recipe_id and deleted_at is null and (user_id = v_user_id or visibility = 'PUBLIC'))` → `P0002` (także przy usuwaniu — scenariusz 19),
    - `v_note is null` → `delete … where user_id = v_user_id and recipe_id = p_recipe_id`; zwraca `(p_recipe_id, null, null)`,
    - w przeciwnym razie `insert … on conflict (user_id, recipe_id) do update set note = excluded.note where n.note is distinct from excluded.note`; zwraca `(recipe_id, note, updated_at)` z tabeli,
9. `revoke all on function … from public; revoke … from anon; grant execute … to authenticated;` + `comment on function`.

Uwagi:

- `created_at` przy edycji bez zmian (upsert zmienia tylko `note`; trigger tylko `updated_at`) — scenariusz 5.
- Brak triggerów/zapisów do `recipes` — scenariusz 23.
- Komentarz w migracji o różnicy `trim` JS vs `btrim` (ustalenie 10).
- Brak polityk dla `admin`.

### Krok 2. Regeneracja typów bazy

```powershell
supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
supabase gen types typescript --local > shared/types/database.types.ts
```

Zweryfikować w diffie, że zmiany dotyczą wyłącznie `user_recipe_notes` i `set_recipe_note` (jeśli generator zmienia nieistotne rzeczy, cofnąć niezwiązane różnice).

### Krok 3. Moduł `supabase/functions/_shared/recipe-notes.ts` (nowy)

Eksporty:

- `RECIPE_NOTE_MAX_LENGTH = 2000`,
- `interface RecipeNoteResponseDto { recipe_id: number; note: string | null; updated_at: string | null }`,
- `normalizeRecipeNote(raw: string | null): string | null` — `null` → `null`; `raw.replace(/\r\n?/g, '\n').trim()`; pusty → `null`,
- `countRecipeNoteCharacters(note: string): number` — `Array.from(note).length`,
- `getMyRecipeNote(client, recipeId, userId): Promise<string | null | undefined>`:
    - `userId === null` → `undefined` **bez zapytania**,
    - `client.from('user_recipe_notes').select('note').eq('user_id', userId).eq('recipe_id', recipeId).maybeSingle()`,
    - błąd → `logger.error` (`errorCode`, `errorMessage`, `userId`, `recipeId`; **bez treści**) i `undefined`,
    - brak wiersza → `null`; wiersz → `data.note`,
    - `try/catch` na nieoczekiwane wyjątki → log + `undefined`.

### Krok 4. Serwis `recipes.service.ts`

1. Import z `../_shared/recipe-notes.ts`.
2. `setRecipeNote(client, input: SetRecipeNoteInput): Promise<RecipeNoteResponseDto>` — wywołanie RPC `set_recipe_note` z `p_recipe_id` i `p_note: input.note ?? undefined`; mapowanie błędów wg pkt 7; wynik `{ recipe_id: Number(row.out_recipe_id), note: row.out_note ?? null, updated_at: row.out_updated_at ?? null }`. W logu błędu: tylko `errorCode`, `errorMessage`, `recipeId`.
3. `getRecipeById`: dodać `getMyRecipeNote(client, id, requesterUserId)` do **obu** `Promise.all`; `mapToRecipeDetailDto(..., myNote)` jako dodatkowy argument; w mapperze `...(myNote !== undefined && { my_note: myNote })`.
4. Lokalny `RecipeDetailDto`: `my_note?: string | null`.

### Krok 5. Handler i router `recipes.handlers.ts`

1. `setRecipeNoteSchema` (pkt 2) + importy `normalizeRecipeNote`, `countRecipeNoteCharacters`, `RECIPE_NOTE_MAX_LENGTH`, `setRecipeNote`, `SetRecipeNoteInput`.
2. `handleSetRecipeNote(req, recipeIdParam)` wg wzorca `handleSetRecipeRating`: loguje `userId`, `recipeId`, długość notatki (nie treść); zwraca `createSuccessResponse(result, 200, { 'Cache-Control': 'no-store' })`.
3. `createSuccessResponse<T>(data, status = 200, extraHeaders?: Record<string, string>)` — dołączenie nagłówków bez zmiany zachowania pozostałych handlerów.
4. `handleGetRecipeById`: użyć `Cache-Control: no-store`.
5. `extractRecipeIdFromNotePath(url)` z wzorcem `/\/recipes\/([^/]+)\/note\/?$/`.
6. `recipesRouter`: `const noteRecipeId = extractRecipeIdFromNotePath(url)` obok `flagsRecipeId`/`ratingRecipeId`; blok `if (noteRecipeId)` **przed** gałęziami `GET`/`POST`: `PUT` → handler, inne metody → `405` `{ code: 'METHOD_NOT_ALLOWED', message: 'Method X not allowed for /recipes/{id}/note. Use PUT.' }` z `Allow: PUT, OPTIONS`. CORS: `Access-Control-Allow-Methods` zawiera już `PUT`.
7. Komentarze: lista endpointów w JSDoc `recipesRouter` (dopisać `PUT /recipes/{id}/note` i brakujące `flags`) oraz nagłówek `recipes/index.ts` (dopisać `flags` i `note`).

### Krok 6. `explore.service.ts`

1. Import `getMyRecipeNote`.
2. `getExploreRecipeById`: `getMyRecipeNote(client, recipeId, requesterUserId)` do `Promise.all` w gałęzi `PUBLIC` **i** w gałęzi autora; `mapToDto(..., myNote)`.
3. `mapToDto`: dodatkowy argument `myNote?: string | null`; `...(myNote !== undefined && { my_note: myNote })`.
4. Lokalny `RecipeDetailDto`: `my_note?: string | null`.
5. Handler bez zmian (nagłówki cache już poprawne).

### Krok 7. `public.service.ts`

1. Import `getMyRecipeNote`.
2. `getPublicRecipeById`: w bloku `if (userId !== null)` dodać `getMyRecipeNote(client, params.id, userId)` do `Promise.all`; zmienna `myNote: string | null | undefined`.
3. Do `recipeDto`: `...(myNote !== undefined && { my_note: myNote })` (dla gościa `myNote` zostaje `undefined` → klucz nieobecny).
4. Lokalny `PublicRecipeDetailDto`: `my_note?: string | null`.
5. Handler bez zmian (`createCachedResponse` już daje `no-store` dla JWT).

### Krok 8. Kontrakty

- `shared/contracts/types.ts`: `SetRecipeNoteRequestDto`, `RecipeNoteResponseDto`, `my_note?` w `RecipeDetailDto` i `PublicRecipeDetailDto`.
- `shared/contracts/recipe-note.ts`: `RECIPE_NOTE_MAX_LENGTH`.

### Krok 9. Testy (pkt 10) i weryfikacja (pkt 11)

### Krok 10. Dokumentacja (poza kodem API, wg DoD historyjki)

`docs/results/project-summary.md` aktualizuje osobny etap (`ps-summary-updater`) po zaakceptowaniu API/widoków: sekcja 1 „Granice", sekcje 0/4/5/6, backlog. Ten plan jej nie zmienia.

---

## 10. Testy (backend)

Testy **Deno** obok kodu (`deno.land/std` asserts, ręczne mocki klienta jak w `recipe-flags.test.ts` i `recipes.service.test.ts`).

### `supabase/functions/_shared/recipe-notes.test.ts` (nowy)

| Obszar | Przypadek |
|---|---|
| `normalizeRecipeNote` | `"  Mniej soli\r\n\r\nWięcej pieprzu  "` → `"Mniej soli\n\nWięcej pieprzu"` (sc. 8) |
| | `""`, `"   "`, `"\n\r\n"`, `null` → `null` (sc. 7); pojedynczy `\r` → `\n` |
| | `<script>alert(1)</script>`, `**b**`, `<b>x</b>` bez zmian (sc. 10) |
| `countRecipeNoteCharacters` | 2000 × `😀` → `2000` (a nie `4000`); 2001 znaków → `2001` (sc. 9) |
| `getMyRecipeNote` | gość (`null`) → `undefined`, **brak** wywołania `from` |
| | brak wiersza → `null`; wiersz → tekst |
| | błąd bazy → `undefined` + log; wyjątek → `undefined` |
| | zapytanie zawiera `eq('user_id', USER_ID)` i `eq('recipe_id', …)` |

### `supabase/functions/recipes/recipes.service.test.ts` (rozszerzenie)

| Przypadek |
|---|
| `setRecipeNote`: zapis → mapuje `{ recipe_id, note, updated_at }`; przekazuje `p_recipe_id`, `p_note` |
| `setRecipeNote`: `note: null` → `p_note` pominięte (`undefined`); wynik `note: null, updated_at: null` |
| `setRecipeNote`: `P0002` → `NOT_FOUND`; `22023` → `VALIDATION_ERROR`; `42501` → `UNAUTHORIZED`; inny błąd i pusty `data` → `INTERNAL_ERROR` |
| `getRecipeById` (obie ścieżki — RLS i `PUBLIC` przez service role): zalogowany → `my_note` (`string`/`null`); błąd odczytu notatki → klucz nieobecny, reszta odpowiedzi poprawna |

### Handler / router (`recipes.handlers.test.ts` — nowy plik, jeśli brak; w przeciwnym razie istniejący)

| Przypadek |
|---|
| `setRecipeNoteSchema`: brak `note`, `123`, `true`, `{}`, `[]`, nieznane pole (`user_id`), >2000 po trim → błąd; `null`, `""`, 2000 znaków, 2000 emoji → OK (sc. 21, 9) |
| Router: `PUT /recipes/1/note` → handler; `GET/POST/DELETE /recipes/1/note` → `405` z `Allow: PUT, OPTIONS` (nie lista, nie nowy przepis); `OPTIONS` → `204` |
| `PUT` bez JWT → `401`; `PUT /recipes/abc/note` → `400` |
| Logowanie: asercja, że wywołania `logger` nie zawierają treści notatki |

### `explore` i `public` (testy serwisów)

| Przypadek |
|---|
| `getExploreRecipeById`: zalogowany, przepis `PUBLIC` → `my_note` obecne; zalogowany autor przepisu `PRIVATE` → `my_note` obecne (gałąź 2); gość → klucz **nieobecny**; zapytanie ma `eq('user_id', requesterUserId)` |
| `getPublicRecipeById`: zalogowany → `my_note` (`string`/`null`); gość → klucz nieobecny, brak zapytania do `user_recipe_notes` |
| Cudzy `PRIVATE` → `NOT_FOUND` **przed** odczytem notatki (brak wywołania `getMyRecipeNote`) |

### RLS / RPC (test integracyjny na lokalnym Supabase, SQL jako dany użytkownik — skrypt `.sql`/`.http` lub test Deno z dwoma kontami)

| Obszar | Scenariusz |
|---|---|
| Prywatność (sc. 16) | A i B: `select` widzi tylko własne wiersze; `select` wiersza A jako B pusty; `update`/`delete` wiersza A jako B nie zmienia nic |
| Dostępność (sc. 2, 4) | B zapisuje do publicznego przepisu A → OK; A do własnego `PRIVATE` → OK; B do `PRIVATE`/`SHARED` A → `P0002` i brak wiersza; bezpośredni `insert` jako B do cudzego `PRIVATE` odrzucony przez RLS |
| Cykl życia (sc. 5, 7) | Edycja: `created_at` bez zmian, `updated_at` rośnie; ten sam tekst ponownie → `updated_at` bez zmian; `null` ×2 → oba OK |
| Niedostępność i powrót (sc. 19) | zmiana przepisu na `PRIVATE` → RPC `P0002`, wiersz zostaje; po powrocie `PUBLIC` → odczyt zwraca notatkę; soft-delete nie kasuje wiersza |
| Kaskada (sc. 20) | hard delete przepisu → kasuje notatki wszystkich użytkowników; usunięcie użytkownika → kasuje jego notatki |
| Bezpośredni PostgREST | `rpc/set_recipe_note` z `p_note` >2000 → `22023`; z `"  x  "` → zapis `"x"`; jako `anon` → brak uprawnień (`42501`/`permission denied`) |
| Brak wpływu na przepis (sc. 23) | `recipes.updated_at`, `search_vector`, `normalized_ingredients_status` bez zmian po zapisie/usunięciu notatki |
| Regresja | odpowiedzi list i widoku `recipe_details` bez zmian; `POST/PUT /recipes` poprawne i zwracają `my_note` |

### Mapowanie na scenariusze akceptacji

Sc. 1, 2, 3, 5, 6, 7, 8, 9, 10, 16, 17, 19, 20, 21, 22, 23 są pokryte testami backendowymi powyżej; sc. 11–15, 18 i 24 dotyczą UI (plan widoków i testy Vitest/Playwright); sc. 4 pokryte testem RPC i RLS.

---

## 11. Komendy weryfikacji

```powershell
# 1. Migracja na czystej bazie lokalnej
supabase db reset

# 2. Typy bazy (po migracji; oba pliki)
supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
supabase gen types typescript --local > shared/types/database.types.ts

# 3. Type-check i lint Edge Functions
deno check supabase/functions/recipes/index.ts supabase/functions/explore/index.ts supabase/functions/public/index.ts
deno lint supabase/functions/_shared/recipe-notes.ts supabase/functions/recipes supabase/functions/explore supabase/functions/public

# 4. Testy backendu (Deno)
deno test --allow-all --unstable supabase/functions/_shared supabase/functions/recipes supabase/functions/explore supabase/functions/public

# 5. Frontend (kontrakty współdzielone) — lint, build i testy bez regresji
npm run lint
npm run build
npm run test:run

# 6. Test ręczny endpointu (lokalnie: http://localhost:54331/functions/v1/recipes)
supabase functions serve recipes explore public
```

Test ręczny (`supabase/functions/recipes/test-requests*.http` lub osobny plik `.http`; dane logowania z lokalnego `.env.local`, bez sekretów w repo):

1. `PUT /recipes/{id}/note` z `{ "note": "  Mniej soli\r\n\r\nWięcej pieprzu  " }` → `200`, `note` przycięte; `GET /recipes/{id}` → `my_note` identyczne.
2. `{ "note": null }`, `""`, `"   "` → `200` z `note: null` (dwukrotnie — idempotencja).
3. `{}`, `{ "note": 5 }`, `{ "note": "x", "user_id": "…" }`, notatka 2001 znaków → `400`.
4. Bez JWT → `401`; `PUT` na cudzy `PRIVATE`/`SHARED` oraz nieistniejące `id` → `404`.
5. `GET/POST/DELETE /recipes/{id}/note` → `405`.
6. `GET /explore/recipes/{id}` i `GET /public/recipes/{id}`: z JWT → `my_note`, bez JWT → brak klucza; nagłówek `Cache-Control` zgodny z pkt 6.
7. Dwa konta: notatka A nie pojawia się w odpowiedziach B ani autora przepisu.

---

## 12. Checklist implementacji (API)

- [ ] Migracja `20261109120000_create_user_recipe_notes.sql` (tabela, indeks, trigger, RLS, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `_shared/recipe-notes.ts` (`getMyRecipeNote`, `normalizeRecipeNote`, `countRecipeNoteCharacters`, stała, typ odpowiedzi) + testy Deno
- [ ] `setRecipeNote` (serwis) + `handleSetRecipeNote` + `setRecipeNoteSchema` + `extractRecipeIdFromNotePath` + routing `PUT` i `405`
- [ ] `my_note` w `getRecipeById` (2 bloki), `getExploreRecipeById` (2 gałęzie), `getPublicRecipeById`
- [ ] `Cache-Control: no-store` dla `GET /recipes/{id}` i `PUT …/note` (rozszerzenie `createSuccessResponse`)
- [ ] `shared/contracts/types.ts`, nowy `shared/contracts/recipe-note.ts`, lokalne typy w trzech serwisach
- [ ] Komentarze nagłówkowe `recipes/index.ts` i `recipesRouter`
- [ ] Testy Deno (pkt 10), w tym test integracyjny RLS/RPC na dwóch kontach
- [ ] `deno check`, `deno test`, `npm run lint`, `npm run build`, `npm run test:run` bez błędów

---

## 13. Poza zakresem PS-31

| Element | Uwaga |
|---|---|
| Notatka w listach, wskaźnik na kafelkach, filtr „z notatką" | Osobna historyjka |
| Wyszukiwanie po treści notatki; udział w AI / planie / liście zakupów / wydruku / eksporcie | Poza zakresem (notatka prywatna) |
| Notatki do cudzych przepisów `SHARED` | Wymaga wcześniejszej zmiany RLS przepisów; predykat notatki trzeba wtedy rozszerzyć w tej samej historyjce |
| Usuwanie „osieroconych" notatek przy niedostępnym przepisie | `PUT` daje `404`; wiersz wraca razem z przepisem lub jest kasowany kaskadowo |
| Historia wersji, konflikty między kartami, współdzielenie notatek | Ostatni zapis wygrywa |
| Rate limiting dedykowany dla notatek | Operacja tania (jeden wiersz, ≤2000 znaków) |
| Limity i różnice między rolami | Brak |
