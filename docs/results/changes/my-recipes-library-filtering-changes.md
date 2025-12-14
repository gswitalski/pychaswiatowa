# My recipes library filtering — changes

## 1. Historyjki użytkownika

- **US-007 — Przeglądanie listy wszystkich przepisów**
    - **Zmiana:** lista "Moje przepisy" obejmuje teraz: (1) wszystkie moje przepisy oraz (2) publiczne przepisy innych autorów, ale tylko jeśli są dodane do co najmniej jednej mojej kolekcji.
    - **Zmiana:** ścieżka widoku w dokumentacji doprecyzowana jako `/my-recipies` (alias: `/my-recipes`).
    - **Zmiana:** przepisy nie mojego autorstwa są oznaczane chipem "W moich kolekcjach".

- **US-004 — Przeglądanie szczegółów przepisu**
    - **Zmiana:** przyciski "Edytuj" i "Usuń" są dostępne wyłącznie dla autora; dla zalogowanego nie-autora nie są wyświetlane niezależnie od miejsca wejścia w szczegóły.

- **US-025 — Oznaczenie cudzych przepisów zapisanych w moich kolekcjach**
    - **Nowe:** doprecyzowanie oznaczenia i zachowania UI dla przepisów innych autorów widocznych na liście "Moje przepisy".

- **US-014 — Globalna nawigacja i orientacja (App Shell)**
    - **Zmiana:** zakres widoczności Sidebara doprecyzowany o `/my-recipies` (alias: `/my-recipes`).

## 2. Widoki

- **Lista "Moje przepisy"**
    - **Zmiana:** wyświetla moje przepisy oraz publiczne przepisy innych autorów dodane do moich kolekcji.
    - **Nowe:** na kartach przepisów innych autorów chip/etykieta "W moich kolekcjach".
    - **Zmiana:** ścieżka widoku w dokumentacji: `/my-recipies` (alias: `/my-recipes`).

- **Szczegóły przepisu**
    - **Zmiana:** dla zalogowanego nie-autora brak akcji "Edytuj" i "Usuń" (także po wejściu z listy "Moje przepisy").

## 3. API

- **GET `/recipes`**
    - **Zmiana:** dodano parametr `view` (`owned` | `my_recipes`) aby obsłużyć widok listy "Moje przepisy" jako: moje + publiczne z moich kolekcji.
    - **Zmiana:** odpowiedź listy rozszerzona o pola pomocnicze do UI: `is_owner` oraz `in_my_collections` (oraz `author`).

- **GET `/recipes/{id}`**
    - **Zmiana:** doprecyzowanie autoryzacji: `403` tylko gdy przepis nie jest publiczny i użytkownik nie jest właścicielem.
