# PS-112 — weryfikacja API

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| Preflight Deno/Supabase/Docker | TAK | PASS | — |
| Migracja lokalna/RLS/RPC | TAK | PASS | Ręczne GWT na wielu kontach nie zostały wykonane |
| Generowanie typów | TAK | PASS | Wynik wygenerowano do pliku tymczasowego; repozytoryjne typy pozostały addytywne |
| `deno check` / `deno test` | TAK | PASS | `228 passed`, `0 failed`, `2 ignored`; testy lokalnych RPC są ignorowane bez warunku dostępności |
| Smoke test workera | NIE | WYMAGA_WERYFIKACJI | Brak kont testowych/uruchomionego workera z tokenem użytkownika |

## Zmienione pliki

- `shared/contracts/types.ts`
- `shared/types/database.types.ts`
- `supabase/functions/_shared/database.types.ts`
- `supabase/functions/_shared/recipe-variant-detail.ts`
- `supabase/functions/admin/README.md`
- `supabase/functions/admin/admin-recipes.service.test.ts`
- `supabase/functions/admin/admin-recipes.service.ts`
- `supabase/functions/admin/admin-recipes.types.ts`
- `supabase/functions/admin/admin.service.ts`
- `supabase/functions/admin/admin.types.ts`
- `supabase/functions/explore/explore.service.ts`
- `supabase/functions/plan/plan.service.test.ts`
- `supabase/functions/plan/plan.service.ts`
- `supabase/functions/plan/plan.types.ts`
- `supabase/functions/shopping-list/shopping-list.service.ts`
- `supabase/migrations/20261123210000_ps112_recipe_variant_actions_integrations.sql`
- `docs/results/impl-plans/endpoints/PS-112-recipe-variant-user-actions-integrations-api-implementation-plan.md`
- `docs/results/impl-plans/views/PS-112-recipe-variant-user-actions-integrations-view-implementation-plan.md`

## Migracje

- `supabase/migrations/20261123210000_ps112_recipe_variant_actions_integrations.sql`

Migracja została zastosowana przez `supabase db reset --local`. Sprawdzono sygnatury
obu RPC admina, wynik `active_variant_count`/`variants_count` oraz ACL:
`anon` i `authenticated` nie mają `execute`, a `service_role` ma `execute`.

## Odstępstwa i punkty wymagające weryfikacji

- **POMINIĘTE — powód:** pełne GWT 1–23 na rzeczywistych danych, w tym akcje
  kolekcji/ulubionych/notatek/ocen per `recipe_id`, czyszczenie wpisów innych
  użytkowników, limit przy wyłączonej fladze oraz test wyścigu — brak przygotowanych
  kont/tokenów i dedykowanych fixture'ów integracyjnych.
- **POMINIĘTE — powód:** smoke test workera — brak danych uwierzytelniających
  w `.env.local`.
- **WYMAGA_WERYFIKACJI:** `deno lint` nadal zgłasza istniejące reguły
  `no-import-prefix`/`require-await` w testach oraz plikach admina; `deno check`
  i testy przechodzą.
- **WYMAGA_WERYFIKACJI:** `shopping_list_items.active_variant_count` pozostaje
  migawką zapisywaną przy dodaniu pozycji; nie wykonano przebudowy odczytu na
  join/subquery.
- **WERYFIKACJA MUTACYJNA ACL:** tymczasowe nadanie `execute` roli `anon`
  pozwoliło wywołać RPC (1 wiersz), po czym grant został cofnięty. Końcowy stan
  potwierdzono: `anon=false`, `service_role=true`; `git diff` nie wykazuje zmiany
  zabezpieczenia w migracji.


## 2026-11-23 22:18 ps-api-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check admin | PASS |
| deno check explore | PASS |
| deno check plan | PASS |
| deno check shopping-list | PASS |
| deno test | PASS |
| tsc (typecheck frontendu) | PASS |

## 2026-11-23 22:39 ps-api-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check admin | PASS |
| deno check explore | PASS |
| deno check plan | PASS |
| deno check shopping-list | PASS |
| deno test | PASS |
| tsc (typecheck frontendu) | PASS |

## 2026-11-23 22:45 ps-view-implementer

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| `npm run lint` | TAK | PASS | — |
| `npm run test:run` | TAK | PASS | 80 plików, 466 testów |
| `npm run build` | TAK | PASS | Ostrzeżenia istniejącego budżetu SCSS, bez błędów |

### Widoki — odstępstwa i luki

- **POMINIĘTE — powód:** pełna mutacyjna weryfikacja testów wyścigu i zabezpieczeń
  `latestRequestId` nie została wykonana w tym przebiegu; istniejące testy wyścigu
  pozostają w repozytorium, ale nie usuwano tymczasowo zabezpieczenia.
- **WYMAGA_WERYFIKACJI:** ręczne scenariusze dostępności, mobile, gość/flaga
  wyłączona oraz zachowanie po usunięciu wariantu nie zostały wykonane bez lokalnego
  API i sesji użytkownika.

## 2026-11-23 22:47 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check admin | PASS |
| deno check explore | PASS |
| deno check plan | PASS |
| deno check shopping-list | PASS |
| deno test | PASS |
| npm run lint | PASS |
| npm run test:run | PASS |
| npm run build | PASS |
