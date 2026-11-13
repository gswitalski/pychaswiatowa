---
name: ps-impl-plan
description: Tworzy plany implementacji API i widoków dla PS-N bezpośrednio z historyjki.
disable-model-invocation: true
---
# Plany implementacji

Wejście: `PS-{N}`, slug, ścieżki artefaktów (z `feature-stage.ps1`), opcjonalnie
`odpowiedzi` użytkownika. Przeczytaj historyjkę (z „Decyzje i założenia” oraz
„Historia zmian”) i `docs/results/project-brief.md`. Kontrakty i istniejący kod
czytaj punktowo (`rg`, potem fragment pliku), tylko w obszarze, którego dotyczy
historyjka. Strukturę bazy, RPC, Edge Functions i trasy bierz z
`docs/results/project-reference.md` (generowany z kodu, a przy wątpliwości
sprawdź kod). `project-prd.md` czytaj tylko, gdy potrzebny kontekst produktowy.

## Tryb `plan`
Jedno wywołanie robi całość:
1. Sprawdź, czy historyjka jest wykonalna bez decyzji użytkownika. **Bloker** to
   luka, bez której plan byłby zgadywaniem: sprzeczne lub brakujące scenariusze
   GWT, niejasne uprawnienia, metoda lub kształt API, kody błędów, migracja
   istniejących danych, routing, zachowanie UI przy błędzie.
2. Gdy są blokery i **nie** podano `odpowiedzi`: niczego nie zapisuj; zwróć
   `STATUS: PYTANIA` (najwyżej 3 pytania w formacie z konwencji) oraz listę
   `Założenia`. Gdy `odpowiedzi` są podane, nie pytaj ponownie.
3. Pozostałe luki rozstrzygnij wariantem rekomendowanym i zapisz w sekcji
   „Założenia” planu. Jeśli odpowiedź lub założenie zmienia wymaganie,
   zaktualizuj minimalnie historyjkę i dopisz wiersz do jej „Historii zmian”
   (data, etap `plany`, zmiana, powód).
4. Zapisz oba plany. Przed zapisem sprawdź pokrycie: każdy scenariusz GWT musi
   mieć miejsce w planie API lub widoków i test jednostkowy (sama lista numerów
   scenariuszy w sekcji testów, bez rozbudowanej macierzy). Sprzeczność
   historyjki z kodem zgłoś jako bloker albo założenie.
5. Zwróć `STATUS: ZAPISANO`, ścieżki, listę założeń i zmian w historyjce.

## Plan API
Zapisz w `docs/results/impl-plans/endpoints/`. Zawartość: lista plików,
endpointy (metoda, ścieżka, role), DTO i kontrakty, migracje, RLS/RPC,
walidacja Zod, role JWT, używane kody błędów (200, 201, 204, 400, 401, 402, 403,
404, 409, 422, 500), testy jednostkowe `deno test` (przypadki z numerami
scenariuszy) i komendy weryfikacji. Dla każdej funkcji RPC `security definer`
opisz `revoke`/`grant`. SQL, RLS i RPC cytuj dosłownie tylko dla fragmentów,
w których błąd byłby kosztowny. Sekcja „Czynności ręczne”: kroki poza kodem
i poza GitHub Actions (sekrety, konfiguracja zewnętrznych usług, migracje
produkcyjne) albo „brak”.

## Plan widoków
Zapisz w `docs/results/impl-plans/views/`. Zawartość: routing, standalone
components z prefiksem `pych`, `input()`/`output()`, sygnały, serwisy API,
stany loading/error/empty, Angular Material, responsywność i testy Vitest
(przypadki z numerami scenariuszy). DTO i błędy API tylko przez odwołanie do planu
API, bez kopiowania.

## Warstwa bez zmian
Gdy historyjka nie dotyka warstwy (np. tylko frontend), zapisz w jej pliku planu
jedno zdanie „Nie dotyczy: {powód}” (poniżej 1,5 KB). Skrypt etapu pominie wtedy
implementację tej warstwy.

## Limity
Każdy plan ≤ ~10 KB. Bez przepisywania historyjki. Bez planowania testów E2E.
