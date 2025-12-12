# Plan Implementacji Modernizacji Widoków i Nawigacji (App Shell)

## 1. Przegląd
Celem tego planu jest gruntowna przebudowa warstwy prezentacji aplikacji PychaŚwiatowa, aby wprowadzić nowoczesny standard "App Shell" zgodny z Material Design 3. Zmiana polega na separacji nawigacji (Sidebar) od akcji kontekstowych (Page Header) oraz wprowadzeniu elementów orientacyjnych (Breadcrumbs). Zapewni to spójność, lepszą ergonomię na desktopach i urządzeniach mobilnych oraz usunie chaos w rozmieszczeniu przycisków akcji.

## 2. Routing widoku
Zmiany dotyczą globalnego układu (`MainLayoutComponent`), więc wpłyną na wszystkie trasy podrzędne dla zalogowanego użytkownika:
- `/dashboard`
- `/recipes` (lista, szczegóły, edycja, tworzenie)
- `/collections`

## 3. Struktura komponentów

```text
src/app/layout/
├── main-layout/                  # Główny kontener (istniejący, do refaktoryzacji)
│   ├── main-layout.component.ts
│   └── main-layout.component.html
├── sidebar/                      # Nowy komponent nawigacji bocznej
│   └── sidebar.component.ts
└── topbar/                       # Nowy komponent paska górnego
    ├── topbar.component.ts
    └── components/
        └── breadcrumbs/          # Komponent ścieżki nawigacyjnej

src/app/shared/components/
├── pych-page-header/             # Nowy komponent nagłówka strony (reusable)
│   ├── pych-page-header.component.ts
│   └── pych-page-header.component.html
└── pych-empty-state/             # Nowy komponent stanu pustego (reusable)
    ├── pych-empty-state.component.ts
    └── pych-empty-state.component.html
```

## 4. Szczegóły komponentów

### 1. `PychPageHeaderComponent` (Shared)
- **Opis:** Uniwersalny nagłówek wyświetlany na górze każdego widoku podstrony. Zawiera tytuł, opcjonalny podtytuł oraz slot na przyciski akcji (prawa strona). Powinien być "sticky" (przyklejony do góry kontenera treści).
- **Główne elementy:** `header`, `h1` (tytuł), `ng-content` (sloty).
- **Sloty:**
  - `<ng-content select="[actions]">`: Miejsce na przyciski (np. Zapisz, Edytuj).
- **Propsy (Inputs):**
  - `title: string` (wymagane)
  - `subtitle?: string`
  - `showBackButton?: boolean` (domyślnie false, jeśli true - pokazuje strzałkę wstecz)

### 2. `PychEmptyStateComponent` (Shared)
- **Opis:** Komponent wyświetlany, gdy lista danych jest pusta. Zachęca użytkownika do akcji.
- **Główne elementy:** Ikona (Material Icon), Tytuł, Opis, Slot na przyciski (Call to Action).
- **Propsy (Inputs):**
  - `icon: string` (nazwa ikony Material)
  - `title: string`
  - `description: string`

### 3. `TopbarComponent` & `BreadcrumbsComponent`
- **Opis:** Pasek górny zawierający Breadcrumbs (lewa strona), Wyszukiwarkę (środek - placeholder na razie) i Menu Użytkownika (prawa strona).
- **Zależności:** `BreadcrumbService` (do śledzenia routingu).
- **Interakcje:** Kliknięcie w element breadcrumb nawiguje do nadrzędnego widoku.

### 4. `SidebarComponent`
- **Opis:** Pionowa lista linków nawigacyjnych.
- **Elementy:** `mat-nav-list`, `mat-list-item`.
- **Linki:** Dashboard, Przepisy, Kolekcje, Ustawienia, Wyloguj.
- **Responsywność:** Na desktopie stały, na mobile chowany w `mat-sidenav`.

### 5. Zmiany w `MainLayoutComponent`
- **Refaktoryzacja:** Usunięcie starego kodu nawigacji. Wdrożenie `mat-sidenav-container`.
- **Logika:** Obsługa `BreakpointObserver` do przełączania trybu wyświetlania (`side` vs `over`) w zależności od szerokości ekranu.

## 5. Typy

### Breadcrumb (Nowy typ)
```typescript
export interface Breadcrumb {
  label: string;
  url: string;
}
```
*Lokalizacja: `src/app/core/models/breadcrumb.model.ts`*

### Istniejące DTO (używane w widokach)
- `RecipeListItemDto`, `RecipeDetailDto` z `@shared/contracts/types.ts`.

## 6. Zarządzanie stanem

### LayoutState
- Wykorzystanie `Signals` do zarządzania stanem otwarcia Sidebar'a (`isOpen = signal(true)`).
- Wykorzystanie `BreakpointObserver` (z `@angular/cdk/layout`) do reaktywnego określania trybu wyświetlania (`isMobile`).

### BreadcrumbService
- Serwis nasłuchujący zdarzeń routera (`NavigationEnd`).
- Buduje listę `Breadcrumb[]` na podstawie konfiguracji routingu (`data: { breadcrumb: 'Nazwa' }`) lub dynamicznych segmentów URL.

## 7. Integracja API
Zmiany są czysto wizualne i strukturalne. Nie wprowadzamy nowych zapytań API, ale zmieniamy miejsce wywołania akcji biznesowych:
- **Tworzenie przepisu:** Przycisk w `RecipeListComponent` -> `PageHeader` (nawigacja do `/recipes/new`).
- **Zapis przepisu:** Przycisk w `RecipeFormComponent` -> `PageHeader` (submit formularza).
- **Usuwanie przepisu:** Przycisk w `RecipeDetailComponent` -> `PageHeader` (wywołanie API).

## 8. Interakcje użytkownika
1. **Nawigacja:** Użytkownik klika w Sidebar -> zmiana widoku, Sidebar na mobile zamyka się automatycznie.
2. **Akcje globalne:** Przycisk "Dodaj" w nagłówku listy przenosi do formularza.
3. **Zapis formularza:** Przycisk "Zapisz" jest zawsze widoczny na górze formularza (Sticky Header), co eliminuje konieczność przewijania.
4. **Powrót:** Kliknięcie w Breadcrumb lub strzałkę "Wstecz" (jeśli aktywna) cofa o jeden poziom.

## 9. Warunki i walidacja
- **Przycisk "Zapisz" w nagłówku formularza:** Powinien być `disabled`, jeśli formularz (FormGroup) jest `invalid`. Wymaga to przekazania stanu walidacji do przycisku znajdującego się w slocie nagłówka.
- **Responsywność:** Sidebar automatycznie zmienia tryb przy szerokości < 960px (standard Material).

## 10. Obsługa błędów
- **Brak danych:** Zamiast pustej tabeli wyświetlany jest `PychEmptyStateComponent`.
- **Błędy ładowania:** Standardowe mechanizmy (Interceptor, Toast) pozostają bez zmian.

## 11. Kroki implementacji

### Krok 1: Komponenty Współdzielone (UI Primitives)
1. Utwórz `PychPageHeaderComponent` (Standalone). Zostylizuj go używając Flexboxa (rozdzielenie tytułu i akcji).
2. Utwórz `PychEmptyStateComponent` (Standalone). Dodaj obsługę ikony i slotu na przycisk.

### Krok 2: Serwisy i Modele Layoutu
1. Zdefiniuj interfejs `Breadcrumb`.
2. Stwórz `BreadcrumbService` w `core/services`, który subskrybuje router i wystawia sygnał `breadcrumbs`.
3. Skonfiguruj `app.routes.ts`, dodając dane `breadcrumb` do tras (np. `{ path: 'recipes', data: { breadcrumb: 'Przepisy' } }`).

### Krok 3: Komponenty Layoutu (Shell)
1. Utwórz `TopbarComponent`: Zaimplementuj wyświetlanie breadcrumbs (pobierane z serwisu) i przycisk toggle sidebar (dla mobile).
2. Utwórz `SidebarComponent`: Zaimplementuj `mat-nav-list` z linkami.
3. Zaktualizuj `MainLayoutComponent`:
   - Zastąp obecny układ kontenerem `mat-sidenav-container`.
   - Zintegruj `SidebarComponent` w sekcji `mat-sidenav`.
   - Zintegruj `TopbarComponent` w sekcji `mat-sidenav-content` (na górze).
   - Dodaj `<router-outlet>` pod Topbarem.

### Krok 4: Migracja Widoku Listy Przepisów (`/recipes`)
1. W `RecipeListComponent` dodaj `<pych-page-header title="Moje Przepisy">`.
2. Przenieś przycisk "Dodaj przepis" do sekcji `[actions]` w nagłówku.
3. Zastosuj `<pych-empty-state>` wewnątrz instrukcji `@if (recipes().length === 0)`.

### Krok 5: Migracja Widoku Szczegółów Przepisu (`/recipes/:id`)
1. W `RecipeDetailComponent` dodaj `<pych-page-header>` z tytułem przepisu (lub "Szczegóły przepisu" w MVP).
2. Przenieś przyciski "Edytuj" i "Usuń" do sekcji `[actions]`. Użyj `mat-icon-button` dla lepszej estetyki.
3. Dostosuj układ treści (grid), usuwając stare nagłówki, które teraz dublowałyby Page Header.

### Krok 6: Migracja Formularza Przepisu (`/recipes/new`, `/recipes/:id/edit`)
1. W `RecipeFormComponent` dodaj `<pych-page-header>`.
2. Umieść przyciski "Anuluj" (mat-button) i "Zapisz" (mat-flat-button) w sekcji `[actions]`.
3. Podepnij `[disabled]="form.invalid"` pod przycisk "Zapisz".
4. Podepnij `(click)="onSubmit()"` pod przycisk "Zapisz".

### Krok 7: Weryfikacja i Style
1. Sprawdź działanie na mobile (czy sidebar się chowa, czy przyciski w headerze się mieszczą - ewentualnie schowaj teksty przycisków na mobile, zostawiając ikony).
2. Dopasuj kolory nagłówków do zmiennych Material 3 (`--mat-sys-surface`, `--mat-sys-on-surface`).

