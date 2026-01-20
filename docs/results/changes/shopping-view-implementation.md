# Implementacja widoku Zakupy (lista zakupów)

**Data:** 2026-01-20  
**Status:** ✅ Ukończone

## Przegląd

Zaimplementowano pełny widok listy zakupów pod ścieżką `/shopping` zgodnie z planem implementacji. Widok umożliwia użytkownikowi:
- przeglądanie listy zakupów (pozycje z przepisów + pozycje ręczne)
- dodawanie ręcznych pozycji tekstowych
- oznaczanie pozycji jako „posiadane" (toggling `is_owned`)
- usuwanie wyłącznie pozycji ręcznych (`kind = 'MANUAL'`)
- automatyczne sortowanie (pozycje „posiadane" na dole listy)

## Zrealizowane kroki

### 1. Routing ✅
**Pliki:** `src/app/app.routes.ts`

- Dodano trasę `/shopping` w grupie `MainLayoutComponent` (zalogowani użytkownicy)
- Dodano lazy loading dla `ShoppingPageComponent`
- Dodano breadcrumb `'Zakupy'`
- Dodano redirect dla gości (`/shopping` → `/login?redirectTo=%2Fshopping`)

### 2. App Shell / Sidebar ✅
**Pliki:**
- `src/app/layout/main-layout/components/sidebar/sidebar.component.ts`
- `src/app/layout/main-layout/main-layout.component.ts`
- `src/app/shared/models/ui.models.ts`

- Dodano pozycję menu "Zakupy" w `SidebarComponent` z ikoną `shopping_cart`
- Rozszerzono `PRIVATE_PATHS` w `MainLayoutComponent` o `/shopping`
- Rozszerzono `matchingRoutes` w `MAIN_NAVIGATION_ITEMS` o `/shopping` (zakładka "Moja Pycha" aktywna)

### 3. Serwis API ✅
**Plik:** `src/app/core/services/shopping-list.service.ts`

Utworzono `ShoppingListService` jako singleton z pełną funkcjonalnością:

#### Stan i sygnały:
- `ShoppingListState` - dane listy, meta, loading, error
- `ShoppingListMutationState` - stany mutacji (dodawanie, toggle, usuwanie)
- Computed signals:
  - `itemsVm` - mapowanie DTO → ViewModel
  - `itemsSorted` - sortowanie (is_owned=false na górze, alfabetycznie)
  - `isEmpty`, `total`, `isLoading`, `isRefreshing`, `error`

#### Metody API (zgodnie z architekturą - tylko `supabase.functions.invoke()`):
- `getShoppingList()` - GET /shopping-list
- `addManualItem()` - POST /shopping-list/items
- `updateItemOwned()` - PATCH /shopping-list/items/{id} (z optymistyczną aktualizacją + rollback)
- `deleteManualItem()` - DELETE /shopping-list/items/{id}
- `loadShoppingList()` - ładowanie z cache (TTL 60s)
- `refreshShoppingList()` - wymuszenie odświeżenia
- `resetState()` - reset przy wylogowaniu

#### Obsługa błędów:
Mapowanie statusów HTTP na czytelne komunikaty po polsku:
- 401: "Sesja wygasła. Zaloguj się ponownie."
- 400: "Wpisz nazwę pozycji." / "Nieprawidłowa pozycja listy."
- 403: "Nie można usuwać pozycji pochodzących z przepisów."
- 404: "Nie znaleziono pozycji listy (mogła zostać już usunięta)."
- 500: "Wystąpił błąd. Spróbuj ponownie."

### 4. Komponenty widoku ✅

#### ShoppingPageComponent
**Pliki:**
- `src/app/pages/shopping/shopping-page.component.ts|html|scss`

Główny widok odpowiedzialny za:
- inicjalne pobranie listy zakupów
- renderowanie stanów: loading / error / empty / content
- przekazywanie danych i handlerów do komponentów dzieci
- komunikaty użytkownika (Snackbar) dla sukcesów/błędów

**Stany:**
- Loading: spinner + "Ładowanie listy zakupów..."
- Error: komunikat błędu + przycisk "Spróbuj ponownie"
- Empty: `EmptyStateComponent` z ikoną koszyka i opisem
- Content: formularz + lista

#### ShoppingAddItemFormComponent
**Pliki:**
- `src/app/pages/shopping/components/shopping-add-item-form/shopping-add-item-form.component.ts|html|scss`

Formularz dodawania ręcznej pozycji:
- Reactive Forms z walidacją (required, trim)
- Pole input + przycisk "Dodaj"
- Disabled podczas wysyłania
- Responsywny (stack vertically na mobile)

#### ShoppingListComponent
**Pliki:**
- `src/app/pages/shopping/components/shopping-list/shopping-list.component.ts|html|scss`

Kontener listy zakupów:
- Renderuje posortowaną listę pozycji
- Deleguje interakcje do `ShoppingListItemComponent`
- Używa `mat-list` + `mat-divider`

#### ShoppingListItemComponent
**Pliki:**
- `src/app/pages/shopping/components/shopping-list-item/shopping-list-item.component.ts|html|scss`

Pojedynczy wiersz listy:
- Checkbox "posiadane" (leading)
- Treść:
  - RECIPE: `name` + opcjonalnie `amount unit` (secondary text)
  - MANUAL: `text`
- Przycisk usuwania (tylko MANUAL, trailing)
- Blokada podczas mutacji
- Aria-labels dla dostępności

### 5. Styling i UX ✅

#### Zde-emfazyzowanie pozycji "posiadanych":
- `opacity: 0.6` dla całego elementu
- `text-decoration: line-through` dla tekstu głównego
- Automatyczne przesunięcie na dół listy (sortowanie)

#### Brak białych overlayów:
- Podczas odświeżania: `opacity: 0.5` na kontenerze listy (`.shopping-page__list-container--refreshing`)
- Poprzednie dane pozostają widoczne
- Zgodnie z zasadami projektu: `state.update()` zamiast `state.set()` dla zachowania danych

#### Responsywność:
- Formularz: stack vertically na mobile (<600px)
- Lista: pełna szerokość, scrollable
- Material Design components dla spójności

### 6. Testy jednostkowe (Vitest) ✅
**Plik:** `src/app/core/services/shopping-list.service.spec.ts`

Utworzono 16 testów jednostkowych dla `ShoppingListService`:

#### Testy API:
- ✅ `getShoppingList()` - sukces, pusta lista, błąd API
- ✅ `addManualItem()` - sukces, walidacja pustego tekstu, błąd 400
- ✅ `updateItemOwned()` - sukces, rollback przy błędzie, walidacja ID
- ✅ `deleteManualItem()` - sukces, błąd 403 (RECIPE), walidacja ID

#### Testy logiki:
- ✅ `itemsSorted` - sortowanie wg reguł (is_owned=false na górze, alfabetycznie)
- ✅ Mapowanie DTO → ViewModel (RECIPE, MANUAL)
- ✅ `resetState()` - reset całego stanu

**Wynik:** ✅ 16/16 testów przechodzi

## Struktura plików

```
src/app/
├── app.routes.ts (zmienione)
├── core/
│   └── services/
│       ├── shopping-list.service.ts (nowe)
│       └── shopping-list.service.spec.ts (nowe)
├── layout/
│   └── main-layout/
│       ├── components/
│       │   └── sidebar/
│       │       └── sidebar.component.ts (zmienione)
│       └── main-layout.component.ts (zmienione)
├── pages/
│   └── shopping/
│       ├── shopping-page.component.ts|html|scss (nowe)
│       └── components/
│           ├── shopping-add-item-form/
│           │   └── shopping-add-item-form.component.ts|html|scss (nowe)
│           ├── shopping-list/
│           │   └── shopping-list.component.ts|html|scss (nowe)
│           └── shopping-list-item/
│               └── shopping-list-item.component.ts|html|scss (nowe)
└── shared/
    └── models/
        └── ui.models.ts (zmienione)
```

## Integracja z API

Wszystkie wywołania przez `SupabaseService.functions.invoke()` (zgodnie z architekturą):

| Endpoint | Metoda | Zastosowanie w UI |
|----------|--------|-------------------|
| `GET /shopping-list` | GET | Pobieranie listy przy wejściu na widok |
| `POST /shopping-list/items` | POST | Dodawanie ręcznej pozycji + aktualizacja lokalna |
| `PATCH /shopping-list/items/{id}` | PATCH | Toggle is_owned (optymistycznie) |
| `DELETE /shopping-list/items/{id}` | DELETE | Usuwanie MANUAL + aktualizacja lokalna |

## Interakcje użytkownika

### 1. Wejście na `/shopping`
- UI pokazuje loader (jeśli brak danych w cache)
- Pobiera listę zakupów
- Po sukcesie renderuje listę lub stan pusty

### 2. Dodanie ręcznej pozycji
- Użytkownik wpisuje tekst i klika "Dodaj" / Enter
- UI waliduje `trim().length > 0`
- Podczas requestu: blokuje input + przycisk
- Po sukcesie: element pojawia się na liście jako `MANUAL`, `is_owned=false`
- Snackbar: "Dodano"

### 3. Odhaczanie „posiadane"
- Klik checkboxa na elemencie
- UI blokuje checkbox tylko dla tego elementu
- Optymistyczna aktualizacja (natychmiastowe przesunięcie na dół)
- Po sukcesie: element trafia do sekcji `is_owned=true`, jest wyszarzony
- Przy błędzie: rollback + Snackbar z komunikatem

### 4. Usuwanie ręcznej pozycji
- Widoczny tylko kosz przy `MANUAL`
- Po kliknięciu: natychmiastowe usunięcie
- W trakcie requestu: blokada przycisku (spinner)
- Po sukcesie: element znika, Snackbar "Usunięto"

## Zgodność z planem implementacji

✅ Wszystkie punkty z planu zostały zrealizowane:
1. ✅ Routing - trasa `/shopping` (auth) + redirect dla gości
2. ✅ App Shell/Sidebar - pozycja menu "Zakupy"
3. ✅ Serwis API - `ShoppingListService` z pełną funkcjonalnością
4. ✅ Komponenty widoku - 4 komponenty (page + 3 dzieci)
5. ✅ Styling i UX - zde-emfazyzowanie, brak białych overlayów
6. ✅ Testy jednostkowe - 16 testów (100% pass rate)

## Zgodność z zasadami projektu

### Angular Coding Standards ✅
- ✅ Standalone components
- ✅ Signals dla state management
- ✅ Inject function zamiast constructor injection
- ✅ Control flow: `@if`, `@for`
- ✅ OnPush change detection
- ✅ Prefix `pych-` dla selektorów

### API Communication ✅
- ✅ TYLKO `supabase.functions.invoke()` (NIGDY `supabase.from()`)
- ✅ Wszystkie operacje przez REST API (Edge Functions)
- ✅ Obsługa błędów z mapowaniem na czytelne komunikaty

### Loading States and Sorting ✅
- ✅ `state.update()` zamiast `state.set()` dla zachowania danych
- ✅ NIGDY białe semi-transparent backgrounds w loading overlays
- ✅ `opacity: 0.5` na kontenerze podczas odświeżania
- ✅ Poprzednie dane widoczne podczas ładowania nowych

### Testing ✅
- ✅ Vitest z importami Zone.js
- ✅ Inicjalizacja TestBed w beforeAll
- ✅ Mocki z `vi.fn()`
- ✅ Arrange-Act-Assert pattern
- ✅ Testy logiki biznesowej i edge cases

## Build Output

Widok został pomyślnie zbudowany i lazy-loaded:
```
chunk-PCYOI4M7.js | shopping-page-component | 55.12 kB
```

## Następne kroki (opcjonalne)

Potencjalne rozszerzenia (poza MVP):
- [ ] Testy E2E (Playwright) dla krytycznych ścieżek
- [ ] Potwierdzenie usuwania (dialog) dla pozycji ręcznych
- [ ] Grupowanie pozycji po kategoriach (np. "Warzywa", "Nabiał")
- [ ] Eksport listy do PDF/druku
- [ ] Udostępnianie listy innym użytkownikom
- [ ] Historia usuniętych pozycji (undo)

## Podsumowanie

Widok Zakupy został w pełni zaimplementowany zgodnie z planem i zasadami projektu. Wszystkie funkcjonalności MVP działają poprawnie:
- ✅ Przeglądanie listy (pozycje z przepisów + ręczne)
- ✅ Dodawanie ręcznych pozycji
- ✅ Oznaczanie jako "posiadane"
- ✅ Usuwanie pozycji ręcznych
- ✅ Automatyczne sortowanie
- ✅ Responsywny design
- ✅ Obsługa błędów
- ✅ Testy jednostkowe (16/16 ✅)

Aplikacja jest gotowa do testów manualnych i integracji z backendem.
