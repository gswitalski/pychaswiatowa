# Plan implementacji widoku Logowanie przez Google (OAuth)

## 1. Przegląd

Funkcjonalność dodaje alternatywną metodę uwierzytelniania — logowanie/rejestrację przez konto Google (OAuth 2.0 Authorization Code Flow z PKCE, obsługiwane w całości przez Supabase Auth). Zmiana dotyczy trzech widoków:

- **`/login`** (zmiana) — dodanie przycisku „Zaloguj się przez Google" pod istniejącym formularzem email+hasło.
- **`/register`** (zmiana) — dodanie przycisku „Zarejestruj się przez Google" w analogicznym miejscu.
- **`/auth/complete-profile`** (nowy widok) — ekran uzupełnienia `username` wyświetlany wyłącznie użytkownikom, którzy zalogowali się przez Google po raz pierwszy i nie mają jeszcze nazwy użytkownika w `profiles`.

Dodatkowo rozszerzeniu ulega istniejący handler `/auth/callback`, który musi rozróżnić flow weryfikacji e-mail (istniejące zachowanie) od nowego flow OAuth, oraz mechanizm ochrony tras prywatnych, tak aby użytkownik z niepełnym profilem (`username` puste) nie mógł wejść na strony wymagające pełnego profilu, dopóki go nie uzupełni.

Cały ficzer realizuje historyjki: US-OAUTH-001 do US-OAUTH-005.

## 2. Routing widoku

| Ścieżka | Grupa layoutu | Zmiana | Guard |
|---|---|---|---|
| `/login` | `PublicLayoutComponent` (goście) i `MainLayoutComponent` (zalogowani — przypadek brzegowy) | Zmieniony (nowy przycisk OAuth + obsługa `?error=`) | bez zmian |
| `/register` | j.w. | Zmieniony (nowy przycisk OAuth) | bez zmian |
| `/auth/callback` | j.w. | Zmieniony (rozszerzona logika) | bez zmian |
| `/auth/complete-profile` | **Nowa trasa**, wyłącznie w grupie `MainLayoutComponent` (`authenticatedMatchGuard`) | Nowy widok | `oauthCompleteProfileGuard` (`canActivate`) |
| `/auth/complete-profile` (stub w grupie gości) | `PublicLayoutComponent` | Nowy wpis — `redirectTo: '/login'`, `pathMatch: 'full'` (analogicznie do istniejących stubów `/dashboard`, `/shopping`, `/admin`) | — |

**Uzasadnienie umiejscowienia `/auth/complete-profile` tylko w grupie zalogowanych:** wymiana kodu PKCE (`exchangeCodeForSession`) następuje wewnątrz `AuthCallbackPageComponent` (już po dopasowaniu trasy `/auth/callback`). Dopiero po utworzeniu sesji komponent wykonuje `router.navigate(['/auth/complete-profile'])`, co wywołuje ponowną ewaluację `canMatch` na poziomie grup najwyższego rzędu — w tym momencie sesja już istnieje, więc `authenticatedMatchGuard` zwróci `true`, a `guestOnlyMatchGuard` — `false`. Stąd trasa docelowa musi być zarejestrowana w grupie `MainLayoutComponent`. Wpis-stub w grupie gości zabezpiecza scenariusz bezpośredniego wejścia na URL bez żadnej sesji (US-OAUTH-004, kryterium 1).

Dodatkowo, aby spełnić regułę biznesową „Zakaz pominięcia profilu", trasy prywatne wymagające pełnego profilu otrzymują dodatkowy `canMatch`:

`/dashboard`, `/my-recipies` (+alias `/my-recipes`), `/recipes/**`, `/collections/**`, `/shopping`, `/settings`, `/admin/**` → doklejony `usernameCompleteMatchGuard` do istniejącej tablicy `canMatch` (dla `/admin/**` obok `adminRoleMatchGuard`).

Trasy niewymagające pełnego profilu (pozostają bez zmian): `/`, `/explore`, `/explore/recipes/:id-:slug`, `/legal/*`, `/login`, `/register`, `/register/verify-sent`, `/auth/callback`, `/email-confirmed`, `/email-confirmation-invalid`, `/forbidden`.

## 3. Struktura komponentów

```
LoginPageComponent (zmieniony)
└─ LoginFormComponent (zmieniony)
   └─ OauthGoogleButtonComponent (NOWY, shared)

RegisterPageComponent (zmieniony)
└─ RegisterFormComponent (zmieniony)
   └─ OauthGoogleButtonComponent (NOWY, shared — reużyty)

AuthCallbackPageComponent (zmieniony — logika wewnętrzna, bez zmian szablonu)

CompleteProfilePageComponent (NOWY, kontener)
└─ CompleteProfileFormComponent (NOWY, prezentacyjny)
```

`OauthGoogleButtonComponent` trafia do `src/app/shared/components/`, ponieważ jest reużywany na dwóch niezależnych stronach (zgodnie ze strukturą katalogów z reguł projektu — komponenty współdzielone między funkcjonalnościami żyją w `shared/components`).

## 4. Szczegóły komponentów

### `OauthGoogleButtonComponent` (nowy, `src/app/shared/components/oauth-google-button/`)

- **Opis:** Czysto prezentacyjny, reużywalny komponent renderujący separator „lub" oraz przycisk logowania/rejestracji przez Google (`mat-stroked-button`, pełna szerokość, logo Google + tekst, stan ładowania ze spinnerem). Nie zna szczegółów implementacji OAuth — jedynie emituje zdarzenie kliknięcia.
- **Główne elementy:** `<div class="divider">` z tekstem „lub" (`aria-hidden="true"`), `<button mat-stroked-button>` z `<img src="icons/google-logo.svg" alt="Google" aria-hidden="true">` + tekst z `@Input label`, `<mat-spinner diameter="20">` widoczny zamiast tekstu podczas `isLoading`.
- **Obsługiwane zdarzenia:** `click` na przycisku → emituje `clicked` (bez payloadu), tylko gdy `!isLoading`.
- **Warunki walidacji:** brak (komponent bezstanowy, walidacja nie dotyczy).
- **Typy:** brak nowych DTO — czysto prezentacyjne propsy.
- **Propsy (Inputs/Outputs):**
  - `@Input() label: string` (wymagane, np. `"Zaloguj się przez Google"` / `"Zarejestruj się przez Google"`)
  - `@Input() isLoading = false`
  - `@Input() ariaLabel?: string` (fallback: wartość `label`)
  - `@Output() clicked = new EventEmitter<void>()`

### `LoginFormComponent` (zmieniony, `src/app/pages/login/components/login-form/`)

- **Opis:** Istniejący formularz email+hasło rozszerzony o sekcję OAuth wyrenderowaną **wewnątrz tej samej `<mat-card-content>`**, poniżej przycisku „Zaloguj się" i przed `<mat-card-actions>` z linkiem do rejestracji (dokładnie wg lokalizacji z planu UI).
- **Główne elementy:** istniejący `<form>` bez zmian + nowy blok `@if (apiError) {...}` z komunikatem błędu OAuth (rozróżnialny stylistycznie od błędu logowania hasłem, np. osobna klasa `oauth-error`) + `<pych-oauth-google-button>`.
- **Obsługiwane zdarzenia:** istniejące (`submitForm`, `handleResend`) + nowe: `(clicked)` z `OauthGoogleButtonComponent` → wywołuje `loginWithGoogle.emit()`.
- **Warunki walidacji:** bez zmian (email/hasło). Przycisk Google nie ma własnej walidacji — jest zawsze klikalny, chyba że trwa ładowanie.
- **Typy:** bez zmian w typach DTO; nowy lokalny typ nie jest wymagany.
- **Propsy:**
  - Istniejące: `isLoading`, `apiError`, `requiresEmailConfirmation`, `resendCooldownSeconds`, `isResending`, `login`, `resendVerification`.
  - Nowe: `@Input() isGoogleLoading = false`, `@Input() oauthErrorMessage: string | null = null`, `@Output() loginWithGoogle = new EventEmitter<void>()`.

### `LoginPageComponent` (zmieniony, `src/app/pages/login/`)

- **Opis:** Kontener strony logowania. Rozszerzony o: (1) odczyt parametru `?error=` z URL przy inicjalizacji i zmapowanie go na przyjazny komunikat, (2) metodę inicjującą OAuth, (3) stan ładowania niezależny od stanu formularza email+hasło (zgodnie z wymaganiem „formularz i przycisk Google nie blokują się wzajemnie").
- **Główne elementy:** `<pych-login-form>` z rozszerzonym zestawem bindingów.
- **Obsługiwane zdarzenia:** nowe — `(loginWithGoogle)="handleGoogleLogin()"`.
- **Warunki walidacji:** brak nowej walidacji formularza; walidowany jest jedynie parametr `error` z URL (whitelist rozpoznawanych kodów, patrz sekcja 9).
- **Typy:** rozszerzony lokalny interfejs stanu `LoginState` o pola `isGoogleLoading: boolean` i `oauthErrorMessage: string | null`.
- **Propsy:** brak (komponent routowalny, bez `@Input`).

### `RegisterFormComponent` / `RegisterPageComponent` (zmienione, `src/app/pages/register/`)

- **Opis i zmiany:** analogiczne do `LoginFormComponent` / `LoginPageComponent`, z etykietą przycisku „Zarejestruj się przez Google" i bez obsługi `requiresEmailConfirmation` (nie dotyczy rejestracji). `RegisterPageComponent` również odczytuje `?error=` z URL (użytkownik może zostać przekierowany na `/register`? — nie: zgodnie z planem API błędy OAuth zawsze trafiają na `/login?error=...`, więc `RegisterPageComponent` **nie** musi obsługiwać parametru `error`, jedynie stan `isGoogleLoading`).
- **Nowe propsy `RegisterFormComponent`:** `@Input() isGoogleLoading = false`, `@Output() registerWithGoogle = new EventEmitter<void>()`.
- **Warunki walidacji:** bez zmian (istniejąca walidacja email/hasło/zgodność haseł).

### `AuthCallbackPageComponent` (zmieniony, `src/app/pages/auth/auth-callback/`)

- **Opis:** Techniczny handler bez zmian wizualnych (ten sam spinner na `mat-card`), ale ze znacząco rozszerzoną logiką w `processCallback()`, rozróżniającą flow weryfikacji e-mail od flow OAuth na podstawie parametru URL `type`.
- **Nowa logika (pseudokod):**
  ```
  type = queryParam('type')                 // 'email' | null
  errorCode = queryParam('error_code') ?? queryParam('error')
  errorDescription = queryParam('error_description')
  code = queryParam('code')

  JEŚLI type === 'email':
      // ISTNIEJĄCE zachowanie — bez zmian
      errorCode/errorDescription → redirect /email-confirmation-invalid
      code → exchangeCodeForSession → signOut() → redirect /email-confirmed
      brak code, sesja istnieje → signOut() → redirect /email-confirmed
      w przeciwnym razie → redirect /email-confirmation-invalid

  W PRZECIWNYM RAZIE (flow OAuth):
      errorCode === 'access_denied' → redirect /login?error=access_denied
      errorCode lub errorDescription (inny błąd) → redirect /login?error=oauth_error
      code → exchangeCodeForSession(code)
          sukces → handleOAuthSuccess()
          błąd → redirect /login?error=oauth_error
      brak code:
          sesja istnieje → handleOAuthSuccess()
          brak sesji → redirect /login?error=oauth_error

  handleOAuthSuccess():
      TRY: profile = await firstValueFrom(profileSettingsApi.getProfileSettings())  // GET /profile
           JEŚLI profile.username jest puste → router.navigate(['/auth/complete-profile'])
           W PRZECIWNYM RAZIE → router.navigate(['/dashboard'])
      CATCH: → redirect /login?error=profile_error
  ```
- **Ważne — zgodność z regułami frontendu:** dokumenty referencyjne (`google-oauth-login-api-plan.md`, plan implementacji endpointu) sugerują sprawdzenie profilu przez bezpośrednie zapytanie `supabase.from('profiles').select('username')`. **Jest to niezgodne z regułą projektu** zabraniającą bezpośrednich zapytań do tabel z frontendu. Zamiast tego handler musi wołać istniejący **`GET /profile`** (Edge Function, już zaimplementowany, zwraca `ProfileSettingsDto` z polem `username: ''` gdy brak nazwy) przez `ProfileSettingsApiService.getProfileSettings()`. To jedyne miejsce, w którym plan odbiega świadomie od dokumentów referencyjnych — z uzasadnieniem zgodności z regułami repo.
- **Obsługiwane zdarzenia:** `ngOnInit` (bez zmian sygnatury).
- **Warunki walidacji:** rozpoznawanie `type`, `error`/`error_code`, obecność `code` — jak wyżej.
- **Typy:** korzysta z `ProfileSettingsDto` (istniejący).
- **Propsy:** brak (komponent routowalny).

### `CompleteProfilePageComponent` (nowy, `src/app/pages/auth/complete-profile/`)

- **Opis:** Kontener strony uzupełnienia profilu. Przy inicjalizacji pobiera e-mail zalogowanego użytkownika (`supabase.auth.getUser()` — dozwolone operacją auth) do wyświetlenia w chipie potwierdzającym tożsamość oraz sprawdza, czy profil faktycznie wymaga uzupełnienia (dodatkowe zabezpieczenie, niezależne od guarda). Obsługuje zapisanie `username` przez wywołanie `PUT /profile` i przekierowanie na `/dashboard`.
- **Główne elementy:** wyśrodkowany `<mat-card>` (analogicznie do `/login`, max-width 480px) zawierający: logo aplikacji, `<mat-card-title>` „Uzupełnij profil", tekst pomocniczy, opcjonalny `<mat-chip>` z e-mailem (readonly), `<pych-complete-profile-form>`, obsługę stanu ładowania sesji (spinner na całej karcie) i błędu serwera (inline card / snackbar).
- **Obsługiwane zdarzenia:** `(save)="handleSave($event)"` z formularza dziecka.
- **Warunki walidacji:** deleguje walidację pól do `CompleteProfileFormComponent`; sam sprawdza wyłącznie stan sesji/ładowania.
- **Typy:** lokalny interfejs stanu:
  ```typescript
  interface CompleteProfileState {
      isLoadingSession: boolean;
      googleEmail: string | null;
      isSaving: boolean;
      serverError: string | null;
  }
  ```
- **Propsy:** brak (komponent routowalny).

### `CompleteProfileFormComponent` (nowy, `src/app/pages/auth/complete-profile/components/complete-profile-form/`)

- **Opis:** Prezentacyjny formularz reaktywny z jednym polem `username`, walidacją synchroniczną i asynchronicznym walidatorem sprawdzającym unikalność nazwy (debounce 400 ms wg planu UI — przyjęto tę wartość jako spójną z dokumentem UI; API-plan wspomina 500 ms — przyjmowana wartość: **400 ms**, zgodnie z bardziej szczegółowym planem UI, który jest właściwym źródłem prawdy dla warstwy widoku).
- **Główne elementy:** `<mat-form-field>` z `<input matInput formControlName="username">`, `mat-hint` „3–50 znaków, tylko litery, cyfry i podkreślenia", `mat-suffix` ze spinnerem 16px podczas trwania walidacji async, `<mat-error>` dla błędów (`required`, `minlength`, `maxlength`, `pattern`, `usernameTaken`, `usernameCheckFailed`), przycisk `mat-flat-button` „Zapisz i przejdź do aplikacji" (pełna szerokość, spinner podczas `isSaving`).
- **Obsługiwane zdarzenia:** `submitForm()` na `(ngSubmit)` → emituje `save` z wartością `username` tylko gdy `form.valid`; w przeciwnym razie `form.markAllAsTouched()`.
- **Warunki walidacji (zgodnie z API — `usernameAvailabilityQuerySchema` i `updateProfileSettingsSchema` w `supabase/functions/profile/profile.types.ts`):**
  - `required`
  - `minLength(3)`, `maxLength(50)`
  - `pattern(/^\S+$/)` — brak białych znaków (zgodnie z backendową walidacją Zod; hint UI mówiący o „literach, cyfrach i podkreślnikach" jest zawężeniem UX, backend akceptuje szerszy zestaw znaków — patrz sekcja 9)
  - Async: `usernameTaken` (ustawiany na podstawie `GET /profile/username-available`, wywoływanego tylko gdy pole przechodzi walidację synchroniczną)
- **Typy:**
  ```typescript
  interface CompleteProfileFormViewModel {
      username: FormControl<string>;
  }
  ```
- **Propsy:**
  - `@Input() isSaving = false`
  - `@Input() serverError: string | null = null` (np. komunikat 409 zwrócony przez `PUT /profile` już PO submit, mimo przejścia walidacji async — race condition)
  - `@Output() save = new EventEmitter<string>()`

## 5. Typy

Wszystkie potrzebne DTO/Command już istnieją w `shared/contracts/types.ts` — **nie są wymagane żadne zmiany w kontraktach współdzielonych**:

| Typ | Pochodzenie | Zastosowanie w tym widoku |
|---|---|---|
| `UsernameAvailableResponseDto { available: boolean }` | już istnieje (linie ok. 667–672) | Odpowiedź `GET /profile/username-available`, konsumowana przez asynchroniczny walidator `CompleteProfileFormComponent` |
| `ProfileSettingsDto { id, email, username, marketing_consent, marketing_consent_updated_at, marketing_consent_text_version }` | już istnieje | Odpowiedź `GET /profile` (sprawdzenie kompletności profilu w callbacku i w guardach) oraz `PUT /profile` |
| `UpdateProfileSettingsCommand { username, marketing_consent, marketing_consent_text_version }` | już istnieje | Body żądania `PUT /profile` przy zapisie `username` z ekranu `complete-profile` |
| `MarketingConsentTextVersion`, `MARKETING_CONSENT_TEXT_VERSION` | `shared/contracts/marketing-consent.ts` | Wartość domyślna wysyłana w `PUT /profile` (patrz uwaga w sekcji 7) |

### Nowe typy lokalne dla warstwy widoku (nie trafiają do `shared/contracts`)

```typescript
// src/app/pages/login/login-page.component.ts (rozszerzenie istniejącego interfejsu)
interface LoginState {
    isLoading: boolean;
    error: string | null;
    requiresEmailConfirmation: boolean;
    isResending: boolean;
    cooldownRemainingSeconds: number;
    lastEmailUsed: string | null;
    isGoogleLoading: boolean;        // NOWE
    oauthErrorMessage: string | null; // NOWE
}

// src/app/pages/register/register-page.component.ts (rozszerzenie istniejącego interfejsu)
interface RegisterState {
    isLoading: boolean;
    error: ApiError | null;
    isGoogleLoading: boolean; // NOWE
}

// src/app/pages/auth/complete-profile/complete-profile-page.component.ts
interface CompleteProfileState {
    isLoadingSession: boolean;
    googleEmail: string | null;
    isSaving: boolean;
    serverError: string | null;
}

// src/app/pages/auth/complete-profile/components/complete-profile-form/complete-profile-form.component.ts
interface CompleteProfileFormViewModel {
    username: FormControl<string>;
}

// src/app/core/services/profile-completion.service.ts
type ProfileCompletionStatus = 'unknown' | 'checking' | 'complete' | 'incomplete';

// Mapowanie kodów błędów z query param ?error= na /login (LoginPageComponent)
type OauthLoginErrorCode = 'access_denied' | 'oauth_error' | 'timeout' | 'profile_error';
```

## 6. Zarządzanie stanem

Zgodnie z regułami frontendowymi projektu, stan zarządzany jest przez **sygnały (`signal`)**, bez NgRx (ten widok nie wymaga globalnego store — dotyczy pojedynczych, izolowanych ekranów).

### `AuthService` (core, rozszerzenie istniejącego serwisu)

Dodanie metody:

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

Metoda nie zwraca żadnych danych — przeglądarka zostaje przekierowana przez Supabase SDK. Ewentualny `error` oznacza błąd **konfiguracji** (np. provider wyłączony) i jest jedynym przypadkiem, w którym strona `/login`/`/register` NIE wykona przekierowania.

### Custom hook: `ProfileCompletionService` (nowy, `core/services/profile-completion.service.ts`)

Singleton (`providedIn: 'root'`) buforujący informację o kompletności profilu (obecność `username`), aby uniknąć powtarzania zapytania `GET /profile` przy każdym dopasowaniu trasy (rekomendacja wydajnościowa z planu API — sekcja 8.2).

```typescript
@Injectable({ providedIn: 'root' })
export class ProfileCompletionService {
    private readonly profileSettingsApi = inject(ProfileSettingsApiService);
    private readonly authService = inject(AuthService);

    readonly status = signal<ProfileCompletionStatus>('unknown');

    constructor() {
        // Reset cache przy zmianie tożsamości (login/logout innego użytkownika)
        effect(() => {
            this.authService.userId(); // odczyt sygnału = subskrypcja
            this.status.set('unknown');
        });
    }

    /** Zwraca true jeśli profil ma username. Wynik cache'owany do czasu resetu. */
    async ensureChecked(): Promise<boolean> {
        if (this.status() === 'complete') return true;
        if (this.status() === 'incomplete') return false;

        this.status.set('checking');
        try {
            const profile = await firstValueFrom(this.profileSettingsApi.getProfileSettings());
            const isComplete = profile.username.trim().length > 0;
            this.status.set(isComplete ? 'complete' : 'incomplete');
            return isComplete;
        } catch {
            // W razie błędu (np. 401) traktuj jako niekompletny — guard i tak przekieruje do /login
            this.status.set('incomplete');
            return false;
        }
    }

    /** Wywoływane po udanym zapisie username na /auth/complete-profile. */
    markComplete(): void {
        this.status.set('complete');
    }
}
```

> Uwaga: `effect()` reagujący na `authService.userId()` zeruje cache przy każdej zmianie stanu sesji (login, logout, przełączenie użytkownika), eliminując ryzyko przecieku danych między sesjami bez konieczności ręcznego wpinania się w `AuthService.signOut()`.

### Stan lokalny komponentów (sygnały)

- `LoginPageComponent` / `RegisterPageComponent`: rozszerzony `state = signal<LoginState|RegisterState>(...)` o `isGoogleLoading` i (tylko login) `oauthErrorMessage`. `oauthErrorMessage` inicjalizowany w konstruktorze/`ngOnInit` na podstawie `route.snapshot.queryParamMap.get('error')`.
- `CompleteProfilePageComponent`: `state = signal<CompleteProfileState>(...)`.
- `CompleteProfileFormComponent`: stan formularza w `FormGroup` (Reactive Forms), bez dodatkowych sygnałów — status walidacji (`pending`/`invalid`/`valid`) czytany bezpośrednio z `form.controls.username.status`.

Nie jest wymagany żaden dodatkowy globalny store — cały stan związany z OAuth jest efemeryczny i lokalny dla widoku, poza `ProfileCompletionService`, który celowo jest singletonem współdzielonym z guardami tras.

## 7. Integracja API

| Krok | Wywołanie | Typ żądania | Typ odpowiedzi | Miejsce w kodzie |
|---|---|---|---|---|
| Inicjalizacja OAuth | `supabase.auth.signInWithOAuth({ provider: 'google', options: {...} })` | brak (SDK) | `{ error: AuthError \| null }` (SDK) | `AuthService.signInWithGoogle()` |
| Wymiana kodu na sesję | `supabase.auth.exchangeCodeForSession(code)` | `code: string` | `{ error }` (SDK) | `AuthService.exchangeCodeForSession()` — **istniejąca metoda, bez zmian** |
| Sprawdzenie kompletności profilu po OAuth | `GET /profile` (Edge Function) | — (JWT w nagłówku) | `ProfileSettingsDto` | `ProfileSettingsApiService.getProfileSettings()` — **istniejąca metoda**, wywoływana z `AuthCallbackPageComponent` i z `ProfileCompletionService` |
| Sprawdzenie unikalności username | `GET /profile/username-available?username=...` | query param `username: string` | `UsernameAvailableResponseDto` | **Nowa metoda** `ProfileSettingsApiService.checkUsernameAvailable(username)` |
| Zapis username | `PUT /profile` (Edge Function, funkcjonalnie odpowiada opisanemu w dokumentach `PATCH /profile` — rzeczywisty zaimplementowany endpoint to `PUT`) | `UpdateProfileSettingsCommand` | `ProfileSettingsDto` | `ProfileSettingsApiService.updateProfileSettings()` — **istniejąca metoda**, wywoływana z `CompleteProfilePageComponent` |

### Nowa metoda `ProfileSettingsApiService.checkUsernameAvailable`

```typescript
checkUsernameAvailable(username: string): Observable<UsernameAvailableResponseDto> {
    return from(
        this.supabase.functions.invoke<UsernameAvailableResponseDto>(
            `profile/username-available?username=${encodeURIComponent(username)}`,
            { method: 'GET' }
        )
    ).pipe(
        map((response) => {
            if (response.error) throw this.mapError(response.error);
            if (!response.data) throw this.mapError({ message: 'Username check failed' }, 500);
            return response.data;
        })
    );
}
```

### ⚠️ Kluczowa uwaga implementacyjna: kontrakt `PUT /profile` wymaga pełnego payloadu

Zaimplementowany schemat walidacji (`supabase/functions/profile/profile.types.ts`, `updateProfileSettingsSchema`) wymaga **zawsze trzech pól**: `username`, `marketing_consent` (boolean) oraz `marketing_consent_text_version` (niepusty string z dopuszczalnej listy wersji) — **niezależnie** od wartości `marketing_consent`. Jest to inne zachowanie niż przy rejestracji (gdzie `text_version` może być `null`, gdy zgoda nie została zaakceptowana).

Ekran `/auth/complete-profile` **nie zawiera** checkboxa zgody marketingowej (zgodnie z planem UI — świadomie pominięty, aby nie przeciążać ekranu tuż po OAuth). Dlatego przy zapisie `username` z tego ekranu, `CompleteProfilePageComponent` musi wysłać:

```typescript
this.profileSettingsApi.updateProfileSettings({
    username: formUsername.trim(),
    marketing_consent: false,
    marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION,
});
```

`MARKETING_CONSENT_TEXT_VERSION` (stała z `shared/contracts/marketing-consent.ts`) jest jedyną obecnie wspieraną wersją tekstu zgody, więc spełnia walidację `supportedVersions.includes(...)` bez błędu `422`, a `marketing_consent: false` odzwierciedla fakt, że użytkownik nie wyraził zgody na tym ekranie (może to zrobić później w `/settings`, zgodnie z wymaganiem 5. z dokumentu wymagań).

## 8. Interakcje użytkownika

| # | Interakcja | Oczekiwany wynik |
|---|---|---|
| 1 | Kliknięcie „Zaloguj się przez Google" na `/login` | `isGoogleLoading = true`, wywołanie `signInWithGoogle()`, przeglądarka przekierowana na stronę Google |
| 2 | Kliknięcie „Zarejestruj się przez Google" na `/register` | jak wyżej, z etykietą rejestracji — identyczny flow docelowy |
| 3 | Wybór konta Google i zgoda na uprawnienia | Redirect na `/auth/callback?code=...` |
| 4 | Odmowa zgody / zamknięcie okna Google | Redirect na `/auth/callback?error=access_denied` → dalej `/login?error=access_denied` → komunikat neutralny (US-OAUTH-001 kryt. 7) |
| 5 | Nowy użytkownik — pierwsze logowanie Google | Po wymianie kodu: `GET /profile` zwraca `username: ''` → redirect `/auth/complete-profile` |
| 6 | Powracający użytkownik z uzupełnionym `username` | Po wymianie kodu: `GET /profile` zwraca niepusty `username` → redirect `/dashboard` |
| 7 | Użytkownik email+hasło loguje się Google tym samym e-mailem | Supabase scala tożsamości automatycznie; dalszy przebieg jak w interakcji 6 |
| 8 | Wpisywanie `username` na `/auth/complete-profile` | Walidacja synchroniczna na `blur`/zmianę wartości; po 400 ms bez kolejnej zmiany i przejściu walidacji sync → wywołanie `GET /profile/username-available` (spinner w `mat-suffix`) |
| 9 | Kliknięcie „Zapisz i przejdź do aplikacji" (formularz poprawny) | `isSaving = true`, pola zablokowane, `PUT /profile` → sukces → `profileCompletionService.markComplete()` → redirect `/dashboard` |
| 10 | Próba wejścia na `/dashboard` (lub inną trasę prywatną) z niekompletnym profilem (np. wpisany bezpośrednio URL) | `usernameCompleteMatchGuard` przechwytuje nawigację → redirect `/auth/complete-profile` |
| 11 | Próba wejścia na `/auth/complete-profile` bez sesji | `oauthCompleteProfileGuard` → redirect `/login` |
| 12 | Próba wejścia na `/auth/complete-profile`, gdy profil już kompletny | `oauthCompleteProfileGuard` → redirect `/dashboard` (unikamy zbędnego ekranu) |
| 13 | Błąd sieci podczas sprawdzania unikalności `username` | Ostrzeżenie inline „Nie można sprawdzić dostępności nazwy", **przycisk zapisu pozostaje aktywny** (walidacja async ustawiana jako „niepewna", nie blokująca) |
| 14 | `PUT /profile` zwraca `409` mimo pozytywnej walidacji async (race condition) | Formularz odblokowany, `serverError` = „Ta nazwa użytkownika jest już zajęta.", pole `username` oznaczone błędem |

## 9. Warunki i walidacja

| Warunek | Źródło | Komponent | Wpływ na UI |
|---|---|---|---|
| `username`: wymagane | zgodne z `usernameAvailabilityQuerySchema` / `updateProfileSettingsSchema` (Zod, backend) | `CompleteProfileFormComponent` | `mat-error` „To pole jest wymagane"; przycisk zapisu zablokowany |
| `username`: 3–50 znaków | jw. | jw. | `mat-error` z komunikatem długości; przycisk zablokowany |
| `username`: brak białych znaków (`^\S+$`) | jw. (Zod: `.regex(/^\S+$/)`) | jw. | `mat-error` „Nazwa nie może zawierać spacji"; przycisk zablokowany. **Uwaga:** hint UI „tylko litery, cyfry i podkreślenia" z planu UI jest węższy niż realna reguła backendu — implementacja powinna trzymać się rzeczywistej reguły backendu (`^\S+$`), aby uniknąć fałszywych błędów walidacji klienckiej dla znaków dozwolonych przez API |
| `username`: unikalność (case-insensitive) | `GET /profile/username-available` | jw. (async validator) | Spinner w `mat-suffix` podczas sprawdzania; `mat-error` „Ta nazwa użytkownika jest już zajęta." gdy `available: false`; przycisk zapisu zablokowany podczas `pending` i przy `usernameTaken` |
| Sesja OAuth aktywna | `supabase.auth.getSession()` | `oauthCompleteProfileGuard` | Brak sesji → redirect `/login`, ekran nie renderuje się |
| Profil już kompletny | `ProfileCompletionService.ensureChecked()` | `oauthCompleteProfileGuard`, `usernameCompleteMatchGuard` | Kompletny + wejście na `/auth/complete-profile` → redirect `/dashboard`; niekompletny + wejście na trasę prywatną → redirect `/auth/complete-profile` |
| Rozpoznany kod błędu OAuth w `?error=` | whitelist: `access_denied`, `oauth_error`, `timeout`, `profile_error` | `LoginPageComponent` | Wyświetlenie odpowiedniego, przetłumaczonego komunikatu w `LoginFormComponent`; nierozpoznany kod → brak komunikatu (traktowany jak jego brak, zgodnie z zasadą „nie ujawniaj szczegółów technicznych") |
| `marketing_consent_text_version` musi należeć do wspieranej listy | `updateProfileSettingsSchema` (backend) | `CompleteProfilePageComponent` (payload wysyłany do `PUT /profile`) | Zapewnione statycznie przez użycie stałej `MARKETING_CONSENT_TEXT_VERSION` — nie wymaga walidacji UI |

## 10. Obsługa błędów

| Scenariusz | Kod / źródło | Zachowanie UI |
|---|---|---|
| `signInWithOAuth` zwraca błąd (provider niedostępny) | SDK `AuthError` | Brak przekierowania; `isGoogleLoading = false`; inline komunikat w `LoginFormComponent`/`RegisterFormComponent`: „Logowanie przez Google jest chwilowo niedostępne."; szczegóły logowane w konsoli (`console.error`), **nieujawniane** użytkownikowi |
| Callback z `error=access_denied` | Google OAuth | Redirect `/login?error=access_denied` → komunikat neutralny: „Anulowano logowanie przez Google." (nietraktowane jako błąd aplikacji) |
| Callback z innym `error`/`error_description` | Supabase/Google | Redirect `/login?error=oauth_error` → komunikat: „Wystąpił błąd podczas logowania przez Google. Spróbuj ponownie." |
| `exchangeCodeForSession` rzuca błąd lub timeout | Sieć / Supabase | Redirect `/login?error=timeout` → komunikat: „Przekroczono czas oczekiwania. Spróbuj ponownie." |
| `GET /profile` po OAuth zwraca błąd (401/500) | Edge Function | Redirect `/login?error=profile_error` → komunikat: „Wystąpił błąd podczas ładowania profilu. Zaloguj się ponownie." |
| `GET /profile/username-available` — błąd sieci | Fetch/Edge Function | Walidator async ustawia `{ usernameCheckFailed: true }`, ale **nie blokuje** przycisku zapisu (zgodnie z tabelą błędów API planu) — ostrzeżenie inline: „Nie można sprawdzić dostępności nazwy." |
| `GET /profile/username-available` — `400` (niepoprawny format) | Edge Function | Nie powinno wystąpić przy poprawnej walidacji klienckiej — traktowane jak błąd sieci (fail-open, nie blokuje) |
| `PUT /profile` — `409 Conflict` | Edge Function | `serverError` = „Ta nazwa użytkownika jest już zajęta.", formularz odblokowany, fokus na polu `username` |
| `PUT /profile` — `400 Bad Request` | Edge Function | `serverError` z komunikatem walidacji zwróconym przez API (fallback: komunikat ogólny) |
| `PUT /profile` — `422` (nieobsługiwana wersja zgody marketingowej) | Edge Function | Nie powinno wystąpić przy poprawnej stałej `MARKETING_CONSENT_TEXT_VERSION` — traktowane jako błąd nieoczekiwany, snackbar „Wystąpił błąd. Spróbuj ponownie." |
| `PUT /profile` — `401 Unauthorized` (sesja wygasła w trakcie wypełniania formularza) | Edge Function | Redirect `/login` z komunikatem „Sesja wygasła. Zaloguj się ponownie." (snackbar przed przekierowaniem) |
| `ProfileCompletionService.ensureChecked()` rzuca błąd w guardzie | dowolny | Traktowane jako `incomplete` — użytkownik trafia na `/auth/complete-profile`, gdzie nastąpi kolejna, jawna próba pobrania profilu w `CompleteProfilePageComponent` z ewentualnym komunikatem błędu |

## 11. Kroki implementacji

1. **Zasób graficzny:** dodać `public/icons/google-logo.svg` (oficjalne logo Google zgodnie z Google Brand Guidelines), dostępne pod `/icons/google-logo.svg`.

2. **`AuthService`:** dodać metodę `signInWithGoogle(): Promise<void>` (sekcja 6) wraz z testem jednostkowym weryfikującym parametry wywołania `signInWithOAuth` (`provider: 'google'`, poprawny `redirectTo`, `queryParams`).

3. **`ProfileSettingsApiService`:** dodać metodę `checkUsernameAvailable(username: string): Observable<UsernameAvailableResponseDto>` wywołującą `GET /profile/username-available` przez `supabase.functions.invoke`, z testem jednostkowym (sukces, `available: true/false`, mapowanie błędu).

4. **Nowy `OauthGoogleButtonComponent`** (`src/app/shared/components/oauth-google-button/`): standalone, `ChangeDetectionStrategy.OnPush`, selektor `pych-oauth-google-button`, zgodnie ze specyfikacją z sekcji 4. Dodać test jednostkowy (emisja `clicked`, brak emisji przy `isLoading`).

5. **Rozszerzenie `LoginFormComponent`:** dodać propsy/eventy (`isGoogleLoading`, `oauthErrorMessage`, `loginWithGoogle`), osadzić `<pych-oauth-google-button>` w szablonie między przyciskiem submit a `mat-card-actions`. Zaktualizować/dopisać testy.

6. **Rozszerzenie `LoginPageComponent`:** dodać pola `isGoogleLoading`, `oauthErrorMessage` do `LoginState`; w konstruktorze/`ngOnInit` odczytać `route.snapshot.queryParamMap.get('error')` i zmapować na komunikat (whitelist z sekcji 9); dodać metodę `handleGoogleLogin()` wywołującą `authService.signInWithGoogle()` z obsługą `try/catch/finally` analogiczną do `handleLogin()`. Podpiąć nowe propsy w szablonie `login-page.component.html`.

7. **Analogiczne zmiany w `RegisterFormComponent`/`RegisterPageComponent`** (kroki 5–6, bez obsługi `?error=` i `requiresEmailConfirmation`).

8. **Rozszerzenie `AuthCallbackPageComponent`:** przepisać `processCallback()` zgodnie z pseudokodem z sekcji 4 (rozgałęzienie po `type=email` vs OAuth), dodać prywatną metodę `handleOAuthSuccess()` wywołującą `ProfileSettingsApiService.getProfileSettings()` (wstrzykniętą przez `inject()`) i przekierowującą warunkowo na `/auth/complete-profile` lub `/dashboard`; zachować w 100% dotychczasową ścieżkę `type=email`. Rozbudować istniejące/dodać nowe testy jednostkowe: OAuth + brak username → `/auth/complete-profile`; OAuth + username → `/dashboard`; `error=access_denied` → `/login?error=access_denied`; błąd `GET /profile` → `/login?error=profile_error`; regresja dla istniejącego flow `type=email`.

9. **Nowy `ProfileCompletionService`** (`src/app/core/services/profile-completion.service.ts`): implementacja zgodna z sekcją 6, wraz z testem jednostkowym (cache po pierwszym wywołaniu, reset przy zmianie `authService.userId()`, `markComplete()`, obsługa błędu jako `incomplete`).

10. **Nowy guard `oauthCompleteProfileGuard`** (`src/app/core/guards/oauth-complete-profile.guard.ts`, `CanActivateFn`):
    ```typescript
    export const oauthCompleteProfileGuard: CanActivateFn = async () => {
        const supabase = inject(SupabaseService);
        const router = inject(Router);
        const profileCompletion = inject(ProfileCompletionService);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            router.navigate(['/login']);
            return false;
        }

        const isComplete = await profileCompletion.ensureChecked();
        if (isComplete) {
            router.navigate(['/dashboard']);
            return false;
        }

        return true;
    };
    ```
    Dodać test jednostkowy pokrywający trzy gałęzie.

11. **Nowy guard `usernameCompleteMatchGuard`** (`src/app/core/guards/username-complete-match.guard.ts`, `CanMatchFn`):
    ```typescript
    export const usernameCompleteMatchGuard: CanMatchFn = async () => {
        const router = inject(Router);
        const profileCompletion = inject(ProfileCompletionService);

        const isComplete = await profileCompletion.ensureChecked();
        if (!isComplete) {
            router.navigate(['/auth/complete-profile']);
            return false;
        }
        return true;
    };
    ```
    Dodać test jednostkowy.

12. **Nowy widok `CompleteProfilePageComponent`** (`src/app/pages/auth/complete-profile/`): implementacja zgodnie z sekcją 4 i 6 — pobranie e-maila (`supabase.auth.getUser()`), metoda `handleSave(username: string)` wywołująca `ProfileSettingsApiService.updateProfileSettings({ username, marketing_consent: false, marketing_consent_text_version: MARKETING_CONSENT_TEXT_VERSION })`, obsługa sukcesu (`profileCompletionService.markComplete()` + `router.navigate(['/dashboard'])`) i błędów (sekcja 10). Szablon HTML/SCSS wzorowany na `login-page`/`register-page` (wyśrodkowana karta, spójna stylistyka).

13. **Nowy komponent `CompleteProfileFormComponent`** (`src/app/pages/auth/complete-profile/components/complete-profile-form/`): `FormGroup<CompleteProfileFormViewModel>` z walidatorami synchronicznymi (`required`, `minLength(3)`, `maxLength(50)`, `Validators.pattern(/^\S+$/)`) oraz customowym `AsyncValidatorFn` opartym o `valueChanges` z `debounceTime(400)`, `distinctUntilChanged()`, `switchMap()` do `checkUsernameAvailable()`, mapującym `{ available: false }` na błąd `{ usernameTaken: true }`, a błąd sieci na `{ usernameCheckFailed: true }` (błąd niepowodujący `invalid`, patrz sekcja 9/10 — zaimplementować przez zwrócenie `null` z jednoczesnym ustawieniem lokalnego sygnału ostrzeżenia, aby nie blokować przycisku). Dodać testy jednostkowe walidacji (sync i async, z `fakeAsync`/`tick`).

14. **Aktualizacja `app.routes.ts`:**
    - Dodać trasę `auth/complete-profile` do grupy `MainLayoutComponent` z `canActivate: [oauthCompleteProfileGuard]`.
    - Dodać stub `auth/complete-profile` (`redirectTo: '/login'`, `pathMatch: 'full'`) do grupy `PublicLayoutComponent`.
    - Doklejyć `usernameCompleteMatchGuard` do `canMatch` tras: `dashboard`, `my-recipies`, `recipes` (loadChildren), `collections` (loadChildren), `shopping`, `settings`, `admin` (obok istniejącego `adminRoleMatchGuard`).


15. **Manualna weryfikacja konfiguracji zewnętrznej** (poza kodem aplikacji, ale wymagana do działania): rejestracja `{origin}/auth/callback` w Google Cloud Console i w Supabase Dashboard (Authentication → URL Configuration), włączenie providera Google oraz opcji „Link accounts” w Supabase Dashboard — zgodnie z `google-oauth-login-deployment-plan.md`.

16. **Przegląd końcowy:** uruchomić `ng lint`, `vitest run` (cel: pokrycie ≥80% dla nowych plików, zgodnie z kryteriami jakości projektu) oraz ręczny smoke test na środowisku lokalnym z użyciem konta testowego Google.
