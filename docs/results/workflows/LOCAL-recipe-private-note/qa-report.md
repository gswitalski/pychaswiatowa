# Raport QA — PS-31 (LOCAL-recipe-private-note)

**Ostatnia aktualizacja:** 2026-11-08 (poprawka: błąd odczytu notatki ≠ brak notatki; ponowne bramki i review)
**Środowisko:** lokalne (lokalny Supabase `pychaswiatowa`, DB 127.0.0.1:54332; bez migracji zdalnych, bez deployu, bez `db reset`)
**Status:** zaimplementowane lokalnie (nie wdrożone produkcyjnie)

## Decyzja produktowa (regresja zakresu)

Reguła dostępu = **PS-95** (właściciel lub `PUBLIC`). Brak rozszerzenia kolekcji / cudzego `SHARED`.

## Zakres (scope)

- `scope.baseRef` = `f870b94d2ccaad617477f726d75be2c5b34c5b5c` (= HEAD; nic z PS-31 nie jest zacommitowane).
- `scope.paths` = `src/`, `shared/`, `supabase/`, `vitest.config.ts`, `tsconfig.spec.json` → 30 plików (dodane dwa pliki konfiguracji testów zmienione w tej poprawce).
- Wymagane bramki: angularBuild, vitest, localMigration, localApi, codeReview, rlsReview.

## Poprawka: błąd odczytu notatki nie może udawać braku notatki

**Problem (dawne Minor #3, traktowane jako Major):** `getRecipeNoteForUser` przy błędzie zwracał `null`, więc UI pokazywał pustą notatkę, a kolejny zapis nadpisałby istniejącą treść.

**Analiza odczytu `my_note`:** jedyny odczyt tabeli to `getRecipeNoteForUser` (`_shared/recipe-notes.ts`), używany w 5 miejscach: `recipes.service.ts` ×2, `explore.service.ts` ×2, `public.service.ts` ×1; wynik trafiał przez `buildNoteFields` do DTO jako `my_note ?? null`.

**Rozwiązanie:**
- Backend: `getRecipeNoteForUser` zwraca `RecipeNoteLookup` = `{status:'ok', note}` albo `{status:'unavailable'}` (błąd zapytania lub wyjątek → `unavailable`). `buildNoteFields`: gość → `{}`; `ok` → `{my_note}` (`null` = naprawdę brak notatki); `unavailable`/brak lookupu przy zalogowanym → `{my_note_unavailable: true}` bez klucza `my_note`. Nowe opcjonalne pole `my_note_unavailable?: true` w DTO (`shared/contracts/types.ts` oraz DTO serwisów). Przepis nadal się wyświetla — degradacja dotyczy tylko notatki.
- Angular: `RecipePersonalNoteComponent` ma input `noteUnavailable`; `isUnavailable = noteUnavailable() || myNote() === undefined` (fail-safe: brak pola z backendu też blokuje) → textarea `disabled`, `canSave()` fałszywe, `saveNote()` wraca od razu, komunikat `role="alert"` („Edycja jest zablokowana, aby nie nadpisać zapisanej treści. Odśwież stronę…”). `recipe-detail-view` przekazuje `[myNote]="recipe()!.my_note"` (bez `?? null`) i `[noteUnavailable]`.

**Testy:**
- Vitest, komponent: +5 testów (alert i blokada pola/przycisku; brak wywołania `updateNote` mimo wymuszonego szkicu, kliknięcia i bezpośredniego `saveNote()`; `undefined` traktowane jak niedostępne; `null` NIE jest błędem; odblokowanie po poprawnych danych) → 29 testów w specu komponentu.
- Vitest, backend: nowy `supabase/functions/_shared/recipe-notes.spec.ts` — 10 testów (`getRecipeNoteForUser`: ok z treścią i filtr `user_id`+`recipe_id`, ok z `null`, błąd zapytania → `unavailable`, wyjątek → `unavailable`, gość bez zapytania; `buildNoteFields`: gość, z notatką, bez notatki, błąd, `undefined`). Dodano do `include` w `vitest.config.ts` i `tsconfig.spec.json` (tylko `supabase/functions/_shared/**/*.spec.ts`; build produkcyjny nietknięty).
- `localApi`: scenariusze `recipes`/`explore`/`public` — asercje `my_note_unavailable: $absent` na ścieżkach poprawnych i dla gościa (+9 asercji; asercje `my_note: null` pozostają ścisłe). Łącznie 47 asercji.

**Uwaga procesowa:** pierwszy przebieg builda produkcyjnego wykrył błąd typów (`linkedSignal` ze starym typem źródła, TS2322/TS2531), niewidoczny dla Vitest; naprawiony przed review.

## Quality Gates (`quality.cjs validate` → `valid: true`, `mergeReady: true`)

Fingerprint kodu: `07554e0352fd6a1125f69c20c33a0ef338c332d60347eabb5521dc06a4b169d3`

| Bramka | Wynik | Dowód |
|---|---|---|
| angularBuild (`npm run build -- --configuration production`) | **PASSED**, exit 0 | `quality-logs/angularBuild.log` |
| vitest (`npm run test:run`, pełny zestaw) | **PASSED**, exit 0 — **60 plików / 371 testów** (poprzednio 59 / 356: +1 plik, +15 testów) | `quality-logs/vitest.log` |
| localMigration (`supabase migration up --local`) | **PASSED**, exit 0 (0 oczekujących) | `quality-logs/localMigration.log` |
| localApi (`local-api-smoke.cjs`) | **PASSED**, exit 0 — 3 scenariusze, **47 asercji**, 0 błędów | `quality-logs/localApi.log` |
| codeReview | **PASSED** (attestation, review nr 3 + potwierdzenie po poprawce komentarza) | `code-review.md` |
| rlsReview | **PASSED** (attestation, review nr 3) | `rls-review.md` |

Niezależność review: inna rodzina modelu (Grok 4.7) niż autor (Claude). Bez Playwright i testów Deno (Deno nie jest zainstalowany).

## Weryfikacja RLS / migracji

- Migracje SQL niezmienione w tej poprawce (`20261108120000`, `20261108130000`). Katalog bazy (odczyt): RLS włączone, 4 polityki, `set_recipe_note`: anon = false, public = false, authenticated = true, `SECURITY INVOKER`, `search_path=""`; `anon` bez SELECT na tabeli; `migrate-local`: 0 oczekujących.
- Review RLS nr 3: brak Critical/Major; potwierdzono izolację, fail-closed, brak ujawnienia treści w odpowiedzi/logu oraz poprawny cache (`no-store` + `Vary: Authorization` dla zalogowanego).
- Testy zachowania RLS A/B (transakcja z ROLLBACK) wykonane we wcześniejszym przebiegu; SQL niezmieniony, smoke z izolacją `my_note` owner/other przeszedł ponownie.

## Zamknięte Major z historii

1. Brak testów komponentu (24 → 29 testów) — zamknięte.
2. WCAG 2.5.3 (rozjechane `aria-label`) — zamknięte.
3. Błąd odczytu notatki jako brak notatki (ryzyko nadpisania) — **zamknięte w tej iteracji**.

Sprawdzenie braku Critical/Major: review kodu nr 3 i RLS nr 3 — „Critical/Major: brak”; zamknięcie Major potwierdzono dowodami (analiza wszystkich ścieżek wywołania, testy jednostkowe, testy komponentu, smoke).

## Problemy Minor (nieblokujące, otwarte)

1. Brak testu żywego API / Deno wymuszającego błąd `select` w odczycie notatki (Deno niezainstalowane; wstrzyknięcie błędu w lokalnym API nie wykonane). Decyzja jest w jednej funkcji pokrytej testami jednostkowymi, a trzy serwisy tylko ją przekazują. **Nowe.**
2. `onNoteChange` nie czyści `my_note_unavailable` (nieosiągalne, zapis z tego stanu zablokowany). Info.
3. `role="alert"` obecny od pierwszego renderu bywa słabo ogłaszany; brak `aria-describedby` na polu. Info.
4. Brak filtra znaków kontrolnych w API (plan API §4); brak XSS.
5. Limit 2000 znaków liczony przed `trim`.
6. `subscribe()` bez `takeUntilDestroyed` w komponencie notatki.
7. `mat-error` limitu bez `NgControl` się nie renderuje (limit egzekwują `maxlength` i `canSave`).
8. Luki smoke: puste / same białe znaki, ponowny GET po usunięciu, brak pola `note`, brak asercji `my_note` na listach.
9. Po zmianie przepisu PUBLIC→PRIVATE zostaje odczyt/usunięcie własnej, historycznej notatki — akceptowalne.
10. Textarea nie jest blokowana w trakcie zapisu.
11. Test a11y weryfikuje kontrakt DOM (label/for/id), nie liczy accname algorytmem.
12. Blokada nadpisania jest w oficjalnym kliencie; właściciel może nadal wywołać `PUT` własnej notatki (nie otwiera odczytu cudzej treści). Info.

Naprawione w trakcie: komentarz kontraktu `shared/contracts/types.ts` opisujący `my_note`/`my_note_unavailable` (zgłoszony w review nr 3, potwierdzony po poprawce).

## Regresja

- Flagi PS-95 i oceny PS-99 na szczegółach — bez zmian layoutu poza sekcją notatki (pełny Vitest i smoke zielone).
- Gość: brak `my_note` i `my_note_unavailable` w JSON (smoke public/explore) i brak sekcji UI.

## Werdykt

Wszystkie wymagane Quality Gates PASS na bieżącym fingerprincie, `quality.cjs validate` = `valid: true`, `mergeReady: true`, brak Critical i Major. Funkcja **zaimplementowana lokalnie**; nie wdrożona (brak migracji zdalnej, deployu, commita, push). Przed wdrożeniem produkcyjnym wymagana osobna zgoda użytkownika.
