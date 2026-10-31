# PS-100: Analiza przepisu AI z wielu zdjęć — Plan UI

> **User Story:** PS-100 — Analiza przepisu AI z wielu zdjęć (tryb „Obraz” asysty AI)
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Wymagania (funkcje i taski)

### Funkcje produktowe

| ID | Funkcja | Opis |
|---|---|---|
| F-100-01 | Lista zdjęć w trybie „Obraz” | `RecipeNewAssistPageComponent` (`/recipes/new/assist`): zamiast jednego zdjęcia — lista 1–5 miniatur w kolejności dodania, z licznikiem „X / 5”. |
| F-100-02 | Dopisywanie wielu zdjęć naraz | Przycisk „Dodaj zdjęcia” otwiera picker plików z atrybutem `multiple` (bez `capture`). |
| F-100-03 | Dopisywanie wszystkimi metodami | Wybór plików, Ctrl+V, „Wklej ze schowka” (PS-92), „Zrób zdjęcie” (PS-93) **dopisują** zdjęcie na koniec listy, nie zastępują poprzednich. |
| F-100-04 | Jedno wejście dla źródeł | Wszystkie metody wywołują jedną metodę `addFiles(files: File[])` — kolejne źródła (np. drag & drop z PS-59) dołączą bez przebudowy. |
| F-100-05 | Limit 5 zdjęć | Nadmiarowe pliki z partii są pomijane, inline komunikat o limicie; przyciski dodawania nieaktywne przy 5 zdjęciach; bez snackbara. |
| F-100-06 | Walidacja plików | Zły format / > 10 MB → ten sam komunikat inline co dotychczas; poprawne pliki z tej samej partii są dodawane. |
| F-100-07 | Kompresja kliencka | Zdjęcia > ~1,5 MB zmniejszane (dłuższy bok ≤ 2048 px, JPEG/WebP, jakość ~0,85); stan ładowania na miniaturze; „Dalej” nieaktywne w trakcie; fallback na oryginał przy błędzie kompresji. |
| F-100-08 | Usuwanie zdjęcia | Przycisk „Usuń zdjęcie” na miniaturze; po usunięciu ostatniego „Dalej” nieaktywne. |
| F-100-09 | Zmiana kolejności | Strzałki „Przesuń w lewo / w prawo”; skrajne pozycje mają odpowiednią strzałkę nieaktywną; numeracja „Zdjęcie k z N” aktualizowana. |
| F-100-10 | Wskazówka o jednym przepisie | Stała wskazówka w trybie „Obraz”: wszystkie zdjęcia dotyczą tego samego przepisu i są dodawane w kolejności stron. |
| F-100-11 | Wysyłka w kolejności listy | Jedno żądanie `POST /ai/recipes/draft` z `images` (zawsze, także dla 1 zdjęcia) w kolejności widocznej na liście. |
| F-100-12 | Obsługa błędów API | `413` (per plik / łącznie) → komunikat inline z sugestią usunięcia zdjęć; `402` → istniejący dialog; błąd modelu / `422` → dotychczasowe komunikaty, lista zdjęć nienaruszona, możliwa ponowna próba. |
| F-100-13 | Stan ładowania | W `isLoading()` dodawanie, usuwanie, przesuwanie i ponowne „Dalej” są nieaktywne; dla ≥ 2 zdjęć komunikat „Analizuję zdjęcia… to może potrwać do minuty”. |
| F-100-14 | Ostrzeżenie o nieczytelnych zdjęciach | Po przejściu do formularza `/recipes/new` — inline, zamykany komunikat informacyjny o pominiętych zdjęciach (`meta.image_warnings`). PS-91 nie dodał UI dla `meta.warnings`, więc wprowadzamy minimalny element ograniczony do ostrzeżeń o zdjęciach. |
| F-100-15 | Dostępność | Etykiety ARIA z numerem i liczbą zdjęć, obsługa klawiaturą, widoczny fokus, `aria-live` dla licznika i błędów. |
| F-100-16 | Gating bez zmian | `premiumRoleMatchGuard`, wskaźnik i baner kredytów `draft`, dialog `402` — bez zmian. |

### Taski implementacyjne

- [ ] Rozszerzyć `ImageCompressionService` (istnieje w `src/app/shared/services/`) o metodę `compressForAiDraft(file)` z fallbackiem na oryginał oraz stałe progu.
- [ ] Dodać stałe i komunikaty listy zdjęć asysty (`ai-draft-images.constants.ts`, `ai-draft-images.messages.ts` w `recipe-new-assist/`).
- [ ] Przebudować stan komponentu asysty: lista `AssistImageItem` zamiast `imageFile` + `imagePreviewUrl`.
- [ ] Zaimplementować `addFiles`, `removeImage`, `moveImage`, zwolnienie `ObjectURL` (usuwanie, zmiana źródła, `ngOnDestroy`).
- [ ] Zmienić szablon trybu „Obraz”: siatka miniatur, licznik, wskazówka, przyciski „Dodaj zdjęcia” / „Wklej ze schowka” / „Zrób zdjęcie”, ukryty `input[type=file][multiple]`.
- [ ] Podpiąć Ctrl+V (wszystkie obrazy ze zdarzenia), schowek PS-92 i aparat PS-93 pod `addFiles`.
- [ ] Zmienić `buildRequest()` na `images[]` (kolejność zachowana) oraz pre-walidację sumy rozmiarów przed wysyłką.
- [ ] Rozszerzyć `AiRecipeDraftService` i `AiDraftPayloadTooLargeError` o `limit` (`per_file` / `total`) i parsowanie ciała `413`.
- [ ] Zaktualizować typy w `shared/contracts/types.ts` (`images`, `image_warnings`).
- [ ] Zapisać `meta` draftu i wyświetlić inline komunikat o pominiętych zdjęciach w `RecipeFormPageComponent`.
- [ ] Style: siatka miniatur, stan ładowania miniatury, responsywność (mobile).
- [ ] Testy Vitest (sekcja 12) i test manualny na urządzeniu mobilnym (Android Chrome i/lub iOS Safari) + smoke desktop.

---

## 2. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeNewAssistPageComponent` (ts/html/scss) | **Modyfikacja** (główna) | `src/app/pages/recipes/recipe-new-assist/` |
| Stałe i komunikaty listy zdjęć | **Nowe** | `src/app/pages/recipes/recipe-new-assist/ai-draft-images.constants.ts`, `ai-draft-images.messages.ts` |
| `ImageCompressionService` + stałe | **Modyfikacja** | `src/app/shared/services/image-compression.service.ts`, `image-compression.constants.ts` |
| `AiRecipeDraftService` | **Modyfikacja** (413 z `details`) | `src/app/pages/recipes/services/ai-recipe-draft.service.ts` |
| Kontrakty `AiRecipeDraftRequestDto`, `AiRecipeDraftMetaDto` | **Modyfikacja** | `shared/contracts/types.ts` |
| `RecipeDraftStateService` | Bez zmian kodu (przechowuje już `meta`) | `src/app/pages/recipes/services/recipe-draft-state.service.ts` |
| `RecipeFormPageComponent` (ts/html/scss) | **Modyfikacja** (komunikat o pominiętych zdjęciach) | `src/app/pages/recipes/recipe-form/` |
| `CameraCaptureButtonComponent`, `ClipboardImageService` | **Bez zmian** | `src/app/shared/...` |
| Testy jednostkowe | **Nowe / rozszerzone** | specyfikacje asysty, serwisu kompresji, serwisu draftu, formularza |
| Trasy / guardy | **Bez zmian** | `/recipes/new/assist`, `/recipes/new` |

**Poza zakresem PS-100:** `RecipeImageUploadComponent` (zdjęcie dania w formularzu), zapis obrazów w Storage, drag & drop plików (PS-59 — backlog) i drag & drop miniatur, obsługa HEIC/HEIF, rozpoznawanie wielu różnych przepisów, zmiana gatingu ról.

**Znane ograniczenie (HEIC/HEIF):** format nie jest obsługiwany. Safari na iOS zwykle konwertuje HEIC do JPEG przy wyborze z galerii; plik HEIC, który nie zostanie skonwertowany, jest odrzucany tym samym komunikatem o nieobsługiwanym formacie (PNG, JPG, WebP). Punkt testu manualnego na iOS Safari.

---

## 3. Model stanu komponentu asysty

### Stałe (`ai-draft-images.constants.ts`)

```typescript
/** Maks. liczba zdjęć w jednej analizie (spójne z backendem). */
export const AI_DRAFT_MAX_IMAGES = 5;

/** Maks. rozmiar jednego zdjęcia (po kompresji) — spójne z backendem. */
export const AI_DRAFT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** Maks. łączny rozmiar zdjęć — spójne z backendem. */
export const AI_DRAFT_MAX_TOTAL_IMAGES_BYTES = 15 * 1024 * 1024;
```

Wartości trzymane **w jednym miejscu** po stronie frontendu (limit 10 MB nadal zgodny z `CLIPBOARD_IMAGE_MAX_BYTES` — jedno źródło prawdy: stała `AI_DRAFT_MAX_IMAGE_BYTES` może re-eksportować istniejącą wartość).

### Element listy

```typescript
interface AssistImageItem {
    /** Stabilny identyfikator (track w @for, kotwica fokusu) */
    id: string;
    /** `null` w czasie przetwarzania (kompresji) */
    file: File | null;
    /** `URL.createObjectURL(file)`; `null` w czasie przetwarzania */
    previewUrl: string | null;
    status: 'processing' | 'ready';
}
```

### Sygnały i computed

| Nazwa | Typ | Opis |
|---|---|---|
| `images` | `signal<AssistImageItem[]>([])` | Zastępuje `imageFile` i `imagePreviewUrl` |
| `imageMessages` | `signal<string[]>([])` | Komunikaty inline z dodawania partii (format, rozmiar, limit); deduplikowane |
| `imageCount` | computed | `images().length` (liczy też elementy w przetwarzaniu — rezerwują miejsce w limicie) |
| `readyImages` | computed | Elementy `status === 'ready'` |
| `isProcessingImages` | computed | Istnieje element `processing` |
| `isImageLimitReached` | computed | `imageCount() >= AI_DRAFT_MAX_IMAGES` |
| `canAddImages` | computed | `!isLoading() && !isImageLimitReached()` |
| `hasAiInput` | computed (zmiana) | Dla `source === 'image'`: `readyImages().length > 0` |
| `isNextDisabled` | computed (zmiana) | Dotychczasowe warunki **lub** `isProcessingImages()` |
| `imageCounterLabel` | computed | `"{imageCount} / 5"` |

Istniejące sygnały `errorMessage` i `unprocessableReasons` zostają dla błędów API (`413`, `422`, ogólnych).

### Czyszczenie

- `onSourceChange` na `text` / `url` → `clearAllImages()` (zwalnia `ObjectURL`, czyści `imageMessages`).
- `ngOnDestroy` (lub `DestroyRef`) → zwolnienie wszystkich `ObjectURL`.
- `onNext` kończy się błędem → lista zdjęć **nie jest** czyszczona (ponowna próba bez ponownego dodawania).

---

## 4. Dodawanie zdjęć — jedno wejście `addFiles(files: File[])`

Wszystkie źródła (picker `multiple`, Ctrl+V, schowek, aparat) wywołują tę metodę.

```typescript
async addFiles(files: File[]): Promise<void> {
    if (this.isLoading() || files.length === 0) {
        return;
    }

    this.clearError();
    const messages = new Set<string>();
    const accepted: AssistImageItem[] = [];
    let skippedOverLimit = 0;

    for (const file of files) {
        // 1. Limit: miejsce zajmują także elementy w przetwarzaniu
        if (this.imageCount() + accepted.length >= AI_DRAFT_MAX_IMAGES) {
            skippedOverLimit++;
            continue;
        }

        // 2. Format
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            messages.add(CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat);
            continue;
        }

        // 3. Placeholder rezerwuje pozycję w kolejności (przetwarzanie równoległe,
        //    kolejność wynika z kolejności dodania, nie z czasu zakończenia kompresji)
        accepted.push({ id: crypto.randomUUID(), file: null, previewUrl: null, status: 'processing' });
        // ... dopisanie placeholdera do images() i uruchomienie przetwarzania pliku
    }

    if (skippedOverLimit > 0) {
        messages.add(AI_DRAFT_IMAGES_UI_MESSAGES.limitReached);
    }
    // 4. Dla każdego placeholdera (równolegle):
    //    a) file = await imageCompression.compressForAiDraft(file)   // nigdy nie rzuca
    //    b) jeśli file.size > AI_DRAFT_MAX_IMAGE_BYTES → usuń placeholder + komunikat fileTooLarge
    //    c) w przeciwnym razie podmień placeholder: file, previewUrl = URL.createObjectURL(file), status 'ready'
    // 5. imageMessages.set([...messages])
}
```

Reguły:

- Kolejność w liście = kolejność plików w partii oraz kolejność partii (nowe zawsze na końcu).
- Odrzucony plik nie zajmuje miejsca w liście ani w liczniku; poprawne pliki z tej samej partii są dodawane.
- Komunikaty są deduplikowane (np. 3 pliki GIF → jeden komunikat o formacie).
- Brak snackbara — wszystkie komunikaty inline.
- Jeśli po dodaniu partii lista ma 5 zdjęć, przyciski dodawania stają się nieaktywne.

### Źródła

| Źródło | Zmiana |
|---|---|
| „Dodaj zdjęcia” | Nowy przycisk + ukryty `<input type="file" multiple accept="image/png,image/jpeg,image/webp">` (bez `capture`); po `change` → `addFiles(Array.from(input.files))`, następnie `input.value = ''` |
| Ctrl+V (`@HostListener('paste')`) | Zbiera **wszystkie** obsługiwane obrazy ze zdarzenia → `addFiles`; logika `sawUnsupportedImage` / `noImage` jak dotychczas; przy limicie pokazuje komunikat o limicie |
| „Wklej ze schowka” (PS-92) | `readImageFile()` → `addFiles([file])` (dopisuje); dotychczasowe mapowanie błędów schowka |
| „Zrób zdjęcie” (PS-93) | `onCameraFileSelected(file)` → `addFiles([file])` |
| Drag & drop (PS-59) | **Poza zakresem**; zarejestruje się jako kolejne źródło wywołujące `addFiles` |

### Kompresja (`ImageCompressionService`)

`ImageCompressionService.compressToMaxSize(file, maxBytes)` już istnieje (dłuższy bok ≤ 2048 px, iteracyjnie malejąca jakość od 0,85, PNG → WebP). Zmiany:

- Nowa stała w `image-compression.constants.ts`: `AI_DRAFT_IMAGE_COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024`.
- Nowa metoda:

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

- Pliki ≤ ~1,5 MB nie są przetwarzane (zwracane bez zmian).
- **Safari:** `canvas.toBlob(…, 'image/webp')` na iOS/Safari może zwrócić PNG. W `renderToBlob` dodać guard: gdy `blob.type !== mimeType`, traktować próbę jako nieudaną (a dla źródła PNG spróbować `image/jpeg` z białym tłem przed `drawImage`). Punkt testu manualnego na iOS Safari.
- Dotychczasowy wyjątek `ImageCompressionError` z asysty (komunikat `compressionFailed` blokujący dodanie zdjęcia) znika dla ścieżki asysty: błąd kompresji → oryginał; jeśli oryginał > 10 MB → odrzucenie komunikatem `fileTooLarge`.

---

## 5. Zarządzanie listą

### Usuwanie

```typescript
removeImage(id: string): void {
    if (this.isLoading()) {
        return;
    }
    // zwolnij ObjectURL, usuń element, zachowaj względną kolejność pozostałych
    // po usunięciu: ustaw fokus na przycisk „Usuń” kolejnego elementu,
    // a gdy nie ma kolejnych — na poprzedni lub na „Dodaj zdjęcia”
    this.clearError();
}
```

### Zmiana kolejności

```typescript
moveImage(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (this.isLoading() || target < 0 || target >= this.images().length) {
        return;
    }
    // zamiana miejscami w images(); fokus pozostaje na przycisku przesuniętego elementu
}
```

- „Przesuń w lewo” nieaktywne dla pierwszego, „Przesuń w prawo” dla ostatniego elementu.
- W trakcie `isLoading()` usuwanie i przesuwanie są nieaktywne; w trakcie kompresji innych miniatur dozwolone (elementy mają stabilne `id`).
- Etykieta „Zdjęcie k z N” wynika z aktualnego indeksu (computed w szablonie).

---

## 6. Szablon — tryb „Obraz”

### Wskazówka (zawsze widoczna w trybie „Obraz”)

Pod przełącznikiem źródła, nad strefą obrazu:

> „Wszystkie zdjęcia powinny dotyczyć tego samego przepisu. Dodawaj je w kolejności stron.”

Ikona `info`, ten sam styl co istniejący `.info-hint`.

### Stan pusty (0 zdjęć)

Istniejąca strefa wklejania (`.image-paste-area`) zostaje; zmiany:

- Format: „Obsługiwane formaty: PNG, JPEG, WebP (max 10 MB na zdjęcie, do 5 zdjęć)”.
- `.upload-actions`: **[ Dodaj zdjęcia ]  [ Wklej ze schowka ]  [ Zrób zdjęcie ]**.

```
┌──────────────────────────────────────────────┐
│                [ content_paste ]             │
│            Wklej obraz przepisu              │
│        Kliknij tutaj i użyj Ctrl + V         │
│  PNG, JPEG, WebP (max 10 MB, do 5 zdjęć)     │
│                                              │
│  [ 🖼 Dodaj zdjęcia ] [ 📋 Wklej ] [ 📷 Zrób ] │
└──────────────────────────────────────────────┘
```

### Stan z zdjęciami (≥ 1)

```
ⓘ Wszystkie zdjęcia powinny dotyczyć tego samego przepisu. Dodawaj je w kolejności stron.

┌───────────┐  ┌───────────┐  ┌───────────┐
│ [podgląd] ✕│  │ [podgląd] ✕│  │    ⟳     ✕│
│           │  │           │  │ (przetw.) │
│  ◀  1  ▶  │  │  ◀  2  ▶  │  │           │
└───────────┘  └───────────┘  └───────────┘
 Zdjęcie 1 z 3  Zdjęcie 2 z 3  Zdjęcie 3 z 3

Zdjęcia: 3 / 5
[ Dodaj zdjęcia ]  [ Wklej ze schowka ]  [ Zrób zdjęcie ]
```

Struktura:

- Kontener: `<ul class="image-list" role="list">`, elementy `<li class="image-item">`, `@for (item of images(); track item.id; let i = $index; let n = $count)`.
- Miniatura: `<img [src]="item.previewUrl" [alt]="'Zdjęcie ' + (i + 1) + ' z ' + n">`, `object-fit: cover`.
- Przycisk usuwania (`mat-mini-fab`, ikona `close`, kolor `warn`) w rogu miniatury.
- Wiersz sterowania pod miniaturą: `mat-icon-button` `chevron_left` · etykieta „Zdjęcie k z N” · `mat-icon-button` `chevron_right`.
- Element w przetwarzaniu: `mat-spinner` (średnica 28) w miejscu podglądu, `aria-busy="true"`, przyciski przesuwania nieaktywne; przycisk „Usuń” aktywny (usuwa placeholder i anuluje wynik).
- Licznik: `<p class="image-counter" aria-live="polite">Zdjęcia: {{ imageCounterLabel() }}</p>`.
- Akcje (`.image-preview-actions`): „Dodaj zdjęcia”, „Wklej ze schowka”, `pych-camera-capture-button` — wszystkie `[disabled]="!canAddImages()"` (schowek dodatkowo `|| !clipboardSupported`, z istniejącym tooltipem).
- Przy limicie 5 przyciski dodawania są nieaktywne, a pod nimi pojawia się komunikat o limicie (jeśli wynika z odrzucenia partii) lub krótka informacja „Osiągnięto limit 5 zdjęć”.

### Komunikaty inline

Istniejący `.error-container`:

- `imageMessages()` jako lista (`role="alert"`), potem `errorMessage()` i `unprocessableReasons()` jak dotąd.
- Brak snackbara.

### Stan ładowania

- Całość strefy zdjęć w stanie `disabled` (klasa `.loading` na kontenerze już istnieje).
- Gdy `isLoading()` i `readyImages().length > 1`: pod listą `<p aria-live="polite">Analizuję zdjęcia… to może potrwać do minuty.</p>` (z `mat-icon` lub spinnerem nagłówkowym przycisku „Dalej”).

### Style (`recipe-new-assist-page.component.scss`)

```
.image-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 16px;
    padding: 0;
    margin: 0 0 16px;
    list-style: none;
}
.image-item { position: relative; display: flex; flex-direction: column; gap: 8px; }
.image-item img { width: 100%; aspect-ratio: 3 / 4; object-fit: cover; border-radius: 8px; }
.image-item.processing .image-thumb { display: grid; place-items: center; }
```

- Mobile (≤ 600 px): `minmax(104px, 1fr)`, przyciski dodawania w kolumnie na pełną szerokość (`flex-direction: column; width: 100%`), jak w `.upload-actions` z PS-93.
- Widoczny fokus (`:focus-visible`) na przyciskach miniatury; cele dotykowe ≥ 40 px.

---

## 7. Komunikaty (`ai-draft-images.messages.ts`)

| Klucz | Treść |
|---|---|
| `addImages` | „Dodaj zdjęcia” |
| `limitReached` | „Można dodać maksymalnie 5 zdjęć — nadmiarowe pliki zostały pominięte.” |
| `limitInfo` | „Osiągnięto limit 5 zdjęć.” |
| `analyzing` | „Analizuję zdjęcia… to może potrwać do minuty.” |
| `hint` | „Wszystkie zdjęcia powinny dotyczyć tego samego przepisu. Dodawaj je w kolejności stron.” |
| `totalTooLarge` | „Łączny rozmiar zdjęć jest zbyt duży (max 15 MB). Usuń część zdjęć i spróbuj ponownie.” |
| `perFileTooLarge` | „Jedno ze zdjęć jest zbyt duże. Maksymalny rozmiar to 10 MB.” |
| `unreadableImage(k)` | „Zdjęcie {k} było nieczytelne i zostało pominięte. Sprawdź, czy w przepisie niczego nie brakuje.” |

Istniejące (bez zmian): `CLIPBOARD_IMAGE_UI_MESSAGES.unsupportedFormat`, `fileTooLarge`, komunikaty schowka.

Etykiety ARIA (funkcje w szablonie): „Usuń zdjęcie {k} z {N}”, „Przesuń zdjęcie {k} z {N} w lewo”, „Przesuń zdjęcie {k} z {N} w prawo”, „Dodaj zdjęcia z dysku”.

---

## 8. Wysyłka i obsługa błędów

### `buildRequest()` (tryb obrazu)

```typescript
const ready = this.readyImages();
const images = await Promise.all(
    ready.map(async (item) => ({
        mime_type: item.file!.type as AiRecipeDraftImageMimeType,
        data_base64: await this.fileToBase64(item.file!),
    })),
);

return {
    source: 'image',
    images,                       // zawsze `images`, także dla jednego zdjęcia
    output_format: 'pycha_recipe_draft_v1',
    language: 'pl',
};
```

`Promise.all` zachowuje kolejność wejścia — kolejność żądania = kolejność listy.

**Pre-walidacja sumy:** przed wysyłką suma `file.size` > `AI_DRAFT_MAX_TOTAL_IMAGES_BYTES` → komunikat `totalTooLarge` inline, bez żądania do API.

### `AiRecipeDraftService`

- `AiDraftPayloadTooLargeError` otrzymuje pole `limit: 'per_file' | 'total'`; komunikat zależy od limitu (`perFileTooLarge` / `totalTooLarge`).
- `handleErrorResponse` dla `413` czyta ciało (`response.json().catch(() => ({}))`), odczytuje `details.limit`; brak `details` → traktuje jak `per_file`.
- `400 VALIDATION_ERROR` dla kształtu żądania nie występuje przy poprawnym UI (UI zawsze wysyła `images` w zakresie 1–5).

### Mapowanie błędów

| Odpowiedź API | UI |
|---|---|
| `413` `details.limit = total` | Inline: „Łączny rozmiar zdjęć jest zbyt duży… Usuń część zdjęć…”; lista nienaruszona |
| `413` `details.limit = per_file` | Inline: „Jedno ze zdjęć jest zbyt duże…”; lista nienaruszona |
| `402 AI_CREDITS_EXHAUSTED` | Istniejący `AiCreditsExhaustedDialogComponent` + odświeżenie kredytów (bez zmian) |
| `422` | Istniejący komunikat + lista powodów (np. „Żadne ze zdjęć nie było czytelne.”); formularz nie jest wypełniany |
| `429`, `500`, `502`, `504` | Dotychczasowe komunikaty; lista zdjęć nienaruszona, ponowna próba możliwa |

Po udanej analizie: `creditsService.refreshCredits()` (jeden kredyt) i `draftStateService.setDraft(response.draft, response.meta)` — jak dotąd.

---

## 9. Komunikat o pominiętych zdjęciach na formularzu (`/recipes/new`)

PS-91 nie dodał UI dla `meta.warnings`. PS-100 wprowadza **minimalny** element ograniczony do ostrzeżeń o zdjęciach (`meta.image_warnings`):

- `RecipeFormPageComponent.checkAndApplyDraft()` odczytuje `draftData.meta.image_warnings` (stan zwraca już `consumeDraft()`) i zapisuje wynik w sygnale `draftImageWarnings: signal<number[]>` (numery zdjęć).
- Szablon: na górze formularza (tylko w trybie tworzenia, gdy sygnał niepusty) inline blok informacyjny:
  - `role="status"`, ikona `warning_amber`, tekst z `unreadableImage(k)` dla każdego numeru (lub zbiorczo: „Zdjęcia 2 i 3 były nieczytelne i zostały pominięte.”),
  - przycisk „Zamknij” (`mat-icon-button` z `aria-label="Zamknij komunikat o pominiętych zdjęciach"`) czyszczący sygnał.
- Komunikat nie blokuje edycji i znika po zamknięciu lub opuszczeniu strony; nie jest zapisywany.
- Pozostałe wpisy `meta.warnings` (np. korekty metadanych PS-91) **nadal nie mają UI** — bez zmian względem PS-91.

---

## 10. Dostępność i klawiatura

- Wszystkie przyciski (dodawanie, usuwanie, przesuwanie) są natywnymi `<button>` osiągalnymi z klawiatury, z widocznym fokusem.
- Etykiety ARIA zawierają numer i liczbę zdjęć, aktualizowane po zmianie kolejności i usunięciu.
- `aria-live="polite"` na liczniku i komunikacie „Analizuję zdjęcia…”; `role="alert"` na kontenerze błędów.
- Zarządzanie fokusem: po usunięciu → kolejny/poprzedni element lub „Dodaj zdjęcia”; po przesunięciu → przycisk przesuniętego elementu.
- Miniatura w trakcie przetwarzania ma `aria-busy="true"`; po zakończeniu liczba zdjęć jest ogłaszana przez licznik.
- Przyciski nieaktywne w `isLoading()` ustawiają atrybut `disabled` (nie tylko styl).

---

## 11. Historyjka użytkownika (szczegółowa)

**Jako** użytkownik z premium, który sfotografował telefonem trzy strony książki kucharskiej,  
**chcę** wgrać wszystkie trzy zdjęcia naraz i dostać jeden wspólny draft,  
**aby** nie łączyć ręcznie składników, kroków i wskazówek rozłożonych na kilku stronach.

**Kroki:**

1. Użytkownik loguje się jako `premium` i otwiera `/recipes/new/assist`, wybiera tryb „Obraz”.
2. Widzi wskazówkę o jednym przepisie i kolejności stron oraz przyciski „Dodaj zdjęcia”, „Wklej ze schowka”, „Zrób zdjęcie”.
3. Klika „Dodaj zdjęcia” i wybiera 3 pliki z galerii. Duże zdjęcia chwilę pokazują spinner (kompresja), po czym pojawiają się miniatury w kolejności wyboru; licznik pokazuje „3 / 5”.
4. Zauważa, że druga i trzecia strona są zamienione — klika „Przesuń w lewo” przy zdjęciu 3.
5. Opcjonalnie dodaje czwarte zdjęcie aparatem („Zrób zdjęcie”); trafia na koniec listy („4 / 5”).
6. Klika „Dalej”. Przycisk pokazuje spinner, widoczny jest komunikat „Analizuję zdjęcia…”, akcje na liście są nieaktywne.
7. Aplikacja przechodzi do `/recipes/new` z jednym połączonym draftem (nazwa, składniki, kroki, wskazówki, metadane); pobrany jest 1 kredyt `draft`.
8. Jeśli jedno zdjęcie było nieczytelne, na górze formularza widać komunikat o pominiętym zdjęciu.
9. Alternatywy: przekroczenie limitu → komunikat inline; `413` → komunikat z sugestią usunięcia zdjęć; `402` → dialog wyczerpania kredytów; błąd modelu → komunikat, lista zdjęć zostaje.

---

## 12. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| Asysta — dodawanie | Wybór 3 plików → 3 elementy w kolejności wyboru, licznik „3 / 5”, „Dalej” aktywne po zakończeniu przetwarzania |
| Asysta — metody | Ctrl+V, schowek (PS-92), aparat (PS-93) **dopisują** do listy i nie zastępują poprzednich |
| Asysta — kolejność | Placeholdery zachowują kolejność mimo różnego czasu kompresji (mock serwisu z opóźnieniami) |
| Asysta — limit | 4 zdjęcia + partia 3 → dodane 1; komunikat o limicie; brak snackbara; przyciski dodawania disabled przy 5 |
| Asysta — walidacja | Partia z GIF + poprawnymi plikami → poprawne dodane, komunikat o formacie; plik > 10 MB odrzucony z `fileTooLarge`; komunikaty deduplikowane |
| Asysta — kompresja | Plik > 1,5 MB trafia do `compressForAiDraft`; miniatura `processing` → `ready`; „Dalej” disabled w trakcie |
| Asysta — fallback | `compressForAiDraft` zwraca oryginał ≤ 10 MB → zdjęcie dodane bez komunikatu; oryginał > 10 MB → odrzucone |
| Asysta — usuwanie | Usunięcie środkowego zachowuje kolejność, licznik „2 / 5”; po usunięciu ostatniego „Dalej” disabled; zwolnienie `ObjectURL` |
| Asysta — przesuwanie | Zamiana miejsc, numeracja „Zdjęcie k z N” zaktualizowana; „w lewo” disabled dla pierwszego, „w prawo” dla ostatniego |
| Asysta — wskazówka | Wskazówka o jednym przepisie widoczna w trybie „Obraz” (stan pusty i z listą) |
| Asysta — żądanie | `buildRequest()` zwraca `images` w kolejności listy (także dla 1 zdjęcia), bez pola `image` |
| Asysta — suma | Suma > 15 MB → komunikat `totalTooLarge`, brak wywołania API |
| Asysta — loading | W `isLoading()` dodawanie / usuwanie / przesuwanie / „Dalej” nieaktywne; komunikat „Analizuję zdjęcia…” dla ≥ 2 zdjęć |
| Asysta — błędy | `413` total/per_file → właściwy komunikat; `402` → dialog; błąd modelu → komunikat, lista nienaruszona; `422` → powody |
| Asysta — źródło | Zmiana na „Tekst” / „Link” czyści listę i zwalnia `ObjectURL` |
| A11y | Etykiety ARIA „Usuń zdjęcie 2 z 3”, „Przesuń zdjęcie…”; `aria-live` na liczniku |
| `ImageCompressionService` | `compressForAiDraft`: plik ≤ 1,5 MB zwracany bez zmian; większy zmniejszony; błąd canvas → oryginał; guard na `blob.type` (Safari) |
| `AiRecipeDraftService` | `413` z `details.limit` → `AiDraftPayloadTooLargeError.limit`; brak `details` → `per_file` |
| `RecipeFormPageComponent` | Draft z `meta.image_warnings` → komunikat z numerem zdjęcia, zamykany; bez ostrzeżeń → brak komunikatu |
| Regresja | Tryb „Tekst” i „Link URL” bez zmian; wskaźnik i baner kredytów; guard `premium` |

Testy E2E (Playwright): opcjonalne. **Wymagany test manualny** na urządzeniu mobilnym (Android Chrome i/lub iOS Safari) z 2–3 zdjęciami z aparatu oraz smoke na desktopie (DoD user story).

---

## 13. Checklist implementacji (UI)

- [ ] `compressForAiDraft` + stała progu + guard Safari + testy
- [ ] Stałe i komunikaty listy zdjęć (`ai-draft-images.*`)
- [ ] Stan `images` / `imageMessages` i computed; usunięcie starych `imageFile` / `imagePreviewUrl`
- [ ] `addFiles` (limit, walidacja, placeholdery, kompresja, deduplikacja komunikatów)
- [ ] Podpięcie Ctrl+V (wiele obrazów), „Dodaj zdjęcia” (`multiple`), schowka PS-92, aparatu PS-93
- [ ] `removeImage`, `moveImage`, zarządzanie fokusem, zwolnienie `ObjectURL`
- [ ] Szablon: wskazówka, siatka miniatur, licznik, stany `processing` / `disabled`, komunikat „Analizuję zdjęcia…”
- [ ] `buildRequest()` z `images` + pre-walidacja sumy
- [ ] `AiRecipeDraftService`: `413` z `details`; typy w `shared/contracts/types.ts`
- [ ] Komunikat o pominiętych zdjęciach w `RecipeFormPageComponent`
- [ ] Style desktop i mobile
- [ ] Testy Vitest z sekcji 12
- [ ] Test manualny: Android Chrome / iOS Safari (2–3 zdjęcia z aparatu, HEIC, kompresja) + smoke desktop
- [ ] Regresja: tryby „Tekst” i „Link URL”, gating ról, kredyty
