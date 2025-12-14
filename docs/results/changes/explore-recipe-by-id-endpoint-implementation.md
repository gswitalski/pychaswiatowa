# Implementacja Endpointa: GET /explore/recipes/{id}

**Data:** 2025-12-14  
**Status:** ✅ Ukończone  
**Plan implementacji:** `docs/results/impl-plans/endpoints/get-explore-recipe-by-id-api-implementation-plan.md`

## Podsumowanie

Zaimplementowano endpoint `GET /explore/recipes/{id}`, który umożliwia dostęp do szczegółów przepisów z opcjonalnym uwierzytelnieniem:
- Przepisy **PUBLIC** są dostępne dla wszystkich (bez tokenu)
- Przepisy **PRIVATE/SHARED** są dostępne tylko dla autorów (z tokenem)
- Endpoint zwraca **404** (nie 403) dla niepublicznych przepisów, aby nie ujawniać ich istnienia

## Zmiany w Kodzie

### 1. Nowa Edge Function: `supabase/functions/explore/`

#### `explore/index.ts`
- **Główny router** funkcji Edge Function
- Obsługa CORS (GET, OPTIONS)
- Top-level error handling
- Delegacja do `exploreRouter`

#### `explore/explore.types.ts`
- Definicja typu `GetExploreRecipeByIdParams`
- Parametry wejściowe dla endpointa

#### `explore/explore.handlers.ts`
- **Handler**: `handleGetExploreRecipeById` - obsługa GET `/explore/recipes/{id}`
  - Walidacja ID za pomocą Zod (pozytywny integer)
  - Wywołanie `getOptionalAuthenticatedUser` dla opcjonalnej autoryzacji
  - Delegacja do serwisu `getExploreRecipeById`
  - Ustawianie cache headers:
    - `Cache-Control: public, max-age=60` dla PUBLIC + anonimowo
    - `Cache-Control: no-store` dla pozostałych
- **Router**: `exploreRouter` - routing wewnętrzny dla ścieżek `/explore/*`
  - Obsługa `/recipes/{id}` (GET)
  - Zwracanie 404 dla nieznanych ścieżek
  - Zwracanie 405 dla nieobsługiwanych metod

#### `explore/explore.service.ts`
- **Funkcja biznesowa**: `getExploreRecipeById`
  - Używa **service role client** (bypass RLS)
  - Pobiera przepis z widoku `recipe_details`
  - **Obowiązkowy filtr**: `deleted_at IS NULL`
  - **Logika autoryzacji aplikacyjna**:
    - `visibility === 'PUBLIC'` → dostęp dla wszystkich
    - `visibility !== 'PUBLIC' && requesterUserId === recipe.user_id` → dostęp dla autora
    - W pozostałych przypadkach → `ApplicationError('NOT_FOUND')`
  - Mapowanie na DTO `RecipeDetailDto`
- **Typy DTO**: `RecipeDetailDto`, `CategoryDto`, `TagDto`, `RecipeContent`
- **Helpery**: `mapToDto` - mapowanie raw record na DTO

### 2. Rozszerzenie współdzielonego kodu: `supabase/functions/_shared/supabase-client.ts`

#### Nowa funkcja: `getOptionalAuthenticatedUser`
```typescript
export async function getOptionalAuthenticatedUser(req: Request): Promise<User | null>
```
- **Cel**: Obsługa endpointów z opcjonalnym uwierzytelnieniem
- **Zachowanie**:
  - Brak nagłówka `Authorization` → zwraca `null` (anonimowy request)
  - Nagłówek obecny + token poprawny → zwraca obiekt `User`
  - Nagłówek obecny + token niepoprawny → rzuca `ApplicationError('UNAUTHORIZED')`
- **Użycie**: Idealne dla publicznych endpointów z opcjonalnym dostępem dla zalogowanych

## Kluczowe Decyzje Implementacyjne

### 1. Opcjonalna Autoryzacja
- Endpoint akceptuje requesty **z tokenem i bez**
- Brak tokenu = tryb anonimowy (dostęp tylko do PUBLIC)
- Token niepoprawny = błąd 401 (nie ignorujemy błędnego tokenu)

### 2. Nie Ujawniamy Istnienia Zasobów
- Dla niepublicznych przepisów zawsze zwracamy **404**, nigdy **403**
- Uniemożliwia to "skanowanie" ID przepisów przez osoby nieuprawnione

### 3. Cache Headers
- Przepisy PUBLIC (anonimowo) mogą być cache'owane przez 60s
- Wszystkie inne odpowiedzi mają `Cache-Control: no-store`

### 4. Service Role Client + Application-level Security
- Używamy service role (pełne uprawnienia) zamiast klienta z tokenem użytkownika
- **Obowiązkowo** wymuszamy filtry bezpieczeństwa w kodzie:
  - `deleted_at IS NULL`
  - Sprawdzanie `visibility` i `user_id`

### 5. Soft Delete
- Przepisy z `deleted_at IS NOT NULL` traktowane jak nieistniejące (404)
- Filtr stosowany **zawsze** na poziomie zapytania SQL

## Bezpieczeństwo

✅ **Walidacja wejścia**: ID musi być pozytywnym integerem  
✅ **Autoryzacja**: Kontrola dostępu na poziomie aplikacji  
✅ **Soft delete**: Filtrowanie usuniętych przepisów  
✅ **Brak wycieku informacji**: 404 zamiast 403 dla niepublicznych  
✅ **CORS**: Poprawne nagłówki dla cross-origin requests  
✅ **Obsługa błędów**: Wszystkie edge case'y obsłużone

## Wydajność

✅ **Jeden SELECT**: Użycie widoku `recipe_details` (dane zagregowane)  
✅ **Index PK**: Wyszukiwanie po `id` (primary key)  
✅ **Minimalne kolumny**: SELECT tylko potrzebnych pól  
✅ **Cache dla PUBLIC**: Odciążenie backendu dla popularnych przepisów

## Testowanie (Plan Manualny)

| Scenariusz | Request | Oczekiwany Wynik |
|------------|---------|------------------|
| PUBLIC bez tokenu | GET `/explore/recipes/{id}` (PUBLIC) | 200 OK + dane + cache |
| PRIVATE bez tokenu | GET `/explore/recipes/{id}` (PRIVATE) | 404 Not Found |
| PRIVATE z tokenem autora | GET `/explore/recipes/{id}` (PRIVATE) + token autora | 200 OK + dane + no-cache |
| PRIVATE z tokenem innego usera | GET `/explore/recipes/{id}` (PRIVATE) + token innego | 404 Not Found |
| Błędny ID | GET `/explore/recipes/abc` | 400 Bad Request |
| Błędny token | GET `/explore/recipes/{id}` + token wygasły | 401 Unauthorized |
| Soft-deleted | GET `/explore/recipes/{id}` (deleted_at != null) | 404 Not Found |

## Zgodność z Planem API

✅ Endpoint zgodny z `docs/results/main-project-docs/009 API plan.md`  
✅ Response DTO: `RecipeDetailDto` (zgodny z kontraktami)  
✅ Kody błędów: 400, 401, 404, 500  
✅ Opcjonalne uwierzytelnienie  
✅ Cache headers według specyfikacji

## Pliki Zmodyfikowane/Utworzone

### Utworzone:
- `supabase/functions/explore/index.ts`
- `supabase/functions/explore/explore.handlers.ts`
- `supabase/functions/explore/explore.service.ts`
- `supabase/functions/explore/explore.types.ts`

### Zmodyfikowane:
- `supabase/functions/_shared/supabase-client.ts` (dodano `getOptionalAuthenticatedUser`)

## Następne Kroki

1. ✅ Wdrożenie endpointa (DONE)
2. ⏳ **Deploy do Supabase**: `supabase functions deploy explore`
3. ⏳ **Testowanie manualne** według tabeli powyżej
4. ⏳ **Integracja z frontendem**: Endpoint dostępny pod `GET /functions/v1/explore/recipes/{id}`

## Notatki

- Helper `getOptionalAuthenticatedUser` może być reużyty w innych endpointach z opcjonalnym auth
- Struktura kodu zgodna z wzorcem używanym w `public/` i `recipes/`
- Endpoint gotowy do użycia w widokach "Explore Details" na frontendzie
