# Plan implementacji widoku Explore (wariant zalogowanego: badge „Twój przepis”)

## 1. Przegląd
Celem zmiany jest dostosowanie widoku **Publiczny katalog przepisów (Explore)** (`/explore`) w trybie zalogowanego tak, aby na kartach przepisów wyświetlać czytelne oznaczenie **„Twój przepis”** dla rekordów, których autorem jest aktualnie zalogowany użytkownik.

- Zakres treści pozostaje **bez zmian**: widok nadal prezentuje **wyłącznie** przepisy o widoczności `PUBLIC`.
- Oznaczenie jest widoczne **tylko** dla użytkownika zalogowanego.
- Oznaczenie ma być czytelne, ale **nie dominujące** na karcie.

Zmiana realizuje **US-022**.

## 2. Routing widoku
- **Ścieżka:** `/explore`
- **Wymaganie:** ta sama ścieżka działa dla gościa i zalogowanego, ale jest osadzona w innym layoucie:
  - gość: `PublicLayoutComponent`
  - zalogowany: `MainLayoutComponent` (App Shell)

W projekcie routing jest już rozdzielony poprzez `canMatch`:
- `authenticatedMatchGuard` → grupa tras publicznych w `MainLayoutComponent`
- `guestOnlyMatchGuard` → grupa tras publicznych w `PublicLayoutComponent`

**Wniosek:** zmiana dotyczy głównie implementacji komponentu `/explore` i komponentu karty przepisu.

## 3. Struktura komponentów
Aktualna struktura (re-use):

```
MainLayoutComponent (dla zalogowanego)
└─ RouterOutlet
   └─ ExplorePageComponent
      ├─ PublicRecipesSearchComponent
      ├─ RecipeCardComponent (siatka)
      ├─ EmptyStateComponent
      └─ mat-paginator
```

Zmiana strukturalna nie jest wymagana; dodajemy tylko dane i render badge.

## 4. Szczegóły komponentów

### `pych-explore-page` (`ExplorePageComponent`)
- **Opis komponentu:** Kontener widoku. Pobiera listę publicznych przepisów z `PublicRecipesService`, zarządza query params (q/page/limit/sort), renderuje stany UI, a w trybie zalogowanego oznacza własne przepisy.

- **Główne elementy:**
  - `pych-public-recipes-search` z `initialQuery`
  - siatka `pych-recipe-card` (`routeType="public"`)
  - `pych-empty-state`
  - `mat-paginator`

- **Obsługiwane zdarzenia:**
  - `searchSubmit(query: string)` → aktualizacja query params (reset `page=1`)
  - `mat-paginator (page: PageEvent)` → aktualizacja `page/limit`
  - `retry` (dla błędu pobierania)

- **Obsługiwana walidacja:**
  - **`q`**: jeśli po `trim` ma długość `1`, nie wywoływać API i pokazać komunikat „Wpisz co najmniej 2 znaki” (zgodnie z API).
  - **`page`**: fallback do `1` gdy brak/niepoprawne lub `< 1`.
  - **`limit`**: whitelist `[12, 24, 48]`.
  - **`sort`**: whitelist dozwolonych wartości.

- **Typy (DTO i ViewModel):**
  - DTO: `PaginatedResponseDto<PublicRecipeListItemDto>`
  - VM (zalecane):
    - `ExploreQueryState` (już istnieje)
    - `ExplorePageState` (zalecana modyfikacja – patrz „Typy”): przechowywać listę DTO z `author`, aby móc wyliczać `isOwnRecipe` także wtedy, gdy `currentUserId` pojawi się później.

- **Propsy:** brak.

- **Implementacja badge (logika):**
  - Dodać sygnał `currentUserId: Signal<string | null>`.
  - W trybie zalogowanego (`MainLayoutComponent`) `currentUserId` ustalić z Supabase Auth (np. `AuthService.getSession()` → `session?.user?.id ?? null`).
  - Na podstawie `dto.author.id === currentUserId()` wyliczyć `isOwnRecipe`.
  - Badge przekazać do `RecipeCardComponent` jako input (np. `isOwnRecipe`).


### `pych-recipe-card` (`RecipeCardComponent`)
- **Opis komponentu:** Współdzielona karta przepisu (prywatna/publiczna). W kontekście `/explore` renderuje link do `/explore/recipes/:id-:slug`.

- **Zmiana:** dodać opcjonalną obsługę badge „Twój przepis”.

- **Główne elementy (po zmianie):**
  - `mat-card` z kontenerem obrazka
  - (nowe) element badge w rogu obrazka lub w treści karty (preferowane: w kontenerze obrazka, top-left)

- **Obsługiwane zdarzenia:** bez zmian.

- **Obsługiwana walidacja:** bez zmian.

- **Typy:**
  - bez zmian w DTO
  - zalecane: nie wymuszać zmian w `RecipeCardData` (badge jako osobny input), albo rozszerzyć `RecipeCardData` o pole opcjonalne.

- **Propsy (zalecane):**
  - `recipe: RecipeCardData` (bez zmian)
  - `routeType?: 'private' | 'public'` (bez zmian)
  - **nowe:** `isOwnRecipe?: boolean` (domyślnie `false`) lub `badgeText?: string | null`

- **Wymogi UX:**
  - badge ma być widoczny, ale nienachalny (np. mały chip/etykieta)
  - nie może zasłaniać kluczowych elementów (nazwa, zdjęcie)

- **Dostępność:**
  - jeśli badge jest elementem tekstowym, powinien być czytelny dla screen readerów (np. zwykły tekst w DOM; opcjonalnie `aria-label`).


### (Opcjonalnie) `CurrentUserService` / rozbudowa `AuthService`
Jeśli w aplikacji pojawi się więcej miejsc wymagających „kim jestem”, warto wprowadzić singleton:
- sygnał `currentUserId` + ewentualnie `ProfileDto` z `GET /me`.

Dla tej zmiany minimalnie wystarczy **ID użytkownika** z sesji Supabase.

## 5. Typy

### Wykorzystywane typy istniejące
Z `shared/contracts/types.ts`:
- `PublicRecipeListItemDto` (zawiera `author: ProfileDto`)
- `ProfileDto` (zawiera `id`, `username`)
- `PaginatedResponseDto<T>`
- `PaginationDetails`

### Zalecane typy ViewModel / zmiany lokalne
Aby implementacja była odporna na kolejność ładowania (najpierw lista, potem `currentUserId`):

- Zmienić `ExplorePageState` tak, by przechowywał **surowe DTO** zamiast wyłącznie `RecipeCardData[]`, np.:
  - `items: PublicRecipeListItemDto[]`
  - (opcjonalnie) `cards: RecipeCardData[]` jako `computed` zamiast pola stanu

- Dodać model pomocniczy (jeśli nie chcemy modyfikować `RecipeCardData`):
  - `ExploreRecipeCardVm = { card: RecipeCardData; isOwnRecipe: boolean }`

Jeżeli zdecydujemy się rozszerzyć `RecipeCardData` (opcjonalnie):
- `isOwnRecipe?: boolean` (domyślnie `undefined/false`)

## 6. Zarządzanie stanem
- Kontynuować podejście oparte o **signals** i zasadę **keep previous data visible**.
- W `ExplorePageComponent`:
  - `queryState` (już istnieje)
  - `pageState` (zalecana zmiana na przechowywanie `items: PublicRecipeListItemDto[]`)
  - `currentUserId: signal<string | null>`
  - `cards: computed(...)` wyliczające model kart + `isOwnRecipe`

Zalecenie UX:
- podczas przeładowań ustawiaj `isLoading=true` bez czyszczenia poprzednich danych.

## 7. Integracja API

### Lista publicznych przepisów
- **Endpoint:** `GET /public/recipes`
- **Request (query params):** `page`, `limit`, `sort`, `q`
- **Response:** `PaginatedResponseDto<PublicRecipeListItemDto>`
- **Klucz do US-022:** `PublicRecipeListItemDto.author.id` jest niezbędne do porównania z tożsamością użytkownika.

### Tożsamość zalogowanego (dla porównania autora)
Dozwolone i rekomendowane minimum:
- **Supabase Auth**: `AuthService.getSession()` → `session.user.id`

Alternatywa (jeśli projekt ujednolica „current user” przez API):
- `GET /me` → `ProfileDto` (wymaga JWT; Edge Function)

Dla tej zmiany wystarczy ID z sesji.

## 8. Interakcje użytkownika
- **Zalogowany wchodzi na `/explore`**:
  - widzi listę publicznych przepisów
  - na kartach przepisów, których jest autorem, widzi badge **„Twój przepis”**

- **Gość wchodzi na `/explore`**:
  - widzi listę publicznych przepisów
  - nie widzi żadnych badge „Twój przepis”

- **Wyszukiwanie / paginacja**:
  - bez zmian w zachowaniu; badge powinien aktualizować się wraz z wynikami.

## 9. Warunki i walidacja
- **Warunek domenowy (PRD/UI):** widok publiczny zawsze pokazuje tylko `PUBLIC`.
- **Warunek API:** jeśli `q` jest podane, musi mieć min. 2 znaki → UI waliduje.
- **Warunek badge:**
  - badge renderować wyłącznie gdy:
    - istnieje `currentUserId` (użytkownik zalogowany), oraz
    - `dto.author.id === currentUserId`

## 10. Obsługa błędów
- **Błąd pobierania listy (`GET /public/recipes`)**:
  - utrzymać dotychczasowy komunikat i akcję retry.
- **Nie udało się odczytać sesji / userId**:
  - traktować jak brak `currentUserId` → badge nie jest renderowany (bez wpływu na listę).
- **`q.length === 1` (walidacja)**:
  - brak requestu, komunikat walidacyjny.

## 11. Kroki implementacji
1. W `ExplorePageComponent` dodać ustalanie `currentUserId`:
   - w trybie zalogowanego pobrać `session.user.id` (np. przez `AuthService.getSession()`), zapisać do `signal`.
2. Zaktualizować model stanu `/explore` tak, by zachować `author` z DTO:
   - zmienić `ExplorePageState.recipes: RecipeCardData[]` na `items: PublicRecipeListItemDto[]` (lub dodać `items` obok istniejącego pola).
3. Dodać `computed` mapujące `items` → widok kart (z informacją `isOwnRecipe`).
4. Rozszerzyć `RecipeCardComponent` o opcjonalny input `isOwnRecipe` (lub `badgeText`).
5. Zaimplementować render badge w `recipe-card.html`:
   - widoczny tylko gdy `isOwnRecipe === true`
   - styl nienachalny (np. mała etykieta/chip w rogu obrazka)
6. Zaktualizować `explore-page.component.html`, by przekazywać `isOwnRecipe` do `pych-recipe-card`.
7. Zweryfikować UX:
   - badge nie dominuje
   - brak „flashowania” danych podczas ładowania
   - brak badge dla gościa
8. (Opcjonalnie) Dodać test jednostkowy dla funkcji wyliczania `isOwnRecipe` oraz dla scenariusza „userId pojawia się po wczytaniu listy” (badge aktualizuje się bez refetch).
