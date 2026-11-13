# Nowa funkcjonalność

Proces jest obsługiwany przez skille Cursora. Dla pojedynczej historyjki użyj:

```
/ps-new-feature PS-{N} [opis wymagania]
```

Etap ustala skrypt `.cursor/hooks/feature-stage.ps1 -Id PS-{N}` na podstawie
artefaktów, więc polecenie można powtórzyć po przerwie. Ścieżki i nazewnictwo
są w `.cursor/skills/ps-feature-conventions/SKILL.md`.

## Przebieg

```text
1. Historyjka        ps-story-analyst   pytania: max 2 rundy        → bramka 1
2. Plany impl.       ps-impl-planner    plan API + plan widoków     → bramka 2
                                        (pytania tylko o blokery)
3. Implementacja API ps-api-implementer + hook (deno, migracje)
4. Widoki            ps-view-implementer + hook (lint, Vitest, build)
5. Summary           orkiestrator (bez subagenta)                   → bramka 3
```

1. **Historyjka.** Analityk zadaje najwyżej dwie rundy pytań przez `AskQuestion`
   (max 5 pytań na rundę, w zwartym formacie), potem zapisuje historyjkę z sekcją
   „Decyzje i założenia”. Luki, które nie wymagają decyzji, stają się założeniami
   z rekomendacją.
2. **Plany implementacji.** Jeden planer czyta historyjkę i `docs/results/project-brief.md`
   i zapisuje dwa dokumenty (API: `docs/results/impl-plans/endpoints/`, widoki:
   `docs/results/impl-plans/views/`). Jeśli znajdzie blokery, zwraca pytania
   (jedna runda) zamiast zapisu. Plan API zawiera sekcję „Czynności ręczne”
   (sekrety, usługi zewnętrzne, migracje produkcyjne) pokazywaną na końcu.
   Warstwa bez zmian dostaje plik „Nie dotyczy: powód”.
3. **Implementacja API.** Preflight `.cursor/hooks/preflight.ps1 -Stage api -Migrations`
   (Deno, Supabase CLI, Docker, porty, dryf migracji, konta testowe). Hook po
   implementerze uruchamia `deno check`/`deno test` (przy zmianie kontraktów też
   szybki typecheck frontendu) i zapisuje artefakt `verification`. Gdy wynik nie
   blokuje, proces przechodzi do widoków bez bramki.
4. **Implementacja widoków.** Hook uruchamia lint, Vitest i build.
5. **Summary.** Orkiestrator uruchamia `.cursor/hooks/generate-reference.ps1`
   (odświeża `project-reference.md` z kodu) i dopisuje jeden wiersz do tabeli
   w `project-summary.md` (status i braki weryfikacji). `project-brief.md`
   zmienia tylko przy zmianie architektury. Potem bramka końcowa z listą
   czynności ręcznych.

Dokumentacja projektu (`docs/results/`): `project-summary.md` (rejestr),
`project-brief.md` (skrót dla planerów), `project-reference.md` (generowany),
`project-prd.md` (PRD, stabilny).

Proces obejmuje wyłącznie testy jednostkowe (Vitest, `deno test`), bez E2E.
Bramki: `Kontynuuj`, `Zatrzymaj się`, `Inna`. Awarie narzędzi nie są bramką: dostają
status `FAIL`/`WYMAGA_WERYFIKACJI`. Jedyne pytania poza analizą dotyczą bezpieczeństwa
danych (dryf migracji lokalnych, `supabase db reset`). Brak Deno lokalnie: uruchom
workflow CI `validate-backend` albo zapisz `WYMAGA_WERYFIKACJI`.

## Poza procesem (tylko na żądanie)

- **Review kodu:** subagent `ps-code-reviewer` (zakresy `api-db`, `api-code`,
  `api-tests`, `views`). Orkiestrator go nie uruchamia.
- **Review analizy epiku:** `ps-analysis-reviewer`.
- **Retrospektywa:** `/ps-retrospective PS-{N}`.
- Nie ma wdrożeń zdalnych; commit wykonuje użytkownik.

## Epic (funkcjonalność złożona)

`/ps-new-epic {obszar}`: analiza (max 2 rundy pytań), bramka, historyjki
`PS-{N}` (max 2 rundy pytań), bramka. Każdą historyjkę realizuje się później przez
`/ps-new-feature PS-{N}`.
