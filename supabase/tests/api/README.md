# Lokalne smoke testy API (gate `localApi`)

Scenariusze `*.smoke.json` uruchamia `node .cursor/scripts/local-api-smoke.cjs`
(zwykle przez `node .cursor/scripts/quality.cjs run <ID> localApi`). Działają wyłącznie na lokalnym Supabase.

- Każda zmieniona Edge Function MUSI mieć scenariusz `<funkcja>.smoke.json`. Brak scenariusza = błąd gate'u.
- Zmiana w `_shared` uruchamia wszystkie scenariusze.
- Krok: `name`, `method`, `path` (względem funkcji, od `/`; `""` = korzeń funkcji), `as` (`anon|owner|other`),
  opcjonalnie `function` (wywołanie innej funkcji), `body`, `expect.status` (liczba lub lista),
  `expect.json` (ścieżka z kropkami → wartość albo `{"$type"|"$exists"|"$absent"|"$minLength": ...}`),
  `save` (zmienna → ścieżka w odpowiedzi). Zmienne: `{rand}` oraz zapisane przez `save`.
  `{"$repeat": {"char": "a", "count": 2001}}` generuje długi tekst.
- `cleanup` wykonuje się zawsze; jego błędy są tylko ostrzeżeniami.

## Dane testowe

Domyślnie skrypt tworzy efemerycznych użytkowników przez Admin API lokalnego GoTrue i usuwa ich po teście.
Opcjonalnie można podać własne konta wyłącznie lokalnymi zmiennymi środowiskowymi (nie zapisuj ich w repozytorium):
`LOCAL_API_USER_EMAIL`, `LOCAL_API_USER_PASSWORD` (owner), `LOCAL_API_OTHER_EMAIL`, `LOCAL_API_OTHER_PASSWORD` (other).
