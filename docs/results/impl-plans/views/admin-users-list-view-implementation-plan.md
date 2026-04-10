# Plan implementacji widoku Admin Users List

## 1. Przegląd
Widok `Admin Users List` ma zastąpić obecny placeholder pod ścieżką `/admin/users` rzeczywistym ekranem tylko do odczytu, który pozwala administratorowi przeglądać listę wszystkich kont w systemie. Ekran ma być osadzony w istniejącym layoucie sekcji administracyjnej, korzystać z Angular Material i opierać się na server-side pagination oraz server-side sorting.

Zakres MVP obejmuje:
- wyświetlenie tabeli użytkowników z kompletem uzgodnionych kolumn,
- domyślne sortowanie po dacie rejestracji malejąco,
- zmianę sortowania po dozwolonych kolumnach,
- paginację po 25 rekordów,
- obsługę stanów: ładowanie, pusty wynik, błąd,
- pełne zachowanie ochrony admin-only już istniejącej w routingu i backendzie.

Poza zakresem MVP pozostają:
- wyszukiwarka,
- filtry,
- segmentacja po roli lub statusie,
- akcje na wierszu,
- widok szczegółów użytkownika,
- eksport danych.

## 2. Routing widoku
Docelowa ścieżka widoku pozostaje bez zmian:
- `/admin/users`

Aktualny stan aplikacji:
- trasa istnieje już w `src/app/pages/admin/admin.routes.ts`,
- trasa jest osadzona w `AdminLayoutComponent`,
- dla gościa istnieje już przekierowanie na `/login?returnUrl=%2Fadmin%2Fusers`,
- dostęp dla zalogowanego użytkownika bez roli `admin` jest blokowany przez istniejący mechanizm admin guard i kończy się przekierowaniem na `/forbidden`.

W ramach wdrożenia widoku nie trzeba zmieniać ścieżki ani architektury routingu. Należy jedynie:
- podmienić komponent placeholdera ładowany dla `path: 'users'`,
- zachować aktywność pozycji `Użytkownicy` w admin aside,
- dopilnować, aby błędy `401` i `403` z API były obsługiwane spójnie z istniejącą ochroną tras.

## 3. Struktura komponentów
Rekomendowana struktura komponentów:

```text
AdminLayoutComponent
└── AdminUsersPageComponent
    ├── AdminUsersPageHeaderComponent
    └── AdminUsersTableComponent
        ├── mat-table
        ├── mat-sort-header
        ├── admin users loading row / progress indicator
        ├── admin users empty state
        ├── admin users error state
        └── mat-paginator
```

Rekomendowany podział odpowiedzialności:
- `AdminUsersPageComponent` jako kontener widoku i właściciel stanu,
- `AdminUsersPageHeaderComponent` jako lekki komponent prezentacyjny dla tytułu i opisu,
- `AdminUsersTableComponent` jako komponent tabeli, który dostaje dane i stan z rodzica oraz emituje zdarzenia sortowania, zmiany strony i ponowienia pobrania,
- `AdminApiService` jako warstwa komunikacji z backendem,
- opcjonalny lokalny facade/store dla widoku, jeśli logika strony zrobi się zbyt rozbudowana.

Jeśli zespół woli mniej plików w MVP, można połączyć nagłówek i tabelę w pojedynczym `AdminUsersPageComponent`, ale nadal warto wydzielić `AdminUsersTableComponent`, bo ułatwi testowanie i dalszą rozbudowę o filtry.

## 4. Szczegóły komponentów
### `AdminUsersPageComponent`
- Opis komponentu: główny kontener widoku `/admin/users`. Odpowiada za inicjalne pobranie danych, utrzymanie stanu ekranu, reagowanie na zmianę sortowania i paginacji oraz mapowanie DTO z API do ViewModelu tabeli.
- Główne elementy:
  - wrapper strony osadzony w layoucie admina,
  - `pych-admin-users-page-header`,
  - `pych-admin-users-table`.
- Obsługiwane interakcje:
  - inicjalne ładowanie widoku,
  - zmiana sortowania z tabeli,
  - zmiana strony z paginatora,
  - kliknięcie przycisku `Spróbuj ponownie` w stanie błędu.
- Warunki walidacji:
  - startowe query musi odpowiadać kontraktowi API: `page = 1`, `page_size = 25`, `sort_by = 'created_at'`, `sort_dir = 'desc'`,
  - przy zmianie sortowania trzeba zawsze resetować stronę do pierwszej,
  - komponent nie może wykonywać żadnych lokalnych operacji typu client-side sort lub client-side page slicing,
  - przy ponownym pobraniu należy utrzymać poprzednie dane widoczne pod obniżoną przezroczystością, zamiast czyścić tabelę i powodować flash.
- Typy:
  - `GetAdminUsersQueryDto`,
  - `GetAdminUsersResponseDto`,
  - `AdminUserListItemDto`,
  - nowy `AdminUsersPageStateVm`,
  - nowy `AdminUsersTableRowVm`.
- Propsy:
  - brak, komponent routowalny.

### `AdminUsersPageHeaderComponent`
- Opis komponentu: prezentacyjny nagłówek strony wyświetlający tytuł `Użytkownicy` i krótki opis celu widoku.
- Główne elementy:
  - nagłówek sekcji, np. `header` lub `section`,
  - `h1`,
  - akapit/opis pomocniczy.
- Obsługiwane interakcje:
  - brak interakcji w MVP.
- Warunki walidacji:
  - brak walidacji domenowej,
  - tekst ma jasno komunikować, że ekran pokazuje podstawowe informacje o zarejestrowanych kontach i nie udostępnia akcji edycyjnych.
- Typy:
  - opcjonalny prosty interfejs wejściowy `AdminUsersPageHeaderProps`.
- Propsy:
  - `title: string`,
  - `description: string`.

### `AdminUsersTableComponent`
- Opis komponentu: renderuje tabelę użytkowników, nagłówki sortowalne, stany ładowania, pustej listy i błędu oraz paginator pod tabelą.
- Główne elementy:
  - kontener tabeli z dopuszczonym poziomym przewijaniem na węższych ekranach,
  - `table mat-table`,
  - definicje kolumn:
    - `id`,
    - `login`,
    - `username`,
    - `createdAt`,
    - `lastSignInAt`,
    - `recipesCount`,
    - `role`,
  - `mat-sort-header` dla kolumn sortowalnych,
  - wskaźnik ładowania w obrębie kontenera tabeli,
  - stan pusty,
  - stan błędu z przyciskiem retry,
  - `mat-paginator`.
- Obsługiwane interakcje:
  - kliknięcie nagłówka sortowalnej kolumny,
  - przejście do kolejnej lub poprzedniej strony,
  - kliknięcie `Spróbuj ponownie`,
  - najechanie na skrócone ID, jeśli zastosowany zostanie tooltip z pełnym UUID.
- Warunki walidacji:
  - tylko kolumny `login`, `created_at`, `last_sign_in_at`, `recipes_count` mogą emitować zmianę sortowania,
  - kolumny `id`, `username`, `role` pozostają niesortowalne w MVP,
  - brakujące `last_sign_in_at` musi zostać wyrenderowane jako `Nigdy`,
  - `recipes_count` musi być prezentowane jako liczba całkowita, wyrównana spójnie z danymi liczbowymi,
  - rola musi prezentować wyłącznie wartości pochodzące z `AppRole`,
  - tabela nie może pokazywać akcji, linków do szczegółów ani checkboxów.
- Typy:
  - `AdminUsersTableRowVm[]`,
  - `AdminUsersTableStateVm`,
  - `AdminUsersSortChangeEvent`,
  - `AdminUsersPageChangeEvent`,
  - `AdminUsersSortBy`,
  - `SortDirection`.
- Propsy:
  - `rows: AdminUsersTableRowVm[]`,
  - `state: AdminUsersTableStateVm`,
  - `pagination: { currentPage: number; pageSize: number; totalPages: number; totalItems: number }`,
  - `sorting: { sort_by: AdminUsersSortBy; sort_dir: SortDirection }`,
  - `displayedColumns: readonly string[]`.

### `AdminUsersTableEmptyStateComponent` lub inline empty state
- Opis komponentu: renderuje komunikat, gdy backend zwróci pustą listę użytkowników.
- Główne elementy:
  - prosty kontener komunikatu,
  - opcjonalna ikona Material.
- Obsługiwane interakcje:
  - brak.
- Warunki walidacji:
  - stan pusty pojawia się tylko wtedy, gdy `data.length === 0`, brak błędu i nie trwa pierwsze ładowanie.
- Typy:
  - brak konieczności osobnych DTO; wystarczy prosty input z tekstem.
- Propsy:
  - `message: string`.

### `AdminUsersTableErrorStateComponent` lub inline error state
- Opis komponentu: renderuje osadzony w stronie komunikat błędu oraz przycisk ponownego pobrania.
- Główne elementy:
  - blok błędu w obrębie kontenera tabeli,
  - przycisk `Spróbuj ponownie`.
- Obsługiwane interakcje:
  - kliknięcie `Spróbuj ponownie`.
- Warunki walidacji:
  - komunikat ma być biznesowy i bez szczegółów technicznych backendu,
  - przy `403` komponent nie powinien tylko wyświetlić błędu; nadrzędna warstwa powinna przekierować na `/forbidden`,
  - przy `401` należy skierować użytkownika do ponownego logowania z zachowaniem `returnUrl`.
- Typy:
  - `AdminUsersPageErrorVm`.
- Propsy:
  - `message: string`,
  - `canRetry: boolean`.

## 5. Typy
### Istniejące DTO i typy kontraktowe do użycia
- `AppRole = 'user' | 'premium' | 'admin'`
- `AdminUsersSortBy = 'created_at' | 'login' | 'last_sign_in_at' | 'recipes_count'`
- `SortDirection = 'asc' | 'desc'`
- `GetAdminUsersQueryDto`
- `AdminUserListItemDto`
- `GetAdminUsersResponseDto`

### Rekomendowane nowe typy ViewModel
`AdminUsersTableRowVm`
- `id: string`
  - pełny UUID użytkownika wykorzystywany jako stabilny identyfikator wiersza.
- `displayId: string`
  - tekst pokazywany w tabeli; może być pełnym UUID albo skróconą formą, np. pierwsze i ostatnie znaki.
- `login: string`
  - e-mail logowania do bezpośredniego wyświetlenia.
- `username: string`
  - nazwa użytkownika do wyświetlenia.
- `createdAt: string`
  - surowa wartość ISO przydatna np. do a11y, testów lub tooltipa.
- `createdAtLabel: string`
  - sformatowana lokalnie data i czas do renderu w tabeli.
- `lastSignInAt: string | null`
  - surowa wartość ISO lub `null`.
- `lastSignInAtLabel: string`
  - wartość do renderu, np. sformatowana data albo `Nigdy`.
- `recipesCount: number`
  - liczba aktywnych przepisów.
- `role: AppRole`
  - źródłowa rola użytkownika.
- `roleLabel: string`
  - etykieta do wyświetlenia; w MVP może być taka sama jak `role`.
- `roleTone: 'default' | 'accent' | 'warn' | 'neutral'`
  - opcjonalna pomocnicza informacja do stylowania chipa roli.

`AdminUsersTableStateVm`
- `isInitialLoading: boolean`
  - `true` tylko podczas pierwszego pobrania bez danych.
- `isRefreshing: boolean`
  - `true` podczas pobierania kolejnych stron lub zmiany sortowania, gdy poprzednie dane pozostają widoczne.
- `isEmpty: boolean`
  - czy należy pokazać pusty stan.
- `hasError: boolean`
  - czy należy pokazać błąd.
- `errorMessage: string | null`
  - tekst komunikatu błędu.

`AdminUsersPageStateVm`
- `query: Required<GetAdminUsersQueryDto>`
  - bieżący zestaw parametrów wysyłanych do API.
- `rows: AdminUsersTableRowVm[]`
  - aktualnie wyrenderowane wiersze tabeli.
- `pagination: GetAdminUsersResponseDto['pagination']`
  - metadane paginatora.
- `sorting: GetAdminUsersResponseDto['sorting']`
  - aktualne sortowanie potwierdzone przez backend.
- `isInitialLoading: boolean`
- `isRefreshing: boolean`
- `errorMessage: string | null`

`AdminUsersSortChangeEvent`
- `sort_by: AdminUsersSortBy`
- `sort_dir: SortDirection`

`AdminUsersPageChangeEvent`
- `page: number`
- `page_size: number`

### Mapowanie DTO -> ViewModel
Mapowanie w warstwie strony lub dedykowanym mapperze powinno wyglądać następująco:
- `dto.id` -> `vm.id`, `vm.displayId`
- `dto.login` -> `vm.login`
- `dto.username` -> `vm.username`
- `dto.created_at` -> `vm.createdAt`, `vm.createdAtLabel`
- `dto.last_sign_in_at` -> `vm.lastSignInAt`, `vm.lastSignInAtLabel`
- `dto.recipes_count` -> `vm.recipesCount`
- `dto.role` -> `vm.role`, `vm.roleLabel`, opcjonalnie `vm.roleTone`

Dzięki temu komponent tabeli pozostaje prosty i renderuje wyłącznie gotowe dane do wyświetlenia.

## 6. Zarządzanie stanem
Projektowe reguły preferują Angular Signals, więc stan widoku powinien być oparty o sygnały, a nie o lokalny strumień RxJS jako główny mechanizm prezentacyjny.

Rekomendowany stan w `AdminUsersPageComponent`:
- `query = signal<Required<GetAdminUsersQueryDto>>({ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' })`
- `rows = signal<AdminUsersTableRowVm[]>([])`
- `pagination = signal<GetAdminUsersResponseDto['pagination']>({ currentPage: 1, pageSize: 25, totalPages: 0, totalItems: 0 })`
- `sorting = signal<GetAdminUsersResponseDto['sorting']>({ sort_by: 'created_at', sort_dir: 'desc' })`
- `isInitialLoading = signal<boolean>(true)`
- `isRefreshing = signal<boolean>(false)`
- `errorMessage = signal<string | null>(null)`

Rekomendowane `computed`:
- `tableState = computed<AdminUsersTableStateVm>(...)`
- `hasRows = computed(() => rows().length > 0)`
- `isEmpty = computed(() => !isInitialLoading() && !isRefreshing() && !errorMessage() && rows().length === 0)`

Rekomendowany przepływ stanu:
1. Po wejściu na stronę uruchamia się `loadUsers(query())`.
2. Jeśli brak danych, ustawiane jest `isInitialLoading = true`.
3. Jeśli dane już istnieją i użytkownik zmienia sortowanie lub stronę, ustawiane jest `isRefreshing = true`, ale `rows()` pozostają widoczne.
4. Po sukcesie stan aktualizuje `rows`, `pagination`, `sorting`, zeruje błąd i kończy loading.
5. Po błędzie:
   - jeśli to pierwszy load, pokazuje się stan błędu zamiast tabeli,
   - jeśli to refresh, można zachować stare dane i dodatkowo pokazać osadzony komunikat.

Custom hook nie jest wymagany, bo to Angular, nie React. Jeżeli potrzebne będzie wydzielenie logiki, lepsze będą:
- lokalny `facade` lub `ComponentStore`,
- prywatne metody w komponencie strony,
- ewentualnie mały helper-mapper do formatowania DTO.

## 7. Integracja API
### Endpoint
Widok korzysta z admin-only endpointu:
- `GET /admin/users`

Po stronie frontendu wywołanie powinno być realizowane wyłącznie przez Edge Functions, zgodnie z regułami projektu:
- `supabase.functions.invoke(...)`
- bez bezpośredniego `supabase.from(...)`
- bez bezpośredniego `supabase.rpc(...)` z frontendu

### Rozszerzenie `AdminApiService`
Istniejący `src/app/core/services/admin-api.service.ts` należy rozszerzyć o metodę:
- `getUsers(query: GetAdminUsersQueryDto): Observable<GetAdminUsersResponseDto>`

Rekomendowane zachowanie metody:
- budowanie query string z `page`, `page_size`, `sort_by`, `sort_dir`,
- wywołanie `admin/users?...` metodą `GET`,
- mapowanie błędów Edge Function do obiektu `Error` z opcjonalnym `status`,
- rzucanie błędu, jeśli `response.data` jest puste mimo braku `response.error`.

### Request DTO
`GetAdminUsersQueryDto`
- `page?: number`
- `page_size?: number`
- `sort_by?: AdminUsersSortBy`
- `sort_dir?: SortDirection`

Wartości startowe dla widoku:
- `page = 1`
- `page_size = 25`
- `sort_by = 'created_at'`
- `sort_dir = 'desc'`

### Response DTO
`GetAdminUsersResponseDto`
- `data: AdminUserListItemDto[]`
- `pagination.currentPage: number`
- `pagination.pageSize: number`
- `pagination.totalPages: number`
- `pagination.totalItems: number`
- `sorting.sort_by: AdminUsersSortBy`
- `sorting.sort_dir: SortDirection`

`AdminUserListItemDto`
- `id: string`
- `login: string`
- `username: string`
- `role: AppRole`
- `created_at: string`
- `last_sign_in_at: string | null`
- `recipes_count: number`

### Mapowanie akcji frontendowych na API
- wejście na stronę -> `GET /admin/users?page=1&page_size=25&sort_by=created_at&sort_dir=desc`
- zmiana sortowania -> ponowne `GET /admin/users` z nowym sortowaniem i `page=1`
- zmiana strony -> ponowne `GET /admin/users` z bieżącym sortowaniem i nowym `page`
- retry po błędzie -> ponowne `GET /admin/users` z ostatnim poprawnym stanem `query`

## 8. Interakcje użytkownika
1. Administrator otwiera `/admin/users`.
   Wynik: widzi nagłówek strony i tabelę użytkowników albo stan ładowania.

2. Administrator widzi domyślnie najnowsze konta na górze.
   Wynik: sortowanie startowe to `created_at desc`.

3. Administrator klika nagłówek `Login`.
   Wynik: widok ponownie pobiera dane z `sort_by=login`; kierunek sortowania przełącza się zgodnie z zachowaniem Material Sort.

4. Administrator klika nagłówek `Data ostatniego logowania`.
   Wynik: dane są pobierane ponownie z `sort_by=last_sign_in_at`; wartości `null` nie psują widoku i nadal renderują się jako `Nigdy`.

5. Administrator klika nagłówek `Liczba przepisów`.
   Wynik: tabela ładuje dane posortowane po `recipes_count`.

6. Administrator przechodzi na kolejną stronę paginatora.
   Wynik: widok pobiera następną stronę, zachowując aktualne sortowanie.

7. Endpoint zwraca pustą listę.
   Wynik: zamiast pustej tabeli renderuje się czytelny empty state.

8. Endpoint zwraca błąd sieciowy lub błąd serwera.
   Wynik: widok pokazuje komunikat błędu w kontekście strony i udostępnia retry.

9. Administrator widzi użytkownika bez daty ostatniego logowania.
   Wynik: w kolumnie `Data ostatniego logowania` pojawia się `Nigdy`.

10. Użytkownik bez roli admin próbuje wejść bezpośrednio na URL.
   Wynik: zostaje zablokowany przez istniejący guard i nie otrzymuje dostępu do danych.

## 9. Warunki i walidacja
### Warunki wynikające z API
- `page` musi być liczbą całkowitą większą lub równą `1`.
- `page_size` musi być liczbą całkowitą większą od `0`; w MVP widok powinien używać `25`.
- `sort_by` może przyjmować wyłącznie:
  - `created_at`,
  - `login`,
  - `last_sign_in_at`,
  - `recipes_count`.
- `sort_dir` może przyjmować wyłącznie:
  - `asc`,
  - `desc`.

### Walidacja i kontrola po stronie komponentów
- komponent tabeli nie powinien emitować zdarzeń sortowania dla niedozwolonych kolumn,
- komponent strony powinien normalizować i pilnować stanu `query` przed wywołaniem API,
- zmiana sortowania resetuje numer strony do `1`,
- zmiana strony nie modyfikuje wybranego sortowania,
- `pageSize` powinno być zablokowane do `25`, jeśli w MVP nie planujemy selektora rozmiaru strony,
- `last_sign_in_at === null` musi być zmapowane do etykiety `Nigdy`,
- `recipes_count` musi być traktowane jako liczba, nie tekst.

### Warunki biznesowe wpływające na UI
- widok jest wyłącznie do odczytu,
- wiersz nie jest linkiem do detalu,
- tabela nie pokazuje menu kontekstowego, checkboxów, przycisków CTA ani akcji masowych,
- wszystkie dane pochodzą z endpointu admin-only i nie są pobierane bezpośrednio z Supabase tabel po stronie frontendu,
- pozycja `Użytkownicy` w admin aside ma pozostać aktywna dla `/admin/users`.

## 10. Obsługa błędów
### Scenariusze błędów
- `401 Unauthorized`
  - możliwa utrata sesji lub nieważny token.
  - reakcja UI: przekierowanie do `/login` z `returnUrl=/admin/users` albo obsługa zgodna z istniejącym wzorcem w sekcji admin.

- `403 Forbidden`
  - użytkownik nie ma roli `admin`.
  - reakcja UI: przekierowanie na `/forbidden`; nie pokazywać zwykłego komunikatu tabeli jako końcowego stanu.

- `400 Bad Request`
  - frontend wysłał błędne parametry paginacji lub sortowania.
  - reakcja UI: komunikat biznesowy typu `Nie udało się pobrać listy użytkowników. Odśwież widok lub spróbuj ponownie.`; dodatkowo warto zalogować szczegóły techniczne w konsoli developerskiej.

- `500 Internal Server Error` lub błąd sieci
  - problem po stronie Edge Function, RPC albo połączenia.
  - reakcja UI: osadzony komunikat błędu + retry.

### Zasady UX dla błędów i ładowania
- nie czyścić danych tabeli przy każdym odświeżeniu,
- nie używać białych półprzezroczystych overlayów; zgodnie z regułami projektu lepiej obniżyć `opacity` kontenera danych podczas refreshu,
- komunikaty błędów nie powinny ujawniać szczegółów technicznych backendu,
- układ strony ma pozostać stabilny niezależnie od stanu,
- empty state i error state muszą być rozłączne.

### Potencjalne przypadki brzegowe
- użytkownik bez `last_sign_in_at`,
- bardzo długie adresy e-mail lub UUID pogarszające czytelność kolumn,
- `username` pusty lub nietypowy, jeśli backend zwróci historyczne dane niespójne z walidacją,
- szybkie, wielokrotne kliknięcia w sortowanie lub paginator,
- odpowiedź z backendu niespójna z oczekiwanym kontraktem.

Rekomendowane zabezpieczenia:
- mapowanie defensive z fallbackiem dla brakujących pól tekstowych,
- blokada wielokrotnego wywołania tej samej akcji podczas aktywnego requestu albo bezpieczne nadpisywanie poprzedniego requestu,
- `trackBy` po `id` dla stabilnego renderowania wierszy,
- opcjonalne skracanie UUID i ellipsis dla długich wartości.

## 11. Kroki implementacji
1. Przeanalizować aktualny placeholder `AdminUsersPlaceholderPageComponent` i potwierdzić, że jego podmiana nie wymaga zmian w routingu ani w `ADMIN_NAV_ITEMS`.

2. Utworzyć docelowy komponent strony, np. `AdminUsersPageComponent`, jako standalone component z `ChangeDetectionStrategy.OnPush`.

3. Podmienić wpis w `src/app/pages/admin/admin.routes.ts`, aby `path: 'users'` ładował nowy komponent zamiast placeholdera.

4. Rozszerzyć `src/app/core/services/admin-api.service.ts` o metodę `getUsers(query: GetAdminUsersQueryDto): Observable<GetAdminUsersResponseDto>`, budującą query string i wywołującą `admin/users` przez `supabase.functions.invoke(...)`.

5. W komponencie strony zaimplementować stan oparty o signals:
   - bieżące query,
   - dane tabeli,
   - metadane paginacji,
   - stan pierwszego ładowania,
   - stan odświeżania,
   - komunikat błędu.

6. Dodać mapper DTO -> ViewModel odpowiedzialny za:
   - formatowanie dat,
   - zamianę `null` na `Nigdy`,
   - ewentualne skrócenie UUID do czytelniejszej formy,
   - przygotowanie danych do renderowania roli jako tekst lub chip.

7. Zaimplementować nagłówek strony zgodny z planem UI:
   - tytuł `Użytkownicy`,
   - krótki opis,
   - brak akcji CTA.

8. Zaimplementować tabelę Angular Material:
   - ustalić `displayedColumns`,
   - dodać sortowanie tylko dla dozwolonych kolumn,
   - dodać paginator z rozmiarem strony `25`,
   - dopilnować dostępności i czytelności na desktopie.

9. Dodać obsługę stanów widoku:
   - loading pierwszego załadowania,
   - refresh z zachowaniem poprzednich danych,
   - empty state,
   - error state z retry.

10. Dostosować responsywność:
   - zachować komplet kolumn,
   - dopuścić poziome przewijanie tabeli na mniejszych szerokościach,
   - nie usuwać kolumn tylko po to, by zmieścić tabelę na wąskim ekranie.

11. Spiąć obsługę błędów autoryzacyjnych z istniejącą logiką aplikacji:
   - `401` -> powrót do logowania,
   - `403` -> `/forbidden`,
   - inne błędy -> komunikat lokalny + retry.

12. Dodać testy jednostkowe i ewentualnie integracyjne:
   - `AdminApiService.getUsers()` poprawnie buduje request i mapuje błędy,
   - `AdminUsersPageComponent` ładuje dane startowe z domyślnym query,
   - zmiana sortowania resetuje stronę do `1`,
   - zmiana strony zachowuje sortowanie,
   - `last_sign_in_at = null` renderuje `Nigdy`,
   - empty state pojawia się dla pustej odpowiedzi,
   - error state pojawia się dla błędu nieautoryzacyjnego.

13. Uruchomić weryfikację lintera i testów dla zmienionych plików oraz ręcznie sprawdzić scenariusze:
   - admin otwiera `/admin/users`,
   - admin sortuje po każdej dozwolonej kolumnie,
   - admin przechodzi między stronami,
   - pusty wynik,
   - błąd endpointu,
   - wejście bez uprawnień admina.
