# Plan implementacji widoku — Autor przepisu na widoku szczegółów (PS-15)

**Slug:** `recipe-author-on-detail-view`
**Data:** 2026-11-11
**Runda:** R1

---

## 1. Przegląd

Nie powstaje nowy ekran ani nowy komponent. Historyjka PS-15 rozszerza istniejący
`RecipeHeaderComponent` o wyświetlanie autora przepisu. Zmiany są minimalne:

- **1 computed signal** `authorLabel` w pliku `.ts`,
- **1 blok `@if`** z `div.recipe-author` w pliku `.html`,
- **opcjonalny styl** `.recipe-author` w pliku `.scss`,
- **nowy plik spec** z testami Vitest (7 przypadków).

Komponent `RecipeHeaderComponent` jest współdzielony przez obie trasy:

| Trasa | Komponent strony | Używa RecipeHeaderComponent |
|---|---|---|
| `/recipes/:id-:slug` | `RecipeDetailPageComponent` | ✅ pośrednio przez `RecipeDetailViewComponent` |
| `/explore/recipes/:id-:slug` | `ExploreRecipeDetailPageComponent` | ✅ pośrednio przez `RecipeDetailViewComponent` |

Po zakończeniu implementacji API (PS-15 API) pole `author: ProfileDto` będzie obecne
w obu typach akceptowanych przez `input` komponentu: `RecipeDetailDto`
i `PublicRecipeDetailDto`. Brak konieczności type-guardów.

---

## 2. Routing widoku

Bez zmian. Nie dodajemy nowych tras, guardów ani resolverów.

---

## 3. Struktura plików do zmiany

```
[MODYFIKACJA]  RecipeHeaderComponent
    src/app/pages/recipes/recipe-detail/components/recipe-header/
        recipe-header.component.ts      ← dodać computed signal authorLabel
        recipe-header.component.html    ← dodać blok @if (authorLabel())
        recipe-header.component.scss    ← dodać .recipe-author (opcjonalne)

[NOWY]
    src/app/pages/recipes/recipe-detail/components/recipe-header/
        recipe-header.component.spec.ts ← 7 przypadków testowych Vitest
```

Brak zmian w:
- `RecipeDetailViewComponent` — przekazuje `recipe` bez zmian
- `RecipeDetailPageComponent` — brak zmian
- `ExploreRecipeDetailPageComponent` — brak zmian
- serwisach Angular (`RecipesService`, `ExploreRecipesService`) — zmiany propagują się
  addytywnie przez TypeScript po zmianie kontraktu (PS-15 API)

---

## 4. Szczegóły implementacji

### 4.1 `recipe-header.component.ts`

**Zależność:** Wymaga zakończenia PS-15 API (F1 — `author: ProfileDto` w `RecipeDetailDto`
z `shared/contracts/types.ts`). Bez tej zmiany TypeScript zgłosi błąd kompilacji.

#### Dodać computed signal `authorLabel` — po sygnale `shouldShowDifficulty` (linia ~160):

```typescript
/**
 * Computed signal generujący etykietę autora przepisu.
 * Zwraca sformatowany string 'Autor: {username}' lub null jeśli brak autora.
 * Obsługuje oba typy przepisu (RecipeDetailDto i PublicRecipeDetailDto).
 * Brak null → sekcja autora nie jest renderowana (G6).
 */
readonly authorLabel = computed(() => {
    const author = this.recipe().author;
    if (!author?.username) return null;
    return `Autor: ${author.username}`;
});
```

**Uwagi:**
- `computed` jest już importowany z `'@angular/core'` — brak nowych importów.
- Brak potrzeby type-guardów — po PS-15 API oba typy mają `author: ProfileDto`.
- Obsługuje edge case: `author` null/undefined lub `username` null (G6, NF1).

#### Stan komponentu po zmianie (sygnały):

```typescript
// Istniejące — bez zmian:
readonly servingsLabel = computed(() => { /* ... */ });
readonly shouldShowPrepTime = computed(() => { /* ... */ });
readonly shouldShowTotalTime = computed(() => { /* ... */ });
readonly shouldShowDietType = computed(() => { /* ... */ });
readonly shouldShowCuisine = computed(() => { /* ... */ });
readonly shouldShowDifficulty = computed(() => { /* ... */ });

// NOWE:
readonly authorLabel = computed(() => {
    const author = this.recipe().author;
    if (!author?.username) return null;
    return `Autor: ${author.username}`;
});
```

---

### 4.2 `recipe-header.component.html`

#### Miejsce wstawienia

Sekcja autora wstawiana jest **po sekcji porcji** (`@if (servingsLabel())`)
i **przed sekcją opisu** (`@if (recipe().description)`), zgodnie z F4.

Aktualny szablon (linie 4–10):

```html
@if (servingsLabel()) {
    <p class="recipe-servings">{{ servingsLabel() }}</p>
}

@if (recipe().description) {
    <p class="recipe-description">{{ recipe().description }}</p>
}
```

#### Po zmianie — wstawić blok `@if (authorLabel())` między nimi:

```html
@if (servingsLabel()) {
    <p class="recipe-servings">{{ servingsLabel() }}</p>
}

@if (authorLabel()) {
    <div class="recipe-author">
        <mat-icon aria-label="Autor">person</mat-icon>
        <span>{{ authorLabel() }}</span>
    </div>
}

@if (recipe().description) {
    <p class="recipe-description">{{ recipe().description }}</p>
}
```

**Uwagi:**
- `MatIconModule` jest już importowany w komponencie — brak nowych importów.
- Brak elementu `<a>` — username jest wyłącznie tekstem (NF4, AC7).
- `aria-label="Autor"` zapewnia dostępność (a11y).

---

### 4.3 `recipe-header.component.scss`

Dodać styl `.recipe-author` spójny z istniejącymi klasami `.recipe-times`
i `.recipe-classification`:

```scss
.recipe-author {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 16px;

    mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
        color: var(--mat-sys-secondary);
    }
}
```

**Uwagi:**
- Używamy zmiennych Material (`--mat-sys-on-surface-variant`, `--mat-sys-secondary`)
  zgodnie z regułą ANGULAR_MATERIAL (brak custom kolorów).
- `margin-bottom: 16px` spójne z `.recipe-servings`.
- Rozmiar ikony 20px spójny z `.recipe-times` i `.recipe-classification`.

---

## 5. Testy Vitest Angular

### 5.1 Plik

```
src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.spec.ts
```

*(nowy plik — nie istnieje w projekcie)*

### 5.2 Setup

```typescript
import 'zone.js';
import 'zone.js/testing';
import { describe, it, expect, beforeAll } from 'vitest';
import { TestBed } from '@angular/core/testing';
import {
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { render, screen } from '@testing-library/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RecipeHeaderComponent } from './recipe-header.component';
import type {
    RecipeDetailDto,
    PublicRecipeDetailDto,
} from '../../../../../../../shared/contracts/types';

// Helper factory — minimalne RecipeDetailDto z autorem
function makeRecipe(overrides: Partial<RecipeDetailDto> = {}): RecipeDetailDto {
    return {
        id: 1,
        user_id: 'user-abc',
        name: 'Testowy Przepis',
        description: null,
        image_path: null,
        visibility: 'PRIVATE',
        category_id: null,
        category_name: null,
        ingredients: [],
        steps: [],
        tips: [],
        tags: [],
        servings: null,
        is_termorobot: false,
        prep_time_minutes: null,
        total_time_minutes: null,
        diet_type: null,
        cuisine: null,
        difficulty: null,
        is_grill: false,
        in_my_plan: false,
        collection_ids: [],
        normalized_ingredients_status: 'PENDING',
        normalized_ingredients_updated_at: null,
        average_rating: null,
        ratings_count: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        author: { id: 'user-abc', username: 'jan.kowalski' }, // wymagane po PS-15 API
        ...overrides,
    };
}

beforeAll(() => {
    TestBed.resetTestEnvironment();
    TestBed.initTestEnvironment(
        BrowserDynamicTestingModule,
        platformBrowserDynamicTesting(),
    );
});

async function setupHeader(
    recipe: RecipeDetailDto | PublicRecipeDetailDto,
    isPublic = false,
) {
    return render(RecipeHeaderComponent, {
        imports: [NoopAnimationsModule],
        componentInputs: { recipe, isPublic },
    });
}
```

### 5.3 Przypadki testowe

| # | Test | GWT | AC |
|---|---|---|---|
| T1 | Wyświetla `Autor: jan.kowalski` gdy `author.username` ustawiony | G5 | AC4, AC5 |
| T2 | Wyświetla ikonkę `mat-icon` z `aria-label="Autor"` | G5 | AC4, AC5 |
| T3 | Nie renderuje sekcji gdy `author.username` jest null | G6 | — |
| T4 | Nie renderuje sekcji gdy `author` jest null/undefined | G6 | — |
| T5 | Brak elementu `<a>` w `.recipe-author` (username nie jest linkiem) | G5 | AC7 |
| T6 | Wyświetla autora dla własnego przepisu (RecipeDetailDto) | G5 | AC5, AC6 |
| T7 | Wyświetla autora dla cudzego PUBLIC przepisu (PublicRecipeDetailDto) | G5 | AC4, AC6 |

### 5.4 Pełna treść testów

```typescript
describe('RecipeHeaderComponent — sekcja autora', () => {

    it('T1: wyświetla "Autor: jan.kowalski" gdy author.username jest ustawiony (AC4, AC5)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        expect(screen.getByText('Autor: jan.kowalski')).toBeTruthy();
    });

    it('T2: wyświetla ikonkę mat-icon z aria-label="Autor" (AC4)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        const icon = document.querySelector('mat-icon[aria-label="Autor"]');
        expect(icon).toBeTruthy();
    });

    it('T3: nie renderuje sekcji autora gdy author.username jest null (G6)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: null as any } });
        await setupHeader(recipe);

        expect(screen.queryByText(/Autor:/)).toBeNull();
        expect(document.querySelector('.recipe-author')).toBeNull();
    });

    it('T4: nie renderuje sekcji autora gdy author jest null (G6)', async () => {
        const recipe = makeRecipe({ author: null as any });
        await setupHeader(recipe);

        expect(screen.queryByText(/Autor:/)).toBeNull();
        expect(document.querySelector('.recipe-author')).toBeNull();
    });

    it('T5: username nie jest linkiem — brak <a> w .recipe-author (AC7)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        const authorSection = document.querySelector('.recipe-author');
        expect(authorSection).toBeTruthy();
        expect(authorSection?.querySelector('a')).toBeNull();
    });

    it('T6: wyświetla autora dla własnego przepisu — RecipeDetailDto (AC5, AC6)', async () => {
        const ownRecipe = makeRecipe({
            visibility: 'PRIVATE',
            author: { id: 'user-abc', username: 'jan.kowalski' },
        });
        await setupHeader(ownRecipe);

        expect(screen.getByText('Autor: jan.kowalski')).toBeTruthy();
    });

    it('T7: wyświetla autora dla cudzego PUBLIC przepisu — PublicRecipeDetailDto (AC4, AC6)', async () => {
        const publicRecipe: PublicRecipeDetailDto = {
            id: 2,
            name: 'Publiczny Przepis',
            description: null,
            image_path: null,
            visibility: 'PUBLIC',
            category: null,
            ingredients: [],
            steps: [],
            tips: [],
            tags: [],
            author: { id: 'user-xyz', username: 'anna.nowak' },
            created_at: '2026-01-01T00:00:00Z',
            is_owner: false,
            in_my_plan: false,
            collection_ids: [],
            servings: null,
            is_termorobot: false,
            prep_time_minutes: null,
            total_time_minutes: null,
            diet_type: null,
            cuisine: null,
            difficulty: null,
            is_grill: false,
            average_rating: null,
            ratings_count: 0,
        };
        await setupHeader(publicRecipe, true);

        expect(screen.getByText('Autor: anna.nowak')).toBeTruthy();
    });
});
```

---

## 6. Kolejność implementacji (kroki)

| # | Krok | Plik | Blokada |
|---|---|---|---|
| 1 | Czekaj na akceptację PS-15 API (F1: `author` w `RecipeDetailDto`) | `shared/contracts/types.ts` | PS-15 API |
| 2 | Dodać computed signal `authorLabel` | `recipe-header.component.ts` | — |
| 3 | Dodać blok `@if (authorLabel())` w szablonie | `recipe-header.component.html` | krok 2 |
| 4 | Dodać styl `.recipe-author` | `recipe-header.component.scss` | — |
| 5 | Napisać plik spec z 7 testami | `recipe-header.component.spec.ts` | krok 2–3 |
| 6 | Uruchomić testy: `npx vitest run recipe-header` | — | krok 5 |
| 7 | Uruchomić build TS: `ng build` lub `tsc --noEmit` | — | krok 1–3 |

---

## 7. Macierz pokrycia AC (widoki)

| AC | Opis | Plik | Test / Weryfikacja |
|---|---|---|---|
| AC4 | Explore: wyświetla `Autor: {username}` z ikoną `person` | `recipe-header.component.spec.ts` | T1, T2, T7 |
| AC5 | Recipes: wyświetla `Autor: {username}` z ikoną `person` | `recipe-header.component.spec.ts` | T1, T2, T6 |
| AC6 | Autor widoczny dla własnego i cudzego przepisu | `recipe-header.component.spec.ts` | T6, T7 |
| AC7 | Username nie jest linkiem | `recipe-header.component.spec.ts` | T5 |
| AC8 | TypeScript kompiluje się bez błędów | CI build | `ng build` / `tsc --noEmit` |

---

## 8. Macierz spójności historyjka ↔ widok

| Wymaganie | AC | Element | Status |
|---|---|---|---|
| F4: sekcja autora po porcjach, przed opisem | AC4, AC5 | `@if (authorLabel())` w odpowiednim miejscu szablonu | ✅ zaplanowane |
| F4: ikonka `person` z `aria-label="Autor"` | AC4, AC5 | `<mat-icon aria-label="Autor">person</mat-icon>` | ✅ zaplanowane |
| F4: tekst `Autor: {username}` | AC4, AC5, AC6 | computed `authorLabel` | ✅ zaplanowane |
| F4: brak linku | AC7 | `<span>{{ authorLabel() }}</span>` (brak `<a>`) | ✅ zaplanowane |
| NF4: username tylko tekst | AC7 | brak `routerLink` ani `href` | ✅ zaplanowane |
| Brak type-guardów | — | `this.recipe().author` bezpośrednio (po F1 API) | ✅ zaplanowane |
| Brak zmian w stronach | — | `RecipeDetailPageComponent`, `ExploreRecipeDetailPageComponent` | ✅ potwierdzone |

---

## 9. Brak zmian w komponentach stron

Po dodaniu `author` do `RecipeDetailDto` (PS-15 API / F1) zmiana jest addytywna:

- `RecipeDetailPageComponent` (`/recipes`) — przekazuje `recipe` do `RecipeDetailViewComponent`, brak zmian.
- `ExploreRecipeDetailPageComponent` (`/explore/recipes`) — przekazuje `recipe` do `RecipeDetailViewComponent`, brak zmian.
- `RecipeDetailViewComponent` — przekazuje `recipe` do `RecipeHeaderComponent`, brak zmian.
- `ExploreRecipesService` (Angular) — brak zmian, kontrakt propaguje się przez TypeScript.
- `RecipesService` (Angular) — brak zmian, kontrakt propaguje się przez TypeScript.

---

## 10. Zależności

| Zależność | Typ | Opis |
|---|---|---|
| PS-15 API — F1 | **blokująca** | `author: ProfileDto` musi być w `RecipeDetailDto` przed implementacją widoku; bez tego TypeScript zwróci błąd kompilacji |
| PS-15 API — F2, F3 | informacyjna | Backend musi zwracać `author` w odpowiedziach obu endpointów (wymagane dla AC4, AC5 w weryfikacji manualnej) |

---

## 11. Weryfikacja

Weryfikacja po implementacji:

```bash
# Testy jednostkowe Angular (Vitest):
npx vitest run recipe-header.component.spec

# Sprawdzenie TypeScript:
npx tsc --noEmit

# Opcjonalnie — build produkcyjny:
ng build
```

**Statusy:**
- Testy: `WYMAGA_WERYFIKACJI` (do uruchomienia po implementacji)
- Build TS: `WYMAGA_WERYFIKACJI` (zależy od zakończenia PS-15 API)
