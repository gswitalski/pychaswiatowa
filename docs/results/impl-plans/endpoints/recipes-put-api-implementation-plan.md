# API Endpoints Implementation Plan: PUT /recipes/{id}

<analysis>
## Podsumowanie kluczowych punktów specyfikacji API
- Endpoint aktualizuje istniejący przepis zalogowanego użytkownika.
- Request jest częściowy (wszystkie pola opcjonalne), ale musi zawierać przynajmniej jedno pole do zmiany.
- `tips_raw` jest polem opcjonalnym; jeśli zostanie przesłane jako puste / whitespace, backend ma ustawić `tips` na pustą listę `[]`.
- Odpowiedź zwraca pełny, zaktualizowany obiekt przepisu (detal), zawierający m.in. `ingredients`, `steps` oraz `tips` w formacie JSON.

## Parametry wymagane i opcjonalne (z kontraktu)
- Parametry URL:
  - wymagane: `id` (dodatnia liczba całkowita)
- Nagłówki:
  - wymagane: `Authorization: Bearer <JWT>`
- Body:
  - opcjonalne pola (co najmniej jedno wymagane logicznie): zgodnie z `UpdateRecipeCommand`, w tym `tips_raw?: string`

## Niezbędne typy DTO i Command modele
- `UpdateRecipeCommand` (kontrakt)
- `RecipeDetailDto` (odpowiedź)
- `RecipeContentItem`, `RecipeContent` (format `ingredients/steps/tips`)

## Wyodrębnienie logiki do service
- Handler: walidacja, parsowanie JSON, budowa wejścia dla serwisu i formatowanie odpowiedzi.
- Service: wywołanie RPC (transakcja + parsowanie w DB), mapowanie wyniku z widoku `recipe_details` do DTO.

## Walidacja danych wejściowych
- Walidacja `id`: dodatnia liczba całkowita.
- Walidacja body: typy, zakresy (np. 1–150 dla `name`, 1–99 dla `servings`, 0–999 dla czasów).
- Walidacja krzyżowa: jeśli oba czasy ustawione (nie-null), \(total\_time\_minutes \ge prep\_time\_minutes\).
- Walidacja „co najmniej jedno pole” w body.
- Normalizacja `tips_raw`: trim; pusty string traktować jako intencję wyczyszczenia `tips` (ustawić `[]`).

## Rejestrowanie błędów w tabeli błędów
- Brak dedykowanej tabeli błędów w DB w MVP (logowanie do loggera Edge Function).

## Ryzyka bezpieczeństwa
- Nieautoryzowana aktualizacja cudzych zasobów (mitigacja: JWT + RLS + warunek `user_id` w RPC).
- XSS poprzez treści `tips` (mitigacja: traktować jako plain-text; frontend renderuje bez HTML).
- DoS przez bardzo długie `*_raw` lub masę tagów (mitigacja: limity długości / liczby elementów na poziomie walidacji).

## Scenariusze błędów i kody statusu
- 400: błędy walidacji (body, id, zależności pól, zły JSON).
- 401: brak/niepoprawny JWT.
- 404: przepis nie istnieje / jest soft-deleted / brak dostępu (nie ujawniamy istnienia zasobu).
- 500: błąd po stronie serwera (RPC/DB/nieoczekiwany).
</analysis>

## 1. Przegląd punktu końcowego

Endpoint `PUT /recipes/{id}` aktualizuje istniejący przepis należący do zalogowanego użytkownika. Backend przyjmuje częściowy payload (pola opcjonalne), a pola tekstowe `ingredients_raw`, `steps_raw` oraz `tips_raw` (opcjonalne) parsuje po stronie bazy do struktury JSONB (lista elementów `{ type: "header" | "item", content: string }`). Odpowiedź zwraca pełny obiekt detalu przepisu (`RecipeDetailDto`) zawierający m.in. `ingredients`, `steps` oraz `tips`.

## 2. Szczegóły żądania

- **Metoda HTTP**: `PUT`
- **Struktura URL**: `/recipes/{id}` (w Supabase: `/functions/v1/recipes/{id}`)
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <JWT>`
  - **Zalecane**: `Content-Type: application/json`
- **Parametry**:
  - **Wymagane**:
    - `id` (path): dodatnia liczba całkowita
  - **Opcjonalne**: brak
- **Request Body (JSON)**: model `UpdateRecipeCommand` (kontrakt) / wejście `UpdateRecipeInput` (backend)

### Pola request body (wszystkie opcjonalne, ale min. 1 pole wymagane logicznie)
- `name`: string, 1–150, trim
- `description`: string|null (trim; `null` oznacza wyczyszczenie)
- `category_id`: number|null (dodatnia liczba całkowita lub `null` aby odpiąć kategorię)
- `ingredients_raw`: string (min 1 po stronie walidacji handlera; po parsowaniu w DB min 1 element)
- `steps_raw`: string (min 1; analogicznie do `ingredients_raw`)
- **`tips_raw`**: string (opcjonalne)
  - jeśli pole **nie jest obecne** w body → `tips` pozostaje bez zmian
  - jeśli pole jest obecne i po trim jest puste (`""` / whitespace) → `tips` ma być ustawione na `[]`
  - jeśli pole jest obecne i niepuste → parsowanie do JSONB przez `parse_text_to_jsonb(text)`
- `tags`: string[] (jeśli przekazane → zastępuje wszystkie istniejące tagi)
- `visibility`: `'PRIVATE' | 'SHARED' | 'PUBLIC'`
- `image_path`: string|null
- `servings`: number|null (1–99)
- `prep_time_minutes`: number|null (0–999)
- `total_time_minutes`: number|null (0–999; dodatkowo \(total \ge prep\) gdy oba ustawione)
- `is_termorobot`: boolean
- `is_grill`: boolean
- `diet_type`: `'MEAT' | 'VEGETARIAN' | 'VEGAN' | null`
- `cuisine`: `RecipeCuisine | null`
- `difficulty`: `'EASY' | 'MEDIUM' | 'HARD' | null`

## 3. Wykorzystywane typy

- **Kontrakt** (`shared/contracts/types.ts`):
  - `UpdateRecipeCommand`
  - `RecipeDetailDto`
  - `RecipeContentItem`, `RecipeContent`
  - (pośrednio) `RecipeVisibility`, `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty`
- **Backend** (`supabase/functions/recipes/*`):
  - `UpdateRecipeInput`
  - `RecipeDetailDto` (backendowa, zgodna z kontraktem)

## 4. Szczegóły odpowiedzi

### Sukces
- **Kod**: `200 OK`
- **Payload**: pełny obiekt przepisu (`RecipeDetailDto`) po aktualizacji, w tym:
  - `ingredients: RecipeContent`
  - `steps: RecipeContent`
  - `tips: RecipeContent` (może być puste)
  - `tags: Array<{id, name}>`
  - oraz pola metadanych (`updated_at`, itd.)

### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**:
  - niepoprawny JSON w body
  - body bez żadnego pola
  - błędy walidacji pól / enumów / zakresów
  - niespełnione zależności pól (np. czasy)
  - po parsowaniu w DB: `ingredients`/`steps` puste (jeśli `*_raw` przekazane)
- **`401 Unauthorized`**: brak/niepoprawny JWT
- **`404 Not Found`**:
  - przepis nie istnieje
  - przepis jest soft-deleted
  - przepis nie należy do użytkownika (maskujemy jako 404)
- **`500 Internal Server Error`**: błąd DB/RPC lub nieoczekiwany błąd runtime

## 5. Przepływ danych

Docelowy przepływ (zgodnie z modularną architekturą Edge Functions):
1. Klient wysyła `PUT /recipes/{id}` z JWT i JSON body.
2. `supabase/functions/recipes/index.ts`:
   - obsługa CORS (OPTIONS),
   - routing do `recipesRouter`,
   - top-level error handling + logowanie.
3. `recipesRouter` (`recipes.handlers.ts`) dopasowuje ścieżkę `/recipes/{id}` i wywołuje `handleUpdateRecipe`.
4. `handleUpdateRecipe`:
   - waliduje `id`,
   - parsuje JSON,
   - waliduje payload Zod (w tym „min. 1 pole” i walidację krzyżową czasów),
   - normalizuje `tips_raw` (trim; pusty → `null`) i przekazuje do serwisu jako „pole obecne”,
   - buduje `UpdateRecipeInput`.
5. `updateRecipe` (`recipes.service.ts`):
   - wyznacza flagi aktualizacji (np. `p_update_tips`) na podstawie tego, czy pole było obecne w payloadzie,
   - wywołuje RPC `update_recipe_with_tags` (atomowo):
     - weryfikuje własność (`user_id`) i `deleted_at is null`,
     - opcjonalnie parsuje `ingredients_raw`, `steps_raw`, `tips_raw` przez `parse_text_to_jsonb(text)`,
     - zapisuje `recipes.ingredients`, `recipes.steps`, `recipes.tips`,
     - aktualizuje tagi w junction table (jeśli przekazane),
     - aktualizuje pozostałe pola (czasy, klasyfikacje, image_path, itd.),
     - zwraca `recipeId`.
   - pobiera zaktualizowany detal z widoku `recipe_details` (zawiera `tips`) i mapuje do `RecipeDetailDto`.

Wymagania DB dla tego przepływu:
- tabela `recipes` zawiera `tips jsonb not null default '[]'::jsonb`
- widok `recipe_details` zawiera `tips`
- funkcja `update_recipe_with_tags` wspiera `p_tips_raw` oraz `p_update_tips` (żeby rozróżnić brak pola vs intencję aktualizacji)

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: JWT Supabase Auth; brak → `401`.
- **Autoryzacja / własność**:
  - RPC weryfikuje `p_user_id` == `recipes.user_id` oraz `deleted_at is null`;
  - RLS dodatkowo chroni tabelę `recipes` i tabele łączące.
- **Minimalizacja wycieku informacji**:
  - brak dostępu do cudzego przepisu maskować jako `404`.
- **Sanityzacja**:
  - `*_raw` oraz `tips_raw` traktować jako tekst; brak interpolacji SQL; tylko parametry RPC.
- **Limity anty-DoS (rekomendowane)**:
  - limit długości `ingredients_raw`, `steps_raw`, `tips_raw` (np. 50k znaków),
  - limit liczby tagów (np. 50) i unikalność po trim/lowercase (DB już zapewnia unikalność per user przez constraint).

## 7. Obsługa błędów

### Mapowanie błędów do statusów
- `400 Bad Request`:
  - błędy walidacji Zod (w tym „min. 1 pole”),
  - niepoprawny JSON,
  - błędy domenowe z RPC (`errcode = P0001`, np. puste składniki/kroki po parsowaniu, niespójne czasy).
- `401 Unauthorized`:
  - brak/niepoprawny JWT.
- `404 Not Found`:
  - `errcode = P0002` z RPC dla: brak rekordu / brak własności / soft-delete.
- `500 Internal Server Error`:
  - pozostałe błędy DB/RPC i runtime.

### Logowanie
- `info`: start/koniec operacji update, identyfikatory (`userId`, `recipeId`), które pola aktualizowane.
- `warn`: walidacja, próba update bez pól, niepoprawne dane.
- `error`: błędy RPC/DB.

## 8. Kroki implementacji

### A) Kontrakt (frontend/shared)
1. W `shared/contracts/types.ts` upewnić się, że:
   - `UpdateRecipeCommand` zawiera `tips_raw?: string` (wynika z `CreateRecipeCommand`),
   - `RecipeDetailDto` zawiera `tips: RecipeContent`.

### B) Baza danych (migracje SQL w `supabase/migrations/`)
2. Zastosować migracje:
   - dodanie kolumny `recipes.tips` (domyślnie `[]`),
   - aktualizacja widoku `recipe_details` o `tips`,
   - aktualizacja RPC `update_recipe_with_tags` o `p_tips_raw` + `p_update_tips` i logikę ustawiania `tips`.
3. (Jeśli projekt wymaga wyszukiwania po wskazówkach) upewnić się, że mechanizm `search_vector`/wyszukiwania uwzględnia `tips` (np. przez aktualizację budowy tsvector / wagi w RPC).

### C) Edge Function `recipes` (TypeScript/Deno)
4. `supabase/functions/recipes/recipes.handlers.ts`:
   - dodać `tips_raw` do `updateRecipeSchema` jako `optional()` i z normalizacją `trim → null`,
   - przekazywać `tips_raw` do `UpdateRecipeInput`,
   - wymusić „min. 1 pole” oraz walidację krzyżową czasów.
5. `supabase/functions/recipes/recipes.service.ts`:
   - dodać `tips` do selectu detalu (`RECIPE_DETAIL_SELECT_COLUMNS`) i mapowania DTO,
   - w `updateRecipe` wyznaczyć `updateTips = input.tips_raw !== undefined`,
   - wywołać RPC z `p_tips_raw` i `p_update_tips`.

### D) Test plan (minimalny zestaw)
6. Testy manualne (lokalnie):
   - `supabase functions serve recipes`
   - przypadki:
     - update `tips_raw` nieobecne → `tips` bez zmian
     - `tips_raw: "# Wskazówki\n- ..." ` → `tips` zparsowane
     - `tips_raw: ""` → `tips: []`
     - body `{}` → `400`
     - brak JWT → `401`
     - `id` niepoprawne (`abc`, `-1`) → `400`
     - przepis nie istnieje → `404`
     - cross-field: `total_time_minutes < prep_time_minutes` → `400`

