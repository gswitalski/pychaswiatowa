## API Endpoints Implementation Plan: My Plan — `POST /plan/recipes` (z side-effectem aktualizacji listy zakupów)

<analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint: **`POST /plan/recipes`**
- Cel: dodać przepis do listy „Mój plan” zalogowanego użytkownika.
- Zasady domenowe (plan):
    - dostęp: użytkownik może dodać **własny** przepis (dowolna `visibility`) albo **cudzy** tylko gdy `visibility = 'PUBLIC'`
    - przepis nie może być soft-deleted (`deleted_at IS NULL`)
    - brak duplikatów w planie (unikalność per `user_id, recipe_id`)
    - limit: maks. **50** przepisów w planie
- Nowy wymóg (zmiana): **side-effect** po dodaniu przepisu do planu:
    - backend aktualizuje listę zakupów użytkownika na podstawie `recipe_normalized_ingredients` dla dodawanego przepisu (tylko gdy dostępne)
    - reguły merge:
        - scalanie po (`name`, `unit`)
        - sumowanie `amount` tylko gdy `unit != null` i `amount != null`
        - dla `unit = null` (albo brak możliwości ustalenia ilości) utrzymujemy **jedną pozycję „tylko nazwa” per `name`** (bez agregacji ilości)
    - jeśli normalizacja nie jest gotowa (`status != READY`) przepis **nie wnosi** pozycji do listy zakupów (MVP).

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
- Response (plan):
    - prosty payload `{ message: string }` (niezdefiniowany jako osobny DTO w kontraktach — opcjonalnie dodać `MessageResponseDto`)
- Dla listy zakupów (brak jeszcze w `shared/contracts/types.ts`, ale potrzebne dla spójności domeny i przyszłych endpointów):
    - `ShoppingListItemKind = 'RECIPE' | 'MANUAL'`
    - `ShoppingListItemDto` (union dla `RECIPE` i `MANUAL`)
    - (opcjonalnie) `ShoppingListItemRecipeDto`, `ShoppingListItemManualDto`

### 4) Wyodrębnienie logiki do service
- Aktualna funkcja `supabase/functions/plan/` ma już modularny podział (`index.ts` / `plan.handlers.ts` / `plan.service.ts`).
- Rekomendacja: dodać warstwę domenową listy zakupów:
    - **wariant A (zalecany)**: cała operacja „dodaj do planu + update zakupów” jako **pojedynczy RPC w Postgres** (atomiczność).
    - **wariant B**: utrzymać 2 kroki w Edge Function (insert do `plan_recipes`, potem update zakupów) i traktować update jako best-effort (ryzyko niespójności).
    - Zgodnie z zasadami projektu (transakcje i złożona logika w DB) **wariant A jest preferowany**.

### 5) Walidacja wejścia
- `recipe_id`: liczba całkowita dodatnia (Zod).
- JSON parse errors → `400`.
- Walidacja biznesowa (w serwisie / DB RPC):
    - przepis istnieje i `deleted_at IS NULL`
    - user ma dostęp (owner lub `visibility = PUBLIC`)
    - plan limit 50 (wymuszony triggerem / logiką DB)
    - brak duplikatu w planie (unikalność w DB)

### 6) Rejestrowanie błędów w tabeli błędów
- W repo brak dedykowanej „tabeli błędów” dla Edge Functions.
- MVP: logowanie przez `logger` oraz scentralizowane mapowanie błędów przez `handleError` (`supabase/functions/_shared/errors.ts`).
- (Opcjonalnie, future) tabelaryczne logowanie zdarzeń błędów `5xx` jako telemetry (best-effort insert).

### 7) Ryzyka bezpieczeństwa
- **AuthN**: JWT wymagany — brak tokena to `401`.
- **AuthZ**: dodanie cudzych niepublicznych przepisów musi być zablokowane (reguła owner/public).
- **RLS**:
    - insert do `plan_recipes` i wpisy listy zakupów muszą odbywać się w kontekście użytkownika (`auth.uid()`), aby nie omijać RLS na danych użytkownika.
    - odczyt `recipe_normalized_ingredients` dla cudzych przepisów wymaga ostrożności:
        - dozwolone tylko jeśli przepis jest `PUBLIC` (bo składniki są i tak publiczne),
        - alternatywnie: rozszerzyć RLS SELECT na `recipe_normalized_ingredients` dla `PUBLIC` przepisów (decyzja architektoniczna).
- **Anti-leak**: błędy nie powinny ujawniać istnienia cudzych prywatnych przepisów (rekomendacja: `404` zamiast `403` dla „brak dostępu”, jeśli nie jest wymagane rozróżnianie).
- **Dane wejściowe**: brak pola tekstowego poza `recipe_id`, więc ryzyko XSS/SQLi minimalne.

### 8) Scenariusze błędów i kody statusu
- `400 Bad Request`: invalid JSON, `recipe_id` niepoprawny (nie-int / <= 0)
- `401 Unauthorized`: brak/niepoprawny JWT
- `404 Not Found`: przepis nie istnieje / jest soft-deleted (lub „brak dostępu” w wariancie anti-leak)
- `403 Forbidden` (jeśli rozróżniamy): użytkownik nie ma dostępu do przepisu
- `409 Conflict`: przepis już jest w planie
- `422 Unprocessable Entity`: limit 50 przepisów przekroczony
- `500 Internal Server Error`: błędy DB / niespójność danych
</analysis>

## 1. Przegląd punktu końcowego

Endpoint **`POST /plan/recipes`** dodaje przepis do listy „Mój plan” użytkownika. W wersji zmienionej (MVP) posiada side-effect: po dodaniu do planu backend aktualizuje **listę zakupów** użytkownika na podstawie znormalizowanych składników (`recipe_normalized_ingredients`) dla dodawanego przepisu, stosując reguły merge/sumowania.

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

## 3. Szczegóły odpowiedzi

### Sukces
- **201 Created**

```json
{
    "message": "Recipe added to plan successfully."
}
```

### Błędy (kody)
- `400` – walidacja wejścia / invalid JSON
- `401` – brak lub nieprawidłowy JWT
- `404` – przepis nie istnieje / soft-deleted (lub brak dostępu w trybie anti-leak)
- `403` – brak dostępu do przepisu (jeśli rozróżniamy)
- `409` – przepis już jest w planie
- `422` – przekroczony limit 50 przepisów
- `500` – błąd serwera / DB

## 4. Przepływ danych

### 4.1. Warstwa Edge Function (routing → handler → service)

1. `plan/index.ts`:
    - CORS (OPTIONS)
    - routing do `planRouter`
    - obsługa błędów na najwyższym poziomie (`handleError`)
2. `plan/plan.handlers.ts` (`handlePostPlanRecipes`):
    - pobranie kontekstu użytkownika (`getAuthenticatedContext`)
    - parsowanie JSON i walidacja Zod (`AddRecipeToPlanSchema`)
    - wywołanie serwisu `addRecipeToPlan(...)`
    - zwrot `201` z payload `message`
3. `plan/plan.service.ts` (`addRecipeToPlan`):
    - weryfikacja dostępu do przepisu (owner lub PUBLIC; brak soft delete)
    - dodanie do `plan_recipes`
    - **NOWE**: aktualizacja listy zakupów użytkownika w oparciu o `recipe_normalized_ingredients` (jeśli `status=READY`)

### 4.2. Rekomendowana atomiczność (wariant A — zalecany)

Aby uniknąć stanu częściowego (przepis dodany do planu, ale lista zakupów nie zaktualizowana), rekomendujemy przeniesienie operacji do pojedynczej transakcji w DB:

- Nowy RPC w Postgres, np. `add_recipe_to_plan_and_update_shopping_list(p_recipe_id bigint)`.
- Edge Function:
    - nadal waliduje body
    - wywołuje RPC w kontekście użytkownika (RLS + `auth.uid()`)
    - mapuje błędy DB → `ApplicationError`

**Logika RPC (high-level)**:
- `auth_uid := auth.uid()`
- zweryfikuj, że przepis istnieje i `deleted_at IS NULL`
- zweryfikuj dostęp: `recipes.user_id = auth_uid OR recipes.visibility = 'PUBLIC'`
- insert do `plan_recipes (user_id, recipe_id)` (unikalność + trigger limitu)
- jeśli `recipes.normalized_ingredients_status = 'READY'` i istnieje rekord w `recipe_normalized_ingredients`:
    - wstaw wkład (contribution) dla tego przepisu do tabeli wkładów użytkownika
    - zaktualizuj agregaty w tabeli `shopping_list_items` wg reguł merge
- jeśli `status != READY` lub brak rekordu → pomiń wkład (plan i tak się zapisuje)

### 4.3. Model danych listy zakupów (do dodania w DB)

Ponieważ repo nie zawiera jeszcze tabel listy zakupów, a side-effect tego endpointu ich wymaga, rekomendujemy następujący model:

#### Tabela 1: `shopping_list_items` (agregat per user)
- Cel: przechowywać **widok użytkownika** listy zakupów (pozycje z przepisów + manual).
- Minimalne pola:
    - `id bigserial primary key`
    - `user_id uuid not null default auth.uid()`
    - `kind text not null check (kind in ('RECIPE','MANUAL'))`
    - `name text null` (dla `RECIPE`)
    - `amount numeric null` (dla `RECIPE`)
    - `unit text null` (dla `RECIPE`)
    - `text text null` (dla `MANUAL`)
    - `is_owned boolean not null default false`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
- Ograniczenia spójności:
    - `kind='RECIPE'` → `name is not null AND text is null`
    - `kind='MANUAL'` → `text is not null AND name is null AND unit is null AND amount is null`
- Unikalność dla pozycji z przepisów:
    - unikalny indeks po kluczu merge `user_id, name, coalesce(unit,'')` **tylko dla** `kind='RECIPE'`
    - dzięki `coalesce` wspieramy osobną pozycję dla `unit=NULL` (name-only) oraz osobne dla różnych jednostek.

#### Tabela 2: `shopping_list_recipe_contributions` (wkłady per przepis)
- Cel: umożliwić poprawne odejmowanie wkładu przy `DELETE /plan/recipes/{recipeId}` (bez „zgadywania” po agregacji).
- Minimalne pola:
    - `user_id uuid not null default auth.uid()`
    - `recipe_id bigint not null references recipes(id) on delete cascade`
    - `name text not null`
    - `unit text null`
    - `amount numeric null`
    - `created_at timestamptz not null default now()`
    - klucz unikalności: `(user_id, recipe_id, name, coalesce(unit,''))`
- Uwaga: w MVP zakładamy, że gdy `amount` jest nieznane, to `amount=null` i `unit=null` (zgodnie z kontraktem normalizacji).

#### RLS (wymagane)
- `shopping_list_items`:
    - `SELECT/INSERT/UPDATE` tylko dla `user_id = auth.uid()`
    - `DELETE` tylko dla `user_id = auth.uid()` **i** `kind='MANUAL'` (usuniecie recipe-derived zabronione)
- `shopping_list_recipe_contributions`:
    - `SELECT/INSERT/DELETE` tylko dla `user_id = auth.uid()`
- Dla operacji wykonywanych przez worker/service-role (jeśli kiedykolwiek będą potrzebne), dodać oddzielne polityki dla `service_role`.

### 4.4. Algorytm side-effectu (merge/sumowanie)

Wejście: `recipe_normalized_ingredients.items` (tablica `{amount, unit, name}`) dla `recipe_id`.

1. Przefiltruj elementy:
    - odrzuć elementy bez `name` (defensywnie)
2. Zdefiniuj klucz merge:
    - `merge_key = (name_normalized, unit_normalized_or_null)`
3. Dla każdego elementu:
    - jeśli `unit != null` i `amount != null`:
        - dopisz wkład w `shopping_list_recipe_contributions`
        - upsert do `shopping_list_items` (kind=RECIPE, name, unit):
            - jeśli istnieje: `amount := amount + contributed_amount`
            - jeśli nie istnieje: `amount := contributed_amount`
        - nie zmieniaj `is_owned` dla istniejących pozycji
    - jeśli `unit == null` (name-only):
        - dopisz wkład (z `amount=null`, `unit=null`) do `shopping_list_recipe_contributions`
        - upsert `shopping_list_items` (kind=RECIPE, name, unit=null) — zawsze `amount=null`

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (`401`).
- **Autoryzacja**:
    - dodanie przepisu do planu wymaga: owner lub `visibility='PUBLIC'`.
    - rekomendacja anti-leak: dla braku dostępu zwracać `404`, jeśli UI nie potrzebuje rozróżnienia.
- **RLS**:
    - zapisy do `plan_recipes` oraz listy zakupów muszą działać w kontekście użytkownika.
    - odczyt `recipe_normalized_ingredients` dla cudzych przepisów:
        - dozwolić tylko jeśli przepis jest PUBLIC (weryfikacja w logice DB / serwisu), albo
        - rozszerzyć RLS SELECT na `recipe_normalized_ingredients` dla `PUBLIC` przepisów (bez ujawniania prywatnych).
- **Logowanie**:
    - nie logować pełnych list składników/pozycji zakupów; logować `user_id`, `recipe_id`, `itemsCount`, `status`.

## 6. Obsługa błędów

- **400 Bad Request**
    - niepoprawny JSON
    - `recipe_id` nie jest dodatnią liczbą całkowitą
- **401 Unauthorized**
    - brak/niepoprawny JWT
- **404 Not Found**
    - przepis nie istnieje / jest soft-deleted
    - (opcjonalnie) brak dostępu w trybie anti-leak
- **403 Forbidden**
    - brak dostępu do przepisu (jeśli rozróżniamy)
- **409 Conflict**
    - przepis już istnieje w planie (unikalność `plan_recipes`)
- **422 Unprocessable Entity**
    - limit 50 przepisów osiągnięty (trigger/constraint)
- **500 Internal Server Error**
    - błąd DB podczas zapisu planu lub update listy zakupów
    - niespójność: `status=READY`, ale brak rekordu w `recipe_normalized_ingredients` (decyzja: traktować jako „brak wkładu” + log warn, albo `500`; rekomendacja MVP: **warn + brak wkładu**, by nie blokować UX)

## 7. Wydajność

- Cel: utrzymać stałą liczbę operacji DB niezależnie od wielkości planu.
- Rekomendacja: wszystkie zapisy side-effectu wykonać w DB w jednym RPC.
- Odczyty:
    - 1× odczyt `recipes.normalized_ingredients_status` + (opcjonalnie) 1× odczyt `recipe_normalized_ingredients.items` dla `READY`.
- Zapisy:
    - `plan_recipes`: 1× insert
    - wkłady: batch insert do `shopping_list_recipe_contributions` (w jednej instrukcji)
    - agregaty: batch upsert do `shopping_list_items` (w jednej instrukcji) — sumowanie w SQL
- Indeksy:
    - unikalny indeks merge na `shopping_list_items` dla `RECIPE`
    - indeks na `shopping_list_items(user_id, is_owned, name)` dla sortowania w UI (opcjonalnie)

## 8. Kroki implementacji

1. **Kontrakt (shared)**
    - Upewnić się, że `AddRecipeToPlanCommand` jest używany przez FE/BE.
    - Dodać brakujące DTO dla listy zakupów w `shared/contracts/types.ts` (żeby side-effect i przyszłe endpointy bazowały na jednym kontrakcie).
2. **Migracje DB — Shopping List**
    - Dodać tabele: `shopping_list_items`, `shopping_list_recipe_contributions`.
    - Dodać RLS policies zgodnie z sekcją bezpieczeństwa.
    - Dodać indeksy/uniki wspierające merge (`coalesce(unit,'')`).
3. **Migracje DB — RPC**
    - Utworzyć funkcję `add_recipe_to_plan_and_update_shopping_list(p_recipe_id bigint)` (zalecane).
    - Zaimplementować mapowanie błędów (duplikat → 409, limit → 422, brak dostępu → 403/404).
4. **Backend (Edge Function `plan`)**
    - W `plan.service.ts` zastąpić sekwencję:
        - `verifyRecipeAccess` + `insertRecipeToPlan`
      wywołaniem RPC (wariant A), albo dodać po insercie krok side-effectu (wariant B).
    - W `plan.handlers.ts` nie zmieniać kontraktu odpowiedzi (`201` + message).
5. **Testy (manual / http)**
    - Scenariusze:
        - dodanie przepisu własnego z `normalized_ingredients_status=READY` → `shopping_list_items` rośnie/merge działa
        - dodanie przepisu PUBLIC cudzego z `READY` → merge działa (bez naruszenia prywatności)
        - dodanie przepisu z `PENDING/FAILED` → plan dodany, lista zakupów bez zmian
        - duplikat → `409`
        - limit 50 → `422`
        - brak dostępu (cudzy PRIVATE/SHARED) → `404` (lub `403`)
        - soft-deleted → `404`
6. **Checklist bezpieczeństwa**
    - Brak możliwości dopisania zakupów do cudzego `user_id`
    - Brak możliwości odczytu/wycieku prywatnych danych przez side-effect
    - Logi nie zawierają danych wrażliwych (pełnych list składników)

