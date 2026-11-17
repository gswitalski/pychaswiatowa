# Premium: plan uruchomienia płatności online (MVP) i kroki po starcie

> **Data:** 17.11.2026
> **Dotyczy epiku:** `premium-users` (PS-63 … PS-90)
> **Źródła:** `analiza-funkcjonalnosci-premium-users.md` (decyzje startowe, sekcja 1.1), `premium-users-user-stories.md`, dokumenty PS-63…PS-66 w `docs/results/new-features/user-stories/`.
> **Zasada:** ten dokument jest jedyną listą „co mam zrobić, żeby pobrać pierwszą płatność”. Dokumenty PS-66 (`…-deployment-plan.md`, `…-deferred-features.md`) są szczegółową referencją techniczną.

Oznaczenia kroków:

- **[RĘCZNIE]** — robisz Ty w panelu usługi lub terminalu (bez kodu),
- **[KOD]** — zmiana w repozytorium (historyjka lub drobna poprawka),
- **[PRAWO/KSIĘGOWOŚĆ]** — konsultacja lub decyzja merytoryczna,
- **[TEST]** — weryfikacja.

---

## 1. Zakres wersji startowej (MVP płatności)

Cel: **pierwsza płatność kartą za Premium** z minimalną liczbą ruchomych części.

| Element | Start | Po starcie |
|---|---|---|
| Metoda płatności | **Karta** (subskrypcja, automatyczne odnowienie), w tym Apple Pay / Google Pay jako portfele kart | BLIK (jednorazowo za okres) — dopiero z przypomnieniami o końcu okresu |
| Plany | **24 zł / miesiąc**, **169 zł / rok** (~41% taniej niż 12 × 24 zł) | Zmiana ceny, kody rabatowe |
| Trial 7 dni | **Nie** (usunięty z oferty i regulaminu) | PS-68, gdy będą dane o konwersji |
| Operator | **Stripe**, hosted Checkout (bez kluczy po stronie frontendu) | — |
| Faktura / potwierdzenie | **Stripe** (e-mail + `hosted_invoice_url` widoczny w `/settings`) | Faktury VAT z NIP, system fakturowy (jeśli tego wymaga księgowa) |
| E-maile transakcyjne | **Tylko e-maile Stripe** (bez Resend) | PS-72: własne e-maile, przypomnienia, winback |
| Anulowanie | **Ręcznie**: użytkownik pisze na `kontakt@pychaswiatowa.pl`, Ty anulujesz w Stripe Dashboard | **Stripe Customer Portal** (PS-67 etap A) — pierwszy krok po starcie |
| Nieudana płatność przy odnowieniu | Brak aktywnej obsługi; Premium wygasa po `current_period_end` + 3 dni (job dobowy) | Zdarzenia Stripe (`invoice.payment_failed`, `customer.subscription.deleted`) + e-maile (PS-67 etap B, PS-72) |
| Własna strona statusu subskrypcji, zmiana planu, panel admina subskrypcji | Nie | PS-67, PS-73 |
| Limity Free | Plan: 7 pozycji; AI: 3 próbne kredyty `draft` łącznie | Zmiany po danych |
| Domena | `https://pychaswiatowa.pl` | — |
| Środowiska testowe | Lokalnie (Stripe CLI + `supabase start`) → od razu produkcja (live) + smoke test własną kartą | Osobne środowisko staging (opcjonalnie) |

**Co już jest w kodzie** (PS-63…PS-66): `/pricing`, `/checkout` (+ `success`/`cancel`), `POST /checkout/sessions`, webhook `payments-webhook` (podpis, `livemode`, idempotencja), `GET /billing/payments`, `GET /me` (status subskrypcji), historia płatności w `/settings`, kredyty AI per rola, limit planu Free, job wygaszania `billing_expire_subscriptions`, regulamin `/legal/subscription`. Deploy funkcji `checkout`, `billing`, `payments-webhook` jest w CI (`.github/workflows/main-deploy.yml`).

**Czego brakuje do sprzedaży:** konfiguracja Stripe, sekrety Supabase, zadanie cron, uzupełnione dane firmy w regulaminie, weryfikacja prawna i księgowa, testy płatności. To są wyłącznie kroki **[RĘCZNIE]** / **[PRAWO]** / **[TEST]** — nie ma już obowiązkowej historyjki kodowej przed startem.

---

## 2. Mapa kroków (skrót)

| # | Faza | Co | Typ | Czas oczekiwania | Blokuje |
|---|---|---|---|---|---|
| A1 | Równolegle | Konto Stripe, weryfikacja firmy (KYC), tryb live | RĘCZNIE | 1–5 dni | D, G |
| A2 | Równolegle | Księgowa: dokument sprzedaży, VAT | PRAWO/KS. | kilka dni | G (nie F) |
| A3 | Równolegle | Dane firmy w regulaminie + prawnik (część C) | PRAWO | kilka dni | G |
| B | Stan produkcji | Sprawdzenie: kod, migracja, sekret workera | RĘCZNIE | godzina | E, F |
| C | Lokalnie | Test płatności ze Stripe CLI | TEST | 2–3 godziny | F |
| D | Stripe live | Produkty/ceny, klucz, webhook, faktury, e-maile | RĘCZNIE | 1–2 godziny | E |
| E | Supabase | Sekrety i zadanie cron | RĘCZNIE | 30 min | F, G |
| F | Wdrożenie | Merge do `main`, CI wdraża migrację i funkcje | RĘCZNIE | 15 min | G |
| G | Smoke test | Prawdziwa płatność, zwrot, sprzątanie | TEST | 1 godzina | H |
| H | Otwarcie | Komunikat, monitoring pierwszych dni | RĘCZNIE | — | — |

Ścieżka krytyczna: **A1 → D → E → F → G** (reszta równolegle). Jeśli kod PS-66 jest już na `main` (sprawdź w kroku B1), wykonaj D i E **jak najszybciej** — inaczej użytkownik klikający „Wybierz Premium” trafi na niedziałający `/checkout`.

---

## 3. Fazy szczegółowo

### Faza A — kroki o długim czasie oczekiwania (zacznij od nich, równolegle)

**A1. [RĘCZNIE] Konto Stripe i weryfikacja**

1. Zarejestruj konto na stripe.com (kraj: Polska, waluta rozliczeniowa: PLN).
2. Uzupełnij dane działalności (firma lub JDG), osoby reprezentującej i konto bankowe do wypłat. Bez tego **tryb live nie zadziała**, a weryfikacja trwa najdłużej.
3. W `Settings → Public details`: nazwa publiczna „PychaŚwiatowa”, adres wsparcia `kontakt@pychaswiatowa.pl`, adresy: regulamin `https://pychaswiatowa.pl/legal/subscription`, polityka prywatności `https://pychaswiatowa.pl/legal/privacy`.
4. `Statement descriptor`: `PYCHASWIATOWA` (widoczny na wyciągu klienta).
5. Do czasu testów korzystaj z trybu testowego (sandbox) — ma osobne klucze i ceny.

**A2. [PRAWO/KSIĘGOWOŚĆ] Księgowa — jedno spotkanie, trzy pytania**

1. Czy faktura/potwierdzenie ze Stripe jest wystarczającym dokumentem sprzedaży dla konsumenta (B2C), czy wystawiać fakturę we własnym systemie (KSeF)?
2. Stawka VAT i miejsce świadczenia dla usługi cyfrowej (cena 24/169 zł jest brutto — `tax behavior = inclusive`).
3. Czy sprzedaż online przez Stripe wymaga kasy fiskalnej / ewidencji (zwolnienie dla usług cyfrowych), jak księgować wypłaty i opłaty Stripe.

Wynik zapisz w jednym zdaniu (np. w `docs/legel-next-steps.md`). Jeśli księgowa wymaga własnych faktur, odłóż otwarcie sprzedaży lub włącz pierwsze płatności bez publicznego startu i dopisz integrację fakturową jako pierwszą historyjkę po starcie.

**A3. [PRAWO] Treści prawne**

Plik: `public/assets/legal/subscription-terms.md` (strona `/legal/subscription`; jedyne źródło treści).

1. Uzupełnij placeholdery danych sprzedawcy (nazwa firmy, adres, NIP, kontakt) — lista w `docs/legel-next-steps.md`.
2. **Niezgodność do rozstrzygnięcia:** punkt 3.4 regulaminu mówi, że dane do faktury Użytkownik podaje w checkout, a checkout **nie zbiera NIP**. Wybierz: (a) zmień zdanie na „fakturę na firmę wystawimy po przesłaniu danych na `kontakt@pychaswiatowa.pl`” (najprostsze, zalecane na start), albo (b) dodaj zbieranie NIP w Stripe Checkout (zmiana kodu — odłożona).
3. Zleć prawnikowi weryfikację części C (prawo odstąpienia, treści cyfrowe, zgoda na natychmiastowe świadczenie).
4. W polityce prywatności dopisz podprocesora **Stripe**. Resend dopisz dopiero przy PS-72.
5. Po zmianach regulaminu ustaw `SUBSCRIPTION_TERMS_VERSION` (krok E) na nową wersję, np. `subscription-terms-pl-v1`; każda późniejsza zmiana treści = nowa wersja.
6. Sprawdź w przeglądarce, że link do regulaminu jest widoczny w stopce, na `/pricing` i na `/checkout`.

---

### Faza B — stan produkcji (zanim cokolwiek zmienisz)

**B1. [TEST] Czy kod PS-66 jest już na produkcji?**

- `git log --oneline -n 20 origin/main` — czy zawiera commity PS-66 (checkout/webhook)?
- `supabase functions list` — czy są `checkout`, `billing`, `payments-webhook`?

Jeśli tak: kolejność z fazy E jest pilna; rozważ tymczasowo ukryć CTA (np. zmiana linku CTA na `/pricing` bez przejścia do checkoutu) do czasu ukończenia E.

**B2. [TEST] Migracja bilingowa**

```bash
supabase migration list --linked
```

Migracja `20260930224000_create_billing_subscriptions.sql` powinna być na liście. Jeśli jej nie ma, zostanie zastosowana przez CI w kroku F (`supabase db push --remote --yes`). Po wdrożeniu sprawdź (SQL Editor), że istnieją tabele `billing_customers`, `subscriptions`, `subscription_payments`, `payment_webhook_events` z `rowsecurity = true`.

**B3. [RĘCZNIE] Sekret workera i funkcja pomocnicza (potrzebne do crona z kroku E2)**

1. Edge Function Secrets: `INTERNAL_WORKER_SECRET` musi być ustawiony (CI go nie ustawia). Jeśli już działa worker składników, sekret istnieje.
2. SQL Editor: funkcja `public.get_internal_worker_secret()` musi zwracać **tę samą** wartość (instrukcja: `docs/deployment/worker-production-deployment.md`, `EXECUTE` tylko dla `postgres`).
3. Rozszerzenia `pg_cron` i `pg_net` muszą być włączone (`Database → Extensions`).

**B4. [RĘCZNIE] Wykaz sekretów w GitHub**

Pamiętaj, że CI ustawia tylko wybrane sekrety (`APP_PUBLIC_URL`, `OPENAI_*`, `GEMINI_*`, `AI_*`). **Sekretów Stripe nie dodajemy do workflow** — ustawiasz je raz ręcznie (krok E1) i CI ich nie nadpisze. `APP_PUBLIC_URL` (CI) i `APP_BASE_URL` (płatności) to **dwie różne zmienne**; funkcje płatności czytają `APP_BASE_URL`.

---

### Faza C — testy lokalne (Stripe CLI, tryb testowy)

Cel: zobaczyć cały przepływ bez ryzyka dla produkcji.

**C1. [RĘCZNIE] Środowisko lokalne**

1. Zainstaluj Stripe CLI i zaloguj się (`stripe login`).
2. W trybie testowym Stripe utwórz produkt i **dwie** ceny cykliczne (24 zł/mies., 169 zł/rok, PLN, cena brutto zawiera podatek) — wystarczy jednorazowo, ceny live utworzysz osobno w kroku D3.
3. Utwórz restricted key testowy (`rk_test_…`) — uprawnienia jak w kroku D4.
4. Plik `.env` dla funkcji (plik ignorowany przez git; **nie commituj**):

```env
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...          # wypisze `stripe listen`
STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING=price_...
STRIPE_PRICE_PREMIUM_YEARLY_RECURRING=price_...
APP_BASE_URL=http://localhost:4200
SUBSCRIPTION_TERMS_VERSION=subscription-terms-pl-v1
BILLING_EXPIRY_GRACE_DAYS=3
```

5. Uruchom: `supabase start`, `supabase functions serve --env-file .env`, `npm start`, a w osobnym terminalu `stripe listen --forward-to http://127.0.0.1:54321/functions/v1/payments-webhook`.

**C2. [TEST] Scenariusze (wszystkie na koncie `user`, nie `admin`)**

| Scenariusz | Oczekiwany wynik |
|---|---|
| Gość wchodzi na `/checkout` | Przekierowanie na `/login?next=/checkout`, po zalogowaniu powrót |
| Plan roczny, brak zaznaczonych zgód | Przycisk „Zapłać” nieaktywny |
| Karta `4242 4242 4242 4242` | `/checkout/success` potwierdza Premium w kilka sekund; `app_role = premium`; wiersze w `subscriptions` i `subscription_payments`; pula kredytów AI Premium (20 `draft` / 5 `image`) |
| Karta odrzucona `4000 0000 0000 0002` | Brak zmiany roli, możliwość ponowienia |
| `stripe events resend <id>` (to samo zdarzenie) | Brak duplikatu płatności (`payment_webhook_events`) |
| Webhook z błędnym podpisem | `400` |
| `admin` wchodzi na `/checkout` | Przekierowanie na `/pricing`; API `403` |
| Aktywny `premium` wchodzi na `/checkout` | Przekierowanie na `/pricing`; API `409` |
| `/settings` po zakupie | Historia płatności z linkiem do faktury |
| `current_period_end` w przeszłości (SQL) + `billing_expire_subscriptions()` | Rola wraca do `user`, status `expired`, pula kredytów Free |

**C3. [TEST] Testy automatyczne**

```bash
npx vitest run src/app/pages/pricing src/app/pages/checkout src/app/core
deno test --allow-all --unstable --node-modules-dir=none supabase/functions
```

Oba zestawy muszą przejść przed merge (CI uruchamia je tak samo).

---

### Faza D — konfiguracja Stripe w trybie live

Wykonaj po pozytywnej weryfikacji konta (A1). Wszystko w **trybie live** (przełącznik w Dashboardzie).

**D1. [RĘCZNIE] Faktury i e-maile klienta** (`Settings → Billing → Invoices` oraz `Customer emails`)

1. Dane sprzedawcy na fakturze: nazwa, adres, NIP; prefiks numeracji (np. `PYCH`), stopka z adresem `kontakt@pychaswiatowa.pl`.
2. `Customer emails`: **włącz** „Successful payments” i „Refunds” — na start to jedyne potwierdzenie zakupu dla klienta.
3. Sprawdź, że faktury mają link hosted (`hosted_invoice_url`) — aplikacja pokazuje go w `/settings`.

**D2. [RĘCZNIE] Metody płatności** (`Settings → Payment methods`)

Włącz **Karty**. BLIK zostaw wyłączony (kod i UI i tak obsługują tylko `card` na starcie).

**D3. [RĘCZNIE] Produkt i ceny** (`Product catalog`)

Produkt „PychaŚwiatowa Premium”, dwie ceny **cykliczne**, PLN, `tax behavior = inclusive`:

| Cena | Kwota | Okres |
|---|---|---|
| Miesięczna | 24,00 zł | co 1 miesiąc |
| Roczna | 169,00 zł | co 1 rok |

Zapisz dwa identyfikatory `price_…` (live). Kwoty muszą dokładnie odpowiadać kodowi (2400 i 16900 groszy) — webhook je weryfikuje. Zmiana ceny później = nowy `price_…`, nowy sekret i zmiana `pricing.config.ts`.

**D4. [RĘCZNIE] Klucz API** (`Developers → API keys → Create restricted key`)

Uprawnienia:

- Checkout Sessions: **Write**
- Customers: **Write**
- Subscriptions: **Read**
- Invoices: **Read**
- PaymentIntents: **Read**

Zapisz klucz `rk_live_…`. Nie używaj pełnego `sk_live_…`. Klucz nigdy nie trafia do repozytorium ani do frontendu. (Do Customer Portal po starcie dodasz uprawnienie „Customer portal: Write”.)

**D5. [RĘCZNIE] Webhook** (`Developers → Webhooks → Add endpoint`, tryb live)

- URL: `https://<project-ref>.supabase.co/functions/v1/payments-webhook`
- Zdarzenia (dokładnie te 5): `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `invoice.paid`
- Zapisz **Signing secret** `whsec_…` (osobny od lokalnego i od testowego).

Endpoint można utworzyć przed wdrożeniem funkcji — Stripe pokaże błędy dostarczania, dopóki funkcja nie zostanie wdrożona; nie ma ryzyka, bo płatności jeszcze nie ma.

---

### Faza E — Supabase: sekrety i cron

**E1. [RĘCZNIE] Sekrety Edge Functions** (jednorazowo, produkcja)

```bash
supabase secrets set STRIPE_SECRET_KEY=rk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_YEARLY_RECURRING=price_...
supabase secrets set APP_BASE_URL=https://pychaswiatowa.pl
supabase secrets set SUBSCRIPTION_TERMS_VERSION=subscription-terms-pl-v1
supabase secrets set BILLING_EXPIRY_GRACE_DAYS=3
```

| Zmienna | Rola |
|---|---|
| `STRIPE_SECRET_KEY` | Restricted key; prefiks `rk_live_` na produkcji (webhook porównuje tryb klucza z `livemode` zdarzenia) |
| `STRIPE_WEBHOOK_SECRET` | Podpis webhooka live |
| `STRIPE_PRICE_PREMIUM_*_RECURRING` | Identyfikatory cen; bez nich checkout zwróci błąd konfiguracji |
| `APP_BASE_URL` | Adresy powrotu z Checkoutu (musi być HTTPS) |
| `SUBSCRIPTION_TERMS_VERSION` | Wersja regulaminu zapisywana jako dowód akceptacji |
| `BILLING_EXPIRY_GRACE_DAYS` | Dni łaski po końcu okresu |

Nie ustawiaj teraz: `RESEND_API_KEY`, `EMAIL_FROM`, `STRIPE_PRICE_*_ONETIME` (to po starcie).

**E2. [RĘCZNIE] Zadanie cron wygaszania subskrypcji** (SQL Editor; wykonaj po kroku F, bo wywołuje wdrożoną funkcję)

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'billing-expire-subscriptions';

select cron.schedule(
    'billing-expire-subscriptions',
    '0 3 * * *',
    $$
    select net.http_post(
        url := 'https://<project-ref>.supabase.co/functions/v1/internal/billing/expire-subscriptions',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || public.get_internal_worker_secret()
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
    );
    $$
);
```

Weryfikacja: `select * from cron.job where jobname = 'billing-expire-subscriptions';`, a następnego dnia `cron.job_run_details` (status `succeeded`). W MVP to **jedyny mechanizm wygaszania Premium** — bez niego anulowani i nieopłaceni użytkownicy zachowają Premium bezterminowo.

---

### Faza F — wdrożenie

**F1. [TEST] Przed merge:** testy z kroku C3 przechodzą, `git status` bez przypadkowych plików (zwłaszcza `.env`, klucze).

**F2. [RĘCZNIE] Merge do `main`.** CI (`main-deploy.yml`) wykona: testy frontendu i Deno → `supabase db push` (migracja bilingowa) → wdrożenie funkcji (`checkout`, `billing`, `payments-webhook --no-verify-jwt`, pozostałe) → build i deploy frontendu na Firebase.

**F3. [TEST] Po wdrożeniu:**

- zielony workflow w GitHub Actions,
- `supabase functions list` pokazuje `payments-webhook` (z wyłączonym JWT — w panelu Supabase `Edge Functions → payments-webhook`),
- w Stripe `Webhooks → endpoint → Send test event` zwraca `200`, a w tabeli `payment_webhook_events` pojawia się wpis `processed` lub `ignored`,
- wykonaj krok E2 (cron).

---

### Faza G — smoke test na produkcji (płatność prawdziwą kartą)

**G1. [TEST]** Załóż osobne konto `user` (nie `admin` — admin dostaje `403` na checkout) z własnym adresem e-mail.

**G2. [TEST]** `/pricing` → „Wybierz Premium” (plan **miesięczny**, 24 zł) → zapłać własną kartą. Sprawdź:

- `/checkout/success` potwierdza Premium bez przeładowania,
- w Supabase: `subscriptions` (status `active`, `current_period_end` ≈ +1 miesiąc), `subscription_payments` (kwota 2400, link do faktury), `payment_webhook_events` (status `processed`),
- JWT/menu pokazują rolę `premium` po odświeżeniu sesji,
- limit planu 50 i pula kredytów Premium,
- e-mail ze Stripe (potwierdzenie/faktura) dotarł, a `/settings` pokazuje płatność z linkiem do faktury,
- na wyciągu widnieje `PYCHASWIATOWA` (po zaksięgowaniu).

**G3. [RĘCZNIE] Sprzątanie:** w Stripe Dashboard anuluj subskrypcję testową i zrób zwrot płatności; w `/admin/users` zmień rolę konta testowego na `user` (zwrot i anulowanie **nie** zmieniają roli automatycznie). Następnego dnia sprawdź, że cron zakończył się sukcesem.

Jeśli którykolwiek punkt G2 zawiedzie, zatrzymaj otwarcie sprzedaży i sprawdź: logi funkcji `payments-webhook`, `payment_webhook_events` (status `failed`), czy `STRIPE_SECRET_KEY` jest kluczem live i czy `STRIPE_WEBHOOK_SECRET` pochodzi z endpointu live.

---

### Faza H — otwarcie sprzedaży i pierwsze dni

1. **[RĘCZNIE]** Upewnij się, że punkty A2 i A3 są zamknięte (księgowa, prawnik, dane w regulaminie). Dopiero wtedy zakomunikuj ofertę (landing, social, e-mail).
2. **[RĘCZNIE]** Codziennie przez pierwszy tydzień sprawdzaj (SQL Editor):

```sql
-- zdarzenia webhooka z błędem
select event_id, type, status, error_message, livemode, received_at
from payment_webhook_events
where status = 'failed'
order by received_at desc;

-- świeże płatności i rozkład statusów subskrypcji
select user_id, plan_id, amount_gross, status, paid_at, document_url
from subscription_payments
order by created_at desc
limit 20;

select status, count(*) from subscriptions group by status;
```

3. **[RĘCZNIE]** Skrzynkę `kontakt@pychaswiatowa.pl` traktuj jako kanał obsługi: prośby o anulowanie, zwrot, fakturę.

---

## 4. Obsługa ręczna i ograniczenia MVP

| Sytuacja | Co robisz |
|---|---|
| Użytkownik chce anulować | W Stripe Dashboard: `Subscriptions → Cancel subscription → at end of period`. Premium wygaśnie po `current_period_end` + 3 dni (job dobowy). Odpowiedz użytkownikowi na e-mail |
| Użytkownik chce zwrot (w tym w ramach prawa odstąpienia) | W Stripe: `Refund`. Następnie `/admin/users` → rola `user`. Zwrot nie zmienia roli automatycznie |
| Zapłacił, a rola nie jest `premium` | Sprawdź `payment_webhook_events` (status `failed`); Stripe ponawia webhook do 3 dni (`Resend` w panelu Stripe); awaryjnie ustaw rolę ręcznie w `/admin/users` |
| Odnowienie kartą nie powiodło się | Stripe sam próbuje ponownie (Smart Retries) i wysyła e-mail, jeśli włączony w `Settings → Billing → Subscriptions and emails`; po ostatecznym niepowodzeniu Premium wygasa przez cron |
| Prośba o fakturę na firmę | Wystaw ręcznie w Stripe lub w systemie księgowym (zależnie od ustaleń z A2) |
| Błąd w cenie | Nie edytuj kwoty w Stripe; utwórz nową cenę, zmień sekrety i `pricing.config.ts`, wdróż |

**Znane ograniczenia (świadomie zaakceptowane):** brak automatycznej reakcji na `invoice.payment_failed` i `customer.subscription.deleted` (wygaszanie opiera się wyłącznie na jobie czasowym); brak widoku „Moja subskrypcja” w `/settings` poza historią płatności; Premium nadane ręcznie przez admina nie ma wiersza w `subscriptions`; trial, BLIK i własne e-maile nie działają.

---

## 5. Kroki po uruchomieniu płatności (w kolejności)

Kolejność wynika z ryzyka (obsługa klienta i prawo konsumenckie), potem z przychodu, potem ze wzrostu. Nie zaczynaj kroku n+1 bez potrzeby biznesowej — każdy ma wyzwalacz.

| # | Krok | Historyjka | Po co | Wyzwalacz / kiedy | Zakres |
|---|---|---|---|---|---|
| 1 | **Monitoring i przegląd tygodniowy** | — | Wychwycić nieudane webhooki i błędy odnowień | Od pierwszego dnia | Zapytania SQL z fazy H; opcjonalnie alert e-mail dla `failed` |
| 2 | **Stripe Customer Portal** | PS-67 etap A | Użytkownik sam anuluje, zmienia kartę, pobiera faktury; koniec obsługi ręcznej | Pierwszy klient albo pierwsza prośba o anulowanie — **najpóźniej do 2–4 tygodni** | Endpoint `POST /billing/portal-session`, przycisk „Zarządzaj subskrypcją” i sekcja statusu w `/settings`, konfiguracja portalu w Stripe (anulowanie na koniec okresu, zmiana karty, historia faktur; zmiana planu wyłączona), uprawnienie „Customer portal: Write” dla klucza; aktualizacja FAQ i sekcji 4 regulaminu |
| 3 | **Zdarzenia cyklu życia Stripe** | PS-67 etap B (część) | Premium znika w dniu faktycznego końca; `past_due` | Po kilku pierwszych odnowieniach | Obsługa `customer.subscription.deleted`, `invoice.payment_failed`; dopisanie zdarzeń do webhooka Stripe |
| 4 | **E-maile cyklu życia** | PS-72 | Nieudana płatność, anulowanie, wygasanie; własne potwierdzenie | Gdy będzie ≥ kilkunastu płacących lub skargi na brak komunikacji | Resend (domena DNS), sekrety `RESEND_API_KEY`, `EMAIL_FROM`; wyłączenie e-maili Stripe, żeby uniknąć duplikatów; polityka prywatności o Resend |
| 5 | **Domknięcie paywalla i użycia** | PS-69, PS-70 | Konwersja Free → Premium w momencie wyczerpania limitów | Równolegle z krokiem 2–4 | Komunikaty i dialogi (część już jest); decyzja o limicie przestrzeni na zdjęcia (dziś nieegzekwowany) |
| 6 | **Analityka lejka** | — | Wiedzieć, gdzie tracisz klientów | Po 2–4 tygodniach | Zdarzenia GA: wejście na `/pricing`, `/checkout`, sukces; konwersja Free → Premium |
| 7 | **Panel admina: subskrypcje** | PS-73 | Widok statusów, MRR, ręczne korekty | Gdy będzie > 20 subskrypcji lub rośnie obsługa | Kolumny w `/admin/users`, `/admin/subscriptions` |
| 8 | **Trial 7 dni** | PS-68 | Zwiększenie konwersji | Po 1–2 miesiącach danych o konwersji | Spójnie z krokiem 4 (e-mail o końcu trialu); przywrócenie komunikatu na `/pricing` i w regulaminie |
| 9 | **BLIK** | osobna (z PS-66 deferred-features) | Preferowana metoda w Polsce | Po e-mailach (krok 4) | Ceny `*_ONETIME` w Stripe, sekrety, odblokowanie w `CHECKOUT_ENABLED_PAYMENT_METHODS`, przypomnienia o końcu okresu, fragment w regulaminie |
| 10 | **Wartość Premium** | PS-78, PS-79, PS-80, PS-81, PS-82 | Uzasadnienie ceny i retencja | Przy spadku retencji lub po decyzji produktowej | Porządkowanie AI, sugestie metadanych, przeliczanie porcji, historia szkiców, priorytet jobów |
| 11 | **Pakiety kredytów AI** | PS-86 | Dodatkowy przychód bez subskrypcji | Gdy Free/Premium wyczerpują kredyty | Zakup jednorazowy (`mode=payment`), tabela transakcji kredytów |
| 12 | **Planer, zakupy, rodzina** | PS-83, PS-84, PS-85 | Duże funkcje wartości Premium | Po stabilizacji płatności | Osobne epiki; PS-85 zależy od PS-84 i PS-67 |
| 13 | **Ruch i monetyzacja uzupełniająca** | PS-74, PS-75 | SEO i reklamy | Gdy ruch organiczny jest istotny | Strony kategorii, reklamy dla Free |
| 14 | **Retencja i bezpieczeństwo danych** | PS-87, PS-88, PS-89, PS-90 | Eksport, duplikaty, masowy import, UGC | Na końcu | Eksport Markdown (PDF opcjonalnie), wykrywanie duplikatów, program UGC |

**Decyzje do podjęcia po 30 dniach od startu:** czy cena roczna 169 zł jest właściwa (udział planów rocznych), czy limity Free (7 pozycji planu, 3 kredyty AI) są zbyt hojne lub zbyt restrykcyjne, czy trial i BLIK są potrzebne (na podstawie rezygnacji w lejku).

---

## 6. Lista kontrolna „gotowe do sprzedaży”

- [ ] A1: konto Stripe zweryfikowane, tryb live aktywny, wypłaty skonfigurowane
- [ ] A2: księgowa potwierdziła sposób dokumentowania sprzedaży i VAT
- [ ] A3: regulamin z danymi firmy, prawnik zweryfikował część C, punkt 3.4 uzgodniony z checkoutem, polityka prywatności wspomina Stripe
- [ ] B: migracja bilingowa zastosowana, `INTERNAL_WORKER_SECRET` i `get_internal_worker_secret()` spójne
- [ ] C: scenariusze lokalne przeszły, testy `vitest` i `deno test` zielone
- [ ] D: ceny live 24/169 zł, klucz `rk_live_`, webhook live z 5 zdarzeniami, e-maile Stripe włączone
- [ ] E: sekrety ustawione, cron `billing-expire-subscriptions` aktywny
- [ ] F: CI zielone, `payments-webhook` odpowiada `200` na zdarzenie testowe
- [ ] G: płatność prawdziwą kartą → rola `premium`, faktura widoczna, zwrot wykonany, konto testowe wyczyszczone
- [ ] H: wiesz, jak obsłużyć anulowanie, zwrot i błąd webhooka (tabela z sekcji 4)

---

## 7. Mapa dokumentów

| Temat | Dokument |
|---|---|
| Decyzje, ceny, oferta, uzasadnienie | `analiza-funkcjonalnosci-premium-users.md` |
| Historyjki i zależności | `premium-users-user-stories.md` |
| Techniczne szczegóły checkoutu i webhooka | `docs/results/new-features/user-stories/PS-66/PS-66-checkout-payments-api-plan.md`, `…-ui-plan.md` |
| Rozszerzone kroki wdrożenia Stripe/Supabase (referencja) | `…/PS-66-checkout-payments-deployment-plan.md` |
| Funkcje odłożone z uzasadnieniem | `…/PS-66-checkout-payments-deferred-features.md` |
| Treści prawne i placeholdery | `docs/legel-next-steps.md`, `public/assets/legal/subscription-terms.md` |
| Cron i sekret workera | `docs/deployment/worker-production-deployment.md`, `docs/deployment/secrets-management.md` |
