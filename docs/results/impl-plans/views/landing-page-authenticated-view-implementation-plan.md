# Plan implementacji widoku Landing Page (wariant zalogowanego w App Shell)

## 1. Przegląd
Celem zmiany jest dostosowanie Landing Page (`/`) dla użytkownika zalogowanego tak, aby:
- widok był renderowany w **App Shell** (Sidebar + Topbar z profilem),
- **nie** wyświetlał publicznego nagłówka z CTA „Zaloguj się” / „Zarejestruj się”,
- zakres treści pozostał **bez zmian** (wyłącznie przepisy `PUBLIC`, te same sekcje landing).

Zmiana jest częścią US-020 („Publiczne widoki w trybie zalogowanego”), ale ten plan skupia się na Landing Page. Z perspektywy implementacji routing powinien jednak umożliwić ten sam mechanizm również dla `/explore` i `/explore/recipes/:id-:slug`, aby zachować spójność architektury.

## 2. Routing widoku
- **Ścieżka:** `/`
- **Wymaganie:** ta sama ścieżka ma działać dla gościa i zalogowanego, ale z innym layoutem.

### Docelowe zachowanie routingu
- **Gość**: `/` renderuje `PublicLayoutComponent` (z `PublicHeaderComponent`) + `LandingPageComponent`.
- **Zalogowany**: `/` renderuje `MainLayoutComponent` (App Shell) + `LandingPageComponent`.

### Plan zmian w routingu (Angular Router)
W `src/app/app.routes.ts`:
- rozdzielić publiczne ścieżki na 2 grupy layoutów **na tym samym `path: ''`**, ale wybierane warunkowo przez `canMatch`:
  - grupa „authenticated-public” pod `MainLayoutComponent` (dla zalogowanych),
  - grupa „public” pod `PublicLayoutComponent` (dla gości).

#### Guardy routingu
- Dodać funkcjonalne guardy (zgodnie z zasadami FE):
  - `authenticatedMatchGuard` (dla `canMatch`) – zwraca `true` jeśli istnieje sesja Supabase.
  - `guestOnlyMatchGuard` (dla `canMatch`) – zwraca `true` jeśli **nie** istnieje sesja.

Weryfikacja sesji:
- użyć `SupabaseService.auth.getSession()` (dozwolone przez zasady FE).

Zalecenie implementacyjne:
- w guardach unikać `router.navigate(...)` (side-effect). Zamiast tego zwracać `UrlTree` (np. w prywatnych trasach). Dla `canMatch` w tym przypadku wystarczy `true/false` (bo mamy alternatywną trasę dla gościa).

## 3. Struktura komponentów
Landing Page dla zalogowanego reużywa istniejący `LandingPageComponent` – różnica wynika z layoutu.

### Diagram drzewa komponentów (wariant zalogowanego)
```
PychMainLayoutComponent
└─ PychTopbarComponent
└─ PychSidebarComponent
└─ RouterOutlet
   └─ PychLandingPageComponent
      ├─ PychHeroComponent
      ├─ PychPublicRecipesSearchComponent
      └─ PychPublicRecipesSectionComponent (x3)
         └─ PychRecipeCardComponent (lista kart)
```

### Diagram drzewa komponentów (wariant gościa – bez zmian)
```
PychPublicLayoutComponent
└─ PychPublicHeaderComponent (CTA Login/Register)
└─ RouterOutlet
   └─ PychLandingPageComponent (...)
```

## 4. Szczegóły komponentów
### `MainLayoutComponent` (`src/app/layout/main-layout/*`)
- **Opis komponentu:** App Shell (Sidebar + Topbar + obszar treści).
- **Główne elementy:** `mat-sidenav-container`, `pych-sidebar`, `pych-topbar`, `router-outlet`.
- **Obsługiwane interakcje:**
  - toggle sidebar (mobile),
  - menu użytkownika w topbar (wylogowanie),
  - nawigacja po linkach w sidebar.
- **Obsługiwana walidacja:** brak (layout).
- **Typy:** brak nowych.
- **Propsy:** brak.

### `PublicLayoutComponent` (`src/app/layout/public-layout/*`)
- **Opis komponentu:** Layout dla gości (public header + treść).
- **Główne elementy:** `pych-public-header`, `router-outlet`.
- **Obsługiwane interakcje:** linki login/register.
- **Obsługiwana walidacja:** brak.
- **Typy:** brak nowych.
- **Propsy:** brak.

### `LandingPageComponent` (`src/app/pages/landing/landing-page.component.*`)
- **Opis komponentu:** główny landing (hero + wyszukiwarka + 3 sekcje z kuratorowanymi listami).
- **Główne elementy:** `pych-hero`, `pych-public-recipes-search`, `pych-public-recipes-section`.
- **Obsługiwane zdarzenia:**
  - `onSearchSubmit(query: string)` → nawigacja do `/explore?q=...`,
  - `onSectionRetry(sectionKey)` → ponowne ładowanie sekcji.
- **Obsługiwana walidacja (UI):**
  - `query` w wyszukiwaniu: jeśli integracja z Explore wymaga `q` o min. długości 2 (API: `GET /public/recipes?q=`), to komponent wyszukiwarki powinien:
    - blokować submit dla `q.length === 1`,
    - albo przepuszczać i obsłużyć błąd `400` czytelnym komunikatem.
  - sekcje: brak walidacji wejścia (stałe query).
- **Typy:**
  - DTO: `PaginatedResponseDto<PublicRecipeListItemDto>`
  - VM: `RecipeCardData[]` (do kart)
- **Propsy:** brak.

### Guardy routingu (nowe)
- **Opis:** wybór layoutu na podstawie sesji.
- **Obsługiwane zdarzenia:** nawigacja routingu.
- **Walidacja:**
  - sesja istnieje/nie istnieje.
- **Typy:** brak nowych (użycie `Session | null` z Supabase).

## 5. Typy
W tej zmianie nie są wymagane nowe DTO.

Wykorzystywane istniejące typy (z `shared/contracts/types.ts`):
- `PublicRecipeListItemDto`
- `PaginatedResponseDto<T>`

Dodatkowo (z SDK Supabase, lokalnie w guardach):
- `Session | null` (wynik `supabase.auth.getSession()`).

## 6. Zarządzanie stanem
- **LandingPageComponent**: pozostaje przy obecnym podejściu opartym o **signals** (`sectionsState`) oraz zachowaniu „keep previous data visible” podczas przeładowań sekcji.
- **Routing/layout**: stan „zalogowany/niezalogowany” jest weryfikowany w `canMatch` na podstawie sesji.

Opcjonalnie (jeśli zespół chce ograniczyć liczbę wywołań `getSession()`):
- wprowadzić w `AuthService` sygnał `session` oraz aktualizację przez `onAuthStateChange`, a guardy oprzeć o ten sygnał.

## 7. Integracja API
Landing Page (zarówno dla gościa, jak i zalogowanego) pobiera dane identycznie:
- `GET /public/recipes` (Edge Function: `supabase.functions.invoke('public/recipes?...')`)

### Typy żądania i odpowiedzi
- **Request (query params):**
  - `page?: number`, `limit?: number`, `sort?: string`, `q?: string`
- **Response:** `PaginatedResponseDto<PublicRecipeListItemDto>`

Warunek domenowy:
- niezależnie od kontekstu użytkownika, landing ma prezentować wyłącznie przepisy o widoczności `PUBLIC`.

## 8. Interakcje użytkownika
- **Wejście na `/` jako zalogowany:**
  - widoczny Sidebar + Topbar (profil + wylogowanie) i content landingu,
  - brak CTA „Zaloguj się” / „Zarejestruj się”.
- **Wejście na `/` jako gość:**
  - widoczny publiczny header z CTA.
- **Wyszukiwanie na landing:**
  - submit → przejście do `/explore` z `q` w query string.
- **Retry sekcji:**
  - przeładowanie danej sekcji bez „białego flasha” (zachować poprzednie dane, jedynie stan `isLoading`).

## 9. Warunki i walidacja
- **Warunek routingu:**
  - `authenticatedMatchGuard`: wymaga istnienia sesji.
  - `guestOnlyMatchGuard`: wymaga braku sesji.
- **Warunki API:**
  - `q` (jeśli użyte) powinno mieć **min. 2 znaki** (API zwraca `400` dla za krótkiego `q`).
  - UI powinno zapobiec wysyłaniu `q.length === 1` lub wyświetlić czytelny komunikat błędu po odpowiedzi `400`.

## 10. Obsługa błędów
- **Błąd pobierania sekcji:**
  - utrzymać dotychczasowe zachowanie: komunikat w sekcji + możliwość retry.
- **Błędy routingu/sesji:**
  - jeśli `getSession()` zwróci błąd lub timeout: traktować użytkownika jak gościa (fallback do `PublicLayoutComponent`).
- **Błąd `400` dla `q` (min 2 znaki):**
  - komunikat walidacyjny w komponencie wyszukiwarki (preferowane) albo obsługa błędu w widoku `/explore`.

## 11. Kroki implementacji
1. W `src/app/core/guards/` dodać nowe guardy `authenticatedMatchGuard` i `guestOnlyMatchGuard` (funkcyjne), wykorzystujące `SupabaseService.auth.getSession()`.
2. Zmodyfikować `src/app/app.routes.ts`:
   - dodać grupę tras pod `MainLayoutComponent` dla ścieżek publicznych (`''`, `explore`, `explore/recipes/:idslug`) z `canMatch: [authenticatedMatchGuard]`.
   - istniejącą grupę publiczną pod `PublicLayoutComponent` opatrzyć `canMatch: [guestOnlyMatchGuard]`.
   - upewnić się, że kolejność tras pozwala na dopasowanie właściwej grupy (zalogowany → MainLayout, gość → PublicLayout).
3. Zweryfikować, że `LandingPageComponent` renderuje się poprawnie w `MainLayoutComponent` (spacing, szerokości, responsywność) – ewentualnie dodać drobne style lokalne w `landing-page.component.scss`, bez łamania wyglądu dla gościa.
4. Zweryfikować akceptację US-020 dla Landing:
   - `/` jako zalogowany: brak CTA login/register, widoczny profil + możliwość przejścia do `/dashboard` (Sidebar).
5. (Opcjonalnie, ale zalecane w ramach spójności US-020) Przetestować analogiczne zachowanie dla `/explore` i `/explore/recipes/:idslug` po tej samej zmianie routingu, aby nie wprowadzić niespójności w publicznych ścieżkach.
