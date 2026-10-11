# API Endpoints Implementation Plan: PS-97 — Generowanie przepisu z linku URL przez AI

> **User Story:** PS-97  
> **Dotyczy:** Supabase Edge Function `ai` — modyfikacja `POST /ai/recipes/draft`  
> **Data:** październik 2026  
> **Powiązane dokumenty:** `PS-97-ai-recipe-from-url-api-plan.md`, `PS-97-ai-recipe-from-url-user-story.md`

---

## 1. Przegląd punktu końcowego

Rozszerzenie istniejącego endpointu `POST /ai/recipes/draft` o trzeci wariant źródła: `source: "url"`. Endpoint pobiera treść wskazanej strony internetowej po stronie Edge Function (omija CORS, nie ujawnia kluczy), ekstrahuje z HTML surowy tekst, a następnie przekazuje go do modelu AI identycznie jak w trybie `source: "text"`. Wynik (draft przepisu) i mechanizm kredytów pozostają bez zmian.

> **Uwaga implementacyjna:** Istniejący kod używa pola `source` (nie `mode`) jako discriminatora unii żądania. Nowy wariant musi być `source: "url"` — spójnie z `source: "text"` i `source: "image"`.

---

## 2. Szczegóły żądania

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/ai/recipes/draft`
- **Autoryzacja:** `Authorization: Bearer <JWT>` — role `user`, `premium`, `admin`
- **Content-Type:** `application/json`

### Parametry

- **Wymagane:**

| Pole | Typ | Opis |
|---|---|---|
| `source` | `"url"` | Discriminator nowego wariantu |
| `url` | `string` | Pełny adres URL (`http://` lub `https://`), max 2048 znaków |
| `output_format` | `"pycha_recipe_draft_v1"` | Identycznie jak w pozostałych trybach |

- **Opcjonalne:**

| Pole | Typ | Opis |
|---|---|---|
| `language` | `string` | Język odpowiedzi AI, domyślnie `"pl"` |

### Request Body (nowy wariant)

```json
{
    "source": "url",
    "url": "https://example.com/przepis-na-bigos",
    "output_format": "pycha_recipe_draft_v1",
    "language": "pl"
}
```

---

## 3. Wykorzystywane typy

### Modyfikacje w `supabase/functions/ai/ai.types.ts`

#### Nowe stałe

```typescript
/** Maksymalna długość URL (znaki) */
export const MAX_URL_LENGTH = 2048;

/** Timeout pobierania URL w milisekundach */
export const URL_FETCH_TIMEOUT_MS = 10_000;

/** Maksymalny rozmiar odpowiedzi HTML w bajtach (500 KB) */
export const MAX_URL_CONTENT_BYTES = 500_000;

/** Maksymalna długość wyekstrahowanego tekstu przed wysłaniem do AI */
export const MAX_URL_EXTRACTED_TEXT_LENGTH = 50_000;
```

#### Nowy schemat Zod — `UrlSourceSchema`

```typescript
const UrlSourceSchema = BaseRequestSchema.extend({
    source: z.literal('url'),
    url: z
        .string()
        .min(1, 'URL cannot be empty')
        .max(MAX_URL_LENGTH, `URL exceeds maximum length of ${MAX_URL_LENGTH} characters`)
        .refine(
            (u) => /^https?:\/\//i.test(u),
            { message: 'URL must start with http:// or https://' }
        )
        .refine(
            (u) => { try { new URL(u); return true; } catch { return false; } },
            { message: 'URL has invalid syntax' }
        ),
    text: z.undefined().optional(),
    image: z.undefined().optional(),
});
```

#### Rozszerzenie `AiRecipeDraftRequestSchema`

```typescript
export const AiRecipeDraftRequestSchema = z.discriminatedUnion('source', [
    TextSourceSchema,
    ImageSourceSchema,
    UrlSourceSchema,   // ← nowe
]);
```

#### Rozszerzenie `GenerateRecipeDraftParams`

```typescript
export interface GenerateRecipeDraftParams {
    userId: string;
    source: 'text' | 'image' | 'url';   // ← dodany 'url'
    text?: string;
    imageBytes?: Uint8Array;
    imageMimeType?: string;
    url?: string;                         // ← nowe pole
    language: string;
}
```

### Modyfikacje w `shared/contracts/types.ts`

#### Rozszerzenie `AiRecipeDraftSource` i `AiRecipeDraftRequestDto`

```typescript
/** Nowy wariant URL w typach współdzielonych */
export type AiRecipeDraftSource = 'text' | 'image' | 'url';

export type AiRecipeDraftRequestDto =
    | { source: 'text'; text: string; output_format: 'pycha_recipe_draft_v1'; language?: string; }
    | { source: 'image'; image: AiRecipeDraftImageDto; output_format: 'pycha_recipe_draft_v1'; language?: string; }
    | { source: 'url'; url: string; output_format: 'pycha_recipe_draft_v1'; language?: string; };   // ← nowe
```

---

## 4. Szczegóły odpowiedzi

### Odpowiedź sukces `200 OK` (bez zmian kontraktu)

```json
{
    "draft": {
        "name": "Bigos myśliwski",
        "description": "Opis przepisu...",
        "ingredients_raw": "500 g kapusty kiszonej\n200 g kiełbasy\n...",
        "steps_raw": "Pokroić mięso w kostkę\nPodsmażyć na oleju\n...",
        "tips_raw": "Najlepszy następnego dnia",
        "category_name": "Obiad",
        "tags": ["tradycyjne", "mięsne", "polskie"],
        "servings": 4,
        "prep_time_minutes": 30,
        "total_time_minutes": 120,
        "diet_type": "MEAT",
        "cuisine": "POLISH",
        "difficulty": "MEDIUM",
        "is_termorobot": false,
        "is_grill": false
    },
    "meta": {
        "confidence": 0.88,
        "warnings": []
    }
}
```

Jeśli wyekstrahowany tekst został przycięty do 50 000 znaków, w `meta.warnings` pojawia się ostrzeżenie:
```json
"warnings": ["Source content was truncated to 50000 characters before AI processing"]
```

---

## 5. Przepływ danych

```
Klient
  │
  ├─ POST /ai/recipes/draft  { source: "url", url: "https://...", output_format: ... }
  │
  ▼
Edge Function (ai) — ai.handlers.ts → handlePostAiRecipesDraft()
  │
  ├─ 1. JWT verification → getAuthenticatedContext(req)
  ├─ 2. Extract app_role → extractAndValidateAppRole(token)
  ├─ 3. Parse body → req.json()
  ├─ 4. Zod validate → AiRecipeDraftRequestSchema.safeParse(body)
  │       └─ source === "url": sprawdzenie formatu i schematu URL
  │
  ├─ 5. Jeśli source === "url":
  │       └─ inputUrl = requestData.url
  │
  ├─ 6. checkAndDeductCredits() — rezerwacja kredytu 'draft'
  │       └─ błąd → 402 AI_CREDITS_EXHAUSTED
  │
  ├─ 7. generateRecipeDraft({ source: "url", url: inputUrl, ... })
  │       │
  │       ├─ ai.service.ts
  │       │
  │       ├─ resolveAndCheckHost(hostname)
  │       │       ├─ DNS resolve → lista IP
  │       │       └─ isPrivateIp(ip) → błąd: ApplicationError('URL_INVALID_HOST')
  │       │
  │       ├─ fetchUrlContent(url)
  │       │       ├─ AbortController, timeout: 10s
  │       │       ├─ fetch(url, { redirect: 'follow', max 5 hop })
  │       │       ├─ AbortError → ApplicationError('URL_TIMEOUT')
  │       │       ├─ HTTP >= 400 → ApplicationError('URL_FETCH_FAILED')
  │       │       ├─ końcowy URL schemat ≠ http/https → ApplicationError('URL_FETCH_FAILED')
  │       │       └─ rozmiar > 500 KB → ApplicationError('URL_CONTENT_TOO_LARGE')
  │       │
  │       ├─ extractTextFromHtml(html)
  │       │       └─ usuń <script>, <style>, <nav>... → strip tags → collapse whitespace
  │       │
  │       ├─ przycinanie tekstu do 50 000 znaków (+ dodanie warning)
  │       │
  │       └─ callOpenAI([systemMessage, { role: "user", content: getTextExtractionPrompt(extractedText) }])
  │               │  (identycznie jak dla source: "text")
  │               └─ błąd modelu → refundCreditAfterFailure() + throw
  │
  ├─ 8. Przy błędach 422 (URL_FETCH_FAILED, URL_TIMEOUT, URL_CONTENT_TOO_LARGE):
  │       └─ refundCreditAfterFailure()
  │
  ├─ 9. Przy sukcesie → deductCreditAfterSuccess()
  │
  └─ 10. Zwrócenie 200 z { draft, meta }
```

---

## 6. Względy bezpieczeństwa

### Ochrona przed SSRF (Server-Side Request Forgery)

**Główne ryzyko:** Bez walidacji IP atakujący może wskazać URL na serwisy wewnętrzne infrastruktury (np. metadane AWS `169.254.169.254`, Supabase internals).

**Implementacja `isPrivateIp()`** — blokowanie zakresów:

```typescript
// Zablokowane zakresy (RFC 1918, RFC 5735, RFC 3927, link-local, IPv6):
const BLOCKED_CIDRS = [
    '10.0.0.0/8',        // RFC 1918 private
    '172.16.0.0/12',     // RFC 1918 private
    '192.168.0.0/16',    // RFC 1918 private
    '127.0.0.0/8',       // loopback
    '169.254.0.0/16',    // link-local (AWS/GCP metadata: 169.254.169.254)
    '0.0.0.0/8',         // "this" network
    '100.64.0.0/10',     // shared address space (RFC 6598)
    '::1/128',           // IPv6 loopback
    'fc00::/7',          // IPv6 ULA
    'fe80::/10',         // IPv6 link-local
];
```

**Procedura weryfikacji:**
1. Parsuj URL → wyciągnij `hostname`
2. Deno DNS resolve: `Deno.resolveDns(hostname, 'A')` + `Deno.resolveDns(hostname, 'AAAA')`
3. Dla każdego zwróconego IP: sprawdź `isPrivateIp(ip)` → jeśli true → `400 URL_INVALID_HOST`
4. Po fetch: sprawdź `response.url` (końcowy URL po przekierowaniach) — ponów weryfikację IP

### Walidacja JWT i autoryzacja

- Endpoint akceptuje role `user`, `premium`, `admin` (identycznie jak istniejące tryby)
- Rola pobierana wyłącznie z JWT (`app_metadata.app_role`) — nigdy z body
- Premium gating istnieje tylko w UI (`premiumRoleMatchGuard`) — API nie blokuje roli `user`

### Walidacja URL po stronie frontendu i backendu

| Warstwa | Kontrola |
|---|---|
| Frontend (Angular) | Reaktywna walidacja: schemat `http/https`, poprawna składnia URI (Angular `Validators.pattern` lub własny walidator) |
| Backend (Zod) | `z.string().refine(...)` — schemat + składnia URI; max 2048 znaków |
| Backend (serwis) | DNS resolve + SSRF check przed fetch |

### Ochrona przed DoS

- Limit rozmiaru odpowiedzi: 500 KB (sprawdzanie `Content-Length` + ograniczenie odczytu bufora)
- Timeout fetch: 10 s (AbortController)
- Max 5 przekierowań (domyślne dla Deno `fetch`)
- Istniejący rate limit na endpoint (bez zmian)

---

## 7. Obsługa błędów

### Tabela kodów błędów

| Kod HTTP | Kod błędu | Sytuacja | Zwrot kredytu |
|---|---|---|---|
| `400` | `INVALID_URL` | Nieprawidłowy format URL (zły schemat, błąd parsowania, za długi) | Nie — kredyt nie był zarezerwowany |
| `400` | `URL_INVALID_HOST` | Hostname wskazuje na prywatny/zarezerwowany IP (SSRF) | Tak |
| `401` | — | Brak lub nieważny JWT | Nie |
| `402` | `AI_CREDITS_EXHAUSTED` | Pusta pula `draft` | Nie — rezerwacja się nie udała |
| `422` | `URL_FETCH_FAILED` | HTTP >= 400, błąd sieci, zbyt wiele przekierowań, końcowy schemat ≠ http/https | Tak |
| `422` | `URL_TIMEOUT` | Timeout pobierania (10 s) | Tak |
| `422` | `URL_CONTENT_TOO_LARGE` | Rozmiar HTML > 500 KB | Tak |
| `429` | — | Rate limit | Nie |
| `500` | `INTERNAL_ERROR` | Błąd modelu AI, nieoczekiwany wyjątek | Tak |

### Format odpowiedzi błędu (nowe kody)

```json
// 400 INVALID_URL
{
    "code": "INVALID_URL",
    "message": "URL must start with http:// or https:// and have valid syntax"
}

// 400 URL_INVALID_HOST
{
    "code": "URL_INVALID_HOST",
    "message": "The target URL resolves to a private or reserved IP address"
}

// 422 URL_FETCH_FAILED
{
    "code": "URL_FETCH_FAILED",
    "message": "Failed to fetch content from the provided URL. The page may be unavailable, require authentication, or block automated access."
}

// 422 URL_TIMEOUT
{
    "code": "URL_TIMEOUT",
    "message": "Request to the provided URL timed out after 10 seconds."
}

// 422 URL_CONTENT_TOO_LARGE
{
    "code": "URL_CONTENT_TOO_LARGE",
    "message": "The page content exceeds the maximum allowed size of 500 KB."
}
```

### Obsługa w handlerze

Wszystkie błędy `URL_*` rzucone jako `ApplicationError` z odpowiednim kodem są mapowane na właściwe kody HTTP w `handleError()` lub dedykowanym `try/catch` wokół wywołania serwisu. Kredyt jest zwracany przez `refundCreditAfterFailure()` przed re-rzuceniem/zwróceniem odpowiedzi błędu.

```typescript
// Szkic obsługi w handlePostAiRecipesDraft — fragment dla source === "url"
let result;
try {
    result = await generateRecipeDraft({ ..., source: 'url', url: inputUrl, ... });
} catch (error) {
    await refundCreditAfterFailure({ supabaseAdmin, userId: user.id, creditType: 'draft', appRole });
    
    if (error instanceof ApplicationError) {
        const urlErrorMap: Record<string, { status: number; code: string }> = {
            'URL_FETCH_FAILED':       { status: 422, code: 'URL_FETCH_FAILED' },
            'URL_TIMEOUT':            { status: 422, code: 'URL_TIMEOUT' },
            'URL_CONTENT_TOO_LARGE':  { status: 422, code: 'URL_CONTENT_TOO_LARGE' },
            'URL_INVALID_HOST':       { status: 400, code: 'URL_INVALID_HOST' },
        };
        const mapping = urlErrorMap[error.code];
        if (mapping) {
            return new Response(
                JSON.stringify({ code: mapping.code, message: error.message }),
                { status: mapping.status, headers: { 'Content-Type': 'application/json' } }
            );
        }
    }
    throw error;
}
```

---

## 8. Rozważania dotyczące wydajności

### Potencjalne wąskie gardła

| Wąskie gardło | Ryzyko | Mitygacja |
|---|---|---|
| Wolny serwer docelowy | Długi czas oczekiwania na odpowiedź | AbortController z timeout 10 s |
| Duże strony HTML | Zużycie pamięci | Limit 500 KB; przerwanie odczytu po przekroczeniu |
| DNS resolve | Dodatkowe opóźnienie (zwykle <50 ms) | Natywny Deno — minimalny narzut |
| Ekstrakcja tekstu | Regex na dużym stringu | Sekwencyjne `.replace()` — O(n), akceptowalne dla 500 KB |
| Przycinanie tekstu | Brak | Prosty `substring(0, 50_000)` — O(1) |

### Strategia optymalizacji

- **Strumieniowe odczytanie odpowiedzi:** używać `response.body.getReader()` i przerywać odczyt po osiągnięciu 500 KB (zamiast czekać na pełny bufor), aby uniknąć nadmiernego zużycia pamięci
- **User-Agent:** identyfikowalny bot User-Agent (`PychaSwiatowa-Bot/1.0`) — ułatwia debugowanie i pozwala serwerom docelowym odpowiednio reagować
- **Brak cache'owania:** każde wywołanie fetchuje stronę na nowo (prostota > optymalizacja dla MVP)

---

## 9. Etapy wdrożenia

### Etap 1: Typy i schematy (`ai.types.ts`)

1. Dodać stałe: `MAX_URL_LENGTH`, `URL_FETCH_TIMEOUT_MS`, `MAX_URL_CONTENT_BYTES`, `MAX_URL_EXTRACTED_TEXT_LENGTH`
2. Dodać `UrlSourceSchema` — discriminated union z `source: z.literal('url')` i walidacją URL
3. Rozszerzyć `AiRecipeDraftRequestSchema` o `UrlSourceSchema`
4. Rozszerzyć `GenerateRecipeDraftParams` o `source: 'text' | 'image' | 'url'` i `url?: string`

### Etap 2: Typy współdzielone (`shared/contracts/types.ts`)

5. Rozszerzyć `AiRecipeDraftSource` o `'url'`
6. Dodać trzeci wariant do `AiRecipeDraftRequestDto` z `source: 'url'` i polem `url: string`

### Etap 3: Logika scrapingu (`ai.service.ts`)

7. Zaimplementować `isPrivateIp(ip: string): boolean` — sprawdzanie zakresów SSRF (parsowanie CIDR lub lookup tablicowy dla kluczowych zakresów)
8. Zaimplementować `resolveAndCheckHost(hostname: string): Promise<void>`:
    - `Deno.resolveDns(hostname, 'A')` + `Deno.resolveDns(hostname, 'AAAA')`
    - Dla każdego IP: `if (isPrivateIp(ip)) throw new ApplicationError('URL_INVALID_HOST', ...)`
9. Zaimplementować `fetchUrlContent(url: string): Promise<string>`:
    - `AbortController` z `setTimeout` 10 s
    - `fetch(url, { signal, redirect: 'follow', headers: { 'User-Agent': 'PychaSwiatowa-Bot/1.0 (+https://pychaswiatowa.web.app)', 'Accept': 'text/html,...' } })`
    - Obsługa `AbortError` → `ApplicationError('URL_TIMEOUT', ...)`
    - Sprawdzenie `response.status >= 400` → `ApplicationError('URL_FETCH_FAILED', ...)`
    - Weryfikacja końcowego `response.url` (schemat `http/https`)
    - Sprawdzenie nagłówka `Content-Length` > `MAX_URL_CONTENT_BYTES` → `ApplicationError('URL_CONTENT_TOO_LARGE', ...)`
    - Strumieniowy odczyt z `response.body.getReader()` z przerwaniem po 500 KB
10. Zaimplementować `extractTextFromHtml(html: string): string`:
    - Usunięcie bloków: `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>`, `<noscript>`
    - Usunięcie wszystkich pozostałych tagów HTML
    - Dekodowanie encji HTML: `&amp;`, `&lt;`, `&gt;`, `&nbsp;`, `&#\d+;`
    - Kolaps białych znaków i wielokrotnych nowych linii
    - `.trim()`

### Etap 4: Rozszerzenie serwisu (`ai.service.ts` — `generateRecipeDraft`)

11. W sekcji budowania wiadomości dla OpenAI (za blokiem `source === 'image'`) dodać gałąź:
    ```typescript
    } else if (source === 'url' && url) {
        await resolveAndCheckHost(new URL(url).hostname);
        let htmlContent = await fetchUrlContent(url);
        let extractedText = extractTextFromHtml(htmlContent);
        const warnings: string[] = [];
        if (extractedText.length > MAX_URL_EXTRACTED_TEXT_LENGTH) {
            extractedText = extractedText.substring(0, MAX_URL_EXTRACTED_TEXT_LENGTH);
            warnings.push('Source content was truncated to 50000 characters before AI processing');
        }
        userMessage = { role: 'user', content: getTextExtractionPrompt(extractedText) };
        // Dołącz warnings do wynikowych meta.warnings na końcu funkcji
    }
    ```
12. Dodać przekazanie `url` w `params` do funkcji i odpowiedni logging (URL z prefikx tylko dla bezpieczeństwa)

### Etap 5: Obsługa w handlerze (`ai.handlers.ts`)

13. W `handlePostAiRecipesDraft`, po bloku `source === 'image'`, dodać:
    ```typescript
    } else if (requestData.source === 'url') {
        inputUrl = requestData.url;
        logger.info('Processing url source', { userId: user.id, urlPrefix: requestData.url.substring(0, 50) });
    }
    ```
14. Przekazać `url: inputUrl` do `generateRecipeDraft()`
15. Dodać dedykowany blok `try/catch` mapujący `ApplicationError` kodów `URL_*` na właściwe kody HTTP (`400`/`422`) z `refundCreditAfterFailure()` przed odpowiedzią błędu

### Etap 6: Testy (`ai.service.test.ts`)

16. Napisać testy jednostkowe dla:
    - `isPrivateIp()` — happy path, zakresy prywatne IPv4, loopback, link-local, IPv6
    - `extractTextFromHtml()` — usunięcie script/style/nav, ekstrakcja treści, dekodowanie encji
    - `fetchUrlContent()` — mock `fetch` dla: happy path, AbortError, HTTP 403, HTTP 404, za duży Content-Length, zbyt wolna odpowiedź
    - `generateRecipeDraft({ source: 'url', ... })` — happy path, SSRF block, fetch error, timeout, content too large
17. Napisać testy integracyjne dla handlera:
    - Nieprawidłowy format URL (Zod) → `400`
    - SSRF attempt → `400 URL_INVALID_HOST`
    - Niedostępna strona → `422 URL_FETCH_FAILED`
    - Timeout → `422 URL_TIMEOUT`
    - `402` przy wyczerpanych kredytach
    - Happy path end-to-end z mockiem fetch i mockiem OpenAI

### Etap 7: Weryfikacja i dokumentacja

18. Przetestować lokalnie (`supabase functions serve ai`) z użyciem `test-requests.http` — dodać nowe przykłady żądań dla `source: "url"`
19. Zaktualizować `docs/results/project-summary.md`:
    - Sekcja endpointów AI: dodać wzmiankę o trybie `url` w `POST /ai/recipes/draft`
    - Sekcja historyjek (tabela user stories): oznaczyć PS-97 jako zakończone
20. Code review — sprawdzić, czy refund kredytu jest wywołany w każdej ścieżce błędu scrapingu

---

## Pliki do modyfikacji

| Plik | Zakres zmian |
|---|---|
| `supabase/functions/ai/ai.types.ts` | Nowe stałe, `UrlSourceSchema`, rozszerzenie `AiRecipeDraftRequestSchema` i `GenerateRecipeDraftParams` |
| `supabase/functions/ai/ai.service.ts` | Nowe funkcje: `isPrivateIp`, `resolveAndCheckHost`, `fetchUrlContent`, `extractTextFromHtml`; rozszerzenie `generateRecipeDraft` |
| `supabase/functions/ai/ai.handlers.ts` | Obsługa `source === 'url'` w `handlePostAiRecipesDraft`, mapowanie błędów `URL_*` |
| `supabase/functions/ai/ai.service.test.ts` | Nowe testy jednostkowe i integracyjne |
| `shared/contracts/types.ts` | Rozszerzenie `AiRecipeDraftSource` i `AiRecipeDraftRequestDto` |

## Pliki bez zmian

| Plik | Powód |
|---|---|
| `supabase/functions/ai/ai-draft-metadata.ts` | Normalizacja metadanych bez zmian |
| `supabase/functions/ai/ai-credits.service.ts` | Mechanizm kredytów bez zmian |
| `supabase/functions/ai/ai-credits.handlers.ts` | Handler kredytów bez zmian |
| `supabase/migrations/` | Brak zmian schematu bazy danych |
| Wszystkie pliki frontendu | Zmiany UI opisane w `PS-97-ai-recipe-from-url-ui-plan.md` |
