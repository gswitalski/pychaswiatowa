Jesteś doświadczonym analitykiem produktowym i architektem oprogramowania. Twoim zadaniem jest przeanalizowanie dokumentów projektu aplikacji webowej i dodanie nowej funkcjonalności do istniejącego projektu.

Oto dokumenty projektu, które musisz przeanalizować:

<dokumenty_projektu>



</dokumenty_projektu>

Oto opis nowej funkcjonalności, którą należy dodać do projektu:

<nowa_funkcjonalnosc>
Przeanalizowałem dostarczone dokumenty (PRD, Tech Stack, UI Plan, plany API i DB) i zgadzam się z Twoją obserwacją. Obecny plan, choć funkcjonalny, cierpi na typową chorobę aplikacji wczesnej fazy: **rozproszenie akcji**. Użytkownik musi "szukać" przycisków – raz są w treści, raz na górze, raz w modalu.

Aby rozwiązać problem "chaosu" i nadać aplikacji nowoczesny sznyt (zgodny z Material Design 3 i trendami na 2025 rok), proponuję przejście na architekturę **"App Shell" z kontekstowym paskiem akcji (Page Header)**.

Oto propozycja zrewidowanej nawigacji i układu UI:

### 1. Diagnoza problemu (Co zmieniamy?)
*   **Problem:** Mieszanie nawigacji (gdzie idę) z akcjami (co robię).
*   **Rozwiązanie:** Separacja. Lewa strona i góra służą do nawigacji i kontekstu. Prawa strona nagłówka treści służy do akcji.
*   **Cel:** Użytkownik zawsze wie, gdzie kliknąć, by "Edytować", "Dodać" lub "Usunąć", niezależnie od tego, na jakiej podstronie się znajduje.

---

### 2. Nowa Koncepcja Układu (Layout)

Proponuję układ "Holy Grail" w nowoczesnym wydaniu:

#### A. Globalny Sidebar (Nawigacja Główna) – *Lewa strona*
Tu znajdują się tylko linki prowadzące do głównych modułów. Ten pasek **nigdy** nie zawiera przycisków akcji (jak "Dodaj przepis").
*   **Logo** (klikalne -> Dashboard)
*   **Dashboard** (Pulpit)
*   **Wszystkie przepisy**
*   **Kolekcje**
*   *(Separator)*
*   **Ustawienia**
*   **Wyloguj** (na samym dole)

*Na mobile:* Sidebar chowa się pod ikoną hamburgera lub zmienia się w **Bottom Navigation Bar** (bardzo silny trend UX – łatwiejsza obsługa kciukiem).

#### B. Globalny Topbar (Kontekst Aplikacji) – *Góra*
Służy do orientacji i funkcji globalnych.
*   **Lewa strona:** Breadcrumbs (Okruszki chleba) – np. `Kolekcje > Święta > Sernik`. To kluczowe, aby użytkownik wiedział, gdzie jest w hierarchii.
*   **Środek:** Globalny Search Bar (Omnibox) – zawsze dostępny.
*   **Prawa strona:** Avatar użytkownika (Menu profilowe) + Powiadomienia (opcjonalnie w przyszłości).

#### C. Page Header (Pasek Akcji) – *Kluczowa zmiana*
To jest element, który wprowadza porządek. Każdy widok (Listy, Szczegóły) posiada ustandaryzowany nagłówek **pod** Topbarem, a **nad** treścią.

Układ Page Header:
1.  **Tytuł strony** (np. "Moje Przepisy" lub "Szarlotka Babci").
2.  **Prawa strona (Toolbar Akcji):** Tu znajdują się WSZYSTKIE przyciski operacyjne dla danego widoku.

---

### 3. Szczegółowe rozwiązania dla widoków

Oto jak ta zmiana wpłynie na konkretne ekrany z Twojego PRD:

#### Widok 1: Lista Przepisów (`/recipes`)
Zamiast szukać przycisku dodawania gdzieś na dole listy lub w rogu ekranu:

*   **Page Header:**
    *   Lewa: Tytuł "Twoje Przepisy" + licznik (np. "24 przepisy").
    *   Prawa: **Główny przycisk "Dodaj Przepis" (Primary Button)**.
        *   *Pro Tip:* Zrób z tego "Split Button". Główna akcja to "Nowy ręcznie", a strzałka obok rozwija menu: "Importuj z tekstu".
*   **Pasek Filtrów (poniżej nagłówka):**
    *   Chipsy (Pigułki) do szybkiego filtrowania kategorii (Obiad, Deser).
    *   Sortowanie (dropdown po prawej).
*   **Treść:** Grid kafelków (Kart).

#### Widok 2: Szczegóły Przepisu (`/recipes/:id`)
Tu zazwyczaj jest największy bałagan. Uporządkujmy to:

*   **Page Header:**
    *   Lewa: Tytuł przepisu (duży font).
    *   Prawa: Ikony akcji (Icon Buttons) z tooltipsami:
        *   ❤️ (Dodaj do ulubionych/kolekcji)
        *   🔗 (Udostępnij/Kopiuj link - przyszłościowo)
        *   ✏️ (Edytuj - przenosi do formularza)
        *   🗑️ (Usuń - czerwony kolor)
*   **Treść:**
    *   Zamiast płaskiej ściany tekstu, zastosuj **Sticky Navigation** wewnątrz przepisu na desktopie.
    *   Lewa kolumna: Zdjęcie + Meta dane (czas, porcje, tagi).
    *   Środkowa kolumna: Składniki i Kroki.
    *   Prawa kolumna (opcjonalnie na szerokich ekranach): Spis treści (kotwice do sekcji, jeśli przepis jest długi).

#### Widok 3: Formularz (Dodawanie/Edycja) (`/recipes/new`)
Częsty błąd: przyciski "Zapisz" na samym dole długiego formularza.

*   **Page Header:**
    *   Lewa: Tytuł "Nowy przepis" / "Edycja: Szarlotka".
    *   Prawa:
        *   Przycisk "Anuluj" (Ghost button).
        *   **Przycisk "Zapisz" (Primary button) – ZAWSZE WIDOCZNY.**
*   **Zachowanie:** Dzięki umieszczeniu "Zapisz" w nagłówku (który może być `sticky` - przyklejony do góry), użytkownik nie musi scrollować na sam dół, by zapisać zmianę w nazwie.

---

### 4. Nowoczesne wzorce UX do wdrożenia

1.  **Empty States (Stany puste) z Akcją:**
    *   Gdy lista jest pusta, nie pokazuj tylko tekstu "Brak przepisów".
    *   Pokaż ładną ilustrację wektorową i duży przycisk na środku: "Stwórz swój pierwszy przepis" oraz mniejszy "Zaimportuj przepis". To tzw. *Call to Action* w stanie zerowym.

2.  **Skeletons zamiast Spinnerów:**
    *   Podczas ładowania danych nie używaj kręcącego się kółka na środku.
    *   Użyj "szkieletu" (szarych pulsujących prostokątów), które udają układ strony. To daje wrażenie, że aplikacja jest szybsza.

3.  **Toasty (Snackbars) dla potwierdzeń:**
    *   Po zapisaniu/usunięciu nie przekierowuj bez słowa.
    *   Pokaż czarny pasek na dole (Snackbar z Angular Material) z komunikatem "Przepis zapisany" i przyciskiem "Cofnij" (Undo) dla usunięcia. To bardzo nowoczesne podejście (Optimistic UI).

4.  **Tryb Focus dla Importu:**
    *   Widok importu (`/recipes/import`) powinien być maksymalnie prosty. Usuń zbędne elementy. Dwa panele:
        *   Lewy: Pole tekstowe (Paste area).
        *   Prawy: Podgląd na żywo (Live Preview) tego, jak parser rozumie tekst. To da użytkownikowi pewność przed kliknięciem "Importuj".

### Podsumowanie zmian w kodzie (Angular)

Aby to osiągnąć, będziesz potrzebować:

1.  Zmienić `MainLayoutComponent`: Dodać slot na `PageHeader`.
2.  Stworzyć uniwersalny komponent `SharedPageHeaderComponent` z `@Input() title` i `@ContentChildren` dla przycisków akcji.
3.  W każdym widoku (`RecipeListComponent`, `RecipeDetailComponent`) używać tego nagłówka jako pierwszego elementu w szablonie.

**Czy taki uporządkowany, "szablonowy" układ z wyraźnym podziałem na nawigację i akcje Ci odpowiada?** Jeśli tak, mogę przygotować strukturę komponentów Angulara pod ten plan.
</nowa_funkcjonalnosc>

Twoim zadaniem jest:

1. Dokładnie przeanalizować wszystkie dostarczone dokumenty projektu, aby zrozumieć obecną architekturę, funkcjonalności i strukturę aplikacji
2. Na podstawie opisu nowej funkcjonalności, dodać odpowiednie elementy do:
   - PRD (Product Requirements Document) - dodaj nowe funkcje i historyjki użytkownika
   - Planu UI - dodaj nowy widok/widoki
   - Planu API - dodaj nowe endpointy API

Przed przystąpieniem do tworzenia rozszerzeń, użyj scratchpad do zaplanowania swojego podejścia:

<scratchpad>
[Tutaj przeanalizuj dokumenty, zidentyfikuj kluczowe elementy obecnej architektury, zastanów się jak nowa funkcjonalność wpasuje się w istniejący system, zaplanuj jakie konkretnie elementy trzeba dodać do każdego dokumentu]
</scratchpad>

Wymagania dotyczące odpowiedzi:
- Wszystko ma być napisane w języku polskim
- Zachowaj spójność ze stylem i formatem istniejących dokumentów
- Upewnij się, że nowe elementy logicznie wpasowują się w obecną architekturę
- Dla PRD: dodaj konkretne funkcje i przynajmniej jedną szczegółową historyjkę użytkownika
- Dla planu UI: opisz nowy widok/widoki z uwzględnieniem UX i interfejsu
- Dla planu API: dodaj konkretne endpointy z metodami HTTP, parametrami i odpowiedziami

Twoja końcowa odpowiedź powinna zawierać trzy wyraźnie oznaczone sekcje:
1. Rozszerzenia do PRD
2. Nowy widok w planie UI  
3. Nowe API w planie API

Sformatuj swoją odpowiedź używając odpowiednich nagłówków i zachowując czytelną strukturę.


Dodatkowo  stwórz dokument w doc/results/changes/{nazwa-ficzera-po-angielsku}-changes.md
W tym dokumence umieść 3 rozdziały:
1. historyjki użytkownika
2. API
2. Widoki.

W każdym rozdziale umieść odpowiednio opisy historyjek, endpointów i widoków które są nowe lub zmienione. dla zmienionych dopisz notatkę co się zmieniło.

