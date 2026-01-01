# API Endpoints Implementation Plan: `DELETE /plan`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/plan-delete-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `DELETE /functions/v1/plan` + routing wewnętrzny do `DELETE /`

## 1. Przegląd punktu końcowego

Endpoint `DELETE /plan` czyści (usuwa) **całą** listę użytkownika w zasobie **„Mój plan”**.

**Wymagania biznesowe (MVP):**

- Endpoint jest **prywatny** (wymaga JWT).
- Czyści tylko dane zalogowanego użytkownika (brak możliwości modyfikacji cudzych danych).
- Jest **idempotentny**:
    - jeśli plan jest pusty → nadal zwracamy sukces.
- Odpowiedź sukcesu jest bez body (`204 No Content`).

## 2. Szczegóły żądania

- Metoda HTTP: `DELETE`
- Struktura URL:
    - publiczny adres funkcji: `DELETE /functions/v1/plan`
    - (w dokumentacji REST): `DELETE /plan`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- Request Body: brak

### Parametry

- Wymagane: brak
- Opcjonalne: brak

## 3. Wykorzystywane typy

### Frontend/Shared kontrakty (`shared/contracts/types.ts`)

Brak nowych DTO/Command Model dla tego endpointu:

- request nie ma body,
- response `204` nie ma body.

### Backend (typy lokalne w funkcji)

Brak wymaganych nowych typów. Opcjonalnie (dla logów/metryk):

- typ `ClearPlanResult` (np. `{ deletedCount: number }`) zwracany przez serwis tylko do logowania, nie do response.

## 4. Szczegóły odpowiedzi

### `204 No Content` (sukces)

- Body: brak

### Błędy

Zgodnie z mechanizmem `ApplicationError` + `handleError()` (`supabase/functions/_shared/errors.ts`):

- `401 Unauthorized`
    - brak / nieprawidłowy JWT (z `getAuthenticatedContext`)
- `404 Not Found`
    - brak dopasowania ścieżki/metody (router)
- `500 Internal Server Error`
    - błąd bazy / nieobsłużony przypadek

> Uwaga: Endpoint nie powinien zwracać `400`, bo nie ma wejścia do walidacji (brak body i parametrów).

## 5. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Endpoint będzie dodany do istniejącej funkcji:

```
supabase/functions/plan/
    index.ts
    plan.handlers.ts
    plan.service.ts
    plan.types.ts
```

### Routing (Supabase Edge Function)

W `plan.handlers.ts` router już wycina prefiks `/plan`:

- request na `/functions/v1/plan` zwykle mapuje się na `url.pathname === '/plan'`
    - po wycięciu prefiksu: `path === ''`

**Nowy route do dodania:**

- `DELETE /` (obsłużyć warianty `path === ''` oraz `path === '/'`) → `handleDeletePlan(req)`

### Happy path (kroki)

1. Router dopasowuje `DELETE` na root zasobu planu.
2. Handler wywołuje `getAuthenticatedContext(req)`:
    - brak/invalid token → `401`.
3. Handler deleguje do serwisu `clearPlan(...)`.
4. Serwis usuwa wszystkie wiersze z `plan_recipes` w kontekście użytkownika (RLS).
5. Handler zwraca `204 No Content`.

### Interakcje z bazą danych

Zasób DB: `public.plan_recipes` (migracja: `supabase/migrations/20251230120000_create_plan_recipes_table.sql`)

Istotne cechy:

- limit 50 elementów na usera (trigger `enforce_plan_limit` dotyczy tylko INSERT),
- RLS: użytkownik może usuwać tylko swoje wiersze (`auth.uid() = user_id`).

Rekomendowane podejście do DELETE (logika, nie SQL string):

- kasowanie wykonać w **user-context**:
    - `DELETE FROM plan_recipes WHERE user_id = auth.uid()`

Implementacyjnie w `supabase-js` (Deno):

- `client.from('plan_recipes').delete().select('recipe_id')`
    - dzięki `select(...)` można policzyć `deletedCount` dla logów (maks. 50), bez wpływu na kontrakt API.

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: wymagane (JWT). Używać `getAuthenticatedContext(req)`.
- **Autoryzacja**:
    - operację wykonać w kontekście użytkownika (nie service-role),
    - RLS jest warstwą ochrony, ale dodatkowo można jawnie filtrować `.eq('user_id', user.id)` (obrona w głąb).
- **Brak wycieku informacji**: zawsze operujemy na zasobie per-user.
- **Bezpieczne logowanie**:
    - nie logować JWT ani pełnych payloadów,
    - logować: `userId`, `deletedCount` (opcjonalnie), status, czas wykonania.

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W obecnym schemacie nie ma tabeli błędów. Dla MVP:

- logowanie przez `logger.error(...)` w Edge Function,
- observability po stronie Supabase (logi funkcji).

## 7. Wydajność

- **Oczekiwana liczba zapytań**: 1× `DELETE` na `plan_recipes`.
- **Skala danych**: maks. 50 wierszy na użytkownika → operacja stałokosztowa.
- **Indeksy**:
    - PK `(user_id, recipe_id)` + indeks `(user_id, added_at desc)` — wystarczające dla szybkiego filtrowania.

Potencjalne wąskie gardła:

- brak (twardy limit 50 minimalizuje koszt).

## 8. Kroki implementacji

1. **Routing** (`supabase/functions/plan/plan.handlers.ts`):
    - dodać dopasowanie:
        - `DELETE` na `path === ''` lub `path === '/'` → `handleDeletePlan(req)`.
2. **Handler** (`supabase/functions/plan/plan.handlers.ts`):
    - dodać `handleDeletePlan(req: Request)`:
        - `getAuthenticatedContext(req)` (JWT wymagany),
        - wywołanie serwisu `clearPlan({ client, userId: user.id })`,
        - zwrot `204` bez body.
3. **Service** (`supabase/functions/plan/plan.service.ts`):
    - dodać funkcję `clearPlan(...)`:
        - przyjmować parametry jako obiekt (zgodnie z zasadami projektu), np. `{ client, userId }`,
        - wykonać `delete()` w user-context na `plan_recipes`,
        - opcjonalnie policzyć liczbę usuniętych wierszy (dla logów),
        - mapować błędy DB na `ApplicationError('INTERNAL_ERROR', ...)`.
4. **Dokumentacja**:
    - zaktualizować `supabase/functions/plan/README.md`:
        - dopisać opis endpointu `DELETE /plan` (usunąć z sekcji „Future Endpoints”).
    - zaktualizować `supabase/functions/plan/TESTING.md` oraz `test-requests.http`:
        - scenariusz: plan pusty → `204`,
        - scenariusz: plan z danymi → `204`, a następnie `GET /plan` zwraca `data=[]`,
        - scenariusz: brak Authorization → `401`,
        - scenariusz: invalid token → `401`.


