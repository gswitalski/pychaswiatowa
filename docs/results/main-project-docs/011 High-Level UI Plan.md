# Architektura UI dla PychaŚwiatowa

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika aplikacji PychaŚwiatowa zostanie zbudowana w oparciu o framework Angular i bibliotekę komponentów Angular Material, zgodnie z podejściem "desktop-first" zapewniającym pełną responsywność. Wdrożona zostanie architektura **"App Shell"** separująca nawigację od akcji kontekstowych. Aplikacja będzie składać się z dwóch głównych obszarów: publicznego (dla niezalogowanych użytkowników) oraz prywatnego (dla zalogowanych).

Centralnym elementem dla zalogowanego użytkownika jest **Layout typu "Holy Grail"**:
1.  **Globalny Sidebar (Lewa strona):** Zawiera wyłącznie linki nawigacyjne (Moja Pycha, Przepisy, Kolekcje, Ustawienia). Nie zawiera przycisków akcji. Sidebar jest widoczny wyłącznie w sekcjach: `/dashboard`, `/my-recipies` (alias: `/my-recipes`), `/recipes/**`, `/collections/**`, `/settings/**`.
2.  **Globalny Topbar (Góra):** Zawiera stałą główną nawigację (zakładki) **Moja Pycha** (`/dashboard`) i **Odkrywaj przepisy** (`/explore`) z wyróżnieniem aktywnej pozycji, stałą ikonę/akcję globalnego wyszukiwania (Omnibox, np. jako overlay) oraz profil użytkownika. Breadcrumbs są wyświetlane jako element orientacyjny na głębszych trasach (np. wewnątrz kolekcji).
3.  **Page Header (Nagłówek Strony):** Znajduje się nad treścią każdego widoku. To tutaj umieszczone są tytuł strony oraz wszystkie przyciski akcji (Dodaj, Edytuj, Zapisz), zapewniając przewidywalność interfejsu.

## 2. Lista widoków

### Widoki publiczne

**1. Landing Page**
- **Ścieżka:** `/`
- **Główny cel:** Powitanie użytkownika i przedstawienie aplikacji oraz natychmiastowe udostępnienie wartościowego contentu (publiczne przepisy) z możliwością wyszukiwania.
- **Kluczowe informacje do wyświetlenia (gość):** Nazwa i logo aplikacji, krótkie hasło, pole wyszukiwania publicznych przepisów, sekcje z publicznymi przepisami (np. Najnowsze, Popularne, Sezonowe), przyciski "Zaloguj się" i "Zarejestruj się".
- **Kluczowe informacje do wyświetlenia (zalogowany):** Te same sekcje contentowe + nawigacja zalogowanego użytkownika w Topbarze (profil + link "Moja Pycha" prowadzący do `/dashboard`). Brak przycisków "Zaloguj się" i "Zarejestruj się". **Sidebar na widokach publicznych nie jest wyświetlany.**
- **Kluczowe komponenty widoku:** Główny nagłówek, sekcja "hero", publiczny pasek wyszukiwania, sekcje z `RecipeCardComponent`, CTA do logowania/rejestracji.
- **Względy UX, dostępności i bezpieczeństwa:** Prosty i czytelny układ, wyraźne wezwania do akcji. Treści wyłącznie dla przepisów publicznych. W trybie zalogowanego zachować spójność z App Shell i nie powielać CTA do logowania.

**2. Publiczny katalog przepisów (Explore)**
- **Ścieżka:** `/explore`
- **Główny cel:** Przeglądanie i wyszukiwanie publicznych przepisów (MVP: tylko tekst).
- **Kluczowe informacje do wyświetlenia:** Lista kart przepisów (zdjęcie, nazwa, kategoria), pole wyszukiwania, stronicowanie.
- **Kluczowe komponenty widoku:** `mat-form-field` (search), `RecipeCardComponent`, `mat-paginator`, wskaźniki ładowania (Skeletons).
- **Względy UX, dostępności i bezpieczeństwa:** Wyniki zawierają wyłącznie przepisy o widoczności `PUBLIC`. Obsługa stanu pustego ("Brak wyników"). W trybie zalogowanego: oznaczyć na kartach przepisy użytkownika jako "Twój przepis".

**3. Szczegóły przepisu (uniwersalny widok)**
- **Ścieżka:** prywatnie `/recipes/:id` oraz publicznie `/explore/recipes/:id`
- **Główny cel:** Pełny podgląd przepisu w czytelnym układzie - zarówno dla gości jak i zalogowanych użytkowników.
- **Dostępność:** Widok dostępny dla wszystkich użytkowników. Goście mogą przeglądać tylko przepisy publiczne.
- **Zachowanie w zależności od kontekstu:**
    - **Gość (niezalogowany):**
        - Brak nagłówka strony z akcjami właściciela
        - CTA do logowania/rejestracji na dole strony
        - Przy próbie dostępu do niepublicznego przepisu: komunikat o braku dostępu z zachętą do logowania
    - **Zalogowany (cudzy przepis):**
        - Nagłówek z przyciskiem "Dodaj do kolekcji"
        - Brak przycisków edycji i usuwania
        - Przy próbie dostępu do niepublicznego przepisu innego autora: komunikat o braku dostępu
    - **Zalogowany (własny przepis):**
        - Pełna funkcjonalność: przyciski "Dodaj do kolekcji", "Edytuj", "Usuń"
- **Kluczowe informacje do wyświetlenia:** Nazwa, opis, zdjęcie, listy składników i kroków (kroki numerowane w sposób ciągły), kategoria, tagi, autor i data utworzenia (dla publicznych przepisów innych autorów).
- **Kluczowe komponenty widoku:** `PageHeaderComponent`, `RecipeHeaderComponent`, `RecipeImageComponent`, `RecipeContentListComponent`, `mat-chip-list`.
- **Względy UX, dostępności i bezpieczeństwa:** Układ 2-kolumnowy na desktopie (składniki / kroki). Dynamiczne dostosowanie akcji w zależności od kontekstu użytkownika. (Opcjonalnie) przekierowania/normalizacja URL w warstwie frontendu: `/explore/recipes/:id-:slug` -> `/explore/recipes/:id`.

**4. Logowanie**
- **Ścieżka:** `/login`
- **Główny cel:** Uwierzytelnienie istniejącego użytkownika.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na e-mail i hasło, komunikat o błędach, link do strony rejestracji.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasna komunikacja błędów walidacji. Pola formularza poprawnie oetykietowane.

**5. Rejestracja**
- **Ścieżka:** `/register`
- **Główny cel:** Umożliwienie nowym użytkownikom założenia konta.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na e-mail i hasło (wraz z potwierdzeniem), link do strony logowania.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Walidacja hasła po stronie klienta (np. minimalna długość).

### Widoki prywatne (dla zalogowanych)

**6. Moja Pycha (Dashboard)**
- **Ścieżka:** `/dashboard`
- **Główny cel:** Strona startowa po zalogowaniu, zapewniająca szybki dostęp do głównych funkcji.
- **Header:** Tytuł "Witaj, [Imię]". Brak przycisków akcji.
- **Kluczowe informacje do wyświetlenia:** Kafelki nawigacyjne ("Moje przepisy", "Moje kolekcje"), lista ostatnio dodanych przepisów.
- **Kluczowe komponenty widoku:** `mat-card` jako kafelki nawigacyjne.
- **Względy UX, dostępności i bezpieczeństwa:** Dostęp chroniony przez `AuthGuard`.

**7. Lista Przepisów (Moje przepisy)**
- **Ścieżka:** `/my-recipies` (alias: `/my-recipes`)
- **Główny cel:** Przeglądanie, wyszukiwanie i filtrowanie biblioteki przepisów użytkownika: jego własnych przepisów oraz publicznych przepisów innych autorów zapisanych w co najmniej jednej jego kolekcji.
- **Header:** Tytuł "Twoje Przepisy", Przycisk "Dodaj Przepis" (Split Button: "Ręcznie" | "Import").
- **Kluczowe informacje do wyświetlenia:** Siatka przepisów (zdjęcie, nazwa), pasek filtrów (Chips) pod nagłówkiem (np. "Moje" / "W moich kolekcjach"), paginacja. Dla przepisów nie mojego autorstwa widoczny chip/etykieta "W moich kolekcjach".
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-paginator`, `mat-card`, `mat-chip-list`, komponent "stanu pustego" z akcją.
- **Względy UX, dostępności i bezpieczeństwa:** Dynamiczne odświeżanie listy. Wskaźniki ładowania (Skeletons). Obsługa stanu pustego z wezwaniem do akcji "Utwórz pierwszy przepis". Przepisy innych autorów pojawiają się na tej liście wyłącznie, gdy są publiczne i znajdują się w kolekcjach użytkownika.

**8. Szczegóły Przepisu**
- **Ścieżka:** `/recipes/:id`
- **Główny cel:** Wyświetlenie pełnych informacji o przepisie i umożliwienie wykonania na nim operacji.
- **Uwaga:** Ten widok jest zunifikowany z publicznym widokiem szczegółów przepisu (patrz punkt 3 w widokach publicznych). Jeden komponent obsługuje wszystkie scenariusze:
    - Gość przeglądający publiczny przepis
    - Zalogowany użytkownik przeglądający cudzy publiczny przepis
    - Zalogowany użytkownik przeglądający własny przepis (pełne akcje)
- **Header:** Tytuł przepisu. Akcje zależne od kontekstu (patrz punkt 3).
- **Kluczowe informacje do wyświetlenia:** Nazwa, opis, zdjęcie, listy składników i kroków (kroki numerowane w sposób ciągły), kategoria, tagi.
- **Kluczowe komponenty widoku:** `PageHeaderComponent`, `RecipeHeaderComponent`, `RecipeImageComponent`, `RecipeContentListComponent`, `mat-chip-list`.
- **Względy UX, dostępności i bezpieczeństwa:** Układ 2-kolumnowy (składniki / kroki) na desktopie. Feedback "Toast" po usunięciu. Numeracja kroków nie resetuje się po nagłówkach sekcji. Dla zalogowanego nie-autora przyciski "Edytuj" i "Usuń" nie są wyświetlane (również gdy wejście nastąpiło z listy `/my-recipies`).

**9. Formularz Przepisu (Dodaj/Edytuj)**
- **Ścieżka:** `/recipes/new`, `/recipes/:id/edit`
- **Główny cel:** Tworzenie i modyfikacja przepisu.
- **Header:** Tytuł "Nowy przepis" / "Edycja". Akcje: "Anuluj", "Zapisz" (Sticky - zawsze widoczny).
- **Kluczowe informacje do wyświetlenia:** Formularz podzielony na sekcje: Dane podstawowe (nazwa, opis, kategoria, widoczność), Składniki, Kroki, Zdjęcie.
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-form-field`, `mat-select`, `mat-radio-group` (do wyboru widoczności: Prywatny/Współdzielony/Publiczny), komponent do przesyłania plików, interaktywna lista "przeciągnij i upuść".
- **Względy UX, dostępności i bezpieczeństwa:** Przycisk Zapisz w nagłówku eliminuje konieczność scrollowania. Walidacja blokuje zapis lub wyświetla błędy. Domyślna widoczność to "Prywatny".

**10. Import Przepisu**
- **Ścieżka:** `/recipes/import`
- **Główny cel:** Szybkie tworzenie przepisu z tekstu w trybie "Focus".
- **Header:** Tytuł "Importuj Przepis". Akcje: "Anuluj", "Importuj".
- **Kluczowe informacje do wyświetlenia:** Dwa panele: Pole tekstowe (Paste area) i Podgląd na żywo (Live Preview).
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-form-field` (textarea), Podgląd przepisu.
- **Względy UX, dostępności i bezpieczeństwa:** Minimalizm interfejsu (ukrycie zbędnych elementów). Podgląd na żywo daje pewność co do formatowania przed importem.

**11. Lista Kolekcji (Moje kolekcje)**
- **Ścieżka:** `/collections`
- **Główny cel:** Zarządzanie kolekcjami przepisów.
- **Kluczowe informacje do wyświetlenia:** Lista istniejących kolekcji z opcjami edycji i usunięcia.
- **Kluczowe komponenty widoku:** `mat-list` lub `mat-card` do wyświetlania kolekcji, przycisk do tworzenia nowej, komponent "stanu pustego".
- **Względy UX, dostępności i bezpieczeństwa:** Potwierdzenie usunięcia kolekcji w oknie modalnym.

**12. Szczegóły Kolekcji**
- **Ścieżka:** `/collections/:id`
- **Główny cel:** Wyświetlanie przepisów przypisanych do konkretnej kolekcji.
- **Kluczowe informacje do wyświetlenia:** Nazwa i opis kolekcji, lista zawartych w niej przepisów.
- **Kluczowe komponenty widoku:** Lista przepisów (komponent współdzielony z Listą Przepisów), przycisk "Usuń z kolekcji" przy każdym przepisie.
- **Względy UX, dostępności i bezpieczeństwa:** Spójna prezentacja przepisów z główną listą.

**13. Ustawienia Konta**
- **Ścieżka:** `/settings`
- **Główny cel:** Umożliwienie użytkownikowi zarządzania swoim profilem.
- **Kluczowe informacje do wyświetlenia:** Formularz zmiany nazwy użytkownika, formularz zmiany hasła.
- **Kluczowe komponenty widoku:** `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasne zasady walidacji haseł.

## 3. Mapa podróży użytkownika

Główny przepływ pracy dla nowego użytkownika koncentruje się na łatwym dodaniu i zorganizowaniu pierwszego przepisu:
1.  **Rejestracja i logowanie:** Użytkownik tworzy konto i jest automatycznie logowany, trafiając na **Dashboard**.
2.  **Tworzenie przepisu:** Z Dashboardu lub widoku **Listy Przepisów** (który wyświetla stan pusty), użytkownik przechodzi do **Formularza Przepisu**.
3.  **Wypełnianie danych:** Użytkownik dodaje wszystkie informacje o przepisie, w tym nazwę, składniki, kroki, kategorię i tagi.
4.  **Zapis i przekierowanie:** Po zapisaniu, aplikacja przenosi go do widoku **Szczegółów Przepisu**, aby mógł zobaczyć efekt swojej pracy.
5.  **Organizacja w kolekcji:** Na stronie szczegółów, za pomocą przycisku "Dodaj do kolekcji", użytkownik otwiera modal, w którym może stworzyć nową kolekcję (np. "Ulubione") i od razu przypisać do niej przepis.
6.  **Weryfikacja:** Użytkownik może nawigować do widoku **Listy Kolekcji**, a następnie do **Szczegółów Kolekcji**, aby upewnić się, że jego przepis został poprawnie dodany.

## 4. Układ i struktura nawigacji

- **Nawigacja dla gości:** Topbar zawiera stałą główną nawigację: `Moja Pycha` (do `/dashboard`) i `Odkrywaj przepisy` (do `/explore`) oraz akcje po prawej stronie: `Zaloguj` i `Zarejestruj`. Na landing (`/`) dodatkowo widoczne jest pole wyszukiwania publicznych przepisów.
- **Nawigacja na publicznych widokach dla zalogowanych:** Publiczne ścieżki (`/`, `/explore`, `/explore/recipes/:id`) korzystają z Topbara (bez Sidebara):
    - brak przycisków "Zaloguj" i "Zarejestruj",
    - w Topbarze dostępny jest profil użytkownika (menu + wylogowanie),
    - w Topbarze dostępna jest stała główna nawigacja: `Moja Pycha` (`/dashboard`) i `Odkrywaj przepisy` (`/explore`).
- **Nawigacja dla zalogowanych (App Shell):**
    - **Sidebar (Lewa strona):** Główny panel nawigacyjny. Zawiera linki: `Moja Pycha` (route: `/dashboard`), `Moje przepisy`, `Moje kolekcje`, `Ustawienia`. Nie zawiera akcji operacyjnych. Sidebar jest widoczny wyłącznie na ścieżkach: `/dashboard`, `/my-recipies` (alias: `/my-recipes`), `/recipes/**`, `/collections/**`, `/settings/**`. Na mobile zwijany (Hamburger) lub Bottom Bar.
    - **Topbar (Góra):** Pasek kontekstowy. Zawiera:
        - **Główna nawigacja (stała):** Zakładki "Moja Pycha" oraz "Odkrywaj przepisy" z wyróżnieniem aktywnej pozycji. **Lista pozycji jest zahardkodowana we froncie** (konfiguracja statyczna) i przygotowana pod przyszłe moduły: blog, menu, zakupy.
        - **Breadcrumbs (kontekstowe):** Ścieżka powrotu wyświetlana na głębszych trasach (np. `Kolekcje > Święta`).
        - **Omnibox:** Globalne wyszukiwanie dostępne zawsze (np. jako ikona otwierająca overlay).
        - **Profil:** Avatar i menu użytkownika.
    - **Page Header:** Nagłówek widoku pod Topbarem. Zawiera tytuł i przyciski akcji.

Taka struktura zapewnia jasny podział na to "gdzie jestem" (Topbar/Sidebar) i "co mogę zrobić" (Page Header).

## 5. Kluczowe komponenty

Poniższe komponenty będą reużywalne i kluczowe dla zapewnienia spójności oraz efektywności deweloperskiej:

- **Karta przepisu (`RecipeCardComponent`):** Komponent wyświetlający miniaturę przepisu (zdjęcie, nazwa, kategoria) na listach (`/my-recipies`, `/collections/:id`).
- **Komponent "stanu pustego" (`EmptyStateComponent`):** Generyczny komponent wyświetlający informację (np. "Nie masz jeszcze żadnych przepisów") i przycisk z wezwaniem do akcji (np. "Dodaj pierwszy przepis"). Używany na listach przepisów i kolekcji.
- **Komponent przesyłania pliku (`ImageUploadComponent`):** Komponent obsługujący wybór, walidację i podgląd przesyłanego zdjęcia w formularzu przepisu.
- **Modal dodawania do kolekcji (`AddToCollectionDialogComponent`):** Okno modalne pozwalające na wybranie istniejącej kolekcji z listy lub stworzenie nowej i dodanie do niej bieżącego przepisu.
- **Lista edytowalnych elementów (`EditableListComponent`):** Komponent do zarządzania listą składników/kroków w formularzu, wspierający dodawanie, usuwanie, edycję "in-line" oraz zmianę kolejności za pomocą "przeciągnij i upuść".
