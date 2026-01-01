# API Endpoints Implementation Plan: helper field `in_my_plan` (lista + szczegóły przepisów)

> **Plik docelowy**: `docs/results/impl-plans/endpoints/recipes-in-my-plan-helper-field-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Functions (TypeScript / Deno) + (opcjonalnie) SQL (RPC)  
> **Zakres zmiany**: dodanie pola `in_my_plan` w odpowiedziach **tylko gdy request jest uwierzytelniony** dla:
>
> - `GET /public/recipes`
> - `GET /public/recipes/feed`
> - `GET /public/recipes/{id}`
> - `GET /recipes`
> - `GET /recipes/feed`
> - `GET /recipes/{id}`

## 1. Przegląd punktu końcowego

Zmiana polega na dodaniu helper field `in_my_plan` w odpowiedziach endpointów listujących i zwracających szczegóły przepisów, aby UI mogło od razu ustawić stan przycisku „Dodaj/Usuń z planu”.

**Definicja `in_my_plan`:**

- `true` jeśli `recipe_id` znajduje się w tabeli `public.plan_recipes` dla bieżącego użytkownika (`plan_recipes.user_id = requesterUserId`).
- `false` w przeciwnym wypadku.

**Kontrakt dot. autoryzacji:**

- Dla endpointów publicznych (`/public/*`) autoryzacja jest **opcjonalna**:
    - anonymous → `in_my_plan` **nie jest wyliczane** (można zwrócić `false` jako domyślną wartość),
    - authenticated → `in_my_plan` jest wyliczane dla zalogowanego użytkownika.
- Dla endpointów prywatnych (`/recipes*`) autoryzacja jest **wymagana** i `in_my_plan` jest zawsze wyliczane.

## 2. Szczegóły żądania

### `GET /public/recipes`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/public/recipes` (w dokumentacji: `/public/recipes`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (opcjonalne)
- **Query params** (bez zmian):
    - wymagane: brak
    - opcjonalne: `page`, `limit`, `sort`, `q`, `filter[termorobot]`

### `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/public/recipes/feed` (w dokumentacji: `/public/recipes/feed`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (opcjonalne)
- **Query params** (bez zmian):
    - wymagane: brak
    - opcjonalne: `cursor`, `limit`, `sort`, `q`, `filter[termorobot]`

### `GET /public/recipes/{id}`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/public/recipes/{id}` (w dokumentacji: `/public/recipes/{id}`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (opcjonalne)
- **Path params**:
    - wymagane: `{id}` (pozytywna liczba całkowita)

> **Wymagana korekta implementacyjna**: handler `GET /public/recipes/{id}` musi mieć dostęp do `Request`, aby móc odczytać opcjonalny JWT (obecnie przyjmuje tylko `recipeId: string`).

### `GET /recipes`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/recipes` (w dokumentacji: `/recipes`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- **Query params** (bez zmian):
    - wymagane: brak
    - opcjonalne: `page`, `limit`, `sort`, `view`, `filter[category_id]`, `filter[tags]`, `filter[termorobot]`, `search`

### `GET /recipes/feed`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/recipes/feed` (w dokumentacji: `/recipes/feed`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- **Query params** (bez zmian):
    - wymagane: brak
    - opcjonalne: `cursor`, `limit`, `sort`, `view`, `filter[category_id]`, `filter[tags]`, `filter[termorobot]`, `search`

### `GET /recipes/{id}`

- **Metoda HTTP**: `GET`
- **URL**: `/functions/v1/recipes/{id}` (w dokumentacji: `/recipes/{id}`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- **Path params**:
    - wymagane: `{id}` (pozytywna liczba całkowita)

## 3. Wykorzystywane typy

### Kontrakty FE/Shared (`shared/contracts/types.ts`)

**Do aktualizacji** (dodanie `in_my_plan: boolean`):

- `PublicRecipeListItemDto`
- `PublicRecipeDetailDto`
- `RecipeListItemDto`
- `RecipeDetailDto`

> Rekomendacja: nawet dla requestów anonimowych zwracać `in_my_plan: false` (stała obecność pola upraszcza UI i cache-busting jest już rozwiązany przez `no-store` dla requestów z JWT).

### Backend (Edge Functions)

Zmiany w typach DTO zdefiniowanych lokalnie w:

- `supabase/functions/public/public.service.ts`
    - `PublicRecipeListItemDto` (dodać `in_my_plan`)
    - `PublicRecipeDetailDto` (dodać `is_owner`, `in_my_plan` — spójne z API planem)
- `supabase/functions/recipes/recipes.service.ts`
    - `RecipeListItemDto` (dodać `in_my_plan`)
    - `RecipeDetailDto` (dodać `is_owner`, `in_my_collections`, `in_my_plan` **lub** przynajmniej `in_my_plan` – zgodnie z API planem; pozostałe helpery mogą być już wymagane przez UI)

### Zasób bazy danych

- tabela: `public.plan_recipes` (już istnieje; migracja: `supabase/migrations/20251230120000_create_plan_recipes_table.sql`)
    - PK: `(user_id, recipe_id)`
    - indeks: `(user_id, added_at desc)` oraz `(recipe_id)`

## 4. Szczegóły odpowiedzi

### `GET /public/recipes` oraz `GET /public/recipes/feed`

- **200 OK**: struktura bez zmian, ale elementy `data[]` zawierają nowe pole:
    - `in_my_plan: boolean` (dla anonymous: `false`)

### `GET /public/recipes/{id}`

- **200 OK**: jak dotychczas, plus:
    - `is_owner: boolean` (dla anonymous: `false`)
    - `in_my_plan: boolean` (dla anonymous: `false`)
- **404 Not Found**: bez zmian (gdy przepis nie istnieje / nie jest publiczny / jest soft-deleted)

### `GET /recipes` oraz `GET /recipes/feed`

- **200 OK**: jak dotychczas, plus:
    - `in_my_plan: boolean` dla każdego elementu listy

### `GET /recipes/{id}`

- **200 OK**: jak dotychczas, plus:
    - `in_my_plan: boolean`
    - (rekomendowane) helpery spójne z listą: `is_owner`, `in_my_collections`, `in_my_plan`

## 5. Przepływ danych

### Wspólny wzorzec wyliczania `in_my_plan`

- **Dla list** (w jednym dodatkowym zapytaniu, bez N+1):
    - zebrać `recipeIds` z wyniku głównego zapytania / RPC,
    - wykonać zapytanie do `plan_recipes`:
        - filtr: `user_id = requesterUserId`
        - filtr: `recipe_id IN (recipeIds)`
        - select: tylko `recipe_id`
    - zbudować `Set<number>` i mapować do DTO: `in_my_plan = set.has(recipe.id)`

- **Dla szczegółów**:
    - wykonać szybkie sprawdzenie istnienia wpisu w `plan_recipes` dla `{user_id, recipe_id}` (PK):
        - select minimalny + `maybeSingle()` albo `head: true` z `count`
    - ustawić `in_my_plan` w DTO

### Public endpoints (`supabase/functions/public`)

- **`GET /public/recipes`**:
    - w `public.handlers.ts`: odczyt `userId` przez `getOptionalAuthenticatedUser(req)`
    - w `public.service.ts`:
        - po pobraniu listy i po wyliczeniu `in_my_collections` dodać analogiczny blok dla `in_my_plan`
        - dla anonymous: pominąć zapytanie i ustawić `false`

- **`GET /public/recipes/feed`**:
    - identycznie jak wyżej (bulk check dla zwracanej paczki)

- **`GET /public/recipes/{id}`**:
    - zmienić handler tak, aby przyjmował `req: Request` i opcjonalnie wyciągał `userId`
    - w `public.service.ts`:
        - rozszerzyć `getPublicRecipeById(...)` o `userId: string | null`
        - obliczyć `is_owner` i `in_my_plan` tylko gdy `userId !== null` (w przeciwnym razie oba `false`)

### Private endpoints (`supabase/functions/recipes`)

Obecnie `GET /recipes` i `GET /recipes/feed` korzystają z RPC `get_recipes_list`, które zwraca m.in. `in_my_collections` i `is_owner`.

**Rekomendacja (MVP, minimalna zmiana): post-processing w `recipes.service.ts`**

- Po otrzymaniu listy z RPC:
    - dociągnąć `in_my_plan` w 1 dodatkowym query do `plan_recipes` (jak wyżej)
    - dołączyć pole do mapowanego DTO

**Opcja rozwojowa (bardziej „czysta”): rozszerzenie RPC**

- Zmodyfikować `get_recipes_list` aby zwracało dodatkową kolumnę `in_my_plan` liczoną przez `exists(select 1 from plan_recipes ...)` dla `p_user_id`.
- Wtedy `recipes.service.ts` nie musi wykonywać dodatkowego query.

**`GET /recipes/{id}`**:

- Po uzyskaniu danych przepisu (obojętnie czy przez client RLS czy service role dla PUBLIC):
    - wykonać check w `plan_recipes` dla `requesterUserId` i `recipeId`
    - dołączyć `in_my_plan` do DTO

## 6. Względy bezpieczeństwa

- **Brak wycieków danych planu**:
    - `in_my_plan` jest zawsze liczone **tylko** względem `requesterUserId` (nigdy dla obcych użytkowników).
    - w public endpoints, mimo użycia service-role, filtr `plan_recipes.user_id = userId` jest obowiązkowy (service-role omija RLS).
- **Uwierzytelnienie**:
    - public endpoints: JWT opcjonalny; nieprawidłowy token → `401` (z `getOptionalAuthenticatedUser`)
    - private endpoints: brak JWT → `401` (z `getAuthenticatedContext`)
- **Cache**:
    - public endpoints już ustawiają `Cache-Control: public` dla anonymous i `no-store` dla authenticated — to jest krytyczne, bo `in_my_plan` jest per-user.
- **Soft delete**:
    - `in_my_plan` nie powinno „reaktywować” soft-deleted przepisów w public listach; listy i tak filtrują `deleted_at is null`.
    - Dla prywatnych endpointów `GET /recipes/{id}`: logika rozróżniania 403/404 pozostaje bez zmian; `in_my_plan` liczymy dopiero po pozytywnym rozstrzygnięciu dostępu.

## 7. Obsługa błędów

**Kody statusu (bez zmian w kontrakcie):**

- `200 OK` – poprawny odczyt
- `400 Bad Request` – niepoprawne parametry (np. zbyt krótki `q`, nieprawidłowy `id`)
- `401 Unauthorized` – brak/invalid JWT (w endpointach prywatnych zawsze; w publicznych tylko gdy klient wysłał zły token)
- `404 Not Found` – zasób nie istnieje / nie jest dostępny (zgodnie z dotychczasową semantyką)
- `500 Internal Server Error` – błąd bazy / błąd runtime

**Zasada odporności helper-field** (rekomendacja spójna z istniejącą obsługą `in_my_collections` w public endpoints):

- jeśli zapytanie do `plan_recipes` zawiedzie:
    - log `logger.error(...)` (z `userId`, liczbą `recipeIds`, `error.code`)
    - **nie przerywać** głównego requestu; ustawić `in_my_plan = false` dla wszystkich elementów.

## 8. Wydajność

- **Public list/feed**:
    - główne query do `recipe_details` + profiles (bulk) + `recipe_collections` (bulk) + `plan_recipes` (bulk)
    - dodatkowe obciążenie: 1 query `plan_recipes` na request (tylko dla authenticated)
- **Private list/feed** (wariant MVP):
    - 1× RPC `get_recipes_list`
    - 1× query `plan_recipes` z `IN (recipeIds)`
- **Private details**:
    - 1× query recipe + 1× check `plan_recipes` (PK lookup)
- **Indeksy**:
    - `plan_recipes(user_id, added_at desc)` nie jest krytyczny dla checków, ale wspiera inne endpointy planu
    - `plan_recipes(recipe_id)` pomaga przy `IN (recipeIds)` (wraz z filtrem po `user_id` kluczowy jest PK; w praktyce najczęściej wystarczy PK `(user_id, recipe_id)`)

## 9. Kroki implementacji

1. **Kontrakty DTO (FE/Shared)**:
    - zaktualizować `shared/contracts/types.ts` dodając `in_my_plan` do:
        - `PublicRecipeListItemDto`, `PublicRecipeDetailDto`, `RecipeListItemDto`, `RecipeDetailDto`
2. **Public – handler dla `GET /public/recipes/{id}`**:
    - w `supabase/functions/public/public.handlers.ts`:
        - zmienić sygnaturę na `handleGetPublicRecipeById(req: Request, recipeId: string)`
        - wyciągać opcjonalnie `userId` z `getOptionalAuthenticatedUser(req)`
        - przekazywać `userId` do serwisu
    - w routerze `publicRouter(...)` przekazywać `req` do handlera
3. **Public – serwis**:
    - w `supabase/functions/public/public.service.ts`:
        - dodać `in_my_plan` do `PublicRecipeListItemDto`
        - rozszerzyć `getPublicRecipes(...)` i `getPublicRecipesFeed(...)` o bulk-check `plan_recipes` (dla `userId !== null`)
        - rozszerzyć `PublicRecipeDetailDto` o `is_owner` i `in_my_plan`
        - rozszerzyć `getPublicRecipeById(...)` o `userId: string | null` i check `plan_recipes`
4. **Recipes – serwis list**:
    - w `supabase/functions/recipes/recipes.service.ts`:
        - dodać `in_my_plan` do `RecipeListItemDto`
        - po wyniku z RPC wykonać 1 query do `plan_recipes` i uzupełnić mapowanie DTO
5. **Recipes – serwis szczegółów**:
    - w `supabase/functions/recipes/recipes.service.ts`:
        - rozszerzyć `RecipeDetailDto` o `in_my_plan` (i ewentualnie helpery `is_owner`, `in_my_collections` jeśli kontrakt tego wymaga)
        - w `getRecipeById(...)` po uzyskaniu danych dodać check `plan_recipes`
6. **Testy manualne (rekomendowane scenariusze)**:
    - public list/feed:
        - anonymous: `in_my_plan` zawsze `false`
        - authenticated: `in_my_plan` `true` dla przepisów dodanych do planu
    - public detail:
        - anonymous: `in_my_plan=false`
        - authenticated: `in_my_plan=true` po dodaniu do planu
    - private list/feed/detail:
        - dla przepisu w planie: `in_my_plan=true`
        - dla przepisu poza planem: `false`
        - 401 bez JWT


