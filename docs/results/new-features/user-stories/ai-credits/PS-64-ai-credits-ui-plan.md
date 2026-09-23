# PS-64: Model danych i egzekwowanie limitów kredytów AI — Plan UI

> **User Story:** PS-64 — Model danych i egzekwowanie limitów kredytów AI
> **Data:** wrzesień 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `AiCreditsService` | Nowy serwis | `src/app/core/services/` |
| `AiCreditsIndicatorComponent` | Nowy komponent współdzielony | `src/app/shared/components/ai-credits-indicator/` |
| `AiCreditsExhaustedDialogComponent` | Nowy komponent współdzielony (dialog) | `src/app/shared/components/ai-credits-exhausted-dialog/` |
| Strona asysty AI (`/recipes/new/assist`) | Modyfikacja | `src/app/pages/recipes/components/recipe-assist/` |
| Kreator przepisu — generowanie zdjęcia | Modyfikacja | `src/app/pages/recipes/components/recipe-form/` |
| Ustawienia (`/settings`) | Modyfikacja — nowa sekcja kredytów | `src/app/pages/settings/` |
| Admin: lista użytkowników (`/admin/users`) | Modyfikacja — widok kredytów | `src/app/pages/admin/` |

---

## 2. Nowy serwis `AiCreditsService`

**Ścieżka:** `src/app/core/services/ai-credits.service.ts`

Serwis globalny (singleton), odpowiedzialny za:
- Pobranie i cache'owanie stanu kredytów AI (`GET /ai/credits`)
- Udostępnienie reaktywnego sygnału (Angular signal) z aktualnym stanem
- Odświeżanie stanu po każdym wywołaniu endpointu AI

**Interfejsy:**

```typescript
interface AiCreditBalance {
    total: number | null;
    used: number | null;
    remaining: number | null;
}

interface AiCreditsState {
    limitType: 'lifetime' | 'monthly' | 'unlimited';
    draft: AiCreditBalance;
    image: AiCreditBalance;
    nextResetAt: Date | null;
    loading: boolean;
    error: boolean;
}
```

**Publiczne API serwisu:**

```typescript
readonly credits = signal<AiCreditsState | null>(null);

loadCredits(): Observable<AiCreditsState>;
refreshCredits(): void;          // odświeżenie po wywołaniu AI
isExhausted(type: 'draft' | 'image'): boolean;
```

> `AiCreditsService` jest bootstrapowany w `App Shell` po zalogowaniu, analogicznie do `AuthService`. Dane są ładowane jednorazowo przy starcie sesji i odświeżane po każdej operacji AI.

---

## 3. Nowy komponent `AiCreditsIndicatorComponent`

**Ścieżka:** `src/app/shared/components/ai-credits-indicator/`

Miniaturowy, współdzielony komponent wyświetlający stan kredytów danego typu. Używany zarówno na stronie asysty AI, jak i przy generowaniu zdjęcia.

### Wygląd i warianty

Komponent przyjmuje `@Input() type: 'draft' | 'image'` i wyświetla odpowiedni licznik.

**Wariant normalny (kredyty dostępne):**

```
[ikona: auto_awesome]  Kredyty AI: 13 / 20
```

- Kolor tekstu: neutralny (`mat-body-2`)
- Ikona: `mat-icon` z `auto_awesome`

**Wariant ostrzegawczy (kredyty ≤ 25% puli):**

```
[ikona: warning_amber]  Kredyty AI: 2 / 20
```

- Kolor: `warn` (Angular Material theme, pomarańczowy)
- Tooltip: „Masz już tylko X kredytów. Po ich wyczerpaniu przejdź na Premium lub dokup pakiet."

**Wariant wyczerpany (0 kredytów):**

```
[ikona: block]  Brak kredytów AI
```

- Kolor: `warn` (czerwony / `error`)
- Klikalny: kliknięcie otwiera `AiCreditsExhaustedDialogComponent`

**Wariant miesięczny (Premium — wyświetla datę resetu):**

```
[ikona: auto_awesome]  Kredyty AI: 3 / 20  ·  reset 9 paź
```

- Data resetu wyświetlana jako skrócona (np. „9 paź")

**Wariant admin (unlimited):**

Komponent jest ukryty (nie renderowany) dla roli `admin`.

### Wejścia komponentu (`@Input`)

| Input | Typ | Opis |
|---|---|---|
| `type` | `'draft' \| 'image'` | Typ kredytów do wyświetlenia |
| `showResetDate` | `boolean` | Czy pokazywać datę resetu (domyślnie `true`) |
| `compact` | `boolean` | Tryb kompaktowy bez etykiety (domyślnie `false`) |

---

## 4. Nowy komponent `AiCreditsExhaustedDialogComponent`

**Ścieżka:** `src/app/shared/components/ai-credits-exhausted-dialog/`

Dialog Angular Material (`MatDialog`) wyświetlany gdy użytkownik trafi na błąd `402 AI_CREDITS_EXHAUSTED` lub kliknie wyczerpany wskaźnik kredytów.

### Zawartość dialogu

```
╔══════════════════════════════════════════╗
║  [ikona: auto_awesome]                   ║
║  Wyczerpano kredyty AI                   ║
║                                          ║
║  Twoja pula kredytów [draft/image] AI    ║
║  została w całości wykorzystana.         ║
║                                          ║
║  ── Dla Free ─────────────────────────  ║
║  Limity Free to 3 importy AI na konto.   ║
║  Przejdź na Premium, by korzystać        ║
║  z miesięcznej puli kredytów.            ║
║                                          ║
║  ── Dla Premium ──────────────────────  ║
║  Twoja miesięczna pula kredytów          ║
║  zostanie zresetowana 9 październik.     ║
║                                          ║
║  [Wróć]   [Przejdź na Premium →]        ║
╚══════════════════════════════════════════╝
```

**Warianty treści:**

| Rola | Tytuł szczegółowy | CTA główne |
|---|---|---|
| `user` (Free) | Wyczerpano darmowe kredyty (limit lifetime) | „Przejdź na Premium" → `/pricing` |
| `premium` (reset dostępny) | Pula zresetuje się [data] | „Wróć" (jedyny przycisk) |
| `premium` (bez daty) | Pula wyczerpana | „Wróć" |

**Dane wejściowe dialogu (`MAT_DIALOG_DATA`):**

```typescript
interface AiCreditsExhaustedDialogData {
    creditType: 'draft' | 'image';
    limitType: 'lifetime' | 'monthly';
    nextResetAt: Date | null;
}
```

---

## 5. Modyfikacje strony asysty AI (`/recipes/new/assist`)

**Ścieżka:** `src/app/pages/recipes/components/recipe-assist/`

### 5.1. Dodanie wskaźnika kredytów

W nagłówku strony asysty, bezpośrednio pod tytułem sekcji, dodać komponent `AiCreditsIndicatorComponent` z `type="draft"`:

```html
<!-- Nagłówek sekcji AI Assist -->
<div class="assist-header">
    <h2>Asysta AI</h2>
    <app-ai-credits-indicator type="draft" />
</div>
```

Pozycjonowanie: prawa strona nagłówka na desktop (flex layout), pod tytułem na mobile.

### 5.2. Blokowanie formularza przy braku kredytów

Gdy `AiCreditsService.isExhausted('draft') === true`:

- Przycisk „Generuj draft" otrzymuje `[disabled]="true"` i tooltip: „Brak kredytów AI — przejdź na Premium"
- Pole tekstowe i upload obrazu pozostają aktywne (użytkownik może przygotować treść)
- W miejscu wskaźnika pojawia się baner z CTA upgrade (patrz sekcja 5.3)

### 5.3. Baner upgrade (stan wyczerpania)

Wyświetlany zamiast wskaźnika gdy `remaining === 0`:

```
┌─────────────────────────────────────────────────────────┐
│  [ikona: block]  Wyczerpano kredyty AI                  │
│  Twoja pula darmowych importów AI została wykorzystana. │
│  [Przejdź na Premium →]                                 │
└─────────────────────────────────────────────────────────┘
```

Komponent: `mat-card` z `color="warn"`, link do `/pricing`.

### 5.4. Obsługa błędu 402 przy wywołaniu API

Gdy API zwróci `402 AI_CREDITS_EXHAUSTED` w trakcie generowania draftu (np. równoległa sesja wyczerpała kredyty):

1. Spinner/loading wyłączany
2. Otwierany dialog `AiCreditsExhaustedDialogComponent`
3. Stan `AiCreditsService` odświeżany (wywołanie `refreshCredits()`)
4. Przycisk generowania blokowany

---

## 6. Modyfikacje kreatora przepisu — generowanie zdjęcia AI

**Ścieżka:** `src/app/pages/recipes/components/recipe-form/` (lub `recipe-image-upload/`)

### 6.1. Dodanie wskaźnika kredytów image

W obszarze generowania zdjęcia AI (przycisk „Generuj zdjęcie AI"), obok lub pod przyciskiem:

```html
<div class="image-ai-actions">
    <button mat-stroked-button (click)="generateImage()" [disabled]="imageCreditsExhausted">
        <mat-icon>auto_awesome</mat-icon>
        Generuj zdjęcie AI
    </button>
    <app-ai-credits-indicator type="image" [compact]="true" />
</div>
```

Wariant kompaktowy (`compact="true"`) wyświetla tylko liczbę: `3/5` bez etykiety tekstowej, z ikoną i tooltipem.

### 6.2. Blokowanie przycisku przy braku kredytów

Gdy `AiCreditsService.isExhausted('image') === true`:
- Przycisk `[disabled]="true"` z tooltip „Brak kredytów na generowanie zdjęć"
- Ikona wskaźnika zmienia się na `block` (kolor `warn`)
- Kliknięcie na wskaźnik otwiera dialog `AiCreditsExhaustedDialogComponent`

### 6.3. Obsługa błędu 402 z API

Analogicznie do sekcji 5.4 — dialog + odświeżenie stanu.

---

## 7. Modyfikacje strony ustawień (`/settings`)

**Ścieżka:** `src/app/pages/settings/`

### 7.1. Nowa sekcja „Kredyty AI"

Dodać nową kartę/sekcję w ustawieniach, widoczną **dla roli `user` i `premium`** (ukryta dla `admin`).

**Układ sekcji (desktop):**

```
─── Kredyty AI ───────────────────────────────────────────
  Asysta AI (draft przepisu)
  [progress bar]  Użyto 1 z 3 kredytów lifetime

  Generowanie zdjęcia AI
  [progress bar]  Użyto 2 z 5 kredytów  ·  Reset: 9 paź 2026

  [Przejdź na Premium →]   (widoczne tylko dla 'user' Free)
──────────────────────────────────────────────────────────
```

**Komponenty:**
- `mat-progress-bar` w trybie `determinate` (wartość = `used / total * 100`)
- Kolor progress bara: normalny `primary`; przy ≤25% → `warn`
- CTA „Przejdź na Premium" (link do `/pricing`) widoczne tylko dla roli `user`

**Dla roli `user` (Free) z wyczerpaną pulą:**

```
  Asysta AI (draft przepisu)
  [progress bar: pełny, kolor warn]  3/3 kredytów — limit dożywotni wyczerpany
  Twoja pula darmowych importów AI jest wyczerpana.
  [Przejdź na Premium →]
```

**Dla roli `premium`:**

```
  Asysta AI (draft przepisu)
  [progress bar]  Użyto 7 z 20 kredytów  ·  Reset: 9 paź 2026

  Generowanie zdjęcia AI
  [progress bar]  Użyto 0 z 5 kredytów  ·  Reset: 9 paź 2026
```

---

## 8. Modyfikacje panelu admina — `/admin/users`

**Ścieżka:** `src/app/pages/admin/`

### 8.1. Wyświetlanie stanu kredytów w dialogu edycji użytkownika

W istniejącym dialogu zmiany roli użytkownika (`Dialog zmiany roli`) dodać nową sekcję z podglądem i możliwością edycji kredytów:

```
─── Kredyty AI ───────────────────────────────────────
  Typ limitu:   [ lifetime ▾ ]
  Kredyty draft:    [  3  ] / [  3  ]   (total / used)
  Kredyty image:    [  0  ] / [  0  ]
  Następny reset:   [ 2026-10-09 ]
                               [Resetuj kredyty]
──────────────────────────────────────────────────────
```

**Komponenty:**
- `mat-select` dla `limit_type`
- `mat-form-field` + `matInput` (typ `number`) dla wartości kredytów
- Przycisk „Resetuj kredyty" — ustawia `*_used = 0` i zapisuje (`PATCH /admin/users/{id}/ai-credits`)
- Dane ładowane przy otwarciu dialogu z `GET /ai/credits` z przekazanym userId (lub przez endpoint admina)

### 8.2. Kolumna kredytów w tabeli użytkowników (opcjonalna)

Opcjonalnie (jeśli tabela ma miejsce): dodać kolumnę „Kredyty AI" wyświetlającą `draft_remaining/draft_total` jako skrót, np. `13/20`. Kliknięcie kieruje do dialogu edycji.

---

## 9. Stany interfejsu — tabela zbiorcza

| Stan | Komponent | Zachowanie |
|---|---|---|
| Ładowanie kredytów | `AiCreditsIndicatorComponent` | Skeleton/spinner zamiast licznika |
| Kredyty dostępne (>25%) | `AiCreditsIndicatorComponent` | Zielony/neutralny licznik |
| Kredyty niskie (≤25%) | `AiCreditsIndicatorComponent` | Pomarańczowy, tooltip ostrzegawczy |
| Kredyty wyczerpane (0) | `AiCreditsIndicatorComponent` | Czerwony, klikalny → dialog |
| API zwraca 402 | Strona asysty / formularz przepisu | Dialog + odświeżenie stanu |
| Błąd ładowania kredytów | `AiCreditsIndicatorComponent` | Ukryty (fail silent — nie blokuje UI) |
| Rola `admin` | Wszystkie komponenty kredytów | Ukryte / niewyświetlane |

---

## 10. Responsywność

| Breakpoint | Zachowanie |
|---|---|
| ≥960px (desktop) | Wskaźnik kredytów w nagłówku, obok przycisków — flex layout |
| <960px (tablet/mobile) | Wskaźnik pod tytułem sekcji, pełna szerokość; dialog pełnoekranowy na mobile |

---

## 11. Dostępność (a11y)

- Wskaźnik kredytów ma atrybut `aria-label="Kredyty AI: X z Y dostępnych"`.
- Progress bar w ustawieniach ma `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.
- Dialog `AiCreditsExhaustedDialog` implementuje `aria-labelledby` i pułapkę fokusu (Angular CDK Focus Trap — wbudowane w `MatDialog`).
- Przyciski zablokowane (`disabled`) mają towarzyszący tooltip wyjaśniający przyczynę.
- Ikony dekoracyjne mają `aria-hidden="true"`.
