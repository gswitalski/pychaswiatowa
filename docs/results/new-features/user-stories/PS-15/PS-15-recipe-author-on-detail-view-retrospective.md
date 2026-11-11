# PS-15 — Retrospektywa procesu

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11

## 1. Przebieg

| Etap | Rundy pytań | Wynik | Review | Weryfikacja |
|---|---|---|---|---|
| Historyjka | R1 (6 pytań) | Zapis | — | — |
| Plan funkcjonalny | R1 (5 pytań) | 4 plany | — | — |
| Plany implementacji | R1 (1 pytanie API) | 2 plany impl. | — | — |
| API | — | Kod + verification | r1 **ZMIANY_WYMAGANE** (subagent ×2 aborted) | Deno **NIE_WYKONANO**; build PASS |
| Widoki | — | Kod + 10 testów Vitest | r1 **AKCEPTACJA** (subagent aborted) | lint/test/build PASS |
| Summary | — | Zaktualizowano `project-summary.md` | — | — |

Bramki: użytkownik wybrał **Kontynuuj** na każdym etapie; implementacja widoków mimo otwartego review API (świadoma decyzja).

## 2. Co poszło dobrze

- Wczesna analiza kodu wykryła lukę `tips` w explore oraz brak `author` w detail DTO — bez nowej migracji SQL.
- Spójny wzorzec `fetchAuthorProfile(client, userId)` po decyzji API-1.
- UI w jednym komponencie (`RecipeHeaderComponent`) pokrywa obie trasy szczegółów.
- Pełna dokumentacja w `docs/results/new-features/user-stories/PS-15/`.

## 3. Co poszło źle

| Problem | Dowód | Przyczyna | Koszt |
|---|---|---|---|
| Brak testów Deno mimo DoD | `verification.md` — POMINIĘTE G1–G4; brak `explore.service.test.ts` | Brak Deno lokalnie; implementer API pominął testy | Review API nieakceptowalne; ryzyko regresji |
| `ps-code-reviewer` niestabilny | 3× `Subagent was aborted` | Środowisko / subagent | Review w orkiestratorze; mniejsza niezależność |
| Pełne pytania subagentów w czacie | Story/planner skracały odpowiedź | Format odpowiedzi subagentów | Orkiestrator musiał resume / czytać kod |

## 4. Propozycje zmian

| ID | Plik | Zmiana | Problem | Ryzyko |
|---|---|---|---|---|
| R1 | `.cursor/skills/ps-implement-api/SKILL.md` | Wymagaj utworzenia/aktualizacji plików `*.test.ts` z planu przed statusem PASS; przy braku Deno — jawny `FAIL` checklisti testów, nie `POMINIĘTE` | Pominięte testy API | Dłuższa implementacja |
| R2 | `docs/flow/flow-new-feature.md` | Dopisek: przy braku Deno — CI `validate-backend` jako obowiązkowa weryfikacja API przed akceptacją | NIE_WYKONANO traktowane jako „prawie gotowe” | Zależność od CI |
| R3 | `.cursor/agents/ps-story-analyst.md` | W trybie `pytania` wymagaj pełnego bloku pytań w odpowiedzi (nie tylko summary) | Utrata szczegółów w Task output | Dłuższe odpowiedzi modelu |
| R4 | `.cursor/skills/ps-new-feature/SKILL.md` | Po 2× abort review: domyślnie zmniejsz zakres diffu (jeden plik) przed trzecią próbą | Kosztowne retry pełnego repo | Więcej rund review |

## 5. Decyzja użytkownika

| Propozycja | Decyzja |
|---|---|
| R1 | Odrzucona |
| R2 | **Wdrożona** — `docs/flow/flow-new-feature.md` |
| R3 | **Wdrożona** — `.cursor/agents/ps-story-analyst.md` |
| R4 | **Wdrożona** — `.cursor/skills/ps-new-feature/SKILL.md` |
