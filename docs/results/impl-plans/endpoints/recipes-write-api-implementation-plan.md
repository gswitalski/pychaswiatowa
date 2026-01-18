# API Endpoints Implementation Plan: Recipes Write (POST /recipes + PUT /recipes/{id}) + async `normalized_ingredients`

## 1. Przegląd punktu końcowego

Ten plan opisuje wdrożenie (i dostosowanie istniejącej implementacji) endpointów zapisu przepisu:

- **`POST /recipes`** – utworzenie nowego przepisu
- **`PUT /recipes/{id}`** – aktualizacja istniejącego przepisu

Zakres zmian wynika z wymagań MVP: po każdym zapisie przepisu backend **asynchronicznie zleca** wyliczenie `normalized_ingredients` (bez blokowania odpowiedzi), a odpowiedź API zawiera pola:

- `normalized_ingredients_status`
- `normalized_ingredients_updated_at`

W projekcie backend jest realizowany jako **Supabase Edge Functions (TypeScript/Deno)** z modularną strukturą (`index.ts` routing, `*.handlers.ts` walidacja + response, `*.service.ts` logika biznesowa) oraz walidacją `Zod`. Zapis przepisów jest wykonywany transakcyjnie przez RPC w PostgreSQL.

## 2. Szczegóły żądania

### `POST /recipes`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes`
- **Wymagane nagłówki**:
  - `Authorization: Bearer <JWT>` (wymagane)
  - `Content-Type: application/json`
- **Parametry URL**: brak
- **Request Body (JSON)** – model: `CreateRecipeCommand`
  - **Wymagane**:
    - `name` (string, 1–150)
    - `ingredients_raw` (string, wymagane, min 1 znak)
    - `steps_raw` (string, wymagane, min 1 znak)
    - `visibility` (`PRIVATE | SHARED | PUBLIC`)
    - `tags` (string[], może być pusta; w praktyce może być opcjonalne i domyślne `[]`)
  - **Opcjonalne**:
    - `description` (string | null)
    - `tips_raw` (string | null) – opcjonalne
    - `category_id` (number | null)
    - `servings` (number | null, int 1–99)
    - `is_termorobot` (boolean)
    - `prep_time_minutes` (number | null, int 0–999)
    - `total_time_minutes` (number | null, int 0–999)
    - `diet_type` (`MEAT | VEGETARIAN | VEGAN` | null)
    - `cuisine` (enum cuisine | null)
    - `difficulty` (`EASY | MEDIUM | HARD` | null)
    - `is_grill` (boolean)
- **Walidacja cross-field (Business Rule)**:
  - jeśli `prep_time_minutes` i `total_time_minutes` są ustawione (nie-null), to `total_time_minutes >= prep_time_minutes` (w przeciwnym razie `400`).

### `PUT /recipes/{id}`

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/recipes/{id}`
- **Wymagane nagłówki**:
  - `Authorization: Bearer <JWT>` (wymagane)
  - `Content-Type: application/json`
- **Parametry URL**:
  - **Wymagane**: `id` (bigint/int, dodatni)
- **Request Body (JSON)** – model: `UpdateRecipeCommand`
  - Wszystkie pola są opcjonalne, ale **co najmniej jedno** musi być podane.
  - Jak w `CreateRecipeCommand` + dodatkowo:
    - `image_path` (string | null) – jeżeli aktualizowane obrazki są wspierane przez ten endpoint (w MVP jest obsługiwane również przez upload do Storage, ale pole występuje w modelu).
- **Walidacja cross-field** jak wyżej.

## 3. Wykorzystywane typy

### Kontrakty (shared)

- **Command modele**:
  - `CreateRecipeCommand` (`shared/contracts/types.ts`)
  - `UpdateRecipeCommand` (`shared/contracts/types.ts`)

- **Response DTO**:
  - Obecnie zapisy zwracają `RecipeDetailDto` (z `shared/contracts/types.ts`)
  - W ramach zmian należy rozszerzyć DTO odpowiedzi o:
    - `normalized_ingredients_status: 'PENDING' | 'READY' | 'FAILED'` *(lub zgodnie z ustaleniami schematu DB; minimum: `PENDING`, bo zapis zawsze zleca normalizację)*
    - `normalized_ingredients_updated_at: string | null`

Rekomendacja: dodać w `shared/contracts/types.ts` nowy typ:

- `export type NormalizedIngredientsStatus = 'PENDING' | 'READY' | 'FAILED';`

i użyć go w:

- `RecipeDetailDto`
- (opcjonalnie) w `PublicRecipe*Dto`, jeśli publiczne detale mają to zwracać – w obecnym API planie pola te są wymagane głównie dla zasobów prywatnych.

### Typy backendowe (Edge Function)

W `supabase/functions/recipes/recipes.service.ts` istnieją własne interfejsy (lokalne DTO) – należy je zsynchronizować z kontraktami:

- `CreateRecipeInput`
- `UpdateRecipeInput`
- `RecipeDetailDto` (backendowa wersja)

Docelowo: backendowy `RecipeDetailDto` również ma zawierać `normalized_ingredients_status` i `normalized_ingredients_updated_at`.

## 4. Przepływ danych

### 4.1. Utworzenie przepisu (`POST /recipes`)

1. **Handler**:
   - weryfikuje JWT (`getAuthenticatedContext`)
   - waliduje body Zod (w tym reguła `total_time_minutes >= prep_time_minutes`)
   - mapuje na `CreateRecipeInput`

2. **Service (happy path)**:
   - wywołuje transakcyjny RPC `create_recipe_with_tags(...)`, który:
     - parsuje `ingredients_raw`, `steps_raw`, `tips_raw` przez funkcję DB `parse_text_to_jsonb(text)` i zapisuje do `recipes.ingredients`, `recipes.steps`, `recipes.tips`
     - tworzy tagi (unikalność per user, `lower(name)`) i wpisy w `recipe_tags`
     - ustawia pola przepisu z payloadu
     - **USTAWIA status normalizacji** jako `PENDING` oraz czyści `normalized_ingredients_updated_at` (NULL) – nowy wymóg

3. **Po transakcji (nie blokuje odpowiedzi)**:
   - backend **zleca** (enqueue) normalizację składników:
     - wariant A (zalecany): zapis do tabeli kolejki `normalized_ingredients_jobs` (PENDING) + worker/scheduler przetwarza
     - wariant B: best-effort „fire-and-forget” wywołanie funkcji normalizującej (ryzyko braku gwarancji wykonania; niezalecane)

4. **Odpowiedź**:
   - `201 Created` + pełny obiekt przepisu (`RecipeDetailDto`) zawierający `normalized_ingredients_status='PENDING'` i `normalized_ingredients_updated_at=null`.

### 4.2. Aktualizacja przepisu (`PUT /recipes/{id}`)

1. **Handler**:
   - weryfikuje JWT
   - waliduje `id` (dodatni int)
   - waliduje body Zod (min 1 pole, + reguła czasów)
   - mapuje na `UpdateRecipeInput`

2. **Service**:
   - wywołuje transakcyjny RPC `update_recipe_with_tags(...)`, który:
     - aktualizuje tylko pola wskazane przez flagi `p_update_*`
     - w razie aktualizacji `ingredients_raw`/`steps_raw`/`tips_raw` parsuje przez `parse_text_to_jsonb`
     - w razie aktualizacji tagów dokonuje pełnej synchronizacji relacji `recipe_tags`
     - **USTAWIA status normalizacji** jako `PENDING` (i `normalized_ingredients_updated_at=NULL`) gdy zmieniły się składniki (minimum) lub zawsze po zapisie (zgodnie z wymaganiem „po każdym PUT”; rekomendacja: *po każdym PUT*, ale warto warunkowo, żeby nie generować kosztów)

3. **Po transakcji (nie blokuje odpowiedzi)**:
   - enqueue job normalizacji analogicznie jak dla POST

4. **Odpowiedź**:
   - `200 OK` + pełny obiekt przepisu z polami statusu.

### 4.3. Asynchroniczna normalizacja (backend-only)

Wymaganie: `normalized_ingredients` ma być generowane asynchronicznie i zapisywane w backendzie, ignorując nagłówki sekcji i przetwarzając tylko elementy `type='item'`.

**Zalecana architektura**:

- **Tabela kolejki** (PostgreSQL):
  - `normalized_ingredients_jobs`:
    - `id` (uuid/bigint)
    - `recipe_id` (bigint)
    - `user_id` (uuid)
    - `status` (`PENDING|RUNNING|DONE|FAILED`)
    - `attempts` (int)
    - `created_at`, `updated_at`
    - `last_error` (text, nullable)
  - unikalność: `(recipe_id)` lub `(recipe_id, status in pending/running)` – aby deduplikować

- **Worker** (Supabase):
  - Scheduled Edge Function (cron) lub inny mechanizm (np. pg_cron + HTTP call) przetwarza PENDING
  - Worker:
    1. pobiera job (lock/atomic update do RUNNING)
    2. czyta `recipes.ingredients` (JSONB) i filtruje elementy `type='item'`
    3. woła `POST /ai/recipes/normalized-ingredients` (Edge Function AI) z `allowed_units` (w tym `pęczek`) i przepisem
    4. zapisuje wynik do docelowej struktury (tabela wynikowa)
    5. ustawia:
       - `recipes.normalized_ingredients_status='READY'`
       - `recipes.normalized_ingredients_updated_at=now()`
       - ewentualnie `FAILED` + `last_error`

- **Tabela wynikowa**:
  - wariant 1: `recipe_normalized_ingredients` (1 row per recipe z JSONB `items`)
  - wariant 2: `recipe_normalized_ingredient_items` (1 row per item, lepsze do przyszłych list zakupów)

**Reguły normalizacji (Business Rules)**:

- ignoruj `type='header'`
- `unit` z listy dozwolonych (MVP): `g`, `ml`, `szt.`, `ząbek`, `łyżeczka`, `łyżka`, `szczypta`, `pęczek`
- konwersje tylko masa/objętość (np. `kg→g`, `l→ml`)
- jeśli nie da się pewnie wyznaczyć ilości/jednostki (np. „do smaku”, „opcjonalnie”, „na oko”) → `amount=null`, `unit=null`, tylko `name`

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**:
  - `POST /recipes` i `PUT /recipes/{id}` wymagają JWT (`401` gdy brak/niepoprawny).

- **Autoryzacja / RLS**:
  - operacje zapisu muszą być ograniczone do właściciela (`recipes.user_id = auth.uid()`).
  - RPC powinny działać w kontekście użytkownika (authenticated client), a nie service role.

- **Ochrona przed nadużyciami / koszty AI**:
  - normalizacja jest asynchroniczna; należy ograniczyć koszt:
    - deduplikacja zadań (jeśli kilka zapisów w krótkim czasie, tylko ostatni job ma sens)
    - rate limiting per user (na poziomie worker/AI function) – opcjonalne, ale zalecane

- **Walidacja i sanityzacja**:
  - Zod waliduje typy i rozmiary pól; zalecane:
    - `.trim()` dla stringów
    - limit liczby tagów (np. max 20) i unikanie duplikatów po `.toLowerCase().trim()`
  - surowy tekst `*_raw` jest parsowany w DB; wejście powinno być traktowane jako dane użytkownika (bez wykonywania jako SQL).

## 6. Obsługa błędów

### 6.1. Kody statusu (wymagane minimum)

- `201` – poprawne utworzenie przepisu (`POST /recipes`)
- `200` – poprawna aktualizacja (`PUT /recipes/{id}`)
- `400` – walidacja wejścia (Zod, reguła czasów, niepoprawny JSON)
- `401` – brak/niepoprawny JWT
- `404` – przepis nie istnieje (lub brak dostępu wynikający z RLS/RPC)
- `500` – błąd serwera (nieobsłużony, błąd DB)

### 6.2. Scenariusze błędów

- `400`:
  - invalid JSON
  - `name` za długie / puste
  - `ingredients_raw` lub `steps_raw` puste
  - `total_time_minutes < prep_time_minutes`
  - `PUT` bez żadnego pola
  - `id` nie jest dodatnią liczbą całkowitą

- `401`:
  - brak `Authorization`
  - niepoprawny token

- `404`:
  - `PUT` dla nieistniejącego przepisu
  - kategoria nie istnieje (`category_id`) (zgodnie z obecnym mapowaniem błędów w RPC)

- `500`:
  - błąd RPC/DB, nieprzewidziane wyjątki

### 6.3. Rejestrowanie błędów w tabeli błędów

W obecnym repo brak dedykowanej tabeli do logowania błędów aplikacyjnych. Zalecane podejście na teraz:

- logowanie przez `logger` (info/warn/error) w handlerach i serwisach
- opcjonalnie (future): dodać tabelę `api_errors` i w `handleError` (lub wrapperze) wykonywać best-effort insert dla błędów `INTERNAL_ERROR`/`UNEXPECTED`.

## 7. Wydajność

- **Zapis przepisu**:
  - używać RPC do transakcyjnego zapisu (już istnieje) – minimalizuje roundtripy i zapewnia spójność danych.

- **Normalizacja składników**:
  - musi być poza ścieżką request/response (asynchronicznie), bo:
    - może być kosztowna (LLM)
    - może mieć niestabilne czasy odpowiedzi
  - rekomendacje:
    - deduplikacja zadań per `recipe_id`
    - przetwarzanie batch (np. max N jobów per tick)
    - retry z backoff (max attempts)

## 8. Kroki implementacji

1. **Doprecyzować kontrakt statusów**:
   - ustalić finalne wartości `normalized_ingredients_status` (min. `PENDING`, `READY`, `FAILED`) i typ kolumny (enum/text).

2. **Zmiany w schemacie DB**:
   - dodać do `recipes`:
     - `normalized_ingredients_status` (enum/text, NOT NULL, default `PENDING` lub `READY` zależnie od migracji)
     - `normalized_ingredients_updated_at` (timestamptz, nullable)
   - dodać strukturę docelową na wynik normalizacji (tabela lub JSONB).
   - dodać tabelę kolejki jobów (zalecane).

3. **Zmiany w SQL (RPC + widoki)**:
   - zaktualizować `create_recipe_with_tags`:
     - ustawia `normalized_ingredients_status='PENDING'`
     - ustawia `normalized_ingredients_updated_at=NULL`
   - zaktualizować `update_recipe_with_tags` analogicznie (warunkowo lub zawsze).
   - zaktualizować `recipe_details` view (i typy supabase) tak, by zawierał nowe pola (jeśli `RecipeDetailDto` bazuje na widoku).

4. **Backend – Edge Function `recipes`**:
   - w `supabase/functions/recipes/recipes.service.ts`:
     - rozszerzyć `RECIPE_DETAIL_SELECT_COLUMNS` o nowe pola (jeśli są w widoku)
     - rozszerzyć mapowanie `RecipeDetailDto` o `normalized_ingredients_status`, `normalized_ingredients_updated_at`
     - po `createRecipe`/`updateRecipe` dodać krok **enqueue job** (nie blokujący odpowiedzi):
       - preferowane: insert/upsert do `normalized_ingredients_jobs`
       - logować best-effort błędy enqueue jako warn, nie failować requestu
   - w `supabase/functions/recipes/recipes.handlers.ts`:
     - brak zmian w status codes; upewnić się, że odpowiedź DTO zawiera nowe pola.

5. **Worker normalizacji**:
   - dodać nową Edge Function (np. `supabase/functions/normalized-ingredients-worker/` lub pod `ai/`) z modularną strukturą:
     - `index.ts` routing (np. cron)
     - `*.handlers.ts` – walidacja i orchestracja
     - `*.service.ts` – pobranie jobów, call do AI endpointu, zapis wyników, aktualizacja statusów
   - zaimplementować retry i deduplikację jobów.

6. **Kontrakty współdzielone (frontend/backend)**:
   - zaktualizować `shared/contracts/types.ts`:
     - dodać typ statusu
     - rozszerzyć `RecipeDetailDto` (i ewentualnie inne DTO) o nowe pola

7. **Testy / weryfikacja (manual + automatyczne)**:
   - manualnie:
     - `POST /recipes` → w odpowiedzi `normalized_ingredients_status='PENDING'`
     - `PUT /recipes/{id}` → status przechodzi na `PENDING` po zapisie
     - worker przetwarza job i ustawia `READY` + `updated_at`
   - testy jednostkowe serwisu worker (parsing input, mapping, retry) – jeśli repo ma infrastrukturę testową dla Deno/Supabase functions.

