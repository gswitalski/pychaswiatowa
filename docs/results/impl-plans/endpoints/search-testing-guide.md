# Przewodnik Testowania Endpointa Wyszukiwania

## Szybki Start

### 1. Uruchomienie Supabase Lokalnie

```bash
# Z głównego katalogu projektu
supabase start

# Sprawdź czy wszystko działa
supabase status
```

### 2. Uruchomienie Edge Function Search

```bash
# Serwuj funkcję search lokalnie
supabase functions serve search --env-file supabase/.env.local

# Lub wszystkie funkcje
supabase functions serve
```

### 3. Uruchomienie Aplikacji Angular

```bash
# W osobnym terminalu
npm start

# Aplikacja dostępna na http://localhost:4200
```

## Testowanie Backend (curl)

### Uzyskanie JWT Token

1. Zaloguj się przez aplikację Angular lub użyj Supabase CLI
2. Sprawdź token w Developer Tools → Application → Local Storage → `sb-<project>-auth-token`

### Test 1: Poprawne wyszukiwanie

```bash
curl -X GET "http://localhost:54321/functions/v1/search/global?q=pizza" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json"
```

**Oczekiwany wynik (200 OK):**
```json
{
    "recipes": [
        {
            "id": 1,
            "name": "Pizza Margherita",
            "category": "Obiad"
        }
    ],
    "collections": []
}
```

### Test 2: Zbyt krótkie zapytanie

```bash
curl -X GET "http://localhost:54321/functions/v1/search/global?q=a" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Oczekiwany wynik (400 Bad Request):**
```json
{
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "errors": [
        {
            "field": "q",
            "message": "Search query must be at least 2 characters long"
        }
    ]
}
```

### Test 3: Brak parametru q

```bash
curl -X GET "http://localhost:54321/functions/v1/search/global" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Oczekiwany wynik (400 Bad Request):**
```json
{
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "errors": [
        {
            "field": "q",
            "message": "Required"
        }
    ]
}
```

### Test 4: Brak autoryzacji

```bash
curl -X GET "http://localhost:54321/functions/v1/search/global?q=pizza"
```

**Oczekiwany wynik (401 Unauthorized):**
```json
{
    "code": "UNAUTHORIZED",
    "message": "Missing Authorization header"
}
```

### Test 5: Nieprawidłowy token

```bash
curl -X GET "http://localhost:54321/functions/v1/search/global?q=pizza" \
  -H "Authorization: Bearer invalid_token_here"
```

**Oczekiwany wynik (401 Unauthorized):**
```json
{
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired token"
}
```

### Test 6: CORS Preflight

```bash
curl -X OPTIONS "http://localhost:54321/functions/v1/search/global" \
  -H "Origin: http://localhost:4200" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: Authorization"
```

**Oczekiwany wynik (204 No Content):**
Headers powinny zawierać:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Authorization, X-Client-Info, Content-Type`

## Testowanie Frontend (Aplikacja)

### Przygotowanie danych testowych

1. Zaloguj się jako użytkownik testowy
2. Dodaj kilka przepisów z różnymi nazwami:
   - "Pizza Margherita"
   - "Sernik klasyczny"
   - "Zupa pomidorowa"
3. Utwórz kilka kolekcji:
   - "Ulubione dania"
   - "Desery świąteczne"

### Scenariusze Testowe

#### ST-001: Podstawowe wyszukiwanie

**Kroki:**
1. Otwórz aplikację (http://localhost:4200)
2. Zaloguj się
3. Kliknij w pole Omnibox w górnym pasku
4. Wpisz "pizza"

**Oczekiwany rezultat:**
- Pojawia się dropdown z wynikami
- Sekcja "Przepisy" zawiera "Pizza Margherita"
- Każdy wynik pokazuje nazwę i kategorię

#### ST-002: Wyszukiwanie bez wyników

**Kroki:**
1. W Omnibox wpisz "xyzabc123"

**Oczekiwany rezultat:**
- Dropdown pokazuje komunikat "Brak wyników"
- Nie ma błędów w konsoli

#### ST-003: Debounce (opóźnienie wywołania)

**Kroki:**
1. Szybko wpisz w Omnibox: "p", "pi", "piz", "pizz", "pizza"
2. Otwórz DevTools → Network tab
3. Filtruj po "search"

**Oczekiwany rezultat:**
- Tylko jedno wywołanie API po 300ms od ostatniego znaku
- Nie ma 5 oddzielnych requestów

#### ST-004: Minimalna długość zapytania

**Kroki:**
1. Wpisz w Omnibox tylko "a"

**Oczekiwany rezultat:**
- Brak wywołania API (sprawdź Network tab)
- Dropdown nie pojawia się lub jest pusty

#### ST-005: Nawigacja z wyników

**Kroki:**
1. Wpisz "pizza"
2. Kliknij na wynik "Pizza Margherita"

**Oczekiwany rezultat:**
- Przekierowanie do `/recipes/{id}`
- Omnibox jest wyczyszczony
- Dropdown znika

#### ST-006: Wyszukiwanie kolekcji

**Kroki:**
1. Wpisz "ulubione"

**Oczekiwany rezultat:**
- Sekcja "Kolekcje" zawiera "Ulubione dania"
- Kliknięcie przenosi do `/collections/{id}`

#### ST-007: Wyszukiwanie case-insensitive

**Kroki:**
1. Wpisz "PIZZA"
2. Wpisz "pizza"
3. Wpisz "PiZzA"

**Oczekiwany rezultat:**
- Wszystkie trzy wyszukiwania zwracają te same wyniki

#### ST-008: Znaki specjalne w zapytaniu

**Kroki:**
1. Dodaj przepis o nazwie "Kurczak po tajsku & warzywa"
2. Wpisz "kurczak & warzywa"

**Oczekiwany rezultat:**
- Przepis jest znaleziony
- Znaki specjalne są poprawnie enkodowane w URL

## Monitorowanie i Debugowanie

### Logi Backend (Supabase Functions)

```bash
# Obserwuj logi w czasie rzeczywistym
supabase functions serve search --no-verify-jwt

# Logi zawierają:
# - Timestamp
# - Log level (info, warn, error)
# - Message
# - Context (userId, query, resultsCount)
```

**Przykładowe logi:**
```json
{
    "level": "info",
    "message": "Handling GET /search/global request",
    "timestamp": "2024-01-15T10:30:00.000Z"
}
{
    "level": "info",
    "message": "Executing global search",
    "timestamp": "2024-01-15T10:30:00.100Z",
    "context": {
        "userId": "a1b2c3...",
        "query": "pizza"
    }
}
{
    "level": "info",
    "message": "Global search completed successfully",
    "timestamp": "2024-01-15T10:30:00.250Z",
    "context": {
        "userId": "a1b2c3...",
        "query": "pizza",
        "recipesCount": 2,
        "collectionsCount": 0
    }
}
```

### Logi Frontend (Angular)

**DevTools Console:**
```javascript
// SearchService wykonuje wywołanie
// Sprawdź Network tab:
Request URL: http://localhost:54321/functions/v1/search/global?q=pizza
Request Method: GET
Status Code: 200 OK

// Response:
{
    "recipes": [...],
    "collections": [...]
}
```

### Typowe Problemy i Rozwiązania

#### Problem: 401 Unauthorized

**Przyczyna:** Wygasły lub brakujący JWT token

**Rozwiązanie:**
1. Sprawdź czy użytkownik jest zalogowany
2. Sprawdź token w Local Storage
3. Wyloguj się i zaloguj ponownie

#### Problem: CORS Error

**Przyczyna:** Brakujące CORS headers

**Rozwiązanie:**
1. Sprawdź czy `index.ts` dodaje CORS headers
2. Sprawdź czy funkcja jest uruchomiona lokalnie
3. Zrestartuj `supabase functions serve`

#### Problem: Puste wyniki mimo istniejących danych

**Przyczyna:** RLS blokuje dostęp lub dane są usunięte (soft delete)

**Rozwiązanie:**
1. Sprawdź polityki RLS w Supabase Dashboard
2. Sprawdź czy przepisy mają `deleted_at IS NULL`
3. Sprawdź czy `user_id` w przepisach zgadza się z zalogowanym użytkownikiem

#### Problem: Funkcja nie startuje lokalnie

**Przyczyna:** Brakujące zmienne środowiskowe lub błąd w kodzie

**Rozwiązanie:**
```bash
# Sprawdź logi startowe
supabase functions serve search --debug

# Sprawdź czy plik index.ts się kompiluje
deno check supabase/functions/search/index.ts

# Sprawdź env variables
cat supabase/.env.local
```

## Automatyzacja Testów (Przyszłość)

### Unit Tests (Vitest)

```typescript
// search.service.spec.ts
describe('SearchService', () => {
    it('should call search endpoint with encoded query', () => {
        // Mock supabase.functions.invoke
        // Assert correct URL with encoded query
    });
    
    it('should return empty results on error', () => {
        // Mock error response
        // Assert empty results
    });
});
```

### E2E Tests (Playwright)

```typescript
// search.e2e.spec.ts
test('should search and navigate to recipe', async ({ page }) => {
    await page.goto('http://localhost:4200');
    await page.fill('[data-testid="omnibox"]', 'pizza');
    await page.waitForSelector('[data-testid="search-results"]');
    await page.click('text=Pizza Margherita');
    await expect(page).toHaveURL(/\/recipes\/\d+/);
});
```

## Checklist przed Wdrożeniem

- [ ] Wszystkie testy manualne przechodzą
- [ ] Brak błędów w konsoli przeglądarki
- [ ] Brak błędów w logach Supabase Functions
- [ ] CORS działa poprawnie
- [ ] Autentykacja działa poprawnie
- [ ] Walidacja query parameter działa
- [ ] Debounce działa (tylko jedno wywołanie API)
- [ ] Limit wyników jest przestrzegany (max 10 per type)
- [ ] RLS działa - użytkownik widzi tylko swoje dane
- [ ] Performance jest akceptowalny (< 500ms response time)
- [ ] Dokumentacja jest aktualna

## Metryki Wydajności

### Target Performance

- **Response Time:** < 300ms (p95)
- **Error Rate:** < 1%
- **Availability:** > 99%

### Monitorowanie (Produkcja)

Po wdrożeniu na produkcję, monitoruj w Supabase Dashboard:
- Function Invocations (liczba wywołań)
- Execution Time (czas wykonania)
- Error Rate (procent błędów)
- Logs (szczegółowe logi)

## Kontakt i Wsparcie

W przypadku problemów:
1. Sprawdź logi backendu i frontendu
2. Przejrzyj sekcję "Typowe Problemy" powyżej
3. Sprawdź dokumentację Supabase: https://supabase.com/docs

