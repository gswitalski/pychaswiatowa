## Plan implementacji widoku: Drzewo „Kolekcje → Przepisy” w Sidebarze (App Shell)

## 1. Przegląd
Celem zmiany jest rozbudowa Sidebara (App Shell) o **drzewo nawigacyjne „Kolekcje → (kolekcje) → (przepisy)”** zgodnie z US-055:
- „Kolekcje” (poziom 1) ma **chevron** do zwijania/rozwijania (bez nawigacji).
- Kliknięcie **etykiety „Kolekcje”** nawiguję do `/collections` (widok zarządzania kolekcjami).
- Po rozwinięciu konkretnej kolekcji (poziom 2) UI **leniwe** pobiera listę przepisów tej kolekcji (poziom 3) przez `GET /collections/{id}/recipes`.
- Element przepisu pokazuje **miniaturę** (z `image_path`) + **nazwę** (fallback ikonka, gdy brak zdjęcia).
- Kliknięcie przepisu nawiguję do kanonicznej ścieżki **`/recipes/:id-:slug`**.

Zmiana nie modyfikuje istniejącego flow zarządzania kolekcjami — `/collections` pozostaje widokiem listy/tworzenia/edycji/usuwania kolekcji; Sidebar dodaje jedynie szybką ścieżkę nawigacji.

## 2. Routing widoku
- **Widok docelowy (nawigacja etykiety)**: `/collections`
- **Nawigacja z drzewa (przepis)**: `/recipes/:id-:slug`
- **Brak nowej trasy**: zmiana dotyczy wyłącznie UI Sidebara w `MainLayoutComponent`.

## 3. Struktura komponentów
Wariant zalecany: wydzielenie drzewa do dedykowanego komponentu, żeby `SidebarComponent` pozostał czytelny.

- `MainLayoutComponent`
  - `SidebarComponent` (`pych-sidebar`)
    - `SidebarCollectionsTreeComponent` (`pych-sidebar-collections-tree`) – **nowy**
      - `SidebarCollectionsTreeItemComponent` (opcjonalnie, jeśli logika rozrośnie się) – **opcjonalny**
  - (pozostałe elementy layoutu bez zmian)

## 4. Szczegóły komponentów

### SidebarComponent (`pych-sidebar`)
- **Opis komponentu**: Kontener Sidebara. Obecnie renderuje statyczną listę `navigationItems` i sekcję „Dodaj przepis”. Po zmianie nadal odpowiada za „ramę” Sidebara, ale element „Kolekcje” stanie się sekcją drzewiastą.
- **Główne elementy**:
  - `mat-nav-list` z linkami do: `/dashboard`, `/my-recipies`, `/settings`
  - sekcja drzewa „Kolekcje” (nowy komponent)
  - stopka z linkiem do `/recipes/new/start`
- **Obsługiwane interakcje**:
  - kliknięcie linków nawigacyjnych -> standardowa nawigacja + zamknięcie sidebara na mobile (istniejące `onNavigate()`)
- **Obsługiwana walidacja**:
  - brak walidacji domenowej; jedynie „guard clauses” w event handlerach (np. nie wykonywać akcji, gdy kliknięcie pochodzi z chevrona drzewa, jeśli użyjemy event bubbling)
- **Typy**:
  - `NavigationItem` (istniejący)
- **Propsy**:
  - brak (komponent layoutowy)

### SidebarCollectionsTreeComponent (`pych-sidebar-collections-tree`) – nowy
- **Opis komponentu**: Renderuje pozycję „Kolekcje” jako drzewo (poziom 1) + listę kolekcji (poziom 2) + listę przepisów danej kolekcji (poziom 3). Odpowiada za:
  - stan rozwinięcia „Kolekcje” oraz poszczególnych kolekcji,
  - lazy-load przepisów dla rozwijanych kolekcji,
  - obsługę stanów pustych/błędów lokalnie w obrębie Sidebara (bez blokowania aplikacji),
  - nawigację do `/collections` i `/recipes/:id-:slug`.
- **Główne elementy**:
  - wiersz poziomu 1:
    - ikonka (np. `collections_bookmark`)
    - etykieta „Kolekcje” (klik -> `/collections`)
    - `mat-icon-button` z chevronem (klik -> toggle rozwinięcia, bez nawigacji)
  - lista kolekcji (poziom 2) renderowana w `@for`:
    - wiersz kolekcji: nazwa + chevron (toggle)
    - pod wierszem, gdy rozwinięta: lista przepisów (poziom 3) / loader / błąd / empty state
  - element przepisu (poziom 3):
    - miniatura (img) gdy `image_path` != null, w przeciwnym razie placeholder (np. `mat-icon restaurant_menu`)
    - nazwa przepisu
- **Obsługiwane interakcje**:
  - **Klik etykiety „Kolekcje”**: `router.navigate(['/collections'])`
  - **Klik chevrona poziomu 1**: toggle `isCollectionsExpanded`
  - **Klik chevrona kolekcji (poziom 2)**: toggle `expandedCollectionIds`, a przy pierwszym rozwinięciu: wywołanie API `GET /collections/{id}/recipes`
  - **Klik wiersza przepisu (poziom 3)**: `router.navigate(['/recipes', `${id}-${slug}`])`
  - **Klik „Spróbuj ponownie”** (dla błędu na poziomie kolekcji): ponowne pobranie `GET /collections/{id}/recipes`
- **Obsługiwana walidacja (warunki i preconditions)**:
  - **ID kolekcji**: `collectionId > 0` (guard clause przed requestem)
  - **ID przepisu**: `recipeId > 0` (guard clause przed nawigacją)
  - **Lazy-load**: nie wykonywać ponownego requestu, jeśli:
    - dane już są w cache (np. `recipesByCollectionId[collectionId].status === 'ready'`), lub
    - request jest w toku (`status === 'loading'`)
  - **Sort i limit**:
    - default `limit = 500`
    - default `sort = 'name.asc'` (stabilne, zgodne z API planem)
- **Typy (DTO i ViewModel)**:
  - DTO:
    - `CollectionListItemDto` (lista kolekcji)
    - `GetCollectionRecipesResponseDto` (odpowiedź `GET /collections/{id}/recipes`)
    - `RecipeSidebarListItemDto` (element przepisu w sidebarze: `id`, `name`, `image_path`)
  - ViewModel (nowe, lokalne dla Sidebara; rekomendowane w `src/app/layout/main-layout/components/sidebar/models/`):
    - `SidebarCollectionRecipesState`:
      - `status: 'idle' | 'loading' | 'ready' | 'error'`
      - `items: RecipeSidebarListItemDto[]`
      - `errorMessage: string | null`
      - `pageInfo: CollectionRecipesPageInfoDto | null`
    - `SidebarCollectionsTreeState`:
      - `isCollectionsExpanded: boolean`
      - `collections: CollectionListItemDto[]`
      - `collectionsLoading: boolean`
      - `collectionsError: string | null`
      - `expandedCollectionIds: Set<number>`
      - `recipesByCollectionId: Map<number, SidebarCollectionRecipesState>`
- **Propsy**:
  - rekomendowane: brak zewnętrznych propsów; komponent sam ładuje dane przez `CollectionsApiService`

### (Opcjonalnie) SidebarCollectionsTreeItemComponent
- **Opis komponentu**: Jeśli komponent drzewa urośnie, warto wydzielić element kolekcji + listę przepisów do osobnego komponentu prezentacyjnego (mniejsza odpowiedzialność, prostsze template’y).
- **Propsy**:
  - `collection: CollectionListItemDto`
  - `expanded: boolean`
  - `recipesState: SidebarCollectionRecipesState`
  - output events: `toggle`, `navigateToRecipe`, `retryLoadRecipes`

## 5. Typy
Wykorzystujemy istniejące typy kontraktów z `shared/contracts/types.ts`:
- `CollectionListItemDto`
- `GetCollectionRecipesResponseDto`
- `RecipeSidebarListItemDto`
- `CollectionRecipesPageInfoDto`

Nowe typy ViewModel/stanu UI (lokalne dla Sidebara) powinny być dodane w obrębie komponentu albo w osobnym pliku w folderze Sidebara, np.:
- `src/app/layout/main-layout/components/sidebar/models/sidebar-collections-tree.model.ts`

Zalecenie: stan trzymać w **signals** (zgodnie z regułami projektu) oraz stosować `ChangeDetectionStrategy.OnPush`.

## 6. Zarządzanie stanem
Zalecany model stanu (signals) wewnątrz `SidebarCollectionsTreeComponent`:
- `state = signal<SidebarCollectionsTreeState>(...)`
- `computed` dla:
  - `hasCollections`, `showCollectionsEmptyState`
  - `isCollectionExpanded(collectionId)`
  - `recipesStateFor(collectionId)`
- `effect` do:
  - załadowania listy kolekcji przy inicjalizacji komponentu,
  - ewentualnego „preload” tylko listy kolekcji po rozwinięciu poziomu 1 (opcjonalnie: jeśli chcemy unikać requestów, gdy user nigdy nie rozwinie drzewa)

Ważne zasady UX (zgodne z regułami repo):
- używać `state.update()` (zamiast `state.set()`) przy doczytywaniu, aby **utrzymać poprzednie dane widoczne** i uniknąć „flashowania”,
- nie stosować białych półprzezroczystych overlayów; zamiast tego np. `opacity: 0.5` na kontenerze listy podczas ładowania.

## 7. Integracja API
Wymagane wywołania:
- `GET /collections`
  - serwis: istniejący `CollectionsApiService.getCollections(): Observable<CollectionListItemDto[]>`
- `GET /collections/{id}/recipes`
  - serwis: dodać do `CollectionsApiService` nową metodę, np.:
    - `getCollectionRecipesForSidebar(collectionId: number, limit = 500, sort = 'name.asc'): Observable<GetCollectionRecipesResponseDto>`
  - budowa query params: `limit`, `sort`
  - dane używane w UI: `data[]` oraz `pageInfo.truncated`

Warstwa komunikacji:
- wyłącznie przez `supabase.functions.invoke(...)` (zgodnie z regułą: brak `supabase.from(...)` w frontendzie).

## 8. Interakcje użytkownika
- **Rozwiń/Zwiń „Kolekcje” (poziom 1)**:
  - klik chevron: rozwija/zwija listę kolekcji
  - brak nawigacji
- **Wejście do `/collections`**:
  - klik w etykietę „Kolekcje” (nie w chevron) nawiguję do `/collections`
- **Rozwiń/Zwiń kolekcję (poziom 2)**:
  - klik chevron przy kolekcji:
    - jeśli pierwsze rozwinięcie i brak cache -> pokazuje loader w obrębie tej kolekcji i pobiera `GET /collections/{id}/recipes`
    - jeśli cache istnieje -> rozwija listę bez requestu
- **Wejście do przepisu (poziom 3)**:
  - klik w element przepisu:
    - generuje slug z `SlugService.slugify(recipe.name)`
    - nawiguję do `/recipes/${id}-${slug}`

## 9. Warunki i walidacja
- **Warunki routingu**:
  - dla nawigacji do przepisu zawsze używać wariantu kanonicznego `:id-:slug` (slug generowany po stronie frontu z nazwy)
- **Warunki API / defensive coding**:
  - jeśli `GET /collections` zwróci pustą listę:
    - w obrębie Sidebara pokazujemy nieinwazyjny empty state (np. „Brak kolekcji”)
  - jeśli `GET /collections/{id}/recipes` zwróci pustą listę:
    - w obrębie danej kolekcji pokazujemy komunikat „Brak przepisów w tej kolekcji”
  - jeśli `pageInfo.truncated === true`:
    - pokazać krótką informację „Nie udało się załadować wszystkich przepisów (limit techniczny)” (bez blokowania)
- **Walidacja zdarzeń**:
  - chevrony muszą mieć `event.stopPropagation()` i `event.preventDefault()` (żeby nie wywoływać nawigacji linka/wiersza)

## 10. Obsługa błędów
Scenariusze i zachowanie:
- **Błąd pobierania kolekcji (GET /collections)**:
  - pokaz w Sidebara komunikat + przycisk „Spróbuj ponownie”
  - nie blokuj reszty nawigacji
- **Błąd pobierania przepisów dla kolekcji (GET /collections/{id}/recipes)**:
  - błąd przypisany do danej kolekcji (lokalnie pod wierszem kolekcji)
  - przycisk „Spróbuj ponownie” ponawia request tylko dla tej kolekcji
- **403/404**:
  - traktować jako brak dostępu / nie znaleziono; komunikat neutralny („Nie masz dostępu” / „Nie znaleziono”)
- **Błędy nieoczekiwane**:
  - komunikat generyczny („Wystąpił błąd. Spróbuj ponownie.”)

## 11. Kroki implementacji
1. Zaktualizować `SidebarComponent` (`src/app/layout/main-layout/components/sidebar/`) tak, aby pozycja „Kolekcje” była renderowana jako sekcja drzewiasta (a nie zwykły link w `@for`).
2. Dodać nowy standalone komponent `SidebarCollectionsTreeComponent` w `src/app/layout/main-layout/components/sidebar/` z selektorem `pych-sidebar-collections-tree`.
3. Dodać lokalne typy ViewModel (np. `sidebar-collections-tree.model.ts`) i zaimplementować stan drzewa w oparciu o `signal`, `computed`, `effect`.
4. Rozszerzyć `CollectionsApiService` (`src/app/core/services/collections-api.service.ts`) o metodę `getCollectionRecipesForSidebar(...)` opartą o `supabase.functions.invoke` i typ `GetCollectionRecipesResponseDto`.
5. Zaimplementować lazy-load:
   - `GET /collections` (po inicjalizacji komponentu lub po pierwszym rozwinięciu poziomu 1),
   - `GET /collections/{id}/recipes` (po rozwinięciu danej kolekcji po raz pierwszy).
6. Dodać renderowanie elementów poziomu 3 (przepisy) z miniaturą:
   - dla `image_path`: wygenerować publiczny URL przez `SupabaseService.storage.from('recipe-images').getPublicUrl(image_path)` (jak w `RecipeCardComponent` / `MyPlanDrawerComponent`),
   - dla braku obrazka: placeholder z ikoną.
7. Dodać nawigację do przepisów po kliknięciu (kanoniczny URL `/recipes/:id-:slug`) z wykorzystaniem `SlugService`.
8. Dodać stany UI (loading/error/empty) lokalnie dla listy kolekcji oraz osobno dla list przepisów per kolekcja; dopilnować, aby podczas ładowania utrzymywać poprzednie dane widoczne (używać `state.update()`).
9. Dodać a11y:
   - `aria-label` na chevronach (np. „Rozwiń kolekcje”, „Rozwiń kolekcję: {name}”),
   - `aria-busy` na kontenerach w trakcie ładowania.
10. Dodać stylowanie w `sidebar.component.scss` (lub osobnym scss komponentu drzewa): wcięcia poziomów, mniejsze miniatury, aktywny stan linku przepisu, spójne kolory z Material (`--mat-sys-*`).
