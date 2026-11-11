# PS-204: Tabela przepisów publicznych w panelu administracyjnym — Plan API

> **User Story:** PS-204 — `PS-204-admin-public-recipes-table-user-story.md`
> **Data:** 11 listopada 2026
> **Dotyczy:** Supabase PostgreSQL (nowa funkcja RPC; odebranie `execute` istniejącej `admin_get_users_page`), Edge Function `admin` (nowy endpoint `GET /admin/recipes`), `shared/contracts/types.ts`
> **Powiązane:** `PS-204-admin-public-recipes-table-ui-plan.md`, `PS-204-admin-public-recipes-table-deployment-plan.md`
> **Wzorzec:** `GET /admin/users` + `public.admin_get_users_page` (`20260410120000_create_admin_get_users_page_rpc.sql`, poprawka `20260410123000_fix_admin_get_users_page_login_text_cast.sql`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Funkcja `public.admin_get_recipes_page(...)` | **Nowa** (migracja) | `security definer`, `set row_security = off`, wykonanie wyłącznie dla `service_role`; zwraca jedną stronę przepisów `PUBLIC` z `deleted_at IS NULL` wraz z autorem, kategorią i agregatami ocen oraz `total_items` |
| `GET /admin/recipes` | **Nowy endpoint** w funkcji `admin` | Walidacja Zod → `requireAdminContext` → RPC → DTO; odpowiedź `{ data, pagination, sorting }` |
| Uprawnienia `public.admin_get_users_page(integer, integer, text, text)` | **Zmiana uprawnień** (ta sama migracja) | `revoke` `execute` od `public`, `anon`, `authenticated`, `grant` tylko dla `service_role`; bez zmiany treści i sygnatury (pkt 4.2) |
| Pliki Edge Function | **Nowe** | `admin-recipes.handlers.ts`, `admin-recipes.service.ts`, `admin-recipes.types.ts` (+ testy `deno test`) |
| `admin.handlers.ts` | Modyfikacja | Gałąź routera `subPath === '/recipes'` (GET, inaczej `405`) |
| `admin.types.ts` | Modyfikacja (minimalna) | Eksport `PositiveIntegerQueryStringSchema` (współdzielony ze schematem przepisów) |
| `shared/contracts/types.ts` | Modyfikacja | `AdminRecipesSortBy`, `GetAdminRecipesQueryDto`, `AdminRecipeListItemDto`, `GetAdminRecipesResponseDto` |
| `supabase/functions/admin/README.md`, `test-requests.http` | Modyfikacja | Opis i przykładowe żądania nowego endpointu |
| `docs/results/project-summary.md` (sekcja 5 „Admin") | Modyfikacja — **dopiero na etapie summary**, nie w implementacji | Wiersz `GET /admin/recipes` |

**Bez zmian:** widok `recipe_details`, tabele i RLS `recipes` / `recipe_ratings` / `profiles` / `categories`, istniejące endpointy `admin`, workflow CI (funkcja `admin` jest już na liście `supabase functions deploy`), dashboard i `GET /admin/summary`. Brak nowych indeksów (pkt 6).

---

## 2. Kontrakt endpointu `GET /admin/recipes`

| Aspekt | Wartość |
|---|---|
| Metoda / URL | `GET /functions/v1/admin/recipes` (router: `subPath === '/recipes'`); inna metoda → `405 METHOD_NOT_ALLOWED` z `Allow: GET, OPTIONS` (CORS `Access-Control-Allow-Methods` w `index.ts` już zawiera `GET`) |
| Autoryzacja | `requireAdminContext(req)` (JWT + `app_role = 'admin'` z tokenu + zgodność `sub` z użytkownikiem Supabase Auth). Kolejność w handlerze: **najpierw autoryzacja, potem walidacja query** (niezalogowany lub nie-admin nie dostaje informacji o poprawności parametrów) |
| Brak ważnego tokenu | `401 UNAUTHORIZED` |
| Rola `user` / `premium` | `403 FORBIDDEN` |
| Walidacja parametrów | `400 VALIDATION_ERROR` (pkt 3), bez cichego przywracania domyślnych |
| Błąd RPC / niespójny wiersz | `500 INTERNAL_ERROR` (`Failed to fetch admin recipes`); szczegóły tylko w logu |
| Ujednolicony błąd | `{ code, message, details }` przez `handleError` (`_shared/errors.ts`) |

### 2.1 Parametry zapytania

| Parametr | Typ | Domyślnie (gdy pominięty) | Reguła |
|---|---|---|---|
| `page` | całkowita ≥ 1 | `1` | `^\d+$`, ≥ 1 i ≤ `Number.MAX_SAFE_INTEGER` (większa → `400`; mniejsza poza zakresem → `200` z pustą listą) |
| `page_size` | całkowita 1..100 | `25` | `^\d+$`, 1..100 (selektor UI oferuje 25 / 50 / 100, API akceptuje każdą wartość 1..100) |
| `sort_by` | enum | `created_at` | `name`, `author`, `category`, `created_at`, `average_rating`, `ratings_count` |
| `sort_dir` | enum | `desc` | `asc`, `desc` |

Nie istnieje parametr zmieniający widoczność ani filtr usuniętych — filtr `PUBLIC` + `deleted_at IS NULL` jest wyłącznie w bazie (założenie 4 historyjki). Nieznane parametry spoza listy są ignorowane (jak w `GET /admin/users`); parametry z listy o błędnej wartości → `400`.

### 2.2 Odpowiedź `200`

```json
{
    "data": [
        {
            "id": 42,
            "name": "Szarlotka",
            "author_id": "1a2b3c4d-....",
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

Zasady:

- `pagination.currentPage` = **żądana** strona (nie ucinana do `totalPages`), `pageSize` i `sorting` = faktycznie użyte wartości (po zastosowaniu domyślnych dla pominiętych parametrów).
- `totalItems` = liczba wszystkich przepisów publicznych niezależnie od strony; `totalPages = totalItems === 0 ? 0 : ceil(totalItems / pageSize)`.
- **Strona poza zakresem** (`page > totalPages`, `totalItems > 0`): `200`, `data: []`, poprawne `totalItems` / `totalPages` (scenariusz 11d, przypadek brzegowy 3). Różnica względem `admin_get_users_page`, gdzie `total_items` jest tylko kolumną wierszy strony i przy pustej stronie wraca `0`.
- `average_rating`: `number` z 1 miejscem po przecinku albo `null` (bez ocen); nigdy `0` ani `NaN`.
- `ratings_count`: liczba całkowita ≥ 0.
- `author_username`: `null` gdy brak profilu lub nazwa pusta (po `btrim`); `author_email`: `null` gdy brak konta/e-maila. Reguły zastępcze tekstu („Brak nazwy użytkownika", skrócone ID) realizuje UI (jak w liście użytkowników) — API zwraca surowe dane i `author_id`.
- `category_name`: `null` bez kategorii.
- Nie ma pola `visibility` ani `updated_at` (decyzje 7–8 historyjki).
- E-mail autora jest daną osobową: nie logować go (w logach tylko `userId` admina, `query`, liczby).

---

## 3. Walidacja (Zod) — `admin-recipes.types.ts`

```ts
export const ADMIN_RECIPES_SORT_FIELDS = [
    'name', 'author', 'category', 'created_at', 'average_rating', 'ratings_count',
] as const;
export type AdminRecipesSortBy = (typeof ADMIN_RECIPES_SORT_FIELDS)[number];

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

- Identyczny wzorzec jak `validateAdminUsersQuery` (odczyt `params.get(...) ?? undefined`, `safeParse`, usunięcie kluczy `undefined`).
- Błąd → `ApplicationError('VALIDATION_ERROR', 'Nieprawidlowe parametry paginacji lub sortowania.')` (stała `DEFAULT_BAD_ADMIN_USERS_QUERY_MESSAGE` z `admin.types.ts` może zostać użyta ponownie lub zdublowana jako `DEFAULT_BAD_ADMIN_RECIPES_QUERY_MESSAGE`), `logger.warn` z `issues` i surowym query (bez danych osobowych — query nie zawiera ich).
- Pusty łańcuch (`page=`) jest błędem (regex `^\d+$` po `trim`) — `400`.
- Lokalne typy `GetAdminRecipesQueryDto` itp. są zdefiniowane w `admin-recipes.types.ts` (funkcje Deno nie importują z `shared/contracts`, jak `admin.types.ts`); definicje muszą być **identyczne** z `shared/contracts/types.ts` (pkt 5).

### Różnica względem `getAdminUsers` (świadoma)

`normalizeAdminUsersQuery` w serwisie użytkowników po cichu koryguje błędne wartości. Serwis przepisów **nie normalizuje** wartości błędnych (walidacja je odrzuca przed serwisem) — uzupełnia tylko `undefined` wartościami domyślnymi (`page = 1`, `page_size = 25`, `sort_by = 'created_at'`, `sort_dir = 'desc'`). Fallback w SQL (pkt 4.2) jest wyłącznie drugą linią obrony przed bezpośrednim wywołaniem RPC.

---

## 4. Migracja — funkcja `admin_get_recipes_page`

**Plik:** `supabase/migrations/20261111120000_create_admin_get_recipes_page_rpc.sql`
(znacznik większy od ostatniej migracji `20261109120000_create_user_recipe_notes.sql`; przed merge'em sprawdzić `supabase migration list` — patrz plan wdrożenia).

### 4.1 Strażnik dostępności kolacji (decyzja 16)

Na początku migracji:

```sql
do $$
begin
    if not exists (select 1 from pg_collation where collname = 'pl-x-icu') then
        raise exception
            'PS-204: collation "pl-x-icu" is not available in this database; use the fallback migration variant (lower() + default collation) and document the limitation';
    end if;
end;
$$;
```

Cel: migracja **głośno** zawodzi (cała transakcja migracji jest wycofana), zamiast po cichu zastosować inną kolejność. Weryfikacja dostępności lokalnie i na produkcji jest krokiem **przed merge'em** (plan wdrożenia, krok 1).

**Wariant zastępczy** (stosowany tylko, gdy kolacji brak w którymkolwiek środowisku): usunąć strażnika i we wszystkich wyrażeniach sortowania zastąpić `lower(x collate "pl-x-icu")` przez `lower(x)`; w historyjce (Otwarte kwestie, przypadek brzegowy 16) i w planie wdrożenia odnotować ograniczenie (kolejność znaków diakrytycznych zależy od kolacji domyślnej bazy). Decyzję podejmuje właściciel produktu po wyniku weryfikacji; implementer **nie przełącza** wariantu samodzielnie.

### 4.2 Sygnatura i zabezpieczenia

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
as $$ ... $$;

revoke all on function public.admin_get_recipes_page(bigint, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_recipes_page(bigint, integer, text, text)
    to service_role;

-- istniejąca funkcja: wyłącznie uprawnienia, bez zmiany treści i sygnatury
revoke all on function public.admin_get_users_page(integer, integer, text, text)
    from public, anon, authenticated;
grant execute on function public.admin_get_users_page(integer, integer, text, text)
    to service_role;
```

- **`revoke ... from public, anon, authenticated` jest obowiązkowe** dla obu funkcji: nowej `admin_get_recipes_page` oraz istniejącej `admin_get_users_page`, która dotąd miała tylko `grant ... to service_role` (jej faktyczna sygnatura `(integer, integer, text, text)` pochodzi z migracji `20260410120000` + poprawki `20260410123000`; jedyne wywołanie w kodzie to `createServiceRoleClient()` w `admin.service.ts`, więc panel nie zmienia działania). Funkcja `security definer` z `row_security = off` czyta e-maile z `auth.users`; domyślnie `PUBLIC` ma `EXECUTE`, a Supabase dodatkowo nadaje `EXECUTE` rolom `anon` / `authenticated` dla nowych funkcji w `public` — bez `revoke` każdy zalogowany (a nawet gość) mógłby wywołać `/rest/v1/rpc/admin_get_recipes_page` i pobrać e-maile autorów. Wymaganie niefunkcjonalne historyjki: „funkcja bazy dostępna tylko dla `service_role`".
- Rzutowania typów: `au.email::text` (auth.users.email to `varchar` — patrz poprawka `20260410123000_fix_admin_get_users_page_login_text_cast.sql`), `r.name::text`, `c.name::text`.
- Numer strony jest 64-bitowy (`bigint`), bo przy `integer` wartość np. `page = 3000000000` (dozwolona przez walidację) powodowała błąd przepełnienia (`500`) w obliczeniu przesunięcia. `v_page_number` i `v_offset` są typu `bigint`; `v_offset := (v_page_number - 1) * v_page_size::bigint` (maks. `Number.MAX_SAFE_INTEGER × 100` mieści się w `bigint`).
- Normalizacja wejścia (druga linia obrony, jak w funkcji użytkowników): `v_page_number := least(greatest(coalesce(p_page_number,1),1), 9007199254740991)` (`bigint`), `v_page_size := least(greatest(coalesce(p_page_size,25),1),100)`, `v_sort_by` spoza allowlisty → `'created_at'`, `v_sort_dir` spoza `asc/desc` → `'desc'`.

### 4.3 Zapytanie

Jedno zapytanie (spójna migawka danych dla listy i licznika):

```sql
return query
with ratings_agg as (
    select
        rr.recipe_id,
        count(*)::bigint as ratings_count,
        round(avg(rr.rating)::numeric, 1) as average_rating   -- ta sama formuła co recipe_details
    from public.recipe_ratings rr
    group by rr.recipe_id
),
source_rows as (
    select
        r.id,
        r.name::text as name,
        r.user_id as author_id,
        nullif(btrim(p.username), '') as author_username,
        au.email::text as author_email,
        c.name::text as category_name,
        r.created_at,
        ra.average_rating,                                    -- NULL bez ocen
        coalesce(ra.ratings_count, 0)::bigint as ratings_count,
        r.is_grill,
        r.is_termorobot
    from public.recipes r
    left join public.categories c on c.id = r.category_id
    left join public.profiles p on p.id = r.user_id
    left join auth.users au on au.id = r.user_id
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
        row_number() over (order by <ORDER BY — pkt 4.4>) as rn
    from source_rows sr
)
select
    rk.id, rk.name, rk.author_id, rk.author_username, rk.author_email, rk.category_name,
    rk.created_at, rk.average_rating, rk.ratings_count, rk.is_grill, rk.is_termorobot,
    t.total_items
from total t
left join ranked rk
    on rk.rn > v_offset and rk.rn <= v_offset + v_page_size
order by rk.rn nulls last;
```

Kluczowe własności:

- **Licznik osobny od strony.** `total` liczy `source_rows` (przepisy publiczne) bez względu na `offset`. Dzięki `left join` na `total`:
    - strona w zakresie → do `v_page_size` wierszy, każdy z `total_items`;
    - strona poza zakresem (`totalItems > 0`) lub brak przepisów → **dokładnie jeden wiersz „wartownik"** z `id IS NULL` (i pozostałymi polami `NULL`) oraz poprawnym `total_items` (`0` przy braku przepisów).
  Serwis odrzuca wiersze z `id IS NULL` jako dane, ale odczytuje z nich `total_items`. (Alternatywa — dwa wywołania RPC — odrzucona: różne migawki danych, dwa round-tripy.)
- **Agregacja ocen** identyczna z `recipe_details` (`round(avg(rating)::numeric, 1)`, `count(*)`, `NULL` bez ocen), liczona raz `group by recipe_id` i dołączana `left join` — bez korelowanych podzapytań na wiersz; wykorzystuje `idx_recipe_ratings_recipe_id (recipe_id) include (rating)`. Widok `recipe_details` nie jest używany ani zmieniany.
- Filtr `visibility = 'PUBLIC' and deleted_at is null` jest stałą w treści funkcji — brak parametru go zmieniającego.
- `left join` na `profiles` i `auth.users`: przepis bez profilu / bez konta nie znika z listy (przypadek brzegowy 9). Dodatkowo `username` sprowadzane do `NULL`, gdy pusty po `btrim` (constraint `profiles` wymaga ≥ 3 znaków, więc to wyłącznie zabezpieczenie).
- `category_id` jest opcjonalne → `left join categories`.

### 4.4 Porządek sortowania (jeden `ORDER BY` w funkcji okna `row_number()`)

Technika `case when v_sort_by = ... then ... end asc/desc` jak w `admin_get_users_page`. Dla tekstu: `lower(<kolumna> collate "pl-x-icu")` — `lower` z argumentem w kolacji ICU stosuje odwzorowanie wielkości liter ICU (niezależne od `LC_CTYPE` bazy, co jest istotne dla `Ł→ł`, `Ś→ś`), a porównanie odbywa się w polskiej kolejności; wielkość liter jest już zredukowana, więc remis `Ala`/`ala` rozstrzyga `id`.

| `sort_by` | Kolejność kluczy (kierunek `asc` / `desc` dotyczy tylko oznaczonego klucza) |
|---|---|
| `name` | `lower(name collate "pl-x-icu")` **dir** → `id asc` |
| `author` | `(author_username is null)::int asc` (bez nazwy zawsze na końcu, **niezależnie od kierunku**) → `lower(author_username collate "pl-x-icu")` **dir** → `id asc` (w grupie bez nazwy pozostaje tylko `id asc`) |
| `category` | `(category_name is null)::int asc` → `lower(category_name collate "pl-x-icu")` **dir** → `id asc` |
| `created_at` | `created_at` **dir** → `id asc` |
| `average_rating` | `(average_rating is null)::int asc` (bez ocen zawsze na końcu) → `average_rating` **dir** (wartość zaokrąglona) → `id asc` |
| `ratings_count` | `ratings_count` **dir** (zwykła liczba, `0` nie jest przesuwane) → `id asc` |

Ostatnim kluczem **zawsze** jest `sr.id asc` (stabilna paginacja, scenariusz 4 i przypadek brzegowy 6; w przeciwieństwie do listy użytkowników **nie** `created_at desc`).

Wymagane zachowanie po wdrożeniu (do sprawdzenia testem DB / ręcznie, pkt 8):

- `sort_by=name`: `ćma` po `Czosnek`, `Łosoś` po `lody`, `Śledź` po `sałatka`, `Żurek` po `zupa`; `Ala` i `ala` obok siebie, rozstrzygnięte `id`.
- `sort_by=average_rating&sort_dir=asc|desc`: przepisy z `NULL` na końcu w obu kierunkach, w kolejności `id asc`.
- `sort_by=ratings_count&sort_dir=asc`: przepisy z `0` ocen na początku; `desc`: na końcu.
- `sort_by=author`: autorzy z `author_username IS NULL` zawsze na końcu, `id asc`.

### 4.5 Komentarz i rollback

```sql
comment on function public.admin_get_recipes_page(bigint, integer, text, text) is
'Returns one page of PUBLIC, non-deleted recipes for the admin panel with author, category and rating aggregates. total_items is returned even for out-of-range pages (sentinel row with id = NULL). Executable by service_role only.';
```

Rollback: `drop function if exists public.admin_get_recipes_page(bigint, integer, text, text);` (funkcja nowa, nic od niej nie zależy; szczegóły w planie wdrożenia). Odebranych uprawnień `admin_get_users_page` **nie** przywracamy przy rollbacku (przywrócenie otworzyłoby odczyt e-maili przez publiczne API bazy; panel działa na `service_role`).

---

## 5. Kontrakty — `shared/contracts/types.ts`

Dodać obok `AdminUsersSortBy` / `GetAdminUsersResponseDto` (około linii 764–815):

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

Zmiana jest czysto addytywna (brak wpływu na istniejące DTO). `id` jako `number` — spójnie z pozostałymi DTO przepisów (`bigint` < 2^53).

---

## 6. Serwis i handler Edge Function

### 6.1 `admin-recipes.service.ts`

- `getAdminRecipes({ query, client? }): Promise<GetAdminRecipesResponseDto>` — opcjonalny wstrzykiwany klient (domyślnie `createServiceRoleClient()`), jak w `admin-ai-credits.service.ts`, co umożliwia `deno test` z atrapą.
- Uzupełnia wartości domyślne **tylko dla `undefined`** (pkt 3).
- `client.rpc('admin_get_recipes_page', { p_page_number, p_page_size, p_sort_by, p_sort_dir })`.
- `error` → `logger.error('[admin] RPC error while fetching admin recipes', { errorCode, errorMessage, errorDetails, page, pageSize, sortBy, sortDir })` + `ApplicationError('INTERNAL_ERROR', 'Failed to fetch admin recipes')`.
- Mapowanie wierszy:
    - `totalItems = toSafeNonNegativeNumber(rows[0]?.total_items)`; brak wierszy w odpowiedzi (nie powinno się zdarzyć dzięki wartownikowi) → `totalItems = 0` + `logger.warn`.
    - wiersze z `id === null` (wartownik) są pomijane w `data`.
    - wiersz z `id` i bez `created_at` lub `name` → `ApplicationError('INTERNAL_ERROR', 'Invalid admin recipes row received from RPC')`.
    - `average_rating`: `null` → `null`; w przeciwnym razie `Number(value)`, wynik nieskończony/`NaN` → `null` (nigdy `0`/`NaN`); wartość zaokrąglić defensywnie do 1 miejsca (`Math.round(v * 10) / 10`).
    - `ratings_count`, `total_items`: `bigint` z PostgREST może wrócić jako `number` lub `string` → `toSafeNonNegativeNumber` (analogicznie do `admin.service.ts`; funkcję wydzielić do współdzielonego pliku lub zdublować w nowym serwisie — bez refaktoru istniejącego kodu).
    - `author_username` / `author_email` / `category_name`: `null` zachowane; puste łańcuchy po `trim` → `null`.
    - `is_grill`, `is_termorobot`: `row.x === true`.
- `totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize)`.
- `pagination.currentPage = page` (żądana), `sorting` = faktycznie użyte.

### 6.2 `admin-recipes.handlers.ts`

```ts
export async function handleGetAdminRecipes(req: Request): Promise<Response> {
    try {
        const { userId } = await requireAdminContext(req);
        const query = validateAdminRecipesQuery(new URL(req.url).searchParams);
        const response = await getAdminRecipes({ query });
        logger.info('[admin] GET /admin/recipes completed', { userId, query, totalItems: response.pagination.totalItems });
        return createSuccessResponse(response);
    } catch (error) {
        return handleError(error);
    }
}
```

`createSuccessResponse` jest dziś prywatna w `admin.handlers.ts` — wyeksportować ją lub zdublować jak w `admin-ai-credits.handlers.ts` (sprawdzić, którą metodę ten plik stosuje, i zachować spójność). `index.ts` bez zmian (CORS i router już obsługują `GET`).

### 6.3 Router (`admin.handlers.ts`)

```ts
if (subPath === '/recipes') {
    if (method === 'GET') return handleGetAdminRecipes(req);
    return createMethodNotAllowedResponse(method, 'GET, OPTIONS');
}
```

Dodać przed `logger.warn('[admin] Unknown admin endpoint', ...)`. `/recipes/{cokolwiek}` → `404 NOT_FOUND` (istniejące zachowanie routera dla nieznanych ścieżek).

---

## 7. Indeksy, wydajność i ryzyko skali (rząd ~10 tys. przepisów publicznych)

### 7.1 Stan istniejących indeksów (`20251125120600_create_indexes.sql`)

| Indeks | Przydatność dla tej funkcji |
|---|---|
| `idx_recipes_created_at (created_at desc)` | Możliwy dla domyślnego sortowania, ale przy filtrze `visibility = 'PUBLIC'` planer przy ~10 tys. wierszy i tak wybierze pełny skan + sortowanie w pamięci |
| `idx_recipes_deleted_at (deleted_at) where deleted_at is null` | Praktycznie nieselektywny (większość przepisów nieusuniętych) |
| `idx_recipes_name (name)` | **Nieużywalny** — sortowanie po `lower(name collate "pl-x-icu")` wymaga innego wyrażenia |
| `idx_recipes_user_id`, `idx_recipes_category_id` | Wspierają joiny, ale przy pełnym skanie planer użyje hash joinów |
| **Brak indeksu na `recipes(visibility)`** | Filtr `visibility = 'PUBLIC'` to skan sekwencyjny po `recipes` (akceptowalne w skali ~10 tys.) |
| `idx_recipe_ratings_recipe_id (recipe_id) include (rating)` | Wspiera agregację ocen (index-only scan) |

### 7.2 Decyzja i ocena kosztu

**Nie dodajemy nowych indeksów** (decyzja z rund pytań: bez dowodu). Zapytanie czyta wszystkie przepisy publiczne, dołącza agregat ocen i sortuje w pamięci (`row_number() over (order by ...)` na ~10 tys. wierszy) przy **każdym** żądaniu strony — to świadomy koszt O(N log N) z polską kolacją ICU (wolniejszą od porównań bajtowych). Dla ~10 tys. wierszy oczekiwany czas rzędu kilkudziesięciu milisekund; endpoint jest używany wyłącznie przez administratorów (niski ruch).

### 7.3 Dowód wydajności (obowiązkowy krok weryfikacji)

Na lokalnej bazie zasianej ~10 tys. publicznych przepisów (część z ocenami, część bez kategorii / bez profilu) lub na kopii produkcyjnej wykonać `EXPLAIN (ANALYZE, BUFFERS)` zapytania funkcji dla każdego z sześciu `sort_by` (oba kierunki dla `name`, `average_rating`) i wpisać wyniki do `docs/results/new-features/user-stories/PS-204/PS-204-verification.md` (jeśli powstanie) lub do review API. **Próg decyzyjny:** jeśli najwolniejszy wariant przekracza ~300 ms przy 10 tys. wierszy, zaproponować (w osobnej decyzji, nie w tej historyjce):

1. indeks częściowy `create index ... on public.recipes (created_at desc, id) where visibility = 'PUBLIC' and deleted_at is null` (dla domyślnego sortowania),
2. zmaterializowany agregat ocen lub kolumny pomocnicze,
3. sortowanie wstępnie znormalizowane (kolumna generowana z `lower(name)` + indeks z kolacją).

Ryzyko skali wpisane jest również do planu wdrożenia. Powyżej ~50–100 tys. przepisów publicznych koszt per-żądanie rośnie liniowo — wtedy wymagana jest rewizja decyzji o indeksach.

---

## 8. Testy (`deno test`) — plan

Plik(i): `supabase/functions/admin/admin-recipes.types.test.ts`, `admin-recipes.service.test.ts`, `admin-recipes.handlers.test.ts` (jeśli handler da się wywołać z atrapą autoryzacji; w przeciwnym razie pokrycie `401`/`403` przez test `requireAdminContext` z atrapami, jak istniejące wzorce).

| Obszar | Przypadki |
|---|---|
| Walidacja (`validateAdminRecipesQuery`) | puste query → `{}`; poprawne query przechodzi; `page=0`, `page=-1`, `page=abc`, `page=` → `VALIDATION_ERROR`; `page=9007199254740991` i `page=3000000000` przechodzą, `page=9007199254740992` → `VALIDATION_ERROR`; `page_size=0`, `page_size=101`, `page_size=abc` → `VALIDATION_ERROR`; `page_size=1` i `page_size=100` przechodzą (granice 1..100); `page_size=25|50|100` przechodzą; `sort_by=visibility`, `sort_by=updated_at`, `sort_by=created_at;drop` → `VALIDATION_ERROR`; każdy z 6 `sort_by` przechodzi; `sort_dir=up` → `VALIDATION_ERROR`; brak cichego przywracania domyślnych (wynik walidacji nie zawiera domyślnych, a błąd jest rzucany) |
| Serwis — mapowanie | wiersz pełny → DTO (typy, `average_rating` jako `number`); `average_rating: null` → `null` (nie `0`); `average_rating` jako string `"4.5"` → `4.5`; `ratings_count`/`total_items` jako string → liczba; `author_username: null`, `author_email: null`, `category_name: null` zachowane; `id: null` (wartownik) → `data: []` i `totalItems` z wiersza; niepoprawny wiersz (brak `created_at`) → `INTERNAL_ERROR`; `error` z RPC → `INTERNAL_ERROR`; wywołanie RPC z parametrami `p_page_number`, `p_page_size`, `p_sort_by`, `p_sort_dir` oraz domyślnymi dla pominiętych |
| Serwis — paginacja | `totalItems = 61`, `pageSize = 25` → `totalPages = 3`; **strona poza zakresem** (`page = 9`, wiersz-wartownik z `total_items = 61`) → `data: []`, `totalItems = 61`, `totalPages = 3`, `currentPage = 9`; `totalItems = 0` → `totalPages = 0`; `sorting` zawiera faktycznie użyte wartości |
| Autoryzacja | brak/niepoprawny token → `401`; rola `user`/`premium` → `403`; `admin` → `200` (test `requireAdminContext` z atrapami lub handlera) |
| Bezpieczeństwo zakresu | atrapa RPC zawiera wyłącznie wywołanie `admin_get_recipes_page` (brak parametrów widoczności/usuniętych); test sprawdza, że serwis nie przekazuje żadnego parametru poza czterema dozwolonymi |
| Router | `GET /admin/recipes` → handler; `POST /admin/recipes` → `405` z `Allow: GET, OPTIONS`; `GET /admin/recipes/1` → `404` |
| **Reguły SQL (kolejność)** | Atrapy klienta **nie sprawdzają** `ORDER BY`. Reguły: „bez ocen na końcu", „autor bez nazwy na końcu", „pusta kategoria na końcu", polska kolejność, `ratings_count` jak liczba, stabilny remis `id asc` — wymagają bazy. Plan: opcjonalny test `admin-recipes.rpc.test.ts` uruchamiany **wyłącznie**, gdy `SUPABASE_URL` wskazuje `localhost` / `127.0.0.1` (twarda blokada: host porównywany dokładnie po sparsowaniu adresu; każdy inny host → test ignorowany, bez żadnego połączenia) i lokalna baza odpowiada; względem **lokalnego** Supabase: zasiewa unikalnie nazwane przepisy publiczne (prefiks testowy), wywołuje `rpc('admin_get_recipes_page', ...)` dla kombinacji sortowań i porządkuje po sobie. Gdy lokalna baza nie działa, status tych przypadków = `NIE_WYKONANO` (nie `PASS`) i obowiązuje weryfikacja manualna z planu wdrożenia (krok 1, pkt 6). Test polskiej kolejności jest wykonywany tylko, gdy `pl-x-icu` jest dostępna (zapytanie do `pg_collation` przez RPC pomocnicze lub pominięcie testu z jawnym komunikatem) |

Wszystkie testy to testy jednostkowe/`deno test`; **bez E2E**.

---

## 9. Dokumentacja towarzysząca (implementacja)

- `supabase/functions/admin/README.md` — wiersz tabeli endpointów: `GET /admin/recipes` (parametry, kody błędów, kształt odpowiedzi, zasada „sentinel").
- `supabase/functions/admin/test-requests.http` — przykładowe żądania: domyślne, każdy `sort_by`, `page_size=100`, błędne parametry (`400`), brak tokenu (`401`), token `user` (`403`).
- Podsumowanie (`docs/results/project-summary.md`, sekcja 5 i 4) aktualizowane **dopiero po akceptacji review** (etap summary), z wzmianką o funkcji `admin_get_recipes_page`.

---

## 10. Uwagi i ryzyka dla implementera

1. **`revoke`/`grant` funkcji** (pkt 4.2) — krytyczne dla prywatności e-maili; zweryfikować w bazie dla **obu** funkcji: `select has_function_privilege('anon', 'public.admin_get_recipes_page(bigint,integer,text,text)', 'execute');` → `false` (analogicznie `authenticated`), `service_role` → `true`; to samo dla `public.admin_get_users_page(integer,integer,text,text)`.
2. **Uprawnienia `admin_get_users_page`:** istniejąca funkcja nie miała `revoke` dla `public/anon/authenticated`, więc była wywoływalna przez PostgREST przez zwykłego zalogowanego użytkownika (wyciek `auth.users.email`). Migracja PS-204 odbiera jej te uprawnienia (pkt 4.2), bez zmiany treści i sygnatury; wymagane potwierdzenie braku regresji `GET /admin/users` (wywołuje ją klucz `service_role`).
3. **Kolacja** — migracja zawiera strażnika (pkt 4.1); brak `pl-x-icu` blokuje `db push`, co jest zamierzone.
4. **Typy `bigint`/`numeric` w PostgREST** — nie zakładać typu `number`; mapowanie defensywne (pkt 6.1).
5. **Kolizje nazw w plpgsql** — nazwy kolumn wyjściowych (`id`, `name`, `created_at`, `average_rating`, `ratings_count`, `is_grill`…) są zmiennymi OUT funkcji; **każde** odwołanie do kolumny w zapytaniu musi być kwalifikowane aliasem tabeli/CTE (jak w `admin_get_users_page`), inaczej `column reference "id" is ambiguous`.
6. **Regeneracja `database.types.ts`** — jeśli `supabase gen types` jest częścią procesu, nowa funkcja pojawi się w `_shared/database.types.ts`; nie jest to wymagane do działania (serwis używa rzutowanego klienta RPC jak `admin.service.ts`).
