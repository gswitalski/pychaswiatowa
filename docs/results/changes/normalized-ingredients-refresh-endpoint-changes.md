# Zmiany: POST /recipes/{id}/normalized-ingredients/refresh - Endpoint odświeżania normalizacji składników

## Data
2026-01-18

## Typ zmian
✅ Nowa funkcjonalność (Endpoint API)

## Opis
Implementacja endpointa `POST /recipes/{id}/normalized-ingredients/refresh` służącego do ręcznego (dev/test) zlecenia ponownej normalizacji składników dla przepisu. Operacja jest asynchroniczna - enqueue-uje zadanie do kolejki dla workera i zwraca natychmiast status `PENDING`.

## Zmiany w kodzie

### 1. Kontrakt FE/BE (`shared/contracts/types.ts`)
**Nowe typy:**
- `RefreshRecipeNormalizedIngredientsResponseDto` - Response DTO dla endpointa refresh
  ```typescript
  interface RefreshRecipeNormalizedIngredientsResponseDto {
      recipe_id: number;
      status: NormalizedIngredientsStatus; // zawsze 'PENDING'
  }
  ```

**Uwagi:**
- Wykorzystuje istniejący typ `NormalizedIngredientsStatus = 'PENDING' | 'READY' | 'FAILED'`
- Brak Command Modelu (endpoint nie przyjmuje body)

### 2. Migracje DB

#### a) `20260118120100_create_normalized_ingredients_jobs_table.sql`
**Utworzona tabela:** `normalized_ingredients_jobs`
- Kolumny:
  - `id` (bigserial, PK)
  - `recipe_id` (bigint, NOT NULL, FK → recipes.id, ON DELETE CASCADE)
  - `user_id` (uuid, NOT NULL, FK → auth.users.id, ON DELETE CASCADE)
  - `status` (text, NOT NULL, DEFAULT 'PENDING', CHECK: 'PENDING'|'RUNNING'|'DONE'|'FAILED')
  - `attempts` (int, NOT NULL, DEFAULT 0)
  - `last_error` (text, nullable)
  - `created_at` (timestamptz, NOT NULL, DEFAULT now())
  - `updated_at` (timestamptz, NOT NULL, DEFAULT now())

**Indeksy:**
- `idx_normalized_ingredients_jobs_recipe_id` - UNIQUE na `recipe_id` (deduplikacja)
- `idx_normalized_ingredients_jobs_status_created` - na `(status, created_at)` dla pollingu

**Polityki RLS:**
- `"Users can read their own recipe normalization jobs"` - SELECT (user owns recipe via recipes.user_id)
- `"Users can create jobs for their own recipes"` - INSERT (user owns recipe)
- `"Service role can manage all jobs"` - ALL (dla workerów)

**Trigger:**
- `set_normalized_ingredients_jobs_updated_at` → `handle_updated_at()` (automatyczna aktualizacja `updated_at`)

#### b) `20260118120200_create_enqueue_normalized_ingredients_refresh_rpc.sql`
**Utworzona funkcja RPC:** `enqueue_normalized_ingredients_refresh(p_recipe_id bigint)`
- **Typ:** SECURITY DEFINER (wykonuje się z prawami użytkownika)
- **Zwraca:** JSON `{ recipe_id, status: 'PENDING' }`
- **Logika (atomowa transakcja):**
  1. Weryfikacja `auth.uid()` IS NOT NULL (throw AUTHZ1 jeśli nie)
  2. Weryfikacja dostępu do przepisu (recipes.user_id = auth.uid() AND deleted_at IS NULL)
     - throw NOTFD jeśli brak dostępu lub nie istnieje
  3. UPDATE recipes SET normalized_ingredients_status='PENDING', normalized_ingredients_updated_at=NULL
  4. UPSERT do normalized_ingredients_jobs (deduplikacja po recipe_id):
     - INSERT nowy job (status PENDING, attempts=0)
     - ON CONFLICT UPDATE: status=PENDING, attempts=0, last_error=NULL, updated_at=now()
  5. Zwrócenie `{ recipe_id, status: 'PENDING' }`

**Error codes:**
- `AUTHZ1` - brak uwierzytelnienia
- `NOTFD` - przepis nie istnieje / brak dostępu / soft-deleted

### 3. Service Layer (`recipes.service.ts`)

**Nowa funkcja:** `enqueueRecipeNormalizedIngredientsRefresh(client, recipeId, userId)`
- **Parametry:**
  - `client: TypedSupabaseClient` - klient z JWT użytkownika
  - `recipeId: number` - ID przepisu
  - `userId: string` - ID użytkownika (do logowania)
- **Zwraca:** `Promise<{ recipe_id: number; status: NormalizedIngredientsStatus }>`
- **Logika:**
  1. Wywołanie RPC `enqueue_normalized_ingredients_refresh`
  2. Obsługa błędów z mapowaniem error codes:
     - `AUTHZ1` / "Unauthorized" → `ApplicationError('UNAUTHORIZED')` → 401
     - `NOTFD` / "not found" / "access denied" → `ApplicationError('NOT_FOUND')` → 404
     - `P0001` → `ApplicationError('VALIDATION_ERROR')` → 400
     - Inne → `ApplicationError('INTERNAL_ERROR')` → 500
  3. Walidacja odpowiedzi RPC (sprawdzanie recipe_id i status)
  4. Logowanie operacji (bez danych wrażliwych)
  5. Zwrócenie `{ recipe_id, status: 'PENDING' }`

### 4. Handler Layer (`recipes.handlers.ts`)

**Nowy handler:** `handlePostRecipeNormalizedIngredientsRefresh(req, recipeIdParam)`
- **Parametry:**
  - `req: Request` - HTTP request (wymaga JWT w Authorization header)
  - `recipeIdParam: string` - ID przepisu z URL path
- **Zwraca:** `Promise<Response>` (202 Accepted lub error)
- **Logika:**
  1. Walidacja `recipeIdParam` przez `parseAndValidateRecipeId` (guard clause → 400 jeśli invalid)
  2. Uwierzytelnianie przez `getAuthenticatedContext(req)` (→ 401 jeśli brak JWT)
  3. Wywołanie serwisu `enqueueRecipeNormalizedIngredientsRefresh`
  4. Zwrócenie **202 Accepted** z payloadem `{ recipe_id, status: 'PENDING' }`
  5. Obsługa błędów przez `handleError`

**Dodany import:**
- `enqueueRecipeNormalizedIngredientsRefresh` z `recipes.service.ts`

### 5. Routing (`recipes.handlers.ts`)

**Nowa funkcja ekstraktora:** `extractRecipeIdFromNormalizedIngredientsRefreshPath(url)`
- Regex: `/\/recipes\/([^/]+)\/normalized-ingredients\/refresh\/?$/`
- Obsługuje lokalne i deployed paths
- Zwraca `string | null` (ID przepisu lub null jeśli nie pasuje)

**Aktualizacja routera `recipesRouter`:**
- **Ekstrakcja ścieżki refresh:**
  ```typescript
  const refreshNormalizedIngredientsRecipeId = extractRecipeIdFromNormalizedIngredientsRefreshPath(url);
  ```
  - **KRYTYCZNE:** sprawdzana PRZED `/normalized-ingredients` (unika false match)

- **Routing POST:**
  ```typescript
  if (refreshNormalizedIngredientsRecipeId) {
      return handlePostRecipeNormalizedIngredientsRefresh(req, refreshNormalizedIngredientsRecipeId);
  }
  ```
  - **KRYTYCZNE:** jako pierwsza w bloku POST (przed `/recipes/{id}/image`)

**Aktualizacja dokumentacji routera:**
- Dodano endpoint do listy: `POST /recipes/{id}/normalized-ingredients/refresh - Enqueue normalization refresh (dev/test)`

### 6. Testy HTTP (`test-requests-normalized-ingredients.http`)

**Uwaga:** Testy już istniały w pliku (Tests 14-25). Plik zawiera kompleksowe przypadki testowe:

**Testy sukcesu:**
- Test 14: Poprawny request → 202 Accepted `{ recipe_id, status: "PENDING" }`
- Test 15: Idempotencja (wielokrotne wywołania) → nadal 202, brak duplikatów w kolejce

**Testy błędów autoryzacji:**
- Test 16: Brak JWT → 401 Unauthorized
- Test 17: Niepoprawny JWT → 401 Unauthorized

**Testy błędów walidacji:**
- Test 18: ID nie jest liczbą (`/abc/`) → 400 Bad Request
- Test 19: ID = 0 → 400 Bad Request
- Test 20: ID ujemne → 400 Bad Request

**Testy błędów NOT_FOUND:**
- Test 21: Nieistniejący przepis (ID 999999) → 404 Not Found
- Test 22: Soft-deleted przepis → 404 Not Found (anti-leak)
- Test 23: Cuzy przepis (inny user) → 404 Not Found (anti-leak, nie 403)

**Testy workflow:**
- Test 24: Real-world workflow (GET status → POST refresh → GET status = PENDING)
- Test 25: Weryfikacja stanu DB po refresh (instrukcje manualne)

## Kluczowe cechy implementacji

### ✅ Bezpieczeństwo
1. **JWT wymagany** - endpoint wymaga uwierzytelnienia
2. **Anti-leak** - zwraca 404 (nie 403) dla cudzych przepisów (nie ujawnia istnienia)
3. **RLS** - polityki na poziomie DB (double-check zabezpieczeń)
4. **Soft-delete aware** - nie można odświeżyć usuniętego przepisu
5. **Bezpieczne logowanie** - brak JWT i danych wrażliwych w logach

### ✅ Idempotencja i deduplikacja
1. **Unikalny indeks** na `normalized_ingredients_jobs(recipe_id)`
2. **UPSERT semantyka** - wielokrotne wywołania nie tworzą duplikatów
3. **Reset countera** - attempts=0 i last_error=NULL przy każdym refresh

### ✅ Atomowość
1. **RPC w jednej transakcji** - update recipes + upsert job razem
2. **Rollback automatyczny** - przy błędzie całość się cofa

### ✅ Observability
1. **Logowanie operacji** - każdy krok z kontekstem (recipeId, userId)
2. **Metryki** - czas operacji, status, czy job istniał wcześniej
3. **Mapowanie błędów** - szczegółowe error codes dla debugowania

### ✅ API Design
1. **202 Accepted** - semantycznie poprawny status dla async operation
2. **Minimalny payload** - `{ recipe_id, status }` (dev/test endpoint)
3. **Spójne error responses** - używa standardowego `ApplicationError` + `handleError`

## Weryfikacja

### ✅ Migracje DB
```bash
$ supabase db reset
# Wszystkie 3 migracje zastosowane pomyślnie:
# - 20260118120000_add_normalized_ingredients_to_recipes.sql
# - 20260118120100_create_normalized_ingredients_jobs_table.sql ✅ NOWA
# - 20260118120200_create_enqueue_normalized_ingredients_refresh_rpc.sql ✅ NOWA

$ supabase db diff --schema public
# No schema changes found ✅
```

### ✅ Linting
```bash
# Brak błędów w:
# - shared/contracts/types.ts
# - supabase/functions/recipes/recipes.service.ts
# - supabase/functions/recipes/recipes.handlers.ts
```

### ✅ Struktura bazy
- Tabela `normalized_ingredients_jobs` utworzona
- Unikalny indeks na `recipe_id` (deduplikacja)
- Indeks na `(status, created_at)` dla efektywnego pollingu
- Trigger `handle_updated_at()` na `updated_at`
- Polityki RLS dla users i service_role
- Funkcja RPC `enqueue_normalized_ingredients_refresh` dostępna

## Kolejne kroki (poza zakresem tego PR)

### 1. Worker do przetwarzania jobów
- Proces pobierający joby z kolejki (status = PENDING)
- Wywołanie AI API do normalizacji
- Update status → DONE/FAILED + zapisanie wyników
- Retry logic dla failed jobs

### 2. Testy end-to-end
- Uruchomienie `supabase functions serve recipes`
- Wywołanie endpointa z JWT testowego użytkownika
- Weryfikacja odpowiedzi 202
- Sprawdzenie stanu bazy (status PENDING, job w kolejce)
- Test idempotencji (2x wywołanie)

### 3. Monitoring
- Metryki długości kolejki
- Alert na stare joby (PENDING > 1h)
- Dashboard dla retry attempts

## Dokumentacja
- Plan implementacji: `docs/results/impl-plans/endpoints/recipes-normalized-ingredients-refresh-api-implementation-plan.md`
- Testy HTTP: `supabase/functions/recipes/test-requests-normalized-ingredients.http` (Tests 14-25)

## Autor
AI Assistant (Claude Sonnet 4.5) + Grzegorz Świtalski

## Status
✅ Implementacja zakończona (kroki 1-8/8)
⏳ Oczekuje na testy end-to-end i deployment
