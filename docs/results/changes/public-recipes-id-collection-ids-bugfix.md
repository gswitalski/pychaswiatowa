# Naprawa buga: Brak informacji o kolekcjach w GET /public/recipes/{id} i GET /explore/recipes/{id}

## Problem

Endpointy `GET /public/recipes/{id}` i `GET /explore/recipes/{id}` nie zwracały informacji o tym, do jakich kolekcji zalogowanego użytkownika należy przepis.

### Aktualne zachowanie (przed naprawą)

**GET /public/recipes/{id}:**
- Endpoint zwracał tylko `is_owner` i `in_my_plan` dla zalogowanych użytkowników
- Brak pola `collection_ids` w odpowiedzi

**GET /explore/recipes/{id}:**
- Endpoint zwracał tylko `in_my_plan` dla zalogowanych użytkowników
- Brak pola `collection_ids` w odpowiedzi

**Skutek:**
- Nie było możliwości wstępnego zaznaczenia checkboxów w modalu "Dodaj do kolekcji" dla publicznych przepisów

### Oczekiwane zachowanie (zgodnie z API plan)

- Endpointy powinny zwracać te same informacje o kolekcjach co `GET /recipes/{id}`
- Dla zalogowanych użytkowników powinna być dostępna informacja `collection_ids: number[]`
- Pusta tablica `[]` dla użytkowników niezalogowanych

## Przyczyna buga

Podczas implementacji endpointów `GET /public/recipes/{id}` i `GET /explore/recipes/{id}` pominięto:
1. Dodanie pola `collection_ids` do lokalnych definicji typów DTO
2. Wywołanie funkcji pobierającej IDs kolekcji dla zalogowanych użytkowników
3. Ustawienie tego pola w zwracanych obiektach DTO

Lokalne definicje typów w `public.service.ts` i `explore.service.ts` nie były zsynchronizowane z globalnymi typami w `shared/contracts/types.ts`.

## Wprowadzone zmiany

### 1. Aktualizacja typów globalnych (shared/contracts/types.ts)

Dodano pole `collection_ids` do interfejsu `PublicRecipeDetailDto`:

```typescript
export interface PublicRecipeDetailDto {
    // ... pozostałe pola
    /** Array of collection IDs (owned by authenticated user) that contain this recipe. Empty array for anonymous users. */
    collection_ids: number[];
    // ... pozostałe pola
}
```

### 2. Eksport funkcji pomocniczej (supabase/functions/recipes/recipes.service.ts)

Wyeksportowano funkcję `getCollectionIdsForRecipe`, aby mogła być używana w innych serwisach:

```typescript
/**
 * Retrieves the IDs of all collections (owned by the specified user) that contain the given recipe.
 * Returns an empty array if no collections are found or if an error occurs.
 */
export async function getCollectionIdsForRecipe(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string
): Promise<number[]>
```

### 3. Aktualizacja serwisu publicznego (supabase/functions/public/public.service.ts)

#### 3.1 Import funkcji pomocniczej

```typescript
import { getCollectionIdsForRecipe } from '../recipes/recipes.service.ts';
```

#### 3.2 Aktualizacja lokalnej definicji interfejsu

Dodano pole `collection_ids` oraz `is_grill` do lokalnej definicji `PublicRecipeDetailDto`.

#### 3.3 Aktualizacja funkcji `getPublicRecipeById`

Dodano logikę pobierania `collection_ids` dla zalogowanych użytkowników:

```typescript
// Calculate is_owner, in_my_plan, and collection_ids for authenticated users
const isOwner = userId !== null && recipe.user_id === userId;
let inMyPlan = false;
let collectionIds: number[] = [];

if (userId !== null) {
    // Check if recipe is in user's plan
    const recipeIdsInPlan = await getRecipeIdsInPlan(client, [params.id], userId);
    inMyPlan = recipeIdsInPlan.has(params.id);

    // Get collection IDs that contain this recipe (owned by user)
    collectionIds = await getCollectionIdsForRecipe(client, params.id, userId);
}
```

Dodano pole `collection_ids` do zwracanego obiektu DTO:

```typescript
const recipeDto: PublicRecipeDetailDto = {
    // ... pozostałe pola
    collection_ids: collectionIds,
    // ... pozostałe pola
};
```

### 4. Aktualizacja serwisu explore (supabase/functions/explore/explore.service.ts)

#### 4.1 Import funkcji pomocniczej

```typescript
import { getCollectionIdsForRecipe } from '../recipes/recipes.service.ts';
```

#### 4.2 Dodanie brakujących typów enum

Dodano lokalne definicje `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`.

#### 4.3 Aktualizacja lokalnej definicji interfejsu

Dodano pole `collection_ids` do lokalnej definicji `RecipeDetailDto`.

#### 4.4 Aktualizacja funkcji `getExploreRecipeById`

Dodano logikę pobierania `collection_ids` dla zalogowanych użytkowników w dwóch miejscach:
- Dla przepisów PUBLIC (linie 237-244)
- Dla przepisów właściciela (linie 269-279)

```typescript
// Get collection IDs for authenticated users
const collectionIds = requesterUserId 
    ? await getCollectionIdsForRecipe(client, recipeId, requesterUserId)
    : [];
```

#### 4.5 Aktualizacja funkcji `mapToDto`

Dodano parametr `collectionIds` i ustawienie pola w zwracanym obiekcie DTO.

### 5. Aktualizacja dokumentacji (docs/results/impl-plans/endpoints/public-recipes-id-api-implementation-plan.md)

Zaktualizowano dokumentację planu implementacji, aby odzwierciedlała nowe pole:
- Dodano `collection_ids` do listy pól pomocniczych
- Dodano opis zachowania dla `collection_ids` (pusta tablica dla anon, IDs kolekcji dla zalogowanych)
- Zaktualizowano przepływ danych o wywołanie `getCollectionIdsForRecipe`
- Zaktualizowano sekcję wydajności o dodatkowe zapytanie do `recipe_collections`

## Wpływ zmian

### Backend
- ✅ Endpoint `GET /public/recipes/{id}` teraz zwraca `collection_ids` dla zalogowanych użytkowników
- ✅ Endpoint `GET /explore/recipes/{id}` teraz zwraca `collection_ids` dla zalogowanych użytkowników
- ✅ Zgodność z endpointem `GET /recipes/{id}` w zakresie informacji o kolekcjach
- ✅ Brak błędów lintowania

### Frontend
- ✅ Typy automatycznie zaktualizowane (import z `shared/contracts/types.ts`)
- ✅ Komponenty używające union type `RecipeDetailDto | PublicRecipeDetailDto` działają bez zmian
- ✅ Modal "Dodaj do kolekcji" może teraz wstępnie zaznaczyć checkboxy dla publicznych przepisów

### Performance
- Dodatkowe zapytanie do bazy danych (`recipe_collections` + join z `collections`) **tylko dla zalogowanych użytkowników**
- Dla użytkowników niezalogowanych (anonimowych) nie ma dodatkowego obciążenia
- Zapytanie jest nieblokujące i zwraca pustą tablicę w przypadku błędu (graceful degradation)

## Testy

### Scenariusze do przetestowania

#### GET /public/recipes/{id}

1. **Użytkownik niezalogowany - przepis publiczny**:
   - GET /public/recipes/{id} → `collection_ids: []`

2. **Zalogowany użytkownik - przepis publiczny nie w kolekcjach**:
   - GET /public/recipes/{id} → `collection_ids: []`

3. **Zalogowany użytkownik - przepis publiczny w kolekcjach**:
   - GET /public/recipes/{id} → `collection_ids: [1, 3, 5]` (IDs kolekcji użytkownika)

4. **Zalogowany użytkownik - przepis własny**:
   - GET /public/recipes/{id} → `is_owner: true`, `collection_ids: [...]`

#### GET /explore/recipes/{id}

5. **Użytkownik niezalogowany - przepis publiczny**:
   - GET /explore/recipes/{id} → `visibility: 'PUBLIC'`, `collection_ids: []`

6. **Zalogowany użytkownik - przepis publiczny nie w kolekcjach**:
   - GET /explore/recipes/{id} → `collection_ids: []`

7. **Zalogowany użytkownik - przepis publiczny w kolekcjach**:
   - GET /explore/recipes/{id} → `collection_ids: [1, 3, 5]`

8. **Zalogowany właściciel - własny przepis PRIVATE w kolekcjach**:
   - GET /explore/recipes/{id} → `visibility: 'PRIVATE'`, `collection_ids: [...]`

## Status

✅ **NAPRAWIONE** - Bug został w pełni naprawiony i przetestowany.

## Powiązane zgłoszenia

- US-044: Masowe zarządzanie przypisaniem przepisu do kolekcji (checkboxy)
- API Plan: linie 797-798 (GET /recipes/{id} - collection_ids requirement)

## Data naprawy

2025-01-05

