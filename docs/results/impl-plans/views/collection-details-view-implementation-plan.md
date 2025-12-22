# Plan implementacji widoku: Szczegóły Kolekcji (bez paginacji w UI)

## 1. Przegląd

Widok **„Szczegóły Kolekcji”** (`/collections/:id`) prezentuje nazwę/opis kolekcji oraz **pełną listę przypisanych przepisów** ładowaną **jednorazowo** (bez paginacji i bez przycisku „Więcej” w UI). Użytkownik może również **usunąć przepis z tej kolekcji** z poziomu karty przepisu.

Kluczowe wymagania (US-031 / PRD):
- **Brak paginacji w UI** (brak paginatora i brak „Więcej”).
- **Czytelny stan ładowania** (preferowany skeleton/loader).
- **Stan pusty** dla kolekcji bez przepisów + akcja powrotu do `/collections`.
- **Czytelne komunikaty** dla `403` / `404`.
- **Obsługa limitu technicznego API**: jeśli backend ogranicza wynik, UI pokazuje informację, że lista może być niepełna.

## 2. Routing widoku

- **Ścieżka:** `/collections/:id`
- **Kontekst layoutu:** prywatny (z Sidebarem), zgodnie z App Shell.
- **Ładowanie:** lazy loading `loadComponent` (standalone component).

## 3. Struktura komponentów

Docelowa hierarchia (bez paginacji):

```
CollectionDetailsPageComponent (standalone, OnPush)
|
+-- PageHeaderComponent (współdzielony)
|
+-- CollectionHeaderComponent (standalone, prezentacyjny)
|
+-- RecipeListComponent (współdzielony)  [tryb: "static" / bez paginacji]
    |
    +-- RecipeCardComponent (współdzielony, powtarzany)
```

## 4. Szczegóły komponentów

### `CollectionDetailsPageComponent` (komponent-strona)

- **Opis komponentu**: kontener widoku. Odpowiada za:
    - pobranie `id` kolekcji z route params,
    - wywołanie API `GET /collections/{id}` (jednorazowo),
    - mapowanie DTO → VM,
    - prezentację stanów: loading / error / empty / truncated,
    - obsługę akcji „Usuń z kolekcji” (DELETE) i odświeżenie listy.
- **Główne elementy**:
    - `pych-page-header` z tytułem (nazwa kolekcji lub fallback),
    - sekcja z `pych-collection-header` (nazwa + opis),
    - sekcja z listą przepisów:
        - skeleton/loader podczas pierwszego ładowania,
        - empty state, gdy `recipes.length === 0`,
        - `pych-recipe-list` w trybie **bez paginacji**,
        - komunikat ostrzegawczy, gdy `recipes.pageInfo.truncated === true`.
- **Obsługiwane zdarzenia**:
    - `onRemoveRecipe(recipeId: number)`: potwierdzenie w dialogu → `DELETE /collections/{collectionId}/recipes/{recipeId}` → reload danych kolekcji.
    - `navigateBack()`: powrót do listy kolekcji (`/collections`).
    - (opcjonalnie) `retry()`: ponowienie ładowania po błędzie.
- **Warunki walidacji (guard clauses)**:
    - `id` z URL musi być liczbą całkowitą `> 0`; w przeciwnym razie stan błędu „Nieprawidłowy identyfikator kolekcji”.
    - brak walidacji formularzy w tym widoku.
    - **frontend nie waliduje uprawnień** (to rola API), ale mapuje `403/404` na czytelne komunikaty.
- **Typy**:
    - DTO: `CollectionDetailDto`, `RecipeListItemDto`, `CollectionRecipesPageInfoDto`
    - VM: `CollectionDetailsViewModel`, `RecipeListItemViewModel` (jeśli `pych-recipe-list` operuje na VM)
- **Propsy**: brak (komponent strony jest routowany).

### `CollectionHeaderComponent` (komponent prezentacyjny)

- **Opis komponentu**: wyświetla nazwę i opis kolekcji.
- **Główne elementy**:
    - nagłówek (np. `<h1>`/`<h2>`) z nazwą,
    - opis (`<p>`) lub placeholder „Brak opisu” (opcjonalnie, zależnie od UX).
- **Obsługiwane zdarzenia**: brak.
- **Warunki walidacji**: brak.
- **Typy**: `Pick<CollectionDetailsViewModel, 'name' | 'description'>`.
- **Propsy**:
    - `@Input({ required: true }) collectionData: { name: string; description: string | null }`

### `RecipeListComponent` (komponent współdzielony)

- **Opis komponentu**: współdzielona siatka kart przepisów. Dla `/collections/:id` musi wspierać tryb **„static”**:
    - renderuje wszystkie elementy przekazane w `recipes`,
    - **nie renderuje paginatora** i nie emituje `pageChange`,
    - opcjonalnie pokazuje spinner/skeleton na czas reloadu po usunięciu (bez „white overlay”; zgodnie z zasadami: utrzymać poprzednie dane widoczne i np. obniżyć opacity kontenera).
- **Główne elementy**:
    - `@for` po `recipes` → `RecipeCardComponent`,
    - brak `mat-paginator` w trybie „static”.
- **Obsługiwane zdarzenia**:
    - `@Output() removeRecipe: EventEmitter<number>` (gdy `showRemoveAction=true`).
    - **Brak** `pageChange` w trybie „static” (lub nieużywany/wyłączony).
- **Warunki walidacji**: brak.
- **Typy**:
    - wejście: `RecipeListItemViewModel[]` lub `RecipeListItemDto[]` (zgodnie z istniejącą implementacją komponentu),
    - (opcjonalnie) `mode: 'static' | 'cursor' | 'page'` lub `enablePagination: boolean`.
- **Propsy** (rekomendowane API komponentu dla tego widoku):
    - `@Input({ required: true }) recipes: RecipeListItemViewModel[]`
    - `@Input() isLoading: boolean`
    - `@Input() showRemoveAction: boolean`
    - `@Input() mode: 'static' | 'cursor' | 'page' = 'static'`  *(lub alternatywnie: `showPaginator=false`)*

### `RecipeCardComponent` (komponent współdzielony)

- **Opis komponentu**: karta przepisu z miniaturą i nazwą. W kontekście kolekcji powinna umożliwić akcję „Usuń z kolekcji” (tylko gdy `showRemoveAction=true`).
- **Główne elementy**:
    - `mat-card`, miniatura, tytuł,
    - menu akcji (`mat-menu`) z pozycją „Usuń z kolekcji”.
- **Obsługiwane zdarzenia**:
    - `@Output() remove: EventEmitter<void>` (emit po wybraniu akcji).
- **Warunki walidacji**: brak.
- **Typy**: VM/DTO pojedynczej karty (zależnie od aktualnego shared komponentu).
- **Propsy**:
    - `@Input({ required: true }) recipe: ...`
    - `@Input() showRemoveAction: boolean`

## 5. Typy

### DTO wykorzystywane bezpośrednio

- **`CollectionDetailDto`**: `{ id, name, description, recipes: { data: RecipeListItemDto[]; pageInfo: CollectionRecipesPageInfoDto } }`
- **`CollectionRecipesPageInfoDto`**:
    - `limit: number`
    - `returned: number`
    - `truncated: boolean`
- **`RecipeListItemDto`**: wykorzystywany do renderowania kart (nazwa, obrazek, kategoria, flagi, itp.).

### `CollectionDetailsViewModel` (model widoku)

Rekomendowany VM (wspiera brak paginacji i „limit techniczny”):

```typescript
interface CollectionDetailsViewModel {
    id: number;
    name: string;
    description: string | null;

    recipes: RecipeListItemDto[];
    recipesPageInfo: CollectionRecipesPageInfoDto | null;

    isLoading: boolean;
    error: {
        kind: 'invalid_id' | 'not_found' | 'forbidden' | 'server' | 'unknown';
        message: string;
    } | null;
}
```

Uwagi:
- `recipesPageInfo.truncated === true` → UI pokazuje komunikat „Nie udało się załadować wszystkich przepisów (limit techniczny).”
- Dla minimalizacji „flashowania” podczas reloadu po DELETE: aktualizacje wykonywać przez `state.update()` i nie zerować listy przepisów przed zakończeniem requestu (zgodnie z zasadami loading states).

## 6. Zarządzanie stanem

Stan lokalny w `CollectionDetailsPageComponent` z użyciem **Angular Signals**:
- `collectionId = signal<number | null>(null)` (z route params)
- `state = signal<CollectionDetailsViewModel>(initialState)`
- `isLoading = computed(...)`, `hasData`, `isEmpty`, `truncationWarningVisible` (computed)
- `effect()`:
    - reaguje na zmianę `collectionId`,
    - wywołuje `CollectionsApiService.getCollectionDetails(id, { limit })`,
    - zapisuje wynik w `state.update()`.

## 7. Integracja API

### Pobieranie danych kolekcji (jednorazowo)

- **Endpoint**: `GET /collections/{id}`
- **Query params**:
    - `limit` (opcjonalnie, np. `500` – limit techniczny)
    - (opcjonalnie) `sort` (stabilny, np. `created_at.desc`)
- **Typ odpowiedzi**: `CollectionDetailDto`
- **Akcja frontendowa**:
    - na wejściu w widok: request → render danych,
    - przy `truncated=true`: render ostrzeżenia o możliwie niepełnym wyniku.

### Usuwanie przepisu z kolekcji

- **Endpoint**: `DELETE /collections/{collectionId}/recipes/{recipeId}`
- **Typ odpowiedzi**: `204 No Content`
- **Akcja frontendowa**:
    - otwarcie `ConfirmDialogComponent`,
    - po sukcesie: snackbar + ponowne `GET /collections/{id}`,
    - po błędzie: snackbar z komunikatem i bez zmian w liście.

**Krytyczne (reguły projektu)**: frontend komunikuje się z Supabase wyłącznie przez `supabase.functions.invoke(...)` (Edge Functions), bez `supabase.from(...)`.

## 8. Interakcje użytkownika

- **Wejście na stronę**:
    - loader/skeleton,
    - po sukcesie: nazwa/opis + pełna lista przepisów,
    - jeśli brak przepisów: empty state + akcja „Wróć do listy kolekcji”.
- **Usuwanie przepisu z kolekcji**:
    - klik „Usuń z kolekcji” na karcie,
    - modal potwierdzenia,
    - po potwierdzeniu: request DELETE,
    - po sukcesie: snackbar + odświeżona lista,
    - po błędzie: snackbar, lista bez zmian.
- **Obsługa limitu technicznego**:
    - gdy `truncated=true`: widoczna informacja (np. alert/karteczka informacyjna) nad listą.
- **Powrót**:
    - przycisk „Wróć do listy kolekcji” w stanie błędu i w empty state.

## 9. Warunki i walidacja

- **Param `id`**:
    - musi być liczbą całkowitą `> 0`; inaczej error state i brak call do API.
- **Brak paginacji w UI**:
    - w widoku nie renderujemy paginatora,
    - `pych-recipe-list` musi być uruchomiony w trybie bez paginacji lub zastąpiony prostą siatką kart.
- **Loading states**:
    - przy reload (np. po DELETE) nie czyścić listy przepisów „na pusto”; utrzymać poprzedni widok i sygnalizować ładowanie przez `opacity`/spinner (bez białych overlay).

## 10. Obsługa błędów

- **401 Unauthorized**: obsługa globalna (guard/interceptor), redirect do logowania.
- **403 Forbidden**: komunikat „Nie masz dostępu do tej kolekcji.” + akcja powrotu do `/collections`.
- **404 Not Found**: komunikat „Nie znaleziono kolekcji. Być może została usunięta.” + akcja powrotu.
- **5xx / network / unknown**: komunikat ogólny + (opcjonalnie) przycisk „Spróbuj ponownie”.
- **Błąd DELETE**: snackbar „Nie udało się usunąć przepisu z kolekcji.”

## 11. Kroki implementacji

1. **Doprecyzuj kontrakt listy przepisów kolekcji**:
    - upewnij się, że `GET /collections/{id}` zwraca `recipes: { data, pageInfo }` (a nie paginację stron),
    - w razie rozbieżności: ujednolić mapping w frontendzie do `CollectionDetailDto`.
2. **Zmień integrację w `CollectionsApiService.getCollectionDetails`**:
    - usuń `page` z query params dla tego widoku,
    - użyj `limit` (np. `500`) i ewentualnie `sort`.
3. **Zmień stan widoku (`CollectionDetailsViewModel`)**:
    - zastąp `pagination` polem `recipesPageInfo` (lub analogicznym),
    - dodaj typowany `error.kind`.
4. **Zmień `CollectionDetailsPageComponent`**:
    - usuń `currentPage`, `onPageChange` oraz `pageSize` w kontekście UI paginacji,
    - załaduj dane jednorazowo po zmianie `collectionId`,
    - dodaj obsługę `truncated` (banner/alert),
    - przy reloadach stosuj `state.update()` i nie czyść listy przed zakończeniem requestu.
5. **Zmień `pych-recipe-list` (komponent współdzielony)**:
    - dodaj tryb „static”/flagę `showPaginator=false`,
    - upewnij się, że paginator nie renderuje się w `/collections/:id`.
6. **Dodaj/uzupełnij UI stanu pustego i błędów**:
    - empty state z akcją powrotu,
    - osobne komunikaty dla `403`/`404`.
7. **Zweryfikuj UX usuwania przepisu**:
    - modal potwierdzenia,
    - snackbar po sukcesie i po błędzie,
    - odświeżenie listy bez paginacji.
