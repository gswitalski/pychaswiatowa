# PS-100: Analiza przepisu AI z wielu zdjęć — Plan API

> **User Story:** PS-100 — Analiza przepisu AI z wielu zdjęć (tryb „Obraz” asysty AI)
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Functions (funkcja `ai`), kontrakty współdzielone (`shared/contracts/types.ts`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `POST /ai/recipes/draft` | Modyfikacja istniejącego endpointu | Wariant `source: "image"` przyjmuje nowe pole `images` (tablica 1–5 obrazów) równolegle do dotychczasowego `image` |
| Pole `image` (pojedynczy obraz) | **Deprecated** | Działa bez zmian (zgodność wsteczna); UI zawsze wysyła `images`. Bez daty usunięcia |
| `AiRecipeDraftRequestSchema` (`ai.types.ts`) | Modyfikacja | `images` w wariancie obrazu, `images: undefined` w wariantach `text` i `url`, reguła „dokładnie jedno z `image` / `images`” |
| Walidacja rozmiaru w handlerze | Modyfikacja | Limit 10 MB na plik (jak dotąd) + **15 MB łącznie** po dekodowaniu base64; `413` przed rezerwacją kredytu |
| `generateRecipeDraft` (`ai.service.ts`) | Modyfikacja | Parametr `images[]` zamiast pojedynczego obrazu, wiele części `image_url` w kolejności listy, `detail: "high"` dla `images`, timeout skalowany liczbą obrazów |
| Moduł `ai-draft-images.ts` | **Nowy plik** | Stałe limitów, normalizacja `image`/`images` do jednej listy, walidacja rozmiarów, prompt wielu zdjęć, normalizacja `unreadable_images` |
| `meta.warnings` | Rozszerzenie zawartości | Ostrzeżenie „Zdjęcie k było nieczytelne i zostało pominięte.” |
| `meta.image_warnings` | **Nowe pole opcjonalne** | Ustrukturyzowane ostrzeżenia o zdjęciach (`code`, `image_index`); pole pomijane, gdy brak ostrzeżeń |
| Odpowiedź `413` | Rozszerzenie | Dodatkowe pole `details` (`limit`: `per_file` / `total`, `max_bytes`) |

**Bez zmian:**

- `output_format` pozostaje `pycha_recipe_draft_v1` (zmiany są addytywne).
- Struktura `draft` (w tym metadane z PS-91) — jeden wspólny draft niezależnie od liczby zdjęć.
- Baza danych — brak migracji; obrazy żyją tylko w pamięci funkcji na czas jednego wywołania modelu (brak Storage).
- Kredyty AI (PS-64): jedno wywołanie = **1 kredyt `draft`** niezależnie od liczby zdjęć; rezerwacja przed wywołaniem modelu, jeden zwrot przy błędzie, `402 AI_CREDITS_EXHAUSTED` przy pustej puli.
- Uprawnienia: endpoint nadal przyjmuje role `user`/`premium`/`admin`; gating trasy UI (`premium`/`admin`) bez zmian.
- Rate limit, warianty `text` i `url` (PS-97), pozostałe endpointy modułu `ai`.
- Model tekstowy i parametr `response_format: json_object`.

---

## 2. Zmodyfikowany endpoint `POST /ai/recipes/draft`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | Bearer JWT (wymagane), role `user`/`premium`/`admin` |
| Zmiany | Nowe pole `images` w wariancie `source: "image"`, nowe limity, nowe ostrzeżenia, rozszerzony `413` |

### Żądanie — nowy kontrakt (`images`)

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

| Pole | Typ | Reguły |
|---|---|---|
| `source` | `"image"` | Bez zmian |
| `images` | `array<{ mime_type, data_base64 }>` | 1–5 elementów; kolejność tablicy = kolejność stron przepisu |
| `images[].mime_type` | `string` | `image/png`, `image/jpeg`, `image/webp` |
| `images[].data_base64` | `string` | Niepusty base64; po dekodowaniu max 10 MB |

### Żądanie — stary kontrakt (zgodność wsteczna, deprecated)

```json
{
    "source": "image",
    "image": { "mime_type": "image/png", "data_base64": "iVBORw0..." },
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

Przetwarzane jak dotychczas (jeden obraz, 1 kredyt, prompt jednoobrazowy, bez `detail`). Odpowiedź bez regresji.

### Reguły kształtu żądania (`source: "image"`)

| Sytuacja | Wynik |
|---|---|
| Tylko `image` | OK (ścieżka deprecated) |
| Tylko `images` (1–5) | OK |
| `image` **i** `images` | `400 VALIDATION_ERROR` (`field`: `image`) |
| Brak `image` i `images` | `400 VALIDATION_ERROR` (`field`: `images`) |
| `images: []` | `400 VALIDATION_ERROR` (`field`: `images`) |
| `images` > 5 elementów | `400 VALIDATION_ERROR` (`field`: `images`) |
| `images[k].mime_type` spoza listy | `400 VALIDATION_ERROR` (`field`: `images.{k}.mime_type`) |
| `images` w `source: "text"` / `"url"` | `400 VALIDATION_ERROR` (pole niedozwolone w tym wariancie) |

Przykład `400`:

```json
{
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "errors": [
        { "field": "images", "message": "images must contain between 1 and 5 items" }
    ]
}
```

### Odpowiedź `200 OK` — wiele zdjęć, jedno nieczytelne

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
        "warnings": [
            "Zdjęcie 2 było nieczytelne i zostało pominięte."
        ],
        "image_warnings": [
            { "code": "IMAGE_UNREADABLE", "image_index": 2 }
        ]
    }
}
```

| Pole `meta` | Opis |
|---|---|
| `warnings` | Teksty ostrzeżeń (jak w PS-91). Ostrzeżenie o zdjęciu dopisywane jest po ostrzeżeniach z LLM i źródła, przed ostrzeżeniami metadanych |
| `image_warnings` | **Opcjonalne.** Lista `{ code: "IMAGE_UNREADABLE", image_index: number }`; `image_index` jest numerowany od **1** (zgodnie z „Zdjęcie k z N”), rosnąco, bez duplikatów. Pole pomijane, gdy brak ostrzeżeń lub żądanie nie dotyczy obrazów |

Ostrzeżenie o nieczytelnym zdjęciu **nigdy** nie powoduje błędu odpowiedzi, o ile co najmniej jedno zdjęcie było czytelne.

### Kody odpowiedzi

| Kod HTTP | Sytuacja | Zmiana |
|---|---|---|
| `200 OK` | Draft zbudowany z czytelnych zdjęć (także z ostrzeżeniami) | Rozszerzone `meta` |
| `400 Bad Request` | Niepoprawny kształt (`image` + `images`, brak obu, pusta tablica, > 5, zły MIME, błędny base64) | **Nowe przypadki** |
| `401 Unauthorized` | Brak/nieważny JWT | Bez zmian |
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | Bez zmian |
| `413 Payload Too Large` | Obraz > 10 MB **lub** suma obrazów > 15 MB | **Nowy przypadek (suma)** + `details` |
| `422 Unprocessable Entity` | Żadne zdjęcie nie zawiera pojedynczego przepisu lub wszystkie nieczytelne — kredyt zwrócony | Bez zmian kontraktu |
| `429 Too Many Requests` | Rate limit | Bez zmian |
| `500` / `502` / `504` | Błąd modelu / konfiguracji / timeout — kredyt zwrócony (jeden) | Bez zmian kontraktu |

### Odpowiedź `413`

```json
{
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Total size of images exceeds maximum allowed size of 15 MB",
    "details": {
        "limit": "total",
        "max_bytes": 15728640
    }
}
```

| `details.limit` | Znaczenie | `max_bytes` | `message` |
|---|---|---|---|
| `per_file` | Pojedynczy obraz > 10 MB | `10485760` | `Image {k} exceeds maximum allowed size of 10 MB` (dla starego pola `image`: dotychczasowy komunikat bez numeru) |
| `total` | Suma obrazów > 15 MB | `15728640` | `Total size of images exceeds maximum allowed size of 15 MB` |

`details` jest polem addytywnym — dotychczasowi klienci czytający wyłącznie `code` i `message` nie są dotknięci.

---

## 3. Stałe i limity

Wartości trzymane w jednym miejscu po stronie backendu (`supabase/functions/ai/ai-draft-images.ts`, import w `ai.types.ts` / `ai.handlers.ts` / `ai.service.ts`) i w jednym miejscu po stronie frontendu (patrz plan UI).

| Stała | Wartość | Opis |
|---|---|---|
| `MAX_DRAFT_IMAGES` | `5` | Maks. liczba zdjęć w jednej analizie |
| `MAX_IMAGE_SIZE_BYTES` | `10 * 1024 * 1024` | Istniejąca stała — limit na plik po dekodowaniu |
| `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` | `15 * 1024 * 1024` | Suma rozmiarów po dekodowaniu base64 (JSON z base64 to ok. 20 MB) |
| `DRAFT_IMAGE_DETAIL` | `"high"` | Wartość `image_url.detail` dla żądań z polem `images` |
| `DRAFT_API_TIMEOUT_PER_EXTRA_IMAGE_MS` | `10_000` | Dodatek do timeoutu za każde zdjęcie ponad pierwsze |
| `DRAFT_API_TIMEOUT_MAX_MS` | `140_000` | Górny limit timeoutu — poniżej limitu czasu Edge Function (150 s) |

Timeout wywołania modelu: `min(API_TIMEOUT_MS + 10_000 × (N − 1), 140_000)` ms, gdzie `API_TIMEOUT_MS = 100_000` (istniejąca stała). Wynik: 1 zdjęcie → 100 s, 3 → 120 s, 5 → 140 s.

---

## 4. Przepływ w handlerze (`handlePostAiRecipesDraft`)

Kolejność kroków ma znaczenie: **wszystkie walidacje obrazów wykonują się przed `checkAndDeductCredits`**, więc `400`/`413` nigdy nie pobierają kredytu.

```
auth → rola z JWT → req.json()
→ AiRecipeDraftRequestSchema.safeParse        // kształt: image XOR images, 1–5, MIME      → 400
→ resolveDraftImages(requestData)             // NOWE: images ?? [image], flaga usedLegacyImageField
→ dla każdego obrazu: decodeBase64            // niepoprawny base64                       → 400 (field images.{k}.data_base64)
→ walidacja rozmiaru na plik (> 10 MB)        //                                          → 413 details.limit=per_file
→ walidacja sumy (> 15 MB)                    // NOWE                                     → 413 details.limit=total
→ checkAndDeductCredits('draft')              // 1 kredyt, bez zmian                      → 402
→ generateRecipeDraft({ images, … })          // try/catch → refundCreditAfterFailure (jeden zwrot)
→ result.success === false                    // 422 + jeden zwrot
→ deductCreditAfterSuccess                    // bez zmian
→ 200 OK
```

Logowanie (bez treści obrazów): `imagesCount`, `totalImageBytes`, `usedLegacyImageField` (pozwala ocenić, kiedy można usunąć pole `image`), `imageDetail`.

---

## 5. Zmiany w kodzie backendu

### 5.1 `ai.types.ts` — schemat żądania

- `AiRecipeDraftImageSchema` bez zmian.
- `TextSourceSchema` i `UrlSourceSchema`: dodać `images: z.undefined().optional()`.
- `ImageSourceSchema` pozostaje obiektem Zod (wymóg `discriminatedUnion`):

```typescript
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
```

- Reguła „dokładnie jedno z `image` / `images`” jako `superRefine` na całej unii (`AiRecipeDraftRequestSchema = z.discriminatedUnion(...).superRefine(...)`): dla `source === 'image'` brak albo obecność obu pól dodaje issue z `path` wskazującym odpowiednio `images` albo `image`.
- Eksportowany typ `AiImageSourceRequest` zachowuje zgodność z istniejącymi importami.

### 5.2 `ai-draft-images.ts` (nowy moduł)

| Eksport | Opis |
|---|---|
| `MAX_DRAFT_IMAGES`, `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES`, `DRAFT_IMAGE_DETAIL`, stałe timeoutu | Patrz sekcja 3 |
| `resolveDraftImages(request)` | `(AiImageSourceRequest) → { images: Array<{ mime_type, data_base64 }>; usedLegacyImageField: boolean }` — normalizacja obu wariantów do jednej listy |
| `validateDraftImageSizes(sizes: number[])` | Funkcja czysta: `{ ok: true } \| { ok: false; limit: 'per_file' \| 'total'; index?: number }` |
| `getDraftApiTimeoutMs(imageCount)` | Timeout z sekcji 3 |
| `getMultiImageUserPromptParts(count)` | Teksty promptu wielu zdjęć (sekcja 6) |
| `normalizeUnreadableImages(raw, imageCount)` | Funkcja czysta: `(raw: unknown, imageCount: number) → { indices: number[]; warnings: string[] }` |

Reguły `normalizeUnreadableImages` (nie rzuca wyjątków):

| Wejście | Wynik |
|---|---|
| brak pola / nie-tablica | `indices: []` |
| elementy całkowite w zakresie 1–N | zachowane, posortowane rosnąco, bez duplikatów |
| elementy spoza zakresu, nie-liczby, ułamki | pomijane (log `warn`, bez ostrzeżenia dla użytkownika) |
| `imageCount === 1` | zawsze `[]` (przy jednym nieczytelnym zdjęciu LLM zwraca `is_valid_recipe: false`) |
| każdy poprawny indeks `k` | ostrzeżenie `Zdjęcie {k} było nieczytelne i zostało pominięte.` |

### 5.3 `ai.service.ts`

**`GenerateRecipeDraftParams`:** zamiast `imageBytes` / `imageMimeType` pole `images?: Array<{ bytes: Uint8Array; mimeType: string }>` oraz `imageDetail?: 'high'` (ustawiane tylko dla żądań z `images`).

**Budowa wiadomości użytkownika (`source === 'image'`):**

| Przypadek | Zawartość `content` |
|---|---|
| Stare pole `image` | Dotychczasowe: `getImageExtractionPrompt()` + jedno `image_url` **bez** `detail` |
| `images`, N = 1 | `getImageExtractionPrompt()` + jedno `image_url` z `detail: "high"` |
| `images`, N > 1 | Tekst wprowadzający (sekcja 6) → dla k = 1..N: tekst `Zdjęcie k z N:` + `image_url` z `detail: "high"` → tekst końcowy z instrukcją JSON |

- Kolejność części `image_url` = kolejność tablicy z żądania.
- Kodowanie bajtów do base64: zastąpić pętlę konkatenacji stringów (`String.fromCharCode(...chunk)` + `btoa`) wydajnym kodowaniem binarnym (np. `encodeBase64` z biblioteki standardowej Deno), bo przy 5 obrazach do 15 MB dotychczasowa pętla jest zbędnie kosztowna pamięciowo.

**`callOpenAI`:** nowy opcjonalny parametr `timeoutMs` (domyślnie `API_TIMEOUT_MS`); `generateRecipeDraft` przekazuje `getDraftApiTimeoutMs(N)`. Pozostałe parametry (`MAX_TOKENS = 8000`, `response_format`) bez zmian.

**Po odpowiedzi modelu (dla `source === 'image'` i N > 1):**

```
llmResponse
→ (is_valid_recipe === false)                     → bez zmian: success=false, 422, jeden zwrot kredytu
→ safeParse(AiRecipeDraftLlmResponseSchema)       → bez zmian
→ normalizeUnreadableImages(llmResponse.unreadable_images, N)
→ jeśli indices.length === N                      → success=false, reasons: ["Żadne ze zdjęć nie było czytelne."], 422, jeden zwrot
→ validateDraftContent / normalizeDraft / normalizeDraftMetadata   → bez zmian
→ warnings = mergeDraftWarnings([...llmWarnings, ...sourceWarnings, ...imageWarnings], metadataWarnings)
→ meta = { confidence, warnings, image_warnings? }   // image_warnings tylko gdy indices.length > 0
→ 200 OK
```

---

## 6. Zmiana promptu

**Zasada:** prompt systemowy zmieniany minimalnie (konflikty z PS-34 i PS-97 w `getSystemPrompt`); treści specyficzne dla wielu zdjęć w nowym module.

### Prompt systemowy (`getSystemPrompt`)

- Do formatu JSON odpowiedzi dopisać opcjonalne pole najwyższego poziomu (obok `draft` i `meta`): `"unreadable_images": []` — „numery zdjęć (od 1) nieczytelnych lub niezawierających treści przepisu; pusta tablica, gdy wszystkie są czytelne; pole stosuj wyłącznie, gdy przesłano więcej niż jedno zdjęcie”.

### Prompt użytkownika dla wielu zdjęć (N > 1)

Tekst wprowadzający:

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

Tekst końcowy: `Zwróć odpowiedź w formacie JSON zgodnie z instrukcjami.`

---

## 7. Kontrakty współdzielone (`shared/contracts/types.ts`)

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
    /** Ustrukturyzowane ostrzeżenia o zdjęciach; pole pomijane, gdy brak ostrzeżeń. */
    image_warnings?: AiRecipeDraftImageWarningDto[];
}

export interface AiRecipeDraftPayloadTooLargeDto {
    code: 'PAYLOAD_TOO_LARGE';
    message: string;
    details?: { limit: 'per_file' | 'total'; max_bytes: number };
}
```

Backend utrzymuje własne typy w `ai.types.ts` (konwencja funkcji Supabase — brak importu z `shared/`), zsynchronizowane z powyższym kontraktem.

---

## 8. Testy backendu (Deno)

Zakres: testy jednostkowe na mockowanej odpowiedzi modelu (bez prawdziwych wywołań LLM i bez E2E).

**Pliki:**

- `supabase/functions/ai/ai-draft-images.test.ts` (nowy) — normalizacja żądania, limity, `normalizeUnreadableImages`, timeout, prompt,
- `supabase/functions/ai/ai.types.test.ts` (rozszerzenie) — schemat żądania,
- `supabase/functions/ai/ai.service.test.ts` (rozszerzenie) — integracja `generateRecipeDraft` z mockiem `fetch`.

| Scenariusz historyjki | Test |
|---|---|
| 1 | `images` (3 obrazy) → żądanie do modelu zawiera 3 części `image_url` w kolejności tablicy, każda z `detail: "high"`, poprzedzona tekstem `Zdjęcie k z 3:`; jedna odpowiedź `draft` |
| 1, 12, 13 | Jedno wywołanie `checkAndDeductCredits` i najwyżej jeden zwrot niezależnie od N (test przepływu: błąd modelu → dokładnie 1 zwrot) |
| 3, 4 | Kolejność obrazów w wiadomości dla permutacji wejścia (stabilność kolejności) |
| 5 / 11 | Schemat: `images` > 5 → błąd z `path = ['images']`; `images: []` → błąd; 5 elementów → OK |
| 6 | Zły MIME w `images[1]` → błąd z `path = ['images', 1, 'mime_type']` |
| 9 | `validateDraftImageSizes`: plik > 10 MB → `per_file`; 2 × 8 MB (suma 16 MB) → `total`; 3 × 5 MB (15 MB) → OK (granica); odpowiedź `413` zawiera `details`; walidacja wykonywana przed rezerwacją kredytu (kolejność wywołań) |
| 10 | Stare pole `image` → jedna część `image_url` **bez** `detail`, prompt jednoobrazowy, `usedLegacyImageField = true`, odpowiedź bez `image_warnings` |
| 11 | `image` + `images` → błąd; brak obu → błąd; `images` w `source: "text"` / `"url"` → błąd |
| 14 | Mock LLM: `unreadable_images: [2]` przy N = 3 → `meta.warnings` zawiera „Zdjęcie 2 było nieczytelne i zostało pominięte.”, `meta.image_warnings = [{ code: 'IMAGE_UNREADABLE', image_index: 2 }]`, status sukcesu |
| 14 | `unreadable_images: [0, 4, 2.5, "x", 2, 2]` przy N = 3 → tylko `[2]`; pozostałe pominięte bez ostrzeżenia i bez błędu |
| 14 | N = 1 → `unreadable_images` ignorowane |
| 14 | Kolejność ostrzeżeń: LLM → źródło → zdjęcia → metadane; deduplikacja |
| 15 | Mock LLM: `is_valid_recipe: false` → `success: false`, zwrot kredytu (bez zmian); `unreadable_images` obejmuje wszystkie N → `success: false` z powodem „Żadne ze zdjęć nie było czytelne.” |
| — | `getDraftApiTimeoutMs`: 1 → 100 000, 3 → 120 000, 5 → 140 000, 10 → 140 000 (cap) |
| — | `getSystemPrompt()` zawiera opis pola `unreadable_images`; prompt wielu zdjęć zawiera `{N}`, regułę kolejności i regułę pominięcia nieczytelnych |

---

## 9. Ryzyka

| Ryzyko | Mitygacja |
|---|---|
| Koszt tokenów (5 zdjęć × `detail: "high"` w jednym wywołaniu, 1 kredyt) | Limit 5 zdjęć, kompresja kliencka (dłuższy bok 2048 px), pula kredytów; po wdrożeniu przegląd zużycia tokenów (patrz plan wdrożenia). `detail` w jednej stałej — łatwa zmiana |
| Rozmiar żądania (JSON z base64 do ok. 20 MB) i pamięć funkcji | Limit sumy 15 MB, kompresja kliencka; ręczna weryfikacja limitu body Edge Function (plan wdrożenia). Obniżenie `MAX_TOTAL_DRAFT_IMAGES_SIZE_BYTES` jest jedyną zmianą w razie problemów |
| Czas odpowiedzi modelu dla 5 zdjęć | Timeout skalowany liczbą zdjęć z limitem 140 s (pod limitem 150 s Edge Function); komunikat w UI w stanie ładowania |
| Model nie flaguje nieczytelnego zdjęcia lub flaguje błędnie | Ostrzeżenie jest informacją pomocniczą; użytkownik weryfikuje formularz przed zapisem; backend ignoruje niepoprawne indeksy |
| Model miesza fragmenty różnych przepisów | Poza zakresem (wykrywanie wielu przepisów); wskazówka w UI |
| Konflikt zmian promptu z PS-34 / PS-97 | Minimalna zmiana `getSystemPrompt` (jedno pole JSON); reszta w osobnym module |
| Stare pole `image` żyje bez terminu usunięcia | Logowanie `usedLegacyImageField` pozwala podjąć decyzję o usunięciu na podstawie danych |

---

## 10. Dokumentacja do aktualizacji

Wykonywane razem z kodem (nie są to kroki wdrożeniowe):

| Dokument | Zmiana |
|---|---|
| `docs/results/main-project-docs/009 API plan.md` | Kontrakt `POST /ai/recipes/draft`: pole `images`, deprecated `image`, limity 5 / 10 MB / 15 MB, `413` z `details`, `meta.image_warnings` |
| `supabase/functions/ai/test-requests.http` (jeśli istnieje) | Przykłady żądań: `images` (1, 3, 5 zdjęć), stary `image`, błędne kształty, przekroczenie limitów |
| `supabase/functions/ai/TESTING_TIPS.md` (jeśli istnieje) | Uwagi o testowaniu wielu obrazów i limitów |
| `docs/results/project-summary.md` | Wiersz `POST /ai/recipes/draft`, opis US-036, nowy wpis PS-100 (stan realizacji, deprecated `image`) |

---

## 11. Checklist implementacji (API)

- [ ] Moduł `ai-draft-images.ts` (stałe, `resolveDraftImages`, `validateDraftImageSizes`, `getDraftApiTimeoutMs`, prompt, `normalizeUnreadableImages`)
- [ ] `ai.types.ts`: schemat `images`, reguła XOR, `images: undefined` w `text`/`url`, typ `meta.image_warnings`
- [ ] `ai.handlers.ts`: dekodowanie listy, walidacja per plik i łączna (`413` z `details`) **przed** rezerwacją kredytu, logowanie `usedLegacyImageField`
- [ ] `ai.service.ts`: wiele części `image_url` w kolejności, `detail: "high"` dla `images`, wydajne kodowanie base64, `timeoutMs` w `callOpenAI`
- [ ] Obsługa `unreadable_images`: ostrzeżenia, `meta.image_warnings`, przypadek „wszystkie nieczytelne” → `422` + zwrot kredytu
- [ ] `getSystemPrompt`: pole `unreadable_images` w formacie JSON
- [ ] `shared/contracts/types.ts`: typy żądania, `AiRecipeDraftImageWarningDto`, `AiRecipeDraftPayloadTooLargeDto`
- [ ] Testy Deno z sekcji 8
- [ ] Regresja: testy PS-91 (metadane), PS-64 (kredyty), PS-97 (URL) przechodzą bez zmian
- [ ] Aktualizacja dokumentacji z sekcji 10
