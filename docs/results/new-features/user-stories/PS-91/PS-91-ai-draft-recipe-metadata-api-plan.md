# PS-91: Uzupełnianie metadanych przepisu przez AI podczas importu z tekstu lub obrazu — Plan API

> **User Story:** PS-91 — Uzupełnianie metadanych przepisu przez AI podczas importu z tekstu lub obrazu
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Functions (funkcja `ai`), kontrakty współdzielone (`shared/contracts/types.ts`)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `POST /ai/recipes/draft` | Modyfikacja istniejącego endpointu | Obiekt `draft` w odpowiedzi zawiera 8 nowych pól metadanych |
| Prompt systemowy (`getSystemPrompt`) | Modyfikacja | Nowa sekcja reguł odczytu i wnioskowania metadanych (wydzielona do osobnego modułu) |
| Prompt użytkownika dla obrazu (`getImageExtractionPrompt`) | Modyfikacja | Wzmianka o wnioskowaniu metadanych ze zdjęcia gotowego dania |
| Moduł `ai-draft-metadata.ts` | Nowy plik | Stałe enumów, sekcja promptu, tolerancyjna normalizacja metadanych |
| `AiRecipeDraftLlmResponseSchema` (`ai.types.ts`) | Modyfikacja | Tolerancyjny wariant schematu dla nowych pól (osobny od ścisłego DTO) |
| `AiRecipeDraftDto` (`ai.types.ts`, `shared/contracts/types.ts`) | Modyfikacja | Nowe pola metadanych w DTO odpowiedzi |
| `meta.warnings` | Rozszerzenie zawartości | Dodatkowe ostrzeżenia generowane przez backend (korekty i odrzucone pola) |

**Bez zmian:**

- `output_format` pozostaje `pycha_recipe_draft_v1` (zmiana jest addytywna).
- Schemat żądania (`AiRecipeDraftRequestSchema`) — żądanie się nie zmienia.
- Baza danych — brak migracji (kolumny `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill` istnieją w tabeli `recipes`).
- Kredyty AI (PS-64): jedno wywołanie LLM i jeden kredyt `draft` na import; rezerwacja i zwrot bez zmian.
- Uprawnienia: endpoint nadal przyjmuje role `user`/`premium`/`admin`, rate limit bez zmian.
- Pozostałe endpointy modułu `ai` (`/ai/credits`, `/ai/recipes/image`, `/ai/recipes/normalized-ingredients`) nie wymagają zmian.
- Parametry wywołania LLM: model `gpt-4o-mini`, `response_format: json_object`, jedno wywołanie (patrz sekcja 7).

---

## 2. Zmodyfikowany endpoint `POST /ai/recipes/draft`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | Bearer JWT (wymagane), role `user`/`premium`/`admin` |
| Zmiany | Rozszerzenie obiektu `draft` w odpowiedzi `200` o 8 pól metadanych |

### Żądanie (bez zmian)

```json
{
    "source": "text",
    "text": "Pierogi ruskie ...",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

Wariant `source: "image"` (`image.mime_type`, `image.data_base64`) również bez zmian.

### Nowe pola w `draft` (odpowiedź `200 OK`)

| Pole | Typ | Zakres / dozwolone wartości | Wartość przy braku danych |
|---|---|---|---|
| `servings` | `integer \| null` | 1–99 | `null` |
| `prep_time_minutes` | `integer \| null` | 0–999 (minuty) | `null` |
| `total_time_minutes` | `integer \| null` | 0–999 (minuty), `≥ prep_time_minutes` | `null` |
| `diet_type` | `string \| null` | `MEAT`, `VEGETARIAN`, `VEGAN` | `null` |
| `cuisine` | `string \| null` | 25 wartości (lista niżej) lub `null` | `null` |
| `difficulty` | `string \| null` | `EASY`, `MEDIUM`, `HARD` | `null` |
| `is_termorobot` | `boolean` | `true` / `false` | `false` |
| `is_grill` | `boolean` | `true` / `false` | `false` |

Dozwolone wartości `cuisine`: `POLISH`, `ASIAN`, `MEXICAN`, `MIDDLE_EASTERN`, `AFRICAN`, `AMERICAN`, `BALKAN`, `BRAZILIAN`, `BRITISH`, `CARIBBEAN`, `CHINESE`, `FRENCH`, `GERMAN`, `GREEK`, `INDIAN`, `ITALIAN`, `JAPANESE`, `KOREAN`, `MEDITERRANEAN`, `RUSSIAN`, `SCANDINAVIAN`, `SPANISH`, `THAI`, `TURKISH`, `VIETNAMESE`.

> Nazwy pól i enumy są zgodne z kolumnami tabeli `recipes` i typami `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty` z `shared/contracts/types.ts`.

### Przykładowa odpowiedź `200 OK`

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
    "meta": {
        "confidence": 0.92,
        "warnings": []
    }
}
```

### Przykład z korektami (`meta.warnings`)

LLM zwrócił `prep_time_minutes = 60`, `total_time_minutes = 40`, `servings = 150`, `cuisine = "UNKNOWN_CUISINE"`:

```json
{
    "draft": {
        "...": "...",
        "servings": null,
        "prep_time_minutes": 60,
        "total_time_minutes": 60,
        "diet_type": "MEAT",
        "cuisine": null,
        "difficulty": "MEDIUM",
        "is_termorobot": false,
        "is_grill": false
    },
    "meta": {
        "confidence": 0.8,
        "warnings": [
            "Skorygowano czas całkowity: był krótszy niż czas przygotowania.",
            "Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).",
            "Odrzucono nieprawidłową wartość pola cuisine (nieznana kuchnia)."
        ]
    }
}
```

### Kody odpowiedzi

Zestaw kodów statusu jest bez zmian. Nieprawidłowe lub brakujące metadane **nigdy** nie powodują błędu odpowiedzi.

| Kod HTTP | Sytuacja | Zmiana |
|---|---|---|
| `200 OK` | Draft wygenerowany (także z odrzuconymi/skorygowanymi/brakującymi metadanymi) | Rozszerzona zawartość `draft` |
| `400 Bad Request` | Niepoprawne żądanie | Bez zmian |
| `401 Unauthorized` | Brak/nieważny JWT | Bez zmian |
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | Bez zmian |
| `422 Unprocessable Entity` | Treść nie jest pojedynczym przepisem — odpowiedź bez pól metadanych, kredyt zwrócony | Bez zmian |
| `429 Too Many Requests` | Rate limit | Bez zmian |
| `500` / `502` / `504` | Błąd modelu / konfiguracji / timeout, kredyt zwrócony | Bez zmian |

---

## 3. Zmiana promptu systemowego

### Struktura (rekomendacja: oddzielenie od części opisowej)

Reguły metadanych trafiają do **osobnej stałej/funkcji** `getMetadataPromptSection()` w nowym module `supabase/functions/ai/ai-draft-metadata.ts`, doklejanej w `getSystemPrompt()` w `ai.service.ts`. Dzięki temu PS-34 (poprawa generowania opisu) może zmieniać sekcję „OPIS” bez konfliktów merge z PS-91.

> **Kolejność wdrożenia względem PS-34:** PS-91 i PS-34 modyfikują ten sam prompt. Zalecane wdrożenie najpierw PS-91 (nowa sekcja w osobnym pliku + minimalna ingerencja w `ai.service.ts`), następnie PS-34 z rebase. Jeśli PS-34 trafi pierwsze, PS-91 wymaga tylko doklejenia wywołania `getMetadataPromptSection()` i rozszerzenia formatu JSON.

### Nowa sekcja promptu (treść merytoryczna)

Sekcja `8. METADANE PRZEPISU` (po sekcji tagów; w obecnym prompcie dwie sekcje — kategoria i tagi — mają numer 6, więc przy okazji poprawić je na 6 i 7) musi zawierać:

1. **Listę ośmiu pól:** `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill`.
2. **Regułę priorytetu źródeł:** „Wartość jawnie podana w tekście lub na obrazie MA ZAWSZE pierwszeństwo przed Twoim szacunkiem. Jeśli wartości nie ma w źródle — wywnioskuj ją na podstawie całego przepisu (nazwa, składniki, kroki).”
3. **Dozwolone wartości enumów:** `diet_type` (3), `difficulty` (3), `cuisine` (25) — wpisane dosłownie w prompt.
4. **Zasady dla liczb:** czasy w minutach (liczby całkowite; „1 godz. 30 min” → 90); czas całkowity obejmuje czas bierny (marynowanie, wyrastanie, chłodzenie), jeśli jest podany lub wynika z kroków; porcje 1–99; przedział porcji („4–6”) → dolna granica; `total_time_minutes ≥ prep_time_minutes`.
5. **Zasady dla `cuisine`:** `null`, jeśli żadna z dozwolonych nie pasuje.
6. **Zasady dla flag:**
    - `is_termorobot = true`, gdy tekst wspomina o Thermomix, Termorobocie, Bimby, Cookeo lub podobnym urządzeniu albo kroki wymagają czynności typowych dla termorobota (np. „5 min / 100°C / obroty 1”); w pozostałych przypadkach `false`;
    - `is_grill = true`, gdy tekst mówi o grillu, grillowaniu, barbecue lub rożnie/ruszcie ogrodowym; sama funkcja „grill” w piekarniku nie wystarcza (ocena kontekstu); w pozostałych przypadkach `false`.
7. **Zasady dla obrazu bez tekstu:** wszystkie metadane wnioskowane ze zdjęcia dania; flagi `true` tylko przy wyraźnych przesłankach (np. widoczne grillowane mięso → `is_grill = true`); przy wnioskowaniu bez tekstu obniżyć `meta.confidence`.
8. **Zwracanie wartości dla każdego pola** (pełne uzupełnienie) — wyjątki: `cuisine = null`, flagi `false`.

### Rozszerzony format odpowiedzi JSON w prompcie

```json
{
    "is_valid_recipe": true,
    "draft": {
        "name": "...",
        "description": "...",
        "ingredients_raw": "...",
        "steps_raw": "...",
        "tips_raw": "...",
        "category_name": "Obiad",
        "tags": ["tag1"],
        "servings": 4,
        "prep_time_minutes": 20,
        "total_time_minutes": 60,
        "diet_type": "VEGETARIAN",
        "cuisine": "ITALIAN",
        "difficulty": "EASY",
        "is_termorobot": false,
        "is_grill": false
    },
    "meta": { "confidence": 0.9, "warnings": [] }
}
```

Sekcja „UWAGA O POLACH” uzupełniona o 8 nowych pól jako „zawsze obecne” (wartość lub `null`/`false`). Punkty scratchpada rozszerzone o: „Jakie metadane są jawnie podane, a jakie muszę wywnioskować?”.

### Prompt użytkownika dla obrazu

`getImageExtractionPrompt()` — dopisać: „Jeśli obraz zawiera metadane (porcje, czas, trudność), odczytaj je; w pozostałych przypadkach wywnioskuj je z całego obrazu.”

---

## 4. Walidacja i normalizacja odpowiedzi LLM

### Problem

`AiRecipeDraftLlmResponseSchema` jest ścisłym schematem Zod — błąd typu pojedynczego pola (np. `cuisine: "UNKNOWN"` w `z.enum`) skutkowałby `safeParse` failure i `500 INTERNAL_ERROR` z utratą całego draftu, czego wymaga uniknąć historyjka (scenariusze 11–13).

### Rozwiązanie: tolerancyjna normalizacja per pole

**Schematy (`ai.types.ts`):**

- Schemat odpowiedzi LLM (`AiRecipeDraftLlmResponseSchema`) przyjmuje 8 nowych pól jako `z.unknown().optional()` (surowe wartości z LLM, bez ścisłej walidacji typu). Pozostałe pola draftu walidowane jak dotąd.
- Ścisły typ wyjściowy (`AiRecipeDraftDto`) zawiera pola już znormalizowane:

```typescript
export const AiRecipeDraftMetadataSchema = z.object({
    servings: z.number().int().min(1).max(99).nullable(),
    prep_time_minutes: z.number().int().min(0).max(999).nullable(),
    total_time_minutes: z.number().int().min(0).max(999).nullable(),
    diet_type: z.enum(DIET_TYPES).nullable(),
    cuisine: z.enum(CUISINES).nullable(),
    difficulty: z.enum(DIFFICULTIES).nullable(),
    is_termorobot: z.boolean(),
    is_grill: z.boolean(),
});
```

**Moduł `supabase/functions/ai/ai-draft-metadata.ts` (nowy):**

| Eksport | Opis |
|---|---|
| `DIET_TYPES`, `DIFFICULTIES`, `CUISINES` | Stałe tablice dozwolonych wartości (zgodne z enumami bazy) |
| `getMetadataPromptSection()` | Tekst sekcji promptu (sekcja 3) |
| `normalizeDraftMetadata(raw)` | Funkcja czysta: `(raw: Record<string, unknown>) → { metadata: AiRecipeDraftMetadata; warnings: string[] }` |

### Reguły `normalizeDraftMetadata`

Funkcja nie rzuca wyjątków i nie ma efektów ubocznych.

| Pole | Wejście | Wynik | Ostrzeżenie |
|---|---|---|---|
| `servings` | liczba lub ciąg cyfr, po zaokrągleniu 1–99 | wartość całkowita | — |
| `servings` | poza zakresem, nie-liczba | `null` | „Odrzucono nieprawidłową wartość pola servings (poza zakresem 1–99).” |
| `prep_time_minutes`, `total_time_minutes` | liczba/ciąg cyfr 0–999 | wartość całkowita | — |
| `prep_time_minutes`, `total_time_minutes` | poza zakresem, nie-liczba | `null` | „Odrzucono nieprawidłową wartość pola {pole} (poza zakresem 0–999).” |
| `diet_type`, `difficulty`, `cuisine` | ciąg (trim, `toUpperCase`) należy do listy | wartość | — |
| `diet_type`, `difficulty`, `cuisine` | spoza listy / nie-ciąg | `null` | „Odrzucono nieprawidłową wartość pola {pole} (nieznana wartość).” |
| `cuisine` | jawne `null` | `null` | — (wartość dozwolona: brak pasującej kuchni) |
| `is_termorobot`, `is_grill` | `boolean` (lub ciąg `"true"`/`"false"`) | wartość | — |
| `is_termorobot`, `is_grill` | inny typ | `false` | „Odrzucono nieprawidłową wartość pola {pole}.” |
| dowolne pole | brak klucza w odpowiedzi LLM (`undefined`), a dla pól innych niż `cuisine` także jawne `null` | `null` (liczby/enumy) lub `false` (flagi) | jedno zbiorcze: „Niekompletne metadane przepisu — brak pól: {lista}.” |
| relacja czasów | `total < prep` (oba niepuste) | `total = prep` | „Skorygowano czas całkowity: był krótszy niż czas przygotowania.” |

**Kluczowe zasady:**

- Brak klucza w odpowiedzi LLM jest **odróżniany** od jawnego `null` (`cuisine: null` nie generuje ostrzeżenia).
- Każde odrzucone pole generuje **osobne** ostrzeżenie; brakujące pola — jedno zbiorcze.
- Normalizacja relacji czasów wykonywana **po** walidacji pojedynczych pól (np. odrzucone `total` → `null`, bez korekty relacji).
- Gdy `prep_time_minutes` jest `null`, relacja nie jest sprawdzana.
- Backend **nie** rozróżnia pól odczytanych od wywnioskowanych i nie eksponuje tej informacji.

### Integracja w `generateRecipeDraft` (`ai.service.ts`)

```
callOpenAI → odpowiedź LLM
→ (is_valid_recipe === false) → bez zmian (422 + zwrot kredytu, brak pól metadanych)
→ safeParse(AiRecipeDraftLlmResponseSchema)   // 8 nowych pól jako unknown
→ validateDraftContent(draft)                  // bez zmian
→ normalizeDraft(draft)                        // bez zmian (nazwa, tagi, tips...)
→ normalizeDraftMetadata(rawMetadataFromDraft) // NOWE: { metadata, warnings }
→ draft  = { ...normalizedDraft, ...metadata }
→ meta   = { confidence, warnings: dedupe([...llmWarnings, ...metadataWarnings]) }
→ 200 OK
```

- Ostrzeżenia z LLM i backendu są łączone i deduplikowane (kolejność: najpierw z LLM).
- `meta.confidence` nie jest modyfikowane przez backend (obniżanie przy wnioskowaniu z obrazu realizuje prompt).
- Błędy walidacji metadanych **nie** powodują zwrotu kredytu — kredyt zwracany jest wyłącznie w dotychczasowych przypadkach (`422`, błąd modelu/infrastruktury).

---

## 5. Kontrakty współdzielone

### `shared/contracts/types.ts` — `AiRecipeDraftDto`

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

- Typy `RecipeDietType`, `RecipeCuisine`, `RecipeDifficulty` istnieją w tym pliku.
- Backend utrzymuje własny typ w `ai.types.ts` (zgodnie z konwencją funkcji Supabase — brak importu z `shared/`), zsynchronizowany z powyższym kontraktem.

---

## 6. Testy jednostkowe (backend, Deno)

Zakres: wyłącznie testy jednostkowe (bez E2E i bez wywołań prawdziwego LLM). Wynik LLM jest niedeterministyczny, więc testy weryfikują kontrakt (schemat, normalizację, mapowanie, obecność reguł w prompcie) na mockowanej odpowiedzi.

**Pliki:**

- `supabase/functions/ai/ai-draft-metadata.test.ts` (nowy) — normalizacja i prompt,
- `supabase/functions/ai/ai.types.test.ts` (rozszerzenie) — schemat odpowiedzi LLM,
- `supabase/functions/ai/ai.service.test.ts` (nowy, mock `fetch`/OpenAI) — integracja `generateRecipeDraft` na mockowanej odpowiedzi LLM; wymaga eksportu `getSystemPrompt` (test scenariusza 16).

| Scenariusz | Test |
|---|---|
| 1, 4 | Mock LLM zwraca komplet metadanych → `draft` zawiera je bez zmian (np. 6 / 20 / 75 / `VEGETARIAN` / `ITALIAN` / `EASY` / `true` / `false`), `warnings` puste |
| 2, 3, 5 | Mock LLM zwraca wartości wnioskowane (część `null`) → wartości w zakresach, `cuisine` z listy lub `null`; brak błędu |
| 6 | `is_grill = true`, `is_termorobot = true` przechodzą bez zmian |
| 7 | Normalizacja nie zmienia poprawnej wartości `diet_type` (priorytet źródła realizowany w prompcie — test na obecność reguły) |
| 8 | Wartości całkowite 90 i 4 przechodzą bez zmian; ciąg `"90"` jest koercowany do 90; przedział porcji obsługiwany w prompcie (test treści promptu) |
| 10 | `cuisine: null` → `null`, brak ostrzeżenia |
| 11 | `prep = 60`, `total = 40` → `total = 60`, ostrzeżenie o korekcie |
| 12 | `servings = 150`, `total_time_minutes = 4320`, `cuisine = "UNKNOWN_CUISINE"` → `null` + po jednym ostrzeżeniu na pole, status sukcesu |
| 13 | Brak części/wszystkich pól → `null`/`false`, ostrzeżenie „Niekompletne metadane…”, brak błędu schematu |
| 14 | Odpowiedź `is_valid_recipe: false` → wynik `success: false`, brak pól metadanych (zachowanie bez zmian) |
| 15 | Istniejące testy kredytów (`ai-credits.service.test.ts`) przechodzą bez zmian; test handlera: błąd metadanych nie wywołuje zwrotu kredytu |
| 16 | `getSystemPrompt()` zawiera: nazwy 8 pól, regułę priorytetu źródeł, wartości enumów (`VEGETARIAN`, `HARD`, `VIETNAMESE`, …), zasady Termorobot/Grill, wymóg minut i `total ≥ prep`, rozszerzony format JSON z nowymi polami |

Dodatkowo: testy graniczne zakresów (0, 1, 99, 100, 999, 1000, liczby ujemne, ułamki, `NaN`, ciągi nienumeryczne), różna wielkość liter enumów (`"italian"` → `ITALIAN`).

---

## 7. Parametry LLM i ryzyka

| Parametr | Stan | Decyzja |
|---|---|---|
| Model | `gpt-4o-mini` | Bez zmian |
| `response_format` | `json_object` | Bez zmian (bez structured outputs) |
| `MAX_TOKENS` | `2000` | Zweryfikować w trakcie implementacji — 8 dodatkowych pól to ok. 100 tokenów, ale odpowiedź zawiera także `scratchpad`; przy objawach ucięcia JSON-a rozważyć podniesienie limitu jako jedyną zmianę parametrów |
| `API_TIMEOUT_MS` | `30 000` | Bez zmian (jedno wywołanie, niewielki przyrost odpowiedzi) |
| Liczba wywołań LLM | 1 | Bez zmian |

| Ryzyko | Mitygacja |
|---|---|
| Niska jakość wnioskowania z samego zdjęcia dania | Prompt nakazuje obniżać `meta.confidence`; użytkownik weryfikuje formularz przed zapisem; ręczny test jakości na kilku przykładach przed wdrożeniem |
| LLM nadpisuje jawne wartości własnym szacunkiem | Reguła priorytetu w prompcie (test treści promptu); backend nie jest w stanie tego zweryfikować |
| Konflikt zmian z PS-34 w prompcie | Osobny moduł dla sekcji metadanych; ustalona kolejność wdrożenia |
| Zbyt ścisła walidacja psuje cały draft | Tolerancyjna normalizacja per pole, schemat LLM z `z.unknown()` dla nowych pól |
| Wzrost długości odpowiedzi → ucięcie JSON | Weryfikacja `MAX_TOKENS` (patrz wyżej) |

---

## 8. Dokumentacja do aktualizacji

Wykonywane razem z kodem (nie są to kroki wdrożeniowe):

| Dokument | Zmiana |
|---|---|
| `docs/results/main-project-docs/009 API plan.md` | Kontrakt `POST /ai/recipes/draft`: nowe pola `draft`, nowe ostrzeżenia w `meta.warnings` |
| `supabase/functions/ai/test-requests.http` | Przykłady żądań dla tekstu z metadanymi, bez metadanych i obrazu |
| `supabase/functions/ai/TESTING_TIPS.md` | Uwagi o weryfikacji metadanych w odpowiedzi |
| `docs/results/project-summary.md` | Opis US-036 i wiersz `POST /ai/recipes/draft` — metadane draftu |
