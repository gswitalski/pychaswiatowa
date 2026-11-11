# PS-204 — Review implementacji API, runda 2 (ostatnia)

Zakres: ograniczony do weryfikacji uwag z rundy 1 i poszukiwania regresji.
Raport zapisał orkiestrator (reviewerzy działają w trybie tylko do odczytu).

## Werdykt zbiorczy: WYMAGA_POPRAWEK (tylko zakres `api-tests`)

| Zakres | Reviewer | Werdykt | Uwagi blokujące |
|---|---|---|---|
| `api-db` | 71a87518-7cc2-487b-8449-1b1016ef3386 | ZAAKCEPTOWANE | brak |
| `api-code` | 6cd5e038-e405-4b50-af93-4bf8517bd4a8 | ZAAKCEPTOWANE | brak |
| `api-tests` | 262aff72-8aa5-4f4b-b1e0-0320d3a1f5ae | WYMAGA_POPRAWEK | R2-1, R2-2 |

Runda 2 z 2 — limit rund poprawek wyczerpany. Dalsze działanie wymaga decyzji użytkownika.

## api-db — ZAAKCEPTOWANE

- DB-B1 (`drop function` spoza repo), DB-B2 (kolizja znacznika, czysta baza), DB-W1 (pomiar wydajności),
  DB-W2 (revoke `admin_update_user_role`), D1, D5, D6 — naprawione.
- D2, D3, D4 — świadomie odłożone (drobne, bez ryzyka).
- ACL lokalnie: `{postgres=X/postgres, service_role=X/postgres}` dla trzech funkcji, `prosecdef = t`.
- Migracja jest powtarzalna (ponowne wykonanie w transakcji z `rollback` przeszło).
- Wywołania RPC w kodzie produkcyjnym idą przez `service_role`, więc revoke niczego nie psuje.

Uwagi drobne:
1. `deployment-plan.md`, sekcja 2, pkt 5 — przykładowe zapytanie ACL pomija `admin_update_user_role(uuid,text,uuid)`; dodać też opcjonalny zdalny odczyt `pg_proc` pod kątem przeciążeń.
2. `verification.md` — doprecyzować, co mierzył `EXPLAIN` i że wynik jest tylko lokalny.
3. `verification.md` — `db reset` usunął lokalne dane; kopia w `%TEMP%\ps204-local-backup.sql` nieprzywrócona.
4. `ratings_agg` agreguje także przepisy niepubliczne (tylko koszt wydajności).
5. `set search_path = public` bez `pg_catalog`, brak `#variable_conflict use_column` (brak ryzyka — kolumny kwalifikowane).
6. `Returns` w `database.types.ts` nie oznacza pól `null` dla wartownika; mapowanie w serwisie traktuje `id = null` jako wartownik.

## api-code — ZAAKCEPTOWANE

- CODE-B1, CODE-B2, CODE-W1, D1, D3, D5, D6, D7 — naprawione; D4 częściowo; D2 akceptowalne.
- `deno check` PASS; `deno test` bez bazy: 31 passed, 0 failed, 2 ignored.

Uwagi drobne:
- W-1: zbędne rzutowania `as AdminRecipesSortBy` / `as SortDirection` i import `SortDirection` w `admin-recipes.service.ts` (ok. l. 15, 130–133).
- W-2: `verification.md` — dopisać, że „33 PASS" wymaga lokalnej bazy; bez niej 31 passed + 2 ignored.
- README: jedna zbędna spacja przed komentarzem we wpisie `admin-recipes.*.ts` (kosmetyka).

## api-tests — WYMAGA_POPRAWEK

Naprawione: TEST-2, TEST-3/CODE-B1, TEST-4, TEST-8, TEST-9. Częściowo: TEST-1, TEST-5, TEST-6, TEST-7.

| ID | Priorytet | Plik | Uwaga |
|---|---|---|---|
| R2-1 | BLOKUJĄCY | `admin-recipes.rpc.test.ts:66–107` | Reguły SQL niepokryte: remis `id asc`, „bez ocen na końcu" (asc/desc), autor bez nazwy, pusta kategoria, `ratings_count` jako liczba, `total_items`, sortowania `desc` i pozostałe `sort_by`. |
| R2-2 | BLOKUJĄCY | `admin-recipes.rpc.test.ts:152–174` | ACL testowane tylko dla `anon` i `admin_get_recipes_page`; brak `authenticated` oraz `admin_get_users_page` i `admin_update_user_role`. Łagodzi: samosprawdzenie w migracji (`has_function_privilege`) i ręczny wynik ACL w `verification.md`. |
| R2-3 | ŚREDNI | `admin-recipes.rpc.test.ts:91–105` | Tylko strona 1 z `page_size: 100`; przy dużej lokalnej bazie test niestabilny. |
| R2-4 | ŚREDNI | `admin-recipes.rpc.test.ts:118–138` | Słaba regresja zmiany roli (brak odczytu roli przed/po, zakodowane `'user'`). |
| R2-5 | ŚREDNI | `admin-recipes.service.test.ts` | Niepokryte: `average_rating null → null`, string `"4.5"`, `author_username/email null`, `result.sorting`, odizolowane `created_at`/`author_id` null. |
| R2-6 | ŚREDNI | `admin-recipes.rpc-guard.test.ts` | Brak asercji na `reason`, brak przypadku z credentials przy hoście lokalnym, pustego URL, `LOCALHOST`. |
| R2-7 | NISKI | `admin-recipes.rpc.test.ts:50–64` | `assertLocal()` raz przed pętlą `createUser`, nie przed każdym zapisem. |
| R2-8 | NISKI | `admin-recipes.rpc.test.ts:140–148` | Sprzątanie w `finally` przerywane wyjątkiem i ignorujące błędy; brak czyszczenia pozostałości `ps204t-`. |
| R2-9 | NISKI | `admin-recipes.handlers.test.ts` | Brak asercji `code` w body dla `401/403/404/405`. |
| R2-10 | NISKI | `admin-recipes.types.test.ts` | Brak granic: `page_size=1.5/-1/puste`, puste `sort_by`/`sort_dir`, `sort_dir=ASC`, powtórzone `page`. |

## Status weryfikacji po review r2

| Pozycja | Status |
|---|---|
| Migracja, `db reset`, ACL 3 funkcji | PASS (lokalnie) |
| `deno check`, `deno test` (bez bazy: 31 + 2 ignored) | PASS |
| Reguły SQL i ACL pokryte testem automatycznym | NIE_WYKONANO (R2-1, R2-2) |
| Smoke test `200` admin / `403` user | WYMAGA_WERYFIKACJI |
| Zdalna historia migracji (`migration list --linked`) | WYMAGA_WERYFIKACJI |

## Dodatkowa runda poprawek testów (po zgodzie użytkownika, ponad limit 2 rund)

- Wykonał implementer API (728ec6b3-cad3-4a8f-b714-bf69cd5dbe8d): R2-1..R2-10, W-1, W-2 oraz drobne uwagi api-db.
- Weryfikacja orkiestratora: bez zmiennych bazy 32 passed, 0 failed, 2 ignored (PASS). Z lokalną bazą wg implementera: 34 passed, 0 failed (wynik potwierdzony przebiegami w terminalu).
- ACL: testy anon i authenticated dla trzech funkcji akceptują kod 42501 lub PGRST301 (odmowa na poziomie PostgREST/JWT); asercja data === null i brak zmiany roli. Akceptowalne, ale słabsze niż sztywne 42501 — pozycja do wzmianki w retrospektywie.
- deno lint: WYMAGA_WERYFIKACJI (istniejące reguły importów i require-await). migration list --linked: PASS (brak kolizji wg implementera). Smoke 200/403: WYMAGA_WERYFIKACJI.
- Status zakresu api-tests po dodatkowej rundzie: brak niezależnego re-review (BEZ_REVIEW — limit rund; decyzja użytkownika na bramce).

