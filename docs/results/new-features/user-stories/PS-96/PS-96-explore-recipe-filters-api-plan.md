# PS-96: Filtry przepisów w katalogu Odkrywaj — Plan API

> **User Story:** PS-96 — Filtry przepisów w katalogu Odkrywaj (`/explore`)
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Function `public` (`GET /public/recipes`, `GET /public/recipes/feed`)
> **Powiązane:** `PS-96-explore-recipe-filters-user-story.md`, `PS-96-explore-recipe-filters-ui-plan.md`, `PS-96-explore-recipe-filters-deployment-plan.md`

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `GET /public/recipes` | Modyfikacja | Nowe query params: `favorite`, `want_to_try`, `diet`; filtrowanie po flagach osobistych tylko dla zalogowanych |
| `GET /public/recipes/feed` | Modyfikacja | Jw. — cursor-based wariant listy (load more) |
| Baza danych | **Bez zmian** | Tabela `user_recipe_flags` z indeksem `idx_user_recipe_flags_user_favorite` już istnieje (PS-95) |
| Nowa Edge Function / migracja | **Brak** | Zmiany wyłącznie w istniejącej funkcji `public` |
| Zmienne środowiskowe / sekrety | **Brak** | |

**Bez zmian:**

- `GET /explore/recipes/{id}`, `GET /public/recipes/{id}` — szczegóły; PS-96 dotyczy wyłącznie list.
- `GET /recipes`, `GET /recipes/feed` — prywatne listy (filtrowanie po flagach dla „Moich przepisów" to osobna historyjka).
- Tabela `recipes`, widok `recipe_details`, RPC, joby normalizacji, tabela `user_recipe_flags` — **bez modyfikacji schematu**.
- Workflow `.github/workflows/main-deploy.yml` — bez zmian (Edge Function `public` jest już wdrażana).

---

## 2. Model danych — brak migracji

Tabela `user_recipe_flags` (stworzona w PS-95) zawiera już indeks częściowy `idx_user_recipe_flags_user_favorite` zoptymalizowany pod filtrowanie:

```sql
-- Istniejący indeks (PS-95):
create index idx_user_recipe_flags_user_favorite
    on public.user_recipe_flags (user_id, recipe_id)
    where is_favorite;
```

Dla `is_want_to_try` indeks nie istnieje — filtrowanie po tej fladze trafi na pełny scan tabeli. Ze względu na niską częstotliwość użycia tego filtra w MVP jest to akceptowalne. Jeśli logi wskazałyby na problem, nową migrację z indeksem można dodać oddzielnie.

---

## 3. Zmienione endpointy

### 3.1 `GET /public/recipes` (offset-based)

**Metadane:**

| Atrybut | Wartość |
|---|---|
| Metoda | `GET` |
| URL | `/functions/v1/public/recipes` |
| Autoryzacja | Opcjonalna (`Authorization: Bearer <JWT>`) |
| Funkcja Edge | `public` (istniejąca) |
| Cache | Odpowiedź anonimowa: `public, max-age=60`; z JWT: `no-store` (bez zmian względem PS-95) |

**Nowe parametry query (dodane przez PS-96):**

| Parametr | Typ | Opis | Zachowanie bez JWT |
|---|---|---|---|
| `favorite` | `"true"` | Zwróć tylko przepisy oznaczone przez zalogowanego jako ulubione (`is_favorite = true`) | Parametr **ignorowany**, brak błędu |
| `want_to_try` | `"true"` | Zwróć tylko przepisy z flagą `is_want_to_try = true` zalogowanego | Parametr **ignorowany**, brak błędu |
| `diet` | `"vege_plus"` \| `"vegan"` | Nowa wartość `vege_plus` = union `diet_type IN ('VEGE','VEGAN')`; `vegan` = `diet_type = 'VEGAN'` | Działa dla wszystkich (anonimowych i auth) |

**Istniejące parametry (bez zmian):**

| Parametr | Opis |
|---|---|
| `q` | Wyszukiwanie pełnotekstowe (min 3 zn.) |
| `termorobot` | `"true"` — filtr `is_termorobot = true` |
| `grill` | `"true"` — filtr `is_grill = true` |
| `diet_type` | `"MEAT"` / `"VEGE"` / `"VEGAN"` — dokładne dopasowanie (backward compat) |
| `offset`, `limit` | Paginacja |

> **Priorytet:** jeśli w żądaniu są jednocześnie `diet` i `diet_type`, parametr `diet` ma priorytet (ignoruje `diet_type`). W normalnym użyciu UI wysyła wyłącznie `diet`.

**Mapowanie `diet` → SQL:**

```typescript
// Przykładowa logika w public.service.ts
function buildDietFilter(diet: string | null, dietType: string | null): string | null {
    if (diet === 'vege_plus') return null; // obsługa przez IN — patrz zapytanie poniżej
    if (diet === 'vegan') return 'VEGAN';
    if (diet === null && dietType) return dietType;  // backward compat
    return null;
}
```

Dla `diet=vege_plus` zapytanie bazy używa `diet_type IN ('VEGE', 'VEGAN')` zamiast dokładnego dopasowania:

```sql
-- Fragment logiki filtrowania (pseudokod SQL):
AND (
    -- gdy diet=vege_plus:
    diet_type IN ('VEGE', 'VEGAN')
    -- gdy diet=vegan lub diet_type=VEGAN:
    -- diet_type = 'VEGAN'
    -- gdy brak diet/diet_type:
    -- (brak warunku)
)
```

**Filtrowanie po flagach (`favorite`, `want_to_try`) — tylko dla zalogowanych:**

Gdy `userId !== null` i parametr jest obecny (`=true`), do zapytania dodawany jest JOIN z `user_recipe_flags`:

```sql
-- favorite=true:
INNER JOIN user_recipe_flags f_fav
    ON f_fav.recipe_id = r.id
   AND f_fav.user_id = <userId>
   AND f_fav.is_favorite = true

-- want_to_try=true:
INNER JOIN user_recipe_flags f_wtt
    ON f_wtt.recipe_id = r.id
   AND f_wtt.user_id = <userId>
   AND f_wtt.is_want_to_try = true
```

Użycie `INNER JOIN` (zamiast EXISTS) gwarantuje, że na liście pojawią się tylko przepisy pasujące do filtru. Przy jednoczesnym `favorite=true&want_to_try=true` oba JOINy muszą być spełnione (AND).

> **Klient bazy:** dla endpointów `public` jest to **service role** (dostęp do danych bez RLS). Filtr `user_id = <userId>` jest obowiązkowy i pochodzi wyłącznie z zweryfikowanego JWT (`getOptionalAuthenticatedUser(req)`), nigdy z parametrów żądania.

**Pseudokod (serwis):**

```typescript
// supabase/functions/public/public.service.ts

export async function getPublicRecipes(
    client: TypedSupabaseClient,
    params: GetPublicRecipesParams,
    userId: string | null
): Promise<PublicRecipeListItemDto[]> {

    let query = client
        .from('recipes')
        .select(`
            id, name, image_path, diet_type, is_termorobot, is_grill,
            ${userId ? ', user_recipe_flags!inner(is_favorite)' : ''}
        `)
        .eq('visibility', 'PUBLIC')
        .is('deleted_at', null);

    // --- istniejące filtry ---
    if (params.q && params.q.length >= 3) {
        query = query.textSearch('search_vector', params.q, { type: 'websearch' });
    }
    if (params.termorobot === 'true') query = query.eq('is_termorobot', true);
    if (params.grill === 'true') query = query.eq('is_grill', true);

    // --- nowy filtr diet (PS-96) ---
    if (params.diet === 'vege_plus') {
        query = query.in('diet_type', ['VEGE', 'VEGAN']);
    } else if (params.diet === 'vegan') {
        query = query.eq('diet_type', 'VEGAN');
    } else if (params.dietType) {
        query = query.eq('diet_type', params.dietType); // backward compat
    }

    // --- nowe filtry flag (PS-96, tylko zalogowany) ---
    if (userId && params.favorite === 'true') {
        query = query
            .eq('user_recipe_flags.user_id', userId)
            .eq('user_recipe_flags.is_favorite', true);
    }
    if (userId && params.wantToTry === 'true') {
        // Uwaga: is_want_to_try wymaga osobnego joinu lub rozszerzenia selecta
        // Implementacja: dodać is_want_to_try do selecta user_recipe_flags i filtrować
        query = query.eq('user_recipe_flags.is_want_to_try', true);
    }

    query = query.order('created_at', { ascending: false }).range(params.offset, params.offset + params.limit - 1);

    const { data, error } = await query;
    // ... mapowanie na DTO (is_favorite ze stanu z PS-95 — bez zmian)
}
```

> **Uwaga implementacyjna:** jeśli równoczesne filtrowanie po `favorite` i `want_to_try` wymaga dwóch osobnych JOINów, alternatywą jest wykonanie jednego zapytania do `user_recipe_flags` z warunkami na `AND` i pobranie listy `recipe_id`, a następnie filtrowanie listy przepisów przez `.in('id', recipeIds)`. Ten wzorzec jest prostszy w Supabase PostgREST.

**Odpowiedź (bez zmian w formacie):**

Format odpowiedzi identyczny jak przed PS-96 — `is_favorite` w elementach (z PS-95) jest już obecne. Nowe parametry filtrują wyniki, ale nie zmieniają struktury DTO.

### 3.2 `GET /public/recipes/feed` (cursor-based)

Identyczne zmiany jak w `GET /public/recipes` — ten sam zestaw parametrów filtrujących. Różnica: paginacja cursor-based (`cursor` zamiast `offset`). Żadne inne modyfikacje.

---

## 4. Walidacja i obsługa błędów

**Nowe parametry — reguły walidacji:**

| Parametr | Akceptowane wartości | Niepoprawne → zachowanie |
|---|---|---|
| `favorite` | `"true"` | Każda inna wartość (np. `"false"`, `"1"`) → parametr **ignorowany** (brak błędu; skutek: brak filtrowania) |
| `want_to_try` | `"true"` | Jw. |
| `diet` | `"vege_plus"`, `"vegan"` | Inna wartość → parametr **ignorowany** (jak nieznany filtr, bez błędu) |

> **Uzasadnienie tolerancji:** endpointy publiczne (bezstanowe, cachowalne) nie zwracają 400 za nieznane query params — zachowanie zgodne z resztą `GET /public/recipes`.

**Filtry flag bez JWT → ignorowane (nie `401`):**

Wywołanie `GET /public/recipes?favorite=true` bez `Authorization` nie zwraca błędu — traktowane jak wywołanie bez parametru `favorite`. Frontend zawsze ukrywa te chipy dla gościa, więc taka sytuacja nie powinna wystąpić w normalnym użytkowaniu.

---

## 5. Kody odpowiedzi

Bez zmian względem istniejącego endpointu:

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Wyniki (mogą być puste — `data: []`) |
| `500 Internal Server Error` | Błąd bazy danych |

Nowe kody błędów **nie są** wprowadzane.

---

## 6. Bezpieczeństwo

| Zagrożenie | Mitygacja |
|---|---|
| Filtrowanie po flagach innego użytkownika | `userId` pochodzi wyłącznie z zweryfikowanego JWT (`getOptionalAuthenticatedUser`), nigdy z query params; obowiązkowy filtr `.eq('user_id', userId)` w zapytaniu do `user_recipe_flags` |
| Wyciek prywatnych flag przez cache | Odpowiedź z JWT ma `no-store` (bez zmian z PS-95); gość nie otrzymuje pól `is_favorite` |
| Wstrzyknięcie wartości `diet_type` | Wartości mapowane przez whitelist (`vege_plus` / `vegan`); nieznane wartości ignorowane |
| Filtr flag przez nieautoryzowanego | Brak JWT → parametry `favorite`/`want_to_try` są ignorowane (bez JOIN do `user_recipe_flags`) |

---

## 7. Testy (backend)

| Obszar | Scenariusz |
|---|---|
| `diet=vege_plus` | Zwraca przepisy `VEGE` i `VEGAN`, nie zwraca `MEAT` |
| `diet=vegan` | Zwraca tylko `VEGAN` |
| `diet` + `q` | AND: wyniki spełniają oba kryteria |
| `favorite=true` z JWT | Zwraca tylko przepisy z `is_favorite=true` danego użytkownika |
| `want_to_try=true` z JWT | Zwraca tylko przepisy z `is_want_to_try=true` |
| `favorite=true` + `want_to_try=true` (AND) | Przepisy spełniające oba warunki jednocześnie |
| `favorite=true` bez JWT | Parametr ignorowany — wyniki bez filtrowania flag |
| `favorite=true` z JWT, brak flag | Wyniki puste (empty list) |
| Nieznana wartość `diet=xyz` | Ignorowana — brak filtrowania diety, brak błędu |
| `diet=vege_plus` + `favorite=true` (zalogowany) | AND obu warunków |
| Cache-Control z JWT | `no-store` (regresja z PS-95) |
| Cache-Control bez JWT | `public, max-age=60` (regresja z PS-95) |

---

## 8. Checklist implementacji (API)

- [ ] Parsowanie nowych query params `favorite`, `want_to_try`, `diet` w `public/public.handlers.ts` (lub `public/public.service.ts`)
- [ ] Logika filtrowania `diet=vege_plus` → `IN ('VEGE', 'VEGAN')` w `getPublicRecipes` i `getPublicRecipesFeed`
- [ ] Logika filtrowania `favorite=true` i `want_to_try=true` tylko dla zalogowanego (JOIN / subquery z `user_recipe_flags`)
- [ ] Ignorowanie parametrów flag dla gościa (bez błędu, bez filtru)
- [ ] Testy (pkt 7)
- [ ] Brak zmian w schemat DB, workflow, sekretach

---

## 9. Poza zakresem PS-96

| Element | Uwaga |
|---|---|
| Filtry `cuisine` i `difficulty` w UI | Osobna historyjka; backend już je obsługuje |
| Filtrowanie po flagach w `GET /recipes` (prywatne) | Osobna historyjka |
| Filtrowanie po flagach na Landing Page | Poza zakresem PS-96 |
| Indeks DB dla `is_want_to_try` | Addytywne — osobna migracja jeśli logi pokażą problem z wydajnością |
