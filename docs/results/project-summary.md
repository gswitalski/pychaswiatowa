# Streszczenie dokumentacji projektu PychaŚwiatowa

## O projekcie

PychaŚwiatowa to responsywna aplikacja webowa zaprojektowana dla pasjonatów gotowania, służąca jako centralna, cyfrowa książka kucharska. Jej głównym celem jest umożliwienie użytkownikom łatwego gromadzenia, organizowania i przeszukiwania własnych przepisów kulinarnych w jednym miejscu. Wersja MVP (Minimum Viable Product) skupia się na podstawowych funkcjonalnościach zarządzania przepisami, kategoryzacji, tworzenia kolekcji i wyszukiwania. Aplikacja jest projektowana w podejściu "desktop-first", zapewniając optymalne doświadczenie na większych ekranach, jednocześnie zachowując pełną funkcjonalność na urządzeniach mobilnych.

## Historyjki Użytkownika (PRD)

*   **US-001: Rejestracja nowego użytkownika** – Zakładanie konta e-mail/hasło z weryfikacją adresu e-mail.
*   **US-002: Logowanie i wylogowywanie użytkownika** – Dostęp do konta i kończenie sesji.
*   **US-035: Odczyt roli zalogowanego użytkownika (RBAC)** – Obsługa ról `user`, `premium`, `admin` w JWT.
*   **US-033: Ponowna wysyłka linku weryfikacyjnego** – Możliwość resendu linku aktywacyjnego.
*   **US-034: Obsługa nieważnego lub wygasłego linku weryfikacyjnego** – Komunikaty i ponowna wysyłka.
*   **US-003: Dodawanie nowego przepisu** – Formularz z polami podstawowymi, składnikami, krokami i wskazówkami.
*   **US-004: Przeglądanie szczegółów przepisu** – Wyświetlanie przepisu, zdjęć, metadanych i instrukcji.
*   **US-005: Edycja istniejącego przepisu** – Modyfikacja wszystkich danych przepisu, w tym zdjęcia (paste/drop).
*   **US-047: Automatyczne tworzenie składników znormalizowanych** – Backendowy proces normalizacji składników przy zapisie.
*   **US-048: Niezawodny worker normalizacji składników** – Asynchroniczna kolejka i przetwarzanie (cron/retry).
*   **US-049: Automatyczna lista zakupów na podstawie „Mojego planu”** – Generowanie listy zakupów ze składników znormalizowanych.
*   **US-050: Aktualizacja listy zakupów przy usuwaniu przepisu z planu** – Odejmowanie ilości składników.
*   **US-051: Odhaczanie posiadanych pozycji na liście zakupów** – Oznaczanie kupionych produktów.
*   **US-052: Dodawanie ręcznych pozycji do listy zakupów** – Własne wpisy tekstowe użytkownika.
*   **US-045: Dodawanie i edycja wskazówek do przepisu** – Opcjonalna sekcja z poradami (tipami).
*   **US-027: Szybka zmiana zdjęcia przepisu** – Wklejanie ze schowka lub przeciąganie pliku.
*   **US-037: Generowanie zdjęcia przepisu (AI) w edycji** – Generowanie obrazu z treści przepisu (Premium).
*   **US-046: Generowanie zdjęcia AI z referencją** – Generowanie nowego zdjęcia na bazie istniejącego jako inspiracji (Premium).
*   **US-006: Usuwanie przepisu** – Trwałe (lub soft) usuwanie przepisu.
*   **US-007: Przeglądanie listy wszystkich przepisów** – Lista własnych oraz publicznych przepisów z kolekcji użytkownika.
*   **US-029: Oznaczenie przepisu jako "Termorobot"** – Flaga i badge dla przepisów na roboty kuchenne.
*   **US-043: Oznaczenie przepisu jako "Grill"** – Flaga i ikonka dla przepisów grillowych.
*   **US-025: Oznaczenie cudzych przepisów** – Wyróżnienie przepisów "W moich kolekcjach".
*   **US-008: Obsługa pustej listy przepisów** – Ekran "Empty state" z zachętą do działania.
*   **US-009: Wyszukiwanie przepisów** – Szukanie po nazwie, składnikach, tagach i wskazówkach.
*   **US-010: Organizowanie przepisu za pomocą kategorii i tagów** – Klasyfikacja przepisów.
*   **US-011: Tworzenie i zarządzanie kolekcjami przepisów** – Własne zbiory tematyczne.
*   **US-012: Dodawanie i usuwanie przepisów z kolekcji** – Zarządzanie zawartością kolekcji (modal).
*   **US-044: Masowe zarządzanie przypisaniem do kolekcji** – Modal z checkboxami do wielu kolekcji naraz.
*   **US-038: Dodanie przepisu do „Mojego planu” z widoku szczegółów** – Szybkie planowanie posiłków.
*   **US-039: Przeglądanie i zarządzanie listą „Mój plan”** – Panel boczny z zaplanowanymi przepisami.
*   **US-031: Wyświetlanie wszystkich przepisów kolekcji bez paginacji** – Pełna lista w widoku kolekcji.
*   **US-013: Importowanie nowego przepisu z tekstu** – Parsowanie wklejonego tekstu do struktury przepisu.
*   **US-036: Asystowane dodawanie przepisu z tekstu lub obrazu (AI)** – Wstępne wypełnianie formularza przez AI.
*   **US-014: Globalna nawigacja i orientacja (App Shell)** – Sidebar, Topbar, Breadcrumbs.
*   **US-015: Spójny pasek akcji (Page Header)** – Ujednolicony nagłówek z tytułem i akcjami.
*   **US-016: Zarządzanie widocznością przepisu** – Statusy Prywatny / Współdzielony / Publiczny.
*   **US-032: Podgląd widoczności mojego przepisu na liście** – Ikonka statusu na karcie przepisu.
*   **US-017: Landing dla gościa** – Wyszukiwanie i promowane sekcje dla niezalogowanych.
*   **US-018: Wyszukiwanie publicznych przepisów** – Dostęp dla gości (tylko tekst).
*   **US-044 (duplikat ID): Ranking wyników wyszukiwania publicznego** – Sortowanie po trafności (relevance).
*   **US-030: Przycisk „Więcej” do doładowywania list** – Paginacja typu "Load more".
*   **US-019: Przeglądanie szczegółów publicznego przepisu** – Widok dostępny dla wszystkich.
*   **US-041: Kanoniczny link do przepisu** – URL z ID i slugiem (SEO-friendly).
*   **US-042: Klasyfikacja przepisu** – Typ diety, kuchnia, stopień trudności.
*   **US-028: Ustawienie i wyświetlanie liczby porcji** – Opcjonalne pole z ilością porcji.
*   **US-040: Ustawienie i wyświetlanie czasów** – Czas przygotowania i całkowity.
*   **US-020: Publiczne widoki w trybie zalogowanego** – Brak CTA logowania dla użytkowników.
*   **US-021: Dodanie publicznego przepisu do kolekcji z widoku publicznego** – Zapisywanie inspiracji.
*   **US-022: Oznaczenie moich publicznych przepisów** – Badge "Twój przepis" w katalogu.
*   **US-023: Wejście do "Moja Pycha" z Topbara** – Szybki powrót do dashboardu.
*   **US-026: Wejście do "Odkrywaj przepisy" z Topbara** – Szybkie przejście do katalogu.
*   **US-024: Publiczne szczegóły przepisu bez sidebara** – Widok pod `/explore/...`.

> Pełna treść: [004 prd.md](./004%20prd.md)

## Tech Stack

*   **Frontend**: Angular 20, TypeScript, Sass, Angular Material.
*   **Backend (BaaS)**: Supabase (PostgreSQL, Authentication, Storage).
*   **Testowanie**: Vitest (Unit/Integration), Playwright (E2E).
*   **CI/CD**: GitHub Actions.

> Pełna treść: [006 Tech Stack.md](./006%20Tech%20Stack.md)

## Plan Bazy Danych

### Struktura Tabel

*   **`profiles`**: `id` (FK auth.users), `username`, `created_at`, `updated_at`.
*   **`categories`**: `id`, `name`, `created_at`.
*   **`recipes`**: `id`, `user_id`, `category_id`, `name`, `description`, `servings`, `image_path`, `ingredients` (jsonb), `steps` (jsonb), `created_at`, `updated_at`, `deleted_at`.
*   **`tags`**: `id`, `user_id`, `name`, `created_at`.
*   **`collections`**: `id`, `user_id`, `name`, `description`, `created_at`, `updated_at`.
*   **`recipe_tags`** (junction): `recipe_id`, `tag_id`.
*   **`recipe_collections`** (junction): `recipe_id`, `collection_id`.

> Pełna treść: [008 DB Plan.md](./008%20DB%20Plan.md)

## API Plan

### Authentication (Supabase Auth)
*   `POST /auth/signup` – Rejestracja użytkownika.
*   `POST /auth/login` – Logowanie e-mail/hasło.
*   `POST /auth/resend` – Ponowna wysyłka e-maila weryfikacyjnego.
*   `GET /auth/callback` – Callback weryfikacji e-maila.

### Public Recipes
*   `GET /public/recipes` – Lista przepisów publicznych (paginacja page/limit).
*   `GET /public/recipes/feed` – Lista przepisów publicznych (kursor, load more).
*   `GET /public/recipes/{id}` – Szczegóły przepisu publicznego.

### Utilities
*   `POST /utils/slugify` – Generowanie sluga z tekstu.

### Recipes
*   `GET /recipes` – Lista przepisów użytkownika (własne + z kolekcji).
*   `GET /recipes/feed` – Feed przepisów użytkownika (kursor).
*   `POST /recipes` – Tworzenie nowego przepisu.
*   `POST /recipes/import` – Import przepisu z tekstu (backend parsing).
*   `GET /recipes/{id}` – Szczegóły przepisu (prywatne/współdzielone).
*   `PUT /recipes/{id}` – Aktualizacja przepisu.
*   `DELETE /recipes/{id}` – Usunięcie przepisu (soft delete).
*   `POST /recipes/{id}/image` – Upload zdjęcia przepisu.
*   `DELETE /recipes/{id}/image` – Usunięcie zdjęcia przepisu.
*   `PUT /recipes/{id}/collections` – Ustawienie kolekcji dla przepisu (atomic).
*   `GET /recipes/{id}/normalized-ingredients` – Pobranie składników znormalizowanych.
*   `POST /recipes/{id}/normalized-ingredients/refresh` – Wymuszenie odświeżenia normalizacji (dev).

### AI & Internal
*   `POST /ai/recipes/draft` – Generowanie draftu przepisu z tekstu lub obrazu.
*   `POST /ai/recipes/normalized-ingredients` – Normalizacja listy składników.
*   `POST /ai/recipes/image` – Generowanie zdjęcia przepisu (Premium).
*   `POST /internal/workers/normalized-ingredients/run` – Worker przetwarzający kolejkę normalizacji.

### Categories & Tags
*   `GET /categories` – Lista kategorii predefiniowanych.
*   `GET /tags` – Lista tagów użytkownika.

### Collections
*   `GET /collections` – Lista kolekcji użytkownika.
*   `POST /collections` – Tworzenie kolekcji.
*   `GET /collections/{id}` – Szczegóły kolekcji i lista przepisów (bez paginacji).
*   `PUT /collections/{id}` – Edycja kolekcji.
*   `DELETE /collections/{id}` – Usunięcie kolekcji.
*   `POST /collections/{id}/recipes` – Dodanie przepisu do kolekcji.
*   `DELETE /collections/{id}/recipes/{recipeId}` – Usunięcie przepisu z kolekcji.

### My Plan (Mój plan)
*   `GET /plan` – Pobranie listy planu (max 50).
*   `POST /plan/recipes` – Dodanie przepisu do planu.
*   `DELETE /plan/recipes/{recipeId}` – Usunięcie przepisu z planu.
*   `DELETE /plan` – Wyczyszczenie planu.

### Shopping List (Zakupy)
*   `GET /shopping-list` – Pobranie listy zakupów.
*   `POST /shopping-list/items` – Dodanie pozycji ręcznej.
*   `PATCH /shopping-list/items/{id}` – Edycja pozycji (np. odhaczenie).
*   `DELETE /shopping-list/items/{id}` – Usunięcie pozycji ręcznej.

### Search & Dashboard & Profile
*   `GET /search/global` – Globalne wyszukiwanie (Omnibox).
*   `GET /dashboard/summary` – Podsumowanie dla dashboardu (statystyki).
*   `GET /profile` – Pobranie profilu.
*   `PUT /profile` – Aktualizacja profilu.
*   `GET /me` – Pobranie danych sesji/tożsamości.

> Pełna treść: [009 API plan.md](./009%20API%20plan.md)

## High-Level UI Plan

### Widoki Publiczne
*   **Landing Page (`/`)** – Strona główna z wyszukiwarką i sekcjami promowanymi.
*   **Explore (`/explore`)** – Katalog publiczny z listą typu "load more".
*   **Szczegóły Przepisu (`/explore/recipes/:id-:slug`)** – Widok publiczny bez sidebara.
*   **Logowanie / Rejestracja (`/login`, `/register`)** – Formularze auth.
*   **Weryfikacja e-mail (`/register/verify-sent`, `/email-confirmed`)** – Ekrany statusu weryfikacji.

### Widoki Prywatne (App Shell)
*   **Moja Pycha (`/dashboard`)** – Dashboard nawigacyjny z kafelkami.
*   **Moje Przepisy (`/my-recipies`)** – Lista własnych i kolekcjonowanych przepisów z filtrami.
*   **Szczegóły Przepisu (`/recipes/:id-:slug`)** – Pełny widok z akcjami (Edytuj, Do planu, Do kolekcji).
*   **Kreator Przepisu (`/recipes/new/start`, `/assist`)** – Wybór trybu (Pusty / AI) i wstępne przetwarzanie.
*   **Formularz Edycji (`/recipes/new`, `/recipes/:id/edit`)** – Formularz z polami, listami i uploadem zdjęć.
*   **Import (`/recipes/import`)** – Prosty widok do wklejania tekstu przepisu.
*   **Kolekcje (`/collections`)** – Lista kolekcji.
*   **Szczegóły Kolekcji (`/collections/:id`)** – Pełna lista przepisów w kolekcji.
*   **Ustawienia (`/settings`)** – Edycja profilu.
*   **Drawer „Mój plan”** – Wysuwany panel z listą planowanych przepisów.
*   **Zakupy (`/shopping`)** – Lista zakupów (składniki z planu + ręczne).
*   **Forbidden (`/forbidden`)** – Strona błędu uprawnień.

### Nawigacja
*   **Sidebar** – Tylko w części prywatnej: Moja Pycha, Przepisy, Kolekcje, Zakupy, Ustawienia.
*   **Topbar** – Globalny: Zakładki (Moja Pycha, Odkrywaj), Omnibox, Profil.
*   **Page Header** – Kontekstowy: Tytuł i akcje widoku.

> Pełna treść: [011 High-Level UI Plan.md](./011%20High-Level%20UI%20Plan.md)
