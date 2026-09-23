# PS-63: Strona cennika (/pricing) — Plan UI

> **User Story:** PS-63 — Strona cennika z ofertą Premium
> **Data:** wrzesień 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `PricingPageComponent` | Nowy komponent (strona) | `src/app/pages/pricing/` |
| `CheckoutPageComponent` | Nowy komponent stub (strona) | `src/app/pages/checkout/` |
| Trasa `/pricing` | Nowa trasa publiczna | `app.routes.ts` |
| Trasa `/checkout` | Nowa trasa publiczna (stub) | `app.routes.ts` |
| Trasa `/legal/subscription` | Nowa trasa publiczna (legal) | `app.routes.ts` |
| `pricing.config.ts` | Nowy plik konfiguracyjny | `src/app/pages/pricing/` |
| Topbar | Modyfikacja — dodanie linku „Cennik" | `src/app/layout/` |
| Footer | Modyfikacja — dodanie linków | `src/app/layout/` |
| Landing page (`/`) | Modyfikacja — dodanie CTA | `src/app/pages/home/` |

---

## 2. Nowe trasy

### `/pricing` — Strona cennika

| Atrybut | Wartość |
|---|---|
| Ścieżka | `/pricing` |
| Dostęp | Publiczny (bez AuthGuard) |
| Komponent | `PricingPageComponent` |
| Lazy loading | Tak |
| Layout | App Shell (Topbar + Footer), **bez Sidebara** |

### `/checkout` — Stub strony płatności

| Atrybut | Wartość |
|---|---|
| Ścieżka | `/checkout` |
| Dostęp | Publiczny (bez AuthGuard) |
| Komponent | `CheckoutPageComponent` |
| Lazy loading | Tak |
| Layout | App Shell (Topbar + Footer), bez Sidebara |
| Uwaga | MVP: placeholder „Wkrótce" — docelowo zastąpiony integracją z operatorem płatności |

### `/legal/subscription` — Regulamin subskrypcji

| Atrybut | Wartość |
|---|---|
| Ścieżka | `/legal/subscription` |
| Dostęp | Publiczny |
| Komponent | Reuse istniejącego `LegalPageComponent` (analogicznie jak `/legal/terms`) |
| Źródło treści | `src/assets/legal/subscription-terms.md` |
| Uwaga | MVP: plik Markdown z placeholderem treści |

---

## 3. Struktura PricingPageComponent

### Układ ogólny

```
<app-topbar>
<main class="pricing-page">
    <section class="pricing-hero">
    <section class="pricing-toggle">
    <section class="pricing-cards">
    <section class="pricing-comparison">
    <section class="pricing-faq">
    <section class="pricing-footer-links">
</main>
<app-footer>
```

Strona jest wycentrowana horyzontalnie z `max-width: 1200px`. Tło sekcji naprzemiennie neutralne / lekki akcent (Angular Material `surface` / `surface-variant`).

---

### 3.1. Sekcja Hero

**Cel:** jednoznaczny komunikat wartości, niski bounce rate.

```
[H1] Wybierz plan dla siebie
[H2/subtitle] Prowadź swoją cyfrową książkę kucharską — bezpłatnie lub z Premium.
```

- Wyrównanie: wycentrowane
- Bez zdjęcia tła ani ilustracji w MVP

---

### 3.2. Toggle okresu rozliczeniowego

**Komponent Angular Material:** `mat-button-toggle-group`

| Stan | Opcje |
|---|---|
| Domyślny | **Rocznie** (aktywne) |
| Opcje | `Miesięcznie` \| `Rocznie` |

Przy opcji „Rocznie" wyświetlany jest chip `mat-chip` z tekstem **„Oszczędzasz ~17%"** (kolor `accent` / secondary).

Zmiana togglea aktualizuje ceny w kartach i tabeli **reaktywnie** (Angular signals lub `BehaviorSubject`). Brak przeładowania strony.

---

### 3.3. Karty planów

**Układ:** 2 kolumny na desktop (≥960px), 1 kolumna na mobile/tablet (<960px).

Obie karty są komponentem `mat-card`. Karta Premium jest wyróżniona:
- obramowanie kolorem `primary` (Angular Material theme)
- badge `mat-badge` lub `mat-chip` z tekstem **„Rekomendowany"**

#### Karta Free

| Element | Wartość |
|---|---|
| Nazwa planu | Free |
| Cena | 0 zł / zawsze |
| Podtytuł | Pełna prywatna książka kucharska |
| Lista korzyści | patrz sekcja 4 — Benefity |
| CTA | „Zacznij za darmo" → `/register` |
| Uwaga | CTA zmienia się na „Twój aktualny plan" gdy `app_role === 'user'` (użytkownik już zalogowany i na Free); brak CTA dla `premium` i `admin` |

#### Karta Premium

| Element | Wartość |
|---|---|
| Nazwa planu | Premium |
| Cena (miesięcznie, toggle) | **24 zł / mies.** *(wartość z `pricing.config.ts`)* |
| Cena (rocznie, toggle, domyślnie) | **169 zł / rok** (~14,08 zł / mies.) |
| Wyróżnienie ceny rocznej | Przekreślona cena miesięczna, przeliczona na miesiąc |
| Trial | Chip: „7 dni bezpłatnego trialu" |
| Lista korzyści | patrz sekcja 4 — Benefity |
| CTA (niezalogowany) | „Wybierz Premium" → `/register?next=/checkout` |
| CTA (zalogowany Free) | „Wybierz Premium" → `/checkout` |
| CTA (zalogowany Premium) | „Twój aktualny plan" (disabled, kolor success) |
| CTA (admin) | brak (lub „Zarządzaj kontem" → `/settings`) |

> Logika CTA opiera się na wartości `app_role` z serwisu sesji (dostępny globalnie przez `AuthService`). Nie wymaga nowego zapytania API.

---

### 3.4. Tabela porównawcza

**Desktop (≥960px):** pełna tabela (`mat-table` lub natywny `<table>` ze stylowaniem Material).

**Mobile/tablet (<960px):** tabela zastąpiona sekcjami `mat-expansion-panel` pogrupowanymi według kategorii.

#### Kolumny tabeli

| Kolumna | Opis |
|---|---|
| Funkcja | Nazwa funkcji / limitu |
| Free | Dostępność / wartość dla Free |
| Premium | Dostępność / wartość dla Premium |

#### Kategorie wierszy

**AI i import**

| Funkcja | Free | Premium |
|---|---|---|
| Asysta AI (draft przepisu z tekstu) | 1–3 importy lifetime | Miesięczna pula kredytów |
| Import ze zdjęcia / skanu | — | ✓ (Wkrótce) |
| Import z URL | — | ✓ (Wkrótce) |
| Generowanie zdjęcia AI | — | ✓ (z puli kredytów) |

**Przepisy i organizacja**

| Funkcja | Free | Premium |
|---|---|---|
| Przepisy | Bez limitu | Bez limitu |
| Kolekcje i tagi | ✓ | ✓ |
| Import z Markdown | ✓ | ✓ |
| Upload zdjęcia własnego | ✓ | ✓ (wyższy limit przestrzeni) |

**Plan i zakupy**

| Funkcja | Free | Premium |
|---|---|---|
| Mój plan (limit pozycji) | 7 pozycji | 50 pozycji |
| Lista zakupów (podstawowa) | ✓ | ✓ |
| Zaawansowane scalanie jednostek | — | ✓ (Wkrótce) |
| Planer tygodniowy | — | ✓ (Wkrótce) |
| Konto rodzinne | — | ✓ (Wkrótce) |

**Komfort i reklamy**

| Funkcja | Free | Premium |
|---|---|---|
| Reklamy w katalogu | Tak (po starcie reklam) | Brak reklam |
| Priorytet jobów AI | Standardowy | Podwyższony |

#### Ikony w tabeli

- ✓ (dostępne) → `mat-icon`: `check_circle` (kolor `primary`)
- — (niedostępne) → `mat-icon`: `remove` (kolor `outline`/szary)
- chip **„Wkrótce"** → `mat-chip` z kolorem `accent` przy funkcjach planowanych

---

### 3.5. Sekcja FAQ

**Komponent:** `mat-accordion` z `mat-expansion-panel`.

Pytania w MVP:

1. **Jak działa 7-dniowy trial?**
   Przez 7 dni od rejestracji konta Premium masz pełny dostęp do funkcji Premium. Trial aktywuje się automatycznie — nie wymagamy danych karty z góry *(do weryfikacji z modelem checkout)*.

2. **Co się dzieje po zakończeniu trialu?**
   Jeśli nie subskrybujesz, konto wraca do planu Free. Twoje przepisy i dane są bezpieczne — nie usuwamy żadnych danych.

3. **Czy mogę anulować subskrypcję w dowolnym momencie?**
   Tak. Możesz anulować w ustawieniach konta w dowolnej chwili. Dostęp do Premium obowiązuje do końca opłaconego okresu.

4. **Jakie metody płatności są dostępne?**
   BLIK, karta płatnicza oraz przelewy *(szczegóły po wdrożeniu checkout)*.

5. **Czy mogę zmienić plan z miesięcznego na roczny?**
   Tak — w ustawieniach konta, ze zmianą od następnego okresu rozliczeniowego.

---

### 3.6. Footer sekcji (linki prawne)

Wyświetlany pod FAQ, wyśrodkowany:

```
Ceny orientacyjne, netto PLN B2C. Zmiana cen możliwa przed startem sprzedaży.
[Regulamin subskrypcji] · [Regulamin] · [Polityka prywatności]
```

Linki do: `/legal/subscription`, `/legal/terms`, `/legal/privacy`.

---

## 4. Plik konfiguracyjny `pricing.config.ts`

Ścieżka: `src/app/pages/pricing/pricing.config.ts`

```typescript
// TODO: Po wdrożeniu checkout zastąpić wywołaniem GET /pricing/plans
export const PRICING_CONFIG = {
    trial: {
        days: 7,
    },
    plans: {
        free: {
            id: 'free',
            name: 'Free',
            priceMonthly: 0,
            priceYearly: 0,
        },
        premium: {
            id: 'premium',
            name: 'Premium',
            priceMonthly: 2400,       // grosze PLN → 24,00 zł
            priceYearly: 16900,       // grosze PLN → 169,00 zł
            priceYearlyMonthly: 1408, // grosze PLN → 14,08 zł/mies.
            savingsPercent: 17,       // ~17% taniej niż miesięczny x12
        },
    },
    limits: {
        free: {
            planItems: 7,
            aiImportsLifetime: 3,
        },
        premium: {
            planItems: 50,
        },
    },
} as const;
```

---

## 5. Stub CheckoutPageComponent

Ścieżka: `src/app/pages/checkout/checkout-page.component.ts`

**Zawartość MVP:**
- Nagłówek: „Płatności wkrótce"
- Krótki opis: „Pracujemy nad integracją płatności. Zostaw swój adres e-mail, a powiadomimy Cię jako pierwszego."
- Pole e-mail + przycisk „Powiadom mnie" (opcjonalnie: Typeform embed lub prosty formularz zapisujący do listy — poza zakresem PS-63)
- Przycisk „Wróć do cennika" → `/pricing`

> Komponent nie wywołuje żadnego API w MVP.

---

## 6. Modyfikacje istniejących komponentów

### Topbar (`src/app/layout/topbar/`)

Dodanie linku **„Cennik"** prowadzącego do `/pricing`:
- Widoczny dla gości (niezalogowanych)
- Widoczny dla zalogowanych użytkowników z rolą `user`
- **Ukryty** dla roli `premium` (mają już subskrypcję) i `admin`
- Pozycja: prawa strona Topbara, przed przyciskiem „Zaloguj się" / avatarem użytkownika

### Footer (`src/app/layout/footer/`)

Dodanie w stopce dwóch nowych linków:
- „**Cennik**" → `/pricing`
- „**Regulamin subskrypcji**" → `/legal/subscription`

Linki dodane do istniejącej sekcji linków prawnych (obok Regulaminu i Polityki prywatności).

### Landing Page (`/`, `src/app/pages/home/`)

Dodanie sekcji/bloku promującego Premium na dole strony (nad stopką):
- Nagłówek: „Więcej z Premium"
- Krótki opis korzyści (3–4 bullet pointy)
- CTA: `mat-raised-button` — „**Zobacz plany**" → `/pricing`

Blok widoczny dla gości i użytkowników Free. Ukryty dla Premium i Admin.

---

## 7. Responsywność

| Breakpoint | Zachowanie |
|---|---|
| ≥960px (desktop) | 2 kolumny kart, pełna tabela porównawcza, Toggle wyświetlony poziomo |
| <960px (tablet/mobile) | 1 kolumna kart (Premium na górze), tabela zastąpiona accordion FAQ, Bottom Bar widoczny |

Karta Premium wyświetlana jako pierwsza w kolejności DOM na mobile (CSS `order` lub reorder w Angular).

---

## 8. Stany interfejsu

| Stan | Zachowanie |
|---|---|
| Gość (niezalogowany) | CTA Free → `/register`, CTA Premium → `/register?next=/checkout` |
| Zalogowany `user` | CTA Free → „Twój aktualny plan" (disabled), CTA Premium → `/checkout` |
| Zalogowany `premium` | Obie karty z oznaką „Twój plan" / CTA disabled; link do zarządzania subskrypcją (przyszłość) |
| Zalogowany `admin` | Neutralne (brak CTA zakupu; admin zarządza ręcznie) |
| Ładowanie sesji | Skeleton loader / spinner na kartach i CTA |

---

## 9. Dostępność (a11y)

- Wszystkie ikony `mat-icon` mają atrybuty `aria-label` lub są opatrzone widocznym tekstem.
- Toggle dostępny klawiaturowo (Angular Material wbudowane wsparcie).
- Nagłówki sekcji zachowują poprawną hierarchię H1 → H2 → H3.
- Kolory chipów „Wkrótce" i „Rekomendowany" spełniają kontrast WCAG AA.
- Linki w sekcji footer-linków są znacznikami `<a>` z `routerLink`.
