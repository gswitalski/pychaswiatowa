# Architektura UI dla PychaŚwiatowa

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika aplikacji PychaŚwiatowa zostanie zbudowana w oparciu o framework Angular i bibliotekę komponentów Angular Material, zgodnie z podejściem "desktop-first" zapewniającym pełną responsywność. Wdrożona zostanie architektura **"App Shell"** separująca nawigację od akcji kontekstowych. Aplikacja będzie składać się z dwóch głównych obszarów: publicznego (dla niezalogowanych użytkowników) oraz prywatnego (dla zalogowanych).

Centralnym elementem dla zalogowanego użytkownika jest **Layout typu "Holy Grail"**:
1.  **Globalny Sidebar (Lewa strona):** Zawiera wyłącznie linki nawigacyjne (Dashboard, Przepisy, Kolekcje). Nie zawiera przycisków akcji.
2.  **Globalny Topbar (Góra):** Zawiera kontekst orientacyjny (Breadcrumbs), globalną wyszukiwarkę (Omnibox) oraz profil użytkownika.
3.  **Page Header (Nagłówek Strony):** Znajduje się nad treścią każdego widoku. To tutaj umieszczone są tytuł strony oraz wszystkie przyciski akcji (Dodaj, Edytuj, Zapisz), zapewniając przewidywalność interfejsu.

## 2. Lista widoków

### Widoki publiczne

**1. Landing Page**
- **Ścieżka:** `/`
- **Główny cel:** Powitanie użytkownika i przedstawienie aplikacji. Skierowanie do logowania lub rejestracji.
- **Kluczowe informacje do wyświetlenia:** Nazwa i logo aplikacji, krótkie hasło marketingowe, przyciski "Zaloguj się" i "Zarejestruj się".
- **Kluczowe komponenty widoku:** Główny nagłówek, sekcja "hero", przyciski akcji.
- **Względy UX, dostępności i bezpieczeństwa:** Prosty i czytelny układ, wyraźne wezwania do akcji.

**2. Logowanie**
- **Ścieżka:** `/login`
- **Główny cel:** Uwierzytelnienie istniejącego użytkownika.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na e-mail i hasło, komunikat o błędach, link do strony rejestracji.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasna komunikacja błędów walidacji. Pola formularza poprawnie oetykietowane.

**3. Rejestracja**
- **Ścieżka:** `/register`
- **Główny cel:** Umożliwienie nowym użytkownikom założenia konta.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na e-mail i hasło (wraz z potwierdzeniem), link do strony logowania.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Walidacja hasła po stronie klienta (np. minimalna długość).

### Widoki prywatne (dla zalogowanych)

**4. Dashboard**
- **Ścieżka:** `/dashboard`
- **Główny cel:** Strona startowa po zalogowaniu, zapewniająca szybki dostęp do głównych funkcji.
- **Header:** Tytuł "Witaj, [Imię]". Brak przycisków akcji.
- **Kluczowe informacje do wyświetlenia:** Kafelki nawigacyjne ("Moje przepisy", "Moje kolekcje"), lista ostatnio dodanych przepisów.
- **Kluczowe komponenty widoku:** `mat-card` jako kafelki nawigacyjne.
- **Względy UX, dostępności i bezpieczeństwa:** Dostęp chroniony przez `AuthGuard`.

**5. Lista Przepisów (Moje przepisy)**
- **Ścieżka:** `/recipes`
- **Główny cel:** Przeglądanie, wyszukiwanie i filtrowanie wszystkich przepisów użytkownika.
- **Header:** Tytuł "Twoje Przepisy", Przycisk "Dodaj Przepis" (Split Button: "Ręcznie" | "Import").
- **Kluczowe informacje do wyświetlenia:** Siatka przepisów (zdjęcie, nazwa), pasek filtrów (Chips) pod nagłówkiem, paginacja.
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-paginator`, `mat-card`, `mat-chip-list`, komponent "stanu pustego" z akcją.
- **Względy UX, dostępności i bezpieczeństwa:** Dynamiczne odświeżanie listy. Wskaźniki ładowania (Skeletons). Obsługa stanu pustego z wezwaniem do akcji "Utwórz pierwszy przepis".

**6. Szczegóły Przepisu**
- **Ścieżka:** `/recipes/:id`
- **Główny cel:** Wyświetlenie pełnych informacji o przepisie i umożliwienie wykonania na nim operacji.
- **Header:** Tytuł przepisu. Akcje: Ikony (Ulubione, Edytuj, Usuń).
- **Kluczowe informacje do wyświetlenia:** Nazwa, opis, zdjęcie, listy składników i kroków (kroki numerowane w sposób ciągły).
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-list`, `mat-chip-list`, Sticky Navigation (spis treści) na desktopie.
- **Względy UX, dostępności i bezpieczeństwa:** Układ 3-kolumnowy (Info / Treść / Spis) na desktopie. Feedback "Toast" po usunięciu z opcją "Cofnij". Numeracja kroków nie resetuje się po nagłówkach sekcji (wymaga zastosowania CSS Counters lub odpowiedniej struktury HTML).

**7. Formularz Przepisu (Dodaj/Edytuj)**
- **Ścieżka:** `/recipes/new`, `/recipes/:id/edit`
- **Główny cel:** Tworzenie i modyfikacja przepisu.
- **Header:** Tytuł "Nowy przepis" / "Edycja". Akcje: "Anuluj", "Zapisz" (Sticky - zawsze widoczny).
- **Kluczowe informacje do wyświetlenia:** Formularz podzielony na sekcje: Dane podstawowe (nazwa, opis, kategoria, widoczność), Składniki, Kroki, Zdjęcie.
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-form-field`, `mat-select`, `mat-radio-group` (do wyboru widoczności: Prywatny/Współdzielony/Publiczny), komponent do przesyłania plików, interaktywna lista "przeciągnij i upuść".
- **Względy UX, dostępności i bezpieczeństwa:** Przycisk Zapisz w nagłówku eliminuje konieczność scrollowania. Walidacja blokuje zapis lub wyświetla błędy. Domyślna widoczność to "Prywatny".

**8. Import Przepisu**
- **Ścieżka:** `/recipes/import`
- **Główny cel:** Szybkie tworzenie przepisu z tekstu w trybie "Focus".
- **Header:** Tytuł "Importuj Przepis". Akcje: "Anuluj", "Importuj".
- **Kluczowe informacje do wyświetlenia:** Dwa panele: Pole tekstowe (Paste area) i Podgląd na żywo (Live Preview).
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-form-field` (textarea), Podgląd przepisu.
- **Względy UX, dostępności i bezpieczeństwa:** Minimalizm interfejsu (ukrycie zbędnych elementów). Podgląd na żywo daje pewność co do formatowania przed importem.

**9. Lista Kolekcji (Moje kolekcje)**
- **Ścieżka:** `/collections`
- **Główny cel:** Zarządzanie kolekcjami przepisów.
- **Kluczowe informacje do wyświetlenia:** Lista istniejących kolekcji z opcjami edycji i usunięcia.
- **Kluczowe komponenty widoku:** `mat-list` lub `mat-card` do wyświetlania kolekcji, przycisk do tworzenia nowej, komponent "stanu pustego".
- **Względy UX, dostępności i bezpieczeństwa:** Potwierdzenie usunięcia kolekcji w oknie modalnym.

**10. Szczegóły Kolekcji**
- **Ścieżka:** `/collections/:id`
- **Główny cel:** Wyświetlanie przepisów przypisanych do konkretnej kolekcji.
- **Kluczowe informacje do wyświetlenia:** Nazwa i opis kolekcji, lista zawartych w niej przepisów.
- **Kluczowe komponenty widoku:** Lista przepisów (komponent współdzielony z Listą Przepisów), przycisk "Usuń z kolekcji" przy każdym przepisie.
- **Względy UX, dostępności i bezpieczeństwa:** Spójna prezentacja przepisów z główną listą.

**11. Ustawienia Konta**
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

- **Nawigacja dla gości:** Ogranicza się do prostego nagłówka z linkami do logowania i rejestracji.
- **Nawigacja dla zalogowanych (App Shell):**
    - **Sidebar (Lewa strona):** Główny panel nawigacyjny. Zawiera linki: `Dashboard`, `Moje przepisy`, `Moje kolekcje`, `Ustawienia`, `Wyloguj`. Nie zawiera akcji operacyjnych. Na mobile zwijany (Hamburger) lub Bottom Bar.
    - **Topbar (Góra):** Pasek kontekstowy. Zawiera:
        - **Breadcrumbs:** Ścieżka powrotu (np. `Kolekcje > Święta`).
        - **Omnibox:** Globalne wyszukiwanie dostępne zawsze.
        - **Profil:** Avatar i menu użytkownika.
    - **Page Header:** Nagłówek widoku pod Topbarem. Zawiera tytuł i przyciski akcji.

Taka struktura zapewnia jasny podział na to "gdzie jestem" (Topbar/Sidebar) i "co mogę zrobić" (Page Header).

## 5. Kluczowe komponenty

Poniższe komponenty będą reużywalne i kluczowe dla zapewnienia spójności oraz efektywności deweloperskiej:

- **Karta przepisu (`RecipeCardComponent`):** Komponent wyświetlający miniaturę przepisu (zdjęcie, nazwa, kategoria) na listach (`/recipes`, `/collections/:id`).
- **Komponent "stanu pustego" (`EmptyStateComponent`):** Generyczny komponent wyświetlający informację (np. "Nie masz jeszcze żadnych przepisów") i przycisk z wezwaniem do akcji (np. "Dodaj pierwszy przepis"). Używany na listach przepisów i kolekcji.
- **Komponent przesyłania pliku (`ImageUploadComponent`):** Komponent obsługujący wybór, walidację i podgląd przesyłanego zdjęcia w formularzu przepisu.
- **Modal dodawania do kolekcji (`AddToCollectionDialogComponent`):** Okno modalne pozwalające na wybranie istniejącej kolekcji z listy lub stworzenie nowej i dodanie do niej bieżącego przepisu.
- **Lista edytowalnych elementów (`EditableListComponent`):** Komponent do zarządzania listą składników/kroków w formularzu, wspierający dodawanie, usuwanie, edycję "in-line" oraz zmianę kolejności za pomocą "przeciągnij i upuść".
