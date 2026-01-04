# API Endpoints Implementation Plan: GET /public/recipes + GET /public/recipes/feed (search relevance)

## 1. Przegląd punktu końcowego

Ten dokument opisuje wdrożenie i zmianę kontraktu dla dwóch publicznych endpointów listujących przepisy:

- `GET /public/recipes` – paginacja stronami (page/limit), używana np. do klasycznej listy.
- `GET /public/recipes/feed` – paginacja kursorowa (cursor/limit), używana do „load more”.

Endpointy są **publiczne** (anon ma dostęp bez JWT), ale **obsługują opcjonalny nagłówek** `Authorization: Bearer <JWT>`.

Wymagania domenowe i bezpieczeństwa:
- Dla anon: zwracamy **wyłącznie** przepisy z `visibility = 'PUBLIC'` oraz `deleted_at IS NULL`.
- Dla użytkownika zalogowanego (poprawny JWT):
  - można dodatkowo zwrócić **własne** przepisy użytkownika o widoczności niepublicznej (`PRIVATE`, `SHARED`) – wyłącznie gdy `is_owner = true`,
  - endpoint nigdy nie może ujawnić niepublicznych przepisów innych użytkowników.

Zmiany w kontrakcie wyszukiwania (relevance):
- `q`: minimalna długość to **3 znaki** (po `trim()`),
- semantyka wielowyrazowa: **AND**,
- dopasowanie tagów: **exact** lub **prefix**,
- sortowanie:
  - gdy `q` poprawne: domyślnie **relevance** (wagi 3/2/1: nazwa/składniki/tagi) + stabilny tie-breaker (np. `created_at.desc`),
  - gdy `q` puste/krótkie: endpoint działa jak feed (domyślnie `created_at.desc`),
- odpowiedź zawiera pole pomocnicze `search` (np. `relevance_score`, `match`) do etykiety UI „Dopasowanie: …”.

## 2. Szczegóły żądania

### 2.1 `GET /public/recipes`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes` (w Supabase: `/functions/v1/public/recipes`)
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne**:
    - `page` (integer, domyślnie `1`, min `1`)
    - `limit` (integer, domyślnie `20`, min `1`, max – rekomendacja: `100`)
    - `sort` (string, domyślnie `created_at.desc`; np. `created_at.desc`, `name.asc`)
    - `q` (string; po trim; **min 3** znaki; w przeciwnym razie `400`)
    - `filter[termorobot]` (boolean)
    - `filter[grill]` (boolean)
    - `filter[diet_type]` (string enum: `MEAT | VEGETARIAN | VEGAN`)
    - `filter[cuisine]` (string enum: zgodnie z `RecipeCuisine` w kontrakcie)
    - `filter[difficulty]` (string enum: `EASY | MEDIUM | HARD`)
    - nagłówek `Authorization: Bearer <JWT>` (opcjonalny; gdy obecny i poprawny, API dodaje pola pomocnicze i może uwzględnić własne niepubliczne przepisy)
- **Request Body**: brak

Semantyka `q`:
- `q = q.trim()`
- jeśli `q` niepuste i `q.length < 3` → `400`
- tokenizacja na słowa i logika **AND** (wszystkie tokeny muszą pasować w pełnotekstowym wyszukiwaniu)
- dopasowanie tagów: `tag = token` lub `tag LIKE token%` (prefix)

### 2.2 `GET /public/recipes/feed`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/public/recipes/feed` (w Supabase: `/functions/v1/public/recipes/feed`)
- **Parametry**:
  - **Wymagane**: brak
  - **Opcjonalne**:
    - `cursor` (string; opaque; zwracany jako `pageInfo.nextCursor`)
    - `limit` (integer, domyślnie `12`, min `1`, max – rekomendacja: `50`)
    - `sort` (string, domyślnie `created_at.desc`; musi być stabilny)
    - `q` (string; po trim; **min 3** znaki; w przeciwnym razie `400`)
    - te same filtry `filter[...]` co w `GET /public/recipes`
    - nagłówek `Authorization: Bearer <JWT>` (opcjonalny)
- **Request Body**: brak

Semantyka sortowania:
- dla `q` poprawnego: domyślny sort to relevance + stabilny tie-breaker (np. `created_at.desc`, a finalnie `id.desc` dla deterministyczności),
- dla `q` pustego: feed działa jak `created_at.desc` (także z tie-breakerem `id.desc`).

## 3. Wykorzystywane typy

### Kontrakt (frontend/shared)
Z `shared/contracts/types.ts`:

- `PaginatedResponseDto<T>`, `PaginationDetails`
- `CursorPaginatedResponseDto<T>`, `CursorPageInfoDto`
- `PublicRecipeListItemDto` (wymagane pola: m.in. `is_owner`, `in_my_plan`, `in_my_collections`, oraz dodatkowe `search?: { relevance_score: number; match: 'name'|'ingredients'|'tags' } | null` – pole `search` należy dodać/upewnić się, że istnieje w DTO kontraktowym dla listy)
- Typy filtrów: `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`, `RecipeVisibility`

Uwaga: jeżeli `PublicRecipeListItemDto` w kontrakcie nie ma jeszcze pola `search`, wdrożenie musi obejmować aktualizację kontraktu (analogicznie do zmian opisanych w `docs/results/changes/public-recipes-search-relevance-changes.md`).

### Backend (Edge Function `public`)
Rekomendowane typy (lokalne dla Edge Function):
- `GetPublicRecipesQuery` (page/limit/sort/q/filters)
- `GetPublicRecipesFeedQuery` (cursor/limit/sort/q/filters)
- `PublicRecipeSearchMeta`:
  - `relevanceScore: number`
  - `match: 'name' | 'ingredients' | 'tags'`
- `OpaqueCursor` (dekodowanie/enkodowanie), np.:
  - `{ sort: string; q: string | null; filters: ...; last: { createdAt: string; id: number; relevanceScore?: number } }`

## 4. Szczegóły odpowiedzi

### 4.1 `GET /public/recipes` – sukces
- **Kod**: `200 OK`
- **Payload**: `PaginatedResponseDto<PublicRecipeListItemDto>`

Wymagane zachowanie pól pomocniczych:
- dla anon:
  - `is_owner = false`
  - `in_my_plan = false`
  - `in_my_collections = false`
  - `search = null` gdy `q` puste/krótkie; gdy `q` poprawne – `search` ustawione na podstawie najlepszego dopasowania
- dla authenticated:
  - `is_owner = (recipe.user_id == auth.user.id)`
  - `in_my_plan` – `true` tylko jeśli przepis znajduje się w `plan_recipes` użytkownika
  - `in_my_collections` – `true` tylko jeśli przepis jest w co najmniej jednej kolekcji użytkownika

### 4.2 `GET /public/recipes/feed` – sukces
- **Kod**: `200 OK`
- **Payload**: `CursorPaginatedResponseDto<PublicRecipeListItemDto>`

Wymagane zachowanie `pageInfo`:
- `hasMore`: `true` jeśli istnieją kolejne rekordy po ostatnim zwróconym
- `nextCursor`: opaque string lub `null` gdy `hasMore = false`

### 4.3 Błędy (minimalny wymagany zestaw)

Wspólne dla obu endpointów:
- **`400 Bad Request`**:
  - `q` podane, ale po trim ma mniej niż 3 znaki
  - `page`, `limit` lub `sort` mają nieprawidłowy format/wartość
  - nieprawidłowe wartości filtrów (enum)
  - `cursor` jest nieprawidłowy (tylko `/feed`)
- **`401 Unauthorized`**:
  - klient podał `Authorization`, ale token jest niepoprawny / wygasły
- **`500 Internal Server Error`**:
  - błąd po stronie serwera (DB, nieoczekiwany wyjątek)

Rekomendacja spójności: trzymać format błędów zgodny z `_shared/errors.ts` (np. `code`, `message`).

## 5. Przepływ danych

### 5.1 Routing i warstwy (zalecana architektura)

Zgodnie z regułami modularnymi:
- `supabase/functions/public/index.ts`:
  - CORS (OPTIONS)
  - routing do `publicRouter`
  - top-level error handling
- `supabase/functions/public/public.handlers.ts`:
  - `handleGetPublicRecipes` dla `/recipes`
  - `handleGetPublicRecipesFeed` dla `/recipes/feed`
  - walidacja query params (Zod), parsowanie typów, formatowanie odpowiedzi
- `supabase/functions/public/public.service.ts`:
  - `getPublicRecipes({ ... })` – logika listy z paginacją offsetową
  - `getPublicRecipesFeed({ ... })` – logika listy z paginacją kursorową
  - implementacja wyszukiwania, filtrów, sortowania i obliczania `search`

### 5.2 Uwierzytelnianie (opcjonalne)

1. Handler próbuje odczytać użytkownika z JWT (jeśli nagłówek `Authorization` jest obecny).
2. Jeśli token jest obecny, ale niepoprawny → **`401`** (nie „spadamy” do anon).
3. Jeśli brak tokenu → tryb anon.

### 5.3 Pobieranie danych (DB)

Źródła danych:
- `recipes` (zawsze: filtr `deleted_at IS NULL`)
- `categories` (join/lookup do `category`)
- `profiles` (autor: `id`, `username`)
- `tags` + `recipe_tags` (tagi do listy + dopasowanie tagów w wyszukiwaniu)
- `collections` + `recipe_collections` (dla `in_my_collections` u użytkownika)
- `plan_recipes` (dla `in_my_plan` u użytkownika; jeśli tabela istnieje w projekcie)
- preferowany widok: `recipe_details` (agregacja kategorii/tagów) – jeśli pokrywa potrzebne pola; w przeciwnym razie dołączyć brakujące dane minimalnymi zapytaniami

Relevance i pole `search`:
- wyznaczyć `match` jako **najlepsze** źródło dopasowania (`name` > `ingredients` > `tags`) dla `q` poprawnego,
- wyznaczyć `relevance_score` jako liczba porównywalna w obrębie wyników (np. 3/2/1 + ewentualne doprecyzowanie per-token),
- dodać stabilny tie-breaker: `created_at.desc`, następnie `id.desc`.

Rekomendacja implementacyjna (dla prostoty i wydajności):
- przenieść logikę wyszukiwania + scoring do SQL (widok/RPC), aby:
  - uniknąć wielokrotnych round-tripów w Edge Function,
  - wykorzystać indeksy (`GIN` dla FTS na `recipes`),
  - mieć powtarzalną, testowalną definicję relevance.

## 6. Względy bezpieczeństwa

- **Kluczowe ryzyko**: wyciek niepublicznych przepisów przy użyciu `service role`.
  - Jeśli backend używa `service role`, musi bezwzględnie egzekwować filtr:
    - anon: `visibility = 'PUBLIC'`
    - auth: `visibility = 'PUBLIC' OR user_id = <authUserId>`
  - Nigdy nie zwracać cudzych przepisów `PRIVATE/SHARED`.
- **Soft delete**: zawsze `deleted_at IS NULL`.
- **Walidacja wejścia (Zod)**:
  - `q`: trim, min 3 (gdy niepuste)
  - `page`, `limit`: integer, zakresy
  - `sort`: allow-list znanych pól i kierunków
  - `filter[...]`: wartości enum, booleany
  - `cursor`: bezpieczne dekodowanie + spójność (patrz niżej)
- **Sanityzacja**:
  - nie interpolować surowego `q` w SQL-string; używać parametrów / RPC
  - ograniczyć maksymalną długość `q` (rekomendacja: 100–150 znaków) i liczbę tokenów (np. 10), aby ograniczyć DoS.
- **CORS**:
  - metody: `GET, OPTIONS`
  - nagłówki: `Authorization, Content-Type`
- **Cache**:
  - anon: odpowiedź może być cache’owana (publiczny katalog)
  - auth: rekomendacja `Cache-Control: no-store` (bo `in_my_plan`, `is_owner`, `in_my_collections` są per-user)

## 7. Obsługa błędów

### Scenariusze i mapowanie statusów
- `400` (`VALIDATION_ERROR`):
  - `q` < 3 po trim
  - niepoprawne parametry paginacji
  - niepoprawne filtry enum
  - `cursor` niepoprawny / niespójny z `sort/q/filters` (tylko `/feed`)
- `401` (`UNAUTHORIZED`):
  - `Authorization` obecny, ale token niepoprawny/wygasły
- `500` (`INTERNAL_ERROR`):
  - błąd DB, nieobsłużony wyjątek, niespójność danych (np. brak profilu autora)

### Rejestrowanie błędów w tabeli
- W aktualnym schemacie brak tabeli błędów: **nie dotyczy**.
- Diagnostyka: strukturalne logi Supabase (`_shared/logger.ts`) + spójne błędy aplikacyjne (`_shared/errors.ts`).

## 8. Rozważania dotyczące wydajności

- Preferować `recipe_details` (lub dedykowany widok/RPC) do pobrania listy bez problemu N+1.
- `GET /public/recipes` (offset pagination):
  - akceptowalne dla mniejszych offsetów, ale może degradować się dla dużych `page`.
  - rekomendacja: UI „Explore” używa `/feed`, a `/recipes` zostaje jako paginacja klasyczna.
- `GET /public/recipes/feed` (cursor):
  - stabilne sortowanie jest krytyczne: użyć tie-breakerów (`created_at`, `id`) zawsze.
  - cursor powinien kodować ostatnie wartości sortowania, a backend musi walidować spójność (żeby nie mieszać wyników po zmianie `q/filters/sort`).
- Indeksy:
  - FTS: GIN na `tsvector` (`name`, `ingredients`) – już w planie DB.
  - Tag prefix: rozważyć `pg_trgm` + GIN/GIST na `tags.name` (jeżeli prefix/ILIKE będzie wąskim gardłem).

## 9. Kroki implementacji

1. **Kontrakt**:
   - upewnić się, że `PublicRecipeListItemDto` zawiera pole `search` (np. `search?: { relevance_score: number; match: 'name'|'ingredients'|'tags' } | null`).
2. **Routing**:
   - w `supabase/functions/public/index.ts` dodać routing ścieżek:
     - `GET /recipes`
     - `GET /recipes/feed`
3. **Handlery** (`public.handlers.ts`):
   - dodać `handleGetPublicRecipes` i `handleGetPublicRecipesFeed`,
   - walidacja query params (Zod) + normalizacja (`trim`, defaulty),
   - obsługa opcjonalnego JWT:
     - brak → anon,
     - invalid → `401`,
     - valid → user context.
4. **Serwis** (`public.service.ts`):
   - wydzielić logikę:
     - `getPublicRecipes({ page, limit, sort, q, filters, userId })`
     - `getPublicRecipesFeed({ cursor, limit, sort, q, filters, userId })`
   - w obu:
     - egzekwować `deleted_at IS NULL`,
     - anon vs auth visibility rules,
     - obliczyć `search` tylko gdy `q` poprawne,
     - dorzucić `in_my_plan` i `in_my_collections` tylko w trybie auth (anon zawsze `false`).
5. **Relevance**:
   - zaimplementować scoring 3/2/1 oraz `match` (name > ingredients > tags),
   - zapewnić stabilny tie-breaker (np. `created_at.desc`, `id.desc`),
   - rekomendacja: przenieść scoring do SQL (widok/RPC) i użyć go w obu endpointach.
6. **Cursor** (`/feed`):
   - zdefiniować format opaque cursora (base64 JSON),
   - walidować dekodowanie oraz spójność `sort/q/filters` z bieżącym requestem,
   - generować `nextCursor` na bazie ostatniego elementu listy.
7. **Cache**:
   - anon: dodać cache headers (jeśli projekt ma `createCachedResponse`, użyć analogicznej polityki jak w innych listach),
   - auth: `Cache-Control: no-store`.
8. **Testy manualne (minimalny zestaw)**:
   - anon:
     - `q` brak → feed (`created_at.desc`)
     - `q` = `ab` → `400`
     - `q` ≥ 3 → relevance sort + `search` w payload
     - filtry działają (termorobot/grill/diet/cuisine/difficulty)
   - auth:
     - własne `PRIVATE/SHARED` pojawiają się w wynikach, cudze niepubliczne nie
     - `in_my_plan` i `in_my_collections` ustawiane poprawnie
     - zły token → `401`


