---
name: ps-summary-update
description: Aktualizuje zwięzłe project-summary na podstawie faktycznego diffu PS-N.
disable-model-invocation: true
---
# Aktualizacja summary
Przeczytaj diff kodu, historyjkę, plany i plan wdrożenia. Zaktualizuj bezpośrednio
`docs/results/project-summary.md`: jeden krótki akapit w sekcji stanu oraz
właściwe tabele. Nie kopiuj pełnej historyjki i nie używaj planów jako dowodu
implementacji.

Przed zapisem sprawdź fakty w diffie i kodzie (`git diff`, `rg`). Nie twórz
twierdzeń na podstawie samego braku pliku lub kodu. Dodaj sekcję statusu:

```text
Weryfikacja PS-{N}: API review — PASS/BEZ_REVIEW; widoki review — PASS/BEZ_REVIEW;
migracje — PASS/NIE_WYKONANO; Deno — PASS/NIE_WYKONANO; smoke test — PASS/NIE_WYKONANO.
```

Jeśli jakikolwiek krok ma `NIE_WYKONANO` lub `WYMAGA_WERYFIKACJI`, główny status
funkcji musi brzmieć „zaimplementowane, niezweryfikowane”, a nie „zakończone”.
