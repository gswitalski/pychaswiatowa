# PS-99: Ocenianie przepisu w skali 1–5 — Plan API

> **User Story:** PS-99 — Ocenianie przepisu w skali 1–5
> **Data:** październik 2026
> **Dotyczy:** Supabase PostgreSQL (nowa tabela, RPC, RLS, rozszerzenie widoku `recipe_details`) oraz Edge Functions `recipes`, `public`, `explore`
> **Powiązane:** `PS-99-recipe-rating-user-story.md`, `PS-99-recipe-rating-ui-plan.md`, `PS-99-recipe-rating-deployment-plan.md`
> **Wzorzec:** PS-95 (`user_recipe_flags`, `set_recipe_flags`, `PUT /recipes/{id}/flags`, `_shared/recipe-flags.ts`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Tabela `recipe_ratings` | **Nowa** | Ocena 1–5 użytkownika per przepis, klucz `(user_id, recipe_id)`, RLS: odczyt i zapis tylko własnych wierszy |
| Widok `recipe_details` | Modyfikacja | Dwie nowe kolumny na końcu: `ratings_count`, `average_rating` (agregaty liczone w bazie z `recipe_ratings`) |
| RPC `set_recipe_rating` | **Nowa** | Atomowy, idempotentny upsert / usunięcie oceny; zwraca `my_rating` oraz aktualne agregaty |
| `PUT /recipes/{id}/rating` | **Nowy endpoint** | Ustawienie (`1..5`), zmiana lub wycofanie (`null`) oceny; odpowiedź `200` z pełnym stanem |
| `GET /recipes/{id}` | Modyfikacja | Dodanie `average_rating`, `ratings_count`, `my_rating` |
| `GET /explore/recipes/{id}` | Modyfikacja | Dodanie `average_rating`, `ratings_count` (także gość) oraz `my_rating` (tylko zalogowany). **Z tego endpointu korzysta widok `/explore/recipes/:id-:slug`** |
| `GET /public/recipes/{id}` | Modyfikacja | Dodanie `average_rating`, `ratings_count` (także gość) oraz `my_rating` (tylko zalogowany) |
| Pomocnik `_shared/recipe-ratings.ts` | **Nowy** | Zbiorczy odczyt własnych ocen dla listy ID (`getMyRatingsMap`) |
| Typy w `shared/contracts/types.ts` | Modyfikacja | Nowe `RecipeRatingDto`, `UpdateRecipeRatingCommand`; pola ocen w DTO szczegółów |

**Bez zmian (decyzja produktowa — oceny tylko na szczegółach):**

- `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, `GET /collections/{id}`, `GET /search/global`, `GET /plan` — brak średniej ocen na listach i kafelkach. Sortowanie i filtr po ocenie to osobna historyjka (rozszerzenie PS-96).
- Tabela `recipes`, RPC `get_recipes_list`, `search_vector`, joby normalizacji — **bez modyfikacji**. Ocena nie zmienia `recipes.updated_at` (analogicznie do PS-95).
- Workflow `.github/workflows/main-deploy.yml` — endpoint jest w istniejącej funkcji `recipes`, więc lista `supabase functions deploy` się nie zmienia.

---

## 2. Model danych — migracja

**Plik:** `supabase/migrations/20261027120000_create_recipe_ratings.sql`
(znacznik czasu musi być **większy** od ostatniej migracji `20261010120000`, inaczej `supabase db push` odrzuci migrację jako „out of order").

### 2.1 Tabela `recipe_ratings`

```sql
-- Migration: Create recipe_ratings
-- Description: Per-user recipe rating (1-5) for PUBLIC recipes of other authors
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.recipe_ratings (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    rating smallint not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint recipe_ratings_pkey primary key (user_id, recipe_id),
    constraint recipe_ratings_rating_range check (rating between 1 and 5)
);

-- Indeks pod agregaty (count/avg po recipe_id) i ON DELETE CASCADE z recipes.
-- INCLUDE (rating) pozwala policzyć agregat index-only scanem.
create index idx_recipe_ratings_recipe_id
    on public.recipe_ratings (recipe_id) include (rating);

create trigger set_recipe_ratings_updated_at
    before update on public.recipe_ratings
    for each row
    execute function public.handle_updated_at();
```

### 2.2 RLS

Polityki: właściciel odczytuje i modyfikuje **tylko własne** wiersze, a zapis wymaga przepisu `PUBLIC`, niedeletowanego i **cudzego**. Agregaty są publiczne, ale **nie przez odczyt wierszy** — wystawia je widok `recipe_details` (uprawnienia właściciela widoku) oraz RPC `set_recipe_rating` (patrz pkt 2.3 i 2.4). Dzięki temu użytkownik nigdy nie widzi pojedynczych ocen innych osób.

```sql
alter table public.recipe_ratings enable row level security;

revoke all on table public.recipe_ratings from anon;

create policy "authenticated users can select own recipe ratings"
    on public.recipe_ratings
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe ratings"
    on public.recipe_ratings
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_ratings.recipe_id
              and recipes.deleted_at is null
              and recipes.visibility = 'PUBLIC'
              and recipes.user_id <> auth.uid()
        )
    );

create policy "authenticated users can update own recipe ratings"
    on public.recipe_ratings
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = recipe_ratings.recipe_id
              and recipes.deleted_at is null
              and recipes.visibility = 'PUBLIC'
              and recipes.user_id <> auth.uid()
        )
    );

-- DELETE bez warunku widoczności przepisu: użytkownik zawsze może wycofać własną ocenę
create policy "authenticated users can delete own recipe ratings"
    on public.recipe_ratings
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.recipe_ratings is
    'Per-user rating (1-5) of a PUBLIC recipe of another author; individual rows are visible only to their owner, aggregates are exposed via recipe_details';
comment on column public.recipe_ratings.rating is
    'Star rating, integer 1-5';
```

### 2.3 Rozszerzenie widoku `recipe_details` (agregaty)

Agregaty są liczone w bazie (bez denormalizacji w `recipes`, bez triggerów), więc **nie mogą się rozjechać** z `recipe_ratings` — zniknął wyjątek „minimalna rozbieżność agregatu" z historyjki. Koszt: dwa podzapytania po indeksie `idx_recipe_ratings_recipe_id`.

**Technika:** `create or replace view` z dopisaniem nowych kolumn **na końcu** listy `select`. Jest to dozwolone przez PostgreSQL (pierwsze kolumny muszą pozostać identyczne), nie wymaga `drop view`, zachowuje uprawnienia (`grant select … to authenticated`) i zależności. Pełna definicja widoku jest kopią z `20260118120300_update_recipe_details_view_for_normalized_ingredients.sql` (ostatnia migracja zmieniająca widok — potwierdzić przed implementacją, że od tego czasu nic go nie zmieniło) z dwiema dodatkowymi kolumnami:

```sql
create or replace view public.recipe_details as
select
    -- ...WSZYSTKIE dotychczasowe kolumny, w tej samej kolejności i bez zmian...
    -- (r.id ... collection_ids)

    -- ratings aggregates (appended at the end — required by CREATE OR REPLACE VIEW)
    (
        select count(*)::integer
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as ratings_count,
    (
        select round(avg(rr.rating)::numeric, 1)
        from public.recipe_ratings rr
        where rr.recipe_id = r.id
    ) as average_rating
from public.recipes r
left join public.categories c on c.id = r.category_id
where r.deleted_at is null;
```

Uwagi:

- `average_rating` = `NULL`, gdy brak ocen (UI nie pokazuje „0,0" — scenariusz 8). `ratings_count` = `0`.
- Podzapytania skalarne w liście kolumn (jak istniejące `tags`/`collections`) nie są liczone, gdy zapytanie ich nie wybiera. Endpointy list wybierają jawne listy kolumn, więc **nie płacą** za agregaty. **Zweryfikować `EXPLAIN`** na liście `GET /recipes` i `GET /public/recipes/feed` (krok manualny w planie wdrożenia).
- Widok nie ma `security_invoker`, więc agregat jest liczony z uprawnieniami właściciela widoku i widzi wszystkie oceny, mimo RLS na `recipe_ratings`. To zamierzone: tylko liczby, nigdy pojedyncze wiersze.
- Zaktualizować `comment on view public.recipe_details` o `ratings_count` i `average_rating`.

### 2.4 RPC `set_recipe_rating`

**Dlaczego RPC, a nie zwykły upsert z Edge Function:** ustawienie / zmiana / usunięcie oraz policzenie agregatów muszą być spójną operacją, a walidacja (przepis `PUBLIC`, nie-autor, zakres) jest w jednym miejscu. **Dlaczego `security definer` (inaczej niż `set_recipe_flags`):** po zapisie funkcja zwraca średnią i liczbę głosów **wszystkich** użytkowników, a przy `security invoker` RLS pokazałby tylko własny wiersz. Poniższe zasady chronią przed eskalacją uprawnień:

- `set search_path = ''` i w pełni kwalifikowane nazwy obiektów,
- tożsamość wyłącznie z `auth.uid()` (brak parametru `user_id`),
- jawne sprawdzenie widoczności, autora i zakresu w ciele funkcji,
- `revoke … from public, anon`, `grant execute … to authenticated`.

```sql
create or replace function public.set_recipe_rating(
    p_recipe_id bigint,
    p_rating smallint default null
)
returns table (
    out_recipe_id bigint,
    out_my_rating smallint,
    out_average_rating numeric,
    out_ratings_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_author_id uuid;
    v_visibility text;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    if p_rating is not null and (p_rating < 1 or p_rating > 5) then
        raise exception 'Rating must be between 1 and 5 or null'
            using errcode = '22023';
    end if;

    select r.user_id, r.visibility::text
    into v_author_id, v_visibility
    from public.recipes r
    where r.id = p_recipe_id
      and r.deleted_at is null;

    -- Przepis nie istnieje albo jest soft-deleted
    if not found then
        raise exception 'Recipe not found'
            using errcode = 'P0002';
    end if;

    -- Autor nie ocenia własnych przepisów (także gdy przepis nie jest PUBLIC)
    if v_author_id = v_user_id then
        raise exception 'Authors cannot rate their own recipes'
            using errcode = 'P0403';
    end if;

    -- Cudzy przepis PRIVATE/SHARED: nie ujawniamy jego istnienia
    if v_visibility <> 'PUBLIC' then
        raise exception 'Recipe not found'
            using errcode = 'P0002';
    end if;

    if p_rating is null then
        delete from public.recipe_ratings rr
        where rr.user_id = v_user_id
          and rr.recipe_id = p_recipe_id;
    else
        insert into public.recipe_ratings as rr (user_id, recipe_id, rating)
        values (v_user_id, p_recipe_id, p_rating)
        on conflict (user_id, recipe_id) do update
            set rating = excluded.rating
            -- Idempotencja: ta sama wartość nie generuje zapisu ani zmiany updated_at
            where rr.rating is distinct from excluded.rating;
    end if;

    return query
    select
        p_recipe_id,
        p_rating,
        round(avg(rr.rating)::numeric, 1),
        count(*)::integer
    from public.recipe_ratings rr
    where rr.recipe_id = p_recipe_id;
end;
$$;

revoke all on function public.set_recipe_rating(bigint, smallint) from public;
revoke all on function public.set_recipe_rating(bigint, smallint) from anon;
grant execute on function public.set_recipe_rating(bigint, smallint) to authenticated;

comment on function public.set_recipe_rating(bigint, smallint) is
    'Idempotent upsert (1-5) or removal (null) of the caller''s rating of a PUBLIC recipe of another author; returns the caller''s rating and recipe aggregates.';
```

**Uwagi projektowe:**

- Kolumny wyjściowe mają prefiks `out_`, aby uniknąć niejednoznaczności z kolumnami tabeli (jak w `set_recipe_flags`).
- `avg` bez wierszy zwraca `NULL`, a `count` `0` — dokładnie to, czego oczekuje scenariusz 8 po wycofaniu ostatniej oceny.
- **Kody błędu:** `42501` = brak uwierzytelnienia, `22023` = zły zakres, `P0002` = nie znaleziono/niewidoczny, `P0403` = własny przepis (kod własny, nieużywany w innych funkcjach projektu).
- **Wyścig:** równoległe pierwsze zapisy tej samej pary `(user, recipe)` rozstrzyga `ON CONFLICT`; wygrywa ostatni zapis. Agregaty są liczone przy odczycie, więc nie ma rozbieżności.
- **Przepis staje się niedostępny** (soft-delete, zmiana na `PRIVATE`/`SHARED`): oceny **zostają w bazie**, ale API nie zwraca agregatów ani `my_rating` (pkt 4.3), a nowy zapis jest blokowany (`P0002` → `404`). Po powrocie przepisu do `PUBLIC` bez `deleted_at` oceny wracają.
- **Trwałe usunięcie przepisu lub konta:** `ON DELETE CASCADE`.
- **Rola (`user`/`premium`/`admin`):** brak rozróżnienia i limitów. Autora blokujemy po `recipes.user_id`, także dla `admin`.
- Po migracji **wygenerować ponownie typy:** `supabase/functions/_shared/database.types.ts` oraz `shared/types/database.types.ts` (tabela, RPC i nowe kolumny widoku). **Uwaga:** `RecipeDetailDto` jest zbudowany z typu wiersza widoku (`Omit<RecipeDetail, …>`), więc nowe kolumny pojawią się w nim automatycznie. Trzeba je nadpisać typami z pkt 4.4 (maska dla przepisów niepublicznych).

---

## 3. Nowy endpoint `PUT /recipes/{id}/rating`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `PUT` |
| URL | `/functions/v1/recipes/{id}/rating` |
| Autoryzacja | Bearer JWT (wymagane); dowolna rola (`user`, `premium`, `admin`) |
| Funkcja Edge | `recipes` (istniejąca; bez zmian w workflow deployu) |
| Idempotencja | Tak — to samo poprawne żądanie zawsze zwraca ten sam wynik `200` (przy braku zmian w ocenach innych użytkowników) |
| Cache | Odpowiedź mutacji, bez nagłówków cache |

### Parametry

| Parametr | Miejsce | Typ | Opis |
|---|---|---|---|
| `id` | path | integer > 0 | ID przepisu (sam numer, bez sluga — jak w pozostałych endpointach `recipes`) |

### Ciało żądania

```json
{
    "rating": 4
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `rating` | integer `1..5` lub `null` | **tak** | Ocena. `null` wycofuje ocenę użytkownika. Pominięcie pola jest błędem |

**Walidacja (zod, `.strict()`):**

- pole `rating` musi wystąpić,
- dozwolone: liczba całkowita 1–5 albo `null`,
- odrzucane: `0`, `6`, `4.5`, `"4"`, `true`, brak pola, nieznane pola, niepoprawny JSON.

```typescript
const setRecipeRatingSchema = z
    .object({
        rating: z
            .number({
                required_error: 'rating is required',
                invalid_type_error: 'rating must be an integer between 1 and 5 or null',
            })
            .int('rating must be an integer')
            .min(1, 'rating must be at least 1')
            .max(5, 'rating must be at most 5')
            .nullable(),
    })
    .strict();
```

### Odpowiedź `200 OK`

```json
{
    "recipe_id": 123,
    "my_rating": 4,
    "average_rating": 4.3,
    "ratings_count": 27
}
```

Po wycofaniu oceny:

```json
{
    "recipe_id": 123,
    "my_rating": null,
    "average_rating": 4.3,
    "ratings_count": 26
}
```

Ostatnia ocena wycofana: `"my_rating": null, "average_rating": null, "ratings_count": 0`.

Odpowiedź zawiera **pełny, aktualny stan** (także oceny innych użytkowników złożone od ostatniego odczytu). Frontend używa jej jako źródła prawdy po zapisie.

### Kody odpowiedzi

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200 OK` | — | Ocena zapisana / zmieniona / wycofana (lub stan już zgodny — idempotencja) |
| `400 Bad Request` | `VALIDATION_ERROR` | Niepoprawne `id`, niepoprawny JSON, brak `rating`, wartość spoza `1..5`/`null`, nieznane pole |
| `401 Unauthorized` | `UNAUTHORIZED` | Brak lub nieprawidłowy JWT |
| `403 Forbidden` | `FORBIDDEN` | Użytkownik jest autorem przepisu (scenariusz 5) |
| `404 Not Found` | `NOT_FOUND` | Przepis nie istnieje, jest soft-deleted albo nie jest `PUBLIC` (cudzy `PRIVATE`/`SHARED`; scenariusz 6) |
| `405 Method Not Allowed` | `METHOD_NOT_ALLOWED` | Inna metoda na `/recipes/{id}/rating` (`Allow: PUT, OPTIONS`) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Błąd bazy danych |

> **Spójność z PS-95:** dla niewidocznego przepisu zwracamy `404` (nie `403`), aby nie ujawniać istnienia cudzego przepisu prywatnego. `403` pojawia się wyłącznie dla autora, który i tak zna swój przepis.

### Przepływ

```
autoryzacja (JWT → client + user)
→ walidacja id (parseAndValidateRecipeId)
→ parsowanie i walidacja ciała (zod)
→ client.rpc('set_recipe_rating', { p_recipe_id, p_rating })
    P0002 → 404 NOT_FOUND
    P0403 → 403 FORBIDDEN
    22023 → 400 VALIDATION_ERROR
    42501 → 401 UNAUTHORIZED
    inny  → 500 INTERNAL_ERROR
→ 200 { recipe_id, my_rating, average_rating, ratings_count }
```

### Pseudokod

```typescript
// supabase/functions/recipes/recipes.handlers.ts
export async function handleSetRecipeRating(req: Request, recipeIdParam: string): Promise<Response> {
    try {
        const recipeId = parseAndValidateRecipeId(recipeIdParam);
        const { client, user } = await getAuthenticatedContext(req);

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            throw new ApplicationError('VALIDATION_ERROR', 'Invalid JSON in request body');
        }

        const parsed = setRecipeRatingSchema.safeParse(body);
        if (!parsed.success) {
            const details = parsed.error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join(', ');
            throw new ApplicationError('VALIDATION_ERROR', `Invalid input: ${details}`);
        }

        const result = await setRecipeRating(client, {
            recipeId,
            rating: parsed.data.rating,
        });

        logger.info('PUT /recipes/{id}/rating completed', { userId: user.id, recipeId });
        return createSuccessResponse(result);
    } catch (error) {
        return handleError(error);
    }
}
```

```typescript
// supabase/functions/recipes/recipes.service.ts
export async function setRecipeRating(
    client: TypedSupabaseClient,
    input: { recipeId: number; rating: number | null }
): Promise<RecipeRatingDto> {
    const { data, error } = await client.rpc('set_recipe_rating', {
        p_recipe_id: input.recipeId,
        // pominięty parametr = domyślne NULL po stronie RPC (wycofanie oceny)
        p_rating: input.rating ?? undefined,
    });

    if (error?.code === 'P0002') {
        throw new ApplicationError('NOT_FOUND', `Recipe with ID ${input.recipeId} not found`);
    }
    if (error?.code === 'P0403') {
        throw new ApplicationError('FORBIDDEN', 'Authors cannot rate their own recipes');
    }
    if (error?.code === '22023') {
        throw new ApplicationError('VALIDATION_ERROR', 'Rating must be between 1 and 5 or null');
    }
    if (error?.code === '42501') {
        throw new ApplicationError('UNAUTHORIZED', 'Authentication required');
    }
    if (error || !data || data.length === 0) {
        logger.error('RPC error while setting recipe rating', { errorCode: error?.code });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to save recipe rating');
    }

    const row = data[0];
    const ratingsCount = Number(row.out_ratings_count);
    return {
        recipe_id: Number(row.out_recipe_id),
        my_rating: row.out_my_rating ?? null,
        average_rating: ratingsCount === 0 ? null : Number(row.out_average_rating),
        ratings_count: ratingsCount,
    };
}
```

### Routing w `recipesRouter`

- Dodać `extractRecipeIdFromRatingPath(url)` z wzorcem `/\/recipes\/([^/]+)\/rating\/?$/` (analogicznie do `extractRecipeIdFromFlagsPath`).
- W gałęzi `PUT` sprawdzić go **przed** ogólnym `recipeId`, obok ścieżek `/flags` i `/collections`.
- Inne metody (`GET`, `POST`, `DELETE`, `PATCH`) na tej ścieżce → `405` z `Allow: PUT, OPTIONS`. **Uwaga:** `GET /recipes/{id}/rating` nie może zostać „połknięty" przez `handleGetRecipes` (lista) ani `handleGetRecipeById`.
- CORS: `Access-Control-Allow-Methods` w `recipes/index.ts` zawiera już `PUT`.
- Zaktualizować komentarz nagłówkowy `recipes/index.ts` o nowy endpoint.

---

## 4. Zmiany w endpointach odczytu (tylko szczegóły)

### 4.1 Zakres pól

| Endpoint | Funkcja / plik | `average_rating`, `ratings_count` | `my_rating` | Dla gościa |
|---|---|---|---|---|
| `GET /recipes/{id}` | `recipes.service.ts` → `getRecipeById` (obie ścieżki: RLS i PUBLIC przez service role) | z widoku `recipe_details` | `getMyRatingsMap` | n/d (wymaga JWT) |
| `GET /explore/recipes/{id}` | `explore.service.ts` → `getExploreRecipeById` (obie ścieżki zwrotu: `PUBLIC` i autor) | z widoku | `getMyRatingsMap` | agregaty **obecne**, `my_rating` **pominięte** |
| `GET /public/recipes/{id}` | `public.service.ts` → `getPublicRecipeById` | z widoku | `getMyRatingsMap` | agregaty **obecne**, `my_rating` **pominięte** |

Różnica względem PS-95: agregaty są **publiczne**, więc dostaje je także gość (scenariusz 4). Prywatna jest wyłącznie własna ocena.

### 4.2 Wspólny pomocnik `_shared/recipe-ratings.ts`

Jedna implementacja zamiast kolejnych kopii w trzech serwisach (jak `_shared/recipe-flags.ts`). Wariant zbiorczy (mapa) jest tani, a ułatwi przyszłe rozszerzenie list.

```typescript
// supabase/functions/_shared/recipe-ratings.ts

/**
 * Zwraca mapę recipe_id -> własna ocena (1-5) zalogowanego użytkownika.
 * Brak wpisu w mapie = brak oceny. Gość (userId === null) lub pusta lista -> pusta mapa.
 * Jedno zapytanie zbiorcze (bez N+1).
 */
export async function getMyRatingsMap(
    client: TypedSupabaseClient,
    recipeIds: number[],
    userId: string | null
): Promise<Map<number, number>> {
    const result = new Map<number, number>();
    if (userId === null || recipeIds.length === 0) return result;

    const { data, error } = await client
        .from('recipe_ratings')
        .select('recipe_id, rating')
        .eq('user_id', userId)
        .in('recipe_id', recipeIds);

    if (error) {
        // Nieblokujące (jak getRecipeFlagsMap): log + pusta mapa
        logger.error('Error fetching own recipe ratings', { errorCode: error.code, userId });
        return result;
    }

    for (const row of data ?? []) {
        result.set(Number(row.recipe_id), row.rating);
    }
    return result;
}
```

**Który klient:**

| Funkcja | Klient | Uwagi |
|---|---|---|
| `recipes` | uwierzytelniony (JWT użytkownika) | RLS `select` zawęża do własnych wierszy; jawny `.eq('user_id', userId)` jako druga warstwa |
| `public`, `explore` | service role | RLS pominięty, dlatego **obowiązkowy** `.eq('user_id', userId)`; `userId` pochodzi wyłącznie z `getOptionalAuthenticatedUser(req)` (zweryfikowany JWT), nigdy z parametrów żądania |

### 4.3 Maska dla przepisów niepublicznych

Agregaty widoku są liczone dla każdego przepisu, ale **API ujawnia je tylko dla `visibility = 'PUBLIC'`**. Dla `PRIVATE`/`SHARED` (np. autor ogląda własny prywatny przepis) wszystkie trzy pola mają wartość `null`:

| Przepis | `average_rating` | `ratings_count` | `my_rating` |
|---|---|---|---|
| `PUBLIC`, bez ocen | `null` | `0` | `null` (zalogowany) / pominięte (gość) |
| `PUBLIC`, z ocenami | liczba z 1 miejscem po przecinku | liczba całkowita | `1..5` lub `null` |
| `PRIVATE` / `SHARED` | `null` | `null` | `null` |

`ratings_count: null` (a nie `0`) odróżnia „oceny niedostępne dla tego przepisu" od „publiczny przepis bez głosów". Frontend renderuje komponent ocen tylko dla `visibility === 'PUBLIC'`.

Mapper (wspólny kształt dla trzech serwisów):

```typescript
function mapRatings(
    row: { visibility: string; average_rating: number | null; ratings_count: number | null },
    myRating: number | undefined,
    isAuthenticated: boolean
): RecipeRatingFields {
    if (row.visibility !== 'PUBLIC') {
        return { average_rating: null, ratings_count: null, ...(isAuthenticated && { my_rating: null }) };
    }
    const count = Number(row.ratings_count ?? 0);
    return {
        average_rating: count === 0 || row.average_rating === null ? null : Number(row.average_rating),
        ratings_count: count,
        ...(isAuthenticated && { my_rating: myRating ?? null }),
    };
}
```

Dla gościa klucz `my_rating` **nie występuje w JSON** (wartość `undefined` jest pomijana przez `JSON.stringify`). Dla zalogowanego jest zawsze obecny.

### 4.4 Kontrakt DTO

```typescript
// shared/contracts/types.ts

/** Stan oceny przepisu: własna ocena zalogowanego + agregaty (odpowiedź PUT /recipes/{id}/rating). */
export interface RecipeRatingDto {
    recipe_id: number;
    /** Własna ocena 1-5 lub null (brak oceny). */
    my_rating: number | null;
    /** Średnia ocen z 1 miejscem po przecinku; null, gdy brak ocen. */
    average_rating: number | null;
    /** Liczba ocen. */
    ratings_count: number;
}

/** Ciało PUT /recipes/{id}/rating. `null` wycofuje ocenę. */
export interface UpdateRecipeRatingCommand {
    rating: number | null;
}
```

Rozszerzenia istniejących DTO:

| DTO | Pola |
|---|---|
| `RecipeDetailDto` | `average_rating: number \| null`, `ratings_count: number \| null`, `my_rating?: number \| null` — **nadpisują** kolumny wyprowadzone z widoku (przez `Omit<RecipeDetail, … \| 'average_rating' \| 'ratings_count'>`) |
| `PublicRecipeDetailDto` | `average_rating: number \| null`, `ratings_count: number`, `my_rating?: number \| null` |

Lustrzane typy lokalne w `explore.service.ts` / `public.types.ts` należy rozszerzyć tak samo, a stałe z kolumnami (`RECIPE_DETAIL_SELECT_COLUMNS` i odpowiedniki w `public.service.ts`) o `ratings_count, average_rating`.

### 4.5 Cache

Reguły z PS-95 pozostają bez zmian i **wystarczają**:

- odpowiedzi z JWT (`GET /public/recipes/{id}`, `GET /explore/recipes/{id}`) mają `Cache-Control: no-store`, więc `my_rating` nie trafia do cache'u współdzielonego, a użytkownik po zapisie widzi świeże dane,
- odpowiedzi anonimowe mają `public, max-age=60` — gość może zobaczyć agregat opóźniony do 60 s. To akceptowalne (średnia nie wymaga natychmiastowej spójności) i **nie wymaga zmiany nagłówków**,
- `Vary: Authorization` dopisuje już wrapper w `public/index.ts`.

---

## 5. Bezpieczeństwo i prywatność

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt ocen innych użytkowników | RLS `select` tylko własne wiersze; agregaty wyłącznie jako liczby (widok, RPC); `getMyRatingsMap` z obowiązkowym `.eq('user_id', userId)` |
| Zapis oceny w imieniu kogoś innego | Brak `user_id` w schemacie żądania (`.strict()`), tożsamość z `auth.uid()` w RPC i polityk RLS |
| Ocena własnego przepisu (w tym przez `admin`) | Jawny test `v_author_id = v_user_id` w RPC → `403`; dodatkowo `recipes.user_id <> auth.uid()` w `WITH CHECK` |
| Ocena przepisu niepublicznego / usuniętego | Test widoczności w RPC → `404`; dodatkowo `WITH CHECK` w RLS |
| Ujawnienie istnienia cudzego przepisu prywatnego | `404` zamiast `403` |
| Eskalacja uprawnień przez `security definer` | `search_path = ''`, w pełni kwalifikowane nazwy, brak parametru `user_id`, `revoke` z `public`/`anon`, `grant` tylko dla `authenticated` |
| Wyciek `my_rating` przez cache | Odpowiedzi z JWT `no-store`; gość nigdy nie dostaje `my_rating` |
| Wartości spoza zakresu | Walidacja zod, walidacja w RPC oraz `CHECK (rating between 1 and 5)` |
| Manipulowanie średnią (zakładanie wielu kont) | Jedna ocena na konto (PK `(user_id, recipe_id)`), wymagane zalogowanie z potwierdzonym kontem. **Brak dodatkowego rate limitu w zakresie PS-99** (operacja tania, jeden wiersz). Monitorować nadużycia; limit i wykrywanie anomalii dodać przy pierwszych sygnałach |
| Wpływ na przepis | Brak zapisu do `recipes` → `updated_at`, `search_vector` i job normalizacji bez zmian |

---

## 6. Kody błędów — podsumowanie

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | `PUT /recipes/{id}/rating` | Niepoprawne `id`/JSON/ciało/wartość |
| `401` | `UNAUTHORIZED` | `PUT /recipes/{id}/rating` | Brak lub nieważny JWT |
| `403` | `FORBIDDEN` | `PUT /recipes/{id}/rating` | Autor próbuje ocenić własny przepis |
| `404` | `NOT_FOUND` | `PUT /recipes/{id}/rating` | Przepis nieistniejący lub niepubliczny |
| `405` | `METHOD_NOT_ALLOWED` | `/recipes/{id}/rating` | Metoda inna niż `PUT` |

Nowe kody błędów aplikacyjnych **nie są** wprowadzane (używamy istniejących `ErrorCode` z `_shared/errors.ts`, w tym `FORBIDDEN`).

---

## 7. Testy (backend)

| Obszar | Scenariusz akceptacji |
|---|---|
| `setRecipeRatingSchema` | Brak `rating`, `0`, `6`, `4.5`, `"4"`, `true`, nieznane pole → `400`; `1..5` i `null` → OK |
| `setRecipeRating` | Pierwsza ocena → `my_rating`, `ratings_count = 1`, średnia równa ocenie (sc. 1) |
| `setRecipeRating` | Zmiana oceny: `ratings_count` bez zmian, średnia przeliczona (sc. 2) |
| `setRecipeRating` | `null` → wiersz usunięty, `ratings_count − 1`, `my_rating: null` (sc. 3) |
| `setRecipeRating` | Wycofanie ostatniej oceny → `average_rating: null`, `ratings_count: 0` (sc. 8) |
| `setRecipeRating` | Powtórzenie tego samego żądania → ten sam wynik, brak zmiany `updated_at` (idempotencja) |
| `setRecipeRating` | `P0002` → `NOT_FOUND`; `P0403` → `FORBIDDEN`; `22023` → `VALIDATION_ERROR`; `42501` → `UNAUTHORIZED` (sc. 5, 6) |
| Zaokrąglenie | Oceny 4, 4, 5 → `4.3`; oceny 1, 2 → `1.5` |
| `getMyRatingsMap` | Gość / pusta lista → pusta mapa, brak zapytania; błąd bazy → pusta mapa + log |
| `mapRatings` | `PUBLIC`: agregaty + `my_rating`; `PRIVATE`/`SHARED`: wszystko `null`; gość: brak klucza `my_rating` (sc. 4) |
| Serwisy szczegółów (`recipes`, `explore`, `public`) | Agregaty obecne dla gościa; `my_rating` tylko dla zalogowanego (sc. 4) |
| Router | `PUT /recipes/{id}/rating` kieruje do handlera; `GET /recipes/{id}/rating` → `405` (nie lista, nie szczegóły) |
| RLS / RPC (test integracyjny na lokalnym Supabase) | B ocenia publiczny przepis A → `200`; A ocenia własny → `403`; B ocenia `PRIVATE`/`SHARED` A → `404`; B nie odczyta ocen A (`select` zwraca tylko własne); bezpośredni `insert` jako A na własnym przepisie odrzucony przez RLS; usunięcie przepisu kasuje oceny (CASCADE); zmiana przepisu na `PRIVATE` ukrywa agregaty, a powrót do `PUBLIC` je przywraca |
| Brak wpływu na przepis | `recipes.updated_at` i `normalized_ingredients_status` bez zmian po `PUT rating` |
| Regresja widoku | Listy `GET /recipes`, `GET /public/recipes*`, wyszukiwanie i szczegóły zwracają te same dane co przed migracją |

---

## 8. Checklist implementacji (API)

- [ ] Migracja `20261027120000_create_recipe_ratings.sql` (tabela, indeks, trigger, RLS, `create or replace view recipe_details`, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `_shared/recipe-ratings.ts` + testy
- [ ] `setRecipeRating` (serwis) + `handleSetRecipeRating` + schemat zod + routing `PUT` i `405` dla pozostałych metod
- [ ] `average_rating`, `ratings_count`, `my_rating` w `getRecipeById` (obie ścieżki), `getExploreRecipeById` (obie ścieżki), `getPublicRecipeById`
- [ ] Maska `PUBLIC` / niepubliczny (`mapRatings`)
- [ ] Rozszerzenie `shared/contracts/types.ts` (w tym nadpisanie kolumn widoku w `RecipeDetailDto`) i lokalnych typów w `public.types.ts` / `explore.service.ts`; kolumny w stałych `select`
- [ ] Komentarz nagłówkowy `recipes/index.ts`
- [ ] Testy (pkt 7), w tym `EXPLAIN` list po zmianie widoku

---

## 9. Poza zakresem PS-99

| Element | Uwaga |
|---|---|
| Średnia ocen na kafelkach i listach | Osobna historyjka (wymaga rozszerzenia list i decyzji o denormalizacji) |
| Sortowanie / filtr po ocenie w `/explore` | Osobna historyjka (rozszerzenie PS-96: cursor, ranking) |
| Komentarze i recenzje tekstowe | Poza zakresem |
| Powiadomienia dla autora o nowej ocenie | Poza zakresem |
| Rate limit i wykrywanie nadużyć (review bombing) | Poza zakresem; monitorować, dodać przy pierwszych sygnałach |
| Rozkład ocen (histogram 1–5), lista „kto ocenił" | Poza zakresem; pojedyncze oceny pozostają prywatne |
| Różnice między rolami / limity ocen | Brak |
