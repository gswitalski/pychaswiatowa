# PS-91: Uzupełnianie metadanych przepisu przez AI podczas importu z tekstu lub obrazu — Plan UI

> **User Story:** PS-91 — Uzupełnianie metadanych przepisu przez AI podczas importu z tekstu lub obrazu
> **Data:** październik 2026
> **Stack:** Angular 21, Angular Material, Sass

---

## 1. Podsumowanie zmian

Funkcja nie wprowadza nowych widoków, tras, komponentów ani dialogów. Zmiana dotyczy wyłącznie **mapowania draftu AI na istniejący formularz przepisu** oraz typów danych.

| Element | Typ | Ścieżka |
|---|---|---|
| `AiRecipeDraftDto` | Modyfikacja typu (8 nowych pól) | `shared/contracts/types.ts` |
| `populateFormFromDraft` | Modyfikacja metody | `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts` |
| `recipe-form-page.component.spec.ts` | Rozszerzenie testów jednostkowych | `src/app/pages/recipes/recipe-form/` |
| Ekran asysty AI `/recipes/new/assist` | **Bez zmian** | `src/app/pages/recipes/recipe-new-assist/` |
| `AiRecipeDraftService` (żądanie do API) | **Bez zmian** | `src/app/pages/recipes/services/ai-recipe-draft.service.ts` |
| `RecipeDraftStateService` | **Bez zmian** (przenosi cały obiekt `draft`) | `src/app/pages/recipes/services/recipe-draft-state.service.ts` |
| Walidatory formularza | **Bez zmian** | `recipe-form-page.component.ts` |

**Poza zakresem:** oznaczanie pól jako „wywnioskowane przez AI”, import Markdown (`/recipes/import`), edycja istniejącego przepisu, nowy UI dla `meta.warnings`.

---

## 2. Istniejący formularz — pola docelowe

Formularz (`/recipes/new`, tryb tworzenia po przejściu z `/recipes/new/assist`) ma już kontrolki dla wszystkich ośmiu metadanych:

| Pole draftu (API) | Kontrolka formularza | Typ kontrolki | Walidacja (istniejąca) |
|---|---|---|---|
| `servings` | `servings` | `number \| null` | min 1, max 99, liczba całkowita |
| `prep_time_minutes` | `prepTimeMinutes` | `number \| null` | min 0, max 999, liczba całkowita |
| `total_time_minutes` | `totalTimeMinutes` | `number \| null` | min 0, max 999, liczba całkowita |
| `diet_type` | `dietType` | `RecipeDietType \| null` | — |
| `cuisine` | `cuisine` | `RecipeCuisine \| null` | — |
| `difficulty` | `difficulty` | `RecipeDifficulty \| null` | — |
| `is_termorobot` | `isTermorobot` | `boolean` (nonNullable, domyślnie `false`) | — |
| `is_grill` | `isGrill` | `boolean` (nonNullable, domyślnie `false`) | — |

Walidator na poziomie grupy `timeRelationValidator` (`totalTimeMinutes ≥ prepTimeMinutes`) działa jak dotychczas i nie wymaga zmian.

---

## 3. Zmiana mapowania draftu na formularz

**Plik:** `src/app/pages/recipes/recipe-form/recipe-form-page.component.ts`
**Metoda:** `populateFormFromDraft(draft: AiRecipeDraftDto)`

### Zasady mapowania

1. Nowe pola są ustawiane jednym `patchValue` razem z dotychczasowymi polami podstawowymi (`name`, `description`), co uruchamia walidatory (w tym `timeRelationValidator`).
2. Wartość `null` lub `undefined` w drafcie oznacza **pozostawienie stanu początkowego kontrolki**: puste pole dla liczb i selectów, `false` dla przełączników. Nie ustawiamy wartości domyślnych.
3. Flagi: `draft.is_termorobot === true` oraz `draft.is_grill === true` → `true`; każda inna wartość (w tym brak) → `false`.
4. Obsługa draftów niepełnych (np. wygenerowanych przed wdrożeniem PS-91 albo bez części pól): brak właściwości jest traktowany jak `null`. Draft jest przechowywany wyłącznie w pamięci (sygnały w `RecipeDraftStateService`, TTL 10 min), więc nie ma starych wersji po stronie klienta — zabezpieczenie dotyczy tylko spójności typów i odpowiedzi API z ominięciem pola.
5. Frontend **nie** ponawia walidacji zakresów ani enumów — robi to backend (`normalizeDraftMetadata`). Ewentualna wartość niepoprawna zostanie zgłoszona przez istniejące walidatory formularza przy zapisie.
6. Wartość `cuisine = null` nie zgłasza błędu i nie ustawia wartości domyślnej.

### Pseudokod

```typescript
private populateFormFromDraft(draft: AiRecipeDraftDto): void {
    this.form.patchValue({
        name: draft.name || '',
        description: draft.description || '',
        servings: draft.servings ?? null,
        prepTimeMinutes: draft.prep_time_minutes ?? null,
        totalTimeMinutes: draft.total_time_minutes ?? null,
        dietType: draft.diet_type ?? null,
        cuisine: draft.cuisine ?? null,
        difficulty: draft.difficulty ?? null,
        isTermorobot: draft.is_termorobot === true,
        isGrill: draft.is_grill === true,
    });

    // ... dotychczasowa logika: składniki, kroki, wskazówki, tagi, kategoria (bez zmian)
}
```

### Czego nie zmieniamy

- Przepływ: `/recipes/new/assist` → `RecipeDraftStateService.setDraft()` → `/recipes/new` → `consumeDraft()` → `populateFormFromDraft()`.
- Mapowanie kategorii (`pendingDraft` / `applyDraftCategoryMapping`) — zachowane bez zmian.
- Zapis przepisu: `POST /recipes` wysyła wartości **z formularza** (edytowane przez użytkownika), a nie z oryginalnego draftu.

---

## 4. Zmiana typów

**Plik:** `shared/contracts/types.ts` — `AiRecipeDraftDto`

Dodanie ośmiu pól zgodnie z planem API: `servings`, `prep_time_minutes`, `total_time_minutes`, `diet_type`, `cuisine`, `difficulty`, `is_termorobot`, `is_grill` (typy: `number | null`, `RecipeDietType | null`, `RecipeCuisine | null`, `RecipeDifficulty | null`, `boolean`).

> Po rozszerzeniu typu należy zaktualizować istniejące mocki `AiRecipeDraftDto` w testach (`*.spec.ts`), tak aby kompilowały się z nowymi wymaganymi polami.

---

## 5. Zachowanie użytkownika (UX)

Przepływ użytkownika nie zmienia się — zmienia się stopień wypełnienia formularza po przejściu z asysty.

| Krok | Dotychczas | Po PS-91 |
|---|---|---|
| 1. Użytkownik wkleja tekst/obraz w `/recipes/new/assist` i klika generowanie | Bez zmian | Bez zmian |
| 2. Nawigacja do `/recipes/new` | Wypełnione: nazwa, opis, składniki, kroki, wskazówki, kategoria, tagi | Dodatkowo: liczba porcji, czasy, dieta, kuchnia, trudność, przełączniki Termorobot i Grill |
| 3. Weryfikacja i edycja | Użytkownik ręcznie uzupełnia metadane | Użytkownik sprawdza i poprawia gotowe wartości |
| 4. Zapis | `POST /recipes` | Bez zmian; zapisane są wartości z formularza |

### Stany interfejsu

| Stan | Zachowanie formularza |
|---|---|
| Draft z kompletem metadanych | Wszystkie kontrolki wypełnione; przełączniki zgodne z flagami |
| Draft z `cuisine = null` | Select „Kuchnia” pusty, pozostałe pola wypełnione, brak komunikatu błędu |
| Draft z częścią `null` (np. brak czasów) | Odpowiednie pola puste; walidacja relacji czasów nie jest uruchamiana, gdy brakuje jednej z wartości |
| Draft z `meta.warnings` | Bez nowych elementów UI (ostrzeżenia pozostają w odpowiedzi API/logach) |
| Użytkownik zmienia dowolne pole | Zapisana jest wartość z formularza |
| Wartość niepoprawna (teoretycznie) | Istniejące komunikaty walidacji pod polem (porcje 1–99, czasy 0–999, całkowity ≥ przygotowania) |

---

## 6. Responsywność i dostępność

Brak nowych elementów interfejsu, więc brak zmian w układzie (desktop ≥960px / mobile <960px) ani w a11y. Istniejące kontrolki zachowują swoje etykiety, `aria-*` i komunikaty walidacji.

---

## 7. Testy jednostkowe (frontend, Vitest)

Zakres: wyłącznie testy jednostkowe (bez E2E).

**Plik:** `src/app/pages/recipes/recipe-form/recipe-form-page.component.spec.ts` (rozszerzenie)

| Scenariusz historyjki | Test |
|---|---|
| 1, 4, 6 | Draft z kompletem metadanych → kontrolki `servings`, `prepTimeMinutes`, `totalTimeMinutes`, `dietType`, `cuisine`, `difficulty`, `isTermorobot`, `isGrill` mają wartości z draftu |
| 2, 3, 5 | Draft z częścią wartości → wszystkie wartości z draftu są przepisane do formularza (w tym wnioskowane) |
| 9 | Po zmianie wartości w formularzu (porcje, dieta, przełącznik Grill) `POST /recipes` (mock serwisu) otrzymuje wartości edytowane, a nie z draftu |
| 9 | Walidacje: porcje 0 i 100, czas 1000, całkowity < przygotowania → błędy walidacji jak dotychczas |
| 10 | Draft z `cuisine = null` → kontrolka `cuisine` pozostaje `null`, formularz bez błędu w tym polu |
| — | Draft z `null` dla liczb i enumów → kontrolki `null`; flagi `false` |
| — | Draft bez nowych właściwości (`undefined`) → brak wyjątku, wartości domyślne formularza |
| — | Dotychczasowe mapowanie (nazwa, składniki, kroki, wskazówki, tagi, kategoria) działa bez regresji |

Dodatkowo: aktualizacja istniejących mocków `AiRecipeDraftDto` w innych testach (`recipe-new-assist`, `recipe-draft-state`), jeśli kompilacja tego wymaga.

> Testy backendowe (schemat, normalizacja, prompt) opisane są w planie API (sekcja 6).

---

## 8. Dokumentacja do aktualizacji

| Dokument | Zmiana |
|---|---|
| `docs/results/project-summary.md` | US-036 / ekran kreatora AI: draft wypełnia także porcje, czasy, dietę, kuchnię, trudność i flagi Termorobot/Grill |
