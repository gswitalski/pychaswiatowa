# API Endpoints Implementation Plan: `POST /ai/recipes/image`

> **Plik docelowy**: `docs/results/impl-plans/endpoints/ai-recipes-image-api-implementation-plan.md`  
> **Warstwa**: Supabase Edge Function (TypeScript / Deno)  
> **Routing Supabase**: `/functions/v1/ai` + routing wewnętrzny do `/recipes/image`  
> **Zmiana w tym planie**: migracja generowania obrazu z `dall-e-3` na **`gpt-image-1.5`** (OpenAI Images API `POST /v1/images/generations`) + doprecyzowanie parametrów wyjścia MVP

## 1. Przegląd punktu końcowego

Endpoint `POST /ai/recipes/image` generuje **podgląd zdjęcia potrawy** na podstawie **aktualnego stanu formularza przepisu** (w tym niezapisanych zmian).

- **Co zwraca**: obraz jako base64 w polu `image.data_base64` (MVP: `image/webp`, `1024x1024`) oraz `meta.style_contract` potwierdzające kontrakt stylu.
- **Czego nie robi**: nie zapisuje nic do DB ani Supabase Storage — to jest wyłącznie „preview”.
- **Jak obraz jest „aplikowany”**: dopiero po akceptacji użytkownika, przez istniejący endpoint uploadu (np. `POST /recipes/{id}/image`).
- **Ograniczenia dostępu**: wymaga JWT + premium gating (`app_role` w JWT: tylko `premium` lub `admin`).

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL:
    - publiczny adres funkcji: `POST /functions/v1/ai/recipes/image`
    - (w dokumentacji REST): `POST /ai/recipes/image`
- Nagłówki:
    - `Authorization: Bearer <JWT>` (**wymagane**)
    - `Content-Type: application/json` (**wymagane**)

### Parametry

- Wymagane: brak (poza routingiem wewnętrznym `/recipes/image`)
- Opcjonalne: brak

### Request Body

Wymagane (wg `docs/results/main-project-docs/009 API plan.md`):

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
      { "type": "item", "content": "Wymieszaj składniki." }
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

### Walidacja wejścia (Zod) – zasady (MVP)

Walidacja jest wykonywana w handlerze (Zod), logika generacji w serwisie:

- `output_format`: literal `"pycha_recipe_image_v1"` (inaczej `400`).
- `recipe.id`: `int > 0`.
- `recipe.name`: `trim()`, 1–150 znaków.
- `recipe.description`: `string | null`, `trim()`, max 500 znaków.
- `recipe.servings`: `int 1–99 | null`.
- `recipe.is_termorobot`: `boolean` (opcjonalne, domyślnie `false`).
- `recipe.category_name`: `string | null`, `trim()`, max 50 znaków.
- `recipe.ingredients` i `recipe.steps`:
    - tablice, min 1 element, max 200 elementów,
    - każdy element: `type: 'header' | 'item'` oraz `content: string` (po `trim()`, niepusty).
- `recipe.tags`: tablica stringów, `trim()`, max 20 (zalecane: deduplikacja case-insensitive w serwisie/pomocniku).
- `output` (MVP):
    - `mime_type`: **tylko** `"image/webp"`,
    - `width`: literal `1024`,
    - `height`: literal `1024`.
- Limit rozmiaru payloadu (ochrona kosztów/DoS): max 40k znaków dla surowego JSON body (`400` lub `413` zależnie od konwencji w odpowiedziach).

## 3. Wykorzystywane typy

### Kontrakty FE/Shared

W `shared/contracts/types.ts` istnieją już typy zgodne z API planem:

- `AiRecipeImageRequestDto`
- `AiRecipeImageResponseDto`
- `AiRecipeImageUnprocessableEntityDto`

Kluczowe stałe kontraktu:

- `output_format: 'pycha_recipe_image_v1'`
- `output.mime_type: 'image/webp'`
- `output.width/height: 1024`

### Backend (Edge Function)

W `supabase/functions/ai/ai.types.ts` powinny być utrzymywane:

- `AiRecipeImageRequestSchema` (Zod) i typ `AiRecipeImageRequest`
- `AiRecipeImageResponseDto`, `AiRecipeImageUnprocessableEntityDto`
- `GenerateRecipeImageParams` oraz wynik `ImageGenerationResult`

W ramach tej zmiany należy **zaktualizować stałe/komentarze** tak, by odpowiadały nowemu modelowi i wyjściu MVP (webp-only), jeżeli obecnie dopuszczają np. `image/png`.

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

### Błędy

- `400 Bad Request`
    - invalid JSON
    - walidacja Zod (braki pól, złe typy, zły `output_format`, nieobsługiwane `output.*`)
    - przekroczenie limitów rozmiaru wejścia / limitów list (ochrona kosztów)
- `401 Unauthorized`
    - brak/nieprawidłowy JWT
- `403 Forbidden`
    - `app_role=user` (premium gating)
    - payload: `{ "message": "Premium feature. Upgrade required." }`
- `404 Not Found`
    - przepis `recipe.id` nie istnieje, jest soft-deleted (`deleted_at != null`) albo nie należy do użytkownika (weryfikacja przez RLS)
- `422 Unprocessable Entity`
    - niewystarczające informacje do wygenerowania sensownego zdjęcia jednego dania
    - payload: `{ "message": "...", "reasons": ["..."] }`
- `429 Too Many Requests`
    - rate limit per user
- `500 Internal Server Error`
    - błąd providera / timeout / błąd przetworzenia odpowiedzi

## 5. Przepływ danych

### Struktura funkcji (zgodna z zasadami projektu)

Aktualna struktura (już istnieje):

```
supabase/functions/ai/
    index.ts          # routing + top-level error handling
    ai.handlers.ts    # walidacja requestu + autoryzacja + format odpowiedzi
    ai.service.ts     # logika biznesowa i integracje z AI providerami
    ai.types.ts       # schematy Zod + typy DTO
```

### Happy path (krok po kroku)

1. `index.ts` przyjmuje request i deleguje do `aiRouter(req)` oraz dodaje CORS.
2. Router rozpoznaje `POST /recipes/image` i wywołuje `handlePostAiRecipesImage(req)`.
3. Handler:
    - weryfikuje JWT przez `_shared/auth.ts` (`401`),
    - wyciąga `app_role` z JWT i blokuje `user` (`403`),
    - parsuje body + limit rozmiaru (`400`/`413`),
    - waliduje body Zod (`400`),
    - weryfikuje własność i istnienie przepisu przez Supabase client z tokenem użytkownika (`select id from recipes where id = :id and deleted_at is null`) → `404` jeśli brak.
4. Handler wywołuje serwis `generateRecipeImage({ userId, recipe, language })`.
5. Serwis:
    - weryfikuje, czy dane przepisu są „wystarczające” do obrazka (w przeciwnym razie zwraca `success:false` → handler mapuje na `422`),
    - buduje prompt zgodny z kontraktem stylu,
    - wywołuje OpenAI Images API `POST /v1/images/generations` z modelem `gpt-image-1.5` i parametrami MVP:
        - `model`: `gpt-image-1.5`
        - `n`: `1`
        - `size`: `1024x1024`
        - `output_format`: `webp`
        - `background`: `auto`
        - `quality`: `auto`
        - `stream`: `false`
    - odbiera `b64_json` i zwraca `image.data_base64` + `meta.style_contract` + `warnings`.
6. Handler zwraca `200`.

## 6. Względy bezpieczeństwa

- **Uwierzytelnienie**: wymagane; używać kontekstu użytkownika (bez service role) — minimalizuje ryzyko obejścia RLS.
- **Premium gating**: `app_role` z JWT musi być `premium | admin`; `user` → `403`.
- **Ochrona kosztów i nadużyć**:
    - rate limiting per user (`429`),
    - limity: rozmiar body, liczba elementów w `ingredients/steps`, liczba tagów,
    - timeouty dla requestów do OpenAI,
    - brak logowania promptu oraz pełnych list składników/kroków (logować tylko metadane).
- **Sekrety**: `OPENAI_API_KEY` tylko z `Deno.env`, nigdy w odpowiedzi.

## 7. Obsługa błędów

### Mapowanie kodów HTTP

- `400`: walidacja requestu / invalid JSON / nieobsługiwane parametry output w MVP
- `401`: brak/invalid JWT
- `403`: brak uprawnień premium (`app_role=user`)
- `404`: recipe not found / soft-deleted / brak dostępu (RLS)
- `422`: niewystarczające dane do „jednego dania”
- `429`: rate limit
- `500`: błąd integracji OpenAI / timeout / nieoczekiwany błąd

### Rejestrowanie błędów w tabeli błędów (jeśli dotyczy)

W `docs/results/main-project-docs/008 DB Plan.md` nie ma tabeli do logów AI, więc w MVP:

- logować przez `logger` (Edge Function logs)

Opcjonalnie (poza MVP), jeśli potrzebujecie audytu kosztów i limitów:

- dodać tabelę np. `ai_image_generation_logs` (bez promptu i bez base64; tylko metadane: `user_id`, `recipe_id`, `created_at`, `status`, `duration_ms`, `provider`, `error_code`).

## 8. Wydajność

- **Stały rozmiar outputu (MVP)**: `1024x1024 webp` → stabilne koszty i przewidywalny transfer.
- **Minimalizacja promptu**: budować „skondensowany opis” (np. top N składników), zamiast wklejać pełne listy.
- **Timeouty**: sensowny timeout (np. 60s) z mapowaniem na `500` + log.
- **Rate limiting**: per user (np. X obrazów / Y minut; osobne progi dla `premium` i `admin`).

## 9. Kroki implementacji

1. **Zaktualizować integrację OpenAI w `supabase/functions/ai/ai.service.ts`**:
    - zastąpić `dall-e-3` → `gpt-image-1.5`,
    - w request body ustawić parametry MVP: `output_format: 'webp'`, `background: 'auto'`, `quality: 'auto'`, `n:1`, `size:'1024x1024'`, `stream:false`,
    - utrzymać odpowiedź jako `b64_json` i mapować na `image.data_base64`.
2. **Doprecyzować kontrakt outputu w `supabase/functions/ai/ai.types.ts`**:
    - w MVP wymusić `output.mime_type = 'image/webp'` (jeśli obecnie dopuszcza `png`, zdecydować: usunąć z `ALLOWED_IMAGE_OUTPUT_MIME_TYPES` lub jasno opisać, że `png` to tylko przyszły fallback).
3. **Upewnić się, że handler utrzymuje wymagania bezpieczeństwa** (`supabase/functions/ai/ai.handlers.ts`):
    - JWT (`401`), premium gating (`403`), limit payloadu (`400`/`413`), ownership-check + `deleted_at is null` (`404`).
4. **Obsłużyć scenariusze 422**:
    - kryteria „insufficient information” w serwisie, mapowanie do `422` z `reasons` w handlerze.
5. **Rate limiting**:
    - potwierdzić/ustawić limity (per user) oraz mapowanie do `429` (opcjonalnie z `Retry-After`).
6. **Konfiguracja środowiska**:
    - upewnić się, że `OPENAI_API_KEY` jest opisany w `ENV_SETUP.md` / dokumentacji wdrożeniowej.
7. **Testowanie lokalne**:
    - `supabase functions serve ai`
    - `POST http://localhost:54331/functions/v1/ai/recipes/image`
    - przypadki:
        - premium/admin → `200`
        - user → `403`
        - brak Authorization → `401`
        - zły `output_format` / zły `output.*` → `400`
        - recipe nie istnieje / soft-deleted / brak dostępu → `404`
        - insufficient info → `422`
        - rate limit → `429`


