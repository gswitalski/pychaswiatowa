# API Endpoints Implementation Plan: PS-95 — Osobiste flagi przepisu „Ulubiony" i „Chcę wypróbować"

> **Historyjka:** PS-95 (`docs/results/new-features/user-stories/PS-95/PS-95-recipe-favorite-and-try-flags-user-story.md`)
> **Specyfikacja API:** `docs/results/new-features/user-stories/PS-95/PS-95-recipe-favorite-and-try-flags-api-plan.md`
> **Stan kodu zweryfikowany:** październik 2026 (ostatnia migracja `20261009211500_fix_recipe_soft_delete_rls.sql`)

---

## 1. Przegląd punktów końcowych

Zakres obejmuje **jeden nowy endpoint zapisu** oraz **rozszerzenie siedmiu istniejących endpointów odczytu**. Wszystko działa w istniejących Edge Functions — nie dochodzi nowa funkcja ani krok w `main-deploy.yml`.

| # | Endpoint | Funkcja Edge | Typ zmiany | Cel |
|---|---|---|---|---|
| A | `PUT /recipes/{id}/flags` | `recipes` | **Nowy** | Idempotentne, częściowe ustawienie/zdjęcie flag `is_favorite` / `is_want_to_try` |
| B1 | `GET /recipes/{id}` | `recipes` | Rozszerzenie | `is_favorite`, `is_want_to_try` w szczegółach |
| B2 | `GET /explore/recipes/{id}` | `explore` | Rozszerzenie | j.w. (to z niego korzysta widok `/explore/recipes/:id-:slug`) |
| B3 | `GET /public/recipes/{id}` | `public` | Rozszerzenie + poprawka cache | j.w. (tylko zalogowany) |
| B4 | `GET /recipes`, `GET /recipes/feed` | `recipes` | Rozszerzenie | `is_favorite` w elementach listy |
| B5 | `GET /public/recipes`, `GET /public/recipes/feed` | `public` | Rozszerzenie | `is_favorite` (tylko zalogowany) |
| B6 | `GET /collections/{id}` | `collections` | Rozszerzenie | `is_favorite` w przepisach kolekcji |

Dodatkowo:

- **Baza:** tabela `user_recipe_flags` (RLS) + RPC `set_recipe_flags` (migracja `20261010120000_create_user_recipe_flags.sql`).
- **Współdzielony moduł:** `supabase/functions/_shared/recipe-flags.ts` (jedno zapytanie zbiorcze o flagi dla listy ID).
- **Kontrakt:** `shared/contracts/types.ts` oraz lokalne typy w `collections.types.ts`, `public.types.ts`, `explore.service.ts`.

**Bez zmian:** `GET /collections/{id}/recipes` (Sidebar), `GET /plan`, `GET /shopping-list`, `GET /search/global`, tabela `recipes`, widok `recipe_details`, RPC `get_recipes_list`, `search_vector`, joby normalizacji. Endpoint `GET /dashboard/summary` nie istnieje w kodzie — ostatnie przepisy na dashboardzie pochodzą z `GET /recipes`.

### Ustalenia z weryfikacji kodu (korekty względem planu API)

| # | Ustalenie | Konsekwencja dla wdrożenia |
|---|---|---|
| 1 | `recipesRouter` dopasowuje `extractRecipeIdFromPath` wzorcem `/\/recipes\/([^/]+)$/`, więc `/recipes/123/flags` **nie** daje `recipeId`. Bez dedykowanej gałęzi: `GET /recipes/123/flags` zwróci **listę przepisów**, a `POST /recipes/123/flags` **utworzy nowy przepis** (`handleCreateRecipe`). | Gałąź `flagsRecipeId` musi być sprawdzana **przed** wszystkimi gałęziami metod i obsługiwać każdą metodę (nie tylko `PUT`). Obowiązkowy test routera. |
| 2 | `collections.service.ts` używa **własnego, węższego** `RecipeListItemDto` z `collections.types.ts` (bez `in_my_plan`, czasów, diety itd.). | `is_favorite` trzeba dodać w lokalnym typie i w mapowaniu `getCollectionById`, a nie tylko w `shared/contracts/types.ts`. |
| 3 | `public/index.ts` → `addCorsHeaders(response, true)` dopisuje `Cache-Control: public, max-age=60` do każdej odpowiedzi `200` bez własnego nagłówka. `handleGetPublicRecipeById` używa `createSuccessResponse` (bez nagłówka). | Bez poprawki odpowiedź zalogowanego z flagami byłaby cache'owana przez 60 s. Zmiana na `createCachedResponse(recipe, userId !== null)`. |
| 4 | `getRecipeIdsInPlan` jest skopiowana w `recipes`, `public` i `explore`. W `explore` przyjmuje `userId: string \| null`. | Dla flag nie tworzymy czwartej kopii — jeden moduł `_shared/recipe-flags.ts`. |
| 5 | Testy backendu w repo to **testy Deno** (`recipes.service.test.ts`, `deno.land/std` asserts, mock klienta), nie Vitest. Vitest dotyczy frontendu. CI nie uruchamia `deno test`. | Testy backendu piszemy w Deno, zgodnie z istniejącym wzorcem; uruchamiane lokalnie (`deno test`). |
| 6 | `DELETE` flagi nie jest osobnym endpointem; zdjęcie flagi to `PUT` z `false`. RPC sprawdza widoczność przepisu przed zapisem **także przy zdejmowaniu flagi**. | Zdjęcie flagi z przepisu, który stał się niedostępny, daje `404` (zgodnie ze scenariuszem 13). Polityka RLS `DELETE` bez warunku widoczności to tylko dodatkowa warstwa (np. dla przyszłych zadań porządkowych), nie ścieżka API. |

---

## 2. Szczegóły żądania

### A. `PUT /recipes/{id}/flags` (nowy)

- **Metoda HTTP:** `PUT`
- **Struktura URL:** `/functions/v1/recipes/{id}/flags`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), dowolna rola (`user`, `premium`, `admin`)
- **Parametry:**
    - Wymagane: `id` (path) — liczba całkowita > 0 (sam numer, bez sluga, jak w pozostałych endpointach `recipes`)
    - Opcjonalne: brak
- **Request Body** (`Content-Type: application/json`):

```json
{
    "is_favorite": true,
    "is_want_to_try": false
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `is_favorite` | `boolean` | nie* | Stan flagi „Ulubiony". Pominięte = bez zmiany |
| `is_want_to_try` | `boolean` | nie* | Stan flagi „Chcę wypróbować". Pominięte = bez zmiany |

\* Co najmniej jedno z pól jest wymagane.

**Walidacja (Zod, `.strict()`):**

- co najmniej jedno pole podane,
- nieznane pola → błąd (m.in. `user_id`, `recipe_id`),
- wartość inna niż `boolean` (w tym `null`, `"true"`, `1`) → błąd,
- niepoprawny JSON → błąd,
- niepoprawne `id` (nie-liczba, `0`, ujemne, ułamek) → błąd (`parseAndValidateRecipeId`).

```typescript
const setRecipeFlagsSchema = z
    .object({
        is_favorite: z.boolean({ invalid_type_error: 'is_favorite must be a boolean' }).optional(),
        is_want_to_try: z.boolean({ invalid_type_error: 'is_want_to_try must be a boolean' }).optional(),
    })
    .strict()
    .refine(
        (body) => body.is_favorite !== undefined || body.is_want_to_try !== undefined,
        { message: 'At least one of is_favorite, is_want_to_try is required' }
    );
```

### B. Rozszerzone endpointy odczytu

Żadnych nowych parametrów, nagłówków ani zmian w ciele żądań. Zmiana dotyczy wyłącznie odpowiedzi. Tożsamość użytkownika pochodzi **wyłącznie** ze zweryfikowanego JWT (`getAuthenticatedContext` / `getOptionalAuthenticatedUser`).

---

## 3. Wykorzystywane typy

### Nowe — `shared/contracts/types.ts`

```typescript
/** Stan osobistych flag zalogowanego użytkownika dla przepisu (odpowiedź PUT /recipes/{id}/flags). */
export interface RecipeFlagsDto {
    recipe_id: number;
    is_favorite: boolean;
    is_want_to_try: boolean;
}

/** Command model dla PUT /recipes/{id}/flags — co najmniej jedno pole. */
export interface UpdateRecipeFlagsCommand {
    is_favorite?: boolean;
    is_want_to_try?: boolean;
}
```

### Rozszerzenia istniejących DTO (pola **opcjonalne**)

Pola są opcjonalne, aby odpowiedzi dla gościa pozostały bez zmian (klucz nie występuje w JSON) i nie psuły się istniejące testy.

| DTO | Lokalizacje do zmiany | Nowe pola |
|---|---|---|
| `RecipeDetailDto` | `shared/contracts/types.ts`; lokalny typ w `explore.service.ts` (import/alias) | `is_favorite?: boolean`, `is_want_to_try?: boolean` |
| `PublicRecipeDetailDto` | `shared/contracts/types.ts`; `public.types.ts` | `is_favorite?: boolean`, `is_want_to_try?: boolean` |
| `RecipeListItemDto` | `shared/contracts/types.ts`; **`collections.types.ts` (lokalny, węższy typ)** | `is_favorite?: boolean` |
| `PublicRecipeListItemDto` | `shared/contracts/types.ts`; `public.types.ts` | `is_favorite?: boolean` |

W listach **nie** dodajemy `is_want_to_try` (kafelek pokazuje wyłącznie serduszko).

### Typy bazy

Po migracji ponownie wygenerować typy (tabela `user_recipe_flags` + RPC `set_recipe_flags`):

- `supabase/functions/_shared/database.types.ts`
- `shared/types/database.types.ts`

### Typy wewnętrzne backendu

```typescript
// supabase/functions/_shared/recipe-flags.ts
export interface RecipeFlagsState {
    is_favorite: boolean;
    is_want_to_try: boolean;
}

// recipes.service.ts
export interface SetRecipeFlagsInput {
    recipeId: number;
    isFavorite?: boolean;
    isWantToTry?: boolean;
}
```

`ErrorCode` w `_shared/errors.ts` **nie wymaga zmian** — używamy istniejących: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `INTERNAL_ERROR` (500).

---

## 4. Szczegóły odpowiedzi

### A. `PUT /recipes/{id}/flags`

**`200 OK`** — zawsze pełny stan obu flag (także tej, której żądanie nie dotyczyło); frontend traktuje go jako źródło prawdy po zapisie.

```json
{
    "recipe_id": 123,
    "is_favorite": true,
    "is_want_to_try": false
}
```

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200` | — | Flagi zapisane lub stan już zgodny (idempotencja) |
| `400` | `VALIDATION_ERROR` | Niepoprawne `id`, niepoprawny JSON, puste ciało, nieznane pole, wartość nie-boolean |
| `401` | `UNAUTHORIZED` | Brak lub nieprawidłowy JWT |
| `404` | `NOT_FOUND` | Przepis nie istnieje, jest soft-deleted albo niewidoczny (cudzy `PRIVATE`/`SHARED`) |
| `405` | `METHOD_NOT_ALLOWED` | Metoda inna niż `PUT` na `/recipes/{id}/flags` (`Allow: PUT, OPTIONS`) |
| `500` | `INTERNAL_ERROR` | Błąd bazy danych |

Odpowiedź mutacji — bez nagłówków cache (spójnie z `PUT /recipes/{id}/collections`). Format błędu: `{ "code": "...", "message": "..." }` (istniejące `handleError`).

> `GET /recipes/{id}` zwraca `403` dla cudzego przepisu niepublicznego; dla flag świadomie zwracamy `404` (jak `/explore/recipes/{id}`), aby nie ujawniać istnienia przepisu.

### B. Rozszerzone odpowiedzi odczytu

Statusy i kody błędów istniejących endpointów **bez zmian**.

| Endpoint | Zalogowany | Gość |
|---|---|---|
| `GET /recipes/{id}` | `is_favorite`, `is_want_to_try` (zawsze obecne, `false` gdy brak wiersza) | n/d (wymaga JWT) |
| `GET /explore/recipes/{id}` | j.w. | **klucze nieobecne** |
| `GET /public/recipes/{id}` | j.w. | **klucze nieobecne** |
| `GET /recipes`, `/recipes/feed` | `is_favorite` w każdym elemencie | n/d |
| `GET /public/recipes`, `/public/recipes/feed` | `is_favorite` w każdym elemencie | **klucz nieobecny** |
| `GET /collections/{id}` | `is_favorite` w każdym przepisie | n/d |

Dla gościa pola są pomijane (wartość `undefined` nie trafia do `JSON.stringify`), więc odpowiedzi anonimowe pozostają bez zmian (scenariusz 9).

**Nagłówki cache:**

| Endpoint | Gość | Zalogowany |
|---|---|---|
| `GET /public/recipes/{id}` | `public, max-age=60` | `no-store` (**po poprawce**, patrz pkt 8) |
| `GET /public/recipes`, `/feed` | `public, max-age=60` | `no-store` (już działa przez `createCachedResponse`) |
| `GET /explore/recipes/{id}` | `public, max-age=60` (tylko `PUBLIC`) | `no-store` (już działa) |

---

## 5. Przepływ danych

### A. `PUT /recipes/{id}/flags`

```
Klient (Angular)
  → PUT /functions/v1/recipes/{id}/flags  { is_favorite?, is_want_to_try? }
recipes/index.ts            → CORS, deleguje do recipesRouter
recipesRouter               → extractRecipeIdFromFlagsPath → handleSetRecipeFlags
handleSetRecipeFlags
  1. parseAndValidateRecipeId(id)                      → 400
  2. getAuthenticatedContext(req) (client + user)      → 401
  3. req.json() + setRecipeFlagsSchema.safeParse       → 400
  4. setRecipeFlags(client, { recipeId, isFavorite, isWantToTry })
setRecipeFlags (recipes.service.ts)
  → client.rpc('set_recipe_flags', { p_recipe_id, p_is_favorite, p_is_want_to_try })
      P0002 → NOT_FOUND (404)
      22023 → VALIDATION_ERROR (400)
      42501 → UNAUTHORIZED (401)
      inny / brak danych → INTERNAL_ERROR (500)
  → RecipeFlagsDto
handleSetRecipeFlags        → logger.info + 200 JSON
```

Wewnątrz RPC `set_recipe_flags` (`security invoker`, działa w kontekście JWT, RLS aktywne):

1. `auth.uid()` null → `42501`.
2. Oba parametry `null` → `22023`.
3. Przepis musi istnieć, `deleted_at is null` i (`user_id = auth.uid()` lub `visibility = 'PUBLIC'`), w przeciwnym razie `P0002`.
4. Odczyt bieżącego wiersza flag z `FOR UPDATE` (serializacja równoległych żądań na tej samej parze).
5. Aktualizacja częściowa: `coalesce(p_*, bieżąca_wartość)`.
6. Obie flagi `false` → `DELETE` wiersza; w przeciwnym razie `INSERT … ON CONFLICT (user_id, recipe_id) DO UPDATE`.
7. Zwrot pełnego stanu obu flag.

Zapis **nie dotyka** tabeli `recipes` → `recipes.updated_at`, `search_vector`, `normalized_ingredients_status` i joby normalizacji pozostają bez zmian (scenariusz 17).

### B. Odczyt flag w endpointach GET

```
serwis (getRecipes / getRecipesFeed / getRecipeById / getPublicRecipes* / getPublicRecipeById /
        getExploreRecipeById / getCollectionById)
  → [równolegle z istniejącymi zapytaniami o plan / kolekcje]
  → getRecipeFlagsMap(client, recipeIds, userId)       // 1 zapytanie na całą listę
        userId === null lub pusta lista → pusta mapa, bez zapytania
        błąd bazy → log + pusta mapa (nieblokujące, jak getRecipeIdsInPlan)
  → mapowanie DTO: is_favorite = flagsMap.get(id)?.is_favorite ?? false
        (dla public/explore: tylko gdy userId !== null)
```

**Wybór klienta:**

| Funkcja | Klient | Uwaga |
|---|---|---|
| `recipes`, `collections` | uwierzytelniony (JWT użytkownika) | RLS zawęża do własnych wierszy; jawny `.eq('user_id', userId)` jako druga warstwa |
| `public`, `explore` | service role | RLS pominięty — `.eq('user_id', userId)` **obowiązkowy**; `userId` wyłącznie z `getOptionalAuthenticatedUser(req)` |

---

## 6. Względy bezpieczeństwa

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt / zmiana flag innego użytkownika | RLS (`auth.uid() = user_id`) na `SELECT/INSERT/UPDATE/DELETE`; RPC `security invoker`; w funkcjach z service role obowiązkowy filtr `.eq('user_id', userId)` |
| Podanie `user_id` / `recipe_id` w ciele | Brak takich pól w schemacie; `.strict()` odrzuca nieznane klucze; tożsamość tylko z JWT, `recipe_id` tylko ze ścieżki |
| Zapis flagi na niewidocznym przepisie (cudzy `PRIVATE`/`SHARED`, soft-deleted) | Jawny `exists` w RPC + `WITH CHECK` w polityce `INSERT`/`UPDATE`; wynik `404` |
| Ujawnienie istnienia przepisu | `404` zamiast `403` dla `PUT …/flags` |
| Wyciek flag przez cache współdzielony | Odpowiedzi z JWT mają `no-store`; gość nigdy nie dostaje pól; poprawka `Cache-Control` w `handleGetPublicRecipeById`; `Vary: Authorization` już dodawane przez wrapper |
| Przypadkowe wykonanie innej akcji na ścieżce `/flags` | Dedykowana gałąź routera z `405` dla każdej metody ≠ `PUT` (zapobiega `GET` → lista i `POST` → utworzenie przepisu) |
| Wstrzyknięcie SQL / manipulacja typami | Parametry RPC typowane (`bigint`, `boolean`); walidacja Zod; brak interpolacji SQL |
| Wyścigi przy równoległych zapisach | `FOR UPDATE` + `ON CONFLICT`; UI blokuje podwójne kliknięcie tej samej ikonki |
| Nadużycie (spam żądań) | Operacja tania (jeden wiersz); brak dodatkowego rate limitu w zakresie PS-95 |
| Wpływ na przepis / indeksy | Brak zapisu do `recipes` |
| Uprawnienia anon | `revoke all on table user_recipe_flags from anon`; `revoke … on function … from public`, `grant execute … to authenticated` |
| Logowanie danych wrażliwych | Logi zawierają tylko `userId`, `recipeId`, kody błędów — bez treści przepisów |

Polityki RLS (tabela `user_recipe_flags`): `SELECT`/`DELETE` — `auth.uid() = user_id`; `INSERT`/`UPDATE` — `auth.uid() = user_id` oraz przepis widoczny (własny lub `PUBLIC`, `deleted_at is null`). Pełne SQL w migracji (pkt 9, krok 1).

---

## 7. Obsługa błędów

### A. `PUT /recipes/{id}/flags`

| Scenariusz | Wykrycie | Kod HTTP / `code` | Test |
|---|---|---|---|
| Niepoprawne `id` (`abc`, `0`, `-1`, `1.5`) | `parseAndValidateRecipeId` | `400 VALIDATION_ERROR` | tak |
| Niepoprawny JSON | `try/catch` na `req.json()` | `400 VALIDATION_ERROR` | tak |
| Puste ciało `{}` | `.refine` | `400 VALIDATION_ERROR` | tak (sc. 15) |
| Nieznane pole (`user_id`, `foo`) | `.strict()` | `400 VALIDATION_ERROR` | tak (sc. 15) |
| Wartość nie-boolean (`null`, `"true"`, `1`) | `z.boolean()` | `400 VALIDATION_ERROR` | tak (sc. 15) |
| Brak / nieprawidłowy JWT | `getAuthenticatedContext` | `401 UNAUTHORIZED` | tak (sc. 12) |
| Przepis nie istnieje / soft-deleted | RPC `P0002` | `404 NOT_FOUND` | tak (sc. 13) |
| Cudzy `PRIVATE` / `SHARED` | RPC `P0002` | `404 NOT_FOUND` | tak (sc. 8, 13) |
| RPC: brak sesji w bazie | `42501` | `401 UNAUTHORIZED` | tak |
| RPC: oba parametry `null` (obrona w głąb) | `22023` | `400 VALIDATION_ERROR` | tak |
| `GET` / `POST` / `DELETE` na `/recipes/{id}/flags` | router | `405 METHOD_NOT_ALLOWED` + `Allow: PUT, OPTIONS` | tak |
| Inny błąd RPC lub pusty wynik | `error` / `data.length === 0` | `500 INTERNAL_ERROR` + `logger.error` | tak |

Kolejność w handlerze: walidacja `id` → uwierzytelnienie → parsowanie i walidacja ciała → serwis (guard clauses, szczęśliwa ścieżka na końcu). Wyjątki przechwytuje istniejące `handleError`.

### B. Endpointy odczytu

Błąd pobrania flag **nie blokuje odpowiedzi**: `getRecipeFlagsMap` loguje `logger.error` i zwraca pustą mapę (flagi wyświetlą się jako `false`). To samo podejście stosuje `getRecipeIdsInPlan`. Zachowanie kodów błędów istniejących endpointów bez zmian.

### Rejestrowanie błędów

Projekt nie ma tabeli błędów w bazie dla endpointów `recipes` — błędy są rejestrowane przez `logger` (`_shared/logger.ts`): `logger.warn` dla błędów walidacji, `logger.error` dla błędów bazy. Zgodnie z regułami: każdy handler loguje operację na poziomie `info` (`userId`, `recipeId`).

---

## 8. Wydajność

| Aspekt | Rozwiązanie |
|---|---|
| N+1 w listach | Jedno zapytanie zbiorcze `getRecipeFlagsMap` (`.in('recipe_id', ids)`) na listę (max 100 pozycji), wykonywane **równolegle** z `getRecipeIdsInPlan` (`Promise.all`) |
| Szczegóły przepisu | Zapytania o plan, kolekcje i flagi mogą być wykonane równolegle (`Promise.all`) — flagi nie zwiększają liczby sekwencyjnych rund do bazy |
| Indeksy | PK `(user_id, recipe_id)` obsługuje zapytania listowe; `idx_user_recipe_flags_recipe_id` obsługuje `ON DELETE CASCADE` z `recipes`; indeks częściowy `(user_id, recipe_id) where is_favorite` przygotowany pod przyszłe filtrowanie (osobna historyjka) |
| Rozmiar tabeli | Wiersz istnieje tylko, gdy ustawiona jest co najmniej jedna flaga (`CHECK` + `DELETE` w RPC) — brak wierszy `(false, false)` |
| Zapis | Jedno wywołanie RPC = jedna transakcja; brak dodatkowych zapytań z Edge Function |
| Cache | Odpowiedzi zalogowanych `no-store`; cache publiczny (`max-age=60`) zachowany tylko dla gościa, więc nie spada skuteczność cache'owania anonimowego ruchu |
| Rozmiar odpowiedzi | `+1` pole boolean w elemencie listy; `+2` w szczegółach — pomijalne |
| `FOR UPDATE` | Blokada pojedynczego wiersza flag na czas transakcji RPC; brak rywalizacji o wiersz przepisu |

---

## 9. Etapy wdrożenia

### Krok 1. Migracja bazy danych

Plik: `supabase/migrations/20261010120000_create_user_recipe_flags.sql` (znacznik czasu **większy** niż ostatnia migracja `20261009211500`, inaczej `supabase db push` odrzuci ją jako „out of order").

Zawartość:

- tabela `public.user_recipe_flags` (`user_id` FK → `auth.users` `ON DELETE CASCADE`, `recipe_id` FK → `public.recipes` `ON DELETE CASCADE`, `is_favorite`, `is_want_to_try`, `created_at`, `updated_at`; PK `(user_id, recipe_id)`; `CHECK (is_favorite or is_want_to_try)`),
- indeksy `idx_user_recipe_flags_recipe_id` oraz częściowy `idx_user_recipe_flags_user_favorite`,
- trigger `set_user_recipe_flags_updated_at` → `public.handle_updated_at()` (funkcja istnieje w migracjach, np. `20251125120000_create_profiles_table.sql`),
- `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL … FROM anon`, cztery polityki (`SELECT`/`DELETE`: `auth.uid() = user_id`; `INSERT`/`UPDATE`: dodatkowo `exists` widocznego przepisu),
- RPC `public.set_recipe_flags(p_recipe_id bigint, p_is_favorite boolean default null, p_is_want_to_try boolean default null)`:
    - `returns table (out_recipe_id bigint, out_is_favorite boolean, out_is_want_to_try boolean)` (prefiks `out_` — unikanie niejednoznaczności z kolumnami, jak w migracji `20260804210000_fix_admin_update_user_role_ambiguous_columns`),
    - `language plpgsql`, `security invoker`, `set search_path = ''`, w ciele kwalifikowane nazwy `public.*`,
    - kody wyjątków: `42501` (brak sesji), `22023` (brak flag), `P0002` (przepis niedostępny),
    - `revoke all … from public; grant execute … to authenticated;`,
- komentarze `COMMENT ON TABLE/COLUMN/FUNCTION`.

Pełna treść SQL: `PS-95-recipe-favorite-and-try-flags-api-plan.md`, sekcja 2.

**Weryfikacja lokalna:** `supabase db reset` (lub `supabase migration up`), następnie sprawdzić RPC dla: nowej flagi, zdjęcia jednej z dwóch flag, zdjęcia obu (wiersz usunięty), cudzego `PRIVATE` (`P0002`), obu parametrów `null` (`22023`).

### Krok 2. Regeneracja typów bazy

```bash
supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
# oraz ten sam wynik do shared/types/database.types.ts
```

Po wygenerowaniu sprawdzić, czy diff dotyczy wyłącznie tabeli `user_recipe_flags` i funkcji `set_recipe_flags` (generator nie powinien zmieniać innych typów).

### Krok 3. Kontrakt typów

- `shared/contracts/types.ts`: dodać `RecipeFlagsDto`, `UpdateRecipeFlagsCommand`; rozszerzyć `RecipeListItemDto`, `PublicRecipeListItemDto`, `RecipeDetailDto`, `PublicRecipeDetailDto` o opcjonalne pola (pkt 3).
- `supabase/functions/collections/collections.types.ts`: dodać `is_favorite?: boolean` do lokalnego `RecipeListItemDto`.
- `supabase/functions/public/public.types.ts` i `explore/explore.service.ts` (typy lokalne): dodać pola analogicznie.

### Krok 4. Moduł współdzielony `_shared/recipe-flags.ts`

- Eksport `RecipeFlagsState` i `getRecipeFlagsMap(client, recipeIds, userId)`.
- Guard clauses na początku: `userId === null` lub `recipeIds.length === 0` → pusta mapa bez zapytania.
- Zapytanie: `from('user_recipe_flags').select('recipe_id, is_favorite, is_want_to_try').eq('user_id', userId).in('recipe_id', recipeIds)`.
- Błąd bazy → `logger.error` (`errorCode`, `userId`) + pusta mapa (nieblokujące).
- Test Deno: `recipe-flags.test.ts` (patrz Krok 11).

### Krok 5. Serwis zapisu — `recipes.service.ts`

- Dodać `setRecipeFlags(client, input: SetRecipeFlagsInput): Promise<RecipeFlagsDto>`.
- Wywołanie `client.rpc('set_recipe_flags', { p_recipe_id, p_is_favorite: input.isFavorite ?? undefined, p_is_want_to_try: input.isWantToTry ?? undefined })` (pominięte wartości nie trafiają do JSON → domyślne `null` w SQL).
- Mapowanie błędów (guard clauses): `P0002` → `NOT_FOUND`, `22023` → `VALIDATION_ERROR`, `42501` → `UNAUTHORIZED`, inny błąd lub `data.length === 0` → `logger.error` + `INTERNAL_ERROR`.
- Zwrot: `{ recipe_id: Number(row.out_recipe_id), is_favorite: row.out_is_favorite, is_want_to_try: row.out_is_want_to_try }`.

### Krok 6. Handler i routing — `recipes.handlers.ts`

1. Dodać `setRecipeFlagsSchema` (obok `setRecipeCollectionsSchema`, ok. linii 406).
2. Dodać `handleSetRecipeFlags(req, recipeIdParam)` wzorowany na `handleSetRecipeCollections` (ok. linii 1124): `parseAndValidateRecipeId` → `getAuthenticatedContext` → `req.json()` → `safeParse` → `setRecipeFlags` → `createSuccessResponse(result)` (200) → `handleError` w `catch`.
3. Dodać `extractRecipeIdFromFlagsPath(url)` z wzorcem `/\/recipes\/([^/]+)\/flags\/?$/` (analogicznie do `extractRecipeIdFromCollectionsPath`, ok. linii 1357).
4. W `recipesRouter` (ok. linii 1687) wyliczyć `flagsRecipeId` obok pozostałych `extract*` i **obsłużyć go natychmiast po `OPTIONS`, przed blokami `GET`/`POST`/`PUT`/`DELETE`**:

```typescript
if (flagsRecipeId) {
    if (method === 'PUT') {
        return handleSetRecipeFlags(req, flagsRecipeId);
    }
    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /recipes/{id}/flags. Use PUT.`,
        }),
        { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'PUT, OPTIONS' } }
    );
}
```

Dzięki temu `GET` nie spada do `handleGetRecipes`, a `POST` nie dociera do `handleCreateRecipe`. CORS (`GET, POST, PUT, DELETE, OPTIONS`) w `index.ts` i preflight routera już obejmuje `PUT` — bez zmian.

5. Uzupełnić komentarze: lista „Supports” w `recipesRouter` oraz komentarz nagłówkowy `recipes/index.ts` o `PUT /functions/v1/recipes/{id}/flags`.

### Krok 7. Odczyt flag — `recipes` (B1, B4)

W `recipes.service.ts`:

- `getRecipes` (ok. linii 535) i `getRecipesFeed` (ok. linii 760): zastąpić pojedyncze `await getRecipeIdsInPlan(...)` przez

```typescript
const recipeIds = data.map((recipe) => Number(recipe.id));
const [recipeIdsInPlan, flagsMap] = await Promise.all([
    getRecipeIdsInPlan(client, recipeIds, requesterUserId),
    getRecipeFlagsMap(client, recipeIds, requesterUserId),
]);
```

  i dodać w mapowaniu `is_favorite: flagsMap.get(Number(recipe.id))?.is_favorite ?? false`.
- `getRecipeById` (ok. linii 880), **obie ścieżki** (Step A — RLS, Step B — `PUBLIC` przez service role): pobrać `flagsMap` (klient użytkownika, `[id]`) równolegle z planem i kolekcjami; przekazać `RecipeFlagsState` do `mapToRecipeDetailDto(data, inMyPlan, collectionIds, flags)`, które dodaje `is_favorite` i `is_want_to_try` (zawsze obecne dla zalogowanego, `false` gdy brak wiersza).

### Krok 8. Odczyt flag — `public` i `explore` (B2, B3, B5)

`public.service.ts` (klient service role, flagi tylko dla `userId !== null`):

- `buildRecipeListResponse` (ok. linii 886, obsługuje `getPublicRecipes`) i `getPublicRecipesFeed` (ok. linii 1438): w bloku `if (userId !== null)` dodać `getRecipeFlagsMap(client, recipeIds, userId)`; w mapowaniu DTO dodać warunkowo:

```typescript
...(userId !== null && {
    is_favorite: flagsMap.get(recipe.id)?.is_favorite ?? false,
}),
```

- `getPublicRecipeById` (ok. linii 962): w bloku `userId !== null` pobrać flagi dla `[params.id]` i dodać warunkowo `is_favorite` oraz `is_want_to_try` do `recipeDto`.

`public.handlers.ts` — **poprawka cache** w `handleGetPublicRecipeById` (ok. linii 388): zastąpić `createSuccessResponse(recipe)` przez `createCachedResponse(recipe, userId !== null)` (gość: `public, max-age=60`; zalogowany: `no-store`).

`explore.service.ts`:

- `getExploreRecipeById` (ok. linii 223): w **obu** ścieżkach zwrotu (`PUBLIC` i autor niepublicznego przepisu) pobrać flagi (`getRecipeFlagsMap(client, [recipeId], requesterUserId)` — dla `null` zwraca pustą mapę) i przekazać `RecipeFlagsState | null` do `mapToDto` (`null` dla gościa → pola nieobecne).
- `mapToDto` (ok. linii 344): dodać argument `flags` i warunkowo `is_favorite` / `is_want_to_try`.
- Handler `handleGetExploreRecipeById` już ustawia `no-store` dla zalogowanego — bez zmian.

### Krok 9. Odczyt flag — `collections` (B6)

`collections.service.ts`, `getCollectionById` (ok. linii 93):

- Po pobraniu `recipeData` zebrać `recipeIds` i wywołać `getRecipeFlagsMap(client, recipeIds, userId)` (klient uwierzytelniony; `userId` jest już argumentem funkcji).
- W mapowaniu `RecipeListItemDto` dodać `is_favorite: flagsMap.get(recipe.id)?.is_favorite ?? false`.
- Kolekcja może zawierać cudze przepisy `PUBLIC` — flagi są per użytkownik, więc dotyczą też ich.
- `getCollectionRecipes` (Sidebar) **bez zmian**.

### Krok 10. Weryfikacja ręczna (lokalnie)

`supabase functions serve` i testy HTTP (`test-requests.http` w katalogach funkcji) na `http://localhost:54331/functions/v1/…` z JWT użytkownika testowego:

1. `PUT /recipes/{id}/flags` `{ "is_favorite": true }` → `200`, `is_want_to_try` bez zmiany.
2. `{ "is_want_to_try": true }` → obie `true`; `{ "is_favorite": false }` → `is_want_to_try` nadal `true`.
3. Obie `false` → `200 false/false`, wiersz usunięty w bazie; powtórzenie → ten sam wynik.
4. `{}`, `{ "foo": true }`, `{ "is_favorite": null }`, `{ "is_favorite": "true" }`, niepoprawny JSON → `400`.
5. Brak `Authorization` → `401`.
6. Cudzy `PRIVATE`/`SHARED`, soft-deleted, nieistniejące ID → `404`.
7. `GET`/`POST`/`DELETE` na `/recipes/{id}/flags` → `405` (w szczególności: `POST` **nie** tworzy przepisu, `GET` **nie** zwraca listy).
8. Odczyt: `GET /recipes`, `/recipes/feed`, `/recipes/{id}`, `/public/recipes`, `/public/recipes/feed`, `/public/recipes/{id}`, `/explore/recipes/{id}`, `/collections/{id}` — jako zalogowany pola obecne i zgodne ze stanem; jako gość (bez nagłówka) — kluczy `is_favorite` / `is_want_to_try` brak.
9. Nagłówki: `GET /public/recipes/{id}` zalogowany → `Cache-Control: no-store`; gość → `public, max-age=60`.
10. Prywatność: użytkownik B nie widzi flag użytkownika A na tym samym publicznym przepisie.
11. `recipes.updated_at` i `normalized_ingredients_status` bez zmian po `PUT …/flags`.

### Krok 11. Testy automatyczne backendu (Deno, wzorzec `recipes.service.test.ts`)

| Plik | Przypadki |
|---|---|
| `recipes/recipes.handlers.flags.test.ts` (lub w istniejącym teście handlerów) | Schemat: puste ciało, nieznane pole, `null`, `"true"`, `1` → błąd; poprawne warianty → OK (sc. 15). Router: `PUT` → handler; `GET`/`POST`/`DELETE` na `/flags` → `405` z `Allow: PUT, OPTIONS` (nie lista, nie tworzenie) |
| `recipes/recipes.service.test.ts` | `setRecipeFlags`: parametry RPC (pominięte pole = `undefined`); mapowanie wyniku `out_*` → `RecipeFlagsDto`; `P0002` → `NOT_FOUND`, `22023` → `VALIDATION_ERROR`, `42501` → `UNAUTHORIZED`, inny błąd / pusty wynik → `INTERNAL_ERROR` (sc. 12, 13). Listy i szczegóły: zalogowany → `is_favorite` obecne |
| `_shared/recipe-flags.test.ts` | Gość / pusta lista → pusta mapa, brak zapytania; poprawne mapowanie wierszy; błąd bazy → pusta mapa + log; filtr `user_id` zawsze ustawiony |
| `public/public.service.test.ts` / `explore` | Zalogowany: pola obecne; gość: `'is_favorite' in dto === false` (sc. 9) |
| `public/public.handlers.test.ts` | `handleGetPublicRecipeById`: zalogowany → `Cache-Control: no-store`, gość → `public, max-age=60` |
| `collections/collections.service.test.ts` | `getCollectionById` zwraca `is_favorite` dla przepisów w kolekcji (w tym cudzego `PUBLIC`) |
| Test integracyjny RLS (lokalny Supabase, osobny skrypt/opis w `docs/testing/`) | B nie odczyta ani nie zmieni flag A (sc. 8); zapis na cudzym `PRIVATE`/`SHARED` → `404`; usunięcie przepisu kasuje flagi (CASCADE); powrót przepisu do `PUBLIC` przywraca flagi (sc. 14); `recipes.updated_at` bez zmian (sc. 17) |

### Krok 12. Dokumentacja

- `docs/results/project-summary.md`: sekcja 4 (tabela `user_recipe_flags`, relacja `auth.users 1:N`), sekcja 5 (`PUT /recipes/{id}/flags` oraz pola flag w odpowiedziach odczytu), sekcja „Stan realizacji” (PS-95 — warstwa API), data aktualizacji.
- Komentarze nagłówkowe: `recipes/index.ts`, router w `recipes.handlers.ts`.
- Wpis w `test-requests.http` dla nowego endpointu (opcjonalnie).

### Krok 13. Wdrożenie

Przepływ w istniejącym `.github/workflows/main-deploy.yml` (`supabase db push` poprzedza `supabase functions deploy …`, co zapewnia właściwą kolejność: **migracja przed funkcjami**). Funkcje do ponownego wdrożenia: `recipes`, `public`, `explore`, `collections` — wszystkie już są w workflow; nowych kroków nie dodajemy.

Kolejność wdrożenia względem frontendu: backend (migracja + funkcje) **przed** widokami. Pola flag są opcjonalne, więc starszy frontend działa bez zmian; nowy frontend na starym backendzie nie dostaje pól, a `PUT …/flags` zwróciłby `404`/`405`.

**Rollback:** funkcje wracają do poprzedniej wersji bez wpływu na dane; tabela `user_recipe_flags` może pozostać (nie jest używana przez starsze wersje). Usunięcie tabeli i RPC wymaga osobnej migracji `down`.

### Checklista

- [ ] Migracja `20261010120000_create_user_recipe_flags.sql` (tabela, indeksy, trigger, RLS, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `shared/contracts/types.ts` + lokalne typy (`collections.types.ts`, `public.types.ts`, `explore.service.ts`)
- [ ] `_shared/recipe-flags.ts` + testy
- [ ] `setRecipeFlags` (serwis), `handleSetRecipeFlags`, schemat Zod, routing `PUT` + `405` dla pozostałych metod (przed gałęziami metod)
- [ ] `is_favorite` / `is_want_to_try` w `getRecipeById` (obie ścieżki), `getExploreRecipeById` (obie ścieżki), `getPublicRecipeById`
- [ ] `is_favorite` w `getRecipes`, `getRecipesFeed`, `getPublicRecipes`, `getPublicRecipesFeed`, `getCollectionById`
- [ ] Poprawka `Cache-Control` w `handleGetPublicRecipeById`
- [ ] Komentarze nagłówkowe `recipes/index.ts` i routera
- [ ] Testy Deno + weryfikacja ręczna (pkt 10, 11)
- [ ] Aktualizacja `docs/results/project-summary.md`
- [ ] Code review

### Poza zakresem PS-95

| Element | Uwaga |
|---|---|
| Filtrowanie i wyszukiwanie po flagach (`filter[favorite]`, widok „Ulubione”) | Osobna historyjka (indeks częściowy już przygotowany) |
| `is_want_to_try` w listach i na kafelkach | Osobna historyjka |
| Zmiana flag z poziomu kafelka lub listy | Poza zakresem |
| Liczniki „ile osób polubiło”, powiadomienia dla autora | Poza zakresem (flagi są prywatne) |
| Limity flag, różnice między rolami | Brak limitów |
| Rate limiting dla `PUT …/flags` | Poza zakresem (operacja tania) |
