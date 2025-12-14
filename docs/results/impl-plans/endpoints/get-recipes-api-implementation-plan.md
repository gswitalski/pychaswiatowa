# API Endpoints Implementation Plan: GET /recipes

## 1. Przegląd punktu końcowego
Endpoint zwraca paginowaną listę przepisów dla użytkownika uwierzytelnionego.

Zmiana funkcjonalna obejmuje:
- parametr `view` (`owned` | `my_recipes`) obsługujący widok „Moje przepisy” jako: **moje przepisy + publiczne przepisy innych autorów**, o ile znajdują się w **co najmniej jednej mojej kolekcji**;
- rozszerzenie odpowiedzi listy o pola pomocnicze do UI: `is_owner`, `in_my_collections`, `author`.

## 2. Szczegóły żądania
- **Metoda HTTP**: `GET`
- **Struktura URL (Supabase Edge Function)**: `/functions/v1/recipes`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
- **Parametry**:
    - **Wymagane**: brak
    - **Opcjonalne**:
        - `page` (integer, domyślnie: `1`, min: `1`)
        - `limit` (integer, domyślnie: `20`, min: `1`, max: `100`)
        - `sort` (string, domyślnie: `created_at.desc`)
            - format: `<field>.<direction>`
            - dozwolone `field`: `name` | `created_at` | `updated_at`
            - dozwolone `direction`: `asc` | `desc`
        - `view` (string, domyślnie: `owned`)
            - dozwolone: `owned` | `my_recipes`
        - `filter[category_id]` (integer)
        - `filter[tags]` (string) — lista nazw tagów oddzielonych przecinkami (np. `"ciasta,deser"`)
        - `search` (string) — tekst wyszukiwania (zalecenie walidacji: trim; opcjonalnie min 2 znaki, aby ograniczyć koszt zapytań)

## 3. Wykorzystywane typy
- **Odpowiedź**: `PaginatedResponseDto<RecipeListItemDto>`
- **DTO**: `RecipeListItemDto` (kontrakt współdzielony) musi zostać rozszerzony o:
    - `visibility: 'PRIVATE' | 'SHARED' | 'PUBLIC'`
    - `is_owner: boolean`
    - `in_my_collections: boolean`
    - `author: { id: string; username: string }`

Rekomendacja: utrzymać jeden kontrakt listy dla `GET /recipes` (nie mnożyć DTO na `owned`/`my_recipes`), bo pola pomocnicze są spójne dla obu widoków.

## 4. Szczegóły odpowiedzi
- **200 OK**

Przykładowy payload:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Szarlotka",
      "image_path": "path/to/image.jpg",
      "visibility": "PUBLIC",
      "is_owner": true,
      "in_my_collections": false,
      "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
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

- **Odpowiedzi błędów**:
    - `400 Bad Request` — nieprawidłowe parametry query (format `sort`, wartości `view`, itp.)
    - `401 Unauthorized` — brak/niepoprawny JWT
    - `500 Internal Server Error` — błąd serwera / błąd bazy

## 5. Przepływ danych
1. Żądanie trafia do `supabase/functions/recipes/index.ts` i jest kierowane do `recipesRouter`.
2. `recipesRouter` wywołuje handler `handleGetRecipes`.
3. Handler:
    - pobiera kontekst uwierzytelnienia (`getAuthenticatedContext`) i userId;
    - parsuje query params;
    - waliduje i normalizuje dane wejściowe schematem Zod (w tym `view`).
4. Handler przekazuje zwalidowane parametry do warstwy serwisowej `getRecipes`.
5. Serwis buduje zapytanie w zależności od `view`:

   **Rekomendowany wariant (najbardziej poprawny dla paginacji + deduplikacji): DB/RPC**
   - dodać dedykowaną funkcję SQL/RPC (np. `get_recipes_list`) która:
        - filtruje `deleted_at IS NULL`;
        - dla `owned`: `recipes.user_id = auth.uid()` (lub `p_user_id`);
        - dla `my_recipes`: `recipes.user_id = p_user_id` **lub** (`recipes.visibility = 'PUBLIC'` i przepis jest w co najmniej jednej kolekcji użytkownika);
        - wylicza `is_owner` i `in_my_collections` w SQL;
        - zwraca `author` (join do `profiles` po `recipes.user_id`);
        - zapewnia deduplikację (np. `DISTINCT ON (recipes.id)`);
        - implementuje sort/paginację i zwraca także `totalItems` (np. `count(*) over()` lub osobny count).

   **Alternatywa (bez zmian w DB):**
   - możliwa dla `owned` (obecna implementacja), ale dla `my_recipes` trudno utrzymać poprawną paginację/sortowanie po złączeniu dwóch zbiorów; traktować jako rozwiązanie tymczasowe.

6. Serwis mapuje rekordy do `RecipeListItemDto` i zwraca `PaginatedResponseDto`.
7. Handler zwraca `200`.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: wymagany JWT, walidowany przez `getAuthenticatedContext`.
- **Autoryzacja i ochrona danych**:
    - dla `view=owned`: brak ryzyka wycieku, jeśli logika filtruje po `user_id`/RLS.
    - dla `view=my_recipes`: krytyczne jest, aby dołączyć wyłącznie przepisy **PUBLIC** innych autorów i tylko te, które są powiązane z kolekcjami użytkownika.
- **Ochrona przed wstrzyknięciami**:
    - `sort.field` musi być whitelistowany (jak obecnie);
    - `view` tylko z enumeracji;
    - `filter[category_id]` jako liczba dodatnia lub `undefined`;
    - `filter[tags]` trim + filtr pustych elementów.
- **Profil autora**:
    - jeśli RLS na `profiles` ogranicza odczyt, należy zapewnić bezpieczny mechanizm dostępu do publicznych pól autora (np. policy pozwalające czytać `id, username` lub dedykowany widok/funkcję).

## 7. Wydajność
- **Deduplikacja w SQL**: dla `view=my_recipes` wymagana, bo ten sam przepis może należeć do wielu kolekcji.
- **Indeksy**:
    - `recipes(created_at)`, `recipes(name)`, `recipes(user_id)`, oraz indeksy na junction tables (`recipe_collections(collection_id)`) mają kluczowe znaczenie.
- **Unikanie N+1**:
    - `author` powinien być dołączany w jednym zapytaniu (SQL join / widok / RPC), nie per rekord.
- **Limit**: twardy max (`MAX_LIMIT`) musi pozostać.

## 8. Kroki implementacji
1. **Kontrakty typów (frontend/backend kontrakt)**
    - zaktualizować `shared/contracts/types.ts`:
        - rozszerzyć `RecipeListItemDto` o `is_owner`, `in_my_collections`, `author`.
        - (opcjonalnie) dodać typ `RecipesView = 'owned' | 'my_recipes'`.
2. **Walidacja query w handlerze** (`supabase/functions/recipes/recipes.handlers.ts`)
    - dodać do `getRecipesQuerySchema` pole `view` z default `owned` i enumem (`owned|my_recipes`).
3. **Serwis listy** (`supabase/functions/recipes/recipes.service.ts`)
    - rozszerzyć `GetRecipesOptions` o `view` i `requesterUserId` (lub przekazywać userId osobno);
    - rozszerzyć `RecipeListItemDto` w serwisie o nowe pola i `author`.
4. **Warstwa danych dla `view=my_recipes`**
    - wdrożyć rekomendowaną funkcję SQL/RPC (w bazie): `get_recipes_list` (lub analogiczną) z:
        - wejściem: `view`, paginacja, sort, filtry, `p_user_id`;
        - wyjściem: rekordy listy + licznik całkowity.
    - w serwisie wywołać RPC i zmapować wynik na `PaginatedResponseDto`.
5. **Logowanie**
    - dodać logi `info`/`debug` dla `view`, filtrów i statystyk paginacji; logi błędów w `error`.
    - rejestrowanie błędów w tabeli: w aktualnym kodzie brak takiego mechanizmu — pozostaje logowanie do loggera.
6. **Walidacja końcowa / smoke testy**
    - `GET /recipes?view=owned` zwraca tylko moje przepisy, `is_owner=true`.
    - `GET /recipes?view=my_recipes` zwraca: moje + cudze PUBLIC z moich kolekcji, bez duplikatów.
    - `filter[tags]` i `filter[category_id]` działają w obu widokach.
    - `author` jest obecny i poprawny dla cudzych przepisów.
