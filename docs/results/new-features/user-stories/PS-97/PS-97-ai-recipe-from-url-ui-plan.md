# Plan UI — Generowanie przepisu z linku URL przez AI (PS-97)

> **User Story:** PS-97 — Generowanie przepisu z linku URL przez AI
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass
> **Powiązane:** `PS-97-ai-recipe-from-url-user-story.md`, `PS-97-ai-recipe-from-url-api-plan.md`, `PS-97-ai-recipe-from-url-deployment-plan.md`

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeNewAssistPageComponent` | **Modyfikacja** — nowa zakładka „Link URL", komponent inputa URL, obsługa nowych błędów | `src/app/pages/recipes/recipe-new-assist/` |
| `RecipeAssistUrlInputComponent` | **Nowy** komponent — pole URL z walidacją inline | `src/app/pages/recipes/recipe-new-assist/components/recipe-assist-url-input/` |
| `AiDraftService` / serwis asysty | **Modyfikacja** — obsługa nowego `mode: "url"` w żądaniu do API | `src/app/pages/recipes/recipe-new-assist/services/` |
| Testy jednostkowe | **Nowe / rozszerzone** | `*.spec.ts` obok zmienianych plików |
| Trasy / guardy | **Bez zmian** | `/recipes/new/assist` nadal za `premiumRoleMatchGuard` |
| Wskaźnik kredytów `draft` | **Bez zmian** | Istniejący komponent aktualizuje się jak po `text`/`image` |
| Redirect po sukcesie do formularza | **Bez zmian** | Istniejący flow przekierowania do `/recipes/new` z wypełnionym formularzem |

**Poza zakresem PS-97:**
- Zmiany w `RecipeImageUploadComponent` (formularz przepisu).
- Zmiany w trybach `text` i `image` na asyście.
- Nowe guardy lub zmiany w `premiumRoleMatchGuard`.
- Zmiany w ekranie `/recipes/new/start`.

---

## 2. Widok `/recipes/new/assist` — zmiany

### 2.1 Selektor trybu — nowa zakładka

Obecny selektor trybu wejściowego (zakładki lub `mat-button-toggle-group`) posiada opcje `Tekst` i `Obraz`. PS-97 dodaje trzecią opcję:

```
[ Tekst ]  [ Obraz ]  [ Link URL ]
```

Wartość nowej zakładki: `'url'` (typ unii rozszerzony o `'url'`).

Kolejność: `Tekst` (domyślna) → `Obraz` → `Link URL` — nowa zakładka **na końcu**, bez zmiany domyślnego trybu.

### 2.2 Nowy panel trybu `url`

Widoczny wyłącznie gdy `source() === 'url'`. Zawiera komponent `RecipeAssistUrlInputComponent` (patrz sekcja 3).

**ASCII — układ panelu URL:**

```
┌────────────────────────────────────────────────────────┐
│  [ Tekst ]  [ Obraz ]  [ Link URL ]                    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Wklej link do przepisu                                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ https://example.com/przepis-na-zupe...           │  │
│  └──────────────────────────────────────────────────┘  │
│  ⓘ Obsługiwane: strony publiczne dostępne bez logowania│
│                                                        │
│  [ błąd walidacji / błąd pobierania — inline ]         │
│                                                        │
│  ════════════════════════════════════════════════════  │
│  Pula kredytów: ██████░░ 4 / 6                         │
│  ════════════════════════════════════════════════════  │
│                                                        │
│                  [ Generuj przepis  ▶ ]                │
└────────────────────────────────────────────────────────┘
```

Sekcja wskaźnika kredytów i przycisk „Generuj przepis" — **wspólne** dla wszystkich trybów (bez zmian).

---

## 3. Nowy komponent `RecipeAssistUrlInputComponent`

**Ścieżka:** `src/app/pages/recipes/recipe-new-assist/components/recipe-assist-url-input/`

### 3.1 Interfejs komponentu

```typescript
// Wejścia
@Input() disabled: boolean = false; // true gdy spinner/generowanie

// Wyjścia
@Output() urlChange = new EventEmitter<string | null>();
// null gdy pole puste lub błąd walidacji
```

Komponent zarządza własnym stanem walidacji; wartość emitowana do rodzica tylko gdy `isValid === true`.

### 3.2 Walidacja inline (po stronie frontendu)

Walidacja uruchamiana przy `blur` oraz przy próbie wysłania formularza. **Nie blokuje wpisywania.**

| Warunek | Komunikat błędu |
|---|---|
| Pole puste przy próbie generowania | „Wklej adres strony z przepisem." |
| Brak protokołu `http://` lub `https://` | „Adres musi zaczynać się od https:// lub http://." |
| Nieprawidłowa składnia URL | „To nie wygląda na poprawny adres strony." |
| Długość > 2048 znaków | „Adres jest zbyt długi (max 2048 znaków)." |

Komunikaty wyświetlane **inline** pod polem (`mat-error` wewnątrz `mat-form-field`) — bez snackbara.

### 3.3 Szablon (uproszczony)

```html
<mat-form-field appearance="outline" class="url-input-field">
    <mat-label>Link do przepisu</mat-label>
    <input
        matInput
        type="url"
        placeholder="https://example.com/przepis-na-bigos"
        [formControl]="urlControl"
        [disabled]="disabled"
        autocomplete="off"
    />
    <mat-hint>Strona musi być publicznie dostępna (bez logowania)</mat-hint>
    @if (urlControl.invalid && urlControl.touched) {
        <mat-error>{{ errorMessage() }}</mat-error>
    }
</mat-form-field>
```

### 3.4 Sygnały i reaktywność (Angular Signals)

```typescript
urlControl = new FormControl('', [urlValidator]); // własny walidator
errorMessage = computed(() => this.getErrorMessage(this.urlControl.errors));
```

Przy każdej zmianie wartości i poprawności — `urlChange.emit(isValid ? value : null)`.

---

## 4. Obsługa błędów API — nowe kody PS-97

Istniejący mechanizm obsługi błędów w serwisie asysty (`AiDraftService` lub odpowiednik) rozszerzony o mapowanie nowych kodów błędów backendu na komunikaty **inline** (nie snackbar):

| Kod błędu API | Komunikat dla użytkownika |
|---|---|
| `INVALID_URL` | „Podany adres jest nieprawidłowy. Sprawdź, czy link zaczyna się od https://." |
| `URL_INVALID_HOST` | „Adres wskazuje na niedozwolony zasób. Spróbuj z innym linkiem." |
| `URL_FETCH_FAILED` | „Nie udało się pobrać strony. Sprawdź, czy adres jest dostępny publicznie, lub skopiuj treść przepisu ręcznie i użyj trybu Tekst." |
| `URL_TIMEOUT` | „Czas oczekiwania na stronę minął. Spróbuj ponownie lub użyj trybu Tekst." |
| `URL_CONTENT_TOO_LARGE` | „Strona jest zbyt duża, aby ją przetworzyć. Skopiuj treść przepisu i użyj trybu Tekst." |
| `AI_CREDITS_EXHAUSTED` (402) | Istniejący dialog wyczerpania kredytów (bez zmian) |

Miejsce wyświetlenia: blok `.assist-error` pod selektorem trybu (ten sam co przy błędach trybów `text`/`image`).

---

## 5. Stany przycisku „Generuj przepis"

Przycisk „Generuj przepis" jest **wspólny** dla wszystkich trybów. PS-97 dodaje jeden dodatkowy warunek blokady:

| Warunek | Stan przycisku |
|---|---|
| Tryb `url`, pole puste lub walidacja nieudana | `disabled` |
| Tryb `url`, pole poprawne, kredyty > 0 | aktywny |
| Kredyty = 0 (każdy tryb) | `disabled` — istniejące zachowanie |
| Generowanie w toku (spinner) | `disabled` — istniejące zachowanie |

---

## 6. Historyjka użytkownika (szczegółowa)

**Jako** użytkownik Premium przeglądający ulubiony portal kulinarny,  
**chcę** wkleić link do przepisu w asyście AI,  
**aby** nie przepisywać ręcznie składników i kroków do swojej książki kucharskiej.

**Kroki:**

1. Użytkownik kopiuje URL przepisu z paska adresu przeglądarki.
2. Otwiera `/recipes/new/assist` (konto premium/admin).
3. Klika zakładkę „Link URL".
4. Wkleja skopiowany URL w pole wejściowe.
5. Klika „Generuj przepis".
6. Widzi spinner — trwa pobieranie strony i generowanie draftu.
7. Formularz `/recipes/new` otwiera się wstępnie wypełniony: nazwa, opis, składniki, kroki, wskazówki, porcje, czasy, dieta, kuchnia, trudność, flagi Termorobot/Grill.
8. Wskaźnik kredytów `draft` zmniejsza się o 1.
9. Użytkownik uzupełnia/poprawia formularz i zapisuje przepis.

---

## 7. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `RecipeAssistUrlInputComponent` | Walidacja: puste pole, brak protokołu, zły format, za długi URL |
| Komponent URL | Poprawny URL → `urlChange` emituje wartość |
| Komponent URL | Disabled gdy `disabled = true` |
| `RecipeNewAssistPageComponent` | Nowa zakładka „Link URL" jest renderowana |
| Serwis asysty | Żądanie POST z `mode: "url"` i polem `url` |
| Serwis asysty | Mapowanie `URL_FETCH_FAILED` → komunikat inline |
| Serwis asysty | Mapowanie `URL_TIMEOUT` → komunikat inline |
| Serwis asysty | `402 AI_CREDITS_EXHAUSTED` → dialog (istniejący) |

---

## 8. Checklist implementacji (UI)

- [ ] Nowa zakładka „Link URL" w selektorze trybu na `/recipes/new/assist`
- [ ] Nowy `RecipeAssistUrlInputComponent` z walidacją inline
- [ ] Rozszerzenie `AiDraftService` (lub odpowiednika) o `mode: "url"` i pole `url` w żądaniu
- [ ] Mapowanie nowych kodów błędów API (`URL_FETCH_FAILED`, `URL_TIMEOUT`, `URL_CONTENT_TOO_LARGE`, `URL_INVALID_HOST`) na komunikaty inline
- [ ] Blokada przycisku „Generuj przepis" gdy URL niepoprawny lub pusty
- [ ] Spinner i blokada interakcji przez cały czas generowania (jak w trybów `text`/`image`)
- [ ] ARIA: `aria-label` na polu URL, komunikaty błędów powiązane z `aria-describedby`
- [ ] Testy jednostkowe komponentu i serwisu
- [ ] Regresja: tryby `Tekst` i `Obraz` działają bez zmian
