# PS-99: Ocenianie przepisu w skali 1–5

## Opis

Jako zalogowany użytkownik, chcę móc ocenić publiczny przepis innego autora w skali 1–5 gwiazdek (z możliwością zmiany lub wycofania oceny), aby wyrazić swoją opinię i pomóc innym użytkownikom w odnalezieniu najlepszych przepisów.

---

## Kontekst

PychaŚwiatowa umożliwia odkrywanie publicznych przepisów w katalogu `/explore`. Brakuje jednak mechanizmu jakościowej oceny przepisów — użytkownicy nie mają narzędzia do wyrażenia opinii ani sygnału pomagającego innym w wyborze najlepszych propozycji kulinarnych. Wprowadzenie systemu ocen zwiększa wartość katalogu publicznego jako społecznościowego źródła wiedzy kulinarnej i wspiera zaangażowanie użytkowników.

> **Uwaga:** Funkcjonalności społecznościowe (w tym oceny) były pierwotnie poza zakresem MVP. Niniejsza historyjka celowo rozszerza zakres produktu — wymagana jest świadoma decyzja o wdrożeniu i aktualizacja `project-summary.md`.

---

## Założenia i ograniczenia

- Ocenianie dotyczy wyłącznie przepisów o widoczności **`PUBLIC`**. Przepisy `PRIVATE` i `SHARED` nie mogą być oceniane.
- Autor przepisu **nie może** oceniać własnych przepisów (przycisk oceny jest dla niego ukryty/nieaktywny).
- Każdy zalogowany użytkownik może wystawić **co najwyżej jedną ocenę** na dany przepis.
- Ocena może być **zmieniona** (wybranie innej gwiazdki) lub **wycofana** (ponowne kliknięcie tej samej gwiazdki lub dedykowany przycisk usunięcia).
- **Średnia ocen i liczba głosów** są widoczne publicznie — dla wszystkich użytkowników, w tym gości.
- **Własna ocena użytkownika** (podświetlone gwiazdki) widoczna jest wyłącznie dla zalogowanego.
- W zakresie tej historyjki: oceny wyświetlane są tylko na **widoku szczegółowym przepisu** (`/recipes/:id-:slug`, `/explore/recipes/:id-:slug`). Kafelki na listach pozostają poza zakresem.
- Operacja zapisu/zmiany/usunięcia oceny jest **idempotentna** — wielokrotne wysłanie tej samej wartości nie tworzy duplikatu.
- Baza danych: nowa tabela `recipe_ratings` z RLS; agregaty (`average_rating`, `ratings_count`) wyliczane w bazie lub warstwie API.
- Ograniczenie techniczne: przy równoczesnych zapisach możliwa minimalna rozbieżność agregatu — akceptowalne w fazie wdrożenia.

---

## Kryteria akceptacji

### Scenariusz 1: Zalogowany użytkownik ocenia publiczny przepis innego autora (happy path)

- **Given**: Użytkownik jest zalogowany, przegląda widok szczegółowy publicznego przepisu, którego **nie jest** autorem, i jeszcze **nie wystawił** dla niego oceny.
- **When**: Klika jedną z 5 gwiazdek w komponencie ocen.
- **Then**:
    - Ocena zostaje zapisana w systemie.
    - Wybrana gwiazdka (i wszystkie niższe) są wizualnie podświetlone.
    - Wyświetlona średnia i liczba głosów aktualizują się (optimistic update lub odświeżenie po zapisie).
    - Pojawia się krótki komunikat potwierdzający (snackbar „Twoja ocena została zapisana").
    - Po odświeżeniu strony stan gwiazdek i aktualna średnia są zachowane.

### Scenariusz 2: Zalogowany użytkownik zmienia swoją ocenę

- **Given**: Użytkownik jest zalogowany i **posiada** już wystawioną ocenę dla przepisu.
- **When**: Klika inną gwiazdkę niż aktualnie wybrana.
- **Then**:
    - Poprzednia ocena zostaje zastąpiona nową.
    - Komponent gwiazdek odzwierciedla nową wartość.
    - Średnia i liczba głosów aktualizują się.
    - Snackbar informuje: „Twoja ocena została zaktualizowana".

### Scenariusz 3: Zalogowany użytkownik wycofuje swoją ocenę

- **Given**: Użytkownik jest zalogowany i **posiada** już wystawioną ocenę dla przepisu.
- **When**: Klika tę samą gwiazdkę, która jest aktualnie wybrana (toggle) **lub** używa dedykowanego przycisku/akcji usunięcia oceny.
- **Then**:
    - Ocena zostaje usunięta z systemu.
    - Gwiazdki wracają do stanu „brak oceny" (wszystkie puste).
    - Liczba głosów spada o 1, średnia jest przeliczana.
    - Snackbar informuje: „Twoja ocena została usunięta".

### Scenariusz 4: Gość (niezalogowany) przegląda oceny

- **Given**: Użytkownik **nie jest** zalogowany i przegląda widok szczegółowy publicznego przepisu.
- **When**: Strona się ładuje.
- **Then**:
    - Widoczna jest średnia ocen i liczba głosów (np. „★ 4,3 / 5 · 27 ocen").
    - Gwiazdki są wyświetlone w trybie tylko do odczytu (nieinteraktywne).
    - Brak przycisku/komponentu umożliwiającego wystawienie oceny.
    - Opcjonalnie: tooltip lub komunikat „Zaloguj się, aby ocenić".

### Scenariusz 5: Autor próbuje ocenić własny przepis

- **Given**: Zalogowany użytkownik przegląda widok szczegółowy **własnego** publicznego przepisu.
- **When**: Strona się ładuje.
- **Then**:
    - Komponent interaktywnych gwiazdek **nie jest** wyświetlony lub jest nieaktywny (disabled).
    - Wyświetlana jest informacja „Nie możesz oceniać własnych przepisów" (tooltip lub komunikat inline).
    - Średnia i liczba głosów od innych użytkowników są nadal widoczne.

### Scenariusz 6: Próba oceny przepisu niepublicznego

- **Given**: Zalogowany użytkownik posiada link do widoku szczegółowego przepisu `PRIVATE` lub `SHARED` innego użytkownika.
- **When**: Próbuje wykonać żądanie `PUT /recipes/{id}/rating`.
- **Then**:
    - API zwraca `403 Forbidden` lub `404 Not Found` (przepis nie jest publicznie dostępny).
    - Frontend nie wyświetla komponentu ocen dla przepisów niepublicznych.

### Scenariusz 7: Błąd zapisu oceny (problem sieciowy / błąd serwera)

- **Given**: Użytkownik jest zalogowany i klika gwiazdkę.
- **When**: Żądanie do API kończy się błędem (`5xx` lub timeout).
- **Then**:
    - Komponent gwiazdek wraca do poprzedniego stanu (rollback optimistic update).
    - Snackbar wyświetla komunikat błędu: „Nie udało się zapisać oceny. Spróbuj ponownie."
    - Brak zapisu w bazie danych.

### Scenariusz 8: Przepis nie ma jeszcze żadnych ocen

- **Given**: Dowolny użytkownik (zalogowany lub gość) przegląda przepis, który nie ma żadnej oceny.
- **When**: Strona się ładuje.
- **Then**:
    - Wyświetlane jest „Brak ocen" lub pustych 5 gwiazdek z liczbą „0 ocen".
    - Brak średniej liczbowej (nie wyświetlamy np. „0,0").
    - Zalogowany, niebędący autorem widzi interaktywne gwiazdki z zachętą do pierwszej oceny.

---

## Definicja ukończenia (Definition of Done)

- [ ] Nowa tabela `recipe_ratings` w bazie danych z RLS (użytkownik odczytuje i modyfikuje własne oceny; agregaty dostępne publicznie).
- [ ] Migracja SQL z indeksami i politykami RLS.
- [ ] Endpoint `PUT /recipes/{id}/rating` (upsert lub usunięcie przy `null`) z walidacją zakresu 1–5, blokowaniem autora i weryfikacją widoczności `PUBLIC`.
- [ ] Agregaty `average_rating` (zaokrąglone do 1 miejsca po przecinku) i `ratings_count` zwracane w odpowiedzi `GET /recipes/{id}` oraz `GET /public/recipes/{id}`.
- [ ] Pole `my_rating` (wartość 1–5 lub `null`) w odpowiedzi szczegółów przepisu dla zalogowanego użytkownika.
- [ ] Komponent Angular `RecipeRatingComponent` z interaktywną obsługą gwiazdek (hover, select, toggle wycofalnia, disabled state dla autora i gościa).
- [ ] Integracja komponentu na widokach `/recipes/:id-:slug` i `/explore/recipes/:id-:slug`.
- [ ] Optimistic update + rollback przy błędzie API.
- [ ] Testy jednostkowe `RecipeRatingComponent` i serwisu (scenariusze 1–8).
- [ ] Testy E2E (Playwright): ocenianie, zmiana, wycofanie, widok gościa, blokada autora.
- [ ] Code review zakończone pozytywnie.
- [ ] Aktualizacja `docs/results/project-summary.md`: nowa tabela `recipe_ratings`, nowy endpoint, nowe pola w odpowiedziach API, przeniesienie „ocen" z sekcji „Granice" do zrealizowanych funkcjonalności.

---

## Powiązania

- **Nowy endpoint API:** `PUT /recipes/{id}/rating`
- **Rozszerzone endpointy:** `GET /recipes/{id}`, `GET /public/recipes/{id}`, `GET /explore/recipes/{id}` — nowe pola: `average_rating`, `ratings_count`, `my_rating`
- **Nowa tabela DB:** `recipe_ratings`
- **Powiązane historyjki:**
    - PS-95 — Osobiste flagi przepisu (analogiczny wzorzec `user_recipe_flags`: upsert, RLS, optimistic update)
    - PS-96 — Filtry w katalogu Odkrywaj (potencjalne przyszłe rozszerzenie: sortowanie/filtr po ocenie)
    - US-004 — Przeglądanie szczegółów przepisu (widok, na którym pojawia się komponent)
    - US-019 — Szczegóły publicznego przepisu (widok publiczny)
