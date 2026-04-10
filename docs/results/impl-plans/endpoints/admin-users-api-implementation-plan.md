# API Endpoints Implementation Plan: Admin Users (`GET /admin/users`)

## 1. Przegląd punktu końcowego

Celem endpointu jest dostarczenie rzeczywistego, admin-only źródła danych dla widoku `/admin/users`, tak aby administrator mógł przeglądać tabelaryczną listę wszystkich kont bez wykonywania bezpośrednich odczytów z klienta do `auth.users` lub innych zasobów systemowych.

Zakres MVP obejmuje jeden endpoint tylko do odczytu:

- `GET /admin/users`

Rekomendowana ścieżka wdrożenia w tym repo:

- rozszerzyć istniejącą Supabase Edge Function `admin` w `supabase/functions/admin/`,
- zachować obecny podział odpowiedzialności:
  - `index.ts` - wejście funkcji, CORS, top-level error handling,
  - `admin.handlers.ts` - routing, walidacja query params, formatowanie odpowiedzi,
  - `admin.service.ts` - logika biznesowa i pobieranie danych,
- dodać po stronie bazy funkcję RPC lub widok/RPC do bezpiecznego, serwerowego pobierania listy użytkowników z paginacją, sortowaniem i agregacją `recipes_count`.

Endpoint ma agregować dane z trzech obszarów:

- `auth.users`:
  - `email` jako `login`,
  - `created_at` jako data rejestracji,
  - `last_sign_in_at`,
  - źródło roli używane do nadawania claimu `app_role`,
- `public.profiles`:
  - `id`,
  - `username`,
- `public.recipes`:
  - liczba aktywnych przepisów użytkownika (`deleted_at IS NULL`).

Ważna decyzja architektoniczna:

- za źródło prawdy dla daty rejestracji należy przyjąć `auth.users.created_at`, ponieważ to rzeczywisty moment utworzenia konta,
- `profiles.created_at` może być użyte tylko pomocniczo, jeśli w projekcie zostanie jednoznacznie potwierdzone, że zawsze odzwierciedla datę założenia konta.

## 2. Szczegóły żądania

### 2.1 Endpoint

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/admin/users`
  - wywołanie przez Supabase Functions: `GET /functions/v1/admin/users`
- **Auth**: wymagany nagłówek `Authorization: Bearer <JWT>`
- **Request body**: brak

### 2.2 Parametry zapytania

#### Wymagane

- brak

#### Opcjonalne

- `page: number`
  - domyślnie `1`
  - liczba całkowita `>= 1`
- `page_size: number`
  - domyślnie `25`
  - liczba całkowita `>= 1`
  - rekomendowany limit maksymalny: `100`, aby uniknąć zbyt ciężkich odczytów
- `sort_by: 'created_at' | 'login' | 'last_sign_in_at' | 'recipes_count'`
  - domyślnie `created_at`
- `sort_dir: 'asc' | 'desc'`
  - domyślnie `desc`

### 2.3 Domyślne zachowanie

- jeśli klient nie poda parametrów, backend stosuje:
  - `page = 1`
  - `page_size = 25`
  - `sort_by = 'created_at'`
  - `sort_dir = 'desc'`
- endpoint nie wspiera w MVP:
  - filtrowania,
  - wyszukiwania,
  - segmentacji po roli,
  - eksportu danych,
  - akcji modyfikujących użytkowników.

### 2.4 Walidacja wejścia

Handler powinien wykonać walidację query params przed wejściem do serwisu, najlepiej schematem Zod:

- `page`:
  - parsowanie z query string,
  - odrzucenie wartości pustych, ujemnych, `0`, `NaN`, liczb zmiennoprzecinkowych,
- `page_size`:
  - parsowanie do integer,
  - odrzucenie wartości `<= 0`,
  - ograniczenie do rozsądnego maksimum,
- `sort_by`:
  - whitelist tylko czterech dozwolonych pól,
- `sort_dir`:
  - whitelist `asc | desc`.

Ważne:

- wartości `sort_by` i `sort_dir` nie mogą być nigdy wstrzykiwane do SQL bez jawnego mapowania na znane, stałe fragmenty zapytania,
- przy błędnych parametrach należy zwrócić `400 Bad Request` z czytelnym komunikatem biznesowym.

### 2.5 Wykorzystywane typy i modele

W `shared/contracts/types.ts` warto dodać nowe typy dedykowane temu endpointowi:

```ts
export type AdminUsersSortBy =
    | 'created_at'
    | 'login'
    | 'last_sign_in_at'
    | 'recipes_count';

export type SortDirection = 'asc' | 'desc';

export interface GetAdminUsersQueryDto {
    page?: number;
    page_size?: number;
    sort_by?: AdminUsersSortBy;
    sort_dir?: SortDirection;
}

export interface AdminUserListItemDto {
    id: string;
    login: string;
    username: string;
    role: AppRole;
    created_at: string;
    last_sign_in_at: string | null;
    recipes_count: number;
}

export interface GetAdminUsersResponseDto {
    data: AdminUserListItemDto[];
    pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
    sorting: {
        sort_by: AdminUsersSortBy;
        sort_dir: SortDirection;
    };
}
```

Uwagi do typów:

- `AppRole` już istnieje w `shared/contracts/types.ts` i powinien zostać wykorzystany ponownie,
- rekomendowane jest użycie `data` zamiast `items`, aby zachować spójność z innymi endpointami w repo,
- `pageSize` warto zwrócić jawnie, mimo że klient zna wysłany parametr, bo upraszcza integrację z paginatorami i debugowanie.

### 2.6 Logika w warstwie service

Logika nie powinna trafić do `admin.handlers.ts`. Rekomendowane wydzielenie co najmniej:

- `getAdminUsers({ query }: { query: GetAdminUsersQueryDto }): Promise<GetAdminUsersResponseDto>`
- opcjonalnie helperów:
  - `normalizeAdminUsersQuery(...)`
  - `mapAdminUsersRowToDto(...)`
  - `getAdminUsersPageFromRpc(...)`

Jeśli `admin.service.ts` zacznie rosnąć, warto rozważyć dodatkowy plik:

- `admin-users.service.ts`

albo warstwę repozytoryjną/RPC helper, ale dla MVP rozszerzenie `admin.service.ts` będzie wystarczające.

## 3. Szczegóły odpowiedzi

### 3.1 Sukces `200 OK`

Endpoint powinien zwracać już gotowy kontrakt dla tabeli admina:

```json
{
  "data": [
    {
      "id": "4ec7f8d2-c2d7-4d2f-bddc-113c6f5f6d1d",
      "login": "admin@pychaswiatowa.pl",
      "username": "pycha-admin",
      "role": "admin",
      "created_at": "2026-03-20T18:15:00Z",
      "last_sign_in_at": "2026-04-10T07:42:11Z",
      "recipes_count": 12
    },
    {
      "id": "aa582e5b-0eef-4712-b984-58012ecfd6a6",
      "login": "ola@example.com",
      "username": "ola_kucharzy",
      "role": "premium",
      "created_at": "2026-03-18T09:31:44Z",
      "last_sign_in_at": null,
      "recipes_count": 3
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 25,
    "totalPages": 6,
    "totalItems": 142
  },
  "sorting": {
    "sort_by": "created_at",
    "sort_dir": "desc"
  }
}
```

### 3.2 Semantyka pól odpowiedzi

- `id`:
  - `uuid` użytkownika,
  - źródło: `auth.users.id` / `profiles.id`,
- `login`:
  - e-mail logowania,
  - źródło: `auth.users.email`,
- `username`:
  - źródło: `profiles.username`,
- `role`:
  - musi pochodzić z tego samego źródła prawdy, które zasila claim `app_role`,
  - rekomendowane źródło: `auth.users.raw_app_meta_data ->> 'app_role'`,
- `created_at`:
  - data utworzenia konta, ISO 8601,
- `last_sign_in_at`:
  - ISO 8601 lub `null`,
  - `null` ma pozwolić frontendowi wyświetlić stan `Nigdy`,
- `recipes_count`:
  - liczba aktywnych przepisów użytkownika,
  - tylko rekordy z `deleted_at IS NULL`.

### 3.3 Sortowanie

- `created_at`:
  - sortowanie po dacie rejestracji,
  - domyślnie `desc`,
- `login`:
  - sortowanie alfabetyczne case-insensitive,
- `last_sign_in_at`:
  - sortowanie po ostatnim logowaniu,
  - dla `desc` rekomendowane `NULLS LAST`,
- `recipes_count`:
  - sortowanie malejąco/rosnąco po agregacji liczby aktywnych przepisów,
- dla stabilności wyników każdy wariant powinien mieć wtórne sortowanie po `id` lub `created_at`, aby paginacja była deterministyczna.

## 4. Przepływ danych

### 4.1 Rekomendowany przepływ requestu

1. Klient wywołuje `GET /functions/v1/admin/users` z JWT oraz opcjonalnymi parametrami paginacji/sortowania.
2. `admin.handlers.ts`:
   - rozpoznaje ścieżkę `/users`,
   - dopuszcza tylko metodę `GET`,
   - waliduje query params,
   - wywołuje wspólny guard `requireAdminContext(req)`.
3. Guard:
   - pobiera token z nagłówka,
   - dekoduje i waliduje claim `app_role`,
   - weryfikuje token przez Supabase `auth.getUser()`,
   - sprawdza zgodność `jwt.sub` z uwierzytelnionym użytkownikiem,
   - blokuje request, jeśli `app_role !== 'admin'`.
4. Dopiero po przejściu guardu `admin.service.ts` wykonuje odczyt danych z użyciem klienta o podwyższonych uprawnieniach.
5. Serwis pobiera stronę danych oraz metadane paginacji.
6. Handler mapuje wynik do `GetAdminUsersResponseDto` i zwraca `200 OK`.

### 4.2 Rekomendowana implementacja dostępu do danych

Najlepszy wariant dla maintainability i prawdziwego server-side sorting to funkcja RPC w bazie, np.:

- `public.admin_get_users_page(page_number, page_size, sort_by, sort_dir)`

albo para funkcji:

- `public.admin_get_users_page(...)`
- `public.admin_get_users_count()`

Preferowany wariant to jedna funkcja zwracająca:

- rekordy bieżącej strony,
- `total_items` jako pole pomocnicze w każdym wierszu albo osobny obiekt result set.

Dlaczego RPC jest tu preferowane:

- sortowanie po `recipes_count`, `email` i `last_sign_in_at` ma się odbywać po stronie backendu, nie po stronie klienta,
- odczyt łączy dane z `auth.users`, `profiles` i agregacji `recipes`,
- unika się N+1 i ręcznego sklejania wielu żądań w Edge Function,
- wpisuje się to w reguły repo: złożone zapytania trzymać w widokach/RPC.

### 4.3 Kształt zapytania po stronie bazy

Funkcja/RPC powinna:

- wystartować od zbioru użytkowników z `auth.users`,
- dołączyć `public.profiles` po `id`,
- dołączyć zagregowaną liczbę aktywnych przepisów per user,
- odczytać rolę z `raw_app_meta_data`,
- zastosować whitelistowane sortowanie,
- zastosować `OFFSET/LIMIT` wynikające z `page` i `page_size`,
- zwrócić całkowitą liczbę rekordów do paginacji.

Rekomendowana agregacja liczby przepisów:

- `count(*) filter (where recipes.deleted_at is null)`

lub wcześniejsze agregowanie w CTE:

- `select user_id, count(*) as recipes_count from public.recipes where deleted_at is null group by user_id`

### 4.4 Mapowanie źródeł danych

- `auth.users.id` -> `AdminUserListItemDto.id`
- `auth.users.email` -> `AdminUserListItemDto.login`
- `profiles.username` -> `AdminUserListItemDto.username`
- `coalesce(auth.users.raw_app_meta_data ->> 'app_role', 'user')` -> `AdminUserListItemDto.role`
- `auth.users.created_at` -> `AdminUserListItemDto.created_at`
- `auth.users.last_sign_in_at` -> `AdminUserListItemDto.last_sign_in_at`
- agregacja `recipes` -> `AdminUserListItemDto.recipes_count`

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**:
  - wymagany poprawny JWT,
  - walidacja przez `auth.getUser()`, nie tylko przez samo zdekodowanie tokenu.
- **Autoryzacja**:
  - endpoint jest wyłącznie dla `app_role = 'admin'`,
  - ukrycie linku w UI nie może być jedyną ochroną.
- **Dostęp do danych systemowych**:
  - odczyt `auth.users` wymaga podwyższonych uprawnień,
  - klient service-role może zostać użyty dopiero po pozytywnej walidacji admina.
- **Minimalizacja danych**:
  - endpoint nie powinien zwracać:
    - pełnych metadanych auth,
    - tokenów,
    - informacji o providerach,
    - innych pól konta niewymaganych przez UI.
- **Ochrona przed wstrzyknięciem**:
  - `sort_by` i `sort_dir` wyłącznie z allowlisty,
  - brak dynamicznego budowania SQL z surowych parametrów użytkownika.
- **Spójność źródła roli**:
  - nie należy wprowadzać osobnego, UI-only źródła roli tylko na potrzeby listy użytkowników,
  - endpoint musi korzystać z tego samego źródła, które zasila `app_role`.
- **CORS i przeglądarka**:
  - zastosować ten sam wzorzec CORS, co w innych funkcjach Edge używanych z Angulara.

## 6. Obsługa błędów

### 6.1 Scenariusze błędów i kody statusu

- `400 Bad Request`
  - niepoprawne `page`,
  - niepoprawne `page_size`,
  - niedozwolone `sort_by`,
  - niedozwolone `sort_dir`.
- `401 Unauthorized`
  - brak nagłówka `Authorization`,
  - token nieważny lub wygasły,
  - niespójny kontekst JWT vs `auth.getUser()`.
- `403 Forbidden`
  - token poprawny, ale `app_role !== 'admin'`.
- `404 Not Found`
  - nieznana ścieżka w obrębie funkcji `admin`,
  - ten kod nie jest potrzebny dla pustej listy użytkowników; pusta lista nadal zwraca `200`.
- `500 Internal Server Error`
  - błąd RPC,
  - błąd połączenia z bazą,
  - nieoczekiwany błąd mapowania danych,
  - błąd odczytu z `auth.users`.

### 6.2 Kontrakt błędów

Warto zachować istniejący standard funkcji Edge:

```json
{
  "code": "FORBIDDEN",
  "message": "Admin role is required"
}
```

Dla walidacji query params rekomendowany komunikat:

```json
{
  "code": "BAD_REQUEST",
  "message": "Nieprawidłowe parametry paginacji lub sortowania."
}
```

### 6.3 Logowanie i rejestrowanie błędów

Repo ma już wzorzec użycia loggera w funkcjach Edge, dlatego rekomendacja jest następująca:

- `logger.info`
  - początek i koniec udanego requestu,
  - parametry techniczne requestu po normalizacji,
- `logger.warn`
  - błędy walidacji,
  - brak autoryzacji,
  - próby dostępu bez roli admin,
- `logger.error`
  - błędy nieoczekiwane,
  - wyjątki RPC / bazy / klienta Supabase.

Brak przesłanek, że w repo istnieje dedykowana tabela błędów do zapisu operational logs, więc:

- nie planować osobnego rejestrowania w tabeli błędów,
- polegać na istniejącym `logger` oraz logach Edge Functions,
- jeśli w przyszłości pojawi się wymóg audytu admina, lepszym kierunkiem będzie osobny mechanizm audit log niż przeciążanie ogólnej tabeli błędów.

## 7. Wydajność

- paginacja musi pozostać po stronie serwera; frontend nie powinien pobierać pełnej listy użytkowników,
- domyślny `page_size = 25` jest właściwy dla MVP i UI tabelarycznego,
- warto ograniczyć maksymalny `page_size`, np. do `100`,
- implementacja powinna unikać:
  - pobierania wszystkich użytkowników do pamięci Edge Function,
  - osobnych zapytań per użytkownik do policzenia `recipes_count`,
  - ręcznego sortowania już pobranych rekordów w kodzie TypeScript.

Rekomendacje optymalizacyjne:

- wykorzystać jedno zapytanie SQL/RPC z agregacją,
- zapewnić stabilny plan zapytania dla `recipes_count`:
  - istniejący indeks `recipes(user_id)` pomaga,
  - opcjonalnie dodać częściowy indeks pod adminowe agregacje:
    - `create index if not exists recipes_user_id_not_deleted_idx on public.recipes(user_id) where deleted_at is null;`
- przy sortowaniu po `last_sign_in_at` stosować jawne `NULLS LAST`,
- jeśli liczba użytkowników znacząco wzrośnie w kolejnych iteracjach, można rozważyć:
  - widok/materialized view dla agregacji,
  - cache krótkiego TTL po stronie serwisu admina,
  - osobny admin analytics pipeline.

## 8. Kroki implementacji

1. Rozszerzyć `shared/contracts/types.ts` o:
   - `AdminUsersSortBy`,
   - `SortDirection`,
   - `GetAdminUsersQueryDto`,
   - `AdminUserListItemDto`,
   - `GetAdminUsersResponseDto`.
2. Rozszerzyć `supabase/functions/admin/admin.handlers.ts`:
   - dodać routing `GET /admin/users`,
   - dodać walidację query params,
   - zachować istniejący wzorzec `requireAdminContext(req)`,
   - zwracać `405` dla metod innych niż `GET`.
3. Rozszerzyć `supabase/functions/admin/admin.service.ts`:
   - dodać `getAdminUsers(...)`,
   - wydzielić mapowanie wyniku RPC do DTO,
   - utrzymać brak logiki HTTP w serwisie.
4. Dodać po stronie bazy nową migrację z funkcją RPC lub widokiem/RPC:
   - pobierającą dane z `auth.users`, `profiles` i `recipes`,
   - liczącą tylko aktywne przepisy,
   - obsługującą sortowanie po allowliście,
   - zwracającą `totalItems` do paginacji.
5. Użyć klienta service-role wyłącznie po udanym przejściu guardu admina:
   - nie wykonywać żadnych odczytów danych adminowych przed walidacją JWT i roli.
6. Zaktualizować dokumentację funkcji `supabase/functions/admin/README.md`:
   - dopisać `GET /admin/users`,
   - opisać query params, odpowiedź i kody błędów.
7. Dodać testy manualne do `supabase/functions/admin/test-requests.http`:
   - `200 OK` dla admina,
   - `400` dla błędnych query params,
   - `401` bez tokenu,
   - `403` dla roli `user` lub `premium`,
   - `405` dla złej metody.
8. Rozszerzyć frontendową warstwę integracyjną `src/app/core/services/admin-api.service.ts`:
   - dodać metodę `getUsers(query)`,
   - mapować błędy funkcji Edge do statusów używanych przez UI.
9. Przygotować backend pod przyszłe rozszerzenia bez łamania kontraktu:
   - filtrowanie,
   - wyszukiwanie,
   - szczegóły użytkownika,
   - akcje administracyjne.
