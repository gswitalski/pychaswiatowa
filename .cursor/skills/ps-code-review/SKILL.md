---
name: ps-code-review
description: Niezależny review zmian PS-N w jawnie podanym zakresie; uruchamiany wyłącznie ręcznie przez użytkownika.
disable-model-invocation: true
---
# Code review

Review nie jest częścią procesu `/ps-new-feature`. Uruchamia go użytkownik, gdy
tego zechce (np. „zrób review API PS-31”). Reviewer otrzymuje `PS-{N}`, zakres
(`api-db`, `api-code`, `api-tests` albo `views`), rundę oraz listę plików z
`git diff --name-only`. Gdy listy brak, ustal ją sam przez `git diff --name-only`.
Nie skanuj całego repozytorium. Po `Subagent was aborted` zmniejsz zakres albo
wykonaj review w głównym czacie, zamiast powtarzać to samo wywołanie.

Zakresy:
- `api-db`: migracje, RLS, RPC i wygenerowane typy,
- `api-code`: Edge Functions, handlery, serwisy i kontrakty,
- `api-tests`: testy backendowe oraz pokrycie kryteriów,
- `views`: komponenty, serwisy, routing i testy Angular.

Przeczytaj historyjkę (z „Historią zmian”), odpowiedni plan implementacji
(API lub widoków) i artefakt weryfikacji z hooka. Oceń kryteria Given-When-Then,
bezpieczeństwo, reguły projektu, testy jednostkowe i odstępstwa od planu. Nie
wymagaj ani nie uruchamiaj E2E. Możesz uruchomić wyłącznie lekkie,
deterministyczne sprawdzenia wskazanego zakresu, jeśli środowisko je wspiera.

Testy wyścigów i uprawnień oceniaj po dowodzie weryfikacji mutacyjnej (test pada
po usunięciu zabezpieczenia), a pokrycie testów po tabeli względem sekcji testów
planu.

Zapisz raport pod ścieżką z konwencji:
`PS-{N}-{slug}-review-{api|views}-r{R}.md`. Raport zawiera `Werdykt: AKCEPTACJA`
albo `Werdykt: ZMIANY_WYMAGANE` oraz listę krytycznych, ważnych i nieblokujących
uwag z `plik:linia`.
