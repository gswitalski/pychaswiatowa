# PS-63: Strona cennika (/pricing) — Plan wdrożenia

> **User Story:** PS-63 — Strona cennika z ofertą Premium
> **Data:** wrzesień 2026
> **Środowisko docelowe:** Firebase Hosting (frontend) + Supabase Cloud (backend)

---

## 1. Podsumowanie

PS-63 to funkcjonalność **wyłącznie frontendowa w MVP**. Nie wymaga:
- nowych tabel ani migracji bazy danych,
- nowych Supabase Edge Functions,
- nowych zmiennych środowiskowych,
- nowych kluczy API ani kont zewnętrznych usług.

Wszystkie kroki wdrożenia dotyczą warstwy Angulara i plików statycznych Firebase Hosting.

---

## 2. Kroki do wykonania (w kolejności)

### Krok 1 — Utworzenie pliku Markdown regulaminu subskrypcji

**Typ:** Operacja na plikach / treść prawna

Utworzyć plik: `src/assets/legal/subscription-terms.md`

Zawartość na start (placeholder — do uzupełnienia przez dział prawny przed startem sprzedaży):

```markdown
# Regulamin subskrypcji PychaŚwiatowa Premium

**Wersja:** 1.0 (projekt — dokument w przygotowaniu)
**Data wejścia w życie:** do ustalenia

Dokument w przygotowaniu. Pełna treść regulaminu subskrypcji zostanie opublikowana
przed uruchomieniem płatnych planów.

Pytania: kontakt@pychaswiatowa.pl
```

> **Dlaczego teraz?** Kryterium akceptacji PS-63 wymaga obecności linku do regulaminu subskrypcji. Trasa `/legal/subscription` musi zwracać treść (nie 404), nawet jeśli jest to placeholder. Plik będzie uzupełniony przez dział prawny przed startem checkout.

---

### Krok 2 — Dodanie tras w Angular Router

**Typ:** Zmiana kodu (konfiguracja routingu)

Dodać w pliku `src/app/app.routes.ts` (lub odpowiednim pliku routingu) trzy nowe trasy:

```typescript
// Strona cennika (publiczna)
{
    path: 'pricing',
    loadComponent: () =>
        import('./pages/pricing/pricing-page.component')
            .then(m => m.PricingPageComponent),
},

// Stub checkout (publiczny, pełna implementacja w kolejnych historyjkach)
{
    path: 'checkout',
    loadComponent: () =>
        import('./pages/checkout/checkout-page.component')
            .then(m => m.CheckoutPageComponent),
},

// Regulamin subskrypcji (publiczny, reuse LegalPageComponent)
{
    path: 'legal/subscription',
    loadComponent: () =>
        import('./pages/legal/legal-page.component')
            .then(m => m.LegalPageComponent),
    data: { markdownPath: 'assets/legal/subscription-terms.md' },
},
```

> Upewnić się, że żadna z tras nie jest objęta `AuthGuard` ani `usernameCompleteMatchGuard`.

---

### Krok 3 — Utworzenie pliku konfiguracji cennika

**Typ:** Zmiana kodu (nowy plik)

Utworzyć plik: `src/app/pages/pricing/pricing.config.ts`

Treść zgodna z sekcją 4 planu UI (`PS-63-pricing-page-ui-plan.md`). Plik zawiera stałe ceny (w groszach PLN), limity planów i konfigurację trialu.

Dodać komentarz `// TODO: Zastąpić wywołaniem GET /pricing/plans po wdrożeniu checkout` przy definicji stałych cenowych.

---

### Krok 4 — Implementacja komponentów Angular

**Typ:** Zmiana kodu (nowe komponenty)

Kolejność implementacji:

1. `src/app/pages/pricing/pricing-page.component.ts` + `.html` + `.scss`
   - Sekcje: Hero, Toggle, Karty planów, Tabela porównawcza, FAQ, Footer linków
   - Import `pricing.config.ts` dla danych cenowych
   - Obsługa stanu sesji przez `AuthService` (istniejący serwis) dla logiki CTA

2. `src/app/pages/checkout/checkout-page.component.ts` + `.html` + `.scss`
   - Stub MVP z komunikatem „Wkrótce" i przyciskiem powrotu do `/pricing`

> Implementacja komponentów jest zadaniem deweloperskim wykonywanym w ramach sprintu. Plan UI (`PS-63-pricing-page-ui-plan.md`) zawiera szczegółową specyfikację każdej sekcji.

---

### Krok 5 — Aktualizacja komponentów nawigacyjnych

**Typ:** Zmiana kodu (modyfikacja istniejących komponentów)

**Topbar** (`src/app/layout/topbar/`):
- Dodać link „Cennik" → `/pricing` widoczny dla ról `null` (gość) i `user`
- Ukryty dla `premium` i `admin`
- Logika warunkowa na podstawie `app_role` z `AuthService`

**Footer** (`src/app/layout/footer/`):
- Dodać link „Cennik" → `/pricing`
- Dodać link „Regulamin subskrypcji" → `/legal/subscription`

**Landing page** (`src/app/pages/home/`):
- Dodać sekcję „Więcej z Premium" z CTA „Zobacz plany" → `/pricing`
- Sekcja ukryta dla `premium` i `admin`

---

### Krok 6 — Weryfikacja Firebase Hosting (SPA routing)

**Typ:** Konfiguracja infrastruktury

Sprawdzić plik `firebase.json` — konfiguracja SPA redirect powinna już istnieć:

```json
{
    "hosting": {
        "rewrites": [
            {
                "source": "**",
                "destination": "/index.html"
            }
        ]
    }
}
```

Jeśli konfiguracja jest poprawna — brak zmian potrzebnych. Nowe trasy (`/pricing`, `/checkout`, `/legal/subscription`) są obsługiwane automatycznie przez Angular Router po przekierowaniu do `index.html`.

> Bez tej konfiguracji bezpośrednie wejście w URL `/pricing` zwróci 404 z Firebase Hosting.

---

### Krok 7 — Weryfikacja i wdrożenie

**Typ:** QA + deploy

Przed wdrożeniem produkcyjnym sprawdzić:

- [ ] `/pricing` ładuje się bez logowania (tryb gość)
- [ ] `/pricing` ładuje się po zalogowaniu (rola `user`)
- [ ] Toggle miesięczny/roczny aktualizuje ceny poprawnie
- [ ] CTA „Zacznij za darmo" prowadzi do `/register` dla gości
- [ ] CTA „Wybierz Premium" prowadzi do `/register?next=/checkout` dla gości
- [ ] CTA „Wybierz Premium" prowadzi do `/checkout` dla zalogowanego `user`
- [ ] `/checkout` wyświetla stub „Wkrótce" bez błędów
- [ ] `/legal/subscription` wyświetla placeholder Markdown bez błędów (nie 404)
- [ ] Link „Cennik" widoczny w Topbarze dla gości i `user`; niewidoczny dla `premium`/`admin`
- [ ] Strona renderuje się poprawnie na mobile (<960px) i desktop (≥960px)
- [ ] Brak błędów w konsoli przeglądarki

Wdrożenie:

```bash
ng build --configuration=production
firebase deploy --only hosting
```

---

## 3. Czego NIE robi PS-63

Poniższe elementy są poza zakresem tej historyjki i zostaną zrealizowane w kolejnych:

| Element | Historyjka |
|---|---|
| Integracja z operatorem płatności (Stripe/PayU) | PS-62 (checkout) |
| Limit kredytów AI i ich egzekwowanie | PS-64 |
| Limit pozycji planu dla Free (7 vs 50) | PS-65 |
| Pełna treść regulaminu subskrypcji | Dział prawny + PS-62 |
| Strona zarządzania subskrypcją (`/settings/subscription`) | Przyszłe historyjki |
| Reklamy w katalogu publicznym | Przyszłe historyjki |
| Import z URL / ze zdjęcia | Przyszłe historyjki |
| Webhook od operatora płatności → zmiana `app_role` na `premium` | PS-62 |

---

## 4. Zależności

| Zależność | Status | Uwaga |
|---|---|---|
| `AuthService` (istniejący) | ✅ Zaimplementowany | Dostarcza `app_role` do logiki CTA |
| `LegalPageComponent` (istniejący) | ✅ Zaimplementowany | Reuse dla `/legal/subscription` |
| Firebase Hosting SPA config | ✅ Istniejąca konfiguracja | Weryfikacja wymagana (krok 6) |
| `GET /me` endpoint | ✅ Zaimplementowany | Bez zmian |
| Plik `subscription-terms.md` | ❌ Nie istnieje | Tworzyć w kroku 1 |
| `PricingPageComponent` | ❌ Nie istnieje | Tworzyć w kroku 4 |
| `CheckoutPageComponent` | ❌ Nie istnieje | Tworzyć w kroku 4 |

---

## 5. Ryzyka i mitygacje

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|---|---|---|
| Ceny na stronie będą inne niż w finalnym checkout | Wysokie (ceny orientacyjne) | Wyraźna informacja na stronie: „Ceny orientacyjne, mogą ulec zmianie przed startem sprzedaży." |
| Regulamin subskrypcji nie jest gotowy przed wdrożeniem checkout | Wysokie | Placeholder z datą + kontakt; brak treści jest lepszy niż opóźnienie wdrożenia strony |
| Użytkownik trafia na `/checkout` stub i jest sfrustrowany | Średnie | Wyraźny komunikat, formularz zapisu do listy oczekujących lub Typeform |
| SPA routing nie skonfigurowany → 404 na `/pricing` | Niskie | Weryfikacja `firebase.json` w kroku 6 |
| CTA dla `premium` wyświetla „Wybierz Premium" zamiast „Twój plan" | Niskie | Pokrycie testem jednostkowym logiki CTA z mockiem `AuthService` |
