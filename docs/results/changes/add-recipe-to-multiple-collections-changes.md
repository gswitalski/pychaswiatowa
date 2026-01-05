# Add recipe to multiple collections (checkboxes) — changes

## 1. Historyjki użytkownika

- **US-012 – Dodawanie i usuwanie przepisów z kolekcji (zmiana)**:
    - **Co się zmieniło**: doprecyzowano, że akcja „Dodaj do kolekcji” otwiera modal zarządzania przynależnością przepisu do kolekcji w trybie **multi-select** (checkboxy), z pre-selekcją, możliwością zapisu stanu **0 kolekcji** oraz tworzeniem nowej kolekcji bez opuszczania modala.

- **US-044 – Masowe zarządzanie przypisaniem przepisu do kolekcji (nowa)**:
    - **Nowe**: szczegółowa historyjka opisująca UX modala (checkboxy, większy rozmiar, wyszukiwanie po stronie frontendu, zapis atomowy ustawiający docelową listę kolekcji).

## 2. Widoki

- **`AddToCollectionDialogComponent` (zmiana)**:
    - **Co się zmieniło**:
        - zamiast radio buttonów: **lista checkboxów** (wiele zaznaczeń),
        - pre-selekcja kolekcji, w których przepis już jest,
        - dopuszczenie zapisu stanu **0 zaznaczonych**,
        - pole „Szukaj kolekcji” filtrowane **po stronie frontendu** (lista kolekcji ładowana w całości),
        - powiększony dialog (desktop-first) + przewijana lista wewnątrz modala.

## 3. API

- **`GET /recipes/{id}` (zmiana)**:
    - **Co się zmieniło**: dopisano pole `collection_ids: integer[]` (może być puste) do pre-selekcji checkboxów w modalu.

- **`PUT /recipes/{id}/collections` (nowe)**:
    - **Nowe**: atomowe i idempotentne ustawienie docelowej listy kolekcji dla przepisu, w tym wsparcie dla pustej listy `collection_ids`.

- **`POST /collections/{id}/recipes` (zmiana)**:
    - **Co się zmieniło**: dopisano notkę, że dla checkboxowego modala preferowany jest endpoint `PUT /recipes/{id}/collections`.


