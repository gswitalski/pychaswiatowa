# Audit: Bezpośredni Dostęp do Supabase w Frontendzie

## Podsumowanie

Znaleziono **8 serwisów** które łamią nowe zasady architektury i używają bezpośrednich zapytań do Supabase zamiast wywoływać REST API.

### Statystyki

- **Łączna liczba `supabase.from()` wywołań:** 27+
- **Serwisy wymagające refaktoryzacji:** 7
- **Serwisy poprawne:** 2 (SearchService, RecipesService z recipes-list)
- **Priorytety:** 3 High, 4 Medium

---

## ❌ Serwisy Do Naprawy

### 🔴 HIGH PRIORITY (Pełny CRUD bez API)

#### 1. `src/app/core/services/collections-api.service.ts`

**Problem:** Cały serwis używa bezpośrednich zapytań do Supabase.

**Złamane operacje:**
```typescript
// ❌ GET /collections
this.supabase.from('collections').select('id, name, description')

// ❌ POST /collections  
this.supabase.from('collections').insert({ name, description, user_id })

// ❌ PUT /collections/{id}
this.supabase.from('collections').update(updateData)

// ❌ DELETE /collections/{id}
this.supabase.from('collections').delete()

// ❌ GET /collections/{id}
this.supabase.from('collections').select('id, name, description')
this.supabase.from('recipe_collections').select('recipe_id, recipes(...)')

// ❌ DELETE /collections/{collectionId}/recipes/{recipeId}
this.supabase.from('recipe_collections').delete()
```

**Liczba bezpośrednich zapytań:** 9

**Backend Endpoint:** Sprawdź czy istnieje `supabase/functions/collections/`

**Akcja:**
1. ✅ Sprawdź czy backend endpoint istnieje
2. ❌ Jeśli nie - utwórz endpoint w backendzie
3. ❌ Zamień wszystkie metody na `supabase.functions.invoke()`

---

#### 2. `src/app/shared/components/add-to-collection-dialog/collections.service.ts`

**Problem:** Dialog używa bezpośrednich operacji na bazie.

**Złamane operacje:**
```typescript
// ❌ GET - lista kolekcji
this.supabase.from('collections').select('id, name, description')

// ❌ POST - dodanie przepisu do kolekcji
this.supabase.from('recipe_collections').insert({ collection_id, recipe_id })

// ❌ POST - utworzenie kolekcji
this.supabase.from('collections').insert({ name, user_id })

// ❌ POST - dodanie przepisu do nowej kolekcji (2 operacje)
this.supabase.from('collections').insert(...)
this.supabase.from('recipe_collections').insert(...)
```

**Liczba bezpośrednich zapytań:** 5

**Backend Endpoint:** 
- GET /collections (lista)
- POST /collections/{id}/recipes (dodanie przepisu)
- POST /collections + POST /{id}/recipes (atomic operation)

**Akcja:**
1. ❌ Użyj `CollectionsApiService` lub utwórz nowy endpoint
2. ❌ Backend powinien obsłużyć atomic operation (utwórz kolekcję + dodaj przepis)

---

#### 3. `src/app/pages/recipes/services/recipes.service.ts`

**Problem:** Operacje CRUD przepisów używają bezpośrednich zapytań.

**Złamane operacje:**
```typescript
// ❌ GET /recipes/{id}
this.supabase.from('recipe_details').select('*')

// ❌ POST /recipes (insert)
this.supabase.from('recipes').insert({ name, ingredients, steps, ... })

// ❌ POST - operacje na tagach
this.supabase.from('tags').select('id')
this.supabase.from('tags').insert({ name, user_id })
this.supabase.from('recipe_tags').insert({ recipe_id, tag_id })

// ❌ DELETE /recipes/{id}
this.supabase.from('recipe_tags').delete()
this.supabase.from('recipes').delete()

// ❌ PUT /recipes/{id}
this.supabase.from('recipes').update(updateData)
this.supabase.from('recipe_tags').delete()

// ✅ Storage - DOZWOLONE
this.supabase.storage.from('recipe-images').upload(...)
this.supabase.storage.from('recipe-images').getPublicUrl(...)
```

**Liczba bezpośrednich zapytań:** 11 (Storage OK - 2)

**Backend Endpoint:** Sprawdź `supabase/functions/recipes/`

**Uwaga:** Import przepisów używa już API (`POST /recipes/import`) ✅

**Akcja:**
1. ✅ Sprawdź które endpointy już istnieją w backendzie
2. ❌ Zamień metody na wywołania API:
   - `getRecipeById()` → `GET /recipes/{id}`
   - `createRecipe()` → `POST /recipes`
   - `updateRecipe()` → `PUT /recipes/{id}`
   - `deleteRecipe()` → `DELETE /recipes/{id}`

---

### 🟡 MEDIUM PRIORITY (Read-Only ale przez API)

#### 4. `src/app/core/services/categories.service.ts`

**Problem:** Pobieranie kategorii bezpośrednio z bazy.

**Złamane operacje:**
```typescript
// ❌ GET /categories
this.supabase.from('categories').select('id, name').order('name')
```

**Liczba bezpośrednich zapytań:** 1

**Backend Endpoint:** Sprawdź `supabase/functions/categories/`

**Uwaga:** Kategorie są read-only (słownik systemowy), ale nadal powinny przez API.

**Akcja:**
1. ✅ Sprawdź czy endpoint istnieje
2. ❌ Jeśli nie - utwórz prosty endpoint GET /categories
3. ❌ Zamień na `supabase.functions.invoke('categories')`

---

#### 5. `src/app/core/services/tags.service.ts`

**Problem:** Pobieranie tagów bezpośrednio z bazy.

**Złamane operacje:**
```typescript
// ❌ GET /tags
this.supabase.from('tags').select('id, name').eq('user_id', user.id)
```

**Liczba bezpośrednich zapytań:** 1

**Backend Endpoint:** Sprawdź `supabase/functions/tags/`

**Akcja:**
1. ✅ Sprawdź czy endpoint istnieje
2. ❌ Jeśli nie - utwórz GET /tags
3. ❌ Zamień na `supabase.functions.invoke('tags')`

---

#### 6. `src/app/pages/dashboard/services/recipes.service.ts`

**Problem:** Dashboard pobiera przepisy bezpośrednio.

**Złamane operacje:**
```typescript
// ❌ GET /recipes (z sortowaniem i paginacją)
this.supabase.from('recipes')
    .select('id, name, image_path, created_at', { count: 'exact' })
    .eq('user_id', user.id)
    .order(column, { ascending })
```

**Liczba bezpośrednich zapytań:** 1

**Backend Endpoint:** `GET /recipes` już istnieje! ✅

**Akcja:**
1. ❌ Zamień na wywołanie API (tak jak w `recipes-list`)
2. ❌ Użyj `GET /recipes?page=1&limit=10&sort=created_at.desc`

---

#### 7. `src/app/pages/dashboard/services/profile.service.ts`

**Problem:** Dashboard pobiera profil bezpośrednio.

**Złamane operacje:**
```typescript
// ❌ GET /profile
this.supabase.from('profiles').select('id, username').eq('id', user.id)
```

**Liczba bezpośrednich zapytań:** 1

**Backend Endpoint:** Sprawdź `supabase/functions/profile/`

**Akcja:**
1. ✅ Sprawdź czy endpoint istnieje (prawdopodobnie tak)
2. ❌ Zamień na `supabase.functions.invoke('profile')`

---

## ✅ Serwisy Poprawne

### 1. `src/app/core/services/search.service.ts` ✅

**Status:** POPRAWNY - używa API

```typescript
// ✅ Używa Edge Function
this.supabase.functions.invoke(`search/global?q=${encodedQuery}`, { method: 'GET' })
```

---

### 2. `src/app/pages/recipes/services/recipes.service.ts` ✅

**Status:** CZĘŚCIOWO POPRAWNY

```typescript
// ✅ getRecipes() - używa API
this.supabase.functions.invoke(`recipes?${queryParams}`, { method: 'GET' })

// ✅ importRecipe() - używa API
fetch(`${environment.supabase.url}/functions/v1/recipes/import`, {...})

// ❌ getRecipeById(), createRecipe(), updateRecipe(), deleteRecipe() 
// - nadal używają bezpośrednich zapytań
```

---

## 📊 Priorytetyzacja Refaktoryzacji

### Faza 1: High Priority (CRUD + Logika Biznesowa)

1. **CollectionsApiService** - 9 zapytań
   - Pełny CRUD kolekcji
   - Zarządzanie przepisami w kolekcjach
   - Używany w wielu miejscach

2. **RecipesService (recipes/services)** - 11 zapytań
   - Pełny CRUD przepisów
   - Operacje na tagach
   - Kluczowa funkcjonalność aplikacji

3. **CollectionsService (dialog)** - 5 zapytań
   - Dodawanie do kolekcji
   - Tworzenie nowych kolekcji
   - Używany w modal dialog

### Faza 2: Medium Priority (Read-Only)

4. **Dashboard RecipesService** - 1 zapytanie
   - Endpoint już istnieje
   - Szybka zmiana

5. **CategoriesService** - 1 zapytanie
   - Słownik systemowy
   - Może być cache'owane

6. **TagsService** - 1 zapytanie
   - Lista tagów użytkownika
   - Może być cache'owane

7. **ProfileService** - 1 zapytanie
   - Profil użytkownika
   - Używany w dashboard

---

## 🔧 Plan Działania

### Krok 1: Weryfikacja Endpointów Backend

Sprawdź które endpointy już istnieją:

```bash
# Lista istniejących funkcji
ls supabase/functions/

# Sprawdź co już jest zaimplementowane:
# - categories/
# - collections/
# - recipes/
# - tags/
# - profile/
# - search/ ✅
```

### Krok 2: Utworzenie Brakujących Endpointów

Dla każdego serwisu który nie ma endpointa:

1. Utwórz strukturę Edge Function
2. Zaimplementuj handlery i serwisy
3. Dodaj walidację Zod
4. Dodaj testy

### Krok 3: Refaktoryzacja Frontendu

Dla każdego serwisu:

**Przed:**
```typescript
private async fetchData() {
    const { data, error } = await this.supabase
        .from('table')
        .select('*')
        .eq('user_id', userId);
    // ...
}
```

**Po:**
```typescript
getData(): Observable<DataDto[]> {
    return from(
        this.supabase.functions.invoke<DataDto[]>('endpoint', {
            method: 'GET'
        })
    ).pipe(
        map(response => {
            if (response.error) throw new Error(response.error.message);
            return response.data ?? [];
        })
    );
}
```

### Krok 4: Testowanie

Dla każdego zrefaktoryzowanego serwisu:

1. ✅ Upewnij się że funkcjonalność działa identycznie
2. ✅ Sprawdź loading states
3. ✅ Sprawdź error handling
4. ✅ Sprawdź paginację (jeśli dotyczy)
5. ✅ Uruchom testy E2E

---

## 📝 Checklist dla Każdej Refaktoryzacji

### Backend
- [ ] Endpoint istnieje w `supabase/functions/`
- [ ] Struktura: index.ts, *.handlers.ts, *.service.ts
- [ ] Walidacja Zod dla wszystkich parametrów
- [ ] Logowanie operacji (logger.info/warn/error)
- [ ] Obsługa błędów przez ApplicationError
- [ ] Zwracane DTO nie raw types
- [ ] RLS policies działają poprawnie
- [ ] Testy lokalne przechodzą

### Frontend
- [ ] Zamieniono `supabase.from()` na `supabase.functions.invoke()`
- [ ] Usunięto metody prywatne z bezpośrednimi zapytaniami
- [ ] Query params budowane przez URLSearchParams (GET)
- [ ] Body formatowane jako JSON (POST/PUT)
- [ ] Obsługa błędów HTTP
- [ ] Loading states działają
- [ ] Komponent nie wymaga zmian (interfejs zachowany)
- [ ] Testy jednostkowe zaktualizowane

---

## 🎯 Oczekiwane Rezultaty

### Metryki Sukcesu

**Redukcja kodu:**
- Usunięcie ~500+ linii bezpośrednich zapytań SQL
- Zmniejszenie złożoności serwisów o ~40%

**Architektura:**
- 100% operacji na danych przez REST API
- Pełna separacja frontend/backend
- Logika biznesowa tylko w backendzie

**Bezpieczeństwo:**
- Centralna walidacja w backendzie
- Logowanie wszystkich operacji
- RLS jako backup nie główne zabezpieczenie

**Utrzymanie:**
- Łatwiejsze debugowanie (logi w backendzie)
- DRY - jedna implementacja logiki
- API reużywalne dla innych klientów

---

## 📚 Referencje

- [Backend Rules](.cursor/rules/backend.mdc)
- [Frontend Rules](.cursor/rules/fronend.mdc)
- [API Plan](../009%20API%20plan.md)
- [Recipes List Implementation](./recipes-list-implementation-summary.md)
- [Search Implementation](./search-global-implementation-summary.md)

---

## 🚨 Ostrzeżenia

### NIE Usuwaj Zanim Nie Zweryfikujesz:

1. **Storage operations** - pozostają w frontendzie (dozwolone)
2. **Auth operations** - pozostają w frontendzie (dozwolone)
3. **Interfejsy publiczne** - zachowaj kompatybilność wsteczną

### Komunikacja z Zespołem:

Przed rozpoczęciem refaktoryzacji:
1. Sprawdź czy ktoś już nad tym nie pracuje
2. Utwórz branch z opisową nazwą (np. `refactor/collections-api-service`)
3. Małe PR-y (jeden serwis = jeden PR)
4. Code review przed merge

---

## Status Tracked

**Utworzono:** 2024-12-XX
**Ostatnia aktualizacja:** 2024-12-XX
**Status:** 🔴 W trakcie audytu
**Postęp:** 2/9 serwisów poprawnych (22%)

