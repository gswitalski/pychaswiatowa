## API Endpoints Implementation Plan: Klasyfikacja przepisów (diet_type / cuisine / difficulty) + filtry listujące

### 1. Przegląd punktu końcowego

Ten plan opisuje wdrożenie zmian kontraktu REST API związanych z dodaniem **opcjonalnych pól klasyfikacyjnych** do przepisów oraz **„API-ready” filtrów** dla endpointów listujących.

Zakres zmian dotyczy endpointów:

- **Private (wymaga JWT)**:
    - `GET /recipes`
    - `GET /recipes/feed`
    - `POST /recipes`
    - `PUT /recipes/{id}`
- **Public (JWT opcjonalny)**:
    - `GET /public/recipes`
    - `GET /public/recipes/feed`
    - (pośrednio) `GET /public/recipes/{id}` – rozszerzenie odpowiedzi o nowe pola

Zmiana kontraktu:

- **Nowe pola w obiektach Recipe w odpowiedziach** (listy + szczegóły):
    - `diet_type`: `MEAT | VEGETARIAN | VEGAN` (nullable)
    - `cuisine`: `POLISH | ASIAN | MEXICAN | MIDDLE_EASTERN` (nullable)
    - `difficulty`: `EASY | MEDIUM | HARD` (nullable)
- **`POST /recipes`**: body rozszerzone o `diet_type`, `cuisine`, `difficulty` (opcjonalne).
- **`PUT /recipes/{id}`**: body rozszerzone o `diet_type`, `cuisine`, `difficulty` (opcjonalne; możliwość czyszczenia do `null`).
- **Endpointy listujące**: dodane filtry:
    - `filter[diet_type]`
    - `filter[cuisine]`
    - `filter[difficulty]`

Kontekst repozytorium (stan obecny):

- Istnieją Edge Functions:
    - `supabase/functions/recipes/*` (private)
    - `supabase/functions/public/*` (public)
- Listy private są realizowane przez RPC `get_recipes_list` (`recipes.service.ts`).
- Listy publiczne korzystają z widoku `recipe_details` (service role) (`public.service.ts`).
- Wygenerowane typy DB używane są w 2 miejscach:
    - `shared/types/database.types.ts` (frontend/shared)
    - `supabase/functions/_shared/database.types.ts` (backend)

### 2. Szczegóły żądania

#### 2.1 `GET /recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes` (w Supabase: `/functions/v1/recipes`)
- **Wymagane parametry**:
    - brak (JWT wymagany w nagłówku)
- **Opcjonalne parametry query (istniejące)**:
    - `page` (int, default 1)
    - `limit` (int, default 20, max 100)
    - `sort` (string, np. `created_at.desc`, `name.asc`)
    - `view` (`owned | my_recipes`, default `owned`)
    - `filter[category_id]` (int)
    - `filter[tags]` (csv string -> lista)
    - `filter[termorobot]` (bool)
    - `search` (string)
- **Nowe parametry query (do dodania)**:
    - `filter[diet_type]` (`MEAT | VEGETARIAN | VEGAN`)
    - `filter[cuisine]` (`POLISH | ASIAN | MEXICAN | MIDDLE_EASTERN`)
    - `filter[difficulty]` (`EASY | MEDIUM | HARD`)

#### 2.2 `GET /recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes/feed` (w Supabase: `/functions/v1/recipes/feed`)
- **Wymagane parametry**:
    - brak (JWT wymagany w nagłówku)
- **Opcjonalne parametry query (istniejące)**:
    - `cursor` (string)
    - `limit` (int, default 12, max 100)
    - `sort` (`name|created_at|updated_at` + `.asc|.desc`, default `created_at.desc`)
    - `view` (`owned | my_recipes`, default `owned`)
    - `filter[category_id]` (int)
    - `filter[tags]` (csv)
    - `filter[termorobot]` (bool)
    - `search` (string)
- **Nowe parametry query (do dodania)**:
    - `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]` (jak wyżej)

#### 2.3 `POST /recipes`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes` (w Supabase: `/functions/v1/recipes`)
- **Wymagane**:
    - JWT w `Authorization: Bearer <token>`
    - body JSON
- **Request Body (istniejące + nowe)**:
    - `name` (string, wymagane, 1–150)
    - `description` (string|null, opcjonalne)
    - `category_id` (number|null, opcjonalne)
    - `ingredients_raw` (string, wymagane)
    - `steps_raw` (string, wymagane)
    - `tags` (string[], opcjonalne, default [])
    - `visibility` (`PRIVATE|SHARED|PUBLIC`, wymagane)
    - `servings` (number|null, opcjonalne)
    - `is_termorobot` (boolean, opcjonalne, default false)
    - `prep_time_minutes` (number|null, opcjonalne)
    - `total_time_minutes` (number|null, opcjonalne; jeśli oba ustawione, >= prep)
    - **NOWE**:
        - `diet_type` (`MEAT|VEGETARIAN|VEGAN`, opcjonalne, nullable)
        - `cuisine` (`POLISH|ASIAN|MEXICAN|MIDDLE_EASTERN`, opcjonalne, nullable)
        - `difficulty` (`EASY|MEDIUM|HARD`, opcjonalne, nullable)

#### 2.4 `PUT /recipes/{id}`

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/recipes/{id}` (w Supabase: `/functions/v1/recipes/{id}`)
- **Wymagane**:
    - `id` w path (dodatnia liczba całkowita)
    - JWT w `Authorization`
    - body JSON (min. 1 pole)
- **Request Body**:
    - wszystko jak w `POST /recipes`, ale **opcjonalne** (jak obecnie)
    - **NOWE**: `diet_type`, `cuisine`, `difficulty` (opcjonalne, z możliwością ustawienia `null` w celu wyczyszczenia)

#### 2.5 `GET /public/recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes` (w Supabase: `/functions/v1/public/recipes`)
- **Wymagane parametry**: brak (JWT opcjonalny)
- **Opcjonalne query (istniejące)**:
    - `page`, `limit`, `sort`, `q`, `filter[termorobot]`
- **Nowe query (do dodania)**:
    - `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]` (jak wyżej)

#### 2.6 `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/feed` (w Supabase: `/functions/v1/public/recipes/feed`)
- **Wymagane parametry**: brak (JWT opcjonalny)
- **Opcjonalne query (istniejące)**:
    - `cursor`, `limit`, `sort`, `q`, `filter[termorobot]`
- **Nowe query (do dodania)**:
    - `filter[diet_type]`, `filter[cuisine]`, `filter[difficulty]`

### 3. Wykorzystywane typy

#### 3.1 Kontrakt (frontend/shared) – `shared/contracts/types.ts`

Do aktualizacji / dodania:

- **Nowe typy enum** (kontrakt API, niezależne od DB enums):
    - `RecipeDietType = 'MEAT' | 'VEGETARIAN' | 'VEGAN'`
    - `RecipeCuisine = 'POLISH' | 'ASIAN' | 'MEXICAN' | 'MIDDLE_EASTERN'`
    - `RecipeDifficulty = 'EASY' | 'MEDIUM' | 'HARD'`
- Aktualizacja DTO:
    - `RecipeListItemDto`: dodać `diet_type`, `cuisine`, `difficulty` (nullable)
    - `RecipeDetailDto`: dodać `diet_type`, `cuisine`, `difficulty` (nullable)
    - `PublicRecipeListItemDto`: dodać `diet_type`, `cuisine`, `difficulty` (nullable)
    - `PublicRecipeDetailDto`: dodać `diet_type`, `cuisine`, `difficulty` (nullable)
- Aktualizacja Command modeli:
    - `CreateRecipeCommand`: dodać opcjonalne `diet_type?`, `cuisine?`, `difficulty?` (nullable)
    - `UpdateRecipeCommand`: odziedziczy przez `Partial<>` – upewnić się, że pola wspierają `null` (czyszczenie)

#### 3.2 Backend – Edge Functions

- `supabase/functions/recipes/recipes.handlers.ts`
    - rozszerzenie Zod schematów `createRecipeSchema` i `updateRecipeSchema`
    - rozszerzenie query schema: `getRecipesQuerySchema`, `getRecipesFeedQuerySchema`
- `supabase/functions/recipes/recipes.service.ts`
    - rozszerzenie DTO i mappingu (list + detail)
    - rozszerzenie `GetRecipesOptions` oraz `GetRecipesFeedOptions` o nowe filtry
    - przekazanie filtrów do RPC `get_recipes_list`
    - dopięcie pól do RPC create/update
- `supabase/functions/public/public.types.ts`
    - rozszerzenie `GetPublicRecipesQuery` i `GetPublicRecipesFeedQuery` o nowe filtry
- `supabase/functions/public/public.handlers.ts`
    - rozszerzenie Zod schematów query o nowe filtry
- `supabase/functions/public/public.service.ts`
    - dopięcie pól do selektów z `recipe_details`
    - dopięcie filtrów do zapytań list i feed
    - dopięcie pól do mappingu DTO

#### 3.3 Baza danych / typy generowane

Wymagane rozszerzenia w DB (ponieważ `diet_type/cuisine/difficulty` nie występują w obecnych typach DB):

- `public.recipes`: dodać kolumny (nullable)
- `public.recipe_details`: dodać pola do widoku
- `public.get_recipes_list`: dodać zwracane pola + parametry filtrów
- `public.create_recipe_with_tags`: dodać parametry wejściowe
- `public.update_recipe_with_tags`: dodać parametry wejściowe + flagi update (żeby rozróżnić „nie wysłano” vs „ustaw null”)

Po migracjach:

- uruchomić `supabase gen types typescript` i zaktualizować:
    - `shared/types/database.types.ts`
    - `supabase/functions/_shared/database.types.ts`

### 4. Szczegóły odpowiedzi

#### 4.1 Sukces

- `GET /recipes` → `200 OK` + `PaginatedResponseDto<RecipeListItemDto>`
- `GET /recipes/feed` → `200 OK` + `CursorPaginatedResponseDto<RecipeListItemDto>`
- `POST /recipes` → `201 Created` + `RecipeDetailDto`
- `PUT /recipes/{id}` → `200 OK` + `RecipeDetailDto`
- `GET /public/recipes` → `200 OK` + `PaginatedResponseDto<PublicRecipeListItemDto>`
- `GET /public/recipes/feed` → `200 OK` + `CursorPaginatedResponseDto<PublicRecipeListItemDto>`

Wszystkie powyższe odpowiedzi muszą zawierać nowe pola:

- `diet_type: RecipeDietType | null`
- `cuisine: RecipeCuisine | null`
- `difficulty: RecipeDifficulty | null`

#### 4.2 Błędy (minimalny wymagany zestaw)

Zachować obowiązujące zasady kodów statusu:

- **`400 Bad Request`**:
    - nieprawidłowe parametry query (np. `filter[diet_type]=XYZ`)
    - nieprawidłowe body (złe typy, przekroczenia limitów, `total_time_minutes < prep_time_minutes`)
- **`401 Unauthorized`**:
    - brak JWT dla endpointów private (`/recipes*`, `POST/PUT`)
    - JWT obecny, ale niepoprawny
- **`404 Not Found`**:
    - `PUT /recipes/{id}` gdy przepis nie istnieje / brak dostępu
- **`500 Internal Server Error`**:
    - błędy DB/RPC, nieobsłużone wyjątki

Uwaga: projekt używa `_shared/errors.ts` (kody logiczne `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `INTERNAL_ERROR`) mapowane na HTTP.

### 5. Przepływ danych

#### 5.1 Private listy (`GET /recipes`, `GET /recipes/feed`)

1. `recipes.index.ts` → `recipesRouter`.
2. `recipes.handlers.ts`:
    - `getRecipesQuerySchema` / `getRecipesFeedQuerySchema` walidują query, w tym **nowe filtry**.
    - handler przekazuje filtry do `recipes.service.ts`.
3. `recipes.service.ts`:
    - buduje `filtersHash` dla kursora (feed) – musi uwzględniać nowe filtry.
    - wywołuje RPC `get_recipes_list` z nowymi parametrami filtrów.
4. DB (RPC) filtruje wyniki, zwraca pola listy (w tym nowe pola).
5. Serwis mapuje rekordy do DTO (w tym `diet_type`, `cuisine`, `difficulty`).

#### 5.2 Public listy (`GET /public/recipes`, `GET /public/recipes/feed`)

1. `public.index.ts` → `publicRouter`.
2. `public.handlers.ts`:
    - waliduje query (Zod) + opcjonalnie ustala `userId` z JWT (lub `null`).
    - przekazuje filtry do `public.service.ts`.
3. `public.service.ts`:
    - buduje zapytanie do `recipe_details` (service role),
    - stosuje reguły widoczności:
        - anon: tylko `visibility='PUBLIC'`
        - auth: `visibility='PUBLIC' OR user_id=userId`
    - stosuje nowe filtry jako dodatkowe `AND` (dla obu wariantów),
    - mapuje do DTO i zwraca `in_my_plan`, `in_my_collections` tylko gdy auth.

#### 5.3 Tworzenie i aktualizacja (`POST /recipes`, `PUT /recipes/{id}`)

1. `recipes.handlers.ts` waliduje body (Zod):
    - nowe pola jako enumy lub `null`.
2. `recipes.service.ts`:
    - `createRecipe` → RPC `create_recipe_with_tags` z nowymi parametrami
    - `updateRecipe` → RPC `update_recipe_with_tags` + flagi `p_update_*` dla pól, aby wspierać czyszczenie.
3. DB aktualizuje `recipes` i odświeża widok `recipe_details` (zależnie od definicji widoku).
4. Serwis zwraca `RecipeDetailDto` zawierające nowe pola.

### 6. Względy bezpieczeństwa

- **Walidacja wejścia (Zod)**:
    - `filter[diet_type]` tylko z listy dozwolonej → brak możliwości wstrzyknięć w DB.
    - analogicznie `cuisine` i `difficulty`.
- **RLS + service role**:
    - Private endpoints korzystają z klienta „user-context” (RLS) + RPC.
    - Public endpoints używają `service role`, więc muszą samodzielnie egzekwować reguły widoczności (już jest).
- **Ochrona cache dla public**:
    - odpowiedzi publiczne różnią się dla anon vs auth (np. `in_my_plan`), więc konieczne jest `Vary: Authorization` oraz `Cache-Control` (repo już to robi).
    - nowe filtry nie zmieniają tej zasady – ale muszą wejść do `filtersHash` kursora dla feed, żeby nie dało się mieszać kursorów między różnymi filtrami.

### 7. Obsługa błędów

#### 7.1 Scenariusze błędów – listy (private/public)

- `400`:
    - `filter[diet_type]` spoza enum → `VALIDATION_ERROR`
    - `filter[cuisine]` spoza enum → `VALIDATION_ERROR`
    - `filter[difficulty]` spoza enum → `VALIDATION_ERROR`
    - feed: niepoprawny `cursor` / niespójny z filtrami (cursor consistency) → `VALIDATION_ERROR`
- `401`:
    - brak/niepoprawny JWT dla private
    - public: token obecny, ale niepoprawny (obecna zasada: rzucamy błąd, nie „spadamy” do anon)
- `500`:
    - błąd DB (złe parametry RPC, niezsynchronizowane migracje, błędy widoku)

#### 7.2 Scenariusze błędów – POST/PUT

- `400`:
    - `diet_type/cuisine/difficulty` nie w enum
    - niezgodność czasów (`total_time_minutes < prep_time_minutes`)
- `401`:
    - brak JWT
- `404`:
    - `PUT /recipes/{id}` → przepis nie istnieje / nie należy do użytkownika
- `500`:
    - błąd RPC / DB

#### 7.3 Rejestrowanie błędów w tabeli

- W obecnym schemacie brak tabeli błędów: **nie dotyczy**.
- Diagnostyka: logi strukturalne (`_shared/logger.ts`) + ustandaryzowane odpowiedzi (`_shared/errors.ts`).

### 8. Wydajność

- **Listy private** (RPC `get_recipes_list`):
    - nowe filtry powinny być realizowane w DB (WHERE) i wspierane indeksami, jeśli będą często używane.
    - rekomendacja: dodać indeksy B-tree na `recipes(diet_type)`, `recipes(cuisine)`, `recipes(difficulty)` jeśli telemetry pokaże potrzebę.
- **Listy public** (widok `recipe_details`):
    - filtry po 3 polach powinny zejść do `recipes` w planie zapytania; przy dużej skali – analogicznie indeksy.
- **Cursor feed**:
    - nowe filtry muszą wejść do hasha filtrów, by uniknąć kosztownych „pomyłek” i błędów spójności.

### 9. Kroki implementacji

#### 9.1 Zmiany w bazie danych (migracje)

1. **Dodać kolumny do `public.recipes`** (nullable):
    - `diet_type text` + CHECK lub (rekomendowane) ENUM `recipe_diet_type`
    - `cuisine text` + CHECK lub ENUM `recipe_cuisine`
    - `difficulty text` + CHECK lub ENUM `recipe_difficulty`
2. **Zaktualizować widok `public.recipe_details`**:
    - dodać `diet_type`, `cuisine`, `difficulty` do SELECT-a widoku.
3. **Zaktualizować RPC `get_recipes_list`**:
    - dodać parametry opcjonalne:
        - `p_diet_type`, `p_cuisine`, `p_difficulty`
    - dodać warunki filtrujące (jeśli parametr != NULL).
    - dodać pola do zwracanej struktury.
4. **Zaktualizować RPC `create_recipe_with_tags`**:
    - dodać parametry wejściowe (nullable):
        - `p_diet_type`, `p_cuisine`, `p_difficulty`
    - ustawiać kolumny podczas insertu.
5. **Zaktualizować RPC `update_recipe_with_tags`**:
    - dodać parametry wejściowe (nullable) + flagi update:
        - `p_diet_type`, `p_update_diet_type`
        - `p_cuisine`, `p_update_cuisine`
        - `p_difficulty`, `p_update_difficulty`
    - zasada: jeśli `p_update_* = true`, to ustawiamy wartość (w tym `NULL`).
6. (Opcjonalnie) dodać indeksy wspierające filtry.

#### 9.2 Regeneracja typów

7. Uruchomić generowanie typów Supabase:
    - zaktualizować `shared/types/database.types.ts`
    - zaktualizować `supabase/functions/_shared/database.types.ts`
8. Zweryfikować spójność kompilacji TypeScript w frontend i backend.

#### 9.3 Zmiany w kontrakcie shared (frontend)

9. W `shared/contracts/types.ts`:
    - dodać typy enum `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`
    - dodać pola do DTO i Command modeli zgodnie z sekcją 3.1.
10. Upewnić się, że UI wysyła `null` dla „wyczyszczenia” (PUT) i pomija pola, gdy nie dotyczy.

#### 9.4 Zmiany w Edge Function `recipes` (private)

11. `supabase/functions/recipes/recipes.handlers.ts`:
    - rozszerzyć `createRecipeSchema` o:
        - `diet_type: z.enum([...]).nullable().optional().transform(...)`
        - `cuisine: z.enum([...]).nullable().optional().transform(...)`
        - `difficulty: z.enum([...]).nullable().optional().transform(...)`
    - rozszerzyć `updateRecipeSchema` analogicznie (opcjonalne + nullable).
    - rozszerzyć `getRecipesQuerySchema` i `getRecipesFeedQuerySchema` o nowe `filter[...]`.
12. `supabase/functions/recipes/recipes.service.ts`:
    - dodać pola do:
        - `RecipeListItemDto`, `RecipeDetailDto`
        - `RECIPE_LIST_SELECT_COLUMNS`, `RECIPE_DETAIL_SELECT_COLUMNS`
        - mappingów (list i detail)
    - rozszerzyć `GetRecipesOptions` i `GetRecipesFeedOptions` o nowe filtry
    - przekazać parametry do RPC `get_recipes_list`
    - w feed: dopiąć filtry do `buildFiltersHash(...)`
    - w create/update: przekazać nowe pola do RPC + flagi update.

#### 9.5 Zmiany w Edge Function `public`

13. `supabase/functions/public/public.types.ts`:
    - dodać opcjonalne:
        - `diet_type?: RecipeDietType`
        - `cuisine?: RecipeCuisine`
        - `difficulty?: RecipeDifficulty`
14. `supabase/functions/public/public.handlers.ts`:
    - rozszerzyć `GetPublicRecipesQuerySchema` i `GetPublicRecipesFeedQuerySchema` o nowe filtry.
15. `supabase/functions/public/public.service.ts`:
    - dodać pola do `RECIPE_SELECT_COLUMNS` i `RECIPE_DETAIL_SELECT_COLUMNS`
    - w `getPublicRecipes` i `getPublicRecipesFeed` dodać `.eq('diet_type', ...)`, `.eq('cuisine', ...)`, `.eq('difficulty', ...)` jeśli filtr podany
    - w feed: dopiąć filtry do `buildFiltersHash(...)`
    - zmapować pola do DTO
    - rozszerzyć `getPublicRecipeById` o nowe pola w DTO (detail).

#### 9.6 Testy i weryfikacja (manual + kontrakt)

16. Dodać/rozszerzyć pliki `test-requests.http` dla:
    - `supabase/functions/recipes/`
    - `supabase/functions/public/`
17. Scenariusze minimalne:
    - `POST /recipes` z każdym z pól osobno + kombinacje + `null`
    - `PUT /recipes/{id}`: ustaw wartości + wyczyść do `null` (weryfikacja, że wartości znikają)
    - `GET /recipes`/`feed`: filtrowanie po każdym polu (pojedynczo i w kombinacji)
    - `GET /public/recipes`/`feed`: anon + auth (w obu przypadkach filtry działają)
    - feed: kursor z innym zestawem filtrów → `400` (cursor consistency)


