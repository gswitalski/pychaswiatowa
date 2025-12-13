# Plan implementacji widoku Publiczny katalog przepisów (Explore)

## 1. Przegląd

Widok **Publiczny katalog przepisów (Explore)** (`/explore`) umożliwia gościowi (użytkownik niezalogowany) **przeglądanie oraz wyszukiwanie wyłącznie publicznych przepisów**.

Zakres MVP dla tego widoku:
- lista publicznych przepisów w formie siatki kart,
- wyszukiwanie tekstowe po frazie `q` (min. 2 znaki; przeszukuje nazwę, składniki i tagi — realizowane po stronie API),
- paginacja wyników,
- czytelne stany: ładowanie, błąd, brak wyników.

Widok nie może w żaden sposób ujawniać przepisów o widoczności `PRIVATE` ani `SHARED`.

## 2. Routing widoku

- **Ścieżka**: `/explore`
- **Layout**: `PublicLayoutComponent`
- **Komponent**: `ExplorePageComponent` (nowy)

Parametry URL (query params) rekomendowane dla spójności UX i shareable linków:
- `q` (opcjonalny, string): fraza wyszukiwania (po trim; jeśli podana, musi mieć min. 2 znaki),
- `page` (opcjonalny, number): numer strony (>= 1),
- `limit` (opcjonalny, number): rozmiar strony (np. 12/24),
- `sort` (opcjonalny, string): domyślnie `created_at.desc` (UI sortowania nie jest wymagane w US-018, ale parametr warto utrzymywać w stanie).

Uwagi integracyjne:
- Landing (`/`) już nawiguję do `/explore` z parametrem `q`.
- Karta przepisu (komponent współdzielony) wspiera routing publiczny do `/explore/recipes/:id-:slug`.

## 3. Struktura komponentów

Proponowana struktura (standalone, selektory `pych-*`, CD OnPush, control flow `@if/@for`):

```
PublicLayoutComponent
 ├─ PublicHeaderComponent
 └─ RouterOutlet
     └─ ExplorePageComponent
         ├─ (opcjonalnie) Page title/intro (h1 + opis)
         ├─ PublicRecipesSearchComponent (reuse)
         ├─ ExploreResultsGridComponent (nowy, prezentacyjny)   [opcjonalny]
         │   └─ RecipeCardComponent (routeType="public")
         ├─ EmptyStateComponent (reuse, dla braku wyników)
         ├─ ErrorState (inline, w komponencie lub osobny komponent)
         └─ mat-paginator
```

Docelowa lokalizacja plików:
- `src/app/pages/explore/explore-page.component.{ts,html,scss}` (nowe)
- `src/app/pages/explore/components/explore-results-grid/*` (opcjonalnie; nowe)
- Reuse:
  - `src/app/core/services/public-recipes.service.ts`
  - `src/app/pages/landing/components/public-recipes-search/*`
  - `src/app/shared/components/recipe-card/*`
  - `src/app/shared/components/empty-state/*`

## 4. Szczegóły komponentów

### `pych-explore-page` (`ExplorePageComponent`) (nowy)
- **Opis komponentu**: Kontener widoku. Odczytuje stan z query params, obsługuje wyszukiwanie i paginację, pobiera dane z API przez `PublicRecipesService`, mapuje DTO na dane kart i renderuje stany.
- **Główne elementy**:
  - nagłówek treści (np. `<h1>Przeglądaj publiczne przepisy</h1>` + krótki opis),
  - `<pych-public-recipes-search [initialQuery]="query()" (searchSubmit)="onSearchSubmit($event)" />`,
  - siatka kart przepisów (`pych-recipe-card` z `routeType="public"`),
  - `mat-paginator`.
- **Obsługiwane zdarzenia**:
  - `searchSubmit(query)`:
    - `query === ''` → przejście do listy bez filtra (usuń `q` z URL, reset `page=1`),
    - `query.length >= 2` → ustaw `q` w URL, reset `page=1`.
  - `mat-paginator (page)`:
    - aktualizacja `page` oraz `limit` (i zapis do URL).
  - `retry` (dla błędu pobierania): ponów ostatnie zapytanie.
- **Obsługiwana walidacja** (guard clauses, zgodnie z API):
  - `q` po stronie UI:
    - jeśli `q` istnieje i po trim ma długość 1 → **nie wywołuj API**, ustaw stan błędu walidacji („Wpisz co najmniej 2 znaki”) i/lub wyczyść `q`.
  - `page`:
    - brak/niepoprawne → fallback do 1,
    - `page < 1` → fallback do 1.
  - `limit`:
    - brak/niepoprawne → fallback do domyślnego (np. 12),
    - ogranicz do znanych wartości (np. 12/24/48), aby nie generować niepotrzebnych kombinacji.
  - `sort`:
    - w MVP ustaw na stałe `created_at.desc` (lub pozwól na `name.asc`), ale zawsze waliduj whitelistą wartości, jeśli będzie pochodził z URL.
- **Typy** (DTO i ViewModel):
  - DTO: `PaginatedResponseDto<PublicRecipeListItemDto>`
  - VM:
    - `ExploreQueryState`: `{ q: string; page: number; limit: number; sort: string }`
    - `ExplorePageState`:
      - `recipes: RecipeCardData[]`
      - `pagination: PaginationDetails`
      - `isLoading: boolean`
      - `isInitialLoading: boolean`
      - `errorMessage: string | null`
      - `validationMessage: string | null` (dla przypadków typu `q.length === 1` lub niepoprawne parametry URL)
- **Propsy**: brak.

### `pych-public-recipes-search` (`PublicRecipesSearchComponent`) (reuse + rekomendowana drobna modyfikacja)
- **Opis komponentu**: Pole wyszukiwania używane na landing i w `/explore`. W `/explore` powinno potrafić wyświetlić wartość początkową na podstawie query param `q`.
- **Główne elementy**: `mat-form-field` + `input`, przycisk submit (`mat-icon-button`/`mat-button`).
- **Obsługiwane zdarzenia**:
  - Enter / klik „Szukaj” → `searchSubmit(query)`.
  - Zmiana inputu → czyszczenie błędu walidacji.
- **Obsługiwana walidacja**:
  - min. 2 znaki dla niepustego zapytania (zgodnie z API).
- **Typy**: brak.
- **Propsy**:
  - `placeholder?: string`
  - `initialQuery?: string`

Rekomendowana modyfikacja komponentu:
- przyjmować `initialQuery()` i ustawiać wartość `queryControl` (bez emitowania) np. poprzez `effect`, aby po wejściu na `/explore?q=...` input był wypełniony.

### `pych-recipe-card` (`RecipeCardComponent`) (reuse)
- **Opis komponentu**: Karta przepisu. W kontekście publicznym:
  - nawigacja do `/explore/recipes/:id-:slug`,
  - domyślnie pokazuje kategorię (`shouldShowCategory === true`).
- **Główne elementy**: `mat-card`, obrazek (lub placeholder), nazwa, (opcjonalnie) kategoria.
- **Obsługiwane zdarzenia**: kliknięcie karty → nawigacja.
- **Walidacja**: brak.
- **Typy**: `RecipeCardData`, `RecipeCardRouteType`.
- **Propsy**:
  - `recipe: RecipeCardData` (required)
  - `routeType?: 'private' | 'public'` (dla `/explore` ustawiaj `'public'`)

### `ExploreResultsGridComponent` (opcjonalny, nowy)
Jeśli chcemy utrzymać czytelność `ExplorePageComponent`, można wydzielić prezentacyjny komponent siatki wyników (analogicznie do `PublicRecipesSectionComponent`).
- **Opis komponentu**: Renderuje stany listy (skeleton, błąd, empty, dane) oraz siatkę kart.
- **Główne elementy**:
  - skeleton grid (bez białych półprzezroczystych overlay),
  - siatka `pych-recipe-card`.
- **Obsługiwane zdarzenia**:
  - `retry` (gdy błąd).
- **Walidacja**: brak.
- **Typy**: `RecipeCardData[]`, `isLoading`, `errorMessage`.
- **Propsy**:
  - `recipes: RecipeCardData[]` (required)
  - `isLoading?: boolean`
  - `errorMessage?: string | null`
  - `retry?: () => void` (event)

## 5. Typy

Wykorzystywane typy z `shared/contracts/types.ts`:
- `PublicRecipeListItemDto`
- `PaginatedResponseDto<T>`
- `PaginationDetails`
- (pośrednio) `CategoryDto`

Typy VM rekomendowane do wprowadzenia lokalnie w widoku (`src/app/pages/explore/models/*` lub inline w komponencie):
- `ExploreQueryState`
  - `q: string` (może być pusty string)
  - `page: number`
  - `limit: number`
  - `sort: string`
- `ExplorePageState`
  - `recipes: RecipeCardData[]`
  - `pagination: PaginationDetails`
  - `isLoading: boolean`
  - `isInitialLoading: boolean`
  - `errorMessage: string | null`
  - `validationMessage: string | null`

Mapowanie DTO → karta (spójne z landing):
- `PublicRecipeListItemDto` → `RecipeCardData`:
  - `id = dto.id`
  - `name = dto.name`
  - `imageUrl = dto.image_path`
  - `categoryName = dto.category?.name ?? null`
  - `slug = slugify(dto.name)` (fallback, jeśli backend nie dostarcza sluga)

## 6. Zarządzanie stanem

Zalecane podejście:
- użyć **signals** do utrzymania:
  - stanu zapytania (`ExploreQueryState`),
  - stanu strony (`ExplorePageState`).

Synchronizacja stanu z URL:
- Na wejściu do widoku zmapować `queryParamMap` na `ExploreQueryState`.
- Przy akcjach użytkownika (submit/paginacja) aktualizować **jednocześnie**:
  - stan w signalach,
  - query params w Routerze.

Reaktywne odświeżanie danych:
- uruchamiać `effect()` reagujący na zmianę `ExploreQueryState` i wykonywać pobranie danych.
- Zasada UX „keep previous data visible”:
  - na zmianę `q/page/limit` ustaw `isLoading=true`, ale **nie czyść** `recipes`.
- `isInitialLoading` użyć do rozróżnienia pierwszego wejścia (np. pełny skeleton) od kolejnych odświeżeń (np. opacity 0.5 dla siatki).

## 7. Integracja API

Endpoint:
- `GET /public/recipes` (bez JWT)

Serwis:
- `PublicRecipesService.getPublicRecipes(params: GetPublicRecipesParams)`

Parametry wywołania:
- `page`: `ExploreQueryState.page`
- `limit`: `ExploreQueryState.limit`
- `sort`: `ExploreQueryState.sort` (w MVP może być stałe `created_at.desc`)
- `q`: przekazywać tylko gdy `q.trim().length >= 2` (w przeciwnym razie nie wysyłać i pokazać walidację).

Odpowiedź:
- `PaginatedResponseDto<PublicRecipeListItemDto>`
  - `data[]` → mapowanie do `RecipeCardData[]`
  - `pagination` → do konfiguracji `mat-paginator` (`length=totalItems`, `pageIndex=currentPage-1`, `pageSize=limit`).

## 8. Interakcje użytkownika

- **Wejście na `/explore` bez `q`**: pokazanie listy publicznych przepisów (domyślnie posortowanych i spaginowanych).
- **Wejście na `/explore?q=...`**:
  - jeśli `q.length >= 2` → pobranie wyników dla frazy,
  - jeśli `q.length === 1` → brak wywołania API + komunikat walidacji.
- **Wpisanie frazy i submit**:
  - reset paginacji do pierwszej strony,
  - aktualizacja URL,
  - pobranie wyników.
- **Wyczyszczenie frazy i submit**:
  - usunięcie `q` z URL,
  - powrót do listy bez filtra.
- **Zmiana strony/rozmiaru strony**:
  - aktualizacja `page/limit` w URL,
  - pobranie wyników.
- **Kliknięcie karty przepisu**:
  - przejście do szczegółów publicznego przepisu (`/explore/recipes/:id-:slug`).

## 9. Warunki i walidacja

Warunki wynikające z API:
- `q` (jeśli podane) musi mieć **min. 2 znaki** → UI ma to wymuszać (walidacja w komponencie wyszukiwarki + obsługa bezpośredniego URL z niepoprawnym `q`).

Walidacja i wpływ na UI:
- **`q.length === 1`**:
  - `validationMessage` ustawione,
  - brak requestu,
  - wyniki mogą pozostać niezmienione (rekomendowane) albo zostać ukryte (mniej rekomendowane).
- **Brak wyników**:
  - stan empty z komunikatem np. „Brak wyników. Spróbuj zmienić frazę wyszukiwania.”

## 10. Obsługa błędów

Scenariusze błędów i obsługa:
- **Błąd sieci / błąd Edge Function**:
  - ustaw `errorMessage` (tekst przyjazny użytkownikowi),
  - pokaż inline sekcję błędu + przycisk „Spróbuj ponownie”,
  - zachowaj poprzednie dane widoczne, jeśli były.
- **400 Bad Request dla zbyt krótkiego `q`**:
  - powinno być wyeliminowane przez walidację po stronie UI,
  - jeśli mimo to wystąpi (np. ręcznie wpisany URL) → pokaż `validationMessage` i nie spamuj retry.
- **Brak danych w odpowiedzi**:
  - traktuj jak pustą listę (spójnie z istniejącym serwisem, który fallbackuje do pustej odpowiedzi).

## 11. Kroki implementacji

1. Dodać routing publiczny dla `/explore` w `src/app/app.routes.ts` (sekcja `PublicLayoutComponent`).
2. Utworzyć `ExplorePageComponent` jako standalone w `src/app/pages/explore/`.
3. Zaimplementować stan w `ExplorePageComponent` (signals + `effect` do ładowania danych) oraz mechanizm „keep previous data visible”.
4. Zintegrować `PublicRecipesService.getPublicRecipes()` i mapowanie DTO → `RecipeCardData`.
5. Dodać wyszukiwarkę:
   - reuse `PublicRecipesSearchComponent`,
   - (rekomendowane) doposażyć ją o ustawianie `initialQuery` do `FormControl`,
   - obsłużyć submit i synchronizację z URL.
6. Zaimplementować widok listy:
   - siatka kart (`pych-recipe-card routeType="public"`),
   - skeleton na pierwsze ładowanie (można skopiować podejście z `PublicRecipesSectionComponent`),
   - empty state dla braku wyników z sugestią zmiany frazy,
   - stan błędu z retry.
7. Dodać `mat-paginator` z obsługą `PageEvent` i synchronizacją `page/limit` w URL.
8. Dopasować stylowanie (desktop-first + breakpoints) i zadbać o a11y (aria-label dla paginatora, label/placeholder dla inputu).
9. (Opcjonalnie) Dodać testy jednostkowe dla logiki mapowania query params → state oraz walidacji `q`.
