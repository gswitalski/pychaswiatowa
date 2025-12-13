# Plan implementacji widoku: Publiczne szczegóły przepisu

## 1. Przegląd

Widok **Publiczne szczegóły przepisu** prezentuje pełną treść **wyłącznie publicznego** przepisu dla gościa (użytkownik niezalogowany): nazwa, opis, zdjęcie, składniki, kroki, kategoria i tagi. Widok nie udostępnia akcji właściciela (brak „Edytuj/Usuń/Dodaj do kolekcji”); zamiast tego eksponuje czytelne CTA do logowania i rejestracji.

Kluczowe wymagania UX:
- układ **desktop-first**: na desktopie składniki i kroki w **2 kolumnach**,
- kroki numerowane **ciągle** (numeracja nie resetuje się po nagłówkach sekcji),
- adres URL publiczny i udostępnialny (**SEO-friendly**) w formacie `:id-:slug`.

## 2. Routing widoku

- **Ścieżka:** `/explore/recipes/:id-:slug`
- **Layout:** `PublicLayoutComponent`
- **Komponent routowalny:** `PublicRecipeDetailPageComponent` (nowy)

Uwagi do routingu/SEO:
- API korzysta wyłącznie z `id` (slug jest informacyjny/SEO).
- `slug` nie jest wymagany do pobrania danych, ale powinien być utrzymywany w URL.
- (Rekomendowane) jeśli `slug` w URL różni się od sluga wyliczonego z `recipe.name`, wykonać nawigację `replaceUrl: true` do kanonicznego URL.

## 3. Struktura komponentów

Priorytet: **maksymalna reużywalność** z istniejącego widoku `src/app/pages/recipes/recipe-detail/` bez duplikacji.

Proponowane drzewo komponentów:

```
PublicLayoutComponent
 └─ RouterOutlet
     └─ PublicRecipeDetailPageComponent (nowy kontener)
         ├─ PageHeaderComponent (reuse; bez akcji właściciela)
         │   └─ CTA: Zaloguj / Zarejestruj
         ├─ RecipeHeaderComponent (reuse po lekkiej generalizacji) / lub wariant publiczny bez linków
         ├─ RecipeImageComponent (reuse)
         ├─ RecipeContentListComponent (reuse)  [Składniki]
         └─ RecipeContentListComponent (reuse)  [Kroki – numerowane]
```

Docelowa lokalizacja plików:
- `src/app/pages/explore/public-recipe-detail/public-recipe-detail-page.component.{ts,html,scss}` (nowe)

Reużywane pliki (bez kopiowania):
- `src/app/core/services/public-recipes.service.ts`
- `src/app/pages/recipes/recipe-detail/components/recipe-image/*`
- `src/app/pages/recipes/recipe-detail/components/recipe-content-list/*`
- `src/app/pages/recipes/recipe-detail/components/recipe-header/*` (po dostosowaniu do kontekstu publicznego)
- `src/app/shared/components/page-header/*`

## 4. Szczegóły komponentów

### `pych-public-recipe-detail-page` (`PublicRecipeDetailPageComponent`) (nowy)
- **Opis komponentu:** Komponent-kontener. Odczytuje `id` i `slug` z URL, pobiera szczegóły publicznego przepisu przez `PublicRecipesService`, zarządza stanem (loading/error/data), renderuje układ strony oraz CTA do logowania/rejestracji.
- **Główne elementy:**
  - `PageHeaderComponent` z tytułem `recipe.name` i (opcjonalnie) przyciskiem „Wróć” do `/explore`.
  - Sekcja header: metadane (nazwa/opis/kategoria/tagi) + zdjęcie.
  - Sekcja treści: 2 kolumny na desktopie (Składniki + Kroki), 1 kolumna na mobile.
- **Obsługiwane interakcje:**
  - Klik „Wróć” → nawigacja do `/explore` (z zachowaniem query params, jeśli są dostępne w historii/router state).
  - Klik CTA:
    - „Zaloguj się” → `/login` z `returnUrl` wskazującym bieżący adres (rekomendowane),
    - „Zarejestruj się” → `/register` z `returnUrl` (rekomendowane).
  - (Rekomendowane) kanonikalizacja sluga → `router.navigate([...], { replaceUrl: true })`.
- **Obsługiwana walidacja (guard clauses):**
  - `id` musi być liczbą dodatnią:
    - brak `id` lub `NaN` → stan błędu 400 (komunikat „Nieprawidłowy identyfikator przepisu”) + przycisk powrotu do `/explore`.
  - `slug`:
    - może być pusty/nieobecny (wtedy generujemy kanoniczny URL po pobraniu danych).
- **Typy:**
  - DTO: `PublicRecipeDetailDto`
  - VM/stany (lokalne): `PublicRecipeDetailState` (opis w sekcji 5)
- **Propsy:** brak (komponent routowalny).

### `pych-recipe-header` (`RecipeHeaderComponent`) (reuse – rekomendowana minimalna generalizacja)
Aktualnie komponent jest związany z `RecipeDetailDto` i linkuje do prywatnego `/recipes` (kategoria/tagi). Dla publicznych szczegółów:
- **Cel:** użyć tego samego komponentu do renderowania nazwy/opisu/kategorii/tagów bez duplikacji.
- **Rekomendowana zmiana:**
  - wprowadzić wspólny VM wejściowy, np. `RecipeHeaderVm` (name, description, category, tags),
  - dodać `context: 'private' | 'public'` lub `isPublic: boolean` i:
    - dla `public`: kategoria/tagi jako elementy nieklikalne lub linkujące do `/explore?q=...` (MVP: preferowane nieklikalne),
    - dla `private`: zachować obecne linki do `/recipes`.
- **Obsługiwane interakcje:** (opcjonalnie) klik tag/kategoria w publicznym kontekście → przejście do `/explore?q=<tag>`.
- **Walidacja:** brak.
- **Typy:** `RecipeHeaderVm`.
- **Propsy:**
  - `vm: RecipeHeaderVm` (required)
  - `context?: 'private' | 'public'` (default: 'private')

### `pych-recipe-image` (`RecipeImageComponent`) (reuse)
- **Opis komponentu:** Wyświetla zdjęcie przepisu lub placeholder.
- **Główne elementy:** `<img>` lub placeholder.
- **Walidacja:** brak.
- **Typy:** brak.
- **Propsy:**
  - `imageUrl: string | null`
  - `recipeName: string`

### `pych-recipe-content-list` (`RecipeContentListComponent`) (reuse)
- **Opis komponentu:** Renderuje listę elementów `RecipeContent` (nagłówki sekcji + elementy). Obsługuje tryb numerowany dla kroków.
- **Główne elementy:** `<ul>` + `<li>` z CSS counters.
- **Wymaganie ciągłej numeracji kroków:**
  - komponent już spełnia to wymaganie: numeracja jest realizowana przez `counter-increment` wyłącznie na `.content-item`, więc nagłówki `.content-header` nie resetują licznika.
- **Walidacja:** brak.
- **Typy:** `RecipeContent`.
- **Propsy:**
  - `title: string`
  - `content: RecipeContent`
  - `isNumbered?: boolean` (default: `true`)

### CTA w nagłówku (`PageHeaderComponent`) (reuse)
- **Opis:** W publicznym widoku zastępuje akcje właściciela.
- **Główne elementy:** 2 przyciski (Material):
  - „Zaloguj się” (primary)
  - „Zarejestruj się” (stroked/secondary)
- **Interakcje:** nawigacja do `/login` i `/register`.
- **Walidacja:** brak.

## 5. Typy

Typy DTO dostępne w `shared/contracts/types.ts`:
- `PublicRecipeDetailDto`
- `RecipeContent`, `RecipeContentItem`
- `CategoryDto`, `ProfileDto`
- `ApiError` (dla ujednoliconej obsługi błędów w UI)

Rekomendowane typy ViewModel / state (lokalne w pliku komponentu lub w `src/app/pages/explore/models/`):

- `RecipeHeaderVm` (dla reużycia `RecipeHeaderComponent` w trybie publicznym i prywatnym):
  - `name: string`
  - `description: string | null`
  - `category: { id: number; name: string } | null`
  - `tags: { id: number; name: string }[]` (w publicznym kontekście id może być generowane po indeksie)

- `PublicRecipeDetailState`:
  - `recipe: PublicRecipeDetailDto | null`
  - `isLoading: boolean`
  - `error: ApiError | null`

## 6. Zarządzanie stanem

Zarządzanie stanem lokalnie w `PublicRecipeDetailPageComponent` z wykorzystaniem **Angular Signals**:
- `state = signal<PublicRecipeDetailState>({ recipe: null, isLoading: true, error: null })`
- `computed()` dla: `recipe`, `isLoading`, `error`, `pageTitle`.

Zasady UX:
- pokazywać spójny stan ładowania (spinner/skeleton) bez „białych overlay”;
- w przypadku ponownego pobrania danych (np. retry) aktualizować stan przez `state.update()`.

## 7. Integracja API

- **Endpoint:** `GET /public/recipes/{id}`
- **Serwis:** `PublicRecipesService.getPublicRecipeById(id: number): Observable<PublicRecipeDetailDto>`
- **Przepływ:**
  1. Odczytaj `id` z parametru trasy `:id` (część `:id-:slug`).
  2. Jeśli `id` niepoprawne → ustaw `error` 400 i przerwij.
  3. Ustaw `isLoading=true` i wywołaj `getPublicRecipeById(id)`.
  4. Sukces → zapisz `recipe`, `isLoading=false`.
  5. Błąd → ustaw `error`, `isLoading=false`.

Rekomendacja jakościowa (dla czytelnych stanów błędu):
- rozważyć doposażenie `PublicRecipesService` w mapowanie błędów do `ApiError` z `status` (np. 404), aby UI mógł odróżnić „nie znaleziono” od błędów sieci.

## 8. Interakcje użytkownika

- **Wejście na URL publiczny:**
  - użytkownik widzi ładowanie,
  - po pobraniu danych widzi pełne szczegóły.
- **CTA do logowania/rejestracji:**
  - klik „Zaloguj się”/„Zarejestruj się” przenosi do odpowiedniego widoku,
  - (rekomendowane) po zalogowaniu powrót na bieżący przepis poprzez `returnUrl`.
- **Brak akcji właściciela:**
  - na stronie nie ma przycisków „Edytuj”, „Usuń”, „Dodaj do kolekcji”.

## 9. Warunki i walidacja

Warunki wynikające z wymagań i API:
- widok musi pokazywać **tylko** przepisy `visibility = 'PUBLIC'` (wymuszane przez endpoint publiczny; UI nie może zakładać, że prywatne ID zadziała),
- `id` w URL musi być liczbą,
- numeracja kroków ma być ciągła (zapewnione przez `RecipeContentListComponent` w trybie `isNumbered=true`).

Walidacja i wpływ na UI:
- **Nieprawidłowy `id`:** stan błędu 400 + przycisk „Wróć do przeglądania” (`/explore`).
- **Slug niekanoniczny:** (opcjonalnie) automatyczna korekta URL bez zmiany widoku (`replaceUrl`).

## 10. Obsługa błędów

Scenariusze błędów i oczekiwane zachowanie:
- **404 Not Found** (przepis nie istnieje lub nie jest publiczny):
  - komunikat „Nie znaleziono publicznego przepisu”
  - CTA: „Wróć do przeglądania” (`/explore`).
- **Błąd sieci / 5xx / błąd Edge Function:**
  - komunikat generyczny: „Wystąpił błąd podczas pobierania przepisu. Spróbuj ponownie.”
  - przycisk „Spróbuj ponownie” (retry).

## 11. Kroki implementacji

1. **Routing:** dodać nową trasę w `src/app/app.routes.ts` w sekcji `PublicLayoutComponent`:
   - `path: 'explore/recipes/:id-:slug'` → `loadComponent` do `PublicRecipeDetailPageComponent`.
2. **Nowy komponent strony:** utworzyć `PublicRecipeDetailPageComponent` (standalone, OnPush, selektor `pych-*`).
3. **Reużycie layoutu:** skopiować układ (header+image + 2 kolumny treści) z `RecipeDetailPageComponent`, ale bez akcji właściciela.
4. **API:** zintegrować `PublicRecipesService.getPublicRecipeById()` i sygnałowy `state`.
5. **Obsługa parametrów URL:**
   - walidacja `id`,
   - (opcjonalnie) kanonikalizacja sluga po pobraniu danych.
6. **CTA:** dodać w `PageHeaderComponent` przyciski „Zaloguj się” i „Zarejestruj się” (+ `returnUrl`).
7. **Reużycie `RecipeHeaderComponent`:** wdrożyć minimalną generalizację (VM + context), aby publiczny widok mógł wyświetlać kategorię i tagi bez linkowania do prywatnego `/recipes`.
8. **Stany UI:** dodać/ustandaryzować: loading, 404, błąd ogólny + retry.
9. **Responsywność i a11y:** dopracować SCSS (2 kolumny na desktopie, 1 na mobile), dodać `aria-label` dla CTA i elementów stanu błędu.
10. **Weryfikacja kryteriów akceptacji:**
   - obecność wszystkich pól (nazwa/opis/zdjęcie/składniki/kroki/kategoria/tagi),
   - układ 2-kolumnowy na desktopie,
   - ciągła numeracja kroków,
   - brak akcji właściciela,
   - poprawny, shareable URL `:id-:slug`.
