# PS-31: Osobista notatka użytkownika do przepisu

## Opis

Jako zalogowany użytkownik przeglądający przepis (własny lub cudzy publiczny, także ten, który mam w swoich kolekcjach), chcę zapisać do niego krótką, prywatną notatkę tekstową (np. „zmniejszyć ilość cukru o połowę", „dzieci wolą bez chili"), aby przy kolejnym gotowaniu mieć pod ręką własne uwagi bez zmieniania samego przepisu i bez ujawniania ich innym osobom.

## Kontekst

PychaŚwiatowa to cyfrowa książka kucharska, w której użytkownik gromadzi własne przepisy oraz korzysta z publicznych przepisów innych autorów (`/explore`, kolekcje zawierające cudze przepisy `PUBLIC`). Dziś jedynym miejscem na własne uwagi do własnego przepisu jest jego treść (opis, wskazówki) — edycja zmienia sam przepis. Przy cudzym przepisie użytkownik nie może zapisać żadnej własnej uwagi (przepis jest tylko do odczytu), a wymaganie „notatki użytkownika przy cudzym przepisie" jest dziś wprost wymienione w sekcji „Granice" `project-summary.md` jako poza zakresem.

Notatka musi być **osobna dla każdej pary (użytkownik, przepis)**: nie może być kolumną w `recipes`, bo przepis może być cudzy i publiczny. Wymaga to nowej tabeli powiązanej z użytkownikiem (z RLS), nowego endpointu zapisu oraz rozszerzenia odpowiedzi szczegółów przepisu i widoku szczegółów. Funkcja jest bliźniacza względem osobistych flag (PS-95) i ocen (PS-99) — korzysta z tych samych wzorców (tabela per użytkownik, RPC `security invoker`, pole „moje" widoczne tylko dla JWT, optimistic update/rollback, snackbar).

Zakres: **dodawanie, edycja i usuwanie notatki na widoku szczegółów przepisu** oraz jej odczyt w szczegółach. Wskaźnik na kafelkach, filtrowanie i wyszukiwanie po notatkach są **poza zakresem**.

## Założenia i ograniczenia

### Zakres notatki i dostępność przepisów (sprawdzone w kodzie i RLS)

- **Jedna notatka na parę (użytkownik, przepis)**, zwykły tekst wielolinijkowy, bez Markdown i HTML (tekst jest wyświetlany jako tekst z zachowaniem łamań linii, nigdy jako HTML).
- **Notatkę można dodać do każdego przepisu dostępnego dla użytkownika.** „Dostępny" jest zdefiniowany identycznie jak w PS-95 i dla kolekcji: przepis nieusunięty (`deleted_at IS NULL`) **i** (własny — dowolna widoczność **lub** cudzy `PUBLIC`). Zestawienie z kodem (polityki RLS `recipes` oraz `recipe_collections` z migracji `20260210153000_update_public_recipe_collection_rls.sql`):

  | Przepis | Notatka dozwolona? | Uwagi |
  |---|---|---|
  | Własny `PRIVATE` / `SHARED` / `PUBLIC` | tak | |
  | Cudzy `PUBLIC` (z `/explore`, linku lub z mojej kolekcji) | tak | |
  | Cudzy `SHARED` | **nie** | `SHARED` to dziś tylko „udostępnianie linkiem"; RLS `recipes` oraz `recipe_collections` dopuszcza cudze przepisy wyłącznie `PUBLIC`, a `GET /recipes/{id}` zwraca dla cudzego nie-`PUBLIC` `403`. Nie da się też dodać cudzego `SHARED` do kolekcji. Nie ma więc scenariusza „cudzy SHARED dostępny przez kolekcję". |
  | Cudzy `PRIVATE` | nie | niedostępny |
  | Cudzy przepis w mojej kolekcji, który autor zmienił na `PRIVATE`/`SHARED` lub usunął | nie (tymczasowo) | przepis znika z widoków; patrz „Przepis niedostępny" |

- **Brak zmian w politykach RLS przepisów i kolekcji.** Kryterium widoczności dla notatki to ten sam predykat co w PS-95 (`user_recipe_flags`); kolekcje nie wprowadzają osobnej ścieżki dostępu — przepis w kolekcji jest dostępny tylko, jeśli spełnia powyższy predykat. Jeśli w przyszłości `SHARED` zostanie udostępniony innym użytkownikom, predykat notatki trzeba będzie rozszerzyć w tej samej historyjce, która zmieni RLS przepisów.
- **Notatki są prywatne.** Widzi je wyłącznie ich autor (RLS `auth.uid() = user_id`). Autor przepisu, inni użytkownicy, admin (w UI) i gość nie widzą cudzych notatek; notatka nie jest nigdzie publikowana ani eksportowana.
- **Dla wszystkich zalogowanych ról** (`user`, `premium`, `admin`), bez limitów liczby notatek i bez różnic między rolami. Gość nie widzi sekcji notatki ani CTA; pole `my_note` nie jest zwracane w odpowiedziach dla anonimowego użytkownika.
- **Dozwolone także dla autora przepisu** (własny przepis, dowolna widoczność). Notatka jest niezależna od treści przepisu i nie zastępuje opisu ani wskazówek.

### Walidacja i format

- **Limit 2000 znaków**, minimum 1 znak (po obcięciu). Długość liczona w znakach Unicode (code points), spójnie na froncie, w API i w bazie (`char_length`), tak aby emoji nie powodowały rozbieżności licznika z walidacją serwera.
- **Trim po stronie API:** białe znaki na początku i końcu są obcinane; zakończenia linii normalizowane do `\n`. Wewnętrzne łamania linii i puste linie między akapitami pozostają.
- **Pusta notatka = usunięcie.** `note: null`, `""` lub same białe znaki usuwają notatkę (jeśli istnieje) i zwracają `200` z `note: null`. Usunięcie nieistniejącej notatki jest idempotentne (`200`).
- Zapis jest **idempotentny** (ostatni zapis wygrywa — brak wykrywania konfliktów między kartami przeglądarki).

### Wpływ na resztę systemu

- **Zmiana notatki nie modyfikuje przepisu:** nie zmienia `updated_at` przepisu, nie uruchamia joba normalizacji składników, nie wpływa na `search_vector`.
- **Notatka nie uczestniczy w:** wyszukiwaniu (landing, `/explore`, „Moje przepisy", wyszukiwarka globalna), filtrach, asystencie i generowaniu AI (opis, zdjęcie, draft), normalizacji składników, „Moim planie", liście zakupów, wydruku przepisu ani w żadnym eksporcie. Zakładany wydruk/PDF przepisu pomija notatkę.
- **Brak notatek w formularzu edycji przepisu** (`/recipes/:id/edit`, `/recipes/new`) — notatka jest edytowana wyłącznie na szczegółach przepisu.
- **Kafelki list (w tym „Moje przepisy", dashboard, kolekcje, `/explore`, landing) nie pokazują wskaźnika notatki** i nie ma filtra „z notatką" — ewentualne rozszerzenie to osobna historyjka.

### Przepis niedostępny i kasowanie

- **Przepis niedostępny dla użytkownika** (soft-delete, autor zmienił widoczność z `PUBLIC` na `PRIVATE`/`SHARED`) znika z jego widoków wraz z notatką; notatka nie jest zwracana, a `PUT /recipes/{id}/note` zwraca `404`. **Wiersz notatki pozostaje w bazie** i jest znów widoczny, jeśli przepis wróci do dostępnych (np. ponownie `PUBLIC` lub przywrócony z soft-delete).
- **Trwałe usunięcie przepisu lub konta użytkownika usuwa notatki kaskadowo** (`ON DELETE CASCADE` na `recipe_id` i `user_id`).
- Soft-delete przepisu nie kasuje notatki (zgodnie z PS-95).

### Interfejs (założenia)

- **Miejsce:** sekcja „Moja notatka" na widoku szczegółów: `/recipes/:id-:slug` (przepis własny lub cudzy publiczny) oraz `/explore/recipes/:id-:slug` (publiczny, dla zalogowanego). Zalogowany widzi sekcję; gość — wcale.
- **Stan pusty:** przycisk „Dodaj notatkę" (CTA). Po kliknięciu sekcja przechodzi w tryb edycji inline (wielolinijkowe pole `textarea`, auto-focus).
- **Tryb edycji:** przyciski „Zapisz", „Anuluj" i (dla istniejącej notatki) „Usuń"; licznik znaków „X / 2000" (po przekroczeniu — stan błędu i zablokowany „Zapisz"); „Zapisz" nieaktywne dla pustej treści przy braku istniejącej notatki oraz przy braku zmian.
- **Tryb odczytu** (notatka istnieje): treść wyświetlana jako tekst z zachowaniem łamań linii, przycisk „Edytuj". Dłuższe notatki zawijają się; sekcja nie zmienia wysokości nagłówka przepisu.
- **Ostrzeżenie o niezapisanych zmianach:** przy próbie opuszczenia widoku z niezapisaną zmianą (nawigacja wewnątrz SPA — w tym przejście do innego przepisu — oraz zamknięcie/odświeżenie karty) pojawia się ostrzeżenie; użytkownik może zostać lub porzucić zmiany. „Anuluj" porządkuje stan edycji do ostatnio zapisanej treści.
- **Zapis i błędy (jak w PS-95/PS-99):** podczas zapisu przyciski są zablokowane (ochrona przed podwójnym kliknięciem). Przy błędzie wpisany tekst **nie jest tracony** — sekcja pozostaje w trybie edycji z treścią użytkownika i wyświetla się snackbar; przy nieudanym usunięciu notatka jest przywracana (rollback do stanu sprzed akcji).
- **Dostępność:** `textarea` ma etykietę (`aria-label` „Moja notatka"), licznik jest ogłaszany (`aria-live="polite"`), przyciski są dostępne z klawiatury, widoczny fokus.
- **Założenie (luka w wymaganiach):** teksty snackbarów: „Notatka została zapisana", „Notatka została usunięta", błąd: „Nie udało się zapisać notatki. Spróbuj ponownie."; placeholder: „Twoje prywatne uwagi do tego przepisu…"; podpis pomocniczy sekcji: „Widoczna tylko dla Ciebie."
- **Założenie (luka w wymaganiach):** „Usuń" wymaga potwierdzenia (dialog „Usunąć notatkę? Tej operacji nie można cofnąć.") — usunięcie jest nieodwracalne, a tekst bywa długi.
- **Założenie (luka w wymaganiach):** sekcja „Moja notatka" umieszczona jest pod treścią przepisu (po składnikach, krokach i wskazówkach), a na mobile jest rozwijana domyślnie, gdy notatka istnieje; dokładne rozmieszczenie dopasowuje się do design systemu przy implementacji.

### Założenia techniczne (propozycja)

- **Tabela `user_recipe_notes`:** `user_id uuid` FK → `auth.users` `ON DELETE CASCADE`, `recipe_id bigint` FK → `recipes` `ON DELETE CASCADE`, `note text NOT NULL` z `CHECK (char_length(note) BETWEEN 1 AND 2000)`, `created_at`, `updated_at` (trigger `handle_updated_at`), klucz główny `(user_id, recipe_id)`, indeks po `recipe_id`.
- **RLS:** SELECT/DELETE tylko właściciel (`auth.uid() = user_id`); INSERT/UPDATE tylko właściciel **i** przepis dostępny (`deleted_at IS NULL AND (recipes.user_id = auth.uid() OR recipes.visibility = 'PUBLIC')`) — identycznie jak `user_recipe_flags`. `anon` bez dostępu.
- **RPC `set_recipe_note(p_recipe_id bigint, p_note text)`** — `security invoker`, `search_path = ''`, wykonywalne tylko dla `authenticated`: sprawdza dostępność przepisu (`P0002` → `404`), przy pustej/`NULL` notatce usuwa wiersz, w przeciwnym razie upsert; zwraca `recipe_id`, `note` (lub `NULL`), `updated_at`.
- **Endpoint `PUT /recipes/{id}/note`** (Edge Function `recipes`, JWT wymagany) z ciałem `{ "note": string | null }`; odpowiedź `200` `{ recipe_id, note: string | null, updated_at: string | null }`. Walidacja Zod (typ, długość po trim, limit 2000), kody błędów `400` (walidacja), `401` (brak/nieprawidłowy JWT), `404` (przepis nieistniejący lub niedostępny), spójny format błędu `{ code, message, details }`. Rola użytkownika nie ma znaczenia; `user_id` wyłącznie z JWT.
- **Odczyt:** pole `my_note: string | null` w `GET /recipes/{id}` oraz `GET /public/recipes/{id}` i — jeśli szczegóły zwraca także funkcja `explore` — w jej odpowiedzi szczegółów; pole zwracane **wyłącznie** dla żądań z ważnym JWT (dla gościa nie występuje w JSON). Listy (`GET /recipes`, feedy, `/public/recipes`, kolekcje) **nie** zawierają notatki.
- **Kontrakt:** nowe typy DTO w `shared/contracts/types.ts` (`SetRecipeNoteRequestDto`, `RecipeNoteResponseDto`, rozszerzenie szczegółów przepisu o `my_note?`).
- **Aktualizacja dokumentacji:** `project-summary.md` — sekcja „Granice" (patrz „Powiązania"), tabele i RLS (sekcja 4), endpointy (sekcja 5), widoki (sekcja 6), „Stan realizacji" oraz usunięcie PS-31 z backlogu po wdrożeniu.

## Kryteria akceptacji

### Scenariusz 1: Dodanie notatki do własnego przepisu (happy path)

- **Given**: Zalogowany użytkownik (dowolna rola) jest na `/recipes/:id-:slug` swojego przepisu (dowolna widoczność), który nie ma jego notatki.
- **When**: Klika „Dodaj notatkę", wpisuje wielolinijkowy tekst i klika „Zapisz".
- **Then**: Wysyłane jest `PUT /recipes/{id}/note` z `{ "note": "<tekst>" }`; po `200` sekcja przechodzi w tryb odczytu z zachowaniem łamań linii, a snackbar informuje „Notatka została zapisana"; po odświeżeniu strony notatka nadal jest widoczna (`my_note` w `GET /recipes/{id}`).

### Scenariusz 2: Notatka do cudzego przepisu publicznego

- **Given**: Zalogowany użytkownik jest na `/explore/recipes/:id-:slug` (lub `/recipes/:id-:slug`) przepisu innego autora o widoczności `PUBLIC`.
- **When**: Dodaje i zapisuje notatkę.
- **Then**: Notatka zostaje zapisana i wyświetlona; przepis, jego autor ani `updated_at` przepisu nie ulegają zmianie; autor nie widzi żadnej informacji o notatce.

### Scenariusz 3: Notatka do cudzego przepisu z mojej kolekcji

- **Given**: Użytkownik ma w swojej kolekcji cudzy przepis `PUBLIC` i otwiera go ze szczegółów kolekcji (`/collections/:id` → szczegóły przepisu).
- **When**: Dodaje notatkę.
- **Then**: Notatka jest zapisana (przepis jest dostępny, bo spełnia predykat „własny lub `PUBLIC`") i widoczna przy każdym otwarciu tego przepisu — niezależnie od tego, czy użytkownik wchodzi z kolekcji, z `/explore` czy z linku. Przynależność do kolekcji nie jest warunkiem ani nie zmienia sposobu zapisu notatki.

### Scenariusz 4: Cudzy przepis `SHARED` lub `PRIVATE` nie obsługuje notatek

- **Given**: Zalogowany użytkownik zna `id` cudzego przepisu `SHARED` lub `PRIVATE`.
- **When**: Wywołuje `PUT /recipes/{id}/note` (np. ręcznie lub ze starej karty).
- **Then**: API zwraca `404` (przepis niedostępny dla użytkownika w sensie RLS/RPC); żaden wiersz nie powstaje. Widok szczegółów takiego przepisu nie jest dostępny, więc UI nie oferuje CTA „Dodaj notatkę".

### Scenariusz 5: Edycja istniejącej notatki

- **Given**: Użytkownik ma zapisaną notatkę przy przepisie.
- **When**: Klika „Edytuj", zmienia tekst i klika „Zapisz".
- **Then**: Poprzednia treść zostaje zastąpiona nową (`PUT` z nowym `note`), `updated_at` notatki jest aktualizowane, `created_at` pozostaje bez zmian; snackbar „Notatka została zapisana".

### Scenariusz 6: Usunięcie notatki przyciskiem „Usuń"

- **Given**: Użytkownik ma zapisaną notatkę i jest w trybie edycji (lub odczytu z akcją usuwania).
- **When**: Klika „Usuń" i potwierdza w dialogu.
- **Then**: Wysyłane jest `PUT /recipes/{id}/note` z `{ "note": null }`; po `200` sekcja wraca do stanu pustego z CTA „Dodaj notatkę", snackbar „Notatka została usunięta"; wiersz w bazie jest usunięty.

### Scenariusz 7: Pusta notatka usuwa notatkę

- **Given**: Użytkownik ma zapisaną notatkę.
- **When**: W trybie edycji czyści pole (lub wpisuje same spacje/znaki nowej linii) i zapisuje, albo wywołuje API z `note: ""` / `note: "   "`.
- **Then**: Efekt jest taki sam jak usunięcie: `200` z `note: null`, wiersz usunięty. Powtórzenie żądania jest idempotentne (`200`).

### Scenariusz 8: Trim i normalizacja po stronie API

- **Given**: Użytkownik wysyła notatkę `"  Mniej soli\r\n\r\nWięcej pieprzu  "`.
- **When**: API zapisuje notatkę.
- **Then**: Zapisana treść to `"Mniej soli\n\nWięcej pieprzu"` (obcięte brzegi, `\n` jako łamanie linii, wewnętrzna pusta linia zachowana); odpowiedź `200` zwraca zapisaną (przyciętą) wartość, a UI wyświetla dokładnie tę wartość.

### Scenariusz 9: Limit 2000 znaków i licznik

- **Given**: Użytkownik jest w trybie edycji notatki.
- **When**: Wpisuje tekst; licznik pokazuje „X / 2000". Po przekroczeniu 2000 znaków próbuje zapisać.
- **Then**: Licznik przechodzi w stan błędu, przycisk „Zapisz" jest zablokowany, żądanie nie jest wysyłane. Notatka dokładnie 2000 znaków (także z emoji liczonymi jako pojedyncze znaki Unicode) jest akceptowana. Bezpośrednie wywołanie API z >2000 znaków (po trim) zwraca `400` z komunikatem walidacji, a istniejąca notatka nie jest zmieniana.

### Scenariusz 10: Treść jest zawsze traktowana jako zwykły tekst

- **Given**: Użytkownik wpisuje `<script>alert(1)</script>`, `**pogrubienie**` lub `<b>tekst</b>`.
- **When**: Zapisuje notatkę i ją wyświetla.
- **Then**: Treść jest przechowywana i wyświetlana dosłownie jako tekst (bez renderowania HTML/Markdown, bez wykonania skryptu).

### Scenariusz 11: Anulowanie edycji

- **Given**: Użytkownik jest w trybie edycji (nowa notatka lub zmiana istniejącej) i zmienił treść.
- **When**: Klika „Anuluj".
- **Then**: Zmiany są odrzucone, wyświetlana jest ostatnio zapisana treść (lub stan pusty z CTA), żadne żądanie do API nie jest wysyłane.

### Scenariusz 12: Ostrzeżenie o niezapisanych zmianach

- **Given**: Użytkownik edytuje notatkę i ma niezapisane zmiany.
- **When**: Próbuje przejść do innego widoku (np. kliknąć w nawigację lub link do innego przepisu) albo zamknąć/odświeżyć kartę.
- **Then**: Wyświetla się ostrzeżenie o niezapisanych zmianach; po wybraniu „Zostań" użytkownik pozostaje w edycji z zachowaną treścią, po wybraniu „Opuść" nawigacja jest kontynuowana, a zmiany przepadają. Gdy zmian nie ma (treść taka jak zapisana), ostrzeżenie się nie pojawia.

### Scenariusz 13: Błąd zapisu notatki

- **Given**: Użytkownik kliknął „Zapisz", a `PUT /recipes/{id}/note` zwraca błąd (np. `500`, brak sieci).
- **When**: Żądanie kończy się niepowodzeniem.
- **Then**: Wyświetla się snackbar „Nie udało się zapisać notatki. Spróbuj ponownie."; sekcja pozostaje w trybie edycji z wpisanym tekstem (nic nie jest tracone), przyciski znów są aktywne; stan zapisany wcześniej nie zmienia się.

### Scenariusz 14: Błąd usunięcia notatki (rollback)

- **Given**: Użytkownik ma zapisaną notatkę i potwierdził „Usuń", a żądanie zwraca błąd.
- **When**: Odpowiedź błędu dociera do UI.
- **Then**: Notatka jest przywrócona do stanu sprzed usunięcia (rollback), wyświetla się snackbar błędu jak w scenariuszu 13.

### Scenariusz 15: Ochrona przed podwójnym kliknięciem

- **Given**: Zapis lub usunięcie notatki jest w toku.
- **When**: Użytkownik ponownie klika „Zapisz" lub „Usuń".
- **Then**: Przyciski są zablokowane (`disabled`), nie jest wysyłane drugie żądanie; po zakończeniu przyciski znów reagują.

### Scenariusz 16: Prywatność notatki

- **Given**: Użytkownik A zapisał notatkę przy publicznym przepisie.
- **When**: Użytkownik B (lub autor przepisu, lub gość) otwiera ten sam przepis.
- **Then**: Użytkownik B widzi wyłącznie własną notatkę (lub CTA „Dodaj notatkę", jeśli jej nie ma); notatka A nie pojawia się w odpowiedzi API ani w UI. Użytkownik B nie może odczytać ani zmodyfikować notatki użytkownika A (RLS `auth.uid() = user_id`); `PUT` operuje zawsze na notatce z `user_id` pochodzącego z JWT.

### Scenariusz 17: Gość nie ma notatek

- **Given**: Niezalogowany użytkownik jest na `/explore/recipes/:id-:slug`.
- **When**: Przegląda szczegóły przepisu publicznego.
- **Then**: Sekcja „Moja notatka" ani CTA nie są wyświetlane; odpowiedź `GET /public/recipes/{id}` nie zawiera pola `my_note`; `PUT /recipes/{id}/note` bez JWT zwraca `401`.

### Scenariusz 18: Wygasła sesja

- **Given**: Sesja wygasła w trakcie edycji notatki.
- **When**: Użytkownik klika „Zapisz".
- **Then**: API zwraca `401`; obsługa zgodna z istniejącym mechanizmem aplikacji (przekierowanie do logowania); notatka nie jest utrwalona. Niezapisany tekst nie jest gubiony przed przekierowaniem bez ostrzeżenia (obowiązuje scenariusz 12).

### Scenariusz 19: Przepis staje się niedostępny, a potem wraca

- **Given**: Użytkownik zapisał notatkę przy cudzym przepisie `PUBLIC`, a autor zmienił jego widoczność na `PRIVATE` (lub przepis został usunięty miękko).
- **When**: Użytkownik próbuje otworzyć przepis lub wywołać `PUT /recipes/{id}/note`; następnie autor przywraca widoczność `PUBLIC`.
- **Then**: W stanie niedostępnym przepis (i jego notatka) nie jest widoczny, a `PUT` zwraca `404` (UI pokazuje komunikat błędu jak w scenariuszu 13). Wiersz notatki pozostaje w bazie; po powrocie przepisu do dostępnych notatka jest ponownie widoczna na szczegółach.

### Scenariusz 20: Kasowanie kaskadowe

- **Given**: Istnieją notatki użytkowników do przepisu lub użytkownik ma notatki do wielu przepisów.
- **When**: Przepis zostaje trwale usunięty (hard delete), lub konto użytkownika zostaje usunięte.
- **Then**: Powiązane wiersze `user_recipe_notes` są usuwane kaskadowo (odpowiednio: wszystkie notatki do przepisu; wszystkie notatki użytkownika), bez błędów integralności. Zwykły soft-delete przepisu nie usuwa notatek.

### Scenariusz 21: Walidacja żądania

- **Given**: Zalogowany użytkownik wywołuje `PUT /recipes/{id}/note`.
- **When**: Ciało jest puste, brak pola `note`, `note` ma typ inny niż `string | null`, zawiera nieznane pola, `id` nie jest poprawną liczbą lub notatka przekracza 2000 znaków po trim.
- **Then**: API zwraca `400` z komunikatem walidacji w formacie `{ code, message, details }`; dane nie są modyfikowane. Przepis o nieistniejącym `id` zwraca `404`.

### Scenariusz 22: Wszystkie role i brak limitów

- **Given**: Użytkownik z rolą `user`, `premium` lub `admin`.
- **When**: Dodaje notatki do wielu przepisów.
- **Then**: Każda rola może zapisać notatkę do każdego dostępnego przepisu; nie ma limitu liczby notatek ani komunikatów o planie.

### Scenariusz 23: Brak wpływu na przepis i pozostałe funkcje

- **Given**: Użytkownik (autor lub nie) dodaje, zmienia lub usuwa notatkę.
- **When**: Zmiana zostaje zapisana.
- **Then**: Pole `updated_at` przepisu, jego treść, `search_vector`, status normalizacji składników, „Mój plan" i lista zakupów nie zmieniają się; wyszukiwanie po fragmencie notatki nie zwraca przepisu; kafelki na listach nie pokazują żadnego wskaźnika notatki; formularz edycji przepisu nie zawiera pola notatki; asystent AI nie otrzymuje treści notatki.

### Scenariusz 24: Dostępność

- **Given**: Użytkownik korzysta z klawiatury lub czytnika ekranu na szczegółach przepisu.
- **When**: Przechodzi `Tab` do sekcji „Moja notatka", aktywuje CTA/„Edytuj" i edytuje treść.
- **Then**: Wszystkie elementy mają widoczny fokus i nazwy dostępne dla czytnika (etykieta pola, przyciski), licznik znaków jest ogłaszany grzecznie (`aria-live="polite"`), a akcje wywoływane `Enter`/`Spacja` działają jak kliknięcie.

## Definicja ukończenia (Definition of Done)

- [ ] Migracja: tabela `user_recipe_notes` (PK `(user_id, recipe_id)`, `CHECK char_length(note) BETWEEN 1 AND 2000`, kaskadowe FK, trigger `updated_at`), polityki RLS (SELECT/DELETE właściciel; INSERT/UPDATE właściciel + przepis dostępny: nieusunięty i własny lub `PUBLIC`; brak dostępu `anon`) oraz RPC `set_recipe_note` (`security invoker`, usuwanie przy pustej notatce, `404` dla niedostępnego przepisu)
- [ ] Endpoint `PUT /recipes/{id}/note` (walidacja Zod, trim i normalizacja w API, idempotentność, `400`/`401`/`404`, ujednolicony format błędu) oraz pole `my_note` w `GET /recipes/{id}`, `GET /public/recipes/{id}` i szczegółach `explore` (tylko dla JWT; brak pola dla gościa); listy bez notatki
- [ ] Współdzielone kontrakty DTO w `shared/contracts/types.ts` oraz zregenerowane typy bazy
- [ ] Widok szczegółów (`/recipes/:id-:slug` i `/explore/recipes/:id-:slug`, tylko zalogowany): sekcja „Moja notatka" z CTA „Dodaj notatkę", edycją inline (Zapisz/Anuluj/Usuń z potwierdzeniem), licznikiem znaków, ostrzeżeniem o niezapisanych zmianach, blokadą podczas zapisu, snackbarami i rollbackiem; brak sekcji dla gościa; brak pola notatki w formularzu edycji przepisu; brak wskaźnika na kafelkach
- [ ] Notatka nie wpływa na `updated_at` przepisu, `search_vector`, normalizację, wyszukiwanie, AI, plan, zakupy ani wydruk
- [ ] Testy jednostkowe (Vitest): walidacja i trim (w tym limit 2000 i emoji), mapowanie błędów `400`/`401`/`404`, serwis i komponent notatki (tryby, licznik, dirty-guard, rollback, snackbary), wspólny moduł `_shared` dla `my_note`; testy RLS/prywatności (SQL lub integracyjne)
- [ ] Test E2E (Playwright): dodanie, edycja i usunięcie notatki na własnym i cudzym publicznym przepisie, brak sekcji dla gościa, brak wycieku notatki innemu użytkownikowi
- [ ] Lint i build przechodzą bez błędów (frontend i Edge Functions)
- [ ] Dokumentacja zaktualizowana: `project-summary.md` — **sekcja „Granice"** (usunięcie wyłączenia „notatki użytkownika przy cudzym przepisie", doprecyzowanie, że notatki są prywatne i poza wyszukiwaniem/AI/eksportem), sekcje 0/1/4/5/6 oraz usunięcie PS-31 z backlogu; plany API/UI w `docs/results/new-features/user-stories/PS-31/`
- [ ] Code review zakończone pozytywnie

## Powiązania

- **PS-31** — to zgłoszenie (Jira: „notatka użytkownika")
- **Aktualizacja `project-summary.md`, sekcja 1 „Granice":** obecny wpis „…notatki użytkownika przy cudzym przepisie" przestaje obowiązywać po wdrożeniu PS-31 — należy go usunąć z listy granic i zastąpić zapisem, że notatki są wdrożone wyłącznie jako **prywatne** (tylko autor notatki, bez współdzielenia i bez tekstowych recenzji/komentarzy, które pozostają poza zakresem); w „Głównych założeniach produktu" dodać punkt o osobistych notatkach (jedna na użytkownika i przepis, tylko zalogowany).
- Powiązane historyjki i funkcje:
  - **PS-95** — osobiste flagi przepisu (ten sam model danych per użytkownik, ten sam predykat dostępności przepisu, RPC `security invoker`, optimistic update/rollback/snackbar)
  - **PS-99** — oceny przepisów (pole „moje" tylko dla JWT, sekcja na szczegółach przepisu)
  - US-004 — Przeglądanie szczegółów przepisu
  - US-019 / US-020 — Szczegóły publicznego przepisu, publiczne widoki w trybie zalogowanego
  - US-021 / US-025 — Dodanie publicznego przepisu do kolekcji (źródło cudzych przepisów w kolekcjach; tylko `PUBLIC`)
  - Funkcje bez zmian i bez udziału notatki: wyszukiwanie pełnotekstowe, normalizacja składników, „Mój plan" (US-038 / PS-65), lista zakupów, asystent AI, wydruk przepisu
- **Historyjki przyszłe (osobne):** wskaźnik notatki na kafelkach i filtr „z notatką"; ewentualne rozszerzenie na cudze przepisy `SHARED` (wymaga wcześniejszej zmiany RLS przepisów)
- Widoki: `/recipes/:id-:slug`, `/explore/recipes/:id-:slug`
- Endpointy: nowy `PUT /recipes/{id}/note`; rozszerzone `GET /recipes/{id}`, `GET /public/recipes/{id}` (oraz szczegóły przepisu w funkcji `explore`, o ile je zwraca)
- Baza danych: nowa tabela `user_recipe_notes`, nowe RPC `set_recipe_note`
