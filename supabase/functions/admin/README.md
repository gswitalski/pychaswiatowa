# Admin Edge Function

Admin-only Edge Function dla endpointow administracyjnych.

## Endpoints

### `GET /admin/summary`
Zwraca podsumowanie dashboardu administracyjnego w wersji MVP (stub).

**Request:**
- Method: `GET`
- Path: `/functions/v1/admin/summary`
- Headers:
  - `Authorization: Bearer <JWT>` (required)

**Response:**
- `200 OK`:
```json
{
  "version": "mvp-stub",
  "generated_at": "2026-02-13T10:00:00Z",
  "notes": "Admin dashboard placeholder; dane zostana dodane w kolejnych iteracjach.",
  "metrics": {
    "users_total": null,
    "recipes_total": null,
    "public_recipes_total": null
  }
}
```

### `GET /admin/health`
Zwraca podstawowy status zdrowia endpointu administracyjnego.

**Request:**
- Method: `GET`
- Path: `/functions/v1/admin/health`
- Headers:
  - `Authorization: Bearer <JWT>` (required)

**Response:**
- `200 OK`:
```json
{
  "status": "ok",
  "checked_at": "2026-02-13T10:00:00Z"
}
```

### `GET /admin/users`
Zwraca paginowana liste uzytkownikow dla panelu administracyjnego.

**Request:**
- Method: `GET`
- Path: `/functions/v1/admin/users`
- Headers:
  - `Authorization: Bearer <JWT>` (required, admin only)
- Query params (optional):
  - `page` (integer >= 1, default: `1`)
  - `page_size` (integer 1-100, default: `25`)
  - `sort_by` (`created_at | login | last_sign_in_at | recipes_count`, default: `created_at`)
  - `sort_dir` (`asc | desc`, default: `desc`)

**Response:**
- `200 OK`:
```json
{
  "data": [
    {
      "id": "4ec7f8d2-c2d7-4d2f-bddc-113c6f5f6d1d",
      "login": "admin@pychaswiatowa.pl",
      "username": "pycha-admin",
      "role": "admin",
      "created_at": "2026-03-20T18:15:00Z",
      "last_sign_in_at": "2026-04-10T07:42:11Z",
      "recipes_count": 12
    }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 25,
    "totalPages": 6,
    "totalItems": 142
  },
  "sorting": {
    "sort_by": "created_at",
    "sort_dir": "desc"
  }
}
```

## Error Responses

- `401 Unauthorized` - brak lub nieprawidlowy token
- `403 Forbidden` - poprawny token, ale rola inna niz `admin`
- `400 Bad Request` - nieprawidlowe parametry zapytania
- `404 Not Found` - nieznana sciezka
- `405 Method Not Allowed` - niedozwolona metoda HTTP
- `500 Internal Server Error` - blad nieoczekiwany

Kontrakt bledu:

```json
{
  "code": "FORBIDDEN",
  "message": "Admin role is required"
}
```

## Security

1. JWT jest wymagany dla wszystkich endpointow.
2. Token jest weryfikowany przez Supabase (`auth.getUser()`).
3. Wymagany jest `app_role === "admin"` po stronie backendu.
4. Endpoint zwraca tylko dane zagregowane/stub (bez danych wrazliwych).

## Architecture

```
admin/
├── index.ts              # router glowny, CORS, top-level error handling
├── admin.handlers.ts     # routing endpointow i autoryzacja admin-only
├── admin.service.ts      # logika biznesowa (MVP: stuby)
├── admin.types.ts        # typy i walidacja query parametrow
├── admin.types.test.ts   # testy walidacji schematow admin
├── test-requests.http    # przypadki testowe REST Client
└── README.md             # dokumentacja funkcji
```

## Testing

```bash
# Start function locally
supabase functions serve admin

# Manual tests
# Use file: supabase/functions/admin/test-requests.http
```

### Smoke checklist (GET /admin/users)

- Sprawdz domyslne sortowanie: `created_at desc`.
- Sprawdz sortowanie po `login` (`asc` i `desc`, case-insensitive).
- Sprawdz sortowanie po `last_sign_in_at` i weryfikuj, ze `null` jest zawsze na koncu.
- Sprawdz sortowanie po `recipes_count` (`asc` i `desc`).
- Sprawdz granice paginacji (`page=1`, wysoka strona bez danych, `page_size=1`, `page_size=100`).
- Sprawdz bledy walidacji (`page=0`, `page_size=101`, niedozwolone `sort_by` lub `sort_dir`).

