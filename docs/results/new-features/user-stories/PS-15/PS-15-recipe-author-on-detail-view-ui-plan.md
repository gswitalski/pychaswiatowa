# PS-15 — UI Implementation Plan: Recipe Author on Detail View

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11  
**Runda:** R1

---

## Przegląd

Jedyna zmiana w UI dotyczy `RecipeHeaderComponent`, który jest współdzielony przez obie trasy:

| Trasa | Komponent strony | RecipeHeaderComponent |
|---|---|---|
| `/recipes/:id-:slug` | `RecipeDetailPageComponent` | ✅ używa |
| `/explore/recipes/:id-:slug` | `ExploreRecipeDetailPageComponent` | ✅ używa (via `RecipeDetailViewComponent`) |

Po dodaniu `author: ProfileDto` do `RecipeDetailDto` (F1) i `PublicRecipeDetailDto`  
(już posiada) — oba typy akceptowane przez `input` komponentu mają pole `author`.  
**Brak potrzeby type-guardów ani zmian w komponentach stron.**

---

## 1. `recipe-header.component.ts`

### 1.1 Nowy computed signal `authorLabel`

Dodać po sygnale `shouldShowDifficulty` (linia ~159):

```typescript
/**
 * Computed signal generujący etykietę autora.
 * Zwraca sformatowany string 'Autor: {username}' lub null jeśli brak autora.
 * Obsługuje oba typy przepisu (RecipeDetailDto i PublicRecipeDetailDto).
 */
readonly authorLabel = computed(() => {
    const author = this.recipe().author;
    if (!author?.username) return null;
    return `Autor: ${author.username}`;
});
```

### 1.2 Kompletny stan komponentu po zmianie

```typescript
// Istniejące sygnały — bez zmian:
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

### 1.3 Import

Brak nowych importów — `computed` jest już importowany z `'@angular/core'`.

---

## 2. `recipe-header.component.html`

### 2.1 Miejsce wstawienia

Sekcja autora wstawiany jest **po sekcji porcji** (`@if (servingsLabel())`) i  
**przed opisem** (`@if (recipe().description)`).

### 2.2 Zmiana szablonu

```html
<!-- PRZED (fragment ~linia 3-10): -->
<h1 class="recipe-title">{{ recipe().name }}</h1>
<ng-content select="[recipeRating]" />

@if (servingsLabel()) {
    <p class="recipe-servings">{{ servingsLabel() }}</p>
}

@if (recipe().description) {
    <p class="recipe-description">{{ recipe().description }}</p>
}

<!-- PO — dodać sekcję autora między porcjami a opisem: -->
<h1 class="recipe-title">{{ recipe().name }}</h1>
<ng-content select="[recipeRating]" />

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

### 2.3 Style (opcjonalne)

W `recipe-header.component.scss` można dodać:

```scss
.recipe-author {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--mat-sys-on-surface-variant);
    font-size: 0.875rem;

    mat-icon {
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
    }
}
```

Styl jest opcjonalny — jeśli brak, komponent wyrenderuje się bez dedykowanego stylu.

---

## 3. Testy Vitest Angular

### 3.1 Plik

`src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.spec.ts`  
*(nowy plik lub istniejący — sprawdzić przed implementacją)*

### 3.2 Setup

```typescript
import 'zone.js';
import 'zone.js/testing';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { render, screen } from '@testing-library/angular';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RecipeHeaderComponent } from './recipe-header.component';
import type { RecipeDetailDto, PublicRecipeDetailDto } from '../../../../../../../shared/contracts/types';

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
        author: { id: 'user-abc', username: 'jan.kowalski' },  // NOWE pole
        ...overrides,
    };
}

beforeAll(() => {
    TestBed.resetTestEnvironment();
    TestBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
});

async function setupHeader(recipe: RecipeDetailDto | PublicRecipeDetailDto, isPublic = false) {
    return render(RecipeHeaderComponent, {
        imports: [NoopAnimationsModule],
        componentInputs: { recipe, isPublic },
    });
}
```

### 3.3 Przypadki testowe

| Test | Scenariusz GWT | AC |
|---|---|---|
| Wyświetla `Autor: jan.kowalski` gdy author.username ustawiony | G5 | AC4, AC5 |
| Wyświetla ikonkę `person` z aria-label | G5 | AC4, AC5 |
| Nie renderuje sekcji autora gdy author.username jest null | G6 | — |
| Nie renderuje sekcji autora gdy author jest null/undefined | G6 | — |
| Brak elementu `<a>` w `.recipe-author` | G5 | AC7 |
| Wyświetla autora dla RecipeDetailDto (kontekst prywatny) | G5 | AC5, AC6 |
| Wyświetla autora dla PublicRecipeDetailDto (kontekst publiczny) | G5 | AC4, AC6 |

### 3.4 Przykłady testów

```typescript
describe('RecipeHeaderComponent — author', () => {

    it('wyświetla sekcję autora gdy author.username jest ustawiony (AC4, AC5)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        expect(screen.getByText('Autor: jan.kowalski')).toBeTruthy();
    });

    it('wyświetla ikonkę person z aria-label (AC4)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        const icon = document.querySelector('mat-icon[aria-label="Autor"]');
        expect(icon).toBeTruthy();
    });

    it('nie renderuje sekcji autora gdy author.username jest null (G6)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: null as any } });
        await setupHeader(recipe);

        expect(screen.queryByText(/Autor:/)).toBeNull();
        expect(document.querySelector('.recipe-author')).toBeNull();
    });

    it('username nie jest linkiem (AC7)', async () => {
        const recipe = makeRecipe({ author: { id: 'user-abc', username: 'jan.kowalski' } });
        await setupHeader(recipe);

        const authorSection = document.querySelector('.recipe-author');
        expect(authorSection).toBeTruthy();
        expect(authorSection?.querySelector('a')).toBeNull();
    });

    it('wyświetla autora dla PublicRecipeDetailDto w trybie publicznym (AC4, AC6)', async () => {
        // PublicRecipeDetailDto ma author: ProfileDto
        const publicRecipe = {
            id: 2,
            name: 'Publiczny Przepis',
            description: null,
            image_path: null,
            visibility: 'PUBLIC' as const,
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
        } as PublicRecipeDetailDto;

        await setupHeader(publicRecipe, true);
        expect(screen.getByText('Autor: anna.nowak')).toBeTruthy();
    });

    it('wyświetla autora dla własnego przepisu (AC6)', async () => {
        const ownRecipe = makeRecipe({ author: { id: 'user-abc', username: 'ja.sam' } });
        await setupHeader(ownRecipe);

        expect(screen.getByText('Autor: ja.sam')).toBeTruthy();
    });

    it('wyświetla autora dla cudzego PUBLIC przepisu (AC6)', async () => {
        const foreignRecipe = makeRecipe({
            visibility: 'PUBLIC',
            author: { id: 'user-other', username: 'ktos.inny' },
        });
        await setupHeader(foreignRecipe);

        expect(screen.getByText('Autor: ktos.inny')).toBeTruthy();
    });
});
```

---

## 4. Macierz pokrycia AC (UI)

| AC | Opis | Plik | Test |
|---|---|---|---|
| AC4 | Explore wyświetla `Autor: {username}` z ikoną `person` | `recipe-header.component.spec.ts` | "wyświetla sekcję autora" + "wyświetla ikonkę person" |
| AC5 | Recipes wyświetla `Autor: {username}` z ikoną `person` | `recipe-header.component.spec.ts` | "wyświetla autora dla RecipeDetailDto" |
| AC6 | Autor widoczny dla własnego i cudzego przepisu | `recipe-header.component.spec.ts` | "wyświetla autora dla własnego..." + "cudzego..." |
| AC7 | Username nie jest linkiem | `recipe-header.component.spec.ts` | "username nie jest linkiem" |
| AC8 | TypeScript kompiluje się bez błędów | CI build | `ng build` / `tsc --noEmit` |

---

## 5. Brak zmian w komponentach stron

Po dodaniu `author` do `RecipeDetailDto` (F1) — zmiana jest addytywna:

- `RecipeDetailPageComponent` (`/recipes`) — brak zmian, przekazuje `recipe` do `RecipeHeaderComponent`
- `ExploreRecipeDetailPageComponent` (`/explore/recipes`) — brak zmian
- `ExploreRecipesService` — brak zmian (kontrakt propaguje się przez TypeScript)
- `RecipesService` — brak zmian (kontrakt propaguje się przez TypeScript)

---

## 6. Macierz spójności historyjka ↔ UI

| Wymaganie | AC | Plik | Sygnał/Element | Status |
|---|---|---|---|---|
| F4: sekcja autora po porcjach, przed opisem | AC4, AC5 | `recipe-header.component.html` | `@if (authorLabel())` w odpowiednim miejscu | ✅ zaplanowane |
| F4: ikonka `person` z aria-label | AC4, AC5 | `recipe-header.component.html` | `<mat-icon aria-label="Autor">person</mat-icon>` | ✅ zaplanowane |
| F4: tekst `Autor: {username}` | AC4, AC5, AC6 | `recipe-header.component.ts` | `authorLabel` computed | ✅ zaplanowane |
| F4: brak linku | AC7 | `recipe-header.component.html` | brak `<a>` w `.recipe-author` | ✅ zaplanowane |
| NF4: username tylko tekst | AC7 | `recipe-header.component.html` | `<span>{{ authorLabel() }}</span>` | ✅ zaplanowane |
| Brak type-guardów (oba typy mają author) | AC4, AC5 | `recipe-header.component.ts` | `this.recipe().author` bezpośrednio | ✅ zaplanowane |
