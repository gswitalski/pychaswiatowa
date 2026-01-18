### API Endpoints Implementation Plan: Recipes – Normalized Ingredients Refresh (POST /recipes/{id}/normalized-ingredients/refresh)

<analysis>
1. Kluczowe punkty specyfikacji API:
   - Endpoint służy do ręcznego (dev/test) zlecenia ponownej normalizacji składników dla przepisu.
   - Operacja ma być asynchroniczna (enqueue job) i nie może blokować UI ani wykonywać kosztownej normalizacji „w request-cie”.
   - Odpowiedź ma zwracać minimalny stan: `recipe_id` i `status` (docelowo: `PENDING`).

2. Wymagane i opcjonalne parametry:
   - Wymagane: `id` (path), `Authorization: Bearer <JWT>`.
   - Opcjonalne: brak (brak query i brak body).

3. Niezbędne typy DTO / Command modele:
   - Command model: brak (brak body).
   - Response DTO: nowy `RefreshRecipeNormalizedIngredientsResponseDto` (oraz wspólny `NormalizedIngredientsStatus`).

4. Wyodrębnienie logiki do service:
   - Handler powinien tylko: auth + walidacja `id` + wywołanie serwisu + format odpowiedzi.
   - Serwis powinien wykonać logikę „enqueue” (w sposób atomowy: preferowane RPC w Postgres).

5. Walidacja wejścia:
   - `id` musi być dodatnią liczbą całkowitą.
   - JWT wymagany.

6. Rejestrowanie błędów:
   - Brak dedykowanej tabeli błędów w repo; w MVP logowanie przez `logger.*` + standardowe `handleError`.

7. Zagrożenia bezpieczeństwa:
   - Próba odświeżenia normalizacji dla cudzego przepisu → nie może ujawniać istnienia (preferowane `404`).
   - Nadużycie endpointu (wiele wywołań) → deduplikacja jobów i idempotencja.

8. Scenariusze błędów i kody:
   - 400: niepoprawny `id`.
   - 401: brak/niepoprawny JWT.
   - 404: brak dostępu / brak przepisu / soft-deleted.
   - 500: błąd DB/RPC lub nieobsłużony wyjątek.
</analysis>

### 1. Przegląd punktu końcowego

Endpoint **`POST /recipes/{id}/normalized-ingredients/refresh`** służy do **ręcznego zlecenia** ponownej normalizacji składników dla wybranego przepisu.

- **Cel biznesowy**: umożliwić dev/test szybkie wymuszenie ponownego przeliczenia `normalized_ingredients` bez potrzeby ponownego zapisywania przepisu.
- **Zasada działania**: endpoint **nie generuje** znormalizowanych składników w ramach requestu; zamiast tego **enqueue**-uje zadanie do przetworzenia przez worker/scheduler.
- **Idempotencja (zalecane)**: wielokrotne wywołanie dla tego samego `recipe_id` powinno prowadzić do tego samego stanu (job „pending” istnieje), bez tworzenia duplikatów.

### 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes/{id}/normalized-ingredients/refresh`
- **Wymagane nagłówki**:
  - `Authorization: Bearer <JWT>`
- **Parametry**:
  - **Wymagane**:
    - `id` (path) – identyfikator przepisu, dodatnia liczba całkowita (`bigint/int`, `> 0`)
  - **Opcjonalne**: brak
- **Request Body**: brak

#### Walidacja wejścia (guard clauses)

- Jeśli `id` nie jest dodatnią liczbą całkowitą → `400 Bad Request`.
- Jeśli brak/niepoprawny JWT → `401 Unauthorized`.

### 3. Szczegóły odpowiedzi

#### Sukces (202 Accepted)

Operacja jest asynchroniczna (enqueue), dlatego zalecany jest status **`202 Accepted`**.

- **Kod**: `202 Accepted`
- **Payload**:

```json
{
  "recipe_id": 123,
  "status": "PENDING"
}
```

> Uwaga: jeśli w projekcie trzymamy się wyłącznie puli kodów `200/201/400/401/404/500`, alternatywą jest `200 OK` z identycznym payloadem. Rekomendacja pozostaje `202`, bo najlepiej oddaje semantykę „przyjęto do przetworzenia”.

#### Wykorzystywane typy (DTO / Command modele)

Plik: `shared/contracts/types.ts`

- **Nowe/uzupełniane typy (shared kontrakt FE/BE)**:
  - `export type NormalizedIngredientsStatus = 'PENDING' | 'READY' | 'FAILED';`
  - `export interface RefreshRecipeNormalizedIngredientsResponseDto {`
    - `recipe_id: number;`
    - `status: NormalizedIngredientsStatus; // w tym endpointcie zawsze 'PENDING'`
    - `}`

Uwagi:
- Endpoint nie ma Command Modelu (brak body).
- Response DTO jest minimalne, bo endpoint ma służyć jako narzędzie dev/test.

### 4. Przepływ danych

#### 4.1. Warstwa Edge Function (routing → handler → service)

1. **Routing** (`supabase/functions/recipes/recipes.handlers.ts` → `recipesRouter`):
   - dodać rozpoznanie ścieżki `/recipes/{id}/normalized-ingredients/refresh`.
   - **Krytyczne**: sprawdzać tę ścieżkę **przed** fallbackiem „POST z recipeId niedozwolony” i przed `extractRecipeIdFromPath(url)`, aby nie trafić w obecny branch `METHOD_NOT_ALLOWED`.

2. **Handler** (`recipes.handlers.ts`):
   - `getAuthenticatedContext(req)` (JWT),
   - walidacja `id` (parse do int, `> 0`),
   - wywołanie serwisu `enqueueRecipeNormalizedIngredientsRefresh(...)`,
   - zwrócenie `202` + `RefreshRecipeNormalizedIngredientsResponseDto`.

3. **Service** (`supabase/functions/recipes/recipes.service.ts`):
   - ustawia stan normalizacji jako `PENDING` i czyści `normalized_ingredients_updated_at` (NULL),
   - zapisuje/odświeża job w kolejce (deduplikacja po `recipe_id`),
   - loguje metryki (`recipeId`, `userId`, czas, czy job był już w kolejce), bez logowania treści składników.

#### 4.2. Źródła danych (DB) – rekomendowana struktura

Endpoint „refresh” zakłada istnienie (lub wprowadzenie) zasobów DB spójnych z planami:
- `POST/PUT /recipes` (async enqueue normalizacji),
- `GET /recipes/{id}/normalized-ingredients` (odczyt statusu i wyników).

Minimalny zestaw:

1. **Kolumny w `recipes`** (status + timestamp):
   - `recipes.normalized_ingredients_status` (`text` albo `enum`) – NOT NULL, default `PENDING`
   - `recipes.normalized_ingredients_updated_at` (`timestamptz`, nullable)

2. **Tabela kolejki (enqueue)**:
   - `normalized_ingredients_jobs` (przykładowo):
     - `id` (uuid/bigint)
     - `recipe_id bigint NOT NULL REFERENCES recipes(id) ON DELETE CASCADE`
     - `user_id uuid NOT NULL`
     - `status text NOT NULL` (`PENDING|RUNNING|DONE|FAILED`)
     - `attempts int NOT NULL DEFAULT 0`
     - `last_error text NULL`
     - `created_at timestamptz NOT NULL DEFAULT now()`
     - `updated_at timestamptz NOT NULL DEFAULT now()`
   - **Deduplikacja**: unikalny indeks na `recipe_id` (lub unikalność na `(recipe_id)` + semantyka „ostatnie wywołanie wygrywa”).

3. **RLS** (dla `normalized_ingredients_jobs`):
   - `INSERT/UPDATE/SELECT` tylko, jeśli `auth.uid()` jest właścicielem powiązanego przepisu (`recipes.user_id = auth.uid()`) i `recipes.deleted_at IS NULL`.

#### 4.3. Atomowość operacji (zalecenie)

Ponieważ endpoint „refresh” dotyka co najmniej 2 rzeczy (status przepisu + job), zalecane jest wykonanie tego w **jednej transakcji** w Postgres.

Rekomendacja:
- dodać RPC, np. `enqueue_normalized_ingredients_refresh(p_recipe_id bigint)`:
  - sprawdza własność przepisu (`recipes.user_id = auth.uid()` i `deleted_at IS NULL`),
  - ustawia `recipes.normalized_ingredients_status='PENDING'`,
  - ustawia `recipes.normalized_ingredients_updated_at=NULL`,
  - upsert do `normalized_ingredients_jobs` (status `PENDING`, `updated_at=now()`),
  - zwraca `{ recipe_id, status }` (lub `void` + odczyt w serwisie).

### 5. Względy bezpieczeństwa

- **Uwierzytelnianie (AuthN)**:
  - wymagany JWT (`Authorization: Bearer <JWT>`), inaczej `401`.
- **Autoryzacja (AuthZ) / anti-leak**:
  - caller musi mieć dostęp do przepisu (RLS).
  - rekomendacja: zwracać `404` zarówno dla „nie istnieje”, jak i „brak dostępu”, aby nie ujawniać istnienia cudzego zasobu.
- **Soft delete**:
  - operacja ma być niemożliwa dla `deleted_at IS NOT NULL` (weryfikacja w RPC/politykach).
- **Odporność na nadużycia**:
  - endpoint jest dev/test, ale nadal warto:
    - deduplikować joby po `recipe_id`,
    - traktować endpoint jako idempotentny.
- **Bezpieczne logowanie**:
  - nie logować JWT, nie logować treści składników; logować tylko metryki.

### 6. Obsługa błędów

#### Scenariusze i kody

- **400 Bad Request**
  - `id` nie jest dodatnią liczbą całkowitą.
- **401 Unauthorized**
  - brak/niepoprawny JWT.
- **404 Not Found**
  - przepis nie istnieje, jest soft-deleted lub użytkownik nie ma dostępu (anti-leak).
- **500 Internal Server Error**
  - błąd DB/RPC, niespójność danych, nieobsłużony wyjątek.

#### Format błędu

Spójnie z istniejącą infrastrukturą Supabase Edge Functions w repo:
- używać `ApplicationError` + `handleError(error)` z `supabase/functions/_shared/errors.ts`.

#### Rejestrowanie błędów w tabeli błędów

W obecnym repo brak dedykowanej tabeli błędów:
- MVP: `logger.error(...)` (stdout/logi Supabase Functions),
- (opcjonalnie) przyszłościowo: tabela telemetry `error_events` dla `5xx` (best-effort, asynchronicznie).

### 7. Wydajność

- **Stała liczba operacji DB**:
  - preferowane 1 RPC call (atomowo) zamiast kilku round-tripów.
- **Indeksy**:
  - unikalny indeks na `normalized_ingredients_jobs(recipe_id)` przyspiesza upsert i eliminuje duplikaty.
- **Idempotencja**:
  - wielokrotne wywołania nie generują lawiny jobów (ta sama pozycja w kolejce jest odświeżana).

### 8. Kroki implementacji

1. **Kontrakt FE/BE (shared)**
   - Dodać do `shared/contracts/types.ts`:
     - `NormalizedIngredientsStatus`,
     - `RefreshRecipeNormalizedIngredientsResponseDto`.

2. **Migracje DB**
   - Dodać migracje w `supabase/migrations/`:
     - kolumny: `recipes.normalized_ingredients_status`, `recipes.normalized_ingredients_updated_at`,
     - tabela `normalized_ingredients_jobs` + unikalność po `recipe_id`,
     - polityki RLS dla `normalized_ingredients_jobs`.

3. **RPC (rekomendowane)**
   - Dodać funkcję Postgres `enqueue_normalized_ingredients_refresh(p_recipe_id bigint)`:
     - autoryzacja przez `auth.uid()` + `deleted_at IS NULL`,
     - update statusu + upsert job w jednej transakcji.

4. **Service**
   - W `supabase/functions/recipes/recipes.service.ts` dodać:
     - `enqueueRecipeNormalizedIngredientsRefresh(client, { recipeId, userId })`
       - preferowane: `client.rpc('enqueue_normalized_ingredients_refresh', ...)`
       - mapowanie błędów DB na `ApplicationError` (`NOT_FOUND`, `INTERNAL_ERROR`).

5. **Handler**
   - W `supabase/functions/recipes/recipes.handlers.ts` dodać:
     - extractor ścieżki: `extractRecipeIdFromNormalizedIngredientsRefreshPath(url)`,
     - handler: `handlePostRecipeNormalizedIngredientsRefresh(req, recipeIdParam)`:
       - auth + walidacja + wywołanie serwisu + `202`.

6. **Routing**
   - W `recipesRouter` dodać obsługę:
     - `POST /recipes/{id}/normalized-ingredients/refresh` (sprawdzane przed `POST` „recipeId not allowed”).

7. **Testy ręczne (http)**
   - Dodać requesty do pliku testowego (np. `supabase/functions/recipes/test-requests.http`):
     - poprawny case (202),
     - brak JWT (401),
     - niepoprawny `id` (400),
     - brak dostępu / nieistniejący (404),
     - idempotencja (2 wywołania pod rząd → nadal `PENDING`, brak duplikacji w kolejce).

8. **Checklist**
   - Zweryfikować:
     - anti-leak (`404` dla braku dostępu),
     - brak duplikatów jobów,
     - status przepisu resetowany do `PENDING` i `updated_at=NULL`,
     - logi bez danych wrażliwych.

