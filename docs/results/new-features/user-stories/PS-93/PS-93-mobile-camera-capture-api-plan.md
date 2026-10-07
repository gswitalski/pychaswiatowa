# PS-93: Zrobienie zdjęcia aparatem urządzenia mobilnego — Plan API

> **User Story:** PS-93 — Zrobienie zdjęcia aparatem w formularzu przepisu i w asyście AI (tryb obrazu)
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Functions / REST aplikacji

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Endpointy REST | **Brak zmian** | Aparat dostarcza plik obrazu po stronie klienta; ten sam kontrakt co wybór pliku / paste / schowek |
| Edge Functions | **Brak zmian** | Po walidacji MIME/rozmiaru w UI obraz trafia istniejącą ścieżką uploadu / draftu AI |
| Baza danych | **Brak zmian** | — |
| Storage | **Brak zmian** | — |
| Zmienne środowiskowe | **Brak nowych** | Limit 10 MB i typy PNG/JPG/WebP pozostają regułami frontendu spójnymi z backendem |

Funkcjonalność PS-93 jest **wyłącznie kliencka**. Natywny `<input type="file" capture="environment">` uruchamia systemowy aparat (lub fallback pickera plików); aplikacja nie wysyła do backendu nic innego niż dotychczas.

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

**Przepływ po PS-93 (bez zmian kontraktu):**

1. Użytkownik na `/recipes/:id/edit` klika „Zrób zdjęcie”, robi zdjęcie w UI systemowym.
2. Frontend odbiera `File` z eventu `change`, waliduje typ i rozmiar (ta sama logika co `onFileSelected` / `processFile`).
3. Przy sukcesie wywoływany jest ten sam upload co po drop / Ctrl+V / schowek / wybór pliku bez `capture`.
4. Odpowiedź `200` z `image_path` / `image_url` — bez zmian.

### Tryb tworzenia (`/recipes/new`)

Brak wywołania API w momencie zrobienia zdjęcia — plik trafia do **pending** i jest wysyłany przy zapisie przepisu (lub upload po utworzeniu), zgodnie z `RecipeImageUploadComponent`.

### Asysta AI (`POST /ai/recipes/draft`, tryb obrazu)

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | Bearer JWT |
| Body | Obraz (base64) + metadane żądania — **bez zmian** |

Przycisk na `/recipes/new/assist` jedynie dostarcza plik do istniejącego flow `handleImageFile()` → „Dalej” → generowanie draftu. Gating roli w UI (`premium`/`admin`) i rozliczenie kredytów `draft` — bez zmian.

---

## 3. Kody błędów API — bez wpływu PS-93

Walidacja po stronie klienta (nieobsługiwany MIME, > 10 MB) kończy się **komunikatem inline** w strefie obrazu; niepoprawny plik nie jest wysyłany do backendu.

Anulowanie systemowego dialogu aparatu (brak pliku w `change`) — **brak wywołania API**, brak błędu.

Ewentualne błędy uploadu / draftu pozostają jak dotychczas (np. `402 AI_CREDITS_EXHAUSTED`, `422 PLAN_LIMIT_EXCEEDED_FREE` przy zapisie — niezwiązane z PS-93).

---

## 4. Wymagania niefunkcjonalne (spójność z backendem)

| Reguła | Frontend (PS-93) | Backend (istniejący) |
|---|---|---|
| Dozwolone MIME | `image/png`, `image/jpeg`, `image/webp` | Ten sam whitelist w `POST /recipes/{id}/image` |
| Max rozmiar | 10 MB (`CLIPBOARD_IMAGE_MAX_BYTES` / stałe uploadu) | 10 MB |
| Autoryzacja uploadu | JWT przy edycji | JWT + właściciel przepisu |

---

## 5. Testy API / kontraktu

- **Brak nowych testów integracyjnych API** dla PS-93.
- Regresja: istniejące testy uploadu zdjęcia i draftu AI pozostają w mocy; scenariusze aparatu pokrywa warstwa frontendu (mock `HTMLInputElement` / event `change`).

---

## 6. Checklist implementacji (API)

- [ ] Potwierdzenie w review, że żadna Edge Function nie wymaga zmian
- [ ] Brak nowych wpisów w tabeli endpointów `docs/results/project-summary.md` (opcjonalna aktualizacja opisu produktowego po wdrożeniu)
