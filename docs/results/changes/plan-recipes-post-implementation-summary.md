# Podsumowanie Implementacji: POST /plan/recipes (z side-effectem listy zakupów)

## Data: 2026-01-19

## Przegląd

Zaimplementowano endpoint `POST /plan/recipes` zgodnie z planem implementacji. Endpoint dodaje przepis do planu użytkownika i **automatycznie aktualizuje listę zakupów** na podstawie znormalizowanych składników (jeśli są dostępne).

## Zrealizowane Kroki Implementacji

### ✅ Krok 1: Kontrakt (shared/contracts/types.ts)

Dodano kompletne typy DTO dla listy zakupów:

- `ShoppingListItemKind` - enum ('RECIPE' | 'MANUAL')
- `ShoppingListItemRecipeDto` - pozycje z przepisów (name, amount, unit)
- `ShoppingListItemManualDto` - pozycje ręczne (free-text)
- `ShoppingListItemDto` - discriminated union
- `GetShoppingListResponseDto` - response dla GET
- `AddManualShoppingListItemCommand` - command dla dodawania ręcznych pozycji

### ✅ Krok 2: Migracje DB - Tabele Shopping List

**Plik**: `supabase/migrations/20260119120000_create_shopping_list_tables.sql`

#### Tabela: `shopping_list_items`
Agregowane pozycje listy zakupów (widok użytkownika):
- Wspiera pozycje z przepisów (RECIPE) i ręczne (MANUAL)
- Unikalny indeks merge key: `(user_id, name, coalesce(unit, ''))`
- Constraint sprawdzający poprawność pól per `kind`
- RLS policies: SELECT/INSERT/UPDATE dla własnych, DELETE tylko dla MANUAL
- Trigger auto-update `updated_at`

#### Tabela: `shopping_list_recipe_contributions`
Wkłady pojedynczych przepisów (umożliwia poprawne odejmowanie):
- Composite PK: `(user_id, recipe_id, name, coalesce(unit, ''))`
- Foreign key do `recipes` z CASCADE DELETE
- RLS policies: SELECT/INSERT/DELETE dla własnych

### ✅ Krok 3: Migracje DB - RPC dla atomicznej operacji

**Plik**: `supabase/migrations/20260119120100_create_add_recipe_to_plan_rpc.sql`

Funkcja: `add_recipe_to_plan_and_update_shopping_list(p_recipe_id bigint)`

**Atomicznie wykonuje**:
1. Weryfikuje autentykację (`auth.uid()`)
2. Sprawdza dostęp do przepisu (owner lub PUBLIC)
3. Weryfikuje, że przepis nie jest soft-deleted
4. Dodaje do `plan_recipes` (z unikalności i limitem 50)
5. **Side-effect**: Aktualizuje listę zakupów z `recipe_normalized_ingredients` (jeśli status='READY')

**Algorytm merge składników**:
- Grupowanie po kluczu: `(name, unit)`
- Sumowanie `amount` tylko gdy `unit != null` i `amount != null`
- Dla `unit = null` (name-only): jedna pozycja per `name` bez agregacji ilości

**Obsługa błędów**:
- `UNAUTHORIZED` → brak JWT
- `NOT_FOUND` → przepis nie istnieje / soft-deleted
- `FORBIDDEN` → brak dostępu (PRIVATE/SHARED cudzego)
- `CONFLICT` → duplikat w planie
- `PLAN_LIMIT_EXCEEDED` → przekroczony limit 50

**Zwraca metadata**:
```json
{
  "success": true,
  "recipe_id": 123,
  "shopping_list_updated": true,
  "items_added": 5,
  "items_updated": 3
}
```

### ✅ Krok 4: Backend - Aktualizacja Service

**Plik**: `supabase/functions/plan/plan.service.ts`

Zaktualizowano `addRecipeToPlan()`:
- Używa RPC zamiast sekwencji wywołań
- Mapuje błędy RPC na `ApplicationError` przez `mapRpcErrorToApplicationError()`
- Loguje metadata z response (items_added, items_updated)

Funkcje pomocnicze (`verifyRecipeAccess`, `insertRecipeToPlan`):
- Oznaczone jako `@deprecated`
- Zachowane dla potencjalnego przyszłego użycia

### ✅ Krok 5: Rozszerzenie RLS dla recipe_normalized_ingredients

**Plik**: `supabase/migrations/20260119120200_update_recipe_normalized_ingredients_rls.sql`

Zaktualizowano politykę RLS:
- **Stara**: tylko własne przepisy
- **Nowa**: własne przepisy + PUBLIC przepisy innych użytkowników

**Uzasadnienie**: Umożliwia odczyt składników PUBLIC przepisów przy dodawaniu do planu (wymagane dla side-effectu listy zakupów).

### ✅ Krok 6: Seed Data

**Plik**: `supabase/seeds/06_update_normalized_ingredients_status.sql`

Aktualizuje status normalizacji dla wszystkich przepisów, które mają dane w `recipe_normalized_ingredients`:
- Ustawia `normalized_ingredients_status = 'READY'`
- Ustawia `normalized_ingredients_updated_at` na podstawie `recipe_normalized_ingredients.updated_at`

## Architektura i Bezpieczeństwo

### Atomowość Transakcji

**Podejście**: Wariant A (zalecany z planu)
- Pojedyncze RPC w Postgres zapewnia atomowość
- Wszystkie operacje (plan + lista zakupów) w jednej transakcji
- Brak ryzyka częściowych stanów (plan dodany, ale lista nie zaktualizowana)

### Bezpieczeństwo (RLS)

**Plan recipes**:
- INSERT/SELECT/DELETE tylko dla `user_id = auth.uid()`

**Shopping list items**:
- SELECT/INSERT/UPDATE tylko dla `user_id = auth.uid()`
- DELETE tylko dla `kind='MANUAL'` (RECIPE items zarządzane przez system)

**Recipe normalized ingredients**:
- SELECT dla własnych przepisów OR PUBLIC przepisów innych użytkowników
- INSERT/UPDATE tylko dla `service_role`

**RPC**:
- `security definer` - działa w kontekście użytkownika wywołującego
- Weryfikacja `auth.uid()` na początku
- Odczyt `recipe_normalized_ingredients` odbywa się w kontekście użytkownika (zgodnie z rozszerzoną polityką RLS)

### Obsługa Błędów

Handler i service poprawnie mapują błędy:
- `400` - nieprawidłowy JSON / walidacja recipe_id
- `401` - brak/niepoprawny JWT
- `404` - przepis nie istnieje / soft-deleted
- `403` - brak dostępu do przepisu
- `409` - przepis już w planie
- `422` - limit 50 przepisów przekroczony
- `500` - błędy DB / wewnętrzne

## Zgodność z Planem

✅ Wszystkie 6 kroków planu implementacji zrealizowane:
1. ✅ Kontrakt (shared types)
2. ✅ Migracje DB - Shopping List tables
3. ✅ Migracje DB - RPC
4. ✅ Backend (Edge Function) - Service
5. ✅ Backend (Edge Function) - Routing (już istniało)
6. ✅ Walidacja Zod (już istniało)

Dodatkowo:
- ✅ Rozszerzenie RLS dla recipe_normalized_ingredients
- ✅ Seed data dla statusów normalizacji

## Pliki Zmienione/Utworzone

### Nowe Pliki

**Kontrakt**:
- `shared/contracts/types.ts` (zaktualizowany, dodano sekcję Shopping List)

**Migracje**:
- `supabase/migrations/20260119120000_create_shopping_list_tables.sql`
- `supabase/migrations/20260119120100_create_add_recipe_to_plan_rpc.sql`
- `supabase/migrations/20260119120200_update_recipe_normalized_ingredients_rls.sql`

**Seeds**:
- `supabase/seeds/06_update_normalized_ingredients_status.sql`

**Dokumentacja**:
- `docs/results/changes/plan-recipes-post-implementation-summary.md` (ten plik)

### Zaktualizowane Pliki

**Backend**:
- `supabase/functions/plan/plan.service.ts`
  - Zaktualizowano `addRecipeToPlan()` do wywołania RPC
  - Dodano `mapRpcErrorToApplicationError()`
  - Oznaczono stare funkcje pomocnicze jako deprecated

## Następne Kroki

### Rekomendowane Testy Manualne

1. **Test podstawowy (własny przepis)**:
   ```bash
   curl -X POST http://localhost:54321/functions/v1/plan/recipes \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"recipe_id": 1}'
   ```
   - Oczekiwane: 201, przepis dodany, lista zakupów zaktualizowana

2. **Test PUBLIC przepisu**:
   - Dodać PUBLIC przepis innego użytkownika
   - Oczekiwane: 201, lista zakupów zawiera składniki z PUBLIC przepisu

3. **Test duplikatu**:
   - Dodać ten sam przepis dwukrotnie
   - Oczekiwane: 409 CONFLICT

4. **Test limitu 50**:
   - Dodać 50 przepisów, następnie próbować dodać 51-szy
   - Oczekiwane: 422 UNPROCESSABLE_ENTITY

5. **Test PRIVATE/SHARED cudzego przepisu**:
   - Próbować dodać PRIVATE przepis innego użytkownika
   - Oczekiwane: 404 NOT_FOUND (lub 403 FORBIDDEN, w zależności od konfiguracji)

6. **Test soft-deleted**:
   - Próbować dodać przepis z `deleted_at != null`
   - Oczekiwane: 404 NOT_FOUND

7. **Test przepisu bez normalizacji**:
   - Dodać przepis z `normalized_ingredients_status != 'READY'`
   - Oczekiwane: 201, plan zaktualizowany, lista zakupów bez zmian

### Przyszłe Endpointy (TODO)

- `DELETE /plan/recipes/{recipeId}` - **wymaga zaktualizowania** do odejmowania składników z listy zakupów
- `GET /shopping-list` - pobranie listy zakupów użytkownika
- `POST /shopping-list/manual` - dodanie ręcznej pozycji do listy
- `PUT /shopping-list/{id}` - aktualizacja pozycji (np. is_owned)
- `DELETE /shopping-list/{id}` - usunięcie pozycji (tylko MANUAL)

## Uwagi i Zalecenia

1. **DELETE /plan/recipes wymaga aktualizacji**: Obecna implementacja nie odejmuje składników z listy zakupów. Należy dodać RPC `remove_recipe_from_plan_and_update_shopping_list()` z analogiczną logiką odejmowania wkładów.

2. **Monitoring**: Rozważyć dodanie metryk dla:
   - Liczba przepisów dodawanych do planu per user
   - Liczba składników dodawanych do listy zakupów
   - Częstotliwość konfliktów (duplikaty, limity)

3. **Optymalizacja**: Obecna implementacja przetwarza wszystkie składniki w pętli PL/pgSQL. Dla bardzo dużych list składników (>100) rozważyć przepisanie na bulk operations (array aggregation + UNNEST).

4. **UI/UX**: Frontend powinien:
   - Pokazać feedback po dodaniu przepisu (toast "Przepis dodany + X składników dodanych do listy")
   - Umożliwić podgląd składników przed dodaniem do planu
   - Wizualizować wkład poszczególnych przepisów w listę zakupów
