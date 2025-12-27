# API Endpoints Implementation Plan: `POST /ai/recipes/image`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/ai-recipes-image-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `/functions/v1/ai` + routing wewnętrzny do `/recipes/image`

## 1. Przegląd punktu końcowego

Endpoint `POST /ai/recipes/image` generuje **podgląd zdjęcia potrawy** (AI image preview) na podstawie **aktualnego stanu formularza przepisu** (w tym niesave’owanych zmian).

**Co zwraca**:
- obraz jako base64 w polu `image.data_base64`
- format obrazu w MVP: `image/webp` (rekomendowane `1024x1024`)
- metadane `meta.style_contract` potwierdzające „kontrakt stylu” (fotorealistyczny, rustykalny stół, naturalne światło, brak ludzi/tekstu/wodnych znaków)

**Krytyczne założenia biznesowe**:
- Endpoint **nie zapisuje** nic do DB ani Storage. To jest tylko „preview”.
- Użytkownik „aplikuje” obraz dopiero przez istniejący endpoint uploadu (np. `POST /recipes/{id}/image`).
- Endpoint jest **chroniony JWT** oraz **zabroniony dla `app_role=user`** (premium-gating).

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL:
    - publiczny adres funkcji: `POST /functions/v1/ai/recipes/image`
    - (w dokumentacji REST): `POST /ai/recipes/image`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)

### Parametry

- Wymagane:
    - brak query params i path params (poza routingiem wewnętrznym `/recipes/image`)
- Opcjonalne:
    - brak

### Request Body

Wymagane (wg API plan):

```json
{
  "recipe": {
    "id": 123,
    "name": "Sernik klasyczny",
    "description": "Kremowy sernik na spodzie z herbatników.",
    "servings": 8,
    "is_termorobot": false,
    "category_name": "Deser",
    "ingredients": [
      { "type": "header", "content": "Masa" },
      { "type": "item", "content": "twaróg" }
    ],
    "steps": [
      { "type": "item", "content": "Wymieszać składniki." }
    ],
    "tags": ["wypieki", "sernik"]
  },
  "output": {
    "mime_type": "image/webp",
    "width": 1024,
    "height": 1024
  },
  "language": "pl",
  "output_format": "pycha_recipe_image_v1"
}
```

### Walidacja wejścia (Zod) – zasady

Walidacja ma być wykonana w handlerze (Zod), a logika generacji w serwisie:

- `output_format` musi być dokładnie `"pycha_recipe_image_v1"` (w przeciwnym razie `400`).
- `recipe.id`: liczba dodatnia (integer).
- `recipe.name`: 1–150 znaków po `trim()`.
- `recipe.description`: `string | null` (z limitem długości, np. 0–500; jeśli > limit → `400`).
- `recipe.servings`: `number | null` (1–99) lub null.
- `recipe.is_termorobot`: boolean (opcjonalny, domyślnie `false`).
- `recipe.category_name`: `string | null` (opcjonalnie; limit np. 1–50).
- `recipe.ingredients` i `recipe.steps`:
    - muszą być tablicami
    - minimum 1 element każda
    - każdy element ma `type: 'header' | 'item'` oraz `content: string` (niepusty po `trim()`)
    - limit ilości elementów (np. max 200 per lista) – ochrona kosztów
- `recipe.tags`: tablica stringów (trim), deduplikacja case-insensitive, limit (np. max 20).
- `output`:
    - `mime_type` tylko `"image/webp"` (MVP)
    - `width` i `height` tylko `1024` (MVP)
    - jeśli klient wyśle inne wartości: `400` (lub ignorować i wymuszać MVP; decyzja musi być spójna i udokumentowana w kodzie)
- „Limit rozmiaru payloadu” (ochrona kosztów): ograniczyć łączną długość zserializowanych pól wejściowych (np. 20–40k znaków po zbudowaniu promptu) – przekroczenie: `400`.

## 3. Wykorzystywane typy

### Frontend/Shared kontrakty (spójność FE/BE)

W `shared/contracts/types.ts` istnieją już typy dla AI draft. Dla image endpointu zalecane jest dodanie (lub potwierdzenie istniejących) kontraktów:

- `AiRecipeImageRequestDto` (request)
- `AiRecipeImageResponseDto` (response)
- `AiRecipeImageUnprocessableEntityDto` (opcjonalnie; jeśli utrzymujemy 422 ze stałym payloadem)

Zgodność z API planem:
- `output_format: 'pycha_recipe_image_v1'`
- `output.mime_type: 'image/webp'`

### Backend (typy lokalne w funkcji)

W `supabase/functions/ai/ai.types.ts` dodać:
- Zod schema dla requestu `AiRecipeImageRequestSchema`
- Zod schema dla response `AiRecipeImageResponseSchema` (opcjonalnie; pomocne do sanity-check)
- typy serwisu, np.:
    - `GenerateRecipeImageParams`
    - `GenerateRecipeImageResult` (success/failure z powodami dla 422)

## 4. Szczegóły odpowiedzi

### `200 OK` (sukces)

```json
{
  "image": {
    "mime_type": "image/webp",
    "data_base64": "UklGRiQAAABXRUJQVlA4..."
  },
  "meta": {
    "style_contract": {
      "photorealistic": true,
      "rustic_table": true,
      "natural_light": true,
      "no_people": true,
      "no_text": true,
      "no_watermark": true
    },
    "warnings": []
  }
}
```

### Błędy (wg API plan)

- `400 Bad Request`
    - invalid JSON
    - walidacja Zod (brak/typy pól, zły `output_format`, złe `output.*`)
    - zbyt duży payload wejściowy (koszt/DoS)
- `401 Unauthorized`
    - brak/nieprawidłowy JWT (Supabase Auth)
- `403 Forbidden`
    - `app_role=user` (premium gating)
    - payload: `{ "message": "Premium feature. Upgrade required." }`
- `422 Unprocessable Entity`
    - „insufficient information” do wygenerowania sensownego zdjęcia jednego dania (np. zbyt ogólny opis, brak składników/kroków, sprzeczne dane)
    - payload: `{ "message": "...", "reasons": ["..."] }` (zalecane, analogicznie do draft)
- `429 Too Many Requests` (zalecane – kontrola kosztów)
    - rate limit per user
- `500 Internal Server Error`
    - błąd providera obrazów / timeout / błąd konwersji do webp / nieoczekiwany błąd

## 5. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Funkcja już istnieje jako `supabase/functions/ai/`:

```
supabase/functions/ai/
    index.ts
    ai.handlers.ts
    ai.service.ts
    ai.types.ts
```

Zalecenie utrzymania czytelności przy dodaniu nowego endpointu:
- **Opcja A (szybka)**: dopisać nowy handler + serwis w tych samych plikach (`ai.handlers.ts`, `ai.service.ts`).
- **Opcja B (rekomendowana)**: rozbić na dodatkowe moduły w tym samym katalogu, np.:
    - `ai-image.handlers.ts` (walidacja i formatowanie odpowiedzi)
    - `ai-image.service.ts` (generacja obrazu)
    - router w `ai.handlers.ts` deleguje do nowych plików.

### Happy path (krok po kroku)

1. `index.ts` przyjmuje request i deleguje do `aiRouter(req)`.
2. Router rozpoznaje ścieżkę `POST /recipes/image` i wywołuje `handlePostAiRecipesImage(req)`.
3. Handler:
    - `getAuthenticatedContext(req)` → weryfikuje JWT (`401` gdy brak/invalid).
    - wyciąga token z `Authorization` i odczytuje `app_role` przez `_shared/auth.ts`:
        - `extractAndValidateAppRole(...)`
        - jeśli `app_role === 'user'` → zwraca `403` z payloadem premium.
4. (Zalecane) Ownership-check `recipe.id`:
    - `select id from recipes where id = :id and deleted_at is null` przez klienta z JWT
    - jeśli brak rekordu (RLS lub nieistniejący) → traktować jako `404` (lub `400`; decyzja musi być spójna).
5. Handler parsuje `await req.json()`:
    - jeśli błąd parsowania → `400`.
6. Handler waliduje request Zod:
    - jeśli błąd walidacji → `400`.
7. Handler woła serwis `generateRecipeImage({...})`.
8. Serwis:
    - buduje prompt „opis zdjęcia” na podstawie `recipe` + kontraktu stylu
    - wykonuje wywołanie do providera generacji obrazów (OpenAI lub inny) z timeoutem
    - wymusza brak tekstu, brak ludzi, brak watermark
    - zapewnia wynik w `image/webp`:
        - preferowane: provider zwraca webp base64
        - jeśli provider zwraca PNG/JPEG: serwis konwertuje do webp (np. biblioteka Deno/WASM) albo zwraca `500` z jasnym logiem (MVP decyzja)
9. Handler zwraca `200` z `{ image, meta }`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: wymagane; używać `getAuthenticatedContext(req)` (bez service role).
- **Autoryzacja premium**:
    - `app_role` musi być `premium | admin`
    - weryfikacja claimu w JWT (po stronie Edge Function) + ewentualnie dodatkowe zabezpieczenia po stronie DB w przyszłości
- **Ochrona kosztów i nadużyć**:
    - rate limiting per user (`429`)
    - limity długości pól i liczby elementów `ingredients/steps`
    - timeouty na providerze
- **Bezpieczne logowanie**:
    - nie logować pełnych treści `ingredients/steps` ani całego promptu
    - logować tylko metadane: `userId`, `recipeId`, `inputSizes`, `durationMs`, `statusCode`, `provider`
- **Sekrety**:
    - klucze providerów tylko z `Deno.env`, nigdy w response
- **Treści wrażliwe**:
    - wejście to dane użytkownika; endpoint nie powinien odsyłać żadnych danych z DB poza ewentualnym „istnieje/nie istnieje”

## 7. Obsługa błędów

### Mapowanie kodów HTTP

- `400`: walidacja requestu / nieprawidłowy `output_format` / nieobsługiwane `output.*`
- `401`: brak/invalid JWT
- `403`: `app_role=user` (premium gating) – payload zgodny z API planem
- `404` (opcjonalnie, jeśli robimy ownership-check): `recipe.id` nie należy do usera lub jest usunięty (soft delete)
- `422`: zbyt mało informacji / nie da się wygenerować „jednego dania” w sposób sensowny
- `429`: rate limit
- `500`: błąd providera / konwersji / timeout / błąd nieoczekiwany

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W aktualnym schemacie DB (wg `docs/results/main-project-docs/008 DB Plan.md`) nie ma tabeli do logów AI. W MVP:
- logować przez `logger` (Edge Function logs)

Jeśli chcemy kontrolować koszty i stabilność:
- dodać tabelę np. `ai_request_logs` (lub `ai_image_generation_logs`) z RLS i minimalnym zestawem pól (bez promptu i bez base64).

## 8. Wydajność

- **Stały rozmiar outputu** (MVP): `1024x1024 webp` – stabilny koszt.
- **Minimalizacja promptu**:
    - zamiast wysyłać pełne listy, można budować „skondensowany opis” (np. top N składników + 3–7 kluczowych kroków), żeby zmniejszyć tokeny.
- **Timeouty**:
    - wywołanie do providera obrazów powinno mieć timeout (np. 30–60s zależnie od SLA)
- **Rate limiting**:
    - per user (np. 5 obrazów / 10 min; premium może mieć wyższy limit)

## 9. Kroki implementacji

1. **Routing**:
    - w `supabase/functions/ai/ai.handlers.ts` dodać route:
        - `POST /ai/recipes/image` → `handlePostAiRecipesImage`
2. **Typy i walidacja**:
    - w `supabase/functions/ai/ai.types.ts` dodać `AiRecipeImageRequestSchema` (+ stałe: dozwolone wymiary/mime)
3. **Premium gating**:
    - w handlerze:
        - odczytać `Authorization`
        - wyciągnąć `app_role` (`_shared/auth.ts`)
        - dla `user` zwrócić `403` z payloadem premium
4. **Ownership-check (zalecane)**:
    - prosty `select` po `recipes.id` (RLS zapewni własność)
    - `deleted_at IS NULL` (soft delete)
5. **Serwis generacji obrazu**:
    - dodać `generateRecipeImage(...)` (w `ai.service.ts` albo w osobnym pliku)
    - implementacja:
        - budowa promptu zgodnego z kontraktem stylu
        - call do providera obrazów
        - zwrot base64 webp + `meta.style_contract` + `warnings`
6. **Obsługa 422**:
    - zdefiniować kryteria „insufficient information” i mapować do `422` (z `reasons`)
7. **Rate limiting (zalecane)**:
    - dodać mechanizm limitów per user (DB lub KV)
    - mapować do `429` (z `Retry-After` jeśli możliwe)
8. **Dokumentacja i konfiguracja**:
    - dopisać wymagane ENV (`OPENAI_API_KEY` + ewentualne modele/endpointy) do `ENV_SETUP.md`
9. **Testowanie lokalne**:
    - `supabase functions serve ai`
    - `POST http://localhost:54331/functions/v1/ai/recipes/image`
    - przypadki:
        - premium/admin (200)
        - user (403)
        - brak Authorization (401)
        - zły `output_format` (400)
        - brak wymaganych pól (400)
        - „za mało informacji” (422)
        - rate limit (429)


