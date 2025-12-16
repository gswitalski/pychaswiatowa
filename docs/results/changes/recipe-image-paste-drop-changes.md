# Recipe image paste & drop — zmiany

## 1. Historyjki użytkownika

### Nowe

-   **US-027: Szybka zmiana zdjęcia przepisu przez wklejenie lub przeciągnięcie (edycja)**
    -   **Co wnosi**: możliwość wklejenia obrazu ze schowka (Ctrl+V) lub przeciągnięcia pliku na pole zdjęcia w formularzu edycji.
    -   **Walidacja**: PNG/JPG/WebP, max 10 MB.
    -   **Zachowanie**: auto-upload od razu po paste/drop, podgląd, komunikaty błędów, Snackbar z akcją „Cofnij” (do czasu zapisu).

### Zmienione

-   **US-005: Edycja istniejącego przepisu**
    -   **Co się zmieniło**: doprecyzowano zmianę zdjęcia (paste/drop + fallback wybór pliku), dodano walidację typów/rozmiaru, auto-upload, „Cofnij” i „Usuń zdjęcie”.

## 2. Widoki

### Zmienione

-   **Widok 9: Formularz Przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
    -   **Co się zmieniło**: sekcja **Zdjęcie** działa jako strefa paste/drop (Ctrl+V + drag&drop pliku z dysku) z wyraźnymi stanami UI (idle/dragover/uploading/success/error), walidacją, auto-upload oraz Snackbar „Cofnij” i akcją „Usuń zdjęcie”.

### Zmienione komponenty

-   **`ImageUploadComponent`**
    -   **Co się zmieniło**: poza wyborem pliku obsługuje wklejanie ze schowka i drag&drop, pokazuje progres uploadu, błędy oraz wspiera „Cofnij” (Undo) do czasu zapisu.

## 3. API

### Nowe

-   **`POST /recipes/{id}/image`**
    -   **Cel**: upload / podmiana zdjęcia przepisu (dla paste/drop).
    -   **Wejście**: `multipart/form-data` z polem `file`.
    -   **Walidacja**: `image/png`, `image/jpeg`, `image/webp`, max 10 MB.
    -   **Wyjście**: `200 OK` z `image_path` (+ opcjonalnie `image_url`).

-   **`DELETE /recipes/{id}/image`**
    -   **Cel**: usunięcie zdjęcia przepisu (ustawienie `image_path = NULL`, opcjonalnie kasowanie obiektu w storage).
    -   **Wyjście**: `204 No Content`.
