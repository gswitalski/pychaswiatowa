## 1. Historyjki użytkownika

### US-031 — Wyświetlanie wszystkich przepisów kolekcji bez paginacji (nowe)
- **Opis**: użytkownik po wejściu w kolekcję widzi od razu pełną listę jej przepisów, bez doładowywania kolejnych porcji.
- **Kluczowe kryteria**:
  - Brak paginatora i brak przycisku „Więcej” w `/collections/:id`.
  - Czytelny stan ładowania (np. skeleton listy/siatki).
  - Stan pusty dla kolekcji bez przepisów + akcja powrotu (np. do `/collections`).
  - Czytelne komunikaty dla `403`/`404`.
  - Obsługa limitu technicznego API (jeśli backend ogranicza liczbę zwracanych elementów).

## 2. Widoki

### Szczegóły Kolekcji (zmienione)
- **Gdzie**: `/collections/:id`
- **Co się zmieniło**: lista przepisów kolekcji **nie jest stronicowana w UI** — na wejściu ładowane są od razu wszystkie przepisy kolekcji (w ramach limitu technicznego API, jeśli dotyczy). Usunięto potrzebę „Więcej”/paginacji dla tego widoku; dodano wymagania dot. loadera, stanu pustego i błędów dostępu.

## 3. API

### `GET /collections/{id}` (zmienione)
- **Co się zmieniło**: endpoint nie opisuje już paginacji listy przepisów kolekcji. Zamiast tego zwraca listę w jednym batchu, z bezpiecznym limitem (`limit`, domyślnie 500) oraz `pageInfo.truncated`, aby UI mogło poinformować użytkownika, jeśli wynik został ucięty technicznie.

