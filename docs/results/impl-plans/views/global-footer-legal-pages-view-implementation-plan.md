# Plan implementacji widoku Global footer + strony legal

## 1. Przegląd
Celem jest wdrożenie **globalnej stopki** widocznej na wszystkich stronach aplikacji (publicznych, prywatnych i auth) oraz dodanie trzech **publicznych stron informacyjnych** dostępnych pod stabilnymi ścieżkami:
- `/legal/terms` (Warunki korzystania / Regulamin)
- `/legal/privacy` (Polityka prywatności)
- `/legal/publisher` (Wydawca serwisu)

W MVP treści stron legal mogą być **placeholderami**. Funkcjonalność **nie wymaga zmian w API**.

Wymagania kluczowe (US-057):
- stopka zawiera tekst: `© {bieżący_rok} PychaŚwiatowa. Wszelkie prawa zastrzeżone.` (rok liczony automatycznie),
- linki w stopce działają jako nawigacja SPA (bez przeładowania),
- stopka jest elementem treści (nie-sticky),
- na mobile/tablet stopka nie może „wchodzić” pod przypięty Bottom Bar (padding-bottom + safe-area),
- wyjątek: techniczny widok `/auth/callback` **może nie wyświetlać stopki**.

## 2. Routing widoku
W projekcie routing jest rozdzielony na dwie grupy tras w `src/app/app.routes.ts`:
- grupa dla zalogowanych (`MainLayoutComponent`, `canMatch: authenticatedMatchGuard`)
- grupa dla gości (`PublicLayoutComponent`, `canMatch: guestOnlyMatchGuard`)

Aby strony legal działały dla **gościa i zalogowanego**, należy dodać te same trasy do **obu** grup (dzieje się tak już dla części tras publicznych jak `/` i `/explore`).

Proponowane definicje tras (w obu grupach):
- `path: 'legal/terms'` → `LegalPageComponent` z `data.page = 'terms'`
- `path: 'legal/privacy'` → `LegalPageComponent` z `data.page = 'privacy'`
- `path: 'legal/publisher'` → `LegalPageComponent` z `data.page = 'publisher'`

## 3. Struktura komponentów
### 3.1. Stopka (globalna)
- `MainLayoutComponent`
  - `<pych-topbar />`
  - `<main>` (scroll)
    - `<router-outlet />`
    - `<pych-footer />` (globalna stopka; ukrywana na `/auth/callback`)
  - `<pych-bottom-navigation-bar />` (na mobile/tablet)
  - `<pych-my-plan-fab />`

- `PublicLayoutComponent`
  - `<pych-public-header />`
  - `<main>`
    - `<router-outlet />`
    - `<pych-footer />` (globalna stopka; ukrywana na `/auth/callback`)

### 3.2. Strony legal
- `LegalPageComponent` (jeden komponent obsługujący trzy ścieżki przez `route.data`)
  - `<pych-page-header />` (tytuł strony)
  - kontener treści (np. `mat-card` + typografia Material)

## 4. Szczegóły komponentów

### `FooterComponent` (`pych-footer`)
- **Opis komponentu**: Globalna stopka aplikacji. Renderuje informację o prawach autorskich + 3 linki do stron legal. Jest elementem treści (nie-sticky).
- **Lokalizacja**: `src/app/shared/components/footer/`
  - `footer.component.ts`
  - `footer.component.html`
  - `footer.component.scss`
- **Główne elementy**:
  - kontener stopki (`<footer>` lub `<div role="contentinfo">`)
  - sekcja tekstu copyright
  - lista linków (np. `<nav aria-label="Linki prawne">`)
  - linki jako `routerLink`:
    - `/legal/terms`
    - `/legal/privacy`
    - `/legal/publisher`
- **Obsługiwane interakcje**:
  - kliknięcie linku → nawigacja SPA do strony legal (bez reloadu)
- **Obsługiwana walidacja**: brak
- **Typy**:
  - brak DTO; ewentualnie lokalny typ VM:
    - `type LegalLinkVm = { label: string; path: string; ariaLabel?: string }`
- **Propsy**: brak
- **Uwagi UX/a11y**:
  - linki muszą mieć jednoznaczne etykiety (widoczny tekst wystarczy; opcjonalnie `aria-label` dla doprecyzowania),
  - zachować czytelny fokus (`:focus-visible`) i kontrast (używać zmiennych Material `--mat-sys-*`),
  - układ responsywny: na desktop poziomo, na mobile pionowo (lub zawijanie).

### Integracja stopki w `MainLayoutComponent`
- **Opis**: Wpięcie `<pych-footer />` do layoutu prywatnego/publicznego dla zalogowanych, z uwzględnieniem:
  - wyjątku `/auth/callback`,
  - `padding-bottom` na mobile/tablet (żeby stopka nie była zasłonięta przez `pych-bottom-navigation-bar`).
- **Główne elementy**:
  - stopka powinna znaleźć się **wewnątrz** elementu `<main class="main-layout__main">`, **po** `<router-outlet />`,
  - ukrywanie na `/auth/callback`: warunek oparty o aktualny URL.
- **Obsługiwane interakcje**: brak (poza linkami w stopce)
- **Walidacja**: brak
- **Typy**:
  - sygnał/`computed` np. `isAuthCallbackRoute`
- **Propsy**: brak

### Integracja stopki w `PublicLayoutComponent`
- **Opis**: Wpięcie `<pych-footer />` analogicznie jak w `MainLayoutComponent`.
- **Główne elementy**:
  - dodać kontener `<main>` (jeśli go nie ma) i renderować stopkę pod `router-outlet`,
  - ukrywanie na `/auth/callback`: identyczny warunek jak w MainLayout.
- **Obsługiwane interakcje**: brak (poza linkami w stopce)
- **Walidacja**: brak
- **Typy**:
  - sygnał/`computed` np. `isAuthCallbackRoute`
- **Propsy**: brak

### `LegalPageComponent` (obsługa `/legal/*`)
- **Opis komponentu**: Publiczny widok statyczny dla stron legal. W MVP renderuje placeholder treści zależnie od `route.data.page`.
- **Lokalizacja**: `src/app/pages/legal/legal-page.component.{ts,html,scss}` (lub analogiczny katalog `src/app/pages/legal/`).
- **Główne elementy**:
  - `pych-page-header` z tytułem zależnym od `route.data`:
    - `Warunki korzystania (Regulamin)`
    - `Polityka prywatności`
    - `Wydawca serwisu`
  - treść w kontenerze z typografią (np. `mat-card` + `mat-typography`)
  - placeholder: krótki tekst „Treść zostanie uzupełniona wkrótce.”
- **Obsługiwane interakcje**: brak
- **Obsługiwana walidacja**: brak
- **Typy**:
  - `type LegalPageId = 'terms' | 'privacy' | 'publisher'`
  - `interface LegalRouteData { page: LegalPageId; title: string }`
- **Propsy**: brak (dane z `ActivatedRoute`)

## 5. Typy
Nowe typy (frontend-only) — opcjonalne, ale zalecane dla czytelności i bezpieczeństwa:
- `LegalPageId = 'terms' | 'privacy' | 'publisher'`
- `LegalRouteData` (dla `route.data`)
- `LegalLinkVm` (lista linków w stopce)

Brak nowych DTO / kontraktów API.

## 6. Zarządzanie stanem
- **Stopka**:
  - `currentYear`: wartość liczona w komponencie (np. `new Date().getFullYear()`), bez przechowywania w globalnym stanie.
- **Ukrywanie stopki na `/auth/callback`**:
  - w layoutach: sygnał/`computed` wyznaczany z aktualnego URL routera (np. mapowanie `NavigationEnd` → `urlAfterRedirects`).

## 7. Integracja API
Brak — strony legal to routy SPA ze statyczną treścią (placeholder), a stopka nie wymaga danych z backendu.

## 8. Interakcje użytkownika
- **Kliknięcie linków w stopce**:
  - nawigacja do `/legal/terms`, `/legal/privacy`, `/legal/publisher` bez przeładowania strony.
- **Dostępność**:
  - tabulacja przechodzi po linkach w logicznej kolejności,
  - fokus jest widoczny,
  - `aria-label` dla nawigacji stopki (np. `aria-label="Linki prawne"`).

## 9. Warunki i walidacja
- **Brak walidacji formularzy** (strony statyczne).
- **Warunek layoutowy**:
  - stopka ukryta na `/auth/callback` (opcjonalnie zgodnie z wymaganiem).
- **Warunek UX na mobile/tablet (nie zasłaniać przez Bottom Bar)**:
  - stopka musi być częścią kontentu z odpowiednim `padding-bottom` w obszarze scrollowalnym.
  - W `MainLayoutComponent` obecnie `main-layout__main` ma dynamiczny `padding-bottom` oparty o `--pych-bottom-bar-height` + `safe-area-inset-bottom` — stopka musi znaleźć się wewnątrz tego elementu, aby korzystać z tego paddingu.
  - Jeśli w przyszłości Bottom Bar będzie renderowany również w `PublicLayoutComponent`, należy zastosować analogiczną strategię paddingu.

## 10. Obsługa błędów
- **Nawigacja**: standardowa obsługa routera (brak wywołań API).
- **Fallback**: jeśli `route.data.page` jest nieznane / brakujące, `LegalPageComponent` powinien:
  - ustawić bezpieczny tytuł (np. „Informacje”),
  - pokazać ogólny placeholder.

## 11. Kroki implementacji
1. Utworzyć komponent stopki `FooterComponent` w `src/app/shared/components/footer/` (standalone, selector `pych-footer`).
2. Zaimplementować layout stopki:
   - tekst `© {rok} PychaŚwiatowa. Wszelkie prawa zastrzeżone.`,
   - linki `routerLink` do `/legal/terms`, `/legal/privacy`, `/legal/publisher`,
   - responsywne style + a11y (`nav aria-label`, focus-visible).
3. Wpiąć `<pych-footer />` do `MainLayoutComponent`:
   - umieścić stopkę **wewnątrz** `<main class="main-layout__main">` (pod `router-outlet`),
   - dodać warunek ukrycia na `/auth/callback`.
4. Wpiąć `<pych-footer />` do `PublicLayoutComponent` analogicznie:
   - dodać/ustandaryzować kontener `<main>` pod `pych-public-header`,
   - dodać warunek ukrycia na `/auth/callback`.
5. Dodać stronę legal jako jeden komponent `LegalPageComponent` w `src/app/pages/legal/`:
   - odczyt `route.data` (`page`, `title`),
   - render: `pych-page-header` + placeholder treści.
6. Zarejestrować routy `/legal/terms`, `/legal/privacy`, `/legal/publisher` w `src/app/app.routes.ts`:
   - dodać je do grupy tras `MainLayoutComponent`,
   - dodać je do grupy tras `PublicLayoutComponent`,
   - przekazać przez `data` odpowiedni `page` i `title`.
7. Sprawdzić ręcznie:
   - widoczność stopki na widokach publicznych, prywatnych i auth,
   - brak stopki na `/auth/callback`,
   - poprawne działanie linków i brak przeładowania strony,
   - na mobile/tablet: stopka nie jest przykryta przez Bottom Bar (w `MainLayoutComponent`).
