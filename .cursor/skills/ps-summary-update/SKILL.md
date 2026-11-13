---
name: ps-summary-update
description: Dopisuje wiersz PS-N do rejestru project-summary i odświeża referencję z kodu (wykonuje orkiestrator, bez subagenta).
disable-model-invocation: true
---
# Aktualizacja summary
Wykonuje orkiestrator po zakończeniu implementacji. Dokumentacja projektu jest
rozdzielona, więc aktualizacja jest mała i prawie w całości mechaniczna:

1. Uruchom `powershell -NoProfile -File .cursor/hooks/generate-reference.ps1`.
   Odświeża `docs/results/project-reference.md` (tabele, RPC, Edge Functions,
   trasy, guardy, migracje) z kodu. Nie edytuj tego pliku ręcznie.
2. Dopisz **jeden wiersz** na końcu tabeli „Historyjki” w
   `docs/results/project-summary.md`:
   `| PS-{N} | {krótka nazwa funkcji} | {status} | {braki weryfikacji} |`.
   Wiersz zaczyna się od `| PS-{N} |` (po nim rozpoznaje etap `feature-stage.ps1`).
   Nie dopisuj akapitów, opisów implementacji ani wyników testów.
3. Status: `zakończone` tylko wtedy, gdy migracje, Deno, smoke test, Vitest, lint
   i build mają `PASS` albo `NIE_DOTYCZY`. Jeśli jakikolwiek krok ma
   `NIE_WYKONANO` lub `WYMAGA_WERYFIKACJI`, status brzmi
   `zaimplementowane, niezweryfikowane`, a w ostatniej kolumnie wypisz braki
   (np. `smoke z kontami, Deno`). Fakty bierz z artefaktu `verification`
   i raportów implementerów, a z diffu tylko to, co sprawdziłeś (`git diff --stat`,
   `rg`); nie wnioskuj z braku pliku lub kodu.
4. Jeśli zmieniła się architektura (nowa Edge Function, nowa strona lub guard,
   zmiana ról albo limitów), zaktualizuj `docs/results/project-brief.md`.
   Zmiany produktowe w zakresie PRD wprowadzaj w `project-prd.md` tylko na
   polecenie użytkownika.
5. Review nie jest statusem weryfikacji; jeśli użytkownik przeprowadził je
   ręcznie, dopisz wynik w kolumnie braków jednym zdaniem.
