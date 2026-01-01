# Zmiany implementacyjne: Pola czasu w przepisach (prep_time_minutes, total_time_minutes)

**Data**: 2026-01-01  
**Typ**: Rozszerzenie funkcjonalności (Feature Enhancement)  
**Status**: Implementacja zakończona - oczekuje na testy

## Podsumowanie

Dodano obsługę pól czasowych (`prep_time_minutes`, `total_time_minutes`) dla przepisów w całym stosie aplikacji (baza danych, backend API, kontrakty frontend-backend).

## Zakres zmian

### 1. Baza danych (PostgreSQL)

#### Nowe migracje SQL

1. **`20260101120000_add_time_fields_to_recipes.sql`**
   - Dodano kolumny `prep_time_minutes` i `total_time_minutes` do tabeli `recipes`
   - Typ: `smallint` (zakres -32768 do 32767, wystarczający dla 0-999)
   - Nullable: TAK (pola opcjonalne)
   - Constraints:
     - Zakres: 0-999 dla obu pól
     - Cross-field: `total_time_minutes >= prep_time_minutes` (gdy oba ustawione)
   - Zaktualizowano widok `recipe_details` o nowe kolumny

2. **`20260101120100_update_create_recipe_with_tags_for_times.sql`**
   - Dodano parametry `p_prep_time_minutes` i `p_total_time_minutes` do funkcji `create_recipe_with_tags`
   - Dodano walidację zakresu i cross-field constraint w funkcji
   - Zaktualizowano INSERT statement

3. **`20260101120200_update_update_recipe_with_tags_for_times.sql`**
   - Dodano parametry czasu i flagi update do funkcji `update_recipe_with_tags`
   - Dodano logikę walidacji przed UPDATE
   - Dodano warunkową aktualizację pól czasu

4. **`20260101120300_update_get_recipes_list_for_times.sql`**
   - Rozszerzono funkcję `get_recipes_list` o zwracanie pól czasu
   - Zaktualizowano `RETURNS TABLE` i SELECT statements

### 2. Kontrakty FE/Shared (`shared/contracts/types.ts`)

Dodano pola `prep_time_minutes: number | null` i `total_time_minutes: number | null` do:

- `RecipeListItemDto` - lista przepisów (prywatne)
- `RecipeDetailDto` - szczegóły przepisu (prywatne)
- `PublicRecipeListItemDto` - lista przepisów (publiczne)
- `PublicRecipeDetailDto` - szczegóły przepisu (publiczne)
- `CreateRecipeCommand` - komenda tworzenia przepisu
- `UpdateRecipeCommand` - komenda aktualizacji przepisu (dziedziczy z CreateRecipeCommand)

### 3. Backend - Recipes (`supabase/functions/recipes/`)

#### `recipes.handlers.ts`

- **Walidacja Zod - `createRecipeSchema`**:
  - Dodano walidację `prep_time_minutes`: integer, 0-999, nullable/optional
  - Dodano walidację `total_time_minutes`: integer, 0-999, nullable/optional
  - Dodano cross-field validation (`.refine`): `total >= prep` gdy oba ustawione
  - Komunikat błędu: "Total time must be greater than or equal to preparation time"

- **Walidacja Zod - `updateRecipeSchema`**:
  - Analogiczne walidacje jak dla `createRecipeSchema`
  - Uwzględnia że pola mogą być `undefined` (partial update)

- **Handlery**:
  - `handleCreateRecipe`: przekazuje pola czasu do serwisu
  - `handleUpdateRecipe`: przekazuje pola czasu do serwisu

#### `recipes.service.ts`

- **Interfejsy**:
  - `RecipeListItemDto`: dodano pola czasu
  - `RecipeDetailDto`: dodano pola czasu
  - `CreateRecipeInput`: dodano pola czasu
  - `UpdateRecipeInput`: dodano pola czasu

- **Stałe SELECT**:
  - `RECIPE_LIST_SELECT_COLUMNS`: dodano `prep_time_minutes, total_time_minutes`
  - `RECIPE_DETAIL_SELECT_COLUMNS`: dodano `prep_time_minutes, total_time_minutes`

- **Funkcje**:
  - `getRecipes`: mapowanie DTO zawiera pola czasu
  - `getRecipesFeed`: mapowanie DTO zawiera pola czasu
  - `createRecipe`: 
    - Przekazuje parametry czasu do RPC `create_recipe_with_tags`
    - Logowanie zawiera wartości pól czasu
  - `updateRecipe`: 
    - Przekazuje parametry czasu i flagi update do RPC `update_recipe_with_tags`
    - Logowanie zawiera info o aktualizacji pól czasu
  - `mapToRecipeDetailDto`: mapowanie zawiera pola czasu

### 4. Backend - Public (`supabase/functions/public/`)

#### `public.service.ts`

- **Interfejsy**:
  - `PublicRecipeListItemDto`: dodano pola czasu
  - `PublicRecipeDetailDto`: dodano pola czasu
  - `RecipeDetailsRow`: dodano pola czasu
  - `RecipeDetailFullRow`: dodano pola czasu

- **Stałe SELECT**:
  - `RECIPE_SELECT_COLUMNS`: dodano `prep_time_minutes, total_time_minutes`
  - `RECIPE_DETAIL_SELECT_COLUMNS`: dodano `prep_time_minutes, total_time_minutes`

- **Funkcje**:
  - `getPublicRecipes`: mapowanie DTO zawiera pola czasu
  - `getPublicRecipeById`: mapowanie DTO zawiera pola czasu
  - `getPublicRecipesFeed`: mapowanie DTO zawiera pola czasu

## Kontrakt API

### Pola wejściowe (Request)

**`POST /recipes` i `PUT /recipes/{id}`**:

```json
{
  "prep_time_minutes": 15,       // opcjonalne, integer, 0-999 lub null
  "total_time_minutes": 45       // opcjonalne, integer, 0-999 lub null
}
```

**Walidacja**:
- Typ: integer
- Zakres: 0-999
- Nullable: TAK
- Cross-field: jeśli oba ustawione → `total_time_minutes >= prep_time_minutes`

### Pola wyjściowe (Response)

**Wszystkie endpointy zwracające przepisy** (`GET /recipes`, `GET /recipes/{id}`, `GET /recipes/feed`, `GET /public/recipes`, etc.):

```json
{
  "id": 123,
  "name": "Spaghetti Carbonara",
  "prep_time_minutes": 15,       // number | null
  "total_time_minutes": 45,      // number | null
  ...
}
```

### Kody błędów

**`400 Bad Request`** - walidacja nie przeszła:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Invalid input: prep_time_minutes: Preparation time must be at least 0"
}
```

Przykłady błędów walidacji:
- `"Preparation time must be between 0 and 999 minutes or null"`
- `"Total time must be between 0 and 999 minutes or null"`
- `"Total time must be greater than or equal to preparation time"`
- `"Preparation time must be an integer"`

## Przypadki testowe (rekomendowane)

### `POST /recipes`

1. ✅ Oba pola `null`/brak → 201
2. ✅ Tylko `prep_time_minutes` ustawione → 201
3. ✅ Tylko `total_time_minutes` ustawione → 201
4. ✅ Oba ustawione i `total >= prep` → 201
5. ❌ Oba ustawione i `total < prep` → 400
6. ❌ Wartości poza zakresem: `-1`, `1000` → 400
7. ❌ Wartości nie-integer: `1.5`, `"10"` → 400

### `PUT /recipes/{id}`

1. ✅ Ustawienie pól czasu (z `null` na wartość) → 200
2. ✅ Zmiana wartości pól czasu → 200
3. ✅ Czyszczenie pól czasu (na `null`) → 200
4. ❌ Próba `total < prep` → 400

### `GET` (listy i szczegóły)

1. ✅ Pola czasowe obecne w odpowiedzi
2. ✅ Wartości zgodne z DB (lub `null` jeśli brak)

## Wpływ na istniejący kod

### Zgodność wstecz

✅ **Pełna zgodność wstecz**:
- Pola są opcjonalne (`nullable`)
- Istniejące przepisy bez pól czasu nadal działają (wartości `null`)
- Stare wersje frontendu mogą ignorować nowe pola

### Wymagane aktualizacje frontendu

Aby w pełni wykorzystać nowe pola, frontend powinien:

1. Dodać pola czasu do formularzy (tworzenie/edycja przepisu)
2. Wyświetlać pola czasu w widokach list i szczegółów
3. Implementować walidację po stronie klienta (opcjonalnie, dla UX)

## Checklisty

### ✅ Implementacja zakończona

- [x] Migracje SQL (4 pliki)
- [x] Aktualizacja widoku `recipe_details`
- [x] Aktualizacja RPC `create_recipe_with_tags`
- [x] Aktualizacja RPC `update_recipe_with_tags`
- [x] Aktualizacja RPC `get_recipes_list`
- [x] Kontrakty FE/Shared (types.ts)
- [x] Walidacja Zod w handlers
- [x] Typy i mapowanie w recipes.service.ts
- [x] Typy i mapowanie w public.service.ts

### ⏳ Do wykonania (poza zakresem tej implementacji)

- [ ] Uruchomienie migracji na lokalnej bazie danych
- [ ] Testy manualne / smoke tests
- [ ] Regeneracja typów TypeScript z bazy (`supabase gen types typescript`)
- [ ] Aktualizacja frontendu (formularze, widoki)
- [ ] Testy jednostkowe (jeśli wymagane)
- [ ] Testy integracyjne (jeśli wymagane)
- [ ] Wdrożenie na staging
- [ ] Wdrożenie na production

## Notatki implementacyjne

### Decyzje projektowe

1. **Zakres 0-999 minut**:
   - Max ~16.5 godziny - wystarczające dla większości przepisów
   - Jeśli konieczny większy zakres → rozważyć zmianę typu na `integer`

2. **Cross-field validation**:
   - Implementowana zarówno w bazie danych (constraint) jak i w backendzie (Zod)
   - Baza danych jest ostatecznym źródłem prawdy

3. **Nullable vs Optional**:
   - Pola są nullable w bazie danych (SQL `NULL`)
   - W TypeScript: `number | null` (nie `number | undefined`)
   - W Zod: `.nullable().optional()` dla flexible input

### Potencjalne rozszerzenia

1. **Dodatkowe pola czasu**:
   - `cook_time_minutes` (czas gotowania)
   - `rest_time_minutes` (czas odpoczynku ciasta/mięsa)

2. **Jednostki czasu**:
   - Obecnie tylko minuty
   - Możliwe dodanie obsługi godzin w interfejsie (konwersja na minuty)

3. **Filtrowanie po czasie**:
   - Dodanie parametrów `filter[max_total_time]`, `filter[max_prep_time]`
   - Wymaga aktualizacji `get_recipes_list` RPC

## Autorzy

- AI Assistant (Implementacja backendu zgodnie z planem)
- Plan wdrożenia: `docs/results/impl-plans/endpoints/recipes-times-api-implementation-plan.md`

## Powiązane dokumenty

- Plan implementacji: `docs/results/impl-plans/endpoints/recipes-times-api-implementation-plan.md`
- Kontrakt API: `docs/results/main-project-docs/012 REST API Plan.md` (wymaga aktualizacji)
- DB Plan: `docs/results/main-project-docs/008 DB Plan.md` (wymaga aktualizacji)

