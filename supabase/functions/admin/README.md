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

## Error Responses

- `401 Unauthorized` - brak lub nieprawidlowy token
- `403 Forbidden` - poprawny token, ale rola inna niz `admin`
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

