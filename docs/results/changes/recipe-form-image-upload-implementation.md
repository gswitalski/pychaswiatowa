# Dokumentacja: Implementacja funkcji paste/drop dla zdjęć w formularzu przepisu

**Data implementacji:** 2025-12-17  
**Status:** ✅ Ukończona

## 📋 Przegląd zmian

Zaimplementowano pełną obsługę uploadu zdjęć w formularzu przepisu zgodnie z planem implementacji, w tym:
- Paste ze schowka (Ctrl+V)
- Drag & Drop z dysku
- Auto-upload w trybie edycji
- Mechanizm Undo ze Snackbar
- Walidacja (10 MB, formaty: JPG, PNG, WebP)
- Obsługa trybu tworzenia (pending file)
- Blokady UI podczas uploadu

---

## 🔧 Zmiany w plikach

### 1. **RecipesService** (`src/app/pages/recipes/services/recipes.service.ts`)

#### Dodane metody API:

```typescript
/**
 * Uploads an image for a specific recipe
 * Uses multipart/form-data to send the file
 */
uploadRecipeImage(recipeId: number, file: File): Observable<UploadRecipeImageResponseDto>

/**
 * Deletes the image associated with a recipe
 */
deleteRecipeImage(recipeId: number): Observable<void>
```

**Szczegóły implementacji:**
- Używa `fetch` API z `FormData` dla multipart upload
- Pobiera token sesji z `supabase.auth.getSession()`
- Wywołuje endpointy: `POST /recipes/{id}/image` i `DELETE /recipes/{id}/image`
- Poprawna obsługa błędów z komunikatami po polsku

#### Zmiany w istniejących metodach:

- **`createRecipe()`** i **`updateRecipe()`**: usunięto bezpośrednie uploadowanie przez Supabase Storage
- Parametr `imageFile` oznaczony jako deprecated (zachowany dla kompatybilności)
- Zdjęcia są teraz obsługiwane wyłącznie przez dedykowane endpointy API

---

### 2. **RecipeImageUploadComponent** (`src/app/pages/recipes/recipe-form/components/recipe-image-upload/`)

#### Nowe typy:

```typescript
// 5 stanów UI
type RecipeImageUploadUiState = 'idle' | 'dragover' | 'uploading' | 'success' | 'error';

// Eventy emitowane do komponentu rodzica
type RecipeImageEvent =
    | { type: 'pendingFileChanged'; file: File | null }
    | { type: 'uploaded'; imagePath: string; imageUrl?: string }
    | { type: 'deleted' }
    | { type: 'uploadingChanged'; uploading: boolean };

// Snapshot dla funkcji Undo
interface RecipeImageUndoSnapshot {
    kind: 'none' | 'existing';
    previousUrl: string | null;
    previousFile: File | null;
}
```

#### Nowe propsy (Inputs):

- `[recipeId]: number | null` - gdy `null`, komponent jest w trybie "pending" (tworzenie)
- `[currentImageUrl]: string | null` - URL obecnego zdjęcia do wyświetlenia
- `[disabled]: boolean` - blokuje wszystkie interakcje

#### Nowe eventy (Outputs):

- `(imageEvent): EventEmitter<RecipeImageEvent>` - zastępuje stary `imageChange`

#### Kluczowe funkcje:

**Walidacja:**
- Typy MIME: `image/jpeg`, `image/png`, `image/webp`
- Maksymalny rozmiar: **10 MB** (zgodnie z API)
- Komunikaty błędów po polsku

**Paste ze schowka:**
```typescript
onPaste(event: ClipboardEvent): void
```
- Obsługuje `ClipboardEvent.clipboardData.items`
- Wyszukuje obrazy w schowku
- Waliduje i przetwarza plik
- Komunikat gdy brak obrazu: "Schowek nie zawiera obrazu"

**Drag & Drop:**
```typescript
onDragOver(event: DragEvent): void
onDragLeave(event: DragEvent): void
onDrop(event: DragEvent): void
```
- Podświetlenie strefy podczas przeciągania (`dragover` state)
- Walidacja obecności pliku
- Komunikat gdy brak pliku: "Upuść plik obrazu z dysku"

**Auto-upload (tryb edycji):**
- Gdy `recipeId != null`, automatycznie wywołuje `uploadRecipeImage()`
- Blokuje UI w stanie `uploading`
- Emituje event `uploaded` po sukcesie

**Tryb tworzenia (pending file):**
- Gdy `recipeId == null`, emituje event `pendingFileChanged` z plikiem
- Plik jest przechowywany w komponencie rodzica do czasu utworzenia przepisu

**Mechanizm Undo:**
```typescript
private async createUndoSnapshot(): Promise<void>
private showUndoSnackbar(message: string): void
private performUndo(): void
```
- Przed uploadem/usunięciem tworzy snapshot poprzedniego zdjęcia
- Próbuje pobrać poprzedni obraz przez `fetch()` i zamienić w `File`
- Pokazuje `MatSnackBar` z akcją "Cofnij" (5 sekund)
- Po kliknięciu "Cofnij" przywraca poprzedni stan

#### UI/Accessibility:

**Drop zone:**
- `tabindex="0"` - fokusowalna
- `role="button"` - dla czytników ekranu
- `aria-label` - opis dla a11y
- Obsługa klawiatury: Enter, Space

**Stany wizualne:**
- **idle**: Ikona + "Wklej (Ctrl+V) lub przeciągnij plik"
- **dragover**: Podświetlona strefa + "Upuść plik tutaj"
- **uploading**: Spinner + "Przesyłanie..."
- **success**: Podgląd obrazu + przyciski "Zmień" i "Usuń"
- **error**: Komunikat błędu z ikoną

---

### 3. **RecipeFormPageComponent** (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)

#### Nowe sygnały:

```typescript
readonly imageUploading = signal<boolean>(false);
readonly isSaveDisabled = computed(() => 
    this.form?.invalid || this.saving() || this.imageUploading()
);
```

#### Nowe właściwości:

```typescript
private pendingImageFile: File | null = null;
```

#### Nowa logika obsługi zdjęć:

**Handler eventów z komponentu zdjęcia:**
```typescript
onImageEvent(event: RecipeImageEvent): void {
    switch (event.type) {
        case 'pendingFileChanged':
            this.pendingImageFile = event.file;
            break;
        case 'uploaded':
            this.currentImageUrl.set(event.imageUrl || event.imagePath);
            break;
        case 'deleted':
            this.currentImageUrl.set(null);
            break;
        case 'uploadingChanged':
            this.imageUploading.set(event.uploading);
            break;
    }
}
```

**Tworzenie przepisu z pending image:**
```typescript
private createRecipe(command: CreateRecipeCommand): void {
    this.recipesService.createRecipe(command, null).subscribe({
        next: (recipe) => {
            if (this.pendingImageFile) {
                this.uploadPendingImage(recipe.id);
            } else {
                this.router.navigate(['/recipes', recipe.id]);
            }
        }
    });
}

private uploadPendingImage(recipeId: number): void {
    this.recipesService.uploadRecipeImage(recipeId, this.pendingImageFile!)
        .subscribe({
            next: () => this.router.navigate(['/recipes', recipeId]),
            error: (err) => {
                // Recipe created, but image upload failed - still navigate
                console.error('Failed to upload image:', err);
                this.router.navigate(['/recipes', recipeId]);
            }
        });
}
```

**Edycja przepisu:**
```typescript
private updateRecipe(id: number, command: UpdateRecipeCommand): void {
    // Image is handled separately by RecipeImageUploadComponent's auto-upload
    this.recipesService.updateRecipe(id, command, null).subscribe({
        next: () => this.router.navigate(['/recipes', id])
    });
}
```

#### Zmiany w template HTML:

```html
<!-- Przycisk "Zapisz" blokowany podczas uploadu -->
<button
    mat-flat-button
    [disabled]="isSaveDisabled()"
    (click)="onSubmit()">
    {{ isEditMode() ? 'Zapisz zmiany' : 'Dodaj przepis' }}
</button>

<!-- Komponent zdjęcia z nowymi propsami -->
<pych-recipe-image-upload
    [recipeId]="recipeId()"
    [currentImageUrl]="currentImageUrl()"
    [disabled]="saving()"
    (imageEvent)="onImageEvent($event)" />
```

---

## 🎯 Zaimplementowane funkcjonalności

### ✅ Zgodnie z planem implementacji:

1. **Walidacja zdjęcia** (krok 2)
   - Typy MIME: `image/png`, `image/jpeg`, `image/webp`
   - Maksymalny rozmiar: 10 MB
   - Komunikaty błędów po polsku

2. **Obsługa paste** (krok 3)
   - `ClipboardEvent` na fokusowanej drop-zone
   - Wykrywanie obrazów w schowku
   - Komunikat: "Schowek nie zawiera obrazu"

3. **Obsługa drag&drop** (krok 4)
   - `dragenter/dragover/dragleave/drop` z `preventDefault`
   - Wizualna sygnalizacja stanu `dragover`
   - Walidacja obecności pliku

4. **Serwis API dla obrazów** (krok 5)
   - `uploadRecipeImage()` - `fetch` + `FormData` + token
   - `deleteRecipeImage()` - `fetch` + token
   - Wywołują endpointy: `POST /recipes/{id}/image` i `DELETE /recipes/{id}/image`

5. **Auto-upload w edycji** (krok 6)
   - Gdy `recipeId != null`, automatyczny upload po paste/drop/file-pick
   - Aktualizacja `currentImageUrl` po sukcesie

6. **Tryb tworzenia (pending)** (krok 7)
   - Gdy `recipeId == null`, emitowanie `pendingFileChanged`
   - Upload po sukcesie `POST /recipes`

7. **Undo (Snackbar)** (krok 8)
   - Snapshot poprzedniego obrazu (pobranie przez `fetch` → `File`)
   - `MatSnackBar` z akcją "Cofnij" (5 sekund)
   - Przywrócenie poprzedniego stanu przez upload/delete

8. **Blokady i spójność** (krok 9)
   - `imageUploading` signal w stronie
   - Przycisk "Zapisz" zablokowany podczas uploadu
   - `disabled` prop przekazywany do komponentu zdjęcia

9. **Porządek w API dla image_path** (krok 10)
   - Usunięto bezpośrednie uploadowanie przez Supabase Storage w `createRecipe/updateRecipe`
   - Zdjęcia obsługiwane wyłącznie przez dedykowane endpointy API

---

## 📝 Przypadki użycia

### Scenariusz 1: Tworzenie nowego przepisu ze zdjęciem

1. Użytkownik otwiera `/recipes/new`
2. Wypełnia formularz
3. Wkleja zdjęcie (Ctrl+V) lub przeciąga plik
4. Zdjęcie jest walidowane i pokazywane jako podgląd (stan "pending")
5. Klik "Dodaj przepis"
6. Zapisywany jest przepis (`POST /recipes`)
7. Po sukcesie, zdjęcie jest uploadowane (`POST /recipes/{id}/image`)
8. Nawigacja do `/recipes/{id}`

### Scenariusz 2: Edycja przepisu - zmiana zdjęcia

1. Użytkownik otwiera `/recipes/{id}/edit`
2. Przeciąga nowe zdjęcie na drop-zone
3. Automatyczny upload (`POST /recipes/{id}/image`)
4. Pokazywany jest Snackbar: "Zmieniono zdjęcie" z akcją "Cofnij"
5. Klik "Zapisz zmiany" zapisuje pozostałe pola (`PUT /recipes/{id}`)

### Scenariusz 3: Edycja przepisu - cofnięcie zmiany zdjęcia

1. Użytkownik wkleja nowe zdjęcie (Ctrl+V)
2. Auto-upload wykona się i pokaże Snackbar
3. Użytkownik klika "Cofnij" w ciągu 5 sekund
4. Komponent pobiera poprzedni obraz z snapshotu
5. Wykonywany jest ponowny upload poprzedniego zdjęcia
6. Zdjęcie zostaje przywrócone

### Scenariusz 4: Edycja przepisu - usunięcie zdjęcia

1. Użytkownik klika "Usuń zdjęcie"
2. Wywołanie `DELETE /recipes/{id}/image`
3. Snackbar: "Usunięto zdjęcie" z akcją "Cofnij"
4. Możliwość przywrócenia przez "Cofnij"

---

## 🧪 Testowanie

### Testy manualne do wykonania:

#### Walidacja:
- [ ] Wklejenie obrazu JPG < 10MB → sukces
- [ ] Wklejenie obrazu PNG < 10MB → sukces
- [ ] Wklejenie obrazu WebP < 10MB → sukces
- [ ] Wklejenie obrazu > 10MB → komunikat "Maksymalny rozmiar pliku to 10 MB"
- [ ] Wklejenie pliku GIF → komunikat "Dozwolone formaty: JPG, PNG, WebP"
- [ ] Paste bez obrazu → komunikat "Schowek nie zawiera obrazu"
- [ ] Drop pliku nie-obrazu → komunikat "Upuść plik obrazu z dysku"

#### Funkcjonalność (Edycja):
- [ ] Paste obrazu (Ctrl+V) → auto-upload + podgląd + snackbar "Zmieniono zdjęcie"
- [ ] Drop obrazu → auto-upload + podgląd + snackbar
- [ ] Wybór pliku przez file-picker → auto-upload + podgląd + snackbar
- [ ] "Usuń zdjęcie" → wywołanie DELETE + snackbar "Usunięto zdjęcie"
- [ ] "Cofnij" po zmianie zdjęcia → przywrócenie poprzedniego
- [ ] "Cofnij" po usunięciu zdjęcia → przywrócenie poprzedniego
- [ ] Przycisk "Zapisz" zablokowany podczas uploadu

#### Funkcjonalność (Tworzenie):
- [ ] Wklejenie obrazu → podgląd (bez auto-upload)
- [ ] Zapisanie przepisu → upload zdjęcia po utworzeniu
- [ ] Zapisanie przepisu bez zdjęcia → nawigacja bez uploadu
- [ ] Usunięcie pending image → czyszczenie podglądu

#### UI/UX:
- [ ] Dragover podświetla drop-zone
- [ ] Spinner podczas uploadu
- [ ] Fokus na drop-zone działa (Tab)
- [ ] Enter/Space na drop-zone otwiera file-picker
- [ ] Komunikaty błędów są widoczne i czytelne

---

## 🔍 Zgodność z zasadami projektu

### ✅ Angular 21 & Best Practices:
- Standalone components
- Signals dla state management
- `inject()` zamiast constructor injection
- `@if/@for` control flow
- OnPush change detection

### ✅ API Communication:
- **NIGDY** bezpośrednio `supabase.from()` w frontendzie
- Wywołania Edge Functions przez `fetch` + token
- Dozwolone operacje Storage **TYLKO** dla auth/functions
- Usunięto bezpośrednie uploadowanie przez Storage

### ✅ Angular Material:
- Użycie `MatSnackBar` dla undo
- `MatProgressSpinner` dla stanu loading
- `MatIcon` dla ikon
- Kolory z SCSS variables (`--mat-sys-*`)

### ✅ Accessibility:
- `tabindex="0"` na drop-zone
- `role="button"` dla semantyki
- `aria-label` dla czytników ekranu
- Obsługa klawiatury (Enter, Space)

---

## 📊 Podsumowanie

**Wszystkie funkcjonalności z planu implementacji zostały zaimplementowane:**

✅ 11 kroków z planu (kroki 1-11)  
✅ 5 stanów UI (idle, dragover, uploading, success, error)  
✅ Walidacja zgodna z API (10 MB, JPG/PNG/WebP)  
✅ Auto-upload w trybie edycji  
✅ Pending file w trybie tworzenia  
✅ Mechanizm Undo z pobraniem poprzedniego obrazu  
✅ Blokady UI podczas uploadu  
✅ Obsługa paste i drag&drop  
✅ Accessibility (a11y)  
✅ Poprawna obsługa błędów  

**Brak błędów kompilacji i lintera.**

---

**Autor:** AI Assistant  
**Data:** 2025-12-17

