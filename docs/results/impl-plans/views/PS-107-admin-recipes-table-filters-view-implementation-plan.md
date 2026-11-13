# Plan implementacji widoków — PS-107: Filtrowanie tabeli przepisów publicznych

Historyjka: `docs/results/new-features/user-stories/PS-107/PS-107-admin-recipes-table-filters-user-story.md`
Plan API: `docs/results/impl-plans/endpoints/PS-107-admin-recipes-table-filters-api-implementation-plan.md`
Wzorzec: `src/app/pages/admin/admin-recipes/` (PS-204)

## 1. Architektura i pliki

Rozszerzyć istniejącą stronę `/admin/recipes`; nie zmieniać routingu, guardów,
sidebaru ani tabeli kolumn poza stanami pustymi. Dodać standalone komponent
`PychAdminRecipesFiltersComponent` z selektorem `pych-admin-recipes-filters`
(w kodzie zgodnie z konwencją nazwa klasy `AdminRecipesFiltersComponent`).

Nowe:
- `src/app/pages/admin/admin-recipes/admin-recipes-filters.component.ts/.html/.scss`
- `src/app/pages/admin/admin-recipes/admin-recipes-filters.component.spec.ts`

Modyfikowane:
- `admin-recipes-page.component.ts/.html/.scss/.spec.ts`
- `admin-recipes-table.component.ts/.html/.scss/.spec.ts` (komunikat aktywnych
  filtrów i brak wyników)
- `admin-recipes.models.ts`
- `src/app/core/services/admin-api.service.ts/.spec.ts`
- `src/app/core/services/categories.service.ts` tylko jeśli brak obecnego
  typowanego odczytu kategorii przez Edge Function
- `shared/contracts/types.ts` wyłącznie przez implementację API.

Wszystkie komponenty są standalone, `OnPush`, używają sygnałów, `inject`,
prefiksu `pych`, 4-spacjowego wcięcia i Angular Material. Dane kategorii
pochodzą z istniejącego `GET /categories`; frontend nie używa `from()` ani RPC.

## 2. Model filtrów i formularz

W `admin-recipes.models.ts` dodać:
- `AdminRecipesFiltersVm`: `id`, `name`, `author`, `categoryIds`,
  `includeUncategorized`, `createdFrom`, `createdTo`, `ratingMin`,
  `ratingMax`, `ratingsCountMin`, `ratingsCountMax`, `isGrill`,
  `isTermorobot`;
- `EMPTY_ADMIN_RECIPES_FILTERS`;
- funkcję `countActiveAdminRecipeFilters` (zakres liczy jako jeden filtr,
  znaczniki jako dwa, „Bez kategorii” jako jeden element kategorii);
- `AdminRecipesQueryState` jako istniejące parametry paginacji/sortowania
  rozszerzone o filtry.

Formularz reaktywny pozostaje lokalny komponentu filtrów. Pola tekstowe/liczbowe
mają `maxlength=100` tylko dla tekstu, właściwe typy `number`, zakresy i
komunikaty po polsku. Walidatory klienta odwzorowują API: ID całkowite ≥1,
licznik całkowity ≥0, ocena 1,0–5,0, daty poprawne, `od ≤ do`. Walidacja nie
wywołuje API. Wartości są trimowane dopiero podczas budowy zastosowanego stanu.

Komponent filtrów:
- `input.required<readonly CategoryDto[]> categories`;
- `input.required<boolean> categoriesLoading`;
- `input.required<string | null> categoriesError`;
- `input.required<AdminRecipesFiltersVm> appliedFilters`;
- `output<AdminRecipesFiltersVm> apply`, `output<void> clear`,
  `output<void> retryCategories`.

Najważniejsze zachowanie:
- zmiana wartości formularza nie wysyła zapytania;
- „Zastosuj” emituje tylko po poprawnej walidacji, a Enter w polach
  tekstowych/liczbowych uruchamia tę samą akcję (bez podwójnego submitu);
- „Wyczyść” zeruje formularz i emituje pusty stan;
- wielokrotny wybór kategorii ma OR, osobną opcję „Bez kategorii”;
- wartości zastosowane i robocze są rozdzielone, więc paginacja/sortowanie
  korzystają z zastosowanych filtrów, nie z niezatwierdzonych zmian.

## 3. Strona kontenerowa

`AdminRecipesPageComponent` zachowuje istniejące sygnały wyścigów, loading,
opacity, autoryzację i korektę strony. Dodać:
- `appliedFilters = signal<AdminRecipesFiltersVm>(EMPTY...)`;
- `categories`, `categoriesLoading`, `categoriesError`;
- `filtersExpanded` (domyślnie `true` ≥960 px, `false` <960 px przez CSS);
- `activeFilterCount`;
- zapytanie zawierające `...appliedFiltersToQuery(appliedFilters())`.

Przy „Zastosuj” i „Wyczyść”:
1. zachować bieżące sortowanie i `page_size`;
2. ustawić `page = 1` przed wywołaniem;
3. zapisać nowe `appliedFilters`;
4. wysłać dokładnie jedno żądanie.

`onPageChange` i `onSortChange` zachowują `appliedFilters`; zmiana rozmiaru
strony lub sortowania ustawia `page = 1`, jak już działa w PS-204 (kryterium 13).
Zmiana strony zachowuje stronę i wszystkie zastosowane filtry. Odpowiedź API
aktualizuje paginację/sortowanie, ale nie może nadpisać filtrów ani roboczego
formularza. `onRetry` ponawia bieżące query z zastosowanymi filtrami.

`loadRecipes` zachowuje `latestRequestId`, ignorowanie spóźnionych odpowiedzi,
jednorazową korektę strony i poprzednie wiersze podczas odświeżania. Dla
`totalItems=0` przy aktywnych filtrach stan pusty przekazuje rozróżnienie
„brak wyników dla filtrów”; dla pustej bazy bez filtrów pozostaje dotychczasowy
komunikat.

Kategorie pobierać równolegle z pierwszym ładowaniem lub przy wejściu strony.
Błąd listy kategorii nie blokuje tabeli: pole pokazuje „Nie udało się pobrać
kategorii” i przycisk ponowienia. Nie zapisywać filtrów w URL ani storage.

## 4. Szablon, responsywność i dostępność

Nad tabelą umieścić:
`<pych-admin-recipes-filters ... (apply)="onFiltersApply($event)"
(clear)="onFiltersClear()" />`.

Panel zawiera ID, Nazwa, Autor, Kategoria, Data od/do, Średnia ocena od/do,
Liczba ocen od/do, checkboxy Grill/Termorobot, „Zastosuj” i „Wyczyść”.
Każde pole ma widoczną etykietę, `aria-label`, a błędy `aria-describedby`.
Przycisk zwijania na ekranach `<960px` ma `aria-expanded`; pokazuje tekst
„Filtry (N)” z liczbą aktywnych filtrów. Panel jest domyślnie zwinięty w
układzie mobilnym, rozwijalny klawiaturą. Zmiana liczby wyników po zastosowaniu
lub wyczyszczeniu jest emitowana w regionie `aria-live="polite"`; nie ogłaszać
zmiany każdej strony.

CSS używa breakpointu 960px, siatki pól na desktopie i jednej kolumny na
małych ekranach. Tabela zachowuje istniejące przewijanie poziome i `opacity`
przy odświeżaniu. Nie stosować białych overlayów.

## 5. AdminApiService

Rozszerzyć `getRecipes(query)` o parametry z planu API przez `URLSearchParams`.
Dla `categoryIds` używać wielokrotnego `category_id`; `uncategorized=true`
wysyłać tylko gdy zaznaczone. Daty, liczby, teksty i flagi serializować
deterministycznie. Obsługa błędów/statusów pozostaje bez zmian; `400` z API
pokazać jako błąd formularza tylko dla walidacji lokalnej, a pozostałe błędy
w istniejącym stanie tabeli.

## 6. Testy Vitest (bez E2E)

Najpierw `import 'zone.js'` i `zone.js/testing`; Material testy z
`NoopAnimationsModule`, mocki przez `vi.fn()`.

`admin-recipes-filters.component.spec.ts`:
- render wszystkich pól, etykiety/ARIA i przyciski (scen. 1, 20);
- brak żądania przy zmianie pola, jedno `apply` po kliknięciu/Enter (2);
- trim, walidacja tekstu/ID/zakresów/dat/ratingów/licznika (15);
- kategorie OR + „Bez kategorii”, znaczniki i licznik aktywnych (5, 9);
- kategorie w loading/error/retry.

`admin-recipes-page.component.spec.ts`:
- zastosowanie i wyczyszczenie zawsze wysyła `page: 1`, zachowuje sortowanie
  i rozmiar (2, 12);
- paginacja zachowuje zastosowane filtry, niezastosowane zmiany nie wpływają
  na query; zmiana rozmiaru i sortowania wraca na stronę 1 (13);
- brak wyników aktywnych filtrów vs pusta baza, błąd z zachowanymi wartościami,
  retry, loading/opacity, spóźnione odpowiedzi i korekta strony (14, 18);
- mapowanie liczby wyników do `aria-live`, 401/403, stan kategorii (17, 20).

`admin-recipes-table.component.spec.ts` zachowuje testy PS-204 i dodaje
komunikat „Brak przepisów spełniających wybrane kryteria.” oraz akcję „Wyczyść
filtry”. `admin-api.service.spec.ts` sprawdza deterministyczny query string,
wielokrotne `category_id`, wszystkie zakresy i flagi (3–11, 19).

Pokrycie scenariuszy: 1–2, 12–15, 18, 20 w widoku; 3–11, 16–17, 19 wspólnie
z planem API. Nie planować testów E2E.

## 7. Weryfikacja

Uruchomić `npm run test`, `npm run lint` i `npm run build`. Ręcznie na
`/admin/recipes` sprawdzić desktop i `<960px`: zastosowanie filtrów, Enter,
Wyczyść, kategorię „Bez kategorii”, polskie znaki, e-mail, zakresy, 0–0,
oba znaczniki, brak wyników, błąd i ponowienie, zmianę strony/rozmiaru/
sortowania z filtrami oraz komunikat dostępności. Statusy zapisać jako
`PASS`/`FAIL`/`NIE_WYKONANO`; bez zmian w `project-summary.md` na tym etapie.
