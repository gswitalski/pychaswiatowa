# Admin Dashboard — wymagania

## Cel

Dodać **sekcję administracyjną** dostępną wyłącznie dla użytkowników z rolą `admin`, widoczną jako pozycja **„Admin”** w głównym górnym menu (Topbar) oraz jako fallback w menu użytkownika na mniejszych ekranach.

## Kontekst architektury (istniejące założenia)

- Aplikacja SPA w Angular + Angular Material, App Shell: Sidebar + Topbar + Footer.
- Role użytkownika przenoszone w JWT jako claim `app_role` (`user`/`premium`/`admin`).
- Istnieje widok **`/forbidden`** dla braku dostępu.
- Bootstrap danych sesji przewidziany przez endpoint **`GET /me`** (id, username, app_role).

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-ADM-001 (widoczność w nawigacji)**: Pozycja **„Admin”** jest widoczna tylko dla użytkowników z rolą `admin`.
    - Desktop: widoczna jako pozycja w Topbarze.
    - Mobile/tablet: Bottom Bar bez zmian; „Admin” dostępny w menu użytkownika (fallback).
- **FR-ADM-002 (routing)**: Sekcja administracyjna posiada ścieżki:
    - `/admin` — sekcja/layout admina (może przekierowywać na dashboard),
    - `/admin/dashboard` — dashboard admina.
- **FR-ADM-003 (ochrona dostępu)**: Wejście na `/admin/*` bez roli `admin` jest blokowane.
    - Gdy użytkownik nie ma uprawnień, następuje przekierowanie na `/forbidden`.
    - Dla braku sesji (niezalogowany) obowiązuje standardowa ochrona tras prywatnych (np. przekierowanie na `/login`), zgodna z istniejącym mechanizmem.
- **FR-ADM-004 (dashboard placeholder)**: Dashboard admina na MVP prezentuje placeholder (bez realnych narzędzi administracyjnych).
    - Widok zawiera nagłówek, krótkie wyjaśnienie oraz 2–4 kafelki/karty „Wkrótce”.
- **FR-ADM-005 (spójność UX)**: Dashboard admina jest spójny wizualnie z resztą App Shell (Angular Material, typografia, odstępy, breadcrumb/page header jeśli istnieje w systemie).

### Poza zakresem (explicitly out-of-scope)

- UI do zarządzania rolami użytkowników.
- Rozbudowany panel administracyjny (listy użytkowników, moderacja treści, konfiguracja).
- Audyt/log zdarzeń administracyjnych.

## User stories

### US-ADM-001 — Dostęp do dashboardu admina z nawigacji

Jako **administrator** (`app_role = admin`) chcę widzieć pozycję **„Admin”** w nawigacji, aby szybko przejść do sekcji administracyjnej aplikacji.

**Kryteria akceptacji:**

- Po zalogowaniu jako użytkownik z rolą `admin` widzę „Admin” w Topbarze.
- Po kliknięciu „Admin” trafiam na `/admin/dashboard`.
- Widok `/admin/dashboard` wyświetla placeholder (nagłówek + karty „Wkrótce”).
- Na mobile/tablet nie dokładamy nowej pozycji do Bottom Bara; „Admin” jest dostępny z menu użytkownika.

### US-ADM-002 — Blokada dostępu dla nie-admina

Jako **użytkownik bez roli admin** chcę, aby aplikacja blokowała dostęp do sekcji admina, żeby nie było możliwości podejrzenia narzędzi administracyjnych.

**Kryteria akceptacji:**

- Jeśli wejdę ręcznie na `/admin` lub `/admin/dashboard` bez roli `admin`, zostanę przekierowany na `/forbidden`.
- Jeśli nie jestem zalogowany i wejdę na `/admin/*`, zadziała standardowa ochrona tras prywatnych (np. przekierowanie na `/login`), zgodna z obecnym systemem.

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: Dostęp w UI musi być zabezpieczony guardem po roli; backend (jeśli pojawią się endpointy admina) musi wymuszać `admin` niezależnie od UI.
- **Maintainability**: Struktura routingu `/admin/*` ma umożliwiać przyszłe rozszerzenia (np. `/admin/users`, `/admin/recipes`).
- **UX**: Brak „migania” (flash) pozycji „Admin” w menu; pozycja ma być renderowana dopiero po ustaleniu roli użytkownika (np. po bootstrapie z `/me`).

