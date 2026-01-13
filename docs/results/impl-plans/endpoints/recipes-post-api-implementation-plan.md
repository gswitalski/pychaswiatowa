# API Endpoints Implementation Plan: POST /recipes

## 1. Przegląd punktu końcowego

Endpoint `POST /recipes` tworzy nowy przepis dla zalogowanego użytkownika. Backend przyjmuje pola `ingredients_raw`, `steps_raw` oraz **opcjonalne** `tips_raw`, następnie parsuje je do struktury JSON (lista elementów `{ type: "header" | "item", content: string }`) i zapisuje w bazie. Odpowiedź zwraca pełny obiekt przepisu wraz z polami `ingredients`, `steps` oraz **`tips`**.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/recipes` (w Supabase: `/functions/v1/recipes`)
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <JWT>`
  - **Opcjonalne**: `Content-Type: application/json` (wymagane praktycznie dla JSON)
- **Parametry**:
  - **Wymagane**: brak (wszystko w body)
  - **Opcjonalne**: brak
- **Request Body (JSON)**: model `CreateRecipeCommand` (kontrakt) / wejście `CreateRecipeInput` (backend)

### Pola request body (wymagane)
- `name`: string, 1–150, trim
- `visibility`: `'PRIVATE' | 'SHARED' | 'PUBLIC'`
- `ingredients_raw`: string, min 1
- `steps_raw`: string, min 1

### Pola request body (opcjonalne)
- `description`: string|null
- `category_id`: number|null (dodatnia liczba całkowita)
- `tags`: string[] (domyślnie `[]`)
- `servings`: number|null (1–99)
- `prep_time_minutes`: number|null (0–999)
- `total_time_minutes`: number|null (0–999; jeśli oba czasy podane, to `total_time_minutes >= prep_time_minutes`)
- `is_termorobot`: boolean (domyślnie `false`)
- `is_grill`: boolean (domyślnie `false`)
- `diet_type`: `'MEAT' | 'VEGETARIAN' | 'VEGAN' | null`
- `cuisine`: `RecipeCuisine | null`
- `difficulty`: `'EASY' | 'MEDIUM' | 'HARD' | null`
- **`tips_raw`**: string (opcjonalne)
  - jeśli brak / pusty po trim → `tips` w bazie i odpowiedzi musi być `[]`

### Wykorzystywane typy (kontrakt + backend)
- **Kontrakt** (`shared/contracts/types.ts`):
  - `CreateRecipeCommand` (**dodać** `tips_raw?: string`)
  - `RecipeContentItem`, `RecipeContent`
  - `RecipeDetailDto` (**dodać** `tips: RecipeContent`)
- **Backend** (`supabase/functions/recipes/recipes.service.ts` i `recipes.handlers.ts`):
  - `CreateRecipeInput` (**dodać** `tips_raw?: string | null`)
  - `createRecipeSchema` (**dodać** `tips_raw` jako `optional()` z normalizacją do `null`)
  - `RecipeDetailDto` (**dodać** `tips: RecipeContent`)

## 3. Szczegóły odpowiedzi

### Sukces
- **Kod**: `201 Created`
- **Payload**: obiekt przepisu (aktualnie backend zwraca `RecipeDetailDto`), rozszerzony o:
  - `tips: Array<{ type: "header" | "item", content: string }>` (może być puste)

Minimalny zestaw pól zgodny z API planem:
- `id`, `name`, `description`, `servings`, `prep_time_minutes`, `total_time_minutes`
- `is_termorobot`, `is_grill`, `diet_type`, `cuisine`, `difficulty`
- `category_id`, `visibility`
- `ingredients`, `steps`, **`tips`**
- `tags` (w formie obiektów `{id, name}` po stronie endpointów prywatnych)
- `created_at` (oraz pozostałe pola, które projekt zwraca w `RecipeDetailDto`)

### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**: walidacja payloadu, niepoprawny JSON, niespełnione zależności pól
- **`401 Unauthorized`**: brak/niepoprawny JWT
- **`404 Not Found`**: `category_id` nie istnieje (jeśli przekazane)
- **`500 Internal Server Error`**: błąd po stronie serwera (DB/RPC/nieoczekiwany)

## 4. Przepływ danych

Docelowy przepływ (zgodny z modularną architekturą Edge Functions):
1. Klient wysyła `POST /recipes` z JWT i JSON body.
2. `supabase/functions/recipes/index.ts`:
   - obsługa CORS (OPTIONS),
   - routing do `recipesRouter`,
   - top-level error handling + logowanie.
3. `recipesRouter` (`recipes.handlers.ts`) kieruje request do `handleCreateRecipe`.
4. `handleCreateRecipe`:
   - pozyskuje kontekst auth (`getAuthenticatedContext`),
   - parsuje JSON,
   - waliduje Zod (w tym normalizuje `tips_raw` do `null` gdy puste),
   - buduje `CreateRecipeInput` (w tym `tips_raw`),
   - wywołuje `createRecipe(...)`.
5. `createRecipe` (`recipes.service.ts`):
   - wywołuje RPC `create_recipe_with_tags` (atomowo):
     - parsuje `ingredients_raw`, `steps_raw` i **opcjonalnie** `tips_raw` przez `parse_text_to_jsonb(text)`,
     - zapisuje `recipes.ingredients`, `recipes.steps`, **`recipes.tips`**,
     - tworzy/wiąże tagi,
     - zwraca `recipeId`.
   - pobiera pełne dane nowego przepisu przez `getRecipeById(...)` z widoku `recipe_details`,
   - mapuje wynik do `RecipeDetailDto` (w tym `tips`).

Wymagania DB, aby przepływ działał:
- tabela `recipes` musi mieć kolumnę **`tips jsonb not null default '[]'::jsonb`**
- widok `recipe_details` musi zawierać `tips` (oraz ewentualnie uwzględniać go w polu `search` dla publicznych wyszukiwań, jeśli dotyczy projektu)

## 5. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (Supabase Auth). Brak tokenu lub token niepoprawny → `401`.
- **Autoryzacja / własność danych**:
  - dla `POST /recipes` tworzymy rekord zawsze dla `auth.uid()`/`user.id` z tokenu.
  - RLS w DB musi uniemożliwiać tworzenie rekordów dla innych użytkowników.
- **Walidacja + limity anty-DoS** (rekomendowane doprecyzowanie):
  - limit długości `ingredients_raw`, `steps_raw`, `tips_raw` (np. max 50k znaków każde),
  - limit liczby tagów (np. max 50) i długości pojedynczego taga (już jest 50),
  - limit liczby linii po parsowaniu (opcjonalnie na poziomie DB).
- **Sanityzacja**:
  - żadnego składania SQL-stringów z danymi użytkownika; RPC + parametry.

## 6. Obsługa błędów

### Mapowanie błędów na statusy (spójne z wymaganiami)
- `400 Bad Request`:
  - błędy walidacji Zod (pola wymagane, enumy, zakresy liczb, cross-field time),
  - niepoprawny JSON w body,
  - błędy domenowe zwrócone z RPC jako `raise_exception` (np. po parsowaniu brak pozycji w składnikach/krokach, jeśli takie reguły obowiązują).
- `401 Unauthorized`:
  - `getAuthenticatedContext` nie może potwierdzić użytkownika.
- `404 Not Found`:
  - `category_id` wskazuje nieistniejący rekord (RPC powinien rozróżnić ten przypadek).
- `500 Internal Server Error`:
  - błędy RPC/DB niepasujące do powyższych,
  - nieobsłużone wyjątki runtime.

### Rejestrowanie błędów
- Brak tabeli błędów w DB: **nie dotyczy**.
- Logowanie:
  - `info` dla operacji (create recipe),
  - `warn` dla walidacji,
  - `error` dla błędów DB/RPC.

## 7. Wydajność

- Operacja tworzenia powinna być **atomowa** (RPC w DB), aby uniknąć częściowych zapisów (np. przepis bez tagów).
- Parsowanie `*_raw` w DB (funkcja `parse_text_to_jsonb`) ogranicza koszty w Edge Function i zapewnia spójność formatu.
- Dodatkowe round-trip:
  - po RPC: pobranie detalu z widoku `recipe_details` (1 odczyt).
- Wąskie gardła:
  - bardzo długie `*_raw` → limity długości i ewentualnie limity linii w DB.

## 8. Kroki implementacji

### A) Kontrakt (frontend/shared)
1. W `shared/contracts/types.ts`:
   - dodać `tips_raw?: string` do `CreateRecipeCommand`,
   - dodać `tips: RecipeContent` do `RecipeDetailDto`,
   - dodać `tips: RecipeContent` do `PublicRecipeDetailDto` (wpływ zmian “Recipes / Public Recipes” na detal).

### B) Baza danych (migracje SQL w `supabase/migrations/`)
2. Dodać migrację: `ALTER TABLE public.recipes ADD COLUMN tips jsonb NOT NULL DEFAULT '[]'::jsonb;`
3. Zaktualizować widok `recipe_details`, aby zawierał `tips` (i był zgodny z typami).
4. Zaktualizować RPC `create_recipe_with_tags`:
   - dodać parametr `p_tips_raw text default null`,
   - ustawiać `tips` na:
     - `parse_text_to_jsonb(p_tips_raw)` gdy `p_tips_raw` niepuste,
     - `'[]'::jsonb` gdy null/puste.
5. (Rekomendowane, dla spójności domeny) Zaktualizować RPC `update_recipe_with_tags` analogicznie o `p_tips_raw` + `p_update_tips boolean` albo w modelu “null/undefined” zgodnie ze stylem istniejących parametrów.
6. Wygenerować na nowo typy bazy (`supabase gen types typescript ...`) i upewnić się, że `recipes.tips` oraz `recipe_details.tips` są widoczne w `database.types.ts`.

### C) Edge Function `recipes` (TypeScript/Deno)
7. W `supabase/functions/recipes/recipes.handlers.ts`:
   - rozszerzyć `createRecipeSchema` o `tips_raw`:
     - `z.string().optional().transform((v) => v?.trim() || null)`
   - przekazać `tips_raw` do `CreateRecipeInput`.
8. W `supabase/functions/recipes/recipes.service.ts`:
   - dodać `tips` do `RecipeDetailDto`,
   - dodać `tips_raw` do `CreateRecipeInput`,
   - rozszerzyć wywołanie RPC `create_recipe_with_tags` o `p_tips_raw`,
   - zaktualizować `RECIPE_DETAIL_SELECT_COLUMNS` o `tips`,
   - zaktualizować mapowanie `mapToRecipeDetailDto` o `tips: parseRecipeContent(data.tips)`.

### D) Testy (minimalny zestaw)
9. Test manualny lokalnie:
   - `supabase functions serve recipes`
   - przypadki:
     - bez `tips_raw` → `201` i `tips: []`
     - `tips_raw` z nagłówkiem i itemami → `201` i poprawnie sparsowane `tips`
     - pusty string `tips_raw: ""` → `tips: []`
     - brak JWT → `401`
     - błędny enum/za długie `name` → `400`
     - `total_time_minutes < prep_time_minutes` → `400`
     - `category_id` nie istnieje → `404`

