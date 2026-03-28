# Profile Settings — plan UI

## Cel UI

Rozszerzyć prywatny widok **`/settings`** tak, aby użytkownik mógł w jednym miejscu odczytać swój login (e-mail), zmienić nazwę wyświetlaną opartą o `username`, zaktualizować zgodę marketingową oraz bezpiecznie uruchomić zmianę hasła w osobnym modalu.

## Nowy / doprecyzowany widok

### 1) `/settings` — ustawienia profilu

- **Ścieżka**: `/settings`
- **Zakres widoku**: doprecyzowanie i rozszerzenie istniejącego widoku ustawień.
- **Kontekst renderowania**: standardowy prywatny App Shell.

### Struktura widoku

- Widok powinien być podzielony na 2 logiczne sekcje:
    - **Dane konta**,
    - **Bezpieczeństwo**.
- Na desktopie sekcje mogą być pokazane jako osobne karty lub bloki jedna pod drugą.
- Na mobile/tablet układ pozostaje jednokolumnowy, z zachowaniem czytelnych odstępów i pełnej szerokości pól.

## Sekcja „Dane konta”

### Pola i elementy

- Pole **E-mail / login**:
    - renderowane jako pole formularza tylko do odczytu,
    - wizualnie powinno jasno komunikować brak możliwości edycji.
- Pole **Nazwa wyświetlana**:
    - edytowalne pole tekstowe powiązane z `username`.
- Pole **Zgoda marketingowa**:
    - pojedynczy `checkbox` lub `slide-toggle`,
    - etykieta powinna jasno komunikować, że chodzi o otrzymywanie materiałów marketingowych.
- Akcja **„Zapisz zmiany”**:
    - dotyczy sekcji danych konta,
    - zapisuje `username` i `marketing_consent` w jednej operacji.

### Zachowanie UX

- Po wejściu na ekran użytkownik widzi aktualne wartości pobrane z backendu.
- Pole e-mail jest nieaktywne edycyjnie, ale nadal możliwe do skopiowania.
- Jeśli użytkownik nie zmienił żadnej wartości:
    - przycisk zapisu może być nieaktywny,
    - UI nie powinien sugerować, że istnieją niezapisane zmiany.
- Jeśli użytkownik zmieni `username`, zgodę marketingową albo oba pola:
    - formularz przechodzi w stan „dirty”,
    - przycisk zapisu staje się aktywny.
- Po skutecznym zapisie:
    - użytkownik widzi komunikat sukcesu,
    - formularz odświeża stan bazowy bez utraty aktualnych danych.
- Po błędzie zapisu:
    - użytkownik widzi komunikat błędu,
    - pola zachowują jego wpisane wartości.

## Sekcja „Bezpieczeństwo”

### Główny element

- W sekcji znajduje się przycisk **„Zmień hasło”**.
- Przycisk nie otwiera osobnej strony; uruchamia modal/dialog nad aktualnym widokiem.

## Overlay / modal

### 2) Modal „Zmień hasło”

- **Typ komponentu**: dialog/modal Angular Material.
- **Uruchomienie**: kliknięcie przycisku **„Zmień hasło”** na `/settings`.

### Zawartość modalu

- Tytuł: **„Zmień hasło”**
- Pola:
    - **Stare hasło**
    - **Nowe hasło**
    - **Potwierdź nowe hasło**
- Akcje:
    - **„Anuluj”**
    - **„Zapisz nowe hasło”**

### Zachowanie UX w modalu

- Wszystkie pola haseł powinny być maskowane, z opcjonalnym przełącznikiem pokaż/ukryj hasło, jeśli taki wzorzec istnieje już w aplikacji.
- Walidacja po stronie UI:
    - wszystkie pola są wymagane,
    - nowe hasło i potwierdzenie muszą być zgodne,
    - ewentualne reguły siły hasła powinny być komunikowane inline.
- Po kliknięciu zapisu:
    - modal przechodzi w stan loading,
    - nie należy dopuszczać do wielokrotnego wysłania tego samego żądania.
- Po sukcesie:
    - modal się zamyka,
    - użytkownik widzi komunikat sukcesu poza modalem lub w jego obrębie tuż przed zamknięciem.
- Po błędzie:
    - modal pozostaje otwarty,
    - użytkownik widzi precyzyjny komunikat, np. dla niepoprawnego starego hasła.

## Stany i edge-case’y

- **Stan ładowania widoku `/settings`**:
    - do czasu pobrania danych widoczne są skeletony, spinner lub placeholder zgodny z resztą aplikacji.
- **Stan pustych danych marketingowych**:
    - jeśli profil nie ma jeszcze formalnie ustawionych nowych pól, UI powinien traktować brak wartości jako `marketing_consent = false`.
- **Konflikt walidacyjny dla `username`**:
    - jeśli backend odrzuci zmianę `username`, komunikat błędu powinien być powiązany z polem lub sekcją formularza.
- **Brak zmian w formularzu**:
    - kliknięcie zapisu nie powinno wysyłać pustego update’u.
- **Zamknięcie modalu z niezapisanymi danymi**:
    - MVP może pozwalać na zwykłe zamknięcie modalu bez dodatkowego confirm dialogu.
- **Responsywność**:
    - modal na mniejszych ekranach powinien mieścić się w viewport i zachować wygodne odstępy,
    - przycisk „Zmień hasło” i CTA zapisu formularza muszą pozostać łatwe do kliknięcia.

## Wymagane elementy UI/komponenty (proponowane)

- Rozszerzenie istniejącej strony ustawień profilu.
- Formularz profilu z kontrolkami typu:
    - `email` — read-only,
    - `username: FormControl<string>`,
    - `marketingConsent: FormControl<boolean>`.
- Dialog zmiany hasła z osobnym formularzem:
    - `currentPassword`,
    - `newPassword`,
    - `confirmNewPassword`.
- Komunikaty typu snackbar/alert inline zgodne z resztą systemu.

## Proponowane treści robocze

- Etykieta zgody marketingowej:
    - „Chcę otrzymywać materiały marketingowe dotyczące serwisu PychaŚwiatowa.”
- Pomoc pod polem e-mail:
    - „Adres e-mail jest loginem konta i nie można go zmienić w tym miejscu.”
- Komunikat sukcesu po zapisie profilu:
    - „Zmiany profilu zostały zapisane.”
- Komunikat sukcesu po zmianie hasła:
    - „Hasło zostało zmienione.”

## Definition of Done (UI)

- Widok **`/settings`** pokazuje e-mail jako pole tylko do odczytu.
- Widok pozwala edytować `username` oraz bieżący stan zgody marketingowej.
- Przycisk **„Zmień hasło”** otwiera modal z polami starego i nowego hasła.
- Formularz profilu i modal hasła mają obsłużone stany loading, sukcesu i błędu.
- UI pozostaje spójny z App Shell i komponentami Angular Material.
