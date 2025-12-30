# API Endpoints Implementation Plan: `POST /plan/recipes`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/plan-recipes-post-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `/functions/v1/plan` + routing wewnętrzny do `/recipes`

## 1. Przegląd punktu końcowego

Endpoint `POST /plan/recipes` dodaje wskazany przepis do trwałej listy użytkownika **„Mój plan”**.

**Kluczowe wymagania biznesowe**:

- Lista jest **per-użytkownik** i jest **trwała** (persisted).
- Lista jest **unikalna**: nie można dodać tego samego `recipe_id` drugi raz dla tego samego użytkownika.
- Lista ma twardy limit **maks. 50** przepisów na użytkownika.
- Kolejność listy (dla innych endpointów typu `GET /plan`) jest „najnowsze pierwsze” (`added_at.desc`).

**Kontrakty błędów (wymagane przez API)**:

- `409 Conflict` gdy przepis już jest w planie.
- `422 Unprocessable Entity` gdy użytkownik osiągnął limit 50 elementów.

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL:
    - publiczny adres funkcji: `POST /functions/v1/plan/recipes`
    - (w dokumentacji REST): `POST /plan/recipes`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)

### Parametry

- Wymagane:
    - Brak query params / path params (poza routingiem wewnętrznym do `/recipes`)
- Opcjonalne:
    - Brak

### Request Body

Model:

- `recipe_id`: number (integer > 0) — wymagane

Przykład:

```json
{
    "recipe_id": 123
}
```

### Walidacja wejścia (Zod)

Walidację wykonać w handlerze (zgodnie z regułami projektu).

Rekomendowany schemat:

- `recipe_id`:
    - wymagane
    - liczba całkowita
    - `> 0`

Dodatkowo:

- Jeśli body nie jest poprawnym JSON → `400`.

### Wykorzystywane typy

### Frontend/Shared kontrakty

W `shared/contracts/types.ts` nie ma jeszcze typów dla zasobu „My Plan”. Dla spójności FE/BE zalecane jest dodanie:

- `export type AddRecipeToPlanCommand = { recipe_id: number };`

*(Opcjonalnie, jeśli równolegle będzie wdrażany cały zasób `plan`)*:

- `PlanListItemDto` (np. `recipe_id`, `added_at`, `recipe: { id, name, image_path }`)
- `GetPlanResponseDto` (np. `{ data: PlanListItemDto[]; meta: { total: number; limit: 50 } }`)

### Backend (typy lokalne w funkcji)

W folderze `supabase/functions/plan/` zalecane jest utrzymywanie:

- `plan.types.ts` (opcjonalnie, zalecane):
    - Zod schema dla requestu `POST /recipes`
    - typy pomocnicze dla serwisu (np. `AddRecipeToPlanParams`)

## 3. Szczegóły odpowiedzi

### `201 Created` (sukces)

Body:

```json
{
    "message": "Recipe added to plan successfully."
}
```

### Błędy

Uwaga: w projekcie istnieje wspólny mechanizm błędów `ApplicationError` mapujący m.in. `409` oraz `422` (`supabase/functions/_shared/errors.ts`), więc endpoint powinien konsekwentnie rzucać:

- `new ApplicationError('CONFLICT', ...)` → `409`
- `new ApplicationError('UNPROCESSABLE_ENTITY', ...)` → `422`

Lista błędów dla tego endpointu:

- `400 Bad Request`
    - niepoprawny JSON
    - walidacja Zod nie przeszła (brak `recipe_id`, zły typ, liczba ≤ 0)
- `401 Unauthorized`
    - brak / nieprawidłowy JWT
- `403 Forbidden`
    - użytkownik nie ma dostępu do przepisu (np. cudzy przepis nie-publiczny)
- `404 Not Found`
    - przepis nie istnieje lub jest soft-deleted (`deleted_at` != null)
- `409 Conflict`
    - przepis już jest w planie (duplikat)
- `422 Unprocessable Entity`
    - plan ma już 50 elementów
- `500 Internal Server Error`
    - błąd bazy / nieobsłużony przypadek / błąd integracji

## 4. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Utworzyć nową funkcję:

```
supabase/functions/plan/
    index.ts
    plan.handlers.ts
    plan.service.ts
    plan.types.ts            (opcjonalnie, zalecane)
```

Routing:

- `index.ts`:
    - obsługa CORS (OPTIONS)
    - wywołanie routera z `plan.handlers.ts`
    - obsługa błędów na najwyższym poziomie + logowanie
- `plan.handlers.ts`:
    - router ścieżek:
        - `POST /recipes` → `handlePostPlanRecipes(req)`
    - walidacja Zod requestu
    - formatowanie odpowiedzi `201`
- `plan.service.ts`:
    - logika biznesowa:
        - sprawdzenie dostępu do przepisu
        - egzekwowanie unikalności i limitu 50
        - zapis do tabeli planu

### Zasoby bazy danych (wymagane)

W obecnym `docs/results/main-project-docs/008 DB Plan.md` nie ma tabeli dla „Mój plan”. Aby endpoint mógł działać, wymagane jest wprowadzenie zasobu w DB (migracja):

**Proponowana tabela**: `plan_recipes`

- kolumny:
    - `user_id uuid not null default auth.uid()`
    - `recipe_id bigint not null references public.recipes(id)`
    - `added_at timestamptz not null default now()`
- constraints:
    - **unikalność**: `primary key (user_id, recipe_id)` *(lub `unique (user_id, recipe_id)` + osobny PK)*
- indeksy:
    - `index plan_recipes_user_id_added_at on plan_recipes (user_id, added_at desc)`
    - *(opcjonalnie)* `index plan_recipes_recipe_id on plan_recipes (recipe_id)`
- RLS:
    - `enable row level security`
    - policy `SELECT`: `auth.uid() = user_id`
    - policy `INSERT`: `auth.uid() = user_id` *(w praktyce insert bez `user_id`, bo default)*
    - policy `DELETE`: `auth.uid() = user_id`

**Uwaga o soft delete**:

- Dodawanie do planu powinno być blokowane dla `recipes.deleted_at is not null`.
- Jeśli przepis zostanie soft-deleted po dodaniu do planu, endpointy odczytu (`GET /plan`) powinny go ukryć (filtr `deleted_at is null` po stronie backendu).

### Zasady dostępu do przepisu (autoryzacja aplikacyjna)

Endpoint jest prywatny (wymaga JWT), ale może umożliwiać dodanie:

- własnych przepisów (dowolna `visibility`),
- publicznych przepisów innych użytkowników (`visibility = 'PUBLIC'`),

a blokować dodanie cudzych przepisów nie-publicznych.

**Rekomendowane zachowanie** (zgodne z API planem):

- jeśli przepis istnieje, ale jest nie-publiczny i użytkownik nie jest właścicielem → `403`.
- jeśli przepis nie istnieje / soft-deleted → `404`.

### Happy path (kroki)

1. Handler wywołuje `getAuthenticatedContext(req)`:
    - brak/invalid token → `401`.
2. Handler parsuje `await req.json()`:
    - błąd parsowania → `400`.
3. Handler waliduje body Zod:
    - błąd walidacji → `400`.
4. Serwis weryfikuje dostęp do przepisu (najlepiej przez service role client + filtrowanie):
    - odczytać minimalny zestaw pól: `id`, `user_id`, `visibility`, `deleted_at`
    - `deleted_at != null` → `404`
    - `visibility != 'PUBLIC' && recipe.user_id != requesterUserId` → `403`
5. Serwis próbuje dodać rekord do `plan_recipes` z użyciem klienta user-context (RLS on):
    - duplikat klucza `(user_id, recipe_id)` → `409`
6. Serwis egzekwuje limit 50:
    - jeśli limit przekroczony → `422`
7. Handler zwraca `201` z komunikatem sukcesu.

## 5. Względy bezpieczeństwa

- **Uwierzytelnienie**: zawsze wymagane (JWT). Używać `getAuthenticatedContext(req)`.
- **Autoryzacja aplikacyjna**: sprawdzać dostęp do przepisu przed insertem:
    - własny przepis → OK
    - cudzy przepis → tylko jeśli `visibility='PUBLIC'`
- **RLS**:
    - tabela `plan_recipes` musi mieć RLS, aby użytkownik nie mógł modyfikować cudzych wpisów.
    - insert powinien iść „jako user” (nie service role).
- **Bezpieczne logowanie**:
    - nie logować tokenów i pełnych danych requestu
    - logować metadane: `userId`, `recipeId`, status, czas wykonania, błąd (`error.code`)
- **Race conditions**:
    - unikalność musi być egzekwowana na poziomie DB (constraint).
    - limit 50 powinien być egzekwowany możliwie atomowo (patrz sekcja 7).

## 6. Obsługa błędów

### Mapowanie kodów statusu

Wykorzystać `ApplicationError` i wspólne `handleError()`:

- `VALIDATION_ERROR` → `400`
- `UNAUTHORIZED` → `401`
- `FORBIDDEN` → `403`
- `NOT_FOUND` → `404`
- `CONFLICT` → `409`
- `UNPROCESSABLE_ENTITY` → `422`
- `INTERNAL_ERROR` → `500`

### Scenariusze błędów (z przykładami)

- `400`:
    - `{"code":"VALIDATION_ERROR","message":"Invalid JSON in request body"}`
    - `{"code":"VALIDATION_ERROR","message":"recipe_id: Recipe ID must be a positive integer"}`
- `401`:
    - `{"code":"UNAUTHORIZED","message":"Missing Authorization header"}`
- `403`:
    - `{"code":"FORBIDDEN","message":"You do not have access to this recipe"}`
- `404`:
    - `{"code":"NOT_FOUND","message":"Recipe not found"}`
- `409`:
    - `{"code":"CONFLICT","message":"Recipe is already in plan"}`
- `422`:
    - `{"code":"UNPROCESSABLE_ENTITY","message":"Plan limit reached (50 recipes)"}`
- `500`:
    - `{"code":"INTERNAL_ERROR","message":"An unexpected error occurred"}`

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W obecnym planie DB nie ma dedykowanej tabeli na błędy. W MVP wystarczy:

- `logger.error(...)` w Edge Function
- logi Supabase/Edge Runtime

Jeśli potrzebne będzie audytowanie operacji planu (np. analityka), rozważyć osobną tabelę logów lub zdarzeń (poza zakresem tego endpointu).

## 7. Wydajność

- **Liczba zapytań** (rekomendowane minimum):
    - 1× odczyt przepisu (weryfikacja dostępu)
    - 1× insert do `plan_recipes`
    - *(opcjonalnie)* 1× sprawdzenie limitu
- **Optymalizacja**:
    - odczyt przepisu: wybierać tylko potrzebne kolumny
    - indeks na `(user_id, added_at desc)` dla szybkich odczytów `GET /plan`
- **Atomowość limitu 50 (rekomendowane)**:
    - aby uniknąć przekroczenia limitu przy równoległych requestach, najlepiej egzekwować limit w DB:
        - trigger `BEFORE INSERT` na `plan_recipes` z liczeniem `count(*)` dla `user_id` + `raise exception` gdy `>=50`, lub
        - funkcja RPC (np. `add_recipe_to_plan(p_recipe_id bigint)`) z `pg_advisory_xact_lock` na userId + check + insert.
    - Edge Function mapuje błąd DB na `ApplicationError('UNPROCESSABLE_ENTITY', ...)`.

## 8. Kroki implementacji

1. **DB (migracja)**:
    - dodać tabelę `plan_recipes` + constraints (unikalność) + indeksy
    - włączyć RLS + polityki (SELECT/INSERT/DELETE)
    - (rekomendowane) dodać mechanizm atomowego limitu 50 (trigger lub RPC)
2. **Backend (Edge Function)**:
    - utworzyć `supabase/functions/plan/index.ts` (CORS + router + obsługa błędów)
    - utworzyć `supabase/functions/plan/plan.handlers.ts`:
        - router: `POST /recipes`
        - walidacja Zod body `{ recipe_id }`
        - zwrot `201` z komunikatem
    - utworzyć `supabase/functions/plan/plan.service.ts`:
        - `addRecipeToPlan({ requesterUserId, recipeId, ... })`
        - weryfikacja dostępu do przepisu (najlepiej service role read + app-level rules)
        - insert do `plan_recipes` (user-context client)
        - mapowanie błędów DB na `409`/`422`
    - (opcjonalnie) `plan.types.ts` (Zod + typy)
3. **Kontrakty FE/Shared**:
    - dodać `AddRecipeToPlanCommand` do `shared/contracts/types.ts`
4. **Testy lokalne (manualne)**:
    - uruchomić: `supabase functions serve plan`
    - testować: `POST http://localhost:54331/functions/v1/plan/recipes`
    - przypadki:
        - poprawny `recipe_id` (201)
        - duplikat (409)
        - 51-szy element (422)
        - cudzy nie-publiczny przepis (403)
        - nieistniejący / soft-deleted (404)
        - brak Authorization (401)


