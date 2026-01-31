# Plan implementacji widoku Zakupy (`/shopping`)

## 1. Przegląd
Widok **Zakupy** (`/shopping`) umożliwia zarządzanie listą zakupów użytkownika, która składa się z:
- pozycji pochodzących z przepisów znajdujących się w **„Moim planie”** (backend zwraca surowe wiersze; **grupowanie i sumowanie wykonywane jest na frontendzie**),
- pozycji dodanych ręcznie jako **tekst**.

Wymagania doprecyzowane dla MVP (US-053/US-054):
- usuwanie pozycji „z przepisu” usuwa **całą grupę** widoczną w UI (klucz: `name`, `unit`, `is_owned`) i działa także dla `is_owned=true`,
- po usunięciu pokazujemy **Snackbar z akcją „Cofnij” (Undo)**, która przywraca usuniętą grupę w oknie czasowym (finalizacja usunięcia następuje po zamknięciu Snackbara bez Undo),
- akcja **„Wyczyść listę”** usuwa wszystkie pozycje (ręczne i z przepisów), **nie modyfikuje „Mojego planu”**, ma modal potwierdzenia i **bez Undo** w MVP,
- po kolejnych zmianach „Mojego planu” pozycje mogą wracać (brak „wykluczeń” w MVP).

## 2. Routing widoku
- **Ścieżka**: `/shopping`
- **Dostęp**: widok prywatny (w App Shell z Sidebarem), chroniony logowaniem (np. guard istniejący w aplikacji).

## 3. Struktura komponentów
Docelowa struktura (zgodna z aktualnym układem w `src/app/pages/shopping/**`):
- `pych-shopping-page` (route page)
  - `pych-page-header` (tytuł „Zakupy” + akcja „Wyczyść listę”)
  - `pych-shopping-add-item-form` (dodawanie pozycji ręcznej)
  - `pych-empty-state` (stan pusty)
  - `pych-shopping-list`
    - `pych-shopping-list-item` (wiersz listy: zarówno MANUAL jak i RECIPE)
  - `pych-confirm-dialog` (modal potwierdzenia czyszczenia listy; komponent współdzielony)

Wysokopoziomowe drzewo:

```text
ShoppingPageComponent (/shopping)
 ├─ PageHeaderComponent (title + clear action)
 ├─ ShoppingAddItemFormComponent (manual add)
 └─ Content
    ├─ Loading | Error | EmptyState
    └─ ShoppingListComponent
       └─ ShoppingListItemComponent (repeat)
```

## 4. Szczegóły komponentów

### `pych-shopping-page` (`ShoppingPageComponent`)
- **Opis komponentu**: główny kontener widoku. Odpowiada za:
  - inicjalne pobranie listy zakupów,
  - odświeżanie listy po zmianach w „Moim planie”,
  - obsługę zdarzeń z komponentów dzieci (dodaj/toggle/usuń/wyczyść),
  - komunikację z użytkownikiem (Snackbar) oraz modal potwierdzenia.
- **Główne elementy**:
  - `pych-page-header` z przyciskiem „Wyczyść listę” (`mat-icon-button`, `matTooltip`),
  - `pych-shopping-add-item-form`,
  - `pych-shopping-list`,
  - stany: loading / error / empty.
- **Obsługiwane interakcje**:
  - **Dodaj ręcznie**: obsługa `(add)` z formularza.
  - **Toggle is_owned (grupa)**: obsługa `(toggleOwned)` z listy.
  - **Usuń ręcznie**: obsługa `(deleteManual)` z listy.
  - **Usuń grupę z przepisu**: obsługa `(deleteRecipeGroup)` z listy:
    - optymistyczne ukrycie grupy w UI,
    - Snackbar z akcją **„Cofnij”**,
    - finalizacja usunięcia dopiero po `afterDismissed()` jeśli nie kliknięto Undo.
  - **Wyczyść listę**: otwarcie modala, a po potwierdzeniu wywołanie czyszczenia.
  - **Retry** w stanie błędu.
- **Warunki walidacji** (guard clauses / early returns):
  - brak grupy o podanym `groupKey` → przerwij,
  - jeśli oczekuje wcześniejsze usunięcie i użytkownik rozpoczyna kolejne → najpierw sfinalizuj poprzednie (żeby zachować spójność).
- **Typy**:
  - `ApiError`
  - `DeleteRecipeItemsGroupCommand`
  - `ShoppingListGroupedItemVm` (z serwisu)
- **Prop(s)**: brak (komponent routingu).

### `pych-page-header` (użycie)
- **Opis komponentu**: spójny nagłówek strony.
- **Główne elementy**: tytuł + slot akcji.
- **Obsługiwane interakcje**: kliknięcie „Wyczyść listę”.
- **Walidacja/warunki**:
  - akcja „Wyczyść listę” widoczna, gdy `total > 0` i nie trwa `isLoading`,
  - akcja disabled podczas `isClearing`.
- **Typy**: brak dodatkowych.
- **Propsy**: `title` + content projection na akcje.

### `pych-shopping-add-item-form` (`ShoppingAddItemFormComponent`)
- **Opis komponentu**: formularz do dodania ręcznej pozycji tekstowej.
- **Główne elementy**: `mat-form-field` + `input`, przycisk „Dodaj”.
- **Obsługiwane interakcje**:
  - `ngSubmit` (Enter lub przycisk),
  - emisja `add(text: string)`.
- **Warunki walidacji**:
  - `text.trim().length > 0` (w przeciwnym razie nic nie wysyłamy),
  - blokada wysyłki, gdy `isSubmitting=true`.
- **Typy**:
  - na wyjściu: `string` (tekst),
  - w serwisie: `AddManualShoppingListItemCommand`.
- **Propsy**:
  - `isSubmitting: boolean`
  - `add: EventEmitter<string>`

### `pych-shopping-list` (`ShoppingListComponent`)
- **Opis komponentu**: kontener listy. Renderuje pozycje już zgrupowane i posortowane.
- **Główne elementy**: `mat-list`, `mat-divider`.
- **Obsługiwane interakcje**: deleguje do itemów:
  - `toggleOwned`
  - `deleteManual`
  - `deleteRecipeGroup`
- **Warunki walidacji**:
  - brak dodatkowych; komponent działa na danych wejściowych.
- **Typy**:
  - `ShoppingListGroupedItemVm`
- **Propsy**:
  - `items: ShoppingListGroupedItemVm[]`
  - `toggleInProgressRowIds: Set<number>` (disable checkboxów w trakcie PATCH)
  - `deleteInProgressIds: Set<number>` (spinner dla MANUAL delete)

### `pych-shopping-list-item` (`ShoppingListItemComponent`)
- **Opis komponentu**: pojedynczy wiersz listy zakupów (zarówno RECIPE-grupa, jak i MANUAL).
- **Główne elementy**:
  - `mat-checkbox` (is_owned),
  - tekst: `primaryText` + `secondaryText` (opcjonalnie),
  - przycisk kosza (`mat-icon-button`) dla elementów, które można usuwać.
- **Obsługiwane interakcje**:
  - toggle checkbox → `toggleOwned.emit({ groupKey, next })`,
  - klik kosza:
    - dla `MANUAL` → `deleteManual.emit(id)`,
    - dla `RECIPE` → `deleteRecipeGroup.emit(groupKey)`.
- **Warunki walidacji**:
  - akcje disabled podczas `isToggling` lub `isDeleting`,
  - kosz wyświetlany, gdy `canDelete=true` (wymagane: **ustawić `canDelete=true` także dla RECIPE**).
- **Typy**:
  - `ShoppingListGroupedItemVm`
- **Propsy**:
  - `item: ShoppingListGroupedItemVm`
  - `isToggling: boolean`
  - `isDeleting: boolean`

### `pych-confirm-dialog` (użycie: `ConfirmDialogComponent`)
- **Opis komponentu**: modal potwierdzający czyszczenie listy zakupów.
- **Główne elementy**: tytuł, opis, przyciski „Wyczyść”/„Anuluj”.
- **Warunki walidacji**:
  - disableClose oraz blokady w trakcie `isClearing`.
- **Typy**:
  - `ConfirmDialogData`

## 5. Typy

### DTO (backend/contracts)
Źródło: `shared/contracts/types.ts`.
- `GetShoppingListResponseDto`
  - `data: ShoppingListItemDto[]`
  - `meta: { total: number; recipe_items: number; manual_items: number }`
- `ShoppingListItemDto = ShoppingListItemRecipeDto | ShoppingListItemManualDto`
- `AddManualShoppingListItemCommand`:
  - `text: string`
- `UpdateShoppingListItemCommand`:
  - `is_owned: boolean`
- `DeleteRecipeItemsGroupCommand`:
  - `name: string`
  - `unit: NormalizedIngredientUnit | null`
  - `is_owned: boolean`
- `DeleteRecipeItemsGroupResponseDto`:
  - `deleted: number`
- `ApiError`:
  - `message: string`
  - `status: number`

### ViewModel (frontend)
Źródło: `src/app/core/services/shopping-list.service.ts`.
- `ShoppingListGroupedItemVm` (union):
  - wspólne: `groupKey`, `kind`, `isOwned`, `primaryText`, `secondaryText`, `canDelete`, `rowIds`
  - `RECIPE`: `rowCount`, `sumAmount`, `unit`
  - `MANUAL`: `id`

Konwencje kluczy:
- `RECIPE groupKey`: `${name}||${unit ?? 'null'}||${is_owned ? '1' : '0'}`
- `MANUAL groupKey`: `manual:${id}`

## 6. Zarządzanie stanem
Podejście: **signals + computed** w serwisie domenowym `ShoppingListService`.

- **Źródło prawdy danych**: `ShoppingListService.state`:
  - `data: ShoppingListItemDto[]`
  - `meta`
  - `isLoading`, `isRefreshing`, `error`, `lastLoadedAt`
- **Stan mutacji**: `ShoppingListService.mutationState`:
  - `isAddingManual`
  - `togglingRowIds: Set<number>`
  - `deletingItemIds: Set<number>` (MANUAL)
  - `deletingGroupKey: string | null` (RECIPE group delete)
  - `isClearing`
- **Wyliczenia**:
  - `groupedItems`: grupuje tylko `kind=RECIPE` po (`name`, `unit`, `is_owned`), a `MANUAL` pozostawia jako osobne elementy.
  - `groupedItemsSorted`: sortowanie `isOwned=false` na górze, potem `true`, stabilnie `localeCompare('pl')` po `primaryText`.
  - `isEmpty`, `total`, `isLoading`, `isRefreshing`, `error`.

Stan dla Undo (w komponencie strony, per pojedyncza operacja):
- `pendingDeleteCommand: DeleteRecipeItemsGroupCommand | null`
- `pendingDeleteSnackBarRef: MatSnackBarRef<TextOnlySnackBar> | null`

Założenie UX/techniczne:
- utrzymujemy maksymalnie **jedno** „oczekujące usunięcie” na raz; gdy użytkownik inicjuje kolejne, poprzednie jest finalizowane.

## 7. Integracja API
Wszystkie wywołania realizowane przez `SupabaseService.functions.invoke()` (bez `supabase.from()` w UI).

Wymagane wywołania:
- **GET** `shopping-list` → `GetShoppingListResponseDto`
- **POST** `shopping-list/items` → `AddManualShoppingListItemCommand` → `ShoppingListItemManualDto`
- **PATCH** `shopping-list/items/{id}` → `UpdateShoppingListItemCommand` → `ShoppingListItemDto`
- **DELETE** `shopping-list/items/{id}` → usuwa tylko `kind=MANUAL` (dla `RECIPE` API zwraca `403`)
- **DELETE** `shopping-list/recipe-items/group` → `DeleteRecipeItemsGroupCommand` → `DeleteRecipeItemsGroupResponseDto`
- **DELETE** `shopping-list` → czyści całą listę zakupów (bez wpływu na plan)

## 8. Interakcje użytkownika
- **Dodanie ręcznej pozycji**:
  - użytkownik wpisuje tekst → Enter/„Dodaj” → po sukcesie element pojawia się na liście, Snackbar „Dodano”.
- **Odhaczenie (is_owned)**:
  - klik checkboxa na zgrupowanej pozycji → optymistyczna zmiana w UI + PATCH dla wszystkich `rowIds` w grupie → po sukcesie ewentualne ujednolicenie danych odpowiedzią.
- **Usunięcie ręcznej pozycji**:
  - klik kosza → DELETE `/shopping-list/items/{id}` → element znika, Snackbar „Usunięto”.
- **Usunięcie grupy „z przepisu” (US-053)**:
  - klik kosza na pozycji `RECIPE` → grupa znika natychmiast (optymistycznie) → Snackbar „Usunięto… / Cofnij”.
  - **Undo** w oknie czasowym → przywrócenie danych lokalnie, bez wywołania API.
  - brak Undo → po zamknięciu Snackbara wykonanie `DELETE /shopping-list/recipe-items/group`.
  - usuwanie działa identycznie dla `is_owned=false` i `is_owned=true` (komenda zawiera `is_owned`).
- **Wyczyść listę (US-054)**:
  - klik akcji w nagłówku → modal potwierdzenia (komunikat: „nie wpływa na Twój plan”) → potwierdź → `DELETE /shopping-list` → lista pusta, Snackbar o sukcesie.

## 9. Warunki i walidacja
- **Dodawanie ręczne**:
  - `text.trim().length > 0` (frontend),
  - backend: `400` dla pustego.
- **Toggle**:
  - `groupKey` musi istnieć w aktualnie zgrupowanych danych,
  - operacja dotyczy wszystkich `rowIds` grupy.
- **Usunięcie manual**:
  - tylko `kind=MANUAL`,
  - `id > 0`.
- **Usunięcie grupy RECIPE**:
  - `name` niepuste,
  - `unit` może być `null`,
  - `is_owned` wymagane.
- **Prezentacja sumy**:
  - sumujemy tylko wtedy, gdy w całej grupie `amount != null` oraz `unit != null`,
  - w przeciwnym razie pokazujemy tylko `primaryText` (bez `secondaryText`).

## 10. Obsługa błędów
Wspólne zasady:
- stosować guard clauses (early returns),
- mapować błędy na czytelne komunikaty (`ApiError.message`),
- w razie niespójności lokalnego stanu po błędzie mutacji: wykonać `refreshShoppingList()`.

Scenariusze:
- **GET /shopping-list**: błąd → ekran błędu z przyciskiem „Spróbuj ponownie”.
- **POST /shopping-list/items**: błąd walidacji → Snackbar z komunikatem (np. „Wpisz nazwę pozycji.”).
- **PATCH /shopping-list/items/{id}**: błąd na dowolnym wierszu → rollback optymistyczny i Snackbar.
- **DELETE /shopping-list/items/{id}**:
  - `403` (próba usunięcia RECIPE) → komunikat „Nie można usuwać pozycji pochodzących z przepisów.”
  - `404` → komunikat „Nie znaleziono pozycji…”
- **DELETE /shopping-list/recipe-items/group**:
  - błąd → Snackbar + odświeżenie listy (żeby odzyskać spójność po optymistycznym ukryciu).
- **DELETE /shopping-list**: błąd → Snackbar.

## 11. Kroki implementacji
1. Dodaj/zweryfikuj routing do `/shopping` jako widoku prywatnego.
2. Zaimplementuj `ShoppingListService` jako jedyne źródło stanu (signals + computed) oraz warstwę API (invoke).
3. Zaimplementuj grupowanie `RECIPE` po (`name`, `unit`, `is_owned`) i sumowanie `amount` wyłącznie, gdy w grupie wszystko jest kompletne.
4. Zaimplementuj sortowanie: `isOwned=false` u góry, `isOwned=true` na dole, stabilnie po `primaryText` w locale `pl`.
5. Zaimplementuj `ShoppingPageComponent`:
   - load/refresh listy,
   - odświeżanie po `MyPlanService.planChanges`,
   - obsługa add/toggle/delete/clear.
6. Dodaj akcję „Wyczyść listę” w `pych-page-header` + `ConfirmDialogComponent` z jasnym komunikatem „Ta akcja nie wpłynie na Twój plan”.
7. Dodaj usuwanie grupy `RECIPE`:
   - kosz dostępny także dla `RECIPE` (ustaw `canDelete=true` dla grup RECIPE),
   - optymistyczne ukrycie grupy w UI,
   - `MatSnackBar` z „Cofnij” (Undo),
   - finalizacja `DELETE /shopping-list/recipe-items/group` po `afterDismissed()` bez `dismissedByAction`.
8. Zapewnij dostępność:
   - aria-label na checkboxach i koszu zawierający nazwę pozycji,
   - czytelne stany `loading/error/empty`.
9. Dodać (lub uzupełnić) testy jednostkowe serwisu:
   - poprawne grupowanie i sumowanie,
   - rozdzielanie po `is_owned`,
   - budowanie kluczy grup,
   - przypadki `amount=null`/`unit=null`.

