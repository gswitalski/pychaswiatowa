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

Epiki: `docs/results/new-features/epics/{obszar}/{obszar}-{analysis|analysis-review|user-stories}.md`.
Kontrakty są w `shared/contracts/types.ts`, a podsumowanie w `docs/results/project-summary.md`.

## Etap
Brak artefaktów oznacza analizę; historyjka oznacza plany funkcjonalne; plany API/UI
oznaczają plany implementacji; oba plany implementacji oznaczają implementację API.
Po implementacji wymagany jest artefakt review API. Po jego akceptacji i akceptacji
implementacji powstaje review widoków. Brak review musi być zapisany jako
`BEZ_REVIEW` z powodem. Dopiero zaakceptowane review widoków oznacza etap summary.

Status weryfikacji zapisuj jawnie: `PASS`, `FAIL`, `NIE_WYKONANO` albo
`WYMAGA_WERYFIKACJI`. `NIE_WYKONANO` nie jest równoważne z `PASS`.

Planiści czytają sekcje 3–6 summary, implementerzy swoje plany i kod. Nie twórz
plików w `doc/**` ani z małymi literami `ps-`.
