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

- **US-056 — Mobilna nawigacja dolna (Bottom Bar) zamiast hamburgera**
    - **Co dodano**:
        - na mobile/tablet (breakpoint ~ `< 960px`) główna nawigacja działa jako Bottom Bar przypięty na dole,
        - 3 pozycje: `Odkrywaj` (`/explore`), `Moja Pycha` (`/dashboard`), `Zakupy` (`/shopping`),
        - przekierowanie gościa do logowania dla ścieżek prywatnych (`/dashboard`, `/shopping`) z powrotem po sukcesie (returnUrl),
        - wymaganie `padding-bottom` + safe-area, aby Bottom Bar nie zasłaniał treści.

### Zmienione / doprecyzowane

- **US-014 — Globalna nawigacja i orientacja (App Shell)**
    - **Co się zmieniło / doprecyzowano**:
        - Topbar (desktop-first) zawiera 3 pozycje: `Odkrywaj przepisy`, `Moja Pycha`, `Zakupy`,
        - na mobile/tablet usunięto założenie „hamburger/drawer” dla menu głównego — zastąpione przez Bottom Bar,
        - doprecyzowano widoczność Sidebara o `/shopping/**` oraz zachowanie gościa dla pozycji prywatnych.


</user_stories>


3. Widok do implementacji / zmiany w widokach
<views>

### Nowe

- **App Shell (mobile/tablet) — Bottom Bar**
    - **Co dodano**:
        - globalny, przypięty pasek na dole z 3 ikonami + etykietami dla nawigacji głównej,
        - aktywna pozycja jest wyróżniona,
        - layout widoków uwzględnia `padding-bottom` + safe-area.

### Zmienione / doprecyzowane

- **App Shell — Topbar**
    - **Co się zmieniło / doprecyzowano**:
        - na desktopie główna nawigacja zawiera `Odkrywaj przepisy`, `Moja Pycha`, `Zakupy`,
        - na mobile/tablet zakładki głównej nawigacji nie są pokazywane w Topbarze (zastępuje je Bottom Bar).

- **Nawigacja na widokach publicznych (`/`, `/explore`, `/explore/recipes/:id-:slug`)**
    - **Co się zmieniło / doprecyzowano**:
        - na mobile/tablet obowiązuje Bottom Bar (również dla gościa),
        - kliknięcie `Moja Pycha` / `Zakupy` jako gość prowadzi do logowania (z powrotem do docelowej ścieżki po sukcesie).


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
