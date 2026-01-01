# API Endpoints Implementation Plan: `DELETE /plan/recipes/{recipeId}`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/plan-recipes-delete-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `DELETE /functions/v1/plan/recipes/{recipeId}` + routing wewnętrzny do `DELETE /recipes/{recipeId}`

## 1. Przegląd punktu końcowego

Endpoint `DELETE /plan/recipes/{recipeId}` usuwa pojedynczy przepis z listy użytkownika **„Mój plan”**.

**Wymagania biznesowe (MVP):**

- Endpoint jest **prywatny** (wymaga JWT).
- Usuwa tylko wpis z planu zalogowanego użytkownika (brak możliwości modyfikacji cudzych danych).
- Operacja dotyczy **pojedynczego** `recipeId`.
- Jeśli wpis nie istnieje (przepis nie jest w planie) → zwracamy `404 Not Found`.
- Odpowiedź sukcesu jest bez body (`204 No Content`).

## 2. Szczegóły żądania

- Metoda HTTP: `DELETE`
- Struktura URL:
    - publiczny adres funkcji: `DELETE /functions/v1/plan/recipes/{recipeId}`
    - (w dokumentacji REST): `DELETE /plan/recipes/{recipeId}`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- Request Body: brak

### Parametry

- Wymagane:
    - `recipeId` (path param): liczba całkowita dodatnia (`int > 0`)
- Opcjonalne:
    - brak

### Walidacja wejścia

Walidację wykonać w handlerze (zgodnie z regułami projektu: walidacja i formatowanie odpowiedzi w `*.handlers.ts`).

Rekomendacja:

- Wyciągnąć `recipeId` z `path` (po odcięciu prefiksu `/plan`) regexem: `^/recipes/([^/]+)$`.
- Parsowanie: `Number.parseInt(value, 10)` + guard clauses:
    - `Number.isFinite(recipeId)`
    - `Number.isInteger(recipeId)`
    - `recipeId > 0`
- Dla niepoprawnego `recipeId` rzucić `ApplicationError('VALIDATION_ERROR', 'recipeId must be a positive integer')` → `400`.

## 3. Wykorzystywane typy

### Frontend/Shared kontrakty (`shared/contracts/types.ts`)

Brak nowych DTO/Command Model dla tego endpointu:

- request nie ma body,
- response `204` nie ma body.

### Backend (typy lokalne w funkcji)

Opcjonalnie (dla spójności i łatwiejszych testów):

- w `supabase/functions/plan/plan.types.ts` dodać mały typ pomocniczy:
    - `RemoveRecipeFromPlanParams` (`{ userId: string; recipeId: number }`)
    - *(albo)* funkcję pomocniczą do walidacji `recipeId` (bez Zod, jeśli nie chcemy wprowadzać schematu dla path param).

## 4. Szczegóły odpowiedzi

### `204 No Content` (sukces)

- Body: brak

### Błędy (kontrakt + mapowanie)

Zgodnie z mechanizmem `ApplicationError` + `handleError()` (`supabase/functions/_shared/errors.ts`):

- `400 Bad Request`
    - niepoprawny `recipeId` w URL (nie-liczba, ≤ 0)
- `401 Unauthorized`
    - brak / nieprawidłowy JWT (z `getAuthenticatedContext`)
- `404 Not Found`
    - wpis nie istnieje (przepis nie jest w planie użytkownika)
- `500 Internal Server Error`
    - błąd bazy / nieobsłużony przypadek

Uwagi dot. `403 Forbidden`:

- W praktyce, przy poprawnym RLS na `plan_recipes`, próba usuwania „cudzego” wpisu zakończy się zwykle **0 usuniętych wierszy** (bez błędu), co mapujemy na `404` (brak wycieku informacji).
- Jeśli Supabase zwróci błąd RLS (rzadkie w tym przepływie), mapujemy go na `ApplicationError('FORBIDDEN', ...)` → `403`.

## 5. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Funkcja już istnieje i ma modularną strukturę:

```
supabase/functions/plan/
    index.ts
    plan.handlers.ts
    plan.service.ts
    plan.types.ts
```

### Routing (Supabase Edge Function)

W `plan.handlers.ts` dodać routing:

- `DELETE /recipes/{recipeId}` → `handleDeletePlanRecipe(req, recipeId)`

**Istotny detal path w runtime:**

Router wycina prefiks `/plan` z `url.pathname`, więc dla requestów na:

- `/functions/v1/plan/recipes/123` zwykle dostaniemy `url.pathname === '/plan/recipes/123'`
    - po wycięciu: `path === '/recipes/123'`

### Happy path (kroki)

1. Handler wywołuje `getAuthenticatedContext(req)`:
    - brak/invalid token → `401`.
2. Router dopasowuje ścieżkę i wyciąga `recipeId`:
    - walidacja `recipeId` (int > 0) → w przeciwnym razie `400`.
3. Handler wywołuje serwis `removeRecipeFromPlan(client, user.id, recipeId)`:
    - serwis wykonuje `DELETE` na `plan_recipes` w kontekście użytkownika (user-context client, RLS on).
4. Serwis interpretuje wynik:
    - jeśli usunięto 0 wierszy → `ApplicationError('NOT_FOUND', 'Recipe not found in plan')` → `404`.
5. Handler zwraca `204 No Content`.

### Interakcje z bazą

Zasób DB: `plan_recipes` (kluczowe pola):

- `user_id` (owner planu)
- `recipe_id` (ID przepisu)

Klucz/unikalność: docelowo `PRIMARY KEY (user_id, recipe_id)` (już wykorzystywane przez `POST /plan/recipes`).

Rekomendowane zapytanie (logika, nie SQL string):

- `DELETE FROM plan_recipes WHERE user_id = auth.uid() AND recipe_id = <recipeId>`

Implementacyjnie w Supabase JS:

- `client.from('plan_recipes').delete().eq('recipe_id', recipeId).select('recipe_id')`
    - `select(...)` po `delete()` pozwala sprawdzić, czy coś zostało usunięte (jeśli `data.length === 0` → 404).

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: zawsze wymagane (JWT). Używać `getAuthenticatedContext(req)`.
- **Autoryzacja/RLS**:
    - usuwanie wykonać **wyłącznie** w kontekście użytkownika (nie service-role),
    - RLS na `plan_recipes` musi pozwalać usuwać tylko własne wiersze (`auth.uid() = user_id`).
- **Brak wycieku informacji**:
    - jeśli użytkownik podaje `recipeId`, którego nie ma w jego planie, zwracamy `404` niezależnie od tego, czy taki przepis istnieje globalnie.
- **Bezpieczne logowanie**:
    - nie logować JWT ani pełnych danych requestu,
    - logować: `userId`, `recipeId`, status, czas wykonania, `error.code` / `error.message` (bez danych wrażliwych).

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W obecnym schemacie nie ma tabeli błędów. Dla MVP:

- logowanie przez `logger.error(...)` w Edge Function,
- observability po stronie Supabase (logi funkcji).

## 7. Wydajność

- **Oczekiwana liczba zapytań**:
    - 1× `DELETE` na `plan_recipes` (z `RETURNING`/`select` w ramach tego samego wywołania)
- **Indeksy**:
    - `PRIMARY KEY (user_id, recipe_id)` zapewnia szybkie usunięcie po `(user_id, recipe_id)`.
    - Jeśli usuwanie będzie realizowane tylko po `recipe_id` (z RLS filtrem `user_id`), nadal PK wystarcza; dodatkowy indeks na `recipe_id` nie jest wymagany dla MVP.

## 8. Kroki implementacji

1. **Router/Handler** (`supabase/functions/plan/plan.handlers.ts`):
    - dodać routing:
        - `DELETE /recipes/{recipeId}`
    - dodać handler np. `handleDeletePlanRecipe(req: Request, recipeId: number)`:
        - `getAuthenticatedContext(req)`
        - walidacja `recipeId`
        - wywołanie serwisu
        - zwrot `204` bez body
2. **Service** (`supabase/functions/plan/plan.service.ts`):
    - dodać funkcję np. `removeRecipeFromPlan(client, userId, recipeId)`:
        - wykonać `delete()` w user-context
        - jeśli 0 wierszy usuniętych → `ApplicationError('NOT_FOUND', ...)`
        - obsłużyć nieoczekiwane błędy DB → `ApplicationError('INTERNAL_ERROR', ...)`
3. **Types** (`supabase/functions/plan/plan.types.ts`) *(opcjonalnie)*:
    - dodać typy pomocnicze dla serwisu lub helper walidacji `recipeId`
4. **Dokumentacja i testy manualne**:
    - dopisać do `supabase/functions/plan/README.md` sekcję `DELETE /plan/recipes/{id}`
    - dopisać do `supabase/functions/plan/test-requests.http`:
        - sukces `204` po dodaniu recepty do planu
        - `404` gdy recipe nie jest w planie
        - `400` dla niepoprawnego `recipeId` (np. `abc`, `-1`)
        - `401` bez Authorization
    - dopisać do `supabase/functions/plan/TESTING.md` scenariusze DELETE (analogicznie do GET/POST)


