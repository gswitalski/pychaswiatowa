# Implementacja widoku "Moje przepisy" z filtrowaniem

Data: 2025-12-14

## Podsumowanie zmian

Zaimplementowano widok "Moje przepisy" zgodnie z planem implementacji. Widok wyświetla:
- Wszystkie przepisy zalogowanego użytkownika (niezależnie od widoczności)
- Publiczne przepisy innych autorów dodane do kolekcji użytkownika
- Chip "W moich kolekcjach" na kartach cudzych przepisów
- Ukrycie przycisków "Edytuj" i "Usuń" dla nie-właścicieli w szczegółach przepisu

## Zrealizowane zmiany

### 1. Routing (app.routes.ts)
✅ Zmieniono główną ścieżkę z `/my-recipes` na `/my-recipies`
✅ Dodano redirect `/my-recipes` → `/my-recipies`
✅ Dodano redirect `/recipes` → `/my-recipies`

**Pliki:**
- `src/app/app.routes.ts`

### 2. Sidebar (sidebar.component.ts)
✅ Zaktualizowano link "Przepisy" na `/my-recipies`

**Pliki:**
- `src/app/layout/main-layout/components/sidebar/sidebar.component.ts`

### 3. API Service (recipes.service.ts)
✅ Rozszerzono interfejs `GetRecipesParams` o parametr `view?: 'my_recipes'`
✅ Dodano wysyłanie parametru `view` jako query parameter do API

**Pliki:**
- `src/app/pages/recipes/services/recipes.service.ts`

### 4. Komponent karty przepisu (recipe-card)
✅ Dodano input `inMyCollections: boolean`
✅ Dodano chip "W moich kolekcjach" z warunkiem: `inMyCollections() && !isOwnRecipe()`
✅ Dodano import `MatChipsModule`
✅ Dodano style dla chipu w kolorze secondary-container

**Pliki:**
- `src/app/shared/components/recipe-card/recipe-card.ts`
- `src/app/shared/components/recipe-card/recipe-card.html`
- `src/app/shared/components/recipe-card/recipe-card.scss`

### 5. Lista przepisów (recipe-list.component)
✅ Zaktualizowano template aby przekazywać `is_owner` i `in_my_collections` do kart

**Pliki:**
- `src/app/pages/recipes/recipes-list/components/recipe-list/recipe-list.component.html`

### 6. Strona listy przepisów (recipes-list-page.component)
✅ Dodano parametr `view: 'my_recipes'` do wywołania API

**Pliki:**
- `src/app/pages/recipes/recipes-list/recipes-list-page.component.ts`

### 7. Szczegóły przepisu (recipe-detail-page.component)
✅ Dodano warunkowe renderowanie `@if (isOwner())` dla przycisków "Edytuj" i "Usuń"
✅ Zaktualizowano nawigacje do `/my-recipies`

**Pliki:**
- `src/app/pages/recipes/recipe-detail/recipe-detail-page.component.html`
- `src/app/pages/recipes/recipe-detail/recipe-detail-page.component.ts`

### 8. Pozostałe aktualizacje nawigacji
✅ Zaktualizowano wszystkie odniesienia do `/my-recipes` na `/my-recipies`:
  - `main-layout.component.ts` - tablica PRIVATE_PATHS
  - `explore-recipe-detail-page.component.ts` - nawigacja po usunięciu
  - `recipe-form-page.component.ts` - anulowanie tworzenia przepisu

**Pliki:**
- `src/app/layout/main-layout/main-layout.component.ts`
- `src/app/pages/explore/explore-recipe-detail/explore-recipe-detail-page.component.ts`
- `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`

## Szczegóły implementacji

### Chip "W moich kolekcjach"

Chip jest wyświetlany gdy spełnione są oba warunki:
- `recipe.is_owner === false` - przepis nie należy do zalogowanego użytkownika
- `recipe.in_my_collections === true` - przepis jest w co najmniej jednej kolekcji użytkownika

Stylowanie:
```scss
.in-collections-badge {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;

    mat-chip-set {
        margin: 0;

        mat-chip {
            background-color: var(--mat-sys-secondary-container);
            color: var(--mat-sys-on-secondary-container);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }
    }
}
```

### Ukrywanie akcji w szczegółach

Przyciski "Edytuj" i "Usuń" są renderowane tylko gdy `isOwner() === true`:

```html
@if (isOwner()) {
    <button mat-icon-button (click)="onEdit()">
        <mat-icon>edit</mat-icon>
    </button>
    <button mat-icon-button color="warn" (click)="onDelete()">
        <mat-icon>delete</mat-icon>
    </button>
}
```

Computed signal `isOwner()`:
```typescript
readonly isOwner = computed(() => {
    const recipe = this.recipe();
    const userId = this.currentUserId();
    
    if (!recipe || !userId) return false;
    return recipe.user_id === userId;
});
```

## Zgodność z planem

Implementacja jest w pełni zgodna z planem implementacji:
- ✅ Struktura komponentów
- ✅ Integracja API z parametrem `view=my_recipes`
- ✅ Przekazywanie `is_owner` i `in_my_collections` do kart
- ✅ Chip "W moich kolekcjach" dla cudzych przepisów
- ✅ Ukrywanie akcji dla nie-właścicieli
- ✅ Routing i nawigacja

## Pozostałe kroki

Implementacja jest kompletna. Wymagane testy manualne:
1. Użytkownik z własnymi przepisami - widzi je na liście bez chipu
2. Użytkownik z cudzym przepisem w kolekcji - widzi przepis z chipem
3. Wejście w szczegóły cudzego przepisu - brak przycisków "Edytuj/Usuń"
4. Wejście w szczegóły własnego przepisu - przyciski obecne


