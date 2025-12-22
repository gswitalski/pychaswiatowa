## API Endpoints Implementation Plan: `GET /public/recipes/feed` oraz `GET /recipes/feed`

## 1. Przegląd punktu końcowego

Wprowadzamy dwa endpointy „load more” oparte o **cursor-based pagination**:

- **`GET /public/recipes/feed`**: publiczny feed przepisów do widoku `/explore` (anonimowo, z opcjonalną autoryzacją).
- **`GET /recipes/feed`**: prywatny feed przepisów do widoku `/my-recipies` (wymaga JWT), zachowuje semantykę `view` i filtrów z `GET /recipes`.

Oba endpointy:

- zwracają porcję danych (`limit`, domyślnie 12) oraz `pageInfo.hasMore` i `pageInfo.nextCursor`;
- mają zachować stabilne sortowanie (aby „load more” nie duplikował/nie gubił rekordów przy kolejnych batchach);
- nie zwracają klasycznych metryk paginacji stron (`totalPages`, `currentPage`) – zamiast tego opierają się o cursor.

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL (Supabase Edge Function)**: `/functions/v1/public/recipes/feed`
- **Nagłówki**:
    - **Wymagane**: brak
    - **Opcjonalne**: `Authorization: Bearer <JWT>` (jeśli podany i poprawny, endpoint może ustalić `in_my_collections`; jeśli podany i niepoprawny/wygaśnięty → `401`)
- **Parametry**:
    - **Wymagane**: brak
    - **Opcjonalne**:
        - `cursor` (string, opcjonalny): nieprzezroczysty token zwrócony jako `pageInfo.nextCursor`
        - `limit` (integer, domyślnie: `12`, min: `1`, max: `100`)
        - `sort` (string, domyślnie: `created_at.desc`)
            - format: `<field>.<direction>`
            - dozwolone `field`: `created_at` | `name`
            - dozwolone `direction`: `asc` | `desc`
        - `q` (string, opcjonalny): tekst wyszukiwania (trim; **min 2 znaki** jeśli podany)
        - `filter[termorobot]` (boolean): `true|false|1|0`

### 2.2 `GET /recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL (Supabase Edge Function)**: `/functions/v1/recipes/feed`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
- **Parametry**:
    - **Wymagane**: brak
    - **Opcjonalne** (zgodne z `GET /recipes`, plus cursor):
        - `cursor` (string, opcjonalny): nieprzezroczysty token zwrócony jako `pageInfo.nextCursor`
        - `limit` (integer, domyślnie: `12`, min: `1`, max: `100`)
        - `sort` (string, domyślnie: `created_at.desc`)
            - format: `<field>.<direction>`
            - dozwolone `field`: `name` | `created_at` | `updated_at`
            - dozwolone `direction`: `asc` | `desc`
        - `view` (string, domyślnie: `owned`)
            - dozwolone: `owned` | `my_recipes`
        - `filter[category_id]` (integer)
        - `filter[tags]` (string): lista nazw tagów oddzielonych przecinkami
        - `filter[termorobot]` (boolean): `true|false|1|0`
        - `search` (string): tekst wyszukiwania (trim; w MVP bez wymuszanego minimum, ale zalecany min 2)

## 3. Wykorzystywane typy

### 3.1 Istniejące DTO (kontrakt współdzielony)

- **Lista publiczna**: `PublicRecipeListItemDto` (`shared/contracts/types.ts`)
- **Lista prywatna**: `RecipeListItemDto` (`shared/contracts/types.ts`)

### 3.2 Nowe DTO (do dodania – rekomendowane)

Aby ujednolicić odpowiedzi „feed” dla frontendu i backendu, rekomendowane jest dodanie do `shared/contracts/types.ts`:

- `CursorPageInfoDto`:
    - `hasMore: boolean`
    - `nextCursor: string | null` (albo `string` tylko gdy `hasMore=true`; rekomendacja: `string | null` dla czytelności)
- `CursorPaginatedResponseDto<T>`:
    - `data: T[]`
    - `pageInfo: CursorPageInfoDto`

Mapowanie:

- `GET /public/recipes/feed` → `CursorPaginatedResponseDto<PublicRecipeListItemDto>`
- `GET /recipes/feed` → `CursorPaginatedResponseDto<RecipeListItemDto>`

## 4. Szczegóły odpowiedzi

### 4.1 `GET /public/recipes/feed`

- **200 OK**

Payload:

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
      "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
      "created_at": "2023-10-27T10:00:00Z",
      "in_my_collections": false,
      "servings": 6,
      "is_termorobot": false
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "opaque_cursor_value"
  }
}
```

### 4.2 `GET /recipes/feed`

- **200 OK**

Payload:

```json
{
  "data": [
    {
      "id": 1,
      "name": "Apple Pie",
      "image_path": "path/to/image.jpg",
      "created_at": "2023-10-27T10:00:00Z",
      "visibility": "PUBLIC",
      "is_owner": true,
      "in_my_collections": false,
      "author": { "id": "a1b2c3d4-...", "username": "john.doe" },
      "category_id": 2,
      "category_name": "Dessert",
      "servings": 6,
      "is_termorobot": false
    }
  ],
  "pageInfo": {
    "hasMore": true,
    "nextCursor": "opaque_cursor_value"
  }
}
```

## 5. Przepływ danych

### 5.1 Wspólne założenia (cursor, stabilność sortowania)

#### Format cursor (MVP – offset ukryty w opaque cursor)

Rekomendacja MVP (bez zmian w DB): cursor przenosi **offset** (i sygnaturę zapytania) w formie base64url(JSON):

- `offset` (integer, >= 0) – ile rekordów zostało już „skonsumowanych”
- `limit` (integer) – limit użyty do generacji cursor
- `sort` (string) – np. `created_at.desc`
- `filtersHash` (string) – hash/skrót z filtrów i query (aby wykrywać cursor dla innego zestawu parametrów)

Przykładowy obiekt:

```json
{
  "v": 1,
  "offset": 24,
  "limit": 12,
  "sort": "created_at.desc",
  "filtersHash": "..."
}
```

Zasady:

- **Cursor jest nieprzezroczysty**: klient tylko przechowuje i odsyła wartość.
- **Cursor musi być samowystarczalny**: backend waliduje, że parametry bieżącego requestu pasują do tych, dla których cursor został wygenerowany (w przeciwnym razie `400`).
- **Stabilne sortowanie**:
    - w serwisach i/lub RPC sortowanie musi być stabilne (dla remisów) – w SQL rekomendowane: `ORDER BY <field> <dir>, id <dir>`.
    - w MVP (offset) stabilność nadal jest ważna, bo offset + brak stabilnego sortu może powodować „pływanie” kolejności.

#### `filtersHash`

Rekomendacja implementacyjna:

- zbudować deterministyczny obiekt „signature” z wybranych parametrów (np. sort, view, q/search, filtry, termorobot),
- zserializować do JSON z posortowanymi kluczami,
- policzyć skrót (np. SHA-256) i w cursor trzymać tylko hash.

To pozwala:

- zablokować użycie cursor z innymi filtrami (typowy błąd UI),
- utrzymać proste walidacje bez ujawniania szczegółów w cursor.

### 5.2 `GET /public/recipes/feed` (backend flow)

1. Żądanie trafia do `supabase/functions/public/index.ts` → `publicRouter` (`supabase/functions/public/public.handlers.ts`).
2. Router musi rozpoznać ścieżkę **`/public/recipes/feed`** przed dopasowaniem `/public/recipes/{id}`:
    - **krytyczne**: obecny regex `/^\/recipes\/([^/]+)$/` potraktuje `feed` jak `{id}`; dlatego `feed` musi być obsłużony wcześniej.
3. Handler:
    - ustala kontekst użytkownika przez `getOptionalAuthenticatedUser(req)` (anonimowo lub zalogowany),
    - waliduje query params przez Zod (w tym `cursor`, `limit`, `sort`, `q`, `filter[termorobot]`),
    - dekoduje cursor i wylicza `offset` (domyślnie `0` dla braku cursor),
    - wywołuje serwis `getPublicRecipesFeed(...)`.
4. Serwis:
    - używa **service role** klienta (`createServiceRoleClient`) i wymusza:
        - `visibility='PUBLIC'`
        - `deleted_at IS NULL` (w praktyce już w `recipe_details`, ale dodatkowy warunek nie szkodzi),
    - stosuje filtry (q, termorobot) i sort,
    - pobiera `limit + 1` rekordów z `range(offset, offset + limit)` (czyli `limit+1` sztuk),
    - mapuje rekordy do `PublicRecipeListItemDto` (w tym `in_my_collections`, jeśli user zalogowany),
    - ustala `hasMore = (returnedCount > limit)`,
    - zwraca `data` (pierwsze `limit`) + `pageInfo`:
        - `nextCursor` dla `hasMore=true`: offset zwiększony o `limit`.
5. Handler zwraca `200` z `Cache-Control` jak dla innych endpointów publicznych:
    - rekomendacja: `public, max-age=60` (tylko jeśli request anonimowy), a dla requestów z JWT `no-store`.

### 5.3 `GET /recipes/feed` (backend flow)

1. Żądanie trafia do `supabase/functions/recipes/index.ts` → `recipesRouter` (`supabase/functions/recipes/recipes.handlers.ts`).
2. Router musi rozpoznać ścieżkę **`/recipes/feed`** przed ekstrakcją `recipeId`:
    - **krytyczne**: obecny extractor `/\/recipes\/([^/]+)$/` uzna `feed` za `{id}` i trafi do `handleGetRecipeById`.
3. Handler `handleGetRecipesFeed`:
    - pobiera kontekst uwierzytelnienia (`getAuthenticatedContext(req)`),
    - waliduje query params (jak `GET /recipes`, ale z `cursor` i domyślnym `limit=12`),
    - dekoduje cursor i wylicza `offset`.
4. Serwis `getRecipesFeed` (MVP bez zmian DB) korzysta z istniejącego RPC `get_recipes_list`:
    - mapuje `offset` na `page` w RPC:
        - `page = floor(offset / limit) + 1`
        - i jednocześnie wymusza zgodność: `offset % limit == 0` (w przeciwnym razie `400` „invalid cursor”)
    - wywołuje RPC `get_recipes_list(...)` z `p_page` i `p_limit=limit`.
    - z wyniku bierze `total_count` z pierwszego wiersza (jeśli brak danych → `total_count=0`).
    - ustala `hasMore` jako: `offset + returnedItems < total_count`
    - ustala `nextCursor` jako: offset zwiększony o `returnedItems` (najczęściej `limit`).
5. Handler zwraca `200` z `pageInfo`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**:
    - `GET /recipes/feed`: wymagany JWT → `getAuthenticatedContext` (brak/niepoprawny → `401`)
    - `GET /public/recipes/feed`: JWT opcjonalny → `getOptionalAuthenticatedUser` (niepoprawny → `401`)
- **Autoryzacja / RLS**:
    - `GET /recipes/feed`: używa klienta anon + JWT → RLS ogranicza do danych użytkownika; dodatkowo semantyka `my_recipes` jest realizowana w RPC (kontrolowana w SQL).
    - `GET /public/recipes/feed`: używa service role → **wymuszenie filtrów aplikacyjnych jest krytyczne** (`visibility='PUBLIC'`, `deleted_at IS NULL`).
- **Ochrona przed wstrzyknięciami (sort, filtry)**:
    - `sort.field` musi być whitelistowane (public: `created_at|name`, private: `name|created_at|updated_at`);
    - `sort.direction` tylko `asc|desc`;
    - `filter[category_id]` tylko liczba dodatnia;
    - `filter[termorobot]` tylko `true|false|1|0`;
    - `filter[tags]` → trim + usuwanie pustych.
- **Cursor tampering**:
    - cursor to dane klienta → zawsze walidować i odrzucać niezgodne/modyfikowane (`400`).
    - `filtersHash` zapobiega użyciu cursor dla innych filtrów/sortu/limitu.
- **Ryzyka DoS**:
    - twardy `max limit` (100),
    - minimalna długość `q` (min 2),
    - rekomendacja: dla `search` w `GET /recipes/feed` wprowadzić min 2 w przyszłości (po uzgodnieniu z UI/UX), aby ograniczyć koszt.

## 7. Obsługa błędów

Wszystkie błędy są obsługiwane przez `handleError` i zwracają spójny payload `{ code, message }`.

### 7.1 Scenariusze błędów i statusy

- **400 Bad Request** (`VALIDATION_ERROR`)
    - `cursor` nie jest poprawnym base64url/JSON
    - `cursor.v` nieobsługiwany
    - `cursor.filtersHash` nie pasuje do bieżących parametrów
    - `offset` ujemny / nie-całkowity / `offset % limit != 0` (dla prywatnego feed w MVP)
    - `q` ma mniej niż 2 znaki
    - `sort` w niepoprawnym formacie lub niedozwolone wartości
    - `limit` poza zakresem
    - `filter[termorobot]` niepoprawna wartość
- **401 Unauthorized** (`UNAUTHORIZED`)
    - brak JWT dla `GET /recipes/feed`
    - niepoprawny/wygaśnięty JWT dla dowolnego endpointu, jeśli nagłówek jest wysłany
- **404 Not Found** (`NOT_FOUND`)
    - nie dotyczy list feed (dla listy zwracamy `200` + puste `data`), ale dotyczy routingu, jeśli ścieżka nie istnieje
- **500 Internal Server Error** (`INTERNAL_ERROR`)
    - błędy bazy (PostgREST/RPC),
    - błędy mapowania danych / nieoczekiwane wyjątki.

### 7.2 Logowanie i „tabela błędów”

- W projekcie obecnie nie ma mechanizmu zapisu błędów do dedykowanej tabeli w DB.
- Standardem jest:
    - `logger.info` dla parametrów requestu (bez wrażliwych danych),
    - `logger.warn` dla walidacji i przypadków brzegowych,
    - `logger.error` dla błędów DB i wyjątków.

## 8. Wydajność

- **Unikanie `count(*)` w feed**:
    - public feed: użyć `limit+1` zamiast `count: 'exact'` (brak potrzeby liczenia całości).
    - private feed: w MVP bazujemy na `total_count` z RPC, ale można rozważyć wariant bez `total_count` (patrz „Ulepszenia” poniżej).
- **Stabilne sortowanie**:
    - wymusić sort deterministyczny (w DB lub w zapytaniu) aby offset nie powodował „pływania”.
- **Indeksy**:
    - `recipes(created_at)`, `recipes(name)` oraz indeksy na relacjach (`recipe_collections`, `recipe_tags`) są kluczowe dla `my_recipes`.
- **Wyszukiwanie**:
    - `recipe_details` ma `search_vector`; MVP public endpoint używa `ILIKE` po `name`, ale docelowo warto przejść na full-text, jeśli UX tego wymaga.

## 9. Kroki implementacji

1. **Kontrakty (shared)**
    - dodać do `shared/contracts/types.ts`:
        - `CursorPageInfoDto`
        - `CursorPaginatedResponseDto<T>`
2. **Routing – `public`**
    - w `supabase/functions/public/public.handlers.ts`:
        - dodać route `GET /public/recipes/feed`
        - zapewnić, że dopasowanie `/recipes/feed` jest sprawdzane **przed** `/recipes/{id}`
3. **Routing – `recipes`**
    - w `supabase/functions/recipes/recipes.handlers.ts`:
        - dodać wykrywanie ścieżki `/recipes/feed` przed ekstrakcją `recipeId`
        - dodać handler `handleGetRecipesFeed`
4. **Walidacja query**
    - `public.handlers.ts`:
        - dodać Zod schema dla feed (cursor/limit/sort/q/termorobot)
    - `recipes.handlers.ts`:
        - dodać Zod schema dla feed (cursor/limit + istniejące filtry/view/sort/search/termorobot)
5. **Cursor utils (rekomendowane jako wspólny kod)**
    - dodać w `supabase/functions/_shared/` util (np. `cursor.ts`):
        - `encodeCursor(obj) -> string` (base64url)
        - `decodeCursor(str) -> obj` z walidacją
        - `buildFiltersHash(params) -> string`
6. **Serwis – public feed**
    - w `supabase/functions/public/public.service.ts`:
        - dodać funkcję `getPublicRecipesFeed(client, query, userId?)`
        - implementacja `limit+1` + `range(offset, offset+limit)` + `pageInfo`
7. **Serwis – recipes feed**
    - w `supabase/functions/recipes/recipes.service.ts`:
        - dodać `getRecipesFeed(client, options)`:
            - walidacja spójności cursor (offset%limit==0),
            - mapowanie offset → page,
            - wywołanie `get_recipes_list`,
            - wyliczenie `hasMore` i `nextCursor`.
8. **Cache-Control**
    - `public/index.ts` już dodaje cache dla `200` na publicznych odpowiedziach.
    - rekomendacja: w handlerze feed dodać możliwość wyłączenia cache dla requestów z JWT (np. `no-store`), analogicznie do `explore`.
9. **Smoke testy / testy kontraktowe (minimalne)**
    - `GET /public/recipes/feed` bez cursor:
        - zwraca `limit` rekordów i `nextCursor` (jeśli są kolejne)
    - `GET /public/recipes/feed` z cursor:
        - dokleja kolejne rekordy, bez duplikatów
    - `GET /recipes/feed` bez JWT → `401`
    - `GET /recipes/feed` z JWT:
        - działa dla `view=owned` i `view=my_recipes`
    - `cursor` z innym `limit/sort/filter` → `400`

## 10. Ulepszenia po MVP (opcjonalne, ale rekomendowane)

- **Prawdziwy keyset pagination (bez offset)**:
    - dla public feed: cursor niesie `(lastSortValue, lastId)` i filtruje `WHERE (field,id) < (...)` / `>` zależnie od kierunku.
    - dla private feed: dodać nowe RPC `get_recipes_feed` bazujące na CTE z `get_recipes_list`, ale bez `offset`, z `limit+1`, z deterministycznym `ORDER BY <field>, id`.
    - to usuwa koszt `OFFSET` dla dużych bibliotek i stabilizuje feed przy równoległych zmianach danych.

