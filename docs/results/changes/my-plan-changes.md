# My Plan ("Mój plan") - zmiany

Poniższy dokument opisuje elementy **nowe lub zmienione** w ramach funkcjonalności **My Plan ("Mój plan")**.

## 1. Historyjki użytkownika

- **Nowe: US-038 – Dodanie przepisu do „Mojego planu” z widoku szczegółów**
    - Dodano nową akcję na szczegółach przepisu: „Dodaj do planu” → (spinner) → „Zobacz listę”.
    - Dodano wymaganie: brak duplikatów oraz limit **50** elementów.

- **Nowe: US-039 – Przeglądanie i zarządzanie listą „Mój plan”**
    - Drawer z listą (miniatura + nazwa + kosz), wyczyszczenie listy, zamknięcie, overlay zamykający po kliknięciu.
    - Pływający przycisk „Mój plan” widoczny, gdy lista ma ≥ 1 element.

- **Zmienione: Sekcja 3.3 „Organizacja przepisów” w PRD**
    - Dodano nowy element funkcjonalny: **„Mój plan (lista)”** jako trwała lista użytkownika z limitem 50 i unikalnością elementów.

## 2. Widoki

- **Zmienione: Widok szczegółów przepisu (`/recipes/:id` oraz `/explore/recipes/:id`)**
    - **Co się zmieniło:** dla zalogowanego dodano akcję „Dodaj do planu” obok „Dodaj do kolekcji”.
    - **Stany przycisku:** „Dodaj do planu” → spinner → „Zobacz listę” (z ikoną sukcesu). Jeśli przepis już jest w planie: od razu „Zobacz listę”.

- **Nowe: Drawer „Mój plan” (globalny panel wysuwany, bez osobnej trasy)**
    - Drawer wysuwany z prawej strony, z overlay przyciemniającym tło i zamykaniem po kliknięciu w overlay.
    - Nagłówek drawer’a: „Wyczyść” (ikona kosza) + „Zamknij” (X).
    - Lista: miniatura + nazwa + kosz do usunięcia; klik w wiersz przenosi do szczegółów przepisu.
    - Kolejność: ostatnio dodane na górze.
    - Pływający przycisk „Mój plan” w prawym dolnym rogu widoczny, gdy plan ma ≥ 1 element.

## 3. API

- **Nowe: zasób „My Plan”**
    - Trwała lista per użytkownik, **unikalna**, z limitem **50**.

- **Nowe endpointy:**
    - `GET /plan` – pobranie listy planu (najnowsze pierwsze) + meta (limit 50).
    - `POST /plan/recipes` – dodanie przepisu do planu (409 dla duplikatu, 422 dla przekroczenia limitu).
    - `DELETE /plan/recipes/{recipeId}` – usunięcie pojedynczego przepisu z planu.
    - `DELETE /plan` – wyczyszczenie całej listy.

- **Zmienione endpointy (helper field):**
    - **Co się zmieniło:** dodano pole pomocnicze `in_my_plan` w odpowiedziach, aby UI mogło od razu ustawić stan przycisku na szczegółach przepisu.
    - Dotyczy (gdy żądanie jest uwierzytelnione): `GET /public/recipes`, `GET /public/recipes/feed`, `GET /public/recipes/{id}`, `GET /recipes`, `GET /recipes/feed`, `GET /recipes/{id}`.


