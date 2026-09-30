# API Endpoints Implementation Plan: PS-66 — Checkout i płatności (subskrypcja Premium)

## 1. Przegląd punktów końcowych

PS-66 wprowadza sprzedaż subskrypcji Premium przez hosted checkout operatora płatności (Stripe). Rola `premium` jest nadawana **wyłącznie** po webhooku operatora, a nie po powrocie użytkownika na stronę sukcesu. Plan opisuje implementację zmian zdefiniowanych w `PS-66-checkout-payments-api-plan.md`, dopasowaną do istniejącego kodu Edge Functions (`_shared/errors.ts`, `_shared/auth.ts`, `_shared/supabase-client.ts`, `admin.service.ts`, `me`, `internal`).

### 1.1. Zakres HTTP

| Endpoint | Edge Function | Rodzaj zmiany | Autoryzacja |
|---|---|---|---|
| `POST /checkout/sessions` | `checkout` (nowa) | Nowy | Bearer JWT; `user` oraz `premium` tylko w trialu |
| `POST /payments-webhook` | `payments-webhook` (nowa) | Nowy | Brak JWT (`verify_jwt = false`), podpis `Stripe-Signature` |
| `GET /billing/payments` | `billing` (nowa) | Nowy | Bearer JWT, dowolna rola |
| `GET /me` | `me` | Rozszerzenie (pola subskrypcji) | Bearer JWT |
| `POST /internal/billing/expire-subscriptions` | `internal` | Nowy (wewnętrzny, cron) | Sekret wewnętrzny |

### 1.2. Zakres plików

| Plik / zasób | Zmiana |
|---|---|
| `supabase/migrations/<ts>_create_billing_subscriptions.sql` | Nowe tabele, indeksy, RLS, funkcje SQL (sekcja 9, krok 1) |
| `supabase/config.toml` | `[functions.payments-webhook] verify_jwt = false` |
| `supabase/functions/_shared/errors.ts` | Nowe kody błędów + `RateLimitedError` |
| `supabase/functions/_shared/ai-credits-sync.ts` | **Nowy** — `syncAiCreditsForRole` wydzielone z `admin.service.ts` |
| `supabase/functions/_shared/billing/billing-plans.ts` | **Nowy** — allowlista planów, mapowanie Price ID, okresy, oczekiwane kwoty |
| `supabase/functions/_shared/billing/stripe-client.ts` | **Nowy** — klient Stripe (Deno), przypięta wersja API |
| `supabase/functions/_shared/billing/billing-eligibility.ts` | **Nowy** — czysta funkcja reguł „czy można kupić" |
| `supabase/functions/_shared/email/send-email.ts` | **Nowy** — klient Resend |
| `supabase/functions/_shared/email/templates/purchase-confirmation.ts` | **Nowy** — szablon HTML + tekst |
| `supabase/functions/_shared/internal-auth.ts` | **Nowy** — weryfikacja sekretu wewnętrznego (porównanie w stałym czasie) |
| `supabase/functions/checkout/` | **Nowa funkcja** (`index.ts`, `checkout.handlers.ts`, `checkout.service.ts`, `checkout.types.ts`) |
| `supabase/functions/payments-webhook/` | **Nowa funkcja** (`index.ts`, `payments-webhook.handlers.ts`, `payments-webhook.service.ts`, `payments-webhook.types.ts`, `stripe-mappers.ts`) |
| `supabase/functions/billing/` | **Nowa funkcja** (`index.ts`, `billing.handlers.ts`, `billing.service.ts`, `billing.types.ts`) |
| `supabase/functions/me/me.service.ts` | Odczyt `subscriptions`, nowe pola w `MeDto` |
| `supabase/functions/admin/admin.service.ts` | Zastąpienie lokalnego `syncAiCreditsForRoleChange` importem z `_shared` |
| `supabase/functions/internal/` | Nowa trasa i handler wygaszania subskrypcji |
| `shared/contracts/types.ts` | Nowe DTO i typy (sekcja 3) |
| `supabase/functions/_shared/database.types.ts` | Regeneracja: `supabase gen types typescript --local` |

### 1.3. Decyzje i odstępstwa od planu API

Podczas analizy kodu wykryto miejsca, w których literalne wdrożenie planu API byłoby błędne lub niebezpieczne. Poniższe korekty obowiązują w implementacji.

| # | Temat | Plan API | Decyzja w implementacji | Powód |
|---|---|---|---|---|
| 1 | Źródło roli przy zakupie | „odczyt `app_role` z JWT" | Rola i subskrypcja czytane z **bazy** (`auth.admin.getUserById` + `subscriptions`) | JWT żyje do 1 h (`jwt_expiry = 3600`) i bywa nieaktualny po wygaśnięciu/zmianie roli |
| 2 | `expires_at` sesji | teraz + 30 min | `początek_minuty + 35 min`; wszystkie parametry zależne od czasu liczone z **tego samego koszyka minutowego** | Stripe wymaga ≥ 30 min w przyszłości; klucz idempotencji zawiera minutę, a różne `expires_at`/`terms_accepted_at` przy tym samym kluczu kończą się błędem idempotencji Stripe |
| 3 | Trigger audytu | `moddatetime` | `public.handle_updated_at()` | Funkcja już istnieje i jest używana (`user_ai_credits`) |
| 4 | Wygaszanie subskrypcji | `pg_cron` → `select billing_expire_subscriptions()` | `pg_cron` → `pg_net` → `POST /internal/billing/expire-subscriptions` | Pula Free (`AI_DRAFT_CREDITS_FREE`) jest w zmiennej środowiskowej, niedostępnej z SQL; wymaga zmiany kroku 10 w planie wdrożenia |
| 5 | Idempotencja webhooka | `INSERT ... event_id UNIQUE` | RPC `billing_claim_webhook_event` (atomowe przejęcie, liczba prób, wykrywanie równoległej dostawy) | Sam `INSERT` nie odróżnia retry po błędzie od dostawy równoległej |
| 6 | Identyfikator transakcji | `provider_payment_intent_id UNIQUE` | Kolumna nullable + częściowe unikalne indeksy na `provider_payment_intent_id` i `provider_invoice_id` | W `mode=subscription` PaymentIntent jest na fakturze, a dostępność pola zależy od wersji API Stripe |
| 7 | `subscription_payments.subscription_id` | FK do `subscriptions` | Nullable | Płatność `failed` (BLIK asynchroniczny) może powstać bez subskrypcji |
| 8 | Dokument sprzedaży | generowany przy aktywacji | Dodatkowo backfill z `invoice.paid` (`billing_reason <> 'subscription_cycle'`) | Faktura BLIK (`invoice_creation`) i PDF mogą być gotowe później niż `checkout.session.completed` |
| 9 | Zakup w grace (BLIK) | brak reguły | Patrz tabela eligibility (sekcja 5.1) | Bez tego użytkownik BLIK po końcu okresu (przed wygaszeniem) dostaje `409` i nie może odnowić |
| 10 | Podwójny zakup (dwie sesje) | brak | Wykrywany w RPC, bez zmian w danych, zdarzenie `failed` + log krytyczny do ręcznego zwrotu | Klucz idempotencji chroni tylko przed dubletem w obrębie minuty |
| 11 | Warunek sukcesu w UI | `app_role === 'premium' && subscription_status === 'active'` | **Zmienić w planie UI** na samo `subscription_status === 'active'`, potem `refreshSession()` | `GET /me` zwraca `app_role` z JWT, który do odświeżenia sesji nadal brzmi `user` — polling nigdy by się nie zakończył |

> **Zależność z PREM-001 (`unified-entitlements-api-implementation-plan.md`):** tabela `account_entitlements` nie istnieje w kodzie. PS-66 opiera się na obecnym modelu `app_role`. Jeśli PREM-001 zostanie wdrożony wcześniej, funkcje `billing_activate_premium` / `billing_renew_subscription` / `billing_expire_subscriptions` muszą dodatkowo aktualizować `account_entitlements`.

---

## 2. Szczegóły żądania

### 2.1. `POST /checkout/sessions`

- **Metoda HTTP:** `POST`
- **URL:** `/functions/v1/checkout/sessions`
- **Nagłówki:** `Authorization: Bearer <JWT>` (wymagany), `Content-Type: application/json`
- **Parametry ścieżki / query:** brak
- **Rate limit:** 5 żądań / 60 s / użytkownik
- **Request Body:**

```json
{
    "plan_id": "premium_yearly",
    "payment_method": "card",
    "accepted_terms": true,
    "accepted_digital_content_waiver": true
}
```

| Pole | Typ | Wymagane | Walidacja (Zod) |
|---|---|---|---|
| `plan_id` | `string` | ✅ | `z.enum(['premium_yearly', 'premium_monthly'])` |
| `payment_method` | `string` | ✅ | `z.enum(['card', 'blik'])` |
| `accepted_terms` | `boolean` | ✅ | `z.literal(true)` |
| `accepted_digital_content_waiver` | `boolean` | ✅ | `z.literal(true)` |

Nieznane pola (np. `success_url`, `cancel_url`) są ignorowane (domyślne `strip` Zod) — adresy powrotu budowane są wyłącznie z `APP_BASE_URL`.

### 2.2. `POST /payments-webhook`

- **Metoda HTTP:** `POST` (pozostałe metody → `405`)
- **URL:** `/functions/v1/payments-webhook`
- **Nagłówki:** `Stripe-Signature` (wymagany), `Content-Type: application/json`
- **Body:** surowy (niezmieniony) JSON zdarzenia Stripe — musi być czytany przez `await req.text()`, nigdy `req.json()` (weryfikacja podpisu wymaga dokładnych bajtów)
- **Limit rozmiaru:** `Content-Length` > 512 KB → `413`

### 2.3. `GET /billing/payments`

- **Metoda HTTP:** `GET`
- **URL:** `/functions/v1/billing/payments`
- **Nagłówki:** `Authorization: Bearer <JWT>`
- **Parametry query:** opcjonalny `limit` — `z.coerce.number().int().min(1).max(50).default(20)`

### 2.4. `GET /me`

Bez zmian w żądaniu (`GET`, bez parametrów). Zmiana dotyczy wyłącznie odpowiedzi.

### 2.5. `POST /internal/billing/expire-subscriptions`

- **Metoda HTTP:** `POST`, body puste (`{}`)
- **URL:** `/functions/v1/internal/billing/expire-subscriptions`
- **Autoryzacja:** nagłówek `x-internal-worker-secret` lub `Authorization: Bearer <INTERNAL_WORKER_SECRET>` (jak worker normalizacji); `verify_jwt = false` już ustawione dla `internal`
- **Wywołujący:** wyłącznie `pg_cron` przez `pg_net` (codziennie 03:00 UTC)

---

## 3. Wykorzystywane typy

### 3.1. Kontrakty współdzielone — `shared/contracts/types.ts`

Nowa sekcja `// #region --- Billing ---` (przed `// #region --- Plan (My Plan) ---`):

```typescript
export type SubscriptionPlanId = 'premium_monthly' | 'premium_yearly';
export type SubscriptionPaymentMethod = 'card' | 'blik';
export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
export type SubscriptionPaymentStatus = 'paid' | 'failed';

/** Command model for POST /checkout/sessions. */
export interface CreateCheckoutSessionCommand {
    plan_id: SubscriptionPlanId;
    payment_method: SubscriptionPaymentMethod;
    accepted_terms: true;
    accepted_digital_content_waiver: true;
}

/** Response DTO for POST /checkout/sessions (201). */
export interface CheckoutSessionResponseDto {
    checkout_url: string;
    session_id: string;
    expires_at: string;
}

/** Single payment row for GET /billing/payments. Amounts in grosze. */
export interface BillingPaymentDto {
    id: number;
    plan_id: SubscriptionPlanId;
    payment_method_type: SubscriptionPaymentMethod;
    amount_gross: number;
    currency: 'PLN';
    status: SubscriptionPaymentStatus;
    paid_at: string | null;
    document_number: string | null;
    document_url: string | null;
    document_pdf_url: string | null;
}

/** Response DTO for GET /billing/payments (200). */
export interface GetBillingPaymentsResponseDto {
    data: BillingPaymentDto[];
}
```

Rozszerzenie istniejącego `MeDto` (wszystkie pola nullable — zmiana wstecznie zgodna):

```typescript
export interface MeDto {
    id: string;
    username: string;
    app_role: AppRole;
    ai_credits: MeAiCreditsDto | null;
    subscription_status: SubscriptionStatus | null;
    subscription_plan_id: SubscriptionPlanId | null;
    current_period_end: string | null;
    auto_renew: boolean | null;
    trial_ends_at: string | null;
}
```

Błędy zwracane są w istniejącym formacie `ApplicationError.toJSON()` (`{ "code": "...", "message": "..." }`), bez nowych DTO błędów.

### 3.2. Typy backendowe

**`_shared/errors.ts`** — rozszerzenie `ErrorCode` i `statusMap`:

| Nowy kod | HTTP |
|---|---|
| `FORBIDDEN_ROLE` | 403 |
| `SUBSCRIPTION_ALREADY_ACTIVE` | 409 |
| `RATE_LIMITED` | 429 |
| `PAYMENT_PROVIDER_ERROR` | 502 |
| `INVALID_SIGNATURE` | 400 |

```typescript
/**
 * Rate limit error carrying the Retry-After hint (seconds).
 */
export class RateLimitedError extends ApplicationError {
    public readonly retryAfterSeconds: number;

    constructor(retryAfterSeconds: number) {
        super('RATE_LIMITED', 'Zbyt wiele prób. Spróbuj ponownie za chwilę.');
        this.retryAfterSeconds = retryAfterSeconds;
    }
}
```

W `createErrorResponse` dodać nagłówek `Retry-After`, gdy `error instanceof RateLimitedError`. Istniejący kod `TOO_MANY_REQUESTS` (AI) pozostaje bez zmian; `RATE_LIMITED` wynika z kontraktu PS-66.

**`_shared/billing/billing-plans.ts`:**

```typescript
export type PlanId = 'premium_monthly' | 'premium_yearly';
export type PaymentMethod = 'card' | 'blik';

export interface PlanDefinition {
    months: 1 | 12;
    /** Expected gross amount in grosze. Must stay consistent with pricing.config.ts. */
    expectedAmountGross: number;
}

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
    premium_monthly: { months: 1, expectedAmountGross: 2400 },
    premium_yearly: { months: 12, expectedAmountGross: 16900 },
};

/** Env var holding the Stripe Price ID for (plan, method). */
export function getPriceEnvName(planId: PlanId, method: PaymentMethod): string;

/** Returns the Stripe Price ID or throws INTERNAL_ERROR when the secret is missing. */
export function getPriceId(planId: PlanId, method: PaymentMethod): string;

/** Reverse lookup used by the webhook: Price ID -> { planId, method } or null. */
export function resolvePlanFromPriceId(priceId: string): { planId: PlanId; method: PaymentMethod } | null;

/** Adds calendar months in UTC (used for BLIK period end). */
export function addMonthsUtc(date: Date, months: number): Date;
```

Mapowanie: `card` → `STRIPE_PRICE_PREMIUM_{MONTHLY|YEARLY}_RECURRING`, `blik` → `STRIPE_PRICE_PREMIUM_{MONTHLY|YEARLY}_ONETIME`.

**`_shared/billing/billing-eligibility.ts`** (czysta funkcja, w pełni testowalna):

```typescript
export type CheckoutEligibility = 'allowed' | 'forbidden_admin' | 'already_active';

export interface BillingStateSnapshot {
    appRole: AppRole;
    subscription: {
        status: SubscriptionStatus;
        current_period_end: string;
        auto_renew: boolean;
    } | null;
}

export function evaluateCheckoutEligibility(state: BillingStateSnapshot, now: Date): CheckoutEligibility;
```

**`checkout.types.ts`:**

```typescript
export const CreateCheckoutSessionSchema = z.object({
    plan_id: z.enum(['premium_yearly', 'premium_monthly']),
    payment_method: z.enum(['card', 'blik']),
    accepted_terms: z.literal(true),
    accepted_digital_content_waiver: z.literal(true),
});
export type CreateCheckoutSessionInput = z.infer<typeof CreateCheckoutSessionSchema>;
```

**`billing.types.ts`:**

```typescript
export const GetBillingPaymentsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
});
export const BILLING_PAYMENT_SELECT_COLUMNS =
    'id, plan_id, payment_method_type, amount_gross, currency, status, paid_at, document_number, document_url, document_pdf_url';
```

**`payments-webhook.types.ts`:**

```typescript
export type WebhookProcessingResult = 'processed' | 'ignored';

/** Non-retryable failure: record as 'failed', answer 200 so Stripe stops retrying. */
export class WebhookPermanentError extends Error {
    constructor(public readonly reason: string) {
        super(reason);
        this.name = 'WebhookPermanentError';
    }
}

/** Purchase data resolved from a paid Checkout Session (output of stripe-mappers). */
export interface ResolvedPurchase {
    userId: string;
    planId: PlanId;
    paymentMethod: PaymentMethod;
    autoRenew: boolean;
    periodStart: Date;
    periodEnd: Date;
    providerSubscriptionId: string | null;
    payment: {
        amount_gross: number;
        currency: 'PLN';
        provider_session_id: string;
        provider_payment_intent_id: string | null;
        provider_invoice_id: string | null;
        document_number: string | null;
        document_url: string | null;
        document_pdf_url: string | null;
        terms_version: string | null;
        terms_accepted_at: string | null;
        paid_at: string;
    };
}
```

---

## 4. Szczegóły odpowiedzi

### 4.1. `POST /checkout/sessions`

**`201 Created`:**

```json
{
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "session_id": "cs_test_...",
    "expires_at": "2026-09-30T20:35:00Z"
}
```

`expires_at` pochodzi z odpowiedzi Stripe (`session.expires_at`), nie jest liczone ponownie.

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `201` | — | Sesja utworzona |
| `400` | `VALIDATION_ERROR` | Niepoprawny JSON, `plan_id`/`payment_method`, brak którejkolwiek zgody |
| `401` | `UNAUTHORIZED` | Brak/nieważny JWT |
| `403` | `FORBIDDEN_ROLE` | Rola `admin` |
| `409` | `SUBSCRIPTION_ALREADY_ACTIVE` | Aktywne Premium (poza trialem) |
| `429` | `RATE_LIMITED` | Limit 5/min (+ nagłówek `Retry-After`) |
| `502` | `PAYMENT_PROVIDER_ERROR` | Stripe niedostępny / odrzucił żądanie / brak `session.url` |
| `500` | `INTERNAL_ERROR` | Brak konfiguracji (Price ID, `APP_BASE_URL`), błąd bazy |

### 4.2. `POST /payments-webhook`

**`200 OK`:**

```json
{ "received": true, "status": "processed" }
```

`status`: `processed` | `ignored` | `duplicate`.

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200` | — | Przetworzone, zignorowane, duplikat lub błąd trwały (`WebhookPermanentError`) |
| `400` | `INVALID_SIGNATURE` | Brak/niepoprawny podpis, przeterminowany timestamp, nieparsowalne body |
| `405` | `METHOD_NOT_ALLOWED` | Metoda inna niż `POST` |
| `409` | `CONFLICT` | To samo zdarzenie jest właśnie przetwarzane równolegle (Stripe ponowi) |
| `413` | `PAYLOAD_TOO_LARGE` | Body > 512 KB |
| `500` | `INTERNAL_ERROR` | Błąd przetwarzania wymagający ponowienia przez Stripe |

### 4.3. `GET /billing/payments`

**`200 OK`:**

```json
{
    "data": [
        {
            "id": 12,
            "plan_id": "premium_yearly",
            "payment_method_type": "card",
            "amount_gross": 16900,
            "currency": "PLN",
            "status": "paid",
            "paid_at": "2026-09-30T19:41:12Z",
            "document_number": "PYCH-0001",
            "document_url": "https://invoice.stripe.com/i/...",
            "document_pdf_url": "https://pay.stripe.com/invoice/.../pdf"
        }
    ]
}
```

| Kod HTTP | `code` | Sytuacja |
|---|---|---|
| `200` | — | Lista (może być pusta) |
| `400` | `VALIDATION_ERROR` | `limit` poza zakresem 1–50 lub nieliczbowy |
| `401` | `UNAUTHORIZED` | Brak/nieważny JWT |
| `500` | `INTERNAL_ERROR` | Błąd bazy |

Sortowanie: `paid_at desc nulls last, id desc`. Kwoty w groszach (`int`).

### 4.4. `GET /me`

Dodatkowe pola (`null` dla Free, admina i Premium nadanego ręcznie):

```json
{
    "id": "…",
    "username": "jan",
    "app_role": "premium",
    "ai_credits": { "draft_remaining": 20, "image_remaining": 5, "limit_type": "monthly", "next_reset_at": "2026-10-30T19:41:12Z" },
    "subscription_status": "active",
    "subscription_plan_id": "premium_yearly",
    "current_period_end": "2027-09-30T19:41:12Z",
    "auto_renew": true,
    "trial_ends_at": null
}
```

Kody bez zmian (`200`, `401`, `404` brak profilu, `500`).

### 4.5. `POST /internal/billing/expire-subscriptions`

**`200 OK`:**

```json
{
    "expired_count": 3,
    "credits_synced": 3,
    "credits_failed": 0,
    "processed_at": "2026-10-01T03:00:02Z"
}
```

| Kod HTTP | Sytuacja |
|---|---|
| `200` | Wykonano (także gdy `expired_count = 0`) |
| `401` | Brak/niepoprawny sekret |
| `500` | Błąd RPC lub brak konfiguracji sekretu |

---

## 5. Przepływ danych

### 5.1. `POST /checkout/sessions`

```
Client
  │  POST /checkout/sessions (Bearer JWT)
  ▼
[checkout/index.ts]            CORS preflight, routing, handleError
  ▼
[checkout.handlers.ts — handlePostCheckoutSession]
  │  1. getAuthenticatedContext(req)                      → 401 UNAUTHORIZED
  │  2. req.json() + CreateCheckoutSessionSchema          → 400 VALIDATION_ERROR
  │  3. rate limit (RPC ai_rate_limit_hit, klucz 'checkout_session',
  │     okno 60 s, limit 5; klient użytkownika)           → 429 RATE_LIMITED
  │  4. createCheckoutSession({ userId, email, command })
  ▼
[checkout.service.ts]
  │  5. loadBillingState(userId)   (service role)
  │       ├─ auth.admin.getUserById → app_metadata.app_role  (NIE z JWT)
  │       └─ subscriptions (status, current_period_end, auto_renew)
  │  6. evaluateCheckoutEligibility(state, now)
  │       ├─ 'forbidden_admin' → 403 FORBIDDEN_ROLE
  │       └─ 'already_active'  → 409 SUBSCRIPTION_ALREADY_ACTIVE
  │  7. getOrCreateBillingCustomer(userId, email)
  │       └─ billing_customers → (brak) stripe.customers.create
  │          (idempotencyKey 'customer:{userId}') + upsert ignoreDuplicates + re-select
  │  8. getPriceId(plan_id, payment_method)
  │  9. stripe.checkout.sessions.create(params, { idempotencyKey })   → 502 przy błędzie
  ▼
[handler]  10. 201 { checkout_url, session_id, expires_at }
```

**Reguły `evaluateCheckoutEligibility`** (kolejność ma znaczenie):

| # | Warunek | Wynik |
|---|---|---|
| 1 | `appRole = 'admin'` | `forbidden_admin` |
| 2 | `subscription.status = 'trialing'` | `allowed` (zakup w trakcie trialu) |
| 3 | `subscription.status ∈ {active, past_due, canceled}` i `current_period_end > now` | `already_active` |
| 4 | `appRole = 'premium'` i brak wiersza `subscription` (Premium nadane ręcznie) | `already_active` |
| 5 | `appRole = 'premium'`, `status = 'active'`, `auto_renew = true` (karta po końcu okresu, czeka na odnowienie Stripe lub grace) | `already_active` |
| 6 | pozostałe (Free, `expired`, BLIK po końcu okresu w grace, `canceled` po końcu okresu) | `allowed` |

**Parametry sesji Stripe** (budowane w czystej funkcji `buildCheckoutSessionParams`, testowalnej bez sieci):

```typescript
const minuteBucket = Math.floor(nowMs / 60_000);
const bucketStartMs = minuteBucket * 60_000;
const expiresAtSec = Math.floor(bucketStartMs / 1000) + 35 * 60;
const termsAcceptedAt = new Date(bucketStartMs).toISOString();
const metadata = {
    user_id: userId,
    plan_id: planId,
    payment_method: method,
    terms_version: getSubscriptionTermsVersion(),
    terms_accepted_at: termsAcceptedAt,
};

const baseParams = {
    mode: method === 'card' ? 'subscription' : 'payment',
    payment_method_types: [method],
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: priceId, quantity: 1 }],
    locale: 'pl',
    expires_at: expiresAtSec,
    success_url: `${appBaseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl}/checkout/cancel`,
    metadata,
    ...(method === 'card'
        ? { subscription_data: { metadata } }
        : { invoice_creation: { enabled: true, invoice_data: { metadata } }, payment_intent_data: { metadata } }),
};
// idempotencyKey = `checkout:${userId}:${planId}:${method}:${minuteBucket}`
```

`appBaseUrl` = `APP_BASE_URL` bez końcowego `/`; brak zmiennej lub URL nie-`https` poza środowiskiem lokalnym → `500 INTERNAL_ERROR` (fail-fast, nigdy fallback do danych z żądania).

### 5.2. `POST /payments-webhook`

```
Stripe
  │  POST /payments-webhook (Stripe-Signature, surowe body)
  ▼
[index.ts]   tylko POST; bez CORS
  ▼
[payments-webhook.handlers.ts — handlePostWebhook]
  │  1. limit rozmiaru (Content-Length)                              → 413
  │  2. rawBody = await req.text(); sig = header 'Stripe-Signature'
  │  3. stripe.webhooks.constructEventAsync(rawBody, sig,
  │        STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider)         → 400 INVALID_SIGNATURE
  │  4. spójność trybu: event.livemode vs prefiks STRIPE_SECRET_KEY  → 400 INVALID_SIGNATURE
  │  5. billing_claim_webhook_event(event.id, event.type)
  │       ├─ 'duplicate_processed' → 200 { status: 'duplicate' }
  │       ├─ 'in_progress'         → 409 CONFLICT (Stripe ponowi)
  │       └─ 'claimed'             → dalej
  │  6. processStripeEvent(event)
  │       ├─ sukces → event.status = 'processed' | 'ignored'          → 200
  │       ├─ WebhookPermanentError → event.status = 'failed' + log krytyczny → 200
  │       └─ inny błąd → event.status = 'failed' + error_message     → 500 (retry)
  ▼
Stripe
```

**Dispatcher `processStripeEvent`:**

| Zdarzenie | Handler |
|---|---|
| `checkout.session.completed` | `payment_status = 'paid'` → `handlePaidCheckoutSession`; `unpaid` → `ignored` (czekamy na async); `no_payment_required` → `ignored` + warn |
| `checkout.session.async_payment_succeeded` | `handlePaidCheckoutSession` |
| `checkout.session.async_payment_failed` | `handleFailedCheckoutSession` |
| `checkout.session.expired` | `ignored` (tylko log) |
| `invoice.paid` | `billing_reason = 'subscription_cycle'` → `handleSubscriptionRenewal`; inne → `handleInvoiceDocumentBackfill` |
| pozostałe | `ignored` |

**`handlePaidCheckoutSession` (aktywacja):**

```
1. session = stripe.checkout.sessions.retrieve(id, { expand: ['line_items', 'payment_intent', 'subscription', 'invoice'] })
     (nie ufamy kopii z payloadu; dane pobierane od Stripe)
2. Walidacja (WebhookPermanentError przy niezgodności):
     - metadata.user_id == client_reference_id, UUID, użytkownik istnieje (auth.admin.getUserById)
     - session.customer == billing_customers.provider_customer_id dla user_id
     - currency == 'pln'
     - line_items.data.length == 1; price.id ∈ resolvePlanFromPriceId() i (planId, method) == metadata
     - amount_total == price.unit_amount == PLAN_DEFINITIONS[planId].expectedAmountGross
3. resolvePurchase() (stripe-mappers.ts):
     - karta:  okres z subskrypcji Stripe (current_period_start/end), autoRenew = true,
               providerSubscriptionId = sub_..., PaymentIntent z faktury
     - BLIK:   start = new Date(event.created * 1000), koniec = addMonthsUtc(start, 1 | 12),
               autoRenew = false, PaymentIntent = session.payment_intent.id
     - dokument: invoice.number / hosted_invoice_url / invoice_pdf (mogą być null)
     - terms_version / terms_accepted_at z metadata
4. rpc billing_activate_premium(...) → { result, role_changed, was_trialing, role_skipped_admin, payment_id }
     - 'already_processed'            → przejdź do kroku 6 (idempotentny retry)
     - 'duplicate_active_subscription' → WebhookPermanentError('DUPLICATE_PURCHASE_NEEDS_REFUND')
     - wyjątek NOT_FOUND (użytkownik usunięty) → WebhookPermanentError
5. Synchronizacja kredytów AI (błąd → throw → 500 → retry):
     - role_changed  → syncAiCreditsForRole({ newRole: 'premium', usageMode: 'reset', resetAt: addMonthsUtc(now, 1) })
     - was_trialing  → syncAiCreditsForRole({ newRole: 'premium', usageMode: 'keep',  resetAt: addMonthsUtc(now, 1) })
     - w pozostałych przypadkach (BLIK odnowiony w grace) — bez zmian
6. sendPurchaseConfirmationEmail(paymentId)   (try/catch, nigdy nie przerywa)
7. return 'processed'
```

**`handleFailedCheckoutSession`:** jak kroki 1–2 (bez walidacji ceny), następnie `billing_record_failed_payment` (idempotentne po `provider_session_id` dla `status = 'failed'`). Rola bez zmian.

**`handleSubscriptionRenewal` (`invoice.paid`, `subscription_cycle`):** pobranie faktury, okres z subskrypcji, `billing_renew_subscription(provider_subscription_id, period_start, period_end, payment)`. Brak wiersza subskrypcji → zwykły błąd (→ `500`, Stripe ponowi — webhook aktywacji mógł jeszcze nie dotrzeć). Pula AI bez zmian (reset robi istniejący cron). Brak e-maila (PS-71).

**`handleInvoiceDocumentBackfill`:** `billing_attach_invoice_document(provider_invoice_id, number, hosted_url, pdf_url)` — `UPDATE` tylko wierszy z `document_url IS NULL`. Brak pasującego wiersza → `ignored` (faktura pierwszego zakupu karty zwykle dotrze przed lub po sesji; dokument i tak jest uzupełniany w aktywacji).

### 5.3. `GET /billing/payments`

```
Client → [billing/index.ts] → [billing.handlers.ts — handleGetBillingPayments]
  1. getAuthenticatedContext(req)                     → 401
  2. GetBillingPaymentsQuerySchema.safeParse(query)   → 400
  3. getBillingPayments({ client, userId, limit })
        client (kontekst użytkownika, RLS) → subscription_payments
        .select(BILLING_PAYMENT_SELECT_COLUMNS)
        .eq('user_id', userId)                         (filtr jawny + RLS)
        .order('paid_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(limit)
  4. mapowanie do BillingPaymentDto[] (currency → 'PLN')
  5. 200 { data }
```

Pola techniczne Stripe (`provider_*`, `terms_*`, `confirmation_email_sent_at`) nie są selekcjonowane.

### 5.4. `GET /me` (zmiana)

W `getMeProfile` dołożyć trzecie zapytanie do istniejącego `Promise.all` (klient użytkownika, RLS):

```typescript
const SUBSCRIPTION_SELECT_COLUMNS = 'status, plan_id, current_period_end, auto_renew, trial_ends_at';

const subscriptionPromise = appRole === 'admin'
    ? Promise.resolve({ data: null, error: null })
    : client.from('subscriptions').select(SUBSCRIPTION_SELECT_COLUMNS).eq('user_id', userId).maybeSingle();
```

Błąd zapytania → `500 INTERNAL_ERROR` (spójnie z obsługą `ai_credits`). Brak wiersza → wszystkie pięć pól `null`. Rola w odpowiedzi nadal z JWT (bez zmian semantyki).

### 5.5. `POST /internal/billing/expire-subscriptions`

```
pg_cron (03:00 UTC) → pg_net.http_post → [internal router]
  1. verifyInternalSecret(req)                                  → 401
  2. rpc billing_expire_subscriptions(p_grace_days)             (service role)
        → status = 'expired', app_role: premium → user; zwraca user_id faktycznie zdegradowanych
  3. dla każdego user_id:
        syncAiCreditsForRole({ newRole: 'user', usageMode: 'keep' })    (try/catch per użytkownik)
  4. 200 { expired_count, credits_synced, credits_failed, processed_at }
```

### 5.6. Interakcje z bazą danych

| Operacja | Klient | Tabela / RPC |
|---|---|---|
| Stan rozliczeń przed zakupem | service role | `auth.admin.getUserById`, `subscriptions` |
| Rate limit | użytkownik | RPC `ai_rate_limit_hit` (istniejące, klucz `checkout_session`) |
| Klient Stripe | service role | `billing_customers` |
| Claim / status zdarzenia | service role | RPC `billing_claim_webhook_event`, `UPDATE payment_webhook_events` |
| Aktywacja / odnowienie / błąd / dokument / wygaszenie | service role | RPC `billing_*` (jedna transakcja każda) |
| Kredyty AI | service role | `user_ai_credits` (upsert) |
| Historia płatności, `/me` | użytkownik (RLS) | `subscription_payments`, `subscriptions` |

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie i autoryzacja

- `checkout`, `billing`: `getAuthenticatedContext(req)` (weryfikacja przez Supabase `getUser()`); brama `verify_jwt` zostaje domyślnie włączona. `user.id` i e-mail pochodzą z zweryfikowanego tokena, **nigdy z body**.
- Decyzja „czy można kupić" opiera się na **bazie**, nie na claimie JWT (patrz 1.3 pkt 1).
- `payments-webhook`: `verify_jwt = false`, więc cała funkcja jest publiczna. Zabezpieczenia: wyłącznie `POST`; podpis weryfikowany **przed** jakimkolwiek dostępem do bazy; tolerancja znacznika czasu domyślna Stripe (300 s — ochrona przed replay); limit rozmiaru body; brak CORS.
- Spójność trybu: `event.livemode` musi odpowiadać kluczowi (`sk_live_`/`rk_live_` ⇒ `true`), inaczej `400` — uniemożliwia wysłanie zdarzeń testowych na produkcyjny webhook.
- Endpoint wewnętrzny: sekret porównywany w stałym czasie (`_shared/internal-auth.ts`, wzorzec `secretsMatch` z `ai-credits-monthly-reset.handlers.ts`), brak CORS.

### 6.2. Walidacja danych wejściowych

- Zod dla body i query; `plan_id` / `payment_method` jako allowlista — ta sama wartość determinuje Price ID po stronie serwera (klient nie wpływa na cenę).
- W webhooku dane z `metadata` traktowane jako niezaufane: weryfikowane z `client_reference_id`, `customer` i ceną pobraną od Stripe (krok 2 aktywacji).
- `SUBSCRIPTION_TERMS_VERSION` zapisywana przez serwer (klient przekazuje tylko boolean), więc wersji regulaminu nie da się podmienić.

### 6.3. Funkcje SQL — eskalacja uprawnień (krytyczne)

`billing_*` zmieniają rolę użytkownika, więc ich przypadkowe wystawienie dla `authenticated` oznaczałoby samodzielne nadanie Premium. Supabase domyślnie nadaje `EXECUTE` na funkcjach w schemacie `public` rolom `anon` i `authenticated` (default privileges), więc samo `revoke ... from public` **nie wystarcza**:

```sql
revoke all on function public.billing_activate_premium(/* sygnatura */) from public, anon, authenticated;
grant execute on function public.billing_activate_premium(/* sygnatura */) to service_role;
-- analogicznie: billing_renew_subscription, billing_expire_subscriptions,
-- billing_claim_webhook_event, billing_record_failed_payment, billing_attach_invoice_document
```

Każda funkcja: `security definer`, `set search_path = ''`, w pełni kwalifikowane nazwy obiektów (`public.`, `auth.`). Wymagany test integracyjny: wywołanie RPC z JWT zwykłego użytkownika musi zwrócić `permission denied`.

### 6.4. Dane płatnicze i prywatność

- Dane karty/BLIK nigdy nie trafiają do aplikacji (hosted checkout). W bazie: ID Stripe, kwoty, linki do dokumentów.
- Linki do faktur (`hosted_invoice_url`) są nieodgadywalne, ale stałe; zwracane wyłącznie właścicielowi (RLS + filtr `user_id`).
- Logi: identyfikatory zdarzeń (`evt_`), sesji i `user_id`; **bez** e-maili, nagłówka `Authorization`, `Stripe-Signature`, surowego body i sekretów. `payment_webhook_events.error_message` przycinany do 500 znaków i bez danych osobowych.
- E-mail: dane użytkownika (nazwa) escapowane przed wstawieniem do HTML.
- Sekrety (`STRIPE_*`, `RESEND_API_KEY`) wyłącznie w Supabase Secrets; klucz Stripe jako restricted key z minimalnymi uprawnieniami (Checkout Sessions, Customers, Subscriptions, Invoices — odczyt/zapis wg potrzeb).

### 6.5. Macierz zagrożeń

| Zagrożenie | Mitygacja |
|---|---|
| Sfałszowany / powtórzony webhook | Podpis + tolerancja czasu + `billing_claim_webhook_event` + unikalne indeksy płatności |
| Zmiana ceny/planu przez klienta | Price ID z sekretów wg allowlisty; walidacja `amount_total` i `price.id` w webhooku |
| Open redirect | `success_url`/`cancel_url` z `APP_BASE_URL`, nigdy z body |
| Samonadanie Premium | `revoke` z `anon`/`authenticated`, brak jakiejkolwiek ścieżki innej niż webhook |
| Nadpisanie roli `admin` | RPC pomija `admin` (log ostrzeżenia); `checkout` zwraca `403` |
| Nieaktualny JWT przy zakupie | Stan z bazy (1.3 pkt 1) |
| Podwójne obciążenie | Reguły eligibility + klucz idempotencji + wykrywanie duplikatu w RPC |
| Nadużycia tworzenia sesji / koszty Stripe | Rate limit 5/min, limit 502 bez ujawniania szczegółów Stripe |
| Wyścig aktywacji i wygaszania | `pg_advisory_xact_lock` per użytkownik + blokady wierszy; ponowna ocena warunku po commit (READ COMMITTED) |
| HTML injection w e-mailu | Escapowanie nazwy użytkownika; stałe szablony |
| Enumeracja cudzych płatności | RLS + jawny filtr `user_id` |

---

## 7. Obsługa błędów

### 7.1. `POST /checkout/sessions`

| Warunek | Typ | HTTP | `code` |
|---|---|---|---|
| Brak/nieważny JWT | `ApplicationError` | 401 | `UNAUTHORIZED` |
| Niepoprawny JSON / schema / brak zgód | `ApplicationError` | 400 | `VALIDATION_ERROR` (komunikat z pierwszego błędu Zod, np. `accepted_terms: Wymagana akceptacja regulaminu`) |
| Przekroczony limit | `RateLimitedError` | 429 | `RATE_LIMITED` (`Retry-After`) |
| Rola `admin` | `ApplicationError` | 403 | `FORBIDDEN_ROLE` |
| Aktywne Premium | `ApplicationError` | 409 | `SUBSCRIPTION_ALREADY_ACTIVE` |
| `StripeError` (sieć, 4xx/5xx, idempotencja), brak `session.url` | `ApplicationError` | 502 | `PAYMENT_PROVIDER_ERROR` (komunikat ogólny; w logu `type`, `code`, `request_id`) |
| Brak sekretu (Price ID, `APP_BASE_URL`, `STRIPE_SECRET_KEY`), błąd bazy | `ApplicationError` | 500 | `INTERNAL_ERROR` |

Rate limit: błąd samego RPC → **fail-open** (log `warn`), jak w `checkAiImageRateLimitWithStorage`; ochronę zapewniają wtedy reguły eligibility i idempotencja Stripe.

### 7.2. `POST /payments-webhook`

| Warunek | Reakcja | HTTP | Status w `payment_webhook_events` |
|---|---|---|---|
| Metoda ≠ POST | `METHOD_NOT_ALLOWED` | 405 | — |
| Body > 512 KB | `PAYLOAD_TOO_LARGE` | 413 | — |
| Brak nagłówka / zły podpis / zły tryb | `INVALID_SIGNATURE` | 400 | — (nie zapisujemy) |
| Duplikat już przetworzony | `{ status: 'duplicate' }` | 200 | bez zmian |
| Równoległe przetwarzanie | `CONFLICT` | 409 | bez zmian |
| Zdarzenie nieobsługiwane | `ignored` | 200 | `ignored` |
| `WebhookPermanentError` (niezgodna kwota/cena/waluta, nieznany użytkownik, `DUPLICATE_PURCHASE_NEEDS_REFUND`) | log `error` z prefiksem `[billing][CRITICAL]` | 200 | `failed` + `error_message` |
| Błąd Stripe API / RPC / sync kredytów | rzucenie wyjątku | 500 | `failed` + `error_message` (kolejna dostawa ponownie przejmie zdarzenie) |
| Błąd wysyłki e-maila | log `error`, bez przerwania | 200 | `processed` |

**Rejestrowanie błędów:** w projekcie nie ma ogólnej tabeli błędów; rolę tę pełni `payment_webhook_events` (`status`, `attempts`, `error_message`, `processed_at`). Wpisy `failed` są źródłem do ręcznej analizy i alertu (zapytanie w planie wdrożenia: `status = 'failed'` starsze niż 15 min). Dodatkowo każdy błąd trafia do `logger.error`.

### 7.3. `GET /billing/payments`

`401` (JWT), `400` (`limit`), `500` (błąd bazy, log z `errorCode`/`errorMessage`, bez danych użytkownika).

### 7.4. `GET /me`

Jak dotąd; błąd odczytu `subscriptions` → `500 INTERNAL_ERROR` (`Failed to fetch subscription`).

### 7.5. `POST /internal/billing/expire-subscriptions`

`401` przy błędnym sekrecie; błąd RPC → `500`; błąd synchronizacji kredytów **pojedynczego** użytkownika nie przerywa pętli — zwiększa `credits_failed` i loguje `user_id` (ręczna korekta przez `PATCH /admin/users/{id}/ai-credits`).

### 7.6. Logowanie

```typescript
logger.info('[checkout] Session created', { userId, planId, paymentMethod, sessionId });
logger.warn('[checkout] Rate limit RPC failed, failing open', { userId, error: error.message });
logger.info('[payments-webhook] Event claimed', { eventId: event.id, type: event.type });
logger.warn('[payments-webhook] Admin purchase, role not changed', { userId });
logger.error('[billing][CRITICAL] Amount mismatch, activation skipped', { eventId, userId, expected, received });
logger.error('[billing][CRITICAL] Duplicate purchase needs refund', { eventId, userId, sessionId });
logger.error('[email] Purchase confirmation failed', { paymentId, status });
```

---

## 8. Rozważania dotyczące wydajności

- **Checkout:** ścieżka to 2 odczyty z bazy + (tylko przy pierwszym zakupie) `customers.create` + `sessions.create` (~300–800 ms, dominuje Stripe). Klient Stripe z `timeout` 10 s i `maxNetworkRetries: 2`; bez dodatkowych wywołań w tle.
- **Idempotencja sesji:** podwójne kliknięcie w tej samej minucie zwraca tę samą sesję (klucz idempotencji), więc nie powstają zbędne sesje u operatora.
- **Webhook:** jedno `sessions.retrieve` z `expand` (zamiast 3–4 osobnych wywołań), jedno RPC w transakcji, upsert kredytów, e-mail. Budżet czasu < kilku sekund; wysyłka e-maila z `AbortSignal.timeout(5000)`, by wolny Resend nie powodował timeoutu po stronie Stripe (→ niepotrzebne retry).
- **Cold start:** klient Stripe i stałe konfiguracyjne tworzone leniwie (singleton na moduł); `Stripe.createFetchHttpClient()` (Deno nie ma Node `http`).
- **Indeksy:** `subscription_payments(user_id, paid_at desc)` dla historii; `subscriptions(status, current_period_end)` dla wygaszania; unikalne częściowe indeksy na identyfikatory transakcji; `user_id` UNIQUE dla `/me` (zapytanie po kluczu, O(1)).
- **`GET /me`:** dodatkowe zapytanie wykonywane równolegle w `Promise.all` — brak wydłużenia ścieżki krytycznej; pomijane dla admina.
- **Wygaszanie:** jedno zapytanie zbiorcze w SQL; synchronizacja kredytów sekwencyjnie per użytkownik (oczekiwana liczba rekordów dziennie jest niewielka); w razie wzrostu — partie po 100.
- **Rozrost `payment_webhook_events`:** wiersz ~200 B/zdarzenie; czyszczenie rekordów starszych niż 90 dni poza zakresem PS-66 (zapisać w backlogu operacyjnym).
- **Rate limit:** korzysta z istniejącej tabeli `ai_rate_limits` (nazwa historyczna; klucz `checkout_session` odróżnia licznik). Akceptowalne — wydzielenie generycznej tabeli nie jest potrzebne dla 5 żądań/min.

---

## 9. Etapy wdrożenia

### Krok 1 — Migracja bazy danych

**Plik:** `supabase/migrations/<timestamp>_create_billing_subscriptions.sql` (kolumny tabel: sekcja 7 planu API, z poniższymi korektami).

1. Utworzyć tabele `billing_customers`, `subscriptions`, `subscription_payments`, `payment_webhook_events`; włączyć RLS; polityki jak w planie API (`subscriptions` i `subscription_payments` — SELECT własnych wierszy dla `authenticated`).
2. Korekty względem planu API:
    - `subscription_payments.subscription_id` **nullable**; `provider_payment_intent_id` i `provider_invoice_id` nullable.
    - Indeksy: `create unique index ... on subscription_payments(provider_payment_intent_id) where provider_payment_intent_id is not null;` oraz to samo dla `provider_invoice_id`; `create unique index ... on subscription_payments(provider_session_id) where status = 'failed';`
    - `subscription_payments(user_id, paid_at desc)`.
    - `payment_webhook_events`: dodać `attempts integer not null default 1`, `livemode boolean`.
    - Triggery `updated_at` przez `public.handle_updated_at()`.
3. Funkcje SQL (wszystkie: `security definer`, `set search_path = ''`, `revoke ... from public, anon, authenticated`, `grant execute ... to service_role`):

**`billing_claim_webhook_event(p_event_id text, p_type text, p_livemode boolean) returns text`**

```sql
insert into public.payment_webhook_events (event_id, type, status, livemode, attempts, received_at)
values (p_event_id, p_type, 'received', p_livemode, 1, now())
on conflict (event_id) do nothing;

if found then
    return 'claimed';
end if;

select status, received_at into v_status, v_received_at
from public.payment_webhook_events
where event_id = p_event_id
for update;

if v_status in ('processed', 'ignored') then
    return 'duplicate_processed';
end if;

if v_status = 'received' and v_received_at > now() - interval '2 minutes' then
    return 'in_progress';
end if;

update public.payment_webhook_events
set status = 'received', attempts = attempts + 1, received_at = now(), error_message = null
where event_id = p_event_id;

return 'claimed';
```

**`billing_activate_premium(...) returns jsonb`** (sygnatura z planu API). Logika w jednej transakcji:

1. `pg_advisory_xact_lock(hashtextextended('billing:' || p_user_id::text, 0))`.
2. Użytkownik nie istnieje / `deleted_at is not null` → `raise exception 'NOT_FOUND: User not found'`.
3. Istnieje płatność o tym samym `provider_payment_intent_id` lub `provider_invoice_id` → zwróć `{"result":"already_processed", ...}` (bez zmian).
4. `select ... from subscriptions where user_id = p_user_id for update`; jeśli `status in ('active','past_due','canceled')` i `current_period_end > now()` → zwróć `{"result":"duplicate_active_subscription"}` (bez zmian w danych).
5. `was_trialing := (status = 'trialing')`; `v_previous_role` z `raw_app_meta_data`.
6. `insert ... on conflict (user_id) do update` na `subscriptions`: `plan_id`, `status = 'active'`, `payment_method_type`, `auto_renew`, `provider_subscription_id`, `started_at = p_period_start`, `current_period_start/end`, `trial_ends_at = null`, `canceled_at = null`.
7. `insert into subscription_payments` (pola z `p_payment`, `status = 'paid'`, `subscription_id`).
8. Jeśli rola ≠ `admin`: `update auth.users set raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data,'{}'), '{app_role}', '"premium"'), updated_at = now()`; `role_changed := v_previous_role <> 'premium'`. Jeśli `admin` → `role_skipped_admin := true`.
9. Zwróć `jsonb_build_object('result','activated','role_changed',…,'was_trialing',…,'role_skipped_admin',…,'payment_id',…,'subscription_id',…)`.

**`billing_renew_subscription(p_provider_subscription_id text, p_period_start timestamptz, p_period_end timestamptz, p_payment jsonb) returns jsonb`** — lock po `user_id` znalezionym przez `provider_subscription_id` (brak → `raise exception 'NOT_FOUND'`); idempotencja po PI/fakturze; `status = 'active'`, nowy okres; insert płatności; jeśli rola ≠ `admin` i ≠ `premium` (wygaszona tuż przed odnowieniem) → przywrócenie `premium` (samonaprawa), zwrot `role_changed`.

**`billing_record_failed_payment(p_user_id uuid, p_payment jsonb) returns boolean`** — insert `status = 'failed'`, `on conflict do nothing` (indeks po `provider_session_id`).

**`billing_attach_invoice_document(p_provider_invoice_id text, p_number text, p_url text, p_pdf_url text) returns integer`** — `update ... where provider_invoice_id = ... and document_url is null`.

**`billing_expire_subscriptions(p_grace_days integer default 3) returns table (user_id uuid)`** — CTE: (a) `update subscriptions set status = 'expired' where status = 'active' and current_period_end + make_interval(days => p_grace_days) < now() returning user_id`; (b) `update auth.users` dla tych id, tylko gdzie `app_role = 'premium'`, `returning id`; zwraca (b). Użytkownicy z rolą nadaną ręcznie (bez wiersza `subscriptions`) nie są dotykani.

4. Zweryfikować lokalnie: `supabase db reset`; wywołanie RPC jako `authenticated` → `permission denied`; `supabase gen types typescript --local > supabase/functions/_shared/database.types.ts`.

### Krok 2 — Typy i błędy współdzielone

1. `shared/contracts/types.ts`: sekcja Billing i rozszerzenie `MeDto` (3.1).
2. `_shared/errors.ts`: nowe `ErrorCode` + wpisy w `statusMap`, klasa `RateLimitedError`, nagłówek `Retry-After` w `createErrorResponse`.
3. Testy: `errors.test.ts` (status dla każdego nowego kodu; `Retry-After`).

### Krok 3 — Refaktoryzacja synchronizacji kredytów AI

**Plik:** `supabase/functions/_shared/ai-credits-sync.ts`

1. Przenieść logikę `syncAiCreditsForRoleChange` z `admin.service.ts` i rozszerzyć:

```typescript
export type AiCreditsUsageMode = 'reset' | 'keep';

export interface SyncAiCreditsForRoleParams {
    userId: string;
    newRole: AppRole;
    /** 'reset' zeruje zużycie (dotychczasowe zachowanie); 'keep' zachowuje zużycie, ograniczone do nowej puli. */
    usageMode?: AiCreditsUsageMode;
    /** Termin resetu puli Premium. Domyślnie now + 30 dni (zachowanie dotychczasowe). */
    resetAt?: Date;
    now?: Date;
}

export async function syncAiCreditsForRole(params: SyncAiCreditsForRoleParams): Promise<void>;
```

2. Zachowanie:
    - `admin` → no-op (jak dotąd).
    - `usageMode = 'reset'` (domyślny) → dokładnie obecny upsert (brak regresji w panelu admina).
    - `usageMode = 'keep'` → odczyt bieżącego wiersza; jeśli istnieje: `used = min(used, nowa_pula)` osobno dla `draft` i `image` (spełnia constraint `used <= total`; przy trialu pula rośnie, więc zużycie zostaje; przy degradacji po wygaśnięciu wyczerpana pula Free pozostaje wyczerpana — brak darmowego odnowienia kredytów); jeśli nie istnieje → jak `reset`.
    - Premium: `limit_type = 'monthly'`, `next_reset_at = resetAt`; Free: `lifetime`, `next_reset_at = null`.
3. `admin.service.ts`: usunąć lokalną funkcję, zaimportować `syncAiCreditsForRole` i wywołać `syncAiCreditsForRole({ userId: targetUserId, newRole: appRole })` (bez zmiany zachowania).
4. Testy: `ai-credits-sync.test.ts` (reset/keep, admin no-op, Free/Premium, brak wiersza, ograniczenie `used`); istniejące testy admina muszą przechodzić bez zmian.

### Krok 4 — Moduły współdzielone billing i e-mail

1. `_shared/billing/billing-plans.ts`, `billing-eligibility.ts` (3.2), `stripe-client.ts`:

```typescript
import Stripe from 'npm:stripe@<PRZYPIĄĆ_WERSJĘ>';

/** Przypiąć jawnie — kształt obiektów (okresy subskrypcji, PaymentIntent na fakturze) zależy od wersji API. */
export const STRIPE_API_VERSION = '<PRZYPIĄĆ_WERSJĘ_API>' as const;

let cachedClient: Stripe | null = null;

export function getStripeClient(): Stripe {
    if (cachedClient) {
        return cachedClient;
    }

    const apiKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!apiKey) {
        throw new ApplicationError('INTERNAL_ERROR', 'Missing Stripe configuration');
    }

    cachedClient = new Stripe(apiKey, {
        apiVersion: STRIPE_API_VERSION,
        httpClient: Stripe.createFetchHttpClient(),
        maxNetworkRetries: 2,
        timeout: 10_000,
    });
    return cachedClient;
}

export const stripeCryptoProvider = Stripe.createSubtleCryptoProvider();
export function isLiveStripeKey(): boolean;   // prefiks sk_live_ / rk_live_
```

2. `_shared/email/send-email.ts`: `sendEmail({ to, subject, html, text, idempotencyKey })` → `POST https://api.resend.com/emails` (`Authorization: Bearer RESEND_API_KEY`, nagłówek `Idempotency-Key`, `AbortSignal.timeout(5000)`); zwraca `{ ok, status }`, nie rzuca dla błędów sieciowych.
3. `_shared/email/templates/purchase-confirmation.ts`: `renderPurchaseConfirmation(data): { subject, html, text }`. Dane: nazwa, plan (PL), kwota (`Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' })` z groszy), metoda, data następnej płatności (karta) lub końca okresu (BLIK) w `Europe/Warsaw`, link do dokumentu (jeśli jest), link do `${APP_BASE_URL}/settings`. Funkcja `escapeHtml` dla danych użytkownika.
4. `sendPurchaseConfirmationEmail({ paymentId })` (w `payments-webhook.service.ts`): odczyt płatności + e-mail (`auth.admin.getUserById`) + `username` (`profiles`); pominięcie, gdy `confirmation_email_sent_at is not null`; `Idempotency-Key = purchase-confirmation/{paymentId}`; po sukcesie `update subscription_payments set confirmation_email_sent_at = now()`; całość w `try/catch`.
5. `_shared/internal-auth.ts`: `verifyInternalSecret(req)` (nagłówek `x-internal-worker-secret` lub `Bearer`, porównanie w stałym czasie, `INTERNAL_WORKER_SECRET`).
6. Testy: `billing-plans.test.ts` (mapowanie Price ID w obie strony, `addMonthsUtc` na granicach miesięcy, brak sekretu), `billing-eligibility.test.ts` (wszystkie 6 reguł + przypadki graniczne `current_period_end = now`), `purchase-confirmation.test.ts` (escapowanie, brak linku do dokumentu, karta vs BLIK).

### Krok 5 — Edge Function `checkout`

1. `checkout/checkout.types.ts` — schemat Zod (3.2).
2. `checkout/checkout.service.ts`:
    - `loadBillingState(userId)`,
    - `getOrCreateBillingCustomer({ userId, email })`,
    - `buildCheckoutSessionParams(...)` (czysta; 5.1),
    - `createCheckoutSession({ userId, email, command })` — orkiestracja; mapowanie `Stripe.errors.StripeError` → `ApplicationError('PAYMENT_PROVIDER_ERROR', 'Nie udało się rozpocząć płatności. Spróbuj ponownie.')`.
3. `checkout/checkout.handlers.ts`: `handlePostCheckoutSession` (kolejność z 5.1), `checkoutRouter` (`POST /checkout/sessions`; inne ścieżki `404 NOT_FOUND`, inne metody `405`).
4. `checkout/index.ts`: wzorzec z `plan/index.ts` — CORS (`Access-Control-Allow-Methods: POST, OPTIONS`), logowanie czasu, `handleError`, nagłówki CORS także na odpowiedziach błędów.
5. Rate limit: wywołanie `client.rpc('ai_rate_limit_hit', { p_key: 'checkout_session', p_window_seconds: 60, p_limit: 5 })` klientem użytkownika; `allowed = false` → `RateLimitedError(retry_after_seconds)`.
6. Testy: `checkout.types.test.ts`, `checkout.service.test.ts` (patrz krok 10).
7. `checkout/test-requests.http` — przykładowe żądania (wzorzec istniejących plików).

### Krok 6 — Edge Function `payments-webhook`

1. `supabase/config.toml`:

```toml
[functions.payments-webhook]
verify_jwt = false
```

2. `payments-webhook/stripe-mappers.ts` — jedyne miejsce zależne od kształtu obiektów Stripe: `extractSubscriptionPeriod(subscription)`, `extractPaymentIntentId(invoice)`, `extractInvoiceDocument(invoice)`, `resolvePurchase(session, event)`. Testowane na fixture'ach JSON zgodnych z przypiętą wersją API.
3. `payments-webhook/payments-webhook.service.ts`: `claimWebhookEvent`, `markWebhookEvent`, `processStripeEvent`, handlery z 5.2, `sendPurchaseConfirmationEmail`. Wszystkie RPC przez klienta service role.
4. `payments-webhook/payments-webhook.handlers.ts`: `handlePostWebhook` (kolejność z 5.2), `paymentsWebhookRouter` (tylko `POST`).
5. `payments-webhook/index.ts`: routing + `handleError`, **bez** nagłówków CORS.
6. Lokalnie: `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/payments-webhook`; `supabase functions serve payments-webhook --no-verify-jwt --env-file supabase/.env.local`.
7. Testy: `payments-webhook.service.test.ts` (krok 10).

### Krok 7 — Edge Function `billing`

1. `billing/billing.types.ts` (schemat query, kolumny).
2. `billing/billing.service.ts`: `getBillingPayments({ client, userId, limit })` — stała `BILLING_PAYMENT_SELECT_COLUMNS`, mapowanie do `BillingPaymentDto`.
3. `billing/billing.handlers.ts`: `handleGetBillingPayments`, `billingRouter` (`GET /billing/payments`).
4. `billing/index.ts`: jak `checkout` (CORS `GET, OPTIONS`).
5. `billing/test-requests.http`.

### Krok 8 — Rozszerzenie `GET /me`

1. `me/me.service.ts`: stała `SUBSCRIPTION_SELECT_COLUMNS`, zapytanie w `Promise.all`, obsługa błędu, pola w `MeDto` (lokalny interfejs i `shared/contracts/types.ts` muszą pozostać zgodne).
2. `me.handlers.ts`: bez zmian poza typem (opcjonalnie: niezgodność `user.id` ↔ `jwtPayload.sub` rzucać jako `ApplicationError('UNAUTHORIZED', ...)` zamiast `Error` — drobna poprawka z planu PREM-001).
3. Testy: `me.service.test.ts` (admin → pola `null`; brak wiersza → `null`; wiersz `active` mapowany poprawnie; błąd bazy → `INTERNAL_ERROR`).

### Krok 9 — Wygaszanie subskrypcji (endpoint wewnętrzny i cron)

1. `internal/billing-expire-subscriptions.service.ts`: `runBillingExpiry({ graceDays })` — RPC, pętla `syncAiCreditsForRole({ newRole: 'user', usageMode: 'keep' })` z `try/catch` per użytkownik, zwrot liczników.
2. `internal/billing-expire-subscriptions.handlers.ts`: `verifyInternalSecret` + wywołanie serwisu; `BILLING_EXPIRY_GRACE_DAYS` parsowane jak `PLAN_LIMIT_FREE` (liczba całkowita ≥ 0, domyślnie 3).
3. `internal/internal.handlers.ts`: nowa trasa `^\/internal\/billing\/expire-subscriptions\/?$` (`POST`).
4. **Zmiana w planie wdrożenia (krok 10):** zamiast `select public.billing_expire_subscriptions();` zadanie `pg_cron` wywołuje `net.http_post` na `/functions/v1/internal/billing/expire-subscriptions` (nagłówki jak w `docs/deployment/worker-production-deployment.md`, `get_internal_worker_secret()`), harmonogram `0 3 * * *`. Zaktualizować `PS-66-checkout-payments-deployment-plan.md`.
5. Testy: `billing-expire-subscriptions.service.test.ts` (0 wygasłych, kilku, błąd sync jednego użytkownika nie przerywa pętli).

### Krok 10 — Testy

**Jednostkowe (Deno, wzorzec `plan.service.test.ts`: atrapy klienta Supabase, brak sieci):**

| Plik | Scenariusze |
|---|---|
| `checkout.types.test.ts` | Poprawny body; zły `plan_id`/`payment_method`; `accepted_terms: false`; brak `accepted_digital_content_waiver`; nadmiarowe `success_url` ignorowane |
| `billing-eligibility.test.ts` | admin → forbidden; `user` → allowed; `premium` ręczny → already_active; `trialing` → allowed; `active` w okresie → already_active; BLIK po końcu okresu w grace → allowed; karta po końcu okresu → already_active; `expired` → allowed |
| `checkout.service.test.ts` | `buildCheckoutSessionParams`: `mode`/`payment_method_types`/`invoice_creation` dla karty vs BLIK; `expires_at` ≥ now + 30 min dla każdej sekundy minuty; identyczne parametry dla dwóch wywołań w tej samej minucie; URL-e z `APP_BASE_URL`; błąd Stripe → `PAYMENT_PROVIDER_ERROR`; brak `session.url` → 502; brak customer → utworzenie, istniejący → brak wywołania `customers.create` |
| `stripe-mappers.test.ts` | Okres karty, okres BLIK (miesiąc/rok, 31 stycznia), wyciąganie PaymentIntent, dokument `null` |
| `payments-webhook.service.test.ts` | Mapowanie zdarzeń → akcje; kwota/waluta/Price ID niezgodne → `WebhookPermanentError`; `already_processed` → brak podwójnego e-maila i synchronizacji poza retry; `duplicate_active_subscription`; admin (`role_skipped_admin`); `role_changed` vs `was_trialing` → właściwy `usageMode`; błąd e-maila nie zmienia wyniku; błąd sync → wyjątek |
| `payments-webhook.handlers.test.ts` | Brak/zły podpis → 400; zły tryb live/test → 400; `duplicate_processed` → 200; `in_progress` → 409; `WebhookPermanentError` → 200 + `failed`; inny błąd → 500 |
| `billing.service.test.ts` | Mapowanie DTO; filtr `user_id`; limit domyślny/maksymalny; `limit=0`/`51`/`abc` → 400 |
| `me.service.test.ts` | Patrz krok 8 |
| `ai-credits-sync.test.ts`, `billing-expire-subscriptions.service.test.ts` | Patrz kroki 3 i 9 |

**Integracyjne (lokalny Supabase, skrypt SQL / `docs/testing/`):**

- `billing_activate_premium`: rola w `raw_app_meta_data` zmieniona; `admin` pominięty; ponowne wywołanie tym samym PI → `already_processed`; wyjątek w środku → brak częściowych zapisów; zakup w trialu (`was_trialing`); `duplicate_active_subscription`.
- `billing_claim_webhook_event`: `claimed` → `in_progress` (< 2 min) → po `failed` ponownie `claimed` (`attempts + 1`) → po `processed` `duplicate_processed`.
- `billing_expire_subscriptions`: wygasa tylko po `okres + grace`; Premium ręczne nietknięte; zwraca wyłącznie zdegradowanych.
- Uprawnienia: wywołanie każdej funkcji `billing_*` z JWT `authenticated` i `anon` → `permission denied`.
- RLS: użytkownik A nie widzi `subscriptions`/`subscription_payments` użytkownika B; `billing_customers` i `payment_webhook_events` niedostępne.

**Ręczne (tryb testowy Stripe):** karta `4242…` (aktywacja + e-mail + faktura); BLIK testowy; karta odrzucona `4000 0000 0000 0002` (brak aktywacji, możliwość ponowienia); porzucenie płatności (`/checkout/cancel`); `stripe events resend <evt>` (duplikat → `duplicate`); wyłączony webhook → retry Stripe po przywróceniu; dwie sesje opłacone (alert `DUPLICATE_PURCHASE_NEEDS_REFUND`); aktywacja w trakcie trialu (fixture w bazie do czasu PS-68); odświeżenie sesji po zakupie i `GET /me` zwracające `subscription_status = 'active'`.

**E2E (Playwright, po stronie UI):** stubowane `POST /checkout/sessions`, `GET /me`, `GET /billing/payments` — zgodnie z planem UI.

### Krok 11 — Weryfikacja końcowa i dokumentacja

1. `supabase functions serve` dla czterech funkcji + `stripe listen`; przejść ścieżkę karta → webhook → `GET /me` (status `active`) → `GET /billing/payments` (dokument).
2. Sprawdzić w bazie: `subscriptions`, `subscription_payments` (start, koniec okresu, ID transakcji), `payment_webhook_events` (`processed`), `user_ai_credits` (pula Premium).
3. Potwierdzić, że `app_role` w nowym JWT (po `refreshSession`) to `premium`.
4. Zaktualizować dokumentację:
    - `docs/results/project-summary.md` (sekcje 4–5: nowe tabele i endpointy, `GET /me`, stan realizacji),
    - `PS-66-checkout-payments-deployment-plan.md` (krok 10 — cron przez `pg_net`; lista sekretów bez zmian),
    - `PS-66-checkout-payments-ui-plan.md` (warunek sukcesu pollingu — 1.3 pkt 11),
    - `README.md` w nowych funkcjach (wzorzec `plan/README.md`).

### Zmienne środowiskowe

Bez nowych zmiennych względem sekcji 9 planu API (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, cztery `STRIPE_PRICE_*`, `APP_BASE_URL`, `SUBSCRIPTION_TERMS_VERSION`, `BILLING_EXPIRY_GRACE_DAYS`, `RESEND_API_KEY`, `EMAIL_FROM`). Dodatkowo używane istniejące: `INTERNAL_WORKER_SECRET`, `AI_DRAFT_CREDITS_FREE`, `AI_DRAFT_CREDITS_PREMIUM`, `AI_IMAGE_CREDITS_PREMIUM`. Lokalnie uzupełnić `supabase/.env.local`.

### Znane ryzyka rezydualne

| Ryzyko | Decyzja |
|---|---|
| Błąd synchronizacji kredytów po udanym zapisie roli w webhooku | Webhook zwraca `500`, retry jest idempotentny (`already_processed` → ponowny sync). Przy retry po zużyciu kredytu w międzyczasie użytkownik może dostać jednorazowo pełną pulę — akceptowane |
| Błąd sync kredytów przy wygaszaniu (brak ponowienia) | Log z `user_id`, ręczna korekta z panelu admina; ewentualna samonaprawa w backlogu |
| Brak automatycznej ponowki e-maila | Zgodnie z planem (funkcjonalność odłożona); `confirmation_email_sent_at is null` pozwala znaleźć zaległe |
| Duplikat zakupu wymaga ręcznego zwrotu | Alert z tabeli `payment_webhook_events` (`failed`, `DUPLICATE_PURCHASE_NEEDS_REFUND`); pełna obsługa zwrotów — PS-67 |
| Zależność od kształtu obiektów Stripe | Przypięta wersja API + izolacja w `stripe-mappers.ts` + fixture'y w testach |
| `admin_update_user_role` i inne istniejące RPC mogą mieć domyślne `EXECUTE` dla `authenticated` | Poza zakresem PS-66, ale warto zweryfikować (`\df+`/`information_schema.routine_privileges`) przy okazji tej samej kontroli uprawnień |
