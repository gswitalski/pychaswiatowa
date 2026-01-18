# API Endpoints Implementation Plan: AI – Normalized Ingredients (POST /ai/recipes/normalized-ingredients)

## 1. Przegląd punktu końcowego

Endpoint **`POST /ai/recipes/normalized-ingredients`** służy do normalizacji pozycji składników przepisu do ustrukturyzowanej listy przeznaczonej pod przyszłą funkcję listy zakupów.

- **Główne założenie**: endpoint jest przewidziany głównie dla jobów/workerów backendowych uruchamianych po `POST /recipes` lub `PUT /recipes/{id}` (nie dla standardowego UI MVP).
- **Wejście**: aktualna lista `ingredients` przepisu (JSONB), w formacie `[{ type: 'header'|'item', content: string }]` + lista `allowed_units`.
- **Wyjście**: lista pozycji `normalized_ingredients` gdzie każdy element ma:
  - `name` – liczba pojedyncza, mianownik (PL)
  - `amount` – liczba lub `null`
  - `unit` – wartość ze słownika `allowed_units` lub `null`
- **Reguły**:
  - Nagłówki sekcji (`type = "header"`) są ignorowane.
  - Konwersje tylko dla masy/objętości (np. `kg → g`, `l → ml`).
  - Gdy ilość/jednostka są niejednoznaczne (np. „do smaku”, „opcjonalnie”, „na oko”) – zwracamy tylko `name`, a `amount=null`, `unit=null`.

Implementacja powinna zostać dodana do istniejącej funkcji Supabase **`supabase/functions/ai`** zgodnie z obowiązującym wzorcem:
- `index.ts` – routing + obsługa błędów na najwyższym poziomie
- `ai.handlers.ts` – handler + walidacja Zod + formatowanie odpowiedzi
- `ai.service.ts` – logika biznesowa (wywołanie LLM + post-processing)
- `ai.types.ts` – typy + schematy walidacji

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL (Supabase Edge Function)**:  
  - Produkcyjnie: `/functions/v1/ai/recipes/normalized-ingredients`
  - Lokalnie: `http://localhost:54321/functions/v1/ai/recipes/normalized-ingredients`
- **Wymagane nagłówki**:
  - `Authorization: Bearer <JWT>` (wymagane)
  - `Content-Type: application/json`
- **Parametry URL**: brak

### Request Body (JSON)

Model kontraktu jest zdefiniowany w API Plan jako:

```json
{
    "recipe_id": 123,
    "language": "pl",
    "output_format": "pycha_normalized_ingredients_v1",
    "ingredients": [
        { "type": "header", "content": "Ciasto" },
        { "type": "item", "content": "1 kg mąki" },
        { "type": "item", "content": "do smaku sól" }
    ],
    "allowed_units": ["g", "ml", "szt.", "ząbek", "łyżeczka", "łyżka", "szczypta", "pęczek"]
}
```

- **Wymagane**:
  - `recipe_id` (number, int, > 0)
  - `output_format` (`"pycha_normalized_ingredients_v1"`)
  - `ingredients` (array, min 1; elementy `header|item`, `content` po trim min 1)
  - `allowed_units` (array, min 1; tylko wartości wspierane przez backend)
- **Opcjonalne**:
  - `language` (string; domyślnie `pl`)

## 3. Szczegóły odpowiedzi

### Sukces (200 OK)

- **Kod**: `200 OK`
- **Response Body (JSON)**:

```json
{
    "normalized_ingredients": [
        { "amount": 1000, "unit": "g", "name": "mąka" },
        { "amount": null, "unit": null, "name": "sól" }
    ],
    "meta": {
        "confidence": 0.78,
        "warnings": []
    }
}
```

### Wykorzystywane typy (DTO / Command modele)

### Kontrakty (shared)
Plik: `shared/contracts/types.ts`

Dodać nowe DTO/typy (lub wydzielić do sekcji AI), aby frontend + backend miały spójny kontrakt:

- **`AiNormalizedIngredientsRequestDto`**:
  - `recipe_id: number`
  - `language?: string`
  - `output_format: 'pycha_normalized_ingredients_v1'`
  - `ingredients: RecipeContent` (już istnieje jako `RecipeContent` / `RecipeContentItem`)
  - `allowed_units: NormalizedIngredientUnit[]`

- **`NormalizedIngredientUnit`** (MVP – controlled list):
  - `'g' | 'ml' | 'szt.' | 'ząbek' | 'łyżeczka' | 'łyżka' | 'szczypta' | 'pęczek'`

- **`NormalizedIngredientDto`**:
  - `amount: number | null`
  - `unit: NormalizedIngredientUnit | null`
  - `name: string`

- **`AiNormalizedIngredientsResponseDto`**:
  - `normalized_ingredients: NormalizedIngredientDto[]`
  - `meta: { confidence: number; warnings: string[] }`

### Typy i walidacja (Edge Function)
Plik: `supabase/functions/ai/ai.types.ts`

Zdefiniować:
- stałe: `REQUIRED_NORMALIZED_INGREDIENTS_OUTPUT_FORMAT`, limity payloadu i listy (`MAX_*`)
- `AiNormalizedIngredientsRequestSchema` (Zod)
- `AiNormalizedIngredientsResponseSchema` (Zod; walidacja odpowiedzi LLM)
- typy inferowane z Zod oraz parametry serwisu: `GenerateNormalizedIngredientsParams` i wynik serwisu

## 4. Przepływ danych

### High-level flow (handler → service)

1. **Autentykacja**:
   - `getAuthenticatedContext(req)` (wymagany JWT; w razie braku/wygaśnięcia: `401`)
2. **Walidacja JSON**:
   - `req.json()` (błędny JSON: `400`)
3. **Walidacja schematu wejściowego (Zod)**:
   - sprawdzenie typów i limitów (np. max liczba pozycji, max długość `content`, max `allowed_units`)
4. **Weryfikacja dostępu do przepisu** (anti-leak):
   - `getSupabaseClientWithAuth(token)` + query:
     - `.from('recipes').select('id').eq('id', recipe_id).is('deleted_at', null).single()`
   - jeśli brak rekordu / brak dostępu (RLS): zwrócić `404` („Recipe not found or you do not have access to it”)
5. **Pre-processing**:
   - wyciągnąć tylko `ingredients.filter(i => i.type === 'item')`
   - zachować kolejność wejściową
6. **Wywołanie LLM** (w serwisie):
   - model: spójnie z innymi endpointami AI (aktualnie `gpt-4o-mini`)
   - `response_format: { type: 'json_object' }`
   - prompt zawiera:
     - `allowed_units` (whitelist)
     - reguły konwersji (`kg→g`, `l→ml`)
     - reguły na niejednoznaczności → `amount/unit = null`
     - wymaganie `name` w PL, liczba pojedyncza, mianownik
7. **Walidacja odpowiedzi LLM**:
   - Zod: `normalized_ingredients` musi być tablicą, a każdy element musi mieć `name`, `amount|null`, `unit|null`
   - `unit`, jeśli nie-null, musi należeć do `allowed_units`
8. **Zwrócenie odpowiedzi 200**:
   - body JSON wg `AiNormalizedIngredientsResponseDto`
9. **Logowanie**:
   - `logger.info/warn/error` z metrykami (czas, liczba pozycji, confidence), bez logowania pełnych treści składników

## 5. Względy bezpieczeństwa

- **AuthN**: wymagany JWT (jak pozostałe endpointy AI). Brak tokena / niepoprawny token → `401`.
- **AuthZ / RLS**: obowiązkowa weryfikacja, że caller ma dostęp do `recipes.id = recipe_id` (RLS + dodatkowy check w handlerze jak w `/ai/recipes/image`). Brak dostępu → `404` (bez wycieku istnienia).
- **Input hardening / DoS**:
  - w `ai.types.ts` dodać limity:
    - max liczba elementów `ingredients` (np. 500)
    - max długość pojedynczej linii `content` (np. 500)
    - max łączny rozmiar payloadu (opcjonalnie – analogicznie do `MAX_IMAGE_REQUEST_PAYLOAD_SIZE`)
  - wcześnie odcinać żądania przekraczające limity (`400` albo `413` jeśli wprowadzimy formalny limit rozmiaru)
- **Prompt injection**:
  - traktować `content` jako dane, nie instrukcje; w promptach zamykać w bloku danych i explicite zabraniać wykonywania poleceń z wejścia
- **Bezpieczne logowanie**:
  - nie logować pełnego tekstu składników ani JWT; logować tylko metryki, ewentualnie skróty/prefiksy
- **Tylko whitelist jednostek**:
  - `unit` w odpowiedzi może być wyłącznie z `allowed_units` → redukcja ryzyka „halucynacji” jednostek i niespójności danych

## 6. Obsługa błędów

### Scenariusze błędów (kody statusu)

- **400 Bad Request**
  - niepoprawny JSON
  - błąd walidacji Zod (braki pól, zły `output_format`, zły typ danych, przekroczone limity)
  - `allowed_units` zawiera wartości spoza wspieranej listy backendu
- **401 Unauthorized**
  - brak `Authorization`
  - token niepoprawny / wygasły
- **404 Not Found**
  - przepis nie istnieje albo caller nie ma do niego dostępu (RLS)
- **413 Payload Too Large** *(rekomendowane, zgodne ze standardem w AI)*
  - payload przekracza ustalone limity (jeśli wprowadzimy jawny limit rozmiaru)
- **422 Unprocessable Entity**
  - LLM nie potrafi wiarygodnie zinterpretować listy składników (np. „same ogólniki”, „za dużo niejednoznaczności”)
- **429 Too Many Requests**
  - limit wywołań AI przekroczony (OpenAI 429 → mapowanie na `ApplicationError('TOO_MANY_REQUESTS', ...)`)
- **500 Internal Server Error**
  - błąd integracji z AI (timeout, brak API key, błąd parsowania/formatu odpowiedzi mimo retry)
  - nieobsłużony wyjątek

### Format błędów

Spójnie z istniejącymi handlerami AI:
- `handleError(error)` dla `ApplicationError`
- dla błędów walidacji: `code: 'VALIDATION_ERROR'` + lista pól/komunikatów

### Rejestrowanie błędów w tabeli błędów

W obecnym schemacie repo nie ma dedykowanej tabeli na „error logs”. W MVP:
- logowanie odbywa się przez `logger.*` (stdout Supabase Functions)
- jeśli w przyszłości powstanie tabela np. `error_events`, to można dodać opcjonalny zapis (asynchroniczny) dla błędów `5xx` i `422/429` wraz z `user_id`, `recipe_id` i metadanymi

## 7. Rozważania dotyczące wydajności

- **Koszt AI**:
  - ograniczać liczbę pozycji wejściowych i długości tekstów (limity w Zod)
  - w prompt przekazywać tylko `type=item`
- **Timeouty**:
  - reużyć podejście z `ai.service.ts` (AbortController + limity czasu)
- **Stabilność**:
  - walidować odpowiedź LLM przez Zod, aby uniknąć propagowania „halucynacji” do bazy
- **Idempotencja**:
  - endpoint jest czysto obliczeniowy (nie zapisuje do DB) → łatwy retry po błędach 5xx/429

## 8. Kroki implementacji

1. **Kontrakty shared**
   - W `shared/contracts/types.ts` dodać typy DTO/Command dla normalizacji składników:
     - `NormalizedIngredientUnit`, `NormalizedIngredientDto`
     - `AiNormalizedIngredientsRequestDto`, `AiNormalizedIngredientsResponseDto`
2. **Typy i walidacja w Edge Function**
   - W `supabase/functions/ai/ai.types.ts` dodać:
     - `REQUIRED_NORMALIZED_INGREDIENTS_OUTPUT_FORMAT = 'pycha_normalized_ingredients_v1'`
     - Zod schema requestu i response’u
     - limity (max items, max length, opcjonalnie max payload size)
3. **Serwis**
   - W `supabase/functions/ai/ai.service.ts` dodać:
     - `generateNormalizedIngredients(params)`:
       - budowa promptu + wywołanie OpenAI (jak `generateRecipeDraft`)
       - walidacja i mapowanie do `AiNormalizedIngredientsResponseDto`
       - mapowanie błędów na `ApplicationError` (`TOO_MANY_REQUESTS`, `UNPROCESSABLE_ENTITY`, `INTERNAL_ERROR`)
4. **Handler + router**
   - W `supabase/functions/ai/ai.handlers.ts`:
     - dodać `handlePostAiRecipesNormalizedIngredients(req)`
     - dodać routing w `aiRouter`:
       - `POST /ai/recipes/normalized-ingredients`
       - 405 dla innych metod
     - dodać check dostępu do przepisu (query do `recipes` z `.is('deleted_at', null)`)
5. **Testy ręczne**
   - Rozszerzyć `supabase/functions/ai/test-requests.http` o nowe requesty:
     - poprawny przypadek (np. `1 kg mąki`, `2 łyżki cukru`, `do smaku sól`)
     - przypadek niejednoznaczny → `amount/unit = null`
     - walidacja `allowed_units` (błąd 400)
     - brak tokena (401)
     - recipe_id bez dostępu (404)
6. **Dokumentacja testowa**
   - Dopisać sekcję w `supabase/functions/ai/TESTING_TIPS.md` dla nowego endpointu:
     - checklist (czas odpowiedzi, format jednostek, ignorowanie nagłówków)
7. **Wdrożenie**
   - `supabase functions deploy ai`
8. **(Opcjonalnie) Integracja z jobem**
   - W miejscu, gdzie po `POST/PUT /recipes` zlecamy job, worker powinien wywołać ten endpoint z JWT użytkownika i zapisać wynik do tabeli/kolumn przechowujących `normalized_ingredients` (zgodnie z aktualnym schematem DB).

