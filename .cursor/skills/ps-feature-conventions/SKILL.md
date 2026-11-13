---
name: ps-feature-conventions
description: Jedno źródło prawdy dla numeracji, slugów, ścieżek i etapów historyjek PychaŚwiatowa.
---
# Konwencje funkcjonalności

## Identyfikatory i ścieżki
- Historyjka ma ID `PS-{N}` zgodne z Jirą; slug jest angielski, `kebab-case`,
  ok. pięciu słów, ustalany raz. Epic ma slug obszaru (np. `premium-users`).
- `PS-{N}-{slug}` oznacza:
  - historyjka: `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-user-story.md`
  - plan API: `docs/results/impl-plans/endpoints/PS-{N}-{slug}-api-implementation-plan.md`
  - plan widoków: `docs/results/impl-plans/views/PS-{N}-{slug}-view-implementation-plan.md`
  - weryfikacja z hooka: `…/user-stories/PS-{N}/PS-{N}-{slug}-verification.md`
  - retrospektywa (tylko na żądanie): `…/PS-{N}-{slug}-retrospective.md`
  - review (tylko ręczne): `…/PS-{N}-{slug}-review-{api|views}-r{R}.md`
- Epiki: `docs/results/new-features/epics/{obszar}/{obszar}-{analysis|analysis-review|user-stories}.md`.
- Kontrakty: `shared/contracts/types.ts`.
- Dokumentacja projektu (`docs/results/`): `project-summary.md` (rejestr, jeden wiersz
  na historyjkę), `project-brief.md` (skrót dla planerów), `project-reference.md`
  (generowany z kodu przez `.cursor/hooks/generate-reference.ps1`, nie edytuj ręcznie),
  `project-prd.md` (PRD, stabilny).

## Etap
Etap ustala skrypt `.cursor/hooks/feature-stage.ps1 -Id PS-{N}` (analiza →
plany → implementacja-api → implementacja-widokow → summary → zakonczone).
Nie ustalaj etapu ręcznym przeglądem plików.

## Statusy i testy
- Status weryfikacji: `PASS`, `FAIL`, `NIE_WYKONANO`, `WYMAGA_WERYFIKACJI`.
  `NIE_WYKONANO` nie jest równoważne z `PASS`.
- Tylko testy jednostkowe: Vitest (Angular) i `deno test` (Edge Functions).
  Nie planuj, nie pisz i nie uruchamiaj E2E (Playwright, `e2e/**`).

## Pytania do użytkownika
Pytania zadajesz tylko w analizie wymagań (max 2 rundy) i opcjonalnie raz przed
planami implementacji (tylko blokery). Subagent w trybie `pytania` niczego nie
zapisuje i zwraca `STATUS: PYTANIA` (2–5 pytań) albo `STATUS: BRAK_PYTAŃ`,
a do tego listy `Założenia` i `Otwarte kwestie`. Przed pytaniem sprawdź w kodzie,
migracjach i RLS fakty, na których opierają się opcje; równoważne opcje połącz.

Pytaj tylko o to, czego nie rozstrzyga kod ani opis i co zmienia wynik. Resztę
rozstrzygnij wariantem rekomendowanym i zapisz jako „Założenie”. Pytanie musi być
zrozumiałe bez otwierania plików:
1. **Tytuł** — jedno zdanie w języku funkcjonalności.
2. **Kontekst** — 1–3 zdania: jak system działa dziś i czego brakuje.
3. **Opcje** — 2–3, każda jednym zdaniem ze skutkiem widocznym dla
   użytkownika/zespołu i jej ceną; bez skrótów z artefaktów (`API-1`, `G4`).
4. **Rekomendacja** — jedna opcja i powód w jednym zdaniu.

Runda 2 wynika wyłącznie z odpowiedzi z rundy 1 (sprzeczności, odpowiedzi
„Inna”, skutki decyzji) i nie powtarza pytań rozstrzygniętych. Orkiestrator zadaje
pytania rundy jedną sesją `AskQuestion`, przekazując treść subagenta bez
skracania sensu. Po limicie rund pozostałe kwestie stają się założeniami.

## Bramki akceptacji
Są trzy: po historyjce, po planach implementacji i na końcu (po API, widokach i
summary). Orkiestrator pokazuje krótkie podsumowanie (artefakty, statusy,
założenia) i pyta przez `AskQuestion`: `Kontynuuj`, `Zatrzymaj się` (proces
wznawia to samo polecenie) albo `Inna` (własna instrukcja; wykonaj i ponów bramkę).
Awarie narzędzi nie są bramką: zastosuj procedurę awaryjną i zapisz status.

## Limity rozmiaru
Historyjka ≤ ~15 KB, każdy plan implementacji ≤ ~10 KB. Plany odwołują się do
scenariuszy GWT po numerze, nie przepisują historyjki, a SQL/RLS cytują dosłownie
tylko tam, gdzie błąd byłby kosztowny.

Nie twórz plików w `doc/**` ani z małymi literami `ps-`.
