# PS-15 — API Endpoints Implementation Plan: Recipe Author on Detail View

> **Historyjka:** `docs/results/new-features/user-stories/PS-15/PS-15-recipe-author-on-detail-view-user-story.md`
> **Plan API (funkcjonalny):** `docs/results/new-features/user-stories/PS-15/PS-15-recipe-author-on-detail-view-api-plan.md`
> **Runda pytań:** R1 (zakończona)
> **Odpowiedź API-1:** Opcja A — `fetchAuthorProfile(client, userId)` w `recipes.service.ts`
> **Data:** 2026-11-11

---

## Przegląd

Plan obejmuje zmiany w trzech plikach (brak nowych migracji SQL — NF3):

| Plik | Rodzaj zmiany |
|---|---|
| `shared/contracts/types.ts` | Dodanie `author: ProfileDto` do `RecipeDetailDto` |
| `supabase/functions/explore/explore.service.ts` | Fix `tips` + nowe pole `author` + helper `fetchAuthorProfile(client, userId)` |
| `supabase/functions/recipes/recipes.service.ts` | Nowe pole `author` + helper `fetchAuthorProfile(client, userId)` (Opcja A) |

> **Decyzja architektoniczna (API-1):** W `recipes.service.ts` helper `fetchAuthorProfile` przyjmuje
> `client: TypedSupabaseClient` jako parametr (Opcja A), spójnie z wzorcem w `explore.service.ts`.
> W ścieżce happy-path (Step A) przekazywany jest `client` (authenticated); w ścieżce PUBLIC (Step B)
> — `serviceClient` (service-role). Fallback zapewnia NF1 nawet gdy RLS ogranicza dostęp do profilu.

---

## 1. `shared/contracts/types.ts`

### 1.1 Lokalizacja zmiany

Typ `RecipeDetailDto` — sekcja `// #region --- Recipes ---`, linie ~280–336.

### 1.2 Zmiana

Dodać wymagane pole `author: ProfileDto` do części intersection type:

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

Po dodaniu wymaganego pola TypeScript wymusi jego uzupełnienie w każdym miejscu
zwracającym `RecipeDetailDto`. Dotyczy to:

- `supabase/functions/explore/explore.service.ts` — `mapToDto`
- `supabase/functions/recipes/recipes.service.ts` — `mapToRecipeDetailDto`

Build CI wykryje wszystkie brakujące wypełnienia (AC8).

---

## 2. `supabase/functions/explore/explore.service.ts`

### 2.1 Krok 1 — `RECIPE_DETAIL_SELECT_COLUMNS` (fix buga `tips`)

```typescript
// PRZED (linia ~149):
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, name, description, image_path, visibility, category_id, category_name, ' +
    'ingredients, steps, tags, servings, prep_time_minutes, total_time_minutes, ' +
    'is_termorobot, diet_type, cuisine, difficulty, is_grill, ' +
    'created_at, updated_at, deleted_at, ratings_count, average_rating';

// PO — dodać `tips` po `steps`:
const RECIPE_DETAIL_SELECT_COLUMNS =
    'id, user_id, name, description, image_path, visibility, category_id, category_name, ' +
    'ingredients, steps, tips, tags, servings, prep_time_minutes, total_time_minutes, ' +
    'is_termorobot, diet_type, cuisine, difficulty, is_grill, ' +
    'created_at, updated_at, deleted_at, ratings_count, average_rating';
```

### 2.2 Krok 2 — interfejs `RecipeDetailFullRow`

```typescript
// PRZED (linia ~122) — brak pola tips:
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

### 2.3 Krok 3 — lokalny interfejs `RecipeDetailDto` (explore)

```typescript
// PRZED (linia ~86) — brak tips i author:
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
    steps: RecipeContent;     // brak tips
    tags: TagDto[];
    // ... reszta istniejących pól
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
    tips: RecipeContent;                          // NOWE (fix buga)
    tags: TagDto[];
    // ... reszta istniejących pól bez zmian
    /** Autor przepisu */
    author: { id: string; username: string };     // NOWE
    // ... pola opcjonalne (is_favorite, is_want_to_try, my_rating, my_note)
}
```

> **Uwaga:** Typ `{ id: string; username: string }` definiujemy lokalnie — nie importujemy
> `ProfileDto` z `shared/contracts/types.ts`, bo ten plik zależy od
> `shared/types/database.types`, który jest poza zasięgiem Deno edge functions.

### 2.4 Krok 4 — helper `fetchAuthorProfile`

Dodać **przed** `getExploreRecipeById` jako prywatny helper:

```typescript
/**
 * Fetches author profile data from the profiles table.
 * Client is passed as parameter (explore context already uses service-role client,
 * so no new client creation is needed).
 * Falls back to { id: userId, username: userId } if profile not found (NF1).
 *
 * @param client - TypedSupabaseClient (service-role in explore context)
 * @param userId - Author's user ID
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

> **Uwaga:** `explore.service.ts` tworzy klient przez `createServiceRoleClient()` na początku
> funkcji `getExploreRecipeById`. Istniejący `client` przekazujemy do helpera — brak potrzeby
> tworzenia nowego klienta.

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

#### Gałąź PRIVATE/SHARED — właściciel (linia ~348):

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

W obu gałęziach zaktualizować wywołanie `mapToDto` — dodać `author` jako argument.

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

// PO — dodać parametr author przed opcjonalnymi:
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

W ciele `mapToDto` dodać:

```typescript
// Po mapowaniu steps:
tips: recipe.tips ?? [],    // NOWE (fix buga)
// ...
author: author,             // NOWE
```

---

## 3. `supabase/functions/recipes/recipes.service.ts`

### 3.1 Krok 1 — lokalny interfejs `RecipeDetailDto` (recipes)

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

### 3.2 Krok 2 — helper `fetchAuthorProfile` (Opcja A)

> **Decyzja API-1 — Opcja A:** Helper przyjmuje `client: TypedSupabaseClient` jako parametr,
> identycznie jak w `explore.service.ts`. Brak dynamicznego importu i tworzenia własnego
> service-role klienta wewnątrz helpera.
>
> **Przekazywany klient:**
> - Ścieżka Step A (happy-path, linia ~926): `client` (authenticated) — RLS ogranicza dostęp,
>   ale fallback NF1 obsługuje brak profilu bez rzucania błędu HTTP 500.
> - Ścieżka Step B / PUBLIC (linia ~1022): `serviceClient` (service-role) — pomija RLS,
>   gwarantuje dostęp do profilu innego użytkownika.

Dodać **przed** `getRecipeById` (linia ~880), po `getCollectionIdsForRecipe`:

```typescript
/**
 * Fetches author profile data from the profiles table.
 * Client is passed as parameter (Opcja A — consistent with explore.service.ts pattern).
 *
 * In Step A: authenticated client is passed (RLS may restrict access to other users'
 * profiles, but fallback handles it — NF1).
 * In Step B (PUBLIC): serviceClient (service-role) is passed — bypasses RLS.
 *
 * Falls back to { id: userId, username: userId } if profile not found (NF1).
 *
 * @param client - TypedSupabaseClient (authenticated or service-role depending on call site)
 * @param userId - Author's user ID
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

### 3.3 Krok 3 — rozszerzyć `Promise.all` w `getRecipeById`

#### Ścieżka Step A — happy-path (linia ~926):

```typescript
// PRZED:
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
]);

// PO — przekazujemy `client` (authenticated):
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
    fetchAuthorProfile(client, data.user_id),  // NOWE — klient authenticated
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

// PO — przekazujemy `serviceClient` (service-role, już istnieje w tej gałęzi):
const [recipeIdsInPlan, collectionIds, flagsMap, ratingsMap, myNote, author] = await Promise.all([
    getRecipeIdsInPlan(client, [id], requesterUserId),
    getCollectionIdsForRecipe(client, id, requesterUserId),
    getRecipeFlagsMap(client, [id], requesterUserId),
    getMyRatingsMap(client, [id], requesterUserId),
    getMyRecipeNote(client, id, requesterUserId),
    fetchAuthorProfile(serviceClient, publicRecipe.user_id),  // NOWE — klient service-role
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
    author: { id: string; username: string },  // NOWE — przed opcjonalnymi
    flags?: RecipeFlagsState,
    myRating?: number,
    myNote?: string | null
): RecipeDetailDto {
```

> **Uwaga:** Dodanie `author` przed opcjonalnymi parametrami wymaga aktualizacji wszystkich
> wywołań `mapToRecipeDetailDto` (dwie gałęzie w `getRecipeById`, a także `createRecipe`
> i `updateRecipe` jeśli wywołują `getRecipeById` pośrednio).

W ciele funkcji dodać mapowanie:

```typescript
// Po istniejących polach (np. po my_note):
author: author,  // NOWE
```

---

## 4. Testy Deno

### 4.1 Nowy plik: `supabase/functions/explore/explore.service.test.ts`

Pokrycie scenariuszy GWT z historyjki (AC1, AC2, NF1):

```typescript
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/assert_equals.ts';
import { getExploreRecipeById } from './explore.service.ts';

// --- Przypadki testowe ---

// G1: PUBLIC przepis zwraca author.username i tips (AC1, AC2)
Deno.test('getExploreRecipeById: PUBLIC przepis zwraca author.username i tips', async () => {
    // Given: recipe id=1, user_id='user-abc', tips=[{type:'item',content:'Wskazówka'}]
    //        profil user-abc: username='jan.kowalski'
    // When: GET /explore/recipes/1
    // Then: result.author.username === 'jan.kowalski'
    //       result.tips.length > 0
});

// G2: PRIVATE przepis właściciela zwraca author (AC1)
Deno.test('getExploreRecipeById: PRIVATE przepis właściciela zwraca author', async () => {
    // Given: recipe id=2, PRIVATE, user_id='user-xyz'
    //        profil user-xyz: username='anna.nowak'
    // When: GET /explore/recipes/2 z JWT user-xyz
    // Then: result.author.username === 'anna.nowak'
});

// G3: brak profilu — fallback username=user_id (NF1)
Deno.test('getExploreRecipeById: brak profilu zwraca fallback, HTTP 200', async () => {
    // Given: recipe id=3, PUBLIC, user_id='orphan-uuid'
    //        profiles nie zawiera rekordu dla 'orphan-uuid'
    // When: GET /explore/recipes/3
    // Then: result.author.id === 'orphan-uuid'
    //       result.author.username === 'orphan-uuid'
    //       brak rzuconego błędu HTTP 500
});

// NF1: błąd zapytania profilu — fallback, brak 500
Deno.test('getExploreRecipeById: błąd DB przy fetchAuthorProfile nie powoduje 500', async () => {
    // Given: zapytanie do profiles rzuca wyjątek
    // Then: result.author.id === user_id (fallback)
    //       brak rzuconego wyjątku
});
```

#### Struktura mock klienta:

```typescript
function createExploreServiceClient(params: {
    recipeData?: Partial<RecipeDetailFullRow> | null;
    recipeError?: { code: string; message: string } | null;
    profileData?: { id: string; username: string } | null;
    profileError?: { code: string; message: string } | null;
    planIds?: number[];
}): TypedSupabaseClient
```

### 4.2 Istniejący plik: `supabase/functions/recipes/recipes.service.test.ts`

Dodać przypadek testowy dla G4 (AC3):

```typescript
// G4: prywatny endpoint zwraca author.username właściciela
Deno.test('getRecipeById: zwraca author.username właściciela', async () => {
    // Given: recipe id=4, user_id='user-abc'
    //        profil user-abc: username='jan.kowalski'
    // When: GET /recipes/4 z JWT user-abc (Step A — client authenticated)
    // Then: result.author.username === 'jan.kowalski'
    //       result.author.id === 'user-abc'
});

// Dodatkowy: Step B (PUBLIC) — service-role przekazywany do fetchAuthorProfile
Deno.test('getRecipeById: PUBLIC przepis (Step B) zwraca author przez serviceClient', async () => {
    // Given: recipe id=5, PUBLIC, user_id='user-xyz'
    //        profil user-xyz: username='anna.nowak'
    // When: GET /recipes/5 (RLS blokuje, Step B używa serviceClient)
    // Then: result.author.username === 'anna.nowak'
});
```

---

## 5. Macierz spójności: historyjka ↔ implementacja

| Wymaganie | AC | Plik | Metoda/Pole | Status |
|---|---|---|---|---|
| F1: `author` w shared `RecipeDetailDto` | AC8 | `shared/contracts/types.ts` | `RecipeDetailDto.author` | ✅ zaplanowane |
| F2.1: `tips` w SELECT | AC2 | `explore.service.ts` | `RECIPE_DETAIL_SELECT_COLUMNS` | ✅ zaplanowane |
| F2.2: `tips` w `RecipeDetailFullRow` | AC2 | `explore.service.ts` | interfejs `RecipeDetailFullRow` | ✅ zaplanowane |
| F2.3: `tips` w lokalnym `RecipeDetailDto` | AC2 | `explore.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F2.4: `author` w lokalnym `RecipeDetailDto` | AC1 | `explore.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F2.5: `fetchAuthorProfile(client, userId)` | AC1, NF1 | `explore.service.ts` | funkcja `fetchAuthorProfile` | ✅ zaplanowane |
| F2.6: `Promise.all` — gałąź PUBLIC | NF2, AC1 | `explore.service.ts` | `getExploreRecipeById` | ✅ zaplanowane |
| F2.6: `Promise.all` — gałąź PRIVATE | NF2, AC1 | `explore.service.ts` | `getExploreRecipeById` | ✅ zaplanowane |
| F2.7: sygnatura `mapToDto` + `author` | AC1 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F2.8: mapowanie `tips` w `mapToDto` | AC2 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F2.9: mapowanie `author` w `mapToDto` | AC1 | `explore.service.ts` | `mapToDto` | ✅ zaplanowane |
| F3.1: `author` w lokalnym `RecipeDetailDto` | AC3 | `recipes.service.ts` | interfejs `RecipeDetailDto` | ✅ zaplanowane |
| F3.2: `fetchAuthorProfile(client, userId)` | AC3, NF1 | `recipes.service.ts` | funkcja `fetchAuthorProfile` | ✅ zaplanowane |
| F3.3: `Promise.all` Step A + `client` | NF2, AC3 | `recipes.service.ts` | `getRecipeById` | ✅ zaplanowane |
| F3.4: `Promise.all` Step B + `serviceClient` | NF2, AC3 | `recipes.service.ts` | `getRecipeById` | ✅ zaplanowane |
| F3.5: sygnatura `mapToRecipeDetailDto` + `author` | AC3 | `recipes.service.ts` | `mapToRecipeDetailDto` | ✅ zaplanowane |
| F3.6: mapowanie `author` w `mapToRecipeDetailDto` | AC3 | `recipes.service.ts` | `mapToRecipeDetailDto` | ✅ zaplanowane |
| NF3: brak migracji SQL | — | — | — | ✅ potwierdzone |

---

## 6. Kolejność implementacji (sugerowana)

1. `shared/contracts/types.ts` — wymusi błędy TypeScript w edge functions (wygodna kontrola).
2. `supabase/functions/explore/explore.service.ts` — fix `tips` + `author` (dwie zmiany w jednym).
3. `supabase/functions/recipes/recipes.service.ts` — `author` (Opcja A).
4. Testy Deno: `explore.service.test.ts` (nowy) + `recipes.service.test.ts` (rozszerzenie).
