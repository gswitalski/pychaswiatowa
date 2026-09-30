# PS-66: Checkout i płatności (subskrypcja Premium) — Plan UI

> **User Story:** PS-66 — Checkout i płatności (subskrypcja Premium)
> **Data:** wrzesień 2026
> **Stack:** Angular 21, Angular Material, Sass
> **Zależności:** PS-63 (`/pricing`, stub `/checkout`), PS-64 (kredyty AI), plan API: `PS-66-checkout-payments-api-plan.md`

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `CheckoutPageComponent` | Przebudowa (stub → formularz zakupu) | `src/app/pages/checkout/checkout-page.ts` |
| `CheckoutSuccessPageComponent` | Nowy widok `/checkout/success` | `src/app/pages/checkout/checkout-success/` |
| `CheckoutCancelPageComponent` | Nowy widok `/checkout/cancel` | `src/app/pages/checkout/checkout-cancel/` |
| `PlanSelectorComponent`, `PaymentMethodSelectorComponent`, `OrderSummaryComponent`, `CheckoutConsentsComponent` | Nowe komponenty | `src/app/pages/checkout/components/` |
| `CheckoutService` | Nowy serwis (`POST /checkout/sessions`) | `src/app/pages/checkout/services/checkout.service.ts` |
| `checkoutAccessGuard` | Nowy guard | `src/app/core/guards/` |
| `BillingService`, `PaymentHistoryComponent` | Nowe: historia płatności | `src/app/core/services/`, `src/app/pages/settings/components/payment-history/` |
| Model sesji (`GET /me`) | Modyfikacja — pola subskrypcji | `src/app/core/models/`, serwis sesji |
| Przekierowanie po logowaniu (`?next=`) | Nowa obsługa | logowanie, rejestracja, callback OAuth |
| `/pricing` | Modyfikacja — parametr planu, CTA, FAQ | `src/app/pages/pricing/` |
| Trasy | Modyfikacja | `src/app/app.routes.ts` |

---

## 2. Trasy i dostęp

| Trasa | Dostęp | Uwagi |
|---|---|---|
| `/checkout` | `checkoutAccessGuard` | Formularz zakupu. Parametry opcjonalne: `?plan=premium_monthly\|premium_yearly` |
| `/checkout/success` | zalogowany | Wymaga `?session_id=`; brak → redirect `/checkout` |
| `/checkout/cancel` | zalogowany | Wynik anulowania/porażki płatności |

### `checkoutAccessGuard`

| Stan użytkownika | Zachowanie |
|---|---|
| Gość | Redirect do `/login?next=/checkout` (na stronie logowania widoczny link „Nie masz konta? Zarejestruj się” z zachowanym `next`) |
| `user` | Dostęp |
| `premium` z `subscription_status = 'trialing'` | Dostęp (scenariusz zakupu w trakcie trialu) |
| `premium` (aktywne lub nadane ręcznie) | Redirect do `/pricing` + snackbar „Masz już aktywne konto Premium.” |
| `admin` | Redirect do `/pricing` (bez CTA zakupu, zgodnie z PS-63) |

> Obecnie trasa `/checkout` jest zdefiniowana w układzie publicznym i zalogowanym. Po zmianie ma istnieć **jedna** definicja chroniona guardem, żeby gość nie widział formularza. Dodać `providers` z lazy `loadComponent` dla tras `success` i `cancel`.

### Obsługa `?next=`

`/pricing` już generuje `/register?next=/checkout` (i analogicznie dla logowania), ale parametr nie jest dziś nigdzie konsumowany. Zakres PS-66:

- `next` walidowany allowlistą (`['/checkout']`) i wyłącznie ścieżką względną (ochrona przed open redirect),
- logowanie e-mail / Google (callback OAuth): po sukcesie nawigacja do `next` zamiast `/dashboard`,
- rejestracja: `next` zapisywany w `sessionStorage` (klucz `pych.postAuthRedirect`), bo między rejestracją a pierwszym logowaniem jest potwierdzenie e-mail; odczyt po pierwszym zalogowaniu,
- brak `next` → dotychczasowe zachowanie (`/dashboard`).

---

## 3. Widok `/checkout` — formularz zakupu

### Układ (desktop ≥960px)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Kup Premium                                                              │
│                                                                           │
│  ┌──────────────────────────────────────┐  ┌───────────────────────────┐  │
│  │ 1. Wybierz plan                       │  │ Podsumowanie              │  │
│  │  (●) Roczny   169 zł / rok  [-17%]    │  │ ───────────────────────   │  │
│  │      ok. 14,08 zł / mies.             │  │ Premium (roczny)          │  │
│  │  ( ) Miesięczny  24 zł / mies.        │  │ 169,00 zł                 │  │
│  │                                       │  │ Cena zawiera VAT          │  │
│  │ 2. Metoda płatności                   │  │                           │  │
│  │  (●) Karta płatnicza                  │  │ Następna płatność:        │  │
│  │      Odnawia się automatycznie        │  │ 29.09.2027                │  │
│  │  ( ) BLIK                             │  │                           │  │
│  │      Płatność jednorazowa za okres,   │  │ [ Zapłać 169,00 zł ]      │  │
│  │      bez automatycznego odnowienia    │  │ 🔒 Bezpieczna płatność    │  │
│  │                                       │  │    przez Stripe           │  │
│  │ 3. Zgody                              │  └───────────────────────────┘  │
│  │  [ ] Akceptuję Regulamin subskrypcji  │                                 │
│  │  [ ] Chcę korzystać z Premium od      │                                 │
│  │      razu i wiem, że tracę prawo do   │                                 │
│  │      odstąpienia od umowy w 14 dni    │                                 │
│  └──────────────────────────────────────┘                                 │
└───────────────────────────────────────────────────────────────────────────┘
```

### Komponenty

| Komponent | Odpowiedzialność |
|---|---|
| `PlanSelectorComponent` | Radio-karty (`mat-radio-group` w stylu kart). **Domyślnie roczny** (lub wartość z `?plan=`). Chip „Oszczędzasz ~17%” na rocznym. Ceny z `PRICING_CONFIG` (jedno źródło z `/pricing`) |
| `PaymentMethodSelectorComponent` | Wybór `card` / `blik` (domyślnie `card`). Opis różnic (auto-odnowienie vs jednorazowa). Ikony metod |
| `CheckoutConsentsComponent` | Dwa wymagane checkboxy; link „Regulamin subskrypcji” otwiera `/legal/subscription` w nowej karcie |
| `OrderSummaryComponent` | Plan, cena brutto, informacja „Cena zawiera VAT”, data następnej płatności (karta) lub „Premium aktywne do” (BLIK), przycisk płatności. Na mobile: sticky u dołu ekranu |
| `CheckoutPageComponent` | Stan formularza (signals), walidacja, wywołanie `CheckoutService`, obsługa błędów |

### Zachowanie

1. Przycisk „Zapłać X zł” jest nieaktywny, dopóki oba checkboxy nie są zaznaczone.
2. Kliknięcie → `POST /checkout/sessions` (`plan_id`, `payment_method`, obie zgody) → przycisk w stanie ładowania (spinner, blokada wielokrotnego kliknięcia) → `window.location.assign(checkout_url)`.
3. Cena w przycisku i podsumowaniu aktualizuje się przy zmianie planu.
4. Zmiana planu/metody po wywołaniu API nie ma wpływu (użytkownik opuszcza stronę).

### Baner trialu

Wyświetlany, gdy `subscription_status === 'trialing'`:

> „Masz aktywny okres próbny. Zakup Premium zakończy trial i od razu rozpocznie płatny okres. Twoje wykorzystane kredyty AI zostają zachowane.”

Baner informacyjny (`mat-card` z ikoną `info`), nad formularzem. Ścieżka jest gotowa na PS-68; do jego wdrożenia nie da się jej przetestować end-to-end (stan symulowany w testach jednostkowych).

### Stany i błędy

| Stan | Zachowanie |
|---|---|
| Ładowanie sesji (`GET /me`) | Skeleton formularza |
| Tworzenie sesji | Przycisk w stanie ładowania, reszta formularza `disabled` |
| `400 VALIDATION_ERROR` | Komunikat pod formularzem „Sprawdź wybrane opcje i zgody”; podświetlenie brakujących checkboxów |
| `409 SUBSCRIPTION_ALREADY_ACTIVE` | Snackbar + redirect do `/pricing` |
| `429 RATE_LIMITED` | Komunikat „Zbyt wiele prób. Spróbuj ponownie za minutę.” + przycisk „Spróbuj ponownie” po 60 s |
| `502 / 5xx / błąd sieci` | Baner błędu „Nie udało się rozpocząć płatności. Nic nie zostało pobrane. Spróbuj ponownie.” + przycisk „Spróbuj ponownie” |
| Powrót przyciskiem „Wstecz” z Stripe | Formularz w stanie początkowym (bez zablokowanych elementów — `pageshow` resetuje stan ładowania) |

---

## 4. Widok `/checkout/success`

Strona powrotu po płatności. **Nie aktywuje Premium** — jedynie prezentuje stan potwierdzony przez webhook.

### Logika

```
wejście z ?session_id=...
→ stan „Potwierdzamy płatność…” (spinner)
→ polling GET /me co 2 s, maks. 15 prób (~30 s)
→ warunek sukcesu: app_role === 'premium' && subscription_status === 'active'
→ supabase.auth.refreshSession() → ponowny GET /me (odświeżony JWT z rolą premium)
→ stan sukcesu
→ brak potwierdzenia po limicie prób → stan „w trakcie przetwarzania”
```

> Warunek sprawdza `subscription_status === 'active'` (a nie samą rolę), bo użytkownik po trialu ma rolę `premium` jeszcze przed zakupem.

### Stany

**Sukces**

```
   ✔  Witaj w Premium!
   Twoja płatność została potwierdzona. Wysłaliśmy potwierdzenie na Twój e-mail.

   Plan: Premium (roczny)          Następna płatność: 29.09.2027
   [ Pobierz fakturę ]  (gdy dokument dostępny)

   [ Przejdź do aplikacji ]   [ Utwórz przepis z AI ]
```

- „Przejdź do aplikacji” → `/dashboard`; „Utwórz przepis z AI” → `/recipes/new/start`.
- Dla BLIK zamiast „Następna płatność”: „Premium aktywne do: {data}. Konto nie odnawia się automatycznie.”
- Link do faktury pobierany z `GET /billing/payments` (pierwszy wpis); jeśli dokument jeszcze niedostępny, przycisk ukryty (dokument jest w historii płatności w `/settings`).
- Po odświeżeniu sesji stan menu (topbar/sidebar) aktualizuje się bez przeładowania (rola Premium widoczna od razu).

**W trakcie przetwarzania (timeout)**

> „Płatność jest przetwarzana. Zwykle trwa to kilka sekund, ale może potrwać dłużej. Gdy zostanie potwierdzona, konto zmieni się na Premium, a potwierdzenie dostaniesz e-mailem.”
> Przyciski: „Sprawdź ponownie” (uruchamia polling od nowa), „Przejdź do aplikacji”.

**Brak `session_id`** — redirect do `/checkout`.

---

## 5. Widok `/checkout/cancel`

Obsługuje anulowanie i porzucenie płatności (Stripe `cancel_url`). Błędy inline (odrzucona karta, nieudany BLIK) użytkownik widzi bezpośrednio na stronie operatora i może tam ponowić próbę.

```
   ⚠  Płatność nie została zakończona
   Nic nie zostało pobrane z Twojego konta. Możesz spróbować ponownie
   lub wybrać inną metodę płatności (karta / BLIK).

   [ Spróbuj ponownie ]   [ Wróć do cennika ]
```

- „Spróbuj ponownie” → `/checkout` (z zachowaniem `plan` i `payment_method` w query params, jeśli dostępne z `sessionStorage`).
- Przed przekierowaniem do Stripe `CheckoutService` zapisuje wybrany plan/metodę w `sessionStorage` (`pych.checkoutDraft`), co pozwala odtworzyć wybór po powrocie.
- Widok zawiera link kontaktowy „Masz problem z płatnością? Napisz do nas” (adres pomocy — do ustalenia przy wdrożeniu).

---

## 6. Ustawienia (`/settings`) — historia płatności

Minimalny fragment obowiązkowy dla wymogu „faktura dostępna dla użytkownika”. Rozbudowa sekcji Subskrypcja (anulowanie, zmiana planu) — PS-67.

**`PaymentHistoryComponent`** — karta „Płatności” w `/settings`, widoczna gdy użytkownik ma co najmniej jedną płatność lub `subscription_status !== null`.

| Element | Opis |
|---|---|
| Status | Chip: „Premium — aktywne” + plan + „Następna płatność: {data}” / „Aktywne do: {data}” |
| Tabela | Data, plan, kwota brutto (format PLN), metoda (karta/BLIK), status, akcja „Faktura” (link do `document_url`, nowa karta) |
| Stan pusty | „Brak płatności.” |
| Błąd | Komunikat + „Spróbuj ponownie” |
| Mobile (<960px) | Lista kart zamiast tabeli |

Dla roli `admin` sekcja jest ukryta.

---

## 7. Modyfikacje istniejących widoków

### `/pricing`

| Zmiana | Opis |
|---|---|
| Parametr planu | CTA „Wybierz Premium” przekazuje bieżący wybór przełącznika: `/checkout?plan=premium_monthly` lub `premium_yearly` (dla gościa: `next` z tym samym parametrem) |
| CTA dla `premium` w trialu | „Kup Premium” → `/checkout` (zamiast „Twój aktualny plan”) |
| FAQ „Jak mogę zapłacić?” | Aktualizacja: „Kartą płatniczą lub BLIK-iem. Kartą — subskrypcja odnawia się automatycznie; BLIK-iem płacisz jednorazowo za wybrany okres.” Usunięcie wzmianki o przelewach |
| FAQ o trialu | Pozostaje bez zmian; niespójność z PS-68 (trial bez karty vs. z metodą płatności) do rozstrzygnięcia w PS-68 |

### Sesja użytkownika

Model odpowiedzi `GET /me` w Angularze rozszerzony o `subscriptionStatus`, `subscriptionPlanId`, `currentPeriodEnd`, `autoRenew`, `trialEndsAt` (wszystkie nullable). Serwis sesji udostępnia je jako `signal`/`computed` (`isTrialing`, `hasActiveSubscription`).

### Regulamin subskrypcji `/legal/subscription`

Wymagana finalna treść (obecnie placeholder) przed włączeniem sprzedaży: zasady odnowienia, BLIK jako płatność jednorazowa, brak zwrotów po rozpoczęciu świadczenia, zgoda na natychmiastowe świadczenie. Zadanie treściowe — patrz plan wdrożenia.

---

## 8. Stany interfejsu — tabela zbiorcza

| Stan | Widok | Zachowanie |
|---|---|---|
| Gość wchodzi na `/checkout` | Guard | Redirect `/login?next=/checkout` |
| `user`, formularz niekompletny | `/checkout` | Przycisk „Zapłać” nieaktywny |
| `user`, komplet danych | `/checkout` | Przycisk aktywny → sesja Stripe → przekierowanie |
| Trial aktywny | `/checkout` | Baner o zakończeniu trialu, formularz aktywny |
| Aktywny `premium` / `admin` | Guard | Redirect `/pricing` |
| Płatność udana | `/checkout/success` | Polling → sukces, odświeżona sesja i menu |
| Webhook opóźniony | `/checkout/success` | Komunikat „w trakcie przetwarzania” + „Sprawdź ponownie” |
| Płatność anulowana/nieudana | `/checkout/cancel` | Komunikat + „Spróbuj ponownie” |
| Błąd tworzenia sesji | `/checkout` | Baner błędu + ponowienie |

---

## 9. Responsywność

| Breakpoint | Zachowanie |
|---|---|
| ≥960px (desktop) | Dwie kolumny: formularz (60%) + sticky podsumowanie (40%) |
| <960px (tablet/mobile) | Jedna kolumna: sekcje 1–3, podsumowanie pod formularzem; przycisk „Zapłać” w sticky pasku u dołu (nad Bottom Barem — bez kolizji z nim) |
| Strony sukcesu/anulowania | Wyśrodkowana karta o `max-width: 560px` |

---

## 10. Dostępność (a11y)

- Grupy wyborów (`plan`, `metoda`) jako `role="radiogroup"` z `aria-labelledby` na nagłówku sekcji.
- Checkboxy zgód mają powiązane etykiety, błąd walidacji ogłaszany przez `aria-live="polite"`.
- Stan „Potwierdzamy płatność…” ma `role="status"` i `aria-live="polite"`; komunikat sukcesu/błędu przenosi fokus na nagłówek strony.
- Przycisk „Zapłać” w stanie ładowania ma `aria-busy="true"` oraz tekst „Przekierowanie do płatności…”.
- Ikony dekoracyjne: `aria-hidden="true"`; kontrast statusów zgodny z WCAG AA.

---

## 11. Testy

| Poziom | Zakres |
|---|---|
| Jednostkowe | `checkoutAccessGuard` (gość/user/trial/premium/admin), `CheckoutPageComponent` (walidacja zgód, wybór planu domyślnie roczny, mapowanie błędów API), polling na stronie sukcesu (sukces, timeout), walidacja `next` |
| Integracyjne | Formularz + `CheckoutService` z mockiem HTTP |
| E2E (Playwright) | Gość → `/checkout` → login → powrót na `/checkout`; wypełnienie formularza i przekierowanie (stub `POST /checkout/sessions`); strona sukcesu z mockowanym `GET /me` |
