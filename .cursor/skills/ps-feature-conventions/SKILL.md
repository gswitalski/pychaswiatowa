---
name: ps-feature-conventions
description: Jedno źródło prawdy dla numeracji, slugów, ścieżek i etapów historyjek PychaŚwiatowa.
---
# Konwencje funkcjonalności

## Identyfikatory
- Historyjka ma identyfikator `PS-{N}` zgodny z numerem w Jirze.
- Slug jest angielski, `kebab-case`, ma około pięciu słów i jest ustalany raz.
- Epic używa angielskiego sluga obszaru, np. `premium-users`.

## Ścieżki
`PS-{N}-{slug}` oznacza:
- `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-user-story.md`
- ten sam prefiks z sufiksami `api-plan`, `ui-plan`, `deployment-plan`
- `docs/results/impl-plans/endpoints/PS-{N}-{slug}-api-implementation-plan.md`
- `docs/results/impl-plans/views/PS-{N}-{slug}-view-implementation-plan.md`
- review API: `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-review-api-r{R}.md`
- review widoków: `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-review-views-r{R}.md`
- weryfikacja z hooka: `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-verification.md`
- retrospektywa: `docs/results/new-features/user-stories/PS-{N}/PS-{N}-{slug}-retrospective.md`

Epiki: `docs/results/new-features/epics/{obszar}/{obszar}-{analysis|analysis-review|user-stories}.md`.
Kontrakty są w `shared/contracts/types.ts`, a podsumowanie w `docs/results/project-summary.md`.

## Etap
Brak artefaktów oznacza analizę; historyjka oznacza plany funkcjonalne; plany API/UI
oznaczają plany implementacji; oba plany implementacji oznaczają implementację API.
Po implementacji wymagany jest artefakt review API. Po jego akceptacji i akceptacji
implementacji powstaje review widoków. Brak review musi być zapisany jako
`BEZ_REVIEW` z powodem. Dopiero zaakceptowane review widoków oznacza etap summary.
Summary zaktualizowane o `PS-{N}` bez artefaktu retrospektywy oznacza etap
retrospektywy.

Status weryfikacji zapisuj jawnie: `PASS`, `FAIL`, `NIE_WYKONANO` albo
`WYMAGA_WERYFIKACJI`. `NIE_WYKONANO` nie jest równoważne z `PASS`.

## Testy
Proces obejmuje wyłącznie testy jednostkowe: Vitest dla Angulara i `deno test`
dla Edge Functions. Nie planuj, nie pisz i nie uruchamiaj testów E2E
(Playwright, `e2e/**`, `npm run test:e2e`, `npm run test:all`).

## Rundy pytań
Subagent w trybie `pytania` niczego nie zapisuje. Orkiestrator przekazuje mu
numer rundy `R` oraz pełną historię wcześniejszych pytań i odpowiedzi. Subagent
zwraca jeden z wyników:
- `STATUS: PYTANIA` — 3–7 pytań; każde z krótkim uzasadnieniem, czego dotyczy
  luka, opcjami odpowiedzi i oznaczoną rekomendacją,
- `STATUS: BRAK_PYTAŃ` — wymagania są jednoznaczne.

W obu przypadkach dołącza listy `Założenia` i `Otwarte kwestie`. Runda `R > 1`
musi wynikać z dotychczasowych odpowiedzi: doprecyzuj odpowiedzi „Inna”,
rozstrzygnij sprzeczności między odpowiedziami, dopytaj o konsekwencje podjętych
decyzji (przypadki brzegowe, uprawnienia, błędy, dane) i nie powtarzaj pytań już
rozstrzygniętych. Orkiestrator zadaje pytania jednej rundy w jednej sesji
`AskQuestion`. Limit rund podaje skill etapu; po jego wyczerpaniu pozostałe
otwarte kwestie trafiają jako założenia na bramkę akceptacji.

## Bramka akceptacji
Po każdym etapie wymagającym akceptacji orkiestrator pokazuje krótkie
podsumowanie (artefakty, statusy weryfikacji, zmiany w historyjce, przyjęte
założenia) i pyta przez `AskQuestion` z opcjami:
- `Kontynuuj` — przejdź do następnego etapu,
- `Zatrzymaj się` — zakończ turę; proces można wznowić tym samym poleceniem,
- `Inna` — użytkownik wpisuje własną instrukcję; wykonaj ją i ponów bramkę.

Bez odpowiedzi `Kontynuuj` nie przechodź do kolejnego etapu.

Planiści czytają sekcje 3–6 summary, implementerzy swoje plany i kod. Nie twórz
plików w `doc/**` ani z małymi literami `ps-`.
