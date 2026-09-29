# PS-65: Egzekwowanie limitu planu dla użytkownika Free — Plan UI

> **User Story:** PS-65 — Egzekwowanie limitów planu dla użytkownika Free
> **Data:** wrzesień 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Podsumowanie zmian

| Element | Typ | Ścieżka |
|---|---|---|
| `PlanLimitExceededDialogComponent` | Nowy komponent (dialog) | `src/app/shared/components/plan-limit-exceeded-dialog/` |
| Drawer „Mój plan" | Modyfikacja — licznik w nagłówku | `src/app/shared/components/plan-drawer/` |
| Serwis drawera / `PlanService` | Modyfikacja — obsługa błędu `422 PLAN_LIMIT_EXCEEDED_FREE` | `src/app/core/services/` lub `src/app/shared/services/` |
| `/pricing` — tabela porównawcza | Modyfikacja — wiersz „Mój plan" | `src/app/pages/pricing/pricing.config.ts` |

---

## 2. Nowy komponent `PlanLimitExceededDialogComponent`

**Ścieżka:** `src/app/shared/components/plan-limit-exceeded-dialog/`

Dialog Angular Material (`MatDialog`) wyświetlany gdy `POST /plan/recipes` zwróci błąd `422 PLAN_LIMIT_EXCEEDED_FREE`. Wzorowany na istniejącym `AiCreditsExhaustedDialogComponent`.

### Dane wejściowe dialogu (`MAT_DIALOG_DATA`)

```typescript
interface PlanLimitExceededDialogData {
    freeLimit: number;      // wartość z pola details.free_limit odpowiedzi API (np. 3)
    premiumLimit: number;   // wartość z pola details.premium_limit odpowiedzi API (np. 50)
    upgradeUrl: string;     // '/pricing'
}
```

### Wygląd dialogu

```
╔══════════════════════════════════════════╗
║  [ikona: playlist_add_check]             ║
║  Osiągnięto limit planu                  ║
║                                          ║
║  Twój plan Free pozwala na              ║
║  przechowywanie do 3 pozycji             ║
║  w Moim planie.                          ║
║                                          ║
║  Konto Premium umożliwia                ║
║  przechowywanie do 50 pozycji.           ║
║                                          ║
║  [Zamknij]   [Przejdź na Premium →]     ║
╚══════════════════════════════════════════╝
```

**Szczegóły:**

- Ikona nagłówka: `playlist_add_check` (Material Icons)
- Tytuł: „Osiągnięto limit planu"
- Treść: dynamicznie wstawiane wartości `freeLimit` i `premiumLimit` z `MAT_DIALOG_DATA`
- Przycisk główny (accent): „Przejdź na Premium →" — nawiguje do `upgradeUrl` (`/pricing`) i zamyka dialog
- Przycisk drugorzędny: „Zamknij" — zamknięcie dialogu bez akcji
- Szerokość: `min-width: 320px`, `max-width: 480px`

### Scenariusz wywołania

Dialog otwierany jest przez `PlanService` (lub serwis drawera) bezpośrednio po otrzymaniu odpowiedzi `422` z `POST /plan/recipes`:

```typescript
// Pseudokod w serwisie obsługującym dodawanie do planu

addRecipeToPlan(recipeId: number): Observable<void> {
    return this.http.post('/plan/recipes', { recipeId }).pipe(
        catchError((err: HttpErrorResponse) => {
            if (err.status === 422 && err.error?.error === 'PLAN_LIMIT_EXCEEDED_FREE') {
                this.dialog.open(PlanLimitExceededDialogComponent, {
                    data: {
                        freeLimit: err.error.details.free_limit,
                        premiumLimit: err.error.details.premium_limit,
                        upgradeUrl: err.error.details.upgrade_url,
                    } satisfies PlanLimitExceededDialogData,
                });
                return EMPTY;
            }
            return throwError(() => err);
        })
    );
}
```

> Pozostałe błędy (np. `409 Conflict`, `404 Not Found`, `401`) są obsługiwane przez istniejący mechanizm błędów — bez zmian.

---

## 3. Modyfikacja drawera „Mój plan" — licznik pozycji

**Ścieżka:** `src/app/shared/components/plan-drawer/`

### Licznik w nagłówku drawera

Licznik jest wyświetlany **wyłącznie dla roli `user`** (Free). Dla `premium` i `admin` nagłówek drawera pozostaje bez zmian (wyświetla aktualną liczbę pozycji, bez limitu).

**Wygląd licznika dla roli `user`:**

Wariant normalny (poniżej limitu):
```
Mój plan  ·  2 / 3 pozycji
```

Wariant przy limicie (count === freeLimit):
```
Mój plan  ·  3 / 3 pozycji  [kolor warn]
```

**Implementacja:**

- Limit Free pobierany z odpowiedzi API `GET /plan` lub `GET /me` — backend powinien zwracać `plan_limit` w kontekście sesji, albo UI może polegać na stałej konfiguracyjnej frontendu (wartość `PLAN_LIMIT_FREE` zsynchronizowana z env var przez plik środowiskowy `environment.ts`)
- Kolor tekstu licznika: neutralny gdy `count < freeLimit`; `color="warn"` (Angular Material) gdy `count >= freeLimit`
- Licznik renderowany jako `<span>` z klasą CSS sterowaną przez `[class.warn]="count >= freeLimit"`

**Wejścia (`@Input`) — propozycja komponentu licznika wbudowanego w drawer:**

| Właściwość | Typ | Opis |
|---|---|---|
| `planCount` | `number` | Aktualna liczba pozycji w planie |
| `planLimit` | `number \| null` | Limit planu; `null` = brak limitu (premium/admin) |

Gdy `planLimit === null`, licznik nie jest renderowany.

### Zmiana w istniejącej logice drawera

W momencie otwarcia drawera (lub odświeżenia listy planu) serwis już pobiera `GET /plan`. Nie wymaga to dodatkowego zapytania — `planCount` wynika z długości pobranej listy, a `planLimit` jest wartością konfiguracyjną.

---

## 4. Modyfikacja strony cennika `/pricing` — tabela porównawcza

**Ścieżka:** `src/app/pages/pricing/pricing.config.ts`

### Zmiana wiersza „Mój plan (limit pozycji)"

W kategorii **„Plan i zakupy"** tabeli porównawczej aktualizacja wartości w kolumnie Free:

| Funkcja | Free (przed) | Free (po) | Premium |
|---|---|---|---|
| Mój plan (limit pozycji) | 7 pozycji | **3 pozycje** | 50 pozycji |

Pozostałe wiersze kategorii „Plan i zakupy" pozostają bez zmian:

| Funkcja | Free | Premium |
|---|---|---|
| Lista zakupów (podstawowa) | ✓ | ✓ |
| Zaawansowane scalanie jednostek | — | ✓ (Wkrótce) |
| Planer tygodniowy | — | ✓ (Wkrótce) |
| Konto rodzinne | — | ✓ (Wkrótce) |

**Zmiana w `pricing.config.ts`:**

```typescript
// Przed:
{ feature: 'Mój plan (limit pozycji)', free: '7 pozycji', premium: '50 pozycji' }

// Po:
{ feature: 'Mój plan (limit pozycji)', free: '3 pozycje', premium: '50 pozycji' }
```

> Wartość `3` jest spójna z domyślną wartością zmiennej środowiskowej `PLAN_LIMIT_FREE` na backendzie. Jeśli w przyszłości wartość env var zostanie zmieniona, konieczna jest synchroniczna aktualizacja tego pliku konfiguracyjnego.

---

## 5. Stany interfejsu — tabela zbiorcza

| Stan | Komponent | Zachowanie |
|---|---|---|
| `user` Free, count < limit | Drawer „Mój plan" | Licznik neutralny: „2 / 3 pozycji" |
| `user` Free, count = limit | Drawer „Mój plan" | Licznik w kolorze `warn`: „3 / 3 pozycji" |
| `user` Free, próba dodania przy limicie | Drawer / przycisk „Dodaj do planu" | API zwraca `422` → otwierany `PlanLimitExceededDialogComponent` |
| `premium` / `admin` | Drawer „Mój plan" | Brak licznika z limitem; istniejące zachowanie bez zmian |
| Błąd sieciowy / inny niż `422 PLAN_LIMIT_EXCEEDED_FREE` | Serwis planu | Istniejąca obsługa błędów — bez zmian |

---

## 6. Responsywność

| Breakpoint | Zachowanie |
|---|---|
| ≥960px (desktop) | Licznik w nagłówku drawera po prawej stronie tytułu (flex, `justify-content: space-between`) |
| <960px (tablet/mobile) | Licznik pod tytułem nagłówka drawera; dialog `PlanLimitExceededDialog` pełnoekranowy na mobile (`panelClass: 'fullscreen-dialog-mobile'`) |

---

## 7. Dostępność (a11y)

- Licznik w nagłówku drawera ma `aria-label="Liczba pozycji w planie: X z Y"`.
- Dialog `PlanLimitExceededDialogComponent` implementuje `aria-labelledby` i `aria-describedby` oraz pułapkę fokusu (Angular CDK Focus Trap — wbudowane w `MatDialog`).
- Przycisk „Przejdź na Premium" ma czytelny tekst opisujący akcję (nie samo „Kliknij tutaj").
- Ikony dekoracyjne w dialogu mają `aria-hidden="true"`.
