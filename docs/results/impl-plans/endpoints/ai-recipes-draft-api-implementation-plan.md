# API Endpoints Implementation Plan: `POST /ai/recipes/draft`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/ai-recipes-draft-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `/functions/v1/ai` + routing wewnętrzny do `/recipes/draft`

## 1. Przegląd punktu końcowego

Endpoint `POST /ai/recipes/draft` generuje **draft przepisu** (dane do prefillu formularza tworzenia przepisu) na podstawie:

- **tekstu** wklejonego przez użytkownika, albo
- **obrazu** wklejonego/załadowanego (OCR + LLM),

zwracając ustrukturyzowany JSON z polami:
`name`, `description`, `ingredients_raw`, `steps_raw`, `category_name`, `tags`.

**Krytyczne założenia biznesowe**:

- Draft **nie jest persystowany** (brak zapisu do tabel `recipes`, `tags`, `recipe_tags`, storage itd.).
- Endpoint jest **chroniony** i wymaga poprawnego JWT (Supabase Auth).
- Endpoint wymusza walidację „**pojedynczy przepis**”; gdy wejście wygląda na wiele przepisów lub treść nie-recepturową, zwraca błąd walidacji.

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL:
    - publiczny adres funkcji: `POST /functions/v1/ai/recipes/draft`
    - (w dokumentacji REST): `POST /ai/recipes/draft`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)

### Parametry

- Wymagane:
    - Brak query params i path params (poza routingiem wewnętrznym `/recipes/draft`)
- Opcjonalne:
    - Brak

### Request Body (warianty)

#### Wariant A: `source = "text"`

Wymagane:
- `source`: `"text"`
- `text`: string (niepusty)
- `output_format`: `"pycha_recipe_draft_v1"`

Opcjonalne:
- `language`: string (np. `"pl"`, domyślnie `"pl"`)

#### Wariant B: `source = "image"`

Wymagane:
- `source`: `"image"`
- `image.mime_type`: `"image/png" | "image/jpeg" | "image/webp"`
- `image.data_base64`: string base64 (niepusty)
- `output_format`: `"pycha_recipe_draft_v1"`

Opcjonalne:
- `language`: string (np. `"pl"`, domyślnie `"pl"`)

### Walidacja wejścia (Zod)

Walidacja ma być wykonana w handlerze, zgodnie z regułami projektu (logika w serwisie, walidacja i formatowanie odpowiedzi w handlerze).

Zalecane reguły:

- `source` musi być dokładnie `"text"` lub `"image"`.
- `output_format` musi być dokładnie `"pycha_recipe_draft_v1"` (w przeciwnym razie: `400`).
- Dla `source="text"`:
    - `text`: minimum 1 znak po `trim()`
    - limit długości (ochrona kosztów i czasu): np. `max 50_000` znaków (przekroczenie: `400`)
- Dla `source="image"`:
    - `mime_type` tylko z allow-list
    - `data_base64` musi się dekodować do bajtów
    - limit rozmiaru po dekodowaniu (np. `max 10 MB`) (przekroczenie: `413`)
    - odrzucić podejrzane/nieobsługiwane formaty (np. `image/gif`) (`400`)

## 3. Wykorzystywane typy

### Frontend/Shared kontrakty (proponowane do dodania)

W pliku `shared/contracts/types.ts` obecnie nie ma kontraktów dla AI draft. Aby uniknąć rozjazdu typów FE/BE, zalecane jest dodanie:

- `export type AiRecipeDraftSource = 'text' | 'image';`
- `export interface AiRecipeDraftImageDto { mime_type: 'image/png' | 'image/jpeg' | 'image/webp'; data_base64: string; }`
- `export interface AiRecipeDraftRequestDto { source: AiRecipeDraftSource; text?: string; image?: AiRecipeDraftImageDto; language?: string; output_format: 'pycha_recipe_draft_v1'; }`
- `export interface AiRecipeDraftDto { name: string; description: string | null; ingredients_raw: string; steps_raw: string; category_name: string | null; tags: string[]; }`
- `export interface AiRecipeDraftResponseDto { draft: AiRecipeDraftDto; meta: { confidence: number; warnings: string[]; }; }`
- (opcjonalnie, jeżeli utrzymujemy 422 w dedykowanym formacie):  
  `export interface AiRecipeDraftUnprocessableEntityDto { message: string; reasons: string[]; }`

### Backend (typy lokalne w funkcji)

W folderze `supabase/functions/ai/` zalecane jest utrzymywanie:

- `ai.types.ts`:
    - Zod schema dla requestu (dwa warianty union)
    - Zod schema dla outputu z LLM (draft + meta)
    - typy pomocnicze dla warstwy serwisowej

## 4. Szczegóły odpowiedzi

### `200 OK` (sukces)

Body:

- `draft`:
    - `name`: string
    - `description`: string | null
    - `ingredients_raw`: string
    - `steps_raw`: string
    - `category_name`: string | null
    - `tags`: string[]
- `meta`:
    - `confidence`: number (0..1)
    - `warnings`: string[]

### Błędy

> Uwaga: obecnie w projekcie `ApplicationError` mapuje kody na: `400/401/403/404/409/500` (`supabase/functions/_shared/errors.ts`).  
> Ten endpoint wymaga dodatkowych statusów (`413/422/429`), więc plan zakłada rozszerzenie wspólnego mechanizmu błędów albo zwracanie manualnych `Response` w handlerze (szczegóły w sekcji 6).

- `400 Bad Request`
    - niepoprawny JSON
    - brak wymaganych pól dla wybranego `source`
    - zły `output_format`
    - nieobsługiwany `mime_type`
    - tekst zbyt krótki/pusty lub przekroczony limit znaków
- `401 Unauthorized`
    - brak/nieprawidłowy JWT (obsługiwane przez `getAuthenticatedContext`)
- `413 Payload Too Large`
    - obraz po dekodowaniu base64 przekracza limit rozmiaru
- `422 Unprocessable Entity`
    - wejście nie opisuje pojedynczego przepisu (np. wiele przepisów, brak kroków/składników, treść reklamowa)
    - payload (zgodny z API planem): `{ "message": "...", "reasons": ["..."] }`
- `429 Too Many Requests`
    - przekroczony limit zapytań AI per użytkownik (rate limiting)
- `500 Internal Server Error`
    - błąd dostawcy OCR/LLM
    - błąd sieci/timeout
    - nieudane parsowanie odpowiedzi LLM do wymaganego formatu

## 5. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Utworzyć funkcję:

```
supabase/functions/ai/
    index.ts
    ai.handlers.ts
    ai.service.ts
    ai.types.ts               (opcjonalnie, zalecane)
```

Routing:

- `index.ts`:
    - przyjęcie requestu
    - delegacja do routera z `ai.handlers.ts`
    - najwyższy poziom obsługi błędów przez `handleError()`
- `ai.handlers.ts`:
    - router ścieżek (na bazie `new URL(req.url).pathname`)
    - `POST /recipes/draft` → `handlePostAiRecipesDraft(req)`
    - walidacja Zod requestu
    - formatowanie odpowiedzi i mapowanie błędów (w tym 413/422/429)
- `ai.service.ts`:
    - logika biznesowa:
        - OCR/ekstrakcja tekstu (dla obrazu)
        - wywołanie LLM i walidacja „single recipe”
        - normalizacja outputu (tagi, puste pola, format raw)

### Kroki wykonania (happy path)

1. `handlePostAiRecipesDraft` wywołuje `getAuthenticatedContext(req)` z `supabase/functions/_shared/supabase-client.ts` (wymusza `401` przy braku/invalid token).
2. Handler parsuje `await req.json()`:
    - jeśli błąd parsowania → `400`.
3. Handler waliduje body Zod (union: `text` vs `image`):
    - jeśli błąd walidacji → `400`.
4. Serwis:
    - jeśli `source="text"`:
        - `inputText = text.trim()`
    - jeśli `source="image"`:
        - decode base64 → bytes
        - walidacja limitu rozmiaru → `413`
        - OCR (zewnętrzny provider) → `inputText`
5. Serwis wywołuje LLM do generacji draftu:
    - prompt/system instrukcje wymuszające format `pycha_recipe_draft_v1`
    - jawna instrukcja: „jeśli nie jest to pojedynczy przepis, zwróć błąd + powody”
6. Serwis waliduje output LLM (Zod):
    - jeśli output niezgodny → `500` (błąd integracji / provider drift)
7. Serwis wykonuje post-processing:
    - `tags`: trim, usunięcie pustych, deduplikacja case-insensitive, limit np. max 20
    - `name`: trim, limit do 150 znaków (zgodne z DB)
    - `ingredients_raw`, `steps_raw`: niepuste (w przeciwnym razie to jest case `422`)
8. Handler zwraca `200` z `{ draft, meta }`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: wymagane; używać `getAuthenticatedContext(req)` (bez service role).
- **Brak persystencji**: brak zapisów do DB/Storage (poza ewentualnym rate limiting / logami audytowymi opisanymi niżej).
- **Ochrona kosztów i DoS**:
    - limit rozmiaru tekstu i obrazu
    - limit czasu wywołań (timeout) do providerów
    - rate limiting per user (`429`)
- **Bezpieczne logowanie**:
    - nie logować pełnego `text` ani `data_base64`
    - logować jedynie metadane: `user.id`, rozmiary, czas trwania, status, provider, correlation id
- **Prompt injection / treści szkodliwe**:
    - nie wykonywać instrukcji z treści wejściowej
    - system prompt powinien wymuszać wyłącznie ekstrakcję i strukturyzację
    - output walidować schematem i odrzucać niezgodne
- **Sekrety**: klucze providerów tylko z `Deno.env`, nigdy w odpowiedzi.

## 7. Obsługa błędów

### Spójność z istniejącym mechanizmem błędów

Aktualnie `ApplicationError` nie obsługuje `413/422/429`. Są dwa akceptowalne podejścia:

1. **Rekomendowane (spójne globalnie)**: rozszerzyć `ErrorCode` w `supabase/functions/_shared/errors.ts` o:
    - `PAYLOAD_TOO_LARGE` → 413
    - `UNPROCESSABLE_ENTITY` → 422
    - `TOO_MANY_REQUESTS` → 429
   i używać `ApplicationError` wszędzie, również w AI.

2. **Minimal-inwazyjne (lokalnie w AI)**: w `ai.handlers.ts` dla tych trzech przypadków zwracać manualnie:
    - `new Response(JSON.stringify(...), { status: 413|422|429, headers: ... })`
   a pozostałe błędy rzucać jako `ApplicationError` i obsługiwać przez `handleError()`.

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W aktualnym schemacie DB (wg `docs/results/main-project-docs/008 DB Plan.md`) nie ma dedykowanej tabeli na logi błędów/AI usage. Jeżeli chcecie śledzić koszty i stabilność:

- dodać nową tabelę (np. `ai_request_logs`) z RLS i minimalnym zakresem danych, np.:
    - `id`, `user_id`, `created_at`
    - `source` (`text|image`)
    - `input_size_chars` / `image_size_bytes`
    - `status_code`
    - `provider` (nazwa)
    - `latency_ms`
    - (opcjonalnie) `tokens_in`, `tokens_out`
    - (opcjonalnie) `error_code`, `error_message_short`
- nie przechowywać pełnego wejścia/obrazu ani promptów (ryzyko prywatności).

### Scenariusze błędów i kody

- `400`:
    - invalid JSON
    - schema validation fail
    - unsupported mime type
    - `output_format` inne niż `pycha_recipe_draft_v1`
- `401`:
    - brak/invalid JWT
- `413`:
    - za duży obraz
- `422`:
    - brak pojedynczego przepisu (w tym brak istotnych sekcji)
- `429`:
    - przekroczony limit
- `500`:
    - błąd providera / timeout / niepoprawny output LLM

## 8. Wydajność

- **Limity wejścia**: kluczowe dla czasu odpowiedzi i kosztu LLM.
- **Równoległość**:
    - dla `source="image"`: OCR → dopiero potem LLM (sekwencyjnie)
    - dla `source="text"`: bezpośrednio LLM
- **Stabilność outputu**:
    - walidacja schematem i „retry once” (opcjonalnie) w przypadku niezgodnego formatu
- **Timeouty**:
    - OCR timeout (np. 10–15s)
    - LLM timeout (np. 20–30s)
- **Konfiguracja**:
    - parametry LLM: niska temperatura, ograniczone `max_tokens`

## 9. Kroki implementacji

1. Utworzyć katalog `supabase/functions/ai/`.
2. Dodać `supabase/functions/ai/index.ts`:
    - wzorować się na `supabase/functions/public/index.ts` / `supabase/functions/search/index.ts`
    - wywołać router i obsłużyć błędy przez `handleError()`.
3. Dodać `supabase/functions/ai/ai.handlers.ts`:
    - routing ścieżek:
        - `POST /recipes/draft` obsłużony
        - inne ścieżki → `404`
    - walidacja Zod requestu
    - mapowanie błędów (w tym 413/422/429).
4. Dodać `supabase/functions/ai/ai.service.ts`:
    - `generateRecipeDraft({ userId, source, text?, image?, language })`
    - integracja z OCR/LLM providerem poprzez env vars
    - single-recipe validation + powody (`reasons`)
    - normalizacja pól do kontraktu.
5. Dodać `supabase/functions/ai/ai.types.ts`:
    - schematy Zod: request i response
    - typy pomocnicze.
6. (Rekomendowane) Rozszerzyć `supabase/functions/_shared/errors.ts` o kody 413/422/429 albo zaimplementować manualne odpowiedzi tylko w AI (wybrać jedną ścieżkę i udokumentować w kodzie).
7. Dodać kontrakty do `shared/contracts/types.ts` (request/response AI), aby frontend konsumował stabilny typ.
8. (Opcjonalnie) Dodać migrację DB dla `ai_request_logs` i/lub rate limiting:
    - rate limiting per `user_id` (np. okno czasowe 1 minuta / 10 minut)
    - zwracać `429` po przekroczeniu.
9. Dokumentacja konfiguracji:
    - dopisać wymagane env vars (provider keys) w `ENV_SETUP.md` lub dedykowanym doc.
10. Testowanie lokalne:
    - uruchomić: `supabase functions serve ai`
    - testować: `POST http://localhost:54331/functions/v1/ai/recipes/draft`
    - przypadki:
        - poprawny tekst (200)
        - pusty tekst (400)
        - za duży obraz (413)
        - multi-recipe tekst (422)
        - brak Authorization (401)
        - rate limit (429)


