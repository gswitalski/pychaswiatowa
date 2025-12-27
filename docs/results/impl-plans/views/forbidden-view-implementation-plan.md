# Plan implementacji widoku Brak dostępu (403)

## 1. Przegląd
Widok **„Brak dostępu (403)”** to techniczna strona pomocnicza dostępna pod ścieżką **`/forbidden`**, której zadaniem jest:

- przekazanie użytkownikowi czytelnej informacji, że nie ma uprawnień do danej akcji/widoku,
- **nieujawnianie szczegółów** zasobu ani reguł autoryzacji,
- przygotowanie fundamentu pod przyszłe **RBAC** (premium/admin) poprzez **odczyt roli `app_role` z JWT** po stronie klienta.

Zakres MVP: brak logiki „ukryj/disabled/tooltip” w UI oraz brak realnego blokowania funkcji po roli — tylko fundament (odczyt roli + widok 403).

## 2. Routing widoku
### 2.1. Ścieżka
- **`/forbidden`** – publicznie dostępna techniczna strona 403.

### 2.2. Wpięcie do routingu aplikacji
W aplikacji routing jest podzielony na 2 grupy w `src/app/app.routes.ts`:

- grupa dla zalogowanych (layout `MainLayoutComponent`, `canMatch: authenticatedMatchGuard`),
- grupa dla gości (layout `PublicLayoutComponent`, `canMatch: guestOnlyMatchGuard`).

Aby zachować poprawny „kontekst” headera (zalogowany vs gość), trasę **`forbidden` należy dodać do obu grup** jako `loadComponent`.

Ważne:
- Trasa **nie powinna mieć** `authGuard` — to widok techniczny, do którego mogą redirectować guardy/warstwa UI w przyszłości.
- W `MainLayoutComponent` sidebar i tak się nie pokaże (widoczność sidebara jest oparta o prefixy prywatnych ścieżek; `/forbidden` nie jest prywatny).

## 3. Struktura komponentów
Proponowana minimalna struktura:

- `ForbiddenPageComponent` (strona)
    - `pych-page-header` (tytuł + „Wróć”)
    - sekcja treści (centered)
        - `pych-empty-state` (ikonka + komunikaty)
            - przyciski akcji (ng-content)

## 4. Szczegóły komponentów
### 4.1. `ForbiddenPageComponent`
- **Lokalizacja**: `src/app/pages/forbidden/forbidden-page.component.ts` (+ `.html`, `.scss`)
- **Selector**: `pych-forbidden-page` (prefix `pych-`)
- **Cel**: wyświetlić komunikat 403 w sposób neutralny i bezpieczny + zapewnić podstawowe akcje nawigacyjne.
- **Change detection**: `OnPush`
- **Standalone**: tak (zgodnie ze standardem projektu)

#### Główne elementy HTML i komponenty dzieci
- `pych-page-header`
    - `title`: „Brak dostępu”
    - `subtitle` (opcjonalnie): „Nie masz uprawnień do wyświetlenia tej strony.”
- `pych-empty-state`
    - `icon`: np. `lock` / `lock_person`
    - `title`: „Brak dostępu”
    - `description`: krótka informacja bez szczegółów zasobu, np. „Jeśli uważasz, że to błąd — spróbuj ponownie lub skontaktuj się z administratorem.”
    - slot akcji:
        - przycisk „Wróć” (nawigacja wstecz)
        - przycisk „Przejdź do Odkrywaj” (`/explore`)
        - przycisk kontekstowy:
            - jeśli zalogowany: „Przejdź do Moja Pycha” (`/dashboard`)
            - jeśli gość: „Zaloguj się” (`/login?redirectTo=%2Fdashboard` albo bez redirect — decyzja UX)

#### Obsługiwane zdarzenia
- Klik „Wróć”:
    - default: `Location.back()` (można wykorzystać wbudowane zachowanie `pych-page-header`)
    - fallback: jeśli brak historii, nawigacja do `/`
- Klik „Przejdź do Odkrywaj”: `Router.navigate(['/explore'])`
- Klik „Moja Pycha”: `Router.navigate(['/dashboard'])`
- Klik „Zaloguj się”: `Router.navigate(['/login'], { queryParams: { redirectTo: '/dashboard' } })`

#### Obsługiwana walidacja (szczegółowa)
Widok nie ma formularzy ani payloadów, więc walidacja dotyczy tylko warunków UI:
- **Kontekst logowania**:
    - `isAuthenticated === true` → pokazuj akcję do `/dashboard`
    - `isAuthenticated === false` → pokazuj akcję do `/login`
- **Brak ujawniania szczegółów**:
    - nie renderuj nazwy zasobu, ID, roli wymaganej, ani informacji „jakiej roli brakuje”
    - nie renderuj treści z parametru URL / query string (żadnych dynamicznych „powodów” w MVP)

#### Typy (DTO i ViewModel)
Nie wymaga DTO z API.

Opcjonalny ViewModel (jeśli chcemy utrzymać logikę czytelną):
- `ForbiddenPageViewModel` (lokalnie w komponencie lub jako typ w `src/app/pages/forbidden/forbidden.models.ts`):
    - `isAuthenticated: boolean`
    - `primaryCta: { label: string; route: string; queryParams?: Record<string, string> }`

#### Propsy od rodzica
Brak (to strona routowana).

### 4.2. Reużywane komponenty współdzielone
#### `PageHeaderComponent` (`pych-page-header`)
- **Wykorzystanie**: zapewnia spójny „nagłówek strony” i zachowanie „Wróć” oparte o `Location.back()`.
- **Walidacja**: brak.
- **Propsy**:
    - `title: string` (required)
    - `subtitle?: string`

#### `EmptyStateComponent` (`pych-empty-state`)
- **Wykorzystanie**: spójna prezentacja stanu (ikonka + tytuł + opis + slot na przyciski).
- **Walidacja**: brak.
- **Propsy**:
    - `icon?: string` (default `inbox`)
    - `title: string` (required)
    - `description?: string`

## 5. Typy
### 5.1. Rola aplikacyjna (RBAC)
W projekcie istnieje wspólny typ:
- `AppRole = 'user' | 'premium' | 'admin'` w `shared/contracts/types.ts`

W ramach przygotowania UI należy zapewnić, że frontend potrafi odczytać `app_role` z JWT (access token) i trzymać tę informację w stanie sesji.

### 5.2. Proponowane typy pomocnicze (frontend)
Rekomendowane (małe, lokalne) typy w `src/app/core/models/auth.models.ts` lub w obrębie `AuthService`:

- `AuthSessionViewModel`
    - `isAuthenticated: boolean`
    - `userId: string | null`
    - `appRole: AppRole`
    - `rawAppRole: unknown` (opcjonalnie, do diagnostyki)

- `JwtAppRoleExtractionResult`
    - `appRole: AppRole`
    - `isFallback: boolean` (true, gdy claim był brakujący/nieznany)
    - `reason?: 'missing' | 'invalid' | 'decode_failed'`

## 6. Zarządzanie stanem
### 6.1. Gdzie trzymać rolę?
Najprościej: **rozszerzyć istniejący `AuthService`** (singleton, już używany w topbarze do logoutu) o sygnały:

- `readonly isAuthenticated = signal<boolean>(false)`
- `readonly appRole = signal<AppRole>('user')`
- `readonly userId = signal<string | null>(null)`

oraz metodę inicjalizującą/subskrybującą zmiany sesji.

### 6.2. Inicjalizacja stanu na starcie aplikacji
W `src/app/app.config.ts` dodać initializer (np. `provideAppInitializer` / `provideEnvironmentInitializer`) wywołujący:
- `AuthService.initAuthState()`:
    - `supabase.auth.getSession()` → ustawienie sygnałów
    - `supabase.auth.onAuthStateChange(...)` → aktualizacja sygnałów po login/logout/refresh token

Uwaga: ta inicjalizacja nie zmienia flow produktowego, tylko zapewnia, że `appRole()` jest dostępne w UI po zalogowaniu.

## 7. Integracja API
### 7.1. Widok `/forbidden`
- **Brak wywołań API** (widok statyczny/techniczny).

### 7.2. Odczyt roli z JWT (bez API)
Źródłem roli ma być **JWT access token** w sesji Supabase:
- `const { data: { session } } = await supabase.auth.getSession();`
- `session?.access_token` → decode payload → `payload.app_role`

Nie należy używać bezpośrednich zapytań `supabase.from(...)` (zgodnie z zasadami projektu). Odczyt claim z tokena jest dozwolony.

### 7.3. (Opcjonalnie) diagnostyczny fallback przez Edge Function `/me`
W repo istnieje Edge Function `/me`, która zwraca `MeDto` zawierające `app_role`.
W MVP **nie jest to wymagane** do spełnienia US-035 (rola ma być z JWT), ale można rozważyć w przyszłości:
- wyświetlenie w logach różnicy JWT vs `/me`,
- wsparcie scenariuszy, gdy token nie ma claim (mis-konfiguracja).

## 8. Interakcje użytkownika
### 8.1. Scenariusze
- **Użytkownik trafia na /forbidden po redirect**:
    - widzi komunikat „Brak dostępu”
    - ma dostępne akcje nawigacyjne (Wróć / Odkrywaj / Moja Pycha lub Zaloguj)
- **Gość**:
    - widzi CTA do logowania zamiast CTA do dashboardu
- **Zalogowany**:
    - widzi CTA do dashboardu

### 8.2. Oczekiwane rezultaty
- Użytkownik może bezpiecznie wrócić do aplikacji bez „ślepego zaułka”.
- UI nie ujawnia, do czego konkretnie brakuje dostępu.

## 9. Warunki i walidacja
### 9.1. Warunki RBAC (US-035)
- JWT musi zawierać claim `app_role`.
- Dozwolone wartości: `user | premium | admin`.
- Jeśli claim:
    - **brakujący** lub
    - **ma nieznaną wartość** lub
    - **token nie da się zdekodować**
  → UI stosuje **bezpieczny fallback**: `appRole = 'user'` + log techniczny (np. `console.warn`) umożliwiający diagnozę.

### 9.2. Warunki widoku 403
- Brak zależności od API.
- Treść widoku nie może zależeć od parametrów w URL (żeby nie było „leaków” informacji).

## 10. Obsługa błędów
### 10.1. Błędy odczytu roli
- `decode_failed`: ustaw `appRole='user'`, `isAuthenticated` bez zmian, log warning
- `missing/invalid app_role`: ustaw `appRole='user'`, log warning z `rawAppRole`

### 10.2. Błędy nawigacji w /forbidden
- Jeśli `Location.back()` nie ma efektu (brak historii): fallback `Router.navigate(['/'])` lub `['/explore']`.

## 11. Kroki implementacji
1. **Routing**: dodać trasę `forbidden` do obu grup w `src/app/app.routes.ts` jako `loadComponent`.
2. **Widok**: utworzyć `src/app/pages/forbidden/forbidden-page.component.*` (standalone, OnPush).
3. **UI**: złożyć widok z `pych-page-header` oraz `pych-empty-state` + przyciski akcji zależne od `isAuthenticated`.
4. **JWT role reader**: dodać pomocniczą funkcję dekodowania base64url payload JWT (np. `src/app/core/utils/jwt.utils.ts`) i ekstrakcję `app_role` do `AppRole` z walidacją.
5. **AuthService**: rozszerzyć `src/app/core/services/auth.service.ts` o sygnały `isAuthenticated`, `userId`, `appRole` + metodę `initAuthState()` subskrybującą `supabase.auth.onAuthStateChange`.
6. **Bootstrap**: w `src/app/app.config.ts` dodać initializer wywołujący `AuthService.initAuthState()`.
