# Logowanie przez Google — plan UI

## 1. Zmieniony widok: logowanie

**Ścieżka:** `/login`  
**Istniejący obszar implementacji:** `src/app/pages/auth/login/`

Widok zachowuje istniejący formularz email + hasło. Dodawana jest sekcja alternatywnego logowania przez OAuth, umieszczona **poniżej** przycisku „Zaloguj się" i **powyżej** linków pomocniczych (rejestracja, reset hasła).

### Nowe elementy

| Element | Opis |
|---|---|
| Separator „lub" | Wizualne oddzielenie formularza email+hasło od przycisku OAuth. Linia pozioma z tekstem „lub" pośrodku, realizowana przez `<mat-divider>` z nadpisaną stylizacją lub czystym CSS/SCSS. |
| Przycisk „Zaloguj się przez Google" | Pełnowymiarowy przycisk (`mat-stroked-button`) o szerokości całego formularza. Po lewej stronie logo Google (SVG inline lub jako `<img>` z `src/assets/icons/google-logo.svg`). Tekst: „Zaloguj się przez Google". |
| Stan ładowania przycisku | Po kliknięciu w przycisku pojawia się `<mat-spinner>` (rozmiar 20px), tekst przycisku znika, przycisk jest zablokowany. Formularz email+hasło pozostaje aktywny. |
| Komunikat błędu OAuth | `<mat-error>` lub `<mat-card>` z ikoną ostrzeżenia, widoczny tylko gdy parametr URL zawiera błąd z callbacku (np. `?error=access_denied`). Tekst dostosowany do kodu błędu. |

### Zachowanie

1. Kliknięcie przycisku wywołuje metodę serwisu autoryzacji, która inicjuje redirect OAuth do Google.
2. Formularz email+hasło i przycisk Google nie są blokowane wzajemnie — działają niezależnie.
3. Jeśli użytkownik wróci na `/login` po anulowaniu autoryzacji Google, nie jest wyświetlany żaden błąd.
4. Jeśli URL zawiera `?error=access_denied` (lub inny kod błędu OAuth), wyświetlany jest odpowiedni komunikat.

---

## 2. Zmieniony widok: rejestracja

**Ścieżka:** `/register`  
**Istniejący obszar implementacji:** `src/app/pages/auth/register/`

Zmiany są analogiczne jak na ekranie logowania. Przycisk OAuth jest umieszczony poniżej przycisku „Utwórz konto" i powyżej linku „Masz już konto? Zaloguj się".

### Nowe elementy

| Element | Opis |
|---|---|
| Separator „lub" | Identyczny jak na `/login`. |
| Przycisk „Zarejestruj się przez Google" | Identyczny wygląd jak na `/login`, ale tekst brzmi „Zarejestruj się przez Google". Prowadzi do tego samego flow OAuth (Supabase nie rozróżnia rejestracji od logowania przez OAuth). |
| Stan ładowania i błędy | Identyczne zachowanie jak na `/login`. |

> **Uwaga UX:** Oba przyciski (na `/login` i `/register`) inicjują identyczny flow OAuth. Różnią się jedynie etykietą, dostosowaną do kontekstu strony.

---

## 3. Nowy widok: uzupełnienie profilu

**Ścieżka:** `/auth/complete-profile`  
**Nowy obszar implementacji:** `src/app/pages/auth/complete-profile/`

Widok jest wyświetlany **tylko** użytkownikom, którzy właśnie zalogowali się przez Google i nie mają jeszcze `username` w tabeli `profiles`. Chroniony guardem — bez aktywnej sesji Supabase i bez flagi `needsCompleteProfile` redirect do `/login`.

### Układ strony

Widok jest zrealizowany w tym samym stylu co ekrany logowania i rejestracji (strona bez App Shell: brak Sidebara, Topbara i Footera z nawigacją). Wyśrodkowany kontener `<mat-card>` o maksymalnej szerokości `480px`.

### Zawartość

| Element | Opis |
|---|---|
| Nagłówek karty | Logo aplikacji PychaŚwiatowa (identyczne jak na `/login`). |
| Tytuł | „Uzupełnij profil" jako `<mat-card-title>`. |
| Podtytuł / informacja | Krótki tekst: „Twoje konto Google zostało połączone. Wybierz nazwę użytkownika, aby dokończyć konfigurację." Opcjonalnie adres e-mail z Google wyświetlony jako `<mat-chip>` (readonly) dla potwierdzenia tożsamości. |
| Pole `username` | `<mat-form-field>` z `<input matInput>`. Label: „Nazwa użytkownika". Hint: „3–50 znaków, tylko litery, cyfry i podkreślenia". Walidacja synchroniczna (długość, dozwolone znaki) i asynchroniczna (unikalność — request do API). |
| Przycisk zapisu | `mat-flat-button` (kolor primary), pełna szerokość. Tekst: „Zapisz i przejdź do aplikacji". Zablokowany gdy formularz jest nieważny lub trwa zapisywanie. |
| Stan zapisywania | Spinner w przycisku, pola zablokowane. |
| Błąd unikalności | `<mat-error>` pod polem: „Ta nazwa użytkownika jest już zajęta." |
| Błąd serwera | Snackbar lub inline error card: „Wystąpił błąd. Spróbuj ponownie." |

### Stany widoku

| Stan | Zachowanie |
|---|---|
| Ładowanie sesji | Spinner na całej karcie, zanim dane z Supabase zostaną zweryfikowane. |
| Brak sesji OAuth | Guard przekierowuje na `/login`. |
| Formularz pusty | Przycisk zapisu nieaktywny. |
| Walidacja kliencka | Błędy inline pod polem `username` po `blur`. |
| Sprawdzanie unikalności | Debounced request (400ms) do API; ikona loadera w `mat-suffix` pola. |
| Zapisywanie | Przycisk i pole zablokowane, spinner w przycisku. |
| Sukces | Redirect na `/dashboard`. |
| Błąd (zajęty username) | Inline error pod polem, przycisk odblokowany. |
| Błąd serwera | Snackbar z komunikatem ogólnym. |

### Przepływ użytkownika

1. Użytkownik autoryzuje się przez Google na stronie `/login` lub `/register`.
2. Supabase przetwarza callback i tworzy sesję.
3. Handler callbacku (`/auth/callback`) sprawdza, czy profil ma `username`.
4. Brak `username` → redirect na `/auth/complete-profile`.
5. Użytkownik wpisuje `username`, walidacja przechodzi.
6. Kliknięcie „Zapisz i przejdź do aplikacji" wysyła request do API.
7. API zapisuje `username` w tabeli `profiles`.
8. Redirect na `/dashboard`.

---

## 4. Komponenty globalne — brak zmian

Istniejący handler callbacku (`/auth/callback`) wymaga rozszerzenia logiki (patrz plan API), ale widok jako taki (spinner + obsługa URL) pozostaje bez zmian wizualnych.

---

## 5. Wytyczne dot. dostępności (a11y)

| Element | Wymóg |
|---|---|
| Przycisk Google | `aria-label="Zaloguj się przez Google"` lub `aria-label="Zarejestruj się przez Google"`. |
| Logo Google w przycisku | `<img alt="Google">` lub `aria-hidden="true"` gdy obok jest tekst. |
| Separator „lub" | `aria-hidden="true"` — element dekoracyjny. |
| Spinner ładowania | `role="status"` z `aria-label="Logowanie w toku"` lub `aria-live="polite"` na komunikacie. |
| Pole `username` | Powiązanie `<label>` z `id` pola, komunikaty błędów przez `aria-describedby`. |

---

## 6. Responsywność

Nowe elementy (przycisk Google, separator, ekran `/auth/complete-profile`) stosują się do istniejącego systemu responsywności aplikacji:

- Na urządzeniach mobilnych przycisk jest pełnej szerokości kontenera (identycznie jak istniejące przyciski formularza).
- Ekran `/auth/complete-profile` używa identycznego układu co `/login` i `/register` — wyśrodkowany `<mat-card>` z marginesami bocznymi na mobile.
