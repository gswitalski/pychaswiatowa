# Plan implementacji widoku / zmiany: Wskazówki (tips) w szczegółach przepisu + wyszukiwanie + kreator AI

## 1. Przegląd
Celem zmiany jest dodanie/uwidocznienie pola **„Wskazówki”** (tips) w trzech miejscach aplikacji:

- w **szczegółach przepisu** (widok uniwersalny prywatny i publiczny) jako **osobna sekcja pod krokami przygotowania**, ukrywana gdy lista jest pusta,
- w **publicznym katalogu przepisów (Explore)** jako rozszerzenie „transparentności dopasowania” (etykieta „Dopasowanie: …” ma uwzględniać też „wskazówki”), przy zachowaniu priorytetu relevance (tips = najniższy priorytet po stronie backendu),
- w **kreatorze dodawania przepisu AI** (`/recipes/new/assist`) jako możliwość wstępnego wypełnienia formularza `tips` na bazie `tips_raw` zwróconego z AI (Edge Function).

Zmiana jest „frontend-only” w warstwie UI: backend już dostarcza `tips` w DTO szczegółów oraz `search.match = 'tips'` dla wyników publicznych, a AI draft może zawierać `tips_raw`.

## 2. Routing widoku
Zmiana dotyczy istniejących tras:

- **Szczegóły przepisu (prywatne)**: `/recipes/:id-:slug`
    - komponent: `src/app/pages/recipes/recipe-detail/recipe-detail-page.component.ts`
    - widok: `src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html`

- **Szczegóły przepisu (publiczne Explore)**: `/explore/recipes/:id-:slug`
    - komponent: `src/app/pages/explore/explore-recipe-detail/explore-recipe-detail-page.component.ts`
    - widok: `src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html`

- **Publiczny katalog przepisów (Explore)**: `/explore`
    - komponent: `src/app/pages/explore/explore-page.component.ts` + `.html`
    - wyszukiwarka: `src/app/pages/landing/components/public-recipes-search/public-recipes-search.ts` + `.html`
    - wyniki: `src/app/pages/landing/components/public-recipe-results/public-recipe-results.ts` + `.html`

- **Dodaj przepis (Kreator – AI)**: `/recipes/new/assist`
    - komponent: `src/app/pages/recipes/recipe-new-assist/recipe-new-assist-page.component.ts`
    - stan draftu: `src/app/pages/recipes/services/recipe-draft-state.service.ts`
    - formularz docelowy: `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`

## 3. Struktura komponentów
Wysokopoziomowo zmiana dotyka 3 „gałęzi” UI:

- **Szczegóły przepisu (uniwersalny widok)**:
    - `RecipeDetailPageComponent` (prywatny) / `ExploreRecipeDetailPageComponent` (publiczny)
        - `RecipeDetailViewComponent` (shared)
            - `pych-page-header` (warunkowo)
            - `pych-recipe-header`
            - `pych-recipe-image`
            - `pych-recipe-content-list` (Składniki)
            - `pych-recipe-content-list` (Kroki)
            - `pych-recipe-content-list` (Wskazówki) **[NOWE, warunkowe]**

- **Explore (wyszukiwarka publiczna)**:
    - `ExplorePageComponent`
        - `PublicRecipesSearchComponent` (`pych-public-recipes-search`)
            - `PublicRecipeResultsComponent` (`pych-public-recipe-results`)
                - lista kart:
                    - `RecipeCardComponent` (`pych-recipe-card`)
                    - etykieta „Dopasowanie: …” **[NOWE lub rozszerzone]**

- **Kreator AI**:
    - `RecipeNewAssistPageComponent`
        - `AiRecipeDraftService` (Edge Function) → `RecipeDraftStateService.setDraft(...)`
        - nawigacja do `/recipes/new`
            - `RecipeFormPageComponent` → wypełnienie pól w tym `tips` na bazie `draft.tips_raw`

## 4. Szczegóły komponentów

### `RecipeDetailViewComponent` (`src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html`)
- **Opis komponentu**: wspólny widok prezentacji szczegółów przepisu dla prywatnego `/recipes/...` i publicznego `/explore/recipes/...`. Renderuje loading/error/sukces oraz wspólne sekcje treści.
- **Zmiana**: dodać sekcję **„Wskazówki”** jako trzeci `pych-recipe-content-list`, umieszczony **po** liście kroków przygotowania.
- **Główne elementy**:
    - istniejące:
        - `pych-recipe-content-list` (Składniki) z `[isNumbered]="false"`
        - `pych-recipe-content-list` (Kroki przygotowania) z `[isNumbered]="true"`
    - nowe:
        - `@if (recipe()!.tips?.length > 0) { <pych-recipe-content-list title="Wskazówki" [content]="recipe()!.tips" [isNumbered]="false" /> }`
- **Obsługiwane interakcje**: brak nowych (sekcja wyłącznie prezentacyjna).
- **Obsługiwana walidacja**:
    - sekcja wskazówek jest renderowana **tylko** gdy `tips.length > 0` (pusta lista → brak sekcji).
    - brak „pustych placeholderów”.
- **Typy**:
    - `RecipeDetailDto.tips: RecipeContent` (z `shared/contracts/types.ts`)
- **Propsy**: bez zmian (komponent używa `recipe()` z własnego stanu; nie wprowadza nowych inputów).

### `ExplorePageComponent` (`src/app/pages/explore/explore-page.component.html`)
- **Opis komponentu**: strona Explore osadzająca publiczną wyszukiwarkę `pych-public-recipes-search`.
- **Zmiana**: doprecyzować copy (placeholder) aby odzwierciedlał, że wyszukiwanie obejmuje także wskazówki.
- **Główne elementy**:
    - `pych-public-recipes-search` z `context="explore"`
    - aktualizacja `[placeholder]` z np. „Szukaj przepisów po nazwie, składnikach, tagach...” na „… tagach i wskazówkach…”.
- **Obsługiwane interakcje**: bez zmian (wpisywanie, Enter, load more).
- **Walidacja**: min. 3 znaki dla wyszukiwania pozostaje w `PublicRecipesFacade` / `PublicRecipesSearchComponent`.
- **Typy**: brak zmian.
- **Propsy**: bez zmian (tylko tekst placeholder).

### `MATCH_SOURCE_LABELS` (`src/app/pages/explore/models/public-recipes-search.model.ts`)
- **Opis**: słownik mapujący `search.match` z API na etykietę UI (np. `name` → „nazwa”).
- **Zmiana**:
    - rozszerzyć mapowanie o `tips: 'wskazówki'`,
    - dopasować typ słownika tak, aby uwzględniał `SearchMatchSource` z kontraktu (`'name' | 'ingredients' | 'tags' | 'tips'`).
- **Walidacja**:
    - jeśli backend zwróci `match` spoza znanego zbioru (nie powinno się zdarzyć), UI nie powinien crashować – zastosować bezpieczny fallback (np. brak etykiety).
- **Typy**:
    - `SearchMatchSource` (z `shared/contracts/types.ts`)

### `PublicRecipeResultsComponent` (`src/app/pages/landing/components/public-recipe-results/public-recipe-results.ts` + `.html`)
- **Opis komponentu**: renderuje stany wyników publicznych (skeleton/error/empty/wyniki) oraz listę kart.
- **Zmiana**: dodać/rozszerzyć prezentację „transparentności dopasowania”:
    - w trybie `mode === 'search'` i gdy `recipe.search?.match` jest dostępne, renderować krótki tekst: **„Dopasowanie: {etykieta}”**, gdzie `{etykieta}` pochodzi z `MATCH_SOURCE_LABELS`.
- **Rekomendacja implementacyjna** (spójność i minimalna ingerencja):
    - nie rozbudowywać `RecipeCardComponent` o logikę wyszukiwania; zamiast tego dodać mały blok/stopkę obok karty (lub pod nazwą/kategorią w `public-recipe-results.html`).
    - alternatywnie: dodać opcjonalny input do `RecipeCardComponent` (np. `matchLabel?: string | null`) i renderować w obrębie `mat-card-content`. W planie należy wybrać jedną ścieżkę i stosować ją konsekwentnie.
- **Obsługiwane interakcje**: brak nowych (etykieta jest statyczna).
- **Obsługiwana walidacja**:
    - etykieta dopasowania renderowana tylko gdy:
        - `mode === 'search'`, oraz
        - `recipe.search?.match` nie jest `null/undefined`, oraz
        - istnieje mapowanie w `MATCH_SOURCE_LABELS`.
- **Typy**:
    - `PublicRecipeListItemDto.search: RecipeSearchMeta | null`
    - `RecipeSearchMeta.match: SearchMatchSource`
- **Propsy**: bez zmian (komponent już ma `mode`, `items` i potrafi rozróżnić feed vs search).

### `RecipeNewAssistPageComponent` (`src/app/pages/recipes/recipe-new-assist/recipe-new-assist-page.component.ts`)
- **Opis komponentu**: krok kreatora AI, który wywołuje Edge Function `POST /ai/recipes/draft` i przekazuje draft do formularza tworzenia.
- **Zmiana**: zapewnić, że obsługa draftu **nie filtruje** `tips_raw` oraz że stan jest przekazany do formularza bez utraty pola.
    - Technicznie: komponent już zapisuje cały `response.draft` przez `RecipeDraftStateService.setDraft(...)`; w planie należy uwzględnić test/inspekcję, że `tips_raw` jest zachowane i nie ginie w żadnym mapowaniu.
- **Interakcje**:
    - „Dalej”:
        - brak danych → przejście do `/recipes/new` bez draftu,
        - dane → call AI → zapis draftu → przejście do `/recipes/new`.
- **Walidacja**:
    - tryb „text” vs „image” (albo-albo),
    - walidacja obrazu: mime (`image/png|jpeg|webp`) i rozmiar max 10MB,
    - obsługa 422 (nie jest pojedynczym przepisem) → pokazanie błędu i pozostanie na ekranie.
- **Typy**:
    - `AiRecipeDraftRequestDto`, `AiRecipeDraftDto` (z `shared/contracts/types.ts`)
- **Propsy**: brak.

### `RecipeFormPageComponent` (`src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`)
- **Opis komponentu**: formularz tworzenia/edycji przepisu. W create-mode potrafi zapełnić się draftem z `RecipeDraftStateService`.
- **Zmiana**: potwierdzić, że implementacja wypełniania listy tips działa dla draftu i jest zgodna z kontraktem:
    - `draft.tips_raw` → split po `\n` → trim → filter(puste) → `FormArray tips`.
    - przy zapisie: `tips_raw` jest opcjonalne (`undefined`, gdy brak wskazówek).
- **Walidacja**:
    - wskazówki są opcjonalne (brak walidacji minimalnej długości),
    - tworzenie `tips_raw` tylko gdy `tips.length > 0`.
- **Typy**:
    - `AiRecipeDraftDto.tips_raw?: string`
    - `CreateRecipeCommand.tips_raw?: string`
- **Propsy**: brak zmian.

## 5. Typy
Wdrożenie nie wymaga dodawania nowych DTO – korzystamy z istniejących kontraktów:

- **Szczegóły przepisu**:
    - `RecipeDetailDto`
        - `tips: RecipeContent` (lista elementów `{type:'header'|'item', content:string}`)

- **Explore (lista publiczna)**:
    - `PublicRecipeListItemDto`
        - `search: RecipeSearchMeta | null`
    - `RecipeSearchMeta`
        - `match: SearchMatchSource` (`'name' | 'ingredients' | 'tags' | 'tips'`)

- **AI draft**:
    - `AiRecipeDraftDto`
        - `tips_raw?: string`

Dodatkowo należy zaktualizować typ mapowania UI:

- `MATCH_SOURCE_LABELS` powinien mapować **pełny** zbiór `SearchMatchSource` (włącznie z `'tips'` → „wskazówki”).

## 6. Zarządzanie stanem
Zmiana nie wymaga nowego globalnego stanu:

- **Szczegóły przepisu**:
    - stan już istnieje w `RecipeDetailPageComponent` i `ExploreRecipeDetailPageComponent` (signals: `recipe`, `isLoading`, `error`).
    - UI w `RecipeDetailViewComponent` reaguje wyłącznie na `recipe().tips.length`.

- **Explore**:
    - `PublicRecipesFacade` (signals) już zarządza `mode`, `items`, `pageInfo`, błędami i loadingiem.
    - etykieta dopasowania jest wyliczana per element listy na bazie `recipe.search?.match` (bez dodatkowych zapytań).

- **AI assist**:
    - `RecipeDraftStateService` przechowuje draft (TTL 10 min); `RecipeFormPageComponent` konsumuje draft jednorazowo.

## 7. Integracja API
Frontend nie dodaje nowych endpointów, tylko wykorzystuje istniejące:

- **Szczegóły przepisu (prywatne)**:
    - `GET /recipes/{id}` → `RecipeDetailDto` (z `tips`)
    - serwis: `RecipesService` (wywołania przez `SupabaseService.functions.invoke(...)`)

- **Szczegóły przepisu (Explore)**:
    - `GET /explore/recipes/{id}` (Edge Function) → `RecipeDetailDto` (z `tips`)
    - serwis: `ExploreRecipesService`

- **Explore lista / wyszukiwanie publiczne**:
    - `GET /public/recipes/feed`
        - parametry: `q` (min 3 znaki) przeszukuje m.in. `tips`
        - backend zwraca `search.match` i `search.relevance_score` dla trybu wyszukiwania
    - serwis: `PublicRecipesService` + `PublicRecipesFacade`

- **AI draft**:
    - `POST /ai/recipes/draft`
        - odpowiedź: `AiRecipeDraftResponseDto` może zawierać `draft.tips_raw`
    - serwis: `AiRecipeDraftService`

Ograniczenia komunikacji:

- frontend **nie może** wykonywać `supabase.from(...)` / bezpośrednich zapytań do tabel – wszystkie operacje przez Edge Functions lub dozwolone API.

## 8. Interakcje użytkownika
- **Szczegóły przepisu**:
    - brak nowych akcji; użytkownik widzi dodatkową sekcję „Wskazówki” tylko jeśli istnieją.

- **Explore**:
    - użytkownik wpisuje frazę:
        - 1–2 znaki: brak zapytania, widoczny hint „Wpisz min. 3 znaki…”
        - ≥3 znaki: lista wyników w trybie `search` i przy każdym wyniku pokazuje się „Dopasowanie: …” (w tym „wskazówki”).
    - użytkownik doładowuje kolejne wyniki przyciskiem „Więcej”.

- **Kreator AI**:
    - użytkownik wkleja tekst/obraz → „Dalej” → formularz tworzenia przepisu z prefill.
    - jeśli AI zwróci `tips_raw`, użytkownik widzi już uzupełnioną listę wskazówek w formularzu i może ją edytować przed zapisem.

## 9. Warunki i walidacja
- **Sekcja wskazówek w szczegółach**:
    - renderować tylko gdy `tips.length > 0`.

- **Etykieta dopasowania w Explore**:
    - renderować tylko w `mode === 'search'`.
    - renderować tylko gdy `recipe.search?.match` jest dostępne.
    - mapować `match` → etykieta:
        - `name` → „nazwa”
        - `ingredients` → „składniki”
        - `tags` → „tagi”
        - `tips` → „wskazówki”

- **AI draft**:
    - `tips_raw` jest opcjonalne:
        - brak pola / pusty string → `tips` w formularzu pozostaje puste.
        - string z treścią → split na linie → FormArray.

## 10. Obsługa błędów
- **Szczegóły przepisu**:
    - brak nowych błędów; sekcja wskazówek jest pomijana przy pustej liście.

- **Explore**:
    - jeśli `search` jest `null` lub `match` nie ma mapowania → nie pokazywać etykiety dopasowania (bez crasha).

- **AI assist**:
    - 422 (nie jest pojedynczym przepisem): pokazać `errorMessage` + `unprocessableReasons`, pozostać na stronie.
    - 401/429/inne: pokazać czytelny komunikat i umożliwić ponowienie.

## 11. Kroki implementacji
1. **Szczegóły przepisu (UI)**: w `src/app/shared/components/recipe-detail-view/recipe-detail-view.component.html` dodać warunkową sekcję `pych-recipe-content-list` dla `tips` pod krokami.
2. **Explore copy**: w `src/app/pages/explore/explore-page.component.html` zaktualizować placeholder wyszukiwarki tak, aby wymieniał również „wskazówki”.
3. **Mapowanie etykiet dopasowania**: w `src/app/pages/explore/models/public-recipes-search.model.ts` rozszerzyć `MATCH_SOURCE_LABELS` o `tips: 'wskazówki'` i dopasować typy do kontraktu `SearchMatchSource`.
4. **Transparentność dopasowania w wynikach**: w `src/app/pages/landing/components/public-recipe-results/public-recipe-results.html` (i ewentualnie `.ts`) dodać renderowanie tekstu „Dopasowanie: …” w trybie `search` (dla `recipe.search?.match`), używając `MATCH_SOURCE_LABELS`.
5. **Kreator AI**: zweryfikować przepływ `RecipeNewAssistPageComponent` → `RecipeDraftStateService` → `RecipeFormPageComponent` pod kątem zachowania `tips_raw` (bez dodatkowego mapowania po drodze).
6. **Formularz tworzenia**: potwierdzić (i w razie potrzeby doprecyzować) że `RecipeFormPageComponent.populateFormFromDraft(...)` wypełnia `tips` na bazie `draft.tips_raw`, a `mapFormToCommand(...)` wysyła `tips_raw` tylko gdy lista nie jest pusta.
7. **Manualny test UX**:
    - recipe details: przepis z pustymi `tips` → brak sekcji; z niepustymi → sekcja widoczna pod krokami,
    - explore: wyszukiwanie frazą ≥ 3 znaki → dla wyników z `search.match='tips'` widnieje „Dopasowanie: wskazówki”,
    - AI assist: draft z `tips_raw` → formularz `/recipes/new` ma wypełnione wskazówki.

