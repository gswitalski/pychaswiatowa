# Implementacja normalizacji URL przepisów

## Przegląd

Zaimplementowano system kanonicznych, SEO-friendly URL-i dla szczegółów przepisów w formacie `:id-:slug` z pełną kompatybilnością wsteczną dla legacy URL-i `:id`.

## Zaimplementowane komponenty

### 1. SlugService (`src/app/shared/services/slug.service.ts`)
Serwis odpowiedzialny za generowanie URL-safe slug'ów z nazw przepisów.

**Funkcjonalności:**
- Konwersja do lowercase
- Transliteracja polskich znaków diakrytycznych (ą→a, ć→c, ę→e, ł→l, ń→n, ó→o, ś→s, ż→z, ź→z)
- Zamiana znaków niealfanumerycznych na separator `-`
- Redukcja wielokrotnych separatorów
- Trim separatorów z początku/końca
- Limit długości (domyślnie 80 znaków)
- Fallback dla pustych wartości: `"przepis"`

**Przykłady:**
```typescript
slugify('Biała kiełbasa z jabłkami') // 'biala-kielbasa-z-jablkami'
slugify('Żurek na śmietanie')        // 'zurek-na-smietanie'
slugify('')                          // 'przepis'
```

### 2. URL Matchers (`src/app/core/routing/recipe-url.matchers.ts`)
Matchery dla Angular Router obsługujące różne formaty URL-i.

**Matchery:**
- `recipeIdSlugMatcher` - dopasowuje kanoniczne URL-e `^\d+-.*$` (np. `123-biala-kielbasa`)
- `recipeIdOnlyMatcher` - dopasowuje legacy URL-e `^\d+$` (np. `123`)

### 3. RecipeUrlNormalizationPageComponent (`src/app/pages/recipes/recipe-url-normalization/`)
Techniczny komponent odpowiedzialny za normalizację legacy URL-i do formatu kanonicznego.

**Funkcjonalności:**
- Obsługa kontekstu publicznego (`/explore/recipes/:id`) i prywatnego (`/recipes/:id`)
- Pobieranie danych przepisu i generowanie sluga
- Nawigacja do kanonicznego URL z `replaceUrl: true` (nie pozostawia legacy URL w historii)
- Zachowanie query params przy normalizacji
- Szczegółowa obsługa błędów (400, 403, 404, 500)

## Zaktualizowane komponenty

### 4. Routing (`src/app/app.routes.ts` i `src/app/pages/recipes/recipes.routes.ts`)
Zaktualizowano konfigurację tras dla obu kontekstów (publiczny i prywatny).

**Publiczny kontekst (`/explore/recipes/...`):**
- Kanoniczny: matcher → `ExploreRecipeDetailPageComponent`
- Legacy: matcher → `RecipeUrlNormalizationPageComponent` (context: 'public')

**Prywatny kontekst (`/recipes/...`):**
- Kanoniczny: matcher → `RecipeDetailPageComponent`
- Legacy: matcher → `RecipeUrlNormalizationPageComponent` (context: 'private')

### 5. Detail Pages
Zaktualizowano komponenty szczegółów przepisu:

**ExploreRecipeDetailPageComponent:**
- Odczyt parametru `slug` z URL
- Po pobraniu przepisu: porównanie z oczekiwanym slugiem
- Automatyczna normalizacja błędnego sluga z `replaceUrl: true`

**RecipeDetailPageComponent:**
- Analogiczne zmiany jak w `ExploreRecipeDetailPageComponent`

### 6. Generowanie linków
Zaktualizowano komponenty generujące linki do szczegółów przepisu:

**RecipeCardComponent:**
- Generowanie linków w formacie kanonicznym `:id-:slug`
- Użycie dostarczonego sluga lub wygenerowanie z nazwy przepisu
- Obsługa obu kontekstów (public/private)

**MyPlanDrawerComponent:**
- Nawigacja do `/explore/recipes/:id-:slug` z wygenerowanym slugiem

**RecipeFormPageComponent:**
- Nawigacja po utworzeniu/edycji przepisu do kanonicznego URL
- Pomocnicza metoda `navigateToRecipe(id, name)`

## Testy

### Testy jednostkowe (`src/app/shared/services/slug.service.spec.ts`)
Kompletny zestaw testów dla SlugService:
- Podstawowe transformacje (lowercase, spacje, znaki specjalne)
- Polskie znaki diakrytyczne (małe i duże litery)
- Wielokrotne separatory i trimming
- Limit długości (domyślny i niestandardowy)
- Fallback dla pustych wartości
- Przypadki brzegowe (cyfry, emoji, unicode, nawiasy)
- Rzeczywiste przykłady nazw przepisów

## Scenariusze użycia

### 1. Wejście na legacy URL
**Przed:** `/explore/recipes/123`
**Po:** Automatyczne przekierowanie do `/explore/recipes/123-biala-kielbasa-z-jablkami`
- Użytkownik widzi krótki loader
- URL w przeglądarce zostaje zaktualizowany (replaceUrl)
- Nie pozostaje ślad w historii przeglądarki

### 2. Wejście na błędny slug
**Przed:** `/explore/recipes/123-zly-slug`
**Po:** Automatyczne przekierowanie do `/explore/recipes/123-biala-kielbasa-z-jablkami`
- Po pobraniu danych przepisu wykrywany jest błędny slug
- Automatyczna normalizacja do poprawnego sluga

### 3. Kliknięcie w kartę przepisu
**Przed:** Nawigacja do `/explore/recipes/123`
**Po:** Nawigacja bezpośrednio do `/explore/recipes/123-biala-kielbasa-z-jablkami`
- Linki generowane są od razu w formacie kanonicznym
- Brak niepotrzebnych przekierowań

### 4. Zmiana nazwy przepisu
**Przed:** URL: `/recipes/123-stara-nazwa`
**Po edycji:** Automatyczne przekierowanie do `/recipes/123-nowa-nazwa`
- Po zapisaniu zmian nawigacja do nowego URL
- Stare URL-e nadal działają (normalizacja)

## Instrukcje testowania

### Przygotowanie środowiska
```bash
# Uruchom aplikację
ng serve

# Uruchom testy jednostkowe
ng test
```

### Scenariusze testowe

#### Test 1: Legacy URL (publiczny)
1. Zaloguj się jako użytkownik testowy
2. Wejdź na: `http://localhost:4200/explore/recipes/1`
3. **Oczekiwany rezultat:**
   - Krótki loader "Przekierowujemy..."
   - Automatyczne przekierowanie do `/explore/recipes/1-nazwa-przepisu`
   - URL w przeglądarce zaktualizowany
   - Przycisk "Wstecz" nie wraca do legacy URL

#### Test 2: Legacy URL (prywatny)
1. Zaloguj się jako właściciel przepisu
2. Wejdź na: `http://localhost:4200/recipes/1`
3. **Oczekiwany rezultat:**
   - Analogicznie jak Test 1
   - Przekierowanie do `/recipes/1-nazwa-przepisu`

#### Test 3: Błędny slug
1. Wejdź na: `http://localhost:4200/explore/recipes/1-niepoprawny-slug`
2. **Oczekiwany rezultat:**
   - Automatyczne przekierowanie do poprawnego sluga
   - Brak komunikatu o błędzie

#### Test 4: Kanoniczny URL
1. Wejdź na: `http://localhost:4200/explore/recipes/1-poprawny-slug`
2. **Oczekiwany rezultat:**
   - Brak przekierowania
   - Natychmiastowe wyświetlenie szczegółów przepisu

#### Test 5: Karta przepisu (RecipeCardComponent)
1. Przejdź do strony explore: `/explore`
2. Kliknij w dowolną kartę przepisu
3. **Oczekiwany rezultat:**
   - Nawigacja do URL w formacie `/explore/recipes/:id-:slug`
   - Brak przekierowań

#### Test 6: Mój plan (MyPlanDrawerComponent)
1. Dodaj przepis do planu
2. Otwórz drawer "Mój plan" (FAB w prawym dolnym rogu)
3. Kliknij w przepis z listy
4. **Oczekiwany rezultat:**
   - Nawigacja do URL w formacie `/explore/recipes/:id-:slug`
   - Drawer się zamyka

#### Test 7: Tworzenie przepisu
1. Utwórz nowy przepis: `/recipes/new`
2. Wypełnij formularz i zapisz
3. **Oczekiwany rezultat:**
   - Nawigacja do `/recipes/:id-:slug` (nowo utworzony przepis)
   - URL zawiera slug wygenerowany z nazwy przepisu

#### Test 8: Edycja przepisu
1. Edytuj istniejący przepis: `/recipes/:id/edit`
2. Zmień nazwę przepisu
3. Zapisz zmiany
4. **Oczekiwany rezultat:**
   - Nawigacja do `/recipes/:id-nowy-slug`
   - URL odzwierciedla nową nazwę

#### Test 9: Query params
1. Wejdź na: `http://localhost:4200/explore/recipes/1?test=value`
2. **Oczekiwany rezultat:**
   - Przekierowanie do `/explore/recipes/1-nazwa?test=value`
   - Query params zachowane

#### Test 10: Błędy 404
1. Wejdź na nieistniejący przepis: `/explore/recipes/999999`
2. **Oczekiwany rezultat (gość):**
   - Komunikat: "Ten przepis nie został znaleziony lub jest prywatny. Zaloguj się, aby uzyskać dostęp."
3. **Oczekiwany rezultat (zalogowany):**
   - Komunikat: "Przepis nie został znaleziony lub nie masz do niego dostępu."

#### Test 11: Polskie znaki w nazwie
1. Utwórz przepis z nazwą: "Żurek na śmietanie z jajkiem"
2. **Oczekiwany rezultat:**
   - URL: `/recipes/:id-zurek-na-smietanie-z-jajkiem`
   - Wszystkie polskie znaki poprawnie przetransformowane

#### Test 12: Bardzo długa nazwa
1. Utwórz przepis z nazwą dłuższą niż 80 znaków
2. **Oczekiwany rezultat:**
   - Slug obcięty do 80 znaków
   - Brak myślnika na końcu

## Zgodność wsteczna

✅ **Wszystkie stare URL-e nadal działają:**
- `/explore/recipes/:id` → automatyczna normalizacja
- `/recipes/:id` → automatyczna normalizacja

✅ **Bookmarki i linki zewnętrzne:**
- Stare linki są automatycznie przekierowywane
- SEO: canonical URL jest zawsze aktualny

✅ **Historia przeglądarki:**
- `replaceUrl: true` zapobiega duplikatom w historii
- Przycisk "Wstecz" działa poprawnie

## Pliki zmodyfikowane

### Nowe pliki:
- `src/app/shared/services/slug.service.ts`
- `src/app/shared/services/slug.service.spec.ts`
- `src/app/core/routing/recipe-url.matchers.ts`
- `src/app/pages/recipes/recipe-url-normalization/recipe-url-normalization-page.component.ts`

### Zmodyfikowane pliki:
- `src/app/app.routes.ts`
- `src/app/pages/recipes/recipes.routes.ts`
- `src/app/pages/explore/explore-recipe-detail/explore-recipe-detail-page.component.ts`
- `src/app/pages/recipes/recipe-detail/recipe-detail-page.component.ts`
- `src/app/shared/components/recipe-card/recipe-card.ts`
- `src/app/shared/components/my-plan-drawer/my-plan-drawer.component.ts`
- `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`

## Status

✅ **Implementacja zakończona**
✅ **Testy jednostkowe utworzone**
✅ **Brak błędów lintera**
⏳ **Oczekuje na ręczne testy użytkownika**

## Następne kroki

1. Uruchom aplikację i przetestuj scenariusze testowe
2. Zweryfikuj działanie na różnych przeglądarkach
3. Sprawdź wydajność (czy normalizacja nie powoduje opóźnień)
4. Opcjonalnie: dodaj testy E2E dla kluczowych scenariuszy
5. Opcjonalnie: rozszerz backend DTO o pole `slug` dla lepszej wydajności (uniknie generowania sluga w UI)

