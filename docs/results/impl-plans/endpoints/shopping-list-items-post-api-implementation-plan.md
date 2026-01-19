## API Endpoints Implementation Plan: Shopping List — `POST /shopping-list/items`

## 1. Przegląd punktu końcowego

Endpoint **`POST /shopping-list/items`** dodaje nową, ręczną pozycję tekstową do listy zakupów zalogowanego użytkownika. Pozycja jest zapisywana jako `kind = 'MANUAL'`, bez pól ilości/jednostki, i może być później odhaczana (`is_owned`) oraz usuwana (przez `DELETE /shopping-list/items/{id}`).

Kluczowe cechy:

- Dane są **per-user** i chronione przez **RLS**.
- Endpoint nie wykonuje merge z pozycjami pochodzącymi z przepisów (MVP).
- Serwer sanituzuje/normalizuje tekst (minimum: trim + walidacja niepustości).

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/shopping-list/items`
- **Wymagane nagłówki**:
    - `Authorization: Bearer <JWT>`
    - `Content-Type: application/json`
- **Parametry**:
    - **Wymagane**: brak (poza body)
    - **Opcjonalne**: brak
- **Request Body**: `AddManualShoppingListItemCommand`

```json
{
    "text": "papier toaletowy"
}
```

Uwagi dot. kompatybilności:

- Payload nie powinien pozwalać klientowi na ustawianie `user_id`, `kind`, `is_owned` ani timestampów. Jeśli klient prześle dodatkowe pola, backend je ignoruje.

## 3. Wykorzystywane typy

Z `shared/contracts/types.ts`:

- **Command model**: `AddManualShoppingListItemCommand`
- **Response DTO (zalecane)**: `ShoppingListItemManualDto`
    - Alternatywa (jeśli chcemy zwracać również pozycje z przepisów w tych samych ścieżkach): `ShoppingListItemDto` (union).

Uwaga: przykład w `docs/results/main-project-docs/009 API plan.md` pokazuje minimalną odpowiedź. Rekomendacja implementacyjna: zwracać pełny rekord `ShoppingListItemManualDto` (co najmniej: `id`, `kind`, `text`, `is_owned`).

## 4. Szczegóły odpowiedzi

### Sukces

- **201 Created**

Rekomendowany payload: `ShoppingListItemManualDto` (pełny obiekt):

```json
{
    "id": 2002,
    "user_id": "uuid",
    "kind": "MANUAL",
    "text": "papier toaletowy",
    "is_owned": false,
    "created_at": "2026-01-19T12:34:56.000Z",
    "updated_at": "2026-01-19T12:34:56.000Z"
}
```

### Błędy (kody)

- `400 Bad Request` — brak/niepoprawne dane wejściowe (np. pusty `text`, niepoprawny JSON)
- `401 Unauthorized` — brak lub nieprawidłowy JWT
- `500 Internal Server Error` — błąd po stronie serwera / DB

## 5. Przepływ danych

### 5.1. Warstwa Edge Function (routing → handler → service)

Zgodnie z zasadami projektu (modularny podział), rekomendowana struktura:

```
supabase/functions/shopping-list/
  ├── index.ts                   # routing + obsługa błędów
  ├── shopping-list.handlers.ts  # walidacja + format odpowiedzi
  └── shopping-list.service.ts   # operacje DB
```

Przepływ:

1. `shopping-list/index.ts`
    - obsługa CORS (`OPTIONS`)
    - routing do routera z `shopping-list.handlers.ts`
    - globalna obsługa błędów (`handleError` z `functions/_shared/errors.ts`)
2. `shopping-list.handlers.ts` — handler `handlePostShoppingListItems`
    - weryfikacja JWT i pobranie kontekstu użytkownika (utility z `functions/_shared/auth.ts` / klient Supabase)
    - `await req.json()` + walidacja Zod
    - normalizacja `text` (np. `trim`, ewentualnie redukcja wielokrotnych spacji)
    - wywołanie serwisu `createManualShoppingListItem({ userId, text })`
    - zwrot `201` z DTO utworzonej pozycji
3. `shopping-list.service.ts`
    - insert do `public.shopping_list_items`
    - wymuszenie `kind = 'MANUAL'` po stronie serwisu (nie z payloadu)
    - zwrot utworzonego wiersza (select/returning)

### 5.2. Interakcja z bazą danych (aktualny schemat)

Migracja `supabase/migrations/20260119120000_create_shopping_list_tables.sql` definiuje:

- tabelę `public.shopping_list_items` z constraintami spójności pól dla `kind='MANUAL'`
- RLS:
    - `SELECT/INSERT/UPDATE` tylko dla `auth.uid() = user_id`
    - `DELETE` tylko dla `auth.uid() = user_id AND kind='MANUAL'`

Insert dla pozycji manualnej powinien wykonać się jako:

- `kind = 'MANUAL'`
- `text = <znormalizowany tekst>`
- `user_id` zostaje ustawione przez domyślną wartość `auth.uid()` (nie z payloadu)
- `is_owned` domyślnie `false`

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: endpoint prywatny — bez JWT zwracamy `401`.
- **Autoryzacja / RLS**:
    - brak możliwości dopisania pozycji do listy zakupów innego użytkownika (RLS + `auth.uid()` jako default `user_id`)
    - brak możliwości ustawienia `kind='RECIPE'` przez klienta (backend wymusza `MANUAL`, a constraint DB pilnuje zgodności pól)
- **Walidacja i sanityzacja**:
    - obowiązkowe `trim()`; po trim tekst nie może być pusty
    - rekomendacja: limit długości tekstu (np. 1–200 znaków) w Zod oraz jako constraint w DB (jeśli nie jest jeszcze dodany)
- **Anti-abuse**:
    - rekomendacja (MVP+): rate limit per user (np. na poziomie Edge Function), by uniknąć spamowania tabeli
- **Logowanie**:
    - logować minimalnie: `user_id`, `operation`, `item_id`
    - nie logować pełnego `text` (może zawierać dane wrażliwe)

## 7. Wydajność

- Operacja powinna być stałokosztowa: **1× insert + returning**.
- Indeksy z migracji (`idx_shopping_list_items_user_id_kind`, `idx_shopping_list_items_user_id_is_owned`) wspierają późniejsze listowanie i sortowanie.
- Brak JOIN-ów i brak skanów po dużych zakresach danych.

## 8. Kroki implementacji

1. **Kontrakt (shared)**
    - Potwierdzić użycie `AddManualShoppingListItemCommand` po stronie FE/BE.
    - Ustalić i spisać docelowy kształt odpowiedzi:
        - preferowane: pełny `ShoppingListItemManualDto`
        - minimum: `id`, `kind`, `text`, `is_owned`
2. **DB (jeśli nie wdrożone)**
    - Zastosować migrację `20260119120000_create_shopping_list_tables.sql`.
    - (Opcjonalnie) dodać constraint długości dla `shopping_list_items.text` dla `kind='MANUAL'` (np. `char_length(text) between 1 and 200`).
3. **Edge Function**
    - Utworzyć `supabase/functions/shopping-list/` zgodnie z zasadami (tylko 1. poziom katalogu).
    - Dodać routing w `index.ts` dla ścieżki `POST /items`.
    - Dodać `shopping-list.handlers.ts`:
        - Zod schema dla `{ text }`
        - mapowanie błędów walidacji → `400`
    - Dodać `shopping-list.service.ts`:
        - `insert` do `public.shopping_list_items` z `kind='MANUAL'` i `text`
        - zwrócić utworzony rekord
4. **Obsługa błędów**
    - Użyć wspólnego `ApplicationError` + `handleError` do spójnych odpowiedzi.
    - Zmapować typowe błędy:
        - invalid JSON / Zod → `400`
        - brak sesji → `401`
        - DB error → `500` (log error + correlation id, jeśli istnieje)
5. **Testy manualne (lokalnie)**
    - `POST` z poprawnym JWT i `"text": " mleko "` → `201`, zwrócony `text` po trim, `kind='MANUAL'`, `is_owned=false`
    - `POST` z `"text": ""` / `"   "` → `400`
    - `POST` bez JWT → `401`
    - (Jeśli dodamy limit długości) bardzo długi tekst → `400`

