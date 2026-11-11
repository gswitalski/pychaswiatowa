---
name: ps-new-feature
description: Orkiestruje pełny proces historyjki PS-N i wznawia go na podstawie istniejących artefaktów.
disable-model-invocation: true
---
# Nowa funkcjonalność

Wywołanie: `/ps-new-feature PS-{N} [opis]`.

## Zasady
1. Przeczytaj `ps-feature-conventions`, ustal etap i wykonaj preflight środowiska.
   Dla etapu API sprawdź Deno, Supabase CLI, Docker i porty z `supabase/config.toml`.
   Brak narzędzia oznacza `WYMAGA_WERYFIKACJI` przed implementacją.
2. Uruchamiaj subagentów w świeżym kontekście, przekazując tylko ID, tryb, rundę
   i pełną historię pytań oraz odpowiedzi użytkownika.
3. Pytania subagentów zadawaj według sekcji „Rundy pytań” z konwencji, bez
   skracania ich kontekstu i opisów opcji do haseł, a po
   każdym etapie zatrzymuj się na „Bramce akceptacji”. Awarie narzędzi nie są
   osobną bramką: zastosuj procedurę awaryjną i pytaj dopiero po jej wyczerpaniu.
4. Proces obejmuje wyłącznie testy jednostkowe; nie zlecaj ani nie uruchamiaj E2E.

## Etapy
1. **Historyjka.** Rundy `pytania` z `ps-story-analyst` (najwyżej 3, do
   `STATUS: BRAK_PYTAŃ`), potem tryb `zapis`. Bramka.
2. **Plan funkcjonalny.** Rundy `pytania` z `ps-feature-planner` (najwyżej 3),
   potem `zapis`: poprawki historyjki z wpisem do „Historii zmian” i trzy plany.
   Uruchom kontrolę spójności historyjka ↔ API ↔ UI; nie twórz planów
   implementacji, dopóki sprzeczności nie zostaną rozwiązane. Na bramce pokaż
   zmiany naniesione na historyjkę.
3. **Plany implementacji.** Uruchom równolegle oba planery w trybie `pytania`
   (jedna runda, tylko nowe luki) i zadaj ich pytania w jednej sesji. Poprawki
   historyjki wynikające z odpowiedzi nanieś sam, z wpisem do „Historii zmian”,
   a następnie uruchom oba planery w trybie `zapis`. Bramka.
4. **Implementacja API.** Hook `subagentStop` uruchamia weryfikację i dopisuje
   wynik do artefaktu `verification`; jeśli wpisu brakuje, uzupełnij go
   z raportu implementera. Następnie review `api-db`, `api-code`, `api-tests`.
   Bramka.
5. **Implementacja widoków** dopiero po akceptacji API i kontraktów; hook
   (lint, testy Vitest, build), review `views`. Bramka.
6. **Summary.** Updater działa dopiero po akceptacji implementacji i review albo
   jawnej decyzji użytkownika. W summary umieść statusy review, Deno, migracji
   i smoke testu; nie wyciągaj wniosków z samego braku kodu. Bramka.
7. **Retrospektywa.** Wykonaj ją sam według `ps-retrospective` i zapytaj, które
   propozycje wdrożyć.
8. Na końcu pokaż checklistę planu wdrożenia i statusy weryfikacji. Nie wdrażaj
   zdalnie; commit wykonuje użytkownik.

## Review i poprawki
- Review uruchamiaj z listą plików z diffu. Przy `Subagent was aborted` wykonaj
  najwyżej jedną powtórkę na **tym samym** zakresie plików; po drugim aborcie
  **zmniejsz zakres** (np. jeden plik lub tylko `api-code` bez `api-tests`) i
  ewentualnie zmień model; trzecia próba pełnego diffu — tylko po jawnej decyzji
  użytkownika na bramce. Dalej: review w głównym czacie lub artefakt
  `BEZ_REVIEW` z `WYMAGA_WERYFIKACJI`.
- Każdy review zapisz jako artefakt. Gdy review jest niemożliwe, zapisz
  `BEZ_REVIEW` z powodem i `WYMAGA_WERYFIKACJI`; nie oznaczaj funkcji jako gotowej.
- Po poprawkach implementer wykonuje pełną weryfikację i czyta cały diff.
  Maksymalnie dwie rundy poprawek na zakres.
