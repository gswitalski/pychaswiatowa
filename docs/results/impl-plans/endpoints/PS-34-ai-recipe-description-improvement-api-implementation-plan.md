# API Endpoints Implementation Plan: PS-34 — Poprawa generowania opisu przepisu przez AI

## 1. Przegląd punktu końcowego

PS-34 **nie dodaje nowych endpointów** ani nie zmienia kontraktu API. Zakres implementacji ogranicza się wyłącznie do aktualizacji sekcji `2. OPIS:` w funkcji `getSystemPrompt()` w pliku `supabase/functions/ai/ai.service.ts`.

Istniejący endpoint `POST /ai/recipes/draft` pozostaje niezmieniony pod każdym innym względem — URL, autoryzacja, parametry żądania, schemat odpowiedzi, logika kredytów AI i obsługa błędów nie są dotknięte.

Jedyną obserwowalną różnicą dla klienta jest **treść** pola `description` w odpowiedzi — dłuższa (3–5 zdań zamiast 1–3), zawierająca element humorystyczny i jedną wplecioną ciekawostkę. Typ pola (`string | null`) i jego obecność w JSON pozostają bez zmian.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/ai/recipes/draft`
- **Parametry:**
  - **Wymagane:** `source` (`"text"` | `"image"`), `output_format` (`"pycha_recipe_draft_v1"`)
  - **Opcjonalne:** `text` (gdy `source = "text"`), `image` (gdy `source = "image"`), `language`
- **Request Body:** bez zmian względem obecnej specyfikacji

```json
// Wariant tekstowy
{
  "source": "text",
  "text": "Spaghetti Carbonara — makaron, guanciale, jajka...",
  "output_format": "pycha_recipe_draft_v1",
  "language": "pl"
}

// Wariant obrazkowy
{
  "source": "image",
  "image": {
    "mime_type": "image/jpeg",
    "data_base64": "<base64>"
  },
  "output_format": "pycha_recipe_draft_v1",
  "language": "pl"
}
```

---

## 3. Wykorzystywane typy

Żadne typy nie ulegają zmianie. Dla kontekstu — istotne typy z `shared/contracts/types.ts`:

```typescript
// Bez zmian — description nadal string | null
export interface AiRecipeDraftDto {
    name: string;
    description: string | null;
    ingredients_raw: string;
    steps_raw: string;
    tips_raw?: string;
    category_name: string | null;
    tags: string[];
    servings: number | null;
    prep_time_minutes: number | null;
    total_time_minutes: number | null;
    diet_type: RecipeDietType | null;
    cuisine: RecipeCuisine | null;
    difficulty: RecipeDifficulty | null;
    is_termorobot: boolean;
    is_grill: boolean;
}

export interface AiRecipeDraftResponseDto {
    draft: AiRecipeDraftDto;
    meta: AiRecipeDraftMetaDto;
}
```

**Pliki bez zmian:**
- `shared/contracts/types.ts` — kontrakt DTO bez zmian
- `supabase/functions/ai/ai.types.ts` — typy wewnętrzne bez zmian
- `supabase/functions/ai/ai-draft-metadata.ts` — metadane draftu poza zakresem
- Wszystkie pliki frontendu

---

## 4. Szczegóły odpowiedzi

Odpowiedź bez zmian strukturalnych. Pole `description` zmienia jedynie **treść**:

```json
// Przykładowa odpowiedź (HTTP 200)
{
  "draft": {
    "name": "Spaghetti Carbonara",
    "description": "Spaghetti carbonara to danie, które robi na gościach wrażenie absolutnej maestrii — dopóki nie wyjawi się im, że sekret tkwi w surowym żółtku wrzucanym w ostatniej chwili do gorącego makaronu. Przygotowanie zajmuje raptem 20 minut, ale ten moment mieszania wymaga nerwów chirurga i refleksu bramkarza jednocześnie. Nawiasem mówiąc, wbrew popularnej legendzie o węglarzach, danie najprawdopodobniej narodziło się w Rzymie dopiero w połowie XX wieku.",
    "ingredients_raw": "...",
    "steps_raw": "...",
    "category_name": "Obiad",
    "tags": ["włoskie", "szybkie"],
    "servings": 2,
    "prep_time_minutes": 10,
    "total_time_minutes": 20,
    "diet_type": "MEAT",
    "cuisine": "ITALIAN",
    "difficulty": "MEDIUM",
    "is_termorobot": false,
    "is_grill": false
  },
  "meta": {
    "confidence": 0.95,
    "warnings": []
  }
}
```

**Kody statusu (bez zmian):**

| Kod | Sytuacja |
|-----|----------|
| `200 OK` | Draft wygenerowany poprawnie |
| `402 AI_CREDITS_EXHAUSTED` | Wyczerpana pula kredytów `draft` |
| `422 Unprocessable Entity` | Treść wejściowa nie zawiera przepisu |
| `429 Too Many Requests` | Rate limit OpenAI |
| `500 Internal Server Error` | Błąd infrastruktury / OpenAI niedostępny |

---

## 5. Przepływ danych

Przepływ danych **bez zmian** — zmiana dotyczy wyłącznie treści promptu systemowego przekazywanego do OpenAI.

```
Klient
  │
  ▼
POST /ai/recipes/draft
  │
  ▼
ai/index.ts (router)
  │
  ▼
ai.handlers.ts (walidacja żądania, weryfikacja JWT, rezerwacja kredytów)
  │
  ▼
ai.service.ts → generateRecipeDraft()
  │
  ├─► getSystemPrompt(language)   ← ✅ JEDYNE MIEJSCE ZMIANY (sekcja 2. OPIS:)
  │
  ├─► callOpenAI([systemMessage, userMessage])
  │       └─► OpenAI API (gpt-4o-mini) → JSON z draft.description
  │
  ├─► normalizeDraft() + normalizeDraftMetadata()
  │
  └─► AiRecipeDraftResponseDto
  │
  ▼
ai.handlers.ts (formatowanie odpowiedzi HTTP 200)
  │
  ▼
Klient
```

---

## 6. Względy bezpieczeństwa

Żadne zmiany bezpieczeństwa nie są wymagane — PS-34 nie modyfikuje logiki autoryzacji, weryfikacji JWT ani walidacji danych wejściowych.

**Istniejące zabezpieczenia (bez zmian):**

| Aspekt | Mechanizm |
|--------|-----------|
| Autoryzacja | JWT Bearer Token — role `user`, `premium`, `admin` |
| Kredyty AI | Rezerwacja przed wywołaniem modelu; zwrot przy błędzie |
| Rate limiting | Obsługa `429` z OpenAI |
| Sanityzacja | Tekst/obraz użytkownika trafia do promptu użytkownika, nie do promptu systemowego |
| Treści nieodpowiednie | Nowa instrukcja promptu explicite zakazuje treści wulgarnych, erotycznych i obraźliwych |

**Uwaga dotycząca few-shot przykładu w prompcie:**
Przykład użyty w nowym prompcie (Spaghetti Carbonara) jest statyczny, bezpieczny dla publiczności ogólnej i nie zawiera danych wrażliwych.

---

## 7. Obsługa błędów

Obsługa błędów **bez zmian**. Nowy prompt nie wprowadza nowych ścieżek błędów ani kodów statusu.

| Błąd | Kod | Opis |
|------|-----|------|
| Wyczerpane kredyty `draft` | `402` | `AI_CREDITS_EXHAUSTED` — bez zmian |
| Treść nie jest przepisem | `422` | `reasons: [...]` — bez zmian |
| Rate limit OpenAI | `429` | `TOO_MANY_REQUESTS` — bez zmian |
| OpenAI niedostępne | `500` | `INTERNAL_ERROR` — bez zmian |
| Timeout | `500` | `INTERNAL_ERROR` — bez zmian |
| Nieprawidłowy JSON z LLM | `500` | `INTERNAL_ERROR` — bez zmian |

Istniejące mechanizmy walidacji schematu (`AiRecipeDraftLlmResponseSchema`) nadal obowiązują — nowy prompt nie zmienia wymaganego formatu JSON odpowiedzi LLM.

---

## 8. Rozważania dotyczące wydajności

| Aspekt | Analiza |
|--------|---------|
| Długość promptu | Nowy prompt jest dłuższy (~600 znaków vs ~200 znaków w sekcji `2. OPIS:`). Nieznaczny wzrost zużycia tokenów wejściowych (szacunkowo +150 tokenów). Bez wpływu na limity API. |
| Długość odpowiedzi | Opis 3–5 zdań vs 1–3 zdania — marginalny wzrost tokenów wyjściowych (~50–100 tokenów). `MAX_TOKENS = 2000` pozostaje bez zmian i jest wystarczający. |
| Latencja | Nieznaczny wzrost (< 100 ms) ze względu na dłuższą odpowiedź. Brak wpływu na `API_TIMEOUT_MS = 30_000`. |
| Few-shot przykład | Dodanie przykładu w prompcie zwiększa prawdopodobieństwo poprawnej interpretacji instrukcji przez model, redukując ryzyko konieczności powtórnych wywołań. |

---

## 9. Etapy wdrożenia

### Krok 1: Aktualizacja sekcji `2. OPIS:` w `getSystemPrompt()`

**Plik:** `supabase/functions/ai/ai.service.ts`

Zastąp obecną sekcję `2. OPIS:` w funkcji `getSystemPrompt()`:

**Przed (linie ~92–95):**
```
2. OPIS:
   - Wygeneruj krótki, przyjazny opis (1-3 zdania)
   - Ma być lekko dowcipny oraz zawierać ciekawostkę na temat potrawy (nie używaj słowa "ciekawostka")
   - Jeśli nie da się stworzyć sensownego opisu, użyj null
```

**Po:**
```
2. OPIS:
   - Zawsze pisz po polsku, niezależnie od języka źródłowego przepisu.
   - Wygeneruj opis składający się z dokładnie 3–5 zdań.
   - Zachowaj ton familiarny, potoczny i pogodny — jak rozmowa z przyjacielem przy stole,
     a nie hasło z encyklopedii. Unikaj formalnych sformułowań.
   - Obowiązkowo zawrzyj co najmniej jeden element humorystyczny: żart o daniu, lekka uszczypliwość
     dotycząca czasu przygotowania lub nieoczekiwanego składnika, kulinarny absurd lub autoironiczny
     komentarz. Unikaj pustego „śmieszenia" bez związku z potrawą.
   - Zakończ opis dokładnie jedną ciekawostką (historyczną, geograficzną lub dietetyczną)
     powiązaną z potrawą. Jeśli nie dysponujesz pewną ciekawostką o samym daniu, napisz ją
     o kluczowym składniku lub zastosowanej technice kulinarnej. Nie używaj słowa „ciekawostka"
     wprost — wpleć ją naturalnie w treść.
   - Opis NIE MOŻE zawierać treści wulgarnych, erotycznych ani obraźliwych.
   - Jeśli nie da się stworzyć sensownego opisu, użyj null.

   PRZYKŁAD (wymagane cechy: 3–5 zdań, humor, ciekawostka na końcu):
   "Spaghetti carbonara to danie, które robi na gościach wrażenie absolutnej maestrii —
    dopóki nie wyjawi się im, że sekret tkwi w surowym żółtku wrzucanym w ostatniej chwili
    do gorącego makaronu. Przygotowanie zajmuje raptem 20 minut, ale ten moment mieszania
    wymaga nerwów chirurga i refleksu bramkarza jednocześnie. Nawiasem mówiąc, wbrew
    popularnej legendzie o węglarzach (carbonari), danie najprawdopodobniej narodziło się
    w Rzymie dopiero w połowie XX wieku."
```

### Krok 2: Aktualizacja testów jednostkowych promptu

**Plik:** `supabase/functions/ai/ai.service.test.ts`

Dodaj nowy test jednostkowy weryfikujący obecność kluczowych instrukcji stylu w prompcie:

```typescript
import { getSystemPrompt } from './ai.service.ts';

Deno.test({
    name: 'getSystemPrompt: zawiera wymagane instrukcje stylu opisu (PS-34)',
    fn: () => {
        const prompt = getSystemPrompt('pl');

        // Weryfikacja długości: 3–5 zdań
        assert(prompt.includes('3–5 zdań'), 'Prompt powinien wymagać 3–5 zdań');

        // Weryfikacja tonu familiarnego
        assert(
            prompt.includes('familiarny') || prompt.includes('potoczny'),
            'Prompt powinien wymagać tonu familiarnego/potocznego',
        );

        // Weryfikacja humoru
        assert(
            prompt.includes('humorystyczny') || prompt.includes('uszczypliwość'),
            'Prompt powinien wymagać elementu humorystycznego',
        );

        // Weryfikacja ciekawostki
        assert(
            prompt.includes('ciekawostką') || prompt.includes('historyczną'),
            'Prompt powinien wymagać ciekawostki historycznej/geograficznej/dietetycznej',
        );

        // Weryfikacja zakazu treści nieodpowiednich
        assert(
            prompt.includes('wulgarnych') || prompt.includes('obraźliwych'),
            'Prompt powinien zabraniać treści nieodpowiednich',
        );

        // Weryfikacja few-shot przykładu
        assert(
            prompt.includes('carbonara') || prompt.includes('PRZYKŁAD'),
            'Prompt powinien zawierać przykład few-shot',
        );
    },
});
```

### Krok 3: Lokalne testowanie manualne

Uruchom Edge Function lokalnie i wykonaj smoke test:

```bash
supabase functions serve ai
```

```bash
# Test z tekstem (happy path)
curl -X POST http://localhost:54331/functions/v1/ai/recipes/draft \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "text",
    "text": "Spaghetti Carbonara: 200g spaghetti, 100g guanciale, 2 żółtka, 50g pecorino...",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
  }'
```

Zweryfikuj ręcznie dla co najmniej 5 przepisów (w tym ≥1 niszowego, ≥1 z obrazu):
- [ ] Opis zawiera 3–5 zdań
- [ ] Opis zawiera co najmniej jeden element humorystyczny
- [ ] Opis zawiera dokładnie jedną ciekawostkę (wplecioną naturalnie)
- [ ] Ton jest familiarny i potoczny
- [ ] Brak treści nieodpowiednich
- [ ] Pozostałe pola (składniki, kroki, metadane) są niezmienione

### Krok 4: Uruchomienie testów jednostkowych

```bash
deno test supabase/functions/ai/ai.service.test.ts --allow-env
```

### Krok 5: Deploy na środowisko dev/staging

```bash
supabase functions deploy ai --project-ref <PROJECT_REF>
```

Po deployu wykonaj smoke test na środowisku dev z przynajmniej 2 przepisami. Zweryfikuj logi Edge Function w panelu Supabase.

### Krok 6: Code Review

- Sprawdź, czy zmieniony prompt spełnia wszystkie kryteria akceptacji z US PS-34
- Upewnij się, że few-shot przykład w prompcie jest bezpieczny dla szerokiej publiczności
- Zweryfikuj, że testy jednostkowe pokrywają wszystkie nowe instrukcje stylu

### Krok 7: Deploy na produkcję i monitoring

```bash
supabase functions deploy ai --project-ref <PROD_PROJECT_REF>
```

Po deployu monitoruj:
- Logi Edge Function przez 15 minut (brak nowych błędów)
- Wyniki `POST /ai/recipes/draft` — spot-check kilku wywołań
- Sprawdź, czy kredyty AI nadal są poprawnie rozliczane

---

## Podsumowanie plików do modyfikacji

| Plik | Zakres zmian |
|------|-------------|
| `supabase/functions/ai/ai.service.ts` | Aktualizacja sekcji `2. OPIS:` w funkcji `getSystemPrompt()` |
| `supabase/functions/ai/ai.service.test.ts` | Dodanie testu jednostkowego `getSystemPrompt` weryfikującego nowe instrukcje stylu |

**Pliki bez zmian:**

| Plik | Powód |
|------|-------|
| `shared/contracts/types.ts` | Kontrakt DTO bez zmian |
| `supabase/functions/ai/ai.types.ts` | Typy wewnętrzne bez zmian |
| `supabase/functions/ai/ai-draft-metadata.ts` | Metadane draftu poza zakresem |
| `supabase/functions/ai/ai.handlers.ts` | Logika handlera bez zmian |
| `supabase/functions/ai/ai-credits.service.ts` | Kredyty AI bez zmian |
| Wszystkie pliki frontendu | Brak zmian w warstwie UI |
| Migracje bazy danych | Brak migracji |
