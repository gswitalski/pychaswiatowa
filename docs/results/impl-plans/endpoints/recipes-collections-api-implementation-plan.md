# API Endpoints Implementation Plan: GET /recipes/{id} (zmiana) + PUT /recipes/{id}/collections (nowe)

## 1. Przegląd punktu końcowego

Ten plan obejmuje wdrożenie zmian związanych z modalem **„Dodaj do kolekcji” (multi-select checkboxy)**:

- **`GET /recipes/{id}` (zmiana kontraktu)**: odpowiedź ma zawierać `collection_ids: integer[]` (może być puste) w celu pre-selekcji checkboxów w modalu.
- **`PUT /recipes/{id}/collections` (nowy endpoint)**: **atomowe** i **idempotentne** ustawienie docelowej listy kolekcji (owned by user), które mają zawierać przepis; wspiera stan **0 kolekcji**.
- **`POST /collections/{id}/recipes` (zmiana dokumentacyjna)**: dopisek, że dla checkboxowego modala preferowany jest `PUT /recipes/{id}/collections` (bez zmian implementacyjnych, o ile endpoint już działa).

Założenia domenowe i DB:
- relacja wiele-do-wielu: `recipes` ↔ `collections` przez tabelę łączącą `recipe_collections (recipe_id, collection_id)`.
- miękkie usuwanie przepisów: wszystkie odczyty muszą uwzględniać `recipes.deleted_at IS NULL`.

Technologia:
- Supabase Edge Functions (TypeScript/Deno), architektura modularna: `index.ts` (routing) + `recipes.handlers.ts` (walidacja/response) + `recipes.service.ts` (logika biznesowa/DB).

## 2. Szczegóły żądania

### 2.1 `GET /recipes/{id}` (zmiana)

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/recipes/{id}` (w Supabase: `/functions/v1/recipes/{id}`)
- **Parametry**:
  - **Wymagane**:
    - `id` (path): `integer` (ID przepisu)
  - **Opcjonalne**: brak
- **Request Body**: brak

### 2.2 `PUT /recipes/{id}/collections` (nowe)

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/recipes/{id}/collections` (w Supabase: `/functions/v1/recipes/{id}/collections`)
- **Parametry**:
  - **Wymagane**:
    - `id` (path): `integer` (ID przepisu)
  - **Opcjonalne**: brak
- **Request Body (JSON)**:

```json
{
    "collection_ids": [1, 2, 3]
}
```

Uwagi:
- `collection_ids` może być pustą tablicą `[]` (oznacza „usuń przepis ze wszystkich moich kolekcji”).
- `collection_ids` musi zawierać **unikalne** dodatnie liczby całkowite.

## 3. Wykorzystywane typy

### 3.1 Frontend/shared (kontrakt REST) — `shared/contracts/types.ts`

- **Zmiana**: rozszerzyć DTO zwracane przez `GET /recipes/{id}` o:
  - `collection_ids: number[]`

Rekomendacje (jedna z opcji):
- dodać pole `collection_ids: number[]` do istniejącego `RecipeDetailDto`, albo
- wprowadzić nowy typ, np. `RecipeDetailWithCollectionsDto = RecipeDetailDto & { collection_ids: number[] }` (mniej ryzykowne dla istniejących miejsc użycia).

- **Nowe** (dla `PUT /recipes/{id}/collections`):
  - `SetRecipeCollectionsCommand`:
    - `collection_ids: number[]`
  - `SetRecipeCollectionsResponseDto`:
    - `recipe_id: number`
    - `collection_ids: number[]`
    - `added_ids: number[]`
    - `removed_ids: number[]`

### 3.2 Backend (Edge Function) — `supabase/functions/recipes/*`

- **Zmiana**:
  - rozszerzyć backendowy `RecipeDetailDto` (w `supabase/functions/recipes/recipes.service.ts`) analogicznie o `collection_ids: number[]` *lub* zwracać osobny obiekt w handlerze (np. `{ ...recipe, collection_ids }`), aby zachować spójność z kontraktem REST.

- **Nowe typy wejścia/wyjścia** (rekomendowane w `recipes.service.ts` lub `recipes.types.ts`, jeśli projekt ją wprowadzi):
  - `SetRecipeCollectionsInput` (wewnętrzny typ serwisu):
    - `recipeId: number`
    - `collectionIds: number[]`
    - `requesterUserId: string`
  - `SetRecipeCollectionsResult`:
    - `recipe_id: number`
    - `collection_ids: number[]`
    - `added_ids: number[]`
    - `removed_ids: number[]`

## 4. Szczegóły odpowiedzi

### 4.1 `GET /recipes/{id}`

#### Sukces
- **Kod**: `200 OK`
- **Payload**: jak dotychczasowy `RecipeDetailDto`, rozszerzony o:
  - `collection_ids: integer[]` — lista ID kolekcji **należących do zalogowanego użytkownika**, w których przepis aktualnie się znajduje.

#### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**: `id` nie jest liczbą całkowitą dodatnią
- **`401 Unauthorized`**: brak/niepoprawny JWT
- **`404 Not Found`**: przepis nie istnieje, jest soft-deleted, albo użytkownik nie ma do niego dostępu
- **`500 Internal Server Error`**: błąd nieoczekiwany

### 4.2 `PUT /recipes/{id}/collections`

#### Sukces
- **Kod**: `200 OK`
- **Payload**:

```json
{
    "recipe_id": 123,
    "collection_ids": [1, 2, 3],
    "added_ids": [2],
    "removed_ids": [5]
}
```

Definicje:
- `collection_ids`: finalny (docelowy) stan po operacji (posortowany rosnąco rekomendowane).
- `added_ids`: ID kolekcji, które zostały dopisane względem stanu poprzedniego.
- `removed_ids`: ID kolekcji, które zostały usunięte względem stanu poprzedniego.

#### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**:
  - `id` nie jest liczbą całkowitą dodatnią
  - brak `collection_ids`
  - `collection_ids` nie jest tablicą liczb całkowitych dodatnich
  - duplikaty w `collection_ids`
- **`401 Unauthorized`**: brak/niepoprawny JWT
- **`404 Not Found`**:
  - przepis nie istnieje / jest soft-deleted / nie jest dostępny dla użytkownika
  - którakolwiek z `collection_ids` nie istnieje lub nie należy do użytkownika (z punktu widzenia UX lepsze niż rozróżnianie 403/404)
- **`500 Internal Server Error`**: błąd nieoczekiwany

Uwagi:
- W istniejącym standardzie projektu `_shared/errors.ts` jest także `403 Forbidden` oraz `409 Conflict`. Jeżeli implementacja rozróżnia „nie istnieje” vs „nie masz dostępu”, dopuszczalne jest użycie `403`. W MVP rekomendowane jest **spójne** mapowanie na `404`, żeby nie ujawniać istnienia zasobów.

## 5. Przepływ danych

### 5.1 `GET /recipes/{id}` (z `collection_ids`)

1. Klient wysyła `GET /recipes/{id}` z `Authorization: Bearer <JWT>`.
2. `supabase/functions/recipes/index.ts` obsługuje CORS i deleguje do `recipesRouter`.
3. `recipes.handlers.ts`:
   - waliduje `id` (konwersja do int, guard clauses),
   - buduje kontekst auth (`getAuthenticatedContext`),
   - wywołuje `recipes.service.ts#getRecipeById(...)`,
   - pobiera `collection_ids` dla użytkownika:
     - zapytanie do `recipe_collections` filtrowane do kolekcji usera (`collections.user_id = auth.uid()`),
   - zwraca `200` z połączonym payloadem.

### 5.2 `PUT /recipes/{id}/collections` (atomowe ustawienie)

1. Klient wysyła `PUT /recipes/{id}/collections` z body `{ collection_ids: [...] }`.
2. `recipes.handlers.ts`:
   - waliduje `id` i body Zod (w tym duplikaty i integer-only),
   - tworzy kontekst auth,
   - wywołuje `recipes.service.ts#setRecipeCollections(...)`.
3. `recipes.service.ts`:
   - **precondition**: sprawdza dostęp do przepisu (i `deleted_at IS NULL`).
   - waliduje, że wszystkie `collection_ids` istnieją i należą do usera.
   - odczytuje aktualny stan relacji (current IDs).
   - wylicza różnice: `added = target - current`, `removed = current - target`.
   - wykonuje aktualizację **atomowo**:
     - preferowane: transakcja (jeśli dostępna) albo pojedyncza funkcja RPC w Postgres,
     - alternatywnie: kolejność operacji + obsługa błędów tak, aby nie zostawić częściowego stanu (w praktyce: RPC/transaction jest rozwiązaniem docelowym).
   - zwraca finalny stan + `added_ids`, `removed_ids`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: oba endpointy są prywatne — wymagają JWT (`Authorization: Bearer`).
- **Autoryzacja i RLS**:
  - `collections` zawsze muszą być **owned by user** (`collections.user_id = auth.uid()`).
  - dostęp do przepisu dla `PUT /recipes/{id}/collections`:
    - minimalnie: przepis musi być dostępny do odczytu (np. owner lub publiczny — zgodnie z założeniami aplikacji „my_recipes”).
  - Uwaga projektowa: w `DB Plan` polityki junction mogą wymagać własności przepisu. Jeśli wymaganiem jest dodawanie **publicznych** przepisów innych autorów do własnych kolekcji, trzeba:
    - **zaktualizować RLS** dla `recipe_collections` (INSERT/DELETE) tak, aby dopuszczały przypadek `recipes.visibility = 'PUBLIC'` (oraz `deleted_at IS NULL`) przy `collections.user_id = auth.uid()`, albo
    - wykonać operację poprzez **RPC/security definer** lub klienta na **service role** i w Edge Function zaimplementować walidację uprawnień (bardziej złożone, ale w pełni kontrolowane).
- **Walidacja wejścia**:
  - `id`: integer > 0
  - `collection_ids`: `number[]`, int > 0, brak duplikatów, limit rozmiaru (rekomendacja: np. max 200) aby ograniczyć nadużycia/DoS.
- **Ochrona przed enumeracją zasobów**:
  - preferować `404` dla „brak dostępu” (zamiast 403), jeśli to zgodne z resztą API.
- **Logging**:
  - minimalnie `info` dla operacji oraz `warn/error` dla błędów, bez logowania tokenów/pełnych payloadów.

## 7. Obsługa błędów

### Strategia w projekcie
- używać `ApplicationError` z `supabase/functions/_shared/errors.ts` i zwracać błędy przez `handleError()`.
- błędy walidacji Zod mapować na `ApplicationError('VALIDATION_ERROR', message)`.

### Scenariusze błędów i statusy

`GET /recipes/{id}`:
- `400`: niepoprawny `id`
- `401`: brak/niepoprawny JWT
- `404`: brak przepisu / soft-deleted / brak dostępu
- `500`: błąd nieoczekiwany

`PUT /recipes/{id}/collections`:
- `400`: niepoprawny `id` lub body (`collection_ids`)
- `401`: brak/niepoprawny JWT
- `404`: przepis niedostępny, albo dowolna kolekcja z listy nie istnieje/nie należy do usera
- `500`: błąd nieoczekiwany

### Rejestrowanie błędów w tabeli
- W aktualnym repo brak opisu tabeli błędów: **rejestracja w tabeli nie dotyczy** (źródłem diagnostyki są logi Supabase + `_shared/logger.ts`).

## 8. Wydajność

- `GET /recipes/{id}`:
  - dodatkowe zapytanie o `collection_ids` powinno być lekkie (po indeksach na `recipe_collections.collection_id` i PK na junction).
  - rekomendacja: zwracać tylko ID (bez pełnych obiektów kolekcji) — zgodnie z wymaganiem modala.

- `PUT /recipes/{id}/collections`:
  - operacja różnicowa: nie „delete all + insert all” bez potrzeby, tylko zmiany (mniej write’ów).
  - przy większej liczbie kolekcji preferować 1–2 zapytania set-based (IN/NOT IN) + transakcja.
  - docelowo najlepsze będzie RPC (jedna funkcja w Postgres) zapewniające atomowość i mniejszy narzut round-tripów.

## 9. Kroki implementacji

1. **Kontrakt DTO (shared)**:
   - dodać `collection_ids` do DTO odpowiedzi `GET /recipes/{id}`,
   - dodać `SetRecipeCollectionsCommand` i `SetRecipeCollectionsResponseDto` w `shared/contracts/types.ts`.
2. **Routing** (`supabase/functions/recipes/recipes.handlers.ts`):
   - dodać rozpoznanie ścieżki `/recipes/{id}/collections` **przed** ogólnym `/recipes/{id}`,
   - dodać handler: `handleSetRecipeCollections(req, recipeId)`.
3. **Walidacja (handlers)**:
   - schema Zod dla body `{ collection_ids: number[] }` z:
     - `.array(z.number().int().positive())`
     - walidacją duplikatów (np. `refine` na unikalność),
     - opcjonalnym limitem długości listy.
4. **Service (business logic)**:
   - dodać funkcję np. `setRecipeCollections({ recipeId, collectionIds, requesterUserId })`.
   - implementacja różnicowa: odczyt stanu bieżącego, wyliczenie `added/removed`, wykonanie zmian atomowo.
5. **Atomowość**:
   - preferowane: dodać RPC w Postgres (w `supabase/migrations/*`) np. `set_recipe_collections(recipe_id bigint, collection_ids bigint[])` i wywołać ją z serwisu,
   - alternatywnie: transakcja (jeśli używana w projekcie) — dopuszczalne tylko jeśli faktycznie gwarantuje rollback.
6. **`GET /recipes/{id}`**:
   - rozszerzyć `getRecipeById` lub handler o pobranie `collection_ids` (tylko user-owned),
   - upewnić się, że soft-deleted nie przechodzą.
7. **RLS / uprawnienia**:
   - jeśli wymagamy dodawania publicznych przepisów innych autorów do własnych kolekcji: zaktualizować polityki RLS dla `recipe_collections` (INSERT/DELETE) lub zastosować RPC/security definer.
8. **Logowanie i błędy**:
   - logi `info` dla rozpoczęcia i wyniku operacji (z liczbą `added/removed`),
   - błędy jako `ApplicationError` + `handleError`.
9. **Manualne testy lokalne**:
   - `supabase functions serve recipes`
   - scenariusze:
     - `PUT` z `[]` usuwa wszystkie przypisania,
     - `PUT` z tą samą listą jest idempotentny (`added_ids` i `removed_ids` puste),
     - `PUT` z nieistniejącą/nie-swoją kolekcją → `404`,
     - `GET /recipes/{id}` zwraca prawidłowe `collection_ids` do pre-selekcji.


