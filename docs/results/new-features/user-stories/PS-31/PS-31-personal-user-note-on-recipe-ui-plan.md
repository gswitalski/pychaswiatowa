# PS-31: Osobista notatka użytkownika do przepisu — Plan UI

> **User Story:** PS-31 — Osobista notatka użytkownika do przepisu
> **Data:** listopad 2026
> **Stack:** Angular 21, Angular Material, Sass, Vitest
> **Powiązane:** `PS-31-personal-user-note-on-recipe-user-story.md`, `PS-31-personal-user-note-on-recipe-api-plan.md`, `PS-31-personal-user-note-on-recipe-deployment-plan.md`
> **Wzorzec:** PS-95 / PS-99 (`RecipeFlagsService`, `RecipeRatingService`, integracja przez `RecipeDetailViewComponent`, optimistic update + rollback + snackbar)

---

## 1. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeNoteService` | **Nowy** | `src/app/core/services/recipe-note.service.ts` |
| `RecipeNoteComponent` (`pych-recipe-note`) | **Nowy** | `src/app/shared/components/recipe-note/recipe-note.component.{ts,html,scss}` |
| Narzędzia notatki (`normalizeRecipeNote`, `countRecipeNoteCharacters`) | **Nowe** | `src/app/shared/components/recipe-note/recipe-note.utils.ts` |
| `UnsavedChangesService` | **Nowy** | `src/app/core/services/unsaved-changes.service.ts` (rejestr „brudnych" źródeł + `beforeunload`) |
| `unsavedChangesGuard` (`CanDeactivateFn`) | **Nowy** | `src/app/core/guards/unsaved-changes.guard.ts` |
| Pomocnik statusu błędu Edge Function | **Nowy** | `src/app/core/utils/function-error-status.ts` (wyodrębniony z `RecipeRatingService`/`RecipeFlagsService`; patrz pkt 3) |
| `RecipeDetailViewComponent` | **Modyfikacja** | `src/app/shared/components/recipe-detail-view/` (sekcja notatki, nowe outputy) |
| `RecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-detail/` (obsługa `noteChange`) |
| `ExploreRecipeDetailPageComponent` | **Modyfikacja** | `src/app/pages/explore/explore-recipe-detail/` (jw.) |
| Trasy | **Modyfikacja** | `src/app/pages/recipes/recipes.routes.ts` (trasa `recipeIdSlugMatcher`) i `src/app/app.routes.ts` (trasa `exploreRecipeIdSlugMatcher` w układzie zalogowanego) — dodanie `canDeactivate: [unsavedChangesGuard]` |
| Typy i stała | **Modyfikacja / nowe** | `shared/contracts/types.ts` (`SetRecipeNoteRequestDto`, `RecipeNoteResponseDto`, `my_note?`), `shared/contracts/recipe-note.ts` (`RECIPE_NOTE_MAX_LENGTH`) — opis w planie API |
| Testy jednostkowe (Vitest) | **Nowe / rozszerzone** | patrz pkt 8 |
| Test E2E (Playwright) | **Nowy** | `e2e/recipe-note.spec.ts` |

**Struktura katalogów:** bez zmian (nowe pliki w istniejących `core/services`, `core/guards`, `core/utils`, `shared/components`), więc sekcja „Project Structure" w regułach nie wymaga aktualizacji.

**Poza zakresem PS-31 (UI):** wskaźnik notatki na kafelkach, filtr „z notatką", pole notatki w formularzu edycji przepisu (`/recipes/new`, `/recipes/:id/edit`), notatka na wydruku/PDF, edycja z poziomu listy.

---

## 2. Miejsce w interfejsie i warunki widoczności

**Widoki:** `/recipes/:id-:slug` (zalogowany; własny przepis lub cudzy `PUBLIC`, także otwarty z kolekcji/sidebaru) oraz `/explore/recipes/:id-:slug` (zalogowany). Oba renderuje wspólny `RecipeDetailViewComponent`, więc komponent osadzamy w jednym miejscu.

Sekcja „Moja notatka" jest **blokiem pełnej szerokości pod treścią przepisu**: w `.recipe-content` **po** siatce `.recipe-details` (składniki, kroki, wskazówki), a **przed** `bottom-cta-section`. Nie trafia do `pych-recipe-header` (nie zmienia wysokości nagłówka przepisu) ani do `pych-page-header`.

```html
<!-- recipe-detail-view.component.html, po bloku .recipe-details -->
@if (showNote()) {
    <pych-recipe-note
        [recipeId]="recipe()!.id!"
        [note]="recipe()!.my_note ?? null"
        (noteChange)="noteChange.emit($event)"
        (sessionExpired)="noteSessionExpired.emit()"
    />
}
```

```typescript
// recipe-detail-view.component.ts
readonly noteChange = output<RecipeNoteResponseDto>();
readonly noteSessionExpired = output<void>();

protected readonly showNote = computed(() => {
    const recipe = this.recipe();
    if (!this.isAuthenticated() || recipe === null || recipe.id === null) return false;
    // undefined = API nie zwróciło pola (gość lub błąd odczytu) → NIE pokazujemy sekcji,
    // aby użytkownik nie nadpisał niewidocznej, istniejącej notatki
    return recipe.my_note !== undefined;
});
```

| Sytuacja | Zachowanie |
|---|---|
| Gość | Brak sekcji i CTA (sc. 17); odpowiedź API nie ma `my_note` |
| Zalogowany, `my_note === null` | Stan pusty z CTA „Dodaj notatkę" |
| Zalogowany, `my_note` = tekst | Tryb odczytu |
| Zalogowany, `my_note` nieobecne (błąd odczytu po stronie API) | Sekcja ukryta (ochrona przed utratą danych, patrz plan API pkt 4.2); reszta przepisu działa normalnie |
| Własny `PRIVATE`/`SHARED`, cudzy `PUBLIC` | Sekcja widoczna — **bez** warunku `visibility` i `isOwner` (w odróżnieniu od ocen) |
| Cudzy `SHARED`/`PRIVATE` | Widok szczegółów niedostępny (`403`/`404`), więc brak CTA (sc. 4) |

**Rozmieszczenie na mobile:** historyjka zakłada sekcję „rozwijaną domyślnie, gdy notatka istnieje". Plan: **sekcja jest zawsze rozwinięta** (nie dodajemy mechanizmu zwijania) — stan pusty to jeden kompaktowy wiersz z CTA, a stan z notatką jest domyślnie rozwinięty, co spełnia założenie. Zwijanie długich notatek (np. „Pokaż więcej") to ewentualne rozszerzenie po feedbacku. Układ jednokolumnowy: `max-width` jak treść przepisu, pełna szerokość na ≤ 768 px, cel dotyku przycisków ≥ 44 px.

---

## 3. `RecipeNoteService`

```typescript
@Injectable({ providedIn: 'root' })
export class RecipeNoteService {
    private readonly supabase = inject(SupabaseService);

    /** PUT /functions/v1/recipes/{id}/note; note = null usuwa notatkę. */
    setNote(recipeId: number, note: string | null): Observable<RecipeNoteResponseDto> {
        const body: SetRecipeNoteRequestDto = { note };
        return from(
            this.supabase.functions.invoke<RecipeNoteResponseDto>(`recipes/${recipeId}/note`, {
                method: 'PUT',
                body,
            })
        ).pipe(
            map((response) => {
                if (response.error) {
                    throw toStatusError(response.error, 'Nie udało się zapisać notatki');
                }
                if (!response.data) {
                    throw toStatusError(null, 'Nie udało się zapisać notatki', 500);
                }
                return response.data;
            })
        );
    }
}
```

- Tak jak pozostałe serwisy: **wyłącznie** `supabase.functions.invoke` (żadnego `supabase.from` ani `supabase.rpc`).
- Odczyt notatki **nie** ma osobnego serwisu — przychodzi w `my_note` ze szczegółów przepisu (`RecipesService.getRecipeById`, `ExploreRecipesService.getExploreRecipeById`), które zwracają `RecipeDetailDto` z rozszerzonym typem.
- **Mapowanie statusu błędu:** `RecipeRatingService` i `RecipeFlagsService` mają skopiowaną prywatną metodę `extractStatusFromError`. Dla notatki **nie kopiujemy jej po raz trzeci** — wyodrębniamy do `core/utils/function-error-status.ts` (`extractFunctionErrorStatus(error)` + `toStatusError(...)`) i używamy w nowym serwisie. Przepięcie istniejących serwisów PS-95/PS-99 na ten pomocnik jest **opcjonalne i osobnym commitem** (poza zakresem PS-31, bez zmiany zachowania).

---

## 4. `RecipeNoteComponent` — kontrakt i zachowanie

### 4.1 Kontrakt

```typescript
@Component({
    selector: 'pych-recipe-note',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        TextFieldModule, // cdkTextareaAutosize
        MatProgressSpinnerModule,
    ],
    templateUrl: './recipe-note.component.html',
    styleUrl: './recipe-note.component.scss',
})
export class RecipeNoteComponent {
    private readonly noteService = inject(RecipeNoteService);
    private readonly snackBar = inject(MatSnackBar);
    private readonly dialog = inject(MatDialog);
    private readonly unsavedChanges = inject(UnsavedChangesService);
    private readonly destroyRef = inject(DestroyRef);

    readonly recipeId = input.required<number>();
    /** Zapisana notatka z API (źródło prawdy); null = brak notatki */
    readonly note = input<string | null>(null);

    /** Po udanym zapisie / usunięciu: pełny stan z odpowiedzi API */
    readonly noteChange = output<RecipeNoteResponseDto>();
    /** Po 401 — rodzic przekierowuje do logowania (jak flagsSessionExpired / ratingSessionExpired) */
    readonly sessionExpired = output<void>();

    protected readonly maxLength = RECIPE_NOTE_MAX_LENGTH;

    /** Ostatnio zapisana treść; resetowana, gdy rodzic zmieni `note` (nie w trakcie `pending`) */
    protected readonly saved = linkedSignal<string | null>(() => this.note());
    protected readonly editing = signal(false);
    protected readonly draft = signal('');
    protected readonly pending = signal(false);

    // Wartości pochodne (czyste, testowalne)
    protected readonly normalizedDraft = computed(() => normalizeRecipeNote(this.draft()));
    protected readonly charCount = computed(() => countRecipeNoteCharacters(this.normalizedDraft() ?? ''));
    protected readonly overLimit = computed(() => this.charCount() > this.maxLength);
    protected readonly isDirty = computed(
        () => this.editing() && (this.normalizedDraft() ?? null) !== this.saved()
    );
    protected readonly canSave = computed(() => {
        if (!this.editing() || this.pending() || this.overLimit()) return false;
        if (!this.isDirty()) return false;                                   // brak zmian
        if (this.normalizedDraft() === null && this.saved() === null) return false; // pusta, brak notatki
        return true; // pusta przy istniejącej notatce = usunięcie (sc. 7)
    });
}
```

Czyste funkcje w `recipe-note.utils.ts` (lustro logiki API, **ta sama normalizacja** → brak rozbieżności licznik ↔ walidacja serwera):

```typescript
export function normalizeRecipeNote(raw: string): string | null {
    const normalized = raw.replace(/\r\n?/g, '\n').trim();
    return normalized.length === 0 ? null : normalized;
}

/** Liczba znaków Unicode (code points): emoji = 1, spójnie z API i char_length w bazie. */
export function countRecipeNoteCharacters(note: string): number {
    return Array.from(note).length;
}
```

**Licznik i walidacja liczą tekst po normalizacji (trim)** — dokładnie to, co zwaliduje serwer; spacje na końcu nie zwiększają licznika.

### 4.2 Stany prezentacji

| Stan | Warunek | Co widzi użytkownik |
|---|---|---|
| **Pusty** | `saved() === null && !editing()` | Nagłówek „Moja notatka", podpis „Widoczna tylko dla Ciebie.", przycisk „Dodaj notatkę" (`mat-stroked-button`, ikona `note_add`) |
| **Edycja** | `editing()` | `textarea` (`matInput`, `cdkTextareaAutosize`, min 3 / max 12 wierszy; **bez atrybutu `maxlength`**, aby użytkownik mógł przekroczyć limit i zobaczyć stan błędu — sc. 9), placeholder „Twoje prywatne uwagi do tego przepisu…", licznik „X / 2000", przyciski „Zapisz" (`mat-flat-button`), „Anuluj" (`mat-button`) i — gdy `saved() !== null` — „Usuń" (`mat-button`, `color="warn"`) |
| **Odczyt** | `saved() !== null && !editing()` | Treść jako zwykły tekst z zachowaniem łamań linii, przyciski „Edytuj" i „Usuń" (`mat-button`, `color="warn"`, `aria-label="Usuń notatkę"`; z potwierdzeniem — sc. 6) |
| **Zapis w toku** | `pending()` | Przyciski `disabled` (z `disabledInteractive`, aby fokus nie znikał), `aria-busy="true"` na sekcji; w przycisku „Zapisz" mały spinner |

**Treść w trybie odczytu** — wyłącznie interpolacja, **nigdy** `innerHTML`/`[innerHTML]` ani pipe renderujący HTML (sc. 10):

```html
<p class="note-text" data-testid="note-text">{{ saved() }}</p>
```

```scss
.note-text {
    white-space: pre-wrap;     // zachowuje \n i puste linie
    overflow-wrap: anywhere;   // długie ciągi nie rozpychają layoutu
    margin: 0;
}

@media print {
    :host { display: none; }   // wydruk przepisu pomija notatkę (założenie historyjki)
}
```

### 4.3 Licznik, dostępność

- `textarea`: `aria-label="Moja notatka"`, `aria-describedby` wskazuje podpis i licznik; `aria-invalid="true"` oraz `mat-error` „Notatka może mieć maksymalnie 2000 znaków." przy `overLimit()`.
- Licznik `<span aria-live="polite">{{ charCount() }} / 2000</span>` w `mat-hint align="end"`; po przekroczeniu klasa błędu (`var(--mat-sys-error)`) i „Zapisz" zablokowany (`[disabled]="!canSave()"`).
- Podpis „Widoczna tylko dla Ciebie." z ikoną `lock` (`aria-hidden="true"`).
- Wszystkie przyciski to natywne `<button>`: `Enter`/`Spacja` działają jak klik; widoczny fokus (domyślny Material); ikony w `mat-icon` z `aria-hidden="true"`.
- **Zarządzanie fokusem:** wejście w edycję → fokus na `textarea` (`afterNextRender` + `viewChild`); po „Zapisz"/„Anuluj" → fokus na „Edytuj" (lub „Dodaj notatkę" w stanie pustym); po usunięciu → fokus na „Dodaj notatkę". Dzięki temu klawiatura/czytnik ekranu nie „gubią" miejsca po przełączeniu trybu (sc. 24).
- `Ctrl/Cmd+Enter` w `textarea` = „Zapisz" (skrót wygody; tylko gdy `canSave()`), `Escape` **nie** anuluje (łatwo o przypadkową utratę wpisanego tekstu).

### 4.4 Logika akcji

**`startEdit()`** (CTA „Dodaj notatkę" / „Edytuj"): `draft.set(saved() ?? '')`, `editing.set(true)`, fokus na polu. Guard: `pending()` → `return`.

**`cancel()`** („Anuluj"): `editing.set(false)`, `draft.set('')`; **brak żądania** (sc. 11). Dirty znika, więc ostrzeżenie nie wystąpi. Guard: `pending()` → `return`.

**`save()`** („Zapisz", sc. 1, 5, 7, 8, 13, 15):

1. **Guard:** `!canSave()` → `return` (zabezpiecza też przed podwójnym kliknięciem, bo `pending()` blokuje `canSave`).
2. `previous = saved()`; `payload = normalizedDraft()` (`null` = usunięcie); `pending.set(true)`.
3. `RecipeNoteService.setNote(recipeId(), payload)` z `takeUntilDestroyed(destroyRef)`.
4. **Sukces:** `saved.set(response.note)` (**źródło prawdy to odpowiedź API**, także znormalizowana treść — sc. 8), `editing.set(false)`, `draft.set('')`, `pending.set(false)`, `noteChange.emit(response)`; snackbar (3 s, akcja „OK"):
    - `response.note !== null` → „Notatka została zapisana",
    - `response.note === null` (wyczyszczone pole przy istniejącej notatce) → „Notatka została usunięta".
5. **Błąd:** **nic nie jest tracone** — `editing` zostaje `true`, `draft` bez zmian, `saved` bez zmian, `pending.set(false)` (przyciski znów aktywne; sc. 13):
    - `401` → snackbar „Sesja wygasła. Zaloguj się ponownie." + `sessionExpired.emit()` (rodzic przekierowuje do logowania; dirty-guard zapyta o potwierdzenie, więc tekst nie ginie bez ostrzeżenia — sc. 18),
    - pozostałe (`400`, `404`, `5xx`, brak sieci, timeout) → snackbar „Nie udało się zapisać notatki. Spróbuj ponownie." (5 s).

**`remove()`** („Usuń" w trybie edycji **i** odczytu, sc. 6, 14, 15 — ta sama metoda w obu trybach):

1. Guard: `saved() === null` lub `pending()` → `return`.
2. Dialog `ConfirmDialogComponent` (istniejący): tytuł „Usuń notatkę", treść „Usunąć notatkę? Tej operacji nie można cofnąć.", `confirmText: 'Usuń'`, `cancelText: 'Anuluj'`, `confirmColor: 'warn'`. Anulowanie → brak żądania.
3. Po potwierdzeniu — **snapshot** `{ saved, editing, draft }`, następnie optymistycznie: `saved.set(null)`, `editing.set(false)`, `draft.set('')`, `pending.set(true)`.
4. `setNote(recipeId(), null)`.
5. **Sukces:** `pending.set(false)`, `noteChange.emit(response)`, snackbar „Notatka została usunięta", fokus na „Dodaj notatkę".
6. **Błąd (rollback, sc. 14):** przywrócenie snapshotu (`saved`, `editing`, `draft` — jeśli użytkownik usuwał z trybu edycji, wraca jego wpis; jeśli z trybu odczytu, wraca widok odczytu), `pending.set(false)`, snackbar jak przy błędzie zapisu; przy `401` dodatkowo `sessionExpired.emit()`.

**Synchronizacja z rodzicem:** `saved` jest `linkedSignal` od inputu `note`; po `noteChange` rodzic aktualizuje `recipe.my_note`, więc wartości się zgadzają. Zmiana inputu **nie nadpisuje** stanu w trakcie `pending` ani w trybie edycji (parametr trasy i tak niszczy komponent — patrz pkt 6, więc reset przy nawigacji do innego przepisu następuje przez ponowne utworzenie).

**Rejestracja „brudnego" stanu:** `effect(() => this.unsavedChanges.setDirty(this.dirtyKey, this.isDirty()))`, a w `destroyRef.onDestroy` → `unsavedChanges.clear(this.dirtyKey)` (`dirtyKey` = unikalny klucz instancji, np. `recipe-note:${recipeId}`).

---

## 5. Ostrzeżenie o niezapisanych zmianach (sc. 12)

W aplikacji **nie ma** dziś mechanizmu `CanDeactivate` ani `beforeunload` (formularze używają tylko `form.dirty`), więc potrzebny jest nowy, lekki, wielokrotnego użytku.

### 5.1 `UnsavedChangesService` (`core/services`, `providedIn: 'root'`)

```typescript
@Injectable({ providedIn: 'root' })
export class UnsavedChangesService {
    private readonly dirtySources = signal<ReadonlySet<string>>(new Set());
    readonly hasUnsavedChanges = computed(() => this.dirtySources().size > 0);

    constructor() {
        // zamknięcie / odświeżenie karty
        const win = inject(DOCUMENT).defaultView;
        win?.addEventListener('beforeunload', (event) => {
            if (!this.hasUnsavedChanges()) return;
            event.preventDefault();
            event.returnValue = ''; // wymagane przez część przeglądarek; treść komunikatu jest ignorowana
        });
    }

    setDirty(key: string, dirty: boolean): void { /* dodaj / usuń klucz w Set (immutable update) */ }
    clear(key: string): void { this.setDirty(key, false); }
}
```

- Handler `beforeunload` reaguje **tylko** gdy są niezapisane zmiany (sc. 12: „gdy zmian nie ma, ostrzeżenie się nie pojawia"). Przeglądarki pokazują własny, niemodyfikowalny komunikat.
- Serwis jest ogólny (klucz źródła), więc ten sam mechanizm da się później użyć w formularzu przepisu (poza zakresem PS-31).

### 5.2 `unsavedChangesGuard` (`core/guards`)

```typescript
export const unsavedChangesGuard: CanDeactivateFn<unknown> = () => {
    const unsaved = inject(UnsavedChangesService);
    if (!unsaved.hasUnsavedChanges()) return true;

    return inject(MatDialog)
        .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
            data: {
                title: 'Niezapisane zmiany',
                message: 'Masz niezapisaną notatkę. Jeśli opuścisz stronę, zmiany przepadną.',
                confirmText: 'Opuść',
                cancelText: 'Zostań',
                confirmColor: 'warn',
            },
            width: '400px',
            disableClose: true,
        })
        .afterClosed()
        .pipe(map((leave) => leave === true));
};
```

- „Zostań" → `false` (użytkownik pozostaje w edycji z zachowaną treścią); „Opuść" → `true` (nawigacja trwa, komponent jest niszczony, a `clear` zdejmuje dirty).
- Funkcyjny guard, `ConfirmDialogComponent` reużyty (spójny wygląd z innymi potwierdzeniami).

### 5.3 Podpięcie do tras

Guard dodajemy tylko tam, gdzie renderowany jest widok z notatką i gdzie jest zalogowany użytkownik:

| Trasa | Plik |
|---|---|
| `recipeIdSlugMatcher` (`/recipes/:id-:slug`) | `recipes.routes.ts` |
| `exploreRecipeIdSlugMatcher` (`/explore/recipes/:id-:slug`) — **tylko** druga definicja w układzie zalogowanego (`app.routes.ts`, pierwsza z dwóch; druga jest w układzie dla gościa i nie ma notatek) | `app.routes.ts` |

```typescript
{
    matcher: recipeIdSlugMatcher,
    loadComponent: () => import('./recipe-detail/recipe-detail-page.component').then((m) => m.RecipeDetailPageComponent),
    canDeactivate: [unsavedChangesGuard],
    data: { breadcrumb: 'Szczegóły', urlPrefix: 'recipes' },
},
```

**Przejście do innego przepisu** (omnibox, sidebar kolekcji): obie trasy używają tego samego komponentu z innym parametrem. Angular uruchamia wtedy `canDeactivate`, gdy zmieniają się parametry trasy (domyślne `runGuardsAndResolvers: 'paramsChange'`), a komponent jest ponownie używany — **zweryfikować w teście** (pkt 8), bo to najłatwiejszy do przeoczenia przypadek sc. 12.

**Znane zachowanie:** po załadowaniu przepisu strona wykonuje nawigację `replaceUrl` do kanonicznego sluga — dzieje się to przed jakąkolwiek edycją, więc dirty jest wtedy `false`.

---

## 6. Integracja w stronach szczegółów

Obie strony (`RecipeDetailPageComponent`, `ExploreRecipeDetailPageComponent`) dostają identyczną obsługę (wzorzec spread jak `onFlagsChange`/`onRatingChange`):

```html
<pych-recipe-detail-view
    ...
    (noteChange)="onNoteChange($event)"
    (noteSessionExpired)="onLogin()"
/>
```

```typescript
onNoteChange(note: RecipeNoteResponseDto): void {
    this.state.update((state) => ({
        ...state,
        recipe: state.recipe ? { ...state.recipe, my_note: note.note } : null,
    }));
}
```

- `onLogin()` już istnieje (nawigacja do `/login` z `returnUrl`); przy `401` dirty-guard zapyta, czy opuścić stronę.
- Po zapisie stan rodzica zgadza się ze stanem komponentu, a po odświeżeniu strony `GET …/{id}` zwraca te same dane (sc. 1: „po odświeżeniu notatka nadal jest widoczna").
- Przy każdym `loadRecipe` strona ustawia `isLoading: true`, co **niszczy** `pych-recipe-note` (cały blok szczegółów jest za `@if (hasRecipe() && !isLoading() && !error())`) — nawigacja do innego przepisu zawsze startuje z czystym stanem notatki.
- Strona `/recipes/:id-:slug` ma dziś zawsze `headerMode = 'ownerActions'` także dla cudzego przepisu `PUBLIC` otwartego z kolekcji (istniejące zachowanie, **poza zakresem PS-31**); sekcja notatki nie zależy od `headerMode` ani `isOwner`.

---

## 7. Stany i przypadki brzegowe

| Sytuacja | Zachowanie UI |
|---|---|
| Własny przepis, brak notatki | CTA „Dodaj notatkę" (sc. 1) |
| Cudzy `PUBLIC` z `/explore` lub kolekcji | Identycznie; notatka widoczna przy każdym wejściu niezależnie od ścieżki (sc. 2, 3) |
| Edycja istniejącej | „Edytuj" → pole z bieżącą treścią → „Zapisz" → odczyt + snackbar (sc. 5) |
| Wklejony tekst z `\r\n`, spacjami na brzegach | Licznik liczy tekst po normalizacji; po zapisie wyświetlana jest wartość z odpowiedzi API (sc. 8) |
| 2000 znaków (także z emoji) | Akceptowane; 2001 → licznik w stanie błędu, „Zapisz" zablokowany, brak żądania (sc. 9) |
| `<script>`, `**tekst**`, `<b>` | Wyświetlane dosłownie jako tekst (sc. 10) |
| „Anuluj" ze zmianami | Powrót do ostatnio zapisanej treści / stanu pustego, bez żądania (sc. 11) |
| Opuszczenie widoku z niezapisaną zmianą | Dialog „Zostań / Opuść"; `beforeunload` przy zamknięciu/odświeżeniu karty; bez zmian — bez ostrzeżenia (sc. 12) |
| Błąd zapisu | Snackbar błędu, edycja i tekst zachowane, przyciski znów aktywne (sc. 13) |
| Błąd usunięcia | Rollback do stanu sprzed akcji + snackbar błędu (sc. 14) |
| Zapis/usunięcie w toku | Przyciski zablokowane, jedno żądanie (sc. 15) |
| `401` | Snackbar sesji, `sessionExpired` → `/login`; dirty-guard chroni niezapisany tekst (sc. 18) |
| `404` (przepis stał się niedostępny w trakcie) | Snackbar „Nie udało się zapisać notatki. Spróbuj ponownie."; tekst zachowany (sc. 19) |
| Pusty zapis przy istniejącej notatce | Usunięcie + snackbar „Notatka została usunięta" (sc. 7) |
| Zapis z pustym polem bez istniejącej notatki | „Zapisz" nieaktywne |
| Brak zmian względem zapisanej treści | „Zapisz" nieaktywne, brak dirty |
| Użytkownik A / B / autor / gość | Każdy widzi wyłącznie własną notatkę lub CTA; gość — nic (sc. 16, 17) |
| Wszystkie role (`user`, `premium`, `admin`) | Bez różnic i bez komunikatów o planie (sc. 22) |

---

## 8. Testy (Vitest)

Pliki `*.spec.ts` obok kodu. Frontend nie używa `supabase.from`, więc serwis testujemy mockiem `functions.invoke` (wzorzec `recipe-rating.service.spec.ts`).

| Obszar | Scenariusz |
|---|---|
| `recipe-note.utils` | `normalizeRecipeNote`: trim, `\r\n`/`\r` → `\n`, wewnętrzne puste linie zachowane, `""`/spacje/same nowe linie → `null` (sc. 7, 8); `countRecipeNoteCharacters`: emoji = 1, 2000 → 2000 (sc. 9) |
| `RecipeNoteService` | `setNote` wysyła `PUT recipes/{id}/note` z `{ note }` (także `null`); mapuje `error.status` (400/401/404/500); brak `data` → błąd 500 |
| `RecipeNoteComponent` — render | Stan pusty: CTA „Dodaj notatkę", podpis „Widoczna tylko dla Ciebie."; odczyt: tekst + „Edytuj"; treść z `<script>` / `<b>` renderowana jako tekst (brak elementów w DOM, sc. 10); `white-space: pre-wrap` |
| `RecipeNoteComponent` — edycja | CTA → `textarea` z fokusem i `aria-label="Moja notatka"`; „Edytuj" → pole z bieżącą treścią; „Anuluj" przywraca stan zapisany i **nie** woła serwisu (sc. 11) |
| `RecipeNoteComponent` — licznik | „X / 2000" aktualizowany; 2000 znaków (z emoji) → OK; 2001 → stan błędu, „Zapisz" `disabled`, serwis niewołany (sc. 9); `aria-live="polite"`; brak atrybutu `maxlength` |
| `RecipeNoteComponent` — `canSave` | Nieaktywne: brak zmian, pusta treść bez istniejącej notatki, przekroczony limit, `pending`; aktywne: zmiana, usunięcie przez wyczyszczenie |
| `RecipeNoteComponent` — zapis | Sukces: serwis z **znormalizowaną** treścią, `saved` = wartość z odpowiedzi, odczyt, `noteChange`, snackbar „Notatka została zapisana" (sc. 1, 5, 8); pusty zapis przy istniejącej → serwis z `null`, snackbar „usunięta" (sc. 7) |
| `RecipeNoteComponent` — błąd zapisu | `500`/sieć → snackbar „Nie udało się zapisać notatki. Spróbuj ponownie.", edycja i tekst zachowane, przyciski aktywne (sc. 13); `401` → snackbar sesji + `sessionExpired`; `404` → snackbar błędu |
| `RecipeNoteComponent` — usuwanie (tryb odczytu i edycji) | „Usuń" (w obu trybach; brak w stanie pustym) otwiera dialog; anulowanie → brak żądania; potwierdzenie → serwis z `null`, stan pusty, snackbar „usunięta", `noteChange` (sc. 6); błąd → rollback `saved` / `editing` / `draft` + snackbar (sc. 14) |
| `RecipeNoteComponent` — blokada | W trakcie `pending` drugie kliknięcie „Zapisz"/„Usuń" ignorowane, `disabled`, **jedno** wywołanie serwisu (sc. 15) |
| `RecipeNoteComponent` — dirty | Zmiana treści → `setDirty(key, true)`; brak zmian / po zapisie / po anulowaniu → `false`; niszczenie komponentu → `clear` |
| `RecipeNoteComponent` — a11y | Przyciski natywne, fokus po wejściu w edycję na `textarea`, po zapisie/anulowaniu na „Edytuj"/CTA; `Ctrl+Enter` zapisuje tylko gdy `canSave()` (sc. 24) |
| `UnsavedChangesService` | `hasUnsavedChanges` zależy od zbioru kluczy; wiele źródeł; `beforeunload` wywołuje `preventDefault` tylko przy dirty |
| `unsavedChangesGuard` | Bez dirty → `true` bez dialogu; z dirty → dialog; „Zostań" → `false`; „Opuść" → `true` (sc. 12) |
| Trasy / nawigacja (`RouterTestingHarness`) | Przejście z przepisu A do przepisu B (ta sama trasa, inny parametr) przy dirty uruchamia guard; bez dirty nawigacja przebiega bez dialogu |
| `RecipeDetailViewComponent` (nowy spec) | Sekcja notatki renderowana dla zalogowanego z `my_note` (`null` i tekst), **nie** dla gościa, **nie** gdy `my_note === undefined`, **nie** zależna od `visibility` i `isOwner`; emituje `noteChange` / `noteSessionExpired` |
| Strony szczegółów (prywatna i explore) | `onNoteChange` aktualizuje `recipe.my_note` (zapis, usunięcie → `null`); `noteSessionExpired` wywołuje `onLogin()`. Jeśli koszt konfiguracji `TestBed` stron jest wysoki (brak istniejących specs), pokryć w widoku + E2E |

**E2E (Playwright, `e2e/recipe-note.spec.ts`, wzorzec `recipe-flags.spec.ts`, wymaga `TEST_USER_EMAIL`/`TEST_USER_PASSWORD`):**

1. Własny przepis: dodanie wielolinijkowej notatki → snackbar → odświeżenie → notatka nadal widoczna z łamaniami linii.
2. Edycja, następnie usunięcie z trybu edycji z potwierdzeniem; powrót do CTA „Dodaj notatkę".
2a. Usunięcie z trybu odczytu („Usuń" obok „Edytuj") z potwierdzeniem; powrót do CTA „Dodaj notatkę".
3. Cudzy publiczny przepis z `/explore/recipes/…`: dodanie i odczyt notatki; po zalogowaniu na drugie konto (opcjonalne `TEST_USER2_EMAIL`/`TEST_USER2_PASSWORD`, test pomijany bez nich) notatka pierwszego użytkownika **nie jest widoczna**.
4. Gość (kontekst bez logowania) na `/explore/recipes/…`: brak sekcji „Moja notatka" i CTA.
5. Niezapisana zmiana + kliknięcie w nawigację → dialog „Zostań / Opuść".
6. Limit: wklejenie 2001 znaków blokuje „Zapisz".

**Test manualny:** układ sekcji na telefonie (360 px) w stanach pusty / odczyt / edycja (klawiatura ekranowa nie zasłania przycisków „Zapisz"/„Anuluj"); nawigacja klawiaturą i czytnik ekranu (etykieta pola, ogłaszanie licznika, powrót fokusa po zapisie).

---

## 9. Checklist implementacji (UI)

- [ ] Typy w `shared/contracts/types.ts` i `shared/contracts/recipe-note.ts` (zgodnie z planem API)
- [ ] `core/utils/function-error-status.ts` + `RecipeNoteService` + testy
- [ ] `recipe-note.utils.ts` + testy (normalizacja, licznik code points)
- [ ] `UnsavedChangesService` + `unsavedChangesGuard` + testy; `canDeactivate` w dwóch trasach (pkt 5.3)
- [ ] `RecipeNoteComponent` (stany pusty/edycja/odczyt, licznik, `canSave`, zapis, usuwanie z dialogiem i rollbackiem — w trybie edycji i odczytu, snackbary, fokus, a11y, dirty, `@media print`) + testy
- [ ] Integracja w `RecipeDetailViewComponent` (`showNote`, outputy `noteChange`, `noteSessionExpired`) + nowy spec
- [ ] Obsługa `onNoteChange` i `noteSessionExpired` w `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent`
- [ ] Responsywność (pełna szerokość, cel dotyku ≥ 44 px, zawijanie długich ciągów)
- [ ] Regresja: przełączniki flag PS-95, ocena PS-99, „Dodaj do kolekcji", „Dodaj do planu", „Edytuj", „Usuń", chipy i tagi, CTA gościa, formularz przepisu (bez pola notatki), kafelki list (bez wskaźnika notatki)
- [ ] Test E2E (Playwright) i test manualny mobile / a11y
- [ ] `npm run lint`, `npm run build`, `npm run test:run`
