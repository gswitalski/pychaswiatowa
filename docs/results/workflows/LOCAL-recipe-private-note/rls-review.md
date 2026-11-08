# RLS / security review (nr 3) — LOCAL-recipe-private-note (PS-31)

REVIEWER: independent-reviewer
VERDICT: PASS

Niezależność modelowa: zachowana. Autor zmian: Claude (Anthropic). Recenzent: subagent `independent-reviewer` (Grok 4.7, xAI).

Zakres rundy: zmiana backendu BEZ zmian SQL — `supabase/functions/_shared/recipe-notes.ts` (odczyt zwraca `ok`/`unavailable`), wywołania w `recipes.service.ts`, `explore.service.ts`, `public.service.ts`, kontrakt `shared/contracts/types.ts`, blokada zapisu w komponencie notatki. Po review zmienił się wyłącznie komentarz w `shared/contracts/types.ts` (bez wpływu na bezpieczeństwo).

Ograniczenie recenzenta: powłoka zablokowana — nie odczytał katalogu bazy. Dowody uzupełnił agent główny (sekcja poniżej).

## Critical/Major

brak

1. Izolacja bez zmian: `userId === null` → brak zapytania do tabeli; dla zalogowanego `.eq('user_id', userId).eq('recipe_id', recipeId)`; `userId` z `auth.getUser()`, nie z żądania. Explore/public: service role z jawnym filtrem; `recipes.getRecipeById`: klient JWT (RLS).
2. Klient dostaje wyłącznie sygnał awarii (`my_note_unavailable: true`, bez `my_note`); gość `{}`. `logger.error` loguje `errorCode`, `errorMessage`, `userId` wywołującego, `recipeId` — bez treści notatki i bez `details`/`hint`; to log serwera, nie odpowiedź HTTP.
3. Fail-closed: błąd odczytu nie staje się `my_note: null` ani wyciekiem; brak lookupu przy zalogowanym też daje `my_note_unavailable`. `PUT` nadal zapisuje wyłącznie notatkę wywołującego (`auth.uid()` w RPC).
4. Cache: odpowiedź z `my_note_unavailable` tylko dla zalogowanego — public `no-store` + `Vary: Authorization`, explore `no-store` dla zalogowanego; gość `public, max-age=60` bez pól notatki; `GET /recipes` wyłącznie uwierzytelniony.

## Minor/Info

- info — log `errorMessage` akceptowalny (log serwera, ścieżka SELECT).
- info — explore nie dokłada `Vary`; flaga niedostępności jest tylko na odpowiedzi `no-store`.
- minor (stałe) — SELECT/DELETE własnej notatki nie powtarzają predykatu widoczności przepisu (po PUBLIC→PRIVATE zostaje odczyt/usunięcie własnego, historycznego wiersza); minor (stałe) — brak filtra znaków kontrolnych w API.
- info — blokada nadpisania jest w oficjalnym kliencie; właściciel może nadal wywołać `PUT` własnej notatki (nie otwiera to odczytu cudzej treści).

## Potwierdzenie braku zmian SQL

Oba pliki migracji nie były dotykane w tej iteracji (daty modyfikacji: `20261108120000` 22:03, `20261108130000` 23:17 — sprzed tej poprawki) i zawierają: RLS, `REVOKE ALL` od `anon` na tabeli, `set_recipe_note` jako `SECURITY INVOKER` z `search_path = ''`, `REVOKE` od `public`/`anon`, `GRANT EXECUTE` dla `authenticated`, `auth.uid()`.

## Dowody z lokalnej bazy (agent główny, odczyt read-only)

`relrowsecurity = true`; 4 polityki; `has_function_privilege`: anon = false, public = false, authenticated = true; `has_table_privilege(anon, select) = false`; `prosecdef = false`, `proconfig = {search_path=""}`; `migrate-local`: 0 oczekujących migracji. Smoke `localApi` (47 asercji, w tym izolacja `my_note` owner/other) przeszedł na bieżącym fingerprincie.
