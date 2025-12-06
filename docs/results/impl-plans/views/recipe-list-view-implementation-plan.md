# Plan implementacji widoku: Lista Przepisów

## 1. Przegląd

Widok "Lista Przepisów" (`/recipes`) jest głównym interfejsem dla zalogowanego użytkownika do interakcji z jego kolekcją przepisów. Umożliwia on przeglądanie, wyszukiwanie, sortowanie i filtrowanie posiadanych receptur w formie przejrzystej siatki. Widok ten musi również obsługiwać stan pusty dla nowych użytkowników oraz zapewniać responsywność i płynne działanie podczas zmiany kryteriów wyszukiwania.

## 2. Routing widoku

Widok będzie dostępny pod następującą ścieżką i chroniony przez `AuthGuard`, aby zapewnić dostęp tylko zalogowanym użytkownikom.

-   **Ścieżka:** `/recipes`
-   **Komponent:** `RecipesPageComponent`
-   **Moduł (lub plik `routes.ts`):** Główny routing aplikacji (`app.routes.ts`)

## 3. Struktura komponentów

Hierarchia komponentów zostanie zorganizowana w celu oddzielenia logiki (komponent-kontener) od prezentacji (komponenty-dzieci).

```
- RecipesPageComponent (Kontener, Smart Component)
  |
  |- RecipesFiltersComponent (Prezentacyjny)
  |
  |- RecipeListComponent (Prezentacyjny)
  |  |
  |  |- RecipeCardComponent (Prezentacyjny, Reużywalny)
  |  |
  |  |- EmptyStateComponent (Prezentacyjny, Reużywalny)
  |
  |- MatPaginator (Komponent Angular Material)
```

## 4. Szczegóły komponentów

### pych-recipes-page

-   **Opis komponentu:** Główny komponent strony, odpowiedzialny za zarządzanie stanem (filtry, paginacja, wyniki wyszukiwania), komunikację z API za pośrednictwem serwisu oraz koordynację komponentów podrzędnych.
-   **Główne elementy:** Komponent jest kontenerem dla `RecipesFiltersComponent`, `RecipeListComponent` oraz `MatPaginator`.
-   **Obsługiwane interakcje:**
    -   Obsługa zdarzenia zmiany filtrów z `RecipesFiltersComponent`.
    -   Obsługa zdarzenia zmiany strony z `MatPaginator`.
-   **Obsługiwana walidacja:** Brak.
-   **Typy:** `RecipesFiltersViewModel`, `Signal<PaginatedResponseDto<RecipeListItemDto>>`, `Signal<CategoryDto[]>`, `Signal<TagDto[]>`.
-   **Propsy:** Brak.

### pych-recipes-filters

-   **Opis komponentu:** Panel zawierający wszystkie kontrolki do filtrowania, sortowania i wyszukiwania przepisów. Jego zadaniem jest zbieranie danych od użytkownika i emitowanie zdarzenia ze zaktualizowanym stanem filtrów.
-   **Główne elementy:**
    -   `mat-form-field` z `mat-icon` i `input` do wyszukiwania tekstowego.
    -   `mat-form-field` z `mat-select` do wyboru opcji sortowania.
    -   `mat-form-field` z `mat-select` do filtrowania po kategoriach.
    -   `mat-form-field` z `mat-chip-grid` i `input` do dynamicznego dodawania i usuwania tagów.
-   **Obsługiwane interakcje:**
    -   Zmiana wartości w dowolnym polu formularza.
-   **Obsługiwana walidacja:** Brak.
-   **Typy:** `RecipesFiltersViewModel`, `CategoryDto`, `TagDto`.
-   **Propsy:**
    -   `initialFilters: RecipesFiltersViewModel` - początkowy stan filtrów.
    -   `categories: CategoryDto[]` - lista dostępnych kategorii.
    -   `tags: TagDto[]` - lista dostępnych tagów (do autouzupełniania).
-   **Zdarzenia:**
    -   `(filtersChange): RecipesFiltersViewModel` - emitowane przy każdej zmianie wartości.

### pych-recipe-list

-   **Opis komponentu:** Odpowiada za wyświetlanie siatki przepisów lub komunikatu o stanie pustym. Obsługuje również wizualnie stan ładowania.
-   **Główne elementy:**
    -   Kontener `div` z `*ngIf` do warunkowego wyświetlania.
    -   Pętla `@for` renderująca `pych-recipe-card` dla każdego przepisu.
    -   Komponent `pych-empty-state`, gdy lista jest pusta.
    -   Wizualny wskaźnik ładowania (np. nakładka z `mat-progress-spinner` lub szkielety kart).
-   **Obsługiwane interakcje:** Brak.
-   **Obsługiwana walidacja:** Brak.
-   **Typy:** `RecipeListItemDto`.
-   **Propsy:**
    -   `recipes: RecipeListItemDto[]` - lista przepisów do wyświetlenia.
    -   `isLoading: boolean` - flaga informująca o stanie ładowania.

### pych-recipe-card

-   **Opis komponentu:** Reużywalny komponent-karta, wyświetlający skrócone informacje o pojedynczym przepisie i służący jako link do jego szczegółów.
-   **Główne elementy:**
    -   `mat-card` jako główny kontener.
    -   Element `img` (`mat-card-image`) na zdjęcie przepisu.
    -   `mat-card-title` na nazwę przepisu.
    -   Cała karta opakowana w tag `<a>` z atrybutem `routerLink`.
-   **Obsługiwane interakcje:** Kliknięcie na kartę.
-   **Obsługiwana walidacja:** Brak.
-   **Typy:** `RecipeListItemDto`.
-   **Propsy:**
    -   `recipe: RecipeListItemDto` - obiekt przepisu do wyświetlenia.

## 5. Typy

Do implementacji widoku, oprócz istniejących DTO, potrzebny będzie nowy ViewModel do zarządzania stanem formularza filtrów.

-   **`RecipesFiltersViewModel`**: Obiekt przechowujący kompletny stan kontrolek filtrowania, co ułatwia zarządzanie i przekazywanie danych.
    -   `searchQuery: string | null` - fraza wpisana w polu wyszukiwania.
    -   `categoryId: number | null` - ID wybranej kategorii.
    -   `tags: string[]` - tablica nazw wybranych tagów.
    -   `sortBy: 'name' | 'created_at'` - pole, po którym odbywa się sortowanie.
    -   `sortDirection: 'asc' | 'desc'` - kierunek sortowania.

## 6. Zarządzanie stanem

Stan widoku będzie zarządzany w `RecipesPageComponent` przy użyciu **Angular Signals** w celu zapewnienia reaktywności i czytelności przepływu danych.

-   **Źródła stanu (Writable Signals):**
    -   `filters$: WritableSignal<RecipesFiltersViewModel>`: Przechowuje aktualny stan wszystkich kontrolek z `RecipesFiltersComponent`.
    -   `pagination$: WritableSignal<{ page: number, limit: number }>`: Przechowuje stan paginatora.

-   **Stan pochodny (Computed Signals):**
    -   `queryParams$: Signal<ApiParams>`: Sygnał obliczeniowy, który na podstawie `filters$` i `pagination$` tworzy obiekt parametrów gotowy do wysłania w zapytaniu HTTP.
    -   `result$: Signal<PaginatedResponseDto<RecipeListItemDto>>`: Przechowuje ostatnią pomyślną odpowiedź z API.
    -   `recipes$: Signal<RecipeListItemDto[]>`: Obliczeniowy sygnał wyciągający listę przepisów z `result$`.
    -   `isLoading$: Signal<boolean>`: Sygnał informujący o tym, czy zapytanie do API jest w toku.
    -   `isEmpty$: Signal<boolean>`: Sygnał obliczeniowy sprawdzający, czy lista przepisów jest pusta (`!isLoading() && recipes().length === 0`).

-   **Efekty (`effect`):**
    -   Główny `effect` będzie obserwował zmiany w `queryParams$`. Każda zmiana w tym sygnale (spowodowana interakcją użytkownika z filtrami lub paginacją) automatycznie uruchomi nowe zapytanie do API w celu pobrania zaktualizowanej listy przepisów.

## 7. Integracja API

Integracja z backendem będzie realizowana poprzez dedykowany `RecipesService`.

-   **Główne zapytanie:**
    -   **Endpoint:** `GET /recipes`
    -   **Serwis:** `RecipesService.getRecipes(params)`
    -   **Parametry (Request):** Obiekt dynamicznie budowany na podstawie sygnału `queryParams$`, zawierający: `page`, `limit`, `sort`, `filter[category_id]`, `filter[tags]`, `search`.
    -   **Odpowiedź (Response):** `PaginatedResponseDto<RecipeListItemDto>`
-   **Zapytania pomocnicze (do wypełnienia filtrów):**
    -   `GET /categories`: Pobranie listy kategorii.
    -   `GET /tags`: Pobranie listy tagów użytkownika.
    -   Powyższe zapytania będą wywoływane jednorazowo przy inicjalizacji `RecipesPageComponent`.

## 8. Interakcje użytkownika

-   **Wpisywanie w polu wyszukiwania:** Aktualizuje `filters$.searchQuery`. Efekt, z zastosowaniem `debounce` (np. 300ms), wywoła API.
-   **Wybór opcji sortowania/kategorii:** Aktualizuje odpowiednie pole w `filters$`. Efekt natychmiast wywoła API.
-   **Dodanie/usunięcie tagu:** Aktualizuje tablicę `filters$.tags`. Efekt natychmiast wywoła API.
-   **Zmiana strony w paginatorze:** Aktualizuje `pagination$`. Efekt natychmiast wywoła API.
-   **Kliknięcie w kartę przepisu:** Nawigacja do `/recipes/{id}` za pomocą `routerLink`.
-   **Kliknięcie w przycisk na "stanie pustym":** Nawigacja do `/recipes/new`.

## 9. Warunki i walidacja

W tym widoku nie występuje walidacja formularzy. Logika komponentów musi jednak zapewnić, że parametry wysyłane do API są w poprawnym formacie, np. poprzez konwersję tablicy tagów `['a', 'b']` na string `"a,b"`.

## 10. Obsługa błędów

-   **Błąd pobierania danych (np. błąd serwera 500):**
    -   Serwis API powinien przechwycić błąd i zwrócić go w postaci `ApiError`.
    -   `RecipesPageComponent` zaktualizuje sygnał `error$`.
    -   Interfejs użytkownika wyświetli globalny komunikat o błędzie (np. za pomocą `MatSnackBar`) z informacją "Nie udało się pobrać przepisów. Spróbuj ponownie później."
    -   Stan ładowania (`isLoading$`) zostanie ustawiony na `false`, aby uniknąć "zawieszenia" interfejsu.
-   **Błąd 401 Unauthorized:**
    -   Błąd ten powinien być globalnie obsługiwany przez `HttpInterceptor`, który przekieruje użytkownika na stronę logowania.

## 11. Kroki implementacji

1.  **Struktura plików:** Utworzenie folderu `src/app/pages/recipes-page/` z podfolderami `components`.
2.  **Komponenty szkieletowe:** Wygenerowanie za pomocą Angular CLI wszystkich wymaganych komponentów (`RecipesPageComponent`, `RecipesFiltersComponent`, `RecipeListComponent`, `RecipeCardComponent`) jako `standalone`.
3.  **Routing:** Dodanie ścieżki `/recipes` w `app.routes.ts` wskazującej na `RecipesPageComponent` i zabezpieczenie jej `AuthGuard`.
4.  **`RecipesPageComponent` (logika):**
    -   Zainicjowanie wszystkich sygnałów do zarządzania stanem (`filters$`, `pagination$`, etc.).
    -   Implementacja logiki w `effect`, który będzie wywoływał serwis API na podstawie zmian w `queryParams$`.
    -   Pobranie kategorii i tagów w `ngOnInit` w celu przekazania ich do komponentu filtrów.
5.  **`RecipesFiltersComponent` (UI):**
    -   Zbudowanie formularza przy użyciu komponentów Angular Material (`mat-form-field`, `mat-select`, `mat-chip-grid`).
    -   Podpięcie `(input)`, `(selectionChange)` i innych zdarzeń do metod, które aktualizują stan i emitują zdarzenie `(filtersChange)`.
6.  **`RecipeListComponent` i `RecipeCardComponent` (UI):**
    -   Implementacja siatki przepisów przy użyciu CSS Grid lub Flexbox.
    -   Stworzenie wyglądu karty przepisu (`mat-card`) i dodanie `routerLink`.
    -   Implementacja warunkowego wyświetlania listy, stanu ładowania oraz `EmptyStateComponent`.
7.  **Serwisy i Typy:**
    -   Zdefiniowanie typu `RecipesFiltersViewModel`.
    -   Implementacja metody `getRecipes(params)` w `RecipesService`, która dynamicznie buduje parametry HTTP.
8.  **Stylowanie i Responsywność:**
    -   Dostosowanie stylów komponentów, aby zapewnić spójność z resztą aplikacji.
    -   Zaimplementowanie media queries, aby siatka i panel filtrów poprawnie wyświetlały się na urządzeniach mobilnych.
9.  **Testowanie:**
    -   Sprawdzenie wszystkich interakcji użytkownika (wyszukiwanie, filtrowanie, sortowanie, paginacja).
    -   Weryfikacja poprawnego działania stanu pustego i stanu ładowania.
    -   Testowanie obsługi błędów API.
