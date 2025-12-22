## API Endpoints Implementation Plan: GET /collections/{id}

## 1. Przegląd punktu końcowego

Endpoint `GET /collections/{id}` zwraca szczegóły pojedynczej kolekcji należącej do zalogowanego użytkownika oraz **listę przepisów tej kolekcji w jednym batchu** (bez paginacji UI), z bezpiecznym limitem (`limit`, domyślnie **500**) i metadanymi `pageInfo.truncated`, aby UI mogło poinformować użytkownika, gdy lista została technicznie ucięta.

- **Charakter**: prywatny (wymaga JWT z Supabase Auth).
- **Zasady domenowe**:
    - kolekcja musi należeć do zalogowanego użytkownika (`collections.user_id = auth.uid()`).
    - przepisy muszą respektować soft delete (`recipes.deleted_at IS NULL`).
    - sortowanie ma być stabilne (domyślnie `created_at.desc`).

## 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/collections/{id}`
- **Nagłówki**:
    - **Wymagane**: `Authorization: Bearer <JWT>`
    - **Opcjonalne**: `Content-Type` (brak body)

### Parametry

- **Parametry ścieżki (wymagane)**:
    - **`id`**: `number` (dodatnia liczba całkowita) — identyfikator kolekcji.

- **Query params (opcjonalne)**:
    - **`limit`**: `number`
        - domyślnie: **500**
        - zakres: `1..500`
        - rola: limit bezpieczeństwa na liczbę przepisów w odpowiedzi.
    - **`sort`**: `string`
        - domyślnie: **`created_at.desc`**
        - dozwolone pola: `created_at`, `name`
        - dozwolone kierunki: `asc`, `desc`
        - rola: sortowanie listy przepisów w batchu (musi być stabilne).

- **Request Body**: brak

## 3. Wykorzystywane typy

### DTO (response)

Wspólne kontrakty (frontend/backend): `shared/contracts/types.ts`

- **`CollectionDetailDto`** (wymaga aktualizacji, bo obecnie zakłada paginację `pagination`)
    - `id: number`
    - `name: string`
    - `description: string | null`
    - `recipes: { data: RecipeListItemDto[]; pageInfo: CollectionRecipesPageInfoDto }`

- **`RecipeListItemDto`** (już istnieje w `shared/contracts/types.ts`)
    - wymagane pola dla kart przepisów: m.in. `id`, `name`, `image_path`, `created_at`, `visibility`, `is_owner`, `in_my_collections`, `author`, `category_id`, `category_name`, `servings`, `is_termorobot`.

Nowy typ (do dodania do kontraktów wspólnych oraz do `supabase/functions/collections/collections.types.ts`):

```ts
export interface CollectionRecipesPageInfoDto {
    limit: number;
    returned: number;
    truncated: boolean;
}
```

### Command modele

Brak (endpoint tylko do odczytu).

## 4. Szczegóły odpowiedzi

### Sukces: `200 OK`

Struktura odpowiedzi:

- `id`, `name`, `description`
- `recipes.data`: lista przepisów (maksymalnie `limit`)
- `recipes.pageInfo`:
    - `limit`: efektywnie zastosowany limit
    - `returned`: liczba zwróconych elementów w `data`
    - `truncated`: `true`, jeśli kolekcja zawiera więcej przepisów niż `limit`

Przykład (kształt):

```json
{
    "id": 1,
    "name": "Christmas Dishes",
    "description": "Recipes for the holidays.",
    "recipes": {
        "data": [
            { "id": 15, "name": "Spaghetti", "image_path": null, "created_at": "2023-10-27T10:00:00Z" }
        ],
        "pageInfo": {
            "limit": 500,
            "returned": 40,
            "truncated": false
        }
    }
}
```

### Błędy

Zwracane jako JSON (spójnie z `_shared/errors.ts`):

- `400 Bad Request` (walidacja danych wejściowych)
- `401 Unauthorized` (brak/nieprawidłowy JWT)
- `404 Not Found` (kolekcja nie istnieje lub nie należy do użytkownika)
- `500 Internal Server Error` (błąd serwera)

Uwaga: w implementacji projektu występuje też `403 Forbidden` (mapowane przez `ApplicationError('FORBIDDEN', ...)`), ale w tym endpointcie zalecane jest **maskowanie zasobu** i zwracanie `404`, jeśli nie należy do użytkownika (ochrona przed IDOR).

## 5. Przepływ danych

### Warstwa routing/handler (`supabase/functions/collections/collections.handlers.ts`)

1. Odczyt i walidacja `id` z path (Zod: `int().positive()`).
2. Uwierzytelnienie: `getAuthenticatedContext(req)` → `{ client, user }`.
3. Walidacja query:
    - `limit`: `int().min(1).max(500).default(500)`
    - `sort`: enum/regex → mapowanie na `{ sortField, sortDirection }`
4. Wywołanie serwisu:
    - `getCollectionByIdBatch({ client, userId: user.id, collectionId, limit, sort })`
5. Odpowiedź `200` z `CollectionDetailDto` (po nowemu, z `pageInfo`).

### Warstwa serwisowa (`supabase/functions/collections/collections.service.ts`)

Happy path:

1. Pobierz kolekcję (`collections`) z filtrem `id` + `user_id`.
2. Pobierz `totalCount` przepisów w kolekcji (`recipe_collections`) — `count: 'exact', head: true`.
3. Pobierz przepisy w batchu:
    - pobierz listę `recipe_id` z `recipe_collections` dla danej kolekcji **wraz z sortowaniem po polach przepisów**:
        - wariant A (preferowany): jeden query z embedding do `recipes` (PostgREST relacja istnieje), `range(0, limit - 1)`, `order` po `recipes.created_at` lub `recipes.name`.
        - wariant B (bez embedding): najpierw `recipe_id` (range), potem `recipes` z `.in('id', ids)` + `.order(sortField)`; to upraszcza kod, ale może wymagać dopięcia stabilności (drugi `order('id')`).
    - zawsze filtruj `recipes.deleted_at IS NULL`.
4. Uzupełnij pola DTO:
    - `is_owner`: `recipe.user_id === userId`
    - `in_my_collections`: `true` (bo w kontekście tej kolekcji)
    - `author`: pobierz batchowo `profiles` dla unikalnych `user_id` (brak FK w typach → osobne zapytanie jak obecnie).
    - `category_name`: pobierz przez join do `categories` (FK istnieje) lub batchowe pobranie kategorii (zależnie od przyjętego wariantu query).
5. Zbuduj `pageInfo`:
    - `returned = recipes.length`
    - `truncated = (totalCount > limit)`

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany `Authorization: Bearer <JWT>`; brak/niepoprawny token → `401`.
- **Autoryzacja / ochrona przed IDOR**:
    - kolekcję filtrujemy po `user_id` (w serwisie) + RLS w DB.
    - jeśli `id` nie należy do usera → zwróć `404` (nie ujawniaj istnienia).
- **RLS i polityki** (krytyczne do weryfikacji przed wdrożeniem):
    - jeśli aplikacja ma wspierać kolekcje zawierające **publiczne przepisy innych autorów**, polityki RLS na `recipe_collections`/`recipes` muszą to umożliwiać (np. `SELECT` dla ownera kolekcji + `recipes.visibility='PUBLIC'`).
    - jeśli RLS nadal wymaga bycia właścicielem przepisu w `recipe_collections`, endpoint będzie zwracał tylko własne przepisy — to trzeba potwierdzić z docelowym schematem/politykami.
- **Walidacja wejścia**:
    - `id`, `limit`, `sort` walidowane Zod; odrzuć wartości spoza zakresów (`400`).
- **Ograniczenie rozmiaru odpowiedzi**:
    - twardy limit `<= 500` (wymóg zmiany) ogranicza payload i ryzyko DoS.

## 7. Wydajność

- **Brak paginacji UI**: endpoint może zwracać do 500 rekordów — należy dbać o selektywne `select` (tylko pola potrzebne przez `RecipeListItemDto`).
- **Unikanie N+1**:
    - profile autorów pobierać batchowo (`in('id', uniqueUserIds)`).
    - kategorie pobierać przez join (FK) albo batchowo po `category_id`.
- **Stabilne sortowanie**:
    - sortuj po głównym polu (`created_at`/`name`) + tie-breaker po `id` w tym samym kierunku, aby uniknąć “przeskakiwania” w UI.
- **Count query**:
    - count z `recipe_collections` jest szybki przy indeksie po `collection_id` (w DB Plan indeks jest przewidziany).

## 8. Kroki implementacji

1. **Aktualizacja kontraktów DTO**
    - Zaktualizuj `shared/contracts/types.ts`:
        - dodaj `CollectionRecipesPageInfoDto`
        - zmień `CollectionDetailDto.recipes` z `PaginatedResponseDto<RecipeListItemDto>` na `{ data: RecipeListItemDto[]; pageInfo: CollectionRecipesPageInfoDto }`
    - Upewnij się, że frontendowe użycia `CollectionDetailDto` są kompatybilne (UI ma czytać `pageInfo.truncated` i pokazać komunikat).

2. **Aktualizacja typów backendowych dla funkcji**
    - Zaktualizuj `supabase/functions/collections/collections.types.ts` analogicznie (lub importuj wspólne typy, jeśli projekt przyjmie taki standard).
    - Usuń/oznacz jako deprecated stare struktury `PaginationDetails/PaginatedRecipesDto` (dla tego endpointu).

3. **Walidacja query w handlerze**
    - W `supabase/functions/collections/collections.handlers.ts`:
        - usuń `page` z obsługi `GET /collections/{id}`
        - dodaj `limit` (1..500, default 500)
        - dodaj `sort` (whitelist: `created_at|name` i `asc|desc`, default `created_at.desc`)
    - Utrzymaj istniejący schemat walidacji `collectionIdSchema`.

4. **Nowa/zmieniona funkcja serwisowa**
    - W `supabase/functions/collections/collections.service.ts`:
        - zastąp dotychczasowe `getCollectionById(client, userId, collectionId, page, limit)` wersją batch:
            - np. `getCollectionById(client, userId, collectionId, limit, sort)`
        - wdroż pobranie `totalCount` + `recipes` (limit + sort + `deleted_at IS NULL`)
        - mapowanie do pełnego `RecipeListItemDto` (zgodnie z `shared/contracts/types.ts`)

5. **Mapowanie błędów i logowanie**
    - Pozostań przy `ApplicationError` + `handleError` (`_shared/errors.ts`).
    - Dodaj logi `logger.info/warn/error` w kluczowych punktach:
        - start request, parametry wejściowe
        - `collection not found`
        - `truncated=true` (debug/info)
        - błędy DB (`error.code`, `error.message`)
    - **Logowanie do tabeli błędów**: nie dotyczy (w projekcie brak mechanizmu persystentnego logowania błędów w DB; logi lecą do stdout/Edge logs).

6. **Scenariusze testowe (minimum)**
    - `200`:
        - kolekcja z 0 przepisów (`returned=0`, `truncated=false`)
        - kolekcja z `N < limit` (`truncated=false`)
        - kolekcja z `N > limit` (`returned=limit`, `truncated=true`)
        - `sort=name.asc` i `sort=created_at.desc`
    - `400`:
        - `limit=0`, `limit=999`, `sort=foo.bar`
    - `401`:
        - brak nagłówka `Authorization`
    - `404`:
        - nieistniejące `id`
        - `id` należące do innego użytkownika


