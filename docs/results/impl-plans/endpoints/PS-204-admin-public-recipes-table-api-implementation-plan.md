# API Endpoints Implementation Plan: PS-204 — Tabela przepisów publicznych w panelu administracyjnym

> **Historyjka:** PS-204 (`docs/results/new-features/user-stories/PS-204/PS-204-admin-public-recipes-table-user-story.md`)
> **Specyfikacja API:** `docs/results/new-features/user-stories/PS-204/PS-204-admin-public-recipes-table-api-plan.md`
> **Powiązane plany:** `PS-204-admin-public-recipes-table-ui-plan.md`, `PS-204-admin-public-recipes-table-deployment-plan.md`
> **Wzorzec w kodzie:** `GET /admin/users` (`admin.handlers.ts`, `admin.service.ts`, `admin.types.ts`) oraz `public.admin_get_users_page` (migracje `20260410120000` + poprawka `20260410123000`)
> **Stan kodu zweryfikowany:** 11 listopada 2026 (ostatnia migracja: `20261109120000_create_user_recipe_notes.sql`)
> **Pierwszeństwo:** gdzie ten plan różni się od SQL z planu API (pkt 4.3 — miejsce dołączenia e-maila), obowiązuje ten plan (patrz pkt 12, sprzeczność S1).

---

## 1. Przegląd

Zakres: **jeden nowy endpoint odczytu** `GET /admin/recipes` w istniejącej Edge Function `admin`, **jedna nowa funkcja bazy** `public.admin_get_recipes_page` oraz **zmiana uprawnień** istniejącej `public.admin_get_users_page` — wszystko w **jednej migracji**. Brak nowej Edge Function, brak zmian w workflow, brak nowych sekretów, brak E2E.

| # | Element | Typ | Cel |
|---|---|---|---|
| A | `GET /functions/v1/admin/recipes` | **Nowy** endpoint (funkcja `admin`) | Jedna strona przepisów `PUBLIC` bez usuniętych: autor, kategoria, oceny, znaczniki, licznik całkowity |
| B | `public.admin_get_recipes_page(bigint, integer, text, text)` | **Nowa** funkcja SQL | `security definer`, `row_security = off`, wykonanie tylko dla `service_role`; sortowanie, paginacja, wiersz-wartownik z licznikiem |
| C | `public.admin_get_users_page(integer, integer, text, text)` oraz `public.admin_update_user_role(uuid, text, uuid)` | **Zmiana uprawnień** (bez zmiany treści i sygnatur) | `revoke execute` od `public`, `anon`, `authenticated`; `service_role` zostaje (decyzja użytkownika, opcja B) |
| D | Strażnik kolacji + samosprawdzenie uprawnień | W migracji | Migracja głośno zawodzi, gdy `pl-x-icu` jest niedostępna / sortuje inaczej niż oczekiwano, albo gdy uprawnienia są inne niż zamierzone |

**Bez zmian:** widok `recipe_details`, tabele i RLS (`recipes`, `recipe_ratings`, `profiles`, `categories`), istniejące endpointy `admin` (w tym `GET /admin/users`), `index.ts` (CORS i router już obsługują `GET`), `.github/workflows/main-deploy.yml`, dashboard i `GET /admin/summary`. Brak nowych indeksów (pkt 7).

### Decyzje przyjęte w tym planie (z rund pytań)

| # | Decyzja | Skutek w planie |
|---|---|---|
| R1 | Numer strony to **`bigint`** w SQL; Zod odrzuca (`400`) tylko `page > Number.MAX_SAFE_INTEGER`; mniejsze wartości poza zakresem → `200` z pustą listą i poprawnymi licznikami | Sygnatura `(bigint, integer, text, text)` we **wszystkich** miejscach (revoke/grant/comment/rollback/`has_function_privilege`); `v_offset` liczony w `bigint`; dodatkowy limit w SQL jako druga linia obrony (pkt 4.2) |
| R2 | Test kolejności na bazie: opcjonalny `admin-recipes.rpc.test.ts`, **tylko** gdy `SUPABASE_URL` wskazuje `localhost` / `127.0.0.1` (twarda blokada), unikalny prefiks danych, sprzątanie; brak lokalnej bazy → `NIE_WYKONANO` | Pkt 9.3 |
| R3 | Ta sama migracja odbiera `execute` rolom `public`/`anon`/`authenticated` funkcji `admin_get_users_page` (jej faktyczna sygnatura `(integer, integer, text, text)`), zostawia `service_role`; weryfikacja `has_function_privilege` dla obu funkcji i test, że `GET /admin/users` działa | Pkt 4.5, 4.6, 9, 10 |
| Z1 | Strażnik kolacji sprawdza także zachowanie sortowania (`Czosnek` przed `ćma`) i `lower()` dla polskich liter; wariant zastępczy tylko po jawnej akceptacji | Pkt 4.1 |
| Z2 | E-mail z `auth.users` dołączany **dopiero dla wierszy strony** (nie jest kluczem sortowania, nie bierze udziału w liczniku) | Pkt 4.3 |
| Z3 | Jeden wiersz-wartownik zamiast dwóch wywołań RPC; każdy `sort_by` z osobnym wyrażeniem `case` dla `asc`/`desc`; ostatni klucz zawsze `id asc`; wszystkie odwołania kwalifikowane aliasami | Pkt 4.3, 4.4 |
| Z4 | `createSuccessResponse` **zdublowana lokalnie** w `admin-recipes.handlers.ts` (bez eksportu z `admin.handlers.ts` → brak cyklicznego importu); `createMethodNotAllowedResponse` zostaje w routerze; `PositiveIntegerQueryStringSchema` **eksportowana** z `admin.types.ts`; `toSafeNonNegativeNumber` **zdublowana** w nowym serwisie (bez refaktoru) | Pkt 6 |
| Z5 | Autoryzacja przed walidacją; logi bez e-maili; bez nowych indeksów (próg ~300 ms, `EXPLAIN ANALYZE`); bez E2E | Pkt 2, 6, 7 |

---

## 2. Szczegóły żądania i odpowiedzi

### `GET /functions/v1/admin/recipes`

- **Metoda / ścieżka:** router `admin.handlers.ts`: `subPath === '/recipes'`; `GET` → handler; inna metoda → `405 METHOD_NOT_ALLOWED` z `Allow: GET, OPTIONS`; `/recipes/{cokolwiek}` i `/recipes/` → `404 NOT_FOUND` (istniejące zachowanie routera).
- **Autoryzacja:** `Authorization: Bearer <JWT>`; `requireAdminContext(req)` (JWT + `app_role = 'admin'` + zgodność `sub`). **Kolejność w handlerze: autoryzacja → walidacja query → serwis.** Użytkownik niezalogowany lub niebędący adminem nie dowiaduje się, czy parametry są poprawne.
- **Role JWT:** `admin` → dozwolone; `user`, `premium` → `403 FORBIDDEN`; brak/niepoprawny/wygasły token, niezgodność `sub` → `401 UNAUTHORIZED`.
- **Request body:** brak (`GET`).

| Parametr | Typ | Domyślnie (gdy pominięty) | Reguła Zod |
|---|---|---|---|
| `page` | całkowita | `1` | `^\d+$` (po `trim`), `>= 1`, **`<= Number.MAX_SAFE_INTEGER`** (R1) |
| `page_size` | całkowita | `25` | `^\d+$`, `1..100` (UI oferuje 25/50/100; API przyjmuje każdą wartość 1..100) |
| `sort_by` | enum | `created_at` | `name`, `author`, `category`, `created_at`, `average_rating`, `ratings_count` |
| `sort_dir` | enum | `desc` | `asc`, `desc` |

Parametry spoza listy są ignorowane (jak w `GET /admin/users`); parametry z listy o błędnej wartości → `400`. Nie istnieje parametr zmieniający widoczność ani filtr usuniętych.

### Odpowiedź `200` (`GetAdminRecipesResponseDto`)

```json
{
    "data": [
        {
            "id": 42,
            "name": "Szarlotka",
            "author_id": "1a2b3c4d-0000-0000-0000-000000000000",
            "author_username": "Kasia_Gotuje",
            "author_email": "kasia@example.com",
            "category_name": "Deser",
            "created_at": "2026-05-03T10:15:00+00:00",
            "average_rating": 4.5,
            "ratings_count": 12,
            "is_grill": true,
            "is_termorobot": false
        }
    ],
    "pagination": { "currentPage": 1, "pageSize": 25, "totalPages": 3, "totalItems": 61 },
    "sorting": { "sort_by": "created_at", "sort_dir": "desc" }
}
```

- `pagination.currentPage` = **żądana** strona (nieucinana do `totalPages`), `pageSize` i `sorting` = faktycznie użyte wartości.
- `totalItems` = wszystkie przepisy publiczne niezależnie od strony; `totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)`.
- Strona poza zakresem (`page > totalPages`, także `page = 3000000000` i `page = 9007199254740991`): `200`, `data: []`, poprawne `totalItems`/`totalPages`.
- `average_rating`: liczba z 1 miejscem po przecinku albo `null`; nigdy `0`/`NaN`. `ratings_count`: całkowita `>= 0`. `author_username`/`author_email`/`category_name`: `null`, gdy brak. Brak pól `visibility` i `updated_at`.

### Macierz kodów odpowiedzi

| Kod | Kiedy | Uwagi |
|---|---|---|
| `200` | Poprawne żądanie admina (także pusta lista, strona poza zakresem) | `Content-Type: application/json` |
| `201` | **Nie dotyczy** | endpoint tylko odczytuje |
| `204` | **Nie dotyczy** | — |
| `400 VALIDATION_ERROR` | `page` < 1 / nienumeryczne / puste / `> Number.MAX_SAFE_INTEGER`; `page_size` poza 1..100; `sort_by`/`sort_dir` spoza allowlisty | Komunikat `Nieprawidlowe parametry paginacji lub sortowania.`; bez cichego przywracania domyślnych |
| `401 UNAUTHORIZED` | Brak/niepoprawny/wygasły token; `sub` ≠ użytkownik | Przed walidacją query |
| `402` | **Nie dotyczy** | brak płatności/kredytów |
| `403 FORBIDDEN` | Rola `user`/`premium` | Przed walidacją query |
| `404 NOT_FOUND` | `/admin/recipes/{x}`, `/admin/recipes/` | Nie dotyczy zasobu, tylko ścieżki |
| `405 METHOD_NOT_ALLOWED` | Metoda ≠ `GET` | `Allow: GET, OPTIONS` |
| `409` | **Nie dotyczy** | brak modyfikacji |
| `422` | **Nie dotyczy** | projekt używa `400 VALIDATION_ERROR` |
| `500 INTERNAL_ERROR` | Błąd RPC; wiersz z `id`, ale bez `name`/`created_at` | `Failed to fetch admin recipes` / `Invalid admin recipes row received from RPC`; szczegóły tylko w logu |

Format błędu zawsze `{ code, message, details }` przez `handleError` (`_shared/errors.ts`).

---

## 3. Lista plików

### Nowe

| Plik | Zawartość |
|---|---|
| `supabase/migrations/20261111120000_create_admin_get_recipes_page_rpc.sql` | Strażnik kolacji, funkcja `admin_get_recipes_page`, `revoke`/`grant` trzech funkcji, komentarz, samosprawdzenie uprawnień |
| `supabase/functions/admin/admin-recipes.types.ts` | Stałe i typy lokalne, `AdminRecipesQuerySchema`, `validateAdminRecipesQuery` |
| `supabase/functions/admin/admin-recipes.service.ts` | `getAdminRecipes` (RPC, mapowanie, paginacja) |
| `supabase/functions/admin/admin-recipes.handlers.ts` | `handleGetAdminRecipes` (z wstrzykiwalnymi zależnościami) |
| `supabase/functions/admin/admin-recipes.types.test.ts` | Testy walidacji |
| `supabase/functions/admin/admin-recipes.service.test.ts` | Testy serwisu z atrapą klienta |
| `supabase/functions/admin/admin-recipes.handlers.test.ts` | Testy handlera i routera |
| `supabase/functions/admin/admin-recipes.rpc-guard.ts` | Czysta funkcja `evaluateLocalDbGuard` (blokada hosta) — bez `.test` w nazwie, więc nie jest zbierana jako test |
| `supabase/functions/admin/admin-recipes.rpc-guard.test.ts` | Zawsze uruchamiany test blokady hosta (bez bazy) |
| `supabase/functions/admin/admin-recipes.rpc.test.ts` | Opcjonalny test bazodanowy (kolejność, zakres, uprawnienia) — tylko lokalna baza |

### Modyfikowane

| Plik | Zmiana |
|---|---|
| `supabase/functions/admin/admin.types.ts` | Dodać `export` do `PositiveIntegerQueryStringSchema` (jedyna zmiana w tym pliku) |
| `supabase/functions/admin/admin.handlers.ts` | Import `handleGetAdminRecipes`; gałąź `subPath === '/recipes'` przed `logger.warn('[admin] Unknown admin endpoint', …)` |
| `shared/contracts/types.ts` | `AdminRecipesSortBy`, `GetAdminRecipesQueryDto`, `AdminRecipeListItemDto`, `GetAdminRecipesResponseDto` (obok `AdminUsers*`, ok. l. 764–815) |
| `supabase/functions/_shared/database.types.ts`, `shared/types/database.types.ts` | Wpis `admin_get_recipes_page` (Args: `p_page_number?: number`, `p_page_size?: number`, `p_sort_by?: string`, `p_sort_dir?: string`; Returns jak w pkt 4.2) — regeneracja `supabase gen types` lub ręczny dopisek; serwis i tak używa rzutowanego klienta RPC. Wpis `admin_get_users_page` bez zmian |
| `supabase/functions/admin/README.md`, `supabase/functions/admin/test-requests.http` | Opis endpointu, przykładowe żądania (domyślne, 6× `sort_by`, `page_size=100`, `page=3000000000` → `200`, `page=9007199254740992` → `400`, błędne parametry, brak tokenu, token `user`) |

**Poza implementacją:** `docs/results/project-summary.md` — dopiero na etapie summary po akceptacji review.

---

## 4. Migracja `20261111120000_create_admin_get_recipes_page_rpc.sql`

Znacznik większy niż `20261109120000`; przed merge'em `supabase migration list` (plan wdrożenia, krok 1 pkt 1). Cała migracja wykonuje się w jednej transakcji: dowolny `raise exception` wycofuje wszystko, a `db push` w CI zatrzymuje deploy backendu i frontendu.

### 4.1 Strażnik kolacji (decyzja 16, założenie Z1)

```sql
do $$
declare
    v_actual text[];
begin
    if not exists (select 1 from pg_catalog.pg_collation where collname = 'pl-x-icu') then
        raise exception
            'PS-204: collation "pl-x-icu" is not available in this database; use the fallback migration variant (lower() + default collation) only after explicit approval and document the limitation';
    end if;

    -- Zachowanie sortowania (polski alfabet): c < ć < l < ł < s < ś < z < ż
    execute $q$
        select array_agg(x order by lower(x collate "pl-x-icu"), x)
        from unnest(array['Żurek','zupa','Łosoś','lody','Śledź','sałatka','ćma','Czosnek']) as x
    $q$ into v_actual;

    if v_actual is distinct from
        array['Czosnek','ćma','lody','Łosoś','sałatka','Śledź','zupa','Żurek'] then
        raise exception 'PS-204: collation "pl-x-icu" does not sort Polish text as expected: %', v_actual;
    end if;

    -- lower() z kolacją ICU musi obsługiwać polskie wielkie litery niezależnie od LC_CTYPE bazy
    if lower('ŁÓDŹ ŚŻ' collate "pl-x-icu") is distinct from 'łódź śż' then
        raise exception 'PS-204: lower() with collation "pl-x-icu" does not fold Polish capitals';
    end if;
end;
$$;
```

- Zapytanie sortujące jest wykonywane przez `execute`, więc plpgsql nie parsuje `collate "pl-x-icu"` przed sprawdzeniem istnienia kolacji (komunikat błędu jest czytelny).
- **Wariant zastępczy** (tylko po jawnej akceptacji właściciela produktu, po wyniku weryfikacji z planu wdrożenia): usunąć blok 4.1 i zamienić `lower(x collate "pl-x-icu")` na `lower(x)` we wszystkich wyrażeniach pkt 4.4; odnotować ograniczenie w historyjce, podsumowaniu i review API. **Implementer nie przełącza wariantu samodzielnie.**

### 4.2 Sygnatura i zabezpieczenia (R1)

```sql
create or replace function public.admin_get_recipes_page(
    p_page_number bigint default 1,
    p_page_size integer default 25,
    p_sort_by text default 'created_at',
    p_sort_dir text default 'desc'
)
returns table (
    id bigint,
    name text,
    author_id uuid,
    author_username text,
    author_email text,
    category_name text,
    created_at timestamptz,
    average_rating numeric,
    ratings_count bigint,
    is_grill boolean,
    is_termorobot boolean,
    total_items bigint
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
    c_max_page constant bigint := 9007199254740991; -- Number.MAX_SAFE_INTEGER (zgodnie z walidacją Zod)
    v_page_number bigint := least(greatest(coalesce(p_page_number, 1), 1), c_max_page);
    v_page_size integer := least(greatest(coalesce(p_page_size, 25), 1), 100);
    v_sort_by text := lower(coalesce(p_sort_by, 'created_at'));
    v_sort_dir text := lower(coalesce(p_sort_dir, 'desc'));
    v_offset bigint;
begin
    if v_sort_by not in ('name', 'author', 'category', 'created_at', 'average_rating', 'ratings_count') then
        v_sort_by := 'created_at';
    end if;

    if v_sort_dir not in ('asc', 'desc') then
        v_sort_dir := 'desc';
    end if;

    -- bigint * bigint: maks. 9007199254740990 * 100 ≈ 9.0e17 < 9.22e18 — brak przepełnienia
    v_offset := (v_page_number - 1) * v_page_size::bigint;

    return query
    /* zapytanie z pkt 4.3 */;
end;
$$;
```

- **`bigint` w całym łańcuchu (R1):** `p_page_number` (`bigint`), `v_page_number` (`bigint`), `v_offset` (`bigint`), `rn` z `row_number()` (`bigint`) — porównania bez rzutowań w dół. Limit `c_max_page` w SQL to wyłącznie druga linia obrony przy bezpośrednim wywołaniu RPC (bez niego `page > ~9.2e16` dałoby `22003 bigint out of range` w `v_offset`); API odrzuca takie wartości w Zod z `400`.
- `p_page_size` zostaje `integer` (1..100).
- Normalizacja wejścia w SQL (fallbacki `created_at`/`desc`, ucięcie rozmiaru) jest **drugą linią obrony**; serwis nie polega na niej (pkt 6.1).
- Rzutowania: `r.name::text`, `c.name::text`, `au.email::text` (`auth.users.email` to `varchar` — por. `20260410123000`).
- **Wszystkie** odwołania do kolumn w zapytaniu kwalifikowane aliasem tabeli/CTE (kolumny wyjściowe `id`, `name`, `created_at`, `average_rating`, `ratings_count`, `is_grill`, `total_items` to zmienne OUT plpgsql; niekwalifikowane odwołanie = `column reference "id" is ambiguous`).

### 4.3 Zapytanie (e-mail tylko dla wierszy strony — Z2, wartownik — Z3)

```sql
    return query
    with ratings_agg as (
        select
            rr.recipe_id,
            count(*)::bigint as ratings_count,
            round(avg(rr.rating)::numeric, 1) as average_rating -- ta sama formuła co recipe_details
        from public.recipe_ratings rr
        group by rr.recipe_id
    ),
    source_rows as (
        select
            r.id,
            r.name::text as name,
            r.user_id as author_id,
            nullif(btrim(p.username), '') as author_username,
            c.name::text as category_name,
            r.created_at,
            ra.average_rating,                                  -- NULL bez ocen
            coalesce(ra.ratings_count, 0)::bigint as ratings_count,
            r.is_grill,
            r.is_termorobot
        from public.recipes r
        left join public.categories c on c.id = r.category_id
        left join public.profiles p on p.id = r.user_id
        left join ratings_agg ra on ra.recipe_id = r.id
        where r.visibility = 'PUBLIC'
          and r.deleted_at is null
    ),
    total as (
        select count(*)::bigint as total_items from source_rows
    ),
    ranked as (
        select
            sr.*,
            row_number() over (order by /* klucze z pkt 4.4 */) as rn
        from source_rows sr
    ),
    page_rows as (
        select rk.*
        from ranked rk
        where rk.rn > v_offset
          and rk.rn <= v_offset + v_page_size
    )
    select
        pr.id,
        pr.name,
        pr.author_id,
        pr.author_username,
        au.email::text,
        pr.category_name,
        pr.created_at,
        pr.average_rating,
        pr.ratings_count,
        pr.is_grill,
        pr.is_termorobot,
        t.total_items
    from total t
    left join page_rows pr on true
    left join auth.users au on au.id = pr.author_id
    order by pr.rn nulls last;
```

Własności, które implementer musi zachować:

1. **Licznik niezależny od strony.** `total` liczy `source_rows` (zawsze `count(*)` — dokładnie jeden wiersz). `total left join page_rows on true` daje: do `v_page_size` wierszy (każdy z `total_items`) albo — gdy strona jest pusta (poza zakresem lub brak przepisów) — **dokładnie jeden wiersz-wartownik** z `id IS NULL`, pozostałymi polami `NULL` i poprawnym `total_items` (`0` przy braku przepisów). Jedno zapytanie = jedna migawka (bez dwóch wywołań RPC).
2. **E-mail po stronicowaniu.** `auth.users` jest dołączane *po* `page_rows` (≤ 100 wierszy), więc nie uczestniczy ani w sortowaniu, ani w liczniku, a skan `auth.users` nie rośnie z liczbą przepisów. Join jest `left` (autor bez konta nie gubi wiersza). **Warunek akceptacji:** `EXPLAIN` (pkt 7.3) nie może pokazywać pełnego skanu `auth.users` przed oknem; jeśli planer tak wybierze, owinąć `page_rows` w `materialized` CTE lub użyć `left join lateral`, bez zmiany wyniku.
3. **Agregacja ocen** identyczna z `recipe_details` (`round(avg(rating)::numeric, 1)`, `count(*)`, `NULL` bez ocen), raz `group by recipe_id`, `left join`; wspiera ją `idx_recipe_ratings_recipe_id (recipe_id) include (rating)`. Widok nie jest używany ani zmieniany.
4. **Filtr** `visibility = 'PUBLIC' and deleted_at is null` jest stałą w treści funkcji; brak parametru, który go zmienia.
5. `left join` na `profiles`/`categories`: przepis bez profilu/kategorii nie znika (`username` sprowadzane do `NULL`, gdy pusty po `btrim`).
6. Wyjściowy `order by pr.rn nulls last` zachowuje kolejność okna po dołączeniu e-maila (wartownik ma jeden wiersz, więc `nulls last` jest bez znaczenia).

### 4.4 Porządek sortowania (klucze `row_number() over (order by …)`)

Każdy `sort_by` ma **osobne** wyrażenia `case` dla `asc` i `desc` (jak `admin_get_users_page`); dla nieaktywnego `sort_by` wyrażenie zwraca `NULL` (stały klucz, bez wpływu na porządek). Teksty: `lower(<kolumna> collate "pl-x-icu")` — wielkość liter jest zredukowana ICU, więc `Ala`/`ala` rozstrzyga `id`.

```sql
order by
    -- name
    case when v_sort_by = 'name' and v_sort_dir = 'asc'  then lower(sr.name collate "pl-x-icu") end asc,
    case when v_sort_by = 'name' and v_sort_dir = 'desc' then lower(sr.name collate "pl-x-icu") end desc,
    -- author: autorzy bez nazwy zawsze na końcu (niezależnie od kierunku)
    case when v_sort_by = 'author' then (sr.author_username is null)::int end asc,
    case when v_sort_by = 'author' and v_sort_dir = 'asc'  then lower(sr.author_username collate "pl-x-icu") end asc,
    case when v_sort_by = 'author' and v_sort_dir = 'desc' then lower(sr.author_username collate "pl-x-icu") end desc,
    -- category: pusta kategoria zawsze na końcu
    case when v_sort_by = 'category' then (sr.category_name is null)::int end asc,
    case when v_sort_by = 'category' and v_sort_dir = 'asc'  then lower(sr.category_name collate "pl-x-icu") end asc,
    case when v_sort_by = 'category' and v_sort_dir = 'desc' then lower(sr.category_name collate "pl-x-icu") end desc,
    -- created_at
    case when v_sort_by = 'created_at' and v_sort_dir = 'asc'  then sr.created_at end asc,
    case when v_sort_by = 'created_at' and v_sort_dir = 'desc' then sr.created_at end desc,
    -- average_rating: bez ocen zawsze na końcu
    case when v_sort_by = 'average_rating' then (sr.average_rating is null)::int end asc,
    case when v_sort_by = 'average_rating' and v_sort_dir = 'asc'  then sr.average_rating end asc,
    case when v_sort_by = 'average_rating' and v_sort_dir = 'desc' then sr.average_rating end desc,
    -- ratings_count: zwykła liczba (0 nie jest przesuwane)
    case when v_sort_by = 'ratings_count' and v_sort_dir = 'asc'  then sr.ratings_count end asc,
    case when v_sort_by = 'ratings_count' and v_sort_dir = 'desc' then sr.ratings_count end desc,
    -- stabilna paginacja: zawsze id rosnąco (NIE created_at desc jak w liście użytkowników)
    sr.id asc
```

Uwagi poprawności: (a) klucze `(… is null)::int asc` stawiają `NULL`-e na końcu w obu kierunkach, więc domyślne `NULLS FIRST` kluczy `desc` nie ma znaczenia (w grupie `NULL` wszystkie wartości kluczy są `NULL` → remis → `id asc`); (b) `name` jest `not null`, `created_at` i `ratings_count` nigdy `NULL`; (c) `average_rating` porównywane po wartości już zaokrąglonej do 1 miejsca.

Wymagane zachowanie (testy pkt 9): `ćma` po `Czosnek`; `Łosoś` po `lody`; `Śledź` po `sałatka`; `Żurek` po `zupa`; `Ala`/`ala` obok siebie, rozstrzygnięte `id`; `average_rating` — `NULL` na końcu (`id asc`) w obu kierunkach; `ratings_count asc` — `0` na początku, `desc` — na końcu; `author` — bez nazwy na końcu w `id asc`.

### 4.5 Uprawnienia obu funkcji (R1 + R3), komentarz

```sql
-- nowa funkcja
revoke all on function public.admin_get_recipes_page(bigint, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_recipes_page(bigint, integer, text, text)
    to service_role;

comment on function public.admin_get_recipes_page(bigint, integer, text, text) is
'Returns one page of PUBLIC, non-deleted recipes for the admin panel with author, category and rating aggregates. total_items is returned even for out-of-range pages (sentinel row with id = NULL). Executable by service_role only.';

-- istniejąca funkcja: tylko uprawnienia, bez zmiany treści i sygnatury (faktyczna sygnatura z 20260410120000 / 20260410123000)
revoke all on function public.admin_get_users_page(integer, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_users_page(integer, integer, text, text)
    to service_role;

-- istniejąca funkcja zmiany roli: tylko service_role
revoke all on function public.admin_update_user_role(uuid, text, uuid)
    from public, anon, authenticated;
grant execute on function public.admin_update_user_role(uuid, text, uuid)
    to service_role;
```

- `revoke … from public, anon, authenticated` jest obowiązkowe **osobno** dla `anon` i `authenticated`: Supabase nadaje im jawne `EXECUTE` przez domyślne uprawnienia (`alter default privileges`), więc samo `from public` nie wystarczy. Funkcje są `security definer` z `row_security = off` i czytają `auth.users.email`.
- Powtórzone `grant … to service_role` jest idempotentnym zabezpieczeniem (po `revoke all` na pewno zostaje tylko ta rola z `EXECUTE`).
- **Nie** tworzyć nowej wersji `admin_get_users_page` ani nie dotykać jej treści (nadal wołana wyłącznie przez `createServiceRoleClient()` w `admin.service.ts` — zweryfikowane w kodzie: jedyne wywołanie to `client.rpc('admin_get_users_page', …)` w `admin.service.ts`, brak wywołań z frontendu).
- `create or replace` nie zmienia ACL, więc przyszła migracja poprawiająca tę funkcję bez zmiany typu zwracanego zachowa odebrane uprawnienia; `drop` + `create` je zresetuje (ryzyko R3 w pkt 12).

### 4.6 Samosprawdzenie uprawnień (na końcu migracji)

```sql
do $$
declare
    v_recipes text := 'public.admin_get_recipes_page(bigint,integer,text,text)';
    v_users text := 'public.admin_get_users_page(integer,integer,text,text)';
    v_role text := 'public.admin_update_user_role(uuid,text,uuid)';
begin
    if has_function_privilege('anon', v_recipes, 'execute')
        or has_function_privilege('authenticated', v_recipes, 'execute')
        or has_function_privilege('anon', v_users, 'execute')
        or has_function_privilege('authenticated', v_users, 'execute')
        or has_function_privilege('anon', v_role, 'execute')
        or has_function_privilege('authenticated', v_role, 'execute')
        or not has_function_privilege('service_role', v_recipes, 'execute')
        or not has_function_privilege('service_role', v_users, 'execute')
        or not has_function_privilege('service_role', v_role, 'execute') then
        raise exception 'PS-204: unexpected EXECUTE privileges on admin page RPCs';
    end if;
end;
$$;
```

`has_function_privilege` uwzględnia także uprawnienia odziedziczone z `PUBLIC`, więc blok wykrywa niewycofane `EXECUTE` dla `public`. Dzięki temu błąd uprawnień zatrzymuje `db push` **przed** deployem funkcji Edge i frontendu.

### 4.7 Rollback

- Funkcja nowa: `drop function if exists public.admin_get_recipes_page(bigint, integer, text, text);` (nowa migracja naprzód, nie edytować zastosowanej).
- Uprawnienia `admin_get_users_page`: **świadomie bez przywracania** — przywrócenie `EXECUTE` dla `anon`/`authenticated` ponownie otworzyłoby odczyt e-maili przez publiczne API bazy. Panel działa na `service_role`, więc `revoke` nie wymaga rollbacku nawet przy wycofaniu reszty PS-204.

---

## 5. Kontrakty — `shared/contracts/types.ts`

```ts
export type AdminRecipesSortBy =
    | 'name'
    | 'author'
    | 'category'
    | 'created_at'
    | 'average_rating'
    | 'ratings_count';

export interface GetAdminRecipesQueryDto {
    page?: number;
    page_size?: number;
    sort_by?: AdminRecipesSortBy;
    sort_dir?: SortDirection; // istniejący typ
}

export interface AdminRecipeListItemDto {
    id: number;
    name: string;
    author_id: string;
    author_username: string | null;
    author_email: string | null;
    category_name: string | null;
    created_at: string;
    average_rating: number | null;
    ratings_count: number;
    is_grill: boolean;
    is_termorobot: boolean;
}

export interface GetAdminRecipesResponseDto {
    data: AdminRecipeListItemDto[];
    pagination: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        totalItems: number;
    };
    sorting: {
        sort_by: AdminRecipesSortBy;
        sort_dir: SortDirection;
    };
}
```

Zmiana czysto addytywna. Funkcje Deno nie importują z `shared/contracts`, więc te same definicje są zduplikowane w `admin-recipes.types.ts` i **muszą być identyczne** (kontrola w review). `id` jako `number` (`bigint` < 2^53).

---

## 6. Walidacja Zod, serwis, handler, router

### 6.1 `admin-recipes.types.ts`

```ts
import { z } from 'npm:zod@3.22.4';
import { ApplicationError } from '../_shared/errors.ts';
import { logger } from '../_shared/logger.ts';
import { DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE, PositiveIntegerQueryStringSchema, type SortDirection } from './admin.types.ts';

export const ADMIN_RECIPES_SORT_FIELDS = [
    'name', 'author', 'category', 'created_at', 'average_rating', 'ratings_count',
] as const;
export type AdminRecipesSortBy = (typeof ADMIN_RECIPES_SORT_FIELDS)[number];
// + GetAdminRecipesQueryDto, AdminRecipeListItemDto, GetAdminRecipesResponseDto (identyczne z shared/contracts)

export const AdminRecipesQuerySchema = z.object({
    page: PositiveIntegerQueryStringSchema.optional().refine(
        (value) => value === undefined || value <= Number.MAX_SAFE_INTEGER,
        { message: 'page cannot exceed Number.MAX_SAFE_INTEGER' },
    ),
    page_size: PositiveIntegerQueryStringSchema.optional().refine(
        (value) => value === undefined || value <= 100,
        { message: 'page_size cannot exceed 100' },
    ),
    sort_by: z.enum(ADMIN_RECIPES_SORT_FIELDS).optional(),
    sort_dir: z.enum(['asc', 'desc']).optional(),
});

export function validateAdminRecipesQuery(params: URLSearchParams): GetAdminRecipesQueryDto;
```

- Wzorzec identyczny z `validateAdminUsersQuery`: odczyt `params.get(...) ?? undefined`, `safeParse`, usunięcie kluczy `undefined`.
- Błąd → `ApplicationError('VALIDATION_ERROR', DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE)` + `logger.warn('[admin] Invalid admin recipes query params', { issues, rawQuery })` (query nie zawiera danych osobowych).
- **Granice `page` (R1):** `"9007199254740991"` → przechodzi (`Number.MAX_SAFE_INTEGER`); `"9007199254740992"`, `"99999999999999999999"` → `400` (po `Number()` wartość `> MAX_SAFE_INTEGER`; dla bardzo długich łańcuchów `Number()` daje `Infinity`, które odrzuca `Number.isInteger` w `PositiveIntegerQueryStringSchema`); `"3000000000"` → przechodzi (`200` z pustą listą w serwisie/bazie). `page=` (pusty), `page=0`, `page=-1`, `page=abc`, `page=1.5`, `page=1e3`, `page=+1` → `400`.
- Jedyna zmiana w `admin.types.ts`: `export const PositiveIntegerQueryStringSchema`.

### 6.2 `admin-recipes.service.ts`

- `getAdminRecipes({ query, client? }): Promise<GetAdminRecipesResponseDto>`; `client` — opcjonalny wstrzykiwany klient typu `AdminRecipesRpcClient` (`rpc(fn, args) => Promise<{ data: AdminRecipesRpcRow[] | null; error: RpcErrorShape | null }>`), domyślnie `createServiceRoleClient() as unknown as AdminRecipesRpcClient` (jak `admin-ai-credits.service.ts`/`admin.service.ts`).
- Wartości domyślne **tylko dla `undefined`** (`page = 1`, `page_size = 25`, `sort_by = 'created_at'`, `sort_dir = 'desc'`); wartości błędne **nie** są normalizowane (odrzuca je walidacja przed serwisem) — świadoma różnica względem `normalizeAdminUsersQuery`.
- Wywołanie: `client.rpc('admin_get_recipes_page', { p_page_number, p_page_size, p_sort_by, p_sort_dir })` — dokładnie te cztery argumenty; `p_page_number` to zwykły `number` (do `9007199254740991` serializuje się bez utraty precyzji w JSON; PostgREST rzutuje na `bigint`). Brak argumentów dotyczących widoczności/usuniętych.
- `error` → `logger.error('[admin] RPC error while fetching admin recipes', { errorCode, errorMessage, errorDetails, page, pageSize, sortBy, sortDir })` + `ApplicationError('INTERNAL_ERROR', 'Failed to fetch admin recipes')`. **Nie** logować wierszy ani e-maili.
- Mapowanie wierszy:
    - `totalItems = toSafeNonNegativeNumber(rows[0]?.total_items)`; brak wierszy (nie powinno wystąpić dzięki wartownikowi) → `totalItems = 0` + `logger.warn`.
    - wiersze z `id === null` (wartownik) pomijane w `data`; wiersz z `id`, ale bez `name` lub `created_at` → `ApplicationError('INTERNAL_ERROR', 'Invalid admin recipes row received from RPC')`.
    - `id`: `toSafeNonNegativeNumber` (bigint z PostgREST może wrócić jako `number` lub `string`).
    - `average_rating`: `null` → `null`; w przeciwnym razie `Number(value)`; nieskończone/`NaN` → `null`; zaokrąglenie defensywne `Math.round(v * 10) / 10`. Nigdy `0` dla braku ocen.
    - `ratings_count`: `toSafeNonNegativeNumber`; `author_username`/`author_email`/`category_name`: `null` zachowane, puste po `trim` → `null`; `is_grill`/`is_termorobot`: `row.x === true`.
- `toSafeNonNegativeNumber` — **zdublowana** prywatna funkcja w tym pliku (identyczna z `admin.service.ts`; bez refaktoru istniejącego kodu).
- `totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)`; `pagination.currentPage = page` (żądana); `sorting` = faktycznie użyte.

### 6.3 `admin-recipes.handlers.ts`

```ts
export interface AdminRecipesHandlerDeps {
    requireAdmin: (req: Request) => Promise<{ userId: string }>;
    getRecipes: typeof getAdminRecipes;
}

const defaultDeps: AdminRecipesHandlerDeps = {
    requireAdmin: requireAdminContext,
    getRecipes: getAdminRecipes,
};

export async function handleGetAdminRecipes(
    req: Request,
    deps: AdminRecipesHandlerDeps = defaultDeps,
): Promise<Response> {
    try {
        const { userId } = await deps.requireAdmin(req);                     // 1. autoryzacja
        const query = validateAdminRecipesQuery(new URL(req.url).searchParams); // 2. walidacja
        const response = await deps.getRecipes({ query });                   // 3. serwis
        logger.info('[admin] GET /admin/recipes completed', {
            userId,
            query,
            totalItems: response.pagination.totalItems,
        });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}
```

- `createSuccessResponse` — lokalna kopia (3 linie: `new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })`), **bez** importu z `admin.handlers.ts` (unika cyklu `admin.handlers.ts` ↔ `admin-recipes.handlers.ts`).
- Opcjonalny drugi argument `deps` istnieje wyłącznie dla testów (router wywołuje handler z jednym argumentem).
- Logi: tylko `userId` admina, `query` i liczby — **nigdy** e-maile autorów.

### 6.4 Router (`admin.handlers.ts`)

```ts
if (subPath === '/recipes') {
    if (method === 'GET') {
        return handleGetAdminRecipes(req);
    }
    return createMethodNotAllowedResponse(method, 'GET, OPTIONS');
}
```

Wstawić przed `logger.warn('[admin] Unknown admin endpoint', …)`. `createMethodNotAllowedResponse` pozostaje prywatna w `admin.handlers.ts` (używa jej tylko router).

---

## 7. Indeksy i wydajność (bez nowych indeksów — Z5)

- Zapytanie czyta wszystkie przepisy publiczne, agreguje oceny i sortuje w pamięci (`row_number() over (order by …)`) przy każdym żądaniu strony: koszt O(N log N) z kolacją ICU. Dla ~10 tys. wierszy oczekiwane dziesiątki ms; endpoint używany tylko przez adminów.
- Istniejące indeksy (`idx_recipes_name`, `idx_recipes_created_at`, `idx_recipes_deleted_at`) są nieprzydatne dla sortowania po `lower(name collate "pl-x-icu")` i filtra `visibility`; `idx_recipe_ratings_recipe_id` wspiera agregację ocen. **Nowych indeksów nie dodajemy bez dowodu.**
- **Dowód (obowiązkowy):** na lokalnej bazie zasianej ~10 tys. publicznych przepisów (część z ocenami, część bez kategorii/profilu) zmierzyć:
    1. `EXPLAIN (ANALYZE, BUFFERS)` treści zapytania z literałami (`sort_by` × 6; `asc`+`desc` dla `name`, `author`, `average_rating`), strona 1 i strona głęboka;
    2. czas całej funkcji (pętla `clock_timestamp()` ≥ 10 wywołań: plpgsql po kilku wywołaniach może użyć planu ogólnego, w którym `case` na `v_sort_by` nie jest składany stałymi — pomiar z literałami tego nie pokazuje).
- **Próg:** najwolniejszy wariant ≲ 300 ms przy 10 tys. wierszy. Przekroczenie → najpierw wariant `left join lateral` agregatu ocen / `materialized` CTE (bez indeksów); dopiero potem osobna decyzja o indeksach (częściowy `recipes (created_at desc, id) where visibility = 'PUBLIC' and deleted_at is null`, agregat ocen, kolumna sortująca). Wyniki → artefakt review API.

---

## 8. Zależności i wpływ na istniejący kod

- `GET /admin/users` zachowuje działanie: wywołuje `admin_get_users_page` kluczem `service_role` (`createServiceRoleClient()`), który zachowuje `EXECUTE`. Test regresji: pkt 9.4 i 10.
- Brak zmian w RLS, widokach, danych; brak migracji danych.
- Plan `unified-entitlements` (jeszcze niezaimplementowany) zakłada zmianę `admin_get_users_page` — patrz ryzyko R3 w pkt 12.

---

## 9. Testy jednostkowe (`deno test`) — bez E2E

Uruchomienie: `deno test --allow-env --allow-net supabase/functions/admin/` (flagi jak dotychczas; CI **nie** uruchamia `deno test`).

### 9.1 `admin-recipes.types.test.ts` (walidacja)

| Przypadek | Oczekiwanie |
|---|---|
| puste query | `{}` (domyślne uzupełnia serwis) |
| poprawne query `page=2&page_size=10&sort_by=name&sort_dir=asc` | zwrócone bez zmian |
| `page=0`, `page=-1`, `page=abc`, `page=` (pusty), `page=1.5`, `page=1e3` | `VALIDATION_ERROR` |
| **`page=9007199254740991`** | przechodzi (`Number.MAX_SAFE_INTEGER`) |
| **`page=9007199254740992`**, `page=99999999999999999999`, `page=` + 400 cyfr | `VALIDATION_ERROR` |
| **`page=3000000000`** | przechodzi (nie `400`) |
| `page_size=0`, `101`, `abc` | `VALIDATION_ERROR`; `1`, `25`, `50`, `100` przechodzą |
| każdy z 6 `sort_by` | przechodzi |
| `sort_by=visibility`, `updated_at`, `created_at;drop` | `VALIDATION_ERROR` |
| `sort_dir=up` | `VALIDATION_ERROR` |
| brak cichego przywracania domyślnych | błąd rzucany; wynik nigdy nie zawiera domyślnych wartości |
| nieznane parametry (`foo=1`) | ignorowane |

### 9.2 `admin-recipes.service.test.ts` (atrapa klienta RPC)

| Obszar | Przypadki |
|---|---|
| Wywołanie RPC | dokładnie 4 argumenty `p_page_number`, `p_page_size`, `p_sort_by`, `p_sort_dir`; domyślne dla pominiętych; `p_page_number = 3000000000` i `9007199254740991` przekazane bez zmian; brak jakiegokolwiek argumentu widoczności/usuniętych |
| Mapowanie | wiersz pełny → DTO (typy); `average_rating: null` → `null` (nie `0`); `"4.5"` → `4.5`; `4.55`/`4.04` zaokrąglane defensywnie do 1 miejsca; `NaN`/`Infinity` → `null`; `id`, `ratings_count`, `total_items` jako string → liczba; `null` w `author_username`/`author_email`/`category_name` zachowane; puste łańcuchy → `null`; `is_grill: null` → `false` |
| Wartownik | `[ { id: null, …, total_items: 61 } ]` → `data: []`, `totalItems = 61`; pusta tablica `[]` → `totalItems = 0` + `totalPages = 0` |
| Paginacja | `total_items = 61`, `pageSize = 25` → `totalPages = 3`; **strona poza zakresem** (`page = 9`, wartownik, 61) → `data: []`, `totalItems = 61`, `totalPages = 3`, `currentPage = 9`; **`page = 3000000000`** (wartownik) → `200`-owy kształt z poprawnymi licznikami; `totalItems = 0` → `totalPages = 0`; `sorting` = użyte wartości |
| Błędy | `error` z RPC → `ApplicationError('INTERNAL_ERROR', 'Failed to fetch admin recipes')`; wiersz z `id`, bez `created_at` → `INTERNAL_ERROR`; wiersz z `id`, bez `name` → `INTERNAL_ERROR` |

### 9.3 `admin-recipes.handlers.test.ts` (handler przez `deps` i router)

| Obszar | Przypadki |
|---|---|
| Autoryzacja | `requireAdmin` rzuca `UNAUTHORIZED` → `401`; rzuca `FORBIDDEN` → `403`; `getRecipes` **nie** jest wołany |
| **Kolejność** | błędne query (`page_size=0`) + `requireAdmin` rzuca `UNAUTHORIZED`/`FORBIDDEN` → `401`/`403` (nie `400`); błędne query + admin → `400 VALIDATION_ERROR` i `getRecipes` niewołany |
| Sukces | admin + poprawne query → `200`, `Content-Type: application/json`, ciało = odpowiedź serwisu; serwis dostaje zwalidowane query |
| Błąd serwisu | `getRecipes` rzuca `INTERNAL_ERROR` → `500` z `{ code, message }` |
| Router (bez sieci) | `POST /functions/v1/admin/recipes` → `405`, `Allow: GET, OPTIONS`; `GET …/admin/recipes/1` i `…/admin/recipes/` → `404`; `GET …/admin/recipes` bez nagłówka `Authorization` → `401` (wyjątek z `extractAuthToken` przed jakąkolwiek siecią) |

### 9.4 `admin-recipes.rpc-guard.test.ts` (zawsze uruchamiany, bez bazy)

`evaluateLocalDbGuard(url, serviceRoleKey)` → `{ allowed: boolean; reason: string }`. Reguły (twarda blokada, R2):

- parsuj `new URL(url)`; porównuj `hostname` **dokładną równością** z `localhost` lub `127.0.0.1` (nie `includes`/`startsWith`);
- protokół `http:` lub `https:`; brak `username`/`password` w URL;
- `url`/`serviceRoleKey` niepuste;
- każdy inny host (w tym `[::1]`, `0.0.0.0`, `*.supabase.co`, `localhost.evil.com`, `127.0.0.1.nip.io`, `user@localhost`) → `allowed: false`.

Testy: `http://127.0.0.1:54331` ✓, `http://localhost:54331` ✓; `https://abcd.supabase.co` ✗, `http://localhost.evil.com` ✗, `http://127.0.0.1.nip.io` ✗, `http://evil.com/?h=localhost` ✗, `http://localhost@evil.com` ✗, `undefined`, `''`, `not a url` ✗; brak klucza ✗.

### 9.5 `admin-recipes.rpc.test.ts` (opcjonalny, tylko lokalna baza — R2)

**Bramki uruchomienia (wszystkie muszą być spełnione, inaczej test jest `ignore` z komunikatem `console.warn` o powodzie):**

1. `evaluateLocalDbGuard(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')).allowed === true` — liczone **przed** utworzeniem jakiegokolwiek klienta i ponownie (`assertLocal()`) na początku każdego kroku testu (obrona wielowarstwowa; rzuca zamiast kontynuować);
2. lokalna baza odpowiada: `await fetch(new URL('/rest/v1/', url), { headers: { apikey: key }, signal: AbortSignal.timeout(2000) })` na poziomie modułu w `try/catch` (brak odpowiedzi → `ignore`; ciało odpowiedzi anulowane `body?.cancel()`);
3. `Deno.test({ ignore: !allowed || !reachable, sanitizeOps: false, sanitizeResources: false }, …)`.

Status: test ignorowany = **`NIE_WYKONANO`** (nie `PASS`) i obowiązuje weryfikacja manualna z planu wdrożenia (krok 1 pkt 6). Klucze **nie** są wpisywane w kodzie ani dokumentacji; pochodzą ze środowiska (`supabase status`).

**Dane testowe i sprzątanie:**

- Unikalny prefiks `ps204t-<runId>-` (`runId` = 8 znaków hex, małe litery) dla nazw przepisów i nazw użytkowników; e-maile `ps204t-<runId>-<n>@ps204-test.invalid`.
- Autorzy tworzeni `client.auth.admin.createUser({ email, password: <losowe>, email_confirm: true })`; nazwa użytkownika ustawiana `update profiles set username = …` (service role; `profiles.username` ma unikalny indeks po `lower`, 3–50 znaków); „autor bez nazwy" = `username = null`; „autor bez profilu" = usunięcie wiersza `profiles` (FK `recipes.user_id` wskazuje `auth.users`, nie `profiles`). Jeśli `handle_new_user` wymaga metadanych — przekazać je w `user_metadata`.
- Przepisy: wstawiane service role (PUBLIC, PRIVATE, SHARED, PUBLIC z `deleted_at`), oceny w `recipe_ratings` (service role omija RLS i politykę „nie oceniaj własnego").
- **Sprzątanie w `finally` (zawsze):** usunąć przepisy o prefiksie (kaskada usuwa oceny), potem użytkowników (`auth.admin.deleteUser`; `profiles` kaskadowo). Dodatkowo „zamiatanie" na starcie: użytkownicy z domeną `@ps204-test.invalid` pozostali po przerwanym biegu (najpierw ich przepisy, potem konta). Nigdy nie usuwać po innym kryterium.
- Odczyt do asercji: **przejście po wszystkich stronach** (`page_size = 100`, limit bezpieczeństwa 200 stron) i filtrowanie wierszy po prefiksie nazwy — baza lokalna może zawierać inne przepisy; ważna jest **względna kolejność** wierszy testowych (porządek jest całkowity dzięki `id asc`).

**Kroki asercji:**

| Krok | Oczekiwanie |
|---|---|
| Zakres | PRIVATE, SHARED i usunięty PUBLIC nie występują; `total_items` = liczba `recipes` z `visibility = 'PUBLIC' and deleted_at is null` (zapytanie `count` service role) |
| `name` asc/desc | `Czosnek, ćma, lody, Łosoś, sałatka, Śledź, zupa, Żurek`; desc = odwrócona; `Ala`/`ala` obok siebie, rozstrzygnięte `id asc` |
| `author` asc/desc | autorzy z nazwą (`ala`, `Basia`, `Łukasz`, `Zofia`) w polskiej kolejności; bez nazwy i bez profilu **zawsze na końcu** w obu kierunkach, `id asc` |
| `category` asc/desc | bez kategorii na końcu w obu kierunkach; polska kolejność |
| `average_rating` asc/desc | bez ocen na końcu w obu kierunkach (`id asc`); remisy `id asc`; wartość = `recipe_details.average_rating` |
| `ratings_count` asc/desc | asc: `0` na początku; desc: `0` na końcu; remis `id asc` |
| `created_at` asc/desc | rosnąco/malejąco, remis `id asc` |
| Stabilna paginacja | przejście stron 1..N dla każdego `sort_by` bez duplikatów i luk |
| Strona poza zakresem | `page = 3000000000` i `page = 9007199254740991` → jeden wiersz-wartownik (`id` null), `total_items` poprawne (nie `0`, bez błędu `22003`); `page_size = 100` |
| E-mail | wiersze strony mają `author_email`; autor bez e-maila/konta nie gubi wiersza |
| **Uprawnienia (R3)** | klient `anon` (klucz `SUPABASE_ANON_KEY`, jeśli ustawiony) oraz klient zalogowanego użytkownika testowego (`signInWithPassword`): `rpc('admin_get_recipes_page')` i `rpc('admin_get_users_page')` → błąd `42501`/`permission denied`, brak danych; `service_role` → wywołania udane (`admin_get_users_page` zwraca wiersze) |

Krok „uprawnienia" bez `SUPABASE_ANON_KEY` jest pomijany z jawnym komunikatem (i raportowany jako `NIE_WYKONANO` dla tego kroku).

---

## 10. Weryfikacja — komendy i kryteria

| # | Komenda / czynność | Oczekiwanie | Status |
|---|---|---|---|
| 1 | `deno test --allow-env --allow-net supabase/functions/admin/` | wszystkie testy z pkt 9.1–9.4 `PASS`; 9.5 `PASS` albo `NIE_WYKONANO` (jawnie) | `PASS` / `FAIL` |
| 2 | `deno check supabase/functions/admin/index.ts` (jeśli używane w repo) | bez błędów typów | `PASS` / `FAIL` |
| 3 | `supabase db reset` (lokalnie) | migracja przechodzi, strażnik i samosprawdzenie bez wyjątku; funkcja istnieje | `PASS` / `FAIL` |
| 4 | Uprawnienia (SQL poniżej) | `false \| false \| true` dla **obu** funkcji | `PASS` / `FAIL` |
| 5 | Test bazodanowy (pkt 9.5) przeciw lokalnej bazie — PowerShell: `$env:SUPABASE_URL='<adres z supabase status>'; $env:SUPABASE_SERVICE_ROLE_KEY='<klucz lokalny>'; $env:SUPABASE_ANON_KEY='<klucz lokalny>'; deno test --allow-env --allow-net supabase/functions/admin/admin-recipes.rpc.test.ts` | `PASS`; brak lokalnej bazy → `NIE_WYKONANO` + weryfikacja manualna | `PASS` / `NIE_WYKONANO` |
| 6 | Ręcznie lokalnie: `GET /admin/recipes` (kontem admina z `.env.local`): 6 × `sort_by`, `page=3000000000` → `200` pusta lista z poprawnymi licznikami, `page=9007199254740992` → `400`, `page_size=101` → `400`, token `user` → `403`, bez tokenu → `401`, `POST` → `405` | zgodnie z pkt 2 | `PASS` / `FAIL` |
| 7 | Ręcznie lokalnie: **`GET /admin/users`** kontem admina | `200`, lista jak przed zmianą (regresja po `revoke`) | `PASS` / `FAIL` |
| 8 | `POST /rest/v1/rpc/admin_get_users_page` i `…/admin_get_recipes_page` z kluczem `anon` oraz tokenem zwykłego użytkownika | odmowa (`401`/`403`/`42501`), brak danych | `PASS` / `FAIL` |
| 9 | `EXPLAIN (ANALYZE, BUFFERS)` + pętla czasu (pkt 7) | najwolniejszy wariant ≲ 300 ms | `PASS` / `FAIL` |
| 10 | `npm run build` (kontrakty `shared/contracts/types.ts` są importowane przez Angular) | sukces | `PASS` / `FAIL` |

SQL weryfikujący uprawnienia (lokalnie i po wdrożeniu):

```sql
select
    f.fn,
    has_function_privilege('anon', f.fn, 'execute') as anon_can,
    has_function_privilege('authenticated', f.fn, 'execute') as authenticated_can,
    has_function_privilege('service_role', f.fn, 'execute') as service_role_can
from (values
    ('public.admin_get_recipes_page(bigint,integer,text,text)'),
    ('public.admin_get_users_page(integer,integer,text,text)')
) as f(fn);
-- oczekiwane: false | false | true w obu wierszach

select p.proname, p.proacl
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('admin_get_recipes_page', 'admin_get_users_page');
-- proacl nie zawiera wpisu PUBLIC ("=X/...") ani anon / authenticated
```

Jeśli po `db reset` RPC zwraca `PGRST202` (nieodświeżony cache schematu PostgREST), odświeżyć: `notify pgrst, 'reload schema';`.

---

## 11. Kolejność implementacji

1. Migracja (strażnik → funkcja → uprawnienia obu funkcji → samosprawdzenie) + `supabase db reset` + weryfikacja uprawnień i kolacji (kroki 3–4 z pkt 10).
2. Kontrakty `shared/contracts/types.ts`, `database.types.ts` (oba pliki).
3. `admin-recipes.types.ts` (+ `export` w `admin.types.ts`) i testy walidacji.
4. `admin-recipes.service.ts` + testy.
5. `admin-recipes.handlers.ts` + router + testy handlera/routera.
6. `admin-recipes.rpc-guard.ts` + test blokady hosta, następnie `admin-recipes.rpc.test.ts`.
7. README i `test-requests.http`.
8. Weryfikacja z pkt 10 (w tym `GET /admin/users`), pomiar wydajności, zapis wyników w artefakcie review API.

---

## 12. Sprzeczności i ryzyka

### Sprzeczności

| # | Opis | Rozstrzygnięcie |
|---|---|---|
| S1 | Plan API (pkt 4.3) dołącza `auth.users` w `source_rows` (przed sortowaniem); runda pytań przyjęła dołączenie e-maila dopiero dla wierszy strony | Ten plan (pkt 4.3) wygrywa; plan API pkt 4.3 nie był zmieniany w tej turze (zakres edycji ograniczony do punktów 1–3). Zachowanie zewnętrzne jest identyczne |
| S2 | Plan API pkt 3/8 dopuszczał „zdublować lub wyeksportować" `createSuccessResponse` | Zdublować lokalnie (Z4) — eksport z `admin.handlers.ts` stworzyłby cykliczny import |
| S3 | Plan API pkt 8 zakładał `ignore` tylko po obecności `SUPABASE_URL`/`SERVICE_ROLE_KEY` | Zastąpione twardą blokadą hosta (R2) — obecność zmiennych nie wystarcza |

### Ryzyka

| # | Ryzyko | Skutek | Ograniczenie |
|---|---|---|---|
| R1 | Kolacja `pl-x-icu` niedostępna lub sortująca inaczej na produkcji (inna wersja ICU) | `db push` zatrzymany (strażnik) albo kolejność niezgodna z alfabetem w wariancie zastępczym | Strażnik 4.1 + weryfikacja przed merge'em; wariant zastępczy tylko po jawnej akceptacji |
| R2 | Plan ogólny plpgsql (po kilku wywołaniach) wolniejszy od pomiaru z literałami | Zaniżony pomiar wydajności | Pomiar pętlą czasu funkcji (pkt 7), nie tylko `EXPLAIN` z literałami |
| R3 | Przyszła migracja `unified-entitlements` zmieni typ zwracany `admin_get_users_page` przez `drop` + `create` | ACL zresetowane → ponownie `EXECUTE` dla `anon`/`authenticated` (wyciek e-maili) | Każda migracja przebudowująca tę funkcję musi powtórzyć `revoke`/`grant`; dodać uwagę do tamtego planu; test uprawnień (pkt 9.5/10) po każdej takiej migracji |
| R4 | Domyślne uprawnienia Supabase nadają `EXECUTE` nowym funkcjom w `public` dla `anon`/`authenticated` | Wyciek przy każdej nowej funkcji `admin_*` bez `revoke` | Wzorzec `revoke … from public, anon, authenticated` + samosprawdzenie 4.6 |
| R5 | `revoke` na `admin_get_users_page` zepsuje kod wołający ją innym kluczem niż `service_role` | Regresja listy użytkowników | Kod sprawdzony (jedyne wywołanie przez `createServiceRoleClient()`); test regresji `GET /admin/users` (pkt 10, wiersz 7) lokalnie i po wdrożeniu |
| R6 | Test bazodanowy usuwa dane po złym kryterium albo trafia w zdalną bazę | Utrata danych | Blokada hosta (dokładna równość hosta, ponowiona w każdym kroku), unikalny prefiks + domena e-maili `@ps204-test.invalid`, sprzątanie wyłącznie po tych kryteriach |
| R7 | Ignorowany test bazodanowy raportowany jako `PASS` | Fałszywa pewność o kolejności | Status `NIE_WYKONANO` + obowiązkowa weryfikacja manualna (plan wdrożenia, krok 1 pkt 6) |
| R8 | Skala (>~50–100 tys. przepisów publicznych) | Koszt per żądanie rośnie liniowo | Pomiar i rewizja decyzji o indeksach (pkt 7) |
| R9 | `handle_new_user` może wymagać metadanych przy tworzeniu użytkownika testowego | Test seedujący zawodzi | Przekazać `user_metadata`; błąd seedu = `FAIL`/`NIE_WYKONANO` z komunikatem, nie `PASS` |
| R10 | E-mail autora to dana osobowa | Wyciek przez logi lub publiczne RPC | Brak e-maili w logach (przegląd kodu), `revoke` + samosprawdzenie, test uprawnień |
