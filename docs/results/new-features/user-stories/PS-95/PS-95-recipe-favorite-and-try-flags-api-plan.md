# PS-95: Osobiste flagi przepisu „Ulubiony" i „Chcę wypróbować" — Plan API

> **User Story:** PS-95 — Osobiste flagi przepisu „Ulubiony" (serduszko) i „Chcę wypróbować"
> **Data:** październik 2026
> **Dotyczy:** Supabase PostgreSQL (nowa tabela, RPC, RLS) oraz Edge Functions `recipes`, `public`, `explore`, `collections`
> **Powiązane:** `PS-95-recipe-favorite-and-try-flags-user-story.md`, `PS-95-recipe-favorite-and-try-flags-ui-plan.md`, `PS-95-recipe-favorite-and-try-flags-deployment-plan.md`

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Tabela `user_recipe_flags` | **Nowa** | Osobiste flagi użytkownika per przepis (`is_favorite`, `is_want_to_try`), klucz `(user_id, recipe_id)`, RLS tylko dla właściciela |
| RPC `set_recipe_flags` | **Nowa** | Atomowa, idempotentna aktualizacja częściowa flag; usuwa wiersz, gdy obie flagi są `false` |
| `PUT /recipes/{id}/flags` | **Nowy endpoint** | Ustawienie / zdjęcie flag (aktualizacja częściowa), odpowiedź `200` ze stanem obu flag |
| `GET /recipes/{id}` | Modyfikacja | Dodanie `is_favorite`, `is_want_to_try` |
| `GET /explore/recipes/{id}` | Modyfikacja | Dodanie `is_favorite`, `is_want_to_try` (tylko zalogowany). **To jest endpoint, z którego korzysta widok `/explore/recipes/:id-:slug`** |
| `GET /public/recipes/{id}` | Modyfikacja | Dodanie `is_favorite`, `is_want_to_try` (tylko zalogowany) oraz poprawka nagłówka `Cache-Control` (patrz pkt 4.4) |
| `GET /recipes`, `GET /recipes/feed` | Modyfikacja | Dodanie `is_favorite` w elementach listy (zasila „Moje przepisy" i dashboard) |
| `GET /public/recipes`, `GET /public/recipes/feed` | Modyfikacja | Dodanie `is_favorite` w elementach listy (tylko zalogowany; zasila `/explore` i landing) |
| `GET /collections/{id}` | Modyfikacja | Dodanie `is_favorite` w przepisach kolekcji |
| Pomocnik `_shared/recipe-flags.ts` | **Nowy** | Jedno zapytanie zbiorcze o flagi dla listy ID (zamiast kolejnej kopii `getRecipeIdsInPlan`) |
| Typy w `shared/contracts/types.ts` | Modyfikacja | Opcjonalne pola flag w DTO, nowe `RecipeFlagsDto` i `UpdateRecipeFlagsCommand` |

**Bez zmian:**

- `GET /dashboard/summary` — **taki endpoint nie istnieje w kodzie** (brak funkcji `dashboard`). Ostatnie przepisy na dashboardzie pochodzą z `GET /recipes` (`pages/dashboard/services/recipes.service.ts`), więc wystarczy zmiana listy `GET /recipes`.
- `GET /search/global`, `GET /collections/{id}/recipes` (Sidebar), `GET /plan`, `GET /shopping-list` — flagi nie są tam prezentowane.
- Tabela `recipes`, widok `recipe_details`, RPC `get_recipes_list`, `search_vector`, joby normalizacji składników — **bez modyfikacji** (flagi są w osobnej tabeli, więc zmiana flagi nie dotyka `recipes.updated_at`; scenariusz 17).
- Workflow `.github/workflows/main-deploy.yml` — endpoint jest w istniejącej funkcji `recipes`, więc nie trzeba dodawać nowego kroku `supabase functions deploy`.

---

## 2. Model danych — migracja

**Plik:** `supabase/migrations/20261010120000_create_user_recipe_flags.sql`
(znacznik czasu musi być **większy** od ostatniej migracji `20261009211500`, inaczej `supabase db push` odrzuci migrację jako „out of order").

```sql
-- Migration: Create user_recipe_flags
-- Description: Personal per-user recipe flags ("favorite", "want to try")
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.user_recipe_flags (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    is_favorite boolean not null default false,
    is_want_to_try boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_recipe_flags_pkey primary key (user_id, recipe_id),
    -- Wiersz istnieje tylko wtedy, gdy ustawiona jest co najmniej jedna flaga
    constraint user_recipe_flags_at_least_one_flag
        check (is_favorite or is_want_to_try)
);

-- Indeks pod ON DELETE CASCADE z recipes oraz zapytania po recipe_id
create index idx_user_recipe_flags_recipe_id
    on public.user_recipe_flags (recipe_id);

-- Indeks pod przyszłe filtrowanie "Ulubione" (osobna historyjka); tani, więc dodany od razu
create index idx_user_recipe_flags_user_favorite
    on public.user_recipe_flags (user_id, recipe_id)
    where is_favorite;

create trigger set_user_recipe_flags_updated_at
    before update on public.user_recipe_flags
    for each row
    execute function public.handle_updated_at();

-- ==================================================================================
-- RLS: tylko właściciel flag; zapis wymaga widocznego przepisu
-- ==================================================================================

alter table public.user_recipe_flags enable row level security;

revoke all on table public.user_recipe_flags from anon;

create policy "authenticated users can select own recipe flags"
    on public.user_recipe_flags
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe flags"
    on public.user_recipe_flags
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_flags.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

create policy "authenticated users can update own recipe flags"
    on public.user_recipe_flags
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_flags.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

-- DELETE bez warunku widoczności przepisu: użytkownik zawsze może wyczyścić własną flagę
create policy "authenticated users can delete own recipe flags"
    on public.user_recipe_flags
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.user_recipe_flags is
    'Personal per-user recipe flags (favorite / want to try); visible only to the owner of the flag';
comment on column public.user_recipe_flags.is_favorite is
    'Recipe marked as favorite by the user (heart)';
comment on column public.user_recipe_flags.is_want_to_try is
    'Recipe marked by the user as "want to try"';

-- ==================================================================================
-- RPC: set_recipe_flags (security invoker — działa w kontekście JWT użytkownika)
-- ==================================================================================
-- Kolumny wyjściowe mają prefiks out_, aby uniknąć niejednoznaczności z kolumnami
-- tabeli (wcześniej w repo: 20260804210000_fix_admin_update_user_role_ambiguous_columns).

create or replace function public.set_recipe_flags(
    p_recipe_id bigint,
    p_is_favorite boolean default null,
    p_is_want_to_try boolean default null
)
returns table (
    out_recipe_id bigint,
    out_is_favorite boolean,
    out_is_want_to_try boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_current_favorite boolean;
    v_current_want_to_try boolean;
    v_next_favorite boolean;
    v_next_want_to_try boolean;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if p_is_favorite is null and p_is_want_to_try is null then
        raise exception 'At least one flag is required'
            using errcode = '22023';
    end if;

    -- Widoczność przepisu: własny (dowolna widoczność) albo PUBLIC; bez soft-delete.
    -- Zapytanie przechodzi też przez RLS tabeli recipes (invoker).
    if not exists (
        select 1
        from public.recipes r
        where r.id = p_recipe_id
          and r.deleted_at is null
          and (r.user_id = v_user_id or r.visibility = 'PUBLIC')
    ) then
        raise exception 'Recipe not found'
            using errcode = 'P0002';
    end if;

    select f.is_favorite, f.is_want_to_try
    into v_current_favorite, v_current_want_to_try
    from public.user_recipe_flags f
    where f.user_id = v_user_id
      and f.recipe_id = p_recipe_id
    for update;

    if not found then
        v_current_favorite := false;
        v_current_want_to_try := false;
    end if;

    -- Aktualizacja częściowa: pominięte pole zachowuje dotychczasową wartość
    v_next_favorite := coalesce(p_is_favorite, v_current_favorite);
    v_next_want_to_try := coalesce(p_is_want_to_try, v_current_want_to_try);

    if not v_next_favorite and not v_next_want_to_try then
        delete from public.user_recipe_flags f
        where f.user_id = v_user_id
          and f.recipe_id = p_recipe_id;
    else
        insert into public.user_recipe_flags as f (user_id, recipe_id, is_favorite, is_want_to_try)
        values (v_user_id, p_recipe_id, v_next_favorite, v_next_want_to_try)
        on conflict (user_id, recipe_id) do update
            set is_favorite = excluded.is_favorite,
                is_want_to_try = excluded.is_want_to_try;
    end if;

    return query select p_recipe_id, v_next_favorite, v_next_want_to_try;
end;
$$;

revoke all on function public.set_recipe_flags(bigint, boolean, boolean) from public;
grant execute on function public.set_recipe_flags(bigint, boolean, boolean) to authenticated;

comment on function public.set_recipe_flags(bigint, boolean, boolean) is
    'Idempotent partial update of the caller''s personal recipe flags; deletes the row when both flags are false.';
```

**Uwagi projektowe:**

- **Dlaczego RPC, a nie zwykły upsert z Edge Function:** aktualizacja częściowa (`{ "is_favorite": false }` nie może zerować `is_want_to_try`) wymaga odczytu stanu i zapisu w jednej transakcji, z możliwością usunięcia wiersza. Wzorzec jest zgodny z resztą projektu (atomowe operacje w RPC: plan, kolekcje, soft-delete).
- **Wiersz `(false, false)` nigdy nie istnieje** (constraint + `DELETE` w RPC), więc brak wiersza = brak flag.
- **Wyścig:** równoległe pierwsze zapisy tej samej pary `(user, recipe)` rozstrzyga `ON CONFLICT`; wygrywa ostatni zapis. UI blokuje podwójne kliknięcie tej samej ikonki, a dwie różne ikonki wysyłają żądania częściowe, serializowane przez `FOR UPDATE` na istniejącym wierszu.
- **Przepis staje się niedostępny** (soft-delete, zmiana na `PRIVATE`/`SHARED`): wiersze flag zostają, a listy i szczegóły i tak go nie zwracają (scenariusze 13, 14). Zapis nowej flagi jest wtedy blokowany (`P0002` → `404`), ale usunięcie flagi przez RLS `DELETE` pozostaje możliwe.
- **Trwałe usunięcie przepisu lub użytkownika:** `ON DELETE CASCADE`.
- **Rola (`user`/`premium`/`admin`):** brak rozróżnienia, brak limitów.
- Po migracji **wygenerować ponownie typy**: `supabase/functions/_shared/database.types.ts` oraz `shared/types/database.types.ts` (tabela + RPC).

---

## 3. Nowy endpoint `PUT /recipes/{id}/flags`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `PUT` |
| URL | `/functions/v1/recipes/{id}/flags` |
| Autoryzacja | Bearer JWT (wymagane); dowolna rola |
| Funkcja Edge | `recipes` (istniejąca; bez zmian w workflow deployu) |
| Idempotencja | Tak — to samo poprawne żądanie zawsze zwraca ten sam wynik `200` |
| Cache | Odpowiedź mutacji, bez nagłówków cache |

### Parametry

| Parametr | Miejsce | Typ | Opis |
|---|---|---|---|
| `id` | path | integer > 0 | ID przepisu (sam numer, bez sluga — jak w pozostałych endpointach `recipes`) |

### Ciało żądania

```json
{
    "is_favorite": true,
    "is_want_to_try": false
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `is_favorite` | boolean | nie | Stan flagi „Ulubiony". Pominięte = bez zmiany |
| `is_want_to_try` | boolean | nie | Stan flagi „Chcę wypróbować". Pominięte = bez zmiany |

**Walidacja (zod, `.strict()`):**

- co najmniej jedno z pól musi być podane,
- nieznane pola → błąd (`strict`),
- wartości inne niż `boolean` (w tym `null`, `"true"`, `1`) → błąd,
- niepoprawny JSON → błąd.

```typescript
const setRecipeFlagsSchema = z
    .object({
        is_favorite: z.boolean({ invalid_type_error: 'is_favorite must be a boolean' }).optional(),
        is_want_to_try: z.boolean({ invalid_type_error: 'is_want_to_try must be a boolean' }).optional(),
    })
    .strict()
    .refine(
        (body) => body.is_favorite !== undefined || body.is_want_to_try !== undefined,
        { message: 'At least one of is_favorite, is_want_to_try is required' }
    );
```

### Odpowiedź `200 OK`

```json
{
    "recipe_id": 123,
    "is_favorite": true,
    "is_want_to_try": false
}
```

Odpowiedź zawsze zawiera **pełny stan obu flag** (także tej, której żądanie nie dotyczyło). Frontend używa jej jako źródła prawdy po zapisie.

### Kody odpowiedzi

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200 OK` | — | Flagi zapisane (lub stan już zgodny — idempotencja) |
| `400 Bad Request` | `VALIDATION_ERROR` | Niepoprawne `id`, niepoprawny JSON, puste ciało, nieznane pole, wartość nie-boolean |
| `401 Unauthorized` | `UNAUTHORIZED` | Brak lub nieprawidłowy JWT |
| `404 Not Found` | `NOT_FOUND` | Przepis nie istnieje, jest soft-deleted albo nie jest widoczny dla użytkownika (cudzy `PRIVATE`/`SHARED`) |
| `405 Method Not Allowed` | `METHOD_NOT_ALLOWED` | Inna metoda na `/recipes/{id}/flags` (`Allow: PUT, OPTIONS`) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Błąd bazy danych |

> **Spójność z istniejącym API:** `GET /recipes/{id}` zwraca `403` dla cudzego przepisu `PRIVATE`/`SHARED`. Dla flag świadomie zwracamy `404` (jak `/explore/recipes/{id}`), aby nie ujawniać istnienia przepisu, a RPC nie rozróżnia „nie istnieje" od „niewidoczny".

### Przepływ

```
autoryzacja (JWT → client + user)
→ walidacja id (parseAndValidateRecipeId)
→ parsowanie i walidacja ciała (zod)
→ client.rpc('set_recipe_flags', { p_recipe_id, p_is_favorite, p_is_want_to_try })
    P0002 → 404 NOT_FOUND
    22023 → 400 VALIDATION_ERROR
    42501 → 401 UNAUTHORIZED
    inny  → 500 INTERNAL_ERROR
→ 200 { recipe_id, is_favorite, is_want_to_try }
```

### Pseudokod

```typescript
// supabase/functions/recipes/recipes.handlers.ts
export async function handleSetRecipeFlags(req: Request, recipeIdParam: string): Promise<Response> {
    try {
        const recipeId = parseAndValidateRecipeId(recipeIdParam);
        const { client, user } = await getAuthenticatedContext(req);

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const parsed = setRecipeFlagsSchema.safeParse(body);
        if (!parsed.success) {
            const details = parsed.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            throw new ApplicationError('VALIDATION_ERROR', `Invalid input: ${details}`);
        }

        const result = await setRecipeFlags(client, {
            recipeId,
            isFavorite: parsed.data.is_favorite,
            isWantToTry: parsed.data.is_want_to_try,
        });

        logger.info('PUT /recipes/{id}/flags completed', { userId: user.id, recipeId });
        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}
```

```typescript
// supabase/functions/recipes/recipes.service.ts
export async function setRecipeFlags(
    client: TypedSupabaseClient,
    input: { recipeId: number; isFavorite?: boolean; isWantToTry?: boolean }
): Promise<RecipeFlagsDto> {
    const { data, error } = await client.rpc('set_recipe_flags', {
        p_recipe_id: input.recipeId,
        p_is_favorite: input.isFavorite ?? undefined,
        p_is_want_to_try: input.isWantToTry ?? undefined,
    });

    if (error?.code === 'P0002') {
        throw new ApplicationError('NOT_FOUND', `Recipe with ID ${input.recipeId} not found`);
    }
    if (error?.code === '22023') {
        throw new ApplicationError('VALIDATION_ERROR', 'At least one flag is required');
    }
    if (error?.code === '42501') {
        throw new ApplicationError('UNAUTHORIZED', 'Authentication required');
    }
    if (error || !data || data.length === 0) {
        logger.error('RPC error while setting recipe flags', { errorCode: error?.code });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to save recipe flags');
    }

    const row = data[0];
    return {
        recipe_id: Number(row.out_recipe_id),
        is_favorite: row.out_is_favorite,
        is_want_to_try: row.out_is_want_to_try,
    };
}
```

### Routing w `recipesRouter`

- Dodać `extractRecipeIdFromFlagsPath(url)` z wzorcem `/\/recipes\/([^/]+)\/flags\/?$/` (analogicznie do `extractRecipeIdFromCollectionsPath`).
- W gałęzi `PUT` sprawdzić go **przed** ogólnym `recipeId` (obok ścieżki `/collections`).
- Inne metody na tej ścieżce (`GET`, `POST`, `DELETE`) → `405` z `Allow: PUT, OPTIONS`. **Uwaga:** upewnić się, że `GET /recipes/{id}/flags` nie jest „połknięty" przez `handleGetRecipes` (lista) — brak dopasowania w `extractRecipeIdFromPath` nie może prowadzić do zwrócenia listy.
- CORS: `Access-Control-Allow-Methods` w `recipes/index.ts` i w preflight routera już zawiera `PUT`.
- Zaktualizować komentarz nagłówkowy `recipes/index.ts` o nowy endpoint.

---

## 4. Zmiany w endpointach odczytu

### 4.1 Zakres pól

| Endpoint | Funkcja / plik | Nowe pola | Dla gościa |
|---|---|---|---|
| `GET /recipes/{id}` | `recipes.service.ts` → `getRecipeById` (obie ścieżki: RLS i PUBLIC przez service role) | `is_favorite`, `is_want_to_try` | n/d (wymaga JWT) |
| `GET /explore/recipes/{id}` | `explore.service.ts` → `getExploreRecipeById` (obie ścieżki zwrotu: `PUBLIC` i autor) | `is_favorite`, `is_want_to_try` | pola **pominięte** |
| `GET /public/recipes/{id}` | `public.service.ts` → `getPublicRecipeById` | `is_favorite`, `is_want_to_try` | pola **pominięte** |
| `GET /recipes` | `recipes.service.ts` → `getRecipes` | `is_favorite` | n/d |
| `GET /recipes/feed` | `recipes.service.ts` → `getRecipesFeed` | `is_favorite` | n/d |
| `GET /public/recipes` | `public.service.ts` → `getPublicRecipes` | `is_favorite` | pole **pominięte** |
| `GET /public/recipes/feed` | `public.service.ts` → `getPublicRecipesFeed` | `is_favorite` | pole **pominięte** |
| `GET /collections/{id}` | `collections.service.ts` (mapowanie `RecipeListItemDto`) | `is_favorite` | n/d |

W listach **nie** zwracamy `is_want_to_try` (zgodnie z założeniami historyjki — kafelek pokazuje tylko serduszko).

### 4.2 Wspólny pomocnik `_shared/recipe-flags.ts`

W kodzie funkcja `getRecipeIdsInPlan` jest już skopiowana w trzech serwisach (`recipes`, `public`, `explore`). Dla flag **nie dokładamy kolejnych kopii** — jeden moduł współdzielony:

```typescript
// supabase/functions/_shared/recipe-flags.ts
export interface RecipeFlagsState {
    is_favorite: boolean;
    is_want_to_try: boolean;
}

/**
 * Zwraca mapę recipe_id -> flagi dla zalogowanego użytkownika.
 * Brak wpisu w mapie = brak flag. Gość (userId === null) lub pusta lista -> pusta mapa.
 * Jedno zapytanie zbiorcze (bez N+1).
 */
export async function getRecipeFlagsMap(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null
): Promise<Map<number, RecipeFlagsState>> {
    const result = new Map<number, RecipeFlagsState>();
    if (userId === null || recipeIds.length === 0) return result;

    const { data, error } = await client
        .from('user_recipe_flags')
        .select('recipe_id, is_favorite, is_want_to_try')
        .eq('user_id', userId)
        .in('recipe_id', recipeIds);

    if (error) {
        // Nieblokujące (jak getRecipeIdsInPlan): log + pusta mapa
        logger.error('Error fetching recipe flags', { errorCode: error.code, userId });
        return result;
    }

    for (const row of data ?? []) {
        result.set(row.recipe_id, {
            is_favorite: row.is_favorite,
            is_want_to_try: row.is_want_to_try,
        });
    }
    return result;
}
```

**Który klient:**

| Funkcja | Klient | Uwagi |
|---|---|---|
| `recipes`, `collections` | uwierzytelniony (JWT użytkownika) | RLS `select` zawęża do własnych wierszy; jawny `.eq('user_id', userId)` jako druga warstwa |
| `public`, `explore` | service role | RLS pominięty, dlatego **obowiązkowy** `.eq('user_id', userId)`; `userId` pochodzi wyłącznie z `getOptionalAuthenticatedUser(req)` (zweryfikowany JWT), nigdy z parametrów żądania |

### 4.3 Kontrakt DTO (pola opcjonalne)

Dla gościa klucze **nie występują w JSON** (wartość `undefined` jest pomijana przez `JSON.stringify`) — odpowiedzi anonimowe pozostają bez zmian (scenariusz 9). Dla zalogowanego pola są zawsze obecne (`false`, gdy brak wiersza).

```typescript
// shared/contracts/types.ts

/** Stan osobistych flag zalogowanego użytkownika dla przepisu. */
export interface RecipeFlagsDto {
    recipe_id: number;
    is_favorite: boolean;
    is_want_to_try: boolean;
}

/** Ciało PUT /recipes/{id}/flags — co najmniej jedno pole. */
export interface UpdateRecipeFlagsCommand {
    is_favorite?: boolean;
    is_want_to_try?: boolean;
}
```

Rozszerzenia istniejących DTO (pola opcjonalne, aby gość i istniejące testy się nie psuły):

| DTO | Pola |
|---|---|
| `RecipeDetailDto`, `PublicRecipeDetailDto` | `is_favorite?: boolean`, `is_want_to_try?: boolean` |
| `RecipeListItemDto`, `PublicRecipeListItemDto` | `is_favorite?: boolean` |

Lustrzane typy lokalne w `explore.service.ts` / `public.types.ts` (`RecipeDetailDto`, `PublicRecipeListItemDto`) należy rozszerzyć tak samo.

### 4.4 Cache — poprawka wymagana przez PS-95

Anonimowe odpowiedzi publiczne mają `Cache-Control: public, max-age=60`, a odpowiedzi z JWT `no-store` (`createCachedResponse` w `public.handlers.ts`, `handleGetExploreRecipeById`). Dzięki temu flagi **nie trafią do cache'u współdzielonego**. Jedyny wyjątek:

- `handleGetPublicRecipeById` używa `createSuccessResponse(recipe)` **bez** nagłówka `Cache-Control`, a wrapper w `public/index.ts` dopisuje wtedy `public, max-age=60` do **każdej** odpowiedzi `200`, także uwierzytelnionej. Po dodaniu flag przeglądarka mogłaby przez 60 s pokazywać stary stan po zmianie flagi.
- **Zmiana:** w `handleGetPublicRecipeById` użyć `createCachedResponse(recipe, userId !== null)` (dla gościa `public, max-age=60`, dla zalogowanego `no-store`).
- `Vary: Authorization` jest już dodawane przez wrapper — bez zmian.
- `GET /explore/recipes/{id}`: przy zalogowanym użytkowniku `no-store` jest już ustawiane — bez zmian.

### 4.5 Mapowanie w serwisach

Przykład (lista `getRecipes`, analogicznie `getRecipesFeed`, `getPublicRecipes*`, kolekcje):

```typescript
const recipeIds = data.map((recipe) => Number(recipe.id));
const [recipeIdsInPlan, flagsMap] = await Promise.all([
    getRecipeIdsInPlan(client, recipeIds, requesterUserId),
    getRecipeFlagsMap(client, recipeIds, requesterUserId),
]);

const recipes: RecipeListItemDto[] = data.map((recipe) => ({
    // ...istniejące pola...
    is_favorite: flagsMap.get(Number(recipe.id))?.is_favorite ?? false,
}));
```

Dla endpointów publicznych/explore pole dodajemy **warunkowo** (`userId !== null`), aby dla gościa klucz nie pojawił się w odpowiedzi:

```typescript
...(userId !== null && {
    is_favorite: flagsMap.get(recipe.id)?.is_favorite ?? false,
}),
```

Szczegóły (`mapToRecipeDetailDto`, `mapToDto` w `explore.service.ts`) przyjmują dodatkowy argument `flags: RecipeFlagsState | null` (`null` dla gościa → pól nie dodajemy).

---

## 5. Bezpieczeństwo i prywatność

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt / zmiana flag innego użytkownika | RLS (`auth.uid() = user_id`) na `SELECT/INSERT/UPDATE/DELETE`; RPC jako `security invoker`; w funkcjach z service role obowiązkowy filtr `.eq('user_id', userId)` |
| Podanie `user_id` w ciele żądania | Pole nie istnieje w schemacie; `.strict()` odrzuca nieznane pola; tożsamość tylko z JWT |
| Zapis flagi na niewidocznym przepisie (cudzy `PRIVATE`/`SHARED`, soft-deleted) | Jawny `exists` w RPC + `WITH CHECK` w RLS; wynik `404` |
| Wyciek flag przez cache | Odpowiedzi z JWT `no-store`; gość nigdy nie dostaje pól; poprawka pkt 4.4 |
| Ujawnienie istnienia przepisu | `404` zamiast `403` |
| Nadużycie (spam żądań) | Operacja tania (jeden wiersz); brak dodatkowego rate limitu w zakresie PS-95 |
| Wpływ na przepis | Brak zapisu do `recipes` → `updated_at`, `search_vector` i job normalizacji bez zmian |

---

## 6. Kody błędów — podsumowanie

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | `PUT /recipes/{id}/flags` | Niepoprawne `id`/JSON/ciało |
| `401` | `UNAUTHORIZED` | `PUT /recipes/{id}/flags` | Brak lub nieważny JWT |
| `404` | `NOT_FOUND` | `PUT /recipes/{id}/flags` | Przepis nieistniejący lub niewidoczny |
| `405` | `METHOD_NOT_ALLOWED` | `/recipes/{id}/flags` | Metoda inna niż `PUT` |

Nowe kody błędów aplikacyjnych **nie są** wprowadzane (używamy istniejących `ErrorCode` z `_shared/errors.ts`).

---

## 7. Testy (backend)

Wzorzec: istniejące testy serwisów (`recipes.service.test.ts`) i Vitest dla logiki współdzielonej.

| Obszar | Scenariusz akceptacji |
|---|---|
| `setRecipeFlagsSchema` | Puste ciało, nieznane pole, `null`, `"true"`, `1` → `400`; poprawne warianty → OK (sc. 15) |
| `setRecipeFlags` | Ustawienie `is_favorite: true` nie zmienia `is_want_to_try` (sc. 1, 2) |
| `setRecipeFlags` | `false` na jednej fladze zachowuje drugą (sc. 3); obie `true` → obie zachowane (sc. 4) |
| `setRecipeFlags` | Obie `false` → wiersz usunięty, odpowiedź `false/false` |
| `setRecipeFlags` | Powtórzenie tego samego żądania → ten sam wynik (idempotencja, sc. 15) |
| `setRecipeFlags` | `P0002` → `NOT_FOUND`; `22023` → `VALIDATION_ERROR`; `42501` → `UNAUTHORIZED` (sc. 12, 13) |
| `getRecipeFlagsMap` | Gość / pusta lista → pusta mapa, brak zapytania; błąd bazy → pusta mapa + log |
| Serwisy list i szczegółów | Zalogowany: `is_favorite` obecne; gość: klucz nieobecny w JSON (sc. 9) |
| `handleGetPublicRecipeById` | Zalogowany → `Cache-Control: no-store`; gość → `public, max-age=60` |
| Router | `PUT /recipes/{id}/flags` kieruje do handlera; `GET /recipes/{id}/flags` → `405` (nie lista) |
| RLS / prywatność (test integracyjny na lokalnym Supabase) | Użytkownik B nie odczyta ani nie zmieni flag A (sc. 8); zapis na cudzym `PRIVATE`/`SHARED` → `404`; usunięcie przepisu kasuje flagi (CASCADE); powrót przepisu do `PUBLIC` przywraca flagi (sc. 14) |
| Brak wpływu na przepis | `recipes.updated_at` i `normalized_ingredients_status` bez zmian po `PUT flags` (sc. 17) |

---

## 8. Checklist implementacji (API)

- [ ] Migracja `20261010120000_create_user_recipe_flags.sql` (tabela, indeksy, trigger, RLS, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `_shared/recipe-flags.ts` + testy
- [ ] `setRecipeFlags` (serwis) + `handleSetRecipeFlags` + schemat zod + routing `PUT` i `405` dla pozostałych metod
- [ ] `is_favorite` / `is_want_to_try` w `getRecipeById` (obie ścieżki), `getExploreRecipeById` (obie ścieżki), `getPublicRecipeById`
- [ ] `is_favorite` w `getRecipes`, `getRecipesFeed`, `getPublicRecipes`, `getPublicRecipesFeed`, `GET /collections/{id}`
- [ ] Poprawka `Cache-Control` w `handleGetPublicRecipeById`
- [ ] Rozszerzenie `shared/contracts/types.ts` i lokalnych typów w `public.types.ts` / `explore.service.ts`
- [ ] Komentarz nagłówkowy `recipes/index.ts`
- [ ] Testy (pkt 7)

---

## 9. Poza zakresem PS-95

| Element | Uwaga |
|---|---|
| Filtrowanie i wyszukiwanie po fladze (`filter[favorite]`, widok „Ulubione") | Osobna historyjka (indeks częściowy już gotowy) |
| `is_want_to_try` w listach / na kafelkach | Osobna historyjka |
| Zmiana flag z poziomu kafelka lub listy | Poza zakresem (kafelek tylko wskazuje stan) |
| Liczniki „ile osób polubiło", powiadomienia dla autora | Poza zakresem (flagi są prywatne) |
| Limity flag lub różnice między rolami | Brak limitów |
