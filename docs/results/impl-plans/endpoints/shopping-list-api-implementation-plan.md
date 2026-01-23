# API Endpoints Implementation Plan: `DELETE /shopping-list`

> **Plik**: `docs/results/impl-plans/endpoints/shopping-list-api-implementation-plan.md`  
> **Backend**: Supabase Edge Function `supabase/functions/shopping-list/` (TypeScript, Deno)  
> **Cel biznesowy (US-054)**: wyczyścić całą listę zakupów (pozycje ręczne + pochodzące z przepisów) **bez modyfikowania** „Mojego planu”.

## 1. Przegląd punktu końcowego

Endpoint usuwa **wszystkie** wiersze z tabeli `shopping_list_items` dla zalogowanego użytkownika.

Wymagania specyfikacji (MVP):
- usuwa zarówno `kind='MANUAL'`, jak i `kind='RECIPE'`
- **nie** usuwa przepisów z „Mojego planu”
- operacja jest idempotentna (jeśli lista już pusta, nadal sukces)

## 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/shopping-list`
- **Nagłówki**:
  - Wymagane: `Authorization: Bearer <JWT>`
- **Parametry**:
  - Wymagane: brak
  - Opcjonalne: brak
- **Request Body**: brak

## 3. Wykorzystywane typy

Brak request/response DTO wymaganych przez kontrakt (brak body i brak payload w odpowiedzi).

Powiązane (istniejące) typy w `shared/contracts/types.ts`:
- `GetShoppingListResponseDto` (używany w `GET /shopping-list`, przydatny do weryfikacji efektu)

## 4. Przepływ danych

1. **Router** (`supabase/functions/shopping-list/shopping-list.handlers.ts`):
   - Dopasowanie ścieżki: `/` (root po `/shopping-list`)
   - Dopasowanie metody: `DELETE`
2. **Autoryzacja**:
   - `getAuthenticatedContext(req)` → `client` + `user`
3. **Serwis** (`supabase/functions/shopping-list/shopping-list.service.ts`):
   - `clearShoppingList(client, user.id)`
   - `DELETE FROM shopping_list_items WHERE user_id = auth.uid()` (w praktyce: RLS + query bez warunku po `user_id`, ale rekomendowane jest jawne `.eq('user_id', userId)` jako dodatkowa asekuracja)
4. **Odpowiedź**:
   - `204 No Content` (brak payload)

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT.
- **Autoryzacja / izolacja danych**: RLS na `shopping_list_items` zapewnia usuwanie tylko własnych wierszy.
- **Brak modyfikacji „Mojego planu”**:
  - endpoint dotyka wyłącznie `shopping_list_items`
  - nie wywołuje logiki `plan` (brak side-effectów jak przy `POST /plan/recipes`)
- **CORS**: obsługiwany globalnie w `supabase/functions/shopping-list/index.ts`.

## 6. Obsługa błędów

Mechanizm: `ApplicationError` + `handleError`.

### 6.1. Scenariusze i kody statusu

- **204 No Content**
  - Zawsze przy sukcesie (również gdy lista była pusta).
- **401 Unauthorized** (`UNAUTHORIZED`)
  - Brak / nieważny token.
- **500 Internal Server Error** (`INTERNAL_ERROR`)
  - Błąd bazy lub nieoczekiwany błąd runtime.

> W tym endpoincie nie ma walidacji body, więc `400` dotyczy tylko sytuacji typu: „nieobsługiwana metoda/ścieżka” (wtedy router zwróci `404`/`405` wg istniejącego wzorca), ale dla `DELETE /shopping-list` spodziewamy się ścieżki poprawnej i body pustego.

### 6.2. Rejestrowanie błędów w tabeli błędów

- Brak wskazanej tabeli błędów w DB planie; logujemy operacje i błędy przez `logger`.

## 7. Wydajność

- To pojedyncza operacja `DELETE` po użytkowniku; w MVP powinna być bardzo szybka.
- Rekomendacja indeksu (jeśli nie istnieje):
  - `(user_id)` na `shopping_list_items` (w praktyce zwykle wystarcza)
- Opcjonalnie unikać pobierania count; endpoint nie zwraca payload, więc nie potrzebuje `count: exact`.

## 8. Kroki implementacji

1. **Routing** (`supabase/functions/shopping-list/shopping-list.handlers.ts`):
   - Dodać obsługę:
     - `DELETE` dla root path (`''` lub `'/'`) analogicznie do istniejącego `GET` na root.
2. **Handler**:
   - `handleDeleteShoppingList(req)`:
     - `getAuthenticatedContext(req)`
     - wywołanie serwisu `clearShoppingList(...)`
     - `return new Response(null, { status: 204 })`
3. **Service** (`supabase/functions/shopping-list/shopping-list.service.ts`):
   - Dodać `clearShoppingList(client, userId)`:
     - `client.from('shopping_list_items').delete().eq('user_id', userId)`
     - obsłużyć błędy DB → `ApplicationError('INTERNAL_ERROR', ...)`
4. **Logowanie**:
   - `info`: start (userId)
   - `info`: success (opcjonalnie: liczba usuniętych, jeśli włączymy count)
   - `error`: DB
5. **Testy/manualne requesty**:
   - Uzupełnić `supabase/functions/shopping-list/test-requests.http`:
     - `DELETE /shopping-list`
     - potem `GET /shopping-list` jako weryfikacja, że `meta.total == 0`

