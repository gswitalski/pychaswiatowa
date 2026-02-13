# PychaŚwiatowa - Podsumowanie Projektu

> Dokument referencyjny dla programistów i analityków planujących nowe funkcjonalności.
> Zawiera streszczenie PRD, tech stack, strukturę bazy danych, listę endpointów API, widoki UI oraz plan testów.

---

## 1. Opis Projektu (streszczenie PRD)

**PychaŚwiatowa** to responsywna aplikacja webowa (SPA) zaprojektowana jako centralna, cyfrowa książka kucharska. Użytkownicy mogą gromadzić, organizować i przeszukiwać własne przepisy kulinarne w jednym miejscu.

### Główne założenia MVP

- Podejście **desktop-first** z pełną responsywnością (mobile/tablet)
- System kont z potwierdzeniem e-mail i rolami (`user`, `premium`, `admin`) w JWT
- Pełny CRUD przepisów z formularzem zawierającym: nazwę, opis, porcje, czasy, flagi (Termorobot/Grill), klasyfikację (dieta/kuchnia/trudność), składniki, kroki, wskazówki, zdjęcie
- Trzy poziomy widoczności przepisu: Prywatny, Współdzielony, Publiczny
- Organizacja: kategorie (predefiniowane), tagi (własne), kolekcje (nazwane zbiory przepisów)
- "Mój plan" - trwała lista do 50 przepisów, powiązana z listą zakupów
- Lista zakupów - pozycje z przepisów (znormalizowane składniki) + ręczne wpisy
- Import przepisu z Markdown oraz asystowane dodawanie z AI (tekst/obraz -> formularz)
- Generowanie zdjęć AI (premium) - model `gpt-image-1.5`
- Publiczny portal: landing z wyszukiwaniem, katalog `/explore`, kanoniczne URL ze slugiem
- Asynchroniczna normalizacja składników (worker cron + retry)

### Granice MVP (poza zakresem)

- Import z linków URL, automatyczne planowanie posiłków, zamienniki AI
- Zarządzanie spiżarnią
- Funkcje społecznościowe (znajomi, komentarze, oceny)
- Zaawansowane wartości odżywcze, drag&drop kolejności kroków, historia zmian
- Rozbudowany panel administracyjny, zarządzanie rolami z UI

---

## 2. User Stories

| ID | Tytuł | Krótki opis |
|---|---|---|
| US-001 | Rejestracja nowego użytkownika | Tworzenie konta (email, username, hasło) z potwierdzeniem e-mail. Bez auto-logowania. |
| US-002 | Logowanie i wylogowywanie | Logowanie email+hasło, wylogowanie. Blokada logowania bez potwierdzonego maila. |
| US-033 | Ponowna wysyłka linku weryfikacyjnego | Akcja "Wyślij ponownie" z cooldown 60s i limitem dziennym. |
| US-034 | Obsługa nieważnego/wygasłego linku | Komunikat + możliwość wysłania nowego linku z tego ekranu. |
| US-035 | Odczyt roli użytkownika (RBAC) | Rola w JWT (`user`/`premium`/`admin`). Fundament pod przyszłe feature gating. |
| US-003 | Dodawanie nowego przepisu | Formularz: nazwa, opis, porcje, czasy, flagi, klasyfikacja, składniki, kroki, wskazówki, zdjęcie. Parsowanie tekstu po nowych liniach, `#` jako nagłówki sekcji. |
| US-004 | Przeglądanie szczegółów przepisu | Dwukolumnowy układ (desktop), metadane jako chipy/badge, numeracja kroków ciągła. |
| US-005 | Edycja istniejącego przepisu | Formularz wstępnie wypełniony, zmiana zdjęcia (paste/drop/file), walidacja czasów. |
| US-006 | Usuwanie przepisu | Soft-delete z potwierdzeniem modalnym. |
| US-007 | Przeglądanie listy przepisów | "Moje przepisy" = własne + publiczne cudze z moich kolekcji. Sortowanie, filtrowanie, load more. |
| US-008 | Obsługa pustej listy | Empty state z CTA "Dodaj pierwszy przepis". |
| US-009 | Wyszukiwanie przepisów | Wyszukiwanie od 3 znaków, AND, priorytet: nazwa(3) > składniki(2) > tagi(1) > wskazówki(0.5). |
| US-010 | Kategorie i tagi | Jedna kategoria z listy + dowolne tagi tekstowe ("pigułki"). |
| US-011 | Tworzenie i zarządzanie kolekcjami | CRUD kolekcji. Usunięcie kolekcji nie usuwa przepisów. |
| US-012 | Dodawanie/usuwanie przepisów z kolekcji | Modal z checkboxami, masowe zarządzanie, tworzenie nowej kolekcji w modalu. |
| US-013 | Import przepisu z tekstu | Wklejanie Markdown, parsowanie `#`/`##`/`###`/`-`, redirect do edycji. |
| US-016 | Zarządzanie widocznością | Prywatny/Współdzielony/Publiczny w formularzu. |
| US-017 | Landing dla gościa | Pole wyszukiwania + sekcje z publicznymi przepisami + CTA logowanie/rejestracja. |
| US-018 | Wyszukiwanie publicznych przepisów | Tylko tekst, min 3 znaki, wyłącznie `PUBLIC`, ranking relevance. |
| US-019 | Szczegóły publicznego przepisu | Pełny widok bez sidebara, kanoniczny URL `/explore/recipes/:id-:slug`. |
| US-020 | Publiczne widoki w trybie zalogowanego | Bez CTA logowania, nawigacja zalogowanego, akcja "Dodaj do kolekcji". |
| US-021 | Dodanie publicznego przepisu do kolekcji | Akcja z widoku publicznego, modal wyboru kolekcji. |
| US-022 | Oznaczenie moich przepisów w katalogu | Badge "Twój przepis" na kartach w `/explore`. |
| US-025 | Oznaczenie cudzych przepisów w kolekcjach | Chip "W moich kolekcjach", brak Edytuj/Usuń dla nie-autora. |
| US-027 | Szybka zmiana zdjęcia (paste/drop) | Strefa zdjęcia: Ctrl+V, drag&drop, auto-upload, Undo. |
| US-028 | Liczba porcji | Opcjonalne pole 1-99, wyświetlane pod tytułem z odmianą. |
| US-029 | Flaga "Termorobot" | Toggle w formularzu, badge na kartach/listach. |
| US-030 | Przycisk "Więcej" (load more) | Domyślnie 12 elementów, doładowywanie kolejnych 12. |
| US-031 | Przepisy kolekcji bez paginacji | Jednorazowe ładowanie (limit techniczny 500). |
| US-032 | Ikonka widoczności na liście | Ikona Prywatny/Współdzielony/Publiczny z tooltipem, tylko dla autora. |
| US-036 | Asystowane dodawanie (AI) | Wklejenie tekstu/obrazu -> LLM -> wstępnie wypełniony formularz. |
| US-037 | Generowanie zdjęcia AI (premium) | Przycisk AI w edycji, podgląd, akceptacja, `gpt-image-1.5`, 1024x1024 webp. |
| US-038 | Dodanie do "Mojego planu" | Przycisk na szczegółach, limit 50, stany: dodaj/spinner/zobacz listę. |
| US-039 | Przeglądanie "Mojego planu" | Drawer z prawej, lista z miniaturami, usuwanie, czyszczenie, FAB. |
| US-040 | Czasy przygotowania/całkowity | Opcjonalne 0-999 min, walidacja całkowity >= przygotowania. |
| US-041 | Kanoniczny URL ze slugiem | `/recipes/:id-:slug`, transliteracja polskich znaków, normalizacja. |
| US-042 | Klasyfikacja przepisu | Dieta (Mięso/Wege/Vegan), kuchnia (lista), trudność (Łatwe/Średnie/Trudne). |
| US-043 | Flaga "Grill" | Toggle w formularzu, ikonka grilla na kartach. |
| US-044 | Masowe zarządzanie kolekcjami | Modal z checkboxami, szukanie, tworzenie kolekcji, atomowy zapis. |
| US-045 | Wskazówki do przepisu | Opcjonalna sekcja pod krokami, edytowalna lista z nagłówkami. |
| US-046 | Generowanie zdjęcia AI z referencją | Automatyczny tryb: bez zdjęcia / z referencją zdjęcia. |
| US-047 | Normalizacja składników (async) | Przy zapisie: job -> AI -> `recipe_normalized_ingredients`. |
| US-048 | Worker normalizacji | Cron 1min, retry 5x z backoff, deduplikacja per recipe_id. |
| US-049 | Lista zakupów z planu | Dodanie do planu -> wiersze zakupowe ze składników znormalizowanych. |
| US-050 | Aktualizacja zakupów przy usuwaniu z planu | Usunięcie z planu -> usunięcie wierszy zakupowych tego przepisu. |
| US-051 | Odhaczanie posiadanych | Checkbox, posiadane na dole listy, wyszarzone. Grupowanie frontendowe. |
| US-052 | Ręczne pozycje zakupów | Pole tekstowe + "Dodaj", oznaczanie jako posiadane, usuwanie. |
| US-053 | Usuwanie pozycji z przepisu | Usunięcie grupy (`nazwa`+`jednostka`+`is_owned`), Undo, nie modyfikuje planu. |
| US-054 | Wyczyść listę zakupów | Przycisk w headerze, modal potwierdzenia, nie modyfikuje planu. |
| US-055 | Drzewo kolekcji w Sidebarze | 3 poziomy: Kolekcje -> kolekcja -> przepisy, lazy-load, miniatura+nazwa. |
| US-056 | Bottom Bar (mobile/tablet) | 3 pozycje: Odkrywaj, Moja Pycha, Zakupy. Breakpoint ~960px. |
| US-057 | Stopka + strony prawne | Footer na wszystkich stronach. `/legal/terms`, `/legal/privacy`, `/legal/publisher`. |

---

## 3. Tech Stack

### Frontend

- **Angular 20** - framework SPA (komponentowa architektura, routing, TypeScript)
- **TypeScript** - statyczne typowanie
- **Sass** - preprocesor CSS (zmienne, zagnieżdżenia, mixiny)
- **Angular Material** - biblioteka komponentów UI

### Backend i Baza Danych (BaaS)

- **Supabase** (open-source, oparty na PostgreSQL):
    - **PostgreSQL** - baza danych z auto-generowanym REST API
    - **Authentication** - rejestracja, logowanie, sesje (email+hasło), RLS
    - **Storage** - przechowywanie zdjęć przepisów
    - **Edge Functions** - AI draft, normalizacja składników, generowanie zdjęć

### Testowanie

- **Vitest** - testy jednostkowe i integracyjne (szybkie, kompatybilne z Jest API)
- **Playwright** - testy E2E (multi-browser: Chromium, Firefox, WebKit)

### CI/CD

- **GitHub + GitHub Actions** - automatyczne budowanie, testowanie (Vitest + Playwright) i wdrażanie po każdym push

---

## 4. Struktura Bazy Danych (streszczenie DB Plan)

Backend działa na **PostgreSQL (Supabase)**. Stosowane jest **miękkie usuwanie** (soft delete) przepisów (`deleted_at`). Składniki i kroki przechowywane w formacie **JSONB**. Dostęp do danych chroniony przez **Row Level Security (RLS)**.

### Tabele

#### `profiles`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` PK, FK → `auth.users` | Klucz powiązany z auth.users |
| `username` | `text` (3-50 znaków) | Nazwa użytkownika |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas aktualizacji |

#### `categories`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `bigint` PK | Identyfikator |
| `name` | `text` UNIQUE | Nazwa (np. "Obiad", "Deser") |
| `created_at` | `timestamptz` | Czas utworzenia |

#### `recipes`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `bigint` PK | Identyfikator przepisu |
| `user_id` | `uuid` FK → `auth.users` | Właściciel przepisu |
| `category_id` | `bigint` FK → `categories` | Kategoria (opcjonalnie) |
| `name` | `text` (1-150 znaków) | Nazwa przepisu |
| `description` | `text` | Opis (opcjonalnie) |
| `servings` | `smallint` (1-99) | Liczba porcji (opcjonalnie) |
| `image_path` | `text` | Ścieżka do zdjęcia w Storage |
| `ingredients` | `jsonb` | Lista składników (`[{type, content}]`) |
| `steps` | `jsonb` | Lista kroków (`[{type, content}]`) |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas aktualizacji |
| `deleted_at` | `timestamptz` | Soft delete (null = aktywny) |

> **Uwaga:** Dodatkowe kolumny w recipes (z PRD/API, nie wymienione w oryginalnym DB Plan):
> `prep_time_minutes`, `total_time_minutes`, `is_termorobot`, `is_grill`, `diet_type`, `cuisine`, `difficulty`, `visibility`, `tips` (jsonb), `normalized_ingredients_status`, `normalized_ingredients_updated_at`

#### `tags`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `bigint` PK | Identyfikator tagu |
| `user_id` | `uuid` FK → `auth.users` | Właściciel tagu |
| `name` | `text` (1-50 znaków) | Nazwa tagu (UNIQUE per user, case-insensitive) |
| `created_at` | `timestamptz` | Czas utworzenia |

#### `collections`
| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `bigint` PK | Identyfikator kolekcji |
| `user_id` | `uuid` FK → `auth.users` | Właściciel kolekcji |
| `name` | `text` (1-100 znaków) | Nazwa (UNIQUE per user) |
| `description` | `text` | Opis (opcjonalnie) |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas aktualizacji |

#### Tabele łączące

| Tabela | Kolumny | Opis |
|---|---|---|
| `recipe_tags` | `recipe_id`, `tag_id` (PK) | Przepisy ↔ Tagi (N:M) |
| `recipe_collections` | `recipe_id`, `collection_id` (PK) | Przepisy ↔ Kolekcje (N:M) |

### Relacje

```
auth.users 1:1 profiles
auth.users 1:N recipes, tags, collections
categories 1:N recipes
recipes N:M tags (via recipe_tags)
recipes N:M collections (via recipe_collections)
```

### Format JSONB (składniki/kroki/wskazówki)

```json
[
  { "type": "header", "content": "Nagłówek sekcji" },
  { "type": "item", "content": "Element listy" }
]
```

### Kluczowe indeksy

- `recipes(user_id)` - filtrowanie per user
- `recipes(name)` - sortowanie alfabetyczne
- `recipes(created_at)` - sortowanie po dacie
- GIN na `tsvector(name, ingredients)` - wyszukiwanie pełnotekstowe
- `tags(user_id, lower(name))` - unikalność tagów
- `recipe_tags(tag_id)` - wyszukiwanie po tagu
- `recipe_collections(collection_id)` - wyszukiwanie w kolekcji

### RLS (Row Level Security)

- Włączone na wszystkich tabelach z danymi użytkowników
- SELECT/INSERT/UPDATE/DELETE: `auth.uid() = user_id`
- Tabele łączące: wymagana własność powiązanego przepisu i tagu/kolekcji
- Zapytania SELECT na `recipes` filtrują `deleted_at IS NULL`

---

## 5. Endpointy API

Prywatne endpointy wymagają JWT (`Authorization: Bearer <token>`). Publiczne endpointy zwracają tylko przepisy `visibility = 'PUBLIC'` (dla anonimowych). JWT zawiera claim `app_role` (`user`/`premium`/`admin`).

### Autentykacja (Supabase Auth)

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/auth/signup` | Rejestracja (email, hasło, username). Wysyła link weryfikacyjny. Domyślna rola: `user`. |
| `POST` | `/auth/login` | Logowanie (email, hasło). Zwraca JWT z `app_role`. |
| `POST` | `/auth/resend` | Ponowna wysyłka linku weryfikacyjnego. Rate limit 429. |
| `GET` | `/auth/callback` | (Frontend) Callback po kliknięciu linku z e-maila. Redirect do `/email-confirmed` lub `/email-confirmation-invalid`. |

### Przepisy publiczne

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/public/recipes` | Lista publicznych przepisów (paginacja offset). Filtry: `q`, `termorobot`, `grill`, `diet_type`, `cuisine`, `difficulty`. Relevance ranking. |
| `GET` | `/public/recipes/feed` | Lista publicznych przepisów (paginacja cursor, load more po 12). Te same filtry co wyżej. |
| `GET` | `/public/recipes/{id}` | Szczegóły publicznego przepisu. Dla auth: `is_owner`, `in_my_plan`, `collection_ids`. |

### Przepisy (prywatne, auth required)

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/recipes` | Lista przepisów użytkownika (paginacja offset). `view=owned\|my_recipes`. Filtry: category, tags, termorobot, grill, diet_type, cuisine, difficulty, search. |
| `GET` | `/recipes/feed` | Lista przepisów (cursor, load more). Te same filtry. |
| `POST` | `/recipes` | Tworzenie przepisu. Parsowanie `ingredients_raw`, `steps_raw`, `tips_raw`. Async job normalizacji składników. |
| `POST` | `/recipes/import` | Import z tekstu Markdown. Zwraca nowy przepis. |
| `GET` | `/recipes/{id}` | Szczegóły przepisu. Helper fields: `is_owner`, `in_my_collections`, `in_my_plan`, `collection_ids`. |
| `PUT` | `/recipes/{id}` | Aktualizacja przepisu. Async job normalizacji. |
| `DELETE` | `/recipes/{id}` | Soft-delete przepisu (`deleted_at`). `204 No Content`. |
| `POST` | `/recipes/{id}/image` | Upload zdjęcia (multipart). PNG/JPG/WebP, max 10 MB. |
| `DELETE` | `/recipes/{id}/image` | Usunięcie zdjęcia. |
| `PUT` | `/recipes/{id}/collections` | Atomowe ustawienie listy kolekcji dla przepisu (`collection_ids`). |
| `GET` | `/recipes/{id}/normalized-ingredients` | Znormalizowane składniki (status, items). Tylko właściciel. |
| `POST` | `/recipes/{id}/normalized-ingredients/refresh` | Ponowne kolejkowanie normalizacji (dev/test). `202 Accepted`. |

### AI (Supabase Edge Functions)

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/ai/recipes/draft` | Draft przepisu z tekstu lub obrazu (OCR+LLM). Nie zapisuje. Zwraca JSON z polami formularza. |
| `POST` | `/ai/recipes/normalized-ingredients` | Normalizacja składników (wywoływana przez worker, nie przez UI). |
| `POST` | `/ai/recipes/image` | Generowanie zdjęcia AI. Wymaga `premium`/`admin`. Tryb: `recipe_only` / `with_reference`. Zwraca base64 webp 1024x1024. |

### Worker wewnętrzny

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/internal/workers/normalized-ingredients/run` | Cron co 1 min. Przetwarza joby normalizacji (`PENDING`/`RETRY`). Max 5 prób, backoff. Wewnętrzny (nie dla klienta). |

### Kategorie, Tagi

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/categories` | Lista predefiniowanych kategorii. |
| `GET` | `/tags` | Lista tagów użytkownika. |

### Kolekcje

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/collections` | Lista kolekcji użytkownika. |
| `POST` | `/collections` | Tworzenie kolekcji (nazwa, opis). `409` jeśli duplikat nazwy. |
| `GET` | `/collections/{id}` | Kolekcja + lista przepisów (bez paginacji UI, limit 500). |
| `GET` | `/collections/{id}/recipes` | Przepisy kolekcji - minimalne dane (id, name, image_path) dla Sidebara. |
| `PUT` | `/collections/{id}` | Aktualizacja kolekcji. |
| `DELETE` | `/collections/{id}` | Usunięcie kolekcji (nie usuwa przepisów). |
| `POST` | `/collections/{id}/recipes` | Dodanie przepisu do kolekcji. |
| `DELETE` | `/collections/{collectionId}/recipes/{recipeId}` | Usunięcie przepisu z kolekcji. |

### Mój Plan

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/plan` | Lista przepisów w planie (max 50, `added_at.desc`). |
| `POST` | `/plan/recipes` | Dodanie do planu. Side effect: tworzy wiersze na liście zakupów. `422` przy limicie 50. |
| `DELETE` | `/plan/recipes/{recipeId}` | Usunięcie z planu. Side effect: usuwa powiązane wiersze zakupów. |
| `DELETE` | `/plan` | Wyczyszczenie całego planu. |

### Lista Zakupów

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/shopping-list` | Lista zakupów (surowe wiersze). Grupowanie na frontendzie po `(nazwa, jednostka, is_owned)`. |
| `POST` | `/shopping-list/items` | Dodanie ręcznej pozycji (tekst). |
| `PATCH` | `/shopping-list/items/{id}` | Toggle `is_owned` (posiadane). |
| `DELETE` | `/shopping-list/items/{id}` | Usunięcie pozycji ręcznej (`MANUAL`). |
| `DELETE` | `/shopping-list/recipe-items/group` | Usunięcie grupy pozycji z przepisów (`nazwa`+`unit`+`is_owned`). Body: `{name, unit, is_owned}`. |
| `DELETE` | `/shopping-list` | Wyczyszczenie całej listy zakupów (nie modyfikuje planu). |

### Wyszukiwanie, Dashboard, Profil

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/search/global` | Omnibox: szybkie wyszukiwanie po przepisach i kolekcjach (min 2 znaki). |
| `GET` | `/dashboard/summary` | Podsumowanie dashboardu (statystyki, ostatnie przepisy). |
| `GET` | `/profile` | Profil użytkownika. |
| `PUT` | `/profile` | Aktualizacja profilu (username). |
| `GET` | `/me` | Minimalne dane sesji (id, username, app_role). Bootstrap App Shell. |

### Utilities

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/utils/slugify` | Generowanie sluga z tekstu. Transliteracja polskich znaków, max 80 znaków, fallback "przepis". |

---

## 6. Widoki UI (streszczenie High-Level UI Plan)

Architektura: **App Shell** z Sidebar + Topbar + Page Header + Footer. Desktop-first, Bottom Bar na mobile/tablet (<960px).

### Widoki publiczne

| Widok | Ścieżka | Opis |
|---|---|---|
| Landing Page | `/` | Strona powitalna: wyszukiwarka publicznych przepisów, sekcje z przepisami (Najnowsze, Popularne), CTA logowanie/rejestracja. Dla zalogowanych: nawigacja zalogowanego, brak CTA logowania. |
| Katalog Explore | `/explore` | Przeglądanie publicznych przepisów, wyszukiwanie tekstowe (min 3 zn., ranking relevance), load more po 12. Badge "Twój przepis" dla zalogowanego autora. |
| Szczegóły przepisu (publiczny) | `/explore/recipes/:id-:slug` | Pełny widok przepisu bez Sidebara. Gość: CTA do logowania. Zalogowany nie-autor: "Dodaj do kolekcji"/"Dodaj do planu". Autor: pełne akcje. Normalizacja URL. |
| Logowanie | `/login` | Formularz email+hasło. Obsługa niepotwierdzonego e-maila. |
| Rejestracja | `/register` | Formularz: username, email, hasło, potwierdzenie hasła. |
| Wysłano link weryfikacyjny | `/register/verify-sent` | Komunikat + "Wyślij ponownie" (cooldown 60s). |
| Auth callback | `/auth/callback` | Techniczny handler: finalizacja weryfikacji -> redirect. |
| E-mail potwierdzony | `/email-confirmed` | Komunikat sukcesu + link do logowania. |
| Link nieważny/wygasły | `/email-confirmation-invalid` | Komunikat + akcja "Wyślij nowy link". |
| Warunki korzystania | `/legal/terms` | Statyczna strona z regulaminem (placeholder w MVP). |
| Polityka prywatności | `/legal/privacy` | Statyczna strona (placeholder w MVP). |
| Wydawca serwisu | `/legal/publisher` | Statyczna strona (placeholder w MVP). |

### Widoki prywatne (auth required)

| Widok | Ścieżka | Opis |
|---|---|---|
| Moja Pycha (Dashboard) | `/dashboard` | Strona startowa po logowaniu: kafelki nawigacyjne, ostatnie przepisy. |
| Moje Przepisy | `/my-recipies` (alias `/my-recipes`) | Lista przepisów: własne + publiczne z moich kolekcji. Filtry (kategoria, tag, Termorobot, Grill), sortowanie, load more po 12. Badge "W moich kolekcjach", ikonki widoczności. Przycisk "Dodaj przepis" (kreator). |
| Szczegóły przepisu (prywatny) | `/recipes/:id-:slug` | Jak widok publiczny, ale z Sidebarem. Pełne akcje dla autora. Normalizacja URL. |
| Kreator - wybór trybu | `/recipes/new/start` | Opcje: "Pusty formularz" lub "Z tekstu/zdjęcia (AI)". |
| Kreator - AI | `/recipes/new/assist` | Wklejenie tekstu/obrazu -> przetwarzanie AI -> wstępnie wypełniony formularz. |
| Formularz przepisu | `/recipes/new`, `/recipes/:id/edit` | Tworzenie/edycja: dane, składniki, kroki, wskazówki, zdjęcie (paste/drop/file/AI), widoczność. Sticky "Zapisz". |
| Import przepisu | `/recipes/import` | Wklejanie Markdown, live preview, redirect do edycji. |
| Lista kolekcji | `/collections` | Zarządzanie kolekcjami (CRUD). Wejście z Sidebara "Kolekcje". |
| Szczegóły kolekcji | `/collections/:id` | Wszystkie przepisy kolekcji (bez paginacji, limit 500). Usuwanie z kolekcji. |
| Zakupy | `/shopping` | Lista zakupów: pozycje z planu (zgrupowane) + ręczne. Odhaczanie, usuwanie, czyszczenie listy. |
| Ustawienia | `/settings` | Zmiana username, hasła. |
| Brak dostępu | `/forbidden` | Komunikat 403 (przyszłościowo: role premium/admin). |

### Komponenty globalne / overlay

| Komponent | Opis |
|---|---|
| Drawer "Mój plan" | Panel wysuwany z prawej: lista przepisów w planie (miniatura+nazwa+kosz), wyczyść, zamknij. |
| FAB "Mój plan" | Pływający przycisk (prawy dolny róg), widoczny gdy plan ≥1 element. |
| Bottom Bar | Mobile/tablet (<960px): 3 pozycje (Odkrywaj, Moja Pycha, Zakupy). |
| Footer | Globalna stopka: copyright + linki do `/legal/*`. |
| Sidebar (drzewo kolekcji) | 3 poziomy: Kolekcje -> kolekcja -> przepisy. Lazy-load, miniatura+nazwa. |
| Modal "Dodaj do kolekcji" | Multi-select checkboxami, wyszukiwanie, tworzenie nowej kolekcji, atomowy zapis. |

---

## 7. Plan Testów (streszczenie)

### Strategia

Piramida testów: solidna baza jednostkowych, uzupełniona integracjami i E2E.

| Poziom | Narzędzie | Cel |
|---|---|---|
| **Jednostkowe** | Vitest | Izolowane testy komponentów, serwisów, potoków. Logika biznesowa, walidacja. |
| **Integracyjne** | Vitest | Współpraca komponent+serwis. Mockowany backend Supabase. |
| **E2E** | Playwright | Pełne scenariusze użytkownika w przeglądarce (Chromium, Firefox, WebKit). |
| **UI/Responsywność** | Ręcznie + Playwright | Layout na różnych rozdzielczościach, spójność Angular Material. |
| **Bezpieczeństwo** | Ręcznie | Ochrona tras (AuthGuard), RLS, przechowywanie JWT, odporność XSS. |

### Kluczowe scenariusze E2E

1. Rejestracja -> potwierdzenie e-mail -> logowanie
2. Pełny cykl życia przepisu: tworzenie -> lista -> szczegóły -> edycja -> usuwanie
3. Kolekcje: tworzenie kolekcji -> dodawanie przepisu -> przeglądanie -> usuwanie

### Środowiska

| Środowisko | Opis |
|---|---|
| Lokalne | Maszyna deweloperska, Supabase CLI, testy unit+integracyjne |
| CI/CD | GitHub Actions: automatyczne testy po push |
| Dev/Staging | Pełna instancja na Firebase Hosting + Supabase dev, testy E2E + manualne |
| Produkcja | Smoke tests po wdrożeniu |

### Kryteria jakości

- Pokrycie kodu testami jednostkowymi: **≥80%**
- Wszystkie krytyczne i poważne błędy naprawione przed wdrożeniem
- Brak otwartych błędów krytycznych

### Główne ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Błędy integracji z Supabase | Mockowanie w testach integracyjnych + E2E na dev |
| Dług technologiczny | Wysoki coverage + code review + analiza statyczna |
| Błędy regresji | Zautomatyzowany zestaw testów regresji w CI/CD |
