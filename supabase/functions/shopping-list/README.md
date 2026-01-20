# Shopping List Edge Function

Edge Function dla zarządzania listą zakupów użytkownika w aplikacji PychaŚwiatowa.

## 📋 Przegląd

Funkcja `shopping-list` obsługuje dwa typy pozycji na liście zakupów:

1. **RECIPE** - Pozycje pochodzące z przepisów (agregowane z normalized ingredients)
2. **MANUAL** - Pozycje dodane ręcznie przez użytkownika (free-text)

## 🔌 Endpointy (MVP)

### GET /shopping-list

Pobiera kompletną listę zakupów użytkownika (pozycje RECIPE + MANUAL).

**Request:**
- Brak parametrów query
- Wymaga: `Authorization: Bearer <JWT>`

**Response (200 OK):**
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

**Kody błędów:**
- `401` - Unauthorized (brak/nieprawidłowy JWT)
- `500` - Internal server error

**Sortowanie:**
- Pozycje sortowane są automatycznie:
  1. `is_owned = false` (nieposiadane) najpierw
  2. `is_owned = true` (posiadane) na końcu
  3. Alfabetycznie po `name` (RECIPE) lub `text` (MANUAL)
  4. Stabilny sort po `id` (tiebreaker)

### POST /shopping-list/items

Dodaje nową ręczną pozycję tekstową do listy zakupów.

**Request:**
```json
{
  "text": "papier toaletowy"
}
```

**Response (201 Created):**
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

**Kody błędów:**
- `400` - Validation error (pusty tekst, za długi, nieprawidłowy JSON)
- `401` - Unauthorized (brak/nieprawidłowy JWT)
- `500` - Internal server error

### PATCH /shopping-list/items/{id}

Aktualizuje flagę `is_owned` dla pozycji listy zakupów (RECIPE lub MANUAL).

**Request:**
```json
{
  "is_owned": true
}
```

**Response (200 OK):**
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

**Kody błędów:**
- `400` - Validation error (nieprawidłowy `id` lub `is_owned`, błędny JSON)
- `401` - Unauthorized (brak/nieprawidłowy JWT)
- `404` - Not found (rekord nie istnieje lub nie należy do użytkownika)
- `500` - Internal server error

## 🏗️ Architektura

Funkcja jest zorganizowana według modularnego wzorca:

```
shopping-list/
├── index.ts                        # Routing + CORS + error handling
├── shopping-list.handlers.ts       # Handlery HTTP + walidacja Zod
├── shopping-list.service.ts        # Logika biznesowa + operacje DB
├── test-requests.http              # Testy HTTP (REST Client)
├── MIGRATION_CHECKLIST.md          # Checklist migracji DB
└── README.md                       # Ta dokumentacja
```

### Separacja odpowiedzialności

- **index.ts**: Tylko routing i globalna obsługa błędów
- **handlers.ts**: Walidacja request, formatowanie response, wywołanie serwisu
- **service.ts**: Czysta logika biznesowa, operacje na danych

## 🔒 Bezpieczeństwo

### Uwierzytelnianie
- Wszystkie endpointy wymagają JWT token w nagłówku `Authorization: Bearer <token>`
- Weryfikacja przez `getAuthenticatedContext()` z `_shared/supabase-client.ts`

### Autoryzacja (RLS)
- Użytkownik może operować **tylko na własnych** pozycjach listy zakupów
- `user_id` jest ustawiany automatycznie przez DB (`auth.uid()`)
- Klient NIE może ustawić `user_id`, `kind` w payloadzie
- Aktualizacja `is_owned` jest dostępna tylko przez PATCH

### Walidacja

**Backend (Zod schema):**
- `text`: 1-200 znaków, automatyczny `trim()`
- Dodatkowa walidacja: tekst nie może być pusty po trim

**Database (constraints):**
- `check_recipe_kind_fields`: Wymusza poprawne pola per kind
- `check_manual_text_length`: Limit 1-200 znaków (defense in depth)

## 📊 Baza danych

### Tabela: shopping_list_items

| Kolumna | Typ | Opis |
|---------|-----|------|
| `id` | bigserial | Primary key |
| `user_id` | uuid | ID użytkownika (default: auth.uid()) |
| `kind` | text | 'RECIPE' lub 'MANUAL' |
| `name` | text | Nazwa składnika (tylko RECIPE) |
| `amount` | numeric | Ilość (tylko RECIPE) |
| `unit` | text | Jednostka (tylko RECIPE) |
| `text` | text | Tekst pozycji (tylko MANUAL) |
| `is_owned` | boolean | Czy użytkownik oznaczył jako posiadane |
| `created_at` | timestamptz | Data utworzenia |
| `updated_at` | timestamptz | Data aktualizacji |

### Indeksy
- Unique index dla RECIPE: `(user_id, name, coalesce(unit, ''))`
- Index: `(user_id, kind)`
- Index: `(user_id, is_owned)`

## 🧪 Testowanie

### Lokalne uruchomienie

1. **Uruchom Supabase lokalnie:**
   ```bash
   supabase start
   ```

2. **Zastosuj migracje:**
   ```bash
   supabase db reset
   ```

3. **Wygeneruj typy:**
   ```bash
   supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
   ```

4. **Uruchom funkcję:**
   ```bash
   supabase functions serve shopping-list
   ```

5. **Endpointy dostępne na:**
   ```
   GET  http://localhost:54331/functions/v1/shopping-list
   POST http://localhost:54331/functions/v1/shopping-list/items
   PATCH http://localhost:54331/functions/v1/shopping-list/items/{id}
   ```

### Użycie test-requests.http

Otwórz plik `test-requests.http` w VS Code z rozszerzeniem REST Client.

1. **Zdobądź JWT token:**
   - Zaloguj się na test@pychaswiatowa.pl (hasło: 554G5rjnbdAanGR)
   - Skopiuj token z odpowiedzi lub DevTools

2. **Ustaw token w pliku:**
   ```
   @token = YOUR_ACTUAL_JWT_TOKEN
   ```

3. **Kliknij "Send Request"** nad wybranym testem

## 📝 Przykłady użycia

### Pobranie listy zakupów
```bash
curl -X GET http://localhost:54331/functions/v1/shopping-list \
  -H "Authorization: Bearer <token>"
```

### Dodanie pozycji
```bash
curl -X POST http://localhost:54331/functions/v1/shopping-list/items \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"mleko 3.2%"}'
```

### Aktualizacja is_owned
```bash
curl -X PATCH http://localhost:54331/functions/v1/shopping-list/items/2001 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"is_owned":true}'
```

### Przykład z trim
```json
// Request:
{"text": "   chleb   "}

// Response:
{"text": "chleb"}  // trimmed
```

## 🚀 Deployment

### Wdrożenie na produkcję

1. **Push migracji do remote:**
   ```bash
   supabase db push
   ```

2. **Deploy funkcji:**
   ```bash
   supabase functions deploy shopping-list
   ```

3. **Ustaw zmienne środowiskowe** (jeśli potrzebne)

## 🔮 Roadmap (poza MVP)

- [ ] `DELETE /shopping-list/items/{id}` - Usuwanie pozycji MANUAL
- [ ] Automatyczne aktualizacje z przepisów w planie
- [ ] Merge pozycji RECIPE z różnych przepisów

## 📚 Powiązane dokumenty

- [API Implementation Plan](../../../docs/results/impl-plans/endpoints/shopping-list-items-post-api-implementation-plan.md)
- [Shopping List Changes](../../../docs/results/changes/shopping-list-changes.md)
- [Backend Rules](../../../.cursor/rules/backend.mdc)
