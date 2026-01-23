# Plan implementacji widoku Zakupy (lista zakupów) — **grupowanie po surowych wierszach**

## 1. Przegląd
Widok **Zakupy** pod ścieżką **`/shopping`** pozwala zalogowanemu użytkownikowi:
- przeglądać listę zakupów składającą się z:
    - pozycji „z przepisów” (backend zwraca **surowe wiersze**, jeden wiersz = jeden składnik jednego przepisu),
    - pozycji ręcznych (tekst użytkownika),
- dodawać ręczne pozycje tekstowe,
- oznaczać pozycje jako „posiadane” (toggling `is_owned`),
- usuwać wyłącznie pozycje ręczne (`kind = 'MANUAL'`),
- widzieć pozycje „posiadane” na dole listy (sortowanie),
- **widzieć pozycje z przepisów w widoku zgrupowanym**:
    - grupujemy **wyłącznie** `kind='RECIPE'` po (`name`, `unit`, `is_owned`),
    - w grupie **sumujemy ilości tylko wtedy**, gdy **dla wszystkich wierszy w grupie** `amount != null` i `unit != null`,
    - gdy `unit = null` **lub** w grupie występuje choć jeden wiersz z `amount = null` → prezentujemy pozycję jako „tylko nazwa” (bez sumowania).

Źródłem danych jest API (Supabase Edge Functions) zgodne z kontraktami z `shared/contracts/types.ts`. Frontend **nie wykonuje** bezpośrednich zapytań do tabel Supabase (`supabase.from(...)`) — używa wyłącznie `supabase.functions.invoke(...)`.

## 2. Routing widoku
- **Ścieżka**: `/shopping`
- **Dostęp**: prywatny (zalogowany użytkownik), w ramach App Shell.

W `src/app/app.routes.ts` (jeśli nie istnieje) dodaj trasę w grupie `MainLayoutComponent` (z guardem sesji):
- `path: 'shopping'`
- `loadComponent: () => import('./pages/shopping/shopping-page.component').then(m => m.ShoppingPageComponent)`
- `data: { breadcrumb: 'Zakupy' }`

(Opcjonalnie UX) dla gościa: redirect do logowania z `redirectTo=%2Fshopping`.

## 3. Struktura komponentów
Utrzymujemy istniejącą strukturę katalogów (już jest w repo):

```
src/app/pages/shopping/
    shopping-page.component.ts|html|scss
    components/
        shopping-add-item-form/
        shopping-list/
        shopping-list-item/
```

Wysokopoziomowy diagram drzewa komponentów:

```
ShoppingPageComponent (pych-shopping-page)
├─ PageHeaderComponent (pych-page-header)
├─ ShoppingAddItemFormComponent (pych-shopping-add-item-form)
└─ @if (loading/error/empty/content)
   ├─ (loading) MatProgressSpinner
   ├─ (error) inline error + "Spróbuj ponownie"
   ├─ (empty) EmptyStateComponent (pych-empty-state)
   └─ (content) ShoppingListComponent (pych-shopping-list)
      └─ @for groupItem of groupedItemsSorted
         └─ ShoppingListItemComponent (pych-shopping-list-item) // renderuje **pozycję zgrupowaną**
```

## 4. Szczegóły komponentów

### ShoppingPageComponent (`pych-shopping-page`)
- **Opis komponentu**: Główny widok `/shopping`. Odpowiada za:
    - inicjalne pobranie listy zakupów,
    - renderowanie stanów: loading / error / empty / content,
    - przekazywanie danych i handlerów do komponentów dzieci,
    - komunikaty użytkownika (Snackbar) dla sukcesów/błędów mutacji.
- **Główne elementy**:
    - `pych-page-header` z tytułem „Zakupy”
    - `pych-shopping-add-item-form`
    - `pych-shopping-list` (lista zgrupowana) lub `pych-empty-state`
- **Obsługiwane interakcje**:
    - wejście na widok → `loadShoppingList()`
    - retry po błędzie → `refreshShoppingList()`
    - submit dodania pozycji → `addManualItem()`
    - toggle `is_owned` na pozycji zgrupowanej:
        - `MANUAL`: patch pojedynczego `id`
        - `RECIPE`: patch **wszystkich wierszy w grupie** (`rowIds[]`)
    - delete manual item → `deleteManualItem(id)`
- **Obsługiwana walidacja**:
    - input manual: `trim().length > 0`
    - blokada wielokrotnego wysyłania w trakcie mutacji
- **Typy (DTO i ViewModel)**:
    - DTO: `GetShoppingListResponseDto`, `ShoppingListItemDto`, `ShoppingListItemRecipeDto`, `ShoppingListItemManualDto`, `AddManualShoppingListItemCommand`, `UpdateShoppingListItemCommand`, `ApiError`
    - VM: `ShoppingListGroupedItemVm` (sekcja „Typy”)
- **Propsy**: brak (komponent routowany).

### ShoppingAddItemFormComponent (`pych-shopping-add-item-form`)
- **Opis komponentu**: Sekcja dodawania ręcznej pozycji (Reactive Forms).
- **Główne elementy**:
    - `mat-form-field` + `matInput` (placeholder np. „Dodaj coś…”, np. „papier toaletowy”)
    - `mat-flat-button` „Dodaj” (disabled zależnie od walidacji i `isSubmitting`)
- **Obsługiwane interakcje**:
    - Enter (submit)
    - klik „Dodaj”
- **Obsługiwana walidacja** (kontrakt `POST /shopping-list/items`):
    - `text` wymagane i po `trim()` nie może być puste
    - (opcjonalnie) limit długości — jeśli backend go wprowadzi, UI waliduje przed requestem
- **Typy (DTO i ViewModel)**:
    - `ShoppingAddItemFormVm` (Reactive Form)
- **Propsy**:
    - `isSubmitting: boolean`
    - output `add: string`

### ShoppingListComponent (`pych-shopping-list`)
- **Opis komponentu**: Renderuje listę **zgrupowanych** pozycji zakupów:
    - reguły sortowania:
        - `isOwned=false` na górze,
        - `isOwned=true` na dole,
        - stabilnie wewnątrz grup po `primaryText` (`localeCompare('pl')`).
- **Główne elementy**:
    - `mat-list`
    - `@for` po `groupedItemsSorted`
- **Obsługiwane interakcje**:
    - deleguje do `ShoppingListItemComponent`
- **Obsługiwana walidacja**: brak (dostaje przygotowany VM).
- **Typy (DTO i ViewModel)**:
    - input: `ShoppingListGroupedItemVm[]`
- **Propsy**:
    - `items: ShoppingListGroupedItemVm[]`
    - `toggleInProgressKeys: Set<string>` (klucze grup) **lub** `toggleInProgressRowIds: Set<number>` (jeśli blokujemy per-wiersz)
    - `deleteInProgressIds: Set<number>` (manual per id)
    - outputy:
        - `toggleOwned: { groupKey: string; next: boolean }`
        - `deleteManual: number`

### ShoppingListItemComponent (`pych-shopping-list-item`)
- **Opis komponentu**: Pojedynczy wiersz listy w widoku **zgrupowanym**.
    - `RECIPE`: prezentuje `name` oraz (opcjonalnie) zagregowane `amount unit` (tylko gdy sumowanie jest możliwe),
    - `MANUAL`: prezentuje `text` i umożliwia usunięcie.
- **Główne elementy**:
    - `mat-checkbox` (leading) → steruje `isOwned`
    - tekst:
        - `primaryText` (np. `cukier`, `papier toaletowy`)
        - `secondaryText` (np. `250 g` lub `null`)
    - `mat-icon-button delete` (tylko `MANUAL`)
    - (opcjonalnie UX) mała etykieta „×N” dla grupy `RECIPE`, aby pokazać że to suma z wielu wierszy
- **Obsługiwane interakcje**:
    - zmiana checkboxa → emit `toggleOwned({ groupKey, next })`
    - klik kosza → emit `deleteManual(id)` (tylko `MANUAL`)
- **Obsługiwana walidacja**:
    - przycisk usuwania ukryty dla `RECIPE` (backend odrzuca DELETE dla `RECIPE`),
    - blokada checkboxa w trakcie mutacji (dla całej grupy).
- **Typy (DTO i ViewModel)**:
    - `ShoppingListGroupedItemVm`
- **Propsy**:
    - `item: ShoppingListGroupedItemVm`
    - `isToggling: boolean`
    - `isDeleting: boolean`
    - outputy:
        - `toggleOwned`
        - `deleteManual`

## 5. Typy
Źródłem prawdy są istniejące typy w `shared/contracts/types.ts`:
- **Response**: `GetShoppingListResponseDto` (`{ data, meta }`)
- **Item**: `ShoppingListItemDto` (`ShoppingListItemRecipeDto | ShoppingListItemManualDto`)
- **Commands**:
    - `AddManualShoppingListItemCommand` (`{ text: string }`)
    - `UpdateShoppingListItemCommand` (`{ is_owned: boolean }`)
- **Errors**: `ApiError` (`{ message: string; status: number }`)

Nowe/rekomendowane ViewModele dla widoku zgrupowanego (trzymane np. w `src/app/pages/shopping/models/shopping.models.ts` albo w serwisie, jeśli repo preferuje typy przy serwisach):

### `ShoppingListGroupedItemKey`
- **Opis**: deterministyczny klucz grupowania dla `RECIPE`.
- **Pola**:
    - `name: string`
    - `unit: NormalizedIngredientUnit | null`
    - `is_owned: boolean`
- **Serializacja**: `groupKey = \`${name}||${unit ?? 'null'}||${is_owned ? '1' : '0'}\`` (lub bezpieczniej JSON + base64); klucz musi być stabilny.

### `ShoppingListGroupedItemVm`
- **Pola wspólne**:
    - `groupKey: string`
    - `kind: 'RECIPE' | 'MANUAL'`
    - `isOwned: boolean`
    - `primaryText: string`
    - `secondaryText: string | null`
    - `canDelete: boolean`
- **Dla `RECIPE`**:
    - `rowIds: number[]` (wszystkie surowe wiersze w grupie; potrzebne do grupowego toggle)
    - `rowCount: number`
    - `sumAmount: number | null` (tylko jeśli możliwe sumowanie)
    - `unit: NormalizedIngredientUnit | null`
    - (opcjonalnie) `recipeIds: number[]` / `recipeNames: string[]` — tylko do przyszłego drill-down, nie wymagane w MVP
- **Dla `MANUAL`**:
    - `id: number` (pojedynczy item)
    - `rowIds: [id]` (dla ujednolicenia logiki blokad)

### `ShoppingListMutationState` (rozszerzenie)
- `isAddingManual: boolean`
- `togglingGroupKeys: Set<string>` **lub** `togglingRowIds: Set<number>`
- `deletingItemIds: Set<number>`

## 6. Zarządzanie stanem
Rekomendacja (zgodna z regułami projektu): **signals + computed**, OnPush, bez „white flash” podczas odświeżania.

W `ShoppingListService` (singleton w `src/app/core/services/`):
- `state: signal<ShoppingListState>` przechowuje **surowe** `ShoppingListItemDto[]` z API.
- `groupedItems: computed<ShoppingListGroupedItemVm[]>`:
    - rozdziela `MANUAL` (bez grupowania) i `RECIPE` (grupuje po `name/unit/is_owned`),
    - wylicza `secondaryText`:
        - jeśli **wszystkie** elementy grupy mają `amount != null` i `unit != null` → `sum = Σamount`, `secondaryText = \`${sum} ${unit}\``
        - w przeciwnym razie `secondaryText = null`
- `groupedItemsSorted: computed<ShoppingListGroupedItemVm[]>` sortuje wg reguł (isOwned → primaryText).

Mutacje:
- `addManualItem(command)`:
    - po sukcesie dopina nowy `MANUAL` do `state.data`
- `toggleOwned(groupKey, next)`:
    - `MANUAL`: patch jednego `id`
    - `RECIPE`: patch **wszystkich** `rowIds[]` z grupy
    - optymistycznie zmienia `is_owned` dla wszystkich dotkniętych surowych wierszy
    - rollback całej grupy w przypadku błędu
    - UI blokuje checkbox dla całej grupy w trakcie mutacji
- `deleteManualItem(id)` bez zmian (tylko `MANUAL`)

## 7. Integracja API
Wszystkie wywołania przez `SupabaseService.functions.invoke()` (zgodnie z zasadą: frontend nie dotyka tabel Supabase):

### `GET /shopping-list`
- `invoke<GetShoppingListResponseDto>('shopping-list', { method: 'GET' })`
- backend zwraca surowe wiersze `RECIPE` z polami m.in. `recipe_id`, `recipe_name`, `name`, `amount`, `unit`, `is_owned`.
- frontend **ignoruje** `recipe_id/recipe_name` przy kluczu grupowania (zgodnie z wymaganiem grupowania po `name/unit/is_owned`).

### `POST /shopping-list/items`
- `invoke<ShoppingListItemManualDto>('shopping-list/items', { method: 'POST', body: AddManualShoppingListItemCommand })`
- po sukcesie: dopiąć element lokalnie + zaktualizować `meta.manual_items` i `meta.total`.

### `PATCH /shopping-list/items/{id}`
- `invoke<ShoppingListItemDto>(\`shopping-list/items/${id}\`, { method: 'PATCH', body: UpdateShoppingListItemCommand })`
- w widoku zgrupowanym, dla `RECIPE` wykonujemy **wiele PATCH** (po jednym na `id`) aby utrwalić stan dla wszystkich surowych wierszy.
    - rekomendacja techniczna: `from(rowIds).pipe(concatMap(id => patch...), toArray())` aby ograniczyć równoległość (bezpieczniej niż pełny `forkJoin` przy dużych grupach).
    - błąd któregokolwiek requestu powoduje rollback całej grupy w UI.

### `DELETE /shopping-list/items/{id}`
- `invoke<void>(\`shopping-list/items/${id}\`, { method: 'DELETE' })`
- dozwolone tylko dla `MANUAL` (UI ukrywa akcję dla `RECIPE`).

## 8. Interakcje użytkownika
- **Wejście na `/shopping`**:
    - loader (gdy brak danych) / odświeżanie bez czyszczenia listy,
    - po sukcesie: stan pusty lub lista zgrupowana.
- **Dodanie ręcznej pozycji**:
    - walidacja `trim()`,
    - disable input/przycisk podczas requestu,
    - po sukcesie: nowa pozycja widoczna, Snackbar „Dodano”.
- **Odhaczanie „posiadane” (zgrupowane)**:
    - `MANUAL`: standardowy toggle,
    - `RECIPE`: toggle aktualizuje wszystkie wiersze w grupie (spójny stan `is_owned` w obrębie grupy),
    - po sukcesie: pozycja przeskakuje (sortowanie) i jest zde-emfazyzowana,
    - w trakcie: blokada checkboxa dla grupy.
- **Usuwanie ręcznej pozycji**:
    - tylko `MANUAL`,
    - po sukcesie: znika + Snackbar „Usunięto”.

## 9. Warunki i walidacja
- **Walidacja UI**:
    - `POST /shopping-list/items`: `text.trim().length > 0`
    - `PATCH /shopping-list/items/{id}`: `id > 0`, `is_owned` boolean
    - `DELETE /shopping-list/items/{id}`: tylko `MANUAL`
- **Warunki grupowania (krytyczne)**:
    - grupujemy **tylko** `RECIPE` po (`name`, `unit`, `is_owned`)
    - sumowanie ilości tylko gdy `unit != null` oraz **wszystkie** `amount != null` w grupie
    - jeśli `unit = null` lub choć jeden `amount = null` → prezentacja jako „tylko nazwa”
- **Loading UX**:
    - brak białych overlayów; przy odświeżaniu utrzymujemy dane i stosujemy np. `opacity: 0.5` na kontenerze listy.

## 10. Obsługa błędów
Mapowanie błędów (w `ShoppingListService`) na komunikaty:
- **401**: „Sesja wygasła. Zaloguj się ponownie.”
- **400**: „Wpisz nazwę pozycji.” / „Nieprawidłowa pozycja listy.”
- **403**: „Nie można usuwać pozycji pochodzących z przepisów.”
- **404**: „Nie znaleziono pozycji listy (mogła zostać już usunięta).” (opcjonalnie: `refreshShoppingList()`)
- **500+**: „Wystąpił błąd. Spróbuj ponownie.”

Zasady:
- błędy mutacji → Snackbar (widok pozostaje interaktywny poza dotkniętą grupą),
- błąd `GET` → stan błędu + akcja retry,
- przy błędzie w grupowym toggle (częściowy failure) → rollback całej grupy i komunikat.

## 11. Kroki implementacji
1. **Zweryfikować kontrakt API i typy**: potwierdzić, że `GET /shopping-list` zwraca surowe wiersze `RECIPE` z `recipe_id`, `recipe_name`, `name`, `amount`, `unit`, `is_owned` (zgodnie z `ShoppingListItemRecipeDto`).
2. **Zaimplementować logikę grupowania w frontendzie**:
    - dodać `groupedItems` + `groupedItemsSorted` w `ShoppingListService`,
    - dodać stabilny `groupKey` oraz mapowanie surowych wierszy → `ShoppingListGroupedItemVm`.
3. **Zaktualizować komponenty listy**:
    - `ShoppingListComponent`: zamiast `ShoppingListItemVm[]` przyjmować `ShoppingListGroupedItemVm[]`,
    - `ShoppingListItemComponent`: renderować pozycję zgrupowaną (`rowCount`, `secondaryText`), blokować checkbox per grupa.
4. **Zaimplementować grupowy toggle**:
    - handler w `ShoppingPageComponent`: emitować `{ groupKey, next }`,
    - w serwisie: wykonać patch dla wszystkich `rowIds` grupy (z ograniczeniem równoległości) + rollback w razie błędu.
5. **Zachować istniejące operacje manual**:
    - `addManualItem` i `deleteManualItem` bez zmian semantycznych.
6. **Dostępność i UX**:
    - aria-labels dla ikon i checkboxów,
    - brak białych overlayów w loading.
7. **Testy (Vitest)**:
    - testy grupowania: klucz (`name/unit/is_owned`), sumowanie ilości, zachowanie dla `unit=null` i `amount=null`,
    - test grupowego toggle: optymistyczna zmiana + rollback.
