
## 2026-11-20 ps-api-implementer + orkiestrator (etap API)

Pierwsze przebiegi implementera wykazały luki, domknięte po weryfikacji orkiestratora:
regeneracja `database.types.ts` psuła `deno check` `payments-webhook` (przywrócono oryginały,
zmiany naniesiono ręcznie, addytywnie), brakowało testów wariantów i realnej kopii zdjęcia.

| Weryfikacja | Wynik | Uwagi |
|---|---|---|
| Preflight (Deno 2.9.8, Supabase CLI 2.121.0, Docker, brak dryfu migracji) | PASS | |
| Migracja lokalna `20261120210000_recipe_variants_owner_management.sql` (reset/RPC/ACL) | PASS | `has_function_privilege` dla anon/authenticated = brak; test mutacyjny ACL PASS |
| Zapytania SQL: limit ≤10, jeden domyślny, kolejność, unikalność nazw | PASS | |
| `deno check` recipes, me, payments-webhook, admin | PASS | `explore` ma znany dług sprzed PS-108 (nie sprawdzano) |
| `deno test --allow-all supabase/functions` | PASS | 208 zaliczonych, 0 błędów, 2 ignorowane; w tym 34 testy PS-109 |
| `deno lint` | FAIL (istniejące) | 14 problemów w `recipes.service.ts`/handlerach/testach sprzed PS-109; nowe pliki bez błędów |
| Smoke test workera z kontami | WYMAGA_WERYFIKACJI | brak kont w `.env.local`, brak konfiguracji Storage |

Pokrycie GWT testami jednostkowymi: 1–2, 20 oraz częściowo 5–6, 12–13, 19, 21.
Niepokryte automatycznie: 3–4, 7–18 (scenariusze integracyjne na realnej bazie), test
współbieżnego dodawania wariantów — do ręcznej weryfikacji (zob. „Czynności ręczne” planu API).

Nadal otwarte: RLS na `recipes` i `security_invoker` na `recipe_details` (poza zakresem);
tryb flagi `all` nie powinien być włączany przed ich domknięciem.

## 2026-11-20 21:50 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check me | PASS |
| deno check recipes | PASS |
| deno test | PASS |
| npm run lint | PASS |
| npm run test:run | PASS |
| npm run build | PASS |

## 2026-11-20 ps-view-implementer + orkiestrator (etap widoków)

| Weryfikacja | Wynik | Uwagi |
|---|---|---|
| `npm run lint` | PASS | |
| `npm run test:run` (Vitest) | PASS | 73 pliki, 439 testów (potwierdzone przez orkiestratora) |
| `npm run build` | PASS | |
| Ręczna weryfikacja UX/mobile/dostępność | NIE_WYKONANO | zob. „Czynności ręczne” planu widoków |

Pokryte GWT: 1–2, 12–13, 22–24 oraz wyścig spóźnionych odpowiedzi (test mutacyjnie zweryfikowany).
Odstępstwa: dialogi wariantów zrealizowano przez `prompt`/`confirm` zamiast dialogów Material;
brak testów interakcji dialogów, osobnych testów wszystkich operacji serwisu, ostrzeżenia Storage i obsługi użycia.

## 2026-11-20 21:59 orkiestrator (Czynności ręczne, krok 1 planu API)

Po `supabase db reset` (3 migracje + seedy zastosowane): 50 grup, 50 aktywnych przepisów.

| Kontrola | Wynik |
|---|---|
| Aktywne warianty w grupie 1–10 | PASS (0 naruszeń) |
| Dokładnie jeden domyślny | PASS (0 naruszeń) |
| Kolejność `0..n-1` | PASS (0 naruszeń) |
| Brak konfliktu nazw (bez wielkości liter) | PASS (0 naruszeń) |
| `has_function_privilege`: 9 nowych RPC + `create_recipe_with_tags`, `update_recipe_with_tags`, `soft_delete_recipe` (obie sygnatury) | PASS (anon=false, authenticated=false, service_role=true) |
| `feature_flags.recipe_variants` po migracji | PASS (`disabled`) |

Ograniczenie: dane seedowe to same grupy jednowariantowe, więc kontrole 1–4 są po części trywialne;
sensowne sprawdzenie wielowariantowe następuje w kroku 2 (po utworzeniu wariantów).

## 2026-11-20 22:10 orkiestrator (błąd 500 INTERNAL_ERROR na endpointach wariantów)

Przyczyna: `getVariantContext` przekazywał do serwisu klienta zalogowanego użytkownika (rola `authenticated`),
a RPC wariantów mają `EXECUTE` tylko dla `service_role` → `42501 permission denied`, mapowane na `INTERNAL_ERROR`.
Poprawka: `getVariantContext` zwraca `createServiceRoleClient()` (`user_id` nadal z JWT); `mapRpcError` loguje kod i komunikat nieznanych błędów.
Weryfikacja: `GET /recipes/1/variants` i `GET /recipes/1/usage` jako `simple@` (flaga `all`) → 200; `deno test` 208 PASS.
Luka testowa: testy handlerów nie wykryły błędu (nie sprawdzają, jakiego klienta dostaje serwis) — `WYMAGA_WERYFIKACJI`.

## 2026-11-21 15:53 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check explore | PASS |
| deno check recipes | PASS |
| deno test | PASS |
| npm run lint | PASS |
| npm run test:run | FAIL |
| npm run build | PASS |

Ostatnie linie wyjścia — npm run test:run:

```text
    226| 
    227|     it('nie wysyła żądania dla tej samej strony i rozmiaru', () => {
       |     ^
    228|         const fixture = createComponent();
    229|         fixture.componentInstance.query.set({
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯
 Test Files  1 failed | 76 passed (77)
      Tests  5 failed | 451 passed (456)
   Start at  15:50:56
   Duration  111.36s (transform 200.90s, setup 25.26s, import 471.81s, tests 166.26s, environment 50.10s)
```
