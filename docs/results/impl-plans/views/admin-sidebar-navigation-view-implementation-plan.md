# Plan implementacji widoku Admin Sidebar Navigation

## 1. Przegląd
Celem wdrożenia jest rozbudowa sekcji administracyjnej `/admin/*` o wspólny layout z lewym aside, który umożliwi administratorowi przełączanie się między widokami `Dashboard` i `Użytkownicy` bez opuszczania panelu admina. Rozwiązanie ma zachować istniejący model bezpieczeństwa oparty o rolę `admin`, pozostać spójne z wzorcem nawigacji bocznej używanym w sekcji „Moja Pycha” i być gotowe na przyszłe dodawanie kolejnych sekcji administracyjnych.

Zakres MVP obejmuje:
- wspólny kontener tras `/admin/*`,
- nowy komponent aside z aktywną nawigacją opartą o routing,
- osadzenie istniejącego `AdminDashboardPageComponent` we wspólnym layoucie,
- dodanie placeholderowego widoku `/admin/users`,
- zachowanie ochrony tras dla wszystkich podstron administracyjnych,
- brak pobierania listy użytkowników i brak zmian w modelu danych użytkowników.

## 2. Routing widoku

### Docelowe ścieżki
- `/admin` - kontener sekcji administracyjnej, przekierowanie do `/admin/dashboard`.
- `/admin/dashboard` - dashboard administracyjny osadzony we wspólnym layoucie admina.
- `/admin/users` - placeholder widoku użytkowników osadzony we wspólnym layoucie admina.

### Założenia routingu
- Główny wpis `path: 'admin'` pozostaje lazy-loaded w `src/app/app.routes.ts`.
- Ochrona dostępu pozostaje na poziomie `canMatch: [adminRoleMatchGuard]` dla ścieżki `admin`.
- Redirecty dla gości w grupie `PublicLayoutComponent` powinny obejmować co najmniej:
  - `/admin` -> `/login?returnUrl=%2Fadmin`
  - `/admin/dashboard` -> `/login?returnUrl=%2Fadmin%2Fdashboard`
  - `/admin/users` -> `/login?returnUrl=%2Fadmin%2Fusers`
- W `src/app/pages/admin/admin.routes.ts` należy przejść z płaskiej konfiguracji do układu z trasą kontenerową:
  - `path: ''` -> `AdminLayoutComponent`
  - child `path: ''` -> redirect do `dashboard`
  - child `path: 'dashboard'` -> `AdminDashboardPageComponent`
  - child `path: 'users'` -> `AdminUsersPlaceholderPageComponent`

### Wymagania wynikające z routingu
- Aktywny stan pozycji aside nie może być przechowywany w lokalnym stanie komponentu; musi wynikać bezpośrednio z aktualnej trasy.
- Bezpośrednie wejście na `/admin/dashboard` i `/admin/users` ma renderować poprawny stan aktywny bez dodatkowych akcji użytkownika.
- Rozwiązanie ma być skalowalne pod przyszłe ścieżki typu `/admin/recipes`, `/admin/settings`.

## 3. Struktura komponentów

Proponowana struktura komponentów dla sekcji `/admin/*`:

```text
MainLayoutComponent
└── router-outlet (/admin)
    └── AdminLayoutComponent
        ├── AdminAsideNavComponent
        └── router-outlet
            ├── AdminDashboardPageComponent
            └── AdminUsersPlaceholderPageComponent
```

### Rekomendowana organizacja plików
- `src/app/pages/admin/admin.routes.ts`
- `src/app/pages/admin/admin-layout/admin-layout.component.ts`
- `src/app/pages/admin/components/admin-aside-nav/admin-aside-nav.component.ts`
- `src/app/pages/admin/admin-users-placeholder/admin-users-placeholder-page.component.ts`
- opcjonalnie `src/app/pages/admin/models/admin-navigation.models.ts` dla lokalnych modeli widoku

## 4. Szczegóły komponentów

### `AdminLayoutComponent`
- Opis komponentu:
  - Główny kontener sekcji administracyjnej odpowiedzialny za wspólny układ wszystkich tras potomnych `/admin/*`.
  - Składa się z wrappera layoutu, lewego aside oraz prawego obszaru treści z `router-outlet`.
- Główne elementy HTML i komponenty dzieci:
  - `<section>` lub `<div>` jako główny kontener layoutu.
  - `<aside>` lub kontener semantyczny dla nawigacji.
  - `<pych-admin-aside-nav />`.
  - `<main>` z osadzonym `<router-outlet />`.
- Obsługiwane zdarzenia:
  - Brak własnych zdarzeń domenowych.
  - Opcjonalnie obsługa zamknięcia aside na mniejszych ekranach, jeśli layout będzie korzystał z wariantu drawerowego.
- Warunki walidacji:
  - Layout nie może renderować zawartości jako publicznie dostępnej bez wcześniejszego przejścia przez `adminRoleMatchGuard`.
  - Dla tras potomnych musi zawsze utrzymać wspólną strukturę niezależnie od aktywnej sekcji.
- Typy:
  - `AdminNavItemVm[]`
  - opcjonalnie `AdminLayoutViewModel`
- Propsy:
  - brak inputów w wariancie routowanym,
  - ewentualnie wewnętrznie przekazywane `items` do `AdminAsideNavComponent`.

### `AdminAsideNavComponent`
- Opis komponentu:
  - Komponent odpowiedzialny za lewą nawigację wewnętrzną sekcji admina.
  - Ma odzwierciedlać UX i strukturę istniejącego sidebara z sekcji „Moja Pycha”, ale zawierać wyłącznie pozycje administracyjne.
- Główne elementy HTML i komponenty dzieci:
  - `<aside>` z nagłówkiem sekcji, np. `Admin`.
  - `<nav>` z listą pozycji.
  - `mat-nav-list`, `a[mat-list-item]`, opcjonalnie `mat-icon`.
- Obsługiwane zdarzenia:
  - kliknięcie `Dashboard` -> nawigacja do `/admin/dashboard`,
  - kliknięcie `Użytkownicy` -> nawigacja do `/admin/users`.
- Warunki walidacji:
  - lista pozycji w MVP zawiera dokładnie dwa elementy,
  - aktywny stan musi wynikać z `routerLinkActive` lub logiki opartej o aktualny URL,
  - `/admin/dashboard` aktywuje `Dashboard`,
  - `/admin/users` aktywuje `Użytkownicy`,
  - stan aktywny musi działać po odświeżeniu strony i po wejściu bezpośrednim przez URL.
- Typy:
  - `AdminNavItemVm`
  - opcjonalnie reuse `MainNavigationItem` lub `NavigationItem`, jeśli kontrakt będzie wystarczający; rekomendowane jest jednak użycie dedykowanego typu lokalnego, bo aside admina nie potrzebuje tych samych pól co topbar.
- Propsy:
  - `items: AdminNavItemVm[]`
  - opcjonalnie `sectionTitle: string`

### `AdminDashboardPageComponent`
- Opis komponentu:
  - Istniejący widok dashboardu admina, który po wdrożeniu ma działać jako jedna z podstron nowego layoutu.
  - Na MVP pozostaje placeholderem, ale może nadal korzystać z `AdminApiService` i `GET /admin/summary`.
- Główne elementy HTML i komponenty dzieci:
  - nagłówek strony (`h1`, opis),
  - sekcja akcji z przyciskiem odświeżenia,
  - karta statusu API,
  - siatka kart placeholderowych.
- Obsługiwane zdarzenia:
  - kliknięcie `Odśwież podsumowanie`,
  - wejście na trasę powodujące pobranie danych podsumowania.
- Warunki walidacji:
  - komponent nie powinien odpowiadać za walidację roli; dostęp ma być zablokowany wcześniej przez routing,
  - podczas odświeżania nie wolno czyścić poprzednich danych, jeśli były już załadowane,
  - brak danych z API nie może blokować wyrenderowania samego placeholdera dashboardu.
- Typy:
  - istniejący `AdminSummaryDto`,
  - istniejący lokalny `AdminDashboardState`,
  - `AdminFeatureCard`.
- Propsy:
  - brak.

### `AdminUsersPlaceholderPageComponent`
- Opis komponentu:
  - Nowy widok placeholderowy dla trasy `/admin/users`.
  - Ma sygnalizować miejsce przyszłej funkcjonalności bez sugerowania, że lista użytkowników jest już zaimplementowana.
- Główne elementy HTML i komponenty dzieci:
  - nagłówek strony (`h1`),
  - krótki opis kontekstu sekcji,
  - jedna lub więcej kart/sekcji placeholderowych z komunikatem „funkcjonalność zostanie dodana w kolejnej iteracji”.
- Obsługiwane zdarzenia:
  - brak akcji biznesowych,
  - brak przycisków wykonujących operacje na danych użytkowników.
- Warunki walidacji:
  - komponent nie wykonuje żadnego wywołania API,
  - nie renderuje spinnera, pustej tabeli ani stanu błędu backendu,
  - tekst placeholdera nie może sugerować gotowego zarządzania użytkownikami.
- Typy:
  - opcjonalny lokalny `AdminUsersPlaceholderViewModel`,
  - prosty stały model kart/sekcji placeholderowych, jeśli widok będzie podzielony na kilka bloków.
- Propsy:
  - brak.

## 5. Typy

### Typy istniejące do ponownego użycia
- `AppRole` z `shared/contracts/types.ts`
  - używany pośrednio przez `AuthService` i `adminRoleMatchGuard`,
  - odpowiada za warunek dostępu do sekcji `/admin/*`.
- `AdminSummaryDto` z `shared/contracts/types.ts`
  - używany w `AdminDashboardPageComponent`,
  - pola:
    - `version: string`
    - `generated_at: string`
    - `notes: string`
    - `metrics: { users_total: number | null; recipes_total: number | null; public_recipes_total: number | null }`
- `AdminHealthDto`
  - typ istniejący, ale niewymagany do implementacji tego widoku w MVP.

### Nowe typy ViewModel rekomendowane dla widoku

#### `AdminNavItemVm`
Typ lokalny dla komponentu aside.

Proponowane pola:
- `label: string` - etykieta pozycji, np. `Dashboard`.
- `route: string` - pełna ścieżka, np. `/admin/dashboard`.
- `icon?: string` - opcjonalna ikona Material.
- `matchMode: 'exact' | 'prefix'` - sposób określania aktywności.
- `matchingRoutes?: string[]` - dodatkowe ścieżki aktywujące pozycję.
- `ariaLabel?: string` - etykieta dostępności.

Uzasadnienie:
- typ jest celowo prostszy i bardziej dopasowany do bocznej nawigacji niż globalne modele topbara,
- pozwala łatwo rozwijać sekcję admina o kolejne pozycje bez przebudowy komponentu.

#### `AdminLayoutViewModel`
Opcjonalny typ pomocniczy dla kontenera layoutu.

Proponowane pola:
- `title: string` - tytuł sekcji, np. `Admin`.
- `items: AdminNavItemVm[]` - pozycje aside.
- `isCompact: boolean` - informacja o wariancie responsywnym, jeśli zostanie obsłużony.

Uzasadnienie:
- nie jest obowiązkowy, ale porządkuje dane wejściowe layoutu i ułatwia testowanie.

#### `AdminUsersPlaceholderViewModel`
Opcjonalny model treści placeholdera użytkowników.

Proponowane pola:
- `title: string`
- `description: string`
- `statusLabel: string`
- `sections: Array<{ title: string; description: string }>`

Uzasadnienie:
- pozwala oddzielić treść placeholdera od template i przygotować komponent na późniejszą rozbudowę.

### DTO i modele niewymagane
- Nie są potrzebne nowe DTO backendowe dla widoku `/admin/users`, ponieważ MVP nie pobiera danych użytkowników.
- Nie należy dodawać typów dla listy użytkowników, filtrowania, paginacji ani akcji administracyjnych, ponieważ są one poza zakresem.

## 6. Zarządzanie stanem

### Stan globalny
- Źródłem prawdy dla autoryzacji i roli pozostaje `AuthService`.
- Rola `admin` jest ustalana podczas bootstrapu aplikacji i używana przez guard oraz warunkowe renderowanie wejścia do panelu.

### Stan lokalny sekcji admina
- `AdminLayoutComponent` nie wymaga złożonego stanu biznesowego.
- `AdminAsideNavComponent` nie powinien przechowywać aktywnej pozycji w sygnale lokalnym; aktywność ma wynikać z routera.
- `AdminDashboardPageComponent` może zachować istniejący stan sygnałowy:
  - `summary`
  - `isLoading`
  - `errorMessage`
- `AdminUsersPlaceholderPageComponent` może pozostać komponentem bez stanu lub z prostym stałym modelem widoku.

### Custom hook / store
- W Angularze nie ma potrzeby tworzenia custom hooka w sensie Reactowym.
- Dla tego widoku wystarczą:
  - sygnały (`signal`, `computed`) w komponentach,
  - istniejący `AdminApiService`,
  - routing jako źródło prawdy dla aktywnej nawigacji.
- Dedykowany lokalny store lub serwis typu `AdminLayoutStore` nie jest wymagany w MVP, ale może być dodany później, jeśli sekcja admina zacznie zawierać więcej ekranów i współdzielonych stanów.

## 7. Integracja API

### Wymagane wywołania API
- `GET /admin/summary`
  - użycie: tylko `AdminDashboardPageComponent`,
  - cel: pobranie placeholderowego podsumowania dashboardu,
  - request:
    - metoda `GET`,
    - body: brak,
    - autoryzacja: JWT użytkownika admina,
  - response `200`: `AdminSummaryDto`.

### Wywołania niewymagane dla tego widoku
- `/admin/users` nie wykonuje żadnego requestu.
- Nie należy dodawać endpointu listy użytkowników ani próbować pobierać danych z Supabase bezpośrednio z frontendu.

### Akcje frontendowe powiązane z API
- wejście na `/admin/dashboard`:
  - inicjalizacja pobrania summary,
  - ustawienie stanu ładowania,
  - utrzymanie poprzednich danych podczas odświeżania.
- kliknięcie `Odśwież podsumowanie`:
  - ponowne wywołanie `GET /admin/summary`,
  - aktualizacja `summary` po sukcesie,
  - ustawienie `errorMessage` przy błędzie.

### Integracja zgodna z regułami projektu
- Wywołanie musi przechodzić przez `AdminApiService` i `supabase.functions.invoke(...)`.
- Frontend nie może wykonywać `supabase.from(...)` ani bezpośrednich zapytań do tabel.

## 8. Interakcje użytkownika

### Nawigacja w aside
- Użytkownik wchodzi na `/admin`.
  - Oczekiwany wynik: redirect do `/admin/dashboard`, aktywna pozycja `Dashboard`.
- Użytkownik klika `Dashboard`.
  - Oczekiwany wynik: render dashboardu w tym samym layoucie admina.
- Użytkownik klika `Użytkownicy`.
  - Oczekiwany wynik: render placeholdera użytkowników w tym samym layoucie admina.
- Użytkownik odświeża stronę na `/admin/users`.
  - Oczekiwany wynik: nadal widzi layout admina i aktywną pozycję `Użytkownicy`.

### Interakcje na dashboardzie
- Użytkownik klika `Odśwież podsumowanie`.
  - Oczekiwany wynik: przycisk przechodzi w stan disabled podczas requestu, UI zachowuje poprzednie dane, po sukcesie aktualizuje kartę podsumowania.

### Interakcje niedostępne w MVP
- Brak przechodzenia do listy użytkowników, filtrów, akcji edycji, zmiany ról i wyszukiwania.
- Brak akcji z placeholdera użytkowników poza samym odczytem komunikatu.

## 9. Warunki i walidacja

### Warunki dostępu
- Wszystkie trasy `/admin/*` są dostępne wyłącznie dla użytkownika z rolą `admin`.
- Użytkownik zalogowany bez roli `admin`:
  - wejście na `/admin`, `/admin/dashboard`, `/admin/users` -> przekierowanie do `/forbidden`.
- Użytkownik niezalogowany:
  - wejście na `/admin`, `/admin/dashboard`, `/admin/users` -> przekierowanie do `/login` z odpowiednim `returnUrl`.

### Warunki UI
- Aside admina zawiera dokładnie dwie pozycje w MVP.
- Stan aktywny musi odpowiadać bieżącej trasie, a nie lokalnemu kliknięciu.
- `AdminUsersPlaceholderPageComponent` nie pokazuje:
  - spinnera,
  - błędu API,
  - tabeli użytkowników,
  - akcji administracyjnych.
- Dashboard może pokazywać stan błędu i stan ładowania, ale nie może tracić podstawowego placeholderowego układu.

### Warunki wynikające z API
- `GET /admin/summary` wymaga poprawnego JWT i roli `admin`.
- Błąd `401` oznacza problem z sesją i wymaga przekierowania do logowania.
- Błąd `403` powinien być obsłużony spójnie z guardem i prowadzić do `/forbidden`.

## 10. Obsługa błędów

### Błędy autoryzacji i routingu
- Brak uprawnień admina:
  - routing blokuje wejście,
  - użytkownik trafia na `/forbidden`.
- Brak zalogowania:
  - użytkownik trafia na `/login` z zachowaniem `returnUrl`.
- Bezpośrednie wejście na nieobsługiwaną ścieżkę pod `/admin/*`:
  - rekomendowane jest pozostawienie standardowej obsługi Angular Router, a w kolejnej iteracji rozważenie dedykowanego `admin/not-found`, jeśli sekcja się rozrośnie.

### Błędy API dashboardu
- `401 Unauthorized`
  - przekierowanie do `/login` z `returnUrl=/admin/dashboard`.
- `403 Forbidden`
  - przekierowanie do `/forbidden`.
- `500` lub błąd sieci
  - pokazanie czytelnego komunikatu w dashboardzie,
  - zachowanie layoutu i kart placeholderowych,
  - możliwość ponowienia akcji przez przycisk odświeżenia.

### Edge case'y
- Opóźnione ustalenie roli po bootstrapie:
  - UI nie powinno pokazywać sekcji admina jako dostępnej, dopóki routing nie potwierdzi dostępu.
- Odświeżenie w trakcie pobierania danych:
  - komponent dashboardu powinien poprawnie wrócić do stanu ładowania po reinstancji.
- Rozszerzenie listy pozycji admina w przyszłości:
  - komponent aside nie powinien mieć logiki zaszytej pod dokładnie dwa hardcoded widoki poza konfiguracją danych wejściowych.

## 11. Kroki implementacji

1. Rozszerzyć `src/app/pages/admin/admin.routes.ts` o wspólny kontener `AdminLayoutComponent` i trasę potomną `users`.
2. Utworzyć `AdminLayoutComponent` jako standalone component z `ChangeDetectionStrategy.OnPush`, `inject()` i `router-outlet` dla podstron admina.
3. Utworzyć `AdminAsideNavComponent` jako standalone component oparty o Angular Material (`mat-nav-list`) i routing aktywny przez `routerLinkActive` lub równoważną logikę.
4. Zdefiniować lokalną konfigurację pozycji admina, najlepiej jako stałą tablicę `AdminNavItemVm[]`, zawierającą `Dashboard` i `Użytkownicy`.
5. Osadzić `AdminAsideNavComponent` w `AdminLayoutComponent` i przygotować dwukolumnowy układ: lewy aside, prawy obszar treści.
6. Przenieść istniejący `AdminDashboardPageComponent` do roli child route nowego layoutu bez zmiany jego odpowiedzialności biznesowej.
7. Utworzyć `AdminUsersPlaceholderPageComponent` z nagłówkiem, opisem i kartą placeholderową bez integracji z backendem.
8. Uzupełnić guest routing w `src/app/app.routes.ts` o redirect dla `/admin/users`, aby zachować spójne zachowanie dla niezalogowanych.
9. Zweryfikować, czy `adminRoleMatchGuard` obejmuje całą sekcję `/admin/*`; jeśli tak, pozostawić guard na poziomie parent route, bez duplikowania logiki w komponentach.
10. Ujednolicić styl aside admina z istniejącym wzorcem „Moja Pycha” pod kątem odstępów, typografii, stanów hover i aktywnego elementu.
11. Dodać testy jednostkowe:
    - aktywna pozycja aside dla `/admin/dashboard`,
    - aktywna pozycja aside dla `/admin/users`,
    - brak requestu API w `AdminUsersPlaceholderPageComponent`,
    - poprawne przekierowanie z `/admin` na `/admin/dashboard`.
12. Dodać lub zaktualizować testy integracyjne/E2E:
    - admin widzi wspólny aside na `/admin/dashboard`,
    - admin przechodzi do `/admin/users` bez opuszczania layoutu,
    - nie-admin trafia na `/forbidden`,
    - gość trafia na `/login` z `returnUrl`.
13. Ręcznie zweryfikować responsywność:
    - desktop: aside stale widoczny,
    - mniejsze ekrany: zachowanie zgodne z przyjętym wzorcem layoutu bez dodawania nowej pozycji do Bottom Bara.
