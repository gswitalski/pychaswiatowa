# Changelog project-summary — PS-31

**Workflow:** `LOCAL-recipe-private-note`  
**Data:** 2026-11-08

## Zmiany w `docs/results/project-summary.md`

1. Nagłówek aktualizacji — PS-31.
2. Sekcja §0 — akapit **Prywatna notatka przy przepisie (PS-31)** (API, RLS, UI, zakres vs SHARED w kolekcji).
3. Backlog Jira — usunięto PS-31 z „Do zrobienia”.
4. Granice produktu — doprecyzowano notatkę przy SHARED w kolekcji jako osobną story.
5. Tabela historyjek — wiersz PS-31.
6. API — `PUT /recipes/{id}/note`, `my_note?` na GET szczegółów.
7. Widoki — explore/recipes i recipes szczegóły + komponent współdzielony.
8. Plan testów — scenariusz 13 (PS-31).

## Uwaga wdrożeniowa

Summary opisuje stan **kodu lokalnego**; migracja `20261108120000_create_user_recipe_notes.sql` nie była stosowana na produkcji w ramach tego workflow.
