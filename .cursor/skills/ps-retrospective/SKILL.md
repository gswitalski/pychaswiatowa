---
name: ps-retrospective
description: Retrospektywa procesu PS-N uruchamiana wyłącznie na żądanie użytkownika, z propozycjami zmian w procesie.
disable-model-invocation: true
---
# Retrospektywa procesu

Nie jest etapem `/ps-new-feature`. Uruchamia ją użytkownik (`/ps-retrospective
PS-{N}`), a wykonuje główny agent. Opieraj się na dowodach, nie na wrażeniach:
- rundy pytań i decyzje na bramkach z rozmowy (liczba rund, odpowiedzi `Inna`,
  zatrzymania),
- „Historia zmian” w historyjce, zwłaszcza wymagania odkryte późno,
- artefakt weryfikacji z hooka: `FAIL`, ponowienia, `NIE_WYKONANO`,
- artefakty review, jeśli użytkownik je zlecił ręcznie,
- aborty subagentów, awarie narzędzi i użyte procedury awaryjne,
- odstępstwa implementacji od planów.

Zapisz `PS-{N}-{slug}-retrospective.md` z sekcjami:
1. Przebieg — tabela etapów: rundy pytań, poprawki, status.
2. Co poszło dobrze — z dowodem.
3. Co poszło źle — problem, dowód, przyczyna źródłowa, koszt.
4. Propozycje zmian — `R1`, `R2`…; każda wskazuje plik w `.cursor/` lub
   `docs/flow/`, konkretną zmianę, rozwiązywany problem i ryzyko. Najwyżej
   7 propozycji, wyłącznie wynikających z dowodów; bez zmian w kodzie aplikacji.
5. Decyzja użytkownika.

Następnie zapytaj przez `AskQuestion` z `allow_multiple: true`: każda propozycja
jako osobna opcja oraz `Nie wdrażaj żadnej`. Wdróż tylko wybrane, minimalnie
i w stylu istniejących plików; gdy zmienia się przebieg, zaktualizuj też
`docs/flow/flow-new-feature.md`. Uzupełnij sekcję decyzji (wdrożone/odrzucone)
i pokaż listę zmienionych plików. Nie commituj.
