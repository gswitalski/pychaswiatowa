## API Endpoints Implementation Plan: `GET /public/recipes` oraz `GET /public/recipes/feed`

## 1. Przegląd punktu końcowego

Ten plan obejmuje dwa publiczne endpointy listujące przepisy dla tras publicznych:

- **`GET /public/recipes`**: paginacja stronami (page-based), używana np. do klasycznego listingu.
- **`GET /public/recipes/feed`**: paginacja cursor-based („load more”), używana np. do infinite scroll.

Kluczowa zmiana w kontrakcie (względem wcześniejszych wersji) dla **obu** endpointów:

- **Dodano pola**: `visibility` oraz `is_owner` w elementach listy.
- **Doprecyzowano zachowanie**:
    - **gość (brak JWT)**: zwracamy wyłącznie przepisy `visibility = 'PUBLIC'`, a `is_owner` zawsze `false`.
    - **zalogowany (poprawny JWT)**: zwracamy:
        - wszystkie przepisy `visibility = 'PUBLIC'` (dowolnych autorów),
        - **oraz** dodatkowo przepisy użytkownika (`user_id = authUserId`) o `visibility != 'PUBLIC'` (np. `PRIVATE`, `SHARED`) — i tylko dla nich `is_owner = true`.
    - Endpointy **nigdy** nie mogą ujawnić niepublicznych przepisów innych użytkowników.

Wymagania domenowe wynikające ze schematu (soft delete):

- **Zawsze** filtrować `deleted_at IS NULL`.

Wymagania wdrożeniowe (Supabase Edge Functions + TypeScript; zgodnie z `.cursor/rules/backend.mdc`):

- `index.ts`: routing + obsługa błędów najwyższego poziomu (bez zapytań do DB).
- `*.handlers.ts`: walidacja requestu (Zod), wywołanie serwisu, format odpowiedzi.
- `*.service.ts`: logika biznesowa i zapytania do DB.

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes`
- **Supabase Edge Function runtime URL**: `/functions/v1/public/recipes`
- **Request Body**: brak
- **Nagłówki**:
    - **Opcjonalne**: `Authorization: Bearer <JWT>`
        - Jeśli nagłówek jest wysłany i token jest **niepoprawny/wygaśnięty** → zwrócić `401`.
        - Jeśli nagłówka brak → traktować jak gościa.

#### Parametry (query)

- **Wymagane**: brak
- **Opcjonalne**:
    - `page` (integer, domyślnie `1`, min `1`)
    - `limit` (integer, domyślnie `20`, min `1`, max `100`)
    - `sort` (string, domyślnie `created_at.desc`)
        - format: `<field>.<direction>`
        - dozwolone `field`: `created_at`, `name`
        - dozwolone `direction`: `asc`, `desc`
    - `q` (string, opcjonalny)
        - `trim`
        - jeśli podany → **min 2 znaki**
    - `filter[termorobot]` (boolean, opcjonalny): `true|false|1|0`

### 2.2 `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/feed`
- **Supabase Edge Function runtime URL**: `/functions/v1/public/recipes/feed`
- **Request Body**: brak
- **Nagłówki**:
    - **Opcjonalne**: `Authorization: Bearer <JWT>` (jak wyżej)

#### Parametry (query)

- **Wymagane**: brak
- **Opcjonalne**:
    - `cursor` (string, opcjonalny): opaque cursor z poprzedniej odpowiedzi (`pageInfo.nextCursor`)
    - `limit` (integer, domyślnie `12`, min `1`, max `100`)
    - `sort` (string, domyślnie `created_at.desc`)
        - format: `<field>.<direction>`
        - dozwolone `field`: `created_at`, `name`
        - dozwolone `direction`: `asc`, `desc`
    - `q` (string, opcjonalny): jak wyżej (min 2 znaki, jeśli podany)
    - `filter[termorobot]` (boolean, opcjonalny): `true|false|1|0`

## 3. Wykorzystywane typy

### 3.1 DTO (kontrakt współdzielony)

Zalecane jest utrzymywanie kontraktów w `shared/contracts/types.ts`, aby frontend i backend były spójne.

- `PaginatedResponseDto<T>`
- `CursorPaginatedResponseDto<T>`
- `PublicRecipeListItemDto`
- `CategoryDto`
- `ProfileDto`
- `RecipeVisibility`

### 3.2 Wymagane zmiany w DTO

W `shared/contracts/types.ts` należy zaktualizować `PublicRecipeListItemDto`, dodając:

- `visibility: RecipeVisibility`
- `is_owner: boolean`

oraz utrzymać istniejące pola (w tym `in_my_collections`, które dla gościa powinno być zawsze `false`).

Uwaga dot. repo: analogiczny DTO jest obecnie zdefiniowany lokalnie w `supabase/functions/public/public.service.ts` — plan zakłada spójne zaktualizowanie obu definicji albo ich ujednolicenie (jeśli repo przyjmie import wspólnych typów).

### 3.3 Modele wejścia (dla serwisu)

- `GetPublicRecipesQuery`
- `GetPublicRecipesFeedQuery`

## 4. Szczegóły odpowiedzi

### 4.1 `GET /public/recipes` (sukces)

- **200 OK**

Payload:

```json
{
    "data": [
        {
            "id": 1,
            "name": "Apple Pie",
            "description": "A classic dessert.",
            "image_path": "path/to/image.jpg",
            "visibility": "PUBLIC",
            "is_owner": false,
            "category": { "id": 2, "name": "Dessert" },
            "tags": ["sweet", "baking"],
            "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
            "created_at": "2023-10-27T10:00:00Z",
            "in_my_collections": false,
            "servings": 6,
            "is_termorobot": false
        }
    ],
    "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 100
    }
}
```

### 4.2 `GET /public/recipes/feed` (sukces)

- **200 OK**

Payload:

```json
{
    "data": [
        {
            "id": 1,
            "name": "Apple Pie",
            "description": "A classic dessert.",
            "image_path": "path/to/image.jpg",
            "visibility": "PUBLIC",
            "is_owner": false,
            "category": { "id": 2, "name": "Dessert" },
            "tags": ["sweet", "baking"],
            "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
            "created_at": "2023-10-27T10:00:00Z",
            "in_my_collections": false,
            "servings": 6,
            "is_termorobot": false
        }
    ],
    "pageInfo": {
        "hasMore": true,
        "nextCursor": "opaque_cursor_value"
    }
}
```

### 4.3 Błędy (oba endpointy)

- **400 Bad Request**
    - nieprawidłowe query parametry (`page`, `limit`, `sort`, `cursor`, `filter[termorobot]`)
    - `q` podane i krótsze niż 2 znaki (po trim)
    - `cursor` niezgodny z bieżącym zestawem parametrów (np. inny `sort/limit/filtry`) — dotyczy feed
- **401 Unauthorized**
    - wysłano `Authorization`, ale JWT jest niepoprawny/wygaśnięty
- **404 Not Found**
    - ścieżka nieobsługiwana przez router funkcji `public` (np. literówka w URL)
- **500 Internal Server Error**
    - błędy bazy / nieoczekiwane wyjątki / brak konfiguracji środowiska

## 5. Przepływ danych

### 5.1 Routing (Edge Function `public`)

- `supabase/functions/public/index.ts`:
    - CORS i logowanie requestu
    - delegacja do `publicRouter(req)`
- `supabase/functions/public/public.handlers.ts`:
    - rozpoznanie ścieżek:
        - `/recipes/feed` **musi** być sprawdzane przed `/recipes/{id}` (żeby nie dopasować `feed` jako `{id}`)
        - `/recipes`

### 5.2 Handler (`public.handlers.ts`)

W obu handlerach:

- **Opcjonalne uwierzytelnienie**:
    - `getOptionalAuthenticatedUser(req)`
    - `userId = user?.id ?? null`
- **Walidacja query (Zod)**:
    - `page/limit` (dla listy stron)
    - `cursor/limit` (dla feed)
    - `sort` z allow-listą pól i kierunków
    - `q` (trim; jeśli podany, min 2 znaki)
    - `filter[termorobot]` (true/false/1/0)
- Wywołanie serwisu:
    - `getPublicRecipes(client, query, userId)`
    - `getPublicRecipesFeed(client, query, userId)`
- Zwrócenie odpowiedzi:
    - `GET /public/recipes`: `200` z `PaginatedResponseDto<PublicRecipeListItemDto>`
    - `GET /public/recipes/feed`: `200` z `CursorPaginatedResponseDto<PublicRecipeListItemDto>`

### 5.3 Serwis (`public.service.ts`)

Źródło danych: preferować `recipe_details` (agreguje kategorię i tagi; ogranicza N+1).

Krytyczne reguły filtrowania:

- **zawsze**: `deleted_at IS NULL`
- **gość**: `visibility = 'PUBLIC'`
- **zalogowany**: `(visibility = 'PUBLIC') OR (user_id = <authUserId>)`

Mapowanie pól listy:

- `visibility`: z wiersza `recipe_details.visibility`
- `is_owner`:
    - gdy `userId === null` → `false`
    - w przeciwnym razie → `recipe.user_id === userId`
- `in_my_collections`:
    - gdy `userId === null` → `false`
    - w przeciwnym razie → sprawdzić, czy przepis występuje w jakiejkolwiek kolekcji użytkownika (bulk query po `recipe_collections` + `collections.user_id`)
- `author`:
    - zebrać unikalne `user_id` z listy,
    - pobrać profile przez jedno zapytanie `.in('id', uniqueUserIds)`,
    - dołączyć `{ id, username }` bez N+1.

Feed (cursor):

- cursor jest opaque (np. base64url JSON) i musi zawierać sygnaturę zapytania (filters hash) tak, by odrzucać niezgodne kursory.
- sort musi być stabilny: `ORDER BY <field> <dir>, id <dir>`.

## 6. Względy bezpieczeństwa

- **Opcjonalne auth**:
    - brak JWT → tryb publiczny (tylko `PUBLIC`)
    - niepoprawny JWT (gdy wysłany) → `401`
- **Service role a wyciek danych**:
    - ponieważ funkcja używa service role (bypass RLS), wszystkie filtry dostępu muszą być wymuszone w serwisie:
        - `deleted_at IS NULL`
        - publiczny zakres widoczności (z uwzględnieniem „własnych” dla zalogowanego)
- **Walidacja sortowania**:
    - allow-lista pól i kierunków (zapobieganie nadużyciom)
- **Limity**:
    - `limit` max 100
    - `q` min 2 (jeśli podany)
- **Cache**:
    - anon: można cache’ować krótko (`public, max-age=60`)
    - authenticated: `no-store` (żeby nie cache’ować odpowiedzi zależnych od użytkownika)

## 7. Obsługa błędów

- Używać spójnego mechanizmu `ApplicationError` + `handleError` z `supabase/functions/_shared/errors.ts`.
- Logowanie:
    - `info`: parametry requestu (bez danych wrażliwych)
    - `warn`: walidacja i przypadki brzegowe
    - `error`: błędy DB i nieoczekiwane wyjątki

Rejestrowanie błędów w tabeli (jeśli dotyczy):

- W aktualnym DB planie nie ma tabeli logów błędów; standardem jest logowanie przez `logger`.
- Opcjonalnie (po MVP) można wprowadzić tabelę np. `api_error_logs` dla błędów 5xx i wybranych 4xx.

## 8. Wydajność

- **List (page-based)**:
    - `count: 'exact'` jest kosztowny, ale akceptowalny dla MVP.
- **Feed (cursor-based)**:
    - unikać `count(*)`; stosować `limit + 1` do ustalenia `hasMore`.
- **Unikanie N+1**:
    - profile autorów pobierać bulk (`profiles.in(id, ...)`)
    - `in_my_collections` liczyć bulk (jedno zapytanie dla całej paczki)
- **Wyszukiwanie**:
    - MVP może używać `ILIKE` (jak w aktualnym kodzie),
    - docelowo (zgodnie z API planem) przejść na full-text (name + ingredients + tags) z użyciem indeksu GIN / RPC.

## 9. Kroki implementacji

1. **Kontrakt DTO**
    - Zaktualizować `shared/contracts/types.ts`:
        - `PublicRecipeListItemDto`: dodać `visibility`, `is_owner`.
2. **Walidacja requestu**
    - Utrzymać/rozszerzyć Zod schematy w `supabase/functions/public/public.handlers.ts`:
        - `q` min 2 (gdy podane),
        - `sort` allow-list,
        - `filter[termorobot]` parsing,
        - `cursor` (dla feed).
3. **Logika filtrowania anon vs zalogowany**
    - W `public.service.ts` wymusić:
        - anon: tylko `PUBLIC`
        - zalogowany: `PUBLIC` lub `user_id = authUserId`
        - zawsze `deleted_at IS NULL`
4. **Rozszerzenie select i mapowania**
    - Upewnić się, że lista (`recipe_details`) zwraca `visibility` (dopisać do select),
    - Dodać mapowanie `visibility` i `is_owner` w DTO.
5. **Cache-Control**
    - anon: `public, max-age=60`
    - authenticated: `no-store`
6. **Testy smoke (manual/automatyczne)**
    - anon:
        - brak JWT → tylko `visibility=PUBLIC`, `is_owner=false`, `in_my_collections=false`
    - zalogowany:
        - z JWT → w wynikach mogą pojawić się własne `PRIVATE/SHARED` z `is_owner=true`
        - niepubliczne cudze przepisy nie mogą się pojawić
    - walidacja:
        - `q=a` → `400`
        - zły `cursor` / cursor niezgodny z parametrami → `400`
        - niepoprawny JWT → `401`
