# Plan implementacji zmiany widoku: „Dodaj do planu” na szczegółach przepisu

## 1. Przegląd
Celem zmiany jest dodanie na widoku szczegółów przepisu (`/recipes/:id` oraz `/explore/recipes/:id`) nowej akcji **„Dodaj do planu”** dla użytkownika zalogowanego, obok istniejącej akcji **„Dodaj do kolekcji”**.

Wymagane zachowanie (US-038):
- przycisk ma stany: **„Dodaj do planu” → spinner → „Zobacz listę”** (z ikoną sukcesu),
- jeśli przepis już jest w planie (`in_my_plan = true`), to przycisk od razu ma stan **„Zobacz listę”**,
- API zapewnia brak duplikatów oraz limit **50** elementów; UI ma pokazać czytelny błąd przy próbie dodania ponad limit.

W aktualnym kodzie:
- stronami są `RecipeDetailPageComponent` (`/recipes/:id`) i `ExploreRecipeDetailPageComponent` (`/explore/recipes/:id`),
- oba renderują wspólny widok `RecipeDetailViewComponent`, który zawiera `pych-page-header` i warunkowo renderuje akcje nagłówka zależnie od `headerMode`,
- w froncie nie ma jeszcze klienta API dla zasobu „Mój plan” (brak serwisu i brak wywołań `/plan`).

## 2. Routing widoku
Zmiana dotyczy istniejących tras:
- **Prywatnie**: `/recipes/:id` (strona `RecipeDetailPageComponent`)
- **Publicznie (Explore)**: `/explore/recipes/:id` (strona `ExploreRecipeDetailPageComponent`)

Nie dodajemy nowej trasy dla „Mojego planu” (drawer jest globalny, bez osobnej trasy routingu).

## 3. Struktura komponentów
Aktualne drzewo (uproszczone) i miejsca zmian:

```
RecipeDetailPageComponent (/recipes/:id)
└── RecipeDetailViewComponent (shared)
    ├── PageHeaderComponent (pych-page-header)  ← tutaj dodajemy przycisk planu
    ├── RecipeHeaderComponent
    ├── RecipeImageComponent
    └── RecipeContentListComponent (x2)

ExploreRecipeDetailPageComponent (/explore/recipes/:id)
└── RecipeDetailViewComponent (shared)
    ├── PageHeaderComponent (pych-page-header)  ← tutaj dodajemy przycisk planu
    ├── ...
```

Dodatkowo (współdzielone, globalne – integracja):

```
App Shell / Layout
└── MyPlanDrawerComponent (globalny drawer)  ← docelowo otwierany po „Zobacz listę”
```

Uwaga: wdrożenie samego drawer’a może być osobnym taskiem (US-039). W ramach tej zmiany musimy jednak zdefiniować i użyć **jednego, stabilnego kontraktu** do otwierania drawer’a, np. `MyPlanService.openDrawer()`.

## 4. Szczegóły komponentów

### `RecipeDetailViewComponent` (`src/app/shared/components/recipe-detail-view/recipe-detail-view.component.*`)
- **Opis komponentu**: współdzielony widok treści przepisu (loading/error/success) + nagłówek strony (Page Header) z akcjami zależnymi od `headerMode`.
- **Zmiany**:
    - dodać przycisk **„Dodaj do planu” / „Zobacz listę”** w nagłówku dla wszystkich zalogowanych trybów, w których nagłówek jest widoczny:
        - `headerMode = 'ownerActions'` (ikony akcji),
        - `headerMode = 'addToCollection'` (przyciski tekstowe).
    - dodać obsługę stanu ładowania (spinner) dla dodawania do planu.

- **Główne elementy**:
    - `pych-page-header` (slot na akcje),
    - `button mat-raised-button` lub `button mat-icon-button` zależnie od trybu.

- **Obsługiwane zdarzenia (nowe/zmienione)**:
    - **Nowe**: `addToPlan` (kliknięcie „Dodaj do planu”)
    - **Nowe**: `openPlan` (kliknięcie „Zobacz listę”)

- **Warunki walidacji (UI)**:
    - przycisk „Dodaj do planu” widoczny tylko gdy:
        - użytkownik jest zalogowany (`isAuthenticated = true`),
        - przepis jest załadowany (`recipe != null`),
        - przepis **nie** jest już w planie (`recipe.in_my_plan === false`),
        - nie trwa dodawanie (`isAddingToPlan === false`).
    - podczas dodawania:
        - przycisk jest `disabled`,
        - etykieta zastąpiona spinnerem (zgodnie z US-038).
    - przycisk „Zobacz listę” widoczny gdy:
        - użytkownik zalogowany,
        - przepis w planie (`recipe.in_my_plan === true`) **lub** dodanie zakończyło się sukcesem i zaktualizowano `recipe.in_my_plan`.

- **Typy**:
    - `RecipeDetailDto` (pole `in_my_plan` jako źródło prawdy stanu)

- **Nowe propsy (inputs)**:
    - `isAddingToPlan: boolean` – kontrola spinnera i `disabled` (wejściowo z kontenera strony)

- **Nowe outputy**:
    - `addToPlan: void`
    - `openPlan: void`

- **Kontrakt komponentu (propozycja interfejsu)**:
    - Inputs:
        - `recipe`, `isLoading`, `error`, `isAuthenticated`, `isOwner`, `headerMode`, `pageTitle` (bez zmian)
        - `isAddingToPlan` (nowe)
    - Outputs:
        - `addToCollection`, `edit`, `delete`, `back`, `login`, `register` (bez zmian)
        - `addToPlan`, `openPlan` (nowe)

### `RecipeDetailPageComponent` (`src/app/pages/recipes/recipe-detail/recipe-detail-page.component.*`)
- **Opis komponentu**: strona prywatnych szczegółów przepisu (`/recipes/:id`) – ładuje `RecipeDetailDto` i przekazuje do `RecipeDetailViewComponent`. Obecnie obsługuje: edycję, usuwanie, dodanie do kolekcji.

- **Zmiany**:
    - dodać stan lokalny `isAddingToPlan` (signal),
    - dodać obsługę zdarzeń z `RecipeDetailViewComponent`:
        - `(addToPlan)="onAddToPlan()"`,
        - `(openPlan)="onOpenPlan()"`.
    - po sukcesie dodania do planu:
        - zaktualizować `state.recipe.in_my_plan = true` przy użyciu `state.update(...)` (zgodnie z zasadą: **`state.update()` zamiast `state.set()`**),
        - przełączyć przycisk w tryb „Zobacz listę” (wynika z `in_my_plan`),
        - opcjonalnie od razu otworzyć drawer (decyzja UX; wymaganie mówi, że kliknięcie „Zobacz listę” ma otworzyć drawer, nie że ma się otwierać automatycznie).

- **Obsługiwane zdarzenia (nowe)**:
    - `onAddToPlan()` – wywołanie API `POST /plan/recipes`
    - `onOpenPlan()` – otwarcie drawer’a (np. `myPlanService.openDrawer()`)

- **Warunki walidacji**:
    - guard clauses:
        - brak przepisu / brak ID → return,
        - `isAuthenticated = false` → return (w praktyce ta strona jest prywatna, ale kod ma być odporny),
        - `recipe.in_my_plan = true` → traktuj klik „Dodaj…” jako no-op (lub od razu otwórz drawer).

- **Typy**:
    - `RecipeDetailDto`
    - `AddRecipeToPlanCommand` (z `shared/contracts/types.ts`)
    - błędy: `ApiError` + lokalny typ błędu z `status?: number` (spójnie z innymi serwisami)

### `ExploreRecipeDetailPageComponent` (`src/app/pages/explore/explore-recipe-detail/explore-recipe-detail-page.component.*`)
- **Opis komponentu**: strona szczegółów w kontekście Explore (`/explore/recipes/:id`) z opcjonalnym uwierzytelnieniem.

- **Zmiany**:
    - analogicznie do `RecipeDetailPageComponent`:
        - dodać `isAddingToPlan` (signal),
        - dodać obsługę `(addToPlan)` i `(openPlan)`,
        - po sukcesie dodania: `recipe.in_my_plan = true` przez `state.update(...)`.

- **Warunki walidacji**:
    - jeśli użytkownik jest gościem:
        - Page Header jest ukryty (`showPageHeader = isAuthenticated()`), więc akcji planu nie renderujemy.
        - kliknięcia w plan nie występują (brak przycisku).

### `MyPlanService` (nowy) (`src/app/core/services/my-plan.service.ts`)
- **Opis serwisu**: warstwa komunikacji z API planu + źródło stanu UI (otwarcie drawer’a).

- **Wymagania architektoniczne**:
    - używać wyłącznie `supabase.functions.invoke(...)` (zgodnie z regułą: frontend nie używa `supabase.from(...)`),
    - używać `inject(...)`, bez constructor injection,
    - API musi mapować statusy (409/422) na czytelną obsługę UI.

- **Publiczne API serwisu (propozycja)**:
    - `getPlan(): Observable<GetPlanResponseDto>`
    - `addToPlan(command: AddRecipeToPlanCommand): Observable<void>`
    - `removeFromPlan(recipeId: number): Observable<void>`
    - `clearPlan(): Observable<void>`
    - `readonly isDrawerOpen = signal<boolean>(false)`
    - `openDrawer(): void`
    - `closeDrawer(): void`

- **Walidacja danych wejściowych**:
    - `addToPlan`:
        - `recipe_id` musi być liczbą całkowitą `> 0` (guard clause),
        - w przypadku błędu walidacji → rzucić `Error` z czytelnym komunikatem (bez wywołania API).

- **Mapowanie błędów (HTTP status)**:
    - `401` → sesja wygasła / brak autoryzacji: komunikat „Zaloguj się ponownie”.
    - `403` → brak dostępu do przepisu.
    - `404` → przepis nie istnieje (lub brak dostępu).
    - `409` → duplikat:
        - UI może potraktować jako stan „już w planie” i przełączyć przycisk na „Zobacz listę”.
    - `422` → limit planu 50:
        - UI pokazuje czytelny komunikat: „Plan ma już 50 przepisów. Usuń coś z planu i spróbuj ponownie.”
    - `5xx` → błąd techniczny: „Nie udało się dodać do planu. Spróbuj ponownie.”

## 5. Typy
Wykorzystujemy istniejące typy z `shared/contracts/types.ts`:
- **`AddRecipeToPlanCommand`**:
    - `recipe_id: number`
- **`GetPlanResponseDto`**:
    - `data: PlanListItemDto[]`
    - `meta: { total: number; limit: 50 }`
- **`PlanListItemDto`**:
    - `recipe_id: number`
    - `added_at: string`
    - `recipe: { id: number; name: string; image_path: string | null }`

Nowe typy ViewModel (propozycja – lokalnie w stronach szczegółów):
- **`AddToPlanUiState`** (union):
    - `'idle' | 'loading'`
    - (stan „success” wynika z `recipe.in_my_plan === true`; nie przechowujemy go osobno)

## 6. Zarządzanie stanem
Podejście: **signals** w komponentach stron + serwis dla komunikacji i stanu globalnego drawer’a.

### Stan w `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent`
- `isAddingToPlan = signal<boolean>(false)` – kontrola spinnera i blokady akcji.
- Aktualny stan „czy w planie” pochodzi z `RecipeDetailDto.in_my_plan`.

Algorytm stanu przycisku:
- jeśli `isAddingToPlan === true` → renderuj spinner i `disabled`,
- else jeśli `recipe.in_my_plan === true` → renderuj „Zobacz listę”,
- else → renderuj „Dodaj do planu”.

### Stan globalny
- `MyPlanService.isDrawerOpen` – pojedyncze źródło prawdy do otwarcia drawer’a z dowolnego miejsca (szczegóły przepisu, FAB).

## 7. Integracja API
Wymagane wywołanie dla US-038:

### Dodanie przepisu do planu
- **Endpoint**: `POST /plan/recipes`
- **Warstwa w froncie**: Supabase Edge Function przez `supabase.functions.invoke`
- **Request body**: `AddRecipeToPlanCommand`
    - `{ "recipe_id": number }`
- **Response**: `201 Created` (payload może być `{ message: string }` – UI nie musi go używać)

### Stan początkowy (już w planie)
- **Źródło**: helper field `in_my_plan` w `RecipeDetailDto` zwracanym przez:
    - `GET /recipes/{id}` (prywatnie)
    - `GET /public/recipes/{id}` lub `GET /explore/recipes/{id}` (publicznie z opcjonalnym auth)

UI nie robi osobnego `GET /plan` tylko po to, żeby ustawić przycisk – pole `in_my_plan` ma wystarczyć.

## 8. Interakcje użytkownika

### 8.1. Zalogowany użytkownik, przepis nie jest w planie
- **Akcja**: klik „Dodaj do planu”
- **Efekt UI**:
    - przycisk przechodzi w spinner, klik jest zablokowany,
    - po sukcesie: przycisk zmienia się na „Zobacz listę” (ikona sukcesu).
- **Efekt danych**:
    - wywołanie `POST /plan/recipes`,
    - po sukcesie `recipe.in_my_plan = true` w stanie strony.

### 8.2. Zalogowany użytkownik, przepis już jest w planie
- **Akcja**: klik „Zobacz listę”
- **Efekt UI**: otwarcie drawer’a „Mój plan” z prawej strony (globalny komponent).
- **Efekt danych**: brak wywołania API w tym miejscu (drawer sam pobiera listę w razie potrzeby).

### 8.3. Gość (Explore)
- **Akcja**: brak przycisku w Page Header (nagłówek jest ukryty, a CTA na dole pozostaje bez zmian).

## 9. Warunki i walidacja

### Warunki wynikające z API (konieczne w UI)
- **Unikalność**:
    - API może zwrócić `409 Conflict` jeśli przepis już jest w planie.
    - UI: pokaż „Już w Twoim planie” (Snackbar) i ustaw `in_my_plan = true` lokalnie (żeby stan UI był spójny).

- **Limit 50**:
    - API zwraca `422 Unprocessable Entity`.
    - UI: pokaż komunikat (Snackbar) „Plan ma już 50 przepisów…”.
    - UI nie przełącza przycisku w „Zobacz listę”.

### Warunki bezpieczeństwa / dostępu
- `401` (brak sesji / wygasła) → komunikat + opcjonalnie przekierowanie do `/login` z `returnUrl`.
- `403` / `404` → komunikat „Nie masz dostępu do tego przepisu”.

## 10. Obsługa błędów
Scenariusze i obsługa:
- **Błąd sieci / timeout**: Snackbar „Nie udało się dodać do planu. Spróbuj ponownie.”, przycisk wraca do stanu „Dodaj do planu”.
- **401**: Snackbar „Sesja wygasła. Zaloguj się ponownie.” + (opcjonalnie) nawigacja do `/login`.
- **409**: Snackbar „Ten przepis jest już w Twoim planie.” + przełączenie na „Zobacz listę”.
- **422**: Snackbar „Plan ma już 50 przepisów…” + pozostanie na „Dodaj do planu”.
- **Nieoczekiwany błąd**: log do `console.error` + generyczny Snackbar.

Ważne: po błędzie zawsze zdejmujemy `isAddingToPlan` w `finalize`/`try/finally`, żeby UI nie utkwił w spinnerze.

## 11. Kroki implementacji
1. **Rozszerz `RecipeDetailViewComponent`**:
    - dodaj input `isAddingToPlan`,
    - dodaj outputy `addToPlan` i `openPlan`,
    - w template dodaj przycisk/ikonkę w trybach `ownerActions` i `addToCollection`:
        - „Dodaj do planu” (gdy `recipe.in_my_plan === false`),
        - spinner (gdy `isAddingToPlan === true`),
        - „Zobacz listę” (gdy `recipe.in_my_plan === true`).
2. **Dodaj `MyPlanService` w `src/app/core/services/`**:
    - implementuj `addToPlan(...)` przez `supabase.functions.invoke('plan/recipes', { method: 'POST', body })`,
    - zmapuj statusy na błędy z `status`,
    - dodaj `openDrawer()/closeDrawer()` i `isDrawerOpen` (signal) jako kontrakt integracyjny.
3. **Zintegruj stronę prywatną** (`RecipeDetailPageComponent`):
    - dodaj `isAddingToPlan`,
    - dodaj `onAddToPlan()` (wywołanie serwisu + update `state.recipe.in_my_plan`),
    - dodaj `onOpenPlan()` (wywołanie `myPlanService.openDrawer()`),
    - podepnij nowe outputy w HTML strony.
4. **Zintegruj stronę explore** (`ExploreRecipeDetailPageComponent`) analogicznie:
    - te same kroki, bez zmian w zachowaniu dla gościa (przycisk i tak się nie renderuje).
5. **UX dopracowanie**:
    - dodaj tooltipy i aria-label zgodnie z użyciem w pozostałych akcjach,
    - upewnij się, że przycisk jest stabilny wizualnie (brak „skakania” layoutu) i nie wprowadza białych overlayów w loading state.
6. **Testy manualne (minimum)**:
    - zalogowany: dodanie przepisu, który nie jest w planie → spinner → „Zobacz listę”,
    - zalogowany: wejście w przepis już w planie (`in_my_plan = true`) → od razu „Zobacz listę”,
    - limit 50: API zwraca 422 → czytelny komunikat, brak zmiany stanu przycisku,
    - duplikat 409 → komunikat „już w planie”, stan „Zobacz listę”.


