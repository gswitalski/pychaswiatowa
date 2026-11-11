---
name: ps-implement-api
description: Implementuje API, migracje, RPC, kontrakty i testy dla PS-N.
disable-model-invocation: true
---
# Implementacja API
Przed edycją wykonaj preflight:

```powershell
deno --version
supabase --version
docker version
```

Sprawdź `supabase/config.toml`; w tym projekcie API działa na `54331`, baza na
`54332`, Studio na `54333`, a Mailpit na `54334`. Jeśli narzędzie lub Docker
jest niedostępne, zatrzymaj implementację i zgłoś `WYMAGA_WERYFIKACJI` przed
zmianami albo uzyskaj zgodę na pracę statyczną.

Przed migracją lokalną i smoke testem:
1. Uruchom `supabase migration list` i sprawdź wersje lokalne spoza repo
   (`MigrationMissingLocalError`). Przy dryfie zatrzymaj się i zapytaj
   użytkownika; nie usuwaj obiektów spoza repo w migracji.
2. Przed `supabase db reset` wykonaj `supabase db dump --local --data-only`
   do pliku poza repo i podaj użytkownikowi ścieżkę oraz sposób przywrócenia.
3. Sprawdź, czy `.env.local` zawiera konta admina i zwykłego użytkownika do smoke
   testu; jeśli nie, zgłoś to od razu (smoke test ma wtedy `WYMAGA_WERYFIKACJI`).

Wykonaj zaakceptowany plan implementacji API. Zmieniaj tylko backend, migracje,
`shared/contracts/types.ts` i testy jednostkowe backendu; nie twórz testów E2E.
Po zakończeniu hook `subagentStop` uruchamia `deno check`/`deno test`, a przy
zmianie kontraktów także lint, testy Vitest i build frontendu. Po każdej rundzie poprawek
przeczytaj pełny diff, a nie tylko wskazane linie. Dla planu przejdź checklistę
punkt po punkcie, w tym `return` w ścieżkach RPC, RLS, migracje, kontrakty,
testy i wszystkie scenariusze historyjki.

Weryfikacja wymagana przed statusem `PASS`:
1. `supabase db reset` lub równoważne zastosowanie migracji lokalnie.
2. `supabase gen types typescript --local` i kontrola diffu typów.
3. `deno check` oraz `deno test` dla każdej zmienionej funkcji.
4. `supabase functions serve {funkcja}` i żądanie dymne do każdej zmienionej
   funkcji. Odpowiedź `401`/`4xx` z kodu funkcji jest poprawna; `500`,
   `InvalidWorkerResponse` lub brak odpowiedzi oznacza `FAIL`.
5. Test skryptu SQL/RLS na co najmniej dwóch kontach, gdy plan go wymaga.
6. Dla każdej nowej lub przebudowanej funkcji RPC `security definer`:
   `revoke all … from public, anon, authenticated`, jawny `grant` dla ról, które
   jej potrzebują (zwykle `service_role`), samosprawdzenie `has_function_privilege`
   w migracji oraz test uprawnień dla `anon` i `authenticated`. Przy przebudowie
   funkcji powtórz `revoke`/`grant`.

Smoke test można wykonać skryptem:

```powershell
.cursor/hooks/smoke-functions.ps1 -Function recipes,public
```

Nie wdrażaj zdalnie. Gdy krok jest niemożliwy, raportuj osobno:
`Uruchomiono?`, `Wynik`, `Co nie jest pokryte`; nie opisuj pracy statycznej jako
pełnej weryfikacji.
