# AI-assisted recipe creation — zmiany

## 1. Historyjki użytkownika

- **Nowe**
    - **US-036 — Asystowane dodawanie przepisu z tekstu lub obrazu (AI)**: nowy flow „kreatora” (wybór trybu → wklejenie tekstu/obrazu → wstępne wypełnienie formularza). Zawiera walidację „pojedynczego przepisu”, fallback do pustego formularza przy braku wejścia oraz obsługę błędów i stanów ładowania.

- **Zmienione**
    - **Granice produktu (sekcja 4 w PRD)**: doprecyzowano, że AI/LLM nadal jest poza zakresem MVP w większości zastosowań, ale dodano **wyjątek** dla asystowanego dodawania przepisu z tekstu/obrazu (AI prefill).
    - **Wymagania funkcjonalne (sekcja 3.2 w PRD)**: dodano pozycję „Asystowane dodawanie (AI)” opisującą nowe zachowanie.

## 2. Widoki

- **Nowe**
    - **`/recipes/new/start` — Dodaj przepis (Kreator – wybór trybu)**: ekran wyboru „Pusty formularz” vs „Z tekstu/zdjęcia (AI)”.
    - **`/recipes/new/assist` — Dodaj przepis (Kreator – AI z tekstu/zdjęcia)**: ekran wklejania danych wejściowych (tryb albo tekst, albo obraz), przycisk „Dalej”, walidacja i obsługa błędów.

- **Zmienione**
    - **Widok listy przepisów (`/my-recipies`) — Header**: zamiast split button („Ręcznie | Import”) opisano przycisk „Dodaj przepis” otwierający kreator oraz akcję pomocniczą „Import”.
    - **Mapa podróży użytkownika**: krok tworzenia przepisu uwzględnia przejście przez kreator i opcjonalne wstępne wypełnienie formularza przez AI.

## 3. API

- **Nowe**
    - **Resource**: „AI Recipe Draft (Supabase Edge Function)” — draft do prefillu formularza, bez persystencji.
    - **Endpoint**: **`POST /ai/recipes/draft`** (Supabase Edge Function) — generuje draft przepisu z tekstu albo obrazu (OCR + LLM), zwraca JSON z polami do prefillu (`name`, `description`, `ingredients_raw`, `steps_raw`, `category_name`, `tags`) oraz obsługuje błąd walidacji „to nie jest pojedynczy przepis” (`422`).

