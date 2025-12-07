# Plan implementacji widoku: Szczegóły Kolekcji

## 1. Przegląd

Widok "Szczegóły Kolekcji" ma na celu wyświetlenie użytkownikowi nazwy, opisu oraz listy przepisów przypisanych do wybranej kolekcji. Umożliwia on również usuwanie przepisów z danej kolekcji. Widok ten jest kluczowym elementem funkcjonalności zarządzania kolekcjami, pozwalając na przeglądanie tematycznych zbiorów przepisów.

## 2. Routing widoku

Widok będzie dostępny pod następującą ścieżką z dynamicznym parametrem `id` kolekcji:
-   **Ścieżka:** `/collections/:id`

## 3. Struktura komponentów

Hierarchia komponentów dla tego widoku będzie następująca:

```
CollectionDetailsPageComponent
|
+-- CollectionHeaderComponent
|
+-- RecipeListComponent (Komponent współdzielony)
    |
    +-- RecipeCardComponent (Komponent współdzielony, powtarzany dla każdego przepisu)
    |
    +-- MatPaginatorComponent (Komponent Angular Material)
```

## 4. Szczegóły komponentów

### `CollectionDetailsPageComponent` (Komponent-strona)

-   **Opis komponentu**: Główny kontener widoku. Odpowiada za pobranie `id` kolekcji z parametrów URL, komunikację z API w celu pobrania danych kolekcji i listy przepisów, zarządzanie stanem (ładowanie, błędy, paginacja) oraz obsługę akcji usuwania przepisu z kolekcji.
-   **Główne elementy**: Komponent będzie renderował `CollectionHeaderComponent` oraz `RecipeListComponent`, przekazując do nich odpowiednie dane. Będzie również zawierał logikę do wyświetlania wskaźników ładowania lub komunikatów o błędach.
-   **Obsługiwane zdarzenia**:
    -   `onPageChange(event: PageEvent)`: Uruchamiane przez paginator; powoduje pobranie nowej strony przepisów.
    -   `onRemoveRecipe(recipeId: number)`: Uruchamiane przez `RecipeListComponent`; inicjuje proces usuwania przepisu z kolekcji.
-   **Warunki walidacji**: Brak walidacji po stronie klienta. Komponent musi obsługiwać błędy API (np. 404, gdy kolekcja nie istnieje).
-   **Typy**: `CollectionDetailsViewModel`.

### `CollectionHeaderComponent` (Komponent prezentacyjny)

-   **Opis komponentu**: Prosty komponent odpowiedzialny wyłącznie za wyświetlanie nazwy i opisu kolekcji.
-   **Główne elementy**: Nagłówek `<h1>` lub `<h2>` na nazwę kolekcji oraz paragraf `<p>` na jej opis.
-   **Obsługiwane zdarzenia**: Brak.
-   **Warunki walidacji**: Brak.
-   **Typy**: `CollectionDetailsViewModel`.
-   **Propsy**:
    -   `@Input() collectionData: Pick<CollectionDetailsViewModel, 'name' | 'description'>`

### `RecipeListComponent` (Komponent współdzielony, prezentacyjny)

-   **Opis komponentu**: Współdzielony komponent do wyświetlania siatki przepisów. Musi zostać dostosowany, aby opcjonalnie renderować przycisk "Usuń z kolekcji" na każdej karcie przepisu.
-   **Główne elementy**: Pętla `@for` renderująca `RecipeCardComponent` dla każdego przepisu, `mat-paginator` do obsługi paginacji.
-   **Obsługiwane zdarzenia**:
    -   `@Output() pageChange: EventEmitter<PageEvent>`: Emituje zmianę strony.
    -   `@Output() removeRecipe: EventEmitter<number>`: Emituje ID przepisu do usunięcia.
-   **Warunki walidacji**: Brak.
-   **Typy**: `RecipeListItemDto[]`, `PaginationDetails`.
-   **Propsy**:
    -   `@Input() recipes: RecipeListItemDto[]`
    -   `@Input() pagination: PaginationDetails`
    -   `@Input() isLoading: boolean`
    -   `@Input() showRemoveAction: boolean`

### `RecipeCardComponent` (Komponent współdzielony, prezentacyjny)

-   **Opis komponentu**: Wyświetla pojedynczą kartę przepisu z obrazkiem i nazwą. Zostanie rozszerzony o menu z akcją "Usuń z kolekcji".
-   **Główne elementy**: `mat-card`, `img` dla obrazka, `mat-card-title` dla nazwy, `mat-menu` dla dodatkowych akcji.
-   **Obsługiwane zdarzenia**:
    -   `@Output() remove: EventEmitter<void>`: Emituje zdarzenie po kliknięciu opcji usunięcia.
-   **Warunki walidacji**: Brak.
-   **Typy**: `RecipeListItemDto`.
-   **Propsy**:
    -   `@Input() recipe: RecipeListItemDto`
    -   `@Input() showRemoveAction: boolean`

## 5. Typy

### `CollectionDetailsViewModel`

Główny model widoku, reprezentujący cały stan strony.

```typescript
interface CollectionDetailsViewModel {
    id: number;
    name: string;
    description: string | null;
    recipes: RecipeListItemDto[];
    pagination: PaginationDetails;
    isLoading: boolean;
    error: string | null;
}
```

-   `id`: ID aktualnej kolekcji.
-   `name`: Nazwa kolekcji.
-   `description`: Opis kolekcji.
-   `recipes`: Lista przepisów dla bieżącej strony.
-   `pagination`: Obiekt z informacjami o paginacji (`currentPage`, `totalPages`, `totalItems`).
-   `isLoading`: Flaga informująca o stanie ładowania danych.
-   `error`: Komunikat błędu do wyświetlenia w UI.

**Uwaga**: Zakłada się, że endpoint API `GET /collections/{id}` zwraca w ramach listy przepisów obiekty typu `RecipeListItemDto` (zawierające `id`, `name`, `image_path`), a nie `RecipeInCollectionDto`, aby umożliwić ponowne wykorzystanie `RecipeCardComponent`.

## 6. Zarządzanie stanem

Zarządzanie stanem odbędzie się lokalnie w `CollectionDetailsPageComponent` przy użyciu Angular Signals.

-   `state`: Główny sygnał (`signal`) przechowujący obiekt `CollectionDetailsViewModel`.
-   `collectionId`: Sygnał przechowujący ID z URL.
-   `currentPage`: Sygnał śledzący aktualny numer strony.
-   `effect`: Efekt będzie obserwował zmiany `collectionId` i `currentPage`, a następnie wywoływał serwis API w celu pobrania aktualnych danych i aktualizacji sygnału `state`.

## 7. Integracja API

### Pobieranie danych kolekcji
-   **Endpoint**: `GET /collections/{id}`
-   **Parametry zapytania**: `page`, `limit`
-   **Typ odpowiedzi (DTO)**: `CollectionDetailDto`
-   **Akcja**: Wywoływane przy inicjalizacji komponentu i przy każdej zmianie strony. Odpowiedź z API jest mapowana na `CollectionDetailsViewModel` i zapisywana w stanie komponentu.

### Usuwanie przepisu z kolekcji
-   **Endpoint**: `DELETE /collections/{collectionId}/recipes/{recipeId}`
-   **Typ odpowiedzi**: `204 No Content`
-   **Akcja**: Wywoływane po potwierdzeniu przez użytkownika chęci usunięcia przepisu. Po pomyślnym usunięciu, dane dla bieżącej strony są odświeżane przez ponowne wywołanie `GET /collections/{id}`.

## 8. Interakcje użytkownika

-   **Wejście na stronę**: Użytkownik wchodzi na stronę, widzi wskaźnik ładowania, a następnie nagłówek kolekcji i pierwszą stronę przepisów.
-   **Zmiana strony**: Użytkownik klika na przycisk następnej/poprzedniej strony w paginatorze. Lista przepisów jest przykrywana wskaźnikiem ładowania i aktualizowana o nowe dane.
-   **Usuwanie przepisu**: Użytkownik klika na menu akcji na karcie przepisu i wybiera "Usuń z kolekcji". Pojawia się modal z prośbą o potwierdzenie. Po potwierdzeniu, przepis znika z listy, a użytkownik otrzymuje powiadomienie o sukcesie.

## 9. Warunki i walidacja

W tym widoku nie występuje walidacja formularzy. Logika komponentu musi jednak poprawnie obsługiwać stany pochodzące z API:
-   Wyświetlanie wskaźnika ładowania (`isLoading: true`).
-   Wyświetlanie komunikatu o błędzie, jeśli API zwróci błąd (`error != null`).
-   Wyświetlanie komponentu "stanu pustego", jeśli kolekcja nie zawiera żadnych przepisów (`recipes.length === 0`).

## 10. Obsługa błędów

-   **Kolekcja nie znaleziona (404 Not Found)**: Jeśli API zwróci 404, komponent wyświetli komunikat "Nie znaleziono kolekcji" zamiast danych.
-   **Brak autoryzacji (401 Unauthorized)**: Globalny `HttpInterceptor` powinien przechwycić ten błąd i przekierować użytkownika do strony logowania.
-   **Błędy serwera (5xx)**: Komponent wyświetli ogólny komunikat o błędzie, np. "Wystąpił błąd. Spróbuj ponownie później."
-   **Błąd usunięcia przepisu**: Jeśli operacja `DELETE` się nie powiedzie, użytkownik zobaczy powiadomienie (np. `MatSnackBar`) z informacją o błędzie, a przepis pozostanie na liście.

## 11. Kroki implementacji

1.  **Modyfikacja komponentów współdzielonych**:
    -   W `RecipeCardComponent` dodać `@Input() showRemoveAction: boolean` i warunkowe (`@if`) renderowanie menu (`mat-menu`) z opcją "Usuń z kolekcji". Dodać `@Output() remove`.
    -   W `RecipeListComponent` dodać `@Input() showRemoveAction: boolean` i przekazać go do `RecipeCardComponent`. Dodać `@Output() removeRecipe` i obsłużyć propagację zdarzenia `remove` z karty.
2.  **Stworzenie nowych komponentów**:
    -   Wygenerować `CollectionDetailsPageComponent` (`ng g c pages/collections/collection-details --standalone`).
    -   Wygenerować `CollectionHeaderComponent` (`ng g c pages/collections/collection-details/components/collection-header --standalone`).
3.  **Implementacja `CollectionDetailsPageComponent`**:
    -   Wstrzyknąć `ActivatedRoute` i serwis API.
    -   Utworzyć sygnały do zarządzania stanem (`state`, `currentPage`, `collectionId`).
    -   Zaimplementować logikę pobierania danych w oparciu o `effect`.
    -   Dodać metody do obsługi zmiany strony i usuwania przepisu.
    -   Stworzyć szablon HTML, który będzie renderował `CollectionHeaderComponent` i `RecipeListComponent` oraz obsługiwał stany ładowania i błędów.
4.  **Implementacja `CollectionHeaderComponent`**:
    -   Dodać `@Input()` do przyjmowania danych kolekcji.
    -   Zaimplementować prosty szablon HTML do wyświetlania nazwy i opisu.
5.  **Routing**:
    -   W głównym pliku routingowym dodać ścieżkę `/collections/:id`, która będzie leniwie ładować `CollectionDetailsPageComponent`.
6.  **Serwis API**:
    -   Rozszerzyć istniejący `CollectionApiService` o metody `getCollectionDetails(id: number, page: number, limit: number)` oraz `removeRecipeFromCollection(collectionId: number, recipeId: number)`.
7.  **Testowanie**:
    -   Manualne przetestowanie wszystkich interakcji użytkownika i obsługi błędów.
