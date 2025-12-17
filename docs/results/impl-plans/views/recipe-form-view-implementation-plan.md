# Plan implementacji widoku: Formularz Przepisu (Dodaj/Edytuj)

## 1. Przegląd

Celem wdrożenia/aktualizacji widoku **„Formularz Przepisu (Dodaj/Edytuj)”** jest zapewnienie pełnej, spójnej z PRD i API obsługi tworzenia oraz edycji przepisu, ze szczególnym uwzględnieniem zmian w sekcji **„Zdjęcie”**:

- Strefa **paste/drop**: wklejanie ze schowka (Ctrl+V) oraz drag&drop pliku z dysku.
- Jawne stany UI: `idle` / `dragover` / `uploading` / `success` / `error`.
- Walidacja po stronie UI zgodna z API: `image/png`, `image/jpeg`, `image/webp`, max **10 MB**.
- **Auto-upload** po poprawnym paste/drop (w trybie edycji lub gdy przepis ma już ID).
- Snackbar/Toast z akcją **„Cofnij”** (Undo) działającą do czasu zapisu (w praktyce: możliwość przywrócenia poprzedniego zdjęcia, zanim użytkownik opuści formularz).
- Akcja **„Usuń zdjęcie”**.

Plan zakłada aktualny stos i zasady repo:
- standalone components, signals, `inject()`, OnPush,
- kontrola przepływu `@if/@for/@switch`,
- Angular Material,
- komunikacja z API wyłącznie przez Supabase Edge Functions oraz dozwolone operacje Storage.

## 2. Routing widoku

Routing pozostaje bez zmian:

- **Tworzenie**: `/recipes/new`
- **Edycja**: `/recipes/:id/edit`

Widok jest częścią prywatnej sekcji aplikacji (wymaga zalogowania).

## 3. Struktura komponentów

Wysokopoziomowe drzewo komponentów (stan bieżący + rozszerzenia):

```
RecipeFormPageComponent
│
├── PageHeaderComponent
│    ├── (Anuluj)
│    └── (Zapisz) [sticky]
│
├── RecipeBasicInfoFormComponent
│
├── RecipeImageUploadComponent   (PASTE/DROP + auto-upload + undo + delete)
│
├── RecipeCategorizationFormComponent   (kategoria + tagi + widoczność)
│
├── EditableListComponent               (Składniki)
│
└── EditableListComponent               (Kroki)
```

## 4. Szczegóły komponentów

### `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)

- **Opis komponentu**: komponent-strona (smart) odpowiedzialny za inicjalizację formularza, pobranie danych w trybie edycji, mapowanie formularza na komendy API, obsługę nawigacji oraz koordynację stanów zapisu i uploadu zdjęcia.
- **Główne elementy**:
    - `pych-page-header` z akcjami: „Anuluj”, „Zapisz”.
    - Sekcje formularza (np. w `mat-card`): dane podstawowe, zdjęcie, kategoryzacja, składniki, kroki.
    - Widoki stanów: ładowanie danych (spinner/skeleton), błąd (komunikat + retry).
- **Obsługiwane zdarzenia**:
    - `(click)` „Anuluj” → `onCancel()`.
    - `(click)` „Zapisz” → `onSubmit()`.
    - `(imageEvent)` z `RecipeImageUploadComponent` (patrz niżej) → aktualizacja stanu zdjęcia po uploadzie/usunięciu lub ustawienie pliku oczekującego (tryb tworzenia).
- **Obsługiwana walidacja (frontend, zgodnie z PRD/API)**:
    - `name`: `required`, `maxLength(150)`.
    - `ingredients`, `steps`: min. 1 element (walidator FormArray).
    - `visibility`: `required`, domyślnie `PRIVATE`.
    - **Zapis**: przycisk „Zapisz” wyłączony, gdy `form.invalid` lub trwa `saving` lub trwa `imageUploading`.
- **Typy**:
    - DTO/Command: `RecipeDetailDto`, `CreateRecipeCommand`, `UpdateRecipeCommand`.
    - Typy domenowe: `RecipeVisibility`, `UploadRecipeImageResponseDto`.
    - ViewModel: `RecipeFormViewModel` (formularz) + `RecipeImageVm` (lokalny VM zdjęcia).
- **Propsy**: brak (komponent routowany).

> Uwaga dot. zachowania „zdjęcia” w trybie tworzenia:
> - Przepis na `/recipes/new` nie ma jeszcze `id`, więc endpoint `POST /recipes/{id}/image` nie może być wywołany natychmiast.
> - W tym trybie komponent zdjęcia powinien pozwolić na wybór/paste/drop, ale traktować plik jako **pending** i przesłać go dopiero po sukcesie `POST /recipes` (lub jawnie komunikować „Zdjęcie zostanie przesłane po zapisaniu przepisu”).

### `RecipeImageUploadComponent` (`src/app/pages/recipes/recipe-form/components/recipe-image-upload/...`)

- **Opis komponentu**: komponent sekcji zdjęcia w formularzu. Odpowiada za:
    - UI strefy paste/drop (instrukcja, focus, dragover),
    - walidację pliku (typ/rozmiar),
    - podgląd obrazu,
    - auto-upload w edycji (i/lub gdy `recipeId` jest dostępne),
    - akcję usuwania zdjęcia,
    - Snackbar „Cofnij” po uploadzie/usunięciu.

- **Główne elementy** (Angular Material + a11y):
    - focusable drop-zone: `div` z `tabindex="0"`, rolą/etykietą (np. `role="button"`, `aria-label="Wklej (Ctrl+V) lub przeciągnij plik"`).
    - układ stanów:
        - `idle`: instrukcja „Wklej (Ctrl+V) lub przeciągnij plik” + przycisk/link „Wybierz plik”.
        - `dragover`: podświetlenie strefy.
        - `uploading`: spinner + opis „Przesyłanie…”, blokada akcji.
        - `success`: podgląd + przyciski „Zmień” i „Usuń zdjęcie”.
        - `error`: komunikat w polu + (opcjonalnie) snackbar.
    - fallback `input[type=file]` (ukryty) z `accept="image/jpeg,image/png,image/webp"`.

- **Obsługiwane interakcje/zdarzenia**:
    - **Klik** na strefę lub „Wybierz plik” → otwarcie file-pickera.
    - **Paste** (`(paste)` na fokusowanej strefie) → pobranie obrazu z `ClipboardEvent.clipboardData.items`.
    - **Drag & Drop**:
        - `(dragenter)/(dragover)` → `preventDefault`, ustawienie stanu `dragover`.
        - `(dragleave)` → powrót do `idle/success`.
        - `(drop)` → `preventDefault`, odczyt `DataTransfer.files[0]`, odrzucenie gdy brak pliku obrazu.
    - **Usuń zdjęcie**:
        - gdy zdjęcie pochodzi z serwera (edycja): wywołanie `DELETE /recipes/{id}/image`.
        - gdy zdjęcie jest pending (tworzenie): czyszczenie pending pliku.
    - **Cofnij** (SnackBar action): przywrócenie poprzedniego zdjęcia (szczegóły w sekcji „Zarządzanie stanem”).

- **Walidacja (szczegółowa, zgodna z API)**:
    - typ MIME: tylko `image/png`, `image/jpeg`, `image/webp`.
    - rozmiar: max **10 MB** (komponent ma mieć ustawione `maxSizeBytes = 10 * 1024 * 1024`).
    - edge case: paste bez obrazu → komunikat „Schowek nie zawiera obrazu”.
    - edge case: drop bez pliku (np. URL/tekst z przeglądarki) → komunikat „Upuść plik obrazu z dysku”.

- **Typy**:
    - `UploadRecipeImageResponseDto` (response po uploadzie).
    - `RecipeImageUploadUiState = 'idle' | 'dragover' | 'uploading' | 'success' | 'error'`.
    - `RecipeImageEvent` (emit do rodzica) – rekomendowane:
        - `{ type: 'pendingFileChanged'; file: File | null }` (tryb tworzenia)
        - `{ type: 'uploaded'; imagePath: string; imageUrl?: string }` (tryb edycji)
        - `{ type: 'deleted' }` (tryb edycji)
        - `{ type: 'uploadingChanged'; uploading: boolean }` (koordynacja blokady „Zapisz”)

- **Propsy (interfejs komponentu)** – rekomendowane:
    - `[recipeId]: number | null` (gdy `null` → tryb pending)
    - `[currentImageUrl]: string | null` (URL do wyświetlenia)
    - `[disabled]: boolean` (np. gdy trwa zapis formularza)
    - `(imageEvent): EventEmitter<RecipeImageEvent>`

### `RecipeCategorizationFormComponent`

- **Opis komponentu**: sekcja kategoryzacji przepisu: kategoria, tagi oraz widoczność.
- **Główne elementy**:
    - `mat-select` dla kategorii.
    - `mat-chip-grid` + input dla tagów.
    - `mat-radio-group` dla widoczności: `PRIVATE` / `SHARED` / `PUBLIC` (z `mat-hint`).
- **Obsługiwane interakcje**:
    - dodawanie/usuwanie tagów,
    - wybór kategorii,
    - zmiana widoczności.
- **Walidacja**:
    - `visibility`: required (pole zawsze ustawione; domyślnie `PRIVATE`).
- **Typy**:
    - `CategoryDto[]`, `RecipeVisibility`.
- **Propsy**:
    - `[categoryControl]`, `[tagsArray]`, `[categories]`, `[visibilityControl]`.

### `RecipeBasicInfoFormComponent`

- **Opis**: nazwa i opis.
- **Walidacja**:
    - `name` required, max 150.

### `EditableListComponent`

- **Opis**: lista edytowalna dla składników/kroków.
- **Walidacja**:
    - minimalna liczba elementów walidowana na poziomie `FormArray` w komponencie strony.

## 5. Typy

### Kontrakty API (istniejące)

- `RecipeVisibility = 'PRIVATE' | 'SHARED' | 'PUBLIC'`
- `CreateRecipeCommand`, `UpdateRecipeCommand`
- `UploadRecipeImageResponseDto`:
    - `id: number`
    - `image_path: string`
    - `image_url?: string`

### ViewModel / typy lokalne widoku (rekomendowane)

- `RecipeFormViewModel` (już istnieje w `RecipeFormPageComponent`).
- `RecipeImageVm` (lokalny stan zdjęcia w stronie):
    - `currentUrl: string | null` (co wyświetlamy)
    - `pendingFile: File | null` (tworzenie)
    - `uploading: boolean`
    - `error: string | null`
    - `undoSnapshot: RecipeImageUndoSnapshot | null`

- `RecipeImageUndoSnapshot`:
    - `kind: 'none' | 'existing'`
    - `previousUrl: string | null`
    - `previousFile: File | null` (jeśli da się odtworzyć poprzednie zdjęcie)

## 6. Zarządzanie stanem

- **Formularz**: Reactive Forms (`FormGroup<RecipeFormViewModel>`) w `RecipeFormPageComponent`.
- **Stany asynchroniczne**:
    - `loading`, `saving` jako `signal<boolean>`.
    - Błąd strony `error` jako `signal<string | null>`.

- **Zdjęcie (ważne dla paste/drop + undo)**:
    - Komponent zdjęcia utrzymuje swój `uiState` (signal) i emituje zdarzenia do strony.
    - Strona utrzymuje `imageUploading` (signal) i blokuje „Zapisz” podczas uploadu.

- **Undo po auto-uploadzie** (scenariusz edycji):
    - Przed rozpoczęciem uploadu nowego zdjęcia komponent powinien spróbować utworzyć snapshot poprzedniego zdjęcia:
        - jeśli istnieje poprzedni obraz i jest dostępny przez URL, pobrać go (`fetch(previousUrl) -> Blob`) i zamienić w `File` (np. `previous.webp`).
        - snapshot przechować w pamięci (tylko na czas sesji formularza).
    - Po sukcesie uploadu/usunięcia: pokazać `MatSnackBar` z akcją „Cofnij”.
    - Gdy użytkownik kliknie „Cofnij”:
        - jeśli snapshot ma `previousFile` → ponownie wywołać `POST /recipes/{id}/image` z tym plikiem.
        - jeśli snapshot oznacza „brak poprzedniego” → wywołać `DELETE /recipes/{id}/image`.
    - Jeśli pobranie poprzedniego obrazu nie jest możliwe, „Cofnij” nadal może istnieć, ale powinien być wyłączony lub pokazać komunikat „Nie można przywrócić poprzedniego zdjęcia” (rekomendacja: ukryć akcję, jeśli brak snapshotu).

## 7. Integracja API

### Endpointy związane ze zdjęciem

- `POST /recipes/{id}/image`
    - `multipart/form-data` z polem `file`
    - response: `UploadRecipeImageResponseDto`.

- `DELETE /recipes/{id}/image`
    - `204 No Content`.

### Implementacja wywołań w frontendzie (wymagana zmiana w serwisie)

W `RecipesService` należy dodać metody (lub nowy `RecipeImagesService`) korzystające z **fetch** + tokenu z sesji, ponieważ `supabase.functions.invoke(...)` w praktyce jest używany do JSON, a upload wymaga `FormData`:

- `uploadRecipeImage(recipeId: number, file: File): Observable<UploadRecipeImageResponseDto>`
    - `POST ${supabaseUrl}/functions/v1/recipes/${recipeId}/image`
    - headers: `Authorization: Bearer <access_token>` (bez ustawiania `Content-Type` ręcznie; zrobi to `fetch` dla FormData)

- `deleteRecipeImage(recipeId: number): Observable<void>`
    - `DELETE ${supabaseUrl}/functions/v1/recipes/${recipeId}/image`

> Ważne: zgodnie z zasadami repo, frontend nie powinien robić bezpośrednich operacji na tabelach Supabase (`from(...)`). Wywołujemy Edge Functions.

### Integracja formularza przepisu (create/update)

- `POST /recipes` – tworzenie przepisu (`CreateRecipeCommand`).
- `PUT /recipes/{id}` – aktualizacja przepisu (`UpdateRecipeCommand`).

Zalecane zachowanie względem zdjęcia:
- **Edycja**: zdjęcie obsługujemy przez endpointy image (auto-upload, delete). `PUT /recipes/{id}` nie powinien już przenosić `image_path` ustawianego przez frontend.
- **Tworzenie**: jeśli użytkownik doda zdjęcie w trakcie tworzenia:
    - po sukcesie `POST /recipes` (mamy `id`) wykonać `POST /recipes/{id}/image` i dopiero potem nawigować do szczegółów (lub nawigować od razu i wykonywać upload w tle – decyzja UX; w MVP rekomendowane: wykonać upload przed przejściem, żeby uniknąć niespójności podglądu).

## 8. Interakcje użytkownika

- **Tworzenie (`/recipes/new`)**:
    - Użytkownik wypełnia nazwę/opis, listy składników/kroków, kategorię/tagi, widoczność.
    - Użytkownik może dodać zdjęcie (wybór pliku lub paste/drop) – zdjęcie jest „pending” do czasu zapisu.
    - Klik „Zapisz”:
        - walidacja formularza,
        - `POST /recipes`,
        - jeśli jest pending image → `POST /recipes/{id}/image`,
        - nawigacja do `/recipes/:id`.

- **Edycja (`/recipes/:id/edit`)**:
    - Użytkownik może:
        - wkleić obraz (Ctrl+V) po fokusie na strefie zdjęcia,
        - przeciągnąć i upuścić plik na strefę,
        - użyć fallback „Wybierz plik”.
    - Po poprawnym paste/drop:
        - natychmiastowy podgląd,
        - auto-upload (`uploading` → `success`),
        - Snackbar: „Zmieniono zdjęcie” + akcja „Cofnij”.
    - Klik „Usuń zdjęcie”:
        - `DELETE /recipes/{id}/image`,
        - Snackbar: „Usunięto zdjęcie” + „Cofnij”.
    - Klik „Zapisz”:
        - zapis pozostałych pól `PUT /recipes/{id}` (zdjęcie już ustawione wcześniej przez endpointy image).

## 9. Warunki i walidacja

- **Pola formularza**:
    - `name`: required, max 150.
    - `ingredients`, `steps`: min 1 element.
    - `visibility`: required, domyślnie `PRIVATE`.

- **Zdjęcie**:
    - MIME: tylko `image/png`, `image/jpeg`, `image/webp`.
    - Rozmiar: max 10 MB.
    - Walidacja wykonywana:
        - przy wyborze pliku,
        - przy paste,
        - przy drop.
    - Gdy walidacja nie przejdzie:
        - nie rozpoczynać uploadu,
        - pokazać błąd w sekcji zdjęcia (oraz opcjonalnie snackbar).

- **Blokady UI**:
    - w stanie `uploading` blokować „Zapisz” oraz akcje zdjęcia.

## 10. Obsługa błędów

- **Błędy danych formularza**: `markAllAsTouched()` na submit.
- **Błędy API (formularz)**:
    - `GET /recipes/{id}`: 404/403 → komunikat + nawigacja do listy lub 404.
    - `POST/PUT /recipes`: 400 → komunikat (opcjonalnie mapowanie na pola), inne → banner błędu.

- **Błędy uploadu zdjęcia**:
    - 400 (typ/rozmiar) → komunikat walidacyjny.
    - 401 → komunikat „Sesja wygasła” + przekierowanie do logowania (jeśli to standard aplikacji).
    - 404 → komunikat „Przepis nie istnieje lub nie masz dostępu”.
    - 413 → komunikat „Plik zbyt duży (max 10 MB)”.
    - 5xx / sieć → komunikat „Nie udało się przesłać zdjęcia – spróbuj ponownie” + pozostawienie poprzedniego zdjęcia (lub powrót do snapshotu).

## 11. Kroki implementacji

1. **Aktualizacja planu interfejsu zdjęcia**: zaprojektować UI strefy paste/drop z 5 stanami (`idle/dragover/uploading/success/error`) oraz instrukcjami i a11y (`tabindex`, `aria-label`).
2. **Walidacja zdjęcia**: w `RecipeImageUploadComponent` ujednolicić zasady z API (typy + max 10 MB) i dopasować komunikaty.
3. **Obsługa paste**: dodać obsługę `ClipboardEvent` na fokusowanej strefie; odrzucać brak obrazu w schowku.
4. **Obsługa drag&drop**: dodać `dragenter/dragover/dragleave/drop` z `preventDefault` i walidacją obecności pliku.
5. **Serwis API dla obrazów**: dodać w warstwie serwisów metody `uploadRecipeImage` i `deleteRecipeImage` oparte o `fetch` + token sesji.
6. **Auto-upload w edycji**: po paste/drop/file-pick w trybie edycji (`recipeId != null`) wywołać upload endpoint i po sukcesie zaktualizować `currentImageUrl`.
7. **Tryb tworzenia (pending)**: gdy `recipeId == null`, emitować `pendingFileChanged` i trzymać plik do czasu `POST /recipes`.
8. **Undo (Snackbar)**:
    - przed zmianą pobrać poprzedni obraz do `File` (jeśli istnieje),
    - po sukcesie zmiany/usunięcia pokazać snackbar z „Cofnij”,
    - po „Cofnij” przywrócić poprzedni stan przez upload lub delete.
9. **Blokady i spójność**: spiąć `imageUploading` ze stanem strony, aby „Zapisz” był zablokowany podczas uploadu.
10. **Porządek w API dla `image_path`**: dostosować zachowanie `RecipesService.createRecipe/updateRecipe`, aby nie uploadować zdjęć bezpośrednio do Storage i nie wstrzykiwać `image_path` w komendach (po wdrożeniu endpointów image).
11. **Testy manualne (krytyczne ścieżki)**:
    - edycja: drop jpg/png/webp < 10MB → upload + podgląd + snackbar undo,
    - edycja: paste bez obrazu → komunikat,
    - edycja: drop >10MB / zły typ → komunikat,
    - edycja: „Usuń zdjęcie” + undo,
    - tworzenie: dodanie zdjęcia jako pending, zapis przepisu, upload po utworzeniu.
