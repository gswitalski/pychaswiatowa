# API Endpoints Implementation Plan: PS-64 — Model danych i egzekwowanie limitów kredytów AI

## 1. Przegląd punktów końcowych

### 1.1. Cel

PS-64 wprowadza system kredytów AI per użytkownik, który kontroluje dostęp i koszty wywołań modeli AI. Implementacja obejmuje:

- **Nową tabelę** `user_ai_credits` z osobnymi pulami na `draft` i `image`, obsługującą zarówno limit dożywotni (Free) jak i miesięczny (Premium).
- **Współdzielony helper** `checkAndDeductCredits` — atomową weryfikację i odejmowanie kredytów, wywoływaną przez endpointy AI.
- **Trzy nowe endpointy**: `GET /ai/credits`, `POST /internal/ai-credits/monthly-reset`, `PATCH /admin/users/{userId}/ai-credits`.
- **Trzy modyfikacje**: `POST /ai/recipes/draft`, `POST /ai/recipes/image` (dodanie weryfikacji kredytów), `GET /me` (rozszerzenie odpowiedzi o `ai_credits`).

### 1.2. Zakres HTTP

| Endpoint | Rodzaj zmiany | Cel |
|---|---|---|
| `GET /ai/credits` | Nowy | Bieżący stan kredytów zalogowanego użytkownika |
| `POST /ai/recipes/draft` | Modyfikacja | Weryfikacja kredytów `draft` przed wywołaniem LLM |
| `POST /ai/recipes/image` | Modyfikacja | Weryfikacja kredytów `image` przed wywołaniem modelu graficznego |
| `POST /internal/ai-credits/monthly-reset` | Nowy (worker) | Cron — reset kredytów użytkowników Premium |
| `PATCH /admin/users/{userId}/ai-credits` | Nowy (admin) | Ręczna korekta kredytów przez admina |
| `GET /me` | Rozszerzenie | Pole `ai_credits` w odpowiedzi bootstrapu App Shell |

---

## 2. Szczegóły żądań

### 2.1. `GET /ai/credits`

- **Metoda HTTP:** `GET`
- **Struktura URL:** `/functions/v1/ai/credits`
- **Parametry:** brak
- **Request Body:** brak
- **Autoryzacja:** Bearer JWT (wymagany); każda rola (`user`, `premium`, `admin`)

### 2.2. `POST /ai/recipes/draft` *(modyfikacja)*

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/ai/recipes/draft`
- **Parametry:** brak
- **Request Body:** bez zmian — `AiRecipeDraftRequestDto`
- **Autoryzacja:** Bearer JWT; role `user`, `premium`, `admin` (rozszerzenie feature gatingu z `premium`/`admin` na `user`)

### 2.3. `POST /ai/recipes/image` *(modyfikacja)*

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/ai/recipes/image`
- **Parametry:** brak
- **Request Body:** bez zmian — `AiRecipeImageRequestDto`
- **Autoryzacja:** Bearer JWT; role `premium`, `admin` (feature gating pozostaje bez zmian)

### 2.4. `POST /internal/ai-credits/monthly-reset` *(worker)*

- **Metoda HTTP:** `POST`
- **Struktura URL:** `/functions/v1/internal/ai-credits/monthly-reset`
- **Parametry:** brak
- **Request Body:** brak
- **Autoryzacja:** Nagłówek `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` lub dedykowany `x-cron-secret`; endpoint niedostępny publicznie

### 2.5. `PATCH /admin/users/{userId}/ai-credits` *(admin)*

- **Metoda HTTP:** `PATCH`
- **Struktura URL:** `/functions/v1/admin/users/{userId}/ai-credits`
- **Parametry:**
  - Wymagane: `userId` (ścieżka, UUID)
  - Opcjonalne: brak parametrów query
- **Request Body** (wszystkie pola opcjonalne — semantyka PATCH):
  ```typescript
  // UpdateAdminUserAiCreditsCommand
  {
      draft_credits_total?: number;   // >= 0
      draft_credits_used?: number;    // >= 0, musi być <= draft_credits_total
      image_credits_total?: number;   // >= 0
      image_credits_used?: number;    // >= 0, musi być <= image_credits_total
      limit_type?: 'lifetime' | 'monthly';
      next_reset_at?: string | null;  // ISO 8601; wymagany jeśli limit_type = 'monthly'
  }
  ```
- **Autoryzacja:** Bearer JWT; rola `admin` wymagana

---

## 3. Wykorzystywane typy

### 3.1. Nowe typy do dodania w `shared/contracts/types.ts`

```typescript
// #region --- AI Credits ---

/**
 * Limit type for AI credits.
 * - 'lifetime': Free users — fixed quota, never resets
 * - 'monthly': Premium users — resets monthly
 * - 'unlimited': Admin users — no limits apply
 */
export type AiCreditLimitType = 'lifetime' | 'monthly' | 'unlimited';

/**
 * DTO for a single AI credit type balance (draft or image).
 */
export interface AiCreditBalanceDto {
    total: number | null;      // null for admin (unlimited)
    used: number | null;       // null for admin (unlimited)
    remaining: number | null;  // null for admin (unlimited)
}

/**
 * Response DTO for GET /ai/credits endpoint.
 */
export interface AiCreditsResponseDto {
    limit_type: AiCreditLimitType;
    draft: AiCreditBalanceDto;
    image: AiCreditBalanceDto;
    next_reset_at: string | null;  // ISO 8601; null for 'lifetime' and 'unlimited'
}

/**
 * Error details returned with 402 Payment Required (AI_CREDITS_EXHAUSTED).
 */
export interface AiCreditsExhaustedErrorDto {
    error: 'AI_CREDITS_EXHAUSTED';
    message: string;
    details: {
        credit_type: 'draft' | 'image';
        credits_used: number;
        credits_total: number;
        limit_type: AiCreditLimitType;
        next_reset_at?: string | null;
        upgrade_url: string;
    };
}

/**
 * Command model for PATCH /admin/users/{userId}/ai-credits.
 * All fields are optional (PATCH semantics).
 */
export interface UpdateAdminUserAiCreditsCommand {
    draft_credits_total?: number;
    draft_credits_used?: number;
    image_credits_total?: number;
    image_credits_used?: number;
    limit_type?: 'lifetime' | 'monthly';
    next_reset_at?: string | null;
}

/**
 * Response DTO for PATCH /admin/users/{userId}/ai-credits.
 */
export interface UpdateAdminUserAiCreditsResponseDto {
    user_id: string;
    draft: AiCreditBalanceDto;
    image: AiCreditBalanceDto;
    limit_type: AiCreditLimitType;
    next_reset_at: string | null;
    updated_at: string;
}

/**
 * Response DTO for POST /internal/ai-credits/monthly-reset.
 */
export interface AiCreditsMonthlyResetResponseDto {
    reset_count: number;
    processed_at: string;  // ISO 8601
}

/**
 * Compact AI credits summary embedded in GET /me response.
 */
export interface MeAiCreditsDto {
    draft_remaining: number | null;
    image_remaining: number | null;
    limit_type: AiCreditLimitType;
    next_reset_at: string | null;
}

// #endregion
```

### 3.2. Rozszerzenie `MeDto` w `shared/contracts/types.ts`

```typescript
// Zastąpić istniejący MeDto:
export interface MeDto {
    id: string;
    username: string;
    app_role: AppRole;
    ai_credits: MeAiCreditsDto | null;  // null tylko jeśli wiersz jeszcze nie istnieje (edge case)
}
```

---

## 4. Szczegóły odpowiedzi

### 4.1. `GET /ai/credits`

**200 OK — użytkownik Premium:**
```json
{
    "limit_type": "monthly",
    "draft": { "total": 20, "used": 7, "remaining": 13 },
    "image": { "total": 5, "used": 2, "remaining": 3 },
    "next_reset_at": "2026-10-09T22:00:00Z"
}
```

**200 OK — użytkownik Free:**
```json
{
    "limit_type": "lifetime",
    "draft": { "total": 3, "used": 1, "remaining": 2 },
    "image": { "total": 0, "used": 0, "remaining": 0 },
    "next_reset_at": null
}
```

**200 OK — admin:**
```json
{
    "limit_type": "unlimited",
    "draft": { "total": null, "used": null, "remaining": null },
    "image": { "total": null, "used": null, "remaining": null },
    "next_reset_at": null
}
```

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Pomyślne pobranie |
| `401 Unauthorized` | Brak lub nieważny JWT |

### 4.2. `POST /ai/recipes/draft` *(modyfikacja)*

**Dodany kod błędu 402:**
```json
{
    "error": "AI_CREDITS_EXHAUSTED",
    "message": "Wyczerpano pulę kredytów AI. Przejdź na Premium lub dokup pakiet kredytów.",
    "details": {
        "credit_type": "draft",
        "credits_used": 3,
        "credits_total": 3,
        "limit_type": "lifetime",
        "upgrade_url": "/pricing"
    }
}
```

Pozostałe odpowiedzi (`200`, `400`, `401`, `413`, `422`, `429`, `500`) bez zmian.

### 4.3. `POST /ai/recipes/image` *(modyfikacja)*

**Dodany kod błędu 402:**
```json
{
    "error": "AI_CREDITS_EXHAUSTED",
    "message": "Wyczerpano pulę kredytów AI na generowanie zdjęć. Dokup pakiet kredytów lub poczekaj na reset miesięczny.",
    "details": {
        "credit_type": "image",
        "credits_used": 5,
        "credits_total": 5,
        "limit_type": "monthly",
        "next_reset_at": "2026-10-09T22:00:00Z",
        "upgrade_url": "/pricing"
    }
}
```

Pozostałe odpowiedzi bez zmian.

### 4.4. `POST /internal/ai-credits/monthly-reset`

**200 OK:**
```json
{
    "reset_count": 12,
    "processed_at": "2026-10-09T02:00:00Z"
}
```

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Worker wykonał się (nawet gdy `reset_count = 0`) |
| `401 Unauthorized` | Brak lub nieważny service role secret |
| `500 Internal Server Error` | Błąd bazy danych |

### 4.5. `PATCH /admin/users/{userId}/ai-credits`

**200 OK:**
```json
{
    "user_id": "uuid",
    "draft": { "total": 10, "used": 0, "remaining": 10 },
    "image": { "total": 3, "used": 0, "remaining": 3 },
    "limit_type": "monthly",
    "next_reset_at": "2026-10-09T22:00:00Z",
    "updated_at": "2026-09-09T20:00:00Z"
}
```

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Pomyślna aktualizacja |
| `400 Bad Request` | Błędy walidacji (patrz sekcja 6) |
| `401 Unauthorized` | Brak JWT |
| `403 Forbidden` | JWT bez roli `admin` |
| `404 Not Found` | Użytkownik o podanym `userId` nie istnieje |

### 4.6. `GET /me` *(rozszerzenie)*

**Rozszerzone pole `ai_credits`:**
```json
{
    "id": "uuid",
    "username": "string",
    "app_role": "user | premium | admin",
    "ai_credits": {
        "draft_remaining": 1,
        "image_remaining": 0,
        "limit_type": "lifetime",
        "next_reset_at": null
    }
}
```

---

## 5. Przepływ danych

### 5.1. Migracja bazy danych

Przed implementacją endpointów należy przygotować i uruchomić migrację:

```sql
-- 1. Enum
CREATE TYPE ai_credit_limit_type AS ENUM ('lifetime', 'monthly');

-- 2. Tabela
CREATE TABLE user_ai_credits (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    draft_credits_total  smallint NOT NULL DEFAULT 3,
    draft_credits_used   smallint NOT NULL DEFAULT 0,
    image_credits_total  smallint NOT NULL DEFAULT 0,
    image_credits_used   smallint NOT NULL DEFAULT 0,
    limit_type           ai_credit_limit_type NOT NULL DEFAULT 'lifetime',
    next_reset_at        timestamptz,
    credits_activated_at timestamptz NOT NULL DEFAULT now(),
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

-- 3. RLS
ALTER TABLE user_ai_credits ENABLE ROW LEVEL SECURITY;

-- Użytkownik może odczytać tylko własne kredyty
CREATE POLICY "user_can_read_own_credits"
    ON user_ai_credits FOR SELECT
    USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE wyłącznie przez service role (bypass RLS)

-- 4. Trigger updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON user_ai_credits
    FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 5. Indeks
CREATE INDEX idx_user_ai_credits_monthly_reset
    ON user_ai_credits (next_reset_at)
    WHERE limit_type = 'monthly' AND next_reset_at IS NOT NULL;
```

### 5.2. Helper `checkAndDeductCredits` — `supabase/functions/_shared/ai-credits.ts`

```
Wejście: (supabaseAdmin, userId, creditType: 'draft' | 'image', appRole)

1. Jeśli appRole === 'admin' → return (pomiń całą logikę)
2. BEGIN TRANSACTION
3. SELECT ... FOR UPDATE WHERE user_id = userId
4. Jeśli wiersz nie istnieje:
   - INSERT z wartościami dla roli 'user'
     (draft_credits_total = AI_DRAFT_CREDITS_FREE, image_credits_total = 0, limit_type = 'lifetime')
   - Ponowny SELECT FOR UPDATE
5. Jeśli limit_type === 'monthly' AND now() >= next_reset_at:
   - UPDATE draft_credits_used = 0, image_credits_used = 0,
           next_reset_at = next_reset_at + INTERVAL '1 month'
6. Oblicz remaining = *_credits_total - *_credits_used
7. Jeśli remaining <= 0 → ROLLBACK + throw AiCreditsExhaustedError (402)
8. COMMIT (bez odjęcia — odejmowanie po sukcesie AI)
9. Zwróć { row, creditField } do endpointu

Po pomyślnym wywołaniu AI (poza transakcją):
10. UPDATE user_ai_credits SET *_credits_used = *_credits_used + 1, updated_at = now()
    WHERE user_id = userId
```

> **Kluczowe:** kroki 2–8 są w transakcji. Krok 10 jest odrębną aktualizacją **po** sukcesie AI. Jeśli wywołanie AI zawiedzie, kredyt nie jest odejmowany.

### 5.3. `GET /ai/credits` — przepływ

```
Request → JWT verify → getUser()
→ Jeśli appRole === 'admin' → zwróć odpowiedź "unlimited" (bez DB)
→ SELECT user_ai_credits WHERE user_id = userId
→ Jeśli brak wiersza → zwróć wartości domyślne dla roli 'user' (bez INSERT)
→ Mapuj na AiCreditsResponseDto → 200 OK
```

### 5.4. `POST /ai/recipes/draft` — zmieniony przepływ

```
[Stary]:  JWT → feature gating (premium/admin) → wywołanie LLM → 200
[Nowy]:   JWT → feature gating (user/premium/admin) → checkAndDeductCredits('draft')
          → wywołanie LLM → deductCreditAfterSuccess() → 200
```

### 5.5. `POST /ai/recipes/image` — zmieniony przepływ

```
[Stary]:  JWT → feature gating (premium/admin) → wywołanie AI image → 200
[Nowy]:   JWT → feature gating (premium/admin) → checkAndDeductCredits('image')
          → wywołanie AI image → deductCreditAfterSuccess() → 200
```

### 5.6. `POST /internal/ai-credits/monthly-reset` — przepływ

```
Request → Weryfikacja service role secret
→ SELECT user_ai_credits WHERE limit_type = 'monthly' AND next_reset_at <= now()
→ Dla każdego wiersza (batch UPDATE):
    UPDATE draft_credits_used = 0, image_credits_used = 0,
           next_reset_at = next_reset_at + INTERVAL '1 month',
           updated_at = now()
→ Zwróć { reset_count, processed_at } → 200 OK
```

### 5.7. `PATCH /admin/users/{userId}/ai-credits` — przepływ

```
Request → JWT verify → weryfikacja roli 'admin'
→ Walidacja Zod body
→ SELECT auth.users WHERE id = userId (sprawdzenie istnienia)
→ Jeśli brak → 404
→ UPSERT user_ai_credits (tylko podane pola)
→ SELECT zaktualizowany wiersz
→ Mapuj na UpdateAdminUserAiCreditsResponseDto → 200 OK
```

### 5.8. `GET /me` — zmieniony przepływ

```
[Stary]:  JWT → getUser() → profil → MeDto (id, username, app_role)
[Nowy]:   JWT → getUser() → profil + SELECT user_ai_credits WHERE user_id
          → Jeśli admin: ai_credits = { draft_remaining: null, ... limit_type: 'unlimited' }
          → Jeśli brak wiersza: ai_credits = defaults dla 'user'
          → MeDto rozszerzone o ai_credits
```

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie

- Wszystkie publiczne endpointy wymagają `Authorization: Bearer <JWT>` weryfikowanego przez `supabase.auth.getUser()`.
- Worker `/internal/ai-credits/monthly-reset` weryfikuje `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` lub dedykowany nagłówek `x-cron-secret` skonfigurowany w Supabase Cron. Brak lub niezgodność → `401`.
- Nagłówki autoryzacyjne **nigdy nie są logowane**.

### 6.2. Autoryzacja

- `PATCH /admin/users/{userId}/ai-credits`: JWT claim `app_role === 'admin'` wymagany → brak → `403`.
- Każdy zapis do `user_ai_credits` odbywa się przez service role (Edge Function) — RLS blokuje bezpośrednie UPDATE/DELETE od klientów.
- `GET /ai/credits` i `GET /me` (pole `ai_credits`) zwracają tylko dane aktualnie zalogowanego użytkownika (RLS + JWT `user_id`).

### 6.3. Ochrona przed race condition

- `checkAndDeductCredits` używa `SELECT FOR UPDATE` w transakcji, co zapobiega równoczesnemu obejściu limitu przez dwa żądania tego samego użytkownika.
- Krok dedukcji (po sukcesie AI) jest zwykłym `UPDATE` — jeśli wywołanie AI zawiedzie, kredyt nie jest odejmowany.

### 6.4. Inicjalizacja wiersza

- Wiersz `user_ai_credits` tworzony jest **zawsze z domyślnymi wartościami dla roli `user`**, niezależnie od wartości podanych w żądaniu. Uniemożliwia to samodzielne przyznanie sobie wyższych limitów.
- Wartości domyślne konfigurowane przez zmienne środowiskowe: `AI_DRAFT_CREDITS_FREE`, `AI_DRAFT_CREDITS_PREMIUM`, `AI_IMAGE_CREDITS_PREMIUM`.

### 6.5. Walidacja danych wejściowych

Zod schema dla `PATCH /admin/users/{userId}/ai-credits`:
```typescript
const UpdateAdminUserAiCreditsSchema = z.object({
    draft_credits_total: z.number().int().nonnegative().optional(),
    draft_credits_used:  z.number().int().nonnegative().optional(),
    image_credits_total: z.number().int().nonnegative().optional(),
    image_credits_used:  z.number().int().nonnegative().optional(),
    limit_type:          z.enum(['lifetime', 'monthly']).optional(),
    next_reset_at:       z.string().datetime().nullable().optional(),
}).refine(
    (d) => d.draft_credits_used === undefined || d.draft_credits_total === undefined
           || d.draft_credits_used <= d.draft_credits_total,
    { message: 'draft_credits_used nie może być większe niż draft_credits_total' }
).refine(
    (d) => d.image_credits_used === undefined || d.image_credits_total === undefined
           || d.image_credits_used <= d.image_credits_total,
    { message: 'image_credits_used nie może być większe niż image_credits_total' }
);
```

---

## 7. Obsługa błędów

### 7.1. Kody błędów — zestawienie

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `401 Unauthorized` | `UNAUTHORIZED` | Wszystkie chronione | Brak lub nieważny JWT |
| `402 Payment Required` | `AI_CREDITS_EXHAUSTED` | `/ai/recipes/draft`, `/ai/recipes/image` | Brak dostępnych kredytów |
| `403 Forbidden` | `FORBIDDEN` | `PATCH /admin/users/{userId}/ai-credits` | JWT bez roli `admin` |
| `404 Not Found` | `USER_NOT_FOUND` | `PATCH /admin/users/{userId}/ai-credits` | Użytkownik nie istnieje |
| `400 Bad Request` | `VALIDATION_ERROR` | `PATCH /admin/users/{userId}/ai-credits` | Błędy Zod (used > total, ujemne) |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Wszystkie | Błąd bazy danych lub niespodziewany błąd |

### 7.2. Format błędu `402`

```json
{
    "error": "AI_CREDITS_EXHAUSTED",
    "message": "Wyczerpano pulę kredytów AI. Przejdź na Premium lub dokup pakiet kredytów.",
    "details": {
        "credit_type": "draft",
        "credits_used": 3,
        "credits_total": 3,
        "limit_type": "lifetime",
        "upgrade_url": "/pricing"
    }
}
```

### 7.3. Strategia logowania

- Błędy `4xx` — logowane na poziomie `warn` z `userId` i `creditType`.
- Błędy `5xx` — logowane na poziomie `error` z pełnym stack trace.
- Operacje pomyślne w `checkAndDeductCredits` — logowane na poziomie `info`: `"Credit deducted: {creditType} for user {userId}, remaining: {X}"`.
- Worker monthly-reset — loguje liczbę zresetowanych kont na poziomie `info`.

---

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

- **`SELECT FOR UPDATE`** w `checkAndDeductCredits` serializes concurrent AI requests tego samego użytkownika — akceptowalne (użytkownik rzadko wywołuje AI równolegle).
- **Batch UPDATE workera** — miesięczny reset może dotyczyć wielu tysięcy wierszy. Rozwiązanie: UPDATE z `WHERE limit_type = 'monthly' AND next_reset_at <= now()` bez paginacji (operacja masowa, raz dziennie).
- **`GET /me` + `GET /ai/credits`** — dwa zapytania do `user_ai_credits` per sesję, ale `GET /me` bootstrapuje stan, więc `GET /ai/credits` jest opcjonalnym odświeżeniem.

### 8.2. Optymalizacje

- Indeks `idx_user_ai_credits_monthly_reset` na `(next_reset_at) WHERE limit_type = 'monthly'` — przyspiesza zapytanie workera.
- Adminom zwracana jest odpowiedź "unlimited" bez zapytania do DB.
- Wiersz tworzony jest leniwie (przy pierwszym wywołaniu AI), nie przy rejestracji — zmniejsza liczbę wierszy dla nieaktywnych użytkowników.

---

## 9. Etapy wdrożenia

### Etap 1: Migracja bazy danych

1. Utwórz plik migracji `supabase/migrations/<timestamp>_ai_credits.sql`.
2. Dodaj enum `ai_credit_limit_type`.
3. Utwórz tabelę `user_ai_credits` z kolumnami, indeksami i triggerem `updated_at`.
4. Skonfiguruj polityki RLS (SELECT dla właściciela, INSERT/UPDATE tylko service role).
5. Uruchom migrację lokalnie: `supabase db push`.

### Etap 2: Nowe typy współdzielone

6. Dodaj nowe interfejsy do `shared/contracts/types.ts`:
   - `AiCreditLimitType`, `AiCreditBalanceDto`, `AiCreditsResponseDto`
   - `AiCreditsExhaustedErrorDto`
   - `UpdateAdminUserAiCreditsCommand`, `UpdateAdminUserAiCreditsResponseDto`
   - `AiCreditsMonthlyResetResponseDto`
   - `MeAiCreditsDto`
7. Zaktualizuj `MeDto` — dodaj pole `ai_credits: MeAiCreditsDto | null`.
8. Uruchom `supabase gen types typescript` i zaktualizuj `shared/types/database.types.ts`.

### Etap 3: Helper `checkAndDeductCredits`

9. Utwórz plik `supabase/functions/_shared/ai-credits.ts`.
10. Zaimplementuj funkcję `checkAndDeductCredits(supabaseAdmin, userId, creditType, appRole)`:
    - Obsługa admina (early return).
    - Transakcja z `SELECT FOR UPDATE`.
    - Lazy init wiersza (INSERT domyślnych wartości dla roli `user`).
    - Auto-reset miesięczny wewnątrz transakcji.
    - Sprawdzenie pozostałych kredytów → throw `ApplicationError('AI_CREDITS_EXHAUSTED', 402)`.
    - Return `{ row }`.
11. Zaimplementuj funkcję `deductCreditAfterSuccess(supabaseAdmin, userId, creditType)`:
    - Prosty `UPDATE *_credits_used = *_credits_used + 1`.
12. Przetestuj helper jednostkowo (Vitest + mock Supabase).

### Etap 4: Nowy endpoint `GET /ai/credits`

13. W `supabase/functions/ai/` (lub nowej funkcji `supabase/functions/ai-credits/`) dodaj:
    - `ai-credits.handlers.ts` — handler `handleGetAiCredits`
    - `ai-credits.service.ts` — funkcja `getAiCredits(supabase, userId, appRole)`
14. Obsłuż routing w `supabase/functions/ai/index.ts` (lub nowym `index.ts`).
15. Logika serwisu:
    - `appRole === 'admin'` → zwróć unlimited DTO bez DB.
    - SELECT `user_ai_credits` WHERE `user_id = userId`.
    - Brak wiersza → zwróć defaults dla `user`.
    - Mapuj na `AiCreditsResponseDto`.

### Etap 5: Modyfikacja `POST /ai/recipes/draft`

16. W `supabase/functions/ai/recipes-draft.handlers.ts`:
    - Usuń feature gate wykluczający rolę `user`.
    - Przed wywołaniem LLM: `await checkAndDeductCredits(supabaseAdmin, userId, 'draft', appRole)`.
    - Po pomyślnej odpowiedzi LLM: `await deductCreditAfterSuccess(supabaseAdmin, userId, 'draft')`.
17. Zaktualizuj obsługę błędu `AI_CREDITS_EXHAUSTED` → zwróć `402` z `AiCreditsExhaustedErrorDto`.

### Etap 6: Modyfikacja `POST /ai/recipes/image`

18. W `supabase/functions/ai/recipes-image.handlers.ts`:
    - Zachowaj feature gate `premium`/`admin` (Free bez zmian).
    - Przed wywołaniem modelu: `await checkAndDeductCredits(supabaseAdmin, userId, 'image', appRole)`.
    - Po pomyślnej odpowiedzi modelu: `await deductCreditAfterSuccess(supabaseAdmin, userId, 'image')`.
19. Zaktualizuj obsługę błędu `AI_CREDITS_EXHAUSTED` → zwróć `402` z `AiCreditsExhaustedErrorDto`.

### Etap 7: Nowy endpoint `POST /internal/ai-credits/monthly-reset`

20. Utwórz nową funkcję `supabase/functions/internal-ai-credits/`:
    - `index.ts` — routing + weryfikacja service role secret
    - `internal-ai-credits.handlers.ts` — handler `handleMonthlyReset`
    - `internal-ai-credits.service.ts` — funkcja `runMonthlyReset(supabaseAdmin)`
21. Logika serwisu:
    - `UPDATE user_ai_credits SET draft_credits_used = 0, image_credits_used = 0, next_reset_at = next_reset_at + INTERVAL '1 month', updated_at = now() WHERE limit_type = 'monthly' AND next_reset_at <= now()`.
    - Zwróć `{ reset_count, processed_at }`.
22. Skonfiguruj Supabase Cron (raz dziennie, np. `0 2 * * *`).

### Etap 8: Nowy endpoint `PATCH /admin/users/{userId}/ai-credits`

23. W `supabase/functions/admin/`:
    - Dodaj `admin-ai-credits.handlers.ts` — handler `handlePatchAdminUserAiCredits`
    - Dodaj `admin-ai-credits.service.ts` — funkcja `updateUserAiCredits(supabaseAdmin, userId, command)`
24. Rozszerz router w `supabase/functions/admin/index.ts` o nową ścieżkę.
25. Logika handlera:
    - Weryfikacja JWT + rola `admin` → 403.
    - Parsowanie UUID `userId` z ścieżki → 400 jeśli invalid.
    - Walidacja Zod body → 400 z detalami błędów.
26. Logika serwisu:
    - `SELECT auth.users WHERE id = userId` → 404 jeśli brak.
    - `UPSERT user_ai_credits` (tylko podane pola, ON CONFLICT DO UPDATE).
    - `SELECT` zaktualizowanego wiersza → mapuj na `UpdateAdminUserAiCreditsResponseDto`.

### Etap 9: Rozszerzenie `GET /me`

27. W `supabase/functions/me/me.service.ts`:
    - Dodaj `SELECT user_ai_credits WHERE user_id = userId` (równolegle do SELECT profilu).
    - Mapuj wynik na `MeAiCreditsDto` z obsługą brakującego wiersza i roli `admin`.
28. Zaktualizuj `MeDto` response — dodaj pole `ai_credits`.
29. Upewnij się, że frontend (Angular) zaktualizuje model `MeDto` po stronie klienta.

### Etap 10: Testy

30. **Testy jednostkowe (Vitest):**
    - `checkAndDeductCredits` — scenariusze: admin bypass, brak kredytów (402), auto-init wiersza, auto-reset miesięczny, poprawne odjęcie.
    - Serwisy `ai-credits.service.ts`, `internal-ai-credits.service.ts`, `admin-ai-credits.service.ts`.
31. **Testy E2E (Playwright) — scenariusze manualne:**
    - Użytkownik Free: 3 drafty → 4. zakończony 402.
    - Użytkownik Premium: draft i image z odświeżeniem wskaźnika w UI.
    - Admin: pominięcie weryfikacji kredytów.
    - Worker monthly-reset: walidacja reset_count po uruchomieniu.
    - PATCH admin: ręczna korekta i weryfikacja przez GET /ai/credits.

### Etap 11: Deploy i weryfikacja

32. Deploy Edge Functions: `supabase functions deploy ai`, `supabase functions deploy internal-ai-credits`, `supabase functions deploy admin`, `supabase functions deploy me`.
33. Uruchomienie migracji na środowisku staging/prod.
34. Konfiguracja Supabase Cron dla monthly-reset.
35. Smoke test wszystkich endpointów na staging.
36. Weryfikacja RLS: sprawdzenie, czy użytkownik A nie może odczytać kredytów użytkownika B.
