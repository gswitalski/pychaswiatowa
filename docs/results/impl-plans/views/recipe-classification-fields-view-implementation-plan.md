# Plan implementacji widoku Klasyfikacja przepisu (typ diety / kuchnia / trudność)

## 1. Przegląd
Celem wdrożenia jest rozszerzenie istniejących widoków związanych z przepisem o **3 opcjonalne pola klasyfikacyjne** oraz ich prezentację w szczegółach:

- **Formularz przepisu (Dodaj/Edytuj)**: dodanie pól:
    - `diet_type`: **Mięso / Wege / Vegan**
    - `cuisine`: **Polska / Azjatycka / Meksykańska / Bliskowschodnia**
    - `difficulty`: **Łatwe / Średnie / Trudne**
  Wymagania UX:
    - listy kontrolowane (użytkownik wybiera z gotowych opcji),
    - pola **opcjonalne**,
    - możliwość **wyczyszczenia** wyboru (brak wartości).

- **Szczegóły przepisu (prywatne i publiczne)**: prezentacja ustawionych wartości jako **metadane** (np. chipy/badge) w przewidywalnym miejscu obok innych metadanych.
  Wymaganie UX:
    - **brak placeholderów** — jeśli wartość nie jest ustawiona, nie renderować żadnego „pustego” elementu.

Zakres dotyczy historyjek: **US-042**, oraz zmian w **US-003 / US-004 / US-005**.

## 2. Routing widoku
Zmiana nie wprowadza nowych tras. Rozszerzamy istniejące:

- **Tworzenie**: `/recipes/new` → `RecipeFormPageComponent`
- **Edycja**: `/recipes/:id/edit` → `RecipeFormPageComponent`
- **Szczegóły prywatne** (kanoniczne): `/recipes/:id-:slug` → `RecipeDetailPageComponent` → `RecipeDetailViewComponent` (shared)
- **Szczegóły publiczne** (kanoniczne): `/explore/recipes/:id-:slug` → `ExploreRecipeDetailPageComponent` → `RecipeDetailViewComponent` (shared)

Klasyfikacja jest renderowana w nagłówku przepisu (`pych-recipe-header`), więc automatycznie pojawia się w obu kontekstach (prywatnym i publicznym).

## 3. Struktura komponentów

### 3.1. Diagram drzewa (wysoki poziom)
```
RecipeFormPageComponent (/recipes/new, /recipes/:id/edit)
 ├─ PageHeaderComponent
 ├─ RecipeBasicInfoFormComponent  (ZMIANA: diet/cuisine/difficulty)
 ├─ RecipeImageUploadComponent
 ├─ RecipeCategorizationFormComponent
 └─ EditableListComponent (ingredients, steps)

RecipeDetailViewComponent (shared; /recipes/... i /explore/recipes/...)
 ├─ PageHeaderComponent
 ├─ RecipeHeaderComponent           (ZMIANA: chipy diet/cuisine/difficulty)
 ├─ RecipeImageComponent
 └─ RecipeContentListComponent
```

### 3.2. Komponenty wprost objęte zmianą
- `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts` (integracja formularza i mapowanie na command)
- `src/app/pages/recipes/recipe-form/components/recipe-basic-info-form/recipe-basic-info-form.component.(ts|html)` (UI pól klasyfikacyjnych)
- `src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.(ts|html)` (render metadanych w szczegółach)

## 4. Szczegóły komponentów

### 4.1. `RecipeFormPageComponent` (ZMIANA)
- **Opis komponentu**: Strona tworzenia/edycji przepisu oparta o `ReactiveFormsModule`. Odpowiada za inicjalizację `FormGroup`, walidację, mapowanie na `CreateRecipeCommand`/`UpdateRecipeCommand`, wywołania API oraz nawigację po zapisie.
- **Główne elementy**: bez zmian w strukturze HTML; sekcja „Podstawowe informacje” pozostaje miejscem na nowe pola.
- **Obsługiwane interakcje**: bez zmian (save/cancel, edycja pól, upload zdjęcia).
- **Obsługiwana walidacja**:
    - bez zmian dla istniejących pól,
    - nowe pola klasyfikacyjne: **brak walidatorów wymagających** (pola opcjonalne),
    - UI wymusza „kontrolowaną listę” przez `mat-select`/toggle i typ kontrolki.
- **Zmiany w kodzie (konkretne miejsca)**:
    - Rozszerzyć `RecipeFormViewModel` o:
        - `dietType: FormControl<RecipeDietType | null>`
        - `cuisine: FormControl<RecipeCuisine | null>`
        - `difficulty: FormControl<RecipeDifficulty | null>`
    - W `initForm()` dodać kontrolki z wartością początkową `null`:
        - `dietType: this.fb.control<RecipeDietType | null>(null)`
        - `cuisine: this.fb.control<RecipeCuisine | null>(null)`
        - `difficulty: this.fb.control<RecipeDifficulty | null>(null)`
    - W `populateForm(recipe: RecipeDetailDto)` dodać `patchValue`:
        - `dietType: recipe.diet_type ?? null`
        - `cuisine: recipe.cuisine ?? null`
        - `difficulty: recipe.difficulty ?? null`
    - W `mapFormToCommand(...)` dopiąć mapowanie do payloadu:
        - `diet_type: formValue.dietType ?? null`
        - `cuisine: formValue.cuisine ?? null`
        - `difficulty: formValue.difficulty ?? null`
      Uwaga: nie wysyłać pustych stringów; tylko `enum` lub `null`.
- **Typy**:
    - `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty` (z `shared/contracts/types.ts`)
    - `CreateRecipeCommand`, `UpdateRecipeCommand`, `RecipeDetailDto`
- **Propsy**: brak (page).

### 4.2. `RecipeBasicInfoFormComponent` (ZMIANA)
- **Opis komponentu**: Prezentacyjny komponent formularza bazowych danych przepisu. Aktualnie przyjmuje kontrolki jako `@Input` i renderuje pola tekstowe/numeryczne + toggle Termorobot. Rozszerzamy go o 3 kontrolowane pola klasyfikacyjne.
- **Główne elementy**:
    - 3 nowe pola w sekcji `.basic-info-form`, rekomendowane jako `mat-form-field` + `mat-select`:
        - „Typ diety”
        - „Kuchnia”
        - „Stopień trudności”
    - Mechanizm czyszczenia (UX):
        - opcja **„Brak”** w `mat-select` z wartością `null` **lub** przycisk `clear` jako `matSuffix` (spójnie z porcjami/czasami).
- **Obsługiwane interakcje**:
    - wybór opcji z listy,
    - czyszczenie wyboru (ustawienie `null`).
- **Obsługiwana walidacja**:
    - brak walidacji wymagającej,
    - wartości muszą pochodzić z list kontrolowanych (w praktyce zapewnia to UI + typ kontrolki).
- **Nowe propsy (Inputs)**:
    - `dietTypeControl: FormControl<RecipeDietType | null>`
    - `cuisineControl: FormControl<RecipeCuisine | null>`
    - `difficultyControl: FormControl<RecipeDifficulty | null>`
- **Typy**:
    - `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`
- **Reużywalność / spójność**:
    - Rekomendowane jest trzymanie map/konfiguracji opcji w jednym miejscu (np. `src/app/shared/models/recipe-classification.model.ts`), aby użyć ich zarówno w formularzu jak i w szczegółach.

### 4.3. `RecipeHeaderComponent` (ZMIANA)
- **Opis komponentu**: Nagłówek przepisu używany w `RecipeDetailViewComponent`. Renderuje nazwę, opis, porcje, czasy, Termorobot, kategorię i tagi — oraz obsługuje zarówno `RecipeDetailDto` jak i `PublicRecipeDetailDto`.
- **Cel zmiany**: Dodać metadane klasyfikacyjne w formie chipów/badge, renderowane **tylko gdy ustawione**.
- **Główne elementy**:
    - w sekcji `.recipe-meta` dodać (przed kategorią/tagami) chipy:
        - `Typ diety` (np. `Mięso`, `Wege`, `Vegan`)
        - `Kuchnia`
        - `Trudność`
    - chipy **nieklikalne** zarówno w kontekście prywatnym jak i publicznym.
- **Obsługiwane interakcje**:
    - brak (metadane informacyjne).
- **Obsługiwana walidacja / zasady renderowania**:
    - jeśli `diet_type === null` → nie renderować chipa,
    - jeśli `cuisine === null` → nie renderować chipa,
    - jeśli `difficulty === null` → nie renderować chipa.
    - Jeśli API zwróci nieznaną wartość (stan nieprawidłowy): fallback:
        - nie renderować chipa **lub** renderować surową wartość + `console.warn` (rekomendacja: nie renderować + log techniczny).
- **Typy**:
    - `RecipeDetailDto | PublicRecipeDetailDto` (już zawierają `diet_type/cuisine/difficulty`)
    - `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`
- **Propsy**: bez zmian.

### 4.4. `RecipeDetailViewComponent` (bez zmian, ale istotny kontekst)
- Komponent współdzielony używany przez oba widoki szczegółów. Po wdrożeniu zmian w `RecipeHeaderComponent` automatycznie pokaże klasyfikację w:
    - prywatnym `/recipes/:id-:slug`,
    - publicznym `/explore/recipes/:id-:slug`.

## 5. Typy

### 5.1. DTO / kontrakty istniejące (bez zmian)
- `RecipeDetailDto`: posiada pola `diet_type`, `cuisine`, `difficulty` (nullable)
- `PublicRecipeDetailDto`: posiada pola `diet_type`, `cuisine`, `difficulty` (nullable)
- `CreateRecipeCommand` / `UpdateRecipeCommand`: posiadają `diet_type`, `cuisine`, `difficulty` jako pola opcjonalne/nullable

### 5.2. Nowe typy ViewModel (rekomendowane, lokalne dla UI)
Aby uniknąć duplikacji mapowań etykiet w wielu miejscach:

- `RecipeClassificationLabels` (np. w `src/app/shared/models/recipe-classification.model.ts`):
    - `dietTypeLabels: Record<RecipeDietType, string>`
    - `cuisineLabels: Record<RecipeCuisine, string>`
    - `difficultyLabels: Record<RecipeDifficulty, string>`

- `RecipeClassificationOptions`:
    - `dietTypeOptions: RecipeDietType[]`
    - `cuisineOptions: RecipeCuisine[]`
    - `difficultyOptions: RecipeDifficulty[]`

Wariant minimalny (bez nowych plików): stałe i mapy w `RecipeBasicInfoFormComponent` i `RecipeHeaderComponent` — ale rekomendowane jest jedno źródło prawdy.

## 6. Zarządzanie stanem
- **Formularz**: stan jest w `FormGroup<RecipeFormViewModel>`; nowe pola są zwykłymi `FormControl<... | null>` bez dodatkowych signal-i.
- **Szczegóły**: brak dodatkowego stanu; render jest deterministyczny na podstawie wartości w `recipe()` (input signal).
- Zasada „loading states”: brak dodatkowych overlay’y; pola klasyfikacyjne zachowują się jak pozostałe pola formularza (wyświetlone stale).

## 7. Integracja API

### 7.1. Wykorzystywane endpointy (bez zmian w ścieżkach)
- `POST /recipes` (Edge Function) — tworzenie: payload rozszerzony o `diet_type/cuisine/difficulty` (opcjonalne).
- `PUT /recipes/{id}` (Edge Function) — edycja: payload rozszerzony o `diet_type/cuisine/difficulty` (opcjonalne).
- `GET /recipes/{id}` — pobranie szczegółów do edycji i do widoku szczegółów (zwraca pola klasyfikacyjne).
- `GET /public/recipes/{id}` (dla publicznych szczegółów) — zwraca pola klasyfikacyjne.

### 7.2. Typy żądania i odpowiedzi
- **Request**:
    - `CreateRecipeCommand` / `UpdateRecipeCommand` z polami:
        - `diet_type?: RecipeDietType | null`
        - `cuisine?: RecipeCuisine | null`
        - `difficulty?: RecipeDifficulty | null`
- **Response**:
    - `RecipeDetailDto` / `PublicRecipeDetailDto` z polami:
        - `diet_type: RecipeDietType | null`
        - `cuisine: RecipeCuisine | null`
        - `difficulty: RecipeDifficulty | null`

### 7.3. Zasady komunikacji z API (reguły projektu)
Frontend korzysta wyłącznie z `supabase.functions.invoke(...)` w serwisach (zgodnie z zasadą: **brak `supabase.from(...)` w UI**).

## 8. Interakcje użytkownika
- **Tworzenie/edycja**:
    - użytkownik wybiera wartości z list kontrolowanych,
    - użytkownik może wyczyścić wybór i wrócić do „brak wartości” (ustawienie `null`),
    - zapis przepisu nie jest blokowany, jeśli pola klasyfikacyjne są puste.
- **Szczegóły przepisu**:
    - jeśli pola klasyfikacyjne są ustawione, użytkownik widzi je jako chipy/badge,
    - jeśli pola nie są ustawione, nie widać żadnego placeholdera ani pustej przestrzeni po metadanych (po prostu brak chipów).

## 9. Warunki i walidacja
- **Warunki (UI)**:
    - `dietTypeControl.value` ∈ `{ 'MEAT' | 'VEGETARIAN' | 'VEGAN' }` lub `null`
    - `cuisineControl.value` ∈ `{ 'POLISH' | 'ASIAN' | 'MEXICAN' | 'MIDDLE_EASTERN' }` lub `null`
    - `difficultyControl.value` ∈ `{ 'EASY' | 'MEDIUM' | 'HARD' }` lub `null`
- **Walidacja**:
    - brak walidacji wymagającej; pola są opcjonalne,
    - walidacja „kontrolowanej listy” jest realizowana przez UI (brak dowolnego inputu),
    - istniejąca walidacja czasów (`total_time_minutes >= prep_time_minutes`) pozostaje bez zmian.

## 10. Obsługa błędów
- **Błędy zapisu (POST/PUT)**:
    - obsługa jak dotychczas w `RecipeFormPageComponent` (`error banner` + blokada `saving`),
    - jeśli backend odrzuci niepoprawną wartość enum (400): komunikat z API pokazany użytkownikowi.
- **Nieoczekiwane wartości enum w response** (stan danych niezgodny):
    - w szczegółach: nie renderować chipa i logować ostrzeżenie (technicznie) do konsoli.
- **Edge case**: starsze przepisy bez pól (null) — poprawny scenariusz, UI nic nie renderuje.

## 11. Kroki implementacji
1. **Zaktualizować ViewModel formularza** (`RecipeFormViewModel`) o 3 nowe kontrolki i dodać je w `initForm()`.
2. **Zaktualizować ładowanie danych do edycji**: dopiąć `diet_type/cuisine/difficulty` do `populateForm()`.
3. **Zaktualizować mapowanie na payload**: dopiąć `diet_type/cuisine/difficulty` do `mapFormToCommand()` z zasadą: tylko enum lub `null`.
4. **Rozszerzyć `RecipeBasicInfoFormComponent`**:
    - dodać 3 nowe `@Input` dla kontrolek,
    - dodać UI pól jako listy kontrolowane,
    - dodać mechanizm czyszczenia (opcja „Brak” lub suffix `clear`).
5. **Dodać wspólne mapy etykiet (rekomendowane)** w `src/app/shared/models/recipe-classification.model.ts` i użyć ich w:
    - `RecipeBasicInfoFormComponent` (opcje i etykiety),
    - `RecipeHeaderComponent` (etykiety na chipach).
6. **Rozszerzyć `RecipeHeaderComponent`** o chipy:
    - renderowane warunkowo (tylko gdy wartość != null),
    - nieklikalne w obu kontekstach.
7. **Sprawdzić spójność na obu detalach**:
    - `/recipes/:id-:slug` (prywatny)
    - `/explore/recipes/:id-:slug` (publiczny)
8. **Testy (rekomendowane)**:
    - unit test mapowania etykiet (np. `MEAT -> Mięso`),
    - test renderu: brak wartości → brak chipów; ustawione → chipy widoczne,
    - test formularza: czyszczenie ustawia `null`.
9. **Weryfikacja manualna**:
    - utworzyć przepis z ustawionymi polami i sprawdzić widok szczegółów,
    - edytować przepis: ustawić, zapisać, ponownie wejść w edycję — wartości mają się odtworzyć,
    - wyczyścić pola i zapisać — chipy mają zniknąć w szczegółach.




