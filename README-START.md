# PychaŚwiatowa — Cursor Workflow v2

Gotowy **pakiet projektowy**: 10 historycznych promptów 015/020/043–050, reguły Angular 21 / Supabase, subagenci, skille i skrypty kontroli jakości. Nie zawiera plików źródłowych aplikacji, `types.ts`, `project-summary.md`, poświadczeń ani migracji z PS-31.

## Najważniejsze zmiany względem v1
- Quality Gates są **wykonywalne**: produkcyjny build Angulara, unit tests Vitest, migracja lokalna `supabase migration up --local`, lokalne testy API po zmianach backendu, niezależny code review, RLS review po zmianach SQL.
- CLI zapisuje dla uruchomionego testu kod wyjścia i log, a także fingerprint kodu. Po zmianie źródeł wyniki stają się `stale`.
- Wymagane bramki są wykrywane z `git diff HEAD` i nieśledzonych plików (`supabase/migrations/*.sql`, `supabase/functions/**`); można je dodatkowo zadeklarować w manifeście.
- Playwright/E2E **wyłączone**. Testy jednostkowe: **Vitest**; nie wymagamy uruchamiania testów Deno.
- Brak automatycznego commita, push, merge i wdrożenia. `ready_for_review` ≠ `production deployed`.

## Instalacja / aktualizacja (Windows 11)
1. Zapisz bieżący stan repo (`git status` i kopia bezpieczeństwa/branch). **Nie rozpakowuj w ciemno, gdy masz własne modyfikacje plików `.cursor/`.** Porównaj stare i nowe pliki i scal je (szczególnie `backend.mdc` / `frontend.mdc`). Nie usuwaj istniejących dokumentów w `docs/results/workflows`.
2. Rozpakuj ZIP do katalogu głównego repo. Pliki o tych samych nazwach zastępują wersję v1; nowe pliki uzupełniają konfigurację.
3. Zweryfikuj `.cursor/config/quality.json` w stosunku do rzeczywistych skryptów w `package.json` (nie otrzymaliśmy tego pliku). Domyślne komendy to `npm run build -- --configuration production` oraz `npx vitest run`. Jeśli masz skrypty w innych folderach lub monorepo, dostosuj je przed uruchomieniem.
4. W `.cursor/config/quality.json`, jeśli zmieniasz Edge Functions, ustaw `localApi` na komendę swojego **lokalnego, uwierzytelnionego smoke testu** API (np. `npm run test:api:local`). Bez komendy gate będzie `blocked` i workflow nie oznaczy sukcesu. Test ma kończyć się kodem 0 tylko po udanej weryfikacji API (nie może zwracać 0 bez testowania).
5. Sprawdź czy lokalny Supabase działa: `npx supabase status`. Migracje nakładają się automatycznie w procesie agenta przez `quality.cjs migrate-local` (wymagają lokalnego CLI i potwierdzonego lokalnego statusu). **Nigdy nie wykonuj `db reset`** ani migracji produkcyjnych.
6. Zamknij i otwórz nowy Agent chat w Cursorze (lub sprawdź odświeżone skille). Dla rzeczywiście niezależnego review ustaw w `.cursor/agents/independent-reviewer.md` konkretny inny model niż model główny; `inherit` nie gwarantuje różnicy.
7. Pierwszy test nowej story: `/feature-workflow Rozpocznij pojedynczą User Story LOCAL-demo-v2. Zadawaj pytania i zatrzymuj się na decyzjach produktowych. Bez commita i wdrożenia.`

## Aktualizacja istniejącej story PS-31
Otwórz terminal w katalogu głównym repo:

```powershell
node .cursor/scripts/workflow.cjs upgrade LOCAL-recipe-private-note
node .cursor/scripts/workflow.cjs status LOCAL-recipe-private-note
node .cursor/scripts/quality.cjs requirements LOCAL-recipe-private-note
node .cursor/scripts/quality.cjs validate LOCAL-recipe-private-note
```

Upgrade zachowuje historię, statusy, dokumenty i approvals v1. Nie tworzy fałszywych `passed`. Jeśli PS-31 nie ma wszystkich dowodów testów, v2 prawidłowo pokaże brakujące gates.

## Quality Gates — przykłady

```powershell
# Sprawdź wymagane kontrole
node .cursor/scripts/quality.cjs requirements LOCAL-recipe-private-note

# Jeśli dotyczy SQL: tylko lokalna migracja, bez resetowania danych
node .cursor/scripts/quality.cjs migrate-local LOCAL-recipe-private-note

# Obowiązkowe dla implementacji Angular
node .cursor/scripts/quality.cjs run LOCAL-recipe-private-note angularBuild
node .cursor/scripts/quality.cjs run LOCAL-recipe-private-note vitest

# Jeśli zmieniły się Edge Functions, wymagany skonfigurowany lokalny smoke test API
node .cursor/scripts/quality.cjs run LOCAL-recipe-private-note localApi

# Podsumowanie blokad i wyników
node .cursor/scripts/quality.cjs validate LOCAL-recipe-private-note
```

Weryfikacja reviewerów:

```
REVIEWER: independent-reviewer
VERDICT: PASS
```

Wiersze te muszą się znaleźć w rzeczywistym raporcie reviewera, a Orchestrator rejestruje je poleceniem (przykład):

```powershell
node .cursor/scripts/quality.cjs review-evidence LOCAL-recipe-private-note codeReview docs/results/workflows/LOCAL-recipe-private-note/code-review.md
node .cursor/scripts/quality.cjs review-evidence LOCAL-recipe-private-note rlsReview docs/results/workflows/LOCAL-recipe-private-note/rls-review.md
```

**Uwaga:** to atestacja w pliku, nie kryptograficzny dowód niezależności subagenta; włącz rzeczywiste subagenty i sprawdzaj ich wyniki w Cursorze. Jeśli po testach/review zmienią się źródła, run `quality.cjs validate` pokaże `stale`.

## Bezpieczeństwo i ograniczenia
- Hooki `beforeShellExecution` i `beforeMCPExecution` to dodatkowa heurystyczna zapora, **nie sandbox**. Nie zastępują uprawnień Supabase i GitHub, ochrony branchy oraz wymogu zatwierdzeń wdrożeń. Mogą nie rozpoznać ukrytych operacji złożonych; operacje zdalne najlepiej technicznie zablokować także w poświadczeniach środowiska lokalnego.
- Lokalny `migration up --local` nie usuwa danych, ale każda migracja SQL może zawierać destrukcyjne DDL. Agent **musi przejrzeć SQL przed uruchomieniem**; skrypt nie umie dowieść, że SQL nie usuwa danych. Wrażliwe dane lokalne backupuj.
- Fingerprint kontroluje treść plików repozytorium z wyłączeniem dokumentacji, `.cursor/`, `dist`, `coverage`. Nie jest kompletnym systemem CI ani mechanizmem przeciwdziałającym świadomej manipulacji. Logi testów mogą zawierać informacje wrażliwe — nie dodawaj ich do commita.
- Jeśli masz zmianę backendu bez nowego skryptu `localApi`, workflow kończy się jako `blocked` zamiast zgłaszać niezweryfikowaną gotowość.
- Poświadczenia testowe nie są częścią pakietu; używaj lokalnych sekretów/zmiennych środowiskowych, nigdy dokumentów rules.
- `docs/results/project-summary.md` weryfikuj z rzeczywistą implementacją, nie z samą obecnością DTO. Nie nazywaj lokalnej implementacji wdrożeniem produkcyjnym.

## Testy samej konfiguracji

```powershell
node tests/workflow-v2-smoke.cjs
node tests/guard-smoke.cjs
```

## Odnośniki techniczne
- https://cursor.com/docs/hooks
- https://cursor.com/docs/skills
- https://cursor.com/docs/subagents
- https://supabase.com/docs/reference/cli/introduction
