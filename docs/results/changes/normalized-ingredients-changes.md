# Normalized Ingredients – zmiany w wymaganiach (feature)

## 1. Historyjki użytkownika

- **Nowe**
    - **US-047 – Automatyczne tworzenie składników znormalizowanych przy zapisie przepisu**
        - Dodano historyjkę opisującą asynchroniczne generowanie i zapis listy składników znormalizowanych po każdym `POST/PUT` przepisu.

- **Zmienione**
    - Brak (nowy zakres funkcjonalny dodany jako osobna historyjka).

## 2. Widoki

- **Nowe**
    - **9b. (Dev-only) Podgląd składników znormalizowanych**
        - Ścieżka: `/dev/recipes/:id/normalized-ingredients`
        - Widok diagnostyczny dla dev/test: status normalizacji + tabela `ilosc/jednostka/nazwa` + akcja „Odśwież normalizację”.

- **Zmienione**
    - **9. Formularz Przepisu (Dodaj/Edytuj)**
        - Dodano notatkę, że normalizacja składników jest backend-only i wykonywana asynchronicznie po zapisie; UI w MVP jej nie wyświetla.

## 3. API

- **Nowe**
    - **`POST /ai/recipes/normalized-ingredients` (Supabase Edge Function)**
        - Endpoint do normalizacji listy składników (przewidziany głównie dla jobów/workerów backendowych).
    - **`GET /recipes/{id}/normalized-ingredients`**
        - Pobranie znormalizowanych składników przepisu + status.
    - **`POST /recipes/{id}/normalized-ingredients/refresh`**
        - Ręczne zlecenie ponownej normalizacji (dev/test).

- **Zmienione**
    - **`POST /recipes`**
        - Doprecyzowano, że po zapisie backend asynchronicznie zleca wyliczenie `normalized_ingredients` (nie blokuje zapisu).
        - Przykładowa odpowiedź rozszerzona o pola: `normalized_ingredients_status`, `normalized_ingredients_updated_at`.
    - **`PUT /recipes/{id}`**
        - Doprecyzowano, że po zapisie backend asynchronicznie zleca ponowne wyliczenie `normalized_ingredients` (nie blokuje zapisu).
    - **Business Logic**
        - Dodano sekcję opisującą reguły normalizacji: dozwolone jednostki (z `pęczek`), konwersje tylko masa/objętość, fallback „tylko nazwa” dla niejednoznacznych pozycji, ignorowanie nagłówków sekcji.

