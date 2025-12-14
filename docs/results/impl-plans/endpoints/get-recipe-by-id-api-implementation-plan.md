# API Endpoints Implementation Plan: GET /recipes/{id}

## 1. Przegląd punktu końcowego
Endpoint zwraca szczegóły pojedynczego przepisu po `id`.

Zmiana funkcjonalna obejmuje doprecyzowanie autoryzacji:
- `403 Forbidden` zwracamy **tylko wtedy**, gdy przepis **nie jest publiczny** i użytkownik **nie jest właścicielem**.
- `404 Not Found` zwracamy, gdy zasób nie istnieje (albo jest soft-deleted).

W praktyce oznacza to, że użytkownik zalogowany może pobrać szczegóły przepisu innego autora, jeśli `visibility = PUBLIC`.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL (Supabase Edge Function)**: `/functions/v1/recipes/{id}`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
- **Parametry**:
    - **Wymagane**:
        - `id` (path) — dodatnia liczba całkowita
    - **Opcjonalne**: brak
- **Request Body**: brak

## 3. Wykorzystywane typy
- **Odpowiedź (200)**: `RecipeDetailDto`
    - bazuje na danych z widoku `recipe_details` (JSONB dla `ingredients`/`steps`, `tags` jako lista DTO)

## 4. Szczegóły odpowiedzi
- **200 OK** — `RecipeDetailDto`

- **Odpowiedzi błędów**:
    - `400 Bad Request` — `id` nie jest poprawną dodatnią liczbą całkowitą
    - `401 Unauthorized` — brak/niepoprawny JWT
    - `403 Forbidden` — przepis istnieje, ale `visibility != PUBLIC` i użytkownik nie jest właścicielem
    - `404 Not Found` — przepis nie istnieje lub został soft-deleted
    - `500 Internal Server Error` — błąd serwera / bazy

## 5. Przepływ danych
1. Żądanie trafia do `supabase/functions/recipes/index.ts` i dalej do `recipesRouter`.
2. Router dopasowuje ścieżkę `/recipes/{id}` i wywołuje `handleGetRecipeById`.
3. Handler:
    - waliduje `id` (już istnieje `parseAndValidateRecipeId`),
    - pobiera kontekst uwierzytelnienia (`getAuthenticatedContext`) i `userId`,
    - wywołuje serwis `getRecipeById` przekazując `recipeId` i `requesterUserId`.
4. Serwis realizuje dostęp wg reguł:

   **Krok A (happy path — dostęp przez standardowy klient uwierzytelniony):**
   - próbuje pobrać `recipe_details` dla `id` przez klienta z JWT.
   - jeśli rekord zostanie zwrócony, endpoint zwraca `200`.

   **Krok B (rozróżnienie 403 vs 404 — fallback z użyciem service role):**
   - jeśli zapytanie z kroku A nie zwróciło wiersza (`PGRST116`), serwis wykonuje weryfikację istnienia i widoczności przepisu klientem service-role (bypass RLS):
        1) `SELECT user_id, visibility, deleted_at FROM recipes WHERE id = :id`.
        2) jeśli brak rekordu lub `deleted_at IS NOT NULL` → `404`.
        3) jeśli `visibility != 'PUBLIC'` i `user_id != requesterUserId` → `403`.
        4) jeśli `visibility == 'PUBLIC'` → pobrać pełne dane z `recipe_details` service-role i zwrócić `200`.

Ta sekwencja pozwala spełnić wymaganie „403 tylko dla niepublicznego i nie-właściciela”, bez „maskowania” zasobu jako 404.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany JWT; brak tokena → `401`.
- **Bezpieczne użycie service role**:
    - service-role jest używany wyłącznie do:
        - sprawdzenia istnienia (`recipes.id`) i statusu (`visibility`, `deleted_at`, `user_id`),
        - pobrania publicznego przepisu (`visibility=PUBLIC`) w przypadku, gdy RLS uniemożliwia odczyt przez klienta uwierzytelnionego.
    - filtr `visibility == 'PUBLIC'` jest krytyczny — bez niego można przypadkowo ujawnić prywatne dane.
- **Walidacja wejścia**: `id` musi być liczbą dodatnią; żadnych innych danych wejściowych.

## 7. Wydajność
- Zapytanie podstawowe jest po PK (`id`) i korzysta z indeksu.
- Fallback wykonuje maksymalnie 1–2 dodatkowe szybkie zapytania; wpływ na wydajność jest minimalny.
- Widok `recipe_details` agreguje dane, zmniejszając liczbę round-tripów.

## 8. Kroki implementacji
1. **Serwis** (`supabase/functions/recipes/recipes.service.ts`)
    - zmienić `getRecipeById(client, id)` tak, aby przyjmował także `requesterUserId` (lub stworzyć wrapper, np. `getRecipeByIdWithAccessCheck({ client, recipeId, requesterUserId })`).
    - dodać logikę fallback (service-role) opisaną w sekcji 5.
    - użyć `createServiceRoleClient()` z `supabase/functions/_shared/supabase-client.ts`.
2. **Handler** (`supabase/functions/recipes/recipes.handlers.ts`)
    - przekazać `user.id` do serwisu w wywołaniu `getRecipeById`.
    - upewnić się, że błędy są mapowane na kody:
        - `ApplicationError('FORBIDDEN', ...)` → 403
        - `ApplicationError('NOT_FOUND', ...)` → 404
        - `ApplicationError('VALIDATION_ERROR', ...)` → 400
3. **Testy manualne (smoke)**
    - zalogowany właściciel: `GET /recipes/{id}` dla własnego PRIVATE → 200
    - zalogowany nie-właściciel: `GET /recipes/{id}` dla cudzego PRIVATE → 403
    - zalogowany nie-właściciel: `GET /recipes/{id}` dla cudzego PUBLIC → 200
    - dowolny użytkownik: `GET /recipes/{id}` dla nieistniejącego / soft-deleted → 404
