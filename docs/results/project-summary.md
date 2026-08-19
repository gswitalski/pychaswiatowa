# PychaŚwiatowa - Podsumowanie Projektu

> Dokument referencyjny dla programistów i analityków planujących nowe funkcjonalności.
> Zawiera streszczenie PRD, tech stack, strukturę bazy danych, listę endpointów API, widoki UI oraz plan testów.
>
> **Aktualizacja:** 19 sierpnia 2026 — na podstawie kodu, commitów, `docs/results/`, `docs/Jira.xml` oraz historiijek Premium (`docs/historyjki-premium.md`).

---

## 0. Stan realizacji (sierpień 2026)

MVP produktu jest wdrożone i rozwijane iteracyjnie (frontend: Firebase Hosting, backend: Supabase Cloud). Eksport Jira (59 zgłoszeń): **48 Gotowe**, **7 Do zrobienia**, **1 W toku**, **3 nie będzie realizowane**.

### Dostarczone poza pierwotnym szkicem summary

- Logowanie / rejestracja przez **Google OAuth** (Supabase Auth) + ekran `/auth/complete-profile` przy braku `username`
- Zgoda marketingowa przy rejestracji i w ustawieniach profilu
- Ustawienia konta: username, zgoda marketingowa, zmiana hasła, e-mail tylko do odczytu
- Panel admina: dashboard (stub), **lista użytkowników** (`/admin/users`), **zmiana roli** (`user` / `premium` / `admin`)
- Feature gating: asysta AI przy tworzeniu przepisu oraz generowanie zdjęcia AI — role `premium` i `admin`; import Markdown bez LLM pozostaje dla wszystkich zalogowanych
- Strony prawne z treścią Markdown (`/legal/terms`, `/legal/privacy`); link „Wydawca” w stopce wyłączony
- Clickio Consent Manager + Google Analytics
- Logo / favicon, Bottom Bar, drzewo kolekcji, lista zakupów, normalizacja składników, zdjęcie AI także przed zapisem przepisu

### Backlog produktowy (Jira — Do zrobienia)

| ID | Temat |
|---|---|
| PS-15 | Autor przepisu na widoku szczegółowym |
| PS-31 | Notatka użytkownika przy przepisie |
| PS-34 | Poprawa generowania opisu przez AI |
| PS-35 | Poprawa generowania zdjęcia przez AI |
| PS-37 | Nazwa użytkownika obok ikony w nawigacji |
| PS-38 | Gemini przy generowaniu zdjęcia **bez** referencji |
| PS-59 | Drag & drop obrazka do asysty AI |

**W toku:** PS-62 Plan biznesowy (freemium / Premium — analiza w `docs/analizaf0funkcjonalnosci-premium-v02.md`, historyjki `PREM-*` w `docs/historyjki-premium.md`). Subskrypcja, kredyty AI i checkout **nie są zaimplementowane**.

**Nie będzie realizowane (Jira):** PS-17 (filtr wyszukiwarki o rodzaj/termorobot — osobny ticket), PS-20 (przebudowa wyszukiwarek), PS-26 (stary ticket listy zakupów; funkcja jest jako PS-42).

---

## 1. Opis Projektu (streszczenie PRD)

**PychaŚwiatowa** to responsywna aplikacja webowa (SPA) zaprojektowana jako centralna, cyfrowa książka kucharska. Użytkownicy mogą gromadzić, organizować i przeszukiwać własne przepisy kulinarne w jednym miejscu.

### Główne założenia produktu (stan obecny)

- Podejście **desktop-first** z pełną responsywnością (mobile/tablet)
- System kont: e-mail+hasło (potwierdzenie e-mail) **oraz Google OAuth**; role (`user`, `premium`, `admin`) w JWT (`app_role`)
- Sekcja administracyjna pod `/admin/*`: dashboard (placeholder metryk), lista użytkowników, edycja roli (guard + widoczność w nawigacji bez „migania”)
- Pełny CRUD przepisów z formularzem: nazwa, opis, porcje, czasy, flagi (Termorobot/Grill), klasyfikacja (dieta/kuchnia/trudność), składniki, kroki, wskazówki, zdjęcie
- Trzy poziomy widoczności przepisu: Prywatny, Współdzielony, Publiczny
- Organizacja: kategorie (predefiniowane), tagi (własne), kolekcje (nazwane zbiory)
- "Mój plan" — trwała lista do 50 przepisów, powiązana z listą zakupów
- Lista zakupów — pozycje z przepisów (znormalizowane składniki) + ręczne wpisy
- Import przepisu z Markdown oraz asystowane dodawanie z AI (tekst/obraz → formularz; **premium/admin**)
- Generowanie zdjęć AI (**premium/admin**) — model `gpt-image-1.5`; tryb z referencją (Gemini); możliwe przed pierwszym zapisem przepisu
- Publiczny portal: landing z wyszukiwaniem, katalog `/explore`, kanoniczne URL ze slugiem
- Asynchroniczna normalizacja składników (worker cron + retry)
- Zgodność: regulamin i polityka prywatności, zgoda marketingowa, menedżer zgód cookies

### Granice (poza zakresem / zaplanowane później)

- Import z linków URL, automatyczne planowanie posiłków, zamienniki AI, konto rodzinne — plan Premium (`PREM-*`), nie w kodzie
- Zarządzanie spiżarnią
- Funkcje społecznościowe (znajomi, komentarze, oceny)
- Zaawansowane wartości odżywcze, historia zmian, notatki użytkownika przy cudzym przepisie
- Subskrypcja, płatności, pule kredytów AI, strona `/pricing`
- Tworzenie/usuwanie kont z panelu admina, audyt zmian ról, masowa zmiana ról
- Inni dostawcy OAuth (poza Google)

---

## 2. User Stories

| ID | Tytuł | Krótki opis |
|---|---|---|
| US-001 | Rejestracja nowego użytkownika | Tworzenie konta (email, username, hasło) z potwierdzeniem e-mail. Bez auto-logowania. Checkbox zgody marketingowej (PS-52). |
| US-002 | Logowanie i wylogowywanie | Logowanie email+hasło, wylogowanie. Blokada logowania bez potwierdzonego maila. |
| US-033 | Ponowna wysyłka linku weryfikacyjnego | Akcja "Wyślij ponownie" z cooldown 60s i limitem dziennym. |
| US-034 | Obsługa nieważnego/wygasłego linku | Komunikat + możliwość wysłania nowego linku z tego ekranu. |
| US-035 | Odczyt roli użytkownika (RBAC) | Rola w JWT (`user`/`premium`/`admin`). Feature gating + panel admina. |
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
| US-013 | Import przepisu z tekstu | Wklejanie Markdown, parsowanie `#`/`##`/`###`/`-`, redirect do edycji. Bez LLM, dostępne dla roli `user`. |
| US-016 | Zarządzanie widocznością | Prywatny/Współdzielony/Publiczny w formularzu. |
| US-017 | Landing dla gościa | Pole wyszukiwania + sekcje z publicznymi przepisami + CTA logowanie/rejestracja. |
| US-018 | Wyszukiwanie publicznych przepisów | Tekst (nazwa, składniki, tagi), min 3 znaki, wyłącznie `PUBLIC`, ranking relevance. |
| US-019 | Szczegóły publicznego przepisu | Pełny widok bez sidebara, kanoniczny URL `/explore/recipes/:id-:slug`. |
| US-020 | Publiczne widoki w trybie zalogowanego | Bez CTA logowania, nawigacja zalogowanego, akcja "Dodaj do kolekcji". |
| US-021 | Dodanie publicznego przepisu do kolekcji | Akcja z widoku publicznego, modal wyboru kolekcji (także cudze `PUBLIC`). |
| US-022 | Oznaczenie moich przepisów w katalogu | Badge "Twój przepis" na kartach w `/explore`. |
| US-025 | Oznaczenie cudzych przepisów w kolekcjach | Chip "W moich kolekcjach", brak Edytuj/Usuń dla nie-autora. |
| US-027 | Szybka zmiana zdjęcia (paste/drop) | Strefa zdjęcia: Ctrl+V, drag&drop, auto-upload, Undo. |
| US-028 | Liczba porcji | Opcjonalne pole 1-99, wyświetlane pod tytułem z odmianą. |
| US-029 | Flaga "Termorobot" | Toggle w formularzu, badge na kartach/listach. |
| US-030 | Przycisk "Więcej" (load more) | Domyślnie 12 elementów, doładowywanie kolejnych 12. |
| US-031 | Przepisy kolekcji bez paginacji | Jednorazowe ładowanie (limit techniczny 500). |
| US-032 | Ikonka widoczności na liście | Ikona Prywatny/Współdzielony/Publiczny z tooltipem, tylko dla autora. |
| US-036 | Asystowane dodawanie (AI) | Wklejenie tekstu/obrazu → LLM → wstępnie wypełniony formularz. Trasa `/recipes/new/assist` — `premium`/`admin`. |
| US-037 | Generowanie zdjęcia AI | Przycisk AI w edycji/kreatorze, podgląd, akceptacja, `gpt-image-1.5`, 1024x1024 webp. `premium`/`admin`. Możliwe przed zapisem przepisu. |
| US-038 | Dodanie do "Mojego planu" | Przycisk na szczegółach, limit 50, stany: dodaj/spinner/zobacz listę. |
| US-039 | Przeglądanie "Mojego planu" | Drawer z prawej, lista z miniaturami, usuwanie, czyszczenie, FAB. |
| US-040 | Czasy przygotowania/całkowity | Opcjonalne 0-999 min, walidacja całkowity >= przygotowania. |
| US-041 | Kanoniczny URL ze slugiem | `/recipes/:id-:slug`, transliteracja polskich znaków, normalizacja. |
| US-042 | Klasyfikacja przepisu | Dieta (Mięso/Wege/Vegan), kuchnia (lista), trudność (Łatwe/Średnie/Trudne). |
| US-043 | Flaga "Grill" | Toggle w formularzu, ikonka grilla na kartach. |
| US-044 | Masowe zarządzanie kolekcjami | Modal z checkboxami, szukanie, tworzenie kolekcji, atomowy zapis. |
| US-045 | Wskazówki do przepisu | Opcjonalna sekcja pod krokami, edytowalna lista z nagłówkami. |
| US-046 | Generowanie zdjęcia AI z referencją | Automatyczny tryb: bez zdjęcia / z referencją zdjęcia (Gemini). |
| US-047 | Normalizacja składników (async) | Przy zapisie: job → AI → `recipe_normalized_ingredients`. |
| US-048 | Worker normalizacji | Cron 1min, retry 5x z backoff, deduplikacja per recipe_id. |
| US-049 | Lista zakupów z planu | Dodanie do planu → wiersze zakupowe ze składników znormalizowanych. |
| US-050 | Aktualizacja zakupów przy usuwaniu z planu | Usunięcie z planu → usunięcie wierszy zakupowych tego przepisu. |
| US-051 | Odhaczanie posiadanych | Checkbox, posiadane na dole listy, wyszarzone. Grupowanie frontendowe. |
| US-052 | Ręczne pozycje zakupów | Pole tekstowe + "Dodaj", oznaczanie jako posiadane, usuwanie. |
| US-053 | Usuwanie pozycji z przepisu | Usunięcie grupy (`nazwa`+`jednostka`+`is_owned`), Undo, nie modyfikuje planu. |
| US-054 | Wyczyść listę zakupów | Przycisk w headerze, modal potwierdzenia, nie modyfikuje planu. |
| US-055 | Drzewo kolekcji w Sidebarze | 3 poziomy: Kolekcje → kolekcja → przepisy, lazy-load, miniatura+nazwa. |
| US-056 | Bottom Bar (mobile/tablet) | 3 pozycje: Odkrywaj, Moja Pycha, Zakupy. Breakpoint ~960px. |
| US-057 | Stopka + strony prawne | Footer na wszystkich stronach. `/legal/terms`, `/legal/privacy` (treść Markdown). |
| US-058 | Ustawienia profilu | `/settings`: username, zgoda marketingowa, zmiana hasła; e-mail nieedytowalny. |
| US-OAUTH-001 | Logowanie/rejestracja Google | Przycisk na `/login` i `/register`, OAuth przez Supabase, konto od razu aktywne. |
| US-OAUTH-002 | Powrót przez Google | Istniejący `username` → `/dashboard`. |
| US-OAUTH-003 | Scalanie tożsamości | Ten sam e-mail Google i email+hasło → jedno konto (link identity). |
| US-OAUTH-004 | Uzupełnienie profilu | `/auth/complete-profile` gdy brak `username`; guard blokuje prywatne trasy. |
| US-ADM-001 | Admin: dostęp z nawigacji | Tylko `admin`: pozycja „Admin” w Topbarze (desktop) i w menu użytkownika (mobile/tablet). |
| US-ADM-002 | Admin: blokada dostępu | Wejście na `/admin/*` bez roli `admin` → `/forbidden`. |
| US-ADM-003 | Admin: lista użytkowników | `/admin/users`: paginacja, sortowanie, dane kont (PS-54). |
| US-ADM-004 | Admin: zmiana roli | Dialog „Edytuj rolę”; zakaz zmiany własnej roli i obniżenia ostatniego admina. JWT docelowego użytkownika odświeża się po ponownym logowaniu. |

Historyjki monetyzacji `PREM-001` … (entitlements, kredyty, `/pricing`, checkout) są w `docs/historyjki-premium.md` i **nie zastępują** powyższych story MVP.

---

## 3. Tech Stack

### Frontend

- **Angular 21** — framework SPA (komponentowa architektura, routing, TypeScript)
- **TypeScript** — statyczne typowanie
- **Sass** — preprocesor CSS (zmienne, zagnieżdżenia, mixiny)
- **Angular Material** + **Angular CDK** — komponenty UI
- **ngx-markdown** — rendering dokumentów prawnych
- **@supabase/supabase-js** — auth (e-mail, Google OAuth), sesja, Storage

### Backend i Baza Danych (BaaS)

- **Supabase** (open-source, oparty na PostgreSQL):
    - **PostgreSQL** — baza danych, RPC, RLS
    - **Authentication** — e-mail+hasło, Google OAuth, sesje, JWT z `app_role`
    - **Storage** — zdjęcia przepisów (logo publiczne dostępne także dla gości)
    - **Edge Functions (Deno)** — REST aplikacji: przepisy, AI, admin, worker, plan, zakupy itd.

### Hosting i observability

- **Firebase Hosting** — frontend (`pychaswiatowa.web.app`)
- **Google Analytics** + **Clickio Consent Manager**

### Testowanie

- **Vitest** — testy jednostkowe i integracyjne
- **Playwright** — testy E2E (Chromium, Firefox, WebKit)

### CI/CD

- **GitHub + GitHub Actions** — build, testy (Vitest + Playwright), deploy frontendu i funkcji Supabase

### AI (zewnętrzne API)

- **OpenAI** — draft przepisu, normalizacja składników, generowanie zdjęcia (`gpt-image-1.5`)
- **Gemini** — generowanie zdjęcia z obrazem referencyjnym

---

## 4. Struktura Bazy Danych (streszczenie DB Plan)

Backend działa na **PostgreSQL (Supabase)**. Stosowane jest **miękkie usuwanie** (soft delete) przepisów (`deleted_at`). Składniki, kroki i wskazówki w **JSONB**. Dostęp chroniony przez **Row Level Security (RLS)**. Rola aplikacyjna **nie** jest w `profiles` — źródło prawdy: `auth.users.raw_app_meta_data.app_role` (claim JWT).

### Tabele

#### `profiles`

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` PK, FK → `auth.users` | Klucz powiązany z auth.users |
| `username` | `text` (3-50, nullable) | Nazwa użytkownika; `null` do uzupełnienia po Google OAuth |
| `marketing_consent` | `boolean` | Aktualny stan zgody marketingowej |
| `marketing_consent_updated_at` | `timestamptz` | Czas akceptacji zgody |
| `marketing_consent_text_version` | `text` | Wersja treści zgody (allowlist, np. `marketing-consent-pl-v1`) |
| `created_at` | `timestamptz` | Czas utworzenia |
| `updated_at` | `timestamptz` | Czas aktualizacji |

Unikalność `username` (case-insensitive) egzekwowana indeksem. Trigger `handle_new_user()` tworzy profil przy rejestracji (e-mail i OAuth).

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
| `user_id` | `uuid` FK → `auth.users` | Właściciel |
| `category_id` | `bigint` FK → `categories` | Kategoria (opcjonalnie) |
| `name` | `text` (1-150) | Nazwa |
| `description` | `text` | Opis (opcjonalnie) |
| `servings` | `smallint` (1-99) | Liczba porcji (opcjonalnie) |
| `prep_time_minutes` | `smallint` | Czas przygotowania |
| `total_time_minutes` | `smallint` | Czas całkowity |
| `is_termorobot` | `boolean` | Flaga Termorobot |
| `is_grill` | `boolean` | Flaga Grill |
| `diet_type` | enum | Dieta |
| `cuisine` | enum | Kuchnia |
| `difficulty` | enum | Trudność |
| `visibility` | enum | `PRIVATE` / `SHARED` / `PUBLIC` |
| `image_path` | `text` | Ścieżka w Storage |
| `ingredients` | `jsonb` | Lista składników (`[{type, content}]`) |
| `steps` | `jsonb` | Lista kroków |
| `tips` | `jsonb` | Wskazówki |
| `normalized_ingredients_status` | `text` | Status joba normalizacji |
| `normalized_ingredients_updated_at` | `timestamptz` | Ostatnia normalizacja |
| `search_vector` | `tsvector` | Wyszukiwanie pełnotekstowe |
| `created_at` / `updated_at` / `deleted_at` | `timestamptz` | Audyt + soft delete |

#### `tags` / `collections`

Bez zmian koncepcyjnych względem MVP: tagi i kolekcje per `user_id`, nazwy unikalne w ramach użytkownika.

#### Tabele łączące i pochodne

| Tabela | Kolumny | Opis |
|---|---|---|
| `recipe_tags` | `recipe_id`, `tag_id` | Przepisy ↔ Tagi (N:M) |
| `recipe_collections` | `recipe_id`, `collection_id` | Przepisy ↔ Kolekcje (N:M); RLS pozwala dodać publiczny cudzy przepis |
| `recipe_normalized_ingredients` | `recipe_id`, `items` jsonb, `updated_at` | Wynik normalizacji AI |
| `normalized_ingredients_jobs` | `recipe_id`, `user_id`, `status`, `attempts`, `next_run_at`, `last_error` | Kolejka workera |
| `plan_recipes` | `user_id`, `recipe_id`, `added_at` | „Mój plan” (max 50 po stronie API) |
| `shopping_list_items` | `user_id`, `kind`, `name`, `unit`, `amount`, `text`, `is_owned` | Wiersze listy zakupów (`RECIPE` / `MANUAL`) |
| `shopping_list_recipe_contributions` | `user_id`, `recipe_id`, `name`, `unit`, `amount` | Wkład składników z planu |

Widok `recipe_details` agreguje przepis + autora + kolekcje na potrzeby API.

### Relacje

```
auth.users 1:1 profiles
auth.users 1:N recipes, tags, collections, plan_recipes, shopping_list_items, jobs
categories 1:N recipes
recipes N:M tags (via recipe_tags)
recipes N:M collections (via recipe_collections)
recipes 1:1 recipe_normalized_ingredients
recipes 1:N normalized_ingredients_jobs
recipes N:M users w planie (via plan_recipes)
```

### Format JSONB (składniki/kroki/wskazówki)

```json
[
  { "type": "header", "content": "Nagłówek sekcji" },
  { "type": "item", "content": "Element listy" }
]
```

### Kluczowe indeksy

- `recipes(user_id)`, `recipes(name)`, `recipes(created_at)`
- GIN / `search_vector` — wyszukiwanie pełnotekstowe
- `tags(user_id, lower(name))`, `recipe_tags(tag_id)`, `recipe_collections(collection_id)`
- `profiles` — unikalność `lower(username)`

### RLS (Row Level Security)

- Włączone na tabelach z danymi użytkowników (wdrożenie produkcyjne: `docs/deployment/rls-deployment.md`)
- SELECT/INSERT/UPDATE/DELETE: własność (`auth.uid() = user_id`) tam, gdzie dotyczy
- Publiczne przepisy: polityki SELECT dla `visibility = PUBLIC` i `deleted_at IS NULL`
- Kolekcje: możliwość powiązania publicznego przepisu niebędącego własnością użytkownika
- Tabele łączące: własność kolekcji / tagu po stronie użytkownika operującego
- Operacje admina na rolach: RPC z kontekstem service role, nie przez RLS na `auth.users`

---

## 5. Endpointy API

Prywatne endpointy wymagają JWT (`Authorization: Bearer <token>`). Publiczne zwracają tylko `visibility = 'PUBLIC'` (dla anonimowych). JWT zawiera claim `app_role` (`user`/`premium`/`admin`).

Warstwa HTTP to **Supabase Edge Functions** (ścieżki poniżej w konwencji aplikacji, np. `/recipes` → `/functions/v1/recipes`).

### Autentykacja (Supabase Auth + trasy frontendu)

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/auth/signup` | Rejestracja (email, hasło, username, zgoda marketingowa). Link weryfikacyjny. Domyślna rola: `user`. |
| `POST` | `/auth/login` | Logowanie (email, hasło). JWT z `app_role`. |
| SDK | `signInWithOAuth({ provider: 'google' })` | Google OAuth; `redirectTo` = `{origin}/auth/callback`. |
| `POST` | `/auth/resend` | Ponowna wysyłka linku weryfikacyjnego. Rate limit 429. |
| `GET` | `/auth/callback` | (Frontend) Wymiana `code` na sesję: weryfikacja e-mail **lub** powrót z Google. |

### Przepisy publiczne

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/public/recipes` | Lista publicznych (offset). Filtry: `q`, `termorobot`, `grill`, `diet_type`, `cuisine`, `difficulty`. Relevance. |
| `GET` | `/public/recipes/feed` | Lista publicznych (cursor, load more po 12). |
| `GET` | `/public/recipes/{id}` | Szczegóły. Dla auth: `is_owner`, `in_my_plan`, `collection_ids`. |
| `GET` | `/explore/recipes/{id}` | Wariant katalogu Explore (ten sam kontrakt publiczny). |

### Przepisy (prywatne, auth required)

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/recipes` | Lista (offset). `view=owned\|my_recipes`. Filtry: category, tags, termorobot, grill, diet_type, cuisine, difficulty, search. |
| `GET` | `/recipes/feed` | Lista (cursor, load more). |
| `POST` | `/recipes` | Tworzenie. Parsowanie `ingredients_raw`, `steps_raw`, `tips_raw`. Job normalizacji. |
| `POST` | `/recipes/import` | Import Markdown. Zwraca nowy przepis. |
| `GET` | `/recipes/{id}` | Szczegóły. Helpery: `is_owner`, `in_my_collections`, `in_my_plan`, `collection_ids`. |
| `PUT` | `/recipes/{id}` | Aktualizacja. Job normalizacji. |
| `DELETE` | `/recipes/{id}` | Soft-delete. `204`. |
| `POST` | `/recipes/{id}/image` | Upload zdjęcia (multipart). PNG/JPG/WebP, max 10 MB. |
| `DELETE` | `/recipes/{id}/image` | Usunięcie zdjęcia. |
| `PUT` | `/recipes/{id}/collections` | Atomowe `collection_ids`. |
| `GET` | `/recipes/{id}/normalized-ingredients` | Znormalizowane składniki. Tylko właściciel. |
| `POST` | `/recipes/{id}/normalized-ingredients/refresh` | Ponowne kolejkowanie (dev/test). `202`. |

### AI (Edge Function `ai`)

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/ai/recipes/draft` | Draft z tekstu lub obrazu. Nie zapisuje. Rate limit. Feature gating zgodne z rolą (asysta UI: premium). |
| `POST` | `/ai/recipes/normalized-ingredients` | Normalizacja (worker, nie UI). |
| `POST` | `/ai/recipes/image` | Zdjęcie AI. Wymaga `premium`/`admin`. Tryb `recipe_only` / `with_reference`. Base64 webp 1024x1024. Działa też przed zapisem (kreator). |

### Worker wewnętrzny

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/internal/workers/normalized-ingredients/run` | Cron ~1 min. Joby `PENDING`/`RETRY`. Max 5 prób, backoff. Nie dla klienta. |

### Kategorie, Tagi

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/categories` | Lista predefiniowanych kategorii. |
| `GET` | `/tags` | Lista tagów użytkownika. |

### Kolekcje

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/collections` | Lista kolekcji użytkownika. |
| `POST` | `/collections` | Tworzenie. `409` przy duplikacie nazwy. |
| `GET` | `/collections/{id}` | Kolekcja + przepisy (limit 500). |
| `GET` | `/collections/{id}/recipes` | Minimalne dane (id, name, image_path) dla Sidebara. |
| `PUT` | `/collections/{id}` | Aktualizacja. |
| `DELETE` | `/collections/{id}` | Usunięcie kolekcji (nie usuwa przepisów). |
| `POST` | `/collections/{id}/recipes` | Dodanie przepisu. |
| `DELETE` | `/collections/{collectionId}/recipes/{recipeId}` | Usunięcie przepisu z kolekcji. |

### Mój Plan

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/plan` | Lista (max 50, `added_at.desc`). |
| `POST` | `/plan/recipes` | Dodanie + wiersze zakupów. `422` przy limicie 50. |
| `DELETE` | `/plan/recipes/{recipeId}` | Usunięcie + korekta zakupów. |
| `DELETE` | `/plan` | Wyczyszczenie planu. |

### Lista Zakupów

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/shopping-list` | Surowe wiersze. Grupowanie FE po `(nazwa, jednostka, is_owned)`. |
| `POST` | `/shopping-list/items` | Pozycja ręczna. |
| `PATCH` | `/shopping-list/items/{id}` | Toggle `is_owned`. |
| `DELETE` | `/shopping-list/items/{id}` | Usunięcie pozycji `MANUAL`. |
| `DELETE` | `/shopping-list/recipe-items/group` | Usunięcie grupy z przepisów. Body: `{name, unit, is_owned}`. |
| `DELETE` | `/shopping-list` | Wyczyszczenie listy (nie rusza planu). |

### Wyszukiwanie, Dashboard, Profil

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/search/global` | Omnibox: przepisy i kolekcje (min 2 znaki). |
| `GET` | `/dashboard/summary` | Podsumowanie dashboardu. |
| `GET` | `/profile` | Ustawienia profilu (username, zgoda marketingowa, e-mail). |
| `PUT` | `/profile` | Aktualizacja username + zgody marketingowej. |
| `GET` | `/profile/username-available` | Publiczne sprawdzenie unikalności username (OAuth complete-profile). |
| `POST` | `/profile/change-password` | Zmiana hasła (weryfikacja obecnego; service role). |
| `GET` | `/me` | Sesja: id, username, `app_role`. Bootstrap App Shell. |

### Admin (tylko `admin`)

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/admin/summary` | Stub metryk dashboardu. 401/403 bez admina. |
| `GET` | `/admin/health` | Health check endpointu admin. |
| `GET` | `/admin/users` | Lista użytkowników: paginacja, sortowanie (`login`, daty itd.). |
| `PATCH` | `/admin/users/{userId}/role` | Zmiana `app_role`. `409` przy samomodyfikacji lub ostatnim adminie. |

### Utilities

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/utils/slugify` | Slug z tekstu. Transliteracja PL, max 80 znaków, fallback "przepis". |

---

## 6. Widoki UI (streszczenie High-Level UI Plan)

Architektura: **App Shell** z Sidebar + Topbar + Page Header + Footer. Desktop-first, Bottom Bar na mobile/tablet (<960px). Prywatne trasy: AuthGuard + `usernameCompleteMatchGuard` (brak username → `/auth/complete-profile`). `/admin/*`: dodatkowo `adminRoleMatchGuard`.

### Widoki publiczne

| Widok | Ścieżka | Opis |
|---|---|---|
| Landing Page | `/` | Wyszukiwarka publicznych przepisów, sekcje, CTA logowanie/rejestracja. Zalogowany: nawigacja konta, bez CTA logowania. Logo widoczne także dla gościa. |
| Katalog Explore | `/explore` | Publiczne przepisy, search (min 3 zn.), load more 12. Badge "Twój przepis". |
| Szczegóły (publiczny) | `/explore/recipes/:id-:slug` | Bez Sidebara. Gość: CTA logowania. Zalogowany nie-autor: kolekcja/plan. Autor: pełne akcje. |
| Logowanie | `/login` | Email+hasło + **Zaloguj się przez Google**. |
| Rejestracja | `/register` | Username, email, hasło, zgoda marketingowa + Google. |
| Wysłano link | `/register/verify-sent` | Komunikat + ponowna wysyłka (cooldown 60s). |
| Auth callback | `/auth/callback` | Sesja po e-mailu lub OAuth. |
| Uzupełnienie profilu | `/auth/complete-profile` | Tylko po OAuth bez `username`. |
| E-mail potwierdzony | `/email-confirmed` | Sukces + link do logowania. |
| Link nieważny | `/email-confirmation-invalid` | Nowy link. |
| Regulamin | `/legal/terms` | Markdown z `docs/legal-documents` (sync do assets). |
| Polityka prywatności | `/legal/privacy` | Markdown. |
| Wydawca | `/legal/publisher` | Trasa istnieje; link w stopce obecnie wyłączony. |

### Widoki prywatne (auth required)

| Widok | Ścieżka | Opis |
|---|---|---|
| Moja Pycha (Dashboard) | `/dashboard` | Kafelki, ostatnie przepisy (karty). |
| Admin - Dashboard | `/admin`, `/admin/dashboard` | Placeholder metryk („Wkrótce”) + nawigacja admina (sidebar). |
| Admin - Użytkownicy | `/admin/users` | Tabela, paginacja, sortowanie, dialog zmiany roli. |
| Moje Przepisy | `/my-recipies` (alias `/my-recipes`) | Własne + publiczne z kolekcji. Filtry, load more 12. |
| Szczegóły (prywatny) | `/recipes/:id-:slug` | Z Sidebarem. Normalizacja URL. |
| Kreator - wybór trybu | `/recipes/new/start` | Pusty formularz (wszyscy) lub AI (premium/admin; badge). |
| Kreator - AI | `/recipes/new/assist` | Tekst/obraz → AI. Guard `premiumRoleMatchGuard`. |
| Formularz przepisu | `/recipes/new`, `/recipes/:id/edit` | CRUD + zdjęcie (paste/drop/file/AI). Sticky Zapisz. |
| Import Markdown | `/recipes/import` | Live preview → edycja. |
| Lista kolekcji | `/collections` | CRUD kolekcji. |
| Szczegóły kolekcji | `/collections/:id` | Wszystkie przepisy (limit 500). |
| Zakupy | `/shopping` | Grupy z planu + ręczne. |
| Ustawienia | `/settings` | Username, zgoda marketingowa, hasło; e-mail RO. |
| Brak dostępu | `/forbidden` | 403 (role / premium). |

### Komponenty globalne / overlay

| Komponent | Opis |
|---|---|
| Drawer "Mój plan" | Panel z prawej: miniatura+nazwa+kosz, wyczyść. |
| FAB "Mój plan" | Prawy dolny róg, gdy plan ≥1. |
| Bottom Bar | <960px: Odkrywaj, Moja Pycha, Zakupy. |
| Footer | Copyright + Regulamin + Polityka prywatności. |
| Sidebar (drzewo kolekcji) | 3 poziomy, lazy-load. |
| Modal "Dodaj do kolekcji" | Multi-select, szukanie, nowa kolekcja, atomowy zapis. |
| Dialog zmiany roli | Admin: wybór `user`/`premium`/`admin`. |

---

## 7. Plan Testów (streszczenie)

### Strategia

Piramida testów: solidna baza jednostkowych, uzupełniona integracjami i E2E.

| Poziom | Narzędzie | Cel |
|---|---|---|
| **Jednostkowe** | Vitest | Komponenty, serwisy, walidacja, guardy ról. |
| **Integracyjne** | Vitest | Współpraca komponent+serwis. Mockowany backend. |
| **E2E** | Playwright | Scenariusze w przeglądarce (Chromium, Firefox, WebKit). |
| **UI/Responsywność** | Ręcznie + Playwright | Layout, Angular Material, Bottom Bar. |
| **Bezpieczeństwo** | Ręcznie | AuthGuard, role guards, RLS, JWT, XSS, endpointy admin. |

### Kluczowe scenariusze E2E / manualne

1. Rejestracja → potwierdzenie e-mail → logowanie (w tym zgoda marketingowa)
2. Google OAuth: nowe konto → complete-profile; istniejące konto → dashboard; scalanie e-mail
3. Cykl życia przepisu: tworzenie → lista → szczegóły → edycja → usuwanie
4. Kolekcje, plan, lista zakupów
5. Admin: lista użytkowników, zmiana roli, odmowa dostępu dla `user`
6. Feature gating: `user` nie wchodzi na `/recipes/new/assist` ani nie generuje zdjęcia AI

Przewodniki: `docs/testing/`.

### Środowiska

| Środowisko | Opis |
|---|---|
| Lokalne | Supabase CLI / Docker, Vitest |
| CI/CD | GitHub Actions po push / PR |
| Dev/Staging | Firebase Hosting + Supabase, E2E + manual |
| Produkcja | `pychaswiatowa.web.app` + Supabase Cloud; smoke po wdrożeniu |

### Kryteria jakości

- Pokrycie kodu testami jednostkowymi: **≥80%**
- Krytyczne i poważne błędy naprawione przed wdrożeniem
- Brak otwartych błędów krytycznych

### Główne ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Integracja Supabase / OAuth / RLS | Mocki + E2E na dev; procedury RLS w `docs/deployment/` |
| Koszt i nadużycia API AI | Rate limit, gating premium; przyszłe kredyty (`PREM-002`) |
| Regresja ról (ostatni admin, JWT) | Walidacja backendu + testy PATCH roli |
| Dług technologiczny | Coverage, review, analiza statyczna |
| Błędy regresji | Zestaw testów w CI/CD |
