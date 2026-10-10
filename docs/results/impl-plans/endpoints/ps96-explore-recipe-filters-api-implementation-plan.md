# API Endpoints Implementation Plan: PS-96 — Filtry przepisów w katalogu Odkrywaj

> **User Story:** PS-96 — Filtry przepisów w katalogu Odkrywaj (`/explore`)
> **Data:** październik 2026
> **Autor:** plan wygenerowany na podstawie PS-96-explore-recipe-filters-api-plan.md

---

## 1. Przegląd punktu końcowego

Historyjka PS-96 rozszerza dwa istniejące endpointy publiczne o obsługę nowych parametrów filtrujących. Zmiany dotyczą wyłącznie istniejącej Edge Function **`public`** — nie ma nowych funkcji, migracji bazy danych ani nowych zmiennych środowiskowych.

| Endpoint | Typ | Opis |
|---|---|---|
| `GET /public/recipes` | Modyfikacja | Dodanie parametrów `favorite`, `want_to_try`, `diet` |
| `GET /public/recipes/feed` | Modyfikacja | Identyczne rozszerzenie — cursor-based wariant listy |

**Kluczowa zasada:** filtry `favorite` i `want_to_try` działają **wyłącznie dla zalogowanych użytkowników** — bez JWT są po cichu ignorowane (brak błędu `401`). Filtr `diet` działa dla wszystkich.

---

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes`

- **Metoda HTTP:** `GET`
- **Struktura URL:** `/functions/v1/public/recipes`
- **Autoryzacja:** Opcjonalna (`Authorization: Bearer <JWT>`)

#### Parametry

**Istniejące (bez zmian):**

| Parametr | Typ | Opis |
|---|---|---|
| `page` | string (int) | Numer strony (default `1`) |
| `limit` | string (int, max 100) | Liczba wyników (default `20`) |
| `sort` | string | Format `{field}.{direction}` (default `created_at.desc`) |
| `q` | string | Wyszukiwanie pełnotekstowe (min 3 znaki) |
| `filter[termorobot]` | `"true"` / `"false"` | Filtr Termorobot |
| `filter[diet_type]` | `MEAT` / `VEGETARIAN` / `VEGAN` | Dokładne dopasowanie diety (backward compat) |
| `filter[cuisine]` | enum | Kuchnia |
| `filter[difficulty]` | enum | Trudność |
| `filter[grill]` | `"true"` / `"false"` | Filtr Grill |

**Nowe (PS-96):**

| Parametr | Typ | Opis | Bez JWT |
|---|---|---|---|
| `favorite` | `"true"` | Zwróć tylko przepisy z `is_favorite = true` zalogowanego | **Ignorowany** |
| `want_to_try` | `"true"` | Zwróć tylko przepisy z `is_want_to_try = true` zalogowanego | **Ignorowany** |
| `diet` | `"vege_plus"` / `"vegan"` | `vege_plus` = `VEGETARIAN` + `VEGAN` (union), `vegan` = tylko `VEGAN` | Działa dla wszystkich |

> **Priorytet filtrów diety:** gdy obecne są jednocześnie `diet` i `filter[diet_type]`, parametr `diet` ma priorytet.

### 2.2 `GET /public/recipes/feed`

- **Metoda HTTP:** `GET`
- **Struktura URL:** `/functions/v1/public/recipes/feed`
- **Autoryzacja:** Opcjonalna (`Authorization: Bearer <JWT>`)

Identyczne nowe parametry jak w `GET /public/recipes`. Różnica: paginacja cursor-based (`cursor` zamiast `page`/`limit`).

---

## 3. Wykorzystywane typy

### Nowe / rozszerzone typy w `public.types.ts`

```typescript
/**
 * Nowy typ dla filtra diety (PS-96).
 * Zastępuje filter[diet_type] w nowym UI; backward compat zachowany.
 */
export type PublicRecipesDietFilter = 'vege_plus' | 'vegan';

/**
 * Rozszerzenie GetPublicRecipesQuery o nowe parametry PS-96.
 */
export interface GetPublicRecipesQuery {
    page: number;
    limit: number;
    sortField: 'created_at' | 'name' | 'relevance';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;         // backward compat
    diet?: PublicRecipesDietFilter;    // NOWE (PS-96); priorytet nad dietType
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
    favorite?: boolean;                // NOWE (PS-96); tylko dla userId !== null
    wantToTry?: boolean;               // NOWE (PS-96); tylko dla userId !== null
}

/**
 * Rozszerzenie GetPublicRecipesFeedQuery o nowe parametry PS-96.
 */
export interface GetPublicRecipesFeedQuery {
    cursor?: string;
    limit: number;
    sortField: 'created_at' | 'name' | 'relevance';
    sortDirection: 'asc' | 'desc';
    q?: string;
    termorobot?: boolean;
    dietType?: RecipeDietType;         // backward compat
    diet?: PublicRecipesDietFilter;    // NOWE (PS-96)
    cuisine?: RecipeCuisine;
    difficulty?: RecipeDifficulty;
    grill?: boolean;
    favorite?: boolean;                // NOWE (PS-96)
    wantToTry?: boolean;               // NOWE (PS-96)
}
```

### Typy bez zmian

- `PublicRecipeListItemDto` — struktura odpowiedzi **bez zmian**; nowe parametry zawężają tylko wyniki
- `PublicRecipeDetailDto` — **bez zmian**
- `PaginationDetails`, `CursorPageInfo` — **bez zmian**

> **Uwaga:** Istniejące pole `is_favorite?: boolean` w `PublicRecipeListItemDto` (dodane w PS-95) pozostaje bez zmian. PS-96 jedynie filtruje po nim, nie dodaje nowych pól do odpowiedzi.

---

## 4. Szczegóły odpowiedzi

Format odpowiedzi **bez zmian** względem PS-95. Nowe parametry filtrują zbiór wyników, ale nie modyfikują struktury DTO.

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Wyniki (mogą być puste — `data: []`) |
| `400 Bad Request` | Niepoprawna wartość istniejącego parametru (np. `sort=xyz`) — tylko dla parametrów z rygorystyczną walidacją |
| `500 Internal Server Error` | Błąd bazy danych |

> **Nowe parametry nie generują `400`** — nieznane/błędne wartości `favorite`, `want_to_try`, `diet` są ignorowane (filozofia endpointu publicznego).

### Cache-Control (bez zmian z PS-95)

- Żądanie bez JWT: `Cache-Control: public, max-age=60`
- Żądanie z JWT: `Cache-Control: no-store`

---

## 5. Przepływ danych

### Diagram przepływu dla nowych parametrów

```
Request
  │
  ▼
getOptionalAuthenticatedUser(req)
  │  ┌─ null (gość)
  │  └─ userId (zalogowany)
  ▼
Zod validation (public.handlers.ts)
  ├── favorite="true"     → query.favorite = true
  ├── want_to_try="true"  → query.wantToTry = true
  ├── diet="vege_plus"    → query.diet = 'vege_plus'
  ├── diet="vegan"        → query.diet = 'vegan'
  └── (inne wartości)     → pole undefined (ignorowane)
  ▼
getPublicRecipes(client, query, userId) (public.service.ts)
  │
  ├── Filtr diety (dla wszystkich)
  │   ├── diet='vege_plus' → .in('diet_type', ['VEGETARIAN', 'VEGAN'])
  │   ├── diet='vegan'     → .eq('diet_type', 'VEGAN')
  │   └── brak diet + dietType → .eq('diet_type', dietType) (backward compat)
  │
  └── Filtry flag (TYLKO gdy userId !== null)
      ├── favorite=true    → INNER JOIN user_recipe_flags (is_favorite=true, user_id=userId)
      └── wantToTry=true   → INNER JOIN user_recipe_flags (is_want_to_try=true, user_id=userId)
  ▼
buildRecipeListResponse(...)
  ▼
createCachedResponse(result, userId !== null)
```

### Logika INNER JOIN dla flag (pseudokod SQL)

```sql
-- favorite=true (userId !== null):
INNER JOIN user_recipe_flags f_fav
    ON f_fav.recipe_id = r.id
   AND f_fav.user_id = '<userId z JWT>'   -- OBOWIĄZKOWE — nigdy z query params
   AND f_fav.is_favorite = true

-- want_to_try=true (userId !== null):
INNER JOIN user_recipe_flags f_wtt
    ON f_wtt.recipe_id = r.id
   AND f_wtt.user_id = '<userId z JWT>'   -- OBOWIĄZKOWE — nigdy z query params
   AND f_wtt.is_want_to_try = true

-- oba jednocześnie → oba JOINy (AND semantics)
```

### Alternatywna implementacja (subquery) dla Supabase PostgREST

Jeśli jednoczesne filtrowanie po `favorite` i `want_to_try` sprawi trudności z podwójnym JOINem przez PostgREST, alternatywą jest:

1. Pobranie `recipe_id` z `user_recipe_flags` gdzie `user_id = userId AND is_favorite = true AND is_want_to_try = true`
2. `.in('id', recipeIds)` w głównym zapytaniu

---

## 6. Względy bezpieczeństwa

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt flag innego użytkownika | `userId` pochodzi **wyłącznie** z `getOptionalAuthenticatedUser(req)` — weryfikacja JWT przez Supabase; nigdy z query params |
| `favorite=true` bez JWT | Parametr jest ignorowany przed budowaniem zapytania (guard `if (userId !== null && query.favorite)`) |
| Wstrzyknięcie wartości `diet` | Whitelist przez Zod: `z.enum(['vege_plus', 'vegan'])` lub `z.string().optional()` z transformem odrzucającym nieznane wartości |
| Wyciek prywatnych flag przez cache | `no-store` dla żądań z JWT (bez zmian z PS-95) |
| Filtr `user_id` pominięty w JOIN | Obowiązkowy `.eq('user_id', userId)` lub `AND user_id = userId` w każdym JOINie do `user_recipe_flags` |

---

## 7. Obsługa błędów

| Błąd | Kod HTTP | Zachowanie |
|---|---|---|
| `favorite=true` bez JWT | `200 OK` | Parametr ignorowany — wyniki jak bez filtra |
| `want_to_try=true` bez JWT | `200 OK` | Jw. |
| `diet=xyz` (nieznana wartość) | `200 OK` | Parametr ignorowany |
| `favorite=true` + JWT, ale brak flag | `200 OK` | `data: []` (pusta lista) |
| Błąd zapytania do `user_recipe_flags` | `500 Internal Server Error` | `ApplicationError('INTERNAL_ERROR', ...)` — logowanie + rzucenie błędu |
| Błąd głównego zapytania do `recipe_details` | `500 Internal Server Error` | Jw. — bez zmian względem istniejącej obsługi |

---

## 8. Wydajność

| Aspekt | Opis |
|---|---|
| Indeks dla `favorite` | `idx_user_recipe_flags_user_favorite` na `(user_id, recipe_id) WHERE is_favorite` — istnieje z PS-95; INNER JOIN jest szybki |
| Indeks dla `want_to_try` | **Brak** — pełny skan tabeli; akceptowalne w MVP (niska częstotliwość użycia). Jeśli logi wskażą problem, dodać oddzielną migrację |
| Oba filtry jednocześnie | Dwa JOINy lub subquery; wyniki AND są małe, koszt akceptowalny |
| Cache | Żądania z flagami = zawsze z JWT = `no-store`; nie wpływa negatywnie na cache anonimowy |
| Paginacja przy filtrach flag | Reset do strony 1 / nowego cursora przy zmianie filtrów — realizowany przez frontend (bez zmian w API) |

---

## 9. Etapy wdrożenia

### Krok 1: Rozszerzenie typów — `public.types.ts`

1. Dodać typ `PublicRecipesDietFilter = 'vege_plus' | 'vegan'`
2. Rozszerzyć `GetPublicRecipesQuery` o pola `diet?`, `favorite?`, `wantToTry?`
3. Rozszerzyć `GetPublicRecipesFeedQuery` identycznie

### Krok 2: Rozszerzenie schematów Zod — `public.handlers.ts`

W `GetPublicRecipesQuerySchema` dodać:

```typescript
favorite: z.string().optional().transform((val) => {
    if (val === 'true') return true;
    return undefined; // ignoruj inne wartości
}),
want_to_try: z.string().optional().transform((val) => {
    if (val === 'true') return true;
    return undefined;
}),
diet: z.string().optional().transform((val) => {
    if (val === 'vege_plus' || val === 'vegan') return val as 'vege_plus' | 'vegan';
    return undefined; // ignoruj nieznane wartości — brak błędu
}),
```

Identyczne zmiany w `GetPublicRecipesFeedQuerySchema`.

### Krok 3: Parsowanie parametrów w handlerach — `public.handlers.ts`

W `handleGetPublicRecipes`:
1. Dodać `'favorite'` i `'want_to_try'` oraz `'diet'` do `rawParams`
2. Przekazać `query.favorite`, `query.wantToTry`, `query.diet` do obiektu `query: GetPublicRecipesQuery`

```typescript
const rawParams = {
    // ... istniejące pola ...
    'filter[grill]': url.searchParams.get('filter[grill]') || undefined,
    // NOWE (PS-96):
    favorite: url.searchParams.get('favorite') || undefined,
    want_to_try: url.searchParams.get('want_to_try') || undefined,
    diet: url.searchParams.get('diet') || undefined,
};

const query: GetPublicRecipesQuery = {
    // ... istniejące pola ...
    grill: validatedParams['filter[grill]'],
    // NOWE (PS-96):
    favorite: validatedParams.favorite,
    wantToTry: validatedParams.want_to_try,
    diet: validatedParams.diet,
};
```

Identyczne zmiany w `handleGetPublicRecipesFeed`.

### Krok 4: Implementacja logiki filtrowania — `public.service.ts`

W funkcji `getPublicRecipes` (po istniejących filtrach `grill`):

```typescript
// --- nowy filtr diet (PS-96) ---
// diet ma priorytet nad diet_type (backward compat)
if (query.diet === 'vege_plus') {
    dbQuery = dbQuery.in('diet_type', ['VEGETARIAN', 'VEGAN']);
} else if (query.diet === 'vegan') {
    dbQuery = dbQuery.eq('diet_type', 'VEGAN');
} else if (query.dietType !== undefined) {
    dbQuery = dbQuery.eq('diet_type', query.dietType); // backward compat
}

// --- nowe filtry flag (PS-96) — TYLKO dla zalogowanego ---
// UWAGA: INNER JOIN realizowany przez PostgREST przy użyciu relacji z user_recipe_flags
// Wariant A (PostgREST join):
if (userId !== null && query.favorite === true) {
    // Pobranie recipe_ids gdzie is_favorite=true dla userId
    const { data: favData } = await client
        .from('user_recipe_flags')
        .select('recipe_id')
        .eq('user_id', userId)
        .eq('is_favorite', true);
    
    const favRecipeIds = (favData ?? []).map(r => r.recipe_id);
    if (favRecipeIds.length === 0) {
        // Brak ulubionych — zwróć pustą listę
        return { data: [], pagination: { currentPage: query.page, totalPages: 0, totalItems: 0 } };
    }
    dbQuery = dbQuery.in('id', favRecipeIds);
}

if (userId !== null && query.wantToTry === true) {
    const { data: wttData } = await client
        .from('user_recipe_flags')
        .select('recipe_id')
        .eq('user_id', userId)
        .eq('is_want_to_try', true);

    const wttRecipeIds = (wttData ?? []).map(r => r.recipe_id);
    if (wttRecipeIds.length === 0) {
        return { data: [], pagination: { currentPage: query.page, totalPages: 0, totalItems: 0 } };
    }
    dbQuery = dbQuery.in('id', wttRecipeIds);
}
```

> **Uwaga implementacyjna:** Wzorzec `subquery → .in('id', recipeIds)` jest preferowany nad podwójnym INNER JOINem przez PostgREST (prostszy, bez ryzyka konfliktu selektów). Przy jednoczesnym `favorite=true` i `want_to_try=true` wykonaj oba zapytania do `user_recipe_flags`, a następnie użyj przecięcia list (`intersection`) przed przekazaniem do głównego zapytania.

Identyczne zmiany w `getPublicRecipesFeed` (po filtrach `grill`, przed sekcją paginacji cursor).

> **Ważne:** Przy `hasSearch=true` filtrowanie flag musi być zastosowane **przed** pętlą relevance scoring — dodaj `recipeIds` subfiltr do `dbQuery` przed wykonaniem zapytania, nie po.

### Krok 5: Aktualizacja filtersHash dla cursor (tylko feed) — `public.service.ts`

W `getPublicRecipesFeed` filtersHash używany jest do walidacji spójności cursora. Należy dodać nowe filtry:

```typescript
const filtersHash = await buildFiltersHash({
    sort: sortString,
    q: query.q,
    termorobot: query.termorobot,
    dietType: query.dietType,
    diet: query.diet,          // NOWE (PS-96)
    cuisine: query.cuisine,
    difficulty: query.difficulty,
    grill: query.grill,
    favorite: query.favorite,   // NOWE (PS-96)
    wantToTry: query.wantToTry, // NOWE (PS-96)
    userId: userId ?? undefined,
});
```

### Krok 6: Testy jednostkowe i integracyjne

Scenariusze do przetestowania (zgodnie z sekcją 7 planu API):

| Scenariusz | Oczekiwane zachowanie |
|---|---|
| `diet=vege_plus` | Zwraca `VEGETARIAN` i `VEGAN`, pomija `MEAT` |
| `diet=vegan` | Zwraca tylko `VEGAN` |
| `diet` + `q` | AND — wyniki spełniają oba kryteria |
| `favorite=true` z JWT | Tylko `is_favorite=true` danego użytkownika |
| `want_to_try=true` z JWT | Tylko `is_want_to_try=true` |
| `favorite=true` + `want_to_try=true` | Przepisy z obiema flagami (AND) |
| `favorite=true` **bez JWT** | Parametr ignorowany — wyniki bez filtrowania |
| `favorite=true` z JWT, brak flag | `data: []` |
| `diet=xyz` (nieznana wartość) | Ignorowana — brak błędu, brak filtrowania |
| `diet=vege_plus` + `favorite=true` | AND obu warunków |
| Cache-Control z JWT | `no-store` (regresja PS-95) |
| Cache-Control bez JWT | `public, max-age=60` (regresja PS-95) |

### Krok 7: Weryfikacja manualna na środowisku lokalnym

```powershell
# 1. Filtr vege_plus (anonimowy)
Invoke-RestMethod "http://localhost:54331/functions/v1/public/recipes?diet=vege_plus"

# 2. Filtr ulubionych (zalogowany)
Invoke-RestMethod "http://localhost:54331/functions/v1/public/recipes?favorite=true" `
    -Headers @{ Authorization = "Bearer <JWT>" }

# 3. Kombinacja filtrów
Invoke-RestMethod "http://localhost:54331/functions/v1/public/recipes?diet=vege_plus&favorite=true&filter[termorobot]=true" `
    -Headers @{ Authorization = "Bearer <JWT>" }

# 4. favorite bez JWT — powinien zwrócić normalne wyniki (bez filtrowania)
Invoke-RestMethod "http://localhost:54331/functions/v1/public/recipes?favorite=true"
```

---

## Uwaga o wartościach enum diety

> ⚠️ **Rozbieżność w dokumentacji:** Plan API PS-96 używa `VEGE` w pseudokodzie SQL (`diet_type IN ('VEGE', 'VEGAN')`). Jednak typy TypeScript (`RecipeDietType`) oraz istniejący kod backendu konsekwentnie używają **`VEGETARIAN`** (nie `VEGE`). Implementacja musi używać `VEGETARIAN`, zgodnie z rzeczywistym schematem bazy danych.
