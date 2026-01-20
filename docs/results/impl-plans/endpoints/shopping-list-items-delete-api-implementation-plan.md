## API Endpoints Implementation Plan: Shopping List — `DELETE /shopping-list/items/{id}`

## <analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint: **`DELETE /shopping-list/items/{id}`**
- Cel: usunięcie **ręcznej** pozycji listy zakupów (`kind = 'MANUAL'`) dla zalogowanego użytkownika.
- Ograniczenia:
    - usuwanie pozycji pochodzących z przepisów (`kind = 'RECIPE'`) jest **zabronione** → **`403 Forbidden`**.
- Endpoint jest **prywatny**: wymaga JWT Supabase (`Authorization: Bearer <JWT>`).
- Sukces: **`204 No Content`** (bez body).

### 2) Parametry wymagane i opcjonalne
- Wymagane:
    - Path param: `id` (ID pozycji listy zakupów; `bigint`, dodatnia liczba całkowita)
    - Header: `Authorization: Bearer <JWT>`
- Opcjonalne:
    - Brak (MVP).

### 3) Niezbędne typy DTO i Command modele
- **Istniejące (frontend/shared)**:
    - Brak dedykowanego command/response dla DELETE (zgodne z `204 No Content`).
    - `ApiError` (do obsługi błędów po stronie klienta).
- **Backend (Edge Function / Deno)**:
    - Zod schema dla `id` (reuse istniejącego `ShoppingListItemIdSchema`).
    - Serwisowa funkcja `deleteManualShoppingListItem(...)` (nowa).

### 4) Wyodrębnienie logiki do service
- `supabase/functions/shopping-list/shopping-list.handlers.ts`:
    - routing + auth + walidacja + logowanie + zwrot `204`
- `supabase/functions/shopping-list/shopping-list.service.ts`:
    - logika biznesowa:
        - weryfikacja istnienia zasobu (bez wycieku – RLS)
        - sprawdzenie `kind` i mapowanie na `403` dla `RECIPE`
        - faktyczne `DELETE` dla `MANUAL`

### 5) Walidacja danych wejściowych (Zod + defense-in-depth)
- `id`:
    - musi być parsowalne do liczby całkowitej dodatniej (`int`, `> 0`)
    - odrzucić `NaN`, `0`, wartości ujemne, liczby niecałkowite
- Body:
    - brak (ignorujemy ewentualne body; nie parsujemy JSON).

### 6) Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)
- W repo brak dedykowanej „tabeli błędów”.
- MVP: logowanie przez `_shared/logger.ts` + spójne mapowanie błędów przez `_shared/errors.ts` (`ApplicationError` + `handleError`).

### 7) Potencjalne zagrożenia bezpieczeństwa
- Próby usunięcia cudzych rekordów: mitigacja przez **JWT + RLS**; zwracamy **`404`** (bez ujawniania istnienia).
- Próby usunięcia pozycji z przepisów: jawnie blokujemy i zwracamy **`403`** (tylko jeśli rekord jest widoczny dla usera, tj. należy do niego).
- CORS: upewnić się, że `Access-Control-Allow-Methods` zawiera `DELETE`.

### 8) Scenariusze błędów i kody statusu
- `400 Bad Request`:
    - `id` nie jest poprawnym dodatnim integerem
- `401 Unauthorized`:
    - brak nagłówka Authorization
    - nieprawidłowy/wygaśnięty token
- `403 Forbidden`:
    - próba usunięcia pozycji `kind = 'RECIPE'`
- `404 Not Found`:
    - rekord nie istnieje **lub** nie należy do użytkownika (RLS)
- `500 Internal Server Error`:
    - błąd DB / nieoczekiwany błąd serwera
## </analysis>

## 1. Przegląd punktu końcowego
Endpoint **`DELETE /shopping-list/items/{id}`** usuwa jedynie ręcznie dodane pozycje listy zakupów (`kind = 'MANUAL'`). Pozycje pochodzące z przepisów (`kind = 'RECIPE'`) są zarządzane przez system i nie mogą być usuwane przez użytkownika.

## 2. Szczegóły żądania
- Metoda HTTP: `DELETE`
- Struktura URL: `/shopping-list/items/{id}`
- Parametry:
    - Wymagane:
        - `id` (path): `number` (dodatnia liczba całkowita)
        - `Authorization: Bearer <JWT>` (header)
    - Opcjonalne: brak
- Request Body: brak

## 3. Wykorzystywane typy
- **Backend (Edge Function / Deno)**
    - Zod schema (istniejące, do reużycia): `ShoppingListItemIdSchema`
    - Service function (nowa): `deleteManualShoppingListItem(client, userId, itemId): Promise<void>`
- **Frontend/shared (`shared/contracts/types.ts`)**
    - Brak nowego typu dla response (sukces = `204`).
    - Obsługa błędów: `ApiError` (już istnieje).

## 4. Szczegóły odpowiedzi
### Sukces
- **204 No Content**
    - Body: brak

### Błędy (payload w standardzie `_shared/errors.ts`)
- `400 Bad Request`

```json
{
    "code": "VALIDATION_ERROR",
    "message": "id: Shopping list item ID must be a positive integer"
}
```

- `401 Unauthorized`

```json
{
    "code": "UNAUTHORIZED",
    "message": "Missing Authorization header"
}
```

- `403 Forbidden`

```json
{
    "code": "FORBIDDEN",
    "message": "Cannot delete recipe-derived shopping list items"
}
```

- `404 Not Found`

```json
{
    "code": "NOT_FOUND",
    "message": "Shopping list item not found"
}
```

- `500 Internal Server Error`

```json
{
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred"
}
```

## 5. Przepływ danych
1. **Router** (`shopping-list.handlers.ts`) dopasowuje ścieżkę `/items/{id}` i metodę `DELETE`.
2. **Auth**: `getAuthenticatedContext(req)` zwraca `{ client, user }` lub rzuca `ApplicationError('UNAUTHORIZED', ...)`.
3. **Walidacja wejścia**:
    - parsowanie `id` z URL i walidacja (positive int)
4. **Wywołanie serwisu**: `deleteManualShoppingListItem(client, user.id, itemId)`
5. **DB (w serwisie)**:
    - `SELECT id, kind FROM shopping_list_items WHERE id = :itemId` (w kontekście usera → RLS)
        - jeśli brak rekordu → `NOT_FOUND`
        - jeśli `kind !== 'MANUAL'` → `FORBIDDEN`
    - `DELETE FROM shopping_list_items WHERE id = :itemId AND kind = 'MANUAL'` (RLS dodatkowo wymusza `kind='MANUAL'`)
        - jeśli delete nie zwróci rekordu (race) → `NOT_FOUND`
6. **Zwrot**: `204 No Content`.

## 6. Względy bezpieczeństwa
- **Uwierzytelnianie**: obowiązkowy JWT (`Authorization: Bearer <JWT>`).
- **Autoryzacja**:
    - RLS na `shopping_list_items` ogranicza dostęp do `auth.uid() = user_id`.
    - RLS dla `DELETE` dodatkowo wymusza `kind = 'MANUAL'`.
- **Brak wycieku istnienia zasobu**:
    - dla cudzych rekordów `SELECT` zwróci `null` → mapujemy na `404`.
- **Zgodność ze specyfikacją 403**:
    - aby zwrócić `403` dla `RECIPE`, serwis musi najpierw sprawdzić `kind` (rekord musi być widoczny dla usera).
- **CORS**:
    - w `shopping-list/index.ts` dodać `DELETE` do `Access-Control-Allow-Methods` (preflight `OPTIONS`).

## 7. Obsługa błędów
- Używać `ApplicationError` z `_shared/errors.ts`:
    - `VALIDATION_ERROR` → `400`
    - `UNAUTHORIZED` → `401`
    - `FORBIDDEN` → `403`
    - `NOT_FOUND` → `404`
    - `INTERNAL_ERROR` → `500`
- Logowanie:
    - handler: `logger.info` na start i na sukces, `logger.warn` dla walidacji
    - service: `logger.warn` dla `NOT_FOUND`/`FORBIDDEN`, `logger.error` dla błędów DB (`error.code`)

## 8. Wydajność
- Operacja powinna kosztować maks. **2 zapytania**:
    - 1× `SELECT` (sprawdzenie `kind` i istnienia)
    - 1× `DELETE`
- Wyszukanie po PK (`id`) jest szybkie; dodatkowe indeksy nie są potrzebne.

## 9. Kroki implementacji
1. **CORS**
    - W `supabase/functions/shopping-list/index.ts` rozszerzyć `Access-Control-Allow-Methods` o `DELETE` (np. `GET,POST,PATCH,DELETE,OPTIONS`).
2. **Routing (handler)**
    - W `supabase/functions/shopping-list/shopping-list.handlers.ts` dodać trasę:
        - `DELETE /shopping-list/items/{id}` → `handleDeleteShoppingListItem(req, rawId)`
    - Reużyć `ShoppingListItemIdSchema` do walidacji `id`.
3. **Handler**
    - `handleDeleteShoppingListItem`:
        - `getAuthenticatedContext(req)`
        - walidacja `id`
        - wywołanie serwisu
        - zwrot `204` z pustym body
4. **Service**
    - W `supabase/functions/shopping-list/shopping-list.service.ts` dodać:
        - `deleteManualShoppingListItem(client, userId, itemId)`
            - `SELECT id, kind` (np. `.select('id,kind').eq('id', itemId).maybeSingle()`)
            - brak → `NOT_FOUND`
            - `kind !== 'MANUAL'` → `FORBIDDEN`
            - `DELETE ...` (np. `.delete().eq('id', itemId).eq('kind','MANUAL').select('id').maybeSingle()`)
            - brak danych po delete (race) → `NOT_FOUND`
5. **Testy manualne (REST Client)**
    - W `supabase/functions/shopping-list/test-requests.http` dodać sekcję `DELETE`:
        - `204` dla istniejącego `MANUAL` item
        - `403` dla istniejącego `RECIPE` item (jeśli da się przygotować w DB)
        - `400` dla `id=abc`, `id=0`
        - `401` bez JWT / invalid token
        - `404` dla nieistniejącego id
6. **Dokumentacja**
    - Zaktualizować `supabase/functions/shopping-list/README.md`:
        - dodać endpoint `DELETE /shopping-list/items/{id}` do sekcji MVP
        - usunąć wpis z „Roadmap” (albo przenieść do „MVP”).

