# PS-204 — Review implementacji widoków, runda 1

Raport zapisał orkiestrator (reviewerzy działają w trybie tylko do odczytu).

## Werdykt zbiorczy: WYMAGA_POPRAWEK

| Zakres | Reviewer | Werdykt | Blokujące |
|---|---|---|---|
| `views-code` | 45a6e30d-93d4-4c4b-8056-1ba8a43c7d0b | WYMAGA_POPRAWEK | brak (1 ważna: braki testów) |
| `views-tests` | 521792c3-d5a3-47bf-bb80-e0c4799feaed | WYMAGA_POPRAWEK | 1–4 |

Wyniki poleceń reviewerów: `npm run lint` PASS, `npm run build` PASS (ostrzeżenia budżetu SCSS niezwiązane z PS-204), `npm run test:run` PASS (69 plików, 384 testy).

## views-code

Kod produkcyjny zgodny z planem (sortowanie 6 pól, paginacja, auto-korekta, `hasNoRowsOnPage`, link w nowej karcie,
opacity 0.5, 401/403, stany, dostępność, brak trwałości stanu, nawigacja, trasy, standardy projektu). Brak zmian funkcjonalnych.

- (Ważna) Za mało testów względem planu sekcja 11 (strona 3/14, tabela 3/10, brak granicy 12 znaków w modelach).
- (Drobna 2) Test auto-korekty nie sprawdza `page: 3` ani realistycznej drugiej odpowiedzi.
- (Drobna 3) Kolumna `flags`: pusty `<div class="…__flags">` dla przepisów bez znaczników — opakować `@if (row.isGrill || row.isTermorobot)`.
- (Drobna 4) Przy 401/403 `isInitialLoading=false` przed `navigate` — zgodne ze wzorcem listy użytkowników; opcjonalnie nie zerować flag.
- (Drobna 5) Komórki liczbowe wyrównane do prawej, nagłówki sortowania do lewej — dopuszczone planem.

## views-tests

Blokujące:
1. Brak testów 401/403/500, `onRetry`, błędu przy istniejących wierszach.
2. Brak testów wyścigów (`latestRequestId`) — mocki synchroniczne `of()`; użyć `Subject`.
3. Sortowanie 6 pól tylko dla `name asc` przez wywołanie metody; brak kliknięcia nagłówków, `aria-sort`, braku sortowania ID/Znaczniki/Akcja; brak testów `onSortChange` strony (page=1, zachowanie page_size, brak requestu przy tym samym sortowaniu).
4. Stany tabeli prawie niepokryte (spinner, błąd z `retry`, `isEmpty`, `isRefreshing`, błąd inline).

Ważne:
5. Test auto-korekty niepełny (parametry 2. żądania, wariant z danymi, `totalItems` → 0, `data: []` bez korekty).
6. Test zmiany rozmiaru nie startuje ze strony 3; brak testu zmiany strony zachowującej sortowanie i rozmiar.
7. Mapowanie częściowe (nazwa bez e-maila, oba puste, białe znaki, średnia `4`/`null`/`NaN`, `ratings_count: 0`, data niepoprawna, flagi) — `it.each`.
8. Tabela: dokładnie 9 nagłówków, link (`aria-label`, ikona `aria-hidden`), komórki, znaczniki, escapowanie HTML, `title`, paginator 25/50/100 z emisją `pageChange`, kontener `__scroll`.
9. `AdminApiService.getRecipes`: pojedyncze parametry (brak cichych domyślnych), rozbicie testu łączonego, błąd bez statusu → 500, domyślny komunikat.
10. Brak testu braku trwałości stanu (`Storage`).

Drobne: 11 test trasy `recipes` ma rozwiązywać do `AdminRecipesPageComponent`; 12 test trasy gościa — asercja `canMatch` z `guestOnlyMatchGuard`; 13 nawigacja: `ariaLabel`, niezmienione pozycje, unikalność tras; 14 modele: pusty string i wektor `12345678-aaaa-bbbb-cccc-1234567890ab`; 15 tytuł strony: podtytuł o przepisach prywatnych.

## Status po review r1

| Pozycja | Status |
|---|---|
| lint, Vitest (384), build | PASS |
| Pokrycie testami planu sekcji 11 | FAIL (do poprawy w rundzie 1 poprawek) |
| Smoke test w przeglądarce | WYMAGA_WERYFIKACJI |
