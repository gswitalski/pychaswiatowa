# PS-99: Ocenianie przepisu w skali 1–5 — Plan UI

> **User Story:** PS-99 — Ocenianie przepisu w skali 1–5
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass
> **Powiązane:** `PS-99-recipe-rating-user-story.md`, `PS-99-recipe-rating-api-plan.md`, `PS-99-recipe-rating-deployment-plan.md`
> **Wzorzec:** PS-95 (`RecipeFlagsService`, `RecipeFlagTogglesComponent`, integracja przez `RecipeDetailViewComponent`)

---

## 1. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeRatingService` | **Nowy** | `src/app/core/services/recipe-rating.service.ts` |
| `RecipeRatingComponent` (`pych-recipe-rating`) | **Nowy** | `src/app/shared/components/recipe-rating/` |
| `RecipeHeaderComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-detail/components/recipe-header/` (slot `ng-content` pod tytułem) |
| `RecipeDetailViewComponent` | **Modyfikacja** | `src/app/shared/components/recipe-detail-view/` (osadzenie oceny, nowe outputy) |
| `RecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-detail/` (obsługa `ratingChange`) |
| `ExploreRecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/explore/explore-recipe-detail/` (jw.) |
| Typy `RecipeRatingDto`, `UpdateRecipeRatingCommand`, pola `average_rating` / `ratings_count` / `my_rating` | **Modyfikacja** | `shared/contracts/types.ts` (opis w planie API) |
| Testy jednostkowe | **Nowe / rozszerzone** | `recipe-rating.service.spec.ts`, `recipe-rating.component.spec.ts`, rozszerzenie speców widoku szczegółów i stron |

**Trasy i guardy — bez zmian:** `/recipes/:id-:slug`, `/explore/recipes/:id-:slug`.
**Struktura katalogów:** bez zmian (nowe pliki w istniejących `core/services` i `shared/components`), więc sekcja „Project Structure" w regułach nie wymaga aktualizacji.

**Poza zakresem PS-99:** średnia ocen na kafelkach i listach, sortowanie i filtr po ocenie w `/explore`, komentarze, histogram ocen, ocenianie z poziomu kafelka.

---

## 2. Komponent ocen na widoku szczegółów

**Widoki:** `/recipes/:id-:slug` (prywatny, zalogowany) i `/explore/recipes/:id-:slug` (publiczny, gość i zalogowany). Oba renderuje wspólny `RecipeDetailViewComponent`, więc komponent osadzamy w jednym miejscu.

### 2.1 Miejsce w interfejsie

W przeciwieństwie do przełączników flag PS-95 (akcje w `pych-page-header`, widoczne tylko dla zalogowanych) ocena jest **informacją o przepisie widoczną także dla gościa**. Dlatego trafia do bloku z tytułem, **bezpośrednio pod `<h1>`** (przed liczbą porcji i opisem), a nie do paska akcji.

`RecipeHeaderComponent` dostaje opcjonalny slot projekcji treści:

```html
<!-- recipe-header.component.html -->
<header class="recipe-header">
    <h1 class="recipe-title">{{ recipe().name }}</h1>

    <ng-content select="[recipeRating]" />

    @if (servingsLabel()) { … }
```

`RecipeDetailViewComponent` wstawia komponent w slot:

```html
<pych-recipe-header [recipe]="recipe()!" [isPublic]="isPublicView()">
    @if (recipe()!.visibility === 'PUBLIC' && recipe()!.ratings_count !== null) {
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

- Warunek `visibility === 'PUBLIC'` realizuje scenariusz 6 (frontend nie pokazuje ocen dla przepisów niepublicznych). `ratings_count !== null` jest drugą barierą, bo API zwraca `null` dla niepublicznych.
- **Autor własnego przepisu `PRIVATE`/`SHARED`** nie widzi komponentu w ogóle (brak sensownych danych).
- Slot jest opcjonalny — `RecipeHeaderComponent` użyty bez niego wygląda jak dotąd.
- **Wąski ekran:** komponent zawija się pod tytułem (`flex-wrap: wrap`); gwiazdki 32×32 px z paddingiem, cel dotyku ≥ 44 px.

### 2.2 Stany prezentacji

Jeden komponent, cztery tryby wyznaczane z wejść (`isAuthenticated`, `isOwner`):

| Tryb | Warunek | Co widzi użytkownik |
|---|---|---|
| `interactive` | zalogowany, nie autor | 5 klikalnych gwiazdek (własna ocena podświetlona), podsumowanie, przycisk „Usuń ocenę" gdy ocena istnieje |
| `guest` | niezalogowany | 5 gwiazdek tylko do odczytu (wypełnione wg średniej), podsumowanie, link „Zaloguj się, aby ocenić" |
| `owner` | zalogowany autor | 5 gwiazdek tylko do odczytu wg średniej, podsumowanie, komunikat „Nie możesz oceniać własnych przepisów" |
| `empty` (modyfikator) | `ratingsCount === 0` | „Brak ocen" zamiast średniej; w trybie `interactive` zachęta „Bądź pierwszą osobą, która oceni ten przepis" |

**Treść podsumowania** (format PL, przecinek dziesiętny):

| Dane | Wyświetlany tekst |
|---|---|
| `average = 4.3`, `count = 27` | `★ 4,3 / 5 · 27 ocen` |
| `average = 5`, `count = 1` | `★ 5,0 / 5 · 1 ocena` |
| `average = 3.5`, `count = 3` | `★ 3,5 / 5 · 3 oceny` |
| `count = 0` | `Brak ocen` (bez „0,0" i bez „0 ocen"; scenariusz 8) |

Odmiana: **1 ocena**, **2–4 oceny** (z wyjątkiem 12–14), pozostałe **ocen**. Formatowanie liczby przez `Intl.NumberFormat('pl-PL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })` (niezależnie od zarejestrowanego locale Angulara).

**Gwiazdki w trybach tylko do odczytu** pokazują **średnią** (zaokrągloną do najbliższej całości dla wypełnienia: `Math.round(average)`); dokładna wartość jest w tekście obok. W trybie `interactive` gwiazdki pokazują **własną ocenę** (nie średnią), żeby użytkownik widział, co zagłosował. Średnia jest wtedy wyłącznie w tekście.

### 2.3 Ikony, teksty, kolory

| Element | Ikona / tekst | Uwagi |
|---|---|---|
| Gwiazdka pusta | `star_border` | |
| Gwiazdka wypełniona | `star` | kolor `var(--pych-rating-star-color)` (domyślnie `var(--mat-sys-tertiary)`; do skorygowania z projektantem bez zmiany logiki) |
| Gwiazdka w podglądzie hover | `star` | kolor jak wypełniona, lekko przezroczysta (`opacity: 0.7`) |
| Usuń ocenę | przycisk tekstowy (`mat-button`) „Usuń ocenę" | widoczny tylko, gdy `myRating !== null` i tryb `interactive` |
| Gość | link „Zaloguj się, aby ocenić" | emituje `loginRequested` (obsługuje istniejące `onLogin()`) |
| Autor | tekst „Nie możesz oceniać własnych przepisów" | `mat-icon` `info_outline`, `aria-hidden` |
| Tooltip gwiazdki | „Oceń na {n} z 5" (`interactive`); „Twoja ocena: {n}. Kliknij ponownie, aby usunąć" (gwiazda aktualnej oceny) | `matTooltip` |

### 2.4 Dostępność (scenariusze 1–3 oraz DoD)

Wzorzec **radiogroup** dla trybu `interactive`:

- kontener `role="radiogroup"` z `aria-label="Twoja ocena przepisu"`,
- każda gwiazdka to `<button role="radio" [attr.aria-checked]="…" [attr.aria-label]="n + ' z 5'">`,
- **roving tabindex:** `tabindex="0"` ma wyłącznie zaznaczona gwiazdka (przy braku oceny — pierwsza), pozostałe `-1`,
- obsługa klawiszy: `ArrowRight`/`ArrowUp` (+1) i `ArrowLeft`/`ArrowDown` (−1) **tylko przesuwają fokus** (i podgląd gwiazdek), a **zapis następuje dopiero na `Enter`/`Spacja`**. Odstępstwo od klasycznego radio (gdzie strzałka zaznacza) jest celowe: każde zaznaczenie to osobne żądanie do API, więc przeglądanie strzałkami nie może wysyłać serii zapisów. `Home`/`End` — pierwsza/ostatnia gwiazdka,
- toggle (ponowne kliknięcie zaznaczonej gwiazdki wycofuje ocenę) **nie jest standardowym zachowaniem radio**, dlatego **zawsze** dostępny jest też przycisk „Usuń ocenę" — pełnoprawna ścieżka dla klawiatury i czytników ekranu,
- podsumowanie (`★ 4,3 / 5 · 27 ocen`) w `aria-live="polite"` — czytnik ekranu ogłasza nowe wartości po zapisie,
- w trybach tylko do odczytu: jeden element `role="img"` z `aria-label="Średnia ocena 4,3 na 5 na podstawie 27 ocen"`, gwiazdki `aria-hidden="true"`,
- widoczny fokus (domyślny Material); ikony w `mat-icon` z `aria-hidden="true"`.

### 2.5 `RecipeRatingComponent` — kontrakt

```typescript
@Component({
    selector: 'pych-recipe-rating',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, MatTooltipModule],
    templateUrl: './recipe-rating.component.html',
    styleUrl: './recipe-rating.component.scss',
})
export class RecipeRatingComponent {
    private readonly ratingService = inject(RecipeRatingService);
    private readonly snackBar = inject(MatSnackBar);

    readonly recipeId = input.required<number>();
    /** Średnia z API (źródło prawdy po załadowaniu / po udanym zapisie); null = brak ocen */
    readonly averageRating = input<number | null>(null);
    readonly ratingsCount = input<number>(0);
    /** Własna ocena z API; null = brak */
    readonly myRating = input<number | null>(null);
    readonly isAuthenticated = input.required<boolean>();
    readonly isOwner = input.required<boolean>();

    /** Po udanym zapisie: pełny stan z odpowiedzi API */
    readonly ratingChange = output<RecipeRatingDto>();
    /** Po 401 — rodzic przekierowuje do logowania (jak flagsSessionExpired) */
    readonly sessionExpired = output<void>();
    /** Klik w „Zaloguj się, aby ocenić" */
    readonly loginRequested = output<void>();

    protected readonly mode = computed<'interactive' | 'guest' | 'owner'>(() => {
        if (!this.isAuthenticated()) return 'guest';
        return this.isOwner() ? 'owner' : 'interactive';
    });

    // Stan lokalny (optymistyczny tylko dla własnych gwiazdek), synchronizowany z inputami
    protected readonly selected = linkedSignal<number | null>(() => this.myRating());
    protected readonly hovered = signal<number | null>(null);
    protected readonly pending = signal(false);
}
```

Logika `rate(value)` (kliknięcie gwiazdki `value ∈ 1..5` lub „Usuń ocenę" = `null`):

1. **Guard:** tryb inny niż `interactive` albo `pending()` → `return` (ochrona przed podwójnym kliknięciem).
2. `previous = selected()`; `next = (value === previous) ? null : value` (toggle: ta sama gwiazdka wycofuje; „Usuń ocenę" przekazuje `null` bezpośrednio).
3. **Optymistycznie:** `selected.set(next)`, `pending.set(true)`.
4. `RecipeRatingService.setRating(recipeId, next)`.
5. **Sukces:** `selected.set(response.my_rating)` (źródło prawdy), `pending.set(false)`, `ratingChange.emit(response)`. Średnia i liczba głosów aktualizują się przez rodzica (input), po odpowiedzi API (bez przeliczania lokalnie — zaokrąglona średnia nie pozwala na dokładne wyliczenie). Snackbar (`MatSnackBar`, akcja „OK", 3 s) — **treść zależy od przejścia**:
    - `previous === null` → `next !== null`: „Twoja ocena została zapisana",
    - `previous !== null` → `next !== null`: „Twoja ocena została zaktualizowana",
    - `next === null`: „Twoja ocena została usunięta".
6. **Błąd:** `selected.set(previous)` (rollback), `pending.set(false)`, snackbar:
    - `401` → „Sesja wygasła. Zaloguj się ponownie." + `sessionExpired.emit()` (jak `flagsSessionExpired`),
    - `403`/`404` (przepis przestał być publiczny / stał się własnością) → „Nie udało się zapisać oceny. Spróbuj ponownie." — dodatkowo informacja nie ujawnia powodu,
    - pozostałe (`400`, `5xx`, brak sieci, timeout) → „Nie udało się zapisać oceny. Spróbuj ponownie." (5 s) — scenariusz 7.

Szczegóły zachowania:

- **Podgląd hover:** `mouseenter` na gwiazdce `n` ustawia `hovered = n`, `mouseleave` na grupie — `null`. Wyświetlany stan gwiazdek = `hovered() ?? selected()`. Na urządzeniach dotykowych bez hovera pominięte (brak zdarzeń). W trakcie `pending` hover jest ignorowany.
- **Blokada podczas zapisu:** gwiazdki i „Usuń ocenę" mają `[disabled]="pending()"` z `[disabledInteractive]="true"`, aby fokus klawiatury nie znikał w trakcie zapisu.
- **Synchronizacja z rodzicem:** `linkedSignal` resetuje `selected`, gdy rodzic zmieni `myRating` (po `ratingChange` lub przy nawigacji do innego przepisu). Zmiana wejścia **nie nadpisuje** wartości w trakcie `pending` (ten sam warunek co w `RecipeFlagTogglesComponent`).
- **Średnia i liczba w trakcie zapisu:** pozostają ze starego stanu do czasu odpowiedzi (pojawia się lekki wskaźnik `aria-busy="true"` na podsumowaniu). Brak „skakania" wartości przy rollbacku.
- Komponent **nie zna** pojęcia roli — dostępny dla `user`, `premium`, `admin` bez rozróżnień. Autora wyznacza rodzic (`isOwner`).

### 2.6 `RecipeRatingService`

```typescript
@Injectable({ providedIn: 'root' })
export class RecipeRatingService {
    private readonly supabase = inject(SupabaseService);

    /** PUT /functions/v1/recipes/{id}/rating; rating = null wycofuje ocenę. */
    setRating(recipeId: number, rating: number | null): Observable<RecipeRatingDto> {
        const body: UpdateRecipeRatingCommand = { rating };
        return from(
            this.supabase.functions.invoke<RecipeRatingDto>(`recipes/${recipeId}/rating`, {
                method: 'PUT',
                body,
            })
        ).pipe(
            map((response) => {
                if (response.error || !response.data) {
                    // Błąd z polem status (400/401/403/404/500), jak w RecipeFlagsService
                    throw toApiError(response.error);
                }
                return response.data;
            })
        );
    }
}
```

Tak jak pozostałe serwisy: **wyłącznie** `supabase.functions.invoke` (bez `supabase.from`). Mapowanie statusu błędu — ten sam mechanizm co w `RecipeFlagsService` (`error.status` / `error.context.status`); najlepiej współdzielić istniejący helper zamiast kopiować.

### 2.7 Integracja w stronach szczegółów

`RecipeDetailViewComponent` dostaje dwa nowe outputy i je przekazuje:

```typescript
readonly ratingChange = output<RecipeRatingDto>();
readonly ratingSessionExpired = output<void>();
```

W obu stronach (`RecipeDetailPageComponent`, `ExploreRecipeDetailPageComponent`):

```html
<pych-recipe-detail-view
    ...
    (ratingChange)="onRatingChange($event)"
    (ratingSessionExpired)="onLogin()"
/>
```

```typescript
onRatingChange(rating: RecipeRatingDto): void {
    this.state.update((s) => ({
        ...s,
        recipe: s.recipe
            ? {
                ...s.recipe,
                my_rating: rating.my_rating,
                average_rating: rating.average_rating,
                ratings_count: rating.ratings_count,
            }
            : null,
    }));
}
```

(Wzorzec spread jak `onFlagsChange`.) Po udanym zapisie stan rodzica zgadza się ze stanem komponentu, a po odświeżeniu strony `GET …/{id}` zwraca te same wartości (scenariusz 1: „po odświeżeniu stan gwiazdek i średnia są zachowane").

### 2.8 Stany i przypadki brzegowe

| Sytuacja | Zachowanie UI |
|---|---|
| Zalogowany, cudzy `PUBLIC`, brak oceny | Interaktywne gwiazdki, zachęta do pierwszej oceny (sc. 1, 8) |
| Zalogowany, cudzy `PUBLIC`, ma ocenę | Gwiazdki do wysokości własnej oceny; klik innej = zmiana, klik tej samej lub „Usuń ocenę" = wycofanie (sc. 2, 3) |
| Gość | Średnia + gwiazdki read-only + „Zaloguj się, aby ocenić" (sc. 4) |
| Autor własnego `PUBLIC` | Średnia + read-only + „Nie możesz oceniać własnych przepisów" (sc. 5) |
| Przepis `PRIVATE` / `SHARED` (także autora) | Komponent nie jest renderowany (sc. 6) |
| Przepis `PUBLIC` bez ocen | „Brak ocen" (bez „0,0"), gość: read-only puste gwiazdki (sc. 8) |
| Zapis w toku | Gwiazdki zablokowane (`disabledInteractive`), brak drugiego żądania |
| Błąd sieci / `5xx` | Rollback gwiazdek + snackbar „Nie udało się zapisać oceny. Spróbuj ponownie." (sc. 7) |
| `401` | Rollback + snackbar sesji + przekierowanie do logowania |
| `403` / `404` w trakcie (przepis przestał być publiczny) | Rollback + snackbar błędu |
| Odświeżenie strony | Stan z API (`my_rating`, agregaty) |
| Przejście do innego przepisu (zmiana parametru trasy) | `linkedSignal` resetuje stan lokalny z nowych wejść |

### 2.9 ASCII — blok tytułu (desktop)

Zalogowany, nie autor, ocena 4:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Szarlotka babci                                                      │
│ ★ ★ ★ ★ ☆   ★ 4,3 / 5 · 27 ocen   [ Usuń ocenę ]                      │
│ ▲ twoja ocena: 4                                                     │
│ 8 porcji                                                             │
│ Klasyczna szarlotka z cynamonem…                                     │
└──────────────────────────────────────────────────────────────────────┘
```

Zalogowany, brak ocen przepisu:

```
│ Szarlotka babci                                                      │
│ ☆ ☆ ☆ ☆ ☆   Brak ocen · Bądź pierwszą osobą, która oceni ten przepis │
```

Gość:

```
│ Szarlotka babci                                                      │
│ ★ ★ ★ ★ ☆   ★ 4,3 / 5 · 27 ocen   Zaloguj się, aby ocenić            │
```

Autor:

```
│ Szarlotka babci                                                      │
│ ★ ★ ★ ★ ☆   ★ 4,3 / 5 · 27 ocen   ⓘ Nie możesz oceniać własnych przepisów │
```

---

## 3. Historyjka użytkownika (szczegółowa)

**Jako** zalogowany użytkownik przeglądający publiczne przepisy innych autorów,
**chcę** jednym kliknięciem ocenić przepis w skali 1–5 gwiazdek i w razie potrzeby zmienić lub wycofać ocenę,
**aby** wyrazić opinię i pomóc innym wybrać najlepsze przepisy, bez informowania autora.

**Kroki:**

1. Użytkownik loguje się, otwiera `/explore` i kafelek cudzego publicznego przepisu (`/explore/recipes/:id-:slug`).
2. Pod tytułem widzi 5 pustych gwiazdek, średnią „★ 4,3 / 5 · 27 ocen" i brak własnej oceny.
3. Najeżdża na czwartą gwiazdkę — pierwsze cztery podświetlają się w podglądzie.
4. Klika czwartą gwiazdkę — gwiazdki natychmiast zostają wypełnione, a w tle wysyłane jest `PUT /recipes/{id}/rating` z `{ "rating": 4 }`. Pojawia się snackbar „Twoja ocena została zapisana", a średnia i liczba ocen aktualizują się po odpowiedzi API (np. „★ 4,3 / 5 · 28 ocen").
5. Odświeża stronę — stan gwiazdek i średnia są zachowane.
6. Klika piątą gwiazdkę — ocena zmienia się na 5, snackbar „Twoja ocena została zaktualizowana", liczba ocen bez zmian.
7. Klika piątą gwiazdkę ponownie (lub „Usuń ocenę") — gwiazdki się opróżniają, snackbar „Twoja ocena została usunięta", liczba ocen spada o 1.
8. **Alternatywa — błąd sieci:** gwiazdki wracają do poprzedniego stanu, snackbar: „Nie udało się zapisać oceny. Spróbuj ponownie."
9. **Alternatywa — gość:** widzi średnią i gwiazdki tylko do odczytu oraz link „Zaloguj się, aby ocenić".
10. **Alternatywa — autor przepisu:** widzi średnią oraz komunikat „Nie możesz oceniać własnych przepisów".

---

## 4. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `RecipeRatingService` | `setRating` wysyła `PUT recipes/{id}/rating` z `{ rating }` (także `null`); mapuje `error.status` (400/401/403/404/500) |
| `RecipeRatingComponent` | Tryb `interactive`: klik gwiazdki 4 → natychmiastowe wypełnienie 4 gwiazdek, `aria-checked="true"` na 4., wywołanie serwisu z `4`, snackbar „zapisana" (sc. 1) |
| `RecipeRatingComponent` | Klik innej gwiazdki przy istniejącej ocenie → serwis z nową wartością, snackbar „zaktualizowana" (sc. 2) |
| `RecipeRatingComponent` | Klik tej samej gwiazdki → serwis z `null`, gwiazdki puste, snackbar „usunięta"; to samo dla przycisku „Usuń ocenę" (sc. 3) |
| `RecipeRatingComponent` | Przycisk „Usuń ocenę" widoczny tylko przy istniejącej ocenie w trybie `interactive` |
| `RecipeRatingComponent` | Po sukcesie emituje `ratingChange` z pełnym stanem; `selected` pochodzi z odpowiedzi API |
| `RecipeRatingComponent` | Hover na gwiazdce `n` podświetla `1..n`, opuszczenie grupy wraca do stanu zapisanego; w trakcie `pending` hover ignorowany |
| `RecipeRatingComponent` | Zapis w toku: drugi klik ignorowany, `disabled`, tylko 1 wywołanie serwisu |
| `RecipeRatingComponent` | Błąd `500`/sieć/timeout → rollback gwiazdek + snackbar „Nie udało się zapisać oceny. Spróbuj ponownie." (sc. 7) |
| `RecipeRatingComponent` | `401` → rollback + snackbar sesji + emit `sessionExpired`; `403`/`404` → rollback + snackbar błędu |
| `RecipeRatingComponent` | Tryb `guest`: brak przycisków, `role="img"` z etykietą, link „Zaloguj się, aby ocenić" emituje `loginRequested`; klik nie wywołuje serwisu (sc. 4) |
| `RecipeRatingComponent` | Tryb `owner`: brak przycisków, komunikat „Nie możesz oceniać własnych przepisów", średnia widoczna (sc. 5) |
| `RecipeRatingComponent` | `ratingsCount = 0`: „Brak ocen", bez „0,0"; w `interactive` zachęta do pierwszej oceny (sc. 8) |
| `RecipeRatingComponent` | Formatowanie: `4,3`, `5,0`; odmiana „1 ocena", „2 oceny", „5 ocen", „12 ocen", „22 oceny" |
| `RecipeRatingComponent` | Dostępność: `role="radiogroup"`/`radio`, roving tabindex, `Enter`/`Spacja` zapisują, strzałki przesuwają fokus, `aria-live` na podsumowaniu |
| `RecipeRatingComponent` | Zmiana wejścia `myRating` z rodzica aktualizuje stan; nie nadpisuje wartości w trakcie zapisu |
| `RecipeDetailViewComponent` | Komponent ocen renderowany dla `PUBLIC` (gość i zalogowany), **nie** renderowany dla `PRIVATE`/`SHARED` oraz gdy `ratings_count === null` (sc. 6) |
| Strony szczegółów (prywatna i explore) | `ratingChange` aktualizuje `recipe.my_rating`, `average_rating`, `ratings_count`; `ratingSessionExpired` wywołuje `onLogin()` |

**E2E (Playwright)** — zgodnie z DoD:

1. Zalogowany otwiera szczegóły cudzego publicznego przepisu, ocenia na 4, odświeża stronę — gwiazdki i średnia zachowane.
2. Zmienia ocenę na 5, następnie wycofuje ją (toggle) — liczba ocen wraca do poprzedniej.
3. Wycofanie przez przycisk „Usuń ocenę".
4. Gość: widzi średnią i gwiazdki read-only, brak możliwości oceny, link do logowania.
5. Autor własnego publicznego przepisu: komunikat „Nie możesz oceniać własnych przepisów", brak interaktywnych gwiazdek.
6. Drugie konto ocenia ten sam przepis — średnia i liczba ocen widoczne dla pierwszego konta po odświeżeniu.

**Test manualny:** układ bloku ocen na telefonie (360 px) w trzech trybach; nawigacja klawiaturą i czytnik ekranu (ogłaszanie nowej średniej po zapisie).

---

## 5. Checklist implementacji (UI)

- [ ] Typy w `shared/contracts/types.ts` (zgodnie z planem API)
- [ ] `RecipeRatingService` + testy
- [ ] `RecipeRatingComponent` (tryby `interactive`/`guest`/`owner`, optymistyczne gwiazdki, hover, toggle + „Usuń ocenę", rollback, snackbary, radiogroup + roving tabindex, `aria-live`) + testy
- [ ] Slot `ng-content select="[recipeRating]"` w `RecipeHeaderComponent` (opcjonalny, bez zmiany wyglądu bez projekcji)
- [ ] Integracja w `RecipeDetailViewComponent` (warunek `PUBLIC`, outputy `ratingChange`, `ratingSessionExpired`, `loginRequested` → `onLogin()`)
- [ ] Obsługa w `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent` (`onRatingChange`, `onLogin`)
- [ ] Odmiana „ocena/oceny/ocen" i format liczby PL
- [ ] Responsywność bloku ocen (zawijanie, cel dotyku ≥ 44 px)
- [ ] Regresja: przełączniki flag PS-95, „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", chipy i tagi w nagłówku, CTA gościa
- [ ] Test E2E (Playwright) i test manualny mobile / a11y
