# PS-95: Osobiste flagi przepisu „Ulubiony" i „Chcę wypróbować" — Plan UI

> **User Story:** PS-95 — Osobiste flagi przepisu „Ulubiony" (serduszko) i „Chcę wypróbować"
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass
> **Powiązane:** `PS-95-recipe-favorite-and-try-flags-user-story.md`, `PS-95-recipe-favorite-and-try-flags-api-plan.md`, `PS-95-recipe-favorite-and-try-flags-deployment-plan.md`

---

## 1. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeFlagsService` | **Nowy** | `src/app/core/services/recipe-flags.service.ts` |
| `RecipeFlagTogglesComponent` (`pych-recipe-flag-toggles`) | **Nowy** | `src/app/shared/components/recipe-flag-toggles/` |
| `RecipeCardComponent` + `RecipeCardData` | **Modyfikacja** | `src/app/shared/components/recipe-card/` (wskaźnik serduszka) |
| `RecipeDetailViewComponent` | **Modyfikacja** | `src/app/shared/components/recipe-detail-view/` (przełączniki w nagłówku akcji, nowe outputy) |
| `RecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-detail/` (obsługa `flagsChange`, sesja) |
| `ExploreRecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/explore/explore-recipe-detail/` (jw.) |
| Mappery do `RecipeCardData` (5 miejsc) | **Modyfikacja** | patrz pkt 4 |
| Typy `RecipeFlagsDto`, `UpdateRecipeFlagsCommand`, pola `is_favorite` / `is_want_to_try` | **Modyfikacja** | `shared/contracts/types.ts` (opis w planie API) |
| Testy jednostkowe | **Nowe / rozszerzone** | `recipe-flags.service.spec.ts`, `recipe-flag-toggles.component.spec.ts`, rozszerzenie speców karty i widoku szczegółów |

**Trasy i guardy — bez zmian:** `/recipes/:id-:slug`, `/explore/recipes/:id-:slug`, `/my-recipies`, `/dashboard`, `/collections/:id`, `/explore`, `/`.
**Struktura katalogów:** bez zmian (nowe pliki w istniejących `core/services` i `shared/components`), więc sekcja „Project Structure" w regułach nie wymaga aktualizacji.

**Poza zakresem PS-95:** filtrowanie / wyszukiwanie po flagach, ikonka „Chcę wypróbować" na kafelku, klikalne serduszko na kafelku, flagi dla gościa, zmiany w Sidebarze i drawerze „Mój plan".

---

## 2. Przełączniki flag na widoku szczegółów

**Widoki:** `/recipes/:id-:slug` (prywatny) i `/explore/recipes/:id-:slug` (publiczny, tylko zalogowany). Oba renderuje wspólny `RecipeDetailViewComponent`, więc przełączniki dodajemy w jednym miejscu.

### 2.1 Miejsce w interfejsie

W `recipe-detail-view.component.html` blok akcji `<pych-page-header>` (`.page-header__actions`, projekcja `<ng-content />`) pokazuje się tylko dla zalogowanego (`showPageHeader() && isAuthenticated()`). Przełączniki wstawiamy **na początku projektowanej treści**, przed gałęziami `@if (headerMode() === …)`, żeby były identyczne dla trybów `ownerActions` i `addToCollection` (bez duplikowania kodu):

```html
<pych-page-header [title]="pageTitle()">
    <pych-recipe-flag-toggles
        [recipeId]="recipe()!.id"
        [isFavorite]="recipe()!.is_favorite ?? false"
        [isWantToTry]="recipe()!.is_want_to_try ?? false"
        (flagsChange)="flagsChange.emit($event)"
        (sessionExpired)="flagsSessionExpired.emit()"
    />
    @if (headerMode() === 'ownerActions') { … }
    @else if (headerMode() === 'addToCollection') { … }
</pych-page-header>
```

- **Gość** nie widzi przełączników (nagłówek akcji jest ukryty, a pola flag nie przychodzą z API). Dodatkowo komponent renderujemy tylko dla `isAuthenticated()`.
- Kolejność w pasku (desktop): **[ ♡ ] [ 🔖 ]** │ Dodaj do kolekcji │ Dodaj do planu │ Edytuj │ Usuń.
- **Mobile / wąski ekran:** przyciski są ikonowe (min. 40×40 px, cel dotyku ≥ 44 px dzięki paddingowi), `.page-header__actions` ma się zawijać (`flex-wrap: wrap`; do sprawdzenia w trybie `addToCollection`, gdzie przyciski mają etykiety tekstowe). Jeśli zawijanie pogorszy układ nagłówka, **fallback**: te same przełączniki w `pych-recipe-header` obok tytułu — bez zmiany API komponentu.

### 2.2 Ikony i teksty

| Flaga | Stan nieaktywny | Stan aktywny | Tooltip (nieaktywny → aktywny) | `aria-label` (stały) |
|---|---|---|---|---|
| Ulubiony | `favorite_border` | `favorite` (kolor `--mat-sys-error`) | „Dodaj do ulubionych" → „Usuń z ulubionych" | „Ulubiony" |
| Chcę wypróbować | patrz uwaga | patrz uwaga | „Chcę wypróbować" → „Usuń z listy do wypróbowania" | „Chcę wypróbować" |

> **Uwaga — decyzja do potwierdzenia przy implementacji:** historyjka zakłada `bookmark_border` / `bookmark` dla „Chcę wypróbować". W tym samym pasku akcji „Dodaj do kolekcji" używa już ikony `bookmark_add`, więc dwie niemal identyczne zakładki obok siebie będą mylące. **Rekomendacja:** `outlined_flag` (nieaktywna) / `flag` (aktywna). Ikony są zdefiniowane jako stałe w komponencie, więc zamiana kosztuje jedną linię. Wybór należy do właściciela produktu.

Dostępność (scenariusz 16):

- `aria-label` jest **stały**, a stan niesie `[attr.aria-pressed]` (true/false) — etykieta nie zmienia się razem ze stanem, żeby czytnik ekranu nie czytał sprzecznych informacji,
- tooltip (`matTooltip`) zmienia się ze stanem i dotyczy użytkowników widzących,
- obsługa `Tab` / `Enter` / `Spacja` zapewnia natywny `<button>` (`mat-icon-button`),
- widoczny fokus — domyślny dla Material,
- ikona w `mat-icon` z `aria-hidden="true"`.

### 2.3 `RecipeFlagTogglesComponent` — kontrakt

```typescript
@Component({
    selector: 'pych-recipe-flag-toggles',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    // MatIconButton, MatIcon, MatTooltip
})
export class RecipeFlagTogglesComponent {
    readonly recipeId = input.required<number>();
    /** Stan z API (źródło prawdy po załadowaniu / po udanym zapisie) */
    readonly isFavorite = input<boolean>(false);
    readonly isWantToTry = input<boolean>(false);

    /** Po udanym zapisie: pełny stan z odpowiedzi API */
    readonly flagsChange = output<RecipeFlagsDto>();
    /** Po 401 — rodzic przekierowuje do logowania (jak onAddToPlan) */
    readonly sessionExpired = output<void>();

    // Stan lokalny (optymistyczny), synchronizowany z inputami
    protected readonly favorite = linkedSignal(() => this.isFavorite());
    protected readonly wantToTry = linkedSignal(() => this.isWantToTry());
    protected readonly favoritePending = signal(false);
    protected readonly wantToTryPending = signal(false);

    protected toggleFavorite(): void { this.toggle('is_favorite'); }
    protected toggleWantToTry(): void { this.toggle('is_want_to_try'); }
}
```

Logika `toggle(flag)`:

1. **Guard:** jeśli ta flaga jest `pending` → `return` (ochrona przed podwójnym kliknięciem; sc. 11).
2. `previous = stanFlagi`, `next = !previous`.
3. **Optymistycznie:** ustaw stan lokalny na `next`, `pending = true`.
4. `RecipeFlagsService.setFlags(recipeId, { [flag]: next })`.
5. **Sukces:** stan lokalny z odpowiedzi API (źródło prawdy), `pending = false`, `flagsChange.emit(response)`.
6. **Błąd:** przywróć `previous`, `pending = false`, snackbar:
    - `401` → „Sesja wygasła. Zaloguj się ponownie." + `sessionExpired.emit()` (identycznie jak `onAddToPlan` w `RecipeDetailPageComponent`),
    - pozostałe (`400`, `404`, `5xx`, brak sieci) → „Nie udało się zapisać. Spróbuj ponownie." (`MatSnackBar`, akcja „OK", 5 s) — także `404` dla przepisu niedostępnego (sc. 13).

Szczegóły zachowania:

- **Pending per flaga:** zablokowanie serduszka nie blokuje drugiej ikonki. Dwa równoległe żądania częściowe są bezpieczne po stronie API (`FOR UPDATE` w RPC).
- **Blokada przycisku:** `[disabled]="pending()"` razem z `[disabledInteractive]="true"` (Material), aby przycisk nie tracił fokusu klawiatury w trakcie zapisu; kliknięcia w tym stanie są ignorowane.
- **Synchronizacja z rodzicem:** `linkedSignal` resetuje stan lokalny, gdy rodzic zmieni wejście (np. po `flagsChange` lub nawigacji do innego przepisu). Wejście rodzica **nie nadpisuje** flagi, która jest w trakcie zapisu (warunek w `linkedSignal`: `pending ? bieżący : input`).
- Komponent **nie zna** pojęcia roli — dostępny dla `user`, `premium`, `admin` bez rozróżnień.

### 2.4 `RecipeFlagsService`

```typescript
@Injectable({ providedIn: 'root' })
export class RecipeFlagsService {
    private readonly supabase = inject(SupabaseService);

    /** PUT /functions/v1/recipes/{id}/flags */
    setFlags(recipeId: number, patch: UpdateRecipeFlagsCommand): Observable<RecipeFlagsDto> {
        return from(
            this.supabase.functions.invoke<RecipeFlagsDto>(`recipes/${recipeId}/flags`, {
                method: 'PUT',
                body: patch,
            })
        ).pipe(
            map((response) => {
                if (response.error || !response.data) {
                    // Błąd z polem status (400/401/404/500), jak w ExploreRecipesService
                    throw toApiError(response.error);
                }
                return response.data;
            })
        );
    }
}
```

Tak jak pozostałe serwisy: **wyłącznie** `supabase.functions.invoke` (bez `supabase.from`). Mapowanie statusu z błędu — wzorzec `extractStatusFromError` z `ExploreRecipesService` (`error.status` / `error.context.status`).

### 2.5 Integracja w stronach szczegółów

`RecipeDetailViewComponent` dostaje dwa nowe outputy i je przekazuje:

```typescript
readonly flagsChange = output<RecipeFlagsDto>();
readonly flagsSessionExpired = output<void>();
```

W obu stronach (`RecipeDetailPageComponent`, `ExploreRecipeDetailPageComponent`):

```html
<pych-recipe-detail-view
    ...
    (flagsChange)="onFlagsChange($event)"
    (flagsSessionExpired)="onLogin()"
/>
```

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

(Wzorzec spread jak przy `in_my_plan`.) Dzięki temu po udanym zapisie stan rodzica zgadza się ze stanem przełącznika, a powrót do listy wczytuje świeże dane z API.

### 2.6 Stany i przypadki brzegowe

| Sytuacja | Zachowanie UI |
|---|---|
| Przepis własny, dowolna widoczność | Przełączniki aktywne (sc. 1–4) |
| Cudzy przepis `PUBLIC` bez kolekcji (`/explore/recipes/…`) | Przełączniki aktywne; zapis nie informuje autora (sc. 7) |
| Gość | Brak przełączników (sc. 9) |
| Zapis w toku | Ikona zablokowana, bez drugiego żądania (sc. 11) |
| Błąd sieci / `5xx` | Cofnięcie stanu + snackbar (sc. 10) |
| `401` | Cofnięcie + snackbar + przekierowanie do logowania (sc. 12) |
| `404` (przepis usunięty / cofnięto udostępnienie w trakcie) | Cofnięcie + snackbar „Nie udało się zapisać…" (sc. 13) |
| Odświeżenie strony po ustawieniu obu flag | Oba stany z API (`GET …/{id}` zwraca flagi; sc. 4) |

### 2.7 ASCII — nagłówek szczegółów (desktop, zalogowany nie-autor)

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Szarlotka babci                      [♥] [⚑]  [ Dodaj do kolekcji ] [ Plan ]│
│                                       ▲   ▲                                 │
│                          Ulubiony (aktywny)  Chcę wypróbować (nieaktywny)   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Wskaźnik serduszka na kafelku

### 3.1 Kontrakt

W `RecipeCardData` dodajemy pole opcjonalne (analogicznie do `isTermorobot` / `isGrill`):

```typescript
export interface RecipeCardData {
    // ...istniejące pola...
    /** Czy zalogowany użytkownik oznaczył przepis jako ulubiony (tylko wskaźnik, niekliklany) */
    isFavorite?: boolean;
}
```

Wybór `RecipeCardData` (a nie osobnego `input` karty) jest celowy: `RecipeListItemViewModel` w `recipe-list` już niesie `card: RecipeCardData`, więc listy „Moje przepisy", kolekcji i Explore nie wymagają zmian w szablonie `recipe-list.component.html` ani w modelach VM.

### 3.2 Szablon i styl

Wskaźnik w kontenerze obrazu karty (`.card-image-container`), w `recipe-card.html`:

```html
@if (recipe().isFavorite) {
    <div class="favorite-indicator" role="img" aria-label="Ulubiony przepis">
        <mat-icon aria-hidden="true">favorite</mat-icon>
    </div>
}
```

Pozycja i wygląd (`recipe-card.scss`):

```scss
.favorite-indicator {
    position: absolute;
    bottom: 8px;
    right: 8px;
    z-index: 10;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--mat-sys-surface);
    opacity: 0.95;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    pointer-events: none; // kliknięcie przechodzi do <a> karty (sc. 6)

    mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-error);
    }
}
```

**Dlaczego prawy dolny róg:** lewy górny zajmują badge („Mój przepis", „W moich kolekcjach", Termorobot, Grill), a prawy górny — `.visibility-indicator` (autor) i `.card-menu-button` („Usuń z kolekcji"). Dolny prawy róg obrazu jest wolny na wszystkich kartach.

Zachowanie:

- `pointer-events: none` → kliknięcie w serduszko działa jak kliknięcie kafelka (nawigacja do szczegółów), stan się nie zmienia (sc. 6).
- Wskaźnik **nie ma** `tabindex` ani roli przycisku; nie jest osobnym elementem w kolejności fokusu. `role="img"` + `aria-label` dodaje informację do nazwy linku karty.
- Brak wskaźnika, gdy `isFavorite` jest `false`/`undefined` (gość i nieoznaczone przepisy — sc. 5, 9).
- Ikona „Chcę wypróbować" **nie** jest renderowana na kafelku.

### 3.3 ASCII — kafelek

```
┌──────────────────────────┐
│ [Mój przepis]     [ 🔒 ] │
│ [Termorobot]             │
│        (zdjęcie)         │
│                    [ ♥ ] │
├──────────────────────────┤
│ Szarlotka babci          │
│ Deser                    │
└──────────────────────────┘
```

---

## 4. Zasilanie kafelków danymi z API (mappery)

Każde miejsce budujące `RecipeCardData` ustawia `isFavorite` z `is_favorite` odpowiedzi API (`?? false`):

| Widok | Ścieżka | Mapper | Źródło danych |
|---|---|---|---|
| Moje przepisy | `/my-recipies` | `recipes-list-page.component.ts` (~l. 105) | `GET /recipes` / `/recipes/feed` |
| Dashboard — ostatnie przepisy | `/dashboard` | `recent-recipes-list.component.ts` → `toCardData` (~l. 30) | `GET /recipes` (nie ma `/dashboard/summary`) |
| Szczegóły kolekcji | `/collections/:id` | `collection-details-page.component.ts` (~l. 92) | `GET /collections/{id}` |
| Katalog Explore | `/explore` | `public-recipe-results.ts` → `mapToCardData` (~l. 122) | `GET /public/recipes/feed` |
| Landing (zalogowany) — sekcje | `/` | `landing-page.component.ts` (~l. 208) | `GET /public/recipes/feed` |

Przykład:

```typescript
imageUrl: recipe.image_path,
isFavorite: recipe.is_favorite ?? false,
```

Uwagi:

- Wyniki wyszukiwania na landingu i w Explore (`PublicRecipeResults`) korzystają z tego samego mappera, więc serduszko pojawia się także w wynikach wyszukiwania.
- `PublicRecipesService` woła API przez `supabase.functions.invoke`, które dołącza JWT zalogowanego użytkownika — **nie potrzeba** zmian w serwisie (tak samo zasilane są dziś `is_owner` i `in_my_collections`). Gość nie dostaje pola, więc serduszko się nie pojawia.
- **Świeżość danych:** wszystkie wymienione widoki ładują dane przy wejściu. Po zmianie flagi na szczegółach powrót do listy pobiera dane ponownie — nie dodajemy globalnego store'a. Przy implementacji sprawdzić, czy żaden z widoków nie trzyma długo żyjącego cache'u w pamięci (dashboard); jeśli tak, odświeżyć wpis lokalnie po `flagsChange`.
- **Bez zmian:** drzewo kolekcji w Sidebarze, drawer „Mój plan", `RecipeListComponent` (szablon), Bottom Bar.

---

## 5. Historyjka użytkownika (szczegółowa)

**Jako** zalogowany użytkownik przeglądający publiczne przepisy innych autorów,
**chcę** jednym kliknięciem oznaczyć przepis serduszkiem i/lub „Chcę wypróbować",
**aby** szybko wyróżnić przepisy ważne dla mnie, bez zmieniania przepisu i bez informowania autora.

**Kroki:**

1. Użytkownik loguje się i otwiera `/explore`, a następnie kafelek cudzego publicznego przepisu (`/explore/recipes/:id-:slug`).
2. W nagłówku widzi dwie ikonki: serduszko i „Chcę wypróbować" (obie nieaktywne).
3. Klika serduszko — natychmiast wypełnia się, a w tle wysyłane jest `PUT /recipes/{id}/flags` z `{ "is_favorite": true }`.
4. Klika „Chcę wypróbować" — obie ikonki są aktywne.
5. Wraca do `/explore` — kafelek tego przepisu pokazuje wypełnione serduszko (bez ikonki „Chcę wypróbować").
6. Klika serduszko na kafelku — otwierają się szczegóły przepisu (flaga bez zmian).
7. Na szczegółach klika serduszko ponownie — wraca do stanu nieaktywnego; „Chcę wypróbować" pozostaje aktywne.
8. **Alternatywa — błąd sieci:** po kliknięciu ikonka cofa się, a snackbar informuje „Nie udało się zapisać. Spróbuj ponownie."
9. **Alternatywa — gość:** nie widzi ikonek ani serduszek na kafelkach.

---

## 6. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `RecipeFlagsService` | `setFlags` wysyła `PUT recipes/{id}/flags` z ciałem częściowym; mapuje `error.status` (400/401/404/500) |
| `RecipeFlagTogglesComponent` | Klik serduszka: natychmiastowy stan aktywny, `aria-pressed="true"`, tooltip „Usuń z ulubionych", wywołanie serwisu z `{ is_favorite: true }` (sc. 1) |
| `RecipeFlagTogglesComponent` | Klik „Chcę wypróbować" nie zmienia stanu serduszka (sc. 2) |
| `RecipeFlagTogglesComponent` | Ponowny klik → `false`; druga flaga bez zmian (sc. 3); obie aktywne jednocześnie (sc. 4) |
| `RecipeFlagTogglesComponent` | Zapis w toku: drugi klik tej samej ikonki ignorowany, `disabled`, tylko 1 wywołanie serwisu (sc. 11) |
| `RecipeFlagTogglesComponent` | Błąd `500`/sieć → cofnięcie + snackbar „Nie udało się zapisać. Spróbuj ponownie." (sc. 10) |
| `RecipeFlagTogglesComponent` | `401` → cofnięcie + snackbar sesji + emit `sessionExpired` (sc. 12) |
| `RecipeFlagTogglesComponent` | `404` → cofnięcie + snackbar błędu (sc. 13) |
| `RecipeFlagTogglesComponent` | Zmiana inputów z rodzica aktualizuje stan; nie nadpisuje flagi w trakcie zapisu |
| `RecipeFlagTogglesComponent` | Dostępność: `aria-label` stały, `aria-pressed` odzwierciedla stan, aktywacja `Enter`/`Spacja` (sc. 16) |
| `RecipeCardComponent` | `isFavorite: true` → wskaźnik widoczny (`role="img"`); `false`/`undefined` → brak (sc. 5) |
| `RecipeCardComponent` | Wskaźnik ma `pointer-events: none`; kliknięcie w serduszko nawiguje jak kliknięcie karty (sc. 6) |
| `RecipeCardComponent` | Brak ikonki „Chcę wypróbować" na kafelku (sc. 5) |
| `RecipeDetailViewComponent` | Przełączniki widoczne dla zalogowanego (oba `headerMode`), niewidoczne dla gościa (sc. 9) |
| Strony szczegółów (prywatna i explore) | `flagsChange` aktualizuje `recipe.is_favorite` / `is_want_to_try`; `flagsSessionExpired` wywołuje `onLogin()` |
| Mappery kafelków (5 miejsc) | `is_favorite: true` → `isFavorite: true`; brak pola → `false` |

**E2E (Playwright)** — zgodnie z DoD:

1. Zalogowany otwiera szczegóły cudzego publicznego przepisu, ustawia serduszko i „Chcę wypróbować", odświeża stronę — oba stany zachowane.
2. Wraca do `/explore` — na kafelku jest serduszko; klik w nie otwiera szczegóły.
3. Zdejmuje serduszko — po powrocie do `/explore` kafelek bez serduszka.
4. Gość: brak ikonek na szczegółach i serduszek na kafelkach `/explore`.

**Test manualny:** układ paska akcji na telefonie (360 px) w trybach `ownerActions` i `addToCollection`; nawigacja klawiaturą i czytnik ekranu (sc. 16).

---

## 7. Checklist implementacji (UI)

- [ ] Typy w `shared/contracts/types.ts` (zgodnie z planem API)
- [ ] `RecipeFlagsService` + testy
- [ ] `RecipeFlagTogglesComponent` (optymistyczna zmiana, pending per flaga, cofnięcie, snackbar, `aria-pressed`, `disabledInteractive`) + testy
- [ ] Decyzja ikony „Chcę wypróbować" (`bookmark` vs `flag`) — pkt 2.2
- [ ] Integracja w `RecipeDetailViewComponent` (obie ścieżki `headerMode`, outputy `flagsChange`, `flagsSessionExpired`)
- [ ] Obsługa w `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent` (`onFlagsChange`, `onLogin`)
- [ ] `RecipeCardData.isFavorite` + `favorite-indicator` w karcie (HTML, SCSS, testy)
- [ ] Mappery: `/my-recipies`, dashboard, kolekcja, Explore (wyniki), landing
- [ ] Responsywność paska akcji (zawijanie) lub fallback w `pych-recipe-header`
- [ ] Regresja: kliknięcie karty, badge „Mój przepis" / „W moich kolekcjach", wskaźnik widoczności, menu „Usuń z kolekcji", „Dodaj do planu", „Dodaj do kolekcji"
- [ ] Test E2E (Playwright) i test manualny mobile
