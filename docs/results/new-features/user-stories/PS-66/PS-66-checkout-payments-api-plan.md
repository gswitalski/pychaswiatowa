# PS-66: Checkout i płatności (subskrypcja Premium) — Plan API

> **User Story:** PS-66 — Checkout i płatności (subskrypcja Premium)
> **Data:** wrzesień 2026
> **Dotyczy:** Supabase Edge Functions (`checkout`, `billing`, `payments-webhook`, `me`, `_shared`), migracje PostgreSQL
> **Zależności:** PS-63 (cennik), PS-64 (kredyty AI)

---

## 1. Podsumowanie zmian

| Element | Typ | Opis |
|---|---|---|
| `POST /checkout/sessions` | Nowy endpoint | Tworzy sesję hosted checkout u operatora płatności (Stripe) i zwraca URL przekierowania |
| `POST /payments-webhook` | Nowy endpoint (bez JWT, podpis operatora) | Odbiera zdarzenia Stripe, aktywuje Premium, zapisuje subskrypcję i płatność, wysyła e-mail |
| `GET /billing/payments` | Nowy endpoint | Historia płatności użytkownika wraz z linkami do faktury/potwierdzenia |
| `GET /me` | Modyfikacja | Dodanie pól subskrypcji (`subscription_status`, `current_period_end` itd.) |
| Tabele `billing_customers`, `subscriptions`, `subscription_payments`, `payment_webhook_events` | Nowe tabele | Dane klienta u operatora, subskrypcja, płatności, idempotencja webhooków |
| RPC `billing_activate_premium`, `billing_renew_subscription`, `billing_expire_subscriptions` | Nowe funkcje SQL | Transakcyjna zmiana roli + zapis subskrypcji/płatności; wygaszanie |
| `_shared/ai-credits-sync.ts` | Refaktoryzacja | Wydzielenie `syncAiCreditsForRoleChange` z `admin.service.ts` do współdzielonego modułu |
| `_shared/email/` | Nowy moduł | Wysyłka e-maili transakcyjnych (Resend) + szablon „Potwierdzenie zakupu” |
| Job `pg_cron` `billing_expire_subscriptions` | Nowe zadanie | Siatka bezpieczeństwa: wygaszanie po upływie okresu (patrz sekcja 8) |

---

## 2. Decyzje projektowe

| Obszar | Decyzja |
|---|---|
| Operator płatności | **Stripe** (Checkout hosted + Billing). Alternatywa „PayU lub odpowiednik” z historyjki spełniona przez Stripe |
| Metody płatności | Karta i BLIK (PLN). **Karta** → subskrypcja cykliczna (`mode=subscription`, auto-odnowienie). **BLIK** → płatność jednorazowa za okres (`mode=payment`), bez auto-odnowienia |
| Plany | `premium_yearly` (domyślny, 16 900 gr) i `premium_monthly` (2 400 gr) — spójnie z `pricing.config.ts` |
| Źródło prawdy o zakupie | Wyłącznie webhook. Strona powrotu (`success_url`) niczego nie aktywuje |
| Rola | `auth.users.raw_app_meta_data.app_role = 'premium'` ustawiana w RPC po stronie serwera |
| Dokument sprzedaży | Faktura/potwierdzenie generowane przez Stripe (`hosted_invoice_url`, `invoice_pdf`); faktury VAT z NIP i KSeF — poza zakresem (patrz dokument funkcjonalności odłożonych) |
| E-mail | Resend, wywołanie z webhooka po pomyślnej aktywacji |
| Trial | Nie jest uruchamiany w PS-66 (PS-68). Obsłużony jest tylko zakup przez użytkownika, który ma `subscription_status = 'trialing'` |
| Dane karty | Nigdy nie trafiają do aplikacji ani bazy (hosted checkout operatora) |

> **Uwaga o BLIK:** przed wdrożeniem potwierdzić w koncie Stripe dostępność BLIK dla PLN (patrz plan wdrożenia). Jeśli w przyszłości BLIK zacznie wspierać płatności cykliczne, zmiana polega na dodaniu wariantu `mode=subscription` dla `blik` — kontrakt API pozostaje bez zmian.

---

## 3. Nowy endpoint `POST /checkout/sessions`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/checkout/sessions` |
| Autoryzacja | Bearer JWT (wymagane) |
| Role | `user` oraz `premium` **wyłącznie** gdy `subscription_status = 'trialing'`. `admin` → `403` |
| Rate limit | 5 żądań / minutę / użytkownik (`429`) |

### Body

```json
{
    "plan_id": "premium_yearly",
    "payment_method": "card",
    "accepted_terms": true,
    "accepted_digital_content_waiver": true
}
```

| Pole | Typ | Walidacja |
|---|---|---|
| `plan_id` | `string` | `premium_yearly` \| `premium_monthly` (allowlist) |
| `payment_method` | `string` | `card` \| `blik` |
| `accepted_terms` | `boolean` | Wymagane `true` — akceptacja regulaminu subskrypcji |
| `accepted_digital_content_waiver` | `boolean` | Wymagane `true` — zgoda na natychmiastowe świadczenie treści cyfrowych i świadomość utraty prawa odstąpienia |

> W odróżnieniu od szkicu z `PS-63-pricing-page-api-plan.md` klient **nie przekazuje** `success_url` / `cancel_url`. Adresy są budowane po stronie serwera z `APP_BASE_URL` (ochrona przed open redirect).

### Przepływ

```
autoryzacja (JWT)
→ walidacja body (plan_id, payment_method, obie zgody = true)
→ rate limit
→ odczyt app_role z JWT oraz subscription_status z tabeli subscriptions
→ jeśli app_role === 'admin'                       → 403 FORBIDDEN_ROLE
→ jeśli app_role === 'premium' i status != 'trialing' → 409 SUBSCRIPTION_ALREADY_ACTIVE
→ pobierz/utwórz klienta Stripe (tabela billing_customers)
→ wybierz Price ID wg (plan_id, payment_method) ze zmiennych środowiskowych
→ stripe.checkout.sessions.create(...)
→ 201 { checkout_url, session_id, expires_at }
```

### Parametry sesji Stripe

| Parametr | Wartość |
|---|---|
| `mode` | `subscription` (karta) / `payment` (BLIK) |
| `payment_method_types` | `['card']` / `['blik']` |
| `customer` | ID z `billing_customers` |
| `client_reference_id` | `user_id` |
| `line_items` | `[{ price: <STRIPE_PRICE_ID>, quantity: 1 }]` |
| `locale` | `pl` |
| `success_url` | `{APP_BASE_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}` |
| `cancel_url` | `{APP_BASE_URL}/checkout/cancel` |
| `expires_at` | teraz + 30 min |
| `invoice_creation` | `{ enabled: true }` — tylko dla `mode=payment` (BLIK); dla subskrypcji faktura powstaje automatycznie |
| `metadata` (oraz `subscription_data.metadata`) | `user_id`, `plan_id`, `payment_method`, `terms_version`, `terms_accepted_at` |
| Idempotency key | `checkout:{user_id}:{plan_id}:{payment_method}:{minuta}` |

> `terms_version` przyjmuje wartość z allowlisty (np. `subscription-terms-pl-v1`), analogicznie do zgody marketingowej. Zapis metadanych + wiersza w `subscription_payments` stanowi dowód akceptacji regulaminu.

### Odpowiedź `201 Created`

```json
{
    "checkout_url": "https://checkout.stripe.com/c/pay/cs_test_...",
    "session_id": "cs_test_...",
    "expires_at": "2026-09-29T20:30:00Z"
}
```

### Kody błędów

| Kod HTTP | Kod błędu | Sytuacja |
|---|---|---|
| `400 Bad Request` | `VALIDATION_ERROR` | Nieprawidłowy `plan_id` / `payment_method` lub brak zgód |
| `401 Unauthorized` | `UNAUTHORIZED` | Brak lub nieważny JWT |
| `403 Forbidden` | `FORBIDDEN_ROLE` | Rola `admin` |
| `409 Conflict` | `SUBSCRIPTION_ALREADY_ACTIVE` | Użytkownik ma już aktywne Premium |
| `429 Too Many Requests` | `RATE_LIMITED` | Przekroczono limit tworzenia sesji |
| `502 Bad Gateway` | `PAYMENT_PROVIDER_ERROR` | Stripe niedostępny lub odrzucił żądanie |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Nieoczekiwany błąd |

---

## 4. Nowy endpoint `POST /payments-webhook`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `POST` |
| URL | `/functions/v1/payments-webhook` |
| Autoryzacja | **Brak JWT** (`verify_jwt = false` w `supabase/config.toml`); wymagany nagłówek `Stripe-Signature` weryfikowany sekretem `STRIPE_WEBHOOK_SECRET` |
| Wywołujący | Wyłącznie Stripe |

### Obsługiwane zdarzenia

| Zdarzenie Stripe | Działanie |
|---|---|
| `checkout.session.completed` | Jeśli `payment_status = 'paid'` → aktywacja Premium (patrz przepływ). Jeśli `unpaid` (płatność asynchroniczna) → tylko log, oczekiwanie na kolejne zdarzenie |
| `checkout.session.async_payment_succeeded` | Aktywacja Premium (jak wyżej) |
| `checkout.session.async_payment_failed` | Zapis płatności ze statusem `failed`, bez zmiany roli |
| `checkout.session.expired` | Log, bez zmian w danych |
| `invoice.paid` (`billing_reason = 'subscription_cycle'`) | Odnowienie: przesunięcie `current_period_end`, zapis płatności (minimalna obsługa, by rola nie wygasła przy płacącym użytkowniku) |
| Pozostałe | `200 OK` + status `ignored` w `payment_webhook_events` |

### Przepływ aktywacji (`checkout.session.completed` / `async_payment_succeeded`)

```
1. Weryfikacja podpisu (stripe.webhooks.constructEventAsync) → błąd: 400 INVALID_SIGNATURE
2. INSERT payment_webhook_events (event_id UNIQUE)
      → konflikt i status = 'processed' → 200 OK (duplikat)
3. Odczyt metadata.user_id, plan_id, payment_method; weryfikacja:
      - user istnieje, session.currency = 'pln'
      - amount_total zgodne z oczekiwaną ceną planu (STRIPE_PRICE_* → plan_id)
      → niezgodność: status 'failed', log krytyczny, 200 (bez aktywacji, wymaga ręcznej analizy)
4. Pobranie faktury (session.invoice) → hosted_invoice_url, invoice_pdf, numer
5. RPC billing_activate_premium(...) — jedna transakcja:
      - UPSERT subscriptions (status 'active', started_at, current_period_start/end,
        auto_renew, provider_subscription_id, trial_ends_at = NULL)
      - INSERT subscription_payments (ID transakcji = payment_intent, kwota, dokument, zgody)
      - UPDATE auth.users.raw_app_meta_data.app_role = 'premium'
        (pomijane dla admina — log ostrzeżenia)
6. syncAiCreditsForRole(userId, 'premium', { keepUsage }) — patrz sekcja 6
7. Wysyłka e-maila „Potwierdzenie zakupu” (błąd wysyłki nie przerywa przetwarzania)
8. payment_webhook_events.status = 'processed' → 200 OK
```

**Zasady:**

- Błąd w krokach 2–6 (poza wysyłką e-maila) zwraca `500`, by Stripe ponowił dostarczenie; kroki są idempotentne (`event_id`, unikalność `provider_payment_intent_id`).
- Okres: `karta` — `current_period_start/end` z obiektu subskrypcji Stripe; `blik` — start = teraz, koniec = start + 1 miesiąc lub 12 miesięcy wg planu.
- **Zakup w trakcie trialu** (`subscriptions.status = 'trialing'`): ten sam wiersz zostaje przełączony na `active`, `trial_ends_at = NULL`, płatny okres liczony od dnia zakupu (bez odbierania i bez dodawania dni), rola pozostaje `premium`.
- Zapisywane dane wymagane przez historyjkę: data startu (`started_at`), data następnej płatności (`current_period_end`), ID transakcji (`provider_payment_intent_id`).

### Odpowiedzi

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Zdarzenie przetworzone, zignorowane lub duplikat |
| `400 Bad Request` | Brak/niepoprawny podpis lub nieparsowalne body |
| `500 Internal Server Error` | Błąd przetwarzania — Stripe ponowi wywołanie |

---

## 5. Nowy endpoint `GET /billing/payments`

### Metadane

| Atrybut | Wartość |
|---|---|
| Metoda | `GET` |
| URL | `/functions/v1/billing/payments` |
| Autoryzacja | Bearer JWT (wymagane), dowolna rola |
| Parametry | `limit` (opcjonalnie, domyślnie 20, maks. 50) |

### Odpowiedź `200 OK`

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
            "paid_at": "2026-09-29T19:41:12Z",
            "document_number": "PYCH-0001",
            "document_url": "https://invoice.stripe.com/i/...",
            "document_pdf_url": "https://pay.stripe.com/invoice/.../pdf"
        }
    ]
}
```

- Zwracane są wyłącznie wiersze bieżącego użytkownika (`user_id = auth.uid()`), sortowane po `paid_at desc`.
- Pola techniczne Stripe (ID sesji, ID klienta) nie są ujawniane.
- Kwoty w groszach (`int`), spójnie z `pricing.config.ts`.

| Kod HTTP | Sytuacja |
|---|---|
| `200 OK` | Lista (może być pusta) |
| `401 Unauthorized` | Brak lub nieważny JWT |

---

## 6. Modyfikacja `GET /me`

Rozszerzenie odpowiedzi o pola zapowiedziane w `PS-63-pricing-page-api-plan.md` (sekcja 5):

| Pole | Typ | Opis |
|---|---|---|
| `subscription_status` | `'active' \| 'trialing' \| 'past_due' \| 'canceled' \| 'expired' \| null` | `null` dla użytkowników bez subskrypcji (Free, admin, Premium nadane ręcznie) |
| `subscription_plan_id` | `string \| null` | `premium_monthly` / `premium_yearly` |
| `current_period_end` | `timestamptz \| null` | Data następnej płatności (karta) lub końca opłaconego okresu (BLIK) |
| `auto_renew` | `boolean \| null` | `true` — karta, `false` — BLIK |
| `trial_ends_at` | `timestamptz \| null` | Koniec trialu (wypełniane przez PS-68) |

Zmiana jest **wstecznie zgodna** (nowe pola opcjonalne). `GET /me` służy też do pollingu na `/checkout/success`.

### Kredyty AI po aktywacji (współdzielona logika PS-64)

Logika `syncAiCreditsForRoleChange` z `admin.service.ts` zostaje przeniesiona do `supabase/functions/_shared/ai-credits-sync.ts` i użyta przez `admin` oraz `payments-webhook`. Dla aktywacji Premium:

| Sytuacja | Zachowanie |
|---|---|
| `user` → `premium` (pierwszy zakup) | Pula Premium (zmienne `AI_CREDITS_PREMIUM_*`, domyślnie 20 draft / 5 image), `used = 0`, `limit_type = monthly`, `next_reset_at` = koniec bieżącego okresu miesięcznego liczony od daty zakupu |
| Zakup w trakcie trialu | Podniesienie `total` do puli Premium, **`used` nie jest zerowane** (brak podwójnej puli po trialu), `limit_type = monthly` |
| Odnowienie (`invoice.paid`) | Bez zmian puli — reset obsługuje istniejący cron (`run_ai_credits_monthly_reset`) |

---

## 7. Model danych (migracja)

Plik: `supabase/migrations/<timestamp>_create_billing_subscriptions.sql`

### `billing_customers`

| Kolumna | Typ | Opis |
|---|---|---|
| `user_id` | `uuid` PK, FK → `auth.users` ON DELETE CASCADE | Użytkownik |
| `provider` | `text` NOT NULL DEFAULT `'stripe'` | Operator |
| `provider_customer_id` | `text` NOT NULL UNIQUE | `cus_...` |
| `created_at` | `timestamptz` | Czas utworzenia |

### `subscriptions`

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `uuid` PK DEFAULT `gen_random_uuid()` | |
| `user_id` | `uuid` UNIQUE NOT NULL, FK → `auth.users` ON DELETE CASCADE | 1:1 z użytkownikiem |
| `plan_id` | `text` CHECK (`premium_monthly`, `premium_yearly`) | Plan |
| `status` | `text` CHECK (`active`, `trialing`, `past_due`, `canceled`, `expired`) | PS-66 zapisuje `active`; pozostałe statusy rezerwują PS-67/PS-68 |
| `payment_method_type` | `text` CHECK (`card`, `blik`) | Metoda ostatniego zakupu |
| `auto_renew` | `boolean` NOT NULL | `true` = subskrypcja cykliczna |
| `provider_subscription_id` | `text` NULL | `sub_...` (tylko karta) |
| `started_at` | `timestamptz` NOT NULL | Data startu subskrypcji |
| `current_period_start` | `timestamptz` NOT NULL | Początek okresu |
| `current_period_end` | `timestamptz` NOT NULL | Data następnej płatności / końca okresu |
| `trial_ends_at` | `timestamptz` NULL | Koniec trialu (PS-68) |
| `canceled_at` | `timestamptz` NULL | (PS-67) |
| `created_at` / `updated_at` | `timestamptz` | Audyt (`moddatetime`) |

Indeksy: `subscriptions(status, current_period_end)` (job wygaszania), `subscriptions(provider_subscription_id)`.

### `subscription_payments`

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | `bigint` PK identity | |
| `user_id` | `uuid` FK → `auth.users` | Płatnik |
| `subscription_id` | `uuid` FK → `subscriptions` | |
| `plan_id` | `text` | Plan w chwili zakupu |
| `payment_method_type` | `text` | `card` / `blik` |
| `amount_gross` | `integer` NOT NULL | Kwota brutto w groszach |
| `currency` | `text` NOT NULL DEFAULT `'PLN'` | |
| `status` | `text` CHECK (`paid`, `failed`) | |
| `provider_session_id` | `text` | `cs_...` |
| `provider_payment_intent_id` | `text` UNIQUE | **ID transakcji** (idempotencja) |
| `provider_invoice_id` | `text` | `in_...` |
| `document_number` / `document_url` / `document_pdf_url` | `text` | Faktura/potwierdzenie |
| `terms_version` | `text` | Wersja akceptowanego regulaminu |
| `terms_accepted_at` | `timestamptz` | Dowód akceptacji |
| `confirmation_email_sent_at` | `timestamptz` NULL | Znacznik wysłania e-maila |
| `paid_at` | `timestamptz` | |
| `created_at` | `timestamptz` | |

### `payment_webhook_events`

| Kolumna | Typ | Opis |
|---|---|---|
| `event_id` | `text` PK | `evt_...` |
| `type` | `text` | Typ zdarzenia |
| `status` | `text` CHECK (`received`, `processed`, `failed`, `ignored`) | |
| `error_message` | `text` NULL | |
| `received_at` / `processed_at` | `timestamptz` | |

### RLS

| Tabela | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| `billing_customers` | brak polityk (tylko service role) | tylko service role |
| `subscriptions` | własny wiersz (`user_id = auth.uid()`) | tylko service role |
| `subscription_payments` | własne wiersze | tylko service role |
| `payment_webhook_events` | brak polityk | tylko service role |

### Funkcje SQL (`SECURITY DEFINER`, `EXECUTE` tylko dla `service_role`)

| Funkcja | Opis |
|---|---|
| `billing_activate_premium(p_user_id, p_plan_id, p_payment_method, p_auto_renew, p_period_start, p_period_end, p_provider_subscription_id, p_payment jsonb)` | UPSERT `subscriptions`, INSERT `subscription_payments`, ustawienie `app_role = 'premium'` w `raw_app_meta_data` (pomija `admin`). Jedna transakcja |
| `billing_renew_subscription(p_provider_subscription_id, p_period_start, p_period_end, p_payment jsonb)` | Przedłużenie okresu + zapis płatności (dla `invoice.paid`) |
| `billing_expire_subscriptions()` | Patrz sekcja 8 |

---

## 8. Siatka bezpieczeństwa: wygaszanie subskrypcji

Bez obsługi anulowania i niepowodzenia płatności (PS-67) rola `premium` nie mogłaby nigdy wygasnąć (np. po BLIK). Dlatego PS-66 zawiera minimalny job:

- `billing_expire_subscriptions()` wybiera `subscriptions` ze `status = 'active'` i `current_period_end + interwał_łaski < now()` (łaska: 3 dni; zmienna `BILLING_EXPIRY_GRACE_DAYS`),
- ustawia `status = 'expired'`, `app_role = 'user'` (pomija `admin`),
- zwraca listę `user_id`, dla których Edge Function/cron wywołuje `syncAiCreditsForRole(userId, 'user')` (pula Free), albo synchronizacja wykonywana jest w tej samej funkcji SQL wzorem `run_ai_credits_monthly_reset`,
- harmonogram: `pg_cron`, codziennie 03:00 UTC.

Pełna obsługa (anulowanie, `past_due`, e-maile grace period, portal klienta) — PS-67 (patrz dokument funkcjonalności odłożonych).

---

## 9. Zmienne środowiskowe (Supabase Secrets)

| Zmienna | Opis |
|---|---|
| `STRIPE_SECRET_KEY` | Restricted API key (tryb test na dev, live na produkcji) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret endpointu webhooka (`whsec_...`) |
| `STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING` | Price ID: 24 zł / miesiąc, cykliczna (karta) |
| `STRIPE_PRICE_PREMIUM_YEARLY_RECURRING` | Price ID: 169 zł / rok, cykliczna (karta) |
| `STRIPE_PRICE_PREMIUM_MONTHLY_ONETIME` | Price ID: 24 zł, jednorazowa (BLIK) |
| `STRIPE_PRICE_PREMIUM_YEARLY_ONETIME` | Price ID: 169 zł, jednorazowa (BLIK) |
| `APP_BASE_URL` | Bazowy URL frontendu (`https://pychaswiatowa.web.app`) |
| `SUBSCRIPTION_TERMS_VERSION` | Bieżąca wersja regulaminu subskrypcji (allowlista) |
| `BILLING_EXPIRY_GRACE_DAYS` | Dni łaski przed wygaszeniem (domyślnie `3`) |
| `RESEND_API_KEY` | Klucz API Resend |
| `EMAIL_FROM` | Adres nadawcy, np. `PychaŚwiatowa <no-reply@twojadomena.pl>` |

Zmienne `AI_CREDITS_PREMIUM_*` (PS-64) pozostają bez zmian.

---

## 10. E-mail „Potwierdzenie zakupu”

| Element | Opis |
|---|---|
| Moduł | `supabase/functions/_shared/email/` (`send-email.ts`, `templates/purchase-confirmation.ts`) — współdzielony z przyszłymi e-mailami cyklu życia (PS-71) |
| Treść | Imię/username, plan, kwota brutto, metoda płatności, data następnej płatności (karta) lub końca okresu (BLIK), link do faktury/potwierdzenia, link do `/settings` |
| Język | Polski; wersja HTML + tekstowa |
| Wysyłka | Po `billing_activate_premium`; po sukcesie `subscription_payments.confirmation_email_sent_at = now()` |
| Błąd wysyłki | Log błędu, webhook nadal kończy się `200`; brak automatycznej ponowki w PS-66 |
| Wyłączenie e-maili Stripe | Standardowe potwierdzenia Stripe dla klienta wyłączone w panelu, by uniknąć duplikatów |

---

## 11. Bezpieczeństwo

| Zagrożenie | Mitygacja |
|---|---|
| Sfałszowany webhook | Weryfikacja podpisu `Stripe-Signature`; brak podpisu → `400` |
| Powtórne dostarczenie zdarzenia | `payment_webhook_events.event_id` UNIQUE + unikalny `provider_payment_intent_id` |
| Podmiana ceny/planu po stronie klienta | Cena wyznaczana z `plan_id` po stronie serwera (Price ID ze secrets); w webhooku weryfikacja `amount_total` i `currency` |
| Open redirect | URL-e powrotu budowane z `APP_BASE_URL`, nie z body |
| Eskalacja roli | Rola ustawiana wyłącznie w RPC `SECURITY DEFINER` wywoływanym z webhooka; `EXECUTE` tylko dla `service_role` |
| Nadpisanie roli `admin` | RPC pomija użytkowników z `app_role = 'admin'` |
| Podwójny zakup | `409 SUBSCRIPTION_ALREADY_ACTIVE` + klucz idempotencji sesji |
| Wyciek danych płatniczych | Hosted checkout; w bazie tylko ID Stripe i kwoty; sekrety wyłącznie w Supabase Secrets |
| Nadużycia (tworzenie sesji) | Rate limit 5/min/użytkownik |
| Dostęp do cudzych płatności | RLS `user_id = auth.uid()` + filtr w endpointcie |

---

## 12. Kody błędów — podsumowanie nowych kodów

| Kod HTTP | Kod błędu | Endpoint | Opis |
|---|---|---|---|
| `400` | `VALIDATION_ERROR` | `POST /checkout/sessions` | Nieprawidłowe dane wejściowe / brak zgód |
| `400` | `INVALID_SIGNATURE` | `POST /payments-webhook` | Niepoprawny podpis |
| `403` | `FORBIDDEN_ROLE` | `POST /checkout/sessions` | Rola `admin` |
| `409` | `SUBSCRIPTION_ALREADY_ACTIVE` | `POST /checkout/sessions` | Aktywne Premium |
| `429` | `RATE_LIMITED` | `POST /checkout/sessions` | Limit sesji |
| `502` | `PAYMENT_PROVIDER_ERROR` | `POST /checkout/sessions` | Błąd operatora |

---

## 13. Testy

| Poziom | Zakres |
|---|---|
| Jednostkowe (Vitest/Deno) | Walidacja body, wybór Price ID, uprawnienia ról, mapowanie zdarzeń Stripe → akcje, kalkulacja okresów (karta/BLIK, miesiąc/rok), idempotencja webhooka, zakup w trakcie trialu |
| Integracyjne | RPC `billing_activate_premium` (rola w JWT claims po zmianie, pomijanie admina, rollback przy błędzie), RLS tabel |
| Ręczne (tryb testowy Stripe) | Karta `4242…`, BLIK testowy (kody testowe Stripe), karta odrzucona `4000 0000 0000 0002`, porzucenie płatności, zdublowany webhook (`stripe events resend`) |
| E2E (Playwright) | Ścieżka gościa → login → `/checkout`; stubowany `POST /checkout/sessions` i `GET /me` na stronie sukcesu |
