# Admin Sidebar Navigation — wymagania

## Cel

Rozszerzyć istniejącą sekcję administracyjną o **lewe menu aside** w obrębie tras `/admin/*`, aby administrator mógł wygodnie przełączać się między widokiem **„Dashboard”** i placeholderowym widokiem **„Użytkownicy”**.

## Kontekst architektury (istniejące założenia)

- Aplikacja działa jako SPA w Angular + Angular Material, z układem App Shell opartym o Sidebar + Topbar + Footer.
- Sekcja administracyjna istnieje już koncepcyjnie pod trasami `/admin` oraz `/admin/dashboard`.
- Dostęp do `/admin/*` jest przeznaczony wyłącznie dla użytkownika z rolą `admin`, odczytywaną z claimu `app_role` w JWT.
- Widok „Admin - Dashboard” jest przewidziany jako placeholder w MVP i korzysta z minimalnego kontekstu admin-only.
- W sekcji „Moja Pycha” istnieje wzorzec nawigacji bocznej, który należy potraktować jako referencję UX dla nowego aside w panelu admina.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-ADM-SID-001 (layout admina z aside)**: Sekcja `/admin/*` posiada stały lewy panel nawigacyjny widoczny na desktopie, wizualnie i strukturalnie analogiczny do wzorca „Moja Pycha”.
- **FR-ADM-SID-002 (pozycje menu)**: W aside admina dostępne są dokładnie dwie pozycje:
    - `Dashboard`
    - `Użytkownicy`
- **FR-ADM-SID-003 (domyślny wybór)**: Po wejściu na `/admin` użytkownik jest przekierowywany na `/admin/dashboard`, a pozycja `Dashboard` jest oznaczona jako aktywna domyślnie.
- **FR-ADM-SID-004 (aktywny stan nawigacji)**: Aktywna pozycja w aside jest zawsze zgodna z aktualną trasą:
    - `/admin/dashboard` aktywuje `Dashboard`
    - `/admin/users` aktywuje `Użytkownicy`
- **FR-ADM-SID-005 (widok użytkowników - placeholder)**: Kliknięcie `Użytkownicy` prowadzi do nowej trasy `/admin/users`, która wyświetla pusty widok placeholderowy z informacją, że funkcjonalność zostanie zaimplementowana później.
- **FR-ADM-SID-006 (spójność z ochroną tras)**: Wszystkie widoki w obrębie `/admin/*`, w tym `/admin/users`, są chronione tym samym mechanizmem kontroli dostępu co istniejący dashboard admina.
- **FR-ADM-SID-007 (gotowość na rozbudowę)**: Struktura nawigacji i routingu admina musi umożliwiać przyszłe dodawanie kolejnych sekcji bez przebudowy podstawowego layoutu.

### Poza zakresem (explicitly out-of-scope)

- Faktyczna lista użytkowników.
- Filtrowanie, wyszukiwanie, sortowanie i paginacja użytkowników.
- Zarządzanie rolami, blokowaniem kont lub uprawnieniami z poziomu UI.
- Nowy endpoint backendowy zwracający listę użytkowników.
- Rozbudowany panel administracyjny poza prostą nawigacją i placeholderem.

## User stories

### US-ADM-SID-001 — Nawigacja w sekcji administracyjnej

Jako **administrator** chcę widzieć po wejściu do panelu admina lewy panel nawigacyjny z sekcjami `Dashboard` i `Użytkownicy`, aby szybko przełączać się między obszarami administracyjnymi.

**Kryteria akceptacji:**

- Po wejściu na `/admin` aplikacja przekierowuje mnie na `/admin/dashboard`.
- W układzie admina widzę po lewej stronie menu aside.
- W menu aside znajdują się dokładnie dwie pozycje: `Dashboard` i `Użytkownicy`.
- Dla trasy `/admin/dashboard` pozycja `Dashboard` jest oznaczona jako aktywna.
- Przełączenie między pozycjami nie opuszcza sekcji administracyjnej i zachowuje wspólny layout admina.

### US-ADM-SID-002 — Placeholder widoku użytkowników

Jako **administrator** chcę móc wejść do sekcji `Użytkownicy`, nawet jeśli nie jest jeszcze gotowa, aby widzieć przewidziane miejsce dla przyszłej funkcjonalności.

**Kryteria akceptacji:**

- Kliknięcie pozycji `Użytkownicy` prowadzi na `/admin/users`.
- Dla trasy `/admin/users` pozycja `Użytkownicy` jest oznaczona jako aktywna.
- Widok wyświetla nagłówek i placeholder informujący, że zawartość pojawi się w kolejnej iteracji.
- Widok nie próbuje pobierać danych użytkowników z backendu.

### US-ADM-SID-003 — Ochrona sekcji admina

Jako **użytkownik bez uprawnień admina** chcę mieć zablokowany dostęp do każdej podstrony `/admin/*`, aby sekcja administracyjna była dostępna wyłącznie dla uprawnionych osób.

**Kryteria akceptacji:**

- Wejście na `/admin`, `/admin/dashboard` lub `/admin/users` bez roli `admin` kończy się przekierowaniem zgodnym z istniejącymi zasadami bezpieczeństwa.
- Dla zalogowanego użytkownika bez roli `admin` celem przekierowania jest `/forbidden`.
- Dla użytkownika niezalogowanego działa standardowa ochrona tras prywatnych, np. przekierowanie na `/login`.

## Wymagania niefunkcjonalne

- **Spójność UX**: Aside admina powinien być zgodny z istniejącym wzorcem nawigacji bocznej w aplikacji, w tym z typografią, odstępami i sposobem oznaczania aktywnej sekcji.
- **Bezpieczeństwo**: Brak dostępu do `/admin/users` musi być wymuszany przez guard po roli, a nie wyłącznie przez ukrycie linku w UI.
- **Maintainability**: Layout admina powinien stanowić wspólną bazę dla przyszłych tras, np. `/admin/users`, `/admin/recipes`, `/admin/settings`.
- **Minimalizm MVP**: Placeholder `Użytkownicy` nie może implikować pełnej implementacji zarządzania użytkownikami ani wymuszać zmian w modelu danych.
