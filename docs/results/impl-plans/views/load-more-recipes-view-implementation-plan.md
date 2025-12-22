## Plan implementacji widoku: „Więcej” (Load more) na listach przepisów (`/explore`, `/my-recipies`)

## 1. Przegląd

Celem zmiany jest zastąpienie paginacji opartej o `mat-paginator` mechanizmem **doładowywania wyników przyciskiem „Więcej”** w dwóch widokach:

- **Publiczny katalog przepisów**: `/explore`
- **Moje przepisy**: `/my-recipies` (alias: `/my-recipes`)

Mechanizm ma działać w oparciu o **cursor-based pagination** (`CursorPaginatedResponseDto`) i spełniać US-030:

- domyślnie ładowane **12** elementów,
- kliknięcie „Więcej” doładowuje kolejne **12** i **dopina** pod listą,
- przycisk pokazuje stan ładowania (`disabled` + etykieta „Ładowanie…”),
- przycisk znika, gdy `hasMore=false`,
- zmiana kontekstu listy (wyszukiwanie / filtry / sortowanie) **resetuje** listę do pierwszej porcji 12 i ponownie wyznacza `hasMore`,
- błąd doładowania pokazuje **Snackbar** i pozwala na ponowienie.

## 2. Routing widoku

- **`/explore`**
    - **Komponent**: `ExplorePageComponent` (`src/app/pages/explore/explore-page.component.ts`)
    - **Dostęp**: publiczny (gość i zalogowany)
- **`/my-recipies`** (alias: `/my-recipes`)
    - **Komponent**: `RecipesListPageComponent` (`src/app/pages/recipes/recipes-list/recipes-list-page.component.ts`)
    - **Dostęp**: chroniony (w ramach prywatnej części aplikacji)

## 3. Struktura komponentów

```
- ExplorePageComponent (Smart)
  |
  |- PublicRecipesSearchComponent (UI)  -> (searchSubmit)
  |
  |- RecipeListComponent (UI, shared)  -> (loadMore)
      |- RecipeCardComponent (UI)
      |- EmptyStateComponent (UI)

- RecipesListPageComponent (Smart)
  |
  |- PageHeaderComponent (UI)
  |- RecipesFiltersComponent (UI)       -> (filtersChange)
  |- RecipeListComponent (UI, shared)   -> (loadMore)
      |- RecipeCardComponent (UI)
      |- EmptyStateComponent (UI)

Uwaga: CollectionDetailsPageComponent nadal może używać paginatora (nie jest w zakresie US-030).
```

## 4. Szczegóły komponentów

### `pych-recipe-list` (`RecipeListComponent`)

- **Opis komponentu**: współdzielony komponent do renderowania siatki kart przepisów oraz stanów: empty, initial loading, loading-more. W ramach tej zmiany komponent dostaje tryb „Więcej” (opcjonalny), bez usuwania istniejącego trybu paginatora (dla innych widoków, np. kolekcji).

- **Główne elementy**:
    - kontener `div.recipe-list-container` (bez białych overlay; stan ładowania realizowany przez `opacity` kontenera i/lub spinnery),
    - siatka `div.recipes-grid` z `@for` renderującym `pych-recipe-card`,
    - `pych-empty-state` (lub `emptyStateTemplate`),
    - wskaźnik ładowania pod siatką przy doładowaniu (spinner),
    - **przycisk** `button mat-stroked-button` / `mat-flat-button` „Więcej” pod siatką (tylko w trybie load-more),
    - opcjonalnie `mat-paginator` (tylko w trybie paginatora).

- **Obsługiwane interakcje**:
    - klik „Więcej” → emituje `(loadMore)` (brak parametrów),
    - (pozostaje) paginator → emituje `(pageChange: PageEvent)`,
    - (pozostaje) akcja usunięcia z kolekcji → emituje `(removeRecipe: number)`.

- **Obsługiwana walidacja**:
    - przycisk „Więcej”:
        - jest widoczny tylko jeśli `hasMore === true`,
        - jest `disabled`, gdy `isLoadingMore === true` lub `isLoading === true`,
        - etykieta dynamiczna: „Więcej” vs „Ładowanie…”,
    - paginator:
        - renderuje się tylko jeśli `pagination != null` **i** `usePaginator === true` (patrz propsy).

- **Typy**:
    - wejście: `RecipeListItemViewModel[]` (istniejące)
    - paginator: `PaginationDetails` (istniejące)
    - load-more: `CursorPageInfoDto` / `boolean` (właściwości sterujące)

- **Propsy (proponowane rozszerzenie interfejsu)**:
    - (istniejące) `recipes: RecipeListItemViewModel[]`
    - (istniejące) `isLoading: boolean`
    - (istniejące) `pagination: PaginationDetails | null`
    - (istniejące) `pageSize: number`
    - (istniejące) `pageSizeOptions: number[]`
    - (istniejące) `routeType: 'public' | 'private'`
    - (istniejące) `showRemoveAction: boolean`
    - (nowe) `useLoadMore: boolean` (domyślnie `false`)
    - (nowe) `hasMore: boolean` (domyślnie `false`)
    - (nowe) `isLoadingMore: boolean` (domyślnie `false`)
    - (nowe, opcjonalne) `loadMoreLabel: string` (domyślnie `Więcej`)
    - (nowe, opcjonalne) `loadingMoreLabel: string` (domyślnie `Ładowanie…`)
    - (nowe) `usePaginator: boolean` (domyślnie `true` dla kompatybilności; w `/explore` i `/my-recipies` ustawiamy `false`)

- **Zdarzenia (output)**:
    - (istniejące) `(pageChange): PageEvent`
    - (istniejące) `(removeRecipe): number`
    - (nowe) `(loadMore): void`

### `pych-explore-page` (`ExplorePageComponent`)

- **Opis komponentu**: publiczny katalog przepisów z wyszukiwarką tekstową. Po zmianie przechodzi z `GET /public/recipes` (page-based) na `GET /public/recipes/feed` (cursor-based) i dopina wyniki przy „Więcej”.

- **Główne elementy**:
    - `pych-public-recipes-search` (emit `searchSubmit`)
    - `pych-recipe-list` w trybie `useLoadMore`
    - komunikaty: walidacja (min 2 znaki), error state przy błędzie inicjalnego pobrania

- **Obsługiwane zdarzenia**:
    - `(searchSubmit)` z `PublicRecipesSearchComponent`:
        - aktualizacja query w `queryState`
        - reset listy (items=[], cursor=null, hasMore=true)
        - aktualizacja URL (bez cursorów; tylko `q`/`sort`/`limit` jeśli wspierane)
    - `(loadMore)` z `RecipeListComponent`:
        - wywołanie „kolejnej porcji” na podstawie `nextCursor`
        - dopięcie wyników do `items`
    - „Spróbuj ponownie” (retry) przy błędzie inicjalnego ładowania:
        - ponawia pobranie pierwszej porcji

- **Obsługiwana walidacja (zgodnie z API)**:
    - `q`:
        - jeśli `q.length === 1` → nie wywołuj API, pokaż `validationMessage: 'Wpisz co najmniej 2 znaki'`
        - jeśli `q.length === 0` lub `q.length >= 2` → dozwolone
    - `limit`: stała wartość **12** (w MVP nie eksponujemy zmiany rozmiaru porcji w UI dla feedu)
    - `sort`: whitelist jak dotychczas (`created_at.desc`, `created_at.asc`, `name.asc`, `name.desc`)

- **Typy**:
    - `PublicRecipeListItemDto` (element listy)
    - `CursorPaginatedResponseDto<PublicRecipeListItemDto>` (odpowiedź feed)
    - nowe modele stanu (patrz sekcja 5)

- **Propsy**: brak (komponent routowany)

### `pych-recipes-list-page` (`RecipesListPageComponent`) — `/my-recipies`

- **Opis komponentu**: prywatna lista „Moje przepisy” z filtrami (kategoria, tagi, termorobot, wyszukiwanie, sortowanie). Po zmianie przechodzi z `GET /recipes` + paginator na `GET /recipes/feed` + „Więcej”.

- **Główne elementy**:
    - `pych-page-header`
    - `pych-recipes-filters` (emit `filtersChange`)
    - `pych-recipe-list` w trybie `useLoadMore`
    - empty state gdy brak przepisów

- **Obsługiwane zdarzenia**:
    - `(filtersChange)`:
        - reset listy do pierwszej porcji (items=[], cursor=null, hasMore=true)
        - wywołanie pobrania pierwszej porcji z nowymi filtrami
    - `(loadMore)`:
        - wywołanie doładowania (cursor = `nextCursor`)
        - dopięcie wyników do listy
    - zachowanie na błędy:
        - błąd inicjalny: ustaw `error` w stanie + pokaż snackbar
        - błąd doładowania: pokaż snackbar z akcją „Ponów” i pozostaw `hasMore=true` (użytkownik może kliknąć ponownie)

- **Obsługiwana walidacja**:
    - `limit`: stała wartość **12**
    - parametry filtrów:
        - `filter[tags]`: join listy tagów przecinkami
        - `filter[termorobot]`: wysyłaj tylko gdy `termorobot !== null && termorobot !== undefined`
        - `filter[category_id]`: wysyłaj tylko gdy `categoryId` jest liczbą
    - `view`: zawsze `my_recipes`

- **Typy**:
    - `RecipeListItemDto`
    - `CursorPaginatedResponseDto<RecipeListItemDto>`
    - `RecipesFiltersViewModel` (istniejący)

- **Propsy**: brak (komponent routowany)

### Serwisy API

#### `PublicRecipesService` (`src/app/core/services/public-recipes.service.ts`)

- **Nowa metoda**: `getPublicRecipesFeed(params)`
- **Zadanie**: wywołanie `supabase.functions.invoke('public/recipes/feed?...')`
- **Zwracany typ**: `Observable<CursorPaginatedResponseDto<PublicRecipeListItemDto>>`

Parametry (request):
- `cursor?: string` (opcjonalny; brak = pierwsza porcja)
- `limit?: number` (dla UI zawsze 12)
- `sort?: string`
- `q?: string` (wysyłaj tylko jeśli `q.length >= 2`)

#### `RecipesService` (`src/app/pages/recipes/services/recipes.service.ts`)

- **Nowa metoda**: `getRecipesFeed(params)`
- **Zadanie**: wywołanie `supabase.functions.invoke('recipes/feed?...')`
- **Zwracany typ**: `Observable<CursorPaginatedResponseDto<RecipeListItemDto>>`

Parametry (request):
- `cursor?: string`
- `limit?: number` (dla UI zawsze 12)
- `sort?: string`
- `search?: string`
- `filter[category_id]?: number`
- `filter[tags]?: string` (CSV)
- `filter[termorobot]?: boolean`
- `view?: 'my_recipes'` (w tym widoku zawsze ustawione)

## 5. Typy

### DTO (istniejące, używane)

- `CursorPaginatedResponseDto<T>`
    - `data: T[]`
    - `pageInfo: CursorPageInfoDto`
- `CursorPageInfoDto`
    - `hasMore: boolean`
    - `nextCursor: string | null`

### Nowe / zaktualizowane modele stanu (ViewModel) — frontend

#### `ExploreQueryState` (aktualizacja w `src/app/pages/explore/models/explore.model.ts`)

- **Cel**: przechowuje wyłącznie parametry wyszukiwania/sortowania, bez „page”.
- **Pola**:
    - `q: string`
    - `limit: 12` (lub `number` z wartością domyślną 12, bez UI do zmiany w feed)
    - `sort: string`

#### `ExplorePageState` (aktualizacja w `src/app/pages/explore/models/explore.model.ts`)

- **Cel**: przechowuje dane i stan UI + metadane feedu.
- **Pola**:
    - `items: PublicRecipeListItemDto[]`
    - `pageInfo: CursorPageInfoDto` (z `hasMore`, `nextCursor`)
    - `isInitialLoading: boolean`
    - `isLoadingMore: boolean`
    - `errorMessage: string | null`
    - `validationMessage: string | null`

#### `RecipesFeedState` (nowy wewnętrzny typ w `RecipesListPageComponent` lub osobny model)

- **Cel**: ujednolicić stan „load more” w `/my-recipies`.
- **Pola** (minimalnie):
    - `recipes: RecipeListItemDto[]`
    - `pageInfo: CursorPageInfoDto`
    - `isInitialLoading: boolean`
    - `isLoadingMore: boolean`
    - `error: string | null`

## 6. Zarządzanie stanem

### Podejście ogólne (Signals)

- źródła stanu trzymamy w `signal(...)`,
- do aktualizacji danych po loadach używamy `state.update(...)` (unikamy „white flash”),
- rozróżniamy:
    - **initial load** (skeleton / full loading),
    - **load more** (dopinanie + spinner/przycisk disabled),
    - błędy inicjalne vs błędy doładowania.

### `/explore`

- `queryState: signal<ExploreQueryState>`
- `pageState: signal<ExplorePageState>`
- `effect()` reaguje na zmianę `queryState`:
    - guard: `q.length === 1` → ustaw walidację i return
    - reset listy: `items=[]`, `pageInfo={hasMore:false,nextCursor:null}` (tymczasowo)
    - ustaw `isInitialLoading=true`, `errorMessage=null`
    - wywołaj `getPublicRecipesFeed({cursor: undefined, limit: 12, sort, q?})`
    - wynik:
        - `items = response.data`
        - `pageInfo = response.pageInfo`
        - `isInitialLoading=false`
- `onLoadMore()`:
    - guard: jeśli `isLoadingMore` lub `!pageInfo.hasMore` → return
    - ustaw `isLoadingMore=true`
    - wywołaj feed z `cursor=pageInfo.nextCursor`
    - sukces: dopnij `items = [...items, ...response.data]`, ustaw `pageInfo`, `isLoadingMore=false`
    - błąd: `isLoadingMore=false`, pokaż `MatSnackBar` (opcjonalnie z akcją „Ponów”)

### `/my-recipies`

- w `RecipesListPageComponent`:
    - `filters: signal<RecipesFiltersViewModel>`
    - `state: signal<RecipesFeedState>` (z `recipes` + `pageInfo`)
    - efekt reaguje na `filters()`:
        - reset listy i cursor (`recipes=[]`, `pageInfo={hasMore:false,nextCursor:null}`)
        - `isInitialLoading` dla pierwszego wejścia lub `isLoading` dla kolejnych (wg decyzji UX; preferowane: keep previous data + `opacity`)
        - wywołanie `getRecipesFeed({cursor: undefined, limit: 12, sort, search, filter..., view:'my_recipes'})`
        - sukces: ustaw `recipes`, `pageInfo`, wyłącz loading
        - błąd: ustaw `error`, wyłącz loading, snackbar
    - `onLoadMore()` analogicznie do `/explore`:
        - dopina `recipes`
        - błąd → snackbar + możliwość kliknięcia ponownie

## 7. Integracja API

### Explore: `GET /public/recipes/feed`

- **Wywołanie**: `PublicRecipesService.getPublicRecipesFeed(params)`
- **Request**:
    - `cursor` (opcjonalny)
    - `limit=12`
    - `sort` (whitelist)
    - `q` (tylko jeśli `q.length >= 2`)
- **Response**: `CursorPaginatedResponseDto<PublicRecipeListItemDto>`
- **Mapowanie UI**: dopięcie `data` do listy, `pageInfo.hasMore` steruje widocznością „Więcej”.

### My recipes: `GET /recipes/feed`

- **Wywołanie**: `RecipesService.getRecipesFeed(params)`
- **Request**:
    - `cursor` (opcjonalny)
    - `limit=12`
    - `sort` (np. `created_at.desc`, `name.asc`)
    - `view='my_recipes'`
    - `search`, `filter[category_id]`, `filter[tags]`, `filter[termorobot]` (jeśli ustawione)
- **Response**: `CursorPaginatedResponseDto<RecipeListItemDto>`

## 8. Interakcje użytkownika

- **Explore**:
    - wpisanie frazy i submit:
        - reset listy do pierwszej porcji 12
        - jeśli 1 znak → komunikat walidacji
    - klik „Więcej”:
        - doładowanie kolejnych 12, dopięcie pod listą
        - przycisk w trakcie: disabled + „Ładowanie…”
        - gdy brak wyników: przycisk znika

- **Moje przepisy**:
    - zmiana filtrów/sortowania/wyszukiwania:
        - reset listy do pierwszej porcji 12
    - klik „Więcej”:
        - doładowanie i dopięcie

## 9. Warunki i walidacja

- **Explore / API**:
    - `q.length === 1` → blokada wywołania + komunikat walidacji
    - `limit` = 12
    - `sort` tylko z whitelisty
- **Load more button**:
    - widoczny tylko gdy `hasMore=true`
    - `disabled` gdy `isLoadingMore=true` (i dodatkowo gdy trwa initial loading)
    - po błędzie doładowania wraca do stanu aktywnego (użytkownik może kliknąć ponownie)

## 10. Obsługa błędów

- **Błąd pierwszego pobrania**:
    - Explore: wyświetl dedykowany error state + przycisk „Spróbuj ponownie”
    - My recipes: snackbar + (opcjonalnie) tekstowy stan błędu w widoku

- **Błąd doładowania („Więcej”)**:
    - pokaż `MatSnackBar` z komunikatem: „Nie udało się doładować przepisów.”
    - dodaj akcję „Ponów” (opcjonalnie), która wywoła `onLoadMore()` ponownie z tym samym `nextCursor`
    - **nie czyść** już załadowanych danych

## 11. Kroki implementacji

1. **Zaktualizuj `pych-recipe-list`**:
    - dodaj propsy i output dla trybu `useLoadMore`
    - dodaj przycisk „Więcej” pod siatką, ukrywany przy `hasMore=false`
    - zachowaj kompatybilność z trybem paginatora (dla innych widoków)
2. **Dodaj feed do serwisów**:
    - `PublicRecipesService.getPublicRecipesFeed(...)`
    - `RecipesService.getRecipesFeed(...)`
3. **Przebuduj `/explore` na cursor-based**:
    - usuń obsługę `PageEvent` i parametry `page/pagination` w stanie
    - wprowadź `pageInfo` + `isLoadingMore`
    - podłącz `(loadMore)` z `pych-recipe-list`
4. **Przebuduj `/my-recipies` na cursor-based**:
    - usuń `mat-paginator` z `recipes-list-page.component.html`
    - usuń `paginationState` (page/limit) i logikę `onPageChange`
    - wprowadź `pageInfo` + `isLoadingMore`
    - resetuj listę na zmianę filtrów
5. **Sprawdź integracje pozostałych widoków**:
    - upewnij się, że `CollectionDetailsPageComponent` nadal działa z paginator mode (jeśli nadal wymagane)
6. **Smoke-test UX**:
    - Explore: start 12, doładowanie, ukrycie przycisku, reset po zmianie frazy, walidacja 1 znaku
    - My recipes: start 12, doładowanie, reset po filtrach/sorcie, snackbar na błędzie doładowania


