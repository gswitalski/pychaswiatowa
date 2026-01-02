# API Endpoints Implementation Plan: GET /public/recipes/{id}

## 1. Przegląd punktu końcowego

Endpoint `GET /public/recipes/{id}` zwraca **szczegóły pojedynczego publicznego przepisu** na potrzeby publicznych, share’owalnych stron przepisu.

Zmiana w kontrakcie (doprecyzowanie):
- Frontend używa kanonicznego routingu UI: `/explore/recipes/{id}-{slug}`.
- API pozostaje **identyfikowane po numerycznym `id`** i nie korzysta z `slug` (slug jest wyłącznie troską frontendu/SEO).

W repozytorium endpoint jest już zaimplementowany w Edge Function `public`:
- `/functions/v1/public/recipes/{id}`

## 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/{id}` (w Supabase: `/functions/v1/public/recipes/{id}`)
- **Parametry**:
  - **Wymagane**:
    - `id` (path param): dodatnia liczba całkowita
  - **Opcjonalne**:
    - nagłówek `Authorization: Bearer <JWT>` (opcjonalny; gdy obecny i poprawny, API dodaje pola pomocnicze)
- **Request Body**: brak

## 3. Wykorzystywane typy

### Kontrakt (frontend/shared)
- `PublicRecipeDetailDto` (`shared/contracts/types.ts`)
  - `id`, `name`, `description`, `image_path`, `visibility`, `category`, `ingredients`, `steps`, `tags`, `author`, `created_at`
  - pola pomocnicze: `is_owner`, `in_my_plan`

### Backend (Edge Function `public`)
- `GetPublicRecipeByIdParams` (`supabase/functions/public/public.types.ts`)
  - `id: number`

## 4. Szczegóły odpowiedzi

### Sukces
- **Kod**: `200 OK`
- **Payload**: `PublicRecipeDetailDto`

Wymagane zachowanie:
- `visibility` w odpowiedzi: `'PUBLIC'`
- `is_owner`:
  - `false` dla anon
  - `true` tylko jeśli JWT jest poprawny i `user_id` przepisu == `auth.user.id`
- `in_my_plan`:
  - `false` dla anon
  - `true` tylko jeśli przepis znajduje się w `plan_recipes` użytkownika

### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**: `id` nie jest dodatnią liczbą całkowitą
- **`401 Unauthorized`**: JWT obecny, ale niepoprawny / wygasły (dotyczy tylko sytuacji, gdy klient dołącza nagłówek Authorization)
- **`404 Not Found`**: brak przepisu / przepis nie jest publiczny / przepis jest soft-deleted
- **`500 Internal Server Error`**: błąd po stronie serwera (DB lub nieoczekiwany)

## 5. Przepływ danych

1. Klient wywołuje `GET /public/recipes/{id}` (opcjonalnie z `Authorization`).
2. `supabase/functions/public/index.ts`:
   - obsługuje CORS (OPTIONS),
   - deleguje do `publicRouter`.
3. `publicRouter` (`public.handlers.ts`):
   - dopasowuje ścieżkę regexem `^/recipes/([^/]+)$`,
   - kieruje do `handleGetPublicRecipeById`.
4. `handleGetPublicRecipeById`:
   - opcjonalnie pobiera użytkownika (anon lub authenticated),
   - waliduje `id` (Zod transform → `number`),
   - tworzy klienta `service role`,
   - wywołuje `getPublicRecipeById(client, { id }, userId)`.
5. `getPublicRecipeById` (`public.service.ts`):
   - czyta z widoku `recipe_details`
   - warunki bezpieczeństwa:
     - `visibility = 'PUBLIC'`
     - `deleted_at IS NULL`
   - pobiera autora z `profiles`
   - jeśli JWT: sprawdza, czy przepis jest w `plan_recipes` użytkownika
   - mapuje wynik do `PublicRecipeDetailDto`

## 6. Względy bezpieczeństwa

- **Dostęp anon**:
  - zwracamy wyłącznie przepisy publiczne (`visibility='PUBLIC'`) i nieusunięte (`deleted_at IS NULL`).
- **JWT opcjonalny**:
  - JWT wpływa wyłącznie na pola pomocnicze (`is_owner`, `in_my_plan`), a nie na “otwieranie” dostępu do cudzych niepublicznych danych.
- **RLS**:
  - endpoint używa `service role` i sam egzekwuje reguły widoczności (właściwe filtry w zapytaniu).
- **Brak zależności od `slug`**:
  - slug nie jest częścią API; frontend ma obowiązek parsować `id` z routingu UI.
  - rekomendacja: w kodzie frontendu walidować `id` oraz normalizować URL do kanonicznego sluga po pobraniu danych.

## 7. Obsługa błędów

### Scenariusze i reakcje
- `400` (`VALIDATION_ERROR`):
  - `id` nie daje się sparsować do dodatniej liczby całkowitej
- `401` (`UNAUTHORIZED`):
  - klient podał `Authorization`, ale token jest niepoprawny; wówczas request traktujemy jako błąd (nie “spadamy” do anon)
- `404` (`NOT_FOUND`):
  - brak rekordu w `recipe_details` spełniającego filtry
- `500` (`INTERNAL_ERROR`):
  - błędy DB (np. Supabase error) lub brak profilu autora

### Rejestrowanie błędów w tabeli
- Brak tabeli błędów w obecnym schemacie: **nie dotyczy**.
- Diagnostyka: strukturalne logi w Supabase (`_shared/logger.ts`) + kody błędów z `_shared/errors.ts`.

## 8. Rozważania dotyczące wydajności

- Zapytanie bazuje na widoku `recipe_details`, co minimalizuje koszt joinów i problem N+1 (zachowane).
- Dodatkowe zapytania:
  - `profiles` (1 zapytanie)
  - `plan_recipes` (opcjonalnie, tylko gdy JWT)
- Rekomendacja: utrzymać caching publiczny dla anon i `no-store` dla authenticated (w repo jest to już zaadresowane w `createCachedResponse` dla list; dla detalu można rozważyć identyczną politykę cache, jeśli potrzebne).

## 9. Kroki implementacji

### A) Zmiana kontraktu (doprecyzowanie) – prace minimalne
1. Zaktualizować dokumentację API (jeśli istnieją dodatkowe docs) o notę:
   - UI route `/explore/recipes/{id}-{slug}` jest frontend-only,
   - API zawsze po `id`.
2. Zweryfikować, że frontend parsuje `id` i nie wywołuje API z `{id}-{slug}`.
3. Dodać manualny scenariusz testowy:
   - anon: publiczny przepis → 200
   - anon: niepubliczny przepis → 404
   - auth: publiczny przepis → 200 + poprawne `is_owner`/`in_my_plan`
   - auth: zły token → 401

### B) (Opcjonalnie) wzmocnienie ergonomii – do decyzji zespołu
4. Jeśli chcemy “odporności” na błędy klienta:
   - dopuścić `id` w formacie `"{id}-{slug}"` i parsować część numeryczną przed `-`
   - UWAGA: to zmienia zachowanie walidacji (część klientów może przypadkiem polegać na tej tolerancji), więc decyzję podjąć świadomie.


