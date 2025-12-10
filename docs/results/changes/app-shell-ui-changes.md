# Zmiany: App Shell UI & Contextual Actions

Dokument opisuje zmiany wprowadzone w ramach inicjatywy "App Shell", mającej na celu uporządkowanie interfejsu, separację nawigacji od akcji oraz wdrożenie nowoczesnych wzorców UX (Material Design 3).

## 1. Historyjki Użytkownika (User Stories)

### Nowe historyjki

#### US-014: Globalna orientacja i nawigacja (App Shell)
*   **Opis:** Jako użytkownik, chcę mieć stały dostęp do głównej nawigacji i wiedzieć, w którym miejscu aplikacji się znajduję, aby poruszać się po niej intuicyjnie bez gubienia kontekstu.
*   **Kryteria akceptacji:**
    1.  Aplikacja posiada stały pasek boczny (Sidebar) na desktopie / menu hamburgerowe na mobile, zawierające linki: Dashboard, Przepisy, Kolekcje, Ustawienia, Wyloguj.
    2.  Sidebar nie zawiera przycisków akcji (np. "Dodaj").
    3.  W górnej części aplikacji (Topbar) znajdują się "Okruszki chleba" (Breadcrumbs) odzwierciedlające ścieżkę (np. Kolekcje > Święta > Sernik).
    4.  Topbar zawiera pasek wyszukiwania (Omnibox) dostępny z każdego miejsca.

#### US-015: Kontekstowe akcje (Page Header)
*   **Opis:** Jako użytkownik, chcę widzieć główne akcje dostępne dla danego widoku zawsze w tym samym, przewidywalnym miejscu, abym nie musiał ich szukać w treści strony.
*   **Kryteria akceptacji:**
    1.  Każdy widok posiada nagłówek (Page Header) oddzielony od treści.
    2.  Nagłówek zawiera tytuł strony po lewej stronie.
    3.  Nagłówek zawiera wszystkie przyciski operacyjne (Dodaj, Edytuj, Zapisz, Usuń) po prawej stronie.
    4.  W formularzach przycisk "Zapisz" jest zawsze widoczny w nagłówku (sticky), niezależnie od przewinięcia strony.

### Zmodyfikowane historyjki

#### Zmiana w US-013 (Importowanie nowego przepisu z tekstu)
*   **Notatka o zmianie:** Zmiana dotyczy interfejsu. Zamiast standardowego widoku, import ma odbywać się w "Trybie Focus".
*   **Nowe kryterium:** Widok importu jest pozbawiony zbędnych elementów nawigacyjnych (rozpraszaczy). Ekran podzielony jest na dwie części: pole edycji tekstu (lewa) i podgląd na żywo sformatowanego przepisu (prawa).

---

## 2. API

### Nowe endpointy

#### `GET /search/global`
*   **Cel:** Obsługa "Omniboxu" w Topbarze – wyszukiwanie globalne przeszukujące jednocześnie przepisy i kolekcje.
*   **Metoda:** `GET`
*   **Parametry:** `q` (string) - fraza wyszukiwania.
*   **Odpowiedź:** Obiekt zawierający tablice pasujących przepisów i kolekcji.

---

## 3. Widoki (UI)

### Nowe Komponenty Architektoniczne

#### 1. MainLayout (Holy Grail)
*   **Opis:** Główny kontener aplikacji dla zalogowanych użytkowników.
*   **Struktura:**
    *   **Sidebar (Left):** Nawigacja statyczna (`Dashboard`, `Recipes`, `Collections`, `Settings`).
    *   **Topbar (Top):** Breadcrumbs, SearchBar, UserAvatar.
    *   **Content Area (Center):** Miejsce na router-outlet, gdzie renderowane są poszczególne widoki.
    *   Zapewnia slot na `PageHeader` w górnej części Content Area.

#### 2. SharedPageHeader
*   **Opis:** Reużywalny komponent renderowany na szczycie każdego widoku w Content Area.
*   **Inputy:** `title` (string), `subtitle` (string, optional).
*   **Content Projection:** Slot na przyciski akcji (prawa strona).
*   **Zachowanie:** Może być `sticky` (przyklejony do dołu Topbara) podczas scrollowania.

### Zmodyfikowane Widoki

#### Widok Listy Przepisów (`/recipes`)
*   **Zmiana:** Usunięcie przycisków akcji z dołu/listy. Dodanie `PageHeader`.
*   **Header:** Tytuł "Twoje Przepisy", Przycisk "Dodaj Przepis" (Split Button: "Ręcznie" | "Import").
*   **Filtry:** Przeniesienie filtrów (Kategorie, Tagi) pod Header, w formie "Chips Row".
*   **Stan Pusty:** Nowy komponent `EmptyStateWithAction` (Ilustracja + Przycisk "Dodaj").

#### Widok Szczegółów Przepisu (`/recipes/:id`)
*   **Zmiana:** Restrukturyzacja układu na 3-kolumnowy (desktop) lub 1-kolumnowy (mobile) z nawigacją sticky wewnątrz treści.
*   **Header:** Tytuł przepisu. Akcje: Ikony (Ulubione, Edytuj, Usuń) zamiast tekstowych przycisków.
*   **Feedback:** Usunięcie przekierowuje na listę z Toastem (Snackbar) "Przepis usunięty" i opcją "Cofnij".

#### Widok Formularza (`/recipes/new`, `/recipes/:id/edit`)
*   **Zmiana:** "Save Bar" w nagłówku.
*   **Header:** Tytuł "Nowy przepis". Akcje: "Anuluj" (Ghost), "Zapisz" (Primary, Sticky).
*   **UX:** Walidacja formularza blokuje przycisk w Headerze (lub pokazuje tooltip z błędem).

#### Widok Importu (`/recipes/import`)
*   **Zmiana:** Tryb Focus.
*   **Layout:** Ukrycie Sidebara (opcjonalnie) lub maksymalne uproszczenie.
*   **Grid:** Podział 50/50. Lewo: Textarea. Prawo: Live Preview (renderowany `RecipeDetailComponent` w trybie podglądu).

