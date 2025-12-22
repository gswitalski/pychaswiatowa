# Zmiany: Szczegóły Kolekcji - Usunięcie Paginacji UI

## Data: 2025-12-23

## Przegląd

Implementacja widoku "Szczegóły Kolekcji" zgodnie z planem (US-031). Główna zmiana: **usunięcie paginacji z UI** i przejście na model batch-loading (jedno żądanie dla wszystkich przepisów w kolekcji, do limitu technicznego).

## Zakres Zmian

### 1. Model Widoku (`CollectionDetailsViewModel`)

**Plik:** `src/app/pages/collections/collection-details/models/collection-details.model.ts`

**Zmiany:**
- ❌ Usunięto: `pagination: PaginationDetails`
- ✅ Dodano: `recipesPageInfo: CollectionRecipesPageInfoDto | null`
- ✅ Dodano: Typowany error z kind: `{ kind: CollectionDetailsErrorKind; message: string } | null`
- ✅ Dodano: Typy błędów: `'invalid_id' | 'not_found' | 'forbidden' | 'server' | 'unknown'`

**Przed:**
```typescript
interface CollectionDetailsViewModel {
    // ...
    recipes: RecipeListItemDto[];
    pagination: PaginationDetails;
    error: string | null;
}
```

**Po:**
```typescript
interface CollectionDetailsViewModel {
    // ...
    recipes: RecipeListItemDto[];
    recipesPageInfo: CollectionRecipesPageInfoDto | null;
    error: {
        kind: CollectionDetailsErrorKind;
        message: string;
    } | null;
}
```

---

### 2. API Service (`CollectionsApiService`)

**Plik:** `src/app/core/services/collections-api.service.ts`

**Zmiany:**
- ❌ Usunięto parametr: `page`
- ✅ Zmieniono parametry: `limit` (domyślnie 500), `sort` (domyślnie 'created_at.desc')
- Query string z `?page=1&limit=12` → `?limit=500&sort=created_at.desc`

**Przed:**
```typescript
getCollectionDetails(id: number, page = 1, limit = 12): Observable<CollectionDetailDto>
```

**Po:**
```typescript
getCollectionDetails(id: number, limit = 500, sort = 'created_at.desc'): Observable<CollectionDetailDto>
```

---

### 3. Komponent Strony (`CollectionDetailsPageComponent`)

**Plik:** `src/app/pages/collections/collection-details/collection-details-page.component.ts`

**Zmiany:**
- ❌ Usunięto: `currentPage` signal, `onPageChange()`, import `PageEvent`
- ❌ Usunięto: `pageSize` constant
- ✅ Dodano: `RECIPES_LIMIT = 500` (limit techniczny)
- ✅ Dodano: `isTruncated()` computed signal
- ✅ Dodano: `totalRecipesCount()` computed signal
- ✅ Dodano: `parseError()` - mapowanie błędów na typowane kinds
- ✅ Dodano: `retry()` - metoda do ponowienia ładowania
- ✅ Zmieniono: `loadCollectionDetails()` - ładuje dane jednorazowo, bez parametru `page`
- ✅ Dodano: `reloadCollectionDetails()` - używana po usunięciu przepisu
- ✅ Poprawiono: UX usuwania przepisu zgodnie z zasadami loading states:
  - Używa `state.update()` zamiast `state.set()`
  - Utrzymuje poprzednie dane widoczne podczas reloadu
  - Sygnalizuje loading bez zerowania listy

**Effect zmieniony:**
```typescript
// Przed
effect(() => {
    const id = this.collectionId();
    const page = this.currentPage();
    if (id !== null) {
        this.loadCollectionDetails(id, page);
    }
});

// Po
effect(() => {
    const id = this.collectionId();
    if (id !== null) {
        this.loadCollectionDetails(id);
    }
});
```

---

### 4. Template HTML

**Plik:** `src/app/pages/collections/collection-details/collection-details-page.component.html`

**Zmiany:**
- ✅ Dodano: Banner ostrzegawczy `truncation-warning` gdy `isTruncated() === true`
- ✅ Zmieniono: Wyświetlanie liczby przepisów z `pagination().totalItems` → `totalRecipesCount()`
- ✅ Zmieniono: Error state używa `errorObj.kind` do warunkowego renderowania przycisku "Spróbuj ponownie"
- ✅ Dodano: Przycisk "Wróć do listy kolekcji" w empty state
- ✅ Zmieniono: `pych-recipe-list` używa `[usePaginator]="false"` (bez paginatora)
- ❌ Usunięto: Binding `[pagination]`, `[pageSize]`, `(pageChange)`

**RecipeListComponent usage:**
```html
<!-- Przed -->
<pych-recipe-list
    [recipes]="recipeListItems()"
    [isLoading]="isLoading()"
    [showRemoveAction]="true"
    [pagination]="pagination()"
    [pageSize]="12"
    (pageChange)="onPageChange($event)"
    (removeRecipe)="onRemoveRecipe($event)"
/>

<!-- Po -->
<pych-recipe-list
    [recipes]="recipeListItems()"
    [isLoading]="isLoading()"
    [showRemoveAction]="true"
    [usePaginator]="false"
    (removeRecipe)="onRemoveRecipe($event)"
/>
```

---

### 5. Style SCSS

**Plik:** `src/app/pages/collections/collection-details/collection-details-page.component.scss`

**Dodane style:**
- `.error-actions` - kontener dla przycisków w stanie błędu
- `.truncation-warning` - banner informacyjny o obcięciu listy
- Responsive adjustments dla mobile

---

## Zachowania UI

### Loading States ✅

Zgodnie z zasadami projektu (`LOADING_STATES_AND_SORTING`):
- ✅ Używa `state.update()` zamiast `state.set()` podczas reloadów
- ✅ NIE używa białych semi-transparent overlays
- ✅ Utrzymuje poprzednie dane widoczne podczas ładowania
- ✅ `RecipeListComponent` używa `opacity: 0.5` na `.recipes-grid` podczas loading (klasa `.is-loading`)

### Error Handling ✅

Typowane błędy z odpowiednimi komunikatami:
- `invalid_id` - "Nieprawidłowy identyfikator kolekcji."
- `not_found` - "Nie znaleziono kolekcji. Być może została usunięta."
- `forbidden` - "Nie masz dostępu do tej kolekcji."
- `server` - "Wystąpił błąd serwera. Spróbuj ponownie później."
- `unknown` - "Wystąpił nieoczekiwany błąd podczas ładowania kolekcji."

Przyciski akcji:
- Zawsze: "Wróć do listy kolekcji"
- Warunkowo (server/unknown): "Spróbuj ponownie"

### Truncation Warning ✅

Gdy `recipesPageInfo.truncated === true`:
- Wyświetla banner informacyjny (żółty/tertiary color)
- Komunikat: "Wyświetlono tylko część przepisów z powodu ograniczeń technicznych. Niektóre przepisy mogą nie być widoczne."

### Empty State ✅

Gdy kolekcja nie ma przepisów:
- Ikona `restaurant`
- Tytuł: "Brak przepisów"
- Opis: "Ta kolekcja nie zawiera jeszcze żadnych przepisów."
- Hint: "Dodaj przepisy do kolekcji z poziomu strony przepisu."
- Akcja: "Wróć do listy kolekcji"

---

## Integracja Backend

### API Endpoint: `GET /collections/{id}`

Backend już wspiera nowy kontrakt:

**Query params:**
- `limit` (1-500, default: 500)
- `sort` (format: `field.direction`, np. `created_at.desc`)

**Response:** `CollectionDetailDto`
```typescript
{
    id: number;
    name: string;
    description: string | null;
    recipes: {
        data: RecipeListItemDto[];
        pageInfo: {
            limit: number;
            returned: number;
            truncated: boolean;
        };
    };
}
```

---

## Komponenty Współdzielone

### RecipeListComponent ✅

Komponent już wspiera tryb bez paginatora:
- Input: `usePaginator: boolean = true`
- Gdy `usePaginator=false`, `mat-paginator` nie renderuje się
- Loading state używa klasy `.is-loading` z `opacity: 0.5` (zgodnie z zasadami)

### CollectionHeaderComponent ✅

Komponent prezentacyjny:
- Input: `collectionData: { name: string; description: string | null }`
- Wyświetla nazwę i opis kolekcji

---

## Routing ✅

**Plik:** `src/app/pages/collections/collections.routes.ts`

Routing skonfigurowany poprawnie z lazy loading:
```typescript
{
    path: ':id',
    loadComponent: () => import('./collection-details/collection-details-page.component')
        .then((m) => m.CollectionDetailsPageComponent),
    data: { breadcrumb: 'Szczegóły' },
}
```

---

## Testy / Weryfikacja

### Brak błędów kompilacji ✅
- Wszystkie pliki TypeScript kompilują się bez błędów
- Brak błędów linter

### Zgodność z wymaganiami ✅
- ✅ Brak paginacji w UI
- ✅ Czytelny stan ładowania
- ✅ Stan pusty z akcją powrotu
- ✅ Czytelne komunikaty dla 403/404
- ✅ Obsługa limitu technicznego (truncation warning)
- ✅ Poprawne loading states (bez white overlay)
- ✅ Używa `state.update()` podczas reloadów

---

## Pliki Zmienione

1. `src/app/pages/collections/collection-details/models/collection-details.model.ts` - Model widoku
2. `src/app/core/services/collections-api.service.ts` - API service
3. `src/app/pages/collections/collection-details/collection-details-page.component.ts` - Komponent strony
4. `src/app/pages/collections/collection-details/collection-details-page.component.html` - Template
5. `src/app/pages/collections/collection-details/collection-details-page.component.scss` - Style

## Kompatybilność wsteczna

### Breaking changes: NIE

Frontend komunikuje się z tym samym endpointem `GET /collections/{id}`, tylko zmienione są query params:
- Stare zapytanie: `?page=1&limit=12` (będzie ignorowane przez backend)
- Nowe zapytanie: `?limit=500&sort=created_at.desc`

Backend już wspiera nowy format odpowiedzi (`CollectionDetailDto` z `recipes.pageInfo`).

---

## Zgodność z zasadami projektu

### ✅ API Communication
- Frontend NIE używa `supabase.from(...)` bezpośrednio
- Wszystkie operacje przez `supabase.functions.invoke(...)` (Edge Functions)

### ✅ Angular Coding Standards
- Standalone components
- Signals dla state management
- `inject()` zamiast constructor injection
- Control flow z `@if`, `@for`
- OnPush change detection

### ✅ Loading States
- Używa `state.update()` zamiast `state.set()`
- Brak białych overlay
- `opacity: 0.5` na danych podczas ładowania

---

## Status: ✅ UKOŃCZONE

Implementacja zgodna z planem i wszystkimi zasadami projektu.

