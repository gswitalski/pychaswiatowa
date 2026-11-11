# PS-15 — Weryfikacja implementacji API

**Slug:** `recipe-author-on-detail-view`  
**Data:** 2026-11-11  
**Zakres:** `ps-implement-api`  
**Status implementacji:** `WYMAGA_WERYFIKACJI`

## Zmienione pliki

- `shared/contracts/types.ts`
- `supabase/functions/explore/explore.service.ts`
- `supabase/functions/recipes/recipes.service.ts`

Nie dodano migracji SQL, zmian RLS ani RPC — zgodnie z NF3.

## Weryfikacja

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| Preflight Deno/Supabase/Docker | TAK | FAIL | Supabase CLI i Docker są dostępne; Deno nie jest zainstalowane. |
| Migracja lokalna/RLS/RPC | NIE | NIE_WYKONANO | Brak zmian SQL w PS-15; nie uruchomiono lokalnego stosu Supabase. |
| Generowanie typów | NIE | NIE_WYKONANO | Brak lokalnego generowania typów; kontrakt zaktualizowano ręcznie. |
| `deno check` / `deno test` | NIE | NIE_WYKONANO | Brak Deno; testy Edge Functions nie zostały uruchomione. |
| Smoke test workera | NIE | NIE_WYKONANO | PS-15 nie zmienia workera. |
| `npm run build` | TAK | PASS | Ostrzeżenia budżetu SCSS i CommonJS pozostają istniejące/nieblokujące. |
| `npm run test:run -- --passWithNoTests` | TAK | PASS | 2026-11-11: 361 testów PASS (exit 0). |
| `npm run build` (powtórka) | TAK | PASS | 2026-11-11: bundle OK (~43 s). |
| Linter zmienionych plików | TAK | PASS | Brak diagnostyki lintera. |

## Checklist planu

- ZROBIONE — dodano `author: ProfileDto` do współdzielonego `RecipeDetailDto`.
- ZROBIONE — `explore.service.ts` pobiera `tips` i mapuje je z fallbackiem `[]`.
- ZROBIONE — `explore.service.ts` pobiera profil autora w obu ścieżkach dostępu.
- ZROBIONE — `recipes.service.ts` pobiera profil autora równolegle w Step A.
- ZROBIONE — `recipes.service.ts` pobiera profil autora przez `serviceClient` w Step B/PUBLIC.
- ZROBIONE — dodano fallback autora `{ id: userId, username: userId }` dla błędów/braku profilu.
- ZROBIONE — zaktualizowano mapowanie DTO w obu serwisach.
- POMINIĘTE — testy Deno G1–G4; Deno nie jest zainstalowane, a istniejące testy nie mają przygotowanych mocków dla pełnych ścieżek detail.
- POMINIĘTE — migracje/RLS/RPC; PS-15 nie wymaga zmian SQL.
- POMINIĘTE — testy UI G5–G6 i zmiany komponentu Angular; należą do zakresu `ps-implement-view`, nie implementacji API.


## 2026-11-11 12:25 ps-api-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check / deno test | NIE_WYKONANO |
| npm run lint | PASS |
| npm run test:run | PASS |
| npm run build | PASS |

## 2026-11-11 12:29 ps-view-implementer

| Weryfikacja | Wynik |
|---|---|
| deno check / deno test | NIE_WYKONANO |
| npm run lint | PASS |
| npm run test:run | PASS |
| npm run build | PASS |
