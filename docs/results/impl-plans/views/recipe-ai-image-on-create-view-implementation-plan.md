# Plan implementacji widoku Recipe AI Image on Create

## 1. Przegląd
Celem jest dodanie możliwości **wygenerowania zdjęcia AI już w trakcie tworzenia przepisu** na ścieżce `/recipes/new` – bez wcześniejszego zapisu rekordu w bazie – z zachowaniem istniejącego scenariusza dla edycji `/recipes/:id/edit`.

Kluczowe założenia:

- Generowanie obrazu odbywa się przez `POST /ai/recipes/image` (Edge Function), a wynik wraca jako base64 (WebP 1024×1024).
- W trybie tworzenia, zaakceptowane zdjęcie AI jest trzymane **tymczasowo w stanie formularza** (frontend) i **uploadowane dopiero po** udanym `POST /recipes` przez `POST /recipes/{id}/image`.
- Feature gating jest egzekwowany serwerowo (403 dla nie-premium), ale UI musi jasno komunikować dostępność (preferowany wariant: przycisk widoczny, ale disabled dla roli `user`).
- UI obsługuje `prompt_hint` (opcjonalne doprecyzowanie stylu) oraz tryb `auto` (z referencją, jeśli jest dostępna).
- UI ogranicza spamowanie (cooldown 20–30s po generowaniu / regeneracji).

## 2. Routing widoku
Zmiana dotyczy istniejącego widoku formularza przepisu:

- **Tworzenie**: `/recipes/new`
- **Edycja**: `/recipes/:id/edit`

Nie jest wymagane dodawanie nowych tras – rozszerzamy zachowanie oraz UI w sekcji „Zdjęcie”.

## 3. Struktura komponentów
Aktualna struktura widoku pozostaje, ale rozszerzamy sekcję zdjęcia oraz dialog AI.

Wysokopoziomowe drzewo:

- `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.*`)
  - `PageHeaderComponent`
  - `RecipeBasicInfoFormComponent`
  - `RecipeImageUploadComponent` (`.../components/recipe-image-upload/...`)
  - `RecipeCategorizationFormComponent`
  - `EditableListComponent` (składniki/kroki/wskazówki)
  - `AiRecipeImage...DialogComponent` (rozbudowany dialog generowania; obecnie `AiRecipeImagePreviewDialogComponent`)

## 4. Szczegóły komponentów

### `RecipeFormPageComponent`
- **Opis komponentu**: Strona formularza przepisu w trybie tworzenia i edycji. Odpowiada za walidację formularza, zapis (`POST /recipes` / `PUT /recipes/:id`), obsługę zdjęcia (pending w create / auto-upload w edit) oraz wywołania AI image generation.
- **Główne elementy**:
  - Sekcja „Zdjęcie” w `mat-card` z:
    - `pych-recipe-image-upload`
    - przyciskiem AI (`mat-icon-button`) z tooltipem i spinnerem
    - uruchomieniem dialogu generowania
- **Obsługiwane interakcje**:
  - Klik „AI” → otwarcie dialogu generowania z możliwością doprecyzowania `prompt_hint`
  - „Użyj tego zdjęcia” w dialogu → ustawienie wyniku jako aktualne zdjęcie w formularzu:
    - create: ustawienie pending file (bez uploadu do backendu)
    - edit: auto-upload przez `RecipeImageUploadComponent` (istniejące zachowanie)
  - „Wygeneruj ponownie” → ponowne wywołanie API (z cooldownem)
  - „Usuń” w dialogu → wyczyszczenie podglądu w dialogu (bez modyfikacji zdjęcia w formularzu)
- **Obsługiwana walidacja (przed wywołaniem AI)**:
  - Minimalne dane, aby uniknąć 422:
    - `name` niepuste (trim)
    - co najmniej 1 element w `ingredients`
    - co najmniej 1 element w `steps`
  - Walidacja `prompt_hint`:
    - opcjonalne
    - trim
    - limit długości po stronie UI zgodny z API (rekomendacja: max 400 znaków; w UI można ustawić 200–400, ale nie więcej niż backend)
  - Walidacja roli:
    - `premium`/`admin`: przycisk aktywny
    - `user`: przycisk widoczny, ale disabled + tooltip „Funkcja Premium”
    - Uwaga techniczna: tooltip na disabled button nie działa bez wrappera – przycisk powinien być opakowany w element nie-disabled (np. `<span>` z tooltipem).
- **Typy (DTO i ViewModel)**:
  - Formularz: `RecipeFormViewModel` (lokalny interfejs)
  - API: `AiRecipeImageRequestDto`, `AiRecipeImageResponseDto`, `AiRecipeImageUnprocessableEntityDto`
  - Dialog: lokalne typy danych wejściowych/wyjściowych (np. `AiRecipeImageDialogData`, `AiRecipeImageDialogResult`) – do rozbudowy
- **Propsy**: N/A (komponent stronowy).

**Zakres zmian w komponencie:**

1. **Feature gating widoczności przycisku AI**
   - Zmienić logikę z „widoczny tylko premium/admin” na:
     - widoczny dla wszystkich zalogowanych (lub dla wszystkich na widokach auth-only),
     - aktywny tylko dla `premium`/`admin`,
     - dla `user` disabled + tooltip „Funkcja Premium”.

2. **Odblokowanie AI dla `/recipes/new`**
   - Usunąć precondition „tylko edit mode / wymagane `recipeId`” w handlerze AI.
   - Zmienić tooltip/logikę disabled:
     - create + premium/admin: aktywny i generuje obraz jako preview (bez uploadu)
     - create + user: disabled premium tooltip
     - edit + premium/admin: aktywny (jak dziś)

3. **Budowa requestu AI zależnie od trybu**
   - Zawsze wysyłać `mode: 'auto'`, `output_format: 'pycha_recipe_image_v1'`, `output: { mime_type: 'image/webp', width: 1024, height: 1024 }`, `language: 'pl'`.
   - Pole `recipe.id`:
     - edit: `recipe.id = recipeId`
     - create: `recipe.id = null` (lub pominięte; preferowane jawne `null` dla czytelności)
   - Dodatkowe dane przepisu z formularza (zalecane dla lepszej jakości):
     - `description`, `servings`, `prep_time_minutes`, `total_time_minutes`
     - flagi: `is_termorobot`, `is_grill`
     - klasyfikacja: `diet_type`, `cuisine`, `difficulty`
     - `category_name` (mapowane z `categoryId` → nazwa)
     - `ingredients`, `steps` w formacie `{type, content}` (z obsługą `#` jako `header`)
     - `tags`
   - `reference_image`:
     - edit: jeśli istnieje bieżące zdjęcie w Storage → `source: 'storage_path'`
     - create: jeśli istnieje zdjęcie w formularzu (pending file) → `source: 'base64'` + `mime_type` + `data_base64` (bez prefiksu data URL)

4. **Obsługa `prompt_hint`**
   - Dialog powinien zwracać `prompt_hint` do komponentu strony, a komponent dodaje go do `AiRecipeImageRequestDto`.

5. **Akceptacja wyniku AI**
   - Po akcji „Użyj tego zdjęcia”:
     - przekonwertować base64 do `File` (`image/webp`), a następnie:
       - wywołać `RecipeImageUploadComponent.applyExternalFile(file)` (już istnieje)
   - W create mode spowoduje to aktualizację `pendingImageFile` (przez event `pendingFileChanged`) i finalny upload po `POST /recipes`.

6. **Upload po utworzeniu przepisu (create mode)**
   - Obecny flow już wspiera „pending file → upload po `POST /recipes`”.
   - Do dopracowania UX:
     - jeśli upload się nie uda: pokazać `MatSnackBar` „Przepis zapisany, ale nie udało się wgrać zdjęcia” + opcjonalna akcja (np. „Edytuj” / „Spróbuj ponownie”), nie blokować nawigacji do szczegółów.

### `RecipeImageUploadComponent`
- **Opis komponentu**: Obsługa wklejania/przeciągania/wyboru pliku z dysku; w edit mode auto-upload do `/recipes/{id}/image`; w create mode emituje pending file do rodzica.
- **Główne elementy**:
  - Drop zone z obsługą paste / drag&drop / click
  - Preview obrazu z przyciskiem usuwania
  - Przycisk „Zmień zdjęcie”
- **Obsługiwane interakcje**:
  - paste/drop/file → walidacja typu i rozmiaru (max 10MB)
  - create: emituje `{ type: 'pendingFileChanged', file }`
  - edit: upload i emituje `{ type: 'uploaded' | 'deleted' }` oraz `{ type: 'uploadingChanged' }`
  - API „applyExternalFile(file)” – używane do ustawiania wyniku AI
- **Walidacja**:
  - MIME: `image/jpeg`, `image/png`, `image/webp`
  - Rozmiar: ≤ 10MB
- **Typy**:
  - `RecipeImageEvent`, `UploadRecipeImageResponseDto`
- **Zmiany wymagane pod ten feature**:
  - Brak zmian kontraktowych wymaganych do MVP – komponent już wspiera pending file i `applyExternalFile`.
  - (Opcjonalnie UX) Dodać publiczną metodę do pobrania informacji czy istnieje zdjęcie w create mode (np. `hasImage` jako output) – nie jest konieczne, bo rodzic ma `pendingImageFile`.

### Dialog: generowanie zdjęcia AI
Obecny komponent `AiRecipeImagePreviewDialogComponent` pokazuje tylko podgląd/loader/błąd, ale **nie obsługuje**:

- pola `prompt_hint`,
- stanu „początkowego” (placeholder + przycisk „Generuj”),
- „Usuń” (czyszczenie podglądu bez zamykania dialogu),
- cooldownu.

Rekomendacja: rozbudować istniejący dialog (mniej ryzykowne niż tworzenie drugiego obok), ale zmienić go z „preview-only” na pełny „generate flow”.

#### `AiRecipeImagePreviewDialogComponent` (po rozbudowie; możliwa zmiana nazwy na `AiRecipeImageGenerateDialogComponent`)
- **Opis komponentu**: Modal do generowania obrazu z możliwością wpisania doprecyzowania stylu (`prompt_hint`), podglądem, oraz akcjami: anuluj, generuj, użyj, generuj ponownie (z cooldown), usuń.
- **Główne elementy HTML / Material**:
  - `mat-dialog-title`: „Generuj zdjęcie AI”
  - `mat-dialog-content`:
    - informacja o trybie: „Z przepisu” vs „Z referencją zdjęcia”
    - `mat-form-field` + `textarea` dla `prompt_hint` (opcjonalne, maxLength, licznik)
    - strefa podglądu:
      - initial: placeholder
      - loading: `mat-spinner`
      - success: `<img>` 1:1 (max 512px), opis trybu (resolved mode)
      - error: komunikat + lista `reasons` (dla 422)
    - (opcjonalnie) mini-info o kosztach/limitach lub „Nie spamuj” – w MVP wystarczy cooldown + rate limit obsłużony błędem
  - `mat-dialog-actions`:
    - „Anuluj”
    - „Generuj” (w initial/error bez wyniku) – disabled podczas requestu i w cooldownie
    - „Użyj tego zdjęcia” (tylko success)
    - „Wygeneruj ponownie” (success/error; z cooldown)
    - „Usuń” (success) – czyści tylko stan dialogu (wraca do initial)
- **Obsługiwane zdarzenia**:
  - `onGenerate()` / `onRegenerate()` – zwraca do rodzica intencję wywołania API + aktualny `prompt_hint`
  - `onApply()` – zwraca `applied`
  - `onClear()` – czyści preview
  - `onCancel()` – zamyka dialog bez zmian
- **Walidacja**:
  - `prompt_hint` optional; maxLength ustawiony w UI; trim przed wysłaniem/zwrotem
  - „Generuj” disabled jeśli parent (strona) wykryje brak minimalnych danych przepisu (walidacja po stronie `RecipeFormPageComponent` jest źródłem prawdy).
- **Typy (DTO i ViewModel)**:
  - `AiRecipeImageDialogData` rozszerzyć o:
    - `modeLabel`: string (np. „Z przepisu” / „Z referencją zdjęcia”)
    - `isPremium`: boolean (gdyby kiedyś dialog był otwierany mimo gatingu; w MVP dialog nie powinien się otworzyć dla `user`)
    - `promptHintMaxLength`: number
  - `AiRecipeImageDialogResult` rozszerzyć tak, aby parent miał komplet informacji do wykonania akcji:
    - `action: 'cancelled' | 'requestGenerate' | 'applied'`
    - `prompt_hint?: string`
    - (opcjonalnie) `clearPreview?: boolean`
- **Cooldown**:
  - W dialogu utrzymywać `cooldownUntil` i wyświetlać odliczanie w labelce/tooltipie przy „Wygeneruj ponownie”.
  - W trakcie cooldownu blokować ponowne requesty (UX), niezależnie od rate limitu serwerowego.

## 5. Typy
Wykorzystujemy istniejące definicje z `shared/contracts/types.ts`:

- **Request/response**:
  - `AiRecipeImageRequestDto`
  - `AiRecipeImageResponseDto`
  - `AiRecipeImageUnprocessableEntityDto` (422)
  - `AiRecipeImageReferenceImageDto` (`storage_path` lub `base64`)
  - `AiRecipeImageMode` (`auto`)
- **Modele domenowe pomocne do mapowania**:
  - `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`
  - `RecipeContentItem` (konceptualnie; w request używamy `AiRecipeImageContentItem`)

Nowe typy lokalne (w obrębie komponentu dialogu lub folderu `components/...`):

- `AiRecipeImageDialogData` (rozszerzenie o informacje do wyświetlenia trybu i limitów)
- `AiRecipeImageDialogResult` (rozszerzenie o `prompt_hint` oraz intencję „wywołaj generowanie” bez zamykania dialogu lub z zamknięciem — do decyzji implementacyjnej)

Rekomendacja: typy dialogu trzymać lokalnie w `ai-recipe-image-preview-dialog.component.ts` (lub po rename w nowym komponencie), bez dopisywania do globalnego `shared/contracts/types.ts`, bo to typy stricte UI.

## 6. Zarządzanie stanem
Zgodnie z zasadami projektu:

- **Signals**:
  - `RecipeFormPageComponent` już używa sygnałów (`saving`, `aiGenerating`, `recipeId`, `currentImagePath`, itp.) – kontynuujemy ten wzorzec.
  - Dialog: sygnały dla `state`, `imageDataUrl`, `errorMessage`, `resolvedMode`, `promptHint`, `cooldownRemaining`.
- **Formularze**:
  - Reactive Forms dla formularza przepisu (już istnieje).
  - Dla dialogu: wystarczy `FormControl<string>` dla `prompt_hint` lub proste signal + `maxLength`.
- **Stan zdjęcia w create mode**:
  - Źródło prawdy: `pendingImageFile` w `RecipeFormPageComponent` (ustawiane z eventów `RecipeImageUploadComponent`).
  - Po akceptacji AI: `pendingImageFile` zostaje nadpisane plikiem AI (to jest oczekiwany plik do uploadu po zapisie).
  - Utrata po refresh/back: akceptowalna (FR-AIIMG-009).

Nie tworzymy globalnego store ani NgRx – zmiana dotyczy jednego widoku i istniejących komponentów.

## 7. Integracja API

### 7.1 `POST /ai/recipes/image`
- **Serwis**: `AiRecipeImageService.generateImage(request: AiRecipeImageRequestDto)`
- **Request (kluczowe pola)**:
  - `recipe.id`: `number` w edit, `null` w create
  - `prompt_hint`: z dialogu (opcjonalne)
  - `mode`: `auto`
  - `reference_image`:
    - edit: `{ source: 'storage_path', image_path }`
    - create: `{ source: 'base64', mime_type, data_base64 }` (z `pendingImageFile`)
  - `output`: webp 1024×1024
  - `language`: `pl`
  - `output_format`: `pycha_recipe_image_v1`
- **Response**:
  - `image.data_base64` → budowa data URL do podglądu
  - `meta.mode` (`recipe_only` / `with_reference`) → komunikat w dialogu
- **Błędy (obsługa UI)**:
  - `401`: komunikat o braku sesji (np. „Zaloguj się ponownie”)
  - `403`: komunikat premium (w praktyce UI i tak blokuje, ale obsłużyć defensywnie)
  - `413`: referencja za duża → czytelny komunikat (sugerować mniejszy obraz)
  - `422`: pokazać `message` + `reasons` w dialogu
  - `429`: komunikat o limicie + wymuszenie cooldownu po stronie UI

### 7.2 `POST /recipes` + `POST /recipes/{id}/image`
Sekwencja dla `/recipes/new`:

1. AI preview: `POST /ai/recipes/image` → base64 w dialogu → po „Użyj tego zdjęcia” ustawiamy pending file w formularzu.
2. Zapis przepisu: `POST /recipes` → zwraca `id`.
3. Jeśli `pendingImageFile` istnieje → `POST /recipes/{id}/image` (multipart) po zapisaniu.
4. Błąd uploadu:
   - nie cofa tworzenia przepisu,
   - użytkownik dostaje komunikat i może ponowić w edycji.

## 8. Interakcje użytkownika

### Scenariusz: premium/admin na `/recipes/new`
- Użytkownik wypełnia podstawowe dane (nazwa, składniki, kroki).
- (Opcjonalnie) dodaje zdjęcie referencyjne przez paste/drop/file.
- Klik „AI” w sekcji „Zdjęcie”.
- W dialogu:
  - widzi informację o trybie („z przepisu” / „z referencją”),
  - może wpisać doprecyzowanie (`prompt_hint`),
  - klika „Generuj”.
- Po sukcesie:
  - widzi podgląd i przyciski: „Użyj tego zdjęcia”, „Wygeneruj ponownie” (cooldown), „Usuń”.
- Po „Użyj tego zdjęcia”:
  - zdjęcie jest ustawione w formularzu (tymczasowo).
- Po „Dodaj przepis”:
  - przepis zapisuje się,
  - zdjęcie uploaduje się po `POST /recipes`.

### Scenariusz: user (nie-premium) na `/recipes/new`
- Przycisk AI jest widoczny, ale disabled.
- Tooltip: „Funkcja Premium”.
- Nie otwieramy dialogu (brak mylących błędów).

### Scenariusz: premium/admin na `/recipes/:id/edit`
- Działa jak dotychczas, ale dialog oferuje dodatkowo `prompt_hint` i cooldown.

## 9. Warunki i walidacja

- **Walidacja formularza przed wywołaniem AI (guard clauses)**:
  - `name.trim().length > 0`
  - `ingredients.length >= 1`
  - `steps.length >= 1`
  - W przypadku niespełnienia: Snackbar z krótką instrukcją (bez otwierania dialogu lub z dialogiem w stanie error/initial – rekomendacja: bez otwierania).
- **Walidacja `prompt_hint`**:
  - trim
  - maxLength (np. 400)
  - jeśli puste po trim → nie wysyłać pola
- **Gating premium**:
  - UI: disabled + tooltip dla `user`
  - Backend: 403; w razie obejścia UI – dialog pokazuje błąd premium.
- **Zależność referencji**:
  - create: referencja istnieje jeśli `pendingImageFile != null`
  - edit: referencja istnieje jeśli `currentImagePath != null`

## 10. Obsługa błędów

- **Błędy AI generowania**:
  - Pokazywać w dialogu (czytelny message + reasons dla 422).
  - Po błędzie umożliwić ponowienie („Wygeneruj ponownie”) z cooldownem.
- **Błędy zapisu przepisu**:
  - Pokazać banner błędu w formularzu (już istnieje `error` signal).
  - Nie czyścić pending zdjęcia.
- **Błędy uploadu zdjęcia po `POST /recipes`**:
  - Pokazać snackbar o częściowym sukcesie („Przepis zapisany, ale…”) i pozwolić kontynuować (nawigacja do szczegółów).
- **Timeout generowania**:
  - Serwis ma timeout 60s; w dialogu pokazać komunikat i opcję ponowienia.
- **Rate limit 429**:
  - Wyświetlić komunikat o limicie + wymusić cooldown (nie tylko UX, ale realna pomoc).

## 11. Kroki implementacji
1. Zaktualizować UI sekcji „Zdjęcie” w `RecipeFormPageComponent`:
   - pokazywać przycisk AI również dla roli `user` (disabled + tooltip),
   - umożliwić klik dla `premium`/`admin` także w create mode.
2. Rozbudować dialog AI:
   - dodać `prompt_hint` (textarea) i stan initial + przycisk „Generuj”,
   - dodać przycisk „Usuń” (czyszczenie preview),
   - dodać cooldown dla ponawiania,
   - utrzymać obsługę error state z listą reasons.
3. Przebudować flow w `RecipeFormPageComponent.onGenerateAiImage()`:
   - zamiast „open dialog w loading i od razu call API”, przejść na sterowanie dialogiem:
     - użytkownik wpisuje `prompt_hint` → „Generuj” → call API → update dialog,
     - „Wygeneruj ponownie” → call API ponownie (po cooldown),
     - „Użyj tego zdjęcia” → aplikacja `applyExternalFile(file)`.
4. Zmodyfikować builder requestu AI:
   - wspiera create mode (bez `recipeId`),
   - dodaje `reference_image` z `pendingImageFile` jako base64 w create mode,
   - dodaje `prompt_hint`,
   - uwzględnia pola klasyfikacji/flag (diet/cuisine/difficulty/is_grill/is_termorobot/czasy).
5. Dopracować komunikat przy nieudanym uploadzie po utworzeniu przepisu:
   - snackbar „Przepis zapisany, ale…”.
6. Dodać testy (jeśli repo ma standard):
   - jednostkowe dla mapowania form → `AiRecipeImageRequestDto` (szczególnie `#` jako header),
   - testy dla dialogu (stany + cooldown),
   - (opcjonalnie) E2E: premium user generuje obraz w `/recipes/new`, akceptuje i zapisuje przepis.

