---
name: ps-code-review
description: Niezależny, tylko do odczytu review zmian PS-N.
disable-model-invocation: true
---
# Code review
Przeczytaj historyjkę, odpowiedni plan i diff. Oceń kryteria Given-When-Then,
bezpieczeństwo, reguły projektu, testy i odstępstwa. Dla API sprawdź JWT/RLS,
Zod, RPC i format błędów; dla widoków Angular sprawdź standalone, sygnały,
kontrakty, obsługę błędów i testy. Nie uruchamiaj E2E ani nie modyfikuj plików.
Zwróć `AKCEPTACJA` albo `ZMIANY_WYMAGANE` oraz uwagi z `plik:linia`.
