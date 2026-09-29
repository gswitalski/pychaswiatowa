# Plan implementacji widoku PS-65 — Limit planu Free

## 1. Przegląd

Widok PS-65 egzekwuje limit pozycji w „Moim planie" dla użytkowników Free. Zmiany obejmują: nowy dialog informujący o przekroczeniu limitu, licznik pozycji w nagłówku drawera „Mój plan" (tylko dla roli `user`), obsługę błędu `422 PLAN_LIMIT_EXCEEDED_FREE` w `MyPlanService` oraz aktualizację konfiguracji cennika (limit Free z 7 na 3).

## 2. Routing widoku

Brak nowych tras. Zmiany dotyczą komponentów globalnych (drawer, dialog) oraz istniejącej strony `/pricing`.

## 3. Struktura komponentów

```
MyPlanDrawerComponent (modyfikacja)
  └── [licznik limitu w nagłówku — tylko user Free]

PlanLimitExceededDialogComponent (nowy)
  └── MatDialogModule
  └── MatButtonModule
  └── MatIconModule

MyPlanService (modyfikacja)
  └── otwiera PlanLimitExceededDialogComponent po 422 PLAN_LIMIT_EXCEEDED_FREE

pricing.config.ts (modyfikacja)
  └── planItems: 7 → 3
```

## 4. Szczegóły komponentów

### `PlanLimitExceededDialogComponent`

- **Opis:** Dialog Angular Material wyświetlany gdy `POST /plan/recipes` zwróci błąd `422 PLAN_LIMIT_EXCEEDED_FREE`. Wzorowany na `AiCreditsExhaustedDialogComponent`.
- **Główne elementy:**
  - `mat-dialog-title` z ikoną `playlist_add_check` i tytułem „Osiągnięto limit planu"
  - `mat-dialog-content` z dynamicznymi wartościami `freeLimit` i `premiumLimit`
  - `mat-dialog-actions` z przyciskami „Zamknij" i „Przejdź na Premium →"
- **Obsługiwane interakcje:**
  - „Zamknij" — zamknięcie dialogu
  - „Przejdź na Premium →" — nawigacja do `data.upgradeUrl` (`/pricing`) i zamknięcie dialogu
- **Obsługiwana walidacja:** brak (dane walidowane po stronie API)
- **Typy:** `PlanLimitExceededDialogData`
- **Propsy:** `MAT_DIALOG_DATA: PlanLimitExceededDialogData`

### `MyPlanDrawerComponent` (modyfikacja)

- **Opis:** Globalny drawer z prawej strony. Rozszerzony o licznik pozycji planu dla roli `user` (Free).
- **Główne elementy:**
  - Nowy element `div.my-plan-drawer__header-title` obejmujący tytuł i licznik
  - `span.my-plan-drawer__limit-counter` z klasą `--warn` gdy `planTotal >= planLimit`
- **Obsługiwane interakcje:** bez zmian (usuwanie, czyszczenie, nawigacja)
- **Obsługiwana walidacja:**
  - `planLimit() !== null` — warunek wyświetlenia licznika (tylko rola `user`)
  - `isPlanAtLimit()` — kolor warn gdy `planTotal >= planLimit`
- **Typy:** `PRICING_CONFIG` (dla wartości limitu), `AuthService.appRole` (dla roli)
- **Propsy:** brak (komponent globalny, standalone)

### `pricing.config.ts` (modyfikacja)

- **Opis:** Konfiguracja cennika. Zaktualizowano limit Free z 7 na 3 i tekst wiersza tabeli.
- **Zmienione pola:**
  - `PRICING_CONFIG.limits.free.planItems: 3`
  - `PRICING_FEATURE_CATEGORIES` — wiersz „Mój plan": `free: '3 pozycje'`
  - `PLAN_BENEFITS.free` — zaktualizuje się automatycznie (używa `PRICING_CONFIG.limits.free.planItems`)

## 5. Typy

### `PlanLimitExceededDialogData` (nowy, w pliku komponentu)

```typescript
export interface PlanLimitExceededDialogData {
    /** Aktualny limit pozycji planu dla konta Free (z details.free_limit API). */
    freeLimit: number;
    /** Limit pozycji planu dla konta Premium (z details.premium_limit API). */
    premiumLimit: number;
    /** URL strony cennika — '/pricing'. */
    upgradeUrl: string;
}
```

`PlanLimitExceededFreeErrorDto` jest już zdefiniowany w `shared/contracts/types.ts` (linia 801) — brak potrzeby nowych kontraktów API.

## 6. Zarządzanie stanem

- Stan planu (`items`, `total`) pozostaje bez zmian w `MyPlanService` — sygnały Angular.
- `planLimit` — nowy `computed` signal w `MyPlanDrawerComponent`, oparty na `authService.appRole()` oraz stałej `PRICING_CONFIG.limits.free.planItems`.
- `isPlanAtLimit` — nowy `computed` signal w `MyPlanDrawerComponent` (`planTotal >= planLimit`).
- Dialog jest jednorazowym side-effectem, nie wchodzi w stan aplikacji.

## 7. Integracja API

- **Endpoint:** `POST /plan/recipes` (istniejący) — odpowiedź `422` z body `PlanLimitExceededFreeErrorDto` dla Free userów po osiągnięciu limitu.
- **Zmiana w `MyPlanService.addToPlan()`:** operator `switchMap(async ...)` asynchronicznie odczytuje body błędu z `FunctionsHttpError.context.json()` i wykrywa kod `PLAN_LIMIT_EXCEEDED_FREE`. Przy wykryciu otwiera dialog i zwraca `false` (filtrowany przez `filter(v => v)`), dzięki czemu Observable kończy się bez `next()` ani `error()`.
- **Pozostałe błędy** (409, 404, 401, 500): bez zmian — trafiają do `mapError()` i `handleError()`.

## 8. Interakcje użytkownika

- Użytkownik Free klika „Dodaj do planu" gdy limit osiągnięty → API zwraca `422` → serwis otwiera `PlanLimitExceededDialogComponent` → spinner znika (`finalize`), brak snackbara.
- Dialog: „Zamknij" → zamknięcie; „Przejdź na Premium →" → nawigacja `/pricing` i zamknięcie.
- Użytkownik Free widzi licznik „X / 3 pozycji" w nagłówku drawera; kolor warn gdy `X >= 3`.
- Użytkownicy `premium` / `admin`: brak licznika w nagłówku, istniejące zachowanie bez zmian.

## 9. Warunki i walidacja

| Warunek | Komponent | Zachowanie |
|---|---|---|
| `appRole === 'user'` | `MyPlanDrawerComponent` — nagłówek | Wyświetl licznik `X / Y pozycji` |
| `planTotal >= planLimit` | `MyPlanDrawerComponent` — nagłówek | Klasa `--warn`, kolor błędu na liczniku |
| HTTP 422 + `error === 'PLAN_LIMIT_EXCEEDED_FREE'` | `MyPlanService.addToPlan()` | Otwórz dialog, zakończ Observable bez next/error |
| HTTP 422 bez kodu PLAN_LIMIT_EXCEEDED_FREE | `MyPlanService.addToPlan()` | `mapError()` → snackbar (istniejąca obsługa) |
| Inne błędy HTTP (409, 404, 401, 500) | `MyPlanService.addToPlan()` | Istniejąca obsługa bez zmian |

## 10. Obsługa błędów

- **422 PLAN_LIMIT_EXCEEDED_FREE:** dialog (nie snackbar). `switchMap(async ...)` asynchronicznie parsuje body via `FunctionsHttpError.context.json()`, otwiera dialog, zwraca `false`. `filter(v => v)` pomija emisję → `finalize` w komponencie zdejmuje spinner.
- **422 ogólny (limit 50 dla premium/admin):** istniejąca obsługa w `mapError()` — snackbar.
- **409 duplikat, 404, 401, 500:** bez zmian.
- **Błąd parsowania body:** `try/catch` w `switchMap` — fallback do `mapError()` z ogólnym 422.

## 11. Kroki implementacji

1. Zaktualizować `src/app/pages/pricing/pricing.config.ts`: `planItems: 7 → 3`, tekst wiersza tabeli `'7 pozycji' → '3 pozycje'`
2. Utworzyć `src/app/shared/components/plan-limit-exceeded-dialog/plan-limit-exceeded-dialog.component.ts` — interfejs `PlanLimitExceededDialogData`, komponent `pych-plan-limit-exceeded-dialog`
3. Utworzyć `plan-limit-exceeded-dialog.component.html` — dialog z ikoną, tytułem, treścią dynamiczną i przyciskami
4. Utworzyć `plan-limit-exceeded-dialog.component.scss` — style ikony i treści
5. Zmodyfikować `src/app/core/services/my-plan.service.ts`:
   - Dodać import `MatDialog`, `PlanLimitExceededFreeErrorDto`, `PlanLimitExceededDialogComponent`, `PlanLimitExceededDialogData`
   - Dodać `switchMap`, `filter` do importów RxJS
   - Wstrzyknąć `MatDialog`
   - Przepisać `addToPlan()` z `switchMap(async ...)` + `filter` + `tap` + `map`
   - Dodać metody `getStatusFromFunctionError()` i `getBodyFromFunctionError()`
6. Zmodyfikować `src/app/shared/components/my-plan-drawer/my-plan-drawer.component.ts`:
   - Dodać `AuthService`, `PRICING_CONFIG` do importów
   - Dodać `computed` signals: `planLimit`, `isPlanAtLimit`
7. Zmodyfikować `my-plan-drawer.component.html`: owinąć tytuł w `div.header-title`, dodać `span.limit-counter` z `@if (planLimit() !== null)`
8. Zmodyfikować `my-plan-drawer.component.scss`: style dla `__header-title`, `__limit-counter`, `__limit-counter--warn`
