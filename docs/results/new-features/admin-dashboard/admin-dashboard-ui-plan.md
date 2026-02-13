# Admin Dashboard — plan UI

## Cel UI

Udostępnić administratorom (`app_role = admin`) wejście do nowej sekcji `/admin/*` z poziomu nawigacji, oraz zapewnić bezpieczne (guardowane) renderowanie dashboardu z placeholderem.

## Zmiany w nawigacji (App Shell)

### Topbar (desktop-first)

- Dodać pozycję **„Admin”** w Topbarze.
- Pozycja jest widoczna **tylko** gdy `app_role === 'admin'`.
- Kliknięcie prowadzi na: **`/admin/dashboard`**.

### Menu użytkownika (fallback dla mniejszych ekranów)

- W menu użytkownika (np. pod avatarkiem/username) dodać pozycję **„Admin”**:
    - Widoczna tylko dla `app_role === 'admin'`.
    - Link do `/admin/dashboard`.
- Bottom Bar bez zmian (nie dodajemy nowego elementu na MVP).

## Nowe widoki i routing

### 1) Sekcja admina (layout/route)

- **Ścieżka**: `/admin`
- **Zachowanie**:
    - Może działać jako kontener (layout) dla tras potomnych.
    - Domyślnie przekierowuje na `/admin/dashboard`.
- **Ochrona**: guard roli `admin` na poziomie `/admin/*`.

### 2) Dashboard admina (placeholder)

- **Ścieżka**: `/admin/dashboard`
- **Nagłówek strony**: „Panel administracyjny”
- **Treść**:
    - Tekst informacyjny: że funkcje administracyjne będą dodawane w kolejnych iteracjach.
    - 2–4 karty/kafelki (Angular Material) np.:
        - „Statystyki (wkrótce)”
        - „Zarządzanie użytkownikami (wkrótce)”
        - „Moderacja treści (wkrótce)”
        - „Konfiguracja (wkrótce)”

## Stany i edge-case’y

- **Stan ładowania roli (bootstrap)**:
    - Pozycja „Admin” nie powinna pojawić się zanim aplikacja ustali `app_role` (np. po `GET /me`).
    - Jeżeli rola jest nieznana w momencie renderu nawigacji, UI traktuje użytkownika jako nie-admin (bez linku).
- **Brak dostępu**:
    - Użytkownik bez roli `admin` wchodzący na `/admin/*` jest przekierowany na `/forbidden`.
    - Jeżeli użytkownik jest niezalogowany, obowiązuje standardowa ścieżka dla tras prywatnych (np. `/login`), zgodna z istniejącym systemem.
- **Responsywność**:
    - Desktop: „Admin” w Topbarze.
    - Mobile/tablet: brak zmian w Bottom Bar; „Admin” dostępny z menu użytkownika.

## Wymagane elementy UI/komponenty (proponowane)

- **AdminLayout** (opcjonalnie): wspólny wrapper dla `/admin/*`, pozwalający dodać w przyszłości boczne menu admina lub breadcrumbs.
- **AdminDashboardPage**: strona placeholderowa z kartami.
- **RoleGuard (admin)**: dedykowany guard lub rozszerzenie istniejącego mechanizmu, który sprawdza `app_role`.

## Kryteria UX (Definition of Done dla UI)

- Link „Admin” widoczny wyłącznie dla `admin` w Topbarze oraz w menu użytkownika na mniejszych ekranach.
- `/admin/dashboard` działa i jest chroniony.
- Brak migania elementów (render warunkowy po bootstrapie roli).
- Brak zmian w Bottom Bar na MVP.

