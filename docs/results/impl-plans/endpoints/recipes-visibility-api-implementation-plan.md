# API Endpoints Implementation Plan: Recipes (pole `visibility`)

## 1. Przegląd punktu końcowego

Celem jest wdrożenie pola `visibility` (Enum: `PRIVATE`, `SHARED`, `PUBLIC`) w zasobie **Recipe** oraz zapewnienie spójności w istniejących endpointach funkcji Supabase Edge `recipes`:

- `GET /functions/v1/recipes`
- `GET /functions/v1/recipes/{id}`
- `POST /functions/v1/recipes`
- `PUT /functions/v1/recipes/{id}`
- `POST /functions/v1/recipes/import`
- `DELETE /functions/v1/recipes/{id}` (soft delete)

Implementacja musi być spójna z:
- bazą danych PostgreSQL (Supabase) oraz RLS,
- istniejącym widokiem `public.recipe_details`,
- istniejącymi funkcjami RPC `public.create_recipe_with_tags` i `public.update_recipe_with_tags`,
- walidacją wejścia w handlerach (Zod),
- zasadami modularnej architektury Edge Functions (`index.ts` tylko routing + obsługa błędów).

## 2. Szczegóły żądania

### Wspólne wymagania
- **Nagłówki**:
  - `Authorization: Bearer <JWT>` (wymagane)
  - `Content-Type: application/json` (dla POST/PUT)
- **Uwierzytelnienie**: wymagane dla wszystkich endpointów.

### 2.1 `GET /recipes`
- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/recipes`
- **Parametry (query)**:
  - **Opcjonalne**:
    - `page` (int, default `1`)
    - `limit` (int, default `20`, max `100`)
    - `sort` (string, np. `name.asc`, `created_at.desc`)
    - `filter[category_id]` (int)
    - `filter[tags]` (string, lista tagów oddzielona przecinkami)
    - `search` (string)
- **Zmiany dot. `visibility`**:
  - Pole `visibility` musi być zwracane w elementach listy (response DTO).

### 2.2 `GET /recipes/{id}`
- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/recipes/{id}`
- **Parametry (path)**:
  - **Wymagane**:
    - `{id}` (int > 0)
- **Zmiany dot. `visibility`**:
  - Pole `visibility` musi być zwracane w obiekcie szczegółowym.

### 2.3 `POST /recipes`
- **Metoda HTTP**: `POST`
- **URL**: `/functions/v1/recipes`
- **Body (JSON)**:
  - **Wymagane**:
    - `name` (string, 1–150)
    - `ingredients_raw` (string, min 1 znak)
    - `steps_raw` (string, min 1 znak)
    - `visibility` (`PRIVATE` | `SHARED` | `PUBLIC`)
  - **Opcjonalne**:
    - `description` (string | null)
    - `category_id` (int | null)
    - `tags` (string[], default `[]`)

### 2.4 `PUT /recipes/{id}`
- **Metoda HTTP**: `PUT`
- **URL**: `/functions/v1/recipes/{id}`
- **Parametry (path)**:
  - **Wymagane**:
    - `{id}` (int > 0)
- **Body (JSON)**:
  - **Opcjonalne** (co najmniej jedno pole wymagane):
    - `name` (string, 1–150)
    - `description` (string | null)
    - `category_id` (int | null)
    - `ingredients_raw` (string)
    - `steps_raw` (string)
    - `tags` (string[])
    - `visibility` (`PRIVATE` | `SHARED` | `PUBLIC`)

### 2.5 `POST /recipes/import`
- **Metoda HTTP**: `POST`
- **URL**: `/functions/v1/recipes/import`
- **Body (JSON)**:
  - **Wymagane**:
    - `raw_text` (string, min 1 znak)
- **Zmiany dot. `visibility`**:
  - Importowane przepisy muszą otrzymywać **domyślnie** `visibility = PRIVATE`.
  - Endpoint nie przyjmuje `visibility` w body (ustalane po stronie serwera).

### 2.6 `DELETE /recipes/{id}` (soft delete)
- **Metoda HTTP**: `DELETE`
- **URL**: `/functions/v1/recipes/{id}`
- **Parametry (path)**:
  - **Wymagane**:
    - `{id}` (int > 0)
- **Body**: brak
- **Zachowanie**:
  - Ustawia `deleted_at = now()` (soft delete).

## 3. Wykorzystywane typy

### 3.1 Kontrakty współdzielone (frontend ↔ backend)
Plik: `shared/contracts/types.ts`

- **Nowy typ**: `RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC'`
- **Zmiany DTO/Command**:
  - `RecipeListItemDto`: dodać `visibility`
  - `RecipeDetailDto`: dodać `visibility`
  - `CreateRecipeCommand`: dodać wymagane `visibility`
  - `UpdateRecipeCommand`: dodać opcjonalne `visibility`

### 3.2 Typy backendowe (Edge Function)
Pliki: `supabase/functions/recipes/recipes.handlers.ts`, `supabase/functions/recipes/recipes.service.ts`

- `RecipeListItemDto` i `RecipeDetailDto` muszą zawierać `visibility`.
- `CreateRecipeInput` musi zawierać wymagane `visibility`.
- `UpdateRecipeInput` musi zawierać opcjonalne `visibility`.

## 4. Szczegóły odpowiedzi

### 4.1 `GET /recipes` – 200
- **Body**: `PaginatedResponseDto<RecipeListItemDto>`
- **Wymagane pola** w item:
  - `id`, `name`, `image_path`, `created_at`, `visibility`

### 4.2 `GET /recipes/{id}` – 200
- **Body**: `RecipeDetailDto`
- **Wymagane pola**: jak dotychczas + `visibility`.

### 4.3 `POST /recipes` – 201
- **Body**: pełny `RecipeDetailDto` nowo utworzonego przepisu (w tym `visibility`).

### 4.4 `PUT /recipes/{id}` – 200
- **Body**: pełny `RecipeDetailDto` zaktualizowanego przepisu (w tym `visibility`).

### 4.5 `POST /recipes/import` – 201
- **Body**: pełny `RecipeDetailDto` (w tym `visibility = PRIVATE`).

### 4.6 `DELETE /recipes/{id}` – 204
- **Body**: brak

### Kody błędów (wymagane w planie)
- `400` – błędne dane wejściowe / niepoprawny JSON / walidacja domenowa z DB
- `401` – brak/niepoprawny token
- `404` – zasób nie istnieje (lub brak dostępu z uwagi na RLS; celowo nie ujawniamy istnienia)
- `500` – błąd nieobsłużony / błąd bazy

> Uwaga: router może zwracać `405 Method Not Allowed` dla nieobsługiwanych kombinacji metody/ścieżki – to zachowanie może pozostać, ale nie jest krytycznym wymaganiem specyfikacji powyżej.

## 5. Przepływ danych

### 5.1 Warstwa HTTP (router/handlery)
1. `index.ts` przyjmuje request, obsługuje CORS i deleguje do `recipesRouter`.
2. `recipesRouter` dopasowuje ścieżkę i metodę, deleguje do handlerów.
3. Handler:
   - pobiera `client` i `user` przez `getAuthenticatedContext(req)`,
   - waliduje wejście (Zod) i mapuje na input do serwisu,
   - wywołuje serwis, formatuje odpowiedź JSON (200/201/204).

### 5.2 Warstwa serwisowa (logika biznesowa)
- Odczyty (`GET`):
  - źródło danych: widok `public.recipe_details` (RLS + `deleted_at is null`).
  - listowanie: paginacja `.range()` + `count: exact`.
  - filtrowanie tagów: `tag_ids contains [...]` po wcześniejszym resolve nazw tagów.
  - wyszukiwanie: docelowo pełnotekstowe po `search_vector` (patrz sekcja 7).
- Zapis (`POST`, `PUT`):
  - źródło: funkcje RPC `create_recipe_with_tags`, `update_recipe_with_tags` (atomowość, parsowanie JSONB, obsługa tagów).
  - `visibility` przechodzi jako parametr do RPC i trafia do tabeli `recipes`.
- Usuwanie (`DELETE`):
  - soft delete: `update public.recipes set deleted_at = now() where id = :id and user_id = :user and deleted_at is null`.

## 6. Względy bezpieczeństwa

- **JWT + RLS**: RLS na `public.recipes` zapewnia, że użytkownik nie odczyta ani nie zmodyfikuje cudzych przepisów.
- **Brak ujawniania istnienia zasobu**: dla odczytu/aktualizacji/usuwania zasobu, który nie należy do użytkownika, zwracać `404`, a nie `403`.
- **Walidacja wejścia**:
  - `visibility` jako enum w Zod (handler) + enum w bazie (DB).
  - `sortField` ograniczony do allow-list (zapobiega wstrzyknięciom przez `.order()`).
  - `limit` ograniczony do `MAX_LIMIT`.
- **CORS**: utrzymać bieżące nagłówki CORS; w razie wdrożenia produkcyjnego rozważyć zawężenie `Access-Control-Allow-Origin`.

## 7. Obsługa błędów

### 7.1 Źródła błędów i mapowanie na HTTP
- **Brak / błędny JSON**: `400` (`VALIDATION_ERROR`)
- **Walidacja Zod**: `400` (`VALIDATION_ERROR`) z agregacją komunikatów
- **Brak tokena / token wygasł**: `401` (`UNAUTHORIZED`)
- **Brak zasobu**:
  - `GET /{id}`: brak rekordu w `recipe_details` -> `404` (`NOT_FOUND`)
  - `PUT/DELETE /{id}`: brak dostępu lub brak rekordu -> `404` (`NOT_FOUND`)
- **Błędy RPC**:
  - `P0001` (raise_exception) -> `400` (walidacja domenowa, np. puste składniki po parsowaniu)
  - `P0002` (no_data_found) -> `404` (np. brak kategorii, brak przepisu)
- **Inne błędy DB**: `500` (`INTERNAL_ERROR`)

### 7.2 Rejestrowanie błędów
W obecnej architekturze błędy są logowane przez `logger` w Edge Function oraz zwracane przez `handleError()` z `_shared/errors.ts`. Nie ma dedykowanej tabeli błędów – wdrożenie jej nie jest wymagane dla tej zmiany.

## 8. Wydajność

- **Paginacja**: stały limit (default 20, max 100) ogranicza koszty query i payload.
- **Widok `recipe_details`**: unika N+1 przez agregacje tagów/kolekcji.
- **Filtrowanie tagów**: `tag_ids contains` jest wydajne przy właściwych indeksach; utrzymać indeksy zgodnie z planem DB.
- **Wyszukiwanie**:
  - Stan obecny w serwisie: `ILIKE` po `name` (substring match) – UX OK, ale nie spełnia w pełni „full-text search”.
  - Docelowo: użyć `search_vector` w `recipe_details` oraz operatorów pełnotekstowych (websearch/plainto_tsquery) dla lepszej jakości i wydajności.

## 9. Kroki implementacji

### 9.1 Zmiany w bazie danych (Supabase migrations)
1. **Dodać enum i kolumnę**:
   - utworzyć typ enum `public.recipe_visibility` (`PRIVATE`, `SHARED`, `PUBLIC`);
   - dodać kolumnę `public.recipes.visibility public.recipe_visibility not null default 'PRIVATE'`.
2. **Zaktualizować widok `public.recipe_details`**:
   - dodać `r.visibility` do selecta (i utrzymać `search_vector` tam gdzie występuje).
   - Uwaga: w repo istnieje migracja, która `drop view` i tworzy widok z `search_vector`; nowa migracja powinna tworzyć widok zawierający **oba** pola: `search_vector` i `visibility`.
3. **Zaktualizować RPC**:
   - `create_recipe_with_tags`:
     - dodać parametr `p_visibility public.recipe_visibility`,
     - uwzględnić `visibility` w `insert into public.recipes (...) values (...)`.
   - `update_recipe_with_tags`:
     - dodać parametr `p_visibility public.recipe_visibility default null`,
     - zaktualizować `update public.recipes set visibility = coalesce(p_visibility, visibility), ...`.
   - uaktualnić `comment on function` i `grant execute` dla nowych sygnatur.

### 9.2 Zmiany w Edge Function `supabase/functions/recipes`
1. **`recipes.handlers.ts`**:
   - rozszerzyć `createRecipeSchema` o wymagane `visibility` (enum),
   - rozszerzyć `updateRecipeSchema` o opcjonalne `visibility` (enum),
   - dodać mapowanie `visibility` do `CreateRecipeInput`/`UpdateRecipeInput`,
   - dodać `handleDeleteRecipe()` (walidacja `{id}`, auth, delegacja do serwisu, zwrot `204`).
2. **`recipes.handlers.ts` router**:
   - dodać obsługę `DELETE` dla ścieżki `/recipes/{id}`.
   - utrzymać istniejące zachowanie dla `405` na nieobsługiwanych kombinacjach.
3. **`recipes.service.ts`**:
   - dodać `visibility` do:
     - `RecipeListItemDto` oraz `RECIPE_LIST_SELECT_COLUMNS`,
     - `RecipeDetailDto` oraz `RECIPE_DETAIL_SELECT_COLUMNS`,
     - `CreateRecipeInput` (wymagane),
     - `UpdateRecipeInput` (opcjonalne).
   - przekazać `p_visibility` do RPC w `createRecipe()` i `updateRecipe()`.
   - dodać `deleteRecipe()`:
     - wykonać soft delete na `public.recipes`,
     - jeśli `0` wierszy zaktualizowano -> `NOT_FOUND`.
4. **`index.ts` (opcjonalnie)**:
   - zaktualizować komentarz/specyfikację endpointów o `visibility` oraz `DELETE`.

### 9.3 Zmiany kontraktów typów (współdzielone DTO)
1. Zaktualizować `shared/contracts/types.ts` zgodnie z sekcją 3.
2. Jeżeli projekt korzysta z generowanych typów bazy (`database.types.ts`), dodać krok regeneracji typów (np. `supabase gen types typescript`) po wdrożeniu migracji.

### 9.4 Testy i weryfikacja (minimalny zakres)
1. Lokalnie uruchomić Supabase + funkcję `recipes` (`supabase functions serve recipes`).
2. Przypadki testowe (API):
   - `POST /recipes` bez `visibility` -> `400`,
   - `POST /recipes` z `visibility=PUBLIC` -> `201` i odpowiedź zawiera `visibility`,
   - `PUT /recipes/{id}` zmiana `visibility` -> `200` i odczyt pokazuje nową wartość,
   - `POST /recipes/import` -> `201` i `visibility=PRIVATE`,
   - `GET /recipes` -> elementy listy zawierają `visibility`,
   - `DELETE /recipes/{id}` -> `204`, a kolejne `GET /recipes/{id}` -> `404`.


