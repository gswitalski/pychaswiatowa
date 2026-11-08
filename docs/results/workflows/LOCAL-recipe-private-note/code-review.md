# Niezależny code review (nr 3) — LOCAL-recipe-private-note (PS-31)
# Poprawka: błąd odczytu notatki ≠ brak notatki (dawne Minor #3, traktowane jako Major)

REVIEWER: independent-reviewer
VERDICT: PASS

Niezależność modelowa: zachowana. Autor implementacji: Claude (Anthropic). Recenzent: subagent `independent-reviewer` (Grok 4.7, xAI) — inna rodzina modelu.

Historia: review nr 1 (PASS, 2 Major) → review nr 2 (PASS, Minor #3) → poprawka Minor #3 jako Major → review nr 3 (ten dokument) → poprawka komentarza kontraktu zgłoszonej w review nr 3 (Minor, tylko komentarz) → potwierdzenie tego samego recenzenta (resume): PASS, Critical/Major: brak, fingerprint `07554e03…`. VERDICT: PASS nie jest wystarczający sam w sobie — poniżej dowody zamknięcia Major.

## Weryfikacja poprawki (Major: błąd odczytu notatki ≠ brak notatki)

Nie istnieje ścieżka, w której wyjątek lub `error` zapytania jest składany z powrotem do `my_note: null`.

- **Backend.** Jedyny odczyt tabeli `user_recipe_notes` jest w `getRecipeNoteForUser` (`supabase/functions/_shared/recipe-notes.ts`). `error` i wyjątek → `{ status: 'unavailable' }`. `note: null` powstaje tylko dla gościa (bez zapytania) albo przy udanym odczycie bez wiersza. `buildNoteFields`: gość → `{}`; `ok` → `{ my_note }`; `unavailable` lub `undefined` przy zalogowanym → `{ my_note_unavailable: true }` bez klucza `my_note`.
- **Wywołania** (recipes ×2, explore ×2, public ×1) przekazują wynik wprost do `buildNoteFields`, bez `?? null`. Handlery (`JSON.stringify`) nie dopisują brakującego klucza. `my_note: row.out_my_note ?? null` w `setRecipeNote` dotyczy odpowiedzi udanego RPC, nie odczytu.
- **Frontend.** `recipe-detail-view.component.html` przekazuje `[myNote]="recipe()!.my_note"` (bez `?? null`) i `[noteUnavailable]="recipe()!.my_note_unavailable === true"`. W komponencie `isUnavailable = noteUnavailable() || myNote() === undefined` → `canSave()` fałszywe, `saveNote()` wraca od razu, textarea `disabled`, akapit `role="alert"`. Brak `<form>`/Enter; przycisk `type="button"`. Fail-safe: brak pola z backendu także blokuje zapis.
- **Testy rzeczywiste, nie pozorne.** `supabase/functions/_shared/recipe-notes.spec.ts` (10 testów Vitest): błąd zapytania i wyjątek → `unavailable`, nie `note: null`; `'my_note' in fields === false` przy błędzie. Spec komponentu: 29 testów (w tym 5 nowych: alert, `disabled` pola i przycisku, brak wywołania `updateNote` mimo wymuszonego szkicu/kliknięcia/bezpośredniego `saveNote()`, `undefined` ≠ `null`, `null` nie jest błędem, odblokowanie po poprawnych danych). Smoke `localApi`: `my_note_unavailable` `$absent` na ścieżkach OK i dla gościa; asercje `my_note: null` są ścisłe (`$type: null` nie przejdzie dla brakującego klucza).
- **Konfiguracja testów.** `vitest.config.ts` i `tsconfig.spec.json` obejmują wyłącznie `supabase/functions/_shared/**/*.spec.ts`; build produkcyjny używa `tsconfig.app.json` (`src/**/*.ts`). Zmiana bezpieczna.
- **Kontrakt.** Zgodny wstecz dla ścieżki sukcesu i gościa; nowe pole opcjonalne; ścieżka błędu celowo zmienia kształt (brak `my_note` + flaga).
- Uwaga procesowa: pierwszy przebieg builda produkcyjnego wykrył błąd typów `linkedSignal` (TS2322/TS2531), którego Vitest nie widział; naprawiony przed review.

## Critical/Major

brak

## Minor/Info (otwarte, nieblokujące)

1. Brak testu żywego API / Deno wymuszającego błąd `select` (Deno nie jest zainstalowany; wstrzyknięcie błędu w lokalnym API nie było wykonane). Decyzja jest w jednej funkcji pokrytej testami jednostkowymi; trzy serwisy tylko ją przekazują. (Minor, nowe)
2. `onNoteChange` nie czyści `my_note_unavailable` — nieosiągalne, bo zapis z tego stanu jest zablokowany. (Info)
3. `role="alert"` obecny od pierwszego renderu bywa słabo ogłaszany; brak `aria-describedby` na polu. Zapis zablokowany. (Info)
4. Zgłoszona nieścisłość komentarza kontraktu `shared/contracts/types.ts` — **naprawiona** i potwierdzona przez recenzenta.
5. Znane z wcześniejszych review: brak filtra znaków kontrolnych; limit 2000 przed `trim`; `subscribe()` bez `takeUntilDestroyed`; martwy `mat-error` limitu; luki smoke; historyczny odczyt po PUBLIC→PRIVATE; textarea nieblokowana w trakcie udanego zapisu.

## Dowody bramek (quality.cjs)

angularBuild exit 0; vitest 60 plików / 371 testów; localMigration exit 0; localApi 47 asercji / 0 błędów.
