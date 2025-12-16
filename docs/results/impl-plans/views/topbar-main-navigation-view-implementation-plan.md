# Plan implementacji widoku: Nawigacja główna w Topbarze (Moja Pycha / Odkrywaj przepisy)

## 1. Przegląd

Celem zmian jest wprowadzenie **stałej, przewidywalnej nawigacji głównej** w nagłówku aplikacji (Topbar) w postaci dwóch pozycji:
- **Moja Pycha** (`/dashboard`)
- **Odkrywaj przepisy** (`/explore`)

Wymagania (PRD + UI Plan + user stories):
- Topbar ma zawsze prezentować **główną nawigację** z aktywnym stanem (US-014, US-023, US-026).
- Na ścieżkach publicznych (`/`, `/explore`, `/explore/recipes/:id`) Topbar ma tę samą nawigację główną, a prawa strona różni się:
  - **gość**: `Zaloguj` / `Zarejestruj`
  - **zalogowany**: menu profilu + `Wyloguj`
- Na **mobile** główna nawigacja ma być dostępna jako **hamburger/drawer** (ta sama kolejność i etykiety).
- Konfiguracja menu jest **zahardkodowana** po stronie frontendu (brak zmian w API).

## 2. Routing widoku

### Ścieżki objęte nawigacją główną
- **Moja Pycha**: `/dashboard`
- **Odkrywaj przepisy**: `/explore`

### Kluczowe zachowanie dla gościa (US-023)
Aktualnie `/dashboard` istnieje wyłącznie w grupie tras dla zalogowanych (z `authenticatedMatchGuard`). Aby kliknięcie „Moja Pycha” w nagłówku **dla gościa** nie kończyło się 404, należy dodać w routingu dla gościa obsługę wejścia na `/dashboard`:
- W `src/app/app.routes.ts` w grupie `PublicLayoutComponent` dodać trasę:
  - `path: 'dashboard'`
  - `pathMatch: 'full'`
  - `redirectTo`: `/login` z parametrem powrotu, np. `?redirectTo=%2Fdashboard`

### Powrót po logowaniu/rejestracji
Aktualnie `LoginPageComponent` i `RegisterPageComponent` po sukcesie zawsze nawigują do `/dashboard`. Aby spełnić wymaganie „redirect do logowania z powrotem po sukcesie”, należy:
- W `LoginPageComponent` oraz `RegisterPageComponent` odczytywać `queryParam` `redirectTo`:
  - jeśli istnieje i jest bezpieczny, nawigować do niego,
  - w przeciwnym razie fallback do `/dashboard`.

**Walidacja bezpieczeństwa `redirectTo` (wymagana, aby nie otworzyć wektora open-redirect):**
- dozwolone tylko ścieżki względne względem hosta, np. takie które:
  - zaczynają się od `'/'`
  - nie zaczynają się od `'//'`
  - nie zawierają protokołu (`http:`/`https:`) ani znaków sugerujących URL absolutny

## 3. Struktura komponentów

Docelowo warto wydzielić nawigację główną jako mały, reużywalny komponent, aby uniknąć duplikacji między `TopbarComponent` (dla zalogowanego w `MainLayout`) a `PublicHeaderComponent` (dla gościa w `PublicLayout`).

Proponowana struktura:

```text
PublicLayoutComponent
└── pych-public-header
    ├── pych-main-navigation (NOWY / wydzielony)
    └── sekcja akcji (gość): Zaloguj / Zarejestruj

MainLayoutComponent
└── pych-topbar
    ├── breadcrumbs (kontekstowe)
    ├── pych-main-navigation (NOWY / wydzielony)
    └── sekcja akcji (zalogowany): profil / wylogowanie
```

## 4. Szczegóły komponentów

### MainNavigationComponent (`shared/components/main-navigation`)
- **Opis komponentu**: prezentuje dwie pozycje nawigacji głównej (Moja Pycha, Odkrywaj przepisy), wraz z aktywnym stanem. Na desktopie jako zakładki/linki, na mobile jako menu (hamburger).
- **Główne elementy**:
  - Desktop:
    - rekomendowane: `mat-tab-nav-bar` + `mat-tab-link` (Angular Material) z `routerLinkActive`
  - Mobile:
    - `mat-icon-button` (hamburger) otwierający `mat-menu` z dwoma `mat-menu-item`
- **Obsługiwane zdarzenia**:
  - kliknięcie pozycji nawigacji -> `router.navigateByUrl(route)`
  - otwarcie/zamknięcie menu mobilnego
- **Obsługiwana walidacja**:
  - brak walidacji danych wejściowych; aktywny stan oparty o URL routera
- **Typy**:
  - `MainNavigationItem[]` (nowy typ ViewModel, statyczna konfiguracja)
- **Propsy**:
  - `items: MainNavigationItem[]` (opcjonalnie; domyślnie komponent może używać stałej konfiguracji)
  - `variant: 'desktop' | 'mobile' | 'auto'` (opcjonalnie; `auto` zależny od breakpointów)

### TopbarComponent (`layout/main-layout/components/topbar`)
- **Opis komponentu**: globalny nagłówek dla zalogowanego użytkownika (App Shell). Po zmianie: zawiera stałą nawigację główną + menu użytkownika; breadcrumbs pozostają kontekstowe.
- **Główne elementy HTML**:
  - `div.topbar__left`: (mobile + prywatne ścieżki) przycisk otwierania Sidebara (istniejące)
  - `div.topbar__center` lub `div.topbar__left`: `pych-main-navigation` (NOWE)
  - `div.topbar__right`: profil + menu (`Ustawienia`, `Wyloguj`) (istniejące)
  - `pych-breadcrumbs`: nadal widoczne na desktopie; mogą być ukrywane na mniejszych breakpointach (jak obecnie)
- **Obsługiwane zdarzenia**:
  - klik w elementy nawigacji głównej
  - klik w avatar -> otwarcie menu
  - klik `Wyloguj` -> `AuthService.signOut()` + nawigacja do `/login`
  - klik w hamburger Sidebara (mobile + private) -> `LayoutService.toggleSidebar()`
- **Obsługiwana walidacja**:
  - brak; jedynie bezpieczne przekierowanie po wylogowaniu (fallback do `/login` nawet po błędzie)
- **Typy**:
  - `MainNavigationItem[]` (używane przez `pych-main-navigation`)
- **Propsy**:
  - utrzymać istniejące `shouldShowSidebar` (wymagane input)

### PublicHeaderComponent (`shared/components/public-header`)
- **Opis komponentu**: nagłówek dla gościa. Po zmianie: oprócz logo i CTA, zawiera stałą nawigację główną z aktywnym stanem.
- **Główne elementy HTML**:
  - logo (routerLink do `/`)
  - `pych-main-navigation` (NOWE)
  - prawa sekcja: `Zaloguj się`, `Zarejestruj się` (jak dziś)
- **Obsługiwane zdarzenia**:
  - klik w „Moja Pycha” -> nawigacja do `/dashboard` (dla gościa zadziała dzięki nowej trasie redirectującej do `/login`)
  - klik w „Odkrywaj przepisy” -> `/explore`
  - klik w CTA -> `/login`, `/register`
- **Obsługiwana walidacja**:
  - brak
- **Typy**:
  - `MainNavigationItem[]`
- **Propsy**:
  - brak (konfiguracja statyczna)

## 5. Typy

### `MainNavigationItem` (nowy typ ViewModel)
Proponowana definicja (miejsce: `src/app/shared/models/ui.models.ts` lub dedykowany plik w `shared/components/main-navigation`):
- `label: string` – etykieta (np. „Moja Pycha”)
- `route: string` – ścieżka routera (np. `/dashboard`)
- `exact: boolean` – czy aktywny stan ma wymagać dopasowania exact (dla `/dashboard` zwykle `true`, dla `/explore` raczej `true`)
- `ariaLabel?: string` – opcjonalny tekst dla a11y

### Konfiguracja statyczna nawigacji (wspólna)
Stała tablica 2 pozycji (w kolejności wymaganej przez story):
1. Moja Pycha → `/dashboard`
2. Odkrywaj przepisy → `/explore`

## 6. Zarządzanie stanem

Stan powinien pozostać minimalny i oparty o Angular Signals:
- **detekcja mobile**: użyć istniejącego `LayoutService.isMobile` (signal) albo wewnętrzny breakpoint w komponencie `MainNavigationComponent` (preferowane: reuse `LayoutService`).
- **aktywny stan**:
  - preferowane: `RouterLinkActive` / `mat-tab-link` + `routerLinkActive`
  - alternatywnie: signal `currentUrl` oparty o `Router.events` + `NavigationEnd` i `toSignal`, jeśli potrzebne do dodatkowej logiki w menu mobilnym

## 7. Integracja API

Brak zmian i brak wywołań API dla nawigacji głównej.
Jedyna operacja „backendowa” związana z nagłówkiem:
- **Wylogowanie**: `AuthService.signOut()` (Supabase Auth) – już istnieje w `TopbarComponent`.

## 8. Interakcje użytkownika

- **Klik w „Moja Pycha”**
  - zalogowany: przejście do `/dashboard`
  - gość: wejście na `/dashboard` → automatyczny redirect do `/login?redirectTo=/dashboard` → po zalogowaniu powrót do `/dashboard`
- **Klik w „Odkrywaj przepisy”**
  - gość i zalogowany: przejście do `/explore`
- **Aktywny stan zakładki**
  - `/dashboard` → aktywna „Moja Pycha”
  - `/explore` oraz `/explore/**` → aktywna „Odkrywaj przepisy” (zależnie od decyzji dot. `exact`)
- **Mobile**
  - użytkownik otwiera hamburger i wybiera jedną z dwóch pozycji (ta sama kolejność/etykiety)
- **Menu profilu (zalogowany)**
  - `Ustawienia` → `/settings`
  - `Wyloguj` → wylogowanie + nawigacja do `/login`

## 9. Warunki i walidacja

- **Warunek widoczności prawej strony w publicznych widokach**:
  - w aktualnej architekturze wynika z doboru layoutu przez `canMatch`:
    - `PublicLayout` (gość) → CTA logowania/rejestracji
    - `MainLayout` (zalogowany) → menu profilu
- **Walidacja parametru `redirectTo`** (login/register):
  - jeżeli `redirectTo` nie przejdzie walidacji bezpieczeństwa → fallback do `/dashboard`
- **Wyróżnienie aktywnej pozycji**:
  - reguły dopasowania `routerLinkActiveOptions` muszą być spójne dla desktop i mobile

## 10. Obsługa błędów

- **Wylogowanie**:
  - jeśli `AuthService.signOut()` rzuci błąd, nadal wykonać nawigację do `/login` (jak dziś) i zalogować błąd do konsoli.
- **Redirect po logowaniu/rejestracji**:
  - jeśli `redirectTo` jest niepoprawny → fallback `/dashboard`
  - jeśli router nie może nawigować (rzadkie) → fallback `/dashboard`

## 11. Kroki implementacji

1. **Wydziel konfigurację i typ `MainNavigationItem`** (wspólna, statyczna).
2. **Utwórz `MainNavigationComponent`** jako standalone, OnPush:
   - desktop: zakładki/linki z aktywnym stanem,
   - mobile: hamburger + menu.
3. **Zintegruj `MainNavigationComponent` w `TopbarComponent`**:
   - dodaj zakładki „Moja Pycha” i „Odkrywaj przepisy”,
   - dopracuj CSS (używać zmiennych Material, np. `--mat-sys-*`),
   - zachowaj istniejące zachowanie Sidebara i menu profilu.
4. **Zintegruj `MainNavigationComponent` w `PublicHeaderComponent`**:
   - umieść nawigację główną w nagłówku obok logo/CTA,
   - zapewnij wersję mobilną (hamburger/menu).
5. **Zaktualizuj routing dla gościa**:
   - w `PublicLayout` dodaj trasę `/dashboard` redirectującą do `/login?redirectTo=/dashboard`.
6. **Zaktualizuj `LoginPageComponent` i `RegisterPageComponent`**:
   - obsłuż `redirectTo`,
   - dodaj walidację bezpieczeństwa parametru,
   - nawiguj do `redirectTo` po sukcesie (fallback `/dashboard`).
7. **Upewnij się, że aktywny stan działa poprawnie**:
   - `/explore/recipes/:id` powinno wskazywać aktywne „Odkrywaj przepisy”.
8. **Dopisz krótką notatkę w dokumentacji zmian** (opcjonalnie) i zweryfikuj spójność z istniejącym planem `sidebar-visibility-and-navigation-changes-implementation-plan.md`.



