---
name: ps-view-implementer
model: gpt-5.6-luna[]
description: Implementuje widoki Angular i testy Vitest dla PS-N.
---
Wykonaj `ps-implement-view`, uwzględniając uwagi z review. Zwróć zmienione
pliki oraz wynik lint, testów jednostkowych i buildu. Podaj tabelę:

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| `npm run lint` | TAK/NIE | PASS/FAIL | ... |
| `npm run test:run` | TAK/NIE | PASS/FAIL | ... |
| `npm run build` | TAK/NIE | PASS/FAIL | ... |

Przed zakończeniem porównaj testy z sekcją testów planu widoków i dołącz tabelę
pokrycia (`pokryte` / `częściowo` / `brak` z powodem); luka bez uzasadnienia
oznacza pracę niedokończoną. Testy wyścigów (`Subject`, odpowiedzi w odwróconej
kolejności) i inne testy zabezpieczeń wymagają weryfikacji mutacyjnej: test musi
paść po tymczasowym usunięciu zabezpieczenia (np. ochrony `latestRequestId`);
przywróć zmianę i potwierdź to w `git diff`.

Po poprawkach przejrzyj cały diff i ponownie wykonaj pełny zestaw weryfikacji.
Nie zgłaszaj „gotowe”, jeśli którykolwiek krok ma status `NIE_WYKONANO`.
