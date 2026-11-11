# PS-204 — Review API, runda 1

**Slug:** `admin-public-recipes-table`  
**Data:** 2026-11-11  
**Zakresy:** `api-db`, `api-code`, `api-tests` (niezależni reviewerzy, tylko odczyt; raport zapisany przez orkiestratora)  
**Werdykt łączny:** `WYMAGA_POPRAWEK` (`ZMIANY_WYMAGANE`)  
**Weryfikacja bazowa:** patrz `PS-204-admin-public-recipes-table-verification.md`

## Podsumowanie

- `api-db`: logika SQL funkcji `admin_get_recipes_page` poprawna i zgodna z planem (sortowania, wartownik, bigint, ACL, filtr, e-mail tylko dla wierszy strony, brak dynamicznego SQL). Zastrzeżenia dotyczą potoku migracji.
- `api-code`: kod produkcyjny zgodny z planem i `backend.mdc`; braki w testach i niespójny artefakt weryfikacji.
- `api-tests`: testy pokrywają wąski wycinek planu; reguły SQL niepokryte automatycznie; test RPC nie seeduje danych.

## Uwagi blokujące

| # | Zakres | Uwaga | Poprawka |
|---|---|---|---|
| DB-B1 | api-db | Migracja zawiera `drop function` przeciążenia spoza repozytorium (`admin_get_recipes_page(uuid, text, text, text, text, integer, integer)`, pozostałość lokalnej bazy); CI wykonuje `db push` bez bramki ręcznej | Usunąć `drop` z migracji; przed merge sprawdzić zdalnie `pg_proc`; ewentualnie osobna migracja |
| DB-B2 | api-db | Kolizja wersji: lokalna historia ma `20261111120000 revoke_public_execute_on_admin_rpcs` i `20261111120100 create_admin_get_recipes_page_rpc`; `db reset` NIE_WYKONANO; PASS uprawnień nie jest wiarygodny (create or replace zachowuje ACL) | `supabase migration list --linked` (kolizja ze zdalną historią → zmiana znacznika); naprawa lokalnej bazy i weryfikacja na czystej bazie |
| CODE-B1 | api-code | Testy handlera/routera niepełne (brak `401`, `400` po autoryzacji, `500`, `405`/`404`, `401` bez nagłówka) | Dodać przypadki z planu pkt 9.3 |
| CODE-B2 | api-code | Artefakt weryfikacji niespójny (25 PASS vs 24 PASS + 1 pominięty; wpis hooka `deno test | FAIL`) | Ujednolicić statusy (24 PASS + 1 NIE_WYKONANO), wyjaśnić wpis FAIL |
| TEST-1 | api-tests | `admin-recipes.rpc.test.ts` nie seeduje i nie pokrywa reguł SQL (zakres, polska kolejność, remis id, bez ocen/autora/kategorii, ratings_count, total_items, revoke obu funkcji) | Pełna wersja z planu pkt 9.5 (prefiks, `finally`, `assertLocal()` per krok, klienci anon i authenticated) |
| TEST-2 | api-tests | Weryfikacja myli PASS z testem ignorowanym | j.w. (CODE-B2) |
| TEST-3 | api-tests | Brak testów handlera i routera | j.w. (CODE-B1) |
| TEST-4 | api-tests | Za mało granic walidacji (`page`: pusty, `1.5`, `1e3`, `-1`, `abc`, 400 cyfr, `3000000000`; `page_size`; 6 `sort_by`; brak cichych domyślnych) | Tabela przypadków z planu pkt 9.1 |

## Uwagi ważne

- **DB-W1** brak pomiaru wydajności (`EXPLAIN (ANALYZE, BUFFERS)` dla 6 sortowań na ~10 tys. przepisów + pętla ≥10 wywołań funkcji; próg ~300 ms).
- **DB-W2** (poza zakresem zmiany) `admin_update_user_role(uuid,text,uuid)` — `security definer`, `grant` tylko do `service_role`, ale **brak `revoke` dla `public`/`anon`/`authenticated` w migracjach repozytorium**; lokalnie ACL to już `postgres`+`service_role` (efekt zagubionej migracji). Zdalnie możliwa furtka do nadania sobie roli admina przez PostgREST. Analogicznie część funkcji z `revoke ... from public` bez `anon`/`authenticated`.
- **CODE-W1** niepełne testy walidacji i serwisu (strona poza zakresem, `totalItems=0`, NaN/Infinity, zaokrąglanie, `INTERNAL_ERROR` dla uszkodzonego wiersza, `MAX_SAFE_INTEGER`).
- **TEST-5** asercje błędów bez klasy/kodu (`ApplicationError`, `code`).
- **TEST-6** niepełne mapowanie i paginacja w testach serwisu.
- **TEST-7** `rpc-guard.test.ts` — brak przypadków: userinfo, protokół inny niż http(s), IPv6 `[::1]`, `0.0.0.0`, `evil.com/?h=localhost`, `undefined`, asercja na `reason`.
- **TEST-8** test RPC kończy się `return` zamiast jawnego ignorowania (`ignore: !anonKey`).
- **TEST-9** `assertLocal()` per krok i znormalizowany adres (`parsed.origin`) do klienta.

## Uwagi drobne

DB: D1 kolacja sprawdzona tylko lokalnie (wykonać zapytanie na produkcji; opcjonalnie `collprovider = 'i'`), D2 `ratings_agg` agreguje także niepubliczne przepisy, D3 `search_path`, D4 `#variable_conflict use_column`, D5 komentarz funkcji bez wzmianki o wartowniku, D6 kolejność wpisu i pól w `database.types.ts`.  
CODE: D1 `total_items = null` przy niepustych danych → `INTERNAL_ERROR`/warn, D2 `mapRow` wymaga `author_id`, D3 nieużywane `rn?`, D4 zbędne rzutowania, D5 README (macierz kodów + uwaga o e-mailach), D6 `test-requests.http` (brakujące żądania), D7 typy ręczne.  
TEST: `rpc-guard.ts` zwraca `parsed.origin`; zawężenie sprawdzenia osiągalności do `200`/`401`.

## Decyzje użytkownika i następny krok

Poprawki: runda 1 z maks. 2 na zakres. Szczegóły decyzji dotyczących lokalnej bazy i zakresu (`admin_update_user_role`) — patrz Historia zmian historyjki oraz bramka akceptacji.
