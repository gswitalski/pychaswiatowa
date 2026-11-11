# PS-15 — Review API (r1)

**Slug:** `recipe-author-on-detail-view`  
**Zakres:** `api-db`, `api-code`, `api-tests`  
**Data:** 2026-11-11  
**Reviewer:** orkiestrator (subagent `ps-code-reviewer` dwukrotnie przerwany)

## Werdykt: ZMIANY_WYMAGANE

## api-db

Brak zmian SQL — zgodne z NF3. Brak migracji, RLS, RPC.

## api-code

| Ocena | Uwaga |
|---|---|
| OK | `shared/contracts/types.ts` — wymagane `author: ProfileDto` w `RecipeDetailDto`. |
| OK | `explore.service.ts` — `tips` w SELECT, `fetchAuthorProfile(client, userId)` z fallbackiem, `author` w `mapToDto`, service-role client. |
| OK | `recipes.service.ts` — `fetchAuthorProfile(client, userId)`; Step A → `client`, Step B PUBLIC → `serviceClient`; `author` w `mapToRecipeDetailDto`. |
| Info | `explore` mapuje `tips: recipe.tips ?? []` (nie `parseRecipeContent` jak recipes) — akceptowalne, jeśli JSONB ma poprawny kształt z widoku. |

## api-tests

| Ocena | Uwaga |
|---|---|
| **Krytyczne** | Brak `supabase/functions/explore/explore.service.test.ts` (G1–G3 z historyjki). |
| **Krytyczne** | Brak rozszerzenia `recipes.service.test.ts` dla G4 / `author`. |
| Środowisko | `deno test` — `NIE_WYKONANO` (brak lokalnego Deno). |

## Pokrycie AC (API)

| AC | Status |
|---|---|
| AC1, AC2 (explore) | Kod — **niesprawdzone** testami |
| AC3 (recipes) | Kod — **niesprawdzone** testami |
| AC8 (build TS) | **PASS** (`npm run build`) |

## Wymagane przed akceptacją API

1. Dodać testy Deno zgodnie z planem implementacji (mock client + `fetchAuthorProfile` / ścieżki detail).
2. Uruchomić `deno test` (lokalnie lub CI `validate-backend`) i zaktualizować artefakt `verification`.
