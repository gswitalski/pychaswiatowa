# Plan implementacji widoku Zakupy (lista zakupów)

## 1. Przegląd
Widok **Zakupy** pod ścieżką **`/shopping`** pozwala zalogowanemu użytkownikowi:
- przeglądać listę zakupów (pozycje z przepisów + pozycje ręczne),
- dodawać ręczne pozycje tekstowe,
- oznaczać pozycje jako „posiadane” (toggling `is_owned`),
- usuwać wyłącznie pozycje ręczne (`kind = 'MANUAL'`),
- widzieć pozycje „posiadane” na dole listy (sortowanie).

Źródłem danych jest API (Supabase Edge Functions) zgodne z kontraktami z `shared/contracts/types.ts`. Frontend **nie wykonuje** bezpośrednich zapytań do tabel Supabase (`supabase.from(...)`) — używa wyłącznie `supabase.functions.invoke(...)`.

## 2. Routing widoku
- **Nowa ścieżka**: `GET /shopping` (frontend route)
- **Dostęp**: prywatny (zalogowany użytkownik).

Zmiany w `src/app/app.routes.ts`:
- dodać trasę w grupie `MainLayoutComponent` (z `authenticatedMatchGuard`):
    - `path: 'shopping'`
    - `loadComponent: () => import('./pages/shopping/shopping-page.component').then(m => m.ShoppingPageComponent)`
    - `data: { breadcrumb: 'Zakupy' }`
- (rekomendowane UX) dodać w grupie `PublicLayoutComponent` redirect dla gościa:
    - `path: 'shopping'`
    - `redirectTo: () => '/login?redirectTo=%2Fshopping'`
    - `pathMatch: 'full'`

## 3. Struktura komponentów
Rekomendowana struktura katalogów (zgodna z istniejącym układem `src/app/pages/*`):

```
src/app/pages/shopping/
  shopping-page.component.ts
  shopping-page.component.html
  shopping-page.component.scss
  components/
    shopping-add-item-form/
      shopping-add-item-form.component.ts|html|scss
    shopping-list/
      shopping-list.component.ts|html|scss
    shopping-list-item/
      shopping-list-item.component.ts|html|scss
```

Wysokopoziomowy diagram drzewa komponentów:

```
ShoppingPageComponent (pych-shopping-page)
└─ PageHeaderComponent (pych-page-header)
└─ ShoppingAddItemFormComponent (pych-shopping-add-item-form)
└─ @if (loading/error/empty)
   ├─ (loading) MatSpinner / custom loader
   ├─ (error) ErrorState (inline) + przycisk "Spróbuj ponownie"
   └─ (empty) EmptyStateComponent (pych-empty-state)
└─ @else
   └─ ShoppingListComponent (pych-shopping-list)
      └─ @for item of itemsSorted
         └─ ShoppingListItemComponent (pych-shopping-list-item)
```

## 4. Szczegóły komponentów

### ShoppingPageComponent (`pych-shopping-page`)
- **Opis komponentu**: Główny widok `/shopping`. Odpowiada za:
    - inicjalne pobranie listy zakupów,
    - renderowanie stanów: loading / error / empty / content,
    - przekazywanie danych i handlerów do komponentów dzieci,
    - komunikaty użytkownika (Snackbar) dla sukcesów/błędów.
- **Główne elementy**:
    - `pych-page-header` z tytułem „Zakupy”
    - sekcja „Dodaj pozycję” (`pych-shopping-add-item-form`)
    - lista (`pych-shopping-list`) lub `pych-empty-state`
- **Obsługiwane interakcje**:
    - wejście na widok → `loadShoppingList()`
    - klik „Spróbuj ponownie” → ponowny `loadShoppingList()`
    - submit dodania pozycji → delegacja do serwisu + odświeżenie listy lokalnie
    - toggle `is_owned` → delegacja do serwisu (optymistycznie)
    - delete manual item → delegacja do serwisu (z opcjonalnym potwierdzeniem)
- **Obsługiwana walidacja**:
    - brak walidacji routingu (poza wymaganiem sesji),
    - UI nie wysyła żądań dla pustego tekstu (trim),
    - UI blokuje wielokrotne wysyłanie podczas trwających operacji.
- **Typy (DTO i ViewModel)**:
    - DTO: `GetShoppingListResponseDto`, `ShoppingListItemDto`, `AddManualShoppingListItemCommand`, `UpdateShoppingListItemCommand`, `ApiError`
    - VM: `ShoppingPageVm` (opis w sekcji „Typy”)
- **Propsy**: brak (komponent routowany).

### ShoppingAddItemFormComponent (`pych-shopping-add-item-form`)
- **Opis komponentu**: Sekcja dodawania ręcznej pozycji. Implementacja jako Reactive Forms (spójnie z resztą aplikacji).
- **Główne elementy**:
    - `mat-form-field` + `matInput` (placeholder np. „Dodaj coś…”, np. „papier toaletowy”)
    - `mat-flat-button` „Dodaj” (disabled w zależności od walidacji i `isSubmitting`)
- **Obsługiwane interakcje**:
    - Enter w polu (submit formularza)
    - klik „Dodaj”
- **Obsługiwana walidacja** (zgodnie z API `POST /shopping-list/items`):
    - `text` wymagane i po `trim()` nie może być puste
    - (opcjonalnie, jeśli backend wprowadzi limit) maksymalna długość — rekomendacja 200 znaków; w UI pokazujemy błąd walidacji zanim wyślemy request
- **Typy (DTO i ViewModel)**:
    - VM: `ShoppingAddItemFormVm`:
        - `text: FormControl<string>`
        - `isSubmitting: boolean` (lub signal)
- **Propsy**:
    - `isSubmitting: boolean`
    - `onAdd: (text: string) => void` (output event, np. `add = output<string>()`)

### ShoppingListComponent (`pych-shopping-list`)
- **Opis komponentu**: Renderuje listę pozycji zakupów, już posortowaną wg reguł MVP:
    - `is_owned = false` na górze,
    - `is_owned = true` na dole + zde-emfazyzowanie wizualne.
- **Główne elementy**:
    - `mat-list` / `mat-divider` (opcjonalnie) do separacji sekcji
    - `@for` po elementach `itemsSorted`
- **Obsługiwane interakcje**:
    - delegacja do `ShoppingListItemComponent`
- **Obsługiwana walidacja**:
    - brak; komponent przyjmuje przygotowane dane i flagi loading/mutation per item.
- **Typy (DTO i ViewModel)**:
    - input: `ShoppingListItemVm[]`
- **Propsy**:
    - `items: ShoppingListItemVm[]`
    - `toggleInProgressIds: Set<number>` (lub map `{[id]: boolean}`)
    - `deleteInProgressIds: Set<number>`
    - outputy:
        - `toggleOwned: (event: { id: number; next: boolean })`
        - `deleteManual: (id: number)`

### ShoppingListItemComponent (`pych-shopping-list-item`)
- **Opis komponentu**: Pojedynczy wiersz listy zakupów (pozycja z przepisu lub ręczna). Zapewnia:
    - checkbox „posiadane” (`is_owned`),
    - prezentację treści (dla `RECIPE`: `name + amount/unit`, dla `MANUAL`: `text`),
    - akcję usunięcia wyłącznie dla `MANUAL`.
- **Główne elementy**:
    - `mat-checkbox` (leading)
    - tekst/układ:
        - `RECIPE`: `name` + (opcjonalnie) `amount unit`
        - `MANUAL`: `text`
    - `mat-icon-button` z `delete` (tylko `MANUAL`)
- **Obsługiwane interakcje**:
    - zmiana checkboxa → emit `toggleOwned`
    - klik kosza → emit `deleteManual` (tylko `MANUAL`)
- **Obsługiwana walidacja**:
    - nie pokazujemy przycisku usuwania dla `kind='RECIPE'` (zgodnie z `DELETE` → 403 dla RECIPE),
    - blokujemy checkbox i przyciski podczas mutacji elementu (zapobiega multi-click).
- **Typy (DTO i ViewModel)**:
    - `ShoppingListItemVm` (zawiera m.in. `id`, `kind`, `displayText`, `secondaryText`, `isOwned`)
- **Propsy**:
    - `item: ShoppingListItemVm`
    - `isToggling: boolean`
    - `isDeleting: boolean`
    - outputy:
        - `toggleOwned`
        - `deleteManual`

## 5. Typy
Większość typów jest już dostępna w `shared/contracts/types.ts` i powinna być używana jako źródło prawdy dla integracji z API:
- **Response**: `GetShoppingListResponseDto` (`{ data, meta }`)
- **Item**: `ShoppingListItemDto` (union: `ShoppingListItemRecipeDto | ShoppingListItemManualDto`)
- **Commands**:
    - `AddManualShoppingListItemCommand` (`{ text: string }`)
    - `UpdateShoppingListItemCommand` (`{ is_owned: boolean }`)
- **Errors**: `ApiError` (frontendowy model błędu: `{ message: string; status: number }`)

Nowe typy ViewModel (rekomendowane, lokalne dla widoku, np. w `src/app/pages/shopping/models/shopping.models.ts`):

- **`ShoppingListItemVm`**:
    - `id: number`
    - `kind: 'RECIPE' | 'MANUAL'`
    - `isOwned: boolean` (mapowane z `is_owned`)
    - `primaryText: string` (np. `cukier` lub `papier toaletowy`)
    - `secondaryText: string | null` (np. `250 g`, `1 łyżeczka`, albo `null`)
    - `canDelete: boolean` (tylko `kind='MANUAL'`)
    - `raw: ShoppingListItemDto` (opcjonalnie — do debug/operacji)

- **`ShoppingListState`** (w serwisie, sygnały):
    - `data: ShoppingListItemDto[]`
    - `meta: GetShoppingListResponseDto['meta']`
    - `isLoading: boolean`
    - `isRefreshing: boolean` (jeśli wprowadzimy „odśwież” bez znikania danych)
    - `error: ApiError | null`
    - `lastLoadedAt: number | null` (opcjonalnie TTL jak w `MyPlanService`)

- **`ShoppingListMutationState`**:
    - `isAddingManual: boolean`
    - `togglingItemIds: Set<number>`
    - `deletingItemIds: Set<number>`

## 6. Zarządzanie stanem
Rekomendacja: dodać `ShoppingListService` jako **singleton** w `src/app/core/services/` (analogicznie do `MyPlanService`).

Wzorzec:
- Angular **signals** jako źródło prawdy (`signal`, `computed`),
- minimalny RxJS: `from(...).pipe(map/catchError/finalize)` wokół `supabase.functions.invoke()`,
- aktualizacje poprzez `state.update(...)` tam, gdzie zmieniamy fragment danych (żeby nie powodować „white flash” i utrzymać poprzednie dane widoczne podczas odświeżania).

Sugerowane computed:
- `itemsVm`: mapowanie `ShoppingListItemDto[]` → `ShoppingListItemVm[]`
- `itemsSorted`: sortowanie wg reguł:
    - `is_owned=false` na górze,
    - `is_owned=true` na dole,
    - stabilnie wewnątrz grup po `primaryText` (localeCompare, `pl`).
- `isEmpty`: `itemsSorted.length === 0 && !isLoading`

Obsługa loadingów:
- `isLoading` tylko przy pierwszym ładowaniu (gdy brak danych),
- `isRefreshing` przy reloadzie, bez czyszczenia listy (zachować poprzednie dane z `opacity: 0.5` na kontenerze listy zgodnie z zasadami projektu).

## 7. Integracja API
Wszystkie wywołania przez `SupabaseService.functions.invoke()`:

### `GET /shopping-list`
- **Wywołanie**: `invoke<GetShoppingListResponseDto>('shopping-list', { method: 'GET' })`
- **Zastosowanie w UI**:
    - na wejściu do widoku (`ngOnInit`)
    - po udanych mutacjach opcjonalnie (preferowane: aktualizacja lokalna dla szybkości).

### `POST /shopping-list/items`
- **Wywołanie**: `invoke<ShoppingListItemManualDto>('shopping-list/items', { method: 'POST', body: { text } satisfies AddManualShoppingListItemCommand })`
- **Zastosowanie w UI**:
    - po sukcesie: dodać element do `state.data` (lokalnie) + zaktualizować `meta.manual_items` i `meta.total`
    - wyczyścić input i pokazać Snackbar „Dodano”.

### `PATCH /shopping-list/items/{id}`
- **Wywołanie**: `invoke<ShoppingListItemDto>(\`shopping-list/items/${id}\`, { method: 'PATCH', body: { is_owned } satisfies UpdateShoppingListItemCommand })`
- **Zastosowanie w UI**:
    - optymistycznie ustawić `is_owned` lokalnie dla itemu,
    - w razie błędu: cofnąć zmianę i pokazać komunikat.

### `DELETE /shopping-list/items/{id}`
- **Wywołanie**: `invoke<void>(\`shopping-list/items/${id}\`, { method: 'DELETE' })`
- **Zastosowanie w UI**:
    - tylko dla `kind='MANUAL'`,
    - po sukcesie: usunąć element lokalnie + zaktualizować `meta.manual_items` i `meta.total`.

## 8. Interakcje użytkownika
- **Wejście na `/shopping`**:
    - UI pokazuje loader (jeśli brak danych),
    - pobiera listę zakupów,
    - po sukcesie renderuje listę lub stan pusty.
- **Dodanie ręcznej pozycji**:
    - użytkownik wpisuje tekst i klika „Dodaj” / Enter,
    - UI waliduje `trim().length > 0`,
    - podczas requestu: blokuje input + przycisk,
    - po sukcesie: element pojawia się na liście jako `MANUAL`, `is_owned=false`, Snackbar „Dodano”.
- **Odhaczanie „posiadane”**:
    - klik checkboxa na elemencie,
    - UI blokuje checkbox tylko dla tego elementu do czasu odpowiedzi,
    - po sukcesie: element trafia do odpowiedniej sekcji sortowania (na dół jeśli `is_owned=true`), jest wyszarzony (`opacity`).
- **Usuwanie ręcznej pozycji**:
    - widoczny tylko kosz przy `MANUAL`,
    - po kliknięciu: (opcjonalnie) potwierdzenie w dialogu, albo natychmiastowe usunięcie,
    - w trakcie requestu: blokada przycisku,
    - po sukcesie: element znika, Snackbar „Usunięto”.

## 9. Warunki i walidacja
- **Walidacja UI przed requestami**:
    - `POST /shopping-list/items`: `text` po trim niepusty (oraz opcjonalnie limit długości, jeśli zostanie przyjęty w backendzie).
    - `PATCH /shopping-list/items/{id}`:
        - `id` dodatni,
        - `is_owned` boolean (wynika z checkboxa).
    - `DELETE /shopping-list/items/{id}`:
        - `id` dodatni,
        - akcja dostępna tylko dla `kind='MANUAL'` (ukryta dla `RECIPE`).
- **Warunki UX**:
    - brak „białych overlayów” przy ładowaniu; przy odświeżaniu utrzymujemy listę widoczną i stosujemy zde-emfazyzowanie kontenera.
    - sortowanie: `is_owned=false` na górze, `is_owned=true` na dole.

## 10. Obsługa błędów
Rekomendowane mapowanie błędów na komunikaty (w `ShoppingListService`, podobnie jak `MyPlanService`):
- **401**: „Sesja wygasła. Zaloguj się ponownie.”
- **400**:
    - dla `POST`: „Wpisz nazwę pozycji.”
    - dla `PATCH/DELETE`: „Nieprawidłowa pozycja listy.”
- **403** (głównie DELETE na `RECIPE`): „Nie można usuwać pozycji pochodzących z przepisów.”
- **404**: „Nie znaleziono pozycji listy (mogła zostać już usunięta).” (opcjonalnie: odświeżyć listę)
- **500**: „Wystąpił błąd. Spróbuj ponownie.”

Zasady:
- błędy mutacji pokazujemy jako Snackbar (nie blokujemy całego widoku),
- dla błędu `GET /shopping-list` pokazujemy stan błędu z akcją „Spróbuj ponownie”.

## 11. Kroki implementacji
1. **Routing**: dodać trasę `/shopping` (auth) + (opcjonalnie) redirect dla gości; dodać `breadcrumb: 'Zakupy'`.
2. **App Shell / Sidebar**:
    - dodać pozycję menu „Zakupy” (`/shopping`) w `SidebarComponent`,
    - rozszerzyć `PRIVATE_PATHS` w `MainLayoutComponent` o `'/shopping'`,
    - rozszerzyć `MAIN_NAVIGATION_ITEMS` (`matchingRoutes`) o `'/shopping'`, żeby zakładka „Moja Pycha” była aktywna w tej sekcji.
3. **Serwis API**: utworzyć `ShoppingListService` w `src/app/core/services/`:
    - metody: `getShoppingList`, `addManualItem`, `updateItemOwned`, `deleteManualItem`,
    - stan: `ShoppingListState` + `ShoppingListMutationState` jako signals,
    - mapowanie błędów do `ApiError`.
4. **Komponenty widoku**:
    - `ShoppingPageComponent` (pobranie danych, stany, Snackbary),
    - `ShoppingAddItemFormComponent` (reactive form + trim validator),
    - `ShoppingListComponent` (render listy),
    - `ShoppingListItemComponent` (checkbox + delete dla manual).
5. **Styling i UX**:
    - zde-emfazyzowanie `is_owned=true` (np. `opacity: 0.6`, brak białych overlayów),
    - czytelne stany: loading/error/empty,
    - aria-labels dla ikon (kosz, checkbox).
6. **Testy jednostkowe (Vitest)**:
    - `ShoppingListService`: mapowanie DTO→VM, sortowanie, obsługa błędów (401/403/404),
    - `ShoppingAddItemFormComponent`: walidacja trim + disabled podczas submit.
7. **Testy manualne (E2E / smoke)**:
    - wejście na `/shopping` (zalogowany) → lista/empty,
    - dodanie manual item → pojawia się na liście,
    - toggle `is_owned` → element przeskakuje na dół,
    - delete manual item → znika,
    - symulacja błędu (np. odcięcie sieci) → poprawne komunikaty i brak utraty poprzednich danych.

