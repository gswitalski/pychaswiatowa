# Profile Settings — wymagania

## Cel

Dodać w widoku **`/settings`** formularz ustawień profilu użytkownika, który pozwala bezpiecznie zarządzać podstawowymi danymi konta: odczytać adres e-mail, zmienić nazwę wyświetlaną opartą o istniejące pole `username`, zaktualizować zgodę marketingową oraz uruchomić zmianę hasła z poziomu modalu.

## Kontekst architektury (istniejące założenia)

- Aplikacja działa jako SPA w Angular + Angular Material, w ramach prywatnego App Shell.
- Istnieje prywatny widok **`/settings`**, obecnie opisany skrótowo jako miejsce zmiany `username` i hasła.
- Profil użytkownika jest utrzymywany w tabeli **`profiles`**, powiązanej 1:1 z `auth.users`.
- W istniejącym planie API występują endpointy **`GET /profile`** i **`PUT /profile`**.
- W osobnym planie dla rejestracji została już przewidziana zgoda marketingowa przechowywana w `profiles` jako prosty bieżący stan, bez historii zmian.
- Autentykacja opiera się o Supabase Auth, więc adres e-mail użytkownika pochodzi z warstwy auth, a nie z tabeli `profiles`.

## Problem do rozwiązania

- Obecny opis ustawień jest zbyt ogólny i nie definiuje dokładnie zakresu danych możliwych do edycji.
- Użytkownik nie ma jasno opisanego miejsca do zarządzania zgodą marketingową po rejestracji.
- Zmiana hasła wymaga doprecyzowania jako osobny, bezpieczny flow z weryfikacją starego hasła.
- Widok ustawień powinien rozdzielać dane tylko do odczytu od danych edytowalnych, aby zmniejszyć ryzyko pomyłki.

## Zakres (MVP dla tego ficzera)

### Wymagania funkcjonalne

- **FR-PS-001 (widok ustawień profilu)**: Pod ścieżką **`/settings`** dostępny jest formularz ustawień profilu dla zalogowanego użytkownika.
- **FR-PS-002 (e-mail tylko do odczytu)**: Formularz wyświetla adres e-mail użytkownika jako pole tylko do odczytu.
    - Użytkownik nie może edytować e-maila w ramach tego MVP.
    - Adres e-mail pochodzi z danych auth użytkownika.
- **FR-PS-003 (nazwa wyświetlana = username)**: Formularz pozwala edytować nazwę wyświetlaną rozumianą jako istniejące pole **`username`**.
    - Nie wprowadzamy osobnego pola `display_name`.
    - Walidacje pozostają spójne z dotychczasowymi regułami dla `username` (np. długość i unikalność, jeśli obowiązuje w implementacji).
- **FR-PS-004 (zarządzanie zgodą marketingową)**: Formularz pozwala zmienić bieżącą wartość zgody marketingowej użytkownika.
    - UI prezentuje aktualny stan zgody jako pojedynczy przełącznik lub checkbox.
    - Zgoda jest dobrowolna i może zostać zarówno nadana, jak i wycofana.
- **FR-PS-005 (persistencja zgody marketingowej)**: System zapisuje bieżący stan zgody marketingowej w danych profilu.
    - Gdy użytkownik włącza zgodę, system zapisuje `marketing_consent = true`.
    - Gdy użytkownik wyłącza zgodę, system zapisuje `marketing_consent = false`.
    - System aktualizuje `marketing_consent_updated_at` przy każdej zmianie decyzji.
    - W MVP przechowywany jest bieżący stan zgody, bez osobnej historii zmian.
- **FR-PS-006 (zapis formularza)**: Zmiana `username` i zgody marketingowej jest zapisywana jedną akcją zapisu formularza.
    - Formularz może zapisać jedną lub obie zmiany naraz.
    - Przy braku zmian przycisk zapisu może pozostać nieaktywny.
- **FR-PS-007 (uruchomienie zmiany hasła)**: Widok **`/settings`** zawiera przycisk **„Zmień hasło”**, który otwiera modal.
- **FR-PS-008 (bezpieczna zmiana hasła)**: Modal zmiany hasła wymaga podania:
    - starego hasła,
    - nowego hasła,
    - potwierdzenia nowego hasła po stronie UI.
- **FR-PS-009 (walidacja zmiany hasła)**: Nowe hasło podlega walidacji zgodnej z polityką haseł obowiązującą w aplikacji.
    - Formularz nie może wysłać żądania, jeśli stare hasło jest puste.
    - Formularz nie może wysłać żądania, jeśli nowe hasło i potwierdzenie różnią się.
- **FR-PS-010 (reguła bezpieczeństwa dla hasła)**: Backend zmienia hasło wyłącznie po poprawnej weryfikacji starego hasła użytkownika.
- **FR-PS-011 (zachowanie sesji po zmianie hasła)**: Po skutecznej zmianie hasła użytkownik pozostaje zalogowany na bieżącym urządzeniu.
- **FR-PS-012 (informacja zwrotna)**: Po zapisie profilu i po zmianie hasła użytkownik otrzymuje jednoznaczny komunikat sukcesu lub błędu.

### Zmiany w modelu danych

- Nadal używamy tabeli **`profiles`** jako źródła danych profilu edytowalnego.
- Nie dodajemy pola `display_name`; wykorzystywane jest istniejące pole:
    - `username` — nazwa wyświetlana użytkownika.
- Dla spójności z featurem zgody marketingowej przy rejestracji tabela **`profiles`** powinna zawierać pola:
    - `marketing_consent` — `boolean not null default false`,
    - `marketing_consent_updated_at` — `timestamptz null`,
    - `marketing_consent_text_version` — `text null`.

> Uzasadnienie: ten ficzer nie potrzebuje osobnej tabeli preferencji ani audytu zgód. Najprostszy model bieżącego stanu jest spójny z wcześniejszym planem rejestracji i wystarczający dla MVP.

### Poza zakresem (explicitly out-of-scope)

- Zmiana adresu e-mail użytkownika.
- Historia zmian zgody marketingowej i pełny audyt decyzji.
- Zarządzanie zgodami per kanał komunikacji.
- Reset hasła przez e-mail z poziomu widoku **`/settings`**.
- Wylogowanie innych sesji/urządzeń po zmianie hasła.
- Edycja innych danych konta niż e-mail, `username` i zgoda marketingowa.

## User stories

### US-PS-001 — Aktualizacja danych profilu w ustawieniach

Jako **zalogowany użytkownik** chcę wejść do widoku **`/settings`** i zmienić swoją nazwę wyświetlaną oraz decyzję dotyczącą zgody marketingowej, aby zarządzać bieżącymi ustawieniami konta w jednym miejscu.

**Kryteria akceptacji:**

- Po wejściu na **`/settings`** widzę swój adres e-mail jako pole tylko do odczytu.
- Widzę edytowalne pole nazwy wyświetlanej oparte o `username`.
- Widzę aktualny stan zgody marketingowej.
- Mogę zmienić sam `username`, samą zgodę marketingową albo oba pola naraz.
- Po poprawnym zapisie formularza nowe wartości są zapisane i widoczne po ponownym wejściu na ekran.
- Jeśli zapis się nie powiedzie, widzę komunikat błędu, a formularz zachowuje moje wpisane dane.

### US-PS-002 — Zmiana hasła z poziomu ustawień

Jako **zalogowany użytkownik** chcę zmienić swoje hasło z poziomu modalu w ustawieniach, podając stare i nowe hasło, aby zwiększyć bezpieczeństwo konta bez opuszczania aplikacji.

**Kryteria akceptacji:**

- W widoku **`/settings`** widzę przycisk **„Zmień hasło”**.
- Po kliknięciu przycisku otwiera się modal zmiany hasła.
- Modal wymaga podania starego hasła, nowego hasła i potwierdzenia nowego hasła.
- Nie mogę wysłać formularza, jeśli nowe hasło i potwierdzenie są różne.
- Jeśli stare hasło jest niepoprawne, widzę komunikat błędu i hasło nie zostaje zmienione.
- Po skutecznej zmianie hasła widzę komunikat sukcesu, modal się zamyka, a bieżąca sesja pozostaje aktywna.

## Wymagania niefunkcjonalne

- **Bezpieczeństwo**: Zmiana hasła musi wymagać reautoryzacji poprzez poprawne stare hasło; sama walidacja frontendowa nie jest wystarczająca.
- **Spójność danych**: E-mail prezentowany w ustawieniach musi odpowiadać zalogowanemu użytkownikowi z warstwy auth, a dane edytowalne muszą być spójne z rekordem `profiles`.
- **UX**: Widok powinien wyraźnie rozdzielać dane tylko do odczytu od danych edytowalnych i nie powinien mieszać zmiany hasła z głównym formularzem profilu.
- **Maintainability**: Struktura kontraktów API powinna umożliwiać późniejsze rozszerzenie ustawień o kolejne preferencje bez łamania obecnego modelu.
