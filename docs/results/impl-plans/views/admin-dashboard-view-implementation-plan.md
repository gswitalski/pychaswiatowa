# Plan implementacji widoku Admin Dashboard

## 1. Przegląd
Celem jest dodanie **sekcji administracyjnej** dostępnej wyłącznie dla użytkowników z rolą `admin` (`app_role` w JWT). W MVP widok ma być **placeholderem** (nagłówek + krótki opis + 2–4 karty „Wkrótce”), ale cała struktura routingu i guardów ma być gotowa pod dalszą rozbudowę (`/admin/users`, `/admin/recipes`, itd.).

W ramach wdrożenia należy:
- dodać nawigację do sekcji admina (Topbar + menu użytkownika na mniejszych ekranach),
- dodać lazy-loaded routing `/admin/*`,
- dodać guard roli admina (blokada i przekierowanie na `/forbidden`),
- opcjonalnie spiąć API `GET /admin/summary` (stub) pod przyszłe metryki.

## 2. Routing widoku

### Docelowe ścieżki
- `/admin` — kontener sekcji admina, przekierowuje na `/admin/dashboard`.
- `/admin/dashboard` — dashboard admina (placeholder).

### Aktualna architektura routingu w projekcie
- Główny routing jest w `src/app/app.routes.ts`.
- Aplikacja ma **dwie grupy tras** rozróżniane `canMatch`:
  - `MainLayoutComponent` + `authenticatedMatchGuard` (zalogowani),
  - `PublicLayoutComponent` + `guestOnlyMatchGuard` (goście).

### Zmiany w `src/app/app.routes.ts`
1) W grupie zalogowanej (`MainLayoutComponent`) dodać trasę:
- `path: 'admin'`
- `loadChildren: () => import('./pages/admin/admin.routes').then(m => m.adminRoutes)`
- `canMatch: [adminRoleMatchGuard]` (nowy guard roli admina)

2) W grupie gości (`PublicLayoutComponent`) dodać przekierowania na login, analogicznie jak dla `/dashboard` i `/shopping`:
- wejście na `/admin` i `/admin/dashboard` jako gość ma prowadzić do `/login` z `returnUrl` ustawionym na docelową ścieżkę.

Uwaga: w projekcie „ochrona tras prywatnych dla gości” jest realizowana przez **jawne redirecty** w guest routingu (np. `/dashboard` → `/login?returnUrl=...`). Dla spójności należy dodać analogiczne wpisy dla `/admin` (co najmniej `/admin` i `/admin/dashboard`).

## 3. Struktura komponentów

Proponowana struktura (standalone, lazy-loaded):

- `src/app/pages/admin/admin.routes.ts`
  - route `''` → redirect do `'dashboard'`
  - route `'dashboard'` → `AdminDashboardPageComponent`
  - (opcjonalnie) route wrapper z `AdminLayoutComponent` jako kontener dla sekcji `/admin/*`

Komponenty nawigacji (istniejące, do modyfikacji):
- `src/app/layout/main-layout/components/topbar/topbar.component.{ts,html}` (Topbar + menu użytkownika)
- `src/app/shared/components/main-navigation/main-navigation.component.*` (pozycje Topbara na desktop)
- `src/app/shared/models/ui.models.ts` (statyczna lista `MAIN_NAVIGATION_ITEMS`)

## 4. Szczegóły komponentów

### `TopbarComponent` (`src/app/layout/main-layout/components/topbar/topbar.component.ts`)
- **Opis komponentu**: górny pasek aplikacji. Na desktopie renderuje `pych-main-navigation`, na wszystkich rozdzielczościach zawiera przycisk `mat-menu` z menu użytkownika.
- **Główne elementy**:
  - `<mat-toolbar>`
  - `<pych-main-navigation />` (tylko desktop, warunek w template: `@if (!isMobileOrTablet())`)
  - `<mat-menu #userMenu>` (menu użytkownika)
- **Obsługiwane interakcje**:
  - kliknięcie linku „Admin” (nowe): nawigacja do `/admin/dashboard`
  - kliknięcie „Wyloguj się”: `logout()`
- **Obsługiwana walidacja / warunki**:
  - link „Admin” widoczny wyłącznie gdy `AuthService.appRole() === 'admin'`
  - brak „migania”: render linku dopiero po ustaleniu roli (rola jest wyciągana z JWT w `AuthService.initAuthState()` uruchamianym w `APP_INITIALIZER` w `src/app/app.config.ts`)
- **Typy**:
  - `AppRole` (`shared/contracts/types.ts`) – wykorzystywany pośrednio przez `AuthService`
- **Propsy**:
  - `shouldShowSidebar: boolean` (już istnieje)

Wariant wdrożenia linku „Admin” w Topbarze (desktop):
- Rekomendowane: nie dopisywać stałego elementu w HTML obok `pych-main-navigation`, tylko **wstrzyknąć dynamiczne items** do `MainNavigationComponent`:
  - w `TopbarComponent` utworzyć `computed`/signal `mainNavItems`, który bazuje na `MAIN_NAVIGATION_ITEMS` i dokleja element „Admin” tylko dla `admin`.
  - w template przekazać `[items]="mainNavItems()"` do `<pych-main-navigation>`.

Wariant wdrożenia linku „Admin” w menu użytkownika (mobile/tablet fallback):
- W `topbar.component.html` dodać `mat-menu-item` warunkowo, np. blok `@if (isAdmin()) { ... }` pomiędzy „Ustawienia” a „Wyloguj się”.

### `MainNavigationComponent` (`src/app/shared/components/main-navigation/main-navigation.component.ts`)
- **Opis komponentu**: renderuje pozycje nawigacji głównej (desktop: przyciski, mobile: hamburger/menu).
- **Główne elementy**: zależne od template, ale kontraktowo przyjmuje `items` (input).
- **Obsługiwane interakcje**: kliknięcie pozycji nawigacji → routing.
- **Warunki**:
  - element „Admin” ma być dostarczany tylko dla admina (nie ukrywać go w środku komponentu bez wiedzy o roli; rola jest w `AuthService`, ale ten komponent jest współdzielony między layoutami).
- **Typy**:
  - `MainNavigationItem` (`src/app/shared/models/ui.models.ts`)
- **Propsy**:
  - `items: MainNavigationItem[]` (już istnieje)
  - `variant: 'desktop' | 'mobile' | 'auto'` (już istnieje)

### `AdminLayoutComponent` (opcjonalny, nowy) (`src/app/pages/admin/admin-layout/admin-layout.component.ts`)
- **Opis komponentu**: kontener dla sekcji `/admin/*`. Na MVP może ograniczać się do wrappera i `<router-outlet>`, ale pozwala później dodać np. breadcrumbs, wewnętrzne menu admina, nagłówki.
- **Główne elementy**:
  - kontener sekcji (np. `<section class="admin">`)
  - `<router-outlet>`
- **Obsługiwane interakcje**: brak na MVP
- **Walidacja**: brak
- **Typy**: brak
- **Propsy**: brak

### `AdminDashboardPageComponent` (nowy) (`src/app/pages/admin/admin-dashboard/admin-dashboard-page.component.ts`)
- **Opis komponentu**: strona dashboardu admina (placeholder).
- **Główne elementy** (Angular Material):
  - nagłówek strony: „Panel administracyjny”
  - tekst informacyjny o placeholderze
  - siatka 2–4 kart (`mat-card`) np.:
    - „Statystyki (wkrótce)”
    - „Zarządzanie użytkownikami (wkrótce)”
    - „Moderacja treści (wkrótce)”
    - „Konfiguracja (wkrótce)”
- **Obsługiwane interakcje**:
  - brak funkcji admina na MVP (karty nie muszą być klikalne)
  - (opcjonalnie) przycisk „Odśwież” jeśli podpinamy `GET /admin/summary`
- **Walidacja / warunki**:
  - widok dostępny tylko po przejściu guarda admina (routing-level)
  - stan ładowania danych (jeśli `GET /admin/summary` jest podłączony) nie powinien „wybielać” strony — trzymać poprzednie dane i używać np. `opacity: 0.5` na kontenerze (zgodnie z regułami ładowania)
- **Typy**:
  - `AdminSummaryDto` (`shared/contracts/types.ts`) – jeśli integrujemy endpoint
- **Propsy**: brak

### `adminRoleMatchGuard` (nowy) (`src/app/core/guards/admin-role-match.guard.ts`)
- **Opis**: guard roli admina na trasach `/admin/*`.
- **Działanie**:
  - jeżeli użytkownik jest zalogowany, ale `AuthService.appRole() !== 'admin'` → przekierowanie na `/forbidden` i `return false`
  - jeżeli rola admin → `return true`
- **Uwaga o niezalogowanych**:
  - dla gościa i tak nie wejdziemy w grupę tras `MainLayoutComponent` (bo `authenticatedMatchGuard` zwróci `false`).
  - aby spełnić wymaganie UX „standardowa ochrona tras prywatnych” (redirect do `/login`), musimy dodać redirecty w guest routing (sekcja 2).
- **Typy**:
  - `AppRole` pośrednio przez `AuthService`

## 5. Typy

### Istniejące (do użycia)
- `AppRole = 'user' | 'premium' | 'admin'` (`shared/contracts/types.ts`)
- `AdminSummaryDto` (`shared/contracts/types.ts`) – kontrakt `GET /admin/summary` (stub)
- `AdminHealthDto` (`shared/contracts/types.ts`) – kontrakt `GET /admin/health` (opcjonalny)

### Nowe (jeśli potrzebne)
Na MVP nie są wymagane nowe typy domenowe. Jeśli dodamy warunkowe renderowanie elementu nawigacji w Topbarze, warto dodać lokalny typ pomocniczy:
- `MainNavigationItem` już istnieje i wystarcza do pozycji „Admin”.

## 6. Zarządzanie stanem

### Stan roli / autoryzacji
- Źródłem prawdy jest `AuthService` (`src/app/core/services/auth.service.ts`), który:
  - ustawia `appRole: signal<AppRole>` na podstawie JWT w `initAuthState()` (uruchamianym w `APP_INITIALIZER` w `src/app/app.config.ts`),
  - dostarcza `isAuthenticated: signal<boolean>`.

### Stan w `AdminDashboardPageComponent`
Wariant A (najprostszy, zgodny z MVP):
- brak wywołań API i brak stanu danych – tylko placeholder UI.

Wariant B (przyszłościowy, ale bezpieczny na MVP):
- `summary = signal<AdminSummaryDto | null>(null)`
- `isLoading = signal<boolean>(false)`
- `errorMessage = signal<string | null>(null)`
- ładowanie w `ngOnInit` albo przez `effect()`; przy ponownym odświeżeniu trzymać poprzednie dane w `summary` i zmieniać tylko `isLoading`, aby uniknąć „flash”.

## 7. Integracja API

### Kontekst architektury komunikacji z backendem
Zgodnie z regułami projektu frontend **nie** wykonuje zapytań `supabase.from(...)`. Komunikacja odbywa się przez `supabase.functions.invoke(...)` (Edge Functions / REST gateway), co widać np. w `src/app/pages/recipes/services/recipes.service.ts` i `src/app/core/services/collections-api.service.ts`.

### Endpointy
1) `GET /me` — bootstrap tożsamości/roli
- W praktyce frontend już wyciąga `app_role` z JWT (bez call do `/me`), zgodnie z `src/app/core/utils/jwt.utils.ts`.
- Dla tego feature’a nie trzeba tego zmieniać.

2) `GET /admin/summary` — (proponowany) stub dla dashboardu
- **Request**: brak body, metoda `GET`
- **Response 200**: `AdminSummaryDto`
- **401/403**: jak w planie API (przy czym w UI i tak blokujemy dostęp guardem)

Rekomendowany serwis (nowy):
- `src/app/core/services/admin-api.service.ts`
  - metoda `getSummary(): Observable<AdminSummaryDto>`
  - implementacja: `this.supabase.functions.invoke<AdminSummaryDto>('admin/summary', { method: 'GET' })`
  - obsługa błędów analogicznie do istniejących serwisów (rzucanie `Error` gdy `response.error`)

Uwaga: jeśli backend jeszcze nie wystawia `admin/summary`, w MVP należy zostawić dashboard jako czysty placeholder (wariant A), a integrację API potraktować jako etap opcjonalny.

## 8. Interakcje użytkownika

### Interakcje w nawigacji
- **Kliknięcie „Admin” w Topbarze (desktop)**:
  - tylko dla `app_role === 'admin'`
  - nawigacja do `/admin/dashboard`

- **Kliknięcie „Admin” w menu użytkownika (mobile/tablet fallback)**:
  - tylko dla `app_role === 'admin'`
  - nawigacja do `/admin/dashboard`

### Wejście bezpośrednie przez URL
- Zalogowany, ale nie-admin:
  - wejście na `/admin` lub `/admin/dashboard` → redirect na `/forbidden` (guard roli)
- Gość:
  - wejście na `/admin` lub `/admin/dashboard` → redirect na `/login?returnUrl=...` (jawne redirecty w guest routing)

## 9. Warunki i walidacja

### Warunki widoczności UI
- Pozycja „Admin” widoczna wyłącznie gdy:
  - `AuthService.appRole() === 'admin'`
- Brak „flash”:
  - nie renderować „Admin” dopóki rola nie jest znana; w projekcie rola jest ustalana na starcie przez `APP_INITIALIZER` (fallback „user” zanim odczytamy JWT jest akceptowalny, bo nie pokazuje linku nie-adminom).

### Warunki dostępu routingu
- `/admin/*` dostępne tylko gdy:
  - użytkownik jest zalogowany (wynika z grupy tras `MainLayoutComponent` + `authenticatedMatchGuard`)
  - `AuthService.appRole() === 'admin'` (nowy `adminRoleMatchGuard`)

## 10. Obsługa błędów

### Guard roli
- Jeśli rola nie jest `admin`:
  - przekierowanie na `/forbidden`
  - unikać pętli przekierowań (guard powinien zwracać `false` po `router.navigate`)

### Błędy API (jeśli podpinamy `GET /admin/summary`)
- `401 Unauthorized`: teoretycznie nie powinno wystąpić, bo trasa jest w sekcji zalogowanej; jeśli jednak się zdarzy (np. wygaśnięta sesja):
  - przekierować na `/login` (z zachowaniem `returnUrl=/admin/dashboard`) lub pokazać komunikat i CTA do ponownego logowania.
- `403 Forbidden`:
  - przekierować na `/forbidden` (spójne z guardem)
- Inne błędy sieciowe:
  - pokazać prosty komunikat (Material `mat-card`/`mat-error`/banner) i pozostawić placeholder UI.

## 11. Kroki implementacji

1. **Dodać nowy guard roli admina**
   - Utworzyć `src/app/core/guards/admin-role-match.guard.ts` jako funkcjonalny `CanMatchFn` (zgodnie z regułami: functional guards + `inject()`).
   - Warunek: `AuthService.appRole() === 'admin'` → `true`, inaczej redirect na `/forbidden` i `false`.

2. **Dodać routing `/admin/*` (lazy-loaded)**
   - Utworzyć `src/app/pages/admin/admin.routes.ts` i wyeksportować `adminRoutes`.
   - W `src/app/app.routes.ts` w grupie zalogowanej dodać trasę `path: 'admin'` z `loadChildren` i `canMatch: [adminRoleMatchGuard]`.
   - W `admin.routes.ts` dodać redirect `'' → 'dashboard'` oraz trasę `'dashboard'`.

3. **Dodać redirecty dla gości (spójnie z istniejącym podejściem)**
   - W `src/app/app.routes.ts` w grupie gości dodać:
     - `path: 'admin'` → redirect do `/login?returnUrl=%2Fadmin`
     - `path: 'admin/dashboard'` → redirect do `/login?returnUrl=%2Fadmin%2Fdashboard`
   - (Opcjonalnie) jeśli chcemy zabezpieczyć przyszłe ścieżki `/admin/*`, rozważyć matcher „admin-prefix” po stronie guest.

4. **Wpiąć link „Admin” w Topbarze (desktop)**
   - W `src/app/layout/main-layout/components/topbar/topbar.component.ts` dodać computed `mainNavItems`:
     - bazuje na `MAIN_NAVIGATION_ITEMS` z `src/app/shared/models/ui.models.ts`
     - dokleja `{ label: 'Admin', route: '/admin/dashboard', exact: false, ariaLabel: 'Przejdź do panelu administracyjnego', matchingRoutes: ['/admin'] }` tylko dla `admin`
   - W `topbar.component.html` przekazać `[items]="mainNavItems()"` do `<pych-main-navigation>`.

5. **Wpiąć link „Admin” w menu użytkownika (mobile/tablet fallback)**
   - W `src/app/layout/main-layout/components/topbar/topbar.component.html` dodać `mat-menu-item` warunkowo dla `admin` prowadzący do `/admin/dashboard`.

6. **Dodać widok placeholdera**
   - Utworzyć `src/app/pages/admin/admin-dashboard/admin-dashboard-page.component.ts` jako standalone z `ChangeDetectionStrategy.OnPush`.
   - Zbudować UI z Angular Material (`mat-card`) zgodnie z `admin-dashboard-ui-plan.md`.

7. **(Opcjonalnie) Dodać `AdminApiService` i integrację `GET /admin/summary`**
   - Utworzyć `src/app/core/services/admin-api.service.ts` z metodą `getSummary()`.
   - W `AdminDashboardPageComponent` dodać ładowanie i obsługę błędów (ale zachować placeholder nawet bez danych).

8. **Testy**
   - Jednostkowe (Vitest):
     - `adminRoleMatchGuard`: admin → true; non-admin → redirect `/forbidden`; (opcjonalnie) zachowanie przy nieznanej roli/fallback.
     - `TopbarComponent`: dla admina `mainNavItems` zawiera „Admin”, dla nie-admina nie zawiera.
   - E2E (Playwright):
     - admin widzi link „Admin” i wchodzi na `/admin/dashboard`.
     - nie-admin po wejściu na `/admin/dashboard` trafia na `/forbidden`.
     - gość po wejściu na `/admin/dashboard` trafia na `/login` z `returnUrl`.

