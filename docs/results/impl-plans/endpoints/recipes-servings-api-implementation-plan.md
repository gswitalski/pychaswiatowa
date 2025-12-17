# API Endpoints Implementation Plan: `recipes.servings` (zmiana przekrojowa)

## 1. Przegląd punktu końcowego

Ta zmiana nie wprowadza nowego endpointu — rozszerza istniejące endpointy zasobu **Recipes** i **Public Recipes** o nowe pole **`servings`** (opcjonalne), zgodnie z API planem.

**Cel biznesowy:** umożliwić zapisywanie i prezentowanie informacji „na ile porcji jest przepis”.

**Zakres endpointów objętych zmianą:**
- `GET /public/recipes` – elementy listy zawierają `servings`.
- `GET /public/recipes/{id}` – szczegóły zawierają `servings`.
- `GET /recipes` – elementy listy zawierają `servings`.
- `POST /recipes` – request może zawierać `servings`; response zwraca `servings`.
- `POST /recipes/import` – response zawiera `servings` ustawione domyślnie na `null`.
- `PUT /recipes/{id}` – request może aktualizować `servings` (w tym ustawić `null`).

**Wymagania domenowe / DB:**
- Kolumna `recipes.servings` jest **opcjonalna** (`NULL` dozwolone).
- Walidacja: **integer 1–99** lub `null`.
- Soft delete: we wszystkich odczytach nadal obowiązuje `deleted_at IS NULL`.

**Wymagania wdrożeniowe (Supabase Edge Functions + TypeScript, zgodnie z `backend.mdc`):**
- `index.ts`: tylko routing, CORS, obsługa błędów na najwyższym poziomie.
- `*.handlers.ts`: walidacja wejścia (Zod), formatowanie odpowiedzi, logowanie.
- `*.service.ts`: logika biznesowa, wywołania DB/RPC, rzucanie `ApplicationError`.

## 2. Szczegóły żądania

### 2.1. `GET /public/recipes`
- **Metoda**: `GET`
- **URL**: `/public/recipes`
- **Query params**:
  - **Wymagane**: brak
  - **Opcjonalne**: `page`, `limit`, `sort`, `q` (bez zmian)
- **Body**: brak
- **Zmiana**: wyłącznie w odpowiedzi (dodanie `servings`).

### 2.2. `GET /public/recipes/{id}`
- **Metoda**: `GET`
- **URL**: `/public/recipes/{id}`
- **Path params**:
  - **Wymagane**: `id` (integer)
- **Body**: brak
- **Zmiana**: wyłącznie w odpowiedzi (dodanie `servings`).

### 2.3. `GET /recipes`
- **Metoda**: `GET`
- **URL**: `/recipes`
- **Auth**: wymagany JWT
- **Query params**: bez zmian (`page`, `limit`, `sort`, `view`, filtry, `search`)
- **Zmiana**: elementy listy zwracają `servings`.

### 2.4. `POST /recipes`
- **Metoda**: `POST`
- **URL**: `/recipes`
- **Auth**: wymagany JWT
- **Body (JSON)**:
  - **Wymagane**: `name`, `ingredients_raw`, `steps_raw`, `visibility` (wg API planu)
  - **Opcjonalne**: `description`, `category_id`, `tags`, **`servings`**
- **`servings`**:
  - dozwolone: `null` lub integer 1–99
  - gdy pominięte: traktowane jako `null`

### 2.5. `POST /recipes/import`
- **Metoda**: `POST`
- **URL**: `/recipes/import`
- **Auth**: wymagany JWT
- **Body (JSON)**: bez zmian (`raw_text`)
- **Zmiana**: response musi zawierać `servings: null`.

### 2.6. `PUT /recipes/{id}`
- **Metoda**: `PUT`
- **URL**: `/recipes/{id}`
- **Auth**: wymagany JWT
- **Path params**:
  - **Wymagane**: `id` (integer)
- **Body (JSON)**:
  - wszystkie pola opcjonalne (jak dotychczas)
  - **nowe pole**: `servings?: number | null`
  - musi być możliwe jawne ustawienie `servings: null` (wyczyszczenie wartości)

## 3. Wykorzystywane typy

### 3.1. DTO / kontrakty (wspólne)
Źródło prawdy dla kontraktów FE/BE: `shared/contracts/types.ts`.

**Typy do aktualizacji (dodanie `servings: number | null`):**
- `PublicRecipeListItemDto`
- `PublicRecipeDetailDto`
- `RecipeListItemDto`
- (zalecane) `RecipeDetailDto` – jeśli bazuje na `recipe_details`, powinien zawierać `servings` aby ujednolicić szczegóły (prywatne) i publiczne.

**Command modele do aktualizacji:**
- `CreateRecipeCommand`: dodać `servings?: number | null`
- `UpdateRecipeCommand`: dziedziczy z `CreateRecipeCommand`, więc automatycznie obejmie `servings` (ale walidacja musi dopuszczać `null`).

### 3.2. Typy w Edge Functions
W repo istnieją lokalne DTO w serwisach (`supabase/functions/recipes/recipes.service.ts`, `supabase/functions/public/public.service.ts`). Należy utrzymać spójność:
- dodać `servings` do lokalnych `RecipeListItemDto`, `RecipeDetailDto`, `PublicRecipeListItemDto`, `PublicRecipeDetailDto` (lub docelowo importować typy wspólne, jeśli to jest standard w projekcie).

### 3.3. Modele DB
- Tabela: `public.recipes.servings smallint null` z check constraint `servings IS NULL OR (servings BETWEEN 1 AND 99)`.
- Widok: `public.recipe_details` musi wystawiać `servings`.
- Funkcje RPC:
  - `public.create_recipe_with_tags(...)` – musi przyjmować `p_servings smallint default null` i insertować.
  - `public.update_recipe_with_tags(...)` – musi przyjmować `p_servings smallint default null` oraz flagę odróżniającą „nie podano” vs „ustaw na null” (patrz sekcja 9 — migracje).
  - `public.get_recipes_list(...)` – musi zwracać `servings` w tabeli wynikowej.

## 4. Szczegóły odpowiedzi

### 4.1. Sukces
- `GET /public/recipes`: **200 OK**, każdy element `data[]` ma `servings: number | null`.
- `GET /public/recipes/{id}`: **200 OK**, obiekt ma `servings: number | null`.
- `GET /recipes`: **200 OK**, każdy element `data[]` ma `servings: number | null`.
- `POST /recipes`: **201 Created**, zwraca pełny obiekt przepisu zawierający `servings`.
- `POST /recipes/import`: **201 Created**, zwraca pełny obiekt przepisu z `servings: null`.
- `PUT /recipes/{id}`: **200 OK**, zwraca pełny obiekt przepisu z aktualnym `servings`.

### 4.2. Błędy (kody zgodne z wymaganiami zadania)
- **400 Bad Request**:
  - `servings` nie jest liczbą całkowitą
  - `servings < 1` lub `servings > 99`
  - inne błędy walidacji requestu (jak dotychczas)
- **401 Unauthorized**:
  - brak/nieprawidłowy JWT dla endpointów prywatnych (`/recipes*`)
- **404 Not Found**:
  - `GET /public/recipes/{id}`: przepis nie istnieje / nie jest publiczny
  - `PUT /recipes/{id}`: przepis nie istnieje lub brak dostępu
- **500 Internal Server Error**:
  - błędy DB/RPC, błędna konfiguracja env, błędy mapowania

## 5. Przepływ danych

### 5.1. Warstwa DB
1. `recipes.servings` jako pojedyncze źródło wartości.
2. Widok `recipe_details` selekcjonuje `r.servings`.
3. RPC:
   - create: zapisuje `servings` w `insert into recipes`.
   - update: aktualizuje `servings` zgodnie z semantyką „opcjonalne, ale można wyczyścić”.
   - list: zwraca `servings` w wynikach do listingu.

### 5.2. Warstwa Edge Functions
- `public`:
  - `public.service.ts` selekcjonuje `servings` z `recipe_details` i mapuje do DTO.
- `recipes`:
  - `recipes.handlers.ts` waliduje `servings` w `POST` oraz `PUT`.
  - `recipes.service.ts`:
    - `CreateRecipeInput` i `UpdateRecipeInput` przyjmują `servings`.
    - mapowanie `RecipeDetailDto` i `RecipeListItemDto` uwzględnia `servings`.
    - `getRecipes()` korzysta z `get_recipes_list` (RPC) zwracającego `servings`.

## 6. Względy bezpieczeństwa
- **RLS**: pozostaje głównym mechanizmem ochrony danych użytkownika w prywatnych endpointach.
- **Public endpoints**: jeśli używany jest service role key (jak obecnie w `public.service.ts`), obowiązkowo wymuszać filtry:
  - `visibility = 'PUBLIC'`
  - `deleted_at IS NULL`
- **Walidacja wejścia**:
  - allow-listy dla sortowania (już istnieją w listach)
  - Zod dla `servings` (int, zakres, `nullable`, `optional`)
- **Minimalizacja danych**: w publicznych odpowiedziach nie zwracać pól wrażliwych (`user_id`, `deleted_at`, itp.) — `servings` nie jest wrażliwe.

## 7. Obsługa błędów
- Stosować istniejące mechanizmy: `ApplicationError` + wspólny handler w `supabase/functions/_shared/errors.ts`.
- Dla walidacji `servings` zwracać `400` z jednoznacznym komunikatem (np. „servings must be an integer between 1 and 99 or null”).
- **Rejestrowanie błędów do tabeli**: w DB planie brak tabeli „error logs”, więc **nie dotyczy** — logowanie przez `logger` (info/warn/error) jest wymagane.

## 8. Rozważania dotyczące wydajności
- `servings` to pojedyncza kolumna scalar — koszt pomijalny.
- Krytyczne jest utrzymanie wydajnego listingu:
  - `GET /recipes` nadal powinno bazować na RPC `get_recipes_list` (deduplikacja `my_recipes`, paginacja) i zwracać `servings` bez dodatkowych zapytań.
  - `GET /public/recipes` nadal powinno pobierać `servings` z `recipe_details` w jednym zapytaniu (plus istniejący bulk fetch profili).

## 9. Kroki implementacji

1. **Migracja DB: dodać kolumnę `servings` do `recipes`**
   - Utworzyć nowy plik w `supabase/migrations/` (np. `YYYYMMDDHHMMSS_add_servings_to_recipes.sql`).
   - W migracji:
     - `alter table public.recipes add column if not exists servings smallint;`
     - dodać constraint zgodny z wymaganiem: `check (servings is null or (servings >= 1 and servings <= 99))`.
   - Uwaga: ponieważ `create_recipes_table.sql` nie zawiera `servings`, migracja jest wymagana nawet jeśli DB Plan już ją opisuje.

2. **Migracja DB: zaktualizować `recipe_details` aby wystawiał `servings`**
   - W tej samej migracji lub kolejnej:
     - `drop view if exists public.recipe_details;`
     - odtworzyć view jak w `20251212130000_add_visibility_to_recipes.sql`, dodając `r.servings` do select.

3. **Migracja DB: zaktualizować `create_recipe_with_tags`**
   - Dodać parametr `p_servings smallint default null`.
   - W `insert into public.recipes (...)` dodać `servings`.

4. **Migracja DB: zaktualizować `update_recipe_with_tags` (obsługa „ustaw null”)**
   - Ponieważ `servings` jest nullable i w `PUT` chcemy móc wyczyścić wartość, potrzebna jest semantyka analogiczna do tagów/kategorii.
   - Zalecany wariant:
     - dodać parametry:
       - `p_servings smallint default null`
       - `p_update_servings boolean default false`
     - w `update public.recipes set ...`:
       - `servings = case when p_update_servings then p_servings else servings end`
   - To pozwala odróżnić:
     - brak pola w request → nie zmieniaj
     - `servings: null` → ustaw null
     - `servings: 6` → ustaw 6

5. **Migracja DB: zaktualizować `get_recipes_list` aby zwracał `servings`**
   - Wymaga zmiany typu zwracanego (TABLE), więc należy zastosować podejście jak w `20251216120000_add_category_to_get_recipes_list.sql`:
     - `drop function if exists public.get_recipes_list(...);`
     - utworzyć funkcję od nowa, dodając:
       - `servings` do `returns table (...)`
       - `r.servings` w CTE i finalnym SELECT.

6. **Aktualizacja Edge Functions: `supabase/functions/public/public.service.ts`**
   - Dodać `servings` do:
     - `RecipeDetailsRow`, `RecipeDetailFullRow`
     - selektów `RECIPE_SELECT_COLUMNS` i `RECIPE_DETAIL_SELECT_COLUMNS`
     - DTO: `PublicRecipeListItemDto`, `PublicRecipeDetailDto`
   - Upewnić się, że mapping zwraca `servings` i jest zgodny z kontraktem.

7. **Aktualizacja Edge Functions: `supabase/functions/recipes/recipes.service.ts`**
   - Dodać `servings` do:
     - `RecipeListItemDto`
     - `RecipeDetailDto`
     - `RECIPE_LIST_SELECT_COLUMNS` (jeśli nadal używane w innych miejscach) i `RECIPE_DETAIL_SELECT_COLUMNS` (dla `recipe_details`)
     - `CreateRecipeInput` i `UpdateRecipeInput`
   - Zaktualizować wywołania RPC:
     - `create_recipe_with_tags`: przekazać `p_servings`.
     - `update_recipe_with_tags`: przekazać `p_servings` i `p_update_servings`.
   - Zaktualizować mapping `getRecipes()` dla danych z `get_recipes_list`.

8. **Aktualizacja Edge Functions: walidacja Zod w handlerach**
   - `POST /recipes`:
     - schema: `servings: z.number().int().min(1).max(99).nullable().optional()`
   - `PUT /recipes/{id}`:
     - analogicznie; dodatkowo w warstwie handlera obliczyć flagę `updateServings` na podstawie obecności klucza w body (np. `'servings' in parsedBody`).

9. **Aktualizacja kontraktów FE/BE: `shared/contracts/types.ts`**
   - Dodać `servings` do wskazanych DTO i command modeli (sekcja 3).
   - Upewnić się, że typy odpowiadają API planowi: `number | null`.

10. **Regeneracja typów Supabase (jeśli stosowane w repo)**
   - Po migracjach zaktualizować generowane typy (`database.types.ts`) tak, aby zawierały `recipes.servings` i `recipe_details.servings`.

11. **Test plan (minimum manualny / integracyjny)**
   - `POST /recipes`:
     - bez `servings` → response `servings: null`
     - z `servings: 4` → response `servings: 4`
     - z `servings: 0` / `100` / `1.5` → `400`
   - `PUT /recipes/{id}`:
     - `servings: 6` → aktualizacja
     - `servings: null` → wyczyszczenie
     - bez `servings` → brak zmiany
   - `GET /recipes` i `GET /public/recipes` → `servings` obecny na elementach listy
   - `GET /public/recipes/{id}` → `servings` obecny w szczegółach
