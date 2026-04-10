# Admin Sidebar Navigation — plan API

## Cel API

Rozszerzenie `admin-sidebar-navigation` dotyczy przede wszystkim **nawigacji i layoutu UI** w sekcji `/admin/*`. W tym MVP nie wprowadzamy nowego kontraktu backendowego dla widoku `Użytkownicy`; ekran ma charakter wyłącznie placeholderowy.

## Autoryzacja i bezpieczeństwo

- Wszystkie trasy i ewentualne endpointy w sekcji `/admin/*` pozostają **admin-only**.
- Źródłem uprawnień jest claim `app_role` w JWT:
    - `user`
    - `premium`
    - `admin`
- Weryfikacja uprawnień musi być wykonywana zarówno po stronie UI, jak i backendu.
- Oczekiwane odpowiedzi błędów dla zasobów admin-only:
    - `401 Unauthorized` — brak lub niepoprawny token,
    - `403 Forbidden` — token poprawny, ale `app_role !== 'admin'`.

## Istniejące endpointy wykorzystywane przez UI

### `GET /me`

**Opis**: Bootstrap sesji i roli użytkownika.

**Rola w tym ficzerze**:

- UI wykorzystuje `app_role` do ustalenia, czy użytkownik może wejść do sekcji `/admin/*`.
- Guard i warunkowe renderowanie sekcji admina pozostają oparte o ten sam mechanizm co dotychczas.

### `GET /admin/summary`

**Opis**: Minimalne podsumowanie dla dashboardu admina.

**Rola w tym ficzerze**:

- Endpoint pozostaje wystarczający dla widoku `/admin/dashboard`.
- Może nadal zwracać stub/placeholder zgodnie z wcześniejszym planem `admin-dashboard`.
- Rozszerzenie o aside nie wymaga zmiany kontraktu tego endpointu.

## Nowe endpointy w MVP

### Brak nowych endpointów

Na potrzeby `admin-sidebar-navigation` **nie dodajemy**:

- `GET /admin/users`
- endpointów wyszukiwania użytkowników,
- endpointów zarządzania rolami,
- endpointów aktywacji, blokowania lub edycji użytkowników.

Powód:

- Widok `Użytkownicy` ma być na tym etapie wyłącznie pustą stroną placeholderową.
- Dodanie kontraktu API sugerowałoby gotowość funkcjonalną, której zakres MVP nie obejmuje.

## Zachowanie widoku `Użytkownicy`

- Trasa `/admin/users` renderuje statyczny placeholder bez wywołań backendowych.
- Widok nie wymaga stanu ładowania danych, pustej tabeli ani obsługi błędów API.
- Jedynym wymogiem bezpieczeństwa pozostaje ochrona całej trasy `/admin/*` przez mechanizm admin-only.

## Kierunek przyszłej rozbudowy (bez kontraktowania teraz)

W przyszłej iteracji można dodać dedykowany zestaw endpointów, np.:

- `GET /admin/users`
- `GET /admin/users/{id}`
- `PATCH /admin/users/{id}/role`
- `PATCH /admin/users/{id}/status`

Na obecnym etapie nie definiujemy jednak:

- parametrów query,
- struktury odpowiedzi,
- modelu filtrowania i paginacji,
- kontraktów mutacji.

## Kontrakty błędów (wspólne dla admin-only)

### `403 Forbidden` (przykład)

```json
{
  "error": "forbidden",
  "message": "Brak uprawnień do zasobu admin."
}
```
