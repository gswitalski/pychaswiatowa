# normalized-ingredients-worker — zmiany

## 1. Historyjki użytkownika

- **Nowe**
    - **US-048 — Niezawodny worker normalizacji składników (cron + retry + deduplikacja)**: dodano historyjkę definiującą brakujący element systemu (worker), retry/backoff oraz zasadę **1 aktywny job na 1 przepis**.

- **Zmienione**
    - **Wymaganie „Składniki znormalizowane (backend, asynchronicznie)” (sekcja 3.2 PRD)**: doprecyzowano sposób realizacji (kolejka `normalized_ingredients_jobs`, worker jako Supabase Edge Function, cron co minutę z faktycznym interwałem sterowanym env var, retry policy, deduplikacja, brak UI).

## 2. Widoki

- **Zmienione**
    - **`9. Formularz Przepisu (Dodaj/Edytuj)`**: doprecyzowano, że UI **nie pokazuje** statusów/błędów normalizacji składników (MVP), a normalizacja jest backend-only (worker/queue).
    - **`9b. (Dev-only) Podgląd składników znormalizowanych`**: oznaczono jako **poza zakresem MVP** i doprecyzowano, że w ramach tego zakresu **nie implementujemy nowych widoków we froncie**.

## 3. API

- **Nowe**
    - **`POST /internal/workers/normalized-ingredients/run`**: dodano wewnętrzny kontrakt workera (Supabase Scheduled Edge Function) uruchamianego cronem co minutę, z realnym interwałem sterowanym zmienną środowiskową `NORMALIZED_INGREDIENTS_WORKER_RUN_EVERY_MINUTES`, oraz polityką retry/backoff i deduplikacją.

- **Zmienione**
    - **`POST /recipes`**: doprecyzowano, że job normalizacji jest **enqueue lub refresh** (deduplikacja; przeliczenie na najnowszym stanie).
    - **`PUT /recipes/{id}`**: doprecyzowano, że job normalizacji jest **enqueue lub refresh** (deduplikacja; przeliczenie na najnowszym stanie).
    - **`POST /recipes/{id}/normalized-ingredients/refresh`**: doprecyzowano, że endpoint respektuje deduplikację (tworzy job lub odświeża aktywny job).
    - **Sekcja „Resources”**: dodano zasób opisowy **Normalized Ingredients Jobs (internal)**.

