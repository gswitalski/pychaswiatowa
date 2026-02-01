## API Endpoints Implementation Plan: Collections Recipes (`GET /collections/{id}/recipes`)

### 1. Przegląd punktu końcowego
- **Cel**: zwrócić listę przepisów należących do jednej kolekcji w formie “lekkiej” pod **Sidebar Collections tree** (3. poziom: kolekcja → przepisy), bez pobierania pełnych szczegółów kolekcji.
- **Endpoint**: `GET /collections/{id}/recipes`
- **Auth**: wymagany JWT Supabase (`Authorization: Bearer <token>`).
- **Zasada danych**:
    - przepisy w kolekcji mogą być **własne** użytkownika albo **PUBLIC** (bo tylko takie da się dodać do kolekcji w `POST /collections/{id}/recipes`),
    - przepisy “miękko usunięte” muszą być pomijane (`recipes.deleted_at IS NULL`).
- **Powiązana zmiana**: `GET /collections/{id}` musi mieć w `recipes.data` pole `image_path` (w obecnym kodzie już jest) oraz stabilne sortowanie.

### 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/collections/{id}/recipes`
- **Parametry ścieżki**:
    - **Wymagane**:
        - `id` (number, integer, > 0): identyfikator kolekcji.
- **Parametry query**:
    - **Opcjonalne**:
        - `limit` (number, integer, 1..500; domyślnie `500`): limit bezpieczeństwa (Sidebar ładuje jedną paczkę).
        - `sort` (string; domyślnie `name.asc`; regex: `^(created_at|name)\.(asc|desc)$`): stabilne sortowanie.
- **Request Body**: brak.

### 3. Wykorzystywane typy
- **DTO (nowe / doprecyzowane)**:
    - `RecipeSidebarListItemDto` (minimalny): `id`, `name`, `image_path`
    - `GetCollectionRecipesResponseDto`:
        - `collection_id: number`
        - `data: RecipeSidebarListItemDto[]`
        - `pageInfo: CollectionRecipesPageInfoDto` (już istnieje w `supabase/functions/collections/collections.types.ts` i w `shared/contracts/types.ts`)
- **Istniejące typy, których dotyka zmiana**:
    - `CollectionDetailDto` (dla `GET /collections/{id}`) – ma `recipes.data[].image_path` (wymagane przez doprecyzowanie).
- **Command modele**: brak (GET).

### 4. Szczegóły odpowiedzi
- **200 OK**:

```json
{
    "collection_id": 1,
    "data": [
        { "id": 1, "name": "Apple Pie", "image_path": "recipes/1/cover_1700000000.webp" }
    ],
    "pageInfo": {
        "limit": 500,
        "returned": 40,
        "truncated": false
    }
}
```

- **Uwagi**:
    - `image_path` może być `null` → UI pokazuje fallback.
    - `pageInfo.truncated = true` gdy w kolekcji jest więcej przepisów niż `limit`.

### 5. Przepływ danych
- **Warstwa HTTP (router/handler)**:
    - dopasowanie ścieżki `^\/(\d+)\/recipes$` i metoda `GET`,
    - walidacja `collectionId` oraz query (`limit`, `sort`) przez Zod,
    - delegacja do serwisu: `getCollectionRecipes(...)`.
- **Warstwa serwisowa**:
    - **Krok 1**: weryfikacja, że kolekcja istnieje i należy do użytkownika:
        - `collections.select('id').eq('id', collectionId).eq('user_id', userId).single()`
        - brak wyniku → `404 NOT_FOUND` (“Collection not found”) bez ujawniania czy kolekcja istnieje dla innego usera.
    - **Krok 2**: policzenie całkowitej liczby przepisów w kolekcji (tylko nieusunięte):
        - preferowany wariant: count po stronie `recipes` z joinem na `recipe_collections` + filtr `deleted_at IS NULL`.
    - **Krok 3**: pobranie danych:
        - preferowany wariant: **jedno zapytanie** do `recipes` z joinem `recipe_collections!inner` (filtr po `collection_id`) + `deleted_at IS NULL`,
        - select wyłącznie `id, name, image_path`,
        - sortowanie według `sort` + stabilny tie-breaker `id.asc`,
        - limit (range 0..limit-1) aplikowany **po** sortowaniu.
- **Uwaga o istniejącym `GET /collections/{id}`**:
    - obecny kod w `getCollectionById()` nakłada `range()` na `recipe_collections` przed sortowaniem po `recipes`, co może powodować niepoprawne “ucięcie” (limit przed sortem).
    - plan zakłada korektę tej strategii (patrz “Kroki implementacji”), tak by ograniczenie następowało dopiero po zastosowaniu sortowania.

### 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany nagłówek `Authorization: Bearer <JWT>`; brak/nieprawidłowy token → `401 UNAUTHORIZED`.
- **Autoryzacja**:
    - kolekcja musi należeć do użytkownika (weryfikacja w serwisie + RLS jako druga linia obrony),
    - przepisy w kolekcji: dopuszczalne tylko własne lub PUBLIC (to jest wymuszone już w `POST /collections/{id}/recipes`), ale endpoint powinien nadal filtrować `deleted_at IS NULL`.
- **Ochrona przed wyciekiem informacji**:
    - przy braku dostępu do kolekcji zwracamy `404`, a nie `403`, aby nie zdradzać istnienia zasobu.
- **Ryzyka**:
    - parametry `sort` i `limit` muszą być walidowane (unikamy wstrzyknięć do sortowania i kosztownych zapytań).

### 7. Obsługa błędów
- **400 Bad Request**:
    - `id` nie jest dodatnią liczbą całkowitą,
    - `limit` poza zakresem 1..500,
    - `sort` nie pasuje do wzorca `^(created_at|name)\.(asc|desc)$`.
- **401 Unauthorized**:
    - brak `Authorization`,
    - token nieważny/wygasły (Supabase `auth.getUser()` zwraca błąd).
- **404 Not Found**:
    - kolekcja nie istnieje lub nie należy do usera,
    - (opcjonalnie) kolekcja istnieje, ale nie ma przepisów → **nadal 200** z pustą listą (to nie jest 404).
- **500 Internal Server Error**:
    - błędy Supabase/PostgREST, niespodziewane wyjątki.
- **Rejestrowanie błędów**:
    - obecny standard projektu: `logger.error(...)` + spójne `ApplicationError`/`handleError`.
    - brak wymogu zapisu do osobnej “tabeli błędów” w aktualnym stacku – w MVP wystarczają logi Edge Functions.

### 8. Wydajność
- **Minimalny select**: `id,name,image_path` (kluczowe dla Sidebara).
- **Stabilne sortowanie**: `order(sortField)` + tie-breaker `order('id', { ascending: true })`.
- **Limit bezpieczeństwa**: max 500.
- **Indeksy**:
    - `recipe_collections(collection_id)` istnieje (wg DB plan),
    - `recipes(name)` i `recipes(created_at)` wspierają sort.
- **Unikanie N+1**: endpoint nie pobiera profili/kategorii/tagów.

### 9. Kroki implementacji
1. **Dodać DTO pod Sidebar**:
    - plik: `supabase/functions/collections/collections.types.ts`
    - dodać `RecipeSidebarListItemDto` oraz `GetCollectionRecipesResponseDto` (albo nazwy analogiczne do reszty projektu).
2. **Dodać walidację query dla `GET /collections/{id}/recipes`**:
    - plik: `supabase/functions/collections/collections.handlers.ts`
    - dodać schema:
        - `limit`: 1..500 (default 500)
        - `sort`: `^(created_at|name)\.(asc|desc)$` (default `name.asc`)
3. **Dodać handler**:
    - plik: `supabase/functions/collections/collections.handlers.ts`
    - `handleGetCollectionRecipes(req, collectionId)`:
        - auth: `getAuthenticatedContext(req)`
        - parse query → `limit`, `sortField`, `sortDirection`
        - call serwisu → zwrócić `200` z `GetCollectionRecipesResponseDto`
4. **Dodać routing (ważna kolejność)**:
    - plik: `supabase/functions/collections/collections.handlers.ts`
    - w `collectionsRouter` w bloku dla `^\/(\d+)\/recipes$` obsłużyć:
        - `GET` → `handleGetCollectionRecipes`
        - `POST` → istniejące `handleAddRecipeToCollection`
      (dłuższe/more specific route już istnieje dla `DELETE /:collectionId/recipes/:recipeId` i musi zostać “pierwsze”.)
5. **Dodać serwis `getCollectionRecipes(...)`**:
    - plik: `supabase/functions/collections/collections.service.ts`
    - logika:
        - verify kolekcję (owner check),
        - count total (nieusunięte),
        - fetch z `recipes` + `recipe_collections!inner`:
            - filtry: `recipe_collections.collection_id = collectionId`, `deleted_at IS NULL`
            - select: `id,name,image_path`
            - sort + tie-breaker
            - range 0..limit-1
        - zbudować `pageInfo` i response.
6. **Skorygować `GET /collections/{id}` (stabilny limit + sort)**:
    - plik: `supabase/functions/collections/collections.service.ts`
    - zmienić strategię pobierania, aby:
        - nie limitować “losowych” `recipe_id` z `recipe_collections` przed sortowaniem,
        - tylko raz pobrać przepisy z joinem + sortowaniem i dopiero potem ograniczyć do `limit`.
      (To utrzymuje obecne DTO `RecipeListItemDto`, ale naprawia poprawność sortowania i `truncated`.)
7. **Testy manualne (lokalnie)**:
    - uruchomić: `supabase functions serve collections`
    - przypadki:
        - brak auth → 401,
        - zły `id` / `limit` / `sort` → 400,
        - kolekcja nie należy do usera → 404,
        - kolekcja z 0 przepisów → 200 + `data: []`,
        - sort `name.asc` / `created_at.desc` i stabilność (tie-breaker id),
        - `truncated=true` gdy przekroczono limit.

