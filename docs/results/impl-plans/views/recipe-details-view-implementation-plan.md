# Plan implementacji widoku: Szczegóły Przepisu

## 1. Przegląd

Widok "Szczegóły Przepisu" jest kluczowym ekranem aplikacji, którego celem jest wyświetlenie wszystkich informacji o wybranym przepisie w sposób czytelny i estetyczny. Umożliwia on użytkownikowi zapoznanie się z nazwą, opisem, zdjęciem, listą składników i kroków przygotowania, a także przypisanymi kategoriami i tagami. Dodatkowo, widok ten stanowi punkt wyjścia do dalszych akcji, takich jak edycja, usunięcie czy dodanie przepisu do kolekcji.

## 2. Routing widoku

Widok będzie dostępny pod dynamiczną ścieżką URL, która zawiera unikalny identyfikator przepisu.

-   **Ścieżka:** `/recipes/:id`
-   **Przykład:** `/recipes/123`

## 3. Struktura komponentów

Widok zostanie zbudowany w oparciu o architekturę komponentową, z podziałem na komponent nadrzędny (kontener) odpowiedzialny za logikę oraz komponenty podrzędne (prezentacyjne) odpowiedzialne za wyświetlanie poszczególnych części interfejsu.

```
RecipeDetailsPageComponent (Komponent-kontener strony)
├── RecipeHeaderComponent (Wyświetla nazwę, opis, kategorię i tagi)
├── RecipeImageComponent (Wyświetla zdjęcie przepisu)
├── RecipeActionsComponent (Zawiera przyciski akcji: Edytuj, Usuń, Dodaj do kolekcji)
├── RecipeContentListComponent (Instancja dla składników)
└── RecipeContentListComponent (Instancja dla kroków)
```

## 4. Szczegóły komponentów

### RecipeDetailsPageComponent

-   **Opis komponentu:** Główny, inteligentny komponent strony. Jego zadaniem jest pobranie `id` przepisu z adresu URL, wykonanie zapytania do API w celu pobrania danych, zarządzanie stanem widoku (ładowanie, błąd, dane) oraz koordynacja akcji wykonywanych przez użytkownika.
-   **Główne elementy:** Komponent będzie renderował pozostałe komponenty prezentacyjne, przekazując im odpowiednie dane. Struktura HTML będzie oparta o CSS Flexbox lub Grid, aby zrealizować responsywny układ dwukolumnowy.
-   **Obsługiwane zdarzenia:**
    -   `editClicked`: Nawiguje do strony edycji przepisu (`/recipes/:id/edit`).
    -   `deleteClicked`: Otwiera modal z prośbą o potwierdzenie, a następnie wywołuje usługę usuwającą przepis.
    -   `addToCollectionClicked`: Otwiera modal `AddToCollectionDialogComponent`.
-   **Typy:** Zarządza stanem widoku: `Signal<RecipeDetailsState>`.
-   **Propsy:** Brak (komponent routowalny).

### RecipeHeaderComponent

-   **Opis komponentu:** Komponent prezentacyjny, odpowiedzialny za wyświetlanie metadanych przepisu: nazwy, opisu, kategorii i tagów.
-   **Główne elementy:** `<h1>` dla nazwy, `<p>` dla opisu, `<a>` dla kategorii (link do filtrowania), `mat-chip-list` dla tagów.
-   **Obsługiwane zdarzenia:** Brak.
-   **Typy:** `RecipeDetailDto`.
-   **Propsy (Inputs):**
    -   `recipe: RecipeDetailDto`

### RecipeImageComponent

-   **Opis komponentu:** Prosty komponent do wyświetlania zdjęcia przepisu.
-   **Główne elementy:** `<img>` tag z odpowiednio ustawionym `src` i `alt`. CSS zostanie użyty do zapewnienia, że obraz jest responsywny i poprawnie przycięty (`object-fit: cover`).
-   **Obsługiwane zdarzenia:** Brak.
-   **Typy:** Brak.
-   **Propsy (Inputs):**
    -   `imageUrl: string | null`
    -   `recipeName: string`

### RecipeContentListComponent

-   **Opis komponentu:** Reużywalny komponent prezentacyjny przeznaczony do wyświetlania listy składników lub kroków. Potrafi renderować dwa typy contentu: nagłówki sekcji i zwykłe pozycje listy.
-   **Główne elementy:** `<h2>` dla tytułu (`Składniki`/`Kroki`). Wewnątrz używa pętli `@for` do iteracji po danych. Używa `@if` do warunkowego renderowania nagłówka sekcji (np. `<h3>`) lub elementu listy (`<li>` wewnątrz `<ul>`).
-   **Obsługiwane zdarzenia:** Brak.
-   **Typy:** `RecipeContentItem[]`.
-   **Propsy (Inputs):**
    -   `title: string`
    -   `content: RecipeContent`

### RecipeActionsComponent

-   **Opis komponentu:** Pasek narzędzi z przyciskami akcji.
-   **Główne elementy:** Zestaw komponentów `mat-button`.
-   **Obsługiwane zdarzenia (Outputs):**
    -   `editClicked: EventEmitter<void>`
    -   `deleteClicked: EventEmitter<void>`
    -   `addToCollectionClicked: EventEmitter<void>`
-   **Typy:** Brak.
-   **Propsy:** Brak.

## 5. Typy

Głównym typem danych dla tego widoku będzie `RecipeDetailDto` zdefiniowany w `shared/contracts/types.ts`. Nie ma potrzeby tworzenia dodatkowych, niestandardowych typów ViewModel, ponieważ DTO jest już dobrze ustrukturyzowane do celów wyświetlania.

```typescript
// z shared/contracts/types.ts
export type RecipeDetailDto = Omit<
    RecipeDetail,
    'ingredients' | 'steps' | 'tags' | 'collections'
> & {
    ingredients: RecipeContent;
    steps: RecipeContent;
    tags: TagDto[];
};

export type RecipeContent = RecipeContentItem[];

export type RecipeContentItem =
    | { type: 'header'; content: string }
    | { type: 'item'; content: string };
```

Do zarządzania stanem w komponencie-kontenerze zostanie użyty interfejs:
```typescript
interface RecipeDetailsState {
    recipe: RecipeDetailDto | null;
    isLoading: boolean;
    error: ApiError | null;
}
```

## 6. Zarządzanie stanem

Zarządzanie stanem będzie realizowane lokalnie w `RecipeDetailsPageComponent` z wykorzystaniem Angular Signals, zgodnie z wytycznymi projektu.

-   Zostanie utworzony obiekt `state` oparty o `signal` przechowujący `RecipeDetailsState`.
    ```typescript
    state = signal<RecipeDetailsState>({
        recipe: null,
        isLoading: true,
        error: null,
    });
    ```
-   Komponent będzie subskrybował zmiany w `ActivatedRoute` (lub pobierał jednorazowo parametr `:id`), aby zainicjować pobieranie danych.
-   Wynik operacji API (sukces lub błąd) będzie aktualizował `state` za pomocą metody `update`, co spowoduje reaktywne odświeżenie interfejsu użytkownika.

## 7. Integracja API

-   **Endpoint:** `GET /recipes/{id}`
-   **Usługa:** Zostanie wykorzystana istniejąca lub utworzona nowa metoda w `RecipesService`, np. `getRecipeById(id: number): Observable<RecipeDetailDto>`.
-   **Proces:**
    1.  `RecipeDetailsPageComponent` wstrzykuje `RecipesService` i `ActivatedRoute`.
    2.  W `ngOnInit` lub konstruktorze pobiera `id` z trasy.
    3.  Wywołuje metodę `getRecipeById(id)`.
    4.  Ustawia stan `isLoading` na `true`.
    5.  W przypadku sukcesu: aktualizuje stan `recipe` danymi z odpowiedzi i ustawia `isLoading` na `false`.
    6.  W przypadku błędu: aktualizuje stan `error` i ustawia `isLoading` na `false`.
-   **Typ odpowiedzi:** `RecipeDetailDto`.

## 8. Interakcje użytkownika

-   **Wejście na stronę:** Użytkownik widzi wskaźnik ładowania, a po chwili pełne dane przepisu.
-   **Kliknięcie "Edytuj":** Użytkownik jest przenoszony na stronę edycji (`/recipes/:id/edit`).
-   **Kliknięcie "Usuń":** Otwiera się `MatDialog` z prośbą o potwierdzenie. Po zatwierdzeniu, przepis jest usuwany, a użytkownik jest przenoszony na listę swoich przepisów (`/recipes`) i widzi komunikat `MatSnackBar` o powodzeniu operacji.
-   **Kliknięcie "Dodaj do kolekcji":** Otwiera się `MatDialog` (`AddToCollectionDialogComponent`), który pozwala wybrać istniejącą kolekcję lub stworzyć nową.

## 9. Warunki i walidacja

Ten widok nie zawiera formularzy, więc nie ma walidacji po stronie użytkownika. Główne warunki do obsłużenia to:
-   **Poprawność `id` z URL:** Komponent powinien zweryfikować, czy `id` jest poprawną liczbą. W przeciwnym razie powinien przekierować na stronę błędu 404 lub listę przepisów.
-   **Stan ładowania:** Interfejs musi wyraźnie pokazywać, że dane są w trakcie ładowania (np. za pomocą `mat-spinner`).
-   **Stan błędu:** W przypadku błędu API, interfejs musi wyświetlić czytelną informację dla użytkownika.

## 10. Obsługa błędów

-   **Błąd 404 (Not Found):** Gdy API zwróci status 404, na ekranie pojawi się dedykowany komunikat "Nie znaleziono przepisu" z przyciskiem powrotu do listy przepisów.
-   **Błąd 403 (Forbidden) / 401 (Unauthorized):** Błędy te powinny być globalnie obsługiwane przez `HttpInterceptor`, który przekieruje użytkownika na stronę logowania.
-   **Błąd serwera (5xx) lub sieci:** W komponencie zostanie wyświetlony generyczny komunikat o błędzie, np. "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później."

## 11. Kroki implementacji

1.  **Stworzenie plików komponentów:** Użyj schematów Angular CLI, aby wygenerować pliki dla wszystkich zdefiniowanych komponentów (`RecipeDetailsPageComponent`, `RecipeHeaderComponent`, `RecipeImageComponent`, `RecipeContentListComponent`, `RecipeActionsComponent`), upewniając się, że są to komponenty `standalone`.
2.  **Implementacja routingu:** W pliku konfiguracyjnym routingu dodaj nową ścieżkę: `{ path: 'recipes/:id', loadComponent: () => import('./path/to/recipe-details-page.component').then(c => c.RecipeDetailsPageComponent) }`.
3.  **Implementacja `RecipeDetailsPageComponent`:**
    -   Dodaj logikę pobierania `id` z `ActivatedRoute`.
    -   Zaimplementuj zarządzanie stanem za pomocą sygnału `state`.
    -   Wywołaj serwis API w celu pobrania danych i zaktualizuj stan.
    -   Stwórz szablon HTML, który będzie renderował komponenty prezentacyjne i zarządzał układem (flex/grid).
    -   Zaimplementuj obsługę zdarzeń z `RecipeActionsComponent`.
4.  **Implementacja komponentów prezentacyjnych:**
    -   Zaimplementuj każdy z komponentów (`RecipeHeader`, `RecipeImage`, `RecipeContentList`, `RecipeActions`), definiując odpowiednie `@Input()` i `@Output()`.
    -   Stwórz ich szablony HTML i style SCSS, wykorzystując komponenty Angular Material.
5.  **Obsługa akcji "Usuń":** Zintegruj `MatDialog` w `RecipeDetailsPageComponent` w celu wyświetlania modala potwierdzającego usunięcie.
6.  **Obsługa akcji "Dodaj do kolekcji":** Zintegruj istniejący `AddToCollectionDialogComponent`.
7.  **Stylowanie i responsywność:** Dopracuj style SCSS dla wszystkich komponentów, aby zapewnić zgodność z projektem UI i pełną responsywność, ze szczególnym uwzględnieniem przejścia z układu dwukolumnowego na jednokolumnowy.
8.  **Testowanie:** Sprawdź poprawność działania na różnych urządzeniach/rozdzielczościach oraz przetestuj wszystkie ścieżki interakcji użytkownika i scenariusze błędów.
