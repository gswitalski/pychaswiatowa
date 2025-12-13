# API Endpoints Implementation Plan: GET /public/recipes

## 1. Przegląd punktu końcowego
Celem endpointu `GET /public/recipes` jest udostępnienie **anonimowym użytkownikom** (bez JWT) listy przepisów o widoczności **PUBLIC**. Endpoint zwraca dane w formie stronicowanej (paginacja) oraz umożliwia:
- podstawowe wyszukiwanie tekstowe (MVP)
- sortowanie

Zmiana względem poprzedniej wersji kontraktu:
- w odpowiedzi listingu dodano `author` (id + username), aby frontend mógł oznaczyć „Twój przepis” porównując `author.id` z tożsamością użytkownika (np. z `/me`).

Wymagania domenowe wynikające ze schematu:
- zwracać wyłącznie przepisy **nieusunięte** (soft delete): `deleted_at IS NULL`
- zwracać wyłącznie przepisy publiczne: `visibility = 'PUBLIC'`

Wymagania wdrożeniowe (Supabase Edge Functions + TypeScript):
- logika biznesowa w `*.service.ts`, walidacja i format odpowiedzi w `*.handlers.ts`, routing w `index.ts`
- nie wykonywać zapytań do bazy w `index.ts`

## 2. Szczegóły żądania
- Metoda HTTP: **GET**
- Struktura URL: **/public/recipes**
  - Implementacyjnie w Supabase Edge Functions: zalecany katalog funkcji `supabase/functions/public/` z trasą wewnętrzną `/recipes` (tj. runtime URL: `/functions/v1/public/recipes`).

### Parametry
- Wymagane: **brak**
- Opcjonalne:
  - `page` (integer, domyślnie `1`): numer strony (>= 1)
  - `limit` (integer, domyślnie `20`): liczba elementów na stronie (>= 1; zalecany max `100`)
  - `sort` (string, domyślnie `created_at.desc`): sortowanie w formacie `{field}.{direction}`
    - dozwolone pola: `created_at`, `name`
    - dozwolone kierunki: `asc`, `desc`
  - `q` (string): zapytanie wyszukiwania tekstowego
    - jeśli podane: **min. 2 znaki** po trim

### Nagłówki
- `Authorization`: **niewymagany** (endpoint publiczny)
- `Content-Type`: nie dotyczy (brak body)

## 3. Wykorzystywane typy
### DTO (kontrakty)
Zalecane jest dodanie/utrwalenie kontraktów w `shared/contracts/types.ts`, aby frontend i backend korzystały ze spójnych typów.

- `PaginationDetails`
- `PaginatedResponseDto<T>`
- **Nowe**: `PublicRecipeListItemDto`
  - `id: number`
  - `name: string`
  - `description: string | null`
  - `image_path: string | null`
  - `category: CategoryDto | null` (obiekt `{ id, name }`)
  - `tags: string[]` (nazwy tagów)
  - `author: ProfileDto` (obiekt `{ id, username }`)
  - `created_at: string`

### Uwaga dot. spójności typów
W projekcie występują dwa miejsca z definicją `PublicRecipeListItemDto`:
- `shared/contracts/types.ts` (kontrakt frontend-backend)
- `supabase/functions/public/public.service.ts` (lokalny DTO serwisu)

Należy je zaktualizować spójnie (dodanie `author`) lub docelowo wyrównać podejście (np. import wspólnych typów do Edge Functions, jeśli to jest przyjęty wzorzec w repo).

### Modele wejścia
Endpoint nie ma body. Wejściem są query parametry, dla których zalecane jest wprowadzenie typu (opcjonalnie):
- **Nowe**: `GetPublicRecipesQuery` (na potrzeby serwisu/handlera)
  - `page: number`
  - `limit: number`
  - `sortField: 'created_at' | 'name'`
  - `sortDirection: 'asc' | 'desc'`
  - `q?: string`

## 4. Szczegóły odpowiedzi
### Sukces
- Kod: **200 OK**
- Payload (zgodnie z API planem):

```json
{
  "data": [
    {
      "id": 1,
      "name": "Apple Pie",
      "description": "A classic dessert.",
      "image_path": "path/to/image.jpg",
      "category": { "id": 2, "name": "Dessert" },
      "tags": ["sweet", "baking"],
      "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
      "created_at": "2023-10-27T10:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

### Błędy
- `400 Bad Request`
  - nieprawidłowe query parametry (np. `page` <= 0, `limit` <= 0, nieobsługiwane `sort`)
  - `q` podane i krótsze niż 2 znaki
- `500 Internal Server Error`
  - błąd po stronie serwera (np. problem z konfiguracją Supabase env, błąd DB, błąd mapowania)

Uwaga: `401` i `404` nie są typowe dla listy publicznej, ale `404` może być zwracane przez router dla nieobsługiwanych ścieżek w funkcji `public`.

## 5. Przepływ danych
1. `index.ts` (funkcja `public`):
   - loguje request (method + url)
   - obsługuje CORS (OPTIONS)
   - deleguje request do `publicRouter(req)`
2. `public.handlers.ts`:
   - parsuje query parametry z URL
   - waliduje parametry przez Zod:
     - `page`, `limit` z domyślnymi wartościami
     - `sort` rozbijany na `field` i `direction` z allow-listą
     - `q`: trim + minLength(2) jeśli zdefiniowane
   - wywołuje `getPublicRecipes(client, options)`
   - mapuje wynik do `PaginatedResponseDto<PublicRecipeListItemDto>`
3. `public.service.ts`:
   - wykonuje zapytanie do bazy z gwarancją filtrów:
     - `visibility = 'PUBLIC'`
     - `deleted_at IS NULL` (zapewnione w `recipe_details` view, ale filtr można dodać defensywnie, jeśli będzie użyta tabela `recipes`)
   - oblicza paginację (`offset`, `limit`) i `count: 'exact'`
   - mapuje rekordy do DTO:
     - `category` budowane z `category_id` + `category_name`
     - `tags` mapowane do `string[]` poprzez ekstrakcję `name` z JSONB `tags`
     - `author`:
       - pobrać `user_id` (autor przepisu) z widoku `recipe_details` w pierwszym zapytaniu (projekcja musi zawierać `user_id`)
       - wykonać **drugie zapytanie** do `profiles` z użyciem `.in('id', uniqueUserIds)` (bulk fetch) i zmapować `user_id -> {id, username}`
       - złożyć DTO w pamięci bez N+1 zapytań

### Źródło danych
Zalecane: korzystać z widoku `public.recipe_details` (agreguje tags/kolekcje i unika N+1).

### Uwaga dot. uprawnień (krytyczne)
Z migracji `20251212130000_add_visibility_to_recipes.sql` wynika, że:
- `grant select on public.recipe_details to authenticated;`
- brak grantu dla `anon`

Dlatego istnieją dwie poprawne ścieżki implementacji:
- **A (zalecana dla MVP, bez zmian w DB)**: Edge Function używa klienta Supabase z **service role key** (bypass RLS) i sama wymusza filtry `visibility = 'PUBLIC'`.
- **B (bardziej „czyste” publicznie)**: dodać uprawnienia/polityki w DB tak, aby rola `anon` mogła wykonywać SELECT tylko dla `visibility='PUBLIC'` (i `deleted_at IS NULL`). Wtedy funkcja może używać anon key.

Plan poniżej zakłada wariant A (szybszy), z rekomendacją rozważenia wariantu B w przyszłości.

## 6. Względy bezpieczeństwa
- **Brak autoryzacji**: endpoint jest dostępny bez JWT.
- **Ochrona przed wyciekiem danych** (przy użyciu service role):
  - twardo wymusić `visibility='PUBLIC'`
  - zwracać tylko pola z kontraktu (nie zwracać `user_id`, `updated_at`, `ingredients`, `steps`, itp.)
- **Walidacja sortowania**:
  - allow-lista pól i kierunków (zapobieganie wstrzyknięciom przez `order`)
- **Walidacja paginacji**:
  - `limit` z górnym limitem (np. max 100) by ograniczyć koszt
- **CORS**:
  - spójne nagłówki jak w innych funkcjach (`Access-Control-Allow-Origin: *`, tylko `GET, OPTIONS` dla tej funkcji)
- **Rate limiting / throttling** (opcjonalnie):
  - jeżeli endpoint ma być publicznie indeksowany, rozważyć prosty limit po IP na poziomie edge/proxy lub Supabase, aby ograniczyć scraping

## 7. Obsługa błędów
### Scenariusze i kody
- `200 OK`:
  - poprawna odpowiedź z listą (także gdy `data` jest puste)
- `400 Bad Request`:
  - `q` podane i `trim(q).length < 2`
  - nieprawidłowe formaty `page/limit/sort` (lub parametry spoza zakresu)
- `404 Not Found`:
  - brak dopasowania routingu wewnątrz funkcji `public` (np. `/public/anything-else`)
- `500 Internal Server Error`:
  - błąd konfiguracji (brak `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`)
  - błąd zapytania do bazy

### Rejestrowanie błędów
- W projekcie nie ma obecnie zdefiniowanej tabeli „error logs” w DB planie/migracjach.
- Stosować istniejący `logger` oraz spójny `ApplicationError`/`handleError` z `supabase/functions/_shared/errors.ts`.
- (Opcjonalnie przyszłościowo) dodać tabelę `api_error_logs` i zapisywać wybrane błędy 5xx/4xx o wysokiej wartości diagnostycznej.

## 8. Rozważania dotyczące wydajności
- **Źródło danych**: widok `recipe_details` (agregacje po stronie DB).
- **Dodatkowe pobranie autora**:
  - zalecane są **2 zapytania**: (1) lista przepisów z `user_id`, (2) lista profili dla unikalnych `user_id`
  - unikać N+1 (pobierania profilu osobno dla każdego przepisu)
- **Paginacja + count**:
  - `count: 'exact'` jest kosztowny dla dużych tabel; dla MVP OK.
  - w przyszłości rozważyć `estimated count` lub osobny licznik / „seek pagination”.
- **Wyszukiwanie**:
  - preferować `search_vector` (GIN) zamiast `ILIKE` na dużych danych.
  - wymaganie „q szuka po name, ingredients, tags” może wymagać dopracowania w SQL.

### Zalecana strategia wyszukiwania (MVP)
- Jeżeli istnieje `recipes.search_vector` obejmujący `name` + `ingredients`:
  - użyć `textSearch('search_vector', q, { type: 'websearch' })` (lub SQL RPC)
- Dla tagów:
  - zalecane: dodać **RPC** `search_public_recipes(...)` agregujące tagi do tekstu wyszukiwania albo wykonujące JOIN na `tags` i filtr na `tags.name ILIKE`.
  - alternatywa (mniej elegancka): filtrować po `tags` JSONB przez cast do tekstu (wymaga weryfikacji możliwości PostgREST i wpływu na wydajność).

## 9. Kroki implementacji
1. **Zweryfikować istniejące miejsce routingu**:
   - endpoint jest już routowany w Edge Function `supabase/functions/public/` pod ścieżką runtime `/functions/v1/public/recipes`.
   - zmiana dotyczy kontraktu odpowiedzi oraz mapowania danych (dodanie `author` w listingu).

2. **Dodać klienta DB dla endpointów publicznych**:
   - dodać w `supabase/functions/_shared/supabase-client.ts` helper `createServiceRoleClient()` (lub lokalnie w `public.service.ts`).
   - wymagane env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

3. **Routing** (`public.handlers.ts`):
   - obsłużyć ścieżkę `/recipes` i metodę `GET`.
   - dla pozostałych: `404` lub `405` z nagłówkiem `Allow`.

4. **Walidacja query parametrów** (Zod):
   - `page`: string -> int, domyślnie 1, min 1.
   - `limit`: string -> int, domyślnie 20, min 1, max 100.
   - `sort`: parse `{field}.{dir}`, allow-list.
   - `q`: trim; jeśli zdefiniowane i < 2 -> `ApplicationError('VALIDATION_ERROR', 'Query must be at least 2 characters')`.

5. **Implementacja serwisu** (`public.service.ts`):
   - zapytanie do `recipe_details` z filtrami:
     - `.eq('visibility', 'PUBLIC')`
     - (opcjonalnie defensywnie) `.is('deleted_at', null)` jeśli wybierane z `recipes`.
   - projekcja pól:
     - dodać `user_id` do select, aby zbudować `author` w DTO
     - docelowo: `id, user_id, name, description, image_path, category_id, category_name, tags, created_at`.
   - paginacja: `.range(offset, offset+limit-1)` + `{ count: 'exact' }`.
   - sort: `.order(field, { ascending })`.

6. **Pobranie authorów (bulk)**:
   - z wyników listy zebrać `uniqueUserIds` (np. `new Set(data.map(x => x.user_id))`)
   - wykonać zapytanie do `profiles`:
     - select: `id, username`
     - filter: `.in('id', uniqueUserIds)`
   - zbudować mapę `profilesById`
   - podczas mapowania listy do DTO dołączyć `author: profilesById[user_id]`
   - obsłużyć brak profilu (anomalia): zalecane traktować jako `500`, bo kontrakt wymaga `author`

7. **Wyszukiwanie**:
   - dodać filtr po `q`:
     - wariant MVP szybki: `textSearch` po `search_vector` (name+ingredients)
     - oraz (aby spełnić spec): dodać/wykorzystać RPC wyszukujące także po tagach.

8. **Mapowanie do DTO**:
   - `category`: `{ id: category_id, name: category_name }` lub `null`.
   - `tags`: z JSONB `tags` wyciągnąć tylko `name` i zwrócić `string[]`.
   - `author`: `{ id: user_id, username }` (z tabeli `profiles`)

9. **Aktualizacja kontraktów typów**:
   - zaktualizować `shared/contracts/types.ts` (`PublicRecipeListItemDto`) dodając `author: ProfileDto`
   - zaktualizować `supabase/functions/public/public.service.ts` lokalny `PublicRecipeListItemDto` analogicznie (jeśli utrzymujemy lokalne DTO)
   - upewnić się, że payload jest zgodny z API planem i wykorzystywanym frontendem

10. **CORS i response headers**:
   - jak w innych funkcjach: wspólne `corsHeaders` w `index.ts`.
   - rozważyć `Cache-Control: public, max-age=60` (opcjonalnie, zależnie od wymagań świeżości danych).

11. **Aktualizacja typów DB** (ważne dla spójności):
   - `supabase/functions/_shared/database.types.ts` jest kopią i może być niezsynchronizowana; po implementacji public recipes i po migracjach `visibility`/`image_path` należy zaktualizować/generować typy (aby `recipe_details.visibility` i `recipes.visibility` były obecne w typach).

12. **Testy (minimum)**:
   - `GET /public/recipes` bez parametrów => `200`, domyślna paginacja.
   - `GET /public/recipes?q=a` => `400`.
   - `GET /public/recipes?q=ap` => `200`.
   - w danych testowych upewnić się, że:
     - `PRIVATE/SHARED` nie pojawiają się w wynikach
     - rekordy z `deleted_at != null` nie pojawiają się w wynikach
     - sortowanie działa dla `created_at` i `name`.
     - **author** jest obecny dla każdego elementu listy (`author.id`, `author.username`)
