# Plan implementacji App Shell i Nawigacji (MainLayout)

## 1. Przegląd
Plan ten opisuje implementację głównego szkieletu aplikacji (Application Shell) zgodnie z architekturą "Holy Grail". Widok ten stanowi kontener dla wszystkich stron dostępnych dla zalogowanych użytkowników. Obejmuje globalną nawigację (Sidebar), pasek kontekstowy (Topbar z Breadcrumbs i Wyszukiwarką) oraz ustandaryzowany nagłówek stron podrzędnych (`SharedPageHeader`).

Celem jest spełnienie wymagań **US-014** (Globalna orientacja) oraz **US-015** (Kontekstowe akcje).

## 2. Routing widoku
App Shell nie jest pojedynczą stroną, lecz **layoutem nadrzędnym** dla chronionych ścieżek.

*   **Ścieżka bazowa:** `/` (chroniona przez `AuthGuard`)
*   **Children:**
    *   `/dashboard`
    *   `/recipes` (i podstrony)
    *   `/collections` (i podstrony)
    *   `/settings`

Przykład konfiguracji routingu:
```typescript
{
  path: '',
  component: MainLayoutComponent,
  canActivate: [AuthGuard],
  children: [
    { path: 'dashboard', loadComponent: ... },
    { path: 'recipes', loadComponent: ... },
    // ...
  ]
}
```

## 3. Struktura komponentów

```text
pych-main-layout (Standalone Component)
├── mat-sidenav-container (Pełna wysokość viewportu)
│   ├── mat-sidenav (Sidebar - mode: side/over zależnie od viewportu)
│   │   └── pych-sidebar
│   └── mat-sidenav-content
│       ├── pych-topbar (Sticky top)
│       │   ├── mat-toolbar
│       │   │   ├── Hamburger Menu (Visible on mobile)
│       │   │   ├── pych-breadcrumbs
│       │   │   ├── pych-omnibox (Global Search)
│       │   │   └── User Avatar / Menu
│       └── router-outlet (Miejsce wstrzykiwania widoków)
│           └── (Każdy widok podrzędny zawiera pych-shared-page-header)
```

## 4. Szczegóły komponentów

### `MainLayoutComponent` (`layout/main-layout`)
*   **Opis:** Główny kontener aplikacji. Zarządza responsywnością paska bocznego.
*   **Główne elementy:** `mat-sidenav-container`, `mat-sidenav`, `mat-sidenav-content`.
*   **Zarządzanie stanem:** Wykorzystuje `LayoutService` do sterowania widocznością sidebara.
*   **Obsługiwane interakcje:**
    *   Nasłuchuje zmian viewportu (`BreakpointObserver`) -> zmienia tryb sidebara (side vs over).
    *   Zamyka sidebar po nawigacji (na mobile).

### `SidebarComponent` (`layout/components/sidebar`)
*   **Opis:** Statyczna lista nawigacyjna.
*   **Główne elementy:** `mat-nav-list`, `mat-list-item`, `mat-icon`.
*   **Dane:** Lista linków zdefiniowana w stałej: Dashboard, Przepisy, Kolekcje, Ustawienia.
*   **Obsługiwane interakcje:** Kliknięcie w link -> nawigacja.

### `TopbarComponent` (`layout/components/topbar`)
*   **Opis:** Pasek górny zawierający kontekst i narzędzia globalne.
*   **Główne elementy:** `mat-toolbar`, `pych-breadcrumbs`, `pych-omnibox`.
*   **Obsługiwane interakcje:**
    *   Kliknięcie "Menu" -> Toggle Sidebar (via `LayoutService`).
    *   Kliknięcie "Wyloguj" (w menu awatara).

### `BreadcrumbsComponent` (`shared/components/breadcrumbs`)
*   **Opis:** Wyświetla ścieżkę do aktualnego widoku.
*   **Logika:** Nasłuchuje zdarzeń routera i buduje listę na podstawie `data.breadcrumb` w definicji routingu lub dynamicznych parametrów.
*   **Typy:** `Breadcrumb { label: string, url: string }`.

### `OmniboxComponent` (`shared/components/omnibox`)
*   **Opis:** Globalna wyszukiwarka (Input + Autocomplete).
*   **Główne elementy:** `mat-form-field`, `input`, `mat-autocomplete`.
*   **Integracja API:** `GET /search/global`.

### `SharedPageHeaderComponent` (`shared/components/page-header`)
*   **Opis:** Reużywalny nagłówek dla widoków podrzędnych.
*   **Główne elementy:**
    *   `h1` (Tytuł)
    *   `ng-content` (Slot na przyciski akcji)
*   **Style:** `position: sticky`, `top: 64px` (wysokość topbara), `z-index: 10`.
*   **Propsy:**
    *   `@Input() title: string`
    *   `@Input() subtitle?: string`

### `EmptyStateWithActionComponent` (`shared/components/empty-state`)
*   **Opis:** Komponent wyświetlany, gdy lista (np. przepisów) jest pusta.
*   **Główne elementy:** Obrazek/Ikona, Tekst opisu, `ng-content` (przycisk akcji).

## 5. Typy

### Modele Widoku (Frontend)

```typescript
// shared/models/ui.models.ts

export interface NavigationItem {
    label: string;
    route: string;
    icon: string; // nazwa ikony Material
}

export interface Breadcrumb {
    label: string;
    url: string;
}
```

### DTO (zgodne z `types.ts`)
*   `ProfileDto` (dla awatara użytkownika).
*   `GlobalSearchResponseDto`, `SearchRecipeDto`, `SearchCollectionDto` (dla Omniboxa).

## 6. Zarządzanie stanem

Wykorzystanie serwisu **`LayoutService`** opartego na Signals.

```typescript
@Injectable({ providedIn: 'root' })
export class LayoutService {
    // Stan Sidebara
    private _isSidebarOpen = signal(true);
    public isSidebarOpen = this._isSidebarOpen.asReadonly();

    // Stan mobilny
    private _isMobile = signal(false);
    public isMobile = this._isMobile.asReadonly();

    // Metody
    toggleSidebar() { ... }
    closeSidebar() { ... }
    setIsMobile(isMobile: boolean) { ... }
}
```

Dla **Breadcrumbs**, serwis może subskrybować `Router.events` i aktualizować signal `breadcrumbs`.

## 7. Integracja API

### Profil Użytkownika (Topbar)
*   **Endpoint:** `GET /profile`
*   **Typ odpowiedzi:** `ProfileDto`
*   **Cel:** Wyświetlenie nazwy użytkownika lub inicjałów w awatarze.

### Wyszukiwarka (Omnibox)
*   **Endpoint:** `GET /search/global?q={query}`
*   **Typ żądania:** `string` (parametr `q`)
*   **Typ odpowiedzi:** `GlobalSearchResponseDto`
*   **Opis:** Wyszukiwanie "live" (z debounce 300ms) po wpisaniu min. 2 znaków.

## 8. Interakcje użytkownika

1.  **Nawigacja Sidebar:** Kliknięcie elementu zmienia URL i podświetla aktywny element. Na mobile zamyka sidebar.
2.  **Toggle Sidebar:** Kliknięcie ikony menu chowa/pokazuje sidebar.
3.  **Wyszukiwanie:** Wpisanie frazy w Omnibox pokazuje dropdown z wynikami (Przepisy i Kolekcje). Kliknięcie wyniku przenosi do szczegółów.
4.  **Akcje strony:** Kliknięcie przycisków w `SharedPageHeader` (np. "Dodaj przepis") wywołuje akcję specyficzną dla danego widoku.
5.  **Breadcrumbs:** Kliknięcie elementu ścieżki przenosi do widoku nadrzędnego.

## 9. Warunki i walidacja

*   **Breadcrumbs:** Muszą poprawnie obsługiwać parametry dynamiczne (np. zamieniać `:id` na nazwę przepisu - wymaga fetchowania danych lub przekazywania ich w state routera, w wersji MVP można wyświetlać "Szczegóły" lub ID).
*   **Responsywność:**
    *   Desktop (> 960px): Sidebar domyślnie otwarty (`mode="side"`).
    *   Mobile (< 960px): Sidebar domyślnie zamknięty (`mode="over"`), Topbar pokazuje hamburgera.

## 10. Obsługa błędów

*   **Błąd ładowania profilu:** Wyświetlenie domyślnego awatara (ikona użytkownika).
*   **Błąd wyszukiwania:** Wyświetlenie komunikatu w dropdownie wyszukiwarki ("Błąd wyszukiwania" lub "Brak wyników").

## 11. Kroki implementacji

1.  **Setup Serwisu Layoutu:**
    *   Stwórz `LayoutService` z sygnałami dla stanu sidebara i detekcją mobile (użyj `BreakpointObserver` z `@angular/cdk/layout`).
2.  **Komponenty Współdzielone (UI):**
    *   Zaimplementuj `SharedPageHeaderComponent` (Inputy: title, Content Projection).
    *   Zaimplementuj `BreadcrumbsComponent` (Logika parsowania URL).
    *   Zaimplementuj `EmptyStateWithActionComponent`.
3.  **Komponenty App Shell:**
    *   Zaimplementuj `SidebarComponent` (Lista linków).
    *   Zaimplementuj `OmniboxComponent` (Podłączenie do API search).
    *   Zaimplementuj `TopbarComponent` (Złożenie breadcrumbs, omnibox, user menu).
    *   Zaimplementuj `MainLayoutComponent` (Struktura `mat-sidenav`).
4.  **Konfiguracja Routingu:**
    *   Zaktualizuj `app.routes.ts`. Ustaw `MainLayoutComponent` jako rodzica dla chronionych ścieżek.
    *   Dodaj `data: { breadcrumb: '...' }` do definicji routów.
5.  **Integracja w Widokach (Przykład na Liście Przepisów):**
    *   Zaktualizuj widok listy przepisów, aby używał `pych-shared-page-header`.
    *   Dodaj `pych-empty-state-with-action` dla stanu pustego.

