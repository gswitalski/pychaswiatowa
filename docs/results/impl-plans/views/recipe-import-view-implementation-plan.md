# Plan implementacji widoku Importu Przepisu

## 1. Przegląd

Celem tego widoku jest umożliwienie użytkownikom szybkiego dodawania nowych przepisów do aplikacji poprzez wklejenie tekstu w ustandaryzowanym formacie Markdown. Po stronie serwera tekst jest parsowany, a w przypadku sukcesu użytkownik jest przekierowywany do formularza edycji nowo utworzonego przepisu w celu dodania dodatkowych informacji, takich jak zdjęcie, kategoria czy tagi. Widok ten ma na celu zminimalizowanie czasu potrzebnego na ręczne wprowadzanie danych i usprawnienie procesu dodawania przepisów.

## 2. Routing widoku

Widok będzie dostępny pod chronioną ścieżką, dostępną tylko dla zalogowanych użytkowników:
-   **Ścieżka:** `/recipes/import`
-   **Ochrona:** Dostęp będzie chroniony przez `AuthGuard`.

## 3. Struktura komponentów

Struktura widoku będzie prosta i skupiona na jednym, głównym komponencie, zgodnie z zasadami implementacji samodzielnych komponentów w Angular.

```
- AppRouting
  - /recipes
    - /import -> RecipeImportPageComponent
      - mat-card
        - h2 (Tytuł: "Importuj przepis")
        - p (Instrukcje formatowania)
        - form [formGroup]
          - mat-form-field
            - textarea [formControlName="rawText"]
          - div (Komunikat błędu API)
          - button [type="submit"] (Przycisk "Importuj i edytuj")
```

## 4. Szczegóły komponentów

### `RecipeImportPageComponent`

-   **Opis komponentu:** Jest to główny komponent widoku, odpowiedzialny za wyświetlanie formularza importu, zarządzanie jego stanem, komunikację z API oraz obsługę nawigacji i błędów. Komponent będzie zawierał kartę (`mat-card`) z tytułem, krótką instrukcją dla użytkownika, polem tekstowym (`textarea`) na treść przepisu oraz przyciskiem do wysłania formularza.
-   **Główne elementy:**
    -   `mat-card`: Główny kontener widoku.
    -   `<h2>`: Tytuł widoku, np. "Importuj przepis z tekstu".
    -   `<p>`: Instrukcja dla użytkownika wyjaśniająca oczekiwany format Markdown.
    -   `<form [formGroup]="form">`: Formularz reaktywny Angulara.
    -   `mat-form-field` z `textarea`: Pole do wklejenia treści przepisu.
    -   `mat-error`: Do wyświetlania błędów walidacji formularza (np. pole jest wymagane).
    -   `div` z dyrektywą `@if`: Do warunkowego wyświetlania błędów zwróconych przez API.
    -   `button mat-raised-button`: Przycisk do zatwierdzenia formularza.
-   **Obsługiwane interakcje:**
    -   Wprowadzanie tekstu w `textarea`.
    -   Kliknięcie przycisku "Importuj i edytuj", co uruchamia proces walidacji i wysłania danych do API.
-   **Obsługiwana walidacja:**
    -   Pole `rawText` jest wymagane (`Validators.required`). Przycisk wysyłania będzie nieaktywny, dopóki pole nie zostanie wypełnione.
-   **Typy:**
    -   `RecipeImportFormViewModel`
    -   `RecipeImportState`
    -   `ImportRecipeCommand` (DTO)
    -   `RecipeDetailDto` (DTO)
-   **Propsy:** Komponent nie przyjmuje żadnych właściwości (`@Input`), ponieważ jest komponentem routowalnym (stroną).

## 5. Typy

Do implementacji widoku potrzebne będą następujące, nowe typy:

-   **`RecipeImportFormViewModel`**: Definiuje strukturę formularza reaktywnego.
    ```typescript
    import { FormControl } from '@angular/forms';

    export interface RecipeImportFormViewModel {
        rawText: FormControl<string | null>;
    }
    ```
-   **`RecipeImportState`**: Opisuje lokalny stan komponentu, zarządzany za pomocą sygnału (`signal`).
    ```typescript
    import { ApiError } from 'shared/contracts/types';

    export interface RecipeImportState {
        pending: boolean; // Flaga informująca o trwającym wywołaniu API
        error: ApiError | null; // Obiekt błędu zwrócony przez API
    }
    ```

Dodatkowo, wykorzystane zostaną istniejące typy DTO z `shared/contracts/types.ts`:
-   `ImportRecipeCommand`
-   `RecipeDetailDto`

## 6. Zarządzanie stanem

Stan będzie zarządzany lokalnie w `RecipeImportPageComponent` przy użyciu sygnałów (`signals`) w celu śledzenia statusu operacji asynchronicznej.

-   **Sygnał stanu:** `state = signal<RecipeImportState>({ pending: false, error: null });`
    -   `pending`: Ustawiane na `true` przed wysłaniem żądania do API i na `false` po otrzymaniu odpowiedzi. Będzie wykorzystywane do blokowania przycisku i ewentualnego wyświetlania wskaźnika ładowania.
    -   `error`: Przechowuje obiekt błędu zwrócony z API. Jego wartość będzie wyświetlana w interfejsie użytkownika. Będzie resetowany do `null` przy ponownej próbie wysłania formularza.
-   **Stan formularza:** Zarządzany przez `ReactiveFormsModule` (`FormGroup`).

## 7. Integracja API

Integracja z backendem będzie realizowana poprzez serwis `RecipesApiService`, do którego zostanie dodana nowa metoda.

-   **Nowa metoda w `RecipesApiService`:**
    ```typescript
    importRecipe(command: ImportRecipeCommand): Observable<RecipeDetailDto> {
      return this.http.post<RecipeDetailDto>('/api/recipes/import', command);
    }
    ```
-   **Typ żądania:** `POST` na `/api/recipes/import`
-   **Payload żądania (Request):** Obiekt typu `ImportRecipeCommand`, np. `{ "raw_text": "# Mój przepis..." }`.
-   **Payload odpowiedzi (Response):** W przypadku sukcesu (201 Created), serwer zwróci obiekt typu `RecipeDetailDto`, który zawiera `id` nowo utworzonego przepisu.

## 8. Interakcje użytkownika

1.  Użytkownik wchodzi na stronę `/recipes/import`.
2.  Widzi formularz z polem tekstowym i przyciskiem "Importuj i edytuj", który jest początkowo nieaktywny.
3.  Użytkownik wkleja tekst przepisu do pola tekstowego. Przycisk staje się aktywny.
4.  Użytkownik klika przycisk "Importuj i edytuj".
    -   Przycisk staje się nieaktywny, a stan `pending` jest ustawiany na `true`.
    -   Wszelkie poprzednie komunikaty o błędach są czyszczone.
    -   Wysyłane jest żądanie `POST` do API.
5.  **Scenariusz sukcesu:**
    -   API odpowiada statusem `201 Created` i zwraca dane nowego przepisu.
    -   Aplikacja odczytuje `id` z odpowiedzi i przekierowuje użytkownika na stronę edycji: `/recipes/{id}/edit`.
6.  **Scenariusz błędu:**
    -   API odpowiada statusem `400 Bad Request` z komunikatem błędu.
    -   Stan `pending` jest ustawiany na `false`, a przycisk znów jest aktywny.
    -   Komunikat błędu z odpowiedzi API jest wyświetlany pod formularzem.

## 9. Warunki i walidacja

-   **Poziom komponentu (Frontend):**
    -   **Warunek:** Pole tekstowe (`rawText`) nie może być puste.
    -   **Walidacja:** Użycie `Validators.required` w definicji `FormControl`.
    -   **Wpływ na interfejs:** Przycisk "Importuj i edytuj" ma atrybut `[disabled]`, który jest powiązany ze stanem formularza (`form.invalid`) oraz flagą `state().pending`.
-   **Poziom API (Backend):**
    -   **Warunek:** Tekst musi być w poprawnym formacie Markdown.
    -   **Walidacja:** Wykonywana po stronie serwera.
    -   **Wpływ na interfejs:** W przypadku błędu walidacji, API zwraca błąd `400`, który jest przechwytywany i wyświetlany użytkownikowi.

## 10. Obsługa błędów

-   **Błędy walidacji formularza:** Obsługiwane standardowo przez `ReactiveFormsModule` i wyświetlane za pomocą komponentu `mat-error`.
-   **Błędy API (np. 400 - zły format tekstu):** Odpowiedź błędu będzie przechwytywana w bloku `error` subskrypcji `Observable`. Komunikat błędu (`error.message`) zostanie zapisany w sygnale `state`, co spowoduje jego wyświetlenie w szablonie HTML.
-   **Błędy sieciowe / serwera (5xx):** Będą obsługiwane globalnie przez `HttpInterceptor`. Interceptor powinien wyświetlać ogólny komunikat błędu (np. za pomocą `MatSnackBar`), a stan `pending` w komponencie zostanie zresetowany na `false`.
-   **Błąd autoryzacji (401):** Również obsługiwany przez globalny `HttpInterceptor`, który powinien przekierować użytkownika na stronę logowania.

## 11. Kroki implementacji

1.  **Aktualizacja Routingu:** Dodać nową ścieżkę `/recipes/import` w pliku `app.routes.ts` (lub odpowiednim module routingu), która będzie ładować `RecipeImportPageComponent` i będzie chroniona przez `AuthGuard`.
2.  **Utworzenie komponentu:** Wygenerować nowy, samodzielny komponent `RecipeImportPageComponent` za pomocą Angular CLI w katalogu `src/app/pages/recipe-import/`.
3.  **Definicja typów:** W pliku `recipe-import-page.component.ts` zdefiniować interfejsy `RecipeImportFormViewModel` i `RecipeImportState`.
4.  **Implementacja szablonu HTML:** Zbudować szablon komponentu (`recipe-import-page.component.html`) używając komponentów Angular Material (`mat-card`, `mat-form-field`, `mat-button`) i powiązać go z modelem formularza.
5.  **Implementacja logiki komponentu:**
    -   W pliku `.ts` użyć `inject` do wstrzyknięcia `FormBuilder`, `RecipesApiService` i `Router`.
    -   Zainicjować formularz reaktywny (`FormGroup`) oraz sygnał stanu (`signal`).
    -   Zaimplementować metodę `submit()`, która będzie wywoływana po wysłaniu formularza.
    -   W metodzie `submit()` zaimplementować logikę wywołania API, obsługę sukcesu (przekierowanie) i błędu (aktualizacja sygnału stanu).
6.  **Aktualizacja serwisu API:** Dodać metodę `importRecipe` w `RecipesApiService`.
7.  **Dodanie stylów:** Opcjonalnie dodać style w pliku `recipe-import-page.component.scss`, aby zapewnić odpowiednie marginesy i układ.
8.  **Testy:** Napisać podstawowe testy jednostkowe dla `RecipeImportPageComponent`, sprawdzające inicjalizację formularza, walidację oraz mockowanie wywołania API i jego rezultatów (przekierowanie lub wyświetlenie błędu).
