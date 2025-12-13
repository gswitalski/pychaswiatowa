# Plan implementacji widoku: Publiczne szczegóły przepisu (gość + zalogowany)

## 1. Przegląd

Widok **Publiczne szczegóły przepisu** (`/explore/recipes/:id-:slug`) prezentuje pełną treść **wyłącznie** przepisu o widoczności `PUBLIC` (nazwa, opis, zdjęcie, składniki, kroki, kategoria, tagi, autor, data utworzenia). Ten sam URL jest dostępny zarówno dla gościa, jak i użytkownika zalogowanego, ale interfejs różni się zależnie od kontekstu:

- **Gość**: widzi CTA do logowania/rejestracji (z `returnUrl`), brak akcji na przepisie.
- **Zalogowany**:
  - **cudzy przepis**: widzi akcję **„Dodaj do kolekcji”** (modal wyboru/utworzenia kolekcji).
  - **własny przepis**: widzi akcje właściciela **„Edytuj”** i **„Usuń”** (jak w prywatnym widoku szczegółów).

Wymagania UX z PRD/UI:
- układ **desktop-first**: na desktopie składniki i kroki w **2 kolumnach**,
- kroki numerowane **ciągle** (numeracja nie resetuje się po nagłówkach sekcji),
- URL publiczny i udostępnialny (**SEO-friendly**) w formacie `:id-:slug`.

## 2. Routing widoku

- **Ścieżka:** `/explore/recipes/:idslug` (parametr `idslug` ma format `id-slug`)
- **Komponent routowalny:** `PublicRecipeDetailPageComponent`
- **Layout zależny od kontekstu (już przyjęty w projekcie):**
  - gość: `PublicLayoutComponent` (grupa tras z `guestOnlyMatchGuard`),
  - zalogowany: `MainLayoutComponent` (App Shell, grupa tras z `authenticatedMatchGuard`).

Uwagi do routingu/SEO:
- API używa tylko `id` (slug jest informacyjny/SEO).
- rekomendowane jest utrzymanie URL w wersji kanonicznej: po pobraniu `recipe.name` wygenerować slug i w razie różnicy wykonać `router.navigate([...], { replaceUrl: true })`.

## 3. Struktura komponentów

Cel: maksymalna reużywalność komponentów z prywatnego widoku szczegółów przepisu.

Proponowane drzewo komponentów:

```
(MainLayoutComponent | PublicLayoutComponent)
 └─ RouterOutlet
     └─ PublicRecipeDetailPageComponent
         ├─ PageHeaderComponent
         │   ├─ (gość) CTA Login/Register
         │   └─ (zalogowany) akcje: AddToCollection lub Edit/Delete
         ├─ RecipeHeaderComponent (reuse; obsługa publicznego kontekstu)
         ├─ RecipeImageComponent (reuse)
         ├─ RecipeContentListComponent (reuse)   [Składniki]
         ├─ RecipeContentListComponent (reuse)   [Kroki – numerowane]
         └─ (gość) dolne CTA w treści (opcjonalnie, jako zachęta)
```

Lokalizacja plików (już istnieją):
- `src/app/pages/explore/public-recipe-detail/public-recipe-detail-page.component.{ts,html,scss}`

Reużywane komponenty/serwisy:
- `src/app/core/services/public-recipes.service.ts`
- `src/app/pages/recipes/recipe-detail/components/recipe-header/*`
- `src/app/pages/recipes/recipe-detail/components/recipe-image/*`
- `src/app/pages/recipes/recipe-detail/components/recipe-content-list/*`
- `src/app/shared/components/page-header/*`
- `src/app/shared/components/add-to-collection-dialog/*`
- `src/app/shared/components/confirm-dialog/*`
- `src/app/pages/recipes/services/recipes.service.ts` (akcje właściciela)

## 4. Szczegóły komponentów

### `pych-public-recipe-detail-page` (`PublicRecipeDetailPageComponent`)
- **Opis komponentu:** kontener widoku. Parsuje `idslug`, pobiera szczegóły publicznego przepisu, zarządza stanem (loading/error/data), wylicza kontekst użytkownika (gość/zalogowany + własność) i renderuje właściwe akcje.

- **Główne elementy:**
  - `PageHeaderComponent`:
    - tytuł: `pageTitle` (nazwa przepisu lub fallback),
    - przycisk „Wróć do przeglądania” (nawigacja do `/explore`),
    - sekcja akcji zależna od kontekstu.
  - sekcja nagłówka przepisu: `RecipeHeaderComponent` + `RecipeImageComponent`.
  - sekcja treści: 2 kolumny (Składniki/Kroki), na mobile 1 kolumna.
  - stopka metadanych: autor + data utworzenia.

- **Obsługiwane interakcje:**
  - **Wróć do przeglądania** → nawigacja do `/explore`.
  - **Gość – CTA:**
    - „Zaloguj się” → `/login?returnUrl=<currentUrl>`
    - „Zarejestruj się” → `/register?returnUrl=<currentUrl>`
  - **Zalogowany – cudzy przepis:**
    - „Dodaj do kolekcji” → otwarcie `AddToCollectionDialogComponent`.
    - po sukcesie → `MatSnackBar` z potwierdzeniem (jak w prywatnym `RecipeDetailPageComponent`).
  - **Zalogowany – własny przepis:**
    - „Edytuj” → nawigacja do `/recipes/:id/edit`.
    - „Usuń” → `ConfirmDialogComponent` + po potwierdzeniu `RecipesService.deleteRecipe(id)` + `MatSnackBar` + nawigacja do `/recipes`.
  - **Retry** (błędy sieci/5xx) → ponowne pobranie szczegółów.
  - **Kanonikalizacja sluga** → nawigacja `replaceUrl: true`.

- **Obsługiwana walidacja (guard clauses):**
  - `idslug` musi zawierać poprawne `id`:
    - brak parametru / `NaN` / `<= 0` → błąd `400` + CTA powrotu do `/explore`.
  - render akcji:
    - `Dodaj do kolekcji` wyłącznie gdy `isAuthenticated === true` **i** `isOwner === false`.
    - `Edytuj/Usuń` wyłącznie gdy `isAuthenticated === true` **i** `isOwner === true`.

- **Typy:**
  - DTO: `PublicRecipeDetailDto`
  - lokalny stan: `PublicRecipeDetailState` (patrz sekcja 5)
  - dialog: `AddToCollectionDialogData`, `AddToCollectionDialogResult`, `ConfirmDialogData`

- **Propsy:** brak (komponent routowalny).

### `pych-recipe-header` (`RecipeHeaderComponent`) – reużycie
- **Opis:** renderuje nazwę/opis/kategorię/tagi w kontekście prywatnym i publicznym.
- **Wymagania:**
  - musi wspierać `PublicRecipeDetailDto` (tagi jako `string[]`, kategoria jako `CategoryDto | null`).
  - w publicznym kontekście tagi/kategoria mogą być nieklikalne (MVP) lub linkować do `/explore?q=...`.

### `pych-add-to-collection-dialog` (`AddToCollectionDialogComponent`) – reużycie
- **Opis:** modal wyboru kolekcji lub utworzenia nowej i dodania przepisu.
- **Warunek:** dostępny tylko dla użytkownika zalogowanego.

### `pych-confirm-dialog` (`ConfirmDialogComponent`) – reużycie
- **Opis:** modal potwierdzenia usunięcia (własny przepis).

## 5. Typy

### DTO (istniejące)
Z `shared/contracts/types.ts`:
- `PublicRecipeDetailDto`
- `RecipeContent`, `RecipeContentItem`
- `CategoryDto`, `ProfileDto`
- `ApiError`

### Typy komponentowe (zalecane)
- `PublicRecipeDetailState` (lokalnie w komponencie):
  - `recipe: PublicRecipeDetailDto | null`
  - `isLoading: boolean`
  - `error: ApiError | null`

- Computed/signals (bez nowych typów):
  - `isAuthenticated: Signal<boolean>`
  - `currentUserId: Signal<string | null>` (ID z sesji)
  - `isOwner: Signal<boolean>` (porównanie `recipe.author.id === currentUserId()`)

## 6. Zarządzanie stanem

W `PublicRecipeDetailPageComponent` stosujemy **Angular Signals**:
- `state = signal<PublicRecipeDetailState>({ recipe: null, isLoading: true, error: null })`
- `isAuthenticated = signal<boolean>(false)`
- `currentUserId = signal<string | null>(null)`
- `recipe = computed(...)`, `isLoading = computed(...)`, `error = computed(...)`
- `isOwner = computed(() => !!recipe() && !!currentUserId() && recipe()!.author.id === currentUserId())`
- `headerMode = computed(() => 'guest' | 'addToCollection' | 'ownerActions')` (opcjonalnie dla czytelności template)

Zasady UX (zgodne z regułami projektu):
- podczas retry/ponownych pobrań używać `state.update()` i nie generować „white flash” (bez białych overlay).

## 7. Integracja API

### Pobranie szczegółów publicznego przepisu
- **Endpoint:** `GET /public/recipes/{id}`
- **Serwis:** `PublicRecipesService.getPublicRecipeById(id: number): Observable<PublicRecipeDetailDto>`
- **Response:** `PublicRecipeDetailDto`

Wymaganie jakościowe (dla poprawnej obsługi błędów w UI):
- serwis powinien propagować **status** (404/400/500) do UI (np. rzucać `ApiError` zamiast „gołego” `Error`). To jest istotne, aby widok mógł rozróżnić 404 (brak publicznego przepisu) od błędów sieci.

### Dodanie do kolekcji (zalogowany, cudzy przepis)
- `GET /collections` → `CollectionListItemDto[]` (w dialogu)
- `POST /collections/{id}/recipes` body: `AddRecipeToCollectionCommand` (`{ recipe_id: number }`)
- `POST /collections` (tworzenie nowej kolekcji; w dialogu)

Wymaganie z PRD/US-021:
- obsłużyć `409 Conflict` (przepis już w kolekcji) czytelnym komunikatem i bez duplikatu.

### Akcje właściciela (zalogowany, własny przepis)
- **Edycja:** nawigacja do `/recipes/:id/edit` (dalsze pobranie danych w widoku edycji po stronie prywatnej).
- **Usunięcie:** `DELETE /recipes/{id}` (Edge Function przez `RecipesService.deleteRecipe`).

## 8. Interakcje użytkownika

- **Gość otwiera publiczny URL:**
  - widzi szczegóły przepisu + CTA logowanie/rejestracja.

- **Zalogowany otwiera publiczny URL:**
  - nie widzi CTA logowanie/rejestracja.
  - dla cudzych przepisów: widzi „Dodaj do kolekcji”.
  - dla własnych: widzi „Edytuj” i „Usuń”.

- **Dodaj do kolekcji:**
  - otwiera modal, wybiera kolekcję lub tworzy nową,
  - po sukcesie: snackbar z potwierdzeniem,
  - przy 409: snackbar „Ten przepis jest już w tej kolekcji” (lub analogiczny komunikat).

- **Usuń (własny przepis):**
  - modal potwierdzenia → po akceptacji usunięcie + snackbar + nawigacja.

## 9. Warunki i walidacja

- **Zakres treści:** niezależnie od kontekstu, widok prezentuje wyłącznie przepisy `PUBLIC` (wymusza endpoint publiczny; 404 jeśli przepis nie jest publiczny).
- **Walidacja parametrów:** `id` z `idslug` musi być dodatnią liczbą.
- **Warunek dla akcji:**
  - `isAuthenticated === false` → wyłącznie CTA logowanie/rejestracja.
  - `isAuthenticated === true && isOwner === false` → „Dodaj do kolekcji”.
  - `isAuthenticated === true && isOwner === true` → „Edytuj/Usuń”.

## 10. Obsługa błędów

- **400 (nieprawidłowy URL/ID):** komunikat + przycisk powrotu do `/explore`.
- **404 (brak publicznego przepisu / nie jest publiczny):** komunikat „Nie znaleziono przepisu” + powrót do `/explore`.
- **Błędy sieci/5xx:** komunikat ogólny + „Spróbuj ponownie” + „Wróć do przeglądania”.
- **Błędy akcji (dodanie do kolekcji/usunięcie):** snackbar z czytelnym komunikatem; UI nie powinno „udawać sukcesu”.

## 11. Kroki implementacji

1. **Uzgodnić finalny wariant akcji dla zalogowanego:** w headerze widoku zastosować ten sam układ ikon/przycisków co w `RecipeDetailPageComponent`.
2. **Rozszerzyć `PublicRecipeDetailPageComponent`:**
   - dodać `currentUserId` (z sesji Supabase, analogicznie do `ExplorePageComponent`),
   - dodać computed `isOwner` i logikę wyboru zestawu akcji.
3. **Dodać akcję „Dodaj do kolekcji”:**
   - wstrzyknąć `MatDialog` i otwierać `AddToCollectionDialogComponent` z `recipeId` i `recipeName`,
   - po zamknięciu obsłużyć rezultat (`added/created`) i pokazać `MatSnackBar`.
4. **Dodać akcje właściciela:**
   - `onEdit()` → nawigacja do `/recipes/:id/edit`,
   - `onDelete()` → `ConfirmDialogComponent` → `RecipesService.deleteRecipe()` → snackbar + nawigacja.
5. **Ukryć CTA dla zalogowanego:**
   - w template pozostawić CTA tylko dla `!isAuthenticated()`.
6. **Obsługa błędów statusowych:**
   - dopasować `PublicRecipesService.getPublicRecipeById` (lub mapowanie błędów w komponencie), aby UI dostawał `ApiError` ze statusem (w szczególności 404).
7. **Weryfikacja kryteriów akceptacji (US-021 + PRD):**
   - gość: CTA logowanie/rejestracja,
   - zalogowany: „Dodaj do kolekcji” dla cudzych, „Edytuj/Usuń” dla własnych,
   - brak duplikatów przy dodawaniu do kolekcji (obsługa 409),
   - layout 2-kolumnowy na desktopie i ciągła numeracja kroków.
