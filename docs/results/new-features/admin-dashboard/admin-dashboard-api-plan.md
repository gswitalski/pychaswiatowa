# Admin Dashboard — plan API

## Cel API

Na potrzeby MVP dashboard admina może być placeholderem bez danych. Jednocześnie warto przewidzieć minimalny endpoint, który w przyszłości zasili dashboard statystykami/health-checkami, a już teraz może zwracać stub.

## Autoryzacja i bezpieczeństwo

- Wszystkie endpointy w sekcji `/admin/*` są **admin-only**.
- Weryfikacja uprawnień musi odbywać się **po stronie backendu** (nie tylko w UI).
- Źródło roli:
    - Claim w JWT: `app_role` (`user` / `premium` / `admin`).
- Oczekiwane odpowiedzi błędów:
    - `401 Unauthorized` — brak/niepoprawny token.
    - `403 Forbidden` — token poprawny, ale `app_role !== 'admin'`.

## Istniejące endpointy wykorzystywane przez UI (bez zmian)

### `GET /me`

Bootstrap sesji/roli. UI wykorzystuje `app_role` do warunkowego renderowania linku „Admin” oraz do konfiguracji guardów.

## Nowe endpointy (proponowane)

### 1) `GET /admin/summary`

**Opis**: Minimalne podsumowanie dla dashboardu admina. Na MVP może zwracać stub/placeholder.

- **Auth**: wymagany JWT + `app_role = 'admin'`
- **Query params**: brak (na MVP)
- **Odpowiedzi**:
    - `200 OK`
    - `401 Unauthorized`
    - `403 Forbidden`

**Przykładowa odpowiedź (MVP — stub):**

```json
{
  "version": "mvp-stub",
  "generated_at": "2026-02-11T22:00:00Z",
  "notes": "Admin dashboard placeholder; dane zostaną dodane w kolejnych iteracjach.",
  "metrics": {
    "users_total": null,
    "recipes_total": null,
    "public_recipes_total": null
  }
}
```

**Uwagi implementacyjne (kierunek, nie zobowiązanie MVP):**

- Najbardziej spójne z obecną architekturą: zaimplementować jako **Supabase Edge Function** (analogicznie do `/ai/*`) albo jako RPC/endpoint po stronie backendu.
- Dane metryk mogą pochodzić z agregacji w Postgres (np. widoki/materialized view) z ograniczeniem admin-only.

### 2) (Opcjonalnie) `GET /admin/health`

**Opis**: Prosty endpoint diagnostyczny (np. sprawdzenie połączenia z DB / wersji aplikacji). Pomocny w przyszłości.

- **Auth**: admin-only
- **Odpowiedzi**:
    - `200 OK`
    - `401 Unauthorized`
    - `403 Forbidden`

**Przykładowa odpowiedź:**

```json
{
  "status": "ok",
  "checked_at": "2026-02-11T22:00:00Z"
}
```

## Kontrakty błędów (wspólne)

### `403 Forbidden` (przykład)

```json
{
  "error": "forbidden",
  "message": "Brak uprawnień do zasobu admin."
}
```

