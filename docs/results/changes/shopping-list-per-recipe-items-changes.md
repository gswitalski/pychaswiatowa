# Shopping List — Per-recipe raw items (frontend grouping) — Zmiany w dokumentacji

## 1. Historyjki użytkownika

### Zmienione

- **US-049 — Automatyczna lista zakupów na podstawie „Mojego planu”**
    - **Co się zmieniło:** backend przestał scalać pozycje listy zakupów. Po dodaniu przepisu do planu tworzy **osobne wiersze** listy zakupów dla każdego znormalizowanego składnika.
    - Dodano pola w wierszu pochodzącym z przepisu: `recipe_id` oraz `recipe_name` (snapshot nazwy przepisu w momencie dodania do planu).
    - `is_owned` jest przechowywane **per wiersz** (domyślnie `false` dla nowych wierszy).

- **US-050 — Aktualizacja listy zakupów przy usuwaniu przepisu z planu**
    - **Co się zmieniło:** zamiast „odejmowania wkładu” backend usuwa z listy zakupów wszystkie wiersze powiązane z usuwanym `recipe_id`.
    - Ręczne pozycje użytkownika nie są modyfikowane.

- **US-051 — Odhaczanie posiadanych pozycji na liście zakupów**
    - **Co się zmieniło:** stan `is_owned` jest utrwalany **per wiersz**, a frontend grupuje pozycje „z przepisów” tylko jeśli mają identyczne (`nazwa`, `jednostka`, `is_owned`).
    - Jeśli identyczne składniki mają różne `is_owned` (scenariusz „częściowo odhaczone”), nie są grupowane razem.

## 2. Widoki

### Zmienione

- **Zakupy (lista zakupów)**
    - **Ścieżka:** `/shopping`
    - **Co się zmieniło:** widok dalej prezentuje pozycje w sposób „zgrupowany”, ale grupowanie i sumowanie jest wykonywane na frontendzie na podstawie surowych wierszy z API.
    - **Reguła grupowania:** grupujemy wyłącznie po (`nazwa`, `jednostka`, `is_owned`). Brak przełącznika widoku na tym etapie.

## 3. API

### Zmienione

- **`GET /shopping-list`**
    - **Co się zmieniło:** endpoint zwraca pozycje „z przepisów” jako **surowe wiersze** (jeden wiersz na jeden składnik danego przepisu), rozszerzone o `recipe_id` oraz `recipe_name`.
    - Frontend odpowiada za grupowanie/sumowanie (rekomendowany klucz: `name`, `unit`, `is_owned`).

- **`POST /plan/recipes`**
    - **Co się zmieniło:** side-effect tworzy surowe wiersze listy zakupów (bez merge/sumowania po stronie backendu) oraz ustawia `recipe_name` jako snapshot.

- **`DELETE /plan/recipes/{recipeId}`**
    - **Co się zmieniło:** side-effect usuwa surowe wiersze listy zakupów po `recipe_id` (bez odejmowania ilości).

