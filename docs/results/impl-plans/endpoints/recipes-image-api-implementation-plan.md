# API Endpoints Implementation Plan: POST /recipes/{id}/image

## 1. Przegląd punktu końcowego
Endpoint służy do **uploadu lub podmiany zdjęcia** przypisanego do przepisu użytkownika (scenariusze „paste from clipboard” oraz drag&drop). Plik jest zapisywany w **Supabase Storage**, a następnie aktualizowana jest kolumna **`recipes.image_path`**.

- **Metoda**: `POST`
- **URL**: `/recipes/{id}/image` (w praktyce Supabase Edge: `/functions/v1/recipes/{id}/image`)
- **Dostęp**: prywatny (wymaga JWT z Supabase Auth)

## 2. Szczegóły żądania
- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes/{id}/image`
- **Parametry**:
  - **Wymagane**:
    - `id` (path, integer > 0): identyfikator przepisu
    - `file` (multipart/form-data): plik obrazu
  - **Opcjonalne**: brak
- **Headers**:
  - `Authorization: Bearer <JWT>` (wymagany)
  - `Content-Type: multipart/form-data; boundary=...` (wymagany)
- **Body**:
  - `multipart/form-data`
  - pole `file` typu `File`

### Wykorzystywane typy (DTO/Command)
- **Nowe DTO (shared/contracts)**:
  - `UploadRecipeImageResponseDto`:
    - `id: number`
    - `image_path: string` (ścieżka obiektu w Storage lub public URL – zgodnie z decyzją projektu)
    - `image_url?: string` (opcjonalny, wygodny URL do wyświetlenia)
- **Backend (Edge Function) – input**:
  - brak JSON body (wyłącznie `FormData`)

### Walidacja wejścia (zgodnie ze specyfikacją)
- **`id`**:
  - parse do int
  - > 0
  - jeśli niepoprawne → `400`
- **`file`**:
  - wymagany (brak → `400`)
  - dopuszczalne typy MIME: `image/png`, `image/jpeg`, `image/webp` (inne → `400`)
  - rozmiar maks.: **10 MB** (większy → `400`)
  - dodatkowo: jeśli `Content-Type` nie jest `multipart/form-data` → `400`

## 3. Szczegóły odpowiedzi
### Sukces
- **Kod**: `200 OK`
- **Payload** (`application/json`):

```json
{
  "id": 1,
  "image_path": "recipe-images/<userId>/<recipeId>/cover_1700000000.webp",
  "image_url": "https://.../storage/v1/object/public/recipe-images/..."
}
```

Uwagi:
- `image_url` jest **opcjonalny** (może zostać pominięty jeśli frontend potrafi sam budować URL lub jeśli bucket jest prywatny i stosujemy signed URLs w innym miejscu).

## 4. Przepływ danych
1. **Routing** w `supabase/functions/recipes/recipes.handlers.ts` rozpoznaje ścieżkę `/recipes/{id}/image`.
2. Handler:
   - weryfikuje JWT (`getAuthenticatedContext`),
   - waliduje `id`,
   - parsuje `FormData` i waliduje plik.
3. Handler pobiera z bazy „stan obecny” przepisu (istnienie + własność + `deleted_at IS NULL`) przez **authenticated client** (RLS).
4. Serwis uploaduje plik do **Supabase Storage** (bucket: `recipe-images`) pod **wygenerowaną ścieżką**.
5. Serwis aktualizuje `recipes.image_path` w bazie.
6. (Best-effort) Serwis usuwa poprzedni obiekt Storage (jeśli istniał), aby ograniczyć „osierocone” pliki.
7. Handler zwraca `200` z `image_path` (+ opcjonalnie `image_url`).

## 5. Względy bezpieczeństwa
- **Uwierzytelnianie**: zawsze wymagany `Authorization: Bearer <JWT>`.
- **Autoryzacja / własność**:
  - domyślnie wymuszona przez RLS (`recipes.user_id = auth.uid()`),
  - dodatkowo w logice endpointu sprawdzamy istnienie przepisu przed uploadem (żeby nie tworzyć plików dla nieistniejących/nie-swoich zasobów).
- **Bezpieczeństwo uploadu**:
  - whitelist MIME (`png/jpeg/webp`) i limit rozmiaru 10MB (ochrona przed DoS i kosztami Storage),
  - **nie używać nazwy pliku od klienta** do budowania ścieżki (ochrona przed path traversal / kolizjami),
  - logowanie bez danych wrażliwych (nie logować tokenów, nie logować całego pliku).
- **Storage policies**:
  - bucket `recipe-images` powinien mieć polityki, które ograniczają dostęp do obiektów per użytkownik (np. prefiks `userId/…`) lub być publiczny tylko do odczytu; decyzję trzeba spiąć z tym, czy zwracamy `publicUrl`.

## 6. Obsługa błędów
Zwracamy błędy w tym samym formacie co pozostałe Edge Functions (`{ code, message }`).

Scenariusze:
- **401 Unauthorized**:
  - brak nagłówka `Authorization` lub niepoprawny/wygaśnięty JWT (`getAuthenticatedContext`).
- **400 Bad Request**:
  - `id` nie jest dodatnim int,
  - brak `multipart/form-data`,
  - brak pola `file`,
  - niedozwolony MIME,
  - plik > 10MB.
- **404 Not Found**:
  - przepis nie istnieje, jest soft-deleted, albo użytkownik nie jest właścicielem (RLS sprawi, że rekord nie będzie widoczny).
- **500 Internal Server Error**:
  - błąd uploadu do Storage,
  - błąd aktualizacji w bazie,
  - inne nieobsłużone wyjątki.

Uwagi implementacyjne:
- Jeżeli upload do Storage powiedzie się, ale update w DB nie, należy wykonać **rollback** (spróbować usunąć nowo-wgrany obiekt), żeby nie zostawiać śmieci.

## 7. Wydajność
- Limit 10MB minimalizuje koszty i czas transferu.
- Używać **jednego** uploadu i **jednego** update w DB (bez dodatkowych JOIN).
- Generować ścieżki deterministycznie i płasko (np. `userId/recipeId/...`) dla łatwiejszego zarządzania.
- Usuwanie starego pliku wykonywać **best-effort** (po sukcesie DB), aby nie wydłużać krytycznej ścieżki w razie sporadycznych błędów usuwania.

## 8. Kroki implementacji
1. **Routing**: rozbudować router w `supabase/functions/recipes/recipes.handlers.ts` o obsługę ścieżki `/recipes/{id}/image`:
   - sprawdzać dłuższą ścieżkę przed standardowym `/recipes/{id}` (zgodnie z zasadą „najpierw bardziej specyficzne”).
2. **Handler**: dodać `handleUploadRecipeImage(req, recipeIdParam)`:
   - `getAuthenticatedContext(req)`,
   - walidacja `recipeId` (re-użyć `parseAndValidateRecipeId`),
   - `await req.formData()` i pobranie `file`,
   - walidacja MIME i `file.size`.
3. **Serwis**: dodać w `supabase/functions/recipes/recipes.service.ts` funkcję np. `uploadRecipeImage(client, { recipeId, userId, file })`:
   - sprawdzenie, czy przepis istnieje i pobranie `oldImagePath` (SELECT `image_path` z `recipes` z warunkiem `id`, `user_id`, `deleted_at IS NULL`),
   - upload do `client.storage.from('recipe-images')` pod ścieżką np. `/${userId}/${recipeId}/cover_${Date.now()}.${ext}` (ext na bazie MIME),
   - update `recipes.image_path` na nową ścieżkę (lub public URL – zgodnie z decyzją),
   - rollback: jeśli update się nie powiedzie → usuń nowy obiekt,
   - best-effort: jeśli był `oldImagePath` → usuń stary obiekt.
4. **Response**: w handlerze zbudować `UploadRecipeImageResponseDto`:
   - `image_path` = ścieżka obiektu (lub URL),
   - `image_url` = `getPublicUrl()` (jeśli bucket publiczny) lub `createSignedUrl()` (jeśli prywatny) – opcjonalnie.
5. **Typy współdzielone**: dodać `UploadRecipeImageResponseDto` do `shared/contracts/types.ts`.
6. **Polityki Storage** (jeśli wymagane): doprecyzować w Supabase (bucket `recipe-images`) zasady odczytu/zapisu.
7. **Dokumentacja**: dopisać endpoint do `docs/results/main-project-docs/009 API plan.md` (jeśli nie ma) oraz do `docs/results/impl-plans/endpoints/README.md` jako „plan gotowy”.
8. **Testy manualne (lokalnie)**:
   - `supabase functions serve recipes`
   - wysłać multipart `POST /functions/v1/recipes/{id}/image` z poprawnym JWT
   - przypadki: png/jpg/webp, brak pliku, zły MIME, >10MB, nieistniejący `id`, cudzy `id`.
