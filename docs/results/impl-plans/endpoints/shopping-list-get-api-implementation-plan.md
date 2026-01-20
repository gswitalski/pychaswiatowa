## API Endpoints Implementation Plan: Shopping List — `GET /shopping-list`

<analysis>
### 1) Kluczowe punkty specyfikacji API
- Endpoint: **`GET /shopping-list`**
- Cel: pobrać **per-user** listę zakupów składającą się z:
    - pozycji pochodzących z przepisów (`kind = 'RECIPE'`) oraz
    - pozycji dodanych ręcznie (`kind = 'MANUAL'`).
- Endpoint jest **prywatny** (wymaga JWT).
- Dozwolone zachowanie (MVP): API **może** zwrócić elementy już posortowane dla wygody UI:
    - `is_owned = false` najpierw,
    - potem `is_owned = true`,
    - stabilny sort wtórny po `name`/`text` (wg implementacji).

### 2) Parametry wymagane i opcjonalne
- Nagłówki:
    - wymagane: `Authorization: Bearer <JWT>`
- Parametry ścieżki: brak
- Query params: brak (MVP)
- Body: brak

### 3) Niezbędne typy DTO i Command modele
Z `shared/contracts/types.ts`:
- `ShoppingListItemDto` (union: `ShoppingListItemRecipeDto | ShoppingListItemManualDto`)
- `GetShoppingListResponseDto`
- `ShoppingListItemKind`

Uwaga dot. spójności specyfikacji:
- `docs/results/main-project-docs/009 API plan.md` pokazuje przykładową odpowiedź jako `{ "items": [...] }`,
- natomiast kontrakt w `shared/contracts/types.ts` definiuje `{ data, meta }`.
Rekomendacja: dla nowego endpointu przyjąć **`GetShoppingListResponseDto`** jako źródło prawdy (spójność FE/BE), a w razie potrzeby zaktualizować przykład w dokumencie API plan.

### 4) Wyodrębnienie logiki do service
W repo istnieje Edge Function `supabase/functions/shopping-list/` z modularnym podziałem:
- `index.ts` (routing + CORS + error handling),
- `shopping-list.handlers.ts` (walidacja + format odpowiedzi),
- `shopping-list.service.ts` (operacje DB).

Rekomendacja:
- dodać `handleGetShoppingList` w `shopping-list.handlers.ts`,
- dodać `getShoppingList` w `shopping-list.service.ts` (jedno zapytanie SELECT + metadane).

### 5) Walidacja wejścia
- Brak danych wejściowych (poza JWT), więc walidacja dotyczy jedynie:
    - poprawności uwierzytelnienia (wspólne `getAuthenticatedContext(req)`),
    - defensywnego sprawdzenia, że endpoint nie przyjmuje query params (jeśli pojawią się w przyszłości, dodać Zod i `400`).

### 6) Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)
- W repo nie ma dedykowanej „tabeli błędów” dla Edge Functions.
- MVP: logowanie przez `_shared/logger.ts` + spójne mapowanie błędów przez `_shared/errors.ts` (`ApplicationError` + `handleError`).

### 7) Ryzyka bezpieczeństwa
- **AuthN**: brak/niepoprawny token → `401`.
- **AuthZ/RLS**: tabela `shopping_list_items` ma RLS; SELECT powinien działać w kontekście usera (client z JWT).
- **Wycieki danych**: nie logować pełnych wartości `name`/`text` (mogą zawierać dane wrażliwe); logować liczniki.

### 8) Scenariusze błędów i kody statusu
- `401 Unauthorized`: brak/niepoprawny JWT
- `500 Internal Server Error`: błąd DB / nieoczekiwany błąd serwera
- (opcjonalnie, gdy dodamy parametry w przyszłości) `400 Bad Request`: nieprawidłowe query params
</analysis>

## 1. Przegląd punktu końcowego

Endpoint **`GET /shopping-list`** zwraca kompletną listę zakupów zalogowanego użytkownika, obejmującą:
- pozycje z przepisów (`kind = 'RECIPE'`) — agregowane składniki (`name`, opcjonalnie `amount` i `unit`),
- pozycje ręczne (`kind = 'MANUAL'`) — tylko pole `text`.

W MVP endpoint nie przyjmuje parametrów. Odpowiedź powinna być zgodna z kontraktem `GetShoppingListResponseDto` oraz (opcjonalnie) wstępnie posortowana pod UI.

## 2. Szczegóły żądania

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/shopping-list`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
- **Parametry**:
    - **Wymagane**: brak
    - **Opcjonalne**: brak
- **Request Body**: brak

## 3. Wykorzystywane typy

Z `shared/contracts/types.ts`:
- **Response DTO**: `GetShoppingListResponseDto`
- **Item DTO**: `ShoppingListItemDto`

Backend (wewnętrzne, opcjonalne):
- `GetShoppingListServiceResult` (np. `{ items: ShoppingListItemDto[]; meta: {...} }`) — nie musi być eksportowane poza service.

## 4. Szczegóły odpowiedzi

### Sukces
- **200 OK**
- **Payload**: `GetShoppingListResponseDto`

Rekomendowany przykład (zgodny z kontraktem shared):

```json
{
    "data": [
        {
            "id": 1001,
            "user_id": "uuid",
            "kind": "RECIPE",
            "name": "cukier",
            "amount": 250,
            "unit": "g",
            "is_owned": false,
            "created_at": "2026-01-19T12:34:56.000Z",
            "updated_at": "2026-01-19T12:34:56.000Z"
        },
        {
            "id": 2001,
            "user_id": "uuid",
            "kind": "MANUAL",
            "text": "papier toaletowy",
            "is_owned": true,
            "created_at": "2026-01-19T12:34:56.000Z",
            "updated_at": "2026-01-19T12:34:56.000Z"
        }
    ],
    "meta": {
        "total": 2,
        "recipe_items": 1,
        "manual_items": 1
    }
}
```

### Błędy (kody)
- `401 Unauthorized` — brak lub nieprawidłowy JWT
- `500 Internal Server Error` — błąd po stronie serwera / DB

## 5. Przepływ danych

### 5.1. Warstwa Edge Function (routing → handler → service)

Faktyczna struktura w repo (już istnieje):

```
supabase/functions/shopping-list/
  ├── index.ts
  ├── shopping-list.handlers.ts
  └── shopping-list.service.ts
```

Przepływ dla `GET /shopping-list`:

1. `shopping-list/index.ts`
    - obsługa CORS (`OPTIONS`)
    - log requestu
    - routing do `shoppingListRouter(req)`
    - globalne mapowanie błędów przez `handleError`
2. `shopping-list/shopping-list.handlers.ts`
    - `shoppingListRouter` rozpoznaje:
        - `path === '' || path === '/'` oraz `method === 'GET'` → `handleGetShoppingList(req)`
    - `handleGetShoppingList`:
        - pobiera `{ client, user }` przez `getAuthenticatedContext(req)` (weryfikacja JWT)
        - wywołuje `getShoppingList(client, user.id)`
        - zwraca `200` + `GetShoppingListResponseDto`
3. `shopping-list/shopping-list.service.ts`
    - `getShoppingList` wykonuje SELECT z `shopping_list_items` (w kontekście usera)
    - buduje `meta` (liczniki) i zwraca wynik

### 5.2. Interakcja z bazą danych

Źródło danych: `public.shopping_list_items` (z migracji, już w repo):
- `supabase/migrations/20260119120000_create_shopping_list_tables.sql`
- `supabase/migrations/20260119180100_add_text_length_constraint_to_shopping_list.sql`

Rekomendowany SELECT (po stronie service) powinien pobierać minimalny zestaw pól dla obu typów:
- `id`, `user_id`, `kind`, `name`, `amount`, `unit`, `text`, `is_owned`, `created_at`, `updated_at`

Rekomendowane sortowanie (MVP, zgodnie z notatką w API plan):
- `is_owned` rosnąco (false → true),
- następnie stabilnie po nazwie/tekście:
    - `lower(coalesce(name, text))` rosnąco,
    - tiebreaker: `id` rosnąco.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: endpoint prywatny — bez JWT zwracamy `401`.
- **Autoryzacja / RLS**:
    - SELECT tylko dla `auth.uid() = user_id` (wymuszone przez RLS + kontekst JWT).
    - Service nie przyjmuje `user_id` z requestu; `user.id` pochodzi z auth context.
- **Dane wrażliwe w logach**:
    - logować: `userId`, `itemsTotal`, `recipeItems`, `manualItems`
    - nie logować: treści `name`/`text`.

## 7. Obsługa błędów

- `401 Unauthorized`
    - `getAuthenticatedContext(req)` nie zwraca usera / token niepoprawny
- `500 Internal Server Error`
    - błąd supabase-js w `.from('shopping_list_items').select(...)`
    - brak danych (np. nieoczekiwany stan `.select().order(...)` zwraca null bez error) → traktować jako błąd serwera, zalogować i zwrócić `500`

## 8. Wydajność

- Operacja read-only, typowo **1× SELECT** po indeksach per-user.
- Potencjalne wąskie gardło: duża liczba pozycji per user (w MVP raczej mała).
- Indeksy z migracji wspierają selekcję i sortowanie:
    - `(user_id, kind)`, `(user_id, is_owned)`, unikalny merge key dla `kind='RECIPE'`.

## 9. Kroki implementacji

1. **Kontrakt**
    - Potwierdzić, że endpoint zwraca `GetShoppingListResponseDto` (z `shared/contracts/types.ts`).
    - (Opcjonalnie) zaktualizować przykład w `docs/results/main-project-docs/009 API plan.md` z `{ items }` na `{ data, meta }` dla spójności.
2. **Routing**
    - W `supabase/functions/shopping-list/shopping-list.handlers.ts` dodać trasę:
        - `GET /shopping-list` (path `''` lub `'/'`).
3. **Handler**
    - Dodać `handleGetShoppingList(req)`:
        - `getAuthenticatedContext(req)`
        - wywołanie serwisu
        - `return new Response(JSON.stringify(dto), { status: 200, headers: {'Content-Type':'application/json'} })`
4. **Service**
    - Dodać `getShoppingList(client, userId)`:
        - SELECT wszystkich pozycji usera z `shopping_list_items`
        - sortowanie: `is_owned`, `coalesce(name,text)`, `id`
        - zbudować `meta`: `total`, `recipe_items`, `manual_items`
5. **Dokumentacja + testy ręczne**
    - Zaktualizować `supabase/functions/shopping-list/README.md` (usunąć “Future” dla GET).
    - Dodać request do `supabase/functions/shopping-list/test-requests.http`:
        - `GET /shopping-list` z JWT.
    - Scenariusze:
        - brak JWT → `401`
        - użytkownik z pustą listą → `200` z `data: []` i `meta.total = 0`
        - miks `RECIPE` + `MANUAL` → poprawne sortowanie i liczniki w `meta`

