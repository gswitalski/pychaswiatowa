# API Endpoints Implementation Plan: Recipe AI Image on Create (`POST /ai/recipes/image`)

## 1. Przegląd punktu końcowego

Celem zmian jest umożliwienie generowania **podglądu** zdjęcia AI w trakcie tworzenia przepisu (`/recipes/new`) **bez wcześniejszego zapisu przepisu**. Backend musi:

- przyjąć payload z aktualnego stanu formularza (również niezapisane zmiany),
- opcjonalnie użyć zdjęcia referencyjnego przekazanego jako base64,
- egzekwować **premium gating** (rola `premium` lub `admin`) po stronie serwera,
- ograniczać koszty przez **rate limit per użytkownik**,
- zwrócić podgląd jako base64 (WebP 1024×1024),
- zachować kompatybilność z istniejącym scenariuszem edycji (`/recipes/:id/edit`), gdzie `recipe.id` jest znane.

W ramach tego ficzera **nie dodajemy nowych endpointów**. Wykorzystujemy istniejącą sekwencję:

1. `POST /ai/recipes/image` → podgląd base64
2. `POST /recipes` → utworzenie przepisu (201, zwraca `id`)
3. `POST /recipes/{id}/image` → upload zaakceptowanego obrazu (multipart)

## 2. Szczegóły żądania

- Metoda HTTP: `POST`
- Struktura URL:
  - Edge Function: `/functions/v1/ai/recipes/image`
  - (router wewnątrz `supabase/functions/ai`)
- Auth: wymagany JWT w `Authorization: Bearer <token>`

### Parametry

- Wymagane: brak (wszystko w body)
- Opcjonalne: brak (wszystko w body)

### Request Body (kontrakt)

**Kluczowa zmiana dla `/recipes/new`:** `recipe.id` musi być **opcjonalne** (można je pominąć lub przekazać jako `null`). Dla edycji nadal wysyłamy `recipe.id` (liczba dodatnia).

Proponowany (docelowy) payload:

```json
{
  "recipe": {
    "id": null,
    "name": "Sernik klasyczny",
    "description": "Kremowy sernik na spodzie z herbatników.",
    "servings": 8,
    "prep_time_minutes": 20,
    "total_time_minutes": 90,
    "is_termorobot": false,
    "is_grill": false,
    "diet_type": "VEGETARIAN",
    "cuisine": "POLISH",
    "difficulty": "EASY",
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
  "prompt_hint": "Ujęcie z góry, naturalne światło, bez tekstu na zdjęciu.",
  "mode": "auto",
  "reference_image": {
    "source": "base64",
    "mime_type": "image/jpeg",
    "data_base64": "/9j/4AAQSkZJRgABAQAAAQ..."
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

#### Zasady walidacji requestu (backend)

- **Auth/JWT**: wymagany i poprawny (weryfikacja przez `getAuthenticatedContext(req)`).
- **Premium gating**: `app_role in ('premium','admin')`, w przeciwnym razie `403`.
- **Payload size**:
  - limit znaków dla całego body (obecnie `MAX_IMAGE_REQUEST_PAYLOAD_SIZE` w `ai.types.ts`) – utrzymać,
  - limit rozmiaru referencji po dekodowaniu base64 (obecnie `MAX_REFERENCE_IMAGE_SIZE_BYTES` = 2 MB) – utrzymać.
- **`output_format`**: wymagane `pycha_recipe_image_v1`.
- **`output`**: tylko `image/webp`, `width=1024`, `height=1024` (MVP).
- **`prompt_hint`**:
  - opcjonalne,
  - `trim`,
  - limit długości (rekomendacja: 400 znaków),
  - puste po trim → traktować jak `undefined`.
- **`recipe`**:
  - `id`: `number` dodatni **lub** `null`/brak,
  - `name`: 1–150, min sensowności dla generowania: >= 3 znaki,
  - `ingredients`, `steps`: min 1 element, limit max (`MAX_RECIPE_CONTENT_ITEMS`),
  - rekomendacja: ignorować `type=header` w walidacji „czy da się wygenerować”, ale nie usuwać ich z payloadu.
- **`mode`**: `auto | recipe_only | with_reference`:
  - jeśli `with_reference` → `reference_image` wymagane,
  - jeśli `auto` → backend rozwiązuje do:
    - `with_reference` gdy `reference_image` istnieje,
    - `recipe_only` w przeciwnym razie.
- **`reference_image`**:
  - `source=base64` dozwolone zawsze,
  - `source=storage_path` dozwolone **tylko gdy** `recipe.id` jest podane (edycja) i obraz jest dostępny (RLS),
  - dla `/recipes/new` (brak `recipe.id`) `storage_path` musi dać `400` (lub być niedozwolone przez Zod).

## 3. Wykorzystywane typy

### Kontrakty współdzielone (frontend ↔ backend)

Aktualne typy są w `shared/contracts/types.ts`. Aby wspierać tworzenie przepisu bez ID i pole `prompt_hint`, należy zaktualizować:

- `AiRecipeImageRecipeDto`:
  - zmienić `id: number` → `id?: number | null`
  - dodać opcjonalnie pola klasyfikacji (jeśli UI ma je przekazywać): `diet_type?`, `cuisine?`, `difficulty?`
- `AiRecipeImageRequestDto`:
  - dodać `prompt_hint?: string`

### Typy backendowe (Edge Function)

W `supabase/functions/ai/ai.types.ts`:

- `AiRecipeImageRecipeSchema`:
  - zmienić `id` na opcjonalne/nullable:
    - `id: z.number().int().positive().optional()` lub `z.number().int().positive().nullable().optional()`
- `AiRecipeImageRequestSchema`:
  - dodać `prompt_hint?: string` (z trim + max length),
  - rozszerzyć `superRefine` o:
    - `mode='with_reference'` wymaga `reference_image` (już jest),
    - `recipe.id` brak + `reference_image.source='storage_path'` → błąd walidacji,
    - (opcjonalnie) `mode='with_reference'` i `reference_image` brak → już jest.

W `supabase/functions/ai/ai.service.ts` (logika):

- `GenerateRecipeImageParams['recipe']` nadal może zawierać `id?: number | null` (nie może być wymagana do promptu).

## 3. Szczegóły odpowiedzi

### Sukces

- Kod: `200 OK`
- Payload (`AiRecipeImageResponseDto`):

```json
{
  "image": {
    "mime_type": "image/webp",
    "data_base64": "UklGRiQAAABXRUJQVlA4..."
  },
  "meta": {
    "mode": "with_reference",
    "style_contract": {
      "photorealistic": true,
      "rustic_table": false,
      "natural_light": true,
      "no_people": true,
      "no_text": true,
      "no_watermark": true
    },
    "warnings": []
  }
}
```

### Kody statusu (w tym scenariusze błędów)

- `200 OK`: podgląd wygenerowany.
- `400 Bad Request`: nieprawidłowy payload (Zod), niedozwolone kombinacje pól (np. `storage_path` bez `recipe.id`), błędy dekodowania base64.
- `401 Unauthorized`: brak/niepoprawny JWT.
- `403 Forbidden`: użytkownik bez `premium/admin` (premium gating).
- `404 Not Found`: tylko scenariusz edycji – `recipe.id` podane, ale przepis nie istnieje / brak dostępu (RLS) lub nie można pobrać referencji ze storage.
- `413 Payload Too Large`: referencja base64 za duża lub payload przekracza limity.
- `422 Unprocessable Entity`: za mało informacji, by wygenerować sensowny obraz jednej potrawy.
- `429 Too Many Requests`: rate limit (koszty).
- `500 Internal Server Error`: nieobsłużony błąd po stronie serwera / błąd usług AI.

## 4. Przepływ danych

### Scenariusz A: `/recipes/new` (bez zapisanego przepisu)

1. Frontend buduje request do `POST /ai/recipes/image`:
   - `recipe.id = null` albo pomija `id`,
   - `mode = auto`,
   - `reference_image.source = base64` jeśli użytkownik wkleił/dodał zdjęcie,
   - `prompt_hint` opcjonalnie z dialogu.
2. Backend:
   - weryfikuje JWT + `app_role`,
   - waliduje payload (Zod),
   - wykonuje rate limit per user,
   - rozwiązuje `mode` z `auto`,
   - generuje obraz (OpenAI lub Gemini zależnie od resolvedMode),
   - zwraca base64 webp.
3. Frontend pokazuje preview + decyzję użytkownika.
4. Po kliknięciu „Zapisz”:
   - `POST /recipes` → `201 Created` z `id`,
   - jeśli użytkownik zaakceptował podgląd → `POST /recipes/{id}/image` (multipart) z plikiem zdekodowanym z base64.
   - błąd uploadu **nie blokuje** utworzenia przepisu; UI informuje i pozwala ponowić w edycji.

### Scenariusz B: `/recipes/:id/edit` (istniejący przepis)

1. Frontend wysyła `recipe.id` (liczba dodatnia).
2. Backend dodatkowo:
   - wykonuje check „czy przepis istnieje i jest dostępny” (RLS) tylko wtedy, gdy `recipe.id` jest podane,
   - pozwala na `reference_image.source=storage_path` (ściąga obraz z bucketu) lub base64.

## 5. Względy bezpieczeństwa

- **Premium gating (twarde)**:
  - pozostaje w `ai.handlers.ts` (obecnie: `extractAndValidateAppRole(token)` + `403` dla `user`).
  - nie polegać na UI.
- **RLS / własność danych**:
  - dla edycji (gdy `recipe.id` istnieje) utrzymać check dostępu przez select po `id` z `deleted_at is null`,
  - dla tworzenia (brak `recipe.id`) **nie wykonywać** checku w DB.
- **Ochrona przed wyciekiem danych i logowaniem base64** (krytyczne):
  - nie logować pełnych payloadów z obrazami (`reference_image.data_base64`) ani całych struktur typu `geminiPayload`.
  - w `ai.service.ts` usunąć / zastąpić log `logger.info("Gemini API payload", { geminiPayload })` bezpiecznym skrótem (np. długości, mime type, tryb).
- **Ochrona przed nadużyciami kosztowymi**:
  - dodać serwerowy rate limit per user (nie tylko reakcja na 429 z OpenAI/Gemini),
  - utrzymać limity: liczba elementów ingredients/steps, max payload, max rozmiaru referencji.
- **Ochrona przed DoS**:
  - utrzymać `MAX_IMAGE_REQUEST_PAYLOAD_SIZE` (sprawdzenie na `req.text()`),
  - utrzymać `MAX_REFERENCE_IMAGE_SIZE_BYTES` po dekodowaniu base64.
- **Bezpieczeństwo treści**:
  - obsłużyć przypadek `400` z providerów jako `400`/`422` (obecnie mapowane do `VALIDATION_ERROR` z treścią o policy), bez zwracania surowych errorów dostawcy.

## 6. Obsługa błędów

### Walidacja (400)

- błędy Zod mapowane do ustrukturyzowanej odpowiedzi (obecnie `createValidationErrorResponse`).
- dodać walidację krzyżową:
  - `storage_path` bez `recipe.id` → `400`,
  - `prompt_hint` za długi → `400`.

### Brak zasobu (404)

- tylko gdy `recipe.id` jest podane:
  - przepis nie istnieje / soft-deleted / brak dostępu (RLS),
  - `reference_image.source=storage_path` i download nieudany (dla `mode != auto` → `404`; dla `auto` → fallback do `recipe_only` + warning).

### Rate limit (429)

Backend powinien zwracać `429` z opcjonalnym `Retry-After` (sekundy) oraz kodem `TOO_MANY_REQUESTS`.

Rekomendacja limitów (MVP, do konfiguracji env):

- limit krótkoterminowy: 1 request / 25–30 sekund na user,
- limit dzienny: np. 30–50 requestów / dzień na user.

### Błędy serwera (500)

- wszystkie nieoczekiwane wyjątki przechodzą przez `handleError`.
- logowanie:
  - `error` level z minimalnym kontekstem (userId, resolvedMode, recipeId jeśli jest),
  - bez logowania danych obrazów i długich promptów.

## 7. Wydajność

- unikać zbędnych odwołań do DB:
  - check istnienia przepisu wykonywać tylko gdy `recipe.id` jest podane.
- payload:
  - dalej używać `req.text()` aby sprawdzić rozmiar zanim wykonamy `JSON.parse`.
- referencja:
  - dla `storage_path` pobieranie z Supabase Storage jest I/O – przy `auto` dopuszczalny fallback do `recipe_only`.
- timeouts:
  - zachować timeouty providerów (OpenAI Images ~60s, Gemini ~90s) oraz frontendowy timeout 60s.

## 8. Kroki implementacji

1. **Zaktualizować kontrakty DTO w `shared/contracts/types.ts`**:
   - `AiRecipeImageRecipeDto.id` → opcjonalne/nullable,
   - dodać `prompt_hint?: string`,
   - (opcjonalnie) dodać `diet_type?`, `cuisine?`, `difficulty?` do `AiRecipeImageRecipeDto`.
2. **Zaktualizować walidację Zod w `supabase/functions/ai/ai.types.ts`**:
   - `recipe.id` jako optional/nullable,
   - dodać `prompt_hint` (trim + max),
   - dodać walidacje krzyżowe: `storage_path` wymaga `recipe.id`.
3. **Zmienić handler `handlePostAiRecipesImage` w `supabase/functions/ai/ai.handlers.ts`**:
   - warunkowo wykonywać krok „ownership check” tylko gdy `recipe.id` jest podane,
   - dostosować logi i komunikaty (`recipeId` może być `null`).
4. **Rozszerzyć logikę promptu w `supabase/functions/ai/ai.service.ts`**:
   - w `buildRecipeContext` uwzględnić opcjonalne pola klasyfikacji (jeśli dodane do DTO),
   - wbudować `prompt_hint` jako „style hint” (nie pełny prompt), np. osobna sekcja „User hint”.
5. **Dodać serwerowy rate limit per user dla `POST /ai/recipes/image`**:
   - dodać współdzielony helper w `supabase/functions/_shared/` (np. `rate-limit.ts`),
   - zastosować w handlerze przed wywołaniem providerów,
   - implementacja rekomendowana:
     - tabela `ai_rate_limits` (user_id, key, window_start, count) + unikalność,
     - RPC `ai_rate_limit_hit(...)` zwracające `allowed` + `retry_after_seconds`,
     - RLS: użytkownik może modyfikować tylko własne wiersze (lub użyć service role, jeśli preferowane).
6. **Naprawić potencjalny wyciek w logach (krytyczne)**:
   - usunąć logowanie całego `geminiPayload` w `ai.service.ts`,
   - logować tylko metadane (rozmiar referencji, mime type, długość promptu).
7. **Utrzymać kompatybilność z edycją**:
   - gdy `recipe.id` jest podane – zachować dotychczasową semantykę (404 gdy brak dostępu).
8. **Test plan (minimum)**:
   - testy jednostkowe schematów Zod:
     - payload bez `recipe.id` przechodzi,
     - `storage_path` bez `recipe.id` → 400,
     - `with_reference` bez `reference_image` → 400,
     - `prompt_hint` > limit → 400.
   - testy integracyjne handlera:
     - `user` → 403,
     - `premium/admin` bez `recipe.id` → 200 (mock AI call),
     - `premium/admin` z `recipe.id` nieistniejącym → 404.

