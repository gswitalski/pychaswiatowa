# PS-111 — weryfikacja API

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| Preflight Deno/Supabase/Docker | NIE (wynik preflightu wejściowego) | PASS | Powtórzenie preflightu nie było potrzebne |
| Migracja lokalna/RLS/RPC | TAK | PASS | Migracja zastosowana lokalnie; ACL i smoke RPC PASS |
| Generowanie typów | TAK | PASS | Wygenerowano typy lokalne |
| `deno check` / `deno test` | TAK | PASS | Zmienione usługi przechodzą check; 38 testów Deno PASS |
| Smoke test workera | NIE | WYMAGA_WERYFIKACJI | Brak kont testowych w `.env.local` |

## Zmienione pliki

- `shared/contracts/types.ts`
- `shared/types/database.types.ts`
- `supabase/functions/_shared/database.types.ts`
- `supabase/functions/_shared/recipe-list-grouping.ts`
- `supabase/functions/_shared/recipe-list-grouping.test.ts`
- `supabase/functions/public/public.service.test.ts`
- `supabase/functions/collections/collections.service.test.ts`
- `supabase/functions/search/search.service.test.ts`
- `supabase/functions/public/public.service.ts`
- `supabase/functions/public/public.handlers.ts`
- `supabase/functions/recipes/recipes.service.ts`
- `supabase/functions/recipes/recipes.handlers.ts`
- `supabase/functions/collections/collections.service.ts`
- `supabase/functions/collections/collections.handlers.ts`
- `supabase/functions/collections/collections.types.ts`
- `supabase/functions/search/search.service.ts`
- `supabase/functions/search/search.handlers.ts`
- `supabase/functions/search/search.types.ts`

## Migracje

- `supabase/migrations/20261121180000_ps111_grouped_recipes_list.sql`

## Odstępstwa i punkty wymagające weryfikacji

- **POMINIĘTE — powód:** pełny test ręczny GWT z kontami — brak `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` w `.env.local`.
- **WYMAGA_WERYFIKACJI:** `supabase db lint --local` raportuje istniejące `AUTHZ1` w `enqueue_normalized_ingredients_refresh`, poza zakresem PS-111.

## 2026-11-21 17:59 ps-api-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check collections | PASS |
| deno check public | PASS |
| deno check recipes | PASS |
| deno check search | PASS |
| deno test | PASS |
| tsc (typecheck frontendu) | PASS |

## 2026-11-21 ps-api-implementer + orkiestrator (etap API)

Pierwszy przebieg implementera był niepełny (tylko algorytm i wyszukiwarka); drugi podłączył Explore, feed,
"Moje przepisy", kolekcje i sidebar. Wyniki `deno check` i `deno test` powtórzone przez orkiestratora.

| Weryfikacja | Wynik | Uwagi |
|---|---|---|
| Preflight (Deno 2.9.8, Supabase CLI 2.121.0, Docker, brak dryfu migracji) | PASS | |
| Migracja lokalna `20261121180000_ps111_grouped_recipes_list.sql` | PASS | zastosowana bez `db reset`; `revoke` public/anon/authenticated, `grant` service_role, asercja uprawnień w migracji |
| `deno check` public, explore, recipes, collections, search | PASS | |
| `deno test --allow-all supabase/functions` | PASS | 227 zaliczonych, 0 błędów, 2 ignorowane |
| Typy bazy (`database.types.ts` x2) | PASS | zmiana addytywna (+6 linii na plik) |
| `supabase db lint --local` | WYMAGA_WERYFIKACJI | istniejący `AUTHZ1` w `enqueue_normalized_ingredients_refresh`, poza zakresem PS-111 |
| Smoke test workera z kontami | WYMAGA_WERYFIKACJI | brak kont w `.env.local` |

Niepokryte automatycznie: GWT na realnej bazie (N/K, kursor, kolekcje ponad limit) - do ręcznej weryfikacji
wg "Czynności ręczne" planu API.

## 2026-11-21 18:08 ps-view-implementer

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| `npm run lint` | TAK | PASS | — |
| `npm run test:run` | TAK | FAIL | Jedyna porażka: istniejący test `recipe-detail-view.component.spec.ts` oczekuje tekstu „Zapisujesz wariant: …”, którego szablon HEAD nie renderuje; wada PS-110, poza zakresem PS-111 |
| `npm run build` | TAK | PASS | Istniejące ostrzeżenia budżetu SCSS |

Zmienione pliki widoku:

- `src/app/layout/main-layout/components/sidebar/sidebar-collections-tree.component.ts`
- `src/app/layout/main-layout/components/sidebar/sidebar-collections-tree.component.html`
- `src/app/layout/main-layout/components/sidebar/sidebar-collections-tree.component.spec.ts`

Sidebar dodaje `queryParams: { variant: id }` wyłącznie dla `active_variant_count >= 2`; dla N=1 i braku pól PS-111 zachowuje dotychczasowy adres. Podtytułu wariantu nie dodano, aby nie zmieniać układu paska.

## 2026-11-21 18:06 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check collections | PASS |
| deno check public | PASS |
| deno check recipes | PASS |
| deno check search | PASS |
| deno test | PASS |
| npm run lint | PASS |
| npm run test:run | FAIL |
| npm run build | PASS |

Ostatnie linie wyjścia — npm run test:run:

```text
     98|         expect(container.querySelector('[role="tab"][aria-selected="tr…
     99|         expect(screen.getByText('Zapisujesz wariant: Klasyczna')).toBe…
       |                       ^
    100|     });
 Test Files  1 failed | 77 passed (78)
      Tests  1 failed | 460 passed (461)
   Start at  18:05:49
   Duration  39.24s (transform 32.41s, setup 1.83s, import 150.73s, tests 72.82s, environment 18.63s)
    101| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

## 2026-11-21 18:11 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check collections | PASS |
| deno check public | PASS |
| deno check recipes | PASS |
| deno check search | PASS |
| deno test | PASS |
| npm run lint | PASS |
| npm run test:run | FAIL |
| npm run build | PASS |

Ostatnie linie wyjścia — npm run test:run:

```text
     98|         expect(container.querySelector('[role="tab"][aria-selected="tr…
     99|         expect(screen.getByText('Zapisujesz wariant: Klasyczna')).toBe…
       |                       ^
    100|     });
    101| 
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
 Test Files  1 failed | 78 passed (79)
      Tests  1 failed | 463 passed (464)
   Start at  18:10:01
   Duration  48.51s (transform 49.35s, setup 2.47s, import 192.26s, tests 80.83s, environment 30.69s)
```

## 2026-11-21 ps-view-implementer + orkiestrator (etap widoków, wynik końcowy)

Po decyzji użytkownika usunięto nieaktualne asercje „Zapisujesz wariant” z `recipe-detail-view.component.spec.ts`
(wymaganie celowo wycofane w PS-110; wcześniejszy FAIL Vitest wynikał wyłącznie z tej asercji). Wyniki powtórzone
przez orkiestratora.

| Weryfikacja | Wynik | Uwagi |
|---|---|---|
| `npm run lint` | PASS | |
| `npm run test:run` (Vitest) | PASS | 79 plików, 464 testy, 0 błędów |
| `npm run build` | PASS | istniejące ostrzeżenia budżetu SCSS |

Ręczna weryfikacja UX/mobile/czytnik ekranu nie była wykonywana (zob. „Czynności ręczne” planu widoków).
Niepokryte automatycznie: GWT na realnych danych (N=1/2/4, K<N, kolekcja z A/B, usunięcie A).
