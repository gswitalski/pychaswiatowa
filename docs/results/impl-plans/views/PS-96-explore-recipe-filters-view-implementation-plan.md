# Plan implementacji widoku — Filtry przepisów w katalogu Odkrywaj (PS-96)

## 1. Przegląd

Celem wdrożenia jest wzbogacenie strony katalogowej `/explore` o interaktywny pasek chipów filtrujących, wyświetlany pod polem wyszukiwania. Użytkownik może zawężać listę publicznych przepisów przez dowolną kombinację filtrów: **Termorobot**, **Grill**, **Dieta** (single-select chip-group: Wszystkie / Wegetariańskie+ / Tylko wegańskie), a zalogowany użytkownik dodatkowo: **Ulubione** i **Chcę wypróbować**. Aktywne filtry są synchronizowane z URL (query params), co umożliwia bookmarkowanie i udostępnianie przefiltrowanych widoków. Zmiana filtrów resetuje paginację do pierwszej strony. Brak wyników wyświetla dedykowany empty state z przyciskiem „Wyczyść filtry".

Historyjka obejmuje:
- **warstwę UI**: nowy komponent chipów filtrów, nowy serwis mapowania URL ↔ filtry oraz przebudowę `ExplorePageComponent` (przejęcie zarządzania ładowaniem danych)
- **rozszerzenie serwisu API** (`PublicRecipesService`) o nowe parametry filtrujące przekazywane do endpointu `GET /public/recipes/feed`

## 2. Routing widoku

Widok dostępny pod istniejącą ścieżką `/explore` — bez żadnych zmian w routingu ani guardach. Trasa jest publiczna. Filtry są przechowywane w query params (np. `/explore?termorobot=true&diet=vegan&q=zupa`).

## 3. Struktura komponentów

```
ExplorePageComponent              src/app/pages/explore/
├── [mat-form-field — pole wyszukiwania, własny FormControl z debounce]
├── ExploreRecipeFiltersComponent  [NOWY]
│     (pych-explore-recipe-filters)
└── PublicRecipeResultsComponent   [ISTNIEJĄCY — reużywany]
      └── RecipeCardComponent      [ISTNIEJĄCY]
```

**Nowe pliki:**

| Plik | Typ |
|---|---|
| `src/app/pages/explore/models/explore-filters.model.ts` | Nowy (typy + stałe) |
| `src/app/pages/explore/services/explore-filter-state.service.ts` | Nowy (serwis mapowania) |
| `src/app/pages/explore/services/explore-filter-state.service.spec.ts` | Nowy (testy) |
| `src/app/pages/explore/components/explore-recipe-filters/explore-recipe-filters.component.ts` | Nowy |
| `src/app/pages/explore/components/explore-recipe-filters/explore-recipe-filters.component.html` | Nowy |
| `src/app/pages/explore/components/explore-recipe-filters/explore-recipe-filters.component.scss` | Nowy |
| `src/app/pages/explore/components/explore-recipe-filters/explore-recipe-filters.component.spec.ts` | Nowy (testy) |

**Modyfikowane pliki:**

| Plik | Zakres zmian |
|---|---|
| `src/app/pages/explore/explore-page.component.ts` | Pełna przebudowa: przejęcie zarządzania stanem i ładowaniem danych, integracja filtrów, sync URL |
| `src/app/pages/explore/explore-page.component.html` | Nowy szablon: pole wyszukiwania, chipy filtrów, wyniki, empty state |
| `src/app/pages/explore/explore-page.component.scss` | Styl search section + filtrów + responsywność |
| `src/app/core/services/public-recipes.service.ts` | Rozszerzenie `GetPublicRecipesFeedParams` o nowe pola filtrujące |

**Usunięte zależności:**

| Element | Powód |
|---|---|
| `PublicRecipesSearchComponent` w `ExplorePageComponent` | Zastępowany własnym polem wyszukiwania + `ExploreRecipeFiltersComponent` + `PublicRecipeResultsComponent`; `PublicRecipesSearchComponent` i `PublicRecipesFacade` **pozostają bez zmian** — nadal używane na Landing Page |

## 4. Szczegóły komponentów

### `ExploreRecipeFiltersComponent` (`pych-explore-recipe-filters`)

- **Opis:** Prezentacyjny pasek chipów filtrujących. Wyświetlany pod polem wyszukiwania na `/explore`. Zawiera do pięciu grup chipów: dwa toggle-chipy flag osobistych (warunkowo, tylko dla zalogowanych), chip-group diety (single-select, 3 opcje), toggle Termorobot i toggle Grill. Komponent jest **bezstanowy** — nie przechowuje własnego stanu. Każda zmiana jest emitowana przez `filtersChange`, a rodzic odpowiada za aktualizację URL i załadowanie danych.
- **Główne elementy HTML i komponenty dzieci:**
  - `<div class="explore-filters">` — kontener flex z `overflow-x: auto` (poziomy scroll na mobile)
  - `@if (isAuthenticated())` — warunkowy blok dla chipów flag:
    - `<mat-chip-option [selected]="filters().favorite">` — chip „Ulubione" z `<mat-icon matChipAvatar>favorite</mat-icon>` i `matTooltip`
    - `<mat-chip-option [selected]="filters().wantToTry">` — chip „Chcę wypróbować" z `<mat-icon matChipAvatar>bookmark</mat-icon>` i `matTooltip`
  - `<mat-chip-listbox [value]="filters().diet" (change)="onDietChange($event)" aria-label="Filtr diety">` — single-select z opcjami:
    - `<mat-chip-option [value]="null">Wszystkie diety</mat-chip-option>`
    - `<mat-chip-option value="vege_plus">Wegetariańskie+</mat-chip-option>`
    - `<mat-chip-option value="vegan">Tylko wegańskie</mat-chip-option>`
  - `<mat-chip-option [selected]="filters().termorobot" (click)="toggle('termorobot')">` — toggle Termorobot z ikoną `blender` i `matTooltip`
  - `<mat-chip-option [selected]="filters().grill" (click)="toggle('grill')">` — toggle Grill z ikoną `outdoor_grill` i `matTooltip`
- **Obsługiwane zdarzenia:**
  - `(click)` na `mat-chip-option` (Termorobot, Grill, Ulubione, Chcę wypróbować) → `toggle(field)` → `filtersChange.emit({ ...filters(), [field]: !filters()[field] })`
  - `(change)` na `mat-chip-listbox` → `onDietChange(event: MatChipListboxChange)` → `filtersChange.emit({ ...filters(), diet: event.value as ExploreFilterDiet })`
- **Walidacja:** Brak własnej walidacji — chip-group diety jest single-select z wzajemnie wykluczającymi się opcjami (obsługa przez Angular Material CDK). Klika w aktywny chip toggle powoduje jego deaktywację (przełącznik).
- **Typy:** `ExploreFilters`, `ExploreFilterDiet`, `MatChipListboxChange`
- **Propsy:**
  ```typescript
  readonly filters = input.required<ExploreFilters>();
  readonly isAuthenticated = input<boolean>(false);
  readonly filtersChange = output<ExploreFilters>();
  ```

---

### `ExplorePageComponent` (przebudowa)

- **Opis:** Główna strona `/explore`. Po przebudowie samodzielnie zarządza pełnym cyklem danych: wyszukiwanie z debounce, ładowanie feedu/wyników, paginacja cursor-based, synchronizacja filtrów i frazy `q` z URL. Rezygnuje z `PublicRecipesSearchComponent` na rzecz własnego inputu i bezpośrednich wywołań `PublicRecipesService`. Renderuje `ExploreRecipeFiltersComponent` i `PublicRecipeResultsComponent`.
- **Główne elementy HTML:**
  - `<header class="explore-header">` — tytuł strony
  - `<section class="search-section">` — blok inputu + filtrów:
    - `<mat-form-field>` z `<input matInput [formControl]="queryControl" (keydown.enter)="onSearchSubmit()">` — pole wyszukiwania
    - Podpowiedź `@if (shortQueryHintVisible())` — „Wpisz min. 3 znaki"
    - `<pych-explore-recipe-filters [filters]="filters()" [isAuthenticated]="isAuthenticated()" (filtersChange)="onFiltersChange($event)">`
  - `<pych-public-recipe-results>` z bindingi stanu
  - Empty state `@if (showEmptyState())`:
    - Komunikat „Brak przepisów pasujących do wybranych filtrów."
    - `@if (filterState.hasActiveFilters(filters()))` — `<button mat-button (click)="clearFilters()"><mat-icon>filter_alt_off</mat-icon> Wyczyść filtry</button>`
- **Obsługiwane zdarzenia:**
  - `queryControl.valueChanges` → debounce 350ms → `onQueryCommit(query)` → aktualizacja URL (param `q`)
  - `(keydown.enter)` na polu input → `onSearchSubmit()` — natychmiastowe zatwierdzenie bez debounce
  - `(filtersChange)` → `onFiltersChange(newFilters)` → `Router.navigate([])` z nowymi params filtrów + zachowanym `q`
  - `(click)` „Wyczyść filtry" → `clearFilters()` → URL bez params filtrów, `q` zachowane
  - `(loadMore)` z `PublicRecipeResultsComponent` → `loadMore()`
  - `(retry)` z `PublicRecipeResultsComponent` → `retry()`
- **Warunki warunkowego renderowania:**
  - Empty state — `items().length === 0 && !loadingInitial() && !errorMessage()`
  - Przycisk „Wyczyść filtry" — tylko gdy `filterState.hasActiveFilters(filters()) === true`
  - Chipy flag w `ExploreRecipeFiltersComponent` — przez `isAuthenticated()` wejściowy
  - Podpowiedź krótkiej frazy — `shortQueryHintVisible()` computed
- **Typy:** `ExploreFilters`, `ExploreFilterDiet`, `CursorPageInfoDto`, `PublicRecipeListItemDto`, `GetPublicRecipesFeedParams`
- **Serwisy/wstrzyknięcia:** `PublicRecipesService`, `ExploreFilterStateService`, `AuthService`, `ActivatedRoute`, `Router`, `DestroyRef`
- **Propsy:** brak (komponent stronicy, bez wejść od rodzica)

---

### `ExploreFilterStateService`

- **Opis:** Serwis pomocniczy (`providedIn: 'root'`) odpowiedzialny wyłącznie za dwukierunkowe mapowanie między `ExploreFilters` a query params URL, za budowanie słownika params do wywołania API oraz za pomocnicze operacje (sprawdzenie aktywności filtrów, reset). Serwis jest **bezstanowy i czysto funkcyjny** — nie posiada sygnałów ani żadnego wewnętrznego stanu.
- **Główne elementy:** Klasa z 5 metodami publicznymi i 1 prywatną:
  - `fromQueryParams(params: Params): ExploreFilters` — parsuje query params Angular Router na model `ExploreFilters`
  - `toQueryParams(filters: ExploreFilters): Params` — buduje obiekt query params URL z modelu filtrów (pomija domyślne wartości)
  - `toApiParams(filters: ExploreFilters): Record<string, string>` — buduje słownik params do przekazania do `GetPublicRecipesFeedParams` (pomija `null`/`false`)
  - `hasActiveFilters(filters: ExploreFilters): boolean` — zwraca `true` jeśli jakikolwiek filtr jest inny niż domyślny
  - `reset(): ExploreFilters` — zwraca kopię `EXPLORE_FILTERS_DEFAULT`
  - `private parseDiet(value: string | undefined): ExploreFilterDiet` — whitelist `'vege_plus'`/`'vegan'`, każda inna wartość → `null`
- **Obsługiwane zdarzenia:** brak (serwis czysto funkcyjny)
- **Warunki walidacji:** Nieznane wartości `diet` są tolerancyjnie ignorowane (zwracają `null`)
- **Typy:** `ExploreFilters`, `ExploreFilterDiet`, `Params` (Angular Router)
- **Propsy:** brak (wstrzykiwany jako serwis)

## 5. Typy

### Nowe typy — `src/app/pages/explore/models/explore-filters.model.ts`

```typescript
export type ExploreFilterDiet = 'vege_plus' | 'vegan' | null;

export interface ExploreFilters {
    termorobot: boolean;
    grill: boolean;
    diet: ExploreFilterDiet;
    favorite: boolean;    // tylko zalogowany; ignorowane gdy gość
    wantToTry: boolean;   // tylko zalogowany; ignorowane gdy gość
}

export const EXPLORE_FILTERS_DEFAULT: ExploreFilters = {
    termorobot: false,
    grill: false,
    diet: null,
    favorite: false,
    wantToTry: false,
};
```

### Mapowanie URL ↔ `ExploreFilters`

| URL query param | Wartość | Pole w `ExploreFilters` |
|---|---|---|
| `termorobot=true` | `"true"` | `termorobot: true` |
| `grill=true` | `"true"` | `grill: true` |
| `diet=vege_plus` | `"vege_plus"` | `diet: 'vege_plus'` |
| `diet=vegan` | `"vegan"` | `diet: 'vegan'` |
| `favorite=true` | `"true"` | `favorite: true` |
| `want_to_try=true` | `"true"` | `wantToTry: true` |

Parametr `q` (tekst wyszukiwania) **nie jest częścią `ExploreFilters`** — zarządzany osobno przez `queryControl` w `ExplorePageComponent`.

### Rozszerzenie `GetPublicRecipesFeedParams` — `src/app/core/services/public-recipes.service.ts`

Dodanie nowych pól filtrujących do istniejącego interfejsu (wartości jako literały string — zgodne z tym, jak URLSearchParams przyjmuje parametry):

```typescript
export interface GetPublicRecipesFeedParams {
    cursor?: string;
    limit?: number;
    sort?: string;
    q?: string;
    // PS-96: nowe pola filtrujące
    termorobot?: 'true';
    grill?: 'true';
    diet?: 'vege_plus' | 'vegan';
    favorite?: 'true';
    want_to_try?: 'true';
}
```

W metodzie `getPublicRecipesFeed()` nowe pola należy dołączać do `URLSearchParams` gdy są zdefiniowane:
```typescript
if (params.termorobot) queryParams.append('termorobot', params.termorobot);
if (params.grill) queryParams.append('grill', params.grill);
if (params.diet) queryParams.append('diet', params.diet);
if (params.favorite) queryParams.append('favorite', params.favorite);
if (params.want_to_try) queryParams.append('want_to_try', params.want_to_try);
```

### Typ `ExploreFilterStateService.toApiParams()` — wynik

Wynikiem `toApiParams()` jest `Record<string, string>`, który jest następnie rozkładany (`spread`) do `GetPublicRecipesFeedParams`:

```typescript
// W ExplorePageComponent:
const apiParams: GetPublicRecipesFeedParams = {
    limit: 12,
    cursor: cursor ?? undefined,
    q: qTrimmed.length >= 3 ? qTrimmed : undefined,
    sort: qTrimmed.length >= 3 ? undefined : 'created_at.desc',
    ...this.filterState.toApiParams(this.filters()),
};
```

## 6. Zarządzanie stanem

Cały stan zarządzany jest lokalnie w `ExplorePageComponent` przy użyciu **sygnałów Angular**. Nie jest wymagany NgRx ani custom hook — komponent-strona zarządza własnym stanem.

### Sygnały stanu w `ExplorePageComponent`

| Sygnał | Typ | Opis |
|---|---|---|
| `filters` | `WritableSignal<ExploreFilters>` | Aktywne filtry (źródło: URL query params) |
| `queryDraft` | `WritableSignal<string>` | Wartość z inputa (przed debounce) |
| `queryCommitted` | `WritableSignal<string>` | Zatwierdzona fraza (po debounce lub Enter) |
| `items` | `WritableSignal<PublicRecipeListItemDto[]>` | Załadowane przepisy |
| `pageInfo` | `WritableSignal<CursorPageInfoDto>` | Stan paginacji cursor |
| `loadingInitial` | `WritableSignal<boolean>` | Trwa ładowanie inicjalne |
| `loadingMore` | `WritableSignal<boolean>` | Trwa doładowywanie kolejnej strony |
| `errorMessage` | `WritableSignal<string \| null>` | Komunikat błędu sieciowego |
| `isAuthenticated` | `WritableSignal<boolean>` | Czy użytkownik jest zalogowany |
| `lastRequestKey` | `WritableSignal<string \| null>` | Klucz ostatniego żądania (zabezpieczenie przed race condition) |

### Sygnały computed

| Sygnał | Typ | Opis |
|---|---|---|
| `shortQueryHintVisible` | `Signal<boolean>` | `queryDraft().trim().length >= 1 && < 3` — podpowiedź „min. 3 znaki" |
| `showEmptyState` | `Signal<boolean>` | `items().length === 0 && !loadingInitial() && !errorMessage()` |

### Przepływ danych

```
[Inicjalizacja]
URL (queryParams) ─── ActivatedRoute.queryParams ───▶ ExploreFilterStateService.fromQueryParams()
                                                    ───▶ filters.set(), queryCommitted.set()
                                                    ───▶ resetAndLoad()
                                                             ▶ loadingInitial.set(true)
                                                             ▶ PublicRecipesService.getPublicRecipesFeed(params)
                                                             ▶ items.set(), pageInfo.set()

[Zmiana filtru]
Użytkownik klika chip ─── filtersChange.emit(newFilters)
                      ─── onFiltersChange(newFilters)
                      ─── Router.navigate([], { queryParams: { ...filtersParams, q: ... } })
                      ─── (ActivatedRoute emituje → resetAndLoad())

[Zmiana frazy wyszukiwania]
queryControl.valueChanges ─── Subject<string> + debounceTime(350ms)
                          ─── queryDraft.set(value)
                          ─── Router.navigate([], { queryParams: { q: value || undefined, ...filtersParams } })
                          ─── (ActivatedRoute emituje → resetAndLoad())

[Load more]
Użytkownik klika „Więcej" ─── loadMore()
                          ─── PublicRecipesService.getPublicRecipesFeed({ cursor: pageInfo().nextCursor, ... })
                          ─── items.update(prev => [...prev, ...newItems])
```

### Synchronizacja z URL

`ExplorePageComponent.ngOnInit()` (lub konstruktor z `toSignal(route.queryParams)`) subskrybuje `ActivatedRoute.queryParams` przez `takeUntilDestroyed(destroyRef)`. Przy każdej zmianie query params (zarówno `q`, jak i filtrów) parsuje stan przez `ExploreFilterStateService.fromQueryParams()` i wywołuje `resetAndLoad()`, który zeruje paginację i ładuje dane. Dzięki temu obsługiwane są zarówno interakcje w UI jak i wejścia z bookmarku.

**Debounce wyszukiwania** realizowany jest przez `Subject<string>` + operator `debounceTime(350)` + `distinctUntilChanged()` + `takeUntilDestroyed(destroyRef)` — ten sam wzorzec co `PublicRecipesFacade`.

## 7. Integracja API

### Endpoint: `GET /public/recipes/feed`

**Metoda serwisu:** `PublicRecipesService.getPublicRecipesFeed(params: GetPublicRecipesFeedParams): Observable<CursorPaginatedResponseDto<PublicRecipeListItemDto>>`

Metoda nie zmienia sygnatury — rozszerza tylko typ parametrów i dodaje nowe pola do `URLSearchParams`.

**Parametry żądania (`GetPublicRecipesFeedParams`) — pełna lista po PS-96:**

| Pole | Typ | Kiedy wysyłane |
|---|---|---|
| `cursor` | `string \| undefined` | Przy load more (null → brak parametru → pierwsza strona) |
| `limit` | `number` | Zawsze (domyślnie 12) |
| `q` | `string \| undefined` | Tylko gdy `queryCommitted.trim().length >= 3` |
| `sort` | `string \| undefined` | Tylko w trybie feed bez `q` (`'created_at.desc'`) |
| `termorobot` | `'true' \| undefined` | Gdy `filters().termorobot === true` |
| `grill` | `'true' \| undefined` | Gdy `filters().grill === true` |
| `diet` | `'vege_plus' \| 'vegan' \| undefined` | Gdy `filters().diet !== null` |
| `favorite` | `'true' \| undefined` | Gdy `filters().favorite === true` **i** `isAuthenticated() === true` |
| `want_to_try` | `'true' \| undefined` | Gdy `filters().wantToTry === true` **i** `isAuthenticated() === true` |

**Odpowiedź:** `CursorPaginatedResponseDto<PublicRecipeListItemDto>` — struktura bez zmian. Pole `is_favorite` w elementach listy pochodzi z PS-95 i jest nadal zwracane przez API.

**Budowanie params filtrów przez `ExploreFilterStateService.toApiParams()`:**

```typescript
toApiParams(filters: ExploreFilters): Record<string, string> {
    const params: Record<string, string> = {};
    if (filters.termorobot) params['termorobot'] = 'true';
    if (filters.grill) params['grill'] = 'true';
    if (filters.diet) params['diet'] = filters.diet;
    if (filters.favorite) params['favorite'] = 'true';
    if (filters.wantToTry) params['want_to_try'] = 'true';
    return params;
}
```

**Ważne:** `ExplorePageComponent` nie wysyła `favorite` i `want_to_try` do API jeśli użytkownik nie jest zalogowany, nawet jeśli te wartości są w URL (ochrona dodatkowa po stronie frontendu). Backend i tak ignoruje te parametry bez JWT.

## 8. Interakcje użytkownika

| Interakcja | Oczekiwany wynik |
|---|---|
| Klik chip toggle (Termorobot / Grill) — gość lub zalogowany | Chip zmienia stan; URL aktualizuje się (`?termorobot=true` lub `?grill=true`); lista odświeża się |
| Klik chip toggle (Ulubione / Chcę wypróbować) — zalogowany | Chip zmienia stan; URL aktualizuje się; lista zawiera tylko przepisy z tą flagą |
| Klik aktywnego chipa toggle (deaktywacja) | Chip wraca do stanu nieaktywnego; odpowiedni param znika z URL; lista odświeża się |
| Klik opcji chip-group diety — „Wegetariańskie+" | Chip aktywny; URL: `?diet=vege_plus`; lista: przepisy `VEGE` i `VEGAN` |
| Klik opcji chip-group diety — „Tylko wegańskie" | Chip aktywny; URL: `?diet=vegan`; lista: tylko przepisy `VEGAN` |
| Klik „Wszystkie diety" (gdy inna opcja aktywna) | Filtr diety znika z URL; lista bez ograniczenia diety |
| Wpisanie tekstu (≥3 znaki) | Po 350ms debounce: URL aktualizuje `q`; lista odświeża się (wyszukiwanie) |
| Wpisanie 1–2 znaków | Podpowiedź „Wpisz min. 3 znaki" widoczna; brak ładowania; lista z poprzednimi wynikami |
| Enter w polu wyszukiwania | Natychmiastowa aktualizacja URL i listy (pomija debounce) |
| Wyczyszczenie pola wyszukiwania | URL usuwa `q`; lista odświeża się (tryb feed) |
| Klik „Więcej" | Doładowanie kolejnych 12 przepisów; aktywne filtry i fraza zachowane |
| Klik „Wyczyść filtry" (empty state) | URL traci params filtrów; `q` zostaje; lista odświeża się |
| Kombinacja: Ulubione + Termorobot | Oba params w URL; API zwraca przepisy spełniające oba warunki (AND) |
| Kombinacja: fraza `q` + Grill | URL: `?q=tekst&grill=true`; lista spełnia oba kryteria jednocześnie |
| Wejście na `/explore?termorobot=true&diet=vegan` (bookmark) | Chipy „Termorobot" i „Tylko wegańskie" aktywne natychmiast; lista przefiltrowana bez dodatkowej interakcji |
| Zmiana filtrów gdy załadowano wiele stron | Paginacja resetowana do strony 1; nowe dane od początku |

## 9. Warunki i walidacja

| Warunek | Komponent / miejsce sprawdzania | Wpływ na interfejs |
|---|---|---|
| `isAuthenticated === false` | `ExploreRecipeFiltersComponent` (`@if (isAuthenticated())`) | Chipy „Ulubione" i „Chcę wypróbować" **nie są renderowane** |
| `isAuthenticated === false` i `filters().favorite` lub `filters().wantToTry` | `ExplorePageComponent.buildFetchParams()` | Params `favorite`/`want_to_try` **nie są wysyłane** do API |
| `queryDraft.trim().length >= 1 && < 3` | `ExplorePageComponent` (computed `shortQueryHintVisible`) | Podpowiedź „Wpisz min. 3 znaki" widoczna; brak ładowania; poprzednie dane zachowane (bez białego flasha) |
| `items().length === 0 && !loadingInitial() && !errorMessage()` | `ExplorePageComponent` (computed `showEmptyState`) | Empty state widoczny |
| `showEmptyState && filterState.hasActiveFilters(filters())` | `ExplorePageComponent` (w szablonie) | Przycisk „Wyczyść filtry" widoczny |
| `showEmptyState && !filterState.hasActiveFilters(filters())` | `ExplorePageComponent` | Generyczny komunikat „Brak publicznych przepisów" (bez przycisku reset) |
| `diet !== 'vege_plus' && diet !== 'vegan'` (nieznana wartość w URL) | `ExploreFilterStateService.parseDiet()` | Traktowane jako `null` (brak filtra diety); brak błędu |
| Zmiana filtra lub frazy | `ExplorePageComponent.resetAndLoad()` | Paginacja reset (cursor = null); ładowanie od strony 1 |
| `pageInfo().hasMore === false` | `PublicRecipeResultsComponent` (computed `showLoadMoreButton`) | Przycisk „Więcej" ukryty |

## 10. Obsługa błędów

| Scenariusz | Obsługa |
|---|---|
| Błąd sieciowy / API przy ładowaniu inicjalnym | `errorMessage` signal ustawiony; `PublicRecipeResultsComponent` renderuje komunikat błędu z przyciskiem „Spróbuj ponownie"; lista jest wyczyszczona |
| Błąd sieciowy przy load more | `loadingMore.set(false)`; błąd logowany do konsoli; dotychczasowe wyniki pozostają widoczne (brak white flash) |
| Spóźniona odpowiedź API (race condition) | Klucz żądania `lastRequestKey` — odpowiedź ignorowana jeśli nie odpowiada ostatniemu żądaniu (wzorzec z `PublicRecipesFacade`) |
| Brak wyników po filtracji (pusta odpowiedź API) | Empty state z komunikatem „Brak przepisów pasujących do wybranych filtrów." + przycisk „Wyczyść filtry" gdy `hasActiveFilters()` |
| Nieznana wartość `diet` w URL (np. bookmark ze starego linku) | `ExploreFilterStateService.parseDiet()` zwraca `null`; brak filtra diety; brak błędu UI |
| URL z `?favorite=true` dla gościa (np. udostępniony link) | Backend ignoruje parametr bez JWT; wyniki bez filtra flag; UI nie pokazuje chipów flag dla gościa |
| Kliknięcie „Wyczyść filtry" gdy błąd | `clearFilters()` czyści URL → ActivatedRoute emituje → `resetAndLoad()` → nowa próba ładowania |

## 11. Kroki implementacji

1. **Utwórz plik modelu** `src/app/pages/explore/models/explore-filters.model.ts`:
   - Zdefiniuj typy `ExploreFilterDiet` i `ExploreFilters` oraz stałą `EXPLORE_FILTERS_DEFAULT`

2. **Utwórz `ExploreFilterStateService`** `src/app/pages/explore/services/explore-filter-state.service.ts`:
   - Implementuj 5 metod publicznych: `fromQueryParams`, `toQueryParams`, `toApiParams`, `hasActiveFilters`, `reset`
   - Implementuj prywatną metodę `parseDiet` z whitelistą wartości

3. **Napisz testy `ExploreFilterStateService`** `explore-filter-state.service.spec.ts`:
   - `fromQueryParams({ termorobot: 'true', diet: 'vege_plus' })` → poprawny `ExploreFilters`
   - `toQueryParams` z domyślnym stanem → pusty obiekt
   - `toQueryParams` z aktywnym filtrem → odpowiedni params
   - `hasActiveFilters` z domyślnym → `false`; z aktywnym → `true`
   - `parseDiet('xyz')` → `null` (nieznana wartość)
   - `toApiParams` z `wantToTry: true` → `{ want_to_try: 'true' }`

4. **Rozszerz `GetPublicRecipesFeedParams`** w `src/app/core/services/public-recipes.service.ts`:
   - Dodaj pola: `termorobot?`, `grill?`, `diet?`, `favorite?`, `want_to_try?`
   - Zaktualizuj metodę `getPublicRecipesFeed()`: dla każdego nowego pola dodaj `if (params.X) queryParams.append('X', params.X)`

5. **Utwórz `ExploreRecipeFiltersComponent`** `src/app/pages/explore/components/explore-recipe-filters/`:
   - `.ts`: standalone, `ChangeDetectionStrategy.OnPush`, imports `MatChipsModule`, `MatIconModule`, `MatTooltipModule`; inputs `filters`, `isAuthenticated`; output `filtersChange`; metody `toggle()` i `onDietChange()`
   - `.html`: struktura z `@if (isAuthenticated())`, `mat-chip-listbox`, `mat-chip-option` z ikonami i tooltipami
   - `.scss`: `.explore-filters { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; flex-wrap: nowrap; }` — `mat-chip-option, mat-chip-listbox { flex-shrink: 0; }`
   - `.spec.ts`: testy warunkowego renderowania gość/zalogowany, emisji po kliknięciu każdego chipa, deaktywacji, zmiany diety

6. **Przebuduj `ExplorePageComponent`** `explore-page.component.ts`:
   - Usuń import `PublicRecipesSearchComponent`
   - Dodaj importy: `ExploreRecipeFiltersComponent`, `PublicRecipeResultsComponent`, `ReactiveFormsModule`, `MatFormFieldModule`, `MatInputModule`, `MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`
   - Wstrzyknij serwisy przez `inject()`: `PublicRecipesService`, `ExploreFilterStateService`, `AuthService`, `ActivatedRoute`, `Router`, `DestroyRef`
   - Zadeklaruj sygnały stanu i computed (`filters`, `queryDraft`, `queryCommitted`, `items`, `pageInfo`, `loadingInitial`, `loadingMore`, `errorMessage`, `isAuthenticated`, `lastRequestKey`, `shortQueryHintVisible`, `showEmptyState`)
   - Zadeklaruj `queryControl: FormControl<string>` (nonNullable)
   - Skonfiguruj w konstruktorze: debounce `Subject<string>` + `debounceTime(350)` + `distinctUntilChanged` + `takeUntilDestroyed(destroyRef)` → `onQueryCommit()`
   - W `ngOnInit()`: subskrybuj `route.queryParams` (`takeUntilDestroyed`) → parsuj filtry i `q` → `resetAndLoad()`; wywołaj `initializeCurrentUser()` (async, `AuthService.getSession()`)
   - Implementuj metody publiczne: `onFiltersChange()`, `onSearchSubmit()`, `clearFilters()`, `loadMore()`, `retry()`
   - Implementuj metody prywatne: `resetAndLoad()`, `loadInitial()`, `appendMore()`, `buildFetchParams(cursor)`, `initializeCurrentUser()`, `generateRequestKey()`

7. **Zaktualizuj szablon `explore-page.component.html`**:
   - Dodaj `<mat-form-field>` z `<input matInput [formControl]="queryControl">`
   - Dodaj podpowiedź `@if (shortQueryHintVisible())`
   - Dodaj `<pych-explore-recipe-filters>`
   - Dodaj `<pych-public-recipe-results [items]="items()" [loadingInitial]="loadingInitial()" [loadingMore]="loadingMore()" [hasMore]="pageInfo().hasMore" [errorMessage]="errorMessage()" [mode]="mode()" [context]="'explore'" (loadMore)="loadMore()" (retry)="retry()">`
   - Dodaj warunkowy empty state z przyciskiem „Wyczyść filtry"

8. **Zaktualizuj style `explore-page.component.scss`**:
   - Styl `.search-section` — grupuje pole wyszukiwania i filtry
   - Styl `.explore-empty-state` — wyśrodkowany blok z komunikatem i przyciskiem
   - Responsywność: weryfikacja poziomego scrollu chipów na ekranach `<960px`

9. **Napisz testy jednostkowe** `explore-recipe-filters.component.spec.ts`:
   - Gość (`isAuthenticated=false`): brak chipów „Ulubione" i „Chcę wypróbować" w DOM
   - Zalogowany (`isAuthenticated=true`): wszystkie chipy widoczne
   - Klik Termorobot → `filtersChange` emituje `{ ...defaultFilters, termorobot: true }`
   - Klik aktywnego Termorobot → emituje z `termorobot: false`
   - Klik `Wegetariańskie+` → emituje z `diet: 'vege_plus'`
   - Klik `Wszystkie diety` gdy aktywne → emituje z `diet: null`
   - Klik `Ulubione` → emituje z `favorite: true`

10. **Regresja manualna i E2E (Playwright)**:
    - Istniejące wyszukiwanie `q` działa bez filtrów (happy path)
    - Load more działa z aktywnymi filtrami (zachowanie filtrów przy cursor)
    - Landing page (`/`) — bez zmian: `PublicRecipesSearchComponent` z `PublicRecipesFacade` nadal działa
    - Badge „Twój przepis" na kafelkach Explore
    - Wskaźnik serduszka `is_favorite` na kafelkach (regresja PS-95)
    - Wejście na URL z filtrami (sc. 14): chipy aktywne natychmiast
    - Paginacja resetuje się po zmianie filtru (sc. 15)
