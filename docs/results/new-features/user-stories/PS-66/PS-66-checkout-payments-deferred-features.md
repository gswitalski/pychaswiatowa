# PS-66: Checkout i płatności (subskrypcja Premium) — Funkcjonalności odłożone na później

> **User Story:** PS-66 — Checkout i płatności (subskrypcja Premium)
> **Data:** wrzesień 2026
> **Cel dokumentu:** Zebranie funkcji, które są związane z płatnościami, ale **świadomie nie wchodzą** do zakresu PS-66. Dla każdej wskazano powód odłożenia, wpływ na użytkownika, elementy przygotowane w PS-66 oraz proponowany zakres i właściciela (historyjkę).

---

## 1. Podsumowanie

| # | Funkcjonalność | Docelowa historyjka | Priorytet | Ryzyko braku przed startem sprzedaży |
|---|---|---|---|---|
| 1 | Anulowanie subskrypcji i zarządzanie nią (portal klienta, zmiana planu, metody płatności) | PS-67 | Wysoki | Wysokie (prawo konsumenckie, obsługa klientów ręcznie) |
| 2 | Obsługa nieudanych odnowień, grace period, degradacja roli | PS-67 | Wysoki | Średnie (siatka bezpieczeństwa w PS-66 częściowo je łagodzi) |
| 3 | Start trialu 7-dniowego z odrębną pulą AI | PS-68 | Średni | Niskie (funkcja marketingowa) |
| 4 | E-maile cyklu życia (przypomnienia, winback, nieudana płatność, faktury) | PS-71 | Średni | Średnie (BLIK bez przypomnienia o końcu okresu) |
| 5 | Ponowna wysyłka nieudanych e-maili potwierdzających | Backlog | Niski | Niskie |
| 6 | Faktury VAT na żądanie (NIP), integracja z systemem fakturowym, KSeF | Osobna historyjka | Średni | Zależne od decyzji księgowej |
| 7 | Zwroty, spory (chargebacks) i korekty | PS-67 / osobna | Średni | Średnie |
| 8 | Automatyczne odnowienie dla BLIK (płatności cykliczne) | Backlog | Niski | Niskie |
| 9 | Dodatkowe metody płatności (Apple Pay/Google Pay, przelew, Przelewy24) | Backlog | Niski | Niskie |
| 10 | Kody promocyjne i zniżki | Backlog | Niski | Niskie |
| 11 | Pakiety kredytów AI (add-on) | Osobna historyjka | Średni | Niskie |
| 12 | Zmiana planu (miesięczny ↔ roczny) i proration | PS-67 | Średni | Niskie |
| 13 | Panel admina: subskrypcje i metryki przychodów | Osobna historyjka | Średni | Niskie |
| 14 | Dane firmowe klienta (B2B) przy zakupie | Osobna historyjka | Niski | Zależne od grupy docelowej |
| 15 | Ceny dynamiczne z API zamiast konfiguracji frontendu | Backlog | Niski | Niskie |
| 16 | Monitoring i alerty płatności | Backlog | Średni | Średnie |
| 17 | Konto rodzinne i wiele stanowisk w subskrypcji | Wg. planu Premium | Niski | Brak |

---

## 2. Szczegóły

### 2.1. Anulowanie subskrypcji i zarządzanie nią

- **Opis:** Sekcja „Subskrypcja” w `/settings` z akcją „Anuluj subskrypcję” (dostęp do końca opłaconego okresu), podgląd statusu, zmiana metody płatności, podgląd i pobranie faktur. Realizacja przez własne endpointy (`POST /billing/subscription/cancel`) lub Stripe Customer Portal (sesja portalu tworzona po stronie backendu).
- **Dlaczego poza PS-66:** PS-67 jest osobną historyjką zależną od PS-66; PS-66 wystarcza do „pierwszej złotówki”.
- **Przygotowane w PS-66:** tabela `subscriptions` z kolumnami `status`, `canceled_at`, `auto_renew`, `provider_subscription_id`; `GET /me` zwraca status subskrypcji; historia płatności w `/settings`.
- **Ryzyko do czasu wdrożenia:** użytkownik nie może samodzielnie zrezygnować z automatycznego odnowienia kartą — konieczna ręczna obsługa (Stripe Dashboard + kontakt e-mail). Przed startem sprzedaży zalecane, by PS-67 wyszło razem z PS-66 lub tuż po nim. Regulamin subskrypcji musi opisywać tymczasowy sposób rezygnacji.

### 2.2. Nieudane odnowienia, grace period i degradacja roli

- **Opis:** Obsługa zdarzeń `invoice.payment_failed`, `customer.subscription.updated/deleted`; status `past_due`, 3-dniowy okres łaski, e-mail z prośbą o aktualizację metody płatności, po wygaśnięciu łaski rola `user` i e-mail winback.
- **Przygotowane w PS-66:** status `past_due` w constraintcie `subscriptions.status`; zdarzenie `invoice.paid` (odnowienie) obsłużone minimalnie; dobowy job `billing_expire_subscriptions` z dniami łaski (`BILLING_EXPIRY_GRACE_DAYS`) jako siatka bezpieczeństwa.
- **Zakres PS-67:** przejście na obsługę zdarzeń Stripe zamiast wyłącznie czasowej; zdarzenie `customer.subscription.deleted` ustawia status i rolę w momencie zakończenia okresu.
- **Ryzyko do czasu wdrożenia:** użytkownik z nieudaną płatnością zachowuje Premium do końca okresu + dni łaski, potem traci je bez informacji e-mail.

### 2.3. Trial 7-dniowy (PS-68)

- **Opis:** Jednorazowy trial z odrębną, mniejszą pulą kredytów AI, wymagający podania metody płatności, automatyczna konwersja lub powrót do `user`.
- **Przygotowane w PS-66:** kolumna `trial_ends_at`, status `trialing`, `GET /me` zwraca pola trialu, `checkoutAccessGuard` i API dopuszczają zakup przy `trialing`, przełączenie na `active` bez utraty zużycia kredytów, baner na `/checkout`.
- **Do rozstrzygnięcia w PS-68:** FAQ na `/pricing` obiecuje trial bez karty, a historyjka PS-68 wymaga metody płatności — ujednolicić komunikację; ochrona przed wielokrotnym trialem (jednorazowo na konto, ewentualnie na kartę/e-mail).
- **Weryfikacja:** ścieżka „zakup w trakcie trialu” w PS-66 jest pokryta wyłącznie testami jednostkowymi (fixtury) do czasu wdrożenia PS-68 — po jego wdrożeniu dodać test E2E.

### 2.4. E-maile cyklu życia

- **Opis:** Przypomnienie 3–7 dni przed końcem okresu dla BLIK (brak auto-odnowienia), 24 h przed końcem trialu, nieudana płatność, anulowanie, udane odnowienie, winback po wygaśnięciu, wyczerpanie puli AI.
- **Przygotowane w PS-66:** moduł `_shared/email/` (klient Resend, wzorzec szablonu), konfiguracja domeny nadawcy, e-mail „Potwierdzenie zakupu”.
- **Wpływ na UX:** w PS-66 opis BLIK w UI mówi wyłącznie, że płatność nie odnawia się automatycznie — bez obietnicy przypomnienia. Po wdrożeniu przypomnień uzupełnić tekst na `/checkout` i w regulaminie.
- **Uwaga techniczna:** wymaga joba (cron) wybierającego subskrypcje kończące się w oknie czasowym oraz znacznika „wysłano” per okres, by nie dublować wiadomości.

### 2.5. Ponowna wysyłka nieudanych e-maili potwierdzających

- **Opis:** Job ponawiający wysyłkę dla `subscription_payments` z `confirmation_email_sent_at IS NULL` (np. chwilowa awaria Resend).
- **W PS-66:** błąd wysyłki jest logowany, płatność i rola są poprawne; użytkownik ma dostęp do faktury w `/settings`.
- **Propozycja:** cron co 15 min, maks. 5 prób z backoffem — analogicznie do workera normalizacji składników.

### 2.6. Faktury VAT na żądanie, system fakturowy, KSeF

- **Opis:** Możliwość podania danych firmowych (NIP, adres) i wystawienia faktury VAT; integracja z Fakturownią/inFakt lub podobnym systemem; obsługa KSeF, jeśli sprzedaż obejmie klientów B2B.
- **W PS-66:** dokument sprzedaży generowany przez Stripe (hosted invoice / PDF) i udostępniony w `/settings` oraz w e-mailu.
- **Decyzja zależna od księgowej:** czy dokument Stripe wystarcza dla sprzedaży B2C oraz czy potrzebny jest osobny paragon/faktura z numeracją własną. Wynik konsultacji (patrz plan wdrożenia, krok 3) może przesunąć tę funkcję do wersji startowej.

### 2.7. Zwroty, spory i korekty

- **Opis:** Obsługa `charge.refunded`, `charge.dispute.created`; ustawienie statusu płatności (`refunded`, `disputed`), decyzja o cofnięciu roli, faktura korygująca, powiadomienie admina.
- **W PS-66:** zwroty wykonywane ręcznie w Stripe Dashboard; rola zmieniana ręcznie w panelu admina (`/admin/users`). Brak automatycznej synchronizacji.
- **Uwaga:** polityka zwrotów wynika z regulaminu (utrata prawa odstąpienia po zgodzie na natychmiastowe świadczenie) — wyjątki obsługiwane ręcznie.

### 2.8. Automatyczne odnowienie dla BLIK

- **Opis:** Jeśli operator zapewni BLIK w płatnościach cyklicznych (mandat), wariant BLIK mógłby używać `mode=subscription` i odnawiać się jak karta.
- **W PS-66:** BLIK = płatność jednorazowa za okres (`auto_renew = false`). Kontrakt API nie wymaga zmian — wystarczy zmiana mapowania Price ID i ustawienia `auto_renew`.
- **Do sprawdzenia przed wdrożeniem:** aktualne możliwości BLIK recurring w Stripe/PayU dla PLN oraz ograniczenia (limity kwot, zgoda w aplikacji bankowej).

### 2.9. Dodatkowe metody płatności

- Apple Pay / Google Pay (przez `card` w Stripe — do włączenia w panelu), przelewy online (Przelewy24), płatności w ratach. Wymagają zmian w `PaymentMethodSelectorComponent` i mapowaniu `payment_method`.

### 2.10. Kody promocyjne i zniżki

- Kody rabatowe (Stripe Coupons / Promotion Codes), rabaty pierwszego okresu, kampanie sezonowe, program poleceń. Wymaga pola „Mam kod” w podsumowaniu, walidacji po stronie backendu i raportowania w panelu admina. `allow_promotion_codes` można włączyć w sesji Stripe, ale UX i regulamin wymagają osobnego przygotowania.

### 2.11. Pakiety kredytów AI (add-on)

- Jednorazowy zakup dodatkowych kredytów `draft` / `image` także dla Free (impuls bez subskrypcji). Wymaga nowego produktu w Stripe, tabeli transakcji kredytów (kredyty nieprzenoszalne lub z terminem ważności) i rozszerzenia `user_ai_credits` o pulę dodatkową. Ma wykorzystać infrastrukturę checkoutu z PS-66 (`mode=payment`, webhook) — dlatego webhook powinien być projektowany rozszerzalnie po `metadata.purchase_type` (w PS-66 domyślnie `subscription`).

### 2.12. Zmiana planu i proration

- Przejście miesięczny ↔ roczny w trakcie okresu, proporcjonalne rozliczenie, upgrade z BLIK na kartę (przejście z płatności jednorazowej na subskrypcję). W PS-66 użytkownik z aktywnym Premium jest blokowany na `/checkout` (`409`), więc zmiany wymagają PS-67.

### 2.13. Panel admina: subskrypcje i metryki

- Kolumny w `/admin/users` (status subskrypcji, data następnej płatności), nowa podstrona `/admin/subscriptions` (liczba aktywnych, triali, churn 30 dni, MRR/ARR), podgląd zdarzeń webhooka i płatności o statusie `failed`. W PS-66 diagnostyka opiera się na tabelach `payment_webhook_events` i `subscription_payments` (SQL Editor) oraz na Stripe Dashboard.

### 2.14. Dane firmowe klienta (B2B)

- Pole „Kupuję jako firma” w checkoucie, walidacja NIP, przekazanie danych do sesji Stripe (`tax_id_collection`) i na fakturę. Powiązane z 2.6.

### 2.15. Ceny dynamiczne z API

- Endpoint `GET /pricing/plans` zamiast stałej konfiguracji `pricing.config.ts` (ryzyko zapisane w summary projektu: ceny na sztywno we froncie). W PS-66 ceny nadal pochodzą z konfiguracji frontendu, a poprawność weryfikuje backend w webhooku (kwota vs Price ID). Zmiana cen wymaga synchronicznej aktualizacji: Stripe → sekrety → `pricing.config.ts`.

### 2.16. Monitoring i alerty płatności

- Alert (e-mail/Slack) dla webhooków o statusie `failed`, płatności bez aktywacji (Stripe `paid`, brak rekordu w `subscriptions`), skoków błędów `POST /checkout/sessions`. Dashboard konwersji: wejścia na `/checkout` → utworzone sesje → udane płatności (Google Analytics: zdarzenia `begin_checkout`, `purchase`). W PS-66 zdarzenia analityczne nie są wysyłane.

### 2.17. Konto rodzinne

- Współdzielona subskrypcja z wieloma członkami (zaproszenia, limity miejsc, wspólne kolekcje). Wymaga zmiany modelu 1:1 `subscriptions` ↔ `user_id` na relację właściciel–członkowie. Poza zakresem monetyzacji MVP (etap późniejszy planu Premium).

---

## 3. Elementy przygotowane w PS-66 pod funkcje odłożone

| Element w PS-66 | Wykorzystanie później |
|---|---|
| `subscriptions.status` (`past_due`, `canceled`, `expired`, `trialing`) | PS-67, PS-68 |
| `subscriptions.provider_subscription_id`, `billing_customers` | Portal klienta, anulowanie, zmiana planu |
| `subscription_payments.status`, dokumenty | Zwroty, faktury, historia |
| `payment_webhook_events` (idempotencja, status, błąd) | Monitoring, ponowne przetwarzanie, nowe typy zdarzeń |
| `_shared/email/` | E-maile cyklu życia (PS-71), ponawianie |
| `_shared/ai-credits-sync.ts` | Add-ony kredytów, trial z odrębną pulą, degradacja roli |
| `checkoutAccessGuard` + obsługa `trialing` | PS-68 |
| Metadane `terms_version`, `terms_accepted_at` | Zmiany regulaminu, dowody akceptacji |
| Job `billing_expire_subscriptions` | Zastąpiony/uzupełniony zdarzeniami w PS-67 (zostaje jako siatka bezpieczeństwa) |

---

## 4. Proponowana kolejność realizacji

1. **PS-67** — anulowanie, zarządzanie, nieudane płatności (przed lub razem z otwarciem sprzedaży).
2. Decyzja księgowa o dokumentach sprzedaży (2.6) — może podnieść priorytet faktur VAT.
3. **E-maile cyklu życia** (2.4) — przede wszystkim przypomnienie o końcu okresu BLIK.
4. **PS-68** — trial (po uporządkowaniu komunikatu z FAQ).
5. Monitoring płatności i panel admina (2.13, 2.16).
6. Rozszerzenia sprzedażowe: kody promocyjne, add-on kredytów AI, dodatkowe metody płatności, konto rodzinne.
