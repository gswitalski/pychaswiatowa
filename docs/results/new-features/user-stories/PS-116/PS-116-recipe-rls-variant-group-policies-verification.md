# PS-116 — weryfikacja API

Raport `ps-api-implementer`. Hook `subagentStop` dopisał niżej własny wynik (`deno check`, `deno test`).

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| Preflight Deno/Supabase/Docker | TAK | PASS | — |
| Migracja lokalna/RLS/RPC | TAK | PASS | Brak zmian RPC |
| Generowanie typów | TAK | PASS | Istniejący szeroki diff typów poza zakresem PS-116; plik typów nie wchodzi do tej zmiany |
| `deno check` / `deno test` | TAK | PASS | `deno lint` ujawnia wcześniejsze problemy repozytorium (`WYMAGA_WERYFIKACJI`) |
| Smoke test workera | TAK | PASS | Skrypt PowerShell nie działa w PS5 (`-SkipHttpErrorCheck`); ręcznie: `recipes=401`, `public=404`. Smoke z kontami: `WYMAGA_WERYFIKACJI` (brak kont w `.env.local`) |

Zmienione pliki API: `supabase/migrations/20261125200000_ps116_recipe_rls_variant_group_policies.sql`, `docs/scripts/enable_rls_for_production.sql`, `supabase/functions/recipes/recipes.service.ts`.

Widoki: `NIE_DOTYCZY` (`viewSkipped`). Vitest, `ng lint` i `ng build` nie były uruchamiane.

## 2026-11-26 00:10 ps-api-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check recipes | PASS |
| deno test | PASS |
