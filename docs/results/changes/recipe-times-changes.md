# Recipe times (prep & total) — zmiany

## 1. Historyjki użytkownika

### Nowe

- **US-040 — Ustawienie i wyświetlanie czasów przygotowania oraz czasu całkowitego**
    - **Co doszło**: dwa opcjonalne pola w minutach (`0-999`) + walidacja `czas całkowity ≥ czas przygotowania` (gdy oba ustawione) + prezentacja w szczegółach przepisu pod opisem z ikonami.

### Zmienione

- **US-003 — Dodawanie nowego przepisu**
    - **Co się zmieniło**: formularz tworzenia zawiera dodatkowo pola: „czas przygotowania (min)” oraz „czas całkowity (min)” (opcjonalne).
- **US-004 — Przeglądanie szczegółów przepisu**
    - **Co się zmieniło**: w szczegółach przepisu (prywatnych) czasy są wyświetlane **pod opisem** z ikonami, jeśli ustawione.
- **US-005 — Edycja istniejącego przepisu**
    - **Co się zmieniło**: dodano edycję czasów (0–999 min), czyszczenie pól oraz walidację zależności `total ≥ prep`.
- **US-019 — Przeglądanie szczegółów publicznego przepisu**
    - **Co się zmieniło**: w szczegółach publicznych czasy są wyświetlane **pod opisem** z ikonami, jeśli ustawione.

## 2. Widoki

### Zmienione

- **Formularz Przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
    - **Co się zmieniło**: w sekcji „Dane podstawowe” dodano pola:
        - „Czas przygotowania (min)” (opcjonalne, `0-999`)
        - „Czas całkowity (min)” (opcjonalne, `0-999`)
    - **Walidacja**: jeśli oba ustawione → `czas całkowity ≥ czas przygotowania` (w przeciwnym razie blokada zapisu + błąd).

- **Szczegóły przepisu (uniwersalny widok)** (`/recipes/:id` oraz `/explore/recipes/:id`)
    - **Co się zmieniło**: pod opisem dodano metadane z ikonami:
        - `schedule` — czas przygotowania
        - `timer` — czas całkowity
    - **Widoczność**: elementy pokazują się tylko, gdy wartość jest ustawiona.

## 3. API

### Zmienione

- **Resource: Recipes / Public Recipes**
    - **Co się zmieniło**: w obiektach przepisu (listy i szczegóły) dodano pola:
        - `prep_time_minutes` (opcjonalne, `integer | null`, zakres `0-999`)
        - `total_time_minutes` (opcjonalne, `integer | null`, zakres `0-999`)

- **`POST /recipes`**
    - **Co się zmieniło**: request wspiera `prep_time_minutes` oraz `total_time_minutes`.

- **`PUT /recipes/{id}`**
    - **Co się zmieniło**: request wspiera `prep_time_minutes` oraz `total_time_minutes`.

- **Walidacje (API)**
    - **Co się zmieniło**: dodano walidację spójności czasów — jeśli oba pola nie są `null`, to `total_time_minutes >= prep_time_minutes`, inaczej `400 Bad Request`.


