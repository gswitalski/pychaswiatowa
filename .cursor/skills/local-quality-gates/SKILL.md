---
name: local-quality-gates
description: Uruchamiaj po zmianach Angulara, Supabase, migracji SQL lub testów; buduj, testuj Vitest, wykonuj lokalne migracje i sprawdź blokady jakości v2.
---
# Lokalna weryfikacja jakości
1. Sprawdź prawdziwy `package.json` i `.cursor/config/quality.json` (nie zgaduj poleceń).
2. Sprawdź zmiany w Git i ustal wymagane gate'y (`quality.cjs requirements ID`).
3. Jeśli migracja SQL: review bezpieczeństwa, następnie `quality.cjs preflight-local` (tylko odczyt), potem `quality.cjs migrate-local ID` (globalne Supabase CLI, tylko `--local`). Nie używaj `db reset` ani połączenia zdalnego.
4. Uruchom `quality.cjs run ID angularBuild` i `quality.cjs run ID vitest`; jeśli zmieniony backend, upewnij się, że istnieje `supabase/tests/api/<funkcja>.smoke.json` dla każdej zmienionej funkcji, i uruchom `quality.cjs run ID localApi`. Testy Deno są opcjonalne.
5. Zleć niezależny code review i RLS review, gdy wymagany; zarejestruj wyniki.
6. `quality.cjs validate ID` musi być poprawny; w przeciwnym razie zatrzymaj proces. Brak E2E jest celowy.
