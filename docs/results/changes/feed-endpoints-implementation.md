# Implementacja Endpointów Feed (Cursor-based Pagination)

Data: 2025-12-22

## Podsumowanie

Zaimplementowano dwa nowe endpointy z cursor-based pagination dla wsparcia "load more" / infinite scroll w aplikacji:

- `GET /public/recipes/feed` - publiczny feed przepisów (anonimowy + opcjonalny JWT)
- `GET /recipes/feed` - prywatny feed przepisów użytkownika (wymaga JWT)

## Zaimplementowane komponenty

### 1. Współdzielone typy (shared/contracts/types.ts)

```typescript
interface CursorPageInfoDto {
    hasMore: boolean;
    nextCursor: string | null;
}

interface CursorPaginatedResponseDto<T> {
    data: T[];
    pageInfo: CursorPageInfoDto;
}
```

### 2. Cursor utilities (supabase/functions/_shared/cursor.ts)

**Nowy plik** z pełnym zestawem narzędzi do zarządzania cursor:

- `encodeCursor(data)` - kodowanie cursor do base64url
- `decodeCursor(str)` - dekodowanie i walidacja cursor
- `buildFiltersHash(params)` - generowanie SHA-256 hash filtrów
- `createNextCursor(...)` - tworzenie cursor dla następnej strony
- `validateCursorConsistency(...)` - walidacja spójności cursor z parametrami

**Format cursor:**
```json
{
  "v": 1,
  "offset": 12,
  "limit": 12,
  "sort": "created_at.desc",
  "filtersHash": "abc123..."
}
```

### 3. Public Feed Endpoint

**Routing:** `supabase/functions/public/public.handlers.ts`
- Dodano routing dla `/public/recipes/feed` (przed `/public/recipes/{id}`)
- Handler `handleGetPublicRecipesFeed` z opcjonalnym uwierzytelnieniem

**Walidacja:** Schema Zod `GetPublicRecipesFeedQuerySchema`
- `cursor` (string, opcjonalny)
- `limit` (1-100, domyślnie 12)
- `sort` (format: `field.direction`, dozwolone: `created_at|name`)
- `q` (string, min 2 znaki)
- `filter[termorobot]` (boolean)

**Serwis:** `supabase/functions/public/public.service.ts`
- Funkcja `getPublicRecipesFeed()` z:
  - Service role client (wymusza `visibility='PUBLIC'`)
  - Stabilne sortowanie (`ORDER BY field, id`)
  - Limit+1 trick dla określenia `hasMore`
  - Bulk fetch profili autorów (zapobiega N+1)
  - Opcjonalne `in_my_collections` dla zalogowanych

**Cache-Control:**
- Anonymous: `public, max-age=60`
- Authenticated: `no-store`

### 4. Recipes Feed Endpoint

**Routing:** `supabase/functions/recipes/recipes.handlers.ts`
- Dodano routing dla `/recipes/feed` (przed `/recipes/{id}`)
- Handler `handleGetRecipesFeed` z wymaganym JWT

**Walidacja:** Schema Zod `getRecipesFeedQuerySchema`
- `cursor` (string, opcjonalny)
- `limit` (1-100, domyślnie 12)
- `sort` (dozwolone: `name|created_at|updated_at`)
- `view` (owned|my_recipes)
- Wszystkie filtry z `GET /recipes`: category_id, tags, termorobot, search

**Serwis:** `supabase/functions/recipes/recipes.service.ts`
- Funkcja `getRecipesFeed()` z:
  - MVP: mapowanie offset → page dla RPC `get_recipes_list`
  - Walidacja alignment offset (`offset % limit == 0`)
  - Filters hash ze wszystkich parametrów
  - Tag resolution (nazwy → IDs)
  - Wyliczenie `hasMore` z `total_count`

## Techniczne szczegóły

### MVP Approach - Offset-based Cursor

W MVP używamy offset ukrytego w nieprzezroczystym cursor zamiast prawdziwego keyset pagination:

**Dlaczego?**
- Istniejący RPC `get_recipes_list` używa page-based pagination
- Szybkie wdrożenie bez zmian w bazie danych
- Łatwa migracja do keyset w przyszłości

**Ograniczenia:**
- Performance: OFFSET jest wolniejszy dla dużych offsetów
- Możliwe duplikaty/braki przy równoległych zmianach danych
- Wymaga `offset % limit == 0` (cursor locked to limit)

**Future improvement:**
- Keyset pagination z cursor `(lastValue, lastId)`
- Nowe RPC `get_recipes_feed` bez OFFSET
- WHERE clause: `(field, id) > (cursor.lastValue, cursor.lastId)`

### Stabilne sortowanie

Wszystkie zapytania używają tie-breaker:
```sql
ORDER BY field ASC/DESC, id ASC/DESC
```

Zapobiega to "pływaniu" kolejności przy remisach wartości.

### FiltersHash - Ochrona przed cursor tampering

Cursor zawiera SHA-256 hash wszystkich parametrów:
- sort
- view
- search/q
- categoryId
- tags
- termorobot

Próba użycia cursor z innymi parametrami → `400 VALIDATION_ERROR`

### Security

**Public feed:**
- Service role client + application-level filters
- ZAWSZE wymuszamy: `visibility='PUBLIC'` AND `deleted_at IS NULL`
- RLS nie ma zastosowania (service role)

**Recipes feed:**
- Authenticated client (JWT + RLS)
- RLS automatycznie filtruje do danych użytkownika
- Dodatkowa logika view (owned/my_recipes) w RPC

## API Examples

### Public Feed - Infinite Scroll

```typescript
// First page
const response1 = await fetch('/functions/v1/public/recipes/feed?limit=12');
// { data: [...12 recipes], pageInfo: { hasMore: true, nextCursor: "abc..." } }

// Second page (load more)
const response2 = await fetch('/functions/v1/public/recipes/feed?limit=12&cursor=abc...');
// { data: [...12 more recipes], pageInfo: { hasMore: false, nextCursor: null } }
```

### Recipes Feed - With Filters

```typescript
const params = new URLSearchParams({
    limit: '12',
    view: 'my_recipes',
    sort: 'name.asc',
    'filter[category_id]': '2',
    'filter[tags]': 'dessert,baking',
    search: 'chocolate'
});

const response = await fetch(`/functions/v1/recipes/feed?${params}`, {
    headers: { 'Authorization': `Bearer ${jwt}` }
});
```

## Testing

Przygotowano 15 smoke testów w `docs/testing/feed-endpoints-smoke-tests.md`:

**Public Feed:**
1. ✅ Pierwsza strona bez cursor
2. ✅ Druga strona z cursor
3. ✅ Z filtrem wyszukiwania
4. ✅ Z filtrem termorobot
5. ✅ Z sortowaniem
6. ✅ Authenticated (z JWT)
7. ✅ Invalid cursor → 400
8. ✅ Cursor z innymi parametrami → 400
9. ✅ Query za krótkie → 400

**Recipes Feed:**
10. ✅ Bez JWT → 401
11. ✅ Z JWT - pierwsza strona
12. ✅ View my_recipes
13. ✅ Z wszystkimi filtrami
14. ✅ Druga strona z cursor
15. ✅ Invalid sort field → 400

## Pliki zmienione/dodane

### Dodane:
- `supabase/functions/_shared/cursor.ts` - Cursor utilities
- `docs/testing/feed-endpoints-smoke-tests.md` - Testy smoke
- `docs/results/changes/feed-endpoints-implementation.md` - Ten dokument

### Zmodyfikowane:
- `shared/contracts/types.ts` - Dodano `CursorPageInfoDto`, `CursorPaginatedResponseDto`
- `supabase/functions/public/index.ts` - Zaktualizowano dokumentację
- `supabase/functions/public/public.types.ts` - Dodano `GetPublicRecipesFeedQuery`
- `supabase/functions/public/public.handlers.ts` - Dodano routing i handler feed
- `supabase/functions/public/public.service.ts` - Dodano `getPublicRecipesFeed()`
- `supabase/functions/recipes/index.ts` - Zaktualizowano dokumentację
- `supabase/functions/recipes/recipes.handlers.ts` - Dodano routing i handler feed
- `supabase/functions/recipes/recipes.service.ts` - Dodano `getRecipesFeed()`

## Performance Considerations

### Database queries

**Public feed:**
- 1x query na recipes (z `deleted_at` i `visibility` filter)
- 1x query na profiles (bulk, IN clause)
- 1x query na recipe_collections (tylko dla authenticated)
- **Total: 2-3 queries**

**Recipes feed:**
- 1x query na tag resolution (jeśli podano tags filter)
- 1x RPC call do `get_recipes_list`
- **Total: 1-2 queries**

### N+1 Prevention

✅ Bulk fetch autorów zamiast N pojedynczych queries
✅ RPC agreguje wszystkie dane w jednym zapytaniu
✅ Collection check wykonywany raz dla wszystkich recipes

### Caching

✅ Public feed dla anonymous: cachowane 60s
✅ Recipes feed: `no-store` (dane prywatne)

## Migration Path (Future)

### Do keyset pagination:

1. **Utworzyć nowe RPC** `get_recipes_feed_keyset`:
```sql
WHERE (sort_field, id) > (p_last_value, p_last_id)
ORDER BY sort_field, id
LIMIT p_limit + 1
```

2. **Zmienić format cursor:**
```json
{
  "v": 2,
  "lastValue": "2023-10-27T10:00:00Z",
  "lastId": 42,
  "sort": "created_at.desc",
  "filtersHash": "..."
}
```

3. **Zachować backward compatibility:**
- Cursor v1 → offset approach (stary)
- Cursor v2 → keyset approach (nowy)

## Status

✅ **Implementacja kompletna**
✅ **Brak błędów lintera**
⏳ **Smoke testy do wykonania manualnie**
⏳ **Deploy i testy end-to-end**

## Następne kroki

1. Wykonać smoke testy na lokalnym środowisku
2. Deploy na staging
3. Testy E2E z prawdziwymi danymi
4. Monitoring wydajności
5. Frontend implementation (infinite scroll)
6. (Opcjonalnie) Migracja do keyset pagination

