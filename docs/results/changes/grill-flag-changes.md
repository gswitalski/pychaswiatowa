# Grill flag changes

## 1. Historyjki użytkownika

### Zmienione

- **US-003 – Dodawanie nowego przepisu**
    - **Zmiana**: formularz tworzenia zawiera opcjonalną flagę **„Grill”** (checkbox/toggle), domyślnie wyłączoną.

- **US-004 – Przeglądanie szczegółów przepisu**
    - **Zmiana**: jeśli flaga „Grill” jest włączona, w szczegółach widoczna jest metadana z ikonką grilla oraz etykietą **„Grill”** (np. chip/badge).

- **US-005 – Edycja istniejącego przepisu**
    - **Zmiana**: możliwość włączenia/wyłączenia flagi **„Grill”** oraz odtwarzanie stanu po ponownym wejściu w edycję.

- **US-007 – Przeglądanie listy wszystkich przepisów**
    - **Zmiana**: dodany filtr listy po fladze **„Grill”** (tak/nie) obok istniejących filtrów.

### Nowe

- **US-043 – Oznaczenie przepisu jako "Grill" i jego widoczna identyfikacja**
    - **Opis**: użytkownik może oznaczyć przepis jako „Grill” i widzi to oznaczenie na kartach/listach (ikonka grilla z tooltipem „Grill”) oraz w szczegółach (ikonka + etykieta „Grill”).
    - **Kryteria (skrót)**: toggle/checkbox w formularzu, domyślnie wyłączone, trwały zapis, ikonka na kartach/listach, metadana w szczegółach, możliwość wyłączenia.

## 2. Widoki

### Zmienione

- **Formularz przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
    - **Zmiana**: dodana kontrolka **„Grill”** jako opcjonalny toggle/checkbox, domyślnie wyłączona.

- **Szczegóły przepisu (uniwersalny widok)** (`/recipes/:id-:slug`, `/explore/recipes/:id-:slug`)
    - **Zmiana**: jeśli flaga jest włączona, widoczny **badge/chip „Grill” z ikonką grilla** w metadanych.

- **Lista przepisów (Moje przepisy)** (`/my-recipies` / `/my-recipes`)
    - **Zmiana**: dodany filtr (chip) **„Grill”** oraz ikonka grilla na kartach przepisów, jeśli `is_grill=true`.

- **Karta przepisu (`RecipeCardComponent`)**
    - **Zmiana**: karta pokazuje **ikonkę grilla** (Material: `outdoor_grill`) z tooltipem **„Grill”** dla przepisów oznaczonych flagą.

## 3. API

### Zmienione

- **Public recipes – `GET /public/recipes`**
    - **Zmiana**: dodane pole `is_grill` w obiekcie przepisu.
    - **Zmiana**: dodany parametr `filter[grill]` (boolean) – API-ready.

- **Public recipes – `GET /public/recipes/feed`**
    - **Zmiana**: dodane pole `is_grill` w obiektach listy.
    - **Zmiana**: dodany parametr `filter[grill]` (boolean) – API-ready.

- **Public recipes – `GET /public/recipes/{id}`**
    - **Zmiana**: dodane pole `is_grill` w odpowiedzi.

- **Recipes – `GET /recipes`**
    - **Zmiana**: dodane pole `is_grill` w obiektach listy.
    - **Zmiana**: dodany parametr `filter[grill]` (boolean).

- **Recipes – `GET /recipes/feed`**
    - **Zmiana**: dodane pole `is_grill` w obiektach listy.
    - **Zmiana**: dodany parametr `filter[grill]` (boolean).

- **Recipes – `POST /recipes`**
    - **Zmiana**: request wspiera `is_grill` (boolean), a response zwraca `is_grill`.

- **Recipes – `POST /recipes/import`**
    - **Zmiana**: response zwraca `is_grill` (domyślnie `false`).

- **Recipes – `PUT /recipes/{id}`**
    - **Zmiana**: request wspiera `is_grill` (boolean).

- **AI – `POST /ai/recipes/image`**
    - **Zmiana**: request payload wspiera przekazanie `is_grill` w obiekcie `recipe` (dla spójności kontraktu danych wejściowych).

- **Walidacja**
    - **Zmiana**: dodana reguła `recipes.is_grill`: optional boolean, default `false`.


