# PS-93: Zrobienie zdjęcia aparatem urządzenia mobilnego — Plan UI

> **User Story:** PS-93 — Zrobienie zdjęcia aparatem w formularzu przepisu i w asyście AI (tryb obrazu)
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Wymagania (funkcje i taski)

### Funkcje produktowe

| ID | Funkcja | Opis |
|---|---|---|
| F-93-01 | Przycisk „Zrób zdjęcie” w formularzu | W `RecipeImageUploadComponent` (`/recipes/new`, `/recipes/:id/edit`): uruchomienie systemowego aparatu przez ukryty input z `capture="environment"`. |
| F-93-02 | Przycisk „Zrób zdjęcie” w asyście AI | W trybie obrazu `RecipeNewAssistPageComponent` (`/recipes/new/assist`): ten sam wzorzec UX co formularz. |
| F-93-03 | Wspólny komponent | `CameraCaptureButtonComponent` w `shared` — ukryty input + `mat-stroked-button`, emit `fileSelected: File` po walidacji w rodzicu lub przekazanie surowego pliku do istniejącego handlera. |
| F-93-04 | Osobny input od pickera galerii | Input aparatu **z** `capture`; istniejący input strefy drop / „Zmień zdjęcie” **bez** `capture`. |
| F-93-05 | Spójna walidacja | Po `change`: ten sam path co wybór pliku — `processFile()` (formularz) / `handleImageFile()` (asysta); komunikaty inline jak przy paste/pliku. |
| F-93-06 | Anulowanie aparatu | Pusty wybór / anulowanie dialogu — brak zmiany podglądu, brak komunikatu błędu. |
| F-93-07 | Stany disabled | Przycisk nieaktywny gdy `disabled`, `isUploading` (formularz) lub `isLoading()` (asysta). |
| F-93-08 | Widoczność | Przycisk na **desktopie i mobile** (fallback do pickera plików akceptowalny). |
| F-93-09 | Współistnienie metod | Paste, D&D, schowek (PS-92), wybór pliku i aparat — bez regresji; ostatni zaakceptowany plik wygrywa. |

### Taski implementacyjne

- [ ] Dodać `CameraCaptureButtonComponent` (`src/app/shared/components/camera-capture-button/` lub analogiczna ścieżka w `shared`).
- [ ] Zintegrować komponent w `recipe-image-upload.component.html` (drop zone + sekcja `image-actions` przy podglądzie).
- [ ] Zintegrować w `recipe-new-assist-page.component.html` (stan pusty + akcje przy podglądzie obrazu).
- [ ] Style: kontener `.upload-actions` / `.image-preview-actions` z `display: flex; flex-wrap: wrap; gap` — na wąskim ekranie przyciski pełnej szerokości lub kolumna.
- [ ] Testy Vitest: komponent aparatu (emit pliku, brak emit przy pustym `files`), integracja w `RecipeImageUploadComponent` i asyście.
- [ ] Test manualny: Android Chrome i/lub iOS Safari + smoke desktop.

---

## 2. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `CameraCaptureButtonComponent` | **Nowy** | `src/app/shared/components/camera-capture-button/` |
| `RecipeImageUploadComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-form/components/recipe-image-upload/` |
| `RecipeNewAssistPageComponent` | **Modyfikacja** | `src/app/pages/recipes/recipe-new-assist/` |
| Testy jednostkowe | **Nowe / rozszerzone** | `camera-capture-button.component.spec.ts`, rozszerzenie speców uploadu i asysty |
| Trasy / guardy | **Bez zmian** | `/recipes/new`, `/recipes/:id/edit`, `/recipes/new/assist` |

**Poza zakresem PS-93:** własny podgląd wideo kamery w aplikacji, zmiany API, drag & drop do asysty (PS-59), ukrywanie przycisku na desktopie.

---

## 3. `CameraCaptureButtonComponent` (współdzielony)

### API komponentu (propozycja)

```typescript
@Component({
    selector: 'pych-camera-capture-button',
    standalone: true,
    // MatButton, MatIcon, MatTooltipModule — tooltip nieużywany (przycisk zawsze aktywny poza disabled input)
})
export class CameraCaptureButtonComponent {
    /** Wyłącza klik i input (upload w toku, disabled formularza) */
    disabled = input(false);

    /** Opcjonalna klasa CSS na przycisku */
    buttonClass = input<string>('');

    /** Po wyborze pliku z aparatu / pickera (rodzic waliduje) */
    fileSelected = output<File>();

    protected onInputChange(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = ''; // umożliwia ponowne zrobienie tego samego zdjęcia
        if (!file) return; // anulowanie — brak emit
        this.fileSelected.emit(file);
    }
}
```

### Szablon

```html
<input
    type="file"
    class="file-input visually-hidden"
    accept="image/jpeg,image/png,image/webp"
    capture="environment"
    [disabled]="disabled()"
    (change)="onInputChange($event)"
    #cameraInput
/>
<button
    mat-stroked-button
    type="button"
    [class]="buttonClass()"
    aria-label="Zrób zdjęcie aparatem urządzenia"
    [disabled]="disabled()"
    (click)="cameraInput.click(); $event.stopPropagation()"
>
    <mat-icon>photo_camera</mat-icon>
    Zrób zdjęcie
</button>
```

- `(click)` z **`stopPropagation()`** — w drop zone i asyście nie otwiera pickera galerii ani nie przenosi fokusu paste.
- **Brak** warunkowego ukrywania i tooltipu „niedostępne” — urządzenie bez aparatu dostaje standardowy file picker (AC 7).

---

## 4. `RecipeImageUploadComponent` — formularz przepisu

**Widoki:** `/recipes/new`, `/recipes/:id/edit`.

### Stan pusty (drop zone)

Pod przyciskiem „Wklej ze schowka” (PS-92) dodać **`pych-camera-capture-button`** w kontenerze akcji:

```
.upload-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
}
```

Na breakpointach mobile (np. max-width 600px): opcjonalnie `flex-direction: column; width: 100%` na stroked buttonach.

Handler:

```typescript
onCameraFileSelected(file: File): void {
    if (this.disabled || this.isUploading) return;
    this.error.set(null);
    this.processFile(file);
}
```

### Stan z podglądem

W `.image-actions` kolejność: **[ Zmień zdjęcie ] [ Wklej ze schowka ] [ Zrób zdjęcie ]**.

- „Zmień zdjęcie” nadal używa `#fileInput` **bez** `capture`.
- Aparat używa wyłącznie inputu w `CameraCaptureButtonComponent`.

### UX / a11y

- Etykieta widoczna: **„Zrób zdjęcie”**; `aria-label`: „Zrób zdjęcie aparatem urządzenia”.
- Focus i aktywacja klawiaturą — domyślne zachowanie `mat-stroked-button`.
- Błędy walidacji: istniejący `.upload-error` (nie snackbar).

### ASCII — stan pusty

```
┌─────────────────────────────────────┐
│         [ add_photo_alternate ]      │
│  Wklej (Ctrl+V) lub przeciągnij…     │
│    JPG, PNG lub WebP (max. 10 MB)    │
│                                      │
│   [ 📋 Wklej ze schowka ]            │
│   [ 📷 Zrób zdjęcie ]                │
└─────────────────────────────────────┘
```

### ASCII — stan z obrazem

```
┌──────────────────┐
│    [ podgląd ]   │
└──────────────────┘
[ Zmień zdjęcie ]  [ Wklej ze schowka ]  [ Zrób zdjęcie ]
```

---

## 5. `RecipeNewAssistPageComponent` — tryb obrazu

**Widok:** `/recipes/new/assist`, gdy `source() === 'image'`.

### Stan pusty

W `.paste-content`, pod „Wklej ze schowka”, ten sam kontener flex z `pych-camera-capture-button`:

```typescript
onCameraFileSelected(file: File): void {
    if (this.isLoading()) return;
    this.handleImageFile(file);
}
```

### Stan z podglądem

W `.image-preview-actions` dodać „Zrób zdjęcie” obok „Wklej ze schowka” (spójna kolejność z formularzem).

**Bez zmian:** guard `premiumRoleMatchGuard`, wskaźnik kredytów, `POST /ai/recipes/draft`, przełącznik tekst/obraz.

---

## 6. Historyjka użytkownika (szczegółowa)

**Jako** użytkownik dodający przepis w kuchni na telefonie,  
**chcę** nacisnąć „Zrób zdjęcie” w formularzu,  
**aby** od razu sfotografować kartkę przepisu bez przechodzenia przez galerię.

**Kroki:**

1. Użytkownik loguje się i otwiera `/recipes/new` na telefonie (Chrome Android / Safari iOS).
2. W sekcji zdjęcia klika „Zrób zdjęcie”.
3. System otwiera aparat (tylny — `environment`); użytkownik robi zdjęcie i potwierdza.
4. Aplikacja pokazuje podgląd; plik jest pending do zapisu przepisu.
5. Użytkownik uzupełnia formularz i zapisuje — upload zdjęcia jak po wyborze pliku z galerii.
6. Alternatywa: użytkownik anuluje aparat — ekran bez zmian, bez komunikatu błędu.

---

## 7. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `CameraCaptureButtonComponent` | Klik programowy → input `change` z plikiem → emit `fileSelected` |
| Komponent aparatu | `change` bez pliku (anulowanie) → brak emit |
| Komponent aparatu | `disabled=true` → input i button disabled |
| `RecipeImageUploadComponent` | `fileSelected` wywołuje `processFile` (mock/spy) |
| `RecipeImageUploadComponent` | Przycisk disabled przy `isUploading` / `@Input() disabled` |
| Asysta | `fileSelected` → `handleImageFile`; disabled gdy `isLoading()` |
| Walidacja | Zły MIME / > 10 MB po aparacie — ten sam komunikat co plik |

Testy E2E (Playwright): opcjonalnie; **wymagany** test manualny na urządzeniu mobilnym (DoD user story).

---

## 8. Checklist implementacji (UI)

- [ ] `CameraCaptureButtonComponent` + testy
- [ ] Integracja w drop zone i `image-actions` (formularz)
- [ ] Integracja w asyście (pusty stan + podgląd)
- [ ] Flex wrap / responsywność przycisków
- [ ] `stopPropagation` — brak regresji kliku w drop zone
- [ ] ARIA na przycisku aparatu
- [ ] Regresja: schowek, paste, D&D, wybór pliku
