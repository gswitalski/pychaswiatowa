# Admin Users List — plan UI

## Cel UI

Zastąpić dotychczasowy placeholder widoku `Użytkownicy` w sekcji `/admin/*` pełnoprawnym ekranem tabelarycznym, który pozwoli administratorowi przeglądać listę kont w sposób czytelny, uporządkowany i spójny z istniejącym layoutem admina.

## Zmiana w istniejącym widoku `/admin/users`

### Aktualizacja charakteru widoku

- Ścieżka `/admin/users` pozostaje bez zmian.
- Pozycja `Użytkownicy` w aside admina nadal prowadzi do tej samej trasy, ale zamiast placeholdera renderowana jest tabela danych.
- Widok pozostaje częścią wspólnego layoutu admina i zachowuje aktywny stan nawigacji dla pozycji `Użytkownicy`.

## Struktura ekranu

### Nagłówek strony

- Tytuł widoku: `Użytkownicy`.
- Krótki opis pomocniczy pod nagłówkiem, np. że ekran prezentuje podstawowe informacje o zarejestrowanych kontach.
- Brak przycisków CTA typu `Dodaj`, `Eksportuj`, `Filtruj` lub `Zarządzaj rolami`.

### Główna zawartość

- Centralnym elementem widoku jest tabela admin-only.
- Tabela powinna być oparta o wzorzec zgodny z Angular Material i wspólnym designem aplikacji.
- Układ powinien preferować desktop-first, z naciskiem na dobrą czytelność kolumn i danych liczbowych.

## Kolumny tabeli

Tabela zawiera kolumny w następującej kolejności:

1. `ID użytkownika`
2. `Login`
3. `Username`
4. `Data rejestracji`
5. `Data ostatniego logowania`
6. `Liczba przepisów`
7. `Rola`

### Prezentacja danych w kolumnach

- **ID użytkownika**:
    - prezentowane jako pełne UUID lub skrócona forma z tooltipem/podpowiedzią, jeśli pełna wartość pogarsza czytelność tabeli;
    - wartość nie jest linkiem w MVP.
- **Login**:
    - oznacza e-mail użytkownika używany do logowania;
    - powinien być traktowany jako główny identyfikator czytelny dla administratora.
- **Username**:
    - prezentuje `profiles.username`;
    - zastępuje wcześniejsze nieprecyzyjne pole `nazwa`.
- **Data rejestracji**:
    - prezentowana w czytelnym lokalnym formacie daty i czasu.
- **Data ostatniego logowania**:
    - prezentowana w tym samym formacie co data rejestracji;
    - jeśli brak wartości, UI wyświetla `Nigdy`.
- **Liczba przepisów**:
    - wyrównanie do prawej lub w sposób spójny z innymi wartościami liczbowymi.
- **Rola**:
    - prezentowana jako prosta wartość tekstowa lub chip/badge:
        - `user`
        - `premium`
        - `admin`

## Sortowanie

- Widok startuje z domyślnym sortowaniem po `Dacie rejestracji` malejąco.
- W MVP użytkownik może zmieniać sortowanie przynajmniej dla kolumn:
    - `Login`
    - `Data rejestracji`
    - `Data ostatniego logowania`
    - `Liczba przepisów`
- Zmiana sortowania powinna wywoływać ponowne pobranie danych z backendu, a nie sortowanie pełnej listy po stronie klienta.
- Aktualny stan sortowania powinien być odzwierciedlony wizualnie w nagłówku kolumny.

## Paginacja

- Pod tabelą znajduje się paginator.
- Domyślny rozmiar strony wynosi `25` rekordów.
- Paginacja działa po stronie serwera.
- Zmiana strony zachowuje aktualne sortowanie.
- Widok powinien jasno komunikować, że administrator przegląda część większego zbioru danych.

## Stany widoku

### Stan ładowania

- Podczas pobierania danych widok pokazuje wyraźny stan ładowania w obrębie tabeli.
- Layout strony, nagłówek oraz aside pozostają stabilne; ładowanie nie powinno powodować skoków układu.

### Stan pusty

- Jeśli endpoint zwróci pustą listę, ekran wyświetla pusty stan zamiast pustej tabeli.
- Komunikat powinien jasno mówić, że w systemie nie ma jeszcze użytkowników do pokazania.

### Stan błędu

- Jeśli pobranie danych nie powiedzie się, widok pokazuje komunikat błędu osadzony w kontekście strony.
- Komunikat nie powinien ujawniać szczegółów technicznych backendu.
- Jeśli to możliwe w istniejącym wzorcu aplikacji, można przewidzieć akcję ponowienia pobrania.

## Zachowanie i ograniczenia MVP

- Widok ma charakter **tylko do odczytu**.
- Wiersze nie zawierają menu akcji, checkboxów zaznaczenia, przycisków edycji ani przejścia do szczegółów.
- Widok nie zawiera:
    - wyszukiwarki,
    - filtrów,
    - segmentacji po roli,
    - masowych akcji,
    - eksportu danych.

## Responsywność

- Desktop pozostaje wariantem podstawowym dla tego ekranu.
- Na mniejszych szerokościach dopuszczalne jest poziome przewijanie obszaru tabeli, jeśli pomaga zachować komplet kolumn bez utraty czytelności.
- Nie należy upraszczać widoku przez usuwanie kluczowych kolumn tylko po to, aby zmieścić tabelę na bardzo wąskich ekranach.
- Globalna nawigacja aplikacji i aside admina pozostają spójne z istniejącą architekturą App Shell.

## Wymagane elementy UI/komponenty (proponowane)

- **AdminUsersPage**: docelowy widok listy użytkowników.
- **AdminUsersTable**: komponent tabeli lub logicznie wydzielona część widoku odpowiedzialna za render danych, sortowanie i paginację.
- **AdminUsersDataSource / facade / service**: warstwa odpowiedzialna za pobranie danych z endpointu admin-only.

## Kryteria UX (Definition of Done dla UI)

- Wejście na `/admin/users` pokazuje tabelę zamiast placeholdera.
- Tabela zawiera pełny zestaw uzgodnionych kolumn.
- Domyślne sortowanie działa po `dacie rejestracji` malejąco.
- Widok wspiera paginację i sortowanie bez filtrowania.
- Brakujące `ostatnie logowanie` jest prezentowane w czytelny sposób, np. `Nigdy`.
- Ekran pozostaje spójny z layoutem admina i nie wprowadza akcji edycyjnych w MVP.
