# AI Recipe Image Generation - Changes

## 1. Historyjki użytkownika

- **Nowe**
    - **US-037: Generowanie zdjęcia przepisu (AI) w edycji – tylko premium**
        - Dodano historyjkę opisującą przycisk AI przy polu zdjęcia, generowanie na podstawie aktualnego stanu formularza (także niezapisane zmiany), podgląd oraz świadome „Zastosuj/Odrzuć”.
        - Dodano kontrakt stylu: realistyczne, rustykalny drewniany stół, naturalne światło, brak ludzi/rąk, brak tekstu, brak watermarków.

- **Zmienione**
    - **3.2. Zarządzanie przepisami (CRUD) – Aktualizacja (Update)**: dodano punkt o generowaniu zdjęcia AI jako funkcji dostępnej dla `premium` (lub `admin`).

## 2. Widoki

- **Zmienione**
    - **9. Formularz Przepisu (Dodaj/Edytuj)**: dodano przycisk z ikoną AI przy sekcji zdjęcia (widoczny/aktywny tylko dla roli `premium`/`admin`) oraz przepływ: generowanie → modal podglądu → „Zastosuj/Odrzuć” + Snackbar „Cofnij”.

- **Nowe**
    - **9a. Modal: Podgląd wygenerowanego zdjęcia (AI)**: modal/dialog prezentujący wynik generowania i wymuszający potwierdzenie przed zastąpieniem zdjęcia.

## 3. API

- **Nowe**
    - **POST `/ai/recipes/image` (Supabase Edge Function)**:
        - Generuje zdjęcie na podstawie bieżących danych formularza i zwraca podgląd jako `image/webp` w `data_base64`.
        - Autoryzacja: wymagane JWT, a funkcja dostępna tylko dla `app_role = premium | admin` (dla `user` zwraca `403`).

- **Bez zmian (re-użyte)**
    - **POST `/recipes/{id}/image`**: wykorzystywany do finalnego ustawienia wygenerowanego zdjęcia po akcji „Zastosuj” (upload wygenerowanego pliku).


