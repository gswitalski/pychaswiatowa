# PS-15 — Review widoków (r1)

**Slug:** `recipe-author-on-detail-view`  
**Zakres:** `views`  
**Data:** 2026-11-11  
**Reviewer:** orkiestrator (`ps-code-reviewer` przerwany)

## Werdykt: AKCEPTACJA

## Uwagi

| Priorytet | Plik | Uwaga |
|---|---|---|
| Info | `recipe-header.component.ts:167–173` | `authorLabel` ukrywa sekcję przy pustym `username` (rozszerzenie względem G6); UUID z fallbacku API nadal się wyświetli. |
| Info | `recipe-header.component.html:9–14` | Pozycja po porcjach, przed opisem — zgodnie z planem UI. Brak linku — AC7. |
| OK | `recipe-header.component.spec.ts` | 10 testów Vitest; `npm run test:run` PASS. |

## Pokrycie AC (UI)

| AC | Status |
|---|---|
| AC4–AC7 | **PASS** (testy jednostkowe komponentu) |
| AC8 | **PASS** (build) |

## Zależność

Widok zakłada `author` w odpowiedzi API — implementacja backendu w tym samym branchu; testy Deno API nadal **WYMAGA_WERYFIKACJI**.
