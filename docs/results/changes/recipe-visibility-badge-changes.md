# Recipe visibility badge (ikonka widoczności) — zmiany

## 1. Historyjki użytkownika

- **Nowe**: **US-032 — Podgląd widoczności mojego przepisu na liście (ikonka na karcie)**
    - Na kartach przepisów w listach (np. `/my-recipies`, `/explore`) dla przepisu mojego autorstwa widoczna jest ikonka reprezentująca aktualną wartość `visibility` (`Prywatny` / `Współdzielony` / `Publiczny`) wraz z tooltipem.
    - Ikonka jest wyłącznie informacyjna (brak zmiany widoczności z listy w MVP).
    - Dla przepisów nie mojego autorstwa ikonka nie jest wyświetlana.

## 2. Widoki

- **Zmienione**: **Publiczny katalog przepisów (Explore) `/explore`**
    - Dodano regułę UI: dla `is_owner=true` karta przepisu pokazuje ikonkę widoczności na podstawie `visibility` + tooltip.

- **Zmienione**: **Lista Przepisów (Moje przepisy) `/my-recipies`**
    - Dodano regułę UI: dla `is_owner=true` karta przepisu pokazuje ikonkę widoczności na podstawie `visibility` + tooltip.

- **Zmienione**: **Komponent `RecipeCardComponent`**
    - Rozszerzono opis: karta może pokazywać ikonkę widoczności (tylko dla właściciela) oraz uwzględniono użycie komponentu także w `/explore`.

## 3. API

- **Zmienione**: **`GET /public/recipes`**
    - Dodano do elementów listy pola: `visibility` oraz `is_owner` (true/false; wymaga uwierzytelnienia, inaczej `false`).
    - Doprecyzowano zachowanie: dla gościa zwracane są wyłącznie przepisy `PUBLIC`, ale dla zalogowanego endpoint może zwrócić także jego własne przepisy o `visibility != PUBLIC` (np. `PRIVATE`, `SHARED`) — wyłącznie gdy `is_owner=true`.

- **Zmienione**: **`GET /public/recipes/feed`**
    - Dodano do elementów listy pola: `visibility` oraz `is_owner` (true/false; wymaga uwierzytelnienia, inaczej `false`).
    - Doprecyzowano zachowanie: dla gościa zwracane są wyłącznie przepisy `PUBLIC`, ale dla zalogowanego endpoint może zwrócić także jego własne przepisy o `visibility != PUBLIC` (np. `PRIVATE`, `SHARED`) — wyłącznie gdy `is_owner=true`.

- **Bez zmian (już było)**: **`GET /recipes` / `GET /recipes/feed`**
    - Endpointy już zwracały `visibility` oraz pola pomocnicze właściciela (`is_owner`).


