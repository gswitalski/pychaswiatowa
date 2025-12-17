# Plan implementacji zmian widoków: Liczba porcji w przepisie

## 1. Przegląd

Celem zmian jest wdrożenie obsługi pola **„Liczba porcji”** (`servings`) w dwóch istniejących widokach:

- **Szczegóły przepisu (widok uniwersalny)**: prezentacja liczby porcji **bezpośrednio pod tytułem** przepisu (dla tras prywatnych i publicznych). Element jest renderowany tylko, gdy `servings` ma wartość.
- **Formularz przepisu (Dodaj/Edytuj)**: dodanie opcjonalnego pola „Liczba porcji” w sekcji „Podstawowe informacje”, z walidacją `1–99` oraz możliwością wyczyszczenia (ustawienie `null`).

Zmiana realizuje wymagania PRD oraz user stories: **US-028**, aktualizacje **US-004/US-005/US-019**.

## 2. Routing widoku

Zmiana nie wprowadza nowych tras – dotyczy istniejących:

- **Szczegóły przepisu (prywatnie)**: `/recipes/:id`
- **Szczegóły przepisu (publicznie / explore)**: `/explore/recipes/:id`
- **Formularz – tworzenie**: `/recipes/new`
- **Formularz – edycja**: `/recipes/:id/edit`

Ważne: widok szczegółów jest „uniwersalny” na poziomie UI (re-użycie komponentu nagłówka przepisu), a różnice kontekstowe (public/private) są obsługiwane przez istniejące strony (`RecipeDetailPageComponent`, `ExploreRecipeDetailPageComponent`).

## 3. Struktura komponentów

Zmiana obejmuje istniejące komponenty (bez przebudowy drzewa):

### 3.1. Szczegóły przepisu

```
RecipeDetailPageComponent (/recipes/:id)
└── RecipeHeaderComponent (dodaj renderowanie servings pod tytułem)

ExploreRecipeDetailPageComponent (/explore/recipes/:id)
└── RecipeHeaderComponent (dodaj renderowanie servings pod tytułem)
```

### 3.2. Formularz przepisu

```
RecipeFormPageComponent (/recipes/new, /recipes/:id/edit)
└── RecipeBasicInfoFormComponent
    ├── pole: Nazwa
    ├── pole: Opis
    └── pole: Liczba porcji (NOWE)
```

## 4. Szczegóły komponentów

### `pych-recipe-header` (`RecipeHeaderComponent`)

- **Opis komponentu**: komponent prezentacyjny nagłówka przepisu, używany zarówno w kontekście prywatnym jak i publicznym. Rozszerzamy go o wyświetlanie liczby porcji pod tytułem.
- **Główne elementy**:
    - `<h1>`: tytuł przepisu (bez zmian)
    - **NOWE**: element tekstowy pod tytułem, np. `<p class="recipe-servings">{{ servingsLabel }}</p>`
    - opis przepisu, kategoria i tagi (bez zmian)
- **Obsługiwane zdarzenia**: brak.
- **Obsługiwana walidacja (warunkowe renderowanie)**:
    - renderuj tylko, jeśli `recipe.servings !== null`
    - (guard) jeśli backend zwróci wartość spoza zakresu (np. `0`, `100`, `NaN`) – nie renderuj (żeby nie psuć UI).
- **Typy**:
    - `recipe: RecipeDetailDto | PublicRecipeDetailDto` (oba typy zawierają `servings: number | null`)
- **Propsy (Inputs)**:
    - `recipe` (wymagany)
    - `isPublic` (opcjonalny)

**Formatowanie i odmiana „porcja/porcje/porcji” (PL)**

W komponencie należy wprowadzić helper (metoda lub `computed`) do formatowania:

- `1` → `1 porcja`
- `2–4` → `X porcje`, z wyjątkiem `12–14`
- pozostałe → `X porcji`

Rekomendowana reguła:

- `n % 10 === 1 && n % 100 !== 11` → `porcja`
- `n % 10 in [2,3,4] && n % 100 not in [12,13,14]` → `porcje`
- else → `porcji`

### `pych-recipe-basic-info-form` (`RecipeBasicInfoFormComponent`)

- **Opis komponentu**: sekcja formularza „Podstawowe informacje”. Dodajemy pole „Liczba porcji”.
- **Główne elementy**:
    - `mat-form-field` + `input` dla nazwy (bez zmian)
    - `mat-form-field` + `textarea` dla opisu (bez zmian)
    - **NOWE**: `mat-form-field` + `input matInput` dla liczby porcji
        - sugerowany `type="number"`, `min="1"`, `max="99"`, `step="1"`, `inputmode="numeric"`
        - `mat-hint`: „Opcjonalne. Zakres 1–99.”
        - przycisk czyszczenia (np. ikona w `matSuffix`) ustawiający `null` (lub pusty string – zależnie od typu kontrolki)
- **Obsługiwane zdarzenia**:
    - klik „Wyczyść” → ustawienie wartości kontrolki na `null` / `''`.
- **Obsługiwana walidacja (frontend)**:
    - pole opcjonalne (brak `required`)
    - wartość, jeśli podana, musi spełniać:
        - integer
        - `>= 1`
        - `<= 99`
    - błędy walidacji:
        - „Podaj liczbę całkowitą” (jeśli wprowadzono ułamki / nie-liczbę)
        - „Minimalna wartość to 1”
        - „Maksymalna wartość to 99”
- **Typy**:
    - **NOWE** Input: `servingsControl: FormControl<number | null>` (lub alternatywnie `FormControl<string>` – patrz uwaga poniżej)

**Uwaga dot. typów w Reactive Forms (input type=number)**

W Angular Reactive Forms `input[type=number]` często operuje na wartościach jako string. Plan zakłada jeden z dwóch wariantów (wybierz konsekwentnie w implementacji):

- wariant A (rekomendowany): `FormControl<number | null>` + jawne mapowanie/normalizacja wartości w `RecipeFormPageComponent` (np. przez parse/guard clauses),
- wariant B: `FormControl<string>` + walidacja regex + mapowanie do `number | null` przy budowaniu komendy API.

### `pych-recipe-form-page` (`RecipeFormPageComponent`)

- **Opis komponentu**: strona formularza tworzenia/edycji. Dodajemy nowy kontroler formularza, podpinamy go do UI i mapujemy na komendy API.
- **Główne elementy**:
    - sekcja „Podstawowe informacje” renderuje `RecipeBasicInfoFormComponent` – należy przekazać dodatkowy Input `servingsControl`.
- **Obsługiwane zdarzenia**:
    - submit (bez zmian) – ma blokować zapis, jeśli `servings` jest poza walidacją.
- **Obsługiwana walidacja (szczegółowa, zgodna z API)**:
    - `servings`:
        - opcjonalne,
        - integer,
        - zakres `1–99`,
        - wartość pusta mapowana do `null`.
- **Typy**:
    - Aktualizacja `RecipeFormViewModel`: dodać pole `servings`.
    - Upewnić się, że `CreateRecipeCommand` zawiera `servings?: number | null` (już istnieje w kontraktach).
- **Mapowanie na API**:
    - `mapFormToCommand(...)` musi ustawiać `servings`:
        - jeśli pole puste → `servings: null`
        - jeśli wpisane → `servings: <liczba całkowita>`
    - `populateForm(recipe)` w trybie edycji musi ustawić wartość kontrolki na `recipe.servings`.

## 5. Typy

### DTO/kontrakty API (istniejące)

Z `shared/contracts/types.ts`:

- `RecipeDetailDto`:
    - zawiera `servings: number | null`
- `PublicRecipeDetailDto`:
    - zawiera `servings: number | null`
- `CreateRecipeCommand`:
    - zawiera `servings?: number | null`
- `UpdateRecipeCommand`:
    - jako `Partial<CreateRecipeCommand>` wspiera aktualizację `servings` (w tym `null`).

### Typy/ViewModel (zmiany w FE)

- `RecipeFormViewModel` (w `RecipeFormPageComponent`):
    - **NOWE**: `servings: FormControl<number | null>` (lub `FormControl<string>` w zależności od wybranego wariantu)

## 6. Zarządzanie stanem

- **Szczegóły przepisu**: bez zmian w stanie stron; dodajemy tylko pochodną wartość do wyświetlenia (`servingsLabel`) w `RecipeHeaderComponent`.
- **Formularz przepisu**:
    - kontrolka `servings` jest częścią `FormGroup` i wpływa na `form.valid`.
    - przycisk „Zapisz” pozostaje blokowany przez `form.invalid` (przez istniejący mechanizm `formValid`).

## 7. Integracja API

Zmiana wykorzystuje istniejące endpointy i kontrakty:

- **Szczegóły prywatne**: `GET /recipes/{id}` → `RecipeDetailDto` (z `servings`)
- **Szczegóły explore**: `GET /explore/recipes/{id}` → obiekt zgodny z `RecipeDetailDto` (z `servings`)
- **Tworzenie przepisu**: `POST /recipes` (body `CreateRecipeCommand` z opcjonalnym `servings`)
- **Aktualizacja przepisu**: `PUT /recipes/{id}` (body `UpdateRecipeCommand` z opcjonalnym `servings`, w tym `null`)

Wymaganie walidacyjne API: `servings` jest opcjonalne, integer `1–99`, dopuszcza `null`.

## 8. Interakcje użytkownika

### Szczegóły przepisu

- Jeśli `servings` jest ustawione, użytkownik widzi linię pod tytułem: `X porcja/porcje/porcji`.
- Jeśli `servings` jest `null`, linia nie jest renderowana.

### Formularz przepisu

- Użytkownik może:
    - wpisać liczbę porcji (1–99),
    - wyczyścić pole (ustawić brak wartości),
    - zobaczyć błędy walidacji przy niepoprawnym wpisie.
- Zapis jest blokowany, gdy liczba porcji jest poza zakresem lub nie jest liczbą całkowitą.

## 9. Warunki i walidacja

- **Pole „Liczba porcji”**:
    - wartość pusta → `null` (do API)
    - wartość niepusta:
        - musi być liczbą całkowitą,
        - `1 <= value <= 99`
- **Wyświetlanie w szczegółach**:
    - renderuj tylko dla `1–99`.
    - stosuj poprawną odmianę „porcja/porcje/porcji”.

## 10. Obsługa błędów

- **Formularz**:
    - przy błędach walidacji: standardowo `markAllAsTouched()` + komunikaty przy polu.
    - przy błędzie API `400` (walidacja): pokaż ogólny błąd strony (jak obecnie) i pozostaw użytkownikowi możliwość poprawy.
- **Szczegóły**:
    - brak nowej obsługi błędów; `servings` traktujemy jako dane opcjonalne.

## 11. Kroki implementacji

1. **Szczegóły przepisu – UI**:
    - zaktualizować `RecipeHeaderComponent` i jego template, dodając warunkowe wyświetlanie `servings` pod tytułem.
    - dodać helper do formatowania z odmianą PL.
2. **Formularz – typy**:
    - rozszerzyć `RecipeFormViewModel` o `servings`.
3. **Formularz – kontrolka i walidatory**:
    - dodać kontrolkę w `initForm()` z walidatorami (`min=1`, `max=99`, walidacja integer).
4. **Formularz – UI sekcji podstawowej**:
    - rozszerzyć `RecipeBasicInfoFormComponent` o `servingsControl` i wyrenderować nowe pole.
    - dodać akcję „Wyczyść” (ustawienie `null`/pustej wartości).
5. **Mapowanie danych**:
    - dodać `servings` do `populateForm(recipe)`.
    - dodać `servings` do `mapFormToCommand()` z normalizacją (puste → `null`).
6. **Weryfikacja manualna (checklista)**:
    - tworzenie: pozostawienie pustego pola → zapis OK, w szczegółach brak linii.
    - tworzenie: wpisanie `1` → zapis OK, w szczegółach `1 porcja`.
    - tworzenie: wpisanie `2/3/4` → `X porcje`; `5` → `X porcji`; `12/13/14` → `X porcji`.
    - edycja: wyczyszczenie pola → zapis OK, w szczegółach linia znika.
    - walidacja: `0`, `100`, `1.5`, tekst → blokada zapisu + błąd przy polu.
