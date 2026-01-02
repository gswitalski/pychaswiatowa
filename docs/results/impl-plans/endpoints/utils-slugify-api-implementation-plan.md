# API Endpoints Implementation Plan: POST /utils/slugify

## 1. Przegląd punktu końcowego

Endpoint `POST /utils/slugify` służy do **spójnego generowania sluga URL** z tekstu (np. nazwy przepisu) według jednolitego kontraktu dla całej aplikacji.

- **Cel**: deterministyczna normalizacja tekstu do formatu bezpiecznego w URL (lowercase, transliteracja PL diakrytyków, `-` jako separator, limit długości, fallback).
- **Typ**: Supabase Edge Function (TypeScript/Deno).
- **Autoryzacja**: brak (endpoint publiczny).
- **Źródło prawdy dla reguł**: backend (Edge Function), nie frontend.

## 2. Szczegóły żądania

- **Metoda HTTP**: `POST`
- **Struktura URL**: `/utils/slugify` (w Supabase: `/functions/v1/utils/slugify`)
- **Parametry**:
  - **Wymagane**: brak (wszystko w body)
  - **Opcjonalne**: brak (wszystko w body)
- **Request Body (JSON)**:

```json
{
    "text": "Biała kiełbasa z jabłkami",
    "max_length": 80,
    "fallback": "przepis"
}
```

Uwagi:
- `text` jest wymagane.
- `max_length` jest opcjonalne (domyślnie `80`).
- `fallback` jest opcjonalne (domyślnie `przepis`).

## 3. Wykorzystywane typy

### Frontend/shared (kontrakt REST)
- **Nowe typy w `shared/contracts/types.ts`**:
  - `SlugifyRequestDto`
    - `text: string`
    - `max_length?: number`
    - `fallback?: string`
  - `SlugifyResponseDto`
    - `slug: string`

### Backend (Edge Function)
- **Nowe typy w `supabase/functions/utils/utils.types.ts`**:
  - `SlugifyRequest`
    - `text: string`
    - `maxLength: number`
    - `fallback: string`

## 4. Szczegóły odpowiedzi

### Sukces
- **Kod**: `200 OK`
- **Payload**:

```json
{
    "slug": "biala-kielbasa-z-jablkami"
}
```

### Błędy (minimalny wymagany zestaw)
- **`400 Bad Request`**: brak/niepoprawne `text`, niepoprawne `max_length`, niepoprawny `fallback`
- **`500 Internal Server Error`**: nieoczekiwany błąd po stronie funkcji

Rekomendowane (zgodne z obecnym standardem projektu w `_shared/errors.ts`):
- odpowiedzi błędów w formacie:

```json
{
    "code": "VALIDATION_ERROR",
    "message": "Field 'text' is required."
}
```

## 5. Przepływ danych

1. Klient wysyła `POST /utils/slugify` z JSON body.
2. `supabase/functions/utils/index.ts`:
   - obsługuje CORS (OPTIONS),
   - routuje `/slugify` do handlera,
   - mapuje nieobsługiwane metody na 404/405 zgodnie z przyjętym wzorcem w projekcie.
3. `utils.handlers.ts`:
   - waliduje body Zod (w tym domyślne wartości),
   - tworzy obiekt wejściowy dla serwisu (`maxLength`, `fallback`),
   - wywołuje `utils.service.ts`,
   - zwraca `200` z `{ slug }`.
4. `utils.service.ts`:
   - implementuje algorytm slugify (czysta logika, bez I/O),
   - zwraca slug jako string.

## 6. Względy bezpieczeństwa

- **Brak autoryzacji**:
  - endpoint jest publiczny, więc należy ograniczyć ryzyko DoS poprzez walidację rozmiaru wejścia.
- **Walidacja i limity** (guard clauses):
  - `text`: wymagane, po `trim()`, min 1 znak; rekomendacja: max np. 300–500 znaków (ustalić i spisać w kodzie).
  - `max_length`: opcjonalne, integer; rekomendacja: min 1, max 120 (lub 200) aby ograniczyć koszty i nadużycia.
  - `fallback`: opcjonalne, po `trim()`, min 1; rekomendacja: max 40.
- **Sanityzacja**:
  - wynikowy slug jest ograniczony do `[a-z0-9-]` i długości `max_length`.
- **CORS**:
  - ustawienia analogiczne do istniejących funkcji (np. `public`), ale z metodą `POST`.

## 7. Obsługa błędów

### Scenariusze i kody statusu
- `400`:
  - brak pola `text`
  - `text` puste po `trim()`
  - `max_length` nie jest liczbą całkowitą / < 1 / przekracza limit
  - `fallback` puste po `trim()`
- `500`:
  - wyjątek nieobsłużony (np. błąd w implementacji)

### Strategia obsługi w projekcie
- W handlerze rzucać `ApplicationError('VALIDATION_ERROR', message)` dla błędów walidacji.
- W `index.ts` i handlerach:
  - logować kontekst (min. `info` dla requestu, `error` dla wyjątków),
  - zwracać odpowiedź przez `handleError()` z `supabase/functions/_shared/errors.ts`.

### Rejestrowanie błędów w tabeli
- W aktualnym schemacie brak tabeli błędów: **rejestracja w tabeli nie dotyczy**.
- Źródłem diagnostyki są **logi Supabase** (strukturalne logi z `_shared/logger.ts`).

## 8. Rozważania dotyczące wydajności

- Algorytm slugify powinien działać w czasie \(O(n)\) względem długości `text`.
- Unikać złożonych regexów na bardzo długich wejściach → egzekwować maksymalną długość `text`.
- Brak I/O (DB, Storage) → endpoint tani i szybki.

## 9. Kroki implementacji

1. **Utworzyć nową Edge Function** `supabase/functions/utils/` (kebab-case, pierwszy poziom katalogu).
2. Dodać pliki zgodnie z architekturą projektu:
   - `supabase/functions/utils/index.ts` (routing + CORS + top-level error handling)
   - `supabase/functions/utils/utils.handlers.ts` (walidacja Zod, formatowanie odpowiedzi)
   - `supabase/functions/utils/utils.service.ts` (logika slugify)
   - `supabase/functions/utils/utils.types.ts` (typy wewnętrzne)
3. **Walidacja Zod** w handlerze:
   - `text`: `z.string().trim().min(1)`
   - `max_length`: `z.number().int().min(1).max(MAX_ALLOWED)` z defaultem `80`
   - `fallback`: `z.string().trim().min(1)` z defaultem `przepis`
4. **Implementacja algorytmu slugify** w `utils.service.ts` (deterministycznie):
   - `toLowerCase()`
   - transliteracja PL: `ą->a`, `ć->c`, `ę->e`, `ł->l`, `ń->n`, `ó->o`, `ś->s`, `ż->z`, `ź->z`
   - znaki nie-alfanumeryczne traktować jako separatory (docelowo `-`)
   - zwinąć wielokrotne separatory do jednego `-`
   - obciąć `-` z początku/końca
   - uciąć do `max_length` (po normalizacji); po ucięciu ponownie `trim('-')`
   - jeśli wynik pusty → zwrócić slug z `fallback` (przetworzony tym samym algorytmem; jeśli nadal pusty, zwrócić stałe `"przepis"`)
5. **Dodać typy kontraktowe** do `shared/contracts/types.ts`:
   - `SlugifyRequestDto`, `SlugifyResponseDto`
6. **Dodać testy manualne / request examples**:
   - plik `.http` podobny do `supabase/functions/plan/test-requests.http`
   - przypadki: diakrytyki, puste wejście, same znaki specjalne, limit długości, fallback.
7. **Zweryfikować lokalnie**:
   - `supabase functions serve utils`
   - request: `POST http://localhost:54331/functions/v1/utils/slugify`


