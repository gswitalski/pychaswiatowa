# Plan implementacji widoku Regulamin Serwisu (Terms of Service)

## 1. Przegląd
Celem jest wdrożenie produkcyjnej wersji strony **„Regulamin Serwisu”** pod ścieżką **`/legal/terms`** poprzez:

- renderowanie treści z Markdown (1:1 z `docs/regulamin.md`) jako **asset** aplikacji,
- zapewnienie **stanu ładowania** i **stanu błędu** (brak „białej strony”),
- ujednolicenie etykiet w UI i routingu z „Warunki korzystania” na **„Regulamin Serwisu”**.

Funkcjonalność jest **frontend-only** (bez endpointów API).

## 2. Routing widoku

### Docelowa ścieżka
- `/legal/terms`

### Aktualna architektura routingu w projekcie
- Routing jest w `src/app/app.routes.ts`.
- Aplikacja ma 2 grupy tras, rozróżniane przez `canMatch`:
  - `MainLayoutComponent` + `authenticatedMatchGuard` (zalogowani),
  - `PublicLayoutComponent` + `guestOnlyMatchGuard` (goście).
- `/legal/terms` jest już skonfigurowane w obu grupach i ładuje `LegalPageComponent` z `data.page = 'terms'`.

### Zmiany w `src/app/app.routes.ts`
- Zmienić `data.title` dla tras `path: 'legal/terms'` (w obu grupach) z obecnego „Warunki korzystania (Regulamin)” na:
  - **`title: 'Regulamin Serwisu'`**

## 3. Struktura komponentów

Obecna strona prawna jest obsługiwana przez `LegalPageComponent`. Rekomendacja: **nie tworzyć nowego routa/strony**, tylko rozszerzyć istniejący komponent o render Markdown dla `pageId === 'terms'` (z zachowaniem placeholderów dla `privacy` i `publisher` na MVP).

Wysokopoziomowe drzewo komponentów:

- `LegalPageComponent` (`src/app/pages/legal/legal-page.component.*`)
  - `PageHeaderComponent` (tytuł z routingu)
  - `mat-card` (kontener treści, `mat-typography`)
    - `LegalMarkdownViewerComponent` (nowy, tylko dla `terms`)
      - loading: `mat-progress-bar` / skeleton
      - error: komunikat + przycisk „Odśwież”
      - success: wyrenderowany Markdown
    - placeholdery (pozostałe `pageId`)

## 4. Szczegóły komponentów

### `LegalPageComponent` (`src/app/pages/legal/legal-page.component.ts/.html/.scss`)
- **Opis komponentu**: wspólna strona dla `/legal/terms`, `/legal/privacy`, `/legal/publisher`. Tytuł pochodzi z `route.data.title`, a typ strony z `route.data.page`.
- **Główne elementy**:
  - `<pych-page-header [title]="title()" />`
  - `<mat-card class="legal-page__card mat-typography"> ... </mat-card>`
- **Obsługiwane interakcje (po zmianie)**:
  - dla `pageId === 'terms'`: obsługa kliknięcia „Odśwież” (ponowne pobranie pliku Markdown),
  - dla pozostałych: bez zmian (placeholder).
- **Obsługiwana walidacja / warunki**:
  - render Markdown tylko, gdy `pageId() === 'terms'`,
  - title w headerze pochodzi z routingu i musi być spójny: „Regulamin Serwisu”.
- **Typy**:
  - `LegalPageId = 'terms' | 'privacy' | 'publisher'` (już istnieje),
  - `LegalRouteData` (już istnieje).
- **Propsy**: brak.

Zakres zmian:
- W template podmienić blok `@case ('terms')` z placeholdera na użycie komponentu renderującego Markdown.
- Dla spójności UX, zostawić `mat-typography` na `mat-card` (typografia Material).

### `LegalMarkdownViewerComponent` (nowy) (`src/app/pages/legal/components/legal-markdown-viewer/legal-markdown-viewer.component.ts/.html/.scss`)
- **Opis komponentu**: odpowiedzialny za pobranie pliku Markdown z assetów i jego bezpieczne wyrenderowanie w UI (loading/error/success).
- **Główne elementy (Material)**:
  - loading: `mat-progress-bar mode="indeterminate"` (lub prosty skeleton tekstu),
  - error:
    - komunikat (np. `mat-card` content lub typograficzny `p`),
    - `button mat-stroked-button` „Odśwież” wywołujący ponowny load,
  - success: renderer Markdown (patrz sekcja 7).
- **Obsługiwane zdarzenia**:
  - inicjalne ładowanie przy `ngOnInit` lub `effect()` (rekomendacja: `effect()` + guard clause),
  - `reload()` po kliknięciu „Odśwież”.
- **Walidacja / warunki**:
  - nie zakładać, że plik istnieje — obsłużyć 404 i błędy sieciowe,
  - treść ma być prezentowana 1:1 (bez transformacji „biznesowej”).
- **Typy (ViewModel)**:
  - `LegalMarkdownLoadState = 'idle' | 'loading' | 'success' | 'error'`
  - `LegalMarkdownViewerVm` (opcjonalnie lokalny):
    - `state: LegalMarkdownLoadState`
    - `content: string | null`
    - `errorMessage: string | null`
- **Propsy**:
  - `assetPath: string` (np. `'/assets/legal/terms.md'`)
  - (opcjonalnie) `cacheKey?: 'terms' | ...` jeśli dodamy cache w serwisie.

### `FooterComponent` (`src/app/shared/components/footer/footer.component.ts`)
- **Opis komponentu**: globalna stopka z linkami prawnymi.
- **Zmiana**:
  - zaktualizować `legalLinks`:
    - **z**: `{ label: 'Warunki korzystania', path: '/legal/terms' }`
    - **na**: `{ label: 'Regulamin Serwisu', path: '/legal/terms' }`
- **Walidacja / warunki**: brak (statyczna lista).
- **Typy**: `LegalLinkVm` (już istnieje).
- **Propsy**: brak.

## 5. Typy

### Istniejące (do użycia)
- `LegalPageId`, `LegalRouteData` (lokalne w `LegalPageComponent`)

### Nowe (rekomendowane, lokalne dla widoku)
Wprowadzić typy **lokalne** (nie w `shared/contracts/types.ts`, bo to typy UI):

- `type LegalMarkdownLoadState = 'idle' | 'loading' | 'success' | 'error'`
- `interface LegalMarkdownLoadResult { content: string; }` (opcjonalnie)

Uwaga: `shared/contracts/types.ts` nie wymaga zmian, bo nie ma API/DTO dla regulaminu.

## 6. Zarządzanie stanem

Wymagany jest prosty stan ładowania treści assetu:

- **W komponencie** (najprostszy wariant):
  - `content = signal<string | null>(null)`
  - `isLoading = signal<boolean>(false)`
  - `errorMessage = signal<string | null>(null)`
  - metoda `load()` pobiera plik i aktualizuje sygnały (z użyciem `state.update()` gdzie ma to sens, aby uniknąć „flash”).

- **W serwisie** (wariant bardziej utrzymywalny, rekomendowany jeśli przewidujemy kolejne strony legal jako Markdown):
  - `LegalContentService` (np. `src/app/pages/legal/services/legal-content.service.ts`) przechowuje cache w pamięci i udostępnia `loadTerms()` / `getTermsState()`.
  - UI pozostaje proste, a ponowne wejście na stronę nie pobiera pliku ponownie (poza cache przeglądarki).

Nie jest potrzebny globalny store (NgRx).

## 7. Integracja API

### Brak endpointów
Feature nie używa backendu. Integracja polega na pobraniu statycznego pliku z assetów.

### Źródło treści i dystrybucja jako asset
- **Źródło prawdy**: `docs/regulamin.md`
- **Plik assetu**: rekomendowane umiejscowienie zgodne z konfiguracją `angular.json` (assets z `public/`):
  - `public/assets/legal/terms.md` → dostępne pod URL: **`/assets/legal/terms.md`**

### Synchronizacja `docs/regulamin.md` → asset
Zaimplementować prosty proces, aby zachować jedno źródło prawdy:

- Skrypt Node (rekomendacja):
  - `scripts/sync-legal-terms.mjs`
  - kopiuje `docs/regulamin.md` do `public/assets/legal/terms.md`
  - tworzy katalog docelowy, jeśli nie istnieje
  - kończy się kodem != 0 w razie błędu (żeby build nie przeszedł z „pustym” regulaminem)
- Wpięcie w NPM:
  - dodać `sync:legal` oraz uruchamiać w `prestart` i `prebuild` (lub w `build`/`start` jako pierwszą komendę).

### Pobieranie pliku z UI
Ponieważ projekt obecnie nie używa `HttpClient`, potrzebne będą:

- dodanie `provideHttpClient()` w `src/app/app.config.ts`,
- pobranie treści jako tekst:
  - `GET /assets/legal/terms.md` z `responseType: 'text'`.

### Renderowanie Markdown (bezpieczne XSS)
Rekomendowany wariant (zgodny z planem UI):

- dodać bibliotekę typu `ngx-markdown` (kompatybilną z Angular 21),
- skonfigurować render w trybie bezpiecznym:
  - nie ufać HTML z Markdown (domyślna sanitizacja Angular + ustawienia biblioteki),
  - dopuszczać typowe elementy (nagłówki, listy, linki, pogrubienia).

Alternatywa (jeśli nie chcemy `ngx-markdown`):
- własny renderer: `marked` → wynik HTML → sanitizacja (np. DOMPurify) → bindowanie w template.

## 8. Interakcje użytkownika

### US-LGL-001 — Wyświetlenie Regulaminu Serwisu na `/legal/terms`
- Użytkownik (gość lub zalogowany) wchodzi na `/legal/terms`.
- UI pokazuje:
  - **loading** podczas pobierania assetu,
  - następnie **treść regulaminu** wyrenderowaną z Markdown w `mat-card`,
  - nagłówek strony „Regulamin Serwisu” (z routingu).

### US-LGL-002 — Spójna nawigacja do Regulaminu
- Użytkownik widzi w stopce link „Regulamin Serwisu”.
- Kliknięcie przenosi na `/legal/terms`.

### Interakcja błędowa
- Jeśli nie da się pobrać pliku (np. 404):
  - UI pokazuje komunikat (czytelny, bez „białej strony”),
  - opcjonalnie: przycisk „Odśwież” wywołuje ponowną próbę.

## 9. Warunki i walidacja

### Warunki UI (routing / tytuły)
- `data.title` dla trasy `/legal/terms` musi brzmieć **„Regulamin Serwisu”** (w obu grupach routingu).

### Warunki renderowania treści
- Treść ma być **1:1** z `docs/regulamin.md`:
  - zachować `H1` z dokumentu,
  - zachować placeholdery typu `<YYYY-MM-DD>` (nie wykonywać żadnych podmian),
  - linki w treści powinny być klikalne.

### Wymagania bezpieczeństwa (XSS)
- Render Markdown musi być bezpieczny:
  - nie renderować niebezpiecznego HTML bez sanitizacji,
  - nie używać `bypassSecurityTrustHtml` na surowym HTML z parsera Markdown.

## 10. Obsługa błędów

- **Błąd pobrania assetu (404/500/network)**:
  - pokazać komunikat „Nie udało się wczytać Regulaminu. Spróbuj ponownie.”
  - umożliwić ponowną próbę (przycisk „Odśwież”).
- **Brak `HttpClient` / brak providera**:
  - zabezpieczyć implementację przez dodanie `provideHttpClient()` w `app.config.ts`.
- **Potencjalne problemy z cache**:
  - domyślnie przeglądarka cache’uje assety; na produkcji `outputHashing: all` dotyczy bundli, ale pliki z `public/` mogą nie mieć hashy — jeśli to problem, dopisać strategię cache-control po stronie hostingu (poza zakresem tego planu).

## 11. Kroki implementacji

1. **Ujednolicić nazewnictwo w routingu**
   - W `src/app/app.routes.ts` zmienić `data.title` dla `legal/terms` (w obu grupach) na „Regulamin Serwisu”.

2. **Ujednolicić etykietę w stopce**
   - W `src/app/shared/components/footer/footer.component.ts` podmienić label linku do `/legal/terms` na „Regulamin Serwisu”.

3. **Dodać asset z treścią regulaminu**
   - Utworzyć `public/assets/legal/terms.md`.
   - Wprowadzić proces synchronizacji z `docs/regulamin.md` (skrypt).

4. **Dodać skrypt synchronizacji**
   - Utworzyć `scripts/sync-legal-terms.mjs`:
     - copy `docs/regulamin.md` → `public/assets/legal/terms.md`,
     - tworzenie katalogów,
     - twardy błąd przy niepowodzeniu.
   - Zaktualizować `package.json`:
     - dodać `sync:legal`,
     - uruchamiać w `prestart` i `prebuild`.

5. **Włączyć pobieranie tekstu po HTTP**
   - W `src/app/app.config.ts` dodać `provideHttpClient()` w `providers`.

6. **Dodać renderer Markdown**
   - Wariant rekomendowany: dodać zależność `ngx-markdown` i skonfigurować provider (w `app.config.ts`) zgodnie z dokumentacją biblioteki.
   - Upewnić się, że sanitizacja jest włączona.

7. **Zaimplementować `LegalMarkdownViewerComponent`**
   - Logika:
     - `load()` pobiera `/assets/legal/terms.md` jako tekst,
     - ustawia stany `loading/error/content`,
     - `reload()` powtarza próbę.
   - UI:
     - `mat-progress-bar` w loading,
     - komunikat + przycisk „Odśwież” w error,
     - wyrenderowany Markdown w success (w `mat-typography`).

8. **Podpiąć renderer do `LegalPageComponent`**
   - W `legal-page.component.html` w `@case ('terms')` użyć `LegalMarkdownViewerComponent` zamiast placeholdera.

9. **Testy**
   - Jednostkowe (Vitest):
     - `LegalMarkdownViewerComponent`: loading → success, loading → error, reload działa.
   - E2E (Playwright):
     - `/legal/terms` pokazuje tytuł „Regulamin Serwisu” i renderuje nagłówki/listy z Markdown,
     - link w stopce ma etykietę „Regulamin Serwisu” i prowadzi do `/legal/terms`,
     - wstrzyknięcie błędu (np. brak assetu w buildzie testowym) pokazuje komunikat błędu zamiast pustej strony.

