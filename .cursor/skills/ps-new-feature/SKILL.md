---
name: ps-new-feature
description: Orkiestruje pełny proces historyjki PS-N i wznawia go na podstawie istniejących artefaktów.
disable-model-invocation: true
---
# Nowa funkcjonalność

Wywołanie: `/ps-new-feature PS-{N} [opis]`.

1. Przeczytaj `ps-feature-conventions`, ustal etap i wykonaj preflight środowiska.
   Dla etapu API sprawdź Deno, Supabase CLI, Docker i porty z `supabase/config.toml`.
   Brak narzędzia oznacza `WYMAGA_WERYFIKACJI` przed implementacją.
2. Uruchamiaj subagentów w świeżym kontekście, przekazując tylko ID, tryb, rundę
   i odpowiedzi użytkownika. W trybie pytań analityk sprawdza fakty w kodzie/RLS.
3. Po analizie i planach zatrzymuj się na bramce jakościowej. Awarie narzędzi nie
   są osobną bramką: zastosuj procedurę awaryjną i pytaj dopiero po jej wyczerpaniu.
4. Po planie funkcjonalnym uruchom kontrolę spójności historyjka ↔ API ↔ UI.
   Nie twórz planów implementacji, dopóki sprzeczności nie zostaną rozwiązane.
5. Uruchom równolegle oba planery implementacji, ale widoki dopiero po akceptacji
   API i kontraktów.
6. Po każdej implementacji uruchom review w zakresach `api-db`, `api-code`,
   `api-tests` oraz `views`, przekazując listę plików z diffu. Przy
   `Subagent was aborted` wykonaj najwyżej jedną powtórkę; następnie zmień
   strategię (mniejszy zakres, inny agent/model albo review w głównym czacie).
7. Każdy review zapisz jako artefakt. Gdy review jest niemożliwe, zapisz
   `BEZ_REVIEW` z powodem i `WYMAGA_WERYFIKACJI`; nie oznaczaj funkcji jako gotowej.
8. Po poprawkach implementer wykonuje pełną weryfikację i czyta cały diff.
   Maksymalnie dwie rundy poprawek na zakres.
9. Updater summary działa dopiero po akceptacji implementacji i review albo
   jawnej decyzji użytkownika. W summary umieść statusy review, Deno, migracji
   i smoke testu; nie wyciągaj wniosków z samego braku kodu.
10. Na końcu pokaż checklistę planu wdrożenia i statusy weryfikacji. Nie wdrażaj
    zdalnie; commit wykonuje użytkownik.
