# Plan implementacji widoku PS-97 — Generowanie przepisu z linku URL (Asysta AI)

## 1. Przegląd

Widok `/recipes/new/assist` rozszerza istniejący ekran asysty AI o trzeci tryb wejściowy: **„Link URL"**. Użytkownik z planem Premium lub Admin może wkleić adres strony z przepisem, a backend (Edge Function) pobierze jej treść i przekaże do modelu AI — identycznie jak tekst w trybie `text`. Wynik (wstępnie wypełniony formularz) trafia do `/recipes/new`.

Zakres zmian obejmuje:
- **Modyfikację** `RecipeNewAssistPageComponent` — nowa zakładka i obsługa trybu `url`.
- **Nowy komponent** `RecipeAssistUrlInputComponent` — pole URL z walidacją inline.
- **Modyfikację** `AiRecipeDraftService` — obsługa żądania z `source: 'url'` i mapowanie nowych kodów błędów API.

## 2. Routing widoku

Widok jest dostępny pod istniejącą ścieżką:

```
/recipes/new/assist
```

Chroniony istniejącym guardem `premiumRoleMatchGuard` — bez zmian. Nowy tryb URL nie wymaga osobnej ścieżki ani dodatkowych guardów.

## 3. Struktura komponentów

```
RecipeNewAssistPageComponent          (/recipes/new/assist)
├── PageHeaderComponent               (nagłówek strony, przyciski Wróć / Dalej)
├── AiCreditsIndicatorComponent       (wskaźnik kredytów draft)
├── mat-button-toggle-group           (selektor trybu: Tekst | Obraz | Link URL)
├── [source=text]  textarea           (istniejące pole tekstowe)
├── [source=image] image-paste-area   (istniejąca strefa wklejania obrazu)
│   ├── CameraCaptureButtonComponent
│   └── ClipboardPasteButton
├── [source=url]   RecipeAssistUrlInputComponent   ← NOWY
├── .error-container                  (błędy inline — istniejące + nowe kody)
└── .info-hint                        (wskazówka dolna)
```

## 4. Szczegóły komponentów

### `RecipeNewAssistPageComponent` (modyfikacja)

- **Opis:** Główny komponent strony asysty AI. Zarządza wyborem trybu wejściowego (tekst / obraz / url), wywołaniem serwisu AI, obsługą błędów i nawigacją do formularza przepisu. PS-97 dodaje obsługę trzeciej zakładki `url`.
- **Główne elementy:**
  - `mat-button-toggle-group` — rozszerzony o opcję `value="url"` z ikoną `link`.
  - Panel `@if (source() === 'url')` zawierający `<pych-recipe-assist-url-input>`.
  - Sekcja błędów `.error-container` — obsługuje nowe kody `URL_FETCH_FAILED`, `URL_TIMEOUT`, `URL_CONTENT_TOO_LARGE`, `URL_INVALID_HOST`.
  - Przycisk „Generuj przepis" (`[disabled]` rozszerzony o `!hasAiInput()` w trybie url, gdy URL jest niepoprawny).
- **Obsługiwane interakcje:**
  - `onSourceChange('url')` — przełączenie na tryb URL, wyczyszczenie poprzedniego stanu.
  - `onUrlChange(url: string | null)` — odbiór wartości z `RecipeAssistUrlInputComponent`; zapis do sygnału `urlValue`.
  - `onNext()` — rozszerzony o budowanie żądania z `source: 'url'` i obsługę nowych błędów API.
- **Obsługiwana walidacja:** Przycisk „Generuj przepis" jest wyłączony gdy `source() === 'url' && urlValue() === null`.
- **Typy:** `AiInputSource` (rozszerzony o `'url'`), `AiRecipeDraftRequestDto` (wariant `source: 'url'`).
- **Propsy:** brak (komponent strony najwyższego poziomu).

---

### `RecipeAssistUrlInputComponent` (nowy)

- **Ścieżka:** `src/app/pages/recipes/recipe-new-assist/components/recipe-assist-url-input/`
- **Selektor:** `pych-recipe-assist-url-input`
- **Opis:** Izolowany komponent pola URL z własnym stanem walidacji. Emituje do rodzica poprawny adres (`string`) lub `null` (pole puste / błąd). Zarządza komunikatami błędów inline za pomocą Angular Signals.
- **Główne elementy HTML:**
  - `<mat-form-field appearance="outline">` z `<mat-label>`, `<input matInput type="url">`, `<mat-hint>` i `<mat-error>`.
- **Obsługiwane interakcje:**
  - `blur` na polu — uruchomienie walidacji i oznaczenie pola jako `touched`.
  - `input` — aktualizacja `FormControl`, emisja `urlChange`.
- **Obsługiwana walidacja (inline):**

  | Warunek | Komunikat |
  |---|---|
  | Pole puste przy próbie generowania | „Wklej adres strony z przepisem." |
  | Brak protokołu `http://` lub `https://` | „Adres musi zaczynać się od https:// lub http://." |
  | Nieprawidłowa składnia URL (`new URL()` rzuca wyjątek) | „To nie wygląda na poprawny adres strony." |
  | Długość > 2048 znaków | „Adres jest zbyt długi (max 2048 znaków)." |

- **Typy:** `UrlInputViewModel` (wewnętrzny), `FormControl<string>`.
- **Propsy (Input/Output):**
  ```typescript
  @Input() disabled: boolean = false;
  @Output() urlChange = new EventEmitter<string | null>();
  ```

---

### `AiRecipeDraftService` (modyfikacja)

- **Opis:** Serwis strony odpowiedzialny za komunikację z endpointem `POST /ai/recipes/draft`. PS-97 rozszerza go o:
  - Obsługę wariantu `source: 'url'` w metodzie `generateDraft()`.
  - Mapowanie nowych kodów błędów API na czytelne komunikaty inline.
- **Nowe mapowania błędów:**

  | Kod błędu API | Komunikat |
  |---|---|
  | `INVALID_URL` | „Podany adres jest nieprawidłowy. Sprawdź, czy link zaczyna się od https://." |
  | `URL_INVALID_HOST` | „Adres wskazuje na niedozwolony zasób. Spróbuj z innym linkiem." |
  | `URL_FETCH_FAILED` | „Nie udało się pobrać strony. Sprawdź, czy adres jest dostępny publicznie, lub skopiuj treść przepisu ręcznie i użyj trybu Tekst." |
  | `URL_TIMEOUT` | „Czas oczekiwania na stronę minął. Spróbuj ponownie lub użyj trybu Tekst." |
  | `URL_CONTENT_TOO_LARGE` | „Strona jest zbyt duża, aby ją przetworzyć. Skopiuj treść przepisu i użyj trybu Tekst." |

---

## 5. Typy

### Istniejące typy (bez zmian — `shared/contracts/types.ts`)

```typescript
// Już rozszerzony o 'url' — bez dodatkowych zmian
export type AiRecipeDraftSource = 'text' | 'image' | 'url';

export type AiRecipeDraftRequestDto =
    | { source: 'text'; text: string; output_format: 'pycha_recipe_draft_v1'; language?: string; }
    | { source: 'image'; image: AiRecipeDraftImageDto; output_format: 'pycha_recipe_draft_v1'; language?: string; }
    | { source: 'url'; url: string; output_format: 'pycha_recipe_draft_v1'; language?: string; };

// Odpowiedź bez zmian
export interface AiRecipeDraftResponseDto {
    draft: AiRecipeDraftDto;
    meta: AiRecipeDraftMetaDto;
}
```

### Nowe typy lokalne

#### Rozszerzenie `AiInputSource` (w `recipe-new-assist-page.component.ts`)

```typescript
// Przed (istniejące):
type AiInputSource = 'text' | 'image';

// Po (PS-97):
type AiInputSource = 'text' | 'image' | 'url';
```

#### Nowe kody błędów URL (w `AiRecipeDraftService`)

```typescript
/** Kody błędów API specyficzne dla trybu 'url' */
type UrlDraftErrorCode =
    | 'INVALID_URL'
    | 'URL_INVALID_HOST'
    | 'URL_FETCH_FAILED'
    | 'URL_TIMEOUT'
    | 'URL_CONTENT_TOO_LARGE';
```

#### ViewModel wewnętrzny `RecipeAssistUrlInputComponent`

Komponent nie potrzebuje zewnętrznego ViewModel — stan jest zarządzany przez `FormControl` i Angular Signals:

```typescript
// Wewnętrzne sygnały komponentu
urlControl: FormControl<string>;           // ReactiveFormsModule
errorMessage: Signal<string | null>;       // computed z urlControl.errors
```

## 6. Zarządzanie stanem

Stan zarządzany jest na poziomie `RecipeNewAssistPageComponent` z użyciem **Angular Signals** (zgodnie z istniejącym wzorcem).

### Nowe sygnały w `RecipeNewAssistPageComponent`

```typescript
/** Aktualny (poprawny) URL z RecipeAssistUrlInputComponent; null gdy niepoprawny lub tryb inny */
readonly urlValue = signal<string | null>(null);
```

### Zaktualizowane computed signals

```typescript
// Rozszerzenie hasAiInput o tryb url
readonly hasAiInput = computed(
    () =>
        (this.source() === 'text' && this.text().trim().length > 0) ||
        (this.source() === 'image' && this.imageFile() !== null) ||
        (this.source() === 'url' && this.urlValue() !== null)
);
```

### Stan wewnętrzny `RecipeAssistUrlInputComponent`

Komponent zarządza własnym stanem przez `FormControl` (ReactiveFormsModule). Nie wymaga zewnętrznego serwisu stanu. Przy przełączeniu trybu przez rodzica (`disabled` zmienia się) — komponent pasywnie reaguje.

**Brak customowego hooka** — wystarczą sygnały bezpośrednio w komponentach.

## 7. Integracja API

### Endpoint

```
POST /ai/recipes/draft
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Żądanie dla trybu `url`

**Typ żądania:** `AiRecipeDraftRequestDto` (wariant `source: 'url'`)

```typescript
// Zbudowane w buildRequest() w RecipeNewAssistPageComponent
{
    source: 'url',
    url: this.urlValue()!,        // string — poprawny URL (emitowany przez RecipeAssistUrlInputComponent)
    output_format: 'pycha_recipe_draft_v1',
    language: 'pl',
}
```

### Odpowiedź

**Typ odpowiedzi:** `AiRecipeDraftResponseDto` — **identyczny** jak dla `text` i `image`. Klient (frontend) nie rozróżnia trybu — przetwarza odpowiedź tak samo:

```typescript
this.draftStateService.setDraft(response.draft, response.meta);
this.router.navigate(['/recipes/new']);
```

### Wywołanie w serwisie

Metoda `AiRecipeDraftService.generateDraft(request: AiRecipeDraftRequestDto)` jest wywoływana z nowym wariantem żądania. Serwis używa `supabase.functions.invoke<AiRecipeDraftResponseDto>('ai/recipes/draft', { method: 'POST', body: request })` — bez zmian w mechanizmie wywołania.

## 8. Interakcje użytkownika

1. **Wybór zakładki „Link URL"** — użytkownik klika trzecią zakładkę w `mat-button-toggle-group`. Efekt: `onSourceChange('url')` — czyści `urlValue()`, czyści błędy, wyświetla panel z `RecipeAssistUrlInputComponent`.

2. **Wpisanie/wklejenie URL** — użytkownik wkleja lub wpisuje adres w polu. Efekt: `urlControl.valueChanges` → walidacja → `urlChange.emit(isValid ? value : null)` → `urlValue.set(...)` w rodzicu → aktualizacja stanu przycisku „Generuj przepis".

3. **Utrata fokusu (blur) z pola URL** — uruchamiana jest walidacja inline z komunikatem błędu pod polem (`mat-error`).

4. **Kliknięcie „Generuj przepis" z poprawnym URL** — spinner, wywołanie API, po sukcesie nawigacja do `/recipes/new` z prefillowanym formularzem i aktualizacja wskaźnika kredytów.

5. **Kliknięcie „Generuj przepis" z pustym/niepoprawnym URL** — przycisk jest `disabled`; jeśli użytkownik próbuje, `RecipeAssistUrlInputComponent` wymusza walidację (oznacza pole jako `touched`).

6. **Kliknięcie „Generuj przepis" bez podania jakiegokolwiek wejścia** — `hasAiInput()` zwraca `false`, `onNext()` nawiguje do pustego formularza (istniejące zachowanie zachowane).

7. **Przełączenie z trybu `url` na inny** — `onSourceChange()` czyści `urlValue()`.

## 9. Warunki i walidacja

### Walidacja po stronie frontendu (w `RecipeAssistUrlInputComponent`)

Własny walidator Angular (`urlValidator`):

```typescript
function urlValidator(control: AbstractControl): ValidationErrors | null {
    const value = control.value as string;
    if (!value) return null; // required obsługiwany osobno
    if (value.length > 2048) return { urlTooLong: true };
    if (!value.startsWith('http://') && !value.startsWith('https://')) return { urlNoProtocol: true };
    try {
        new URL(value);
        return null;
    } catch {
        return { urlInvalid: true };
    }
}
```

| Warunek | Gdzie weryfikowany | Wpływ na UI |
|---|---|---|
| Pole puste | Required + `urlChange(null)` | Przycisk „Generuj" disabled; `mat-error` przy blur |
| Brak protokołu | `urlNoProtocol` | `mat-error` inline |
| Zły format URL | `urlInvalid` | `mat-error` inline |
| URL > 2048 znaków | `urlTooLong` | `mat-error` inline |
| `source=url` i `urlValue()===null` | computed `hasAiInput()=false` | Przycisk „Generuj" disabled |

### Warunki przycisku „Generuj przepis"

| Stan | Przycisk |
|---|---|
| Brak AI input (każdy tryb) | aktywny — nawiguje do pustego formularza |
| Tryb `url`, URL poprawny, kredyty > 0 | aktywny |
| Tryb `url`, URL niepoprawny / pusty | `disabled` |
| Kredyty wyczerpane (każdy tryb) | `disabled` z tooltipem |
| Generowanie w toku | `disabled` ze spinnerem |

## 10. Obsługa błędów

### Błędy walidacji frontendu (inline pod polem URL)

Wyświetlane w `<mat-error>` w `RecipeAssistUrlInputComponent`. Widoczne przy `urlControl.invalid && urlControl.touched`.

### Błędy API (inline w `.error-container`)

Wyświetlane przez istniejący mechanizm `.error-container` w `RecipeNewAssistPageComponent`. Mapowanie nowych kodów w `AiRecipeDraftService`:

| Kod | HTTP | Komunikat |
|---|---|---|
| `INVALID_URL` | 400 | „Podany adres jest nieprawidłowy. Sprawdź, czy link zaczyna się od https://." |
| `URL_INVALID_HOST` | 400 | „Adres wskazuje na niedozwolony zasób. Spróbuj z innym linkiem." |
| `URL_FETCH_FAILED` | 422 | „Nie udało się pobrać strony. Sprawdź, czy adres jest dostępny publicznie, lub skopiuj treść przepisu ręcznie i użyj trybu Tekst." |
| `URL_TIMEOUT` | 422 | „Czas oczekiwania na stronę minął. Spróbuj ponownie lub użyj trybu Tekst." |
| `URL_CONTENT_TOO_LARGE` | 422 | „Strona jest zbyt duża, aby ją przetworzyć. Skopiuj treść przepisu i użyj trybu Tekst." |
| `AI_CREDITS_EXHAUSTED` | 402 | Istniejący dialog `AiCreditsExhaustedDialogComponent` — bez zmian |

### Scenariusze brzegowe

| Scenariusz | Obsługa |
|---|---|
| Strona dostępna, ale brak przepisu | AI zwraca draft z polami `null`; formularz otwiera się (może być pusty). Ostrzeżenia z `meta.warnings` wyświetlane istniejącym mechanizmem. |
| Timeout sieci (nie backend) | Ogólny błąd `Error` → `errorMessage.set('Wystąpił nieoczekiwany błąd. Spróbuj ponownie.')` |
| Równoczesne kliknięcia „Generuj" | `isLoading()=true` blokuje przycisk — niemożliwe |

## 11. Kroki implementacji

1. **Rozszerzenie `AiInputSource`** w `recipe-new-assist-page.component.ts`:
   - Zmień `type AiInputSource = 'text' | 'image'` na `type AiInputSource = 'text' | 'image' | 'url'`.

2. **Dodanie sygnału `urlValue`** do `RecipeNewAssistPageComponent`:
   - `readonly urlValue = signal<string | null>(null);`
   - Aktualizacja `hasAiInput` computed o warunek `source() === 'url' && urlValue() !== null`.

3. **Stworzenie `RecipeAssistUrlInputComponent`**:
   - Ścieżka: `src/app/pages/recipes/recipe-new-assist/components/recipe-assist-url-input/`
   - Pliki: `recipe-assist-url-input.component.ts`, `.html`, `.scss`, `.spec.ts`.
   - Implementacja `FormControl` z `urlValidator`, computed `errorMessage`, `@Input() disabled`, `@Output() urlChange`.
   - Szablon: `mat-form-field` z `mat-label`, `input[type=url]`, `mat-hint`, `mat-error`.
   - `aria-describedby` powiązany z `mat-error` (dostępność).

4. **Implementacja `urlValidator`** (funkcja eksportowana lub prywatna w module komponentu):
   - Waliduje: długość > 2048, brak protokołu http/https, nieprawidłowy format URL.

5. **Dodanie zakładki „Link URL"** w szablonie `RecipeNewAssistPageComponent`:
   - `<mat-button-toggle value="url"><mat-icon>link</mat-icon>Link URL</mat-button-toggle>` jako trzecia opcja.

6. **Dodanie panelu trybu URL** w szablonie:
   ```html
   @if (source() === 'url') {
     <div class="url-input-container">
       <pych-recipe-assist-url-input
         [disabled]="isLoading()"
         (urlChange)="onUrlChange($event)"
       />
     </div>
   }
   ```

7. **Implementacja metody `onUrlChange()`** w `RecipeNewAssistPageComponent`:
   ```typescript
   onUrlChange(url: string | null): void {
       this.urlValue.set(url);
       this.clearError();
   }
   ```

8. **Aktualizacja `onSourceChange()`** — czyszczenie `urlValue` przy przełączeniu:
   ```typescript
   case 'url': this.text.set(''); this.clearImage(); break;
   default:    this.urlValue.set(null); break;
   ```

9. **Rozszerzenie `buildRequest()`** o wariant `source: 'url'`:
   ```typescript
   if (this.source() === 'url') {
       return {
           source: 'url',
           url: this.urlValue()!,
           output_format: 'pycha_recipe_draft_v1',
           language: 'pl',
       };
   }
   ```

10. **Mapowanie nowych kodów błędów** w `AiRecipeDraftService`:
    - Dodać stałą lub mapę `URL_ERROR_MESSAGES` i w bloku obsługi błędów API sprawdzać kody `INVALID_URL`, `URL_INVALID_HOST`, `URL_FETCH_FAILED`, `URL_TIMEOUT`, `URL_CONTENT_TOO_LARGE`.
    - Rzucać `AiDraftValidationError` lub nowy `AiDraftUrlError extends Error` z odpowiednim komunikatem (do obsługi w `handleError()`).

11. **Aktualizacja `handleError()`** w `RecipeNewAssistPageComponent`:
    - Obsługa nowego typu błędu URL (jeśli wydzielony) jako komunikatu inline (nie dialog).

12. **Import `RecipeAssistUrlInputComponent`** w `imports[]` `RecipeNewAssistPageComponent`.

13. **Testy jednostkowe `RecipeAssistUrlInputComponent`** (`*.spec.ts`):
    - Walidacja: puste pole, brak protokołu, zły format, URL za długi.
    - Poprawny URL → `urlChange` emituje wartość.
    - `disabled=true` → pole nieaktywne.

14. **Testy jednostkowe rozszerzonego `AiRecipeDraftService`** (`*.spec.ts`):
    - Żądanie POST z `source: 'url'` i polem `url`.
    - Mapowanie `URL_FETCH_FAILED` → komunikat inline.
    - Mapowanie `URL_TIMEOUT` → komunikat inline.
    - `402 AI_CREDITS_EXHAUSTED` → rzuca `AiCreditsExhaustedApiError` (istniejące).

15. **Testy rozszerzonego `RecipeNewAssistPageComponent`** (`*.spec.ts`):
    - Nowa zakładka „Link URL" jest renderowana.
    - Przycisk „Generuj" disabled gdy `urlValue()===null` w trybie url.
    - Przycisk aktywny gdy `urlValue()` jest poprawnym URL.

16. **Regresja** — weryfikacja, że tryby `Tekst` i `Obraz` działają bez zmian.

17. **Dostępność (a11y)** — weryfikacja `aria-label` pola URL, powiązanie `mat-error` z `aria-describedby`.
