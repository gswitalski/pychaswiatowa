---
name: ps-implement-api
description: Implementuje API, migracje, RPC, kontrakty i testy dla PS-N.
disable-model-invocation: true
---
# Implementacja API
Wykonaj plan API z `docs/results/impl-plans/endpoints/`. Historyjkę czytaj tylko
we fragmentach wskazanych przez plan (numery scenariuszy GWT). Zmieniaj tylko
backend, migracje, `shared/contracts/types.ts`, typy bazy i testy jednostkowe
backendu; nie twórz testów E2E. Nie wdrażaj zdalnie.

## Przed edycją
Orkiestrator uruchamia `.cursor/hooks/preflight.ps1 -Stage api -Migrations`. Gdy
uruchamiasz etap samodzielnie, zrób to sam. Porty lokalne: API `54331`, baza
`54332`, Studio `54333`, Mailpit `54334`. Brak narzędzia lub Dockera: zatrzymaj
się i zgłoś `WYMAGA_WERYFIKACJI`. Dryf migracji (wersje w bazie spoza repo):
zatrzymaj się i zapytaj; nie usuwaj obiektów spoza repo w migracji. Przed
`supabase db reset` wykonaj `supabase db dump --local --data-only` do pliku poza
repo i podaj ścieżkę oraz sposób przywrócenia (hook zapyta o `db reset`).

## Weryfikacja wymagana przed `PASS`
1. `supabase db reset` lub równoważne zastosowanie migracji lokalnie.
2. `supabase gen types typescript --local` i kontrola, że diff typów zawiera
   tylko oczekiwane zmiany.
3. `deno check` i `deno test` dla każdej zmienionej funkcji.
4. Smoke test workera każdej zmienionej funkcji: odpowiedź `401`/`4xx` z kodu
   funkcji jest poprawna; `500`, `InvalidWorkerResponse` lub brak odpowiedzi to `FAIL`.
   Skrypt: `.cursor/hooks/smoke-functions.ps1 -Function recipes,public`.
5. Test SQL/RLS na co najmniej dwóch kontach, gdy plan go wymaga.
6. Dla nowej lub przebudowanej funkcji RPC `security definer`: `revoke all … from
   public, anon, authenticated`, jawny `grant` dla potrzebnych ról (zwykle
   `service_role`), samosprawdzenie `has_function_privilege` w migracji i test
   uprawnień dla `anon` i `authenticated`. Przy przebudowie funkcji powtórz
   `revoke`/`grant`.

Po zakończeniu hook `subagentStop` uruchamia `deno check`/`deno test`, a przy
zmianie kontraktów szybki typecheck frontendu. Po każdej rundzie poprawek
przeczytaj pełny diff, nie tylko poprawione linie. Gdy krok jest niemożliwy,
raportuj `NIE_WYKONANO` lub `WYMAGA_WERYFIKACJI` z powodem; nie opisuj pracy
statycznej jako pełnej weryfikacji.
