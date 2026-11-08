# Independent review — plany PS-31 (LOCAL-recipe-private-note)

**Data (ponowny przegląd):** 2026-11-08  
**Zakres:** `user-story.md`, `api-plan.md`, `api-implementation-plan.md`, `ui-plan.md`, `ui-implementation-plan.md`, `manual-deployment-plan.md`, `requirements-analysis.md`

## Decyzja produktowa (zatwierdzona)

PS-31 **nie** rozszerza API kolekcji ani dostępu do cudzego `SHARED` w kolekcji. Reguła dostępu do notatki = **PS-95** (właściciel lub `PUBLIC`). Scenariusz SHARED+w kolekcja → osobna User Story.

## Werdykt

**Gotowe do implementacji** — plany są spójne z migracją (`security invoker`, RLS, brak `security definer` / `recipe-access.ts`).

## Ustalenia (bez blockerów)

| Obszar | Status |
|---|---|
| RLS + RPC invoker | Zgodne z kodem migracji |
| Brak notatek innych użytkowników | PK `(user_id, recipe_id)` + polityki |
| Router `PUT …/note` | Wymagany w implementacji (plan API §4) |
| Testy prywatności / 404 dla niedostępnych | W qa-report po wdrożeniu |
| SHARED w kolekcji | Wyłączone z PS-31 — dokumentacja zaktualizowana |

## Warunki jakości (nie-blocker)

- Nie logować treści notatki na `info`.
- Vitest dla `RecipeNoteService` + Deno dla `setRecipeNote`.
- Regresja flag/ocen na widoku szczegółów.

## Historia

- Wcześniejszy review wskazywał blocker przy regule C (`SHARED` + kolekcja, `security definer`). Po decyzji produktowej usunięto tę zależność z planów.
