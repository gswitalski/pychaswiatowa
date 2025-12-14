# Plan implementacji zmian widoku: „Moje przepisy” (lista) + korekta akcji w „Szczegółach przepisu”

## 1. Przegląd

Zmiana dotyczy dwóch obszarów UI w części prywatnej aplikacji (dla zalogowanych):

- Widok listy **„Moje przepisy”** ma prezentować:
    - wszystkie przepisy zalogowanego użytkownika (niezależnie od widoczności),
    - **oraz** publiczne przepisy innych autorów, ale **tylko** wtedy, gdy są dodane do co najmniej jednej kolekcji należącej do zalogowanego użytkownika.
- Na kartach cudzych przepisów widocznych dzięki kolekcjom ma pojawić się chip/etykieta **„W moich kolekcjach”**.
- W widoku **Szczegółów przepisu** przyciski **„Edytuj”** i **„Usuń”** mają być dostępne **wyłącznie dla autora** (również gdy wejście nastąpiło z listy „Moje przepisy”).

Zmiana wykorzystuje wsparcie backendu w `GET /recipes` dla parametru `view=my_recipes` oraz pól pomocniczych `is_owner` i `in_my_collections` w DTO elementu listy.

## 2. Routing widoku

- **Ścieżka kanoniczna:** `/my-recipies`
- **Alias:** `/my-recipes` (redirect do `/my-recipies`)
- **Dostęp:** chroniony (tylko zalogowani) i renderowany w layoucie App Shell z Sidebarem.

Wymagane zmiany w routingu:

- Dodać trasę dla listy „Moje przepisy” pod `/my-recipies`.
- Dodać redirect: `/my-recipes` → `/my-recipies`.
- Upewnić się, że Sidebar zawiera link do `/my-recipies` (oraz że reguła widoczności Sidebara obejmuje `/my-recipies` i alias).

## 3. Struktura komponentów

Zakładamy reużycie istniejących komponentów listy przepisów (jeśli już istnieją w projekcie) i rozszerzenie ich o nowe zachowanie.

Wysokopoziomowe drzewo komponentów:

```
MyRecipesPageComponent (kontener / strona routowalna)
├─ SharedPageHeaderComponent (tytuł + akcje)
│  └─ (SplitButton) „Dodaj przepis” (Ręcznie | Import)
├─ MyRecipesFiltersComponent (filtry: wyszukiwarka/sort/kategoria/tagi)
├─ MyRecipesGridComponent (siatka)
│  ├─ RecipeCardComponent (karta przepisu)
│  │  └─ MatChip „W moich kolekcjach” (warunkowo)
│  └─ EmptyStateComponent
└─ MatPaginator
```

Uwaga: jeśli w repo już istnieją odpowiedniki (`RecipesPageComponent`, `RecipesFiltersComponent`, `RecipeListComponent` itd.), w implementacji należy:

- zachować ich nazwy i lokalizacje,
- wprowadzić wyłącznie zmiany niezbędne do spełnienia wymagań (parametr `view`, chip na karcie, ukrywanie akcji w szczegółach).

## 4. Szczegóły komponentów

### 4.1. `MyRecipesPageComponent` (komponent-kontener)

- **Opis komponentu:** Strona listy „Moje przepisy”. Zarządza stanem filtrów i paginacji (Angular Signals), woła API i przekazuje dane do komponentów prezentacyjnych.
- **Główne elementy:** Page Header + filtry + siatka kart + paginator.
- **Obsługiwane interakcje:**
    - zmiana filtrów (wyszukiwanie, kategoria, tagi, sort),
    - zmiana strony/limitu w paginatorze,
    - kliknięcie „Dodaj przepis” / „Import”.
- **Obsługiwana walidacja:**
    - parametry zapytania do API muszą mieć poprawny format (np. `sort=name.asc`),
    - opcjonalnie: nie wysyłać `search` dla zbyt krótkiej frazy (np. < 2 znaków), aby ograniczyć „szum” w API.
- **Typy:**
    - `PaginatedResponseDto<RecipeListItemDto>` (wynik listy),
    - `CategoryDto[]`, `TagDto[]` (dla filtrów),
    - `MyRecipesFiltersViewModel` (lokalny VM – sekcja 5).
- **Propsy:** brak (komponent routowalny).

### 4.2. `MyRecipesFiltersComponent` (prezentacyjny)

- **Opis komponentu:** Pasek filtrów/sortowania dla listy.
- **Główne elementy:**
    - `mat-form-field` + `input` (wyszukiwanie),
    - `mat-select` (sort),
    - `mat-select` (kategoria),
    - `mat-chip-grid` / `mat-autocomplete` dla tagów (jeśli istnieje w projekcie).
- **Obsługiwane interakcje:** każda zmiana wartości emituje nowy stan filtrów.
- **Obsługiwana walidacja:**
    - jeśli obsługiwane jest autouzupełnianie tagów, blokować dodanie pustego tagu,
    - normalizacja tagów (trim) i unikanie duplikatów.
- **Typy:** `MyRecipesFiltersViewModel`, `CategoryDto`, `TagDto`.
- **Propsy (Inputs):**
    - `initialFilters: MyRecipesFiltersViewModel`,
    - `categories: CategoryDto[]`,
    - `availableTags: TagDto[]`.
- **Zdarzenia (Outputs):**
    - `filtersChange: MyRecipesFiltersViewModel`.

### 4.3. `MyRecipesGridComponent` (prezentacyjny)

- **Opis komponentu:** Renderuje listę kart lub stan pusty. Odpowiada za UI stanu ładowania zgodnie z zasadą „keep previous data visible”.
- **Główne elementy:**
    - kontener siatki (`div` / CSS grid),
    - `@for` renderujący `RecipeCardComponent`,
    - `EmptyStateComponent` (gdy brak danych i nie trwa ładowanie).
- **Obsługiwane interakcje:** kliknięcie karty (nawigacja odbywa się przez `routerLink` w samej karcie).
- **Obsługiwana walidacja:** brak.
- **Typy:** `RecipeListItemDto`.
- **Propsy (Inputs):**
    - `recipes: RecipeListItemDto[]`,
    - `isLoading: boolean`.

### 4.4. `RecipeCardComponent` (współdzielony)

- **Opis komponentu:** Karta przepisu w siatce.
- **Zmiana wymagana:** dodać chip/etykietę **„W moich kolekcjach”** dla cudzych przepisów widocznych w tej liście.
- **Warunek widoczności chipu (na podstawie DTO listy):**
    - `recipe.is_owner === false` **i** `recipe.in_my_collections === true`.
- **Główne elementy:** `mat-card`, obraz, tytuł, opcjonalny chip.
- **Obsługiwane interakcje:** kliknięcie karty → nawigacja do szczegółów.
- **Obsługiwana walidacja:** brak.
- **Typy:** `RecipeListItemDto`.
- **Propsy (Inputs):** `recipe: RecipeListItemDto`.

### 4.5. `RecipeDetailsPageComponent` (istniejący widok szczegółów)

- **Opis komponentu:** Widok szczegółów przepisu pod `/recipes/:id`.
- **Zmiana wymagana:** ukryć akcje **„Edytuj”** i **„Usuń”** dla zalogowanego nie-autora.
- **Sposób wyliczenia „czy autor” (rekomendacja):**
    - pobrać aktualnego użytkownika z warstwy auth (np. `AuthFacade`/`AuthService`) i porównać z `user_id`/`author_id` w danych przepisu,
    - jeśli DTO szczegółów nie zawiera bezpośredniego `is_owner`, to w UI liczyć `isOwner = recipe.user_id === currentUserId`.
- **Walidacja / warunki UI:**
    - `isOwner === true` → pokazać „Edytuj” i „Usuń”,
    - `isOwner === false` → nie renderować tych przycisków (nie tylko disable).

## 5. Typy

### 5.1. DTO istniejące (z `shared/contracts/types.ts`)

- `PaginatedResponseDto<T>`
- `RecipeListItemDto` (posiada: `is_owner`, `in_my_collections`, `author`)
- `RecipeDetailDto`
- `CategoryDto`, `TagDto`
- `ApiError`

### 5.2. Nowe typy ViewModel (frontend)

- **`MyRecipesFiltersViewModel`** (jeśli w projekcie istnieje już analogiczny VM dla listy, należy go reużyć zamiast tworzyć nowy):
    - `search: string | null`
    - `categoryId: number | null`
    - `tags: string[]`
    - `sort: 'name.asc' | 'name.desc' | 'created_at.asc' | 'created_at.desc'`

- **`MyRecipesQueryParams`** (typ pomocniczy do budowy zapytania do API):
    - `page: number`
    - `limit: number`
    - `sort?: string`
    - `view: 'my_recipes'`
    - `filterCategoryId?: number`
    - `filterTags?: string[]`
    - `search?: string`

## 6. Zarządzanie stanem

Zgodnie z wytycznymi projektu stosujemy **Angular Signals** i kontrolę przepływu `@if/@for` oraz OnPush.

W `MyRecipesPageComponent`:

- **Źródła stanu (Writable Signals):**
    - `filters = signal<MyRecipesFiltersViewModel>(...)`
    - `pagination = signal<{ page: number; limit: number }>(...)`
    - `result = signal<PaginatedResponseDto<RecipeListItemDto> | null>(null)`
    - `isLoading = signal<boolean>(false)`
    - `error = signal<ApiError | null>(null)`

- **Stan pochodny (Computed):**
    - `recipes = computed(() => result()?.data ?? [])`
    - `isEmpty = computed(() => !isLoading() && recipes().length === 0)`
    - `query = computed<MyRecipesQueryParams>(() => ({
        page: pagination().page,
        limit: pagination().limit,
        view: 'my_recipes',
        sort: filters().sort,
        filterCategoryId: filters().categoryId ?? undefined,
        filterTags: filters().tags.length ? filters().tags : undefined,
        search: filters().search?.trim() ? filters().search!.trim() : undefined,
      }))`

- **Efekty:**
    - `effect` reagujący na zmianę `query()` i wywołujący `RecipesService.getRecipes(...)`.
    - Podczas ładowania **nie czyścić** istniejących danych (używać `state.update()` / utrzymać `result()`), aby uniknąć „white flash”.

## 7. Integracja API

### 7.1. Lista „Moje przepisy”

- **Endpoint:** `GET /recipes`
- **Parametry (zgodnie z API planem):**
    - `view=my_recipes`
    - `page`, `limit`
    - `sort` (np. `created_at.desc`, `name.asc`)
    - `filter[category_id]`
    - `filter[tags]` (comma-separated)
    - `search`
- **Odpowiedź:** `PaginatedResponseDto<RecipeListItemDto>`

Rekomendacja implementacyjna warstwy serwisu:

- `RecipesService.getRecipes(params: MyRecipesQueryParams): Observable<PaginatedResponseDto<RecipeListItemDto>>`
    - buduje `URLSearchParams` i wywołuje **Edge Function** przez `supabase.functions.invoke('recipes?...', { method: 'GET' })` (zgodnie z zakazem bezpośredniego `supabase.from(...)`).

### 7.2. Szczegóły przepisu

- **Endpoint:** `GET /recipes/{id}`
- **Odpowiedź:** `RecipeDetailDto`
- **Błędy:**
    - `401` (brak sesji),
    - `403` jeśli przepis nie jest publiczny i użytkownik nie jest właścicielem,
    - `404` jeśli nie istnieje.

UI nie powinno opierać „ukrywania akcji” na błędzie `403`. Ukrywanie akcji wynika z tego, że przepis może być publiczny, ale użytkownik nie jest autorem.

## 8. Interakcje użytkownika

- **Wejście na `/my-recipies`:** pobranie listy (domyślnie sort np. `created_at.desc`).
- **Wyszukiwanie:** wpisanie frazy powoduje odświeżenie listy (zalecany debounce, np. 250–400 ms).
- **Filtrowanie po kategorii:** zmiana wyboru odświeża listę.
- **Filtrowanie po tagach:** dodanie/usunięcie tagu odświeża listę.
- **Sortowanie:** zmiana sortowania odświeża listę.
- **Paginacja:** zmiana strony/limit odświeża listę.
- **Kliknięcie karty:** nawigacja do `/recipes/:id`.
- **Widoczność chipu „W moich kolekcjach”:** użytkownik rozpoznaje, że to cudzy przepis zapisany w jego kolekcjach.
- **Szczegóły przepisu:**
    - autor widzi akcje „Edytuj” i „Usuń”,
    - zalogowany nie-autor nie widzi tych akcji (niezależnie od tego, skąd przeszedł do szczegółów).

## 9. Warunki i walidacja

- **Warunki biznesowe listy (po stronie UI):**
    - Chip „W moich kolekcjach” renderować tylko, gdy `is_owner === false && in_my_collections === true`.

- **Walidacja parametrów przed wysłaniem do API:**
    - `page >= 1`,
    - `limit` w dozwolonym zestawie (np. 10/20/50 – zgodnie z UI),
    - `filter[tags]` bez pustych wartości,
    - `search` (opcjonalnie) wysyłać dopiero od min. 2 znaków.

- **Warunki akcji w szczegółach:**
    - renderować przyciski „Edytuj/Usuń” tylko, jeśli `isOwner === true`.

## 10. Obsługa błędów

- **Lista (`GET /recipes`):**
    - błąd sieci/5xx: `MatSnackBar` z komunikatem „Nie udało się pobrać przepisów. Spróbuj ponownie.” i utrzymanie poprzednich danych, jeśli istnieją,
    - `401`: globalna obsługa (interceptor/guard) i przekierowanie do logowania.

- **Szczegóły (`GET /recipes/{id}`):**
    - `404`: widok „Nie znaleziono przepisu” + CTA „Wróć do listy” (`/my-recipies`),
    - `403`: czytelny komunikat „Nie masz dostępu do tego przepisu” + CTA powrotu,
    - błędy 5xx: komunikat generyczny.

## 11. Kroki implementacji

1. **Routing:**
    - dodać trasę `/my-recipies` (komponent listy „Moje przepisy”),
    - dodać redirect `/my-recipes` → `/my-recipies`,
    - zaktualizować Sidebar: link „Moje przepisy” wskazuje `/my-recipies`.

2. **Warstwa API (frontend):**
    - upewnić się, że `RecipesService.getRecipes(...)` potrafi wysłać `view=my_recipes` oraz pozostałe parametry (`sort`, `filter[...]`, `search`),
    - upewnić się, że DTO listy używa `RecipeListItemDto` (z polami `is_owner`, `in_my_collections`, `author`).

3. **Lista „Moje przepisy”:**
    - ustawić domyślnie `view='my_recipes'` dla tego widoku,
    - utrzymać poprzednie dane podczas przeładowań (zgodnie z regułami loading states),
    - dopiąć empty state z akcją „Dodaj przepis”.

4. **Karta przepisu:**
    - dodać `mat-chip` „W moich kolekcjach” z warunkiem `!recipe.is_owner && recipe.in_my_collections`.

5. **Szczegóły przepisu:**
    - wyliczyć `isOwner` w komponencie szczegółów (na podstawie danych przepisu + bieżącego użytkownika),
    - zrenderować przyciski „Edytuj/Usuń” wyłącznie dla `isOwner === true` (także w PageHeader/toolbarze).

6. **Testy manualne (minimum):**
    - użytkownik z własnymi przepisami: widzi je na liście, brak chipu,
    - użytkownik z publicznym cudzym przepisem w swojej kolekcji: widzi przepis na liście z chipem,
    - wejście w szczegóły cudzego przepisu: brak „Edytuj/Usuń”,
    - wejście w szczegóły własnego przepisu: akcje obecne.
