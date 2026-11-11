# PS-204: Tabela przepisów publicznych w panelu administracyjnym — Plan UI

> **User Story:** PS-204 — `PS-204-admin-public-recipes-table-user-story.md`
> **Data:** 11 listopada 2026
> **Dotyczy:** Angular 21 + Angular Material (`src/app/pages/admin/`, `src/app/core/services/admin-api.service.ts`, `src/app/app.routes.ts`)
> **Powiązane:** `PS-204-admin-public-recipes-table-api-plan.md`, `PS-204-admin-public-recipes-table-deployment-plan.md`
> **Wzorzec:** lista użytkowników — `src/app/pages/admin/admin-users/` (strona kontenerowa + prezentacyjna tabela `mat-table` / `matSort` / `mat-paginator`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `/admin/recipes` — `AdminRecipesPageComponent` | **Nowy** | Strona kontenerowa: stan (sygnały), pobieranie, sortowanie, paginacja, rozmiar strony, auto-korekta strony poza zakresem, obsługa `401`/`403`/błędu |
| `AdminRecipesTableComponent` | **Nowy** | Komponent prezentacyjny: stany ładowania/błędu/pustej listy, tabela, nagłówki sortowalne, paginator 25/50/100 |
| `admin-recipes.models.ts` | **Nowy** | Modele widoku (VM wiersza, stan tabeli, zdarzenia sortowania/paginacji) |
| `AdminApiService.getRecipes(query)` | Modyfikacja | `GET admin/recipes` przez `supabase.functions.invoke` |
| `admin.routes.ts` | Modyfikacja | Dziecko `recipes` (lazy `loadComponent`) |
| `admin-navigation.config.ts` | Modyfikacja | Pozycja „Przepisy publiczne" |
| `app.routes.ts` | Modyfikacja | Przekierowanie gościa `admin/recipes` → `/login?returnUrl=%2Fadmin%2Frecipes` |
| Kontrakty `shared/contracts/types.ts` | Modyfikacja | Importowane z planu API (pkt 5) |

**Bez zmian:** dashboard (w tym kafelek „Moderacja treści (wkrótce)"), strona użytkowników, guardy (`usernameCompleteMatchGuard`, `adminRoleMatchGuard`), layout admina, widoki przepisów, RLS. Brak nowych zależności npm.

Wszystkie komponenty: `standalone: true`, `ChangeDetectionStrategy.OnPush`, sygnały (`signal` / `computed` / `input()` / `output()`), `inject()`, składnia `@if` / `@for`, selektory z prefiksem `pych`, kolory z `--mat-sys-*`, wcięcie 4 znaki. Frontend **nie** używa `supabase.from()` / `supabase.rpc()` — wyłącznie `AdminApiService` → Edge Function `admin`.

---

## 2. Routing i nawigacja

### 2.1 `admin.routes.ts`

```ts
{
    path: 'recipes',
    loadComponent: () =>
        import('./admin-recipes/admin-recipes-page.component').then(
            (m) => m.AdminRecipesPageComponent
        ),
},
```

Trasa `admin` jest już chroniona przez `canMatch: [usernameCompleteMatchGuard, adminRoleMatchGuard]` (`app.routes.ts`, trasa dla zalogowanych), więc `user` / `premium` nie wchodzą na `/admin/recipes`. Zachowanie `adminRoleMatchGuard` dla nie-admina (przekierowanie / `/forbidden`) jest dziedziczone i nie jest zmieniane.

### 2.2 `admin-navigation.config.ts`

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

Pozycja po „Użytkownicy". Sidebar jest widoczny wyłącznie w layoucie admina, więc `user`/`premium` jej nie widzą (scenariusz 12).

### 2.3 `app.routes.ts` — goście

W grupie tras publicznych (obok `admin/users`, ok. linii 391) dodać:

```ts
{
    path: 'admin/recipes',
    redirectTo: () => '/login?returnUrl=%2Fadmin%2Frecipes',
    pathMatch: 'full',
},
```

(`returnUrl=%2Fadmin%2Frecipes` zgodnie ze scenariuszem 12.)

---

## 3. Serwis — `AdminApiService.getRecipes`

```ts
getRecipes(query: GetAdminRecipesQueryDto): Observable<GetAdminRecipesResponseDto>
```

- Budowa `URLSearchParams` jak w `getUsers` (`page`, `page_size`, `sort_by`, `sort_dir` — tylko pola zdefiniowane); endpoint `admin/recipes?...` albo `admin/recipes` bez parametrów.
- `supabase.functions.invoke<GetAdminRecipesResponseDto>(endpoint, { method: 'GET' })`.
- Błąd `response.error` → `Error` z komunikatem i `status` z `extractStatusFromError(...) ?? 500` (jak pozostałe metody); brak `response.data` → `Error('Nie udało się pobrać listy przepisów publicznych')`.
- Brak własnej walidacji/normalizacji parametrów po stronie klienta (UI wysyła wyłącznie poprawne wartości: `page ≥ 1`, `page_size ∈ {25,50,100}`, `sort_by` z allowlisty).

---

## 4. Modele widoku — `admin-recipes.models.ts`

```ts
export interface AdminRecipesTableRowVm {
    readonly id: number;
    readonly name: string;
    readonly authorPrimaryLabel: string;        // nazwa | „Brak nazwy użytkownika" | skrócone ID autora
    readonly authorSecondaryLabel: string | null; // e-mail lub null (brak e-maila → pusta druga linia)
    readonly authorId: string;                  // pełne ID (atrybut title)
    readonly categoryLabel: string;             // nazwa | „—"
    readonly createdAtLabel: string;            // toLocaleString('pl-PL', { dateStyle: 'medium', timeStyle: 'short' }) | „Brak daty"
    readonly averageRatingLabel: string;        // „4,5" | „—"
    readonly ratingsCount: number;              // liczba całkowita ≥ 0
    readonly isGrill: boolean;
    readonly isTermorobot: boolean;
    readonly recipeUrl: string;                 // `/explore/recipes/${id}`
    readonly openAriaLabel: string;             // `Otwórz przepis ${name} w nowej karcie`
}
export interface AdminRecipesTableStateVm { isInitialLoading; isRefreshing; isEmpty; hasError; errorMessage; hasNoRowsOnPage }
export interface AdminRecipesSortChangeEvent { sort_by: AdminRecipesSortBy; sort_dir: SortDirection }
export interface AdminRecipesPageChangeEvent { page: number; page_size: number }
export type AdminRecipesPaginationVm = GetAdminRecipesResponseDto['pagination'];
export type AdminRecipesSortingVm = GetAdminRecipesResponseDto['sorting'];
```

### 4.1 Reguły mapowania wiersza (strona kontenerowa)

| Pole | Reguła |
|---|---|
| Autor — linia 1 | `author_username?.trim()` niepusta → nazwa; w przeciwnym razie, gdy `author_email?.trim()` niepusty → `Brak nazwy użytkownika`; gdy oba puste → skrócone ID autora (`buildDisplayId`: 8 znaków + `...` + 4 ostatnie, jeśli długość > 12; ten sam algorytm co lista użytkowników — wydzielić do małej funkcji w `admin-recipes.models.ts` lub wspólnego pliku bez zmiany zachowania listy użytkowników) |
| Autor — linia 2 | `author_email?.trim()` niepusty → e-mail; w przeciwnym razie `null` (linia nieobecna, **bez tekstu zastępczego**). Wynik dla scenariusza 9: (a) brak nazwy + e-mail → linia 1 „Brak nazwy użytkownika", linia 2 e-mail; (b) nazwa + brak e-maila → linia 1 nazwa, linia 2 pusta; (c) oba puste → linia 1 skrócone ID, linia 2 pusta |
| Kategoria | `category_name?.trim() || '—'` |
| Data | `formatDateLabel(created_at, 'Brak daty')` — taka sama implementacja jak `AdminUsersPageComponent.formatDateLabel` (nieprawidłowa data → `Brak daty`, bez wyjątku) |
| Średnia ocena | `Number.isFinite(value)` → `new Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)` (`4,0`, `4,5`); `null`/`undefined`/`NaN` → `—` (nigdy `0` ani `NaN`) |
| Liczba ocen | `Number.isFinite(count) ? count : 0` |
| Znaczniki | `is_grill === true`, `is_termorobot === true` |
| Link | `recipeUrl = '/explore/recipes/' + id`; ścieżka bez sluga jest obsługiwana przez trasę legacy `exploreRecipeIdOnlyMatcher` (normalizacja do formatu kanonicznego) |

Wszystkie wartości tekstowe wyświetlane **wyłącznie przez interpolację `{{ }}`** (Angular escapuje HTML — przypadek brzegowy 7); zakaz `[innerHTML]`.

---

## 5. Strona kontenerowa — `AdminRecipesPageComponent`

Pliki: `src/app/pages/admin/admin-recipes/admin-recipes-page.component.{ts,html,scss}`, selektor `pych-admin-recipes-page`.

- Tytuł: **„Przepisy publiczne"**; podtytuł: „Przegląd przepisów publicznych w aplikacji. Przepisy prywatne i udostępnione linkiem nie są tutaj pokazywane." (scenariusz 1).
- Nagłówek: ponowne użycie `AdminUsersPageHeaderComponent` (czysto prezentacyjny: `title` + `description`) — bez zmian w tym komponencie; ewentualne przeniesienie do wspólnego katalogu to osobny refaktor.
- `displayedColumns`: `['id','name','author','category','createdAt','averageRating','ratingsCount','flags','actions']`.

### 5.1 Stan (sygnały)

| Sygnał | Wartość początkowa |
|---|---|
| `query: Required<GetAdminRecipesQueryDto>` | `{ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' }` |
| `rows: AdminRecipesTableRowVm[]` | `[]` |
| `pagination` | `{ currentPage: 1, pageSize: 25, totalPages: 0, totalItems: 0 }` |
| `sorting` | `{ sort_by: 'created_at', sort_dir: 'desc' }` |
| `isInitialLoading` | `true` |
| `isRefreshing` | `false` |
| `errorMessage` | `null` |

Brak trwałości stanu (założenie 7): stan żyje tylko w sygnałach komponentu — **nie** w query params, `localStorage` ani `sessionStorage`; po F5 komponent startuje z wartości początkowych (25 / `created_at desc` / strona 1).

Pochodne (`computed`):

- `isEmpty = !isInitialLoading && !isRefreshing && !errorMessage && rows().length === 0 && pagination().totalItems === 0` — komunikat pustej listy **wyłącznie** przy `totalItems = 0` (scenariusz 11c).
- `hasNoRowsOnPage = !isInitialLoading && !isRefreshing && !errorMessage && rows().length === 0 && pagination().totalItems > 0` — przypadek po wyczerpaniu jednokrotnej korekty (pkt 5.3): pokazujemy tabelę-szkielet/komunikat „Brak wyników na tej stronie" **z paginatorem**, nie komunikat pustej listy.
- `tableState` — obiekt `AdminRecipesTableStateVm`.

### 5.2 Operacje

| Metoda | Zachowanie |
|---|---|
| `ngOnInit` | `loadRecipes(query())` |
| `onRetry` | `loadRecipes(query())` (z bieżącymi parametrami; pozwala ponownie uruchomić korektę strony) |
| `onSortChange(event)` | `nextQuery = { ...query, sort_by, sort_dir, page: 1 }`; gdy sortowanie i strona identyczne jak bieżące → nic; inaczej `query.set` + `loadRecipes` (rozmiar strony zachowany) |
| `onPageChange(event)` | `sizeChanged = event.page_size !== query().page_size`; `nextPage = sizeChanged ? 1 : Math.max(1, event.page)`; `nextQuery = { ...query, page: nextPage, page_size: event.page_size }` (**sortowanie zachowane**); gdy `page` i `page_size` bez zmian → nic; przy `sizeChanged` dodatkowo `pagination.update(p => ({ ...p, currentPage: 1, pageSize: event.page_size }))`, aby `mat-paginator` (który sam przelicza indeks strony przy zmianie rozmiaru) nie pokazywał stanu pośredniego; następnie `query.set` + `loadRecipes` |
| `loadRecipes(query, { isCorrection })` | patrz 5.3 |

### 5.3 Pobieranie, wyścigi i auto-korekta strony poza zakresem

```text
loadRecipes(query, isCorrection = false):
    requestId = ++latestRequestId
    errorMessage = null
    hasExistingRows = rows().length > 0
    isRefreshing = hasExistingRows ; isInitialLoading = !hasExistingRows
    adminApi.getRecipes(query).subscribe:
        next(response):
            jeśli requestId !== latestRequestId → return          // spóźniona odpowiedź (przypadek 13)
            jeśli !isCorrection oraz response.data.length === 0
               oraz response.pagination.totalItems > 0
               oraz response.pagination.currentPage > response.pagination.totalPages:
                    // JEDNOKROTNA korekta: stan ładowania zostaje, wyniku (pustego) nie stosujemy
                    loadRecipes({ ...query, page: response.pagination.totalPages }, true)
                    return
            rows.set(map(response.data)); pagination.set(response.pagination); sorting.set(response.sorting)
            query.set({ page: pagination.currentPage, page_size: pagination.pageSize,
                        sort_by: sorting.sort_by, sort_dir: sorting.sort_dir })
            errorMessage = null ; isInitialLoading = false ; isRefreshing = false
        error(err):
            jeśli requestId !== latestRequestId → return
            isInitialLoading = false ; isRefreshing = false
            401 → router.navigate(['/login'], { queryParams: { returnUrl: '/admin/recipes' } })
            403 → router.navigate(['/forbidden'])
            inaczej → errorMessage = 'Nie udało się pobrać listy przepisów publicznych. Odśwież widok lub spróbuj ponownie.'
```

Zasady:

- **Jednokrotność, bez pętli:** wywołanie korekty ma `isCorrection = true`, więc jego odpowiedź nigdy nie uruchamia kolejnej korekty (nawet gdy znów pusta). Każde nowe działanie użytkownika (sortowanie, strona, rozmiar, „Spróbuj ponownie") wywołuje `loadRecipes` z `isCorrection = false`.
- **Zachowanie parametrów:** żądanie korygujące kopiuje `sort_by`, `sort_dir`, `page_size` z bieżącego zapytania i podmienia tylko `page = totalPages` (scenariusz 11d).
- **Brak mignięcia komunikatu pustej listy:** pustej odpowiedzi nie zapisujemy w `rows`/`pagination` przed korektą; `isRefreshing`/`isInitialLoading` pozostają włączone, a poprzednie dane (jeśli były) zostają widoczne z `opacity: 0.5`.
- **Ostatnia strona:** `totalPages` z odpowiedzi pierwszego (pustego) żądania; jeśli w międzyczasie liczba przepisów spadnie do 0, żądanie korygujące zwróci `totalItems = 0` → stan `isEmpty` (komunikat pustej listy — poprawnie).
- **Wyścigi (scenariusz 4 / przypadek 13):** `latestRequestId` — odpowiedź starszego żądania jest ignorowana; w szczególności nowa akcja użytkownika podczas korekty unieważnia korektę.
- **Aktualizacja stanu bez „białego błysku":** dane zastępowane po załadowaniu (`rows.set` na nowej tablicy po komplecie danych), poprzednia zawartość widoczna w trakcie (reguła `frontend.mdc`: `opacity: 0.5`, bez białego overlayu i pseudo-elementów `::after` z białym tłem).

---

## 6. Tabela — `AdminRecipesTableComponent`

Pliki: `admin-recipes-table.component.{ts,html,scss}`, selektor `pych-admin-recipes-table`. Importy Material: `MatTableModule`, `MatSortModule`, `MatPaginatorModule`, `MatButtonModule`, `MatIconModule`, `MatProgressSpinnerModule`, `MatTooltipModule` (opcjonalnie, dla pełnych treści).

### 6.1 Wejścia i wyjścia

`input.required`: `rows`, `state`, `pagination`, `sorting`, `displayedColumns`; `output`: `sortChange`, `pageChange`, `retry`.

### 6.2 Szablon — gałęzie stanu

```text
@if (state().isInitialLoading)                    → spinner + „Ładowanie listy przepisów publicznych..."
@else if (state().hasError && !hasRows())         → komunikat błędu + [Spróbuj ponownie]
@else if (state().isEmpty)                        → „Brak przepisów publicznych do wyświetlenia." (bez tabeli)
@else                                             → [inline błąd + „Spróbuj ponownie" gdy hasError && hasRows]
                                                     tabela (gdy hasRows) | „Brak wyników na tej stronie." (gdy state().hasNoRowsOnPage)
                                                     mat-paginator
```

Kontener ma klasę `admin-recipes-table--refreshing` (`opacity: 0.5`) gdy `state().isRefreshing`; spinner/komunikat nie nakłada białego overlayu.

### 6.3 Kolumny

| `matColumnDef` | Nagłówek | Sortowanie (`sort_by`) | Komórka |
|---|---|---|---|
| `id` | ID | — (bez `mat-sort-header`) | pełne ID, bez skracania |
| `name` | Nazwa | `name` | nazwa; `overflow-wrap: anywhere`, `max-width`, `[attr.title]` z pełną nazwą (przypadek 8) |
| `author` | Autor | `author` | linia 1 (`authorPrimaryLabel`), linia 2 (`authorSecondaryLabel`, jeśli niepusta) w drugim `<span>`, `[attr.title]` z `authorId`; długi e-mail zawijany |
| `category` | Kategoria | `category` | `categoryLabel` |
| `createdAt` | Data utworzenia | `created_at` | `createdAtLabel` |
| `averageRating` | Średnia ocena | `average_rating` | `averageRatingLabel`, wyrównanie do prawej |
| `ratingsCount` | Liczba ocen | `ratings_count` | liczba, wyrównanie do prawej |
| `flags` | Znaczniki | — | tekstowe etykiety „Grill" i/lub „Termorobot" (widoczny tekst = dostępna etykieta dla czytnika; ikona dekoracyjna `aria-hidden`); brak znaczników → pusta komórka (przypadek 11) |
| `actions` | Akcja | — | link „Otwórz przepis" (pkt 6.5) |

Kolumn „Widoczność" i „Data modyfikacji" **nie ma**.

### 6.4 Sortowanie (`matSort`)

- `matSort`, `matSortDisableClear`, `[matSortActive]="activeSortColumn()"`, `[matSortDirection]="sorting().sort_dir"` — wskaźnik (strzałka) i `aria-sort` generuje `MatSort` na aktywnej kolumnie według bieżącego `sorting()` (odpowiedź API = źródło prawdy).
- Mapy `COLUMN_TO_SORT_BY` / `SORT_BY_TO_COLUMN` dla sześciu kolumn: `name→name`, `author→author`, `category→category`, `createdAt→created_at`, `averageRating→average_rating`, `ratingsCount→ratings_count`.
- Pierwsze kliknięcie nowej kolumny → `asc` (domyślny start `MatSort`), drugie → `desc`; kliknięcie aktywnej kolumny odwraca kierunek. `onMatSortChange` emituje `sortChange` (strona resetowana w kontenerze).
- Sortowanie wykonuje wyłącznie serwer; `mat-table` nie sortuje lokalnie (`dataSource` to zwykła tablica, `matSortChange` nie jest podpinany do `MatTableDataSource`).

### 6.5 Link „Otwórz przepis"

```html
<a mat-stroked-button
   [attr.href]="row.recipeUrl"
   target="_blank"
   rel="noopener"
   [attr.aria-label]="row.openAriaLabel">Otwórz przepis</a>
```

- Zwykły `href` (a nie `routerLink`), bo otwiera **nową kartę**; `/explore/recipes/{id}` jest obsługiwane przez trasę legacy z normalizacją do adresu z slugiem.
- Karta panelu admina nie zmienia stanu (brak nawigacji w bieżącej karcie).
- Etykieta czytnika zawiera nazwę przepisu (`Otwórz przepis Szarlotka w nowej karcie`).

### 6.6 Paginator i selektor rozmiaru strony

```html
<mat-paginator
    [length]="pagination().totalItems"
    [pageSize]="pagination().pageSize"
    [pageIndex]="paginatorPageIndex()"
    [pageSizeOptions]="[25, 50, 100]"
    [hidePageSize]="false"
    showFirstLastButtons
    (page)="onMatPageChange($event)"
    aria-label="Paginacja listy przepisów publicznych">
</mat-paginator>
```

- `paginatorPageIndex = max(pagination().currentPage - 1, 0)`; `onMatPageChange` emituje `{ page: pageIndex + 1, page_size: pageSize }`; to **kontener** decyduje o wymuszeniu `page = 1` przy zmianie rozmiaru (pkt 5.2) — dzięki temu reguła jest testowana w jednym miejscu.
- Opcje rozmiaru stałe: 25 / 50 / 100 (UI nigdy nie wyśle innej wartości, więc API nie zwróci `400` z tego powodu).
- Paginator jest widoczny również dla `hasNoRowsOnPage` (aby admin mógł nawigować); nie jest renderowany dla `isEmpty`.

### 6.7 Style (`admin-recipes-table.component.scss`)

- Kontener jak `admin-users-table` (obramowanie `--mat-sys-outline-variant`, `--mat-sys-surface`), ale **`opacity: 0.5`** w stanie odświeżania.
- `__scroll { overflow-x: auto; }`, `table { min-width: ~1320px; width: 100%; }` — na szerokościach < 600 px zachowane są wszystkie kolumny, przewijanie **poziome** (scenariusz 13), bez trybu kart i bez ucinania (długie nazwy zawijane, nie rozpychają poza przewijany obszar).
- Znaczniki: małe „pigułki" w kolorach z `--mat-sys-*` (bez twardych kolorów hex jak w roli użytkownika).
- Widoczny fokus (domyślne style Material dla nagłówków sortowania, linku i paginatora; nie ukrywać `outline`).
- Stany błędu: `color: var(--mat-sys-error)`.

---

## 7. Dostępność (WCAG 2.1 AA)

- `aria-sort` na nagłówkach sortowalnych (generowane przez `MatSort`) — weryfikowane testem; nagłówki ID / Znaczniki / Akcja bez `mat-sort-header`.
- Link „Otwórz przepis" z `aria-label` zawierającym nazwę przepisu i informację o nowej karcie.
- Znaczniki z widocznym tekstem; ikony dekoracyjne `aria-hidden="true"`.
- Paginator z `aria-label`, obsługa klawiaturą z Material; tabela `mat-table` z semantyką `table`.
- Stan ładowania komunikowany tekstem („Ładowanie listy przepisów publicznych..."), błąd tekstem z przyciskiem „Spróbuj ponownie".

---

## 8. Testy jednostkowe Vitest — plan

Konwencje: `import 'zone.js'`/`'zone.js/testing'`, `NoopAnimationsModule`, mocki `vi.fn()`, `firstValueFrom` dla serwisu, natywne asercje Vitest (zgodnie z `vitest.mdc`). **Bez E2E.**

### 8.1 `admin-recipes-page.component.spec.ts`

1. Start: `getRecipes` wywołane raz z `{ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' }`; tytuł „Przepisy publiczne" i podtytuł o przepisach prywatnych/udostępnionych linkiem.
2. Sortowanie: zmiana na `name asc` → żądanie z `page: 1` zachowując `page_size`; ponowne to samo sortowanie na stronie 1 → brak żądania.
3. Sortowanie z poziomu strony 3 → `page: 1`, `page_size` zachowany.
4. Zmiana strony zachowuje `sort_by`/`sort_dir`/`page_size`.
5. **Zmiana rozmiaru strony** (25 → 50 ze strony 3): żądanie `page: 1`, `page_size: 50`, **to samo sortowanie**; `pagination.currentPage` natychmiast 1.
6. **Auto-korekta strony poza zakresem:** pierwsza odpowiedź `data: []`, `currentPage: 9`, `totalPages: 3`, `totalItems: 61` → drugie żądanie z `page: 3` i niezmienionym sortowaniem/rozmiarem; stan końcowy: wiersze z drugiej odpowiedzi, brak komunikatu pustej listy; **dokładnie dwa** wywołania `getRecipes`.
7. **Brak pętli:** druga odpowiedź także `data: []` przy `totalItems: 61` → brak trzeciego żądania; `isEmpty` = `false`, `hasNoRowsOnPage` = `true`.
8. Korekta, gdy w międzyczasie `totalItems = 0` → `isEmpty` = `true` (komunikat pustej listy).
9. `isEmpty` tylko przy `totalItems = 0` (odpowiedź `data: []`, `totalItems: 0` → pusta lista bez korekty, jedno żądanie).
10. Wyścig: dwie szybkie zmiany sortowania, odpowiedź pierwszego przychodzi po drugim → stan zgodny z drugim (spóźniona ignorowana); nowa akcja w trakcie korekty unieważnia korektę.
11. `401` → `router.navigate(['/login'], { queryParams: { returnUrl: '/admin/recipes' } })`; `403` → `router.navigate(['/forbidden'])`; `500` → komunikat błędu i „Spróbuj ponownie" ponawia `getRecipes` z bieżącymi parametrami; błąd przy istniejących wierszach → wiersze zostają (inline error).
12. Mapowanie wiersza: autor (a) brak nazwy + e-mail → „Brak nazwy użytkownika" / e-mail; (b) nazwa + brak e-maila → nazwa / `null`; (c) oba puste → skrócone ID (`1a2b3c4d...ef01`) / `null`; kategoria `null` → `—`; średnia `4` → `4,0`, `4.5` → `4,5`, `null` → `—`, `NaN` → `—`; liczba ocen `0`; data poprawna w formacie `pl-PL`, niepoprawna → `Brak daty`; znaczniki; `recipeUrl`; `openAriaLabel`.
13. Brak trwałości: świeża instancja komponentu zawsze startuje z wartości domyślnych (nie czyta `localStorage`/URL).

### 8.2 `admin-recipes-table.component.spec.ts`

1. Nagłówki: dokładnie ID, Nazwa, Autor, Kategoria, Data utworzenia, Średnia ocena, Liczba ocen, Znaczniki, Akcja; brak „Widoczność" i „Data modyfikacji".
2. Sześć nagłówków z `mat-sort-header`; ID, Znaczniki, Akcja bez sortowania.
3. `aria-sort` na aktywnej kolumnie odpowiada `sorting()` (`created_at desc` → `descending`); po zmianie wejścia `sorting` strzałka/`aria-sort` się aktualizuje.
4. Kliknięcie nagłówka „Nazwa" emituje `{ sort_by: 'name', sort_dir: 'asc' }`, ponowne `desc`; po jednym teście na mapowanie każdej z sześciu kolumn (`author`, `category`, `created_at`, `average_rating`, `ratings_count`).
5. Komórki: ID w całości (`42`), autor w dwóch liniach / jednej linii, `—`, `0`, znaczniki (grill / termorobot / oba / żaden z etykietą tekstową), pole link.
6. Link: `target="_blank"`, `rel="noopener"`, `href="/explore/recipes/42"`, `aria-label` z nazwą przepisu.
7. Escapowanie HTML: nazwa `<b>x</b>` i `&amp;` wyrenderowana jako tekst (brak elementu `<b>` w DOM).
8. Paginator: opcje 25 / 50 / 100 dostępne (`hidePageSize = false`), `pageSize` z wejścia, emisja `pageChange` ze zmiany strony i zmiany rozmiaru (`{ page, page_size }`).
9. Stany: `isInitialLoading` → spinner i tekst ładowania; `hasError && !rows` → komunikat + „Spróbuj ponownie" emituje `retry`; `isEmpty` → komunikat pustej listy, brak tabeli i paginatora; `hasNoRowsOnPage` → brak komunikatu pustej listy, paginator widoczny; `isRefreshing` → klasa `--refreshing` i wiersze nadal widoczne; błąd z wierszami → inline error + wiersze.

### 8.3 `admin-api.service.spec.ts` (rozszerzenie istniejącego pliku)

- `getRecipes({ page: 1, page_size: 25, sort_by: 'created_at', sort_dir: 'desc' })` → `functions.invoke('admin/recipes?page=1&page_size=25&sort_by=created_at&sort_dir=desc', { method: 'GET' })` i zwraca `data` bez modyfikacji.
- `getRecipes({})` → `'admin/recipes'`; pojedyncze parametry pomijają niezdefiniowane.
- `response.error` z `context.status = 403` → `Error` z `status === 403`; bez statusu → `500`; brak `data` → `Error('Nie udało się pobrać listy przepisów publicznych')`.

### 8.4 Nawigacja i routing

- `admin-navigation.config.spec.ts` (nowy lub rozszerzenie): `ADMIN_NAV_ITEMS` zawiera pozycję „Przepisy publiczne" (`route: '/admin/recipes'`, `matchMode: 'exact'`, `matchingRoutes: ['/admin/recipes']`); istniejące pozycje bez zmian (Dashboard, Użytkownicy — brak regresji).
- `admin.routes.spec.ts` (nowy): dziecko `recipes` istnieje z `loadComponent` rozwiązującym `AdminRecipesPageComponent`; istniejące `dashboard` i `users` bez zmian.
- `app.routes.admin-recipes.spec.ts` (nowy, lekki): trasa gościa `admin/recipes` ma `redirectTo` zwracające `/login?returnUrl=%2Fadmin%2Frecipes`.

---

## 9. Weryfikacja manualna (lokalnie — konto admina z `.env.local`, bez sekretów w dokumentach)

Sześć sortowań (oba kierunki) z kontrolą: bez ocen na końcu tylko dla „Średniej oceny", `0` ocen na początku dla „Liczby ocen" rosnąco, autor bez nazwy na końcu, pusta kategoria na końcu, polskie znaki; zmiana rozmiaru 25/50/100 z zachowaniem sortowania; ręczne wywołanie strony poza zakresem (usunięcie przepisów w trakcie lub ręczne ustawienie strony przez mockowaną odpowiedź w DevTools) i kontrola jednokrotnej korekty; link w nowej karcie; szerokość < 600 px (przewijanie poziome); konto `user` bez dostępu (brak pozycji w sidebarze, `/admin/recipes` → blokada guarda; `GET /admin/recipes` → `403`); gość → `/login?returnUrl=%2Fadmin%2Frecipes`; F5 → stan domyślny. Statusy zapisać jawnie (`PASS` / `FAIL` / `NIE_WYKONANO`).

---

## 10. Macierz spójności: scenariusz GWT → API → UI → test jednostkowy

| Scen. | Wymaganie | API (plan API) | UI (ten plan) | Test jednostkowy |
|---|---|---|---|---|
| 1 | Wejście z menu; tytuł, podtytuł, 9 kolumn; domyślnie `created_at desc`, do 25 | pkt 2 (domyślne parametry), 4.4 | 2.1, 2.2, 5 (tytuł/podtytuł), 6.3, 5.1 (stan początkowy) | Vitest 8.1.1, 8.2.1; 8.4 (nawigacja, trasa) |
| 2 | Tylko `PUBLIC` + `deleted_at IS NULL`; lista bywa nieaktualna | pkt 4.3 (filtr w bazie), pkt 2.1 (brak parametru zakresu) | brak własnej logiki zakresu; odświeżenie = ponowne pobranie (5.2 `onRetry`) | deno: brak parametrów zakresu w RPC (8 API); DB: przepisy PRIVATE/SHARED/usunięte nieobecne |
| 3 | Zawartość wiersza (ID, autor+e-mail, kategoria, data, `4,5`/`12`, Grill) | pkt 2.2, 6.1 | 4.1, 6.3 | Vitest 8.1.12, 8.2.5; deno: mapowanie wiersza |
| 4 | Sortowanie server-side, `aria-sort`, strona 1, tie-breaker ID | pkt 3, 4.4 (`id asc`) | 5.2 `onSortChange`, 6.4 | Vitest 8.1.2–3, 8.2.2–4; deno: walidacja `sort_by`/`sort_dir`; DB: stabilność remisu |
| 5 | (a) Średnia: bez ocen na końcu; (b) Liczba ocen jak liczba | pkt 4.4 (`average_rating`, `ratings_count`) | 6.3 (kolumny sortowalne) | deno/DB (opcjonalny test RPC lub weryfikacja manualna); Vitest 8.2.4 (mapowanie `average_rating`, `ratings_count`) |
| 6 | Pusta kategoria na końcu; polska kolejność | pkt 4.1, 4.4 (`category`) | 6.3 | DB (test RPC / manualnie); Vitest 8.2.4 (`category`) |
| 6a | Autor: nazwa wg polskiej kolejności, bez nazwy na końcu | pkt 4.4 (`author`) | 6.3 (`author`) | DB (test RPC / manualnie); Vitest 8.2.4 (`author`) |
| 7 | Paginacja; selektor 25/50/100; rozmiar → strona 1 zachowując sortowanie; F5 → domyślne | pkt 2.1 (`page_size` 1..100), 2.2 | 5.2 `onPageChange`, 5.1 (brak trwałości), 6.6 | Vitest 8.1.4–5, 8.1.13, 8.2.8; deno: `page_size` 1/25/50/100/101 |
| 8 | Brak ocen i kategorii: `—`, `0`, `—` | pkt 2.2 (`null` / `0`), 6.1 | 4.1 | Vitest 8.1.12, 8.2.5; deno: `average_rating null → null`, nie `0` |
| 9 | Autor bez nazwy / e-maila (a, b, c) | pkt 2.2 (`author_username`/`author_email` = `null`, `author_id`) | 4.1 | Vitest 8.1.12; deno: mapowanie `null` autora |
| 10 | Link w nowej karcie, `rel="noopener"`, etykieta, brak zmiany karty admina | — (brak API) | 6.5 | Vitest 8.2.6 |
| 11 | (a) ładowanie, (b) błąd + ponów, (c) pusta lista tylko `totalItems = 0`, (d) auto-korekta strony | pkt 2.2 (strona poza zakresem: poprawne `totalItems`/`totalPages`, wartownik), 4.3 | 5.1, 5.3, 6.2 | Vitest 8.1.6–11, 8.2.9; deno: strona poza zakresem, `500` → `INTERNAL_ERROR` |
| 12 | Role i goście: `403` / `401` / guard / przekierowanie | pkt 2 (`requireAdminContext`, `401`/`403`) | 2.1, 2.2, 2.3, 5.3 (`401` → login, `403` → `/forbidden`) | deno: autoryzacja; Vitest 8.1.11, 8.4 (trasa gościa, nawigacja) |
| 13 | Mobile < 600 px: poziome przewijanie, wszystkie kolumny | — | 6.7 | Weryfikacja manualna (jsdom nie weryfikuje layoutu); Vitest: komponent renderuje kontener przewijania |
| 14 | Brak regresji (dashboard, użytkownicy, RLS) | pkt 1 („Bez zmian"); brak zmian RLS i widoków | pkt 1 („Bez zmian"), 8.4 | `npm run test` (cały zestaw), istniejące specyfikacje użytkowników bez zmian; weryfikacja manualna |

Przypadki brzegowe → pokrycie: 1–2 (walidacja `400`) → deno (walidacja); 3 → deno + Vitest 8.1.6–7; 4–5 → manualnie (zachowanie widoku przepisu); 6 → DB/deno; 7 → Vitest 8.2.7; 8 → styl 6.3/6.7 + manualnie; 9 → Vitest 8.1.12 + `left join` w API; 10 → Vitest 8.1.12; 11 → Vitest 8.2.5; 12 → Vitest 8.1.12; 13 → Vitest 8.1.10; 14 → plan API pkt 7; 15 → Vitest 8.1.13 + manualnie; 16 → DB (test RPC / manualnie).

---

## 11. Uwagi dla implementera

1. **Wymuszenie strony 1 przy zmianie rozmiaru** realizuje kontener, nie `mat-paginator` (który zachowuje „pierwszy widoczny element" i może wysłać `pageIndex ≠ 0`).
2. **Wartość `pagination.currentPage` z API** to strona **żądana**; korekta w UI opiera się na porównaniu z `totalPages`, a nie na kodzie błędu.
3. `AdminUsersPageHeaderComponent` jest reużywany bez zmian; nie modyfikować komponentów listy użytkowników (brak regresji).
4. Doprecyzowanie względem historyjki (nie sprzeczność): komunikat o braku dostępu przy `403` realizowany jest tak jak w liście użytkowników — przekierowaniem na stronę `/forbidden` z komunikatem; ścieżka wyniku `hasNoRowsOnPage` (pkt 5.1) pokrywa skrajny przypadek, w którym po jednokrotnej korekcie strona nadal jest pusta przy `totalItems > 0`.
