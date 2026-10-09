# Plan implementacji widoku — Osobiste flagi przepisu PS-95 („Ulubiony" i „Chcę wypróbować")

## 1. Przegląd

Widok nie jest nowym ekranem — to zestaw modyfikacji istniejących komponentów i widoków w ramach user story PS-95. Celem jest umożliwienie zalogowanemu użytkownikowi oznaczania przepisów osobistymi flagami:

- **„Ulubiony"** (serduszko) — widoczny na widokach szczegółów jako interaktywny przełącznik oraz na kafelkach jako nieklikalny wskaźnik.
- **„Chcę wypróbować"** (ikona zakładki/flagi) — widoczny wyłącznie na widokach szczegółów jako interaktywny przełącznik.

Flagi są prywatne (widzi je tylko właściciel), niezależne od siebie, dostępne dla wszystkich ról (`user`, `premium`, `admin`) i mogą być ustawiane na przepisach własnych oraz cudzych publicznych (`PUBLIC`). Implementacja obejmuje: nowy serwis frontendowy, nowy komponent przełączników, rozszerzenie komponentu karty przepisu oraz 5 mapperów zasilających karty.

---

## 2. Routing widoku

Flagi są dostępne na istniejących trasach — **bez zmian w routingu**:

| Widok | Trasa | Rola flag |
|---|---|---|
| Szczegóły przepisu (prywatny) | `/recipes/:id-:slug` | Przełączniki flag (toggle) |
| Szczegóły przepisu (publiczny) | `/explore/recipes/:id-:slug` | Przełączniki flag (toggle, tylko zalogowany) |
| Moje przepisy | `/my-recipies` | Wskaźnik serduszka na kafelku |
| Dashboard | `/dashboard` | Wskaźnik serduszka na kafelku |
| Szczegóły kolekcji | `/collections/:id` | Wskaźnik serduszka na kafelku |
| Katalog Explore | `/explore` | Wskaźnik serduszka na kafelku |
| Landing (zalogowany) | `/` | Wskaźnik serduszka na kafelku |

---

## 3. Struktura komponentów

```
[NOWY]   RecipeFlagsService                     src/app/core/services/recipe-flags.service.ts
[NOWY]   RecipeFlagTogglesComponent             src/app/shared/components/recipe-flag-toggles/
             recipe-flag-toggles.component.ts
             recipe-flag-toggles.component.html
             recipe-flag-toggles.component.scss
             recipe-flag-toggles.component.spec.ts

[MODYFIKACJA] RecipeDetailViewComponent         src/app/shared/components/recipe-detail-view/
  └── [NOWY] <pych-recipe-flag-toggles>         (osadzony w bloku page-header, nad gałęziami headerMode)

[MODYFIKACJA] RecipeDetailPageComponent         src/app/pages/recipes/recipe-detail/
  └── obsługa nowych outputów flagsChange, flagsSessionExpired z RecipeDetailViewComponent

[MODYFIKACJA] ExploreRecipeDetailPageComponent  src/app/pages/explore/explore-recipe-detail/
  └── obsługa nowych outputów flagsChange, flagsSessionExpired z RecipeDetailViewComponent

[MODYFIKACJA] RecipeCardComponent               src/app/shared/components/recipe-card/
  └── nowy wskaźnik .favorite-indicator w .card-image-container
  └── rozszerzenie RecipeCardData o isFavorite?: boolean

[MODYFIKACJA] Mappery (5 miejsc)
  └── recipes-list-page.component.ts             (/my-recipies)
  └── recent-recipes-list.component.ts           (/dashboard)
  └── collection-details-page.component.ts       (/collections/:id)
  └── public-recipe-results / explore            (/explore)
  └── landing-page.component.ts                  (/)
```

---

## 4. Szczegóły komponentów

### RecipeFlagsService

- **Opis:** Singleton serwis w `core/services` odpowiedzialny za komunikację z endpointem `PUT /recipes/{id}/flags`. Jedyna warstwa dostępu do API flag — enkapsuluje `supabase.functions.invoke`.
- **Główne elementy:** Metoda `setFlags(recipeId, patch)` zwracająca `Observable<RecipeFlagsDto>`. Mapowanie błędów przez `extractStatusFromError` (wzorzec z `ExploreRecipesService`).
- **Obsługiwane zdarzenia:** Brak — serwis jest bezstanowy.
- **Walidacja:** Walidacja jest po stronie API (zod na backendzie). Serwis mapuje kody błędów HTTP na rzucane błędy z polem `status`.
- **Typy:** `RecipeFlagsDto`, `UpdateRecipeFlagsCommand` (z `shared/contracts/types.ts`).
- **Propsy:** Brak (wstrzykiwany przez DI).

---

### RecipeFlagTogglesComponent (`pych-recipe-flag-toggles`)

- **Opis:** Samodzielny komponent prezentujący dwa przyciski-przełączniki (serduszko i „Chcę wypróbować") do zarządzania osobistymi flagami przepisu. Odpowiada za logikę optimistic update, blokadę podwójnego kliknięcia, cofanie stanu przy błędzie i wyświetlanie snackbara.
- **Główne elementy HTML:**
  - Dwa przyciski `mat-icon-button` z `matTooltip` i `[attr.aria-pressed]`
  - `mat-icon` z `aria-hidden="true"` wewnątrz każdego przycisku
  - Ikony: `favorite_border` / `favorite` dla serduszka; `outlined_flag` / `flag` dla „Chcę wypróbować" (rekomendacja zamiast `bookmark`, by uniknąć kolizji z `bookmark_add`)
- **Obsługiwane zdarzenia:**
  - Klik serduszka → `toggleFavorite()`
  - Klik „Chcę wypróbować" → `toggleWantToTry()`
- **Warunki walidacji:**
  - Jeśli flaga jest `pending` (trwa zapis) → ignoruj klik (guard clause)
  - `[disabled]="favoritePending()"` z `[disabledInteractive]="true"` (Material)
  - `[disabled]="wantToTryPending()"` z `[disabledInteractive]="true"`
  - Przy błędzie `401` → cofnij stan + snackbar „Sesja wygasła. Zaloguj się ponownie." + `sessionExpired.emit()`
  - Przy błędzie `400`, `404`, `5xx`, brak sieci → cofnij stan + snackbar „Nie udało się zapisać. Spróbuj ponownie."
- **Typy:** `RecipeFlagsDto`, `UpdateRecipeFlagsCommand`
- **Propsy (inputs/outputs):**

```typescript
// Inputs
readonly recipeId = input.required<number>();
readonly isFavorite = input<boolean>(false);
readonly isWantToTry = input<boolean>(false);

// Outputs
readonly flagsChange = output<RecipeFlagsDto>();   // po udanym zapisie
readonly sessionExpired = output<void>();           // po 401
```

---

### RecipeDetailViewComponent — modyfikacja

- **Opis:** Istniejący współdzielony komponent renderujący widok szczegółów przepisu dla obu kontekstów (prywatny i publiczny). Wymaga dodania przełączników flag w bloku `pych-page-header` oraz dwóch nowych outputów.
- **Nowe elementy HTML:** `<pych-recipe-flag-toggles>` wstawiony **na początku** projekcji treści w `pych-page-header`, przed gałęziami `@if (headerMode() === …)`. Renderowany wyłącznie, gdy `isAuthenticated()` jest `true`.
- **Nowe inputy:** `isFavorite`, `isWantToTry` (przekazywane do `RecipeFlagTogglesComponent` z `recipe()!.is_favorite ?? false` i `recipe()!.is_want_to_try ?? false`).
- **Nowe outputy:**

```typescript
readonly flagsChange = output<RecipeFlagsDto>();
readonly flagsSessionExpired = output<void>();
```

- **Kolejność ikon w pasku (desktop):** `[♥] [⚑]` │ `Dodaj do kolekcji` │ `Dodaj do planu` │ `Edytuj` │ `Usuń`
- **Warunki walidacji:** Przełączniki wyłączone dla gościa (brak bloku `page-header` lub dodatkowy `@if (isAuthenticated())`).
- **Typy:** `RecipeFlagsDto`
- **Propsy:** Brak nowych (flagi odczytane z istniejącego `recipe()` inputu).

---

### RecipeDetailPageComponent — modyfikacja

- **Opis:** Strona szczegółów przepisu prywatnego (`/recipes/:id-:slug`). Wymaga obsługi dwóch nowych outputów z `RecipeDetailViewComponent`.
- **Nowe metody:**

```typescript
onFlagsChange(flags: RecipeFlagsDto): void {
    this.state.update((s) => ({
        ...s,
        recipe: s.recipe
            ? { ...s.recipe, is_favorite: flags.is_favorite, is_want_to_try: flags.is_want_to_try }
            : null,
    }));
}
```

- Obsługa `flagsSessionExpired` → wywołanie istniejącego `onLogin()`.
- **Warunki walidacji:** Identyczne co w `onAddToPlan` — delegowane do `RecipeFlagTogglesComponent`.
- **Typy:** `RecipeFlagsDto` (z `shared/contracts/types.ts`).
- **Propsy:** Brak nowych.

---

### ExploreRecipeDetailPageComponent — modyfikacja

- **Opis:** Strona szczegółów przepisu w kontekście explore (`/explore/recipes/:id-:slug`). Analogiczne zmiany jak w `RecipeDetailPageComponent`.
- **Nowe metody:** `onFlagsChange(flags: RecipeFlagsDto)` — taki sam wzorzec spread jak powyżej.
- **Obsługa `flagsSessionExpired`:** → istniejące `onLogin()`.
- **Typy:** `RecipeFlagsDto`.

---

### RecipeCardComponent — modyfikacja

- **Opis:** Komponent karty przepisu używany we wszystkich widokach z listą. Wymaga dodania nieklikalnego wskaźnika serduszka w obszarze obrazu.
- **Nowy element HTML** w `.card-image-container` (po wskaźniku widoczności):

```html
@if (recipe().isFavorite) {
    <div class="favorite-indicator" role="img" aria-label="Ulubiony przepis">
        <mat-icon aria-hidden="true">favorite</mat-icon>
    </div>
}
```

- **Nowe style SCSS** (pozycja: prawy dolny róg obrazu, `pointer-events: none`, kółko z tłem `--mat-sys-surface`, ikona `--mat-sys-error`).
- **Obsługiwane zdarzenia:** Brak — `pointer-events: none` przekazuje kliknięcie do linku karty.
- **Walidacja:** Wskaźnik renderowany gdy `recipe().isFavorite === true`; brak wskaźnika gdy `false` lub `undefined`.
- **Typy:** Rozszerzenie `RecipeCardData` o `isFavorite?: boolean`.
- **Propsy:** Brak nowych inputów — `isFavorite` pochodzi z interfejsu `RecipeCardData` przekazywanego przez istniejący `recipe = input.required<RecipeCardData>()`.

---

### Mappery kafelków (5 miejsc) — modyfikacja

- **Opis:** Każde miejsce budujące `RecipeCardData` dla listy przepisów musi rozszerzyć obiekt o pole `isFavorite`.
- **Wzorzec mapowania:**

```typescript
isFavorite: recipe.is_favorite ?? false,
```

- **Miejsca:**
  1. `recipes-list-page.component.ts` — Moje przepisy (`GET /recipes`, `/recipes/feed`)
  2. `recent-recipes-list.component.ts` — Dashboard (`GET /recipes`)
  3. `collection-details-page.component.ts` — Szczegóły kolekcji (`GET /collections/{id}`)
  4. `public-recipe-results` / Explore — Katalog Explore (`GET /public/recipes/feed`)
  5. `landing-page.component.ts` — Landing (`GET /public/recipes/feed`)

---

## 5. Typy

Wszystkie typy poniżej **już istnieją** w `shared/contracts/types.ts` — nie wymagają tworzenia.

### `RecipeFlagsDto` (istniejący)

```typescript
export interface RecipeFlagsDto {
    recipe_id: number;
    is_favorite: boolean;
    is_want_to_try: boolean;
}
```

Odpowiedź endpointu `PUT /recipes/{id}/flags`. Zawsze pełny stan obu flag.

### `UpdateRecipeFlagsCommand` (istniejący)

```typescript
export interface UpdateRecipeFlagsCommand {
    is_favorite?: boolean;
    is_want_to_try?: boolean;
}
```

Ciało żądania `PUT /recipes/{id}/flags`. Co najmniej jedno pole musi być podane.

### `RecipeDetailDto` — rozszerzone pola (istniejące)

```typescript
is_favorite?: boolean;    // stan flagi „Ulubiony" dla zalogowanego
is_want_to_try?: boolean; // stan flagi „Chcę wypróbować" dla zalogowanego
```

### `RecipeListItemDto` / `PublicRecipeListItemDto` — rozszerzone pola (istniejące)

```typescript
is_favorite?: boolean; // dla zalogowanego; brak dla gościa
```

### `RecipeCardData` — rozszerzenie (modyfikacja interfejsu)

```typescript
export interface RecipeCardData {
    // ...istniejące pola...
    /** Czy zalogowany użytkownik oznaczył przepis jako ulubiony (tylko wskaźnik, nieklikalny) */
    isFavorite?: boolean;
}
```

### Lokalny typ stanu w `RecipeFlagTogglesComponent`

```typescript
// Używany wewnętrznie (nie eksportowany)
interface FlagToggleState {
    value: boolean;       // aktualny stan (optimistic)
    pending: boolean;     // czy trwa zapis dla tej flagi
}
```

---

## 6. Zarządzanie stanem

### Stan w `RecipeFlagTogglesComponent` (lokalny)

Komponent używa **sygnałów Angular** bez zewnętrznego store'a:

| Sygnał | Typ | Opis |
|---|---|---|
| `favorite` | `linkedSignal<boolean>` | Stan flagi „Ulubiony"; synchronizowany z `isFavorite` inputem; nie nadpisywany gdy `favoritePending` |
| `wantToTry` | `linkedSignal<boolean>` | Stan flagi „Chcę wypróbować"; synchronizowany z `isWantToTry` inputem; nie nadpisywany gdy `wantToTryPending` |
| `favoritePending` | `signal<boolean>` | Trwa zapis serduszka; blokuje przycisk |
| `wantToTryPending` | `signal<boolean>` | Trwa zapis „Chcę wypróbować"; blokuje przycisk |

**`linkedSignal`** resetuje wartość lokalną, gdy input zmienia się z zewnątrz (np. po `flagsChange` lub nawigacji do innego przepisu), ale **nie** nadpisuje wartości gdy flaga jest `pending` (warunek w factory function).

**Logika optimistic update (metoda `toggle(flag)`):**
1. Guard: jeśli `pending` → `return`
2. Zapamiętaj `previous = stanFlagi`, ustaw `next = !previous`
3. Optimistically: ustaw stan lokalny na `next`, `pending = true`
4. Wywołaj `RecipeFlagsService.setFlags(recipeId, { [flag]: next })`
5. Sukces: stan lokalny = odpowiedź API (source of truth), `pending = false`, `flagsChange.emit(response)`
6. Błąd: przywróć `previous`, `pending = false`, pokaż snackbar

### Stan w stronach szczegółów (RecipeDetailPageComponent, ExploreRecipeDetailPageComponent)

Po udanym `flagsChange` — aktualizacja lokalnego `state` przez `state.update()` ze spread:

```typescript
recipe: s.recipe ? { ...s.recipe, is_favorite: flags.is_favorite, is_want_to_try: flags.is_want_to_try } : null
```

Brak globalnego store'a — zgodnie ze strategią projektu (svieżość przez reload przy wejściu).

**Nie jest wymagany custom hook** — logika jest zamknięta w komponentach z użyciem wbudowanych mechanizmów Angular (signals, linkedSignal).

---

## 7. Integracja API

### Endpoint `PUT /recipes/{id}/flags`

| Atrybut | Wartość |
|---|---|
| Metoda | `PUT` |
| URL | `/functions/v1/recipes/{id}/flags` |
| Autoryzacja | Bearer JWT (wymagane) |
| Content-Type | `application/json` |

**Typ żądania:** `UpdateRecipeFlagsCommand`

```typescript
// Przykład: ustawienie serduszka (is_want_to_try pozostaje bez zmian)
{ "is_favorite": true }
```

**Typ odpowiedzi `200 OK`:** `RecipeFlagsDto`

```typescript
{ "recipe_id": 123, "is_favorite": true, "is_want_to_try": false }
```

### Implementacja serwisu

```typescript
@Injectable({ providedIn: 'root' })
export class RecipeFlagsService {
    private readonly supabase = inject(SupabaseService);

    setFlags(recipeId: number, patch: UpdateRecipeFlagsCommand): Observable<RecipeFlagsDto> {
        return from(
            this.supabase.functions.invoke<RecipeFlagsDto>(`recipes/${recipeId}/flags`, {
                method: 'PUT',
                body: patch,
            })
        ).pipe(
            map((response) => {
                if (response.error || !response.data) {
                    throw toApiError(response.error); // wzorzec z ExploreRecipesService
                }
                return response.data;
            })
        );
    }
}
```

**Mapowanie statusów błędów** (wzorzec `extractStatusFromError`):
- `400` → `VALIDATION_ERROR` (niepoprawne ciało żądania)
- `401` → `UNAUTHORIZED` (wygasła sesja)
- `404` → `NOT_FOUND` (przepis niedostępny)
- `5xx` / brak sieci → `INTERNAL_ERROR`

### Odczyt flag (endpointy GET — bez zmian frontendowych w serwisach)

Pola `is_favorite` / `is_want_to_try` są już zwracane przez API w odpowiedziach GET. Frontend odczytuje je bezpośrednio z DTO i mapuje do komponentów. Serwisy API (np. `ExploreRecipesService`, `RecipesService`) **nie wymagają zmian** — pola są opcjonalne w typach DTO i poprawnie przekazywane.

---

## 8. Interakcje użytkownika

| Akcja | Miejsce | Wynik |
|---|---|---|
| Klik serduszka (nieaktywne) | Widok szczegółów | Ikona natychmiast staje się aktywna (`favorite`, kolor `--mat-sys-error`), tooltip zmienia się na „Usuń z ulubionych", `PUT` z `{ is_favorite: true }` — po sukcesie stan z API |
| Klik serduszka (aktywne) | Widok szczegółów | Ikona wraca do `favorite_border`, tooltip „Dodaj do ulubionych", `PUT` z `{ is_favorite: false }` |
| Klik „Chcę wypróbować" (nieaktywne) | Widok szczegółów | Ikona aktywna, tooltip „Usuń z listy do wypróbowania", `PUT` z `{ is_want_to_try: true }` |
| Klik „Chcę wypróbować" (aktywne) | Widok szczegółów | Ikona nieaktywna, tooltip „Chcę wypróbować", `PUT` z `{ is_want_to_try: false }` |
| Klik flagi podczas zapisu | Widok szczegółów | Ikona zablokowana (`disabled`), kliknięcie ignorowane (ochrona przed double-click) |
| Błąd sieci / `5xx` po kliknięciu | Widok szczegółów | Ikona cofa się do poprzedniego stanu, snackbar „Nie udało się zapisać. Spróbuj ponownie." (5 s, akcja „OK") |
| Błąd `401` po kliknięciu | Widok szczegółów | Ikona cofa się, snackbar „Sesja wygasła. Zaloguj się ponownie.", przekierowanie do `/login` |
| Błąd `404` po kliknięciu | Widok szczegółów | Ikona cofa się, snackbar „Nie udało się zapisać. Spróbuj ponownie." |
| Klik serduszka na kafelku | Wszystkie listy | Nawigacja do szczegółów przepisu — ikona nie jest interaktywna (`pointer-events: none`) |
| Odświeżenie strony po ustawieniu flag | Widok szczegółów | Oba stany zachowane (dane z `GET /recipes/{id}` lub `GET /explore/recipes/{id}`) |
| Nawigacja Tab → Enter/Spacja na ikonach | Widok szczegółów | Identyczny efekt jak kliknięcie myszą (natywny `<button>`) |

---

## 9. Warunki i walidacja

| Warunek | Komponent | Wpływ na UI |
|---|---|---|
| Użytkownik jest zalogowany | `RecipeDetailViewComponent` | `@if (isAuthenticated())` — przełączniki renderowane tylko dla zalogowanych |
| Flaga jest `pending` | `RecipeFlagTogglesComponent` | Przycisk `[disabled]="pending()"` z `[disabledInteractive]="true"` — kliknięcia ignorowane, fokus klawiatury zachowany |
| Odpowiedź `200` z API | `RecipeFlagTogglesComponent` | Synchronizacja stanu lokalnego z `RecipeFlagsDto` (source of truth), `flagsChange.emit()` |
| Błąd `401` | `RecipeFlagTogglesComponent` | Rollback stanu + snackbar sesji + `sessionExpired.emit()` |
| Błąd `400 / 404 / 5xx` | `RecipeFlagTogglesComponent` | Rollback stanu + snackbar błędu ogólnego |
| `isFavorite === true` | `RecipeCardComponent` | Wskaźnik serduszka widoczny w prawym dolnym rogu obrazu karty |
| `isFavorite === false / undefined` | `RecipeCardComponent` | Brak wskaźnika |
| Gość (niezalogowany) | `RecipeCardComponent` + `RecipeDetailViewComponent` | Brak ikonek flag i brak wskaźnika na kafelkach (API nie zwraca pola dla gościa, `undefined ?? false = false`) |

---

## 10. Obsługa błędów

| Scenariusz błędu | Obsługa |
|---|---|
| Błąd sieci / `500` przy zapisie flagi | Rollback optimistic update, snackbar „Nie udało się zapisać. Spróbuj ponownie." (5 s), ikona wraca do poprzedniego stanu |
| `401 UNAUTHORIZED` | Rollback, snackbar „Sesja wygasła. Zaloguj się ponownie.", `sessionExpired.emit()` → strona szczegółów wywołuje `onLogin()` z `returnUrl` |
| `404 NOT_FOUND` (przepis usunięty lub ukryty) | Rollback, snackbar „Nie udało się zapisać. Spróbuj ponownie." (nie ujawniamy przyczyny, spójność z API) |
| `400 VALIDATION_ERROR` | Rollback, snackbar „Nie udało się zapisać. Spróbuj ponownie." (edge case — powinno być niemożliwe przy poprawnej implementacji) |
| Podwójne kliknięcie podczas zapisu | Ignorowane przez guard (`if (pending) return`) — drugie żądanie nie jest wysyłane |
| `is_favorite` brak w odpowiedzi API (gość) | `undefined ?? false = false` w mapperze — brak wskaźnika na kafelku; poprawne zachowanie |
| Błąd przy `getRecipeFlagsMap` na backendzie | Backend zwraca pustą mapę + log (non-blocking), API odpowiada normalnie bez flag; FE wyświetla `is_favorite: false` |

---

## 11. Kroki implementacji

1. **Typy** — Zweryfikować, że `RecipeFlagsDto`, `UpdateRecipeFlagsCommand`, opcjonalne pola `is_favorite`/`is_want_to_try` w `RecipeDetailDto`, `RecipeListItemDto`, `PublicRecipeDetailDto`, `PublicRecipeListItemDto` są w `shared/contracts/types.ts` (są już dodane zgodnie ze stanem pliku).

2. **Rozszerzenie `RecipeCardData`** — Dodać opcjonalne pole `isFavorite?: boolean` do interfejsu `RecipeCardData` w `src/app/shared/components/recipe-card/recipe-card.ts`.

3. **`RecipeFlagsService`** — Utworzyć plik `src/app/core/services/recipe-flags.service.ts`:
   - `@Injectable({ providedIn: 'root' })`, `ChangeDetectionStrategy` nie dotyczy serwisów
   - Metoda `setFlags(recipeId, patch)` → `Observable<RecipeFlagsDto>` przez `supabase.functions.invoke`
   - Mapowanie błędów wzorcem `extractStatusFromError` (analogicznie do `ExploreRecipesService`)
   - Testy jednostkowe w `recipe-flags.service.spec.ts`

4. **`RecipeFlagTogglesComponent`** — Utworzyć katalog `src/app/shared/components/recipe-flag-toggles/`:
   - `recipe-flag-toggles.component.ts` z inputami `recipeId`, `isFavorite`, `isWantToTry` oraz outputami `flagsChange`, `sessionExpired`
   - Stany lokalne jako `linkedSignal` (synchronizacja z inputami) i `signal` (pending per flaga)
   - Metody `toggleFavorite()`, `toggleWantToTry()`, prywatna `toggle(flag)` z logiką optimistic update
   - `[disabledInteractive]="true"` na przyciskach Material dla zachowania fokusu klawiatury
   - `aria-pressed`, `aria-label` (stały), `matTooltip` (zmienny ze stanem)
   - Import `MatSnackBar` bezpośrednio przez `inject()` do wyświetlania komunikatów
   - Styl `recipe-flag-toggles.component.scss` — flexbox, minimalny padding, kolory z `--mat-sys-*`
   - Testy jednostkowe w `recipe-flag-toggles.component.spec.ts`

5. **Modyfikacja `RecipeCardComponent`** — W pliku `recipe-card.html` dodać blok `@if (recipe().isFavorite)` z `.favorite-indicator` na końcu `.card-image-container` (przed `</div>`). W `recipe-card.scss` dodać style `.favorite-indicator` (pozycja `absolute`, prawy dolny róg, `pointer-events: none`, kolor `--mat-sys-error`). W `recipe-card.ts` zaktualizować interfejs `RecipeCardData`.

6. **Modyfikacja `RecipeDetailViewComponent`** — W `recipe-detail-view.component.ts` dodać dwa outputy `flagsChange` i `flagsSessionExpired`. W `recipe-detail-view.component.html` dodać `<pych-recipe-flag-toggles>` wewnątrz `<pych-page-header>` przed gałęziami `@if (headerMode() === …)`, otoczony `@if (isAuthenticated())`. Dodać import `RecipeFlagTogglesComponent` do tablicy `imports`.

7. **Modyfikacja `RecipeDetailPageComponent`** — W `recipe-detail-page.component.ts` dodać metodę `onFlagsChange(flags: RecipeFlagsDto)` aktualizującą `state` przez `state.update()`. W `recipe-detail-page.component.html` dodać bindingi `(flagsChange)="onFlagsChange($event)"` i `(flagsSessionExpired)="onLogin()"` do `<pych-recipe-detail-view>`. Dodać import `RecipeFlagsDto` do sekcji importów TypeScript.

8. **Modyfikacja `ExploreRecipeDetailPageComponent`** — Analogiczne zmiany jak w kroku 7 dla pliku `explore-recipe-detail-page.component.ts` i `.html`.

9. **Mappery — Moje przepisy** — W `recipes-list-page.component.ts` rozszerzyć mapper `RecipeCardData` o `isFavorite: recipe.is_favorite ?? false`.

10. **Mappery — Dashboard** — W `recent-recipes-list.component.ts` (funkcja `toCardData`) dodać `isFavorite: recipe.is_favorite ?? false`.

11. **Mappery — Szczegóły kolekcji** — W `collection-details-page.component.ts` rozszerzyć mapper o `isFavorite: recipe.is_favorite ?? false`.

12. **Mappery — Katalog Explore** — W pliku z `mapToCardData` (Explore) dodać `isFavorite: recipe.is_favorite ?? false`.

13. **Mappery — Landing** — W `landing-page.component.ts` rozszerzyć mapper `RecipeCardData` o `isFavorite: recipe.is_favorite ?? false`.

14. **Weryfikacja responsywności** — Sprawdzić ręcznie układ paska akcji na szerokości 360 px w trybach `ownerActions` i `addToCollection`. Jeśli zawijanie pogarsza layout, rozważyć fallback: umieszczenie przełączników w `pych-recipe-header` (osobna decyzja przy implementacji).

15. **Testy** — Uruchomić `vitest` i uzupełnić testy jednostkowe dla:
    - `RecipeFlagsService`: `setFlags` z poprawnymi danymi i różnymi błędami
    - `RecipeFlagTogglesComponent`: optimistic update, rollback, blokada pending, dostępność
    - `RecipeCardComponent`: wskaźnik przy `isFavorite: true`, brak przy `false/undefined`
    - Strony szczegółów: `onFlagsChange` aktualizuje stan; `flagsSessionExpired` wywołuje `onLogin`
    - Mappery (5 miejsc): `is_favorite: true` → `isFavorite: true`; brak pola → `false`

16. **Test E2E (Playwright)** — Zaimplementować scenariusze z DoD:
    - Ustawienie i zdjęcie flagi na szczegółach + odświeżenie strony
    - Serduszko na kafelku po powrocie do listy; kliknięcie serduszka nawiguje
    - Brak ikonek dla gościa

17. **Test manualny** — Nawigacja klawiaturą (`Tab` → `Enter`/`Spacja`), czytnik ekranu (`aria-pressed`, `aria-label`), układ na telefonie (360 px, oba tryby `headerMode`).
