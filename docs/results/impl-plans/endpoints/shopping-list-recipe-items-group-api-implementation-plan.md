# API Endpoints Implementation Plan: `DELETE /shopping-list/recipe-items/group`

> **Plik**: `docs/results/impl-plans/endpoints/shopping-list-recipe-items-group-api-implementation-plan.md`  
> **Backend**: Supabase Edge Function `supabase/functions/shopping-list/` (TypeScript, Deno)  
> **Cel biznesowy (US-053)**: usunąć z listy zakupów **całą zgrupowaną pozycję** pochodzącą z przepisów (czyli wszystkie „surowe” wiersze RECIPE należące do danej grupy), **bez modyfikowania** „Mojego planu”.

## 1. Przegląd punktu końcowego

Endpoint usuwa wszystkie wiersze z tabeli `shopping_list_items` dla zalogowanego użytkownika, które spełniają klucz grupy:

- `kind = 'RECIPE'`
- `name = <name>`
- `unit = <unit | null>`
- `is_owned = <bool>`

To jest backendowy odpowiednik operacji „usuń pozycję” w UI, gdzie frontend renderuje listę zakupów jako zgrupowaną po (`name`, `unit`, `is_owned`), ale w bazie przechowuje „raw rows” (po jednym wierszu na składnik z przepisu).

Doprecyzowania (MVP):

- Usuwanie działa **identycznie** dla `is_owned=false` i `is_owned=true` (można usuwać także grupy oznaczone jako „posiadane”).
- Operacja **nie modyfikuje** „Mojego planu”.
- Po późniejszej zmianie planu (np. dodaniu przepisu) te same składniki mogą pojawić się ponownie jako nowe wiersze (w MVP nie utrzymujemy „wykluczeń” dla usuniętych grup).

## 2. Szczegóły żądania

- **Metoda HTTP**: `DELETE`
- **Struktura URL**: `/shopping-list/recipe-items/group`
- **Nagłówki**:
  - Wymagane: `Authorization: Bearer <JWT>`
  - Opcjonalne: standardowe CORS (obsługiwane w `supabase/functions/shopping-list/index.ts`)
- **Parametry**:
  - Wymagane: brak (wszystko w body)
  - Opcjonalne: brak
- **Request Body** (JSON):

```json
{
    "name": "cukier",
    "unit": "g",
    "is_owned": false
}
```

Uwagi:
- `unit` może być `null` (dla grup typu „name-only”) albo jedną z wartości `NormalizedIngredientUnit` (kontrolowana lista jednostek).
- `name` musi odpowiadać wartościom przechowywanym w `shopping_list_items` dla `kind='RECIPE'` (to wartości pochodzące z normalizacji składników).

Przykład dla `unit = null`:

```json
{
    "name": "sól",
    "unit": null,
    "is_owned": true
}
```

## 3. Wykorzystywane typy

### 3.1. Istniejące (shared)

W `shared/contracts/types.ts` istnieją typy powiązane z listą zakupów:
- `ShoppingListItemDto`, `GetShoppingListResponseDto`
- `NormalizedIngredientUnit` (kontrolowana lista jednostek)
- `DeleteRecipeItemsGroupCommand`
- `DeleteRecipeItemsGroupResponseDto`

> Kontrakt DTO/Command jest już zdefiniowany w kodzie współdzielonym, więc backend powinien trzymać się tych typów 1:1.

## 4. Przepływ danych

1. **Router** (`supabase/functions/shopping-list/shopping-list.handlers.ts`):
   - Dopasowanie ścieżki: `/recipe-items/group`
   - Dopasowanie metody: `DELETE`
2. **Autoryzacja**:
   - `getAuthenticatedContext(req)` → `client` + `user`
   - Brak użycia service-role (RLS ma chronić dane per-user)
3. **Walidacja wejścia**:
   - `req.json()` + Zod schema (patrz sekcja 5)
4. **Wywołanie serwisu** (`supabase/functions/shopping-list/shopping-list.service.ts`):
   - `deleteShoppingListRecipeItemsGroup(client, user.id, { name, unit, isOwned })`
   - Wykonanie `DELETE` na `shopping_list_items` z filtrami:
     - `.eq('kind', 'RECIPE')`
     - `.eq('name', name)`
     - `.eq('is_owned', isOwned)`
     - dla `unit`:
       - jeśli `unit === null`: `.is('unit', null)`
       - w przeciwnym razie: `.eq('unit', unit)`
   - Zwrócenie liczby usuniętych wierszy (`deleted`)
5. **Odpowiedź**:
   - `200 OK` z `{ "deleted": <number> }`

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (Supabase Auth). Brak tokenu / zły token → `401` (obsługiwane przez `getAuthenticatedContext`).
- **Autoryzacja / izolacja danych**: oparta na RLS na tabeli `shopping_list_items` (użytkownik ma dostęp tylko do własnych wierszy).
- **Brak modyfikacji „Mojego planu”**:
  - Endpoint działa wyłącznie na `shopping_list_items`.
  - Nie dotyka tabel powiązanych z „planem” (np. `plan_recipes` / podobnej).
- **Ryzyko masowego usuwania przez błędny payload**:
  - Ścisła walidacja `unit` (enum) oraz `name` (trim, min/max).
  - `kind='RECIPE'` jest zawsze wymuszone w serwisie (defense in depth).
- **CORS**: już obsługiwany w `supabase/functions/shopping-list/index.ts`.

## 6. Obsługa błędów

Mechanizm: rzucanie `ApplicationError` i globalny `handleError` (w `supabase/functions/_shared/errors.ts`).

### 6.1. Scenariusze i kody statusu

- **200 OK**
  - Usunięto 1+ wierszy, lub 0 wierszy (grupa nie istniała) – rekomendacja: zawsze zwracać `{ deleted: number }` bez `404`, bo to operacja na „kolekcji” (idempotentna).
- **400 Bad Request** (`VALIDATION_ERROR`)
  - Body nie jest JSON
  - `name` puste / za długie
  - `unit` nie jest `null` ani dozwoloną wartością
  - `is_owned` brak / nie-boolean
- **401 Unauthorized** (`UNAUTHORIZED`)
  - Brak `Authorization` lub token nieważny/wygaśnięty
- **500 Internal Server Error** (`INTERNAL_ERROR`)
  - Błąd bazy / nieoczekiwany błąd runtime

> W kodzie bazowym istnieje też `403 FORBIDDEN`, ale dla tego endpointu nie jest to wymagane, bo działamy tylko na zasobie użytkownika (RLS + brak operacji na cudzych danych).

### 6.2. Rejestrowanie błędów w tabeli błędów

- W MVP **brak** wskazanej tabeli do logowania błędów w DB. Stosujemy logowanie przez `logger` (`info/warn/error`) w Edge Function.
- Jeśli w przyszłości powstanie tabela np. `api_errors`, można dodać w `handleError()` dodatkowy zapis (z zachowaniem ostrożności dot. PII).

## 7. Wydajność

- Operacja to pojedynczy `DELETE` po indeksowalnych polach.
- Rekomendowane indeksy (jeśli nie istnieją):
  - złożony indeks dla szybkich kasowań grup:
    - `(user_id, kind, name, unit, is_owned)`
- Unikać pobierania wszystkich wierszy przed kasowaniem; kasować bezpośrednio filtrem.
- Liczbę usuniętych rekordów zwracać jako `deleted` (zgodnie z kontraktem endpointu). W Supabase JS można to uzyskać przez `delete({ count: 'exact' })` (rekomendowane w MVP ze względu na UX/Undo), z uwzględnieniem ewentualnych kosztów dla dużych zbiorów danych.

## 8. Kroki implementacji

1. **Kontrakt**:
   - Użyć istniejących typów z `shared/contracts/types.ts`:
     - `DeleteRecipeItemsGroupCommand`
     - `DeleteRecipeItemsGroupResponseDto`
2. **Routing** (`supabase/functions/shopping-list/shopping-list.handlers.ts`):
   - Dodać route dla:
     - `DELETE /shopping-list/recipe-items/group`
   - Pamiętać o zasadzie: bardziej specyficzne ścieżki sprawdzać przed mniej specyficznymi.
3. **Walidacja Zod (handler)**:
   - Schema:
     - `name`: `string`, `trim`, `min(1)`, sensowny `max` (np. `150`)
     - `unit`: `z.enum([...NormalizedIngredientUnit...]).nullable()`
     - `is_owned`: `boolean`
4. **Handler**:
   - `handleDeleteShoppingListRecipeItemsGroup(req)`:
     - `getAuthenticatedContext(req)`
     - parse + validate body
     - call service
     - return `200` z `{ deleted }`
5. **Service** (`supabase/functions/shopping-list/shopping-list.service.ts`):
   - Dodać `deleteShoppingListRecipeItemsGroup(...)`:
     - budowa filtra z obsługą `unit === null`
     - wymuszenie `kind='RECIPE'`
     - obsługa błędów DB → `ApplicationError('INTERNAL_ERROR', ...)`
6. **Logowanie**:
   - `info`: start operacji (userId, key)
   - `info`: sukces (deleted)
   - `warn`: walidacja
   - `error`: DB
7. **Testy/manualne requesty**:
   - Uzupełnić `supabase/functions/shopping-list/test-requests.http` o przykłady:
     - `unit: "g"` i `unit: null`
   - (Opcjonalnie) dodać szybki test w `test-quick.ps1` (jeśli jest używany w projekcie).

