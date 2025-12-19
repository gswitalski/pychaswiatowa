# API Endpoints Implementation Plan: `recipes.is_termorobot` (zmiana przekrojowa)

## 1. Przegląd punktu końcowego

Ta zmiana nie dodaje nowego endpointu — rozszerza istniejące endpointy zasobu **Recipes** i **Public Recipes** o pole `is_termorobot` oraz (dla list) filtr `filter[termorobot]`.

**Cel biznesowy:** umożliwić oznaczenie przepisu jako „Termorobot” (Thermomix/Lidlomix) oraz:
- zwracanie tej informacji w listach i szczegółach,
- filtrowanie list po tej fladze.

**Zakres endpointów objętych zmianą:**
- `GET /public/recipes` – elementy listy zawierają `is_termorobot`, dodatkowo obsługa `filter[termorobot]`.
- `GET /public/recipes/{id}` – szczegóły zawierają `is_termorobot`.
- `GET /recipes` – elementy listy zawierają `is_termorobot`, dodatkowo obsługa `filter[termorobot]`.
- `POST /recipes` – request może zawierać `is_termorobot` (opcjonalne, default `false`), response zwraca `is_termorobot`.
- `POST /recipes/import` – response zwraca `is_termorobot` (domyślnie `false`).
- `PUT /recipes/{id}` – request może aktualizować `is_termorobot`.

**Wymagania domenowe / DB:**
- Kolumna `recipes.is_termorobot` jest **opcjonalna w requestach**, ale **nie-null w DB**: `boolean not null default false`.
- Soft delete: we wszystkich odczytach nadal obowiązuje `deleted_at IS NULL`.

**Wymagania wdrożeniowe (Supabase Edge Functions + TypeScript, zgodnie z `backend.mdc`):**
- `index.ts`: tylko routing, CORS, obsługa błędów na najwyższym poziomie.
- `*.handlers.ts`: walidacja wejścia (Zod), formatowanie odpowiedzi, logowanie.
- `*.service.ts`: logika biznesowa, wywołania DB/RPC, rzucanie `ApplicationError`.

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes`
- **Metoda**: `GET`
- **URL**: `/public/recipes` (runtime Supabase: `/functions/v1/public/recipes`)
- **Nagłówki**:
  - `Authorization`: niewymagany (endpoint publiczny, ale wspiera opcjonalne uwierzytelnienie jak w obecnej implementacji)
- **Query params**:
  - **Wymagane**: brak
  - **Opcjonalne (bez zmian)**: `page`, `limit`, `sort`, `q`
  - **Nowe**: `filter[termorobot]` (boolean)
    - semantyka: filtruj po `recipes.is_termorobot`
    - jeśli pominięte: brak filtrowania
    - jeśli podane: akceptuj wartości `true|false` (case-insensitive); opcjonalnie `1|0` (jeśli przyjęte w API)

### 2.2 `GET /public/recipes/{id}`
- **Metoda**: `GET`
- **URL**: `/public/recipes/{id}`
- **Path params**:
  - `id` (integer > 0)
- **Zmiana**: wyłącznie w odpowiedzi (dodanie `is_termorobot`).

### 2.3 `GET /recipes`
- **Metoda**: `GET`
- **URL**: `/recipes` (runtime Supabase: `/functions/v1/recipes`)
- **Auth**: wymagany JWT
- **Query params (bez zmian)**: `page`, `limit`, `sort`, `view`, `filter[category_id]`, `filter[tags]`, `search`
- **Nowe**: `filter[termorobot]` (boolean)
  - semantyka: filtruj po `recipes.is_termorobot`
  - jeśli pominięte: brak filtrowania

### 2.4 `POST /recipes`
- **Metoda**: `POST`
- **URL**: `/recipes`
- **Auth**: wymagany JWT
- **Body (JSON)**:
  - **Wymagane**: jak dotychczas (np. `name`, `ingredients_raw`, `steps_raw`, `visibility`)
  - **Nowe pole (opcjonalne)**: `is_termorobot?: boolean`
    - jeśli pominięte: traktować jako `false`

### 2.5 `POST /recipes/import`
- **Metoda**: `POST`
- **URL**: `/recipes/import`
- **Auth**: wymagany JWT
- **Body**: bez zmian (`raw_text`)
- **Zmiana**: wyłącznie w odpowiedzi (dodanie `is_termorobot: false`).

### 2.6 `PUT /recipes/{id}`
- **Metoda**: `PUT`
- **URL**: `/recipes/{id}`
- **Auth**: wymagany JWT
- **Path params**:
  - `id` (integer > 0)
- **Body (JSON)**:
  - wszystkie pola opcjonalne (jak dotychczas)
  - **Nowe pole (opcjonalne)**: `is_termorobot?: boolean`

### 2.7 Wykorzystywane typy

#### DTO / kontrakty (frontend ↔ backend)
Plik: `shared/contracts/types.ts`

**Typy do aktualizacji (dodanie `is_termorobot: boolean`):**
- `PublicRecipeListItemDto`
- `PublicRecipeDetailDto`
- `RecipeListItemDto`
- `RecipeDetailDto`

**Command modele do aktualizacji:**
- `CreateRecipeCommand`: dodać `is_termorobot?: boolean`
- `UpdateRecipeCommand`: dodać `is_termorobot?: boolean`

#### Typy w Edge Functions
- `supabase/functions/public/public.service.ts`:
  - lokalne DTO `PublicRecipeListItemDto`, `PublicRecipeDetailDto` muszą zawierać `is_termorobot`.
  - `RecipeDetailsRow`/`RecipeDetailFullRow` oraz selekty kolumn muszą zawierać `is_termorobot`.
- `supabase/functions/public/public.types.ts`:
  - `GetPublicRecipesQuery` powinien zawierać `termorobot?: boolean` (lub `filterTermorobot?: boolean`) do przekazania do serwisu.
- `supabase/functions/recipes/recipes.service.ts`:
  - `RecipeListItemDto`, `RecipeDetailDto`, `CreateRecipeInput`, `UpdateRecipeInput` muszą zawierać `is_termorobot`.
  - `GetRecipesOptions` powinien zawierać opcjonalny filtr `termorobot?: boolean`.
- `supabase/functions/recipes/recipes.handlers.ts`:
  - walidacja Zod dla `is_termorobot` w `POST /recipes` i `PUT /recipes/{id}`.
  - walidacja/parsowanie query parametru `filter[termorobot]` dla `GET /recipes`.

#### Modele DB i RPC
- Tabela: `public.recipes.is_termorobot boolean not null default false`.
- Widok: `public.recipe_details` musi wystawiać `is_termorobot`.
- RPC:
  - `public.create_recipe_with_tags(...)` – musi przyjmować `p_is_termorobot boolean default false` i zapisywać do tabeli `recipes`.
  - `public.update_recipe_with_tags(...)` – musi przyjmować `p_is_termorobot boolean default null` oraz flagę `p_update_is_termorobot boolean default false`.
  - `public.get_recipes_list(...)` – powinien:
    - przyjmować `p_termorobot boolean default null` jako filtr,
    - zwracać `is_termorobot` w kolumnach wyniku.

## 3. Szczegóły odpowiedzi

### 3.1 Sukces
- `GET /public/recipes`: **200 OK**, każdy element `data[]` ma `is_termorobot: boolean`.
- `GET /public/recipes/{id}`: **200 OK**, obiekt ma `is_termorobot: boolean`.
- `GET /recipes`: **200 OK**, każdy element `data[]` ma `is_termorobot: boolean`.
- `POST /recipes`: **201 Created**, zwraca pełny obiekt przepisu zawierający `is_termorobot`.
- `POST /recipes/import`: **201 Created**, zwraca pełny obiekt przepisu z `is_termorobot: false`.
- `PUT /recipes/{id}`: **200 OK**, zwraca pełny obiekt przepisu z aktualnym `is_termorobot`.

### 3.2 Błędy (kody zgodne z wymaganiami zadania)
- **400 Bad Request**:
  - `is_termorobot` nie jest booleanem
  - `filter[termorobot]` ma nieobsługiwaną wartość
  - inne błędy walidacji requestu (jak dotychczas)
- **401 Unauthorized**:
  - brak/nieprawidłowy JWT dla endpointów prywatnych (`/recipes*`)
- **404 Not Found**:
  - `GET /public/recipes/{id}`: przepis nie istnieje / nie jest publiczny
  - `PUT /recipes/{id}`: przepis nie istnieje lub brak dostępu
- **500 Internal Server Error**:
  - błędy DB/RPC, błędna konfiguracja env, błędy mapowania

> Uwaga: istniejące routery mogą zwracać `405 Method Not Allowed` — nie jest to wymagane w tej zmianie, ale może pozostać.

## 4. Przepływ danych

### 4.1 Warstwa DB
1. `recipes.is_termorobot` jest jedynym źródłem prawdy.
2. Widok `recipe_details` selekcjonuje `r.is_termorobot` (aby publiczne endpointy mogły używać widoku).
3. RPC:
   - create: zapisuje `is_termorobot` w `insert into recipes`.
   - update: aktualizuje `is_termorobot` zgodnie z semantyką „pole opcjonalne w request, ale wymagane rozróżnienie: nie podano vs ustaw false”.
   - list: filtruje po `is_termorobot` (jeśli filtr podany) i zwraca `is_termorobot` w wynikach.

### 4.2 Warstwa Edge Functions
- `public`:
  - `public.handlers.ts` parsuje `filter[termorobot]` do typu boolean i przekazuje do serwisu.
  - `public.service.ts` dodaje warunek `.eq('is_termorobot', value)` gdy filtr ustawiony.
- `recipes`:
  - `recipes.handlers.ts`:
    - `GET /recipes`: parsuje `filter[termorobot]` i przekazuje do serwisu.
    - `POST`/`PUT`: waliduje `is_termorobot` jako boolean; brak pola w `POST` => default false.
  - `recipes.service.ts`:
    - `getRecipes()` przekazuje `p_termorobot` do `get_recipes_list`.
    - `createRecipe()` przekazuje `p_is_termorobot` do `create_recipe_with_tags`.
    - `updateRecipe()` przekazuje `p_is_termorobot` i `p_update_is_termorobot` do `update_recipe_with_tags`.

## 5. Względy bezpieczeństwa

- **RLS** pozostaje głównym mechanizmem ochrony danych użytkownika w prywatnych endpointach.
- **Public endpoints** (service role): obowiązkowo utrzymać twarde filtry:
  - `visibility = 'PUBLIC'`
  - `deleted_at IS NULL`
  - oraz selekcję tylko pól z kontraktu (nie zwracać nadmiarowych kolumn).
- **Walidacja wejścia**:
  - `filter[termorobot]` — whitelist wartości, mapowanie do boolean, invalid => `400`.
  - `is_termorobot` w JSON body — `z.boolean().optional()`; dla `POST` domyślne `false`.
- **Brak dodatkowych uprawnień**: flaga nie wpływa na autoryzację; jest czysto metadanymi.

## 6. Obsługa błędów

- Stosować istniejące mechanizmy: `ApplicationError` + `handleError()` z `supabase/functions/_shared/errors.ts`.
- Dla walidacji `filter[termorobot]` i `is_termorobot` zwracać `400` z jednoznacznym komunikatem.
- **Rejestrowanie błędów do tabeli**: w DB planie/migracjach brak tabeli „error logs”, więc **nie dotyczy** — logowanie przez `logger` (info/warn/error) jest wymagane.

## 7. Wydajność

- `is_termorobot` to pojedyncza kolumna scalar — koszt mapowania pomijalny.
- **Listy**:
  - `GET /recipes` powinno pozostać oparte o RPC `get_recipes_list` (deduplikacja `my_recipes`, paginacja) i nie wykonywać dodatkowych zapytań.
  - `GET /public/recipes` nadal powinno bazować na jednym zapytaniu do `recipe_details` (plus istniejący bulk fetch profili), z dodanym warunkiem filtra.
- **Indeks (opcjonalnie)**:
  - jeśli filtr będzie często używany, rozważyć indeks BTREE na `recipes(is_termorobot)` lub indeks złożony pod najczęstsze sortowanie/filtrowanie (np. `(is_termorobot, created_at)`); na MVP można pominąć.

## 8. Kroki implementacji

1. **Migracja DB: dodać kolumnę `is_termorobot` do `recipes`**
   - nowa migracja w `supabase/migrations/` (np. `YYYYMMDDHHMMSS_add_termorobot_flag_to_recipes.sql`):
     - `alter table public.recipes add column if not exists is_termorobot boolean not null default false;`
     - `comment on column public.recipes.is_termorobot is 'flag indicating recipe is designed for Thermomix/Lidlomix (Termorobot)';`

2. **Migracja DB: zaktualizować `recipe_details`, aby wystawiał `is_termorobot`**
   - `drop view if exists public.recipe_details;`
   - odtworzyć widok w oparciu o najnowszą wersję (z `visibility`, `servings`, `search_vector`) i dodać `r.is_termorobot` do select.

3. **Migracja DB: zaktualizować `create_recipe_with_tags`**
   - dodać parametr `p_is_termorobot boolean default false`.
   - w `insert into public.recipes (...)` dodać kolumnę `is_termorobot` i wartość `p_is_termorobot`.
   - zaktualizować `comment on function` oraz `grant execute` dla nowej sygnatury.

4. **Migracja DB: zaktualizować `update_recipe_with_tags` (rozróżnienie „nie podano” vs `false`)**
   - dodać parametry:
     - `p_is_termorobot boolean default null`
     - `p_update_is_termorobot boolean default false`
   - w `update public.recipes set ...`:
     - `is_termorobot = case when p_update_is_termorobot then p_is_termorobot else is_termorobot end`
   - Uwaga: funkcja ma już wiele parametrów (visibility, image_path, update_category, servings). Trzeba:
     - dropnąć poprzednią sygnaturę,
     - utworzyć nową z zachowaniem wszystkich istniejących parametrów.

5. **Migracja DB: zaktualizować `get_recipes_list`**
   - dodać parametr wejściowy `p_termorobot boolean default null`.
   - dodać filtr w `where` CTE:
     - `and ($6::boolean is null or r.is_termorobot = $6)`
     - (przesunąć indeksy parametrów i odpowiednio zaktualizować `using ...`)
   - dodać `is_termorobot` do `returns table (...)` oraz do selektów (CTE + final SELECT).

6. **Edge Function `public`: walidacja i filtr**
   - `public.handlers.ts`:
     - rozszerzyć schemat Zod query o `filter[termorobot]` i zmapować na boolean.
   - `public.types.ts`:
     - dodać `termorobot?: boolean` do `GetPublicRecipesQuery`.
   - `public.service.ts`:
     - dodać `is_termorobot` do selektów i DTO.
     - jeśli filtr ustawiony: dodać warunek `.eq('is_termorobot', query.termorobot)`.

7. **Edge Function `recipes`: walidacja, request/response, filtr**
   - `recipes.handlers.ts`:
     - `createRecipeSchema`: dodać `is_termorobot: z.boolean().optional().default(false)` (albo `optional` + ustawienie defaultu w mapowaniu).
     - `updateRecipeSchema`: dodać `is_termorobot: z.boolean().optional()`.
     - `getRecipesQuerySchema`: dodać `filter[termorobot]` i mapowanie na boolean.
     - przy mapowaniu do `UpdateRecipeInput` wyznaczyć flagę `updateIsTermorobot` na podstawie obecności klucza w body (np. `'is_termorobot' in requestBody`).
   - `recipes.service.ts`:
     - rozszerzyć DTO (`RecipeListItemDto`, `RecipeDetailDto`) o `is_termorobot`.
     - rozszerzyć `CreateRecipeInput` i `UpdateRecipeInput` o `is_termorobot` (+ `updateIsTermorobot` jeśli przyjęte).
     - przekazać parametry do RPC (`create_recipe_with_tags`, `update_recipe_with_tags`, `get_recipes_list`).

8. **Kontrakty FE/BE**
   - zaktualizować `shared/contracts/types.ts` (DTO + command modele) zgodnie z sekcją 2.7.

9. **Regeneracja typów Supabase (jeśli repo tego wymaga)**
   - po migracjach zaktualizować generowane typy (`database.types.ts`) tak, aby zawierały `recipes.is_termorobot` i `recipe_details.is_termorobot`.

10. **Test plan (minimum manualny / integracyjny)**
   - `POST /recipes`:
     - bez `is_termorobot` → `201`, response `is_termorobot: false`
     - z `is_termorobot: true` → `201`, response `is_termorobot: true`
   - `PUT /recipes/{id}`:
     - `is_termorobot: true` → `200`, odczyt pokazuje `true`
     - `is_termorobot: false` → `200`, odczyt pokazuje `false`
   - `GET /recipes?filter[termorobot]=true` → lista zawiera tylko `is_termorobot=true`
   - `GET /public/recipes?filter[termorobot]=false` → lista zawiera tylko `is_termorobot=false`
   - `GET /public/recipes/{id}` → response zawiera `is_termorobot`
