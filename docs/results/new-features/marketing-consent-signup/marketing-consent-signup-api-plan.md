# Marketing Consent Signup — plan API

## Cel API

Rozszerzyć istniejący proces rejestracji o zapis decyzji użytkownika dotyczącej zgody marketingowej, bez dodawania nowego endpointu i bez zmiany obecnego przepływu potwierdzenia e-mail.

## MVP — zmiana istniejącego endpointu

### 1) `POST /auth/signup`

**Opis**: Rejestracja nowego użytkownika z opcjonalną zgodą marketingową przekazywaną w payloadzie formularza.

- **Auth**: brak
- **Zmiana względem obecnego kontraktu**: rozszerzenie body o obiekt `marketing_consent`

### Request body

```json
{
  "email": "anna@example.com",
  "password": "Secret123!",
  "username": "ania",
  "marketing_consent": {
    "accepted": true,
    "text_version": "marketing-consent-pl-v1"
  }
}
```

### Pola requestu

- `email` — `string`, wymagane
- `password` — `string`, wymagane
- `username` — `string`, wymagane
- `marketing_consent` — `object`, wymagane w payloadzie dla jawności kontraktu
- `marketing_consent.accepted` — `boolean`, wymagane
- `marketing_consent.text_version` — `string | null`
    - wymagane jako `string`, gdy `accepted = true`
    - powinno być `null`, gdy `accepted = false`

### Reguły walidacji

- Jeśli `marketing_consent.accepted = true`, pole `marketing_consent.text_version` musi zawierać wspierany identyfikator wersji treści zgody.
- Jeśli `marketing_consent.accepted = false`, backend zapisuje brak zgody i ignoruje brak wersji tekstu.
- Checkbox marketingowy nie wpływa na walidację obowiązkowych pól rejestracji (`email`, `password`, `username`).
- Backend powinien walidować, czy `text_version` należy do znanego zestawu wersji wspieranych przez aktualny formularz rejestracji.

### Zapis danych po stronie backendu

Po skutecznej rejestracji backend tworzy/uzupełnia rekord w **`profiles`**:

- `marketing_consent = true | false`
- `marketing_consent_updated_at = timestamp | null`
- `marketing_consent_text_version = string | null`

### Reguły persistencji

- Dla `accepted = true`:
    - `marketing_consent = true`
    - `marketing_consent_updated_at = czas rejestracji`
    - `marketing_consent_text_version = text_version z requestu`
- Dla `accepted = false`:
    - `marketing_consent = false`
    - `marketing_consent_updated_at = null`
    - `marketing_consent_text_version = null`

### Odpowiedzi

- `201 Created` lub odpowiedź zgodna z obecnym flow Supabase/Auth wrappera
- `400 Bad Request` — niepoprawny payload zgody
- `409 Conflict` — konflikt danych użytkownika, np. istniejący e-mail / username
- `422 Unprocessable Entity` — nieobsługiwana wersja treści zgody lub niespójna kombinacja pól

### Przykładowa odpowiedź sukcesu

```json
{
  "user_id": "67b7fd36-c2c7-4d9f-8d0f-6b7fb3b73f12",
  "email": "anna@example.com",
  "email_verification_sent": true,
  "app_role": "user"
}
```

## Kontrakty błędów (przykłady)

### `422 Unprocessable Entity` — niespójna zgoda

```json
{
  "error": "invalid_marketing_consent",
  "message": "Pole marketing_consent.text_version jest wymagane, gdy zgoda marketingowa została zaznaczona."
}
```

### `422 Unprocessable Entity` — nieznana wersja treści zgody

```json
{
  "error": "unsupported_marketing_consent_version",
  "message": "Przekazana wersja treści zgody marketingowej nie jest obsługiwana."
}
```

## Zmiany w modelu danych

### Tabela `profiles`

Dodać kolumny:

- `marketing_consent` — `boolean not null default false`
- `marketing_consent_updated_at` — `timestamptz null`
- `marketing_consent_text_version` — `text null`

## Zmiany w istniejących endpointach poza signup

- **Nowe endpointy**: brak
- **Zmiany w `POST /auth/login`**: brak
- **Zmiany w `GET /me`**: brak w MVP
- **Zmiany w `GET /profile` / `PUT /profile`**: brak w MVP, ponieważ zarządzanie zgodą po rejestracji pozostaje poza zakresem

## Uwagi implementacyjne

- Najbardziej spójne z obecną architekturą będzie rozszerzenie warstwy obsługującej signup tak, aby po utworzeniu użytkownika w `auth.users` zapisywać dodatkowe pola w `profiles`.
- Identyfikator `marketing_consent.text_version` powinien pochodzić z backendu lub współdzielonej konfiguracji, aby uniknąć rozjazdu między tekstem wyświetlanym w UI a wartością zapisaną w bazie.
- W przyszłości, jeśli pojawi się zarządzanie zgodą w `Ustawieniach`, obecny model można rozszerzyć o historię zmian lub osobną tabelę audytową.

## Definition of Done (API)

- `POST /auth/signup` przyjmuje informację o zgodzie marketingowej.
- Rejestracja działa poprawnie zarówno przy `accepted = false`, jak i `accepted = true`.
- Backend zapisuje status zgody, timestamp oraz wersję treści zgody zgodnie z regułami MVP.
- Nie dodajemy osobnych endpointów do obsługi zgód w tej iteracji.
