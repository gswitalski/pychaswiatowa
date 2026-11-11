# PS-204: Tabela przepisów publicznych w panelu administracyjnym — Plan wdrożenia

> **User Story:** PS-204 — `PS-204-admin-public-recipes-table-user-story.md`
> **Data:** 11 listopada 2026
> **Środowisko docelowe:** Supabase Cloud (baza + Edge Functions) + Firebase Hosting (frontend)
> **Powiązane:** `PS-204-admin-public-recipes-table-api-plan.md`, `PS-204-admin-public-recipes-table-ui-plan.md`

---

## 1. Podsumowanie

PS-204 wymaga **jednej migracji** (nowa funkcja `public.admin_get_recipes_page(bigint, integer, text, text)` oraz odebranie `execute` rolom `public`/`anon`/`authenticated` istniejącej `public.admin_get_users_page(integer, integer, text, text)` — bez zmiany jej treści), rozszerzenia istniejącej Edge Function `admin` o endpoint `GET /admin/recipes` oraz nowej strony w Angularze. Nie zmienia schematu tabel, widoków (`recipe_details` bez zmian), RLS ani danych — **nie wymaga migracji danych**.

Kroki wdrożeniowe wykonują się **automatycznie** w workflow `.github/workflows/main-deploy.yml` (push do `main`) w kolejności:

1. `test` — **wyłącznie** `npm run test:run` (Vitest),
2. `deploy-backend` — `supabase db push --remote --yes` (migracja) → `supabase secrets set` → `supabase functions deploy` (lista zawiera już `admin`),
3. `deploy-frontend` — `npm run build` i Firebase Hosting.

Kolejność gwarantuje, że funkcja bazy istnieje, zanim zacznie działać nowy kod Edge Function, a nowy frontend trafia na hosting dopiero po backendzie. Zmiana jest **wstecznie zgodna** (nowy endpoint i nowa funkcja SQL są addytywne; stary frontend nie wywołuje nowego endpointu, a stary kod funkcji `admin` nie zna funkcji SQL — krótkie okna pośrednie są bezpieczne).

> **Ważne:** CI **nie uruchamia** `deno test` ani `npm run lint` — te kontrole są **ręcznym** warunkiem merge'a (krok 1, pkt 9–10). `npm run build` działa dopiero w `deploy-frontend` (po wdrożeniu backendu), więc błąd budowania wykryłby się zbyt późno — uruchomić lokalnie przed merge'em.

| Obszar | Wymagane działanie ręczne |
|---|---|
| Nowa usługa zewnętrzna, konto, klucze API | **Brak** |
| Supabase Secrets / zmienne środowiskowe | **Brak** (używane są istniejące `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` funkcji `admin`) |
| GitHub Secrets | **Brak** |
| Migracja SQL | Automatyczna (`db push`); ręcznie: **weryfikacja przed merge'em** (krok 1) i **po wdrożeniu** (krok 3) |
| Kolacja ICU `pl-x-icu` | **Ręczna weryfikacja dostępności** lokalnie **i na produkcji przed merge'em** (krok 1, pkt 2) — warunek wdrożenia |
| Nowa Edge Function / zmiana workflow | **Brak** — endpoint w istniejącej funkcji `admin`; lista `functions deploy` bez zmian |
| Supabase Cron / pg_cron / webhooki | **Brak** |
| Firebase Hosting / domena | **Brak** |
| Testy E2E (Playwright) | **Nie dotyczy** — proces obejmuje wyłącznie testy jednostkowe (Vitest, `deno test`) |

---

## 2. Krok 1 — Przed merge'em do `main`

**Cel:** uniknąć zawieszenia deployu backendu i frontendu przez błąd `db push` (w tym świadomy błąd strażnika kolacji) oraz potwierdzić, że reguły sortowania i uprawnienia działają.

1. **Znacznik czasu migracji.** `supabase/migrations/20261111120000_create_admin_get_recipes_page_rpc.sql` musi mieć znacznik **większy** niż najnowsza migracja na produkcji (`20261109120000_create_user_recipe_notes.sql` w repozytorium; na produkcji mogły dojść późniejsze):

    ```bash
    supabase link --project-ref <SUPABASE_PROJECT_ID>
    supabase migration list
    ```

    Rozjazd *Local* / *Remote* lub migracja o większym znaczniku na produkcji → naprawić przed merge'em (`supabase migration repair` albo zmiana znacznika nowej migracji), inaczej `db push` odrzuci migrację jako „out of order".

2. **Dostępność kolacji `pl-x-icu` (warunek wdrożenia).** Wykonać na **bazie lokalnej** (`supabase start`) **oraz na produkcji** (SQL Editor w Supabase Dashboard lub `psql` z connection stringiem projektu, zapytania tylko do odczytu):

    ```sql
    select collname, collprovider from pg_collation where collname = 'pl-x-icu';
    -- oczekiwane: jeden wiersz, collprovider = 'i'

    select array_agg(x order by lower(x collate "pl-x-icu"))
    from unnest(array['Żurek','zupa','Łosoś','lody','Śledź','sałatka','ćma','Czosnek']) as x;
    -- oczekiwane: {Czosnek,ćma,lody,Łosoś,sałatka,Śledź,zupa,Żurek}
    ```

    - **Oba środowiska zwracają oczekiwany wynik** → wdrażać wersję migracji ze strażnikiem (plan API pkt 4.1).
    - **Kolacji brak w którymkolwiek środowisku** → **zatrzymać wdrożenie** i zgłosić właścicielowi produktu. Zgodnie z decyzją 16 wolno wdrożyć wariant zastępczy (`lower()` + domyślna kolacja bazy, bez strażnika) **dopiero po jawnej akceptacji**, z odnotowanym ograniczeniem (polskie znaki diakrytyczne mogą być sortowane niezgodnie z polskim alfabetem) w historyjce (przypadek brzegowy 16, Otwarte kwestie), w podsumowaniu i w review API.
    - Strażnik jest celowy: jeśli produkcja nie ma kolacji, `db push` w CI zakończy się błędem **przed** zastosowaniem funkcji i przed deployem funkcji i frontendu — stan produkcji pozostaje bez zmian.

3. **Suchy przebieg migracji na produkcyjnej bazie:**

    ```bash
    supabase db push --dry-run
    ```

    Oczekiwane: na liście do zastosowania **wyłącznie** `20261111120000_create_admin_get_recipes_page_rpc.sql`.

4. **Lokalny test na czystej bazie:** `supabase db reset`; migracja przechodzi bez błędów; funkcja `admin_get_recipes_page` istnieje.

5. **Uprawnienia obu funkcji (krytyczne — prywatność e-maili).** Lokalnie i po wdrożeniu:

    ```sql
    select
        f.fn,
        has_function_privilege('anon', f.fn, 'execute') as anon_can,
        has_function_privilege('authenticated', f.fn, 'execute') as authenticated_can,
        has_function_privilege('service_role', f.fn, 'execute') as service_role_can
    from (values
        ('public.admin_get_recipes_page(bigint,integer,text,text)'),
        ('public.admin_get_users_page(integer,integer,text,text)'),
        ('public.admin_update_user_role(uuid,text,uuid)')
    ) as f(fn);
    -- oczekiwane w każdym wierszu: false | false | true
    ```

    Dodatkowo: wywołanie `POST /rest/v1/rpc/admin_get_recipes_page` **oraz** `POST /rest/v1/rpc/admin_get_users_page` z kluczem `anon` i z tokenem zwykłego użytkownika → odmowa (`401`/`403`/`42501 permission denied`), brak danych. Migracja zawiera własne samosprawdzenie tych uprawnień (błąd zatrzymuje `db push`).

    **Brak regresji listy użytkowników:** lokalnie (konto admina z `.env.local`) `GET /admin/users` → `200` z listą jak przed zmianą — funkcja jest wołana kluczem `service_role`, który zachowuje `execute`.

    Opcjonalnie, po wdrożeniu, sprawdzić brak przeciążeń funkcji:

    ```sql
    select p.oid::regprocedure, p.proacl
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_get_recipes_page', 'admin_get_users_page', 'admin_update_user_role');
    ```

6. **Test reguł sortowania i zakresu na zasianej bazie lokalnej** (zapytania `select * from admin_get_recipes_page(...)` jako `service_role` lub przez `GET /admin/recipes` z kontem admina z `.env.local`). Zbiór testowy: przepisy `PUBLIC`, `PRIVATE`, `SHARED`, usunięty `PUBLIC`; przepisy z ocenami (różne średnie, remisy) i bez ocen; bez kategorii; autorzy z nazwą, bez nazwy, bez profilu; nazwy z polskimi znakami i różną wielkością liter.

    | Sprawdzenie | Oczekiwany wynik |
    |---|---|
    | Zakres | tylko `PUBLIC` + `deleted_at IS NULL`; `total_items` zgodne z liczeniem w SQL |
    | `sort_by=average_rating` asc i desc | przepisy bez ocen na końcu w obu kierunkach, w kolejności `id asc` |
    | `sort_by=ratings_count&sort_dir=asc` | `0` ocen na początku; `desc` — `0` na końcu; remis `id asc` |
    | `sort_by=author` asc i desc | autorzy bez nazwy na końcu w obu kierunkach (`id asc`); reszta wg nazwy bez rozróżniania wielkości liter, polska kolejność |
    | `sort_by=category` asc i desc | bez kategorii na końcu w obu kierunkach; polska kolejność |
    | `sort_by=name` | `Czosnek, ćma, lody, Łosoś, sałatka, Śledź, zupa, Żurek`; `Ala`/`ala` obok siebie, `id asc` |
    | Stabilna paginacja | przejście stron 1..N bez duplikatów i luk (każdy `sort_by`) |
    | Strona poza zakresem | `GET /admin/recipes?page=999` oraz `?page=3000000000` → `200`, `data: []`, `totalItems`/`totalPages` poprawne (nie `0`, nie `500`) |
    | Walidacja | `page=0`, `page=9007199254740992`, `page_size=0`, `page_size=101`, `sort_by=updated_at`, `sort_dir=up` → `400 VALIDATION_ERROR` |
    | Autoryzacja | brak tokenu → `401`; token `user`/`premium` → `403`; `POST /admin/recipes` → `405` |
    | Średnia | wartość równa `recipe_details.average_rating` dla tych samych przepisów (spójność formuły) |

7. **Pomiar wydajności (ryzyko skali, ~10 tys. przepisów).** Zasiać lokalnie ~10 tys. publicznych przepisów (z ocenami, część bez kategorii/profilu) **lub** użyć kopii produkcyjnej i wykonać `EXPLAIN (ANALYZE, BUFFERS)` zapytania funkcji dla każdego z 6 `sort_by` (asc/desc dla `name` i `average_rating`). Wynik dołączyć do review API. **Próg:** najwolniejszy wariant ≲ 300 ms. Przekroczenie → nie wdrażać; zaproponować indeks częściowy `recipes (created_at desc, id) where visibility = 'PUBLIC' and deleted_at is null` / agregat ocen / kolumnę sortującą jako **osobną decyzję** (plan API pkt 7.3). Bez dowodu nowych indeksów nie dodajemy.

8. **Testy `deno test` dla funkcji `admin`** (ręcznie — CI ich nie uruchamia):

    ```bash
    deno test --allow-env --allow-net supabase/functions/admin/
    ```

    (flagi zgodnie z istniejącym sposobem uruchamiania testów funkcji). Opcjonalny test kolejności na bazie (`admin-recipes.rpc.test.ts`) uruchamia się **wyłącznie**, gdy `SUPABASE_URL` wskazuje `localhost` / `127.0.0.1` (twarda blokada hosta; każdy inny adres, w tym produkcyjny, → test ignorowany bez połączenia), używa danych z unikalnym prefiksem i sprząta po sobie. Wymaga lokalnego Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` i opcjonalnie `SUPABASE_ANON_KEY` ze środowiska lokalnego, nigdy z produkcji); jeśli test nie został uruchomiony, zapisać status jako `NIE_WYKONANO` (nie `PASS`) i wykonać weryfikację manualną z pkt 6.

9. **Jakość frontendu:** `npm run lint` bez nowych błędów, `npm run build` zakończone sukcesem, `npm run test:run` (to uruchamia CI) — zapisać statusy jawnie (`PASS`/`FAIL`, nie `NIE_WYKONANO`).

10. **Test manualny w przeglądarce (lokalnie, konto admina z `.env.local`; sekrety nigdy w dokumentacji ani kodzie):** sortowanie 6 kolumn, zmiana rozmiaru 25/50/100, strona poza zakresem, link w nowej karcie, szerokość < 600 px, konto `user` bez dostępu, gość → `/login?returnUrl=%2Fadmin%2Frecipes`, F5 → stan domyślny.

---

## 3. Krok 2 — Merge i wdrożenie automatyczne

Merge do `main` uruchamia workflow w kolejności `test` → `deploy-backend` (`db push`, secrets, functions) → `deploy-frontend`.

- Jeśli `db push` zakończy się błędem (strażnik kolacji, kolizja znacznika) → deploy backendu i frontendu **nie nastąpi**; produkcja pozostaje w poprzednim stanie. Rozwiązanie: naprawić migrację (nowym commitem), nie edytować po fakcie zastosowanych migracji.
- Jeśli `db push` się powiedzie, a deploy funkcji `admin` zawiedzie → funkcja SQL istnieje (nieużywana, `service_role`-only), frontend nie jest wdrożony; ponowić workflow lub naprawić funkcję.
- Brak koniecznych kroków ręcznych w trakcie (nie ma nowych sekretów ani nowych funkcji).

---

## 4. Krok 3 — Po wdrożeniu (smoke test na produkcji)

1. **Uprawnienia funkcji** — zapytanie z kroku 1 pkt 5 na produkcji (obie funkcje): `false | false | true`.
2. **Endpoint** (token admina z sesji przeglądarki lub z logowania kontem admina; nie zapisywać tokenów w repo):
    - `GET /functions/v1/admin/users` → `200`, lista użytkowników jak dotychczas (brak regresji po odebraniu `execute` funkcji `admin_get_users_page`);
    - `GET /functions/v1/admin/recipes` → `200`, `data` ≤ 25, `pagination.totalItems` zgodne z `select count(*) from recipes where visibility = 'PUBLIC' and deleted_at is null`;
    - `?page=3000000000` → `200`, pusta lista, poprawne `totalItems`/`totalPages`; `?page=9007199254740992` → `400`;
    - ten sam adres z tokenem zwykłego użytkownika → `403`; bez tokenu → `401`;
    - `?page_size=101` → `400`.
3. **UI na produkcji:** zalogować się jako admin → sidebar „Przepisy publiczne" → tabela ładuje się, sortowanie dwóch wybranych kolumn, selektor rozmiaru strony; link „Otwórz przepis" otwiera nową kartę; dashboard i „Użytkownicy" działają jak dotąd.
4. **Czas odpowiedzi:** zanotować czas ładowania pierwszej strony i sortowania po polskiej kolacji (oczekiwane: znacznie poniżej 1 s dla ~10 tys. przepisów); logi funkcji `admin` w Supabase (wpisy `[admin] GET /admin/recipes completed`, brak `[admin] RPC error while fetching admin recipes`).
5. **Dane osobowe w logach:** potwierdzić, że logi nie zawierają e-maili autorów (logowane są tylko `userId` admina, parametry zapytania i liczby).

---

## 5. Rollback

Zmiana jest addytywna, bez zmian danych — wycofanie nie powoduje utraty danych. Kolejność od warstwy najbliższej użytkownikowi:

| Krok | Działanie |
|---|---|
| 1. Frontend | Firebase Hosting: przywrócenie poprzedniego wydania (rollback releasu) **albo** `git revert` zmian UI i ponowny deploy; po tym kroku pozycja „Przepisy publiczne" znika z sidebara |
| 2. Edge Function | `git revert` commitów PS-204 w `supabase/functions/admin/` i redeploy `supabase functions deploy admin` (endpoint `GET /admin/recipes` znika → `404`) |
| 3. Funkcja SQL (opcjonalnie) | Nowa migracja naprzód (np. `2026111xxxxxxx_drop_admin_get_recipes_page_rpc.sql`): `drop function if exists public.admin_get_recipes_page(bigint, integer, text, text);` — **nie** edytować i **nie** usuwać już zastosowanej migracji. Pozostawienie funkcji jest bezpieczne (dostępna tylko dla `service_role`, nic od niej nie zależy), więc krok 3 można odłożyć. Odebranych uprawnień `admin_get_users_page` **nie** przywracamy (przywrócenie otworzyłoby odczyt e-maili przez publiczne API bazy; panel działa na `service_role`) |
| Awaria wydajnościowa (nie błąd poprawności) | Ratunek bez rollbacku danych: wycofanie kroków 1–2 (administratorzy tracą widok, aplikacja publiczna bez wpływu); funkcja nie obciąża ścieżek użytkowników końcowych |

Wpływ na funkcje publiczne: **brak** — endpoint używany wyłącznie przez administratorów, a funkcja SQL nie modyfikuje danych ani widoków.

---

## 6. Ryzyka i ich ograniczenia

| # | Ryzyko | Prawdopodobieństwo / skutek | Ograniczenie |
|---|---|---|---|
| 1 | Brak kolacji `pl-x-icu` w produkcyjnej bazie | Niskie / `db push` zatrzymany (strażnik) albo — w wariancie zastępczym — kolejność polskich znaków niezgodna z alfabetem | Weryfikacja przed merge'em (krok 1 pkt 2); wariant zastępczy tylko po akceptacji z odnotowanym ograniczeniem |
| 2 | Wydajność przy rosnącej liczbie przepisów (skan + sortowanie w pamięci przy każdym żądaniu; koszt O(N log N) z kolacją ICU) | Niskie w skali ~10 tys. / wolniejsze ładowanie panelu admina (bez wpływu na użytkowników końcowych) | Pomiar `EXPLAIN ANALYZE` przed wdrożeniem (krok 1 pkt 7), próg ~300 ms, monitoring po wdrożeniu; rewizja decyzji o indeksach przy ~50–100 tys. przepisów publicznych |
| 3 | Wyciek e-maili autorów (`admin_get_recipes_page`) i użytkowników (`admin_get_users_page`) przez wywoływalność funkcji `security definer` przez PostgREST | Średnie bez `revoke` / wysoki (dane osobowe) | `revoke ... from public, anon, authenticated` + `grant ... to service_role` dla obu funkcji w migracji; test uprawnień w kroku 1 pkt 5 i kroku 3 pkt 1 |
| 4 | Znacznik migracji „out of order" | Niskie / `db push` zawodzi | Krok 1 pkt 1 |
| 5 | CI nie uruchamia `deno test` ani `lint`; `build` działa po wdrożeniu backendu | Średnie / regresja wykryta późno | Ręczne uruchomienie lokalnie przed merge'em (krok 1 pkt 8–9) |
| 6 | Reguły kolejności w SQL niepokryte atrapami (testy jednostkowe nie sprawdzają `ORDER BY`) | Średnie / błędna kolejność niewykryta w CI | Test bazodanowy opt-in tylko na lokalnej bazie (blokada hosta `localhost` / `127.0.0.1`) + obowiązkowa weryfikacja manualna (krok 1 pkt 6); status `NIE_WYKONANO` jeśli baza lokalna nie działa |
| 7 | Lista może być nieaktualna (zmiana widoczności/usunięcie po pobraniu) | Niskie / link do przepisu może zwrócić „brak dostępu" | Zaakceptowane w historyjce (przypadek brzegowy 4); ręczne odświeżenie |
| 8 | Istniejąca `admin_get_users_page` nie miała `revoke` dla `public/anon/authenticated` (potencjalny wyciek e-maili użytkowników) | Potencjalnie wysokie (dane osobowe użytkowników) | Migracja PS-204 odbiera `execute` rolom `public`/`anon`/`authenticated` (treść i sygnatura bez zmian), zostawia `service_role`; weryfikacja `has_function_privilege` dla obu funkcji i test regresji `GET /admin/users` (krok 1 pkt 5, krok 3 pkt 1–2); przyszła migracja przebudowująca tę funkcję przez `drop` + `create` musi powtórzyć `revoke` |

---

## 7. Dokumentacja po wdrożeniu

- `supabase/functions/admin/README.md` i `test-requests.http` — zaktualizowane w ramach implementacji.
- `docs/results/project-summary.md` (sekcje 4–6: nowa funkcja SQL, endpoint `GET /admin/recipes`, widok „Przepisy publiczne") — aktualizacja na etapie summary po akceptacji review.
- Wynik weryfikacji (statusy `PASS`/`FAIL`/`NIE_WYKONANO`, wyniki `EXPLAIN`, wynik sprawdzenia kolacji w obu środowiskach, ewentualne odnotowane ograniczenie wariantu zastępczego) zapisać w artefaktach review zgodnie z `ps-feature-conventions`.
