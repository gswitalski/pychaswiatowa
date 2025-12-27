# AI Recipe Image Model Upgrade (gpt-image-1.5) - Changes

## 1. Historyjki użytkownika

- **Zmienione**
    - **3.2. Zarządzanie przepisami (CRUD) – Generowanie zdjęcia (AI, premium)**:
        - Doprecyzowano parametry techniczne generowania: model **`gpt-image-1.5`**, format **`image/webp` 1024×1024**, `background=auto`, `quality=auto`, `n=1`.
    - **US-037: Generowanie zdjęcia przepisu (AI) w edycji – tylko premium**
        - Dodano kryterium techniczne: model **`gpt-image-1.5`** oraz parametry wyjścia (jak wyżej).

## 2. Widoki

- **Zmienione**
    - **9. Formularz Przepisu (Dodaj/Edytuj)**:
        - Doprecyzowano parametry techniczne generowania (model i format wyjściowy) bez zmian w przepływie UX.
    - **9a. Modal: Podgląd wygenerowanego zdjęcia (AI)**:
        - Doprecyzowano, że akcja „Wygeneruj ponownie” oznacza kolejną próbę (ponowne wywołanie generowania), nadal w trybie `n=1`.

## 3. API

- **Zmienione**
    - **POST `/ai/recipes/image` (Supabase Edge Function)**:
        - Zmieniono model generowania z `dall-e-3` na **`gpt-image-1.5`** (OpenAI Images API `POST /v1/images/generations`).
        - Doprecyzowano parametry wyjścia (MVP): **`image/webp` 1024×1024**, `background=auto`, `quality=auto`, `n=1`, `stream=false`.
        - **Kontrakt endpointu bez zmian**: nadal zwracany jest podgląd jako base64 (`image.data_base64`).


