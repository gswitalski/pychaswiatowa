---
name: ps-implement-view
description: Implementuje widoki Angular i testy Vitest dla PS-N.
disable-model-invocation: true
---
# Implementacja widoków
Wykonaj plan widoków z `docs/results/impl-plans/views/` na podstawie aktualnych
kontraktów (`shared/contracts/types.ts`). Historyjkę czytaj tylko we fragmentach
wskazanych przez plan. Używaj standalone components, `inject`, sygnałów,
`OnPush`, nowego control flow i serwisów wywołujących Edge Functions. Dodaj
testy jednostkowe Vitest sukcesu, błędów i stanów brzegowych; nie twórz testów
E2E. Uruchom `npm run lint`, `npm run test:run` i `npm run build`. Po
zakończeniu hook `subagentStop` powtarza te komendy i zwraca błędy do poprawy.
Po każdej rundzie poprawek przeczytaj pełny diff.
