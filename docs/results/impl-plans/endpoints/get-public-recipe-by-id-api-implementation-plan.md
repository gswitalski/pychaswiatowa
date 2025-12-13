# API Endpoints Implementation Plan: GET /public/recipes/{id}

## 1. Przegląd punktu końcowego
Endpoint `GET /public/recipes/{id}` udostępnia **anonimowym użytkownikom** (bez JWT) możliwość pobrania **pełnych szczegółów** pojedynczego przepisu, ale wyłącznie gdy:
- przepis ma `visibility = 'PUBLIC'`
- przepis nie jest „miękko usunięty” (`deleted_at IS NULL`)

Endpoint jest przeznaczony pod publiczne, udostępnialne i SEO-friendly strony szczegółów przepisu (frontend może mieć slug w URL, ale API pobiera dane po numerycznym `id`).

Wdrożenie odbywa się w Supabase Edge Functions (TypeScript) zgodnie z zasadami modularnymi:
- `index.ts`: routing + obsługa błędów na najwyższym poziomie
- `*.handlers.ts`: walidacja wejścia + format odpowiedzi
- `*.service.ts`: logika biznesowa + zapytania do DB

## 2. Szczegóły żądania
- Metoda HTTP: **GET**
- Struktura URL: **/public/recipes/{id}**
  - Implementacyjnie (Edge Functions): zalecany katalog funkcji `supabase/functions/public/` z routingiem wewnętrznym `/recipes/{id}` (runtime URL: `/functions/v1/public/recipes/{id}`).

### Parametry
- Wymagane:
  - `id` (path): **numeryczny identyfikator przepisu** (`bigint`)
- Opcjonalne: brak

### Nagłówki
- `Authorization`: **niewymagany** (endpoint publiczny)
- `Content-Type`: nie dotyczy (brak body)

## 3. Wykorzystywane typy
### DTO (kontrakty)
Typy bazowe istnieją w `shared/contracts/types.ts`. Dla tego endpointu rekomendowane jest użycie istniejących oraz dodanie jednego nowego DTO publicznego.

- Istniejące:
  - `CategoryDto`
  - `ProfileDto` (do autora: `{ id, username }`)
  - `RecipeContent`, `RecipeContentItem` (dla `ingredients` i `steps`)

- Nowe (do dodania w `shared/contracts/types.ts`):
  - `PublicRecipeDetailDto`

Proponowana struktura `PublicRecipeDetailDto` (zgodna z `009 API plan.md`):
- `id: number`
- `name: string`
- `description: string | null`
- `image_path: string | null`
- `visibility: 'PUBLIC'`
- `category: CategoryDto | null`
- `ingredients: RecipeContent`
- `steps: RecipeContent`
- `tags: string[]`
- `author: ProfileDto`
- `created_at: string`

### Modele wejścia
Brak body; wejściem jest parametr ścieżki.
- (opcjonalnie) `GetPublicRecipeByIdParams`:
  - `id: number`

## 4. Szczegóły odpowiedzi
### Sukces
- Kod: **200 OK**
- Payload: obiekt `PublicRecipeDetailDto`

Przykład (na podstawie `009 API plan.md`):

```json
{
  "id": 1,
  "name": "Apple Pie",
  "description": "A classic dessert.",
  "image_path": "path/to/image.jpg",
  "visibility": "PUBLIC",
  "category": { "id": 2, "name": "Dessert" },
  "ingredients": [
    { "type": "header", "content": "Dough" },
    { "type": "item", "content": "500g flour" }
  ],
  "steps": [
    { "type": "header", "content": "Preparation" },
    { "type": "item", "content": "Mix flour and water." }
  ],
  "tags": ["sweet", "baking"],
  "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
  "created_at": "2023-10-27T10:00:00Z"
}
```

### Błędy
- **400 Bad Request**: nieprawidłowy `id` (np. nie jest liczbą całkowitą dodatnią)
- **404 Not Found**: przepis nie istnieje, jest soft-usunięty lub nie jest publiczny
- **500 Internal Server Error**: błąd po stronie serwera (DB/env/mapowanie)

Uwaga: `401` nie jest spodziewane (endpoint publiczny).

## 5. Przepływ danych
1. `index.ts` (funkcja `public`):
   - loguje request (method + url)
   - obsługuje CORS (OPTIONS)
   - deleguje do routera (np. `publicRouter(req)`)

2. `public.handlers.ts`:
   - dopasowuje ścieżkę `/recipes/([^/]+)` i metodę `GET`
   - ekstrahuje `id` z URL i waliduje je (Zod):
     - integer
     - `min(1)`
   - wywołuje serwis: `getPublicRecipeById({ id })`
   - mapuje wynik na `PublicRecipeDetailDto`

3. `public.service.ts`:
   - pobiera dane z DB, **twardo wymuszając** filtry:
     - `visibility = 'PUBLIC'`
     - `deleted_at IS NULL`
   - buduje DTO i zwraca do handlera

### Źródło danych (rekomendacja)
- Zalecane: użyć widoku `recipe_details` (agreguje kategorię/tags i unika N+1).

### Pobranie autora (ważne dla tego endpointu)
DB plan opisuje `recipe_details` jako widok agregujący kategorie/tagi/kolekcje, ale nie gwarantuje obecności danych autora. Są dwie sensowne ścieżki:

- **A (szybka, bez zmiany widoku): 2 zapytania**
  1) pobierz przepis (z `recipe_details` lub `recipes` + agregaty) i odczytaj `user_id`
  2) pobierz `profiles` po `id = user_id` i zmapuj na `ProfileDto`

- **B (zalecana docelowo): rozszerzyć widok**
  - dodać do definicji `recipe_details` join na `profiles` (`recipes.user_id = profiles.id`) i wystawić `author_username` (i ewentualnie `author_id`) w jednym zapytaniu.

Plan implementacji endpointu zakłada wariant A (mniej zależności od migracji), z rekomendacją przejścia na B dla lepszej wydajności.

## 6. Względy bezpieczeństwa
- **Brak autoryzacji**: endpoint dostępny bez JWT.
- **Ochrona przed wyciekiem danych** (krytyczne, jeśli użyjemy service role / bypass RLS):
  - zawsze filtrować `visibility='PUBLIC'` oraz `deleted_at IS NULL`
  - zwracać wyłącznie pola z `PublicRecipeDetailDto` (nie zwracać m.in. `user_id`, `updated_at`, `collections`, itp.)
- **Walidacja parametru `id`**:
  - wyłącznie liczba całkowita dodatnia
- **CORS**:
  - nagłówki spójne z resztą API
  - dopuszczone metody: `GET, OPTIONS`
- **Cache** (opcjonalnie, ale wskazane dla publicznych stron):
  - rozważyć `Cache-Control: public, max-age=60` (lub inne wartości zależnie od wymagań świeżości)
- **Rate limiting** (opcjonalnie):
  - rozważyć limitowanie po IP (publiczny endpoint może być scrapingowany)

## 7. Obsługa błędów
### Scenariusze i kody
- `200 OK`: przepis istnieje i jest publiczny
- `400 Bad Request`:
  - `id` nie jest poprawnym dodatnim integerem
- `404 Not Found`:
  - brak rekordu o danym `id`
  - rekord nie jest publiczny (`visibility != 'PUBLIC'`)
  - rekord soft-usunięty (`deleted_at IS NOT NULL`)
- `500 Internal Server Error`:
  - błąd konfiguracji (np. brak `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`)
  - błąd DB
  - błąd mapowania/parsowania JSONB

### Rejestrowanie błędów
- W DB planie nie ma obecnie dedykowanej tabeli do logowania błędów.
- Stosować projektowy logger + spójny mechanizm `ApplicationError`/`handleError` z `supabase/functions/_shared/errors.ts`.
- (Opcjonalnie w przyszłości) dodać tabelę typu `api_error_logs` i logować wybrane zdarzenia 5xx.

## 8. Wydajność
- **Źródło danych**: preferować `recipe_details` (mniej joinów po stronie aplikacji).
- **1 vs 2 zapytania**:
  - wariant A (2 zapytania) jest OK dla MVP
  - wariant B (rozszerzony widok) jest lepszy dla skalowania
- **Minimalny SELECT**:
  - pobierać tylko potrzebne pola (szczególnie przy JSONB)
- **Stałe filtrowanie**:
  - `visibility='PUBLIC'` i `deleted_at IS NULL` powinny być warunkami w DB (view/policy) albo w każdym zapytaniu serwisu

## 9. Kroki implementacji
1. **Ustalić routing w funkcji `public`**:
   - jeśli funkcja `supabase/functions/public/` już istnieje (dla `GET /public/recipes`), dodać obsługę trasy `/recipes/{id}`.
   - jeśli nie istnieje: utworzyć `supabase/functions/public/` z plikami `index.ts`, `public.handlers.ts`, `public.service.ts`.

2. **Dodać/uzgodnić kontrakt DTO**:
   - dodać `PublicRecipeDetailDto` do `shared/contracts/types.ts`.

3. **Walidacja wejścia (Zod) w handlerze**:
   - schema dla `id`:
     - parse z string -> number
     - `int()` i `min(1)`
   - w razie błędu: zwrócić `400`.

4. **Implementacja serwisu `getPublicRecipeById`**:
   - użyć klienta DB zgodnie z obranym wariantem dostępu:
     - **wariant A (szybki)**: klient z service role key (bypass RLS) i ręczne filtry PUBLIC-only
     - **wariant B**: anon key + DB polityki/granty umożliwiające odczyt tylko `PUBLIC`
   - pobrać rekord po `id` z filtrami:
     - `.eq('id', id)`
     - `.eq('visibility', 'PUBLIC')`
     - filtr `deleted_at IS NULL` (w zależności od kolumny dostępnej w widoku)
   - jeśli brak danych: rzucić/zwrocić błąd mapowany na `404`.

5. **Pobranie autora (wariant A domyślny)**:
   - odczytać `user_id` z danych przepisu
   - pobrać `profiles` po `id = user_id` i zmapować do `ProfileDto`
   - jeśli profil nie istnieje: traktować jako błąd serwera (`500`) lub defensywnie ukryć autora (decyzja projektowa; rekomendacja: `500`, bo dane są niespójne).

6. **Mapowanie na `PublicRecipeDetailDto`**:
   - `category`: z pól widoku (`category_id`, `category_name`) lub `null`
   - `ingredients`/`steps`: jako `RecipeContent`
   - `tags`: z JSONB tags wyciągnąć `name` i zwrócić `string[]`
   - `visibility`: zawsze `PUBLIC`

7. **Obsługa błędów i logowanie**:
   - spiąć z `ApplicationError` i globalnym handlerem błędów w `index.ts`.

8. **Testy manualne (minimum)**:
   - `GET /public/recipes/1` dla przepisu `PUBLIC` => `200`
   - `GET /public/recipes/999999` => `404`
   - `GET /public/recipes/abc` => `400`
   - przepis `PRIVATE/SHARED` pod tym samym ID => `404`
   - przepis z `deleted_at != null` => `404`
