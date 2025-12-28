# CORS Headers Fix - Bug Resolution

## Problem

Na produkcji endpoint `/ai/recipes/draft` zwracał tylko "CORS ERROR" zamiast oczekiwanej odpowiedzi JSON.

### Symptomy
- Frontend otrzymywał błąd CORS
- Payload był poprawny
- Autentykacja była poprawna (token JWT)
- Błąd występował tylko na produkcji (Supabase Edge Functions)

## Analiza Przyczyny

### Główny Problem
Funkcja `handleError` w `_shared/errors.ts` zwracała Response **bez CORS headers**, co powodowało że przeglądarka blokow ała odpowiedź jako CORS error, nawet jeśli sam endpoint działał poprawnie.

### Szczegóły Techniczne

1. **Przepływ błędu**:
   - Request trafia do Edge Function
   - Jeśli wystąpi błąd w handlerze (np. błąd autentykacji), jest on łapany przez try-catch
   - `handleError` zwraca Response z JSON error **BEZ** CORS headers
   - Przeglądarka blokuje odpowiedź z powodu braku CORS headers
   - Frontend otrzymuje generyczny "CORS ERROR" zamiast prawdziwego błędu

2. **Arch  itektura przed naprawą**:
   ```
   index.ts (main entry)
   ├── Handle OPTIONS (CORS preflight) ✓
   ├── Try:
   │   ├── router(req)
   │   └── addCorsHeaders(response) ← Dodawane TYLKO dla success
   └── Catch:
       └── addCorsHeaders(errorResponse) ← Dodawane, ALE handleError już zwrócił response BEZ CORS
   ```

3. **Problem w handlerach**:
   - Niektóre response'y w handlerach były tworzone inline bez CORS headers
   - `handleError` zwracał response bez CORS headers
   - Brak centralizacji logiki CORS

## Rozwiązanie

### 1. Utworzono Shared CORS Utility

Plik: `supabase/functions/_shared/cors.ts`

```typescript
export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, X-Client-Info, Content-Type, Apikey',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

export function addCorsHeaders(response: Response): Response {
    // ... implementation
}

export function createCorsPreflightResponse(): Response {
    // ... implementation
}
```

### 2. Zaktualizowano Error Handler

Plik: `supabase/functions/_shared/errors.ts`

- Dodano import CORS headers
- Wszystkie response'y z `createErrorResponse` zawierają CORS headers
- Wszystkie response'y z `handleError` zawierają CORS headers

```typescript
import { corsHeaders } from './cors.ts';

export function createErrorResponse(error: ApplicationError): Response {
    return new Response(JSON.stringify(error.toJSON()), {
        status: error.statusCode,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,  // ← Dodane
        },
    });
}
```

### 3. Zaktualizowano AI Handlers

Plik: `supabase/functions/ai/ai.handlers.ts`

- Dodano import CORS headers
- Wszystkie funkcje tworzące response'y dodają CORS headers:
  - `createSuccessResponse`
  - `createValidationErrorResponse`
  - `createMethodNotAllowedResponse`
  - `createPayloadTooLargeResponse`
  - `createUnprocessableEntityResponse`
  - `createImageUnprocessableEntityResponse`
  - `createForbiddenPremiumResponse`
  - `createNotFoundResponse`
  - `createTooManyRequestsResponse`
- Inline response'y również mają CORS headers

### 4. Zaktualizowano AI Index

Plik: `supabase/functions/ai/index.ts`

- Usunięto lokalne definicje CORS headers (używa shared utility)
- Usunięto `addCorsHeaders` wrapper (nie jest już potrzebny, bo wszystkie response'y już mają CORS)
- Dodano CORS headers do ostatecznego fallback catch block

```typescript
import { createCorsPreflightResponse, corsHeaders } from '../_shared/cors.ts';

// Handle OPTIONS
if (req.method === 'OPTIONS') {
    return createCorsPreflightResponse();
}

// Router już zwraca response z CORS headers
return await aiRouter(req);
```

## Status Implementacji

### ✅ Naprawione
- [x] `_shared/cors.ts` - utworzony
- [x] `_shared/errors.ts` - zaktualizowany
- [x] `ai/ai.handlers.ts` - zaktualizowany
- [x] `ai/index.ts` - zaktualizowany

### 🔄 Do Zrobienia
Pozostałe Edge Functions wymagają podobnej aktualizacji:

- [ ] `categories/` - index.ts i handlers
- [ ] `collections/` - index.ts i handlers
- [ ] `explore/` - index.ts i handlers
- [ ] `me/` - index.ts i handlers
- [ ] `profile/` - index.ts i handlers
- [ ] `public/` - index.ts i handlers
- [ ] `recipes/` - index.ts i handlers
- [ ] `search/` - index.ts i handlers
- [ ] `tags/` - index.ts i handlers

## Testowanie

### Test na Produkcji
Endpoint: `POST https://fxgonghylivohevdrdnt.supabase.co/functions/v1/ai/recipes/draft`

**Przed naprawą**:
- Response: CORS ERROR
- Brak dostępu do prawdziwego błędu

**Po naprawie**:
- Response: Prawidłowy JSON z draftem lub error z odpowiednim kodem HTTP
- CORS headers obecne w każdej odpowiedzi
- Frontend może odczytać prawdziwy error message

### Testy Lokalne
```bash
# Deploy funkcji na produkcję
supabase functions deploy ai

# Test z prawidłowym tokenem
curl -X POST https://fxgonghylivohevdrdnt.supabase.co/functions/v1/ai/recipes/draft \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "text", "text": "...", "output_format": "pycha_recipe_draft_v1", "language": "pl"}'

# Test bez tokenu (powinien zwrócić 401 z CORS headers)
curl -X POST https://fxgonghylivohevdrdnt.supabase.co/functions/v1/ai/recipes/draft \
  -H "Content-Type: application/json" \
  -d '{"source": "text", "text": "...", "output_format": "pycha_recipe_draft_v1", "language": "pl"}'
```

## Wnioski

1. **CORS headers muszą być dodawane na poziomie tworzenia response**, nie jako wrapper po fakcie
2. **Centralizacja logiki CORS** w shared utility zapobiega inconsistencjom
3. **Każda Edge Function** powinna używać tego samego wzorca dla spójności
4. **Error responses są równie ważne** jak success responses - frontend potrzebuje dostępu do error details

## Następne Kroki

1. Deploy naprawionej funkcji `ai` na produkcję
2. Przetestować na produkcji z prawdziwymi requestami
3. Po potwierdzeniu działania, systematycznie zaktualizować pozostałe Edge Functions
4. Dodać testy E2E dla CORS headers w różnych scenariuszach error

