# Plan implementacji widoku: Publiczne wyszukiwanie przepisów (Landing `/` + Explore `/explore`)

## 1. Przegląd
Celem jest ujednolicenie i doprecyzowanie zachowania wyszukiwania publicznych przepisów na:
- **Landing Page (`/`)**: pasek wyszukiwania jako komponent **`pych-public-recipes-search`**; wyszukiwanie uruchamia się dopiero od **3 znaków** (po `trim`), z **debounce 300–400 ms**. Dla pustej frazy landing **nie wykonuje wyszukiwania** i pozostaje w trybie feed/sekcji kuratorowanych.
- **Explore (`/explore`)**: publiczny katalog z wyszukiwaniem tekstowym; dla frazy ≥ 3 znaki domyślnie sortuje po **relevance (3/2/1)** (nazwa/składniki/tagi), a UI pokazuje etykietę **„Dopasowanie: …”** na kartach.

Zakładamy, że backend realizuje ranking i zwraca metadane dopasowania w polu `search` (kontrakt: `PublicRecipeListItemDto.search`).

## 2. Routing widoku
- **Landing**: ścieżka `/` (publiczna).
- **Explore**: ścieżka `/explore` (publiczna).

Uwagi dot. layoutu:
- Na widokach publicznych **nie wyświetlamy Sidebara**.
- Topbar zależny od kontekstu (gość: CTA logowania/rejestracji, zalogowany: profil + nawigacja do `/dashboard`) – zgodnie z UI Plan.

## 3. Struktura komponentów
Wysokopoziomowo (docelowa reużywalność logiki wyszukiwania w obu widokach):

- `pych-landing-page` (strona `/`)
    - `pych-public-recipes-search` (wyszukiwanie + wyniki/sekcje)
        - `pych-public-recipe-results` (lista wyników / sekcje feed)
            - `pych-recipe-card` (karta przepisu)

- `pych-explore-page` (strona `/explore`)
    - `pych-public-recipes-search` (wyszukiwanie + wyniki)
        - `pych-public-recipe-results`
            - `pych-recipe-card`

Wspólna logika danych:
- `PublicRecipesFacade` (serwis w `core/services` lub `pages/explore/services`) – stan jako **signals**, wywołania API przez **Edge Functions**.

## 4. Szczegóły komponentów

### `pych-public-recipes-search` (standalone)
- **Opis komponentu**:
    - Reużywalny komponent obsługujący:
        - wejście tekstowe (fraza wyszukiwania),
        - przełączanie trybu **feed** vs **search** (na podstawie `qTrim.length`),
        - render listy wyników + „Więcej” (load more),
        - stany: ładowanie, błąd, brak wyników, wskazówki dla krótkiej frazy.
    - Komponent ma działać w dwóch kontekstach:
        - Landing (`/`): przy pustej frazie pokazuje sekcje kuratorowane (lub feed), a nie „brak wyników”.
        - Explore (`/explore`): przy pustej frazie pokazuje feed (np. `created_at.desc`).

- **Główne elementy HTML i dzieci**:
    - `mat-form-field` + `input matInput` (placeholder np. „Szukaj przepisów…”)
    - (opcjonalnie) `mat-hint` / `mat-error`:
        - hint: „Wpisz min. 3 znaki, aby wyszukać”
    - `pych-public-recipe-results` jako render wyników/sekcji
    - `mat-button` „Więcej” pod listą wyników:
        - widoczny tylko gdy `hasMore === true`
        - `disabled` podczas doładowania
        - etykieta przechodzi w „Ładowanie…” w trakcie
    - Skeleton/placeholder przy ładowaniu pierwszej porcji

- **Obsługiwane zdarzenia**:
    - `input` (zmiana frazy) → ustawienie `queryDraft` i uruchomienie debounced fetch (300–400 ms)
    - `click` na „Więcej” → fetch następnej porcji (cursor)
    - (opcjonalnie) `keydown.enter` → natychmiastowe wymuszenie wyszukiwania (pomija debounce), jeśli `qTrim.length >= 3`

- **Warunki walidacji (zgodne z API)**:
    - `qTrim.length === 0`:
        - tryb **feed**
        - na landing: nie wykonujemy „search” (zachowanie jak feed/sekcje)
    - `1 <= qTrim.length <= 2`:
        - **nie wywołujemy API z parametrem `q`** (unikamy `400 Bad Request`)
        - UI: wyświetlamy wskazówkę „Wpisz min. 3 znaki…”
        - lista wyników pozostaje w trybie feed (lub ostatnie dane bez „białego flasha”)
    - `qTrim.length >= 3`:
        - tryb **search**
        - backend sortuje domyślnie po relevance
        - UI pokazuje etykietę „Dopasowanie: …” zgodnie z `item.search.match`

- **Typy (DTO i ViewModel)**:
    - DTO:
        - `CursorPaginatedResponseDto<PublicRecipeListItemDto>`
        - `PublicRecipeListItemDto`
        - `RecipeSearchMeta`, `SearchMatchSource`
    - ViewModel (nowe, frontendowe):
        - `PublicRecipesSearchMode = 'feed' | 'search'`
        - `PublicRecipesSearchContext = 'landing' | 'explore'`
        - `PublicRecipesSearchVm` (opis w sekcji „Typy”)

- **Propsy (interfejs komponentu)**:
    - `context: PublicRecipesSearchContext` (wymagane) – determinuje zachowanie pustej frazy i copy
    - `initialQuery?: string` (opcjonalne) – przydatne pod przyszłe deep-linki
    - `debounceMs?: number` (opcjonalne, domyślnie 350)
    - `pageSize?: number` (opcjonalne, domyślnie 12)

### `pych-public-recipe-results` (standalone)
- **Opis komponentu**:
    - Warstwa prezentacyjna renderująca:
        - listę `PublicRecipeListItemDto[]`,
        - stany: loading, error, empty state,
        - w trybie search: etykietę dopasowania na kartach.

- **Główne elementy HTML i dzieci**:
    - kontener siatki/listy (np. CSS grid)
    - `@for` po `items`
        - `pych-recipe-card [recipe]="item"`
            - sekcja stopki/metadata: „Dopasowanie: …” (tylko gdy `item.search != null`)
    - `@if` dla stanów:
        - `loadingInitial`: skeletony
        - `error`: komunikat + przycisk „Spróbuj ponownie”
        - `empty`:
            - search: „Brak wyników. Spróbuj innej frazy.”
            - feed: na landing raczej brak „pustego” (zależnie od sekcji kuratorowanych)

- **Obsługiwane zdarzenia**:
    - `retry` (np. button) → emituje event do rodzica (ponowne pobranie bieżącego trybu)

- **Walidacja**:
    - Brak własnej walidacji wejścia; tylko zależności od przekazanego `mode` i `items`

- **Typy**:
    - `PublicRecipeListItemDto`
    - `PublicRecipesSearchMode`
    - `PublicRecipesResultsVm` (opcjonalnie – jeśli chcemy spiąć dane w jeden obiekt wejściowy)

- **Propsy**:
    - `items: PublicRecipeListItemDto[]`
    - `mode: PublicRecipesSearchMode`
    - `loadingInitial: boolean`
    - `errorMessage: string | null`
    - `context: PublicRecipesSearchContext`
    - `onRetry: () => void` (lub `@Output() retry = new EventEmitter<void>()`)

### `pych-recipe-card` (istniejący / współdzielony)
- **Opis komponentu**:
    - Karta przepisu na listach publicznych, zawiera miniaturę, nazwę, kategorię i dodatkowe odznaczenia.
    - Dla tego zadania kluczowe jest dopięcie w UI etykiety „Dopasowanie: …” (najlepiej w warstwie wyników, nie w samej karcie, jeśli karta jest współdzielona z innymi listami).

- **Etykieta dopasowania**:
    - Renderować tylko w kontekście publicznego wyszukiwania i tylko gdy `recipe.search != null`.
    - Mapowanie:
        - `name` → „Dopasowanie: nazwa”
        - `ingredients` → „Dopasowanie: składniki”
        - `tags` → „Dopasowanie: tagi”

## 5. Typy
Poniższe typy są zalecane po stronie frontendu (nie muszą trafiać do `shared/contracts/types.ts`, bo to kontrakty DTO; mogą być lokalne w `src/app/pages/.../models` lub `src/app/shared/models`):

### `PublicRecipesSearchContext`
- Typ: `'landing' | 'explore'`
- Cel: sterowanie zachowaniem pustej frazy i copy w stanie pustym.

### `PublicRecipesSearchMode`
- Typ: `'feed' | 'search'`
- Cel: kontrola UI (etykieta dopasowania tylko w `search`, inny empty state).

### `PublicRecipesSearchVm`
- Pola:
    - `queryDraft: string` – wartość z inputa (przed debounce)
    - `queryCommitted: string` – ostatnia „zatwierdzona” fraza (po debounce / enter)
    - `mode: PublicRecipesSearchMode`
    - `items: PublicRecipeListItemDto[]`
    - `pageInfo: CursorPageInfoDto` – `hasMore`, `nextCursor`
    - `loadingInitial: boolean`
    - `loadingMore: boolean`
    - `errorMessage: string | null`
    - `shortQueryHintVisible: boolean` – `true` gdy 1–2 znaki
    - `lastRequestKey: string | null` – do ignorowania spóźnionych odpowiedzi (opcjonalnie)

### `PublicRecipesFetchParams` (pomocniczy)
- Pola:
    - `cursor: string | null`
    - `limit: number` (domyślnie 12)
    - `q: string | null` (tylko gdy `qTrim.length >= 3`)
    - `sort: string` (domyślnie `created_at.desc` dla feed; dla search można pominąć i zaufać backendowi)

## 6. Zarządzanie stanem
Zalecane: **Facade z signals** (bez NgRx), z rozdzieleniem:
- stan UI (fraza, mode, loading, error),
- stan danych (items, cursor/hasMore),
- logika debouncingu i anulowania/ignorowania spóźnionych odpowiedzi.

### Proponowany kształt `PublicRecipesFacade`
- `queryDraft = signal<string>('')`
- `queryCommitted = signal<string>('')`
- `mode = computed(() => qTrim.length >= 3 ? 'search' : 'feed')` (gdzie `qTrim` to `computed(() => queryDraft().trim())`)
- `state = signal<PublicRecipesSearchVm>(...)` lub osobne sygnały (preferowane dla czytelności)

### Debounce 300–400 ms
Implementacja w `effect()`:
- po zmianie `queryDraft` ustaw `setTimeout` (350 ms),
- czyść poprzedni timer przy kolejnej zmianie,
- w callbacku:
    - wylicz `qTrim`,
    - jeśli `qTrim.length === 0` → odpal feed (reset cursor + fetch first batch)
    - jeśli `1..2` → nie odpalaj search; opcjonalnie odpal/utrzymaj feed
    - jeśli `>=3` → odpal search (reset cursor + fetch first batch)

### „Bez białego flasha” przy przeładowaniu
Zgodnie z zasadą: utrzymujemy poprzednie dane widoczne podczas ładowania nowego kontekstu:
- zamiast zerować `items` natychmiast, ustaw `loadingInitial=true` i podmień `items` dopiero po sukcesie,
- doładowanie (`loadingMore`) dopina do istniejącej listy.

## 7. Integracja API
Frontend **nie odpyta bazy bezpośrednio**; korzysta z Supabase **Edge Functions**:

### Endpoint (zalecany dla „Więcej”)
- `GET /public/recipes/feed`
- Parametry:
    - `cursor?: string`
    - `limit?: number` (UI: 12)
    - `sort?: string` (dla feed: `created_at.desc`)
    - `q?: string` (tylko gdy `qTrim.length >= 3`)
- Odpowiedź:
    - `CursorPaginatedResponseDto<PublicRecipeListItemDto>`

### Kontrakt relevance / etykiety dopasowania
- Dla `q` poprawnego backend powinien zwracać `item.search`:
    - `relevance_score: number`
    - `match: 'name' | 'ingredients' | 'tags'`
- UI:
    - wyświetla jedną etykietę „Dopasowanie: …” bazując na `match`.

### Zachowanie sortowania
- `qTrim.length >= 3`: nie wymuszamy sortowania w UI (zakładamy domyślne relevance po stronie API).
- `qTrim.length < 3`: feed, domyślnie `created_at.desc`.

### Obsługa błędów API
- `400` (np. zbyt krótkie `q`) – prewencja w UI (nie wysyłać takich zapytań).
- pozostałe (sieć/500) – `errorMessage` + retry.

## 8. Interakcje użytkownika

### Landing (`/`)
- **Wpisywanie frazy**:
    - 0 znaków po `trim`: brak wyszukiwania; pokazuj sekcje kuratorowane / feed.
    - 1–2 znaki: pokaż hint „Wpisz min. 3 znaki…”, nie rób requestu search.
    - ≥3 znaki: po 300–400 ms pokaż wyniki wyszukiwania.
- **„Więcej”**:
    - dostępne tylko gdy API zwraca `hasMore=true`;
    - dopina kolejne 12 wyników.

### Explore (`/explore`)
- **Wpisywanie frazy**:
    - pusta fraza: feed (najnowsze).
    - 1–2 znaki: hint, brak wyszukiwania (utrzymaj feed).
    - ≥3 znaki: search + etykieta dopasowania na kartach.
- **„Więcej”**:
    - doładowuje kolejne porcje wyników bieżącego trybu (feed/search).

## 9. Warunki i walidacja
Walidacja/warunki w UI (przed wywołaniem API):
- **Min długość**: `qTrim.length >= 3` aby wykonać wyszukiwanie (`q`).
- **Pusta fraza**: traktuj jako feed (bez „Brak wyników” na landing).
- **Zapytanie wielowyrazowe (AND)**: brak logiki w UI (backend), UI tylko przekazuje `q` wprost (po `trim`).
- **Tag exact/prefix**: backend, UI tylko prezentuje wynik.
- **Relevance**: backend, UI tylko renderuje `search.match`.

Wpływ na stan UI:
- zmiana `mode` resetuje paginację kursorem (ustaw `nextCursor=null`, `hasMore=true` zanim przyjdzie odpowiedź),
- `loadingInitial` włącza się dla pierwszego pobrania w danym kontekście,
- `loadingMore` włącza się dla doładowania,
- błąd nie czyści danych; pokazuje komunikat i pozwala retry.

## 10. Obsługa błędów
Scenariusze i obsługa:
- **Błąd sieci / 5xx**:
    - pokaz `mat-snackbar` z krótkim komunikatem,
    - w UI: sekcja błędu + przycisk „Spróbuj ponownie”.
- **Brak wyników w search**:
    - komunikat „Brak wyników…” (tylko dla `mode='search'`).
- **Fraza 1–2 znaki**:
    - brak requestu,
    - widoczny hint, bez stanu błędu.
- **Spóźniona odpowiedź (race condition)**:
    - ignoruj odpowiedzi, które nie pasują do `queryCommitted`/`lastRequestKey`.
- **Duplikaty przy doładowaniu** (jeśli kiedyś wystąpią):
    - defensywnie deduplikuj po `id` podczas append (opcjonalnie).

## 11. Kroki implementacji
1. **Modele i lokalne typy**:
    - dodać `PublicRecipesSearchContext`, `PublicRecipesSearchMode`, `PublicRecipesSearchVm` w `src/app/pages/explore/models/` (lub `shared/models` jeśli współdzielone).
2. **Facade (signals)**:
    - utworzyć `PublicRecipesFacade` (np. `src/app/pages/explore/services/public-recipes.facade.ts`) z:
        - sygnałami stanu,
        - `loadInitial(context)` i `loadMore()`,
        - efektem debounced na `queryDraft`.
3. **Serwis API**:
    - utworzyć `PublicRecipesApiService` z metodą:
        - `getPublicRecipesFeed(params: PublicRecipesFetchParams): Promise<CursorPaginatedResponseDto<PublicRecipeListItemDto>>`
    - implementacja wyłącznie przez `supabase.functions.invoke(...)` (Edge Function), bez `supabase.from(...)`.
4. **Komponent `pych-public-recipes-search`**:
    - standalone, OnPush, selector `pych-public-recipes-search`,
    - inputy: `context`, opcjonalnie `debounceMs`, `pageSize`,
    - podpiąć do facade.
5. **Komponent `pych-public-recipe-results`**:
    - render listy + stany + retry,
    - etykieta dopasowania bazująca na `item.search.match`.
6. **Integracja w widokach**:
    - Landing `/`: osadzić `pych-public-recipes-search context="landing"`; zapewnić sekcje kuratorowane w trybie feed (może być ta sama lista z `created_at.desc` albo osobne sekcje – zgodnie z decyzją UX).
    - Explore `/explore`: osadzić `pych-public-recipes-search context="explore"`.
7. **UX/A11y**:
    - aria-label dla inputa i przycisku „Więcej”,
    - widoczne wskazówki dla krótkiej frazy,
    - focus management po retry (opcjonalnie).
8. **Weryfikacja manualna**:
    - `/`:
        - pusta fraza → sekcje/feed, brak requestu search,
        - 2 znaki → hint, brak requestu,
        - 3+ → search po debounce,
        - „Więcej” dopina.
    - `/explore`:
        - pusta fraza → feed,
        - 3+ → search + „Dopasowanie: …”,
        - „Więcej” dopina i utrzymuje kolejność.

