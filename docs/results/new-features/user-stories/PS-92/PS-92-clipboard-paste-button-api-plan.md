# PS-92: Dedykowany przycisk wklejania zdjęcia ze schowka — Plan API

> **User Story:** PS-92 — Dedykowany przycisk „Wklej ze schowka" w strefie zdjęcia formularza przepisu
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Functions / REST aplikacji

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Endpointy REST | **Brak zmian** | Odczyt schowka odbywa się w przeglądarce (`navigator.clipboard.read()`) |
| Edge Functions | **Brak zmian** | Po walidacji po stronie klienta obraz trafia tą samą ścieżką co paste/drop/file |
| Baza danych | **Brak zmian** | — |
| Storage | **Brak zmian** | — |
| Zmienne środowiskowe | **Brak nowych** | Limit 10 MB i MIME types pozostają regułami frontendu spójnymi z istniejącym API |

Funkcjonalność PS-92 jest **wyłącznie kliencka**. Po kliknięciu przycisku aplikacja odczytuje obraz ze schowka systemowego i przekazuje go do istniejącej logiki komponentu (podgląd, `pendingFile` w trybie tworzenia, auto-upload w edycji).

---

## 2. Istniejące endpointy używane bez modyfikacji

### `POST /recipes/{id}/image` (tryb edycji)

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/recipes/{id}/image` |
| Autoryzacja | Bearer JWT (wymagane) |
| Body | `multipart/form-data`, pole pliku |
| Ograniczenia | PNG, JPG, WebP; max **10 MB** |

**Przepływ po PS-92 (bez zmian kontraktu):**

1. Użytkownik klika „Wklej ze schowka" na `/recipes/:id/edit`.
2. Frontend odczytuje blob ze schowka, buduje `File`, waliduje typ i rozmiar.
3. Przy sukcesie wywoływany jest ten sam upload co po Ctrl+V / drop / wybór pliku.
4. Odpowiedź `200` z `image_path` / `image_url` — bez zmian.

### Tryb tworzenia (`/recipes/new`)

Brak wywołania API w momencie wklejenia — plik jest trzymany jako **pending** i wysyłany przy `POST /recipes` (lub osobnym uploadzie po utworzeniu), zgodnie z obecną logiką formularza.

### Asysta AI (`POST /ai/recipes/draft`, tryb obrazu)

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | Bearer JWT |
| Body | Obraz (base64) + metadane żądania — **bez zmian** |

Przycisk na `/recipes/new/assist` jedynie ułatwia dostarczenie pliku do istniejącego flow `handleImageFile()` → generowanie draftu.

---

## 3. Kody błędów API — bez wpływu PS-92

Walidacja schowka (brak obrazu, zły MIME, > 10 MB, brak uprawnień Clipboard API) kończy się **komunikatem w UI**; do backendu nie trafia niepoprawny plik.

Ewentualne błędy uploadu / draftu pozostają jak dotychczas (np. `402 AI_CREDITS_EXHAUSTED` przy asyście — niezwiązane z PS-92).

---

## 4. Wymagania niefunkcjonalne (spójność z backendem)

| Reguła | Frontend (PS-92) | Backend (istniejący) |
|---|---|---|
| Dozwolone MIME | `image/png`, `image/jpeg`, `image/webp` | Ten sam whitelist w `POST /recipes/{id}/image` |
| Max rozmiar | 10 MB | 10 MB |
| Autoryzacja uploadu | JWT przy edycji | JWT + właściciel przepisu |

---

## 5. Testy API / kontraktu

- **Brak nowych testów integracyjnych API** dla PS-92.
- Regresja: istniejące testy uploadu zdjęcia (jeśli są) pozostają w mocy; scenariusze schowka pokrywa warstwa frontendu (mock `navigator.clipboard`).

---

## 6. Checklist implementacji (API)

- [ ] Potwierdzenie w review, że żadna Edge Function nie wymaga zmian
- [ ] Brak nowych wpisów w `docs/results/project-summary.md` sekcji endpointów (opcjonalna aktualizacja summary po wdrożeniu — tylko opis produktowy, nie kontrakt HTTP)
