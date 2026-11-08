# View Implementation Plan: PS-31 — Prywatna notatka użytkownika przy przepisie

> **Wejścia:** `user-story.md`, `ui-plan.md`, `api-plan.md`, `api-implementation-plan.md`  
> **Stack:** Angular 21 standalone, Signals, Material, Vitest  
> **Workflow:** `LOCAL-recipe-private-note`

---

## 1. Przegląd

Sekcja **„Moja notatka"** na wspólnym widoku szczegółów przepisu dla zalogowanych użytkowników. Dane z `RecipeDetailDto.my_note`; zapis przez `PUT /recipes/{id}/note`. Dotyczy tras `/recipes/...` i `/explore/recipes/...`, gdy istniejący `GET` szczegółów zwraca przepis (własny lub `PUBLIC` — jak PS-95). **Bez** obsługi cudzego `SHARED` z kolekcji w PS-31.

---

## 2. Routing

| Ścieżka | Strona | Uwagi |
|---|---|---|
| `/recipes/:id-:slug` | `RecipeDetailPageComponent` | Własne + cudze po regule dostępu |
| `/explore/recipes/:id-:slug` | `ExploreRecipeDetailPageComponent` | Zwykle `PUBLIC` |

Brak nowych tras, guardów ani resolverów.

---

## 3. Struktura komponentów

```text
RecipeDetailPageComponent / ExploreRecipeDetailPageComponent
└── RecipeDetailViewComponent
    ├── … (flagi, rating, treść)
    └── RecipePersonalNoteComponent (pych-recipe-personal-note)  [NOWY]
        └── RecipeNoteService  [NOWY, core]
```

---

## 4. `RecipeNoteService`

**Plik:** `src/app/core/services/recipe-note.service.ts`  
**Wzorzec:** `RecipeFlagsService` / `RecipeRatingService`

- `updateNote(recipeId: number, note: string | null): Observable<RecipeNoteDto>`
- `functions.invoke('recipes/${recipeId}/note', { method: 'PUT', body: { note } })`
- Mapowanie błędów HTTP na `Error & { status: number }` (jak flagi)
- Spec: `recipe-note.service.spec.ts` (Vitest + mock `SupabaseService`)

---

## 5. `RecipePersonalNoteComponent`

**Plik:** `src/app/shared/components/recipe-personal-note/`  
**CD:** `OnPush`, **standalone**, selektor `pych-recipe-personal-note`

| Input | Typ |
|---|---|
| `recipeId` | `input.required<number>()` |
| `myNote` | `input<string \| null>(null)` |

| Output | Typ |
|---|---|
| `noteChange` | `output<RecipeNoteDto>()` |
| `sessionExpired` | `output<void>()` |

**Stan wewnętrzny:**

- `draft = linkedSignal(() => this.myNote() ?? '')`
- `savedSnapshot` — ostatnia zapisana treść (do `disabled` na „Zapisz")
- `saving = signal(false)`

**Interakcje:**

1. Użytkownik edytuje textarea (`maxlength="2000"`, licznik w `mat-hint`).
2. „Zapisz" — jeśli `draft().trim().length === 0` → `note: null`, inaczej `note: draft().trim()`.
3. Sukces → `noteChange.emit`, snackbar „Notatka została zapisana" / „…usunięta".
4. Błąd → snackbar błędu, **bez** czyszczenia pola.
5. `401` → `sessionExpired.emit()`.

**Material:** `MatFormField`, `MatInput`, `MatButton`, `MatSnackBar` (przez wzorzec z istniejących komponentów — `inject(MatSnackBar)` lub helper projektu).

**a11y:** `aria-label` na textarea i przycisku; `mat-error` przy > 2000 znaków.

---

## 6. Zmiany `RecipeDetailViewComponent`

**TS:** outputy `noteChange`, `noteSessionExpired`.

**HTML:** po bloku wskazówek w `.recipe-details`:

```html
@if (isAuthenticated()) {
    <pych-recipe-personal-note … />
}
```

Import komponentu w `imports` tablicy standalone.

---

## 7. Strony szczegółów

**`recipe-detail-page.component.ts` / `explore-recipe-detail-page.component.ts`:**

```typescript
onNoteChange(dto: RecipeNoteDto): void {
    this.recipe.update((r) => (r ? { ...r, my_note: dto.my_note } : r));
}
onNoteSessionExpired(): void {
    this.onFlagsSessionExpired(); // lub wspólny helper sesji
}
```

Template: podłączyć `(noteChange)` i `(noteSessionExpired)`.

**Mapowanie GET:** upewnić się, że istniejące serwisy strony nie filtrują nieznanych pól — `my_note` przejdzie z API po wdrożeniu backendu.

---

## 8. Typy

W `shared/contracts/types.ts` (wdrożenie razem z API):

- `RecipeNoteDto`, `UpdateRecipeNoteCommand`
- `my_note?: string | null` w `RecipeDetailDto`

Frontend nie definiuje duplikatów lokalnych.

---

## 9. Testy (Vitest)

| Plik | Zakres |
|---|---|
| `recipe-note.service.spec.ts` | invoke path, body, błędy |
| `recipe-personal-note.component.spec.ts` | disabled gdy brak zmian, emit po sukcesie, maxlength |
| Rozszerzenie spec strony (opcjonalnie) | propagacja `my_note` po `onNoteChange` |

---

## 10. Mapowanie historyjki → UI

| Scenariusz US | Implementacja |
|---|---|
| 1–3 | Zapis / edycja / wyczyszczenie |
| 4 | Explore + `my_note` |
| 4b | `/recipes/...` na własnym przepisie (dowolna visibility) |
| 5 | `@if (isAuthenticated())` |
| 6 | maxlength + API 422 |
| 8 | snackbar błędu, draft zostaje |

---

## 11. Kroki implementacji (kolejność)

1. Kontrakty w `types.ts` (po merge z backendem lub w jednym PR).
2. `RecipeNoteService` + spec.
3. `RecipePersonalNoteComponent` (+ scss) + spec.
4. `RecipeDetailViewComponent` + strony szczegółów.
5. Ręczna regresja: flagi, oceny, mobile 360px.

**Poza zakresem:** autosave, markdown, podgląd na listach.
