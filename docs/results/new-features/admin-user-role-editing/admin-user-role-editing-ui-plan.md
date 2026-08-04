# Edycja ról użytkowników przez administratora — plan UI

## 1. Zmieniony widok: lista użytkowników

**Ścieżka:** `/admin/users`  
**Istniejący obszar implementacji:** `src/app/pages/admin/admin-users/`

Widok pozostaje tabelą użytkowników z sortowaniem i paginacją. Należy dodać do niej końcową kolumnę **„Akcje”**.

| Element | Zachowanie |
|---|---|
| Przycisk edycji | Przycisk ikonowy Angular Material z ikoną ołówka (`edit`), dostępny w każdym edytowalnym wierszu. |
| Dostępność | `aria-label` zawiera nazwę akcji i identyfikację użytkownika; po najechaniu widoczny jest tooltip „Zmień rolę użytkownika”. |
| Niedostępna akcja | Dla aktualnie zalogowanego administratora przycisk jest ukryty lub nieaktywny z tooltipem wyjaśniającym, że nie można zmienić własnej roli. |
| Responsywność | Na mniejszych ekranach kolumna akcji pozostaje widoczna; opisowe kolumny mogą korzystać z istniejącego responsywnego układu tabeli. |

Kliknięcie ołówka nie zmienia trasy ani nie otwiera osobnej strony — otwiera dialog na aktualnym widoku.

## 2. Nowy overlay: dialog „Zmień rolę użytkownika”

Dialog należy zrealizować jako mały `MatDialog`, umieszczony w obszarze funkcji `admin-users`.

### Zawartość

1. Tytuł: „Zmień rolę użytkownika”.
2. Kontekst użytkownika: `username` oraz e-mail lub inny dostępny, jednoznaczny identyfikator z danych listy.
3. Informacja o bieżącej roli.
4. Pole wyboru roli (`mat-select` lub grupa radio), z trzema wartościami:
    - Użytkownik (`user`),
    - Premium (`premium`),
    - Administrator (`admin`).
5. Krótka informacja: „Zmiana zacznie obowiązywać użytkownika po jego kolejnym zalogowaniu.”
6. Przyciski:
    - „Anuluj” — zamyka dialog bez wywołania API,
    - „Zapisz zmianę” — wysyła zmianę.

### Stany dialogu

| Stan | Zachowanie interfejsu |
|---|---|
| Stan początkowy | Aktualna rola jest zaznaczona, a przycisk zapisu jest niedostępny do chwili wybrania innej wartości. |
| Zapisywanie | Kontrolka wyboru i oba przyciski są zablokowane; w przycisku zapisu pojawia się wskaźnik ładowania. |
| Sukces | Dialog zostaje zamknięty, wiersz tabeli otrzymuje nową rolę, a snackbar pokazuje potwierdzenie. |
| Błąd walidacji | Pole wyboru pokazuje komunikat o nieprawidłowej wartości; dialog pozostaje otwarty. |
| Błąd autoryzacji | Snackbar komunikuje brak uprawnień; aplikacja stosuje istniejącą obsługę błędu sesji/403. |
| Konflikt reguł | Dialog pozostaje otwarty, a komunikat wyjaśnia, że nie można zmienić własnej roli lub obniżyć roli ostatniego administratora. |
| Brak użytkownika | Dialog jest zamykany, lista jest odświeżana, a snackbar informuje, że użytkownik nie jest już dostępny. |

## 3. Przepływ użytkownika

1. Administrator otwiera `/admin/users`.
2. Przy wybranym użytkowniku wybiera ikonę ołówka.
3. Aplikacja otwiera dialog z aktualną rolą użytkownika.
4. Administrator wybiera nową rolę i zatwierdza zmianę.
5. Interfejs wysyła żądanie aktualizacji oraz blokuje wielokrotne wysłanie.
6. Po sukcesie aktualizuje lokalny model wiersza; przy błędzie pokazuje komunikat i nie zmienia widocznej roli.

## 4. Obsługa przypadków szczególnych

- Komponent nie polega wyłącznie na klientowej blokadzie własnego konta: backend zawsze ponownie weryfikuje tę regułę.
- Ochrona ostatniego administratora jest rozstrzygana przez backend; UI wyświetla odpowiedź konfliktową, ponieważ stan może zmienić się równolegle.
- Jeśli lista użytkowników zostanie odświeżona w trakcie dialogu, dane przekazane przy otwarciu służą wyłącznie do prezentacji; odpowiedź API jest źródłem aktualnego stanu.
