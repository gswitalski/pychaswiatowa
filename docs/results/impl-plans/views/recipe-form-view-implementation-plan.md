# Plan implementacji widoku: Formularz Przepisu (Dodaj/Edytuj)

## 1. Przegląd

Celem tego widoku jest umożliwienie użytkownikom tworzenia nowych przepisów oraz edytowania już istniejących. Widok będzie zawierał rozbudowany formularz, podzielony na logiczne sekcje: podstawowe informacje (nazwa, opis), zdjęcie, kategoryzację (kategoria, tagi) oraz dynamiczne listy składników i kroków. Formularz będzie dostępny w dwóch trybach: "tworzenia" (`/recipes/new`) i "edycji" (`/recipes/:id/edit`), automatycznie dostosowując swoje działanie w zależności od kontekstu. Zapewni on walidację danych wejściowych i płynną interakcję, w tym możliwość reorganizacji list za pomocą mechanizmu "przeciągnij i upuść".

## 2. Routing widoku

Widok będzie dostępny pod następującymi ścieżkami w module `recipes`:

-   **Tworzenie nowego przepisu:** `/recipes/new`
-   **Edycja istniejącego przepisu:** `/recipes/:id/edit`

Widok będzie chroniony przez `AuthGuard`, zapewniając dostęp tylko zalogowanym użytkownikom.

## 3. Struktura komponentów

Struktura będzie opierać się na podejściu "smart component" (strona) i "dumb components" (komponenty UI), co zapewni reużywalność i przejrzystość.

```
RecipeFormPageComponent (Smart Component)
│
├── RecipeBasicInfoFormComponent (Dumb Component)
│
├── RecipeImageUploadComponent (Dumb Component)
│
├── RecipeCategorizationFormComponent (Dumb Component)
│
└── EditableListComponent (Dumb, Reusable Component)
    - Użyty dwukrotnie: dla składników i kroków
```

## 4. Szczegóły komponentów

### `RecipeFormPageComponent`

-   **Opis komponentu:** Główny komponent strony, orkiestrujący cały formularz. Odpowiada za:
    -   Rozróżnienie trybu "tworzenia" i "edycji" na podstawie URL.
    -   Pobranie danych przepisu i kategorii z API w trybie edycji.
    -   Inicjalizację głównego `FormGroup` (`RecipeFormViewModel`).
    -   Obsługę zdarzenia wysłania formularza, agregację danych, komunikację z API (`POST/PUT /recipes`).
    -   Nawigację po pomyślnym zapisie lub anulowaniu.
    -   Zarządzanie stanem ładowania i błędów.
-   **Główne elementy HTML:** Komponent będzie używał `mat-card` lub podobnego kontenera do grupowania sekcji. Będzie zawierał przyciski "Zapisz" i "Anuluj" oraz spinner (`mat-progress-spinner`) do sygnalizacji stanu ładowania. Osadzi w sobie pozostałe komponenty formularza.
-   **Obsługiwane zdarzenia:** `ngSubmit` na formularzu, `(click)` na przyciskach.
-   **Warunki walidacji:** Deleguje walidację do `FormGroup`. Sprawdza ogólną ważność formularza (`form.valid`) przed wysłaniem.
-   **Typy:** `RecipeFormViewModel`, `RecipeDetailDto`, `CategoryDto`, `CreateRecipeCommand`, `UpdateRecipeCommand`.
-   **Propsy:** Brak, komponent jest zarządzany przez router.

### `RecipeBasicInfoFormComponent`

-   **Opis komponentu:** Odpowiada za pola tekstowe: nazwa i opis przepisu.
-   **Główne elementy HTML:** `mat-form-field` z `mat-label` i `mat-input` dla nazwy (`<input>`) i opisu (`<textarea>`). Wyświetla błędy walidacji za pomocą `mat-error`.
-   **Obsługiwane zdarzenia:** `(input)` - aktualizuje `FormControl`.
-   **Warunki walidacji:**
    -   `name`: `Validators.required`, `Validators.maxLength(150)`.
-   **Typy:** `FormGroup` (fragment `RecipeFormViewModel`).
-   **Propsy:** `[formGroup]: FormGroup` - przyjmuje część głównego formularza.

### `RecipeImageUploadComponent`

-   **Opis komponentu:** Umożliwia użytkownikowi przesłanie, podgląd i usunięcie zdjęcia przepisu.
-   **Główne elementy HTML:** Przycisk (`mat-button`) do otwarcia okna wyboru pliku (`<input type="file">`), kontener na podgląd obrazu (`<img>`), przycisk do usunięcia wybranego zdjęcia.
-   **Obsługiwane zdarzenia:** `(change)` na `input file`, `(click)` na przycisku usuwania. Emituje zdarzenie `(imageChange)` z obiektem `File` lub `null`.
-   **Warunki walidacji:** Opcjonalna walidacja typu pliku (np. `image/jpeg`, `image/png`) i rozmiaru.
-   **Typy:** `File`.
-   **Propsy:** `[currentImageUrl]: string | null` - do wyświetlenia istniejącego obrazu w trybie edycji.

### `RecipeCategorizationFormComponent`

-   **Opis komponentu:** Odpowiada za przypisanie kategorii i tagów.
-   **Główne elementy HTML:**
    -   `mat-form-field` z `mat-select` do wyboru kategorii.
    -   `mat-form-field` z `mat-chip-grid` i `<input>` do dynamicznego dodawania i usuwania tagów.
-   **Obsługiwane zdarzenia:** `(selectionChange)` na `mat-select`, `(matChipInputTokenEnd)` na inpucie tagów, `(removed)` na `mat-chip`.
-   **Warunki walidacji:** Brak (pola opcjonalne).
-   **Typy:** `FormGroup` (fragment `RecipeFormViewModel`), `CategoryDto[]`.
-   **Propsy:** `[formGroup]: FormGroup`, `[categories]: CategoryDto[]`.

### `EditableListComponent`

-   **Opis komponentu:** Reużywalny komponent do zarządzania listą edytowalnych tekstów (składników lub kroków). Wspiera dodawanie, usuwanie, edycję "in-line" oraz zmianę kolejności metodą "przeciągnij i upuść" (CDK Drag and Drop).
-   **Główne elementy HTML:** Kontener `cdkDropList`, pętla `@for` po elementach listy, gdzie każdy element to `cdkDrag`. Każdy element zawiera tekst i przyciski akcji (edytuj, usuń). Posiada również pole `textarea` na dole do dodawania nowych pozycji.
-   **Obsługiwane zdarzenia:** `(cdkDropListDropped)` do zmiany kolejności. `(click)` na przyciskach. `(input)` w polach edycji.
-   **Warunki walidacji:** `Validators.required` na `FormArray` (musi zawierać co najmniej jeden element).
-   **Typy:** `FormArray<FormControl<string>>`.
-   **Propsy:** `[formArray]: FormArray`, `[label]: string`, `[placeholder]: string`.

## 5. Typy

### `RecipeFormViewModel`

Główny model formularza, który będzie używany w `ReactiveFormsModule`.

```typescript
import { FormArray, FormControl, FormGroup } from '@angular/forms';

export interface RecipeFormViewModel {
    name: FormControl<string | null>;
    description: FormControl<string | null>;
    image: FormControl<File | null>;
    categoryId: FormControl<number | null>;
    tags: FormArray<FormControl<string>>;
    ingredients: FormArray<FormControl<string>>;
    steps: FormArray<FormControl<string>>;
}
```

-   `name`: Nazwa przepisu.
-   `description`: Opis przepisu.
-   `image`: Plik z obrazem (w trybie edycji początkowo `null`).
-   `categoryId`: ID wybranej kategorii.
-   `tags`: Dynamiczna lista tagów.
-   `ingredients`: Dynamiczna lista składników.
-   `steps`: Dynamiczna lista kroków.

## 6. Zarządzanie stanem

-   **Stan formularza:** Zarządzany lokalnie w `RecipeFormPageComponent` za pomocą `FormGroup` i `FormBuilder` z `@angular/forms`.
-   **Stan globalny (Kategorie):** Kategorie będą pobierane jednorazowo przez `CategoriesService` i przechowywane w nim (np. w `signal`), działając jako cache dla całej aplikacji. Komponent `RecipeFormPageComponent` będzie wstrzykiwał ten serwis i pobierał z niego listę kategorii, bez potrzeby bezpośredniego wywoływania API.
-   **Stan asynchroniczny (API):** Komponent `RecipeFormPageComponent` będzie zarządzał stanami `loading` i `error` (np. za pomocą `signal` lub prostej właściwości `boolean`) podczas komunikacji z API w celu pobrania/zapisu *przepisu*.
-   **Serwisy:** Zostaną wykorzystane serwisy `RecipesService` do operacji na przepisach oraz `CategoriesService` do zarządzania stanem kategorii.

## 7. Integracja API

-   **Pobieranie danych:**
    -   `GET /categories`: Wywoływane jednorazowo przez `CategoriesService`, np. przy pierwszym żądaniu. Komponent `RecipeFormPageComponent` pobiera te dane bezpośrednio z serwisu, a nie z API.
    -   `GET /recipes/:id`: Wywoływane tylko w trybie edycji. Zwraca `RecipeDetailDto`, które posłuży do wypełnienia `RecipeFormViewModel`.
-   **Wysyłanie danych:**
    -   `POST /recipes`: Wywoływane w trybie tworzenia. Dane z `RecipeFormViewModel` zostaną zmapowane na `CreateRecipeCommand`.
    -   `PUT /recipes/:id`: Wywoływane w trybie edycji. Dane z `RecipeFormViewModel` zostaną zmapowane na `UpdateRecipeCommand`.

**Mapowanie danych (`ViewModel` -> `Command`):**
Przed wysłaniem, dane z `ingredients` i `steps` (`FormArray<FormControl<string>>`) zostaną przekonwertowane na pojedyncze stringi (`ingredients_raw`, `steps_raw`) poprzez złączenie wartości `FormControl` znakiem nowej linii (`\n`).

## 8. Interakcje użytkownika

-   **Wprowadzanie tekstu:** Użytkownik wpisuje dane w pola `name`, `description`.
-   **Wybór kategorii:** Użytkownik wybiera kategorię z listy `mat-select`.
-   **Zarządzanie tagami:** Użytkownik wpisuje tag i zatwierdza go (np. Enter), co dodaje go do `mat-chip-grid`. Może usunąć tag, klikając ikonę na "pigułce".
-   **Przesyłanie zdjęcia:** Kliknięcie przycisku "Dodaj zdjęcie" otwiera natywne okno wyboru pliku. Wybrany obraz jest wyświetlany jako podgląd.
-   **Zarządzanie listami:**
    -   Dodawanie: Użytkownik wpisuje tekst w dedykowanym `textarea` i klika "Dodaj", co dodaje nowy element na koniec listy.
    -   Edycja: Kliknięcie ikony "edytuj" przy elemencie zamienia tekst w pole edytowalne.
    -   Usuwanie: Kliknięcie ikony "usuń" usuwa element z listy.
    -   Zmiana kolejności: Użytkownik przeciąga i upuszcza elementy na listach, aby zmienić ich kolejność.
-   **Zapis:** Kliknięcie "Zapisz" uruchamia walidację i proces wysyłania danych do API.
-   **Anulowanie:** Kliknięcie "Anuluj" powoduje powrót do poprzedniej strony bez zapisywania zmian.

## 9. Warunki i walidacja

-   **`name`:** Wymagane (`Validators.required`), maksymalna długość 150 znaków (`Validators.maxLength(150)`). Błąd wyświetlany pod polem input.
-   **`ingredients`:** Wymagane, aby lista zawierała co najmniej jeden element (`Validators.required` lub niestandardowy walidator na `FormArray`). Komunikat o błędzie wyświetlany pod listą.
-   **`steps`:** Wymagane, aby lista zawierała co najmniej jeden element. Komunikat o błędzie wyświetlany pod listą.
-   **Przycisk "Zapisz":** Jest nieaktywny (`disabled`), dopóki cały formularz (`RecipeFormViewModel`) nie przejdzie walidacji.

## 10. Obsługa błędów

-   **Błędy walidacji:** Komunikaty o błędach będą wyświetlane w czasie rzeczywistym pod odpowiednimi polami formularza, gdy tylko staną się "touched" lub "dirty".
-   **Błędy API:**
    -   W przypadku błędu serwera (np. 500) lub braku połączenia, pod formularzem zostanie wyświetlony ogólny komunikat o błędzie (np. przy użyciu `mat-error` lub dedykowanego komponentu `AlertComponent`).
    -   W przypadku błędu walidacji po stronie serwera (400), błędy zostaną (jeśli to możliwe) zmapowane na odpowiednie pola formularza (`form.get('fieldName')?.setErrors(...)`).
    -   W przypadku braku uprawnień (403) lub nieznalezienia zasobu (404) w trybie edycji, użytkownik zostanie przekierowany na stronę błędu lub listę przepisów z odpowiednim komunikatem.

## 11. Kroki implementacji

1.  **Aktualizacja `CategoriesService`:** Zaimplementowanie w serwisie `CategoriesService` logiki do jednorazowego pobierania i przechowywania listy kategorii. Serwis powinien udostępniać kategorie (np. jako `Signal<CategoryDto[]>`).
2.  **Stworzenie plików komponentów:** Wygenerowanie wszystkich pięciu komponentów (`RecipeFormPageComponent`, `RecipeBasicInfoFormComponent`, `RecipeImageUploadComponent`, `RecipeCategorizationFormComponent`, `EditableListComponent`) za pomocą Angular CLI z opcją `--standalone`.
3.  **Konfiguracja routingu:** Dodanie ścieżek `/new` i `/:id/edit` w pliku `recipes-routes.ts` (lub podobnym), kierujących do `RecipeFormPageComponent`.
4.  **Implementacja `RecipeFormPageComponent`:**
    -   Zdefiniowanie logiki rozróżniania trybu edycji/tworzenia.
    -   Wstrzyknięcie serwisów (`RecipesService`, `CategoriesService`, `FormBuilder`, `ActivatedRoute`, `Router`).
    -   Stworzenie `FormGroup` na podstawie `RecipeFormViewModel`.
    -   Implementacja metod `ngOnInit` do pobierania danych przepisu (w trybie edycji) oraz metody `onSubmit` do wysyłania formularza.
5.  **Implementacja komponentów podrzędnych:**
    -   Stworzenie szablonów HTML i logiki dla `RecipeBasicInfoFormComponent`, `RecipeImageUploadComponent` i `RecipeCategorizationFormComponent`.
    -   Implementacja `ControlValueAccessor` lub przekazywanie `FormGroup`/`FormControl` jako `@Input`.
6.  **Implementacja `EditableListComponent`:**
    -   Zaimplementowanie logiki wyświetlania, dodawania, usuwania i edycji elementów `FormArray`.
    -   Dodanie i skonfigurowanie modułu `DragDropModule` z `@angular/cdk` do obsługi zmiany kolejności.
7.  **Stworzenie szablonu `RecipeFormPageComponent`:** Złożenie widoku z zaimplementowanych komponentów podrzędnych, przekazując im odpowiednie części głównego `FormGroup` oraz listę kategorii z `CategoriesService`. Dodanie przycisków i obsługi stanu ładowania.
8.  **Integracja z API:** Implementacja wywołań API w serwisie `RecipesService` i podpięcie ich w `RecipeFormPageComponent`.
9.  **Stylowanie i finalizacja:** Dopracowanie stylów SCSS dla wszystkich komponentów, zapewnienie responsywności i spójności z resztą aplikacji.
10. **Testowanie:** Manualne przetestowanie obu ścieżek (tworzenie i edycja), walidacji, obsługi błędów oraz interakcji "przeciągnij i upuść".
