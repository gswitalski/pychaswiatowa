# Plan implementacji widoku Profile Settings

## 1. Przegląd
Celem jest wdrożenie pełnego widoku ustawień profilu pod ścieżką `/settings` w prywatnym App Shell, tak aby zalogowany użytkownik mógł:

- odczytać adres e-mail jako pole tylko do odczytu,
- edytować nazwę wyświetlaną opartą o istniejące pole `username`,
- zarządzać bieżącą zgodą marketingową,
- bezpiecznie zmienić hasło w osobnym modalu bez opuszczania strony.

Zakres pracy po stronie frontendu nie polega na projektowaniu API od zera, ponieważ repo zawiera już:

- gotowy routing do ścieżki `/settings` w `src/app/app.routes.ts`,
- istniejący serwis `src/app/core/services/profile-settings-api.service.ts`,
- istniejące kontrakty `ProfileSettingsDto`, `UpdateProfileSettingsCommand`, `ChangePasswordCommand` i `ChangePasswordResponseDto` w `shared/contracts/types.ts`,
- backendowy endpoint `profile` oraz `profile/change-password`.

Najważniejszy rzeczywisty brak w aplikacji to widok UI. Obecnie trasa `/settings` ładuje `DashboardPageComponent`, więc trzeba zastąpić placeholder docelową stroną ustawień profilu.

Widok powinien realizować dwie historie użytkownika:

- `US-PS-001` przez formularz danych konta i zapis `username + marketing_consent` jedną akcją,
- `US-PS-002` przez osobny modal zmiany hasła z walidacją starego hasła, nowego hasła i potwierdzenia.

## 2. Routing widoku

### Docelowa ścieżka
- `/settings`

### Aktualny stan projektu
- Routing prywatnych widoków jest skonfigurowany w `src/app/app.routes.ts` w grupie `MainLayoutComponent`.
- Pozycja „Ustawienia” jest już widoczna w nawigacji.
- Trasa `/settings` istnieje, ale błędnie ładuje `DashboardPageComponent`.

### Wymagana zmiana routingu
- W `src/app/app.routes.ts` podmienić `loadComponent` dla `path: 'settings'`.
- Docelowo trasa powinna ładować nowy standalone page component, np.:
  - `src/app/pages/settings/profile-settings-page.component.ts`
- `data.breadcrumb: 'Ustawienia'` może pozostać bez zmian.

### Rekomendowana struktura katalogu
- `src/app/pages/settings/profile-settings-page.component.ts`
- `src/app/pages/settings/profile-settings-page.component.html`
- `src/app/pages/settings/profile-settings-page.component.scss`
- `src/app/pages/settings/components/profile-settings-form/profile-settings-form.component.ts`
- `src/app/pages/settings/components/profile-settings-form/profile-settings-form.component.html`
- `src/app/pages/settings/components/profile-settings-form/profile-settings-form.component.scss`
- `src/app/pages/settings/components/change-password-dialog/change-password-dialog.component.ts`
- `src/app/pages/settings/components/change-password-dialog/change-password-dialog.component.html`
- `src/app/pages/settings/components/change-password-dialog/change-password-dialog.component.scss`
- `src/app/pages/settings/services/profile-settings.facade.ts`

## 3. Struktura komponentów

Rekomendowane drzewo komponentów:

```text
ProfileSettingsPageComponent
|- PageHeaderComponent
|- mat-card "Dane konta"
|  \- ProfileSettingsFormComponent
|- mat-card "Bezpieczeństwo"
|  \- button "Zmień hasło"
|- inline error / empty-state / loading state
\- ChangePasswordDialogComponent (MatDialog overlay)
```

Podział odpowiedzialności:

- `ProfileSettingsPageComponent` odpowiada za pobranie danych, zszycie stanu, otwieranie modalu oraz komunikaty sukcesu/błędu.
- `ProfileSettingsFormComponent` odpowiada za formularz danych konta i walidację `username` oraz zgody marketingowej.
- `ChangePasswordDialogComponent` odpowiada za osobny formularz bezpieczeństwa i flow zmiany hasła.

## 4. Szczegóły komponentów

### `ProfileSettingsPageComponent`
- **Opis komponentu**: główny kontener widoku `/settings`. Ładuje dane profilu po wejściu na stronę, renderuje sekcję „Dane konta” i sekcję „Bezpieczeństwo”, zarządza stanami `loading`, `error`, `saving` oraz otwiera modal zmiany hasła.
- **Główne elementy HTML i komponenty dzieci**:
  - `pych-page-header` z tytułem „Ustawienia”
  - `mat-card` dla sekcji „Dane konta”
  - `pych-profile-settings-form`
  - `mat-card` dla sekcji „Bezpieczeństwo”
  - `button mat-stroked-button` lub `button mat-raised-button` dla akcji „Zmień hasło”
  - opcjonalny `mat-progress-bar` albo skeleton w stanie ładowania
  - blok błędu ładowania z przyciskiem ponowienia
- **Obsługiwane zdarzenia**:
  - inicjalne pobranie profilu po wejściu na trasę
  - `saveProfile` emitowane z formularza danych konta
  - kliknięcie „Zmień hasło”
  - ponowne pobranie danych po błędzie ładowania
- **Warunki walidacji**:
  - nie renderować formularza przed zakończeniem pierwszego `GET /profile`
  - przy aktywnym ładowaniu lub zapisie nie dopuszczać do wielokrotnego wysłania tego samego żądania
  - po błędzie `GET /profile` pokazać pełny stan błędu zamiast pustego formularza
- **Typy**:
  - `ProfileSettingsDto`
  - `UpdateProfileSettingsCommand`
  - `ChangePasswordCommand`
  - lokalny `ProfileSettingsPageState`
  - lokalny `ProfileSettingsFormValue`
- **Propsy**:
  - brak; komponent routowalny

### `ProfileSettingsFormComponent`
- **Opis komponentu**: prezentacyjny formularz sekcji „Dane konta”. Renderuje pole e-mail tylko do odczytu, pole `username`, kontrolkę zgody marketingowej i przycisk zapisu.
- **Główne elementy HTML i komponenty dzieci**:
  - `form [formGroup]`
  - `mat-form-field` z kontrolką `email` w trybie `readonly`
  - `mat-form-field` z kontrolką `username`
  - `mat-slide-toggle` albo `mat-checkbox` dla `marketingConsent`
  - tekst pomocniczy pod polem e-mail
  - przycisk `button mat-raised-button type="submit"` „Zapisz zmiany”
  - opcjonalny blok błędu sekcji
- **Obsługiwane zdarzenia**:
  - zmiana `username`
  - zmiana `marketingConsent`
  - submit formularza
- **Warunki walidacji**:
  - `email` jest read-only i nie może być modyfikowany
  - `username` wymagane, po `trim`, długość `3-50`
  - formularz nie wysyła pustego update’u, gdy nie ma zmian
  - przycisk zapisu aktywny tylko gdy formularz jest `dirty`, poprawny i nie trwa zapis
  - `marketingConsent` mapować na `boolean`
  - `marketing_consent_text_version` nie powinno być osobnym polem formularza; ma być dołączane technicznie przy zapisie przez warstwę page/facade jako stała wersja kontraktu
- **Typy**:
  - `ProfileSettingsDto`
  - `ProfileSettingsFormValue`
  - `UpdateProfileSettingsCommand`
- **Propsy**:
  - `profile: ProfileSettingsDto | null`
  - `isLoading: boolean`
  - `isSaving: boolean`
  - `submitError: string | null`
  - `saveLabel?: string`

### `ChangePasswordDialogComponent`
- **Opis komponentu**: modal Angular Material uruchamiany z sekcji „Bezpieczeństwo”. Formularz zmiany hasła musi być odseparowany od formularza danych konta.
- **Główne elementy HTML i komponenty dzieci**:
  - `mat-dialog-title`
  - `mat-dialog-content`
  - `form [formGroup]`
  - `mat-form-field` dla `currentPassword`
  - `mat-form-field` dla `newPassword`
  - `mat-form-field` dla `confirmNewPassword`
  - przyciski `Anuluj` i `Zapisz nowe hasło`
  - opcjonalne ikony pokaż/ukryj hasło, jeśli taki wzorzec jest już używany w aplikacji
- **Obsługiwane zdarzenia**:
  - wpisanie bieżącego hasła
  - wpisanie nowego hasła
  - wpisanie potwierdzenia nowego hasła
  - submit formularza
  - anulowanie i zamknięcie modalu
- **Warunki walidacji**:
  - wszystkie pola wymagane
  - `newPassword` i `confirmNewPassword` muszą być identyczne
  - `newPassword` nie może być takie samo jak `currentPassword`
  - UI powinien stosować tę samą podstawową politykę hasła co formularz rejestracji, czyli co najmniej 6 znaków
  - backend pozostaje źródłem prawdy dla pełnej polityki hasła i weryfikacji starego hasła
  - przy aktywnym submit zablokować ponowne wysłanie i zamknięcie przez drugie kliknięcie CTA
- **Typy**:
  - `ChangePasswordCommand`
  - `ChangePasswordResponseDto`
  - lokalny `ChangePasswordFormValue`
- **Propsy**:
  - `MAT_DIALOG_DATA`: opcjonalnie brak danych wejściowych
  - ewentualnie `initialError?: string | null`, jeśli zespół stosuje taki wzorzec dla dialogów

## 5. Typy

### Typy istniejące do wykorzystania
- `ProfileSettingsDto`
  - `id: string`
  - `email: string`
  - `username: string`
  - `marketing_consent: boolean`
  - `marketing_consent_updated_at: string | null`
  - `marketing_consent_text_version: MarketingConsentTextVersion | null`
- `UpdateProfileSettingsCommand`
  - `username: string`
  - `marketing_consent: boolean`
  - `marketing_consent_text_version: MarketingConsentTextVersion | null`
- `ChangePasswordCommand`
  - `current_password: string`
  - `new_password: string`
- `ChangePasswordResponseDto`
  - `status: 'ok'`
  - `message: string`

### Typy lokalne rekomendowane dla widoku
- `interface ProfileSettingsFormValue`
  - `email: string`
  - `username: string`
  - `marketingConsent: boolean`
- `interface ChangePasswordFormValue`
  - `currentPassword: string`
  - `newPassword: string`
  - `confirmNewPassword: string`
- `interface ProfileSettingsPageState`
  - `profile: ProfileSettingsDto | null`
  - `isInitialLoading: boolean`
  - `isSavingProfile: boolean`
  - `loadError: string | null`
  - `saveError: string | null`
- `interface ChangePasswordUiState`
  - `isSubmitting: boolean`
  - `submitError: string | null`

### Wniosek projektowy
Nie ma potrzeby tworzenia nowych współdzielonych DTO w `shared/contracts/types.ts`, ponieważ kontrakty API już istnieją. Nowe typy powinny być wyłącznie lokalnymi modelami UI i ViewModelami dla formularzy oraz stanu strony.

## 6. Zarządzanie stanem

### Rekomendowany wzorzec
Zgodnie z regułami projektu stan powinien być oparty o Angular signals, bez rozbudowanego NgRx dla tak małego widoku.

### Proponowana warstwa pośrednia
Utworzyć page-specific facade, np. `src/app/pages/settings/services/profile-settings.facade.ts`, która:

- wstrzykuje `ProfileSettingsApiService`,
- przechowuje stan strony w sygnałach,
- mapuje `ProfileSettingsDto` na wartości formularza,
- dostarcza metody `loadProfile()`, `saveProfile()`, `changePassword()`.

### Proponowane sygnały
- `profile = signal<ProfileSettingsDto | null>(null)`
- `isInitialLoading = signal<boolean>(true)`
- `isSavingProfile = signal<boolean>(false)`
- `loadError = signal<string | null>(null)`
- `saveError = signal<string | null>(null)`
- `lastSuccessMessage = signal<string | null>(null)`

### Computed
- `canRenderForm = computed(() => !!profile() && !isInitialLoading())`
- `accountFormInitialValue = computed<ProfileSettingsFormValue | null>(...)`

### Czy potrzebny jest custom hook
Nie. W Angularze odpowiednikiem custom hooka powinien być lokalny facade/store oparty o `signals` i `inject()`. To wystarczy dla tego widoku i lepiej pasuje do struktury projektu niż globalny store.

### Zasady aktualizacji stanu
- po `GET /profile` uzupełnić stan bazowy formularza,
- po `PUT /profile` zaktualizować `profile` odpowiedzią serwera i zresetować stan `dirty`,
- po `POST /profile/change-password` nie odświeżać całej strony; wystarczy snackbar i zamknięcie modalu,
- przy ponownym ładowaniu lub zapisie używać `state.update()` i utrzymywać poprzednie dane widoczne, aby uniknąć „flash” UI.

## 7. Integracja API

### Zasada architektoniczna
Frontend nie może wykonywać bezpośrednich operacji `supabase.from(...)`. Integracja ma korzystać z istniejącego `ProfileSettingsApiService`, który używa `supabase.functions.invoke(...)`.

### Endpoint 1: `GET /profile`
- **Metoda w serwisie**: `getProfileSettings()`
- **Typ odpowiedzi**: `Observable<ProfileSettingsDto>`
- **Cel użycia**: inicjalne pobranie danych do widoku `/settings`
- **Moment wywołania**: przy wejściu na stronę i opcjonalnie po ręcznym retry stanu błędu

### Endpoint 2: `PUT /profile`
- **Metoda w serwisie**: `updateProfileSettings(command: UpdateProfileSettingsCommand)`
- **Typ żądania**: `UpdateProfileSettingsCommand`
- **Typ odpowiedzi**: `Observable<ProfileSettingsDto>`
- **Mapowanie z formularza**:
  - `username <- form.username.trim()`
  - `marketing_consent <- form.marketingConsent`
  - `marketing_consent_text_version <- MARKETING_CONSENT_TEXT_VERSION`

### Istotna decyzja kontraktowa dla zgody marketingowej
Aktualna implementacja backendu waliduje `marketing_consent_text_version` jako niepusty string w `PUT /profile`. Frontend powinien więc zawsze wysyłać stałą wersję tekstu zgody, korzystając z tego samego źródła co rejestracja, np. `MARKETING_CONSENT_TEXT_VERSION`.

### Endpoint 3: `POST /profile/change-password`
- **Metoda w serwisie**: `changePassword(command: ChangePasswordCommand)`
- **Typ żądania**: `ChangePasswordCommand`
- **Typ odpowiedzi**: `Observable<ChangePasswordResponseDto>`
- **Mapowanie z formularza modalu**:
  - `current_password <- form.currentPassword`
  - `new_password <- form.newPassword`
  - `confirmNewPassword` pozostaje wyłącznie walidacją UI i nie trafia do API

### Komunikaty sukcesu
- po `PUT /profile`: „Zmiany profilu zostały zapisane.”
- po `POST /profile/change-password`: „Hasło zostało zmienione.”

## 8. Interakcje użytkownika

### Wejście na `/settings`
- użytkownik widzi stan ładowania,
- po sukcesie widzi bieżące dane konta,
- po błędzie widzi komunikat i akcję „Spróbuj ponownie”.

### Edycja danych konta
- użytkownik może zmienić `username`,
- użytkownik może włączyć lub wyłączyć zgodę marketingową,
- użytkownik może zmienić oba pola jednocześnie,
- przy pierwszej zmianie formularz przechodzi w stan `dirty`,
- przycisk „Zapisz zmiany” aktywuje się dopiero, gdy formularz ma zmiany i jest poprawny,
- po sukcesie wartości pozostają na ekranie jako nowy stan bazowy.

### Odczyt e-maila
- e-mail jest widoczny, ale nieedytowalny,
- pole nadal powinno umożliwiać zaznaczenie i skopiowanie wartości.

### Zmiana hasła
- kliknięcie „Zmień hasło” otwiera dialog,
- użytkownik wpisuje stare hasło, nowe hasło i potwierdzenie,
- przy niezgodności nowego hasła i potwierdzenia formularz nie może zostać wysłany,
- po sukcesie modal zamyka się, a użytkownik pozostaje zalogowany,
- po błędzie modal pozostaje otwarty i zachowuje dane wpisane przez użytkownika poza polami, które zespół zdecyduje się świadomie czyścić ze względów bezpieczeństwa.

## 9. Warunki i walidacja

### Walidacja formularza danych konta
- `username`:
  - wymagane,
  - `trim`,
  - minimum `3` znaki,
  - maksimum `50` znaków
- `marketingConsent`:
  - typ `boolean`,
  - brak dodatkowej walidacji biznesowej po stronie UI
- `email`:
  - bez edycji,
  - bez wysyłania do `PUT /profile`

### Walidacja formularza zmiany hasła
- `currentPassword`:
  - wymagane,
  - nie może być puste
- `newPassword`:
  - wymagane,
  - minimum `6` znaków, aby zachować zgodność z aktualnym formularzem rejestracji
  - nie może być identyczne z `currentPassword`
- `confirmNewPassword`:
  - wymagane,
  - musi być identyczne z `newPassword`

### Walidacja zachowania UI
- nie wysyłać `PUT /profile`, jeśli formularz nie ma zmian,
- nie wysyłać `POST /profile/change-password`, jeśli formularz jest niepoprawny,
- blokować wielokrotny submit przy aktywnym requestcie,
- zachować wpisane dane po błędzie zapisu profilu,
- w przypadku walidacji backendowej zmapować błędy możliwie blisko pól.

### Warunki wymagane przez API
- `PUT /profile` oczekuje pełnego snapshotu pól edytowalnych, nie częściowego patcha,
- `PUT /profile` wymaga `marketing_consent_text_version`,
- `POST /profile/change-password` nie przyjmuje `confirm_password`,
- `POST /profile/change-password` zwróci błąd, jeśli stare hasło jest niepoprawne albo nowe nie spełnia polityki backendu.

## 10. Obsługa błędów

### Błędy ładowania widoku
- `401 Unauthorized`:
  - przekazać do istniejącego flow auth aplikacji; jeśli lokalna obsługa jest potrzebna, pokazać komunikat o wygaśniętej sesji i przekierować na login
- `404 Not Found`:
  - pokazać komunikat typu „Nie udało się wczytać ustawień profilu.”
- błędy sieciowe:
  - pełny stan błędu z przyciskiem retry

### Błędy zapisu profilu
- `400 Bad Request`:
  - jeśli backend zwraca błędy pól, przypiąć je do formularza
- `409 Conflict`:
  - zmapować na błąd pola `username`, np. „Ta nazwa użytkownika jest już zajęta.”
- `422 Unprocessable Entity`:
  - pokazać komunikat sekcyjny związany z niespójnym payloadem zgody marketingowej
- inne błędy:
  - snackbar albo alert inline z komunikatem ogólnym

### Błędy zmiany hasła
- `400 Bad Request`:
  - zmapować na reguły hasła i pokazać komunikat inline
- `422 Unprocessable Entity`:
  - potraktować jako błąd `currentPassword`, np. „Podane stare hasło jest niepoprawne.”
- `401 Unauthorized`:
  - zamknąć dialog lub pozostawić go z komunikatem o wygaśniętej sesji oraz przekierować użytkownika do logowania
- błędy sieciowe:
  - pozostawić modal otwarty, pokazać komunikat, nie tracić wpisanego kontekstu

### Edge-case’y
- brak pól marketingowych w odpowiedzi `GET /profile` traktować jak `marketing_consent = false`,
- zamknięcie modalu z niezapisanymi danymi może działać bez dodatkowego confirm dialogu w MVP,
- przy responsywnych szerokościach układ ma pozostać jednokolumnowy i czytelny.

## 11. Kroki implementacji

1. Utworzyć nowy page component `src/app/pages/settings/profile-settings-page.component.ts` jako standalone z `ChangeDetectionStrategy.OnPush`.
2. Podmienić trasę `/settings` w `src/app/app.routes.ts`, aby ładowała `ProfileSettingsPageComponent` zamiast `DashboardPageComponent`.
3. Dodać lokalny facade `src/app/pages/settings/services/profile-settings.facade.ts` oparty o `signals` i `inject()`.
4. Zaimplementować stan ładowania danych z `getProfileSettings()` oraz pełny stan błędu z akcją retry.
5. Utworzyć `ProfileSettingsFormComponent` z reactive forms, `mat-form-field`, kontrolką read-only dla e-maila i kontrolką zgody marketingowej.
6. Podpiąć mapowanie formularza do `updateProfileSettings()` z użyciem stałej `MARKETING_CONSENT_TEXT_VERSION`.
7. Dodać logikę resetu stanu `dirty` po udanym zapisie, tak aby przycisk zapisu wracał do stanu nieaktywnego.
8. Dodać sekcję „Bezpieczeństwo” na stronie i przycisk otwierający modal `ChangePasswordDialogComponent`.
9. Zaimplementować `ChangePasswordDialogComponent` jako `MatDialog` z osobnym reactive form oraz walidacją zgodności haseł, minimalnej długości i różnicy między starym a nowym hasłem.
10. Podpiąć modal do `changePassword()` oraz obsługę sukcesu i błędów bez przeładowywania całej strony.
11. Ujednolicić komunikaty użytkownika:
    - sukces zapisu profilu,
    - sukces zmiany hasła,
    - błąd pobierania danych,
    - błąd zajętego `username`,
    - błąd niepoprawnego starego hasła.
12. Zaimplementować responsywne style widoku:
    - desktop: dwie logiczne sekcje jako osobne karty,
    - mobile/tablet: układ jednokolumnowy, pełna szerokość pól i przycisków.
13. Dodać testy jednostkowe:
    - `ProfileSettingsFormComponent`: walidacja `username`, stan `dirty`, blokada submitu bez zmian,
    - `ChangePasswordDialogComponent`: zgodność haseł, blokada submitu, mapowanie błędów,
    - `ProfileSettingsPageComponent` lub facade: `load`, `save`, `retry`, `open dialog`.
14. Dodać testy serwisu/facady z mockowanym `ProfileSettingsApiService`, aby potwierdzić poprawne payloady dla `PUT /profile` i `POST /profile/change-password`.
15. Dodać test E2E lub scenariusz manualny obejmujący:
    - wejście na `/settings`,
    - zmianę `username`,
    - zmianę zgody marketingowej,
    - błąd starego hasła,
    - sukces zmiany hasła.
