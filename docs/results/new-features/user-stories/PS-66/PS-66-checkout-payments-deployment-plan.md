# PS-66: Checkout i płatności (subskrypcja Premium) — Plan wdrożenia

> **User Story:** PS-66 — Checkout i płatności (subskrypcja Premium)
> **Data:** wrzesień 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend) + Stripe + Resend

---

## 1. Podsumowanie

PS-66 wymaga konfiguracji dwóch zewnętrznych usług (operator płatności Stripe, wysyłka e-maili Resend), migracji bazy, nowych sekretów Edge Functions, zadania `pg_cron` oraz uzupełnienia treści prawnych. Deploy kodu (frontend i Edge Functions) wykonuje GitHub Actions — poniżej wyłącznie kroki ręczne.

| Obszar | Wymagane działanie |
|---|---|
| Konto i konfiguracja Stripe | Rejestracja, weryfikacja firmy, produkty/ceny, BLIK, faktury, webhook — **ręcznie** |
| Konto Resend | Domena nadawcy (DNS), klucz API — **ręcznie** |
| Baza danych | Migracja `create_billing_subscriptions` — **ręcznie przed deployem funkcji** |
| Secrets Edge Functions | 11 nowych zmiennych — **ręcznie przed deployem funkcji** |
| `supabase/config.toml` | `verify_jwt = false` dla `payments-webhook` (zmiana w kodzie, patrz krok 7) |
| Supabase Cron | Nowe zadanie `billing_expire_subscriptions` — **ręcznie po migracji** |
| Treści prawne | Finalny regulamin subskrypcji — **ręcznie przed startem sprzedaży** |
| Księgowość | Potwierdzenie sposobu dokumentowania sprzedaży — **ręcznie przed startem sprzedaży** |
| Weryfikacja po wdrożeniu | Ręczna lista kontrolna (tryb testowy, potem live) |

**Zalecana kolejność:** Stripe (tryb testowy) → Resend → migracja → secrets → deploy (GitHub Actions) → webhook Stripe → cron → testy na środowisku dev → treści prawne i księgowość → przełączenie na tryb live.

---

## 2. Krok 1 — Konto Stripe

**Typ:** Usługa zewnętrzna
**Kiedy:** Na początku (weryfikacja firmy może trwać kilka dni)

1. Zarejestrować konto na stripe.com; kraj: Polska, waluta rozliczeniowa: PLN.
2. Uzupełnić dane firmy/działalności i konto bankowe do wypłat (weryfikacja KYC/KYB — wymagana dla trybu live).
3. W `Settings → Payment methods` włączyć: **Karty** oraz **BLIK**. BLIK może wymagać osobnej aktywacji — sprawdzić dostępność dla PLN. Jeśli BLIK nie jest dostępny, wstrzymać wdrożenie wariantu BLIK (ukryć opcję w UI).
4. Ustawić nazwę sprzedawcy widoczną na wyciągu (`statement descriptor`, np. `PYCHASWIATOWA`).
5. Do momentu zakończenia testów pracować wyłącznie w **trybie testowym** (osobne klucze i Price ID niż w live).

---

## 3. Krok 2 — Produkty i ceny w Stripe

**Typ:** Konfiguracja Stripe (Product catalog)

Utworzyć produkt „PychaŚwiatowa Premium” z czterema cenami (PLN, `tax behavior = inclusive` — cena brutto zawiera VAT, zgodnie z cennikiem PS-63):

| Wariant | Kwota | Typ ceny | Używana dla |
|---|---|---|---|
| Miesięczna cykliczna | 24,00 zł | Recurring, co 1 miesiąc | Karta |
| Roczna cykliczna | 169,00 zł | Recurring, co 1 rok | Karta |
| Miesięczna jednorazowa | 24,00 zł | One-time | BLIK |
| Roczna jednorazowa | 169,00 zł | One-time | BLIK |

Zanotować cztery identyfikatory `price_...` — są potrzebne w kroku 6. Kwoty muszą być zgodne z `pricing.config.ts` (2400 i 16900 groszy); backend weryfikuje kwotę w webhooku.

> Przed startem sprzedaży zweryfikować ostateczne ceny (`PS-62` — ramy 19–29 zł / miesiąc i 149–199 zł / rok). Zmiana ceny wymaga nowych Price ID (Stripe nie edytuje kwoty istniejącej ceny) oraz aktualizacji `pricing.config.ts`.

---

## 4. Krok 3 — Faktury i e-maile w Stripe

**Typ:** Konfiguracja Stripe (Settings → Billing)

1. `Invoice settings`: dane sprzedawcy (nazwa, adres, NIP), prefiks numeracji (np. `PYCH`), stopka faktury.
2. Upewnić się, że faktury są generowane i dostępne przez `hosted_invoice_url` / PDF (wymagane przez aplikację).
3. `Customer emails`: **wyłączyć** automatyczne e-maile „Successful payments” i „Refunds” dla klienta — potwierdzenie zakupu wysyła aplikacja (Resend), aby uniknąć duplikatów.
4. Włączyć e-maile o nieudanych płatnościach tylko jeśli chcesz, żeby Stripe informował klienta przed wdrożeniem PS-67 (domyślnie: wyłączone — komunikacja będzie po stronie aplikacji).
5. **Konsultacja z księgową:** potwierdzić, że faktura/potwierdzenie ze Stripe jest wystarczające jako dokument sprzedaży B2C (paragon/faktura, zwolnienie z kasy fiskalnej dla sprzedaży online, KSeF). Wynik decyduje o konieczności wcześniejszego wdrożenia integracji z systemem fakturowym (patrz dokument funkcjonalności odłożonych).

---

## 5. Krok 4 — Klucze API Stripe

**Typ:** Konfiguracja Stripe (Developers → API keys)

1. Utworzyć **restricted key** (nie używać pełnego `sk_...`) z uprawnieniami:
    - Checkout Sessions: Write
    - Customers: Write
    - Invoices: Read
    - Subscriptions: Read
    - PaymentIntents: Read
2. Zapisać klucz testowy (`rk_test_...`) — potrzebny w kroku 6. Klucz live wygenerować dopiero przy przełączeniu na produkcję.
3. Klucze nigdy nie trafiają do repozytorium ani do frontendu (aplikacja Angular nie potrzebuje klucza publicznego Stripe — używany jest hosted checkout).

---

## 6. Krok 5 — Konto Resend

**Typ:** Usługa zewnętrzna + DNS

1. Założyć konto na resend.com.
2. Dodać i zweryfikować domenę nadawczą (rekordy DNS: SPF, DKIM, zalecany DMARC) u dostawcy DNS domeny.
3. Wygenerować klucz API (uprawnienie „Sending access”).
4. Ustalić adres nadawcy, np. `PychaŚwiatowa <no-reply@twojadomena.pl>`.

> Do czasu weryfikacji domeny Resend pozwala wysyłać tylko na adres właściciela konta — testowanie e-maila zakupu na innych adresach wymaga zweryfikowanej domeny.

---

## 7. Krok 6 — Secrets Edge Functions

**Typ:** Konfiguracja Supabase (Secrets)
**Kiedy:** Przed deployem funkcji `checkout`, `billing`, `payments-webhook`

Sekret `STRIPE_WEBHOOK_SECRET` powstaje dopiero w kroku 9 (po pierwszym deployu funkcji). Można wdrożyć funkcje z pozostałymi sekretami, a webhook ustawić w następnej kolejności.

```bash
supabase secrets set STRIPE_SECRET_KEY=rk_test_...
supabase secrets set STRIPE_PRICE_PREMIUM_MONTHLY_RECURRING=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_YEARLY_RECURRING=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_MONTHLY_ONETIME=price_...
supabase secrets set STRIPE_PRICE_PREMIUM_YEARLY_ONETIME=price_...
supabase secrets set APP_BASE_URL=https://pychaswiatowa.web.app
supabase secrets set SUBSCRIPTION_TERMS_VERSION=subscription-terms-pl-v1
supabase secrets set BILLING_EXPIRY_GRACE_DAYS=3
supabase secrets set RESEND_API_KEY=re_...
supabase secrets set EMAIL_FROM="PychaŚwiatowa <no-reply@twojadomena.pl>"
# po kroku 9:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

| Zmienna | Opis |
|---|---|
| `STRIPE_SECRET_KEY` | Restricted key (test → live przy uruchomieniu produkcji) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret endpointu webhooka |
| `STRIPE_PRICE_*` (4 zmienne) | Identyfikatory cen z kroku 2 |
| `APP_BASE_URL` | Adres frontendu; na dev/lokalnie inny niż na produkcji |
| `SUBSCRIPTION_TERMS_VERSION` | Wersja regulaminu zapisywana jako dowód akceptacji |
| `BILLING_EXPIRY_GRACE_DAYS` | Dni łaski przed wygaszeniem Premium |
| `RESEND_API_KEY`, `EMAIL_FROM` | Wysyłka e-maili |

Dla środowiska deweloperskiego i produkcyjnego ustawić **osobne** zestawy (dev = tryb testowy Stripe, produkcja = tryb live). Jeśli deploy funkcji odbywa się z sekretami trzymanymi także w GitHub Secrets/Environments, uzupełnić je zgodnie z istniejącą praktyką projektu.

---

## 8. Krok 7 — Konfiguracja `verify_jwt` dla webhooka

Funkcja `payments-webhook` musi przyjmować żądania bez JWT (autoryzacja przez podpis Stripe). Wpis w `supabase/config.toml`:

```toml
[functions.payments-webhook]
verify_jwt = false
```

Zmiana jest częścią kodu (deploy automatyczny). Kroki ręczne: po pierwszym deployu upewnić się w panelu Supabase (`Edge Functions → payments-webhook`), że opcja weryfikacji JWT jest wyłączona — w przeciwnym razie Stripe otrzyma `401`.

---

## 9. Krok 8 — Migracja bazy danych

**Typ:** Supabase Migration (SQL)
**Kiedy:** **Przed** deployem Edge Functions korzystających z nowych tabel

Plik: `supabase/migrations/<timestamp>_create_billing_subscriptions.sql` (zawartość: patrz plan API, sekcje 7–8).

```bash
supabase db push
```

Migracja tworzy:

- tabele `billing_customers`, `subscriptions`, `subscription_payments`, `payment_webhook_events` wraz z RLS,
- funkcje `billing_activate_premium`, `billing_renew_subscription`, `billing_expire_subscriptions` (`EXECUTE` tylko dla `service_role`).

**Weryfikacja po migracji (SQL Editor):**

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('billing_customers','subscriptions','subscription_payments','payment_webhook_events');

select rowsecurity, tablename from pg_tables
where tablename in ('billing_customers','subscriptions','subscription_payments','payment_webhook_events');
```

Oczekiwane: 4 tabele, `rowsecurity = true` dla wszystkich.

**Dane istniejących użytkowników `premium`:** użytkownicy, którym rola `premium` została nadana ręcznie przez admina, **nie mają** wiersza w `subscriptions` (`subscription_status = null`) i pozostają bez zmian. Nie migrować ich do `subscriptions`.

---

## 10. Krok 9 — Webhook w Stripe

**Typ:** Konfiguracja Stripe (Developers → Webhooks)
**Kiedy:** Po pierwszym deployu funkcji `payments-webhook` (URL musi odpowiadać)

1. Dodać endpoint: `https://<project-ref>.supabase.co/functions/v1/payments-webhook`.
2. Zaznaczyć zdarzenia:
    - `checkout.session.completed`
    - `checkout.session.async_payment_succeeded`
    - `checkout.session.async_payment_failed`
    - `checkout.session.expired`
    - `invoice.paid`
3. Skopiować **Signing secret** (`whsec_...`) i ustawić `STRIPE_WEBHOOK_SECRET` (krok 6), następnie ponownie zdeployować lub odświeżyć funkcję, jeśli sekret jest czytany przy starcie.
4. Wysłać testowe zdarzenie z panelu Stripe i sprawdzić w tabeli `payment_webhook_events` wpis ze statusem `processed` lub `ignored`.

**Lokalny development:**

```bash
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/payments-webhook
```

Polecenie wypisuje tymczasowy `whsec_...` do pliku `.env` lokalnych funkcji.

Osobny endpoint webhooka (i osobny signing secret) należy utworzyć dla trybu live.

---

## 11. Krok 10 — Zadanie Supabase Cron

**Typ:** Supabase Cron (`pg_cron`)
**Kiedy:** Po migracji

Wygaszanie subskrypcji po upływie okresu + dni łaski (siatka bezpieczeństwa do czasu PS-67):

```sql
select cron.unschedule(jobid)
from cron.job
where jobname = 'billing-expire-subscriptions';

select cron.schedule(
    'billing-expire-subscriptions',
    '0 3 * * *',
    $$
    select net.http_post(
        url := 'https://TWOJ-PROJECT-REF.supabase.co/functions/v1/internal/billing/expire-subscriptions',
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

Zastąp `TWOJ-PROJECT-REF` identyfikatorem projektu. Funkcja
`public.get_internal_worker_secret()` musi zwracać tę samą wartość, która jest ustawiona
jako sekret Edge Functions `INTERNAL_WORKER_SECRET`, i mieć `EXECUTE` wyłącznie dla
roli `postgres`.

Cron wywołuje Edge Function zamiast RPC bezpośrednio, ponieważ synchronizacja puli
Free korzysta ze zmiennych środowiskowych niedostępnych z poziomu SQL.

Weryfikacja: `select * from cron.job where jobname = 'billing-expire-subscriptions';`,
`cron.job_run_details` oraz logi funkcji `internal`.

---

## 12. Krok 11 — Treści prawne

**Typ:** Praca merytoryczna (nie kod)
**Kiedy:** Przed przełączeniem na tryb live

1. Uzupełnić `docs/legal-documents` → sync do `public/assets/legal` treść **Regulaminu subskrypcji** (`/legal/subscription`, obecnie placeholder). Musi zawierać: cenę i okresy, automatyczne odnowienie kartą, BLIK jako płatność jednorazową bez odnowienia, sposób rezygnacji, zgodę na natychmiastowe świadczenie treści cyfrowych i utratę prawa odstąpienia po 14 dniach, dane sprzedawcy.
2. Zaktualizować politykę prywatności o podprocesorów: Stripe (płatności) i Resend (e-mail).
3. Ustawić `SUBSCRIPTION_TERMS_VERSION` na wersję odpowiadającą opublikowanemu regulaminowi; przy każdej zmianie treści zwiększyć wersję.
4. Zalecana weryfikacja przez prawnika (prawo konsumenckie, treści cyfrowe).

---

## 13. Krok 12 — Weryfikacja po wdrożeniu

Wykonać najpierw na środowisku dev (Stripe test), następnie krótki smoke test na produkcji po przełączeniu na tryb live (płatność własną kartą na najniższy plan i zwrot).

**Backend / płatności:**

- [ ] `POST /checkout/sessions` (rola `user`, karta, plan roczny) zwraca `201` z `checkout_url`
- [ ] `POST /checkout/sessions` bez zaznaczonych zgód zwraca `400`
- [ ] `POST /checkout/sessions` dla `admin` zwraca `403`, dla aktywnego `premium` — `409`
- [ ] Płatność kartą testową `4242 4242 4242 4242` → webhook: `app_role = premium` w `raw_app_meta_data`, wiersz w `subscriptions` (data startu, `current_period_end`) i `subscription_payments` (ID transakcji)
- [ ] Płatność BLIK (kod testowy Stripe) → `auto_renew = false`, `current_period_end` = start + wybrany okres
- [ ] Karta odrzucona `4000 0000 0000 0002` → brak zmiany roli, komunikat po stronie Stripe, możliwość ponowienia
- [ ] Ponowne wysłanie tego samego zdarzenia (`stripe events resend`) nie tworzy duplikatu płatności
- [ ] Webhook z niepoprawnym podpisem zwraca `400`
- [ ] Pula kredytów AI po zakupie: Premium (20 draft / 5 image), `limit_type = monthly`
- [ ] E-mail „Potwierdzenie zakupu” dotarł, zawiera plan, kwotę, datę i link do faktury
- [ ] `GET /billing/payments` zwraca płatność z `document_url`, tylko dla właściciela
- [ ] `GET /me` zwraca `subscription_status = 'active'` i `current_period_end`

**Frontend:**

- [ ] Gość wchodzący na `/checkout` trafia na `/login?next=/checkout`, po zalogowaniu wraca na `/checkout`
- [ ] `/checkout` domyślnie ma wybrany plan roczny, przełączenie na miesięczny zmienia cenę
- [ ] Przycisk „Zapłać” nieaktywny bez obu zgód
- [ ] `/checkout/success` po płatności potwierdza Premium w kilka sekund, menu odświeża się bez przeładowania
- [ ] `/checkout/cancel` po porzuceniu płatności pozwala ponowić próbę
- [ ] Użytkownik `premium`/`admin` wchodzący na `/checkout` jest przekierowany na `/pricing`
- [ ] `/settings` pokazuje historię płatności z linkiem do faktury
- [ ] `/pricing` przekazuje wybrany okres do `/checkout?plan=...`

**Wygaszanie:**

- [ ] Ręczne ustawienie `current_period_end` w przeszłość (dev) i uruchomienie `billing_expire_subscriptions()` → rola `user`, pula kredytów Free, `status = expired`

---

## 14. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| PS-63 (strona `/pricing`, stub `/checkout`, `pricing.config.ts`) | ✅ Zrealizowana | Ceny i okresy jako źródło konfiguracji |
| PS-64 (kredyty AI, `user_ai_credits`, logika synchronizacji ról) | ✅ Zrealizowana | Wydzielenie `syncAiCreditsForRoleChange` do `_shared` |
| Edge Function `me` | ✅ Istniejąca | Rozszerzenie odpowiedzi |
| Edge Function `admin` | ✅ Istniejąca | Zmiana importu logiki synchronizacji kredytów |
| Konto Stripe (tryb test / live) | ❌ Do utworzenia | Kroki 1–4, 9 |
| Konto Resend + domena | ❌ Do utworzenia | Krok 5 (sekcja 6) |
| Secrets (`STRIPE_*`, `RESEND_*` itd.) | ❌ Do ustawienia | Krok 6 |
| Migracja `create_billing_subscriptions` | ❌ Do zastosowania | Krok 8 |
| Finalny regulamin subskrypcji | ❌ Do przygotowania | Krok 11 |

---

## 15. Ryzyka wdrożeniowe

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|---|---|---|
| BLIK niedostępny lub wymaga dodatkowej weryfikacji na koncie Stripe | Średnie | Sprawdzić w kroku 1; awaryjnie wdrożyć tylko kartę (ukrycie opcji BLIK w UI) |
| Webhook nie dociera (zły URL/sekret, włączone `verify_jwt`) | Średnie | Krok 9, wysłanie zdarzenia testowego, monitoring `payment_webhook_events` |
| Użytkownik zapłacił, ale rola nie została ustawiona (błąd RPC) | Niskie | Stripe ponawia webhook do 3 dni; monitorować zdarzenia o statusie `failed`; ręczna zmiana roli w panelu admina jako awaryjna |
| Niezgodność ceny w Stripe i `pricing.config.ts` | Niskie | Weryfikacja kwoty w webhooku; testowa płatność przed startem |
| Deploy funkcji przed migracją | Wysokie (blokujące) | Obowiązkowa kolejność: migracja → secrets → deploy → webhook → cron |
| Brak finalnego regulaminu w dniu startu | Średnie | Nie przełączać na tryb live przed krokiem 11 |
| Klucz live w środowisku dev (lub odwrotnie) | Niskie | Osobne zestawy sekretów, prefiksy `rk_test_` / `rk_live_` sprawdzane w checklistach |
| Premium wygasa u płacącego klienta (brak `invoice.paid`) | Niskie | Endpoint webhooka nasłuchuje `invoice.paid`; dni łaski w jobie wygaszania; weryfikacja odnowienia w Stripe test clock |

---

## 16. Czego NIE robi PS-66

Szczegółowy opis funkcji odłożonych: `PS-66-checkout-payments-deferred-features.md`.
