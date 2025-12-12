# Kompleksowy Plan Testów Aplikacji PychaŚwiatowa

## 1. Wprowadzenie i Cel Testów

### 1.1. Wprowadzenie

PychaŚwiatowa to responsywna aplikacja webowa typu SPA (Single Page Application), zaprojektowana jako cyfrowa książka kucharska. Umożliwia użytkownikom gromadzenie, organizowanie i przeszukiwanie własnych przepisów kulinarnych. Aplikacja zbudowana jest w oparciu o framework Angular, a jej backend realizowany jest w modelu BaaS (Backend-as-a-Service) z wykorzystaniem platformy Supabase.

### 1.2. Cel Testów

Głównym celem testów jest zapewnienie najwyższej jakości aplikacji poprzez weryfikację jej funkcjonalności, wydajności, bezpieczeństwa i użyteczności. Proces testowania ma na celu:

*   **Wykrycie i eliminację błędów** we wszystkich kluczowych modułach aplikacji.
*   **Zapewnienie zgodności** z wymaganiami funkcjonalnymi i niefunkcjonalnymi.
*   **Weryfikację poprawnego działania** integracji pomiędzy frontendem a backendem (Supabase).
*   **Ocenę stabilności i responsywności** interfejsu użytkownika na różnych urządzeniach i przeglądarkach.
*   **Zapewnienie bezpieczeństwa** danych użytkownika i mechanizmów autoryzacji.

## 2. Zakres Testów

### 2.1. Funkcjonalności objęte testami

Testom poddane zostaną wszystkie kluczowe funkcjonalności aplikacji, w tym:

*   **Moduł uwierzytelniania:**
    *   Rejestracja nowych użytkowników.
    *   Logowanie i wylogowywanie.
    *   Ochrona tras chronionych (np. panelu użytkownika) za pomocą `AuthGuard`.
*   **Zarządzanie przepisami (CRUD):**
    *   Tworzenie nowych przepisów z walidacją formularza.
    *   Wyświetlanie listy przepisów z paginacją i filtrowaniem.
    *   Wyświetlanie szczegółów pojedynczego przepisu.
    *   Edycja istniejących przepisów.
    *   Usuwanie przepisów.
*   **Zarządzanie kolekcjami (CRUD):**
    *   Tworzenie nowych kolekcji.
    *   Wyświetlanie listy kolekcji.
    *   Dodawanie i usuwanie przepisów z kolekcji.
    *   Edycja i usuwanie kolekcji.
*   **Panel główny (Dashboard):**
    *   Wyświetlanie powitalnego nagłówka.
    *   Prezentacja ostatnio dodanych przepisów.
    *   Nawigacja do kluczowych sekcji aplikacji.
*   **Interfejs użytkownika:**
    *   Responsywność layoutu (desktop-first).
    *   Działanie komponentów współdzielonych (dialogi, nagłówki, paginacja).
    *   Poprawność wyświetlania i działania elementów z biblioteki Angular Material.

### 2.2. Funkcjonalności wyłączone z testów

W bieżącej fazie testów świadomie wyłączone zostają:

*   **Testy infrastruktury Supabase:** Zakładamy, że usługi dostarczane przez Supabase (baza danych, autentykacja, storage) są stabilne i działają zgodnie z dokumentacją. Testy skupią się na poprawnej integracji z API Supabase, a nie na wewnętrznym działaniu samej platformy.
*   **Testy obciążeniowe na dużą skalę:** W fazie MVP nie będą przeprowadzane zaawansowane testy obciążeniowe symulujące tysiące jednoczesnych użytkowników.
*   **Testy A/B** oraz zaawansowane testy użyteczności (UX) z udziałem grup fokusowych.

## 3. Strategia Testowania

Strategia testowania opiera się na **Piramidzie Testów**, co oznacza położenie nacisku na solidne fundamenty w postaci testów jednostkowych i integracyjnych, uzupełnionych przez testy End-to-End (E2E) weryfikujące kluczowe ścieżki użytkownika.

*   **Poziom 1: Testy Jednostkowe (Unit Tests):**
    *   **Cel:** Weryfikacja poprawności działania pojedynczych, izolowanych jednostek kodu (komponenty, serwisy, dyrektywy, potoki).
    *   **Podejście:** Testy te będą pisane przez deweloperów równolegle z kodem produkcyjnym. Będą one szybkie, zautomatyzowane i uruchamiane przy każdej zmianie w kodzie w ramach procesu CI/CD.
*   **Poziom 2: Testy Integracyjne (Integration Tests):**
    *   **Cel:** Sprawdzenie, czy kilka połączonych ze sobą jednostek (np. komponent z serwisem) współpracuje poprawnie. Weryfikacja integracji z mockowanym backendem Supabase.
    *   **Podejście:** Testowanie interakcji między komponentami, poprawności przekazywania danych oraz integracji z serwisami aplikacyjnymi.
*   **Poziom 3: Testy End-to-End (E2E):**
    *   **Cel:** Symulacja rzeczywistych scenariuszy użycia aplikacji z perspektywy użytkownika końcowego. Testowanie pełnych przepływów, od interakcji w UI aż po komunikację z prawdziwym backendem (deweloperską instancją Supabase).
    *   **Podejście:** Zautomatyzowane testy obejmujące krytyczne ścieżki, takie jak rejestracja, logowanie, tworzenie przepisu i dodawanie go do kolekcji.

Proces CI/CD na GitHub Actions będzie skonfigurowany tak, aby automatycznie uruchamiał testy jednostkowe i integracyjne po każdym `push` do repozytorium, blokując wdrożenie w przypadku niepowodzenia testów. Testy E2E będą uruchamiane regularnie na środowisku deweloperskim.

## 4. Typy Testów

### 4.1. Testy Jednostkowe

*   **Narzędzie:** Vitest
*   **Opis:** Testy te będą skupiać się na logice biznesowej w serwisach oraz na logice prezentacji w komponentach, izolując je od zależności za pomocą mocków i atrap (stubs).
*   **Przykładowe przypadki testowe:**
    *   **`AuthService`:**
        *   `login()`: Czy po podaniu poprawnych danych serwis wywołuje metodę `signInWithPassword` z klienta Supabase?
        *   `logout()`: Czy serwis poprawnie wywołuje metodę `signOut`?
        *   Czy stan zalogowania (`isLoggedIn`) jest poprawnie aktualizowany?
    *   **`RecipesService`:**
        *   Czy metoda `addRecipe()` poprawnie mapuje dane z formularza i wywołuje `insert` na tabeli `recipes`?
        *   Czy walidacja logiki biznesowej (np. minimalna liczba składników) działa poprawnie?
    *   **Komponent `LoginFormComponent`:**
        *   Czy formularz jest nieprawidłowy, gdy pola są puste?
        *   Czy po wypełnieniu pól i kliknięciu przycisku "Zaloguj" emitowane jest zdarzenie `submit` z danymi logowania?
        *   Czy komunikaty walidacyjne wyświetlają się poprawnie?

### 4.2. Testy Integracyjne

*   **Narzędzie:** Vitest
*   **Opis:** Testy te będą weryfikować współpracę pomiędzy komponentami a serwisami, które dostarczają im dane. Serwisy komunikujące się z Supabase będą mockowane, aby uniezależnić testy od zewnętrznego API.
*   **Przykładowe przypadki testowe:**
    *   **`RecipesListPageComponent` + `RecipesService`:**
        *   Czy komponent po inicjalizacji wywołuje metodę `getRecipes()` z serwisu?
        *   Czy dane zwrócone przez zamockowany serwis są poprawnie wyświetlane na liście w szablonie HTML komponentu?
        *   Czy kliknięcie przycisku "Usuń" przy przepisie wywołuje metodę `deleteRecipe()` w serwisie z odpowiednim ID?
    *   **`RecipeFormComponent` + `CategoriesService`:**
        *   Czy komponent pobiera i wyświetla listę kategorii z `CategoriesService` w polu wyboru?
        *   Czy po zapisaniu formularza dane są poprawnie przekazywane do `RecipesService`?

### 4.3. Testy End-to-End (E2E)

*   **Narzędzie:** Playwright
*   **Opis:** Testy te będą uruchamiać całą aplikację w przeglądarce i symulować interakcje użytkownika, komunikując się z deweloperską instancją Supabase.
*   **Przykładowe scenariusze testowe:**
    *   **Rejestracja i logowanie:**
        1.  Otwórz stronę główną.
        2.  Kliknij przycisk "Zarejestruj się".
        3.  Wypełnij formularz rejestracji poprawnymi danymi i prześlij go.
        4.  Sprawdź, czy użytkownik został przekierowany do panelu głównego.
        5.  Wyloguj się.
        6.  Spróbuj zalogować się przy użyciu nowo utworzonych danych.
        7.  Sprawdź, czy logowanie zakończyło się sukcesem.
    *   **Pełen cykl życia przepisu:**
        1.  Zaloguj się do aplikacji.
        2.  Przejdź do formularza tworzenia nowego przepisu.
        3.  Wypełnij wszystkie wymagane pola (nazwa, składniki, instrukcje) i zapisz przepis.
        4.  Sprawdź, czy przepis pojawił się na liście przepisów.
        5.  Wejdź w szczegóły tego przepisu i upewnij się, że wszystkie dane są poprawne.
        6.  Edytuj przepis, zmieniając jego nazwę.
        7.  Sprawdź, czy nazwa została zaktualizowana na liście i w szczegółach.
        8.  Usuń przepis.
        9.  Sprawdź, czy przepis zniknął z listy.

### 4.4. Testy Interfejsu Użytkownika i Responsywności

*   **Narzędzie:** Ręczne testy, narzędzia deweloperskie przeglądarek, Playwright (do screenshot testing).
*   **Opis:** Weryfikacja, czy aplikacja wygląda i działa poprawnie na różnych rozmiarach ekranu i w różnych przeglądarkach.
*   **Przypadki testowe:**
    *   Sprawdzenie layoutu na popularnych rozdzielczościach (Mobile, Tablet, Desktop).
    *   Weryfikacja działania menu nawigacyjnego w wersji mobilnej (hamburger menu).
    *   Testowanie czytelności i dostępności elementów interaktywnych na małych ekranach.
    *   Sprawdzenie spójności wizualnej komponentów Angular Material.
    *   Testy na najnowszych wersjach przeglądarek: Chrome, Firefox, Safari, Edge.

### 4.5. Testy Bezpieczeństwa

*   **Narzędzie:** Ręczna weryfikacja, narzędzia deweloperskie przeglądarek.
*   **Opis:** Podstawowe testy mające na celu weryfikację zabezpieczeń aplikacji.
*   **Przypadki testowe:**
    *   **Ochrona tras:** Czy próba wejścia na adres URL panelu (np. `/dashboard`) przez niezalogowanego użytkownika kończy się przekierowaniem do strony logowania?
    *   **Polityki RLS (Row Level Security) w Supabase:** Ręczna weryfikacja, czy zalogowany użytkownik A może odczytać lub zmodyfikować dane (np. przepisy) należące do użytkownika B (testy wykonane poprzez próby zapytań API z różnymi tokenami JWT).
    *   **Przechowywanie tokenów:** Czy token JWT jest bezpiecznie przechowywany (np. w `localStorage` lub `sessionStorage`) i usuwany po wylogowaniu?
    *   **Walidacja danych wejściowych:** Czy aplikacja jest odporna na podstawowe próby wstrzyknięcia złośliwego kodu (XSS) w polach formularzy (np. poprzez wpisanie `<script>alert('test')</script>`).

## 5. Środowiska Testowe

*   **Środowisko lokalne (Local):**
    *   **Opis:** Maszyny deweloperskie. Służy do tworzenia kodu i uruchamiania testów jednostkowych oraz integracyjnych.
    *   **Backend:** Lokalna instancja Supabase uruchamiana przez Supabase CLI.
*   **Środowisko CI/CD (GitHub Actions):**
    *   **Opis:** Środowisko do automatycznego uruchamiania testów jednostkowych i integracyjnych po każdym `push`.
*   **Środowisko deweloperskie/testowe (Development/Staging):**
    *   **Opis:** W pełni funkcjonalna instancja aplikacji wdrożona na Firebase Hosting, połączona z deweloperskim projektem Supabase. Na tym środowisku będą uruchamiane testy E2E oraz testy manualne.
*   **Środowisko produkcyjne (Production):**
    *   **Opis:** Wersja aplikacji dostępna dla użytkowników końcowych. Na tym środowisku wykonywane będą jedynie testy dymne (smoke tests) po każdym wdrożeniu, w celu potwierdzenia, że krytyczne funkcjonalności działają poprawnie.

## 6. Narzędzia Testowe

| Kategoria                | Narzędzie                               | Zastosowanie                                                                   |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| **Framework testowy**    | `Vitest`                                  | Uruchamianie testów jednostkowych i integracyjnych dla kodu Angular.           |
| **Testy E2E**            | `Playwright`                            | Automatyzacja testów End-to-End, symulacja interakcji użytkownika w przeglądarce. |
| **CI/CD**                | `GitHub Actions`                        | Automatyzacja procesów budowania, testowania i wdrażania aplikacji.            |
| **Zarządzanie kodem**    | `Git` / `GitHub`                        | Kontrola wersji i hosting repozytorium kodu.                                   |
| **Narzędzia deweloperskie** | Narzędzia wbudowane w przeglądarki      | Debugowanie, inspekcja DOM, analiza wydajności, testowanie responsywności.     |

## 7. Kryteria Wejścia i Wyjścia

### 7.1. Kryteria Wejścia (Rozpoczęcia Testów)

*   Kod źródłowy dla testowanych funkcjonalności został ukończony i zintegrowany z główną gałęzią deweloperską.
*   Środowisko testowe jest przygotowane i w pełni skonfigurowane.
*   Wszystkie zależności (np. instancja Supabase) są dostępne i działają poprawnie.
*   Aplikacja pomyślnie się buduje bez błędów.

### 7.2. Kryteria Wyjścia (Zakończenia Testów)

*   Osiągnięto zdefiniowany poziom pokrycia kodu testami jednostkowymi (np. 80%).
*   Wszystkie zaplanowane przypadki testowe zostały wykonane.
*   Wszystkie krytyczne i poważne błędy zostały naprawione i zweryfikowane.
*   Żadne znane błędy krytyczne nie pozostają otwarte.
*   Dokumentacja testowa (raporty) została przygotowana i zaakceptowana.

## 8. Harmonogram Testów

Testowanie będzie procesem ciągłym, zintegrowanym z cyklem rozwoju oprogramowania.

| Faza                   | Opis                                                                 | Ramy czasowe                               |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| **Testy jednostkowe**  | Pisane na bieżąco przez deweloperów w trakcie implementacji.          | Równolegle z developmentem (sprint-by-sprint) |
| **Testy integracyjne** | Pisane po zintegrowaniu kilku komponentów/serwisów.                   | Równolegle z developmentem (sprint-by-sprint) |
| **Testy E2E**          | Tworzenie i utrzymanie skryptów dla kluczowych ścieżek użytkownika.   | Rozpoczęcie po ustabilizowaniu się głównych funkcjonalności. |
| **Testy regresji**     | Uruchamianie pełnego zestawu testów automatycznych przed wdrożeniem.   | Przed każdym wydaniem na produkcję.         |
| **Testy manualne**     | Testy eksploracyjne i weryfikacja UI/UX.                             | Pod koniec każdego sprintu/przed wydaniem.  |

## 9. Zasoby i Odpowiedzialności

| Rola               | Odpowiedzialność                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Deweloperzy**    | - Pisanie testów jednostkowych i integracyjnych.<br>- Naprawa błędów wykrytych w trakcie wszystkich faz testów.<br>- Utrzymanie CI/CD. |
| **Analityk QA / Tester** | - Projektowanie i implementacja testów E2E.<br>- Przeprowadzanie testów manualnych i eksploracyjnych.<br>- Raportowanie błędów i weryfikacja poprawek.<br>- Zarządzanie planem testów i strategią. |
| **Product Owner**  | - Definiowanie kryteriów akceptacyjnych.<br>- Priorytetyzacja naprawy błędów.<br>- Ostateczna akceptacja funkcjonalności. |

## 10. Zarządzanie Ryzykiem

| Ryzyko                                      | Prawdopodobieństwo | Wpływ  | Plan Mitygacji                                                                                                             |
| ------------------------------------------- | ------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------- |
| **Błędy w integracji z Supabase**           | Średnie            | Wysoki | Mockowanie API Supabase w testach integracyjnych. Dokładne testy E2E na środowisku deweloperskim.                           |
| **Niska jakość kodu i "dług technologiczny"** | Średnie            | Średni | Wymuszenie wysokiego pokrycia kodu testami. Regularne przeglądy kodu (Code Review). Statyczna analiza kodu.               |
| **Problemy z wydajnością frontendu**        | Niskie             | Średni | Profilowanie aplikacji za pomocą narzędzi deweloperskich. Optymalizacja ładowania zasobów (lazy loading modułów Angular). |
| **Błędy regresji w istniejących funkcjach** | Wysokie            | Wysoki | Kompleksowy zestaw zautomatyzowanych testów regresji (jednostkowych, E2E) uruchamiany w CI/CD przed każdym wdrożeniem.   |
| **Niewystarczające zasoby do testowania**   | Niskie             | Średni | Automatyzacja kluczowych scenariuszy (E2E) w celu odciążenia testów manualnych. Priorytetyzacja testów na podstawie ryzyka. |

## 11. Raportowanie

*   **Raportowanie błędów:** Wszystkie wykryte błędy będą zgłaszane w systemie do zarządzania projektami (np. GitHub Issues). Każde zgłoszenie będzie zawierać:
    *   Tytuł i opis błędu.
    *   Kroki do reprodukcji.
    *   Oczekiwany vs. rzeczywisty rezultat.
    *   Zrzuty ekranu lub nagrania wideo.
    *   Priorytet (Krytyczny, Wysoki, Średni, Niski).
*   **Raporty z wykonania testów:**
    *   **Testy automatyczne:** Wyniki będą dostępne bezpośrednio w logach wykonania workflow w GitHub Actions. Narzędzia do raportowania pokrycia kodu (np. `c8` lub `istanbul`) będą generować raporty po każdym przebiegu testów.
    *   **Testy manualne i E2E:** Po każdej sesji testowej zostanie przygotowany zwięzły raport podsumowujący, zawierający liczbę wykonanych testów, liczbę znalezionych błędów oraz ogólną ocenę stabilności testowanej wersji.
