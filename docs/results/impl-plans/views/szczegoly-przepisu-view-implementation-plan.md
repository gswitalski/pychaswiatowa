# Plan aktualizacji widoku Szczegóły Przepisu

## 1. Przegląd
Widok "Szczegóły Przepisu" (`RecipeDetailsPageComponent`) jest już zaimplementowany. Niniejszy plan dotyczy **modyfikacji** istniejącego widoku w celu spełnienia nowych wymagań UX dotyczących wyświetlania listy kroków.

**Główne cele zmian:**
1.  Wprowadzenie ciągłej numeracji dla listy kroków przygotowania.
2.  Numeracja musi ignorować nagłówki sekcji (np. "Ciasto", "Krem") i nie resetować się po nich.
3.  Zachowanie dotychczasowego wyglądu dla listy składników (punktorów).

## 2. Routing widoku
Bez zmian. Widok dostępny pod ścieżką `/recipes/:id`.

## 3. Struktura komponentów
Struktura pozostaje bez zmian. Modyfikacje dotyczą wnętrza komponentów.

```
RecipeDetailsPageComponent (Istniejący)
├── SharedPageHeaderComponent (Bez zmian)
├── ...
├── RecipeContentListComponent (Instancja dla składników - Bez zmian logicznych)
└── RecipeContentListComponent (Instancja dla kroków - ZMIANA: Włączenie trybu numeracji)
```

## 4. Szczegóły zmian w komponentach

### RecipeDetailsPageComponent (`src/app/pages/recipes/recipe-detail/recipe-detail-page.component.ts`)
- **Zmiany:**
    - Należy przekazać nową właściwość `isNumbered` do instancji komponentu `pych-recipe-content-list` odpowiedzialnej za wyświetlanie kroków.
- **Implementacja:**
    - W pliku szablonu (`.html`) dodać atrybut `[isNumbered]="true"` dla sekcji "Kroki przygotowania".

### RecipeContentListComponent (`src/app/pages/recipes/recipe-detail/components/recipe-content-list/recipe-content-list.component.ts`)
- **Opis modyfikacji:** Rozszerzenie komponentu o obsługę trybu numerowanego.
- **Nowe Propsy (Inputs):**
    - `isNumbered`: `boolean` (domyślnie `false`). Określa, czy lista ma być renderowana jako numerowana lista ciągła.
- **Zmiany w szablonie HTML:**
    - Dodanie warunkowej klasy CSS (np. `numbered-list`) do kontenera listy (`<ul>` lub głównego kontenera) w zależności od wartości `isNumbered`.
- **Zmiany w stylach SCSS:**
    - Implementacja CSS Counters dla klasy `.numbered-list`.
    - `counter-reset` na rodzicu.
    - `counter-increment` na elementach listy typu `item`.
    - Ukrycie domyślnych punktorów/numeracji browsera (`list-style: none`).
    - Wyświetlanie licznika w pseudoelemencie `::before`.
    - Zapewnienie, że elementy nagłówkowe (`header`) nie inkrementują licznika i nie mają numeracji.

## 5. Typy
Bez zmian. Wykorzystywane są istniejące typy `RecipeContent`, `RecipeContentItem`.

## 6. Zarządzanie stanem
Bez zmian. Stan nadal zarządzany w `RecipeDetailsPageComponent`.

## 7. Integracja API
Bez zmian.

## 8. Interakcje użytkownika
Bez zmian.

## 9. Warunki i walidacja
- **Ciągła numeracja:** Kluczowy warunek walidacji wizualnej. Jeśli lista kroków zawiera sekcje (nagłówki), numeracja kolejnych kroków musi być kontynuowana (np. sekcja A: kroki 1-3, sekcja B: kroki 4-6).

## 10. Obsługa błędów
Bez zmian.

## 11. Kroki implementacji

1.  **Modyfikacja `RecipeContentListComponent.ts`**:
    -   Dodaj input `isNumbered = input<boolean>(false);`.

2.  **Modyfikacja `RecipeContentListComponent.html`**:
    -   Dodaj dynamiczną klasę do listy: `[class.numbered-list]="isNumbered()"`.

3.  **Modyfikacja `RecipeContentListComponent.scss`**:
    -   Zdefiniuj style dla `.numbered-list`:
        ```scss
        .content-list.numbered-list {
            counter-reset: step-counter; // Inicjalizacja licznika

            .content-item {
                &::before {
                    // Nadpisanie stylów punktora (kropki) na licznik
                    content: counter(step-counter) ".";
                    counter-increment: step-counter;
                    background-color: transparent; // Usunięcie tła kropki
                    width: auto;
                    height: auto;
                    border-radius: 0;
                    font-weight: bold;
                    color: var(--mat-sys-primary);
                    // Dostosowanie pozycjonowania
                }
            }
            
            .content-header {
                // Upewnienie się, że nagłówki nie wpływają na licznik (domyślne zachowanie, ale warto sprawdzić marginesy)
            }
        }
        ```
    -   Dostosuj istniejące style `.content-item`, aby `padding-left` i pozycjonowanie `::before` działało poprawnie zarówno dla kropki (składniki), jak i cyfry (kroki). Może być konieczne zwiększenie `padding-left` dla listy numerowanej.

4.  **Modyfikacja `RecipeDetailsPageComponent.html`**:
    -   Znajdź użycie `pych-recipe-content-list` dla kroków (title="Kroki przygotowania").
    -   Dodaj `[isNumbered]="true"`.

5.  **Weryfikacja**:
    -   Sprawdź wyświetlanie składników (powinny nadal mieć kropki).
    -   Sprawdź wyświetlanie kroków (powinny mieć numery).
    -   Sprawdź przepis z sekcjami w krokach (numeracja powinna być ciągła pomimo nagłówków).
