---
name: ps-new-feature
description: Orkiestruje pełny proces historyjki PS-N i wznawia go na podstawie istniejących artefaktów.
disable-model-invocation: true
---
# Nowa funkcjonalność

Wywołanie: `/ps-new-feature PS-{N} [opis]`.

1. Przeczytaj `ps-feature-conventions` i ustal etap po istniejących plikach.
2. Uruchamiaj właściwych subagentów w świeżym kontekście, przekazując tylko ID,
   tryb i odpowiedzi użytkownika.
3. Po analizie, każdym planie i każdej implementacji zatrzymaj się na akceptację
   użytkownika. Pytania zadawaj przez AskQuestion.
4. Uruchom równolegle oba planery implementacji, ale implementację widoków dopiero
   po akceptacji API i kontraktów.
5. Po każdej implementacji uruchom niezależny `ps-code-reviewer`; maksymalnie dwie
   rundy poprawek.
6. Na końcu uruchom updater summary, pokaż checklistę z planu wdrożenia i przypomnij
   o commicie. Nie wykonuj deployu.
