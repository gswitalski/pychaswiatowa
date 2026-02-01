# Collections sidebar tree — changes

## 1. Historyjki użytkownika

### Nowe

- **US-055 — Nawigacja po kolekcjach w Sidebarze (drzewo: kolekcje → przepisy)**
    - **Co dodano**:
        - „Kolekcje” w Sidebarze jest drzewem rozwijalnym (poziom 1: Kolekcje → poziom 2: kolekcje → poziom 3: przepisy),
        - lista przepisów kolekcji jest ładowana **leniwe** dopiero po rozwinięciu danej kolekcji,
        - element przepisu pokazuje **nazwę** oraz **małą miniaturę** z ilustracji (jeśli istnieje),
        - kliknięcie przepisu nawiguję do `/recipes/:id-:slug`.

### Zmienione / doprecyzowane

- **US-011 — Tworzenie i zarządzanie kolekcjami przepisów**
    - **Co się zmieniło / doprecyzowano**:
        - `/collections` pozostaje widokiem do zarządzania kolekcjami (lista/tworzenie/edycja/usuwanie),
        - Sidebar zapewnia dodatkową, szybszą ścieżkę nawigacji do przepisów w kolekcji (bez zmiany istniejących flow zarządzania).

## 2. Widoki

### Zmienione / doprecyzowane

- **App Shell — Sidebar: „Kolekcje” jako drzewo**
    - **Co się zmieniło / doprecyzowano**:
        - kliknięcie w etykietę „Kolekcje” prowadzi do `/collections`,
        - chevron obok „Kolekcje” zwija/rozwija (bez nawigacji),
        - po rozwinięciu kolekcji (poziom 2) dociągana jest lista przepisów (poziom 3),
        - element przepisu prezentuje miniaturę (z `image_path`) + nazwę; fallback ikonka gdy brak zdjęcia.

- **Widok: Lista Kolekcji (`/collections`)**
    - **Co się zmieniło / doprecyzowano**:
        - jest osiągalny przez kliknięcie w etykietę „Kolekcje” w Sidebarze (nie przez chevron).

## 3. API

### Nowe

- **`GET /collections/{id}/recipes`**
    - **Co dodano**:
        - endpoint do pobrania listy przepisów w kolekcji w formie „lekko” pod Sidebara (pola: `id`, `name`, `image_path`),
        - wspiera `limit` i stabilne sortowanie (domyślnie `name.asc`).

### Zmienione / doprecyzowane

- **`GET /collections/{id}`**
    - **Co się zmieniło / doprecyzowano**:
        - elementy w `recipes.data` zawierają `image_path`, aby UI mogło renderować miniatury/karty bez dodatkowych zapytań.

