# Termorobot flag changes

## 1. Historyjki użytkownika

### Zmienione

- **US-003 – Dodawanie nowego przepisu**
  - **Zmiana**: formularz tworzenia zawiera opcjonalną flagę **„Termorobot”** (checkbox/toggle), domyślnie wyłączoną.

- **US-005 – Edycja istniejącego przepisu**
  - **Zmiana**: możliwość włączenia/wyłączenia flagi **„Termorobot”** oraz odtwarzanie stanu po ponownym wejściu w edycję.

- **US-007 – Przeglądanie listy wszystkich przepisów**
  - **Zmiana**: dodany filtr listy po fladze **„Termorobot”** (tak/nie).

### Nowe

- **US-029 – Oznaczenie przepisu jako "Termorobot" i jego widoczna identyfikacja**
  - **Opis**: użytkownik może oznaczyć przepis jako „Termorobot” i widzi to oznaczenie na listach oraz w szczegółach.
  - **Kryteria (skrót)**: toggle/checkbox w formularzu, domyślnie wyłączone, trwały zapis, badge/chip „Termorobot” na kartach/listach oraz w szczegółach, możliwość wyłączenia.

## 2. Widoki

### Zmienione

- **Formularz przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
  - **Zmiana**: dodana kontrolka **„Termorobot (Thermomix/Lidlomix)”** jako opcjonalny toggle/checkbox, domyślnie wyłączona.

- **Szczegóły przepisu (uniwersalny widok)** (`/recipes/:id`, `/explore/recipes/:id`)
  - **Zmiana**: jeśli flaga jest włączona, widoczny **badge/chip „Termorobot”** w metadanych.

- **Lista przepisów (Moje przepisy)** (`/my-recipies` / `/my-recipes`)
  - **Zmiana**: dodany filtr (chip) **„Termorobot”** oraz badge/chip „Termorobot” na kartach przepisów.

- **Karta przepisu (`RecipeCardComponent`)**
  - **Zmiana**: karta pokazuje dodatkowy badge/chip „Termorobot” dla przepisów oznaczonych flagą.

## 3. API

### Zmienione

- **Public recipes – `GET /public/recipes`**
  - **Zmiana**: dodane pole `is_termorobot` w obiekcie przepisu.
  - **Zmiana**: dodany parametr `filter[termorobot]` (boolean) – API-ready.

- **Public recipes – `GET /public/recipes/{id}`**
  - **Zmiana**: dodane pole `is_termorobot` w odpowiedzi.

- **Recipes – `GET /recipes`**
  - **Zmiana**: dodane pole `is_termorobot` w obiektach listy.
  - **Zmiana**: dodany parametr `filter[termorobot]` (boolean).

- **Recipes – `POST /recipes`**
  - **Zmiana**: request wspiera `is_termorobot` (boolean), a response zwraca `is_termorobot`.

- **Recipes – `POST /recipes/import`**
  - **Zmiana**: response zwraca `is_termorobot` (domyślnie `false`).

- **Recipes – `PUT /recipes/{id}`**
  - **Zmiana**: request wspiera `is_termorobot` (boolean).

- **Walidacja**
  - **Zmiana**: dodana reguła `recipes.is_termorobot`: optional boolean, default `false`.
