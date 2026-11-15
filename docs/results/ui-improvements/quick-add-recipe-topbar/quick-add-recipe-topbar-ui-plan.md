# Plan poprawy UI: quick-add-recipe-topbar

## Problem i cel

Zalogowany użytkownik na mobile/tablet musi szukać „Dodaj przepisu” w menu bocznym (dół listy) lub na dashboardzie przy pustej liście ostatnich przepisów. Oczekiwany jest stały skrót u góry oraz na mobile/tablet bezpośrednie wejście w dodawanie ze zdjęcia (AI), z możliwością zmiany trybu na ekranie assist.

## Decyzje z odpowiedzi i założenia

| Decyzja | Wybór |
|--------|--------|
| Umiejscowienie | Przycisk w **topbarze** |
| Widoczność | **Zalogowany** (`isAuthenticated`), **ukryty** na `/recipes/new*` (kreator) |
| Mobile/tablet | Nawigacja do `/recipes/new/assist?source=image` |
| Desktop | Nawigacja do `/recipes/new/start` (jak sidebar) |
| Dodatki | `?source=image`, aria-label i cel dotykowy ≥ 48 px |

**Założenia:** widoczność skrótu = `shouldShowSidebar()` (jak reszta prywatnej nawigacji); administrator w panelu admin nie korzysta z tego topbara; link w sidebarze bez zmian; bez bottom sheet ani auto-aparatu.

## Zakres: pliki

| Plik | Zmiana |
|------|--------|
| `src/app/layout/main-layout/components/topbar/topbar.component.html` | Przycisk „Dodaj przepis” |
| `src/app/layout/main-layout/components/topbar/topbar.component.ts` | Widoczność, nawigacja, etykiety a11y |
| `src/app/layout/main-layout/components/topbar/topbar.component.scss` | Min. 48 px, mobile (ikona + ukryty tekst opcjonalnie) |
| `src/app/layout/main-layout/components/topbar/topbar.component.spec.ts` | Testy widoczności i nawigacji |
| `src/app/pages/recipes/recipe-new-assist/recipe-new-assist-page.component.ts` | Odczyt `source` z query |
| `src/app/pages/recipes/recipe-new-assist/recipe-new-assist-page.component.spec.ts` | Test inicjalizacji `source=image` |

**Zmiany globalne:** tak — **topbar** (`layout/`), dotyczy wszystkich prywatnych widoków z `shouldShowSidebar`, poza kreatorem przepisu.

## Per widok / komponent

### Topbar

- **Układ:** w `topbar__right`, przed linkiem Cennik i menu użytkownika; na mobile zachować miejsce obok avatara (flex, `flex-shrink: 0` na przycisku).
- **Mobile-first:** `mat-flat-button` primary na desktopie z ikoną `add` + tekst „Dodaj przepis”; na `max-width: 959px` — `mat-icon-button` lub przycisk z samą ikoną + `aria-label="Dodaj przepis ze zdjęcia AI"` (mobile) / `"Dodaj przepis"` (desktop przy pełnym przycisku).
- **Stany:** brak loading (akcja nawigacji).
- **Dostępność:** `aria-label` zależny od trybu; `min-width` / `min-height` 48 px; focus Material.
- **Tokeny:** `--mat-sys-primary`, `--mat-sys-on-primary`.

### Recipe New Assist

- Przy inicjalizacji: jeśli `queryParamMap` ma `source` ∈ `{ text, image, url }`, ustaw `source` signal (walidacja, ignoruj nieznane).
- Zachowanie przełącznika Tekst/Obraz/URL bez zmian.

## Testy Vitest

1. **Topbar:** przycisk widoczny gdy `shouldShowSidebar=true` i URL `/dashboard`; ukryty na `/recipes/new/assist`; klik mobile → `navigate` z `assist` + `source=image`; klik desktop → `/recipes/new/start`.
2. **Assist:** z `ActivatedRoute` mock `source=image` → `component.source()` === `'image'`.

## Weryfikacja

| Kroku | Status | Uwagi |
|-------|--------|--------|
| `npm run lint` | PASS | |
| `npm run test:run` | PASS | 428 testów |
| `npm run build` | PASS | istniejące ostrzeżenia budżetu SCSS (pricing, assist) |
| Przegląd 375 / 768 / 1280 | NIE_WYKONANO | brak działającego `ng serve` w sesji |