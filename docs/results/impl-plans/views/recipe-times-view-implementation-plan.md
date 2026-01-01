## Plan implementacji zmian widoków: czasy przygotowania i całkowity (US-040)

## 1. Przegląd
Zmiana dotyczy dwóch istniejących widoków:

- **Formularz Przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`): dodanie pól **„Czas przygotowania (min)”** oraz **„Czas całkowity (min)”** (oba opcjonalne, zakres `0–999`) oraz walidacji relacji **`total_time_minutes ≥ prep_time_minutes`** (gdy oba ustawione).
- **Szczegóły przepisu (widok współdzielony)** (`/recipes/:id`, `/explore/recipes/:id`): prezentacja metadanych pod opisem z ikonami:
    - `schedule` — czas przygotowania
    - `timer` — czas całkowity  
  Metadane renderują się tylko, gdy dana wartość jest ustawiona (uwaga: `0` jest poprawną wartością i ma się wyświetlać).

Zakres zmian jest „frontend-only” (zakładając, że backend już obsługuje pola w DTO/komendach zgodnie z `shared/contracts/types.ts`).

## 2. Routing widoku
Routing bez zmian (istniejące ścieżki):

- **Formularz**: `src/app/pages/recipes/recipes.routes.ts`
    - `/recipes/new` → `RecipeFormPageComponent`
    - `/recipes/:id/edit` → `RecipeFormPageComponent`
- **Szczegóły**:
    - `/recipes/:id` → `RecipeDetailPageComponent` (prywatny)
    - `/explore/recipes/:id` → `ExploreRecipeDetailPageComponent` (publiczny/optional auth)

## 3. Struktura komponentów
Aktualna hierarchia (istotne dla tej zmiany):

- `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)
    - `RecipeBasicInfoFormComponent` (`.../components/recipe-basic-info-form/...`) **(tu dodamy pola czasu)**
    - `RecipeImageUploadComponent` (bez zmian)
    - `RecipeCategorizationFormComponent` (bez zmian)
    - `EditableListComponent` (bez zmian)

- `RecipeDetailViewComponent` (`src/app/shared/components/recipe-detail-view/recipe-detail-view.component.ts`)
    - `RecipeHeaderComponent` (`src/app/pages/recipes/recipe-detail/components/recipe-header/...`) **(tu dodamy metadane czasu)**
    - `RecipeImageComponent` (bez zmian)
    - `RecipeContentListComponent` (bez zmian)

Diagram drzewa (high-level):

```
RecipeFormPageComponent
├─ PageHeaderComponent
└─ <form [formGroup]>
   ├─ RecipeBasicInfoFormComponent   <-- NOWE: pola czasu + walidacja UI
   ├─ RecipeImageUploadComponent
   ├─ RecipeCategorizationFormComponent
   ├─ EditableListComponent (ingredients)
   └─ EditableListComponent (steps)

RecipeDetailViewComponent
├─ PageHeaderComponent (akcje zależne od kontekstu)
└─ content
   ├─ RecipeHeaderComponent          <-- NOWE: render prep/total time z ikonami
   ├─ RecipeImageComponent
   └─ RecipeContentListComponent x2
```

## 4. Szczegóły komponentów

### `RecipeFormPageComponent`
- **Plik**: `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`
- **Opis komponentu**: Strona tworzenia/edycji przepisu. Składa Reactive Form, mapuje na `CreateRecipeCommand`/`UpdateRecipeCommand`, ładuje dane w trybie edycji, orchestruje upload zdjęcia oraz zapis.
- **Zmiany w tym komponencie**:
    - Rozszerzyć `RecipeFormViewModel` o dwa pola:
        - `prepTimeMinutes: FormControl<number | null>`
        - `totalTimeMinutes: FormControl<number | null>`
    - Dodać kontrolki do `initForm()` z walidacją per-field:
        - `Validators.min(0)`, `Validators.max(999)`, `integerValidator()`
        - Pole jest opcjonalne → `null` dozwolone (jak w istniejącym `servings`).
    - Dodać walidator relacyjny (cross-field) na poziomie formy:
        - jeśli `prep_time_minutes != null` i `total_time_minutes != null` → wymagaj `total >= prep`
        - w przeciwnym razie brak błędu
        - błąd powinien trafić na **`totalTimeMinutes`** (dla UX), np. `totalLessThanPrep: true`, i/lub dodatkowo na formę (dla ogólnej diagnostyki).
    - Rozszerzyć `populateForm(recipe: RecipeDetailDto)` o patch:
        - `prepTimeMinutes: recipe.prep_time_minutes ?? null`
        - `totalTimeMinutes: recipe.total_time_minutes ?? null`
    - Rozszerzyć `mapFormToCommand()` o mapowanie:
        - `prep_time_minutes` i `total_time_minutes` jako liczby całkowite (round) lub `null`
        - Nie wysyłać wartości poza zakresem (UI waliduje, ale dodatkowo „safe-guard”: jeśli <0 lub >999 → ustaw `null` albo zablokuj zapis; preferowane: zablokować zapis przez walidację).
    - Zaktualizować binding w `recipe-form-page.component.html` do `RecipeBasicInfoFormComponent`, aby przekazać nowe kontrolki.

- **Główne elementy HTML**:
    - `pych-recipe-basic-info-form` w sekcji „Podstawowe informacje”
- **Obsługiwane zdarzenia**: bez zmian (submit/cancel); walidacja działa w oparciu o `form.valid`.
- **Obsługiwana walidacja (szczegółowo)**:
    - `prepTimeMinutes`:
        - `null` → OK
        - `0–999` integer → OK
        - `<0` lub `>999` → błąd (`min`/`max`)
        - nie-integer → błąd (`notInteger`)
    - `totalTimeMinutes`: jak wyżej
    - Relacja:
        - jeśli oba ustawione → `total >= prep` inaczej błąd `totalLessThanPrep`
    - Wpływ na UI:
        - błąd relacji blokuje zapis (form invalid)
        - błąd ma być czytelnie pokazany w miejscu pola „Czas całkowity”
- **Typy**:
    - `CreateRecipeCommand`, `UpdateRecipeCommand` (już zawierają `prep_time_minutes?`, `total_time_minutes?`)
    - `RecipeDetailDto` (już zawiera `prep_time_minutes`, `total_time_minutes`)
- **Propsy**: n/a (to strona)

### `RecipeBasicInfoFormComponent`
- **Plik**: `src/app/pages/recipes/recipe-form/components/recipe-basic-info-form/recipe-basic-info-form.component.ts`
- **Opis komponentu**: Formularz sekcji „Podstawowe informacje”: nazwa, opis, liczba porcji, termorobot.
- **Zmiana**: Rozszerzyć komponent o dwa pola czasu (w tej samej sekcji).
- **Nowe Inputy**:
    - `prepTimeMinutesControl: FormControl<number | null>`
    - `totalTimeMinutesControl: FormControl<number | null>`
- **Główne elementy HTML** (w `recipe-basic-info-form.component.html`):
    - Dodać dwa `mat-form-field` z `matInput type="number"`:
        - Label: `Czas przygotowania (min)`
        - Label: `Czas całkowity (min)`
        - `min="0" max="999" step="1" inputmode="numeric"`
    - Dodać przyciski „clear” (jak dla porcji) – osobno dla każdego pola, widoczne gdy wartość != null.
    - Dodać `mat-error` dla:
        - `min`, `max`, `notInteger`
        - Dla `totalTimeMinutesControl`: dodatkowo `totalLessThanPrep` (komunikat np. „Czas całkowity nie może być mniejszy niż czas przygotowania”).
    - Dodać `mat-hint` z informacją „Opcjonalne. Zakres 0–999.” oraz wskazówką o relacji (np. „Jeśli uzupełnisz oba pola, czas całkowity musi być ≥ przygotowania.”).
- **Obsługiwane zdarzenia**:
    - `clearPrepTime()` → ustawia `null`, `markAsTouched()`
    - `clearTotalTime()` → ustawia `null`, `markAsTouched()`
- **Obsługiwana walidacja**: tylko prezentacja błędów na podstawie `FormControl.errors` (źródłem prawdy jest walidacja w `RecipeFormPageComponent`).
- **Typy**:
    - `FormControl<number | null>`
- **Propsy**:
    - `@Input({ required: true }) prepTimeMinutesControl`
    - `@Input({ required: true }) totalTimeMinutesControl`

### Walidator relacji czasu (funkcja pomocnicza w `RecipeFormPageComponent`)
- **Opis**: Funkcja walidująca relację `total ≥ prep` tylko gdy oba pola są ustawione.
- **Sugerowana implementacja**:
    - Walidator na poziomie `FormGroup` (w `initForm()` po `this.fb.group(...)`):
        - odczytaj `prepTimeMinutes` i `totalTimeMinutes`
        - jeżeli którykolwiek `null` → `return null`
        - jeżeli `total < prep`:
            - ustaw błąd na `totalTimeMinutesControl` (np. `totalLessThanPrep: true`)
            - zwróć błąd dla formy (opcjonalnie) `timeRelationInvalid: true`
        - jeżeli relacja OK:
            - usuń `totalLessThanPrep` z `totalTimeMinutesControl` (ostrożnie, by nie skasować innych błędów)
            - `return null`
- **Ważne**: unikać „pętli walidacji” – manipulacja błędami controlki w walidatorze grupy musi być defensywna (np. aktualizować tylko gdy stan się zmienia).

### `RecipeHeaderComponent`
- **Plik**: `src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.ts`
- **Opis komponentu**: Nagłówek przepisu: nazwa, liczba porcji (z odmianą), opis, metadane (termorobot/kategoria/tagi).
- **Zmiana**: Dodać metadane czasu **pod opisem** (zgodnie z PRD/US-040).
- **Sugerowana struktura HTML** (w `recipe-header.component.html`):
    - Po bloku opisu (`.recipe-description`) dodać:
        - kontener `.recipe-times` (lub podobny)
        - elementy metadanych renderowane warunkowo:
            - jeśli `prep_time_minutes !== null && !== undefined` → pokaż `mat-icon` `schedule` + label czasu
            - jeśli `total_time_minutes !== null && !== undefined` → pokaż `mat-icon` `timer` + label czasu
- **Formatowanie czasu (UI)**:
    - Wymagane: „`45 min`”, „`1 h 20 min`”, brak wyświetlania gdy pole nieustawione.
    - `0` ma być wyświetlane jako `0 min`.
    - Sugerowane rozwiązanie:
        - dodać w komponencie helper `formatMinutes(minutes: number): string`
        - opcjonalnie: wydzielić do współdzielonego pipe (patrz sekcja „Typy”)
- **Walidacja renderowania (defensywna)**:
    - Jeśli backend zwróci wartość spoza zakresu (`<0` lub `>999`), UI może:
        - nie renderować tej metadany (safe fallback), albo
        - renderować po „clamp” (mniej preferowane).
      Preferowane: **nie renderować** i zostawić log techniczny w konsoli w dev (opcjonalnie).
- **Typy**:
    - `RecipeDetailDto` już zawiera: `prep_time_minutes`, `total_time_minutes`
    - `PublicRecipeDetailDto` też zawiera te pola, ale w tym repo `ExploreRecipesService` zwraca `RecipeDetailDto` — komponent i tak obsługuje oba typy (union).
- **Propsy**: bez zmian

### `RecipeDetailViewComponent`
- **Plik**: `src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html`
- **Opis komponentu**: Szablon stanu ładowania/błędu/sukcesu i kompozycja nagłówka strony + treści przepisu.
- **Zmiana**: Brak zmian w tym komponencie — cała prezentacja czasów dzieje się w `RecipeHeaderComponent`.

## 5. Typy
Wymagane typy już istnieją w `shared/contracts/types.ts`:

- **Dane**:
    - `RecipeDetailDto`: `prep_time_minutes: number | null`, `total_time_minutes: number | null`
    - `PublicRecipeDetailDto`: `prep_time_minutes: number | null`, `total_time_minutes: number | null`
- **Komendy**:
    - `CreateRecipeCommand`: `prep_time_minutes?: number | null`, `total_time_minutes?: number | null`
    - `UpdateRecipeCommand`: dziedziczy pola z `CreateRecipeCommand`

Nowe/zmienione ViewModel:

- `RecipeFormViewModel` (w `RecipeFormPageComponent`):
    - dodać:
        - `prepTimeMinutes: FormControl<number | null>`
        - `totalTimeMinutes: FormControl<number | null>`

Opcjonalnie (rekomendowane dla reużywalności i czystości):

- **Pipe** `DurationMinutesPipe` (np. `src/app/shared/pipes/duration-minutes.pipe.ts`):
    - Input: `number | null | undefined`
    - Output: `string | null` (np. `null` → nie renderować)
    - Format:
        - `0..59` → `"{m} min"`
        - `60..` → `"{h} h"` lub `"{h} h {m} min"` gdy `m > 0`
    - Pipe może być użyty także w przyszłych miejscach (listy, karty, filtry).

## 6. Zarządzanie stanem
Zgodnie z istniejącym podejściem:

- Formularz:
    - Źródło prawdy: `FormGroup` (`RecipeFormPageComponent.form`)
    - Stany UI: `saving`, `loading`, `imageUploading`, `aiGenerating` (signals) — bez zmian
    - Nowe pola czasu są częścią formy; nie wymagają osobnych `signal`.
- Szczegóły:
    - `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent` trzymają `state` jako `signal` i przekazują `recipe` do `RecipeDetailViewComponent`.
    - `RecipeHeaderComponent` wylicza labelki jako `computed()` (analogicznie do `servingsLabel`).

Custom hook: nie dotyczy (Angular).

## 7. Integracja API
Frontend korzysta wyłącznie z Edge Functions (`supabase.functions.invoke`) — bez bezpośrednich zapytań do tabel.

### Formularz (create/update)
- **Create**:
    - Serwis: `RecipesService.createRecipe(command: CreateRecipeCommand, ...)`
    - Endpoint: `POST /functions/v1/recipes`
    - W payloadzie muszą pojawić się pola (jeśli ustawione):
        - `prep_time_minutes`
        - `total_time_minutes`
- **Update**:
    - Serwis: `RecipesService.updateRecipe(id, command: UpdateRecipeCommand, ...)`
    - Endpoint: `PUT /functions/v1/recipes/:id`
    - Analogicznie przekazujemy pola czasu (lub `null` dla czyszczenia).

### Szczegóły
- **Prywatne**:
    - `RecipesService.getRecipeById(id)` → `GET /functions/v1/recipes/:id`
- **Explore**:
    - `ExploreRecipesService.getExploreRecipeById(id)` → `GET /functions/v1/explore/recipes/:id`
    - Oczekujemy, że odpowiedź zawiera `prep_time_minutes` i `total_time_minutes` (number|null).

## 8. Interakcje użytkownika

### Formularz
- **Wpisanie czasu przygotowania**:
    - Użytkownik wpisuje liczbę 0–999
    - UI waliduje zakres i liczbę całkowitą
    - Pole można wyczyścić przyciskiem „X” (ustawia `null`)
- **Wpisanie czasu całkowitego**:
    - Jak wyżej
    - Dodatkowo: jeśli ustawiono oba czasy i `total < prep`:
        - UI pokazuje błąd pod polem czasu całkowitego
        - przycisk „Zapisz” jest zablokowany (form invalid)
- **Czyszczenie pól**:
    - Kliknięcie ikony „clear” przy polu ustawia `null` i oznacza kontrolkę jako touched, żeby user dostał spójny feedback.

### Szczegóły
- **Widok metadanych czasu**:
    - Jeśli `prep_time_minutes` jest ustawione (w tym 0) → pokazujemy ikonę `schedule` + sformatowany czas
    - Jeśli `total_time_minutes` jest ustawione (w tym 0) → pokazujemy ikonę `timer` + sformatowany czas
    - Jeśli wartość jest `null` → element nie jest renderowany

## 9. Warunki i walidacja

### Warunki weryfikowane po stronie UI (zgodnie z wymaganiami)
- **Zakres pól**:
    - `prep_time_minutes`: `null` lub integer `0..999`
    - `total_time_minutes`: `null` lub integer `0..999`
- **Relacja**:
    - jeśli oba nie-null → `total_time_minutes >= prep_time_minutes`

### Jak wpływa to na stan UI
- Każdy błąd walidacji:
    - ustawia `form.invalid = true`
    - blokuje zapis (`isSaveDisabled()` już uwzględnia `formValid`)
- Błąd relacji:
    - powinien być widoczny w jednym, oczywistym miejscu: pod „Czas całkowity (min)”

## 10. Obsługa błędów

### Formularz
- **Błędy walidacji**:
    - pokazywać `mat-error` per pole
    - przy submit przy invalid: `markAllAsTouched()` (już istnieje)
- **Błąd API przy zapisie**:
    - istniejący banner `error()` na stronie pozostaje bez zmian
    - jeśli backend zwróci błąd walidacji relacji czasu (`400`) → komunikat powinien być czytelny; opcjonalnie można w przyszłości mapować go na błąd pola, ale poza zakresem tej zmiany (MVP).

### Szczegóły
- Bez zmian: error state w `RecipeDetailViewComponent` (404/403/400/500) już jest obsłużony.

## 11. Kroki implementacji
1. Zaktualizować `RecipeFormViewModel` w `RecipeFormPageComponent` o `prepTimeMinutes` i `totalTimeMinutes`.
2. Dodać kontrolki do `initForm()` z walidacją `min/max/integer`.
3. Dodać walidator relacji `total ≥ prep` na poziomie `FormGroup` (z błędem przypiętym do `totalTimeMinutes`).
4. Zaktualizować `recipe-form-page.component.html`, przekazując nowe kontrolki do `RecipeBasicInfoFormComponent`.
5. Rozszerzyć `RecipeBasicInfoFormComponent`:
    - dodać `@Input` dla dwóch kontrolek
    - dodać dwa `mat-form-field` + clear + `mat-error` + `mat-hint`
6. Zaktualizować mapowanie danych:
    - `populateForm(recipe)` (edycja) ustawia `prep/total` z DTO
    - `mapFormToCommand()` dodaje `prep_time_minutes` i `total_time_minutes`
7. Rozszerzyć `RecipeHeaderComponent`:
    - dodać render metadanych czasu pod opisem
    - dodać formatowanie minut (helper lub pipe)
8. (Opcjonalnie rekomendowane) Dodać `DurationMinutesPipe` w `src/app/shared/pipes/` i użyć go w `RecipeHeaderComponent`.
9. Testy manualne (checklista):
    - Utworzenie przepisu z czasami: `prep=45`, `total=90` → zapis OK, szczegóły pokazują `45 min` i `1 h 30 min`
    - Utworzenie przepisu z `prep=0`, `total=0` → zapis OK, szczegóły pokazują `0 min` dla obu
    - Relacja: `prep=30`, `total=20` → błąd na polu total, zapis zablokowany
    - Czyszczenie: ustaw `prep=10`, `total=20`, potem wyczyść `prep` → relacja nie obowiązuje, zapis OK
    - Edycja istniejącego przepisu: wczytanie wartości do formy, aktualizacja, czyszczenie na `null`

