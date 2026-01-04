## API Endpoints Implementation Plan: Flaga „Grill” (`is_grill`)

### 1. Przegląd punktu końcowego

Ten plan opisuje wdrożenie zmiany kontraktu REST API polegającej na dodaniu **opcjonalnej flagi klasyfikacyjnej** `is_grill` dla przepisów oraz dodaniu filtra listującego `filter[grill]` (boolean) dla odpowiednich endpointów.

Zakres zmian dotyczy endpointów:

- **Public (JWT opcjonalny)**:
    - `GET /public/recipes` (dodanie pola `is_grill` + filtr `filter[grill]`)
    - `GET /public/recipes/feed` (dodanie pola `is_grill` + filtr `filter[grill]`)
    - `GET /public/recipes/{id}` (dodanie pola `is_grill` w odpowiedzi)
- **Private (wymaga JWT)**:
    - `GET /recipes` (dodanie pola `is_grill` + filtr `filter[grill]`)
    - `GET /recipes/feed` (dodanie pola `is_grill` + filtr `filter[grill]`)
    - `POST /recipes` (request wspiera `is_grill`, response zwraca `is_grill`)
    - `POST /recipes/import` (response zwraca `is_grill`, domyślnie `false`)
    - `PUT /recipes/{id}` (request wspiera `is_grill`)
- **AI (wymaga JWT + gating premium/admin)**:
    - `POST /ai/recipes/image` (request wspiera przekazanie `recipe.is_grill` dla spójności kontraktu wejściowego)

Założenia biznesowe:

- `recipes.is_grill` to **boolean** z domyślną wartością `false`.
- Flaga jest częścią danych przepisu (persistowana w DB) i działa w filtrach list.
- Publiczne endpointy nadal respektują reguły widoczności (`visibility`) i soft delete (`deleted_at IS NULL`).

### 2. Szczegóły żądania

#### 2.1 `GET /public/recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes` (w Supabase: `/functions/v1/public/recipes`)
- **Wymagane parametry**: brak (JWT opcjonalny w `Authorization`)
- **Opcjonalne query (istniejące)**: `page`, `limit`, `sort`, `q`, `filter[termorobot]`, `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`
- **Nowe query (do dodania)**:
    - `filter[grill]` (boolean: `true` / `false`)

#### 2.2 `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/feed` (w Supabase: `/functions/v1/public/recipes/feed`)
- **Wymagane parametry**: brak (JWT opcjonalny)
- **Opcjonalne query (istniejące)**: `cursor`, `limit`, `sort`, `q`, `filter[termorobot]`, `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`
- **Nowe query (do dodania)**:
    - `filter[grill]` (boolean)

#### 2.3 `GET /public/recipes/{id}`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/{id}` (w Supabase: `/functions/v1/public/recipes/{id}`)
- **Wymagane parametry**:
    - `id` (path): dodatnia liczba całkowita
- **Opcjonalne**:
    - `Authorization: Bearer <JWT>` (opcjonalny; gdy obecny i poprawny, API dodaje pola pomocnicze jak `is_owner`, `in_my_plan`)
- **Request Body**: brak

#### 2.4 `GET /recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes` (w Supabase: `/functions/v1/recipes`)
- **Wymagane**:
    - JWT w `Authorization: Bearer <token>`
- **Opcjonalne query (istniejące)**: `page`, `limit`, `sort`, `view`, `filter[category_id]`, `filter[tags]`, `filter[termorobot]`, `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`, `search`
- **Nowe query (do dodania)**:
    - `filter[grill]` (boolean)

#### 2.5 `GET /recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes/feed` (w Supabase: `/functions/v1/recipes/feed`)
- **Wymagane**:
    - JWT w `Authorization`
- **Opcjonalne query (istniejące)**: `cursor`, `limit`, `sort`, `view`, `filter[category_id]`, `filter[tags]`, `filter[termorobot]`, `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`, `search`
- **Nowe query (do dodania)**:
    - `filter[grill]` (boolean)

#### 2.6 `POST /recipes`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes` (w Supabase: `/functions/v1/recipes`)
- **Wymagane**:
    - JWT w `Authorization`
    - body JSON
- **Request Body (istniejące + nowe)**:
    - jak w obecnym kontrakcie `CreateRecipeCommand`
    - **NOWE**:
        - `is_grill?: boolean` (opcjonalne; jeśli nie wysłane → backend ustawia `false`)

#### 2.7 `POST /recipes/import`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes/import` (w Supabase: `/functions/v1/recipes/import`)
- **Wymagane**:
    - JWT w `Authorization`
    - body JSON: `{ raw_text: string }`
- **Zmiana**: brak zmian w body; zmiana dotyczy **odpowiedzi** (sekcja 4)

#### 2.8 `PUT /recipes/{id}`

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/recipes/{id}` (w Supabase: `/functions/v1/recipes/{id}`)
- **Wymagane**:
    - `id` w path (dodatnia liczba całkowita)
    - JWT w `Authorization`
    - body JSON (min. 1 pole)
- **Request Body (istniejące + nowe)**:
    - jak w `UpdateRecipeCommand` (wszystko opcjonalne)
    - **NOWE**:
        - `is_grill?: boolean` (opcjonalne; jeśli wysłane, aktualizuje wartość)

#### 2.9 `POST /ai/recipes/image`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/ai/recipes/image` (w Supabase: `/functions/v1/ai/recipes/image`)
- **Wymagane**:
    - JWT w `Authorization`
    - `app_role` w JWT: `premium` lub `admin` (w przeciwnym razie `403` – zgodnie z planem API)
    - body JSON wg kontraktu `AiRecipeImageRequestDto`
- **Zmiana**:
    - `recipe.is_grill?: boolean` w `AiRecipeImageRecipeDto` (opcjonalne, default `false` po stronie backendu jeśli brak)

### 3. Wykorzystywane typy

#### 3.1 Kontrakt (frontend/shared) – `shared/contracts/types.ts`

Do aktualizacji:

- **DTO list/szczegółów**:
    - `RecipeListItemDto`: dodać `is_grill: boolean`
    - `RecipeDetailDto`: dodać `is_grill: boolean`
    - `PublicRecipeListItemDto`: dodać `is_grill: boolean`
    - `PublicRecipeDetailDto`: dodać `is_grill: boolean`
- **Command modele**:
    - `CreateRecipeCommand`: dodać `is_grill?: boolean`
    - `UpdateRecipeCommand`: dodać `is_grill?: boolean` (dziedziczy przez `Partial`, ale pole musi istnieć w bazowym command)
- **AI**:
    - `AiRecipeImageRecipeDto`: dodać `is_grill?: boolean` (dla spójności kontraktu danych wejściowych)

#### 3.2 Backend – Edge Functions (Supabase)

Zgodnie z zasadami modularnymi:

- `supabase/functions/recipes/index.ts`:
    - routing + top-level error handling (bez logiki DB)
- `supabase/functions/recipes/recipes.handlers.ts`:
    - walidacja Zod:
        - body: `is_grill` jako `z.boolean().optional().default(false)` (dla `POST`)
        - body: `is_grill` jako `z.boolean().optional()` (dla `PUT`)
        - query: `filter[grill]` jako boolean (opcjonalny) dla list
- `supabase/functions/recipes/recipes.service.ts`:
    - przekazanie `is_grill` do create/update RPC
    - dopięcie filtra `is_grill` do opcji list oraz do `filtersHash` (dla feed)
- `supabase/functions/public/public.handlers.ts`:
    - walidacja query `filter[grill]` (opcjonalny boolean)
- `supabase/functions/public/public.service.ts`:
    - dopięcie filtra `is_grill` do zapytań list/feed
    - dopięcie `is_grill` do selektów i mappingu DTO
    - dopięcie `is_grill` do `getPublicRecipeById`
- `supabase/functions/ai/*`:
    - walidacja requestu: `recipe.is_grill` opcjonalny boolean
    - uwzględnienie `is_grill` w budowie promptu / kontekstu (np. sugestie stylu dania)

#### 3.3 Baza danych / typy generowane

Wymagane rozszerzenia w DB:

- `public.recipes`: dodać kolumnę `is_grill boolean not null default false`
- `public.recipe_details` (widok): dodać pole `is_grill`
- RPC wykorzystywane przez backend:
    - listy: `get_recipes_list` – dodać parametr filtra `p_grill` (nullable boolean) + zwracane pole `is_grill`
    - create: `create_recipe_with_tags` – dodać parametr `p_is_grill` (boolean, default false)
    - update: `update_recipe_with_tags` – dodać parametr `p_is_grill` + (jeśli wzorzec projektu tego wymaga) flagę `p_update_is_grill` do rozróżnienia „nie wysłano” vs „ustaw”

Po migracjach:

- uruchomić `supabase gen types typescript` i zaktualizować:
    - `shared/types/database.types.ts`
    - `supabase/functions/_shared/database.types.ts`

### 4. Szczegóły odpowiedzi

#### 4.1 Sukces

- `GET /public/recipes` → `200 OK` + `PaginatedResponseDto<PublicRecipeListItemDto>` (z `is_grill`)
- `GET /public/recipes/feed` → `200 OK` + `CursorPaginatedResponseDto<PublicRecipeListItemDto>` (z `is_grill`)
- `GET /public/recipes/{id}` → `200 OK` + `PublicRecipeDetailDto` (z `is_grill`)
- `GET /recipes` → `200 OK` + `PaginatedResponseDto<RecipeListItemDto>` (z `is_grill`)
- `GET /recipes/feed` → `200 OK` + `CursorPaginatedResponseDto<RecipeListItemDto>` (z `is_grill`)
- `POST /recipes` → `201 Created` + `RecipeDetailDto` (z `is_grill`)
- `POST /recipes/import` → `201 Created` + obiekt przepisu (jak `POST /recipes`) z `is_grill=false` (domyślnie)
- `PUT /recipes/{id}` → `200 OK` + `RecipeDetailDto` (z `is_grill`)

#### 4.2 Błędy (minimalny wymagany zestaw + kody)

- **`400 Bad Request`**:
    - nieprawidłowe query (np. `filter[grill]=abc`)
    - nieprawidłowe body (złe typy)
- **`401 Unauthorized`**:
    - brak lub niepoprawny JWT dla endpointów private
    - public: token podany, ale niepoprawny (gdy klient dołącza `Authorization`)
- **`404 Not Found`**:
    - `GET /public/recipes/{id}`: brak publicznego przepisu / soft-deleted
    - `PUT /recipes/{id}`: brak przepisu lub brak dostępu (RLS / logika serwisu)
- **`500 Internal Server Error`**:
    - błąd DB/RPC, nieoczekiwany wyjątek

Uwaga: jeżeli w projekcie istnieje standard `ApplicationError` + mapowanie kodów na HTTP, należy trzymać się tej konwencji i zapewnić spójne payloady błędów.

### 5. Przepływ danych

#### 5.1 Listy private (`GET /recipes`, `GET /recipes/feed`)

1. `recipes/index.ts` routuje request do `recipesRouter`.
2. `recipes.handlers.ts`:
    - waliduje query, w tym `filter[grill]` jako boolean,
    - przekazuje opcje do `recipes.service.ts`.
3. `recipes.service.ts`:
    - dopina filtr `is_grill` do opcji wywołania RPC (np. `p_grill`),
    - w feed uwzględnia filtr w `filtersHash` (spójność kursora).
4. DB (RPC) filtruje po `recipes.is_grill` jeśli parametr nie jest `NULL`.
5. Serwis mapuje rekordy do DTO, zawsze zwracając `is_grill` jako boolean.

#### 5.2 Listy public (`GET /public/recipes`, `GET /public/recipes/feed`)

1. `public/index.ts` routuje request do `publicRouter`.
2. `public.handlers.ts`:
    - waliduje query (`filter[grill]` jako opcjonalny boolean),
    - opcjonalnie ustala `userId` z JWT (lub `null`).
3. `public.service.ts`:
    - buduje zapytanie do widoku `recipe_details` (service role),
    - egzekwuje reguły widoczności (anon: tylko `PUBLIC`; auth: `PUBLIC` + własne),
    - jeśli `filter[grill]` podany: dodaje warunek `.eq('is_grill', value)`,
    - mapuje wynik do DTO.

#### 5.3 Szczegóły public (`GET /public/recipes/{id}`)

1. Handler waliduje `id`.
2. Serwis pobiera rekord z `recipe_details` z warunkami:
    - `visibility='PUBLIC'`
    - `deleted_at IS NULL`
3. Serwis mapuje wynik do `PublicRecipeDetailDto`, w tym `is_grill`.

#### 5.4 Tworzenie/aktualizacja (`POST /recipes`, `PUT /recipes/{id}`, `POST /recipes/import`)

1. Handler waliduje body:
    - `POST /recipes`: `is_grill` opcjonalny, domyślnie `false` jeśli nie wysłany.
    - `PUT /recipes/{id}`: `is_grill` opcjonalny; jeśli wysłany, ma aktualizować wartość.
2. Serwis wywołuje odpowiednie RPC create/update, przekazując `is_grill`.
3. DB zapisuje `is_grill` w tabeli `recipes`.
4. Serwis zwraca DTO zawierające `is_grill`.

#### 5.5 AI image (`POST /ai/recipes/image`)

1. Handler waliduje JWT oraz `app_role` (`premium|admin`) i request body, w tym `recipe.is_grill`.
2. Serwis buduje prompt/kontekst na podstawie danych przepisu.
3. `is_grill=true` może wpłynąć na kontekst generacji (np. sugerowanie potraw/grillowania), ale nie może naruszać „style contract” (np. brak ludzi/tekstu/watermarków).

### 6. Względy bezpieczeństwa

- **Walidacja wejścia (Zod)**:
    - `filter[grill]` musi być booleanem (akceptować tylko `true|false`, a nie dowolny string).
    - `is_grill` w body musi być booleanem.
- **RLS**:
    - private endpointy opierają się o RLS; update/create tylko dla zalogowanego.
- **Service role w public**:
    - public endpointy korzystają z service role, więc muszą **jawnie** egzekwować widoczność i soft delete w zapytaniu.
- **Cache i rozróżnienie anon/auth**:
    - odpowiedzi publiczne mogą się różnić (pola pomocnicze typu `is_owner`, `in_my_plan`), więc wymagane jest `Vary: Authorization` oraz odpowiednia polityka cache (zgodnie z istniejącym standardem projektu).
- **Cursor consistency (feed)**:
    - filtr `grill` musi być elementem „podpisu filtrów” (hash), żeby nie dało się użyć kursora z innego zestawu filtrów.

### 7. Obsługa błędów

Scenariusze minimalne:

- **`400`**:
    - `filter[grill]` nie jest booleanem (np. `abc`)
    - body: `is_grill` ma zły typ
    - feed: niepoprawny `cursor` lub niespójny z `filter[grill]`
- **`401`**:
    - private: brak/niepoprawny JWT
    - public: klient podał `Authorization`, ale token jest niepoprawny
- **`404`**:
    - `GET /public/recipes/{id}`: brak przepisu spełniającego warunki
    - `PUT /recipes/{id}`: brak zasobu / brak dostępu
- **`500`**:
    - błąd RPC / DB (np. brak kolumny po niedokończonej migracji), nieobsłużony wyjątek

Rejestrowanie błędów w tabeli:

- W obecnym schemacie brak tabeli błędów: **nie dotyczy** (diagnostyka przez logi + ustandaryzowane odpowiedzi błędów).

### 8. Wydajność

- Filtr boolean `is_grill` jest tani (warunek `WHERE is_grill = true/false`) i nie powinien być wąskim gardłem w MVP.
- Jeśli telemetry pokaże potrzebę, można rozważyć indeks B-tree na `recipes(is_grill)` lub indeks złożony z najczęściej używanymi filtrami, ale nie jest to wymagane na start.
- Publiczne listy powinny nadal korzystać z widoku `recipe_details` (minimalizacja joinów/N+1).
- Cursor-based feed: uwzględnienie `filter[grill]` w hash’u filtrów zapobiega kosztownym błędom spójności i nieprzewidywalnym stronicowaniom.

Kroki implementacji (checklista):

1. **Migracje DB**:
    - dodać `recipes.is_grill boolean not null default false`
    - rozszerzyć widok `recipe_details` o `is_grill`
    - rozszerzyć RPC listujące (`get_recipes_list`) o parametr `p_grill` + zwracane pole `is_grill`
    - rozszerzyć RPC create/update o `is_grill` (i ewentualnie flagę update)
2. **Regeneracja typów Supabase**:
    - `supabase gen types typescript` i aktualizacja typów w backend/frontend
3. **Aktualizacja kontraktu shared** (`shared/contracts/types.ts`):
    - dodać `is_grill` do DTO
    - dodać `is_grill` do `CreateRecipeCommand` / `UpdateRecipeCommand`
    - dodać `is_grill` do `AiRecipeImageRecipeDto`
4. **Edge Function `recipes` (private)**:
    - walidacja Zod dla `is_grill` w POST/PUT
    - walidacja query dla `filter[grill]` w listach
    - dopięcie `is_grill` do RPC i mappingu
    - dopięcie `filter[grill]` do `filtersHash` (feed)
5. **Edge Function `public` (public)**:
    - walidacja query dla `filter[grill]`
    - dopięcie `is_grill` do selektów, mappingu, `getPublicRecipeById`
    - dopięcie filtra do list i feed
    - dopięcie `filter[grill]` do `filtersHash` (feed)
6. **Edge Function `ai`**:
    - rozszerzyć walidację requestu o `recipe.is_grill`
    - uwzględnić `is_grill` w budowie promptu (bez naruszania style contract)
7. **Weryfikacja kontraktowa (manual)**:
    - `POST /recipes` bez `is_grill` → `is_grill=false` w odpowiedzi
    - `POST /recipes` z `is_grill=true` → `is_grill=true` w odpowiedzi
    - `PUT /recipes/{id}` toggle `is_grill` → stan utrwalony
    - listy private/public: `filter[grill]=true/false` działa i nie miesza się z kursorem feed


