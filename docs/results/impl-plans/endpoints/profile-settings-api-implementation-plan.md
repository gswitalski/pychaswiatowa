# API Endpoints Implementation Plan: Profile Settings (`GET /profile`, `PUT /profile`, `POST /profile/change-password`)

## 1. Przegląd punktu końcowego

Celem zmiany jest domknięcie backendowego scope ustawień profilu dla widoku `/settings`, tak aby użytkownik mógł:

- odczytać adres e-mail jako pole tylko do odczytu,
- zaktualizować `username`,
- zaktualizować bieżący stan zgody marketingowej,
- bezpiecznie zmienić hasło po podaniu poprawnego starego hasła.

Zakres MVP obejmuje trzy endpointy:

1. `GET /profile` - pobranie pełnych danych do formularza ustawień.
2. `PUT /profile` - zapis edytowalnych danych profilu.
3. `POST /profile/change-password` - osobny, bezpieczny flow zmiany hasła.

Najważniejszy kontekst implementacyjny dla tego repo:

- istnieje już Edge Function `profile`, ale obsługuje obecnie tylko `GET /profile`,
- tabela `profiles` została już rozszerzona o:
  - `marketing_consent`,
  - `marketing_consent_updated_at`,
  - `marketing_consent_text_version`,
- istnieje już backendowa allowlista wersji zgody marketingowej dla flow signup,
- dane formularza ustawień pochodzą z dwóch źródeł:
  - `auth.users` / sesja Supabase - `email` i operacje na haśle,
  - `public.profiles` - `username` i pola zgody marketingowej.

Rekomendowana architektura MVP:

- pozostawić jeden moduł `supabase/functions/profile/`,
- rozszerzyć jego router o `PUT /profile` i `POST /profile/change-password`,
- utrzymać separację odpowiedzialności:
  - `index.ts` - wejście funkcji i CORS,
  - `profile.handlers.ts` - routing + walidacja requestów + format odpowiedzi,
  - `profile.service.ts` - odczyt i zapis danych profilu,
  - nowy serwis pomocniczy, np. `profile-auth.service.ts` lub wydzielone funkcje w `profile.service.ts`, dla weryfikacji starego hasła i zmiany hasła.

## 2. Szczegóły żądania

- **Auth**: wszystkie endpointy wymagają `Authorization: Bearer <token>`
- **Query params**: brak
- **Path params**: brak dla `GET /profile` i `PUT /profile`; dla `POST /profile/change-password` ścieżka zagnieżdżona bez dodatkowych parametrów

### 2.1 `GET /profile`

- **Metoda HTTP**: `GET`
- **Struktura URL**: `/profile`
- **Request body**: brak

#### Wymagane parametry

- poprawny JWT użytkownika

#### Parametry opcjonalne

- brak

### 2.2 `PUT /profile`

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/profile`

#### Docelowy request body

```json
{
  "username": "ania-k",
  "marketing_consent": false,
  "marketing_consent_text_version": "marketing-consent-pl-v1"
}
```

#### Wymagane parametry

- `username: string`
- `marketing_consent: boolean`
- `marketing_consent_text_version: string | null`

#### Parametry opcjonalne

- brak w MVP; endpoint przyjmuje pełny snapshot pól edytowalnych formularza

#### Walidacja wejścia

- `username`:
  - trim przed walidacją i zapisem,
  - długość `3-50` znaków,
  - nie może być pusty po trim,
  - konflikt unikalności obsłużyć jako `409 Conflict`, jeśli constraint istnieje lub zostanie dodany,
- `marketing_consent`:
  - obowiązkowy boolean,
- `marketing_consent_text_version`:
  - dla MVP rekomendowane jako pole wymagane przy zapisie formularza ustawień, nawet gdy zgoda jest wycofywana,
  - musi należeć do wspieranej allowlisty,
  - źródłem prawdy powinna pozostać wspólna wersja tekstu zgody używana w signup (`marketing-consent-pl-v1`) i rozszerzalna w przyszłości,
- backend nie przyjmuje z klienta:
  - `email`,
  - `marketing_consent_updated_at`,
  - `id`.

#### Reguły persistencji

- przy każdej zmianie stanu zgody backend aktualizuje:
  - `marketing_consent`,
  - `marketing_consent_updated_at = now()`,
  - `marketing_consent_text_version = wersja z requestu`,
- jeśli użytkownik zapisuje tylko zmianę `username`, pola zgody nie mogą zostać wyzerowane przez domyślne wartości,
- ponieważ endpoint używa `PUT`, formularz powinien wysyłać pełny stan pól edytowalnych, a backend powinien jawnie mapować tylko dozwolone kolumny.

### 2.3 `POST /profile/change-password`

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/profile/change-password`

#### Docelowy request body

```json
{
  "current_password": "OldSecret123!",
  "new_password": "NewSecret123!"
}
```

#### Wymagane parametry

- `current_password: string`
- `new_password: string`

#### Parametry opcjonalne

- brak

#### Walidacja wejścia

- `current_password`:
  - wymagane,
  - nie może być puste po trim,
- `new_password`:
  - wymagane,
  - musi spełniać obowiązującą politykę haseł aplikacji / Supabase,
  - rekomendowane odrzucenie wartości identycznej z `current_password` jako `400 Bad Request`,
- backend nie przyjmuje pola `confirm_password`; to walidacja wyłącznie po stronie UI,
- przed właściwą zmianą hasła backend musi zweryfikować poprawność `current_password`.

## 3. Wykorzystywane typy

### 3.1 Typy współdzielone (`shared/contracts/types.ts`)

Rekomendowane DTO i Command Modele:

- `ProfileSettingsDto`
- `UpdateProfileSettingsCommand`
- `ChangePasswordCommand`
- `ChangePasswordResponseDto`
- reuse istniejącego `MarketingConsentTextVersion` z `shared/contracts/marketing-consent.ts`

Proponowany kształt:

```ts
export interface ProfileSettingsDto {
    id: string;
    email: string;
    username: string;
    marketing_consent: boolean;
    marketing_consent_updated_at: string | null;
    marketing_consent_text_version: MarketingConsentTextVersion | null;
}

export interface UpdateProfileSettingsCommand {
    username: string;
    marketing_consent: boolean;
    marketing_consent_text_version: MarketingConsentTextVersion | null;
}

export interface ChangePasswordCommand {
    current_password: string;
    new_password: string;
}

export interface ChangePasswordResponseDto {
    status: 'ok';
    message: string;
}
```

### 3.2 Relacja do istniejących typów

- obecny `ProfileDto` jest zbyt ubogi dla `/settings`, bo zawiera tylko `id` i `username`,
- dla maintainability lepiej wprowadzić osobny `ProfileSettingsDto` zamiast przeciążać semantycznie minimalny `ProfileDto`,
- obecny `UpdateProfileCommand` powinien zostać zastąpiony albo rozszerzony do wariantu ustawień profilu, ale rekomendowane jest czytelniejsze, endpoint-specyficzne nazewnictwo.

### 3.3 Modele i funkcje warstwy service

Rekomendowane wydzielenie logiki:

- `getProfileSettings({ client, user })`
- `updateProfileSettings({ client, user, payload })`
- `verifyCurrentPassword({ email, currentPassword })`
- `changePassword({ userId, newPassword })`

To rozdziela dwa różne obszary:

- operacje na `profiles`,
- operacje na Supabase Auth.

### 3.4 Pomocnicze utility backendowe

W `_shared/supabase-client.ts` może być potrzebny helper do utworzenia izolowanego klienta auth bez utrwalania sesji, np.:

- `createEphemeralAnonClient()`

Jest to przydatne do bezpiecznej weryfikacji `current_password` bez naruszania bieżącej sesji użytkownika.

## 4. Szczegóły odpowiedzi

### 4.1 `GET /profile` - sukces `200 OK`

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

Reguły odpowiedzi:

- `email` zawsze pochodzi z warstwy auth, nigdy z `profiles`,
- jeśli pola marketingowe nie były jeszcze ustawiane po stronie profilu:
  - `marketing_consent = false`,
  - `marketing_consent_updated_at = null`,
  - `marketing_consent_text_version = null`.

### 4.2 `PUT /profile` - sukces `200 OK`

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

Reguły odpowiedzi:

- odpowiedź powinna zwracać pełny aktualny stan formularza, aby frontend mógł zsynchronizować local state bez dodatkowego `GET`,
- po zapisie nie należy zwracać żadnych pól wejściowych spoza kontraktu, zwłaszcza wrażliwych danych auth.

### 4.3 `POST /profile/change-password` - sukces `200 OK`

```json
{
  "status": "ok",
  "message": "Password updated successfully."
}
```

Reguły odpowiedzi:

- odpowiedź ma być prosta i niemieszająca warstw:
  - bez zwracania tokenów,
  - bez zwracania danych użytkownika,
  - bez ujawniania szczegółów mechanizmu reautoryzacji.

### 4.4 Kody statusu

- `200 OK`:
  - poprawny odczyt profilu,
  - poprawna aktualizacja profilu,
  - poprawna zmiana hasła,
- `400 Bad Request`:
  - niepoprawny payload,
  - niespełniona walidacja `username`,
  - niespełniona polityka hasła,
- `401 Unauthorized`:
  - brak lub niepoprawny JWT,
- `404 Not Found`:
  - brak rekordu `profiles` dla zalogowanego użytkownika,
- `409 Conflict`:
  - konflikt `username`, jeśli backend egzekwuje unikalność,
- `422 Unprocessable Entity`:
  - niespójna kombinacja pól zgody marketingowej,
  - niepoprawne `current_password`,
- `500 Internal Server Error`:
  - nieoczekiwany błąd bazy, auth lub samej funkcji.

## 5. Przepływ danych

### 5.1 `GET /profile`

1. `index.ts` przyjmuje request i deleguje do `profileRouter`.
2. `profileRouter` rozpoznaje ścieżkę bazową `/profile` i metodę `GET`.
3. Handler woła `getAuthenticatedContext(req)` w celu:
   - weryfikacji JWT,
   - pobrania obiektu `user`,
   - pobrania klienta z kontekstem użytkownika.
4. Serwis odczytuje rekord z `public.profiles` po `id = auth.uid()`.
5. Serwis agreguje odpowiedź:
   - `id` z auth / profilu,
   - `email` z `user.email`,
   - `username` i pola marketingowe z `profiles`.
6. Handler zwraca `200 OK`.

### 5.2 `PUT /profile`

1. Router rozpoznaje `PUT /profile`.
2. Handler parsuje JSON body i waliduje kontrakt Zod.
3. Serwis:
   - normalizuje `username`,
   - waliduje `marketing_consent_text_version`,
   - wyznacza docelowe pola do update,
   - wykonuje `update public.profiles ... where id = auth.uid()`.
4. Po update serwis pobiera finalny rekord i buduje `ProfileSettingsDto`.
5. Handler zwraca `200 OK`.

Rekomendacja implementacyjna:

- allowlistę wersji zgody marketingowej pobierać z jednego źródła prawdy:
  - albo przez współdzieloną stałą,
  - albo przez istniejącą funkcję SQL `supported_marketing_consent_text_versions()`.

### 5.3 `POST /profile/change-password`

1. Router najpierw sprawdza bardziej specyficzną ścieżkę `/profile/change-password`, zgodnie z zasadą "najpierw dłuższe ścieżki".
2. Handler waliduje JSON body.
3. Backend pobiera z auth aktualnego użytkownika i jego `email`.
4. Serwis weryfikuje `current_password` poprzez osobny, izolowany client auth:
   - bez używania danych z requestu do identyfikacji użytkownika,
   - bez nadpisywania aktywnej sesji bieżącego klienta.
5. Jeśli stare hasło jest poprawne, backend wykonuje właściwą zmianę hasła w Supabase Auth.
6. Handler zwraca `200 OK`.

Rekomendowany wariant techniczny:

- weryfikować `current_password` przez osobny klient `supabase.auth.signInWithPassword({ email, password: current_password })`,
- właściwą zmianę hasła wykonać kontrolowaną operacją backendową po sukcesie weryfikacji,
- nie opierać bezpieczeństwa na samym frontendzie ani na samym fakcie posiadania ważnej sesji.

## 6. Względy bezpieczeństwa

- **JWT obowiązkowo weryfikowany przez Supabase**:
  - bazować na `auth.getUser()`, nie na ręcznym dekodowaniu tokenu jako źródle prawdy,
- **RLS pozostaje podstawową warstwą ochrony danych profilu**:
  - endpoint aktualizuje wyłącznie rekord użytkownika z bieżącej sesji,
- **Rozdział źródeł danych**:
  - `email` wyłącznie z auth,
  - `username` i zgoda marketingowa wyłącznie z `profiles`,
- **Brak zaufania do klienta**:
  - backend ignoruje pola spoza kontraktu,
  - backend sam ustala `marketing_consent_updated_at`,
- **Weryfikacja starego hasła po stronie backendu**:
  - sama walidacja UI nie spełnia wymagań bezpieczeństwa,
- **Ochrona danych wrażliwych w logach**:
  - nigdy nie logować `current_password` ani `new_password`,
  - logować tylko identyfikator użytkownika, kod błędu i rezultat operacji,
- **Spójna allowlista wersji zgody**:
  - backend nie może akceptować dowolnego stringa jako `marketing_consent_text_version`,
- **Odporność na nadużycia**:
  - dla zmiany hasła warto rozważyć prosty rate limiting lub monitorowanie nieudanych prób w kolejnych iteracjach,
- **Sesja po zmianie hasła**:
  - implementacja nie powinna wylogowywać użytkownika na bieżącym urządzeniu, zgodnie z wymaganiem MVP.

## 7. Obsługa błędów

### 7.1 Scenariusze błędów

- brak tokenu lub token nieważny -> `401 Unauthorized`
- brak rekordu `profiles` -> `404 Not Found`
- `username` pusty po trim lub poza zakresem `3-50` -> `400 Bad Request`
- konflikt `username` -> `409 Conflict`
- brak `marketing_consent` lub zły typ -> `400 Bad Request`
- brak lub niewspierane `marketing_consent_text_version` -> `422 Unprocessable Entity`
- brak `current_password` albo `new_password` -> `400 Bad Request`
- `new_password` nie spełnia polityki haseł -> `400 Bad Request`
- niepoprawne `current_password` -> `422 Unprocessable Entity`
- nieoczekiwany błąd bazy lub auth -> `500 Internal Server Error`

### 7.2 Rekomendowany kontrakt błędu

```json
{
  "code": "UNPROCESSABLE_ENTITY",
  "message": "Podane stare hasło jest niepoprawne."
}
```

Przydatne komunikaty domenowe:

- `Profile not found`
- `Username must contain between 3 and 50 characters`
- `Unsupported marketing consent text version`
- `Current password is invalid`
- `New password does not meet security requirements`

### 7.3 Rejestrowanie błędów

Na podstawie dostępnego kontekstu **brak dedykowanej tabeli błędów** dla tego obszaru. Dla MVP rekomendowane podejście:

- błędy walidacyjne i błędne hasło:
  - logować jako `warn`,
  - bez zapisu do osobnej tabeli,
- błędy techniczne bazy lub auth:
  - logować jako `error`,
  - z `userId`, nazwą endpointu i kodem błędu,
- nie przechowywać w logach żadnych haseł ani pełnych payloadów zawierających dane wrażliwe.

Jeśli zespół będzie potrzebował trwałego audytu błędów, należy zaprojektować osobny mechanizm logów systemowych poza zakresem tego MVP.

## 8. Rozważania dotyczące wydajności

- `GET /profile` jest lekkim odczytem pojedynczego rekordu `profiles` i danych z sesji auth; nie wymaga osobnych joinów.
- `PUT /profile` aktualizuje jeden rekord po kluczu głównym, więc koszt operacji jest niski.
- Najlepiej po udanym `PUT /profile` zwrócić pełny finalny stan formularza, aby uniknąć dodatkowego requestu `GET`.
- Walidacja wersji zgody powinna opierać się na małej allowliście, bez odpytywania dodatkowych tabel konfiguracyjnych.
- `POST /profile/change-password` siłą rzeczy wymaga dodatkowego kroku weryfikacji starego hasła; to akceptowalny koszt, bo operacja jest rzadka i bezpieczeństwo ma tu wyższy priorytet niż minimalizacja liczby wywołań.
- Nie należy budować tego flow jako dwóch osobnych endpointów frontendowych, bo zwiększyłoby to liczbę round-tripów i złożoność UX.

## 9. Kroki implementacji

1. **Doprecyzować kontrakty współdzielone**:
   - dodać `ProfileSettingsDto`,
   - dodać `UpdateProfileSettingsCommand`,
   - dodać `ChangePasswordCommand`,
   - dodać `ChangePasswordResponseDto`,
   - ponownie wykorzystać `MarketingConsentTextVersion`.
2. **Rozszerzyć router funkcji `profile`**:
   - dodać obsługę `PUT /profile`,
   - dodać obsługę `POST /profile/change-password`,
   - sprawdzać najpierw bardziej specyficzną ścieżkę `/change-password`.
3. **Rozbudować warstwę service dla odczytu ustawień**:
   - pobierać rekord z `profiles`,
   - agregować `email` z `auth user`,
   - zwracać pełny `ProfileSettingsDto`.
4. **Zaimplementować aktualizację danych profilu**:
   - dodać walidację Zod dla `PUT /profile`,
   - zmapować tylko dozwolone pola,
   - aktualizować `marketing_consent_updated_at` wyłącznie na backendzie,
   - zwracać finalny stan po zapisie.
5. **Zaimplementować bezpieczną zmianę hasła**:
   - dodać walidację Zod dla `POST /profile/change-password`,
   - pobrać `email` aktualnego użytkownika z auth,
   - zweryfikować `current_password` na izolowanym kliencie auth,
   - wykonać właściwą zmianę hasła kontrolowaną operacją backendową,
   - zwrócić prostą odpowiedź sukcesu bez tokenów.
6. **Uzupełnić helpery współdzielone**:
   - jeśli potrzeba, dodać w `_shared/supabase-client.ts` helper do izolowanego klienta anon/service role,
   - zadbać, aby helper nie utrwalał sesji i nie nadpisywał bieżącego kontekstu użytkownika.
7. **Ujednolicić walidację wersji zgody marketingowej**:
   - używać tego samego źródła prawdy co dla signup,
   - nie hardcodować wielu niezależnych list wspieranych wersji.
8. **Zaktualizować frontendowy klient API**:
   - dodać serwis/metody dla:
     - pobrania ustawień profilu,
     - zapisu ustawień profilu,
     - zmiany hasła,
   - dopasować typy formularza `/settings` do nowych DTO.
9. **Dodać testy**:
   - jednostkowe dla walidacji payloadów,
   - jednostkowe dla serwisów:
     - odczytu profilu,
     - aktualizacji zgody marketingowej,
     - weryfikacji starego hasła,
   - integracyjne dla:
     - `GET /profile`,
     - `PUT /profile`,
     - `POST /profile/change-password`,
   - test regresyjny potwierdzający, że po zmianie hasła bieżąca sesja pozostaje aktywna.
10. **Zaktualizować dokumentację**:
   - dopisać rozszerzony kontrakt `GET /profile`,
   - dopisać rozszerzony kontrakt `PUT /profile`,
   - dodać nowy endpoint `POST /profile/change-password`,
   - opisać statusy błędów i zasady walidacji.
