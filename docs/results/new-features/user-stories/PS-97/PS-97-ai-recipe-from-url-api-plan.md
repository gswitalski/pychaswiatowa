# Plan API — Generowanie przepisu z linku URL przez AI (PS-97)

> **User Story:** PS-97 — Generowanie przepisu z linku URL przez AI
> **Data:** październik 2026
> **Dotyczy:** Supabase Edge Function `ai` (`POST /ai/recipes/draft`)
> **Powiązane:** `PS-97-ai-recipe-from-url-user-story.md`, `PS-97-ai-recipe-from-url-ui-plan.md`, `PS-97-ai-recipe-from-url-deployment-plan.md`

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `POST /ai/recipes/draft` | Modyfikacja | Nowy tryb `"url"` w polu `mode`; dodatkowe pola `url` w body |
| Scraping HTML | **Nowa logika** | `fetch` w Deno z ograniczeniami SSRF, timeout 10 s, limit 500 KB |
| Ekstrakcja tekstu z HTML | **Nowa logika** | Usuwanie tagów `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>`, `<aside>`, atrybutów HTML; kolaps białych znaków |
| Ochrona przed SSRF | **Nowa logika** | Walidacja docelowego adresu IP po rozwiązaniu DNS — blokada zakresów prywatnych i loopback |
| Kody błędów | **Nowe** | `URL_FETCH_FAILED`, `URL_TIMEOUT`, `URL_CONTENT_TOO_LARGE`, `URL_INVALID_HOST` |
| Baza danych / migracje | **Bez zmian** | Brak nowych tabel, indeksów, RPC |
| Zmienne środowiskowe / sekrety | **Bez zmian** | Brak nowych kluczy — scraping przez natywny `fetch` Deno |
| Inne endpointy / Edge Functions | **Bez zmian** | |

**Bez zmian:**
- Tryby `"text"` i `"image"` — istniejąca logika bez modyfikacji.
- Mechanizm rezerwacji i zwrotu kredytów `draft`.
- Odpowiedź `200` z polami `draft` i `meta` — identyczny kontrakt dla klienta.
- Rate limit, autoryzacja JWT, RBAC (`user`/`premium`/`admin`).

---

## 2. Zmieniony endpoint

### `POST /ai/recipes/draft`

**Metadane:**

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/ai/recipes/draft` |
| Autoryzacja | `Authorization: Bearer <JWT>` (role `user` / `premium` / `admin`) |
| Funkcja Edge | `ai` (istniejąca) |
| Kredyt | `draft` — rezerwacja przed wywołaniem modelu, zwrot przy błędzie pobierania URL lub błędzie modelu |

---

### 2.1 Żądanie — nowy tryb `"url"`

```typescript
// Istniejące (bez zmian):
{ mode: "text", text: string }
{ mode: "image", image_base64: string, media_type: string }

// Nowe (PS-97):
{ mode: "url", url: string }
```

| Pole | Typ | Wymagane | Opis |
|---|---|---|---|
| `mode` | `"url"` | tak | Nowy wariant trybu |
| `url` | `string` | tak | Pełny adres strony, musi zaczynać się od `http://` lub `https://`; poprawna składnia URI |

**Walidacja `url` po stronie backendu:**
1. Schemat: wyłącznie `http` lub `https` (inne → `400 INVALID_URL`).
2. Składnia URI: parsowanie przez `new URL(url)` w Deno (błąd parsowania → `400 INVALID_URL`).
3. Hostname: nie może być adresem IP prywatnym ani loopback (patrz sekcja 3 — SSRF).
4. Długość: max 2048 znaków (→ `400 INVALID_URL`).

---

### 2.2 Odpowiedź `200` (bez zmian kontraktu)

```json
{
  "draft": {
    "name": "string | null",
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

Kontrakt odpowiedzi `200` jest identyczny dla trybów `text`, `image` i `url`. Klient nie musi rozróżniać trybu — wynik jest zawsze obiektem `draft`.

---

### 2.3 Kody błędów

Istniejące (bez zmian):

| Kod HTTP | Kod błędu | Opis |
|---|---|---|
| `400` | `INVALID_REQUEST` | Brakujące lub nieprawidłowe pola (ogólny) |
| `401` | — | Brak lub nieważny token |
| `402` | `AI_CREDITS_EXHAUSTED` | Pusta pula `draft` |
| `429` | — | Rate limit |

Nowe (PS-97):

| Kod HTTP | Kod błędu | Opis |
|---|---|---|
| `400` | `INVALID_URL` | Nieprawidłowy format URL (zły schemat, błąd parsowania, za długi) |
| `400` | `URL_INVALID_HOST` | Host wskazuje na prywatny lub zarezerwowany zakres IP (ochrona SSRF) |
| `422` | `URL_FETCH_FAILED` | Pobieranie strony nie powiodło się: HTTP ≥ 400, sieciowy błąd połączenia, zbyt wiele przekierowań (>5), końcowy URL z innym schematem niż `http`/`https` |
| `422` | `URL_TIMEOUT` | Przekroczono limit czasu pobierania (10 s) |
| `422` | `URL_CONTENT_TOO_LARGE` | Rozmiar pobranego HTML przekroczył 500 KB |

> Kredyt `draft` jest **zwracany** przy kodach `422` (błąd pobierania, timeout, za duże) — żądanie do modelu AI nie zostało wykonane. Przy `400` i `401` kredyt nie jest rezerwowany.

---

## 3. Logika scrapingu (nowa — Edge Function `ai`)

### 3.1 Ochrona przed SSRF

Przed wysłaniem żądania HTTP Edge Function rozwiązuje DNS i weryfikuje adres IP celu:

```typescript
// Blokowane zakresy (RFC 1918, RFC 5735, RFC 3927, metadata cloud):
const BLOCKED_RANGES = [
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    '127.0.0.0/8',       // loopback
    '169.254.0.0/16',    // link-local (AWS/GCP metadata: 169.254.169.254)
    '::1/128',           // IPv6 loopback
    'fc00::/7',          // IPv6 ULA
];
```

Jeśli rozwiązany adres IP należy do któregoś z powyższych zakresów → `400 URL_INVALID_HOST`. Dodatkowa weryfikacja końcowego URL po przekierowaniach (ostatni `response.url`).

### 3.2 Pobieranie HTML

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 s

const response = await fetch(url, {
    signal: controller.signal,
    redirect: 'follow',       // podążanie za przekierowaniami (max 5 — domyślnie Deno)
    headers: {
        'User-Agent': 'PychaSwiiatowa-Bot/1.0 (+https://pychaswiatowa.web.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pl,en;q=0.9',
    },
});
clearTimeout(timeoutId);
```

| Krok | Warunek | Zachowanie |
|---|---|---|
| Timeout | `AbortError` po 10 s | → `422 URL_TIMEOUT`, zwrot kredytu |
| HTTP status | `response.status >= 400` | → `422 URL_FETCH_FAILED`, zwrot kredytu |
| Końcowy URL | Schemat ≠ `http`/`https` po przekierowaniu | → `422 URL_FETCH_FAILED`, zwrot kredytu |
| Content-Length | Nagłówek > 500 KB (500 000 B) | → `422 URL_CONTENT_TOO_LARGE`, zwrot kredytu |
| Rozmiar odczytany | Bufor > 500 KB po odczycie | → `422 URL_CONTENT_TOO_LARGE`, zwrot kredytu |

### 3.3 Ekstrakcja tekstu z HTML

Po pobraniu HTML (string UTF-8) wykonywana jest prosta ekstrakcja tekstu w pamięci — bez zewnętrznych bibliotek (natywny Deno):

```typescript
function extractTextFromHtml(html: string): string {
    return html
        // Usuń bloki nieistotne dla treści (skrypty, style, nawigacja)
        .replace(/<(script|style|nav|footer|header|aside|noscript)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        // Usuń wszystkie pozostałe tagi HTML
        .replace(/<[^>]+>/g, ' ')
        // Zamień encje HTML na znaki
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#\d+;/g, ' ')
        // Kolaps białych znaków i nowych linii
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
```

Wyekstrahowany tekst jest następnie przekazywany do modelu AI **identycznie jak w trybie `"text"`** — ten sam prompt systemowy, ta sama normalizacja metadanych, te same ostrzeżenia.

### 3.4 Ograniczenie długości tekstu przed wysłaniem do AI

Jeśli wyekstrahowany tekst przekracza **50 000 znaków** (górny limit sensowny dla modelu), jest przycinany do pierwszych 50 000 znaków. Fakt przycięcia jest dodawany do `meta.warnings` w odpowiedzi.

---

## 4. Przepływ przetwarzania żądania `mode: "url"`

```
1. Walidacja JWT → autoryzacja (jak dotychczas)
2. Parsowanie body → walidacja pola `url` (schemat, składnia, długość)
3. Rezerwacja kredytu `draft` (jak w trybach text/image)
4. Rozwiązanie DNS + weryfikacja IP (SSRF) → błąd: zwrot kredytu + 400
5. fetch(url, { timeout: 10s, redirect: follow, max 5 przekierowań })
   → timeout: zwrot kredytu + 422 URL_TIMEOUT
   → HTTP error: zwrot kredytu + 422 URL_FETCH_FAILED
   → rozmiar: zwrot kredytu + 422 URL_CONTENT_TOO_LARGE
6. extractTextFromHtml(html) → opcjonalne przycięcie do 50 000 znaków
7. Wywołanie modelu AI (identycznie jak tryb "text" z wyekstrahowanym tekstem)
   → błąd modelu: zwrot kredytu (jak dotychczas)
8. Normalizacja metadanych draftu (jak dotychczas)
9. Odjęcie kredytu (jak dotychczas) + zwrot odpowiedzi 200
```

---

## 5. Pliki do modyfikacji

| Plik | Zakres zmian |
|---|---|
| `supabase/functions/ai/ai.service.ts` | Główna logika: nowy tryb `"url"`, `fetchAndExtractUrl()`, `isPrivateIp()`, `extractTextFromHtml()` |
| `supabase/functions/ai/ai.types.ts` | Rozszerzenie `AiRecipeDraftRequestDto` o `mode: "url"` i pole `url`; nowe kody błędów |
| `supabase/functions/ai/ai.service.spec.ts` | Testy jednostkowe: happy path, walidacja URL, SSRF, timeout, HTTP error, za duży content |

**Pliki bez zmian:**

| Plik | Powód |
|---|---|
| `shared/contracts/types.ts` | Kontrakt odpowiedzi `200` bez zmian |
| `supabase/functions/ai/ai-draft-metadata.ts` | Metadane draftu bez zmian |
| Wszystkie pliki frontendu | Zmiany UI opisane w `PS-97-ai-recipe-from-url-ui-plan.md` |
| Migracje SQL (`supabase/migrations/`) | Brak zmian schematu bazy |

---

## 6. Czego NIE robi PS-97

| Element | Uwaga |
|---|---|
| Ekstrakcja JSON-LD / microdata (recipe schema.org) | Optymalizacja przyszłości; PS-97 traktuje HTML jako surowy tekst |
| Obsługa stron za paywallem / wymagających logowania | Poza zakresem — komunikat `URL_FETCH_FAILED` z sugestią trybu tekstowego |
| Automatyczne ponawianie pobierania przy błędzie | Brak retry po stronie backendu; użytkownik może ponownie kliknąć „Generuj" |
| Nowy endpoint / Edge Function | Modyfikacja istniejącej funkcji `ai` |
| Migracja bazy danych | Brak |
| Zmiana mechanizmu kredytów `draft` | Brak — identyczne zasady jak dla `text` i `image` |
| Scraping przez zewnętrzne API (ScrapingBee, Apify itp.) | Natywny `fetch` Deno — brak nowych zewnętrznych zależności i kosztów |
