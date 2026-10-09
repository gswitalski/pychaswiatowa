# PS-95: Osobiste flagi przepisu „Ulubiony" i „Chcę wypróbować"

## Opis

Jako zalogowany użytkownik przeglądający przepisy, chcę jednym kliknięciem oznaczyć widoczny dla mnie przepis flagą „Ulubiony" (serduszko) i/lub „Chcę wypróbować" (druga ikonka), aby szybko zaznaczać przepisy ważne dla mnie osobiście i mieć je wyróżnione (serduszko na kafelku) bez zmieniania samego przepisu ani informowania o tym innych osób.

## Kontekst

PychaŚwiatowa to cyfrowa książka kucharska, w której użytkownik gromadzi własne przepisy, a także korzysta z przepisów publicznych innych autorów (`/explore`, kolekcje z cudzymi przepisami `PUBLIC`). Dziś jedynymi flagami przy przepisie są cechy samego przepisu ustawiane przez autora (Termorobot, Grill — US-029, US-043). Brakuje **osobistych** znaczników czytelnika: „to lubię" oraz „chcę to kiedyś ugotować". Kolekcje i „Mój plan" pełnią inne role (organizacja tematyczna i planowanie zakupów), a limit planu Free (PS-65) wynosi tylko 3 pozycje, więc nie nadają się do trwałego oznaczania ulubionych.

Flagi muszą być **osobne dla każdego użytkownika** — nie mogą być kolumną w tabeli `recipes`, bo przepis może być cudzy i publiczny. Wymaga to nowej tabeli powiązanej z użytkownikiem (z RLS), nowego endpointu zapisu oraz rozszerzenia istniejących odpowiedzi API (szczegóły i listy) i widoków (szczegóły przepisu, kafelki).

Zakres tej historyjki: **ustawianie flag na widoku szczegółów** oraz **wskaźnik serduszka na kafelkach**. Wyszukiwanie/filtrowanie po flagach jest **poza zakresem** i zostanie zrealizowane w osobnej historyjce.

## Założenia i ograniczenia

- **Flagi są prywatne.** Widzi je wyłącznie użytkownik, który je ustawił. Autor przepisu ani inni użytkownicy nie widzą flag i nie ma żadnych powiadomień.
- **Flagi można ustawić na dowolnym przepisie widocznym dla użytkownika:** własnym (dowolna widoczność), publicznym cudzym oraz cudzym z moich kolekcji.
- **Flagi są niezależne** — przepis może być jednocześnie „Ulubiony" i „Chcę wypróbować". Każda ikonka działa jak osobny przełącznik (toggle).
- **Bez limitów i bez różnic między rolami** (`user`, `premium`, `admin`) — funkcja dostępna dla wszystkich zalogowanych. Gość nie ma flag ani ikonek.
- **Zmiana flag tylko na widoku szczegółów:** `/recipes/:id-:slug` (prywatny) oraz `/explore/recipes/:id-:slug` (publiczny, dla zalogowanego). Na kafelku serduszko jest **tylko wskaźnikiem** (niekliklanym) — unikamy przypadkowych akcji i kolizji z kliknięciem kafelka otwierającym szczegóły.
- **Na kafelku widoczne jest wyłącznie serduszko** („Ulubiony"). Flaga „Chcę wypróbować" jest widoczna tylko na szczegółach; jej ewentualna ekspozycja na kafelkach i filtrowanie — osobna historyjka.
- **Kafelki ze wskaźnikiem serduszka (tylko zalogowany):** „Moje przepisy" (`/my-recipies`), ostatnie przepisy na dashboardzie (`/dashboard`), szczegóły kolekcji (`/collections/:id`), katalog `/explore` oraz sekcje przepisów na landingu dla zalogowanego (te same karty co w `/explore`). Gość nie widzi serduszka. Drzewo kolekcji w Sidebarze i drawer „Mój plan" pozostają bez zmian.
- **Przepis niedostępny dla użytkownika** (soft-delete, autor zmienił widoczność na prywatną/cofnięto udostępnienie) znika z jego widoków wraz z flagami; flagi nie powodują błędów ani „martwych" kafelków. Wiersze flag pozostają w bazie i są znów widoczne, jeśli przepis wróci do dostępnych. Przy trwałym usunięciu przepisu lub użytkownika flagi są usuwane kaskadowo (`ON DELETE CASCADE`).
- **Zmiana flag nie modyfikuje przepisu** — nie zmienia `updated_at` przepisu, nie uruchamia joba normalizacji składników, nie wpływa na `search_vector`.
- **Interakcja:** optymistyczna zmiana stanu ikonki od razu po kliknięciu; podczas zapisu ikonka jest zablokowana (ochrona przed podwójnym kliknięciem); przy błędzie stan jest cofany i pokazywany jest snackbar z komunikatem.
- **Dostępność:** ikonki mają `aria-pressed`, `aria-label`, tooltip i są obsługiwane z klawiatury.
- **Założenie (luka w wymaganiach):** ikonka „Chcę wypróbować" to ikona Material `bookmark` (stan aktywny) / `bookmark_border` (nieaktywny), a serduszko to `favorite` / `favorite_border`; dokładny wygląd dopasowuje się do design systemu podczas implementacji.
- **Założenie (luka w wymaganiach):** teksty tooltipów: „Dodaj do ulubionych" / „Usuń z ulubionych", „Chcę wypróbować" / „Usuń z listy do wypróbowania"; komunikat błędu: „Nie udało się zapisać. Spróbuj ponownie."
- **Założenie (propozycja techniczna):**
  - Nowa tabela `user_recipe_flags` (`user_id` FK → `auth.users`, `recipe_id` FK → `recipes` z `ON DELETE CASCADE`, `is_favorite boolean`, `is_want_to_try boolean`, `created_at`, `updated_at`), klucz główny `(user_id, recipe_id)`, RLS: SELECT/INSERT/UPDATE/DELETE tylko dla `auth.uid() = user_id`. Wstawienie wymaga, aby przepis był widoczny dla użytkownika (własny lub `PUBLIC`, `deleted_at IS NULL`).
  - Endpoint `PUT /recipes/{id}/flags` z ciałem `{ "is_favorite"?: boolean, "is_want_to_try"?: boolean }` — aktualizacja częściowa i idempotentna, wymagane co najmniej jedno pole, odpowiedź `200` ze stanem obu flag. Gdy obie flagi są `false`, wiersz może zostać usunięty.
  - Odczyt: `is_favorite` i `is_want_to_try` w `GET /recipes/{id}` oraz `GET /public/recipes/{id}` (tylko dla zalogowanego); `is_favorite` także w listach (`GET /recipes`, `/recipes/feed`, `/public/recipes`, `/public/recipes/feed`, `GET /collections/{id}`), aby kafelki nie wymagały dodatkowych zapytań. Dla gościa pola nie są zwracane.
  - Odpowiedzi API dla anonimowego użytkownika pozostają bez zmian.

## Kryteria akceptacji

### Scenariusz 1: Oznaczenie przepisu jako ulubiony (happy path)

- **Given**: Zalogowany użytkownik (dowolna rola) jest na widoku szczegółów przepisu, który jest dla niego widoczny, i przepis nie jest oznaczony jako ulubiony.
- **When**: Klika ikonkę serduszka.
- **Then**: Serduszko natychmiast zmienia się na wypełnione (`aria-pressed="true"`, tooltip „Usuń z ulubionych"), wysyłane jest `PUT /recipes/{id}/flags` z `{ "is_favorite": true }`, a po odpowiedzi `200` stan pozostaje; flaga „Chcę wypróbować" nie zmienia się.

### Scenariusz 2: Oznaczenie przepisu jako „Chcę wypróbować" (happy path)

- **Given**: Zalogowany użytkownik jest na widoku szczegółów przepisu, który nie ma flagi „Chcę wypróbować".
- **When**: Klika ikonkę „Chcę wypróbować".
- **Then**: Ikonka przechodzi w stan aktywny (`aria-pressed="true"`), wysyłane jest `PUT /recipes/{id}/flags` z `{ "is_want_to_try": true }`; flaga „Ulubiony" nie zmienia się.

### Scenariusz 3: Zdjęcie flagi (ponowne kliknięcie)

- **Given**: Przepis ma ustawioną flagę „Ulubiony" (lub „Chcę wypróbować").
- **When**: Użytkownik ponownie klika odpowiednią ikonkę.
- **Then**: Ikonka wraca do stanu nieaktywnego, wysyłane jest `PUT` z wartością `false` dla tej flagi, a przepis przestaje być oznaczony w tym zakresie; druga flaga pozostaje bez zmian.

### Scenariusz 4: Obie flagi jednocześnie

- **Given**: Użytkownik jest na szczegółach przepisu bez żadnych flag.
- **When**: Klika kolejno serduszko i ikonkę „Chcę wypróbować".
- **Then**: Obie ikonki są aktywne jednocześnie; po odświeżeniu strony oba stany są zachowane.

### Scenariusz 5: Serduszko widoczne na kafelku

- **Given**: Zalogowany użytkownik ma przepis oznaczony jako ulubiony.
- **When**: Otwiera „Moje przepisy", dashboard, szczegóły kolekcji zawierającej ten przepis, katalog `/explore` lub landing (jako zalogowany).
- **Then**: Na kafelku tego przepisu widoczne jest wypełnione serduszko; na kafelkach przepisów nieoznaczonych jako ulubione serduszka nie ma. Ikonka „Chcę wypróbować" nie jest wyświetlana na kafelku.

### Scenariusz 6: Serduszko na kafelku nie jest klikalne

- **Given**: Kafelek przepisu ze wskaźnikiem serduszka.
- **When**: Użytkownik klika w serduszko na kafelku.
- **Then**: Kliknięcie działa jak kliknięcie kafelka (nawigacja do szczegółów); stan flagi nie zmienia się.

### Scenariusz 7: Flagi na cudzym przepisie publicznym

- **Given**: Zalogowany użytkownik jest na `/explore/recipes/:id-:slug` przepisu innego autora (nie jest w żadnej jego kolekcji).
- **When**: Ustawia flagę „Ulubiony" i/lub „Chcę wypróbować".
- **Then**: Flaga zostaje zapisana; po powrocie do `/explore` kafelek tego przepisu pokazuje serduszko (dla „Ulubiony"); autor przepisu nie widzi żadnej informacji o fladze.

### Scenariusz 8: Prywatność flag

- **Given**: Użytkownik A oznaczył publiczny przepis jako ulubiony.
- **When**: Użytkownik B (lub gość) otwiera ten sam przepis oraz jego kafelek w katalogu.
- **Then**: Użytkownik B nie widzi flag użytkownika A (jego stan flag zależy wyłącznie od jego własnych ustawień); gość nie widzi ikonek flag ani serduszka. Użytkownik B nie może odczytać ani zmodyfikować flag użytkownika A (RLS / `403` lub brak danych).

### Scenariusz 9: Gość nie ma flag

- **Given**: Niezalogowany użytkownik jest na `/explore/recipes/:id-:slug` lub na `/explore`.
- **When**: Przegląda szczegóły i kafelki.
- **Then**: Ikonki flag ani serduszko na kafelkach nie są wyświetlane; odpowiedzi publicznych endpointów nie zawierają pól `is_favorite` / `is_want_to_try`.

### Scenariusz 10: Błąd zapisu flagi

- **Given**: Użytkownik jest na szczegółach przepisu, a `PUT /recipes/{id}/flags` zwraca błąd (np. `500`, brak sieci).
- **When**: Klika ikonkę serduszka.
- **Then**: Ikonka po krótkiej chwili wraca do poprzedniego stanu, wyświetlany jest snackbar „Nie udało się zapisać. Spróbuj ponownie."; stan na kafelkach nie zmienia się.

### Scenariusz 11: Ochrona przed podwójnym kliknięciem

- **Given**: Zapis flagi jest w toku (żądanie nie zakończyło się).
- **When**: Użytkownik ponownie klika tę samą ikonkę.
- **Then**: Ikonka jest zablokowana (`disabled`), nie jest wysyłane drugie żądanie; po zakończeniu zapisu ikonka znów reaguje na kliknięcia.

### Scenariusz 12: Wygasła sesja lub brak uprawnień

- **Given**: Sesja użytkownika wygasła (lub JWT jest nieprawidłowy) w trakcie przeglądania szczegółów.
- **When**: Klika ikonkę flagi.
- **Then**: API zwraca `401`; obsługa jest zgodna z istniejącym mechanizmem aplikacji (przekierowanie do logowania); zmiana flagi nie jest utrwalona, a ikonka wraca do poprzedniego stanu.

### Scenariusz 13: Przepis niedostępny lub nieistniejący

- **Given**: Przepis został usunięty (soft-delete) lub jego autor zmienił widoczność na prywatną, więc przepis nie jest już widoczny dla użytkownika.
- **When**: Użytkownik próbuje ustawić flagę (np. stara karta przeglądarki) lub otwiera listy.
- **Then**: `PUT /recipes/{id}/flags` zwraca `404`, a UI pokazuje komunikat błędu (jak w scenariuszu 10); przepis nie pojawia się w listach, więc nie ma „martwych" kafelków z serduszkiem.

### Scenariusz 14: Powrót przepisu do dostępnych

- **Given**: Użytkownik oznaczył cudzy publiczny przepis jako ulubiony, a autor tymczasowo zmienił jego widoczność na prywatną i wrócił do `PUBLIC`.
- **When**: Użytkownik ponownie otwiera katalog i szczegóły przepisu.
- **Then**: Przepis jest ponownie widoczny z zachowanymi flagami (serduszko na kafelku i aktywne ikonki na szczegółach).

### Scenariusz 15: Walidacja żądania

- **Given**: Zalogowany użytkownik wywołuje `PUT /recipes/{id}/flags`.
- **When**: Ciało żądania jest puste, zawiera nieznane pola lub wartości inne niż `boolean`.
- **Then**: API zwraca `400` z komunikatem walidacji, a flagi nie są modyfikowane. Powtórzenie tego samego poprawnego żądania jest idempotentne (ten sam wynik `200`).

### Scenariusz 16: Dostępność

- **Given**: Użytkownik korzysta z klawiatury lub czytnika ekranu na szczegółach przepisu.
- **When**: Przechodzi `Tab` do ikonek flag i aktywuje je klawiszem `Enter` lub `Spacja`.
- **Then**: Ikonki mają widoczny fokus, `aria-label` oraz `aria-pressed` odzwierciedlający stan, a zmiana stanu jest wywoływana tak samo jak kliknięciem myszy.

### Scenariusz 17: Brak wpływu na przepis

- **Given**: Użytkownik (nie-autor lub autor) zmienia flagę na przepisie.
- **When**: Zmiana zostaje zapisana.
- **Then**: Pole `updated_at` przepisu, jego treść, `search_vector` ani status normalizacji składników nie zmieniają się.

## Definicja ukończenia (Definition of Done)

- [ ] Migracja: tabela `user_recipe_flags` z kluczem `(user_id, recipe_id)`, kaskadowym usuwaniem i politykami RLS (tylko właściciel flag; insert tylko dla widocznego przepisu)
- [ ] Endpoint `PUT /recipes/{id}/flags` (walidacja, idempotentność, `400`/`401`/`404`) oraz pola `is_favorite` / `is_want_to_try` w szczegółach i `is_favorite` w listach (tylko dla zalogowanych)
- [ ] Widok szczegółów (prywatny i publiczny dla zalogowanego): dwie ikonki-przełączniki z optymistyczną aktualizacją, blokadą podczas zapisu, cofnięciem i snackbarem przy błędzie, `aria-pressed`, tooltip
- [ ] Wskaźnik serduszka (niekliklany) na kafelkach: „Moje przepisy", dashboard, szczegóły kolekcji, `/explore` i landing dla zalogowanego; brak dla gościa
- [ ] Testy jednostkowe/integracyjne (Vitest) pokrywają scenariusze akceptacji, w tym RLS/prywatność, walidację i błędy zapisu
- [ ] Test E2E (Playwright): ustawienie i zdjęcie flagi na szczegółach, serduszko na kafelku, brak flag dla gościa
- [ ] Dokumentacja techniczna zaktualizowana (`project-summary.md`: tabela, endpoint, widoki; plan API/UI w `docs/results/new-features/user-stories/PS-95/`)
- [ ] Code review zakończone pozytywnie

## Powiązania

- **PS-95** — to zgłoszenie
- Powiązane historyjki użytkownika:
  - US-004 — Przeglądanie szczegółów przepisu
  - US-007 — Przeglądanie listy przepisów (kafelki)
  - US-019 / US-020 — Szczegóły publicznego przepisu, publiczne widoki w trybie zalogowanego
  - US-021 / US-025 — Dodanie publicznego przepisu do kolekcji, oznaczenia cudzych przepisów (zbliżony wzorzec badge na kafelku)
  - US-029 / US-043 — Flagi Termorobot i Grill (flagi przepisu ustawiane przez autora — nie mylić z osobistymi flagami PS-95)
  - US-038 / PS-65 — „Mój plan" i jego limit Free (osobna funkcja, bez zmian)
- **Historyjka przyszła (osobna):** wyszukiwanie i filtrowanie przepisów po fladze „Ulubiony" / „Chcę wypróbować"
- Widoki: `/recipes/:id-:slug`, `/explore/recipes/:id-:slug`, `/my-recipies`, `/dashboard`, `/collections/:id`, `/explore`, `/`
- Endpointy: nowy `PUT /recipes/{id}/flags`; rozszerzone `GET /recipes/{id}`, `GET /public/recipes/{id}`, `GET /recipes`, `GET /recipes/feed`, `GET /public/recipes`, `GET /public/recipes/feed`, `GET /collections/{id}`
