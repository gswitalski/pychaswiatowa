# Profile Settings — plan API

## Cel API

Rozszerzyć istniejące API profilu tak, aby widok **`/settings`** mógł pobrać komplet danych potrzebnych do wyświetlenia formularza, zapisać zmianę `username` oraz bieżącej zgody marketingowej, a także wykonać bezpieczną zmianę hasła z weryfikacją starego hasła.

## Założenia architektoniczne

- Endpointy sekcji profilu są prywatne i wymagają JWT (`Authorization: Bearer <token>`).
- Dane profilu pochodzą z dwóch źródeł:
    - `auth.users` / warstwa auth — źródło adresu e-mail oraz obsługi hasła,
    - `profiles` — źródło `username` i zgody marketingowej.
- Nie dodajemy osobnego pola `display_name`; UI korzysta z istniejącego `username`.
- Zgoda marketingowa pozostaje prostym bieżącym stanem profilu, bez historii zmian.

## Zmiany w istniejących endpointach

### 1) `GET /profile`

**Opis**: Pobranie danych profilu potrzebnych do wyrenderowania formularza ustawień.

- **Auth**: wymagany JWT
- **Zmiana względem obecnego kontraktu**: odpowiedź powinna zawierać także adres e-mail z warstwy auth oraz bieżący stan zgody marketingowej.

### Odpowiedź `200 OK`

```json
{
  "id": "67b7fd36-c2c7-4d9f-8d0f-6b7fb3b73f12",
  "email": "anna@example.com",
  "username": "ania",
  "marketing_consent": true,
  "marketing_consent_updated_at": "2026-03-27T18:30:00Z",
  "marketing_consent_text_version": "marketing-consent-pl-v1"
}
```

### Pola odpowiedzi

- `id` — `uuid`, identyfikator użytkownika/profilu
- `email` — `string`, adres e-mail tylko do odczytu
- `username` — `string`, nazwa wyświetlana użytkownika
- `marketing_consent` — `boolean`
- `marketing_consent_updated_at` — `string | null` (`ISO 8601`)
- `marketing_consent_text_version` — `string | null`

### Reguły

- Jeśli użytkownik nie ma jeszcze formalnie uzupełnionych pól marketingowych, API powinno zwracać:
    - `marketing_consent = false`,
    - `marketing_consent_updated_at = null`,
    - `marketing_consent_text_version = null`.

## 2) `PUT /profile`

**Opis**: Aktualizacja danych edytowalnych profilu z widoku ustawień.

- **Auth**: wymagany JWT
- **Zmiana względem obecnego kontraktu**: endpoint aktualizuje nie tylko `username`, ale również bieżącą zgodę marketingową.

### Request body

```json
{
  "username": "ania-k",
  "marketing_consent": false,
  "marketing_consent_text_version": "marketing-consent-pl-v1"
}
```

### Pola requestu

- `username` — `string`, wymagane
- `marketing_consent` — `boolean`, wymagane
- `marketing_consent_text_version` — `string`, wymagane (allowlista backendu)

### Reguły walidacji

- `username` podlega dotychczasowym regułom walidacyjnym systemu.
- `marketing_consent` musi być wartością `true` albo `false`.
- Gdy `marketing_consent = true`, backend powinien zapisać wspieraną wersję treści zgody w `marketing_consent_text_version`.
- Gdy `marketing_consent = false`, backend może:
    - zachować ostatnią wersję tekstu zgody dla celu informacyjnego, albo
    - wyzerować `marketing_consent_text_version`.

> Rekomendowany wariant dla spójności z prostym MVP: przy każdej zmianie decyzji aktualizować `marketing_consent_updated_at`, a `marketing_consent_text_version` ustawiać na wersję aktualnie używaną przez UI również przy wycofaniu zgody. Dzięki temu rekord przechowuje informację, przy jakiej wersji treści użytkownik podjął ostatnią decyzję.

### Reguły persistencji

- Przy każdej zmianie `marketing_consent` backend aktualizuje:
    - `marketing_consent`,
    - `marketing_consent_updated_at = timestamp aktualizacji`,
    - `marketing_consent_text_version = aktualna wersja treści`.
- Jeśli użytkownik aktualizuje wyłącznie `username`, pola marketingowe nie powinny być nadpisywane przypadkowymi wartościami.
- Aktualizacja dotyczy wyłącznie profilu zalogowanego użytkownika.

### Odpowiedź `200 OK`

```json
{
  "id": "67b7fd36-c2c7-4d9f-8d0f-6b7fb3b73f12",
  "email": "anna@example.com",
  "username": "ania-k",
  "marketing_consent": false,
  "marketing_consent_updated_at": "2026-03-27T18:45:00Z",
  "marketing_consent_text_version": "marketing-consent-pl-v1"
}
```

### Odpowiedzi błędów

- `400 Bad Request` — niepoprawny payload
- `401 Unauthorized` — brak lub niepoprawny token
- `404 Not Found` — brak rekordu profilu dla zalogowanego użytkownika
- `409 Conflict` — konflikt `username`, jeśli obowiązuje reguła unikalności
- `422 Unprocessable Entity` — niespójna kombinacja pól, np. niewspierana wersja treści zgody

## Nowy endpoint (proponowany)

### 3) `POST /profile/change-password`

**Opis**: Zmiana hasła zalogowanego użytkownika z wymaganą weryfikacją starego hasła.

- **Auth**: wymagany JWT
- **Uzasadnienie**: semantycznie czytelniejszy i bezpieczniejszy kontrakt dla osobnej akcji niż przeciążanie `PUT /profile`.

### Request body

```json
{
  "current_password": "OldSecret123!",
  "new_password": "NewSecret123!"
}
```

### Pola requestu

- `current_password` — `string`, wymagane
- `new_password` — `string`, wymagane

### Reguły walidacji

- `current_password` musi zostać podane.
- `new_password` musi spełniać obowiązującą politykę haseł.
- `new_password` nie może być puste ani identyczne z obecnym hasłem, jeśli system chce narzucić taką regułę.
- Backend przed zmianą hasła musi zweryfikować poprawność `current_password`.

### Zachowanie operacji

- Dla poprawnego starego hasła backend aktualizuje hasło użytkownika w warstwie auth.
- Po sukcesie bieżąca sesja użytkownika na tym urządzeniu pozostaje aktywna.
- MVP nie obejmuje wylogowania innych urządzeń ani rotacji wszystkich sesji.

### Odpowiedź `200 OK`

```json
{
  "status": "ok",
  "message": "Password updated successfully."
}
```

### Odpowiedzi błędów

- `400 Bad Request` — brak wymaganych pól lub niespełniona polityka hasła
- `401 Unauthorized` — brak lub niepoprawny token
- `422 Unprocessable Entity` — niepoprawne stare hasło
- `500 Internal Server Error` — błąd techniczny w warstwie auth/backend

### Przykładowy błąd niepoprawnego starego hasła

```json
{
  "error": "invalid_current_password",
  "message": "Podane stare hasło jest niepoprawne."
}
```

## Uwagi implementacyjne

- `GET /profile` i `PUT /profile` mogą pozostać warstwą agregującą dane z `profiles` oraz z kontekstu auth użytkownika.
- Najbardziej spójne z architekturą Supabase będzie wykonanie zmiany hasła przez kontrolowaną warstwę backendową lub Edge Function, która:
    - sprawdzi bieżącą sesję użytkownika,
    - potwierdzi poprawność starego hasła,
    - wywoła zmianę hasła w auth.
- Wersja treści zgody marketingowej powinna pochodzić ze współdzielonej konfiguracji frontendu/backendu, aby uniknąć rozjazdu między UI a persistencją.

## Definition of Done (API)

- `GET /profile` zwraca komplet danych dla formularza ustawień: `email`, `username` i zgodę marketingową.
- `PUT /profile` zapisuje `username` i bieżący stan zgody marketingowej.
- `POST /profile/change-password` obsługuje zmianę hasła po poprawnej weryfikacji starego hasła.
- Kontrakty błędów pozwalają UI pokazać jednoznaczne komunikaty w formularzu profilu i w modalu zmiany hasła.
