# Load more recipes — zmiany (zamiast paginatora)

## 1. Historyjki użytkownika

### Nowe

- **US-030 — Przycisk „Więcej” do doładowywania list przepisów (zamiast paginatora)**  
  **Co dodano:** Nowa historyjka opisująca zachowanie komponentu listy (`pych-recipe-list`) w widokach `/my-recipies` i `/explore`: start od 12 elementów, dopinanie kolejnych 12, stan ładowania na przycisku, ukrywanie gdy brak kolejnych wyników, reset po zmianie filtrów/sortowania/wyszukiwania, obsługa błędów poprzez Snackbar + możliwość ponowienia.

### Zmienione

- **US-018 — Wyszukiwanie publicznych przepisów (MVP: tylko tekst)**  
  **Co się zmieniło:** Zamiast stronicowania doprecyzowano mechanizm „Więcej”: początkowo 12 wyników i doładowywanie kolejnych porcji przyciskiem.

## 2. Widoki

### Zmienione

- **Publiczny katalog przepisów (Explore) — `/explore`**  
  **Co się zmieniło:** Zastąpiono `mat-paginator` przyciskiem **„Więcej”** pod siatką wyników. Domyślnie ładowane 12 przepisów; kliknięcie doładowuje kolejne 12 i dopina pod listą. Dodano stany: loading (disabled + „Ładowanie…”) i ukrycie przycisku, gdy `hasMore=false`. Zmiana frazy wyszukiwania resetuje listę do pierwszych 12.

- **Lista Przepisów (Moje przepisy) — `/my-recipies` (alias: `/my-recipes`)**  
  **Co się zmieniło:** Usunięto paginację na rzecz przycisku **„Więcej”** (analogicznie: 12 na start, dopinanie kolejnych 12, loading na przycisku, ukrycie gdy brak wyników). Zmiana filtrów/sortowania/wyszukiwania resetuje listę do pierwszych 12.

## 3. API

### Nowe

- **`GET /public/recipes/feed`**  
  **Co dodano:** Endpoint cursor-based przeznaczony pod UX „Load more” dla `/explore`. Parametry m.in. `cursor` i `limit` (domyślnie 12). Odpowiedź zawiera `pageInfo.hasMore` i `pageInfo.nextCursor`.

- **`GET /recipes/feed`**  
  **Co dodano:** Endpoint cursor-based przeznaczony pod UX „Load more” dla `/my-recipies`. Zachowuje semantykę `view` i filtrów jak `GET /recipes`, zwraca `pageInfo.hasMore` oraz `pageInfo.nextCursor`.


