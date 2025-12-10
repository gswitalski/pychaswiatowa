Jako starszy programista frontendu Twoim zadaniem jest stworzenie szczegółowego planu wdrożenia nowego widoku w aplikacji internetowej. Plan ten powinien być kompleksowy i wystarczająco jasny dla innego programisty frontendowego, aby mógł poprawnie i wydajnie wdrożyć widok.

Najpierw przejrzyj następujące informacje:

1. Product Requirements Document (PRD):
<prd>



</prd>

2. UI Plan:
<ui_plan>



</ui_plan>

3. Widok do implementacji
<view>
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


</view>


4. User Stories:

<user_stories>

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


</user_stories>

5. Endpoint Description:
<endpoint_description>


</endpoint_description>


7. Type Definitions:
<type_definitions>



</type_definitions>

8. Tech Stack:
<tech_stack>



</tech_stack>

9. Frontend rules
<rules>



</rules>

Przed utworzeniem ostatecznego planu wdrożenia przeprowadź analizę i planowanie wewnątrz tagów <implementation_breakdown> w swoim bloku myślenia. Ta sekcja może być dość długa, ponieważ ważne jest, aby być dokładnym.

W swoim podziale implementacji wykonaj następujące kroki:
1. Dla każdej sekcji wejściowej (PRD, User Stories, Endpoint Description, Endpoint Implementation, Type Definitions, Tech Stack):
  - Podsumuj kluczowe punkty
 - Wymień wszelkie wymagania lub ograniczenia
 - Zwróć uwagę na wszelkie potencjalne wyzwania lub ważne kwestie
2. Wyodrębnienie i wypisanie kluczowych wymagań z PRD
3. Wypisanie wszystkich potrzebnych głównych komponentów, wraz z krótkim opisem ich opisu, potrzebnych typów, obsługiwanych zdarzeń i warunków walidacji
4. Stworzenie wysokopoziomowego diagramu drzewa komponentów
5. Zidentyfikuj wymagane DTO i niestandardowe typy ViewModel dla każdego komponentu widoku. Szczegółowo wyjaśnij te nowe typy, dzieląc ich pola i powiązane typy.
6. Zidentyfikuj potencjalne zmienne stanu i niestandardowe hooki, wyjaśniając ich cel i sposób ich użycia
7. Wymień wymagane wywołania API i odpowiadające im akcje frontendowe
8. Zmapuj każdej historii użytkownika do konkretnych szczegółów implementacji, komponentów lub funkcji
9. Wymień interakcje użytkownika i ich oczekiwane wyniki
10. Wymień warunki wymagane przez API i jak je weryfikować na poziomie komponentów
11. Zidentyfikuj potencjalne scenariusze błędów i zasugeruj, jak sobie z nimi poradzić
12. Wymień potencjalne wyzwania związane z wdrożeniem tego widoku i zasugeruj możliwe rozwiązania

Po przeprowadzeniu analizy dostarcz plan wdrożenia w formacie Markdown z następującymi sekcjami:

1. Przegląd: Krótkie podsumowanie widoku i jego celu.
2. Routing widoku: Określenie ścieżki, na której widok powinien być dostępny.
3. Struktura komponentów: Zarys głównych komponentów i ich hierarchii.
4. Szczegóły komponentu: Dla każdego komponentu należy opisać:
 - Opis komponentu, jego przeznaczenie i z czego się składa
 - Główne elementy HTML i komponenty dzieci, które budują komponent
 - Obsługiwane zdarzenia
 - Warunki walidacji (szczegółowe warunki, zgodnie z API)
 - Typy (DTO i ViewModel) wymagane przez komponent
 - Propsy, które komponent przyjmuje od rodzica (interfejs komponentu)
5. Typy: Szczegółowy opis typów wymaganych do implementacji widoku, w tym dokładny podział wszelkich nowych typów lub modeli widoku według pól i typów.
6. Zarządzanie stanem: Szczegółowy opis sposobu zarządzania stanem w widoku, określenie, czy wymagany jest customowy hook.
7. Integracja API: Wyjaśnienie sposobu integracji z dostarczonym punktem końcowym. Precyzyjnie wskazuje typy żądania i odpowiedzi.
8. Interakcje użytkownika: Szczegółowy opis interakcji użytkownika i sposobu ich obsługi.
9. Warunki i walidacja: Opisz jakie warunki są weryfikowane przez interfejs, których komponentów dotyczą i jak wpływają one na stan interfejsu
10. Obsługa błędów: Opis sposobu obsługi potencjalnych błędów lub przypadków brzegowych.
11. Kroki implementacji: Przewodnik krok po kroku dotyczący implementacji widoku.

Upewnij się, że Twój plan jest zgodny z PRD, historyjkami użytkownika i uwzględnia dostarczony stack technologiczny.

uwzględnij juz zaiplementowany formularz do tworzenia piosenki aby optymalnie uzywać reużywalnych komponentów

Ostateczne wyniki powinny być w języku polskim i zapisane w pliku o nazwie docs/results/impl-plans/views/{view-name}-view-implementation-plan.md. Nie uwzględniaj żadnej analizy i planowania w końcowym wyniku.

Oto przykład tego, jak powinien wyglądać plik wyjściowy (treść jest do zastąpienia):

```markdown
# Plan implementacji widoku [Nazwa widoku]

## 1. Przegląd
[Krótki opis widoku i jego celu]

## 2. Routing widoku
[Ścieżka, na której widok powinien być dostępny]

## 3. Struktura komponentów
[Zarys głównych komponentów i ich hierarchii]

## 4. Szczegóły komponentów
### [Nazwa komponentu 1]
- Opis komponentu [opis]
- Główne elementy: [opis]
- Obsługiwane interakcje: [lista]
- Obsługiwana walidacja: [lista, szczegółowa]
- Typy: [lista]
- Propsy: [lista]

### [Nazwa komponentu 2]
[...]

## 5. Typy
[Szczegółowy opis wymaganych typów]

## 6. Zarządzanie stanem
[Opis zarządzania stanem w widoku]

## 7. Integracja API
[Wyjaśnienie integracji z dostarczonym endpointem, wskazanie typów żądania i odpowiedzi]

## 8. Interakcje użytkownika
[Szczegółowy opis interakcji użytkownika]

## 9. Warunki i walidacja
[Szczegółowy opis warunków i ich walidacji]

## 10. Obsługa błędów
[Opis obsługi potencjalnych błędów]

## 11. Kroki implementacji
1. [Krok 1]
2. [Krok 2]
3. [...]
```

Rozpocznij analizę i planowanie już teraz. Twój ostateczny wynik powinien składać się wyłącznie z planu wdrożenia w języku polskim w formacie markdown, który zapiszesz w pliku docs/results/impl-plans/views/{view-name}-view-implementation-plan.md i nie powinien powielać ani powtarzać żadnej pracy wykonanej w podziale implementacji.
