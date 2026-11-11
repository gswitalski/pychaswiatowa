---
name: ps-api-impl-plan
description: Tworzy szczegółowy plan implementacji Supabase API dla PS-N.
disable-model-invocation: true
---
# Plan implementacji API
Przeczytaj historyjkę, plan API, sekcje 3–6 summary, kontrakty i istniejące
funkcje.

W trybie `pytania` niczego nie zapisuj. Wykonaj jedną rundę według sekcji
„Rundy pytań” z konwencji, pytając wyłącznie o luki nierozstrzygnięte
w historyjce, jej „Historii zmian” i planie API (np. szczegóły RLS, kształt
odpowiedzi błędów, idempotencja, transakcje). Jeśli odpowiedź wymaga zmiany
historyjki, podaj proponowane brzmienie; nanosi ją orkiestrator.

W trybie `zapis` zapisz plan w `docs/results/impl-plans/endpoints/` z listą
plików, endpointów, DTO, migracji, RLS/RPC, walidacji Zod, ról JWT, błędów 200,
201, 204, 400, 401, 402, 403, 404, 409, 422, 500 oraz testów jednostkowych
`deno test` i komend weryfikacji. Nie planuj testów E2E.
