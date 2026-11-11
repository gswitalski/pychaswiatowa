# PS-15 — Deployment Plan: Recipe Author on Detail View

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11  
**Runda:** R1

---

## Przegląd

Historyjka PS-15 nie wymaga migracji SQL ani konfiguracji infrastrukturalnych.  
Wdrożenie polega wyłącznie na deployu zmienionych plików TypeScript.

---

## 1. Kolejność implementacji

Kolejność jest wymuszona zależnościami typów:

```
Krok 1: shared/contracts/types.ts         ← brak zależności zewnętrznych
    ↓
Krok 2: explore.service.ts                ← lokalne typy (niezależne od shared w Deno)
Krok 2: recipes.service.ts                ← lokalne typy (niezależne od shared w Deno)
    ↓
Krok 3: recipe-header.component.ts        ← zależy od shared/contracts/types.ts (F1)
Krok 3: recipe-header.component.html      ← zależy od recipe-header.component.ts
    ↓
Krok 4: testy Deno                        ← po implementacji serwisów
Krok 4: testy Vitest Angular              ← po implementacji komponentu
```

> **Uwaga:** Kroki 2 (oba serwisy) i 3 (komponent) mogą być wykonywane równolegle  
> przez różnych implementerów.

---

## 2. Szczegółowy checklist wdrożenia

### Faza 1 — Kontrakt (shared/contracts/types.ts)

- [ ] Dodać `author: ProfileDto` do `RecipeDetailDto`
- [ ] Uruchomić `tsc --noEmit` w katalogu głównym — oczekiwane błędy TypeScript  
      w explore.service.ts i recipes.service.ts (brak pola `author` w zwracanym DTO)

### Faza 2 — Backend: explore.service.ts

- [ ] Dodać `tips` do `RECIPE_DETAIL_SELECT_COLUMNS`
- [ ] Dodać `tips: RecipeContent` do `RecipeDetailFullRow`
- [ ] Dodać `tips: RecipeContent` do lokalnego `RecipeDetailDto`
- [ ] Dodać `author: { id: string; username: string }` do lokalnego `RecipeDetailDto`
- [ ] Dodać helper `fetchAuthorProfile(client, userId)`
- [ ] Rozszerzyć `Promise.all` w gałęzi PUBLIC o `fetchAuthorProfile`
- [ ] Rozszerzyć `Promise.all` w gałęzi PRIVATE/SHARED owner o `fetchAuthorProfile`
- [ ] Zaktualizować sygnaturę i ciało `mapToDto` (dodać `author` i mapować `tips`)
- [ ] Zaktualizować oba wywołania `mapToDto` (dodać argument `author`)

### Faza 2 — Backend: recipes.service.ts

- [ ] Dodać `author: { id: string; username: string }` do lokalnego `RecipeDetailDto`
- [ ] Dodać helper `fetchAuthorProfile(userId)` z `createServiceRoleClient()`
- [ ] Rozszerzyć `Promise.all` w ścieżce happy-path o `fetchAuthorProfile(data.user_id)`
- [ ] Rozszerzyć `Promise.all` w ścieżce Step B / PUBLIC o `fetchAuthorProfile(publicRecipe.user_id)`
- [ ] Zaktualizować sygnaturę `mapToRecipeDetailDto` (dodać `author`)
- [ ] Zaktualizować ciało `mapToRecipeDetailDto` (dodać `author: author`)
- [ ] Zaktualizować oba wywołania `mapToRecipeDetailDto` (dodać argument `author`)

### Faza 3 — Frontend: RecipeHeaderComponent

- [ ] Dodać computed signal `authorLabel` do `recipe-header.component.ts`
- [ ] Dodać blok `@if (authorLabel())` do `recipe-header.component.html` (po porcjach, przed opisem)
- [ ] Opcjonalnie: dodać style `.recipe-author` do `recipe-header.component.scss`
- [ ] Uruchomić `tsc --noEmit` — brak błędów TypeScript

### Faza 4 — Testy

- [ ] Napisać `supabase/functions/explore/explore.service.test.ts` (nowy plik)
  - [ ] Test G1: PUBLIC przepis zwraca author + tips
  - [ ] Test G2: PRIVATE właściciel zwraca author
  - [ ] Test G3: brak profilu — fallback username=user_id
  - [ ] Test: błąd zapytania profilu → fallback, brak 500
- [ ] Dodać testy do `supabase/functions/recipes/recipes.service.test.ts`
  - [ ] Test G4: `getRecipeById` zwraca author.username
- [ ] Napisać/uzupełnić `recipe-header.component.spec.ts`
  - [ ] Test G5: wyświetla Autor: {username} z ikoną person
  - [ ] Test G6: nie renderuje sekcji gdy author.username = null
  - [ ] Test AC7: brak elementu `<a>` w sekcji autora
  - [ ] Test AC6: własny i cudzy przepis
  - [ ] Test AC4: PublicRecipeDetailDto w trybie isPublic=true

---

## 3. Weryfikacja kryteriów akceptacji

| AC | Sposób weryfikacji | Polecenie |
|---|---|---|
| AC1 | deno test dla explore.service | `deno test supabase/functions/explore/explore.service.test.ts` |
| AC2 | deno test dla explore.service | j.w. |
| AC3 | deno test dla recipes.service | `deno test supabase/functions/recipes/recipes.service.test.ts` |
| AC4, AC5, AC6, AC7 | Vitest Angular | `npm run test -- recipe-header` |
| AC8 | TypeScript build | `npm run build` lub `tsc --noEmit` |

---

## 4. Deploy

### Supabase Edge Functions

```bash
# Deploy zmienionych funkcji
supabase functions deploy explore
supabase functions deploy recipes
```

> Brak konieczności `supabase db push` — brak migracji SQL (NF3).

### Angular Frontend

```bash
# Build produkcyjny
npm run build

# Deploy (zgodnie z pipeline CI/CD projektu)
```

---

## 5. Weryfikacja po deployu na środowisku

### Test manualny (opcjonalny, nie E2E)

1. Otworzyć stronę `/explore/recipes/{id}-{slug}` dla przepisu PUBLIC
2. Sprawdzić wizualnie: sekcja "Autor: {username}" widoczna z ikoną person
3. Sprawdzić że username nie jest linkiem (brak `<a>`)
4. Otworzyć stronę `/recipes/{id}-{slug}` dla własnego przepisu
5. Sprawdzić wizualnie: sekcja "Autor: {username}" widoczna

### Weryfikacja API (opcjonalna)

```bash
# Sprawdź odpowiedź explore
curl -H "Authorization: Bearer TOKEN" \
  https://{project}.supabase.co/functions/v1/explore/recipes/{id}
# Oczekiwane: pole "author": {"id": "...", "username": "..."} i pole "tips": [...]

# Sprawdź odpowiedź recipes
curl -H "Authorization: Bearer TOKEN" \
  https://{project}.supabase.co/functions/v1/recipes/{id}
# Oczekiwane: pole "author": {"id": "...", "username": "..."}
```

---

## 6. Ryzyka i ograniczenia

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|---|---|---|
| RLS na tabeli `profiles` blokuje dostęp do profilu autora | Niskie | `fetchAuthorProfile` używa service-role; fallback na `user_id` |
| Profil autora nie istnieje (usunięty) | Bardzo niskie | Fallback `username = user_id` (UUID) — AC spełnione przez NF1 |
| Brak kolumny `tips` w widoku `recipe_details` na środowisku | Bardzo niskie | Migracja `20260112120100` potwierdza istnienie kolumny; deno test zweryfikuje |
| Błąd TypeScript przy `author` wymaganym w `RecipeDetailDto` | Pewne (kontrolowane) | Błędy TypeScript po Fazie 1 są oczekiwane i rozwiązywane w Fazie 2/3 |
| Zbyt długi username (UUID jako fallback) | Możliwe (edge case) | UI wyświetla UUID — akceptowalne per P3 |

---

## 7. Rollback

Brak migracji SQL — rollback polega na przywróceniu poprzednich wersji plików TypeScript:

```bash
git revert <commit-hash>
supabase functions deploy explore
supabase functions deploy recipes
npm run build && deploy
```

---

## 8. Podsumowanie zmian

| Plik | Rodzaj | Główna zmiana |
|---|---|---|
| `shared/contracts/types.ts` | Modyfikacja | `author: ProfileDto` w `RecipeDetailDto` |
| `supabase/functions/explore/explore.service.ts` | Modyfikacja | Fix `tips` + `author` + `fetchAuthorProfile` |
| `supabase/functions/recipes/recipes.service.ts` | Modyfikacja | `author` + `fetchAuthorProfile` (service-role) |
| `recipe-header.component.ts` | Modyfikacja | `authorLabel` computed signal |
| `recipe-header.component.html` | Modyfikacja | Sekcja `@if (authorLabel())` |
| `explore.service.test.ts` | Nowy plik | Testy G1, G2, G3 |
| `recipes.service.test.ts` | Modyfikacja | Test G4 |
| `recipe-header.component.spec.ts` | Nowy/modyfikacja | Testy G5, G6, AC6, AC7 |

**Brak zmian w:** komponentach stron, serwisach Angular, migracjach SQL, konfiguracji infrastruktury.
