## Plan implementacji widoku Generowanie zdjęcia przepisu (AI) – modal podglądu

## 1. Przegląd
Celem jest dodanie do formularza edycji przepisu (`/recipes/:id/edit`) akcji generowania realistycznego zdjęcia potrawy przez AI (tylko dla roli `premium`/`admin`) oraz nowego modala (dialogu) z podglądem wygenerowanego obrazu i akcjami **„Zastosuj”** / **„Odrzuć”**.  
Ważne wymagania:

- **Generowanie na podstawie aktualnego stanu formularza** (również niezapisanych zmian).
- **Brak automatycznego nadpisania** istniejącego zdjęcia – wymagana świadoma decyzja w modalu.
- Po „Zastosuj” zdjęcie traktujemy jak standardową zmianę zdjęcia: upload + **Snackbar „Cofnij”** (spójnie z istniejącą obsługą zdjęć).
- Kontrakt stylu (backend): **realistyczne, rustykalny drewniany stół, naturalne światło, brak ludzi/rąk, brak tekstu, brak watermarków**.

## 2. Routing widoku
- **Formularz przepisu (zmiany)**: istniejący `RecipeFormPageComponent` pod ścieżkami:
    - `/recipes/new` (create) – bez AI image (rekomendacja: nie implementować w MVP),
    - `/recipes/:id/edit` (edit) – **tu dodajemy przycisk AI** i modal.
- **Modal (nowy widok 9a)**: **brak osobnej ścieżki routingu** (Angular Material `MatDialog`), otwierany z `RecipeFormPageComponent`.

## 3. Struktura komponentów
Wykorzystujemy istniejący układ formularza i dokładamy modal oraz usługę:

- `RecipeFormPageComponent` (istniejący, modyfikowany)
    - `RecipeImageUploadComponent` (istniejący, modyfikowany – umożliwienie zastosowania pliku z zewnątrz)
    - `AiRecipeImagePreviewDialogComponent` (nowy)
        - UI: loader/error/preview + akcje
- `AiRecipeImageService` (nowy serwis, analogiczny do `AiRecipeDraftService`)

## 4. Szczegóły komponentów

### RecipeFormPageComponent (`src/app/pages/recipes/recipe-form/recipe-form-page.component.*`)
- **Opis komponentu**: strona tworzenia/edycji przepisu. Dodajemy:
    - przycisk ikonowy AI w sekcji „Zdjęcie”,
    - logikę generowania obrazu i otwierania modala,
    - blokadę zapisu podczas generowania (żeby nie mieszać stanów).
- **Główne elementy (HTML/children)**:
    - W `mat-card-header` sekcji „Zdjęcie” dodaj kontener z tytułem + akcje (np. `div.form-section-header`):
        - `mat-card-title` „Zdjęcie”
        - `button mat-icon-button` z ikoną AI (np. `auto_awesome`) po prawej
    - `pych-recipe-image-upload` pozostaje w `mat-card-content`.
    - `MatDialog` do otwierania `AiRecipeImagePreviewDialogComponent`.
- **Obsługiwane interakcje**:
    - klik „AI” → otwarcie modala + start generowania,
    - „Odrzuć” w modalu → zamknięcie bez zmian,
    - „Zastosuj” w modalu → konwersja base64 → `File` → zastosowanie w `RecipeImageUploadComponent` (upload + undo).
- **Obsługiwana walidacja**:
    - **Gating roli**:
        - UI: przycisk AI widoczny/aktywny tylko jeśli `authService.appRole()` jest `premium` lub `admin`.
        - Fail-safe: jeśli backend zwróci `403`, pokaż czytelny komunikat (Snackbar) i nie zmieniaj zdjęcia.
    - **Preconditions**:
        - AI image dostępne tylko w trybie edycji: `recipeId() !== null`.
        - Podczas `saving()` lub `imageUploading()` blokujemy generowanie (disabled).
    - **Minimalna jakość danych do requestu**:
        - jeśli `name` jest puste albo `ingredients/steps` są puste → nie wywołuj AI; pokaż komunikat (np. „Uzupełnij nazwę i przynajmniej 1 składnik oraz 1 krok”).
    - **Zgodność payload**:
        - `output_format` = dokładnie `'pycha_recipe_image_v1'`
        - `output.width/height` = `1024`
        - `output.mime_type` = rekomendacja: `'image/png'` (zgodnie z `ENV_SETUP.md` i backendem).
- **Typy (DTO/ViewModel)**:
    - DTO (istniejące): `AiRecipeImageRequestDto`, `AiRecipeImageResponseDto`, `AiRecipeImageUnprocessableEntityDto` (z `shared/contracts/types.ts`)
    - Nowe VM (frontend):
        - `AiImageGenerationUiState` (status + error + reasons)
        - `AiRecipeImageDialogData` / `AiRecipeImageDialogResult`
- **Props**: komponent routowany (brak props z rodzica).

### RecipeImageUploadComponent (`src/app/pages/recipes/recipe-form/components/recipe-image-upload/recipe-image-upload.component.*`)
- **Opis komponentu**: strefa paste/drop + auto-upload w edycji + snackbar „Cofnij”. Rozszerzamy, aby parent mógł „wstrzyknąć” gotowy plik (np. z AI) i skorzystać z tych samych ścieżek walidacji/uploadu/undo.
- **Zmiana API komponentu (propozycja)**:
    - dodać publiczną metodę:
        - `public applyExternalFile(file: File): void`  
          która wywołuje istniejącą logikę `processFile(file)` (bez dublowania walidacji).
    - alternatywa (jeśli zespół woli Input zamiast ViewChild):
        - `readonly externalFile = input<File | null>(null)` + `effect()` konsumujący zmianę i uruchamiający `processFile`.
- **Główne elementy**: bez zmian w UI; opcjonalnie później można dodać wizualne oznaczenie „AI”.
- **Obsługiwane interakcje**: bez zmian (paste/drop/file picker/remove).
- **Walidacja**:
    - pozostaje: typy `image/jpeg|image/png|image/webp`, rozmiar `<= 10 MB`.
    - nowy kanał (`applyExternalFile`) musi stosować tę samą walidację.
- **Typy**:
    - bez zmian (emituje `RecipeImageEvent` do parenta).
- **Props**:
    - bez zmian: `recipeId`, `currentImageUrl`, `disabled`, `(imageEvent)`.

### AiRecipeImagePreviewDialogComponent (nowy, `src/app/pages/recipes/recipe-form/components/ai-recipe-image-preview-dialog/...`)
- **Opis komponentu**: modal z trzema stanami:
    - `loading` (generowanie w toku),
    - `error` (błąd + opcja zamknięcia / ewentualnie „Spróbuj ponownie”),
    - `success` (podgląd obrazu + „Zastosuj” / „Odrzuć”).
- **Główne elementy**:
    - `h2 mat-dialog-title`: np. „Podgląd zdjęcia (AI)”
    - `mat-dialog-content`:
        - loader (`mat-spinner`) + tekst „Generujemy zdjęcie…”
        - albo komunikat błędu (zwięzły, user-friendly)
        - albo `<img [src]="imageDataUrl">` + krótkie info o stylu
    - `mat-dialog-actions`:
        - `button mat-stroked-button` „Odrzuć”
        - `button mat-flat-button color="primary"` „Zastosuj”
        - disabled gdy `loading` albo `applying`
- **Obsługiwane interakcje**:
    - `onReject()` → `dialogRef.close({ action: 'rejected' })`
    - `onApply()` → `dialogRef.close({ action: 'applied' })` (sam upload wykonuje parent, żeby zachować spójny flow i kontrolę)
- **Walidacja**:
    - brak walidacji formularzowej; tylko blokowanie akcji w stanie `loading/applying`.
- **Typy**:
    - `AiRecipeImageDialogData`:
        - `recipeName: string`
        - `state: 'loading' | 'error' | 'success'`
        - `imageDataUrl?: string` (np. `data:image/png;base64,...`)
        - `errorMessage?: string`
        - `errorReasons?: string[]` (dla 422)
    - `AiRecipeImageDialogResult`:
        - `action: 'applied' | 'rejected' | 'cancelled'`
- **Props**: dane wejściowe przez `MAT_DIALOG_DATA`.

## 5. Typy

### DTO (istniejące, `shared/contracts/types.ts`)
- `AiRecipeImageRequestDto`
    - `recipe`: `AiRecipeImageRecipeDto` (m.in. `id`, `name`, `ingredients`, `steps`, `servings`, `is_termorobot`, `category_name`, `tags`)
    - `output`: `{ mime_type: 'image/webp' | 'image/png', width: 1024, height: 1024 }`
    - `output_format`: `'pycha_recipe_image_v1'`
- `AiRecipeImageResponseDto`
    - `image.mime_type`, `image.data_base64`
    - `meta.style_contract`, `meta.warnings`
- `AiRecipeImageUnprocessableEntityDto` (422)
    - `message`, `reasons`

### Nowe typy ViewModel (propozycja, w `src/app/pages/recipes/recipe-form/models/...` albo lokalnie w komponentach)
- `AiImageGenerationUiState`:
    - `status: 'idle' | 'loading' | 'success' | 'error'`
    - `image?: { mimeType: string; dataBase64: string; dataUrl: string }`
    - `errorMessage?: string`
    - `errorReasons?: string[]`
- `AiRecipeImageDialogData` / `AiRecipeImageDialogResult` (opisane wyżej)

## 6. Zarządzanie stanem
Rekomendacja: trzymamy stan generowania w `RecipeFormPageComponent` na **signals** (spójnie z resztą formularza).

- `readonly aiImageState = signal<AiImageGenerationUiState>({ status: 'idle' })`
- `readonly aiGenerating = computed(() => aiImageState().status === 'loading')`
- Aktualizacja `isSaveDisabled`:
    - dodać `aiGenerating()` jako warunek blokujący przycisk „Zapisz” (opcjonalnie także przycisk „Anuluj”).

W `AiRecipeImagePreviewDialogComponent` stan jest lokalny (również signals), ale źródłem prawdy jest parent:
- parent otwiera dialog w stanie `loading`,
- po odpowiedzi aktualizuje dialog (przez `dialogRef.componentInstance` lub przez zamknięcie i ponowne otwarcie — preferowane: aktualizacja instancji).

## 7. Integracja API

### Endpoint
- Edge Function: `POST /functions/v1/ai/recipes/image` (wewnętrzny routing: `/ai` + `/recipes/image`).
- Autoryzacja: `Authorization: Bearer <access_token>` (wymagana).
- Premium gating po stronie API: `403` dla `app_role = user`.

### Serwis frontend: AiRecipeImageService (nowy)
Lokalizacja: `src/app/pages/recipes/services/ai-recipe-image.service.ts` (analogicznie do `AiRecipeDraftService`).

- **Metoda**: `async generateImage(request: AiRecipeImageRequestDto): Promise<AiRecipeImageResponseDto>`
- **Pobranie tokena**: `supabase.auth.getSession()`, błąd jeśli brak sesji.
- **Wywołanie**: `fetch(`${environment.supabase.url}/functions/v1/ai/recipes/image`, { method: 'POST', headers, body })`
- **Obsługa błędów**:
    - `401/403`: komunikat o braku uprawnień / ponownym logowaniu (dla 403 dodatkowo „Funkcja Premium”)
    - `422`: parsuj `AiRecipeImageUnprocessableEntityDto` i zwróć błąd domenowy (np. `AiImageValidationError`)
    - `429`: błąd limitu (np. `AiImageRateLimitError`)
    - `>=500` / network: komunikat ogólny
    - rekomendacja: timeout (np. 60s) przez `AbortController`

### Mapowanie danych z formularza do requestu
W `RecipeFormPageComponent` dodaj funkcję budującą `AiRecipeImageRequestDto` z aktualnego `form.getRawValue()`:

- `recipe.id` = `recipeId()!`
- `recipe.name` = `formValue.name`
- `recipe.description` = `formValue.description || null`
- `recipe.servings` = `formValue.servings ?? null` (tylko integer 1–99; już walidowane w formie)
- `recipe.is_termorobot` = `formValue.isTermorobot`
- `recipe.category_name` = na podstawie `categoryId` i `categories()` (mapowanie do `CategoryDto.name`)
- `recipe.tags` = `formValue.tags`
- `recipe.ingredients` / `recipe.steps`:
    - z `formValue.ingredients`/`steps` (tablica linii):
        - jeśli linia zaczyna się od `#` → `{ type: 'header', content: <trimmed without leading #'s> }`
        - wpp → `{ type: 'item', content: <trimmed line> }`
- `output`:
    - `mime_type: 'image/png'`
    - `width: 1024`
    - `height: 1024`
- `output_format: 'pycha_recipe_image_v1'`

### Zastosowanie odpowiedzi (base64 → upload)
Po `AiRecipeImageResponseDto`:

1. Zbuduj `dataUrl` dla `<img>`:
    - `data:${mime_type};base64,${data_base64}`
2. Po „Zastosuj” skonwertuj base64 do `Blob` i utwórz `File` (np. `ai-recipe.png`).
3. Przekaż `File` do `RecipeImageUploadComponent.applyExternalFile(file)`:
    - komponent wykona walidację + auto-upload + snackbar „Cofnij”.

## 8. Interakcje użytkownika

### 8.1. Kliknięcie przycisku AI (edit, premium/admin)
- **Wejście**: user klika ikonę AI w sekcji „Zdjęcie”.
- **Oczekiwane zachowanie**:
    - otwarcie modala „Podgląd zdjęcia (AI)” w stanie `loading`,
    - zablokowane przyciski w modalu do czasu wyniku,
    - wyświetlenie podglądu po sukcesie.

### 8.2. Odrzuć
- **Wejście**: user klika „Odrzuć”.
- **Wynik**: modal zamyka się, zdjęcie przepisu bez zmian.

### 8.3. Zastosuj
- **Wejście**: user klika „Zastosuj”.
- **Wynik**:
    - modal zamyka się,
    - rozpoczyna się upload wygenerowanego pliku (przez `RecipeImageUploadComponent`),
    - po sukcesie: aktualizacja podglądu zdjęcia,
    - Snackbar: „Zmieniono zdjęcie” + akcja „Cofnij” (już istnieje w komponencie uploadu).

## 9. Warunki i walidacja
- **Warunki dostępu (UI)**:
    - widoczność przycisku AI: `authService.appRole()` ∈ {`premium`, `admin`}
    - dostępność przycisku AI: `recipeId() !== null` (tryb edycji), `!saving()`, `!imageUploading()`, `!aiGenerating()`
- **Walidacja formularza dla AI** (przed wywołaniem):
    - `name` niepuste (w formie i tak `required`)
    - `ingredients.length >= 1`, `steps.length >= 1` (w formie i tak `minArrayLength`)
    - jeśli formularz invalid → pokaż błąd i nie wywołuj endpointu
- **Walidacja pliku wynikowego**:
    - backend zwykle zwróci PNG (base64); po konwersji do `File` walidacja w `RecipeImageUploadComponent` musi przejść (typ/rozmiar).
    - jeśli wynik przekracza limity lub ma nieobsługiwany typ → pokaż błąd (Snackbar + komunikat przy polu zdjęcia).

## 10. Obsługa błędów
- **401**: Snackbar „Brak sesji. Zaloguj się ponownie.” + opcjonalnie przekierowanie do `/login`.
- **403**:
    - UI normalnie ukrywa przycisk, ale jeśli błąd wystąpi (np. rola w JWT nieaktualna) → Snackbar „Funkcja Premium”.
- **422** (nie da się wygenerować sensownego obrazu):
    - pokaż w modalu krótką informację + (opcjonalnie) listę `reasons`,
    - CTA: „Zamknij” (i ewentualnie „Spróbuj ponownie” po poprawkach w formularzu).
- **429**: Snackbar „Osiągnięto limit. Spróbuj ponownie za chwilę.”
- **Timeout / network**: modal pokazuje błąd „Nie udało się wygenerować zdjęcia. Spróbuj ponownie.”
- **Błąd uploadu po Zastosuj**:
    - istniejąca obsługa w `RecipeImageUploadComponent` (komunikat przy polu zdjęcia + brak zmiany).

## 11. Kroki implementacji
1. **Dodaj serwis** `AiRecipeImageService` w `src/app/pages/recipes/services/` (wzorzec z `AiRecipeDraftService`): `fetch` do `/functions/v1/ai/recipes/image`, mapowanie statusów błędów na wyjątki.
2. **Dodaj dialog** `AiRecipeImagePreviewDialogComponent` (standalone) w `src/app/pages/recipes/recipe-form/components/ai-recipe-image-preview-dialog/` + template + SCSS:
    - stany `loading/error/success`,
    - przyciski „Zastosuj”/„Odrzuć”.
3. **Rozszerz** `RecipeImageUploadComponent` o możliwość zastosowania pliku z zewnątrz (metoda publiczna lub Input + effect).
4. **Zmień** `RecipeFormPageComponent`:
    - dodaj przycisk AI w sekcji „Zdjęcie” (HTML + SCSS),
    - wstrzyknij `AuthService`, `MatDialog`, `AiRecipeImageService`,
    - dodaj helper do mapowania form → `AiRecipeImageRequestDto`,
    - dodaj logikę: open dialog → generate → update dialog → apply → przekazanie pliku do `RecipeImageUploadComponent`.
5. **Dodaj blokady UI**:
    - `aiGenerating` wpływa na `isSaveDisabled`,
    - `disabled`/`aria-label`/keyboard dla przycisku AI.
6. **Manual test** (lokalnie):
    - konto `premium/admin`: generowanie → podgląd → zastosuj → upload → cofnij,
    - konto `user`: brak przycisku AI (i obsługa 403 jako fail-safe),
    - edge case: puste dane → brak wywołania, komunikat,
    - błędy 422/429 (symulacja) → czytelny komunikat.

