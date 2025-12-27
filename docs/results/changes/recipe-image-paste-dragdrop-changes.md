## 1. Historyjki użytkownika

### US-005 — Edycja istniejącego przepisu (zmienione)
- **Co się zmieniło**: doprecyzowano zmianę zdjęcia w edycji: oprócz wyboru pliku (fallback) użytkownik może **wkleić obraz (Ctrl+V)** lub **przeciągnąć i upuścić plik obrazu** na pole zdjęcia. Upload startuje **automatycznie** po udanym paste/drop, z widocznym stanem ładowania oraz możliwością **Cofnij** (do czasu zapisu) i **Usuń zdjęcie**.

### US-027 — Szybka zmiana zdjęcia przepisu przez wklejenie lub przeciągnięcie (edycja) (nowe)
- **Opis**: użytkownik edytujący przepis może szybko podmienić zdjęcie bez szukania pliku w systemie.
- **Kluczowe kryteria**:
  - Strefa zdjęcia z instrukcją „Wklej (Ctrl+V) lub przeciągnij plik” + fallback „Wybierz plik”.
  - Walidacja: `image/png`, `image/jpeg`, `image/webp`, max `10 MB`.
  - Auto-upload po paste/drop, podgląd po sukcesie, obsługa błędów i „Cofnij”.

## 2. Widoki

### Formularz przepisu — sekcja „Zdjęcie” (zmienione)
- **Gdzie**: `/recipes/:id/edit` (edycja przepisu; analogicznie komponent w formularzu).
- **Co się zmieniło**:
  - Sekcja zdjęcia jest **strefą paste/drop** (Ctrl+V + drag&drop pliku obrazu z dysku) z jasno widocznymi stanami: `idle`, `dragover`, `uploading`, `success`, `error`.
  - Upload startuje **od razu** po paste/drop.
  - Dostępne akcje: fallback „Wybierz plik”, „Usuń zdjęcie”, Snackbar z „Cofnij” (do czasu zapisu).

## 3. API

### `POST /recipes/{id}/image` (nowe)
- **Cel**: upload/podmiana zdjęcia przepisu (wspiera flow Ctrl+V i drag&drop w edycji).
- **Request**: `multipart/form-data`, pole `file`.
- **Walidacja**: typy `image/png`, `image/jpeg`, `image/webp`, max `10 MB`.
- **Response (200)**: zwraca co najmniej `image_path` oraz `image_url`.

### `DELETE /recipes/{id}/image` (nowe)
- **Cel**: usunięcie zdjęcia przepisu (ustawienie `image_path = NULL`).
- **Response (204)**: brak treści.
