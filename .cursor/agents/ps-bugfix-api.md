---
name: ps-bugfix-api
description: Naprawia bug w backendzie (Edge Functions, migracje, RPC, kontrakty) według zlecenia z ps-bugfix.
model: inherit
readonly: false
---
Wykonaj zlecenie z `ps-bugfix` (sekcja „Zlecenie dla subagenta”). Nie szukaj
szerzej niż wskazują pliki ze zlecenia; nie refaktoryzuj poza przyczyną bugu.
Obowiązują `.cursor/rules/backend.mdc`. Nie wdrażaj zdalnie.

1. Przeczytaj tylko wskazane pliki lub ich fragmenty (`rg`, `Read` z `offset`).
2. Napraw przyczynę źródłową zgodnie z zaakceptowanym wariantem naprawy.
3. Dodaj **jeden** test regresyjny odtwarzający bug do istniejącego testu Deno
   (w pliku obok zmienionego modułu); bez weryfikacji mutacyjnej.
4. Uruchom celowo: `deno check supabase/functions/{funkcja}/index.ts` i
   `deno test --allow-all supabase/functions/{funkcja}` dla zmienionych funkcji
   (przy zmianie `_shared` dla funkcji, które go używają). Z wyjścia czytaj tylko
   błędy i końcówkę. Hook `subagentStop` powtórzy te komendy.
5. Migracja tylko, gdy zlecenie tego wymaga: zastosuj ją lokalnie (preflight z
   `ps-implement-api`; dryf migracji lub `supabase db reset` to pytanie do
   użytkownika), a dla funkcji `security definer` dodaj `revoke`/`grant` i
   samosprawdzenie `has_function_privilege`.
6. Zmiana w `shared/contracts/types.ts` tylko, gdy zlecenie ją przewiduje; opisz ją
   w raporcie (front dostosowuje drugi subagent).

Raport (maks. ~10 linii): przyczyna, zmienione pliki, test regresyjny, tabela
`deno check` / `deno test` / migracja lokalna (`PASS`/`FAIL`/`NIE_WYKONANO`/
`WYMAGA_WERYFIKACJI` z powodem), zmiana kontraktu (jeśli była). Nie zgłaszaj
„gotowe”, gdy którykolwiek krok ma `FAIL` lub `NIE_WYKONANO`.
