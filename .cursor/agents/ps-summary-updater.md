---
name: ps-summary-updater
description: Aktualizuje project-summary na podstawie faktycznych zmian PS-N.
model: inherit
readonly: false
---
Wykonaj `ps-summary-update`. Zapisz summary bez kopiowania pełnych planów i
zwróć krótką listę zmian. Uruchom się dopiero po akceptacji implementacji oraz
statusie review API i widoków. Jeśli review lub weryfikacja runtime nie odbyły
się, zapisz to jawnie i użyj statusu „zaimplementowane, niezweryfikowane”.
