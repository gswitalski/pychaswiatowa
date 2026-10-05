# Plan implementacji widoku PS-66 — Checkout i płatności (subskrypcja Premium)

## 1. Przegląd

Widok PS-66 zamienia stub `/checkout` („Płatności wkrótce") w działający proces zakupu subskrypcji Premium. Użytkownik wybiera plan (domyślnie roczny) i metodę płatności (karta / BLIK), akceptuje dwie wymagane zgody, a aplikacja tworzy sesję hosted checkout u operatora (Stripe) przez `POST /checkout/sessions` i przekierowuje go na stronę płatności. Po płatności Stripe wraca na `/checkout/success` lub `/checkout/cancel`.

**Zasada nadrzędna:** frontend niczego nie aktywuje. Premium aktywuje wyłącznie webhook po stronie backendu. Strona sukcesu tylko odpytuje `GET /me` i prezentuje potwierdzony stan.

Zakres zmian:

| Element | Typ | Ścieżka |
|---|---|---|
| `CheckoutPageComponent` | Przebudowa (stub → formularz zakupu) | `src/app/pages/checkout/checkout-page.ts` |
| `PlanSelectorComponent`, `PaymentMethodSelectorComponent`, `CheckoutConsentsComponent`, `OrderSummaryComponent` | Nowe | `src/app/pages/checkout/components/` |
| `CheckoutSuccessPageComponent` | Nowy | `src/app/pages/checkout/checkout-success/` |
| `CheckoutCancelPageComponent` | Nowy | `src/app/pages/checkout/checkout-cancel/` |
| `CheckoutService` + mapper błędów | Nowe | `src/app/pages/checkout/services/` |
| `PaymentHistoryComponent` | Nowy (sekcja w `/settings`) | `src/app/pages/settings/components/payment-history/` |
| `BillingService` | Nowy (`GET /billing/payments`) | `src/app/core/services/billing.service.ts` |
| `MeApiService`, `SubscriptionStateService` | Nowe (stan subskrypcji z `GET /me`) | `src/app/core/services/` |
| `AuthService` | Modyfikacja (`refreshSession`, karmienie `SubscriptionStateService`) | `src/app/core/services/auth.service.ts` |
| `checkoutAccessGuard` | Nowy | `src/app/core/guards/checkout-access.guard.ts` |
| `PostAuthRedirectService` + `sanitizeNextUrl` | Nowe (obsługa `?next=`) | `src/app/core/services/`, `src/app/core/utils/` |
| Logowanie, rejestracja, callback OAuth, complete-profile | Modyfikacja (konsumpcja `next`) | `src/app/pages/login/`, `register/`, `auth/` |
| `/pricing` | Modyfikacja (plan w CTA, CTA dla trialu, FAQ, „brutto") | `src/app/pages/pricing/` |
| `app.routes.ts` | Modyfikacja | `src/app/app.routes.ts` |

### Korekty względem planu UI (`PS-66-checkout-payments-ui-plan.md`)

| Temat | Plan UI | Decyzja w tym planie | Powód |
|---|---|---|---|
| Warunek sukcesu pollingu | `app_role === 'premium' && subscription_status === 'active'` | **Tylko `subscription_status === 'active'`** (z `GET /me`), a rola sprawdzana po `refreshSession()` | `GET /me` zwraca `app_role` z JWT (`me.handlers.ts`), więc do odświeżenia tokenu jest nieaktualna. Warunek z planu UI nigdy by się nie spełnił. Status w tabeli `subscriptions` jest zmieniany w tej samej transakcji RPC co rola |
| Parametry powrotu po anulowaniu | `plan` i `payment_method` w query | Checkout czyta `?plan=` oraz `?method=card\|blik` | Jedna, spójna konwencja parametrów, walidowana allowlistą |
| Stan nieudanego pobrania `GET /me` w guardzie | Nieopisany | Fail-open (wpuszczamy), backend odrzuci `409` | Guard to UX, nie zabezpieczenie. Źródłem prawdy jest API |
| Stopka `/pricing` | „Ceny orientacyjne, netto PLN B2C" | „Ceny brutto (zawierają VAT)" | `amount_gross` w API i „Cena zawiera VAT" w podsumowaniu. Obecny tekst jest sprzeczny |
| Polling | „`GET /me` co 2 s" | `exhaustMap` (bez nakładania żądań), błąd sieci liczy się jako próba, nie przerywa pętli | Odporność na chwilowe błędy |

## 2. Routing widoku

Aplikacja ma dwie grupy tras z tym samym `path: ''`: zalogowani (`MainLayoutComponent`, `canMatch: [authenticatedMatchGuard]`) i goście (`PublicLayoutComponent`, `canMatch: [guestOnlyMatchGuard]`). Dziś `/checkout` jest zdefiniowany w obu. Po zmianie formularz istnieje **tylko** w grupie zalogowanych.

| Ścieżka | Grupa | Guard | Komponent |
|---|---|---|---|
| `/checkout` | Zalogowani | `canActivate: [checkoutAccessGuard]` | `CheckoutPageComponent` |
| `/checkout/success` | Zalogowani | brak (layout już wymaga sesji) | `CheckoutSuccessPageComponent` |
| `/checkout/cancel` | Zalogowani | brak | `CheckoutCancelPageComponent` |
| `/checkout`, `/checkout/success`, `/checkout/cancel` | Goście | `redirectTo` | przekierowanie do `/login?next=%2Fcheckout` |

Szczegóły:

- **Guard jako `canActivate` (nie `canMatch`).** `canMatch` zwracający `false` w grupie zalogowanych powoduje przejście do grupy gości, która też nie pasuje, i trasa znika. `canActivate` z `UrlTree` daje deterministyczne przekierowanie.
- **Goście:** wzorzec jak przy `dashboard`/`shopping` w `app.routes.ts`: `redirectTo` jako funkcja. Dla `/checkout` zachowuje `?plan=` i `?method=`, czyli buduje `/login?next=<zakodowane /checkout?plan=...>`. `pathMatch: 'full'` na każdej z trzech tras.
- **Lazy loading:** `loadComponent` dla wszystkich trzech tras. Ścieżki zmieniają się na `./pages/checkout/checkout-success/checkout-success-page` i `.../checkout-cancel/checkout-cancel-page`.
- `data: { breadcrumb: ... }` niepotrzebne (widoki nie są w drzewie nawigacji z breadcrumbami).

### Logika `checkoutAccessGuard`

| Stan | Wynik |
|---|---|
| Brak sesji (obrona w głąb) | `UrlTree` → `/login?next=/checkout` |
| `admin` | `UrlTree` → `/pricing` |
| `user` | `true` |
| `premium` i `subscription_status === 'trialing'` | `true` |
| `premium` w pozostałych przypadkach | snackbar „Masz już aktywne konto Premium." + `UrlTree` → `/pricing` |

Dla roli `premium` guard wywołuje `await subscriptionState.ensureLoaded()`. Gdy `GET /me` się nie powiedzie: `true` (fail-open, backend zwróci `409`).

### Obsługa `?next=`

`/pricing` już generuje `/register?next=/checkout`, ale parametr nie jest nigdzie konsumowany. Obecne logowanie czyta tylko `returnUrl`/`redirectTo`.

- `sanitizeNextUrl(raw)` (czysta funkcja, `core/utils/post-auth-redirect.util.ts`):
    - odrzuca wartości niezaczynające się od `/`, zaczynające się od `//`, zawierające `://` lub `\`,
    - parsuje przez `new URL(raw, 'http://localhost')`, dopuszcza wyłącznie `pathname === '/checkout'` (allowlista `POST_AUTH_ALLOWED_PATHS = ['/checkout']`),
    - z query zachowuje tylko `plan` (`premium_monthly|premium_yearly`) i `method` (`card|blik`), resztę odrzuca,
    - zwraca odbudowany, bezpieczny URL lub `null`.
- Logowanie e-mail: kolejność `next` → `returnUrl`/`redirectTo` (istniejący `validateRedirectUrl`) → `PostAuthRedirectService.consume()` → `/dashboard`.
- Rejestracja i Google OAuth: `next` zapisywany w `sessionStorage` (klucz `pych.postAuthRedirect`, TTL 24 h), bo między rejestracją a pierwszym logowaniem jest potwierdzenie e-mail, a OAuth wykonuje pełną nawigację poza aplikację. Odczyt i usunięcie (`consume()`) po pierwszym udanym logowaniu, w `AuthCallbackPageComponent` i po zapisie profilu w `CompleteProfilePageComponent`.
- Brak `next` → dotychczasowe zachowanie (`/dashboard`).

## 3. Struktura komponentów

```
CheckoutPageComponent                     ← /checkout (pages/checkout/checkout-page.ts)
├─ [baner trialu]                         ← mat-card, inline w szablonie (@if isTrialing)
├─ [baner błędu / limitu]                 ← inline (role="alert")
├─ PlanSelectorComponent                  ← radiogroup kart: roczny / miesięczny
├─ PaymentMethodSelectorComponent         ← radiogroup: karta / BLIK
├─ CheckoutConsentsComponent              ← 2 × mat-checkbox + link do regulaminu
└─ OrderSummaryComponent                  ← podsumowanie + przycisk „Zapłać" (sticky na mobile)

CheckoutSuccessPageComponent              ← /checkout/success
└─ [stany: confirming | confirmed | pending]

CheckoutCancelPageComponent               ← /checkout/cancel

ProfileSettingsPageComponent (modyfikacja) ← /settings
└─ PaymentHistoryComponent                ← nowa karta „Płatności" (ukryta dla admina)

PricingPageComponent (modyfikacja)        ← /pricing

Serwisy i guardy (core)
├─ MeApiService                           ← GET /me
├─ SubscriptionStateService               ← signal'e subskrypcji z /me
├─ BillingService                         ← GET /billing/payments
├─ PostAuthRedirectService                ← sessionStorage dla `next`
├─ checkoutAccessGuard
└─ AuthService (mod.)                     ← refreshSession(), zasilanie SubscriptionStateService
Serwisy strony
└─ CheckoutService                        ← POST /checkout/sessions, draft, przekierowanie
```

Wszystkie komponenty: standalone, `ChangeDetectionStrategy.OnPush`, selektory z prefiksem `pych-`, sygnałowe `input()`/`output()`/`model()`, `inject()`, sterowanie przepływem przez `@if`/`@for`/`@switch`. NgRx nie jest potrzebny. Stan jest lokalny lub w serwisach opartych o signals (zgodnie z `ProfileSettingsFacade` i `AiCreditsService`).

## 4. Szczegóły komponentów

### `CheckoutPageComponent`

- **Opis:** Kontener strony `/checkout`. Trzyma stan formularza, waliduje kompletność, buduje komendę, wywołuje `CheckoutService` i obsługuje błędy. Zastępuje obecny stub (`checkout-page.ts/html/scss`).
- **Główne elementy:**
    - `<main class="checkout-page">` z `<h1>` „Kup Premium" (`tabindex="-1"`, cel fokusu),
    - baner trialu (`mat-card` z ikoną `info`) gdy `isTrialing()`,
    - baner błędu (`role="alert"`) z przyciskiem „Spróbuj ponownie",
    - `pych-plan-selector`, `pych-payment-method-selector`, `pych-checkout-consents`, `pych-order-summary`,
    - skeleton formularza, gdy `!subscriptionState.loaded()`,
    - układ dwukolumnowy ≥960px (60/40, podsumowanie `position: sticky`), jedna kolumna poniżej.
- **Obsługiwane interakcje:**
    - zmiana planu / metody / zgód (przez `model()` dzieci),
    - `submit()` z `OrderSummaryComponent`,
    - `retry()` z baneru błędu,
    - `window:pageshow` z `event.persisted === true` → reset `submitState` na `idle` (powrót „Wstecz" ze Stripe).
- **Obsługiwana walidacja:**
    - `canSubmit = acceptedTerms && acceptedDigitalWaiver && submitState === 'idle'`,
    - `?plan=` tylko z allowlisty (`premium_monthly`, `premium_yearly`), w przeciwnym razie `premium_yearly`,
    - `?method=` tylko `card|blik`, w przeciwnym razie `card`,
    - przed wywołaniem API: guard clause `if (!canSubmit()) return;`.
- **Typy:** `CheckoutFormState`, `CheckoutSubmitState`, `CheckoutErrorViewModel`, `OrderSummaryViewModel`, `CreateCheckoutSessionCommand`, `CheckoutSessionResponseDto`.
- **Propsy:** brak (komponent routowany). Dane z `ActivatedRoute.snapshot.queryParamMap`, `SubscriptionStateService`, `CheckoutService`.

### `PlanSelectorComponent`

- **Opis:** Wybór planu jako dwie radio-karty (`mat-radio-group` w stylu kart). Domyślnie roczny, z chipem „Oszczędzasz ~17%". Ceny z `PRICING_CONFIG` (to samo źródło co `/pricing`).
- **Główne elementy:** `mat-radio-group` (`role="radiogroup"`, `aria-labelledby` na nagłówku „1. Wybierz plan"), dwie `label.plan-card` z `mat-radio-button`, cena, `mat-chip` z oszczędnością, dla rocznego linia „ok. 14,08 zł / mies.".
- **Obsługiwane interakcje:** zmiana wartości radio, nawigacja klawiaturą (strzałki, wbudowane w `mat-radio-group`).
- **Obsługiwana walidacja:** wartość zawsze z unii `SubscriptionPlanId` (brak stanu pustego, bo jest wartość domyślna).
- **Typy:** `SubscriptionPlanId`, `PlanOptionViewModel`.
- **Propsy:**
    - `selectedPlanId = model.required<SubscriptionPlanId>()`
    - `disabled = input<boolean>(false)`

### `PaymentMethodSelectorComponent`

- **Opis:** Wybór metody płatności `card` / `blik` (domyślnie `card`). Pod każdą opcją krótki opis: karta „Odnawia się automatycznie", BLIK „Płatność jednorazowa za okres, bez automatycznego odnowienia".
- **Główne elementy:** `mat-radio-group` (`role="radiogroup"`, `aria-labelledby` „2. Metoda płatności"), dwie opcje z ikoną (`credit_card`, dla BLIK ikona SVG lub `smartphone`), opis w `mat-hint`-like `<small>`. Ikony `aria-hidden="true"`.
- **Obsługiwane interakcje:** zmiana metody.
- **Obsługiwana walidacja:** wartość z unii `SubscriptionPaymentMethod`.
- **Typy:** `SubscriptionPaymentMethod`, `PaymentMethodOptionViewModel`.
- **Propsy:**
    - `selectedMethod = model.required<SubscriptionPaymentMethod>()`
    - `disabled = input<boolean>(false)`

### `CheckoutConsentsComponent`

- **Opis:** Dwie wymagane zgody z API (`accepted_terms`, `accepted_digital_content_waiver`).
- **Główne elementy:**
    - `mat-checkbox` „Akceptuję Regulamin subskrypcji" z linkiem `<a href="/legal/subscription" target="_blank" rel="noopener">`,
    - `mat-checkbox` „Chcę korzystać z Premium od razu i wiem, że tracę prawo do odstąpienia od umowy w 14 dni",
    - `<div aria-live="polite">` z komunikatem błędu.
- **Obsługiwane interakcje:** przełączanie obu checkboxów.
- **Obsługiwana walidacja:** oba muszą być `true` (wymóg API `VALIDATION_ERROR`). Podświetlenie brakujących (klasa `--invalid` + komunikat) tylko, gdy `highlightMissing() === true` (po `400` z API).
- **Typy:** brak własnych.
- **Propsy:**
    - `acceptedTerms = model.required<boolean>()`
    - `acceptedDigitalWaiver = model.required<boolean>()`
    - `highlightMissing = input<boolean>(false)`
    - `disabled = input<boolean>(false)`

### `OrderSummaryComponent`

- **Opis:** Podsumowanie zamówienia i przycisk płatności. Na desktopie karta `sticky`, na <960px przycisk w pasku przyklejonym do dołu (nad Bottom Barem).
- **Główne elementy:**
    - nazwa planu („Premium (roczny)"), cena brutto (`CurrencyPipe` `'PLN' : 'symbol' : '1.2-2' : 'pl'`), „Cena zawiera VAT",
    - linia daty: „Następna płatność: {data}" (karta) albo „Premium aktywne do: {data}" (BLIK, z dopiskiem „bez automatycznego odnowienia"),
    - `button mat-flat-button` „Zapłać {kwota}": stan ładowania z `mat-spinner` i tekstem „Przekierowanie do płatności…", `aria-busy="true"`,
    - `🔒 Bezpieczna płatność przez Stripe` jako `mat-icon lock` + tekst.
- **Obsługiwane interakcje:** kliknięcie „Zapłać" → `(pay)`.
- **Obsługiwana walidacja:** przycisk `disabled`, gdy `!canSubmit()` lub `submitting()`. Blokada wielokrotnego kliknięcia.
- **Typy:** `OrderSummaryViewModel`.
- **Propsy:**
    - `summary = input.required<OrderSummaryViewModel>()`
    - `canSubmit = input.required<boolean>()`
    - `submitting = input<boolean>(false)`
    - `pay = output<void>()`

### `CheckoutSuccessPageComponent`

- **Opis:** Strona powrotu po płatności (`success_url`). Nie aktywuje Premium. Pokazuje stan „Potwierdzamy płatność…", po potwierdzeniu webhooka stan sukcesu, po 15 próbach stan „w trakcie przetwarzania".
- **Główne elementy:** wyśrodkowana `mat-card` (`max-width: 560px`), trzy widoki w `@switch (state())`:
    - `confirming`: `mat-spinner` + tekst „Potwierdzamy płatność…", kontener `role="status"` `aria-live="polite"`,
    - `confirmed`: nagłówek „Witaj w Premium!", komunikat o e-mailu, plan, „Następna płatność: {data}" lub „Premium aktywne do: {data}. Konto nie odnawia się automatycznie.", przycisk „Pobierz fakturę" (gdy jest `document_url`), przyciski „Przejdź do aplikacji" (`/dashboard`) i „Utwórz przepis z AI" (`/recipes/new/start`),
    - `pending`: komunikat „Płatność jest przetwarzana…", przyciski „Sprawdź ponownie" i „Przejdź do aplikacji".
- **Obsługiwane interakcje:** „Sprawdź ponownie" (restart pollingu), nawigacja, link do faktury (nowa karta, `rel="noopener"`).
- **Obsługiwana walidacja:**
    - brak `session_id` lub wartość niezgodna z `^cs_[A-Za-z0-9_]+$` → `router.navigate(['/checkout'], { replaceUrl: true })` (jedynie sanity check UX; `session_id` nie jest wysyłany do API),
    - sukces pollingu = `subscription_status === 'active'`.
- **Typy:** `CheckoutSuccessState`, `MeDto`, `BillingPaymentDto`.
- **Propsy:** brak (komponent routowany). Dane z `ActivatedRoute`, `SubscriptionStateService`, `AuthService`, `BillingService`, `CheckoutService`.

### `CheckoutCancelPageComponent`

- **Opis:** Widok porzuconej/anulowanej płatności (`cancel_url`). Błędy inline (odrzucona karta, nieudany BLIK) Stripe pokazuje na własnej stronie.
- **Główne elementy:** wyśrodkowana `mat-card`, ikona ostrzeżenia, tekst „Płatność nie została zakończona. Nic nie zostało pobrane z Twojego konta…", przyciski „Spróbuj ponownie" i „Wróć do cennika", link `mailto:` „Masz problem z płatnością? Napisz do nas".
- **Obsługiwane interakcje:** „Spróbuj ponownie" → `/checkout` z `queryParams` odtworzonymi z `CheckoutService.readDraft()`; „Wróć do cennika" → `/pricing`.
- **Obsługiwana walidacja:** draft z `sessionStorage` przechodzi przez tę samą allowlistę co query (nieprawidłowy draft jest ignorowany).
- **Typy:** `CheckoutDraft`.
- **Propsy:** brak.

### `PaymentHistoryComponent` (w `/settings`)

- **Opis:** Karta „Płatności" z statusem subskrypcji i tabelą płatności. Minimalny wymóg „faktura dostępna dla użytkownika". Zarządzanie subskrypcją (anulowanie, zmiana planu) to PS-67.
- **Główne elementy:**
    - status: chip „Premium — aktywne" + plan + „Następna płatność: {data}" (`auto_renew`) lub „Aktywne do: {data}",
    - desktop (≥960px): `mat-table` z kolumnami: data, plan, kwota brutto, metoda, status, „Faktura" (link `document_url`, nowa karta),
    - mobile (<960px): lista kart (przełączenie CSS jak w `pricing-page`: bloki `.payments-desktop` / `.payments-mobile`),
    - stan pusty „Brak płatności.", stan błędu z „Spróbuj ponownie", skeleton przy ładowaniu.
- **Obsługiwane interakcje:** „Spróbuj ponownie", otwarcie faktury.
- **Obsługiwana walidacja:**
    - widoczność: `appRole !== 'admin'` (warunek w szablonie strony, tak jak sekcja kredytów AI) oraz `payments().length > 0 || subscriptionState.status() !== null`,
    - link faktury tylko dla `status === 'paid'` i `document_url !== null`.
- **Typy:** `BillingPaymentDto`, `PaymentHistoryRowViewModel`, `SubscriptionStatus`.
- **Propsy:** brak (komponent ładuje dane sam przez `BillingService` i `SubscriptionStateService`).

### `PricingPageComponent` (modyfikacja)

- **Zmiany:**
    - CTA „Wybierz Premium" przekazuje wybrany okres: zalogowany → `routerLink="/checkout" [queryParams]="{ plan: selectedPlanId() }"`, gość → `/register` z `[queryParams]="{ next: '/checkout?plan=...' }"`. `selectedPlanId = computed(() => PLAN_ID_BY_PERIOD[billingPeriod()])`,
    - rola `premium` z `subscriptionState.isTrialing()`: przycisk „Kup Premium" → `/checkout` zamiast disabled „Twój aktualny plan". Do tego `ngOnInit` wywołuje `subscriptionState.ensureLoaded()` dla roli `premium`,
    - FAQ „Jakie metody płatności są dostępne?": „Kartą płatniczą lub BLIK-iem. Kartą — subskrypcja odnawia się automatycznie; BLIK-iem płacisz jednorazowo za wybrany okres." (bez przelewów),
    - stopka: „Ceny brutto (zawierają VAT)." zamiast „Ceny orientacyjne, netto PLN B2C…",
    - usunięcie `// TODO: Po wdrożeniu checkout zastąpić wywołaniem GET /pricing/plans` tylko jeśli endpoint planów pozostaje poza zakresem (patrz sekcja 10).
- **`pricing.config.ts`:** dodać `PLAN_ID_BY_PERIOD`, `PERIOD_BY_PLAN_ID` i `getPremiumPlanPrice(planId)` (kwoty w groszach), żeby checkout i cennik miały jedno źródło cen.

### `checkoutAccessGuard`

- **Opis:** Funkcjonalny `CanActivateFn` (patrz tabela stanów w sekcji 2).
- **Zależności:** `AuthService`, `SubscriptionStateService`, `Router`, `MatSnackBar`.
- **Zwraca:** `Promise<boolean | UrlTree>`.

## 5. Typy

### DTO (już w `shared/contracts/types.ts`, region „Billing")

Bez zmian w kontraktach. Wykorzystywane:

| Typ | Pola |
|---|---|
| `SubscriptionPlanId` | `'premium_monthly' \| 'premium_yearly'` |
| `SubscriptionPaymentMethod` | `'card' \| 'blik'` |
| `SubscriptionStatus` | `'active' \| 'trialing' \| 'past_due' \| 'canceled' \| 'expired'` |
| `CreateCheckoutSessionCommand` | `plan_id`, `payment_method`, `accepted_terms: true`, `accepted_digital_content_waiver: true` |
| `CheckoutSessionResponseDto` | `checkout_url`, `session_id`, `expires_at` |
| `BillingPaymentDto` | `id`, `plan_id`, `payment_method_type`, `amount_gross` (grosze), `currency: 'PLN'`, `status`, `paid_at`, `document_number`, `document_url`, `document_pdf_url` |
| `GetBillingPaymentsResponseDto` | `data: BillingPaymentDto[]` |
| `MeDto` | `id`, `username`, `app_role`, `ai_credits`, `subscription_status`, `subscription_plan_id`, `current_period_end`, `auto_renew`, `trial_ends_at` |

### Nowe typy widoku

Plik: `src/app/pages/checkout/models/checkout.model.ts`.

```typescript
/** Stan formularza na /checkout. */
export interface CheckoutFormState {
    planId: SubscriptionPlanId;
    paymentMethod: SubscriptionPaymentMethod;
    acceptedTerms: boolean;
    acceptedDigitalWaiver: boolean;
}

/** Faza wysyłki. 'redirecting' = mamy URL operatora i trwa window.location.assign. */
export type CheckoutSubmitState = 'idle' | 'submitting' | 'redirecting' | 'error';

/** Kody błędów rozpoznawane po stronie UI (kody API + błędy transportu). */
export type CheckoutErrorCode =
    | 'VALIDATION_ERROR'
    | 'SUBSCRIPTION_ALREADY_ACTIVE'
    | 'FORBIDDEN_ROLE'
    | 'RATE_LIMITED'
    | 'PAYMENT_PROVIDER_ERROR'
    | 'UNAUTHORIZED'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

export interface CheckoutErrorViewModel {
    code: CheckoutErrorCode;
    /** Komunikat po polsku, gotowy do wyświetlenia. */
    message: string;
    status: number;
    /** Tylko dla RATE_LIMITED: sekundy z nagłówka Retry-After (domyślnie 60). */
    retryAfterSeconds?: number;
}

/** Zapis w sessionStorage pod kluczem 'pych.checkoutDraft' (odtworzenie wyboru po /checkout/cancel). */
export interface CheckoutDraft {
    planId: SubscriptionPlanId;
    paymentMethod: SubscriptionPaymentMethod;
}

export interface PlanOptionViewModel {
    id: SubscriptionPlanId;
    label: string;          // 'Roczny' | 'Miesięczny'
    priceGross: number;     // grosze
    priceSuffix: string;    // '/ rok' | '/ mies.'
    monthlyEquivalent: number | null; // grosze, tylko plan roczny (1408)
    savingsPercent: number | null;    // tylko plan roczny (17)
}

export interface PaymentMethodOptionViewModel {
    id: SubscriptionPaymentMethod;
    label: string;
    description: string;
    icon: string;
    autoRenew: boolean;
}

export interface OrderSummaryViewModel {
    planLabel: string;           // 'Premium (roczny)'
    amountGross: number;         // grosze
    dateKind: 'nextPayment' | 'activeUntil';
    periodEnd: Date;             // orientacyjny koniec okresu liczony od dziś
    autoRenew: boolean;
}

/** Stan strony sukcesu. */
export type CheckoutSuccessState = 'confirming' | 'confirmed' | 'pending';

export interface CheckoutSuccessViewModel {
    planId: SubscriptionPlanId | null;
    currentPeriodEnd: Date | null;
    autoRenew: boolean | null;
    invoiceUrl: string | null;
}
```

Plik: `src/app/core/models/subscription.model.ts`.

```typescript
/** Migawka subskrypcji z GET /me (wszystkie pola nullable = użytkownik bez subskrypcji). */
export interface SubscriptionSnapshot {
    status: SubscriptionStatus | null;
    planId: SubscriptionPlanId | null;
    currentPeriodEnd: Date | null;
    autoRenew: boolean | null;
    trialEndsAt: Date | null;
}
```

Plik: `src/app/pages/settings/components/payment-history/payment-history.model.ts`.

```typescript
export interface PaymentHistoryRowViewModel {
    id: number;
    paidAt: Date | null;
    planLabel: string;          // 'Premium — roczny' | 'Premium — miesięczny'
    amountGross: number;        // grosze
    methodLabel: string;        // 'Karta' | 'BLIK'
    statusLabel: string;        // 'Opłacona' | 'Nieudana'
    statusKind: 'paid' | 'failed';
    documentUrl: string | null;
    documentNumber: string | null;
}
```

Typ błędu z body API (dla mappera; zgodny z `ApplicationError.toJSON()`):

```typescript
interface ApiErrorBody {
    error: string;
    message?: string;
    details?: unknown;
}
```

Stałe: `src/app/pages/checkout/checkout.constants.ts`.

```typescript
export const CHECKOUT_DRAFT_STORAGE_KEY = 'pych.checkoutDraft';
export const CHECKOUT_REDIRECT_ALLOWED_HOSTS = ['checkout.stripe.com'] as const;
export const CHECKOUT_POLL_INTERVAL_MS = 2000;
export const CHECKOUT_POLL_MAX_ATTEMPTS = 15;
export const CHECKOUT_DEFAULT_RETRY_AFTER_SECONDS = 60;
export const SUPPORT_EMAIL = 'TODO@ustalic-przed-wdrozeniem'; // do ustalenia przy wdrożeniu
```

## 6. Zarządzanie stanem

Stan oparty na signals, bez NgRx. Dwa poziomy: lokalny w komponentach stron i globalny w serwisach.

### `SubscriptionStateService` (`providedIn: 'root'`)

Jedyne źródło prawdy dla danych subskrypcji po stronie UI, zasilane z `GET /me`.

| Element | Opis |
|---|---|
| `snapshot: Signal<SubscriptionSnapshot \| null>` | `null` = jeszcze niezaładowano |
| `loaded: Signal<boolean>` | `snapshot() !== null` |
| `status`, `planId`, `currentPeriodEnd`, `autoRenew`, `trialEndsAt` | `computed` z `snapshot` |
| `isTrialing` | `computed`: `status() === 'trialing'` |
| `hasActiveSubscription` | `computed`: `status() === 'active'` |
| `applyMe(me: MeDto)` | Zapisuje migawkę (parsowanie dat, `null` bezpieczne). Wywoływane z `AuthService` po bootstrapie i z pollingu |
| `ensureLoaded(): Promise<void>` | Jeśli migawka istnieje → od razu. Jeśli trwa żądanie → zwraca to samo `Promise` (deduplikacja). W innym przypadku ładuje `GET /me`. Nie rzuca wyjątku (błąd logowany, `snapshot` zostaje `null`) |
| `refresh(): Promise<MeDto \| null>` | Wymusza `GET /me`, aktualizuje migawkę, zwraca surowe `MeDto` (polling). Błąd → `null` |
| `reset()` | Czyszczenie przy wylogowaniu / zmianie użytkownika |

### `AuthService` (modyfikacja)

- Dodać `refreshSession(): Promise<void>` → `supabase.auth.refreshSession()`; błąd → wyjątek. Callback `onAuthStateChange` (`TOKEN_REFRESHED`) wywoła istniejące `updateAuthState`, które synchronicznie (przed pierwszym `await`) ustawia `appRole` z nowego JWT. Po `await refreshSession()` `appRole()` jest już aktualne, a topbar/sidebar reagują bez przeładowania.
- `bootstrapAiCredits` korzysta z `MeApiService.getMe()` i dodatkowo woła `subscriptionState.applyMe(data)`. Dzięki temu nie ma drugiego żądania `GET /me` przy starcie.
- `updateAuthState` dla braku sesji i dla zmiany użytkownika woła `subscriptionState.reset()`.
- Zależności bez cyklu: `AuthService → SubscriptionStateService → MeApiService → SupabaseService`.

### `CheckoutPageComponent` (stan lokalny)

```typescript
protected readonly planId = signal<SubscriptionPlanId>(initialPlanFromQuery);
protected readonly paymentMethod = signal<SubscriptionPaymentMethod>(initialMethodFromQuery);
protected readonly acceptedTerms = signal(false);
protected readonly acceptedDigitalWaiver = signal(false);
protected readonly submitState = signal<CheckoutSubmitState>('idle');
protected readonly error = signal<CheckoutErrorViewModel | null>(null);
protected readonly retryCountdown = signal(0);          // sekundy do odblokowania po 429

protected readonly isTrialing = this.subscriptionState.isTrialing;
protected readonly canSubmit = computed(() =>
    this.acceptedTerms() && this.acceptedDigitalWaiver() && this.submitState() === 'idle');
protected readonly formDisabled = computed(() => this.submitState() !== 'idle');
protected readonly summary = computed<OrderSummaryViewModel>(/* plan + metoda → kwota i data */);
protected readonly highlightMissingConsents = computed(() => this.error()?.code === 'VALIDATION_ERROR');
```

- Data okresu: `calculatePeriodEnd(planId, new Date())` (`pages/checkout/utils/period.util.ts`): +12 lub +1 miesiąc z obcięciem do ostatniego dnia miesiąca. Etykieta jest **orientacyjna**, rzeczywistą datę zwraca backend.
- Timer odliczania po `429` (`setInterval` czyszczony w `DestroyRef.onDestroy`, wzorzec z `LoginPageComponent`).
- `pageshow` przez `@HostListener('window:pageshow', ['$event'])`.

### `CheckoutSuccessPageComponent` (stan lokalny)

```typescript
protected readonly state = signal<CheckoutSuccessState>('confirming');
protected readonly attempt = signal(0);
protected readonly viewModel = signal<CheckoutSuccessViewModel | null>(null);
```

Polling:

```
timer(0, CHECKOUT_POLL_INTERVAL_MS)
  → exhaustMap(() => subscriptionState.refresh())       // brak nakładania żądań
  → tap(attempt++)
  → takeWhile(me => !(me?.subscription_status === 'active') && attempt < MAX, true)
  → takeUntilDestroyed(destroyRef)
```

Po wykryciu `active`: `await authService.refreshSession()` → (jeśli `appRole() !== 'premium'`, jedna powtórka odświeżenia) → `billingService.getPayments(1)` (błąd ignorowany, tylko brak przycisku faktury) → `clearDraft()` → `state.set('confirmed')`. Po wyczerpaniu prób → `state.set('pending')`. „Sprawdź ponownie" resetuje `attempt` i `state` i uruchamia pętlę od nowa. Błąd `GET /me` (`refresh()` zwraca `null`) liczy się jako próba.

### `PaymentHistoryComponent` (stan lokalny)

```typescript
protected readonly payments = signal<PaymentHistoryRowViewModel[]>([]);
protected readonly loadState = signal<'loading' | 'loaded' | 'error'>('loading');
protected readonly isVisible = computed(() =>
    this.loadState() === 'error' || this.payments().length > 0 || this.subscriptionState.status() !== null);
```

Zgodnie z regułą „Loading states": przy ponownym ładowaniu (`retry`) zostają poprzednie dane i `opacity: 0.5`, bez białych nakładek.

### Pozostałe serwisy

- `PostAuthRedirectService`: `save(rawNext)`, `consume(): string | null` (czyta, waliduje `sanitizeNextUrl`, sprawdza TTL, usuwa klucz). Dostęp do `sessionStorage` w `try/catch` (tryb prywatny / zablokowany storage → ciche pominięcie).
- `CheckoutService`: `saveDraft`, `readDraft`, `clearDraft` (również `try/catch`).

## 7. Integracja API

Wszystkie wywołania przez `supabase.functions.invoke()` (zgodnie z regułą `API_COMMUNICATION_AND_DATA_ACCESS`: bez `supabase.from()` i `supabase.rpc()`).

### `POST /checkout/sessions` — `CheckoutService.createSession()`

- **Żądanie:** `CreateCheckoutSessionCommand`.

```typescript
const command: CreateCheckoutSessionCommand = {
    plan_id: this.planId(),
    payment_method: this.paymentMethod(),
    accepted_terms: true,
    accepted_digital_content_waiver: true,
};
```

- **Odpowiedź `201`:** `CheckoutSessionResponseDto` (`checkout_url`, `session_id`, `expires_at`).
- **Implementacja:**

```typescript
createSession(command: CreateCheckoutSessionCommand): Observable<CheckoutSessionResponseDto> {
    return from(
        this.supabase.functions.invoke<CheckoutSessionResponseDto>('checkout/sessions', {
            method: 'POST',
            body: command,
        }),
    ).pipe(
        switchMap(async (response) => {
            if (response.error) {
                throw await mapCheckoutError(response.error);
            }
            if (!response.data?.checkout_url) {
                throw createUnknownCheckoutError();
            }
            return response.data;
        }),
    );
}
```

- **Mapper błędów** (`checkout-error.mapper.ts`): `FunctionsHttpError` ma `context: Response`. Status z `context.status`, body z `await context.json()` (w `try/catch`), kod z `body.error`, `Retry-After` z `context.headers.get('Retry-After')`. `FunctionsFetchError` / `FunctionsRelayError` / brak `context` → `NETWORK_ERROR`. Wzorzec jak `getStatusFromFunctionError` / `getBodyFromFunctionError` w `MyPlanService`.
- **Przekierowanie:** `redirectToProvider(url)`: walidacja `new URL(url)`: `protocol === 'https:'` i `hostname` ∈ `CHECKOUT_REDIRECT_ALLOWED_HOSTS`, w przeciwnym razie `PAYMENT_PROVIDER_ERROR` po stronie UI. Dopiero potem `inject(DOCUMENT).location.assign(url)` (testowalne przez podmianę `DOCUMENT`). Jest to obrona w głębi, bo serwer i tak buduje `success_url`/`cancel_url` z `APP_BASE_URL`.
- Frontend **nie** przekazuje `success_url`/`cancel_url`.

### `GET /me` — `MeApiService.getMe()`

- **Odpowiedź:** `MeDto` (pola subskrypcji nullable).
- Używany przez `AuthService` (bootstrap), `SubscriptionStateService` (`ensureLoaded`, `refresh`) i stronę sukcesu (polling).
- **Uwaga:** `app_role` w odpowiedzi pochodzi z JWT, więc nie służy do wykrywania aktywacji. Do tego służy `subscription_status`.

### `GET /billing/payments?limit=` — `BillingService.getPayments(limit = 20)`

- **Odpowiedź:** `GetBillingPaymentsResponseDto`.
- Użycie: `PaymentHistoryComponent` (limit 20), strona sukcesu (limit 1, link do faktury).
- Błąd → `ApiError` (`mapError` jak w `ProfileSettingsApiService`).

### Zdarzenia wychodzące do Stripe

Brak wywołań bezpośrednio do Stripe z frontendu, w tym brak Stripe.js i danych karty po stronie aplikacji (hosted checkout).

## 8. Interakcje użytkownika

| # | Interakcja | Wynik |
|---|---|---|
| 1 | Gość wchodzi na `/checkout` | Przekierowanie do `/login?next=/checkout...`. Po zalogowaniu (e-mail lub Google) powrót na `/checkout` z zachowanym `plan` |
| 2 | Gość klika „Wybierz Premium" na `/pricing` | `/register?next=/checkout?plan=...`. `next` ląduje w `sessionStorage` i jest konsumowany po pierwszym logowaniu |
| 3 | `user` klika „Wybierz Premium" (rocznie/miesięcznie) | `/checkout?plan=premium_yearly` lub `premium_monthly`, formularz z odpowiednio wybranym planem |
| 4 | Wejście na `/checkout` bez parametrów | Domyślnie plan roczny, karta, zgody odznaczone, przycisk nieaktywny |
| 5 | Zmiana planu | Cena w podsumowaniu i na przycisku aktualizuje się natychmiast |
| 6 | Zmiana metody | Zmienia się opis i linia daty („Następna płatność" ↔ „Premium aktywne do") |
| 7 | Zaznaczenie obu zgód | Przycisk „Zapłać X zł" staje się aktywny |
| 8 | Klik „Regulamin subskrypcji" | `/legal/subscription` w nowej karcie (formularz bez zmian) |
| 9 | Klik „Zapłać" | `submitState = 'submitting'`, formularz zablokowany, zapis draftu, `POST /checkout/sessions`, potem `'redirecting'` i przekierowanie do Stripe |
| 10 | „Wstecz" z Stripe (bfcache) | `pageshow` resetuje stan, formularz znów aktywny |
| 11 | Stripe → `/checkout/success?session_id=...` | Spinner „Potwierdzamy płatność…", polling, po `active` odświeżenie sesji i ekran sukcesu, menu już z rolą Premium |
| 12 | Webhook opóźniony (>30 s) | Komunikat „w trakcie przetwarzania", „Sprawdź ponownie" |
| 13 | „Pobierz fakturę" | Otwarcie `document_url` w nowej karcie |
| 14 | „Przejdź do aplikacji" / „Utwórz przepis z AI" | `/dashboard` / `/recipes/new/start` |
| 15 | Stripe → `/checkout/cancel` | Komunikat, „Spróbuj ponownie" (z odtworzonym planem i metodą) lub „Wróć do cennika" |
| 16 | Użytkownik w trialu wchodzi na `/checkout` | Baner o zakończeniu trialu i aktywny formularz |
| 17 | `/settings` po zakupie | Karta „Płatności": status, tabela, link „Faktura" |

## 9. Warunki i walidacja

| Warunek | Gdzie weryfikowany | Wpływ na UI |
|---|---|---|
| Sesja istnieje (auth required) | `redirectTo` dla gości, `checkoutAccessGuard` | Gość nigdy nie widzi formularza |
| `app_role !== 'admin'` | `checkoutAccessGuard`; `PricingPageComponent.showPremiumCta`; `/settings` (ukrycie karty) | Admin → `/pricing`, brak CTA zakupu, brak sekcji płatności |
| `app_role === 'premium'` ⇒ dostęp tylko gdy `subscription_status === 'trialing'` | `checkoutAccessGuard` (+ `409` z API jako zabezpieczenie) | Aktywny Premium → `/pricing` + snackbar |
| `plan_id ∈ {premium_yearly, premium_monthly}` | `CheckoutPageComponent` (parsowanie `?plan=`), typ unii | Nieprawidłowa wartość → plan roczny |
| `payment_method ∈ {card, blik}` | `CheckoutPageComponent` (parsowanie `?method=`), typ unii | Nieprawidłowa wartość → `card` |
| `accepted_terms === true` | `CheckoutConsentsComponent` + `canSubmit` | Brak → przycisk nieaktywny |
| `accepted_digital_content_waiver === true` | j.w. | j.w. |
| Brak równoległych wysyłek | `canSubmit` wymaga `submitState === 'idle'` | Spinner, `aria-busy`, blokada formularza |
| Rate limit 5/min | API `429` | Komunikat + przycisk ponowienia po `Retry-After` (domyślnie 60 s) |
| `checkout_url` należy do zaufanego hosta | `CheckoutService.redirectToProvider` | Inaczej komunikat `PAYMENT_PROVIDER_ERROR`, brak przekierowania |
| `session_id` obecny i w formacie `cs_*` | `CheckoutSuccessPageComponent` | Brak → przekierowanie na `/checkout` |
| Potwierdzenie zakupu = `subscription_status === 'active'` | pętla pollingu | Dopiero wtedy `refreshSession()` i ekran sukcesu |
| `next` z allowlisty (`/checkout`, `plan`, `method`) | `sanitizeNextUrl` | Inaczej ignorowany (`/dashboard`) |
| `document_url !== null` i `status === 'paid'` | `PaymentHistoryComponent`, strona sukcesu | Inaczej ukryty przycisk/link „Faktura" |
| `subscription_status !== null` lub ≥1 płatność | `PaymentHistoryComponent.isVisible` | Karta „Płatności" ukryta dla Free bez historii |

## 10. Obsługa błędów

### `POST /checkout/sessions`

| Status / kod | Zachowanie |
|---|---|
| `400 VALIDATION_ERROR` | Komunikat „Sprawdź wybrane opcje i zgody." pod formularzem, podświetlenie brakujących checkboxów (`highlightMissing`), `submitState = 'idle'` |
| `401 UNAUTHORIZED` | Wylogowanie lokalne nie jest potrzebne (sesja wygasła): `router.navigate(['/login'], { queryParams: { next: '/checkout' } })` |
| `403 FORBIDDEN_ROLE` | Snackbar + przekierowanie do `/pricing` (admin) |
| `409 SUBSCRIPTION_ALREADY_ACTIVE` | Snackbar „Masz już aktywne konto Premium." + przekierowanie do `/pricing` |
| `429 RATE_LIMITED` | „Zbyt wiele prób. Spróbuj ponownie za minutę.", przycisk „Spróbuj ponownie" nieaktywny do końca odliczania (`Retry-After`, domyślnie 60 s) |
| `502 PAYMENT_PROVIDER_ERROR`, `5xx`, błąd sieci | Baner „Nie udało się rozpocząć płatności. Nic nie zostało pobrane. Spróbuj ponownie." + „Spróbuj ponownie" (ponawia `submit()`) |
| Niezaufany host `checkout_url` | Jak `502`, plus `console.error` z kontekstem |

Każdy błąd: `submitState` wraca do `idle` (lub `error`), `console.error('[CheckoutService] ...')`, brak ujawniania szczegółów technicznych użytkownikowi.

### `/checkout/success`

| Sytuacja | Zachowanie |
|---|---|
| Chwilowy błąd `GET /me` w pętli | Liczy się jako próba, pętla trwa |
| `401` podczas pollingu | Przekierowanie do `/login` z `returnUrl` na bieżący `/checkout/success?session_id=...` |
| Brak potwierdzenia po 15 próbach | Stan `pending` + „Sprawdź ponownie" |
| `refreshSession()` zwraca błąd | Stan `confirmed` (płatność potwierdzona), snackbar „Odśwież stronę, aby zobaczyć funkcje Premium." |
| `GET /billing/payments` zawodzi | Ukryty przycisk faktury, reszta ekranu bez zmian (faktura pozostaje w `/settings`) |
| Wejście bez `session_id` | Przekierowanie do `/checkout` |
| Odświeżenie strony (F5) po sukcesie | Polling zakończy się natychmiast (`status === 'active'`), ekran sukcesu nie duplikuje żadnych skutków ubocznych |

### `PaymentHistoryComponent`

Błąd ładowania → komunikat w karcie + „Spróbuj ponownie" (poprzednie dane zostają widoczne).

### Przypadki brzegowe

- **Trial:** baner widoczny tylko dla `trialing`. Ścieżka gotowa na PS-68, do jego wdrożenia testowana jednostkowo przez symulację `SubscriptionSnapshot`.
- **Stary token po zakupie w innej karcie:** `checkoutAccessGuard` przepuści (`user`), API zwróci `409`, UI przekieruje na `/pricing`.
- **Zablokowany `sessionStorage`:** draft i `next` są opcjonalne, brak wyjątków.
- **Brak `Retry-After`:** domyślnie 60 s.

### Wyzwania wdrożeniowe

| Wyzwanie | Rozwiązanie |
|---|---|
| Podwójna definicja tras (goście / zalogowani) | `/checkout*` tylko w grupie zalogowanych, goście przez `redirectTo` |
| `GET /me` zwraca rolę z JWT | Sukces po `subscription_status`, rola po `refreshSession()` |
| Webhook może spóźniać się względem `success_url` | Polling 15 × 2 s + stan `pending` z ponowieniem |
| Brak jednego źródła cen | `PRICING_CONFIG` + helpery, `TODO` dot. endpointu planów pozostaje otwarte |
| Sticky pasek płatności na mobile koliduje z Bottom Barem | Offset równy wysokości Bottom Bara (użyć istniejącej zmiennej/stałej z `layout`; jeśli brak, dodać zmienną CSS) plus `env(safe-area-inset-bottom)` |
| Adres kontaktowy pomocy | `SUPPORT_EMAIL` jest placeholderem, do ustalenia przed wdrożeniem produkcyjnym (blokuje wydanie, nie implementację) |
| Treść `/legal/subscription` to placeholder | Zadanie treściowe: finalny regulamin przed włączeniem sprzedaży |
| Niespójność FAQ o trialu (bez karty) z PS-68 | Bez zmian w PS-66, do rozstrzygnięcia w PS-68 |

## 11. Kroki implementacji

1. **Konfiguracja cen (`pricing.config.ts`).** Dodać `PLAN_ID_BY_PERIOD`, `PERIOD_BY_PLAN_ID`, `getPremiumPlanPrice(planId)`. Bez zmiany istniejących wartości.
2. **Modele i stałe.** Utworzyć `core/models/subscription.model.ts`, `pages/checkout/models/checkout.model.ts`, `pages/checkout/checkout.constants.ts`, `pages/settings/components/payment-history/payment-history.model.ts`.
3. **Warstwa core (API i stan):**
    1. `MeApiService.getMe()` (przeniesienie logiki `functions.invoke('me')` z `AuthService`).
    2. `SubscriptionStateService` (`applyMe`, `ensureLoaded`, `refresh`, `reset`, computed `isTrialing`, `hasActiveSubscription`).
    3. `BillingService.getPayments(limit)`.
    4. `AuthService`: wstrzyknięcie `SubscriptionStateService`/`MeApiService`, `refreshSession()`, zasilanie migawki w `bootstrapAiCredits`, `reset()` przy wylogowaniu i zmianie użytkownika. Zaktualizować `auth.service.spec.ts`.
4. **Obsługa `?next=`:**
    1. `core/utils/post-auth-redirect.util.ts` (`sanitizeNextUrl`, allowlista).
    2. `PostAuthRedirectService` (`save`, `consume`, TTL 24 h).
    3. `LoginPageComponent`: odczyt `next` przed `returnUrl`, potem `consume()`. Link „Nie masz konta? Zarejestruj się" w szablonie logowania przekazuje `next`.
    4. `RegisterPageComponent`: zapis `next` przy rejestracji e-mail i przy Google.
    5. `AuthCallbackPageComponent.handleOAuthSuccess` oraz `CompleteProfilePageComponent` (po zapisie profilu): `consume()` zamiast stałego `/dashboard`, jeśli jest bezpieczny `next`.
5. **`checkoutAccessGuard`** (`CanActivateFn`) wg tabeli z sekcji 2 wraz z `checkout-access.guard.spec.ts` (gość, `user`, `premium` trial, `premium` aktywny, `admin`, błąd `GET /me`).
6. **`CheckoutService` i mapper błędów.** `createSession`, `redirectToProvider` (allowlista hostów, `DOCUMENT`), `saveDraft`/`readDraft`/`clearDraft`, `mapCheckoutError`. Testy z mockiem `SupabaseService.functions.invoke` (statusy `400/401/403/409/429/502`, brak `context`, `Retry-After`).
7. **Utility okresu:** `pages/checkout/utils/period.util.ts` (`calculatePeriodEnd`) z testami (koniec miesiąca, rok przestępny).
8. **Komponenty prezentacyjne** w `pages/checkout/components/`: `PlanSelectorComponent`, `PaymentMethodSelectorComponent`, `CheckoutConsentsComponent`, `OrderSummaryComponent` (`.ts`, `.html`, `.scss`). `model()`/`input()`/`output()`, `a11y` wg sekcji 4, kolory z tokenów `--mat-sys-*`.
9. **`CheckoutPageComponent`.** Przebudować stub: stan signals, parsowanie `?plan=`/`?method=`, skeleton (`!subscriptionState.loaded()`), baner trialu, baner błędu, `submit()`, `retry()`, odliczanie `429`, `pageshow`. Układ 60/40 ≥960px, sticky pasek płatności <960px. Zaktualizować `checkout-page.scss`.
10. **`CheckoutSuccessPageComponent`.** Polling (`timer` + `exhaustMap` + `takeWhile`), `refreshSession()`, pobranie faktury, trzy stany, zarządzanie fokusem (nagłówek `tabindex="-1"`, przeniesienie fokusu po zmianie stanu), `role="status"`.
11. **`CheckoutCancelPageComponent`.** Komunikat, odtworzenie wyboru z draftu, linki.
12. **Trasy (`app.routes.ts`).** Grupa zalogowanych: `checkout` z `canActivate: [checkoutAccessGuard]`, `checkout/success`, `checkout/cancel`. Grupa gości: usunąć komponent z `checkout`, dodać `redirectTo` dla trzech ścieżek z zachowaniem `plan`/`method` w `next`.
13. **`/pricing`.** Plan w CTA, CTA „Kup Premium" dla trialu (z `ensureLoaded()`), FAQ o metodach płatności, stopka „brutto". Zaktualizować `pricing-page.ts/html` i testy.
14. **`/settings`.** `PaymentHistoryComponent` (tabela desktop, karty mobile, stany pusty/błąd/ładowanie) i wstawienie do `profile-settings-page.component.html` pod sekcją kredytów AI, z warunkiem `appRole() !== 'admin'`.
15. **Testy jednostkowe (Vitest):** `CheckoutPageComponent` (domyślnie roczny, walidacja zgód, mapowanie błędów, blokada wielokrotnego kliknięcia, `pageshow`), komponenty prezentacyjne, strona sukcesu (sukces, timeout, błędy `GET /me`, brak `session_id`; `fakeAsync`/fake timers), strona anulowania, `PaymentHistoryComponent`, `sanitizeNextUrl` (open redirect: `//evil.com`, `https://...`, `/checkout/../x`, `javascript:`), `SubscriptionStateService`, `PostAuthRedirectService` (TTL, zablokowany storage).
16. **Testy integracyjne:** formularz + `CheckoutService` z mockiem HTTP.
18. **Kontrola jakości:** `ng lint`, `ng build`, `ReadLints` na zmienionych plikach, ręczny przegląd a11y (klawiatura w radiogroup, focus po zmianie stanu, kontrast) i responsywności (≥960 / <960, nakładanie z Bottom Barem).
19. **Dokumentacja:** zaktualizować `docs/results/project-summary.md` (sekcje 0, 1, 5, 6: `/checkout`, `/checkout/success`, `/checkout/cancel`, karta płatności w `/settings`) oraz strukturę katalogów w `.cursor/rules/project.mdc`, jeśli doszły nowe katalogi (`pages/checkout/components`, `services`, `models`, `utils`).
20. **Przed wydaniem (poza kodem):** finalna treść `/legal/subscription`, adres `SUPPORT_EMAIL`, weryfikacja BLIK dla PLN w koncie Stripe, testy ręczne w trybie testowym Stripe (karta `4242…`, BLIK testowy, karta odrzucona, porzucenie płatności, zdublowany webhook).
