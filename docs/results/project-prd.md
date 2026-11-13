# PychaŚwiatowa — PRD i stan produktu

> Stabilny dokument referencyjny (zmieniany świadomie, nie przy każdej historyjce): dostarczone funkcje,
> backlog z Jiry (migawka), streszczenie PRD, historyjki początkowe i plan testów. Aktualny stan techniczny
> (tabele, RPC, Edge Functions, trasy) jest w `project-reference.md` (generowany z kodu), a skrót dla
> planerów w `project-brief.md`. Rejestr zrealizowanych historyjek: `project-summary.md`.
> Pełna wersja sprzed rozdzielenia: `docs/archive/project-summary-2026-11-13.md`.

## Stan produktu — dostarczone funkcje (migawka 2026-11-13)

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
- **Notatka przy przepisie (PS-31):** prywatna notatka (do 2000 znaków) w szczegółach własnych i publicznych cudzych przepisów; edycja inline, usuwanie z potwierdzeniem, dialog „Niezapisane zmiany” przy opuszczeniu strony
- **Nazwa użytkownika w topbarze (PS-37, zaimplementowane, niezweryfikowane):** `CurrentUserStateService` + nazwa obok ikony konta w `TopbarComponent` (responsywnie, tooltip, nagłówek menu); odświeżanie po zmianie nazwy w Ustawieniach i po uzupełnieniu profilu
- **Autor na szczegółach przepisu (PS-15, zaimplementowane, niezweryfikowane):** `author` w `RecipeDetailDto` na obu trasach szczegółów; sekcja autora w `RecipeHeaderComponent`; przywrócone `tips` w API explore
- **Przepisy publiczne w panelu admina (PS-204, zaimplementowane, niezweryfikowane):** `/admin/recipes` — tabela tylko do odczytu (paginacja 25/50/100, sortowanie serwerowe po sześciu polach, link „Otwórz przepis” w nowej karcie), `GET /admin/recipes`, RPC `admin_get_recipes_page` (polska kolacja `pl-x-icu`); migracja odbiera `execute` rolom `public`/`anon`/`authenticated` także `admin_get_users_page` i `admin_update_user_role`

## Backlog produktowy (migawka 2026-11-13; źródło prawdy: Jira)

| ID | Temat |
|---|---|
| PS-34 | Poprawa generowania opisu przez AI |
| PS-35 | Poprawa generowania zdjęcia przez AI |
| PS-38 | Gemini przy generowaniu zdjęcia **bez** referencji |
| PS-59 | Drag & drop obrazka do asysty AI |

**W toku:** PS-62 Plan biznesowy (freemium / Premium — analiza w
`docs/results/new-features/epics/premium-users/analiza-funkcjonalnosci-premium-users.md`,
historyjki w `premium-users-user-stories.md`). Widok cennika, stub checkout i
pule kredytów AI (PS-64) są wdrożone. Subskrypcja i właściwy checkout płatności
**nie są zaimplementowane**.

**Nie będzie realizowane (Jira):** PS-17 (filtr wyszukiwarki o rodzaj/termorobot — osobny ticket), PS-20 (przebudowa wyszukiwarek), PS-26 (stary ticket listy zakupów; funkcja jest jako PS-42).

---

## 1. Opis Projektu (streszczenie PRD)

**PychaŚwiatowa** to responsywna aplikacja webowa (SPA) zaprojektowana jako centralna, cyfrowa książka kucharska. Użytkownicy mogą gromadzić, organizować i przeszukiwać własne przepisy kulinarne w jednym miejscu.

### Główne założenia produktu (stan obecny)

- Podejście **desktop-first** z pełną responsywnością (mobile/tablet)
- System kont: e-mail+hasło (potwierdzenie e-mail) **oraz Google OAuth**; role (`user`, `premium`, `admin`) w JWT (`app_role`)
- Sekcja administracyjna pod `/admin/*`: dashboard (placeholder metryk), lista użytkowników, edycja roli, tabela przepisów publicznych — PS-204 (guard + widoczność w nawigacji bez „migania”)
- Pełny CRUD przepisów z formularzem: nazwa, opis, porcje, czasy, flagi (Termorobot/Grill), klasyfikacja (dieta/kuchnia/trudność), składniki, kroki, wskazówki, zdjęcie
- Trzy poziomy widoczności przepisu: Prywatny, Współdzielony, Publiczny
- Organizacja: kategorie (predefiniowane), tagi (własne), kolekcje (nazwane zbiory)
- "Mój plan" — trwała lista do 50 przepisów (Free: do 3, PS-65), powiązana z listą zakupów
- Lista zakupów — pozycje z przepisów (znormalizowane składniki) + ręczne wpisy
- Import przepisu z Markdown (bez LLM, wszyscy zalogowani) oraz asystowane dodawanie z AI (tekst/obraz → formularz). API draftu rozlicza kredyty `draft` (także rola `user`); ekran asysty w UI nadal tylko `premium`/`admin`
- Generowanie zdjęć AI (**premium/admin**, pula kredytów `image`) — model Gemini `gemini-3-pro-image-preview` (bez referencji i z referencją); możliwe przed pierwszym zapisem przepisu
- Publiczny portal: landing z wyszukiwaniem, katalog `/explore` z chipami filtrów (Termorobot, Grill, dieta, dla zalogowanych flagi PS-95), kanoniczne URL ze slugiem
- Publiczny cennik `/pricing` (Free vs Premium, ceny statyczne) i zapowiedź płatności na `/checkout`; sprzedaż subskrypcji jeszcze nie działa
- Kredyty AI per użytkownik: Free dożywotnie, Premium miesięcznie, admin bez limitu; podgląd w ustawieniach i korekta w panelu admina
- Asynchroniczna normalizacja składników (worker cron + retry)
- Osobiste flagi przepisu (PS-95): „Ulubiony” i „Chcę wypróbować” na własnych i widocznych cudzych przepisach; tylko zalogowany; serduszko na kafelkach list
- Prywatna notatka przy przepisie (PS-31): jedna notatka na użytkownika i przepis (własny lub cudzy `PUBLIC`), do 2000 znaków; widoczna tylko dla jej autora, edytowana na szczegółach; ochrona przed utratą niezapisanej treści przy opuszczeniu strony
- Autor przepisu na szczegółach (PS-15): nazwa użytkownika autora pod tytułem/porcjami na `/recipes/…` i `/explore/recipes/…` (tekst, bez linku do profilu); wskazówki kulinarne na trasie explore zgodne z prywatnym API
- Zgodność: regulamin, polityka prywatności i regulamin subskrypcji, zgoda marketingowa, menedżer zgód cookies

### Granice (poza zakresem / zaplanowane później)

- Import z linków URL, automatyczne planowanie posiłków, zamienniki AI, konto rodzinne — plan Premium (`PREM-*`), nie w kodzie
- Zarządzanie spiżarnią
- Funkcje społecznościowe (znajomi, komentarze i tekstowe recenzje)
- Zaawansowane wartości odżywcze, historia zmian
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
| PS-31 | Notatka użytkownika przy przepisie | Prywatna notatka (1–2000 znaków) na szczegółach `/recipes/…` i `/explore/recipes/…`; dodaj/edytuj/usuń; `PUT /recipes/{id}/note`; `my_note` tylko dla zalogowanego; guard niezapisanych zmian. |
| PS-15 | Autor przepisu na szczegółach | `author: ProfileDto` w `GET /recipes/{id}` i `GET /explore/recipes/{id}`; UI w `RecipeHeaderComponent` (Autor: username, bez linku). Status: zaimplementowane, niezweryfikowane (brak testów Deno API). |
| PS-37 | Nazwa użytkownika w topbarze | Zalogowany: nazwa obok ikony konta (od 600 px, obcięcie `ellipsis`; poniżej 600 px tylko ikona), tooltip/`aria-label` „Zalogowano jako …”, nagłówek w menu użytkownika; odświeżenie po zmianie w `/settings`. Status: zaimplementowane, niezweryfikowane (brak testów ręcznych). |
| PS-96 | Filtry w katalogu Odkrywaj | `/explore`: chipy filtrów (Termorobot, Grill, dieta vege_plus/vegan, Ulubione/Chcę wypróbować dla zalogowanych); sync z URL; `GET /public/recipes/feed` z parametrami `diet`, `favorite`, `want_to_try`; reset paginacji przy zmianie filtrów; empty state „Wyczyść filtry”. |
| PS-99 | Oceny przepisów | Ocena 1–5 na szczegółach publicznych przepisów; agregat dostępny dla gościa, zapis dla zalogowanego nie-autora, optimistic update i rollback. |
| US-028 | Liczba porcji | Opcjonalne pole 1-99, wyświetlane pod tytułem z odmianą. |
| US-029 | Flaga "Termorobot" | Toggle w formularzu, badge na kartach/listach. |
| US-030 | Przycisk "Więcej" (load more) | Domyślnie 12 elementów, doładowywanie kolejnych 12. |
| US-031 | Przepisy kolekcji bez paginacji | Jednorazowe ładowanie (limit techniczny 500). |
| US-032 | Ikonka widoczności na liście | Ikona Prywatny/Współdzielony/Publiczny z tooltipem, tylko dla autora. |
| US-036 | Asystowane dodawanie (AI) | Wklejenie tekstu/obrazu → LLM → wstępnie wypełniony formularz wraz z porcjami, czasami, klasyfikacją i flagami. Metadane są normalizowane tolerancyjnie. Rozliczenie kredytów `draft` (`402` przy wyczerpaniu). Trasa UI `/recipes/new/assist` — `premium`/`admin`; endpoint przyjmuje też rolę `user`. |
| US-037 | Generowanie zdjęcia AI | Przycisk AI w edycji/kreatorze, podgląd, akceptacja, Gemini `gemini-3-pro-image-preview`. `premium`/`admin` plus pula kredytów `image`. Możliwe przed zapisem przepisu. |
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
| PS-204 | Admin: tabela przepisów publicznych | `/admin/recipes` („Przepisy publiczne”): tylko `PUBLIC` bez usuniętych, odczyt, paginacja 25/50/100, sortowanie 6 pól (polska kolejność, „bez ocen/kategorii/nazwy autora” na końcu), autor z e-mailem, link w nowej karcie; `GET /admin/recipes`. Status: zaimplementowane, niezweryfikowane (brak smoke testu `200`/`403` i testu w przeglądarce). |
| US-ADM-004 | Admin: zmiana roli | Dialog „Edytuj rolę”; zakaz zmiany własnej roli i obniżenia ostatniego admina. JWT docelowego użytkownika odświeża się po ponownym logowaniu. Zmiana na `user`/`premium` ustawia pulę kredytów AI; w tym samym dialogu jest korekta puli. |

Historyjki monetyzacji `PREM-001` … (entitlements, checkout płatności) są w
`docs/results/new-features/epics/premium-users/premium-users-user-stories.md` i
**nie zastępują** powyższych story MVP. Publiczny widok `/pricing`, stub
`/checkout` oraz kredyty AI (PS-64) są już w aplikacji. Sprzedaż subskrypcji i
pakietów kredytów nie jest.

---

## 7. Plan Testów (streszczenie)

### Strategia

Piramida testów: solidna baza jednostkowych, uzupełniona integracjami i E2E.

| Poziom | Narzędzie | Cel |
|---|---|---|
| **Jednostkowe** | Vitest | Komponenty, serwisy, walidacja, guardy ról. |
| **Integracyjne** | Vitest | Współpraca komponent+serwis. Mockowany backend. |
| **E2E** | Playwright | Scenariusze w przeglądarce Chromium. |
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
13. Autor na szczegółach (PS-15): własny i cudzy publiczny przepis na `/recipes/…` i `/explore/recipes/…` — widoczny „Autor: {username}”; brak linku; brak sekcji przy `username` null; wskazówki (`tips`) widoczne na explore po odświeżeniu; regresja nagłówka (porcje, opis, flagi)
14. Przepisy publiczne w panelu admina (PS-204) — **do wykonania ręcznie, NIE_WYKONANO**: sortowanie sześciu kolumn w obu kierunkach, brak ocen/kategorii/nazwy autora, paginacja i rozmiar 25/50/100, strona poza zakresem, link w nowej karcie, szerokość < 600 px, `user` bez dostępu, gość → logowanie, F5 → stan domyślny; smoke `GET /admin/recipes` `200`/`403`/`401` oraz `GET /admin/users` bez regresji; sprawdzenie ACL trzech funkcji i dostępności `pl-x-icu` na produkcji

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
| Kolacja `pl-x-icu` niedostępna na produkcji (PS-204) | Strażnik w migracji zatrzymuje `db push`; sprawdzić przed merge; wariant zastępczy tylko po jawnej akceptacji |
| Odebrane `execute` funkcji admin (PS-204) | Przyszła migracja przebudowująca te funkcje (`drop` + `create`, np. unified-entitlements) musi powtórzyć `revoke`; rollback nie przywraca uprawnień |
| CI uruchamia tylko Vitest (PS-204) | `deno test`, lint i build ręcznie przed merge; reguły `ORDER BY` pokrywa tylko opt-in test na lokalnej bazie |
| Inne funkcje admin/RPC z niepełnym `revoke` | Osobne zgłoszenie bezpieczeństwa (poza PS-204) |
| Dług technologiczny | Coverage, review, analiza statyczna |
| Błędy regresji | Zestaw testów w CI/CD |
