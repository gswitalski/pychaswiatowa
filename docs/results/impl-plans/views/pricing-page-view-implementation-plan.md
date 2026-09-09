# Plan implementacji widoku Strona cennika (/pricing)

## 1. Przegląd

Widok `/pricing` to publiczna strona cennika prezentująca porównanie planów **Free** i **Premium** aplikacji PychaŚwiatowa. Strona jest dostępna bez logowania i służy jako główny punkt konwersji użytkowników Free na subskrypcję Premium.

Zakres zmian obejmuje:
- **`PricingPageComponent`** — nowa strona cennika z pełną zawartością
- **`CheckoutPageComponent`** — nowy komponent stub strony płatności (MVP: „wkrótce")
- Nowe trasy: `/pricing`, `/checkout`, `/legal/subscription`
- Modyfikację **`TopbarComponent`** — dodanie linku „Cennik"
- Modyfikację **`FooterComponent`** — dodanie linków „Cennik" i „Regulamin subskrypcji"
- Modyfikację **`LandingPageComponent`** — dodanie bloku promocyjnego Premium

---

## 2. Routing widoku

Trasy `/pricing`, `/checkout` i `/legal/subscription` są **publiczne** — muszą być dodane do obu grup tras w `app.routes.ts` (analogicznie do `/explore` i `/legal/terms`):

| Ścieżka | Grupa | Layout | Guard | Komponent |
|---|---|---|---|---|
| `/pricing` | Zalogowani | `MainLayoutComponent` | brak (publiczna) | `PricingPageComponent` |
| `/pricing` | Goście | `PublicLayoutComponent` | brak (publiczna) | `PricingPageComponent` |
| `/checkout` | Zalogowani | `MainLayoutComponent` | brak | `CheckoutPageComponent` |
| `/checkout` | Goście | `PublicLayoutComponent` | brak | `CheckoutPageComponent` |
| `/legal/subscription` | Zalogowani | `MainLayoutComponent` | brak | `LegalPageComponent` |
| `/legal/subscription` | Goście | `PublicLayoutComponent` | brak | `LegalPageComponent` |

Trasa `/legal/subscription` reużywa istniejącego `LegalPageComponent` z danymi trasy `{ page: 'subscription', title: 'Regulamin subskrypcji' }`. Wymaga poszerzenia unii `LegalPageId` o wartość `'subscription'`.

Lazy loading dla wszystkich nowych tras (wzorzec `loadComponent`).

---

## 3. Struktura komponentów

```
PricingPageComponent                          ← src/app/pages/pricing/
├─ PricingHeroComponent                       ← pricing/components/pricing-hero/
├─ PricingBillingToggleComponent              ← pricing/components/pricing-billing-toggle/
├─ PricingPlanCardComponent × 2              ← pricing/components/pricing-plan-card/
│   (karta Free + karta Premium)
├─ PricingComparisonTableComponent            ← pricing/components/pricing-comparison-table/
├─ PricingFaqComponent                        ← pricing/components/pricing-faq/
└─ PricingFooterLinksComponent                ← pricing/components/pricing-footer-links/

CheckoutPageComponent                         ← src/app/pages/checkout/
```

**Modyfikacje istniejących komponentów:**
- `TopbarComponent` — dodanie linku „Cennik" (widoczny dla gości i roli `user`)
- `FooterComponent` — dodanie wpisów „Cennik" i „Regulamin subskrypcji"
- `LandingPageComponent` — dodanie bloku promo Premium

---

## 4. Szczegóły komponentów

### `PricingPageComponent`

- **Opis:** Główny komponent-kontener strony `/pricing`. Orkiestruje stan wyboru okresu rozliczeniowego i dostarcza dane do komponentów potomnych. Odczytuje stan sesji z `AuthService` i oblicza ViewModel dla kart planów.
- **Główne elementy:**
  - `<section class="pricing-hero">` — komponent `PricingHeroComponent`
  - `<section class="pricing-toggle">` — komponent `PricingBillingToggleComponent`
  - `<section class="pricing-cards">` — dwa `PricingPlanCardComponent`
  - `<section class="pricing-comparison">` — `PricingComparisonTableComponent`
  - `<section class="pricing-faq">` — `PricingFaqComponent`
  - `<section class="pricing-footer-links">` — `PricingFooterLinksComponent`
- **Obsługiwane zdarzenia:**
  - `billingPeriodChange` emitowane przez `PricingBillingToggleComponent` — aktualizuje sygnał `billingPeriod`
- **Walidacja:** brak (strona statyczna, bez formularzy)
- **Typy:** `BillingPeriod`, `PlanCardViewModel`, `AppRole`
- **Propsy:** brak (komponent-strona, nie przyjmuje `@Input`)

---

### `PricingHeroComponent`

- **Opis:** Prosta sekcja nagłówkowa strony. Zawiera główny tytuł H1 i podtytuł. Brak logiki — komponent czysto prezentacyjny.
- **Główne elementy:**
  - `<h1>Wybierz plan dla siebie</h1>`
  - `<p class="pricing-hero__subtitle">Prowadź swoją cyfrową książkę kucharską — bezpłatnie lub z Premium.</p>`
- **Obsługiwane zdarzenia:** brak
- **Walidacja:** brak
- **Typy:** brak
- **Propsy:** brak

---

### `PricingBillingToggleComponent`

- **Opis:** Komponent przełącznika okresu rozliczeniowego (miesięczny / roczny). Wyświetla `mat-button-toggle-group` z dwoma opcjami. Przy wyborze „Rocznie" pokazuje chip `mat-chip` z komunikatem „Oszczędzasz ~17%". Emituje zdarzenie zmiany do rodzica.
- **Główne elementy:**
  - `<mat-button-toggle-group>` z opcjami: `'monthly'` i `'yearly'`
  - `<mat-chip>` z tekstem „Oszczędzasz ~17%" (widoczny tylko gdy `value === 'yearly'`)
- **Obsługiwane zdarzenia:**
  - `(change)` na `mat-button-toggle-group` — emituje `billingPeriodChange: EventEmitter<BillingPeriod>`
- **Walidacja:** brak
- **Typy:** `BillingPeriod`
- **Propsy:**
  - `value: InputSignal<BillingPeriod>` — aktualnie wybrany okres (przekazywany z rodzica)
  - `savingsPercent: InputSignal<number>` — procent oszczędności do wyświetlenia w chipie

---

### `PricingPlanCardComponent`

- **Opis:** Reużywalny komponent karty planu. Wyświetla nazwę planu, cenę, listę korzyści i przycisk CTA. Karta Premium jest wizualnie wyróżniona (obramowanie `primary`, chip „Rekomendowany"). Stan przycisku CTA (etykieta, link, dostępność) jest w całości determinowany przez `PlanCardViewModel` przekazany z rodzica — komponent nie zna logiki biznesowej ról.
- **Główne elementy:**
  - `<mat-card>` z klasą warunkową `pricing-plan-card--highlighted` dla planu Premium
  - `<mat-chip>` „Rekomendowany" (tylko Premium)
  - Sekcja ceny: cena główna, przekreślona cena alternatywna, przeliczenie na miesiąc (tylko roczny Premium)
  - `<mat-chip>` „7 dni bezpłatnego trialu" (tylko Premium)
  - Lista korzyści z ikonkami `mat-icon` (`check_circle` / `remove`)
  - `<button mat-raised-button>` CTA (lub `mat-stroked-button` dla „Twój aktualny plan")
- **Obsługiwane zdarzenia:**
  - `(click)` na CTA — router.navigate do `viewModel.ctaRoute` (gdy `!viewModel.ctaDisabled`)
- **Walidacja:**
  - Przycisk CTA jest `[disabled]` gdy `viewModel.ctaDisabled === true`
- **Typy:** `PlanCardViewModel`
- **Propsy:**
  - `planCard: InputSignal<PlanCardViewModel>` — kompletny ViewModel karty

---

### `PricingComparisonTableComponent`

- **Opis:** Tabela porównawcza funkcji planów. Na desktopie (≥960px) renderuje natywną tabelę `<table>` ze stylowaniem Material. Na mobile/tablecie (<960px) wyświetla `mat-accordion` z `mat-expansion-panel` pogrupowanymi według kategorii. Decyzja o trybie wyświetlania pochodzi z sygnału `LayoutService.isMobileOrTablet`. Komponent czysto prezentacyjny — dane przekazywane przez `@Input`.
- **Główne elementy (desktop):** `<table>` z kolumnami: Funkcja, Free, Premium. Ikony: `check_circle` (dostępne, kolor `primary`), `remove` (niedostępne, szary), chip „Wkrótce" (kolor `accent`).
- **Główne elementy (mobile):** `<mat-accordion>` → `<mat-expansion-panel>` per kategoria → wiersze cech.
- **Obsługiwane zdarzenia:** brak
- **Walidacja:** brak
- **Typy:** `ComparisonCategory`, `ComparisonFeature`
- **Propsy:**
  - `categories: InputSignal<ComparisonCategory[]>` — dane porównania pogrupowane wg kategorii

---

### `PricingFaqComponent`

- **Opis:** Sekcja FAQ w formie akordeonu. Zawiera stałą listę pytań i odpowiedzi — dane zdefiniowane w samym komponencie (hardcoded). Komponent czysto prezentacyjny.
- **Główne elementy:**
  - `<mat-accordion>` z `<mat-expansion-panel>` per pytanie
  - `<mat-expansion-panel-header>` z `<mat-panel-title>`
- **Obsługiwane zdarzenia:** brak (Angular Material obsługuje otwieranie/zamykanie)
- **Walidacja:** brak
- **Typy:** `FaqItem`
- **Propsy:** brak (dane hardcoded wewnątrz komponentu)

---

### `PricingFooterLinksComponent`

- **Opis:** Mała sekcja pod FAQ z informacją prawną i linkami do dokumentów. Komponent czysto prezentacyjny.
- **Główne elementy:**
  - `<p>` z tekstem „Ceny orientacyjne, netto PLN B2C. Zmiana cen możliwa przed startem sprzedaży."
  - Linki `<a routerLink>` do: `/legal/subscription`, `/legal/terms`, `/legal/privacy`
- **Obsługiwane zdarzenia:** brak
- **Walidacja:** brak
- **Typy:** brak
- **Propsy:** brak

---

### `CheckoutPageComponent`

- **Opis:** Stub strony płatności — MVP. Wyświetla komunikat o niedostępności płatności i przycisk powrotu do `/pricing`. Żadnych wywołań API.
- **Główne elementy:**
  - Nagłówek `<h1>` — „Płatności wkrótce"
  - Krótki opis
  - Przycisk „Wróć do cennika" z `routerLink="/pricing"`
- **Obsługiwane zdarzenia:** klik przycisku — nawigacja przez `routerLink`
- **Walidacja:** brak
- **Typy:** brak
- **Propsy:** brak

---

### Modyfikacja `TopbarComponent`

- **Opis:** Dodanie linku „Cennik" po prawej stronie topbara — widoczny wyłącznie dla gości i użytkowników z rolą `user`. Ukryty dla `premium` i `admin`.
- **Zmiana:** Dodanie sygnału `showPricingLink`:
  ```typescript
  readonly showPricingLink = computed(
      () => !this.authService.isAuthenticated() || this.authService.appRole() === 'user'
  );
  ```
- **Element HTML:** `<a mat-button routerLink="/pricing" *ngIf="showPricingLink()">Cennik</a>` (lub `@if` w szablonie)

---

### Modyfikacja `FooterComponent`

- **Opis:** Dodanie wpisów „Cennik" i „Regulamin subskrypcji" do tablicy `legalLinks`.
- **Zmiana:** Dwa nowe obiekty w tablicy:
  - `{ label: 'Cennik', path: '/pricing' }`
  - `{ label: 'Regulamin subskrypcji', path: '/legal/subscription' }`

---

### Modyfikacja `LandingPageComponent`

- **Opis:** Dodanie bloku promocyjnego Premium na dole strony (przed stopką). Widoczny dla gości i roli `user`, ukryty dla `premium` i `admin`.
- **Zmiana:** Nowy sygnał `showPremiumPromo` obliczony analogicznie jak `showPricingLink` w topbarze. Nowy blok HTML:
  - Nagłówek „Więcej z Premium"
  - 3–4 bullet pointy z korzyściami Premium
  - `<button mat-raised-button routerLink="/pricing">Zobacz plany</button>`

---

## 5. Typy

Wszystkie poniższe typy definiowane lokalnie w katalogu `src/app/pages/pricing/models/pricing.models.ts`.

### `BillingPeriod`

```typescript
export type BillingPeriod = 'monthly' | 'yearly';
```

Wartość sygnału okresu rozliczeniowego. Domyślnie `'yearly'`.

---

### `PlanCardViewModel`

```typescript
export interface PlanCardViewModel {
    /** Identyfikator planu (np. 'free', 'premium') */
    id: string;
    /** Wyświetlana nazwa planu */
    name: string;
    /** Wyświetlana cena — formatowana już jako string, np. "24 zł / mies." lub "0 zł" */
    priceLabel: string;
    /** Opcjonalny drugi wiersz ceny (np. przeliczenie rocznej na miesięczną) */
    priceSubLabel?: string;
    /** Opcjonalna przekreślona cena (np. przy toggle na roczny Premium) */
    priceStrikethrough?: string;
    /** Czy wyświetlać chip "Rekomendowany" */
    isRecommended: boolean;
    /** Czy wyświetlać chip trialu */
    showTrialChip: boolean;
    /** Etykieta przycisku CTA */
    ctaLabel: string;
    /** Trasa docelowa CTA (null jeśli CTA jest disabled) */
    ctaRoute: string | null;
    /** Czy przycisk CTA jest nieaktywny */
    ctaDisabled: boolean;
    /** Styl przycisku CTA: 'primary' dla Premium, 'stroked' dla "Twój plan" */
    ctaVariant: 'primary' | 'stroked';
    /** Lista korzyści planu */
    features: PlanFeatureLine[];
}
```

### `PlanFeatureLine`

```typescript
export interface PlanFeatureLine {
    /** Tekst opisu funkcji */
    label: string;
    /** Czy funkcja jest dostępna w tym planie */
    available: boolean;
    /** Czy oznaczyć chipem "Wkrótce" */
    comingSoon?: boolean;
}
```

### `ComparisonCategory`

```typescript
export interface ComparisonCategory {
    /** Nagłówek kategorii, np. "AI i import" */
    title: string;
    /** Lista funkcji w kategorii */
    features: ComparisonFeature[];
}
```

### `ComparisonFeature`

```typescript
export interface ComparisonFeature {
    /** Nazwa funkcji */
    label: string;
    /** Wartość / opis dla planu Free (np. "✓", "—", "7 pozycji") */
    freeValue: FeatureValue;
    /** Wartość / opis dla planu Premium */
    premiumValue: FeatureValue;
}

export type FeatureValue =
    | { type: 'check' }             // mat-icon check_circle
    | { type: 'dash' }              // mat-icon remove
    | { type: 'text'; text: string } // dowolny tekst
    | { type: 'coming-soon'; text?: string }; // chip "Wkrótce"
```

### `FaqItem`

```typescript
export interface FaqItem {
    question: string;
    answer: string;
}
```

---

## 6. Zarządzanie stanem

Strona nie wymaga dedykowanego serwisu ani NgRx. Cały stan zarządzany jest **sygnałami w `PricingPageComponent`**.

### Sygnały w `PricingPageComponent`

```typescript
// Wybrany okres rozliczeniowy — domyślnie roczny (zgodnie z PRD: roczny rekomendowany)
readonly billingPeriod = signal<BillingPeriod>('yearly');

// Stan sesji — pobierany ze wstrzykniętego AuthService
readonly isAuthenticated = this.authService.isAuthenticated;
readonly appRole = this.authService.appRole;
```

### Sygnały pochodne (computed)

```typescript
// ViewModel karty Free — obliczany na podstawie appRole
readonly freePlanCard = computed<PlanCardViewModel>(() =>
    this.buildFreePlanCard(this.appRole())
);

// ViewModel karty Premium — obliczany na podstawie billingPeriod + appRole
readonly premiumPlanCard = computed<PlanCardViewModel>(() =>
    this.buildPremiumPlanCard(this.billingPeriod(), this.appRole(), this.isAuthenticated())
);
```

Prywatne metody `buildFreePlanCard` i `buildPremiumPlanCard` zawierają logikę mapowania `AppRole` → `PlanCardViewModel` (etykieta CTA, stan disabled, trasa). Dane cenowe pobierane są ze stałej `PRICING_CONFIG`.

### Brak loadingu sesji

`AuthService.initAuthState()` jest wywoływane w `APP_INITIALIZER`, więc przy wejściu na `/pricing` sygnały `isAuthenticated` i `appRole` są już zainicjalizowane. Skeleton loader / spinner na kartach jest opcjonalny — można pominąć w MVP, jeśli inicjalizacja auth jest synchroniczna w praktyce.

---

## 7. Integracja API

**Strona `/pricing` nie wywołuje żadnego endpointu API w MVP.** Wszelkie dane cenowe i konfiguracyjne pochodzą ze stałej `PRICING_CONFIG` zdefiniowanej w `src/app/pages/pricing/pricing.config.ts`.

Stan uwierzytelnienia (`isAuthenticated`, `appRole`) odczytywany jest bezpośrednio z sygnałów `AuthService`, który był inicjalizowany przy starcie aplikacji.

`CheckoutPageComponent` również nie wywołuje API w MVP.

> **Przyszłość:** Po wdrożeniu backendu płatności stałą `PRICING_CONFIG` należy zastąpić wywołaniem `GET /pricing/plans` (lub analogicznym endpointem), zwracającym `PricingPlansResponseDto`.

---

## 8. Interakcje użytkownika

| Interakcja | Komponent | Rezultat |
|---|---|---|
| Klik „Miesięcznie" w toggle | `PricingBillingToggleComponent` | Sygnał `billingPeriod` → `'monthly'`; ceny w kartach i tabeli aktualizują się reaktywnie |
| Klik „Rocznie" w toggle | `PricingBillingToggleComponent` | Sygnał `billingPeriod` → `'yearly'`; chip oszczędności widoczny |
| Klik CTA „Zacznij za darmo" (gość) | `PricingPlanCardComponent` | Nawigacja do `/register` |
| Klik CTA „Wybierz Premium" (gość) | `PricingPlanCardComponent` | Nawigacja do `/register?next=/checkout` |
| Klik CTA „Wybierz Premium" (zalogowany `user`) | `PricingPlanCardComponent` | Nawigacja do `/checkout` |
| Klik CTA „Twój aktualny plan" (zalogowany `user` — Free) | `PricingPlanCardComponent` | Brak akcji (przycisk `disabled`) |
| Klik CTA „Twój aktualny plan" (zalogowany `premium`) | `PricingPlanCardComponent` | Brak akcji (przycisk `disabled`) |
| Klik CTA (zalogowany `admin`) | `PricingPlanCardComponent` | Brak CTA zakupu (karta pokazuje neutralny stan) |
| Klik panelu FAQ | `PricingFaqComponent` | Angular Material accordion rozszerza/zwija panel |
| Klik „Regulamin subskrypcji" | `PricingFooterLinksComponent` | Nawigacja do `/legal/subscription` |
| Klik „Cennik" w Topbarze | `TopbarComponent` | Nawigacja do `/pricing` |
| Klik „Zobacz plany" na Landing Page | `LandingPageComponent` | Nawigacja do `/pricing` |
| Klik „Wróć do cennika" na `/checkout` | `CheckoutPageComponent` | Nawigacja do `/pricing` |

---

## 9. Warunki i walidacja

Strona cennika nie zawiera formularzy. Warunki dotyczą wyłącznie **warunkowego renderowania i stanu przycisków CTA** w oparciu o `appRole`.

### Macierz warunków CTA

| Stan użytkownika | Karta Free — CTA | Karta Premium — CTA |
|---|---|---|
| Gość (niezalogowany) | „Zacznij za darmo" → `/register` (aktywny) | „Wybierz Premium" → `/register?next=/checkout` (aktywny) |
| Zalogowany, rola `user` | „Twój aktualny plan" (disabled, stroked) | „Wybierz Premium" → `/checkout` (aktywny, primary) |
| Zalogowany, rola `premium` | „Zmień plan" (disabled, stroked) | „Twój aktualny plan" (disabled, stroked) |
| Zalogowany, rola `admin` | „–" (brak CTA lub tylko link do ustawień) | „–" (brak CTA zakupu) |

### Link „Cennik" w Topbarze

Warunek widoczności: `!isAuthenticated() || appRole() === 'user'`.
- Gość: widoczny
- `user`: widoczny
- `premium`: ukryty
- `admin`: ukryty

### Blok promo Premium na Landing Page

Warunek widoczności: `!isAuthenticated() || appRole() === 'user'` (analogiczny).

### Zmiana `LegalPageId`

Plik `legal-page.component.ts` zawiera typ `LegalPageId = 'terms' | 'privacy' | 'publisher'`. Należy rozszerzyć o `'subscription'`.

---

## 10. Obsługa błędów

Strona cennika jest statyczna — nie ma wywołań API, które mogłyby zakończyć się błędem. Jednak należy uwzględnić scenariusze brzegowe:

| Scenariusz | Obsługa |
|---|---|
| `AuthService` nie zainicjalizowany (rzadki race condition) | Sygnały `isAuthenticated` i `appRole` mają bezpieczne wartości domyślne (`false` i `'user'`). CTA zachowa się jak dla gościa / `user` — bezpieczne. |
| Bezpośrednie wejście na `/checkout` przez gościa | Stub `CheckoutPageComponent` wyświetla komunikat bez wywołań API — brak błędu. Docelowo dodać guard autoryzacyjny przy wdrożeniu płatności. |
| Brakujący plik `src/assets/legal/subscription-terms.md` | `LegalMarkdownViewerComponent` wyświetli pusty obszar lub błąd ngx-markdown — należy stworzyć plik placeholdera przed wdrożeniem trasy `/legal/subscription`. |
| Nawigacja CTA z parametrem `?next=/checkout` | Angular `Router.navigate` z `queryParams: { next: '/checkout' }`. Strona `/register` musi odczytywać `queryParams['next']` i po rejestracji przekierować na tę ścieżkę. Sprawdzić istniejącą implementację `RegisterPageComponent`. |

---

## 11. Kroki implementacji

1. **Utwórz plik konfiguracyjny cen**
   - Dodaj `src/app/pages/pricing/pricing.config.ts` z eksportowaną stałą `PRICING_CONFIG` (treść zgodna z sekcją 4 planu UI).

2. **Utwórz modele i typy**
   - Dodaj `src/app/pages/pricing/models/pricing.models.ts` z typami: `BillingPeriod`, `PlanCardViewModel`, `PlanFeatureLine`, `ComparisonCategory`, `ComparisonFeature`, `FeatureValue`, `FaqItem`.

3. **Utwórz `PricingHeroComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-hero/`
   - Standalone, `ChangeDetectionStrategy.OnPush`, selektor `pych-pricing-hero`.
   - Prosty szablon HTML (H1 + podtytuł), Sass.

4. **Utwórz `PricingBillingToggleComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-billing-toggle/`
   - Importy: `MatButtonToggleModule`, `MatChipsModule`.
   - Input: `value: InputSignal<BillingPeriod>`, `savingsPercent: InputSignal<number>`.
   - Output: `billingPeriodChange: OutputEmitterRef<BillingPeriod>` (Angular 17+ `output()`).

5. **Utwórz `PricingPlanCardComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-plan-card/`
   - Importy: `MatCardModule`, `MatButtonModule`, `MatChipsModule`, `MatIconModule`, `RouterLink`.
   - Input: `planCard: InputSignal<PlanCardViewModel>`.
   - Obsługa CTA: `@if (!planCard().ctaDisabled)` — `routerLink` do `planCard().ctaRoute`.

6. **Utwórz `PricingComparisonTableComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-comparison-table/`
   - Importy: `MatTableModule`, `MatIconModule`, `MatChipsModule`, `MatExpansionModule`, `LayoutService` (do sygnału `isMobileOrTablet`).
   - Input: `categories: InputSignal<ComparisonCategory[]>`.
   - Szablon: `@if (isMobileOrTablet())` → accordion, `@else` → tabela.

7. **Utwórz `PricingFaqComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-faq/`
   - Importy: `MatExpansionModule`.
   - Dane FAQ hardcoded w komponencie jako `readonly faqItems: FaqItem[]`.

8. **Utwórz `PricingFooterLinksComponent`**
   - Katalog: `src/app/pages/pricing/components/pricing-footer-links/`
   - Importy: `RouterLink`.
   - Prosty szablon z paragrafem i trzema linkami.

9. **Utwórz `PricingPageComponent`**
   - Plik: `src/app/pages/pricing/pricing-page.component.ts`
   - Wstrzyknij: `AuthService`.
   - Sygnały: `billingPeriod`, `freePlanCard` (computed), `premiumPlanCard` (computed).
   - Dane tabeli porównawczej: zdefiniuj `comparisonCategories: ComparisonCategory[]` jako stałą wewnętrzną (na podstawie sekcji 3.4 planu UI).
   - Metoda `onBillingPeriodChange(period: BillingPeriod): void` — aktualizuje `billingPeriod`.
   - Importuj wszystkie komponenty potomne.

10. **Utwórz `CheckoutPageComponent`**
    - Plik: `src/app/pages/checkout/checkout-page.component.ts`
    - Prosta strona stub z komunikatem „Płatności wkrótce" i przyciskiem powrotu.
    - Importy: `MatButtonModule`, `RouterLink`.

11. **Utwórz plik placeholdera `/legal/subscription`**
    - Dodaj `src/assets/legal/subscription-terms.md` z tymczasową treścią (np. „Regulamin subskrypcji — treść wkrótce").
    - Rozszerz typ `LegalPageId` w `legal-page.component.ts` o `'subscription'`.

12. **Zarejestruj nowe trasy w `app.routes.ts`**
    - W grupie `MainLayoutComponent` (zalogowani): dodaj `/pricing`, `/checkout`, `/legal/subscription`.
    - W grupie `PublicLayoutComponent` (goście): dodaj te same trasy.
    - Wzorzec `loadComponent` z lazy loading dla `PricingPageComponent` i `CheckoutPageComponent`.
    - Dla `/legal/subscription`: `loadComponent` → `LegalPageComponent`, `data: { page: 'subscription', title: 'Regulamin subskrypcji' }`.

13. **Zmodyfikuj `TopbarComponent`**
    - Dodaj sygnał `showPricingLink = computed(...)` oparty na `isAuthenticated` i `appRole`.
    - W szablonie dodaj link `pych-topbar` z `@if (showPricingLink())` przed sekcją login/avatar.

14. **Zmodyfikuj `FooterComponent`**
    - Dodaj dwa wpisy do tablicy `legalLinks`: `{ label: 'Cennik', path: '/pricing' }` i `{ label: 'Regulamin subskrypcji', path: '/legal/subscription' }`.

15. **Zmodyfikuj `LandingPageComponent`**
    - Dodaj sygnał `showPremiumPromo = computed(...)`.
    - Dodaj blok HTML z sekcją promocyjną Premium (nagłówek + bullet pointy + CTA).
    - Dodaj `RouterLink` do importów komponentu.

16. **Dodaj style Sass**
    - `pricing-page.component.scss`: layout `max-width: 1200px`, wyśrodkowanie, tła sekcji naprzemienne (`--mat-sys-background` / `--mat-sys-surface-variant`).
    - `pricing-plan-card.component.scss`: modyfikator `--highlighted` (obramowanie `--mat-sys-primary`), układ 2-kolumnowy vs 1-kolumnowy przez `@media`.
    - `pricing-comparison-table.component.scss`: style tabeli.
    - Responsywność: breakpoint `960px` dla zmian układu (2 kolumny kart → 1 kolumna, tabela → accordion).

17. **Weryfikacja dostępności (a11y)**
    - Dodaj `aria-label` do wszystkich `mat-icon` bez towarzyszącego tekstu.
    - Sprawdź hierarchię nagłówków: `<h1>` w Hero, `<h2>` w sekcjach, `<h3>` w `mat-expansion-panel-title`.
    - Upewnij się, że disabled CTA ma atrybut `aria-disabled="true"` i nie jest focusable klawiaturą.
    - Zweryfikuj kontrast kolorów chipów „Wkrótce" i „Rekomendowany" (WCAG AA).
