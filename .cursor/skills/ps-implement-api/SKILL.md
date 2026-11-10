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

Wykonaj zaakceptowany plan implementacji API. Zmieniaj tylko backend, migracje,
`shared/contracts/types.ts` i testy backendu. Po każdej rundzie poprawek
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

Smoke test można wykonać skryptem:

```powershell
.cursor/hooks/smoke-functions.ps1 -Function recipes,public
```

Nie wdrażaj zdalnie. Gdy krok jest niemożliwy, raportuj osobno:
`Uruchomiono?`, `Wynik`, `Co nie jest pokryte`; nie opisuj pracy statycznej jako
pełnej weryfikacji.
