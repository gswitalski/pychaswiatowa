Jako starszy programista frontendu Twoim zadaniem jest stworzenie szczegółowego planu wdrożenia nowego widoku w aplikacji internetowej. Plan ten powinien być kompleksowy i wystarczająco jasny dla innego programisty frontendowego, aby mógł poprawnie i wydajnie wdrożyć widok.

Najpierw przejrzyj następujące informacje:

1. Product Requirements Document (PRD):
<prd>

@docs/results/main-project-docs/004 prd.md 

</prd>

2. UI Plan:
<ui_plan>

@docs/results/main-project-docs/011 High-Level UI Plan.md 

</ui_plan>

4. User Stories:

<user_stories>

### Nowe

- **US-055 — Nawigacja po kolekcjach w Sidebarze (drzewo: kolekcje → przepisy)**
    - **Co dodano**:
        - „Kolekcje” w Sidebarze jest drzewem rozwijalnym (poziom 1: Kolekcje → poziom 2: kolekcje → poziom 3: przepisy),
        - lista przepisów kolekcji jest ładowana **leniwe** dopiero po rozwinięciu danej kolekcji,
        - element przepisu pokazuje **nazwę** oraz **małą miniaturę** z ilustracji (jeśli istnieje),
        - kliknięcie przepisu nawiguję do `/recipes/:id-:slug`.

### Zmienione / doprecyzowane

- **US-011 — Tworzenie i zarządzanie kolekcjami przepisów**
    - **Co się zmieniło / doprecyzowano**:
        - `/collections` pozostaje widokiem do zarządzania kolekcjami (lista/tworzenie/edycja/usuwanie),
        - Sidebar zapewnia dodatkową, szybszą ścieżkę nawigacji do przepisów w kolekcji (bez zmiany istniejących flow zarządzania).


</user_stories>


3. Widok do implementacji / zmiany w widokach
<views>

### Zmienione / doprecyzowane

- **App Shell — Sidebar: „Kolekcje” jako drzewo**
    - **Co się zmieniło / doprecyzowano**:
        - kliknięcie w etykietę „Kolekcje” prowadzi do `/collections`,
        - chevron obok „Kolekcje” zwija/rozwija (bez nawigacji),
        - po rozwinięciu kolekcji (poziom 2) dociągana jest lista przepisów (poziom 3),
        - element przepisu prezentuje miniaturę (z `image_path`) + nazwę; fallback ikonka gdy brak zdjęcia.

- **Widok: Lista Kolekcji (`/collections`)**
    - **Co się zmieniło / doprecyzowano**:
        - jest osiągalny przez kliknięcie w etykietę „Kolekcje” w Sidebarze (nie przez chevron).


</views>

5. Endpoint Description:
<endpoint_description>

@docs/results/main-project-docs/009 API plan.md 
</endpoint_description>


7. Type Definitions:
<type_definitions>

@shared/contracts/types.ts 

</type_definitions>

8. Tech Stack:
<tech_stack>

@docs/results/main-project-docs/006 Tech Stack.md 

</tech_stack>

9. Frontend rules
<rules>

@.cursor/rules/fronend.mdc 

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

Rozpocznij analizę i planowanie już teraz. Twój ostateczny wynik powinien składać się wyłącznie z planu wdrożenia w języku polskim w formacie markdown, który zapiszesz w nowym pliku pliku docs/results/impl-plans/views/{feature-name}-view-implementation-plan.md i nie powinien powielać ani powtarzać żadnej pracy wykonanej w podziale implementacji.
