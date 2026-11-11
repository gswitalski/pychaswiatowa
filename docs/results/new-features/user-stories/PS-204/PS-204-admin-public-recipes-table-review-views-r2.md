# PS-204 — Review implementacji widoków, runda 2 (ostatnia)

Raport zapisał orkiestrator (reviewerzy działają w trybie tylko do odczytu).

## Werdykt zbiorczy: WYMAGA_POPRAWEK (tylko zakres `views-tests`)

| Zakres | Reviewer | Werdykt | Blokujące |
|---|---|---|---|
| `views-code` | 596f1ac0-6ead-43e8-85cb-f8e6c9c51261 | ZAAKCEPTOWANE | brak |
| `views-tests` | 7f36ce3c-c7f8-41a9-99b5-5491ac66008d | WYMAGA_POPRAWEK | B1 |

Runda 2 z 2 — limit rund poprawek wyczerpany. Dalsze działanie wymaga decyzji użytkownika.

Wyniki poleceń: `npm run lint` PASS; `npm run build` PASS (2 ostrzeżenia budżetu SCSS niezwiązane z PS-204);
`npm run test:run` PASS (69 plików, 404 testy); Vitest `src/app/pages/admin` 35 testów PASS.

## views-code — ZAAKCEPTOWANE

Uwagi r1 (ważna 1, drobne 2, 3) naprawione; drobne 4 i 5 dopuszczone (zgodność ze wzorcem listy użytkowników / plan). Brak regresji.

Drobne nowe (testy):
- `admin-recipes-page.component.spec.ts:233-244` — martwe `newest.next(response)` bez asercji po unieważnieniu korekty.
- `admin-recipes-page.component.spec.ts:221-230` — asercja `sorting().sort_by === 'name'` rozróżnia ignorowanie spóźnionej odpowiedzi tylko pośrednio.
- `admin-recipes-table.component.spec.ts:145` — zbędna asercja `toHaveBeenCalled()`.

## views-tests — WYMAGA_POPRAWEK

Naprawione: r1 nr 4, 7, 10, 11–15. Częściowo: 1, 3, 5, 6, 8, 9. Nienaprawione: 2 (wyścigi).

Blokująca:
- **B1** (`page.spec.ts:218-244`): test wyścigów nie używa odwróconej kolejności — `first.next` przed `second.next`, więc usunięcie ochrony `latestRequestId` nie wywali testu. Wymagane: najpierw `second.next(...)`, potem spóźnione `first.next(...)` z innym sortowaniem i wierszami; asercje `rows`, `sorting()`, `query()`, `pagination()` z drugiej odpowiedzi. Część 2 (unieważnienie korekty) bez asercji końcowej (`:243`).

Ważne:
- **W1** brak testu korekty, po której `totalItems` spada do 0 (plan 11.1 #8) oraz `toHaveBeenCalledTimes(2)` w teście `:104`.
- **W2** asercja `pagination().currentPage === 1` (`:85-102`) tautologiczna przy synchronicznym `of()`; użyć `Subject`.
- **W3** brak testu „ta sama strona i rozmiar → brak żądania" (plan 11.1 #4).
- **W4** monolit stanów tabeli (`table.spec:187-232`) — brak asercji komunikatu błędu, braku `table` przy `isEmpty`, widoczności paginatora przy `hasNoRowsOnPage`.
- **W5** luki 11.2: początkowy `aria-sort` i zmiana wejścia, `sort_dir` dla 5 kolumn, `.admin-recipes-table__scroll`, warianty znaczników i `aria-hidden`, komórki, `paginator.pageSize`.
- **W6** `AdminApiService.getRecipes({})` → `'admin/recipes'`, pojedyncze `page_size` i `sort_dir`.

Drobne: D1 rozbić dwa testy łączone w `api.spec`; D2 zbędne asercje w `table.spec`; D3 ustawianie stanu wewnętrznego zamiast zachowania; D4 `getItem.mockRestore()` poza `finally`/`afterEach`; D5 `it.each` średniej miesza datę; D6 zależność od ICU `pl-PL`.

## Status po review r2

| Pozycja | Status |
|---|---|
| lint, Vitest (404), build | PASS |
| Kod produkcyjny widoków | ZAAKCEPTOWANE |
| Test wyścigów `latestRequestId` wykrywający regresję | FAIL (B1) |
| Pokrycie planu sekcji 11 | CZĘŚCIOWE (W1–W6) |
| Smoke test w przeglądarce | WYMAGA_WERYFIKACJI |

## Dodatkowa runda poprawek testów i re-review (po zgodzie użytkownika, ponad limit 2 rund)

- Poprawki: implementer widoków (65f3e60e-0925-49ce-82b5-541bdc7cff16), wyłącznie testy Vitest. Kontrolowana mutacja B1 (usunięcie guardu latestRequestId) dała FAIL testu wyścigu; kod produkcyjny przywrócony (zweryfikowane przez orkiestratora i reviewera).
- Re-review views-tests (3e48242e-db02-47e9-845f-50c2914d6cd5): ZAAKCEPTOWANE. B1, W1-W6, D2, D4, D5 naprawione; D1 częściowo; D3 i D6 świadomie pominięte.
- Pozostałe drobne: (1) admin-api.service.spec.ts:177 i :210 nadal łączą po dwa scenariusze; (2) admin-recipes-table.component.spec.ts:112-114 redundantne asercje nagłówków; (3) zależność mapowania od ICU pl-PL (D6).
- Wyniki: npm run test:run PASS (69 plików, 420 testów), eslint PASS, lint PASS, build PASS. Smoke w przeglądarce: WYMAGA_WERYFIKACJI (brak danych logowania admina).

