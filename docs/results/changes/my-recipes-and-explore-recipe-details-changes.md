# My recipes & explore recipe details — changes

## 1. Historyjki użytkownika

- **US-007 — Przeglądanie listy wszystkich przepisów**
    - **Zmiana:** strona „Moje przepisy” jest chroniona i docelowo działa pod ścieżką `/my-recipes` (opcjonalnie `/recipes` jako alias/redirect).

- **US-014 — Globalna nawigacja i orientacja (App Shell)**
    - **Zmiana:** zakres widoczności Sidebara rozszerzony o `/my-recipes`.

- **US-019 — Przeglądanie szczegółów publicznego przepisu**
    - **Zmiana:** publiczny widok szczegółów jest pod `/explore/recipes/:id` oraz nie wyświetla Sidebara.
    - **Zmiana:** zasady dostępu do niepublicznych przepisów na ścieżce publicznej: `404` dla gościa i nie-autora; `200` dla zalogowanego autora.

- **US-020 — Publiczne widoki w trybie zalogowanego (App Shell)**
    - **Zmiana:** aktualizacja ścieżki szczegółów w sekcji publicznej na `/explore/recipes/:id`.

- **US-024 — Publiczne szczegóły przepisu bez sidebara pod `/explore/recipes/:id`**
    - **Nowe:** uszczegółowienie wymagań dla publicznych szczegółów przepisu z regułą „PUBLIC lub autor” oraz przejściem do edycji dla autora.

## 2. Widoki

- **Lista „Moje przepisy”**
    - **Zmiana:** docelowa ścieżka `/my-recipes` (chroniona, wejście z Sidebara po zalogowaniu). (Opcjonalnie) `/recipes` jako alias/redirect.

- **Szczegóły przepisu (prywatne)**
    - **Zmiana:** `/recipes/:id` pozostaje **chronione** (dostęp tylko dla autora) i działa w layoucie z Sidebarem.

- **Szczegóły przepisu (publiczne / explore)**
    - **Nowe/zmiana:** `/explore/recipes/:id` jest **niechronione** i działa w layoucie publicznym **bez Sidebara**, ale wyświetla treść przepisu tak samo jak widok prywatny.
    - **Zmiana:** jeśli przepis nie jest publiczny, widok zwraca `404` dla gościa i nie-autora; autor (zalogowany) widzi przepis.

## 3. API

- **GET `/explore/recipes/{id}`**
    - **Nowe:** endpoint dla publicznej ścieżki szczegółów.
    - **Zasada dostępu:** `PUBLIC` dla wszystkich; nie-`PUBLIC` tylko dla zalogowanego autora; w pozostałych przypadkach `404`.

- **GET `/public/recipes/{id}`**
    - **Bez zmian funkcjonalnych:** pozostaje stricte publiczny (`PUBLIC` only), zgodnie z dotychczasowym kontraktem.
