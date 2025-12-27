# Plan implementacji widoku Kreator dodawania przepisu (AI)

## 1. Przegląd
Celem jest wdrożenie „kreatora” dodawania przepisu składającego się z dwóch nowych widoków:
- `/recipes/new/start` — wybór trybu („Pusty formularz” vs „Z tekstu/zdjęcia (AI)”).
- `/recipes/new/assist` — wklejenie danych wejściowych (tryb **albo tekst, albo obraz**), walidacja, stan ładowania i obsługa błędów, a następnie wstępne wypełnienie istniejącego formularza `/recipes/new` na podstawie draftu z Edge Function.

W ramach zmiany UI aktualizujemy też wejścia do tworzenia przepisu tak, aby przycisk „Dodaj przepis” prowadził do kreatora (zamiast bezpośrednio do `/recipes/new`) oraz zachowujemy kompatybilność wstecz dla ścieżki `/recipes/new`.

## 2. Routing widoku
### Docelowe ścieżki
- **Nowe**:
    - **`/recipes/new/start`**
    - **`/recipes/new/assist`**
- **Istniejące (bez zmian semantyki)**:
    - **`/recipes/new`** — istniejący formularz (`RecipeFormPageComponent`), używany jako:
        - pusty formularz (wybór z kreatora),
        - formularz prefill (po wygenerowaniu draftu AI).

### Proponowana refaktoryzacja routingu (ważne w Angular)
W `src/app/pages/recipes/recipes.routes.ts` obecnie istnieje route `path: 'new'` bez `pathMatch: 'full'`, co w Angular domyślnie może „połknąć” ścieżki typu `/recipes/new/start` (match prefix). Dlatego należy:
- Zmienić route `new` na route z `children`, np.:
    - `path: 'new'`
        - `path: ''` → formularz (`RecipeFormPageComponent`)
        - `path: 'start'` → nowy widok wyboru trybu
        - `path: 'assist'` → nowy widok AI input
- Alternatywnie (mniej czytelne): dodać `pathMatch: 'full'` do `new` oraz osobne route `new/start` i `new/assist` **przed** route `new`.

### Guardy / dostęp
Kreator jest częścią „prywatnej” sekcji (działa pod `MainLayoutComponent` i `authenticatedMatchGuard`), analogicznie do `/recipes/new`.

## 3. Struktura komponentów
### Nowe komponenty stron (standalone)
- `RecipeNewStartPageComponent` (`selector`: `pych-recipe-new-start-page`)
- `RecipeNewAssistPageComponent` (`selector`: `pych-recipe-new-assist-page`)

### Komponenty współdzielone (opcjonalne, rekomendowane)
- `RecipeAiInputSourceToggleComponent` — przełącznik źródła: Tekst / Obraz
- `RecipeAiTextInputComponent` — `textarea` + walidacja
- `RecipeAiImagePasteAreaComponent` — strefa wklejania obrazu (Ctrl+V), podgląd, usuń
- `RecipeAiValidationMessageComponent` — blok komunikatów dla 422 i błędów technicznych (wraz z listą `reasons`)

### Serwisy
- `AiRecipeDraftService` — wywołanie Edge Function `POST /ai/recipes/draft`
- `RecipeDraftStateService` — stan draftu (signals) przenoszony między `/recipes/new/assist` a `/recipes/new`

## 4. Szczegóły komponentów
### `RecipeNewStartPageComponent`
- **Opis komponentu**:
    - Ekran wyboru trybu dodawania przepisu.
    - Udostępnia dwie akcje nawigacyjne:
        - „Pusty formularz” → `/recipes/new`
        - „Z tekstu/zdjęcia (AI)” → `/recipes/new/assist`
- **Główne elementy i dzieci**:
    - `pych-page-header` z tytułem „Dodaj przepis”
    - Dwie karty/sekcje (np. `mat-card` lub `mat-button` w układzie 2-kolumnowym na desktop):
        - „Pusty formularz”
        - „Z tekstu/zdjęcia (AI)”
- **Obsługiwane interakcje**:
    - Kliknięcie „Pusty formularz”: czyści ewentualny draft (jeśli istnieje) i przechodzi do `/recipes/new`.
    - Kliknięcie „Z tekstu/zdjęcia (AI)”: przechodzi do `/recipes/new/assist`.
    - „Anuluj”: wraca do poprzedniego widoku (Location.back) lub na `/my-recipies` (decyzja UX; rekomendacja: Location.back).
- **Walidacja**:
    - Brak walidacji formularzowej.
    - Guard UI: brak akcji podczas trwającej nawigacji (opcjonalnie).
- **Typy**:
    - Brak DTO.
    - Opcjonalny lokalny `ViewModel`:
        - `RecipeNewStartOptionVm { title: string; description: string; route: string; icon: string }`
- **Propsy**:
    - Brak.

### `RecipeNewAssistPageComponent`
- **Opis komponentu**:
    - Ekran przyjmowania danych wejściowych do AI: tryb „Tekst” albo „Obraz”.
    - Na „Dalej”:
        - jeśli wejście puste → przejście do pustego `/recipes/new` (bez wywołania AI),
        - jeśli wejście niepuste → wywołanie `AiRecipeDraftService`, zapis draftu w `RecipeDraftStateService`, przejście do `/recipes/new`.
    - Na błędy: pozostaje na `/recipes/new/assist` i pokazuje komunikat.
- **Główne elementy i dzieci**:
    - `pych-page-header` z tytułem „Dodaj przepis (AI)” i akcjami:
        - „Wróć” (→ `/recipes/new/start`)
        - „Dalej” (primary)
    - Przełącznik źródła (Tekst/Obraz) — np. `mat-button-toggle-group` lub `mat-segmented-button` (Material 3).
    - Dla źródła Tekst:
        - `mat-form-field` + `textarea` (reactive forms)
    - Dla źródła Obraz:
        - strefa „Wklej obraz (Ctrl+V)” reagująca na `paste` gdy ma fokus
        - podgląd obrazu (DataURL) + akcja „Usuń obraz”
    - Sekcja komunikatu (błąd walidacyjny 422, błąd techniczny 4xx/5xx, rate limit 429)
    - Loader / stan przetwarzania (disabled przycisków + spinner), bez białych overlay (zgodnie z zasadami projektu).
- **Obsługiwane zdarzenia**:
    - `sourceChange('text' | 'image')`
    - `textChange`
    - `paste` dla obrazu:
        - wyciągnięcie `ClipboardItem` → `Blob` → walidacja MIME typu i rozmiaru → zapis do stanu komponentu
    - `onNext()`
    - `onBack()`
    - `onRemoveImage()`
- **Walidacja (szczegółowa)**:
    - **Tryb albo-albo**:
        - jeśli `source='text'`: ignoruj/zeruj obraz,
        - jeśli `source='image'`: ignoruj/zeruj tekst.
    - **Puste wejście**:
        - jeśli `text.trim().length === 0` (dla tekstu) lub brak obrazu (dla obrazu) → **nie wywołuj AI**, tylko przejdź do `/recipes/new`.
    - **Walidacja obrazu** (zgodna z ograniczeniami projektu dla obrazów):
        - MIME: `image/png | image/jpeg | image/webp`
        - max rozmiar: 10 MB (jeśli w API AI jest mniejszy limit, UI powinno użyć mniejszego; w MVP przyjmujemy 10 MB).
        - jeśli brak obrazu w schowku → komunikat „W schowku nie ma obrazu”.
    - **Walidacja zapytania do API**:
        - `AiRecipeDraftRequestDto`:
            - `source='text'`: `text` niepusty, `output_format='pycha_recipe_draft_v1'`, `language='pl'` (opcjonalnie)
            - `source='image'`: `image.mime_type` + `image.data_base64`, `output_format='pycha_recipe_draft_v1'`, `language='pl'`
- **Typy**:
    - `AiRecipeDraftRequestDto`, `AiRecipeDraftResponseDto`, `AiRecipeDraftUnprocessableEntityDto` (z `shared/contracts/types.ts`)
    - `RecipeNewAssistViewModel` (lokalny):
        - `source: 'text' | 'image'`
        - `text: string`
        - `imageFile: File | null`
        - `imagePreviewUrl: string | null`
        - `isLoading: boolean`
        - `errorMessage: string | null`
        - `unprocessableReasons: string[]`
- **Propsy**:
    - Brak.

### `AiRecipeDraftService`
- **Opis**:
    - Pojedyncza odpowiedzialność: wywołanie Edge Function `POST /ai/recipes/draft` przez `supabase.functions.invoke(...)` (zgodnie z zasadą: frontend nie robi `supabase.from(...)`).
- **API**:
    - `generateDraft(request: AiRecipeDraftRequestDto): Observable<AiRecipeDraftResponseDto>`
- **Obsługa błędów**:
    - 422 → mapuj payload do `AiRecipeDraftUnprocessableEntityDto` i zwróć błąd domenowy (np. `AiDraftValidationError`) z `reasons`
    - 429 → komunikat o limicie i sugestia ponowienia później
    - 401/403 → komunikat o braku autoryzacji (choć widok jest za guardem, warto mieć fallback)
    - 413 → komunikat o zbyt dużym obrazie
    - inne → ogólny komunikat + log techniczny (console.error)

### `RecipeDraftStateService`
- **Opis**:
    - Przechowuje draft wygenerowany przez AI w pamięci aplikacji (signals), aby `RecipeFormPageComponent` mógł go zastosować po nawigacji do `/recipes/new`.
    - Zapewnia operacje: `setDraft`, `clearDraft`, `consumeDraft` (jednorazowe użycie).
- **Stan**:
    - `draft: AiRecipeDraftDto | null`
    - `meta: AiRecipeDraftMetaDto | null`
    - `createdAt: number | null` (do TTL; np. 10 minut)
- **Zasady**:
    - `consumeDraft()` zwraca draft i czyści stan (żeby odświeżenie formularza nie nakładało ponownie danych).
    - Jeśli draft jest „stary” (TTL) → traktuj jak brak draftu.

### Zmiana: `RecipeFormPageComponent` (prefill)
- **Opis**:
    - Bez zmiany trasy `/recipes/new`, ale dodajemy „prefill hook” podczas create mode.
    - Gdy istnieje draft w `RecipeDraftStateService`, komponent:
        - uzupełnia `name`, `description`
        - rozbija `ingredients_raw` i `steps_raw` na listy (po `\n`) i wypełnia `FormArray`
        - mapuje `tags` do `FormArray`
        - próbuje mapować `category_name` na `category_id` (po pobraniu kategorii)
- **Walidacja i edge cases**:
    - `ingredients_raw` / `steps_raw`: jeśli puste po trim → nie nadpisuj istniejących wartości (zostaw puste, walidacja formularza to pokaże).
    - `tags`: deduplikacja w UI (opcjonalnie) lub zakładamy, że AI zwraca już deduplikowane.
    - `category_name`: mapowanie case-insensitive + trim; jeśli brak dopasowania → `categoryId=null` i ewentualny hint w UI.
- **Technika**:
    - Prefill najlepiej wykonać:
        - w `ngOnInit()` po `initForm()` oraz po inicjalnym `loadCategories()` (lub przez `effect()` obserwujący `categories()` i „pending draft”).
    - Draft powinien być stosowany **tylko w create mode** (gdy nie ma `:id`).

### Zmiany: wejścia do tworzenia przepisu
Aktualizujemy linki „Dodaj przepis” tak, by prowadziły do kreatora:
- `/my-recipies` (header i empty state): `/recipes/new` → `/recipes/new/start`
- Sidebar (footer „Dodaj przepis”): `/recipes/new` → `/recipes/new/start`
- Dashboard (empty state w „Ostatnio dodane”): `/recipes/new` → `/recipes/new/start`

## 5. Typy
### DTO (już istniejące)
Wykorzystujemy typy z `shared/contracts/types.ts`:
- `AiRecipeDraftRequestDto`
- `AiRecipeDraftResponseDto`
- `AiRecipeDraftDto`
- `AiRecipeDraftMetaDto`
- `AiRecipeDraftUnprocessableEntityDto`

### Nowe typy (proponowane)
- `RecipeNewAssistViewModel`
    - `source: 'text' | 'image'`
    - `text: string`
    - `imageFile: File | null`
    - `imagePreviewUrl: string | null`
    - `isLoading: boolean`
    - `errorMessage: string | null`
    - `unprocessableReasons: string[]`
- `AiDraftValidationError` (custom error)
    - `message: string`
    - `reasons: string[]`
    - `status: 422`

## 6. Zarządzanie stanem
### Podejście
- Komponenty stron: lokalne UI state przez `signal()` + reactive forms (dla text area).
- Stan „cross-route”: `RecipeDraftStateService` jako singleton z `signal()`:
    - minimalny stan konieczny do prefill formularza,
    - możliwość jednokrotnego użycia (`consumeDraft()`).

### Dlaczego nie query params / router state
- Draft może zawierać długi tekst, a w przyszłości base64 obrazu (nie powinien lądować w URL).
- `history.state` jest nietrwałe i mniej debugowalne w dłuższych flow.
- Serwis stanu jest zgodny z preferencją projektu: signals zamiast złożonego RxJS state management.

## 7. Integracja API
### Endpoint
- `POST /ai/recipes/draft` (Supabase Edge Function)
    - Wywołanie z frontu przez `supabase.functions.invoke('ai/recipes/draft', { method: 'POST', body })` lub zgodnie z aktualnym routingiem functions (w projekcie endpointy są mapowane jako ścieżki w `invoke()`).

### Typy request/response
- Request: `AiRecipeDraftRequestDto`
- Response success: `AiRecipeDraftResponseDto`
- Response 422: `AiRecipeDraftUnprocessableEntityDto`

### Zasady (z PRD / API plan)
- **Nie wywołuj endpointu**, jeśli wejście jest puste — przejdź do pustego formularza.
- Obsłuż 422 jako „to nie jest pojedynczy przepis” i pozostań na ekranie wklejania.
- Wymuś `output_format='pycha_recipe_draft_v1'` dla deterministycznego parsowania.

## 8. Interakcje użytkownika
### `/recipes/new/start`
- **Użytkownik wybiera „Pusty formularz”** → przejście do `/recipes/new` (czysty stan, bez draftu).
- **Użytkownik wybiera „Z tekstu/zdjęcia (AI)”** → przejście do `/recipes/new/assist`.
- **Użytkownik klika „Anuluj”** → powrót do poprzedniej strony (lub `/my-recipies`).

### `/recipes/new/assist`
- **Tryb Tekst**:
    - wkleja tekst → „Dalej”
        - jeśli tekst pusty → `/recipes/new` bez prefill
        - jeśli tekst niepusty → loader → draft → `/recipes/new` z prefill
- **Tryb Obraz**:
    - fokus na strefie → `Ctrl+V` z obrazem → preview
    - „Usuń obraz” czyści preview
    - „Dalej”
        - jeśli brak obrazu → `/recipes/new` bez prefill
        - jeśli jest obraz → loader → draft → `/recipes/new` z prefill
- **Błąd 422**:
    - pokazujemy czytelny komunikat (np. „Wklejony materiał nie opisuje jednego przepisu”) + opcjonalnie lista powodów
    - pozostajemy na `/recipes/new/assist`
- **Błąd techniczny**:
    - snackbar/toast + komunikat w widoku + możliwość ponowienia (klik „Dalej” ponownie)

### `/recipes/new` (po AI)
- Formularz jest wstępnie wypełniony:
    - tytuł, opis, składniki, kroki, tagi, (kategoria jeśli dopasowana)
- Użytkownik edytuje dane i zapisuje jak dotychczas.

## 9. Warunki i walidacja
### Warunki UI
- „Dalej” w `/recipes/new/assist`:
    - disabled gdy `isLoading=true`
    - disabled gdy tryb obraz i `imageUploading` (nie dotyczy; tu nie uploadujemy do storage)
- Przełączanie źródła:
    - zmiana na `text` → usuń obraz z modelu
    - zmiana na `image` → wyczyść tekst (lub ignoruj w request)

### Warunki API (weryfikacja w komponentach)
- `source=text`:
    - jeśli `text.trim().length > 0` → wolno wołać API
- `source=image`:
    - jeśli `imageFile !== null` i przechodzi walidację MIME/rozmiaru → wolno wołać API
- `output_format` zawsze ustawiony na `pycha_recipe_draft_v1`

## 10. Obsługa błędów
- **422 Unprocessable Entity**:
    - dedykowany komunikat domenowy + lista `reasons` (opcjonalnie w accordion)
    - bez nawigacji do formularza
- **429 Too Many Requests**:
    - komunikat „Osiągnięto limit — spróbuj ponownie później”
- **413 Payload Too Large**:
    - komunikat o zbyt dużym obrazie
- **401/403**:
    - komunikat o braku autoryzacji + opcjonalnie przekierowanie do `/login`
- **Inne (5xx/Network)**:
    - komunikat ogólny + snackbar + pozwól ponowić

## 11. Kroki implementacji
1. Zrefaktoryzuj routing `recipes.routes.ts` tak, aby wspierał `/recipes/new/start` i `/recipes/new/assist` bez konfliktu z `/recipes/new` (najlepiej przez `children` pod `path: 'new'`).
2. Dodaj `RecipeNewStartPageComponent` (standalone, OnPush, Material).
3. Dodaj `RecipeNewAssistPageComponent` (standalone, OnPush) wraz z UI przełącznika Tekst/Obraz, stanami ładowania i komunikatami.
4. Dodaj `AiRecipeDraftService` wywołujący Edge Function `POST /ai/recipes/draft` przez `supabase.functions.invoke` (bez `supabase.from`).
5. Dodaj `RecipeDraftStateService` (signals) i zepnij go z flow:
    - `/recipes/new/assist` → zapis draftu → nawigacja do `/recipes/new`
    - `/recipes/new/start` → czyszczenie draftu przy wyborze pustego formularza
6. Rozszerz `RecipeFormPageComponent` o jednorazowy „prefill” z `RecipeDraftStateService` w create mode:
    - mapowanie pól draftu na form controls
    - mapowanie `category_name` na `category_id` po załadowaniu kategorii
7. Zaktualizuj wejścia „Dodaj przepis”:
    - `recipes-list-page.component.html` (header + empty state)
    - `sidebar.component.html`
    - `recent-recipes-list.component.html` (empty state)
    - inne miejsca wystąpienia `/recipes/new` jako CTA (jeśli istnieją)
8. Dodaj podstawowe testy jednostkowe (Vitest) dla:
    - mapowania draftu do formularza (parser `ingredients_raw/steps_raw`)
    - walidacji obrazu (MIME/size) w assist view
    - obsługi błędów 422/429 (mock serwisu)
9. Ręczna weryfikacja:
    - „Pusty formularz” → `/recipes/new` bez prefill
    - Tekst → draft → prefill
    - Obraz → draft → prefill
    - 422 → pozostanie na `/recipes/new/assist`
    - brak wejścia → `/recipes/new` bez AI


