# API Endpoints Implementation Plan: Marketing Consent Signup (`POST /auth/signup`)

## 1. Przegląd punktu końcowego

Celem zmiany jest rozszerzenie istniejącego procesu rejestracji o **jawny, opcjonalny zapis zgody marketingowej** bez dodawania nowego endpointu i bez zmiany obecnego flow weryfikacji adresu e-mail.

Zakres MVP obejmuje wyłącznie `POST /auth/signup` i zapis bieżącego stanu zgody w tabeli `profiles`:

- `marketing_consent`
- `marketing_consent_updated_at`
- `marketing_consent_text_version`

Najważniejszy kontekst implementacyjny dla tego repo:

- obecnie rejestracja odbywa się przez `supabase.auth.signUp(...)` wywoływane z frontendu,
- rekord `profiles` jest tworzony automatycznie przez trigger `handle_new_user()` po insercie do `auth.users`,
- w repo nie ma jeszcze dedykowanej Edge Function `auth`.

Z tego powodu rekomendowany wariant MVP to:

1. zachować publiczny kontrakt endpointu jako `POST /auth/signup`,
2. rozszerzyć kontrakt aplikacyjny o obiekt `marketing_consent`,
3. mapować ten kontrakt w `AuthService` do `supabase.auth.signUp(...)`,
4. wykonać **backendową walidację i persistencję** w warstwie bazy danych podczas tworzenia profilu.

To pozwala spełnić wymaganie "backend nie ufa samemu UI", a jednocześnie nie wymaga budowy osobnego wrappera HTTP tylko dla tego ficzera.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/auth/signup`
- **Auth**: brak
- **Query params**: brak
- **Path params**: brak

### Wymagane parametry

- `email: string`
- `password: string`
- `username: string`
- `marketing_consent: object`
- `marketing_consent.accepted: boolean`

### Parametry opcjonalne lub warunkowe

- `marketing_consent.text_version: string | null`
  - wymagane, gdy `marketing_consent.accepted = true`
  - musi być `null`, gdy `marketing_consent.accepted = false`

### Docelowy kontrakt request body

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

### Uwaga implementacyjna dla obecnej architektury

Ponieważ bieżący kod korzysta z `supabase.auth.signUp(...)`, warstwa aplikacyjna powinna przyjąć powyższy kontrakt, a następnie zamapować go do payloadu Supabase:

```ts
{
    email,
    password,
    options: {
        data: {
            username,
            marketing_consent_accepted: true,
            marketing_consent_text_version: 'marketing-consent-pl-v1'
        },
        emailRedirectTo: callbackUrl
    }
}
```

Dzięki temu:

- kontrakt domenowy pozostaje zgodny z planem API,
- szczegóły SDK Supabase nie wyciekają do warstwy współdzielonych DTO,
- trigger DB może odczytać metadane z `auth.users.raw_user_meta_data`.

### Walidacja wejścia

Walidacja musi zajść w dwóch miejscach:

1. **Walidacja kontraktu aplikacyjnego**:
   - `email` zgodny z istniejącym flow signup,
   - `password` zgodne z istniejącą polityką haseł,
   - `username` 3-50 znaków zgodnie z ograniczeniami `profiles`,
   - `marketing_consent.accepted` jest obowiązkowym booleanem,
   - `marketing_consent.text_version` jest wymagane wyłącznie przy `accepted = true`.

2. **Walidacja backendowa / bazodanowa**:
   - backend akceptuje wyłącznie wersje zgody z allowlisty,
   - backend nie przyjmuje timestampu z klienta,
   - backend odrzuca niespójną kombinację pól:
     - `accepted = true` i `text_version = null`,
     - `accepted = false` i `text_version != null`,
     - `accepted = true` i nieobsługiwana wersja tekstu.

## 3. Wykorzystywane typy

### 3.1 Typy współdzielone (`shared/contracts/types.ts`)

Należy odejść od obecnego modelu `SignUpRequestDto`, który odwzorowuje kształt SDK Supabase, i zastąpić go kontraktem domenowym aplikacji.

Rekomendowane DTO:

- `MarketingConsentTextVersion`
- `MarketingConsentSignupDto`
- zaktualizowany `SignUpRequestDto`

Proponowany kształt:

```ts
export type MarketingConsentTextVersion = 'marketing-consent-pl-v1';

export interface MarketingConsentSignupDto {
    accepted: boolean;
    text_version: MarketingConsentTextVersion | null;
}

export interface SignUpRequestDto {
    email: string;
    password: string;
    username: string;
    marketing_consent: MarketingConsentSignupDto;
}
```

### 3.2 Typy wewnętrzne warstwy auth

W `AuthService` warto wprowadzić prywatny mapper lub pomocniczy typ dla formatu Supabase, np.:

- `SupabaseSignUpMetadata`
- `mapSignUpRequestToSupabasePayload()`

To pozwoli utrzymać rozdział:

- DTO aplikacyjne opisują kontrakt produktu,
- mapper zna szczegóły `supabase.auth.signUp(...)`.

### 3.3 Model danych

Tabela `profiles` musi zostać rozszerzona o:

- `marketing_consent boolean not null default false`
- `marketing_consent_updated_at timestamptz null`
- `marketing_consent_text_version text null`

### 3.4 Odpowiednik warstwy service po stronie backendu

Ponieważ dla signup nie istnieje obecnie Edge Function `auth`, logika biznesowa nie powinna zostać zaszyta bezpośrednio w triggerze jako duży blok inline. Rekomendowane wydzielenie do pomocniczej funkcji SQL/PLpgSQL, np.:

- `public.resolve_signup_marketing_consent(raw_user_meta_data jsonb)`

Zadania tej funkcji:

- odczyt metadanych z `auth.users.raw_user_meta_data`,
- walidacja `accepted` i `text_version`,
- normalizacja wartości do zapisu w `profiles`,
- zwrócenie gotowego zestawu pól lub rzucenie błędu biznesowego.

Trigger `handle_new_user()` powinien jedynie:

1. wywołać helper,
2. utworzyć rekord `profiles`,
3. przerwać operację przy niespójnych danych.

## 4. Szczegóły odpowiedzi

### Sukces

- **201 Created** lub semantycznie równoważna odpowiedź istniejącego flow auth
- odpowiedź pozostaje zgodna z obecnym procesem rejestracji: konto utworzone, e-mail weryfikacyjny wysłany, brak auto-logowania w UX po finalnym `signOut()`

Przykładowa odpowiedź sukcesu:

```json
{
  "user_id": "67b7fd36-c2c7-4d9f-8d0f-6b7fb3b73f12",
  "email": "anna@example.com",
  "email_verification_sent": true,
  "app_role": "user"
}
```

### Kody statusu

- `201 Created` - konto utworzone, zgoda zapisana zgodnie z regułami
- `400 Bad Request` - niepoprawny lub niespójny payload zgody marketingowej
- `401 Unauthorized` - nie dotyczy tego endpointu publicznego
- `404 Not Found` - nie dotyczy tego endpointu
- `409 Conflict` - konflikt unikalności użytkownika, jeśli warstwa auth mapuje ten przypadek jawnie
- `500 Internal Server Error` - błąd nieoczekiwany podczas tworzenia użytkownika lub profilu

### Reguły persistencji odpowiedzi sukcesu

#### Gdy `accepted = true`

- `marketing_consent = true`
- `marketing_consent_updated_at = now()`
- `marketing_consent_text_version = text_version`

#### Gdy `accepted = false`

- `marketing_consent = false`
- `marketing_consent_updated_at = null`
- `marketing_consent_text_version = null`

## 5. Przepływ danych

1. Użytkownik wysyła formularz rejestracji z danymi:
   - `email`
   - `password`
   - `username`
   - `marketing_consent.accepted`
   - `marketing_consent.text_version`
2. `RegisterPageComponent` przekazuje dane do `AuthService.signUp(...)` w formacie domenowym.
3. `AuthService` mapuje dane do wywołania `supabase.auth.signUp(...)`, umieszczając informacje o zgodzie w `options.data`.
4. Supabase tworzy rekord w `auth.users`.
5. Trigger `handle_new_user()` uruchamia backendową logikę tworzenia profilu.
6. Funkcja pomocnicza waliduje dane zgody z `raw_user_meta_data`:
   - sprawdza typ boolean,
   - sprawdza poprawność `text_version`,
   - oblicza finalne wartości do zapisu.
7. Trigger zapisuje rekord `profiles` z:
   - `id`
   - `username`
   - `marketing_consent`
   - `marketing_consent_updated_at`
   - `marketing_consent_text_version`
8. Jeśli walidacja backendowa zakończy się błędem, tworzenie użytkownika musi zostać przerwane, aby nie dopuścić do powstania konta bez spójnego profilu.
9. Frontend zachowuje obecny flow:
   - sukces signup,
   - `signOut()`,
   - redirect na `/register/verify-sent`.

## 6. Względy bezpieczeństwa

- **Dobrowolność zgody**:
  - checkbox musi być domyślnie odznaczony,
  - brak zgody nie może blokować rejestracji.
- **Backend nie ufa UI**:
  - frontend może jedynie zasugerować stan zgody,
  - ostateczna walidacja i zapis muszą być wykonane po stronie backendu.
- **Allowlista wersji zgody**:
  - backend musi akceptować wyłącznie znane `text_version`,
  - wersja powinna być utrzymywana jako jawna stała konfiguracyjna.
- **Brak klientowskiego timestampu**:
  - `marketing_consent_updated_at` wyznacza wyłącznie backend.
- **Brak masowego zapisu dowolnych metadanych**:
  - trigger/helper powinien odczytywać tylko wymagane klucze (`username`, `marketing_consent_accepted`, `marketing_consent_text_version`),
  - pozostałe pola z `raw_user_meta_data` należy ignorować.
- **Spójność transakcyjna**:
  - dla tego ficzera nie wolno utrzymać obecnego zachowania triggera polegającego na połykaniu błędu i zwracaniu `new`,
  - jeśli nie da się utworzyć profilu z poprawnym stanem zgody, signup powinien zakończyć się błędem.
- **RLS i zakres dostępu**:
  - po utworzeniu konta użytkownik nadal ma dostęp tylko do własnego `profiles`,
  - nowe kolumny dziedziczą ochronę istniejących polityk RLS dla tabeli `profiles`.

## 7. Obsługa błędów

### Scenariusze błędów

- `accepted = true` i brak `text_version` -> `400 Bad Request`
- `accepted = false` i `text_version != null` -> `400 Bad Request`
- `accepted = true` i nieobsługiwana wersja tekstu -> `400 Bad Request`
- brak lub zły typ `marketing_consent.accepted` -> `400 Bad Request`
- konflikt e-mail / użytkownika -> `409 Conflict` albo obecny błąd Supabase odwzorowany przez warstwę auth
- błąd triggera / insertu do `profiles` -> `500 Internal Server Error`

### Kontrakt błędu

Rekomendowany ustrukturyzowany format:

```json
{
  "code": "INVALID_MARKETING_CONSENT",
  "message": "Pole marketing_consent.text_version jest wymagane, gdy zgoda marketingowa została zaznaczona."
}
```

Przydatne kody domenowe:

- `INVALID_MARKETING_CONSENT`
- `UNSUPPORTED_MARKETING_CONSENT_VERSION`
- `SIGNUP_PROFILE_CREATION_FAILED`

### Rejestrowanie błędów

Na podstawie aktualnego stanu repo **brak dedykowanej tabeli błędów** dla tego procesu. Dla MVP rekomendowane podejście:

- błędy walidacyjne (`400`) nie są zapisywane do tabeli błędów,
- błędy biznesowe i techniczne są logowane w logach Supabase / aplikacji,
- logować należy:
  - poziom `warn` dla błędów walidacyjnych i konfliktów,
  - poziom `error` dla nieoczekiwanych błędów tworzenia profilu.

Jeżeli zespół będzie chciał w przyszłości trwały audyt błędów, należy zaprojektować osobną tabelę logów systemowych poza zakresem tego MVP.

## 8. Wydajność

- Zmiana jest lekka: dochodzą tylko 3 kolumny w `profiles` i prosta walidacja podczas signup.
- Najbardziej wydajny wariant MVP to zapis zgody **w tym samym kroku**, w którym tworzony jest profil, bez dodatkowego `update profiles` po rejestracji.
- Walidacja `text_version` powinna opierać się na małej allowliście w kodzie SQL lub stałej konfiguracyjnej, bez dodatkowego odczytu z osobnej tabeli.
- Nie należy wykonywać dodatkowych round-tripów z frontendu tylko po to, aby potwierdzić zapis zgody.

## 9. Kroki implementacji

1. **Rozszerzyć schemat bazy danych**:
   - dodać migrację rozszerzającą `public.profiles` o:
     - `marketing_consent boolean not null default false`
     - `marketing_consent_updated_at timestamptz null`
     - `marketing_consent_text_version text null`
   - dodać komentarze do nowych kolumn.
2. **Przebudować backendową logikę tworzenia profilu**:
   - zrefaktoryzować `handle_new_user()` tak, aby nie połykał błędów związanych z walidacją i zapisem zgody,
   - wydzielić helper SQL/PLpgSQL, np. `resolve_signup_marketing_consent(...)`,
   - walidować allowlistę wersji zgody w jednym miejscu.
3. **Ustalić stałą wersję zgody marketingowej**:
   - wprowadzić jawny identyfikator, np. `marketing-consent-pl-v1`,
   - używać tej samej wartości w UI i backendzie,
   - unikać hardcodowania tej wartości w wielu miejscach bez wspólnego źródła prawdy.
4. **Zaktualizować kontrakty współdzielone**:
   - przebudować `SignUpRequestDto` na kontrakt domenowy,
   - dodać `MarketingConsentSignupDto`,
   - dodać typ/enum dla `MarketingConsentTextVersion`.
5. **Dostosować `AuthService`**:
   - przyjmować nowy `SignUpRequestDto`,
   - mapować go do formatu `supabase.auth.signUp(...)`,
   - umieszczać `username` i pola zgody w `options.data`.
6. **Dostosować flow rejestracji**:
   - `RegisterPageComponent` powinien przekazać pełen obiekt zgody,
   - obecny redirect i `signOut()` pozostają bez zmian.
7. **Zaimplementować testy**:
   - testy jednostkowe mappera w `AuthService`,
   - testy jednostkowe/helpera SQL dla przypadków:
     - `accepted = false`, `text_version = null`
     - `accepted = true`, poprawne `text_version`
     - `accepted = true`, brak `text_version`
     - `accepted = false`, nie-null `text_version`
     - nieznana wersja zgody
   - test integracyjny signup potwierdzający zapis do `profiles`,
   - test regresyjny potwierdzający, że brak zgody nie blokuje rejestracji.
9. **Zaktualizować dokumentację**:
   - dopisać zmianę kontraktu `POST /auth/signup`,
   - opisać nowe kolumny `profiles`,
   - opisać aktualną wersję tekstu zgody oraz zasady jej rotacji.
