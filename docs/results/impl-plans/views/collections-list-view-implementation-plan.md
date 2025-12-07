# Plan implementacji widoku: Lista Kolekcji

## 1. Przegląd
Widok "Lista Kolekcji" (`/collections`) jest głównym interfejsem do zarządzania kolekcjami przepisów użytkownika. Umożliwia przeglądanie istniejących kolekcji, tworzenie nowych, edytowanie ich nazw i opisów oraz usuwanie. Widok obsługuje również stan pusty, gdy użytkownik nie posiada jeszcze żadnych kolekcji, zachęcając go do interakcji.

## 2. Routing widoku
Widok będzie dostępny pod następującą ścieżką:
- **Ścieżka:** `/collections`
- **Ochrona:** Widok musi być chroniony przez `AuthGuard`, ponieważ jest dostępny tylko dla zalogowanych użytkowników.

## 3. Struktura komponentów
Hierarchia komponentów dla tego widoku będzie następująca:

```
- CollectionsListPageComponent (komponent-strona, /collections)
  - @if (stan.isLoading)
    - MatProgressSpinnerComponent (ładowanie)
  - @else if (stan.collections.length === 0)
    - EmptyStateComponent (komponent współdzielony)
  - @else
    - CollectionListComponent (komponent prezentacyjny)
      - @for (kolekcja in stan.collections)
        - mat-list-item
          - Nazwa kolekcji (z routerLink do /collections/:id)
          - Przycisk "Edytuj"
          - Przycisk "Usuń"
```
Dodatkowo, `CollectionsListPageComponent` będzie zarządzał otwieraniem komponentów dialogowych:
- `CollectionFormComponent` (wewnątrz `MatDialog` do tworzenia/edycji)
- `ConfirmDialogComponent` (wewnątrz `MatDialog` do potwierdzania usunięcia)

## 4. Szczegóły komponentów

### CollectionsListPageComponent
- **Opis:** Główny, inteligentny komponent strony. Odpowiada za komunikację z API, zarządzanie stanem (pobieranie listy kolekcji, ładowanie, błędy) oraz obsługę logiki związanej z akcjami użytkownika (otwieranie dialogów do tworzenia, edycji i usuwania kolekcji).
- **Główne elementy:** Kontener dla komponentów podrzędnych, logika w TypeScript. Wykorzystuje `@if` i `@for` do warunkowego renderowania.
- **Obsługiwane zdarzenia:**
    - `ngOnInit()`: Inicjuje pobieranie listy kolekcji.
    - Kliknięcie przycisku "Utwórz kolekcję": Otwiera `CollectionFormComponent` w trybie tworzenia.
    - `(edit)` z `CollectionListComponent`: Otwiera `CollectionFormComponent` w trybie edycji z danymi wybranej kolekcji.
    - `(delete)` z `CollectionListComponent`: Otwiera `ConfirmDialogComponent`, a po potwierdzeniu wywołuje usługę API w celu usunięcia kolekcji.
- **Typy:** `Signal<CollectionsListState>`.
- **Propsy:** Brak.

### CollectionListComponent
- **Opis:** Komponent prezentacyjny ("głupi"), odpowiedzialny wyłącznie za wyświetlanie listy kolekcji przekazanej przez rodzica.
- **Główne elementy:** `mat-list` do renderowania listy. Każdy `mat-list-item` zawiera nazwę kolekcji, która jest linkiem do jej szczegółów, oraz przyciski akcji.
- **Obsługiwane zdarzenia:**
    - `@Output() edit`: Emituje zdarzenie z obiektem kolekcji, gdy użytkownik kliknie przycisk "Edytuj".
    - `@Output() delete`: Emituje zdarzenie z obiektem kolekcji, gdy użytkownik kliknie przycisk "Usuń".
- **Typy:** `CollectionListItemDto[]`.
- **Propsy:** `@Input() collections: CollectionListItemDto[]`.

### CollectionFormComponent
- **Opis:** Komponent oparty na `ReactiveFormsModule`, używany wewnątrz okna dialogowego `MatDialog`. Służy zarówno do tworzenia nowej, jak i edytowania istniejącej kolekcji.
- **Główne elementy:** `form` z `mat-form-field` dla nazwy i opisu, oraz przyciski "Anuluj" i "Zapisz".
- **Obsługiwane zdarzenia:**
    - Kliknięcie "Zapisz": Waliduje formularz i, jeśli jest poprawny, zamyka dialog, zwracając jego wartość.
- **Warunki walidacji:**
    - `name`: Wymagane (`Validators.required`), maksymalna długość 100 znaków (`Validators.maxLength(100)`).
- **Typy:** `FormGroup<CollectionFormViewModel>`, `MAT_DIALOG_DATA`.
- **Propsy:** Przyjmowane przez wstrzykiwanie `MAT_DIALOG_DATA` (opcjonalny obiekt `CollectionListItemDto` w trybie edycji).

## 5. Typy

### DTO (Data Transfer Objects)
-   `CollectionListItemDto`: Obiekt kolekcji otrzymywany z API.
    ```typescript
    type CollectionListItemDto = {
        id: number;
        name: string;
        description: string | null;
    };
    ```
-   `CreateCollectionCommand`: Obiekt wysyłany do API w celu utworzenia kolekcji.
    ```typescript
    type CreateCollectionCommand = {
        name: string;
        description: string | null;
    };
    ```
-   `UpdateCollectionCommand`: Obiekt wysyłany do API w celu aktualizacji kolekcji.
    ```typescript
    type UpdateCollectionCommand = Partial<CreateCollectionCommand>;
    ```

### ViewModels
-   `CollectionFormViewModel`: Definiuje strukturę formularza reaktywnego.
    ```typescript
    interface CollectionFormViewModel {
        name: FormControl<string>;
        description: FormControl<string | null>;
    }
    ```
-   `CollectionsListState`: Definiuje kształt sygnału stanu dla `CollectionsListPageComponent`.
    ```typescript
    interface CollectionsListState {
        collections: CollectionListItemDto[];
        isLoading: boolean;
        error: string | null;
    }
    ```

## 6. Zarządzanie stanem
Zarządzanie stanem będzie realizowane lokalnie w `CollectionsListPageComponent` za pomocą sygnału (`signal`) z Angulara.
```typescript
// collections-list-page.component.ts
state = signal<CollectionsListState>({
    collections: [],
    isLoading: true,
    error: null,
});
```
- **Cel:** Utrzymanie spójnego i reaktywnego stanu widoku, obejmującego listę danych, status ładowania oraz ewentualne błędy. Aktualizacje stanu będą wykonywane za pomocą metody `state.update()`, co zapewnia przewidywalność i jest zgodne z najnowszymi praktykami Angulara.

## 7. Integracja API
Komponent `CollectionsListPageComponent` będzie korzystał z wstrzykiwanej usługi `CollectionsApiService` do komunikacji z backendem.

- **`GET /collections`**:
    - **Akcja:** Pobranie listy kolekcji użytkownika.
    - **Wywołanie:** W `ngOnInit` komponentu `CollectionsListPageComponent`.
    - **Odpowiedź:** `CollectionListItemDto[]`.
- **`POST /collections`**:
    - **Akcja:** Utworzenie nowej kolekcji.
    - **Wywołanie:** Po pomyślnym przesłaniu formularza z `CollectionFormComponent`.
    - **Żądanie:** `CreateCollectionCommand`.
- **`PUT /collections/{id}`**:
    - **Akcja:** Aktualizacja istniejącej kolekcji.
    - **Wywołanie:** Po pomyślnym przesłaniu formularza edycji z `CollectionFormComponent`.
    - **Żądanie:** `UpdateCollectionCommand`.
- **`DELETE /collections/{id}`**:
    - **Akcja:** Usunięcie kolekcji.
    - **Wywołanie:** Po potwierdzeniu operacji w oknie dialogowym.

## 8. Interakcje użytkownika
- **Wejście na stronę:** Użytkownik widzi wskaźnik ładowania, a następnie listę swoich kolekcji lub komunikat o jej braku.
- **Kliknięcie "Utwórz kolekcję":** Otwiera się modal z formularzem do wprowadzenia nazwy i opisu.
- **Zatwierdzenie formularza (tworzenie):** Modal się zamyka, lista odświeża się, dodając nową pozycję, a użytkownik otrzymuje powiadomienie o sukcesie (np. `mat-snackbar`).
- **Kliknięcie "Edytuj" przy kolekcji:** Otwiera się ten sam modal, ale wypełniony danymi wybranej kolekcji.
- **Kliknięcie "Usuń" przy kolekcji:** Otwiera się modal z prośbą o potwierdzenie. Po akceptacji kolekcja znika z listy, a użytkownik otrzymuje powiadomienie.
- **Kliknięcie na nazwę kolekcji:** Użytkownik jest przenoszony na stronę szczegółów danej kolekcji (`/collections/:id`).

## 9. Warunki i walidacja
- Walidacja odbywa się w `CollectionFormComponent` za pomocą `ReactiveFormsModule`.
- Pole `name` jest wymagane i ma ograniczenie do 100 znaków.
- Przycisk "Zapisz" w formularzu jest nieaktywny (`disabled`), dopóki formularz nie jest poprawny (`form.valid`).
- Komunikaty o błędach walidacji (np. "To pole jest wymagane") są wyświetlane pod odpowiednim polem formularza.

## 10. Obsługa błędów
- **Błąd pobierania danych:** Jeśli `GET /collections` zwróci błąd, komponent wyświetli komunikat o błędzie zamiast listy, np. "Nie udało się wczytać kolekcji. Spróbuj ponownie później."
- **Błąd zapisu/edycji:** W przypadku błędu (np. `409 Conflict`, gdy nazwa już istnieje), modal z formularzem nie zostanie zamknięty, a pod polem formularza lub nad przyciskami pojawi się komunikat błędu zwrócony przez API.
- **Błąd usunięcia:** Użytkownik otrzyma powiadomienie (np. `mat-snackbar`) z informacją o niepowodzeniu operacji.
- **Błędy 401/403:** Będą obsługiwane globalnie przez `HttpInterceptor`, który wyloguje użytkownika i przekieruje go do strony logowania.

## 11. Kroki implementacji
1. **Utworzenie struktury plików:** Wygenerowanie komponentów `CollectionsListPageComponent`, `CollectionListComponent` i `CollectionFormComponent` za pomocą Angular CLI z flagą `--standalone`.
2. **Routing:** Dodanie nowej ścieżki `/collections` do głównego pliku routingu, przypisując ją do `CollectionsListPageComponent` i zabezpieczając `AuthGuard`.
3. **Implementacja `CollectionsListPageComponent`:**
    - Zdefiniowanie sygnału `state` z interfejsem `CollectionsListState`.
    - Wstrzyknięcie `CollectionsApiService` i `MatDialog`.
    - Implementacja logiki pobierania danych w `ngOnInit` i aktualizacji stanu.
    - Stworzenie metod do otwierania dialogów `create`, `edit` i `delete`.
4. **Implementacja `CollectionListComponent`:**
    - Zdefiniowanie `@Input()` dla listy kolekcji oraz `@Output()` dla zdarzeń `edit` i `delete`.
    - Zbudowanie szablonu HTML z użyciem `mat-list` i pętli `@for` do wyświetlania danych.
    - Dodanie `routerLink` do nawigacji do szczegółów kolekcji.
5. **Implementacja `CollectionFormComponent`:**
    - Zbudowanie formularza reaktywnego (`FormGroup`).
    - Skonfigurowanie walidatorów dla pól.
    - Implementacja logiki do obsługi trybu edycji (wypełnianie formularza danymi z `MAT_DIALOG_DATA`).
    - Stworzenie szablonu HTML z komponentami Angular Material (`mat-form-field`, `mat-input`, `mat-dialog-actions`).
6. **Integracja i testowanie:** Połączenie komponentów, dodanie obsługi powiadomień `MatSnackBar` i dokładne przetestowanie wszystkich ścieżek interakcji użytkownika.
7. **Stylowanie i dopracowanie:** Zapewnienie responsywności widoku i zgodności z systemem wizualnym aplikacji.
