# API Endpoint Implementation Plan: DELETE /recipes/{id}/image

## 1. Przegląd punktu końcowego
Endpoint `DELETE /recipes/{id}/image` służy do **usunięcia zdjęcia przepisu** poprzez ustawienie `recipes.image_path = NULL`. Dodatkowo (opcjonalnie, implementacyjnie) endpoint może wykonać **best-effort usunięcie obiektu** z Supabase Storage, aby nie zostawiać „osieroconych” plików.

- **Metoda**: `DELETE`
- **URL**: `/recipes/{id}/image` (Supabase Edge: `/functions/v1/recipes/{id}/image`)
- **Dostęp**: prywatny (wymaga JWT z Supabase Auth)
- **Zasady domenowe**:
    - operujemy tylko na przepisach nieusuniętych soft-delete (`deleted_at IS NULL`)
    - użytkownik może modyfikować tylko swoje przepisy (RLS: `auth.uid() = recipes.user_id`)

## 2. Szczegóły żądania
- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/recipes/{id}/image`
- **Parametry**:
    - **Wymagane**:
        - `id` (path, integer > 0): identyfikator przepisu
        - nagłówek `Authorization: Bearer <JWT>`
    - **Opcjonalne**: brak
- **Request Body**: brak

### Walidacja danych wejściowych
Zgodnie z zasadami projektu (walidacja w `*.handlers.ts` + Zod):
- `id`:
    - parse do `number` (integer)
    - `> 0`
    - niepoprawne → `400 Bad Request`

## 3. Wykorzystywane typy
- **DTO sukcesu**: brak (endpoint zwraca `204 No Content` bez payloadu).
- **Model błędu**: zgodny z konwencją projektu z `supabase/functions/_shared/errors.ts` (np. `{ "code": "UNAUTHORIZED", "message": "..." }`).

Typy pomocnicze (wewnętrzne, w Edge Function):
- `DeleteRecipeImageParams`:
    - `recipeId: number`
    - `userId: string`

## 4. Szczegóły odpowiedzi
### Sukces
- **Kod**: `204 No Content`
- **Body**: brak

### Błędy (scenariusze)
- **400 Bad Request**:
    - `id` nie jest dodatnim int
- **401 Unauthorized**:
    - brak nagłówka `Authorization` lub niepoprawny/wygaśnięty JWT
- **403 Forbidden**:
    - użytkownik nie jest właścicielem przepisu (jeżeli warstwa API rozróżnia to od `404`; w przeciwnym razie RLS może skutkować `404`)
- **404 Not Found**:
    - przepis nie istnieje lub jest soft-deleted (`deleted_at IS NOT NULL`)
- **500 Internal Server Error**:
    - błąd aktualizacji w bazie
    - nieobsłużony wyjątek

Uwaga: błędy z usuwania pliku w Storage powinny być traktowane jako **best-effort** (log `warn/error`), ale nie powinny blokować odpowiedzi `204`, o ile `image_path` w DB zostało wyczyszczone.

## 5. Przepływ danych
1. Żądanie trafia do Edge Function `supabase/functions/recipes/index.ts`.
2. `index.ts`:
    - obsługuje `OPTIONS` (CORS) → `204`
    - deleguje do routera w `recipes.handlers.ts`
    - łapie nieobsłużone wyjątki i mapuje je na `500`
3. `recipes.handlers.ts`:
    - dopasowuje ścieżkę `/recipes/{id}/image` (bardziej specyficzna niż `/recipes/{id}`), metoda `DELETE`
    - wywołuje `getAuthenticatedContext(req)` (weryfikacja JWT)
    - waliduje `id`
    - wywołuje serwis: `deleteRecipeImage(client, { recipeId, userId })`
    - zwraca `204`
4. `recipes.service.ts` (logika biznesowa):
    - krok 1: pobiera aktualny `image_path` dla przepisu użytkownika:
        - `SELECT image_path FROM recipes WHERE id = :recipeId AND user_id = :userId AND deleted_at IS NULL`
        - brak rekordu → `NOT_FOUND`
    - krok 2: jeśli `image_path` jest już `NULL`:
        - operacja jest **idempotentna** → zwróć sukces (handler i tak zwraca `204`)
    - krok 3: aktualizuje rekord:
        - `UPDATE recipes SET image_path = NULL WHERE ...` (te same warunki co wyżej)
    - krok 4 (opcjonalnie, best-effort): usuwa obiekt Storage dla poprzedniego `image_path`:
        - bucket zgodny z uploadem: `recipe-images`
        - `storage.from('recipe-images').remove([oldImagePath])`

### Decyzja dot. klienta Storage
- Jeśli polityki Storage pozwalają na usuwanie obiektów przez użytkownika (np. po prefiksie `/${userId}/...`), można użyć klienta z JWT.
- Jeśli polityki Storage są ograniczone lub bucket jest zarządzany centralnie, zalecane jest użycie **service role key** po stronie Edge Function wyłącznie do operacji na Storage, z dodatkowymi guardami:
    - ścieżka do usunięcia musi pochodzić z DB (nie z requestu)
    - ścieżka musi pasować do oczekiwanego wzorca (np. zaczyna się od `${userId}/${recipeId}/`)

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**:
    - wymagany JWT; token nie może być logowany
- **Autoryzacja / własność**:
    - wymuszona przez RLS (`recipes.user_id = auth.uid()`)
    - defensywnie w serwisie: filtr po `user_id` + `deleted_at IS NULL`
- **Bezpieczeństwo operacji na Storage**:
    - usuwać wyłącznie plik wynikający z `recipes.image_path` pobranego z DB
    - nie przyjmować ścieżki pliku w query/body
    - walidować wzorzec ścieżki przed usunięciem (ochrona przed błędną konfiguracją / eskalacją)
- **CORS**:
    - spójne nagłówki jak w innych Edge Functions, uwzględnić `Authorization` w `Access-Control-Allow-Headers`

## 7. Rozważania dotyczące wydajności
- Operacja powinna zamknąć się w:
    - 1x `SELECT` (odczyt `image_path`)
    - 1x `UPDATE` (ustawienie `NULL`)
    - 0–1x usunięcie obiektu Storage (best-effort)
- Usuwanie w Storage może być wolniejsze i bardziej zawodne niż DB – dlatego jest wykonywane **po** sukcesie DB i nie blokuje odpowiedzi.

## 8. Kroki implementacji
1. **Routing w `recipes.handlers.ts`**
    - dodać dopasowanie ścieżki `/recipes/{id}/image` dla metody `DELETE`
    - upewnić się, że jest sprawdzane przed `/recipes/{id}` (zasada „najpierw bardziej specyficzne”)
2. **Handler**
    - dodać `handleDeleteRecipeImage(req, recipeIdParam)`:
        - `getAuthenticatedContext(req)`
        - walidacja `recipeId`
        - wywołanie serwisu
        - odpowiedź `204`
3. **Serwis**
    - dodać funkcję `deleteRecipeImage(client, { recipeId, userId })`:
        - pobranie `oldImagePath`
        - update `image_path = null`
        - best-effort `storage.remove([oldImagePath])`
        - logowanie: `info` start/koniec, `warn` przy braku pliku/nieudanym usunięciu storage, `error` przy błędach DB
4. **Obsługa błędów**
    - stosować `ApplicationError` + `handleError()` z `_shared/errors.ts`
    - w projekcie nie ma zdefiniowanej tabeli błędów w DB planie, więc:
        - logować przez istniejący `logger`
        - nie dodawać zapisu do DB (chyba że w przyszłości pojawi się tabela audytu/błędów)
5. **Testy manualne (lokalnie)**
    - `supabase functions serve recipes`
    - scenariusze:
        - `204`: przepis istnieje, ma zdjęcie → `image_path` staje się `NULL`
        - `204`: przepis istnieje, `image_path` już `NULL` (idempotencja)
        - `400`: `id` niepoprawne
        - `401`: brak/niepoprawny JWT
        - `403/404`: cudzy `id` lub nieistniejący/soft-deleted przepis
        - (opcjonalnie) zasymulować błąd Storage: sprawdzić, że DB się czyści, a endpoint nadal zwraca `204` i loguje ostrzeżenie
