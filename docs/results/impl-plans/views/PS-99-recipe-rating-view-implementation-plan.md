# Plan implementacji widoku — Ocenianie przepisu w skali 1–5 (PS-99)

## 1. Przegląd

Nie powstaje nowy ekran. Jest to rozszerzenie istniejącego widoku szczegółów przepisu o blok ocen, który pokazuje:

- **średnią ocen i liczbę głosów** — publicznie, także dla gościa,
- **własną ocenę użytkownika** (podświetlone gwiazdki) — tylko dla zalogowanego, który nie jest autorem przepisu,
- **interaktywne gwiazdki 1–5** z możliwością zapisu, zmiany i wycofania oceny (optimistic update, rollback, snackbary).

Ocenianie dotyczy wyłącznie przepisów o widoczności `PUBLIC`. Autor nie może oceniać własnych przepisów. Oceny pojawiają się tylko na widoku szczegółów. Kafelki i listy, sortowanie oraz filtr po ocenie są poza zakresem.

Warstwa API jest już gotowa (`PUT /recipes/{id}/rating`, pola `average_rating`, `ratings_count`, `my_rating` w szczegółach), a typy `RecipeRatingDto`, `UpdateRecipeRatingCommand` i rozszerzone `RecipeDetailDto` są w `shared/contracts/types.ts`. Frontend nie wymaga zmian w typach współdzielonych.

Wzorzec implementacji: PS-95 (`RecipeFlagsService`, `RecipeFlagTogglesComponent`, integracja przez `RecipeDetailViewComponent`). Główna różnica: ocena jest informacją o przepisie widoczną także dla gościa, więc trafia pod tytuł w `RecipeHeaderComponent`, a nie do paska akcji `pych-page-header`.

## 2. Routing widoku

Bez zmian w routingu i guardach.

| Widok | Trasa | Dostęp | Dane ocen pochodzą z |
|---|---|---|---|
| Szczegóły przepisu (prywatny) | `/recipes/:id-:slug` | zalogowany | `GET /recipes/{id}` |
| Szczegóły przepisu (publiczny) | `/explore/recipes/:id-:slug` | gość i zalogowany | `GET /explore/recipes/{id}` |

Oba widoki renderuje wspólny `RecipeDetailViewComponent`, więc komponent ocen osadzamy w jednym miejscu. Struktura katalogów się nie zmienia (nowe pliki trafiają do istniejących `core/services` i `shared/components`), więc sekcja „Project Structure" w `.cursor/rules/project.mdc` nie wymaga aktualizacji.

## 3. Struktura komponentów

```
[NOWY]   RecipeRatingService                 src/app/core/services/recipe-rating.service.ts
[NOWY]   RecipeRatingComponent               src/app/shared/components/recipe-rating/
             recipe-rating.component.ts          (pych-recipe-rating)
             recipe-rating.component.html
             recipe-rating.component.scss
             recipe-rating.utils.ts              (czyste funkcje: odmiana, format liczby, etykiety)
             recipe-rating.component.spec.ts
             recipe-rating.utils.spec.ts

[MODYFIKACJA] RecipeHeaderComponent          src/app/pages/recipes/recipe-detail/components/recipe-header/
  └── slot <ng-content select="[recipeRating]" /> pod <h1>

[MODYFIKACJA] RecipeDetailViewComponent      src/app/shared/components/recipe-detail-view/
  ├── computed showRating
  ├── nowy output ratingChange, ratingSessionExpired
  └── <pych-recipe-rating recipeRating …> wewnątrz <pych-recipe-header>

[MODYFIKACJA] RecipeDetailPageComponent      src/app/pages/recipes/recipe-detail/
  └── onRatingChange(), bindowanie outputów
[MODYFIKACJA] ExploreRecipeDetailPageComponent  src/app/pages/explore/explore-recipe-detail/
  └── onRatingChange(), bindowanie outputów
```

Hierarchia w DOM:

```
pych-recipe-detail-view
└── .recipe-detail-container
    ├── pych-page-header (tylko zalogowany: flagi PS-95, akcje)      ← bez zmian
    └── .recipe-content
        └── .recipe-header-section
            ├── pych-recipe-header
            │   ├── <h1> nazwa
            │   ├── [slot] pych-recipe-rating                        ← NOWE
            │   ├── porcje, opis, czasy, klasyfikacja, chipy
            └── pych-recipe-image
```

## 4. Szczegóły komponentów

### RecipeRatingService

- Opis: singleton w `core/services`, jedyna warstwa dostępu do `PUT /recipes/{id}/rating`. Wyłącznie `supabase.functions.invoke` (zgodnie z regułą „frontend nie operuje na tabelach Supabase").
- Główne elementy: metoda `setRating(recipeId: number, rating: number | null): Observable<RecipeRatingDto>`; prywatna `extractStatusFromError`.
- Obsługiwane interakcje: brak (serwis bezstanowy).
- Obsługiwana walidacja: zakres wartości sprawdza API (zod, RPC, `CHECK`). Serwis nie waliduje biznesowo, tylko mapuje błędy HTTP na `Error` z polem `status`.
- Typy: `RecipeRatingDto`, `UpdateRecipeRatingCommand`.
- Propsy: brak (DI, `providedIn: 'root'`).

Szkielet (wzorzec 1:1 z `RecipeFlagsService`; w projekcie nie ma współdzielonego helpera, każdy serwis ma własną prywatną kopię `extractStatusFromError`, więc robimy tak samo i nie refaktoryzujemy innych serwisów w tym zadaniu):

```typescript
@Injectable({ providedIn: 'root' })
export class RecipeRatingService {
    private readonly supabase = inject(SupabaseService);

    setRating(recipeId: number, rating: number | null): Observable<RecipeRatingDto> {
        const body: UpdateRecipeRatingCommand = { rating };

        return from(
            this.supabase.functions.invoke<RecipeRatingDto>(
                `recipes/${recipeId}/rating`,
                { method: 'PUT', body }
            )
        ).pipe(
            map((response) => {
                if (response.error) {
                    const error = new Error(response.error.message) as Error & { status: number };
                    error.status = this.extractStatusFromError(response.error) ?? 500;
                    throw error;
                }

                if (!response.data) {
                    const error = new Error('Nie udało się zapisać oceny przepisu') as Error & { status: number };
                    error.status = 500;
                    throw error;
                }

                return response.data;
            })
        );
    }
}
```

`extractStatusFromError` czyta kolejno `error.status`, `error.context.status`, a na końcu dopasowuje tekst komunikatu (`unauthorized`, `not found`, `bad request`). Dla PS-99 dodajemy jeszcze `forbidden` → `403`.

---

### RecipeRatingComponent (`pych-recipe-rating`)

- Opis: samodzielny komponent prezentujący i obsługujący ocenę przepisu. Trzy tryby wyznaczane z wejść (`interactive`, `guest`, `owner`) plus modyfikator „brak ocen". Odpowiada za optimistic update własnej oceny, blokadę podwójnego kliknięcia, rollback, snackbary, formatowanie podsumowania i dostępność. Nie zna ról użytkownika — autora wyznacza rodzic.
- Główne elementy HTML:
  - tryb `interactive`: kontener `div.rating-stars[role="radiogroup"]` z 5 przyciskami `button[mat-icon-button][role="radio"]` (każdy z `mat-icon` `star` / `star_border`) oraz przycisk tekstowy `button[mat-button]` „Usuń ocenę" (tylko gdy jest własna ocena),
  - tryby `guest` i `owner`: `span.rating-stars[role="img"]` z 5 ikonami `aria-hidden="true"`,
  - `span.rating-summary[aria-live="polite"]` z tekstem podsumowania,
  - tryb `guest`: przycisk `mat-button` „Zaloguj się, aby ocenić",
  - tryb `owner`: `span.rating-note` z ikoną `info_outline` i tekstem „Nie możesz oceniać własnych przepisów",
  - tryb `interactive` bez ocen: `span.rating-hint` „Bądź pierwszą osobą, która oceni ten przepis".
- Obsługiwane interakcje:
  - klik gwiazdki `n` → `rate(n)`,
  - klik „Usuń ocenę" → `rate(null)`,
  - `mouseenter` gwiazdki → podgląd `1..n`; `mouseleave` grupy → powrót do stanu zapisanego,
  - klawiatura: `ArrowRight`/`ArrowUp` (+1), `ArrowLeft`/`ArrowDown` (−1), `Home`/`End` — tylko przesuwają fokus i podgląd; `Enter`/`Spacja` zapisują (natywne `click` przycisku, bez własnego handlera),
  - klik „Zaloguj się, aby ocenić" → `loginRequested`.
- Obsługiwana walidacja:
  - tryb inny niż `interactive` → `rate()` kończy się bez efektu (guard),
  - `pending() === true` → `rate()` kończy się bez efektu (brak drugiego żądania),
  - wysyłana wartość jest zawsze `1..5` (pochodzi z gwiazdek) lub `null` (wycofanie),
  - toggle: kliknięcie gwiazdki równej aktualnej ocenie wysyła `null`,
  - przycisk „Usuń ocenę" renderowany tylko gdy `selected() !== null`,
  - nie wyświetlamy „0,0" ani „0 ocen" (patrz pkt 9).
- Typy: `RecipeRatingDto`, `RecipeRatingMode`, `RatingStar` (pkt 5).
- Propsy (interfejs komponentu):

```typescript
readonly recipeId = input.required<number>();
/** Średnia z API; null = brak ocen. */
readonly averageRating = input<number | null>(null);
readonly ratingsCount = input<number>(0);
/** Własna ocena z API; null = brak. */
readonly myRating = input<number | null>(null);
readonly isAuthenticated = input.required<boolean>();
readonly isOwner = input.required<boolean>();

/** Po udanym zapisie: pełny stan z odpowiedzi API. */
readonly ratingChange = output<RecipeRatingDto>();
/** Po 401 — rodzic przekierowuje do logowania. */
readonly sessionExpired = output<void>();
/** Klik w „Zaloguj się, aby ocenić". */
readonly loginRequested = output<void>();
```

Stan wewnętrzny (szczegóły w pkt 6) i logika `rate()` — w pkt 6 oraz 8.

---

### RecipeHeaderComponent (modyfikacja)

- Opis: dodajemy opcjonalny slot projekcji treści pod tytułem.
- Główne elementy: `<ng-content select="[recipeRating]" />` bezpośrednio po `<h1 class="recipe-title">`, przed blokiem porcji.
- Obsługiwane interakcje: brak nowych.
- Obsługiwana walidacja: brak.
- Typy: bez zmian.
- Propsy: bez zmian.

Użycie bez slotu wygląda dokładnie jak dotychczas. Odstęp pod blokiem ocen zapewnia `:host { display: block; margin: 0 0 16px; }` w `recipe-rating.component.scss`, więc przy braku komponentu nic się nie przesuwa. Dotychczasowy `.recipe-title` ma `margin-bottom: 8px` i zostaje.

---

### RecipeDetailViewComponent (modyfikacja)

- Opis: osadza komponent ocen w slocie nagłówka, decyduje, czy go pokazać, i przekazuje zdarzenia do strony.
- Główne elementy: `<pych-recipe-rating recipeRating …>` jako dziecko `<pych-recipe-header>`, otoczone `@if (showRating())`. Angular projektuje blok `@if` z jednym elementem głównym przez selektor `[recipeRating]` (atrybut musi być na elemencie głównym bloku).
- Obsługiwane interakcje: przekazuje `ratingChange`, `sessionExpired` → `ratingSessionExpired`, `loginRequested` → istniejące `onLogin()`.
- Obsługiwana walidacja: `showRating` (patrz niżej).
- Typy: `RecipeRatingDto`.
- Propsy: istniejące; **nowe outputy** poniżej.

```typescript
readonly ratingChange = output<RecipeRatingDto>();
readonly ratingSessionExpired = output<void>();

/** Ocena tylko dla przepisów PUBLIC z dostępnymi agregatami (API maskuje niepubliczne wartością null). */
protected readonly showRating = computed(() => {
    const recipe = this.recipe();
    if (recipe === null || recipe.id === null) return false;
    if (recipe.visibility !== 'PUBLIC') return false;
    return recipe.ratings_count != null;
});
```

```html
<pych-recipe-header [recipe]="recipe()!" [isPublic]="isPublicView()">
    @if (showRating()) {
        <pych-recipe-rating
            recipeRating
            [recipeId]="recipe()!.id!"
            [averageRating]="recipe()!.average_rating ?? null"
            [ratingsCount]="recipe()!.ratings_count ?? 0"
            [myRating]="recipe()!.my_rating ?? null"
            [isAuthenticated]="isAuthenticated()"
            [isOwner]="isOwner()"
            (ratingChange)="ratingChange.emit($event)"
            (sessionExpired)="ratingSessionExpired.emit()"
            (loginRequested)="onLogin()"
        />
    }
</pych-recipe-header>
```

Dodać `RecipeRatingComponent` do `imports` komponentu.

---

### RecipeDetailPageComponent i ExploreRecipeDetailPageComponent (modyfikacje)

- Opis: strony utrzymują stan przepisu w `state` (signal) — po udanym zapisie oceny aktualizują `my_rating`, `average_rating`, `ratings_count`, tak jak `onFlagsChange` robi to dla flag.
- Główne elementy: dwa nowe bindingi w szablonie, jedna nowa metoda.
- Obsługiwane interakcje: `ratingChange` → `onRatingChange`, `ratingSessionExpired` → `onLogin()` (przekierowanie do `/login?returnUrl=…`).
- Obsługiwana walidacja: brak (dane są już zwalidowane przez API).
- Typy: `RecipeRatingDto`.
- Propsy: brak.

```html
(ratingChange)="onRatingChange($event)"
(ratingSessionExpired)="onLogin()"
```

```typescript
onRatingChange(rating: RecipeRatingDto): void {
    this.state.update((state) => ({
        ...state,
        recipe: state.recipe
            ? {
                ...state.recipe,
                my_rating: rating.my_rating,
                average_rating: rating.average_rating,
                ratings_count: rating.ratings_count,
            }
            : null,
    }));
}
```

Obie strony mają już `isOwner` (porównanie `recipe.user_id` z `currentUserId`), `isAuthenticated` i `onLogin()` — nie dodajemy nowej logiki roli.

## 5. Typy

### DTO (już istnieją w `shared/contracts/types.ts`)

| Typ | Pola |
|---|---|
| `RecipeRatingDto` | `recipe_id: number`, `my_rating: number \| null`, `average_rating: number \| null`, `ratings_count: number` |
| `UpdateRecipeRatingCommand` | `rating: number \| null` |
| `RecipeDetailDto` (rozszerzony) | `average_rating: number \| null`, `ratings_count: number \| null` (`null` = oceny niedostępne dla przepisu niepublicznego), `my_rating?: number \| null` (brak klucza dla gościa) |

Interpretacja `RecipeDetailDto` po stronie widoku:

| Przepis | `average_rating` | `ratings_count` | `my_rating` | Komponent |
|---|---|---|---|---|
| `PUBLIC`, bez ocen | `null` | `0` | `null` / brak klucza | renderowany, „Brak ocen" |
| `PUBLIC`, z ocenami | `4.3` | `27` | `1..5` / `null` / brak klucza | renderowany |
| `PRIVATE` / `SHARED` | `null` | `null` | `null` | nie renderowany |

### ViewModel i typy pomocnicze (nowe, w `recipe-rating.component.ts` / `recipe-rating.utils.ts`)

| Typ | Definicja | Opis |
|---|---|---|
| `RecipeRatingMode` | `'interactive' \| 'guest' \| 'owner'` | tryb prezentacji wyznaczany z `isAuthenticated` i `isOwner` |
| `RatingStar` | `1 \| 2 \| 3 \| 4 \| 5` | wartość pojedynczej gwiazdki |
| `RATING_STARS` | `readonly RatingStar[] = [1, 2, 3, 4, 5]` | źródło pętli `@for` |

Funkcje pomocnicze (`recipe-rating.utils.ts`, czyste i testowane osobno):

| Funkcja | Sygnatura | Zachowanie |
|---|---|---|
| `formatAverageRating` | `(value: number): string` | `Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` → `4,3`, `5,0` (niezależnie od zarejestrowanego `LOCALE_ID`) |
| `pluralizeRatings` | `(count: number): string` | `1` → „ocena"; `n % 10 ∈ {2,3,4}` i `n % 100 ∉ {12,13,14}` → „oceny"; w pozostałych „ocen" (analogicznie do `getServingsWord` w `RecipeHeaderComponent`) |
| `buildRatingSummary` | `(average: number \| null, count: number): string` | `count === 0` → `Brak ocen`; inaczej `★ 4,3 / 5 · 27 ocen`; gdy `average === null` przy `count > 0` (niespójne dane) → `27 ocen` |
| `buildReadonlyAriaLabel` | `(average: number \| null, count: number): string` | `Średnia ocena 4,3 na 5 na podstawie 27 ocen`; `Brak ocen` dla zera |

Przykłady podsumowania: `4.3 / 27` → `★ 4,3 / 5 · 27 ocen`; `5 / 1` → `★ 5,0 / 5 · 1 ocena`; `3.5 / 3` → `★ 3,5 / 5 · 3 oceny`; `null / 0` → `Brak ocen`.

## 6. Zarządzanie stanem

Stan lokalny w komponencie na signalach (bez NgRx i bez customowego hooka). OnPush.

| Stan | Typ | Cel |
|---|---|---|
| `mode` | `computed<RecipeRatingMode>` | `!isAuthenticated` → `guest`; `isOwner` → `owner`; inaczej `interactive` |
| `selected` | `linkedSignal<number \| null>` | własna ocena wyświetlana w UI (optymistyczna), synchronizowana z `myRating` |
| `pending` | `signal<boolean>` | zapis w toku; blokuje klik i hover |
| `hovered` | `signal<RatingStar \| null>` | podgląd gwiazdek pod kursorem |
| `focusedStar` | `signal<RatingStar \| null>` | gwiazdka z fokusem klawiatury; steruje roving tabindex i podglądem |
| `displayValue` | `computed<number>` | ile gwiazdek wypełnić w trybie `interactive`: podczas `pending` → `selected() ?? 0`; poza tym `hovered() ?? focusedStar() ?? selected() ?? 0` |
| `readonlyFilled` | `computed<number>` | `Math.round(averageRating() ?? 0)` — gwiazdki w trybach `guest` i `owner` pokazują średnią |
| `isEmpty` | `computed<boolean>` | `ratingsCount() === 0` |
| `summaryText` | `computed<string>` | `buildRatingSummary(averageRating(), ratingsCount())` |
| `rovingStar` | `computed<RatingStar>` | `focusedStar() ?? selected() ?? 1` — gwiazdka z `tabindex="0"` |

**Ważne — synchronizacja** `selected` **z rodzicem.** Używamy formy `linkedSignal({ source, computation })` jak w `RecipeFlagTogglesComponent`, a nie skróconego `linkedSignal(() => this.myRating())`. Skrócona forma nadpisałaby wartość optymistyczną, gdyby rodzic zmienił `myRating` w trakcie zapisu:

```typescript
protected readonly selected = linkedSignal<number | null, number | null>({
    source: this.myRating,
    computation: (myRating, previous) =>
        this.pending() && previous ? previous.value : myRating,
});
```

Podgląd klawiaturowy (`focusedStar`) czyścimy na `blur` grupy oraz po udanym zapisie, żeby nie zasłaniał nowego stanu.

Przepływ `rate(value)`:

1. Guard: `mode() !== 'interactive'` lub `pending()` → `return`.
2. `previous = selected()`, `next = value === previous ? null : value` (dla „Usuń ocenę" `value` to `null`, więc `next = null`).
3. Optymistycznie: `selected.set(next)`, `pending.set(true)`.
4. `RecipeRatingService.setRating(recipeId(), next)`.
5. Sukces: `selected.set(response.my_rating)`, `pending.set(false)`, `focusedStar.set(null)`, `ratingChange.emit(response)`, snackbar zależny od przejścia (pkt 8).
6. Błąd: `selected.set(previous)`, `pending.set(false)`, snackbar błędu (pkt 10); przy `401` dodatkowo `sessionExpired.emit()`.

Średnia i liczba głosów **nie są liczone lokalnie** (zaokrąglona średnia nie pozwala wyliczyć dokładnej wartości) — aktualizuje je rodzic po `ratingChange`. W trakcie zapisu podsumowanie zachowuje stare wartości i ma `aria-busy="true"`, więc przy rollbacku nic nie „skacze".

Żądanie HTTP emituje jedną wartość i się kończy, a na wypadek zniszczenia komponentu w trakcie zapisu subskrypcję zabezpiecza `takeUntilDestroyed(this.destroyRef)`.

Własny stan `state` w stronach szczegółów pozostaje źródłem prawdy dla przepisu; po `ratingChange` input `myRating` zmienia się na wartość z odpowiedzi, a `linkedSignal` (przy `pending === false`) ustawia tę samą wartość.

## 7. Integracja API

| Element | Wartość |
|---|---|
| Metoda i URL | `PUT /functions/v1/recipes/{id}/rating` (przez `supabase.functions.invoke('recipes/{id}/rating', …)`) |
| Autoryzacja | JWT zalogowanego (dowolna rola); dołącza go klient Supabase |
| Żądanie | `UpdateRecipeRatingCommand` → `{ "rating": 1..5 }` lub `{ "rating": null }` (wycofanie) |
| Odpowiedź `200` | `RecipeRatingDto` → `{ recipe_id, my_rating, average_rating, ratings_count }` |
| Idempotencja | tak; ten sam zapis zwraca ten sam stan |

Odczyt danych ocen nie wymaga nowych wywołań — pola przychodzą już w istniejących żądaniach szczegółów:

| Strona | Wywołanie | Pola |
|---|---|---|
| `/recipes/:id-:slug` | `RecipesService.getRecipeById` → `GET /recipes/{id}` | `average_rating`, `ratings_count`, `my_rating` |
| `/explore/recipes/:id-:slug` | `ExploreRecipesService.getExploreRecipeById` → `GET /explore/recipes/{id}` | jw.; dla gościa brak klucza `my_rating` |

Nie trzeba zmieniać tych dwóch serwisów, ponieważ zwracają `RecipeDetailDto`, a ten typ już zawiera nowe pola.

Kody odpowiedzi i reakcja frontendu:

| Kod | Znaczenie | Reakcja |
|---|---|---|
| `200` | zapisano / zmieniono / wycofano | emit `ratingChange`, snackbar sukcesu |
| `400` | złe `id` / ciało | rollback, snackbar błędu ogólnego |
| `401` | brak lub nieważny JWT | rollback, snackbar „Sesja wygasła…", `sessionExpired` |
| `403` | użytkownik jest autorem | rollback, snackbar błędu ogólnego |
| `404` | przepis nie istnieje albo nie jest `PUBLIC` | rollback, snackbar błędu ogólnego |
| `5xx` / sieć / timeout | błąd serwera | rollback, snackbar błędu ogólnego |

Cache: odpowiedzi z JWT mają `no-store`, więc po odświeżeniu zalogowany widzi aktualne dane. Gość może zobaczyć agregat opóźniony do 60 s — akceptowalne, bez zmian po stronie frontendu.

## 8. Interakcje użytkownika

| # | Interakcja | Oczekiwany wynik | Scenariusz |
|---|---|---|---|
| 1 | Zalogowany, nie autor, brak oceny — klik gwiazdki 4 | Cztery gwiazdki wypełnione od razu; `PUT {rating: 4}`; po odpowiedzi średnia i liczba głosów zaktualizowane; snackbar „Twoja ocena została zapisana" | 1 |
| 2 | Odświeżenie strony | Gwiazdki i średnia z API (`my_rating`, agregaty) | 1 |
| 3 | Ma ocenę 4 — klik gwiazdki 5 | Ocena zastąpiona; liczba głosów bez zmian; snackbar „Twoja ocena została zaktualizowana" | 2 |
| 4 | Ma ocenę 5 — klik gwiazdki 5 (toggle) lub „Usuń ocenę" | `PUT {rating: null}`; gwiazdki puste; liczba głosów −1; snackbar „Twoja ocena została usunięta" | 3 |
| 5 | Gość otwiera szczegóły publicznego przepisu | Średnia i liczba głosów (np. `★ 4,3 / 5 · 27 ocen`), gwiazdki read-only, link „Zaloguj się, aby ocenić"; brak wywołań `PUT` | 4 |
| 6 | Gość klika „Zaloguj się, aby ocenić" | `loginRequested` → `onLogin()` → `/login?returnUrl=…` | 4 |
| 7 | Autor otwiera własny publiczny przepis | Średnia i liczba głosów, gwiazdki read-only, komunikat „Nie możesz oceniać własnych przepisów" | 5 |
| 8 | Przepis `PRIVATE` / `SHARED` | Komponent nie jest renderowany | 6 |
| 9 | Błąd `5xx` / sieć / timeout przy zapisie | Rollback gwiazdek, snackbar „Nie udało się zapisać oceny. Spróbuj ponownie." | 7 |
| 10 | Przepis publiczny bez ocen | „Brak ocen" (bez „0,0"); zalogowany nie-autor: interaktywne gwiazdki + zachęta „Bądź pierwszą osobą, która oceni ten przepis"; gość: puste gwiazdki read-only | 8 |
| 11 | Najazd na gwiazdkę `n` | Podgląd `1..n` (kolor jak wypełniona, `opacity: 0.7`); opuszczenie grupy wraca do stanu zapisanego; podczas `pending` hover ignorowany | — |
| 12 | Klawiatura: strzałki / `Home` / `End` | Przesuwa fokus i podgląd, nie wysyła żądań | — |
| 13 | Klawiatura: `Enter` / `Spacja` na gwiazdce | Zapis oceny (jak klik) | — |
| 14 | Szybki drugi klik w trakcie zapisu | Ignorowany; dokładnie jedno wywołanie serwisu | — |

Treść snackbara sukcesu zależy od przejścia `previous → next`:

| `previous` | `next` | Komunikat |
|---|---|---|
| `null` | liczba | „Twoja ocena została zapisana" |
| liczba | liczba | „Twoja ocena została zaktualizowana" |
| dowolne | `null` | „Twoja ocena została usunięta" |

Snackbar sukcesu: `MatSnackBar.open(msg, 'OK', { duration: 3000 })`.

Tooltipy (`matTooltip`): „Oceń na {n} z 5" oraz na gwiazdce aktualnej oceny „Twoja ocena: {n}. Kliknij ponownie, aby usunąć".

Dostępność (tryb `interactive`):

- kontener `role="radiogroup"` z `aria-label="Twoja ocena przepisu"`,
- każdy przycisk `role="radio"`, `[attr.aria-checked]="selected() === star"`, `[attr.aria-label]="star + ' z 5'"`,
- roving tabindex: `tabindex="0"` ma tylko `rovingStar()`, pozostałe `-1`,
- strzałki przesuwają fokus (`viewChildren` z referencjami do przycisków, `focus()`), zapis dopiero na `Enter`/`Spacja`, bo każde zaznaczenie to osobne żądanie,
- „Usuń ocenę" jest zawsze dostępne jako pełnoprawna ścieżka dla klawiatury i czytników (toggle nie jest standardowym zachowaniem radio),
- podsumowanie w `aria-live="polite"`,
- tryby read-only: jeden element `role="img"` z `aria-label` ze średnią, gwiazdki `aria-hidden="true"`,
- ikony w `mat-icon` z `aria-hidden="true"`, widoczny fokus (domyślny Material).

Wygląd:

- gwiazdka pusta `star_border`, wypełniona `star` w kolorze `var(--pych-rating-star-color, var(--mat-sys-tertiary))`; kolory wyłącznie ze zmiennych Material (`--mat-sys-*`),
- gwiazdki 32×32 px z cel dotyku ≥ 44 px (padding lub `min-width`/`min-height` na przycisku),
- blok `display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px;` — zawija się pod tytułem na wąskich ekranach.

## 9. Warunki i walidacja

Warunki sprawdzane przez interfejs:

| Warunek | Komponent | Wpływ na UI |
|---|---|---|
| `visibility === 'PUBLIC'` | `RecipeDetailViewComponent` (`showRating`) | niepubliczny → brak bloku ocen (sc. 6); wspiera blokadę po stronie API (`404`) |
| `ratings_count != null` | `RecipeDetailViewComponent` | druga bariera — API maskuje niepubliczne `null`-em |
| `recipe.id !== null` | `RecipeDetailViewComponent` | brak `recipeId` → brak komponentu |
| `isAuthenticated` | `RecipeRatingComponent` (`mode`) | `false` → tryb `guest`: read-only, link logowania, brak żądań (sc. 4); wspiera `401` |
| `isOwner` | `RecipeRatingComponent` (`mode`) | `true` → tryb `owner`: read-only, komunikat; wspiera `403` (sc. 5) |
| `ratingsCount === 0` | `RecipeRatingComponent` | „Brak ocen", bez „0,0"; zachęta tylko w trybie `interactive` (sc. 8) |
| `selected() !== null` | `RecipeRatingComponent` | pokazuje przycisk „Usuń ocenę" |
| `pending()` | `RecipeRatingComponent` | `disabled` + `disabledInteractive` na gwiazdkach i „Usuń ocenę", hover ignorowany, guard w `rate()` |
| wartość `1..5` lub `null` | `RecipeRatingComponent` | gwarantowane konstrukcją UI (5 przycisków + wycofanie); spełnia walidację API (`400` przy innych) |

Warunki wymagane przez API i ich pokrycie po stronie widoku:

| Warunek API | Pokrycie na froncie |
|---|---|
| `id` całkowite > 0 | `recipeId` pochodzi z załadowanego przepisu (strony szczegółów już walidują parametr trasy) |
| Ciało `{ rating }` z polem obowiązkowym, `1..5` lub `null`, bez pól dodatkowych | `UpdateRecipeRatingCommand` zawsze zawiera tylko `rating`; wartości z gwiazdek lub `null` |
| JWT wymagany | brak wywołań w trybie `guest`; `401` obsłużone rollbackiem i przekierowaniem |
| Autor nie może oceniać (`403`) | tryb `owner` bez interaktywnych gwiazdek |
| Przepis musi być `PUBLIC` (`404`) | `showRating` ukrywa komponent dla niepublicznych |

## 10. Obsługa błędów

| Sytuacja | Zachowanie |
|---|---|
| Błąd sieci / timeout / `5xx` / `400` | Rollback `selected` do `previous`, `pending = false`, snackbar „Nie udało się zapisać oceny. Spróbuj ponownie." (`duration: 5000`), brak emisji `ratingChange` |
| `401` (sesja wygasła) | Rollback, snackbar „Sesja wygasła. Zaloguj się ponownie.", `sessionExpired.emit()` → rodzic wywołuje `onLogin()` |
| `403` (autor) / `404` (przepis przestał być publiczny, usunięty) | Rollback, snackbar „Nie udało się zapisać oceny. Spróbuj ponownie." — celowo bez ujawniania powodu |
| Pusta odpowiedź `200` bez `data` | Serwis rzuca błąd `status: 500` → ścieżka jak dla `5xx` |
| Podwójny klik / klik w trakcie zapisu | Ignorowany (guard `pending`) |
| `average_rating = null` przy `ratings_count > 0` (niespójne dane) | Podsumowanie `N ocen` bez średniej; gwiazdki read-only puste; brak wyjątku |
| `my_rating` nieobecne (gość) | `?? null` w widoku; tryb `guest` nie używa `myRating` |
| Zmiana przepisu przez nawigację (inny `:id`) | Inputy się zmieniają; `linkedSignal` resetuje `selected` (przy `pending = false`); zapis w toku poprzedniego przepisu kończy się snackbarem, ale `ratingChange` trafia do strony, która aktualizuje `state` — przed emisją sprawdzić zgodność `response.recipe_id` z aktualnym `recipeId()` i pominąć emit przy niezgodności |
| Odpowiedź po zniszczeniu komponentu | `takeUntilDestroyed` — brak aktualizacji sygnałów |
| Błąd ładowania samego przepisu | Obsługiwany istniejącym stanem błędu `RecipeDetailViewComponent`; komponent ocen się nie renderuje |

Błędy zapisu są pokazywane wyłącznie w snackbarze (nie blokują reszty widoku), zgodnie z wzorcem PS-95.

## 11. Kroki implementacji

1. Zweryfikować, że `shared/contracts/types.ts` zawiera `RecipeRatingDto`, `UpdateRecipeRatingCommand` oraz pola `average_rating`, `ratings_count`, `my_rating` w `RecipeDetailDto` (są już dodane — brak zmian) i że lokalny backend (`supabase start`, migracja `20261027120000_create_recipe_ratings.sql`) działa; sprawdzić ręcznie `GET /explore/recipes/{id}` dla publicznego przepisu.
2. Utworzyć `src/app/core/services/recipe-rating.service.ts` (`setRating`, prywatne `extractStatusFromError` z dodatkowym mapowaniem `forbidden` → `403`).
3. Utworzyć `recipe-rating.service.spec.ts`: `PUT recipes/{id}/rating` z `{ rating: 4 }` oraz `{ rating: null }`; mapowanie statusów `400/401/403/404/500` (z `error.status`, `error.context.status` i z komunikatu); pusta odpowiedź → błąd `500`.
4. Utworzyć `recipe-rating.utils.ts` (`formatAverageRating`, `pluralizeRatings`, `buildRatingSummary`, `buildReadonlyAriaLabel`, `RATING_STARS`, typy) oraz `recipe-rating.utils.spec.ts` (`4,3`, `5,0`; „1 ocena", „2 oceny", „5 ocen", „12 ocen", „14 ocen", „22 oceny"; `Brak ocen` dla zera; brak „0,0").
5. Utworzyć `RecipeRatingComponent` (`.ts`, `.html`, `.scss`): selektor `pych-recipe-rating`, standalone, `OnPush`, importy `MatButtonModule`, `MatIconModule`, `MatTooltipModule`; inputy, outputy, signale i `linkedSignal` w formie `{ source, computation }`; `rate()`, `onHover`, `onGroupLeave`, `onKeydown`, `onFocusStar`, `onBlurGroup`; szablon z trzema trybami; style w SCSS (`:host`, flex-wrap, kolory `--mat-sys-*`, `--pych-rating-star-color`, cel dotyku ≥ 44 px, `opacity: 0.7` dla podglądu). Wcięcia 4 spacje, zmienne z `private`/`protected`/`readonly` jawnie.
6. Napisać `recipe-rating.component.spec.ts` według wzorca `recipe-flag-toggles.component.spec.ts` (inicjalizacja środowiska zone.js i Vitest, mocki `RecipeRatingService` i `MatSnackBar`):
   - sc. 1: klik gwiazdki 4 → 4 gwiazdki wypełnione od razu, `aria-checked="true"` na czwartej, serwis z `4`, snackbar „zapisana", `ratingChange` z odpowiedzią,
     - sc. 2: klik innej gwiazdki przy istniejącej ocenie → serwis z nową wartością, snackbar „zaktualizowana",
     - sc. 3: klik tej samej gwiazdki → serwis z `null`, puste gwiazdki, „usunięta"; to samo dla „Usuń ocenę"; przycisk widoczny tylko przy istniejącej ocenie,
     - sc. 7: błąd `500`/sieć → rollback + snackbar błędu; `401` → rollback + snackbar sesji + `sessionExpired`; `403`/`404` → rollback + snackbar błędu,
     - sc. 4: tryb `guest` — brak przycisków `radio`, `role="img"` z etykietą, link „Zaloguj się, aby ocenić" emituje `loginRequested`, serwis niewywoływany,
     - sc. 5: tryb `owner` — brak przycisków, komunikat „Nie możesz oceniać własnych przepisów", średnia widoczna,
     - sc. 8: `ratingsCount = 0` — „Brak ocen", bez „0,0"; zachęta tylko w `interactive`,
     - zapis w toku: drugi klik ignorowany, `disabled`, jedno wywołanie serwisu,
     - hover: `1..n` w podglądzie, `mouseleave` przywraca stan, brak reakcji podczas `pending`,
     - a11y: `radiogroup`/`radio`, roving tabindex, strzałki przesuwają fokus bez wywołania serwisu, `Enter`/`Spacja` zapisują, `aria-live` na podsumowaniu,
     - synchronizacja: zmiana `myRating` z rodzica aktualizuje stan, ale nie nadpisuje wartości w trakcie `pending`,
     - niezgodność `recipe_id` w odpowiedzi → brak `ratingChange`.
7. Zmodyfikować `RecipeHeaderComponent`: dodać `<ng-content select="[recipeRating]" />` po `<h1>`; upewnić się, że bez projekcji wygląd jest bez zmian.
8. Zmodyfikować `RecipeDetailViewComponent`: dodać import `RecipeRatingComponent`, computed `showRating`, outputy `ratingChange` i `ratingSessionExpired`, osadzenie w `<pych-recipe-header>` zgodnie z pkt 4.
9. Zmodyfikować `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent`: import `RecipeRatingDto`, metoda `onRatingChange`, bindingi `(ratingChange)` i `(ratingSessionExpired)` w szablonach.
10. Dodać (nowe) testy integracyjne widoku i stron — w repozytorium nie ma jeszcze speców dla `RecipeDetailViewComponent` ani stron szczegółów, więc tworzymy minimalne:
    - `recipe-detail-view.component.spec.ts`: komponent ocen renderowany dla `PUBLIC` (gość i zalogowany); nie renderowany dla `PRIVATE`/`SHARED` oraz gdy `ratings_count === null`; przekazanie `ratingChange` i `ratingSessionExpired`; `loginRequested` wywołuje `login`,
      - testy `onRatingChange` w obu stronach (aktualizacja `my_rating`, `average_rating`, `ratings_count`; `ratingSessionExpired` wywołuje `onLogin()`).
11. Uruchomić `ng test` (Vitest) oraz `ng build`; sprawdzić lintery dla zmienionych plików.
12. Test manualny na lokalnym środowisku (użytkownik testowy z reguł projektu) dla przepisu innego autora, własnego przepisu i przepisu prywatnego:
    - ocena → odświeżenie → zmiana → wycofanie (toggle i „Usuń ocenę"),
      - gość w oknie prywatnym: średnia, read-only, link logowania,
      - autor: komunikat o blokadzie,
      - błąd sieci (DevTools → Offline): rollback i snackbar,
      - układ na 360 px w trzech trybach, nawigacja klawiaturą i czytnik ekranu (ogłaszanie nowej średniej),
      - regresja: przełączniki flag PS-95, „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", chipy i tagi w nagłówku, CTA gościa.
13. Zaktualizować `docs/results/project-summary.md`: w sekcji 0 dopisać, że PS-99 obejmuje już także widok (`RecipeRatingService`, `RecipeRatingComponent` na `/recipes/:id-:slug` i `/explore/recipes/:id-:slug`); usunąć zdanie „Interfejs użytkownika do wystawiania ocen jest poza tym zakresem"; w sekcjach „Widoki UI" i „Komponenty globalne" dodać komponent ocen; w „Granicach" doprecyzować, że oceny gwiazdkowe są wdrożone, a komentarze i recenzje tekstowe nadal nie.
