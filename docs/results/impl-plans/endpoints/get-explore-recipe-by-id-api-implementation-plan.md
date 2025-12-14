# API Endpoints Implementation Plan: GET /explore/recipes/{id}

## 1. Przegląd punktu końcowego
Endpoint `GET /explore/recipes/{id}` zwraca szczegóły pojedynczego przepisu dla publicznej ścieżki „Explore details” z **opcjonalnym uwierzytelnieniem**.

**Zasada dostępu (krytyczne):**
- jeśli przepis ma `visibility = 'PUBLIC'` → zwróć go każdemu (również bez JWT),
- jeśli przepis ma `visibility != 'PUBLIC'` → zwróć go **wyłącznie** gdy request jest uwierzytelniony i **zalogowany użytkownik jest autorem** (`auth.uid() === recipes.user_id`),
- we wszystkich pozostałych przypadkach zwróć **`404 Not Found`** (nie ujawniać istnienia niepublicznych przepisów).

**Soft delete (krytyczne):** endpoint nigdy nie może zwracać przepisów z `deleted_at IS NOT NULL`.

**Mapowanie na Supabase Edge Functions:**
- Specyfikacja API mówi o ścieżce `/explore/recipes/{id}`.
- Implementacyjnie w Supabase będzie to funkcja `supabase/functions/explore/` z routingiem `/recipes/{id}`.
- Runtime URL: `/functions/v1/explore/recipes/{id}`.

## 2. Szczegóły żądania
- **Metoda HTTP:** `GET`
- **Struktura URL:** `/explore/recipes/{id}`

### Parametry
- **Wymagane:**
    - `id` (path): numeryczny identyfikator przepisu (`bigint`)
- **Opcjonalne:** brak

### Nagłówki
- **`Authorization`**: opcjonalny
    - brak nagłówka → request anonimowy (dostęp tylko do `PUBLIC`)
    - obecny nagłówek → token musi być poprawny (w przeciwnym razie `401`)
- **`Content-Type`**: nie dotyczy (brak body)

### Request Body
Brak.

## 3. Wykorzystywane typy
### DTO (kontrakty)
Zgodnie z `docs/results/main-project-docs/009 API plan.md`, odpowiedź ma mieć **ten sam kształt co** `GET /recipes/{id}`.

- **Response DTO:** `RecipeDetailDto` (istnieje w `shared/contracts/types.ts`)
    - zawiera m.in. `id`, `user_id` (autor), `category_id`, `category_name`, `name`, `description`, `image_path`, `created_at`, `updated_at`, `visibility`, `ingredients`, `steps`, `tags`

### Modele wejścia
- Brak body; wejściem jest parametr ścieżki.
- (Opcjonalnie, dla porządku w kodzie funkcji) `GetExploreRecipeByIdParams`:
    - `id: number`

### Typy błędów
- Używać `ApplicationError` z `supabase/functions/_shared/errors.ts`.
- Format błędu w odpowiedzi: `{ "code": string, "message": string }`.

## 4. Szczegóły odpowiedzi
### Sukces
- **200 OK**
- Payload: obiekt zgodny z `RecipeDetailDto`.

### Błędy
- **400 Bad Request**
    - `id` nie jest dodatnią liczbą całkowitą
- **401 Unauthorized**
    - nagłówek `Authorization` jest obecny, ale token jest niepoprawny / wygasł
- **404 Not Found**
    - przepis nie istnieje
    - przepis jest soft-usunięty (`deleted_at IS NOT NULL`)
    - przepis nie jest `PUBLIC`, a request jest anonimowy
    - przepis nie jest `PUBLIC`, a request jest uwierzytelniony, ale użytkownik nie jest autorem
- **500 Internal Server Error**
    - błąd konfiguracji env (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
    - błąd DB
    - błąd mapowania/parsowania pól JSONB

Uwaga: celowo **nie zwracamy `403`** dla niepublicznych przepisów – zamiast tego `404` (bez ujawniania istnienia zasobu).

## 5. Przepływ danych
### Warstwa routingu (Edge Function)
1. `supabase/functions/explore/index.ts`
    - loguje request (method + url)
    - obsługuje CORS (`OPTIONS`)
    - deleguje do `exploreRouter(req)`
    - ma top-level `try/catch` i zwraca `500` dla nieobsłużonych wyjątków

2. `supabase/functions/explore/explore.handlers.ts`
    - dopasowuje ścieżkę `/explore/recipes/{id}` (routing wewnętrzny: `/recipes/{id}`)
    - waliduje `id` (Zod / transform string→number, `int`, `min(1)`)
    - rozpoznaje kontekst uwierzytelnienia:
        - jeśli brak `Authorization` → `userId = null`
        - jeśli jest `Authorization` → weryfikuje token i wyciąga `userId`
    - wywołuje serwis: `getExploreRecipeById({ recipeId, requesterUserId })`
    - mapuje wynik na `RecipeDetailDto`
    - ustawia nagłówki cache:
        - dla odpowiedzi publicznej (gdy `visibility='PUBLIC'` i request anonimowy) można dodać `Cache-Control: public, max-age=60`
        - w każdym innym przypadku: `Cache-Control: no-store` (żeby uniknąć cache’owania prywatnych danych)

### Warstwa serwisowa (logika biznesowa + DB)
3. `supabase/functions/explore/explore.service.ts`
    - używa **service role client** (`createServiceRoleClient`) do odczytu `recipe_details` (bypass RLS)
    - pobiera rekord po `id` z obowiązkowym filtrem `deleted_at IS NULL`
    - wykonuje **autoryzację aplikacyjną** na podstawie danych rekordu:
        - jeśli `visibility === 'PUBLIC'` → OK
        - inaczej jeśli `requesterUserId != null` oraz `requesterUserId === recipe.user_id` → OK
        - w przeciwnym razie rzuca `ApplicationError('NOT_FOUND', ...)`
    - mapuje wynik na `RecipeDetailDto` (bez zwracania `deleted_at`)

### Źródło danych
- Preferowane: widok `recipe_details` (zgodnie z DB Plan) – agreguje dane i ogranicza liczbę zapytań.
- Krytyczne: zawsze wymusić `deleted_at IS NULL` po stronie zapytania, nawet jeśli widok „zwykle” filtruje soft-delete (defensywnie).

## 6. Względy bezpieczeństwa
- **Brak wycieku istnienia zasobu**: dla niepublicznego przepisu dostępnego tylko autorowi zwracamy `404`, nie `403`.
- **Uwierzytelnienie opcjonalne**:
    - brak tokenu = tryb publiczny
    - błędny token (gdy nagłówek jest obecny) = `401`
- **Service role (krytyczne)**:
    - klient z service role ma pełne uprawnienia → filtr `deleted_at IS NULL` jest obowiązkowy
    - kontrola dostępu (`visibility` + author check) musi być w serwisie
    - zwracać tylko pola wynikowe (zgodne z DTO), nie ujawniać dodatkowych kolumn
- **Walidacja wejścia**: `id` jako dodatni integer.
- **CORS**: metody `GET, OPTIONS`, nagłówki jak w innych funkcjach.
- **Cache**:
    - nigdy nie cache’ować odpowiedzi dla nie-`PUBLIC` (nawet jeśli to autor)

## 7. Wydajność
- Odczyt po PK (`recipes.id`) + widok `recipe_details` → jedno zapytanie z gotowymi agregatami.
- Minimalny SELECT: użyć stałej listy kolumn (podobnie jak w `supabase/functions/recipes/recipes.service.ts`).
- Opcjonalny cache tylko dla w pełni publicznych odpowiedzi (`PUBLIC` + anonimowo).

## 8. Kroki implementacji
1. **Utworzyć nową Edge Function `explore`**
    - katalog: `supabase/functions/explore/`
    - pliki:
        - `index.ts` (CORS + routing + top-level error handling)
        - `explore.handlers.ts` (router + walidacja + formatowanie odpowiedzi)
        - `explore.service.ts` (logika dostępu + DB)
        - `explore.types.ts` (opcjonalnie: typy + schematy Zod)

2. **Dodać helper do opcjonalnego auth (współdzielony)**
    - w `supabase/functions/_shared/supabase-client.ts` dodać funkcję np.:
        - `getOptionalAuthenticatedUser(req): Promise<User | null>`
        - zachowanie: brak `Authorization` → `null`; niepoprawny token → `ApplicationError('UNAUTHORIZED', ...)`

3. **Walidacja parametru `id` w handlerze**
    - parse string→number
    - `int`, `min(1)`
    - błąd → `ApplicationError('VALIDATION_ERROR', ...)` → `400`

4. **Implementacja serwisu `getExploreRecipeById`**
    - wejście: `{ recipeId: number, requesterUserId: string | null }`
    - zapytanie do `recipe_details`:
        - `.eq('id', recipeId)`
        - `.is('deleted_at', null)`
        - `.single()`
    - mapowanie błędu `PGRST116` na `ApplicationError('NOT_FOUND', ...)`
    - reguła dostępu jak w sekcji 1

5. **Ustawić cache headers w handlerze**
    - `PUBLIC` + anonimowo → `Cache-Control: public, max-age=60`
    - pozostałe → `Cache-Control: no-store`

6. **Test plan (manualny, minimalny)**
    - `GET /functions/v1/explore/recipes/{id}` dla przepisu `PUBLIC` bez tokenu → `200`
    - `GET /functions/v1/explore/recipes/{id}` dla przepisu `PRIVATE/SHARED` bez tokenu → `404`
    - `GET /functions/v1/explore/recipes/{id}` dla przepisu `PRIVATE/SHARED` z tokenem autora → `200`
    - `GET /functions/v1/explore/recipes/{id}` dla przepisu `PRIVATE/SHARED` z tokenem innego usera → `404`
    - `GET /functions/v1/explore/recipes/abc` → `400`
    - `GET /functions/v1/explore/recipes/{id}` z błędnym/wygaśniętym tokenem → `401`
    - przepis z `deleted_at != null` → `404`

---

## Nota: GET /public/recipes/{id} (bez zmian)
Endpoint `GET /public/recipes/{id}` pozostaje funkcjonalnie bez zmian (PUBLIC-only). Implementacja i plan są już w repozytorium:
- Kod: `supabase/functions/public/*`
- Plan: `docs/results/impl-plans/endpoints/get-public-recipe-by-id-api-implementation-plan.md`
