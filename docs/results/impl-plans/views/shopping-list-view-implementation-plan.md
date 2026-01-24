# Plan implementacji widoku Zakupy (lista zakupów)

## 1. Przegląd
Widok `/shopping` umożliwia przeglądanie i zarządzanie listą zakupów: pozycjami z przepisów oraz ręcznymi wpisami. Nowy zakres dodaje usuwanie grupy pozycji „z przepisu” (z akcją Undo) oraz akcję „Wyczyść listę” z modalem potwierdzenia, bez modyfikowania „Mojego planu”.

## 2. Routing widoku
Ścieżka: `/shopping` (widok prywatny, w App Shell z Sidebarem).

## 3. Struktura komponentów
- `pych-shopping-list-page`
  - `pych-shared-page-header` (tytuł + akcja „Wyczyść listę”)
  - `pych-shopping-list-add-item`
  - `pych-shopping-list-grouped-list`
    - `pych-shopping-list-group-item` (dla grup „z przepisu”)
    - `pych-shopping-list-manual-item` (dla pozycji ręcznych)
  - `pych-shopping-list-clear-dialog` (modal potwierdzenia)

## 4. Szczegóły komponentów
### `pych-shopping-list-page`
- Opis komponentu: kontener widoku, pobiera dane, składa sekcje i zarządza stanem globalnym widoku.
- Główne elementy: `pych-shared-page-header`, sekcja dodawania, lista zgrupowana, modal potwierdzenia.
- Obsługiwane interakcje: inicjalne ładowanie listy, odświeżanie po mutacjach, otwarcie modala „Wyczyść listę”.
- Obsługiwana walidacja: brak bezpośredniej walidacji – deleguje do dzieci.
- Typy: `GetShoppingListResponseDto`, `ShoppingListItemDto`, `ShoppingListGroupedItemVm`.
- Propsy: brak (route component).

### `pych-shared-page-header` (użycie istniejącego)
- Opis komponentu: nagłówek strony z tytułem „Zakupy” i akcjami.
- Główne elementy: tytuł, przycisk/ikona „Wyczyść listę”.
- Obsługiwane interakcje: klik „Wyczyść listę”.
- Obsługiwana walidacja: akcja disabled podczas `isClearing`.
- Typy: brak nowych.
- Propsy: `title`, `actions` (np. sygnał/handler otwarcia dialogu).

### `pych-shopping-list-add-item`
- Opis komponentu: pole tekstowe do dodawania ręcznej pozycji + przycisk „Dodaj”.
- Główne elementy: `mat-form-field`, `input`, `mat-button`.
- Obsługiwane interakcje: wpis tekstu, Enter, klik „Dodaj”.
- Obsługiwana walidacja:
  - `text.trim().length > 0` (wymagane),
  - blokada przycisku podczas `isAdding`.
- Typy: `AddManualShoppingListItemCommand`.
- Propsy: `isAdding`, `onAdd(text: string)`.

### `pych-shopping-list-grouped-list`
- Opis komponentu: renderuje zgrupowane pozycje „z przepisów” oraz osobno pozycje ręczne.
- Główne elementy: kontener listy, `@for` na grupy i na manualne.
- Obsługiwane interakcje: deleguje do itemów.
- Obsługiwana walidacja: brak.
- Typy: `ShoppingListGroupedItemVm`, `ShoppingListManualItemVm`.
- Propsy: `groupedItems`, `manualItems`, `onToggleOwned`, `onDeleteGroup`, `onDeleteManual`.

### `pych-shopping-list-group-item`
- Opis komponentu: pojedyncza pozycja „z przepisu” po zgrupowaniu (klucz: `name`, `unit`, `is_owned`).
- Główne elementy: checkbox `mat-checkbox`, tekst nazwy, ilość+jednostka (opcjonalnie), ikona kosza.
- Obsługiwane interakcje:
  - toggle `is_owned`,
  - klik usuwania grupy.
- Obsługiwana walidacja:
  - blokada akcji w trakcie `isUpdating` / `isDeleting`.
  - ilość prezentowana tylko gdy `amountSum != null` i `unit != null`.
- Typy: `ShoppingListGroupedItemVm`, `DeleteRecipeItemsGroupCommand`.
- Propsy: `item`, `isUpdating`, `isDeleting`, `onToggleOwned`, `onDelete`.

### `pych-shopping-list-manual-item`
- Opis komponentu: pojedyncza ręczna pozycja listy.
- Główne elementy: checkbox, tekst, ikona kosza.
- Obsługiwane interakcje: toggle `is_owned`, usuń element.
- Obsługiwana walidacja: blokada akcji w trakcie `isUpdating` / `isDeleting`.
- Typy: `ShoppingListManualItemVm`.
- Propsy: `item`, `isUpdating`, `isDeleting`, `onToggleOwned`, `onDelete`.

### `pych-shopping-list-clear-dialog`
- Opis komponentu: modal potwierdzenia czyszczenia listy.
- Główne elementy: `mat-dialog`, treść z informacją o braku wpływu na „Mój plan”.
- Obsługiwane interakcje: potwierdź / anuluj.
- Obsługiwana walidacja: blokada przycisku potwierdzenia w trakcie `isClearing`.
- Typy: brak nowych.
- Propsy: `isClearing`.

## 5. Typy
- DTO (z kontraktów):
  - `GetShoppingListResponseDto` (uwaga: w kontraktach pole `data`, w API planie `items` – zmapować w adapterze).
  - `ShoppingListItemDto` (`ShoppingListItemRecipeDto` + `ShoppingListItemManualDto`).
  - `AddManualShoppingListItemCommand` (`text`).
  - `UpdateShoppingListItemCommand` (`is_owned`).
  - `DeleteRecipeItemsGroupCommand` (`name`, `unit`, `is_owned`).
  - `DeleteRecipeItemsGroupResponseDto` (`deleted`).
- Nowe ViewModel:
  - `ShoppingListGroupedItemVm`:
    - `key`: `{ name: string; unit: NormalizedIngredientUnit | null; isOwned: boolean }`
    - `name: string`
    - `unit: NormalizedIngredientUnit | null`
    - `amountSum: number | null` (sumowane tylko gdy wszystkie elementy mają `amount` i `unit`)
    - `isOwned: boolean`
    - `recipeNames: string[]` (opcjonalnie do tooltipu)
  - `ShoppingListManualItemVm`:
    - `id: number`
    - `text: string`
    - `isOwned: boolean`

## 6. Zarządzanie stanem
- Stan w `pych-shopping-list-page` oparty o sygnały:
  - `itemsRaw = signal<ShoppingListItemDto[]>([])`
  - `isLoading`, `isAdding`, `isUpdatingIds`, `isDeletingGroupKey`, `isDeletingManualIds`, `isClearing`
  - `lastDeletedGroup = signal<ShoppingListGroupedItemVm | null>(null)` (dla Undo)
- Wyliczane sygnały:
  - `groupedItems = computed(...)` – grupowanie tylko `kind=RECIPE` po (`name`, `unit`, `is_owned`), sumowanie ilości zgodnie z PRD.
  - `manualItems = computed(...)` – mapowanie `kind=MANUAL`.
  - `sortedGroupedItems` – `is_owned=false` na górze, potem `true`, stabilnie po `name`.
- Wzorzec “state.update” dla płynnych przejść i bez białego flasha.
- Brak custom hooków – jedna usługa/fasada `ShoppingListFacade` z metodami i sygnałami.

## 7. Integracja API
- Źródło danych przez `SupabaseService.functions.invoke` (zakaz bezpośredniego `supabase.from`).
- Endpointy:
  - `GET /shopping-list` → `GetShoppingListResponseDto` (adapter mapuje `items`/`data`).
  - `POST /shopping-list/items` → `AddManualShoppingListItemCommand`.
  - `PATCH /shopping-list/items/{id}` → `UpdateShoppingListItemCommand`.
  - `DELETE /shopping-list/items/{id}` (tylko manual).
  - `DELETE /shopping-list/recipe-items/group` → `DeleteRecipeItemsGroupCommand`.
  - `DELETE /shopping-list` (czyszczenie całej listy).
- Po sukcesie mutacji: odświeżenie listy lub aktualizacja lokalnego stanu.

## 8. Interakcje użytkownika
- Dodanie ręcznej pozycji: wpis → Enter/klik „Dodaj” → POST → dodanie do listy.
- Odhaczenie pozycji: klik checkbox → PATCH `is_owned` → przestawienie pozycji (sortowanie).
- Usunięcie pozycji ręcznej: klik kosza → DELETE `/shopping-list/items/{id}` → znika z listy.
- Usunięcie grupy „z przepisu”: klik kosza → natychmiastowe ukrycie grupy + Snackbar z „Cofnij”.
  - „Cofnij”: przywróć grupę bez wywołania API.
  - brak „Cofnij”: wywołaj `DELETE /shopping-list/recipe-items/group`.
- Wyczyść listę: klik w nagłówku → modal → potwierdź → `DELETE /shopping-list` → lista pusta.

## 9. Warunki i walidacja
- Dodanie ręcznej pozycji: `text.trim().length > 0`.
- Usuwanie grupy „z przepisu” wymaga klucza (`name`, `unit`, `is_owned`); `unit` może być `null`.
- Usuwanie manualnej pozycji tylko dla `kind=MANUAL` (przyciski i handlery weryfikują `kind`).
- Disable akcji w trakcie odpowiedniej operacji:
  - `isAdding`, `isUpdating`, `isDeleting`, `isClearing`.

## 10. Obsługa błędów
- `GET /shopping-list` → komunikat w UI + możliwość ponowienia.
- `POST /shopping-list/items` (400) → komunikat „Wpis nie może być pusty”.
- `PATCH /shopping-list/items/{id}` (404) → odśwież listę.
- `DELETE /shopping-list/items/{id}` (403/404) → komunikat i odświeżenie listy.
- `DELETE /shopping-list/recipe-items/group` (400) → komunikat o nieprawidłowych danych grupy + odświeżenie listy.
- `DELETE /shopping-list` (401) → przekierowanie do logowania / globalny handler.
- Dla wszystkich: Snackbar z czytelnym błędem, bez ujawniania szczegółów technicznych.

## 11. Kroki implementacji
1. Utwórz `ShoppingListFacade` (standalone service) z metodami: `load`, `addManual`, `toggleOwned`, `deleteManual`, `deleteRecipeGroup`, `clearAll`.
2. Zaimplementuj adapter odpowiedzi `GetShoppingListResponseDto` z mapowaniem `items`/`data`.
3. Dodaj `pych-shopping-list-page` (standalone, OnPush, signals, `inject`).
4. Zaimplementuj `pych-shopping-list-add-item` z walidacją i obsługą Enter.
5. Zaimplementuj `pych-shopping-list-grouped-list` oraz itemy dla grup i pozycji ręcznych.
6. Dodaj Snackbar z Undo dla usuwania grupy (odroczone wywołanie API do czasu zamknięcia snackbar).
7. Dodaj `pych-shopping-list-clear-dialog` i akcję w `pych-shared-page-header`.
8. Zapewnij sortowanie i grupowanie zgodnie z PRD (klucz: `name`, `unit`, `is_owned`).
9. Dodaj obsługę stanów ładowania i blokad akcji.
10. Sprawdź a11y (aria-labels na ikonach kosza, czytelne komunikaty).
