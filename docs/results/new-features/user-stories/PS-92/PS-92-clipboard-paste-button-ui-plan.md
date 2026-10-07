# PS-92: Dedykowany przycisk wklejania zdjęcia ze schowka — Plan UI

> **User Story:** PS-92 — Dedykowany przycisk „Wklej ze schowka" w strefie zdjęcia formularza przepisu
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `ClipboardImageService` (nazwa robocza) | **Nowy** serwis współdzielony | `src/app/shared/services/clipboard-image.service.ts` |
| Stałe komunikatów schowka | **Nowy** plik lub sekcja w serwisie | np. `clipboard-image.messages.ts` obok serwisu |
| `RecipeImageUploadComponent` | **Modyfikacja** — przycisk + integracja serwisu | `src/app/pages/recipes/recipe-form/components/recipe-image-upload/` |
| `RecipeNewAssistPageComponent` | **Modyfikacja** — przycisk w strefie obrazu | `src/app/pages/recipes/recipe-new-assist/` |
| Testy jednostkowe | **Nowe / rozszerzone** | `clipboard-image.service.spec.ts`, testy komponentów |
| Trasy / guardy | **Bez zmian** | `/recipes/new`, `/recipes/:id/edit`, `/recipes/new/assist` |

**Poza zakresem PS-92:** poprawa automatycznego fokusu pod Ctrl+V, zmiany w drag & drop, nowe endpointy, snackbar zamiast inline (poza istniejącym snackbarem Undo w edycji po uploadzie).

---

## 2. Współdzielony serwis `ClipboardImageService`

Odpowiedzialność: detekcja API, odczyt obrazu, mapowanie błędów na komunikaty z kryteriów akceptacji.

### Detekcja dostępności

```typescript
isClipboardReadSupported(): boolean {
    return typeof navigator !== 'undefined'
        && window.isSecureContext
        && !!navigator.clipboard?.read;
}
```

- Gdy `false`: przycisk **disabled** + tooltip (patrz sekcja 4).
- Nie ukrywać przycisku w desktopowych przeglądarkach wspierających API.

### Odczyt obrazu

```typescript
async readImageFile(): Promise<File> {
    const items = await navigator.clipboard.read();
    // Przeszukaj clipboard items pod kątem image/png | image/jpeg | image/webp
    // Zbuduj File z sensowną nazwą (np. clipboard-paste.webp)
    // Rzucaj typowane błędy / zwracaj Result z kodem reason
}
```

Obsługa wyjątków:

| Przypadek | Komunikat UI (stała) |
|---|---|
| Brak obrazu w schowku | „Schowek nie zawiera obrazu. Skopiuj grafikę i spróbuj ponownie." |
| Nieobsługiwany MIME (np. GIF) | „Nieobsługiwany format pliku. Dozwolone formaty: PNG, JPG, WebP." |
| Rozmiar > 10 MB | „Plik jest zbyt duży. Maksymalny rozmiar to 10 MB." |
| `NotAllowedError` / odmowa uprawnień | „Brak dostępu do schowka. Zezwól na dostęp w ustawieniach przeglądarki lub użyj Ctrl+V." |
| Inny błąd odczytu | Krótki komunikat generyczny + log do konsoli (dev) |

Walidacja MIME i rozmiaru w serwisie **przed** zwróceniem `File` — spójne z `processFile()` i `handleImageFile()` na asyście.

---

## 3. `RecipeImageUploadComponent` — formularz przepisu

**Widoki:** `/recipes/new`, `/recipes/:id/edit` (w tym po przejściu z asysty z wypełnionym formularzem).

### Stan pusty (drop zone)

Pod hintem „JPG, PNG lub WebP (max. 10 MB)" dodać:

```
[ mat-stroked-button ]
  ikona: content_paste
  etykieta: Wklej ze schowka
  aria-label: Wklej zdjęcie ze schowka
```

- `(click)` → `$event.stopPropagation()` (nie otwiera file pickera drop zone).
- `[disabled]="disabled || isUploading || !clipboardSupported"` — `clipboardSupported` z serwisu (sygnał/computed w komponencie, ustawiony w `ngOnInit`).
- `matTooltip` gdy disabled z powodu braku API: „Niedostępne w tej przeglądarce — użyj Ctrl+V, przeciągnij plik lub wybierz z dysku".

### Stan z podglądem zdjęcia

Obok istniejącego „Zmień zdjęcie" (`mat-stroked-button`) drugi przycisk „Wklej ze schowka" (ta sama ikona i reguły disabled).

### Handler kliknięcia

```typescript
async onPasteFromClipboardClick(): Promise<void> {
    if (this.disabled || this.isUploading) return;
    this.error.set(null);
    try {
        const file = await this.clipboardImageService.readImageFile();
        this.processFile(file); // istniejąca ścieżka — Undo/upload/pending bez zmian
    } catch (e) {
        this.error.set(this.clipboardImageService.messageForError(e));
    }
}
```

### Ujednolicenie komunikatów paste (Ctrl+V)

Zaktualizować istniejące teksty w `onPaste()` / `processFile()` do wersji z user story (tabela w sekcji 2), aby Ctrl+V i przycisk dawały te same komunikaty.

### UX / a11y

- Przycisk: focusable, aktywacja Enter/Space (domyślnie `mat-button`).
- Komunikaty błędów: istniejący blok `.upload-error` pod strefą (nie snackbar).
- Ctrl+V, drag & drop, klik w drop zone — **bez zmiany zachowania**.

### ASCII — układ (stan pusty)

```
┌─────────────────────────────────────┐
│         [ add_photo_alternate ]      │
│  Wklej (Ctrl+V) lub przeciągnij plik │
│         albo wybierz plik            │
│    JPG, PNG lub WebP (max. 10 MB)    │
│                                      │
│   [ 📋 Wklej ze schowka ]            │
└─────────────────────────────────────┘
```

### ASCII — układ (stan z obrazem)

```
┌──────────────────┐
│    [ podgląd ]   │
└──────────────────┘
[ Zmień zdjęcie ]  [ Wklej ze schowka ]
```

---

## 4. `RecipeNewAssistPageComponent` — tryb obrazu

**Widok:** `/recipes/new/assist`, gdy `source() === 'image'` i brak podglądu.

Wewnątrz `.image-paste-area` (pod `.paste-formats`):

- Ten sam przycisk `mat-stroked-button` „Wklej ze schowka".
- `(click)` z `stopPropagation()` — nie wymaga fokusu na strefie.
- Po sukcesie: `handleImageFile(file)` (istniejąca walidacja może zostać jako druga linia obrony; preferowane: jeden path przez serwis + `handleImageFile`).
- Błędy: istniejące `errorMessage` pod strefą (inline), teksty zsynchronizowane ze stałymi serwisu (zastąpić nieco inne br brzmienia asysty, np. „W schowku nie ma obrazu…" → wersja z AC).

Gdy podgląd obrazu jest widoczny: przycisk „Wklej ze schowka" obok akcji usuwania / zmiany obrazu (jeśli jest przycisk zmiany — dodać analogicznie do formularza).

Tooltip i disabled — identyczne reguły co w `RecipeImageUploadComponent`.

**Bez zmian:** przełącznik tekst/obraz, wskaźnik kredytów, guard `premiumRoleMatchGuard`, wywołanie `POST /ai/recipes/draft`.

---

## 5. Historyjka użytkownika (szczegółowa)

**Jako** użytkownik edytujący przepis na laptopie z skopiowanym zdjęciem z przeglądarki,  
**chcę** kliknąć „Wklej ze schowka" w sekcji zdjęcia,  
**aby** od razu zobaczyć podgląd bez szukania niewidocznego fokusu pod Ctrl+V.

**Kroki:**

1. Użytkownik kopiuje obraz PNG do schowka systemowego.
2. Otwiera `/recipes/new` lub edycję przepisu.
3. Klika „Wklej ze schowka".
4. Przeglądarka prosi o zgodę (jeśli pierwszy raz) → użytkownik zatwierdza.
5. Podgląd zdjęcia pojawia się w strefie; w edycji startuje upload jak po paste; w tworzeniu plik trafia do pending.
6. Użytkownik może cofnąć zmianę (Undo w edycji po uploadzie — jak dziś) lub zapisać formularz.

---

## 6. Testy (Vitest)

| Obszar | Scenariusz |
|---|---|
| `ClipboardImageService` | Mock `navigator.clipboard.read` — happy path PNG |
| Serwis | Pusty schowek, GIF w schowku, plik > 10 MB |
| Serwis | `NotAllowedError` → komunikat o uprawnieniach |
| Serwis | `isClipboardReadSupported()` gdy brak API |
| `RecipeImageUploadComponent` | Klik wywołuje `processFile` z mockiem serwisu |
| `RecipeImageUploadComponent` | Przycisk disabled gdy `disabled` input / uploading |
| Asysta | Klik ustawia `imageFile` / preview przez `handleImageFile` |

Testy E2E (Playwright): opcjonalnie jeden scenariusz z mockiem uprawnień schowka w Chromium (manual AC: Chromium, Firefox, WebKit).

---

## 7. Checklist implementacji (UI)

- [ ] Serwis współdzielony + stałe komunikatów
- [ ] Przycisk w drop zone i przy podglądzie (`RecipeImageUploadComponent`)
- [ ] Przycisk na asyście (tryb obrazu)
- [ ] Disabled + tooltip gdy brak Clipboard API
- [ ] Spójne komunikaty błędów (przycisk, Ctrl+V, asysta)
- [ ] ARIA na przycisku
- [ ] Testy jednostkowe serwisu i komponentów
- [ ] Manual: secure context (HTTPS / localhost)
