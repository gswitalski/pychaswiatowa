# PS-15 — Recipe Author on Detail View

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11  
**Status:** Historyjka gotowa do planowania

---

## Historia zmian

| Wersja | Data | Opis |
|---|---|---|
| R1 (pierwotna) | 2026-11-11 | Pierwotna historyjka z rundy pytań R1 |
| R1 (impl-plan API) | 2026-11-11 | **F3.2:** `fetchAuthorProfile(client, userId)` w `recipes.service.ts` (testowalność Deno, spójność z explore). |
| R1 (aktualna) | 2026-11-11 | **Poprawki F2, F3, dodanie GWT:** (1) F2 uzupełniony o brakujące kroki — dodanie `tips: RecipeContent` do lokalnego `RecipeDetailDto` explore i mapowanie `tips` w `mapToDto`; (2) F2/F3 — `ProfileDto` definiowany lokalnie w edge functions (import z `shared/contracts/types.ts` niemożliwy w Deno ze względu na zależność na `shared/types/database.types`); (3) F3 — doprecyzowanie że `fetchAuthorProfile` używa `createServiceRoleClient()` niezależnie od kontekstu auth (właściciel cudzego PUBLIC przepisu może nie mieć dostępu do `profiles` przez RLS); (4) Dodana macierz GWT. |
| R1 (impl-plan) | 2026-11-11 | **Decyzja API-1:** `fetchAuthorProfile(client, userId)` w `recipes.service.ts` (Opcja A) — klient przekazywany jako parametr, spójnie z `explore.service.ts`. Step A: `client` (authenticated), Step B: `serviceClient` (service-role). Zapisano `PS-15-recipe-author-on-detail-view-api-implementation-plan.md`. |

---

## Historia użytkownika

Jako użytkownik przeglądający szczegóły przepisu  
chcę widzieć, kto jest autorem przepisu,  
żeby wiedzieć, czyj przepis oglądam.

---

## Kontekst i uzasadnienie

### Stan obecny

Na **listach** przepisów pole `author: { id, username }` jest już dostępne:
- `RecipeListItemDto` (prywatna lista `/recipes`) — ma `author`
- `PublicRecipeListItemDto` (lista explore) — ma `author: ProfileDto`
- `PublicRecipeDetailDto` (anonimowy detail) — ma `author: ProfileDto` i `tips`

Na **widoku szczegółów** przepisu dane autora są nieobecne:
- `RecipeDetailDto` w `shared/contracts/types.ts` — **brak pola `author`**, jest tylko `user_id`
- `RecipeDetailDto` w `supabase/functions/recipes/recipes.service.ts` — **brak `author`**
- `RecipeDetailDto` w `supabase/functions/explore/explore.service.ts` — **brak `author`** i **brak `tips`**

Widok `recipe_details` w PostgreSQL zawiera tylko `user_id`; nie ma kolumny z danymi profilu.  
Typ `ProfileDto = Pick<Profile, 'id' | 'username'>` jest już zdefiniowany w kontraktach.

### Dodatkowy bug (naprawiany w PS-15)

Endpoint `GET /explore/recipes/:id` nie zwraca pola `tips` (wskazówki kulinarne) mimo że:
- kolumna `tips` istnieje w tabeli `recipes` i widoku `recipe_details` (migracja `20260112120100`)
- pole `tips` jest w `RecipeDetailDto` ze strony prywatnego API (`recipes.service.ts`)
- jest w `PublicRecipeDetailDto`

Przyczyna: w `explore.service.ts` stała `RECIPE_DETAIL_SELECT_COLUMNS` i interfejs  
`RecipeDetailFullRow` pomijają kolumnę `tips`. **Lokalny `RecipeDetailDto` w explore.service.ts  
również nie posiada pola `tips`.**

---

## Zakres

Historyjka obejmuje **dwa endpointy** i ich widoki UI:

| Trasa | Serwis backendowy | Serwis frontendowy |
|---|---|---|
| `/explore/recipes/:id-:slug` | `explore.service.ts` | `ExploreRecipesService` |
| `/recipes/:id-:slug` | `recipes.service.ts` | `RecipesService` |

Oba endpointy używają tego samego `RecipeDetailDto` z `shared/contracts/types.ts`  
i renderują przepis przez `RecipeDetailViewComponent` → `RecipeHeaderComponent`.

---

## Wymagania funkcjonalne

### F1 — Kontrakt `RecipeDetailDto`

Dodać wymagane pole `author: ProfileDto` do `RecipeDetailDto` w `shared/contracts/types.ts`.

```typescript
// shared/contracts/types.ts — PRZED:
export type RecipeDetailDto = Omit<RecipeDetail, 'ingredients' | 'steps' | 'tips' | ...> & {
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;
    // ... brak author
};

// PO:
export type RecipeDetailDto = Omit<RecipeDetail, 'ingredients' | 'steps' | 'tips' | ...> & {
    ingredients: RecipeContent;
    steps: RecipeContent;
    tips: RecipeContent;
    author: ProfileDto;   // NOWE — wymagane
    // ...
};
```

### F2 — Backend: explore.service.ts

1. Dodać `tips` do `RECIPE_DETAIL_SELECT_COLUMNS` (fix buga).
2. Dodać pole `tips: RecipeContent` do interfejsu `RecipeDetailFullRow`.
3. **[KOREKTA R1]** Dodać pole `tips: RecipeContent` do lokalnego `RecipeDetailDto` w explore.service.ts.
4. Dodać pole `author: { id: string; username: string }` do lokalnego `RecipeDetailDto`
   w explore.service.ts.  
   > **Uwaga [KOREKTA R1]:** Typ definiujemy lokalnie jako `{ id: string; username: string }`
   > (nie importujemy `ProfileDto` z `shared/contracts/types.ts`, ponieważ ten plik ma zależność
   > na `shared/types/database.types` poza zasięgiem Deno edge functions).
5. Dodać helper `fetchAuthorProfile(client: TypedSupabaseClient, userId: string): Promise<{ id: string; username: string }>` — zapytanie do tabeli `profiles`, fallback `{ id: userId, username: userId }`.
   > `client` przekazywany do helpera to zawsze `createServiceRoleClient()` (w explore.service.ts  
   > klient jest już service-role, więc wystarczy przekazać istniejący `client`).
6. W obu gałęziach `getExploreRecipeById` (PUBLIC i właściciel PRIVATE/SHARED) — rozszerzyć
   istniejący `Promise.all` o wywołanie `fetchAuthorProfile(client, recipe.user_id)`.
7. Zaktualizować sygnaturę `mapToDto` — dodać parametr `author: { id: string; username: string }`.
8. **[KOREKTA R1]** Zmapować `tips` w ciele `mapToDto`: `tips: recipe.tips ?? []`.
9. Zmapować `author` w ciele `mapToDto`: `author: author`.

### F3 — Backend: recipes.service.ts

1. Dodać pole `author: { id: string; username: string }` do lokalnego `RecipeDetailDto`
   w recipes.service.ts.  
   > Analogicznie jak F2 — typ definiujemy lokalnie.
2. Dodać helper `fetchAuthorProfile(userId: string): Promise<{ id: string; username: string }>`
   używający **`createServiceRoleClient()`** (nie auth-client).  
   > **[KOREKTA R1]:** Konieczne jest użycie service-role, bo w ścieżce PUBLIC przepisu autor  
   > może być innym użytkownikiem — authenticated client byłby ograniczony przez RLS profiles.
3. W `getRecipeById` ścieżka happy-path (linia ~927): rozszerzyć istniejący `Promise.all`
   o `fetchAuthorProfile(data.user_id)`.
4. W `getRecipeById` ścieżka Step B / PUBLIC (linia ~1022): rozszerzyć istniejący `Promise.all`
   o `fetchAuthorProfile(publicRecipe.user_id)`.
5. Zaktualizować `mapToRecipeDetailDto` — dodać parametr `author: { id: string; username: string }`.
6. Dodać `author: author` w ciele `mapToRecipeDetailDto`.

> **Decyzja architektoniczna:** Widok `recipe_details` nie jest rozszerzany o kolumnę username  
> (zgodnie z odpowiedzią P5: brak migracji SQL). Pobieramy dane profilu osobnym zapytaniem.

### F4 — UI: RecipeHeaderComponent

Wyświetlić autora w szablonie HTML:

```html
<!-- Sekcja autora przepisu -->
@if (authorLabel()) {
    <div class="recipe-author">
        <mat-icon aria-label="Autor">person</mat-icon>
        <span>{{ authorLabel() }}</span>
    </div>
}
```

**Computed signal `authorLabel()`** w `RecipeHeaderComponent`:
```typescript
readonly authorLabel = computed(() => {
    const author = this.recipe().author;
    if (!author?.username) return null;
    return `Autor: ${author.username}`;
});
```

**Miejsce w szablonie:** po sekcji porcji (`recipe-servings`), przed opisem.  
**Bez linku** — brak publicznego profilu w systemie (zgodnie z P3).  
**Zawsze widoczny** — dla własnych i cudzych przepisów (zgodnie z P2).

Typ wejściowy komponentu `recipe = input.required<RecipeDetailDto | PublicRecipeDetailDto>()`  
— po zmianach F1 oba typy mają `author: ProfileDto`, więc brak konieczności type-guardów.

---

## Wymagania niefunkcjonalne

- **NF1** — Osobne zapytanie do `profiles` nie może blokować zwrócenia wyniku; błąd 404 profilu  
  nie może powodować HTTP 500 (fallback do `user_id`).
- **NF2** — Zapytanie o profil autora wykonywane jest równolegle z innymi zapytaniami przez `Promise.all`.
- **NF3** — Brak nowych migracji SQL w tej historyjce.
- **NF4** — Brak publicznej strony profilu; username jest tylko tekstem, nie linkiem.

---

## Kryteria akceptacji

| # | Opis | Weryfikacja |
|---|---|---|
| AC1 | `GET /explore/recipes/:id` zwraca `author.id` i `author.username` | deno test |
| AC2 | `GET /explore/recipes/:id` zwraca pole `tips` (może być `[]`) | deno test |
| AC3 | `GET /recipes/:id` zwraca `author.id` i `author.username` | deno test |
| AC4 | Strona `/explore/recipes/:id-:slug` wyświetla `Autor: {username}` z ikoną `person` | Vitest |
| AC5 | Strona `/recipes/:id-:slug` wyświetla `Autor: {username}` z ikoną `person` | Vitest |
| AC6 | Pole `author` jest widoczne zarówno dla własnego, jak i cudzego przepisu | Vitest |
| AC7 | Username nie jest linkiem | Vitest (brak elementu `a` w `.recipe-author`) |
| AC8 | TypeScript kompiluje się bez błędów po dodaniu `author` do `RecipeDetailDto` | CI build |

---

## Macierz GWT

### G1 — Explore: PUBLIC przepis zwraca autora i tips

```gherkin
Given  przepis id=1 jest PUBLIC z user_id='user-abc' i tips=[{type:'item',content:'Wskazówka'}]
And    profil user-abc ma username='jan.kowalski'
When   GET /explore/recipes/1 (anonimowy lub zalogowany)
Then   odpowiedź zawiera author.id='user-abc', author.username='jan.kowalski'
And    odpowiedź zawiera tips=[{type:'item',content:'Wskazówka'}]
```

### G2 — Explore: PRIVATE przepis właściciela zwraca autora

```gherkin
Given  przepis id=2 jest PRIVATE z user_id='user-xyz'
And    profil user-xyz ma username='anna.nowak'
When   GET /explore/recipes/2 z JWT użytkownika user-xyz
Then   odpowiedź zawiera author.id='user-xyz', author.username='anna.nowak'
```

### G3 — Explore: brak profilu — fallback username=user_id

```gherkin
Given  przepis id=3 jest PUBLIC z user_id='orphan-uuid'
And    tabela profiles nie zawiera rekordu dla 'orphan-uuid'
When   GET /explore/recipes/3
Then   odpowiedź zawiera author.id='orphan-uuid', author.username='orphan-uuid'
And    kod HTTP to 200 (brak 500)
```

### G4 — Recipes: prywatny endpoint zwraca autora

```gherkin
Given  przepis id=4 należy do zalogowanego użytkownika user-abc
And    profil user-abc ma username='jan.kowalski'
When   GET /recipes/4 z JWT użytkownika user-abc
Then   odpowiedź zawiera author.id='user-abc', author.username='jan.kowalski'
```

### G5 — UI: wyświetlanie sekcji autora

```gherkin
Given  RecipeHeaderComponent otrzymuje recipe z author.username='jan.kowalski'
When   komponent jest renderowany
Then   widoczny jest element div.recipe-author
And    tekst elementu to 'Autor: jan.kowalski'
And    ikonka mat-icon z aria-label='Autor' jest widoczna
And    brak elementu <a> wewnątrz div.recipe-author
```

### G6 — UI: brak sekcji autora gdy username jest null

```gherkin
Given  RecipeHeaderComponent otrzymuje recipe z author=null (lub author.username=null)
When   komponent jest renderowany
Then   element div.recipe-author nie jest renderowany
```

---

## Pliki do zmiany

### Kontrakt (1 plik)
- `shared/contracts/types.ts` — dodać `author: ProfileDto` do `RecipeDetailDto`

### Backend — Edge Functions (2 pliki)
- `supabase/functions/explore/explore.service.ts`
  - Fix `tips` w SELECT, `RecipeDetailFullRow`, lokalny `RecipeDetailDto`, `mapToDto`
  - Nowe: `author` w lokalnym `RecipeDetailDto`, helper `fetchAuthorProfile`, mapowanie
- `supabase/functions/recipes/recipes.service.ts`
  - Nowe: `author` w lokalnym `RecipeDetailDto`, helper `fetchAuthorProfile` (service-role),
    wywołania w obu ścieżkach `getRecipeById`, mapowanie w `mapToRecipeDetailDto`

### Frontend — Angular (2 pliki)
- `src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.html`
  — dodać blok `@if (authorLabel())` z ikoną `person` i tekstem autora
- `src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.ts`
  — dodać computed signal `authorLabel`

### Testy — Deno (1–2 pliki)
- `supabase/functions/explore/explore.service.test.ts` *(nowy)*  
  — testy: G1 (PUBLIC+author+tips), G2 (PRIVATE owner), G3 (fallback)
- `supabase/functions/recipes/recipes.service.test.ts` *(istniejący)*  
  — dodać case: G4 (`getRecipeById` zwraca `author.username`)

### Testy — Vitest Angular (1 plik)
- `src/app/pages/recipes/recipe-detail/components/recipe-header/recipe-header.component.spec.ts`  
  — testy: G5 (wyświetlanie), G6 (brak gdy null), AC7 (brak linku)

---

## Założenia

1. Tabela `profiles` zawsze posiada rekord dla każdego `user_id` (trigger `auto_create_profile`  
   z migracji `20251208120000`). Zapytanie może jednak nie trafić na profil (edge case: usunięty  
   profil, stare konto) — obsługiwany fallback: `username = user_id`.
2. Pole `author` w `RecipeDetailDto` jest **wymagane** (non-nullable), zgodnie z P4.
3. Nie planujemy publicznej strony profilu; username jest wyłącznie tekstem informacyjnym.
4. Zakres testów: **tylko jednostkowe** (deno test + Vitest). Brak E2E.
5. Widok `recipe_details` w PostgreSQL nie wymaga zmiany; dane profilu pobieramy  
   osobnym zapytaniem aplikacyjnym.
6. Zmiany w `shared/contracts/types.ts` automatycznie propagują się do frontendu  
   (TypeScript import); brak konieczności zmian w `ExploreRecipesService` ani `RecipesService`  
   po stronie Angular — kontrakt zostaje rozszerzony addytywnie.
7. **[KOREKTA R1]** W Deno edge functions nie importujemy `ProfileDto` ze `shared/contracts/types.ts`
   — definiujemy typ lokalnie jako `{ id: string; username: string }` (strukturalnie identyczny).
8. **[KOREKTA R1]** Helper `fetchAuthorProfile` w `recipes.service.ts` zawsze używa
   `createServiceRoleClient()` — authenticated client nie gwarantuje dostępu do profilu innego
   użytkownika przy PUBLIC przepisach.

---

## Otwarte kwestie

*(brak — wszystkie wymagania zostały rozstrzygnięte w rundach pytań R1 i korektach)*

---

## Powiązane pliki (tylko do odczytu podczas implementacji)

- `src/app/pages/explore/explore-recipe-detail/explore-recipe-detail-page.component.ts`  
  — sprawdza `recipe.user_id` do ustalenia właściciela (nie zmienia się)
- `src/app/pages/recipes/recipe-detail/recipe-detail-page.component.ts`  
  — używa prywatnego `RecipesService`
- `shared/contracts/types.ts` linie 222–260 — `PublicRecipeDetailDto` (wzorzec dla `author`)
- `supabase/migrations/20260112120100_update_recipe_details_view_for_tips.sql`  
  — potwierdza obecność kolumny `tips` w widoku
