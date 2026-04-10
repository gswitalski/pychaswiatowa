# Admin Users List — plan API

## Cel API

Dostarczyć bezpieczny kontrakt backendowy dla widoku `/admin/users`, który pozwoli administratorowi pobierać stronicowaną i sortowalną listę użytkowników wraz z podstawowymi danymi profilu, informacją o ostatnim logowaniu, liczbą przepisów oraz rolą.

## Dlaczego potrzebny jest dedykowany endpoint admin-only

- Widok wymaga połączenia danych z kilku źródeł:
    - `profiles` — `id`, `username`, data utworzenia profilu
    - Supabase Auth — `email` używany do logowania oraz `last_sign_in_at`
    - źródło roli używane do nadawania claimu `app_role`
    - agregacja po `recipes` — liczba aktywnych przepisów użytkownika
- Bezpieczne pobranie takich danych nie powinno odbywać się bezpośrednio z klienta przez zwykłe zapytania do tabel z RLS.
- Najbardziej spójny kierunek implementacyjny to endpoint wykonywany po stronie backendu z jawnym wymuszeniem uprawnień `admin`.

## Autoryzacja i bezpieczeństwo

- Endpoint jest **admin-only**.
- Wymagany jest poprawny JWT z claimem `app_role = admin`.
- Backend musi weryfikować uprawnienia niezależnie od guardów w UI.
- Oczekiwane odpowiedzi błędów:
    - `401 Unauthorized` — brak lub niepoprawny token
    - `403 Forbidden` — token poprawny, ale `app_role !== 'admin'`

## Nowy endpoint

### `GET /admin/users`

**Opis**: Zwraca stronicowaną listę użytkowników do tabeli administracyjnej.

**Auth**: wymagany JWT + `app_role = 'admin'`

### Query params

- `page` — numer strony, domyślnie `1`
- `page_size` — rozmiar strony, domyślnie `25`
- `sort_by` — pole sortowania:
    - `created_at`
    - `login`
    - `last_sign_in_at`
    - `recipes_count`
- `sort_dir` — kierunek sortowania:
    - `asc`
    - `desc`

### Domyślne zachowanie

- Jeśli klient nie poda parametrów sortowania, backend stosuje:
    - `sort_by = created_at`
    - `sort_dir = desc`
- Jeśli klient nie poda parametrów paginacji, backend stosuje:
    - `page = 1`
    - `page_size = 25`
- W MVP endpoint nie wspiera filtrowania ani wyszukiwania.

### Struktura pojedynczego rekordu

- `id` — `uuid`, identyfikator użytkownika
- `login` — `string`, e-mail logowania z Supabase Auth
- `username` — `string`, wartość z `profiles.username`
- `role` — `user | premium | admin`
- `created_at` — `string (ISO 8601)`, data rejestracji
- `last_sign_in_at` — `string (ISO 8601) | null`, data ostatniego logowania z Supabase
- `recipes_count` — `number`, liczba aktywnych przepisów użytkownika (`deleted_at IS NULL`)

### Przykładowa odpowiedź `200 OK`

```json
{
  "items": [
    {
      "id": "4ec7f8d2-c2d7-4d2f-bddc-113c6f5f6d1d",
      "login": "admin@pychaswiatowa.pl",
      "username": "pycha-admin",
      "role": "admin",
      "created_at": "2026-03-20T18:15:00Z",
      "last_sign_in_at": "2026-04-10T07:42:11Z",
      "recipes_count": 12
    },
    {
      "id": "aa582e5b-0eef-4712-b984-58012ecfd6a6",
      "login": "ola@example.com",
      "username": "ola_kucharzy",
      "role": "premium",
      "created_at": "2026-03-18T09:31:44Z",
      "last_sign_in_at": null,
      "recipes_count": 3
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 25,
    "total_items": 142,
    "total_pages": 6
  },
  "sorting": {
    "sort_by": "created_at",
    "sort_dir": "desc"
  }
}
```

## Semantyka sortowania

- `created_at`:
    - sortowanie po dacie rejestracji konta
    - domyślnie `desc`
- `login`:
    - sortowanie alfabetyczne po loginie/e-mailu
    - rekomendowane porównanie case-insensitive
- `last_sign_in_at`:
    - sortowanie po dacie ostatniego logowania
    - wartości `null` powinny trafiać na koniec listy przy `desc`
- `recipes_count`:
    - sortowanie po liczbie aktywnych przepisów

## Źródła danych i agregacja

### `profiles`

Źródło pól:

- `id`
- `username`
- `created_at`

### Supabase Auth

Źródło pól:

- `email` mapowany do pola `login`
- `last_sign_in_at`

### Rola użytkownika

- Endpoint powinien korzystać z tego samego źródła prawdy, które służy do nadawania JWT claim `app_role`.
- Jeśli rola nie jest trwale przechowywana w `profiles`, nie należy duplikować jej wyłącznie na potrzeby UI bez wyraźnej decyzji architektonicznej.

### Liczba przepisów

- `recipes_count` powinno oznaczać liczbę aktywnych przepisów użytkownika.
- Rekomendowane liczenie:
    - `recipes.user_id = user.id`
    - `recipes.deleted_at IS NULL`

## Walidacja parametrów

- `page` musi być liczbą całkowitą `>= 1`
- `page_size` musi być liczbą całkowitą `>= 1`
- `sort_by` spoza dozwolonej listy powinno zwracać `400 Bad Request`
- `sort_dir` spoza wartości `asc|desc` powinno zwracać `400 Bad Request`

### Przykładowa odpowiedź `400 Bad Request`

```json
{
  "error": "invalid_query_params",
  "message": "Nieprawidłowe parametry paginacji lub sortowania."
}
```

## Kontrakty błędów

### `401 Unauthorized`

```json
{
  "error": "unauthorized",
  "message": "Brak autoryzacji."
}
```

### `403 Forbidden`

```json
{
  "error": "forbidden",
  "message": "Brak uprawnień do zasobu admin."
}
```

## Zachowanie w MVP

- Endpoint służy wyłącznie do odczytu listy użytkowników.
- Brak wspieranych mutacji typu:
    - `PATCH /admin/users/{id}/role`
    - `PATCH /admin/users/{id}/status`
    - `DELETE /admin/users/{id}`
- Brak filtrowania, wyszukiwania i eksportu danych.

## Kierunek implementacyjny (rekomendacja)

- Najbezpieczniejszym wariantem jest implementacja jako serwerowy endpoint lub Supabase Edge Function typu admin-only.
- Warstwa backendowa powinna:
    - zweryfikować token i rolę `admin`,
    - pobrać dane z `profiles`,
    - pobrać metadata z Supabase Auth,
    - zbudować agregację `recipes_count`,
    - zwrócić gotowy kontrakt dla tabeli.

Takie podejście pozwala zachować prosty frontend oraz nie eksponować klientowi nadmiarowych uprawnień do danych systemowych.
