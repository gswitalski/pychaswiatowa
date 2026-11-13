# Plan implementacji API — PS-107: Filtrowanie tabeli przepisów publicznych

Historyjka: `docs/results/new-features/user-stories/PS-107/PS-107-admin-recipes-table-filters-user-story.md`
Zależność: PS-204 (`GET /admin/recipes`, `admin_get_recipes_page`)

## 1. Zakres i decyzje

Rozszerzyć istniejący `GET /functions/v1/admin/recipes` oraz RPC o filtrowanie
przed sortowaniem, liczeniem `total_items` i paginacją. Bez nowej Edge Function,
zmiany RLS, danych lub bazowego zakresu `visibility = 'PUBLIC' AND deleted_at IS NULL`.
Wywołanie bez filtrów zachowuje dotychczasowy kontrakt (scen. 19).

Założenia:
- Query używa `id`, `name`, `author`, `category_id` (parametr powtarzalny),
  `uncategorized=true`, `created_from`, `created_to`, `rating_min`,
  `rating_max`, `ratings_count_min`, `ratings_count_max`, `is_grill=true`
  i `is_termorobot=true`. Puste/false parametry nie są wysyłane.
- `category_id` może wystąpić wiele razy; parser odrzuca duplikaty jako nieszkodliwe
  (deduplikacja do tablicy), a nieistniejące ID daje zero wyników. `uncategorized`
  może wystąpić wyłącznie jako `true`; brak obu parametrów oznacza brak filtra.
- Daty są transportowane jako `YYYY-MM-DD`; RPC interpretuje granice w strefie
  `Europe/Warsaw` (`created_from` od początku dnia, `created_to` przed początkiem
  następnego dnia). To ogranicza zależność od strefy serwera.
- Tekst jest trimowany i przekazywany jako dane, nie jako dynamiczny SQL.
  W SQL `ILIKE` ma jawnie escapowane `%`, `_` i `\`, z kolacją `pl-x-icu`.
- `author` wymaga warunkowego dołączenia e-maila do całego zbioru przed filtrem;
  e-mail pozostaje zwracany wyłącznie dla wierszy strony, tak jak w PS-204.
- Zakres oceny filtruje `round(avg(rating), 1)` i wyklucza `NULL`; zakres licznika
  używa `coalesce(..., 0)`. Oba końce są inkluzywne.

## 2. Pliki

Nowe:
- `supabase/migrations/{timestamp}_extend_admin_recipes_filters.sql`
- `supabase/functions/admin/admin-recipes.filters.ts` (normalizacja tekstów,
  parser listy ID i serializowalne argumenty RPC)
- `supabase/functions/admin/admin-recipes.types.test.ts` (walidacja)

Modyfikowane:
- `supabase/functions/admin/admin-recipes.types.ts` — DTO, schema Zod i walidacja
  wszystkich parametrów; tekst ≤100, ID dodatnie, zakresy poprawne, rating 1–5,
  licznik ≥0, daty ISO; błąd `400 VALIDATION_ERROR` `{ code, message, details }`.
- `supabase/functions/admin/admin-recipes.service.ts` — przekazanie filtrów do RPC,
  bez logowania e-maila; mapowanie odpowiedzi bez zmiany DTO wiersza.
- `supabase/functions/admin/admin-recipes.handlers.test.ts` — query i błędy.
- `supabase/functions/admin/admin-recipes.service.test.ts` — argumenty i regresja
  bez filtrów.
- `supabase/functions/admin/admin-recipes.rpc.test.ts` — lokalne przypadki filtrów
  i uprawnień, wyłącznie przy bezpiecznej lokalnej bazie.
- `shared/contracts/types.ts`, `shared/types/database.types.ts`,
  `supabase/functions/_shared/database.types.ts` — zgodne kontrakty i sygnatura RPC.
- `supabase/functions/admin/README.md`, `test-requests.http` — przykłady query.

## 3. Endpoint i RPC

Endpoint pozostaje `GET /admin/recipes`, autoryzacja `requireAdminContext` następuje
przed walidacją. Role i odpowiedzi `401`, `403`, `405`, `500` pozostają jak w PS-204;
niepoprawny filtr zwraca `400 VALIDATION_ERROR`. Handler przekazuje jeden obiekt
`query` do serwisu, a serwis wywołuje `admin_get_recipes_page` z filtrami.

Rozszerzyć RPC o argumenty:
`p_recipe_id bigint`, `p_name text`, `p_author text`,
`p_category_ids bigint[]`, `p_include_uncategorized boolean`,
`p_created_from date`, `p_created_to date`,
`p_rating_min numeric`, `p_rating_max numeric`,
`p_ratings_count_min bigint`, `p_ratings_count_max bigint`,
`p_is_grill boolean`, `p_is_termorobot boolean`.
Dotychczasowe cztery argumenty pozostają na początku sygnatury, z domyślnymi
wartościami, aby wywołanie bez filtrów było kompatybilne na poziomie API.

W CTE:
1. `ratings_agg` zachowuje `round(avg(...), 1)` i `count(*)`.
2. `source_rows` dołącza kategorię, profil, agregaty oraz — gdy aktywny autor —
   `auth.users`; filtruje ID, nazwę i autora, daty, kategorie (OR, w tym
   `category_id IS NULL`), znaczniki oraz zakresy oceny/licznika.
3. `total` liczy już przefiltrowany zbiór, następnie działa istniejące
   `row_number`, sortowanie i wartownik. E-mail dołączać po oknie, o ile nie jest
   potrzebny do filtrowania.
4. `created_from/to` stosować jako porównania do granic `Europe/Warsaw`;
   nie używać `BETWEEN` dla „do”.

Migracja wykonuje `create or replace`, powtarza `revoke all ... from public, anon,
authenticated`, `grant execute ... to service_role`, komentarz i blok
`has_function_privilege`; nie zmienia RLS. Zaktualizować test sygnatury i nie
usuwać poprzednich przeciążeń spoza repozytorium. Nie dodawać indeksów bez pomiaru;
po wdrożeniu zmierzyć filtr autora/nazwy i rozważyć `pg_trgm` jako osobną decyzję.

## 4. Testy jednostkowe i pokrycie scenariuszy

`deno test --allow-env --allow-net supabase/functions/admin/`:
- walidacja: puste query, trim, wielokrotne kategorie + „Bez kategorii”, znaki
  specjalne, granice ID/tekstu/dat/ratingów/licznika, odwrócone zakresy (scen. 16);
- serwis: komplet parametrów RPC, brak filtrów, mapowanie wartownika i błędów;
- handler: autoryzacja przed walidacją, `400`, `401/403`, `500` (scen. 17–18);
- test lokalnego RPC: nazwa z polskimi znakami, autor po nazwie/e-mailu, OR kategorii,
  brak kategorii, daty graniczne, rating zaokrąglony, 0 ocen, oba znaczniki,
  AND filtrów, ID, liczniki/paginacja, sortowanie po wyniku i zgodność bez filtrów
  (scen. 3–11, 19). Testy danych mają prefiks, blokadę hosta i `finally`.

Pokrycie kryteriów API: 1–11 przez walidację/RPC, 12–14 przez total/paginację i
kontrakt odpowiedzi, 15–19 przez walidację/handler/RPC, 20 przez kontrakt błędów
i delegację do widoku. Kryteria 2 i 13 dotyczą także planu widoków.

## 5. Weryfikacja i czynności ręczne

Komendy: `deno test --allow-env --allow-net supabase/functions/admin/`,
`deno check supabase/functions/admin/index.ts`, `deno lint supabase/functions/admin`,
`supabase db reset` oraz `npm run build`. Sprawdzić `has_function_privilege`:
`anon=false`, `authenticated=false`, `service_role=true`.

Czynności ręczne: lokalnie kontem admina sprawdzić każdy filtr, polskie znaki,
e-mail, „Bez kategorii”, 0–0, kombinacje AND, zmianę strony/rozmiaru/sortowania
z aktywnymi filtrami oraz błędne query. Brak czynności zewnętrznych i nowych sekretów.
