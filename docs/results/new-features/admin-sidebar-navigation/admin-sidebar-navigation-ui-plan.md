# Admin Sidebar Navigation — plan UI

## Cel UI

Rozbudować istniejący panel administracyjny o **wspólny layout z lewym aside**, który będzie pełnił rolę nawigacji wewnątrz sekcji `/admin/*` i pozwoli administratorowi przełączać się między `Dashboard` oraz placeholderowym widokiem `Użytkownicy`.

## Zmiana w strukturze layoutu admina

### Wspólny layout sekcji `/admin/*`

- Sekcja admina powinna korzystać ze wspólnego wrappera/layoutu dla wszystkich podstron administracyjnych.
- Layout składa się z:
    - lewego panelu aside,
    - głównego obszaru treści po prawej,
    - istniejących elementów globalnych App Shell, zgodnych z aktualną architekturą aplikacji.
- Aside ma być **analogiczny do nawigacji „Moja Pycha”**, aby użytkownik otrzymał znany wzorzec interakcji i układu.

### Aside admina

- Aside zawiera nagłówek sekcji, np. `Admin`, oraz listę pozycji nawigacyjnych.
- W MVP aside zawiera dokładnie dwie pozycje:
    - `Dashboard`
    - `Użytkownicy`
- Każda pozycja ma:
    - stan domyślny,
    - stan hover,
    - stan aktywny zależny od aktualnej trasy.
- Pozycja aktywna powinna być wyraźnie oznaczona wizualnie, zgodnie z przyjętym wzorcem nawigacji w aplikacji.

## Nowe widoki i routing

### 1) Kontener sekcji admina

- **Ścieżka**: `/admin`
- **Zachowanie**:
    - działa jako kontener/layout dla tras potomnych,
    - domyślnie przekierowuje na `/admin/dashboard`,
    - renderuje wspólny aside oraz obszar na zawartość aktualnej podstrony.
- **Ochrona**:
    - dostęp tylko dla użytkownika z rolą `admin`,
    - dla innych użytkowników obowiązuje istniejący mechanizm przekierowania do `/forbidden` lub standardowej ochrony tras prywatnych.

### 2) Dashboard admina

- **Ścieżka**: `/admin/dashboard`
- **Pozycja aktywna w aside**: `Dashboard`
- **Widok**:
    - pozostaje dashboardem placeholderowym,
    - zachowuje obecny charakter MVP: nagłówek, opis i proste karty „wkrótce”,
    - jest osadzony we wspólnym layoutcie admina z lewym aside.

### 3) Użytkownicy — placeholder

- **Ścieżka**: `/admin/users`
- **Pozycja aktywna w aside**: `Użytkownicy`
- **Widok**:
    - nowa pusta strona placeholderowa,
    - zawiera nagłówek, krótki opis i prosty komunikat typu „Zawartość zostanie dodana w kolejnej iteracji”,
    - nie zawiera tabeli, filtrów, wyszukiwarki ani akcji administracyjnych.

## Zachowanie nawigacji

- Wejście na `/admin` zawsze kończy się przekierowaniem na `/admin/dashboard`.
- Po przekierowaniu `Dashboard` jest zaznaczone jako aktywne domyślnie.
- Kliknięcie `Dashboard` przełącza zawartość głównego obszaru na dashboard placeholderowy bez opuszczania layoutu admina.
- Kliknięcie `Użytkownicy` przełącza zawartość głównego obszaru na placeholder widoku użytkowników bez opuszczania layoutu admina.
- Zmiana aktywnej pozycji powinna być oparta o aktualny routing, a nie o lokalny stan komponentu, aby odświeżenie strony zachowywało poprawny stan menu.

## Stany i edge-case’y

- **Stan wejścia bezpośredniego**:
    - bezpośrednie wejście na `/admin/dashboard` lub `/admin/users` renderuje poprawny stan aktywny aside.
- **Brak dostępu**:
    - użytkownik bez roli `admin` nie widzi sekcji admina po wejściu na trasę i zostaje przekierowany zgodnie z istniejącą polityką.
- **Stan ładowania roli**:
    - jeśli aplikacja ustala rolę po bootstrapie sesji, layout admina nie powinien renderować się jako dostępny, dopóki uprawnienia nie zostaną potwierdzone.
- **Brak danych dla `Użytkownicy`**:
    - placeholder nie pokazuje spinnera ani błędu API, bo widok nie pobiera danych.

## Responsywność

- Desktop pozostaje wariantem podstawowym dla sekcji admina.
- Na większych ekranach aside jest stale widoczny po lewej stronie.
- Na mniejszych ekranach zachowanie może wykorzystywać ten sam wzorzec co inne boczne panele aplikacji, ale bez dodawania nowej pozycji do Bottom Bara.
- Sekcja admina zachowuje spójność z istniejącą nawigacją globalną: Topbar pozostaje wejściem do panelu, a aside obsługuje nawigację wewnętrzną.

## Wymagane elementy UI/komponenty (proponowane)

- **AdminLayout**: wspólny layout dla wszystkich tras `/admin/*`.
- **AdminAsideNav**: komponent lewego menu z aktywną nawigacją.
- **AdminDashboardPage**: istniejący lub rozszerzony widok dashboardu osadzony w nowym layoucie.
- **AdminUsersPlaceholderPage**: nowy widok placeholderowy dla `/admin/users`.

## Kryteria UX (Definition of Done dla UI)

- Po wejściu na `/admin` użytkownik trafia na `/admin/dashboard`.
- W każdej podstronie admina widoczny jest wspólny aside po lewej stronie.
- Aside zawiera dokładnie pozycje `Dashboard` i `Użytkownicy`.
- Aktywna pozycja aside zawsze odpowiada bieżącej trasie.
- Widok `Użytkownicy` jest czytelnym placeholderem i nie sugeruje ukończonej funkcji zarządzania użytkownikami.
