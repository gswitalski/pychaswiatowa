# Plan implementacji widoku — Kredyty AI (PS-64)

## 1. Przegląd

Widok PS-64 obejmuje zestaw zmian UI i nowych komponentów realizujących funkcjonalność kredytów AI w aplikacji PychaŚwiatowa. Celem jest umożliwienie użytkownikom monitorowania stanu swojej puli kredytów AI (na generowanie draftów przepisów i zdjęć), informowanie o wyczerpaniu puli oraz blokowanie niedostępnych akcji. Zmiany dotyczą czterech obszarów: strony asysty AI, kreatora przepisu (generowanie zdjęcia), strony ustawień oraz panelu admina.

Nowe elementy:
- **`AiCreditsService`** — globalny singleton zarządzający stanem kredytów przez Angular Signal
- **`AiCreditsIndicatorComponent`** — miniaturowy wskaźnik puli używany wielokrotnie w UI
- **`AiCreditsExhaustedDialogComponent`** — dialog wyświetlany przy wyczerpaniu kredytów
- **`AiCreditsSettingsSectionComponent`** — sekcja w ustawieniach z paskami postępu

---

## 2. Routing widoku

Zmiany nie wprowadzają nowych tras. Modyfikowane są istniejące:

| Trasa | Komponent | Zmiana |
|---|---|---|
| `/recipes/new/assist` | `RecipeAssistComponent` | Wskaźnik kredytów draft + baner + obsługa 402 |
| `/recipes/new`, `/recipes/:id/edit` | `RecipeFormComponent` | Wskaźnik kredytów image + obsługa 402 |
| `/settings` | `SettingsPageComponent` | Nowa sekcja „Kredyty AI" |
| `/admin/users` | `AdminUsersPageComponent` | Sekcja kredytów w dialogu edycji użytkownika |

---

## 3. Struktura komponentów

```
AppShell
├── AiCreditsService [singleton, providedIn: 'root']
│
├── /recipes/new/assist → RecipeAssistComponent (MODYFIKACJA)
│   ├── AiCreditsIndicatorComponent [type="draft"]
│   └── (MatDialog) → AiCreditsExhaustedDialogComponent
│
├── /recipes/new | /recipes/:id/edit → RecipeFormComponent (MODYFIKACJA)
│   ├── AiCreditsIndicatorComponent [type="image", compact=true]
│   └── (MatDialog) → AiCreditsExhaustedDialogComponent
│
├── /settings → SettingsPageComponent (MODYFIKACJA)
│   └── AiCreditsSettingsSectionComponent (NOWY)
│
└── /admin/users → AdminUsersPageComponent (MODYFIKACJA)
    └── AdminUserEditDialogComponent (MODYFIKACJA)
        └── AdminUserAiCreditsFormComponent (NOWY)
```

---

## 4. Szczegóły komponentów

### `AiCreditsService`

- **Opis:** Globalny singleton (`providedIn: 'root'`) odpowiedzialny za pobranie, cache'owanie i udostępnianie stanu kredytów AI. Ładowany podczas bootstrapu App Shell po zalogowaniu użytkownika — dane są pobierane z pola `ai_credits` w odpowiedzi `GET /me` (bez dodatkowego zapytania), a pełny stan uzupełniany przez `GET /ai/credits` gdy potrzeba. Udostępnia reaktywny signal z aktualnym stanem oraz metody do odświeżania i weryfikacji dostępności kredytów.
- **Główne elementy:** Klasa Angular Injectable bez szablonu. Używa `inject(SupabaseService)` do komunikacji z API.
- **Obsługiwane interakcje:** Brak bezpośrednich interakcji UI — eksponuje publiczne API dla komponentów.
- **Obsługiwana walidacja:** Brak po stronie serwisu — logika sprawdzana przez `isExhausted(type)`.
- **Typy:** `AiCreditsState`, `AiCreditsResponseDto`, `MeAiCreditsDto`
- **Publiczne API:**
    - `readonly credits: Signal<AiCreditsState | null>` — reaktywny signal ze stanem
    - `loadCredits(): Observable<AiCreditsState>` — pobiera stan z `GET /ai/credits`
    - `bootstrapFromMeResponse(meCredits: MeAiCreditsDto | null): void` — inicjalizuje minimalny stan z `GET /me`
    - `refreshCredits(): void` — odświeża stan po operacji AI
    - `isExhausted(type: 'draft' | 'image'): boolean` — sprawdza czy remaining === 0

---

### `AiCreditsIndicatorComponent`

- **Opis:** Miniaturowy, współdzielony komponent wyświetlający licznik kredytów jednego typu. Używany na stronie asysty AI (typ `draft`) oraz w kreatorze/edytorze przepisu przy generowaniu zdjęcia (typ `image`, tryb kompaktowy). Zmienia wygląd w zależności od stanu: normalny, ostrzegawczy (≤25% puli), wyczerpany (0). Komponent ukryty dla roli `admin` (`limitType === 'unlimited'`). Wyczerpany wskaźnik jest klikalny i otwiera `AiCreditsExhaustedDialogComponent`.
- **Główne elementy:**
    - `mat-icon` — ikona zmienna (`auto_awesome` / `warning_amber` / `block`)
    - Tekst licznika: `Kredyty AI: X / Y` lub `X/Y` (compact) lub `Brak kredytów AI`
    - Opcjonalnie: data resetu (`· reset 9 paź`) dla `limitType === 'monthly'`
    - `matTooltip` — tooltip ostrzegawczy przy ≤25% i przy wyczerpaniu
    - `mat-progress-spinner` (skeleton) podczas `loading === true`
    - Owijający `span` klikalny przy stanie wyczerpania
- **Obsługiwane interakcje:**
    - `click` (tylko stan wyczerpany) → otwiera `AiCreditsExhaustedDialogComponent` przez `MatDialog`
- **Obsługiwana walidacja:**
    - Gdy `limitType === 'unlimited'` → komponent w ogóle się nie renderuje (`@if`)
    - Gdy `loading === true` → skeleton/spinner zamiast licznika
    - Gdy `error === true` → komponent ukryty (fail silent)
    - Gdy `remaining === 0` → wariant wyczerpany (czerwony, klikalny)
    - Gdy `remaining / total ≤ 0.25` → wariant ostrzegawczy (pomarańczowy + tooltip)
    - W przeciwnym razie → wariant normalny (neutralny)
- **Typy:** `AiCreditsState`, `AiCreditLimitType`
- **Propsy (`@Input`):**
    - `type: 'draft' | 'image'` (wymagany) — typ kredytów do wyświetlenia
    - `showResetDate: boolean` (domyślnie `true`) — czy wyświetlać datę resetu
    - `compact: boolean` (domyślnie `false`) — tryb kompaktowy (tylko liczba)

---

### `AiCreditsExhaustedDialogComponent`

- **Opis:** Dialog Angular Material (`MatDialog`) wyświetlany gdy użytkownik natrafi na błąd `402 AI_CREDITS_EXHAUSTED` lub kliknie wyczerpany wskaźnik. Prezentuje treść dopasowaną do roli użytkownika (`user` Free vs `premium`) i oferuje CTA przekierowania do strony `/pricing` dla Free lub informację o dacie resetu dla Premium.
- **Główne elementy:**
    - `mat-dialog-title` z ikoną `auto_awesome` i tytułem „Wyczerpano kredyty AI"
    - `mat-dialog-content` — treść wariantowa:
        - Dla `limitType === 'lifetime'`: informacja o limicie Free + CTA „Przejdź na Premium"
        - Dla `limitType === 'monthly'` z datą: informacja o dacie resetu
        - Dla `limitType === 'monthly'` bez daty: informacja o wyczerpaniu puli
    - `mat-dialog-actions` — przyciski: zawsze „Wróć" (`mat-button`); dla Free dodatkowo „Przejdź na Premium →" (`mat-flat-button color="primary"`, link do `/pricing`)
- **Obsługiwane interakcje:**
    - Kliknięcie „Wróć" → zamknięcie dialogu (`dialogRef.close()`)
    - Kliknięcie „Przejdź na Premium" → `router.navigate(['/pricing'])` + zamknięcie dialogu
    - Kliknięcie poza dialogiem / ESC → zamknięcie dialogu
- **Obsługiwana walidacja:** Brak (dialog informacyjny).
- **Typy:** `AiCreditsExhaustedDialogData` (wstrzykiwane przez `MAT_DIALOG_DATA`)
- **Propsy:** Dane przekazywane przez `MAT_DIALOG_DATA`:
    - `creditType: 'draft' | 'image'`
    - `limitType: 'lifetime' | 'monthly'`
    - `nextResetAt: Date | null`

---

### `AiCreditsSettingsSectionComponent`

- **Opis:** Nowa sekcja na stronie ustawień (`/settings`), widoczna wyłącznie dla ról `user` i `premium` (ukryta dla `admin`). Wyświetla pełny stan kredytów z paskami postępu dla każdego typu. Dla roli `user` (Free) z wyczerpanymi kredytami pokazuje komunikat i CTA upgrade.
- **Główne elementy:**
    - Nagłówek sekcji: `h3` / `mat-card-title` — „Kredyty AI"
    - Dla każdego typu (`draft`, `image`):
        - Etykieta (`mat-body-1`): np. „Asysta AI (draft przepisu)"
        - `mat-progress-bar` w trybie `determinate` z wartością `used / total * 100`; kolor `primary` normalnie, `warn` gdy ≤25% lub 100%
        - Podpis: `Użyto X z Y kredytów [· Reset: 9 paź 2026]`
        - Dla wyczerpanych i `limitType === 'lifetime'`: komunikat „Limit dożywotni wyczerpany"
    - CTA „Przejdź na Premium →" (link do `/pricing`) — widoczne tylko dla roli `user`
- **Obsługiwane interakcje:**
    - Kliknięcie CTA → `routerLink="/pricing"`
- **Obsługiwana walidacja:**
    - Gdy `loading === true` → `mat-progress-bar` w trybie `indeterminate` jako skeleton
    - Gdy `error === true` → komunikat „Nie udało się załadować stanu kredytów"
    - Kolor paska i tekstu reaguje na poziom wyczerpania
- **Typy:** `AiCreditsState`, `AiCreditsSettingsViewModel`
- **Propsy:** Brak — komponent pobiera dane bezpośrednio z `AiCreditsService` przez `inject()`

---

### `AdminUserAiCreditsFormComponent`

- **Opis:** Formularz edycji kredytów AI dla konkretnego użytkownika, osadzony w dialogu edycji użytkownika (`AdminUserEditDialogComponent`). Umożliwia adminowi podgląd i korektę wartości kredytów, zmiany typu limitu, ręczny reset zużycia.
- **Główne elementy:**
    - `mat-select` dla pola `limit_type` (opcje: `lifetime`, `monthly`)
    - Cztery pola `mat-form-field` + `matInput type="number"`:
        - `draft_credits_total`, `draft_credits_used`, `image_credits_total`, `image_credits_used`
    - `mat-form-field` + `matInput type="date"` dla `next_reset_at` (widoczne gdy `limit_type === 'monthly'`)
    - Przycisk „Resetuj kredyty" — ustawia `*_credits_used = 0` i wysyła `PATCH`
    - Przycisk „Zapisz" — wysyła `PATCH /admin/users/{userId}/ai-credits`
- **Obsługiwane interakcje:**
    - Zmiana wartości pól → `ReactiveFormsGroup` aktualizuje model
    - Kliknięcie „Resetuj kredyty" → ustawia `draft_credits_used = 0`, `image_credits_used = 0` i wywołuje zapis
    - Kliknięcie „Zapisz" → wywołuje `AdminService.updateUserAiCredits(userId, command)` → `PATCH /admin/users/{userId}/ai-credits`
- **Obsługiwana walidacja:**
    - `draft_credits_total` / `image_credits_total`: `min(0)`, `max(9999)`, wymagane, całkowite
    - `draft_credits_used` / `image_credits_used`: `min(0)`, `max(total)` — nie może przekroczyć `total`
    - `next_reset_at`: wymagane gdy `limit_type === 'monthly'`, data w przyszłości
    - Przy błędzie API `400` — wyświetlenie komunikatu błędu z odpowiedzi
- **Typy:** `UpdateAdminUserAiCreditsCommand`, `UpdateAdminUserAiCreditsResponseDto`, `AdminUserListItemDto`
- **Propsy (`@Input`):**
    - `userId: string` — ID użytkownika do edycji
    - `initialCredits: UpdateAdminUserAiCreditsResponseDto | null` — stan wstępny

---

### Zmodyfikowany `RecipeAssistComponent` (`/recipes/new/assist`)

- **Opis (dodatkowe zmiany):** Komponent strony asysty AI otrzymuje:
    1. Wskaźnik kredytów draft w nagłówku sekcji (komponent `AiCreditsIndicatorComponent`)
    2. Baner upgrade gdy `remaining === 0` (zamiast wskaźnika)
    3. Blokadę przycisku „Generuj draft" gdy `isExhausted('draft') === true`
    4. Obsługę błędu `402` zwróconego przez API (dialog + odświeżenie stanu)
- **Nowe główne elementy:**
    - `<pych-ai-credits-indicator type="draft" />` w nagłówku
    - `mat-card` z banerem upgrade (warunkowy `@if(isExhausted)`)
    - `[disabled]="isExhausted('draft')"` na przycisku generowania
    - `matTooltip="Brak kredytów AI — przejdź na Premium"` na zablokowanym przycisku
- **Obsługiwane interakcje (nowe):**
    - Obsługa `HttpErrorResponse` ze statusem 402 → `MatDialog.open(AiCreditsExhaustedDialogComponent, ...)` + `creditsService.refreshCredits()`

---

### Zmodyfikowany `RecipeFormComponent` (generowanie zdjęcia AI)

- **Opis (dodatkowe zmiany):** Obszar generowania zdjęcia AI otrzymuje:
    1. Kompaktowy wskaźnik kredytów image obok przycisku
    2. Blokadę przycisku generowania gdy `isExhausted('image') === true`
    3. Obsługę błędu 402
- **Nowe główne elementy:**
    - `<pych-ai-credits-indicator type="image" [compact]="true" />` obok przycisku
    - `[disabled]="isExhausted('image')"` na przycisku „Generuj zdjęcie AI"
- **Obsługiwane interakcje (nowe):**
    - Obsługa 402 → dialog + odświeżenie stanu (analogicznie do assist page)

---

## 5. Typy

### Typy już zdefiniowane w `shared/contracts/types.ts`

| Typ | Opis |
|---|---|
| `AiCreditLimitType` | `'lifetime' \| 'monthly' \| 'unlimited'` |
| `AiCreditBalanceDto` | `{ total, used, remaining }` — null oznacza unlimited |
| `AiCreditsResponseDto` | Odpowiedź `GET /ai/credits` |
| `AiCreditsExhaustedErrorDto` | Błąd 402 z detalami |
| `UpdateAdminUserAiCreditsCommand` | Body `PATCH /admin/users/{id}/ai-credits` |
| `UpdateAdminUserAiCreditsResponseDto` | Odpowiedź patcha kredytów admina |
| `MeAiCreditsDto` | Kompaktowy stan z `GET /me` |
| `MeDto` | Zawiera pole `ai_credits: MeAiCreditsDto \| null` |

### Nowe typy ViewModel (wyłącznie frontendowe)

#### `AiCreditBalance`
```typescript
interface AiCreditBalance {
    total: number | null;      // null = unlimited (admin)
    used: number | null;       // null = unlimited (admin)
    remaining: number | null;  // null = unlimited (admin)
}
```

#### `AiCreditsState`
Wewnętrzny stan `AiCreditsService`:
```typescript
interface AiCreditsState {
    limitType: AiCreditLimitType;   // 'lifetime' | 'monthly' | 'unlimited'
    draft: AiCreditBalance;
    image: AiCreditBalance;
    nextResetAt: Date | null;       // skonwertowane z ISO string
    loading: boolean;               // true podczas ładowania
    error: boolean;                 // true gdy ładowanie nie powiodło się
}
```

#### `AiCreditsExhaustedDialogData`
Dane wstrzykiwane do dialogu przez `MAT_DIALOG_DATA`:
```typescript
interface AiCreditsExhaustedDialogData {
    creditType: 'draft' | 'image';
    limitType: 'lifetime' | 'monthly';
    nextResetAt: Date | null;
}
```

#### `AiCreditsIndicatorVariant`
Typ pomocniczy dla obliczonego wariantu wskaźnika:
```typescript
type AiCreditsIndicatorVariant = 'loading' | 'hidden' | 'normal' | 'warning' | 'exhausted';
```

#### `AiCreditsSettingsViewModel`
Model widoku sekcji ustawień:
```typescript
interface AiCreditsSettingsViewModel {
    draftProgressValue: number;           // 0-100 (used/total*100)
    imageProgressValue: number;
    draftLabel: string;                   // np. "Użyto 1 z 3 kredytów"
    imageLabel: string;
    draftColor: 'primary' | 'warn';       // warn gdy ≤25% lub 100%
    imageColor: 'primary' | 'warn';
    draftExhausted: boolean;
    imageExhausted: boolean;
    showUpgradeCta: boolean;              // true tylko dla roli 'user'
    nextResetFormatted: string | null;    // np. "9 paź 2026"
    isLoading: boolean;
    hasError: boolean;
}
```

---

## 6. Zarządzanie stanem

### `AiCreditsService` — centralny punkt zarządzania stanem

Serwis używa **Angular Signals** jako mechanizmu reaktywności. Nie używa NgRx ani RxJS Subject — zgodnie z wytycznymi projektu.

```typescript
// Wewnętrzny signal z pełnym stanem
private readonly _credits = signal<AiCreditsState | null>(null);

// Publiczny odczyt (readonly)
readonly credits = this._credits.asReadonly();
```

**Inicjalizacja (bootstrap):**
1. App Shell po zalogowaniu wywołuje `GET /me` → odpowiedź zawiera `ai_credits: MeAiCreditsDto | null`
2. `AiCreditsService.bootstrapFromMeResponse(meCredits)` ustawia wstępny, kompaktowy stan (`remaining`, `limit_type`, `next_reset_at`)
3. W tle wywołuje `loadCredits()` → `GET /ai/credits` → uzupełnia pełny stan (`total`, `used`)

**Odświeżanie po operacji AI:**
- Każdy komponent wywołujący AI (draft/image) po odpowiedzi (sukces lub 402) wywołuje `creditsService.refreshCredits()`
- `refreshCredits()` wywołuje `loadCredits()` i aktualizuje signal

**Użycie w komponentach:**
```typescript
// Przykład w RecipeAssistComponent
private readonly creditsService = inject(AiCreditsService);

protected readonly isExhausted = computed(
    () => this.creditsService.isExhausted('draft')
);
```

**Computed w `AiCreditsIndicatorComponent`:**
- Komponent oblicza `variant: AiCreditsIndicatorVariant` przez `computed()`:
    - `'hidden'` gdy `limitType === 'unlimited'` lub `error === true`
    - `'loading'` gdy `loading === true`
    - `'exhausted'` gdy `remaining === 0`
    - `'warning'` gdy `remaining / total ≤ 0.25`
    - `'normal'` w przeciwnym razie

**Nie jest wymagany customowy hook** — wystarczy `AiCreditsService` + `computed()` w komponentach.

---

## 7. Integracja API

### `GET /ai/credits`

- **Wywołanie:** `supabase.functions.invoke('ai/credits', { method: 'GET' })`
- **Typ odpowiedzi:** `AiCreditsResponseDto`
- **Kiedy:** Podczas bootstrapu sesji (lub jawnego odświeżenia po operacji AI)
- **Mapowanie:** `next_reset_at` (string ISO) → `Date` w ViewModel, `null` pozostaje `null`

```typescript
loadCredits(): Observable<AiCreditsState> {
    return from(
        this.supabase.functions.invoke<AiCreditsResponseDto>('ai/credits', { method: 'GET' })
    ).pipe(
        map(response => {
            if (response.error) throw response.error;
            return this.mapResponseToState(response.data!);
        }),
        tap(state => this._credits.update(s => ({ ...s, ...state, loading: false, error: false }))),
        catchError(() => {
            this._credits.update(s => s ? { ...s, loading: false, error: true } : null);
            return EMPTY;
        })
    );
}
```

### `PATCH /admin/users/{userId}/ai-credits`

- **Wywołanie:** `supabase.functions.invoke('admin/users/' + userId + '/ai-credits', { method: 'PATCH', body: command })`
- **Typ żądania:** `UpdateAdminUserAiCreditsCommand`
- **Typ odpowiedzi:** `UpdateAdminUserAiCreditsResponseDto`
- **Kody błędów do obsłużenia:** `400` (wyświetl komunikat), `403` (brak uprawnień), `404` (użytkownik nie istnieje)

### Obsługa błędu `402` w endpointach AI

Istniejący `HttpInterceptor` lub logika w serwisie AI powinna przechwytywać błędy i sprawdzać `error.code === 'AI_CREDITS_EXHAUSTED'`:

```typescript
// W serwisie AI lub komponencie
catchError((error) => {
    if (error.status === 402) {
        const details = error.error as AiCreditsExhaustedErrorDto;
        this.dialog.open(AiCreditsExhaustedDialogComponent, {
            data: {
                creditType: details.details.credit_type,
                limitType: details.details.limit_type,
                nextResetAt: details.details.next_reset_at
                    ? new Date(details.details.next_reset_at)
                    : null
            } satisfies AiCreditsExhaustedDialogData
        });
        this.creditsService.refreshCredits();
    }
    return throwError(() => error);
})
```

---

## 8. Interakcje użytkownika

| Interakcja | Komponent | Wynik |
|---|---|---|
| Użytkownik otwiera `/recipes/new/assist` | `RecipeAssistComponent` | Wskaźnik kredytów draft ładuje się z serwisu; jeśli `remaining === 0` → baner upgrade zamiast wskaźnika |
| Użytkownik klika wyczerpany wskaźnik | `AiCreditsIndicatorComponent` | Otwiera `AiCreditsExhaustedDialogComponent` |
| Użytkownik klika „Przejdź na Premium" w dialogu | `AiCreditsExhaustedDialogComponent` | Zamknięcie dialogu + `router.navigate(['/pricing'])` |
| Użytkownik klika „Wróć" w dialogu | `AiCreditsExhaustedDialogComponent` | Zamknięcie dialogu |
| Użytkownik klika zablokowany przycisk „Generuj draft" | `RecipeAssistComponent` | Przycisk wyłączony (`disabled`), tooltip z wyjaśnieniem |
| API zwraca 402 podczas generowania | `RecipeAssistComponent` / `RecipeFormComponent` | Spinner wyłączany, otwiera się dialog, stan kredytów odświeżany |
| Użytkownik otwiera `/settings` | `SettingsPageComponent` | `AiCreditsSettingsSectionComponent` renderuje pasek postępu z aktualnym stanem |
| Admin otwiera dialog edycji użytkownika | `AdminUserEditDialogComponent` | `AdminUserAiCreditsFormComponent` ładuje stan kredytów użytkownika |
| Admin klika „Resetuj kredyty" | `AdminUserAiCreditsFormComponent` | Zeruje `*_used`, wysyła `PATCH`, wyświetla toast sukcesu |
| Admin zapisuje zmiany kredytów | `AdminUserAiCreditsFormComponent` | Wysyła `PATCH /admin/users/{id}/ai-credits`, aktualizuje UI |

---

## 9. Warunki i walidacja

### Warunki renderowania

| Warunek | Komponent | Zachowanie UI |
|---|---|---|
| `credits === null \|\| loading === true` | `AiCreditsIndicatorComponent` | Wyświetla skeleton/spinner |
| `limitType === 'unlimited'` (admin) | `AiCreditsIndicatorComponent` | Komponent nie renderowany (`@if`) |
| `error === true` | `AiCreditsIndicatorComponent` | Komponent ukryty (fail silent) |
| `remaining === 0` | `AiCreditsIndicatorComponent` | Wariant wyczerpany (ikona `block`, kolor `error`, klikalny) |
| `remaining / total ≤ 0.25` | `AiCreditsIndicatorComponent` | Wariant ostrzegawczy (ikona `warning_amber`, kolor `warn`, tooltip) |
| `isExhausted('draft') === true` | `RecipeAssistComponent` | Przycisk „Generuj draft" `[disabled]="true"`, baner upgrade widoczny |
| `isExhausted('image') === true` | `RecipeFormComponent` | Przycisk „Generuj zdjęcie AI" `[disabled]="true"` |
| `app_role === 'user'` | `AiCreditsSettingsSectionComponent` | Widoczne CTA „Przejdź na Premium" |
| `app_role === 'admin'` | `SettingsPageComponent` | Sekcja kredytów AI ukryta |
| `limit_type === 'monthly'` | `AiCreditsSettingsSectionComponent` | Wyświetlana data resetu |

### Walidacja formularza admina

| Pole | Zasada walidacji | Komunikat błędu |
|---|---|---|
| `draft_credits_total` | `min(0)`, `max(9999)`, `required`, liczba całkowita | „Wartość musi być między 0 a 9999" |
| `draft_credits_used` | `min(0)`, `max(draft_credits_total)` | „Nie może przekroczyć limitu całkowitego" |
| `image_credits_total` | `min(0)`, `max(9999)`, `required`, liczba całkowita | „Wartość musi być między 0 a 9999" |
| `image_credits_used` | `min(0)`, `max(image_credits_total)` | „Nie może przekroczyć limitu całkowitego" |
| `next_reset_at` | `required` gdy `limit_type === 'monthly'`, musi być datą | „Data resetu jest wymagana dla limitu miesięcznego" |

---

## 10. Obsługa błędów

### Błąd ładowania kredytów (`GET /ai/credits`)
- Stan `AiCreditsState.error = true`
- `AiCreditsIndicatorComponent` ukrywa się (fail silent — nie blokuje UI)
- `AiCreditsSettingsSectionComponent` wyświetla komunikat: „Nie udało się załadować stanu kredytów. Odśwież stronę."
- Aplikacja działa normalnie — brak blokowania akcji AI

### Błąd `402 AI_CREDITS_EXHAUSTED` podczas operacji AI
- Spinner/loading wyłączany natychmiast
- Otwierany `AiCreditsExhaustedDialogComponent` z danymi z `details` odpowiedzi
- Wywoływane `creditsService.refreshCredits()` aby zsynchronizować stan
- Przycisk generowania blokowany (po odświeżeniu stanu kredytów)

### Błąd `401 Unauthorized`
- Obsługiwany przez istniejący globalny interceptor HTTP → przekierowanie na `/login`

### Błąd `400 Bad Request` w panelu admina
- Toast/snackbar: `MatSnackBar` z komunikatem z pola `message` odpowiedzi błędu
- Formularz pozostaje otwarty z wpisanymi danymi

### Błąd `403 Forbidden` w panelu admina
- Toast z komunikatem „Brak uprawnień do edycji kredytów"

### Błąd `404 Not Found` w panelu admina
- Toast: „Użytkownik nie istnieje"
- Dialog zamykany

### Race condition (równoległa sesja wyczerpała kredyty)
- Nawet gdy `isExhausted('draft') === false` po stronie klienta, API może zwrócić 402
- Obsługa: zawsze `catchError` dla 402 w operacjach AI, niezależnie od stanu klienta

---

## 11. Kroki implementacji

1. **Utworzenie `AiCreditsService`** (`src/app/core/services/ai-credits.service.ts`)
    - Zdefiniowanie interfejsu `AiCreditsState`
    - Implementacja sygnałów (`_credits`, `credits`)
    - Implementacja `loadCredits()` wywołującego `GET /ai/credits`
    - Implementacja `bootstrapFromMeResponse()` dla inicjalizacji z `GET /me`
    - Implementacja `refreshCredits()` i `isExhausted(type)`
    - Implementacja pomocniczej metody `mapResponseToState()` (konwersja DTO → ViewModel)

2. **Aktualizacja App Shell** — wywołanie `bootstrapFromMeResponse()` po zalogowaniu
    - W serwisie lub komponencie odpowiedzialnym za bootstrap (np. `AuthService` / `AppComponent`): po `GET /me` wywołaj `creditsService.bootstrapFromMeResponse(meData.ai_credits)` i następnie `creditsService.refreshCredits()` w tle

3. **Implementacja `AiCreditsIndicatorComponent`** (`src/app/shared/components/ai-credits-indicator/`)
    - Standalone komponent z `ChangeDetectionStrategy.OnPush`
    - Selector: `pych-ai-credits-indicator`
    - Wejścia: `type`, `showResetDate`, `compact`
    - Computed signal `variant` obliczający wariant wizualny
    - Computed signal `label` obliczający tekst
    - Template z `@switch (variant)` dla różnych stanów
    - Metoda `onExhaustedClick()` otwierająca dialog
    - Stylowanie Sass z wykorzystaniem `--mat-sys-*` zmiennych Material

4. **Implementacja `AiCreditsExhaustedDialogComponent`** (`src/app/shared/components/ai-credits-exhausted-dialog/`)
    - Standalone komponent, `ChangeDetectionStrategy.OnPush`
    - Selector: `pych-ai-credits-exhausted-dialog`
    - `inject(MAT_DIALOG_DATA)` dla danych wejściowych
    - `inject(MatDialogRef)` dla zamknięcia
    - `inject(Router)` dla nawigacji do `/pricing`
    - Template z `@if (data.limitType === 'lifetime')` / `@else` dla wariantów treści
    - Atrybuty a11y: `aria-labelledby`, `role="dialog"`

5. **Modyfikacja `RecipeAssistComponent`** (`src/app/pages/recipes/components/recipe-assist/`)
    - Import i użycie `AiCreditsIndicatorComponent`
    - `inject(AiCreditsService)` i `computed(() => creditsService.isExhausted('draft'))`
    - Dodanie `AiCreditsIndicatorComponent` do nagłówka (`type="draft"`)
    - Warunkowy baner upgrade (`@if (isExhausted())`)
    - `[disabled]="isExhausted()"` na przycisku generowania
    - W `catchError` obsługa statusu 402: otwarcie dialogu + `refreshCredits()`

6. **Modyfikacja `RecipeFormComponent`** (obszar generowania zdjęcia)
    - Analogicznie do kroku 5, ale dla `type="image"` i `[compact]="true"`
    - `inject(AiCreditsService)` i `computed(() => creditsService.isExhausted('image'))`

7. **Implementacja `AiCreditsSettingsSectionComponent`** (`src/app/pages/settings/components/ai-credits-settings-section/`)
    - Standalone komponent, `ChangeDetectionStrategy.OnPush`
    - Selector: `pych-ai-credits-settings-section`
    - `inject(AiCreditsService)` i `inject(AuthService)` (dla roli)
    - `computed()` dla `AiCreditsSettingsViewModel`
    - Template z `mat-progress-bar` dla draft i image
    - Warunki: ukrycie dla admina, CTA dla `user` Free

8. **Modyfikacja `SettingsPageComponent`** — dodanie `AiCreditsSettingsSectionComponent`
    - Import standalone komponentu
    - `@if (appRole !== 'admin')` owijający `<pych-ai-credits-settings-section />`
    - Zachowanie kolejności sekcji: nowa sekcja po sekcji profilu

9. **Implementacja `AdminUserAiCreditsFormComponent`** (`src/app/pages/admin/components/admin-user-ai-credits-form/`)
    - Standalone komponent z `ReactiveFormsModule`
    - `FormGroup` z kontrolkami: `draft_credits_total`, `draft_credits_used`, `image_credits_total`, `image_credits_used`, `limit_type`, `next_reset_at`
    - Walidatory: `Validators.min(0)`, `Validators.max(9999)`, cross-field walidacja `used ≤ total`
    - Metoda `save()` wywołująca `PATCH /admin/users/{userId}/ai-credits`
    - Metoda `resetCredits()` zerująca pola `*_used` + zapis
    - Obsługa błędów API (400, 403, 404) przez `MatSnackBar`

10. **Modyfikacja `AdminUserEditDialogComponent`** — dodanie `AdminUserAiCreditsFormComponent`
    - Import i dodanie `<pych-admin-user-ai-credits-form>` z `[userId]` i `[initialCredits]`
    - Ładowanie stanu kredytów użytkownika przy otwarciu dialogu

11. **Stylowanie responsywne**
    - Desktop (≥960px): wskaźnik w nagłówku inline z flex layout
    - Mobile (<960px): wskaźnik pod tytułem sekcji, `width: 100%`
    - Dialog na mobile: `panelClass: 'mobile-fullscreen-dialog'` dla `mat-dialog-container`

12. **Testy jednostkowe**
    - `AiCreditsService`: test inicjalizacji, `isExhausted()`, `refreshCredits()`, obsługa błędu
    - `AiCreditsIndicatorComponent`: test wariantów (`normal`, `warning`, `exhausted`, `hidden`, `loading`)
    - `AiCreditsExhaustedDialogComponent`: test wariantów (Free, Premium z datą, Premium bez daty)
    - `AiCreditsSettingsSectionComponent`: test obliczania procentu, kolorów, CTA
    - `AdminUserAiCreditsFormComponent`: test walidacji cross-field `used ≤ total`
