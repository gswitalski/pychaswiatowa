# Plan implementacji widoku: Formularz przepisu – generowanie zdjęcia AI z referencją (auto)

## 1. Przegląd
Celem zmiany jest rozszerzenie istniejącego widoku edycji przepisu o **automatyczny wybór trybu generowania zdjęcia AI**:
- **Tryb 1 (bez zdjęcia / recipe-only)**: jeśli w formularzu nie ma dostępnego zdjęcia.
- **Tryb 2 (z referencją / with-reference)**: jeśli w formularzu jest dostępne zdjęcie (zapisane w przepisie lub ustawione w trakcie edycji).

Wymagania UX:
- Przycisk AI w sekcji zdjęcia pokazuje tooltip zależny od trybu: **„Generuj z przepisu”** / **„Generuj z referencją zdjęcia”**.
- Modal podglądu wygenerowanego zdjęcia pokazuje notatkę o trybie/stylu zależną od faktycznie użytego trybu (`meta.mode` z API).
- Funkcja jest dostępna tylko dla roli `premium` / `admin` (RBAC).

Zakres dotyczy istniejących plików:
- `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`
- `src/app/pages/recipes/recipe-form/recipe-form-page.component.html`
- `src/app/pages/recipes/recipe-form/components/ai-recipe-image-preview-dialog/ai-recipe-image-preview-dialog.component.{ts,html}`
- (opcjonalnie dla poprawnej identyfikacji referencji) `src/app/pages/recipes/recipe-form/components/recipe-image-upload/recipe-image-upload.component.ts`

## 2. Routing widoku
- **Widok edycji przepisu**: `/recipes/:id/edit` (istniejący; zmiana zachowania przycisku AI w sekcji zdjęcia).
- **Modal (MatDialog)**: `AiRecipeImagePreviewDialogComponent` otwierany z poziomu `RecipeFormPageComponent` (brak osobnej ścieżki routingu).

## 3. Struktura komponentów
Główna hierarchia (upraszczając do elementów istotnych dla AI):

- `RecipeFormPageComponent` (`pych-recipe-form-page`)
  - `PageHeaderComponent` (akcje: Anuluj / Zapisz)
  - Sekcja „Zdjęcie” (`mat-card`)
    - Przycisk AI (`mat-icon-button` + `matTooltip`)
    - `RecipeImageUploadComponent` (`pych-recipe-image-upload`)
  - `AiRecipeImagePreviewDialogComponent` (`pych-ai-recipe-image-preview-dialog`) – dialog

Wysokopoziomowe drzewo:

```
RecipeFormPageComponent
├─ PageHeaderComponent
├─ MatCard: Podstawowe informacje (RecipeBasicInfoFormComponent)
├─ MatCard: Zdjęcie
│  ├─ AI button (tooltip zależny od trybu)
│  └─ RecipeImageUploadComponent
├─ MatCard: Kategoria, tagi i widoczność (RecipeCategorizationFormComponent)
├─ MatCard: Składniki (EditableListComponent)
├─ MatCard: Kroki (EditableListComponent)
└─ MatCard: Wskazówki (EditableListComponent)

MatDialog(AiRecipeImagePreviewDialogComponent)
├─ loading | error | success
└─ Notatka trybu/stylu zależna od meta.mode
```

## 4. Szczegóły komponentów

### `RecipeFormPageComponent`
- **Opis komponentu**: Strona formularza przepisu (create/edit). W kontekście tej zmiany odpowiada za:
  - gating premium/admin (pokazanie i aktywność przycisku AI),
  - wyliczenie **czy w formularzu jest zdjęcie** (do tooltipu i do requestu),
  - zbudowanie `AiRecipeImageRequestDto` z aktualnego stanu formularza,
  - przekazanie do dialogu informacji o `meta.mode` w celu wyświetlenia notatki,
  - zastosowanie wygenerowanego obrazu do `RecipeImageUploadComponent` po akcji „Zastosuj”.

- **Główne elementy HTML**:
  - Sekcja „Zdjęcie” w `recipe-form-page.component.html` zawierająca:
    - `button mat-icon-button` z ikoną `auto_awesome`,
    - `[matTooltip]` dynamiczny,
    - `pych-recipe-image-upload` (obsługa upload/paste/drop).

- **Obsługiwane interakcje**:
  - Kliknięcie przycisku AI:
    - otwiera dialog w stanie loading,
    - wywołuje `AiRecipeImageService.generateImage(...)`,
    - aktualizuje dialog do stanu success/error,
    - reaguje na wynik dialogu: `applied` → ustawia plik w `RecipeImageUploadComponent`, `regenerate` → ponawia generację.

- **Obsługiwana walidacja**:
  - **Precondition (UI)**:
    - `recipeId` musi istnieć (AI tylko dla edycji; w kodzie: `if (!this.recipeId()) return`),
    - musi być spełnione minimum danych: `name` niepuste, `ingredients.length >= 1`, `steps.length >= 1` (obecnie `validateFormForAiImage()`).
  - **Premium gating**:
    - przycisk AI widoczny tylko dla `app_role in ('premium','admin')`,
    - dodatkowo obsłużyć `403` z API jako błąd „Funkcja Premium”.

- **Typy (DTO i ViewModel)**:
  - DTO:
    - `AiRecipeImageRequestDto`, `AiRecipeImageResponseDto` (z `shared/contracts/types.ts`)
    - `AiRecipeImageReferenceImageDto`
    - `AiRecipeImageMetaDto` (ważne: `meta.mode`)
  - ViewModel (frontend-only, do wdrożenia w komponencie):
    - `hasAiReferenceImage: boolean` (computed) – czy zdjęcie jest dostępne w formularzu
    - `aiImageTooltip: string` (computed) – `Generuj z przepisu` / `Generuj z referencją zdjęcia`
    - `currentImagePath: string | null` (signal) – **ścieżka storage** do zdjęcia (do `reference_image.source='storage_path'`)
    - (opcjonalnie) `currentImageDisplayUrl: string | null` (signal) – pełny URL, jeśli API zwraca `image_url` dla prywatnych bucketów

- **Propsy**: brak (komponent routowany).

### `RecipeImageUploadComponent`
- **Opis komponentu**: Upload zdjęcia przepisu (paste/drop/file picker), auto-upload w trybie edycji, „Undo” poprzez Snackbar.

- **Rola w tej zmianie**:
  - źródło prawdy o tym, czy zdjęcie istnieje w UI (`hasImage`) oraz emitowanie eventów:
    - `uploaded` (zawiera `imagePath`),
    - `deleted`,
    - `uploadingChanged`.
  - W planie zakładamy, że **AI generacja jest blokowana podczas uploadu**, więc dla trybu referencyjnego bazujemy na:
    - istniejącym `recipe.image_path` pobranym z API (edit mode),
    - albo `uploaded.imagePath` po zakończonym uploadzie w trakcie edycji.

- **Obsługiwane zdarzenia**:
  - `imageEvent`:
    - `uploaded` → w rodzicu ustawić `currentImagePath = imagePath`,
    - `deleted` → `currentImagePath = null`,
    - `uploadingChanged` → blokowanie AI / zapisu.

- **Walidacja**:
  - typy plików: `image/jpeg|png|webp`
  - rozmiar max: 10 MB

- **Typy**:
  - `RecipeImageEvent`, `UploadRecipeImageResponseDto`

- **Propsy**:
  - `recipeId: number | null`
  - `currentImageUrl: string | null` (warto przekazywać `currentImageDisplayUrl ?? currentImagePath`)
  - `disabled: boolean`

### `AiRecipeImagePreviewDialogComponent`
- **Opis komponentu**: Dialog do podglądu zdjęcia wygenerowanego przez AI. Ma 3 stany: `loading`, `error`, `success`.

- **Wymagane zmiany względem obecnego stanu**:
  - Dodać możliwość przekazania i przechowywania **trybu generacji** (z odpowiedzi API):
    - np. `generationMode: 'recipe_only' | 'with_reference' | null`
  - Zmienić notatkę w stanie `success` z tekstu stałego na **warunkową**:
    - dla `recipe_only`: notatka o generowaniu „z przepisu” + styl rustykalny,
    - dla `with_reference`: notatka o generowaniu „z referencją zdjęcia” + informacja „nowe ujęcie (nie kopiujemy referencji)” + styl eleganckiej kuchni/jadalni.

- **Główne elementy HTML**:
  - `<img [src]="imageDataUrl()">`
  - Notatka (np. `<p class="style-info">`) z ikoną `info`.

- **Obsługiwane interakcje**:
  - `Odrzuć` → zamknięcie z `{action:'rejected'}`
  - `Zastosuj` → `{action:'applied'}`
  - `Wygeneruj ponownie` → `{action:'regenerate'}`
  - `Zamknij` w stanie błędu → `{action:'cancelled'}`

- **Walidacja**: brak (wyświetla dane).

- **Typy**:
  - `AiRecipeImageDialogData`, `AiRecipeImageDialogResult`, `AiImageDialogState`
  - Nowy (frontend-only): `AiRecipeImageResolvedMode = 'recipe_only' | 'with_reference'` (może bazować bezpośrednio na `AiRecipeImageResponseDto['meta']['mode']`).

## 5. Typy
Wykorzystujemy istniejące kontrakty z `shared/contracts/types.ts` (już zawierają pola potrzebne do trybu referencji):
- `AiRecipeImageMode`: `'auto' | 'recipe_only' | 'with_reference'`
- `AiRecipeImageReferenceImageDto`:
  - `{ source: 'storage_path'; image_path: string }`
  - `{ source: 'base64'; mime_type: 'image/png'|'image/jpeg'|'image/webp'; data_base64: string }`
- `AiRecipeImageRequestDto`:
  - `mode?: AiRecipeImageMode`
  - `reference_image?: AiRecipeImageReferenceImageDto`
- `AiRecipeImageResponseDto`:
  - `meta.mode: 'recipe_only' | 'with_reference'`

Nowe typy ViewModel (frontend-only, do wprowadzenia w `RecipeFormPageComponent` i dialogu):
- `AiRecipeImageUiMode`:
  - `triggerTooltip: 'Generuj z przepisu' | 'Generuj z referencją zdjęcia'`
  - `hasReferenceImage: boolean`
- `RecipeImageReferenceState`:
  - `imagePath: string | null` (storage path)
  - `imageDisplayUrl: string | null` (opcjonalnie)

## 6. Zarządzanie stanem
Wykorzystać Angular Signals (zgodnie z zasadami projektu) i unikać rozbudowy RxJS w UI:
- **Istniejące sygnały**:
  - `recipeId`, `aiGenerating`, `imageUploading`, `currentImageUrl`
- **Planowane rozszerzenia**:
  - `currentImagePath = signal<string | null>(null)` – trzyma storage path do zdjęcia
  - (opcjonalnie) `currentImageDisplayUrl = signal<string | null>(null)` – trzyma URL, jeśli potrzebny do renderowania
  - `hasAiReferenceImage = computed(() => !!currentImagePath())`
  - `aiImageTooltip = computed(() => recipeId() ? (hasAiReferenceImage() ? 'Generuj z referencją zdjęcia' : 'Generuj z przepisu') : 'Zapisz przepis, aby wygenerować zdjęcie AI')`

Reguły stanu:
- AI button:
  - widoczny tylko dla premium/admin,
  - disabled, gdy: brak `recipeId`, trwa zapis (`saving`), trwa upload (`imageUploading`), trwa generacja (`aiGenerating`).
- Referencja:
  - `currentImagePath` ustawiane:
    - w `populateForm(recipe)` na podstawie `recipe.image_path`,
    - w `onImageEvent({type:'uploaded'})` na podstawie `event.imagePath`,
    - czyszczone w `onImageEvent({type:'deleted'})`.

## 7. Integracja API
Backend: `POST /ai/recipes/image` (Supabase Edge Function), tryb `auto` i `reference_image` zgodnie z kontraktem.

Frontend:
- Serwis: `AiRecipeImageService.generateImage(request: AiRecipeImageRequestDto): Promise<AiRecipeImageResponseDto>` (istniejący).
- Budowa requestu w `RecipeFormPageComponent.buildAiImageRequest()`:
  - zawsze ustaw `mode: 'auto'` (czytelne i zgodne z US-046),
  - jeśli `currentImagePath` istnieje:
    - dołącz `reference_image: { source: 'storage_path', image_path: currentImagePath }`
  - w przeciwnym razie nie wysyłaj `reference_image` (API wybierze `recipe_only`).
  - (rekomendowane uzupełnienie): przekazać do `recipe` również `prep_time_minutes` i `total_time_minutes`, bo typ `AiRecipeImageRecipeDto` to wspiera.

Obsługa odpowiedzi:
- Po otrzymaniu `AiRecipeImageResponseDto`:
  - obraz: `data:${mime};base64,${data_base64}`
  - tryb: `response.meta.mode` przekazać do dialogu (np. `dialogRef.componentInstance.setSuccess(dataUrl, response.meta.mode)`).

## 8. Interakcje użytkownika
- **Tooltip trybu**:
  - użytkownik najeżdża na ikonę AI w sekcji zdjęcia:
    - bez zdjęcia → widzi **„Generuj z przepisu”**
    - ze zdjęciem → widzi **„Generuj z referencją zdjęcia”**
- **Generowanie**:
  - klik w ikonę AI → otwiera modal w stanie loading.
  - po sukcesie → widzi podgląd + notatkę o trybie + akcje `Zastosuj`, `Odrzuć`, `Wygeneruj ponownie`.
  - `Zastosuj` → zdjęcie trafia do formularza i jest uploadowane jak standardowe zdjęcie (w `RecipeImageUploadComponent`), wraz z istniejącym Snackbar „Cofnij”.
  - `Wygeneruj ponownie` → ponowna generacja (może już działać w innym trybie, jeśli użytkownik w międzyczasie usunął/zmienił zdjęcie w formularzu).
- **Błąd**:
  - w modalu widoczny komunikat + (dla 422) lista powodów.
  - akcje: `Wygeneruj ponownie` lub `Zamknij`.

## 9. Warunki i walidacja
Warunki UI i ich wpływ:
- **Uprawnienia (premium/admin)**:
  - `isAiImageButtonVisible()` opiera się o `AuthService.appRole()`.
- **Warunek trybu referencji**:
  - `hasAiReferenceImage = currentImagePath != null`
  - Tooltip i request zależne od `hasAiReferenceImage`.
- **Warunki minimalne do wywołania AI**:
  - `name` niepuste,
  - `ingredients.length >= 1`,
  - `steps.length >= 1`.
- **Blokady**:
  - podczas uploadu zdjęcia (`imageUploading=true`) nie da się uruchomić AI,
  - podczas generacji AI (`aiGenerating=true`) blokujemy interakcje z uploadem zdjęcia i zapis.

## 10. Obsługa błędów
Scenariusze i reakcje UI:
- **403 Forbidden (premium required)**:
  - `AiImagePremiumRequiredError` → dialog pokazuje czytelny komunikat (bez szczegółów technicznych).
- **422 Unprocessable Entity**:
  - `AiImageValidationError` → dialog pokazuje `message` + listę `reasons`.
- **429 Too Many Requests**:
  - `AiImageRateLimitError` → dialog pokazuje komunikat o limicie i możliwość ponowienia później.
- **Błędy sieci / 5xx**:
  - dialog pokazuje ogólny komunikat + opcję „Wygeneruj ponownie”.

## 11. Kroki implementacji
1. **Ustalenie „źródła referencji” w stanie strony**:
   - w `RecipeFormPageComponent` dodać `currentImagePath` (storage path).
   - w `populateForm(recipe)` ustawić `currentImagePath = recipe.image_path ?? null`.
   - w `onImageEvent`:
     - `uploaded` → `currentImagePath = event.imagePath`
     - `deleted` → `currentImagePath = null`
2. **Tooltip trybu**:
   - w `RecipeFormPageComponent` dodać `hasAiReferenceImage` + `aiImageTooltip` jako `computed`.
   - w `recipe-form-page.component.html` podmienić `[matTooltip]` na `aiImageTooltip()`.
3. **Request do `POST /ai/recipes/image`**:
   - w `buildAiImageRequest()`:
     - zawsze dodać `mode: 'auto'`,
     - jeśli `hasAiReferenceImage` → dodać `reference_image: { source: 'storage_path', image_path: currentImagePath }`.
4. **Modal: notatka zależna od `meta.mode`**:
   - w `AiRecipeImagePreviewDialogComponent` dodać sygnał na resolved mode (np. `resolvedMode = signal<'recipe_only'|'with_reference'|null>(null)`).
   - zmienić API komponentu:
     - `setSuccess(imageDataUrl: string, mode: 'recipe_only' | 'with_reference'): void`
   - w template dialogu ustawić warunkowy tekst notatki:
     - `recipe_only` → „Generowanie z przepisu — realistyczne zdjęcie w stylu rustykalnym”
     - `with_reference` → „Generowanie z referencją zdjęcia — nowe ujęcie (nie kopiujemy referencji)”
5. **Przekazanie `meta.mode` do dialogu**:
   - w `RecipeFormPageComponent.onGenerateAiImage()` po sukcesie:
     - zamiast `setSuccess(dataUrl)` wywołać `setSuccess(dataUrl, response.meta.mode)`.
6. **Regresje i zgodność**:
   - upewnić się, że:
     - create mode nadal pokazuje tooltip „Zapisz przepis, aby wygenerować zdjęcie AI” i AI jest disabled,
     - zachowanie w przypadku braku zdjęcia nie zmienia się poza nowym tooltipem i `mode: 'auto'`,
     - nie ma bezpośrednich wywołań `supabase.from(...)` w frontendzie (tylko Edge Function przez serwis).

