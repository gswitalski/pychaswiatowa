# Plan implementacji widoku: Formularz Przepisu (Dodaj/Edytuj) + Modal podglądu zdjęcia AI (upgrade gpt-image-1.5)

## 1. Przegląd
Celem zmiany jest doprecyzowanie (i odzwierciedlenie w UI) technicznych parametrów generowania zdjęcia AI w formularzu edycji przepisu oraz rozszerzenie modalu podglądu o akcję **„Wygeneruj ponownie”**.

- **Zakres UX bez zmian**: generowanie działa tylko w edycji, nie nadpisuje zdjęcia automatycznie, wymaga akcji „Zastosuj”.
- **Zmiana techniczna** (MVP): generowanie używa modelu **`gpt-image-1.5`** po stronie backendu, a wynik jest zwracany jako **`image/webp` 1024×1024**, `background=auto`, `quality=auto`, `n=1`.
- **Zmiana w modalu**: „Wygeneruj ponownie” oznacza kolejną próbę (ponowne wywołanie endpointu), nadal `n=1`.

## 2. Routing widoku
Widok już istnieje – bez zmian w routingu.

- **Tworzenie**: `/recipes/new`
- **Edycja**: `/recipes/:id/edit`
- **Modal**: `MatDialog` otwierany z poziomu formularza edycji.

## 3. Struktura komponentów
Wysokopoziomowa hierarchia (istniejąca, z doprecyzowaniem odpowiedzialności):

```
RecipeFormPageComponent (standalone)
├─ PageHeaderComponent
├─ MatCard: RecipeBasicInfoFormComponent
├─ MatCard: sekcja Zdjęcie
│  ├─ (Button) Akcja AI (auto_awesome) [premium/admin, tylko edit]
│  └─ RecipeImageUploadComponent
├─ MatCard: RecipeCategorizationFormComponent
├─ MatCard: EditableListComponent (ingredients)
└─ MatCard: EditableListComponent (steps)

AiRecipeImagePreviewDialogComponent (standalone, MatDialog)
├─ state: loading | error | success
├─ podgląd obrazu (img)
└─ akcje: Odrzuć / Zastosuj / (Wygeneruj ponownie) / Zamknij
```

## 4. Szczegóły komponentów

### RecipeFormPageComponent (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts|.html|.scss`)
- **Opis komponentu**:
    - Formularz tworzenia/edycji przepisu (Reactive Forms).
    - W trybie edycji wyświetla akcję generowania zdjęcia AI (premium/admin).
    - Koordynuje otwieranie modalu, wywołanie generowania oraz „aplikację” wygenerowanego pliku przez `RecipeImageUploadComponent.applyExternalFile()`.

- **Główne elementy HTML i dzieci**:
    - `pych-page-header` z akcjami Anuluj/Zapisz.
    - Sekcja „Zdjęcie” w `mat-card`:
        - `button mat-icon-button` (AI) z tooltipem i spinnerem podczas generowania.
        - `pych-recipe-image-upload` jako strefa paste/drop/upload.
    - Sekcje `pych-editable-list` dla składników i kroków.

- **Obsługiwane zdarzenia**:
    - **Formularz**: `onSubmit()`, `onCancel()`.
    - **Zdjęcie**: `onImageEvent($event)` (upload/delete/undo/uploading state).
    - **AI**:
        - `onGenerateAiImage()` – otwarcie dialogu, wywołanie endpointu, wypełnienie dialogu wynikiem lub błędem.
        - Obsługa akcji dialogu: `applied`, `rejected`, `cancelled`, **`regenerate`** (nowe).

- **Obsługiwana walidacja (szczegółowa)**:
    - **Walidacja formularza (API/PRD)**:
        - `name`: required, max 150.
        - `servings`: opcjonalne, `1–99`, liczba całkowita.
        - `ingredients`: min 1 pozycja.
        - `steps`: min 1 pozycja.
    - **Precondition do AI image generation (UI)**:
        - tryb edycji: `recipeId != null`.
        - minimum danych: `name` niepuste, `ingredients.length >= 1`, `steps.length >= 1`.
        - blokada akcji, gdy: trwa zapis, upload, lub generowanie AI.
    - **Kontrakt outputu AI (MVP, wymagane w request)**:
        - `output.mime_type`: **`image/webp`**
        - `output.width`: `1024`
        - `output.height`: `1024`
        - `output_format`: `'pycha_recipe_image_v1'`

- **Typy (DTO i ViewModel)**:
    - DTO:
        - `AiRecipeImageRequestDto`, `AiRecipeImageResponseDto`, `AiRecipeImageUnprocessableEntityDto`
        - `AiRecipeImageContentItem`
        - `RecipeDetailDto`, `CreateRecipeCommand`, `UpdateRecipeCommand`, `RecipeVisibility`
    - ViewModel:
        - `RecipeFormViewModel` (istniejący).
        - (Nowe) ujednolicenie typu wyniku dialogu: `AiRecipeImageDialogResult` rozszerzone o akcję `regenerate`.

- **Propsy**:
    - Brak propsów – komponent routowany.

#### Notatki implementacyjne do zmiany w tym widoku (konkret)
- **Ustawić poprawne output w AI request**:
    - Zmienić `output.mime_type` na **`image/webp`**.
    - Utrzymać `width/height` literalnie `1024`.
    - Utrzymać `output_format: 'pycha_recipe_image_v1'`.
- **Urealnić konwersję base64 → File**:
    - Ponieważ MVP zwraca `image/webp`, nazwa pliku powinna mieć rozszerzenie `.webp` (nie `png`).
    - Typ MIME w `File` zgodny z `response.image.mime_type`.
- **Obsłużyć „Wygeneruj ponownie”**:
    - Dodać obsługę pętli (kolejna próba) w `onGenerateAiImage()`:
        - po `success` lub `error` użytkownik może wybrać „Wygeneruj ponownie”,
        - akcja powoduje ponowne wywołanie `AiRecipeImageService.generateImage()` z nowym requestem (zbudowanym ponownie z aktualnego stanu formularza),
        - nadal `n=1` (po stronie backendu), frontend nie wysyła `n`.
    - Rekomendacja: utrzymać **jeden otwarty dialog** i przełączać jego stan na `loading` przy re-generacji (wymaga dodania metody `setLoading()` w dialogu).

### AiRecipeImagePreviewDialogComponent (`src/app/pages/recipes/recipe-form/components/ai-recipe-image-preview-dialog/*`)
- **Opis komponentu**:
    - Modal do podglądu zdjęcia wygenerowanego przez AI.
    - Prezentuje stan: `loading`, `error`, `success`.
    - Pozwala:
        - **Zastosuj** (zwraca decyzję do parenta),
        - **Odrzuć** (zamyka bez zmian),
        - **Wygeneruj ponownie** (nowe – inicjuje kolejne wywołanie generowania),
        - **Zamknij** (w stanie error/cancel).

- **Główne elementy HTML**:
    - `mat-dialog-title` z ikoną `auto_awesome`.
    - `mat-dialog-content`:
        - `mat-spinner` + tekst (loading),
        - ikona błędu + lista `reasons` (error),
        - `<img [src]="imageDataUrl()">` (success).
    - `mat-dialog-actions`:
        - (loading/success) `Odrzuć`, `Zastosuj` (+ spinner w apply).
        - (error) `Zamknij`.
        - (nowe) `Wygeneruj ponownie` widoczne w `error` oraz (opcjonalnie) w `success`.

- **Obsługiwane zdarzenia**:
    - `onApply()`, `onReject()`, `onCancel()`
    - (Nowe) `onRegenerate()`

- **Obsługiwana walidacja**:
    - Brak walidacji formularzowej – dialog tylko odzwierciedla stan procesu.
    - Blokada akcji przy `state === 'loading'` oraz w trakcie `applying()`.

- **Typy**:
    - `AiRecipeImageDialogData`:
        - `recipeName: string`
    - `AiRecipeImageDialogResult` (zmiana):
        - `action: 'applied' | 'rejected' | 'cancelled' | 'regenerate'`
    - `AiImageDialogState`: `loading | error | success`

- **Propsy**:
    - Dane wejściowe przez `MAT_DIALOG_DATA` (`AiRecipeImageDialogData`).

#### Notatki implementacyjne do modalu (konkret)
- Dodać metodę `setLoading()` ustawiającą:
    - `state = 'loading'`,
    - czyszczenie `imageDataUrl`, `errorMessage`, `errorReasons`.
- Dodać przycisk „Wygeneruj ponownie”:
    - implementacja 1 (preferowana): `onRegenerate()` ustawia `setLoading()` i zamyka dialog z wynikiem `regenerate` **lub** nie zamyka i tylko sygnalizuje parentowi (np. przez wynik + reopen lub przez dodatkowy kanał komunikacji).
    - implementacja 2 (prostsza, akceptowalna): `onRegenerate()` zamyka dialog wynikiem `regenerate`; parent otwiera dialog ponownie i wznawia generowanie.

### RecipeImageUploadComponent (`src/app/pages/recipes/recipe-form/components/recipe-image-upload/recipe-image-upload.component.ts`)
- **Opis komponentu**:
    - Obsługa zdjęcia przepisu: paste/drop/file picker, walidacja typu/rozmiaru, auto-upload w edycji, pending w tworzeniu, snackbar undo.
    - Już wspiera `applyExternalFile(file: File)` – kluczowe do integracji AI.

- **Główne elementy**:
    - Strefa drop/paste.
    - Podgląd zdjęcia.
    - Akcje: wybór pliku, usuń, undo.

- **Obsługiwane zdarzenia**:
    - `imageEvent`:
        - `pendingFileChanged`
        - `uploaded`
        - `deleted`
        - `uploadingChanged`

- **Walidacja**:
    - MIME: `image/jpeg | image/png | image/webp`
    - Size: max 10MB

- **Typy**:
    - `RecipeImageEvent`, `UploadRecipeImageResponseDto`

## 5. Typy
Wymagane typy (z `shared/contracts/types.ts`):

- **AI image generation**:
    - `AiRecipeImageRequestDto`
        - `recipe`: `AiRecipeImageRecipeDto`
        - `output`: `AiRecipeImageOutputDto` (w MVP: `mime_type: 'image/webp'`, `width: 1024`, `height: 1024`)
        - `output_format: 'pycha_recipe_image_v1'`
        - `language?: string` (opcjonalnie – rekomendowane wysyłanie `'pl'` dla spójności)
    - `AiRecipeImageResponseDto`
        - `image.mime_type` (MVP: `image/webp`)
        - `image.data_base64`
        - `meta.style_contract`, `meta.warnings`
    - `AiRecipeImageUnprocessableEntityDto` (422)

Nowe/zmieniane typy widoku:

- **`AiRecipeImageDialogResult`** (zmiana):
    - dodać `action: 'regenerate'`.

## 6. Zarządzanie stanem
Stan w `RecipeFormPageComponent` (signals + Reactive Forms):

- **Sygnały istniejące**:
    - `isEditMode`, `recipeId`, `loading`, `saving`, `imageUploading`, `aiGenerating`, `error`
    - `currentImageUrl`
    - computed: `pageTitle`, `isSaveDisabled`, `isAiImageButtonVisible`, `isAiImageButtonDisabled`

- **Dodatkowy stan potrzebny do regenerate (rekomendowane)**:
    - brak nowego globalnego stanu – wystarczy:
        - metoda w dialogu `setLoading()`,
        - pętla w `onGenerateAiImage()` (kolejna próba, bez utraty kontekstu).

Uwaga dot. UX „loading states”:
- Przy re-generacji nie czyścić całego formularza ani zdjęcia – jedynie przełączyć stan dialogu na `loading`.

## 7. Integracja API
Frontend wywołuje Edge Function:

- **Endpoint**: `POST /ai/recipes/image` (Supabase Edge Function) – przez warstwę serwisu `AiRecipeImageService`.
- **Auth**: wymagany JWT (Bearer).
- **Premium gating**: `app_role` musi być `premium` lub `admin` (w przeciwnym razie `403`).

### Request/Response
- **Request**: `AiRecipeImageRequestDto`
    - Kluczowe: `output_format: 'pycha_recipe_image_v1'`, `output.mime_type: 'image/webp'`, `1024×1024`.
    - `recipe` budowane z aktualnego stanu formularza (w tym niezapisanych zmian).
- **Response**: `AiRecipeImageResponseDto`
    - Zwracany base64 do podglądu (data URL).

### Mapowanie błędów na UI
- **401**: „Brak autoryzacji. Zaloguj się ponownie.”
- **403**: „Generowanie zdjęć AI jest dostępne tylko dla użytkowników Premium.”
- **422**: wyświetlić `message` + listę `reasons` w dialogu.
- **429**: komunikat o limicie, sugestia ponowienia za chwilę.
- **timeout/Abort**: komunikat o zbyt długim generowaniu.

> Ważne: zgodnie z zasadami projektu frontend powinien preferować `supabase.functions.invoke(...)` do wywołań Edge Functions (zamiast ręcznego `fetch`). Jeśli w projekcie przyjmujemy obecny `fetch`, utrzymać spójnie w `AiRecipeImageService`. Plan wdrożenia nie wymaga refaktoru, ale warto rozważyć jako follow-up.

## 8. Interakcje użytkownika
- **Klik AI (edit, premium/admin)**:
    - Otwórz modal w stanie `loading`.
    - Wywołaj generowanie dla aktualnego stanu formularza.
    - Po sukcesie pokaż podgląd + przyciski „Odrzuć”, „Zastosuj” (+ opcjonalnie „Wygeneruj ponownie”).
- **Zastosuj**:
    - Skonwertuj `image.data_base64` (webp) do `File`.
    - Przekaż do `RecipeImageUploadComponent.applyExternalFile(file)`:
        - w edycji: uruchomi auto-upload + snackbar Undo,
        - w tworzeniu: nieaktywne (bo AI dostępne tylko dla edycji).
- **Odrzuć**:
    - Zamknij dialog bez zmian.
- **Wygeneruj ponownie**:
    - Ponów wywołanie generowania (kolejna próba, `n=1`):
        - dialog wraca do `loading`,
        - po sukcesie podmienia podgląd,
        - po błędzie pokazuje `error`.

## 9. Warunki i walidacja
Warunki weryfikowane w UI i ich wpływ na stan:

- **Widoczność akcji AI**:
    - `AuthService.appRole()` w (`premium` | `admin`) → pokaż przycisk.
    - w przeciwnym razie ukryj (MVP).
- **Dostępność (enabled/disabled)**:
    - tylko w edycji (`recipeId != null`),
    - disabled jeśli `saving || imageUploading || aiGenerating`.
- **Dane minimalne do generowania**:
    - `name.trim().length > 0`
    - `ingredients.length >= 1`
    - `steps.length >= 1`
    - w przeciwnym razie snackbar i brak otwarcia dialogu.
- **Kontrakt requestu**:
    - zawsze wysyłać `output.mime_type = 'image/webp'` i `1024×1024`.

## 10. Obsługa błędów
Scenariusze i rekomendowana reakcja:

- **User nie-premium**:
    - UI: przycisk niewidoczny (MVP).
    - Jeśli mimo wszystko backend zwróci 403: dialog pokazuje komunikat premium.
- **422 Unprocessable Entity**:
    - Dialog stan `error`:
        - `errorMessage` + lista `reasons`.
        - Dostępna akcja „Wygeneruj ponownie”.
- **429 Too Many Requests**:
    - Dialog `error` + sugestia ponowienia.
    - Opcjonalnie dodać backoff (np. disabled przycisku regenerate na X sekund) – poza MVP.
- **Timeout**:
    - Dialog `error` + możliwość ponowienia.
- **Błąd sieci/500**:
    - Dialog `error` z generycznym komunikatem.

## 11. Kroki implementacji
1. **Zaktualizować request output w `RecipeFormPageComponent.buildAiImageRequest()`**:
    - `output.mime_type` → `'image/webp'` (MVP).
    - (Opcjonalnie) dopisać `language: 'pl'` w request.
2. **Doprecyzować konwersję `base64 → File` w `applyAiGeneratedImage(...)`**:
    - nazwa pliku i rozszerzenie `.webp` zgodne z `mimeType`.
3. **Rozszerzyć `AiRecipeImagePreviewDialogComponent` o akcję „Wygeneruj ponownie”**:
    - dodać `AiRecipeImageDialogResult.action = 'regenerate'`.
    - dodać przycisk w HTML (w `error` i opcjonalnie `success`).
    - dodać metodę `setLoading()` i handler `onRegenerate()`.
4. **Dodać obsługę pętli regeneracji w `RecipeFormPageComponent.onGenerateAiImage()`**:
    - po `success/error` czekać na wynik dialogu,
    - jeśli `regenerate` → ponowić generowanie (z nowym requestem z aktualnego stanu formularza),
    - nadal jedna próba na kliknięcie, brak `n` w FE.
5. **Spójne blokady UI**:
    - Upewnić się, że `aiGenerating` blokuje zapis i upload (już istnieje).
    - Przy regeneracji utrzymać `aiGenerating = true` na czas requestu.
6. **Testy manualne (checklist)**:
    - premium/admin w edycji: generowanie → success → zastosuj → auto-upload → snackbar Undo.
    - 422: pokazuje `reasons` + regenerate działa (kolejna próba).
    - 429: komunikat i możliwość ponowienia.
    - user: brak przycisku AI.
    - request zawsze wysyła `image/webp` (sprawdzić w Network/Logs).


