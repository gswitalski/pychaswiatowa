# Plan implementacji widoku: Formularz Przepisu (Dodaj/Edytuj) — sekcja „Widoczność”

## 1. Przegląd

Celem aktualizacji widoku „Formularz Przepisu (Dodaj/Edytuj)” jest dodanie do istniejącego formularza sekcji **„Widoczność”** zgodnie z US‑016 oraz PRD: użytkownik ma zawsze wybrać jedną z wartości `PRIVATE | SHARED | PUBLIC`, z domyślną wartością `PRIVATE`. Zmiana dotyczy zarówno trybu tworzenia, jak i edycji oraz mapowania danych na `CreateRecipeCommand` / `UpdateRecipeCommand`.

Plan jest dopasowany do aktualnie istniejącej implementacji w `src/app/pages/recipes/recipe-form/…` (standalone, signals, `@if/@for`, OnPush, Reactive Forms).

> Uwaga: w repo nie znaleziono „formularza do tworzenia piosenki” (brak plików/komponentów powiązanych z `song` / `piosenk*`). W planie opisano reużycie istniejących komponentów formularza przepisu (`RecipeCategorizationFormComponent`, `EditableListComponent`, `PageHeaderComponent`) i wzorca „smart page + dumb components”.

## 2. Routing widoku

Routing pozostaje bez zmian (już istnieje w module `recipes`):

- **Tworzenie**: `/recipes/new`
- **Edycja**: `/recipes/:id/edit`

Widok jest chroniony mechanizmem autoryzacji aplikacji (np. guard dla zalogowanych).

## 3. Struktura komponentów

Drzewo komponentów (stan obecny + miejsce na widoczność):

```
RecipeFormPageComponent
│
├── PageHeaderComponent
│
├── RecipeBasicInfoFormComponent
│
├── RecipeImageUploadComponent
│
├── RecipeCategorizationFormComponent   (TU: Kategoria + Tagi + Widoczność)
│
├── EditableListComponent               (Składniki)
│
└── EditableListComponent               (Kroki)
```

## 4. Szczegóły komponentów

### `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)

- **Opis komponentu**: Smart‑page odpowiedzialny za inicjalizację formularza, wypełnianie danych w trybie edycji, submit/cancel, stany `loading/saving/error`, pobranie kategorii z `CategoriesService`.
- **Główne elementy**:
    - `pych-page-header` z akcjami: „Anuluj”, „Dodaj przepis” / „Zapisz zmiany”.
    - Sekcje w `mat-card` (podstawowe info, zdjęcie, kategoryzacja, składniki, kroki).
    - Control-flow `@if` na stan ładowania i błąd.
- **Obsługiwane zdarzenia**:
    - `(click)` na „Anuluj” → `onCancel()`
    - `(click)` na „Zapisz…” → `onSubmit()`
    - `(imageChange)` z `RecipeImageUploadComponent` → `onImageChange(file)`
- **Walidacja (frontend, zgodnie z API/PRD)**:
    - `name`: required, maxLength 150
    - `ingredients`: min 1 element (walidator na `FormArray`)
    - `steps`: min 1 element (walidator na `FormArray`)
    - **`visibility`: required** i zawsze ustawione (domyślnie `PRIVATE`)
    - Przycisk zapisu `disabled` gdy `form.invalid` lub `saving()`.
- **Typy**:
    - `RecipeDetailDto`, `CreateRecipeCommand`, `UpdateRecipeCommand`
    - `RecipeVisibility` (z `shared/contracts/types.ts`)
    - `CategoryDto`
    - Lokalny `RecipeFormViewModel` (patrz sekcja 5)
- **Propsy**: brak (komponent routowany).

### `RecipeBasicInfoFormComponent`

- **Opis komponentu**: Sekcja danych podstawowych: nazwa i opis.
- **Główne elementy**:
    - `mat-form-field` + `input matInput` (name)
    - `mat-form-field` + `textarea matInput` (description)
    - `mat-error` dla błędów required/maxLength
- **Obsługiwane zdarzenia**: standardowo Reactive Forms (`FormControl`).
- **Walidacja**:
    - `name`: required, maxLength 150
    - `description`: opcjonalne
- **Typy**:
    - `FormControl<string>` (name, description)
- **Propsy**:
    - `[nameControl]: FormControl<string>`
    - `[descriptionControl]: FormControl<string>`

### `RecipeImageUploadComponent`

- **Opis komponentu**: Upload zdjęcia przepisu (wybór pliku + podgląd); plik jest przechowywany w stanie strony (nie w `FormGroup`), a zapis idzie przez `RecipesService` (storage upload + `image_path` w komendzie).
- **Główne elementy**:
    - `input[type="file"]` (ograniczenie do obrazów)
    - podgląd aktualnego obrazu (`currentImageUrl`)
    - przycisk usunięcia/zmiany
- **Obsługiwane zdarzenia**:
    - `(change)` na file input → emit `(imageChange)` z `File | null`
- **Walidacja**:
    - rekomendowane: typ pliku (jpg/png/webp), rozmiar (np. limit MB), komunikat błędu UI
- **Typy**: `File`
- **Propsy**:
    - `[currentImageUrl]: string | null`
    - `(imageChange): EventEmitter<File | null>`

### `RecipeCategorizationFormComponent` (do rozszerzenia o widoczność)

- **Opis komponentu**: Sekcja „Kategoria i tagi” oraz **nowa sekcja „Widoczność”** (zgodnie z wymaganiem: obok kategorii, w danych podstawowych formularza).
- **Główne elementy**:
    - `mat-select` dla kategorii
    - `mat-chip-grid` + input dla tagów
    - **Widoczność** (rekomendacja UX):
        - `mat-radio-group` z trzema opcjami:
            - `PRIVATE` → „Prywatny”
            - `SHARED` → „Współdzielony”
            - `PUBLIC` → „Publiczny”
        - `mat-hint` opisujący konsekwencje wyboru
        - `aria-label` dla grupy radiowej
- **Obsługiwane zdarzenia**:
    - Dodawanie tagu: `(matChipInputTokenEnd)`
    - Usuwanie tagu: `(removed)`
    - Wybór kategorii: binding do `categoryControl`
    - **Zmiana widoczności**: binding do `visibilityControl`
- **Walidacja**:
    - `visibility`: required (w praktyce pole zawsze ustawione — domyślnie `PRIVATE`)
    - `category`/`tags`: opcjonalne
- **Typy**:
    - `FormControl<number | null>` (category)
    - `FormArray<FormControl<string>>` (tags)
    - `FormControl<RecipeVisibility>` (visibility)
    - `CategoryDto[]`
    - `RecipeVisibility`
- **Propsy (interfejs komponentu)**:
    - `[categoryControl]: FormControl<number | null>`
    - `[tagsArray]: FormArray<FormControl<string>>`
    - `[categories]: CategoryDto[]`
    - **`[visibilityControl]: FormControl<RecipeVisibility>`** (NOWE)

### `EditableListComponent` (komponent współdzielony)

- **Opis komponentu**: Reużywalna lista edytowalna dla składników/kroków. Wspiera dodawanie, usuwanie, edycję, drag&drop (CDK) oraz skróty klawiaturowe (Enter/Escape).
- **Główne elementy**:
    - `cdkDropList` + `cdkDrag`
    - `mat-form-field` dla nowej pozycji i edycji
    - przyciski z ikonami Material
- **Obsługiwane zdarzenia**:
    - `(cdkDropListDropped)` → reorder
    - Enter w polu dodawania → `addItem()`
    - Enter/Escape w edycji → `saveEdit()/cancelEdit()`
- **Walidacja**:
    - walidacja minimalnej liczby elementów pozostaje na poziomie strony (`FormArray`).
- **Typy**:
    - `FormArray<FormControl<string>>`
- **Propsy**:
    - `[formArray]`, `[label]`, `[placeholder]`

## 5. Typy

### `RecipeVisibility`

Używany typ kontraktowy (już istnieje):

- `RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC'`

### `RecipeFormViewModel` (do aktualizacji)

Model formularza w `RecipeFormPageComponent` powinien zawierać pole `visibility`:

```typescript
import { FormArray, FormControl } from '@angular/forms';
import { RecipeVisibility } from '../../../../../shared/contracts/types';

export interface RecipeFormViewModel {
    name: FormControl<string>;
    description: FormControl<string>;
    categoryId: FormControl<number | null>;
    visibility: FormControl<RecipeVisibility>;
    tags: FormArray<FormControl<string>>;
    ingredients: FormArray<FormControl<string>>;
    steps: FormArray<FormControl<string>>;
}
```

- **Domyślna wartość**: `visibility = 'PRIVATE'`
- **Walidator**: `Validators.required` (oraz sanity-check przy mapowaniu na komendę)

## 6. Zarządzanie stanem

- **Stan formularza**: Reactive Forms (`FormGroup<RecipeFormViewModel>`) w `RecipeFormPageComponent`.
- **Stan UI**: `signal<boolean>` dla `loading/saving`, `signal<string | null>` dla błędu.
- **Kategorie**: `CategoriesService` jako cache oparty o signals (już istnieje).
- **Zdjęcie**: wybrany plik trzymany poza `FormGroup` (lokalne pole + event z upload komponentu).
- **Wymóg dotyczący loadingów**: utrzymywać poprzednie dane podczas odświeżania; unikać białych overlay (zgodnie z regułami repo).

## 7. Integracja API

Zgodnie z kontraktami w `shared/contracts/types.ts`:

- **Create**: `POST /recipes` (Edge Function) z payloadem `CreateRecipeCommand`:
    - wymagane: `name`, `ingredients_raw`, `steps_raw`, `tags`, **`visibility`**
    - opcjonalne: `description`, `category_id`
    - `image_path` jest ustawiane przez `RecipesService` po uploadzie do storage
- **Update**: `PUT /recipes/:id` (Edge Function) z payloadem `UpdateRecipeCommand` (częściowy):
    - może zawierać **`visibility`** i inne edytowane pola
- **Read**: `GET /recipes/:id` zwraca `RecipeDetailDto`, zawiera `visibility`

Mapowanie formularza → komenda:

- `ingredients_raw = ingredients.join('\n')`
- `steps_raw = steps.join('\n')`
- `tags = tags[]`
- **`visibility = formValue.visibility`**
- `description`: mapować pusty string na `null`

## 8. Interakcje użytkownika

- Użytkownik wypełnia nazwę/ opis.
- Użytkownik wybiera kategorię i dodaje tagi (chips).
- **Użytkownik wybiera widoczność**:
    - Domyślnie widzi ustawione „Prywatny”.
    - Może przełączyć na „Współdzielony” lub „Publiczny”.
    - UI pokazuje krótki opis skutków (hint).
- Użytkownik zarządza listą składników i kroków (`EditableListComponent`).
- Użytkownik dodaje/zmienia zdjęcie.
- Kliknięcie „Zapisz…”:
    - waliduje formularz
    - wysyła komendę do API
    - po sukcesie nawigacja do `/recipes/:id`
- Kliknięcie „Anuluj” wraca do listy lub szczegółów (zależnie od trybu).

## 9. Warunki i walidacja

- **`name`**:
    - required
    - maxLength 150
    - UI: `mat-error` po `touched`
- **`ingredients` i `steps`**:
    - min 1 element (walidator na `FormArray`)
    - UI: błąd sekcji po `touched`
- **`visibility`**:
    - required
    - domyślne `PRIVATE` (formularz nie powinien startować z `null`)
    - UI: radio-group bez możliwości odznaczenia; dodatkowo `mat-error` jeśli jednak pole jest niepoprawne (edge case).
- **Zapis**:
    - disabled gdy `saving()` lub `form.invalid`

## 10. Obsługa błędów

- **Walidacja lokalna**: `markAllAsTouched()` na submit gdy invalid.
- **Błędy API**:
    - `GET /recipes/:id` (404/403): komunikat + nawigacja do listy przepisów
    - `POST/PUT` (400): pokazać komunikat i (jeśli API zwraca szczegóły) mapować na pola
    - pozostałe: banner błędu w formularzu (jak obecnie `error-banner`)
- **Błędy uploadu**:
    - komunikat w sekcji zdjęcia (np. typ/rozmiar lub błąd storage)

## 11. Kroki implementacji

1. **Aktualizacja ViewModel**: dodać `visibility: FormControl<RecipeVisibility>` do `RecipeFormViewModel`, domyślnie `'PRIVATE'`, z `Validators.required`.
2. **Aktualizacja UI „Kategoria i tagi”**: rozszerzyć `RecipeCategorizationFormComponent` o `visibilityControl` i dodać `mat-radio-group` (lub `mat-select` jeśli UX wymaga).
3. **Podpięcie kontrolki w stronie**: przekazać `form.controls.visibility` do `pych-recipe-categorization-form` oraz zdefiniować layout „obok kategorii”.
4. **Tryb edycji**: w `populateForm(recipe)` ustawić `visibility` z `recipe.visibility` (z fallbackiem na `'PRIVATE'`).
5. **Mapowanie do komend API**: w `mapFormToCommand()` uwzględnić `visibility` (dla create; dla update analogicznie, jeśli wysyłamy cały model).
6. **Walidacja i komunikaty**: dodać `mat-hint`/`mat-error` dla widoczności i przetestować edge case `null`.
7. **Testy manualne**:
    - tworzenie: domyślna `PRIVATE`, zmiana na `PUBLIC`, zapis
    - edycja: odczyt istniejącej widoczności, zmiana, zapis
    - walidacja: wymuszenie błędów (pusta nazwa, puste listy)
    - odporność: zachowanie danych przy `saving/loading`
