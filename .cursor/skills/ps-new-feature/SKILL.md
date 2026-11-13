---
name: ps-new-feature
description: Orkiestruje proces historyjki PS-N (historyjka, plany implementacji, API, widoki, summary) i wznawia go na podstawie artefaktów.
disable-model-invocation: true
---
# Nowa funkcjonalność

Wywołanie: `/ps-new-feature PS-{N} [opis]`.

Proces: **historyjka → plany implementacji (API + widoki) → implementacja API →
implementacja widoków → summary**. Bramki akceptacji są trzy (po historyjce,
po planach, na końcu).

## Zasady
1. Przeczytaj `ps-feature-conventions` i uruchom
   `powershell -NoProfile -File .cursor/hooks/feature-stage.ps1 -Id PS-{N}`.
   Etap, slug i ścieżki bierz z jego wyniku; wznów od wskazanego etapu.
2. Subagentów uruchamiaj w świeżym kontekście. Przekazuj ID, slug, ścieżki
   artefaktów, tryb i (jeśli były) pytania z odpowiedziami. Nie wklejaj treści
   plików, które subagent może przeczytać sam.
3. Pytania zadajesz wyłącznie w etapie 1 (max 2 rundy) i opcjonalnie w etapie 2
   (jedna runda, tylko blokery). Wszędzie indziej wybieraj wariant
   rekomendowany i zapisuj go jako „Założenie”. Jedyny wyjątek to bezpieczeństwo
   danych: dryf migracji lokalnych i `supabase db reset` (zob. etap 3).
4. Tylko testy jednostkowe; nie zlecaj ani nie uruchamiaj E2E.
5. Reviewer (`ps-code-reviewer`, `ps-analysis-reviewer`) nie należy do procesu:
   nie uruchamiaj go i nie proponuj. Użytkownik wywoła go ręcznie, gdy zechce.

## Etapy
1. **Historyjka.** Rundy `pytania` z `ps-story-analyst` (najwyżej 2, do
   `STATUS: BRAK_PYTAŃ`), potem tryb `zapis`. **Bramka 1.**
2. **Plany implementacji.** Jedno wywołanie `ps-impl-planner` w trybie `plan`.
   Gdy planer znajdzie blokery, zwraca `STATUS: PYTANIA` bez zapisu: zadaj
   pytania jedną sesją i wywołaj go ponownie z odpowiedziami (musi wtedy
   zapisać oba plany). Poprawki historyjki wynikające z odpowiedzi planer nanosi
   sam, z wpisem w „Historii zmian”. Na bramce pokaż założenia planów, zmiany
   w historyjce i „Czynności ręczne” z planu API. **Bramka 2.**
3. **Implementacja API** (pomiń, gdy `apiSkipped`).
   - `powershell -NoProfile -File .cursor/hooks/preflight.ps1 -Stage api -Migrations`.
     Brak Deno, Supabase CLI lub Dockera: zatrzymaj etap bez pytań i podaj, czego
     brakuje (wznowisz tym samym poleceniem). Dryf migracji: zapytaj użytkownika
     (nie usuwaj obiektów spoza repo). Brak kont testowych w `.env.local` nie blokuje:
     smoke test z kontami dostaje `WYMAGA_WERYFIKACJI`.
   - Uruchom `ps-api-implementer`. Hook `subagentStop` weryfikuje i dopisuje wynik
     do artefaktu `verification`; jeśli wpisu brakuje, uzupełnij go z raportu
     implementera.
   - Wynik **blokuje**, gdy `FAIL` lub `NIE_WYKONANO` dotyczy migracji lokalnej,
     `deno check`/`deno test` albo smoke testu workera (odpowiedź 4xx z kodu
     funkcji). W takim razie zatrzymaj się na bramce z opisem problemu. W przeciwnym
     razie przejdź do etapu 4 bez bramki.
4. **Implementacja widoków** (pomiń, gdy `viewSkipped`): `preflight.ps1 -Stage views`,
   potem `ps-view-implementer`. Hook uruchamia lint, Vitest i build. `FAIL` lub
   `NIE_WYKONANO` blokuje: zatrzymaj się na bramce; w przeciwnym razie przejdź
   do summary.
5. **Summary.** Wykonaj `ps-summary-update` sam (bez subagenta). Potem
   **Bramka 3** z krótkim podsumowaniem: artefakty, statusy weryfikacji,
   założenia, „Czynności ręczne” z planu API. Nie wdrażaj zdalnie; commit
   wykonuje użytkownik.

Retrospektywa i review nie są częścią procesu. Użytkownik uruchamia je na
żądanie (`/ps-retrospective PS-{N}`, `ps-code-reviewer`).

## Awarie
Awarie narzędzi nie są bramką ani pytaniem: zastosuj procedurę (np. `FAIL`/
`WYMAGA_WERYFIKACJI` w artefakcie), a pytaj dopiero na bramce, gdy etap jest
zablokowany. Gdy Deno brakuje lokalnie, uruchom workflow CI `validate-backend`
na branchu (jeśli dostępny) albo zapisz `WYMAGA_WERYFIKACJI`.
