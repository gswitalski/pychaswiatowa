# PS-31: Prywatna notatka użytkownika przy przepisie

**Workflow manifest:** `LOCAL-recipe-private-note` (ID robocze pilotażu; docelowe mapowanie **PS-31** / Jira)  
**Status:** wymagania zaakceptowane (2026-11-08) — etap `design` / plan implementacji 047

## Opis

Jako zalogowany użytkownik przeglądający przepis, chcę dodać i edytować **prywatną notatkę** powiązaną z tym przepisem, aby zapisywać osobiste uwagi kulinarne (np. zamienniki składników, własny czas pieczenia, pomysły na następnym razem) bez zmiany treści przepisu i bez udostępniania notatki innym osobom.

## Kontekst

PychaŚwiatowa umożliwia już osobiste oznaczenia przepisu (PS-95: ulubiony / chcę wypróbować) oraz publiczne oceny (PS-99). Brakuje pola na **dłuższą, tekstową notatkę** widoczną wyłącznie dla czytelnika. Zgłoszenie Jira [PS-31](https://gswitalski.atlassian.net/browse/PS-31); w kodzie brak warstwy danych i UI.

Notatka uzupełnia flagi: flagi są binarne i szybkie, notatka przechowuje treść swobodną. Nie zastępuje pól autora (opis, wskazówki, składniki). Po wdrożeniu należy zaktualizować `project-summary.md` (backlog PS-31 oraz spójność sekcji „Granice" względem notatek przy cudzych, widocznych przepisach — spójnie z PS-95).

## Decyzje produktowe (potwierdzone)

| Temat | Decyzja |
|-------|---------|
| Zakres przepisów | **Przepisy, które użytkownik może dziś otworzyć w szczegółach** — własny (dowolna widoczność) lub cudzy `PUBLIC` (jak `set_recipe_flags` / PS-95) |
| Prywatność notatki | Tylko autor notatki widzi i edytuje treść |
| Poza zakresem PS-31 | Cudzy `SHARED` w kolekcji — osobna przyszła User Story (API kolekcji) |
| Format treści | **Zwykły tekst wieloliniowy**, bez Markdown/HTML |
| Zapis w UI | **Przycisk „Zapisz"** + snackbar potwierdzenia |
| Identyfikator | **PS-31** w dokumentacji i Jira |

## Założenia i ograniczenia

- **Prywatność:** tylko użytkownik, który zapisał notatkę, widzi i edytuje jej treść. Autor przepisu, inni użytkownicy i goście **nie** widzą notatki; notatka **nie** pojawia się w publicznych odpowiedziach API dla anonimowych użytkowników.
- **Jeden rekord na parę (użytkownik, przepis).** Brak wersjonowania ani historii zmian w tej historyjce.
- **Gość:** brak sekcji notatki i brak pól notatki w API.
- **Role:** funkcja dla wszystkich zalogowanych (`user`, `premium`, `admin`) bez limitów planu.
- **UI:** edycja wyłącznie na widoku szczegółów `/recipes/:id-:slug` oraz `/explore/recipes/:id-:slug`. **Bez** skrótu notatki na kafelkach list i **bez** filtrowania/wyszukiwania po treści notatki.
- **Treść:** limit **2000 znaków** (założenie techniczne na MVP; do potwierdzenia przy planie API); puste pole po zapisie = brak notatki (wiersz usunięty lub `null`).
- **Notatka nie modyfikuje encji przepisu** (`recipes.updated_at`, wyszukiwanie full-text przepisu bez zmian).
- **Dostępność przepisu (zapis i odczyt `my_note`):** identyczna jak PS-95 — właściciel **lub** `visibility = 'PUBLIC'`, `deleted_at IS NULL`. Cudzy `PRIVATE` / `SHARED` (bez zmian w API dostępu) → brak możliwości zapisu notatki (`404` na `PUT`).
- Gdy użytkownik traci dostęp do przepisu, nie widzi szczegółów; wiersz notatki może pozostać w bazie i wrócić po przywróceniu dostępu. Przy trwałym usunięciu przepisu — `ON DELETE CASCADE`.

## Kryteria akceptacji

### Scenariusz 1: Dodanie notatki do własnego przepisu (happy path)

- **Given**: Zalogowany użytkownik jest na szczegółach **własnego** przepisu i nie ma jeszcze zapisanej notatki.
- **When**: Wpisuje tekst wieloliniowy w sekcji „Moja notatka" (≤ 2000 znaków) i klika „Zapisz".
- **Then**: Notatka zostaje zapisana; po odświeżeniu strony treść jest zachowana; snackbar potwierdza zapis; inni użytkownicy nie widzą notatki.

### Scenariusz 2: Edycja istniejącej notatki

- **Given**: Użytkownik ma zapisaną notatkę przy przepisie.
- **When**: Zmienia treść i klika „Zapisz".
- **Then**: Nowa treść zastępuje poprzednią; po odświeżeniu widoczna jest zaktualizowana wersja.

### Scenariusz 3: Usunięcie notatki (wyczyszczenie pola)

- **Given**: Użytkownik ma niepustą notatkę.
- **When**: Usuwa całą treść i klika „Zapisz".
- **Then**: Notatka nie jest zwracana w API dla tego użytkownika; sekcja pokazuje pusty stan zachęty do wpisania.

### Scenariusz 4: Notatka przy publicznym przepisie innego autora

- **Given**: Zalogowany użytkownik przegląda `/explore/recipes/:id-:slug` przepisu innego autora o widoczności `PUBLIC`.
- **When**: Wpisuje notatkę i klika „Zapisz".
- **Then**: Notatka jest widoczna wyłącznie dla niego po ponownym wejściu na ten przepis; autor i inni użytkownicy jej nie widzą.

### Scenariusz 5: Gość

- **Given**: Niezalogowany użytkownik otwiera publiczny przepis.
- **When**: Strona się ładuje.
- **Then**: Sekcja „Moja notatka" nie jest wyświetlana; odpowiedź API nie zawiera pola notatki osobistej.

### Scenariusz 6: Przekroczenie limitu długości

- **Given**: Użytkownik wpisuje treść dłuższą niż 2000 znaków.
- **When**: Próbuje zapisać.
- **Then**: Zapis jest blokowany w UI z komunikatem walidacji **lub** API zwraca `400`/`422` z czytelnym kodem błędu; poprzednia zapisana treść (jeśli była) pozostaje bez zmian.

### Scenariusz 7: Przepis niedostępny lub brak uprawnień

- **Given**: Użytkownik nie ma dostępu do przepisu (np. cudzy prywatny, usunięty).
- **When**: Wysyła żądanie zapisu notatki do API.
- **Then**: API zwraca `403` lub `404`; notatka nie jest tworzona.

### Scenariusz 8: Błąd sieci / serwera przy zapisie

- **Given**: Użytkownik edytuje notatkę.
- **When**: Zapis kończy się błędem `5xx` lub timeoutem.
- **Then**: Wyświetlany jest snackbar z błędem; w polu pozostaje edytowana treść; użytkownik może ponowić zapis.

### Scenariusz 9: Prywatność między użytkownikami (RLS)

- **Given**: Użytkownik A zapisał notatkę przy publicznym przepisie.
- **When**: Użytkownik B przegląda ten sam przepis (UI i API jako B).
- **Then**: B nie widzi notatki A; próba odczytu/zapisu cudzej notatki przez API jest niemożliwa (RLS / brak pola w odpowiedzi).

## Definicja ukończenia (Definition of Done)

- [ ] Kod zaimplementowany zgodnie z opisem
- [ ] Testy jednostkowe/integracyjne pokrywają scenariusze akceptacji (API + UI)
- [ ] RLS i testy dostępu: użytkownik nie odczytuje cudzej notatki
- [ ] `project-summary.md` zaktualizowany po wdrożeniu
- [ ] Code review zakończone pozytywnie

## Powiązania

- **Jira:** PS-31
- **Wzorce:** PS-95 (zakres widocznych przepisów, RLS, szczegóły), PS-99 (wzorzec snackbarów — opcjonalnie)
- **Poza zakresem:** wyszukiwanie po notatkach, notatki na kafelkach, współdzielone notatki, załączniki, Markdown, historia wersji, autosave, **cudzy SHARED w kolekcji** (przyszła story)
