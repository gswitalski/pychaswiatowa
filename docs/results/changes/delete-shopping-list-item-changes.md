# Delete shopping list item (recipe-derived) — changes

## 1. Historyjki użytkownika

### Zmienione / doprecyzowane

- **US-053 — Usuwanie pojedynczej pozycji z listy zakupów pochodzącej z przepisu**
    - **Co się zmieniło / doprecyzowano**:
        - usuwanie dotyczy **całej grupy** widocznej w UI (klucz: `nazwa`, `jednostka`, `is_owned`),
        - usuwanie działa również dla pozycji oznaczonych jako **posiadane** (`is_owned=true`),
        - po usunięciu użytkownik ma akcję **„Cofnij”** (Undo), która przywraca usuniętą grupę w oknie czasowym,
        - po późniejszej zmianie „Mojego planu” (np. dodanie przepisu) ten sam składnik może pojawić się ponownie jako **nowe wiersze** (w MVP nie utrzymujemy „wykluczeń”).

## 2. Widoki

### Zmienione / doprecyzowane

- **Widok: Zakupy (`/shopping`)**
    - **Co się zmieniło / doprecyzowano**:
        - ikonka kosza przy pozycji „z przepisu” usuwa **grupę**, a nie pojedynczy wiersz,
        - kosz działa identycznie niezależnie od `is_owned` (także dla „posiadane”),
        - po usunięciu pokazujemy Snackbar/Toast z akcją **„Cofnij”** (Undo),
        - po kolejnych zmianach „Mojego planu” pozycje mogą wracać (wynik aktualizacji listy zakupów na zdarzeniach planu).

## 3. API

### Zmienione / doprecyzowane

- **`DELETE /shopping-list/recipe-items/group`**
    - **Co się zmieniło / doprecyzowano**:
        - endpoint jest jednoznacznie powiązany z widokiem zgrupowanym: usuwa całą grupę (`name`, `unit`, `is_owned`),
        - działa identycznie dla `is_owned=false` i `is_owned=true`,
        - operacja nie modyfikuje „Mojego planu”,
        - po późniejszej zmianie planu te same składniki mogą pojawić się ponownie jako nowe wiersze (brak „wykluczeń” w MVP).
