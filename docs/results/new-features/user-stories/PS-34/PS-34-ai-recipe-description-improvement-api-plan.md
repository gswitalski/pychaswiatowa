# Plan API — Poprawa generowania opisu przepisu przez AI (PS-34)

> **User Story:** PS-34 — Poprawa generowania opisu przez AI
> **Data:** październik 2026
> **Zakres:** Wyłącznie modyfikacja promptu systemowego w Edge Function `ai`

---

## 1. Przegląd

PS-34 **nie wprowadza nowych endpointów** ani **nie zmienia kontraktu API**. Jedyna zmiana to aktualizacja sekcji `2. OPIS:` w prompcie systemowym funkcji `getSystemPrompt()` w pliku `supabase/functions/ai/ai.service.ts`.

Endpoint `POST /ai/recipes/draft` pozostaje bez zmian pod każdym innym względem:

| Aspekt | Stan |
|---|---|
| URL, metoda HTTP | Bez zmian |
| Nagłówki autoryzacji | Bez zmian |
| Parametry żądania (`body`) | Bez zmian |
| Schemat odpowiedzi (`AiRecipeDraftResponseDto`) | Bez zmian |
| Pole `description` w odpowiedzi | `string \| null` — bez zmian |
| Logika rozliczania kredytów `draft` | Bez zmian |
| Obsługa błędów (`402`, `422`, `429`) | Bez zmian |
| Tryb `text` i tryb `image` | Oba korzystają ze wspólnego `getSystemPrompt()` — zmiana obejmuje oba |

---

## 2. Zmiana w prompcie systemowym

### Plik

```
supabase/functions/ai/ai.service.ts
```

### Funkcja

```typescript
export function getSystemPrompt(language: string): string { ... }
```

### Zmiana sekcji `2. OPIS:`

**Przed (stan obecny):**

```
2. OPIS:
   - Wygeneruj krótki, przyjazny opis (1-3 zdania)
   - Ma być lekko dowcipny oraz zawierać ciekawostkę na temat potrawy (nie używaj słowa "ciekawostka")
   - Jeśli nie da się stworzyć sensownego opisu, użyj null
```

**Po (stan docelowy):**

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

---

## 3. Uzasadnienie podejścia

| Decyzja | Uzasadnienie |
|---|---|
| Jeden wspólny prompt dla trybu `text` i `image` | Oba tryby wywołują `getSystemPrompt()` — zmiana jednego miejsca pokrywa oba scenariusze (US-036 Scenariusz 4) |
| Opis zawsze po polsku | Aplikacja jest skierowana do polskich użytkowników; familiarny ton i ciekawostka działają naturalnie tylko w ojczystym języku |
| Ciekawostka jako ostatnie zdanie | Spójne zakończenie, łatwe do weryfikacji manualnej i w testach jednostkowych |
| Few-shot przykład w prompcie | Subiektywność humoru wymaga wzorca; bez przykładu model może generować zbyt suche lub przesadzone żarty |
| Długość 3–5 zdań (zamiast 1–3) | Pozwala pomieścić: klimat dania + element humoru + ciekawostkę bez tłoczenia ich w jedno zdanie |

---

## 4. Kontrakt API (bez zmian)

### `POST /ai/recipes/draft`

- **Autoryzacja:** `Authorization: Bearer <JWT>` (role `user` / `premium` / `admin`)
- **Żądanie:** bez zmian — `{ mode: "text" | "image", ... }`
- **Odpowiedź (200):**

```json
{
  "draft": {
    "name": "string",
    "description": "string | null",
    "ingredients_raw": "string",
    "steps_raw": "string",
    "tips_raw": "string | undefined",
    "category_name": "string | null",
    "tags": ["string"],
    "servings": 4,
    "prep_time_minutes": 20,
    "total_time_minutes": 60,
    "diet_type": "VEGETARIAN",
    "cuisine": "POLISH",
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

Jedyną obserwowalną różnicą dla klienta jest **treść** pola `description` — dłuższa, bardziej angażująca. Typ (`string | null`) i obecność pola w JSON pozostają bez zmian.

---

## 5. Pliki do modyfikacji

| Plik | Zakres zmian |
|---|---|
| `supabase/functions/ai/ai.service.ts` | Aktualizacja sekcji `2. OPIS:` w funkcji `getSystemPrompt()` |
| `supabase/functions/ai/ai.service.spec.ts` | Aktualizacja lub dodanie testu jednostkowego weryfikującego obecność nowych instrukcji stylu w prompcie |

**Pliki bez zmian:**

| Plik | Powód |
|---|---|
| `shared/contracts/types.ts` | Kontrakt DTO bez zmian |
| `supabase/functions/ai/ai.types.ts` | Typy wewnętrzne bez zmian |
| `supabase/functions/ai/ai-draft-metadata.ts` | Metadane draftu poza zakresem |
| Wszystkie pliki frontendu | Brak zmian w warstwie UI |

---

## 6. Czego NIE robi PS-34

| Element | Uwaga |
|---|---|
| Przełącznik trybu opisu (poważny / humorystyczny) | Jeden spójny styl dla wszystkich przepisów |
| Zmiana długości lub stylu **pozostałych pól** (`name`, `steps_raw` itd.) | Wyłącznie pole `description` |
| Nowy endpoint / zmiana sygnatury | Brak |
| Migracja bazy danych | Brak |
| Zmiana mechanizmu kredytów `draft` | Brak |
