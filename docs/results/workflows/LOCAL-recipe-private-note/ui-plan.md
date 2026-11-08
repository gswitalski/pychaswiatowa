# PS-31: Prywatna notatka użytkownika przy przepisie — Plan UI

> **User Story:** `user-story.md` (workflow `LOCAL-recipe-private-note`)  
> **Data:** listopad 2026  
> **Stack:** Angular 21, Angular Material, Sass  
> **Powiązane:** `api-plan.md`, `manual-deployment-plan.md`

---

## 1. Wymagania funkcjonalne (widoki)

| ID | Zadanie |
|---|---|
| UI-1 | Sekcja „Moja notatka" na szczegółach przepisu — tylko zalogowany. |
| UI-2 | `textarea` wieloliniowy, licznik znaków (max 2000), przycisk „Zapisz". |
| UI-3 | Snackbar sukcesu / błędu (wzorzec PS-99 / flag). |
| UI-4 | Wczytanie `my_note` z API przy wejściu na szczegóły; po zapisie aktualizacja stanu rodzica. |
| UI-5 | Gość: brak sekcji (bez pustego placeholdera). |
| UI-6 | Testy jednostkowe komponentu i serwisu. |

**Trasy bez zmian:** `/recipes/:id-:slug`, `/explore/recipes/:id-:slug` (`PUBLIC`).  
**Warunek UI:** sekcja dla zalogowanych po udanym `GET` szczegółów (reguła dostępu jak PS-95 — bez rozszerzenia kolekcji).  
**Poza zakresem:** kafelki list, autosave, Markdown, podgląd na dashboardzie.

---

## 2. Podsumowanie zmian (pliki)

| Element | Typ | Ścieżka |
|---|---|---|
| `RecipeNoteService` | **Nowy** | `src/app/core/services/recipe-note.service.ts` |
| `RecipePersonalNoteComponent` (`pych-recipe-personal-note`) | **Nowy** | `src/app/shared/components/recipe-personal-note/` |
| `RecipeDetailViewComponent` | **Modyfikacja** | wstawienie sekcji notatki w `recipe-detail-view.component.html` |
| `RecipeDetailPageComponent` | **Modyfikacja** | obsługa `noteChange`, synchronizacja `recipe()` po zapisie |
| `ExploreRecipeDetailPageComponent` | **Modyfikacja** | j.w. |
| `shared/contracts/types.ts` | Modyfikacja | opis w planie API |
| Testy | **Nowe** | `recipe-note.service.spec.ts`, `recipe-personal-note.component.spec.ts` |

---

## 3. Umiejscowienie w interfejsie

**Widok:** `RecipeDetailViewComponent` (wspólny dla prywatnego i explore).

**Lokalizacja:** w kolumnie `.recipe-details`, **po** sekcji „Wskazówki" (jeśli są) lub po „Krokach przygotowania", gdy brak wskazówek — nad CTA gościa.

```html
@if (isAuthenticated()) {
    <pych-recipe-personal-note
        [recipeId]="recipe()!.id!"
        [myNote]="recipe()!.my_note ?? null"
        (noteChange)="noteChange.emit($event)"
        (sessionExpired)="noteSessionExpired.emit()"
    />
}
```

**Układ sekcji (desktop):**

- Nagłówek: **Moja notatka** (`h2` / `mat-card-title`, spójne z `pych-recipe-content-list`).
- Krótki opis pomocniczy (opcjonalnie, jedna linia): „Widoczne tylko dla Ciebie."
- `mat-form-field` `appearance="outline"`, `textarea` min. 4 wiersze, `maxlength="2000"`.
- `mat-hint` / licznik: `{{ length }} / 2000`.
- Przycisk `mat-raised-button` „Zapisz", `disabled` gdy: zapis w toku, treść identyczna jak zapisana, lub walidacja nie przechodzi.
- Podczas zapisu: spinner na przycisku lub `disabled` + `aria-busy="true"`.

**Mobile:** pełna szerokość kolumny treści; przycisk pod polem (nie w headerze akcji).

**Gość:** warunek `isAuthenticated()` — sekcja nie renderuje się (scenariusz 5).

---

## 4. `RecipePersonalNoteComponent`

**Selektor:** `pych-recipe-personal-note`  
**Change detection:** `OnPush`

**Wejścia:**

| Input | Typ | Opis |
|---|---|---|
| `recipeId` | `number` (required) | ID przepisu |
| `myNote` | `string \| null` | Stan z API (źródło prawdy po load / sukcesie) |

**Wyjścia:**

| Output | Typ | Opis |
|---|---|---|
| `noteChange` | `RecipeNoteDto` | Po udanym `PUT` — rodzic aktualizuje `recipe` |
| `sessionExpired` | `void` | Po `401` — jak flagi/oceny |

**Zachowanie:**

1. Lokalny `linkedSignal` / `signal` na treść edytowaną, synchronizowany z `myNote` input.
2. **Bez optimistic update** (historyjka: przycisk Zapisz) — UI czeka na `200`, potem emit `noteChange` i snackbar „Notatka została zapisana".
3. Błąd sieci/5xx: snackbar „Nie udało się zapisać notatki. Spróbuj ponownie." — treść w polu **zostaje** (scenariusz 8).
4. Walidacja klienta: blokada zapisu przy > 2000 znaków + komunikat `mat-error`.
5. Zapis pustej treści po wcześniejszej notatce: wysyłka `{ note: null }` lub `""` zgodnie z API; snackbar „Notatka została usunięta" (opcjonalnie ten sam komunikat co zapis — do ustalenia przy implementacji).

**Dostępność:**

- `textarea`: `aria-label="Moja prywatna notatka do przepisu"`.
- Przycisk: `aria-label="Zapisz notatkę"`.
- Komunikat błędu limitu powiązany z polem (`aria-describedby`).

---

## 5. `RecipeNoteService`

Wzorzec jak `RecipeRatingService` / `RecipeFlagsService`:

```typescript
updateNote(recipeId: number, note: string | null): Observable<RecipeNoteDto> {
    return from(
        this.supabase.functions.invoke<RecipeNoteDto>(
            `recipes/${recipeId}/note`,
            { method: 'PUT', body: { note } satisfies UpdateRecipeNoteCommand },
        ),
    ).pipe(/* map error, data */);
}
```

- Tylko `SupabaseService.functions.invoke` — **bez** `.from()` / `.rpc()` w frontendzie.
- Mapowanie błędów na komunikaty użytkowe tam, gdzie API zwraca znany kod (`NOTE_TOO_LONG`).

---

## 6. Integracja ze stronami szczegółów

**`RecipeDetailPageComponent` / `ExploreRecipeDetailPageComponent`:**

- Dodać `onNoteChange(dto: RecipeNoteDto)`: `recipe.update(r => r ? { ...r, my_note: dto.my_note } : r)`.
- `onNoteSessionExpired()`: ten sam flow co `flagsSessionExpired` / `ratingSessionExpired` (redirect login).

**`RecipeDetailViewComponent`:**

- Nowe outputy: `noteChange`, `noteSessionExpired`.
- Przekazanie w template (patrz pkt 3).

**Ładowanie danych:** istniejące `GET` szczegółów — po wdrożeniu API mapować `my_note` w DTO (bez dodatkowego requestu).

---

## 7. Stylowanie

- Plik `recipe-personal-note.component.scss`:
  - Odstęp `margin-top` zgodny z odległością między sekcjami list składników/kroków.
  - Tło opcjonalnie `var(--mat-sys-surface-container-low)` w `mat-card` — delikatne odróżnienie od treści autora.
  - Ikona opcjonalna `sticky_note_2` w nagłówku (Material Symbols).
- Kolorystyka: wyłącznie tokeny `--mat-sys-*`.

---

## 8. Testy jednostkowe (plan)

**`RecipeNoteService`:**

- Poprawne wywołanie `invoke` z ścieżką i body.
- Obsługa `error` z Supabase client.

**`RecipePersonalNoteComponent`:**

- Render tylko gdy rodzic podaje `recipeId`.
- Disabled „Zapisz" przy braku zmian.
- Wywołanie serwisu po kliknięciu; emit `noteChange` po sukcesie.
- Komunikat przy przekroczeniu 2000 znaków.

**Rozszerzenie (opcjonalnie):** snapshot / test integracji z `RecipeDetailViewComponent` — jeden test, że sekcja jest pod wskazówkami.

---

## 9. Teksty UI (propozycja)

| Klucz | Tekst PL |
|---|---|
| Tytuł sekcji | Moja notatka |
| Podtytuł | Widoczne tylko dla Ciebie. |
| Placeholder | np. „Zamienniki, czas w Twojej kuchni, uwagi na następnym razie…" |
| Przycisk | Zapisz |
| Sukces | Notatka została zapisana |
| Usunięcie | Notatka została usunięta |
| Błąd | Nie udało się zapisać notatki. Spróbuj ponownie. |
| Walidacja długości | Notatka może mieć co najwyżej 2000 znaków |

---

## 10. Regresja wizualna

Po wdrożeniu sprawdzić na szczegółach (owner + explore):

- Flagi PS-95, oceny PS-99, CTA kolekcja/plan, chipy metadanych, zdjęcie, listy składników — **bez zmian layoutu**.
- Wąski viewport 360 px: textarea i przycisk nie nachodzą na header.
