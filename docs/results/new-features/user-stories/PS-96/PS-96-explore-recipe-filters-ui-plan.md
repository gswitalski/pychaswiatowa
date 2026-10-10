# PS-96: Filtry przepisów w katalogu Odkrywaj — Plan UI

> **User Story:** PS-96 — Filtry przepisów w katalogu Odkrywaj (`/explore`)
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass
> **Powiązane:** `PS-96-explore-recipe-filters-user-story.md`, `PS-96-explore-recipe-filters-api-plan.md`, `PS-96-explore-recipe-filters-deployment-plan.md`

---

## 1. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `ExploreRecipeFiltersComponent` (`pych-explore-recipe-filters`) | **Nowy** | `src/app/pages/explore/components/explore-recipe-filters/` |
| `ExploreFilterStateService` | **Nowy** | `src/app/pages/explore/services/explore-filter-state.service.ts` |
| `ExplorePageComponent` | **Modyfikacja** | `src/app/pages/explore/explore-page.component.ts` (integracja filtrów, URL sync, reset paginacji) |
| Typy `ExploreFilters`, `ExploreFilterDiet` | **Nowe** | `src/app/pages/explore/models/explore-filters.model.ts` |
| Testy jednostkowe | **Nowe** | `explore-recipe-filters.component.spec.ts`, `explore-filter-state.service.spec.ts` |

**Trasy i guardy — bez zmian:** `/explore` jest już publiczną trasą.
**Struktura katalogów:** nowy podkatalog `components/explore-recipe-filters/` w obrębie istniejącej strony `pages/explore/` — zgodne z regułami projektu.

**Poza zakresem PS-96:** filtry `cuisine` i `difficulty` w UI, filtry na landingu (`/`) lub `Moje przepisy` (`/my-recipies`), zmiana widoku kafelków.

---

## 2. Model danych UI

### `ExploreFilters` — interfejs stanu filtrów

```typescript
// src/app/pages/explore/models/explore-filters.model.ts

export type ExploreFilterDiet = 'vege_plus' | 'vegan' | null;

export interface ExploreFilters {
    termorobot: boolean;
    grill: boolean;
    diet: ExploreFilterDiet;
    favorite: boolean;       // tylko zalogowany; ignorowane gdy gość
    wantToTry: boolean;      // tylko zalogowany; ignorowane gdy gość
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

Parametr `q` (tekst wyszukiwania) jest zarządzany osobno przez istniejącą logikę `ExplorePageComponent` i **nie jest** częścią `ExploreFilters`.

---

## 3. Struktura komponentów

```
[NOWY]   ExploreFilterStateService        src/app/pages/explore/services/
         explore-filter-state.service.ts  — parsowanie URL ↔ filtrów, budowanie params API

[NOWY]   ExploreRecipeFiltersComponent    src/app/pages/explore/components/explore-recipe-filters/
             explore-recipe-filters.component.ts
             explore-recipe-filters.component.html
             explore-recipe-filters.component.scss
             explore-recipe-filters.component.spec.ts

[MODYFIKACJA] ExplorePageComponent        src/app/pages/explore/explore-page.component.ts
  └── integracja ExploreRecipeFiltersComponent
  └── sync filtrów z URL (ActivatedRoute + Router)
  └── reset paginacji przy zmianie filtrów
  └── przekazanie filtrów do ExploreRecipesService
```

---

## 4. Szczegóły komponentów

### 4.1 `ExploreRecipeFiltersComponent` (`pych-explore-recipe-filters`)

**Opis:** Pasek chipów filtrujących wyświetlany pod polem wyszukiwania na stronie `/explore`. Zawiera maksymalnie 5 chipów: dwie toggle-ikonki flag (tylko zalogowany), chip-group diety (3 warianty), dwa toggle-chipy (Termorobot, Grill).

**Kontrakt komponentu:**

```typescript
@Component({
    selector: 'pych-explore-recipe-filters',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    // MatChipsModule, MatIconModule, MatTooltipModule
})
export class ExploreRecipeFiltersComponent {
    /** Aktualny stan filtrów (źródło prawdy z rodzica / URL) */
    readonly filters = input.required<ExploreFilters>();
    /** Czy użytkownik jest zalogowany (warunkowe renderowanie flag) */
    readonly isAuthenticated = input<boolean>(false);
    /** Emituje nowy pełny stan po każdej zmianie chipa */
    readonly filtersChange = output<ExploreFilters>();
}
```

**Główne elementy HTML:**

```html
<div class="explore-filters">
    <!-- Flagi: widoczne tylko dla zalogowanych -->
    @if (isAuthenticated()) {
        <mat-chip-option
            [selected]="filters().favorite"
            (click)="toggle('favorite')"
            [matTooltip]="filters().favorite ? 'Wyczyść filtr ulubionych' : 'Tylko ulubione'"
        >
            <mat-icon matChipAvatar>favorite</mat-icon>
            Ulubione
        </mat-chip-option>

        <mat-chip-option
            [selected]="filters().wantToTry"
            (click)="toggle('wantToTry')"
            [matTooltip]="filters().wantToTry ? 'Wyczyść filtr' : 'Tylko chcę wypróbować'"
        >
            <mat-icon matChipAvatar>bookmark</mat-icon>
            Chcę wypróbować
        </mat-chip-option>
    }

    <!-- Chip-group Dieta: single-select (wzajemnie wykluczające się) -->
    <mat-chip-listbox [value]="filters().diet" (change)="onDietChange($event)">
        <mat-chip-option [value]="null">Wszystkie diety</mat-chip-option>
        <mat-chip-option value="vege_plus">Wegetariańskie+</mat-chip-option>
        <mat-chip-option value="vegan">Tylko wegańskie</mat-chip-option>
    </mat-chip-listbox>

    <!-- Toggle-chipy: Termorobot i Grill -->
    <mat-chip-option
        [selected]="filters().termorobot"
        (click)="toggle('termorobot')"
        matTooltip="Przepisy na Termomiks / Thermomix"
    >
        <mat-icon matChipAvatar>blender</mat-icon>
        Termorobot
    </mat-chip-option>

    <mat-chip-option
        [selected]="filters().grill"
        (click)="toggle('grill')"
        matTooltip="Przepisy na grilla"
    >
        <mat-icon matChipAvatar>outdoor_grill</mat-icon>
        Grill
    </mat-chip-option>
</div>
```

**Logika toggle:**

```typescript
protected toggle(field: 'termorobot' | 'grill' | 'favorite' | 'wantToTry'): void {
    this.filtersChange.emit({
        ...this.filters(),
        [field]: !this.filters()[field],
    });
}

protected onDietChange(event: MatChipListboxChange): void {
    this.filtersChange.emit({
        ...this.filters(),
        diet: event.value as ExploreFilterDiet,
    });
}
```

Komponent jest **bezstanowy** — nie przechowuje własnego stanu. Pełny nowy stan filtrów emituje przez `filtersChange` — rodzic (`ExplorePageComponent`) jest odpowiedzialny za aktualizację URL i załadowanie danych.

**Styl (`.explore-filters`):**

```scss
.explore-filters {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    padding: 8px 0;
    overflow-x: auto;            // poziomy scroll na mobile — rekomendacja
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;       // ukryj scrollbar (estetyka)

    &::-webkit-scrollbar {
        display: none;
    }

    // Zapobiegaj zawijaniu chipów
    mat-chip-option,
    mat-chip-listbox {
        flex-shrink: 0;
        white-space: nowrap;
    }
}
```

**Dostępność:**

- `mat-chip-option` z `[attr.aria-pressed]` automatycznie (Angular Material).
- `mat-chip-listbox` ma `role="listbox"` z `aria-label="Filtr diety"`.
- Nawigacja klawiaturą: Tab do paska, strzałki wewnątrz chip-group diety (Material CDK), Tab między grupami.
- Chipy flag mają tooltip zmieniający się ze stanem — taki sam wzorzec jak `RecipeFlagTogglesComponent` (PS-95).

---

### 4.2 `ExploreFilterStateService`

**Opis:** Serwis odpowiedzialny za dwukierunkowe mapowanie między `ExploreFilters` a query params URL oraz za budowanie obiektu params do wywołania API.

```typescript
// src/app/pages/explore/services/explore-filter-state.service.ts

@Injectable({ providedIn: 'root' })
export class ExploreFilterStateService {

    /** Parsuje query params z URL na ExploreFilters */
    fromQueryParams(params: Params): ExploreFilters {
        return {
            termorobot: params['termorobot'] === 'true',
            grill: params['grill'] === 'true',
            diet: this.parseDiet(params['diet']),
            favorite: params['favorite'] === 'true',
            wantToTry: params['want_to_try'] === 'true',
        };
    }

    /** Buduje query params URL z ExploreFilters */
    toQueryParams(filters: ExploreFilters): Params {
        const params: Params = {};
        if (filters.termorobot) params['termorobot'] = 'true';
        if (filters.grill) params['grill'] = 'true';
        if (filters.diet) params['diet'] = filters.diet;
        if (filters.favorite) params['favorite'] = 'true';
        if (filters.wantToTry) params['want_to_try'] = 'true';
        return params;
    }

    /** Buduje params do wywołania API (GET /public/recipes) */
    toApiParams(filters: ExploreFilters): Record<string, string> {
        const params: Record<string, string> = {};
        if (filters.termorobot) params['termorobot'] = 'true';
        if (filters.grill) params['grill'] = 'true';
        if (filters.diet) params['diet'] = filters.diet;
        if (filters.favorite) params['favorite'] = 'true';
        if (filters.wantToTry) params['want_to_try'] = 'true';
        return params;
    }

    /** Czy jakikolwiek filtr jest aktywny */
    hasActiveFilters(filters: ExploreFilters): boolean {
        return (
            filters.termorobot ||
            filters.grill ||
            filters.diet !== null ||
            filters.favorite ||
            filters.wantToTry
        );
    }

    /** Resetuje tylko filtry (nie `q`) */
    reset(): ExploreFilters {
        return { ...EXPLORE_FILTERS_DEFAULT };
    }

    private parseDiet(value: string | undefined): ExploreFilterDiet {
        if (value === 'vege_plus' || value === 'vegan') return value;
        return null;
    }
}
```

---

### 4.3 `ExplorePageComponent` — modyfikacje

**Integracja filtrów i synchronizacja z URL:**

```typescript
// src/app/pages/explore/explore-page.component.ts (fragmenty zmian)

export class ExplorePageComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly filterState = inject(ExploreFilterStateService);

    protected readonly filters = signal<ExploreFilters>(EXPLORE_FILTERS_DEFAULT);

    ngOnInit(): void {
        // Odczyt filtrów z URL przy inicjalizacji (sc. 14)
        this.route.queryParams.pipe(takeUntilDestroyed()).subscribe((params) => {
            this.filters.set(this.filterState.fromQueryParams(params));
            this.resetAndLoad();
        });
    }

    protected onFiltersChange(newFilters: ExploreFilters): void {
        // Aktualizacja URL → queryParams → ngOnInit reaguje (sc. 3, 5, 8)
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                ...this.filterState.toQueryParams(newFilters),
                q: this.currentQuery() || undefined,  // zachowaj pole q
            },
            queryParamsHandling: 'merge',
        });
    }

    protected clearFilters(): void {
        // Reset tylko chipów, q zostaje (rekomendacja #5)
        this.router.navigate([], {
            relativeTo: this.route,
            queryParams: {
                q: this.currentQuery() || undefined,
            },
        });
    }

    private resetAndLoad(): void {
        // Reset paginacji (sc. 15)
        this.currentPage.set(0);
        this.recipes.set([]);
        this.loadRecipes();
    }
}
```

**Szablon (fragment):**

```html
<!-- Pod polem wyszukiwania, nad listą przepisów -->
<pych-explore-recipe-filters
    [filters]="filters()"
    [isAuthenticated]="isAuthenticated()"
    (filtersChange)="onFiltersChange($event)"
/>

<!-- Empty state z przyciskiem czyszczenia filtrów (sc. 12) -->
@if (recipes().length === 0 && !loading()) {
    <div class="explore-empty-state">
        <p>Brak przepisów pasujących do wybranych filtrów.</p>
        @if (filterState.hasActiveFilters(filters())) {
            <button mat-button (click)="clearFilters()">
                <mat-icon>filter_alt_off</mat-icon>
                Wyczyść filtry
            </button>
        }
    </div>
}
```

**Przekazanie filtrów do serwisu:**

```typescript
private loadRecipes(): void {
    const apiParams = {
        ...this.filterState.toApiParams(this.filters()),
        q: this.currentQuery(),
        offset: this.currentPage() * PAGE_SIZE,
        limit: PAGE_SIZE,
    };
    this.exploreRecipesService.getRecipes(apiParams).subscribe(...);
}
```

---

## 5. Widok filtrów — ASCII (desktop, zalogowany)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  🔍  [ Szukaj przepisów...                                            ]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [♥ Ulubione] [🔖 Chcę wypróbować]  [Wszystkie diety ▾][Wegetariańskie+][Tylko wegańskie]  [🔧 Termorobot] [🔥 Grill]  │
├─────────────────────────────────────────────────────────────────────────┤
│  [ Kafelek ]  [ Kafelek ]  [ Kafelek ]  [ Kafelek ]                     │
│  ...                                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

**Widok mobilny (360 px):**

```
┌───────────────────────────┐
│ 🔍 [ Szukaj...          ] │
├───────────────────────────┤
│ → [♥] [🔖] [Wszystkie▾] [Wege+] [Vegan] [🔧] [🔥]  →  (scroll)
├───────────────────────────┤
│ [ Kafelek ]  [ Kafelek ]  │
└───────────────────────────┘
```

Pasek chipów scrolluje poziomo — gość widzi 3 chipy (Wszystkie diety, Wege+, Vegan, Termorobot, Grill), zalogowany widzi 2 dodatkowe (Ulubione, Chcę wypróbować) jako pierwsze.

---

## 6. Scenariusze i stany

| Sytuacja | Zachowanie UI |
|---|---|
| Gość | Chipy flag (`Ulubione`, `Chcę wypróbować`) nie są renderowane (sc. 1) |
| Zalogowany | Wszystkie 5 grup chipów widoczne (sc. 2) |
| Toggle Termorobot / Grill | Chip zmienia stan aktywny, URL aktualizuje się, lista się odświeża (sc. 3, 4) |
| Chip diety `Wegetariańskie+` | Chip aktywny, `diet=vege_plus` w URL, API dostaje `diet=vege_plus` (sc. 5) |
| Chip diety `Tylko wegańskie` | Chip aktywny, `diet=vegan` w URL (sc. 6) |
| Reset diety → `Wszystkie` | `diet` znika z URL, brak filtra diety (sc. 7) |
| Toggle `Ulubione` (zalogowany) | `favorite=true` w URL, API filtruje po flagach (sc. 8) |
| Toggle `Chcę wypróbować` (zalogowany) | `want_to_try=true` w URL (sc. 9) |
| Kombinacja filtrów | Oba params w URL, API AND (sc. 10) |
| Filtr + `q` | Oba w URL, wyniki spełniają oba kryteria (sc. 11) |
| Brak wyników | Empty state z przyciskiem „Wyczyść filtry" (sc. 12) |
| Deaktywacja chipa | Chip nieaktywny, param znika z URL (sc. 13) |
| Wejście z URL z filtrami | Chipy aktywne od razu, dane przefiltrowane (sc. 14) |
| Zmiana filtrów przy załadowanych stronach | Reset do strony 1, nowe dane (sc. 15) |

---

## 7. Historyjka użytkownika (szczegółowa)

**Jako** zalogowany użytkownik przeglądający katalog `/explore`,
**chcę** jednym kliknięciem chipa aktywować filtr „Tylko wegańskie" i „Termorobot",
**aby** zobaczyć wyłącznie przepisy wegańskie do przyrządzenia w Thermomixie, nie wpisując niczego w pole wyszukiwania.

**Kroki:**

1. Użytkownik otwiera `/explore` — widzi pasek chipów pod polem wyszukiwania. Wszystkie nieaktywne.
2. Klika chip „Tylko wegańskie" — chip jest aktywny, URL zmienia się na `?diet=vegan`, lista odświeża się i pokazuje tylko przepisy `VEGAN`.
3. Klika chip „Termorobot" — oba chipy aktywne, URL: `?diet=vegan&termorobot=true`, lista zawęża się do `VEGAN` i `is_termorobot=true`.
4. Klika chip „Termorobot" ponownie — chip nieaktywny, URL: `?diet=vegan`, lista powraca do wszystkich VEGAN.
5. Kopiuje URL do przeglądarki — po wejściu chip „Tylko wegańskie" jest od razu aktywny, dane przefiltrowane.
6. **Alternatywa — brak wyników:** empty state z przyciskiem „Wyczyść filtry"; kliknięcie usuwa `diet` z URL, `q` pozostaje.
7. **Alternatywa — gość:** pasek chipów widoczny, ale bez chipów „Ulubione" i „Chcę wypróbować".

---

## 8. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `ExploreRecipeFiltersComponent` | Gość (`isAuthenticated=false`): brak chipów flag w DOM (sc. 1) |
| `ExploreRecipeFiltersComponent` | Zalogowany: wszystkie chipy widoczne (sc. 2) |
| `ExploreRecipeFiltersComponent` | Klik Termorobot → `filtersChange.emit({ ...filters, termorobot: true })` |
| `ExploreRecipeFiltersComponent` | Klik aktywnego Termorobot → emit z `termorobot: false` (deaktywacja, sc. 13) |
| `ExploreRecipeFiltersComponent` | Klik `Wegetariańskie+` → emit z `diet: 'vege_plus'` (sc. 5) |
| `ExploreRecipeFiltersComponent` | Klik `Wszystkie diety` gdy aktywne → emit z `diet: null` (sc. 7) |
| `ExploreRecipeFiltersComponent` | Klik `Ulubione` → emit z `favorite: true` (sc. 8) |
| `ExploreRecipeFiltersComponent` | Klik `Chcę wypróbować` → emit z `wantToTry: true` (sc. 9) |
| `ExploreFilterStateService` | `fromQueryParams({ termorobot: 'true', diet: 'vege_plus' })` → poprawny `ExploreFilters` |
| `ExploreFilterStateService` | `toQueryParams({ termorobot: true, diet: 'vege_plus' })` → `{ termorobot: 'true', diet: 'vege_plus' }` |
| `ExploreFilterStateService` | `toQueryParams` z domyślnym stanem → pusty obiekt (brak parametrów) |
| `ExploreFilterStateService` | `hasActiveFilters` z domyślnym → `false`; z aktywnym filtrem → `true` |
| `ExploreFilterStateService` | Nieznana wartość `diet=xyz` → `diet: null` |
| `ExploreFilterStateService` | `toApiParams` buduje poprawne params dla API |
| `ExplorePageComponent` | Inicjalizacja z URL `?termorobot=true` → chip aktywny, `loadRecipes` z `termorobot=true` (sc. 14) |
| `ExplorePageComponent` | Zmiana filtrów → reset paginacji (offset=0, sc. 15) |
| `ExplorePageComponent` | `clearFilters()` → URL bez filtrów, `q` zachowane |
| `ExplorePageComponent` | Empty state widoczny gdy `recipes.length === 0` i `!loading()` |
| `ExplorePageComponent` | Przycisk „Wyczyść filtry" widoczny tylko gdy `hasActiveFilters = true` (sc. 12) |

**E2E (Playwright)** — zgodnie z DoD:

1. Gość wchodzi na `/explore` — brak chipów flag; chipy Termorobot/Grill/Dieta widoczne.
2. Gość klika `Termorobot` — URL `?termorobot=true`, lista przefiltrowana.
3. Zalogowany klika `Ulubione` — URL `?favorite=true`, lista zawiera tylko ulubione przepisy.
4. Kombinacja `Ulubione` + `Termorobot` — URL z oboma params, AND w wynikach.
5. Wpisanie frazy w `q` + aktywny `Grill` — URL `?q=tekst&grill=true`, wyniki spełniają oba kryteria.
6. Brak wyników po filtracji → empty state z „Wyczyść filtry"; klik → filtry usunięte, `q` zachowane.
7. Wejście na `/explore?diet=vege_plus` — chip `Wegetariańskie+` aktywny od razu.
8. Reset diety → chip `Wszystkie diety` aktywny, `diet` znika z URL.

---

## 9. Checklist implementacji (UI)

- [ ] `ExploreFilters`, `ExploreFilterDiet`, `EXPLORE_FILTERS_DEFAULT` — plik modelu
- [ ] `ExploreFilterStateService` (parsowanie URL ↔ filtrów, budowanie params API) + testy
- [ ] `ExploreRecipeFiltersComponent` (chipy, warunkowe renderowanie flag, emit) + testy
- [ ] Integracja w `ExplorePageComponent`: wyświetlenie komponentu filtrów, sync URL, reset paginacji, `clearFilters()`
- [ ] Empty state z przyciskiem „Wyczyść filtry" (tylko gdy `hasActiveFilters`)
- [ ] Styl `.explore-filters` (flex, `overflow-x: auto`, bez zawijania)
- [ ] Responsywność (poziomy scroll <960px): weryfikacja manualna
- [ ] Regresja: istniejące wyszukiwanie `q`, load more, `RecipeCardComponent`, badge „Mój przepis", wskaźnik serduszka (PS-95)
- [ ] Testy E2E (Playwright)
