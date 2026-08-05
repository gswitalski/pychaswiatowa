# API Endpoints Implementation Plan: Google OAuth Login

## 1. Przegląd endpointów

Funkcjonalność logowania przez Google obejmuje zmiany na poziomie backendu (nowy endpoint) oraz frontendu (rozszerzenie istniejących komponentów i guardy). Supabase Auth obsługuje cały OAuth 2.0 Authorization Code Flow z PKCE — aplikacja kliencka wywołuje jedynie metody SDK i obsługuje callback.

### Punkty styku z API

| # | Typ | Operacja | Zmiana |
|---|---|---|---|
| 1 | Supabase SDK (klient) | `supabase.auth.signInWithOAuth({ provider: 'google' })` | Nowa metoda w `AuthService` |
| 2 | Frontend route | `GET /auth/callback` | Rozszerzenie istniejącej logiki callbacku |
| 3 | Edge Function | `GET /profile/username-available` | **Nowy endpoint** |
| 4 | Edge Function | `PATCH /profile` | Istniejący endpoint, nowy scenariusz użycia |
| 5 | Angular Guard | `AuthGuard` | Rozszerzenie o sprawdzenie `username` |
| 6 | Angular Component | `/auth/complete-profile` | **Nowy komponent i strona** |

---

## 2. Szczegóły żądania

### 2.1 Inicjalizacja OAuth (klient → Supabase)

Nie jest klasycznym endpointem HTTP — flow inicjowany przez Supabase JS SDK.

- **Wywołanie SDK:** `supabase.auth.signInWithOAuth`
- **Provider:** `'google'`
- **Parametry:**

| Parametr | Wartość | Opis |
|---|---|---|
| `provider` | `'google'` | Dostawca OAuth |
| `redirectTo` | `${window.location.origin}/auth/callback` | URL zwrotny po autoryzacji |
| `queryParams.access_type` | `'offline'` | Refresh token dla długotrwałych sesji |
| `queryParams.prompt` | `'select_account'` | Wymuś wybór konta Google (UX dla wielu kont) |

---

### 2.2 Callback OAuth (rozszerzenie)

- **Metoda HTTP:** `GET`
- **URL:** `/auth/callback` (Angular Router — frontend route)
- **Lokalizacja kodu:** `src/app/pages/auth/auth-callback/`
- **Parametry URL (od Supabase/Google):**

| Parametr | Wymagany | Opis |
|---|---|---|
| `code` | Tak (OAuth PKCE) | Kod autoryzacyjny do wymiany na sesję |
| `type` | Nie | `'email'` przy weryfikacji email; brak lub pusty przy OAuth |
| `error` | Nie | Kod błędu (np. `access_denied`) |
| `error_description` | Nie | Czytelny opis błędu |

---

### 2.3 Nowy endpoint: Sprawdzenie unikalności username

- **Metoda HTTP:** `GET`
- **URL:** `/profile/username-available`
- **Dostęp:** Publiczny (bez JWT) lub z JWT
- **Edge Function:** `supabase/functions/profile/`
- **Parametry zapytania:**

| Parametr | Typ | Wymagany | Walidacja |
|---|---|---|---|
| `username` | `string` | Tak | 3–50 znaków, `^\S+$` (brak białych znaków) |

- **Request Body:** brak

---

### 2.4 Zapis username po OAuth (istniejący endpoint)

- **Metoda HTTP:** `PATCH`
- **URL:** `/profile`
- **Dostęp:** JWT wymagany
- **Request Body:**

```json
{
    "username": "jan_kowalski"
}
```

---

## 3. Wykorzystywane typy

### Istniejące typy (z `shared/contracts/types.ts`)

```typescript
// Profil użytkownika
type Profile = Tables<'profiles'>;
type ProfileDto = Pick<Profile, 'id' | 'username'>;

// Aktualizacja profilu
type UpdateProfileCommand = Partial<Pick<Profile, 'username'>>;

// Dane sesji (bootstrap)
interface MeDto {
    id: string;
    username: string;
    app_role: AppRole;
}
```

### Nowy typ do dodania w `shared/contracts/types.ts`

```typescript
// #region --- Auth / OAuth ---

/**
 * Response DTO for GET /profile/username-available endpoint.
 * Returns whether the given username is available for registration.
 */
export interface UsernameAvailableResponseDto {
    /** True if the username is not yet taken by any user. */
    available: boolean;
}

// #endregion
```

---

## 4. Szczegóły odpowiedzi

### 4.1 `GET /profile/username-available`

**200 OK** — parametr poprawny (niezależnie od dostępności):

```json
{ "available": true }
```

lub:

```json
{ "available": false }
```

**400 Bad Request** — niepoprawny format parametru `username`:

```json
{
    "error": "VALIDATION_ERROR",
    "message": "Parametr 'username' musi mieć od 3 do 50 znaków i nie może zawierać spacji."
}
```

---

### 4.2 `PATCH /profile`

**200 OK** — username zapisany poprawnie:

```json
{
    "id": "7c8966c3-bc93-4bda-bcd1-bdcfd2af7b99",
    "username": "jan_kowalski",
    "created_at": "2026-08-05T16:00:00.000Z",
    "updated_at": "2026-08-05T16:05:00.000Z"
}
```

**400 Bad Request** — walidacja username nie przeszła:

```json
{
    "error": "VALIDATION_ERROR",
    "message": "Username musi mieć od 3 do 50 znaków."
}
```

**409 Conflict** — username już zajęty:

```json
{
    "error": "USERNAME_TAKEN",
    "message": "Ta nazwa użytkownika jest już zajęta. Wybierz inną."
}
```

**401 Unauthorized** — brak lub wygaśnięcie JWT:

```json
{
    "error": "UNAUTHORIZED",
    "message": "Wymagane uwierzytelnienie."
}
```

---

### 4.3 Callback OAuth — możliwe redirecty

| Warunek | Redirect |
|---|---|
| OAuth sukces + brak `username` | `/auth/complete-profile` |
| OAuth sukces + `username` istnieje | `/dashboard` |
| Weryfikacja email (istniejące) | `/email-confirmed` |
| `error=access_denied` | `/login?error=access_denied` |
| Inny błąd OAuth | `/login?error=oauth_error` |
| Timeout / brak połączenia | `/login?error=timeout` |

---

## 5. Przepływ danych

### 5.1 Ścieżka nowego użytkownika

```
[Użytkownik klika "Zaloguj się przez Google"]
    ↓
[AuthService.signInWithGoogle()]
    → supabase.auth.signInWithOAuth({ provider: 'google', redirectTo: '/auth/callback' })
    ↓
[Przeglądarka → Google OAuth / Account Picker]
    ↓
[Google → redirect na /auth/callback?code=...]
    ↓
[AuthCallbackComponent rozpoznaje brak parametru "type=email" → flow OAuth]
    → supabase.auth.exchangeCodeForSession(code)
    ↓
[Supabase tworzy nowego użytkownika w auth.users]
    → email_confirmed_at ustawiane automatycznie (konto Google = zweryfikowany e-mail)
    ↓
[Handler sprawdza profil przez SDK]
    → SELECT username FROM profiles WHERE id = session.user.id
    ↓
[Brak username → redirect /auth/complete-profile]
    ↓
[Użytkownik wypełnia username]
    → GET /profile/username-available?username=... (debounce 500ms)
    → PATCH /profile { "username": "..." }
    ↓
[Redirect /dashboard]
```

---

### 5.2 Ścieżka powracającego użytkownika

```
[Użytkownik klika "Zaloguj się przez Google"]
    ↓
[AuthService.signInWithGoogle() → Supabase → Google → /auth/callback]
    ↓
[AuthCallbackComponent → exchangeCodeForSession]
    ↓
[Sprawdzenie profilu → username istnieje]
    ↓
[Redirect /dashboard]
```

---

### 5.3 Ścieżka scalania kont (istniejące konto email+hasło)

```
[Użytkownik klika "Zaloguj się przez Google" tym samym emailem co istniejące konto]
    ↓
[Supabase automatycznie łączy tożsamości (Link Accounts musi być włączone w Dashboard)]
    ↓
[AuthCallbackComponent → username istnieje (konto miało już username)]
    ↓
[Redirect /dashboard — wszystkie dane zachowane]
```

---

### 5.4 Przepływ danych dla `GET /profile/username-available`

```
[Frontend → GET /profile/username-available?username=jan_kowalski]
    ↓
[profile/index.ts — routing]
    ↓
[profile.handlers.ts → handleGetUsernameAvailable]
    → Walidacja Zod: username (3-50 znaków, brak spacji) → 400 jeśli błąd
    ↓
[profile.service.ts → checkUsernameAvailable({ username })]
    → SELECT COUNT(*) FROM profiles WHERE lower(username) = lower($1)
    ↓
[Odpowiedź: { available: count === 0 }]
```

---

## 6. Względy bezpieczeństwa

### 6.1 Obsługa tokenów OAuth

- Tokeny OAuth (access_token, refresh_token Google) są obsługiwane **wyłącznie przez Supabase SDK** — kod aplikacji nigdy ich nie widzi.
- Aplikacja kliencka przechowuje tylko **sesję Supabase** (JWT) — identycznie jak przy logowaniu email+hasło.
- Supabase SDK automatycznie obsługuje PKCE (Proof Key for Code Exchange), chroniąc przed atakami CSRF na callback.

### 6.2 Walidacja `redirectTo`

- Parametr `redirectTo` musi wskazywać na origin aplikacji. Zarejestruj **wyłącznie** `{origin}/auth/callback` w:
  - Google Cloud Console → OAuth 2.0 → Authorized redirect URIs
  - Supabase Dashboard → Authentication → URL Configuration → Redirect URLs

### 6.3 Username enumeration

- Endpoint `GET /profile/username-available` ujawnia informację o zajętości nazwy.
- Jest to **akceptowalne** (standard branżowy — GitHub, Twitter, etc.) — nazwa użytkownika nie jest wrażliwą daną.
- Endpoint **nie zwraca** żadnych danych identyfikujących właściciela nazwy.

### 6.4 Guard ochrony tras

- `AuthGuard` po rozszerzeniu sprawdza dwa warunki:
  1. Czy sesja Supabase istnieje → jeśli nie: redirect `/login`
  2. Czy `profile.username` jest niepuste → jeśli nie: redirect `/auth/complete-profile`
- Trasa `/auth/complete-profile` chroniona osobnym guardem: wymaga sesji, **nie wymaga** `username` (inaczej pętla redirectów).

### 6.5 Rate limiting

- Supabase Auth wbudowany rate limiting na OAuth flow.
- Endpoint `GET /profile/username-available` można dodatkowo zabezpieczyć przez `X-RateLimit-*` headers lub throttle na poziomie Supabase API Gateway (opcjonalnie w MVP).

### 6.6 Domyślna rola

- Nowe konto OAuth automatycznie otrzymuje rolę `user` — identycznie jak rejestracja email+hasło.
- JWT claim `app_role` ustawiany przez trigger Supabase przy tworzeniu konta.

---

## 7. Obsługa błędów

| Scenariusz | Kod HTTP | Komunikat dla użytkownika | Akcja |
|---|---|---|---|
| Google zwraca `access_denied` | — | „Anulowano logowanie przez Google." | Redirect `/login?error=access_denied` |
| Błąd konfiguracji OAuth (np. zły Client ID) | 500 | „Wystąpił błąd techniczny. Spróbuj ponownie." | Log do konsoli, **nie ujawniaj** szczegółów |
| Timeout podczas callbacku | — | „Przekroczono czas oczekiwania. Spróbuj ponownie." | Redirect `/login?error=timeout` |
| `username` zajęty (`PATCH /profile`) | 409 | „Ta nazwa jest już zajęta. Wybierz inną." | Wyświetl błąd inline przy polu |
| `username` niepoprawny format | 400 | „Nazwa musi mieć 3–50 znaków i nie może zawierać spacji." | Wyświetl błąd inline przy polu |
| Brak JWT dla `PATCH /profile` | 401 | „Sesja wygasła. Zaloguj się ponownie." | Redirect `/login` |
| Błąd sieci przy sprawdzaniu dostępności | — | „Nie można sprawdzić dostępności nazwy." | Wyświetl ostrzeżenie inline, zezwól na submit |
| Profil nie istnieje po OAuth (race condition) | 404 | „Błąd podczas tworzenia profilu." | Log + redirect `/login?error=profile_error` |

---

## 8. Rozważania dotyczące wydajności

### 8.1 Sprawdzanie dostępności username

- Implementuj **debounce 500 ms** na polu username w formularzu `complete-profile` — unikaj zbędnych zapytań podczas pisania.
- Zapytanie `SELECT COUNT(*) FROM profiles WHERE lower(username) = lower($1)` jest objęte indeksem `(user_id, lower(name))` — jednak dla username potrzebny jest **dodatkowy indeks**: `CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON profiles (lower(username))`.

### 8.2 Buforowanie danych profilu

- `ProfileService` po pobraniu profilu przez `/me` lub Supabase SDK powinien buforować wynik w pamięci sesji (BehaviorSubject/Signal w serwisie).
- `AuthGuard` powinien używać buforowanego profilu — unikaj wielokrotnych zapytań do bazy przy każdej nawigacji.

### 8.3 OAuth redirect latency

- Flow OAuth wymaga 2–3 roundtripów (klient → Supabase → Google → callback). Nie ma optymalizacji po stronie aplikacji — zależy od Google i Supabase latency.
- Podczas wymiany kodu (`exchangeCodeForSession`) wyświetlaj loading spinner.

---

## 9. Etapy wdrożenia

### Backend — Edge Function (profile)

1. **Dodaj nowy typ `UsernameAvailableResponseDto`** do `shared/contracts/types.ts` (sekcja `Auth / OAuth`).

2. **Dodaj indeks bazodanowy** (migracja SQL):
    ```sql
    CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
    ON profiles (lower(username));
    ```

3. **Rozszerz `profile.service.ts`** — dodaj funkcję `checkUsernameAvailable`:
    ```typescript
    export async function checkUsernameAvailable(
        supabase: SupabaseClient,
        { username }: { username: string }
    ): Promise<UsernameAvailableResponseDto> {
        const { count, error } = await supabase
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .ilike('username', username);

        if (error) throw new ApplicationError(500, 'DB_ERROR', error.message);
        return { available: count === 0 };
    }
    ```

4. **Dodaj handler `handleGetUsernameAvailable`** w `profile.handlers.ts`:
    - Walidacja Zod: `z.string().min(3).max(50).regex(/^\S+$/, 'Brak spacji')` → 400 jeśli błąd
    - Wywołanie `checkUsernameAvailable` z serwisu
    - Zwrócenie `200 OK` z `UsernameAvailableResponseDto`

5. **Rozszerz router w `profile/index.ts`** o obsługę ścieżki `GET /profile/username-available`:
    ```typescript
    if (method === 'GET' && path === '/profile/username-available') {
        return handleGetUsernameAvailable(req, supabase);
    }
    ```

6. **Przetestuj endpoint lokalnie**:
    ```bash
    supabase functions serve profile
    curl "http://localhost:54331/functions/v1/profile/username-available?username=testuser"
    # Oczekiwana odpowiedź: { "available": true } lub { "available": false }
    curl "http://localhost:54331/functions/v1/profile/username-available?username=ab"
    # Oczekiwana odpowiedź: 400 Bad Request
    ```

---

### Frontend — AuthService

7. **Dodaj metodę `signInWithGoogle()`** do `src/app/core/services/auth.service.ts`:
    ```typescript
    async signInWithGoogle(): Promise<void> {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: `${window.location.origin}/auth/callback`,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account',
                },
            },
        });
        if (error) {
            console.error('[AuthService] signInWithGoogle error:', error);
            throw error;
        }
    }
    ```

---

### Frontend — AuthCallbackComponent

8. **Rozszerz handler** w `src/app/pages/auth/auth-callback/` o logikę rozróżnienia flow:

    ```typescript
    // Obecna logika (zachować):
    // type=email → flow weryfikacji email → redirect /email-confirmed

    // Nowa logika:
    // brak type (OAuth PKCE) → exchangeCodeForSession → sprawdź profil
    //   → brak username → redirect /auth/complete-profile
    //   → username istnieje → redirect /dashboard
    // error=access_denied → redirect /login?error=access_denied
    ```

    - Używaj `supabase.auth.getSession()` lub `onAuthStateChange` po `exchangeCodeForSession` do sprawdzenia `session.user.id`.
    - Sprawdzenie profilu: zapytanie przez Supabase SDK (nie nowy endpoint):
        ```typescript
        const { data: profile } = await this.supabase
            .from('profiles')
            .select('username')
            .eq('id', session.user.id)
            .single();
        ```
    - Wyświetlaj spinner podczas przetwarzania callbacku.

---

### Frontend — ProfileService

9. **Dodaj metodę `checkUsernameAvailable(username: string)`** w `src/app/core/services/profile.service.ts`:
    ```typescript
    checkUsernameAvailable(username: string): Observable<UsernameAvailableResponseDto> {
        return this.http.get<UsernameAvailableResponseDto>(
            `/profile/username-available`,
            { params: { username } }
        );
    }
    ```

---

### Frontend — CompleteProfileComponent

10. **Utwórz nowy komponent** `src/app/pages/auth/complete-profile/`:
    - Plik komponentu: `complete-profile.component.ts`
    - Formularz reaktywny z jednym polem `username` (wymagane, min 3, max 50, bez spacji)
    - Asynchroniczny walidator z debounce 500 ms wywołujący `ProfileService.checkUsernameAvailable()`
    - Przycisk „Zapisz i przejdź do aplikacji" — niedostępny (`disabled`) do momentu poprawnej walidacji
    - Po sukcesie `PATCH /profile`: redirect na `/dashboard`
    - Obsługa błędu 409 (username zajęty) — komunikat inline przy polu
    - Obsługa błędu 401 (wygaśnięcie sesji) — redirect `/login`

11. **Utwórz serwis formularza** `src/app/pages/auth/complete-profile/complete-profile.service.ts`:
    - Metoda `saveUsername(username: string): Observable<ProfileDto>` wywołująca `PATCH /profile`

---

### Frontend — AuthGuard

12. **Rozszerz `AuthGuard`** w `src/app/core/guards/auth.guard.ts`:

    ```
    Istniejąca logika:
      → brak sesji → redirect /login

    Nowe sprawdzenie (dodaj po weryfikacji sesji):
      → sesja istnieje, ale profile.username jest null/pusty
        → redirect /auth/complete-profile
      → sesja istnieje i profile.username nie jest pusty
        → kontynuuj (istniejące zachowanie)
    ```

    - Dane profilu pobieraj przez buforowany `ProfileService` (unikaj zapytania przy każdej nawigacji).
    - Trasa `/auth/complete-profile` musi być poza standardowym `AuthGuard` — stosuj dedykowany guard `OAuthProfileGuard` (wymaga sesji, nie wymaga username).

---

### Frontend — Routing

13. **Dodaj trasy** w `src/app/app.routes.ts`:
    ```typescript
    {
        path: 'auth/complete-profile',
        component: CompleteProfileComponent,
        canActivate: [OAuthProfileGuard], // wymaga sesji, NIE sprawdza username
    },
    ```

14. **Utwórz `OAuthProfileGuard`** w `src/app/core/guards/`:
    - Sprawdza tylko istnienie sesji Supabase.
    - Jeśli sesja istnieje **i** `username` jest uzupełniony → redirect `/dashboard` (użytkownik nie potrzebuje tego ekranu).
    - Jeśli brak sesji → redirect `/login`.

---

### Frontend — Widoki logowania i rejestracji

15. **Dodaj przycisk „Zaloguj się przez Google"** na ekranach `/login` i `/register`:
    - Umieść poniżej istniejącego formularza, oddzielony separatorem „lub".
    - Przycisk wywołuje `AuthService.signInWithGoogle()`.
    - W przypadku błędu z SDK wyświetlaj inline komunikat (np. „Logowanie przez Google jest chwilowo niedostępne.").
    - Użyj oficjalnego logo Google (`assets/icons/google-logo.svg`) zgodnie z Google Brand Guidelines.

---

### Testy

16. **Testy jednostkowe (Vitest)**:
    - `AuthService.signInWithGoogle()` — weryfikacja wywołania `signInWithOAuth` z poprawnymi parametrami (`provider: 'google'`, `redirectTo`, `queryParams`).
    - `AuthCallbackComponent` — symulacja callbacku OAuth z `code`: brak username → redirect `/auth/complete-profile`; username istnieje → redirect `/dashboard`.
    - `AuthCallbackComponent` — `error=access_denied` → redirect `/login?error=access_denied`.
    - `CompleteProfileComponent` — walidacja formularza: < 3 znaki → błąd; ze spacją → błąd; poprawne → brak błędu.
    - `AuthGuard` — zalogowany bez username → redirect `/auth/complete-profile`; zalogowany z username → `true`.
    - `GET /profile/username-available` — Edge Function: wolna nazwa → `{ available: true }`; zajęta → `{ available: false }`; < 3 znaki → 400.

