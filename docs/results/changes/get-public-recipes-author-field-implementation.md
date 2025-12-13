# Implementacja pola `author` w endpoincie GET /public/recipes

## Data implementacji
2025-12-13

## Podsumowanie
Zaimplementowano dodanie pola `author: ProfileDto` do odpowiedzi endpointu `GET /public/recipes` zgodnie z planem implementacji. Endpoint zwraca teraz informacje o autorze każdego przepisu, co umożliwia frontendowi oznaczanie przepisów użytkownika jako "Twój przepis".

## Zmiany w plikach

### 1. Typy kontraktów (`shared/contracts/types.ts`)
**Zmiana:** Dodano pole `author: ProfileDto` do interfejsu `PublicRecipeListItemDto`

```typescript
export interface PublicRecipeListItemDto {
    id: number;
    name: string;
    description: string | null;
    image_path: string | null;
    category: CategoryDto | null;
    tags: string[];
    author: ProfileDto;  // ✅ DODANE
    created_at: string;
}
```

### 2. Serwis (`supabase/functions/public/public.service.ts`)

#### 2.1 Aktualizacja lokalnego DTO
Zaktualizowano lokalny interfejs `PublicRecipeListItemDto` aby był zgodny z kontraktem.

#### 2.2 Rozszerzenie interfejsu `RecipeDetailsRow`
Dodano pole `user_id` do interfejsu:

```typescript
interface RecipeDetailsRow {
    id: number;
    user_id: string;  // ✅ DODANE
    name: string;
    // ... pozostałe pola
}
```

#### 2.3 Aktualizacja projekcji kolumn
Dodano `user_id` do stałej `RECIPE_SELECT_COLUMNS`:

```typescript
const RECIPE_SELECT_COLUMNS = 'id, user_id, name, description, image_path, category_id, category_name, tags, created_at';
```

#### 2.4 Implementacja bulk fetch profili (unikanie N+1 queries)
Zmodyfikowano funkcję `getPublicRecipes()`:

**Dodane kroki:**
1. Ekstrakcja unikalnych `user_id` z listy przepisów
2. Bulk fetch profili jednym zapytaniem: `.in('id', uniqueUserIds)`
3. Budowa mapy `Map<string, ProfileRow>` dla efektywnego lookup
4. Walidacja kompletności - sprawdzenie czy wszystkie profile zostały pobrane
5. Mapowanie `author: { id, username }` do każdego przepisu w DTO

**Kod implementacji:**
```typescript
// Extract unique user IDs from recipes
const uniqueUserIds = [...new Set(recipeRows.map((recipe) => recipe.user_id))];

// Bulk fetch all author profiles
const { data: profilesData, error: profilesError } = await client
    .from('profiles')
    .select(PROFILE_SELECT_COLUMNS)
    .in('id', uniqueUserIds);

// Build a map of profiles by user ID for efficient lookup
const profilesById = new Map<string, ProfileRow>(
    (profilesData as ProfileRow[]).map((profile) => [profile.id, profile])
);

// Check if all profiles were found
if (profilesById.size !== uniqueUserIds.length) {
    const missingUserIds = uniqueUserIds.filter((id) => !profilesById.has(id));
    throw new ApplicationError('INTERNAL_ERROR', 'Some recipe authors could not be found');
}

// Map to DTO with author
const recipes: PublicRecipeListItemDto[] = recipeRows.map((recipe) => {
    const author = profilesById.get(recipe.user_id);
    return {
        // ... inne pola
        author: {
            id: author.id,
            username: author.username,
        },
    };
});
```

### 3. Typy bazodanowe (`supabase/functions/_shared/database.types.ts`)

#### 3.1 Dodano `visibility` do widoku `recipe_details`
```typescript
recipe_details: {
    Row: {
        // ... inne pola
        visibility: string | null;  // ✅ DODANE
    };
}
```

#### 3.2 Dodano `visibility` do tabeli `recipes`
```typescript
recipes: {
    Row: {
        // ... inne pola
        visibility: string;  // ✅ DODANE
    };
    Insert: {
        // ... inne pola
        visibility?: string;  // ✅ DODANE
    };
    Update: {
        // ... inne pola
        visibility?: string;  // ✅ DODANE
    };
}
```

### 4. Cache headers (`supabase/functions/public/index.ts`)

#### 4.1 Rozszerzenie funkcji `addCorsHeaders`
Dodano opcjonalny parametr `addCacheHeaders`:

```typescript
function addCorsHeaders(response: Response, addCacheHeaders = false): Response {
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });
    
    // Add cache headers for successful responses on public endpoints
    if (addCacheHeaders && response.status === 200) {
        newHeaders.set('Cache-Control', 'public, max-age=60');
    }
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}
```

#### 4.2 Włączenie cache dla publicznych endpointów
```typescript
return addCorsHeaders(response, true);  // ✅ cache enabled
```

## Struktura odpowiedzi API

### Przykładowa odpowiedź

```json
{
  "data": [
    {
      "id": 1,
      "name": "Apple Pie",
      "description": "A classic dessert.",
      "image_path": "path/to/image.jpg",
      "category": { "id": 2, "name": "Dessert" },
      "tags": ["sweet", "baking"],
      "author": {
        "id": "a1b2c3d4-...",
        "username": "john.doe"
      },
      "created_at": "2023-10-27T10:00:00Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 5,
    "totalItems": 100
  }
}
```

## Optymalizacja wydajności

### Problem N+1 queries - rozwiązany ✅
**Przed:** Potencjalnie N+1 zapytań (1 dla przepisów + N dla każdego autora osobno)

**Po:** Tylko 2 zapytania:
1. Lista przepisów z `user_id`
2. Bulk fetch wszystkich profili autorów

### Cache HTTP
- Dodano `Cache-Control: public, max-age=60` dla odpowiedzi 200 OK
- Publiczne przepisy są cache'owane przez 60 sekund
- Redukuje obciążenie serwera dla często odpytywanych zasobów

## Bezpieczeństwo

### Walidacja kompletności danych
Implementacja zawiera sprawdzenie czy wszystkie profile autorów zostały znalezione:

```typescript
if (profilesById.size !== uniqueUserIds.length) {
    const missingUserIds = uniqueUserIds.filter((id) => !profilesById.has(id));
    logger.error('Some author profiles are missing', {
        missingUserIds,
        missingCount: missingUserIds.length,
    });
    throw new ApplicationError('INTERNAL_ERROR', 'Some recipe authors could not be found');
}
```

### Logowanie
Dodano szczegółowe logowanie:
- Liczba unikalnych autorów do pobrania
- Liczba pobranych profili
- Wykrycie brakujących profili

## Zgodność z planem implementacji

### Zrealizowane punkty z planu ✅

1. ✅ Aktualizacja typu `PublicRecipeListItemDto` (krok 9)
2. ✅ Dodanie `user_id` do projekcji (krok 5)
3. ✅ Implementacja bulk fetch profili (krok 6)
4. ✅ Mapowanie do DTO z `author` (krok 8)
5. ✅ Aktualizacja kontraktów typów w `shared/contracts/types.ts` (krok 9)
6. ✅ Aktualizacja lokalnego DTO w serwisie (krok 9)
7. ✅ Dodanie cache headers (krok 10)
8. ✅ Aktualizacja typów bazodanowych (krok 11)

## Testy lokalne

### Scenariusze do przetestowania:

```bash
# 1. Uruchomienie funkcji lokalnie
supabase functions serve public

# 2. Test podstawowy - domyślne parametry
curl http://localhost:54321/functions/v1/public/recipes

# 3. Test z paginacją
curl "http://localhost:54321/functions/v1/public/recipes?page=2&limit=10"

# 4. Test z sortowaniem
curl "http://localhost:54321/functions/v1/public/recipes?sort=name.asc"

# 5. Test z wyszukiwaniem
curl "http://localhost:54321/functions/v1/public/recipes?q=apple"

# 6. Weryfikacja obecności pola author w odpowiedzi
curl http://localhost:54321/functions/v1/public/recipes | jq '.data[0].author'
```

### Oczekiwane wyniki:
- Każdy element w `data[]` zawiera pole `author` z `id` i `username`
- Cache headers: `Cache-Control: public, max-age=60` dla odpowiedzi 200 OK
- Brak błędów w logach
- Tylko 2 zapytania do bazy (recipes + profiles bulk)

## Następne kroki (opcjonalnie)

### 1. Rozszerzenie wyszukiwania
Plan implementacji sugeruje dodanie wyszukiwania po tagach:
- Utworzenie funkcji RPC `search_public_recipes()` agregującej tagi do tekstu wyszukiwania
- Lub użycie JOINa na `tags` z filtrem `tags.name ILIKE`

### 2. Full-text search
Zastąpienie `ILIKE` przez `textSearch` z użyciem `search_vector`:
```typescript
dbQuery = dbQuery.textSearch('search_vector', query.q, { type: 'websearch' });
```

### 3. Polityki RLS dla `anon`
Rozważenie dodania polityk RLS umożliwiających bezpośredni dostęp dla roli `anon`:
```sql
CREATE POLICY "Allow anon to view public recipes" ON recipes
    FOR SELECT TO anon
    USING (visibility = 'PUBLIC' AND deleted_at IS NULL);
```
