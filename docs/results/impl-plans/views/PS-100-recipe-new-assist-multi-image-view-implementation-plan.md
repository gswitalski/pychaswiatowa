# Plan implementacji widoku PS-100 — Analiza przepisu AI z wielu zdjęć (Asysta AI, tryb „Obraz")

## 1. Przegląd

Widok `/recipes/new/assist` (`RecipeNewAssistPageComponent`) w trybie „Obraz" przyjmuje dziś **jedno** zdjęcie (`imageFile` + `imagePreviewUrl`). PS-100 zamienia je na **listę 1–5 zdjęć jednego przepisu** (np. kolejnych stron książki kucharskiej), która jest wysyłana jednym żądaniem `POST /ai/recipes/draft` z polem `images` i daje jeden wspólny draft (1 kredyt `draft`).

Zakres zmian we frontendzie:

- **Modyfikacja** `RecipeNewAssistPageComponent` — lista zdjęć (miniatury, licznik „X / 5", usuwanie, zmiana kolejności), jedno wejście `addFiles(files: File[])`, wskazówka o jednym przepisie, nowy `buildRequest()`.
- **Modyfikacja** `ImageCompressionService` — metoda `compressForAiDraft(file)` z fallbackiem na oryginał oraz guard na `blob.type` (Safari).
- **Modyfikacja** `AiRecipeDraftService` — `413` z `details.limit` (`per_file` / `total`).
- **Modyfikacja** `RecipeFormPageComponent` — zamykany komunikat o pominiętych (nieczytelnych) zdjęciach z `meta.image_warnings`.
- **Nowe pliki** — stałe i komunikaty listy zdjęć, formater komunikatu o pominiętych zdjęciach.

Bez zmian: trasa i guard (`premiumRoleMatchGuard`), tryby „Tekst" i „Link URL", wskaźnik / baner / dialog kredytów `draft`, `CameraCaptureButtonComponent`, `ClipboardImageService`, `RecipeDraftStateService` (przechowuje już `meta`), `RecipeImageUploadComponent` (zdjęcie dania w formularzu pozostaje pojedyncze).

Kontrakty w `shared/contracts/types.ts` zawierają już typy PS-100 (`images`, `AiRecipeDraftImageWarningDto`, `image_warnings`, `AiRecipeDraftPayloadTooLargeDto`) — w implementacji należy je tylko zweryfikować, nie dodawać ponownie.

## 2. Routing widoku

Bez zmian:

```
/recipes/new/assist     → RecipeNewAssistPageComponent   (premiumRoleMatchGuard)
/recipes/new            → RecipeFormPageComponent        (cel nawigacji po udanej analizie)
```

Nie są potrzebne nowe trasy ani guardy. API akceptuje także rolę `user`, ale gating trasy UI (`premium` / `admin`) pozostaje bez zmian.

## 3. Struktura komponentów

```
RecipeNewAssistPageComponent                      (/recipes/new/assist)  ← MODYFIKACJA
├── PageHeaderComponent                           (Wróć / Dalej)
├── mat-card.credits-banner                       (baner wyczerpania kredytów — bez zmian)
├── AiCreditsIndicatorComponent                   (wskaźnik `draft` — bez zmian)
├── mat-button-toggle-group                       (Tekst | Obraz | Link URL — bez zmian)
├── [source=text]  textarea                       (bez zmian)
├── [source=url]   RecipeAssistUrlInputComponent  (bez zmian)
├── [source=image] .image-input-container         ← PRZEBUDOWA
│   ├── .info-hint (wskazówka o jednym przepisie i kolejności stron)    ← NOWE
│   ├── @if (images().length === 0) .image-paste-area (stan pusty)
│   │   └── .upload-actions: [Dodaj zdjęcia] [Wklej ze schowka] [pych-camera-capture-button]
│   ├── @else ul.image-list                                              ← NOWE
│   │   └── li.image-item × N  (miniatura | spinner, Usuń, ◀ „Zdjęcie k z N" ▶)
│   ├── p.image-counter (aria-live)                                      ← NOWE
│   ├── .image-preview-actions: [Dodaj zdjęcia] [Wklej ze schowka] [pych-camera-capture-button]
│   ├── p.image-limit-info                                               ← NOWE
│   ├── p.analyzing-hint (aria-live, ≥ 2 zdjęć w isLoading())            ← NOWE
│   └── input[type=file][multiple] (ukryty)                              ← NOWE
├── .error-container                              (imageMessages + errorMessage + powody 422)
└── .info-hint (dolna wskazówka, ukryta w trybie „Obraz")

RecipeFormPageComponent                           (/recipes/new)  ← MODYFIKACJA
└── .draft-image-warning (role="status", zamykany)                       ← NOWE
```

Lista zdjęć jest sekcją szablonu strony (zgodnie z planem UI), nie osobnym komponentem. Jeśli plik `recipe-new-assist-page.component.html` urośnie ponad czytelność, listę można wydzielić do `pych-recipe-assist-image-list` bez zmiany logiki — stan i metody pozostają w stronie.

## 4. Szczegóły komponentów

### RecipeNewAssistPageComponent (modyfikacja)

- **Opis:** Strona asysty AI. W trybie „Obraz" zarządza listą zdjęć (dodawanie z wielu źródeł, walidacja, kompresja, usuwanie, kolejność), buduje żądanie `images[]`, obsługuje błędy API i przekazuje draft do `/recipes/new`. Ścieżka: `src/app/pages/recipes/recipe-new-assist/`.
- **Główne elementy:**
    - wskazówka `.info-hint` (ikona `info`, tekst `hint`) — zawsze widoczna w trybie „Obraz", nad strefą zdjęć;
    - stan pusty: istniejąca `.image-paste-area` z trzema akcjami w `.upload-actions`;
    - stan z zdjęciami: `<ul class="image-list" role="list">`, `<li class="image-item">` z `@for (item of images(); track item.id; let i = $index; let n = $count)`;
    - miniatura: `<img [src]="item.previewUrl" [alt]="'Zdjęcie ' + (i + 1) + ' z ' + n">`; w trakcie przetwarzania `mat-spinner` (średnica 28) i `aria-busy="true"`;
    - przycisk usuwania (`mat-mini-fab`, `color="warn"`, ikona `close`) w rogu miniatury;
    - wiersz sterowania: `mat-icon-button` `chevron_left` · „Zdjęcie k z N" · `mat-icon-button` `chevron_right`;
    - licznik `<p class="image-counter" aria-live="polite">Zdjęcia: X / 5</p>`;
    - `.image-preview-actions`: „Dodaj zdjęcia", „Wklej ze schowka", `pych-camera-capture-button`;
    - komunikat `limitInfo` przy 5 zdjęciach i `analyzing` (≥ 2 gotowe zdjęcia w `isLoading()`);
    - ukryty `<input type="file" #fileInput multiple accept="image/png,image/jpeg,image/webp" hidden>` (bez `capture`).
- **Obsługiwane interakcje:**
    - `onAddImagesClick(event)` → `fileInput.click()` (z `stopPropagation`, żeby nie wywołać `focusImageArea()` strefy wklejania);
    - `onFilesSelected(event)` → `addFiles(Array.from(input.files ?? []))`, następnie `input.value = ''`;
    - `onPaste(event)` (`@HostListener('paste')`) → zbiera **wszystkie** obsługiwane obrazy ze zdarzenia → `addFiles`;
    - `onPasteFromClipboardClick(event)` → `readImageFile()` → `addFiles([file])`;
    - `onCameraFileSelected(file)` → `addFiles([file])`;
    - `removeImage(id)`, `moveImage(index, direction)`;
    - `onSourceChange(source)` → przy `text` / `url` `clearAllImages()`;
    - `onNext()` → `buildRequest()` → `generateDraft()` → `setDraft(draft, meta)` → `/recipes/new`;
    - `ngOnDestroy` / `DestroyRef.onDestroy` → zwolnienie wszystkich `ObjectURL`.
- **Obsługiwana walidacja:**
    - format: tylko `image/png`, `image/jpeg`, `image/webp` (inaczej `CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat`);
    - rozmiar pliku **po kompresji** ≤ 10 MB (`AI_DRAFT_MAX_IMAGE_BYTES`; inaczej `fileTooLarge`);
    - liczba zdjęć ≤ 5 (elementy w przetwarzaniu liczą się do limitu);
    - suma rozmiarów gotowych zdjęć ≤ 15 MB przed wysyłką (`totalTooLarge`, bez żądania do API);
    - „Dalej" nieaktywne: `isLoading()`, trwa przetwarzanie miniatur, brak gotowych zdjęć w trybie „Obraz", wyczerpane kredyty przy niepustym wejściu, niepoprawny URL w trybie `url`.
- **Typy:** `AiInputSource`, `AssistImageItem`, `AiRecipeDraftRequestDto` (wariant `images`), `AiRecipeDraftImageMimeType`, `AiRecipeDraftResponseDto`.
- **Propsy:** brak (komponent strony).

### CameraCaptureButtonComponent (bez zmian)

- Emituje pojedynczy `File` (`fileSelected`) — wystarcza `addFiles([file])`. Przycisk dostaje `[disabled]="!canAddImages()"` (zamiast `isLoading()`), czyli jest nieaktywny także przy limicie 5 zdjęć.

### Strefa wklejania `.image-paste-area` (stan pusty)

- Zostaje bez zmian strukturalnych (`#imagePasteArea`, `focusImageArea()`), ale:
    - tekst formatów: „Obsługiwane formaty: PNG, JPEG, WebP (max 10 MB na zdjęcie, do 5 zdjęć)";
    - `.upload-actions`: **[ Dodaj zdjęcia ] [ Wklej ze schowka ] [ Zrób zdjęcie ]**;
    - wszystkie trzy przyciski `[disabled]="!canAddImages()"` (schowek dodatkowo `|| !clipboardSupported`, z istniejącym tooltipem).

### RecipeFormPageComponent (modyfikacja)

- **Opis:** `/recipes/new` w trybie tworzenia wyświetla minimalny, zamykany komunikat informacyjny o zdjęciach pominiętych przez AI. PS-91 nie dodał UI dla `meta.warnings` — PS-100 wprowadza element ograniczony wyłącznie do `meta.image_warnings`; pozostałe wpisy `meta.warnings` nadal nie mają UI.
- **Główne elementy:** blok `<div class="draft-image-warning" role="status">` z ikoną `warning_amber`, tekstem i `mat-icon-button` „Zamknij" (`aria-label="Zamknij komunikat o pominiętych zdjęciach"`). Umieszczony na górze `.recipe-form-page`, nad `<form>` (poza `@if (loading())`, żeby nie znikał przy przeładowaniu kategorii), widoczny tylko gdy `!isEditMode() && draftImageWarnings().length > 0`.
- **Obsługiwane interakcje:** `dismissDraftImageWarnings()` czyści sygnał. Komunikat nie blokuje edycji, nie jest zapisywany i znika po opuszczeniu strony.
- **Obsługiwana walidacja:** w `checkAndApplyDraft()` do listy trafiają wyłącznie wpisy `code === 'IMAGE_UNREADABLE'` z poprawnym `image_index` (liczba całkowita ≥ 1), posortowane rosnąco, bez duplikatów.
- **Typy:** `AiRecipeDraftMetaDto`, `AiRecipeDraftImageWarningDto`, `number[]`.
- **Propsy:** brak.

## 5. Typy

### Stałe — `ai-draft-images.constants.ts` (nowy plik)

Ścieżka: `src/app/pages/recipes/recipe-new-assist/ai-draft-images.constants.ts`.

```typescript
import { CLIPBOARD_IMAGE_MAX_BYTES } from '../../../shared/services/clipboard-image.types';

/** Maks. liczba zdjęć w jednej analizie (spójne z backendem — MAX_DRAFT_IMAGES). */
export const AI_DRAFT_MAX_IMAGES = 5;

/** Maks. rozmiar jednego zdjęcia po kompresji — jedno źródło prawdy z PS-92/PS-93. */
export const AI_DRAFT_MAX_IMAGE_BYTES = CLIPBOARD_IMAGE_MAX_BYTES;

/** Maks. łączny rozmiar zdjęć (spójne z backendem — MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES). */
export const AI_DRAFT_MAX_TOTAL_IMAGES_BYTES = 15 * 1024 * 1024;

/** Od ilu zdjęć pokazywać komunikat „Analizuję zdjęcia…". */
export const AI_DRAFT_ANALYZING_HINT_MIN_IMAGES = 2;
```

### Komunikaty — `ai-draft-images.messages.ts` (nowy plik)

```typescript
export const AI_DRAFT_IMAGES_UI_MESSAGES = {
    addImages: 'Dodaj zdjęcia',
    limitReached: 'Można dodać maksymalnie 5 zdjęć — nadmiarowe pliki zostały pominięte.',
    limitInfo: 'Osiągnięto limit 5 zdjęć.',
    analyzing: 'Analizuję zdjęcia… to może potrwać do minuty.',
    hint: 'Wszystkie zdjęcia powinny dotyczyć tego samego przepisu. Dodawaj je w kolejności stron.',
    totalTooLarge:
        'Łączny rozmiar zdjęć jest zbyt duży (max 15 MB). Usuń część zdjęć i spróbuj ponownie.',
    perFileTooLarge: 'Jedno ze zdjęć jest zbyt duże. Maksymalny rozmiar to 10 MB.',
} as const;
```

Istniejące komunikaty (`CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat`, `fileTooLarge`, `noImage`, błędy schowka) pozostają bez zmian i są używane ponownie. Limity w tekstach „5" / „10 MB" / „15 MB" są stałe w treści; jeśli stała zostanie zmieniona, komunikaty trzeba zaktualizować (lub zbudować je z interpolacji stałych — preferowane przy implementacji).

Etykiety ARIA (funkcje w szablonie / komponencie): „Usuń zdjęcie {k} z {N}", „Przesuń zdjęcie {k} z {N} w lewo", „Przesuń zdjęcie {k} z {N} w prawo", „Dodaj zdjęcia z dysku".

### ViewModel — element listy

```typescript
interface AssistImageItem {
    /** Stabilny identyfikator (track w @for, kotwica fokusu, klucz wyniku kompresji). */
    id: string;
    /** `null` w czasie przetwarzania (kompresji). */
    file: File | null;
    /** `URL.createObjectURL(file)`; `null` w czasie przetwarzania. */
    previewUrl: string | null;
    status: 'processing' | 'ready';
}
```

Typ pozostaje prywatny dla komponentu (nie jest współdzielony).

### DTO (bez zmian — już w `shared/contracts/types.ts`)

| Typ | Zastosowanie |
|---|---|
| `AiRecipeDraftRequestDto` (wariant `{ source: 'image'; images: AiRecipeDraftImageDto[]; image?: never; … }`) | Żądanie z `buildRequest()`; UI nigdy nie wysyła starego pola `image` |
| `AiRecipeDraftImageDto` `{ mime_type: AiRecipeDraftImageMimeType; data_base64: string }` | Element `images[]` |
| `AiRecipeDraftResponseDto` | Odpowiedź `200` (`draft`, `meta`) |
| `AiRecipeDraftMetaDto` (`confidence`, `warnings`, `image_warnings?`) | Zapis w `RecipeDraftStateService`, odczyt w formularzu |
| `AiRecipeDraftImageWarningDto` `{ code: 'IMAGE_UNREADABLE'; image_index: number }` | `image_index` numerowany od 1 |
| `AiRecipeDraftPayloadTooLargeDto` `{ code: 'PAYLOAD_TOO_LARGE'; message; details?: { limit: 'per_file' \| 'total'; max_bytes } }` | Treść `413` |
| `AiRecipeDraftUnprocessableEntityDto` | Treść `422` (bez zmian) |
| `AiCreditsExhaustedErrorDto` | Treść `402` (bez zmian) |

### Nowe typy w serwisie draftu

```typescript
export type AiDraftPayloadTooLargeLimit = 'per_file' | 'total';

export class AiDraftPayloadTooLargeError extends Error {
    readonly status = 413;

    constructor(readonly limit: AiDraftPayloadTooLargeLimit = 'per_file') {
        super(
            limit === 'total'
                ? AI_DRAFT_IMAGES_UI_MESSAGES.totalTooLarge
                : AI_DRAFT_IMAGES_UI_MESSAGES.perFileTooLarge,
        );
        this.name = 'AiDraftPayloadTooLargeError';
    }
}
```

Domyślna wartość `'per_file'` zachowuje zgodność z brakiem `details` w odpowiedzi.

### Stała kompresji — `image-compression.constants.ts`

```typescript
/** Zdjęcia większe niż ten próg są zmniejszane przed analizą AI (PS-100). */
export const AI_DRAFT_IMAGE_COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
```

### Komunikat o pominiętych zdjęciach — `draft-image-warnings.messages.ts` (nowy plik)

Ścieżka: `src/app/pages/recipes/recipe-form/draft-image-warnings.messages.ts`. Formater leży przy formularzu (konsumencie), a nie w katalogu asysty, żeby uniknąć importu między stronami.

```typescript
/** „Zdjęcie 2 było nieczytelne…" / „Zdjęcia 2 i 3 były nieczytelne…" / „Zdjęcia 1, 2 i 4 były nieczytelne…" */
export function formatUnreadableImagesMessage(indices: number[]): string;
```

| Wejście | Wynik |
|---|---|
| `[]` | pusty string (komponent i tak nie renderuje bloku) |
| `[2]` | „Zdjęcie 2 było nieczytelne i zostało pominięte. Sprawdź, czy w przepisie niczego nie brakuje." |
| `[2, 3]` | „Zdjęcia 2 i 3 były nieczytelne i zostały pominięte. Sprawdź, czy w przepisie niczego nie brakuje." |
| `[1, 2, 4]` | „Zdjęcia 1, 2 i 4 były nieczytelne i zostały pominięte. Sprawdź, czy w przepisie niczego nie brakuje." |

## 6. Zarządzanie stanem

Stan lokalny w komponentach na sygnałach (bez NgRx, bez nowych hooków/serwisów stanu). Draft przechodzi między stronami przez istniejący `RecipeDraftStateService`.

### Sygnały i computed — `RecipeNewAssistPageComponent`

| Nazwa | Typ | Opis |
|---|---|---|
| `images` | `signal<AssistImageItem[]>([])` | **Zastępuje** `imageFile` i `imagePreviewUrl` (należy je usunąć) |
| `imageMessages` | `signal<string[]>([])` | Komunikaty inline z ostatniej partii (format, rozmiar, limit); deduplikowane |
| `imageCount` | computed | `images().length` — elementy w przetwarzaniu rezerwują miejsce w limicie |
| `readyImages` | computed | Elementy `status === 'ready'` |
| `isProcessingImages` | computed | Istnieje element `processing` |
| `isImageLimitReached` | computed | `imageCount() >= AI_DRAFT_MAX_IMAGES` |
| `canAddImages` | computed | `!isLoading() && !isImageLimitReached()` |
| `imageCounterLabel` | computed | `` `${imageCount()} / ${AI_DRAFT_MAX_IMAGES}` `` |
| `showAnalyzingHint` | computed | `isLoading() && source() === 'image' && readyImages().length >= 2` |
| `hasAiInput` | computed (**zmiana**) | Dla `image`: `readyImages().length > 0` |
| `isNextDisabled` | computed (**zmiana**) | Dotychczasowe warunki **lub** `isProcessingImages()` **lub** `(source() === 'image' && readyImages().length === 0)` |
| `isClipboardPasteDisabled` | computed (**zmiana**) | `!canAddImages() \|\| !clipboardSupported` (zamiast `isLoading() \|\| …`) |

Bez zmian: `source`, `text`, `urlValue`, `isLoading`, `errorMessage`, `unprocessableReasons`, `isCreditsExhausted`, `nextButtonTooltip`.

**Założenie wymagające potwierdzenia:** kryterium akceptacji (scenariusz 3 i F-100-08) wymaga, aby po usunięciu ostatniego zdjęcia „Dalej" było nieaktywne. Dotychczas pusty tryb „Obraz" pozwalał kliknąć „Dalej" i przejść do pustego formularza. Plan przyjmuje wersję zgodną z kryterium: w trybie „Obraz" bez gotowych zdjęć „Dalej" jest nieaktywne, a dolny `.info-hint` („Jeśli nie podasz żadnych danych, zostaniesz przekierowany do pustego formularza") jest ukryty w tym trybie (`@if (source() !== 'image')`). Pusty formularz pozostaje dostępny przez „Wróć" → `/recipes/new/start`.

### Sygnały — `RecipeFormPageComponent`

| Nazwa | Typ | Opis |
|---|---|---|
| `draftImageWarnings` | `signal<number[]>([])` | Numery nieczytelnych zdjęć z `meta.image_warnings` |
| `draftImageWarningMessage` | computed | `formatUnreadableImagesMessage(draftImageWarnings())` |

### Zwalnianie zasobów

- Każdy `previewUrl` pochodzi z `URL.createObjectURL(file)` (zastępuje `FileReader.readAsDataURL`) i **musi** być zwolniony przez `URL.revokeObjectURL` przy: usunięciu elementu, odrzuceniu placeholdera po zakończeniu kompresji, `clearAllImages()` (zmiana źródła na `text` / `url`) oraz zniszczeniu komponentu (`inject(DestroyRef).onDestroy(...)`).
- `onNext` zakończony błędem **nie** czyści listy (ponowna próba bez ponownego dodawania).

### Customowe hooki

Niepotrzebne. Logika dodawania/zarządzania listą pozostaje metodami komponentu; kompresja jest w `ImageCompressionService` (współdzielony, już `providedIn: 'root'`).

## 7. Integracja API

Endpoint: `POST {supabase.url}/functions/v1/ai/recipes/draft` (wywołanie przez `fetch` w `AiRecipeDraftService.generateDraft`, jak dotychczas; Bearer JWT + `apikey`).

### Żądanie

Typ: `AiRecipeDraftRequestDto` (wariant `images`). UI zawsze wysyła `images` — także dla jednego zdjęcia.

```json
{
    "source": "image",
    "images": [
        { "mime_type": "image/jpeg", "data_base64": "/9j/4AAQ..." },
        { "mime_type": "image/webp", "data_base64": "UklGRh..." }
    ],
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

`buildRequest()` (tryb obrazu):

```typescript
const images = await Promise.all(
    this.readyImages().map(async (item) => ({
        mime_type: item.file!.type as AiRecipeDraftImageMimeType,
        data_base64: await this.fileToBase64(item.file!),
    })),
);

return {
    source: 'image',
    images,
    output_format: 'pycha_recipe_draft_v1',
    language: 'pl',
};
```

`Promise.all` zachowuje kolejność wejścia, więc kolejność żądania = kolejność listy. `readyImages()` zachowuje kolejność `images()`.

**Pre-walidacja sumy** w `onNext()` przed `isLoading.set(true)`: jeśli suma `file.size` gotowych zdjęć > `AI_DRAFT_MAX_TOTAL_IMAGES_BYTES` → `errorMessage.set(totalTooLarge)` i brak wywołania API (rozmiar pliku odpowiada rozmiarowi po dekodowaniu base64, które waliduje backend).

### Odpowiedź `200`

Typ: `AiRecipeDraftResponseDto`. Po sukcesie (kolejność jak dotychczas): `creditsService.refreshCredits()` (pobrany 1 kredyt) → `draftStateService.setDraft(response.draft, response.meta)` → `router.navigate(['/recipes/new'])`. `meta.image_warnings` jest obecne tylko przy nieczytelnych zdjęciach i tylko dla N > 1.

### Mapowanie błędów

| Odpowiedź | Obsługa | UI |
|---|---|---|
| `413`, `details.limit = 'total'` | `AiDraftPayloadTooLargeError('total')` | Inline `totalTooLarge`; lista nienaruszona |
| `413`, `details.limit = 'per_file'` lub brak `details` / niepoprawne ciało | `AiDraftPayloadTooLargeError('per_file')` | Inline `perFileTooLarge`; lista nienaruszona |
| `402 AI_CREDITS_EXHAUSTED` | `AiCreditsExhaustedApiError` (bez zmian) | `AiCreditsExhaustedDialogComponent` + `refreshCredits()` |
| `422` | `AiDraftValidationError` (bez zmian) | Komunikat + lista powodów (np. „Żadne ze zdjęć nie było czytelne."); formularz niewypełniony |
| `429`, `500`, `502`, `504` | Dotychczasowe | Komunikat inline; lista nienaruszona, ponowna próba możliwa |
| `400 VALIDATION_ERROR` (kształt) | Nie występuje przy poprawnym UI | Obsługa bez zmian (dotychczasowa ścieżka `400/422`) |

Zmiana w `handleErrorResponse` dla `413`:

```typescript
case 413: {
    const body = await response
        .json()
        .catch(() => ({}) as Partial<AiRecipeDraftPayloadTooLargeDto>);
    const limit = body?.details?.limit === 'total' ? 'total' : 'per_file';
    throw new AiDraftPayloadTooLargeError(limit);
}
```

`AiRecipeDraftPayloadTooLargeDto` jest importowany z `shared/contracts/types.ts`. Komunikat błędu jest budowany w klasie błędu, więc `handleError` w stronie nie wymaga osobnej gałęzi — `error instanceof Error` ustawia `errorMessage` (klasa błędu jest już re-rzucana w `generateDraft`).

### Kompresja — `ImageCompressionService.compressForAiDraft`

```typescript
/**
 * Kompresja zdjęć do analizy AI (PS-100). Nigdy nie rzuca wyjątku:
 * przy błędzie zwraca oryginał (limity rozmiaru sprawdza wywołujący).
 */
public async compressForAiDraft(file: File): Promise<File> {
    try {
        return await this.compressToMaxSize(file, AI_DRAFT_IMAGE_COMPRESS_THRESHOLD_BYTES);
    } catch {
        return file;
    }
}
```

- Pliki ≤ ~1,5 MB są zwracane bez zmian (istniejące zachowanie `compressToMaxSize`).
- Dłuższy bok ≤ 2048 px (`IMAGE_COMPRESS_MAX_DIMENSION_PX`), jakość startowa 0,85, PNG → WebP — istniejące mechanizmy.
- **Guard Safari** w `renderToBlob`: gdy `blob.type !== mimeType` (iOS Safari potrafi zwrócić PNG zamiast WebP), próba jest uznawana za nieudaną (`return null`); dla źródła PNG, gdy WebP się nie powiedzie, spróbować `image/jpeg` z białym tłem narysowanym przed `drawImage`.
- `compressToMaxSize` jest używane także przez `RecipeImageUploadComponent` i `RecipeFormPageComponent` — zmiana `renderToBlob` musi zachować dotychczasowe wyniki dla przeglądarek zgodnych (testy regresji w specyfikacji serwisu).

## 8. Interakcje użytkownika

| Interakcja | Oczekiwany wynik |
|---|---|
| Wybór trybu „Obraz" | Widoczna wskazówka o jednym przepisie i kolejności stron; stan pusty z trzema akcjami; „Dalej" nieaktywne |
| „Dodaj zdjęcia" → wybór N plików | `addFiles(files)`; miniatury w kolejności wyboru; licznik „N / 5" |
| Ctrl+V z obrazem(-ami) | Wszystkie obsługiwane obrazy ze zdarzenia dopisane na koniec listy; `preventDefault()` |
| Ctrl+V bez obrazu / z nieobsługiwanym | Komunikat inline (`noImage` / `unsupportedFormat`); lista bez zmian |
| „Wklej ze schowka" (PS-92) | Zdjęcie dopisane na koniec; błędy schowka inline (mapowanie `messageForError`) |
| „Zrób zdjęcie" (PS-93) | Zdjęcie dopisane na koniec |
| Zdjęcie > ~1,5 MB | Placeholder ze spinnerem, potem miniatura ze zmniejszonej wersji; „Dalej" nieaktywne w trakcie |
| 4 zdjęcia + wybór 3 plików | Dodany 1 plik; inline `limitReached`; przyciski dodawania nieaktywne; brak snackbara |
| Partia z GIF/PDF i poprawnymi plikami | Poprawne dodane; inline komunikat o formacie (jeden dla wielu plików) |
| Plik > 10 MB (także po nieudanej kompresji) | Odrzucony z `fileTooLarge`; nie zajmuje miejsca w liście |
| „Usuń zdjęcie" | Element znika, kolejność pozostałych zachowana, licznik zaktualizowany; fokus na „Usuń" kolejnego, a gdy brak — poprzedniego lub „Dodaj zdjęcia" |
| „Przesuń w lewo/w prawo" | Zamiana miejsc; numeracja „Zdjęcie k z N" zaktualizowana; fokus pozostaje na przycisku przesuniętego elementu; strzałka nieaktywna na skrajnych pozycjach |
| „Dalej" z ≥ 1 gotowym zdjęciem | Pre-walidacja sumy → spinner na przycisku, `analyzing` (≥ 2 zdjęć), akcje na liście nieaktywne → nawigacja do `/recipes/new` |
| Zmiana źródła na „Tekst" / „Link URL" | Lista czyszczona, `ObjectURL` zwolnione, `imageMessages` wyczyszczone |
| „Zamknij" na komunikacie o pominiętych zdjęciach | Blok znika (sygnał czyszczony) |

### `addFiles(files: File[])` — jedno wejście dla wszystkich źródeł

Wszystkie źródła (picker `multiple`, Ctrl+V, schowek, aparat; w przyszłości drag & drop z PS-59) wywołują tę metodę.

```typescript
async addFiles(files: File[]): Promise<void> {
    if (this.isLoading() || files.length === 0) {
        return;
    }

    this.clearError();
    const messages = new Set<string>();
    const placeholders: Array<{ id: string; file: File }> = [];
    let skippedOverLimit = 0;

    for (const file of files) {
        // 1. Limit — miejsce zajmują także elementy w przetwarzaniu
        if (this.imageCount() + placeholders.length >= AI_DRAFT_MAX_IMAGES) {
            skippedOverLimit++;
            continue;
        }

        // 2. Format
        if (!ALLOWED_IMAGE_TYPES.includes(file.type as AiRecipeDraftImageMimeType)) {
            messages.add(CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat);
            continue;
        }

        // 3. Placeholder rezerwuje pozycję w kolejności (dopisany synchronicznie,
        //    zanim ruszy asynchroniczna kompresja)
        placeholders.push({ id: crypto.randomUUID(), file });
    }

    if (placeholders.length > 0) {
        this.images.update((items) => [
            ...items,
            ...placeholders.map(({ id }) => ({
                id,
                file: null,
                previewUrl: null,
                status: 'processing' as const,
            })),
        ]);
    }

    if (skippedOverLimit > 0) {
        messages.add(AI_DRAFT_IMAGES_UI_MESSAGES.limitReached);
    }

    // 4. Równoległa kompresja; wynik dopasowywany po `id`, nie po indeksie
    const results = await Promise.all(
        placeholders.map(({ id, file }) => this.processImage(id, file)),
    );
    results.filter((message): message is string => message !== null).forEach((m) => messages.add(m));

    // 5. Komunikaty z partii
    this.imageMessages.set([...messages]);
}
```

`processImage(id, file): Promise<string | null>`:

1. `compressed = await this.imageCompression.compressForAiDraft(file)` (nigdy nie rzuca).
2. Jeśli placeholder o danym `id` już nie istnieje (użytkownik go usunął w trakcie) → zwróć `null`, nie twórz `ObjectURL`.
3. Jeśli `compressed.size > AI_DRAFT_MAX_IMAGE_BYTES` → usuń placeholder i zwróć `CLIPBOARD_IMAGE_UI_MESSAGES.fileTooLarge`.
4. W przeciwnym razie podmień placeholder: `file = compressed`, `previewUrl = URL.createObjectURL(compressed)`, `status = 'ready'`; zwróć `null`.

Reguły:

- Kolejność w liście = kolejność plików w partii oraz kolejność partii (nowe zawsze na końcu), niezależnie od czasu zakończenia kompresji.
- Odrzucony plik nie zajmuje miejsca w liście ani w liczniku; poprawne pliki z tej samej partii są dodawane.
- Komunikaty deduplikowane (`Set`); brak snackbara.
- Przy ponownym wywołaniu `addFiles` poprzednie `imageMessages` są zastępowane (czyszczone w `clearError()` / na początku partii).

### Ctrl+V (`onPaste`)

- `if (this.source() !== 'image' || this.isLoading()) return;`
- Zbiera `item.getAsFile()` dla wszystkich `item.kind === 'file'` z `type` w `ALLOWED_IMAGE_TYPES`; ustawia `sawUnsupportedImage` dla pozostałych `image/*`.
- Gdy zebrano ≥ 1 plik: `event.preventDefault()` i `void this.addFiles(files)`.
- Gdy nie zebrano żadnego: `errorMessage` = `unsupportedFormat` (gdy `sawUnsupportedImage`) lub `noImage` — jak dotychczas.
- Listener pozostaje `@HostListener('paste')` (nie `document:paste`), aby nie przechwytywać wklejania w innych polach (np. globalna wyszukiwarka w topbarze). Konsekwencja: Ctrl+V działa, gdy fokus jest wewnątrz komponentu — w stanie z listą zdjęć pod licznikiem wyświetlana jest dodatkowa podpowiedź „Możesz też wkleić kolejne zdjęcie przez Ctrl + V".

### Usuwanie i kolejność

```typescript
removeImage(id: string): void {
    if (this.isLoading()) {
        return;
    }

    // zwolnij ObjectURL, usuń element, zachowaj względną kolejność pozostałych,
    // clearError() oraz wyczyszczenie imageMessages,
    // ustaw fokus: „Usuń" kolejnego → poprzedniego → „Dodaj zdjęcia"
}

moveImage(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (this.isLoading() || target < 0 || target >= this.images().length) {
        return;
    }

    // zamiana miejsc w images(); fokus pozostaje na przycisku przesuniętego elementu
}
```

- Fokus ustawiany po renderze (`afterNextRender` z `injector`) przez selektory `[data-remove-for="{id}"]` / `[data-move-for="{id}"][data-dir="left|right"]` — ponowne ustawienie jest konieczne, bo przeniesienie węzła DOM przy zmianie kolejności `@for` może zgubić fokus.
- Elementy w przetwarzaniu: przyciski przesuwania nieaktywne; przycisk „Usuń" aktywny (usuwa placeholder; wynik kompresji jest odrzucany po `id`).

## 9. Warunki i walidacja

| Warunek | Komponent / miejsce | Wpływ na UI |
|---|---|---|
| `images().length ≤ 5` | `addFiles` | Nadmiar pomijany, `limitReached`; brak snackbara |
| `canAddImages() = !isLoading() && !isImageLimitReached()` | Szablon (3 przyciski dodawania, `pych-camera-capture-button`) | `disabled`; przy 5 zdjęciach `limitInfo` pod przyciskami |
| MIME ∈ {png, jpeg, webp} | `addFiles`, `onPaste` | Odrzucenie + `unsupportedFormat` |
| Rozmiar po kompresji ≤ 10 MB | `processImage` | Odrzucenie + `fileTooLarge` (zgodnie z `413 per_file`) |
| Suma ≤ 15 MB | `onNext` przed wysyłką | `totalTooLarge`, brak żądania (zgodnie z `413 total`) |
| `readyImages().length ≥ 1` | `isNextDisabled` | „Dalej" nieaktywne bez gotowych zdjęć |
| `!isProcessingImages()` | `isNextDisabled` | „Dalej" nieaktywne w trakcie kompresji |
| `!isCreditsExhausted()` przy niepustym wejściu | `isNextDisabled`, baner | Jak w PS-64: blokada, baner, tooltip |
| `images` zawsze 1–5 elementów, bez pola `image` | `buildRequest` | Brak `400 VALIDATION_ERROR` przy poprawnym UI |
| Kolejność żądania = kolejność listy | `buildRequest` | Zgodność z „Zdjęcie k z N" w prompcie backendu |
| `isLoading()` | `addFiles`, `removeImage`, `moveImage`, `onNext`, `onPaste` | Wszystkie akcje na liście nieaktywne (atrybut `disabled`, nie tylko styl); kontener `.loading` |
| `image_index` ≥ 1, liczba całkowita, `code === 'IMAGE_UNREADABLE'` | `RecipeFormPageComponent.checkAndApplyDraft` | Tylko poprawne wpisy trafiają do `draftImageWarnings` |

Warunek schowka (`clipboardSupported`) i tooltip `clipboardUnsupportedTooltip` — bez zmian.

## 10. Obsługa błędów

| Scenariusz | Obsługa |
|---|---|
| Nieobsługiwany format / zbyt duży plik | Komunikat inline w `.error-container` (`role="alert"`), poprawne pliki z partii dodane |
| Przekroczony limit liczby zdjęć | Inline `limitReached`; bez snackbara |
| Błąd kompresji (np. brak wsparcia formatu w canvas, błąd wczytania obrazu) | `compressForAiDraft` zwraca oryginał; jeśli ≤ 10 MB — zdjęcie dodane bez komunikatu; inaczej `fileTooLarge`. Stary `compressionFailed` nie jest używany w asyście |
| Użytkownik usuwa zdjęcie w trakcie kompresji | Wynik odrzucany po `id`; brak wycieku `ObjectURL` |
| Błąd schowka (PS-92) | `clipboardImageService.messageForError(err)` inline, lista bez zmian |
| `413` total / per_file | Inline właściwy komunikat z sugestią usunięcia zdjęć; lista nienaruszona |
| `402` | Dialog wyczerpania kredytów + odświeżenie kredytów |
| `422` (brak przepisu na zdjęciach, wszystkie nieczytelne) | `errorMessage` + `unprocessableReasons`; lista nienaruszona, formularz niewypełniony |
| `429`, `500`, `502`, `504`, timeout (do 140 s dla 5 zdjęć) | Dotychczasowy komunikat; lista nienaruszona; ponowna próba możliwa |
| Brak sesji | `Error('Brak sesji użytkownika…')` jak dotąd |
| Draft bez `image_warnings` | Brak komunikatu na formularzu |
| `image_warnings` z niepoprawnymi wpisami | Filtrowane (nieliczbowe, < 1, duplikaty); pusta lista → brak bloku |
| Wygasły draft (TTL 10 min) | `consumeDraft()` zwraca `null` — pusty formularz, bez komunikatu (bez zmian) |
| Wiele różnych przepisów na zdjęciach | Poza zakresem; tylko stała wskazówka w UI |
| HEIC/HEIF nieskonwertowany przez przeglądarkę | Odrzucenie jako nieobsługiwany format (znane ograniczenie; punkt testu manualnego iOS Safari) |

Wszystkie komunikaty są inline — bez snackbara (zgodnie z PS-92/PS-93 i kryteriami PS-100). Kontener błędów ma `role="alert"`, licznik i komunikat `analyzing` — `aria-live="polite"`.

## 11. Kroki implementacji

1. **Zweryfikować kontrakty** w `shared/contracts/types.ts` (`images`, `image_warnings`, `AiRecipeDraftImageWarningDto`, `AiRecipeDraftPayloadTooLargeDto`) — są już dodane; uzupełnić tylko ewentualne braki.
2. **`ImageCompressionService`:** dodać `AI_DRAFT_IMAGE_COMPRESS_THRESHOLD_BYTES` w `image-compression.constants.ts`, metodę `compressForAiDraft(file)` oraz guard `blob.type !== mimeType` w `renderToBlob` (z fallbackiem PNG → JPEG z białym tłem). Testy: plik ≤ 1,5 MB bez zmian, większy zmniejszony, błąd → oryginał, guard Safari, regresja `compressToMaxSize` dla pozostałych konsumentów.
3. **Stałe i komunikaty:** utworzyć `ai-draft-images.constants.ts` i `ai-draft-images.messages.ts` w `recipe-new-assist/`.
4. **`AiRecipeDraftService`:** `AiDraftPayloadTooLargeError(limit)`, parsowanie ciała `413` (`details.limit`), dostosowanie JSDoc. Testy: `total` → `limit === 'total'`; `per_file`; brak `details`; niepoprawny JSON → `per_file`.
5. **Stan komponentu asysty:** zastąpić `imageFile` / `imagePreviewUrl` sygnałem `images` (`AssistImageItem[]`); dodać `imageMessages`, computed (`imageCount`, `readyImages`, `isProcessingImages`, `isImageLimitReached`, `canAddImages`, `imageCounterLabel`, `showAnalyzingHint`); zmienić `hasAiInput`, `isNextDisabled`, `isClipboardPasteDisabled`.
6. **Logika listy:** `addFiles`, `processImage`, `removeImage`, `moveImage`, `clearAllImages`, zwalnianie `ObjectURL` (`DestroyRef`), zarządzanie fokusem (`afterNextRender`). Usunąć `handleImageFile`, `createImagePreview`, `onRemoveImage`, `clearImage`, import `ImageCompressionError` i `CLIPBOARD_IMAGE_MAX_BYTES` (zastąpione stałymi PS-100).
7. **Źródła:** podpiąć pod `addFiles` — `input[type=file][multiple]` (`onAddImagesClick`, `onFilesSelected` z `input.value = ''`), `onPaste` (wszystkie obrazy; guard `isLoading()`), `onPasteFromClipboardClick` (`addFiles([file])`), `onCameraFileSelected` (`addFiles([file])`).
8. **`onSourceChange`:** przy `text` / `url` wołać `clearAllImages()` (zwolnienie `ObjectURL`, czyszczenie `imageMessages`).
9. **`buildRequest()` i `onNext()`:** wariant `images` z zachowaniem kolejności; pre-walidacja sumy 15 MB przed `isLoading.set(true)`; lista nie jest czyszczona po błędzie.
10. **Szablon `recipe-new-assist-page.component.html`:** wskazówka `hint`; stan pusty z trzema akcjami i nowym tekstem formatów; `ul.image-list` z miniaturami, przyciskami „Usuń" i strzałkami, etykietami ARIA, `data-*` dla fokusu; licznik z `aria-live`; `limitInfo`; `analyzing`; ukryty `input[multiple]`; `imageMessages()` w `.error-container` (`role="alert"`); ukrycie dolnego `.info-hint` w trybie „Obraz".
11. **Style `recipe-new-assist-page.component.scss`:** `.image-list` (grid `repeat(auto-fill, minmax(140px, 1fr))`, `gap: 16px`), `.image-item` (`img` `aspect-ratio: 3 / 4`, `object-fit: cover`, `border-radius: 8px`), stan `.processing` z wyśrodkowanym spinnerem, wiersz sterowania, pozycjonowanie przycisku „Usuń" (reuse stylu `.remove-image-button`), `:focus-visible` na przyciskach, cele dotykowe ≥ 40 px; mobile (≤ 600 px): `minmax(104px, 1fr)`, przyciski dodawania w kolumnie na pełną szerokość (rozszerzenie istniejącego `@media`). Kolory wyłącznie ze zmiennych `--mat-sys-*`; usunąć nieużywane style `.image-preview`, `.image-preview-container`.
12. **`RecipeFormPageComponent`:** sygnał `draftImageWarnings`, odczyt i filtrowanie `meta.image_warnings` w `checkAndApplyDraft()`, `dismissDraftImageWarnings()`, nowy plik `draft-image-warnings.messages.ts` (`formatUnreadableImagesMessage`), blok `.draft-image-warning` w szablonie i style (np. na wzór `.error-banner`, kolory `--mat-sys-tertiary-container`).
13. **Testy Vitest** — zaktualizować istniejące (`recipe-new-assist-page.component.spec.ts` używa `imageFile` i mocka `compressToMaxSize`: zamienić asercje na `images()` / `readyImages()`, dodać `compressForAiDraft` do mocka serwisu kompresji, zastubować `URL.createObjectURL` / `revokeObjectURL`) oraz dodać scenariusze z sekcji 12.
14. **Dokumentacja:** zaktualizować `docs/results/project-summary.md` (widok asysty — lista zdjęć, komunikat o pominiętych zdjęciach, PS-100 w „Stanie realizacji") po zakończeniu implementacji. Zmiana nie modyfikuje struktury katalogów określonej w `project.mdc` (nowe pliki trafiają do istniejących katalogów stron), więc sekcja „Project Structure" nie wymaga aktualizacji.
15. **Test manualny:** Android Chrome i/lub iOS Safari (2–3 zdjęcia z aparatu, HEIC z galerii, kompresja, odczyt tekstu po kompresji), smoke na desktopie (picker `multiple`, Ctrl+V, schowek, zmiana kolejności, usuwanie, limit 5, `413`, `402`, nieczytelne zdjęcie → komunikat na formularzu).
16. **Regresja:** tryby „Tekst" i „Link URL", wskaźnik / baner / dialog kredytów `draft`, guard `premiumRoleMatchGuard`, `RecipeImageUploadComponent` (kompresja 2 MB bez zmian), build (`ng build`) i `ng lint`.

### Testy (Vitest) — zakres

| Obszar | Scenariusz |
|---|---|
| Asysta — dodawanie | Wybór 3 plików → 3 elementy w kolejności wyboru, „3 / 5", „Dalej" aktywne po zakończeniu przetwarzania |
| Asysta — metody | Ctrl+V (wiele obrazów), schowek (PS-92), aparat (PS-93) **dopisują** do listy i nie zastępują poprzednich |
| Asysta — kolejność | Placeholdery zachowują kolejność mimo różnego czasu kompresji (mock z opóźnieniami) |
| Asysta — limit | 4 zdjęcia + partia 3 → dodane 1; `limitReached`; brak snackbara; przyciski dodawania `disabled` przy 5 |
| Asysta — walidacja | GIF + poprawne pliki → poprawne dodane, jeden komunikat o formacie; plik > 10 MB odrzucony z `fileTooLarge` |
| Asysta — kompresja | Plik > 1,5 MB trafia do `compressForAiDraft`; `processing` → `ready`; „Dalej" `disabled` w trakcie |
| Asysta — fallback | Oryginał ≤ 10 MB dodany bez komunikatu; > 10 MB odrzucony |
| Asysta — usuwanie | Środkowe usunięte, kolejność zachowana, „2 / 5"; po usunięciu ostatniego „Dalej" `disabled`; `revokeObjectURL` wywołane; usunięcie placeholdera w trakcie kompresji nie tworzy `ObjectURL` |
| Asysta — przesuwanie | Zamiana miejsc, numeracja zaktualizowana; „w lewo" `disabled` dla pierwszego, „w prawo" dla ostatniego |
| Asysta — wskazówka | `hint` widoczny w trybie „Obraz" (stan pusty i z listą) |
| Asysta — żądanie | `buildRequest()` zwraca `images` w kolejności listy (także dla 1 zdjęcia), bez pola `image` |
| Asysta — suma | Suma > 15 MB → `totalTooLarge`, brak wywołania `generateDraft` |
| Asysta — loading | W `isLoading()` dodawanie / usuwanie / przesuwanie / „Dalej" nieaktywne; `analyzing` dla ≥ 2 zdjęć |
| Asysta — błędy | `413` total / per_file → właściwy komunikat; `402` → dialog; błąd modelu → komunikat, lista nienaruszona; `422` → powody |
| Asysta — źródło | Zmiana na „Tekst" / „Link" czyści listę i zwalnia `ObjectURL` |
| A11y | Etykiety „Usuń zdjęcie 2 z 3", „Przesuń zdjęcie…"; `aria-live` na liczniku; fokus po usunięciu / przesunięciu |
| `ImageCompressionService` | `compressForAiDraft` (≤ 1,5 MB bez zmian, większy zmniejszony, błąd → oryginał, guard `blob.type`) |
| `AiRecipeDraftService` | `413` z `details.limit` → `AiDraftPayloadTooLargeError.limit`; brak `details` → `per_file` |
| `RecipeFormPageComponent` | `meta.image_warnings` → komunikat z numerem, zamykany; brak ostrzeżeń → brak bloku; tryb edycji → brak bloku |
| `formatUnreadableImagesMessage` | 1, 2 i 3 numery, pusta lista |
| Regresja | Tryb „Tekst" i „Link URL", wskaźnik i baner kredytów, guard `premium` |

## Ryzyka i wyzwania implementacyjne

| Ryzyko | Rozwiązanie |
|---|---|
| Wyścig kompresji równoległej i kolejności | Placeholdery dopisywane synchronicznie przed `await`; wynik dopasowywany po `id`, nigdy po indeksie |
| Wyciek pamięci (`ObjectURL`) | Centralna funkcja zwalniania wywoływana przy usunięciu, odrzuceniu, zmianie źródła i `DestroyRef.onDestroy`; test na `revokeObjectURL` |
| Zbyt agresywna kompresja zdjęć tekstu (pętla jakości do 0,35 i zmniejszanie do 640 px) może pogorszyć czytelność dla OCR modelu | Przy typowych zdjęciach 2048 px / jakość 0,85 mieści się w ~1,5 MB w pierwszej iteracji; przy problemach na teście manualnym rozdzielić stałą „progu kompresji" od „docelowego rozmiaru" (np. próg 1,5 MB, cel 2,5–3 MB) |
| Safari zwraca PNG zamiast WebP z `canvas.toBlob` | Guard na `blob.type` + fallback JPEG z białym tłem; test manualny iOS |
| HEIC/HEIF | Poza zakresem; odrzucenie jako nieobsługiwany format |
| Utrata fokusu po zmianie kolejności / usunięciu | Jawne ustawianie fokusu po renderze (`afterNextRender`), selektory `data-*` |
| Ctrl+V działa tylko, gdy fokus jest w komponencie | Zachowano `@HostListener('paste')`, aby nie przechwytywać wklejania w globalnej wyszukiwarce; podpowiedź Ctrl+V pod licznikiem |
| Zmiana zachowania „Dalej" (pusty tryb „Obraz" nie prowadzi już do pustego formularza) | Zgodne z kryterium akceptacji (scenariusz 3); pusty formularz dostępny przez „Wróć"; założenie do potwierdzenia z autorem story |
| Długi czas analizy (do 140 s dla 5 zdjęć) | Komunikat `analyzing` (`aria-live`), spinner na „Dalej", akcje zablokowane; brak limitu czasu po stronie UI (timeout wymusza backend) |
| Duże żądanie (JSON z base64 do ok. 20 MB) | Kompresja kliencka + pre-walidacja sumy 15 MB; obsługa `413 total` |
| Migracja istniejących testów (`imageFile`, mock `compressToMaxSize`) | Zaktualizować asercje i mocki w kroku 13 przed refaktorem logiki, by wychwycić regresje PS-92 / PS-93 |
| Lokalizacja formatera komunikatu o pominiętych zdjęciach | Formater w `recipe-form/` (konsument), nie w `recipe-new-assist/` — bez zależności między stronami |
