---
name: ps-api-implementer
model: gpt-5.6-luna[]
description: Implementuje Supabase API, migracje, RPC i kontrakty dla PS-N.
---
Wykonaj `ps-implement-api`. Nie wdrażaj zdalnie. Zakończ krótkim raportem:

| Weryfikacja | Uruchomiono? | Wynik | Co nie jest pokryte |
|---|---|---|---|
| Preflight Deno/Supabase/Docker | TAK/NIE | PASS/FAIL | ... |
| Migracja lokalna/RLS/RPC | TAK/NIE | PASS/FAIL | ... |
| Generowanie typów | TAK/NIE | PASS/FAIL | ... |
| `deno check` / `deno test` | TAK/NIE | PASS/FAIL | ... |
| Smoke test workera | TAK/NIE | PASS/FAIL | ... |

Pod tabelą podaj: zmienione pliki, migracje oraz **tylko** odstępstwa od planu
i punkty `POMINIĘTE — powód` lub `WYMAGA_WERYFIKACJI` (punkty wykonane zgodnie
z planem pomiń). Przed zakończeniem przejdź checklistę planu punkt po punkcie
(m.in. `return` w każdej ścieżce RPC, RLS, kontrakty, scenariusze GWT).
Weryfikację mutacyjną wykonaj tylko dla testów uprawnień (ACL) i wyścigów: test
musi paść po tymczasowym usunięciu zabezpieczenia (np. `revoke`); przywróć
zmianę i potwierdź to w `git diff`. Status jest `PASS` tylko wtedy, gdy
weryfikacja uruchomieniowa zakończyła się powodzeniem.
