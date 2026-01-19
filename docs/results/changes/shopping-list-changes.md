# Shopping List (Zakupy) — Zmiany w dokumentacji

## 1. Historyjki użytkownika

### Nowe

- **US-049 — Automatyczna lista zakupów na podstawie „Mojego planu”**
    - Dodano mechanikę: dodanie przepisu do planu dodaje jego znormalizowane składniki do listy zakupów.
    - Reguły merge: scalanie po (`nazwa`, `jednostka`), sumowanie ilości tylko gdy `jednostka != null` i `ilosc != null`, a dla `jednostka = null` pojedyncza pozycja „tylko nazwa”.

- **US-050 — Aktualizacja listy zakupów przy usuwaniu przepisu z planu**
    - Usunięcie przepisu z planu odejmuje wkład składników z listy zakupów i usuwa pozycję, gdy ilość spadnie do `0`.
    - Ręczne pozycje użytkownika nie są modyfikowane.

- **US-051 — Odhaczanie posiadanych pozycji na liście zakupów**
    - Dodano odhaczanie „posiadane” z utrwaleniem stanu i sortowaniem odhaczonych na dół.

- **US-052 — Dodawanie ręcznych pozycji do listy zakupów**
    - Ręczne pozycje są dodawane jako **tekst** (bez ilości/jednostki) i mogą być usuwane.

### Zmienione

- **Sekcja „Granice produktu” (PRD)**
    - Zmieniono zapis z „spiżarnia i listy zakupów” poza zakresem na: **poza zakresem pozostaje tylko spiżarnia**, a lista zakupów jest w zakresie.

## 2. Widoki

### Nowe

- **Zakupy (lista zakupów)**
    - **Ścieżka:** `/shopping`
    - Funkcje: podgląd listy, dodawanie ręcznej pozycji tekstowej, odhaczanie „posiadane” (odhaczone na dół), usuwanie ręcznych pozycji.
    - Uwaga MVP: edycja przepisu będącego w planie nie powoduje automatycznej aktualizacji listy zakupów (lista może być nieaktualna).

### Zmienione

- **Sidebar (App Shell)**
    - Dodano pozycję menu **„Zakupy”** i widoczność Sidebara rozszerzono o `/shopping/**`.

## 3. API

### Nowe

- **`GET /shopping-list`**
    - Pobiera listę zakupów (pozycje z przepisów + ręczne).

- **`POST /shopping-list/items`**
    - Dodaje ręczną pozycję tekstową do listy zakupów.

- **`PATCH /shopping-list/items/{id}`**
    - Ustawia `is_owned` (odhaczanie posiadanych) dla pozycji (zarówno recipe-derived jak i manual).

- **`DELETE /shopping-list/items/{id}`**
    - Usuwa ręczną pozycję (`kind=MANUAL`); usuwanie pozycji z przepisów jest zabronione (403).

### Zmienione

- **`POST /plan/recipes`**
    - Dodano side-effect: po dodaniu przepisu do planu backend aktualizuje listę zakupów na podstawie `recipe_normalized_ingredients` z regułami merge/sumowania.

- **`DELETE /plan/recipes/{recipeId}`**
    - Dodano side-effect: po usunięciu przepisu z planu backend odejmuje wkład składników z listy zakupów.
