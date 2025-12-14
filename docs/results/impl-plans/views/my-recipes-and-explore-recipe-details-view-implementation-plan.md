# Plan implementacji zmian widoków: „Moje przepisy” (`/my-recipes`) oraz „Szczegóły przepisu (publiczne / explore)” (`/explore/recipes/:id`)

## 1. Przegląd

Ta zmiana obejmuje dwa obszary routingu i widoków:

- **Lista „Moje przepisy”**
  - docelowa, chroniona ścieżka listy przepisów użytkownika to **`/my-recipes`** (widok w `MainLayoutComponent` z Sidebarem).
  - (opcjonalnie) **`/recipes` jako alias/redirect** wyłącznie dla samej listy (bez wpływu na `/recipes/:id`, `/recipes/:id/edit`, itd.).

- **Szczegóły przepisu (publiczne / explore)**
  - nowa, niechroniona ścieżka szczegółów publicznych to **`/explore/recipes/:id`**, renderowana w layoucie **bez Sidebara**.
  - zasada dostępu: **PUBLIC dla wszystkich**, nie-PUBLIC **wyłącznie dla zalogowanego autora**, w pozostałych przypadkach **404**.
  - widok ma prezentować treść przepisu **merytorycznie tak samo** jak szczegóły prywatne, różni się tylko layoutem i zestawem akcji.

## 2. Routing widoku

### 2.1. Docelowy routing

- **Lista „Moje przepisy”**
  - **Ścieżka:** `/my-recipes`
  - **Layout:** `MainLayoutComponent` (App Shell + Sidebar)
  - **Ochrona:** już zapewniana przez grupę tras z `canMatch: [authenticatedMatchGuard]`
  - **Komponent:** istniejący `RecipesListPageComponent` (lub nowy wrapper, jeśli potrzebne)

- **Alias listy**
  - **Ścieżka:** `/recipes` (tylko dokładnie ten URL)
  - **Zachowanie:** redirect → `/my-recipes`
  - **Ważne:** nie zmienia routingu pod `/recipes/**` (szczegóły/edycja/nowy/import pozostają pod `/recipes/...`).

- **Szczegóły przepisu (publiczne / explore)**
  - **Ścieżka:** `/explore/recipes/:id`
  - **Layout:**
    - gość: `PublicLayoutComponent` (bez Sidebara)
    - zalogowany: `MainLayoutComponent`, ale Sidebar ma być ukryty (trasa zaczyna się od `/explore`)
  - **Ochrona:** brak (dostęp publiczny), autoryzacja jest realizowana przez endpoint „optional auth”.
  - **Komponent:** `ExploreRecipeDetailPageComponent` (nowy, dedykowany dla tej ścieżki)

### 2.2. Zmiany w plikach routingu

- `src/app/app.routes.ts`
  - w grupie zalogowanych (`MainLayoutComponent`):
    - dodać `{ path: 'my-recipes', loadComponent: ...RecipesListPageComponent }`
    - dodać redirect `{ path: 'recipes', pathMatch: 'full', redirectTo: 'my-recipes' }` **przed** istniejącym `{ path: 'recipes', loadChildren: ... }`
    - dodać `{ path: 'explore/recipes/:id', loadComponent: ...ExploreRecipeDetailPageComponent }`
    - utrzymać (opcjonalnie) stary redirect z `explore/recipes/:idslug` → **nowy** `/explore/recipes/:id` (a nie do `/recipes/:id`).
  - w grupie gości (`PublicLayoutComponent`):
    - dodać `{ path: 'explore/recipes/:id', loadComponent: ...ExploreRecipeDetailPageComponent }`
    - (opcjonalnie, dla kompatybilności wstecznej) dodać redirect `{ path: 'recipes/:id', redirectTo: 'explore/recipes/:id' }` aby stare publiczne linki prowadziły do nowej ścieżki.

- `src/app/pages/recipes/recipes.routes.ts`
  - zmienić trasę listy (`path: ''`) na redirect do `/my-recipes` **lub** pozostawić bez zmian, jeśli lista ma zostać tylko jako komponent używany przez `/my-recipes`.
  - rekomendacja: **lista nie powinna być routowalna pod `/recipes`**, aby uniknąć dwóch źródeł prawdy.

## 3. Struktura komponentów

### 3.1. Lista „Moje przepisy”

Widok listy jest już zaimplementowany jako strona w module „recipes”; zmiana dotyczy przede wszystkim **docelowej ścieżki**.

```
MainLayoutComponent
 └─ RouterOutlet
     └─ RecipesListPageComponent  (route: /my-recipes)
         ├─ (filtry, siatka, paginator, empty state)  [istniejące]
         └─ pych-recipe-card (routeType="private")
```

### 3.2. Szczegóły przepisu (publiczne / explore)

```
(PublicLayoutComponent | MainLayoutComponent [sidebar hidden])
 └─ RouterOutlet
     └─ ExploreRecipeDetailPageComponent
         ├─ pych-page-header
         │   ├─ akcje gościa (login/register) lub
         │   ├─ akcje zalogowanego: add-to-collection lub
         │   └─ akcje autora: edit/delete (+ add-to-collection opcjonalnie)
         ├─ pych-recipe-header        (re-use z /recipes/:id)
         ├─ pych-recipe-image         (re-use)
         ├─ pych-recipe-content-list  (Składniki, re-use)
         └─ pych-recipe-content-list  (Kroki, re-use)
```

## 4. Szczegóły komponentów

### 4.1. `RecipesListPageComponent` (istniejący) – użycie pod `/my-recipes`

- **Opis komponentu:** strona listy prywatnych przepisów użytkownika (US-007/US-008/US-009).
- **Główne elementy:** bez zmian względem obecnej implementacji.
- **Obsługiwane interakcje:** bez zmian.
- **Obsługiwana walidacja:** bez zmian.
- **Typy:** bez zmian.
- **Propsy:** brak (komponent routowalny).

**Zmiany wymagane przez ten plan:**
- aktualizacja miejsc nawigacji „powrót do listy” / „po usunięciu” / „po zapisaniu”, aby docelowo prowadziły do **`/my-recipes`** (nie do `/recipes`).

### 4.2. `RecipeCardComponent` – korekta linku w trybie publicznym

- **Opis:** komponent już rozróżnia `routeType` (`private|public`), ale aktualnie link jest zawsze do `/recipes/:id`.
- **Zmiana:** `recipeLink` musi zależeć od `routeType`:
  - `private` → `/recipes/:id`
  - `public` → `/explore/recipes/:id` (zgodnie z nowym routingiem)
- **Walidacja:** brak.
- **Typy:** `RecipeCardData`, `RecipeCardRouteType`.

### 4.3. `ExploreRecipeDetailPageComponent` (nowy)

- **Opis komponentu:** routowalny komponent szczegółów przepisu w kontekście publicznym „Explore” (PRD/US-019/US-024).
- **Główne elementy:**
  - `pych-page-header` z akcjami zależnymi od kontekstu.
  - reużyte komponenty prezentacyjne z `src/app/pages/recipes/recipe-detail/components/*`.
- **Obsługiwane interakcje:**
  - **Gość:** „Zaloguj się” / „Zarejestruj się” z `returnUrl`.
  - **Zalogowany (nie autor):** „Dodaj do kolekcji”.
  - **Zalogowany (autor):** „Edytuj” → `/recipes/:id/edit`, „Usuń” → confirm dialog → `DELETE /recipes/{id}` → redirect do `/my-recipes`.
  - „Wróć do przeglądania” → `/explore`.
- **Obsługiwana walidacja (guard clauses):**
  - `id` musi być dodatnią liczbą całkowitą; w przeciwnym razie stan błędu `400` i CTA powrotu.
  - akcje:
    - `addToCollection` tylko gdy `isAuthenticated && !isOwner`.
    - `edit/delete` tylko gdy `isAuthenticated && isOwner`.
- **Typy:** `ExploreRecipeDetailDto` + lokalny `ExploreRecipeDetailState` (sekcja 5).

### 4.4. `RecipeDetailPageComponent` (istniejący, prywatny) – dopasowanie do nowych zasad

Aktualny komponent ma logikę „unifikacji” (próba prywatnego API + fallback do publicznego). To jest sprzeczne z nowym wymaganiem:
- **`/recipes/:id` ma być chronione i tylko dla autora** (a nie „public fallback”).

**Rekomendacja:**
- uprościć `RecipeDetailPageComponent`, aby **zawsze** pobierał dane przez `RecipesService.getRecipeById` i wyświetlał błąd `403/404` bez przełączania się na publiczne API.
- pełny wariant „public/explore” przenieść do `ExploreRecipeDetailPageComponent`.

## 5. Typy

### 5.1. DTO istniejące

Z `shared/contracts/types.ts`:
- `RecipeListItemDto`
- `RecipeDetailDto`
- `PaginatedResponseDto<T>`
- `ApiError`
- `RecipeVisibility`

### 5.2. Nowe / doprecyzowane DTO

- **`ExploreRecipeDetailDto`**
  - rekomendacja: alias do `RecipeDetailDto`, jeśli backend faktycznie zwraca tę samą strukturę.
  - jeśli endpoint `/explore/recipes/{id}` zwraca dodatkowe pole (np. `author: ProfileDto`) – należy zaktualizować kontrakt w `shared/contracts/types.ts` i konsekwentnie użyć go w komponencie.

### 5.3. ViewModel / stan komponentu

- `ExploreRecipeDetailState` (lokalnie w `ExploreRecipeDetailPageComponent`):
  - `recipe: ExploreRecipeDetailDto | null`
  - `isLoading: boolean`
  - `error: ApiError | null`

## 6. Zarządzanie stanem

### 6.1. `/my-recipes`

Bez zmian – stan listy pozostaje zarządzany lokalnie (signals), zgodnie z aktualną implementacją i zasadą „keep previous data visible”.

### 6.2. `/explore/recipes/:id`

`ExploreRecipeDetailPageComponent`:
- `state = signal<ExploreRecipeDetailState>({ recipe: null, isLoading: true, error: null })`
- `isAuthenticated = signal<boolean>(false)`
- `currentUserId = signal<string | null>(null)`
- `isOwner = computed(() => recipe()?.user_id === currentUserId())` (lub po `author.id`, jeśli takie pole istnieje)

Zalecenie UX (zgodne z regułami projektu):
- podczas ponownego pobierania używać `state.update()` i nie czyścić poprzednich danych „na biało”.

## 7. Integracja API

### 7.1. Lista prywatnych przepisów

- **Endpoint:** `GET /recipes`
- **Serwis:** `RecipesService.getRecipes(params)`
- **Response:** `PaginatedResponseDto<RecipeListItemDto>`

### 7.2. Szczegóły prywatne (autor)

- **Endpoint:** `GET /recipes/{id}`
- **Serwis:** `RecipesService.getRecipeById(id)`
- **Response:** `RecipeDetailDto`
- **Zachowanie:** dla nie-autora `403` lub `404` (zależnie od backendu); UI obsługuje jako brak dostępu.

### 7.3. Szczegóły explore (PUBLIC lub autor)

- **Endpoint:** `GET /explore/recipes/{id}`
- **Auth:** opcjonalny (token jest wysyłany automatycznie, jeśli istnieje sesja)
- **Serwis (nowy):** `ExploreRecipesService.getExploreRecipeById(id)`
  - implementacja analogiczna do `PublicRecipesService`, ale endpoint: `explore/recipes/${id}`
  - błędy muszą propagować status (szczególnie `404`).
- **Response:** `ExploreRecipeDetailDto`

## 8. Interakcje użytkownika

- **Zalogowany wchodzi na `/my-recipes`:** widzi listę swoich przepisów; kliknięcie karty → `/recipes/:id`.
- **Gość / zalogowany wchodzi na `/explore`:** widzi listę publicznych przepisów; kliknięcie karty → `/explore/recipes/:id`.
- **Gość na `/explore/recipes/:id`:**
  - dla PUBLIC: widzi treść, CTA do logowania/rejestracji,
  - dla nie-PUBLIC: widzi 404.
- **Zalogowany nie-autor na `/explore/recipes/:id`:**
  - dla PUBLIC: widzi treść + akcję „Dodaj do kolekcji”,
  - dla nie-PUBLIC: widzi 404.
- **Zalogowany autor na `/explore/recipes/:id`:**
  - widzi treść (także dla PRIVATE/SHARED) + akcje właściciela (Edytuj/Usuń).

## 9. Warunki i walidacja

- **Routing:**
  - `/recipes` (dokładnie) → redirect do `/my-recipes`.
  - `/recipes/:id` pozostaje prywatne (nie jest „publicznym” URL).
- **Dostęp do `/explore/recipes/:id`:**
  - `visibility === PUBLIC` → 200 dla wszystkich.
  - `visibility !== PUBLIC` → 200 tylko dla autora (zalogowanego);
  - w pozostałych przypadkach → 404 (bez ujawniania istnienia zasobu).
- **Walidacja parametru `id`:**
  - `id` musi być liczbą całkowitą `> 0`.

## 10. Obsługa błędów

- **`/my-recipes`:** bez zmian względem aktualnej implementacji.

- **`/explore/recipes/:id`:**
  - **400 (nieprawidłowe ID):** komunikat + przycisk „Wróć do przeglądania”.
  - **404:** komunikat „Nie znaleziono przepisu” + powrót do `/explore`.
  - **5xx / sieć:** komunikat ogólny + „Spróbuj ponownie”.
  - **Błędy akcji (Dodaj do kolekcji / Usuń):** snackbar z czytelnym komunikatem; nie aktualizować UI „na siłę”.

## 11. Kroki implementacji

1. **Routing – `/my-recipes`:**
   - dodać trasę `/my-recipes` w `src/app/app.routes.ts` wskazującą na `RecipesListPageComponent`.

2. **Routing – redirect `/recipes` → `/my-recipes`:**
   - dodać trasę `path: 'recipes', pathMatch: 'full', redirectTo: 'my-recipes'` przed `loadChildren` dla `recipes`.

3. **Sidebar / App Shell:**
   - zaktualizować `src/app/layout/main-layout/main-layout.component.ts` (`PRIVATE_PATHS`) o `'/my-recipes'`.
   - zaktualizować `src/app/layout/main-layout/components/sidebar/sidebar.component.ts`:
     - zmienić route elementu „Przepisy/Moje przepisy” na `'/my-recipes'`.

4. **Routing – `/explore/recipes/:id`:**
   - dodać trasę w obu grupach (authenticated + guest) do nowego komponentu `ExploreRecipeDetailPageComponent`.
   - zmienić istniejący redirect `explore/recipes/:idslug` tak, aby kierował do `/explore/recipes/:id` (opcjonalnie pozostawić dla wstecznej kompatybilności).
   - (opcjonalnie) dodać redirect `recipes/:id` → `explore/recipes/:id` w grupie gościa.

5. **Nowy serwis danych dla explore:**
   - dodać `src/app/core/services/explore-recipes.service.ts` z metodą `getExploreRecipeById(id)` wywołującą `supabase.functions.invoke('explore/recipes/${id}', { method: 'GET' })`.

6. **Nowy komponent strony szczegółów explore:**
   - utworzyć `src/app/pages/explore/explore-recipe-detail/` z `ExploreRecipeDetailPageComponent`.
   - reużyć komponenty prezentacyjne z `src/app/pages/recipes/recipe-detail/components/*`.

7. **Korekta `RecipeCardComponent`:**
   - zaktualizować `src/app/shared/components/recipe-card/recipe-card.ts`, aby dla `routeType="public"` link prowadził do `/explore/recipes/:id`.

8. **Dopasowanie prywatnych szczegółów (`/recipes/:id`):**
   - usunąć/finalnie wyłączyć fallback do `PublicRecipesService` w `RecipeDetailPageComponent` i traktować brak dostępu jako błąd prywatny.

9. **Weryfikacja kryteriów akceptacji (manualnie):**
   - `/my-recipes` dostępne po zalogowaniu, Sidebar widoczny.
   - `/recipes` przekierowuje do `/my-recipes`, ale `/recipes/:id` działa jak wcześniej (prywatnie).
   - `/explore/recipes/:id` działa bez Sidebara i respektuje regułę „PUBLIC lub autor; inaczej 404”.
