---
name: ps-feature-plan
description: Tworzy plan API, UI i wdrożenia dla historyjki PS-N.
disable-model-invocation: true
---
# Plan funkcjonalności
Przeczytaj historyjkę, summary i aktualny kod. Zapisz trzy artefakty wyliczone
z konwencji: plan API (endpointy, DTO, walidacja, autoryzacja, migracje/RPC i
kontrakty), plan UI (standalone components, sygnały, routing, stany i testy)
oraz plan wdrożenia (migracje, sekrety, CI i rollback). Nie duplikuj historyjki.
Na końcu wykonaj macierz spójności: każdy scenariusz GWT → API → UI → test.
Zatrzymaj zapis, jeśli uprawnienia, metoda, routing albo zachowanie UI są
sprzeczne z historyjką; przedstaw pytanie rozstrzygające użytkownikowi.
