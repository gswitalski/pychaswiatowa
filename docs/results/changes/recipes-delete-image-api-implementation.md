# Implementacja endpointa DELETE /recipes/{id}/image

## Przegląd

Zaimplementowano endpoint REST API do usuwania obrazu przepisu poprzez ustawienie `recipes.image_path = NULL`. Endpoint wykonuje również best-effort usunięcie pliku z Supabase Storage.

**Data implementacji:** 2025-12-16
**Plan implementacji:** `docs/results/impl-plans/endpoints/recipes-delete-image-api-implementation-plan.md`

## Endpoint

- **Metoda:** `DELETE`
- **URL:** `/recipes/{id}/image`
- **Pełny URL (lokalny):** `http://127.0.0.1:54331/functions/v1/recipes/{id}/image`
- **Dostęp:** Prywatny (wymaga JWT z Supabase Auth)

## Parametry

### Wymagane
- **`id`** (path parameter, integer): Identyfikator przepisu (musi być dodatnią liczbą całkowitą)
- **`Authorization`** (header): Bearer token z JWT

### Request Body
Brak - endpoint nie przyjmuje body.

## Odpowiedzi

### Sukces
- **Status:** `204 No Content`
- **Body:** Brak

### Błędy
- **400 Bad Request:** Niepoprawny ID przepisu (nie jest dodatnią liczbą całkowitą)
- **401 Unauthorized:** Brak lub niepoprawny JWT token
- **404 Not Found:** Przepis nie istnieje, jest soft-deleted, lub użytkownik nie jest właścicielem
- **500 Internal Server Error:** Błąd bazy danych lub nieobsłużony wyjątek

## Zaimplementowane pliki

### 1. `supabase/functions/recipes/recipes.handlers.ts`

#### Dodany handler `handleDeleteRecipeImage`
```typescript
export async function handleDeleteRecipeImage(
    req: Request,
    recipeIdParam: string
): Promise<Response>
```

**Odpowiedzialności:**
- Walidacja `recipeId` za pomocą `parseAndValidateRecipeId`
- Pobranie kontekstu uwierzytelnionego użytkownika
- Delegacja logiki biznesowej do serwisu `deleteRecipeImage`
- Zwrócenie odpowiedzi `204 No Content`

#### Routing
Zaktualizowano funkcję `recipesRouter` w sekcji `DELETE`:
- Dodano sprawdzanie ścieżki `/recipes/{id}/image` przed `/recipes/{id}`
- Wykorzystano istniejącą funkcję `extractRecipeIdFromImagePath`

### 2. `supabase/functions/recipes/recipes.service.ts`

#### Dodana funkcja `deleteRecipeImage`
```typescript
export async function deleteRecipeImage(
    client: TypedSupabaseClient,
    params: DeleteRecipeImageParams
): Promise<void>
```

**Logika biznesowa:**
1. Pobranie aktualnego `image_path` z bazy danych (weryfikacja własności i istnienia)
2. Sprawdzenie idempotentności - jeśli `image_path` już `NULL`, zwrócenie sukcesu
3. Aktualizacja `recipes.image_path = NULL` w bazie
4. Best-effort: próba usunięcia pliku z Storage (nieblokujące, loguje tylko ostrzeżenia)

#### Dodany interfejs
```typescript
export interface DeleteRecipeImageParams {
    recipeId: number;
    userId: string;
}
```

### 3. `supabase/functions/recipes/index.ts`

Zaktualizowano dokumentację głównego pliku o nowy endpoint:
```
* DELETE /functions/v1/recipes/{id}/image
* Removes the image from an existing recipe by setting image_path to NULL.
* Also performs best-effort deletion of the image file from Storage.
* Response (204 No Content):
* - No response body
```

## Kluczowe cechy implementacji

### ✅ Bezpieczeństwo
- Weryfikacja JWT token przez `getAuthenticatedContext`
- Filtrowanie po `user_id` w zapytaniach SQL (dodatkowa ochrona oprócz RLS)
- Filtrowanie po `deleted_at IS NULL` (obsługa soft delete)
- Ścieżka pliku do usunięcia pochodzi z bazy danych (nie z requestu)

### ✅ Idempotentność
- Wielokrotne wywołanie DELETE na tym samym przepisie zwraca `204 No Content`
- Jeśli `image_path` już `NULL`, operacja kończy się sukcesem bez modyfikacji bazy

### ✅ Best-effort Storage Cleanup
- Usuwanie pliku z Storage nie blokuje odpowiedzi API
- Błędy Storage są logowane jako `warn`, ale nie powodują błędu `500`
- Operacja na bazie danych ma pierwszeństwo (najpierw NULL w DB, potem usunięcie z Storage)

### ✅ Walidacja
- Walidacja `recipeId` za pomocą dedykowanej funkcji `parseAndValidateRecipeId`
- Sprawdzanie czy ID jest dodatnią liczbą całkowitą
- Rzucanie `ApplicationError` z odpowiednimi kodami błędów

### ✅ Logowanie
- Logi na poziomie `info` dla normalnych operacji
- Logi na poziomie `warn` dla błędów Storage (nieblokujących)
- Logi na poziomie `error` dla błędów bazy danych
- Wszystkie logi zawierają kontekst (`recipeId`, `userId`, itp.)

### ✅ Obsługa błędów
- Spójne używanie `ApplicationError` z kodami błędów
- Obsługa przez `handleError` z `_shared/errors.ts`
- Właściwe kody statusu HTTP dla różnych scenariuszy

## Wyniki testów lokalnych

Wszystkie testy przeprowadzone lokalnie zakończone sukcesem:

| Test | Oczekiwany wynik | Wynik |
|------|------------------|-------|
| DELETE przepisu z obrazem | 204 No Content | ✅ PASS |
| DELETE z niepoprawnym ID (abc) | 400 Bad Request | ✅ PASS |
| DELETE nieistniejącego przepisu (99999) | 404 Not Found | ✅ PASS |
| DELETE bez autoryzacji | 401 Unauthorized | ✅ PASS |
| DELETE przepisu bez obrazu (idempotencja) | 204 No Content | ✅ PASS |

**Wynik ogólny:** 5/5 testów zakończonych sukcesem

### Przykładowe logi z testów

#### Test 1: Usunięcie obrazu z przepisu
```
[Info] Incoming request to /recipes (method: DELETE, url: .../recipes/1/image)
[Info] Handling DELETE /recipes/{id}/image request (recipeIdParam: "1")
[Info] Starting recipe image deletion (recipeId: 1, userId: "...")
[Info] Current image path found, proceeding with deletion (oldImagePath: "...")
[Info] Database updated - image_path set to NULL (recipeId: 1)
[Info] Attempting best-effort deletion of image file from Storage
[Info] Image file deleted from Storage successfully (oldImagePath: "...")
[Info] Recipe image deletion completed successfully (recipeId: 1)
[Info] DELETE /recipes/{id}/image completed successfully
```

#### Test idempotentności: Ponowne DELETE
```
[Info] Starting recipe image deletion (recipeId: 1, userId: "...")
[Info] Recipe image_path already NULL, operation is idempotent (recipeId: 1)
[Info] DELETE /recipes/{id}/image completed successfully
```

## Zgodność z planem implementacji

Implementacja jest w pełni zgodna z planem:
- ✅ Routing w `recipes.handlers.ts` sprawdza najpierw bardziej specyficzną ścieżkę
- ✅ Handler waliduje dane wejściowe i deleguje do serwisu
- ✅ Serwis wykonuje wszystkie kroki logiki biznesowej
- ✅ Idempotentność operacji DELETE
- ✅ Best-effort usunięcie z Storage (nieblokujące)
- ✅ Pełne logowanie operacji
- ✅ Odpowiednia obsługa błędów i walidacja
- ✅ Dokumentacja endpointa

## Zgodność z zasadami projektu

Implementacja przestrzega wszystkich zasad z `.cursor/rules/backend.mdc`:
- ✅ Architektura modularna (routing → handler → service)
- ✅ Separacja odpowiedzialności
- ✅ Walidacja w handlerze, logika biznesowa w serwisie
- ✅ Używanie `ApplicationError` dla błędów biznesowych
- ✅ Logowanie przez `logger` z odpowiednimi poziomami
- ✅ Row Level Security (filtrowanie po `user_id` i `deleted_at`)
- ✅ Soft delete aware (zawsze `deleted_at IS NULL`)

## Możliwe przyszłe usprawnienia

1. **Asynchroniczne usuwanie z Storage:** Możliwość użycia kolejki zadań dla usuwania plików z Storage
2. **Audyt operacji:** Dodanie logowania do tabeli audytu (jeśli zostanie dodana w przyszłości)
3. **Batch delete:** Endpoint do usuwania wielu obrazów jednocześnie
4. **Polityki Storage:** Rozważenie użycia service role key dla operacji na Storage

## Podsumowanie

Endpoint `DELETE /recipes/{id}/image` został pomyślnie zaimplementowany zgodnie z planem i najlepszymi praktykami projektu. Wszystkie testy lokalne przeszły pozytywnie. Endpoint jest gotowy do użycia w aplikacji.
