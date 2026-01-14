# Plan implementacji widoku Formularz Przepisu (Dodaj/Edytuj) — Wskazówki

## 1. Przegląd
Celem zmiany jest dodanie do formularza przepisu sekcji **„Wskazówki (opcjonalnie)”**, edytowanej tym samym mechanizmem co listy **Składniki** i **Kroki**: lista elementów z obsługą nagłówków sekcji (`#`) oraz możliwość dodawania/edycji/usuwania i zmiany kolejności.

Zmiana dotyczy widoków:
- `/recipes/new` (tworzenie przepisu)
- `/recipes/:id/edit` (edycja przepisu)

Wskazówki są:
- **opcjonalne** (przepis może zostać zapisany z pustą listą),
- wysyłane do API jako **`tips_raw`** (tekst: linie rozdzielone `\n`, nagłówki zaczynają się od `#`),
- odbierane z API jako **`tips: RecipeContent`** (lista `{ type: 'header' | 'item', content: string }`).

## 2. Routing widoku
Routing jest już dostępny w aplikacji:
- `/recipes/new` → `RecipeFormPageComponent` (create)
- `/recipes/:id/edit` → `RecipeFormPageComponent` (edit)

Pliki routingu:
- `src/app/pages/recipes/recipes.routes.ts`

## 3. Struktura komponentów
W zakresie tej zmiany kluczowe elementy drzewa komponentów:

- `RecipeFormPageComponent` (`pych-recipe-form-page`)
    - `PageHeaderComponent` (`pych-page-header`)
    - `RecipeBasicInfoFormComponent` (`pych-recipe-basic-info-form`)
    - `RecipeImageUploadComponent` (`pych-recipe-image-upload`)
    - `RecipeCategorizationFormComponent` (`pych-recipe-categorization-form`)
    - `EditableListComponent` (`pych-editable-list`) — 3 instancje:
        - składniki
        - kroki
        - **wskazówki (nowa sekcja)**

## 4. Szczegóły komponentów

### RecipeFormPageComponent (`pych-recipe-form-page`)
- **Opis komponentu**: strona formularza przepisu w trybie tworzenia i edycji. Buduje `FormGroup`, ładuje dane przepisu w edycji, mapuje formularz do komend API (`CreateRecipeCommand` / `UpdateRecipeCommand`) i obsługuje zapis.
- **Główne elementy**:
    - Page header z akcjami: „Anuluj”, „Dodaj przepis”/„Zapisz zmiany”
    - Sekcje w `mat-card`: podstawowe informacje, zdjęcie, kategoria/tagi/widoczność, składniki, kroki, **wskazówki**
    - Nowa sekcja „Wskazówki (opcjonalnie)” korzysta z `pych-editable-list`
- **Obsługiwane interakcje**:
    - `onSubmit()` — zapis (POST/PUT)
    - `onCancel()` — powrót do listy lub szczegółów przepisu
    - Obsługa `imageEvent` z `RecipeImageUploadComponent` (bez zmian w kontekście wskazówek)
    - **Nowe w kontekście wskazówek**:
        - dodawanie/edycja/usuwanie/drag&drop pozycji listy wskazówek (delegowane do `EditableListComponent`)
- **Obsługiwana walidacja (zgodna z API i istniejącą implementacją)**:
    - `name`: wymagane, max 150 znaków
    - `ingredients`: wymagane (min. 1 pozycja)
    - `steps`: wymagane (min. 1 pozycja)
    - `servings`: opcjonalne, integer, 1–99
    - `prep_time_minutes`, `total_time_minutes`: opcjonalne, integer, 0–999
    - walidacja relacji czasu: gdy oba ustawione → `total_time_minutes >= prep_time_minutes`
    - **tips**: opcjonalne, brak minimalnej długości listy; pozycje puste nie są dodawane (trim + guard w `EditableListComponent`)
- **Typy**:
    - `RecipeFormViewModel` (lokalny typ formularza) — do rozszerzenia o `tips`
    - `RecipeDetailDto` — wczytanie danych w edycji (z `tips`)
    - `CreateRecipeCommand`, `UpdateRecipeCommand` — zapis (z `tips_raw`)
    - `AiRecipeDraftDto` — prefill z AI (może zawierać `tips_raw`)
- **Propsy**: brak (to page component).

### EditableListComponent (`pych-editable-list`)
- **Opis komponentu**: współdzielony komponent do edycji listy linii tekstu z:
    - dodawaniem przez textarea + Enter / przycisk,
    - edycją inline,
    - usuwaniem,
    - zmianą kolejności (CDK Drag&Drop),
    - wizualnym wyróżnieniem nagłówków (linia zaczynająca się od `#`).
- **Główne elementy**:
    - lista elementów (`cdkDropList` + `cdkDrag`)
    - pole dodawania (textarea) + przycisk „Dodaj”
- **Obsługiwane interakcje**:
    - dodaj (Enter / click)
    - edytuj (Enter zapis / Esc anuluj)
    - usuń
    - przesuń (drag&drop)
- **Walidacja**:
    - nie dodaje pustych wartości (trim)
    - nie zapisuje edycji jako puste (trim)
- **Typy**:
    - `FormArray<FormControl<string>>`
- **Propsy**:
    - `formArray` (wymagane)
    - `label`
    - `placeholder`

## 5. Typy
W implementacji wskazówek kluczowe są następujące typy (z `shared/contracts/types.ts`):

- **`RecipeContentItem`**:
    - `type: 'header' | 'item'`
    - `content: string`
- **`RecipeContent`**: `RecipeContentItem[]`
- **`RecipeDetailDto`**:
    - `tips: RecipeContent` (może być puste)
- **`CreateRecipeCommand`**:
    - `tips_raw?: string` (opcjonalne; nowa linia = element, `#` = nagłówek)
- **`UpdateRecipeCommand`**:
    - `tips_raw?: string` (w praktyce UI powinien wspierać także „wyczyszczenie” wskazówek)
- **`AiRecipeDraftDto`**:
    - `tips_raw?: string` (opcjonalne; jeśli AI wywnioskuje)

Nowe/zmieniane typy ViewModel po stronie widoku:
- **`RecipeFormViewModel`** (w `RecipeFormPageComponent`):
    - dodać pole: `tips: FormArray<FormControl<string>>`

## 6. Zarządzanie stanem
Widok opiera się na:
- **Reactive Forms**: `FormGroup<RecipeFormViewModel>` jako źródło stanu formularza.
- **Signals**: `loading`, `saving`, `imageUploading`, `aiGenerating`, `error`, `isEditMode`, `recipeId`.

Zmiana dla wskazówek:
- dodać `FormArray` `tips` do `FormGroup`,
- dodać wygodny getter `tipsArray`,
- przy prefill:
    - z AI draft: wypełnić `tipsArray` z `draft.tips_raw` (jeśli istnieje),
    - w edycji: wypełnić `tipsArray` z `recipe.tips` (mapując nagłówki na format `# {content}`).

## 7. Integracja API
Komunikacja z API musi być realizowana wyłącznie przez Edge Functions (zgodnie z zasadami projektu).

- **Create**: `RecipesService.createRecipe(command)` → `POST /functions/v1/recipes`
    - payload zawiera `ingredients_raw`, `steps_raw` (wymagane) oraz **`tips_raw` (opcjonalne)**
- **Update**: `RecipesService.updateRecipe(id, command)` → `PUT /functions/v1/recipes/{id}`
    - payload zawiera analogicznie **`tips_raw`** (zależnie od ustaleń implementacyjnych: zawsze odzwierciedla stan formularza, także pusty)
- **Read (edit mode)**: `RecipesService.getRecipeById(id)` → `GET /functions/v1/recipes/{id}`
    - response: `RecipeDetailDto` zawiera `tips: RecipeContent` (może być puste)
- **AI draft (create assist)**: `POST /functions/v1/ai/recipes/draft`
    - response: `AiRecipeDraftDto` może zawierać `tips_raw`, które należy uwzględnić w prefill formularza.

Mapowanie formularza → API (zalecenie):
- `tips_raw` budować jako `tipsArray.value.join('\n')`
    - linia zaczynająca się od `#` jest nagłówkiem sekcji,
    - pozostałe linie są elementami listy.

## 8. Interakcje użytkownika
W sekcji „Wskazówki (opcjonalnie)” użytkownik może:
- dodać nową wskazówkę:
    - wpis w textarea + Enter albo klik „Dodaj”
- dodać nagłówek sekcji:
    - wpisać linię zaczynającą się od `#` (np. `# Patent`)
- edytować istniejącą pozycję:
    - klik ikony edycji, Enter zapisuje, Esc anuluje
- usunąć pozycję
- zmienić kolejność:
    - drag&drop (chwyt „drag_indicator”)

Zachowanie po zapisie:
- create: przekierowanie do kanonicznego URL szczegółów `/recipes/:id-:slug`
- edit: przekierowanie do kanonicznego URL szczegółów `/recipes/:id-:slug`

## 9. Warunki i walidacja
Warunki wymagane przez API i weryfikacja w UI:
- **Wymagane**:
    - `name` (1–150)
    - `ingredients_raw` (co najmniej 1 linia/pozycja)
    - `steps_raw` (co najmniej 1 linia/pozycja)
- **Opcjonalne**:
    - `tips_raw` (0..N linii)
    - `description` (nullable)
    - `category_id` (nullable)
    - `tags[]` (0..N)
    - `servings` (nullable, 1–99)
    - `prep_time_minutes` / `total_time_minutes` (nullable, 0–999)
    - `diet_type` / `cuisine` / `difficulty` (nullable)
    - `is_termorobot`, `is_grill` (boolean, default false)
- **Reguła relacji czasu**:
    - jeśli oba czasy ustawione: `total_time_minutes >= prep_time_minutes`
    - błąd powinien trafić na kontrolkę `totalTimeMinutes` (już wdrożone w validatorze cross-field)

Walidacja specyficzna dla wskazówek:
- brak wymogu minimalnej liczby elementów,
- trim wejścia i brak możliwości dodania pustej pozycji (zapewnia `EditableListComponent`),
- rekomendowane: przy mapowaniu do `tips_raw` nie dodawać pustych linii (join tylko z istniejących elementów listy).

## 10. Obsługa błędów
Scenariusze błędów do obsłużenia lub zachowania:
- **Błąd pobrania przepisu (edit mode)**: banner na górze formularza (`error()`) + brak danych, przycisk „Anuluj” pozwala wrócić.
- **Błąd zapisu (POST/PUT)**: banner `error()` z komunikatem + pozostanie na formularzu z zachowanym stanem.
- **Błędy walidacji API** (np. `400`, relacja czasów): mapować na czytelny komunikat w bannerze, a jeśli to możliwe rozszerzyć przyszłościowo o ustawianie błędów na konkretne kontrolki.
- **Edge case: czyszczenie wskazówek w edycji**:
    - UI musi umożliwiać zapis „pustej listy” (wyczyszczenie sekcji),
    - komenda update powinna odzwierciedlać stan formularza (a nie pozostawiać poprzednich wskazówek przez pominięcie pola).

## 11. Kroki implementacji
1. Rozszerzyć `RecipeFormViewModel` w `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts` o pole `tips: FormArray<FormControl<string>>`.
2. Rozszerzyć inicjalizację formularza (`initForm`) o `tips` jako `FormArray<FormControl<string>>([])` bez walidatorów minimalnej długości.
3. Dodać getter `tipsArray` analogicznie do `ingredientsArray` i `stepsArray`.
4. Prefill z AI draft:
    - w `populateFormFromDraft` dodać parsing `draft.tips_raw` (split `\n`, trim, filtr pustych) i wypełnić `tipsArray`.
5. Prefill w edycji:
    - w `populateForm(recipe: RecipeDetailDto)` dodać wypełnianie `tipsArray` mapując:
        - `header` → `# {content}`
        - `item` → `{content}`
6. Mapowanie formularza → komenda API:
    - w `mapFormToCommand` dodać `tips_raw` z `tipsArray.value.join('\n')`.
    - Ustalić i wdrożyć zachowanie dla pustych wskazówek w edycji (zalecenie: wysyłać pusty string, aby wyczyścić).
7. UI:
    - w `src/app/pages/recipes/recipe-form/recipe-form-page.component.html` dodać nowy `mat-card` po sekcji kroków:
        - tytuł: „Wskazówki (opcjonalnie)”
        - `pych-editable-list` z `formArray="tipsArray"`, `label="Wskazówka"`, placeholder z instrukcją `#`.
8. (Opcjonalnie, ale zalecane) Testy:
    - test jednostkowy dla `RecipeFormPageComponent`: mapowanie `tipsArray` → `tips_raw` oraz prefill `recipe.tips` → `tipsArray`.
    - e2e smoke: dodanie wskazówki w `/recipes/new`, zapis, weryfikacja w szczegółach (jeśli widok szczegółów już pokazuje sekcję tips).

