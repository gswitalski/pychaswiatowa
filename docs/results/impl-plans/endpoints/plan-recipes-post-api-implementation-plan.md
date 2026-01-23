## API Endpoints Implementation Plan: Mój plan — `POST /plan/recipes` (side-effect: surowe wiersze listy zakupów)

<analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint: **`POST /plan/recipes`**
- Cel: dodać przepis do listy „Mój plan” zalogowanego użytkownika.
- Reguły domenowe:
    - dostęp: użytkownik może dodać **własny** przepis (dowolna `visibility`) albo **cudzy** tylko gdy `visibility = 'PUBLIC'`
    - przepis nie może być soft-deleted (`deleted_at IS NULL`)
    - brak duplikatów w planie (unikalność per `user_id, recipe_id`)
    - limit: maks. **50** przepisów w planie
- Side-effect (MVP, po zmianie): po dodaniu przepisu do planu backend tworzy **surowe wiersze** listy zakupów:
    - czyta `recipe_normalized_ingredients` dla przepisu (tylko jeśli `normalized_ingredients_status = 'READY'`),
    - tworzy **1 wiersz listy zakupów na 1 znormalizowany składnik** (bez merge/sumowania po stronie backendu),
    - każdy wiersz zawiera: `recipe_id`, `recipe_name` (snapshot), `name`, `amount` (nullable), `unit` (nullable), `is_owned=false`.
    - jeśli normalizacja nie jest gotowa (`status != READY`) przepis **nie wnosi** wierszy do listy zakupów (plan i tak jest dodany).

### 2) Parametry wymagane i opcjonalne
- Nagłówki:
    - wymagane: `Authorization: Bearer <JWT>`
    - wymagane: `Content-Type: application/json`
- Body (JSON):
    - wymagane: `recipe_id: number` (int, > 0)
- Brak parametrów URL i query.

### 3) Niezbędne typy DTO i Command modele
- Z `shared/contracts/types.ts` (już istnieje):
    - `AddRecipeToPlanCommand` (`{ recipe_id: number }`)
- Response:
    - prosty payload `{ message: string }` (można ustandaryzować jako `MessageResponseDto`, ale nie jest wymagane dla samego endpointu).
- Uwaga o spójności kontraktów:
    - aktualne typy zakupów w `shared/contracts/types.ts` opisują agregację; aby być zgodnym ze specyfikacją „surowe wiersze”, DTO dla listy zakupów powinny zawierać `recipe_id` i `recipe_name` dla `kind='RECIPE'` (poza zakresem tego endpointu, ale ważne jako zależność spójności systemu).

### 4) Wyodrębnienie logiki do service
- Funkcja `supabase/functions/plan/` ma już modularny podział (`index.ts` / `plan.handlers.ts` / `plan.service.ts`).
- Rekomendacja: operację „dodaj do planu + (opcjonalnie) utwórz wiersze zakupów” wykonać **atomowo** w DB przez **jedno RPC**:
    - minimalizuje ryzyko stanu częściowego,
    - ułatwia mapowanie błędów na kody HTTP,
    - jest zgodne z zasadami projektu (logika domenowa i transakcje po stronie backendu/DB, nie w `index.ts`).

### 5) Walidacja wejścia
- Zod:
    - `recipe_id`: liczba całkowita dodatnia.
- Błędy JSON parse → `400`.
- Walidacja biznesowa (w serwisie / DB RPC):
    - przepis istnieje i `deleted_at IS NULL`,
    - user ma dostęp (owner lub `visibility = 'PUBLIC'`),
    - limit 50 (trigger/constraint),
    - brak duplikatu (unikalność).

### 6) Rejestrowanie błędów w tabeli błędów
- Brak dedykowanej tabeli błędów w repo.
- MVP: logowanie przez `logger` oraz spójne mapowanie błędów przez `handleError` / `ApplicationError` (`supabase/functions/_shared/errors.ts`).

### 7) Potencjalne zagrożenia bezpieczeństwa
- **AuthN**: JWT wymagany → `401`.
- **AuthZ**: blokada dodania cudzych `PRIVATE/SHARED` → `403` (zgodnie ze specyfikacją API planu).
- **RLS / SECURITY DEFINER**:
    - jeśli stosujemy RPC `SECURITY DEFINER`, funkcja musi sama egzekwować `auth.uid()` i wszystkie warunki dostępu oraz zawsze zapisywać rekordy z `user_id = auth.uid()`.
- **Anti-leak**:
    - dla tego endpointu specyfikacja przewiduje `403` dla braku dostępu; nie maskujemy tego jako `404`.

### 8) Scenariusze błędów i kody statusu
- `400 Bad Request`: invalid JSON, `recipe_id` niepoprawny (nie-int / <= 0)
- `401 Unauthorized`: brak/niepoprawny JWT
- `403 Forbidden`: brak dostępu do przepisu (cudzy nie-PUBLIC)
- `404 Not Found`: przepis nie istnieje lub jest soft-deleted
- `409 Conflict`: przepis już jest w planie
- `422 Unprocessable Entity`: limit 50 przepisów przekroczony
- `500 Internal Server Error`: błędy DB / nieoczekiwane wyjątki
</analysis>

## 1. Przegląd punktu końcowego

Endpoint **`POST /plan/recipes`** dodaje przepis do listy „Mój plan” użytkownika. Po dodaniu, backend wykonuje side-effect: aktualizuje listę zakupów użytkownika poprzez utworzenie **surowych wierszy** (jeden wiersz na jeden znormalizowany składnik danego przepisu) z polami `recipe_id` i `recipe_name` jako snapshot.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/plan/recipes`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
    - `Content-Type: application/json`
- **Parametry**:
    - **Wymagane**: brak (poza body)
    - **Opcjonalne**: brak
- **Request Body**: `AddRecipeToPlanCommand`

```json
{
    "recipe_id": 123
}
```

### Wykorzystywane typy

- **Command**:
    - `AddRecipeToPlanCommand`
- **Walidacja**:
    - `AddRecipeToPlanSchema` (Zod; w `supabase/functions/plan/plan.types.ts`)
- **Response**:
    - `{ "message": string }` (możliwe ustandaryzowanie jako DTO, opcjonalnie)
- **Zależności domenowe (DB)**:
    - `plan_recipes`
    - `recipes` (weryfikacja dostępu + odczyt nazwy do snapshotu)
    - `recipe_normalized_ingredients` (odczyt listy znormalizowanych składników)
    - `shopping_list_items` (wstawienie surowych wierszy zakupów)

## 3. Szczegóły odpowiedzi

### Sukces
- **201 Created**

```json
{
    "message": "Recipe added to plan successfully."
}
```

### Błędy
- **400 Bad Request**: walidacja wejścia / invalid JSON
- **401 Unauthorized**: brak lub nieprawidłowy JWT
- **403 Forbidden**: użytkownik nie ma dostępu do przepisu
- **404 Not Found**: przepis nie istnieje lub jest soft-deleted
- **409 Conflict**: przepis już jest w planie
- **422 Unprocessable Entity**: plan osiągnął limit 50 przepisów
- **500 Internal Server Error**: błąd serwera / DB

## 4. Przepływ danych

### 4.1. Edge Function (routing → handler → service)

1. `supabase/functions/plan/index.ts`
    - CORS (OPTIONS)
    - routing do `planRouter`
    - obsługa błędów na najwyższym poziomie (`handleError`)
2. `supabase/functions/plan/plan.handlers.ts` (`handlePostPlanRecipes`)
    - `getAuthenticatedContext(req)`
    - `req.json()` + walidacja Zod `AddRecipeToPlanSchema`
    - wywołanie `addRecipeToPlan(client, user.id, recipe_id)`
    - zwrot `201` z `{ message }`
3. `supabase/functions/plan/plan.service.ts` (`addRecipeToPlan`)
    - rekomendowane: wywołanie RPC w DB (wariant A) i mapowanie błędów na `ApplicationError`

### 4.2. Atomiczność (wariant A — zalecany): jedno RPC w Postgres

Zalecane RPC (nazwa przykładowa): `add_recipe_to_plan_and_update_shopping_list(p_recipe_id bigint)`.

**Kontrakt RPC (logika wysokopoziomowa, w transakcji):**

- **Krok 1**: `v_user_id := auth.uid()`; jeśli null → błąd `UNAUTHORIZED`
- **Krok 2**: pobierz `recipes` dla `p_recipe_id`:
    - jeśli brak → `NOT_FOUND`
    - jeśli `deleted_at is not null` → `NOT_FOUND`
    - jeśli `user_id != v_user_id` i `visibility != 'PUBLIC'` → `FORBIDDEN`
- **Krok 3**: wstaw do `plan_recipes (user_id, recipe_id)`:
    - unique_violation → `CONFLICT`
    - przekroczenie limitu (trigger) → `UNPROCESSABLE` (mapowane do `422`)
- **Krok 4 (side-effect)**: jeśli `recipes.normalized_ingredients_status = 'READY'`:
    - pobierz `recipe_normalized_ingredients.items` dla `recipe_id`
    - pobierz `recipes.name` jako `recipe_name_snapshot`
    - dla każdego elementu z `items` utwórz **osobny** wiersz w `shopping_list_items`:
        - `kind='RECIPE'`
        - `recipe_id = p_recipe_id`
        - `recipe_name = recipe_name_snapshot`
        - `name`, `amount` (nullable), `unit` (nullable)
        - `is_owned=false`
    - brak merge/sumowania
- **Krok 5**: zwróć `jsonb` z metadanymi (opcjonalnie; Edge Function i tak zwraca `{message}`)

### 4.3. Model danych listy zakupów (wymagany przez specyfikację „surowe wiersze”)

Jeśli obecny schemat listy zakupów jest „agregujący”, należy go dostosować do przechowywania surowych wierszy:

- **`shopping_list_items`** (jedna tabela dla MANUAL i RECIPE):
    - dla `kind='RECIPE'` wymagane pola:
        - `recipe_id bigint not null`
        - `recipe_name text not null` (snapshot)
        - `name text not null`
        - `amount numeric null`
        - `unit text null`
        - `is_owned boolean not null default false`
    - dla `kind='MANUAL'`:
        - `text text not null`
        - `is_owned boolean not null default false`
    - indeksy:
        - `shopping_list_items(user_id, kind)`
        - `shopping_list_items(user_id, recipe_id)` dla szybkiego kasowania po `recipe_id`
    - RLS:
        - `SELECT/INSERT/UPDATE` tylko `auth.uid() = user_id`
        - `DELETE` tylko `auth.uid() = user_id AND kind='MANUAL'` (usuwać ręcznie można tylko MANUAL; RECIPE zarządza system)

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (`401`).
- **Autoryzacja**: zgodnie ze specyfikacją:
    - owner albo `visibility='PUBLIC'` → OK
    - w przeciwnym razie `403`
- **RLS / minimalizacja uprawnień**:
    - jeśli używamy `SECURITY DEFINER`, funkcja musi wymusić `auth.uid()` i nie przyjmować `user_id` z zewnątrz.
- **Logowanie**:
    - logować `user_id`, `recipe_id`, `normalized_status`, `created_rows_count`
    - nie logować pełnej zawartości składników/wierszy

## 6. Obsługa błędów

- **400 Bad Request**
    - niepoprawny JSON
    - `recipe_id` nie jest dodatnią liczbą całkowitą
- **401 Unauthorized**
    - brak/niepoprawny JWT
- **403 Forbidden**
    - brak dostępu do przepisu (cudzy nie-PUBLIC)
- **404 Not Found**
    - przepis nie istnieje / soft-deleted
- **409 Conflict**
    - przepis już jest w planie
- **422 Unprocessable Entity**
    - przekroczony limit 50 przepisów
- **500 Internal Server Error**
    - błąd DB lub nieoczekiwany wyjątek

## 7. Wydajność

- **Cel**: stała i przewidywalna liczba operacji DB.
- **Zalecenie**: 1× RPC w DB (transakcja):
    - 1× odczyt `recipes` (z blokadą lub bez, zależnie od strategii)
    - 1× insert do `plan_recipes`
    - opcjonalnie: 1× odczyt `recipe_normalized_ingredients.items` + batch insert `shopping_list_items` (N wierszy w jednej instrukcji INSERT ... SELECT)
- **Wąskie gardła**:
    - duże listy `normalized_ingredients` → batch insert; nie wykonywać N osobnych round-tripów z Edge Function.

## 8. Kroki implementacji

1. **Kontrakt API**
    - Potwierdzić, że endpoint zwraca `201` + `{ message }` (bez zmian w kontrakcie).
2. **DB: dostosowanie listy zakupów do surowych wierszy**
    - Dodać `recipe_id`, `recipe_name` do `shopping_list_items` (dla `kind='RECIPE'`).
    - Usunąć/wyłączyć unikalny indeks „merge key” (nie jest już potrzebny).
    - Dodać indeksy pod: `user_id`, `recipe_id`, `is_owned`.
3. **DB: aktualizacja RPC dla `POST /plan/recipes`**
    - Zaktualizować `add_recipe_to_plan_and_update_shopping_list`:
        - zamiast agregacji: insert surowych wierszy (1:1 z elementami znormalizowanych składników)
        - ustawiać `recipe_name` jako snapshot z `recipes.name`
        - utrzymać mapowanie błędów na: `401/403/404/409/422`
4. **Backend: `supabase/functions/plan/plan.service.ts`**
    - Używać RPC jako jedynego miejsca logiki (Edge Function: walidacja + wywołanie + mapowanie błędów).
5. **Testy (manual / http)**
    - dodanie przepisu własnego z `READY` → powstaje N wierszy w `shopping_list_items` (N = liczba items)
    - dodanie przepisu PUBLIC cudzego z `READY` → powstaje N wierszy + `recipe_name` snapshot
    - dodanie przepisu z `PENDING/FAILED` → plan dodany, brak nowych wierszy zakupów
    - duplikat planu → `409`
    - limit 50 → `422`
    - brak dostępu (cudzy PRIVATE/SHARED) → `403`
    - soft-deleted → `404`

