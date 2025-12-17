## 1. Historyjki użytkownika

### Nowe

- **US-028 — Ustawienie i wyświetlanie liczby porcji w przepisie**
  - **Co dochodzi**: opcjonalne pole „Liczba porcji” (integer `1-99`, może być puste), zapis wartości i wyświetlanie jej pod tytułem przepisu.

### Zmienione

- **US-004 — Przeglądanie szczegółów przepisu**
  - **Co się zmieniło**: jeśli przepis ma ustawioną liczbę porcji, wyświetla się ona bezpośrednio pod tytułem.

- **US-005 — Edycja istniejącego przepisu**
  - **Co się zmieniło**: w edycji można ustawić liczbę porcji (`1-99`) lub wyczyścić wartość (ustawić `null`).

- **US-019 — Przeglądanie szczegółów publicznego przepisu**
  - **Co się zmieniło**: jeśli przepis ma ustawioną liczbę porcji, jest ona widoczna pod tytułem również w widoku publicznym.


## 2. Widoki

### Zmienione

- **Szczegóły przepisu (uniwersalny widok)** (`/recipes/:id` oraz `/explore/recipes/:id`)
  - **Co się zmieniło**: dodano wyświetlanie liczby porcji bezpośrednio pod tytułem (np. `4 porcje`, `6 porcji`). Jeśli brak wartości — element nie jest renderowany.

- **Formularz przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
  - **Co się zmieniło**: dodano opcjonalne pole „Liczba porcji” w sekcji „Dane podstawowe” z walidacją `1-99` oraz możliwością wyczyszczenia.


## 3. API

### Zmienione

- **Modele/odpowiedzi dla przepisów**
  - **Co się zmieniło**: do obiektów receptur dodano pole `servings` (`number | null`).

- **`GET /public/recipes`**
  - **Co się zmieniło**: elementy listy zawierają `servings`.

- **`GET /public/recipes/{id}`**
  - **Co się zmieniło**: obiekt szczegółów zawiera `servings`.

- **`GET /recipes`**
  - **Co się zmieniło**: elementy listy zawierają `servings`.

- **`POST /recipes`**
  - **Co się zmieniło**: request może zawierać `servings`; response zwraca `servings`.

- **`POST /recipes/import`**
  - **Co się zmieniło**: response zawiera `servings` (domyślnie `null`).

- **`PUT /recipes/{id}`**
  - **Co się zmieniło**: request może aktualizować `servings` (w tym ustawić `null`).

- **Walidacja**
  - **Co się zmieniło**: `recipes.servings` jest opcjonalne, integer `1-99`, dopuszcza `null`.
