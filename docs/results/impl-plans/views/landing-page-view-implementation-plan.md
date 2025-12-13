# Plan implementacji widoku Landing Page (Publiczny portal przepisów)

## 1. Przegląd

Widok **Landing Page** (`/`) jest publicznie dostępną stroną główną dla gościa. Poza warstwą marketingową (hero) prezentuje od razu wartościowy content: **pole wyszukiwania publicznych przepisów** oraz **sekcje z kuratorowanymi listami przepisów publicznych**. Z widoku gość może:

- przejść do logowania lub rejestracji,
- rozpocząć wyszukiwanie (nawigacja do katalogu publicznego),
- kliknąć kartę przepisu i przejść do szczegółów publicznego przepisu.

Widok nie może w żaden sposób ujawnić przepisów o widoczności `PRIVATE` ani `SHARED`.

## 2. Routing widoku

- **Ścieżka**: `/`
- **Layout**: `PublicLayoutComponent` (publiczna część aplikacji)
- **Komponent**: `LandingPageComponent`

Uwagi integracyjne (zależności):
- Pole wyszukiwania powinno nawigować do `/explore` z parametrem query `q`.
- Karty przepisów publicznych powinny nawigować do `/explore/recipes/:id-:slug`.

## 3. Struktura komponentów

Proponowana struktura (z zachowaniem podejścia standalone, selektorów `pych-*` oraz CD OnPush):

```
PublicLayoutComponent
 ├─ PublicHeaderComponent
 └─ RouterOutlet
     └─ LandingPageComponent
         ├─ HeroComponent
         ├─ PublicRecipesSearchComponent
         └─ PublicRecipesSectionComponent (x3)
             └─ PublicRecipeCardComponent (lista)
```

Lokalizacja plików (zgodnie z istniejącą strukturą):

- `src/app/pages/landing/landing-page.component.*` (modyfikacja)
- `src/app/pages/landing/components/hero/*` (modyfikacja CTA opcjonalnie)
- `src/app/pages/landing/components/public-recipes-search/*` (nowe)
- `src/app/pages/landing/components/public-recipes-section/*` (nowe)
- `src/app/pages/landing/components/public-recipe-card/*` (nowe)
- `src/app/core/services/public-recipes.service.ts` (nowe; współdzielone także dla `/explore`)

## 4. Szczegóły komponentów

### `pych-public-header` (istnieje)
- **Opis komponentu**: Nagłówek dla stron publicznych. Zapewnia widoczne akcje "Zaloguj się" i "Zarejestruj się" (wymaganie US-017).
- **Główne elementy**: `mat-toolbar`, logo linkujące do `/`, linki do `/login` i `/register`.
- **Obsługiwane zdarzenia**: kliknięcia `routerLink`.
- **Obsługiwana walidacja**: brak.
- **Typy**: brak.
- **Propsy**: brak.

### `pych-landing-page` (`LandingPageComponent`) (modyfikacja)
- **Opis komponentu**: Kontener widoku. Renderuje hero, wyszukiwarkę publiczną oraz sekcje z publicznymi przepisami. Odpowiada za pobranie danych do sekcji i przekazanie ich do komponentów prezentacyjnych.
- **Główne elementy**:
  - `<pych-hero />`
  - `<pych-public-recipes-search />`
  - 3x `<pych-public-recipes-section />` (np. "Najnowsze", "Polecane", "Sezonowe")
- **Obsługiwane zdarzenia**:
  - `searchSubmit(q)` z `PublicRecipesSearchComponent` → nawigacja do `/explore?q=...`
  - `retry(sectionKey)` → ponowne pobranie danych dla sekcji
- **Obsługiwana walidacja**:
  - brak walidacji formularza w samym komponencie (walidacja w `PublicRecipesSearchComponent`)
- **Typy**:
  - `PublicRecipeListItemDto` (dane wejściowe)
  - `LandingSectionKey`, `LandingSectionVm`, `AsyncSectionState<T>` (VM lokalne dla widoku)
- **Propsy**: brak.

### `pych-hero` (`HeroComponent`) (opcjonalna modyfikacja)
- **Opis komponentu**: Sekcja marketingowa. Dla czytelności UX warto dodać też przycisk "Zaloguj się" obok "Rozpocznij za darmo".
- **Główne elementy**:
  - `<h1>`, opis, przyciski CTA (`mat-raised-button` / `mat-button`)
- **Obsługiwane zdarzenia**: nawigacja do `/register` (istnieje), opcjonalnie do `/login`.
- **Walidacja**: brak.
- **Typy/Propsy**: brak.

### `pych-public-recipes-search` (`PublicRecipesSearchComponent`) (nowy)
- **Opis komponentu**: Publiczne pole wyszukiwania (na landing), które przenosi użytkownika do katalogu `/explore`.
- **Główne elementy**:
  - `mat-form-field` + `input matInput`
  - opcjonalnie `mat-icon` (ikona lupy) i przycisk "Szukaj"
  - komunikat błędu walidacji pod polem
- **Obsługiwane zdarzenia**:
  - wpisywanie w input (aktualizacja `FormControl`)
  - submit (Enter lub klik w przycisk) → emit `searchSubmit`
- **Obsługiwana walidacja (frontend, zgodna z API)**:
  - `q` po `trim()`:
    - jeśli puste → nie nawiguj (lub nawiguj do `/explore` bez `q`, jeśli to jest pożądane UX)
    - jeśli niepuste i długość `< 2` → pokaż błąd: "Wpisz co najmniej 2 znaki" i **nie** nawiguj
    - jeśli `>= 2` → emituj `searchSubmit(q)`
- **Typy**:
  - VM: `PublicRecipesSearchVm` (np. `query: FormControl<string>`)
- **Propsy**:
  - `placeholder?: string`
  - `initialQuery?: string` (opcjonalnie)
  - `searchSubmit: output<string>`

### `pych-public-recipes-section` (`PublicRecipesSectionComponent`) (nowy)
- **Opis komponentu**: Sekcja listy publicznych przepisów na landing (nagłówek + pozioma/siatkowa lista kart).
- **Główne elementy**:
  - nagłówek sekcji (np. `<h2>`)
  - kontener listy (`@for` po `recipes`)
  - stany: loading (skeleton), error (komunikat + retry), empty ("Brak przepisów")
- **Obsługiwane zdarzenia**:
  - `retry` (kliknięcie w przycisk ponowienia)
- **Obsługiwana walidacja**: brak.
- **Typy**:
  - `PublicRecipeCardVm[]` (VM dla kart)
- **Propsy**:
  - `title: input.required<string>`
  - `recipes: input.required<PublicRecipeCardVm[]>`
  - `isLoading: input<boolean>`
  - `errorMessage: input<string | null>`
  - `retry: output<void>`

### `pych-public-recipe-card` (`PublicRecipeCardComponent`) (nowy)
- **Opis komponentu**: Karta publicznego przepisu spełniająca US-017: zdjęcie (jeśli jest), nazwa, kategoria (jeśli jest). Klik prowadzi do publicznych szczegółów.
- **Główne elementy**:
  - `mat-card` z obrazkiem / placeholderem
  - nazwa przepisu
  - wiersz z kategorią (np. "Deser") lub ukryty, gdy brak
- **Obsługiwane zdarzenia**:
  - kliknięcie karty → nawigacja do `/explore/recipes/:id-:slug`
- **Obsługiwana walidacja**:
  - guardy wyświetlania: `@if (categoryName)` i `@if (imageUrl)`
- **Typy**:
  - `PublicRecipeCardVm`
- **Propsy**:
  - `vm: input.required<PublicRecipeCardVm>`

## 5. Typy

Wykorzystaj istniejące typy kontraktów:
- `PublicRecipeListItemDto`
- `PaginatedResponseDto<T>`

Zdefiniuj (lokalnie dla widoku/komponentów) nowe ViewModel’e:

- `type LandingSectionKey = 'newest' | 'featured' | 'seasonal';`

- `interface PublicRecipeCardVm {
    id: number;
    name: string;
    slug: string; // generowany po stronie FE (np. slugify(name))
    imageUrl: string | null;
    categoryName: string | null;
}`

- `interface AsyncSectionState<T> {
    data: T;
    isLoading: boolean;
    errorMessage: string | null;
}`

- `interface LandingSectionVm {
    key: LandingSectionKey;
    title: string;
    query: { page: number; limit: number; sort: string };
}`

Uwagi:
- `slug` jest tylko dla SEO-friendly URL; pobieranie danych w szczegółach odbywa się po `id`.

## 6. Zarządzanie stanem

Zalecane podejście: **signals + lokalny stan asynchroniczny**, bez NgRx.

- W `LandingPageComponent` trzy niezależne stany sekcji:
  - `sectionsConfig = signal<LandingSectionVm[]>(...)`
  - `sectionsState = signal<Record<LandingSectionKey, AsyncSectionState<PublicRecipeCardVm[]>>>(...)`

- Ładowanie:
  - inicjalnie, w `ngOnInit` / `effect`, odpal równolegle pobrania dla wszystkich sekcji.
  - przy rozpoczęciu ładowania użyj `state.update(...)` i **nie czyść poprzednich danych** (zasada "keep previous data visible").

- RxJS w tle jest akceptowalny na poziomie serwisu, natomiast komponent utrzymuje rezultat w signals.

## 7. Integracja API

### Endpoint
- **GET** `/public/recipes`

### Typy
- **Response**: `PaginatedResponseDto<PublicRecipeListItemDto>`

### Budowanie zapytań dla sekcji na landing
Ponieważ API MVP udostępnia `sort`, ale nie ma dedykowanych filtrów "popularne/sezonowe", sekcje należy oprzeć o różne kombinacje `sort` i/lub stron:

- **Najnowsze**: `page=1&limit=8&sort=created_at.desc`
- **Polecane** (wariant MVP): `page=2&limit=8&sort=created_at.desc` (inna „paczka” najnowszych)
- **Sezonowe** (wariant MVP): `page=1&limit=8&sort=name.asc` (inna perspektywa sortowania)

W przyszłości, jeśli backend doda parametry (np. `filter[season]` albo `sort=popularity.desc`), wystarczy zmienić `sectionsConfig`.

### Serwis
Utwórz `PublicRecipesService` (np. w `src/app/core/services/`) działający wyłącznie przez Edge Functions:
- użyj `SupabaseService` i `supabase.functions.invoke()`
- endpoint buduj jak w istniejącym `RecipesService` (query string)

Proponowane API serwisu:
- `getPublicRecipes(params: { page?: number; limit?: number; sort?: string; q?: string }): Observable<PaginatedResponseDto<PublicRecipeListItemDto>>`

Mapowanie DTO → VM:
- `imageUrl = dto.image_path`
- `categoryName = dto.category?.name ?? null`
- `slug = slugify(dto.name)`

## 8. Interakcje użytkownika

- **Wejście na `/` jako gość**:
  - widzi hero, wyszukiwarkę i sekcje publicznych przepisów.
  - dane sekcji są pobierane asynchronicznie.

- **Wpisywanie frazy w wyszukiwarce**:
  - walidacja po stronie FE (min. 2 znaki dla niepustego `q`).

- **Submit wyszukiwania**:
  - `q` puste → opcjonalnie nawigacja do `/explore` bez parametrów
  - `q` >= 2 → nawigacja do `/explore?q=<q>`

- **Kliknięcie karty przepisu**:
  - nawigacja do `/explore/recipes/:id-:slug`

- **Kliknięcie „Zaloguj się” / „Zarejestruj się”**:
  - nawigacja do `/login` / `/register` (już zapewnia `PublicHeaderComponent`).

## 9. Warunki i walidacja

- **Walidacja wyszukiwania (frontend)**:
  - `q` po `trim()`:
    - jeśli `q.length === 1` → blokuj submit + komunikat
    - jeśli `q.length >= 2` → zezwól

- **Warunki API**:
  - `GET /public/recipes?q=...` zwróci `400 Bad Request`, jeśli `q` za krótkie.
  - Frontend powinien temu zapobiegać walidacją, ale i tak obsłużyć błąd (gdyby np. ktoś ręcznie zmienił URL w `/explore`).

- **Separacja widoczności**:
  - landing korzysta wyłącznie z `GET /public/recipes` → z definicji brak `PRIVATE/SHARED`.

## 10. Obsługa błędów

- **Błąd sieci / błąd edge function**:
  - w danej sekcji pokaż komunikat (np. "Nie udało się pobrać przepisów") i przycisk "Spróbuj ponownie".
  - nie zasłaniaj całej strony; błąd jest per-sekcja.

- **Pusta lista w sekcji**:
  - pokaż stan pusty w obrębie sekcji (np. "Brak przepisów do wyświetlenia").

- **Brak obrazka / brak kategorii**:
  - obrazek: placeholder (ikonka lub grafika)
  - kategoria: ukryj wiersz kategorii.

## 11. Kroki implementacji

1. **Zaktualizuj planowane założenia UI landingu** w `LandingPageComponent`: pod hero dodaj wyszukiwarkę i sekcje.
2. **Dodaj serwis `PublicRecipesService`** w `src/app/core/services/`:
   - metoda `getPublicRecipes(...)` wołająca `supabase.functions.invoke('public/recipes?...')`.
3. **Dodaj komponent `PublicRecipesSearchComponent`**:
   - `FormControl<string>` i walidacja min 2 znaki dla niepustego `q`.
   - `output<string>` emitujące poprawne `q`.
4. **Dodaj komponenty sekcji i karty**:
   - `PublicRecipesSectionComponent` (nagłówek + lista + stany loading/error/empty).
   - `PublicRecipeCardComponent` (obrazek/nazwa/kategoria + link do publicznych szczegółów).
5. **Rozbuduj `LandingPageComponent` o stan w signals**:
   - skonfiguruj `sectionsConfig` (3 sekcje + query)
   - załaduj dane równolegle i aktualizuj stan przez `state.update()` bez czyszczenia danych.
6. **Dodaj nawigację z wyszukiwarki**:
   - na `searchSubmit(q)` wykonaj `router.navigate(['/explore'], { queryParams: { q } })`.
7. **Dopasuj UX/wygląd**:
   - layout desktop-first, sekcje w grid/karuzeli (np. CSS grid z responsywnymi breakpointami).
   - loading: skeletony (bez białych półprzezroczystych overlayów).
8. **(Opcjonalnie) Zaktualizuj `HeroComponent`** o dodatkowy CTA "Zaloguj się".
9. **Weryfikacja kryteriów US-017**:
   - `/` jako gość pokazuje search + sekcje.
   - karty mają obrazek (lub placeholder), nazwę i kategorię (jeśli istnieje).
   - klik karty prowadzi do szczegółów publicznego przepisu.
   - akcje "Zaloguj się" i "Zarejestruj się" są widoczne (nagłówek publiczny).
   - brak wycieku `PRIVATE/SHARED` (wyłącznie endpoint publiczny).
