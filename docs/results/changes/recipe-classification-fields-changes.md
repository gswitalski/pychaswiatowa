# Recipe Classification Fields (Typ diety / Kuchnia / Trudność) — Zmiany

## 1. Historyjki użytkownika

### Nowe

- **US-042 — Klasyfikacja przepisu (typ diety, kuchnia, trudność)**: dodano możliwość opcjonalnego ustawiania pól klasyfikacyjnych (listy kontrolowane) oraz ich wyświetlanie jako metadane w szczegółach przepisu.

### Zmienione

- **US-003 — Dodawanie nowego przepisu**: formularz tworzenia rozszerzony o pola opcjonalne: typ diety, kuchnia (lista kontrolowana), stopień trudności.
- **US-004 — Przeglądanie szczegółów przepisu**: szczegóły przepisu rozszerzone o wyświetlanie ustawionych wartości pól klasyfikacyjnych jako metadane; brak wartości nie jest wyświetlany.
- **US-005 — Edycja istniejącego przepisu**: edycja rozszerzona o możliwość ustawiania i czyszczenia pól: typ diety, kuchnia, stopień trudności.

## 2. Widoki

### Zmienione

- **Formularz przepisu (Dodaj/Edytuj)**: dodano 3 pola opcjonalne w sekcji danych podstawowych:
    - typ diety: Mięso / Wege / Vegan
    - kuchnia: Polska / Azjatycka / Meksykańska / Bliskowschodnia
    - stopień trudności: Łatwe / Średnie / Trudne
  Zmiana: pola są wybierane z list kontrolowanych i można je wyczyścić (brak wartości).

- **Szczegóły przepisu**: dodano metadane (np. chipy/badge) prezentujące ustawione wartości pól klasyfikacyjnych.
  Zmiana: brak „pustych” placeholderów — jeśli wartość nie jest ustawiona, nie jest pokazywana.

## 3. API

### Zmienione

- **Obiekty `Recipe` w odpowiedziach**: rozszerzono o pola:
    - `diet_type`: `MEAT | VEGETARIAN | VEGAN` (nullable)
    - `cuisine`: `POLISH | ASIAN | MEXICAN | MIDDLE_EASTERN` (nullable)
    - `difficulty`: `EASY | MEDIUM | HARD` (nullable)
  Zmiana: pola są zwracane w listach oraz w szczegółach przepisu.

- **`POST /recipes`**: request payload rozszerzony o `diet_type`, `cuisine`, `difficulty` (opcjonalne).
- **`PUT /recipes/{id}`**: request payload rozszerzony o `diet_type`, `cuisine`, `difficulty` (opcjonalne).

- **Endpointy listujące**: dodano „API-ready” filtry:
    - `filter[diet_type]`
    - `filter[cuisine]`
    - `filter[difficulty]`
  Dotyczy:
    - `GET /recipes`
    - `GET /recipes/feed`
    - `GET /public/recipes`
    - `GET /public/recipes/feed`

