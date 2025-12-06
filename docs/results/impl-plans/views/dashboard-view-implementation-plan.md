# Plan implementacji widoku Dashboard

## 1. Przegląd

Widok Dashboard (`/dashboard`) jest głównym ekranem aplikacji dla zalogowanego użytkownika. Służy jako centralny punkt nawigacyjny, witając użytkownika i zapewniając szybki dostęp do kluczowych funkcji, takich jak przeglądanie przepisów i zarządzanie kolekcjami. Dodatkowo, widok może prezentować listę ostatnio dodanych przepisów, aby zachęcić do interakcji.

## 2. Routing widoku

Widok będzie dostępny pod następującą ścieżką i chroniony przez mechanizm autoryzacji:

-   **Ścieżka:** `/dashboard`
-   **Ochrona:** Dostęp do tej ścieżki będzie chroniony przez `AuthGuard`, który uniemożliwi niezalogowanym użytkownikom wejście i przekieruje ich do strony logowania.

## 3. Struktura komponentów

Widok zostanie zbudowany w oparciu o architekturę komponentową, z podziałem na komponent "smart" (odpowiedzialny za logikę) i komponenty "dumb" (prezentacyjne).

```
- DashboardPageComponent (/dashboard) [Smart Component]
  |- WelcomeHeaderComponent [Presentational Component]
  |- NavigationTileComponent [Presentational Component] (x2)
  |- RecentRecipesListComponent [Presentational Component]
     |- RecipeCardComponent [Presentational Component] (re-używalny)
```

## 4. Szczegóły komponentów

### DashboardPageComponent

-   **Opis komponentu:** Główny komponent widoku, pełniący rolę kontenera. Odpowiada za pobieranie danych z API (profil użytkownika, ostatnie przepisy), zarządzanie stanem (ładowanie, błędy) i przekazywanie danych do komponentów prezentacyjnych.
-   **Główne elementy:** Kontener `div` z siatką (CSS Grid lub Flexbox) do ułożenia komponentów dzieci. Wykorzystanie dyrektywy `@if` do warunkowego wyświetlania stanu ładowania, błędu lub finalnej treści.
-   **Obsługiwane zdarzenia:** `ngOnInit` do inicjowania pobierania danych.
-   **Warunki walidacji:** Brak.
-   **Typy:** `DashboardState` (ViewModel), `ProfileDto`, `RecipeListItemDto`.
-   **Propsy (wejścia):** Brak.

### WelcomeHeaderComponent

-   **Opis komponentu:** Wyświetla spersonalizowane powitanie dla użytkownika.
-   **Główne elementy:** Nagłówek `<h1>` lub `<h2>` z tekstem "Witaj, [nazwa użytkownika]!".
-   **Obsługiwane zdarzenia:** Brak.
-   **Warunki walidacji:** Brak.
-   **Typy:** `ProfileDto`.
-   **Propsy (wejścia):** `profile: Signal<ProfileDto | null>`.

### NavigationTileComponent

-   **Opis komponentu:** Reużywalny kafelek nawigacyjny, renderowany jako `mat-card`. Służy jako wizualny link do innych części aplikacji.
-   **Główne elementy:** Komponent `<mat-card>` z dyrektywą `[routerLink]`. Wewnątrz `<mat-card-header>` z `<mat-card-title>` oraz opcjonalnie `<mat-icon>`.
-   **Obsługiwane zdarzenia:** Kliknięcie, obsługiwane przez `routerLink`.
-   **Warunki walidacji:** Brak.
-   **Typy:** `NavigationTileViewModel`.
-   **Propsy (wejścia):** `tileData: NavigationTileViewModel`.

### RecentRecipesListComponent

-   **Opis komponentu:** Wyświetla sekcję z listą ostatnio dodanych przepisów.
-   **Główne elementy:** Nagłówek sekcji (np. `<h3>Ostatnio dodane</h3>`) oraz kontener, który w pętli `@for` renderuje komponenty `RecipeCardComponent`. Obsługuje również stan, gdy lista przepisów jest pusta.
-   **Obsługiwane zdarzenia:** Brak.
-   **Warunki walidacji:** Brak.
-   **Typy:** `RecipeListItemDto[]`.
-   **Propsy (wejścia):** `recipes: Signal<RecipeListItemDto[]>`.

## 5. Typy

Do implementacji widoku potrzebne będą następujące struktury danych:

-   **`ProfileDto` (z API):** Obiekt reprezentujący dane profilu użytkownika.
    ```typescript
    export type ProfileDto = {
        id: string;
        username: string;
    };
    ```
-   **`RecipeListItemDto` (z API):** Obiekt reprezentujący pojedynczy przepis na liście.
    ```typescript
    export type RecipeListItemDto = {
        id: number;
        name: string;
        image_path: string | null;
        created_at: string;
    };
    ```
-   **`NavigationTileViewModel` (ViewModel):** Niestandardowy typ do konfiguracji kafelków nawigacyjnych.
    ```typescript
    export interface NavigationTileViewModel {
        title: string;
        link: string;
        icon?: string; // Nazwa ikony z Angular Material
    }
    ```
-   **`DashboardState` (ViewModel):** Interfejs opisujący stan komponentu `DashboardPageComponent`.
    ```typescript
    export interface DashboardState {
        profile: ProfileDto | null;
        recentRecipes: RecipeListItemDto[];
        isLoading: boolean;
        error: ApiError | null;
    }
    ```

## 6. Zarządzanie stanem

Zarządzanie stanem zostanie zrealizowane w komponencie `DashboardPageComponent` przy użyciu sygnałów (Angular Signals), zgodnie z przyjętymi standardami.

-   Zostanie utworzony jeden główny sygnał stanu: `state = signal<DashboardState>(...)`.
-   Początkowy stan będzie ustawiony na `isLoading: true`.
-   Do odczytu poszczególnych części stanu zostaną użyte sygnały `computed`:
    -   `profile = computed(() => this.state().profile);`
    -   `recentRecipes = computed(() => this.state().recentRecipes);`
-   Aktualizacje stanu będą wykonywane za pomocą metody `state.update()`, co zapewni niemutowalność i przewidywalność zmian.

## 7. Integracja API

Komponent `DashboardPageComponent` będzie korzystał z dwóch serwisów do komunikacji z API: `ProfileService` i `RecipesService`.

1.  **Pobieranie profilu użytkownika:**
    -   **Endpoint:** `GET /profile`
    -   **Serwis:** `ProfileService.getProfile()`
    -   **Typ odpowiedzi:** `Observable<ProfileDto>`
    -   **Akcja:** Po pomyślnym pobraniu, dane zostaną zapisane w stanie.

2.  **Pobieranie ostatnich przepisów:**
    -   **Endpoint:** `GET /recipes`
    -   **Serwis:** `RecipesService.getRecipes({ sort: 'created_at.desc', limit: 5 })`
    -   **Typ odpowiedzi:** `Observable<PaginatedResponseDto<RecipeListItemDto>>`
    -   **Akcja:** Po pomyślnym pobraniu, pole `data` z odpowiedzi zostanie zapisane w stanie.

Oba wywołania API zostaną uruchomione równolegle przy użyciu `forkJoin` z biblioteki RxJS w metodzie `ngOnInit` komponentu.

## 8. Interakcje użytkownika

-   **Wejście na stronę:**
    -   Użytkownik nawiguje na `/dashboard`.
    -   Wyświetlany jest wskaźnik ładowania.
    -   Aplikacja wysyła żądania do API.
    -   Po otrzymaniu odpowiedzi, wskaźnik ładowania jest ukrywany, a na ekranie pojawia się powitanie, kafelki nawigacyjne i lista przepisów.
-   **Kliknięcie kafelka nawigacyjnego:**
    -   Użytkownik klika kafelek "Moje przepisy" lub "Moje kolekcje".
    -   Angular Router nawiguje użytkownika do odpowiedniej ścieżki (`/recipes` lub `/collections`).
-   **Kliknięcie przepisu na liście:**
    -   Użytkownik klika element na liście ostatnio dodanych przepisów.
    -   Angular Router nawiguje użytkownika do strony szczegółów przepisu (`/recipes/:id`).

## 9. Warunki i walidacja

Walidacja na poziomie tego widoku jest minimalna i sprowadza się do obsługi stanu danych:

-   **Brak przepisów:** Komponent `RecentRecipesListComponent` sprawdzi, czy przekazana tablica przepisów jest pusta. Jeśli tak, wyświetli komunikat "Nie masz jeszcze żadnych przepisów" wraz z przyciskiem/linkiem do strony tworzenia nowego przepisu.
-   **Brak nazwy użytkownika:** Komponent `WelcomeHeaderComponent` wyświetli generyczne powitanie ("Witaj!"), jeśli z jakiegoś powodu obiekt profilu nie będzie zawierał nazwy użytkownika.

## 10. Obsługa błędów

-   **Błąd autoryzacji:** `AuthGuard` na poziomie routingu przechwyci próbę wejścia przez niezalogowanego użytkownika i przekieruje go na stronę logowania. Komponent nie będzie świadomy tej operacji.
-   **Błąd API:** Jeśli którekolwiek z wywołań API (do `/profile` lub `/recipes`) zakończy się błędem (np. status 500), stan `error` w komponencie zostanie zaktualizowany.
-   **Prezentacja błędu:** W interfejsie, zamiast treści strony, zostanie wyświetlony generyczny komunikat o błędzie (np. "Wystąpił błąd podczas ładowania danych. Spróbuj odświeżyć stronę.") z opcjonalnym przyciskiem "Spróbuj ponownie", który ponownie wywoła logikę pobierania danych.

## 11. Kroki implementacji

1.  **Utworzenie struktury plików:**
    -   `ng generate component pages/dashboard/DashboardPage --standalone`
    -   Ręczne utworzenie plików dla komponentów prezentacyjnych w `src/app/pages/dashboard/components/`.
2.  **Konfiguracja routingu:** Dodanie ścieżki `/dashboard` do głównego pliku z routingiem aplikacji, wskazując na `DashboardPageComponent` i dodając `AuthGuard`.
3.  **Implementacja `DashboardPageComponent`:**
    -   Zdefiniowanie sygnału dla stanu `DashboardState`.
    -   Wstrzyknięcie `ProfileService` i `RecipesService`.
    -   Implementacja logiki pobierania danych w `ngOnInit` z użyciem `forkJoin`.
    -   Obsługa sukcesu i błędu, aktualizacja sygnału stanu.
    -   Stworzenie szablonu HTML, który będzie przekazywał dane do komponentów prezentacyjnych przy użyciu `@if` do obsługi stanów.
4.  **Implementacja komponentów prezentacyjnych:**
    -   Stworzenie `WelcomeHeaderComponent` z wejściem `profile`.
    -   Stworzenie `NavigationTileComponent` z wejściem `tileData` i `[routerLink]`.
    -   Stworzenie `RecentRecipesListComponent` z wejściem `recipes`, implementacją pętli `@for` i obsługą stanu pustego.
5.  **Stylizacja:** Ostylowanie komponentów zgodnie z UI Planem, używając Angular Material i zmiennych SCSS.
6.  **Testowanie:** Weryfikacja manualna poprawnego wyświetlania danych, nawigacji oraz obsługi stanów ładowania i błędów.
