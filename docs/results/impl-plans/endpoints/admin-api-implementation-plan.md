## API Endpoints Implementation Plan: Admin (`/admin/*`)

### 1. Przegląd punktu końcowego

Sekcja `/admin/*` dostarcza **admin-only** endpointy dla przyszłej rozbudowy dashboardu administracyjnego. W MVP endpointy zwracają **stub** (placeholder), ale są wdrażane zgodnie z docelowym standardem: JWT + weryfikacja roli `admin` po stronie backendu.

Docelowa implementacja powinna być zrealizowana jako **Supabase Edge Function** `admin` (katalog `supabase/functions/admin/`), analogicznie do istniejących funkcji (`me`, `public`, `internal`, itd.).

### 2. Szczegóły żądania

### 2.1 `GET /admin/summary`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/admin/summary`
  - wywołanie przez Supabase: `GET /functions/v1/admin/summary`
- **Parametry**:
  - **Wymagane**: brak (poza nagłówkiem `Authorization`)
  - **Opcjonalne**: brak
- **Request headers**:
  - `Authorization: Bearer <JWT>` (wymagany)
- **Request Body**: brak

### 2.2 (Opcjonalnie) `GET /admin/health`
- **Metoda HTTP**: `GET`
- **Struktura URL**: `/admin/health`
  - wywołanie przez Supabase: `GET /functions/v1/admin/health`
- **Parametry**: brak
- **Request headers**:
  - `Authorization: Bearer <JWT>` (wymagany)
- **Request Body**: brak

### 3. Wykorzystywane typy

### 3.1 Nowe DTO (do dodania do `shared/contracts/types.ts`)
- `AdminSummaryDto`
- `AdminHealthDto`

Proponowane kontrakty:

```ts
export interface AdminSummaryDto {
    version: string;
    generated_at: string; // ISO 8601
    notes: string;
    metrics: {
        users_total: number | null;
        recipes_total: number | null;
        public_recipes_total: number | null;
    };
}

export interface AdminHealthDto {
    status: 'ok';
    checked_at: string; // ISO 8601
}
```

### 3.2 Błędy (istniejący standard w Edge Functions)
W całym backendzie obowiązuje kontrakt:

```json
{ "code": "FORBIDDEN", "message": "..." }
```

Zwracany przez `ApplicationError.toJSON()` oraz `handleError()`.

### 4. Szczegóły odpowiedzi

### 4.1 `GET /admin/summary`
- **200 OK** — zwraca `AdminSummaryDto`

Przykład (MVP — stub):

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

- **401 Unauthorized** — brak/niepoprawny token
- **403 Forbidden** — poprawny token, ale brak roli admin
- **500 Internal Server Error** — błąd nieoczekiwany

### 4.2 (Opcjonalnie) `GET /admin/health`
- **200 OK** — zwraca `AdminHealthDto`

Przykład:

```json
{
  "status": "ok",
  "checked_at": "2026-02-11T22:00:00Z"
}
```

- **401 Unauthorized**
- **403 Forbidden**
- **500 Internal Server Error**

### 5. Przepływ danych

### 5.1 MVP (stub)
1. Router w Edge Function `admin` rozpoznaje ścieżkę `/admin/summary` lub `/admin/health`.
2. Handler wykonuje:
   - ekstrakcję tokenu z `Authorization`
   - ekstrakcję i walidację `app_role` (z JWT)
   - weryfikację tokenu w Supabase (`auth.getUser()`), aby potwierdzić ważność podpisu i sesji
   - guard: `app_role === 'admin'`
3. Serwis zwraca statyczne dane (stub) + timestamp (`generated_at` / `checked_at`).
4. Handler zwraca `200` z JSON.

### 5.2 Iteracje przyszłe (metryki)
- `AdminSummaryService` może pobierać metryki z Postgresa:
  - najbezpieczniej przez RPC/widoki agregujące (np. `admin_summary_metrics()`), aby logika i optymalizacja były w DB
  - alternatywnie: pojedyncze zapytania `count(*)` po tabelach (ryzyko wydajnościowe przy wzroście danych)
- Jeśli używany jest klient service-role (bypass RLS), to:
  - sprawdzenie `admin` musi nastąpić **przed** jakimkolwiek odczytem
  - serwis nie może przyjmować parametrów pozwalających na selektywny odczyt wrażliwych danych (na MVP brak parametrów)

### 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany `Authorization: Bearer <JWT>`.
- **Weryfikacja tokenu**: obowiązkowo przez Supabase `auth.getUser()` (ochrona przed fałszywym tokenem / wygasłą sesją).
- **Autoryzacja (RBAC)**:
  - `app_role` wyciągany z JWT (`app_role` lub `app_metadata.app_role`)
  - tylko `admin` ma dostęp, w przeciwnym razie `403`.
- **Brak „migania” w UI**: po stronie API nie ma wpływu, ale endpointy pozwalają UI bezpiecznie ustalić dostęp (po bootstrapie `/me`).
- **CORS**: dla endpointów używanych z przeglądarki stosować standard CORS jak w innych funkcjach (np. `me`, `public`). (Wyjątek: endpointy stricte internal — tutaj nie dotyczy.)
- **Minimalizacja danych**: w MVP stub nie zwraca danych wrażliwych; w przyszłości endpoint powinien zwracać tylko zagregowane metryki.

### 7. Obsługa błędów

### 7.1 Scenariusze błędów
- **Brak Authorization** → `401` (`UNAUTHORIZED`)
- **Token niepoprawny / wygasły** → `401` (`UNAUTHORIZED`)
- **Rola != admin** → `403` (`FORBIDDEN`)
- **Nieznana ścieżka** → `404` (`NOT_FOUND`)
- **Niedozwolona metoda** → `405` (`METHOD_NOT_ALLOWED`)
- **Błąd nieoczekiwany** → `500` (`INTERNAL_ERROR`)

### 7.2 Kontrakt błędu (spójny z istniejącymi funkcjami)
- Zwracany JSON:
  - `code`: kod błędu (np. `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`)
  - `message`: komunikat dla klienta

### 7.3 Logowanie
- Każdy request: `logger.info` (metoda, ścieżka, korelacja jeśli istnieje).
- Błędy:
  - `logger.warn` dla 401/403/404/405
  - `logger.error` dla 500 + stack jeśli dostępny
- Brak zapisu do dedykowanej tabeli błędów (zgodnie ze stanem repo).

### 8. Rozważania dotyczące wydajności

- MVP stub jest stałoczasowy i lekki.
- Przyszłe metryki:
  - unikać wielu `count(*)` w request path; preferować **widoki/materialized view** lub **RPC** w DB
  - rozważyć cache po stronie Edge Function (krótki TTL) lub Cache-Control dla odpowiedzi (tylko dla adminów; ostrożnie z cache współdzielonym)

### 9. Kroki implementacji

1. **Dodać Edge Function `admin`**:
   - utworzyć katalog `supabase/functions/admin/`
   - dodać `index.ts` z CORS (GET/OPTIONS) + global try/catch (jak `me`)
2. **Zaimplementować router i handlery** (`admin.handlers.ts`):
   - routing po `url.pathname`:
     - `GET /admin/summary`
     - `GET /admin/health` (opcjonalnie)
   - walidacja metody (GET/OPTIONS), inaczej `405`
3. **Dodać warstwę serwisową** (`admin.service.ts`):
   - `getAdminSummary()` zwracające stub `AdminSummaryDto`
   - `getAdminHealth()` zwracające stub `AdminHealthDto`
4. **Wymusić admin-only na backendzie**:
   - `extractAuthToken(req)` + `extractAndValidateAppRole(token)`
   - `getAuthenticatedContext(req)` w celu weryfikacji tokenu przez Supabase
   - guard: jeśli `app_role !== 'admin'` → `throw new ApplicationError('FORBIDDEN', ...)`
5. **Dodać DTO do kontraktów współdzielonych**:
   - uzupełnić `shared/contracts/types.ts` o `AdminSummaryDto` i `AdminHealthDto`
6. **Testy manualne i kontraktowe**:
   - dodać `supabase/functions/admin/test-requests.http` z przypadkami:
     - 200 (admin token)
     - 401 (brak tokenu)
     - 403 (token user/premium)
     - 404/405 (złe ścieżki/metody)
7. **Dokumentacja**:
   - opisać endpointy w dokumentacji API (jeśli repo ma centralny spis endpointów; w MVP wystarczy aktualizacja planu/README funkcji).
