---
name: ps-code-review
description: Niezależny review zmian PS-N w małym, jawnie podanym zakresie.
disable-model-invocation: true
---
# Code review

Reviewer otrzymuje `PS-{N}`, zakres (`api-db`, `api-code`, `api-tests` albo
`views`), rundę oraz listę plików z `git diff --name-only`. Nie skanuj całego
repozytorium i nie powtarzaj tego samego zakresu po aborcie.

Zakresy:
- `api-db`: migracje, RLS, RPC i wygenerowane typy,
- `api-code`: Edge Functions, handlery, serwisy i kontrakty,
- `api-tests`: testy backendowe oraz pokrycie kryteriów,
- `views`: komponenty, serwisy, routing i testy Angular.

Przeczytaj historyjkę (z „Historią zmian”), odpowiedni plan i artefakt
weryfikacji z hooka. Oceń kryteria Given-When-Then, bezpieczeństwo, reguły
projektu, testy jednostkowe i odstępstwa. Nie wymagaj ani nie uruchamiaj E2E.
Możesz uruchomić wyłącznie lekkie, deterministyczne sprawdzenia wskazanego
zakresu, jeśli środowisko je wspiera.

Zapisz raport pod ścieżką z konwencji:
`PS-{N}-{slug}-review-{api|views}-r{R}.md`. Raport musi zawierać:
`Werdykt: AKCEPTACJA`, `Werdykt: ZMIANY_WYMAGANE` albo `Werdykt: BEZ_REVIEW`
oraz listę krytycznych, ważnych i nieblokujących uwag z `plik:linia`.
