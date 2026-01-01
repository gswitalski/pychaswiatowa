# API Endpoints Implementation Plan: Recipe times (`prep_time_minutes`, `total_time_minutes`) — Recipes + Public Recipes

> **Plik docelowy**: `docs/results/impl-plans/endpoints/recipes-times-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Functions (TypeScript / Deno) + migracje SQL (Postgres)  
> **Zakres zmiany**: dodanie pól czasu + walidacja zależności `total_time_minutes >= prep_time_minutes` (gdy oba ustawione) w:
>
> - `POST /recipes`
> - `PUT /recipes/{id}`
> - listach i szczegółach przepisów (Recipes + Public Recipes)

## 1. Przegląd punktu końcowego

Celem zmiany jest obsługa dwóch opcjonalnych pól czasowych (w minutach):

- `prep_time_minutes` — czas przygotowania
- `total_time_minutes` — czas całkowity

**Kontrakty biznesowe (MVP):**

- Oba pola są **opcjonalne** (`integer | null`).
- Zakres: **0–999**.
- Spójność: jeśli oba pola są ustawione (nie-`null`), to `total_time_minutes` musi być **>=** `prep_time_minutes`.
    - W przeciwnym razie API zwraca `400 Bad Request` z czytelnym błędem walidacji.

**Konsekwencja kontraktu:**

- Pola muszą być dostępne w DTO list i szczegółów dla:
    - Recipes (prywatne: `/recipes*`)
    - Public Recipes (publiczne: `/public/recipes*`)

## 2. Szczegóły żądania

### 2.1 `POST /recipes`

- **Metoda HTTP**: `POST`
- **URL**: `/functions/v1/recipes` (w dokumentacji: `/recipes`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)
- **Body (zmiany)**:
    - dodać obsługę:
        - `prep_time_minutes?: number | null`
        - `total_time_minutes?: number | null`

**Walidacja (handler, Zod):**

- `prep_time_minutes`:
    - `undefined | null | integer`
    - `0 <= value <= 999`
- `total_time_minutes`:
    - `undefined | null | integer`
    - `0 <= value <= 999`
- reguła cross-field:
    - jeśli `prep_time_minutes != null` i `total_time_minutes != null` i `total_time_minutes < prep_time_minutes` → `400`.

### 2.2 Wykorzystywane typy (DTO i Command modele)

#### Kontrakty FE/Shared (`shared/contracts/types.ts`)

**Do aktualizacji** (dodać pola czasu w DTO odpowiedzi):

- `RecipeListItemDto`
    - dodać: `prep_time_minutes: number | null`, `total_time_minutes: number | null`
- `RecipeDetailDto`
    - dodać: `prep_time_minutes: number | null`, `total_time_minutes: number | null`
- `PublicRecipeListItemDto`
    - dodać: `prep_time_minutes: number | null`, `total_time_minutes: number | null`
- `PublicRecipeDetailDto`
    - dodać: `prep_time_minutes: number | null`, `total_time_minutes: number | null`

**Do aktualizacji** (dodać pola czasu w komendach wejścia):

- `CreateRecipeCommand`
    - dodać: `prep_time_minutes?: number | null`, `total_time_minutes?: number | null`
- `UpdateRecipeCommand`
    - (dziedziczy) dodać obsługę tych pól również dla update

> Uwaga: w API planie występują też czasy w przykładach. Kontrakty FE/Shared powinny odzwierciedlać rzeczywisty payload BE, żeby nie rozjechać typów.

#### Backend (Edge Functions — typy lokalne)

W zależności od aktualnej implementacji:

- dodać pola do DTO mapowanych w `recipes.service.ts` / `public.service.ts` (lub odpowiednikach),
- rozszerzyć schematy Zod dla `POST /recipes` i `PUT /recipes/{id}` o walidację czasów + cross-field rule.

### 2.3 `PUT /recipes/{id}`

- **Metoda HTTP**: `PUT`
- **URL**: `/functions/v1/recipes/{id}` (w dokumentacji: `/recipes/{id}`)
- **Nagłówki**:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)
- **Path params**:
    - `{id}` (pozytywna liczba całkowita)
- **Body (zmiany)**:
    - dodać obsługę:
        - `prep_time_minutes?: number | null`
        - `total_time_minutes?: number | null`

**Walidacja (handler, Zod):** identyczna jak dla `POST /recipes`.

### 2.4 Endpointy odczytu (Recipes + Public Recipes)

Zmiana dotyczy tylko **kontraktu odpowiedzi** (brak nowych parametrów wejścia):

- `GET /public/recipes`
- `GET /public/recipes/feed`
- `GET /public/recipes/{id}`
- `GET /recipes`
- `GET /recipes/feed`
- `GET /recipes/{id}`

## 3. Szczegóły odpowiedzi

### 4.1 Sukces

- **`POST /recipes`**: `201 Created` (bez zmiany statusu), ale obiekt przepisu zwracany w payload zawiera:
    - `prep_time_minutes: number | null`
    - `total_time_minutes: number | null`
- **`PUT /recipes/{id}`**: `200 OK` (bez zmiany statusu), analogicznie pola czasu w payload.
- **Wszystkie listy i szczegóły**: `200 OK` (bez zmiany statusu) + pola czasu w DTO.

### 4.2 Błędy (kontrakt)

**Nowy/rozszerzony przypadek `400 Bad Request`:**

- gdy walidacja wejścia nie przejdzie:
    - wartości spoza zakresu 0–999,
    - nie-integer,
    - lub `total_time_minutes < prep_time_minutes` (gdy oba ustawione).

Pozostałe kody statusu pozostają zgodne z istniejącą semantyką endpointów:

- `401 Unauthorized` (brak/invalid JWT dla endpointów prywatnych; dla publicznych tylko jeśli klient wysłał zły token i implementacja to egzekwuje)
- `404 Not Found` (nie istnieje / brak dostępu wg aktualnych reguł)
- `500 Internal Server Error` (błąd runtime / DB)

## 4. Przepływ danych

## 5.1 Zmiany w DB (wymagane)

W `docs/results/main-project-docs/008 DB Plan.md` tabela `recipes` nie zawiera jeszcze pól czasowych — aby endpointy mogły je obsłużyć, potrzebna jest migracja.

**Proponowane kolumny (Postgres):**

- `prep_time_minutes smallint null`
- `total_time_minutes smallint null`

**Constraints (rekomendowane, żeby DB broniła integralność):**

- zakres:
    - `CHECK (prep_time_minutes IS NULL OR (prep_time_minutes >= 0 AND prep_time_minutes <= 999))`
    - `CHECK (total_time_minutes IS NULL OR (total_time_minutes >= 0 AND total_time_minutes <= 999))`
- spójność:
    - `CHECK (prep_time_minutes IS NULL OR total_time_minutes IS NULL OR total_time_minutes >= prep_time_minutes)`

**Widoki/RPC:**

- jeśli istnieje widok `recipe_details` — musi zwracać nowe kolumny.
- jeśli istnieje RPC dla list (np. `get_recipes_list`) — musi zwracać nowe kolumny.

> Zasada: BE powinien wybierać tylko potrzebne kolumny, ale jeśli DTO zawiera pola czasowe, to query/RPC muszą je dostarczyć.

## 5.2 `POST /recipes` / `PUT /recipes/{id}` — happy path

1. Handler wymusza JWT (`401`).
2. Handler parsuje JSON:
    - błąd parsowania → `400`.
3. Handler waliduje body Zod:
    - błędy typów/zakresu/spójności → `400`.
4. Serwis wykonuje operacje DB (insert/update):
    - zapisuje `prep_time_minutes` i `total_time_minutes` (także `null`, jeśli użytkownik czyści pole).
5. Handler mapuje wynik na DTO i zwraca `201`/`200`.

## 5. Względy bezpieczeństwa

- **Uwierzytelnienie**:
    - `POST /recipes`, `PUT /recipes/{id}`: zawsze wymagany JWT.
- **Autoryzacja/RLS**:
    - aktualna logika dostępu do przepisów zostaje bez zmian; pola czasowe nie zmieniają zasad dostępu.
- **Integralność danych**:
    - walidacja w handlerze (Zod) + **dodatkowe constraints w DB** (rekomendowane) minimalizują ryzyko niespójności.
- **Bezpieczne logowanie**:
    - logować metadane (np. `userId`, `recipeId`) i błąd walidacji, ale nie logować tokenów.

## 6. Obsługa błędów

### 6.1 Scenariusze błędów (najważniejsze)

- `400 Bad Request`:
    - `prep_time_minutes` lub `total_time_minutes` poza zakresem 0–999
    - wartości niebędące integer
    - `total_time_minutes < prep_time_minutes` (gdy oba ustawione)
- `401 Unauthorized`:
    - brak / nieprawidłowy JWT
- `404 Not Found`:
    - (bez zmian) zależnie od endpointu: nie istnieje / brak dostępu wg aktualnych reguł
- `500 Internal Server Error`:
    - błąd DB, błąd runtime, nieobsłużony wyjątek

### 6.2 Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W aktualnym DB planie nie ma tabeli na błędy. Dla MVP wystarczy:

- `logger.error(...)` w Edge Functions + logi Supabase.

Jeśli w przyszłości będzie wymagany audyt walidacji/zgłoszeń, rozważyć tabelę zdarzeń (poza zakresem tej zmiany).

## 7. Wydajność

- **Koszt obliczeń**: walidacja cross-field jest stała (O(1)).
- **Koszt DB**:
    - brak nowych joinów; jedynie dodatkowe kolumny w selectach / widoku / RPC.
- **Najważniejsze ryzyko wydajnościowe**:
    - jeśli lista endpointów opiera się o RPC/view — ich aktualizacja jest kluczowa, żeby uniknąć dodatkowych round-tripów i hacków po stronie backendu.

## 8. Kroki implementacji

1. **DB (migracje)**:
    - dodać kolumny `prep_time_minutes`, `total_time_minutes` do `public.recipes`
    - dodać constraints zakresu i spójności (rekomendowane)
    - zaktualizować `recipe_details` (jeśli istnieje) o nowe kolumny
    - zaktualizować RPC dla list (np. `get_recipes_list`) o nowe kolumny
2. **Typy Supabase**:
    - zregenerować typy (jeśli repo utrzymuje `database.types.ts` generowane z Supabase)
3. **Kontrakty FE/Shared**:
    - zaktualizować `shared/contracts/types.ts` (DTO + command models) o pola czasowe
4. **Backend — Recipes (`supabase/functions/recipes`)**:
    - w handlerach `POST /recipes` i `PUT /recipes/{id}`:
        - rozszerzyć Zod schema o pola czasowe + cross-field validation
        - zwracać `400` z czytelnym błędem walidacji
    - w serwisach/mapperach DTO:
        - upewnić się, że pola czasowe są zwracane w odpowiedziach (create/update/detail/list)
5. **Backend — Public (`supabase/functions/public`)**:
    - rozszerzyć mapowanie DTO list/szczegółów o pola czasowe (z danych z view/query)
6. **Testy manualne / smoke** (rekomendowane przypadki):
    - `POST /recipes`:
        - oba `null`/brak → 201
        - tylko `prep_time_minutes` → 201
        - tylko `total_time_minutes` → 201
        - oba ustawione i `total >= prep` → 201
        - oba ustawione i `total < prep` → 400
        - `-1`, `1000`, `1.5`, `"10"` → 400
    - `PUT /recipes/{id}`:
        - ustawienie/zmiana czasów + czyszczenie na `null`
        - próba `total < prep` → 400
    - `GET` listy/szczegóły:
        - pola czasowe obecne i zgodne z DB (lub `null` jeśli brak)


