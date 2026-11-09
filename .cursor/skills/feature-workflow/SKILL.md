---
name: feature-workflow
description: Steruje pełnym workflow PychaŚwiatowa Epic/User Story z manifestem v2 i obowiązkowymi Quality Gates (Angular build, Vitest, lokalny Supabase, code review), bez E2E i deployu.
---
# Feature workflow v2
1. Odczytaj `.cursor/rules/workflow-policy.mdc`, `.cursor/rules/quality-policy.mdc`, reguły backend/frontend, `docs/results/project-summary.md` i `shared/contracts/types.ts` z aktualnego repo. Ustal ID, nie wymyślaj PS-*. Jeśli workflow istnieje, `node .cursor/scripts/workflow.cjs upgrade ID`; nigdy nie resetuj manifestu.
2. Wykonuj ścieżkę Story `story → design → api_plan → ui_plan → api_impl → ui_impl → qa → summary → ready_for_review` lub Epic `analysis → analysis_review → stories`. Po każdym etapie sprawdzaj status i rejestruj pliki przez `workflow.cjs artifact`.
3. Wykonaj 046 (story), 047 (plany), 048+049 (implementacyjne), review z niezależnym subagentem, 015+020 (kod). Gdy reviewer zgłosi blocker, napraw i przeprowadź ponowny review po zmianach. Subagent reviewer w osobnym kontekście; inny model tylko gdy jawnie skonfigurowany.
4. Przed implementacją nie domniemuj akceptacji wymagań/planu. Manifest `approvals` nie jest bezpiecznym dowodem użytkownika; wymagaj jawnej akceptacji w rozmowie.
5. Po implementacji ustal zakres zmienionych plików w Git. Jeśli migracje: najpierw review SQL i polityk RLS, następnie `node .cursor/scripts/quality.cjs migrate-local ID`. Skrypt (globalne Supabase CLI) potwierdzi, że celem jest lokalny Supabase tego projektu, i zastosuje tylko zaległe migracje `--local` — bez resetu danych (podgląd bez zmian: `quality.cjs preflight-local`). Lokalne Edge Functions muszą działać na aktualnym kodzie, a ENV nie może być wyświetlane.
6. Sprawdź `.cursor/config/quality.json` przeciw prawdziwemu `package.json`. `node .cursor/scripts/quality.cjs run ID angularBuild`, następnie `... run ID vitest`. Jeśli backend zmieniony, dodaj/uzupełnij scenariusze `supabase/tests/api/<funkcja>.smoke.json` i uruchom `... run ID localApi` — brak scenariusza dla zmienionej funkcji to błąd, nie sukces. Testy Vitest są obowiązkowe; Playwright jest wyłączony; testy Deno są opcjonalne i nie blokują.
   Zakres zmian gate'ów: `quality.cjs scope ID show` (baza `scope.baseRef`); dla starszych manifestów ustaw `scope ID set-base <sha>`.
7. Wykonaj osobny code review i (przy migracji) RLS review. Raporty z `REVIEWER: independent-reviewer` oraz `VERDICT: PASS` zarejestruj `quality.cjs review-evidence ID codeReview|rlsReview <path>`; ten mechanizm rejestruje oświadczenie reviewera, nie dowodzi technicznie jego tożsamości. Przy poprawkach kodu powtórz gate'y i review.
8. Gdy `node .cursor/scripts/quality.cjs validate ID` zwróci valid=true, stwórz QA raport, aktualizuj project-summary według 050 wyłącznie jako 'lokalnie zaimplementowane'. Użyj workflow.cjs do przejść, nie edytuj stage ręcznie.
9. `ready_for_review` to wynik implementacyjny zweryfikowany lokalnie, NIE zgoda na commit/merge/push/deploy. Nie wykonuj tych operacji bez jawnej prośby użytkownika.
10. Materiały z promptów 015/020/043–050 są w `references/prompts/`; ignoruj zaszyte w nich stare ścieżki, PS-ID, wzorce React i założenia niezgodne z bieżącą architekturą.

## Diagnostyka i wznowienie
- `node .cursor/scripts/workflow.cjs status ID`
- `node .cursor/scripts/workflow.cjs validate ID`
- `node .cursor/scripts/quality.cjs requirements ID`
- `node .cursor/scripts/quality.cjs validate ID`

Brak testów/kompilacji w raporcie to blokada, a nie drobna uwaga.
