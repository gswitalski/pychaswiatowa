# Checklist Implementacji: POST /plan/recipes

## Data: 2026-01-19
## Status: ✅ KOMPLETNE (Kroki 1-6)

---

## ✅ Krok 1: Kontrakt (shared/contracts/types.ts)

- [x] Dodano `ShoppingListItemKind` enum
- [x] Dodano `ShoppingListItemRecipeDto` interface
- [x] Dodano `ShoppingListItemManualDto` interface
- [x] Dodano `ShoppingListItemDto` discriminated union
- [x] Dodano `GetShoppingListResponseDto` interface
- [x] Dodano `AddManualShoppingListItemCommand` interface
- [x] Brak błędów linter

---

## ✅ Krok 2: Migracje DB - Tabele Shopping List

### Plik: `supabase/migrations/20260119120000_create_shopping_list_tables.sql`

#### Tabela: `shopping_list_items`
- [x] Kolumny: id, user_id, kind, name, amount, unit, text, is_owned, created_at, updated_at
- [x] CHECK constraint dla `kind` ('RECIPE', 'MANUAL')
- [x] CHECK constraint dla poprawności pól per `kind`
- [x] Unikalny indeks merge key: `(user_id, name, coalesce(unit, ''))`
- [x] Indeksy: user_id+kind, user_id+is_owned
- [x] RLS enabled
- [x] Policy: SELECT dla własnych
- [x] Policy: INSERT dla własnych
- [x] Policy: UPDATE dla własnych
- [x] Policy: DELETE tylko dla MANUAL
- [x] Trigger: auto-update updated_at

#### Tabela: `shopping_list_recipe_contributions`
- [x] Kolumny: user_id, recipe_id, name, unit, amount, created_at
- [x] Composite PK: `(user_id, recipe_id, name, coalesce(unit, ''))`
- [x] Foreign key do recipes (CASCADE DELETE)
- [x] Indeks: user_id+recipe_id
- [x] RLS enabled
- [x] Policy: SELECT dla własnych
- [x] Policy: INSERT dla własnych
- [x] Policy: DELETE dla własnych
- [x] Komentarze do tabel i kolumn

---

## ✅ Krok 3: Migracje DB - RPC

### Plik: `supabase/migrations/20260119120100_create_add_recipe_to_plan_rpc.sql`

#### Funkcja: `add_recipe_to_plan_and_update_shopping_list(p_recipe_id bigint)`

**Weryfikacja:**
- [x] Deklaracja funkcji z parametrem `p_recipe_id`
- [x] `security definer` - wykonuje się w kontekście użytkownika
- [x] Zwraca `jsonb` z metadata

**Logika:**
- [x] Pobranie `auth.uid()` i weryfikacja (NOT NULL)
- [x] Odczyt recipes: user_id, visibility, deleted_at, normalized_ingredients_status (FOR UPDATE lock)
- [x] Sprawdzenie istnienia przepisu (NOT FOUND if not exists)
- [x] Sprawdzenie soft-delete (NOT FOUND if deleted_at != null)
- [x] Sprawdzenie dostępu (FORBIDDEN if not owner AND not PUBLIC)
- [x] INSERT do plan_recipes (with error handling)
- [x] Obsługa unique_violation → CONFLICT
- [x] Obsługa PLAN_LIMIT_EXCEEDED → re-raise

**Side-effect (Shopping List):**
- [x] Sprawdzenie `normalized_ingredients_status = 'READY'`
- [x] Pobranie `recipe_normalized_ingredients.items`
- [x] Pętla po każdym składniku
- [x] Ekstrakcja: name, unit, amount
- [x] Skip dla empty name (defensive)
- [x] INSERT do `shopping_list_recipe_contributions`
- [x] Upsert do `shopping_list_items` (merge logic)
  - [x] Dla unit!=null i amount!=null: sumowanie amount
  - [x] Dla unit=null: brak sumowania, tylko updated_at
- [x] Zliczanie items_added, items_updated

**Response:**
- [x] Zwraca jsonb z: success, recipe_id, shopping_list_updated, items_added, items_updated
- [x] Komentarz do funkcji

---

## ✅ Krok 4: Backend (Edge Function) - Service

### Plik: `supabase/functions/plan/plan.service.ts`

#### Funkcja: `addRecipeToPlan()`
- [x] Zaktualizowano docstring (dodano info o side-effect)
- [x] Wywołanie RPC: `client.rpc('add_recipe_to_plan_and_update_shopping_list', { p_recipe_id: recipeId })`
- [x] Obsługa błędów: `if (error)` → `mapRpcErrorToApplicationError()`
- [x] Logowanie success z metadata (shopping_list_updated, items_added, items_updated)

#### Funkcja: `mapRpcErrorToApplicationError()`
- [x] Mapuje UNAUTHORIZED → ApplicationError 401
- [x] Mapuje NOT_FOUND → ApplicationError 404
- [x] Mapuje FORBIDDEN → ApplicationError 403
- [x] Mapuje CONFLICT → ApplicationError 409
- [x] Mapuje PLAN_LIMIT_EXCEEDED → ApplicationError 422
- [x] Generyczny błąd → ApplicationError 500
- [x] Logowanie na odpowiednich poziomach (error/warn)

#### Deprecated functions
- [x] `verifyRecipeAccess()` oznaczone jako @deprecated
- [x] `insertRecipeToPlan()` oznaczone jako @deprecated
- [x] Brak błędów linter

---

## ✅ Krok 5: Backend (Edge Function) - Routing & Handler

### Plik: `supabase/functions/plan/plan.handlers.ts`
- [x] Handler `handlePostPlanRecipes()` już istnieje
- [x] Walidacja przez `AddRecipeToPlanSchema`
- [x] Wywołanie `addRecipeToPlan(client, user.id, recipe_id)`
- [x] Response: 201 + `{ message: "Recipe added to plan successfully." }`

### Plik: `supabase/functions/plan/index.ts`
- [x] Routing `POST /recipes` → `handlePostPlanRecipes()` już istnieje
- [x] CORS headers
- [x] Error handling przez `handleError()`

---

## ✅ Krok 6: Walidacja Zod

### Plik: `supabase/functions/plan/plan.types.ts`
- [x] Schema `AddRecipeToPlanSchema` już istnieje
- [x] Walidacja: `recipe_id` jest number, int, positive

---

## ✅ Dodatkowe (Bezpieczeństwo i Seed Data)

### RLS dla recipe_normalized_ingredients

**Plik**: `supabase/migrations/20260119120200_update_recipe_normalized_ingredients_rls.sql`
- [x] Drop starej polityki "Users can read their own recipe normalized ingredients"
- [x] Nowa polityka: "Users can read normalized ingredients for accessible recipes"
  - [x] Własne przepisy (any visibility)
  - [x] PUBLIC przepisy innych użytkowników
- [x] Komentarz do polityki

### Seed Data

**Plik**: `supabase/seeds/06_update_normalized_ingredients_status.sql`
- [x] UPDATE recipes SET status='READY' WHERE exists in recipe_normalized_ingredients
- [x] UPDATE normalized_ingredients_updated_at
- [x] RAISE NOTICE z liczbą zaktualizowanych

---

## ✅ Dokumentacja

- [x] Podsumowanie implementacji: `docs/results/changes/plan-recipes-post-implementation-summary.md`
- [x] Checklist: `docs/results/changes/plan-recipes-post-implementation-checklist.md` (ten plik)
- [x] Testy manualne: `docs/testing/plan-recipes-post-manual-tests.http`

---

## 🧪 Następne Kroki: Testowanie

### Wdrożenie Migracji (Local)
```bash
cd supabase
supabase db reset  # Reset + apply all migrations + run seeds
# LUB
supabase migration up  # Apply new migrations only
supabase db seed  # Run seeds
```

### Uruchomienie Edge Function (Local)
```bash
supabase functions serve plan --env-file supabase/.env.local
```

### Testy Manualne
1. Otworzyć `docs/testing/plan-recipes-post-manual-tests.http`
2. Ustawić `@token` (pobrać JWT po zalogowaniu test użytkownika)
3. Wykonać testy 1-13 zgodnie z komentarzami

### Scenariusze do Przetestowania
- [ ] Test 1: Dodanie własnego przepisu z normalized ingredients
- [ ] Test 2: Dodanie PUBLIC przepisu innego użytkownika
- [ ] Test 3: Dodanie przepisu bez normalized ingredients (PENDING/FAILED)
- [ ] Test 4: Duplikat (409 CONFLICT)
- [ ] Test 5: Nieistniejący przepis (404 NOT FOUND)
- [ ] Test 6: PRIVATE/SHARED cudzy przepis (404/403)
- [ ] Test 7-10: Walidacja (400 BAD REQUEST)
- [ ] Test 11-12: Autentykacja (401 UNAUTHORIZED)
- [ ] Test 13: Limit 50 (422 UNPROCESSABLE ENTITY)
- [ ] Verify: Shopping list merge logic (składniki sumowane po name+unit)

---

## 📝 Uwagi Implementacyjne

### Atomowość
✅ Cała operacja (plan + shopping list) wykonana w jednej transakcji RPC
✅ Brak ryzyka częściowych stanów

### Bezpieczeństwo
✅ RLS policies wymagają `auth.uid()` dla wszystkich operacji
✅ RPC weryfikuje dostęp do przepisu (owner/PUBLIC)
✅ Rozszerzona polityka RLS dla PUBLIC normalized ingredients

### Wydajność
⚠️ Pętla PL/pgSQL po składnikach - dla >100 składników rozważyć bulk operations
✅ Indeksy merge key dla szybkiego upsert
✅ FOR UPDATE lock na recipes zapobiega race conditions

### Spójność Danych
✅ Foreign key CASCADE DELETE (recipe deletion cleans up contributions)
✅ Composite PK zapobiega duplikatom wkładów
✅ CHECK constraints zapewniają poprawność kind fields

---

## ⚠️ TODO: Przyszłe Prace

### Krytyczne
- [ ] **Zaktualizować `DELETE /plan/recipes/{id}`** - obecnie nie odejmuje składników z listy zakupów
  - Wymaga nowego RPC: `remove_recipe_from_plan_and_update_shopping_list()`
  - Logika: usunięcie wkładów z `shopping_list_recipe_contributions` + przeliczenie agregatów

### Nice-to-Have
- [ ] Endpoint `GET /shopping-list`
- [ ] Endpoint `POST /shopping-list/manual`
- [ ] Endpoint `PUT /shopping-list/{id}` (toggle is_owned)
- [ ] Endpoint `DELETE /shopping-list/{id}` (tylko MANUAL)
- [ ] Monitoring metryk (liczba przepisów w planie, składników w liście)
- [ ] Optymalizacja RPC dla bardzo dużych list składników (bulk operations)

---

**Status**: ✅ Implementacja kompletna, gotowa do testowania
**Data**: 2026-01-19
