# Normalized Ingredients – Implementation Summary

## 📋 Przegląd

Implementacja endpointa **GET /recipes/{id}/normalized-ingredients** umożliwiającego odczyt statusu i wyniku procesu normalizacji składników przepisu.

**Data implementacji:** 2026-01-18  
**Status:** ✅ Kompletna (kroki 1-8/8)

---

## 🎯 Zaimplementowane komponenty

### 1. Kontrakt FE/BE (shared/contracts/types.ts)

**Dodane typy:**
- `NormalizedIngredientsStatus` - enum dla statusu ('PENDING' | 'READY' | 'FAILED')
- `GetRecipeNormalizedIngredientsResponseDto` - DTO odpowiedzi endpointa
  - `recipe_id: number`
  - `status: NormalizedIngredientsStatus`
  - `updated_at: string | null`
  - `items: NormalizedIngredientDto[]`

*(Typy `NormalizedIngredientUnit` i `NormalizedIngredientDto` już istniały)*

### 2. Migracja bazy danych

**Plik:** `supabase/migrations/20260118120000_add_normalized_ingredients_to_recipes.sql`

**Zmiany w schemacie:**
- **Tabela `recipes`** - nowe kolumny:
  - `normalized_ingredients_status` (text, NOT NULL, default 'PENDING', CHECK constraint)
  - `normalized_ingredients_updated_at` (timestamptz, nullable)

- **Nowa tabela `recipe_normalized_ingredients`:**
  - `recipe_id` (bigint, PRIMARY KEY, FK → recipes ON DELETE CASCADE)
  - `items` (jsonb, NOT NULL - tablica obiektów {amount, unit, name})
  - `updated_at` (timestamptz, NOT NULL, default now())

**RLS policies:**
- SELECT dla użytkowników (tylko własne przepisy, respektujące soft-delete)
- ALL dla service_role (workery/background jobs)

### 3. Typy TypeScript (database.types.ts)

**Zaktualizowane pliki:**
- `shared/types/database.types.ts` ✅
- `supabase/functions/_shared/database.types.ts` ✅

**Dodane:**
- Kolumny `normalized_ingredients_status` i `normalized_ingredients_updated_at` w typie `recipes`
- Nowa tabela `recipe_normalized_ingredients` z relacjami
- Poprawka: dodano brakującą kolumnę `tips` do tabeli `recipes`

### 4. Service Layer (recipes.service.ts)

**Funkcja:** `getRecipeNormalizedIngredients`

**Parametry:**
- `client: TypedSupabaseClient` (authenticated)
- `recipeId: number`
- `userId: string` (do logowania)

**Logika biznesowa:**
1. Pobranie statusu z `recipes` (z filtrem soft-delete)
2. Walidacja dostępu przez RLS → 404 jeśli brak
3. Status != READY → zwrot pustej tablicy items
4. Status = READY → pobranie items z `recipe_normalized_ingredients`
5. Walidacja spójności (READY bez danych → 500)
6. Parsowanie i walidacja JSONB
7. Zwrot DTO

**Obsługa błędów:**
- `NOT_FOUND` (404) - przepis nie istnieje/soft-deleted/brak dostępu
- `INTERNAL_ERROR` (500) - błąd DB/niespójność danych/błąd parsowania

**Typy lokalne:**
- `NormalizedIngredientsStatus`
- `NormalizedIngredientUnit`
- `NormalizedIngredientDto`
- `GetRecipeNormalizedIngredientsResult`

### 5. Handler Layer (recipes.handlers.ts)

**Handler:** `handleGetRecipeNormalizedIngredients`

**Przepływ:**
1. Logowanie rozpoczęcia requestu
2. Walidacja `recipeId` (400 dla niepoprawnego)
3. Uwierzytelnienie (401 dla braku/niepoprawnego JWT)
4. Wywołanie serwisu
5. Logowanie sukcesu (itemsCount, status)
6. Zwrot 200 OK z JSON
7. Obsługa błędów przez `handleError`

### 6. Routing (recipes.handlers.ts)

**Dodane:**
- Funkcja `extractRecipeIdFromNormalizedIngredientsPath(url)`
  - Pattern: `/\/recipes\/([^/]+)\/normalized-ingredients\/?$/`
  
**Router:**
- Sprawdzanie ścieżki `/recipes/{id}/normalized-ingredients` (przed `/recipes/{id}`)
- Delegacja do handlera w sekcji GET
- Aktualizacja dokumentacji routera

**Kolejność sprawdzania ścieżek:**
1. `/recipes/feed`
2. `/recipes/import`
3. `/recipes/{id}/normalized-ingredients` ← **NOWY**
4. `/recipes/{id}/collections`
5. `/recipes/{id}/image`
6. `/recipes/{id}` (generic)

### 7. Testy manualne

**Plik:** `supabase/functions/recipes/test-requests-normalized-ingredients.http`

**13 scenariuszy testowych:**
1. Status READY z danymi
2. Status PENDING (puste items)
3. Status FAILED (puste items)
4. 401 - Brak JWT
5. 401 - Niepoprawny JWT
6. 400 - ID nie jest liczbą
7. 400 - ID = 0
8. 400 - ID ujemne
9. 404 - Przepis nie istnieje
10. 404 - Przepis soft-deleted
11. 404 - Przepis innego użytkownika (anti-leak)
12. Edge case - READY z pustą tablicą
13. Przykład - złożony przepis z wieloma jednostkami

### 8. Dokumentacja wdrożeniowa

**Plik:** `docs/results/deployment-checklist-normalized-ingredients-endpoint.md`

**Zawiera:**
- ✅ Security verification (AuthN, AuthZ, anti-leak, soft-delete, logging)
- ✅ Response format verification (success, errors, headers)
- ✅ Business logic verification (status handling, consistency)
- ✅ Performance checklist (queries, indexes)
- ✅ Testing checklist (functional, edge cases, integration)
- ✅ Database verification (schema, RLS, migration)
- ✅ Documentation checklist (code, API, types)
- ✅ Deployment steps (pre/during/post)
- ✅ Known limitations
- ✅ Rollback plan

---

## 🔍 Szczegóły techniczne

### Bezpieczeństwo
- JWT wymagany (401 bez tokena)
- RLS na obu tabelach (`recipes` i `recipe_normalized_ingredients`)
- Anti-leak: 404 dla "not found" i "access denied"
- Soft-delete respektowany w zapytaniach
- Bezpieczne logowanie (tylko metryki, bez treści)

### Wydajność
- Maksymalnie 2 zapytania DB per request
- Warunkowe zapytanie (normalized table tylko gdy READY)
- Indeks PK na recipe_normalized_ingredients(recipe_id)
- Minimal SELECT (tylko potrzebne kolumny)

### Spójność danych
- Status PENDING/FAILED → items = []
- Status READY → items z tabeli (walidacja spójności)
- JSONB parsing z error handling
- Atomowość przez użycie tego samego authenticated client

### Walidacja
- Recipe ID: dodatnia liczba całkowita
- JSONB items: tablica obiektów z wymaganą strukturą
- Każdy item: name (string), amount/unit (nullable)
- Unit z kontrolowanej listy: g, ml, szt., ząbek, łyżeczka, łyżka, szczypta, pęczek

---

## 📦 Pliki zmienione/dodane

### Dodane:
1. `supabase/migrations/20260118120000_add_normalized_ingredients_to_recipes.sql`
2. `supabase/functions/recipes/test-requests-normalized-ingredients.http`
3. `docs/results/deployment-checklist-normalized-ingredients-endpoint.md`
4. `docs/results/changes/normalized-ingredients-implementation-summary.md` (ten plik)

### Zmodyfikowane:
1. `shared/contracts/types.ts`
   - Dodano `NormalizedIngredientsStatus`
   - Dodano `GetRecipeNormalizedIngredientsResponseDto`

2. `shared/types/database.types.ts`
   - Zaktualizowano typ `recipes` (2 nowe kolumny)
   - Dodano typ `recipe_normalized_ingredients`
   - Dodano brakującą kolumnę `tips`

3. `supabase/functions/_shared/database.types.ts`
   - Zaktualizowano typ `recipes` (2 nowe kolumny)
   - Dodano typ `recipe_normalized_ingredients`

4. `supabase/functions/recipes/recipes.service.ts`
   - Dodano funkcję `getRecipeNormalizedIngredients`
   - Dodano typy lokalne (NormalizedIngredientsStatus, etc.)

5. `supabase/functions/recipes/recipes.handlers.ts`
   - Dodano handler `handleGetRecipeNormalizedIngredients`
   - Dodano funkcję `extractRecipeIdFromNormalizedIngredientsPath`
   - Zaktualizowano router `recipesRouter`
   - Zaktualizowano import z service

---

## ✅ Checklist implementacji

- [x] **Krok 1:** Kontrakt FE/BE (shared types)
- [x] **Krok 2:** Migracja bazy danych
- [x] **Krok 3:** Regeneracja typów DB
- [x] **Krok 4:** Service layer
- [x] **Krok 5:** Handler layer
- [x] **Krok 6:** Routing
- [x] **Krok 7:** Testy manualne (HTTP requests)
- [x] **Krok 8:** Checklist wdrożeniowy

**Brak błędów lintera:** ✅

---

## 🚀 Następne kroki (przed wdrożeniem)

### Wymagane:
1. [ ] Uruchomić migrację na lokalnej bazie: `supabase db reset` lub `supabase db push`
2. [ ] Zweryfikować, że tabele i kolumny zostały utworzone
3. [ ] Przetestować endpoint lokalnie z prawdziwymi danymi
4. [ ] Wykonać wszystkie scenariusze z pliku test-requests
5. [ ] Zweryfikować logi (brak wrażliwych danych)

### Opcjonalne:
1. [ ] Dodać unit testy (jeśli framework testowy dostępny)
2. [ ] Przetestować na staging environment
3. [ ] Code review przez członka zespołu
4. [ ] Performance testing z dużymi przepisami (50+ składników)

### Integracja z workerem (przyszłość):
1. [ ] Implementacja workera/job do automatycznej normalizacji po POST/PUT
2. [ ] Endpoint POST /recipes/{id}/normalized-ingredients/refresh (ręczne odświeżenie)
3. [ ] Monitorowanie statusów FAILED (alerty)

---

## 📞 Kontakt w razie problemów

- **Implementacja backend:** Sprawdź logi Supabase Edge Function
- **Problemy z RLS:** Zweryfikuj polityki przez dashboard Supabase
- **Niespójność danych:** Sprawdź status vs dane w recipe_normalized_ingredients
- **Błędy parsowania:** Zweryfikuj format JSONB items w bazie

---

**✨ Implementacja zakończona pomyślnie!**
