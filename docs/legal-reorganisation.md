# Plan reorganizacji treści prawnych i cennika — PychaŚwiatowa

> **Autor:** analiza AI na podstawie stanu projektu (listopad 2026)
> **Zakres:** pliki Markdown treści prawnych, routing, stopka, strona cennika, spójność dokumentów
> **Status:** do realizacji
> **Sesje planistyczne:** 4.11.2026 (sesja 1 — zakres i struktura) + 4.11.2026 (sesja 2 — nierozstrzygnięte kwestie)

---

## 1. Kontekst i założenia

### Decyzje właściciela projektu — sesja 1 (4.11.2026)

| Pytanie | Decyzja |
|---|---|
| Jedno źródło prawdy dla plików Markdown | Tylko `public/assets/legal/` — usunąć `docs/legal-documents/` |
| Liczba stron prawnych dla subskrypcji | 1 połączona strona `/legal/subscription` (regulamin + zwroty + prawo odstąpienia) |
| Strona wydawcy | Dodać `publisher.md`, włączyć link w stopce |
| Status treści regulaminu subskrypcji | Treści nie istnieją — plan wskazuje szablon do napisania |
| Placeholdery danych firmowych | Oznaczyć jako „do uzupełnienia przed publikacją" — wylistować wszystkie miejsca |
| Zakres planu | Pełny: struktura, routing, luki w treści, stopka, niespójności, zadania implementacyjne |

### Decyzje właściciela projektu — sesja 2 (4.11.2026)

| Pytanie | Decyzja |
|---|---|
| Regulamin sekcja 8 — akceptacja admina dla Przepisów Publicznych | **Poprawić regulamin** — usunąć wymóg akceptacji admina; opisać że publikacja jest natychmiastowa |
| Trial — karta płatnicza wymagana przy aktywacji? | **Tak, karta wymagana** — poprawić FAQ cennika (zmienić zdanie „nie wymagamy danych karty z góry") |
| Martwe linki w stopce (O nas, FAQ) | Usunąć „O nas"; przekierować **FAQ → `/pricing#faq`** (sekcja FAQ już istnieje na cenniku) |
| Limity i ceny w regulaminie | **Nie wpisywać** konkretnych liczb — regulamin odsyła do aktualnej oferty na `/pricing`; jeden punkt aktualizacji |
| Google Analytics w polityce prywatności | **Wariant A** — GA uruchamiany tylko po wyrażeniu zgody w banerze Clickio Consent Manager |
| Operator płatności | **Jeszcze niewybrany** — zostawić placeholder `<OPERATOR_PŁATNOŚCI>`; uzupełnić przy wdrożeniu PS-66 |

---

## 2. Stan obecny — inwentarz

### 2.1 Pliki treści prawnych

| Plik | Lokalizacja | Status | Uwagi |
|---|---|---|---|
| `terms.md` | `public/assets/legal/` | ⚠️ Wymaga uzupełnienia | Pełna treść, niekompletna data, placeholdery firmy, limit AI jako `<X>` |
| `privacy.md` | `public/assets/legal/` | ⚠️ Wymaga uzupełnienia | Wersja 0.1, daty publikacji puste, placeholdery firmy i operatora płatności |
| `subscription-terms.md` | `public/assets/legal/` | ❌ Placeholder | Tylko 11 linii, brak treści merytorycznej |
| `regulamin.md` | `docs/legal-documents/` | 🔴 Duplikat | Identyczna treść co `terms.md` — do usunięcia |
| `pw.md` | `docs/legal-documents/` | 🔴 Duplikat | Identyczna treść co `privacy.md` — do usunięcia |
| `publisher.md` | (nie istnieje) | ❌ Brakuje | Wymagany przez ustawę o świadczeniu usług drogą elektroniczną |

### 2.2 Routing Angular (`/legal/*`)

| Trasa | Plik docelowy | Status |
|---|---|---|
| `/legal/terms` | `terms.md` | ✅ Działa |
| `/legal/privacy` | `privacy.md` | ✅ Działa |
| `/legal/subscription` | `subscription-terms.md` | ⚠️ Działa, ale placeholder |
| `/legal/publisher` | hardcoded w komponencie | ❌ Brak pliku MD, link zakomentowany |
| `/legal/refund-policy` | (nie istnieje) | — Zbędna — zastąpiona przez `/legal/subscription` |
| `/legal/withdrawal-rights` | (nie istnieje) | — Zbędna — zastąpiona przez `/legal/subscription` |

### 2.3 Stopka (`FooterComponent`)

| Link | Cel | Status |
|---|---|---|
| „O nas" | `#` (dead link) | ❌ Martwy link |
| „FAQ" | `#` (dead link) | ❌ Martwy link |
| „Cennik" | `/pricing` | ✅ |
| „Regulamin subskrypcji" | `/legal/subscription` | ⚠️ Placeholder |
| „Regulamin Serwisu" | `/legal/terms` | ✅ |
| „Polityka prywatności" | `/legal/privacy` | ✅ |
| „Wydawca serwisu" | zakomentowany | ❌ Nieaktywny |

### 2.4 Strona cennika (`/pricing`)

| Element | Status |
|---|---|
| Linki do `/legal/subscription`, `/legal/terms`, `/legal/privacy` | ✅ Skonfigurowane |
| FAQ — opis trialu: „nie wymagamy danych karty z góry" | ⚠️ Niespójna z PS-68 (wymaga karty) |
| `PRICING_CONFIG.limits.free.planItems = 3` | ✅ Spójne z kodem (`PLAN_LIMIT_FREE`) |
| `PLAN_BENEFITS.premium` — brak wzmianki o zwrotach/prawie odstąpienia | ⚠️ Wymaga linku do regulaminu subskrypcji |

---

## 3. Problemy — diagnoza

### 🔴 Krytyczne (blokujące uruchomienie płatności)

| ID | Problem | Lokalizacja |
|---|---|---|
| P-01 | Regulamin subskrypcji nie istnieje | `subscription-terms.md` |
| P-02 | Polityka zwrotów nie istnieje | (brak pliku) |
| P-03 | Prawo odstąpienia (14 dni, B2C/UE) nie istnieje | (brak pliku) |
| P-04 | Dane firmowe to placeholdery we wszystkich dokumentach | `terms.md`, `privacy.md` |

### 🟠 Ważne (niespójności i braki)

| ID | Problem | Lokalizacja |
|---|---|---|
| P-05 | Duplikacja plików — `docs/legal-documents/` to kopie `public/assets/legal/` | `docs/legal-documents/` |
| P-06 | Strona wydawcy (`/legal/publisher`) bez treści i z martwym linkiem w stopce | `legal-page.component.html`, `footer.component.ts` |
| P-07 | Niekompletna data w regulaminie: „Ostatnia aktualizacja: 28." | `terms.md` wiersz 3 |
| P-08 | Daty publikacji polityki prywatności to placeholdery | `privacy.md` wiersze 3–5 |
| P-09 | Limit AI w regulaminie jako `<X> obrazów miesięcznie` zamiast konkretnej liczby | `terms.md` sekcja 10.4 |
| P-10 | Regulamin opisuje „wymaganie akceptacji admina" dla Przepisów Publicznych — mechanizm ten nie istnieje w kodzie | `terms.md` sekcja 8 |
| P-11 | Niespójność FAQ cennika: „nie wymagamy danych karty z góry" vs PS-68 | `pricing.config.ts` |

### 🟡 Do rozważenia (porządki)

| ID | Problem | Lokalizacja | Decyzja |
|---|---|---|---|
| P-12 | Martwe linki „O nas" i „FAQ" w stopce (`#`) | `footer.component.ts` | ✅ Usunąć „O nas"; „FAQ" → `/pricing#faq` |
| P-13 | Link „Wydawca serwisu" zakomentowany w stopce | `footer.component.ts` | ✅ Odkomentować — po stworzeniu `publisher.md` |
| P-14 | `privacy.md` oznaczona jako „Wersja: 0.1 (MVP)" | `privacy.md` | ✅ Usunąć wersję z nagłówka widocznego publicznie; zachować w komentarzu git |
| P-15 | Placeholder `<HOSTING_FRONTEND>` w `privacy.md` sekcja 5.6 | `privacy.md` | ✅ Wpisać: Firebase Hosting (Google LLC) — dane znane |

---

## 4. Docelowa struktura plików

### 4.1 Jedno źródło prawdy — `public/assets/legal/`

```
public/
└── assets/
    └── legal/
        ├── terms.md                ← Regulamin serwisu (warunki korzystania)
        ├── privacy.md              ← Polityka prywatności
        ├── subscription-terms.md   ← Regulamin subskrypcji + polityka zwrotów
        │                             + prawo odstąpienia (jeden plik)
        └── publisher.md            ← Informacje o wydawcy serwisu [NOWY]
```

**Usunąć:**
```
docs/legal-documents/   ← cały folder do usunięcia (duplikaty)
    ├── regulamin.md    ← duplikat terms.md
    └── pw.md           ← duplikat privacy.md
```

### 4.2 Mapowanie tras

| Trasa Angular | Plik Markdown | Klucz route.data.page |
|---|---|---|
| `/legal/terms` | `terms.md` | `'terms'` |
| `/legal/privacy` | `privacy.md` | `'privacy'` |
| `/legal/subscription` | `subscription-terms.md` | `'subscription'` |
| `/legal/publisher` | `publisher.md` | `'publisher'` |

> **Uwaga:** trasy `/legal/refund-policy` i `/legal/withdrawal-rights` (PS-71) **nie są potrzebne** — treść polityki zwrotów i prawa odstąpienia wejdzie do `subscription-terms.md`.

---

## 5. Zmiany implementacyjne

### 5.1 Usunięcie duplikatów (P-05)

**Zadanie:** usunąć folder `docs/legal-documents/` wraz z zawartością.

```powershell
Remove-Item -Recurse -Force "docs/legal-documents"
```

> Jedynym źródłem prawdy są pliki w `public/assets/legal/`.

---

### 5.2 Routing — dodanie obsługi `publisher` z pliku Markdown (P-06)

**Plik:** `src/app/pages/legal/legal-page.component.html`

Zmiana `@case ('publisher')` z hardcoded tekstu na komponent `pych-legal-markdown-viewer`:

```html
@case ('publisher') {
    <pych-legal-markdown-viewer
        [assetPath]="'/assets/legal/publisher.md'"
        [documentName]="'informacji o wydawcy'"
    />
}
```

---

### 5.3 Stopka — aktualizacja linków (P-06, P-12, P-13)

**Plik:** `src/app/shared/components/footer/footer.component.ts`

**Decyzja (sesja 2):** usunąć „O nas" (brak treści); „FAQ" przekierować do `/pricing#faq`; włączyć „Wydawca serwisu".

Docelowa lista linków:

```typescript
readonly legalLinks: LegalLinkVm[] = [
    { label: 'FAQ', path: '/pricing', fragment: 'faq' },     // ← było '#', teraz /pricing#faq
    { label: 'Cennik', path: '/pricing' },
    { label: 'Regulamin subskrypcji', path: '/legal/subscription' },
    { label: 'Regulamin Serwisu', path: '/legal/terms' },
    { label: 'Polityka prywatności', path: '/legal/privacy' },
    { label: 'Wydawca serwisu', path: '/legal/publisher' },  // ← odkomentować
    // usunięte: 'O nas' (brak strony)
];
```

Zmiana interfejsu `LegalLinkVm` w tym samym pliku:

```typescript
interface LegalLinkVm {
    label: string;
    path: string;
    fragment?: string;   // ← dodać opcjonalne pole
    ariaLabel?: string;
}
```

**Plik:** `src/app/shared/components/footer/footer.component.html`

W szablonie HTML stopki każdy link `<a routerLink>` musi przekazywać fragment. Obecny wzorzec (przykładowy):

```html
<!-- przed -->
<a [routerLink]="link.path">{{ link.label }}</a>

<!-- po -->
<a [routerLink]="link.path" [fragment]="link.fragment ?? null">{{ link.label }}</a>
```

> `[fragment]="null"` przy braku fragmentu nie dodaje `#` do URL — Angular RouterLink ignoruje `null`.

---

### 5.4 FAQ cennika — korekta niespójności z PS-68 (P-11)

**Plik:** `src/app/pages/pricing/pricing.config.ts`

**Decyzja (sesja 2):** Trial wymaga podania karty płatniczej przy aktywacji (zgodnie z PS-68).

Obecny tekst (błędny):
```
Trial aktywuje się automatycznie — nie wymagamy danych karty z góry.
```

Poprawiony tekst:
```
Przez 7 dni od aktywacji konta Premium masz pełny dostęp do funkcji Premium.
Aktywacja trialu wymaga podania metody płatności — karta nie zostaje
obciążona przed upływem okresu próbnego.
```

> **Uwaga:** zmiana w `pricing.config.ts` → `PRICING_FAQ[0].answer`.

---

## 6. Treści do napisania

### 6.1 Regulamin subskrypcji Premium — `subscription-terms.md`

**Plik docelowy:** `public/assets/legal/subscription-terms.md`
**Trasa:** `/legal/subscription`
**Wymagany przed:** uruchomieniem PS-66 (checkout i płatności)

Plik powinien zawierać trzy logiczne sekcje w jednym dokumencie Markdown:

#### Sekcja A: Regulamin subskrypcji Premium

Wymagane elementy:
- [ ] Definicje: Subskrypcja, Okres rozliczeniowy, Plan miesięczny/roczny, Trial
- [ ] Warunki nabycia subskrypcji (checkout, akceptacja regulaminu)
- [ ] Ceny (z VAT): plan miesięczny i roczny — **lub odwołanie do aktualnej oferty na `/pricing`**
- [ ] Trial 7-dniowy: warunki aktywacji, limit AI, automatyczne przejście/wygaśnięcie
- [ ] Automatyczne odnawianie subskrypcji: kiedy pobierana opłata, jak wyłączyć
- [ ] Metody płatności: karta płatnicza, BLIK
- [ ] Dane do faktury / paragon
- [ ] Zmiana planu (miesięczny ↔ roczny): kiedy obowiązuje zmiana
- [ ] Anulowanie: skutek, data wygaśnięcia dostępu, brak zwrotu za rozpoczęty okres (jeśli taka decyzja)
- [ ] Grace period przy nieudanej płatności odnowienia (PS-67)
- [ ] Zmiany regulaminu subskrypcji: tryb powiadamiania

#### Sekcja B: Polityka zwrotów

Wymagane elementy:
- [ ] Ogólna zasada: brak zwrotów za wykorzystane okresy rozliczeniowe (jeśli taka polityka)
- [ ] Wyjątki: błąd techniczny po stronie serwisu, podwójne pobranie opłaty
- [ ] Tryb składania wniosku o zwrot (e-mail, termin odpowiedzi)
- [ ] Czas realizacji zwrotu (do X dni roboczych)
- [ ] Uwaga: prawo odstąpienia (patrz sekcja C) jest niezależne od polityki zwrotów

#### Sekcja C: Prawo odstąpienia od umowy (B2C, PL/UE)

> ⚠️ **Element wymagany przez prawo** — ustawa o prawach konsumenta (implementacja Dyrektywy 2011/83/UE).

Wymagane elementy:
- [ ] Prawo odstąpienia w terminie 14 dni od zawarcia umowy bez podawania przyczyny
- [ ] Utrata prawa odstąpienia: gdy subskrypcja jest treścią cyfrową dostarczaną natychmiastowo po wyraźnej zgodzie konsumenta (art. 38a — należy odebrać zgodę w checkoucie!)
- [ ] Wzór oświadczenia o odstąpieniu (formularz lub opis)
- [ ] Adres do złożenia oświadczenia: `<EMAIL>`
- [ ] Tryb zwrotu środków po odstąpieniu (14 dni)

> 💡 **Zalecenie:** sekcja C powinna być przygotowana przez prawnika lub na podstawie wzoru z ODDOiWiO (UOKiK). Nieprawidłowe prawo odstąpienia to ryzyko sankcji administracyjnych.

---

### 6.2 Strona wydawcy — `publisher.md`

**Plik docelowy:** `public/assets/legal/publisher.md`
**Trasa:** `/legal/publisher`
**Wymagany przez:** art. 5 ustawy o świadczeniu usług drogą elektroniczną

Wymagane elementy:
- [ ] Nazwa firmy / imię i nazwisko
- [ ] Adres siedziby / adres do korespondencji
- [ ] NIP
- [ ] REGON (jeśli dotyczy)
- [ ] E-mail kontaktowy
- [ ] Telefon kontaktowy (opcjonalnie)
- [ ] Numer wpisu do CEIDG / KRS (jeśli dotyczy)
- [ ] Adres serwisu: `https://pychaswiatowa.web.app`
- [ ] Data uruchomienia serwisu

Sugerowana minimalna treść:

```markdown
# Wydawca serwisu „PychaŚwiatowa"

Serwis „PychaŚwiatowa" jest prowadzony przez:

- **Nazwa:** <NAZWA_FIRMY>
- **Forma prawna:** jednoosobowa działalność gospodarcza (JDG)
- **Adres:** <ADRES>
- **NIP:** <NIP>
- **E-mail:** <EMAIL>
- **Wpis do CEIDG:** <NUMER_CEIDG lub stosowna informacja>

Serwis dostępny pod adresem: https://pychaswiatowa.web.app
```

---

## 7. Uzupełnienia w istniejących dokumentach

### 7.1 Wykaz placeholderów do uzupełnienia przed publikacją

Poniższe placeholdery należy uzupełnić **przed uruchomieniem sprzedaży** (PS-66) lub ogłoszeniem danych firmowych:

#### `public/assets/legal/terms.md`

> Zadania T-08, T-12, T-13, T-15 łącznie.

| Placeholder / fragment | Lokalizacja | Akcja |
|---|---|---|
| `\<NAZWA_FIRMY\>` | sekcja 2.1 | Wpisać pełną nazwę firmy / imię i nazwisko |
| `\<ADRES\>` | sekcja 2.1 | Wpisać adres do korespondencji |
| `\<NIP\>` | sekcja 2.1 | Wpisać NIP firmy |
| `\<EMAIL\>` | sekcja 2.1, 13.3, 14.1 | Wpisać adres e-mail kontaktowy |
| Data „Ostatnia aktualizacja: 28." | nagłówek, wiersz 3 | Uzupełnić pełną datę |
| `\<LINK_DO_WARUNKÓW_PŁATNOŚCI\>` | sekcja 11.3 | Zastąpić linkiem `/legal/subscription` |
| Sekcja 8.2–8.3 (wymóg akceptacji admina) | sekcja 8 | **Usunąć** — zastąpić nowym brzmieniem z sekcji 7.2 tego dokumentu |
| Sekcja 10.4 (podpunkty z `\<X\>`) | sekcja 10.4 | **Zastąpić** nowym brzmieniem z sekcji 7.2 tego dokumentu |

#### `public/assets/legal/privacy.md`

> Zadania T-09, T-10, T-11, T-14 łącznie.

| Placeholder / fragment | Lokalizacja | Akcja |
|---|---|---|
| `\<NAZWA_FIRMY\>` | sekcja 1.1 | Wpisać pełną nazwę firmy |
| `\<ADRES\>` | sekcja 1.1 | Wpisać adres do korespondencji |
| `\<NIP\>` | sekcja 1.1 | Wpisać NIP firmy |
| `\<EMAIL\>` | sekcja 1.1, 1.2, 8, 14.2, 16 | Wpisać adres e-mail kontaktowy |
| `\<OPERATOR_PŁATNOŚCI\>` | sekcja 5.5 | **Zostawić jako placeholder** — uzupełnić w T-19 po wyborze operatora |
| `\<HOSTING_FRONTEND\>` | sekcja 5.6 | Zastąpić: **Firebase Hosting (Google Ireland Limited / Google LLC)** |
| `\<YYYY-MM-DD\>` × 2 | nagłówek | Wpisać datę pierwszej publikacji i datę ostatniej aktualizacji |
| Blok `\<WARIANT A\>` / `\<WARIANT B\>` | sekcja 13.2 | **Zostawić Wariant A, usunąć Wariant B** — zastąpić nowym brzmieniem z sekcji 7.2 tego dokumentu |
| `\<OPIS_MECHANIZMU_ZGÓD / LINK_DO_USTAWIEŃ\>` | sekcja 13.3 | Wpisać: „Clickio Consent Manager dostępny w banerze cookies na każdej stronie serwisu" |
| `\<DOPRECYZUJ KANAŁY\>` | sekcja 6 | Wpisać: „e-mail" |
| `\<LINK/ŚCIEŻKA\>` | sekcja 14.2 | Wpisać: `/settings` |
| `\<DODAJ: KRÓTKI OPIS MECHANIZMÓW...\>` | sekcja 6 | Wpisać: „OpenAI — standardowe klauzule umowne (SCC); Google (Gemini, Analytics) — SCC; Supabase — serwery w UE (AWS eu-central-1)" *(do weryfikacji z faktyczną konfiguracją Supabase)* |
| `\<UWAGA WDROŻENIOWA\>` | sekcja 7 | Uzupełnić: soft-delete w `recipes.deleted_at` — dane zachowane do ręcznego usunięcia lub przez 30 dni po soft-delete (decyzja do podjęcia) |
| Wersja „0.1 (MVP)" | nagłówek | Usunąć z treści widocznej publicznie |

#### `public/assets/legal/subscription-terms.md`

Plik do napisania od podstaw wg wymagań z sekcji 6.1 tego dokumentu (Sekcja A: regulamin, Sekcja B: zwroty, Sekcja C: prawo odstąpienia).

---

### 7.2 Korekty merytoryczne — decyzje podjęte

#### Regulamin sekcja 8: „wymagana akceptacja admina" dla Przepisów Publicznych

Obecna treść (do usunięcia):
> Oznaczenie Przepisu jako „Publiczny" jest równoznaczne z **wnioskiem Użytkownika o publikację i wymaga akceptacji administratora Serwisu**. Do czasu akceptacji Przepis nie jest traktowany jako Przepis Publiczny i może pozostać niewidoczny publicznie.

Stan faktyczny:
> Oznaczenie przepisu jako „Publiczny" natychmiast publikuje go w katalogu `/explore` — bez etapu moderacji.

**Decyzja (sesja 2): poprawić regulamin.** Usunąć wymóg akceptacji admina. Nowe brzmienie sekcji 8.2:

> Oznaczenie Przepisu jako „Publiczny" powoduje jego natychmiastowe opublikowanie w katalogu publicznym Serwisu. Usługodawca zastrzega sobie prawo do wycofania Przepisu Publicznego z katalogu w przypadku stwierdzenia naruszeń Regulaminu lub prawa.

Usunąć akapity 8.2, 8.3 (wymóg wniosku, decyzja admina, czas akceptacji). Zachować: prawo do wycofania, przeredagowanie językowe (sekcja 8.4).

---

#### `terms.md` sekcja 10.4 — limit AI Premium

Obecna wartość (placeholder): `\<X\> obrazów miesięcznie`

**Decyzja (sesja 2): nie wpisywać konkretnych liczb** — regulamin odsyła do aktualnej oferty. Nowe brzmienie sekcji 10.4:

> Funkcje AI podlegają limitom ilościowym uzależnionym od posiadanego planu. Aktualne limity dla planów Free i Premium są prezentowane w serwisie na stronie `/pricing`. Usługodawca może zmieniać limity z ważnych przyczyn (np. koszty usług zewnętrznych, nadużycia), z poszanowaniem praw Użytkowników Premium.

Usunąć podpunkty 10.4.1 i 10.4.2 z hardcoded wartościami.

---

#### `privacy.md` sekcja 13.2 — Google Analytics

**Decyzja (sesja 2): Wariant A.** Pozostawić tylko wariant A, usunąć wariant B i znaczniki `<WARIANT A>` / `<WARIANT B>`.

Docelowe brzmienie:

> Google Analytics uruchamiamy **dopiero po wyrażeniu zgody** w banerze cookies (Clickio Consent Manager). Zgodę możesz wycofać w dowolnym momencie przez panel ustawień cookies dostępny na każdej stronie serwisu.

---

#### `privacy.md` sekcja 5.6 — Hosting frontendu

**Decyzja (sesja 2):** dane znane — wpisać bezpośrednio.

Obecny tekst: `\<HOSTING_FRONTEND\> (np. Firebase Hosting)`

Docelowy tekst: **Firebase Hosting (Google Ireland Limited / Google LLC)**

---

## 8. Spójność cennika z dokumentami prawnymi

### 8.1 Wymagane linki w checkoucie (PS-66)

Gdy zostanie zaimplementowany checkout (`/checkout`), musi zawierać:
- [ ] Checkbox akceptacji regulaminu subskrypcji (`/legal/subscription`) — **wymagany przed zakupem**
- [ ] Checkbox potwierdzenia rezygnacji z prawa odstąpienia dla treści cyfrowej dostarczanej natychmiastowo — **wymagany przez prawo**
- [ ] Link do polityki prywatności (`/legal/privacy`)

### 8.2 Spójność limitów

**Decyzja (sesja 2): regulamin nie podaje konkretnych liczb** — odsyła do `/pricing`. Jeden punkt aktualizacji przy zmianie limitów.

| Limit | Kod (`pricing.config.ts`) | Regulamin (docelowo) | Akcja |
|---|---|---|---|
| Plan Free — pozycje w planie | 3 (`planItems`) | Odesłanie do `/pricing` | ✅ Wystarczy ogólne zdanie w regulaminie |
| Plan Premium — pozycje w planie | 50 (`planItems`) | Odesłanie do `/pricing` | ✅ j.w. |
| AI importy Free (lifetime) | 3 (`aiImportsLifetime`) | Odesłanie do `/pricing` | Usunąć placeholder `<X>` z sekcji 10.4 |
| AI zdjęcia Premium (miesięcznie) | wartość ENV | Odesłanie do `/pricing` | Usunąć placeholder `<X>` z sekcji 10.4 |
| Cena Premium miesięcznie | 24,00 zł | Brak w regulaminie | ✅ Regulamin odsyła do oferty — OK |
| Cena Premium rocznie | 169,00 zł | Brak w regulaminie | ✅ j.w. |

> Zasada: regulamin opisuje **zasady**, cennik opisuje **liczby**. Zmiana limitu lub ceny = zmiana tylko w `pricing.config.ts`.

---

## 9. Plan działania — zadania implementacyjne

### Sprint 0 — Porządki (bez wpływu na użytkowników, do zrobienia natychmiast)

| # | Zadanie | Plik | Priorytet | Notatka |
|---|---|---|---|---|
| T-01 | Usunąć folder `docs/legal-documents/` wraz z zawartością | `docs/legal-documents/` | 🔴 | Duplikaty — jedyne źródło prawdy to `public/assets/legal/` |
| T-02 | Poprawić datę w regulaminie: „Ostatnia aktualizacja: 28." | `terms.md` wiersz 3 | 🟠 | Uzupełnić pełną datę |
| T-03 | Podłączyć `publisher.md` w `@case ('publisher')` zamiast hardcoded tekstu | `legal-page.component.html` | 🟠 | Patrz sekcja 5.2 |
| T-04 | Zaktualizować stopkę: usunąć „O nas", FAQ → `/pricing#faq`, odkomentować „Wydawca serwisu" | `footer.component.ts` | 🟠 | Patrz sekcja 5.3; dodać `fragment?: string` do `LegalLinkVm` |
| T-05 | Poprawić FAQ cennika — zmienić opis trialu (karta wymagana) | `pricing.config.ts` | 🟠 | Patrz sekcja 5.4; `PRICING_FAQ[0].answer` |

### Sprint 1 — Uzupełnienie treści (przed uruchomieniem płatności)

| # | Zadanie | Plik | Priorytet | Notatka |
|---|---|---|---|---|
| T-06 | Napisać `publisher.md` z danymi wydawcy | `public/assets/legal/publisher.md` (nowy) | 🔴 | Wymagany przez ustawę o UŚUDE; patrz sekcja 6.2 |
| T-07 | Napisać pełny regulamin subskrypcji + politykę zwrotów + prawo odstąpienia | `public/assets/legal/subscription-terms.md` | 🔴 | Wymaga prawnika dla sekcji C (prawo odstąpienia); patrz sekcja 6.1 |
| T-08 | Uzupełnić placeholdery danych firmowych w `terms.md` | `public/assets/legal/terms.md` | 🔴 | Pełna lista w sekcji 7.1 |
| T-09 | Uzupełnić placeholdery danych firmowych + wpisać Firebase Hosting w `privacy.md` | `public/assets/legal/privacy.md` | 🔴 | Pełna lista w sekcji 7.1; `<HOSTING_FRONTEND>` → Firebase Hosting (Google LLC) |
| T-10 | Usunąć Wariant B z sekcji 13.2 `privacy.md` — pozostawić tylko Wariant A (Clickio) | `public/assets/legal/privacy.md` | 🔴 | Decyzja: Wariant A (GA po zgodzie) |
| T-11 | Uzupełnić `privacy.md`: sekcja 13.3 Clickio, sekcja 6 kanały e-mail, sekcja 14.2 link `/settings` | `public/assets/legal/privacy.md` | 🔴 | `<OPERATOR_PŁATNOŚCI>` zostawić jako placeholder do T-19 |

### Sprint 2 — Korekty merytoryczne w dokumentach

| # | Zadanie | Plik | Priorytet | Notatka |
|---|---|---|---|---|
| T-12 | Poprawić regulamin sekcja 8 — usunąć wymóg akceptacji admina; wpisać nowe brzmienie | `public/assets/legal/terms.md` | 🟠 | Patrz sekcja 7.2; nowe brzmienie tam podane |
| T-13 | Poprawić regulamin sekcja 10.4 — usunąć placeholder `<X>`; wpisać odesłanie do `/pricing` | `public/assets/legal/terms.md` | 🟠 | Patrz sekcja 7.2; nowe brzmienie tam podane |
| T-14 | Usunąć wersję „0.1 (MVP)" z nagłówka `privacy.md` widocznego dla użytkownika | `public/assets/legal/privacy.md` | 🟡 | Opcjonalnie zachować w komentarzu git |
| T-15 | Dodać w `terms.md` sekcja 11.3 link do `/legal/subscription` zamiast placeholder `<LINK_DO_WARUNKÓW_PŁATNOŚCI>` | `public/assets/legal/terms.md` | 🟠 | |

### Sprint 3 — Wymagania checkout (PS-66, blokujące płatności)

| # | Zadanie | Plik | Priorytet | Notatka |
|---|---|---|---|---|
| T-16 | Checkbox akceptacji regulaminu subskrypcji przed zakupem | komponent `/checkout` | 🔴 | Link do `/legal/subscription`; wymagany prawnie |
| T-17 | Checkbox potwierdzenia rezygnacji z prawa odstąpienia dla treści cyfrowej | komponent `/checkout` | 🔴 | Art. 38a ustawy o prawach konsumenta; wymagany prawnie |
| T-18 | Link do polityki prywatności w checkout | komponent `/checkout` | 🔴 | |
| T-19 | Uzupełnić `<OPERATOR_PŁATNOŚCI>` w `privacy.md` po wyborze dostawcy płatności | `public/assets/legal/privacy.md` | 🔴 | Zablokowane do decyzji biznesowej |

### Zasady utrzymania (trwałe)

| Zasada | Opis |
|---|---|
| **Jedno źródło prawdy** | Edytować wyłącznie pliki w `public/assets/legal/`. Zmiany w dokumentach prawnych = commit z opisem zmiany i datą w nagłówku pliku. |
| **Aktualizacja dat** | Przy każdej zmianie treści zaktualizować „Ostatnia aktualizacja" w nagłówku pliku. |
| **Regulamin nie zawiera liczb** | Limity i ceny opisywane są tylko w `pricing.config.ts` i na `/pricing`. Regulamin odsyła do oferty, nie powtarza wartości. |
| **Nowe funkcje AI** | Przy każdym nowym typie kredytu (`import-url`, `import-image` itp.) zaktualizować sekcję 10 regulaminu i rozdział 4 polityki prywatności (przetwarzanie danych wejściowych przez dostawców AI). |
| **Nowy dostawca usług** | Przy każdej zmianie/dodaniu zewnętrznego dostawcy (AI, płatności, analityka) zaktualizować rozdział 5 polityki prywatności (Odbiorcy danych). |

---

## 10. Diagram zależności dokumentów

```
public/assets/legal/
├── terms.md
│   └── odsyła do → privacy.md (/legal/privacy)
│   └── odsyła do → subscription-terms.md (/legal/subscription)
│
├── privacy.md
│   └── powiązana z → terms.md (/legal/terms)
│
├── subscription-terms.md           [rozszerzyć]
│   ↑ linkowana z → /pricing (stopka cennika)
│   ↑ linkowana z → /checkout (akceptacja przed zakupem) [gdy PS-66]
│   ↑ linkowana z → stopka serwisu
│
└── publisher.md                    [nowy]
    ↑ linkowana z → stopka serwisu
```

---

## 11. Podsumowanie — co jest pilne

### Przed uruchomieniem płatności (PS-66) — lista kontrolna

| | Element | Stan | Zadanie |
|---|---|---|---|
| ✅ | `/legal/terms` | Istnieje, wymaga uzupełnień | T-02, T-08, T-12, T-13, T-15 |
| ✅ | `/legal/privacy` | Istnieje, wymaga uzupełnień | T-09, T-10, T-11, T-14 |
| ❌ | `/legal/subscription` | Tylko placeholder | T-07 (napisać od podstaw) |
| ❌ | `/legal/publisher` | Nie istnieje | T-06 + T-03 + T-04 |
| ❌ | Checkboxy w checkout | Nie zaimplementowane | T-16, T-17, T-18 |
| ⏳ | `<OPERATOR_PŁATNOŚCI>` w `privacy.md` | Czeka na decyzję biznesową | T-19 |

### Można zrobić natychmiast (bez ryzyka, bez treści do pisania)

| | Element | Zadanie |
|---|---|---|
| 🗑️ | Usunąć `docs/legal-documents/` | T-01 |
| 🛠️ | Podłączyć `publisher.md` w komponencie | T-03 |
| 🛠️ | Zaktualizować stopkę (FAQ, Wydawca) | T-04 |
| 🛠️ | Poprawić FAQ cennika (karta przy trialu) | T-05 |
| 📝 | Poprawić niekompletną datę w regulaminie | T-02 |
