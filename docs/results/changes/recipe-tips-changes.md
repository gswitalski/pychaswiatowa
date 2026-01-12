# Recipe tips (wskazówki) — zmiany

## 1. Historyjki użytkownika

### Nowe

- **US-045 — Dodawanie i edycja wskazówek do przepisu**
    - **Co doszło**: opcjonalna lista „Wskazówki” (jak składniki: elementy + nagłówki `#`) edytowalna w formularzu; w szczegółach przepisu wyświetlana jako osobna sekcja **pod krokami** (ukryta, gdy pusta).

### Zmienione

- **US-003 — Dodawanie nowego przepisu**
    - **Co się zmieniło**: w formularzu dodawania dodano pole/sekcję „Wskazówki” (opcjonalne) oraz reguły parsowania analogiczne jak dla składników/kroków (nowe linie = elementy, `#` = nagłówki).
- **US-004 — Przeglądanie szczegółów przepisu**
    - **Co się zmieniło**: w szczegółach przepisu wskazówki (jeśli istnieją) są widoczne jako osobna sekcja **pod listą kroków przygotowania**; brak wskazówek → brak sekcji.
- **US-005 — Edycja istniejącego przepisu**
    - **Co się zmieniło**: dodano możliwość dodawania/edycji/usuwania wskazówek tak samo jak składników i kroków.
- **US-009 — Wyszukiwanie przepisów**
    - **Co się zmieniło**: wyszukiwanie obejmuje także wskazówki; priorytet dopasowania wskazówek jest najniższy.

## 2. Widoki

### Zmienione

- **Formularz Przepisu (Dodaj/Edytuj)** (`/recipes/new`, `/recipes/:id/edit`)
    - **Co się zmieniło**: dodano sekcję **„Wskazówki (opcjonalnie)”** edytowaną tym samym mechanizmem co składniki/kroki (lista z nagłówkami `#`).

- **Szczegóły przepisu (uniwersalny widok)** (`/recipes/:id-:slug`, `/explore/recipes/:id-:slug`)
    - **Co się zmieniło**: dodano sekcję **„Wskazówki”** jako odrębny blok **pod krokami przygotowania**; sekcja jest ukryta, gdy lista jest pusta.

- **Publiczny katalog przepisów (Explore)** (`/explore`)
    - **Co się zmieniło**: w opisie transparentności dopasowania rozszerzono etykietę o **„wskazówki”**; relevance uwzględnia wskazówki jako najniższy priorytet.

- **Dodaj przepis (Kreator – AI z tekstu/zdjęcia)** (`/recipes/new/assist`)
    - **Co się zmieniło**: draft z AI może wstępnie wypełnić także wskazówki (jeśli zostaną wywnioskowane).

## 3. API

### Zmienione

- **Resource: Recipes / Public Recipes**
    - **Co się zmieniło**: obiekt przepisu (szczegóły) zawiera dodatkowo `tips: Array<{ type: "header" | "item", content: string }>` (może być pusty).

- **`POST /recipes`**
    - **Co się zmieniło**: request wspiera `tips_raw` (opcjonalne), a response zawiera sparsowane `tips`.

- **`PUT /recipes/{id}`**
    - **Co się zmieniło**: analogicznie — aktualizacja wspiera `tips_raw` (opcjonalne) i zapisuje `tips`.

- **`GET /public/recipes` / `GET /public/recipes/feed`**
    - **Co się zmieniło**: parametr `q` przeszukuje także wskazówki; relevance rozszerzono o wagi `name(3) > ingredients(2) > tags(1) > tips(0.5)`.

- **`POST /ai/recipes/draft`**
    - **Co się zmieniło**: odpowiedź draft może zawierać `tips_raw` (opcjonalnie), jeśli model potrafi je wywnioskować.

- **`POST /recipes/import`**
    - **Co się zmieniło**: wprost doprecyzowano, że wskazówki nie są importowane w MVP → `tips` pozostaje puste i użytkownik uzupełnia je w edycji.

