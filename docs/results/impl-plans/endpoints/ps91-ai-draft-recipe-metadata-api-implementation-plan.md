# API Endpoints Implementation Plan: PS-91 — Uzupełnianie metadanych przepisu przez AI (`POST /ai/recipes/draft`)

## 1. Przegląd punktu końcowego

Modyfikacja istniejącego endpointu `POST /ai/recipes/draft` (Edge Function `ai`). Obiekt `draft` w odpowiedzi `200 OK` zostaje rozszerzony o 8 pól metadanych przepisu: `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill`. Wartości są odczytywane z tekstu/obrazu (pierwszeństwo) albo wnioskowane przez LLM, a następnie **tolerancyjnie normalizowane po stronie backendu** — niepoprawne lub brakujące pole nigdy nie powoduje błędu całej odpowiedzi ani utraty kredytu `draft`.

Zmiana jest addytywna: `output_format` pozostaje `pycha_recipe_draft_v1`, żądanie bez zmian, brak migracji bazy danych, jedno wywołanie LLM i jeden kredyt `draft` na import.

**Zakres zmian:**

| Plik | Zmiana |
|---|---|
| `supabase/functions/ai/ai-draft-metadata.ts` | **Nowy.** Stałe enumów, ścisły schemat metadanych, `getMetadataPromptSection()`, `normalizeDraftMetadata()` |
| `supabase/functions/ai/ai.types.ts` | Rozdzielenie typu treści draftu od metadanych; schemat LLM z 8 polami `z.unknown().optional()`; rozszerzony `AiRecipeDraftDto` |
| `supabase/functions/ai/ai.service.ts` | Rozszerzenie promptów, eksport `getSystemPrompt`, integracja normalizacji w `generateRecipeDraft` |
| `supabase/functions/ai/ai.handlers.ts` | Tylko dodatkowe pola w logu (bez zmian logiki kredytów) |
| `shared/contracts/types.ts` | Rozszerzenie `AiRecipeDraftDto` o 8 pól |
| `supabase/functions/ai/ai-draft-metadata.test.ts` | **Nowy.** Testy normalizacji i promptu |
| `supabase/functions/ai/ai.service.test.ts` | **Nowy.** Testy integracyjne `generateRecipeDraft` z mockiem `fetch` |
| `supabase/functions/ai/ai.types.test.ts` | Rozszerzenie o schemat LLM |
| `docs/results/main-project-docs/009 API plan.md`, `supabase/functions/ai/test-requests.http`, `supabase/functions/ai/TESTING_TIPS.md`, `docs/results/project-summary.md` | Aktualizacja dokumentacji |

**Bez zmian:** pozostałe endpointy modułu `ai` (`/ai/credits`, `/ai/recipes/image`, `/ai/recipes/normalized-ingredients`), `AiRecipeDraftRequestSchema`, logika kredytów (`checkAndDeductCredits`, `refundCreditAfterFailure`, `deductCreditAfterSuccess`), rate limiting, role, parametry LLM (`gpt-4o-mini`, `json_object`, `API_TIMEOUT_MS = 30 000`).

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/ai/recipes/draft`
- **Autoryzacja:** `Authorization: Bearer <JWT>` (wymagane), role `user` / `premium` / `admin` (bez zmian)
- **Parametry:**
    - Wymagane: `source` (`text` | `image`), `output_format` (`pycha_recipe_draft_v1`), a zależnie od źródła `text` lub `image { mime_type, data_base64 }`
    - Opcjonalne: `language` (domyślnie `pl`)
- **Request Body:** bez zmian

```json
{
    "source": "text",
    "text": "Lasagne ze szpinakiem. Porcje: 6 ...",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

Wariant `source: "image"` (`image.mime_type` ∈ `image/png|jpeg|webp`, `image.data_base64`, limit 10 MB po dekodowaniu) pozostaje bez zmian.

---

## 3. Wykorzystywane typy

### 3.1. Backend — `supabase/functions/ai/ai-draft-metadata.ts` (nowy)

Moduł **nie importuje** niczego z `ai.types.ts` (unikamy zależności cyklicznej); to `ai.types.ts` importuje z niego.

```typescript
import { z } from 'npm:zod@3.22.4';

export const DIET_TYPES = ['MEAT', 'VEGETARIAN', 'VEGAN'] as const;
export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export const CUISINES = [
    'POLISH', 'ASIAN', 'MEXICAN', 'MIDDLE_EASTERN', 'AFRICAN', 'AMERICAN', 'BALKAN',
    'BRAZILIAN', 'BRITISH', 'CARIBBEAN', 'CHINESE', 'FRENCH', 'GERMAN', 'GREEK',
    'INDIAN', 'ITALIAN', 'JAPANESE', 'KOREAN', 'MEDITERRANEAN', 'RUSSIAN',
    'SCANDINAVIAN', 'SPANISH', 'THAI', 'TURKISH', 'VIETNAMESE',
] as const;

export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 99;
export const MIN_TIME_MINUTES = 0;
export const MAX_TIME_MINUTES = 999;

/** Metadata keys in the order used for warnings ("missing fields" list). */
export const DRAFT_METADATA_KEYS = [
    'servings', 'prep_time_minutes', 'total_time_minutes',
    'diet_type', 'cuisine', 'difficulty', 'is_termorobot', 'is_grill',
] as const;

/** Strict output contract — fields AFTER normalization. */
export const AiRecipeDraftMetadataSchema = z.object({
    servings: z.number().int().min(MIN_SERVINGS).max(MAX_SERVINGS).nullable(),
    prep_time_minutes: z.number().int().min(MIN_TIME_MINUTES).max(MAX_TIME_MINUTES).nullable(),
    total_time_minutes: z.number().int().min(MIN_TIME_MINUTES).max(MAX_TIME_MINUTES).nullable(),
    diet_type: z.enum(DIET_TYPES).nullable(),
    cuisine: z.enum(CUISINES).nullable(),
    difficulty: z.enum(DIFFICULTIES).nullable(),
    is_termorobot: z.boolean(),
    is_grill: z.boolean(),
});

export type AiRecipeDraftMetadata = z.infer<typeof AiRecipeDraftMetadataSchema>;

export interface NormalizedDraftMetadataResult {
    metadata: AiRecipeDraftMetadata;
    warnings: string[];
}

export function getMetadataPromptSection(): string;
export function normalizeDraftMetadata(raw: Record<string, unknown>): NormalizedDraftMetadataResult;
```

### 3.2. Backend — `supabase/functions/ai/ai.types.ts` (modyfikacja)

Obecnie `AiRecipeDraftDto = z.infer<typeof AiRecipeDraftOutputSchema>` jest używany jednocześnie jako typ wyjścia LLM i typ odpowiedzi. Po zmianie trzeba te role rozdzielić:

```typescript
import { AiRecipeDraftMetadata } from './ai-draft-metadata.ts';

/** Treść draftu (dotychczasowe 7 pól) — walidowana ściśle. */
export const AiRecipeDraftContentSchema = z.object({
    name: z.string().min(1, 'Recipe name is required'),
    description: z.string().nullish().default(null),
    ingredients_raw: z.string().min(1, 'Ingredients are required'),
    steps_raw: z.string().min(1, 'Steps are required'),
    tips_raw: z.string().optional(),
    category_name: z.string().nullish().default(null),
    tags: z.array(z.string()).default([]),
});

/** Draft z LLM: treść ściśle + 8 pól metadanych jako surowe, niezwalidowane wartości. */
export const AiRecipeDraftOutputSchema = AiRecipeDraftContentSchema.extend({
    servings: z.unknown().optional(),
    prep_time_minutes: z.unknown().optional(),
    total_time_minutes: z.unknown().optional(),
    diet_type: z.unknown().optional(),
    cuisine: z.unknown().optional(),
    difficulty: z.unknown().optional(),
    is_termorobot: z.unknown().optional(),
    is_grill: z.unknown().optional(),
});

export type AiRecipeDraftContentDto = z.infer<typeof AiRecipeDraftContentSchema>;
export type AiRecipeDraftDto = AiRecipeDraftContentDto & AiRecipeDraftMetadata;
```

- `AiRecipeDraftLlmResponseSchema` nadal używa `AiRecipeDraftOutputSchema` (bez zmiany struktury `{ draft, meta }`).
- `normalizeDraft()` i `validateDraftContent()` w `ai.service.ts` przyjmują `AiRecipeDraftContentDto`.
- `AiRecipeDraftResponseDto.draft` jest typu `AiRecipeDraftDto` (treść + metadane po normalizacji).
- `AiRecipeDraftMetadataSchema` jest re-eksportowany z `ai.types.ts` dla spójności importów.

### 3.3. Kontrakt współdzielony — `shared/contracts/types.ts`

Rozszerzenie istniejącego `AiRecipeDraftDto` (typy `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty` już istnieją w tym pliku):

```typescript
export interface AiRecipeDraftDto {
    // ... dotychczasowe pola bez zmian ...
    /** Number of servings (1-99) or null if unknown */
    servings: number | null;
    /** Preparation time in minutes (0-999) or null */
    prep_time_minutes: number | null;
    /** Total time in minutes (0-999, >= prep_time_minutes) or null */
    total_time_minutes: number | null;
    /** Diet type or null */
    diet_type: RecipeDietType | null;
    /** Cuisine or null (no matching cuisine) */
    cuisine: RecipeCuisine | null;
    /** Difficulty or null */
    difficulty: RecipeDifficulty | null;
    /** Whether the recipe uses a thermo-cooker (Thermomix etc.) */
    is_termorobot: boolean;
    /** Whether the recipe is for grill */
    is_grill: boolean;
}
```

Backend utrzymuje własny typ (konwencja funkcji Supabase — brak importu z `shared/`); oba muszą być zsynchronizowane ręcznie.

### 3.4. Command Models

Brak nowych Command Modeli — żądanie się nie zmienia.

---

## 4. Szczegóły odpowiedzi

### `200 OK` — draft z kompletem metadanych

```json
{
    "draft": {
        "name": "Lasagne ze szpinakiem",
        "description": "Warstwowa uczta, która ...",
        "ingredients_raw": "250 g makaronu lasagne\n...",
        "steps_raw": "Ugotować szpinak\n...",
        "tips_raw": "Najlepiej smakuje następnego dnia",
        "category_name": "Obiad",
        "tags": ["wegetariańskie", "włoskie"],
        "servings": 6,
        "prep_time_minutes": 20,
        "total_time_minutes": 75,
        "diet_type": "VEGETARIAN",
        "cuisine": "ITALIAN",
        "difficulty": "EASY",
        "is_termorobot": true,
        "is_grill": false
    },
    "meta": { "confidence": 0.92, "warnings": [] }
}
```

### `200 OK` — z korektami (`meta.warnings`)

LLM zwrócił `prep_time_minutes = 60`, `total_time_minutes = 40`, `servings = 150`, `cuisine = "UNKNOWN_CUISINE"`:

```json
{
    "draft": {
        "servings": null,
        "prep_time_minutes": 60,
        "total_time_minutes": 60,
        "cuisine": null
    },
    "meta": {
        "confidence": 0.8,
        "warnings": [
            "Skorygowano czas całkowity: był krótszy niż czas przygotowania.",
            "Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).",
            "Odrzucono nieprawidłową wartość pola cuisine (nieznana wartość)."
        ]
    }
}
```

(pozostałe pola `draft` pominięte dla czytelności)

### Kody statusu

| Kod | Sytuacja | Zmiana |
|---|---|---|
| `200 OK` | Draft wygenerowany — także z odrzuconymi/skorygowanymi/brakującymi metadanymi | Rozszerzona zawartość `draft` |
| `400 Bad Request` | Niepoprawne żądanie (Zod) | Bez zmian |
| `401 Unauthorized` | Brak/nieważny JWT | Bez zmian |
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | Bez zmian |
| `422 Unprocessable Entity` | Treść nie jest pojedynczym przepisem — bez pól metadanych, kredyt zwrócony | Bez zmian |
| `429 Too Many Requests` | Rate limit (lokalny lub OpenAI) | Bez zmian |
| `500 Internal Server Error` | Błąd konfiguracji / modelu / nieparsowalny JSON z LLM / niezgodność treści draftu ze schematem, kredyt zwrócony | Bez zmian — **błędy metadanych nigdy nie są źródłem 500** |

---

## 5. Przepływ danych

```
Klient → POST /ai/recipes/draft
  → index.ts → aiRouter → handlePostAiRecipesDraft           (bez zmian: JWT, rola, rate limit, Zod żądania)
  → checkAndDeductCredits (rezerwacja kredytu 'draft')        (bez zmian)
  → generateRecipeDraft(params)                               (ai.service.ts)
       1. getSystemPrompt(language)  ← NOWE: + getMetadataPromptSection()
       2. getTextExtractionPrompt / getImageExtractionPrompt   ← NOWE: wzmianka o metadanych
       3. callOpenAI(...)                                      (jedno wywołanie, bez zmian parametrów)
       4. is_valid_recipe === false → { success:false } → handler: refund + 422   (bez zmian)
       5. AiRecipeDraftLlmResponseSchema.safeParse             (treść ściśle, 8 pól jako unknown)
       6. validateDraftContent(content)                        (bez zmian)
       7. normalizeDraft(content)                              (bez zmian logiki: nazwa, tagi, tips)
       8. rawMetadata = pick(llmResponse.draft, DRAFT_METADATA_KEYS)       ← NOWE
       9. { metadata, warnings } = normalizeDraftMetadata(rawMetadata)     ← NOWE
      10. draft = { ...normalizedContent, ...metadata }
      11. meta  = { confidence, warnings: dedupe([...llmWarnings, ...metadataWarnings]) }
  → handler: deductCreditAfterSuccess (fire-and-forget), log, 200 OK
```

**Kluczowe decyzje:**

1. **Źródło surowych metadanych — obiekt `draft` sprzed `safeParse`.** Zod odróżnia brak klucza od `undefined` niejednoznacznie, a rozróżnienie „brak klucza” vs „jawne `null`” jest wymagane (`cuisine: null` = brak ostrzeżenia). Dlatego `rawMetadata` budujemy z surowego `llmResponse.draft` (`Object.prototype.hasOwnProperty.call`), a pola `z.unknown().optional()` w schemacie służą typowaniu i zapobiegają ich „zgubieniu”.
2. **`normalizeDraftMetadata` jest funkcją czystą** — nie rzuca wyjątków, nie loguje, nie ma efektów ubocznych (łatwe testy).
3. **Rozstrzygnięcie źródeł (tekst vs wnioskowanie) realizuje wyłącznie prompt.** Backend nie rozróżnia pól odczytanych od wywnioskowanych i nie eksponuje tej informacji.
4. **`meta.confidence` nie jest modyfikowane przez backend** (obniżanie przy wnioskowaniu z samego zdjęcia realizuje prompt).
5. **Brak tabeli błędów w bazie** — projekt nie posiada tabeli logów błędów; odrzucone/skorygowane pola są raportowane w `meta.warnings` (dla użytkownika) oraz przez `logger.warn` (dla operatora).

### Reguły `normalizeDraftMetadata`

| Pole | Wejście | Wynik | Ostrzeżenie |
|---|---|---|---|
| `servings` | liczba skończona lub ciąg `^\d+(\.\d+)?$` (po `trim`) → `Math.round` w 1–99 | liczba całkowita | — |
| `servings` | poza zakresem po zaokrągleniu, `NaN`/`Infinity`, ciąg nienumeryczny (np. `"4–6"`), inny typ | `null` | `Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).` |
| `prep_time_minutes`, `total_time_minutes` | j.w. w zakresie 0–999 | liczba całkowita | — |
| `prep_time_minutes`, `total_time_minutes` | niepoprawne | `null` | `Odrzucono nieprawidłową wartość pola {pole} (poza zakresem 0–999).` |
| `diet_type`, `difficulty`, `cuisine` | ciąg; `trim().toUpperCase()` należy do listy | wartość enuma | — |
| `diet_type`, `difficulty`, `cuisine` | ciąg spoza listy / nie-ciąg | `null` | `Odrzucono nieprawidłową wartość pola {pole} (nieznana wartość).` |
| `cuisine` | jawne `null` | `null` | — (dozwolone: brak pasującej kuchni) |
| `is_termorobot`, `is_grill` | `boolean` lub ciąg `"true"` / `"false"` (trim, case-insensitive) | `boolean` | — |
| `is_termorobot`, `is_grill` | inny typ (np. `1`, `"tak"`, obiekt) | `false` | `Odrzucono nieprawidłową wartość pola {pole}.` |
| dowolne pole | brak klucza; dla pól innych niż `cuisine` także jawne `null` | `null` (liczby/enumy) lub `false` (flagi) | jedno zbiorcze: `Niekompletne metadane przepisu — brak pól: {lista}.` |
| relacja czasów | `prep` i `total` niepuste oraz `total < prep` | `total = prep` | `Skorygowano czas całkowity: był krótszy niż czas przygotowania.` |

**Zasady:**

- Każde odrzucone pole → **osobne** ostrzeżenie; brakujące pola → **jedno** zbiorcze (kolejność pól wg `DRAFT_METADATA_KEYS`).
- Relacja czasów sprawdzana **po** walidacji pojedynczych pól; jeśli `prep` lub `total` jest `null` — relacja nie jest sprawdzana.
- Teksty ostrzeżeń są **stałe** — nie zawierają wartości zwróconych przez LLM (brak wstrzykiwania treści do UI).

---

## 6. Względy bezpieczeństwa

| Obszar | Ryzyko | Mitygacja |
|---|---|---|
| Uwierzytelnianie / autoryzacja | Dostęp bez JWT / niewłaściwa rola | Bez zmian: JWT weryfikowany w handlerze, rola z `app_metadata.app_role` (nigdy z body), role `user`/`premium`/`admin` |
| Nadużycie kosztów | Wielokrotne wywołania LLM | Bez zmian: rate limit, rezerwacja kredytu przed wywołaniem, limit tekstu 50 000 znaków i obrazu 10 MB. Funkcja nie dodaje wywołań LLM |
| Prompt injection (treść wklejona przez użytkownika instruuje model, np. „ustaw `diet_type` na VEGAN”) | Zafałszowanie własnych metadanych | Wpływ ograniczony do draftu użytkownika, który i tak weryfikuje formularz przed zapisem; wyjście ograniczone allowlistami enumów i zakresów; draft nie jest zapisywany |
| Niezaufane wyjście LLM | Wartości spoza kontraktu trafiają do formularza/bazy | Ścisła allowlista enumów, twarde zakresy liczb, koercja typów — wszystko w `normalizeDraftMetadata`; zapis przepisu i tak przechodzi walidację `POST /recipes` oraz ograniczenia DB |
| Wstrzyknięcie treści przez `meta.warnings` | XSS / mylące komunikaty | Ostrzeżenia backendowe mają stałe teksty. Dodatkowo (zalecane): ograniczyć ostrzeżenia z LLM do maks. 20 pozycji po maks. 300 znaków (ucięcie przy łączeniu) |
| Wyciek danych w logach | Zapis treści przepisu/obrazu | Logować tylko metadane (`userId`, liczba ostrzeżeń, nazwy odrzuconych pól); nie logować pełnych odpowiedzi LLM poza istniejącymi logami błędów (ucięte do 500 znaków) |
| RLS / baza | — | Funkcja nie czyta ani nie zapisuje danych w bazie (poza rozliczeniem kredytów, bez zmian) |
| Sekrety | Klucz OpenAI | Bez zmian: `OPENAI_API_KEY` z env, nigdy w odpowiedzi |

---

## 7. Obsługa błędów

Zasada naczelna: **błąd pojedynczego pola metadanych ≠ błąd odpowiedzi.** Wszystkie przypadki poniżej kończą się `200 OK`, kredyt `draft` jest zużywany jak dla poprawnego importu.

| Scenariusz (US) | Zachowanie | Status | Kredyt |
|---|---|---|---|
| Komplet poprawnych metadanych (1, 4, 6) | Przekazane bez zmian, `warnings` puste | `200` | zużyty |
| Część pól wywnioskowana / `null` (2, 3, 5) | Normalizacja bez ostrzeżeń dla poprawnych wartości | `200` | zużyty |
| `cuisine: null` (10) | `null`, bez ostrzeżenia | `200` | zużyty |
| `total < prep` (11) | `total = prep` + ostrzeżenie o korekcie | `200` | zużyty |
| `servings = 150`, `total = 4320`, `cuisine = "UNKNOWN_CUISINE"` (12) | `null` + osobne ostrzeżenie dla każdego pola | `200` | zużyty |
| LLM pominął część/wszystkie nowe pola (13) | `null` / `false` + zbiorcze „Niekompletne metadane…” | `200` | zużyty |
| Treść nie jest przepisem (14) | `{ success: false }` → brak metadanych | `422` | **zwrócony** |
| Ciąg liczb `"90"`, enum `"italian"` (8) | Koercja do `90` / `ITALIAN` | `200` | zużyty |
| Wyczerpana pula kredytów (15) | `AI_CREDITS_EXHAUSTED` przed wywołaniem LLM | `402` | — |
| Timeout / błąd OpenAI / nieparsowalny JSON | `ApplicationError` → refund | `500` / `429` | **zwrócony** |
| Błąd w treści draftu (brak nazwy/składników/kroków) | Istniejąca ścieżka `422` z listą powodów | `422` | **zwrócony** |
| Ucięty JSON (zbyt mały `MAX_TOKENS`) | `callOpenAI` → `INTERNAL_ERROR` → refund | `500` | **zwrócony** |

Nieoczekiwany wyjątek w `normalizeDraftMetadata` jest wykluczony przez projekt (funkcja czysta, bez rzucania). Jako zabezpieczenie zalecane jest owinięcie wywołania w `try/catch` w `generateRecipeDraft`: przy awarii zwrócić metadane domyślne (`null`/`false`) + ostrzeżenie „Niekompletne metadane przepisu” i zalogować `logger.error` — zamiast 500.

---

## 8. Rozważania dotyczące wydajności

- **Brak dodatkowych wywołań LLM i zapytań do bazy** — normalizacja to O(1) operacji w pamięci; narzut pomijalny.
- **Rozmiar odpowiedzi LLM:** 8 pól to ok. 100 tokenów. `MAX_TOKENS = 2000` obejmuje także `scratchpad` — **zweryfikować w trakcie implementacji** na długich przepisach i obrazach; przy objawach ucięcia JSON podnieść limit (np. do 2500) jako jedyną zmianę parametrów.
- **Dłuższy prompt systemowy** (sekcja metadanych ok. 600–800 tokenów wejściowych) — nieznaczny wzrost kosztu i czasu; `API_TIMEOUT_MS = 30 000` bez zmian.
- **Jakość wnioskowania z samego zdjęcia dania** jest mniejsza — mitigacja w prompcie (obniżanie `meta.confidence`) oraz ręczny test jakości przed wdrożeniem na kilku przykładach.
- **Konflikt z PS-34** (ten sam prompt): sekcja metadanych w osobnym module, minimalna ingerencja w `ai.service.ts` (patrz krok 4).

---

## 9. Etapy wdrożenia

### Krok 1. Moduł `ai-draft-metadata.ts`

1. Utworzyć `supabase/functions/ai/ai-draft-metadata.ts` ze stałymi (`DIET_TYPES`, `DIFFICULTIES`, `CUISINES`, zakresy, `DRAFT_METADATA_KEYS`), ścisłym `AiRecipeDraftMetadataSchema` i typami (sekcja 3.1).
2. Zaimplementować helpery prywatne: `coerceInteger(value, min, max)` (liczba/ciąg → `number | null`), `coerceEnum(value, allowed)`, `coerceBoolean(value)`, `hasOwn(obj, key)`.
3. Zaimplementować `normalizeDraftMetadata(raw)` wg tabeli reguł (sekcja 5) — guard clauses i wczesne zwroty, 4 spacje wcięcia, bez efektów ubocznych.
4. Zaimplementować `getMetadataPromptSection()` zwracającą sekcję `8. METADANE PRZEPISU` (treść w kroku 4), budowaną z `DIET_TYPES`/`CUISINES`/`DIFFICULTIES` (wartości w promptcie z jednego źródła prawdy).

### Krok 2. Typy backendu (`ai.types.ts`)

1. Wydzielić `AiRecipeDraftContentSchema` (dotychczasowe 7 pól), `AiRecipeDraftOutputSchema` zdefiniować jako `.extend({...})` z 8 polami `z.unknown().optional()`.
2. Zmienić `AiRecipeDraftDto` na `AiRecipeDraftContentDto & AiRecipeDraftMetadata`; dodać `AiRecipeDraftContentDto`.
3. Zaktualizować importy/sygnatury w `ai.service.ts` (`normalizeDraft`, `validateDraftContent` → `AiRecipeDraftContentDto`).
4. Zweryfikować `deno check supabase/functions/ai/index.ts`.

### Krok 3. Kontrakt współdzielony

1. Rozszerzyć `AiRecipeDraftDto` w `shared/contracts/types.ts` (sekcja 3.3).
2. Zidentyfikować miejsca użycia po stronie frontendu (`src/app/pages/recipes/services/recipe-draft-state.service.ts`, `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts` oraz specyfikacje i mocki) — pola są wymagane w DTO, więc literały/mocki wymagają uzupełnienia. Zakres zmian UI jest opisany w planie widoków PS-91 (`PS-91-ai-draft-recipe-metadata-ui-plan.md`); w tym kroku zadbać wyłącznie o kompilację kontraktu.

### Krok 4. Prompt (`ai.service.ts`)

Minimalna ingerencja w istniejący prompt (uwaga na PS-34):

1. Wyeksportować `getSystemPrompt` oraz `getImageExtractionPrompt` (potrzebne do testu scenariusza 16).
2. Poprawić podwójną numerację: obecnie kategoria i tagi mają numer `6` → kategoria `6`, tagi `7`.
3. Po sekcji tagów dokleić `${getMetadataPromptSection()}` (jako sekcja `8`). Sekcja musi zawierać:
    - listę ośmiu pól: `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill`;
    - regułę priorytetu: „Wartość jawnie podana w tekście lub na obrazie MA ZAWSZE pierwszeństwo przed Twoim szacunkiem. Jeśli wartości nie ma w źródle — wywnioskuj ją na podstawie całego przepisu (nazwa, składniki, kroki).”;
    - dozwolone wartości `diet_type` (3), `difficulty` (3), `cuisine` (25) wpisane dosłownie;
    - zasady liczb: czasy w minutach (liczby całkowite; „1 godz. 30 min” → 90), czas całkowity obejmuje czas bierny (marynowanie, wyrastanie, chłodzenie), porcje 1–99, przedział porcji („4–6”) → dolna granica, `total_time_minutes ≥ prep_time_minutes`;
    - `cuisine = null`, jeśli żadna z dozwolonych nie pasuje;
    - zasady flag: `is_termorobot = true` przy Thermomix/Termorobot/Bimby/Cookeo lub krokach typu „5 min / 100°C / obroty 1”, inaczej `false`; `is_grill = true` przy grillu/grillowaniu/barbecue/rożnie/ruszcie ogrodowym, sama funkcja „grill” w piekarniku nie wystarcza (ocena kontekstu), inaczej `false`;
    - obraz bez tekstu: wszystkie metadane wnioskowane ze zdjęcia, flagi `true` tylko przy wyraźnych przesłankach (np. widoczne grillowane mięso), przy wnioskowaniu bez tekstu obniżyć `meta.confidence`;
    - wymóg zwrócenia wartości dla każdego pola (wyjątki: `cuisine = null`, flagi `false`).
4. Rozszerzyć format odpowiedzi JSON w prompcie o 8 pól (przykład w specyfikacji API) oraz sekcję „UWAGA O POLACH” — 8 pól jako „zawsze obecne” (wartość lub `null`/`false`).
5. Dopisać do `<scratchpad>` punkt: „Jakie metadane są jawnie podane, a jakie muszę wywnioskować?”.
6. W `getImageExtractionPrompt()` dopisać: „Jeśli obraz zawiera metadane (porcje, czas, trudność), odczytaj je; w pozostałych przypadkach wywnioskuj je z całego obrazu.”
7. Sprawdzić, czy treść sekcji nie zawiera sekwencji psujących template literal (backticki, `${`).

### Krok 5. Integracja w `generateRecipeDraft`

1. Po `normalizeDraft(...)` zbudować `rawMetadata` z surowego `llmResponse.draft` (rozdzielenie „brak klucza” / „jawny `null`”), np. pomocnicza `extractRawMetadata(llmResponse)`.
2. Wywołać `normalizeDraftMetadata(rawMetadata)` (opcjonalnie w `try/catch` wg sekcji 7).
3. Złożyć `draft = { ...normalizedContent, ...metadata }` oraz `warnings = dedupe([...llmWarnings, ...metadataWarnings])` (najpierw z LLM; opcjonalnie przycięte do 20 pozycji po 300 znaków).
4. Zalogować `logger.warn` z liczbą i nazwami odrzuconych pól (bez wartości źródłowych).
5. `confidence` pozostaje bez zmian (`successResponse.meta?.confidence ?? 0.8`).

### Krok 6. Handler (`ai.handlers.ts`)

1. W logu `Recipe draft generated successfully` dodać `warningsCount` i flagi `hasServings` / `hasTimes` (bez wartości).
2. **Nie zmieniać** kolejności: `checkAndDeductCredits` → `generateRecipeDraft` → refund przy wyjątku/`success: false` → `deductCreditAfterSuccess`. Błędy metadanych nie wywołują refundu.

### Krok 7. Testy jednostkowe (Deno)

Wyłącznie testy jednostkowe — bez E2E i bez wywołań prawdziwego LLM (wynik niedeterministyczny; testy weryfikują kontrakt na mockowanych odpowiedziach).

**`ai-draft-metadata.test.ts` (nowy)** — `normalizeDraftMetadata` + prompt:

| Scenariusz | Test |
|---|---|
| 1, 4, 6 | Komplet poprawnych wartości (6 / 20 / 75 / `VEGETARIAN` / `ITALIAN` / `EASY` / `true` / `false`) przechodzi bez zmian, `warnings` puste; `is_grill = true` i `is_termorobot = true` zachowane |
| 2, 3, 5 | Część pól `null` + wartości wnioskowane w zakresach → brak błędu; `cuisine` z listy lub `null` |
| 7 | Poprawny `diet_type` nie jest zmieniany (priorytet źródła realizowany w prompcie — patrz scenariusz 16) |
| 8 | `90` i `4` bez zmian; `"90"` → `90`; `"4–6"` → `null` + ostrzeżenie |
| 10 | `cuisine: null` → `null`, brak ostrzeżenia |
| 11 | `prep = 60`, `total = 40` → `total = 60` + ostrzeżenie o korekcie |
| 12 | `servings = 150`, `total_time_minutes = 4320`, `cuisine = "UNKNOWN_CUISINE"` → `null` + po jednym ostrzeżeniu na pole |
| 13 | Brak części/wszystkich kluczy → `null`/`false` + jedno zbiorcze „Niekompletne metadane…” z listą pól; brak wyjątku |
| Brzegowe | Zakresy: `0, 1, 99, 100, 999, 1000`, liczby ujemne, ułamki, `NaN`, `Infinity`, ciągi nienumeryczne; enumy w różnej wielkości liter (`"italian"` → `ITALIAN`); flagi `"true"`/`"false"`/`1`/`"tak"`; jawny `null` dla pól innych niż `cuisine` → traktowany jako brak; odrzucone `total` → brak korekty relacji; `prep = null` → brak sprawdzania relacji; funkcja nie mutuje wejścia |
| 16 | `getSystemPrompt('pl')` zawiera: nazwy 8 pól, regułę priorytetu źródeł, wartości enumów (m.in. `VEGETARIAN`, `HARD`, `VIETNAMESE`), zasady Termorobot/Grill, wymóg minut i `total ≥ prep`, rozszerzony format JSON z nowymi polami; `getImageExtractionPrompt()` zawiera wzmiankę o metadanych |

**`ai.service.test.ts` (nowy)** — `generateRecipeDraft` z mockiem `globalThis.fetch` i `Deno.env.set('OPENAI_API_KEY', 'test')`:

| Scenariusz | Test |
|---|---|
| 1, 4 | Mock zwraca komplet → `result.data.draft` zawiera metadane, `meta.warnings` puste |
| 11, 12, 13 | Mock z błędnymi/brakującymi polami → `success: true`, skorygowane wartości, ostrzeżenia połączone z ostrzeżeniami LLM i zdeduplikowane (kolejność: LLM → backend) |
| 14 | Mock `is_valid_recipe: false` → `success: false`, brak pól metadanych |
| — | Mock bez żadnego z 8 pól → brak błędu schematu (nie 500) |
| — | `confidence` nie jest modyfikowane |
| — | Treść draftu (nazwa/tagi/tips) normalizowana jak dotąd |

**`ai.types.test.ts` (rozszerzenie)** — `AiRecipeDraftLlmResponseSchema` akceptuje draft z dowolnymi wartościami w 8 polach (w tym `"UNKNOWN"`, `150`, `null`) i bez nich; nadal odrzuca draft bez `name`/`ingredients_raw`/`steps_raw`.

**Scenariusz 15 (kredyty/uprawnienia):** istniejące `ai-credits.service.test.ts` muszą przechodzić bez zmian; dodatkowo (jeśli handler jest testowalny z mockami) test: poprawny import z ostrzeżeniami metadanych nie wywołuje `refundCreditAfterFailure`.

Uruchomienie: `deno test supabase/functions/ai/` oraz `deno check supabase/functions/ai/index.ts`.

### Krok 8. Test ręczny lokalnie

1. `supabase functions serve ai` → `http://localhost:54331/functions/v1/ai/recipes/draft` (użytkownik testowy z `backend.mdc`).
2. Przypadki z `test-requests.http`: tekst z kompletem metadanych, tekst bez metadanych (pierogi ruskie), tekst z „Thermomix” + „grill”, obraz ze zrzutem przepisu, obraz gotowego dania bez tekstu.
3. Sprawdzić: obecność 8 pól, zakresy, `cuisine` z listy lub `null`, `meta.confidence` niższe dla zdjęcia bez tekstu, brak ucięcia JSON (`MAX_TOKENS`), saldo kredytów zmniejszone o dokładnie 1.

### Krok 9. Dokumentacja

1. `docs/results/main-project-docs/009 API plan.md` — kontrakt `POST /ai/recipes/draft`: nowe pola `draft`, nowe ostrzeżenia w `meta.warnings`.
2. `supabase/functions/ai/test-requests.http` — przykłady: tekst z metadanymi, bez metadanych, obraz.
3. `supabase/functions/ai/TESTING_TIPS.md` — uwagi o weryfikacji metadanych w odpowiedzi.
4. `docs/results/project-summary.md` — opis US-036 i wiersz `POST /ai/recipes/draft` (metadane draftu).

### Krok 10. Wdrożenie i kolejność względem innych zmian

1. **Backend przed frontendem.** Zmiana jest addytywna, więc stary frontend ignoruje nowe pola; nowy frontend powinien tolerować ich brak (`?? null` / `?? false`) na czas okna wdrożenia.
2. **PS-34** modyfikuje ten sam prompt — wdrożyć PS-91 pierwszy (sekcja w osobnym pliku + minimalna zmiana `ai.service.ts`), następnie PS-34 z rebase. Jeśli PS-34 trafi pierwsze: doklejenie `getMetadataPromptSection()` i rozszerzenie formatu JSON.
3. Deploy funkcji: `supabase functions deploy ai`; smoke test na środowisku dev (jeden import tekstowy i jeden z obrazu), potem produkcja.
4. Code review i potwierdzenie braku zmian w schemacie bazy danych.
