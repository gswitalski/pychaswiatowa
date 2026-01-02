# Plan implementacji widoku Normalizacja URL przepisu (kanoniczne `:id-:slug`)

## 1. Przegląd
Celem wdrożenia jest wprowadzenie **kanonicznych, udostępnialnych URL-i** dla szczegółów przepisu:
- publicznie: **`/explore/recipes/:id-:slug`**
- prywatnie: **`/recipes/:id-:slug`**

oraz zapewnienie **kompatybilności wstecznej**:
- wejście na legacy `/explore/recipes/:id` i `/recipes/:id` ma być automatycznie **normalizowane** do wariantu kanonicznego (nawigacja z `replaceUrl=true`),
- wejście na URL z **niepoprawnym slugiem** (np. po zmianie nazwy przepisu) ma być automatycznie normalizowane do aktualnego sluga.

Normalizacja jest realizowana jako „techniczny handler” (nowy widok) + dopięta walidacja sluga w istniejących widokach szczegółów.

## 2. Routing widoku

### 2.1. Docelowe ścieżki
- **Kanoniczne**:
    - `/explore/recipes/:id-:slug`
    - `/recipes/:id-:slug`
- **Legacy (do normalizacji)**:
    - `/explore/recipes/:id`
    - `/recipes/:id`

### 2.2. Implementacja routingu (Angular Router)
Ponieważ Angular Router nie wspiera natywnie segmentu `:id-:slug` jako dwóch osobnych parametrów w jednej ścieżce, należy użyć **`UrlMatcher`**.

Proponowane matchery:
- `recipeIdOnlyMatcher`: dopasowuje segment wyłącznie numeryczny `^\d+$` i mapuje do `posParams: { id }`.
- `recipeIdSlugMatcher`: dopasowuje segment `^\d+-.*$`, rozbija na `id` i `slug` oraz mapuje do `posParams: { id, slug }`.

Ważne:
- kolejność w `Routes` ma znaczenie: **najpierw kanoniczny matcher**, potem legacy matcher.
- normalizacja musi używać `replaceUrl: true` oraz zachowywać `queryParams` (np. `queryParamsHandling: 'preserve'`).

### 2.3. Gdzie wpiąć routing
- `src/app/app.routes.ts`:
    - Zastąpić obecne `path: 'explore/recipes/:id'` dwoma trasami opartymi o matchery:
        - kanoniczny → istniejący `ExploreRecipeDetailPageComponent`
        - legacy → nowy `RecipeUrlNormalizationPageComponent` (kontekst publiczny)
    - Dotyczy obu grup tras: zalogowany (`MainLayoutComponent`) i gość (`PublicLayoutComponent`).
- `src/app/pages/recipes/recipes.routes.ts`:
    - Dla szczegółów przepisu pod `/recipes/...` wpiąć:
        - kanoniczny matcher → istniejący `RecipeDetailPageComponent`
        - legacy matcher → nowy `RecipeUrlNormalizationPageComponent` (kontekst prywatny)
    - Trasy edycji pozostają bez zmian (`:id/edit`), bo edycja nie jest częścią wymagań SEO/kanoniczności.

## 3. Struktura komponentów

### 3.1. Diagram drzewa (wysoki poziom)
```
Router
 ├─ /explore/recipes/:id-:slug  → ExploreRecipeDetailPageComponent
 │    └─ RecipeDetailViewComponent (shared)
 │         ├─ PageHeaderComponent
 │         ├─ RecipeHeaderComponent
 │         ├─ RecipeImageComponent
 │         └─ RecipeContentListComponent (ingredients, steps)
 │
 ├─ /explore/recipes/:id (legacy) → RecipeUrlNormalizationPageComponent (public)
 │    └─ (loader + ewentualnie fallback error UI)
 │
 ├─ /recipes/:id-:slug → RecipeDetailPageComponent
 │    └─ RecipeDetailViewComponent (shared)
 │
 └─ /recipes/:id (legacy) → RecipeUrlNormalizationPageComponent (private)
      └─ (loader + ewentualnie fallback error UI)
```

### 3.2. Nowe elementy
- `RecipeUrlNormalizationPageComponent` (nowy widok / handler)
- `SlugService` lub `slugify` util (współdzielone generowanie sluga zgodne z PRD)
- `UrlMatcher`(y) dla segmentu `:id-:slug`

## 4. Szczegóły komponentów

### 4.1. `RecipeUrlNormalizationPageComponent` (NOWY)
- **Opis komponentu**: Techniczny widok odpowiedzialny za normalizację legacy URL-i `/explore/recipes/:id` oraz `/recipes/:id` do formatu kanonicznego `:id-:slug`.
- **Lokalizacja**: `src/app/pages/recipes/recipe-url-normalization/recipe-url-normalization-page.component.ts` (lub analogicznie w `pages/shared/` – preferowane miejsce: `pages/recipes/`, bo dotyczy domeny przepisu).
- **Selektor**: `pych-recipe-url-normalization-page`
- **ChangeDetection**: `OnPush`
- **Stan** (signals):
    - `isLoading: boolean` – na start `true`
    - `error: ApiError | null`
    - `targetUrl: string | null` (opcjonalnie, diagnostycznie)
- **Główne elementy**:
    - minimalny layout: spinner + tekst „Przekierowujemy…” (bez białych overlay’y; zgodnie z zasadami loading states)
    - opcjonalnie reuse `RecipeDetailViewComponent` w trybie błędu (żeby komunikaty były spójne z istniejącymi detail view).
- **Obsługiwane zdarzenia**:
    - `OnInit`: odczyt parametru `id`, pobranie danych przepisu, wyliczenie sluga, `router.navigateByUrl(...)` z `replaceUrl: true`.
- **Walidacja / guard clauses**:
    - `id` nie istnieje → ustaw `error` 400 („Nieprawidłowy identyfikator przepisu”)
    - `id` nie jest liczbą dodatnią → `error` 400
    - brak danych z API → `error` 404
- **Typy**:
    - `ApiError` (z `shared/contracts/types.ts`)
    - wewnętrzny VM: `RecipeUrlNormalizationContext = 'public' | 'private'` (np. z `route.data`)
- **Propsy**:
    - brak (pobiera wszystko z routera)
- **Integracje**:
    - Dla kontekstu `public` używa `ExploreRecipesService.getExploreRecipeById(id)`.
    - Dla kontekstu `private` używa `RecipesService.getRecipeById(id)`.
    - Do generowania sluga używa `SlugService.slugify(name)` (implementacja zgodna z PRD: diakrytyki PL, lowercase, `-`, limit 80, fallback `przepis`).
- **Nawigacja docelowa**:
    - public: `/explore/recipes/${id}-${slug}`
    - private: `/recipes/${id}-${slug}`
    - `replaceUrl: true`, `queryParamsHandling: 'preserve'`

### 4.2. `ExploreRecipeDetailPageComponent` (ZMIANA)
- **Opis zmiany**: widok ma obsługiwać kanoniczny URL `/explore/recipes/:id-:slug` oraz normalizować błędny slug (i opcjonalnie brak sluga, jeśli route matcher dopuści).
- **Główne elementy**: bez zmian – nadal render przez `RecipeDetailViewComponent`.
- **Obsługiwane zdarzenia**:
    - `OnInit`: odczyt `id` (jak dotychczas) + odczyt `slug` z route param (jeśli dostępny).
    - Po pobraniu przepisu:
        - wyliczyć `expectedSlug` z `recipe.name`
        - jeśli `slug !== expectedSlug` → nawigować do `/explore/recipes/${id}-${expectedSlug}` z `replaceUrl: true`
        - w przeciwnym razie – render jak dotychczas
- **Walidacja**:
    - `id` jak obecnie (liczba dodatnia)
    - slug:
        - jeśli `expectedSlug` puste → fallback `przepis`
        - jeśli slug w URL jest pusty/undefined → traktować jak niekanoniczny i normalizować
- **Typy**:
    - istniejące: `RecipeDetailDto`, `ApiError`
    - nowy: `expectedSlug: string` (wewnętrznie)
- **Propsy**: bez zmian

### 4.3. `RecipeDetailPageComponent` (ZMIANA)
- **Opis zmiany**: analogicznie do explore – obsługa kanonicznego `/recipes/:id-:slug` oraz normalizacja błędnego sluga.
- **Zachowanie**:
    - po pobraniu przepisu prywatnym endpointem:
        - wyliczyć `expectedSlug` z `recipe.name`
        - jeśli `slug !== expectedSlug` → nawigować do `/recipes/${id}-${expectedSlug}` z `replaceUrl: true`
- **Walidacja**:
    - `id` jak obecnie
    - slug wg reguł PRD (fallback, limit długości)
- **Typy / propsy**: bez zmian

### 4.4. `RecipeCardComponent` (ZMIANA)
- **Opis zmiany**: generować linki do szczegółów w formacie kanonicznym (tam gdzie mamy slug).
- **Zachowanie linku**:
    - public: jeśli `recipe.slug` dostępny → `/explore/recipes/${id}-${slug}`, inaczej fallback do legacy `/explore/recipes/${id}` (i zadziała normalizacja).
    - private: analogicznie → `/recipes/${id}-${slug}` jeśli slug dostępny; w przeciwnym razie `/recipes/${id}`.
- **Walidacja**:
    - slug przekazywany do komponentu powinien być już „bezpieczny” (zgodny z PRD).
- **Typy**:
    - `RecipeCardData` już zawiera `slug?: string` – należy go realnie wykorzystywać.

### 4.5. `MyPlanDrawerComponent` (ZMIANA opcjonalna)
- **Opis zmiany**: obecnie nawigacja idzie na `/explore/recipes/:id` – to jest OK jako fallback, ale docelowo preferujemy kanoniczny URL.
- **Propozycja**:
    - Jeśli `PlanListItemDto` nie ma sluga (obecnie nie ma), zostawić `/explore/recipes/${id}` i polegać na normalizacji.
    - (Opcjonalnie) rozszerzyć backend DTO planu o `recipe.slug` lub `recipe.name` i wyliczać slug w UI.

## 5. Typy

### 5.1. DTO wykorzystywane bez zmian
- `RecipeDetailDto` – do pobrania `name` (źródło sluga)
- `ApiError`

### 5.2. Nowe typy / ViewModel
- `RecipeUrlNormalizationContext`:
    - `type RecipeUrlNormalizationContext = 'public' | 'private'`
    - Przechowywane w `route.data.context`
- `SlugifyOptions` (opcjonalnie, jeśli tworzymy serwis/utility z parametrami):
    - `maxLength?: number` (domyślnie `80`)
    - `fallback?: string` (domyślnie `przepis`)

## 6. Zarządzanie stanem
- Dla `RecipeUrlNormalizationPageComponent` użyć `signals`:
    - `state = signal<{ isLoading: boolean; error: ApiError | null }>(...)`
    - guard clauses na początku procedury normalizacji (czytelne early returny).
- Dla detail pages:
    - normalizacja sluga nie może powodować „flashowania” – po wykryciu niekanoniczności wykonujemy nawigację z `replaceUrl`, a UI może nadal renderować loader/aktualny stan.
    - nie używać białych overlay’y; trzymać poprzedni stan danych jeśli następuje dogranie (zgodnie z zasadami loading states).

## 7. Integracja API

### 7.1. Źródło danych do wyliczenia sluga
- **Public**:
    - `GET (Edge Function) explore/recipes/:id`
    - serwis: `ExploreRecipesService.getExploreRecipeById(id): Observable<RecipeDetailDto>`
- **Private**:
    - `GET (Edge Function) recipes/:id`
    - serwis: `RecipesService.getRecipeById(id): Observable<RecipeDetailDto>`

### 7.2. Reguły generowania sluga (PRD, MVP)
Slug musi spełniać:
- lowercase
- transliteracja PL: `ą->a`, `ć->c`, `ę->e`, `ł->l`, `ń->n`, `ó->o`, `ś->s`, `ż->z`, `ź->z`
- znaki niealfanumeryczne → separator / usunięcie
- wielokrotne separatory → pojedynczy `-`
- trim `-` z początku/końca
- limit długości `80`
- fallback gdy pusty: `przepis`

### 7.3. Uwaga dot. `/utils/slugify`
Jeśli w projekcie istnieje Edge Function `POST /utils/slugify`, można ją wykorzystać jako „single source of truth” w normalizacji. Rekomendacja:
- dla list (landing/explore) używać lokalnego `slugify()` (szybko, bez sieci),
- dla normalizacji oraz weryfikacji sluga w detail można:
    - użyć lokalnego `slugify()` (jeśli identyczny algorytm),
    - albo wywołać `POST /utils/slugify` (jeśli chcemy 100% spójności).

W MVP preferowane jest **lokalne slugify zgodne z PRD** (bez kosztu sieci), plus ewentualne testy jednostkowe dla zgodności.

## 8. Interakcje użytkownika
- **Wejście na legacy URL**:
    - `/explore/recipes/123` → użytkownik widzi krótki loader i zostaje przeniesiony na `/explore/recipes/123-biala-kielbasa-z-jablkami` (replaceUrl).
    - `/recipes/123` → analogicznie do `/recipes/123-biala-kielbasa...` (dla autora).
- **Wejście na błędny slug**:
    - `/explore/recipes/123-zly-slug` → po pobraniu danych, automatyczna normalizacja do poprawnego sluga (replaceUrl).
    - `/recipes/123-zly-slug` → analogicznie.
- **Kliknięcie w kartę przepisu**:
    - jeśli mamy slug w danych karty → nawigacja od razu na kanoniczny URL
    - jeśli nie mamy sluga → nawigacja na legacy URL i automatyczna normalizacja

## 9. Warunki i walidacja
- **ID**:
    - wymagane, liczba całkowita dodatnia
    - w przeciwnym razie: błąd 400 w UI
- **Slug**:
    - nie jest zaufany (może być błędny)
    - UI nie blokuje renderu dla błędnego sluga – zamiast tego normalizuje URL
- **Dostępność zasobu (publiczny detail)**:
    - `visibility=PUBLIC` → 200 dla wszystkich
    - `visibility!=PUBLIC` → 200 tylko dla zalogowanego autora
    - pozostałe → 404 (dla gościa i nie-autora)
    - UI mapuje 404 na komunikat zgodny z obecnym `ExploreRecipeDetailPageComponent`

## 10. Obsługa błędów
- **400 (invalid id)**: „Nieprawidłowy identyfikator przepisu”
- **404**:
    - gość: „Ten przepis nie został znaleziony lub jest prywatny. Zaloguj się, aby uzyskać dostęp.”
    - zalogowany (nie-autora): „Przepis nie został znaleziony lub nie masz do niego dostępu.”
- **403** (prywatne): „Nie masz dostępu do tego przepisu lub nie istnieje.”
- **500 / inne**: generyczny komunikat + log w konsoli

W `RecipeUrlNormalizationPageComponent` błędy powinny być prezentowane tak, aby nie „utknąć” na spinnerze (zawsze kończyć `isLoading=false`).

## 11. Kroki implementacji
1. **Dodać współdzielony slugify zgodny z PRD**:
    - nowy `SlugService` w `src/app/shared/services/slug.service.ts` lub util w `src/app/shared/utils/slugify.ts`
    - przepisać lokalne `slugify()` z landing/explore na użycie wspólnej implementacji (żeby unikać rozjazdów).
2. **Dodać `UrlMatcher`(y)**:
    - `src/app/core/routing/recipe-url.matchers.ts`
    - eksport: `recipeIdOnlyMatcher`, `recipeIdSlugMatcher`
3. **Wpiąć nowe trasy w `app.routes.ts` dla explore**:
    - kanoniczny matcher → `ExploreRecipeDetailPageComponent`
    - legacy matcher → `RecipeUrlNormalizationPageComponent` z `data: { context: 'public' }`
4. **Wpiąć nowe trasy w `recipes.routes.ts` dla prywatnych szczegółów**:
    - kanoniczny matcher → `RecipeDetailPageComponent`
    - legacy matcher → `RecipeUrlNormalizationPageComponent` z `data: { context: 'private' }`
5. **Zaimplementować `RecipeUrlNormalizationPageComponent`**:
    - odczyt `id`
    - pobranie `RecipeDetailDto` odpowiednim serwisem
    - wyliczenie sluga
    - nawigacja do kanonicznego URL z `replaceUrl: true`
6. **Dodać normalizację błędnego sluga w detail pages**:
    - `ExploreRecipeDetailPageComponent` oraz `RecipeDetailPageComponent`
    - po pobraniu przepisu porównać `slug` z `expectedSlug` i w razie potrzeby wykonać `replaceUrl`
7. **Zaktualizować generowanie linków do szczegółów**:
    - `RecipeCardComponent.recipeLink` używa `slug` jeśli dostępny
    - landing/explore przekazują poprawny `slug` z nowej wspólnej implementacji
8. **(Opcjonalnie) Uporządkować nawigację z drawer’a „Mój plan”**:
    - pozostawić legacy i zdać się na normalizację lub rozszerzyć DTO planu o nazwę/sluga
9. **Dodać testy jednostkowe dla slugify i matcherów** (rekomendowane):
    - przypadki z polskimi znakami, puste wejście, limity, wielokrotne separatory
10. **Ręczna weryfikacja**:
    - wejścia na `/explore/recipes/:id`, `/explore/recipes/:id-zly-slug`, `/explore/recipes/:id-poprawny-slug`
    - analogicznie dla `/recipes/...` w kontekście zalogowanego autora
    - sprawdzić, że `replaceUrl` nie zostawia „śmieci” w historii przeglądarki


