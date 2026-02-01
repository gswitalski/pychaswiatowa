# Architektura UI dla PychaŚwiatowa

## 1. Przegląd struktury UI

Architektura interfejsu użytkownika aplikacji PychaŚwiatowa zostanie zbudowana w oparciu o framework Angular i bibliotekę komponentów Angular Material, zgodnie z podejściem "desktop-first" zapewniającym pełną responsywność. Wdrożona zostanie architektura **"App Shell"** separująca nawigację od akcji kontekstowych. Aplikacja będzie składać się z dwóch głównych obszarów: publicznego (dla niezalogowanych użytkowników) oraz prywatnego (dla zalogowanych).

Centralnym elementem dla zalogowanego użytkownika jest **Layout typu "Holy Grail"**:
1.  **Globalny Sidebar (Lewa strona):** Zawiera wyłącznie linki nawigacyjne (Moja Pycha, Przepisy, Kolekcje, Zakupy, Ustawienia). Nie zawiera przycisków akcji. Sidebar jest widoczny wyłącznie w sekcjach: `/dashboard`, `/my-recipies` (alias: `/my-recipes`), `/recipes/**`, `/collections/**`, `/shopping/**`, `/settings/**`.
2.  **Globalny Topbar (Góra):** Zawiera stałą główną nawigację (zakładki) **Moja Pycha** (`/dashboard`) i **Odkrywaj przepisy** (`/explore`) z wyróżnieniem aktywnej pozycji, stałą ikonę/akcję globalnego wyszukiwania (Omnibox, np. jako overlay) oraz profil użytkownika. Breadcrumbs są wyświetlane jako element orientacyjny na głębszych trasach (np. wewnątrz kolekcji).
3.  **Page Header (Nagłówek Strony):** Znajduje się nad treścią każdego widoku. To tutaj umieszczone są tytuł strony oraz wszystkie przyciski akcji (Dodaj, Edytuj, Zapisz), zapewniając przewidywalność interfejsu.
    - **Uwaga (MVP – zmiana dot. Kolekcji):** pozycja „Kolekcje” w Sidebarze działa jako **drzewo nawigacyjne** (kolekcje → przepisy) z leniwym ładowaniem list przepisów per kolekcja. Kliknięcie w etykietę „Kolekcje” prowadzi do `/collections` (zarządzanie kolekcjami), a chevron służy do zwijania/rozwijania.

### Role i uprawnienia (RBAC – przygotowanie)

- **Założenie:** aplikacja w przyszłości będzie udostępniać wybrane funkcje tylko użytkownikom o określonej roli.
- **Źródło prawdy w UI:** rola aplikacyjna jest odczytywana z JWT (custom claim, np. `app_role`) po zalogowaniu i trzymana w stanie sesji (np. w `AuthService`).
- **Wdrożenie funkcji premium/admin:** będzie realizowane podczas implementacji konkretnych funkcjonalności (np. ukrycie/disabled/guard) – na tym etapie dokument opisuje tylko fundament.

## 2. Lista widoków

### Widoki publiczne

**1. Landing Page**
- **Ścieżka:** `/`
- **Główny cel:** Powitanie użytkownika i przedstawienie aplikacji oraz natychmiastowe udostępnienie wartościowego contentu (publiczne przepisy) z możliwością wyszukiwania.
- **Kluczowe informacje do wyświetlenia (gość):** Nazwa i logo aplikacji, krótkie hasło, pole wyszukiwania publicznych przepisów, sekcje z publicznymi przepisami (np. Najnowsze, Popularne, Sezonowe), przyciski "Zaloguj się" i "Zarejestruj się".
- **Kluczowe informacje do wyświetlenia (zalogowany):** Te same sekcje contentowe + nawigacja zalogowanego użytkownika w Topbarze (profil + link "Moja Pycha" prowadzący do `/dashboard`). Brak przycisków "Zaloguj się" i "Zarejestruj się". **Sidebar na widokach publicznych nie jest wyświetlany.**
- **Kluczowe komponenty widoku:** Główny nagłówek, sekcja "hero", publiczny pasek wyszukiwania (**`pych-public-recipes-search`**), sekcje z `RecipeCardComponent`, CTA do logowania/rejestracji.
- **Względy UX, dostępności i bezpieczeństwa:** Prosty i czytelny układ, wyraźne wezwania do akcji. Treści wyłącznie dla przepisów publicznych. W trybie zalogowanego zachować spójność z App Shell i nie powielać CTA do logowania.
    - **Zachowanie wyszukiwania (MVP):**
        - wyszukiwanie uruchamia się od **3 znaków** (po trim) + debounce (ok. 300–400 ms),
        - zapytania wielowyrazowe działają jako **AND**,
        - tagi dopasowują się jako **pełna nazwa** lub **prefix**,
        - domyślnie wyniki są sortowane po **najlepszym dopasowaniu** (relevance: nazwa > składniki > tagi; wagi 3/2/1),
        - dla pustej frazy (po trim) landing nie wykonuje wyszukiwania — zachowuje się jak feed/sekcje kuratorowane.

**2. Publiczny katalog przepisów (Explore)**
- **Ścieżka:** `/explore`
- **Główny cel:** Przeglądanie i wyszukiwanie publicznych przepisów (MVP: tylko tekst).
- **Kluczowe informacje do wyświetlenia:** Lista kart przepisów (zdjęcie, nazwa, kategoria), pole wyszukiwania, przycisk "Więcej" do doładowywania kolejnych wyników.
- **Kluczowe komponenty widoku:** `mat-form-field` (search), `RecipeCardComponent`, `mat-button` ("Więcej"), wskaźniki ładowania (Skeletons).
- **Względy UX, dostępności i bezpieczeństwa:** Wyniki zawierają wyłącznie przepisy o widoczności `PUBLIC`. Obsługa stanu pustego ("Brak wyników"). W trybie zalogowanego: oznaczyć na kartach przepisy użytkownika jako "Twój przepis". Dla przepisu, którego autorem jest zalogowany użytkownik (`is_owner=true`), karta pokazuje dodatkową ikonkę widoczności (na podstawie pola `visibility`) z tooltipem: `Prywatny` / `Współdzielony` / `Publiczny`. Dla cudzych przepisów ikonka widoczności nie jest wyświetlana.
    - (Przyszłościowo / API-ready) Aplikacja może zostać rozszerzona o filtrowanie publicznych przepisów po metadanych (np. "Termorobot"), jednak w MVP pozostaje **wyłącznie wyszukiwanie tekstowe**.
    - **Zachowanie wyszukiwania (MVP):**
        - wyszukiwanie uruchamia się od **3 znaków** (po trim) + debounce (ok. 300–400 ms),
        - zapytania wielowyrazowe działają jako **AND**,
        - tagi dopasowują się jako **pełna nazwa** lub **prefix**,
        - przy niepustej frazie domyślne sortowanie jest po **najlepszym dopasowaniu** (relevance: nazwa > składniki > tagi > wskazówki; wagi 3/2/1/0.5),
        - dla pustej frazy (po trim) widok działa jak feed (np. `created_at.desc`) i nie pokazuje stanu „Brak wyników” (zamiast tego standardowy feed).
    - **Transparentność dopasowania:** Na każdej karcie wyniku (lub w jej stopce) pokazujemy krótki tekst: **„Dopasowanie: nazwa / składniki / tagi / wskazówki”** (jedna etykieta — wskazujemy najlepsze źródło dopasowania), aby zwiększyć zaufanie do rankingu.
    - **Load more (zamiast paginacji):** Domyślnie ładowane jest **12 przepisów**. Pod listą widoczny jest przycisk **"Więcej"**, który:
        - doładowuje kolejne **12** i **dopina** je pod już widocznymi,
        - pokazuje stan ładowania (np. label "Ładowanie…" + `disabled`),
        - znika, gdy nie ma już kolejnych wyników (`hasMore=false`).
    - **Reset kontekstu listy:** Zmiana frazy wyszukiwania (i ewentualnych filtrów w przyszłości) resetuje listę do pierwszych 12 wyników oraz ponownie pokazuje przycisk "Więcej" (jeśli są kolejne).

**3. Szczegóły przepisu (uniwersalny widok)**
- **Ścieżka (kanoniczna):** prywatnie `/recipes/:id-:slug` oraz publicznie `/explore/recipes/:id-:slug`
- **Ścieżka (kompatybilność wsteczna):** `/recipes/:id` oraz `/explore/recipes/:id` (normalizowane do kanonicznego URL)
- **Główny cel:** Pełny podgląd przepisu w czytelnym układzie - zarówno dla gości jak i zalogowanych użytkowników.
- **Dostępność:** Widok dostępny dla wszystkich użytkowników. Goście mogą przeglądać tylko przepisy publiczne.
- **Zachowanie w zależności od kontekstu:**
    - **Gość (niezalogowany):**
        - Brak nagłówka strony z akcjami właściciela
        - CTA do logowania/rejestracji na dole strony
        - Przy próbie dostępu do niepublicznego przepisu: komunikat o braku dostępu z zachętą do logowania
    - **Zalogowany (cudzy przepis):**
        - Nagłówek z przyciskami: "Dodaj do kolekcji" oraz "Dodaj do planu"
        - Przycisk "Dodaj do planu" ma stany:
            - domyślnie: "Dodaj do planu" (ikona listy + plus),
            - w trakcie dodawania: spinner zamiast etykiety,
            - po sukcesie: ikona „ptaszka” + etykieta "Zobacz listę",
            - jeśli przepis już jest w planie: od razu "Zobacz listę".
        - Brak przycisków edycji i usuwania
        - Przy próbie dostępu do niepublicznego przepisu innego autora: komunikat o braku dostępu
    - **Zalogowany (własny przepis):**
        - Pełna funkcjonalność: przyciski "Dodaj do kolekcji", "Dodaj do planu", "Edytuj", "Usuń"
- **Kluczowe informacje do wyświetlenia:** Nazwa, **liczba porcji (jeśli ustawiona) pod tytułem**, metadane w formie chipów/badge (jeśli ustawione): **typ diety (Mięso/Wege/Vegan)**, **kuchnia (lista kontrolowana)**, **stopień trudności (Łatwe/Średnie/Trudne)**, **badge/chip "Termorobot" (jeśli ustawione)**, **badge/chip "Grill" z ikonką grilla (jeśli ustawione)**, opis, **czasy (jeśli ustawione) pod opisem z ikonkami**: czas przygotowania (`schedule`) i czas całkowity (`timer`), zdjęcie, listy składników i kroków (kroki numerowane w sposób ciągły), **wskazówki (osobna sekcja pod krokami przygotowania; ukryta, gdy pusta)**, kategoria, tagi, autor i data utworzenia (dla publicznych przepisów innych autorów).
- **Kluczowe komponenty widoku:** `PageHeaderComponent`, `RecipeHeaderComponent`, `RecipeImageComponent`, `RecipeContentListComponent`, `mat-chip-list`.
- **Względy UX, dostępności i bezpieczeństwa:** Układ 2-kolumnowy na desktopie (składniki / kroki). Dynamiczne dostosowanie akcji w zależności od kontekstu użytkownika. Normalizacja URL w warstwie frontendu:
    - `/explore/recipes/:id` -> `/explore/recipes/:id-:slug`
    - `/recipes/:id` -> `/recipes/:id-:slug`
    - jeśli slug w URL jest niepoprawny (np. po zmianie nazwy przepisu), URL jest normalizowany do poprawnego kanonicznego adresu (np. `replaceUrl=true`).

**3a. Normalizacja URL przepisu (techniczny handler)**
- **Ścieżka:** `/explore/recipes/:id` oraz `/recipes/:id` (opcjonalnie także warianty z `:id-:slug` dla weryfikacji poprawności sluga)
- **Główny cel:** Zapewnienie kompatybilności wstecznej oraz zawsze-kanonicznych, udostępnialnych linków do przepisów.
- **Zachowanie (happy path):**
    - handler pobiera `id` z routingu,
    - pobiera dane przepisu (w szczególności `name`) i wylicza slug zgodnie z regułami (lowercase, zamiana polskich znaków, separatory `-`, limit długości, fallback),
    - wykonuje nawigację do kanonicznej ścieżki `/.../recipes/:id-:slug` z `replaceUrl=true`.
- **Zachowanie (error path):**
    - jeśli przepis nie istnieje lub użytkownik nie ma dostępu, handler pokazuje ten sam komunikat co standardowy widok szczegółów (np. 404/403 zgodnie z kontekstem).

**4. Logowanie**
- **Ścieżka:** `/login`
- **Główny cel:** Uwierzytelnienie istniejącego użytkownika.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na e-mail i hasło, komunikat o błędach, link do strony rejestracji.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasna komunikacja błędów walidacji. Pola formularza poprawnie oetykietowane.
    - Jeśli użytkownik próbuje się zalogować, a konto nie ma potwierdzonego e-maila, widok pokazuje czytelny komunikat: „Potwierdź adres e-mail, aby się zalogować” oraz akcję „Wyślij link ponownie” (cooldown 60s).

**5. Rejestracja**
- **Ścieżka:** `/register`
- **Główny cel:** Umożliwienie nowym użytkownikom założenia konta.
- **Kluczowe informacje do wyświetlenia:** Formularz z polami na: nazwa użytkownika, e-mail, hasło (wraz z potwierdzeniem), link do strony logowania.
- **Kluczowe komponenty widoku:** `mat-card`, `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Walidacja hasła po stronie klienta (np. minimalna długość). Po poprawnej rejestracji użytkownik **nie jest automatycznie logowany** – przechodzi do widoku informującego o wysłaniu linku weryfikacyjnego.

**5a. Rejestracja – wysłano link weryfikacyjny**
- **Ścieżka:** `/register/verify-sent`
- **Główny cel:** Potwierdzenie, że link aktywacyjny został wysłany, oraz umożliwienie ponownej wysyłki.
- **Kluczowe informacje do wyświetlenia:** Komunikat „Wysłaliśmy link aktywacyjny na adres: {email}”, instrukcja „Sprawdź skrzynkę i spam”, akcje: „Wyślij ponownie” (cooldown 60s), „Zmień e-mail” (powrót do `/register` z uzupełnioną wartością).
- **Kluczowe komponenty widoku:** `mat-card`, `mat-button`, `mat-progress-spinner` (w trakcie resend), komponent odliczania/cooldown.
- **Względy UX, dostępności i bezpieczeństwa:** Nie ujawniać, czy e-mail istnieje w systemie w scenariuszach mogących prowadzić do enumeracji kont. Wyraźnie komunikować cooldown.

**5b. Auth callback (techniczny) – obsługa kliknięcia w link z e-maila**
- **Ścieżka:** `/auth/callback`
- **Główny cel:** Obsłużenie przekierowania z Supabase po kliknięciu linku weryfikacyjnego i sfinalizowanie weryfikacji po stronie klienta.
- **Zachowanie (happy path):** Jeśli przekierowanie zawiera kod/autoryzację, aplikacja finalizuje proces weryfikacji (np. wymiana kodu na sesję) i przekierowuje do widoku „E-mail potwierdzony”.
- **Zachowanie (error path):** Jeśli link jest nieważny/wygasł, aplikacja przekierowuje do widoku „Link nieważny lub wygasł” z akcją wysłania nowego linku.
- **Względy UX:** To jest widok „roboczy” (krótki loader + komunikat „Finalizujemy…”), bez Sidebara.

**5c. E-mail potwierdzony**
- **Ścieżka:** `/email-confirmed`
- **Główny cel:** Jasne potwierdzenie zakończenia weryfikacji i przekierowanie do logowania.
- **Kluczowe informacje do wyświetlenia:** Komunikat „Adres e-mail potwierdzony. Możesz się zalogować.” + przycisk „Przejdź do logowania”.
- **Względy UX:** Bez auto-logowania (zgodnie z założeniem). Bez Sidebara.

**5d. Link nieważny lub wygasł**
- **Ścieżka:** `/email-confirmation-invalid`
- **Główny cel:** Obsłużenie przypadków błędnego/wygasłego linku.
- **Kluczowe informacje do wyświetlenia:** Komunikat „Link nieważny lub wygasł” + akcja „Wyślij nowy link” (cooldown 60s) + link do logowania/rejestracji.

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
- **Header:** Tytuł "Twoje Przepisy", przycisk "Dodaj przepis" (otwiera kreator: „Pusty formularz” | „Z tekstu/zdjęcia (AI)”) oraz akcja pomocnicza "Import" prowadząca do `/recipes/import`.
- **Kluczowe informacje do wyświetlenia:** Siatka przepisów (zdjęcie, nazwa), pasek filtrów (Chips) pod nagłówkiem (np. "Moje" / "W moich kolekcjach", **"Termorobot"**), przycisk "Więcej" do doładowywania kolejnych wyników. Dla przepisów nie mojego autorstwa widoczny chip/etykieta "W moich kolekcjach". Dla przepisów oznaczonych "Termorobot" widoczny dodatkowy badge/chip "Termorobot" na karcie. Dla przepisów mojego autorstwa (`is_owner=true`) na karcie widoczna jest również ikonka widoczności odpowiadająca polu `visibility` z tooltipem (`Prywatny` / `Współdzielony` / `Publiczny`).
- **Kluczowe informacje do wyświetlenia:** Siatka przepisów (zdjęcie, nazwa), pasek filtrów (Chips) pod nagłówkiem (np. "Moje" / "W moich kolekcjach", **"Termorobot"**, **"Grill"**), przycisk "Więcej" do doładowywania kolejnych wyników. Dla przepisów nie mojego autorstwa widoczny chip/etykieta "W moich kolekcjach". Dla przepisów oznaczonych "Termorobot" widoczny dodatkowy badge/chip "Termorobot" na karcie. Dla przepisów oznaczonych "Grill" widoczna ikonka grilla na karcie (z tooltipem „Grill”). Dla przepisów mojego autorstwa (`is_owner=true`) na karcie widoczna jest również ikonka widoczności odpowiadająca polu `visibility` z tooltipem (`Prywatny` / `Współdzielony` / `Publiczny`).
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-card`, `mat-chip-list`, `mat-button` ("Więcej"), komponent "stanu pustego" z akcją.
- **Względy UX, dostępności i bezpieczeństwa:** Dynamiczne odświeżanie listy. Wskaźniki ładowania (Skeletons). Obsługa stanu pustego z wezwaniem do akcji "Utwórz pierwszy przepis". Przepisy innych autorów pojawiają się na tej liście wyłącznie, gdy są publiczne i znajdują się w kolekcjach użytkownika.
    - **Load more (zamiast paginacji):** Domyślnie ładowane jest **12 przepisów**. Pod listą widoczny jest przycisk **"Więcej"**, który doładowuje kolejne **12** i dopina je pod już widocznymi. Przycisk pokazuje stan ładowania (disabled + "Ładowanie…") i znika, gdy nie ma więcej wyników.
    - **Reset kontekstu listy:** Zmiana filtrów/sortowania/wyszukiwania resetuje listę do pierwszych 12 wyników i ukrywa/pokazuje przycisk zależnie od `hasMore`.

**8. Szczegóły Przepisu**
- **Ścieżka:** `/recipes/:id`
- **Główny cel:** Wyświetlenie pełnych informacji o przepisie i umożliwienie wykonania na nim operacji.
- **Uwaga:** Ten widok jest zunifikowany z publicznym widokiem szczegółów przepisu (patrz punkt 3 w widokach publicznych). Jeden komponent obsługuje wszystkie scenariusze:
    - Gość przeglądający publiczny przepis
    - Zalogowany użytkownik przeglądający cudzy publiczny przepis
    - Zalogowany użytkownik przeglądający własny przepis (pełne akcje)
- **Header:** Tytuł przepisu. Akcje zależne od kontekstu (patrz punkt 3).
- **Kluczowe informacje do wyświetlenia:** Nazwa, **liczba porcji (jeśli ustawiona) pod tytułem**, metadane w formie chipów/badge (jeśli ustawione): **typ diety (Mięso/Wege/Vegan)**, **kuchnia (lista kontrolowana)**, **stopień trudności (Łatwe/Średnie/Trudne)**, **badge/chip "Termorobot" (jeśli ustawione)**, **badge/chip "Grill" z ikonką grilla (jeśli ustawione)**, opis, **czasy (jeśli ustawione) pod opisem z ikonkami**: czas przygotowania (`schedule`) i czas całkowity (`timer`), zdjęcie, listy składników i kroków (kroki numerowane w sposób ciągły), **wskazówki (osobna sekcja pod krokami przygotowania; ukryta, gdy pusta)**, kategoria, tagi.
- **Kluczowe komponenty widoku:** `PageHeaderComponent`, `RecipeHeaderComponent`, `RecipeImageComponent`, `RecipeContentListComponent`, `mat-chip-list`.
- **Względy UX, dostępności i bezpieczeństwa:** Układ 2-kolumnowy (składniki / kroki) na desktopie. Feedback "Toast" po usunięciu. Numeracja kroków nie resetuje się po nagłówkach sekcji. Dla zalogowanego nie-autora przyciski "Edytuj" i "Usuń" nie są wyświetlane (również gdy wejście nastąpiło z listy `/my-recipies`). Dla zalogowanego w nagłówku dostępna jest również akcja „Dodaj do planu” / „Zobacz listę” otwierająca drawer „Mój plan”.

**8a. Dodaj przepis (Kreator – wybór trybu)**
- **Ścieżka:** `/recipes/new/start`
- **Główny cel:** Umożliwienie użytkownikowi szybkiego wyboru sposobu dodania przepisu (pusty formularz vs. asysta AI).
- **Header:** Tytuł "Dodaj przepis". Akcje: "Anuluj".
- **Kluczowe informacje do wyświetlenia:** Dwie czytelne opcje (np. karty/przyciski):
    - „Pusty formularz” (nawigacja do `/recipes/new`)
    - „Z tekstu/zdjęcia (AI)” (nawigacja do `/recipes/new/assist`)
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-card` / `mat-button`, krótkie opisy opcji.
- **Względy UX, dostępności i bezpieczeństwa:** Opcje mają jasne opisy („wstępnie uzupełnimy pola”, „zawsze możesz poprawić”), duże obszary klikalne i poprawną nawigację klawiaturą.

**8b. Dodaj przepis (Kreator – AI z tekstu/zdjęcia)**
- **Ścieżka:** `/recipes/new/assist`
- **Główny cel:** Pozwolić użytkownikowi wkleić tekst lub obraz przepisu i przejść do wstępnie wypełnionego formularza.
- **Header:** Tytuł "Dodaj przepis (AI)". Akcje: "Wróć", "Dalej".
- **Kluczowe informacje do wyświetlenia:**
    - Przełącznik źródła: „Tekst” / „Obraz” (tryb **albo-albo**).
    - Dla „Tekst”: `textarea` do wklejenia treści.
    - Dla „Obraz”: strefa wklejenia obrazu ze schowka (Ctrl+V) z podglądem i akcją „Usuń obraz”.
    - Komunikaty błędów w miejscu + Snackbar.
- **Zachowanie:**
    - Jeśli wejście jest puste (brak tekstu i brak obrazu), kliknięcie „Dalej” przenosi do pustego formularza `/recipes/new`.
    - Jeśli wejście jest niepuste, „Dalej” uruchamia przetwarzanie AI (loader, `disabled`), a po sukcesie przenosi do `/recipes/new` z wstępnie wypełnionymi polami (draft w stanie aplikacji; w tym wskazówki, jeśli zostały wywnioskowane).
    - Jeśli AI zwróci błąd „to nie jest pojedynczy przepis”, widok zostaje na `/recipes/new/assist` i pokazuje czytelny komunikat + krótką podpowiedź.
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-button`, `mat-form-field` (textarea), dedykowany komponent do wklejania obrazu (clipboard paste) + podgląd.
- **Względy UX, dostępności i bezpieczeństwa:** Jasne stany ładowania, brak auto-nawigacji przy błędach, komunikaty bez ujawniania danych technicznych. Wszelkie klucze i integracja z LLM wyłącznie po stronie backendu (Edge Function).

**9. Formularz Przepisu (Dodaj/Edytuj)**
- **Ścieżka:** `/recipes/new`, `/recipes/:id/edit`
- **Główny cel:** Tworzenie i modyfikacja przepisu.
- **Header:** Tytuł "Nowy przepis" / "Edycja". Akcje: "Anuluj", "Zapisz" (Sticky - zawsze widoczny).
- **Kluczowe informacje do wyświetlenia:** Formularz podzielony na sekcje: Dane podstawowe (nazwa, opis, **liczba porcji (opcjonalnie)**, **czas przygotowania (opcjonalnie)**, **czas całkowity (opcjonalnie)**, **Termorobot (toggle/checkbox, opcjonalnie, domyślnie wyłączone)**, **Grill (toggle/checkbox, opcjonalnie, domyślnie wyłączone)**, **typ diety (opcjonalnie: Mięso/Wege/Vegan)**, **kuchnia (opcjonalnie; lista kontrolowana)**, **stopień trudności (opcjonalnie: Łatwe/Średnie/Trudne)**, kategoria, widoczność), Składniki, Kroki, **Wskazówki (opcjonalnie)**, Zdjęcie.
- **Kluczowe komponenty widoku:** `SharedPageHeader`, `mat-form-field`, `mat-select`, `mat-radio-group` (do wyboru widoczności: Prywatny/Współdzielony/Publiczny), `ImageUploadComponent` (strefa paste/drop + fallback file picker), `EditableListComponent` (składniki/kroki/wskazówki).
- **Względy UX, dostępności i bezpieczeństwa:**
    - Przycisk Zapisz w nagłówku eliminuje konieczność scrollowania. Walidacja blokuje zapis lub wyświetla błędy. Domyślna widoczność to "Prywatny".
    - **Składniki znormalizowane (backend-only, MVP):** po zapisie przepisu backend asynchronicznie buduje listę składników znormalizowanych do przyszłej listy zakupów (przez worker/queue). UI **nie wyświetla** tej listy, **nie pokazuje** statusów (`PENDING/READY/FAILED`) oraz **nie wyświetla** błędów/komunikatów związanych z normalizacją (MVP).
    - Pole **"Liczba porcji"** jest opcjonalne, przyjmuje tylko liczbę całkowitą w zakresie `1-99`, może zostać wyczyszczone (brak wartości). W szczegółach przepisu wartość jest wyświetlana pod tytułem (np. `4 porcje`, `6 porcji`).
    - Pola **"Czas przygotowania (min)"** oraz **"Czas całkowity (min)"** są opcjonalne, przyjmują liczbę całkowitą w zakresie `0-999` i mogą zostać wyczyszczone (brak wartości).
        - Jeśli oba czasy są ustawione, walidacja wymaga aby **czas całkowity ≥ czas przygotowania** (w przeciwnym razie zapis jest blokowany i pokazany jest błąd).
        - W szczegółach przepisu czasy są wyświetlane **pod opisem** jako metadane z ikonkami Material: `schedule` (przygotowanie) oraz `timer` (całkowity).
    - Flaga **"Termorobot"** jest opcjonalna, domyślnie wyłączona. Kontrolka jest jednoznacznie opisana (np. "Termorobot (Thermomix/Lidlomix)"), a stan jest zapisywany razem z przepisem i odtwarzany przy ponownym wejściu w edycję.
    - Flaga **"Grill"** jest opcjonalna, domyślnie wyłączona. Kontrolka jest jednoznacznie opisana (np. "Grill"), a stan jest zapisywany razem z przepisem i odtwarzany przy ponownym wejściu w edycję.
    - Pola klasyfikacyjne są **opcjonalne** i wybierane z **list kontrolowanych**:
        - **Typ diety:** `Mięso` / `Wege` / `Vegan` (np. `mat-button-toggle-group` lub `mat-select`).
        - **Kuchnia:** `Polska` / `Azjatycka` / `Meksykańska` / `Bliskowschodnia` (rekomendowane `mat-select`).
        - **Stopień trudności:** `Łatwe` / `Średnie` / `Trudne` (np. `mat-button-toggle-group` lub `mat-select`).
      Użytkownik może wyczyścić wybór (brak wartości), a brak wartości nie jest później pokazywany w szczegółach (brak placeholderów).
    - Sekcja **Zdjęcie** działa jako **strefa docelowa**: użytkownik może wkleić obraz ze schowka (Ctrl+V) lub przeciągnąć i upuścić plik obrazu. Opcja "Wybierz plik" pozostaje jako fallback.
    - Drag&drop dotyczy **pliku obrazu (File) z dysku** — nie zakładamy obsługi upuszczania samych URL-i / linków do obrazków ze stron WWW w MVP.
    - Strefa zdjęcia ma czytelne stany: `idle` (instrukcja), `dragover` (podświetlenie), `uploading` (progres/spinner), `success` (podgląd), `error` (komunikat).
    - Walidacja po stronie UI: akceptowane typy `image/png`, `image/jpeg`, `image/webp`, max rozmiar `10 MB`. Błędy są pokazywane przy polu zdjęcia + w Snackbarze.
    - Auto-upload startuje od razu po paste/drop, a po sukcesie wyświetlany jest Snackbar z akcją **"Cofnij"** (działa do czasu zapisu całego przepisu). Dostępna jest też akcja **"Usuń zdjęcie"**.
    - **Generowanie zdjęcia AI (Premium):**
        - Przy polu zdjęcia (np. w prawym górnym rogu komponentu `ImageUploadComponent` lub jako akcja przy etykiecie „Zdjęcie”) znajduje się przycisk z ikoną **AI**.
        - Przycisk jest widoczny/aktywny wyłącznie dla użytkowników z rolą `premium` (lub `admin`). Dla roli `user` przycisk nie jest dostępny (alternatywnie: disabled z tooltipem „Funkcja Premium”).
        - Kliknięcie uruchamia generowanie na podstawie **aktualnego stanu formularza** (również niezapisanych zmian) i otwiera modal podglądu.
        - Przycisk działa w **dwóch trybach (automatyczny wybór)**:
            - **Tryb 1 (bez zdjęcia):** jeśli w formularzu nie ma dostępnego zdjęcia (ani zapisanego, ani wgranego/wklejonego w trakcie edycji), generowanie odbywa się wyłącznie na podstawie treści przepisu (jak dotychczas).
            - **Tryb 2 (z referencją zdjęcia):** jeśli w formularzu jest dostępne zdjęcie (zapisane w przepisie lub wgrane/wklejone w trakcie edycji), generowanie używa go jako **referencji** wyglądu potrawy, ale tworzy **całkowicie nową** fotografię (inna kompozycja/ujęcie/aranżacja; bez kopiowania zdjęcia).
        - UI sygnalizuje tryb przed uruchomieniem (np. tooltip na przycisku AI):
            - „Generuj z przepisu” (Tryb 1)
            - „Generuj z referencją zdjęcia” (Tryb 2)
        - W trakcie generowania widoczny jest loader, a akcje w modalu są zablokowane.
        - Po sukcesie użytkownik widzi podgląd oraz akcje: **„Zastosuj”** (ustawia jako główne zdjęcie) i **„Odrzuć”** (zamyka modal bez zmian).
        - Po „Zastosuj” zdjęcie zostaje ustawione w formularzu i traktowane jak standardowa zmiana zdjęcia (Snackbar z akcją **„Cofnij”** do czasu zapisu).
        - Technicznie (MVP): generowanie korzysta z modelu **`gpt-image-1.5`** i zwraca podgląd jako **`image/webp` 1024×1024** z ustawieniami `background=auto`, `quality=auto`, `n=1`.

**9a. Modal: Podgląd wygenerowanego zdjęcia (AI)**
- **Ścieżka:** (modal/dialog) w kontekście `/recipes/:id/edit`
- **Główny cel:** Pokazać rezultat generowania zdjęcia AI i wymusić świadomą decyzję użytkownika przed zastąpieniem zdjęcia.
- **Kluczowe informacje do wyświetlenia:** Podgląd wygenerowanego zdjęcia, krótka notatka o trybie/stylu (np. „Generowanie z przepisu” lub „Generowanie z referencją zdjęcia”; styl zależny od trybu), komunikaty błędów.
- **Akcje:** „Zastosuj”, „Odrzuć”, (opcjonalnie) „Wygeneruj ponownie”.
- **Względy UX:** Brak automatycznego nadpisania istniejącego zdjęcia; czytelne stany: `loading` / `success` / `error`. Akcja „Wygeneruj ponownie” oznacza ponowne wywołanie generowania (kolejna próba), nadal w trybie `n=1`.

**9b. (Dev-only, poza zakresem MVP) Podgląd składników znormalizowanych**
- **Ścieżka:** `/dev/recipes/:id/normalized-ingredients`
- **Główny cel:** (Opcjonalnie) umożliwić deweloperom i testerom weryfikację jakości normalizacji składników bez wpływu na UX użytkownika. **W ramach tego zakresu nie implementujemy żadnych nowych widoków we froncie**.
- **Kluczowe informacje do wyświetlenia:**
    - status normalizacji (`PENDING` / `READY` / `FAILED`) + `updated_at`,
    - tabela z kolumnami: `ilosc` (może być puste), `jednostka` (może być puste), `nazwa`,
    - (opcjonalnie) lista „niezmapowane / tylko nazwa” (te same rekordy, ale wyróżnione wizualnie).
- **Akcje:** „Odśwież normalizację” (wywołuje endpoint backendu do ponownego przeliczenia), „Wróć do edycji”.
- **Względy bezpieczeństwa:** Widok chroniony (tylko środowisko dev/test) i dostępny wyłącznie dla właściciela przepisu (zgodnie z API/RLS).

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
    - **Wejście do widoku:** kliknięcie w etykietę „Kolekcje” w Sidebarze prowadzi do tego widoku (chevron nie powinien nawigować).

**12. Szczegóły Kolekcji**
- **Ścieżka:** `/collections/:id`
- **Główny cel:** Wyświetlanie przepisów przypisanych do konkretnej kolekcji.
- **Kluczowe informacje do wyświetlenia:** Nazwa i opis kolekcji, lista zawartych w niej przepisów.
- **Kluczowe komponenty widoku:** Lista przepisów (komponent współdzielony z Listą Przepisów), przycisk "Usuń z kolekcji" przy każdym przepisie.
- **Względy UX, dostępności i bezpieczeństwa:**
    - Spójna prezentacja przepisów z główną listą.
    - **Brak paginacji w UI:** lista przepisów kolekcji ładuje się i wyświetla od razu w całości (bez przycisku "Więcej" i bez paginatora).
    - **Stan ładowania:** podczas pobierania danych widoczny jest czytelny loader/skeleton (np. dla siatki kart przepisów).
    - **Stan pusty:** jeśli kolekcja nie ma przepisów, widoczny jest komunikat + akcja powrotu do listy kolekcji (`/collections`).
    - **Błędy dostępu:** dla `404`/`403` pokazujemy komunikat i akcję powrotu do `/collections`.
    - **Limit techniczny API (jeśli dotyczy):** jeśli backend ogranicza maksymalną liczbę zwracanych elementów, UI pokazuje czytelne ostrzeżenie o możliwie niepełnym wyniku.

**13. Ustawienia Konta**
- **Ścieżka:** `/settings`
- **Główny cel:** Umożliwienie użytkownikowi zarządzania swoim profilem.
- **Kluczowe informacje do wyświetlenia:** Formularz zmiany nazwy użytkownika, formularz zmiany hasła.
- **Kluczowe komponenty widoku:** `mat-form-field`, `mat-input`, `mat-button`.
- **Względy UX, dostępności i bezpieczeństwa:** Jasne zasady walidacji haseł.

**14. Brak dostępu (403)**
- **Ścieżka:** `/forbidden` (lub inna ustalona, publicznie dostępna ścieżka techniczna)
- **Główny cel:** Prezentacja czytelnego komunikatu, gdy użytkownik jest zalogowany, ale nie ma uprawnień do danej funkcji (przyszłościowo: role premium/admin).
- **Kluczowe informacje do wyświetlenia:** Komunikat „Brak dostępu”, krótkie wyjaśnienie, akcje: „Wróć” / „Przejdź do Moja Pycha”.
- **Względy UX, dostępności i bezpieczeństwa:** Widok nie ujawnia szczegółów zasobów ani reguł uprawnień. Może być używany przez guardy/obsługę błędów `403`.

**15. Drawer: „Mój plan” (panel wysuwany)**
- **Ścieżka:** (globalny drawer; brak osobnej ścieżki routingu)
- **Główny cel:** Umożliwić szybki podgląd listy przepisów w „Moim planie” oraz zarządzanie listą bez opuszczania aktualnego widoku.
- **Sposoby otwarcia:**
    - kliknięcie „Zobacz listę” na widoku szczegółów przepisu,
    - kliknięcie pływającego przycisku „Mój plan” (gdy plan ma ≥ 1 element).
- **Zachowanie:**
    - Drawer wysuwa się z prawej strony.
    - Po otwarciu reszta strony jest lekko przyciemniona (overlay).
    - Kliknięcie w overlay zamyka drawer.
    - Nagłówek drawer’a zawiera: ikonę kosza (wyczyść plan) oraz ikonę „X” (zamknij).
    - Lista jest posortowana: ostatnio dodane na górze.
    - Każdy element listy zawiera: miniaturę/obrazek, nazwę oraz ikonę kosza do usunięcia pozycji.
    - Kliknięcie w element listy (poza ikoną kosza) przenosi do szczegółów przepisu.
    - Stan pusty: czytelny komunikat „Twój plan jest pusty” + brak pływającego przycisku.
- **Względy UX:** Panel i overlay muszą być w pełni dostępne z klawiatury (Esc zamyka, focus trap wewnątrz drawer’a, aria-labels na ikonach).

**16. Zakupy (lista zakupów)**
- **Ścieżka:** `/shopping`
- **Główny cel:** Umożliwić użytkownikowi przeglądanie i zarządzanie listą zakupów, która składa się z:
    - pozycji pochodzących ze składników znormalizowanych przepisów w „Moim planie” (backend zwraca surowe wiersze; **grupowanie i sumowanie wykonywane jest na frontendzie**),
    - ręcznych pozycji tekstowych dodanych przez użytkownika.
- **Widoczność:** Widok prywatny, dostępny po zalogowaniu (App Shell z Sidebarem).
- **Header:** Tytuł „Zakupy”.
    - **Akcje w Page Header (MVP – rozszerzenie):**
        - akcja **„Wyczyść listę”** (np. ikona kosza + etykieta, lub sama ikona z tooltipem) — otwiera modal potwierdzenia,
        - (opcjonalnie przyszłościowo) akcje widoków/filtrów; w MVP pozostajemy przy domyślnym widoku zgrupowanym.
- **Kluczowe elementy widoku:**
    - sekcja „Dodaj pozycję” z:
        - polem tekstowym (placeholder np. „Dodaj coś…”, przykłady: „papier toaletowy”, „kawa”),
        - przyciskiem „Dodaj”,
    - lista pozycji zakupów z kontrolką „posiadane” (checkbox) przy każdej pozycji,
    - dla pozycji z przepisów: prezentacja jako `nazwa` + (opcjonalnie) `ilość jednostka` (np. `cukier, 250 g`; `cukier`),
    - dla pozycji ręcznych: prezentacja jako tekst użytkownika,
    - akcja usunięcia (ikonka kosza) dla:
        - pozycji ręcznych (jak dotychczas),
        - pozycji „z przepisów” (MVP – rozszerzenie; usuwa całą grupę odpowiadającą kluczowi grupowania).
- **Reguły grupowania (MVP, frontend):**
    - widok domyślnie prezentuje pozycje **zgrupowane** (nie robimy przełącznika widoku na tym etapie),
    - grupujemy wyłącznie pozycje „z przepisów”, które mają identyczne: (`nazwa`, `jednostka`, `is_owned`),
    - dla pozycji zgrupowanych:
        - jeśli `jednostka != null` i `ilosc != null`, ilości są sumowane,
        - jeśli `jednostka = null` lub `ilosc = null`, pokazujemy „tylko nazwę” (bez sumowania ilości),
    - jeśli identyczne składniki mają różne `is_owned` (scenariusz „częściowo odhaczone”, np. użytkownik odhaczył pozycję, a potem dodał nowy przepis z tym samym składnikiem), **nie grupujemy ich razem** – widoczne są jako osobne pozycje.
- **Reguły sortowania (MVP):**
    - pozycje nieoznaczone jako „posiadane” są wyświetlane na górze,
    - pozycje oznaczone jako „posiadane” są przesortowane na dół i wizualnie zde-emfazyzowane (np. wyszarzone),
    - sortowanie wewnątrz grup może być stabilne (np. alfabetyczne po `nazwa` / tekst).
- **Względy UX, dostępności i bezpieczeństwa:**
    - szybkie odhaczanie (checkbox + duży obszar klikalny wiersza),
    - w pełni dostępne z klawiatury (tab order, aria-labels na ikonach, Enter dodaje pozycję),
    - czytelne stany pustego widoku: „Brak pozycji na liście zakupów” + wskazówka „Dodaj przepis do planu lub wpisz pozycję ręcznie”.
    - **Usuwanie pozycji (MVP – rozszerzenie):**
        - po kliknięciu ikonki kosza pozycja znika z listy i pojawia się Snackbar/Toast z akcją **„Cofnij”** (Undo),
        - dla pozycji „z przepisów” usuwamy **całą grupę** (wszystkie wiersze w grupie: `nazwa`+`jednostka`+`is_owned`),
        - usuwanie działa identycznie niezależnie od stanu `is_owned` (użytkownik może usuwać także pozycje oznaczone jako posiadane),
        - usunięcie pozycji „z przepisów” **nie usuwa przepisu** z „Mojego planu” (plan bez zmian),
        - jeśli po usunięciu użytkownik zmieni „Mój plan” (np. doda nowy przepis), pozycja może pojawić się ponownie jako nowe wiersze wynikające z aktualizacji listy zakupów na zdarzeniach planu (w MVP nie utrzymujemy „wykluczeń”),
        - dla dostępności: aria-label na koszu powinien jednoznacznie opisywać zakres (np. „Usuń pozycję: cukier 250 g”).
    - **Wyczyść listę (MVP – rozszerzenie):**
        - akcja w Page Header otwiera modal potwierdzenia,
        - modal jasno komunikuje, że:
            - lista zakupów zostanie wyczyszczona (pozycje ręczne i „z przepisów”),
            - „Mój plan” nie zostanie zmodyfikowany,
        - po potwierdzeniu lista staje się pusta; w MVP brak Undo dla tej operacji,
        - po wyczyszczeniu lista pozostaje pusta do czasu kolejnej zmiany w planie (dodanie/usunięcie przepisu) lub dodania pozycji ręcznej.
    - *Uwaga (MVP):* jeśli użytkownik edytuje przepis będący w planie, lista zakupów może pozostać nieaktualna (brak automatycznej aktualizacji).

## 3. Mapa podróży użytkownika

Główny przepływ pracy dla nowego użytkownika koncentruje się na łatwym dodaniu i zorganizowaniu pierwszego przepisu:
1.  **Rejestracja i potwierdzenie e-mail:** Użytkownik tworzy konto, po czym widzi ekran „Wysłaliśmy link aktywacyjny”. Następnie otwiera e-mail i klika link, a aplikacja potwierdza adres i pokazuje komunikat „Możesz się zalogować”.
2.  **Logowanie:** Po potwierdzeniu e-mail użytkownik loguje się i trafia na **Dashboard**.
3.  **Tworzenie przepisu:** Z Dashboardu lub widoku **Listy Przepisów** (który wyświetla stan pusty), użytkownik klika „Dodaj przepis” i trafia do **Kreatora**. Następnie wybiera:
    - **Pusty formularz** (przejście do formularza tworzenia),
    - albo **Z tekstu/zdjęcia (AI)** (wklejenie danych i automatyczne wstępne wypełnienie formularza).
4.  **Wypełnianie danych:** Użytkownik uzupełnia lub poprawia informacje o przepisie, w tym nazwę, składniki, kroki, kategorię i tagi.
5.  **Zapis i przekierowanie:** Po zapisaniu, aplikacja przenosi go do widoku **Szczegółów Przepisu**, aby mógł zobaczyć efekt swojej pracy.
6.  **Organizacja w kolekcji:** Na stronie szczegółów, za pomocą przycisku "Dodaj do kolekcji", użytkownik otwiera modal, w którym może stworzyć nową kolekcję (np. "Ulubione") i od razu przypisać do niej przepis.
7.  **Weryfikacja:** Użytkownik może nawigować do widoku **Listy Kolekcji**, a następnie do **Szczegółów Kolekcji**, aby upewnić się, że jego przepis został poprawnie dodany.

## 4. Układ i struktura nawigacji

- **Nawigacja dla gości:** Topbar zawiera stałą główną nawigację: `Moja Pycha` (do `/dashboard`) i `Odkrywaj przepisy` (do `/explore`) oraz akcje po prawej stronie: `Zaloguj` i `Zarejestruj`. Na landing (`/`) dodatkowo widoczne jest pole wyszukiwania publicznych przepisów.
- **Nawigacja na publicznych widokach dla zalogowanych:** Publiczne ścieżki (`/`, `/explore`, `/explore/recipes/:id-:slug`) korzystają z Topbara (bez Sidebara). Dodatkowo `/explore/recipes/:id` pozostaje jako ścieżka kompatybilności wstecznej i jest normalizowana do kanonicznego URL:
    - brak przycisków "Zaloguj" i "Zarejestruj",
    - w Topbarze dostępny jest profil użytkownika (menu + wylogowanie),
    - w Topbarze dostępna jest stała główna nawigacja: `Moja Pycha` (`/dashboard`) i `Odkrywaj przepisy` (`/explore`).
- **Nawigacja dla zalogowanych (App Shell):**
    - **Sidebar (Lewa strona):** Główny panel nawigacyjny. Zawiera linki: `Moja Pycha` (route: `/dashboard`), `Moje przepisy`, `Kolekcje`, `Zakupy`, `Ustawienia`. Nie zawiera akcji operacyjnych. Sidebar jest widoczny wyłącznie na ścieżkach: `/dashboard`, `/my-recipies` (alias: `/my-recipes`), `/recipes/**`, `/collections/**`, `/shopping/**`, `/settings/**`. Na mobile zwijany (Hamburger) lub Bottom Bar.
        - **Kolekcje jako drzewo (MVP):**
            - poziom 1: „Kolekcje” (pozycja główna) z chevron,
            - poziom 2: lista kolekcji użytkownika (każda z własnym chevron),
            - poziom 3: lista przepisów w kolekcji (element: mała miniatura z ilustracji przepisu + nazwa),
            - **lazy-load:** lista przepisów dla kolekcji jest pobierana dopiero po rozwinięciu tej kolekcji,
            - kliknięcie w etykietę „Kolekcje” prowadzi do `/collections` (zarządzanie kolekcjami),
            - kliknięcie w chevron zwija/rozwija (bez nawigacji),
            - kliknięcie w przepis na poziomie 3 nawiguję do `/recipes/:id-:slug`.
    - **Topbar (Góra):** Pasek kontekstowy. Zawiera:
        - **Główna nawigacja (stała):** Zakładki "Moja Pycha" oraz "Odkrywaj przepisy" z wyróżnieniem aktywnej pozycji. **Lista pozycji jest zahardkodowana we froncie** (konfiguracja statyczna) i przygotowana pod przyszłe moduły: blog, menu, zakupy.
        - **Breadcrumbs (kontekstowe):** Ścieżka powrotu wyświetlana na głębszych trasach (np. `Kolekcje > Święta`).
        - **Omnibox:** Globalne wyszukiwanie dostępne zawsze (np. jako ikona otwierająca overlay).
        - **Profil:** Avatar i menu użytkownika.
    - **Page Header:** Nagłówek widoku pod Topbarem. Zawiera tytuł i przyciski akcji.

Taka struktura zapewnia jasny podział na to "gdzie jestem" (Topbar/Sidebar) i "co mogę zrobić" (Page Header).

## 5. Kluczowe komponenty

Poniższe komponenty będą reużywalne i kluczowe dla zapewnienia spójności oraz efektywności deweloperskiej:

- **Karta przepisu (`RecipeCardComponent`):** Komponent wyświetlający miniaturę przepisu (zdjęcie, nazwa, kategoria) na listach (`/my-recipies`, `/collections/:id`, `/explore`). Jeśli przepis ma flagę "Termorobot", karta pokazuje dodatkowy badge/chip "Termorobot" odpowiednią ikonką. Jeśli przepis ma flagę **"Grill"**, karta pokazuje **ikonkę grilla** (Material: `outdoor_grill`) z tooltipem **„Grill”**. Dla przepisu mojego autorstwa (`is_owner=true`) karta pokazuje również ikonkę widoczności odpowiadającą polu `visibility` (Prywatny / Współdzielony / Publiczny) wraz z tooltipem.
- **Komponent "stanu pustego" (`EmptyStateComponent`):** Generyczny komponent wyświetlający informację (np. "Nie masz jeszcze żadnych przepisów") i przycisk z wezwaniem do akcji (np. "Dodaj pierwszy przepis"). Używany na listach przepisów i kolekcji.
- **Komponent przesyłania pliku (`ImageUploadComponent`):** Komponent obsługujący wybór, walidację i podgląd zdjęcia w formularzu przepisu, z obsługą **wklejania ze schowka (Ctrl+V)** oraz **drag&drop** (plik z dysku) w trybie edycji. Umożliwia auto-upload, pokazuje progres oraz udostępnia akcje: "Wybierz plik" (fallback), "Usuń zdjęcie", "Cofnij" (Undo).
- **Modal dodawania do kolekcji (`AddToCollectionDialogComponent`):** Okno modalne do zarządzania przynależnością przepisu do kolekcji (multi-select).
    - **Rozmiar (desktop-first):** modal jest wyraźnie większy niż standardowe małe dialogi; lista kolekcji ma własny scroll (nie przewijamy całej strony). Na mobile modal przechodzi w pełnoekranowy bottom-sheet / full-screen dialog (zgodnie z Material).
    - **Wybór kolekcji:** lista kolekcji prezentowana jako **checkboxy** (można zaznaczyć wiele pozycji). Kolekcje, w których przepis już jest, są **zaznaczone** po otwarciu modala.
    - **Stan 0:** użytkownik może zapisać stan z **0 zaznaczonych** kolekcji (przepis nie należy do żadnej kolekcji); UI pokazuje wtedy krótką, czytelną informację (np. tekst pomocniczy) przed zapisem.
    - **Wyszukiwanie (frontend):** pole „Szukaj kolekcji” filtruje listę **po nazwie** po stronie klienta (endpoint `GET /collections` zwraca wszystkie kolekcje).
    - **Tworzenie nowej kolekcji w modalu:** sekcja „Nowa kolekcja” (nazwa + akcja „Utwórz”). Po sukcesie:
        - nowa kolekcja pojawia się na liście,
        - jest automatycznie zaznaczona,
        - użytkownik może kontynuować wybór innych kolekcji bez zamykania okna.
    - **Akcje:** `Anuluj` (zamyka bez zmian) oraz `Zapisz` (ustawia docelową listę kolekcji dla przepisu).
    - **Stany:** podczas `Zapisz` pokazujemy loader i blokujemy ponowne wysłanie; po sukcesie modal się zamyka i pojawia się potwierdzenie (Snackbar/Toast).
    - **Dostępność:** focus trap, `Esc` zamyka, checkboxy dostępne z klawiatury, aria-labels dla akcji.
- **Drawer „Mój plan” (`MyPlanDrawerComponent`):** Panel wysuwany z prawej strony pokazujący listę przepisów w planie (miniatura + nazwa + kosz), z akcjami: „Wyczyść” i „Zamknij” oraz z overlay zamykającym po kliknięciu.
- **Pływający przycisk „Mój plan” (`MyPlanFabComponent`):** Globalny przycisk widoczny po zalogowaniu, gdy plan ma ≥ 1 element. Umieszczony w prawym dolnym rogu i otwierający drawer „Mój plan”.
- **Serwis planu (`MyPlanService`):** Warstwa komunikacji z API planu oraz źródło stanu UI (czy drawer jest otwarty, czy plan ma elementy) wykorzystywana w komponentach globalnych (App Shell) i na szczegółach przepisu.
- **Drzewo kolekcji w Sidebarze (`CollectionsSidebarTreeComponent`):** Komponent Sidebara renderujący zagnieżdżoną nawigację „Kolekcje → (kolekcje) → (przepisy)”.
    - **Źródła danych:** lista kolekcji z `GET /collections`, a przepisy dla danej kolekcji dociągane leniwie po jej rozwinięciu (dedykowany endpoint kolekcji).
    - **UI elementu przepisu:** miniatura z ilustracji przepisu (np. `mat-list-item` + `mat-icon`/`mat-avatar` z obrazem) + nazwa; fallback (np. ikonka) gdy brak `image_path`.
    - **Zachowanie:** chevron rozwija/zwija bez nawigacji; kliknięcie w etykietę „Kolekcje” nawiguję do `/collections`; kliknięcie w przepis nawiguję do `/recipes/:id-:slug`.
- **Lista edytowalnych elementów (`EditableListComponent`):** Komponent do zarządzania listą składników/kroków/wskazówek w formularzu, wspierający dodawanie, usuwanie, edycję "in-line" oraz zmianę kolejności za pomocą "przeciągnij i upuść".
