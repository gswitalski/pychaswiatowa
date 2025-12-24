# Plan implementacji widoków – weryfikacja e-mail (rejestracja + resend + callback)

## 1. Przegląd
Celem zmian jest dostosowanie procesu rejestracji i logowania do wymogu **weryfikacji adresu e-mail**:

- Po rejestracji użytkownik **nie jest automatycznie logowany** i trafia na nowy ekran `/register/verify-sent`, który informuje o wysłaniu linku weryfikacyjnego.
- Użytkownik może **ponownie wysłać link weryfikacyjny** (cooldown 60 sekund + obsługa limitów antynadużyciowych).
- Kliknięcie w link w e-mailu prowadzi do technicznej trasy `/auth/callback`, która finalizuje proces i przekierowuje na:
    - `/email-confirmed` (sukces),
    - `/email-confirmation-invalid` (link nieważny / wygasły / błąd).
- W `/login` dla kont z niepotwierdzonym e-mailem logowanie jest blokowane i pokazywana jest akcja „Wyślij link ponownie”.

Plan jest zgodny z PRD (US-001, US-002, US-033, US-034), UI Plan oraz zasadami projektu (Angular standalone, signals, `inject`, control flow `@if`, OnPush, Angular Material).

## 2. Routing widoku
Wymagane ścieżki i zachowanie:

- **`/register` (ZMIENIONE)**:
    - formularz: nazwa użytkownika, e-mail, hasło, potwierdzenie hasła,
    - po sukcesie: przekierowanie do **`/register/verify-sent`** (zamiast auto-logowania / redirectu na `/dashboard`).
- **`/register/verify-sent` (NOWE)**:
    - ekran potwierdzenia wysyłki linku,
    - akcje: „Wyślij ponownie” (cooldown 60s), „Zmień e-mail”.
- **`/auth/callback` (NOWE, techniczny)**:
    - krótkotrwały loader + finalizacja przekierowania,
    - redirect na sukces/błąd.
- **`/email-confirmed` (NOWE)**:
    - komunikat o sukcesie + CTA do `/login`.
- **`/email-confirmation-invalid` (NOWE)**:
    - komunikat o błędzie linku + akcja „Wyślij nowy link” (cooldown 60s).
- **`/login` (ZMIENIONE)**:
    - dla niepotwierdzonego e-maila: komunikat + akcja „Wyślij link ponownie” (cooldown 60s).

### Wpięcie w istniejący routing
W projekcie routing jest zorganizowany w `src/app/app.routes.ts` w dwóch grupach:
- zalogowani (layout: `MainLayoutComponent`, `canMatch: authenticatedMatchGuard`)
- goście (layout: `PublicLayoutComponent`, `canMatch: guestOnlyMatchGuard`)

Aby trasy działały spójnie **również dla zalogowanych** (np. kliknięcie w link weryfikacyjny w otwartej sesji), należy dodać **`/auth/callback`**, **`/email-confirmed`**, **`/email-confirmation-invalid`** jako children w obu grupach.  
Uwaga: `MainLayoutComponent` i tak ukrywa sidebar na nieprywatnych ścieżkach (nie ma ich w `PRIVATE_PATHS`), więc wymaganie „bez Sidebara” będzie spełnione.

## 3. Struktura komponentów
Proponowana struktura (standalone):

- `RegisterPageComponent` (istnieje, zmiana logiki sukcesu)
    - `RegisterFormComponent` (istnieje)
- `RegisterVerifySentPageComponent` (nowy widok)
    - (opcjonalnie) `VerificationEmailSentCardComponent` (komponent prezentacyjny)
- `AuthCallbackPageComponent` (nowy widok techniczny)
- `EmailConfirmedPageComponent` (nowy widok)
- `EmailConfirmationInvalidPageComponent` (nowy widok)
    - (opcjonalnie) `ResendVerificationCardComponent`
- `LoginPageComponent` (istnieje, zmiana UX + resend)
    - `LoginFormComponent` (istnieje, rozszerzenie o sekcję resend)

Wspólny kod (zalecane, aby uniknąć duplikacji):
- `EmailVerificationService` (lub rozszerzenie `AuthService`) – operacje resend + callback.
- `CooldownTimer` (VM + helper) – 60-sekundowy cooldown współdzielony przez `/register/verify-sent`, `/login` i `/email-confirmation-invalid`.

### Diagram drzewa komponentów (high-level)

```
Routes
├─ /register
│  └─ RegisterPageComponent
│     └─ RegisterFormComponent
├─ /register/verify-sent
│  └─ RegisterVerifySentPageComponent
│     └─ (VerificationEmailSentCardComponent)
├─ /auth/callback
│  └─ AuthCallbackPageComponent
├─ /email-confirmed
│  └─ EmailConfirmedPageComponent
└─ /email-confirmation-invalid
   └─ EmailConfirmationInvalidPageComponent
      └─ (ResendVerificationCardComponent)

/login
└─ LoginPageComponent
   └─ LoginFormComponent (+ resend sekcja przy błędzie „email niepotwierdzony”)
```

## 4. Szczegóły komponentów

### `RegisterPageComponent` (ZMIENIONE)
- **Opis komponentu**: Strona rejestracji. Dziś wykonuje `authService.signUp(...)` oraz przekierowuje na `redirectTo` lub `/dashboard`. W nowym flow po sukcesie zawsze przenosi użytkownika na `/register/verify-sent`.
- **Główne elementy**:
    - wrapper strony + sekcja błędu (już jest),
    - `pych-register-form`.
- **Obsługiwane zdarzenia**:
    - `(registerSubmit)` → `onRegisterSubmit(...)`.
- **Walidacja (UI)**:
    - e-mail: required + format,
    - displayName: required + min 3,
    - hasło: required + min 8 (uwaga: w PRD jest „minimalna długość”, backend może mieć inną – UI powinno mapować komunikaty Supabase),
    - potwierdzenie hasła: required + równe hasłu.
- **Integracja (Auth)**:
    - `signUp` musi przekazać **redirect do callback** w `options.redirectTo` (Supabase): `window.location.origin + '/auth/callback'` (albo wartość z env).
- **Zachowanie po sukcesie (zmiana)**:
    - `router.navigate(['/register/verify-sent'], { queryParams: { email: formData.email } })`
    - (opcjonalnie) zachować istniejący `redirectTo` tylko do powrotu na login po weryfikacji – ale MVP: prosto i przewidywalnie.
- **Typy**:
    - wejście z formularza: `{ email: string; displayName: string; password: string }` (już istnieje),
    - stan: `RegisterState { isLoading: boolean; error: ApiError | null }` (już istnieje).
- **Propsy**:
    - `RegisterFormComponent`: `[isLoading]`, `(registerSubmit)` – bez zmian.

### `RegisterFormComponent` (bez zmian funkcjonalnych)
- **Opis komponentu**: Formularz rejestracji z walidacją reactive forms.
- **Główne elementy**: `mat-card`, `mat-form-field`, `mat-input`, submit button ze spinnerem.
- **Obsługiwane zdarzenia**: `(ngSubmit)` → `submitForm()`.
- **Walidacja**: jak wyżej.
- **Typy**: `RegisterFormViewModel` (z `shared/contracts/types.ts`).
- **Propsy**:
    - `isLoading: boolean`
    - `registerSubmit: EventEmitter<{ email; displayName; password }>`

### `RegisterVerifySentPageComponent` (NOWE) – `/register/verify-sent`
- **Opis komponentu**: Ekran „Wysłaliśmy link aktywacyjny na adres: {email}”. Umożliwia resend z cooldownem 60s i akcję „Zmień e-mail”.
- **Główne elementy (Material)**:
    - `mat-card` z treścią:
        - tytuł „Sprawdź skrzynkę e-mail”
        - komunikat: „Wysłaliśmy link aktywacyjny na adres: **{email}**”
        - podpowiedź: „Sprawdź też SPAM/oferty”
    - CTA:
        - `mat-stroked-button` „Wyślij ponownie” + licznik „(xx s)”
        - `mat-button` „Zmień e-mail” (link do `/register` z prefill)
    - opcjonalnie `mat-progress-spinner` podczas resend.
- **Obsługiwane zdarzenia**:
    - klik „Wyślij ponownie” → `resendVerification(email)`
    - klik „Zmień e-mail” → `router.navigate(['/register'], { queryParams: { email } })`
- **Walidacja / preconditions**:
    - `email` musi być dostępny (z `queryParam` lub `history.state`); jeśli nie ma – pokaż komunikat i link do `/register`.
    - przycisk resend disabled gdy:
        - trwa request (`isResending === true`)
        - `cooldownRemaining > 0`
- **Typy**:
    - `VerifySentState` (nowy):
        - `email: string | null`
        - `isResending: boolean`
        - `cooldownRemainingSeconds: number`
        - `error: string | null`
        - `successToastRequested: boolean` (opcjonalnie, jeśli używamy snackbar)
- **Propsy**: brak (strona routowana).

### `LoginPageComponent` (ZMIENIONE)
- **Opis komponentu**: Strona logowania. Dziś wyświetla błąd string i renderuje `LoginFormComponent`.
- **Zmiana UX**:
    - Jeżeli błąd z Supabase oznacza „Email not confirmed”:
        - pokaż komunikat: „Potwierdź adres e-mail, aby się zalogować.”
        - pokaż akcję „Wyślij link ponownie” (cooldown 60s).
    - Akcja resend powinna użyć e-mail z formularza (jeśli wprowadzony i poprawny) lub poprosić o uzupełnienie.
- **Obsługiwane zdarzenia**:
    - `(login)` → `handleLogin(credentials)`
    - klik „Wyślij link ponownie” → `resendVerification(emailFromForm)`
- **Walidacja (UI)**:
    - resend dostępny tylko gdy:
        - e-mail jest niepusty i `Validators.email` przechodzi,
        - cooldown = 0,
        - nie trwa inny request.
- **Typy**:
    - `LoginState` (istnieje) rozszerzyć o:
        - `isResending: boolean`
        - `cooldownRemainingSeconds: number`
        - `requiresEmailConfirmation: boolean` (flaga ustawiana na podstawie błędu)
- **Propsy**:
    - przekazać do `LoginFormComponent` dodatkowo dane dla sekcji resend (jeśli sekcja jest w formie child componentu) albo obsłużyć w page.

### `LoginFormComponent` (ZMIENIONE UI)
- **Opis komponentu**: Formularz logowania reactive forms.
- **Zmiany**:
    - dodać (warunkowo) sekcję pod błędem API, np.:
        - tekst + przycisk „Wyślij link ponownie” (disabled + licznik),
        - (opcjonalnie) mała informacja: „Nie dostałeś e-maila? Sprawdź SPAM.”
    - komponent nie powinien sam wołać API – tylko emitować event.
- **Obsługiwane zdarzenia**:
    - `(ngSubmit)` → `submitForm()`
    - klik resend → `resendVerification.emit(email)`
- **Walidacja**:
    - resend: e-mail musi być poprawny, jeśli nie – `markAsTouched` i pokaż błąd.
- **Typy / Propsy (propozycja)**:
    - nowe inputy:
        - `requiresEmailConfirmation: boolean`
        - `resendCooldownSeconds: number`
        - `isResending: boolean`
    - nowe outputy:
        - `resendVerification: EventEmitter<{ email: string }>`

### `AuthCallbackPageComponent` (NOWE) – `/auth/callback`
- **Opis komponentu**: „Roboczy” ekran po kliknięciu w link weryfikacyjny. Finalizuje proces po stronie klienta i przekierowuje.
- **Główne elementy**:
    - loader + krótki tekst „Finalizujemy weryfikację…”
- **Obsługiwane zdarzenia**:
    - `ngOnInit()` (lub `effect()`): uruchomienie finalizacji.
- **Logika (happy path)**:
    - odczytaj parametry URL i spróbuj pobrać sesję z URL:
        - rekomendowane: `supabase.auth.getSessionFromUrl()` (obsługuje URL-e z parametrami/hash po flow auth),
        - jeśli uda się ustalić wynik → przekieruj na `/email-confirmed`.
- **Logika (error path)**:
    - jeśli brak danych w URL / błąd walidacji → przekieruj na `/email-confirmation-invalid`.
- **Ważne uwagi**:
    - jeśli finalizacja utworzy sesję, a produkt wymaga „bez auto-logowania po rejestracji”, rozważyć **natychmiastowe `signOut()`** przed przekierowaniem na `/email-confirmed`.  
      (Decyzja produktowa: PRD wymaga braku auto-logowania po rejestracji; callback może tworzyć sesję technicznie – warto ją wyczyścić dla spójności UX).
- **Typy**:
    - `AuthCallbackState`:
        - `isLoading: boolean`
        - `error: string | null`

### `EmailConfirmedPageComponent` (NOWE) – `/email-confirmed`
- **Opis komponentu**: Ekran sukcesu: „Adres e-mail potwierdzony. Możesz się zalogować.” + CTA do `/login`.
- **Główne elementy**:
    - `mat-card` z komunikatem,
    - `mat-raised-button` „Przejdź do logowania”.
- **Obsługiwane zdarzenia**:
    - klik CTA → `router.navigate(['/login'])`.
- **Walidacja**: brak.
- **Typy**: brak (prosty widok).

### `EmailConfirmationInvalidPageComponent` (NOWE) – `/email-confirmation-invalid`
- **Opis komponentu**: Ekran błędu: „Link nieważny lub wygasł”. Daje możliwość wysłania nowego linku (cooldown 60s) oraz linki do `/login` i `/register`.
- **Główne elementy**:
    - `mat-card` z komunikatem,
    - pole e-mail (jeśli nie mamy skąd wziąć) lub informacja „Podaj e-mail, aby wysłać ponownie”,
    - przycisk „Wyślij nowy link” (cooldown 60s),
    - linki do logowania/rejestracji.
- **Obsługiwane zdarzenia**:
    - klik resend → `resendVerification(email)`
    - klik linków → nawigacja.
- **Walidacja**:
    - e-mail wymagany + format.
- **Typy**:
    - `EmailConfirmationInvalidState`:
        - `email: string`
        - `isResending: boolean`
        - `cooldownRemainingSeconds: number`
        - `error: string | null`

## 5. Typy
Wykorzystywane istniejące typy:
- `RegisterFormViewModel`, `LoginFormViewModel` – `shared/contracts/types.ts`
- `SignUpRequestDto`, `SignInRequestDto` – `shared/contracts/types.ts`
- `ApiError` – `shared/contracts/types.ts`

Nowe typy ViewModel (propozycja, lokalne dla stron – nie muszą iść do `shared/`):

- **`CooldownState`**
    - `cooldownRemainingSeconds: number`
    - `cooldownStartedAt: number | null` (opcjonalnie, gdy chcemy odtwarzać po refreshu)
- **`VerifySentState`**
    - `email: string | null`
    - `isResending: boolean`
    - `cooldownRemainingSeconds: number`
    - `error: string | null`
- **`LoginState` (rozszerzenie istniejącego)**
    - `requiresEmailConfirmation: boolean`
    - `isResending: boolean`
    - `cooldownRemainingSeconds: number`
- **`EmailConfirmationInvalidState`**
    - `email: string`
    - `isResending: boolean`
    - `cooldownRemainingSeconds: number`
    - `error: string | null`

Uwaga: cooldown „60 sekund” powinien być parametryzowany stałą: `RESEND_COOLDOWN_SECONDS = 60`.

## 6. Zarządzanie stanem
Zalecane podejście (zgodne z projektem):

- **Stan stron jako `signal(...)`** (tak jak w istniejących `RegisterPageComponent`, `LoginPageComponent`).
- **Cooldown jako sygnał** aktualizowany przez `setInterval` kontrolowany przez `DestroyRef`:
    - start: ustaw `cooldownRemainingSeconds = 60`,
    - tick co 1s: `cooldownRemainingSeconds--` do 0,
    - cleanup w `onDestroy`.
- **Brak „white flashing”**: przy resend utrzymuj widok w miejscu, blokuj tylko przycisk i pokazuj spinner/label.

Opcjonalnie (bardziej „clean”):
- wydziel `CooldownService` (lokalny, np. w `src/app/shared/services/`) lub prosty helper `createCooldownSignal(destroyRef, seconds)`.

## 7. Integracja API
W tym flow frontend komunikuje się wyłącznie z Supabase Auth przez `SupabaseService` / `AuthService` (zgodnie z zasadami: frontend może używać supabase do auth).

### 7.1 Rejestracja (sign up)
- **Operacja**: `supabase.auth.signUp(...)`
- **Request**:
    - `email`, `password`
    - `options.data.username` (z `displayName`)
    - `options.redirectTo`: `window.location.origin + '/auth/callback'`
- **Oczekiwany wynik**:
    - przy włączonej weryfikacji e-mail: `session` zwykle będzie `null`,
    - po sukcesie przekierowanie w UI do `/register/verify-sent`.

### 7.2 Logowanie (sign in)
- **Operacja**: `supabase.auth.signInWithPassword({ email, password })`
- **Obsługa błędów**:
    - błędne dane: komunikat „Nieprawidłowy e-mail lub hasło.”
    - e-mail niepotwierdzony: komunikat „Potwierdź adres e-mail, aby się zalogować.” + akcja resend.

### 7.3 Ponowna wysyłka linku weryfikacyjnego (resend)
W API planie: `POST /auth/resend` (Supabase Auth).  
W implementacji przez SDK: użyć metody Supabase Auth do resend (np. `supabase.auth.resend(...)`), przekazując:
- `type: 'signup'`
- `email`
- `options.redirectTo`: `window.location.origin + '/auth/callback'`

Obsługa odpowiedzi:
- **Sukces**: pokaż Snackbar/Toast „Wysłaliśmy nowy link aktywacyjny.”
- **Rate limit / nadużycia**: jeśli błąd wskazuje limit (np. HTTP 429), pokaż komunikat użytkowy: „Osiągnięto limit wysyłek. Spróbuj ponownie później.”

### 7.4 Callback (finalizacja kliknięcia w link)
- **Operacja**: pobranie sesji z URL:
    - preferowane: `supabase.auth.getSessionFromUrl()` (pokrywa przypadki magic-link/OAuth/email flow).
- **Sukces**:
    - (opcjonalnie) `supabase.auth.signOut()` aby nie utrzymywać sesji, jeśli trzymamy się zasady „bez auto-logowania po rejestracji”.
    - redirect → `/email-confirmed`.
- **Błąd / brak danych**:
    - redirect → `/email-confirmation-invalid`.

## 8. Interakcje użytkownika

- **Rejestracja**
    - Użytkownik wypełnia formularz i klika „Zarejestruj się”.
    - Widzi loader na przycisku.
    - Po sukcesie trafia na `/register/verify-sent` z informacją o e-mailu.
- **Verify-sent**
    - Użytkownik klika „Wyślij ponownie”:
        - przycisk przechodzi w disabled,
        - widzi odliczanie 60s,
        - po sukcesie dostaje Snackbar.
    - Użytkownik klika „Zmień e-mail”:
        - wraca na `/register` (opcja: prefill e-mail w queryParam).
- **Kliknięcie w link weryfikacyjny**
    - Użytkownik trafia na `/auth/callback` i widzi „Finalizujemy…”.
    - Po sukcesie trafia na `/email-confirmed`.
    - Po błędzie trafia na `/email-confirmation-invalid`.
- **Logowanie**
    - Użytkownik próbuje się zalogować niepotwierdzonym kontem:
        - widzi komunikat o konieczności potwierdzenia,
        - widzi przycisk „Wyślij link ponownie” (cooldown).

## 9. Warunki i walidacja

- **Register**
    - `email`: required + format,
    - `displayName`: required + min 3,
    - `password`: required + min 8,
    - `passwordConfirm`: required + match.
- **Resend (wszystkie ekrany)**
    - e-mail: wymagany i poprawny format,
    - cooldown: 60s, przycisk disabled w trakcie,
    - request in-flight: blokada akcji + spinner.
- **Callback**
    - brak danych w URL / błąd parsowania: traktować jako invalid link.
- **Bezpieczeństwo**
    - brak ujawniania zbyt dokładnych informacji o istnieniu konta (szczególnie w resend). Komunikaty powinny być możliwie neutralne, np. „Jeśli konto istnieje i wymaga aktywacji, wyślemy e-mail.”

## 10. Obsługa błędów

- **`User already registered`**:
    - jeśli konto jest zweryfikowane: komunikat „Konto już istnieje” + link do logowania/resetu hasła,
    - jeśli niezweryfikowane: umożliwić resend (w MVP można przyjąć wspólny komunikat + przejście na `/register/verify-sent`).
- **`Email not confirmed`** (login):
    - komunikat + resend.
- **`429 Too Many Requests`** (resend):
    - komunikat: „Zbyt wiele prób. Spróbuj ponownie później.”
- **Błędy sieciowe**:
    - ogólny komunikat: „Nie udało się wykonać operacji. Sprawdź połączenie i spróbuj ponownie.”
- **Błędy callback**:
    - zawsze prowadzić do `/email-confirmation-invalid` (z możliwością resend).

## 11. Kroki implementacji
1. **Routing**: dodać w `src/app/app.routes.ts` nowe ścieżki w obu grupach (guest + authenticated): `/auth/callback`, `/email-confirmed`, `/email-confirmation-invalid`; dodać w guest: `/register/verify-sent`.
2. **AuthService**: rozszerzyć `src/app/core/services/auth.service.ts` o:
    - `resendVerificationEmail(email: string, redirectTo: string): Promise<void>`
    - `getSessionFromUrl(): Promise<...>` (lub wrapper do `supabase.auth.getSessionFromUrl()`)
    - (opcjonalnie) `signOut()` użyte w callback dla „no auto-login”.
3. **Register flow**:
    - w `RegisterPageComponent` ustawić `options.redirectTo` dla `signUp` na `/auth/callback`,
    - po sukcesie przekierować na `/register/verify-sent` i przekazać e-mail (queryParam lub `state`).
4. **Nowy widok** `/register/verify-sent`:
    - dodać `RegisterVerifySentPageComponent` + template (Material card),
    - dodać cooldown 60s i obsługę resend + Snackbar.
5. **Login flow**:
    - rozpoznać błąd „Email not confirmed” w `LoginPageComponent` i ustawić flagę `requiresEmailConfirmation`,
    - dodać obsługę resend (z e-maila w formularzu) + cooldown.
6. **Nowy widok** `/auth/callback`:
    - dodać `AuthCallbackPageComponent`,
    - zaciągnąć sesję z URL i przekierować do `/email-confirmed` lub `/email-confirmation-invalid`,
    - (opcjonalnie) czyścić sesję (`signOut`) dla spójności z „nie auto-logować”.
7. **Nowe widoki** `/email-confirmed` i `/email-confirmation-invalid`:
    - implementacja prostych kart + CTA,
    - na invalid: formularz e-mail + resend + cooldown.
8. **Spójność UX**:
    - zastosować OnPush,
    - komunikaty błędów i sukcesu przez Snackbar (jeśli projekt ma już serwis powiadomień – użyć go).
9. **Testy (minimum)**:
    - unit: cooldown (spadek do zera), blokada przycisku w trakcie,
    - unit: mapowanie błędów (Email not confirmed → requiresEmailConfirmation),
    - e2e/manual: rejestracja → verify-sent → resend → callback → email-confirmed; login przy niepotwierdzonym → resend.


