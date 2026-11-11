# Plan implementacji widoków — Tabela przepisów publicznych w panelu admina (PS-204)

**Slug:** `admin-public-recipes-table`
**Data:** 2026-11-11
**Runda pytań widoków:** `BRAK_PYTAŃ` (założenia z rundy w sekcji 14)
**Artefakty wejściowe:** `PS-204-admin-public-recipes-table-{user-story,api-plan,ui-plan,deployment-plan}.md`
**Wzorzec w kodzie:** `src/app/pages/admin/admin-users/` (strona kontenerowa + tabela prezentacyjna)

---

## 1. Przegląd

Nowa podstrona panelu admina `/admin/recipes` („Przepisy publiczne"): tylko-do-odczytu tabela przepisów
`PUBLIC` bez usuniętych, z sortowaniem po stronie serwera (6 kolumn), paginacją 25/50/100, stanami
ładowania/błędu/pustej listy, auto-korektą strony poza zakresem i linkiem „Otwórz przepis" w nowej karcie.

Architektura jak lista użytkowników:

- `AdminRecipesPageComponent` (`pych-admin-recipes-page`) — kontener: sygnały, pobieranie, wyścigi,
  korekta strony, obsługa `401`/`403`, mapowanie DTO → VM.
- `AdminRecipesTableComponent` (`pych-admin-recipes-table`) — prezentacja: `input()` / `output()`,
  `mat-table`, `matSort`, `mat-paginator`, stany.
- `AdminApiService.getRecipes()` — jedyna droga do danych (`supabase.functions.invoke`, bez
  `supabase.from()` / `supabase.rpc()`).
- Wszystkie komponenty: `standalone: true`, `ChangeDetectionStrategy.OnPush`, `inject()`, `@if` / `@for`,
  prefiks `pych`, kolory `--mat-sys-*`, wcięcie 4 znaki. Brak nowych zależności npm.

**Zależność kolejnościowa:** kontrakty w `shared/contracts/types.ts` (`AdminRecipesSortBy`,
`GetAdminRecipesQueryDto`, `AdminRecipeListItemDto`, `GetAdminRecipesResponseDto`) powstają w implementacji API
(plan API, pkt 5). Implementacja widoków startuje po nich; do czasu działania endpointu w testach
Vitest `AdminApiService` jest mockowany.

**Bez zmian:** dashboard, `admin-users/*` (w tym `AdminUsersPageHeaderComponent`), guardy, layout admina,
`AdminAsideNavComponent`, RLS, widoki przepisów.

---

## 2. Routing i nawigacja

### 2.1 `src/app/pages/admin/admin.routes.ts`

Dodać dziecko po `users`:

```ts
{
    path: 'recipes',
    loadComponent: () =>
        import('./admin-recipes/admin-recipes-page.component').then(
            (m) => m.AdminRecipesPageComponent
        ),
},
```

Trasa `admin` ma już `canMatch: [usernameCompleteMatchGuard, adminRoleMatchGuard]` (`app.routes.ts`, ok. l. 192–193) —
`user` / `premium` nie wchodzą; guardów nie zmieniamy.

### 2.2 `src/app/pages/admin/admin-layout/admin-navigation.config.ts`

Dodać trzecią pozycję (po „Użytkownicy"):

```ts
{
    label: 'Przepisy publiczne',
    route: '/admin/recipes',
    icon: 'menu_book',
    matchMode: 'exact',
    matchingRoutes: ['/admin/recipes'],
    ariaLabel: 'Przejdź do sekcji przepisów publicznych',
},
```

### 2.3 `src/app/app.routes.ts` — goście

W grupie tras gościa (drugi element tablicy `routes`, `canMatch: [guestOnlyMatchGuard]`), po `admin/users` (ok. l. 391–397):

```ts
{
    path: 'admin/recipes',
    redirectTo: () => {
        // Redirect guests to login with return URL
        return '/login?returnUrl=%2Fadmin%2Frecipes';
    },
    pathMatch: 'full',
},
```

### 2.4 Zachowanie błędów autoryzacji w widoku

- `401` → `router.navigate(['/login'], { queryParams: { returnUrl: '/admin/recipes' } })` (Router zakoduje do `%2Fadmin%2Frecipes`).
- `403` → `router.navigate(['/forbidden'])` (jak lista użytkowników).

---

## 3. Struktura plików

```
[NOWE]  src/app/pages/admin/admin-recipes/
            admin-recipes.models.ts
            admin-recipes-page.component.ts / .html / .scss / .spec.ts
            admin-recipes-table.component.ts / .html / .scss / .spec.ts
[NOWE]  src/app/pages/admin/admin.routes.spec.ts
[NOWE]  src/app/pages/admin/admin-layout/admin-navigation.config.spec.ts
[NOWE]  src/app/app.routes.admin-recipes.spec.ts            (patrz ryzyko R6)
[MOD.]  src/app/pages/admin/admin.routes.ts
[MOD.]  src/app/pages/admin/admin-layout/admin-navigation.config.ts
[MOD.]  src/app/app.routes.ts
[MOD.]  src/app/core/services/admin-api.service.ts
[MOD.]  src/app/core/services/admin-api.service.spec.ts
[MOD.]  shared/contracts/types.ts                           (z implementacji API; widoki tylko importują)
```

Nie dodajemy plików do `docs/` ani `doc/` poza tym planem. Struktura katalogów projektu (`project.mdc`) się nie zmienia
(nowy podkatalog mieści się w `./src/app/pages/{page-name}/`).

---

## 4. Serwis — `AdminApiService.getRecipes`

Plik: `src/app/core/services/admin-api.service.ts` (dodać importy DTO).

```ts
getRecipes(query: GetAdminRecipesQueryDto): Observable<GetAdminRecipesResponseDto>
```

- `URLSearchParams` jak w `getUsers`: dołączać `page`, `page_size`, `sort_by`, `sort_dir` tylko gdy zdefiniowane;
  endpoint `admin/recipes?...` albo `admin/recipes` (bez parametrów).
- `from(this.supabase.functions.invoke<GetAdminRecipesResponseDto>(endpoint, { method: 'GET' }))`.
- `response.error` → `Error(response.error.message || 'Błąd pobierania listy przepisów publicznych')` z
  `error.status = this.extractStatusFromError(response.error) ?? 500`.
- brak `response.data` → `Error('Nie udało się pobrać listy przepisów publicznych')`.
- Brak walidacji/normalizacji parametrów po stronie klienta (UI wysyła tylko `page ≥ 1`, `page_size ∈ {25,50,100}`,
  `sort_by` z allowlisty). Walidacja API (`page > Number.MAX_SAFE_INTEGER` → `400`) nie wpływa na UI: `page`
  zawsze wynika z paginatora lub z `totalPages` odpowiedzi.

---

## 5. Modele widoku — `admin-recipes.models.ts`

```ts
import {
    AdminRecipesSortBy,
    GetAdminRecipesResponseDto,
    SortDirection,
} from '../../../../../shared/contracts/types';

export interface AdminRecipesTableRowVm {
    readonly id: number;
    readonly name: string;
    readonly authorId: string;                       // pełne ID (atrybut title)
    readonly authorPrimaryLabel: string;             // nazwa | „Brak nazwy użytkownika" | skrócone ID
    readonly authorSecondaryLabel: string | null;    // e-mail | null (bez tekstu zastępczego)
    readonly categoryLabel: string;                  // nazwa | „—"
    readonly createdAtLabel: string;                 // pl-PL medium/short | „Brak daty"
    readonly averageRatingLabel: string;             // „4,5" | „—"
    readonly ratingsCount: number;                   // całkowita ≥ 0
    readonly isGrill: boolean;
    readonly isTermorobot: boolean;
    readonly recipeUrl: string;                      // `/explore/recipes/${id}`
    readonly openAriaLabel: string;                  // `Otwórz przepis ${name} w nowej karcie`
}

export interface AdminRecipesTableStateVm {
    readonly isInitialLoading: boolean;
    readonly isRefreshing: boolean;
    readonly isEmpty: boolean;
    readonly hasNoRowsOnPage: boolean;
    readonly hasError: boolean;
    readonly errorMessage: string | null;
}

export interface AdminRecipesSortChangeEvent {
    readonly sort_by: AdminRecipesSortBy;
    readonly sort_dir: SortDirection;
}

export interface AdminRecipesPageChangeEvent {
    readonly page: number;
    readonly page_size: number;
}

export type AdminRecipesPaginationVm = GetAdminRecipesResponseDto['pagination'];
export type AdminRecipesSortingVm = GetAdminRecipesResponseDto['sorting'];

export const ADMIN_RECIPES_PAGE_SIZE_OPTIONS: readonly number[] = [25, 50, 100];

/** Skrót ID autora: 8 znaków + „..." + 4 ostatnie (jeśli długość > 12). Ten sam algorytm co `buildDisplayId` listy użytkowników. */
export function buildAuthorDisplayId(id: string): string {
    if (!id || id.length <= 12) {
        return id;
    }

    return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
```

Zasady:

- Helper `buildAuthorDisplayId` jest **kopią algorytmu** w nowym pliku (`AdminUsersPageComponent.buildDisplayId` jest `private`
  — nie ruszamy go, aby uniknąć regresji listy użytkowników). Test potwierdza identyczne wyniki (granice 12/13 znaków).
- `AdminRecipesTableStateVm.hasNoRowsOnPage` jest dodane względem szkicu w planie UI (plan UI używa go w szablonie, ale pomija w typie).

---

## 6. Strona kontenerowa — `AdminRecipesPageComponent`

Pliki: `admin-recipes-page.component.{ts,html,scss}`, selektor `pych-admin-recipes-page`.
Importy komponentu: `AdminUsersPageHeaderComponent` (z `../admin-users/admin-users-page-header.component`, **bez zmian**) i `AdminRecipesTableComponent`.

### 6.1 Szablon i style

```html
<section class="admin-recipes-page">
    <pych-admin-users-page-header [title]="title" [description]="description" />

    <pych-admin-recipes-table
        [rows]="rows()"
        [state]="tableState()"
        [pagination]="pagination()"
        [sorting]="sorting()"
        [displayedColumns]="displayedColumns"
        (sortChange)="onSortChange($event)"
        (pageChange)="onPageChange($event)"
        (retry)="onRetry()" />
</section>
```

SCSS: jak `admin-users-page.component.scss` (padding `2rem 2rem 4rem`; `max-width: 960px` → `1.5rem 1rem 3rem`).

Stałe:

- `title = 'Przepisy publiczne'`
- `description = 'Przegląd przepisów publicznych w aplikacji. Przepisy prywatne i udostępnione linkiem nie są tutaj pokazywane.'`
- `displayedColumns = ['id','name','author','category','createdAt','averageRating','ratingsCount','flags','actions']`

### 6.2 Stan (sygnały)

| Sygnał | Początkowo |
|---|---|
| `query: signal<Required<GetAdminRecipesQueryDto>>` | `{ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' }` |
| `rows: signal<AdminRecipesTableRowVm[]>` | `[]` |
| `pagination: signal<AdminRecipesPaginationVm>` | `{ currentPage: 1, pageSize: 25, totalPages: 0, totalItems: 0 }` |
| `sorting: signal<AdminRecipesSortingVm>` | `{ sort_by: 'created_at', sort_dir: 'desc' }` |
| `isInitialLoading` | `true` |
| `isRefreshing` | `false` |
| `errorMessage: signal<string \| null>` | `null` |

Brak trwałości stanu: żadnego `localStorage` / `sessionStorage` / query params / `ActivatedRoute`; po F5 wartości początkowe.

`computed`:

```ts
private readonly isIdle = computed(() => !this.isInitialLoading() && !this.isRefreshing() && !this.errorMessage());

readonly isEmpty = computed(() =>
    this.isIdle() && this.rows().length === 0 && this.pagination().totalItems === 0);

readonly hasNoRowsOnPage = computed(() =>
    this.isIdle() && this.rows().length === 0 && this.pagination().totalItems > 0);

readonly tableState = computed<AdminRecipesTableStateVm>(() => ({
    isInitialLoading: this.isInitialLoading(),
    isRefreshing: this.isRefreshing(),
    isEmpty: this.isEmpty(),
    hasNoRowsOnPage: this.hasNoRowsOnPage(),
    hasError: this.errorMessage() !== null,
    errorMessage: this.errorMessage(),
}));
```

### 6.3 Operacje

| Metoda | Zachowanie |
|---|---|
| `ngOnInit()` | `loadRecipes(this.query())` |
| `onRetry()` | `loadRecipes(this.query())` (bieżące parametry; ponownie uruchamia też korektę strony) |
| `onSortChange(event)` | `nextQuery = { ...query, sort_by, sort_dir, page: 1 }`; gdy sortowanie **i** strona (1) bez zmian → return; inaczej `query.set(nextQuery)` + `loadRecipes(nextQuery)`; `page_size` zachowany |
| `onPageChange(event)` | `sizeChanged = event.page_size !== query().page_size`; `nextPage = sizeChanged ? 1 : Math.max(1, event.page)`; `nextQuery = { ...query, page: nextPage, page_size: event.page_size }` (sortowanie zachowane); gdy `page` i `page_size` bez zmian → return; przy `sizeChanged`: `pagination.update(p => ({ ...p, currentPage: 1, pageSize: event.page_size }))` (żeby `mat-paginator` nie pokazał stanu pośredniego); potem `query.set` + `loadRecipes` |

Wymuszenie strony 1 przy zmianie rozmiaru realizuje **kontener** (nie `mat-paginator`, który zachowuje „pierwszy widoczny element" i może wysłać `pageIndex ≠ 0`).

### 6.4 `loadRecipes(query, isCorrection = false)` — wyścigi i auto-korekta

```text
requestId = ++latestRequestId
hasExistingContent = rows().length > 0 || pagination().totalItems > 0
errorMessage = null
isRefreshing = hasExistingContent
isInitialLoading = !hasExistingContent
adminApi.getRecipes(query).pipe(takeUntilDestroyed(destroyRef)).subscribe:
    next(response):
        jeśli requestId !== latestRequestId → return
        jeśli !isCorrection
           oraz response.data.length === 0
           oraz response.pagination.totalItems > 0
           oraz response.pagination.currentPage > response.pagination.totalPages:
               loadRecipes({ ...query, page: response.pagination.totalPages }, true)
               return      // pustej odpowiedzi NIE zapisujemy w rows/pagination
        rows.set(map(response.data))
        pagination.set(response.pagination); sorting.set(response.sorting)
        query.set({ page: pagination.currentPage, page_size: pagination.pageSize,
                    sort_by: sorting.sort_by, sort_dir: sorting.sort_dir })
        errorMessage = null; isInitialLoading = false; isRefreshing = false
    error(err):
        jeśli requestId !== latestRequestId → return
        isInitialLoading = false; isRefreshing = false
        401 → router.navigate(['/login'], { queryParams: { returnUrl: '/admin/recipes' } }); return
        403 → router.navigate(['/forbidden']); return
        inaczej errorMessage = 'Nie udało się pobrać listy przepisów publicznych. Odśwież widok lub spróbuj ponownie.'
```

Zasady:

- **Jednokrotność:** żądanie korygujące (`isCorrection = true`) nigdy nie uruchamia kolejnej korekty (nawet gdy znów pusta → stan `hasNoRowsOnPage`). Korekta kopiuje `sort_by`, `sort_dir`, `page_size`, podmienia tylko `page = totalPages`. Korekta jest **cicha** (bez snackbara, bez komunikatu).
- **Odświeżanie w trakcie korekty:** `isRefreshing` / `isInitialLoading` zostają włączone (nie ustawiamy ich w `next` przed korektą); poprzednie dane zostają widoczne z `opacity: 0.5`. Dzięki temu komunikat pustej listy nie „miga".
- **Precyzja warunku „pierwsze ładowanie":** w odróżnieniu od listy użytkowników `hasExistingContent` uwzględnia także `totalItems > 0` (nie tylko `rows().length > 0`) — stan `hasNoRowsOnPage` (puste `rows`, `totalItems > 0`) nie zastępuje paginatora pełnoekranowym spinnerem przy kolejnej zmianie strony.
- **Wyścigi:** `latestRequestId`; odpowiedź starszego żądania (także starej korekty) jest ignorowana; nowa akcja użytkownika podczas korekty unieważnia korektę.
- **Zapis stanu zgodnie z `frontend.mdc`:** dane wymieniane w całości po komplecie danych (`rows.set` nową tablicą), brak białego overlayu i pseudo-elementów `::after`.
- **`takeUntilDestroyed(destroyRef)`** (`@angular/core/rxjs-interop`) — odpięcie po zniszczeniu komponentu (usprawnienie względem listy użytkowników, bez wpływu na zachowanie).
- Błąd przy istniejących wierszach: wiersze zostają, tabela pokazuje inline błąd z „Spróbuj ponownie".

### 6.5 Mapowanie DTO → VM (prywatne metody kontenera)

| Pole | Reguła |
|---|---|
| `authorPrimaryLabel` | `author_username?.trim()` niepusty → nazwa; w przeciwnym razie `author_email?.trim()` niepusty → `'Brak nazwy użytkownika'`; oba puste → `buildAuthorDisplayId(author_id)` |
| `authorSecondaryLabel` | `author_email?.trim()` niepusty → e-mail; inaczej `null` (bez tekstu zastępczego) |
| `categoryLabel` | `category_name?.trim() \|\| '—'` |
| `createdAtLabel` | `formatDateLabel(created_at, 'Brak daty')`: `new Date(value)`; `NaN` → `'Brak daty'`; inaczej `toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' })` (taka sama implementacja jak `AdminUsersPageComponent.formatDateLabel`) |
| `averageRatingLabel` | `typeof v === 'number' && Number.isFinite(v)` → `AVERAGE_RATING_FORMATTER.format(v)`, gdzie `new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (stała modułu) → `4,0`, `4,5`; `null` / `undefined` / `NaN` → `'—'` (nigdy `0`, nigdy `NaN`) |
| `ratingsCount` | `Number.isFinite(count) ? count : 0` |
| `isGrill`, `isTermorobot` | `=== true` |
| `recipeUrl` | `` `/explore/recipes/${id}` `` (ścieżka bez sluga obsługiwana przez trasę legacy `exploreRecipeIdOnlyMatcher` → normalizacja do kanonicznego URL) |
| `openAriaLabel` | `` `Otwórz przepis ${name} w nowej karcie` `` |

Wszystkie teksty w szablonach tylko przez interpolację `{{ }}`; **zakaz `[innerHTML]`** (przypadek brzegowy 7: znaki HTML jako zwykły tekst).

---

## 7. Tabela — `AdminRecipesTableComponent`

Pliki: `admin-recipes-table.component.{ts,html,scss}`, selektor `pych-admin-recipes-table`.
Importy: `MatTableModule`, `MatSortModule`, `MatPaginatorModule`, `MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`
(`MatTooltipModule` **nie** — pełna treść przez natywny atrybut `title`, patrz 7.4).

### 7.1 API komponentu

```ts
readonly rows = input.required<AdminRecipesTableRowVm[]>();
readonly state = input.required<AdminRecipesTableStateVm>();
readonly pagination = input.required<AdminRecipesPaginationVm>();
readonly sorting = input.required<AdminRecipesSortingVm>();
readonly displayedColumns = input.required<readonly string[]>();

readonly sortChange = output<AdminRecipesSortChangeEvent>();
readonly pageChange = output<AdminRecipesPageChangeEvent>();
readonly retry = output<void>();

readonly pageSizeOptions = ADMIN_RECIPES_PAGE_SIZE_OPTIONS;
readonly hasRows = computed(() => this.rows().length > 0);
readonly activeSortColumn = computed(() => SORT_BY_TO_COLUMN_MAP[this.sorting().sort_by]);
readonly paginatorPageIndex = computed(() => Math.max(this.pagination().currentPage - 1, 0));
```

Mapy (jak w `AdminUsersTableComponent`):

```ts
const COLUMN_TO_SORT_BY_MAP: Readonly<Record<string, AdminRecipesSortBy>> = {
    name: 'name', author: 'author', category: 'category',
    createdAt: 'created_at', averageRating: 'average_rating', ratingsCount: 'ratings_count',
};
const SORT_BY_TO_COLUMN_MAP: Readonly<Record<AdminRecipesSortBy, string>> = {
    name: 'name', author: 'author', category: 'category',
    created_at: 'createdAt', average_rating: 'averageRating', ratings_count: 'ratingsCount',
};
```

Metody: `onMatSortChange(event: Sort)` (nieznana kolumna → return; kierunek `asc` → `'asc'`, inaczej `'desc'`),
`onMatPageChange(event: PageEvent)` → `pageChange.emit({ page: event.pageIndex + 1, page_size: event.pageSize })`,
`onRetryClick()`, `trackByRowId(_, row) => row.id`.

### 7.2 Szablon — gałęzie stanu

```text
<section class="admin-recipes-table" [class.admin-recipes-table--refreshing]="state().isRefreshing">
@if (state().isInitialLoading)                  → spinner (diameter 24) + „Ładowanie listy przepisów publicznych..."
@else if (state().hasError && !hasRows())       → state().errorMessage + [Spróbuj ponownie]
@else if (state().isEmpty)                      → „Brak przepisów publicznych do wyświetlenia." (bez tabeli i paginatora)
@else
    @if (state().hasError && hasRows())         → inline błąd + [Spróbuj ponownie]
    @if (hasRows())                             → <div class="…__scroll"><table mat-table …></div>
    @else if (state().hasNoRowsOnPage)          → „Brak wyników na tej stronie."
    <mat-paginator …>
```

Uwaga: `hasNoRowsOnPage` jest `false` podczas odświeżania (patrz `isIdle`) — wtedy w `@else if (hasRows())` bez wierszy nic się nie renderuje poza paginatorem i kontenerem z `opacity: 0.5`; to krótki stan (korekta w toku), akceptowalny.

### 7.3 Kolumny

`<table mat-table [dataSource]="rows()" [trackBy]="trackByRowId" matSort matSortDisableClear [matSortActive]="activeSortColumn()" [matSortDirection]="sorting().sort_dir" (matSortChange)="onMatSortChange($event)">`

| `matColumnDef` | Nagłówek | `mat-sort-header` | Komórka |
|---|---|---|---|
| `id` | ID | nie | `{{ row.id }}` w całości |
| `name` | Nazwa | tak | `{{ row.name }}`, klasa `__cell--wrap`, `[attr.title]="row.name"` |
| `author` | Autor | tak | linia 1 `<span class="__author-primary" [attr.title]="row.authorId">{{ row.authorPrimaryLabel }}</span>`; `@if (row.authorSecondaryLabel)` linia 2 `<span class="__author-secondary" [attr.title]="row.authorSecondaryLabel">…</span>`; zawijanie długiego e-maila |
| `category` | Kategoria | tak | `{{ row.categoryLabel }}`, `[attr.title]` |
| `createdAt` | Data utworzenia | tak | `{{ row.createdAtLabel }}` |
| `averageRating` | Średnia ocena | tak | `{{ row.averageRatingLabel }}`, klasa `__cell--number` (do prawej) |
| `ratingsCount` | Liczba ocen | tak | `{{ row.ratingsCount }}`, klasa `__cell--number` |
| `flags` | Znaczniki | nie | pigułki (7.5); brak znaczników → pusta komórka |
| `actions` | Akcja | nie | link „Otwórz przepis" (7.6) |

Brak kolumn „Widoczność" i „Data modyfikacji". Sortowanie wyłącznie serwerowe: `dataSource` to zwykła tablica, `matSortChange` nie jest podpinany do `MatTableDataSource`.
`MatSort` generuje strzałkę i `aria-sort` na aktywnej kolumnie wg `sorting()` (odpowiedź API = źródło prawdy). Pierwsze kliknięcie nowej kolumny → `asc`, drugie → `desc`.

### 7.4 Długie teksty

`overflow-wrap: anywhere` + `max-width` na kolumnach nazwy / autora / kategorii; pełna treść w atrybucie `title` (natywny tooltip; brak
`MatTooltipModule`, bo tekst jest już zawinięty i widoczny — `title` to dodatek, nie jedyna droga do treści).

### 7.5 Znaczniki „Grill" / „Termorobot"

```html
<td mat-cell *matCellDef="let row">
    @if (row.isGrill || row.isTermorobot) {
    <div class="admin-recipes-table__flags">
        @if (row.isGrill) {
        <span class="admin-recipes-table__flag admin-recipes-table__flag--grill">
            <mat-icon aria-hidden="true">outdoor_grill</mat-icon>Grill
        </span>
        }
        @if (row.isTermorobot) {
        <span class="admin-recipes-table__flag admin-recipes-table__flag--termorobot">
            <mat-icon aria-hidden="true">blender</mat-icon>Termorobot
        </span>
        }
    </div>
    }
</td>
```

Widoczny tekst jest etykietą dla czytnika; ikona dekoracyjna (`aria-hidden`). Ikony `outdoor_grill` i `blender` są już używane w aplikacji (`recipe-card`, `explore-recipe-filters`).

### 7.6 Link „Otwórz przepis"

```html
<a mat-stroked-button
   class="admin-recipes-table__open-link"
   [attr.href]="row.recipeUrl"
   target="_blank"
   rel="noopener"
   [attr.aria-label]="row.openAriaLabel">
    Otwórz przepis
    <mat-icon iconPositionEnd aria-hidden="true">open_in_new</mat-icon>
</a>
```

- Zwykły `href` (nie `routerLink`) — nowa karta; karta panelu nie zmienia stanu.
- `rel="noopener"` dokładnie wg decyzji 11 (test sprawdza równość atrybutu).
- `iconPositionEnd` jest dostępny w zainstalowanym `@angular/material` 21.1.x; `aria-label` zawiera nazwę przepisu i „w nowej karcie".

### 7.7 Paginator i selektor rozmiaru strony

```html
<mat-paginator
    [length]="pagination().totalItems"
    [pageSize]="pagination().pageSize"
    [pageIndex]="paginatorPageIndex()"
    [pageSizeOptions]="pageSizeOptions"
    [hidePageSize]="false"
    showFirstLastButtons
    (page)="onMatPageChange($event)"
    aria-label="Paginacja listy przepisów publicznych">
</mat-paginator>
```

Widoczny w gałęzi `@else` także dla `hasNoRowsOnPage` (nawigacja po korekcie wyczerpanej); niewidoczny dla `isEmpty`, `isInitialLoading` i błędu bez wierszy.
Decyzję o wymuszeniu `page = 1` przy zmianie rozmiaru podejmuje kontener (6.3).

### 7.8 Style — `admin-recipes-table.component.scss`

- Kontener `.admin-recipes-table`: jak `admin-users-table` (obramowanie `--mat-sys-outline-variant`, radius `1rem`, padding `1rem`, tło `--mat-sys-surface`).
- Odświeżanie: `.admin-recipes-table--refreshing { opacity: 0.5; }` (wg historyjki i `frontend.mdc`; lista użytkowników używa 0.65 — **nie** kopiować).
- `__scroll { overflow-x: auto; }`, `__scroll table { min-width: 1320px; width: 100%; }` — na < 600 px wszystkie kolumny, przewijanie poziome, bez kart.
- `__cell--wrap { max-width: 22rem; overflow-wrap: anywhere; }`; `__author-primary` (`display: block`), `__author-secondary` (`display: block; color: var(--mat-sys-on-surface-variant); font-size: 0.8125rem; overflow-wrap: anywhere`).
- `__cell--number { text-align: right; }` (nagłówek tych kolumn bez `mat-sort-header`-owego przesunięcia nie wymaga zmian).
- Pigułki: `display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; line-height: 1.4;` `mat-icon` w pigułce `font-size/width/height: 1rem`.
    - `--grill`: `background: var(--mat-sys-secondary-container); color: var(--mat-sys-on-secondary-container);`
    - `--termorobot`: `background: var(--mat-sys-tertiary-container); color: var(--mat-sys-on-tertiary-container);`
    - Brak twardych kolorów hex (różnica względem `admin-users-table__role`).
- `__flags { display: flex; flex-wrap: wrap; gap: 0.375rem; }`.
- Błędy: `color: var(--mat-sys-error)`; status/inline błąd jak w użytkownikach, `flex-direction: column` poniżej 960 px.
- Nie ukrywać `outline` (widoczny fokus Material dla nagłówków sortowania, linku, paginatora).
- Brak `::after` z białym tłem i `rgba(255,255,255,…)`.

---

## 8. Dostępność (WCAG 2.1 AA)

- `aria-sort` generowany przez `MatSort` na aktywnym nagłówku (test); ID / Znaczniki / Akcja bez `mat-sort-header`.
- Link: `aria-label` z nazwą przepisu i „w nowej karcie"; ikona `aria-hidden`.
- Znaczniki z widocznym tekstem; ikony dekoracyjne `aria-hidden="true"`.
- Paginator z `aria-label`; obsługa klawiaturą z Material.
- Stany tekstowe: „Ładowanie listy przepisów publicznych...", komunikat błędu z przyciskiem „Spróbuj ponownie".
- **Brak** programowego przewijania i przenoszenia fokusu po zmianie strony / sortowania (decyzja rundy): fokus zostaje na kontrolce paginatora/nagłówka, który go wywołał.
- Kontrast pigułek zapewniają pary `*-container` / `on-*-container` tokenów Material.

---

## 9. Macierz: scenariusz → implementacja → test

| Scen. | Realizacja | Test Vitest |
|---|---|---|
| 1 | trasa 2.1, nawigacja 2.2, tytuł/podtytuł 6.1, 9 kolumn 7.3, stan początkowy 6.2 | page 11.1 (1); table 11.2 (1); nav 11.4 |
| 2 | brak logiki zakresu w UI (filtr w bazie); odświeżenie = „Spróbuj ponownie"/ponowne pobranie | — (API/DB); page 11.1 (11) |
| 3, 8, 9 | mapowanie 6.5, komórki 7.3 | page 11.1 (12); table 11.2 (5) |
| 4, 5, 6, 6a | `matSort` 7.1/7.3, `onSortChange` 6.3 | page (2, 3); table (2–4) |
| 7 | `onPageChange` 6.3, paginator 7.7, brak trwałości 6.2 | page (4, 5, 13); table (8) |
| 10 | link 7.6 | table (6) |
| 11 | stany 7.2, korekta 6.4 | page (6–11); table (9) |
| 12 | 2.1, 2.3, 2.4 | page (11); routes (11.4) |
| 13 | `min-width` + `overflow-x: auto` 7.8 | table (kontener przewijania); manualnie < 600 px |
| 14 | „Bez zmian" (sekcja 1), brak edycji `admin-users/*` | pełny `npm run test` |

---

## 10. Kolejność implementacji

1. (po API) kontrakty `shared/contracts/types.ts` dostępne.
2. `AdminApiService.getRecipes` + test.
3. `admin-recipes.models.ts`.
4. `AdminRecipesTableComponent` (+ test) — niezależny od strony.
5. `AdminRecipesPageComponent` (+ test).
6. Trasa `admin.routes.ts`, nawigacja, trasa gościa `app.routes.ts` (+ testy).
7. `npm run lint`, `npm run build`, `npm run test` (statusy jawnie: `PASS` / `FAIL` / `NIE_WYKONANO`).

---

## 11. Testy jednostkowe Vitest (bez E2E)

Konwencje (`vitest.mdc`): `import 'zone.js'` i `'zone.js/testing'` na początku, `beforeAll` z `TestBed.resetTestEnvironment()` +
`initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting())`, `NoopAnimationsModule` dla komponentów Material,
mocki `vi.fn()`, `firstValueFrom` dla serwisów, natywne asercje (`toBeTruthy`, `hasAttribute`, `classList.contains`),
funkcje pomocnicze `buildRecipesResponse()` / `buildRecipeDto()` i `createComponent()`. Daty w asercjach liczyć tym samym
`toLocaleString('pl-PL', …)` co implementacja (nie na sztywno), aby test nie zależał od ICU środowiska.

### 11.1 `admin-recipes-page.component.spec.ts` (mock `AdminApiService.getRecipes`, mock `Router.navigate`)

1. Start: `getRecipes` wywołane raz z `{ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' }`; tytuł „Przepisy publiczne" i podtytuł o przepisach prywatnych/udostępnionych linkiem.
2. Sortowanie `name asc` → żądanie z `page: 1` i zachowanym `page_size`; to samo sortowanie na stronie 1 → brak nowego żądania.
3. Sortowanie ze strony 3 → `page: 1`, `page_size` zachowany.
4. Zmiana strony zachowuje `sort_by` / `sort_dir` / `page_size`; ta sama strona i rozmiar → brak żądania.
5. Zmiana rozmiaru 25 → 50 ze strony 3 → żądanie `page: 1, page_size: 50` z tym samym sortowaniem; `pagination().currentPage` od razu `1`.
6. Auto-korekta: 1. odpowiedź `data: []`, `currentPage: 9`, `totalPages: 3`, `totalItems: 61` → 2. żądanie `page: 3` z niezmienionym sortowaniem/rozmiarem; stan końcowy z wierszami 2. odpowiedzi; `isEmpty()` `false`; **dokładnie dwa** wywołania.
7. Brak pętli: 2. odpowiedź też `data: []`, `totalItems: 61` → brak 3. żądania; `isEmpty()` `false`, `hasNoRowsOnPage()` `true`.
8. Korekta, gdy `totalItems` spadło do 0 → `isEmpty()` `true`.
9. `data: []`, `totalItems: 0` → jedno żądanie, `isEmpty()` `true`, bez korekty.
10. Wyścigi: dwie szybkie zmiany sortowania (`Subject`), odpowiedź pierwszej po drugiej ignorowana; nowa akcja w trakcie korekty unieważnia korektę (odpowiedź korekty nie nadpisuje stanu); w trakcie odświeżania (`isRefreshing()`) poprzednie `rows` zostają.
11. Błędy: `401` → `navigate(['/login'], { queryParams: { returnUrl: '/admin/recipes' } })`; `403` → `navigate(['/forbidden'])`; `500` → `errorMessage` i „Spróbuj ponownie" (`onRetry`) ponawia `getRecipes` z bieżącym `query`; błąd przy istniejących wierszach → wiersze zostają, `hasError`; `isInitialLoading` po błędzie `false`.
12. Mapowanie wiersza: (a) brak nazwy + e-mail → „Brak nazwy użytkownika" / e-mail; (b) nazwa + brak e-maila → nazwa / `null`; (c) oba puste → `1a2b3c4d...ef01` (z UUID o długości > 12) / `null`; białe znaki w nazwie/e-mailu traktowane jak puste; kategoria `null` → `—`; średnia `4` → `4,0`, `4.5` → `4,5`, `null` → `—`, `NaN` → `—`; `ratings_count: 0` → `0`; data poprawna wg `pl-PL`, niepoprawna → `Brak daty`; flagi; `recipeUrl` `/explore/recipes/42`; `openAriaLabel`.
13. Brak trwałości: świeża instancja startuje z wartościami domyślnymi; `localStorage`/`sessionStorage` nie są odczytywane (`vi.spyOn(Storage.prototype, 'getItem')` nie wywołane).
14. `buildAuthorDisplayId`: granice 12 / 13 znaków i zgodność z algorytmem listy użytkowników (dla `12345678-aaaa-bbbb-cccc-1234567890ab` → `12345678...90ab`).

### 11.2 `admin-recipes-table.component.spec.ts` (komponent hostowany przez `fixture.componentRef.setInput`)

1. Nagłówki dokładnie: ID, Nazwa, Autor, Kategoria, Data utworzenia, Średnia ocena, Liczba ocen, Znaczniki, Akcja; brak „Widoczność" i „Data modyfikacji".
2. Sześć nagłówków z `mat-sort-header`; ID, Znaczniki, Akcja bez sortowania.
3. `aria-sort` aktywnej kolumny zgodny z `sorting()` (`created_at desc` → `descending`); po zmianie wejścia `sorting` aktualizuje się.
4. Kliknięcie „Nazwa" emituje `{ sort_by: 'name', sort_dir: 'asc' }`, ponowne `desc`; po jednym teście mapowania dla `author`, `category`, `created_at`, `average_rating`, `ratings_count`.
5. Komórki: ID w całości (`42`), autor w dwóch / jednej linii, `—`, `0`, znaczniki (Grill / Termorobot / oba / żaden — tekst „Grill" / „Termorobot" w DOM, ikony z `aria-hidden="true"`, brak pigułek dla `false`).
6. Link: `target="_blank"`, `rel="noopener"`, `href="/explore/recipes/42"`, `aria-label` z nazwą przepisu, ikona `open_in_new` z `aria-hidden="true"`.
7. Escapowanie: nazwa `<b>x</b>` i `&amp;` jako tekst (brak elementu `<b>` w DOM, `textContent` zawiera literalne `<b>x</b>`); atrybut `title` z pełną nazwą.
8. Paginator: `pageSizeOptions` `[25, 50, 100]`, `hidePageSize = false`, `pageSize` z wejścia; zmiana strony i zmiana rozmiaru emitują `pageChange` `{ page, page_size }` (zmiana rozmiaru emituje wartość z paginatora — wymuszenie strony 1 jest po stronie kontenera).
9. Stany: `isInitialLoading` → spinner + tekst; `hasError && !rows` → komunikat + „Spróbuj ponownie" emituje `retry`; `isEmpty` → komunikat, brak tabeli i paginatora; `hasNoRowsOnPage` → „Brak wyników na tej stronie.", brak komunikatu pustej listy, paginator widoczny; `isRefreshing` → klasa `admin-recipes-table--refreshing` i wiersze nadal widoczne; błąd z wierszami → inline błąd + wiersze.
10. Kontener przewijania `.admin-recipes-table__scroll` istnieje i otacza `table` (jsdom nie weryfikuje layoutu; `min-width` sprawdzane manualnie).

### 11.3 `admin-api.service.spec.ts` (rozszerzenie)

- `getRecipes({ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' })` → `invoke('admin/recipes?page=1&page_size=25&sort_by=created_at&sort_dir=desc', { method: 'GET' })`, zwraca `data` bez zmian.
- `getRecipes({})` → `'admin/recipes'`; pojedyncze parametry pomijają niezdefiniowane.
- `response.error` z `context.status = 403` → `Error` ze `status === 403`; bez statusu → `500`; brak `data` → `Error('Nie udało się pobrać listy przepisów publicznych')`.

### 11.4 Nawigacja i routing

- `admin-navigation.config.spec.ts`: `ADMIN_NAV_ITEMS` zawiera „Przepisy publiczne" (`route: '/admin/recipes'`, `icon: 'menu_book'`, `matchMode: 'exact'`, `matchingRoutes: ['/admin/recipes']`, `ariaLabel`); Dashboard i Użytkownicy bez zmian; trasy unikalne.
- `admin.routes.spec.ts` (`import '@angular/compiler'` jak `recipes.routes.spec.ts`): dziecko `recipes` ma `loadComponent`, a wynik rozwiązuje się do `AdminRecipesPageComponent`; `dashboard` i `users` nadal istnieją.
- `app.routes.admin-recipes.spec.ts`: w grupie tras z `canMatch` zawierającym `guestOnlyMatchGuard` trasa `admin/recipes` ma `pathMatch: 'full'`, a `redirectTo` zwraca `/login?returnUrl=%2Fadmin%2Frecipes` (wywołanie funkcji z atrapą `ActivatedRouteSnapshot`). Patrz R6.

---

## 12. Weryfikacja manualna (lokalnie; konto admina z `.env.local`, bez sekretów w dokumentach)

Sortowanie wszystkich 6 kolumn w obu kierunkach (kontrola: tylko „Średnia ocena" przesuwa przepisy bez ocen na koniec; „Liczba ocen" rosnąco zaczyna od `0`;
autor bez nazwy i pusta kategoria na końcu; polskie znaki); rozmiar 25/50/100 z zachowaniem sortowania i powrotem na stronę 1; strona poza zakresem
(np. usunięcie przepisów między pobraniami albo podmiana odpowiedzi w DevTools) i jednokrotna korekta; link w nowej karcie z zachowaniem stanu karty admina;
szerokość < 600 px (przewijanie poziome, brak ucinania); konto `user` bez pozycji w sidebarze i z blokadą `/admin/recipes`; gość → `/login?returnUrl=%2Fadmin%2Frecipes`;
F5 → stan domyślny; ciemny/jasny motyw (kontrast pigułek). Statusy zapisać jawnie: `PASS` / `FAIL` / `NIE_WYKONANO`.

---

## 13. Kryteria ukończenia widoków

- [ ] `/admin/recipes` ładowana lazy; pozycja „Przepisy publiczne" w sidebarze; przekierowanie gościa.
- [ ] 9 kolumn, 6 sortowalnych, `aria-sort`, stany ładowania / błędu / pustej listy / „Brak wyników na tej stronie".
- [ ] Paginator 25/50/100; zmiana rozmiaru zachowuje sortowanie i wraca na stronę 1; cicha jednokrotna auto-korekta.
- [ ] Autor (reguły zastępcze), kategoria `—`, średnia `4,5` / `—`, liczba ocen `0`, znaczniki jako pigułki, link w nowej karcie z `rel="noopener"`.
- [ ] `401` → logowanie, `403` → `/forbidden`; brak trwałości stanu.
- [ ] Testy Vitest z sekcji 11 zielone; `npm run lint`, `npm run build`, `npm run test` — wynik zapisany jawnie.
- [ ] `admin-users/*` i dashboard bez zmian w zachowaniu.

---

## 14. Założenia przyjęte z rundy pytań widoków

1. `AdminUsersPageHeaderComponent` reużyty bez zmian i bez przenoszenia (ewentualny wspólny katalog to osobny refaktor).
2. Znaczniki: pigułki z tekstem „Grill" / „Termorobot", tokeny `--mat-sys-*`, ikony `outdoor_grill` / `blender` (`aria-hidden`).
3. Link „Otwórz przepis": `mat-stroked-button` (`<a href>`, `target="_blank"`, `rel="noopener"`), opcjonalna ikona `open_in_new` (`aria-hidden`), `aria-label` z nazwą przepisu.
4. Ikona pozycji menu: `menu_book`.
5. Tabela: `min-width` ~1320 px, przewijanie poziome; `opacity: 0.5` przy odświeżaniu.
6. Paginator z selektorem 25/50/100; strona 1 wymuszana przez kontener.
7. Cicha, jednokrotna auto-korekta strony poza zakresem; stan „Brak wyników na tej stronie" jako szczegół techniczny (po wyczerpaniu korekty).
8. `403` → `/forbidden`, `401` → `/login?returnUrl=%2Fadmin%2Frecipes`.
9. Długie teksty zawijane, pełna treść w `title`.
10. Brak przewijania i przenoszenia fokusu po zmianie strony.
11. Helper skrótu ID autora w `admin-recipes.models.ts`.
12. Testy wyłącznie Vitest wg sekcji 11; bez E2E.
13. **Informacja z etapu planów implementacji:** walidacja API odrzuca `page > Number.MAX_SAFE_INTEGER` (`400`); UI wysyła tylko `page ≥ 1` z paginatora lub `totalPages` z odpowiedzi — brak zmian w UI, strona poza zakresem nadal obsługiwana auto-korektą.

---

## 15. Sprzeczności, doprecyzowania i ryzyka

**Sprzeczności (bez blokady):**

- **S1. Opacity:** historyjka i `frontend.mdc` — `0.5`; lista użytkowników używa `0.65`. Plan stosuje `0.5` (nie kopiować wartości z `admin-users-table.component.scss`).
- **S2. Link i ikona:** plan UI nie ma ikony `open_in_new`; runda widoków ją dopuszcza — plan ją dodaje (`iconPositionEnd`, `aria-hidden`).
- **S3. Znaczniki:** plan UI opisuje „etykiety tekstowe", runda dodaje ikony — pigułka = ikona + tekst; tekst pozostaje etykietą dla czytnika.
- **S4. Typ `AdminRecipesTableStateVm`:** plan UI wymienia pola skrótowo, bez `hasNoRowsOnPage` w typie, mimo że szablon go używa — dodane jawnie (sekcja 5).
- **S5. Moment ustawienia `isInitialLoading`:** plan UI wylicza go z `rows().length`; tu z `rows().length > 0 || totalItems > 0` (stan `hasNoRowsOnPage` nie zastępuje paginatora spinnerem). To jedyne świadome odejście od logiki listy użytkowników.

**Ryzyka:**

- **R1. Zależność od API.** Brak kontraktów w `shared/contracts/types.ts` blokuje kompilację widoków; implementacja API musi je dostarczyć pierwsza (sekcja 10).
- **R2. Rozjazd `pagination` po błędzie zmiany rozmiaru.** Przy `sizeChanged` kontener optymistycznie ustawia `pagination.currentPage/pageSize`; jeśli żądanie zawiedzie, wiersze dotyczą starego rozmiaru, a paginator pokazuje nowy. „Spróbuj ponownie" używa nowego `query`, więc stan zbiega po udanym ponowieniu. Akceptowane (jak w liście użytkowników dla `query`); nie dodajemy rollbacku.
- **R3. Auto-korekta a `currentPage` z API.** API zwraca **żądaną** stronę (nie ucinaną); korekta musi porównywać z `totalPages`, nie polegać na kodzie błędu (test 11.1.6–7).
- **R4. `mat-paginator` przy zmianie rozmiaru.** Wewnętrznie przelicza indeks i może wyemitować `pageIndex ≠ 0`; reguła „strona 1" jest w kontenerze (test 11.1.5). Regresja Material w przyszłości zostanie wychwycona testem kontenera, nie tabeli.
- **R5. Polska kolejność alfabetyczna** zależy od kolacji `pl-x-icu` po stronie bazy (plan API/wdrożenia) — UI niczego nie sortuje lokalnie; przy wariancie zastępczym kolejność znaków diakrytycznych może odbiegać od polskiego alfabetu (decyzja właściciela produktu, poza widokami).
- **R6. Test trasy gościa (`app.routes.ts`).** Import `app.routes.ts` w Vitest ładuje layouty i guardy (potencjalnie serwisy zależne od Supabase/`environment`). Jeśli import w jsdom jest zbyt ciężki lub niestabilny, dopuszczalny fallback: `vi.mock` modułów layoutów/guardów w tym jednym pliku; gdy nadal niestabilny — pominąć ten spec i oznaczyć pokrycie jako `NIE_WYKONANO` z weryfikacją manualną (gość → `/login?returnUrl=%2Fadmin%2Frecipes`), nie jako `PASS`.
- **R7. `admin.routes.spec.ts`** rozwiązuje `loadComponent` przez dynamiczny import komponentu z `templateUrl`/`styleUrl` — wymaga działającej transformacji `@analogjs/vite-plugin-angular` (jak w pozostałych specach komponentów); przy problemach asercję ograniczyć do obecności `loadComponent`.
- **R8. Dane osobowe.** E-mail autora jest widoczny w tabeli i w atrybucie `title` (drugiej linii); nie logować go (`console.*`), nie zapisywać w stanie poza sygnałami komponentu.
- **R9. Wydajność renderowania.** Do 100 wierszy × 9 kolumn z `OnPush` i `trackBy` — bez wirtualizacji; akceptowalne.
- **R10. Jednorazowa korekta a zmiana danych.** Gdy w trakcie korekty liczba przepisów znów się zmieni i druga odpowiedź nadal będzie pusta przy `totalItems > 0`, UI pokaże „Brak wyników na tej stronie." z paginatorem (admin może przejść dalej ręcznie) — świadomie bez dalszych korekt.
