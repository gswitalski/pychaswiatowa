# API Endpoints Implementation Plan: Public Recipes (`GET /public/recipes`, `GET /public/recipes/feed`, `GET /public/recipes/{id}`)

<analysis>
## 1. Podsumowanie kluczowych punktów specyfikacji API
- Zasób **Public Recipes** jest dostępny bez uwierzytelnienia, ale **opcjonalnie** może przyjąć `Authorization: Bearer <JWT>` aby:
  - dodać pola pomocnicze (`is_owner`, `in_my_plan`, `collection_ids`),
  - dla list: **rozszerzyć zbiór o własne przepisy użytkownika** o widoczności innej niż `PUBLIC` (tylko gdy `is_owner = true`).
- Endpointy list:
  - `GET /public/recipes` – paginacja stronami (`page`, `limit`), sortowanie i opcjonalne wyszukiwanie `q`.
  - `GET /public/recipes/feed` – paginacja kursorowa (`cursor`, `limit`) do “load more”, sortowanie stabilne i opcjonalne `q`.
- Zmiana funkcjonalna (wymaganie z opisu zmian):
  - `q` ma przeszukiwać także **wskazówki (`tips`)**.
  - relevance ma uwzględniać wagi: **name(3) > ingredients(2) > tags(1) > tips(0.5)**.
- Obiekt detalu przepisu publicznego ma zawierać `tips: Array<{ type: "header" | "item", content: string }>` (może być pusty).
- Wszystkie odczyty przepisów muszą respektować soft delete: `deleted_at IS NULL`.

## 2. Parametry wymagane i opcjonalne (z kontraktu)
### `GET /public/recipes`
- Nagłówki:
  - opcjonalny: `Authorization: Bearer <JWT>`
- Query:
  - opcjonalne: `page` (int, domyślnie 1), `limit` (int, domyślnie 20), `sort` (domyślnie `created_at.desc`)
  - opcjonalne: `q` (string, min 3 po trim; max 150)
  - opcjonalne filtry:
    - `filter[termorobot]` (bool)
    - `filter[grill]` (bool)
    - `filter[diet_type]` (`MEAT | VEGETARIAN | VEGAN`)
    - `filter[cuisine]` (`RecipeCuisine`)
    - `filter[difficulty]` (`EASY | MEDIUM | HARD`)

### `GET /public/recipes/feed`
- Nagłówki:
  - opcjonalny: `Authorization: Bearer <JWT>`
- Query:
  - opcjonalne: `cursor` (opaque string), `limit` (int, domyślnie 12), `sort` (domyślnie `created_at.desc`)
  - opcjonalne: `q` (string, min 3 po trim; max 150)
  - opcjonalne filtry: jw. (`filter[...]`)

### `GET /public/recipes/{id}`
- Parametry URL:
  - wymagane: `id` (dodatnia liczba całkowita)
- Nagłówki:
  - opcjonalny: `Authorization: Bearer <JWT>`

## 3. Niezbędne typy DTO i Command Modele
- `shared/contracts/types.ts`:
  - `PublicRecipeListItemDto`
  - `PublicRecipeDetailDto` (**musi zawierać `tips`**)
  - `RecipeSearchMeta`, `SearchMatchSource` (**musi uwzględniać `tips` jako możliwe źródło dopasowania**)
  - `PaginatedResponseDto<T>`, `CursorPaginatedResponseDto<T>`
  - `RecipeContentItem`, `RecipeContent` (format `ingredients/steps/tips`)
- `supabase/functions/public/public.types.ts`:
  - `GetPublicRecipesQuery`, `GetPublicRecipesFeedQuery`, `GetPublicRecipeByIdParams`
  - `SearchMatchSource` / `RecipeSearchMeta` (spójne z kontraktem)
- `supabase/functions/public/public.service.ts`:
  - DTO i mappingi spójne z kontraktem

## 4. Wyodrębnienie logiki do service
- `index.ts`: tylko CORS, routing, top-level error handling.
- `public.handlers.ts`: walidacja query/path (Zod), wyciągnięcie opcjonalnego użytkownika (JWT), cache-control zależnie od auth, wywołanie serwisów.
- `public.service.ts`: logika biznesowa:
  - dobór widoczności (anon vs auth),
  - pobranie danych z DB (widok `recipe_details` + profile),
  - obliczanie relevance i filtrowanie z semantyką AND,
  - budowa cursorów i weryfikacja spójności cursorów,
  - dołączenie metadanych (`in_my_plan`, `collection_ids`) dla użytkownika.

## 5. Walidacja danych wejściowych
- `q`:
  - trim, jeśli pusty → traktować jako brak `q`.
  - jeśli po trim < 3 → `400`.
  - limit długości (np. 150) → `400`.
  - limit tokenów (np. 10) jako ochrona przed DoS.
- `sort`:
  - format `{field}.{direction}`; `field` ∈ `created_at | name | relevance`; `direction` ∈ `asc | desc`.
  - gdy `q` obecne i poprawne, domyślny sort powinien przejść na `relevance` (z tie-breakerem `created_at.desc`, potem `id.desc`).
- `page`, `limit`:
  - dodatnie int; limit max 100.
- `cursor`:
  - poprawny format, zgodność z `limit`, `sort` i filtrami (hash filtrów) → w przeciwnym razie `400`.
- `id`:
  - dodatni int.
- Filtry:
  - boole: wspierać `true/false` i `1/0`.
  - enumy: walidować Zod enum.

## 6. Rejestrowanie błędów w tabeli błędów
- W aktualnym stacku funkcji Edge: brak dedykowanej “tabeli błędów” w DB w MVP.
- Logowanie:
  - `info`: wejście/wyjście endpointu, parametry zanonimizowane, liczby wyników, `isAuthenticated`.
  - `warn`: walidacja, niepoprawny cursor, zbyt krótkie `q`.
  - `error`: błędy DB/RPC, niespójność danych (np. brak profilu autora).

## 7. Identyfikacja ryzyk bezpieczeństwa
- **Mieszanie odpowiedzi anon/auth w cache**: konieczne `Vary: Authorization` i `Cache-Control: no-store` dla żądań z JWT.
- **Wycieki prywatności**: przy auth dopuszczamy tylko `visibility = PUBLIC` lub `user_id = auth.uid()`; nigdy cudze nie-publiczne.
- **DoS**:
  - zbyt długie `q`, za dużo tokenów, zbyt wysoki `limit`, zbyt szerokie pobranie danych do liczenia relevance w aplikacji.
  - ograniczenia: max tokenów, max `limit`, ewentualnie max liczby rekordów branych do filtrowania per request.
- **Injection**:
  - query budować przez parametry klienta Supabase, nie przez stringi SQL; uważać na `.or()` z `userId`.

## 8. Scenariusze błędów i kody statusu
- `200 OK`: poprawna odpowiedź.
- `400 Bad Request`: walidacja (q za krótkie, zły cursor, złe sort/filtry).
- `401 Unauthorized`: tylko gdy token jest obecny, ale niepoprawny (przy “optional auth”).
- `404 Not Found`: `GET /public/recipes/{id}` gdy brak przepisu publicznego lub soft-deleted.
- `500 Internal Server Error`: błąd DB / nieoczekiwany błąd runtime.
</analysis>

## 1. Przegląd punktu końcowego

Ten plan obejmuje wdrożenie i doprowadzenie do zgodności z kontraktem trzech endpointów zasobu **Public Recipes**:
- `GET /public/recipes` (paginacja stronami),
- `GET /public/recipes/feed` (paginacja kursorowa),
- `GET /public/recipes/{id}` (detal).

Kluczowa zmiana funkcjonalna dotyczy wyszukiwania `q`: musi ono obejmować również `tips` oraz aktualizować relevance zgodnie z wagami `name(3) > ingredients(2) > tags(1) > tips(0.5)`. Dodatkowo detal przepisu musi zwracać `tips` w formacie `RecipeContent`.

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes` (Supabase: `/functions/v1/public/recipes`)
- **Nagłówki**:
  - **Opcjonalne**: `Authorization: Bearer <JWT>`
- **Parametry (query)**:
  - **Opcjonalne (paginacja)**: `page` (default 1), `limit` (default 20, max 100)
  - **Opcjonalne (sort)**: `sort` (default `created_at.desc`)
  - **Opcjonalne (search)**: `q` (trim, min 3, max 150)
  - **Opcjonalne (filtry)**:
    - `filter[termorobot]`, `filter[grill]`
    - `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`
- **Body**: brak

### 2.2 `GET /public/recipes/feed`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/feed` (Supabase: `/functions/v1/public/recipes/feed`)
- **Nagłówki**:
  - **Opcjonalne**: `Authorization: Bearer <JWT>`
- **Parametry (query)**:
  - **Opcjonalne (cursor)**: `cursor` (opaque), `limit` (default 12, max 100)
  - **Opcjonalne (sort)**: `sort` (default `created_at.desc`; musi być stabilny)
  - **Opcjonalne (search)**: `q` (trim, min 3, max 150)
  - **Opcjonalne (filtry)**: jw.
- **Body**: brak

### 2.3 `GET /public/recipes/{id}`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/{id}` (Supabase: `/functions/v1/public/recipes/{id}`)
- **Nagłówki**:
  - **Opcjonalne**: `Authorization: Bearer <JWT>`
- **Parametry**:
  - **Wymagane**: `id` (path, dodatnia liczba całkowita)
- **Body**: brak

## 3. Wykorzystywane typy

### Kontrakt (frontend/shared) – `shared/contracts/types.ts`
- `PublicRecipeListItemDto`
- `PublicRecipeDetailDto` (z `tips: RecipeContent`)
- `RecipeContentItem`, `RecipeContent`
- `PaginatedResponseDto<T>`, `CursorPaginatedResponseDto<T>`
- `RecipeSearchMeta`, `SearchMatchSource` (rozszerzony o `tips`)

### Backend (Edge Function) – `supabase/functions/public/*`
- `GetPublicRecipesQuery`, `GetPublicRecipesFeedQuery`, `GetPublicRecipeByIdParams`
- Lokalny odpowiednik `PublicRecipeListItemDto` i `PublicRecipeDetailDto` (spójny z kontraktem)

## 4. Szczegóły odpowiedzi

### 4.1 `GET /public/recipes`
- **Kod**: `200 OK`
- **Payload**: `PaginatedResponseDto<PublicRecipeListItemDto>`
  - `search` w elementach listy:
    - `null` jeśli brak `q` lub `q` nieobecne
    - `{ relevance_score, match }` jeśli `q` poprawne
  - `match` dopuszcza wartości: `name | ingredients | tags | tips`

### 4.2 `GET /public/recipes/feed`
- **Kod**: `200 OK`
- **Payload**: `CursorPaginatedResponseDto<PublicRecipeListItemDto>`
  - `pageInfo.nextCursor` zwracany tylko gdy `hasMore = true`

### 4.3 `GET /public/recipes/{id}`
- **Kod**: `200 OK`
- **Payload**: `PublicRecipeDetailDto`, w tym:
  - `ingredients: RecipeContent`
  - `steps: RecipeContent`
  - **`tips: RecipeContent`** (może być `[]`)

### 4.4 Błędy (wspólne)
- `400 Bad Request`: walidacja query/path (w tym `q` < 3, invalid cursor)
- `401 Unauthorized`: token obecny, ale niepoprawny (opcjonalne auth)
- `404 Not Found`: tylko dla `GET /public/recipes/{id}` (brak publicznego przepisu lub soft-delete)
- `500 Internal Server Error`: błąd po stronie serwera

## 5. Przepływ danych

### 5.1 Routing (Edge Function)
1. `supabase/functions/public/index.ts`:
   - CORS, `OPTIONS`, `Vary: Authorization`, globalny `try/catch`.
2. `supabase/functions/public/public.handlers.ts`:
   - dopasowanie ścieżek:
     - `/recipes/feed` (najpierw, by nie zmatchować jako `{id}`)
     - `/recipes/{id}`
     - `/recipes`
   - walidacja (Zod)
   - `getOptionalAuthenticatedUser(req)` → `userId | null`
   - ustawienie cache:
     - anon: `Cache-Control: public, max-age=60`
     - auth: `Cache-Control: no-store`
3. `supabase/functions/public/public.service.ts`:
   - zapytanie do `recipe_details` + `profiles`, opcjonalnie `plan_recipes` i `recipe_collections`.
   - obliczenie relevance i filtrowanie AND.

### 5.2 Dostęp do DB (reguły widoczności)
- anon: `visibility = 'PUBLIC'` i `deleted_at IS NULL`
- auth: `(visibility = 'PUBLIC' OR user_id = <userId>)` i `deleted_at IS NULL`

### 5.3 Search i relevance – z `tips`
- Tokenizacja `q`:
  - lower-case
  - split po whitespace
  - limit tokenów (np. 10)
  - semantyka **AND**: wszystkie tokeny muszą pasować w co najmniej jednym z pól.
- Pola wyszukiwania:
  - `name` (tekst)
  - `ingredients` (tekst wyciągnięty z JSONB)
  - `tags` (nazwy tagów; matching exact/prefix)
  - **`tips` (tekst wyciągnięty z JSONB)** – nowe
- Scoring:
  - `name`: +3
  - `ingredients`: +2
  - `tags`: +1
  - `tips`: +0.5
- `match` w `search`: źródło o najwyższej wadze, które spełniło dopasowanie.

## 6. Względy bezpieczeństwa
- **Opcjonalne uwierzytelnienie**:
  - brak JWT jest poprawny,
  - niepoprawny JWT → `401` (bez “fallbacku” do anon, by nie maskować problemów klienta).
- **Cache safety**:
  - `Vary: Authorization` zawsze,
  - anon: cache publiczny krótki,
  - auth: `no-store`.
- **Ochrona danych**:
  - auth nie może ujawnić cudzych `PRIVATE/SHARED`.
- **DoS**:
  - ograniczenia: `limit`, długość `q`, max tokenów, limit rekordów do “in-app relevance” (jeśli liczenie relevance jest po stronie TS).

## 7. Obsługa błędów
- `handleError` mapuje:
  - walidację → `400`
  - niepoprawny JWT (z `getOptionalAuthenticatedUser`) → `401`
  - not found (`PGRST116` / brak rekordu) → `404` w detalu
  - DB errors / runtime → `500`
- Logowanie:
  - `info`: wejście/wyjście, `recipesCount`, `hasMore`, `page/limit`, `isAuthenticated`
  - `warn`: walidacja, `q` za krótkie, cursor mismatch
  - `error`: DB error codes i stack

## 8. Kroki implementacji

### A) Kontrakt / typy współdzielone (frontend/backend)
1. Zaktualizować `shared/contracts/types.ts`:
   - `SearchMatchSource`: dodać `'tips'`.
   - upewnić się, że `PublicRecipeDetailDto` ma `tips: RecipeContent` (już jest).
2. Zaktualizować `supabase/functions/public/public.types.ts`:
   - `SearchMatchSource`: dodać `'tips'`.
3. Zaktualizować typy w `supabase/functions/public/public.service.ts`:
   - `PublicRecipeDetailDto`: dodać `tips`.
   - `RecipeDetailFullRow`: dodać `tips`.
   - `RecipeDetailsRow`: dodać dane potrzebne do wyszukiwania po `tips` (np. `tips: RecipeContent | null`).

### B) Baza danych (migracje w `supabase/migrations/`)
4. Dodać kolumnę `recipes.tips jsonb not null default '[]'::jsonb` (jeśli jeszcze nie istnieje).
5. Zaktualizować widok `recipe_details`, aby zawierał `tips` (i ewentualnie `is_grill`, `deleted_at` jeśli używane w selekcie).
6. (Opcjonalnie – jeśli planujemy DB-level search): dodać/rozszerzyć mechanizm tsvector dla `tips` oraz rozważyć strategię dla tagów (np. materializacja tekstu tagów lub RPC z JOIN).

### C) Edge Function – walidacja wejścia (handlers)
7. W `supabase/functions/public/public.handlers.ts`:
   - upewnić się, że schematy query zawierają wszystkie filtry z API planu (w tym `filter[grill]` w rawParams → schema).
   - `q`: trim, min 3, max 150.
   - `sort`: wspiera `relevance` i wymusza stabilność tie-breakerów w serwisie.

### D) Edge Function – logika search + relevance (service)
8. W `supabase/functions/public/public.service.ts`:
   - dodać wagę `tips: 0.5` do `RELEVANCE_WEIGHTS`.
   - dodać `extractTipsText(tips: RecipeContent | null)` analogicznie do `extractIngredientsText`.
   - rozszerzyć `calculateRelevance`:
     - sprawdzać dopasowanie tokenów w tips,
     - aktualizować `totalScore`,
     - ustawiać `match` zgodnie z najwyższą wagą.
   - zaktualizować selekty kolumn:
     - `RECIPE_SELECT_COLUMNS`: zawiera `tips` (min. do wyszukiwania) lub dedykowaną projekcję tylko pod search.
     - `RECIPE_DETAIL_SELECT_COLUMNS`: zawiera `tips` dla detalu.
   - w `getPublicRecipeById`: mapować `tips` do DTO.
9. Utrzymać semantykę sortowania:
   - przy `q`: domyślnie relevance (desc) + `created_at.desc` + `id.desc`.
   - bez `q`: DB-level sort i paginacja.

### E) Test plan (manualny)
10. Lokalnie:
    - `supabase functions serve public`
    - scenariusze:
      - anon: `GET /public/recipes?q=abc` → `200`, `search.match` może być `tips`.
      - anon: `GET /public/recipes?q=ab` → `400`.
      - auth: `GET /public/recipes` → odpowiedź ma `is_owner`/`in_my_plan` zależnie od danych, brak cache (`no-store`).
      - `GET /public/recipes/{id}` zwraca `tips` jako `[]` gdy brak wskazówek.
      - relevance:
        - dopasowanie tylko w tips daje `relevance_score` +0.5 i `match='tips'`,
        - dopasowanie w name ma priorytet `match='name'`.
      - `GET /public/recipes/feed`:
        - cursor działa i nie pozwala mieszać filtrów (cursor mismatch → `400`).

