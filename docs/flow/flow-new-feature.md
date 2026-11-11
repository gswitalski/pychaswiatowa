# Nowa funkcjonalność

Proces jest obsługiwany przez skille Cursora. Dla pojedynczej historyjki użyj:

```
/ps-new-feature PS-{N} [opis wymagania]
```

Orkiestrator odczytuje etap na podstawie istniejących artefaktów, więc polecenie
można powtórzyć po przerwie. Ścieżki i nazewnictwo są zdefiniowane w
`.cursor/skills/ps-feature-conventions/SKILL.md`.

## Aktualny przebieg

1. Analityk przeprowadza do trzech rund pytań przez `AskQuestion`. Każda runda
   wynika z poprzednich odpowiedzi, a proces kończy się, gdy nie ma otwartych
   kwestii. Następnie analityk zapisuje historyjkę.
2. Planer funkcjonalny przeprowadza do trzech rund pytań o luki w historyjce,
   poprawia ją (sekcja „Historia zmian”) i zapisuje plan API, UI i wdrożenia.
3. Planery implementacji API i widoków zadają jedną wspólną rundę pytań o nowe
   luki, po czym równolegle zapisują plany.
4. Implementer API dodaje funkcję, migracje, RPC, kontrakty i testy jednostkowe.
   Hook uruchamia `deno check`/`deno test` (oraz lint, testy i build przy zmianie
   kontraktów) i zapisuje artefakt `verification`. Niezależny reviewer może
   zażądać maksymalnie dwóch rund poprawek.
5. Implementer widoków działa po akceptacji API. Hook uruchamia lint, testy
   Vitest i build, po czym następuje review.
6. Updater zapisuje zwięzłą aktualizację `project-summary.md`.
7. Orkiestrator wykonuje retrospektywę (artefakt `retrospective`) i pyta, które
   propozycje zmian w procesie wdrożyć.

Proces obejmuje wyłącznie testy jednostkowe (Vitest, `deno test`), bez E2E.

Po każdym etapie orkiestrator pyta przez `AskQuestion`: `Kontynuuj`,
`Zatrzymaj się` albo `Inna` (własna instrukcja). Przed
implementacją API wykonuje preflight Deno/Supabase/Docker i sprawdza porty z
`supabase/config.toml`. Po implementacji wykonywany jest pełny check, test,
migracja lokalna i smoke test workera. Brak któregokolwiek z nich ma status
`WYMAGA_WERYFIKACJI`, nie `PASS`.

Review jest dzielony na `api-db`, `api-code`, `api-tests` i `views`. Po jednym
aborcie tego samego zakresu orkiestrator zmienia strategię; nie powtarza
wywołania w pętli. Każdy review zapisuje artefakt, a pominięcie zapisuje
`BEZ_REVIEW` z powodem. Nie uruchamia deployu ani testów E2E. Czynności ręczne z
`deployment-plan.md` są pokazywane na końcu; commit wykonuje użytkownik.

Aby zaplanować, zaimplementować i wdrożyć nową funkcjonalność, wybierz jedną z dwóch ścieżek:

- **Funkcjonalność złożona - epic** (oparta na więcej niż jednej historyjce użytkownika): wykonaj [analizę funkcjonalności](#analiza-funkcjonalności), a następnie [generowanie historyjek użytkownika](#user-stories).
- **Funkcjonalność prosta - user story** (jedna historyjka użytkownika): wykonaj [generowanie pojedynczej historyjki użytkownika](#pojedyncza-historyjka-użytkownika) i przejdź do [planu implementacji](#plan-implementacji).

# Zbiór historyjek - Epic

## Analiza

- Wykonaj prompt `043 Prompt - New features analysis`.
- Zrewiduj dokument za pomocą prompta `044 Prompt - New features analysis review` i **innego modelu**.
- W razie potrzeby skoryguj dokument, kontynuując konwersację z modelem.



## Generowanie user stories

- Wygeneruj historyjki użytkownika za pomocą prompta `045 Prompt - New features - user stories`.
- dla każdej historyjki przejdz do punku **Plan implementacji** i kontynuuj



# Pojedyncze User Story



## Generownie pojedynczej historyjki

- Wykonaj prompt `046 Prompt - New feature - user story`.
- Zrewiduj treść historyjki i w razie potrzeby ją popraw.
- Przejdź do punktu [Plan implementacji](#plan-implementacji).



## Plan implementacji

- Rozpisz wymagania dotyczące API, widoków i planu wdrożenia za pomocą prompta `047 Prompt - User story plan`.
- Wynikowe dokumenty wykorzystaj w kolejnych krokach.



## Implementacja API

- Wykorzystaj prompt `048 Prompt - API Implementation Plan`, aby stworzyć plan implementacji API.
- Zrewiduj plan i w razie potrzeby go skoryguj.
- Wykorzystaj prompt `015 Prompt - Endpoint Implementation` do zaimplementowania API.



## Implementacja widoków

- Wykorzystaj prompt `049 Prompt - View Implementation plan` do stworzenia planu implementacji widoku.
- Zrewiduj plan i w razie potrzeby go skoryguj.
- Wdróż implementację za pomocą prompta `020 Prompt - View Implementation`.



## Aktualizacja project summary

- Zaktualizuj `project-summary` za pomocą prompta `050 Prompt - Project summary update`.

