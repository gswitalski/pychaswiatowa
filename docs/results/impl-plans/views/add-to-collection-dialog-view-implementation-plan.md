# Plan implementacji widoku AddToCollectionDialogComponent (multi-select)

## 1. Przegląd
`AddToCollectionDialogComponent` to modal (Angular Material `MatDialog`) służący do **masowego** zarządzania przynależnością przepisu do kolekcji użytkownika.

Zmiana względem aktualnej implementacji:
- zamiast single-select: **lista checkboxów** (multi-select),
- **pre-selekcja** kolekcji, w których przepis już jest,
- możliwość zapisu stanu **0 zaznaczonych** (przepis nie należy do żadnej kolekcji),
- pole „Szukaj kolekcji” filtrowane **po stronie frontendu**,
- większy dialog (desktop-first) + przewijana lista wewnątrz modala,
- zapis jako **jedna, atomowa operacja** ustawiająca docelową listę `collection_ids` dla przepisu: `PUT /recipes/{id}/collections`.

## 2. Routing widoku
Brak routingu — to komponent dialogu otwierany z akcji „Dodaj do kolekcji” w widokach szczegółów przepisu:
- prywatne szczegóły: `RecipeDetailPageComponent`,
- publiczne szczegóły: `ExploreRecipeDetailPageComponent` (dla zalogowanego nie-właściciela).

## 3. Struktura komponentów
Docelowo dialog składa się z:
- tytułu,
- opisu kontekstu (nazwa przepisu),
- pola wyszukiwania kolekcji,
- przewijanej listy kolekcji z checkboxami,
- sekcji tworzenia nowej kolekcji (inline),
- stopki z akcjami: Anuluj / Zapisz.

### Diagram drzewa komponentów (wysokopoziomowo)
- `AddToCollectionDialogComponent`
    - `mat-dialog-title`
    - `mat-dialog-content`
        - `mat-form-field` (Szukaj kolekcji)
        - `mat-list` / kontener listy
            - `mat-list-item` (xN)
                - `mat-checkbox`
        - sekcja „Nowa kolekcja”
            - `mat-form-field` (nazwa)
            - `button` (Utwórz)
        - (opcjonalnie) tekst pomocniczy przy 0 zaznaczonych
    - `mat-dialog-actions`
        - `button` (Anuluj)
        - `button` (Zapisz)

## 4. Szczegóły komponentów

### AddToCollectionDialogComponent (modyfikacja)
- **Opis komponentu**:
    - prezentuje wszystkie kolekcje użytkownika,
    - umożliwia:
        - zaznaczenie/odznaczenie wielu kolekcji (checkboxy),
        - filtrowanie listy po nazwie (frontend-only),
        - utworzenie nowej kolekcji w modalu i automatyczne zaznaczenie jej checkboxa,
        - zapis docelowego stanu przez `PUT /recipes/{id}/collections`.
    - zachowuje stan wyboru przy błędach (nie resetuje zaznaczeń po `error`).

- **Główne elementy HTML / Material**:
    - `mat-form-field + matInput`:
        - „Szukaj kolekcji” (filtrowanie lokalne po `CollectionListItemDto.name`).
    - przewijany kontener listy:
        - preferowane: `mat-list` + `mat-list-item` + `mat-checkbox` (czytelna semantyka checkboxów).
        - alternatywa: `mat-selection-list [multiple]="true"` (jeżeli wygodniej, ale UX ma wyglądać jak checkboxy).
    - sekcja „Nowa kolekcja”:
        - `mat-form-field` dla nazwy,
        - przycisk `Utwórz` (oddzielny od `Zapisz`), po sukcesie dodaje element do listy i zaznacza.
    - akcje:
        - `Anuluj` zamyka dialog bez zapisu,
        - `Zapisz` wykonuje atomowy zapis docelowej listy `collection_ids`.

- **Obsługiwane zdarzenia**:
    - `onSearchChange(query: string)`:
        - aktualizuje `searchQuery` (signal),
        - nie wywołuje API.
    - `onToggleCollection(collectionId: number, checked: boolean)`:
        - aktualizuje `selectedCollectionIds` (signal) bez duplikatów.
    - `onCreateCollection()`:
        - waliduje nazwę,
        - wywołuje `POST /collections`,
        - po sukcesie:
            - dopina nową kolekcję do `collections`,
            - zaznacza ją w `selectedCollectionIds`,
            - czyści pole nazwy i ewentualnie zamyka sekcję tworzenia.
    - `onSave()`:
        - wywołuje `PUT /recipes/{id}/collections` z `collection_ids` ustawionymi na aktualny wybór (może być puste),
        - w trakcie blokuje przyciski i pokazuje loader (bez białych overlay).
    - `onCancel()`:
        - zamyka dialog.

- **Warunki walidacji (zgodne z API / wymaganiami UX)**:
    - **recipeId**:
        - wymagany, `> 0` (guard clause na wejściu i przed wywołaniem API).
    - **collection_ids** w `PUT /recipes/{id}/collections`:
        - muszą być unikalne (stan trzymamy jako `Set<number>` lub deduplikowaną tablicę),
        - muszą być liczbami całkowitymi `> 0`,
        - **pusta tablica jest dozwolona** (stan 0 zaznaczonych).
    - **Szukaj kolekcji**:
        - brak walidacji, filter działa dla pustego stringa jako „pokaż wszystko”.
    - **Nowa kolekcja**:
        - nazwa po `trim()`:
            - wymagana do utworzenia,
            - długość i ograniczenia szczegółowe są walidowane po stronie backendu; UI powinno:
                - blokować `Utwórz` dla pustej nazwy,
                - na `400/409` pokazać komunikat i pozostawić wpisaną wartość.

- **Typy (DTO + ViewModel)**:
    - DTO:
        - `CollectionListItemDto`
        - `CreateCollectionCommand`
        - `SetRecipeCollectionsCommand`
        - `SetRecipeCollectionsResponseDto`
        - (źródło pre-selekcji) `RecipeDetailDto.collection_ids`
    - ViewModel (frontend-only, nowe):
        - `AddToCollectionDialogVmCollection` (opcjonalne, jeśli chcemy dodać pola UI):
            - `id: number`
            - `name: string`
            - `description: string | null`
            - `checked: boolean` (wyliczane, niekoniecznie przechowywane)
            - `visible: boolean` (wyliczane po search, niekoniecznie przechowywane)

- **Props / interfejs danych z rodzica (MAT_DIALOG_DATA)**:
    - aktualnie: `{ recipeId, recipeName }`
    - docelowo (proponowane rozszerzenie, aby spełnić pre-selekcję bez dodatkowych requestów):
        - `recipeId: number`
        - `recipeName: string`
        - `initialCollectionIds: number[]` (np. z `RecipeDetailDto.collection_ids`; może być pusta tablica)

### RecipeDetailPageComponent (dostosowanie wywołania dialogu)
- **Zmiana**: przekazanie `initialCollectionIds` do dialogu na podstawie `recipe.collection_ids`.
- **Zmiana**: obsługa wyniku dialogu (snackbar) powinna być zgodna z multi-select, np.:
    - `Zapisano kolekcje dla przepisu`
    - (opcjonalnie) wykorzystać `added_ids/removed_ids` do lepszego komunikatu.

### ExploreRecipeDetailPageComponent (dostosowanie wywołania dialogu)
- analogicznie jak w `RecipeDetailPageComponent`:
    - przekazać `initialCollectionIds` z `recipe.collection_ids`,
    - dostosować komunikat snackbar.

## 5. Typy

### Typy istniejące (z `shared/contracts/types.ts`)
- `CollectionListItemDto`:
    - `id: number`
    - `name: string`
    - `description: string | null`
- `CreateCollectionCommand`:
    - `name: string`
    - `description: string | null`
- `SetRecipeCollectionsCommand`:
    - `collection_ids: number[]`
- `SetRecipeCollectionsResponseDto`:
    - `recipe_id: number`
    - `collection_ids: number[]`
    - `added_ids: number[]`
    - `removed_ids: number[]`
- `RecipeDetailDto`:
    - `collection_ids: number[]` (źródło pre-selekcji)

### Typy nowe (ViewModel) – rekomendowane
- `AddToCollectionDialogData` (aktualizacja):
    - `recipeId: number`
    - `recipeName: string`
    - `initialCollectionIds: number[]`

- `AddToCollectionDialogResult` (aktualizacja):
    - `action: 'saved' | 'cancelled'`
    - `collection_ids?: number[]` (stan końcowy po zapisie)
    - `added_ids?: number[]`
    - `removed_ids?: number[]`

Uwaga: obecny result (`'added' | 'created'`) jest specyficzny dla single-select i nie pasuje do multi-select.

## 6. Zarządzanie stanem
Zgodnie ze standardami projektu: **signals** + `computed`, `inject`, `OnPush`, control flow `@if/@for`.

### Zmienne stanu (signals)
- `collections: Signal<CollectionListItemDto[]>`
- `isLoading: Signal<boolean>` (ładowanie listy kolekcji)
- `loadError: Signal<string | null>` (opcjonalnie, do prezentacji komunikatu w treści dialogu)

- `searchQuery: Signal<string>`
- `filteredCollections: Computed<CollectionListItemDto[]>`:
    - filtr po `name` (case-insensitive) na podstawie `searchQuery.trim()`

- `selectedCollectionIds: Signal<Set<number>>` (lub `number[]`, ale Set upraszcza unikalność)
    - inicjalizowane z `data.initialCollectionIds` (zawsze deduplikacja + filtr `>0`)

- `isSaving: Signal<boolean>` (stan zapisu `PUT /recipes/{id}/collections`)

- sekcja „Nowa kolekcja”:
    - `isCreatingNew: Signal<boolean>` (czy sekcja widoczna)
    - `newCollectionName: Signal<string>`
    - `isCreatingCollection: Signal<boolean>`

### „Custom hook”
W Angularze zamiast hooka: rekomendowane jest wydzielenie logiki do serwisu/fasady, ale dla tego modala logika może pozostać w komponencie.
Opcjonalnie: mała fasada `AddToCollectionDialogFacade` (w tym samym folderze) jeśli dialog zacznie rosnąć (np. retry, telemetry).

## 7. Integracja API
Frontend komunikuje się wyłącznie przez `SupabaseService` i **Edge Functions** (`supabase.functions.invoke`).

### Wymagane wywołania

1) **Pobranie kolekcji użytkownika**:
- `GET /collections`
- typ odpowiedzi: `CollectionListItemDto[]`

2) **Utworzenie kolekcji (bez dodawania przepisu)**:
- `POST /collections`
- body: `CreateCollectionCommand` (w MVP: `{ name: string, description?: null }`)
- odpowiedź: w repo obecnie zwracane jest `{ id: number }` (warto ujednolicić w serwisie; dialog może dopiąć obiekt lokalnie).

3) **Atomowe ustawienie docelowych kolekcji przepisu (kluczowe)**:
- `PUT /recipes/{recipeId}/collections`
- body: `SetRecipeCollectionsCommand` (`{ collection_ids: number[] }`, może być `[]`)
- response: `SetRecipeCollectionsResponseDto`

### Zmiany w serwisach (rekomendowane)
Obecny `CollectionsService` wspiera:
- `GET collections`,
- `POST collections`,
- `POST collections/{id}/recipes` (single operacja),
- `createCollectionAndAddRecipe` (2 kroki).

Docelowo dla multi-select:
- dodać metodę w serwisie (w tym samym lub nowym serwisie, np. `RecipeCollectionsService`):
    - `setRecipeCollections(recipeId: number, command: SetRecipeCollectionsCommand): Observable<SetRecipeCollectionsResponseDto>`
    - endpoint: `recipes/${recipeId}/collections` metodą `PUT`
- zmienić tworzenie kolekcji w dialogu:
    - tworzenie ma tylko `POST /collections`, bez dodawania przepisu,
    - dopięcie i zaznaczenie następuje lokalnie, a przepis faktycznie przypisywany dopiero przy `Zapisz`.

## 8. Interakcje użytkownika

### Otwarcie modala
- Użytkownik klika „Dodaj do kolekcji”.
- Dialog otwiera się większy (desktop-first).
- Kolekcje ładują się (spinner/skeleton w obszarze listy).
- Checkboxy są **pre-zaznaczone** zgodnie z `initialCollectionIds`.

### Filtrowanie
- Użytkownik wpisuje w „Szukaj kolekcji”.
- Lista filtruje się lokalnie po `name`.
- Zaznaczenia pozostają zachowane niezależnie od filtra (ukryte elementy nie tracą stanu).

### Zaznacz/odznacz
- Kliknięcie checkboxa:
    - zaznacza/odznacza kolekcję,
    - UI może pokazać licznik, np. „Zaznaczone: X” (opcjonalnie).

### Stan 0 zaznaczonych
- Użytkownik może odznaczyć wszystko.
- Dialog pokazuje neutralny helper tekst (opcjonalnie): „Przepis nie będzie należeć do żadnej kolekcji”.
- `Zapisz` nadal dostępny.

### Utworzenie nowej kolekcji w modalu
- Użytkownik rozwija sekcję „Nowa kolekcja”.
- Wpisuje nazwę i klika „Utwórz”.
- Po sukcesie:
    - nowa kolekcja pojawia się na liście,
    - jest automatycznie zaznaczona,
    - użytkownik może dalej zmieniać checkboxy przed `Zapisz`.

### Zapis
- Klik `Zapisz`:
    - UI przechodzi w stan `isSaving=true`,
    - przyciski są zablokowane,
    - wykonywany jest `PUT /recipes/{id}/collections` z docelowym `collection_ids`,
    - po sukcesie dialog zamyka się i zwraca result z finalnym stanem/diffem.

## 9. Warunki i walidacja

### Warunki weryfikowane w UI
- **Dane wejściowe dialogu**:
    - `recipeId` musi być liczbą `> 0`:
        - jeśli nie, dialog powinien zamknąć się lub pokazać błąd i zablokować akcje.
- **Tworzenie kolekcji**:
    - `newCollectionName.trim().length > 0` aby odblokować `Utwórz`.
- **Zapis**:
    - zawsze dozwolony po załadowaniu listy (w tym przy 0 zaznaczonych),
    - `collection_ids` wysyłane jako unikalna lista `number` (np. `Array.from(selectedSet).sort((a,b)=>a-b)`).

### Warunki po stronie API (które musimy obsłużyć UX-em)
- `PUT /recipes/{id}/collections` jest atomowe:
    - jeśli choć jedna kolekcja jest nieprawidłowa / nie należy do użytkownika → błąd i brak częściowych zmian.
- API może zwrócić:
    - `400` (payload invalid),
    - `401` (brak sesji),
    - `403` (brak dostępu do przepisu lub do kolekcji),
    - `404` (przepis nie istnieje),
    - `409` (raczej nie dotyczy `PUT` idempotent, ale zostawić ogólną obsługę),
    - `429` (rate limit; szczególnie przy tworzeniu kolekcji).

## 10. Obsługa błędów

### Ładowanie kolekcji (`GET /collections`)
- błąd sieci / backend:
    - pokazać komunikat w treści dialogu (np. `mat-error`/tekst) + opcjonalny snackbar,
    - zapewnić akcję „Spróbuj ponownie” (opcjonalnie) bez zamykania dialogu.

### Tworzenie kolekcji (`POST /collections`)
- `409 Conflict` (kolekcja o takiej nazwie już istnieje):
    - pokazać czytelny komunikat przy polu i/lub snackbar,
    - nie czyścić wpisanej nazwy.
- `400 Bad Request`:
    - komunikat walidacyjny.
- `401/403`:
    - komunikat „Sesja wygasła” + możliwość przejścia do logowania (decyzja produktu),
    - stan formularza zachowany do czasu zamknięcia dialogu.

### Zapis (`PUT /recipes/{id}/collections`)
- błąd:
    - dialog zostaje otwarty,
    - zaznaczenia nie są tracone,
    - snackbar z komunikatem:
        - `403`: „Nie masz dostępu do jednej z kolekcji”
        - `404`: „Przepis nie istnieje lub nie masz do niego dostępu”
        - `401`: „Sesja wygasła. Zaloguj się ponownie.”
        - pozostałe: „Nie udało się zapisać. Spróbuj ponownie.”

## 11. Kroki implementacji
1. Zaktualizuj kontrakt danych dialogu:
    - rozszerz `AddToCollectionDialogData` o `initialCollectionIds: number[]`,
    - zmień `AddToCollectionDialogResult` na wariant multi-select (`saved/cancelled`).
2. Zaktualizuj miejsca otwierania dialogu:
    - `RecipeDetailPageComponent.onAddToCollection()`:
        - przekaż `initialCollectionIds: recipe.collection_ids ?? []`,
        - zmień snackbar na komunikat „Zapisano kolekcje…”.
    - `ExploreRecipeDetailPageComponent.onAddToCollection()` analogicznie.
3. Przebuduj UI dialogu:
    - dodaj pole „Szukaj kolekcji”,
    - zamień single-select listę na listę checkboxów,
    - zapewnij przewijanie listy wewnątrz modala,
    - ustaw większy rozmiar dialogu (np. `width`/`maxWidth`, `panelClass`).
4. Zaimplementuj stan dialogu na signalach:
    - `selectedCollectionIds` inicjalizowane pre-selekcją,
    - `filteredCollections` jako `computed`.
5. Zmień logikę tworzenia kolekcji:
    - utwórz kolekcję przez `POST /collections`,
    - dopnij ją lokalnie do listy i zaznacz,
    - nie przypisuj przepisu w tym kroku.
6. Dodaj integrację atomowego zapisu:
    - dodaj metodę serwisową na `PUT recipes/{id}/collections`,
    - wywołuj ją w `onSave()` z docelowym `collection_ids` (również puste).
7. Dodaj i dopracuj obsługę błędów oraz stany ładowania:
    - brak resetu zaznaczeń po błędzie,
    - blokady UI tylko podczas `isSaving` / `isCreatingCollection`,
    - komunikaty snackbar i ewentualne inline helpery.
8. Dopracuj UX desktop-first:
    - lista z własnym scroll,
    - czytelna stopka akcji,
    - brak „białych overlay” (jeśli potrzebny stan ładowania, użyć spinnera + `opacity` na kontenerze).
9. (Opcjonalnie) Dodaj testy jednostkowe komponentu:
    - pre-selekcja działa,
    - filtrowanie nie gubi zaznaczeń,
    - zapis wysyła poprawny payload (w tym `[]`),
    - nowa kolekcja jest dopinana i zaznaczana.


