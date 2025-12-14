# Plan implementacji zmian widoczności Sidebara i nawigacji "Moja Pycha"

## 1. Przegląd

Plan ten opisuje implementację zmian w architekturze nawigacji aplikacji, które wprowadzają warunkowe wyświetlanie Sidebara oraz dodają nowy element nawigacji poziomej "Moja Pycha" w Topbarze. Zmiany te mają na celu lepsze rozróżnienie między sekcją publiczną (dla zalogowanych użytkowników przeglądających publiczne treści) a sekcją prywatną (osobistą przestrzenią użytkownika do zarządzania swoimi przepisami i kolekcjami).

Główne cele:
- Sidebar jest widoczny **wyłącznie** w sekcjach prywatnych: `/dashboard`, `/recipes/**`, `/collections/**`, `/settings/**`
- Na widokach publicznych dla zalogowanych (`/`, `/explore`) Sidebar jest ukryty
- W Topbarze dodany jest link "Moja Pycha" prowadzący do `/dashboard` (widoczny po lewej stronie avatara użytkownika)
- Nazwa "Dashboard" w UI jest zastąpiona przez "Moja Pycha" (route pozostaje `/dashboard`)

Wymagania spełniane przez implementację: **US-023** (Wejście do "Moja Pycha" z Topbara).

## 2. Routing widoku

Zmiany w routingu nie dotyczą struktury ścieżek, ale wpływają na logikę renderowania komponentów layoutu. Zmodyfikowane zostaną następujące aspekty:

- **MainLayoutComponent** musi warunkowo renderować Sidebar w zależności od aktualnej ścieżki
- Ścieżki wymagające Sidebara (prywatne):
  - `/dashboard`
  - `/recipes/**` (wszystkie podstrony)
  - `/collections/**` (wszystkie podstrony)
  - `/settings/**` (wszystkie podstrony)
- Ścieżki bez Sidebara (publiczne dla zalogowanych):
  - `/` (Landing Page dla zalogowanych)
  - `/explore` (Explore dla zalogowanych)
  - `/recipes/:id` (szczegóły publicznego przepisu dla zalogowanych - wymaga osobnego potraktowania)

**Uwaga techniczna:** Ścieżka `/recipes/:id` jest dostępna zarówno dla gości (w `PublicLayout`), jak i dla zalogowanych (w `MainLayout`). W kontekście zalogowanego użytkownika, gdy wyświetla własny przepis lub przepis prywatny, Sidebar **powinien być widoczny**. Gdy zalogowany użytkownik przegląda publiczny przepis innego autora z poziomu explore, Sidebar **nie powinien być widoczny**.

## 3. Struktura komponentów

Hierarchia komponentów pozostaje bez zmian, ale zmienia się logika warunkowego renderowania:

```text
pych-main-layout (Standalone Component)
├── mat-sidenav-container
│   ├── mat-sidenav (@if (shouldShowSidebar()) - WARUNKOWE RENDEROWANIE)
│   │   └── pych-sidebar
│   └── mat-sidenav-content
│       ├── pych-topbar (ZAWSZE WIDOCZNY)
│       │   ├── mat-toolbar
│       │   │   ├── Hamburger Menu (@if (isMobile() && shouldShowSidebar()))
│       │   │   ├── pych-breadcrumbs
│       │   │   ├── pych-omnibox
│       │   │   ├── Link "Moja Pycha" (NOWY - @if (!shouldShowSidebar()))
│       │   │   └── User Avatar / Menu
│       └── router-outlet
```

## 4. Szczegóły komponentów

### MainLayoutComponent (`layout/main-layout`)

**Zmiany:**
- Dodanie logiki określającej, czy Sidebar powinien być widoczny
- Implementacja metody/sygnału `shouldShowSidebar()` sprawdzającego aktualną ścieżkę

**Główne elementy:**
- `mat-sidenav-container` (bez zmian)
- `mat-sidenav` z dyrektywą `@if (shouldShowSidebar())` - warunkowe renderowanie
- `mat-sidenav-content` (bez zmian)

**Obsługiwane interakcje:**
- Subskrypcja na `Router.events` do śledzenia zmian URL
- Aktualizacja sygnału `shouldShowSidebar` na podstawie aktualnej ścieżki
- Zarządzanie trybem sidebara (side/over) w zależności od viewportu (istniejąca logika pozostaje)

**Typy:**
- Brak nowych typów

**Logika określania widoczności Sidebara:**
```typescript
// Ścieżki wymagające Sidebara (prywatne sekcje)
const privatePaths = ['/dashboard', '/recipes', '/collections', '/settings'];

shouldShowSidebar(): boolean {
    const currentUrl = this.router.url;
    return privatePaths.some(path => currentUrl.startsWith(path));
}
```

**Propsy:**
- Brak zmian

### SidebarComponent (`layout/components/sidebar`)

**Zmiany:**
- Aktualizacja etykiety "Dashboard" na "Moja Pycha"
- Route pozostaje `/dashboard`

**Główne elementy:**
- `mat-nav-list` (bez zmian)
- `mat-list-item` (aktualizacja labela dla Dashboard)
- `mat-icon` (bez zmian)

**Dane - zaktualizowana lista linków:**
```typescript
readonly navigationItems: NavigationItem[] = [
    {
        label: 'Moja Pycha',  // ZMIENIONE z 'Dashboard'
        route: '/dashboard',
        icon: 'dashboard',
    },
    {
        label: 'Przepisy',
        route: '/recipes',
        icon: 'menu_book',
    },
    {
        label: 'Kolekcje',
        route: '/collections',
        icon: 'collections_bookmark',
    },
    {
        label: 'Ustawienia',
        route: '/settings',
        icon: 'settings',
    },
];
```

**Obsługiwane interakcje:**
- Bez zmian

**Typy:**
- Wykorzystanie istniejącego `NavigationItem`

**Propsy:**
- Bez zmian

### TopbarComponent (`layout/components/topbar`)

**Zmiany:**
- Dodanie linku "Moja Pycha" widocznego **wyłącznie** gdy Sidebar jest ukryty
- Link umieszczony między Omnibox a avatarem użytkownika (po lewej stronie avatara)
- Warunkowe wyświetlanie przycisku menu (hamburgera) - tylko gdy Sidebar jest widoczny i urządzenie jest mobilne

**Główne elementy HTML:**
- `mat-toolbar` (bez zmian)
- `div.topbar__left`:
  - Przycisk hamburger z dyrektywą `@if (isMobile() && shouldShowSidebar())`
  - `pych-breadcrumbs`
- `div.topbar__center`:
  - `pych-omnibox`
- `div.topbar__right` (NOWA STRUKTURA):
  - Link "Moja Pycha" z dyrektywą `@if (!shouldShowSidebar())` - `<a routerLink="/dashboard" mat-button>`
  - Przycisk awatara z menu użytkownika

**Obsługiwane zdarzenia:**
- Kliknięcie linku "Moja Pycha" -> nawigacja do `/dashboard`
- Istniejące zdarzenia pozostają bez zmian

**Warunki walidacji:**
- Brak specyficznych warunków walidacji

**Typy:**
- Brak nowych typów

**Propsy (wejścia):**
- Dodanie nowego wejścia: `@Input() shouldShowSidebar: Signal<boolean>` - przekazywane z MainLayoutComponent

**Implementacja metody w komponencie:**
```typescript
export class TopbarComponent {
    // ... istniejące deklaracje
    
    /** Determines if sidebar should be visible (passed from MainLayout) */
    shouldShowSidebar = input.required<boolean>();
    
    // ... pozostałe metody
}
```

### BreadcrumbsComponent (`shared/components/breadcrumbs`)

**Zmiany:**
- Aktualizacja logiki dla breadcrumba "Dashboard" -> wyświetlanie "Moja Pycha"

**Główne elementy:**
- Bez zmian w strukturze HTML

**Logika:**
- Mapowanie `data.breadcrumb` z routingu:
  - Jeśli `data.breadcrumb === 'Dashboard'` -> wyświetl "Moja Pycha"
  - Pozostałe breadcrumby bez zmian

**Typy:**
- Brak zmian w `Breadcrumb` interface

**Propsy:**
- Bez zmian

## 5. Typy

Istniejące typy pozostają bez zmian. Nie są wymagane nowe interfejsy czy DTO.

Wykorzystywane typy:
- `NavigationItem` (z `shared/models/ui.models.ts`) - używany w SidebarComponent
- `Breadcrumb` (z `shared/models/ui.models.ts`) - używany w BreadcrumbsComponent

## 6. Zarządzanie stanem

### LayoutService

**Zmiany:**
- Dodanie sygnału `shouldShowSidebar` zarządzanego przez MainLayoutComponent
- Publiczny dostęp do sygnału dla TopbarComponent

**Propozycja implementacji:**

```typescript
@Injectable({ providedIn: 'root' })
export class LayoutService {
    // Istniejące sygnały
    private _isSidebarOpen = signal(true);
    public isSidebarOpen = this._isSidebarOpen.asReadonly();

    private _isMobile = signal(false);
    public isMobile = this._isMobile.asReadonly();

    // NOWY sygnał
    private _shouldShowSidebar = signal(true);
    public shouldShowSidebar = this._shouldShowSidebar.asReadonly();

    // Istniejące metody
    toggleSidebar() { 
        this._isSidebarOpen.update(v => !v); 
    }
    
    closeSidebar() { 
        this._isSidebarOpen.set(false); 
    }
    
    setIsMobile(isMobile: boolean) { 
        this._isMobile.set(isMobile); 
    }

    // NOWA metoda
    setShouldShowSidebar(shouldShow: boolean) {
        this._shouldShowSidebar.set(shouldShow);
    }
}
```

**Zarządzanie stanem w MainLayoutComponent:**
- W `ngOnInit` subskrypcja na `Router.events`
- Na każdą zmianę URL (NavigationEnd), sprawdzenie ścieżki i aktualizacja `layoutService.setShouldShowSidebar()`
- Początkowy stan sprawdzany w `ngOnInit` na podstawie `router.url`

## 7. Integracja API

Zmiany nie wymagają nowych wywołań API. Istniejące integracje pozostają bez zmian:
- `GET /profile` (dla awatara w Topbarze)
- `GET /search/global` (dla Omniboxa)

## 8. Interakcje użytkownika

### Scenariusz 1: Użytkownik zalogowany przegląda landing page (/)
1. Użytkownik wchodzi na `/`
2. MainLayout renderuje się **bez Sidebara**
3. Topbar wyświetla:
   - Breadcrumbs (jeśli są)
   - Omnibox
   - **Link "Moja Pycha"** (widoczny)
   - Avatar użytkownika z menu
4. Użytkownik klika "Moja Pycha"
5. Nawigacja do `/dashboard`
6. Sidebar staje się widoczny
7. Link "Moja Pycha" w Topbarze znika

### Scenariusz 2: Użytkownik zalogowany przegląda explore (/explore)
1. Użytkownik wchodzi na `/explore`
2. MainLayout renderuje się **bez Sidebara**
3. Topbar wyświetla:
   - Omnibox
   - **Link "Moja Pycha"** (widoczny)
   - Avatar użytkownika
4. Użytkownik może kliknąć "Moja Pycha" aby przejść do swojej prywatnej sekcji

### Scenariusz 3: Użytkownik zalogowany przegląda własne przepisy (/recipes)
1. Użytkownik wchodzi na `/recipes`
2. MainLayout renderuje się **z Sidebarem** (widocznym)
3. Topbar wyświetla:
   - Menu hamburger (jeśli mobile)
   - Breadcrumbs
   - Omnibox
   - **Brak linku "Moja Pycha"** (Sidebar jest widoczny)
   - Avatar użytkownika
4. W Sidebarze widoczna jest pozycja "Moja Pycha" (nie "Dashboard")

### Scenariusz 4: Przełączanie między sekcją publiczną a prywatną
1. Użytkownik jest na `/dashboard` (Sidebar widoczny)
2. Klika w logo aplikacji lub breadcrumb prowadzący do `/`
3. Sidebar płynnie znika
4. W Topbarze pojawia się link "Moja Pycha"
5. Layout pozostaje spójny, zmienia się tylko widoczność Sidebara

### Scenariusz 5: Urządzenie mobilne
1. Na urządzeniu mobilnym w sekcji prywatnej (np. `/recipes`)
2. Sidebar jest domyślnie zamknięty (mode: over)
3. Hamburger menu jest widoczny w Topbarze
4. Po przejściu do `/explore`
5. Hamburger menu znika (Sidebar nie powinien być dostępny)
6. Pojawia się link "Moja Pycha"

## 9. Warunki i walidacja

### Warunek 1: Określanie widoczności Sidebara

**Logika:**
- Sidebar jest widoczny gdy `router.url` zaczyna się od: `/dashboard`, `/recipes`, `/collections`, `/settings`
- W przeciwnym wypadku Sidebar jest ukryty

**Implementacja:**
```typescript
private readonly PRIVATE_PATHS = ['/dashboard', '/recipes', '/collections', '/settings'];

private checkSidebarVisibility(url: string): boolean {
    return this.PRIVATE_PATHS.some(path => url.startsWith(path));
}
```

### Warunek 2: Wyświetlanie linku "Moja Pycha" w Topbarze

**Logika:**
- Link "Moja Pycha" jest widoczny **wyłącznie** gdy Sidebar jest ukryty
- Warunek w szablonie: `@if (!shouldShowSidebar())`

### Warunek 3: Wyświetlanie hamburger menu

**Logika:**
- Hamburger menu jest widoczny gdy:
  - Urządzenie jest mobilne (`isMobile() === true`)
  - **ORAZ** Sidebar powinien być widoczny (`shouldShowSidebar() === true`)
- Warunek w szablonie: `@if (isMobile() && shouldShowSidebar())`

### Warunek 4: Breadcrumbs - wyświetlanie "Moja Pycha"

**Logika:**
- W BreadcrumbsComponent, podczas budowania ścieżki breadcrumb:
- Jeśli `route.data['breadcrumb'] === 'Dashboard'` -> zamień na "Moja Pycha"
- Dotyczy również dynamicznych breadcrumbs generowanych dla `/dashboard`

## 10. Obsługa błędów

### Błąd 1: Brak synchronizacji stanu Sidebara

**Scenariusz:** Stan sidebara nie aktualizuje się po zmianie URL.

**Obsługa:**
- Sprawdzenie subskrypcji `Router.events` w MainLayoutComponent
- Upewnienie się, że `filter(event => event instanceof NavigationEnd)` działa poprawnie
- Dodanie logowania w trybie deweloperskim do debugowania zmian URL

### Błąd 2: Sidebar "miga" podczas nawigacji

**Scenariusz:** Przy zmianie z sekcji publicznej na prywatną (lub odwrotnie) Sidebar pojawia się/znika z opóźnieniem.

**Obsługa:**
- Wykorzystanie `ChangeDetectionStrategy.OnPush` dla optymalizacji
- Upewnienie się, że aktualizacja sygnału `shouldShowSidebar` następuje **przed** rendrowaniem nowego widoku
- Rozważenie użycia animacji Angular dla płynnego przejścia (opcjonalne w MVP)

### Błąd 3: Link "Moja Pycha" nie jest widoczny na publicznych widokach

**Scenariusz:** Po przejściu na `/explore` link "Moja Pycha" nie pojawia się w Topbarze.

**Obsługa:**
- Weryfikacja warunku `@if (!shouldShowSidebar())` w szablonie TopbarComponent
- Sprawdzenie, czy `shouldShowSidebar` jest poprawnie przekazywany z MainLayoutComponent do TopbarComponent jako Input
- Debugowanie wartości sygnału w konsoli przeglądarki

### Błąd 4: Routing nie działa poprawnie dla `/recipes/:id`

**Scenariusz:** Szczegóły przepisu powinny pokazywać Sidebar dla własnych przepisów, ale nie dla publicznych.

**Obsługa (etap MVP):**
- W MVP, ścieżka `/recipes/:id` w kontekście MainLayout (zalogowany użytkownik) **zawsze** pokazuje Sidebar
- Logika rozróżniania własnych/publicznych przepisów może być dodana w przyszłości jako rozszerzenie
- Dla MVP, prosta logika: jeśli URL zaczyna się od `/recipes` -> pokaż Sidebar

### Błąd 5: Breadcrumbs pokazują "Dashboard" zamiast "Moja Pycha"

**Scenariusz:** Mimo zmian w kodzie, breadcrumb nadal wyświetla starą nazwę.

**Obsługa:**
- Weryfikacja logiki mapowania w BreadcrumbsComponent
- Sprawdzenie, czy `data.breadcrumb` w definicji routingu jest poprawnie ustawione
- Aktualizacja cache przeglądarki / rebuild aplikacji

## 11. Kroki implementacji

### Krok 1: Aktualizacja LayoutService

**Akcje:**
1. Otworzyć `src/app/core/services/layout.service.ts`
2. Dodać nowy prywatny sygnał `_shouldShowSidebar = signal(true)`
3. Wyeksportować publiczny readonly sygnał `shouldShowSidebar`
4. Dodać metodę `setShouldShowSidebar(shouldShow: boolean)`
5. Przetestować serwis w izolacji (opcjonalnie: unit test)

**Oczekiwany rezultat:**
- LayoutService posiada nowy sygnał i metodę do zarządzania widocznością Sidebara

---

### Krok 2: Modyfikacja MainLayoutComponent

**Akcje:**
1. Otworzyć `src/app/layout/main-layout/main-layout.component.ts`
2. Dodać stałą `PRIVATE_PATHS = ['/dashboard', '/recipes', '/collections', '/settings']`
3. Dodać metodę `checkSidebarVisibility(url: string): boolean`
4. W `ngOnInit`:
   - Sprawdzić początkowy URL: `this.checkSidebarVisibility(this.router.url)`
   - Ustawić początkowy stan: `this.layoutService.setShouldShowSidebar(...)`
   - Dodać subskrypcję na `Router.events`:
     ```typescript
     this.router.events
         .pipe(
             filter((event) => event instanceof NavigationEnd),
             takeUntilDestroyed(this.destroyRef)
         )
         .subscribe((event: NavigationEnd) => {
             const shouldShow = this.checkSidebarVisibility(event.urlAfterRedirects);
             this.layoutService.setShouldShowSidebar(shouldShow);
         });
     ```
5. Dodać publiczny getter: `readonly shouldShowSidebar = this.layoutService.shouldShowSidebar`
6. Otworzyć `src/app/layout/main-layout/main-layout.component.html`
7. Dodać dyrektywę `@if` do `<mat-sidenav>`:
   ```html
   @if (shouldShowSidebar()) {
       <mat-sidenav
           #sidenav
           [opened]="isSidebarOpen()"
           [mode]="isMobile() ? 'over' : 'side'"
           (closed)="onSidebarClosed()"
           class="main-layout__sidenav"
       >
           <pych-sidebar />
       </mat-sidenav>
   }
   ```
8. Przekazać `shouldShowSidebar` do TopbarComponent:
   ```html
   <pych-topbar [shouldShowSidebar]="shouldShowSidebar()" />
   ```

**Oczekiwany rezultat:**
- MainLayoutComponent dynamicznie ukrywa/pokazuje Sidebar w zależności od ścieżki
- Stan sidebara jest synchronizowany z LayoutService
- TopbarComponent otrzymuje informację o stanie sidebara

---

### Krok 3: Aktualizacja SidebarComponent

**Akcje:**
1. Otworzyć `src/app/layout/main-layout/components/sidebar/sidebar.component.ts`
2. W tablicy `navigationItems`, zmienić label pierwszego elementu:
   ```typescript
   {
       label: 'Moja Pycha',  // było: 'Dashboard'
       route: '/dashboard',
       icon: 'dashboard',
   }
   ```
3. Zapisać plik

**Oczekiwany rezultat:**
- Sidebar wyświetla "Moja Pycha" zamiast "Dashboard" jako pierwszy element nawigacji

---

### Krok 4: Modyfikacja TopbarComponent

**Akcje:**
1. Otworzyć `src/app/layout/main-layout/components/topbar/topbar.component.ts`
2. Dodać nowy Input signal:
   ```typescript
   /** Determines if sidebar should be visible */
   shouldShowSidebar = input.required<boolean>();
   ```
3. Otworzyć `src/app/layout/main-layout/components/topbar/topbar.component.html`
4. Zaktualizować warunek dla hamburger menu:
   ```html
   @if (isMobile() && shouldShowSidebar()) {
       <button
           mat-icon-button
           aria-label="Toggle menu"
           (click)="toggleSidebar()"
           class="topbar__menu-btn"
       >
           <mat-icon>menu</mat-icon>
       </button>
   }
   ```
5. Zmodyfikować sekcję `topbar__right`, dodając link "Moja Pycha":
   ```html
   <div class="topbar__right">
       @if (!shouldShowSidebar()) {
           <a 
               routerLink="/dashboard" 
               mat-button
               class="topbar__dashboard-link"
               aria-label="Przejdź do Moja Pycha"
           >
               Moja Pycha
           </a>
       }
       
       <button
           mat-icon-button
           [matMenuTriggerFor]="userMenu"
           aria-label="Menu użytkownika"
           class="topbar__avatar"
       >
           <mat-icon>account_circle</mat-icon>
       </button>

       <mat-menu #userMenu="matMenu" xPosition="before">
           <a mat-menu-item routerLink="/settings">
               <mat-icon>settings</mat-icon>
               <span>Ustawienia</span>
           </a>
           <button mat-menu-item (click)="logout()">
               <mat-icon>logout</mat-icon>
               <span>Wyloguj się</span>
           </button>
       </mat-menu>
   </div>
   ```
6. Otworzyć `src/app/layout/main-layout/components/topbar/topbar.component.scss`
7. Dodać style dla nowego linku:
   ```scss
   .topbar__dashboard-link {
       margin-right: 1rem;
       font-weight: 500;
   }
   
   .topbar__right {
       display: flex;
       align-items: center;
       gap: 0.5rem;
   }
   ```

**Oczekiwany rezultat:**
- TopbarComponent wyświetla link "Moja Pycha" gdy Sidebar jest ukryty
- Hamburger menu jest widoczny tylko na mobile i tylko gdy Sidebar powinien być widoczny
- Link "Moja Pycha" jest ostylowany i widoczny po lewej stronie avatara

---

### Krok 5: Aktualizacja BreadcrumbsComponent

**Akcje:**
1. Otworzyć `src/app/shared/components/breadcrumbs/breadcrumbs.component.ts`
2. Znaleźć logikę budowania breadcrumbs (prawdopodobnie w metodzie mapującej dane z routingu)
3. Dodać mapowanie dla labela "Dashboard":
   ```typescript
   // Przykład w metodzie buildBreadcrumbs():
   const label = route.data['breadcrumb'] === 'Dashboard' 
       ? 'Moja Pycha' 
       : route.data['breadcrumb'];
   ```
4. Zapisać plik

**Oczekiwany rezultat:**
- Breadcrumbs wyświetlają "Moja Pycha" zamiast "Dashboard"

---

### Krok 6: Aktualizacja danych routingu (opcjonalnie)

**Akcje:**
1. Otworzyć `src/app/app.routes.ts`
2. Znaleźć definicję routingu dla `/dashboard`:
   ```typescript
   {
       path: 'dashboard',
       loadComponent: () =>
           import('./pages/dashboard/dashboard-page.component').then(
               (m) => m.DashboardPageComponent
           ),
       data: { breadcrumb: 'Dashboard' },  // lub zmienić na 'Moja Pycha'
   }
   ```
3. **Opcja A:** Pozostawić jako 'Dashboard' i polegać na mapowaniu w BreadcrumbsComponent
4. **Opcja B:** Zmienić na 'Moja Pycha' i usunąć mapowanie z BreadcrumbsComponent

**Rekomendacja:** Opcja A (pozostawić 'Dashboard' jako identyfikator techniczny, mapować w komponencie)

**Oczekiwany rezultat:**
- Routing pozostaje czytelny technicznie
- UI wyświetla przyjazną nazwę "Moja Pycha"

---

### Krok 7: Testowanie manualne

**Scenariusze testowe:**

1. **Test 1: Widoczność Sidebara na ścieżkach prywatnych**
   - Zalogować się do aplikacji
   - Przejść na `/dashboard` -> ✓ Sidebar widoczny
   - Przejść na `/recipes` -> ✓ Sidebar widoczny
   - Przejść na `/collections` -> ✓ Sidebar widoczny
   - Przejść na `/settings` -> ✓ Sidebar widoczny

2. **Test 2: Brak Sidebara na ścieżkach publicznych**
   - Będąc zalogowanym, przejść na `/` -> ✓ Sidebar ukryty
   - Przejść na `/explore` -> ✓ Sidebar ukryty
   - ✓ W obu przypadkach widoczny link "Moja Pycha" w Topbarze

3. **Test 3: Funkcjonalność linku "Moja Pycha"**
   - Będąc na `/explore`, kliknąć link "Moja Pycha" w Topbarze
   - ✓ Nastąpi nawigacja do `/dashboard`
   - ✓ Sidebar się pojawi
   - ✓ Link "Moja Pycha" zniknie z Topbara

4. **Test 4: Nazwa w Sidebarze**
   - Będąc na `/dashboard`, sprawdzić Sidebar
   - ✓ Pierwszy element to "Moja Pycha", nie "Dashboard"

5. **Test 5: Breadcrumbs**
   - Przejść na `/dashboard`
   - ✓ Breadcrumb wyświetla "Moja Pycha"

6. **Test 6: Responsywność (Mobile)**
   - Przełączyć DevTools na widok mobilny
   - Przejść na `/recipes`
   - ✓ Hamburger menu widoczny
   - ✓ Sidebar domyślnie zamknięty (mode: over)
   - Przejść na `/explore`
   - ✓ Hamburger menu ukryty
   - ✓ Link "Moja Pycha" widoczny

7. **Test 7: Przełączanie między sekcjami**
   - Przejść z `/dashboard` na `/`
   - ✓ Płynne ukrycie Sidebara
   - ✓ Pojawienie się linku "Moja Pycha"
   - Wrócić na `/recipes`
   - ✓ Płynne pojawienie się Sidebara
   - ✓ Zniknięcie linku "Moja Pycha"

**Oczekiwany rezultat:**
- Wszystkie scenariusze testowe przechodzą pomyślnie
- Brak błędów w konsoli przeglądarki
- Płynne przejścia między stanami

---

### Krok 8: Optymalizacja i finalizacja

**Akcje:**
1. Przejrzeć kod pod kątem ewentualnych optymalizacji
2. Upewnić się, że wszystkie komponenty używają `ChangeDetectionStrategy.OnPush`
3. Sprawdzić, czy nie ma memory leaków (poprawne użycie `takeUntilDestroyed`)
4. Dodać komentarze do kodu wyjaśniające logikę warunkowego renderowania
5. Zaktualizować dokumentację projektu (jeśli istnieje)

**Oczekiwany rezultat:**
- Kod jest czytelny, zoptymalizowany i dobrze udokumentowany
- Brak wycieków pamięci
- Aplikacja działa płynnie

---

### Krok 9: Code Review i dokumentacja zmian

**Akcje:**
1. Utworzyć Pull Request z opisem zmian
2. Dodać screenshoty pokazujące nową funkcjonalność
3. Odnieść się do US-023 w opisie PR
4. Poprosić o code review od członków zespołu
5. Zaktualizować dokument zmian projektu (jeśli istnieje)

**Oczekiwany rezultat:**
- PR jest gotowy do przeglądu
- Dokumentacja projektu jest aktualna

---

## 12. Potencjalne wyzwania i rozwiązania

### Wyzwanie 1: Wydajność przy częstych zmianach URL

**Problem:** Subskrypcja na `Router.events` i ciągłe sprawdzanie ścieżki może wpłynąć na wydajność.

**Rozwiązanie:**
- Użycie `filter()` do przetwarzania tylko `NavigationEnd` events
- Wykorzystanie `takeUntilDestroyed()` dla automatycznego czyszczenia subskrypcji
- Minimalizacja logiki w metodzie `checkSidebarVisibility()` (proste sprawdzenie `startsWith`)
- Signals automatycznie optymalizują re-rendering

### Wyzwanie 2: Stan sidebara przy głębokich routach

**Problem:** Dla zagnieżdżonych routów (np. `/recipes/123/edit`) logika `startsWith('/recipes')` działa, ale może być nieczytelna.

**Rozwiązanie:**
- W MVP, akceptujemy proste sprawdzenie `startsWith`
- W przyszłości można rozważyć bardziej zaawansowaną logikę opartą na drzewie routingu
- Dokumentacja jasno określa zachowanie dla zagnieżdżonych tras

### Wyzwanie 3: Synchronizacja z animacjami

**Problem:** Jeśli w przyszłości dodamy animacje pojawienia/zniknięcia Sidebara, mogą wystąpić problemy z synchronizacją.

**Rozwiązanie:**
- W MVP nie implementujemy animacji (poza domyślnymi z Angular Material)
- Jeśli animacje będą wymagane, użyjemy Angular Animations API
- Stan sidebara będzie aktualizowany **po** zakończeniu animacji

### Wyzwanie 4: Testowanie automatyczne

**Problem:** Logika warunkowego renderowania jest trudna do przetestowania w testach jednostkowych.

**Rozwiązanie (poza zakresem MVP):**
- Izolacja logiki `checkSidebarVisibility()` do osobnego serwisu (opcjonalnie)
- Testy jednostkowe dla metody sprawdzającej widoczność
- Testy integracyjne sprawdzające renderowanie w różnych kontekstach
- Testy E2E (Playwright) weryfikujące pełne scenariusze użytkownika

---

## Podsumowanie

Implementacja zmian w widoczności Sidebara i dodanie linku "Moja Pycha" wymaga modyfikacji kilku kluczowych komponentów layoutu aplikacji. Zmiany są stosunkowo niewielkie technicznie, ale mają duży wpływ na UX, tworząc wyraźne rozróżnienie między sekcją publiczną (przeglądanie) a prywatną (zarządzanie) dla zalogowanych użytkowników.

Kluczowe punkty:
- **Warunkowe renderowanie Sidebara** oparte na aktualnej ścieżce URL
- **Nowy element nawigacji** "Moja Pycha" w Topbarze dla szybkiego dostępu do dashboardu
- **Spójna terminologia** w całej aplikacji (zamiana "Dashboard" na "Moja Pycha" w UI)
- **Zachowanie responsywności** - logika działa poprawnie zarówno na desktop jak i mobile
- **Minimalne zmiany w API** - wszystkie zmiany dotyczą tylko warstwy prezentacji

Plan implementacji zakłada stopniowe wprowadzanie zmian, z testowaniem po każdym etapie, co minimalizuje ryzyko wprowadzenia błędów i ułatwia debugowanie.
