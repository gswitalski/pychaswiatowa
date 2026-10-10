# PychaŚwiatowa - Podsumowanie Projektu

> Dokument referencyjny dla programistów i analityków planujących nowe funkcjonalności.
> Zawiera streszczenie PRD, tech stack, strukturę bazy danych, listę endpointów API, widoki UI oraz plan testów.
>
> **Aktualizacja:** 10 października 2026 — filtry katalogu Odkrywaj PS-96 (API i widoki), wcześniej: osobiste flagi przepisów PS-95, przycisk „Wklej ze schowka” PS-92, Google OAuth, cennik, kredyty AI PS-64, limit planu Free PS-65 i metadane draftu AI PS-91.

---

## 0. Stan realizacji (październik 2026)

MVP produktu jest wdrożone i rozwijane iteracyjnie (frontend: Firebase Hosting, backend: Supabase Cloud). Eksport Jira (59 zgłoszeń): **48 Gotowe**, **7 Do zrobienia**, **1 W toku**, **3 nie będzie realizowane**.

**Google OAuth (logowanie / rejestracja):** implementacja warstwy API (`GET /profile/username-available`, rozszerzenie flow profilu) oraz widoków (przycisk Google, callback, `/auth/complete-profile`, guardy) — **zakończona** zgodnie z planami implementacji.

**Strona cennika:** implementacja widoków (`/pricing`, stub `/checkout`, `/legal/subscription`, linki w nawigacji, stopce i na landingu) — **zakończona**. Etap nie miał planu API: cennik jest statyczny (konfiguracja frontendu), bez nowych endpointów. Płatności nie są podłączone.

**Kredyty AI (PS-64):** implementacja warstwy API i widoków — **zakończona**. Osobne pule `draft` i `image`: Free — limit dożywotni (domyślnie 3 drafty, 0 zdjęć), Premium — limit miesięczny (domyślnie 20 / 5, zmienne środowiskowe), admin — bez limitu. Reset miesięczny cronem (codziennie 02:00 UTC) oraz przy wywołaniu, gdy termin minął. Kredyt jest rezerwowany przed wywołaniem modelu i zwracany, gdy wywołanie się nie uda. Zmiana roli w panelu admina ustawia pulę zgodną z nową rolą. Sprzedaż pakietów kredytów i bramka płatności nie są podłączone. Endpoint `POST /ai/recipes/draft` przyjmuje rolę `user` i rozlicza kredyty; trasa UI `/recipes/new/assist` oraz kafelek na `/recipes/new/start` nadal wymagają `premium`/`admin` (plan API zdejmował bramkę roli, plan widoków jej nie zmieniał).

**Metadane draftu AI (PS-91):** warstwa API `POST /ai/recipes/draft` zwraca porcje, czasy, typ diety, kuchnię, trudność oraz flagi Termorobot/Grill. Model odczytuje wartości ze źródła lub je wnioskuje, a backend tolerancyjnie normalizuje zakresy i enumy. Błąd pojedynczego pola nie odrzuca draftu: odpowiedź pozostaje `200`, bezpieczne wartości to `null`/`false`, a korekty są raportowane w `meta.warnings`.

**Limit „Mojego planu" dla Free (PS-65):** implementacja warstwy API i widoków — **zakończona**. `POST /plan/recipes` dla roli `user` odrzuca dodanie po osiągnięciu limitu (domyślnie 3 pozycje, zmienna środowiskowa `PLAN_LIMIT_FREE`) kodem `422 PLAN_LIMIT_EXCEEDED_FREE` z linkiem do `/pricing`. Premium i admin zachowują limit 50. Rola jest brana z JWT (`app_metadata.app_role`), nigdy z body. Istniejące pozycje ponad limit nie są usuwane (grandfathering) — blokowane są tylko nowe dodania. W UI: dialog po `422` zamiast snackbara, licznik „X / 3 pozycji” w nagłówku drawera (tylko `user`), a cennik pokazuje limit Free 3 zamiast wcześniejszych 7.

**Przycisk „Wklej ze schowka” (PS-92):** implementacja widoków — **zakończona**; warstwa API **bez zmian** (upload jak przy paste/drop). Współdzielony `ClipboardImageService` (`navigator.clipboard.read()` w secure context) odczytuje PNG/JPG/WebP do 10 MB i przekazuje plik do istniejącej ścieżki sukcesu. Przycisk Material w strefie zdjęcia formularza (`RecipeImageUploadComponent`: `/recipes/new`, edycja) oraz w asyście AI w trybie obrazu (`RecipeNewAssistPageComponent`: `/recipes/new/assist`). Ctrl+V, drag & drop i wybór pliku bez zmian; przy braku Clipboard API przycisk jest nieaktywny z tooltipem. Błędy schowka — komunikaty inline (nie snackbar).

**Osobiste flagi przepisów (PS-95):** implementacja warstwy API i widoków — **zakończona**. `PUT /recipes/{id}/flags` atomowo ustawia częściowo `is_favorite` / `is_want_to_try`; odczyt w szczegółach i listach tylko dla zalogowanego (gość bez pól w JSON). Baza: `user_recipe_flags`, RLS, RPC `set_recipe_flags`; współdzielony moduł `_shared/recipe-flags.ts`. UI: `RecipeFlagsService` + `RecipeFlagTogglesComponent` (optimistic update, snackbar) na `/recipes/:id-:slug` i `/explore/recipes/:id-:slug`; nieklikalne serduszko na kafelkach (dashboard, moje przepisy, kolekcja, explore, landing). Filtrowanie list prywatnych po flagach pozostaje poza zakresem; w `/explore` — PS-96.

**Filtry przepisów w Odkrywaj (PS-96):** implementacja warstwy API i widoków — **zakończona**. Rozszerzenie `GET /public/recipes` i `GET /public/recipes/feed` (Edge Function `public`, bez migracji): parametry `diet` (`vege_plus` = wegetariańskie + wegańskie, `vegan` = tylko wegańskie; priorytet nad `filter[diet_type]`), `favorite` i `want_to_try` (tylko z JWT — bez tokenu ignorowane, `user_id` wyłącznie z JWT). UI: pasek chipów pod wyszukiwaniem na `/explore` (`ExploreRecipeFiltersComponent`), synchronizacja filtrów i `q` z URL, `ExploreFilterStateService`, przebudowany `ExplorePageComponent` (feed cursor, load more 12, empty state z „Wyczyść filtry”). Chipy flag widoczne tylko dla zalogowanych; landing (`PublicRecipesSearchComponent` / facade) bez zmian.

### Dostarczone poza pierwotnym szkicem summary

- **Google OAuth** (Supabase Auth, PKCE): wspólny przycisk na `/login` i `/register`, callback z rozgałęzieniem e-mail vs OAuth, ekran `/auth/complete-profile` (walidacja async username, `PUT /profile`), guardy `oauthCompleteProfileGuard` / `usernameCompleteMatchGuard` + `ProfileCompletionService`; obsługa błędów OAuth na `/login?error=…`
- Zgoda marketingowa przy rejestracji i w ustawieniach profilu
- Ustawienia konta: username, zgoda marketingowa, zmiana hasła, e-mail tylko do odczytu
- Panel admina: dashboard (stub), **lista użytkowników** (`/admin/users`), **zmiana roli** (`user` / `premium` / `admin`)
- Feature gating: generowanie zdjęcia AI — role `premium` i `admin` oraz pula kredytów `image`; import Markdown bez LLM pozostaje dla wszystkich zalogowanych. Asysta AI w UI nadal tylko `premium`/`admin`; API draftu rozlicza kredyty także dla roli `user`
- **Kredyty AI:** wskaźnik puli na asyście i przy generowaniu zdjęcia, dialog przy błędzie `402`, sekcja w `/settings` (ukryta dla admina), korekta puli w dialogu użytkownika w panelu admina
- Strony prawne z treścią Markdown (`/legal/terms`, `/legal/privacy`); link „Wydawca” w stopce wyłączony
- Clickio Consent Manager + Google Analytics
- Logo / favicon, Bottom Bar, drzewo kolekcji, lista zakupów, normalizacja składników, zdjęcie AI także przed zapisem przepisu
- **Limit planu Free (PS-65):** egzekwowanie na API (`PLAN_LIMIT_FREE`, domyślnie 3), dialog `PlanLimitExceededDialogComponent` z CTA do `/pricing`, licznik pozycji w drawerze „Mój plan”
- **Strona cennika** (`/pricing`, publiczna): karty Free i Premium, okres miesięczny/roczny (domyślnie roczny, oszczędność ~17%), tabela porównawcza, FAQ, trial 7 dni na karcie Premium. CTA zależy od sesji i roli. Stub `/checkout` („Płatności wkrótce”). Regulamin subskrypcji `/legal/subscription`. Link „Cennik” dla gościa (nagłówek publiczny) i roli `user` (topbar). Blok promo Premium na landingu dla gościa i `user`
- **Wklej ze schowka (PS-92):** `ClipboardImageService` + przycisk „Wklej ze schowka” w uploadzie zdjęcia przepisu i w asyście AI (tryb obrazu); walidacja MIME/rozmiaru i mapowanie błędów schowka; testy jednostkowe serwisu i komponentów
- **Osobiste flagi przepisów (PS-95):** przełączniki „Ulubiony” / „Chcę wypróbować” w nagłówku szczegółów; wskaźnik serduszka na `RecipeCardComponent`; wszystkie role zalogowane; prywatność flag względem autora i innych użytkowników
- **Filtry Odkrywaj (PS-96):** chipy Termorobot, Grill, dieta (Wszystkie / Wegetariańskie+ / Tylko wegańskie), dla zalogowanych Ulubione i Chcę wypróbować; query params w URL; filtrowanie przez `GET /public/recipes/feed`

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

**W toku:** PS-62 Plan biznesowy (freemium / Premium — analiza w `docs/analizaf0funkcjonalnosci-premium-v02.md`, historyjki `PREM-*` w `docs/historyjki-premium.md`). Widok cennika, stub checkout i pule kredytów AI (PS-64) są wdrożone. Subskrypcja i właściwy checkout płatności **nie są zaimplementowane**.

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
- "Mój plan" — trwała lista do 50 przepisów (Free: do 3, PS-65), powiązana z listą zakupów
- Lista zakupów — pozycje z przepisów (znormalizowane składniki) + ręczne wpisy
- Import przepisu z Markdown (bez LLM, wszyscy zalogowani) oraz asystowane dodawanie z AI (tekst/obraz → formularz). API draftu rozlicza kredyty `draft` (także rola `user`); ekran asysty w UI nadal tylko `premium`/`admin`
- Generowanie zdjęć AI (**premium/admin**, pula kredytów `image`) — model `gpt-image-1.5`; tryb z referencją (Gemini); możliwe przed pierwszym zapisem przepisu
- Publiczny portal: landing z wyszukiwaniem, katalog `/explore` z chipami filtrów (Termorobot, Grill, dieta, dla zalogowanych flagi PS-95), kanoniczne URL ze slugiem
- Publiczny cennik `/pricing` (Free vs Premium, ceny statyczne) i zapowiedź płatności na `/checkout`; sprzedaż subskrypcji jeszcze nie działa
- Kredyty AI per użytkownik: Free dożywotnie, Premium miesięcznie, admin bez limitu; podgląd w ustawieniach i korekta w panelu admina
- Asynchroniczna normalizacja składników (worker cron + retry)
- Osobiste flagi przepisu (PS-95): „Ulubiony” i „Chcę wypróbować” na własnych i widocznych cudzych przepisach; tylko zalogowany; serduszko na kafelkach list
- Zgodność: regulamin, polityka prywatności i regulamin subskrypcji, zgoda marketingowa, menedżer zgód cookies

### Granice (poza zakresem / zaplanowane później)

- Import z linków URL, automatyczne planowanie posiłków, zamienniki AI, konto rodzinne — plan Premium (`PREM-*`), nie w kodzie
- Zarządzanie spiżarnią
- Funkcje społecznościowe (znajomi, komentarze, oceny)
- Zaawansowane wartości odżywcze, historia zmian, notatki użytkownika przy cudzym przepisie
- Filtrowanie po flagach na listach prywatnych (np. „Moje przepisy”, kolekcje); w katalogu `/explore` filtry flag są wdrożone (PS-96)
- Subskrypcja i płatności (strona `/pricing` oraz stub `/checkout` są; brak endpointu planów i bramki płatności). Pule kredytów AI są wdrożone; dokupienie pakietu nie jest
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
| US-027 | Szybka zmiana zdjęcia (paste/drop) | Strefa zdjęcia: Ctrl+V, drag&drop, wybór pliku, auto-upload, Undo. PS-92: dedykowany przycisk „Wklej ze schowka” (Clipboard API). |
| PS-92 | Wklej ze schowka (przycisk) | Odczyt obrazu przez `navigator.clipboard.read()` bez wymogu fokusu na strefie paste. Formularz przepisu i asysta AI (obraz). Te same formaty i limit 10 MB co upload; błędy inline. |
| PS-95 | Osobiste flagi przepisu | Toggle „Ulubiony” i „Chcę wypróbować” na szczegółach (`/recipes/…`, `/explore/recipes/…`); serduszko na kafelkach list; prywatne, wszystkie role; `PUT /recipes/{id}/flags`. |
| PS-96 | Filtry w katalogu Odkrywaj | `/explore`: chipy filtrów (Termorobot, Grill, dieta vege_plus/vegan, Ulubione/Chcę wypróbować dla zalogowanych); sync z URL; `GET /public/recipes/feed` z parametrami `diet`, `favorite`, `want_to_try`; reset paginacji przy zmianie filtrów; empty state „Wyczyść filtry”. |
| US-028 | Liczba porcji | Opcjonalne pole 1-99, wyświetlane pod tytułem z odmianą. |
| US-029 | Flaga "Termorobot" | Toggle w formularzu, badge na kartach/listach. |
| US-030 | Przycisk "Więcej" (load more) | Domyślnie 12 elementów, doładowywanie kolejnych 12. |
| US-031 | Przepisy kolekcji bez paginacji | Jednorazowe ładowanie (limit techniczny 500). |
| US-032 | Ikonka widoczności na liście | Ikona Prywatny/Współdzielony/Publiczny z tooltipem, tylko dla autora. |
| US-036 | Asystowane dodawanie (AI) | Wklejenie tekstu/obrazu → LLM → wstępnie wypełniony formularz wraz z porcjami, czasami, klasyfikacją i flagami. Metadane są normalizowane tolerancyjnie. Rozliczenie kredytów `draft` (`402` przy wyczerpaniu). Trasa UI `/recipes/new/assist` — `premium`/`admin`; endpoint przyjmuje też rolę `user`. |
| US-037 | Generowanie zdjęcia AI | Przycisk AI w edycji/kreatorze, podgląd, akceptacja, `gpt-image-1.5`, 1024x1024 webp. `premium`/`admin` plus pula kredytów `image`. Możliwe przed zapisem przepisu. |
| PS-64 | Kredyty AI | Osobne pule draft i zdjęcie. Free: limit dożywotni; Premium: miesięczny (reset cron); admin: bez limitu. Wskaźnik, dialog wyczerpania, sekcja w `/settings`, korekta w panelu admina. |
| US-038 | Dodanie do "Mojego planu" | Przycisk na szczegółach, limit 50 (Free: 3 — PS-65, dialog z CTA do `/pricing`), stany: dodaj/spinner/zobacz listę. |
| PS-65 | Limit planu dla Free | Rola `user`: max 3 pozycje (`PLAN_LIMIT_FREE`), `422 PLAN_LIMIT_EXCEEDED_FREE`, dialog, licznik w drawerze. Premium/admin: 50. Bez usuwania nadmiarowych pozycji. |
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
| US-OAUTH-004 | Uzupełnienie profilu | `/auth/complete-profile` gdy brak `username`; `usernameCompleteMatchGuard` na trasach prywatnych; `oauthCompleteProfileGuard` na samym ekranie uzupełnienia. |
| US-ADM-001 | Admin: dostęp z nawigacji | Tylko `admin`: pozycja „Admin” w Topbarze (desktop) i w menu użytkownika (mobile/tablet). |
| US-ADM-002 | Admin: blokada dostępu | Wejście na `/admin/*` bez roli `admin` → `/forbidden`. |
| US-ADM-003 | Admin: lista użytkowników | `/admin/users`: paginacja, sortowanie, dane kont (PS-54). |
| US-ADM-004 | Admin: zmiana roli | Dialog „Edytuj rolę”; zakaz zmiany własnej roli i obniżenia ostatniego admina. JWT docelowego użytkownika odświeża się po ponownym logowaniu. Zmiana na `user`/`premium` ustawia pulę kredytów AI; w tym samym dialogu jest korekta puli. |

Historyjki monetyzacji `PREM-001` … (entitlements, checkout płatności) są w `docs/historyjki-premium.md` i **nie zastępują** powyższych story MVP. Publiczny widok `/pricing`, stub `/checkout` oraz kredyty AI (PS-64) są już w aplikacji. Sprzedaż subskrypcji i pakietów kredytów nie jest.

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
| `plan_recipes` | `user_id`, `recipe_id`, `added_at` | „Mój plan” (max 50 w RPC; Free max 3 sprawdzane w API, bez zmian schematu) |
| `shopping_list_items` | `user_id`, `kind`, `name`, `unit`, `amount`, `text`, `is_owned` | Wiersze listy zakupów (`RECIPE` / `MANUAL`) |
| `shopping_list_recipe_contributions` | `user_id`, `recipe_id`, `name`, `unit`, `amount` | Wkład składników z planu |
| `user_ai_credits` | `user_id` UNIQUE, pule `draft_*` / `image_*`, `limit_type`, `next_reset_at` | Saldo kredytów AI (1:1 z użytkownikiem) |
| `user_recipe_flags` | `user_id`, `recipe_id`, `is_favorite`, `is_want_to_try` | Prywatne flagi przepisu użytkownika (PK złożony, RLS) |

#### `user_ai_credits`

Jedna pula na draft przepisu i jedna na zdjęcie. `limit_type`: `lifetime` (Free) albo `monthly` (Premium). Wartość `unlimited` występuje tylko w odpowiedziach API dla admina — nie ma jej w enumie bazy. Wiersz powstaje leniwie przy pierwszym wywołaniu AI, z domyślną pulą Free. Zapis wyłącznie przez service role; użytkownik może odczytać własne saldo (RLS). Indeks częściowy po `next_reset_at` dla resetu miesięcznego.

Widok `recipe_details` agreguje przepis + autora + kolekcje na potrzeby API.

### Relacje

```
auth.users 1:1 profiles
auth.users 1:1 user_ai_credits
auth.users 1:N recipes, tags, collections, plan_recipes, shopping_list_items, jobs
auth.users 1:N user_recipe_flags
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
- `user_ai_credits`: SELECT własnego wiersza; INSERT/UPDATE/DELETE tylko service role
- `user_recipe_flags`: użytkownik odczytuje i modyfikuje wyłącznie własne flagi; zapis wymaga widocznego, nieusuniętego przepisu

---

## 5. Endpointy API

Prywatne endpointy wymagają JWT (`Authorization: Bearer <token>`). Publiczne zwracają tylko `visibility = 'PUBLIC'` (dla anonimowych). JWT zawiera claim `app_role` (`user`/`premium`/`admin`).

Warstwa HTTP to **Supabase Edge Functions** (ścieżki poniżej w konwencji aplikacji, np. `/recipes` → `/functions/v1/recipes`).

### Autentykacja (Supabase Auth + trasy frontendu)

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/auth/signup` | Rejestracja (email, hasło, username, zgoda marketingowa). Link weryfikacyjny. Domyślna rola: `user`. |
| `POST` | `/auth/login` | Logowanie (email, hasło). JWT z `app_role`. |
| SDK | `signInWithOAuth({ provider: 'google' })` | Google OAuth (PKCE); `redirectTo` = `{origin}/auth/callback`; `access_type=offline`, `prompt=select_account`. |
| `POST` | `/auth/resend` | Ponowna wysyłka linku weryfikacyjnego. Rate limit 429. |
| `GET` | `/auth/callback` | (Frontend) `type=email` → weryfikacja e-mail; OAuth → `exchangeCodeForSession`, potem `GET /profile` → `/dashboard` lub `/auth/complete-profile`; błędy → `/login?error=…`. |

### Przepisy publiczne

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/public/recipes` | Lista publicznych (offset). Filtry: `q`, `filter[termorobot]`, `filter[grill]`, `filter[diet_type]` (backward compat), `filter[cuisine]`, `filter[difficulty]`, **`diet`** (`vege_plus` / `vegan`, priorytet nad `filter[diet_type]`), **`favorite`** / **`want_to_try`** (`true` — tylko z JWT, bez tokenu ignorowane). Relevance. Dla auth: `is_favorite` w elementach; żądania z JWT: `Cache-Control: no-store`. |
| `GET` | `/public/recipes/feed` | Lista publicznych (cursor, load more po 12). Te same filtry co `/public/recipes` (w tym PS-96: `diet`, `favorite`, `want_to_try`); hash cursora uwzględnia filtry flag i dietę. Dla auth: `is_favorite` w elementach. |
| `GET` | `/public/recipes/{id}` | Szczegóły. Dla auth: `is_owner`, `in_my_plan`, `collection_ids`, `is_favorite`, `is_want_to_try`; odpowiedź auth bez cache publicznego (`no-store`). |
| `GET` | `/explore/recipes/{id}` | Wariant katalogu Explore (ten sam kontrakt co publiczne szczegóły, w tym flagi dla auth). |

### Przepisy (prywatne, auth required)

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/recipes` | Lista (offset). `view=owned\|my_recipes`. Filtry: category, tags, termorobot, grill, diet_type, cuisine, difficulty, search. Elementy: `is_favorite`. |
| `GET` | `/recipes/feed` | Lista (cursor, load more). Elementy: `is_favorite`. |
| `POST` | `/recipes` | Tworzenie. Parsowanie `ingredients_raw`, `steps_raw`, `tips_raw`. Job normalizacji. |
| `POST` | `/recipes/import` | Import Markdown. Zwraca nowy przepis. |
| `GET` | `/recipes/{id}` | Szczegóły. Helpery: `is_owner`, `in_my_collections`, `in_my_plan`, `collection_ids`, `is_favorite`, `is_want_to_try`. |
| `PUT` | `/recipes/{id}/flags` | Częściowe, idempotentne ustawienie flag `is_favorite` / `is_want_to_try`; zwraca pełny stan obu flag. |
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
| `GET` | `/ai/credits` | Pełne saldo zalogowanego użytkownika (`draft`, `image`, `limit_type`, `next_reset_at`). Admin: `unlimited` bez odczytu puli. |
| `POST` | `/ai/recipes/draft` | Draft z tekstu lub obrazu z 8 polami metadanych: porcje, czasy, dieta, kuchnia, trudność, Termorobot i Grill. Nie zapisuje. Niepoprawne metadane są normalizowane do `null`/`false` z ostrzeżeniami bez odrzucania draftu. Rate limit. Role `user`/`premium`/`admin`. Przed wywołaniem rezerwacja kredytu `draft`; `402` `AI_CREDITS_EXHAUSTED` przy pustej puli; zwrot przy błędzie modelu. |
| `POST` | `/ai/recipes/normalized-ingredients` | Normalizacja (worker, nie UI). |
| `POST` | `/ai/recipes/image` | Zdjęcie AI. Wymaga `premium`/`admin` oraz kredytu `image`. Tryb `recipe_only` / `with_reference`. Base64 webp 1024x1024. Działa też przed zapisem (kreator). `402` przy wyczerpaniu puli. |

### Worker wewnętrzny

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/internal/workers/normalized-ingredients/run` | Cron ~1 min. Joby `PENDING`/`RETRY`. Max 5 prób, backoff. Nie dla klienta. |
| `POST` | `/internal/ai-credits/monthly-reset` | Reset pul Premium (`limit_type = monthly`, termin minął). Sekret cron / service role. Ten sam reset realizuje też funkcja SQL w pg_cron (02:00 UTC). |

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
| `GET` | `/collections/{id}` | Kolekcja + przepisy (limit 500). Przepisy: `is_favorite`. |
| `GET` | `/collections/{id}/recipes` | Minimalne dane (id, name, image_path) dla Sidebara. |
| `PUT` | `/collections/{id}` | Aktualizacja. |
| `DELETE` | `/collections/{id}` | Usunięcie kolekcji (nie usuwa przepisów). |
| `POST` | `/collections/{id}/recipes` | Dodanie przepisu. |
| `DELETE` | `/collections/{collectionId}/recipes/{recipeId}` | Usunięcie przepisu z kolekcji. |

### Mój Plan

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/plan` | Lista (max 50, `added_at.desc`). |
| `POST` | `/plan/recipes` | Dodanie + wiersze zakupów. `422` przy limicie 50 (`premium`/`admin`). Dla roli `user`: `422` `PLAN_LIMIT_EXCEEDED_FREE` (`details`: `free_limit`, `premium_limit`, `upgrade_url`) po osiągnięciu `PLAN_LIMIT_FREE` (domyślnie 3). |
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
| `PUT` | `/profile` | Aktualizacja username + zgody marketingowej (pełny payload; m.in. zapis username po OAuth). |
| `GET` | `/profile/username-available` | Sprawdzenie unikalności `username` (3–50 znaków, bez spacji); używane przy `/auth/complete-profile`. |
| `POST` | `/profile/change-password` | Zmiana hasła (weryfikacja obecnego; service role). |
| `GET` | `/me` | Sesja: id, username, `app_role`, skrót `ai_credits` (pozostałe draft/image, typ limitu, data resetu). Bootstrap App Shell. |

### Admin (tylko `admin`)

| Metoda | URL | Opis |
|---|---|---|
| `GET` | `/admin/summary` | Stub metryk dashboardu. 401/403 bez admina. |
| `GET` | `/admin/health` | Health check endpointu admin. |
| `GET` | `/admin/users` | Lista użytkowników: paginacja, sortowanie (`login`, daty itd.). |
| `PATCH` | `/admin/users/{userId}/role` | Zmiana `app_role`. `409` przy samomodyfikacji lub ostatnim adminie. Po zmianie na `user` lub `premium` pula kredytów jest ustawiana na wartości tej roli (admin bez zapisu puli). |
| `PATCH` | `/admin/users/{userId}/ai-credits` | Ręczna korekta puli (total/used, `lifetime`/`monthly`, data resetu). Tylko `admin`. `400` przy `used` > `total`. |

### Utilities

| Metoda | URL | Opis |
|---|---|---|
| `POST` | `/utils/slugify` | Slug z tekstu. Transliteracja PL, max 80 znaków, fallback "przepis". |

---

## 6. Widoki UI (streszczenie High-Level UI Plan)

Architektura: **App Shell** z Sidebar + Topbar + Page Header + Footer. Desktop-first, Bottom Bar na mobile/tablet (<960px). Trasy zalogowane: `authenticatedMatchGuard`; prywatne wymagające pełnego profilu — dodatkowo `usernameCompleteMatchGuard` (brak `username` → `/auth/complete-profile`, cache w `ProfileCompletionService`). `/auth/complete-profile`: `oauthCompleteProfileGuard`. `/admin/*`: dodatkowo `adminRoleMatchGuard`. Stan kredytów AI: skrót z `GET /me` przy bootstrapie sesji, pełne saldo z `GET /ai/credits`.

### Widoki publiczne

| Widok | Ścieżka | Opis |
|---|---|---|
| Landing Page | `/` | Wyszukiwarka publicznych przepisów, sekcje, CTA logowanie/rejestracja. Zalogowany: nawigacja konta, bez CTA logowania, serduszko na kafelkach sekcji (PS-95). Logo widoczne także dla gościa. Dla gościa i roli `user`: blok promo Premium z linkiem do cennika. |
| Katalog Explore | `/explore` | Publiczne przepisy: pole wyszukiwania (debounce 350 ms, min 3 zn.), **pasek filtrów chipów** (PS-96: Termorobot, Grill, dieta, dla zalogowanych Ulubione/Chcę wypróbować), sync filtrów i `q` z query URL, load more 12. Badge "Twój przepis". Zalogowany: wskaźnik serduszka na kafelku (PS-95). Empty state z „Wyczyść filtry” przy aktywnych filtrach bez wyników. |
| Szczegóły (publiczny) | `/explore/recipes/:id-:slug` | Bez Sidebara. Gość: CTA logowania. Zalogowany: flagi PS-95, kolekcja/plan. Autor: pełne akcje. |
| Logowanie | `/login` | Email+hasło + **Zaloguj się przez Google** (`OauthGoogleButtonComponent`); komunikaty po błędach OAuth z `?error=`. |
| Rejestracja | `/register` | Username, email, hasło, zgoda marketingowa + **Zarejestruj się przez Google** (ten sam flow OAuth). |
| Wysłano link | `/register/verify-sent` | Komunikat + ponowna wysyłka (cooldown 60s). |
| Auth callback | `/auth/callback` | Sesja po e-mailu lub OAuth. |
| Uzupełnienie profilu | `/auth/complete-profile` | Po OAuth bez `username`: pole username, sprawdzenie `GET /profile/username-available`, zapis `PUT /profile` (zgoda marketingowa domyślnie `false`, edycja później w `/settings`). |
| E-mail potwierdzony | `/email-confirmed` | Sukces + link do logowania. |
| Link nieważny | `/email-confirmation-invalid` | Nowy link. |
| Cennik | `/pricing` | Publiczne porównanie Free i Premium. Przełącznik miesięcznie/rocznie, karty planów, tabela (na wąskim ekranie akordeon), FAQ. Ceny ze stałej konfiguracji, bez API. Gość: „Zacznij za darmo” → `/register`, „Wybierz Premium” → `/register?next=/checkout`. Rola `user`: Free jako „Twój aktualny plan” (nieaktywne), Premium → `/checkout`. Rola `premium`: na karcie Premium „Twój aktualny plan”. Rola `admin`: bez CTA zakupu. |
| Płatności (stub) | `/checkout` | „Płatności wkrótce” i powrót do `/pricing`. Bez wywołań API. |
| Regulamin | `/legal/terms` | Markdown z `docs/legal-documents` (sync do assets). |
| Polityka prywatności | `/legal/privacy` | Markdown. |
| Regulamin subskrypcji | `/legal/subscription` | Markdown (placeholder treści). |
| Wydawca | `/legal/publisher` | Trasa istnieje; link w stopce obecnie wyłączony. |

### Widoki prywatne (auth required)

| Widok | Ścieżka | Opis |
|---|---|---|
| Moja Pycha (Dashboard) | `/dashboard` | Kafelki, ostatnie przepisy (karty z wskaźnikiem ulubionego, PS-95). |
| Admin - Dashboard | `/admin`, `/admin/dashboard` | Placeholder metryk („Wkrótce”) + nawigacja admina (sidebar). |
| Admin - Użytkownicy | `/admin/users` | Tabela, paginacja, sortowanie, dialog zmiany roli. |
| Moje Przepisy | `/my-recipies` (alias `/my-recipes`) | Własne + publiczne z kolekcji. Filtry, load more 12. Kafelki: serduszko ulubionego (PS-95). |
| Szczegóły (prywatny) | `/recipes/:id-:slug` | Z Sidebarem. Normalizacja URL. Zalogowany: przełączniki flag PS-95 w nagłówku. |
| Kreator - wybór trybu | `/recipes/new/start` | Pusty formularz (wszyscy) lub AI (premium/admin; badge). Kafelek AI nadal zablokowany dla roli `user`. |
| Kreator - AI | `/recipes/new/assist` | Tekst/obraz → AI. Guard `premiumRoleMatchGuard`. Wskaźnik kredytów `draft`, baner i blokada przycisku przy wyczerpaniu, dialog przy `402`. Tryb obrazu: „Wklej ze schowka” (PS-92) obok paste Ctrl+V i wyboru pliku. |
| Formularz przepisu | `/recipes/new`, `/recipes/:id/edit` | CRUD + zdjęcie (`RecipeImageUploadComponent`: paste/drop/file, przycisk „Wklej ze schowka” PS-92, generowanie AI). Sticky Zapisz. Przy zdjęciu AI: kompaktowy wskaźnik kredytów `image` i blokada przycisku przy wyczerpaniu. |
| Import Markdown | `/recipes/import` | Live preview → edycja. |
| Lista kolekcji | `/collections` | CRUD kolekcji. |
| Szczegóły kolekcji | `/collections/:id` | Wszystkie przepisy (limit 500). Kafelki: serduszko ulubionego (PS-95). |
| Zakupy | `/shopping` | Grupy z planu + ręczne. |
| Ustawienia | `/settings` | Username, zgoda marketingowa, hasło; e-mail RO. Sekcja „Kredyty AI” (paski postępu) dla `user` i `premium`; ukryta dla `admin`. CTA do `/pricing` dla roli `user`. |
| Brak dostępu | `/forbidden` | 403 (role / premium). |

### Komponenty globalne / overlay

| Komponent | Opis |
|---|---|
| Drawer "Mój plan" | Panel z prawej: miniatura+nazwa+kosz, wyczyść. Dla roli `user`: licznik „X / 3 pozycji” w nagłówku (kolor ostrzegawczy po osiągnięciu limitu). |
| Dialog limitu planu | Po `422 PLAN_LIMIT_EXCEEDED_FREE` (zamiast snackbara): informacja o limitach Free/Premium, „Zamknij” i „Przejdź na Premium →” (`/pricing`). |
| FAB "Mój plan" | Prawy dolny róg, gdy plan ≥1. |
| Bottom Bar | <960px: Odkrywaj, Moja Pycha, Zakupy. |
| Footer | Copyright + Cennik + Regulamin subskrypcji + Regulamin + Polityka prywatności. |
| Sidebar (drzewo kolekcji) | 3 poziomy, lazy-load. |
| Modal "Dodaj do kolekcji" | Multi-select, szukanie, nowa kolekcja, atomowy zapis. |
| Dialog zmiany roli | Admin: wybór `user`/`premium`/`admin` oraz formularz korekty kredytów AI (zapis `PATCH`, reset zużycia). |
| Wskaźnik kredytów AI | Licznik puli `draft` lub `image` (stan normalny / ostrzeżenie / wyczerpanie). Ukryty dla admina. |
| Dialog wyczerpania kredytów | Po `402` lub kliknięciu wyczerpanego wskaźnika. Free: CTA do `/pricing`. Premium: informacja o dacie resetu. |
| Przycisk Google OAuth | Współdzielony `OauthGoogleButtonComponent` (login/rejestracja). |
| Schowek obrazu (PS-92) | `ClipboardImageService`: detekcja API, odczyt pliku, komunikaty błędów; konsumowane przez upload zdjęcia przepisu i asystę AI. |
| Flagi przepisu (PS-95) | `RecipeFlagsService` + `RecipeFlagTogglesComponent` w `RecipeDetailViewComponent`; wskaźnik `.favorite-indicator` na `RecipeCardComponent`. |
| Filtry Explore (PS-96) | `ExploreRecipeFiltersComponent` + `ExploreFilterStateService` (URL ↔ API); stan i ładowanie feedu w `ExplorePageComponent`; rozszerzenie `PublicRecipesService.getPublicRecipesFeed`. |

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
2. Google OAuth: nowe konto → complete-profile; istniejące konto → dashboard; scalanie e-mail; anulowanie/błąd → `/login?error=…`
3. Cykl życia przepisu: tworzenie → lista → szczegóły → edycja → usuwanie
4. Kolekcje, plan, lista zakupów
5. Admin: lista użytkowników, zmiana roli, odmowa dostępu dla `user`
6. Feature gating: `user` nie wchodzi na `/recipes/new/assist` ani nie generuje zdjęcia AI; API draftu rozlicza kredyty także dla roli `user`
7. Kredyty AI: wskaźnik i sekcja ustawień; wyczerpanie puli → dialog i `402`; admin bez limitu; korekta puli w panelu admina
8. Cennik: `/pricing` dla gościa i zalogowanego (CTA według roli); `/checkout` pokazuje „Płatności wkrótce”
9. Limit planu Free: `user` dodaje 3 przepisy, czwarte → dialog z CTA (bez snackbara); licznik w drawerze; `premium`/`admin` bez blokady do 50; istniejący plan ponad limit nie jest czyszczony
10. Wklej ze schowka (PS-92): happy path PNG/JPG/WebP na formularzu i w asyście (obraz); pusty schowek / zły format / >10 MB / odmowa uprawnień → komunikat inline; brak Clipboard API → przycisk disabled + tooltip; Ctrl+V i DnD nadal działają
11. Flagi przepisów (PS-95): toggle ulubiony i „Chcę wypróbować” na szczegółach, stan po odświeżeniu; serduszko na liście po powrocie; klik w serduszko na kafelku nawiguje do szczegółów; gość bez ikon flag i bez serduszka; błąd zapisu → rollback i snackbar; `401` → login
12. Filtry Explore (PS-96): toggle Termorobot/Grill i dieta; zalogowany — Ulubione/Chcę wypróbować; URL z bookmarku aktywuje chipy; kombinacje filtrów + `q`; load more z zachowanymi filtrami; reset paginacji po zmianie filtra; gość bez chipów flag, `favorite=true` w URL bez efektu; empty state i „Wyczyść filtry”; regresja landingu bez filtrów Explore

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
| Koszt i nadużycia API AI | Rate limit, gating zdjęcia AI (premium), pule kredytów (rezerwacja + zwrot, `402`). Zakup dodatkowych pakietów nie istnieje |
| Limit planu Free sprawdzany przed RPC (COUNT, bez blokady) | Przy równoczesnych żądaniach możliwe przekroczenie o 1 pozycję; akceptowane przy limicie 3. Limit 50 chroniony transakcyjnie w RPC |
| Ceny cennika na sztywno we froncie | Przed startem sprzedaży zastąpić konfigurację statyczną endpointem planów |
| Regresja ról (ostatni admin, JWT) | Walidacja backendu + testy PATCH roli |
| Dług technologiczny | Coverage, review, analiza statyczna |
| Błędy regresji | Zestaw testów w CI/CD |
