# API Endpoints Implementation Plan: AI Recipe Draft (`POST /ai/recipes/draft`)

<analysis>
## 1. Podsumowanie kluczowych punktów specyfikacji API
- Endpoint `POST /ai/recipes/draft` generuje szkic przepisu z tekstu lub obrazu (OCR/LLM) i **nie zapisuje** go do bazy.
- Endpoint jest **prywatny** (wymaga JWT Supabase).
- Zmiana funkcjonalna (wg listy zmian): odpowiedź draft **może zawierać `tips_raw` (opcjonalnie)**, jeśli model potrafi je wywnioskować.
- `tips_raw` jest analogiczne do `ingredients_raw` i `steps_raw`: tekst z nowymi liniami jako elementy oraz `#` jako nagłówki sekcji.

## 2. Parametry wymagane i opcjonalne (z kontraktu)
- Nagłówki:
  - wymagane: `Authorization: Bearer <JWT>`
  - wymagane praktycznie: `Content-Type: application/json`
- Body:
  - wymagane:
    - `source`: `'text' | 'image'`
    - `output_format`: `'pycha_recipe_draft_v1'`
  - wymagane zależnie od `source`:
    - dla `source='text'`: `text` (string, min 1, max 50_000)
    - dla `source='image'`: `image.mime_type`, `image.data_base64` (base64)
  - opcjonalne:
    - `language` (default `pl`)

## 3. Niezbędne typy DTO i Command Modele
- Kontrakt współdzielony (`shared/contracts/types.ts`):
  - `AiRecipeDraftRequestDto`
  - `AiRecipeDraftDto` (**do rozszerzenia o `tips_raw?: string`**)
  - `AiRecipeDraftResponseDto`
  - `AiRecipeDraftUnprocessableEntityDto`
- Backend (Edge Function) (`supabase/functions/ai/ai.types.ts`):
  - `AiRecipeDraftRequestSchema`
  - `AiRecipeDraftOutputSchema` (**do rozszerzenia o opcjonalne `tips_raw`**)
  - `AiRecipeDraftResponseDto`

## 4. Wyodrębnienie logiki do service
- `supabase/functions/ai/index.ts`: tylko CORS, top-level error handling, delegacja do routera.
- `supabase/functions/ai/ai.handlers.ts`: parsowanie i walidacja requestu, ograniczenia rozmiarów (text/image), wywołanie serwisu, mapowanie błędów na HTTP.
- `supabase/functions/ai/ai.service.ts`: integracja z LLM, prompt, walidacja i normalizacja wyników (w tym deduplikacja tagów), zwrócenie DTO.

## 5. Walidacja danych wejściowych
- Request (już istnieje, doprecyzować w implementacji):
  - `text`: trim + limit długości (`MAX_TEXT_LENGTH`)
  - `image.data_base64`: poprawny base64 + limit rozmiaru po dekodowaniu (`MAX_IMAGE_SIZE_BYTES`)
  - `output_format`: literal `pycha_recipe_draft_v1`
  - `language`: default `pl`
- Walidacja wyniku LLM:
  - `name`, `ingredients_raw`, `steps_raw`: wymagane, niepuste po trim
  - `tips_raw`: **opcjonalne**, może być pominięte lub puste (po normalizacji → `null`/brak pola, wg przyjętej konwencji)
  - `tags`: deduplikacja + limit (`MAX_TAGS_COUNT`)

## 6. Rejestrowanie błędów w tabeli błędów
- Brak dedykowanej tabeli błędów w DB w MVP. Rejestrować zdarzenia przez logger Edge Function:
  - `info`: rozpoczęcie/zakończenie, `source`, rozmiary payloadu, `confidence`
  - `warn`: walidacja requestu, 422 (nie jest pojedynczym przepisem), 429 (rate limit)
  - `error`: błędy integracji z OpenAI, timeouts, błędy parsowania odpowiedzi

## 7. Potencjalne zagrożenia bezpieczeństwa
- **Abuse/cost explosion**: długie teksty/obrazy → limity długości/rozmiaru + (opcjonalnie) rate limiting per user.
- **Prompt injection**: model może próbować „wyjść” z formatu → twarda walidacja JSON + schema (Zod) i odrzucanie niepoprawnych odpowiedzi.
- **Dane wrażliwe**: logowanie treści wejściowej jest ryzykowne → logować tylko metryki (długość, typ źródła), nie pełny tekst ani base64.
- **Cache**: odpowiedzi są per-user i mogą zawierać prywatne dane → `Cache-Control: no-store` (zależnie od wspólnej polityki w projekcie).

## 8. Scenariusze błędów i kody statusu
- `200 OK`: poprawna odpowiedź z draftem (z `tips_raw` lub bez).
- `400 Bad Request`: niepoprawny JSON, walidacja requestu (np. brak pól wymaganych dla source).
- `401 Unauthorized`: brak/niepoprawny JWT.
- `413 Payload Too Large`: obraz zbyt duży / payload przekracza limity (zgodnie z API plan).
- `422 Unprocessable Entity`: wejście nie opisuje pojedynczego przepisu (z listą powodów).
- `429 Too Many Requests`: przekroczony limit żądań (jeśli włączone rate limiting).
- `500 Internal Server Error`: błąd infrastruktury / OpenAI / nieoczekiwany runtime error.
</analysis>

## 1. Przegląd punktu końcowego

Endpoint `POST /ai/recipes/draft` służy do wygenerowania szkicu przepisu na podstawie wklejonego tekstu lub obrazu. Szkic jest zwracany do klienta i używany do wstępnego wypełnienia formularza dodawania przepisu; **nie jest zapisywany** w bazie danych.

Zmiana w ramach tej iteracji: odpowiedź `draft` **może opcjonalnie zawierać** `tips_raw` (wskazówki), jeśli model potrafi je wywnioskować.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/ai/recipes/draft` (w Supabase: `/functions/v1/ai/recipes/draft`)
- **Nagłówki**:
  - **Wymagane**: `Authorization: Bearer <JWT>`
  - **Zalecane**: `Content-Type: application/json`
- **Parametry**:
  - **Wymagane**: brak (wszystko w body)
  - **Opcjonalne**: brak
- **Request Body**: `AiRecipeDraftRequestDto` (kontrakt)

### Body – wariant tekstowy (`source='text'`)

- **Wymagane**:
  - `source: "text"`
  - `text: string` (min 1, max 50_000 znaków)
  - `output_format: "pycha_recipe_draft_v1"`
- **Opcjonalne**:
  - `language: string` (default `pl`)

### Body – wariant obrazowy (`source='image'`)

- **Wymagane**:
  - `source: "image"`
  - `image.mime_type: "image/png" | "image/jpeg" | "image/webp"`
  - `image.data_base64: string` (base64)
  - `output_format: "pycha_recipe_draft_v1"`
- **Opcjonalne**:
  - `language: string` (default `pl`)

## 3. Wykorzystywane typy

### Kontrakt współdzielony – `shared/contracts/types.ts`

- `AiRecipeDraftRequestDto`
- `AiRecipeDraftDto` (**rozszerzyć o `tips_raw?: string`**)
- `AiRecipeDraftResponseDto`
- `AiRecipeDraftUnprocessableEntityDto`

### Backend (Edge Function) – `supabase/functions/ai/*`

- `AiRecipeDraftRequestSchema`
- `AiRecipeDraftOutputSchema` (**rozszerzyć o `tips_raw?: string`**)
- `AiRecipeDraftLlmResponseSchema`
- `GenerateRecipeDraftParams`, `LlmGenerationResult`

## 4. Szczegóły odpowiedzi

### Sukces

- **Kod**: `200 OK`
- **Payload**: `AiRecipeDraftResponseDto`

W szczególności:
- `draft.tips_raw`:
  - **może być obecne** jako string, jeśli model je wywnioskował
  - **może być pominięte** jeśli model nie jest w stanie podać wskazówek

### Błędy

- `400 Bad Request`: niepoprawny JSON / walidacja Zod requestu
- `401 Unauthorized`: brak/niepoprawny JWT
- `413 Payload Too Large`: obraz zbyt duży
- `422 Unprocessable Entity`: treść nie opisuje pojedynczego przepisu (z `reasons`)
- `429 Too Many Requests`: rate limiting (jeśli włączone)
- `500 Internal Server Error`: błędy OpenAI / timeouts / runtime

## 5. Przepływ danych

1. Klient wysyła `POST /ai/recipes/draft` z JWT i body (`text` lub `image`).
2. `supabase/functions/ai/index.ts`:
   - obsługa CORS (OPTIONS),
   - delegacja do `aiRouter`,
   - top-level error handling.
3. `supabase/functions/ai/ai.handlers.ts`:
   - `getAuthenticatedContext(req)` (JWT wymagane),
   - parsowanie JSON i walidacja `AiRecipeDraftRequestSchema`,
   - dla obrazu: dekodowanie base64 i kontrola limitu rozmiaru,
   - wywołanie `generateRecipeDraft(...)`.
4. `supabase/functions/ai/ai.service.ts`:
   - budowa promptu systemowego i użytkownika,
   - wywołanie OpenAI (chat completions) z `response_format: json_object`,
   - rozróżnienie odpowiedzi:
     - `is_valid_recipe=false` → `422` z powodami,
     - `is_valid_recipe=true` → walidacja i normalizacja draftu,
   - zwrócenie `AiRecipeDraftResponseDto`, z opcjonalnym `tips_raw` jeśli dostępne.

## 6. Względy bezpieczeństwa

- **Uwierzytelnianie**: wymagany JWT (Supabase Auth). Brak tokenu → `401`.
- **Ograniczenia kosztów**:
  - utrzymać limity `MAX_TEXT_LENGTH`, `MAX_IMAGE_SIZE_BYTES`,
  - (rekomendowane) rate limiting per user (w `ai.handlers.ts` / współdzielonym utilu), mapowane na `429`.
- **Logowanie**: nie logować pełnej treści `text` ani `image.data_base64`; tylko metryki.
- **Cache**: odpowiedzi per-user → preferować `Cache-Control: no-store` + `Vary: Authorization` (jeśli projekt utrzymuje spójny standard dla endpointów prywatnych).

## 7. Obsługa błędów

- Walidacja requestu (Zod) → `400` z listą pól i komunikatów.
- Błędy autoryzacji (JWT) → `401`.
- Błędy rozmiaru payloadu → `413`.
- Błąd domenowy „nie jest pojedynczym przepisem” → `422` (`AiRecipeDraftUnprocessableEntityDto`).
- Rate limit → `429` z opcjonalnym `Retry-After`.
- Nieoczekiwane błędy / błędy OpenAI → `500` (przez `handleError` + log `error`).

## 8. Wydajność

- Największy koszt to wywołanie OpenAI:
  - kontrolować rozmiary inputów,
  - ograniczyć `max_tokens`,
  - preferować krótkie, deterministyczne prompty i niską temperaturę.
- Unikać dodatkowych round-tripów do DB (draft nie wymaga DB).

## 9. Kroki implementacji

### A) Kontrakt współdzielony
1. W `shared/contracts/types.ts` rozszerzyć `AiRecipeDraftDto` o:
   - `tips_raw?: string;`
2. Upewnić się, że frontend traktuje `tips_raw` jako **opcjonalne** (brak pola = brak wskazówek).

### B) Edge Function `ai` – walidacja i typy
3. W `supabase/functions/ai/ai.types.ts`:
   - dodać do `AiRecipeDraftOutputSchema` pole `tips_raw` jako `z.string().optional()` (z trim/normalizacją),
   - zaktualizować `AiRecipeDraftDto` i `AiRecipeDraftResponseDto` wynikające ze schematów.
4. W `supabase/functions/ai/ai.service.ts`:
   - w promptach dodać instrukcję ekstrakcji wskazówek do `tips_raw` jako sekcji opcjonalnej (analogicznej do składników/kroków),
   - w `normalizeDraft(...)` dodać normalizację `tips_raw`:
     - `undefined`/puste po trim → brak pola (lub `null`, jeśli projekt preferuje jawne `null` – trzymać spójnie z kontraktem),
     - niepuste → `tips_raw.trim()`.
   - **nie** dodawać `tips_raw` do `validateDraftContent` jako wymagane.
5. W `supabase/functions/ai/ai.handlers.ts`:
   - upewnić się, że typ `AiRecipeDraftResponseDto` (odpowiedź handlera) obejmuje nowy, opcjonalny atrybut.

### C) Test plan (manualny)
6. Lokalnie:
   - `supabase functions serve ai`
   - przypadki:
     - tekst bez wskazówek → `200`, odpowiedź bez `tips_raw` (lub `tips_raw: ""` jeśli tak zwraca model; backend normalizuje zgodnie z planem),
     - tekst z naturalnymi wskazówkami → `200` i `draft.tips_raw` obecne,
     - niepoprawny JSON → `400`,
     - brak JWT → `401`,
     - zbyt duży obraz → `413`,
     - treść nie jest pojedynczym przepisem → `422` z `reasons`,
     - rate limit (jeśli włączony) → `429`.

