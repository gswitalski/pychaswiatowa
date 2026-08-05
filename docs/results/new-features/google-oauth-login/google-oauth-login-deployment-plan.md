# Logowanie przez Google — plan wdrożeniowy

## 1. Przegląd

Uruchomienie logowania przez Google wymaga skonfigurowania trzech zewnętrznych zasobów przed wdrożeniem kodu:

1. **Google Cloud Console** — projekt OAuth 2.0, Client ID i Client Secret.
2. **Supabase Dashboard** — włączenie dostawcy Google w Auth, podanie kluczy.
3. **Zmienne środowiskowe aplikacji** — brak dodatkowych zmiennych po stronie Angular (klucze trafiają do Supabase, nie do klienta).

Poniższy plan opisuje każdy krok konfiguracyjny wraz z informacją, kto powinien go wykonać i gdzie zapisać wrażliwe dane.

---

## 2. Krok 1 — Google Cloud Console: konfiguracja projektu OAuth

### 2.1 Utworzenie projektu (jeśli jeszcze nie istnieje)

1. Przejdź na [console.cloud.google.com](https://console.cloud.google.com).
2. Wybierz lub utwórz projekt przypisany do domeny PychaŚwiatowa.
3. W menu bocznym przejdź do **APIs & Services → OAuth consent screen**.

### 2.2 Konfiguracja ekranu zgody OAuth

| Pole | Wartość |
|---|---|
| User type | **External** (dla użytkowników spoza organizacji Google Workspace) |
| App name | `PychaŚwiatowa` |
| User support email | adres e-mail administratora projektu |
| App logo | opcjonalnie — logo aplikacji (maks. 1 MB, kwadratowe) |
| App domain — Application home page | `https://pychaswiatowa.pl` (produkcja) |
| App domain — Privacy policy link | `https://pychaswiatowa.pl/legal/privacy` |
| App domain — Terms of service link | `https://pychaswiatowa.pl/legal/terms` |
| Authorized domains | `pychaswiatowa.pl` oraz domain Supabase projektu (np. `xxx.supabase.co`) |
| Developer contact email | adres e-mail administratora projektu |

> **Scopy:** Wystarczą domyślne (`openid`, `email`, `profile`). Nie dodawaj dodatkowych zakresów — Supabase prosi o nie automatycznie.

### 2.3 Utworzenie danych uwierzytelniających OAuth 2.0

1. Przejdź do **APIs & Services → Credentials**.
2. Kliknij **+ CREATE CREDENTIALS → OAuth client ID**.
3. Wybierz typ: **Web application**.
4. Podaj nazwę np. `PychaŚwiatowa Web`.
5. W sekcji **Authorized JavaScript origins** dodaj:
    - `http://localhost:4200` (development)
    - `https://pychaswiatowa.pl` (produkcja)
6. W sekcji **Authorized redirect URIs** dodaj:
    - `http://localhost:54321/auth/v1/callback` (Supabase CLI lokalnie)
    - `https://<SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback` (Supabase cloud dev/staging)
    - `https://<SUPABASE_PROJECT_REF_PROD>.supabase.co/auth/v1/callback` (Supabase cloud produkcja)

    > **Ważne:** URI przekierowania muszą wskazywać na endpoint Supabase, **nie** na domenę Angular. Supabase po autoryzacji przekieruje z kolei na `{origin}/auth/callback` aplikacji.

7. Kliknij **Create**.
8. Skopiuj i zapisz w bezpiecznym miejscu:
    - **Client ID** (format: `XXXXXXX.apps.googleusercontent.com`)
    - **Client Secret**

### 2.4 Środowiska — osobne Client ID dla każdego środowiska

Zalecane jest utworzenie **osobnych par Client ID / Client Secret** dla każdego środowiska (dev, staging, produkcja), aby uniknąć wycieków kluczy produkcyjnych podczas testów.

| Środowisko | Nazwa klienta OAuth | Redirect URI Supabase |
|---|---|---|
| Lokalne (CLI) | `PychaŚwiatowa Local` | `http://localhost:54321/auth/v1/callback` |
| Dev / Staging | `PychaŚwiatowa Dev` | `https://<dev-ref>.supabase.co/auth/v1/callback` |
| Produkcja | `PychaŚwiatowa Prod` | `https://<prod-ref>.supabase.co/auth/v1/callback` |

---

## 3. Krok 2 — Supabase Dashboard: włączenie dostawcy Google

### 3.1 Konfiguracja w Supabase Cloud

1. Przejdź do [app.supabase.com](https://app.supabase.com) i wybierz projekt.
2. W lewym menu wybierz **Authentication → Providers**.
3. Znajdź dostawcę **Google** i kliknij, aby go rozwinąć.
4. Włącz przełącznik **Enable Sign in with Google**.
5. Wklej wartości uzyskane z Google Cloud Console:
    - **Client ID (for OAuth)**
    - **Client Secret**
6. Upewnij się, że pole **Callback URL (for OAuth)** zawiera adres Supabase, który wpisałeś w Google Cloud Console.
7. Kliknij **Save**.

### 3.2 Włączenie łączenia tożsamości (link identity)

W panelu Supabase: **Authentication → Configuration → Auth Providers settings**:

- Włącz opcję **Allow users to link multiple OAuth providers to the same account** (lub zbliżona nazwa w aktualnej wersji dashboardu Supabase).

> Bez tej opcji próba logowania przez Google z e-mailem istniejącym w bazie zakończy się błędem zamiast scaleniem kont.

### 3.3 Konfiguracja lokalna (Supabase CLI)

Dla środowiska lokalnego, plik `supabase/config.toml` (lub `supabase/.env.local`):

```toml
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_GOOGLE_SECRET)"
redirect_uri = "http://localhost:54321/auth/v1/callback"
```

Wartości zmiennych środowiskowych przechowuj w pliku `.env.local` (nigdy nie commituj tego pliku do repozytorium):

```
SUPABASE_AUTH_GOOGLE_CLIENT_ID=<twój-client-id>.apps.googleusercontent.com
SUPABASE_AUTH_GOOGLE_SECRET=<twój-client-secret>
```

---

## 4. Krok 3 — Zmienne środowiskowe aplikacji Angular

Aplikacja kliencka (Angular) **nie potrzebuje** Client ID ani Client Secret Google — klucze trafiają wyłącznie do Supabase. Klient korzysta z Supabase JS SDK, który sam obsługuje OAuth.

Żadne nowe zmienne środowiskowe nie są wymagane po stronie Angular (`src/environments/`).

---

## 5. Krok 4 — Konfiguracja URL przekierowania w Angular

Upewnij się, że trasa `/auth/callback` jest zarejestrowana w Angular Routerze i nie jest chroniona przez `AuthGuard` (callback musi być dostępny bez sesji):

```
/auth/callback  →  AuthCallbackComponent  (bez AuthGuard)
/auth/complete-profile  →  CompleteProfileComponent  (z guardem: sesja wymagana, username NIE wymagany)
```

Adres `redirectTo` przekazywany do `signInWithOAuth` w kodzie Angular musi być tożsamy z adresem wpisanym w **Authorized redirect URIs** Google Cloud Console (po stronie Supabase, nie bezpośrednio Angular).

---

## 6. Krok 5 — Weryfikacja i testy wdrożenia

Po zakończeniu konfiguracji należy przeprowadzić poniższe testy manualne przed wdrożeniem na produkcję:

| Test | Oczekiwany wynik |
|---|---|
| Kliknięcie „Zaloguj się przez Google" na dev | Otwiera stronę wyboru konta Google |
| Nowe konto → autoryzacja Google | Redirect na `/auth/complete-profile` |
| Uzupełnienie username | Redirect na `/dashboard`, dane profilu zapisane |
| Powracający użytkownik | Redirect bezpośrednio na `/dashboard` |
| Scalanie kont (ten sam email co email+hasło) | Dostęp do istniejącego konta, brak duplikatu |
| Anulowanie na stronie Google | Powrót na `/login`, brak błędu |
| Błąd konfiguracji (błędny Client ID) | Strona Google pokazuje błąd, aplikacja obsługuje redirect z `error=` |

---

## 7. Krok 6 — Publikacja aplikacji OAuth (Google Cloud Console)

Na środowisku deweloperskim / testowym ekran zgody Google będzie w statusie **Testing** — działa tylko dla zaufanych testerów dodanych w konsoli Google.

Przed wdrożeniem na produkcję należy:

1. W Google Cloud Console przejść do **OAuth consent screen**.
2. Kliknąć **Publish App** (status zmieni się z _Testing_ na _In production_).
3. Jeśli aplikacja prosi o zakresy wrażliwe (nie dotyczy naszego przypadku — używamy tylko `openid`, `email`, `profile`), Google może wymagać przeglądu aplikacji (Google verification). Dla standardowych zakresów weryfikacja **nie jest wymagana**.

---

## 8. Bezpieczeństwo — podsumowanie

| Element | Działanie |
|---|---|
| Client Secret | Przechowywany wyłącznie w Supabase Dashboard i `.env.local` (nigdy w kodzie ani repozytorium). |
| Client ID | Może być publiczny (używany przez przeglądarkę), ale nie powinien być commitowany wprost — odczytywany przez Supabase, nie przez Angular. |
| Tokeny Google | Nie są przechowywane po stronie aplikacji; Angular przechowuje wyłącznie sesję Supabase (JWT). |
| RLS | Bez zmian — tabela `profiles` jest nadal chroniona RLS (`auth.uid() = id`). |
| `.env.local` | Dodany do `.gitignore` — nie commitować do repozytorium. |

---

## 9. Lista kontrolna wdrożenia

- [ ] Projekt w Google Cloud Console utworzony lub wybrany
- [ ] Ekran zgody OAuth skonfigurowany (nazwa, logo, linki prawne, domeny)
- [ ] Dane uwierzytelniające OAuth 2.0 (Client ID + Secret) wygenerowane dla każdego środowiska
- [ ] Redirect URIs Supabase dodane w Google Cloud Console
- [ ] Dostawca Google włączony w Supabase Dashboard z wklejonymi kluczami
- [ ] Opcja "Link accounts" włączona w Supabase Auth
- [ ] Plik `supabase/config.toml` zaktualizowany dla środowiska lokalnego
- [ ] Plik `.env.local` stworzony z kluczami (nie commitowany)
- [ ] Trasa `/auth/callback` dostępna bez AuthGuard w Angular
- [ ] Trasa `/auth/complete-profile` dodana z dedykowanym guardem
- [ ] Testy manualne przeprowadzone na środowisku dev
- [ ] Aplikacja Google OAuth opublikowana (status _In production_) przed wdrożeniem produkcyjnym
