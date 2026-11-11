# PS-204 — Retrospektywa procesu

**Slug:** `admin-public-recipes-table`  
**Data:** 2026-11-11  
**Źródła dowodów:** przebieg rozmowy (bramki i rundy pytań), „Historia zmian" w historyjce, artefakty review
(`…-review-api-r1/r2.md`, `…-review-views-r1/r2.md`), artefakt weryfikacji, aborty subagentów i awarie narzędzi.

## 1. Przebieg

| Etap | Rundy pytań | Poprawki / rundy review | Status |
|---|---|---|---|
| Historyjka | 2 rundy (7 + 7 pytań, w tym 2 odpowiedzi własne: „b + kategoria", „usunąć kolumnę") | analiza wymagań, bez review | zaakceptowana (bramka 1) |
| Plan funkcjonalny | 2 rundy (3 + 2 pytania) | zmiany reguł sortowania, polska kolejność, bigint `page` (9 wpisów „Historia zmian") | zaakceptowany (bramka 2) |
| Plany implementacji (API, widoki) | 1 runda (3 pytania) | plan API poprawiony o bigint/revoke/test lokalny | zaakceptowane (bramka 3) |
| Implementacja API | 2 decyzje po review (baza lokalna, `admin_update_user_role`) | review r1 (3 zakresy, 8 blokujących) → poprawki 1 → review r2 (api-db, api-code OK; api-tests WYMAGA_POPRAWEK) → dodatkowa runda testów (zgoda użytkownika) | zaakceptowane z długiem: `api-tests` BEZ_REVIEW po dodatkowej rundzie |
| Implementacja widoków | 0 | review r1 (views-code OK z uwagą, views-tests 4 blokujące) → poprawki 1 → review r2 (views-tests: 1 blokująca) → dodatkowa runda → re-review ZAAKCEPTOWANE | zaakceptowane |
| Summary | 0 | — | zaktualizowane, status „zaimplementowane, niezweryfikowane" |

Łącznie: 3 bramki + 2 decyzje po review + 2 decyzje o dodatkowej rundzie ponad limit; 0 odpowiedzi `Zatrzymaj się`.

## 2. Co poszło dobrze

- **Wczesne pytania ograniczyły późne zmiany wymagań.** 9 wpisów „Historia zmian" dotyczy etapu planu funkcjonalnego; po etapie
  implementacji nie zmieniły się decyzje produktowe (tylko techniczne: bigint, revoke).
- **Review wykryło realne ryzyka przed wdrożeniem:** `drop function` obiektu spoza repo (DB-B1), kolizja znacznika migracji
  (DB-B2), brak `revoke` dla `admin_get_users_page` i `admin_update_user_role` (DB-W2 — luka ACL w migracjach repo).
- **Mutacja ochrony `latestRequestId`** (dodatkowa runda widoków) potwierdziła, że poprawiony test wyścigu faktycznie pada
  bez ochrony — dowód w `…-verification.md` i w terminalu.
- **Limit rund był respektowany**, a przekroczenie następowało tylko za zgodą użytkownika na bramce.
- **Statusy bez zawyżania:** smoke 200/403, `deno lint`, `pl-x-icu` na produkcji i test w przeglądarce zapisane jako
  `WYMAGA_WERYFIKACJI` / `NIE_WYKONANO`, nie `PASS`.

## 3. Co poszło źle

| # | Problem | Dowód | Przyczyna źródłowa | Koszt |
|---|---|---|---|---|
| P1 | Pierwsze implementacje miały niepełne testy względem planu | api-tests r1: 8 uwag blokujących/ważnych (TEST-1..9); views-tests r1: pokrycie < 50% sekcji 11 planu (strona 4/14, tabela 3/10) | implementerzy kończą po zielonym `lint/Vitest/deno test`, bez porównania z sekcją testów planu | 2 dodatkowe rundy poprawek ponad limit, ~6 dodatkowych review/uruchomień |
| P2 | Test wyścigów nie wykrywał regresji | views-tests r2 B1: odpowiedzi w naturalnej kolejności, test przechodził bez ochrony `latestRequestId` | brak wymogu sprawdzenia, że test pada po usunięciu zabezpieczenia | blokujący bloker po 2 rundach → dodatkowa runda |
| P3 | Luka ACL w istniejących funkcjach admin wykryta dopiero przy review | DB-W2: `admin_get_users_page` i `admin_update_user_role` bez `revoke` dla `anon/authenticated` w migracjach repo; lokalnie ACL było poprawne tylko dzięki zagubionej migracji spoza repo | brak checklisty ACL dla funkcji `security definer` w planie/implementacji API | rozszerzenie zakresu migracji, test ACL, osobne zgłoszenie dla innych funkcji |
| P4 | Lokalna baza niezgodna z repo | `supabase migration up` → `MigrationMissingLocalError`; wymusił `db dump` + `db reset`; dane dev sprzed resetu nieprzywrócone (kopia w `%TEMP%`) | implementer API nie sprawdzał dryfu historii migracji przed uruchomieniem; brak procedury „stan lokalnej bazy" | decyzja użytkownika + utrata danych lokalnych |
| P5 | Hook `verify-implementation.ps1` zapisuje `FAIL` bez przyczyny | `…-verification.md`: wpisy 22:32–23:08 `deno test FAIL` i `npm run build FAIL`; hook uruchamia `deno test --allow-all supabase/functions` (cały katalog) i nie zapisuje fragmentu wyjścia; ręczne `deno test` w zakresie `admin/` z flagami przechodziło | hook nie zawęża zakresu i nie raportuje przyczyny; wpisy trzeba było ręcznie wyjaśniać (updater, orkiestrator) | czas na wyjaśnienia, ryzyko ignorowania prawdziwego FAIL |
| P6 | Smoke test endpointu i widoku niewykonany | `…-verification.md`: `WYMAGA_WERYFIKACJI` w etapie API i widoków — brak danych logowania admina w `.env.local` | brak przygotowanych kont testowych/instrukcji w repo i brak sprawdzenia w preflight | historyjka zamknięta jako „zaimplementowana, niezweryfikowana" |
| P7 | Po wyczerpaniu limitu rund brak jednolitej polityki | dwie dodatkowe rundy: API (po niej `BEZ_REVIEW` dla `api-tests`), widoki (po niej re-review) | skill `ps-code-review` i flow opisują maks. 2 rundy, ale nie opisują zachowania po limicie | niespójność: jedno re-review wykonane, drugie pominięte |
| P8 | Awarie narzędzi | aborty implementera API (limit modelu) → `resume`; błąd JSON w `AskQuestion`; nieudane pomiary `psql` (3 próby); hook nie zapisał artefaktu `verification` po API | brak procedur awaryjnych dla hooka i długich zadań | drobny koszt czasowy |

## 4. Propozycje zmian

- **R1 — Hook weryfikacji: zakres i przyczyna błędu.**
  Plik: `.cursor/hooks/verify-implementation.ps1` (linie z `deno test --allow-all supabase/functions`, `npm run build`).
  Zmiana: uruchamiać `deno test` tylko dla zmienionych katalogów funkcji, a przy `FAIL` dopisywać do artefaktu 5–10 ostatnich linii wyjścia
  polecenia. Rozwiązuje P5. Ryzyko: zawężenie może pominąć błąd w funkcji współdzielonej `_shared` — dodać `_shared` do zakresu, gdy zmieniony.
- **R2 — Wymóg tabeli pokrycia sekcji testów planu przed zakończeniem implementacji.**
  Pliki: `.cursor/agents/ps-api-implementer.md`, `.cursor/agents/ps-view-implementer.md`.
  Zmiana: przed zwrotem raportu implementer porównuje testy z sekcją testów planu i dołącza tabelę pokrycia (pokryte/częściowo/brak);
  luki bez uzasadnienia = praca niedokończona. Rozwiązuje P1. Ryzyko: dłuższy raport; formalne „pokryte" bez treści — reviewer testów nadal weryfikuje.
- **R3 — Testy zabezpieczeń współbieżności i zabezpieczeń ACL muszą wykrywać regresję.**
  Pliki: `.cursor/agents/ps-view-implementer.md`, `.cursor/agents/ps-api-implementer.md`, `.cursor/agents/ps-code-reviewer.md`.
  Zmiana: dla testów wyścigów (`Subject`, odwrócona kolejność) i testów uprawnień wymagana jawna weryfikacja mutacyjna („test pada po usunięciu
  zabezpieczenia", bez zostawiania zmiany); reviewer sprawdza ten dowód. Rozwiązuje P2. Ryzyko: tymczasowa edycja kodu produkcyjnego — zawsze
  przywracać i potwierdzić `git diff`.
- **R4 — Checklista ACL dla funkcji `security definer`.**
  Pliki: `.cursor/rules/backend.mdc` i `.cursor/skills/ps-implement-api/SKILL.md`.
  Zmiana: każda nowa/zmieniana funkcja RPC `security definer` w migracji musi mieć `revoke … from public, anon, authenticated`, jawny `grant`
  oraz samosprawdzenie `has_function_privilege`; przy przebudowie funkcji (np. przyszła `unified-entitlements`) `revoke` jest powtarzany.
  Rozwiązuje P3. Ryzyko: wymaga uzupełnienia istniejących funkcji — poza zakresem PS-204 (osobne zgłoszenie).
- **R5 — Procedura stanu lokalnej bazy przed migracją.**
  Plik: `.cursor/agents/ps-api-implementer.md` (preflight).
  Zmiana: przed `migration up`/`db reset` sprawdzić `supabase migration list` pod kątem wersji spoza repo; przy dryfie — zatrzymać się i zapytać
  użytkownika; przed `db reset` zawsze wykonać `db dump` i podać użytkownikowi, jak przywrócić dane. Rozwiązuje P4. Ryzyko: dłuższy preflight.
- **R6 — Dane do smoke testów w preflight.**
  Pliki: `docs/flow/flow-new-feature.md` i `.cursor/agents/ps-api-implementer.md`.
  Zmiana: na etapie planów implementacji sprawdzać, czy `.env.local` ma konta admin/user do smoke testów; jeśli nie — pytanie do użytkownika
  (przygotuj konta / zaakceptuj `WYMAGA_WERYFIKACJI`) zanim zacznie się implementacja. Rozwiązuje P6. Ryzyko: dodatkowe pytanie w prostych historyjkach.
- **R7 — Polityka po wyczerpaniu limitu rund review.**
  Pliki: `.cursor/skills/ps-code-review/SKILL.md` i `docs/flow/flow-new-feature.md`.
  Zmiana: po r2 z blokerem bramka oferuje „dodatkowa runda ograniczona do uwag blokujących i ważnych + obowiązkowe re-review tego samego
  zakresu"; `BEZ_REVIEW` tylko z jawną decyzją użytkownika. Rozwiązuje P7. Ryzyko: wydłużenie procesu; limit nadal chroni przed pętlą (maks. +1 runda).

## 5. Decyzja użytkownika

Użytkownik wybrał wdrożenie wszystkich propozycji (R1–R7). Wdrożone minimalnie, w stylu istniejących plików:

| Propozycja | Status | Zmienione pliki |
|---|---|---|
| R1 | WDROŻONE | `.cursor/hooks/verify-implementation.ps1` (`deno test` tylko dla zmienionych funkcji, `_shared` → wszystkie; ostatnie linie wyjścia przy `FAIL` w artefakcie; składnia sprawdzona parserem PowerShell, hook nie uruchamiany) |
| R2 | WDROŻONE | `.cursor/agents/ps-api-implementer.md`, `.cursor/agents/ps-view-implementer.md` |
| R3 | WDROŻONE | `.cursor/agents/ps-api-implementer.md`, `.cursor/agents/ps-view-implementer.md`, `.cursor/agents/ps-code-reviewer.md`, `.cursor/skills/ps-code-review/SKILL.md` |
| R4 | WDROŻONE | `.cursor/rules/backend.mdc`, `.cursor/skills/ps-implement-api/SKILL.md` |
| R5 | WDROŻONE | `.cursor/skills/ps-implement-api/SKILL.md`, `.cursor/agents/ps-api-implementer.md` |
| R6 | WDROŻONE | `docs/flow/flow-new-feature.md`, `.cursor/skills/ps-new-feature/SKILL.md` |
| R7 | WDROŻONE | `.cursor/skills/ps-code-review/SKILL.md`, `docs/flow/flow-new-feature.md` |

Odrzucone: brak. Nie commitowano.
