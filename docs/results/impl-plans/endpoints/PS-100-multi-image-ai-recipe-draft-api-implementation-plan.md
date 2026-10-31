# API Endpoints Implementation Plan: PS-100 — Analiza przepisu AI z wielu zdjęć (`POST /ai/recipes/draft`)

## 1. Przegląd punktu końcowego

Modyfikacja istniejącego endpointu `POST /ai/recipes/draft` (Edge Function `ai`). Wariant `source: "image"` przyjmuje nowe pole `images` (tablica 1–5 obrazów, kolejność = kolejność stron przepisu) obok dotychczasowego, od teraz **deprecated** pola `image`. Wszystkie obrazy trafiają do **jednego** wywołania modelu, który zwraca **jeden** wspólny draft (z metadanymi PS-91). Nieczytelne zdjęcia nie powodują błędu — są raportowane w `meta.warnings` oraz w nowym, opcjonalnym `meta.image_warnings`.

Zmiana jest addytywna i bez migracji bazy danych: `output_format` pozostaje `pycha_recipe_draft_v1`, obrazy żyją wyłącznie w pamięci funkcji na czas jednego wywołania (brak Storage), a kredyty AI (PS-64) działają bez zmian — **1 kredyt `draft` na wywołanie**, niezależnie od liczby zdjęć.

Źródła wymagań: user story PS-100, plan API PS-100 (kontrakt i decyzje projektowe), stan kodu w `supabase/functions/ai/`. Plan wdrożenia produkcyjnego (limit body Edge Function, monitoring tokenów) jest w osobnym dokumencie `PS-100-multi-image-ai-recipe-draft-deployment-plan.md`.

### Zakres zmian w plikach

| Plik | Zmiana |
|---|---|
| `supabase/functions/ai/ai-draft-images.ts` | **Nowy.** Stałe limitów, `resolveDraftImages`, `decodeDraftImages` (dekodowanie + walidacja rozmiarów), `getDraftApiTimeoutMs`, teksty promptu wielu zdjęć, `normalizeUnreadableImages` |
| `supabase/functions/ai/ai.types.ts` | Schemat `images` + reguła „dokładnie jedno z `image` / `images`”, `images: undefined` w wariantach `text`/`url`, `unreadable_images` w schemacie odpowiedzi LLM, typy `image_warnings`, nowe `GenerateRecipeDraftParams`, re-eksport `MAX_IMAGE_SIZE_BYTES` |
| `supabase/functions/ai/ai.handlers.ts` | Dekodowanie listy obrazów, walidacja per plik i łączna (`400`/`413`) **przed** `checkAndDeductCredits`, rozszerzony `413` o `details`, nowe pola logów |
| `supabase/functions/ai/ai.service.ts` | Wiele części `image_url` w kolejności, `detail: "high"`, wydajne kodowanie base64, `timeoutMs` w `callOpenAI`, obsługa `unreadable_images`, `meta.image_warnings`, pole `unreadable_images` w `getSystemPrompt` |
| `shared/contracts/types.ts` | Typy żądania (`images`), `AiRecipeDraftImageWarningDto`, `AiRecipeDraftPayloadTooLargeDto`, `meta.image_warnings` |
| `supabase/functions/ai/ai-draft-images.test.ts` | **Nowy.** Testy modułu obrazów |
| `supabase/functions/ai/ai.types.test.ts`, `ai.service.test.ts` | Rozszerzenie testów |
| Dokumentacja | `009 API plan.md`, `test-requests.http`, `TESTING_TIPS.md`, `project-summary.md` (sekcja 9 planu) |

**Bez zmian:** pozostałe endpointy modułu `ai`, logika kredytów (`checkAndDeductCredits`, `refundCreditAfterFailure`, `deductCreditAfterSuccess`), role (`user`/`premium`/`admin`), rate limiting, warianty `text` i `url` (PS-97), `response_format: json_object`, `MAX_TOKENS`, struktura `draft`.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/ai/recipes/draft`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), role `user`/`premium`/`admin` (bez zmian)
- **Parametry:**
    - Wymagane: `source: "image"`, `output_format: "pycha_recipe_draft_v1"` oraz **dokładnie jedno** z: `images` (nowe) / `image` (deprecated)
    - Opcjonalne: `language` (domyślnie `pl`)
- **Request Body (nowy kontrakt):**

```json
{
    "source": "image",
    "images": [
        { "mime_type": "image/jpeg", "data_base64": "/9j/4AAQ..." },
        { "mime_type": "image/jpeg", "data_base64": "/9j/4BBQ..." },
        { "mime_type": "image/webp", "data_base64": "UklGRh..." }
    ],
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

- **Request Body (stary kontrakt, bez zmian zachowania):** `{ "source": "image", "image": { "mime_type": "image/png", "data_base64": "iVBORw0..." }, "output_format": "pycha_recipe_draft_v1" }`

### Reguły walidacji (`source: "image"`)

| Pole | Reguła | Warstwa | Błąd |
|---|---|---|---|
| `images` | tablica 1–5 elementów | Zod | `400`, `field: images` |
| `images[k].mime_type` | `image/png` \| `image/jpeg` \| `image/webp` | Zod | `400`, `field: images.{k}.mime_type` |
| `images[k].data_base64` | niepusty string | Zod | `400`, `field: images.{k}.data_base64` |
| `image` + `images` jednocześnie | niedozwolone | Zod `superRefine` | `400`, `field: image` |
| brak `image` i `images` | niedozwolone | Zod `superRefine` | `400`, `field: images` |
| `images` w `source: "text"` / `"url"` | niedozwolone (`z.undefined().optional()`) | Zod | `400` |
| poprawność base64 | dekodowanie się udaje | handler | `400`, `field: images.{k}.data_base64` (dla `image`: `image.data_base64`) |
| rozmiar pojedynczego obrazu | ≤ 10 MB po dekodowaniu | handler | `413`, `details.limit: per_file` |
| suma rozmiarów | ≤ 15 MB po dekodowaniu | handler | `413`, `details.limit: total` |

Kolejność ma znaczenie: **wszystkie walidacje obrazów muszą zakończyć się przed `checkAndDeductCredits`**, aby `400`/`413` nigdy nie pobierały kredytu.

### Stałe i limity (jedno miejsce — `ai-draft-images.ts`)

| Stała | Wartość | Uwagi |
|---|---|---|
| `MAX_DRAFT_IMAGES` | `5` | limit zdjęć na analizę |
| `MAX_IMAGE_SIZE_BYTES` | `10 * 1024 * 1024` | **przenieść** z `ai.types.ts` do nowego modułu i re-eksportować z `ai.types.ts` (`export { MAX_IMAGE_SIZE_BYTES } from './ai-draft-images.ts'`) — unika importu cyklicznego, zachowuje dotychczasowe importy w handlerze |
| `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` | `15 * 1024 * 1024` | suma po dekodowaniu |
| `MAX_DRAFT_REQUEST_BODY_BYTES` | `22 * 1024 * 1024` | utwardzenie: wczesne odrzucenie po nagłówku `Content-Length` (patrz pkt 6) |
| `DRAFT_IMAGE_DETAIL` | `'high'` | wartość `image_url.detail` dla żądań z `images` |
| `DRAFT_API_TIMEOUT_PER_EXTRA_IMAGE_MS` | `10_000` | dodatek za każde zdjęcie ponad pierwsze |
| `DRAFT_API_TIMEOUT_MAX_MS` | `140_000` | pod limitem 150 s Edge Function |

Timeout modelu: `min(API_TIMEOUT_MS + 10_000 × (N − 1), 140_000)`; `API_TIMEOUT_MS = 100_000` zostaje w `ai.service.ts` (1 zdjęcie → 100 s, 3 → 120 s, 5 → 140 s).

---

## 3. Wykorzystywane typy

### 3.1. Backend — `ai-draft-images.ts` (nowy)

Moduł **nie importuje wartości z `ai.types.ts`** (to `ai.types.ts` importuje z niego — wzorzec jak przy `ai-draft-metadata.ts`). Używa typów strukturalnych zamiast `AiImageSourceRequest`.

```typescript
export interface DraftImageInput {
    mime_type: string;
    data_base64: string;
}

export interface DecodedDraftImage {
    bytes: Uint8Array;
    mimeType: string;
}

export type ResolvedDraftImages = {
    images: DraftImageInput[];
    usedLegacyImageField: boolean;
};

export type DecodeDraftImagesResult =
    | { ok: true; images: DecodedDraftImage[]; totalBytes: number }
    | { ok: false; reason: 'INVALID_BASE64'; index: number }
    | { ok: false; reason: 'PAYLOAD_TOO_LARGE'; limit: 'per_file' | 'total'; index?: number };

export function resolveDraftImages(request: { image?: DraftImageInput; images?: DraftImageInput[] }): ResolvedDraftImages;
export function tryDecodeBase64(value: string): Uint8Array | null;
export function validateDraftImageSizes(sizes: number[]): { ok: true } | { ok: false; limit: 'per_file' | 'total'; index?: number };
export function decodeDraftImages(images: DraftImageInput[]): DecodeDraftImagesResult;
export function getDraftApiTimeoutMs(imageCount: number, baseTimeoutMs?: number): number;
export function getMultiImageUserPromptParts(count: number): { intro: string; outro: string };
export function normalizeUnreadableImages(raw: unknown, imageCount: number): { indices: number[]; warnings: string[] };
```

Zasady:

- `resolveDraftImages` — `images ?? [image]`; `usedLegacyImageField = images === undefined`. Zakłada, że schemat Zod już zagwarantował „dokładnie jedno”; przy naruszeniu rzuca `ApplicationError('INTERNAL_ERROR', …)` (guard clause).
- `tryDecodeBase64` — logika dzisiejszego `decodeBase64` z handlera (normalizacja base64url, `atob`), ale zwraca `null` zamiast rzucać. Handler zachowuje swoją funkcję `decodeBase64` jako cienką nakładkę rzucającą `ApplicationError('VALIDATION_ERROR', …)` — używa jej dalej ścieżka `reference_image` (`/ai/recipes/image`), której nie ruszamy.
- `validateDraftImageSizes` — funkcja czysta: najpierw sprawdza każdy plik (`> MAX_IMAGE_SIZE_BYTES` → `per_file` z `index` pierwszego naruszającego), potem sumę (`> MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` → `total`). Granica 15 MB (suma równa limitowi) jest dozwolona.
- `decodeDraftImages` — iteruje po obrazach w kolejności; pierwszy niepoprawny base64 → `INVALID_BASE64` z indeksem; po dekodowaniu wszystkich wywołuje `validateDraftImageSizes`. Dzięki temu cała walidacja „przed kredytem” jest testowalna bez handlera.
- `normalizeUnreadableImages(raw, imageCount)` — nigdy nie rzuca:

| Wejście | Wynik |
|---|---|
| brak pola / nie-tablica | `indices: []` |
| `imageCount <= 1` | zawsze `[]` (przy jednym nieczytelnym zdjęciu model ma zwrócić `is_valid_recipe: false`) |
| liczby całkowite z zakresu 1–N | zachowane, posortowane rosnąco, bez duplikatów |
| elementy spoza zakresu, nie-liczby, ułamki | pomijane (log `warn` bez treści, bez ostrzeżenia dla użytkownika) |
| każdy poprawny indeks `k` | ostrzeżenie `Zdjęcie {k} było nieczytelne i zostało pominięte.` |

### 3.2. Backend — `ai.types.ts`

```typescript
// Wariant image — pozostaje obiektem Zod (wymóg discriminatedUnion)
const ImageSourceSchema = BaseRequestSchema.extend({
    source: z.literal('image'),
    /** @deprecated Użyj `images`. Pole zachowane dla zgodności wstecznej. */
    image: AiRecipeDraftImageSchema.optional(),
    images: z.array(AiRecipeDraftImageSchema)
        .min(1, `images must contain between 1 and ${MAX_DRAFT_IMAGES} items`)
        .max(MAX_DRAFT_IMAGES, `images must contain between 1 and ${MAX_DRAFT_IMAGES} items`)
        .optional(),
    text: z.undefined().optional(),
});

export const AiRecipeDraftRequestSchema = z.discriminatedUnion('source', [
    TextSourceSchema,
    ImageSourceSchema,
    UrlSourceSchema,
]).superRefine((data, ctx) => {
    if (data.source !== 'image') return;
    if (data.image !== undefined && data.images !== undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Provide either image or images, not both',
            path: ['image'],
        });
        return;
    }
    if (data.image === undefined && data.images === undefined) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'images is required for source "image"',
            path: ['images'],
        });
    }
});
```

Pozostałe zmiany w pliku:

- `TextSourceSchema` i `UrlSourceSchema`: dodać `images: z.undefined().optional()`.
- `AiRecipeDraftLlmResponseSchema`: dodać `unreadable_images: z.unknown().optional()`. **Uwaga:** `z.object` domyślnie usuwa nieznane klucze, więc bez tego pole zostałoby wycięte z `successParseResult.data`. Wartość pozostaje „nieufna” i jest normalizowana wyłącznie przez `normalizeUnreadableImages`.
- `AiRecipeDraftMetaSchema` (schemat LLM) **bez** `image_warnings` — pole buduje wyłącznie backend; Zod odetnie ewentualną próbę podstawienia go przez model.
- Nowe typy: `AiRecipeDraftImageWarning { code: 'IMAGE_UNREADABLE'; image_index: number }`; `AiRecipeDraftResponseDto.meta` = `AiRecipeDraftMeta & { image_warnings?: AiRecipeDraftImageWarning[] }`.
- `GenerateRecipeDraftParams`: usunąć `imageBytes`/`imageMimeType`, dodać `images?: DecodedDraftImage[]` oraz `imageDetail?: 'high'` (ustawiane tylko dla żądań z `images`).
- `AiImageSourceRequest` zachowuje eksport (typ wywiedziony z `ImageSourceSchema`). Obecnie nie ma innych importów poza `ai.types.ts` — zmiana jest bezpieczna.

> Konsekwencja `superRefine`: `AiRecipeDraftRequestSchema` staje się `ZodEffects`. Schemat jest używany wyłącznie przez `safeParse` i `z.infer` (handler, `ai.types.test.ts`), więc nic więcej nie wymaga zmian.

### 3.3. Kontrakty współdzielone — `shared/contracts/types.ts`

```typescript
export type AiRecipeDraftRequestDto =
    | { source: 'text'; text: string; output_format: 'pycha_recipe_draft_v1'; language?: string }
    | {
          source: 'image';
          /** @deprecated Użyj `images`. */
          image: AiRecipeDraftImageDto;
          images?: never;
          output_format: 'pycha_recipe_draft_v1';
          language?: string;
      }
    | {
          source: 'image';
          /** Zdjęcia jednego przepisu, 1–5, w kolejności stron. */
          images: AiRecipeDraftImageDto[];
          image?: never;
          output_format: 'pycha_recipe_draft_v1';
          language?: string;
      }
    | { source: 'url'; url: string; output_format: 'pycha_recipe_draft_v1'; language?: string };

export interface AiRecipeDraftImageWarningDto {
    code: 'IMAGE_UNREADABLE';
    /** Numer zdjęcia od 1 (zgodny z "Zdjęcie k z N"). */
    image_index: number;
}

export interface AiRecipeDraftMetaDto {
    confidence: number;
    warnings: string[];
    /** Pole pomijane, gdy brak ostrzeżeń o zdjęciach. */
    image_warnings?: AiRecipeDraftImageWarningDto[];
}

export interface AiRecipeDraftPayloadTooLargeDto {
    code: 'PAYLOAD_TOO_LARGE';
    message: string;
    details?: { limit: 'per_file' | 'total'; max_bytes: number };
}
```

Backend utrzymuje własne typy w `ai.types.ts` (konwencja funkcji Supabase — brak importu z `shared/`), ręcznie zsynchronizowane z kontraktem. Po zmianie sprawdzić kompilację frontendu (`ng build`) — wszystkie miejsca budujące `AiRecipeDraftRequestDto` z polem `image` muszą nadal się kompilować.

---

## 4. Szczegóły odpowiedzi

### `200 OK` — draft z wielu zdjęć (jedno nieczytelne)

```json
{
    "draft": {
        "name": "Sernik na zimno",
        "description": "...",
        "ingredients_raw": "500 g twarogu\n...",
        "steps_raw": "Zmiksować twaróg\n...",
        "tips_raw": "Najlepiej smakuje po nocy w lodówce",
        "category_name": "Deser",
        "tags": ["sernik", "bez pieczenia"],
        "servings": 8,
        "prep_time_minutes": 30,
        "total_time_minutes": 270,
        "diet_type": "VEGETARIAN",
        "cuisine": "POLISH",
        "difficulty": "EASY",
        "is_termorobot": false,
        "is_grill": false
    },
    "meta": {
        "confidence": 0.84,
        "warnings": ["Zdjęcie 2 było nieczytelne i zostało pominięte."],
        "image_warnings": [
            { "code": "IMAGE_UNREADABLE", "image_index": 2 }
        ]
    }
}
```

- `meta.warnings` — kolejność: ostrzeżenia LLM → źródła → zdjęć → metadanych (PS-91); deduplikacja, limit 20 pozycji × 300 znaków (istniejące `mergeDraftWarnings`).
- `meta.image_warnings` — **pole pomijane** (nie `[]`), gdy brak ostrzeżeń o zdjęciach lub żądanie nie dotyczy obrazów; `image_index` od 1, rosnąco, bez duplikatów. Jest niezależne od limitu 20 w `warnings`.
- Ostrzeżenie o nieczytelnym zdjęciu **nigdy** nie powoduje błędu, o ile co najmniej jedno zdjęcie było czytelne.
- Stare pole `image` → odpowiedź bez `image_warnings`, bez regresji.

### Kody odpowiedzi

| Kod | Sytuacja | Zmiana |
|---|---|---|
| `200 OK` | Draft zbudowany z czytelnych zdjęć (także z ostrzeżeniami) | rozszerzone `meta` |
| `400 Bad Request` | `image` + `images`, brak obu, `images: []`, > 5 elementów, zły MIME, niepoprawny base64, `images` w `text`/`url`, niepoprawny JSON | **nowe przypadki** |
| `401 Unauthorized` | brak/nieważny JWT | bez zmian |
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | bez zmian |
| `413 Payload Too Large` | obraz > 10 MB **lub** suma > 15 MB (także wczesne odrzucenie po `Content-Length`) | **nowy przypadek (suma)** + `details` |
| `422 Unprocessable Entity` | brak pojedynczego przepisu na zdjęciach / wszystkie zdjęcia nieczytelne — kredyt zwrócony | bez zmiany kontraktu |
| `429 Too Many Requests` | rate limit / limit dostawcy modelu | bez zmian |
| `500 Internal Server Error` | błąd konfiguracji, błąd lub timeout modelu — kredyt zwrócony (jeden) | bez zmiany kontraktu |

`404` nie dotyczy tego endpointu (brak zasobów po identyfikatorze); `201` nie dotyczy (endpoint niczego nie zapisuje).

### Odpowiedź `400` (nowy kształt pola `field`)

```json
{
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "errors": [
        { "field": "images", "message": "images must contain between 1 and 5 items" }
    ]
}
```

Niepoprawny base64 dotychczas kończył się ogólnym `ApplicationError('VALIDATION_ERROR')` bez tablicy `errors`. Dla obrazów handler **zamiast tego** zwraca `createValidationErrorResponse`-podobną odpowiedź z `field: images.{k}.data_base64` (dla `image`: `image.data_base64`) — nowy pomocnik `createFieldValidationErrorResponse(field, message)` w `ai.handlers.ts`.

### Odpowiedź `413`

```json
{
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Total size of images exceeds maximum allowed size of 15 MB",
    "details": { "limit": "total", "max_bytes": 15728640 }
}
```

| `details.limit` | `max_bytes` | `message` |
|---|---|---|
| `per_file` | `10485760` | `Image {k} exceeds maximum allowed size of 10 MB` (k od 1); dla starego pola `image` dotychczasowe `Image size exceeds maximum allowed size of 10 MB` |
| `total` | `15728640` | `Total size of images exceeds maximum allowed size of 15 MB` |

Zmiana w handlerze: `createPayloadTooLargeResponse(message, details?)` — drugi parametr opcjonalny, **pozostałe wywołania** (`/ai/recipes/image`, referencje) nie przekazują `details` i zachowują dotychczasowy kształt. Pole `details` jest addytywne — klienci czytający wyłącznie `code` i `message` nie są dotknięci.

---

## 5. Przepływ danych

### 5.1. Handler — `handlePostAiRecipesDraft`

```
auth (getAuthenticatedContext) → rola z JWT (extractAndValidateAppRole)
→ [NOWE] Content-Length > MAX_DRAFT_REQUEST_BODY_BYTES?             → 413 (details.limit=total)
→ req.json()                                                         → 400 przy niepoprawnym JSON
→ AiRecipeDraftRequestSchema.safeParse                               → 400 (kształt: XOR image/images, 1–5, MIME)
→ source === 'image':
    resolveDraftImages(requestData)                                  // images ?? [image], usedLegacyImageField
    decodeDraftImages(images)                                        // base64 → 400; per_file / total → 413
→ createServiceRoleClient + checkAndDeductCredits('draft')           // 1 kredyt                    → 402
→ generateRecipeDraft({ images, imageDetail, … })                    // throw → refundCreditAfterFailure (1 zwrot) → rethrow
→ result.success === false                                           // refundCreditAfterFailure (1 zwrot) → 422
→ deductCreditAfterSuccess                                           // bez zmian
→ 200 OK
```

Wymóg: w handlerze **nie** wolno przenosić żadnej walidacji obrazów za `checkAndDeductCredits`. Dla `source: 'text'`/`'url'` przepływ jest identyczny jak dziś. Istniejąca struktura (`try/catch` wokół `generateRecipeDraft` + osobny zwrot przy `!result.success`) gwarantuje najwyżej jeden zwrot — nie dodawać drugiego zwrotu w zewnętrznym `catch`.

Logowanie (bez treści obrazów i base64): `imagesCount`, `totalImageBytes`, `usedLegacyImageField`, `imageDetail`; w logu sukcesu dodatkowo `imageWarningsCount`. Poziom `info`, ostrzeżenia walidacyjne `warn`.

### 5.2. Serwis — `generateRecipeDraft` (`source === 'image'`)

Budowa wiadomości użytkownika:

| Przypadek | `content` |
|---|---|
| Stare pole `image` (`images.length === 1`, brak `imageDetail`) | dotychczasowe: `getImageExtractionPrompt()` + jedno `image_url` **bez** `detail` |
| `images`, N = 1 | `getImageExtractionPrompt()` + jedno `image_url` z `detail: "high"` |
| `images`, N > 1 | `intro` → dla k = 1..N: tekst `Zdjęcie k z N:` + `image_url` z `detail: "high"` → `outro` |

- Kolejność części `image_url` = kolejność tablicy z żądania (żadnego sortowania ani deduplikacji po stronie backendu).
- Typ części treści wydzielić do jednego aliasu `OpenAiContentPart = { type: string; text?: string; image_url?: { url: string; detail?: 'high' } }` i użyć w `callOpenAI` oraz `generateRecipeDraft`.
- Kodowanie base64: zastąpić pętlę `String.fromCharCode(...chunk)` + `btoa` kodowaniem binarnym `encodeBase64` ze standardowej biblioteki Deno (import w konwencji repo: `https://deno.land/std@0.224.0/encoding/base64.ts`). Dotyczy ścieżki draftu; analogiczna pętla w `callGeminiImageAPI` (obraz referencyjny ≤ 2 MB) pozostaje poza zakresem.
- `callOpenAI(messages, timeoutMs = API_TIMEOUT_MS)` — nowy opcjonalny parametr; `generateRecipeDraft` przekazuje `getDraftApiTimeoutMs(images.length, API_TIMEOUT_MS)` dla źródła `image`, a dla `text`/`url` nic (zachowanie bez zmian).

Przetwarzanie odpowiedzi modelu (dla `source === 'image'`, N > 1):

```
llmResponse
→ is_valid_recipe === false                       → bez zmian: success=false (422), jeden zwrot
→ normalizeUnreadableImages(raw.unreadable_images, N)    // z SUROWEJ odpowiedzi, przed safeParse
→ indices.length === N                            → success=false, reasons: ["Żadne ze zdjęć nie było czytelne."] (422), jeden zwrot
→ safeParse(AiRecipeDraftLlmResponseSchema)       → bez zmian (błąd formatu → 500, zwrot w handlerze)
→ validateDraftContent / normalizeDraft / extractRawMetadata + normalizeDraftMetadata   → bez zmian
→ warnings = mergeDraftWarnings([...llmWarnings, ...sourceWarnings, ...imageWarnings], metadataWarnings)
→ meta = { confidence, warnings, ...(indices.length > 0 && { image_warnings }) }
→ 200 OK
```

Odstępstwo od kolejności z planu API (świadome): sprawdzenie „wszystkie nieczytelne” wykonujemy **przed** `safeParse`. Gdy model uzna wszystkie zdjęcia za nieczytelne, może zwrócić pusty/niekompletny `draft`, co przy odwrotnej kolejności skończyłoby się `500 AI service returned invalid response format` zamiast zapowiedzianego `422`. Wynik dla użytkownika zgodny ze scenariuszem 15 (kredyt zwrócony, formularz niewypełniony).

### 5.3. Prompt

Zasada: `getSystemPrompt` zmieniany **minimalnie** (ryzyko konfliktów z PS-34 i PS-97); treści specyficzne dla wielu zdjęć żyją w `ai-draft-images.ts`.

**`getSystemPrompt` (sekcja „FORMAT ODPOWIEDZI JSON”):** dopisać po `meta` opcjonalne pole najwyższego poziomu `"unreadable_images": []` oraz w „UWAGA O POLACH” jedno zdanie: numery zdjęć (od 1) nieczytelnych lub niezawierających treści przepisu; pusta tablica, gdy wszystkie są czytelne; pole stosować wyłącznie, gdy przesłano więcej niż jedno zdjęcie.

**`getMultiImageUserPromptParts(N)` — `intro` (N > 1):**

```
Załączono {N} zdjęć. Są to KOLEJNE fragmenty JEDNEGO przepisu kulinarnego (np. kolejne strony
książki kucharskiej), podane w kolejności stron. Każde zdjęcie jest poprzedzone podpisem
"Zdjęcie k z {N}".

Połącz informacje ze wszystkich zdjęć w jeden spójny przepis:
- składniki, kroki i wskazówki z różnych zdjęć scalaj w kolejności zdjęć, bez duplikowania
  powtórzonych fragmentów,
- jeśli ta sama informacja (np. nazwa, porcje, czas) występuje na kilku zdjęciach, użyj wartości
  jawnie podanej w źródle,
- zdjęcie nieczytelne lub niezawierające treści przepisu pomiń, a jego numer (od 1, zgodnie
  z podpisem) dodaj do pola "unreadable_images",
- jeśli żadne zdjęcie nie zawiera przepisu, zwróć is_valid_recipe=false.

Obowiązują wszystkie pozostałe zasady i format JSON z instrukcji systemowej.
```

`outro`: `Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.`

---

## 6. Względy bezpieczeństwa

| Zagrożenie | Środek |
|---|---|
| Brak uwierzytelnienia / nieważny JWT | `getAuthenticatedContext` jako pierwszy krok (`401`); rola brana wyłącznie z JWT (`app_metadata.app_role`), nigdy z body |
| Eskalacja uprawnień | Bez zmian: gating `premium`/`admin` dotyczy trasy UI; API akceptuje także `user` z rozliczeniem kredytów. Nowe pole `images` nie zmienia modelu uprawnień |
| Nadużycie kosztowe (5 obrazów × `detail: "high"` za 1 kredyt) | Limit 5 zdjęć, limity rozmiaru (10/15 MB), pula kredytów rezerwowana **przed** wywołaniem modelu, istniejący rate limit; monitoring zużycia tokenów po wdrożeniu (plan wdrożenia). `DRAFT_IMAGE_DETAIL` w jednej stałej — łatwa zmiana |
| DoS przez duże body / pamięć funkcji (JSON z base64 do ~20 MB) | **Utwardzenie:** jeśli nagłówek `Content-Length` jest liczbą większą niż `MAX_DRAFT_REQUEST_BODY_BYTES` (22 MB) → `413` (`details.limit: total`) **przed** `req.json()`. Najlepszy wysiłek — brak nagłówka (chunked) nie blokuje żądania, wtedy chronią limity po dekodowaniu. Dodatkowo limit sumy 15 MB i brak zapisu obrazów (tylko pamięć na czas żądania) |
| Obejście limitów przez wiele małych żądań | Rate limit i kredyty działają per żądanie — limit 5 zdjęć nie zwiększa liczby kredytów na wywołanie, więc nie osłabia ochrony |
| Niepoprawny/złośliwy base64, niezgodny MIME | Walidacja Zod (whitelist MIME) + dekodowanie w handlerze (`400`). Zawartość pliku nie jest interpretowana przez backend — trafia do modelu jako `data:` URL; nie jest zapisywana ani serwowana użytkownikom |
| Prompt injection przez treść zdjęć | Ryzyko akceptowane (jak dla pojedynczego obrazu): odpowiedź przechodzi walidację Zod, `normalizeDraft`, `normalizeDraftMetadata`; wynik trafia do formularza, który użytkownik weryfikuje przed zapisem. `unreadable_images` jest nieufne i filtrowane przez `normalizeUnreadableImages` (zakres, typ, deduplikacja) |
| Nieufne ostrzeżenia z modelu | `image_warnings` budowane wyłącznie przez backend z zwalidowanych indeksów; pole `meta.image_warnings` z odpowiedzi LLM jest odcinane przez schemat Zod; `warnings` mają limit 20 × 300 znaków |
| Wyciek danych w logach | Nie logować `data_base64`, bajtów ani treści draftu poza istniejącym zakresem; tylko liczby (`imagesCount`, `totalImageBytes`) |
| XSS | Treść draftu jest renderowana w formularzu Angular (escaping domyślny); backend nie wstawia jej do HTML. Bez zmian względem PS-91 |
| Wyciek klucza | `OPENAI_API_KEY` wyłącznie z `Deno.env`; brak zmian |

---

## 7. Obsługa błędów

Projekt nie ma tabeli błędów w bazie — błędy są rejestrowane przez `logger` (`warn` dla błędów klienta, `error` dla błędów infrastruktury/modelu) bez treści obrazów. Zgodnie z zasadami backendu walidacje i guard clauses stoją na początku, ścieżka szczęśliwa na końcu.

| Scenariusz | Wykrycie | Status | Kredyt | Uwagi |
|---|---|---|---|---|
| Brak/nieważny JWT | `getAuthenticatedContext` | `401` | nie pobrany | bez zmian |
| `Content-Length` > 22 MB | handler przed `req.json()` | `413` `total` | nie pobrany | nowe |
| Niepoprawny JSON | `req.json()` | `400` | nie pobrany | bez zmian |
| `image` + `images` / brak obu / `images: []` / > 5 | Zod `superRefine` / `min`/`max` | `400` `VALIDATION_ERROR` | nie pobrany | komunikat z `field` |
| `images` w `source: text`/`url` | Zod | `400` | nie pobrany | błąd URL nadal mapowany na `INVALID_URL` tylko dla `source: 'url'` |
| Zły MIME w `images[k]` | Zod | `400` `images.{k}.mime_type` | nie pobrany | |
| Niepoprawny base64 | `decodeDraftImages` | `400` `images.{k}.data_base64` | nie pobrany | nowy pomocnik odpowiedzi |
| Obraz > 10 MB | `validateDraftImageSizes` | `413` `per_file` | nie pobrany | `message` z numerem k |
| Suma > 15 MB | `validateDraftImageSizes` | `413` `total` | nie pobrany | |
| Pula `draft` wyczerpana | `checkAndDeductCredits` | `402` `AI_CREDITS_EXHAUSTED` | brak (rezerwacja się nie udała) | bez zmian, model nie jest wywoływany |
| Rate limit / `429` dostawcy | `ApplicationError TOO_MANY_REQUESTS` | `429` + `Retry-After: 60` | zwrot | bez zmian |
| Model: `is_valid_recipe: false` | serwis | `422` | zwrot (1) | bez zmian |
| Model: wszystkie zdjęcia nieczytelne | `normalizeUnreadableImages` | `422`, `reasons: ["Żadne ze zdjęć nie było czytelne."]` | zwrot (1) | nowe |
| Model: część zdjęć nieczytelna | `normalizeUnreadableImages` | `200` + `warnings` + `image_warnings` | pobrany (1) | |
| Model: niepoprawny format JSON/schematu | serwis (`ApplicationError`) | `500` | zwrot (1) | |
| Timeout / błąd sieci modelu | `callOpenAI` | `500` (`INTERNAL_ERROR`) | zwrot (1) | timeout skalowany liczbą zdjęć |
| Brak `OPENAI_API_KEY` | `callOpenAI` | `500` | zwrot (1) | |

Reguła nadrzędna: **zwrot kredytu następuje najwyżej raz** niezależnie od liczby zdjęć (ścieżki `throw` i `!result.success` wykluczają się wzajemnie).

---

## 8. Rozważania dotyczące wydajności

| Wąskie gardło | Strategia |
|---|---|
| Rozmiar żądania (JSON z base64 do ok. 20 MB) i pamięć funkcji | Limit sumy 15 MB, wczesne odrzucenie po `Content-Length`, kompresja po stronie klienta (dłuższy bok 2048 px), brak kopiowania obrazów do Storage; ręczna weryfikacja limitu body Edge Function w planie wdrożenia. Obniżenie `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` jest jedyną zmianą w razie problemów |
| Kodowanie base64 w pętli stringów | Zastąpić `encodeBase64` (kodowanie binarne) — mniej alokacji przy 5 obrazach |
| Podwójne trzymanie obrazów (base64 w żądaniu + bajty + base64 w `data:` URL) | Nie przekazywać dalej oryginalnych stringów `data_base64` po dekodowaniu; serwis pracuje na `Uint8Array`. Akceptowalne przy limicie 15 MB; przy problemach z pamięcią rozważyć strumieniowe składanie JSON do OpenAI |
| Czas odpowiedzi modelu dla 5 zdjęć | Timeout `min(100 s + 10 s × (N − 1), 140 s)` — pod limitem 150 s funkcji; UI pokazuje komunikat w stanie ładowania |
| Koszt tokenów (`detail: "high"`) | Limit 5 zdjęć + kompresja kliencka + 1 wywołanie modelu; przegląd zużycia po wdrożeniu |
| Jedno wywołanie zamiast N | Brak wielokrotnych round-tripów i wielokrotnych rozliczeń kredytu |

---

## 9. Etapy wdrożenia

1. **Moduł `ai-draft-images.ts`.** Utworzyć plik ze stałymi (sekcja 2), przenieść `MAX_IMAGE_SIZE_BYTES` z `ai.types.ts` (z re-eksportem), zaimplementować `resolveDraftImages`, `tryDecodeBase64`, `validateDraftImageSizes`, `decodeDraftImages`, `getDraftApiTimeoutMs`, `getMultiImageUserPromptParts`, `normalizeUnreadableImages`. Bez importów wartości z `ai.types.ts`.
2. **`ai.types.ts`.** Dodać schemat `images`, `superRefine` XOR, `images: z.undefined().optional()` w `TextSourceSchema`/`UrlSourceSchema`, `unreadable_images` w `AiRecipeDraftLlmResponseSchema`, typy `AiRecipeDraftImageWarning` i rozszerzone `meta`, nowe `GenerateRecipeDraftParams` (`images`, `imageDetail`).
3. **`ai.handlers.ts`.**
    1. Rozszerzyć `createPayloadTooLargeResponse(message, details?)`; dodać `createFieldValidationErrorResponse(field, message)`.
    2. Dodać wczesną kontrolę `Content-Length` przed `req.json()`.
    3. W gałęzi `source === 'image'` użyć `resolveDraftImages` + `decodeDraftImages` i zmapować wyniki na `400`/`413` z `details`; `decodeBase64` przepisać na nakładkę na `tryDecodeBase64` (ścieżka `reference_image` bez zmian zachowania).
    4. Zachować kolejność: walidacje obrazów → `checkAndDeductCredits` → `generateRecipeDraft`; przekazać `images` i `imageDetail` (`'high'` tylko dla `images`, nie dla starego `image`).
    5. Dodać pola logów (`imagesCount`, `totalImageBytes`, `usedLegacyImageField`, `imageDetail`, `imageWarningsCount`); upewnić się, że nie ma drugiego zwrotu kredytu.
4. **`ai.service.ts`.**
    1. Dodać alias `OpenAiContentPart` i parametr `timeoutMs` w `callOpenAI`.
    2. Zbudować wiadomość dla trzech przypadków (stare `image`, `images` N = 1, `images` N > 1) z `encodeBase64`.
    3. Po odpowiedzi modelu: `normalizeUnreadableImages` z surowej odpowiedzi → `422` przy „wszystkie nieczytelne” → reszta bez zmian → `mergeDraftWarnings` z ostrzeżeniami zdjęć → `meta.image_warnings` tylko gdy niepuste.
    4. Dopisać pole `unreadable_images` w `getSystemPrompt` (minimalna zmiana).
5. **`shared/contracts/types.ts`.** Zaktualizować `AiRecipeDraftRequestDto`, dodać `AiRecipeDraftImageWarningDto`, `AiRecipeDraftPayloadTooLargeDto`, `image_warnings?` w `AiRecipeDraftMetaDto`. Zweryfikować kompilację frontendu (`ng build`).
6. **Testy Deno** (mock `fetch` — bez prawdziwych wywołań LLM; wzorzec `withMockedOpenAI` z `ai.service.test.ts` rozszerzyć o przechwycenie body żądania):
    - `ai-draft-images.test.ts` (nowy):
        - `resolveDraftImages`: `images` → lista + `usedLegacyImageField = false`; `image` → lista 1 elementu + `true`.
        - `validateDraftImageSizes`: plik > 10 MB → `per_file` (z `index`); 2 × 8 MB → `total`; 3 × 5 MB (dokładnie 15 MB) → OK.
        - `decodeDraftImages`: niepoprawny base64 w `images[1]` → `INVALID_BASE64` z `index: 1`; poprawne dane → bajty w kolejności; naruszenie limitu → `PAYLOAD_TOO_LARGE` (porządek: base64 → rozmiary).
        - `normalizeUnreadableImages`: `[0, 4, 2.5, "x", 2, 2]` przy N = 3 → `[2]`; N = 1 → `[]`; brak/nie-tablica → `[]`; tekst ostrzeżenia dokładnie `Zdjęcie 2 było nieczytelne i zostało pominięte.`
        - `getDraftApiTimeoutMs`: 1 → 100 000, 3 → 120 000, 5 → 140 000, 10 → 140 000.
        - `getMultiImageUserPromptParts`: zawiera N, regułę kolejności i regułę pominięcia nieczytelnych.
    - `ai.types.test.ts`: `images` > 5 → błąd `path = ['images']`; `images: []` → błąd; 5 elementów → OK; zły MIME w `images[1]` → `path = ['images', 1, 'mime_type']`; `image` + `images` → błąd (`path = ['image']`); brak obu → błąd (`path = ['images']`); `images` w `source: "text"`/`"url"` → błąd; stary `image` → OK; regresja istniejących testów URL.
    - `ai.service.test.ts`:
        - 3 obrazy → żądanie do modelu zawiera 3 części `image_url` w kolejności tablicy, każda z `detail: "high"`, poprzedzona tekstem `Zdjęcie k z 3:`; permutacja wejścia zmienia kolejność w żądaniu.
        - Stare `image` → jedna część `image_url` **bez** `detail`, prompt jednoobrazowy, odpowiedź bez `image_warnings`.
        - `images`, N = 1 → `detail: "high"`, prompt jednoobrazowy.
        - `unreadable_images: [2]` przy N = 3 → `success`, `meta.warnings` zawiera ostrzeżenie, `meta.image_warnings = [{ code: 'IMAGE_UNREADABLE', image_index: 2 }]`.
        - Kolejność ostrzeżeń LLM → źródło → zdjęcia → metadane, z deduplikacją.
        - `unreadable_images` obejmuje wszystkie N (także przy pustym/niekompletnym `draft`) → `success: false`, powód `Żadne ze zdjęć nie było czytelne.`; `is_valid_recipe: false` → `success: false` bez zmian.
        - `getSystemPrompt()` zawiera opis pola `unreadable_images`.
        - Regresja: testy PS-91 (metadane), PS-64 (kredyty), PS-97 (URL) przechodzą bez zmian.
    - Przepływ kredytów (1 pobranie, najwyżej 1 zwrot) nie ma testu jednostkowego handlera (brak infrastruktury mocków auth) — weryfikowany strukturalnie w code review (kolejność kroków) oraz ręcznie w kroku 8.
7. **Uruchomienie i lint.** `deno test` w `supabase/functions/ai/`, `deno check`/`deno lint` dla zmienionych plików, `ng build` dla `shared/contracts/types.ts`.
8. **Weryfikacja ręczna lokalnie** (`supabase functions serve ai`, użytkownik testowy z `backend.mdc`; przykłady w `test-requests.http`): `images` (1, 3, 5 zdjęć), stary `image`, `image` + `images`, brak obu, `images: []`, 6 zdjęć, zły MIME, niepoprawny base64, plik > 10 MB, suma > 15 MB, `Content-Length` > 22 MB. Po każdym `400`/`413` sprawdzić `GET /ai/credits` — saldo `draft` **bez zmian**; po udanym wywołaniu — spadek o dokładnie 1; po wymuszonym błędzie modelu — saldo wraca.
9. **Dokumentacja** (razem z kodem): `docs/results/main-project-docs/009 API plan.md` (kontrakt `POST /ai/recipes/draft`: `images`, deprecated `image`, limity 5 / 10 MB / 15 MB, `413` z `details`, `meta.image_warnings`), `supabase/functions/ai/test-requests.http`, `supabase/functions/ai/TESTING_TIPS.md`, `docs/results/project-summary.md` (wiersz endpointu, opis US-036, wpis PS-100, deprecated `image`).
10. **Kolejność wdrożenia.** Najpierw backend (zmiana addytywna — stary klient z `image` działa bez zmian), potem frontend z listą zdjęć (plan UI PS-100). Szczegóły limitu body Edge Function, smoke testów i monitoringu tokenów: `PS-100-multi-image-ai-recipe-draft-deployment-plan.md`.

### Definition of Done (API)

- [ ] `ai-draft-images.ts` z pełnym zestawem funkcji i testami
- [ ] Schemat żądania: `images` (1–5) równolegle do `image`, XOR, `images: undefined` w `text`/`url`
- [ ] Walidacje obrazów (`400`/`413` z `details`) przed `checkAndDeductCredits`; wczesne odrzucenie po `Content-Length`
- [ ] `generateRecipeDraft`: wiele `image_url` w kolejności, `detail: "high"` dla `images`, `encodeBase64`, timeout skalowany liczbą zdjęć
- [ ] `unreadable_images` → `meta.warnings` + `meta.image_warnings`; „wszystkie nieczytelne” → `422` + jeden zwrot kredytu
- [ ] Stare pole `image` działa bez regresji (bez `detail`, bez `image_warnings`)
- [ ] `shared/contracts/types.ts` zsynchronizowane, frontend się kompiluje
- [ ] Testy Deno przechodzą (w tym regresja PS-91 / PS-64 / PS-97)
- [ ] Dokumentacja zaktualizowana
