# PS-15 — API Implementation Plan: Recipe Author on Detail View

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11  
**Runda:** R1

---

## Przegląd

Plan implementacji API obejmuje trzy pliki:

| Plik | Rodzaj zmiany |
|---|---|
| `shared/contracts/types.ts` | Dodanie pola `author: ProfileDto` do `RecipeDetailDto` |
| `supabase/functions/explore/explore.service.ts` | Fix `tips` + nowe pole `author` |
| `supabase/functions/recipes/recipes.service.ts` | Nowe pole `author` |

Brak migracji SQL (NF3).

---

## 1. `shared/contracts/types.ts`

### 1.1 Lokalizacja zmiany

Typ `RecipeDetailDto` — linie ~280–336 (sekcja `// #region --- Recipes ---`).

### 1.2 Zmiana

Dodać pole `author: ProfileDto` jako **wymagane** (non-nullable) do intersection type:

```typescript
// PRZED (fragment):
export type RecipeDetailDto = Omit<
    RecipeDetail,
    | 'ingredients'
    | 'steps'
    | 'tips'
    | 'tags'
    | 'collections'
    | 'average_rating'
    | 'ratings_count'
> & {
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;
    tags: TagDto[];
    // ... reszta pól
};

// PO — dodać po polu `tips`:
export type RecipeDetailDto = Omit<
    RecipeDetail,
    | 'ingredients'
    | 'steps'
    | 'tips'
    | 'tags'
    | 'collections'
    | 'average_rating'
    | 'ratings_count'
> & {
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;
    tags: TagDto[];
    /** Autor przepisu (dane profilu). */
    author: ProfileDto;   // NOWE
    // ... reszta pól bez zmian
};
```

`ProfileDto` jest już zdefiniowany w tym pliku (linia ~548):
```typescript
export type ProfileDto = Pick<Profile, 'id' | 'username'>;
```

### 1.3 Skutki uboczne

Po tej zmianie TypeScript wymusi uzupełnienie pola `author` we wszystkich miejscach tworzących
obiekt `RecipeDetailDto`. Dotyczy to:
- `supabase/functions/explore/explore.service.ts` — `mapToDto`
- `supabase/functions/recipes/recipes.service.ts` — `mapToRecipeDetailDto`

Build CI poinformuje o wszelkich brakujących wypełnieniach (AC8).

---

## 2. `supabase/functions/explore/explore.service.ts`

### 2.1 Krok 1 — `RECIPE_DETAIL_SELECT_COLUMNS` (fix buga tips)

```typescript
// PRZED (linia ~149):
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, name, description, image_path, visibility, category_id, category_name, ' +
    'ingredients, steps, tags, servings, prep_time_minutes, total_time_minutes, is_termorobot, diet_type, cuisine, difficulty, is_grill, created_at, updated_at, deleted_at, ratings_count, average_rating';

// PO — dodać `tips` po `steps`:
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, name, description, image_path, visibility, category_id, category_name, ' +
    'ingredients, steps, tips, tags, servings, prep_time_minutes, total_time_minutes, is_termorobot, diet_type, cuisine, difficulty, is_grill, created_at, updated_at, deleted_at, ratings_count, average_rating';
```

### 2.2 Krok 2 — interfejs `RecipeDetailFullRow`

```typescript
// PRZED (linia ~122):
interface RecipeDetailFullRow {
    id: number;
    user_id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: string;
    category_id: number | null;
    category_name: string | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: Array<{ id: number; name: string }> | null;
    servings: number | null;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    average_rating: number | null;
    ratings_count: number | null;
}

// PO — dodać `tips` po `steps`:
interface RecipeDetailFullRow {
    id: number;
    user_id: string;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: string;
    category_id: number | null;
    category_name: string | null;
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;           // NOWE
    tags: Array<{ id: number; name: string }> | null;
    servings: number | null;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    average_rating: number | null;
    ratings_count: number | null;
}
```

### 2.3 Krok 3 — lokalny interfejs `RecipeDetailDto`

```typescript
// PRZED (linia ~86):
export interface RecipeDetailDto {
    id: number;
    user_id: string;
    category_id: number | null;
    category_name: string | null;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE';
    ingredients: RecipeContent;
    steps: RecipeContent;          // brak tips
    tags: TagDto[];
    // ...
}

// PO — dodać tips i author:
export interface RecipeDetailDto {
    id: number;
    user_id: string;
    category_id: number | null;
    category_name: string | null;
    name: string;
    description: string | null;
    image_path: string | null;
    visibility: 'PUBLIC' | 'SHARED' | 'PRIVATE';
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;           // NOWE (fix buga)
    tags: TagDto[];
    // ... reszta istniejących pól bez zmian
    /** Autor przepisu */
    author: { id: string; username: string };  // NOWE
    // ... pola opcjonalne (is_favorite, is_want_to_try, my_rating, my_note)
}
```

### 2.4 Krok 4 — helper `fetchAuthorProfile`

Dodać **przed** funkcją `getExploreRecipeById`, jako prywatny helper:

```typescript
/**
 * Fetches author profile data from the profiles table.
 * Uses service-role client (passed as parameter from explore context).
 * Falls back to { id: userId, username: userId } if profile not found (defensive approach).
 *
 * @param client - Service-role Supabase client
 * @param userId - Author's user ID
 * @returns Author profile or fallback with user_id as username
 */
async function fetchAuthorProfile(
    client: TypedSupabaseClient,
    userId: string
): Promise<{ id: string; username: string }> {
    try {
        const { data, error } = await client
            .from('profiles')
            .select('id, username')
            .eq('id', userId)
            .single();

        if (error || !data) {
            logger.warn('Author profile not found, using fallback', {
                userId,
                errorCode: error?.code,
            });
            return { id: userId, username: userId };
        }

        return { id: data.id, username: data.username };
    } catch (err) {
        logger.warn('Unexpected error fetching author profile, using fallback', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        return { id: userId, username: userId };
    }
}
```

> **Uwaga:** W `explore.service.ts` klient jest już `createServiceRoleClient()`,
> więc przekazujemy istniejący `client` — brak potrzeby tworzenia nowego klienta.

### 2.5 Krok 5 — rozszerzyć `Promise.all` w obu gałęziach `getExploreRecipeById`

#### Gałąź PUBLIC (linia ~294):

```typescript
// PRZED:
const [recipeIdsInPlan, flagsMap, ratingsMap, myNote] = await Promise.all([
    getRecipeIdsInPlan(client, [recipeId], requesterUserId),
    getRecipeFlagsMap(client, [recipeId], requesterUserId),
    getMyRatingsMap(client, [recipeId], requesterUserId),
    getMyRecipeNote(client, recipeId, requesterUserId),
]);

// PO:
const [recipeIdsInPlan, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [recipeId], requesterUserId),
    getRecipeFlagsMap(client, [recipeId], requesterUserId),
    getMyRatingsMap(client, [recipeId], requesterUserId),
    getMyRecipeNote(client, recipeId, requesterUserId),
    fetchAuthorProfile(client, recipe.user_id),  // NOWE
]);
```

Analogicznie zaktualizować wywołanie `mapToDto` — dodać `author` jako ostatni argument.

#### Gałąź PRIVATE/SHARED właściciel (linia ~348):

```typescript
// PRZED:
const [recipeIdsInPlan, flagsMap, ratingsMap, myNote] = await Promise.all([
    getRecipeIdsInPlan(client, [recipeId], requesterUserId),
    getRecipeFlagsMap(client, [recipeId], requesterUserId),
    getMyRatingsMap(client, [recipeId], requesterUserId),
    getMyRecipeNote(client, recipeId, requesterUserId),
]);

// PO:
const [recipeIdsInPlan, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [recipeId], requesterUserId),
    getRecipeFlagsMap(client, [recipeId], requesterUserId),
    getMyRatingsMap(client, [recipeId], requesterUserId),
    getMyRecipeNote(client, recipeId, requesterUserId),
    fetchAuthorProfile(client, recipe.user_id),  // NOWE
]);
```

### 2.6 Krok 6 — zaktualizować `mapToDto`

```typescript
// PRZED sygnatura (linia ~381):
function mapToDto(
    recipe: RecipeDetailFullRow,
    inMyPlan: boolean,
    collectionIds: number[],
    flags?: { is_favorite: boolean; is_want_to_try: boolean },
    myRating?: number,
    isAuthenticated = false,
    myNote?: string | null
): RecipeDetailDto {

// PO — dodać parametr author:
function mapToDto(
    recipe: RecipeDetailFullRow,
    inMyPlan: boolean,
    collectionIds: number[],
    author: { id: string; username: string },  // NOWE — przed opcjonalnymi
    flags?: { is_favorite: boolean; is_want_to_try: boolean },
    myRating?: number,
    isAuthenticated = false,
    myNote?: string | null
): RecipeDetailDto {
```

> **Uwaga:** Dodanie `author` przed opcjonalnymi parametrami wymaga aktualizacji wszystkich
> wywołań `mapToDto` (dwie gałęzie w `getExploreRecipeById`).

W ciele funkcji `mapToDto` dodać:
```typescript
// Po mapowaniu steps:
tips: recipe.tips ?? [],    // NOWE (fix buga)
// ...
author: author,             // NOWE
```

---

## 3. `supabase/functions/recipes/recipes.service.ts`

### 3.1 Krok 1 — lokalny interfejs `RecipeDetailDto`

```typescript
// Obecny RecipeDetailDto (linia ~177) — brak pola author
// Dodać po polu my_note (linia ~211):
export interface RecipeDetailDto {
    // ... istniejące pola bez zmian
    my_note?: string | null;
    /** Autor przepisu */
    author: { id: string; username: string };  // NOWE — wymagane
}
```

### 3.2 Krok 2 — helper `fetchAuthorProfile`

Dodać **przed** `getRecipeById` (linia ~880), po `getCollectionIdsForRecipe`:

```typescript
/**
 * Fetches author profile data using service-role client.
 * Required because: in the PUBLIC recipe path, the author may be a different user,
 * and the authenticated client may not have access to their profile via RLS.
 * Falls back to { id: userId, username: userId } if profile not found (defensive approach).
 *
 * @param userId - Author's user ID
 * @returns Author profile or fallback with user_id as username
 */
async function fetchAuthorProfile(
    userId: string
): Promise<{ id: string; username: string }> {
    const { createServiceRoleClient } = await import('../_shared/supabase-client.ts');
    const serviceClient = createServiceRoleClient();

    try {
        const { data, error } = await serviceClient
            .from('profiles')
            .select('id, username')
            .eq('id', userId)
            .single();

        if (error || !data) {
            logger.warn('Author profile not found, using fallback', {
                userId,
                errorCode: error?.code,
            });
            return { id: userId, username: userId };
        }

        return { id: data.id, username: data.username };
    } catch (err) {
        logger.warn('Unexpected error fetching author profile, using fallback', {
            userId,
            error: err instanceof Error ? err.message : 'Unknown error',
        });
        return { id: userId, username: userId };
    }
}
```

> **Uwaga:** `createServiceRoleClient` jest importowany dynamicznie (wzorzec istniejący
> w kodzie — patrz linia ~950 w oryginalnym pliku). Jeśli dostępny jest import statyczny
> (zależnie od struktury projektu), można użyć statycznego importu na początku pliku.

### 3.3 Krok 3 — rozszerzyć `Promise.all` w `getRecipeById`

#### Ścieżka happy-path (linia ~926):

```typescript
// PRZED:
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
]);

// PO:
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
    fetchAuthorProfile(data.user_id),  // NOWE
]);
```

Zaktualizować wywołanie `mapToRecipeDetailDto` — dodać `author`.

#### Ścieżka Step B / PUBLIC (linia ~1022):

```typescript
// PRZED:
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
]);

// PO:
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
    fetchAuthorProfile(publicRecipe.user_id),  // NOWE
]);
```

### 3.4 Krok 4 — zaktualizować `mapToRecipeDetailDto`

```typescript
// PRZED sygnatura (linia ~1053):
function mapToRecipeDetailDto(
    data: any,
    inMyPlan: boolean,
    collectionIds: number[],
    flags?: RecipeFlagsState,
    myRating?: number,
    myNote?: string | null
): RecipeDetailDto {

// PO — dodać author przed opcjonalnymi:
function mapToRecipeDetailDto(
    data: any,
    inMyPlan: boolean,
    collectionIds: number[],
    author: { id: string; username: string },  // NOWE
    flags?: RecipeFlagsState,
    myRating?: number,
    myNote?: string | null
): RecipeDetailDto {
```

W ciele funkcji dodać mapowanie:
```typescript
// Po istniejących polach (np. po my_note):
author: author,  // NOWE
```

---

## 4. Testy Deno

### 4.1 Nowy plik: `supabase/functions/explore/explore.service.test.ts`

Pokrycie scenariuszy GWT z historyjki:

#### Struktura mockowania

```typescript
// Wzorzec mock klienta Supabase (TypedSupabaseClient)
function createExploreServiceClient(params: {
    recipeData?: Partial<RecipeDetailFullRow> | null;
    recipeError?: { code: string; message: string } | null;
    profileData?: { id: string; username: string } | null;
    profileError?: { code: string; message: string } | null;
    planIds?: number[];
    // inne opcjonalne
}): TypedSupabaseClient
```

#### Przypadki testowe

| Test | Scenariusz GWT | AC |
|---|---|---|
| `getExploreRecipeById: PUBLIC przepis zwraca author.username` | G1 | AC1 |
| `getExploreRecipeById: PUBLIC przepis zwraca pole tips` | G1 | AC2 |
| `getExploreRecipeById: PRIVATE przepis właściciela zwraca author` | G2 | AC1 |
| `getExploreRecipeById: brak profilu — fallback username=user_id` | G3 | AC1, NF1 |
| `getExploreRecipeById: błąd zapytania profilu — fallback, brak 500` | NF1 | NF1 |

#### Szablon testu (G1 — PUBLIC + author + tips):

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { getExploreRecipeById } from './explore.service.ts';

Deno.test('getExploreRecipeById: PUBLIC przepis zwraca author.username i tips', async () => {
    // Mock klienta i wywołanie getExploreRecipeById
    // Asercje: result.author.username === 'jan.kowalski'
    //          result.tips.length > 0
});
```

### 4.2 Istniejący plik: `supabase/functions/recipes/recipes.service.test.ts`

Dodać przypadek testowy dla G4:

```typescript
Deno.test('getRecipeById: zwraca author.username właściciela', async () => {
    // Mock klienta zwracającego przepis z user_id='user-abc'
    // Mock profiles zwracającego username='jan.kowalski'
    // Asercja: result.author.username === 'jan.kowalski'
    //          result.author.id === 'user-abc'
});
```

---

## 5. Macierz spójności historyjka ↔ API

| Wymaganie | AC | Plik | Metoda/Pole | Status |
|---|---|---|---|---|
| F1: `author` w shared RecipeDetailDto | AC8 | `shared/contracts/types.ts` | `RecipeDetailDto.author` | ✅ zaplanowane |
| F2.1: `tips` w SELECT | AC2 | `explore.service.ts` | `RECIPE_DETAIL_SELECT_COLUMNS` | ✅ zaplanowane |
| F2.2: `tips` w RecipeDetailFullRow | AC2 | `explore.service.ts` | interfejs `RecipeDetailFullRow` | ✅ zaplanowane |
| F2.3: `tips` w lokalnym RecipeDetailDto | AC2 | `explore.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F2.4: `author` w lokalnym RecipeDetailDto | AC1 | `explore.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F2.5: `fetchAuthorProfile` helper | AC1, NF1 | `explore.service.ts` | funkcja `fetchAuthorProfile` | ✅ zaplanowane |
| F2.6: Promise.all PUBLIC gałąź | NF2, AC1 | `explore.service.ts` | `getExploreRecipeById` | ✅ zaplanowane |
| F2.6: Promise.all PRIVATE gałąź | NF2, AC1 | `explore.service.ts` | `getExploreRecipeById` | ✅ zaplanowane |
| F2.7: mapToDto signature | AC1 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F2.8: mapToDto tips mapping | AC2 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F2.9: mapToDto author mapping | AC1 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F3.1: `author` w lokalnym RecipeDetailDto | AC3 | `recipes.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F3.2: `fetchAuthorProfile` (service-role) | AC3, NF1 | `recipes.service.ts` | funkcja `fetchAuthorProfile` | ✅ zaplanowane |
| F3.3: Promise.all happy-path | NF2, AC3 | `recipes.service.ts` | `getRecipeById` | ✅ zaplanowane |
| F3.4: Promise.all Step B/PUBLIC | NF2, AC3 | `recipes.service.ts` | `getRecipeById` | ✅ zaplanowane |
| F3.5: mapToRecipeDetailDto signature | AC3 | `recipes.service.ts` | `mapToRecipeDetailDto` | ✅ zaplanowane |
| F3.6: mapToRecipeDetailDto author mapping | AC3 | `recipes.service.ts` | `mapToRecipeDetailDto` | ✅ zaplanowane |
| NF3: brak migracji SQL | — | — | — | ✅ potwierdzone |
