# Plan implementacji widoków: Flaga „Grill” (`is_grill`)

## 1. Przegląd
Celem zmian jest dodanie do aplikacji klasyfikacyjnej flagi **„Grill”** (`is_grill: boolean`) w następujących miejscach UI:

- **Formularz przepisu** (`/recipes/new`, `/recipes/:id/edit`): możliwość włączenia/wyłączenia flagi (domyślnie wyłączona).
- **Szczegóły przepisu** (`/recipes/:id-:slug`, `/explore/recipes/:id-:slug`): czytelna metadana „Grill” jako chip/badge z ikoną `outdoor_grill`.
- **Lista przepisów „Moje przepisy”** (`/my-recipies` / `/my-recipes`): filtr po fladze „Grill” (tak/nie/wszystkie).
- **Karta przepisu** (`pych-recipe-card`): ikonka grilla z tooltipem „Grill” dla przepisów z `is_grill=true` (dotyczy wszystkich list używających komponentu karty).

Założenia:

- Flaga jest **opcjonalna** w formularzu, ale technicznie przechowywana jako boolean z domyślną wartością `false`.
- Frontend komunikuje się z backendem wyłącznie przez **Supabase Edge Functions** (`supabase.functions.invoke`) – bez bezpośrednich zapytań `supabase.from(...)`.
- Implementacja zgodna z zasadami projektu: **standalone components**, **signals**, `inject()`, `@if/@for`, **OnPush**, selektory z prefiksem `pych-`.

## 2. Routing widoku
Zmiana nie dodaje nowych tras, tylko rozszerza istniejące:

- **Formularz przepisu**:
    - `/recipes/new` (create)
    - `/recipes/:id/edit` (edit)
- **Szczegóły przepisu**:
    - prywatne: `/recipes/:id-:slug`
    - publiczne: `/explore/recipes/:id-:slug`
- **Lista przepisów**:
    - `/my-recipies` oraz alias `/my-recipes`

## 3. Struktura komponentów
Wysokopoziomowo (tylko elementy dotknięte zmianą):

- `RecipesListPageComponent` (`src/app/pages/recipes/recipes-list/recipes-list-page.component.ts`)
    - `RecipesFiltersComponent` (`.../components/recipes-filters/recipes-filters.component.ts`)
    - `RecipeListComponent` (`src/app/shared/components/recipe-list/recipe-list.component.ts`)
        - `RecipeCardComponent` (`src/app/shared/components/recipe-card/recipe-card.ts`)
- `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)
    - `RecipeBasicInfoFormComponent` (`.../components/recipe-basic-info-form/recipe-basic-info-form.component.ts`)
- `RecipeDetailViewComponent` (`src/app/shared/components/recipe-detail-view/recipe-detail-view.component.ts`)
    - `RecipeHeaderComponent` (`src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.ts`)

## 4. Szczegóły komponentów

### `RecipeFormPageComponent` (`pych-recipe-form-page`)
- **Opis komponentu**: Strona tworzenia/edycji przepisu. Utrzymuje `FormGroup`, ładuje dane w trybie edycji i mapuje formularz na `CreateRecipeCommand`/`UpdateRecipeCommand`.
- **Miejsce zmiany**:
    - `RecipeFormViewModel` (interfejs w `recipe-form-page.component.ts`) – dodać kontrolkę `isGrill`.
    - `initForm()` – dodać `isGrill: FormControl<boolean>` z domyślną wartością `false`.
    - `populateForm(recipe)` – ustawić `isGrill` z `recipe.is_grill ?? false`.
    - `mapFormToCommand()` – mapować `is_grill: formValue.isGrill` do komendy.
    - `buildAiImageRequest()` – przekazać `is_grill` (dla spójności kontraktu, jeśli request DTO go wspiera w backendzie; w typach FE jest `AiRecipeImageRecipeDto.is_grill?`).
- **Główne elementy HTML**:
    - Bez zmian w `recipe-form-page.component.html` poza przekazaniem nowego `FormControl` do `RecipeBasicInfoFormComponent`.
- **Obsługiwane zdarzenia**:
    - `onSubmit()` – bez zmian w flow; nowa wartość idzie w payloadzie.
- **Walidacja**:
    - `isGrill` jest booleanem – brak walidacji zakresów; domyślnie `false`.
    - Reszta walidacji bez zmian (czasy, liczba porcji, wymagane pola).
- **Typy**:
    - `CreateRecipeCommand` / `UpdateRecipeCommand` (z `shared/contracts/types.ts`) – używane już, zawierają `is_grill?: boolean`.
    - `RecipeDetailDto` – źródło danych w edycji (zawiera `is_grill: boolean`).
- **Propsy**: brak (komponent stronowy).

### `RecipeBasicInfoFormComponent` (`pych-recipe-basic-info-form`)
- **Opis komponentu**: Podformularz „Podstawowe informacje” – renderuje pola i toggle dla klasyfikacji (obecnie m.in. `isTermorobot`).
- **Miejsce zmiany**:
    - Dodać `@Input({ required: true }) isGrillControl!: FormControl<boolean>;`
    - W `recipe-basic-info-form.component.html` dodać drugi toggle obok/poniżej Termorobota:
        - `mat-slide-toggle` z etykietą **„Grill”**
        - opcjonalny opis/hint (krótki, spójny z istniejącym `toggle-hint`)
- **Główne elementy HTML**:
    - `mat-slide-toggle [formControl]="isGrillControl"`
- **Obsługiwane zdarzenia**:
    - Brak ręcznych handlerów – binding reactive forms.
- **Walidacja**:
    - brak (boolean).
- **Typy**:
    - `FormControl<boolean>`
- **Propsy**:
    - `isGrillControl: FormControl<boolean>`

### `RecipesFiltersComponent` (`pych-recipes-filters`)
- **Opis komponentu**: UI filtrów listy przepisów (search, sort, category, tags, termorobot). Emisja zmian przez `filtersChange`.
- **Miejsce zmiany**:
    - `RecipesFiltersViewModel` w `src/app/pages/recipes/recipes-list/models/recipes-filters.model.ts`:
        - dodać `grill: boolean | null`
        - `DEFAULT_FILTERS.grill = null`
    - `recipes-filters.component.ts`:
        - dodać `private readonly _grill = signal<boolean | null>(null);`
        - w `effect()` inicjalizacji: `this._grill.set(filters.grill);`
        - dodać getter `get grill(): boolean | null`
        - dodać handler `onGrillChange(value: boolean | null): void`
        - w `emitFilters()` dodać `grill: this._grill()`
    - `recipes-filters.component.html`:
        - dodać sekcję „Grill” analogicznie do Termorobota (3 wartości: wszystkie/null, tylko grill/true, bez grilla/false)
        - dla opcji `true` użyć ikony `outdoor_grill` (avatar w chipie) i etykiety „Grill”
- **Główne elementy HTML**:
    - `mat-chip-listbox` dla grilla:
        - `mat-chip-option [value]="null"` → „Wszystkie”
        - `mat-chip-option [value]="true"` → `mat-icon matChipAvatar>outdoor_grill</mat-icon` + „Grill”
        - `mat-chip-option [value]="false"` → „Bez grilla”
- **Obsługiwane zdarzenia**:
    - `(change)="onGrillChange($event.value)"`
- **Walidacja**:
    - brak (enum-like boolean|null).
- **Typy**:
    - `RecipesFiltersViewModel`
- **Propsy**:
    - bez zmian: `initialFilters`, `categories`, `tags`

### `RecipesListPageComponent` (`pych-recipes-list-page`)
- **Opis komponentu**: Strona listy przepisów z cursor-based pagination i filtrowaniem. Składa parametry do `RecipesService.getRecipesFeed()`.
- **Miejsce zmiany**:
    - `loadInitialRecipes(filters)` i `onLoadMore()`:
        - dodać do parametrów feedu `grill: filters.grill`
    - `recipeListItems` mapping:
        - przekazać `is_grill` do warstwy karty (patrz `RecipeCardComponent` / `RecipeCardData`)
- **Główne elementy HTML**:
    - Bez zmian w strukturze; `RecipesFiltersComponent` dostaje/oddaje nowy stan przez `filtersChange`.
- **Obsługiwane zdarzenia**:
    - `onFiltersChange()` – bez zmian; nowy filtr przychodzi w `newFilters`.
- **Walidacja**:
    - brak (parametry query).
- **Typy**:
    - `RecipesFiltersViewModel` (rozszerzony o `grill`)
    - `GetRecipesFeedParams` (rozszerzony o `grill`)
    - `RecipeListItemDto` (już zawiera `is_grill: boolean`)
- **Propsy**: brak.

### `RecipesService` (frontend) (`src/app/pages/recipes/services/recipes.service.ts`)
- **Opis komponentu**: Serwis wywołań Edge Functions dla przepisów. Buduje query string.
- **Miejsce zmiany**:
    - `GetRecipesParams` i `GetRecipesFeedParams`:
        - dodać `grill?: boolean | null`
    - `getRecipes()`:
        - jeśli `params.grill !== null && params.grill !== undefined` → `queryParams.append('filter[grill]', params.grill.toString())`
    - `getRecipesFeed()`:
        - analogicznie `filter[grill]`
- **Walidacja**:
    - Backend może zwrócić 400 przy nieprawidłowej wartości – w UI obsługujemy jak istniejące błędy pobierania listy.

### `RecipeCardComponent` (`pych-recipe-card`)
- **Opis komponentu**: Uogólniona karta przepisu używana w listach prywatnych i publicznych. Obecnie pokazuje m.in. badge Termorobot.
- **Miejsce zmiany**:
    - `RecipeCardData` w `recipe-card.ts`:
        - dodać `isGrill?: boolean;`
    - `recipe-card.html`:
        - dodać wskaźnik grilla dla `isGrill` (lub gdy `recipe().isGrill`/`recipe().isGrill` nie istnieje – preferujemy `RecipeCardData.isGrill`)
        - UX wymagany: **ikonka grilla** z tooltipem „Grill” (Material icon: `outdoor_grill`)
        - rekomendacja: umieścić ikonę obok badge Termorobot w `.recipe-badges` (np. kolejny `mat-chip` lub mały `mat-icon` overlay)
    - `recipe-card.scss`:
        - jeśli użyjemy chipa: dodać styl analogiczny do `.termorobot-chip` (np. inny container color)
        - jeśli użyjemy samej ikony: dodać klasę (np. `.grill-indicator`) i zapewnić kontrast/kliknięcia nie przechwytują nawigacji
- **Obsługiwane zdarzenia**:
    - brak nowych (to element informacyjny).
- **Walidacja**:
    - render tylko gdy `isGrill === true`.
- **Typy**:
    - `RecipeCardData` (rozszerzony).

### `RecipeHeaderComponent` (`pych-recipe-header`)
- **Opis komponentu**: Nagłówek szczegółów przepisu (publiczny i prywatny). Renderuje metadane (Termorobot, kategoria, tagi, czasy, klasyfikacje).
- **Miejsce zmiany**:
    - `recipe-header.component.html`:
        - w sekcji `.recipe-meta` dodać metadanę grilla:
            - warunek: `@if (recipe().is_grill) { ... }`
            - forma: `mat-chip` z `mat-icon matChipAvatar>outdoor_grill</mat-icon>` i etykietą „Grill”
            - chip powinien być „non-clickable” (analogicznie do Termorobota)
- **Obsługiwane zdarzenia**:
    - brak.
- **Walidacja**:
    - render tylko gdy `is_grill === true`.
- **Typy**:
    - `RecipeDetailDto` / `PublicRecipeDetailDto` (oba mają `is_grill: boolean`).

## 5. Typy
Zmiany typów/VM w froncie:

- **`RecipesFiltersViewModel`** (`src/app/pages/recipes/recipes-list/models/recipes-filters.model.ts`)
    - dodać pole:
        - `grill: boolean | null`
    - `DEFAULT_FILTERS.grill = null`

- **`GetRecipesParams`** (`src/app/pages/recipes/services/recipes.service.ts`)
    - dodać pole:
        - `grill?: boolean | null`

- **`GetRecipesFeedParams`** (`src/app/pages/recipes/services/recipes.service.ts`)
    - dodać pole:
        - `grill?: boolean | null`

- **`RecipeCardData`** (`src/app/shared/components/recipe-card/recipe-card.ts`)
    - dodać pole:
        - `isGrill?: boolean`

- **`RecipeFormViewModel`** (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)
    - dodać kontrolkę:
        - `isGrill: FormControl<boolean>`

Typy DTO już wspierają flagę:

- `RecipeListItemDto.is_grill: boolean`
- `RecipeDetailDto.is_grill: boolean`
- `CreateRecipeCommand.is_grill?: boolean`
- `UpdateRecipeCommand.is_grill?: boolean`

## 6. Zarządzanie stanem

- **Lista (`RecipesListPageComponent`)**:
    - `filters` to `signal<RecipesFiltersViewModel>` – rozszerzamy o `grill`.
    - Efekt filtrów pozostaje bez zmian – przy zmianie `grill` ma zresetować kontekst feedu i pobrać pierwszą porcję.
    - Rekomendacja UX (zgodnie z zasadą „keep previous data visible”): podczas zmiany filtrów można rozważyć nieczyszczenie `recipes` do zera, tylko ustawienie `isInitialLoading`/`isLoadingMore` i przyciemnienie listy (opcjonalne ulepszenie; nie blokuje wdrożenia).

- **Formularz (`RecipeFormPageComponent`)**:
    - `FormGroup` – dodajemy jedno pole boolean.
    - Brak dodatkowych sygnałów/stanów.

## 7. Integracja API

### Lista przepisów (private)
`RecipesService.getRecipesFeed()` wywołuje:

- `GET /functions/v1/recipes/feed?...&filter[grill]=true|false`

Mapowanie w UI:

- `RecipesFiltersComponent` emituje `filtersChange` z `grill`.
- `RecipesListPageComponent` przekłada `filters.grill` na `GetRecipesFeedParams.grill`.
- `RecipesService` zamienia to na query param `filter[grill]`.

### Tworzenie/edycja przepisu

- `POST /functions/v1/recipes` (create) – body `CreateRecipeCommand` z `is_grill` (boolean).
- `PUT /functions/v1/recipes/:id` (update) – body `UpdateRecipeCommand` z `is_grill` (boolean).

Kontrakty typów są w `shared/contracts/types.ts`.

## 8. Interakcje użytkownika

- **Formularz**:
    - użytkownik przełącza toggle „Grill”
    - zapis powoduje utrwalenie flagi
    - po ponownym wejściu w edycję toggle odtwarza zapisany stan

- **Lista „Moje przepisy”**:
    - użytkownik wybiera filtr „Grill”: `Wszystkie` / `Grill` / `Bez grilla`
    - lista resetuje feed i pobiera wyniki od początku
    - w trakcie ładowania zachowujemy istniejące zachowanie (snackbar dla błędów, load more)

- **Karta przepisu**:
    - gdy `is_grill=true`, karta pokazuje ikonę `outdoor_grill` z tooltipem „Grill”
    - element jest informacyjny i nie zmienia nawigacji po kliknięciu (karta nadal nawigacyjna)

- **Szczegóły przepisu**:
    - gdy `is_grill=true`, w metadanych widoczny chip „Grill” z ikoną `outdoor_grill`

## 9. Warunki i walidacja

- **`is_grill`**:
    - wartość logiczna
    - domyślnie `false` dla nowych przepisów
    - UI nie pokazuje „pustych” placeholderów – metadany pokazujemy tylko gdy `true`

- **Parametr `filter[grill]`**:
    - wysyłamy tylko gdy użytkownik wybrał `true` lub `false`
    - dla `null` nie wysyłamy parametru (oznacza „Wszystkie”)

## 10. Obsługa błędów

- **Lista**:
    - błąd pobierania po zmianie filtra „Grill” → istniejący snackbar: „Nie udało się pobrać przepisów. Spróbuj ponownie.”
    - błąd doładowania („Więcej”) → istniejący snackbar z akcją „Ponów”

- **Formularz**:
    - błąd zapisu create/update → istniejące `error` banner na stronie (bez zmian)

- **Kompatybilność**:
    - jeśli backend chwilowo nie zwróci `is_grill` (np. starsza wersja), UI powinno defensywnie traktować brak pola jako `false` (w mappingu i renderowaniu).

## 11. Kroki implementacji

1. Zmodyfikuj `RecipesFiltersViewModel` i `DEFAULT_FILTERS` w `src/app/pages/recipes/recipes-list/models/recipes-filters.model.ts` (dodaj `grill: boolean | null`).
2. Zaktualizuj `RecipesFiltersComponent`:
    - dodaj stan `_grill`, getter, handler `onGrillChange`, i uwzględnij w `emitFilters()`.
    - w HTML dodaj sekcję chipów „Grill”.
3. Zaktualizuj `RecipesService` (frontend):
    - rozszerz `GetRecipesParams` i `GetRecipesFeedParams` o `grill?: boolean | null`
    - dopnij `filter[grill]` w query string dla `getRecipes()` i `getRecipesFeed()`.
4. Zaktualizuj `RecipesListPageComponent`:
    - przekaż `filters.grill` do `GetRecipesFeedParams`.
    - dopnij `recipe.is_grill` do modelu karty (patrz krok 5).
5. Zaktualizuj `RecipeCardComponent`:
    - rozszerz `RecipeCardData` o `isGrill?: boolean`
    - w `recipe-card.html` dodaj ikonę/oznaczenie grilla z tooltipem „Grill” (Material: `outdoor_grill`) widoczne tylko gdy `true`.
6. Zaktualizuj formularz:
    - `RecipeFormViewModel` + `initForm()` + `populateForm()` + `mapFormToCommand()` w `RecipeFormPageComponent` (pole `isGrill` ⇄ `is_grill`).
    - przekaż `isGrillControl` do `RecipeBasicInfoFormComponent`.
    - dodaj toggle „Grill” w `RecipeBasicInfoFormComponent` (Input + template).
7. Zaktualizuj szczegóły:
    - w `RecipeHeaderComponent` dodaj chip „Grill” (z ikoną `outdoor_grill`) w `.recipe-meta`.
8. (Opcjonalnie) Dodaj/uzupełnij testy jednostkowe:
    - `RecipesFiltersComponent`: emisja `filtersChange` z `grill`
    - `RecipeCardComponent`: renderowanie ikonki grilla
    - `RecipeHeaderComponent`: renderowanie chipa „Grill”


