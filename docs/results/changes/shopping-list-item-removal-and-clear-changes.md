# Shopping List item removal & clear – changes

## 1. Historyjki użytkownika

### Nowe

- **US-053 – Usuwanie pojedynczej pozycji z listy zakupów pochodzącej z przepisu**
    - **Co dochodzi**: możliwość usunięcia pozycji „z przepisu” bez usuwania przepisu z „Mojego planu”.
    - **Definicja „pojedynczej pozycji”**: w UI usuwamy **całą grupę** (klucz: `nazwa` + `jednostka` + `is_owned`), bo widok domyślnie prezentuje listę zgrupowaną.
    - **UX**: Snackbar/Toast z akcją **Undo** (Cofnij).

- **US-054 – Wyczyść listę zakupów bez modyfikacji „Mojego planu”**
    - **Co dochodzi**: przycisk do wyczyszczenia całej listy zakupów jednym kliknięciem.
    - **Zakres**: usuwa wszystkie pozycje (ręczne i „z przepisów”), **nie zmienia** planu.
    - **UX**: modal potwierdzenia; brak Undo w MVP.

## 2. Widoki

### Zmienione

- **`/shopping` – Zakupy (lista zakupów)**
    - **Co się zmieniło**:
        - dodano akcję usuwania (ikonka kosza) także dla pozycji pochodzących z przepisów (usuwa grupę),
        - dodano akcję w Page Header: **Wyczyść listę** (z modalem potwierdzenia),
        - dla pojedynczego usunięcia: Snackbar/Toast z **Undo**,
        - dla czyszczenia listy: brak Undo; jasna informacja w modalu, że plan nie zostanie zmieniony.

## 3. API

### Nowe

- **`DELETE /shopping-list/recipe-items/group`**
    - **Co dochodzi**: usuwanie całej grupy pozycji pochodzących z przepisów po kluczu (`name`, `unit`, `is_owned`).
    - **Uwagi**: nie modyfikuje „Mojego planu”.

- **`DELETE /shopping-list`**
    - **Co dochodzi**: wyczyszczenie całej listy zakupów (ręczne + z przepisów).
    - **Uwagi**: nie modyfikuje „Mojego planu”; lista pozostaje pusta do kolejnej zmiany planu lub dodania pozycji ręcznej.

