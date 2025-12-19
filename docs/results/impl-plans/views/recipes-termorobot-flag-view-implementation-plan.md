# Plan implementacji zmian widoków: Flaga „Termorobot” (Thermomix/Lidlomix) w przepisach

## 1. Przegląd

Celem zmiany jest dodanie do przepisów opcjonalnej flagi **„Termorobot (Thermomix/Lidlomix)”** (pole `is_termorobot: boolean`) i zapewnienie jej pełnej obsługi w UI:

- w **formularzu dodawania/edycji przepisu** użytkownik może włączyć/wyłączyć flagę (domyślnie wyłączona dla nowych przepisów),
- w **szczegółach przepisu** (zarówno prywatnych, jak i publicznych / explore) wyświetla się czytelny, nienachalny **badge/chip „Termorobot”** gdy flaga jest włączona,
- w **liście „Moje przepisy”** użytkownik może filtrować listę po tej fladze (`tak/nie`),
- na **kartach przepisów** (`RecipeCardComponent`) wyświetla się badge/chip „Termorobot” dla przepisów oznaczonych flagą.

Zmiana jest przekrojowa, ale dotyczy tylko UI (bez zmiany routingu). Integracja z API realizowana jest poprzez istniejące Edge Functions oraz kontrakty w `shared/contracts/types.ts`.

## 2. Routing widoku

Zmiana obejmuje istniejące trasy:

- **Formularz przepisu**:
  - `/recipes/new` → `RecipeFormPageComponent`
  - `/recipes/:id/edit` → `RecipeFormPageComponent`
- **Szczegóły przepisu (prywatne)**:
  - `/recipes/:id` → `RecipeDetailPageComponent`
- **Szczegóły przepisu (publiczne / explore)**:
  - `/explore/recipes/:id` → `ExploreRecipeDetailPageComponent`
- **Lista przepisów (Moje przepisy)**:
  - `/my-recipies` (alias `/my-recipes`) → `RecipesListPageComponent`

Nie są wymagane zmiany w `src/app/app.routes.ts` wynikające bezpośrednio z tej funkcji.

## 3. Struktura komponentów

Wysokopoziomowe drzewo komponentów (tylko elementy istotne dla flagi Termorobot):

```
RecipesListPageComponent (/my-recipies)
├─ pych-page-header
├─ pych-recipes-filters
│  └─ (NOWE) kontrolki filtra „Termorobot” (tak/nie)
└─ pych-recipe-list
   └─ pych-recipe-card
      └─ (NOWE) badge/chip „Termorobot” (warunkowo)

RecipeFormPageComponent (/recipes/new, /recipes/:id/edit)
├─ pych-page-header
└─ pych-recipe-basic-info-form
   └─ (NOWE) toggle/checkbox „Termorobot (Thermomix/Lidlomix)”

RecipeDetailPageComponent (/recipes/:id)
└─ pych-recipe-header
   └─ (NOWE) badge/chip „Termorobot” w metadanych

ExploreRecipeDetailPageComponent (/explore/recipes/:id)
└─ pych-recipe-header
   └─ (NOWE) badge/chip „Termorobot” w metadanych
```

## 4. Szczegóły komponentów

### 4.1. `RecipesListPageComponent` (`src/app/pages/recipes/recipes-list/recipes-list-page.component.ts`)

- **Opis komponentu**: Kontener strony „Moje przepisy”. Zarządza stanem filtrów/paginacji, pobiera dane z API i renderuje listę kart.
- **Główne elementy**: `pych-page-header`, `pych-recipes-filters`, `pych-recipe-list`, `mat-paginator`, stan pusty.
- **Obsługiwane zdarzenia**:
  - `(filtersChange)` z `RecipesFiltersComponent` → aktualizacja `filters` i reset paginacji.
  - `(page)` z `mat-paginator` → aktualizacja `paginationState`.
- **Obsługiwana walidacja**:
  - Parametry do API muszą mapować się wprost na kontrakt:
    - `sort = {sortBy}.{sortDirection}`
    - `filter[termorobot]` wysyłać tylko jeśli użytkownik aktywuje filtr.
- **Typy (DTO / VM)**:
  - `RecipeListItemDto` (zawiera `is_termorobot`)
  - `RecipesFiltersViewModel` (wymaga rozszerzenia o pole filtra termorobot – sekcja 5)
  - `GetRecipesParams` (wymaga rozszerzenia o `termorobot` – sekcja 7)
- **Propsy**: brak.

Wymagana zmiana:

- Rozszerzyć mapowanie `RecipesFiltersViewModel → GetRecipesParams`, aby uwzględnić `termorobot` i przekazywać je do `RecipesService.getRecipes()`.

### 4.2. `RecipesFiltersComponent` (`src/app/pages/recipes/recipes-list/components/recipes-filters/recipes-filters.component.ts|.html`)

- **Opis komponentu**: Panel filtrów listy przepisów (wyszukiwanie, sort, kategoria, tagi).
- **Główne elementy (istniejące)**:
  - `mat-form-field + input` (wyszukiwanie z debounce)
  - `mat-select` (sort)
  - `mat-select` (kategoria)
  - `mat-chip-grid + mat-autocomplete` (tagi)
- **Nowe elementy (do dodania)**:
  - kontrolka filtra **„Termorobot”** w formie **chipów** (wymaganie: „filtr (chip) Termorobot”):
    - rekomendacja: `mat-chip-listbox` z opcjami:
      - „Wszystkie” (brak filtra / `null`)
      - „Termorobot” (`true`)
      - „Bez termorobota” (`false`)
    - alternatywa: dwa `mat-chip-option` („Tak”/„Nie”) z możliwością wyczyszczenia wyboru (stan `null`).
- **Obsługiwane zdarzenia**:
  - zmiana wyboru filtra termorobot emituje `filtersChange` natychmiast (bez debounce).
- **Obsługiwana walidacja**:
  - Filtr termorobot musi być trzystanowy: `null`/`true`/`false`.
- **Typy**:
  - `RecipesFiltersViewModel` (rozszerzony)
- **Propsy**:
  - `initialFilters: RecipesFiltersViewModel`
  - `categories: CategoryDto[]`
  - `tags: TagDto[]`

### 4.3. `RecipeListComponent` (`src/app/pages/recipes/recipes-list/components/recipe-list/recipe-list.component.ts`)

- **Opis komponentu**: Prezentacyjny komponent siatki kart.
- **Główne elementy**: `@for` renderujący `pych-recipe-card`.
- **Obsługiwane zdarzenia**: brak (nawigacja jest wewnątrz karty).
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - wejście: `RecipeListItemDto[]`
  - mapowanie do `RecipeCardData` (wymaga uzupełnienia o informację „termorobot” – sekcja 5)
- **Propsy**:
  - `recipes: RecipeListItemDto[]`
  - `isLoading: boolean`

Wymagana zmiana:

- Rozszerzyć `mapToCardData()` lub wejściowe dane karty tak, aby `RecipeCardComponent` mogła zdecydować o renderowaniu badge/chipu „Termorobot”.

### 4.4. `RecipeCardComponent` (`src/app/shared/components/recipe-card/recipe-card.ts|.html|.scss`)

- **Opis komponentu**: Współdzielona karta przepisu dla list prywatnych i publicznych.
- **Główne elementy**: `mat-card`, obraz/placeholder, tytuł, opcjonalna kategoria, badge „Mój przepis” oraz „W moich kolekcjach”.
- **Nowe elementy (do dodania)**:
  - badge/chip **„Termorobot”**, renderowany warunkowo.
- **Obsługiwane zdarzenia**:
  - kliknięcie karty → nawigacja (istniejące).
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `RecipeCardData` powinien zostać rozszerzony o `isTermorobot: boolean` (lub alternatywnie dodać osobny `input<boolean>` w komponencie).
- **Propsy**:
  - `recipe: RecipeCardData`
  - (opcjonalnie) `isTermorobot: boolean`

Wytyczne UX dla badge:

- Badge „Termorobot” powinien być **nienachalny** i spójny z istniejącymi chipami.
- Jeśli na karcie może pojawić się kilka oznaczeń (np. „Mój przepis” oraz „Termorobot”), rekomendacja:
  - użyć **jednego** `mat-chip-set` i renderować w nim warunkowo kilka chipów,
  - albo zastosować układ „stack” w lewym górnym rogu (kilka wierszy), aby chipy nie nachodziły na siebie.

### 4.5. `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts|.html`)

- **Opis komponentu**: Strona dodawania/edycji przepisu. Zarządza `FormGroup`, ładowaniem danych w trybie edycji oraz wysyłką do API.
- **Główne elementy**: `pych-recipe-basic-info-form`, `pych-recipe-image-upload`, `pych-recipe-categorization-form`, listy składników i kroków.
- **Obsługiwane zdarzenia**:
  - zapis (`onSubmit`) → `createRecipe`/`updateRecipe`
  - anuluj (`onCancel`)
- **Obsługiwana walidacja (istniejąca)**:
  - `name`: required, maxLength(150)
  - `ingredients`, `steps`: minArrayLength(1)
  - `servings`: min(1), max(99), integerValidator
- **Nowa walidacja**:
  - brak (flaga termorobot jest opcjonalna, boolean).
- **Typy**:
  - `CreateRecipeCommand` / `UpdateRecipeCommand` (obsługują `is_termorobot?: boolean`)
  - `RecipeDetailDto` (musi zawierać `is_termorobot` do wypełnienia formularza w edycji)
- **Propsy**: brak.

Wymagane zmiany:

- Rozszerzyć `RecipeFormViewModel` o `isTermorobot: FormControl<boolean>`.
- Dodać kontrolkę do `initForm()` z domyślną wartością `false`.
- W `populateForm()` ustawić wartość kontrolki na podstawie danych przepisu.
- W `mapFormToCommand()` mapować na `is_termorobot` w komendzie tworzenia/edycji.

### 4.6. `RecipeBasicInfoFormComponent` (`src/app/pages/recipes/recipe-form/components/recipe-basic-info-form/*`)

- **Opis komponentu**: Sekcja „Podstawowe informacje” formularza.
- **Główne elementy**: pola `name`, `description`, `servings`.
- **Nowe elementy (do dodania)**:
  - toggle/checkbox **„Termorobot (Thermomix/Lidlomix)”**.
  - rekomendacja: `mat-slide-toggle` (lub `mat-checkbox`) z opisem pomocniczym.
- **Obsługiwane zdarzenia**:
  - standardowe zmiany w `FormControl`.
- **Obsługiwana walidacja**:
  - brak (boolean).
- **Typy**:
  - `FormControl<boolean>` (nowy input)
- **Propsy (Inputs)**:
  - `nameControl: FormControl<string>`
  - `descriptionControl: FormControl<string>`
  - `servingsControl: FormControl<number | null>`
  - `isTermorobotControl: FormControl<boolean>` (NOWE)

### 4.7. `RecipeHeaderComponent` (`src/app/pages/recipes/recipe-detail/components/recipe-header/*`)

- **Opis komponentu**: Nagłówek przepisu używany w szczegółach prywatnych i publicznych. Renderuje tytuł, opis, liczbę porcji, kategorię i tagi.
- **Główne elementy**:
  - tytuł
  - (opcjonalnie) `servingsLabel()` pod tytułem
  - opis
  - metadane: kategoria i tagi
- **Nowe elementy (do dodania)**:
  - badge/chip **„Termorobot”** w obszarze metadanych, renderowany, gdy `recipe().is_termorobot === true`.
  - rekomendacja: `mat-chip` we wspólnym obszarze metadanych (spójny z tagami) lub osobny „badge” obok kategorii.
- **Obsługiwane zdarzenia**: brak.
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `RecipeDetailDto | PublicRecipeDetailDto` (oba zawierają `is_termorobot`).
- **Propsy**:
  - `recipe: RecipeDetailDto | PublicRecipeDetailDto`
  - `isPublic: boolean`

## 5. Typy

### 5.1. DTO (kontrakty)

Z `shared/contracts/types.ts` (już dostępne / wymagane w tej zmianie):

- `RecipeListItemDto`:
  - **pole wymagane**: `is_termorobot: boolean`
- `RecipeDetailDto`:
  - **pole wymagane**: `is_termorobot: boolean` (jako część danych szczegółów)
- `PublicRecipeDetailDto` / `PublicRecipeListItemDto`:
  - **pole wymagane**: `is_termorobot: boolean`
- `CreateRecipeCommand` / `UpdateRecipeCommand`:
  - **pole**: `is_termorobot?: boolean` (opcjonalne, default backend: `false`)

### 5.2. ViewModel (frontend)

- `RecipesFiltersViewModel` (`src/app/pages/recipes/recipes-list/models/recipes-filters.model.ts`) – rozszerzyć o:
  - `termorobot: boolean | null`

Uzasadnienie: UI musi wspierać „tak/nie” oraz stan domyślny „bez filtra” (null).

### 5.3. Modele UI dla karty

- `RecipeCardData` (`src/app/shared/components/recipe-card/recipe-card.ts`) – rozszerzyć o:
  - `isTermorobot: boolean`

Alternatywa: dodać osobne `input<boolean>` `isTermorobot` w `RecipeCardComponent` i pozostawić `RecipeCardData` bez zmian.

## 6. Zarządzanie stanem

Zmiana nie wymaga wprowadzania nowego globalnego stanu ani nowego store. Modyfikacje dotyczą lokalnego stanu w:

- `RecipesListPageComponent`:
  - `filters = signal<RecipesFiltersViewModel>(DEFAULT_FILTERS)` → dodać pole `termorobot` do wartości domyślnych.
  - `effect` do odświeżania listy pozostaje bez zmian koncepcyjnie; zmienia się tylko mapowanie filtrów na parametry API.

- `RecipeFormPageComponent`:
  - formularz `FormGroup<RecipeFormViewModel>` → dodanie nowej kontrolki boolean i mapowania do komendy.

## 7. Integracja API

### 7.1. Lista „Moje przepisy” – filtr po termorobot

- **Endpoint**: `GET /recipes`
- **Serwis FE**: `RecipesService.getRecipes(params)` (`src/app/pages/recipes/services/recipes.service.ts`)
- **Nowy parametr query**:
  - `filter[termorobot]`:
    - `true` → tylko przepisy z `is_termorobot=true`
    - `false` → tylko przepisy z `is_termorobot=false`
    - brak parametru → bez filtrowania
- **Odpowiedź**: `PaginatedResponseDto<RecipeListItemDto>`

Wymagane zmiany w FE:

- Rozszerzyć `GetRecipesParams` o `termorobot?: boolean | null`.
- W `RecipesService.getRecipes()` dopisać budowę query param:
  - jeśli `termorobot !== null && termorobot !== undefined` → `filter[termorobot]=<true|false>`.

### 7.2. Tworzenie i edycja przepisu

- **Endpointy**:
  - `POST /recipes` – tworzenie
  - `PUT /recipes/{id}` – aktualizacja
- **Request**:
  - `is_termorobot?: boolean` (opcjonalne)
- **Zachowanie**:
  - dla nowych przepisów domyślnie wysyłać `false` (albo pominąć pole i polegać na default backendu – rekomendacja: wysyłać explicite zgodnie z UI).

### 7.3. Szczegóły przepisu

- **Endpointy**:
  - prywatne: `GET /recipes/{id}`
  - explore/public: projektowo zależne od istniejącej implementacji (`ExploreRecipesService.getExploreRecipeById(id)`)
- **Wymaganie**:
  - w DTO szczegółów musi być dostępne `is_termorobot`, aby `RecipeHeaderComponent` mógł wyrenderować badge.

## 8. Interakcje użytkownika

- **Formularz „Nowy przepis”**:
  - użytkownik widzi toggle/checkbox „Termorobot (Thermomix/Lidlomix)”, domyślnie wyłączony.
  - po włączeniu i zapisie – flaga zostaje zapisana i widoczna na szczegółach/listach.

- **Formularz „Edycja przepisu”**:
  - toggle/checkbox odtwarza aktualny stan z API.
  - użytkownik może włączyć/wyłączyć i zapisać zmianę.

- **Lista „Moje przepisy”**:
  - użytkownik wybiera filtr „Termorobot” (tak/nie) → lista przeładowuje się z parametrem `filter[termorobot]`.
  - użytkownik może wrócić do stanu „bez filtra”.

- **Karty przepisów**:
  - na karcie przepisu z `is_termorobot=true` widoczny jest chip „Termorobot”.

- **Szczegóły przepisu**:
  - jeśli `is_termorobot=true` – widoczny chip „Termorobot” w metadanych.

## 9. Warunki i walidacja

- **UI / Formularz**:
  - `is_termorobot` jest opcjonalny (boolean), bez walidacji.
  - domyślna wartość w UI: `false`.

- **UI / Lista**:
  - filtr termorobot jest trzystanowy:
    - `null` → brak parametru `filter[termorobot]`
    - `true` → `filter[termorobot]=true`
    - `false` → `filter[termorobot]=false`

- **API** (warunek kontraktowy do weryfikacji w implementacji):
  - `filter[termorobot]` przyjmuje tylko wartości boolean; niepoprawna wartość → `400`.

## 10. Obsługa błędów

- **Lista**:
  - przy błędzie pobierania danych (`4xx/5xx`, sieć) pokazać `MatSnackBar` (jak obecnie) i zachować poprzednie dane podczas ładowania (zgodnie z zasadami projektu).

- **Formularz**:
  - błędy zapisu przepisu pokazane w `error` (banner) i blokada stanu `saving` (jak obecnie).

- **Szczegóły**:
  - brak zmian w logice błędów; jedynie UI dodatkowo renderuje chip jeśli pole jest dostępne.

## 11. Kroki implementacji

1. **Kontrakty i typy**
   - Zweryfikować, że DTO szczegółów (`RecipeDetailDto` oraz DTO używane przez explore) zawiera `is_termorobot`.
   - Jeśli brakuje, zaktualizować kontrakty w `shared/contracts/types.ts` i miejsca mapowania w serwisach.

2. **Formularz przepisu**
   - `RecipeFormPageComponent`:
     - dodać `isTermorobot: FormControl<boolean>` do `RecipeFormViewModel`,
     - zainicjalizować kontrolkę w `initForm()` jako `false`,
     - w `populateForm()` wypełniać kontrolkę wartością z API,
     - w `mapFormToCommand()` mapować na `is_termorobot`.
   - `RecipeBasicInfoFormComponent`:
     - dodać `@Input isTermorobotControl`,
     - w template dodać toggle/checkbox z etykietą „Termorobot (Thermomix/Lidlomix)”.

3. **Szczegóły przepisu**
   - `RecipeHeaderComponent`:
     - dodać warunkowe renderowanie chipu „Termorobot” gdy `recipe().is_termorobot` jest prawdą.
   - Zweryfikować wygląd w obu kontekstach (`isPublic` true/false).

4. **Karta przepisu**
   - Rozszerzyć `RecipeCardData` lub dodać osobny input dla informacji o termorobot.
   - W `RecipeListComponent.mapToCardData()` przekazać `is_termorobot`.
   - W `recipe-card.html` dodać chip „Termorobot” w obszarze badge (spójnie z istniejącymi chipami).

5. **Filtr na liście**
   - `RecipesFiltersViewModel`:
     - dodać `termorobot: boolean | null` + zaktualizować `DEFAULT_FILTERS`.
   - `RecipesFiltersComponent`:
     - dodać stan sygnału dla termorobot (`_termorobot`) i kontrolkę w HTML (chip-listbox).
     - emitować `filtersChange` z uzupełnionym polem.
   - `RecipesListPageComponent`:
     - w `loadRecipes()` mapować `filters.termorobot` na `GetRecipesParams.termorobot`.

6. **Warstwa API w frontendzie**
   - `RecipesService`:
     - rozszerzyć `GetRecipesParams` o `termorobot?: boolean | null`.
     - dopisać budowę query parametru `filter[termorobot]`.

7. **Test plan (manualny)**
   - **Formularz / tworzenie**:
     - utworzyć przepis z `Termorobot = off` → w szczegółach brak chipu, na liście brak chipu.
     - utworzyć przepis z `Termorobot = on` → w szczegółach widoczny chip, na liście/kartach widoczny chip.
   - **Formularz / edycja**:
     - włączyć/wyłączyć flagę, zapisać, wrócić do edycji → stan toggle odtwarza zapis.
   - **Lista / filtr**:
     - wybrać filtr `Termorobot = tak` → lista pokazuje tylko przepisy z chipem.
     - wybrać filtr `Termorobot = nie` → lista pokazuje przepisy bez chipu.
     - wyczyścić filtr → lista wraca do wszystkich.
