# API Endpoints Implementation Plan: PS-99 — Ocenianie przepisu w skali 1–5

> **Historyjka:** PS-99 (`docs/results/new-features/user-stories/PS-99/PS-99-recipe-rating-user-story.md`)
> **Specyfikacja API:** `docs/results/new-features/user-stories/PS-99/PS-99-recipe-rating-api-plan.md` (pełny SQL migracji w sekcji 2)
> **Plan wdrożenia produkcyjnego:** `docs/results/new-features/user-stories/PS-99/PS-99-recipe-rating-deployment-plan.md`
> **Wzorzec:** PS-95 (`docs/results/impl-plans/endpoints/ps95-recipe-favorite-and-try-flags-api-implementation-plan.md`)
> **Stan kodu zweryfikowany:** październik 2026 (ostatnia migracja `20261010120000_create_user_recipe_flags.sql`)

---

## 1. Przegląd punktów końcowych

Zakres: **jeden nowy endpoint zapisu** i **rozszerzenie trzech istniejących endpointów odczytu szczegółów**. Wszystko działa w istniejących Edge Functions (`recipes`, `public`, `explore`). Nie dochodzi nowa funkcja ani krok w `.github/workflows/main-deploy.yml`.

| # | Endpoint | Funkcja Edge | Typ zmiany | Cel |
|---|---|---|---|---|
| A | `PUT /recipes/{id}/rating` | `recipes` | **Nowy** | Idempotentne ustawienie (`1..5`), zmiana lub wycofanie (`null`) oceny |
| B1 | `GET /recipes/{id}` | `recipes` | Rozszerzenie | `average_rating`, `ratings_count`, `my_rating` |
| B2 | `GET /explore/recipes/{id}` | `explore` | Rozszerzenie | j.w.; z niego korzysta widok `/explore/recipes/:id-:slug` |
| B3 | `GET /public/recipes/{id}` | `public` | Rozszerzenie | j.w. |

Dodatkowo:

- **Baza:** tabela `recipe_ratings` (RLS), dwie nowe kolumny widoku `recipe_details` (`ratings_count`, `average_rating`) i RPC `set_recipe_rating` (migracja `20261027120000_create_recipe_ratings.sql`).
- **Współdzielony moduł:** `supabase/functions/_shared/recipe-ratings.ts` (zbiorczy odczyt własnych ocen i mapper pól ocen).
- **Kontrakt:** `shared/contracts/types.ts` oraz lokalne DTO w `recipes.service.ts`, `explore.service.ts` i `public.service.ts`.

**Bez zmian:** listy (`GET /recipes`, `/recipes/feed`, `/public/recipes`, `/public/recipes/feed`), `GET /collections/{id}`, `GET /search/global`, `GET /plan`, tabela `recipes`, RPC `get_recipes_list`, `search_vector`, joby normalizacji. Ocena **nie zmienia** `recipes.updated_at`.

### Ustalenia z weryfikacji kodu (korekty względem planu API)

| # | Ustalenie | Konsekwencja dla wdrożenia |
|---|---|---|
| 1 | `extractRecipeIdFromPath` używa wzorca `/\/recipes\/([^/]+)$/`, więc `/recipes/123/rating` **nie** daje `recipeId`. Bez dedykowanej gałęzi: `GET /recipes/123/rating` zwróci **listę przepisów**, a `POST` **utworzy przepis**. | Gałąź `ratingRecipeId` sprawdzana **po `OPTIONS`, a przed blokami metod**, obsługująca każdą metodę (jak `flagsRecipeId`, `recipes.handlers.ts` ok. linii 1817). Obowiązkowy test routera. |
| 2 | DTO szczegółów **nie są współdzielone**. `RecipeDetailDto` ma lokalne kopie w `recipes.service.ts` (linia 170) i `explore.service.ts` (linia 84), a `PublicRecipeDetailDto` jest w `public.service.ts` (linia 183), **nie** w `public.types.ts` (tam go nie ma). | Pola ocen trzeba dopisać w czterech miejscach: kontrakt + trzy kopie lokalne. |
| 3 | Stałe `RECIPE_DETAIL_SELECT_COLUMNS` są **trzy** (`recipes.service.ts:252`, `explore.service.ts:141`, `public.service.ts:303`) i wybierają jawne kolumny. | Bez dopisania `ratings_count, average_rating` agregaty się nie pojawią (a podzapytania widoku nie będą liczone). |
| 4 | `getRecipeById` jest wołane także na końcu `createRecipe` (ok. linii 1295) i `updateRecipe` (ok. linii 1466). | Odpowiedzi `POST /recipes`, `PUT /recipes/{id}` i importu **automatycznie** dostaną pola ocen. To zamierzone i nie wymaga osobnej pracy, ale trzeba to uwzględnić w testach i kontrakcie. |
| 5 | `handleGetPublicRecipeById` **już** używa `createCachedResponse(recipe, userId !== null)` (poprawka z PS-95 jest wdrożona), a `handleGetExploreRecipeById` ustawia `no-store` dla zalogowanego. | **Bez zmian w nagłówkach cache.** Gość może zobaczyć agregat opóźniony do 60 s (akceptowane). |
| 6 | Widok `recipe_details` nie ma `security_invoker` (żadna migracja go nie ustawia), a ostatnia jego definicja to `20260118120300`. Od tamtej pory żadna migracja widoku nie dotykała. | `create or replace view` z kolumnami **dopisanymi na końcu** jest poprawne. Agregaty liczą się z uprawnieniami właściciela widoku (widzą wszystkie oceny), co jest zamierzone. |
| 7 | `getRecipeById` ścieżką „Step A" zwraca dane przez widok, więc w odpowiedzi może trafić przepis niepubliczny (autor). | Maska `PUBLIC` / niepubliczny jest stosowana **bezwarunkowo** po `visibility` wiersza, niezależnie od ścieżki zwrotu. |
| 8 | `RecipeDetailDto` w kontrakcie jest wyprowadzony z typu wiersza widoku (`Omit<RecipeDetail, …>`). Po regeneracji typów `average_rating` i `ratings_count` staną się wymagane w tym typie. | Trzeba je **nadpisać** w `Omit` (patrz pkt 3) i sprawdzić kompilację frontendu. Obiekty `RecipeDetailDto` budowane w testach frontendu (`recipe-import-page.component.spec.ts`) mogą wymagać uzupełnienia. |
| 9 | Testy backendu w repo to testy **Deno** (`recipes.service.test.ts`, `_shared/recipe-flags.test.ts`), nie Vitest. CI ich nie uruchamia. | Testy backendu piszemy w Deno, wzorując się na `recipe-flags.test.ts`, i uruchamiamy lokalnie (`deno test`). |

---

## 2. Szczegóły żądania

### A. `PUT /recipes/{id}/rating` (nowy)

- **Metoda HTTP:** `PUT`
- **Struktura URL:** `/functions/v1/recipes/{id}/rating`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), dowolna rola (`user`, `premium`, `admin`)
- **Parametry:**
    - Wymagane: `id` (path), liczba całkowita > 0 (sam numer, bez sluga, jak w pozostałych endpointach `recipes`)
    - Opcjonalne: brak
- **Request Body** (`Content-Type: application/json`):

```json
{
    "rating": 4
}
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `rating` | integer `1..5` lub `null` | **tak** | Ocena. `null` wycofuje ocenę użytkownika. Pominięcie pola jest błędem |

**Walidacja (zod, `.strict()`):**

- pole `rating` musi wystąpić (inaczej błąd),
- dozwolone: liczba całkowita 1–5 albo `null`,
- odrzucane: `0`, `6`, `4.5`, `"4"`, `true`, brak pola, nieznane pola (m.in. `user_id`, `recipe_id`), niepoprawny JSON,
- niepoprawne `id` (nie-liczba, `0`, ujemne, ułamek) → `parseAndValidateRecipeId`.

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

> Uwaga: `z.number().nullable()` z `required_error` odrzuca brak pola (`undefined`), ale akceptuje `null`. Ten przypadek ma osobny test (pkt 9, krok 10).

### B. Rozszerzone endpointy odczytu

Żadnych nowych parametrów, nagłówków ani zmian w ciele żądań. Zmiana dotyczy wyłącznie odpowiedzi. Tożsamość użytkownika pochodzi **wyłącznie** ze zweryfikowanego JWT (`getAuthenticatedContext` / `getOptionalAuthenticatedUser`).

---

## 3. Wykorzystywane typy

### Nowe — `shared/contracts/types.ts`

```typescript
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

/** Command model dla PUT /recipes/{id}/rating. `null` wycofuje ocenę. */
export interface UpdateRecipeRatingCommand {
    rating: number | null;
}
```

### Rozszerzenia istniejących DTO

| DTO | Lokalizacje do zmiany | Nowe pola |
|---|---|---|
| `RecipeDetailDto` | `shared/contracts/types.ts` (**nadpisanie** kolumn widoku w `Omit`), `recipes.service.ts:170`, `explore.service.ts:84` | `average_rating: number \| null`, `ratings_count: number \| null`, `my_rating?: number \| null` |
| `PublicRecipeDetailDto` | `shared/contracts/types.ts`, `public.service.ts:183` | `average_rating: number \| null`, `ratings_count: number`, `my_rating?: number \| null` |

W `shared/contracts/types.ts` zmiana `Omit` wygląda tak:

```typescript
export type RecipeDetailDto = Omit<
    RecipeDetail,
    'ingredients' | 'steps' | 'tips' | 'tags' | 'collections' | 'average_rating' | 'ratings_count'
> & {
    // ...dotychczasowe pola...
    /** Średnia ocen (1 miejsce po przecinku); null gdy brak ocen lub przepis niepubliczny. */
    average_rating: number | null;
    /** Liczba ocen; null, gdy ocen nie udostępniamy (przepis PRIVATE/SHARED). */
    ratings_count: number | null;
    /** Własna ocena zalogowanego (1-5 lub null). Pole nieobecne dla gościa. */
    my_rating?: number | null;
};
```

`PublicRecipeDetailDto` ma `visibility: 'PUBLIC'`, więc `ratings_count` jest tam zawsze liczbą.

### Typy wewnętrzne backendu

```typescript
// supabase/functions/_shared/recipe-ratings.ts
export interface RecipeRatingFields {
    average_rating: number | null;
    ratings_count: number | null;
    my_rating?: number | null;
}

// recipes.service.ts
export interface SetRecipeRatingInput {
    recipeId: number;
    rating: number | null;
}
```

`RecipeRatingDto` jest eksportowany z `_shared/recipe-ratings.ts` (jak `RecipeFlagsDto` w `_shared/recipe-flags.ts`), a jego lustro leży w kontrakcie.

### Typy bazy

Po migracji ponownie wygenerować typy (tabela `recipe_ratings`, RPC `set_recipe_rating`, nowe kolumny widoku):

- `supabase/functions/_shared/database.types.ts`
- `shared/types/database.types.ts`

`ErrorCode` w `_shared/errors.ts` **nie wymaga zmian**. Używamy istniejących: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `METHOD_NOT_ALLOWED` (405), `INTERNAL_ERROR` (500).

---

## 4. Szczegóły odpowiedzi

### A. `PUT /recipes/{id}/rating`

**`200 OK`** zawsze zwraca pełny, aktualny stan. Frontend traktuje go jako źródło prawdy po zapisie.

```json
{
    "recipe_id": 123,
    "my_rating": 4,
    "average_rating": 4.3,
    "ratings_count": 27
}
```

Wycofanie oceny: `"my_rating": null`, agregaty bez własnej oceny. Wycofanie ostatniej oceny: `"my_rating": null, "average_rating": null, "ratings_count": 0`.

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200` | — | Ocena zapisana / zmieniona / wycofana lub stan już zgodny (idempotencja) |
| `400` | `VALIDATION_ERROR` | Niepoprawne `id`, niepoprawny JSON, brak `rating`, wartość spoza `1..5`/`null`, nieznane pole |
| `401` | `UNAUTHORIZED` | Brak lub nieprawidłowy JWT |
| `403` | `FORBIDDEN` | Użytkownik jest autorem przepisu (scenariusz 5) |
| `404` | `NOT_FOUND` | Przepis nie istnieje, jest soft-deleted albo nie jest `PUBLIC` (scenariusz 6) |
| `405` | `METHOD_NOT_ALLOWED` | Metoda inna niż `PUT` na `/recipes/{id}/rating` (`Allow: PUT, OPTIONS`) |
| `500` | `INTERNAL_ERROR` | Błąd bazy danych |

Odpowiedź mutacji, bez nagłówków cache. Format błędu: `{ "code": "...", "message": "..." }` (istniejące `handleError`).

> Dla niewidocznego przepisu zwracamy `404` (nie `403`), aby nie ujawniać istnienia cudzego przepisu prywatnego. `403` pojawia się wyłącznie dla autora, który i tak zna swój przepis.

### B. Rozszerzone odpowiedzi odczytu

Statusy i kody błędów istniejących endpointów **bez zmian**.

| Endpoint | Zalogowany | Gość |
|---|---|---|
| `GET /recipes/{id}` | `average_rating`, `ratings_count`, `my_rating` (zawsze obecne) | n/d (wymaga JWT) |
| `GET /explore/recipes/{id}` | j.w. | `average_rating`, `ratings_count` **obecne**, `my_rating` **nieobecny** |
| `GET /public/recipes/{id}` | j.w. | j.w. |

Maska według widoczności przepisu (stosowana przy mapowaniu, niezależnie od ścieżki):

| Przepis | `average_rating` | `ratings_count` | `my_rating` |
|---|---|---|---|
| `PUBLIC`, bez ocen | `null` | `0` | `null` (zalogowany) / brak klucza (gość) |
| `PUBLIC`, z ocenami | liczba (1 miejsce po przecinku) | liczba całkowita | `1..5` lub `null` |
| `PRIVATE` / `SHARED` (widzi tylko autor) | `null` | `null` | `null` |

`ratings_count: null` odróżnia „oceny niedostępne dla tego przepisu" od „publiczny przepis bez głosów". Dla gościa klucz `my_rating` nie występuje w JSON (wartość `undefined` jest pomijana przez `JSON.stringify`).

**Nagłówki cache (bez zmian):**

| Endpoint | Gość | Zalogowany |
|---|---|---|
| `GET /public/recipes/{id}` | `public, max-age=60` | `no-store` |
| `GET /explore/recipes/{id}` | `public, max-age=60` (tylko `PUBLIC`) | `no-store` |

---

## 5. Przepływ danych

### A. `PUT /recipes/{id}/rating`

```
Klient (Angular)
  → PUT /functions/v1/recipes/{id}/rating  { rating: 1..5 | null }
recipes/index.ts            → CORS, deleguje do recipesRouter
recipesRouter               → extractRecipeIdFromRatingPath → handleSetRecipeRating
handleSetRecipeRating
  1. parseAndValidateRecipeId(id)                      → 400
  2. getAuthenticatedContext(req) (client + user)      → 401
  3. req.json() + setRecipeRatingSchema.safeParse      → 400
  4. setRecipeRating(client, { recipeId, rating })
setRecipeRating (recipes.service.ts)
  → client.rpc('set_recipe_rating', { p_recipe_id, p_rating })
      P0002 → NOT_FOUND (404)
      P0403 → FORBIDDEN (403)
      22023 → VALIDATION_ERROR (400)
      42501 → UNAUTHORIZED (401)
      inny / brak danych → INTERNAL_ERROR (500)
  → RecipeRatingDto
handleSetRecipeRating       → logger.info + 200 JSON
```

Wewnątrz RPC `set_recipe_rating` (`security definer`, `search_path = ''`):

1. `auth.uid()` null → `42501`.
2. `p_rating` poza `1..5` (i nie `null`) → `22023`.
3. Przepis musi istnieć i mieć `deleted_at is null`, inaczej `P0002`.
4. Autor przepisu (`recipes.user_id = auth.uid()`) → `P0403`. Sprawdzane **przed** widocznością, także dla przepisu niepublicznego i dla `admin`.
5. Cudzy przepis nie-`PUBLIC` → `P0002` (nie ujawniamy istnienia).
6. `p_rating is null` → `DELETE` własnego wiersza. W przeciwnym razie `INSERT … ON CONFLICT (user_id, recipe_id) DO UPDATE … WHERE rating is distinct from excluded.rating` (idempotencja bez zbędnego zapisu).
7. Zwrot `out_recipe_id`, `out_my_rating`, `out_average_rating`, `out_ratings_count` (`avg` zaokrąglone do 1 miejsca, `count` jako `integer`).

Zapis **nie dotyka** tabeli `recipes`, więc `recipes.updated_at`, `search_vector`, `normalized_ingredients_status` i joby normalizacji pozostają bez zmian.

### B. Odczyt ocen w endpointach GET

```
serwis (getRecipeById / getExploreRecipeById / getPublicRecipeById)
  → agregaty: kolumny `ratings_count, average_rating` z widoku recipe_details (to samo zapytanie co dotąd)
  → [równolegle z planem / kolekcjami / flagami]
  → getMyRatingsMap(client, [id], userId)               // 1 zapytanie
        userId === null lub pusta lista → pusta mapa, bez zapytania
        błąd bazy → log + pusta mapa (nieblokujące, jak getRecipeFlagsMap)
  → buildRatingFields(row, myRatingsMap.get(id), isAuthenticated)
        PUBLIC: agregaty + my_rating (tylko zalogowany)
        nie-PUBLIC: wszystkie null
```

**Wybór klienta:**

| Funkcja | Klient | Uwaga |
|---|---|---|
| `recipes` | uwierzytelniony (JWT użytkownika) | RLS zawęża do własnych wierszy; jawny `.eq('user_id', userId)` jako druga warstwa |
| `public`, `explore` | service role | RLS pominięty, więc `.eq('user_id', userId)` jest **obowiązkowy**; `userId` wyłącznie z `getOptionalAuthenticatedUser(req)` |

---

## 6. Względy bezpieczeństwa

| Zagrożenie | Mitygacja |
|---|---|
| Odczyt ocen innych użytkowników | RLS `select` tylko własne wiersze; agregaty wyłącznie jako liczby (widok, RPC); `getMyRatingsMap` z obowiązkowym `.eq('user_id', userId)` |
| Zapis oceny w imieniu kogoś innego | Brak `user_id` w schemacie (`.strict()`), tożsamość z `auth.uid()` w RPC i politykach RLS |
| Ocena własnego przepisu (także przez `admin`) | Jawny test autora w RPC → `403`; dodatkowo `recipes.user_id <> auth.uid()` w `WITH CHECK` |
| Ocena przepisu niepublicznego / usuniętego | Test widoczności w RPC → `404`; dodatkowo `WITH CHECK` w RLS |
| Ujawnienie istnienia cudzego przepisu prywatnego | `404` zamiast `403` |
| Eskalacja uprawnień przez `security definer` | `set search_path = ''`, w pełni kwalifikowane nazwy, brak parametru `user_id`, `revoke … from public, anon`, `grant execute … to authenticated` |
| Wyciek `my_rating` przez cache | Odpowiedzi z JWT `no-store`; gość nigdy nie dostaje `my_rating`; `Vary: Authorization` dodaje wrapper w `public/index.ts` |
| Wartości spoza zakresu / typu | Zod + walidacja w RPC + `CHECK (rating between 1 and 5)` |
| Przypadkowe wykonanie innej akcji na ścieżce `/rating` | Dedykowana gałąź routera z `405` dla każdej metody ≠ `PUT` |
| Wstrzyknięcie SQL | Parametry RPC typowane (`bigint`, `smallint`); brak interpolacji SQL |
| Manipulowanie średnią (wiele kont) | Jedna ocena na konto (PK `(user_id, recipe_id)`). **Brak rate limitu w zakresie PS-99** (operacja tania); monitorować nadużycia |
| Wpływ na przepis / indeksy | Brak zapisu do `recipes` |
| Logowanie danych wrażliwych | Logi zawierają tylko `userId`, `recipeId`, kody błędów |

---

## 7. Obsługa błędów

### A. `PUT /recipes/{id}/rating`

| Scenariusz | Wykrycie | Kod HTTP / `code` | Test |
|---|---|---|---|
| Niepoprawne `id` (`abc`, `0`, `-1`, `1.5`) | `parseAndValidateRecipeId` | `400 VALIDATION_ERROR` | tak |
| Niepoprawny JSON | `try/catch` na `req.json()` | `400 VALIDATION_ERROR` | tak |
| Brak pola `rating` (`{}`) | zod `required_error` | `400 VALIDATION_ERROR` | tak |
| `0`, `6`, `4.5`, `"4"`, `true` | zod | `400 VALIDATION_ERROR` | tak |
| Nieznane pole (`user_id`, `foo`) | `.strict()` | `400 VALIDATION_ERROR` | tak |
| Brak / nieprawidłowy JWT | `getAuthenticatedContext` | `401 UNAUTHORIZED` | tak |
| Autor ocenia własny przepis | RPC `P0403` | `403 FORBIDDEN` | tak (sc. 5) |
| Przepis nie istnieje / soft-deleted | RPC `P0002` | `404 NOT_FOUND` | tak |
| Cudzy `PRIVATE` / `SHARED` | RPC `P0002` | `404 NOT_FOUND` | tak (sc. 6) |
| RPC: brak sesji w bazie | `42501` | `401 UNAUTHORIZED` | tak |
| RPC: zakres (obrona w głąb) | `22023` | `400 VALIDATION_ERROR` | tak |
| `GET` / `POST` / `DELETE` / `PATCH` na `/recipes/{id}/rating` | router | `405 METHOD_NOT_ALLOWED` + `Allow: PUT, OPTIONS` | tak |
| Inny błąd RPC lub pusty wynik | `error` / `data.length === 0` | `500 INTERNAL_ERROR` + `logger.error` | tak |

Kolejność w handlerze: walidacja `id` → uwierzytelnienie → parsowanie i walidacja ciała → serwis (guard clauses, szczęśliwa ścieżka na końcu). Wyjątki przechwytuje istniejące `handleError`. Przy braku danych RPC nie zwracamy surowego komunikatu bazy.

### B. Endpointy odczytu

Błąd pobrania własnych ocen **nie blokuje odpowiedzi**: `getMyRatingsMap` loguje `logger.error` i zwraca pustą mapę (`my_rating: null`). Agregaty pochodzą z tego samego zapytania co reszta szczegółów, więc ich błąd to dotychczasowy `500`. Kody błędów istniejących endpointów bez zmian.

### Rejestrowanie błędów

Projekt nie ma tabeli błędów w bazie dla endpointów `recipes`. Błędy są rejestrowane przez `logger` (`_shared/logger.ts`): `logger.warn` dla błędów walidacji, `logger.error` dla błędów bazy. Każdy handler loguje operację na poziomie `info` (`userId`, `recipeId`).

---

## 8. Wydajność

| Aspekt | Rozwiązanie |
|---|---|
| Agregaty | Liczone w widoku podzapytaniami skalarnymi po `idx_recipe_ratings_recipe_id (recipe_id) include (rating)` (index-only scan). Brak denormalizacji i triggerów, więc agregat nie może się rozjechać z danymi |
| Listy | Endpointy list wybierają jawne kolumny, więc podzapytania agregatów **nie są liczone**. **Zweryfikować `EXPLAIN`** `GET /recipes` i `GET /public/recipes/feed` po migracji (w planie nie może być odwołań do `recipe_ratings`). Jeśli są, nie wdrażać i przejść na osobne zapytanie o agregaty |
| Szczegóły | `getMyRatingsMap` uruchamiane **równolegle** (`Promise.all`) z planem, kolekcjami i flagami, więc nie zwiększa liczby sekwencyjnych rund do bazy |
| Zapis | Jedno wywołanie RPC = jedna transakcja; brak dodatkowych zapytań z Edge Function |
| Indeksy | PK `(user_id, recipe_id)` obsługuje odczyt własnej oceny; indeks po `recipe_id` obsługuje agregaty i `ON DELETE CASCADE` z `recipes` |
| Rozmiar tabeli | Jeden wiersz na parę użytkownik–przepis; wycofanie usuwa wiersz |
| Cache | Odpowiedzi zalogowanych `no-store`; cache publiczny (`max-age=60`) zachowany dla gościa |
| Rozmiar odpowiedzi | `+2` pola (gość) lub `+3` pola (zalogowany) w szczegółach, pomijalne |
| Wyścigi | Równoległe pierwsze zapisy tej samej pary rozstrzyga `ON CONFLICT` (wygrywa ostatni zapis); agregaty liczone przy odczycie |

---

## 9. Etapy wdrożenia

### Krok 1. Migracja bazy danych

Plik: `supabase/migrations/20261027120000_create_recipe_ratings.sql` (znacznik czasu **większy** niż ostatnia migracja `20261010120000`, inaczej `supabase db push` odrzuci ją jako „out of order").

Zawartość (pełny SQL w `PS-99-recipe-rating-api-plan.md`, sekcja 2):

- tabela `public.recipe_ratings` (`user_id` FK → `auth.users` `ON DELETE CASCADE`, `recipe_id` FK → `public.recipes` `ON DELETE CASCADE`, `rating smallint`, `created_at`, `updated_at`; PK `(user_id, recipe_id)`; `CHECK (rating between 1 and 5)`),
- indeks `idx_recipe_ratings_recipe_id on (recipe_id) include (rating)`,
- trigger `set_recipe_ratings_updated_at` → `public.handle_updated_at()`,
- `ENABLE ROW LEVEL SECURITY`, `REVOKE ALL … FROM anon`, cztery polityki (`SELECT`/`DELETE`: `auth.uid() = user_id`; `INSERT`/`UPDATE`: dodatkowo przepis `PUBLIC`, niedeletowany i **cudzy**),
- `create or replace view public.recipe_details` z **pełną** dotychczasową definicją (kopia z `20260118120300_update_recipe_details_view_for_normalized_ingredients.sql`) plus dwie kolumny **na końcu**: `ratings_count`, `average_rating`; zaktualizować `comment on view`,
- RPC `public.set_recipe_rating(p_recipe_id bigint, p_rating smallint default null)`:
    - `returns table (out_recipe_id bigint, out_my_rating smallint, out_average_rating numeric, out_ratings_count integer)`,
    - `language plpgsql`, **`security definer`**, `set search_path = ''`, kwalifikowane nazwy `public.*`,
    - kody wyjątków: `42501`, `22023`, `P0002`, `P0403`,
    - `revoke all … from public; revoke all … from anon; grant execute … to authenticated;`,
- komentarze `COMMENT ON TABLE/COLUMN/FUNCTION`.

**Uwaga do widoku:** kopiując definicję, nie zmieniać kolejności ani nazw istniejących kolumn (inaczej `create or replace view` zgłosi błąd). `grant select on public.recipe_details to authenticated` jest zachowany, ale dla pewności sprawdzić go po migracji.

**Weryfikacja lokalna:** `supabase db reset`, następnie sprawdzić RPC dla: pierwszej oceny, zmiany, powtórzenia tej samej wartości (bez zmiany `updated_at`), wycofania, własnego przepisu (`P0403`), cudzego `PRIVATE` (`P0002`), `p_rating = 6` (`22023`).

### Krok 2. Regeneracja typów bazy

```bash
supabase gen types typescript --local > supabase/functions/_shared/database.types.ts
# oraz ten sam wynik do shared/types/database.types.ts
```

Sprawdzić, czy diff dotyczy wyłącznie tabeli `recipe_ratings`, funkcji `set_recipe_rating` i dwóch nowych kolumn widoku `recipe_details`.

### Krok 3. Kontrakt typów

- `shared/contracts/types.ts`: dodać `RecipeRatingDto`, `UpdateRecipeRatingCommand`; zmienić `RecipeDetailDto` (rozszerzony `Omit` + trzy pola) i `PublicRecipeDetailDto` (pkt 3).
- `recipes.service.ts:170` (`RecipeDetailDto`), `explore.service.ts:84` (`RecipeDetailDto`), `public.service.ts:183` (`PublicRecipeDetailDto`): dodać pola ocen analogicznie.
- Dopisać `ratings_count, average_rating` do trzech stałych `RECIPE_DETAIL_SELECT_COLUMNS` (`recipes.service.ts:252`, `explore.service.ts:141`, `public.service.ts:303`) oraz do lokalnych typów wiersza (`RecipeDetailFullRow` w `explore.service.ts` i `public.service.ts`).
- Sprawdzić kompilację frontendu (`ng build`). Uzupełnić obiekty `RecipeDetailDto` budowane ręcznie w testach (m.in. `recipe-import-page.component.spec.ts`) o `average_rating`, `ratings_count`.

### Krok 4. Moduł współdzielony `_shared/recipe-ratings.ts`

- Eksport `RecipeRatingDto`, `RecipeRatingFields`, `getMyRatingsMap(client, recipeIds, userId)` i `buildRatingFields(row, myRating, isAuthenticated)`.
- `getMyRatingsMap`: guard clauses na początku (`userId === null` lub `recipeIds.length === 0` → pusta mapa bez zapytania); zapytanie `from('recipe_ratings').select('recipe_id, rating').eq('user_id', userId).in('recipe_id', recipeIds)`; błąd bazy lub wyjątek → `logger.error` (`errorCode`, `userId`) + pusta mapa. Wzorzec: `_shared/recipe-flags.ts`.
- `buildRatingFields` (maska widoczności):

```typescript
export function buildRatingFields(
    row: { visibility: string; average_rating: number | string | null; ratings_count: number | string | null },
    myRating: number | undefined,
    isAuthenticated: boolean
): RecipeRatingFields {
    if (row.visibility !== 'PUBLIC') {
        return {
            average_rating: null,
            ratings_count: null,
            ...(isAuthenticated && { my_rating: null }),
        };
    }

    const count = Number(row.ratings_count ?? 0);
    return {
        average_rating: count === 0 || row.average_rating === null ? null : Number(row.average_rating),
        ratings_count: count,
        ...(isAuthenticated && { my_rating: myRating ?? null }),
    };
}
```

### Krok 5. Serwis zapisu — `recipes.service.ts`

- Dodać `setRecipeRating(client, input: SetRecipeRatingInput): Promise<RecipeRatingDto>`.
- Wywołanie `client.rpc('set_recipe_rating', { p_recipe_id: input.recipeId, p_rating: input.rating ?? undefined })`. Pominięta wartość nie trafia do JSON, więc po stronie SQL obowiązuje domyślne `null` (wycofanie).
- Mapowanie błędów (guard clauses): `P0002` → `NOT_FOUND`, `P0403` → `FORBIDDEN`, `22023` → `VALIDATION_ERROR`, `42501` → `UNAUTHORIZED`, inny błąd lub `data.length === 0` → `logger.error` + `INTERNAL_ERROR`.
- Zwrot: `ratings_count = Number(row.out_ratings_count)`, `average_rating = ratings_count === 0 ? null : Number(row.out_average_rating)`, `my_rating = row.out_my_rating ?? null`.

### Krok 6. Handler i routing — `recipes.handlers.ts`

1. Dodać `setRecipeRatingSchema` obok `setRecipeFlagsSchema` (ok. linii 442).
2. Dodać `handleSetRecipeRating(req, recipeIdParam)` wzorowany na `handleSetRecipeFlags` (ok. linii 1216): `parseAndValidateRecipeId` → `getAuthenticatedContext` → `req.json()` → `safeParse` → `setRecipeRating` → `createSuccessResponse(result)` (200) → `handleError` w `catch`. Log `info` z `userId` i `recipeId`.
3. Dodać `extractRecipeIdFromRatingPath(url)` ze wzorcem `/\/recipes\/([^/]+)\/rating\/?$/` (obok `extractRecipeIdFromFlagsPath`, ok. linii 1448).
4. W `recipesRouter` (ok. linii 1780–1830) wyliczyć `ratingRecipeId` obok pozostałych `extract*` i **obsłużyć go bezpośrednio po `OPTIONS`, przed blokami `GET`/`POST`/`PUT`/`DELETE`**, obok gałęzi `flagsRecipeId`:

```typescript
if (ratingRecipeId) {
    if (method === 'PUT') {
        return handleSetRecipeRating(req, ratingRecipeId);
    }

    return new Response(
        JSON.stringify({
            code: 'METHOD_NOT_ALLOWED',
            message: `Method ${method} not allowed for /recipes/{id}/rating. Use PUT.`,
        }),
        { status: 405, headers: { 'Content-Type': 'application/json', 'Allow': 'PUT, OPTIONS' } }
    );
}
```

Dzięki temu `GET` nie spada do `handleGetRecipes`, a `POST` nie dociera do `handleCreateRecipe`. CORS (`GET, POST, PUT, DELETE, OPTIONS`) już obejmuje `PUT`, bez zmian.

5. Uzupełnić komentarze: lista „Supports" w `recipesRouter` oraz komentarz nagłówkowy `recipes/index.ts` (ok. linii 86, obok `PUT …/collections`) o `PUT /functions/v1/recipes/{id}/rating`.

### Krok 7. Odczyt ocen — `recipes` (B1)

W `recipes.service.ts`, `getRecipeById` (ok. linii 894), **obie ścieżki** (Step A — widok przez klienta użytkownika, Step B — `PUBLIC` przez service role):

- rozszerzyć istniejące `Promise.all` (plan, kolekcje, flagi) o `getMyRatingsMap(client, [id], requesterUserId)`,
- przekazać `myRating` do `mapToRecipeDetailDto(data, inMyPlan, collectionIds, flags, myRating)` (ok. linii 1024), które rozszerza wynik o `...buildRatingFields(data, myRating, true)`.

Dla `getRecipeById` zalogowany jest zawsze (`isAuthenticated = true`), więc `my_rating` jest zawsze obecny. Zmiana automatycznie obejmuje odpowiedzi `createRecipe` i `updateRecipe` (ustalenie 4).

### Krok 8. Odczyt ocen — `explore` i `public` (B2, B3)

`explore.service.ts`, `getExploreRecipeById` (ok. linii 226): w **obu** ścieżkach zwrotu (`PUBLIC`, ok. linii 283–298, oraz autor niepublicznego przepisu, ok. linii 330–341) dodać `getMyRatingsMap(client, [recipeId], requesterUserId)` do istniejącego `Promise.all` i przekazać wynik do `mapToDto` (ok. linii 353). `mapToDto` dopisuje `...buildRatingFields(recipe, myRating, requesterUserId !== null)`. Handler `handleGetExploreRecipeById` już ustawia `no-store` dla zalogowanego, bez zmian.

`public.service.ts`, `getPublicRecipeById` (ok. linii 1031): w bloku `if (userId !== null)` dodać `getMyRatingsMap(client, [params.id], userId)` do istniejącego `Promise.all`. W `recipeDto` (ok. linii 1123) dopisać `...buildRatingFields(recipe, myRating, userId !== null)`. Przepis jest zawsze `PUBLIC` (filtr w zapytaniu), więc maska nie ucina pól. Gość dostaje agregaty bez `my_rating`.

`public.handlers.ts` i `public/index.ts`: **bez zmian** (ustalenie 5).

### Krok 9. Weryfikacja ręczna (lokalnie)

`supabase functions serve` i testy HTTP (`.http` w katalogach funkcji) na `http://localhost:54331/functions/v1/…` z JWT użytkowników testowych A (autor) i B:

1. B: `PUT /recipes/{publiczny A}/rating` `{ "rating": 4 }` → `200`, `my_rating: 4`, `ratings_count: 1`, `average_rating: 4`.
2. B: `{ "rating": 2 }` → zmiana, `ratings_count` bez zmian; powtórzenie → ten sam wynik.
3. B: `{ "rating": null }` → `my_rating: null`, `average_rating: null`, `ratings_count: 0`.
4. A: `PUT` na własny publiczny przepis → `403`.
5. B: `PUT` na `PRIVATE`/`SHARED` A, soft-deleted i nieistniejące ID → `404`.
6. `{}`, `{ "rating": 0 }`, `6`, `4.5`, `"4"`, `true`, `{ "rating": 3, "user_id": "x" }`, niepoprawny JSON → `400`. Brak `Authorization` → `401`.
7. `GET`/`POST`/`DELETE`/`PATCH` na `/recipes/{id}/rating` → `405` (w szczególności `POST` **nie** tworzy przepisu, `GET` **nie** zwraca listy).
8. Odczyt: `GET /recipes/{id}`, `GET /explore/recipes/{id}`, `GET /public/recipes/{id}` jako B (pola obecne i zgodne), jako A (`my_rating: null`), jako gość (`average_rating` i `ratings_count` obecne, **brak klucza** `my_rating`).
9. Autor ogląda własny `PRIVATE` przez `GET /recipes/{id}` i `GET /explore/recipes/{id}` → `average_rating`, `ratings_count`, `my_rating` = `null`. Po powrocie do `PUBLIC` wartości wracają.
10. Nagłówki: zalogowany `no-store`, gość `public, max-age=60`.
11. Prywatność: `select * from recipe_ratings` jako A i jako B zwraca tylko własne wiersze.
12. `recipes.updated_at` i `normalized_ingredients_status` bez zmian po `PUT …/rating`.
13. `EXPLAIN` listy `GET /recipes` i `GET /public/recipes/feed`: brak odwołań do `recipe_ratings`.

### Krok 10. Testy automatyczne backendu (Deno, wzorzec `recipes.service.test.ts` i `_shared/recipe-flags.test.ts`)

| Plik | Przypadki |
|---|---|
| `recipes/recipes.handlers.rating.test.ts` (lub istniejący test handlerów) | Schemat: brak `rating`, `0`, `6`, `4.5`, `"4"`, `true`, nieznane pole → błąd; `1..5` i `null` → OK. Router: `PUT` → handler; `GET`/`POST`/`DELETE`/`PATCH` na `/rating` → `405` z `Allow: PUT, OPTIONS` (nie lista, nie tworzenie) |
| `recipes/recipes.service.test.ts` | `setRecipeRating`: parametry RPC (`null` → `undefined`); mapowanie `out_*` → `RecipeRatingDto`; `ratings_count = 0` → `average_rating: null` (sc. 8); `P0002` → `NOT_FOUND`, `P0403` → `FORBIDDEN`, `22023` → `VALIDATION_ERROR`, `42501` → `UNAUTHORIZED`, inny błąd / pusty wynik → `INTERNAL_ERROR`. `getRecipeById`: pola ocen obecne, maska dla `PRIVATE`/`SHARED` |
| `_shared/recipe-ratings.test.ts` | `getMyRatingsMap`: gość / pusta lista → pusta mapa, brak zapytania; poprawne mapowanie wierszy; błąd bazy → pusta mapa + log; filtr `user_id` zawsze ustawiony. `buildRatingFields`: `PUBLIC` z ocenami / bez ocen, `PRIVATE`/`SHARED` → same `null`, gość → brak klucza `my_rating`, zaokrąglenie (4, 4, 5 → `4.3`; 1, 2 → `1.5`) |
| `explore` / `public` (testy serwisów) | Zalogowany: pola obecne; gość: `'my_rating' in dto === false`, agregaty obecne (sc. 4) |
| Test integracyjny RLS/RPC (lokalny Supabase, opis w `docs/testing/`) | B ocenia publiczny przepis A → `200`; A własny → `403`; B ocenia `PRIVATE`/`SHARED` A → `404`; B nie odczyta ocen A; bezpośredni `insert` jako A na własnym przepisie odrzucony przez RLS; usunięcie przepisu kasuje oceny (CASCADE); zmiana na `PRIVATE` ukrywa agregaty, powrót do `PUBLIC` je przywraca; `recipes.updated_at` bez zmian |
| Regresja widoku | Listy, wyszukiwanie i szczegóły zwracają te same dane co przed migracją |

### Krok 11. Dokumentacja

- `docs/results/project-summary.md`: sekcja 0 (stan realizacji PS-99, warstwa API), sekcja 1 („Granice": oceny przechodzą do zrealizowanych), sekcja 4 (tabela `recipe_ratings`, relacja `auth.users 1:N`, kolumny widoku), sekcja 5 (`PUT /recipes/{id}/rating` i pola ocen w odpowiedziach szczegółów), data aktualizacji.
- Komentarze nagłówkowe: `recipes/index.ts` i router w `recipes.handlers.ts`.
- Wpis w `.http` dla nowego endpointu (opcjonalnie).

### Krok 12. Wdrożenie

Przepływ w istniejącym `.github/workflows/main-deploy.yml` (`supabase db push` poprzedza `supabase functions deploy …`). Funkcje do ponownego wdrożenia: `recipes`, `public`, `explore` (wszystkie już są w workflow).

**Kolejność jest krytyczna:** nowe funkcje wybierają kolumny `ratings_count`, `average_rating`, więc wdrożone **przed** migracją zwróciłyby `500` na wszystkich szczegółach przepisów. Backend (migracja + funkcje) idzie **przed** frontendem. Stary frontend działa bez zmian (pola dodatkowe, ignorowane). Szczegóły, checklista produkcyjna i rollback: `PS-99-recipe-rating-deployment-plan.md`.

**Rollback:** funkcje wracają do poprzedniej wersji bez wpływu na dane. Tabela, kolumny widoku i RPC są addytywne i mogą zostać. Usunięcie wymaga osobnej migracji i **kasuje oceny użytkowników**; nie edytować zastosowanej migracji.

### Checklista

- [ ] Migracja `20261027120000_create_recipe_ratings.sql` (tabela, indeks, trigger, RLS, `create or replace view recipe_details`, RPC)
- [ ] Regeneracja `database.types.ts` (`supabase/functions/_shared/` oraz `shared/types/`)
- [ ] `shared/contracts/types.ts` (w tym nadpisanie kolumn widoku w `RecipeDetailDto`) + lokalne DTO w `recipes.service.ts`, `explore.service.ts`, `public.service.ts`
- [ ] Kolumny `ratings_count, average_rating` w trzech stałych `RECIPE_DETAIL_SELECT_COLUMNS`
- [ ] Kompilacja frontendu i poprawka obiektów `RecipeDetailDto` w testach
- [ ] `_shared/recipe-ratings.ts` (`getMyRatingsMap`, `buildRatingFields`) + testy
- [ ] `setRecipeRating` (serwis), `handleSetRecipeRating`, schemat zod, routing `PUT` + `405` dla pozostałych metod (przed gałęziami metod)
- [ ] Pola ocen w `getRecipeById` (obie ścieżki), `getExploreRecipeById` (obie ścieżki), `getPublicRecipeById`
- [ ] Maska `PUBLIC` / niepubliczny
- [ ] Komentarze nagłówkowe `recipes/index.ts` i routera
- [ ] Testy Deno + weryfikacja ręczna (kroki 9–10), w tym `EXPLAIN` list
- [ ] Aktualizacja `docs/results/project-summary.md`
- [ ] Code review

### Poza zakresem PS-99

| Element | Uwaga |
|---|---|
| Średnia ocen na kafelkach i listach | Osobna historyjka (wymaga rozszerzenia list i decyzji o denormalizacji) |
| Sortowanie / filtr po ocenie w `/explore` | Osobna historyjka (rozszerzenie PS-96) |
| Komentarze i recenzje tekstowe, powiadomienia dla autora | Poza zakresem |
| Rate limit i wykrywanie nadużyć (review bombing) | Poza zakresem; monitorować, dodać przy pierwszych sygnałach |
| Histogram ocen, lista „kto ocenił" | Poza zakresem; pojedyncze oceny pozostają prywatne |
| Różnice między rolami / limity ocen | Brak |
