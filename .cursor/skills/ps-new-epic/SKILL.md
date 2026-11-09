---
name: ps-new-epic
description: Orkiestruje analizę epiku, review i generowanie historyjek.
disable-model-invocation: true
---
# Nowy epic
Wywołanie `/ps-new-epic {obszar} [opis]`. Uruchom analityka, zapisz analizę,
niezależny review, zatrzymaj się na decyzję użytkownika, nanieś zaakceptowane
uwagi, a następnie wygeneruj historyjki z identyfikatorami `PS-{N}`. Każdą
historyjkę przekaż później do `/ps-new-feature PS-{N}`.
