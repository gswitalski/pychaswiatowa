# Public recipes search relevance - changes

## 1. Historyjki użytkownika

### US-018 — Wyszukiwanie publicznych przepisów (MVP: tylko tekst)
- **Status**: zmieniona
- **Co się zmieniło**:
    - dodano minimalną długość frazy: **3 znaki** (po trim),
    - zdefiniowano semantykę wielowyrazową jako **AND**,
    - doprecyzowano dopasowanie tagów: **pełna nazwa** lub **prefix**,
    - dodano domyślny ranking **najlepszego dopasowania** (nazwa → składniki → tagi; wagi 3/2/1),
    - dla pustej frazy widok zachowuje się jak feed,
    - UI pokazuje etykietę: „Dopasowanie: nazwa / składniki / tagi”.

### US-044 — Ranking wyników wyszukiwania publicznych przepisów (relevance)
- **Status**: nowa
- **Opis skrócony**: wyniki dla zapytań ≥ 3 znaki są sortowane domyślnie po relevance (wagi 3/2/1), z rozstrzyganiem remisów stabilnie (np. `created_at.desc`) oraz z etykietą źródła dopasowania w UI.

## 2. Widoki

### Landing Page (`/`)
- **Status**: zmieniony opis
- **Co się zmieniło**:
    - doprecyzowano, że pasek wyszukiwania publicznego to komponent **`pych-public-recipes-search`**,
    - zdefiniowano zasady uruchamiania wyszukiwania: **min 3 znaki**, debounce ~300–400 ms,
    - dla pustej frazy (po trim) landing nie wykonuje wyszukiwania (zachowuje się jak feed/sekcje kuratorowane),
    - sortowanie wyników (gdy `q` jest poprawne) po **najlepszym dopasowaniu**.

### Publiczny katalog przepisów (Explore) (`/explore`)
- **Status**: zmieniony opis
- **Co się zmieniło**:
    - doprecyzowano: **min 3 znaki**, **AND**, tag exact/prefix,
    - dla niepustej frazy: sortowanie domyślne po **relevance (3/2/1)**,
    - dla pustej frazy: widok działa jak feed (np. `created_at.desc`),
    - dodano wymóg etykiety na kartach: **„Dopasowanie: …”** (jedno najlepsze źródło dopasowania).

## 3. API

### `GET /public/recipes`
- **Status**: zmieniony
- **Co się zmieniło**:
    - `q`: minimalna długość zmieniona z **2** na **3** znaki (po trim),
    - doprecyzowano semantykę wielowyrazową jako **AND**,
    - doprecyzowano dopasowanie tagów jako exact/prefix,
    - doprecyzowano zachowanie sortowania: dla poprawnego `q` domyślnie **relevance** (wagi 3/2/1), dla pustego/krótkiego `q` — feed,
    - dodano pole pomocnicze w odpowiedzi: `search` (np. `relevance_score`, `match`) do zasilenia etykiety UI „Dopasowanie: …”.

### `GET /public/recipes/feed`
- **Status**: zmieniony
- **Co się zmieniło**:
    - analogicznie jak w `GET /public/recipes`: `q` min **3**, AND, tag exact/prefix,
    - domyślne sortowanie po relevance dla poprawnego `q` (wagi 3/2/1),
    - dodano `search` w odpowiedzi dla UI.


