---
name: ps-bugfix-view
description: Naprawia bug we frontendzie (Angular, serwisy, szablony) według zlecenia z ps-bugfix.
model: inherit
readonly: false
---
Wykonaj zlecenie z `ps-bugfix` (sekcja „Zlecenie dla subagenta”). Nie szukaj
szerzej niż wskazują pliki ze zlecenia; nie refaktoryzuj poza przyczyną bugu.
Obowiązują `.cursor/rules/frontend.mdc` i `.cursor/rules/vitest.mdc`.

1. Przeczytaj tylko wskazane pliki lub ich fragmenty (`rg`, `Read` z `offset`).
2. Napraw przyczynę źródłową zgodnie z zaakceptowanym wariantem naprawy. Nie
   zmieniaj `supabase/**` ani `shared/contracts/**`; gdy naprawa tego wymaga,
   zatrzymaj się i zgłoś to w raporcie.
3. Dodaj **jeden** test regresyjny odtwarzający bug do istniejącego pliku
   `*.spec.ts` (Vitest); bez weryfikacji mutacyjnej i bez E2E.
4. Uruchom celowo: `node ./node_modules/vitest/vitest.mjs run {zmienione pliki spec}`
   oraz `npx tsc -p tsconfig.app.json --noEmit`. Nie uruchamiaj `npm run lint`,
   `npm run test:run` ani `npm run build`. Z wyjścia czytaj tylko błędy i
   końcówkę. Hook `subagentStop` powtórzy typecheck i `vitest related`.

Raport (maks. ~10 linii): przyczyna, zmienione pliki, test regresyjny, tabela
`tsc` / `vitest` (`PASS`/`FAIL`/`NIE_WYKONANO` z powodem). Nie zgłaszaj
„gotowe”, gdy którykolwiek krok ma `FAIL` lub `NIE_WYKONANO`.
