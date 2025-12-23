# Plan implementacji zmiany: Ikonka widoczności przepisu na karcie (US-032)

## 1. Przegląd

Celem zmiany jest wdrożenie reguły UI z US-032: **na kartach przepisów w listach (`/my-recipies`, `/explore`) dla przepisu mojego autorstwa (`is_owner=true`) widoczna jest ikonka reprezentująca `visibility` wraz z tooltipem**. Dla przepisów nie mojego autorstwa ikonka nie jest renderowana. Ikonka ma charakter **wyłącznie informacyjny** (brak zmiany widoczności z poziomu listy).

Zmiana dotyczy:
- `RecipeCardComponent` (`src/app/shared/components/recipe-card/*`) — dodanie prezentacji ikonki widoczności.
- Widoku `/explore` (`ExplorePageComponent`) — przekazanie `visibility` i właściciela do karty.
- Widoku `/my-recipies` (`RecipesListPageComponent`) — przekazanie `visibility` i właściciela do karty.

## 2. Routing widoku

Bez zmian w routingu:
- `/explore` — `ExplorePageComponent`
- `/my-recipies` — `RecipesListPageComponent` (widok „Moje przepisy”)

Zmiana jest czysto prezentacyjna w warstwie list/kart.

## 3. Struktura komponentów

Wysokopoziomowe drzewo po zmianie:

```
ExplorePageComponent (/explore)
 └─ RecipeListComponent (pych-recipe-list)
     └─ RecipeCardComponent (pych-recipe-card)
         ├─ Badge: "Mój przepis" (już jest)
         ├─ Badge: "W moich kolekcjach" (już jest)
         ├─ Badge: "Termorobot" (już jest)
         └─ NOWE: Ikonka widoczności + tooltip (tylko is_owner=true)

RecipesListPageComponent (/my-recipies)
 └─ RecipeListComponent (pych-recipe-list)
     └─ RecipeCardComponent (pych-recipe-card)
         └─ NOWE: Ikonka widoczności + tooltip (tylko is_owner=true)
```

## 4. Szczegóły komponentów

### `pych-recipe-card` (`RecipeCardComponent`)

- **Opis komponentu**: Reużywalna karta przepisu używana w listach prywatnych i publicznych. Po zmianie karta dodatkowo potrafi wyświetlić ikonę widoczności dla przepisu właściciela.
- **Główne elementy**:
    - `mat-card` opakowany w `<a [routerLink]="recipeLink()">` (już jest),
    - overlay w kontenerze obrazka (`.card-image-container`) (już jest),
    - **NOWE**: overlay „indikatora widoczności” (np. `div.visibility-indicator`) z `mat-icon` i `matTooltip`.
- **Obsługiwane zdarzenia**:
    - brak nowych zdarzeń domenowych,
    - tooltip na hover/focus (Material),
    - element nie powinien przechwytywać kliknięcia karty (jeśli będzie `button`, konieczne `preventDefault/stopPropagation`; preferowane: `span/div` z tooltipem bez akcji).
- **Obsługiwana walidacja**:
    - guard: nie renderuj ikonki, jeśli `isOwnRecipe() === false`,
    - guard: nie renderuj ikonki, jeśli `visibility` jest `null/undefined` (defensywnie; w praktyce DTO ma `visibility`).
- **Typy**:
    - `RecipeVisibility` z `shared/contracts/types.ts`,
    - nowe wejście komponentu: `visibility?: RecipeVisibility | null`.
- **Propsy** (nowe i istniejące):
    - `recipe: RecipeCardData` (required, istniejące),
    - `isOwnRecipe: boolean` (istniejące; steruje badge i widocznością ikonki),
    - **NOWE** `visibility: RecipeVisibility | null` (opcjonalne; potrzebne do mapowania ikony i tekstu tooltipa),
    - pozostałe bez zmian (`routeType`, `inMyCollections`, `isTermorobot`, `showRemoveAction`).

**Mapowanie ikon i tooltipów**
- **PRIVATE**:
    - ikona: `lock`
    - tooltip: `Prywatny`
- **SHARED**:
    - ikona: `group` (alternatywnie `groups`)
    - tooltip: `Współdzielony`
- **PUBLIC**:
    - ikona: `public` (alternatywnie `language`)
    - tooltip: `Publiczny`

**A11y**
- Element powinien mieć `aria-label` w rodzaju: `Widoczność przepisu: Publiczny`.
- Jeśli użyty będzie element fokusowalny, musi mieć sensowny focus ring i nie może psuć nawigacji po karcie; rekomendacja: **niefokusowalny `span/div`** + tooltip, albo `button` z `tabindex="-1"` (tylko gdy wymagane).

**Stylowanie**
- Umiejscowienie: overlay w prawym górnym rogu, ale tak, aby nie kolidować z przyciskiem menu akcji (`.card-menu-button`).
    - Jeżeli `showRemoveAction()` jest `true`, wskaźnik widoczności powinien być przesunięty w lewo (np. `right: 48px`).
    - Jeżeli `showRemoveAction()` jest `false`, może być `right: 8px`.
- Tło: użyć tokenów Material (np. `var(--mat-sys-surface)`), bez białych półprzezroczystych overlay.

### `pych-recipe-list` (`RecipeListComponent`)

- **Opis komponentu**: Komponent listy kart. Po zmianie ma umieć przekazać do `pych-recipe-card` dodatkową informację `visibility`.
- **Główne elementy**: bez zmian (grid, empty state, load more/paginator).
- **Obsługiwane zdarzenia**: bez zmian.
- **Obsługiwana walidacja**: bez zmian.
- **Typy**:
    - rozszerzenie `RecipeListItemViewModel` o pole `visibility?: RecipeVisibility | null` (lub `visibility: RecipeVisibility` jeśli zawsze dostępne w tych listach).
- **Propsy**: bez zmian (przekazujemy tylko nowe pole do dziecka w template).

### `pych-explore-page` (`ExplorePageComponent`) — `/explore`

- **Opis komponentu**: Kontener widoku publicznego katalogu. Po zmianie musi przekazać do listy (a dalej do karty) `visibility` oraz wiarygodny `is_owner`.
- **Główne elementy**: bez zmian w UI listy (nadal `pych-recipe-list` z trybem `useLoadMore`).
- **Obsługiwane zdarzenia**: bez zmian.
- **Obsługiwana walidacja**:
    - jak dotąd: `q.length === 1` → nie wysyłaj requestu, ustaw `validationMessage`.
- **Typy**:
    - DTO: `PublicRecipeListItemDto` (zawiera `visibility` i `is_owner`),
    - VM: `RecipeListItemViewModel` (rozszerzony o `visibility`).
- **Zmiana mapowania DTO → VM**:
    - `isOwnRecipe`: preferuj `dto.is_owner` (z API) zamiast porównywania `author.id` do `currentUserId`.
        - Uzasadnienie: API jest źródłem prawdy dla `is_owner`, a dla gościa zawsze zwróci `false`.
        - (Opcjonalnie) zostaw `currentUserId` tylko jako fallback, jeśli `dto.is_owner` byłby `undefined` (nie powinien).
    - `visibility`: ustaw `dto.visibility`.

### `pych-recipes-list-page` (`RecipesListPageComponent`) — `/my-recipies`

- **Opis komponentu**: Kontener widoku „Moje przepisy”. Po zmianie musi przekazać `visibility` do karty.
- **Główne elementy**: bez zmian.
- **Obsługiwane zdarzenia**: bez zmian.
- **Obsługiwana walidacja**:
    - brak nowych; filtry już walidują parametry w serwisie/komponencie.
- **Typy**:
    - DTO: `RecipeListItemDto` (zawiera `visibility` i `is_owner`),
    - VM: `RecipeListItemViewModel` (rozszerzony o `visibility`).
- **Zmiana mapowania DTO → VM**:
    - `isOwnRecipe`: już jest `recipe.is_owner`,
    - `visibility`: dodać `recipe.visibility`.

## 5. Typy

Wykorzystywane DTO (już istnieją w `shared/contracts/types.ts`):
- `RecipeVisibility`
- `RecipeListItemDto` (z `visibility`, `is_owner`)
- `PublicRecipeListItemDto` (z `visibility`, `is_owner`)

Zmiany/nowe typy po stronie frontu:
- **`RecipeListItemViewModel`** (`src/app/shared/components/recipe-list/recipe-list.component.ts`)
    - obecnie:
        - `card: RecipeCardData`
        - `isOwnRecipe?: boolean`
        - `inMyCollections?: boolean`
    - **po zmianie**:
        - `card: RecipeCardData`
        - `isOwnRecipe?: boolean`
        - `inMyCollections?: boolean`
        - **`visibility?: RecipeVisibility | null`**
- **Nowy input w `RecipeCardComponent`**:
    - `visibility = input<RecipeVisibility | null>(null)`

## 6. Zarządzanie stanem

Bez wprowadzania nowego globalnego stanu:
- W widokach (`ExplorePageComponent`, `RecipesListPageComponent`) dodajemy jedynie **dodatkowe pole w mapowaniu** DTO → VM.
- `RecipeCardComponent` trzyma jedynie **pochodne computed**:
    - `visibilityIconName` (mapowanie enum → nazwa ikony),
    - `visibilityTooltip` (enum → tekst PL),
    - `shouldShowVisibilityIndicator` (`isOwnRecipe() && visibility() != null`).

## 7. Integracja API

Brak nowych endpointów. Wykorzystujemy pola już dostępne w istniejących wywołaniach:
- `/my-recipies`:
    - serwis: `RecipesService.getRecipesFeed(...)`
    - response: `CursorPaginatedResponseDto<RecipeListItemDto>`
    - wymagane pola: `recipe.visibility`, `recipe.is_owner`
- `/explore`:
    - serwis: `PublicRecipesService.getPublicRecipesFeed(...)`
    - response: `CursorPaginatedResponseDto<PublicRecipeListItemDto>`
    - wymagane pola: `dto.visibility`, `dto.is_owner`

Weryfikacja po stronie UI:
- ikonka wyłącznie gdy `is_owner === true` (źródło: DTO).

## 8. Interakcje użytkownika

Nowe zachowanie użytkownika:
- **Hover / fokus** na ikonce widoczności (na karcie własnego przepisu) pokazuje tooltip:
    - `Prywatny` / `Współdzielony` / `Publiczny`.

Zachowania bez zmian:
- kliknięcie karty nadal nawiguję do szczegółów (`/recipes/:id` lub `/explore/recipes/:id` zależnie od `routeType`),
- brak akcji zmiany widoczności z listy.

## 9. Warunki i walidacja

Warunki renderowania ikonki:
- `isOwnRecipe() === true`
- `visibility()` jest jedną z wartości `RecipeVisibility` (lub co najmniej nie jest `null/undefined`)

Wpływ na UI:
- dla cudzych przepisów: brak ikonki (bez pozostawiania pustego miejsca),
- dla własnych: ikonka zawsze widoczna, tooltip zgodny z `visibility`.

## 10. Obsługa błędów

Scenariusze i zalecana obsługa:
- **Brak `visibility` w danych** (niezgodność kontraktu / regresja backendu):
    - nie renderować ikonki (guard clause),
    - (opcjonalnie) `console.warn` w trybie dev (bez komunikatu użytkownikowi).
- **Nieznana wartość `visibility`**:
    - fallback: ikona `help` + tooltip `Nieznana` (defensywnie; w TS najlepiej wymusić wyczerpujący switch).

## 11. Kroki implementacji

1. **Rozszerzyć `RecipeCardComponent` o `visibility`**:
    - dodać input `visibility`,
    - dodać `MatTooltipModule` do `imports`,
    - dodać computed mapujące `visibility` na ikonę i tooltip,
    - dodać markup overlay w `recipe-card.html` oraz style w `recipe-card.scss` (bez konfliktu z menu).
2. **Rozszerzyć `RecipeListItemViewModel` o `visibility`** i przekazać je do `pych-recipe-card` w `recipe-list.component.html`.
3. **Zaktualizować mapowanie w `/my-recipies`** (`RecipesListPageComponent`):
    - w `recipeListItems` dopisać `visibility: recipe.visibility`.
4. **Zaktualizować mapowanie w `/explore`** (`ExplorePageComponent`):
    - w `recipeListItems` dopisać `visibility: dto.visibility`,
    - ustawiać `isOwnRecipe` w oparciu o `dto.is_owner` (preferowane), zamiast porównywania `author.id` do `currentUserId`.
5. **Weryfikacja manualna**:
    - `/my-recipies`: dla własnych przepisów ikonka widoczna i tooltip poprawny dla wszystkich 3 wartości,
    - `/explore`: dla gościa ikonka nigdy się nie pojawia; dla zalogowanego pojawia się tylko przy przepisach z `is_owner=true`.
