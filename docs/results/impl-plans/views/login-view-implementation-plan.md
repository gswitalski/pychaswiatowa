# Plan implementacji widoku logowania

## 1. Przegląd
Widok logowania jest publicznie dostępną stroną, której głównym celem jest umożliwienie istniejącym użytkownikom uwierzytelnienia się w aplikacji. Składa się z formularza, który zbiera adres e-mail i hasło użytkownika. Po pomyślnym zalogowaniu, użytkownik jest przekierowywany do głównego panelu aplikacji (Dashboard). W przypadku niepowodzenia, wyświetlany jest odpowiedni komunikat błędu.

## 2. Routing widoku
Widok będzie dostępny pod następującą ścieżką:
-   `/login`

Dodatkowo, na tę ścieżkę zostanie nałożony guard, który w przypadku, gdy użytkownik jest już zalogowany, automatycznie przekieruje go do `/dashboard`.

## 3. Struktura komponentów
Struktura będzie opierać się na podziale na komponent-kontener (logika) i komponent-prezentacyjny (UI), zgodnie z najlepszymi praktykami Angulara.

```
/login (LoginPageComponent)
└── stbo-login-form (LoginFormComponent)
```

-   `LoginPageComponent`: Komponent "smart", odpowiedzialny za logikę, zarządzanie stanem (ładowanie, błędy) oraz komunikację z `AuthService`. Będzie umieszczony na ścieżce `/login`.
-   `LoginFormComponent`: Komponent "dumb", odpowiedzialny wyłącznie za renderowanie formularza i emitowanie jego wartości. Będzie reużywalny i w pełni sterowany przez komponent nadrzędny.

## 4. Szczegóły komponentów

### `LoginPageComponent`
-   **Opis komponentu**: Główny komponent strony logowania. Orkiestruje proces logowania, zarządza stanem i obsługuje skutki uboczne (nawigacja, obsługa błędów API).
-   **Główne elementy**: Komponent będzie zawierał w swoim szablonie jedynie komponent `<stbo-login-form>`.
-   **Obsługiwane zdarzenia**:
    -   `(login)="handleLogin($event)"`: Odbiera dane z formularza i inicjuje proces logowania poprzez `AuthService`.
-   **Typy**:
    -   `LoginState`: Interfejs do zarządzania stanem widoku (`{ isLoading: boolean; error: string | null; }`).
-   **Propsy (dla komponentu dziecka)**:
    -   `[isLoading]`: Przekazuje do `LoginFormComponent` informację o trwającym procesie logowania.
    -   `[apiError]`: Przekazuje komunikat błędu z API do wyświetlenia w formularzu.

### `LoginFormComponent`
-   **Opis komponentu**: Komponent prezentacyjny, który renderuje formularz logowania za pomocą Angular Material. Zawiera logikę walidacji pól formularza, ale nie posiada wiedzy o procesie logowania.
-   **Główne elementy**:
    -   `<mat-card>`: Główny kontener formularza.
    -   `<form [formGroup]="loginForm">`: Formularz reaktywny.
    -   `<mat-form-field>` z `<input matInput>`: Pola na e-mail i hasło.
    -   `<mat-error>`: Do wyświetlania błędów walidacji.
    -   `<button mat-flat-button color="primary">`: Przycisk do wysłania formularza.
    -   Link `routerLink="/register"` do strony rejestracji.
-   **Obsługiwane zdarzenia**:
    -   `@Output() login = new EventEmitter<SignInRequestDto>()`: Emituje dane logowania po kliknięciu przycisku "Zaloguj", gdy formularz jest poprawny.
-   **Warunki walidacji**:
    -   `email`: `Validators.required`, `Validators.email`.
    -   `password`: `Validators.required`.
-   **Typy**:
    -   `LoginFormViewModel`: Definiuje strukturę `FormGroup`.
    -   `SignInRequestDto`: Typ danych emitowanych przez zdarzenie `login`.
-   **Propsy (przyjmowane od rodzica)**:
    -   `@Input() isLoading: boolean`: Dezaktywuje przycisk i pokazuje wskaźnik ładowania.
    -   `@Input() apiError: string | null`: Wyświetla błąd pochodzący z API.

## 5. Typy

**`LoginFormViewModel`** (ViewModel)
-   **Opis**: Definiuje typ dla `FormGroup` w `LoginFormComponent`, zapewniając bezpieczeństwo typów.
-   **Struktura**:
    ```typescript
    import { FormControl } from '@angular/forms';

    export interface LoginFormViewModel {
        email: FormControl<string>;
        password: FormControl<string>;
    }
    ```

**`SignInRequestDto`** (DTO)
-   **Opis**: Obiekt transferu danych używany do wysłania żądania logowania do API (zgodny z Supabase `signInWithPassword`).
-   **Struktura**:
    ```typescript
    export interface SignInRequestDto {
        email: string;
        password: string;
    }
    ```

**`LoginState`** (Interfejs stanu)
-   **Opis**: Reprezentuje lokalny stan `LoginPageComponent`, zarządzany za pomocą sygnałów.
-   **Struktura**:
    ```typescript
    export interface LoginState {
        isLoading: boolean;
        error: string | null;
    }
    ```

## 6. Zarządzanie stanem
Zarządzanie stanem będzie realizowane lokalnie w `LoginPageComponent` przy użyciu Angular Signals.

```typescript
// W LoginPageComponent
state = signal<LoginState>({ isLoading: false, error: null });

// Aktualizacja stanu przed wywołaniem API
this.state.update(s => ({ ...s, isLoading: true, error: null }));

// Aktualizacja stanu po błędzie API
this.state.update(s => ({ ...s, isLoading: false, error: 'Komunikat błędu' }));
```

Stan `isLoading` oraz `error` będzie przekazywany do `LoginFormComponent` jako propsy.

## 7. Integracja API
Integracja z Supabase będzie obsługiwana przez dedykowany `AuthService` w `src/app/core/services/`.

-   **Serwis**: `AuthService`
-   **Metoda**: `login(credentials: SignInRequestDto): Promise<AuthResponse>`
-   **Implementacja**: Metoda będzie opakowaniem dla wywołania klienta Supabase:
    ```typescript
    return this.supabase.client.auth.signInWithPassword(credentials);
    ```
-   **Typ żądania**: `SignInRequestDto`
-   **Typ odpowiedzi**: `AuthResponse` z biblioteki `@supabase/supabase-js`. W przypadku sukcesu, `error` będzie `null`, a `data.session` i `data.user` będą zdefiniowane. W przypadku błędu, `error` będzie zawierał obiekt `AuthError`.

## 8. Interakcje użytkownika
-   **Wpisywanie danych w formularz**: Użytkownik wypełnia pola e-mail i hasło. Walidacja odbywa się na bieżąco (po utracie fokusu).
-   **Kliknięcie przycisku "Zaloguj się"**:
    -   Jeśli formularz jest nieprawidłowy, przycisk jest nieaktywny, nic się nie dzieje.
    -   Jeśli formularz jest prawidłowy, `LoginFormComponent` emituje zdarzenie `login`.
    -   `LoginPageComponent` odbiera zdarzenie, ustawia `isLoading` na `true` i wywołuje `AuthService.login()`.
    -   Na czas operacji przycisk jest nieaktywny, a w jego miejsce może pojawić się `mat-spinner`.
-   **Pomyślne logowanie**: Użytkownik zostaje przekierowany na ścieżkę `/dashboard`.
-   **Nieudane logowanie**: Wskaźnik ładowania znika, a pod formularzem pojawia się komunikat o błędzie.
-   **Kliknięcie linku "Zarejestruj się"**: Użytkownik zostaje przekierowany na ścieżkę `/register`.

## 9. Warunki i walidacja
-   **Walidacja po stronie klienta (`LoginFormComponent`)**:
    -   `email`: Pole jest wymagane (`Validators.required`). Musi być poprawnym formatem adresu e-mail (`Validators.email`). Komunikaty: "To pole jest wymagane", "Proszę podać poprawny adres e-mail."
    -   `password`: Pole jest wymagane (`Validators.required`). Komunikat: "To pole jest wymagane".
-   **Stan przycisku "Zaloguj się"**: Przycisk jest w stanie `disabled`, dopóki cały `loginForm` nie jest `valid`.

## 10. Obsługa błędów
-   **Błędy walidacji formularza**: Obsługiwane lokalnie w `LoginFormComponent` przez wyświetlanie komunikatów pod odpowiednimi polami.
-   **Błędy API (np. nieprawidłowe dane logowania)**: `AuthService` przechwytuje błąd z Supabase. `LoginPageComponent` ustawia w stanie komunikat błędu (np. "Nieprawidłowy e-mail lub hasło"), który jest przekazywany i wyświetlany w `LoginFormComponent`.
-   **Błędy sieciowe / niedostępność usługi**: `LoginPageComponent` powinien obsłużyć również ten scenariusz, wyświetlając generyczny komunikat, np. "Wystąpił nieoczekiwany błąd. Spróbuj ponownie później."

## 11. Kroki implementacji
1.  **Utworzenie typów**: Zdefiniowanie interfejsów `LoginFormViewModel`, `SignInRequestDto` (jeśli jeszcze nie istnieje globalnie) i `LoginState` w odpowiednich plikach.
2.  **Modyfikacja `AuthService`**: Dodanie metody `login(credentials: SignInRequestDto)` w `src/app/core/services/auth.service.ts`, która będzie komunikować się z Supabase.
3.  **Utworzenie `LoginFormComponent`**:
    -   Wygenerowanie komponentu: `ng g c pages/login/components/login-form --standalone`.
    -   Zaimplementowanie szablonu HTML z `mat-card` i polami formularza (`mat-form-field`, `mat-input`).
    -   Zbudowanie `FormGroup` w oparciu o `LoginFormViewModel` z odpowiednimi walidatorami.
    -   Dodanie `@Input()` dla `isLoading` i `apiError` oraz `@Output()` dla zdarzenia `login`.
    -   Dodanie logiki do szablonu, aby dezaktywować przycisk i wyświetlać błędy.
4.  **Utworzenie `LoginPageComponent`**:
    -   Wygenerowanie komponentu: `ng g c pages/login/login-page --standalone`.
    -   Zdefiniowanie sygnału do zarządzania stanem (`LoginState`).
    -   Wstrzyknięcie `AuthService` i `Router`.
    -   Implementacja metody `handleLogin`, która wywołuje serwis i obsługuje odpowiedź (sukces/błąd).
    -   Dodanie `LoginFormComponent` do szablonu i powiązanie propsów oraz zdarzeń.
5.  **Konfiguracja routingu**:
    -   W głównym pliku `app.routes.ts` dodać nową ścieżkę:
        ```typescript
        {
            path: 'login',
            loadComponent: () => import('./pages/login/login-page.component').then(m => m.LoginPageComponent),
            // canActivate: [redirectIfLoggedInGuard] // do dodania w przyszłości
        }
        ```
6.  **Stylowanie**: Dostosowanie stylów (SCSS) dla `LoginPageComponent` i `LoginFormComponent`, aby wycentrować formularz na stronie i zapewnić odpowiednie marginesy.
