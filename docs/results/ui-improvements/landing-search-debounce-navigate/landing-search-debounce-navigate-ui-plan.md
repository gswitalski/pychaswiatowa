# Plan UI: landing-search-debounce-navigate

## Problem i cel

Na stronie głównej (`/`) użytkownik musi wpisać frazę i kliknąć **Szukaj** (lub Enter), aby przejść na `/explore?q=…`. Celem jest **automatyczne przejście po debounce** (≥ 3 znaki), bez przycisku na landingu, z **Enter = natychmiast** oraz spójnością z `/explore` (tam debounce już działa — dopracować a11y).

## Decyzje z odpowiedzi

| Temat | Decyzja |
|-------|---------|
| Próg | Nawigacja / commit po **≥ 3 znakach**; 1–2 znaki — tylko podpowiedź, bez przejścia |
| Debounce | **350 ms** |
| Przycisk „Szukaj” | **Ukryty** na landingu (`showResults=false`) |
| Enter | **Natychmiast** (pomija debounce), przy ≥ 3 znakach |
| Landing API | **Brak** `loadInitial` w kontekście `landing` — tylko nawigacja |
| Explore | Zachowanie debounce **bez zmian logiki**; dodać **aria-live** jak na landingu |
| Podpowiedź | Utrzymać / lekko wzmocnić hint przy 1–2 znakach |

### Założenia

- Puste pole na landingu po debounce **nie** nawiguje (użytkownik zostaje na `/`).
- Czyszczenie pola na `/explore` po debounce nadal aktualizuje URL (feed) — jak dziś.
- Enter przy 1–2 znakach: bez nawigacji (jak submit dziś).

### Uwaga o sprzeczności odpowiedzi

Wybrano też wariant triggera „bez Enter” vs osobno **Enter natychmiast** — stosujemy **Enter natychmiast** (dedykowane pytanie).

## Zakres plików

| Plik | Zmiana |
|------|--------|
| `src/app/pages/explore/services/public-recipes.facade.ts` | Skip `loadInitial` dla `landing`; opcjonalny strumień / hook po debounced commit ≥ 3 |
| `src/app/pages/landing/components/public-recipes-search/public-recipes-search.ts` | Subskrypcja debounced commit → `searchSubmit`; landing Enter bez podwójnej emisji; aria-live |
| `src/app/pages/landing/components/public-recipes-search/public-recipes-search.html` | Ukryć przycisk gdy `!showResults()`; region `aria-live` |
| `src/app/pages/landing/components/public-recipes-search/public-recipes-search.scss` | Układ bez przycisku (jeśli potrzebne) |
| `src/app/pages/explore/explore-page.component.html` | `aria-live` po zatwierdzeniu wyszukiwania |
| `src/app/pages/explore/explore-page.component.ts` | Sygnał/komunikat dla aria-live po `onQueryCommit` |
| `public-recipes.facade.spec.ts` lub `public-recipes-search.spec.ts` | Nowy plik Vitest — landing debounce emit, brak API na landing |

**Zmiany globalne:** brak (tylko landing + explore).

## Per widok

### Landing (`pych-public-recipes-search`, `showResults=false`)

- **Mobile-first:** pole na pełną szerokość kontenera; bez przycisku — jedna linia formularza.
- Po `valueChanges` → facade debounce 350 ms → przy `context===landing` i `trim.length >= 3` → `searchSubmit.emit` → `LandingPageComponent.onSearchSubmit` → `router.navigate(['/explore'], { q })`.
- **Enter:** `onSearchSubmit()` emituje od razu (≥ 3), bez wołania ścieżki ładującej API na landingu.
- **Stany:** `shortQueryHintVisible` bez zmiany semantyki; `aria-live="polite"` z krótkim tekstem np. „Wyszukiwanie: {fraza}”.
- **Tokeny:** istniejące `--mat-sys-*` w SCSS komponentu.

### Explore

- Debounce 350 ms + URL sync — **bez refaktoru**.
- Dodać `aria-live` zsynchronizowane z `onQueryCommit` (search / powrót do feedu).

## Testy Vitest

1. **Facade `landing`:** `updateQueryDraft` + tick debounce — **nie** wywołuje `PublicRecipesService.getPublicRecipesFeed`; emit gotowości frazy ≥ 3.
2. **PublicRecipesSearch:** `showResults=false` — po debounce emit `searchSubmit`; Enter ≥ 3 emit bez czekania; Enter z 2 znakami — brak emit.
3. **Explore (opcjonalnie):** `onQueryCommit` ustawia komunikat aria (jeśli wydzielona metoda).

## Weryfikacja

| Krok | Status |
|------|--------|
| lint | PASS |
| Vitest (`public-recipes.facade.spec.ts`) | PASS |
| Vitest (pełny `test:run`) | WYMAGA_WERYFIKACJI — 1 istniejący timeout w `admin-recipes-page.component.spec.ts` (niezwiązany ze zmianą) |
| build | PASS |
| Przegląd 375 / 768 / 1280 (landing + explore) | WYMAGA_WERYFIKACJI — landing: brak przycisku „Szukaj”, pole działa; pełny debounce→/explore nie dokończony w sesji przeglądarki |