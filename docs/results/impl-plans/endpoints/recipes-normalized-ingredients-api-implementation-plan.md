# API Endpoints Implementation Plan: Recipes – Normalized Ingredients (GET /recipes/{id}/normalized-ingredients)

## 1. Przegląd punktu końcowego

Endpoint **`GET /recipes/{id}/normalized-ingredients`** zwraca **wygenerowaną po stronie backendu** listę składników znormalizowanych dla danego przepisu wraz ze **statusem** procesu normalizacji.

- **Cel biznesowy**: udostępnić diagnostyczny (MVP) oraz przyszłościowy (lista zakupów) odczyt danych znormalizowanych generowanych asynchronicznie po każdym zapisie przepisu.
- **Kontekst domenowy**:
  - Normalizacja dotyczy wyłącznie pozycji składników (elementy `type="item"`), **ignoruje nagłówki sekcji** (`type="header"`).
  - Jednostki są z listy kontrolowanej (MVP): `g`, `ml`, `szt.`, `ząbek`, `łyżeczka`, `łyżka`, `szczypta`, `pęczek`.
  - Dla pozycji niejednoznacznych (np. „do smaku”) zwracamy tylko `name`, a `amount/unit = null`.
- **Zależności**:
  - Proces generowania jest wykonywany asynchronicznie przez worker/job (po `POST/PUT /recipes`) oraz może korzystać z **`POST /ai/recipes/normalized-ingredients`**.

## 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes/{id}/normalized-ingredients`
- **Wymagane nagłówki**:
  - `Authorization: Bearer <JWT>`
- **Parametry**:
  - **Wymagane**:
    - `id` (path) – identyfikator przepisu, dodatnia liczba całkowita (`bigint/int`, `> 0`)
  - **Opcjonalne**: brak
- **Request Body**: brak

### Walidacja wejścia (guard clauses)

- Jeśli `id` nie jest dodatnią liczbą całkowitą → `400 Bad Request` (`VALIDATION_ERROR`).
- Brak/niepoprawny JWT → `401 Unauthorized`.

## 3. Szczegóły odpowiedzi

### Sukces (200 OK)

- **Kod**: `200 OK`
- **Payload**:

```json
{
  "recipe_id": 123,
  "status": "READY",
  "updated_at": "2023-10-28T10:00:00Z",
  "items": [
    { "amount": 1000, "unit": "g", "name": "mąka" },
    { "amount": null, "unit": null, "name": "sól" }
  ]
}
```

### Wykorzystywane typy (DTO / Command modele)

Plik: `shared/contracts/types.ts`

- **Nowe typy (współdzielony kontrakt FE/BE)**:
  - `NormalizedIngredientsStatus = 'PENDING' | 'READY' | 'FAILED'`
  - `NormalizedIngredientUnit = 'g' | 'ml' | 'szt.' | 'ząbek' | 'łyżeczka' | 'łyżka' | 'szczypta' | 'pęczek'`
  - `NormalizedIngredientDto`:
    - `amount: number | null`
    - `unit: NormalizedIngredientUnit | null`
    - `name: string`
  - `GetRecipeNormalizedIngredientsResponseDto`:
    - `recipe_id: number`
    - `status: NormalizedIngredientsStatus`
    - `updated_at: string | null`
    - `items: NormalizedIngredientDto[]`

Uwagi:
- Endpoint nie ma Command Modelu (brak body).
- `updated_at` reprezentuje moment ostatniej **udanej** normalizacji (dla `PENDING` typowo `null`).

## 4. Przepływ danych

### 4.1. Warstwa Edge Function (routing → handler → service)

1. **Routing** (`supabase/functions/recipes/recipes.handlers.ts` → `recipesRouter`):
   - dopasowanie ścieżki `/recipes/{id}/normalized-ingredients` musi być wykonane **przed** dopasowaniem `/recipes/{id}` (analogicznie jak `/collections` i `/image`).
2. **Handler**:
   - pobranie kontekstu użytkownika przez `getAuthenticatedContext(req)` (JWT),
   - walidacja `id` (`parseAndValidateRecipeId`),
   - wywołanie serwisu `getRecipeNormalizedIngredients(...)`,
   - sformatowanie odpowiedzi DTO i zwrot `200`.
3. **Service**:
   - odczyt statusu i daty `updated_at` normalizacji (z tabeli `recipes`),
   - odczyt listy `items` (z tabeli wynikowej, np. `recipe_normalized_ingredients`),
   - logowanie (info/warn/error) z metrykami bez danych wrażliwych.

### 4.2. Źródła danych (DB) – rekomendowana struktura

Ponieważ w aktualnie wygenerowanych typach DB nie ma jeszcze zasobów dla tej funkcji, plan zakłada dodanie:

1. **Kolumn w `recipes`** (status + timestamp):
   - `recipes.normalized_ingredients_status` (`text` albo `enum`) – NOT NULL, default `PENDING`
   - `recipes.normalized_ingredients_updated_at` (`timestamptz`, nullable)

2. **Tabela wynikowa** (1 wiersz na przepis):
   - `recipe_normalized_ingredients`:
     - `recipe_id bigint PRIMARY KEY REFERENCES recipes(id) ON DELETE CASCADE`
     - `items jsonb NOT NULL` (tablica `{amount,unit,name}`)
     - `updated_at timestamptz NOT NULL DEFAULT now()` *(opcjonalnie; jeśli używamy `recipes.normalized_ingredients_updated_at`, to `updated_at` w tej tabeli może być pominięte)*

3. **RLS**:
   - SELECT na `recipe_normalized_ingredients` dozwolony wyłącznie, gdy użytkownik jest właścicielem przepisu (np. `EXISTS (SELECT 1 FROM recipes r WHERE r.id = recipe_id AND r.user_id = auth.uid() AND r.deleted_at IS NULL)`).

### 4.3. Zasada spójności statusu z danymi

Rekomendacja zachowania endpointu:
- `status = PENDING` → `items = []`, `updated_at = null`
- `status = FAILED` → `items = []`, `updated_at = <ostatni sukces lub null>` *(decyzja: w MVP najlepiej `items=[]` aby nie mieszać ze „starymi” danymi)*
- `status = READY` → `items` z tabeli wynikowej, `updated_at` z `recipes.normalized_ingredients_updated_at`

Jeśli `status = READY`, ale brakuje danych w tabeli wynikowej → traktować jako niespójność (log `error`) i zwrócić `500`.

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie (AuthN)**:
  - wymagany JWT (`Authorization: Bearer <JWT>`), inaczej `401`.
- **Autoryzacja (AuthZ)**:
  - caller **musi być właścicielem przepisu** (RLS).
  - Wymóg „bez wycieku istnienia”:
    - rekomendacja: zwracać `404` dla „nie istnieje” oraz „brak dostępu” (safe default),
    - alternatywnie (jeśli potrzebne): rozróżnienie `403/404` wymaga sprawdzenia service-role (jak w `getRecipeById`), ale w tym endpointcie nie jest to konieczne w MVP.
- **Soft delete**:
  - wszystkie odczyty muszą respektować `deleted_at IS NULL` (RLS + defensywny filtr w zapytaniach).
- **Bezpieczne logowanie**:
  - nie logować pełnych `items` ani treści wejściowych; logować liczby (np. `itemsCount`, `status`), `recipe_id`, `user_id`.

## 6. Obsługa błędów

### Scenariusze i kody

- **401 Unauthorized**
  - brak/niepoprawny JWT.
- **400 Bad Request**
  - niepoprawny `id` (nie-int / <= 0).
- **404 Not Found**
  - przepis nie istnieje, jest soft-deleted lub użytkownik nie ma dostępu (rekomendacja anti-leak).
- **403 Forbidden** *(opcjonalnie, jeśli zdecydujemy się rozróżniać)*:
  - przepis istnieje, ale użytkownik nie jest właścicielem (wymaga checku service-role; niezalecane w MVP dla tego endpointu).
- **500 Internal Server Error**
  - błąd DB,
  - niespójność danych (np. `status=READY`, a brak rekordu w tabeli wynikowej),
  - nieobsłużony wyjątek.

### Format błędu

Spójnie z istniejącą infrastrukturą Edge Functions:
- rzucać `ApplicationError` (`VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `FORBIDDEN`, `INTERNAL_ERROR`) i zwracać `handleError(error)` z `supabase/functions/_shared/errors.ts`.

### Rejestrowanie błędów w tabeli błędów

W obecnym repo nie ma dedykowanej „tabeli błędów” dla Edge Functions. MVP:
- logowanie przez `logger.error(...)` (stdout Supabase).
- (opcjonalnie, przyszłościowo) wprowadzić tabelę `error_events` i zapisywać `5xx` jako telemetry (asynchronicznie, best-effort).

## 7. Wydajność

- **Minimalny SELECT**: pobierać z `recipes` tylko kolumny potrzebne do odpowiedzi (`id`, `normalized_ingredients_status`, `normalized_ingredients_updated_at`).
- **Maksymalnie 2 zapytania**:
  - 1x do `recipes`,
  - 1x do `recipe_normalized_ingredients` tylko gdy `status=READY`.
- **Indeksy**:
  - PK na `recipe_normalized_ingredients(recipe_id)` wystarczy dla odczytu O(1).

## 8. Kroki implementacji

1. **Kontrakt FE/BE (shared)**
   - Dodać typy do `shared/contracts/types.ts`:
     - `NormalizedIngredientsStatus`
     - `NormalizedIngredientUnit`
     - `NormalizedIngredientDto`
     - `GetRecipeNormalizedIngredientsResponseDto`
2. **Migracje DB**
   - Dodać plik migracji w `supabase/migrations/`:
     - nowe kolumny w `recipes`: `normalized_ingredients_status`, `normalized_ingredients_updated_at`
     - tabela `recipe_normalized_ingredients` + polityki RLS
   - Upewnić się, że statusy są spójne z workerem (`PENDING/READY/FAILED`).
3. **Regeneracja typów DB**
   - Uruchomić `supabase gen types typescript` i zaktualizować:
     - `shared/types/database.types.ts`
     - `supabase/functions/_shared/database.types.ts`
4. **Service**
   - W `supabase/functions/recipes/recipes.service.ts` dodać:
     - typy DTO lokalne (jeśli potrzebne) + mapper do `GetRecipeNormalizedIngredientsResponseDto`
     - funkcję `getRecipeNormalizedIngredients(client, { recipeId, userId })`
       - pobiera status + updated_at z `recipes`
       - gdy `READY` pobiera `items` z `recipe_normalized_ingredients`
       - mapuje/normalizuje wynik do DTO (zawsze `items` jako tablica)
5. **Handler**
   - W `supabase/functions/recipes/recipes.handlers.ts` dodać:
     - extractor ścieżki: `extractRecipeIdFromNormalizedIngredientsPath(url)`
     - handler: `handleGetRecipeNormalizedIngredients(req, recipeIdParam)`
6. **Routing**
   - W `recipesRouter` dodać obsługę:
     - `GET /recipes/{id}/normalized-ingredients` (sprawdzane przed `/recipes/{id}`)
     - `METHOD_NOT_ALLOWED` dla innych metod na tej ścieżce (405) *(opcjonalnie; zgodnie z obecnym stylem routera)*
7. **Testy ręczne (http)**
   - Dodać requesty do `supabase/functions/recipes/test-requests.http` (lub analogicznego pliku, jeśli istnieje):
     - `READY` z danymi,
     - `PENDING` (items=[]),
     - brak JWT (401),
     - niepoprawny `id` (400),
     - nieistniejący / brak dostępu (404).
8. **Checklist wdrożeniowy**
   - Zweryfikować, że:
     - endpoint nie ujawnia istnienia cudzego przepisu (preferowane `404`),
     - `items` zawsze jest tablicą,
     - `deleted_at` jest respektowane,
     - logi nie zawierają treści składników.

