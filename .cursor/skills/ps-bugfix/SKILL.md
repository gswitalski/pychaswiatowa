---
name: ps-bugfix
description: Naprawa bugu o minimalnym zużyciu tokenów: diagnoza (frontend, backend lub oba), jedna sesja pytań, zlecenie subagentom ps-bugfix-api i ps-bugfix-view, celowa weryfikacja.
disable-model-invocation: true
---
# Naprawa bugu

Wywołanie: `/ps-bugfix [opis bugu: kroki, oczekiwane vs faktyczne zachowanie,
komunikaty błędów]`. Całość: **diagnoza → jedna sesja pytań → naprawa przez
subagentów → krótki raport**. Priorytet to niskie zużycie tokenów.

## Zasady
1. Bez reviewera, bez planu w pliku, bez historyjki, retrospektywy, wpisu w
   `project-summary.md`, `feature-stage.ps1` i commita (robi go użytkownik).
   Nie wdrażaj zdalnie. Tylko testy jednostkowe (Vitest, `deno test`); bez E2E.
2. Koszt: czytaj przez `rg` i fragmenty plików (`Read` z `offset`/`limit`), nie
   całe pliki ani dokumenty (`project-prd.md`, historyjki, `project-reference.md`
   tylko przez `rg` po trasie lub nazwie funkcji). Przeglądarki używaj tylko, gdy
   bugu nie da się ustalić z kodu i logów, i tylko za zgodą użytkownika.
3. Diagnozę robi orkiestrator sam; nie uruchamiaj subagenta diagnostycznego.
4. Subagenci (`ps-bugfix-api`, `ps-bugfix-view`) dziedziczą model orkiestratora
   (`model: inherit`); nie wskazuj im innego modelu w wywołaniu `Task`.
5. Brak opisu bugu: poproś o niego jednym zdaniem; nie zgaduj.

## Etapy
1. **Diagnoza (bez edycji).** Z opisu wyłuskaj trasę, komponent, endpoint lub
   komunikat błędu. Zlokalizuj ślad `rg`-iem w obu warstwach i przeczytaj tylko
   potrzebne fragmenty. Ustal:
   - **Warstwa**: `frontend` (`src/**`), `backend` (`supabase/**`,
     `shared/contracts/**`) albo `oba`. Wskazówki: zły lub brakujący payload,
     kod HTTP, RLS lub SQL to backend; poprawna odpowiedź API źle
     wyświetlona lub przetworzona, stan, routing, szablon to frontend; odpowiedź
     niezgodna z kontraktem i front zakładający inny kształt to oba.
   - **Przyczynę źródłową** (plik, funkcja, linia) i **oczekiwane zachowanie**.
   - **Warianty naprawy**, jeśli jest więcej niż jeden sensowny (np. zmiana
     kontraktu vs obejście na froncie).
   Gdy przyczyny nie da się ustalić z kodu, powiedz to i zapytaj o dane
   (kroki, logi) w sesji pytań z etapu 2.
2. **Sesja pytań (jedna, po diagnozie).** Jedna sesja `AskQuestion`, 0–5 pytań o
   to, czego nie rozstrzyga kod i co zmienia wynik: wymagane zachowanie, wybór
   wariantu naprawy, zakres (np. czy poprawić też podobne miejsca), przypadki
   brzegowe, brakujące dane o bugu. Zasady:
   - **pomiń sesję**, gdy bug i naprawa są jednoznaczne; napisz to jednym zdaniem
     i podaj założenia;
   - każde pytanie zrozumiałe bez otwierania plików (jedno zdanie kontekstu), 2–3
     opcje ze skutkiem widocznym dla użytkownika;
   - **rekomendowana opcja jest pierwsza**, z dopiskiem „(Rekomendowane)”, a powód
     rekomendacji w treści pytania w jednym zdaniu;
   - opcje się nie wykluczają: `allow_multiple: true`;
   - żadnej drugiej rundy: niejasności po odpowiedziach rozstrzygnij wariantem
     rekomendowanym i zapisz jako „Założenie”.
3. **Zlecenie dla subagenta.** Zwięzłe (do ~15 linii na subagenta), bez wklejania
   treści plików. Zawiera: opis bugu, przyczynę źródłową z plikiem i linią,
   zaakceptowany wariant naprawy, oczekiwane zachowanie, przypadki brzegowe z
   odpowiedzi, wskazanie istniejącego pliku testowego dla testu regresyjnego,
   zakaz wykraczania poza zakres. Subagenta uruchamiaj w świeżym kontekście.
4. **Naprawa.**
   - `frontend`: tylko `ps-bugfix-view`.
   - `backend`: tylko `ps-bugfix-api`. Migracja lokalna tylko, gdy wariant jej
     wymaga: wtedy najpierw
     `powershell -NoProfile -File .cursor/hooks/preflight.ps1 -Stage api -Migrations`;
     dryf migracji lub `supabase db reset` to jedyne pytanie dozwolone poza
     etapem 2 (bezpieczeństwo danych).
   - `oba`: najpierw `ps-bugfix-api`, po jego raporcie `ps-bugfix-view` ze
     zleceniem uzupełnionym o zmianę kontraktu. Gdy kontrakt się nie zmienia,
     uruchom oba **równolegle** w jednej wiadomości.
   Hook `subagentStop` weryfikuje celowo (zob. niżej); jego `followup_message`
   obsługuje subagent. Nie powtarzaj komend, które hook już uruchomił.
5. **Raport.** Maks. ~10 linii: warstwa i przyczyna, co zmieniono (pliki), test
   regresyjny, tabela weryfikacji (statusy: `PASS`, `FAIL`, `NIE_WYKONANO`,
   `WYMAGA_WERYFIKACJI`), założenia. Raz przejrzyj `git diff --stat`; pełny diff
   czytaj tylko dla plików o podejrzanie dużej zmianie. Nie zgłaszaj „gotowe”,
   gdy którykolwiek krok ma `FAIL` lub `NIE_WYKONANO`.

## Weryfikacja (celowa)
- Frontend (`ps-bugfix-view`): `tsc -p tsconfig.app.json --noEmit` oraz Vitest
  dla zmienionych plików (`vitest related`). Bez `lint`, pełnego `test:run` i
  `build`; użytkownik uruchomi je przy commicie lub w CI.
- Backend (`ps-bugfix-api`): `deno check` i `deno test` dla zmienionych funkcji;
  przy zmianie kontraktu dodatkowo `tsc` frontendu. Smoke test workera
  (`.cursor/hooks/smoke-functions.ps1`) tylko, gdy zmieniono `index.ts` lub
  `_shared` i Docker jest dostępny; inaczej `WYMAGA_WERYFIKACJI` z powodem.
- Test regresyjny: jeden, w istniejącym pliku testowym, bez weryfikacji mutacyjnej.
- Hook `verify-implementation.ps1` dla agentów `ps-bugfix-*` nie zapisuje pliku
  `verification` (to nie jest historyjka PS-N).

## Gdy bug przekracza zakres
Naprawa wymaga nowej funkcji, zmiany produktowej lub dużej przebudowy: nie
implementuj jej; opisz w raporcie i zaproponuj `/ps-new-feature` (dla UI
`/ui-improvement`).
