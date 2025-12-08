# Plan Implementacji Testów Jednostkowych dla EditableListComponent

## 1. Przegląd komponentu

`EditableListComponent` to współdzielony komponent UI, który renderuje listę elementów (stringów) i umożliwia użytkownikowi wykonywanie na niej operacji CRUD (dodawanie, edytowanie, usuwanie). Komponent jest w pełni sterowany przez `Inputs` (dane wejściowe) i komunikuje się z komponentem nadrzędnym za pomocą `Outputs` (zdarzeń). Nie posiada żadnych zależności do serwisów, co czyni go idealnym kandydatem do testów jednostkowych w izolacji.

## 2. Zakres testowania

Testy jednostkowe obejmą wszystkie kluczowe aspekty działania komponentu, w tym:

-   **Renderowanie początkowe:** Weryfikacja, czy komponent poprawnie wyświetla dane początkowe na podstawie przekazanych `Inputs` (tytuł, lista elementów).
-   **Logika formularza dodawania:** Sprawdzenie walidacji, stanu przycisku oraz poprawnego emitowania zdarzenia `itemAdded`.
-   **Logika edycji elementu:** Weryfikacja przełączania w tryb edycji, walidacji formularza edycji, emitowania zdarzenia `itemEdited` oraz anulowania edycji.
-   **Logika usuwania elementu:** Weryfikacja emitowania zdarzenia `itemRemoved` po kliknięciu przycisku usuwania.
-   **Renderowanie warunkowe:** Sprawdzenie, czy przyciski edycji i usuwania są wyświetlane poprawnie w zależności od wartości `isEditable` i `isRemovable`.
-   **Interakcje użytkownika:** Symulacja działań użytkownika (wpisywanie tekstu, klikanie przycisków) i weryfikacja reakcji komponentu.

## 3. Struktura testów

Plik testowy `editable-list.component.spec.ts` zostanie zorganizowany w następujący sposób, z użyciem zagnieżdżonych bloków `describe` w celu logicznego grupowania przypadków testowych:

```
EditableListComponent/
└── editable-list.component.spec.ts
```

```typescript
describe('EditableListComponent', () => {

  // beforeEach lub funkcja setup do renderowania komponentu

  describe('Initialization and Rendering', () => {
    // Testy na renderowanie początkowe
  });

  describe('Adding an item', () => {
    // Testy związane z dodawaniem nowych elementów
  });

  describe('Editing an item', () => {
    // Testy związane z edycją istniejących elementów
  });

  describe('Removing an item', () => {
    // Testy związane z usuwaniem elementów
  });

  describe('Conditional rendering via Inputs', () => {
    // Testy na renderowanie warunkowe na podstawie isEditable i isRemovable
  });
});
```

## 4. Szczegółowe przypadki testowe

### Grupa: Initialization and Rendering

-   **Nazwa testu:** `should render the list title and all initial items`
-   **Opis:** Sprawdza, czy komponent poprawnie wyświetla tytuł listy oraz wszystkie elementy przekazane w `items` przy pierwszym renderowaniu.
-   **Kroki:**
    1.  Zrenderuj komponent z `listTitle: 'Test Title'` i `items: ['Item 1', 'Item 2']`.
    2.  Sprawdź, czy na ekranie znajduje się element z tekstem 'Test Title'.
    3.  Sprawdź, czy na ekranie znajdują się elementy z tekstami 'Item 1' i 'Item 2'.
-   **Oczekiwany rezultat:** Wszystkie oczekiwane teksty są widoczne w DOM.

-   **Nazwa testu:** `should render correctly with an empty item list`
-   **Opis:** Weryfikuje, czy komponent zachowuje się poprawnie (nie rzuca błędu) i wyświetla tytuł, gdy lista `items` jest pusta.
-   **Kroki:**
    1.  Zrenderuj komponent z `listTitle: 'Empty List'` i `items: []`.
    2.  Sprawdź, czy tytuł 'Empty List' jest widoczny.
    3.  Upewnij się, że nie ma żadnych elementów listy w DOM.
-   **Oczekiwany rezultat:** Tytuł jest widoczny, brak elementów `li` (lub odpowiednika).

### Grupa: Adding an item

-   **Nazwa testu:** `should have the "Add" button disabled when the input is empty`
-   **Opis:** Sprawdza, czy przycisk dodawania jest domyślnie wyłączony z powodu walidatora `required` na polu formularza.
-   **Kroki:**
    1.  Zrenderuj komponent.
    2.  Znajdź przycisk do dodawania elementów (po `addButtonLabel`).
    3.  Sprawdź, czy przycisk ma atrybut `disabled`.
-   **Oczekiwany rezultat:** Przycisk jest wyłączony.

-   **Nazwa testu:** `should enable the "Add" button when text is typed into the input`
-   **Opis:** Weryfikuje, czy walidacja formularza działa poprawnie i aktywuje przycisk po wpisaniu tekstu.
-   **Kroki:**
    1.  Zrenderuj komponent.
    2.  Znajdź pole tekstowe do dodawania nowego elementu.
    3.  Zasymuluj wpisanie tekstu 'New Item'.
    4.  Znajdź przycisk dodawania i sprawdź, czy nie jest już wyłączony.
-   **Oczekiwany rezultat:** Przycisk jest aktywny.

-   **Nazwa testu:** `should emit itemAdded event and clear the input on "Add" button click`
-   **Opis:** Kluczowy test dla funkcjonalności dodawania. Sprawdza, czy zdarzenie `itemAdded` jest emitowane z poprawną wartością, a formularz jest resetowany.
-   **Kroki:**
    1.  Zrenderuj komponent i przygotuj "szpiega" (spy) na `itemAdded` output.
    2.  Wpisz 'New Item' w pole tekstowe.
    3.  Kliknij przycisk dodawania.
    4.  Sprawdź, czy `itemAdded` zostało wyemitowane z wartością 'New Item'.
    5.  Sprawdź, czy pole tekstowe jest teraz puste.
-   **Oczekiwany rezultat:** Zdarzenie wyemitowane, pole tekstowe wyczyszczone.

### Grupa: Editing an item

-   **Nazwa testu:** `should switch to edit mode when the edit button is clicked`
-   **Opis:** Sprawdza, czy kliknięcie ikony edycji poprawnie przełącza widok elementu na formularz edycji.
-   **Kroki:**
    1.  Zrenderuj komponent z listą `['Item to edit']`.
    2.  Znajdź przycisk edycji dla 'Item to edit' i kliknij go.
    3.  Sprawdź, czy tekst 'Item to edit' zniknął.
    4.  Sprawdź, czy pojawiło się pole tekstowe z wartością 'Item to edit'.
    5.  Sprawdź, czy przyciski "Zapisz" i "Anuluj" są widoczne.
-   **Oczekiwany rezultat:** Widok elementu zmienia się z tekstu na pole `input` z przyciskami.

-   **Nazwa testu:** `should emit itemEdited and exit edit mode on "Save" click`
-   **Opis:** Weryfikuje logikę zapisu edytowanego elementu.
-   **Kroki:**
    1.  Zrenderuj komponent z `items: ['Old Value']` i nasłuchuj na `itemEdited`.
    2.  Wejdź w tryb edycji dla 'Old Value'.
    3.  Wyczyść pole tekstowe i wpisz 'New Value'.
    4.  Kliknij przycisk "Zapisz".
    5.  Sprawdź, czy zdarzenie `itemEdited` zostało wyemitowane z `{ old: 'Old Value', new: 'New Value' }`.
    6.  Sprawdź, czy formularz edycji zniknął.
-   **Oczekiwany rezultat:** Zdarzenie wyemitowane, komponent wraca do trybu wyświetlania.

-   **Nazwa testu:** `should not emit itemEdited if value has not changed`
-   **Opis:** Sprawdza przypadek krawędziowy, gdy użytkownik klika "Zapisz" bez zmiany wartości.
-   **Kroki:**
    1.  Zrenderuj komponent, nasłuchuj na `itemEdited`.
    2.  Wejdź w tryb edycji dla jednego z elementów.
    3.  Nie zmieniając wartości, kliknij "Zapisz".
    4.  Sprawdź, czy zdarzenie `itemEdited` **nie** zostało wyemitowane.
-   **Oczekiwany rezultat:** Brak emisji zdarzenia.

-   **Nazwa testu:** `should exit edit mode without emitting event on "Cancel" click`
-   **Opis:** Weryfikuje działanie przycisku anulowania edycji.
-   **Kroki:**
    1.  Zrenderuj komponent, nasłuchuj na `itemEdited`.
    2.  Wejdź w tryb edycji i zmień wartość w polu tekstowym.
    3.  Kliknij przycisk "Anuluj".
    4.  Sprawdź, czy zdarzenie `itemEdited` **nie** zostało wyemitowane.
    5.  Sprawdź, czy komponent wrócił do trybu wyświetlania.
-   **Oczekiwany rezultat:** Komponent wraca do trybu wyświetlania, zdarzenie nie jest emitowane.

### Grupa: Removing an item

-   **Nazwa testu:** `should emit itemRemoved with correct value on delete button click`
-   **Opis:** Sprawdza, czy kliknięcie przycisku usuwania emituje zdarzenie z wartością usuwanego elementu.
-   **Kroki:**
    1.  Zrenderuj komponent z `items: ['Item to remove']` i nasłuchuj na `itemRemoved`.
    2.  Znajdź przycisk usuwania dla 'Item to remove' i kliknij go.
    3.  Sprawdź, czy `itemRemoved` zostało wyemitowane z wartością 'Item to remove'.
-   **Oczekiwany rezultat:** Zdarzenie `itemRemoved` poprawnie wyemitowane.

### Grupa: Conditional rendering via Inputs

-   **Nazwa testu:** `should not display edit and remove buttons if isEditable and isRemovable are false`
-   **Opis:** Sprawdza, czy flagi sterujące poprawnie ukrywają przyciski akcji.
-   **Kroki:**
    1.  Zrenderuj komponent z `items: ['Test Item']`, `isEditable: false`, `isRemovable: false`.
    2.  Sprawdź (queryBy), czy przyciski z tooltipami do edycji i usuwania **nie istnieją** w DOM.
-   **Oczekiwany rezultat:** Przyciski akcji są niewidoczne.

-   **Nazwa testu:** `should display only edit button if isEditable is true and isRemovable is false`
-   **Opis:** Weryfikuje kombinację flag sterujących.
-   **Kroki:**
    1.  Zrenderuj komponent z `items: ['Test Item']`, `isEditable: true`, `isRemovable: false`.
    2.  Sprawdź, czy przycisk edycji jest widoczny.
    3.  Sprawdź, czy przycisk usuwania jest niewidoczny.
-   **Oczekiwany rezultat:** Tylko przycisk edycji jest widoczny.

## 5. Wymagane mocki i stuby

-   **Mockowanie modułów Angular Material:** Komponent korzysta z `MatFormField`, `MatInput`, `MatButton`, `MatIcon` i `MatTooltip`. Należy zaimportować odpowiednie moduły (`MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatIconModule`, `MatTooltipModule`) w konfiguracji testu, aby uniknąć błędów renderowania szablonu.
-   **Mockowanie `ng-icons`:** Jeśli ikony są dostarczane przez bibliotekę `ng-icons`, należy użyć `provideIcons` lub odpowiedniego mechanizmu testowego z `@ng-icons/core/testing`, aby zarejestrować używane ikony (np. `lucideEdit`, `lucideTrash2`, `lucideSave`, `lucideX`).
-   **`ReactiveFormsModule`:** Należy zaimportować ten moduł, aby obsłużyć `formGroup` i `formControlName` używane w komponencie.

## 6. Konfiguracja testów

Konfiguracja testów zostanie zrealizowana przy użyciu biblioteki `@testing-library/angular`. Główną metodą będzie `render`, która tworzy instancję komponentu i udostępnia narzędzia do interakcji z nim.

Przykładowa funkcja `setup` może wyglądać następująco:

```typescript
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EditableListComponent } from './editable-list.component';
// Importy modułów Material Design, ReactiveFormsModule, etc.

async function setup(componentProperties = {}) {
  const user = userEvent.setup();
  const defaultProperties = {
    items: ['Item 1', 'Item 2'],
    listTitle: 'Default Title',
    isEditable: true,
    isRemovable: true,
  };

  const rendered = await render(EditableListComponent, {
    imports: [
      /* Mat...Module, ReactiveFormsModule, ... */
    ],
    providers: [
      /* provideIcons, ... */
    ],
    componentProperties: { ...defaultProperties, ...componentProperties },
  });

  return { ...rendered, user };
}
```

## 7. Kryteria akceptacji

Implementację testów jednostkowych dla `EditableListComponent` uzna się za zakończoną, gdy:

1.  Wszystkie zdefiniowane powyżej przypadki testowe zostaną zaimplementowane i będą przechodzić pomyślnie.
2.  Pokrycie kodu (code coverage) dla pliku `editable-list.component.ts` osiągnie poziom co najmniej 90% dla linii, funkcji i gałęzi.
3.  Testy zostaną pomyślnie uruchomione w ramach pipeline'u CI/CD.
4.  Testy będą oparte o interakcje użytkownika i zapytania dostępne dla użytkowników (zgodnie z filozofią `@testing-library`), a nie o wewnętrzne szczegóły implementacji komponentu.
