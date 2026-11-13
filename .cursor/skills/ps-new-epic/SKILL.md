---
name: ps-new-epic
description: Orkiestruje analizę epiku i generowanie historyjek.
disable-model-invocation: true
---
# Nowy epic
Wywołanie `/ps-new-epic {obszar} [opis]`. Przeprowadź rundy pytań analityka
(sekcja „Pytania do użytkownika” w konwencjach, max 2 rundy), zapisz analizę
i zatrzymaj się na bramce akceptacji z konwencji. Po akceptacji (z uwagami
użytkownika naniesionymi do analizy) przeprowadź rundy pytań (max 2) i wygeneruj
historyjki z identyfikatorami `PS-{N}`. Po historyjkach ponownie zatrzymaj się
na bramce. Każdą historyjkę przekaż później do `/ps-new-feature PS-{N}`.

Review analizy (`ps-analysis-reviewer`, skill `ps-epic-review`) nie jest częścią
procesu: nie uruchamiaj go automatycznie; użytkownik wywoła go ręcznie.
