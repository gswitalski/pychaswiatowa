---
name: ps-feature-plan
description: Tworzy plan API, UI i wdrożenia dla historyjki PS-N.
disable-model-invocation: true
---
# Plan funkcjonalności
Przeczytaj historyjkę, summary i aktualny kod.

## Tryb `pytania`
Niczego nie zapisuj. Działaj według sekcji „Rundy pytań” z konwencji; limit to
3 rundy. Szukaj w historyjce luk, które blokują jednoznaczny plan: brakujące
lub sprzeczne kryteria GWT, nieokreślone uprawnienia, metoda i kształt API,
kody błędów, walidacja, migracja istniejących danych, routing, stany UI,
komunikaty, wpływ na istniejące kontrakty i ryzyka wdrożenia. Do każdej luki
wskaż fragment historyjki, którego dotyczy, i zaproponuj brzmienie poprawki.

## Tryb `zapis`
Najpierw nanieś na historyjkę poprawki wynikające z odpowiedzi i dopisz każdą do
sekcji „Historia zmian” (data, etap `plan funkcjonalny`, zmiana, powód). Następnie
zapisz trzy artefakty wyliczone z konwencji: plan API (endpointy, DTO, walidacja,
autoryzacja, migracje/RPC i kontrakty), plan UI (standalone components, sygnały,
routing, stany i testy jednostkowe Vitest) oraz plan wdrożenia (migracje,
sekrety, CI i rollback). Nie duplikuj historyjki i nie planuj testów E2E.
Na końcu wykonaj macierz spójności: każdy scenariusz GWT → API → UI → test
jednostkowy. Zatrzymaj zapis, jeśli uprawnienia, metoda, routing albo zachowanie
UI są sprzeczne z historyjką; przedstaw pytanie rozstrzygające użytkownikowi.
Zwróć listę zmian naniesionych na historyjkę.
