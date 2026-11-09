# PS-31: Osobista notatka użytkownika do przepisu — Plan API

> **User Story:** PS-31 — Osobista notatka użytkownika do przepisu
> **Data:** listopad 2026
> **Dotyczy:** Supabase PostgreSQL (nowa tabela, RLS, RPC) oraz Edge Functions `recipes`, `public`, `explore`
> **Powiązane:** `PS-31-personal-user-note-on-recipe-user-story.md`, `PS-31-personal-user-note-on-recipe-ui-plan.md`, `PS-31-personal-user-note-on-recipe-deployment-plan.md`
> **Wzorzec:** PS-95 (`user_recipe_flags`, `set_recipe_flags`, `PUT /recipes/{id}/flags`, `_shared/recipe-flags.ts`) i PS-99 (`my_rating`, maska pól, `_shared/recipe-ratings.ts`)

---

## 0. Decyzja: funkcja `explore` i pole `my_note`

**Tak — funkcja `explore` zwraca własne szczegóły przepisu i musi zwracać `my_note`.**

Uzasadnienie (sprawdzone w kodzie):

- Widok `/explore/recipes/:id-:slug` ładuje dane przez `ExploreRecipesService.getExploreRecipeById` → `GET /explore/recipes/{id}` (`explore.service.ts` → `getExploreRecipeById`), **a nie** przez `GET /public/recipes/{id}`.
- `getExploreRecipeById` zwraca szczegóły w dwóch gałęziach: (1) przepis `PUBLIC` (dowolnego autora, także własny), (2) **własny przepis niepubliczny** (`PRIVATE`/`SHARED`, reguła „requester = autor"). Obie gałęzie są obecnie osobnymi blokami `Promise.all` + `mapToDto` i **obie** muszą dostać notatkę. Notatka jest dozwolona dla obu przypadków (predykat: „własny dowolnej widoczności lub cudzy `PUBLIC`").
- Funkcja `explore` używa klienta **service role** (omija RLS), więc odczyt notatki musi mieć obowiązkowy filtr `.eq('user_id', requesterUserId)`, a `requesterUserId` pochodzi wyłącznie z `getOptionalAuthenticatedUser(req)`.
- Odpowiedź `explore` ma już poprawne `Cache-Control`: `no-store` dla żądań z JWT i `public, max-age=60` tylko dla gościa na publicznym przepisie (`handleGetExploreRecipeById`). **Nie trzeba zmieniać nagłówków** — `my_note` nigdy nie trafi do cache'u współdzielonego, bo gość nie dostaje pola.
- Pozostałe endpointy szczegółów dostają to samo pole: `GET /recipes/{id}` (obie ścieżki: RLS i `PUBLIC` przez service role) oraz `GET /public/recipes/{id}`.

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| Tabela `user_recipe_notes` | **Nowa** | Notatka użytkownika per przepis, PK `(user_id, recipe_id)`, `CHECK char_length(note) BETWEEN 1 AND 2000`, RLS tylko właściciel |
| RPC `set_recipe_note` | **Nowa** | Atomowy, idempotentny upsert / usunięcie notatki (`security invoker`); normalizuje i waliduje także dla bezpośrednich wywołań PostgREST |
| `PUT /recipes/{id}/note` | **Nowy endpoint** | Zapis / usunięcie notatki; odpowiedź `200` z pełnym stanem |
| `GET /recipes/{id}` | Modyfikacja | Dodanie `my_note` (po `recipes.service.ts` → `getRecipeById`, obie ścieżki). Ta sama funkcja zasila odpowiedzi `POST /recipes` i `PUT /recipes/{id}` (patrz pkt 4.4) |
| `GET /explore/recipes/{id}` | Modyfikacja | Dodanie `my_note` w **obu** gałęziach (`PUBLIC` i autor). Pole pominięte dla gościa |
| `GET /public/recipes/{id}` | Modyfikacja | Dodanie `my_note` (tylko z JWT) |
| Pomocnik `_shared/recipe-notes.ts` | **Nowy** | `getMyRecipeNote`, `normalizeRecipeNote`, `countRecipeNoteCharacters`, stała `RECIPE_NOTE_MAX_LENGTH` |
| Typy w `shared/contracts/types.ts` | Modyfikacja | `SetRecipeNoteRequestDto`, `RecipeNoteResponseDto`, `my_note?` w `RecipeDetailDto` i `PublicRecipeDetailDto` |

**Bez zmian (zgodnie z historyjką):**

- Listy i kafelki: `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, `GET /collections/{id}`, `GET /search/global`, `GET /plan`, `GET /shopping-list` — **bez** `my_note`.
- Tabela `recipes`, widok `recipe_details`, RPC `get_recipes_list`, `search_vector`, joby normalizacji składników, polityki RLS `recipes` i `recipe_collections` — **bez modyfikacji**. Notatka jest w osobnej tabeli, więc zapis nie dotyka `recipes.updated_at` (scenariusz 23).
- Funkcje AI (`ai`), `plan`, `shopping-list` — nie odczytują notatek.
- Workflow `.github/workflows/main-deploy.yml` — endpoint jest w istniejącej funkcji `recipes`, więc lista `supabase functions deploy` się nie zmienia.

---

## 2. Model danych — migracja

**Plik:** `supabase/migrations/20261109120000_create_user_recipe_notes.sql`
(znacznik czasu musi być **większy** od ostatniej migracji `20261027120000`, inaczej `supabase db push` odrzuci migrację jako „out of order").

### 2.1 Tabela, indeks, trigger

```sql
-- Migration: Create user_recipe_notes
-- Description: Personal per-user private note attached to a recipe (own or foreign PUBLIC)
-- Dependencies: auth.users, public.recipes, public.handle_updated_at()

create table public.user_recipe_notes (
    user_id uuid not null references auth.users(id) on delete cascade,
    recipe_id bigint not null references public.recipes(id) on delete cascade,
    note text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint user_recipe_notes_pkey primary key (user_id, recipe_id),
    -- char_length liczy znaki (code points), spójnie z licznikiem na froncie i walidacją API
    constraint user_recipe_notes_note_length check (char_length(note) between 1 and 2000)
);

-- Indeks pod ON DELETE CASCADE z recipes (PK pokrywa kaskadę z auth.users)
create index idx_user_recipe_notes_recipe_id
    on public.user_recipe_notes (recipe_id);

create trigger set_user_recipe_notes_updated_at
    before update on public.user_recipe_notes
    for each row
    execute function public.handle_updated_at();
```

Brak `jsonb`/pełnotekstowego indeksu i brak kolumny w `recipes` — notatka **nie** uczestniczy w wyszukiwaniu (scenariusz 23).

### 2.2 RLS

Identyczny predykat dostępności przepisu jak w `user_recipe_flags` (PS-95): przepis nieusunięty **i** (własny lub `PUBLIC`).

```sql
alter table public.user_recipe_notes enable row level security;

revoke all on table public.user_recipe_notes from anon;

create policy "authenticated users can select own recipe notes"
    on public.user_recipe_notes
    for select
    to authenticated
    using (auth.uid() = user_id);

create policy "authenticated users can insert own recipe notes"
    on public.user_recipe_notes
    for insert
    to authenticated
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

create policy "authenticated users can update own recipe notes"
    on public.user_recipe_notes
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (
        auth.uid() = user_id
        and exists (
            select 1
            from public.recipes
            where recipes.id = user_recipe_notes.recipe_id
              and recipes.deleted_at is null
              and (
                  recipes.user_id = auth.uid()
                  or recipes.visibility = 'PUBLIC'
              )
        )
    );

-- DELETE bez warunku widoczności przepisu: właściciel zawsze może usunąć własną notatkę
create policy "authenticated users can delete own recipe notes"
    on public.user_recipe_notes
    for delete
    to authenticated
    using (auth.uid() = user_id);

comment on table public.user_recipe_notes is
    'Personal private note (1-2000 chars) of a user attached to a recipe; visible only to its owner';
comment on column public.user_recipe_notes.note is
    'Plain text, trimmed, LF line breaks; never rendered as HTML';
```

**Brak `admin` w politykach** — admin nie ma wglądu w cudze notatki (prywatność, historyjka). Rola `service_role` omija RLS, więc jest używana w funkcjach `public`/`explore` wyłącznie z filtrem `user_id` (pkt 4.2).

### 2.3 RPC `set_recipe_note`

**Dlaczego RPC (a nie zwykły upsert z Edge Function):**

- „pusta notatka = usunięcie" i „upsert" w jednym atomowym wywołaniu, z jedną regułą dostępności (`P0002`),
- **RPC jest wywoływalne bezpośrednio z PostgREST** (`/rest/v1/rpc/set_recipe_note`) przez każdego zalogowanego z kluczem anon, z pominięciem Edge Function. Dlatego **funkcja sama normalizuje i waliduje** (trim, `\r\n` → `\n`, limit 2000), a nie polega wyłącznie na API,
- `security invoker` (jak `set_recipe_flags`): zwraca wyłącznie dane własne, więc nie potrzebuje podwyższonych uprawnień (inaczej niż `set_recipe_rating`).

```sql
create or replace function public.set_recipe_note(
    p_recipe_id bigint,
    p_note text default null
)
returns table (
    out_recipe_id bigint,
    out_note text,
    out_updated_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_user_id uuid := auth.uid();
    v_note text;
begin
    if v_user_id is null then
        raise exception 'Authentication required'
            using errcode = '42501';
    end if;

    -- Normalizacja: LF zamiast CRLF/CR, obcięcie białych znaków na brzegach;
    -- pusty wynik oznacza usunięcie notatki
    v_note := nullif(
        btrim(
            replace(replace(coalesce(p_note, ''), E'\r\n', E'\n'), E'\r', E'\n'),
            E' \t\n'
        ),
        ''
    );

    if v_note is not null and char_length(v_note) > 2000 then
        raise exception 'Note must be at most 2000 characters'
            using errcode = '22023';
    end if;

    -- Dostępność przepisu: własny (dowolna widoczność) albo PUBLIC; bez soft-delete.
    -- Sprawdzana także przy usuwaniu: dla niedostępnego przepisu zwracamy 404 (scenariusz 19).
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

    if v_note is null then
        -- Idempotentne: usunięcie nieistniejącej notatki to też sukces
        delete from public.user_recipe_notes n
        where n.user_id = v_user_id
          and n.recipe_id = p_recipe_id;

        return query select p_recipe_id, null::text, null::timestamptz;
        return;
    end if;

    insert into public.user_recipe_notes as n (user_id, recipe_id, note)
    values (v_user_id, p_recipe_id, v_note)
    on conflict (user_id, recipe_id) do update
        set note = excluded.note
        -- Idempotencja: ta sama treść nie generuje zapisu ani zmiany updated_at
        where n.note is distinct from excluded.note;

    return query
    select n.recipe_id, n.note, n.updated_at
    from public.user_recipe_notes n
    where n.user_id = v_user_id
      and n.recipe_id = p_recipe_id;
end;
$$;

revoke all on function public.set_recipe_note(bigint, text) from public;
revoke all on function public.set_recipe_note(bigint, text) from anon;
grant execute on function public.set_recipe_note(bigint, text) to authenticated;

comment on function public.set_recipe_note(bigint, text) is
    'Idempotent upsert of the caller''s private note of an accessible recipe; empty/null note deletes it. Returns the stored note or NULL.';
```

**Uwagi projektowe:**

- Kolumny wyjściowe z prefiksem `out_` (jak w `set_recipe_flags` — unika niejednoznaczności z kolumnami tabeli).
- `created_at` przy edycji **nie zmienia się** (upsert aktualizuje tylko `note`, a trigger `handle_updated_at` tylko `updated_at`) — scenariusz 5.
- **Kody błędów:** `42501` brak uwierzytelnienia, `22023` zła długość, `P0002` przepis niedostępny/nieistniejący. Nie wprowadzamy nowych kodów.
- **Wyścig:** równoległe pierwsze zapisy tej samej pary rozstrzyga `ON CONFLICT`; wygrywa ostatni zapis (zgodnie z historyjką — brak wykrywania konfliktów między kartami).
- **Przepis niedostępny** (soft-delete, zmiana na `PRIVATE`/`SHARED` przez autora): wiersz notatki **zostaje**, API go nie zwraca (odczyt następuje dopiero po kontroli dostępu do przepisu), a `PUT` daje `404` także dla usunięcia. Świadoma konsekwencja: użytkownik nie może wtedy usunąć „osieroconej" notatki przez API (polityka RLS `DELETE` pozwala, ale endpointu nie wystawiamy); po powrocie przepisu notatka wraca (scenariusz 19). Trwałe usunięcie przepisu/konta kasuje notatki kaskadowo (scenariusz 20).
- **Rola** (`user`/`premium`/`admin`): bez rozróżnień i limitów liczby notatek.
- **Brak zmian w `recipes`:** żaden trigger ani zapis do `recipes`, więc `updated_at`, `search_vector` i job normalizacji nie są ruszane.
- Po migracji **wygenerować ponownie typy**: `supabase/functions/_shared/database.types.ts` oraz `shared/types/database.types.ts` (tabela + RPC), np. `supabase gen types typescript --local > …`.

---

## 3. Nowy endpoint `PUT /recipes/{id}/note`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `PUT` |
| URL | `/functions/v1/recipes/{id}/note` |
| Autoryzacja | Bearer JWT (wymagane); dowolna rola |
| Funkcja Edge | `recipes` (istniejąca; bez zmian w workflow deployu) |
| Idempotencja | Tak — to samo poprawne żądanie zawsze zwraca ten sam wynik `200` |
| Cache | Odpowiedź mutacji z prywatnymi danymi: `Cache-Control: no-store` |

### Parametry

| Parametr | Miejsce | Typ | Opis |
|---|---|---|---|
| `id` | path | integer > 0 | ID przepisu (sam numer, bez sluga — jak w pozostałych endpointach `recipes`) |

### Ciało żądania

```json
{
    "note": "Zmniejszyć ilość cukru o połowę"
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `note` | `string` lub `null` | **tak** | Treść notatki. `null`, `""` lub same białe znaki usuwają notatkę. Pominięcie pola jest błędem |

**Walidacja (Zod `.strict()` + normalizacja po stronie API):**

1. pole `note` musi wystąpić, typ `string | null`; nieznane pola → błąd,
2. techniczny limit surowego wejścia (ochrona przed gigantycznym ciałem): `z.string().max(20000)` przed normalizacją,
3. normalizacja: `\r\n` i `\r` → `\n`, `trim()`; pusty wynik → `null` (usunięcie),
4. długość po normalizacji w **code points** (`Array.from(note).length`, a nie `.length`, które liczy jednostki UTF-16 i zawyżałoby emoji) ≤ `2000`, inaczej `400`.

```typescript
// supabase/functions/_shared/recipe-notes.ts
export const RECIPE_NOTE_MAX_LENGTH = 2000; // zsynchronizowane z shared/contracts/recipe-note.ts i CHECK w bazie

export function normalizeRecipeNote(raw: string | null): string | null {
    if (raw === null) return null;
    const normalized = raw.replace(/\r\n?/g, '\n').trim();
    return normalized.length === 0 ? null : normalized;
}

export function countRecipeNoteCharacters(note: string): number {
    return Array.from(note).length;
}
```

```typescript
// supabase/functions/recipes/recipes.handlers.ts
const setRecipeNoteSchema = z
    .object({
        note: z
            .string({
                required_error: 'note is required',
                invalid_type_error: 'note must be a string or null',
            })
            .max(20000, 'note is too long')
            .nullable(),
    })
    .strict()
    .transform((body, ctx) => {
        const note = normalizeRecipeNote(body.note);
        if (note !== null && countRecipeNoteCharacters(note) > RECIPE_NOTE_MAX_LENGTH) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['note'],
                message: `note must be at most ${RECIPE_NOTE_MAX_LENGTH} characters`,
            });
            return z.NEVER;
        }
        return { note };
    });
```

### Odpowiedź `200 OK`

```json
{
    "recipe_id": 123,
    "note": "Zmniejszyć ilość cukru o połowę",
    "updated_at": "2026-11-09T20:15:00.123456+00:00"
}
```

Po usunięciu (także idempotentnym): `{ "recipe_id": 123, "note": null, "updated_at": null }`.

`note` w odpowiedzi to **zapisana, znormalizowana wartość** (scenariusz 8) — frontend wyświetla dokładnie ją i używa jako źródła prawdy po zapisie.

### Kody odpowiedzi

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200 OK` | — | Notatka zapisana / usunięta (lub stan już zgodny — idempotencja) |
| `400 Bad Request` | `VALIDATION_ERROR` | Niepoprawne `id`, niepoprawny JSON, puste ciało, brak `note`, zły typ, nieznane pole, >2000 znaków po trim |
| `401 Unauthorized` | `UNAUTHORIZED` | Brak lub nieprawidłowy JWT |
| `404 Not Found` | `NOT_FOUND` | Przepis nie istnieje, jest soft-deleted albo niedostępny (cudzy `PRIVATE`/`SHARED`) |
| `405 Method Not Allowed` | `METHOD_NOT_ALLOWED` | Inna metoda na `/recipes/{id}/note` (`Allow: PUT, OPTIONS`) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Błąd bazy danych |

Format błędu: `{ code, message, details }` (istniejący `ApplicationError` + `handleError`). Nie dodajemy nowych `ErrorCode`.

> **Spójność:** `GET /recipes/{id}` zwraca `403` dla cudzego nie-`PUBLIC`, ale `PUT …/note` świadomie zwraca `404` (jak flagi i oceny) — nie ujawniamy istnienia cudzego przepisu, a RPC nie rozróżnia „brak" od „niewidoczny".

### Przepływ

```
parseAndValidateRecipeId(id)            → 400
→ getAuthenticatedContext(req)          → 401
→ req.json() + setRecipeNoteSchema      → 400
→ client.rpc('set_recipe_note', { p_recipe_id, p_note })
    P0002 → 404 NOT_FOUND
    22023 → 400 VALIDATION_ERROR
    42501 → 401 UNAUTHORIZED
    inny  → 500 INTERNAL_ERROR
→ 200 { recipe_id, note, updated_at }
```

Kolejność kroków jak w `handleSetRecipeFlags`/`handleSetRecipeRating` (id przed JWT; zły `id` bez JWT da `400`, a poprawny `id` bez JWT `401`, co zgadza się ze scenariuszem 17).

### Serwis i handler

```typescript
// supabase/functions/recipes/recipes.service.ts
export interface SetRecipeNoteInput {
    recipeId: number;
    note: string | null; // już znormalizowana
}

export async function setRecipeNote(
    client: TypedSupabaseClient,
    input: SetRecipeNoteInput
): Promise<RecipeNoteResponseDto> {
    const { data, error } = await client.rpc('set_recipe_note', {
        p_recipe_id: input.recipeId,
        // pominięty parametr = domyślne NULL po stronie RPC (usunięcie)
        p_note: input.note ?? undefined,
    });

    if (error?.code === 'P0002') {
        throw new ApplicationError('NOT_FOUND', 'Recipe not found');
    }
    if (error?.code === '22023') {
        throw new ApplicationError('VALIDATION_ERROR', 'Note must be at most 2000 characters');
    }
    if (error?.code === '42501') {
        throw new ApplicationError('UNAUTHORIZED', 'Authentication required');
    }

    const row = data?.[0];
    if (error || !row) {
        logger.error('Error setting recipe note', {
            errorCode: error?.code,
            errorMessage: error?.message,
            recipeId: input.recipeId,
        });
        throw new ApplicationError('INTERNAL_ERROR', 'Failed to set recipe note');
    }

    return {
        recipe_id: Number(row.out_recipe_id),
        note: row.out_note ?? null,
        updated_at: row.out_updated_at ?? null,
    };
}
```

`handleSetRecipeNote(req, recipeIdParam)` — analogicznie do `handleSetRecipeRating`; loguje wyłącznie `userId`, `recipeId` i **długość** notatki, **nigdy treść** (prywatne dane). Odpowiedź przez wariant `createSuccessResponse` z nagłówkiem `Cache-Control: no-store`.

### Routing w `recipesRouter`

- Dodać `extractRecipeIdFromNotePath(url)` z wzorcem `/\/recipes\/([^/]+)\/note\/?$/` (analogicznie do `extractRecipeIdFromRatingPath`).
- Zmienna `noteRecipeId` obliczana obok `flagsRecipeId` / `ratingRecipeId`; blok `if (noteRecipeId)` **przed** gałęziami `GET`/`POST` (jak flagi/oceny): `PUT` → handler, inne metody → `405` z `Allow: PUT, OPTIONS`.
- **Uwaga:** `extractRecipeIdFromPath` dopasowuje `/recipes/([^/]+)$`, więc `/recipes/1/note` nie jest mylone z ID — ale blok `if (noteRecipeId)` musi stać przed `GET`, aby `GET /recipes/1/note` nie trafił do `handleGetRecipes` (lista) → `405`.
- CORS: `Access-Control-Allow-Methods` zawiera już `PUT`. Zaktualizować komentarz `recipesRouter` i nagłówek `recipes/index.ts` (obecnie wymienia `rating`, nie wymienia `flags`; dopisać `flags` i `note`).

---

## 4. Zmiany w endpointach odczytu (tylko szczegóły)

### 4.1 Zakres pól

| Endpoint | Funkcja / plik | Klient do odczytu notatki | Dla gościa |
|---|---|---|---|
| `GET /recipes/{id}` | `recipes.service.ts` → `getRecipeById` — **obie** ścieżki (RLS oraz `PUBLIC` przez service role; odczyt notatki zawsze klientem użytkownika `client`) | uwierzytelniony (RLS `select` zawęża do własnych) + jawny `.eq('user_id', …)` | n/d (wymaga JWT) |
| `GET /explore/recipes/{id}` | `explore.service.ts` → `getExploreRecipeById` — **obie** gałęzie zwrotu (`PUBLIC` i autor) | service role + **obowiązkowy** `.eq('user_id', requesterUserId)` | pole **pominięte** |
| `GET /public/recipes/{id}` | `public.service.ts` → `getPublicRecipeById` | service role + **obowiązkowy** `.eq('user_id', userId)` | pole **pominięte** |

Notatka jest czytana **dopiero po** przejściu kontroli dostępu do przepisu (404/403 przed odczytem), więc niedostępny przepis nigdy nie ujawnia notatki (scenariusz 19).

### 4.2 Wspólny pomocnik `_shared/recipe-notes.ts`

Jedna implementacja zamiast kopii w trzech serwisach (jak `recipe-flags.ts`, `recipe-ratings.ts`). Szczegóły to jeden przepis, więc zapytanie pojedyncze (bez mapy):

```typescript
/**
 * Zwraca własną notatkę zalogowanego użytkownika do przepisu.
 *  - string  → notatka istnieje
 *  - null    → użytkownik jest zalogowany i notatki nie ma
 *  - undefined → brak odczytu (gość LUB błąd bazy) — pole my_note jest wtedy POMIJANE w JSON
 */
export async function getMyRecipeNote(
    client: TypedSupabaseClient,
    recipeId: number,
    userId: string | null
): Promise<string | null | undefined> {
    if (userId === null) return undefined;

    try {
        const { data, error } = await client
            .from('user_recipe_notes')
            .select('note')
            .eq('user_id', userId)
            .eq('recipe_id', recipeId)
            .maybeSingle();

        if (error) {
            logger.error('Error fetching own recipe note', {
                errorCode: error.code,
                errorMessage: error.message,
                userId,
                recipeId,
            });
            return undefined;
        }
        return data?.note ?? null;
    } catch (error) {
        logger.error('Unexpected error fetching own recipe note', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            recipeId,
        });
        return undefined;
    }
}
```

**Dlaczego błąd odczytu → `undefined`, a nie `null`:** helpery flag i ocen przy błędzie zwracają „brak danych" (`false`/`null`), co dla flag jest nieszkodliwe. Dla notatki byłoby **groźne**: UI pokazałoby „Dodaj notatkę", a zapis nadpisałby istniejącą, niewidoczną notatkę (utrata danych). Dlatego przy błędzie pole `my_note` jest pomijane, a frontend dla zalogowanego **ukrywa sekcję notatki**, gdy `my_note === undefined` (patrz plan UI). Odczyt pozostaje nieblokujący dla reszty szczegółów przepisu (jak flagi/oceny).

### 4.3 Mapowanie w serwisach

Zawsze **warunkowo** (klucz nieobecny dla gościa i przy błędzie odczytu):

```typescript
...(myNote !== undefined && { my_note: myNote }),
```

- `recipes.service.ts`: dodać `getMyRecipeNote(client, id, requesterUserId)` do obu bloków `Promise.all` w `getRecipeById`; `mapToRecipeDetailDto(..., myNote)` jako dodatkowy argument.
- `explore.service.ts`: dodać `getMyRecipeNote(client, recipeId, requesterUserId)` do **obu** `Promise.all` (gałąź `PUBLIC` i gałąź autora); `mapToDto(..., myNote)`.
- `public.service.ts`: do `Promise.all` w bloku `if (userId !== null)`; `myNote` do obiektu `recipeDto`.
- Brak maski względem `visibility` (w odróżnieniu od ocen): notatka jest dozwolona dla każdego przepisu dostępnego użytkownikowi, a niedostępne nie dochodzą do mapowania.

### 4.4 Skutek uboczny: `POST /recipes` i `PUT /recipes/{id}`

`createRecipe` i `updateRecipe` kończą wywołaniem `getRecipeById`, więc ich odpowiedzi zyskają `my_note` „za darmo" (po edycji przepisu nie zgubimy notatki w stanie UI; po utworzeniu będzie `null`). Koszt: jedno tanie zapytanie po PK. **Edycja przepisu nie dotyka notatki** — formularz nie ma pola notatki, `PUT /recipes/{id}` jej nie przyjmuje.

### 4.5 Kontrakt DTO

```typescript
// shared/contracts/types.ts

/** Ciało PUT /recipes/{id}/note. null / "" / same białe znaki usuwają notatkę. */
export interface SetRecipeNoteRequestDto {
    note: string | null;
}

/** Odpowiedź PUT /recipes/{id}/note: zapisany, znormalizowany stan. */
export interface RecipeNoteResponseDto {
    recipe_id: number;
    /** Zapisana notatka po trim/normalizacji; null po usunięciu. */
    note: string | null;
    /** Czas ostatniego zapisu notatki; null po usunięciu. */
    updated_at: string | null;
}
```

```typescript
// shared/contracts/recipe-note.ts (nowy plik w stylu marketing-consent.ts — stała współdzielona z frontendem)
export const RECIPE_NOTE_MAX_LENGTH = 2000;
```

Rozszerzenia istniejących DTO (`RecipeDetailDto`, `PublicRecipeDetailDto`):

```typescript
/** Prywatna notatka zalogowanego użytkownika; pominięta dla gościa i gdy odczyt się nie powiódł. */
my_note?: string | null;
```

Lustrzane typy lokalne w Edge Functions należy rozszerzyć tak samo: `RecipeDetailDto` w `recipes.service.ts`, `RecipeDetailDto` w `explore.service.ts`, `PublicRecipeDetailDto` w `public.service.ts`. Odpowiedź `PUT` (`RecipeNoteResponseDto`) w Edge Functions definiujemy w `_shared/recipe-notes.ts` (jak `RecipeRatingDto` w `_shared/recipe-ratings.ts`; funkcje nie importują `shared/contracts`).

### 4.6 Cache

Reguły z PS-95/PS-99 **wystarczają**:

- `GET /explore/recipes/{id}` z JWT → `no-store`; gość dostaje `public, max-age=60`, ale bez `my_note`,
- `GET /public/recipes/{id}` → `createCachedResponse(recipe, userId !== null)` (z JWT `no-store`); wrapper dopisuje `Vary: Authorization`,
- `GET /recipes/{id}` nie ustawia dziś `Cache-Control`. Dla prywatnych danych (`my_note`) **zalecane** dodanie `Cache-Control: no-store` do `handleGetRecipeById` (nowy opcjonalny argument nagłówków w lokalnym `createSuccessResponse`, bez zmiany zachowania pozostałych handlerów) oraz do odpowiedzi `PUT …/note`.

---

## 5. Bezpieczeństwo i prywatność

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt notatek innego użytkownika (w tym autora przepisu i admina) | RLS `auth.uid() = user_id` na `SELECT/INSERT/UPDATE/DELETE`; brak polityki dla `admin`/`anon`; w funkcjach z service role (`public`, `explore`) obowiązkowy `.eq('user_id', userId)`, a `userId` pochodzi wyłącznie z zweryfikowanego JWT |
| Zapis w imieniu kogoś innego | Brak `user_id` w schemacie żądania (`.strict()`), tożsamość z `auth.uid()` w RPC i RLS |
| Zapis do niedostępnego przepisu (cudzy `PRIVATE`/`SHARED`, soft-deleted) | Jawny `exists` w RPC + `WITH CHECK` w RLS → `404` |
| Ujawnienie istnienia cudzego przepisu | `404` zamiast `403` |
| Obejście walidacji przez bezpośredni PostgREST | RPC normalizuje i waliduje samo (`22023`), `CHECK char_length` w tabeli; bezpośredni `INSERT` jest dopuszczony przez RLS tylko dla własnych danych z tym samym limitem |
| XSS (`<script>`, Markdown, HTML) | Treść przechowywana dosłownie, API nie interpretuje; frontend renderuje wyłącznie przez interpolację (nigdy `innerHTML`) |
| Wyciek przez cache | Odpowiedzi z JWT `no-store`; gość nigdy nie dostaje `my_note`; zalecenie z pkt 4.6 |
| Wyciek przez logi | Logujemy `userId`, `recipeId`, długość; **nie** treść notatki |
| Gigantyczne ciało żądania | Limit surowego wejścia 20 000 znaków przed normalizacją; Supabase ma też limit rozmiaru ciała |
| Nadużycie (spam żądań) | Operacja tania (jeden wiersz, limit 2000 znaków); brak dodatkowego rate limitu w zakresie PS-31 |
| Wpływ na przepis | Brak zapisu do `recipes` → `updated_at`, `search_vector`, joby normalizacji bez zmian |

---

## 6. Kody błędów — podsumowanie

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | `PUT /recipes/{id}/note` | Niepoprawne `id`/JSON/ciało, typ, nieznane pole, >2000 znaków po trim |
| `401` | `UNAUTHORIZED` | `PUT /recipes/{id}/note` | Brak lub nieważny JWT |
| `404` | `NOT_FOUND` | `PUT /recipes/{id}/note` | Przepis nieistniejący lub niedostępny |
| `405` | `METHOD_NOT_ALLOWED` | `/recipes/{id}/note` | Metoda inna niż `PUT` |

---

## 7. Testy (backend)

Testy Edge Functions w repo to **testy Deno** (`*.test.ts` obok kodu, np. `recipe-flags.test.ts`), uruchamiane `deno test --allow-all` — **nie** przez Vitest i **nie** w `main-deploy.yml` (job `test` uruchamia tylko `npm run test:run` z `src/**`). Uruchomić je ręcznie przed merge'em (patrz plan wdrożenia).

| Obszar | Scenariusz akceptacji |
|---|---|
| `normalizeRecipeNote` | `"  Mniej soli\r\n\r\nWięcej pieprzu  "` → `"Mniej soli\n\nWięcej pieprzu"` (sc. 8); `""`, `"   "`, `"\n\r\n"`, `null` → `null` (sc. 7); pojedynczy `\r` → `\n` |
| `countRecipeNoteCharacters` | 2000 znaków z emoji (`😀` = 1) → 2000 i akceptowane; 2001 → odrzucone (sc. 9); `.length` nie jest używane |
| `setRecipeNoteSchema` | Brak `note`, `123`, `true`, `{}`, nieznane pole, `>2000` po trim → `400`; `null`, `""`, 2000 znaków → OK (sc. 21) |
| `setRecipeNoteSchema` | Treść z `<script>alert(1)</script>`, `**b**` przechodzi bez zmian (sc. 10) |
| `setRecipeNote` (serwis, mock RPC) | Zapis → `{ recipe_id, note, updated_at }`; usunięcie → `note: null, updated_at: null`; `P0002` → `NOT_FOUND`; `22023` → `VALIDATION_ERROR`; `42501` → `UNAUTHORIZED`; inny błąd/brak wiersza → `INTERNAL_ERROR` |
| `getMyRecipeNote` | Gość → `undefined`, **brak zapytania**; brak wiersza → `null`; wiersz → tekst; błąd bazy → `undefined` + log; zapytanie zawiera `eq('user_id')` |
| Serwisy szczegółów (`recipes`, `explore` — obie gałęzie, `public`) | Zalogowany: `my_note` obecne (`string` lub `null`); gość: klucz **nieobecny** w JSON; błąd odczytu: klucz nieobecny (sc. 16, 17) |
| Router | `PUT /recipes/{id}/note` kieruje do handlera; `GET/POST/DELETE /recipes/{id}/note` → `405` (nie lista, nie szczegóły); `PUT` bez JWT → `401` |
| Logowanie | Brak treści notatki w logach (asercja na wywołaniach `logger`) |
| **RLS / RPC (test integracyjny na lokalnym Supabase, SQL jako dany użytkownik)** | A i B: każdy `select` widzi tylko własne wiersze (sc. 16); B zapisuje notatkę do publicznego przepisu A → `200`; A zapisuje do własnego `PRIVATE` → `200`; B do `PRIVATE`/`SHARED` A → `404` i brak wiersza (sc. 4); bezpośredni `insert` jako B do cudzego `PRIVATE` odrzucony przez RLS; `select` wiersza A jako B pusty, `update`/`delete` wiersza A jako B nie zmienia nic |
| RLS / RPC — cykl życia | Edycja: `created_at` bez zmian, `updated_at` rośnie (sc. 5); ten sam tekst ponownie → `updated_at` bez zmian (idempotencja); `null` ×2 → oba `200` (sc. 7); zmiana przepisu na `PRIVATE` → `PUT` `404`, wiersz zostaje, po powrocie do `PUBLIC` odczyt zwraca notatkę (sc. 19); hard delete przepisu / użytkownika → CASCADE (sc. 20); soft delete nie kasuje wiersza |
| RPC bezpośrednio z PostgREST | `rpc/set_recipe_note` z `p_note` >2000 → błąd `22023`; z `"  x  "` → zapis `"x"`; jako `anon` → brak uprawnień |
| Brak wpływu na przepis | `recipes.updated_at`, `search_vector`, `normalized_ingredients_status` bez zmian po `PUT note` (sc. 23); wyszukiwanie fragmentu notatki nie zwraca przepisu |
| Regresja | Odpowiedzi list i widoku `recipe_details` bez zmian; `POST/PUT /recipes` nadal poprawne i zwracają `my_note` |

---

## 8. Checklist implementacji (API)

- [ ] Migracja `20261109120000_create_user_recipe_notes.sql` (tabela, indeks, trigger, RLS, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `_shared/recipe-notes.ts` (`getMyRecipeNote`, `normalizeRecipeNote`, `countRecipeNoteCharacters`, stała, typ odpowiedzi) + testy Deno
- [ ] `setRecipeNote` (serwis) + `handleSetRecipeNote` + `setRecipeNoteSchema` + routing `PUT` i `405` dla pozostałych metod
- [ ] `my_note` w `getRecipeById` (obie ścieżki), `getExploreRecipeById` (**obie gałęzie**), `getPublicRecipeById`
- [ ] `Cache-Control: no-store` dla `GET /recipes/{id}` i `PUT …/note`
- [ ] Rozszerzenie `shared/contracts/types.ts`, nowy `shared/contracts/recipe-note.ts` i lokalnych typów w trzech serwisach
- [ ] Komentarze nagłówkowe `recipes/index.ts` i `recipesRouter`
- [ ] Testy (pkt 7), w tym test integracyjny RLS/RPC na dwóch kontach

---

## 9. Poza zakresem PS-31

| Element | Uwaga |
|---|---|
| Notatka w listach, wskaźnik na kafelkach, filtr „z notatką" | Osobna historyjka |
| Wyszukiwanie po treści notatki, uwzględnienie w AI / planie / liście zakupów / wydruku / eksporcie | Poza zakresem (notatka jest prywatna) |
| Notatki do cudzych przepisów `SHARED` | Wymaga wcześniejszej zmiany RLS przepisów; predykat notatki trzeba wtedy rozszerzyć w tej samej historyjce |
| Historia wersji, konflikty między kartami, współdzielenie notatek | Poza zakresem (ostatni zapis wygrywa) |
| Usuwanie „osieroconych" notatek przy niedostępnym przepisie | Poza zakresem (wiersz wraca razem z przepisem lub jest kasowany kaskadowo) |
| Limity i różnice między rolami | Brak |
