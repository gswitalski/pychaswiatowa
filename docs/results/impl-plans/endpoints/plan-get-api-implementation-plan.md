# API Endpoints Implementation Plan: `GET /plan`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/plan-get-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `GET /functions/v1/plan` + routing wewnętrzny do `GET /`

## 1. Przegląd punktu końcowego

Endpoint `GET /plan` zwraca listę przepisów użytkownika w zasobie **„Mój plan”**.

**Wymagania biznesowe (MVP):**

- Lista jest **per-użytkownik** i jest **trwała** (persisted).
- Kolejność: **najnowsze pierwsze** (`added_at.desc`).
- Lista ma twardy limit techniczny: **maks. 50** elementów.
- Zwraca dane w formacie:
    - `data`: elementy planu (z minimalnym „podglądem” przepisu),
    - `meta`: `total` oraz `limit: 50`.

## 2. Szczegóły żądania

- Metoda HTTP: `GET`
- Struktura URL:
    - publiczny adres funkcji: `GET /functions/v1/plan`
    - (w dokumentacji REST): `GET /plan`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
- Request Body: brak

### Parametry

- Wymagane:
    - brak
- Opcjonalne:
    - brak

## 3. Wykorzystywane typy

### Frontend/Shared kontrakty (`shared/contracts/types.ts`)

- `GetPlanResponseDto`
- `PlanListItemDto`

**Docelowy kontrakt odpowiedzi**:

- `GetPlanResponseDto`:
    - `data: PlanListItemDto[]`
    - `meta: { total: number; limit: 50 }`

### Backend (typy lokalne w funkcji)

W folderze `supabase/functions/plan/`:

- `plan.types.ts`:
    - (opcjonalnie) typ pomocniczy na rekordy z bazy, np. `PlanRecipeRow`
    - (opcjonalnie) typ mapowania do `PlanListItemDto`

> Uwaga: dla `GET /plan` nie ma walidacji body (brak body). Walidacja dotyczy jedynie uwierzytelnienia i bezpieczeństwa dostępu do danych.

## 4. Szczegóły odpowiedzi

### `200 OK` (sukces)

Body (`GetPlanResponseDto`):

```json
{
    "data": [
        {
            "recipe_id": 123,
            "added_at": "2023-10-30T10:00:00Z",
            "recipe": {
                "id": 123,
                "name": "Apple Pie",
                "image_path": "path/to/image.jpg"
            }
        }
    ],
    "meta": {
        "total": 1,
        "limit": 50
    }
}
```

### Błędy

Zgodnie z kontraktem statusów i wspólną obsługą błędów (`ApplicationError` + `handleError()`):

- `401 Unauthorized`
    - brak / nieprawidłowy JWT
- `500 Internal Server Error`
    - błąd bazy / nieobsłużony przypadek / błąd integracji

> Dla `GET /plan` nie zakładamy `404`: „plan” jako zasób istnieje zawsze; jeśli użytkownik nie ma elementów, zwracamy `200` z pustą listą.

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

- `index.ts`:
    - obsługa CORS (OPTIONS)
    - wywołanie routera z `plan.handlers.ts`
    - obsługa błędów na najwyższym poziomie + logowanie
- `plan.handlers.ts`:
    - router:
        - `POST /recipes` (już jest)
        - **`GET /`** → `handleGetPlan(req)` (do dodania)

**Istotny detal path w runtime:**

Aktualnie router wycina prefiks `/plan` z `url.pathname`:

- request na `/functions/v1/plan` często mapuje się na `url.pathname === '/plan'`
    - wówczas `path` w routerze wyjdzie jako pusty string `''`
- rekomendacja: obsłużyć oba warianty:
    - `path === ''` oraz `path === '/'` dla `GET /plan`

### Zasoby bazy danych

Tabela planu jest realizowana jako `plan_recipes` (patrz: `supabase/migrations/20251230120000_create_plan_recipes_table.sql`).

Minimalne pola potrzebne dla `GET /plan`:

- `plan_recipes.user_id`
- `plan_recipes.recipe_id`
- `plan_recipes.added_at`
- `recipes.id`
- `recipes.name`
- `recipes.image_path`

### Reguły dostępu do przepisu (autoryzacja aplikacyjna)

`GET /plan` jest endpointem prywatnym (JWT wymagany). Jednak plan może zawierać:

- własne przepisy użytkownika (dowolna `visibility`),
- publiczne przepisy innych użytkowników (`visibility = 'PUBLIC'`).

**Krytyczne edge-case’y do obsłużenia na odczycie:**

- **Soft delete**: jeśli przepis jest soft-deleted (`recipes.deleted_at IS NOT NULL`), nie może być zwrócony w planie (ukryć).
- **Zmiana widoczności po dodaniu**:
    - jeśli autor zmieni `visibility` przepisu na nie-publiczny, a użytkownik nie jest właścicielem, to element planu **nie może zostać zwrócony** (ukryć).

### Strategia zapytań (rekomendowana)

Ponieważ `plan.service.ts` używa już service-role do odczytów (żeby nie zależeć od RLS `recipes`), rekomendowana jest analogiczna strategia:

- **Odczyt listy**: service-role client, ale z twardym filtrowaniem po `user_id` i regułach dostępu.

Przykładowe warunki (logika, nie SQL string):

- `plan_recipes.user_id = <userId>`
- join do `recipes` po `recipe_id`
- `recipes.deleted_at IS NULL`
- oraz `(recipes.user_id = <userId> OR recipes.visibility = 'PUBLIC')`
- sort: `plan_recipes.added_at DESC`
- limit: `50`

**Wynik mapować do** `PlanListItemDto[]`.

### `meta.total`

Rekomendacja dla MVP:

- `meta.total` = liczba **zwróconych** elementów po zastosowaniu filtrów (soft delete + access rules).
    - Uzasadnienie: unikamy dodatkowego zapytania COUNT, a plan i tak ma limit 50.
    - Konsekwencja: jeśli w `plan_recipes` istnieją „osierocone”/niedostępne elementy, `total` będzie odpowiadać temu, co realnie widzi użytkownik.

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: zawsze wymagane (JWT). Używać `getAuthenticatedContext(req)`.
- **Autoryzacja**:
    - plan zawsze filtrujemy po `plan_recipes.user_id = user.id` (brak wycieków między userami),
    - dodatkowo filtrujemy dane przepisów wg reguł domenowych (owner lub public).
- **RLS**:
    - nawet jeśli odczyt jest service-role, backend MUSI filtrować po `user_id` (bo service-role omija RLS).
    - preferowane jest również posiadanie RLS na `plan_recipes` (obrona warstwowa).
- **Bezpieczne logowanie**:
    - nie logować tokenów ani pełnych danych requestu,
    - logować: `userId`, `returnedCount`, `status`, czas wykonania, `error.code`.

## 7. Obsługa błędów

### Mapowanie kodów statusu

- `401 Unauthorized`:
    - brak nagłówka `Authorization` / nieprawidłowy JWT (z `getAuthenticatedContext`)
- `500 Internal Server Error`:
    - błąd DB / niespodziewany wyjątek

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W obecnym schemacie nie ma tabeli błędów. Dla MVP:

- logowanie przez `logger.error(...)` w Edge Function,
- observability po stronie Supabase (logi funkcji).

## 8. Wydajność

- **Oczekiwana liczba zapytań**:
    - 1× odczyt listy planu z joinem do `recipes` (limit 50)
- **Indeksy**:
    - `plan_recipes(user_id, added_at DESC)` — szybkie sortowanie i filtrowanie
    - `plan_recipes(recipe_id)` — optymalizacja joina
- **Wąskie gardła**:
    - join do `recipes` przy rosnącej liczbie użytkowników — mitigowane przez limit 50 oraz indeksy.

## 9. Kroki implementacji

1. **Handler** (`supabase/functions/plan/plan.handlers.ts`):
    - dodać routing:
        - `GET /` (obsłużyć `path === ''` i `path === '/'`)
    - dodać `handleGetPlan(req)`
        - `getAuthenticatedContext(req)`
        - wywołanie serwisu
        - zwrot `200` z `GetPlanResponseDto`
2. **Service** (`supabase/functions/plan/plan.service.ts`):
    - dodać funkcję np. `getPlan(...)`
        - wejście: `{ userId: string }`
        - wyjście: `GetPlanResponseDto` (lub `{ items, total }` mapowane w handlerze)
    - implementacja:
        - service-role read z joinem do `recipes`
        - filtrowanie: `deleted_at IS NULL` oraz `(owner OR PUBLIC)`
        - sort `added_at.desc`, limit 50
3. **Types** (`supabase/functions/plan/plan.types.ts`):
    - (opcjonalnie) dodać typy pomocnicze dla mapowania
4. **Dokumentacja i testy manualne**:
    - dopisać do `supabase/functions/plan/README.md` sekcję `GET /plan`
    - dopisać do `supabase/functions/plan/TESTING.md` scenariusze:
        - 200 + pusta lista (nowy użytkownik)
        - 200 + elementy w poprawnej kolejności
        - ukrycie soft-deleted przepisu (nie zwracamy go)
        - ukrycie przepisu, który przestał być publiczny i nie jest własnością usera
        - 401 bez Authorization


