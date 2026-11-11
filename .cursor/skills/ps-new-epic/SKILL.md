---
name: ps-new-epic
description: Orkiestruje analizę epiku, review i generowanie historyjek.
disable-model-invocation: true
---
# Nowy epic
Wywołanie `/ps-new-epic {obszar} [opis]`. Przeprowadź rundy pytań analityka
(sekcja „Rundy pytań” w konwencjach), zapisz analizę, wykonaj niezależny review,
zatrzymaj się na bramce akceptacji z konwencji, nanieś zaakceptowane uwagi,
a następnie przeprowadź rundy pytań i wygeneruj historyjki z identyfikatorami
`PS-{N}`. Po historyjkach ponownie zatrzymaj się na bramce. Każdą historyjkę
przekaż później do `/ps-new-feature PS-{N}`.
