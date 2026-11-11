---
name: ps-retrospective
description: Retrospektywa procesu PS-N po aktualizacji summary z propozycjami zmian w procesie.
disable-model-invocation: true
---
# Retrospektywa procesu

Wykonuje główny agent po zaakceptowanej aktualizacji summary. Opieraj się na
dowodach, nie na ogólnych wrażeniach:
- rundy pytań i decyzje na bramkach z bieżącej rozmowy (liczba rund, odpowiedzi
  `Inna`, zatrzymania),
- „Historia zmian” w historyjce, zwłaszcza wymagania odkryte późno,
- artefakty review: liczba rund, werdykty, powtarzające się kategorie uwag,
  `BEZ_REVIEW`,
- artefakt weryfikacji z hooka: `FAIL`, ponowienia, `NIE_WYKONANO`,
- aborty subagentów, awarie narzędzi i użyte procedury awaryjne,
- odstępstwa implementacji od planów.

Zapisz `PS-{N}-{slug}-retrospective.md` z sekcjami:
1. Przebieg — tabela etapów: rundy pytań, poprawki, rundy review, status.
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
