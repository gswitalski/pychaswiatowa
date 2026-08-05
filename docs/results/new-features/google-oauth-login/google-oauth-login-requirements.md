# Logowanie przez Google — wymagania

## 1. Cel

Umożliwienie użytkownikom rejestracji i logowania za pomocą konta Google (OAuth 2.0) jako alternatywy dla istniejącego formularza email + hasło.

Funkcja rozszerza ekrany logowania (`/login`) i rejestracji (`/register`) o przycisk „Zaloguj się przez Google". Po udanej autoryzacji przez Google użytkownik jest automatycznie logowany. Jeśli konto z danym adresem Gmail nie istnieje jeszcze w systemie, zostaje utworzone. Przy pierwszym logowaniu przez Google, gdy profil nie ma jeszcze nazwy użytkownika, pojawia się dodatkowy ekran uzupełnienia profilu (`/auth/complete-profile`).

---

## 2. Zakres funkcjonalny

1. Na ekranie logowania (`/login`) i ekranie rejestracji (`/register`) dostępny jest przycisk „Zaloguj się przez Google".
2. Po kliknięciu przycisku użytkownik jest przekierowywany do strony autoryzacji Google (OAuth 2.0 Authorization Code Flow).
3. Po powrocie z Google:
    - jeśli konto z danym e-mailem już istnieje (założone przez email+hasło), Supabase automatycznie scala tożsamości (link identity), a użytkownik otrzymuje dostęp do istniejącego konta,
    - jeśli konto nie istnieje, jest tworzone automatycznie z e-mailem zweryfikowanym przez Google (brak kroku weryfikacji e-mail),
    - jeśli jest to pierwsze logowanie przez Google i profil nie ma `username`, użytkownik trafia na ekran `/auth/complete-profile`,
    - w przeciwnym razie użytkownik trafia na `/dashboard`.
4. Konta zakładane przez Google są od razu w pełni aktywne — pominięcie procesu weryfikacji e-mail wynika z faktu, że Google gwarantuje zweryfikowany adres.
5. Użytkownik logujący się przez Google może w ustawieniach (`/settings`) nadal ustawić hasło, jeśli chce korzystać z logowania email+hasło na tym samym koncie.

---

## 3. Historyjki użytkownika

### US-OAUTH-001 — Rejestracja i logowanie przez Google (ścieżka nowego użytkownika)

**Jako** nowy użytkownik nieposiadający jeszcze konta w PychaŚwiatowa  
**chcę** kliknąć „Zaloguj się przez Google" na ekranie logowania lub rejestracji  
**aby** szybko założyć konto bez wypełniania formularza rejestracyjnego.

#### Kryteria akceptacji

1. Przycisk „Zaloguj się przez Google" jest widoczny na ekranach `/login` i `/register`, poniżej istniejącego formularza, oddzielony separatorem „lub".
2. Po kliknięciu przeglądarka przekierowuje na stronę wyboru konta Google.
3. Po wybraniu konta Google i udzieleniu zgody przeglądarka wraca do aplikacji pod adres `/auth/callback`.
4. Aplikacja tworzy nowe konto użytkownika z e-mailem pobranym z profilu Google; konto jest natychmiast aktywne.
5. Ponieważ nowe konto nie ma jeszcze `username`, aplikacja przekierowuje na `/auth/complete-profile`.
6. Po uzupełnieniu i zapisaniu `username` użytkownik trafia na `/dashboard`.
7. W przypadku odmowy zgody na stronie Google lub zamknięcia okna użytkownik wraca na ekran `/login` z neutralnym komunikatem (bez traktowania tego jako błąd).

---

### US-OAUTH-002 — Logowanie przez Google (ścieżka powracającego użytkownika)

**Jako** zarejestrowany użytkownik mający już `username` w profilu  
**chcę** kliknąć „Zaloguj się przez Google"  
**aby** zalogować się jednym kliknięciem bez podawania hasła.

#### Kryteria akceptacji

1. Po autoryzacji przez Google aplikacja rozpoznaje istniejący profil (pasujące `auth.users.id`).
2. Użytkownik jest logowany bezpośrednio i trafia na `/dashboard`.
3. Ekran `/auth/complete-profile` nie jest wyświetlany, ponieważ profil ma już `username`.

---

### US-OAUTH-003 — Scalanie konta Google z istniejącym kontem email+hasło

**Jako** użytkownik zarejestrowany wcześniej przez email+hasło  
**chcę** kliknąć „Zaloguj się przez Google" używając tego samego adresu Gmail  
**aby** uzyskać dostęp do swojego istniejącego konta bez tworzenia duplikatu.

#### Kryteria akceptacji

1. Supabase automatycznie rozpoznaje, że adres e-mail Google odpowiada istniejącemu kontu.
2. Tożsamość Google jest dołączana do istniejącego konta (link identity); nie powstaje nowe konto.
3. Użytkownik widzi swoje dotychczasowe przepisy, kolekcje i profil bez żadnych utrat danych.
4. Ponieważ istniejące konto ma już `username`, użytkownik trafia bezpośrednio na `/dashboard`.

---

### US-OAUTH-004 — Uzupełnienie profilu po pierwszym logowaniu przez Google

**Jako** nowy użytkownik, który właśnie zalogował się przez Google  
**chcę** podać swoją nazwę użytkownika na ekranie `/auth/complete-profile`  
**aby** móc w pełni korzystać z aplikacji.

#### Kryteria akceptacji

1. Ekran `/auth/complete-profile` jest dostępny tylko po autoryzacji przez OAuth; bezpośrednie wejście na ten adres bez aktywnej sesji OAuth przekierowuje na `/login`.
2. Formularz zawiera jedno pole: `username` (3–50 znaków, zasady identyczne z rejestracją email+hasło).
3. Przycisk „Zapisz i przejdź do aplikacji" jest niedostępny, dopóki pole nie spełnia walidacji.
4. Po zapisaniu profilu użytkownik jest przekierowywany na `/dashboard`.
5. Jeśli `username` jest już zajęty, wyświetlany jest komunikat z prośbą o wybór innej nazwy.

---

### US-OAUTH-005 — Obsługa błędów i anulowanie OAuth

**Jako** użytkownik, u którego wystąpił błąd podczas logowania przez Google  
**chcę** zobaczyć czytelny komunikat i mieć możliwość powrotu do logowania  
**aby** nie utknąć w niedziałającym ekranie.

#### Kryteria akceptacji

1. Gdy Google zwróci kod błędu (np. `access_denied`), aplikacja wyświetla przyjazny komunikat i link do `/login`.
2. Błędy konfiguracyjne (np. niepoprawny Client ID) są logowane w konsoli i nie ujawniają danych technicznych użytkownikowi.
3. Przekroczenie limitu czasu lub utrata połączenia podczas callbacku skutkuje przekierowaniem na `/login` z komunikatem o spróbowaniu ponownie.

---

## 4. Reguły biznesowe i bezpieczeństwa

| Reguła | Opis |
|---|---|
| Źródło tożsamości | OAuth 2.0 przez Supabase Auth (Google provider). Aplikacja nie obsługuje bezpośrednio tokenów Google. |
| Weryfikacja e-mail | Konta Google są traktowane jako zweryfikowane; flaga `email_confirmed_at` jest ustawiana przez Supabase przy tworzeniu konta OAuth. |
| Scalanie tożsamości | Gdy e-mail już istnieje w `auth.users`, Supabase łączy tożsamości (wymaga włączonej opcji `Link accounts` w Supabase Dashboard). |
| Wymagany username | Każdy profil musi mieć `username`. Brak `username` po OAuth wymusza przejście przez `/auth/complete-profile` zanim użytkownik uzyska dostęp do prywatnych tras. |
| Domyślna rola | Nowe konta OAuth otrzymują rolę `user` — identycznie jak rejestracja email+hasło. |
| Zakaz pominięcia profilu | Guard chroniący prywatne trasy (`/dashboard`, `/recipes`, itp.) sprawdza istnienie `username`; brak `username` przekierowuje na `/auth/complete-profile`. |
| Bezpieczeństwo tokenu | Tokeny OAuth są obsługiwane wyłącznie przez Supabase SDK; aplikacja kliencka przechowuje jedynie sesję Supabase (JWT). |

---

## 5. Poza zakresem

- Logowanie przez inne dostawców OAuth (Facebook, GitHub, Apple itp.) — osobny ficzer.
- Ręczne zarządzanie połączonymi tożsamościami z poziomu ustawień użytkownika (odłączenie konta Google).
- Wymuszanie logowania przez Google jako jedynej metody logowania.
- Logowanie przez Google w panelu administracyjnym z osobnymi regułami.
