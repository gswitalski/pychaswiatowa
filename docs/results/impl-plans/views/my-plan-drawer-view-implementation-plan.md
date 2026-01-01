# Plan implementacji widoku Drawer „Mój plan”

## 1. Przegląd
Drawer „Mój plan” to globalny panel wysuwany z prawej strony, dostępny dla **zalogowanego** użytkownika (App Shell), umożliwiający:
- przegląd listy przepisów w planie (od najnowszych),
- usunięcie pojedynczej pozycji,
- wyczyszczenie całej listy,
- nawigację do szczegółów przepisu po kliknięciu w wiersz,
- szybkie otwieranie przez pływający przycisk (FAB) widoczny, gdy plan ma ≥ 1 element.

Widok jest zgodny z wymaganiami US-039 i PRD: lista jest trwała, unikalna, limitowana do 50, a UI zapewnia czytelne stany ładowania i obsługę błędów.

## 2. Routing widoku
- **Brak osobnej trasy routingu** (drawer jest elementem globalnym).
- Drawer i FAB są renderowane **wyłącznie w layoucie zalogowanego użytkownika** (`MainLayoutComponent`), czyli w grupie tras z `canMatch: [authenticatedMatchGuard]`.
- Drawer/FAB **nie są renderowane w `PublicLayoutComponent`** (gość nie ma planu).

## 3. Struktura komponentów
Proponowana hierarchia (wysoko-poziomowo):

- `MainLayoutComponent` (App Shell)
  - `TopbarComponent`
  - `mat-sidenav-container`
    - `mat-sidenav` (sidebar, lewy — już istnieje)
    - `mat-sidenav-content` (router-outlet)
    - **`mat-sidenav` (drawer „Mój plan”, prawy — nowy)**
      - **`pych-my-plan-drawer` (nowy)**
        - nagłówek drawer’a (akcje: „Wyczyść”, „Zamknij”)
        - lista pozycji (miniatura + nazwa + kosz)
        - stan pusty
  - **`pych-my-plan-fab` (nowy)**

Opcjonalnie (jeśli chcemy większej czytelności i testowalności):
- `pych-my-plan-list-item` (nowy, komponent wiersza listy) – może być pominięty w MVP i zrobiony inline w drawerze.

## 4. Szczegóły komponentów

### 4.1. `MyPlanDrawerComponent` (`pych-my-plan-drawer`)
- **Opis komponentu**:
  - Prezentuje zawartość planu w panelu wysuwanym z prawej strony.
  - Obsługuje odświeżanie planu po otwarciu i po operacjach (remove/clear).
  - Pozwala usunąć pojedynczy przepis, wyczyścić całość oraz przejść do szczegółów przepisu.
- **Lokalizacja**: `src/app/shared/components/my-plan-drawer/`
- **Technologie/wzorce**:
  - Standalone component, `ChangeDetectionStrategy.OnPush`
  - `inject()` zamiast konstruktora
  - stan UI oparty o **signals** (zasilany z `MyPlanService`)
  - kontrol flow: `@if`, `@for`
  - brak białych overlay’ów w loadingu (zgodnie z zasadami projektu)

- **Główne elementy HTML / Material**:
  - Nagłówek: `mat-toolbar` lub własny header + `mat-icon-button`:
    - „Wyczyść” (ikona kosza, `aria-label="Wyczyść plan"`)
    - „Zamknij” (ikona X/close, `aria-label="Zamknij plan"`)
  - Zawartość:
    - `mat-list`/`mat-nav-list` dla listy pozycji
    - Wiersz:
      - miniatura (np. `img` w kontenerze 40–56px; fallback placeholder gdy `image_path=null`)
      - tytuł (nazwa przepisu)
      - `mat-icon-button` kosza (`aria-label="Usuń z planu"`)
  - Stany:
    - skeleton/spinner dla pierwszego ładowania
    - przy re-fetch: utrzymanie listy + np. `opacity: 0.5` na kontenerze (bez białych półprzezroczystości)
    - empty state: „Twój plan jest pusty”

- **Obsługiwane zdarzenia**:
  - `click` na „Zamknij” → `MyPlanService.closeDrawer()`
  - `click` na overlay (backdrop) → `MyPlanService.closeDrawer()` (obsługiwane na poziomie `mat-sidenav-container`, patrz integracja z layoutem)
  - `keydown.Escape` → zamknięcie (zapewnia Material + ewentualnie fallback w komponencie)
  - `click` na „Wyczyść”:
    - otwarcie `ConfirmDialogComponent`
    - po potwierdzeniu: `MyPlanService.clearPlan()` + odświeżenie listy
  - `click` na kosz w wierszu:
    - `stopPropagation()` (żeby nie nawigować)
    - `MyPlanService.removeFromPlan(recipe_id)` + odświeżenie listy
  - `click` na wiersz (poza koszem):
    - nawigacja do szczegółów przepisu

- **Warunki walidacji (szczegółowe, zgodnie z API)**:
  - **Usunięcie elementu**:
    - `recipe_id > 0` (guard; serwis już to waliduje)
    - w trakcie usuwania konkretnego elementu blokujemy jego przyciski (`disabled`) i pokazujemy progress (np. mały spinner w miejscu ikony)
  - **Wyczyszczenie planu**:
    - brak dodatkowych parametrów; w trakcie requestu blokujemy akcje w nagłówku
  - **Dostęp**:
    - dla błędów `401` (sesja wygasła) UI powinno:
      - pokazać komunikat,
      - zamknąć drawer,
      - przekierować do `/login` z `returnUrl` aktualnej trasy (spójnie z istniejącymi stronami)

- **Typy (DTO i ViewModel)**:
  - Wykorzystywane DTO z `shared/contracts/types.ts`:
    - `GetPlanResponseDto`
    - `PlanListItemDto`
    - `ApiError`
  - Proponowany ViewModel (lokalny dla UI, może być w serwisie lub w komponencie):
    - `MyPlanDrawerViewModel`:
      - `items: PlanListItemDto[]`
      - `total: number`
      - `limit: 50`
      - `isLoading: boolean` (pierwszy load)
      - `isRefreshing: boolean` (kolejne odświeżenia)
      - `isClearing: boolean`
      - `deletingRecipeIds: Set<number>` (albo `Record<number, boolean>`)
      - `error: ApiError | null`

- **Propsy (interfejs komponentu)**:
  - W MVP najlepiej **bez propsów** – komponent czyta wszystko z `MyPlanService`.
  - Jeśli potrzebne do testów lub reużycia:
    - `drawerTitle?: string` (domyślnie „Mój plan”)

### 4.2. `MyPlanFabComponent` (`pych-my-plan-fab`)
- **Opis komponentu**:
  - Pływający przycisk w prawym dolnym rogu, widoczny gdy plan ma co najmniej 1 element.
  - Po kliknięciu otwiera drawer.
- **Lokalizacja**: `src/app/shared/components/my-plan-fab/`
- **Główne elementy HTML / Material**:
  - `button mat-fab` lub `button mat-fab extended` z etykietą „Mój plan”
  - ikona np. `playlist_add_check` / `list`
  - opcjonalnie `matBadge` z liczbą elementów (np. `total`)
- **Obsługiwane zdarzenia**:
  - `click` → `MyPlanService.openDrawer()`
- **Warunki walidacji**:
  - przycisk renderuje się tylko gdy `planTotal >= 1` i użytkownik jest zalogowany (FAB jest tylko w `MainLayoutComponent`)
- **Typy**:
  - bazuje na stanie z `MyPlanService` (np. `planTotal: number`)
- **Propsy**:
  - preferowane brak; ewentualnie:
    - `label?: string` (domyślnie „Mój plan”)

### 4.3. Integracja w `MainLayoutComponent` (App Shell)
- **Opis**:
  - Umieszczenie prawego `mat-sidenav` (drawer) w tym samym `mat-sidenav-container`, w którym istnieje sidebar.
  - Podpięcie stanu otwarcia do `MyPlanService.isDrawerOpen`.
  - Zapewnienie zamykania po kliknięciu w overlay.
  - Render FAB jako element absolutny/fixed nad zawartością (poza `mat-sidenav-container` lub w `mat-sidenav-content`).

- **Główne elementy**:
  - Drugi `mat-sidenav` z `position="end"` i `mode="over"` (zawsze overlay).
  - `(backdropClick)` na `mat-sidenav-container`:
    - jeśli otwarty jest plan → `closeDrawer()`
    - uwaga: nie zamykać sidebara, jeśli plan nie jest otwarty (lub obsłużyć warunkowo)

## 5. Typy
Wykorzystujemy istniejące typy z `shared/contracts/types.ts`:
- **`GetPlanResponseDto`**:
  - `data: PlanListItemDto[]`
  - `meta: { total: number; limit: 50 }`
- **`PlanListItemDto`**:
  - `recipe_id: number`
  - `added_at: string` (ISO)
  - `recipe: { id: number; name: string; image_path: string | null }`
- **`ApiError`**:
  - `message: string`
  - `status: number`

Nowe typy (frontend, ViewModel; rekomendowane umiejscowienie: `src/app/shared/models/` albo lokalnie w komponencie):
- **`MyPlanState`** (serwisowy stan źródłowy):
  - `items: PlanListItemDto[]`
  - `meta: GetPlanResponseDto['meta']`
  - `isLoading: boolean`
  - `isRefreshing: boolean`
  - `error: ApiError | null`
  - `lastLoadedAt: number | null` (ms)
- **`MyPlanMutationState`**:
  - `isClearing: boolean`
  - `deletingRecipeIds: Set<number>`

## 6. Zarządzanie stanem
Rekomendacja: rozbudować istniejący `MyPlanService`, aby był **jedynym źródłem prawdy** dla:
- otwarcia/zamknięcia drawer’a (`isDrawerOpen` już istnieje),
- danych planu (lista + meta),
- stanów ładowania/odświeżania,
- stanów mutacji (clear/remove).

Proponowane sygnały w `MyPlanService`:
- `readonly planState = signal<MyPlanState>(...)`
- `readonly mutationState = signal<MyPlanMutationState>(...)`
- `readonly planTotal = computed(() => planState().meta.total)`
- `readonly hasItems = computed(() => planTotal() > 0)`
- `readonly items = computed(() => planState().items)` (ew. sort defensywny po `added_at.desc`)

Wzorce:
- **Prefetch**: przy starcie `MainLayoutComponent` wywołać `myPlanService.prefetchPlan()` (w tle), aby FAB poprawnie pojawiał się od razu, jeśli plan ma elementy.
- **Odświeżenie po otwarciu**: `effect()` (w serwisie lub w drawerze) reagujący na `isDrawerOpen() === true`:
  - jeśli plan jest niezaładowany lub „stary” (np. TTL 30–60s), wykonać `getPlan()`.
- **Brak „white flash”**: przy odświeżaniu używać `state.update()` i utrzymywać poprzednie dane widoczne, tylko z delikatnym przygaszeniem.

## 7. Integracja API
Źródło: `src/app/core/services/my-plan.service.ts` (już istnieje i spełnia regułę „TYLKO Edge Functions”).

Wymagane wywołania:
- **`GET plan`**:
  - użycie: pobranie listy do drawera + wyliczenie `total` do FAB
  - typ odpowiedzi: `GetPlanResponseDto`
- **`POST plan/recipes`**:
  - użycie: dodawanie z widoku szczegółów przepisu (już istnieje) + po sukcesie plan powinien zostać odświeżony, aby FAB i drawer miały aktualne dane
  - typ żądania: `AddRecipeToPlanCommand`
  - odpowiedź: brak (void)
- **`DELETE plan/recipes/{recipeId}`**:
  - użycie: usunięcie pojedynczego elementu z drawera
  - odpowiedź: brak (void)
- **`DELETE plan`**:
  - użycie: wyczyszczenie planu
  - odpowiedź: brak (void)

Mapowanie błędów (spójne z istniejącym `MyPlanService.mapError()`):
- `401` → sesja wygasła (komunikat + przekierowanie do `/login`)
- `403` → brak dostępu do przepisu
- `404` → przepis nie istnieje
- `409` → duplikat (przepis już w planie)
- `422` → limit 50
- `5xx` → błąd serwera / sieci

## 8. Interakcje użytkownika
- **Otworzenie planu**:
  - klik w `pych-my-plan-fab` → otwarcie drawer’a
  - klik w akcję „Zobacz listę” w szczegółach przepisu (już woła `myPlanService.openDrawer()`) → otwarcie drawer’a
- **Zamknięcie planu**:
  - klik w „X”
  - klik w przyciemnione tło (overlay)
  - klawisz `Esc`
- **Usunięcie pojedynczej pozycji**:
  - klik w ikonę kosza w wierszu → request `DELETE plan/recipes/{id}`
  - po sukcesie: snackbar „Usunięto z planu” + opcjonalnie akcja „Cofnij” (re-add)
- **Wyczyszczenie planu**:
  - klik w kosz w nagłówku → confirm dialog → request `DELETE plan`
  - po sukcesie: snackbar „Wyczyszczono plan” (+ opcjonalne „Cofnij” na bazie snapshotu listy)
- **Wejście w szczegóły przepisu z planu**:
  - klik w wiersz → nawigacja do `/explore/recipes/:id`
    - Uzasadnienie: endpoint explore jest „uniwersalny” i działa zarówno dla cudzych publicznych przepisów, jak i własnych (własne pokażą akcje właściciela), bez ryzyka 403 na `/recipes/:id`.

## 9. Warunki i walidacja
- **Widoczność FAB**:
  - FAB renderuje się tylko, gdy `planTotal >= 1`.
  - `planTotal` musi być znane możliwie wcześnie (prefetch w `MainLayoutComponent`).
- **Kolejność listy**:
  - Backend powinien zwracać `added_at.desc`. UI może defensywnie sortować po `added_at` malejąco.
- **Blokady w trakcie requestów**:
  - w trakcie `clearPlan`: blokada przycisków w headerze i listy
  - w trakcie `removeFromPlan(id)`: blokada tylko danego wiersza (pozostałe działania nadal dostępne)
- **Spójność „plan ma ≥1 element”**:
  - po `remove/clear/add` plan powinien zostać odświeżony albo zaktualizowany lokalnie w serwisie (bez „skoków” UI).

## 10. Obsługa błędów
- **Błąd pobrania planu (GET)**:
  - pokazanie komunikatu w drawerze (np. `mat-card`/`mat-error` style) + przycisk „Spróbuj ponownie”
  - snackbar z krótką informacją (opcjonalnie)
- **Błąd usunięcia pozycji**:
  - snackbar z `err.message`
  - przywrócenie przycisku (koniec stanu „deleting”)
- **Błąd czyszczenia planu**:
  - snackbar z `err.message`
- **401 (sesja)**:
  - snackbar „Sesja wygasła…”
  - zamknięcie drawer’a
  - przekierowanie do `/login` z `returnUrl`

## 11. Kroki implementacji
1. **Utwórz komponent `MyPlanDrawerComponent`** jako standalone w `src/app/shared/components/my-plan-drawer/` z selektorem `pych-my-plan-drawer`.
2. **Utwórz komponent `MyPlanFabComponent`** jako standalone w `src/app/shared/components/my-plan-fab/` z selektorem `pych-my-plan-fab`.
3. **Rozbuduj `MyPlanService`** o stan danych planu (lista + meta + loading/mutations) i publiczne computed (`hasItems`, `planTotal`, `items`).
4. **Dodaj prefetch planu** w `MainLayoutComponent` (np. w `ngOnInit`) tak, aby FAB pojawiał się od razu, jeśli plan nie jest pusty.
5. **Zintegruj drawer w `MainLayoutComponent`**:
   - dodaj prawy `mat-sidenav` (`position="end"`, `mode="over"`) z `opened` powiązanym z `myPlanService.isDrawerOpen()`
   - podepnij zamykanie na `backdropClick`/`closed`
6. **Zintegruj FAB w `MainLayoutComponent`**:
   - renderuj `pych-my-plan-fab` tylko gdy `myPlanService.hasItems()` (lub `planTotal() > 0`)
   - ustaw pozycjonowanie (fixed, prawy-dół) i responsywne odstępy (uwzględnij mobile + safe-area)
7. **Dodaj UX dla operacji destrukcyjnych**:
   - confirm dialog dla „Wyczyść”
   - snackbar po sukcesie/błędzie (spójnie z resztą aplikacji)
8. **Zadbaj o dostępność**:
   - `aria-label` na ikonach
   - focus management (Material + test klawiaturą: Tab/Esc)
9. **Dodaj testy (rekomendowane)**:
   - `MyPlanService`: mapowanie błędów, guard clauses, poprawne przejścia stanów
   - `MyPlanDrawerComponent`: render listy, empty state, wywołania `remove/clear`, `stopPropagation` na koszu
10. **Weryfikacja manualna**:
   - plan pusty → brak FAB, drawer pokazuje empty state
   - plan z elementami → FAB widoczny, kolejność poprawna, usuwanie i czyszczenie działają, overlay zamyka drawer, nawigacja działa


