# Architektura UI dla PychaŚwiatowa

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika aplikacji PychaŚwiatowa zostanie zbudowana w oparciu o framework Angular i bibliotekę komponentów Angular Material, zgodnie z podejściem "desktop-first" zapewniającym pełną responsywność. Aplikacja będzie składać się z dwóch głównych obszarów: publicznego (dla niezalogowanych użytkowników), obejmującego stronę powitalną, logowanie i rejestrację, oraz prywatnego (dla zalogowanych), chronionego mechanizmem autoryzacji.

Centralnym elementem dla zalogowanego użytkownika jest główny układ aplikacji (layout) zawierający stały, boczny panel nawigacyjny (sidebar) oraz górny pasek z informacjami o profilu. Nawigacja ta zapewnia spójny dostęp do kluczowych sekcji: Dashboardu, listy przepisów i listy kolekcji. Zarządzanie stanem aplikacji będzie opierać się na serwisach Angulara, a komunikacja z API będzie scentralizowana i zabezpieczona za pomocą `HttpInterceptor`, który obsłuży globalnie błędy oraz autoryzację.

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
- **Kluczowe informacje do wyświetlenia:** Powitanie, kafelki nawigacyjne ("Moje przepisy", "Moje kolekcje"), ewentualnie lista ostatnio dodanych przepisów.
- **Kluczowe komponenty widoku:** `mat-card` jako kafelki nawigacyjne.
- **Względy UX, dostępności i bezpieczeństwa:** Dostęp chroniony przez `AuthGuard`.

**5. Lista Przepisów (Moje przepisy)**
- **Ścieżka:** `/recipes`
- **Główny cel:** Przeglądanie, wyszukiwanie i filtrowanie wszystkich przepisów użytkownika.
- **Kluczowe informacje do wyświetlenia:** Siatka przepisów (zdjęcie, nazwa), pole wyszukiwania, kontrolki do sortowania i filtrowania (kategorie, tagi), paginacja.
- **Kluczowe komponenty widoku:** `mat-paginator`, `mat-card`, `mat-form-field`, `mat-select`, `mat-chip-list`, komponent "stanu pustego".
- **Względy UX, dostępności i bezpieczeństwa:** Dynamiczne odświeżanie listy przy zmianie filtrów. Wskaźniki ładowania. Obsługa stanu pustego z wezwaniem do akcji.

**6. Szczegóły Przepisu**
- **Ścieżka:** `/recipes/:id`
- **Główny cel:** Wyświetlenie pełnych informacji o przepisie i umożliwienie wykonania na nim operacji.
- **Kluczowe informacje do wyświetlenia:** Nazwa, opis, zdjęcie, listy składników i kroków (z podziałem na sekcje), przypisane kategorie i tagi.
- **Kluczowe komponenty widoku:** `mat-list`, `mat-chip-list`, przyciski akcji ("Edytuj", "Usuń", "Dodaj do kolekcji").
- **Względy UX, dostępności i bezpieczeństwa:** Responsywny układ dwukolumnowy przechodzący w jednokolumnowy. Modal potwierdzający usunięcie.

**7. Formularz Przepisu (Dodaj/Edytuj)**
- **Ścieżka:** `/recipes/new`, `/recipes/:id/edit`
- **Główny cel:** Tworzenie i modyfikacja przepisu.
- **Kluczowe informacje do wyświetlenia:** Formularz podzielony na sekcje (dane podstawowe, składniki, kroki), pola do edycji nazwy, opisu, zdjęcia, kategorii, tagów.
- **Kluczowe komponenty widoku:** `mat-stepper` (opcjonalnie), `mat-form-field`, `mat-select`, `mat-chip-list` z inputem, komponent do przesyłania plików, interaktywna lista z funkcją "przeciągnij i upuść" (Angular CDK).
- **Względy UX, dostępności i bezpieczeństwa:** Przejrzysty podział formularza. Funkcja "przeciągnij i upuść" ułatwia reorganizację. Jasne komunikaty walidacji.

**8. Import Przepisu**
- **Ścieżka:** `/recipes/import`
- **Główny cel:** Umożliwienie szybkiego tworzenia przepisu poprzez wklejenie gotowego tekstu.
- **Kluczowe informacje do wyświetlenia:** Duże pole tekstowe (`textarea`) z instrukcją lub przykładem formatowania, przycisk "Importuj i edytuj".
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field` (textarea), `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasna instrukcja dotycząca oczekiwanego formatu tekstu. Po udanym imporcie użytkownik jest od razu przenoszony do trybu edycji, co stanowi płynny i logiczny przepływ pracy. Dostęp chroniony przez `AuthGuard`.

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
- **Nawigacja dla zalogowanych:**
    - **Boczny panel nawigacyjny (Sidebar):** Jest to główny element nawigacyjny. Pozostaje widoczny na większych ekranach i zwija się do ikony "hamburgera" na urządzeniach mobilnych. Zawiera linki do: `Dashboard`, `Moje przepisy`, `Moje kolekcje`.
    - **Nagłówek (Header):** W górnej części aplikacji, zawiera logo (lub ikonę menu na mobile) oraz menu użytkownika po prawej stronie.
    - **Menu użytkownika:** Dostępne pod ikoną awatara w nagłówku. Rozwija się, oferując opcje: `Ustawienia` i `Wyloguj`.

Taka struktura zapewnia stały i przewidywalny dostęp do wszystkich kluczowych sekcji aplikacji z dowolnego miejsca.

## 5. Kluczowe komponenty

Poniższe komponenty będą reużywalne i kluczowe dla zapewnienia spójności oraz efektywności deweloperskiej:

- **Karta przepisu (`RecipeCardComponent`):** Komponent wyświetlający miniaturę przepisu (zdjęcie, nazwa, kategoria) na listach (`/recipes`, `/collections/:id`).
- **Komponent "stanu pustego" (`EmptyStateComponent`):** Generyczny komponent wyświetlający informację (np. "Nie masz jeszcze żadnych przepisów") i przycisk z wezwaniem do akcji (np. "Dodaj pierwszy przepis"). Używany na listach przepisów i kolekcji.
- **Komponent przesyłania pliku (`ImageUploadComponent`):** Komponent obsługujący wybór, walidację i podgląd przesyłanego zdjęcia w formularzu przepisu.
- **Modal dodawania do kolekcji (`AddToCollectionDialogComponent`):** Okno modalne pozwalające na wybranie istniejącej kolekcji z listy lub stworzenie nowej i dodanie do niej bieżącego przepisu.
- **Lista edytowalnych elementów (`EditableListComponent`):** Komponent do zarządzania listą składników/kroków w formularzu, wspierający dodawanie, usuwanie, edycję "in-line" oraz zmianę kolejności za pomocą "przeciągnij i upuść".
