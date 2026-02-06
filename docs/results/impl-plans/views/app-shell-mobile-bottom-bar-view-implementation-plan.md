# Plan implementacji widoku App Shell (mobile/tablet) — Bottom Bar

## 1. Przegląd
Celem jest dodanie globalnej, mobilnej nawigacji głównej w formie **Bottom Bara** przypiętego do dołu ekranu dla breakpointu ~ `< 960px`, jako zamiennika zakładek nawigacji głównej w Topbarze (bez hamburgera/drawera dla menu głównego). Bottom Bar ma być widoczny również na ścieżkach publicznych i nie może zasłaniać treści (wymagane `padding-bottom` + obsługa `safe-area`).

Zakres obejmuje:
- dodanie komponentu Bottom Bara (3 pozycje: `Odkrywaj`, `Moja Pycha`, `Zakupy`),
- wyróżnianie aktywnej pozycji,
- ukrycie zakładek głównej nawigacji w Topbarze na mobile/tablet,
- przekierowanie gościa po kliknięciu pozycji prywatnych do `/login` z `returnUrl` do docelowej ścieżki.

## 2. Routing widoku
Bottom Bar jest elementem **globalnego App Shell**, a nie osobnym route’em.

- **Widoczność**: wszystkie ścieżki aplikacji na mobile/tablet (breakpoint ~ `< 960px`), w tym publiczne: `/`, `/explore`, `/explore/recipes/:id-:slug`.
- **Nawigacja**:
    - `Odkrywaj` → `/explore` (publiczna, dostępna zawsze),
    - `Moja Pycha` → `/dashboard` (prywatna),
    - `Zakupy` → `/shopping` (prywatna).

### Reguła gościa (klik w pozycję prywatną)
Jeśli użytkownik **nie jest zalogowany**, klik w `Moja Pycha` lub `Zakupy`:
- nawigacja do `/login` z query paramem `returnUrl=<docelowa_ścieżka>`,
- po sukcesie logowania aplikacja odtwarza nawigację do `returnUrl`.

Uwaga: niezależnie od tego, ścieżki prywatne powinny pozostać chronione guardami routingu; wymóg dotyczy zachowania z poziomu UI (Bottom Bar / Topbar).

## 3. Struktura komponentów
Wysokopoziomowo (App Shell):

- `AppComponent` / `AppShellComponent` (globalny layout)
    - `TopbarComponent`
        - (desktop) `MainNavTabsComponent` (zakładki: Explore/Dashboard/Shopping)
        - (zawsze) akcje kontekstowe Topbara (profil/omnibox itp.)
    - `RouterOutlet` (treść widoków)
    - (mobile/tablet) `BottomNavigationBarComponent` (Bottom Bar)

Ważne: layout treści widoku musi uwzględnić wysokość Bottom Bara + `safe-area-inset-bottom`.

## 4. Szczegóły komponentów

### `BottomNavigationBarComponent`
- **Opis komponentu**: globalny pasek nawigacji dolnej na mobile/tablet z 3 pozycjami (ikona + etykieta), przypięty na dole. Odpowiada za nawigację, wyróżnienie aktywnej pozycji oraz obsługę przypadku gościa dla pozycji prywatnych.
- **Główne elementy**:
    - kontener `nav` (fixed bottom) z trzema przyciskami/elementami nawigacji,
    - element pojedynczej pozycji: `button`/`a` zawierający:
        - `mat-icon` (np. `explore`, `dashboard`, `shopping_cart` lub odpowiedniki ustalone w projekcie),
        - etykieta tekstowa.
    - atrybuty dostępności: `aria-label`, sensowny focus ring, odpowiednie role (`navigation`).
- **Obsługiwane zdarzenia**:
    - klik/tap w pozycję:
        - jeśli pozycja publiczna → nawigacja do route,
        - jeśli pozycja prywatna i user niezalogowany → nawigacja do `/login?returnUrl=...`,
        - jeśli user zalogowany → nawigacja do route.
    - zmiana aktualnego route (Router) → aktualizacja aktywnej pozycji.
- **Obsługiwana walidacja (warunki)**:
    - breakpoint: komponent renderowany tylko, gdy szerokość `< 960px`,
    - walidacja “gość”: dla `dashboard`/`shopping` blokuje bezpośrednią nawigację i kieruje do logowania z `returnUrl`.
- **Typy (DTO i ViewModel)**:
    - nowe lokalne typy ViewModel (frontend-only):
        - `MainNavItemVm`:
            - `id`: `'explore' | 'dashboard' | 'shopping'`
            - `label`: `string`
            - `icon`: `string` (nazwa ikony Material)
            - `path`: `string`
            - `isPrivate`: `boolean`
        - `MainNavActiveItemId` (opcjonalnie alias typu): jak wyżej
- **Propsy**:
    - brak wymaganych inputów w MVP (konfiguracja nawigacji jest statyczna i zahardkodowana we froncie).

### `TopbarComponent` (zmiana zachowania)
- **Opis komponentu**: na desktopie pokazuje zakładki nawigacji głównej. Na mobile/tablet zakładki **nie są wyświetlane** (zastępuje je Bottom Bar).
- **Główne elementy**:
    - warunkowe renderowanie sekcji zakładek (np. `@if (!isMobileOrTablet()) { ... }`),
    - pozostałe elementy Topbara bez zmian.
- **Obsługiwane zdarzenia**: bez zmian.
- **Obsługiwana walidacja (warunki)**:
    - breakpoint `< 960px` ukrywa zakładki nawigacji głównej.
- **Typy**: bez zmian.
- **Propsy**: bez zmian.

### `AppShellComponent` / globalny layout (zmiana stylowania)
- **Opis komponentu**: odpowiedzialny za “ramę” aplikacji i zapewnienie, że treść nie jest zasłaniana przez Bottom Bar.
- **Główne elementy**:
    - wrapper treści (np. `main`) z dynamicznym `padding-bottom`, gdy Bottom Bar jest aktywny.
- **Obsługiwane zdarzenia**: bez zmian.
- **Obsługiwana walidacja (warunki)**:
    - gdy breakpoint `< 960px` → stosuj `padding-bottom` uwzględniający:
        - wysokość Bottom Bara (stała, np. 56–64px),
        - `env(safe-area-inset-bottom)` (iOS/urządzenia z gestami).
- **Typy**: bez zmian.
- **Propsy**: bez zmian.

## 5. Typy
Nie są wymagane nowe DTO z backendu. Wymagane są jedynie typy ViewModel dla konfiguracji nawigacji (frontend-only) oraz ewentualne helpery do wyliczania aktywnej pozycji.

Rekomendowane (lokalne dla `BottomNavigationBarComponent` lub współdzielone w `core/models` jeśli ma być używane też w Topbarze):
- `MainNavItemVm`
- (opcjonalnie) `MainNavConfig` jako `readonly MainNavItemVm[]`

## 6. Zarządzanie stanem
Stan powinien być prosty i oparty o sygnały (Angular 21):
- `isMobileOrTablet`: sygnał wyliczany z breakpointu `< 960px` (np. CDK `BreakpointObserver`) w serwisie layoutu (`LayoutService`) albo lokalnie w komponencie, jeśli nie ma współdzielenia.
- `activeItemId`: sygnał pochodny od aktualnego `router.url` (np. mapowanie prefiksów):
    - url zaczyna się od `/explore` → `explore`
    - url zaczyna się od `/dashboard` → `dashboard`
    - url zaczyna się od `/shopping` → `shopping`
    - w pozostałych przypadkach można:
        - nie wyróżniać nic, albo
        - wyróżnić `explore` jako najbliższy kontekst (decyzja UX; rekomendacja: brak wyróżnienia poza 3 głównymi modułami).
- `isAuthenticated`: sygnał z `AuthService`/sesji.

Nie jest wymagany globalny store; komponent jest czysto prezentacyjny + routing.

## 7. Integracja API
Bottom Bar nie wymaga nowych endpointów.

Wymagane integracje techniczne:
- odczyt sesji użytkownika (autentykacja) przez dozwolone metody Supabase Auth w `AuthService`,
- nawigacja Angular Router.

Wymóg “returnUrl” jest realizowany w routingu frontendu (query param) i logika logowania powinna po sukcesie wykonać nawigację do `returnUrl` (z bezpiecznym fallbackiem, np. `/dashboard` lub `/explore`).

## 8. Interakcje użytkownika
- **Tap “Odkrywaj”**:
    - zawsze przejście do `/explore`,
    - po przejściu pozycja wyróżniona.
- **Tap “Moja Pycha”**:
    - zalogowany → przejście do `/dashboard`,
    - gość → przejście do `/login?returnUrl=/dashboard`.
- **Tap “Zakupy”**:
    - zalogowany → przejście do `/shopping`,
    - gość → przejście do `/login?returnUrl=/shopping`.
- **Zmiana route np. przez link w treści**:
    - Bottom Bar aktualizuje stan aktywnej pozycji.

## 9. Warunki i walidacja
- **Breakpoint**:
    - `< 960px`:
        - Bottom Bar widoczny,
        - zakładki nawigacji głównej w Topbarze ukryte,
        - layout ma `padding-bottom` + `safe-area`.
    - `>= 960px`:
        - Bottom Bar ukryty,
        - zakładki w Topbarze widoczne,
        - brak dodatkowego `padding-bottom`.
- **Niezalogowany użytkownik**:
    - klik w pozycję prywatną nie prowadzi bezpośrednio na route, tylko na `/login` z `returnUrl`.
- **Nie zasłaniaj treści**:
    - `padding-bottom` musi uwzględniać wysokość Bottom Bara oraz `env(safe-area-inset-bottom)`.

## 10. Obsługa błędów
- **Brak/niepoprawny `returnUrl` po zalogowaniu**:
    - logika logowania powinna walidować `returnUrl` (np. tylko ścieżki wewnętrzne zaczynające się od `/`) i w razie błędu przejść do bezpiecznego fallbacku (`/dashboard` dla zalogowanych albo `/explore`).
- **Użytkownik wchodzi bezpośrednio na `/dashboard` lub `/shopping` jako gość**:
    - guard routingu powinien przekierować do `/login` z `returnUrl` (spójnie z Bottom Barem).
- **Błędy nawigacji Routera**:
    - log techniczny + fallback na `/explore` (nie blokować UI).
- **Skrajne urządzenia / safe-area**:
    - przy braku wsparcia `env(safe-area-inset-bottom)` warto mieć fallback `0px`.

## 11. Kroki implementacji
1. Zidentyfikuj (lub utwórz) miejsce App Shell / layoutu globalnego, w którym można renderować Bottom Bar na wszystkich route’ach.
2. Zaimplementuj wykrywanie breakpointu `< 960px` (preferowane: serwis `LayoutService` oparty o CDK `BreakpointObserver` + sygnał).
3. Dodaj nowy standalone komponent `BottomNavigationBarComponent` (selector z prefiksem `pych`), OnPush, sygnały dla aktywnej pozycji oraz logiki kliknięcia.
4. Zdefiniuj statyczną konfigurację 3 pozycji nawigacji (Explore/Dashboard/Shopping) jako `readonly` tablicę ViewModel (`MainNavItemVm`).
5. Podłącz `BottomNavigationBarComponent` w App Shell i renderuj go tylko dla `< 960px`.
6. Zaktualizuj `TopbarComponent`, aby sekcja zakładek głównej nawigacji renderowała się tylko dla `>= 960px`.
7. Dodaj mechanizm “nie zasłaniaj treści”:
    - w globalnym layoucie ustaw `padding-bottom` tylko wtedy, gdy Bottom Bar jest aktywny,
    - użyj `calc(<wysokość> + env(safe-area-inset-bottom, 0px))`.
8. Zaimplementuj przekierowanie gościa w `BottomNavigationBarComponent`:
    - dla pozycji prywatnych nawiguj do `/login` z `returnUrl`,
    - dla publicznej nawiguj bezpośrednio.
9. Zweryfikuj spójność z guardami routingu dla `/dashboard` i `/shopping` (klik i bezpośrednie wejście w URL powinny zachowywać się spójnie).
10. Dodaj testy:
    - jednostkowe: mapowanie `router.url` → aktywna pozycja, budowanie `returnUrl`,
    - komponentowe: renderowanie/ukrywanie dla breakpointów (jeśli istnieje infrastruktura testowa),
    - e2e (jeśli dostępne): gość tap w `Zakupy` → login + powrót po zalogowaniu.
11. Ręczna weryfikacja UX:
    - Bottom Bar nie zasłania końcowych elementów list/formularzy,
    - aktywna pozycja jest czytelna,
    - na publicznych route’ach Bottom Bar jest widoczny na mobile/tablet,
    - topbar nie pokazuje zakładek głównej nawigacji na mobile/tablet.

