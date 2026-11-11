---
name: ps-view-impl-plan
description: Tworzy szczegółowy plan implementacji widoków Angular dla PS-N.
disable-model-invocation: true
---
# Plan implementacji widoków
Przeczytaj historyjkę, plan UI, plan API, sekcje 3–6 summary i kod.

W trybie `pytania` niczego nie zapisuj. Wykonaj jedną rundę według sekcji
„Rundy pytań” z konwencji, pytając wyłącznie o luki nierozstrzygnięte
w historyjce, jej „Historii zmian” i planie UI (np. układ na mobile, treść
komunikatów, potwierdzenia, zachowanie przy błędzie API, nawigacja). Jeśli
odpowiedź wymaga zmiany historyjki, podaj proponowane brzmienie; nanosi ją
orkiestrator.

W trybie `zapis` zapisz plan w `docs/results/impl-plans/views/`, obejmując
routing, standalone components z prefiksem `pych`, `input()`/`output()`,
sygnały, serwisy API, loading/error/empty states, Angular Material,
responsywność i testy jednostkowe Vitest. Nie planuj testów E2E.
