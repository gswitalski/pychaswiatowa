## API Endpoints Implementation Plan: My Plan — `DELETE /plan/recipes/{recipeId}` (z side-effectem odejmowania wkładu z listy zakupów)

<analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint: **`DELETE /plan/recipes/{recipeId}`**
- Cel: usunąć przepis z listy „Mój plan” zalogowanego użytkownika.
- Zasady domenowe (plan):
    - użytkownik może modyfikować wyłącznie swój plan (RLS)
    - operacja jest idempotentna w sensie domenowym: po pierwszym usunięciu kolejne wywołanie zwraca informację, że wpis nie istnieje (w tym projekcie: `404`)
- Nowy wymóg (zmiana): **side-effect** po usunięciu przepisu z planu:
    - backend **odejmuje wkład** składników pochodzących z tego przepisu z listy zakupów użytkownika
    - ręczne pozycje użytkownika (`kind = 'MANUAL'`) **nie są modyfikowane**
    - dla pozycji „z przepisów” (`kind = 'RECIPE'`):
        - klucz agregacji/merge: (`name`, `unit`) z obsługą `unit = null` przez `coalesce(unit,'')`
        - odejmowanie ilości dotyczy wyłącznie przypadków, gdzie `unit != null` i `amount != null`
        - gdy po odjęciu `amount <= 0` pozycja jest usuwana
        - dla pozycji „tylko nazwa” (gdy `unit = null` lub `amount = null`) pozycja jest usuwana **tylko wtedy**, gdy nie ma już żadnych wkładów dla tego (`name`, `unit`) z innych przepisów

### 2) Parametry wymagane i opcjonalne
- Nagłówki:
    - wymagane: `Authorization: Bearer <JWT>`
- Parametry ścieżki:
    - wymagane: `recipeId` (dodatnia liczba całkowita)
- Body: brak
- Query params: brak

### 3) Niezbędne typy DTO i Command modele
- Z `shared/contracts/types.ts` (już istnieją, istotne kontekstowo dla side-effectu):
    - `ShoppingListItemDto` (union `ShoppingListItemRecipeDto | ShoppingListItemManualDto`)
    - `ShoppingListItemKind = 'RECIPE' | 'MANUAL'`
- Dla tego endpointu:
    - brak Command modelu (brak body)
    - brak Response DTO (sukces: `204 No Content`)
- Dla warstwy DB/RPC (wewnętrzne, opcjonalne do typowania po stronie TS):
    - (opcjonalnie) `RemoveRecipeFromPlanRpcResponse` np. `{ success, recipe_id, contributions_removed, items_updated, items_deleted }`

### 4) Wyodrębnienie logiki do service
- Edge Function `supabase/functions/plan/` jest już modularna (`index.ts` / `plan.handlers.ts` / `plan.service.ts` / `plan.types.ts`).
- Rekomendacja: side-effect (odejmowanie wkładu) zrealizować **atomowo** w DB, analogicznie do istniejącego RPC dla dodawania:
    - istnieje: `add_recipe_to_plan_and_update_shopping_list(p_recipe_id)`
    - należy dodać: `remove_recipe_from_plan_and_update_shopping_list(p_recipe_id)`
- `plan.service.ts` powinien wywoływać nowy RPC, a handler pozostaje prosty (walidacja + 204).

### 5) Walidacja wejścia
- `recipeId`:
    - parsowanie z path param
    - walidacja: liczba, integer, > 0 (guard clauses w handlerze)
- Walidacja biznesowa w DB:
    - wpis `plan_recipes(user_id, recipe_id)` musi istnieć, inaczej `NOT_FOUND`
    - odejmowanie dotyczy tylko danych użytkownika (`auth.uid()`), brak możliwości ingerencji w cudze wiersze

### 6) Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)
- W repo nie ma dedykowanej tabeli błędów dla Edge Functions.
- MVP: logowanie przez `logger` + spójna obsługa błędów przez `ApplicationError` / `_shared/errors.ts` oraz logi Supabase.

### 7) Ryzyka bezpieczeństwa
- **AuthN**: JWT wymagany — brak/niepoprawny token -> `401`.
- **AuthZ / RLS**:
    - `plan_recipes`, `shopping_list_items`, `shopping_list_recipe_contributions` mają RLS; operacje muszą używać `auth.uid()` jako źródła `user_id`.
    - operacja nie może ujawniać informacji o planach innych użytkowników (dla prób „cudzego” usunięcia zwracamy `404`).
- **Integralność danych**:
    - możliwe stany „starej” listy zakupów (znana granica MVP): edycja przepisu będącego w planie nie wywołuje recompute; dlatego **odejmowanie powinno bazować na tabeli wkładów** `shopping_list_recipe_contributions`, nie na bieżących normalized ingredients.
- **Race conditions**:
    - równoległe operacje na planie/zakupach powinny być bezpieczne dzięki transakcji w RPC (row locks wynikające z `UPDATE/DELETE`), a w razie niespójności preferujemy „nie zejść poniżej zera” (clamp + log warn).

### 8) Scenariusze błędów i kody statusu
- `400 Bad Request`: niepoprawny `recipeId` (nie-liczba / nie-int / <= 0)
- `401 Unauthorized`: brak/niepoprawny JWT
- `404 Not Found`: przepis nie jest w planie użytkownika (także przy próbie „cudzego” usunięcia, anti-leak)
- `500 Internal Server Error`: błąd DB / nieoczekiwana niespójność
</analysis>

## 1. Przegląd punktu końcowego

Endpoint **`DELETE /plan/recipes/{recipeId}`** usuwa wskazany przepis z listy „Mój plan” zalogowanego użytkownika. W wersji zmienionej (MVP) posiada side-effect: po usunięciu wpisu z planu backend aktualizuje listę zakupów użytkownika poprzez **odejmowanie** wkładu składników przypisanych do tego przepisu.

Kluczową decyzją architektoniczną jest wykonanie usunięcia z planu i aktualizacji zakupów **atomowo** w bazie (RPC w Postgres), aby uniknąć stanów częściowych.

## 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/plan/recipes/{recipeId}`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
- **Parametry**:
    - **Wymagane**:
        - `recipeId` (path) — dodatnia liczba całkowita
    - **Opcjonalne**: brak
- **Request Body**: brak

## 3. Wykorzystywane typy

- **Frontend/kontrakt (kontekst side-effectu)**:
    - `ShoppingListItemDto`, `ShoppingListItemRecipeDto`, `ShoppingListItemManualDto`, `ShoppingListItemKind` z `shared/contracts/types.ts`
- **Backend**:
    - `ApplicationError` (mapowanie błędów na statusy)
    - (opcjonalnie) typ dla odpowiedzi RPC (metadane) — tylko do logowania, nie jest zwracany klientowi

## 4. Szczegóły odpowiedzi

### Sukces
- **204 No Content**
    - brak body

### Błędy (kody)
- `400` – walidacja `recipeId`
- `401` – brak lub nieprawidłowy JWT
- `404` – przepis nie jest w planie użytkownika
- `500` – błąd serwera / DB

## 5. Przepływ danych

### 5.1. Warstwa Edge Function (routing → handler → service)

1. `plan/index.ts`:
    - CORS (OPTIONS)
    - routing do `planRouter`
    - obsługa błędów na najwyższym poziomie (`handleError`)
2. `plan/plan.handlers.ts` (`handleDeletePlanRecipe`):
    - pobranie kontekstu użytkownika (`getAuthenticatedContext`)
    - walidacja `recipeId` (guard clauses)
    - wywołanie serwisu `removeRecipeFromPlan(...)`
    - zwrot `204 No Content`
3. `plan/plan.service.ts` (`removeRecipeFromPlan`):
    - **NOWE (zalecane)**: wywołanie RPC `remove_recipe_from_plan_and_update_shopping_list`
    - mapowanie błędów DB → `ApplicationError` (`NOT_FOUND` → 404 itd.)

### 5.2. Rekomendowana atomiczność (DB RPC — zalecane)

Aby zapewnić spójność „plan ↔ zakupy”, logikę przenosimy do Postgresa w formie jednej funkcji RPC:

- **Proponowana nazwa**: `public.remove_recipe_from_plan_and_update_shopping_list(p_recipe_id bigint)`
- **Wymagania**:
    - działa w transakcji (domyślnie dla funkcji PL/pgSQL)
    - opiera się o `auth.uid()` (nie przyjmuje `user_id` z zewnątrz)
    - aktualizuje wyłącznie wiersze użytkownika

### 5.3. Algorytm side-effectu (odejmowanie) — na bazie wkładów

Źródło prawdy dla odejmowania: `public.shopping_list_recipe_contributions`.

**Rekomendowany przebieg w RPC (high-level):**

1. `v_user_id := auth.uid()`; jeśli null → `UNAUTHORIZED`
2. Usuń wpis z `plan_recipes`:
    - `delete from public.plan_recipes where user_id=v_user_id and recipe_id=p_recipe_id returning recipe_id`
    - jeśli brak wiersza → `NOT_FOUND: Recipe not found in plan`
3. Pobierz i jednocześnie usuń wkłady tego przepisu:
    - `delete from public.shopping_list_recipe_contributions where user_id=v_user_id and recipe_id=p_recipe_id returning name, unit, amount`
    - wynik (0..N) stanowi listę „wkładów do odjęcia”
4. Dla każdego zwróconego wkładu (`name`, `unit`, `amount`):
    - jeśli `unit is not null and amount is not null`:
        - wykonaj `update public.shopping_list_items set amount = coalesce(amount,0) - amount, updated_at=now() where user_id=v_user_id and kind='RECIPE' and name=name and coalesce(unit,'')=coalesce(unit,'')`
        - następnie usuń wiersze, gdzie `amount <= 0` (tylko dla `unit is not null`)
    - w przeciwnym razie (pozycja nieagregowalna: unit/amount null):
        - sprawdź, czy po usunięciu wkładu istnieją jeszcze jakiekolwiek wkłady dla tego klucza:
            - `exists(select 1 from public.shopping_list_recipe_contributions where user_id=v_user_id and name=name and coalesce(unit,'')=coalesce(unit,'') limit 1)`
        - jeśli nie istnieją → usuń odpowiadającą pozycję z `shopping_list_items` (kind='RECIPE', name, unit)
        - jeśli istnieją → pozostaw pozycję bez zmian (ew. „touch” `updated_at` opcjonalnie)
5. Zwróć metadane (opcjonalnie) jako `jsonb` do logów (np. liczba usuniętych wkładów, liczba zaktualizowanych/usuniętych pozycji).

**Uwagi defensywne (MVP):**
- Jeżeli `shopping_list_items` nie zawiera oczekiwanej pozycji dla wkładu (brak wiersza) — nie traktować tego jako błąd krytyczny; odejmowanie nie jest potrzebne, ale wkład i tak powinien zostać usunięty.
- Jeżeli odejmowanie prowadzi do wartości ujemnej (np. przez wcześniejszą niespójność) — preferowane zachowanie:
    - usunąć pozycję (jak dla `amount <= 0`) i zalogować ostrzeżenie w DB/Edge (metryka).

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (`401`).
- **Autoryzacja / anti-leak**:
    - brak możliwości ingerencji w cudzy plan i zakupy dzięki RLS + `auth.uid()`
    - dla prób „cudzego” usunięcia wynik powinien być nieodróżnialny od „brak w planie” (`404`)
- **RLS**:
    - `plan_recipes`: `DELETE` wyłącznie dla `auth.uid() = user_id`
    - `shopping_list_items`: `UPDATE` wyłącznie dla `auth.uid() = user_id`
    - `shopping_list_recipe_contributions`: `DELETE` wyłącznie dla `auth.uid() = user_id`
- **Minimalizacja logów wrażliwych**:
    - nie logować nazw składników w Edge Function; logować agregaty: `recipeId`, `contributionsRemoved`, `itemsUpdated`, `itemsDeleted`

## 7. Obsługa błędów

- **400 Bad Request**
    - `recipeId` nie jest liczbą / nie jest int / `<= 0`
- **401 Unauthorized**
    - brak lub nieprawidłowy JWT (obsługiwane w `_shared/supabase-client.ts`)
- **404 Not Found**
    - brak wpisu w `plan_recipes` dla (`auth.uid()`, `recipeId`)
- **500 Internal Server Error**
    - nieoczekiwany błąd DB/RPC
    - błąd aktualizacji listy zakupów (w wariancie zalecanym nie powinien wystąpić bez rollbacku)

## 8. Wydajność

- Operacja jest O(k) względem liczby wkładów składników dla jednego przepisu (zwykle kilkanaście–kilkadziesiąt).
- Kluczowe indeksy:
    - `plan_recipes` — PK `(user_id, recipe_id)` (szybki delete)
    - `shopping_list_recipe_contributions` — indeks `idx_shopping_list_contributions_user_recipe (user_id, recipe_id)` (szybki delete returning)
    - `shopping_list_items` — unikalny indeks merge key `idx_shopping_list_items_recipe_merge_key (user_id, name, coalesce(unit,'')) where kind='RECIPE'` (szybkie update/delete po kluczu)
- Rekomendacja: trzymać logikę w DB RPC, by uniknąć wielu round-tripów i stanów częściowych.

## 9. Kroki implementacji

1. **DB: dodać RPC do usuwania z planu + odejmowania**
    - Utworzyć migrację: `supabase/migrations/YYYYMMDDHHMMSS_create_remove_recipe_from_plan_rpc.sql`
    - Zaimplementować `public.remove_recipe_from_plan_and_update_shopping_list(p_recipe_id bigint) returns jsonb`
    - Ustalić komunikaty błędów w stylu istniejącego RPC (prefixy `UNAUTHORIZED`, `NOT_FOUND`) dla łatwego mapowania w TS.
2. **Backend: zaktualizować `plan.service.ts`**
    - Zmienić `removeRecipeFromPlan(...)` tak, aby:
        - wywoływał RPC w kontekście użytkownika (`client.rpc(...)`)
        - mapował błędy RPC na `ApplicationError` (`NOT_FOUND` → 404, pozostałe → 500)
    - Dodać logowanie metryk (bez nazw składników).
3. **Backend: utrzymać handler bez zmian kontraktowych**
    - `plan.handlers.ts` pozostaje odpowiedzialny tylko za walidację `recipeId` i zwrócenie `204`.
4. **Testy manualne / regresja**
    - Rozszerzyć `supabase/functions/plan/TESTING.md` o scenariusze listy zakupów dla DELETE:
        - `DELETE` usuwa wkłady z `shopping_list_recipe_contributions`
        - `DELETE` zmniejsza `shopping_list_items.amount` dla pozycji agregowalnych
        - `DELETE` usuwa pozycję, gdy `amount <= 0`
        - `DELETE` nie dotyka `kind='MANUAL'`
        - name-only (`unit null`): pozycja znika dopiero gdy nie ma innych wkładów dla tego `name`
5. **Checklist spójności danych**
    - `plan_recipes` usunięty dla (`user_id`, `recipe_id`)
    - wkłady usunięte dla (`user_id`, `recipe_id`)
    - agregaty `shopping_list_items` zaktualizowane/usunięte zgodnie z regułami

