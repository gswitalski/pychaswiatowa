# Plan implementacji widoku Rejestracja

## 1. Przegląd
Widok Rejestracji umożliwia nowym użytkownikom założenie konta w aplikacji PychaŚwiatowa. Składa się z formularza, który zbiera adres e-mail, nazwę wyświetlaną oraz hasło. Po pomyślnej walidacji i wysłaniu danych do API, użytkownik jest automatycznie logowany i przekierowywany do panelu głównego aplikacji. Widok ten jest kluczowym elementem pozwalającym na personalizację i zapisywanie prywatnych danych użytkownika.

## 2. Routing widoku
Widok będzie dostępny pod następującą ścieżką:
-   **Ścieżka:** `/register`
-   **Moduł routingu:** Prawdopodobnie `app.routes.ts` lub dedykowany `auth.routes.ts`.
-   **Komponent:** `RegisterPageComponent`

## 3. Struktura komponentów
Hierarchia komponentów dla widoku rejestracji będzie prosta i skupiona na separacji logiki od prezentacji.

```
RegisterPageComponent (Komponent-strona, "smart")
└── RegisterFormComponent (Komponent-formularz, "dumb")
```

-   **`RegisterPageComponent`**: Odpowiada za zarządzanie stanem (ładowanie, błędy), komunikację z `AuthService` oraz nawigację.
-   **`RegisterFormComponent`**: Odpowiada za budowę formularza `ReactiveForm`, walidację pól oraz emisję danych po submicie.

## 4. Szczegóły komponentów
### `pych-register-page`
-   **Opis komponentu:** Główny kontener strony `/register`. Renderuje komponent formularza i zarządza logiką biznesową związaną z procesem rejestracji. Wyświetla globalne komunikaty o błędach (np. zwrócone z API).
-   **Główne elementy:**
    -   `<pych-register-form>`: Komponent podrzędny z formularzem.
    -   Element do wyświetlania błędu API (np. `mat-error` wewnątrz `@if`).
-   **Obsługiwane interakcje:**
    -   `onRegisterSubmit(formData)`: Odbiera dane z `RegisterFormComponent` i inicjuje proces rejestracji poprzez wywołanie `AuthService`.
-   **Obsługiwana walidacja:** Brak. Deleguje walidację do komponentu formularza.
-   **Typy:** `RegisterFormViewModel`, `ApiError`.
-   **Propsy:** Brak.

### `pych-register-form`
-   **Opis komponentu:** Komponent prezentacyjny zawierający formularz rejestracji zbudowany przy użyciu `ReactiveFormsModule`. Jest w pełni reużywalny i nie posiada wiedzy o logice biznesowej.
-   **Główne elementy:**
    -   `<form [formGroup]="form">`
    -   `mat-card` jako kontener.
    -   `mat-form-field` z `mat-input` dla pól: `email`, `displayName`, `password`, `passwordConfirm`.
    -   `mat-button` typu `submit` do wysłania formularza.
    -   Link (`<a>`) z `routerLink` do strony logowania.
-   **Obsługiwane interakcje:**
    -   `submitForm()`: Wywoływana po kliknięciu przycisku. Sprawdza poprawność formularza i emituje zdarzenie `registerSubmit`.
-   **Obsługiwana walidacja (w `ReactiveForm`):**
    -   `email`: `Validators.required`, `Validators.email`.
    -   `displayName`: `Validators.required`, `Validators.minLength(3)`.
    -   `password`: `Validators.required`, `Validators.minLength(8)`.
    -   `passwordConfirm`: `Validators.required`.
    -   **Walidator niestandardowy (na poziomie grupy):** Sprawdza, czy wartość `password` jest identyczna z `passwordConfirm`.
-   **Typy:** `RegisterFormViewModel`.
-   **Propsy (wejścia i wyjścia):**
    -   `@Input() isLoading: boolean`: Blokuje przycisk submit na czas komunikacji z API.
    -   `@Output() registerSubmit = new EventEmitter<RegisterFormViewModel>()`: Emituje poprawne dane formularza.

## 5. Typy
Do implementacji widoku potrzebne będą następujące, nowe typy i interfejsy.

-   **`RegisterFormViewModel`**: Reprezentuje grupę kontrolek `FormControl` dla formularza rejestracji.
    ```typescript
    import { FormControl } from '@angular/forms';

    export interface RegisterFormViewModel {
        email: FormControl<string>;
        displayName: FormControl<string>;
        password: FormControl<string>;
        passwordConfirm: FormControl<string>;
    }
    ```
-   **`SignUpRequestDto`**: Obiekt DTO (Data Transfer Object) używany do komunikacji z API Supabase.
    ```typescript
    import { Credentials } from '@supabase/supabase-js';

    export interface SignUpRequestDto extends Credentials {
        options: {
            data: {
                username: string; // Nazwa wyświetlana jest mapowana na 'username' w Supabase meta data
            }
        }
    }
    ```
-   **`ApiError`**: Uproszczony typ do obsługi błędów z API.
    ```typescript
    export interface ApiError {
        message: string;
        status: number;
    }
    ```

## 6. Zarządzanie stanem
Zarządzanie stanem będzie realizowane lokalnie w `RegisterPageComponent` przy użyciu Angular Signals, zgodnie z najlepszymi praktykami.

-   **Sygnał `state`:**
    ```typescript
    interface RegisterState {
        isLoading: boolean;
        error: ApiError | null;
    }

    // Wewnątrz RegisterPageComponent
    state = signal<RegisterState>({
        isLoading: false,
        error: null,
    });
    ```
-   **Cel:**
    -   `isLoading`: Używany do informowania komponentu `RegisterFormComponent` o trwającej operacji API.
    -   `error`: Przechowuje obiekt błędu z API w celu wyświetlenia go użytkownikowi. Stan jest resetowany przy każdej próbie wysłania formularza.

## 7. Integracja API
Integracja z API Supabase będzie realizowana poprzez dedykowany serwis `AuthService`.

-   **Serwis:** `AuthService`
-   **Metoda do zaimplementowania:** `signUp(credentials: SignUpRequestDto): Promise<AuthResponse>`
-   **Typy żądania:** `SignUpRequestDto` (zdefiniowany w sekcji 5). `email` i `password` są na najwyższym poziomie, a `displayName` jest przekazywany w `options.data.username`.
-   **Typy odpowiedzi:** `AuthResponse` z `@supabase/supabase-js`. Sukces jest sygnalizowany przez `data.user` i `data.session`, a błąd przez pole `error`.
-   **Endpoint:** Metoda `signUp` z klienta Supabase, która docelowo komunikuje się z endpointem `POST /auth/v1/signup`.

## 8. Interakcje użytkownika
-   **Wprowadzanie danych:** Użytkownik wypełnia pola formularza. Błędy walidacji pojawiają się na bieżąco po utracie fokusa przez pole.
-   **Wysłanie formularza:** Kliknięcie przycisku "Zarejestruj się" (aktywnego tylko gdy formularz jest poprawny) powoduje zablokowanie przycisku i rozpoczęcie komunikacji z API.
-   **Sukces:** Użytkownik zostaje przekierowany na stronę `/dashboard`.
-   **Błąd:** Komunikat o błędzie (np. "Użytkownik o tym e-mailu już istnieje") pojawia się na stronie, a formularz jest odblokowywany.
-   **Nawigacja do logowania:** Kliknięcie linku "Masz już konto? Zaloguj się" przenosi użytkownika na stronę `/login`.

## 9. Warunki i walidacja
-   **Przycisk "Zarejestruj się" jest aktywny (`enabled`)** tylko wtedy, gdy cały formularz (`FormGroup`) ma status `VALID`.
-   **Komunikaty o błędach** dla poszczególnych pól (`mat-error`) są wyświetlane, gdy kontrolka jest `INVALID` i została dotknięta (`touched`).
-   **Walidator zgodności haseł** dodaje błąd do kontrolki `passwordConfirm`, jeśli jej wartość nie jest zgodna z wartością kontrolki `password`.
-   **Globalny komunikat o błędzie API** jest wyświetlany tylko wtedy, gdy `state().error` nie jest `null`.

## 10. Obsługa błędów
-   **Błędy walidacji:** Obsługiwane przez `ReactiveFormsModule` i wyświetlane w szablonie `RegisterFormComponent`.
-   **Błędy API (np. email w użyciu, kod 422):** Przechwytywane w `RegisterPageComponent`, zapisywane w sygnale `state` i wyświetlane jako ogólny komunikat błędu nad formularzem.
-   **Błędy sieciowe / serwera (np. brak połączenia, kod 500):** Obsługiwane w ten sam sposób co błędy API, z wyświetleniem generycznego komunikatu, np. "Wystąpił nieoczekiwany błąd. Spróbuj ponownie."

## 11. Kroki implementacji
1.  **Stworzenie plików komponentów:**
    -   `ng generate component pages/register/register-page --standalone`
    -   `ng generate component pages/register/components/register-form --standalone`
2.  **Zdefiniowanie typów:** W odpowiednim pliku (np. `src/app/shared/contracts/types.ts`) dodać interfejsy `RegisterFormViewModel`, `SignUpRequestDto`, `ApiError`.
3.  **Implementacja `RegisterFormComponent`:**
    -   Zbudowanie `ReactiveForm` w klasie komponentu z odpowiednimi walidatorami.
    -   Stworzenie szablonu HTML z użyciem komponentów Angular Material.
    -   Implementacja logiki wyświetlania błędów walidacji.
    -   Dodanie `@Input()` `isLoading` i `@Output()` `registerSubmit`.
4.  **Implementacja `RegisterPageComponent`:**
    -   Stworzenie sygnału `state` do zarządzania stanem.
    -   Implementacja szablonu HTML, który renderuje `<pych-register-form>`.
    -   Bindowanie propsów `isLoading` i nasłuchiwanie na `registerSubmit`.
    -   Wstrzyknięcie `AuthService` i `Router`.
    -   Implementacja metody `onRegisterSubmit`, która komunikuje się z serwisem i obsługuje sukces/błąd.
5.  **Aktualizacja `AuthService`:**
    -   Dodanie metody `signUp(credentials: SignUpRequestDto)`.
6.  **Konfiguracja routingu:**
    -   Dodanie nowej ścieżki `/register` do głównego pliku z routingiem, mapując ją na `RegisterPageComponent`.
7.  **Dodanie triggera SQL w Supabase:**
    -   Utworzenie nowej migracji w Supabase CLI z kodem SQL dla funkcji `handle_new_user` i triggera `on_auth_user_created`.
