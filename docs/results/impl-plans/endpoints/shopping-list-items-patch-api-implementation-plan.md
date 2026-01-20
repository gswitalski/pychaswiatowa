## API Endpoints Implementation Plan: `PATCH /shopping-list/items/{id}`

## <analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint służy do **ustawienia flagi `is_owned`** (odhaczanie posiadanych) dla **dowolnej** pozycji listy zakupów (`kind = RECIPE` lub `MANUAL`).
- Endpoint jest **prywatny**: wymaga JWT Supabase (`Authorization: Bearer <JWT>`).
- Oczekiwany rezultat: **zwrócenie zaktualizowanej pozycji** (po togglu) z kodem **`200`**.
- Dla błędów: **`400`** (walidacja / nieprawidłowy JSON), **`401`** (brak/nieprawidłowy JWT), **`404`** (brak zasobu lub brak dostępu bez ujawniania), **`500`** (błąd serwera/DB).

### 2) Parametry wymagane i opcjonalne
- Wymagane:
    - Path param: `id` (ID pozycji listy zakupów; `bigint`, dodatnia liczba całkowita)
    - Header: `Authorization: Bearer <JWT>`
    - Body JSON: `{ "is_owned": boolean }`
- Opcjonalne:
    - Brak (w MVP).

### 3) Niezbędne typy DTO i Command modele
- **Istniejące (frontend/shared)**:
    - `ShoppingListItemDto` (union: `ShoppingListItemRecipeDto | ShoppingListItemManualDto`)
    - `ApiError` (dla obsługi błędów po stronie klienta)
- **Do dodania (frontend/shared)**:
    - `UpdateShoppingListItemCommand` (albo `PatchShoppingListItemCommand`):
        - `{ is_owned: boolean }`
    - (Response może reużyć) `ShoppingListItemDto`

### 4) Wyodrębnienie logiki do service
- W `supabase/functions/shopping-list/shopping-list.handlers.ts`:
    - tylko routing, auth, parsowanie JSON, walidacja, logowanie, format odpowiedzi
- W `supabase/functions/shopping-list/shopping-list.service.ts`:
    - nowa funkcja np. `updateShoppingListItemIsOwned({ client, userId, itemId, isOwned })`
    - odpowiedzialna za `UPDATE` w tabeli `shopping_list_items` i zwrot zaktualizowanego rekordu

### 5) Walidacja danych wejściowych (Zod + defense-in-depth)
- `id`:
    - musi być parsowalne do liczby całkowitej dodatniej (`> 0`)
    - odrzucić `NaN`, wartości ujemne, `0`, liczby niecałkowite
- Body:
    - musi być poprawnym JSON
    - `is_owned` wymagane, typu boolean
    - pozostałe pola ignorować (dla kompatybilności), ale do `update()` przekazać wyłącznie `is_owned`
- DB:
    - RLS: `UPDATE` dozwolony tylko gdy `auth.uid() = user_id` (już istnieje)
    - Trigger `handle_updated_at()` aktualizuje `updated_at` (już istnieje)

### 6) Rejestrowanie błędów w tabeli błędów
- W aktualnym kodzie brak „tabeli błędów”. Stosujemy:
    - logowanie przez `logger` w handlerach/serwisie
    - globalny `handleError()` z `_shared/errors.ts` (format `{ code, message }`)

### 7) Potencjalne zagrożenia bezpieczeństwa
- Próby modyfikacji cudzych rekordów: mitigacja przez **JWT + RLS**; zwracamy **`404`** (brak ujawnienia istnienia).
- Próby aktualizacji pól innych niż `is_owned` (np. `user_id`, `kind`, `text`): ignorujemy w payloadzie, aktualizujemy tylko `is_owned`.
- Nieprawidłowe ID (path traversal / injection): `id` walidowane jako dodatnia liczba całkowita.
- CORS dla metody `PATCH`: upewnić się, że preflight zwraca nagłówek `Access-Control-Allow-Methods` zawierający `PATCH` (wspólne dla funkcji).

### 8) Scenariusze błędów i kody statusu
- `400`:
    - niepoprawny JSON
    - `id` nie jest poprawnym dodatnim integerem
    - brak `is_owned` lub nie-boolean
- `401`:
    - brak nagłówka Authorization
    - nieprawidłowy/wygaśnięty token
- `404`:
    - rekord o `id` nie istnieje **lub** nie należy do użytkownika (RLS)
- `500`:
    - błąd DB / nieoczekiwany błąd serwera
## </analysis>

## 1. Przegląd punktu końcowego
`PATCH /shopping-list/items/{id}` umożliwia oznaczenie pozycji listy zakupów jako „posiadane/zakupione” poprzez ustawienie flagi `is_owned`. Endpoint działa dla pozycji pochodzących z przepisów (`kind = RECIPE`) oraz ręcznych (`kind = MANUAL`).

## 2. Szczegóły żądania
- Metoda HTTP: `PATCH`
- Struktura URL: `/shopping-list/items/{id}`
- Parametry:
    - Wymagane:
        - `id` (path): `number` (dodatnia liczba całkowita)
        - `Authorization: Bearer <JWT>` (header)
    - Opcjonalne: brak
- Request Body:

```json
{
    "is_owned": true
}
```

## 3. Wykorzystywane typy
- **Backend (Edge Function / Deno)**
    - Zod schema (nowe):
        - `ShoppingListItemIdParamSchema` (id: positive int)
        - `PatchShoppingListItemSchema` (body: `{ is_owned: boolean }`)
    - Service function (nowa):
        - `updateShoppingListItemIsOwned(...)` → zwraca zaktualizowany rekord
- **Frontend/shared (`shared/contracts/types.ts`)**
    - dodać:
        - `UpdateShoppingListItemCommand` (body)
    - użyć istniejącego:
        - `ShoppingListItemDto` jako response DTO

## 4. Szczegóły odpowiedzi
- `200 OK`:
    - Zwraca **zaktualizowaną pozycję** (`ShoppingListItemDto`)
    - Przykład (MANUAL):

```json
{
    "id": 2001,
    "user_id": "uuid",
    "kind": "MANUAL",
    "text": "papier toaletowy",
    "is_owned": true,
    "created_at": "2026-01-19T12:34:56.000Z",
    "updated_at": "2026-01-20T10:00:00.000Z"
}
```

- `400 Bad Request`:
    - payload w formacie `_shared/errors.ts`:

```json
{
    "code": "VALIDATION_ERROR",
    "message": "..."
}
```

- `401 Unauthorized`:

```json
{
    "code": "UNAUTHORIZED",
    "message": "..."
}
```

- `404 Not Found`:

```json
{
    "code": "NOT_FOUND",
    "message": "Shopping list item not found"
}
```

- `500 Internal Server Error`:

```json
{
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych
1. **Router** (`shopping-list.handlers.ts`) dopasowuje ścieżkę `/items/{id}` i metodę `PATCH`.
2. **Auth**: `getAuthenticatedContext(req)` zwraca `{ client, user }` lub rzuca `ApplicationError('UNAUTHORIZED', ...)`.
3. **Walidacja wejścia**:
    - parsowanie `id` z URL i walidacja (positive int)
    - parsowanie body jako JSON + walidacja Zod `{ is_owned: boolean }`
4. **Wywołanie serwisu**: `updateShoppingListItemIsOwned(client, user.id, itemId, isOwned)`
5. **DB**: `UPDATE public.shopping_list_items SET is_owned = ... WHERE id = ...` w kontekście użytkownika (JWT), z RLS.
6. **Zwrot**: `200 OK` + JSON z rekordem po aktualizacji.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: obowiązkowy JWT (`Authorization: Bearer <JWT>`).
- **Autoryzacja**: RLS na `shopping_list_items` ogranicza `UPDATE` do `auth.uid() = user_id`.
- **Brak wycieku istnienia zasobu**: jeśli update nie zwróci rekordu (brak lub cudzy), zwracamy `404`.
- **Walidacja**: dopuszczamy tylko zmianę `is_owned`; payload nie może wpływać na `user_id`, `kind`, `text`, `name`, `amount`, `unit`.
- **CORS**: dla `PATCH` wymagany preflight; dodać `Access-Control-Allow-Methods` (min. `GET,POST,PATCH,DELETE,OPTIONS`) w `index.ts` funkcji `shopping-list`.

## 7. Obsługa błędów
- Stosować `ApplicationError` z `_shared/errors.ts`:
    - `VALIDATION_ERROR` → `400`
    - `UNAUTHORIZED` → `401`
    - `NOT_FOUND` → `404`
    - `INTERNAL_ERROR` → `500`
- Logowanie:
    - handler: `logger.info` na start, `logger.warn` dla walidacji, `logger.info` na sukces
    - service: `logger.info`/`logger.error` dla błędów DB z `error.code`
- Globalnie: `index.ts` używa `handleError(error)` i dokleja CORS headers.

## 8. Wydajność
- Jedno zapytanie `UPDATE ... RETURNING ...` (via `.update().select()`).
- Wyszukanie po PK (`id`) jest O(1); brak potrzeby dodatkowych indeksów.
- `updated_at` aktualizowane przez trigger (bez dodatkowych round-tripów w aplikacji).

## 9. Kroki implementacji
1. **Shared types (frontend kontrakt)**:
    - dodać w `shared/contracts/types.ts`:
        - `export interface UpdateShoppingListItemCommand { is_owned: boolean; }`
2. **Router/handler** (`supabase/functions/shopping-list/shopping-list.handlers.ts`):
    - dodać routing:
        - `PATCH /shopping-list/items/{id}` → `handlePatchShoppingListItem`
    - dodać Zod schemat:
        - walidacja `id` jako positive int (z `safeParse`)
        - walidacja body: `{ is_owned: z.boolean() }`
    - w handlerze:
        - `getAuthenticatedContext(req)`
        - parse `req.json()` z obsługą wyjątku → `VALIDATION_ERROR`
        - wywołać serwis i zwrócić `200` + JSON
3. **Service** (`supabase/functions/shopping-list/shopping-list.service.ts`):
    - dodać funkcję `updateShoppingListItemIsOwned(...)`:
        - wykonać `update({ is_owned }).eq('id', itemId).select(SHOPPING_LIST_ITEM_ALL_SELECT).maybeSingle()`
        - jeśli `data == null` → `ApplicationError('NOT_FOUND', 'Shopping list item not found')`
        - błędy DB mapować na `INTERNAL_ERROR` (opcjonalnie: specyficzne mapowania)
4. **CORS (ważne dla PATCH)**:
    - w `supabase/functions/shopping-list/index.ts` dodać `Access-Control-Allow-Methods` obejmujące `PATCH`
5. **Testy manualne (REST Client)**:
    - rozszerzyć `supabase/functions/shopping-list/test-requests.http` o przypadki:
        - sukces: patch manual item (id z POST)
        - sukces: patch recipe item (jeśli istnieje w seedach)
        - 400: invalid JSON, missing is_owned, is_owned != boolean, invalid id
        - 401: brak/invalid token
        - 404: nieistniejący id / cudzy id (jeśli możliwe do zasymulowania)
6. **Dokumentacja**:
    - zaktualizować `supabase/functions/shopping-list/README.md` (usunąć „Future” przy PATCH, dopisać przykład).
